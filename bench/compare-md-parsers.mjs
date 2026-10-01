#!/usr/bin/env node
// 다른 HWP/HWPX 파서와의 비교 채점 (측정용 — 게이트 아님)
//
// 사용법:
//   .venv-hwpforge/bin/python bench/hwpforge-bench.py /tmp/hwpforge-md     # 비교 대상 Markdown 생성
//   node bench/compare-md-parsers.mjs /tmp/hwpforge-md [--name=hwpforge] [--doc=부분문자열] [--include-single-col]
//
// 두 파서 모두 **Markdown 출력만** 같은 채점기로 잰다 — kordoc 도 IR 이 아니라 markdown 을 쓴다.
//   정답  : 원본 HWPX 의 XML 을 직접 읽은 참조(bench/ref/hwpx-ref.mjs, score.mjs 와 같은 독립 추출기).
//           HWP5(.hwp) 는 같은 폴더·같은 이름 .hwpx 짝이 있을 때 그 HWPX 참조로 잰다.
//   글    : 참조 문단·셀·글상자 글을 markdown 평문에 정렬(align.mjs) — 재현율(빠진 글), 가짜 글 비율(참조에 없는 본문 문자),
//           읽기 순서(고유 본문 유닛 위치의 최장 증가 부분열 비율)
//   표    : markdown 의 파이프 표·HTML 표(colspan·rowspan·중첩)를 같은 파서로 격자화해 score.mjs 와 같은 scoreTables 로 대조 —
//           표 완전 일치(칸 짜임)·칸 F1. 1열 표(1×1 포함)는 양쪽 모두 뺀다(꾸밈 틀 — 문단/표는 표현 선택, --include-single-col 로 포함).
//           정답 표는 보이는 표(v4.17.0 채점 기준 변경, ref/visible-tables.mjs) — 선이 안 보이는 틀 표는 글, 칸 분수는 수식이라 글 모수 밖
// 출력: bench/out/compare-<name>.json + 콘솔 요약

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "../dist/index.js"
import { extractRef } from "./ref/hwpx-ref.mjs"
import { normKey, mdToPlain } from "./lib/normalize.mjs"
import { mdTables } from "./lib/md-tables.mjs"
import { alignUnits, lisLength } from "./lib/align.mjs"
import { collectIrGrids, scoreTables } from "./lib/table-score.mjs"

const root = fileURLToPath(new URL(".", import.meta.url))
const args = process.argv.slice(2)
const otherDir = args.find(a => !a.startsWith("--"))
const name = (args.find(a => a.startsWith("--name=")) ?? "--name=hwpforge").split("=")[1]
const docFilter = (args.find(a => a.startsWith("--doc=")) ?? "").split("=")[1] ?? null
// 1열 표(1×1 포함)는 기본적으로 표 채점에서 뺀다 — 코퍼스 1열 표 1,288개 가운데 제목·본문 상자 43%, 빈 여백 행 틀 28%, 목록형은 3%뿐인
// 꾸밈 틀이라 Markdown 에서 표로 낼지 줄 글로 낼지는 표현 선택이다(그 글은 재현율이 채점한다). --include-single-col 은 종전 기준
const includeSingleCol = args.includes("--include-single-col")
if (!otherDir) {
  console.error("사용법: node bench/compare-md-parsers.mjs <비교 파서 markdown 디렉토리> [--name=이름]")
  process.exit(1)
}
const corpusDir = join(root, "corpus")

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(hwpx|hwp)$/i.test(e.name)) yield p
  }
}

// ─── 한 문서 채점 ──────────────────────────────────────

function scoreMd(md, ref) {
  const { text: plain } = mdToPlain(md)
  const mdKey = normKey(plain)
  const units = ref.units.map(u => ({ id: u.id, kind: u.kind, text: normKey(u.text), tableIdx: u.tableIdx }))
  const { perUnit, buf } = alignUnits(units, mdKey)
  let matched = 0, total = 0
  for (let i = 0; i < perUnit.length; i++) {
    if (!/[\p{L}\p{N}]/u.test(units[i].text)) continue
    matched += perUnit[i].matched
    total += perUnit[i].total
  }
  let phantom = 0
  for (const [a, b] of buf.unconsumed()) phantom += (mdKey.slice(a, b).match(/[\p{L}\p{N}]/gu) ?? []).length
  // 읽기 순서 — 고유하고 온전히 찾은 본문 유닛(본문 문자 4자 이상)의 위치가 참조 순서를 따르는 비율
  const freq = new Map()
  for (const u of units) if (u.text) freq.set(u.text, (freq.get(u.text) ?? 0) + 1)
  const positions = []
  for (let i = 0; i < perUnit.length; i++) {
    const u = units[i], r = perUnit[i]
    if (u.kind !== "body" || r.pos < 0 || r.matched !== r.total) continue
    if ((u.text.match(/[\p{L}\p{N}]/gu) ?? []).length < 4 || freq.get(u.text) !== 1) continue
    positions.push(r.pos)
  }
  // 1열 표(1×1 글상자형 상자 포함)는 데이터 표가 아니라 레이아웃 틀이다 — 양쪽 모두 표 채점에서 뺀다(위 includeSingleCol)
  const multi = t => t.cols > 1 || (includeSingleCol && t.rows > 1)
  const tbl = scoreTables(ref.tables.filter(multi), collectIrGrids(mdTables(md)).filter(multi))
  return {
    recall: total ? matched / total : 1,
    refChars: total, matchedChars: matched,
    phantomChars: phantom, mdChars: mdKey.length,
    order: positions.length ? lisLength(positions) / positions.length : 1,
    tables: ref.tables.filter(multi).length, tableExact: tbl.exactCount, cellF1: tbl.cellF1,
  }
}

