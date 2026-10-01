// Isolated download fixture: no network, real stream/file/SHA handling.
import { createHash } from 'node:crypto'
import { ensureModelsIn } from '../../src/pdf/formula/models.ts'
const [dir, mode] = process.argv.slice(2)
const bytes = Buffer.alloc(65536, 0x61)
const spec = { name: 'test', filename: 'test.onnx', url: 'https://not-fetched.invalid/model', sha256: createHash('sha256').update(bytes).digest('hex'), sizeMb: 1 }
let timer
let controller
if (mode === 'hold') {
  timer = setInterval(() => {}, 1000)
  process.on('message', () => { clearInterval(timer); controller.close() })
}
globalThis.fetch = async () => new Response(new ReadableStream({ start(stream) {
  controller = stream
  stream.enqueue(bytes)
  if (mode !== 'hold') stream.close()
} }))
try {
  await ensureModelsIn(dir, [spec])
} finally {
  clearInterval(timer)
  if (process.connected) process.disconnect()
}
