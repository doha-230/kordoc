import { test } from "node:test"
import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, copyFileSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import JSZip from "jszip"

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url))
const fixture = fileURLToPath(new URL("./fixtures/dummy.hwpx", import.meta.url))
const run = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
  encoding: "utf8", timeout: 60000,
})

test("parallel batch preserves sequential markdown, JSON and chunks, including image files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kordoc-batch-"))
  try {
    const files = Array.from({ length: 5 }, (_, i) => join(dir, `doc-${i}.hwpx`))
    const zip = await JSZip.loadAsync(readFileSync(fixture))
    zip.file("BinData/extra.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"))
    const data = await zip.generateAsync({ type: "nodebuffer" })
    files.forEach(file => writeFileSync(file, data))
    for (const format of ["markdown", "json", "chunks"]) {
      const seq = join(dir, `${format}-seq`), par = join(dir, `${format}-par`)
      const options = ["--format", format, "--plain", "--keep-empty-paragraphs", "--silent"]
      const a = run([...files, ...options, "-d", seq])
      const b = run([...files, ...options, "--jobs", "2", "-d", par])
      assert.equal(a.status, 0, a.stderr)
      assert.equal(b.status, 0, b.stderr)
      assert.equal(b.stdout, "")
      const names = readdirSync(seq, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile()).map(entry => join(entry.parentPath ?? entry.path, entry.name).slice(seq.length + 1)).sort()
      assert.ok(names.length > files.length, "image files and manifests are included")
      for (const name of names) assert.deepEqual(readFileSync(join(par, name)), readFileSync(join(seq, name)), name)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("parallel batch continues after a failed file and reports a nonzero status", () => {
  const dir = mkdtempSync(join(tmpdir(), "kordoc-batch-"))
  try {
    const files = ["first", "last"].map(stem => join(dir, `${stem}.hwpx`))
    files.forEach(file => copyFileSync(fixture, file))
    const result = run([files[0], join(dir, "missing.hwpx"), files[1], "--jobs", "2", "-d", join(dir, "out")])
    assert.equal(result.status, 1, result.stderr)
    const failure = JSON.parse(result.stdout)
    assert.equal(failure.file, "missing.hwpx")
    assert.equal(failure.code, "FILE_NOT_FOUND")
    assert.deepEqual(readdirSync(join(dir, "out")).filter(name => name.endsWith(".md")).sort(), ["first.md", "last.md"])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("parallel batch validates jobs, destinations and collisions before writing", () => {
  for (const jobs of ["0", "-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
    const result = run([fixture, "--jobs", jobs])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /positive integer/)
  }
  const noDir = run([fixture, fixture, "--jobs", "2"])
  assert.equal(noDir.status, 1)
  assert.match(noDir.stderr, /requires --out-dir/)
  const collision = run([fixture, fixture, "--jobs", "2", "-d", "/unused"])
  assert.equal(collision.status, 1)
  assert.match(collision.stderr, /collision/)
})

for (const scenario of ["worker crash", "parent interruption"]) {
  test(`parallel batch cleans up after ${scenario}`, { skip: process.platform !== "linux", timeout: 15000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), "kordoc-batch-stop-"))
    const files = ["first", "second"].map(stem => join(dir, `${stem}.hwpx`))
    files.forEach(file => copyFileSync(fixture, file))
    const child = spawn(process.execPath, ["--import", "tsx", cli, ...files, "--jobs", "2", "-d", join(dir, "out")])
    let stderr = ""
    child.stderr.on("data", data => { stderr += data })
    child.stdout.resume()
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", resolve)
    })
    let pids: number[] = []
    const delay = () => new Promise(resolve => setTimeout(resolve, 10))
    const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
    try {
      const deadline = Date.now() + 8000
      while (Date.now() < deadline && pids.length < 2) {
        try {
          pids = readFileSync(`/proc/${child.pid}/task/${child.pid}/children`, "utf8").trim().split(/\s+/).filter(Boolean).map(Number)
        } catch { /* process starting or exited */ }
        await delay()
      }
      assert.equal(pids.length, 2, stderr)
      if (scenario === "worker crash") process.kill(pids[0], "SIGKILL")
      else child.kill("SIGTERM")
      assert.equal(await exited, scenario === "worker crash" ? 1 : 143, stderr)
      if (scenario === "worker crash") assert.match(stderr, /Conversion worker exited/)
      const cleanupDeadline = Date.now() + 2000
      while (pids.some(alive) && Date.now() < cleanupDeadline) await delay()
      assert.ok(pids.every(pid => !alive(pid)), "no orphan worker processes")
    } finally {
      child.kill("SIGKILL")
      for (const pid of pids) { try { process.kill(pid, "SIGKILL") } catch { /* exited */ } }
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
