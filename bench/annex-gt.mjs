#!/usr/bin/env node
// 법령 별표 벤치 — 법제처 별표(licbyl-byl·licbyl-byl2)의 원본 HWP 와 한컴이 찍은 PDF 를 각각 파싱해, 같은 별표의 HWPX(rhwp 변환)
// XML 을 독립 추출기(ref/hwpx-ref.mjs, 파서와 코드 공유 0%)로 읽은 정답에 대조한다. 법령 MCP·lexdiff 가 별표를 이 두 경로로 읽는다.
//   글 : 재현율(빠진 글)·가짜 글 비율·읽기 순서 — compare-md-parsers 와 같은 정렬 채점
//   표 : 마크다운 표(파이프·HTML)를 격자화해 scoreTables 로 표 완전 일치·칸 F1. 1열 꾸밈 틀은 뺀다(compare-md-parsers 와 같음)
//        정답 표는 보이는 표다(v4.17.0 채점 기준 변경, ref/visible-tables.mjs) — 선이 안 보이는 틀 행은 글, 유령 격자선(어느 칸
//        모서리도 안 쓰는 행·열 경계, 장사법 시행령 [별표 6] 과징금표: 보이는 3열·HWPX 격자 7열)은 정답 정의가 접는다. 종전엔 이 벤치가
//        정답·출력 양쪽을 따로 접었는데 정의로 흡수해 뺐다 — 출력은 compare-md-parsers 처럼 그대로 잰다
//   수식: 칸 두 개와 가로선으로 조립한 분수(정답 specials.fractions)는 글이 아니라 수식 — 출력 $…$ 개수와 대조(보고만)
// 기준선 (2026-09-30 v4.17.0, 보이는 표 정답): HWP 272문서 표 346/346·칸 F1 1·글 100%·분수 수식 11/11 |
//   PDF 표 335/346(96.8%)·칸 F1 0.995·글 99.965%. PDF 남은 11표는 괘선 있는 쪽 경계에서 행이 갈렸는지 새 행인지 가를 기하·글이 없는
//   경우(식품명인 평가방법·대기환경 부과계수 머리 행·가산대상 자격증 등)와 PDF 에 칸 경계 정보가 없는 경우(1pt 빈 간격 행·엇갈린 행)
// (종전 정답 — HWPX 표 구조 그대로 — 으로 v4.16.3: HWP 289/289 | PDF 236/289)
// 채점 기준 변경 뒤 (2026-09-29, 보이는 표 정답·visual 파서 85a06d9): HWP 표 346/347·칸 F1 0.997·글 100%·수식 11/11 |
//   PDF 표 67/347(19.3%)·칸 F1 0.556·글 99.95%·수식 2/11 — PDF 경로가 아직 틀 표를 안 푼다. 플로어(GATES)는 종전 그대로
//   여백 행 접기(A1)·온 폭 분수(P1)를 더한 정답, 같은 빌드(파서 미반영): HWP 표 306/347·칸 F1 0.981·수식 11/11 | PDF 66/347
//
// 사용법: node bench/annex-gt.mjs [--gate] [--doc=부분문자열] [--verbose]
// 산출: bench/out/annex.json. --gate: 플로어(GATES) 미달 시 exit 1 (부분 실행 --doc 은 보고만)

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "../dist/index.js"
import { extractRef } from "./ref/hwpx-ref.mjs"
import { normKey, mdToPlain } from "./lib/normalize.mjs"
import { mdTables } from "./lib/md-tables.mjs"
import { alignUnits, lisLength } from "./lib/align.mjs"
import { collectIrGrids, scoreTables } from "./lib/table-score.mjs"

const root = fileURLToPath(new URL(".", import.meta.url))
const args = process.argv.slice(2)
const gateMode = args.includes("--gate")
const verbose = args.includes("--verbose")
const docFilter = (args.find(a => a.startsWith("--doc=")) ?? "").split("=")[1] || null
const SETS = ["licbyl-byl", "licbyl-byl2"]

const GATES = {
  hwp: { tableExact: 1, cellF1: 1, recall: 1 },
  pdf: { tableExact: 0.968, cellF1: 0.995, recall: 0.9996 },
  minDocs: 272,
}

