#!/usr/bin/env node
// 같은 입력의 결과 동등성을 확인한 뒤 파싱·공문서 생성 병목을 A/B 측정한다.
// 사용법: node bench/perf-quality.mjs --baseline=/절대경로/기준checkout [--pdf=/대표문서.pdf ...]
// 양쪽 npm run build 필요. 성능 수치는 단독 실행에서 비교한다.
import { performance } from 'node:perf_hooks'
import { tsImport } from 'tsx/esm/api'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { createHash } from 'node:crypto'

const baselineArg = process.argv.find(a => a.startsWith('--baseline='))?.slice('--baseline='.length)
if (!baselineArg) { console.error('사용법: node bench/perf-quality.mjs --baseline=/기준checkout'); process.exit(1) }
const roots = [resolve(baselineArg), fileURLToPath(new URL('..', import.meta.url))]
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1]
const measure = (fn, reps = 7) => {
  fn()
  const times = []
  for (let i = 0; i < reps; i++) { const start = performance.now(); fn(); times.push(performance.now() - start) }
  return median(times)
}
const fits = [], maps = [], generators = [], parsers = []
for (const root of roots) {
  const api = await import(pathToFileURL(root + '/dist/index.js').href)
  generators.push(api.markdownToHwpx)
  parsers.push(api.parse)
}
const texts = ['사업 추진 계획을 수립하고 관계기관과 협의하여 차질 없이 시행할 예정입니다.',
  '지역별 현황을 종합하여 지원계획을 수립하고 각 기관의 담당자는 현장의 의견을 반영하여 추진한다.',
  '교육 운영은 2026.\u00a09.\u00a01.부터 2026.\u00a012.\u00a031.까지 각 기관의 업무 여건을 고려하여 실시한다.']
const result = {}
const md = '# 사업 추진 계획\n\n' + Array.from({ length: 200 }, (_, i) => '○ ' + texts[i % texts.length]).join('\n\n')
const options = { gongmun: { preset: '보고서' } }
const entries = async buf => {
  const zip = await JSZip.loadAsync(buf), out = {}
  for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) out[name] = await entry.async('uint8array')
  return out
}
assert.deepEqual(await entries(await generators[0](md, options)), await entries(await generators[1](md, options)))
const samples = [[], []]
for (let i = 0; i < 9; i++) for (const j of i % 2 ? [1, 0] : [0, 1]) {
  const start = performance.now(); await generators[j](md, options)
  if (i > 1) samples[j].push(performance.now() - start)
}
result.generation = { paragraphs: 200, zipEntriesEqual: true, medianMs: samples.map(median) }

// PDF.js가 호출마다 발급하는 임시 문서 ID만 접는다. 글꼴 번호·크기·기하·텍스트는 비교한다.
function stableBlocks(value) {
  if (Array.isArray(value)) return value.map(stableBlocks)
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    key === "fontName" && typeof item === "string" ? item.replace(/^g_d\d+_/, "g_d_") : stableBlocks(item)]))
}
// 입력 파일 읽기는 시간에서 제외하고, 출력 동등성을 확인한 대표 PDF만 비교한다.
result.pdfParse = []
for (const file of process.argv.filter(a => a.startsWith('--pdf=')).map(a => resolve(a.slice(6)))) {
  const data = await readFile(file), parseOptions = { ocr: false, formulaOcr: false, images: true }
  const reference = await parsers[0](data, parseOptions), updated = await parsers[1](data, parseOptions)
  assert.ok(reference.success && updated.success, file)
  assert.equal(updated.markdown, reference.markdown, file)
  assert.deepEqual(stableBlocks(updated.blocks), stableBlocks(reference.blocks), file)
  const times = [[], []]
  for (let i = 0; i < 9; i++) for (const j of i % 2 ? [1, 0] : [0, 1]) {
    const start = performance.now(), parsed = await parsers[j](data, parseOptions)
    const ms = performance.now() - start
    assert.ok(parsed.success, file)
    assert.equal(parsed.markdown, reference.markdown, file)
    if (i > 1) times[j].push(ms)
  }
  result.pdfParse.push({ file: basename(file), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'),
    options: parseOptions, markdownEqual: true, structuralBlocksEqual: true, irNormalization: "PDF.js transient document ID prefix only", medianMs: times.map(median) })
}
// API 비교 뒤에 소스 로더를 등록한다 — tsImport의 훅이 네이티브 PDF 의존성 로딩에 개입하지 않게 한다.
for (const root of roots) {
  fits.push(await tsImport(root + '/src/hwpx/fit-line.ts', import.meta.url))
  maps.push(await tsImport(root + '/src/pdf/cell-text.ts', import.meta.url))
}
result.cellMap = []
let equivalentCases = 0
for (const text of texts) for (const font of ['한컴돋움', '휴먼명조', '굴림체', '함초롬바탕'])
  for (const pt of [12, 14, 15, 17]) for (const width of [12000, 20000, 30000, 40000]) for (const minRatio of [88, 90, 97, 101]) {
    const args = [text, font, pt, width, width - 500, minRatio]
    assert.deepEqual(fits[1].fitParagraph(...args), fits[0].fitParagraph(...args))
    equivalentCases++
  }
result.equivalentCases = equivalentCases
result.fit1000Ms = fits.map(m => measure(() => {
  for (let i = 0; i < 1000; i++) m.fitParagraph(texts[i % 3], '한컴돋움', 15, 35000, 35000, 90)
}))
for (const n of [100, 500, 1000]) {
  const cells = Array.from({ length: n * 5 }, (_, i) => ({ row: i / 5 | 0, col: i % 5, rowSpan: 1, colSpan: 1,
    bbox: { x1: i % 5 * 50, x2: (i % 5 + 1) * 50, y1: (i / 5 | 0) * 20, y2: (i / 5 | 0) * 20 + 20 } }))
  const items = cells.map((c, i) => ({ text: String(i), x: c.bbox.x1 + 5, y: c.bbox.y1 + 5, w: 10, h: 10, fontSize: 10, fontName: 'F' }))
  assert.deepEqual([...maps[0].mapTextToCells(items, cells).values()], [...maps[1].mapTextToCells(items, cells).values()])
  result.cellMap.push({ cells: cells.length, medianMs: maps.map(m => measure(() => m.mapTextToCells(items, cells), 5)) })
}

console.log(JSON.stringify(result, null, 2))
await mkdir('bench/out', { recursive: true })
await writeFile('bench/out/perf-quality.json', JSON.stringify(result, null, 2))
