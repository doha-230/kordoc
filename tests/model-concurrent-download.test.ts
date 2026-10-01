import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ensureModelsIn } from "../src/pdf/formula/models.js"

test("concurrent model downloads publish verified bytes without sharing partial files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kordoc-download-"))
  const data = Buffer.from("model bytes for concurrent first-use workers")
  const originalFetch = globalThis.fetch
  let started = 0
  let release!: () => void
  const bothStarted = new Promise<void>(resolve => { release = resolve })
  globalThis.fetch = async () => {
    if (++started === 2) release()
    await bothStarted
    return new Response(data)
  }
  try {
    const spec = { name: "test", filename: "model.onnx", url: "https://example.invalid/model", sha256: createHash("sha256").update(data).digest("hex"), sizeMb: 1 }
    await Promise.all([ensureModelsIn(dir, [spec]), ensureModelsIn(dir, [spec])])
    assert.equal(started, 2)
    assert.deepEqual(await readFile(join(dir, spec.filename)), data)
    assert.deepEqual(await readdir(dir), [spec.filename])
    await ensureModelsIn(dir, [spec])
    assert.equal(started, 2, "valid cached model is reused")
  } finally {
    globalThis.fetch = originalFetch
    await rm(dir, { recursive: true, force: true })
  }
})