function scoreMd(md, ref) {
  const { text: plain, eqCount } = mdToPlain(md)
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
  const freq = new Map()
  for (const u of units) if (u.text) freq.set(u.text, (freq.get(u.text) ?? 0) + 1)
  const positions = []
  for (let i = 0; i < perUnit.length; i++) {
    const u = units[i], r = perUnit[i]
    if (u.kind !== "body" || r.pos < 0 || r.matched !== r.total) continue
    if ((u.text.match(/[\p{L}\p{N}]/gu) ?? []).length < 4 || freq.get(u.text) !== 1) continue
    positions.push(r.pos)
  }
  const multi = t => t.cols > 1
  const refTables = ref.tables.filter(multi)
  const tbl = scoreTables(refTables, collectIrGrids(mdTables(md)).filter(multi))
  return {
    refChars: total, matchedChars: matched, phantomChars: phantom, mdChars: mdKey.length,
    order: positions.length ? lisLength(positions) / positions.length : 1,
    eqRef: ref.specials.equations, eqHit: Math.min(eqCount, ref.specials.equations),
    tables: refTables.length, tableExact: tbl.exactCount, cellF1: tbl.cellF1,
    missed: tbl.details.filter(d => !d.exact).map(d => `${d.refDims}→${d.irDims ?? "-"}`),
  }
}

const rows = []
let parseErrors = 0
for (const set of SETS) {
  const files = (await readdir(join(root, "corpus", set))).sort()
  for (const f of files) {
    if (!f.endsWith(".hwpx")) continue
    const stem = f.slice(0, -5)
    if (!files.includes(stem + ".hwp") || !files.includes(stem + ".pdf")) continue
    if (docFilter && !stem.includes(docFilter)) continue
    const ref = await extractRef(await readFile(join(root, "corpus", set, f)))
    for (const ext of ["hwp", "pdf"]) {
      // PDF 는 OCR 을 끈다 — 모델 캐시 유무로 기계마다 결과가 갈리지 않게, 그리고 법령 MCP·lexdiff 서버(모델 없음)와 같은 조건으로
      const res = await parse(await readFile(join(root, "corpus", set, `${stem}.${ext}`)), ext === "pdf" ? { ocr: false } : undefined)
        .catch(e => ({ success: false, error: String(e) }))
      if (!res.success) parseErrors++
      const s = scoreMd(res.success ? res.markdown : "", ref)
      rows.push({ set, stem, ext, ...s })
      if (verbose && s.tableExact < s.tables) console.log(`  ${ext} ${stem.slice(0, 60)}: 표 ${s.tableExact}/${s.tables} ${s.missed.join(" ")}`)
    }
  }
}

function summarize(list) {
  const sum = k => list.reduce((s, r) => s + r[k], 0)
  const withTables = list.filter(r => r.tables)
  return {
    docs: list.length,
    recall: +(sum("matchedChars") / Math.max(1, sum("refChars"))).toFixed(5),
    phantom: +(sum("phantomChars") / Math.max(1, sum("mdChars"))).toFixed(5),
    order: +(sum("order") / Math.max(1, list.length)).toFixed(5),
    tables: sum("tables"), tableExactCount: sum("tableExact"),
    tableExact: +(sum("tableExact") / Math.max(1, sum("tables"))).toFixed(5),
    cellF1: +(withTables.reduce((s, r) => s + r.cellF1, 0) / Math.max(1, withTables.length)).toFixed(5),
    eqRef: sum("eqRef"), eqHit: sum("eqHit"),
  }
}
const summary = { hwp: summarize(rows.filter(r => r.ext === "hwp")), pdf: summarize(rows.filter(r => r.ext === "pdf")) }
const gates = {}
for (const ext of ["hwp", "pdf"]) for (const k of ["tableExact", "cellF1", "recall"]) {
  gates[`${ext}.${k}`] = { value: summary[ext][k], threshold: GATES[ext][k], pass: summary[ext][k] >= GATES[ext][k] }
}
gates.parseErrors = { value: parseErrors, threshold: 0, pass: parseErrors === 0 }
gates.population = { value: summary.hwp.docs, threshold: GATES.minDocs, pass: docFilter !== null || summary.hwp.docs >= GATES.minDocs }
const pass = Object.values(gates).every(g => g.pass)

for (const ext of ["hwp", "pdf"]) {
  const x = summary[ext]
  console.log(`${ext.toUpperCase()} ${x.docs}문서: 표 완전 일치 ${x.tableExactCount}/${x.tables} (${(x.tableExact * 100).toFixed(2)}%) · 칸 F1 ${x.cellF1} · 글 재현율 ${x.recall} · 가짜 글 ${x.phantom} · 순서 ${x.order} · 수식 ${x.eqHit}/${x.eqRef}`)
}
for (const [k, g] of Object.entries(gates)) if (!g.pass) console.log(`  ❌ ${k} ${g.value} (기준 ${g.threshold})`)
await mkdir(join(root, "out"), { recursive: true })
await writeFile(join(root, "out", "annex.json"), JSON.stringify({ generatedAt: new Date().toISOString(), summary, gates, pass, rows }, null, 1))
console.log(`report → bench/out/annex.json | ${pass ? "PASS ✅" : "FAIL ❌"}${gateMode ? "" : " (보고 전용 — --gate 시 exit code 반영)"}`)
if (gateMode && !pass && !docFilter) process.exit(1)
