import { test } from "node:test"
import assert from "node:assert/strict"
import { spawn, type ChildProcess } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, readFile, readdir, rm, stat, writeFile, utimes, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ensureModelsIn, ensureSingleModel } from "../src/pdf/formula/models.js"
import { cleanupModelDownloadPartials, modelDownloadPartialPath } from "../src/pdf/formula/model-partials.js"

const bytes = Buffer.alloc(65536, 0x61)
const spec = { name: "test", filename: "test.onnx", url: "https://not-fetched.invalid/model", sha256: createHash("sha256").update(bytes).digest("hex"), sizeMb: 1 }
const fixture = fileURLToPath(new URL("./helpers/model-download-child.mjs", import.meta.url))
const pause = () => new Promise(resolve => setTimeout(resolve, 20))

function start(dir: string) {
  const child = spawn(process.execPath, ["--import", "tsx", fixture, dir, "hold"], { stdio: ["ignore", "ignore", "pipe", "ipc"] })
  let stderr = ""
  child.stderr!.on("data", data => { stderr += data })
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => resolve({ code, signal }))
  })
  return { child, exited, stderr: () => stderr }
}
async function partialFor(dir: string, child: ChildProcess): Promise<string> {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    for (const name of await readdir(dir)) {
      if (!name.includes(`-${child.pid}-`) || !name.endsWith(".part")) continue
      const path = join(dir, name)
      if ((await stat(path)).size === bytes.length) return path
    }
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("fixture exited before writing")
    await pause()
  }
  throw new Error("Timed out waiting for partial file")
}

for (const signal of ["SIGTERM", "SIGKILL"] as const) {
  test(`${signal} orphan is reclaimed by a successful retry`, { timeout: 20000 }, async () => {
    const dir = await mkdtemp(join(tmpdir(), "kordoc-partial-retry-"))
    const worker = start(dir)
    const originalFetch = globalThis.fetch
    try {
      await partialFor(dir, worker.child)
      worker.child.kill(signal)
      await worker.exited
      assert.equal((await readdir(dir)).length, 1, "interruption leaves the real partial")
      globalThis.fetch = async () => new Response(bytes)
      await ensureModelsIn(dir, [spec])
      assert.deepEqual(await readFile(join(dir, spec.filename)), bytes)
      assert.deepEqual(await readdir(dir), [spec.filename], "successful retry removes orphan")
    } finally {
      globalThis.fetch = originalFetch
      worker.child.kill("SIGKILL")
      await worker.exited
      await rm(dir, { recursive: true, force: true })
    }
  })
}

test("cached and single-model paths clean only dead owners, preserving an old live download", { timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "kordoc-partial-live-"))
  const cache = join(dir, "pix2text")
  await mkdir(cache)
  const dead = start(cache), live = start(cache)
  const originalFetch = globalThis.fetch
  const originalCache = process.env.KORDOC_MODEL_CACHE
  try {
    const deadPath = await partialFor(cache, dead.child)
    const livePath = await partialFor(cache, live.child)
    // Old modification time is not evidence of death: stalled live downloads survive.
    await utimes(livePath, new Date(0), new Date(0))
    dead.child.kill("SIGTERM")
    await dead.exited
    await writeFile(join(cache, spec.filename), bytes)
    globalThis.fetch = async () => { throw new Error("cached model must not fetch") }
    await Promise.all([ensureModelsIn(cache, [spec]), ensureModelsIn(cache, [spec])])
    await assert.rejects(stat(deadPath), { code: "ENOENT" })
    assert.equal((await stat(livePath)).size, bytes.length)

    // Kill the previously protected owner; ensureSingleModel must also reclaim
    // its orphan on a cache hit (without requiring a subsequent model download).
    live.child.kill("SIGKILL")
    await live.exited
    process.env.KORDOC_MODEL_CACHE = dir
    await ensureSingleModel(spec)
    assert.deepEqual(await readdir(cache), [spec.filename])
    assert.deepEqual(await readFile(join(cache, spec.filename)), bytes)
  } finally {
    globalThis.fetch = originalFetch
    if (originalCache === undefined) delete process.env.KORDOC_MODEL_CACHE
    else process.env.KORDOC_MODEL_CACHE = originalCache
    dead.child.kill("SIGKILL"); live.child.kill("SIGKILL")
    await Promise.all([dead.exited, live.exited])
    await rm(dir, { recursive: true, force: true })
  }
})

test("concurrent live download completes after another process publishes and checks the cache", { timeout: 20000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "kordoc-partial-publish-"))
  const live = start(dir)
  const originalFetch = globalThis.fetch
  try {
    const partial = await partialFor(dir, live.child)
    globalThis.fetch = async () => new Response(bytes)
    await ensureModelsIn(dir, [spec])
    await ensureModelsIn(dir, [spec])
    assert.equal((await stat(partial)).size, bytes.length)
    live.child.send("complete")
    assert.deepEqual(await live.exited, { code: 0, signal: null }, live.stderr())
    assert.deepEqual(await readdir(dir), [spec.filename])
    assert.deepEqual(await readFile(join(dir, spec.filename)), bytes)
  } finally {
    globalThis.fetch = originalFetch
    live.child.kill("SIGKILL")
    await live.exited
    await rm(dir, { recursive: true, force: true })
  }
})

test("unverifiable ownership and permission-denied liveness are preserved", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kordoc-partial-unknown-"))
  const model = join(dir, spec.filename)
  const own = modelDownloadPartialPath(model)
  const otherScope = own.replace(/kordoc-([0-9a-f]{32})-/, (_, scope: string) => `kordoc-${scope[0] === "0" ? "1" : "0"}${scope.slice(1)}-`)
  const unowned = `${model}.${randomUUID()}.part`
  const otherModel = modelDownloadPartialPath(join(dir, "different.onnx"))
  const invalidPid = own.replace(`-${process.pid}-`, "-99999999999999999999-")
  const originalKill = process.kill
  try {
    for (const path of [own, otherScope, unowned, otherModel, invalidPid]) await writeFile(path, bytes)
    process.kill = (() => { throw Object.assign(new Error("not permitted"), { code: "EPERM" }) }) as typeof process.kill
    await cleanupModelDownloadPartials(model)
    for (const path of [own, otherScope, unowned, otherModel, invalidPid]) assert.equal((await stat(path)).size, bytes.length)
  } finally {
    process.kill = originalKill
    await rm(dir, { recursive: true, force: true })
  }
})

for (const failure of ["checksum", "verify callback", "rename"] as const) {
  test(`${failure} failure removes the current process's partial`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "kordoc-partial-error-"))
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = async () => new Response(failure === "checksum" ? Buffer.from("wrong") : bytes)
      if (failure === "rename") await mkdir(join(dir, spec.filename))
      await assert.rejects(ensureModelsIn(dir, [spec], progress => {
        if (failure === "verify callback" && progress.phase === "verify") throw new Error("callback failure")
      }))
      assert.equal((await readdir(dir)).filter(name => name.endsWith(".part")).length, 0)
    } finally {
      globalThis.fetch = originalFetch
      await rm(dir, { recursive: true, force: true })
    }
  })
}