// ─── 메인 ──────────────────────────────────────────

const rows = []
const t0 = performance.now()
let kordocMs = 0
for await (const file of walk(corpusDir)) {
  const rel = relative(corpusDir, file)
  if (docFilter && !rel.includes(docFilter)) continue
  if (/password-/.test(rel)) continue
  const isHwp = /\.hwp$/i.test(rel)
  const refPath = isHwp ? file.replace(/\.hwp$/i, ".hwpx") : file
  if (!existsSync(refPath)) continue
  let ref
  const refBuf = await readFile(refPath)
  // 암호를 모르는 HWPX(정책브리핑 배포용 등)는 정답이 될 수 없다 — score.mjs 의 lockedHwpx 와 같이 HWP 짝에서 뺀다
  // (종전엔 HWP 판만 열려 156776047 산업활동동향 6.2만 자 전부가 "가짜 글"로 셌다)
  if (isHwp && (await parse(refBuf, { filename: "ref.hwpx" }).catch(() => null))?.code === "ENCRYPTED") continue
  try { ref = await extractRef(refBuf) } catch { continue }
  const buf = await readFile(file)
  const t = performance.now()
  const res = await parse(buf, { filename: rel.split("/").pop() }).catch(e => ({ success: false, error: String(e) }))
  kordocMs += performance.now() - t
  if (!res.success && res.code === "ENCRYPTED") continue
  const otherPath = join(otherDir, rel + ".md")
  const otherMd = existsSync(otherPath) ? await readFile(otherPath, "utf8") : ""
  const otherFailed = existsSync(join(otherDir, rel + ".err")) || !existsSync(otherPath)
  rows.push({
    file: rel, format: isHwp ? "hwp" : "hwpx",
    kordoc: { failed: !res.success, ...scoreMd(res.success ? res.markdown : "", ref) },
    [name]: { failed: otherFailed, ...scoreMd(otherMd, ref) },
  })
}

function summarize(list, key) {
  const s = { docs: list.length, failed: 0, okRef: 0, okMatched: 0, refChars: 0, matchedChars: 0, phantomChars: 0, mdChars: 0, tables: 0, tableExact: 0, cellF1Sum: 0, cellF1Docs: 0, orderSum: 0, fullRecallDocs: 0 }
  for (const r of list) {
    const x = r[key]
    if (x.failed) s.failed++
    else { s.okRef += x.refChars; s.okMatched += x.matchedChars }
    s.refChars += x.refChars; s.matchedChars += x.matchedChars; s.phantomChars += x.phantomChars; s.mdChars += x.mdChars
    s.tables += x.tables; s.tableExact += x.tableExact
    if (x.tables) { s.cellF1Sum += x.cellF1; s.cellF1Docs++ }
    s.orderSum += x.order
    if (x.recall >= 0.9999) s.fullRecallDocs++
  }
  return {
    docs: s.docs, failed: s.failed,
    recall: +(s.matchedChars / Math.max(1, s.refChars)).toFixed(5),
    recallParsed: +(s.okMatched / Math.max(1, s.okRef)).toFixed(5),
    phantom: +(s.phantomChars / Math.max(1, s.mdChars)).toFixed(5),
    order: +(s.orderSum / Math.max(1, s.docs)).toFixed(5),
    fullRecallDocs: s.fullRecallDocs,
    tables: s.tables, tableExact: s.tableExact, tableExactRate: +(s.tableExact / Math.max(1, s.tables)).toFixed(5),
    cellF1: +(s.cellF1Sum / Math.max(1, s.cellF1Docs)).toFixed(5),
  }
}

const report = { generatedAt: new Date().toISOString(), other: name, elapsedMs: Math.round(performance.now() - t0), kordocParseMs: Math.round(kordocMs), summary: {} }
for (const fmt of ["hwpx", "hwp"]) {
  const list = rows.filter(r => r.format === fmt)
  if (!list.length) continue
  report.summary[fmt] = { kordoc: summarize(list, "kordoc"), [name]: summarize(list, name) }
}
report.rows = rows
await mkdir(join(root, "out"), { recursive: true })
await writeFile(join(root, "out", `compare-${name}.json`), JSON.stringify(report, null, 1))

for (const [fmt, s] of Object.entries(report.summary)) {
  console.log(`\n══ ${fmt.toUpperCase()} ${s.kordoc.docs}문서 — 원본 HWPX XML 정답 ══`)
  for (const [who, x] of Object.entries(s)) {
    console.log(`  ${who.padEnd(10)} 글 재현율 ${(x.recall * 100).toFixed(2)}% · 가짜 글 ${(x.phantom * 100).toFixed(2)}% · 순서 ${(x.order * 100).toFixed(2)}% · ` +
      `(변환 성공 문서만 ${(x.recallParsed * 100).toFixed(2)}%) · 글 누락 0 문서 ${x.fullRecallDocs}/${x.docs} · 표 완전 일치 ${x.tableExact}/${x.tables} (${(x.tableExactRate * 100).toFixed(1)}%) · 칸 F1 ${x.cellF1} · 실패 ${x.failed}`)
  }
}
console.log(`\nreport → bench/out/compare-${name}.json`)
