/** OCR 정확도 실측 — 텍스트층 PDF를 자기 정답지로 쓰는 CER/표 구조 벤치.
 *
 *  방법: 코퍼스 PDF에서 품질 신호가 깨끗한(needsOcr=false, 충분한 글자 수) 페이지를
 *  골라, ① 텍스트층 파싱(정답) ② 같은 페이지를 216dpi 래스터 → 내장 OCR 강제
 *  (`ocr:"force"`) — 두 결과의 문자 오류율(CER)과 표 구조(scoreTables)를 대조한다.
 *
 *  표본 검사: 래스터가 텍스트층을 실제로 그리지 못한 페이지(비내장 글꼴 대체 실패 —
 *  글자 중심 대비 검사 < 0.8)는 OCR 표본이 아니므로 사유와 함께 뺀다 (skippedPages).
 *
 *  정규화 두 벌 (ocr-lib.mjs 헤더): cer*(v2 fair — 마크업·혼동 글리프·리더 비대칭 제거)가
 *  주 지표, cer*Strict(v1 — 종전 정의)는 연속성용으로 같이 낸다. 둘 다 양쪽 동일 적용.
 *  CER 은 읽기 순서에 민감하다 — 정답 자체가 같은 파이프라인의 텍스트층 출력이라, 순서
 *  무관 인식률은 charRecall/charPrecision(문자 multiset)으로 따로 본다.
 *
 *  한계(정직하게): 정답이 "클린 렌더"라 실제 스캔의 노이즈·스큐·저해상도는 반영하지
 *  않는다 — 이 수치는 OCR 파이프라인의 상한(clean-render ceiling)이다. 열화 입력은
 *  bench/ocr-robust.mjs. 텍스트층 자체의 결함(숨은 글자·빠진 괄호)도 오차로 섞인다.
 *
 *  실행: node bench/ocr-accuracy.mjs [--limit=N] [--pages=K] [--doc=이름] [--gate] [--dump=디렉토리]
 *  산출: bench/out/ocr-accuracy.json (--dump 시 문서별 GT/OCR IR 블록 JSON — 오류 분석용)
 *  --gate: 무후퇴 플로어(GATES) 미달 시 exit 1. 코퍼스·OCR 모델이 없으면 SKIP(exit 0).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"
import { parse } from "../dist/index.js"
import { collectIrGrids, scoreTables } from "./lib/table-score.mjs"
import { blockTexts, normStrict, fairText, hangulOnly, charBagPR, editDistance, rasterGlyphCoverage, imageRects, inlineGlyphImages, renderRectPngs, dropExplainedExtras, dropExplainedMisses } from "./ocr-lib.mjs"

const root = fileURLToPath(new URL(".", import.meta.url))
const args = process.argv.slice(2)
const limit = Number((args.find(a => a.startsWith("--limit=")) ?? "").split("=")[1] ?? Infinity)
const pagesPerDoc = Number((args.find(a => a.startsWith("--pages=")) ?? "").split("=")[1] ?? 2)
const docFilter = (args.find(a => a.startsWith("--doc=")) ?? "").split("=")[1] ?? null
const gateMode = args.includes("--gate")
const dumpDir = (args.find(a => a.startsWith("--dump=")) ?? "").split("=")[1] || null

const MIN_PAGE_CHARS = 200      // 정답지로 쓸 최소 글자 수 (표지·간지 배제)
const MAX_CMP_CHARS = 20000     // CER 대조 상한 (O(n·m) DP 가드)
const MAX_INLINE_GLYPH_IMAGES = 5  // 글줄 안 글자 그림 상한 (inlineGlyphImages — 성과관리 시행계획 쪽마다 9~10, 나머지 0~1)
const MIN_GLYPH_COVERAGE = 0.8  // 래스터 글자 검사 하한 (코퍼스 82쪽 실측: 정상 ≥ 0.971, 글꼴 미렌더 nanet-seoul-minutes 0.088/0.071)

// 무후퇴 플로어 — 2026-09-24 실측(읽기 품질 2차: OCR 쪽 + 정답지인 텍스트층 파싱의 자간 숫자·괘선 조각 표 수정) 래칫.
// 같은 기기 반복 실행은 출력 해시까지 동일, 여유는 기기 간 onnxruntime 스레드·부동소수 차이 흡수용(CER +0.2pp, 문자 P/R −0.2pp,
// 표 매칭 한 표 차). 지표를 올리면 여기도 올린다
//   실측: cerMicro 0.09627 · charRecall 0.9834 · charPrecision 0.9775 · hangulRecall 0.99597 ·
//         표 41/51 매칭(0.8039) · exact 21 · cellF1 0.6179 · 40문서/80쪽 (OCR 쪽만 고친 중간값: 0.14729 · 표 41/58 · cellF1 0.5362,
//         종전 1차 라운드: 0.19225 · 표 37/59 · cellF1 0.3898). 표 모수 58 → 51 은 정답지 예산서 표가 괘선 표로 제대로 모인 결과
// v4.15.0: PDF 14건 보강 → 54문서/104쪽. 보강 후 기준선과 모든 문서별 품질 수치 동일(기존 모수 무후퇴).
// 실측 CER .09995·R .98117·P .97495·한글 R .99322·표 56/72(.7778)·cellF1 .5456.
// 표 플로어 재산정(2026-09-27, v4.15.5, 사용자 승인): 정답이 같은 파서의 텍스트층 출력이라, 무괘선 목차를 표가 아닌 "항목 쪽번호"
// 문단으로 내는 역할 판정(v4.15.5 이전 커밋 3b93f1b)이 원래 OCR 과 잘 맞던 목차 표 4개(ice-arc-2026 3·korean-press-guide 1)를
// 정답 모수에서 뺐다(72→68표). 종전 0.77/0.545 는 그 표들을 포함한 값이다. 문서별 대조에서 OCR 쪽 실제 차이는 seoul-archives-guide
// 목차(텍스트층은 한컴 클립 표, OCR 은 목차 문단) 1건이며, 재산정 시점 값은 matched 0.7647·cellF1 0.5409 다
// 2026-09-28 채점 기준 변경(글 없는 그림 영역 OCR 글 제외): 그림 속 글이 우연히 정답 글자와 짝지어져 부풀던 재현율이 빠져
// 같은 출력 R .98117 → .98090·한글 R .99322 → .99288 — 재현율 하한을 새 기준 실측 바로 아래로, 정밀도 하한은 .9825 아래로 올린다
// 2026-09-28 사전 밖 괄호 「」【】 복원(엔진): 같은 채점기 R .98090 → .98337·P .98246 → .98494 — 하한을 −0.2pp 여유로 올린다
// 글머리 ◎●▪ 복원: R .98405 → .98486·P .98561 → .98623 (반각 낫표 접기 포함 새 채점기)
// 글 없는 그림을 글자 자리로 판정(채점 기준 변경): P .98623 → .98693
// 2026-09-29 채점 기준 변경(㎡·위 첨자 NFKC, • 를 가운뎃점 접기에, 본문 블록에 섞인 그림 글 v3)만으로 HEAD 출력 R .98484 → .98535·
// P .98693 → .98967, 글줄 안 글자 그림 쪽 제외(모수 54/104 → 53/102)·그려지지 않은 텍스트층 글까지 R .98597·P .99073.
// 엔진(로마 숫자·원문자·여는 따옴표·채운 자리 글자·이웃 줄 끝자락 지우기·글머리 □) R .98597 → .98771·P .99073 → .99210
// 틈 기호·○/ㅇ·●·소괄호·Ⅰ(엔진)과 ◯·❍ 접기(채점): R .98771 → .98942·P .99210 → .99339
// 틈 기호 보강·겹 별표·o·따옴표 경계: R .98942 → .99001·P .99339 → .99355
const GATES = {
  cerMicroMax: 0.100, charRecallMin: 0.988, charPrecisionMin: 0.9915, hangulRecallMin: 0.992,
  tableMatchedMin: 0.76, tableCellF1Min: 0.535, minDocs: 53, minPages: 102,
}

/** 글 없는 그림 판정 — 텍스트층 글자 자리(글자 단위)로. 종전 블록 bbox 판정은 표 블록이 표 전체를 덮어 표 안 그림(로고 모음)이 늘 '글 있는 그림'이 됐다 */
const TEXTLESS_BY_GLYPH = !process.env.OCR_TEXTLESS_BLOCKS
/** 본문 블록에 섞인 글 없는 그림의 글을 따로 읽어 잉여에서 빼기(v3) — OCR_IMAGE_TEXT_V2=1 이면 종전 채점 */
const IMAGE_TEXT_V3 = !process.env.OCR_IMAGE_TEXT_V2
/** 그려지지 않은 텍스트층 글로 설명되는 누락 빼기(v3) — OCR_HIDDEN_TEXT_V2=1 이면 종전 채점 */
const HIDDEN_TEXT_V3 = !process.env.OCR_HIDDEN_TEXT_V2
const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)

const pdfDir = join(root, "corpus", "pdf")
const modelDir = join(process.env.KORDOC_MODEL_CACHE?.trim() || join(homedir(), ".cache", "kordoc", "models"), "ppocr")
if (!existsSync(pdfDir) || !["det.onnx", "rec_korean.onnx", "rec_korean.yml"].every(f => existsSync(join(modelDir, f)))) {
  console.warn(`⚠️  [ocr-accuracy] 코퍼스(${pdfDir}) 또는 OCR 모델(${modelDir}) 없음 — SKIP (모델: kordoc check-ocr-models)`)
  process.exit(0)
}
/** 문서별 표본 쪽 — v4.15.7 선정(텍스트층 품질 신호·200자)을 고정. 새 문서는 동적으로 고른다 */
const PINNED = JSON.parse(readFileSync(join(root, "ocr-pages.json"), "utf8"))
let files = readdirSync(pdfDir).filter(f => f.endsWith(".pdf")).sort()
if (docFilter) files = files.filter(f => f.includes(docFilter))
if (Number.isFinite(limit)) files = files.slice(0, limit)

const rows = []
const skippedPages = []
let envFailures = 0
const A = { dist: 0, len: 0, lenR: 0, distS: 0, lenS: 0, hit: 0, hyp: 0, hHit: 0, hLen: 0, pages: 0, ms: 0 }
const tblAgg = { refTables: 0, matched: 0, exact: 0, f1s: [], skippedRef: 0 }

for (const f of files) {
  // pdfjs가 넘긴 ArrayBuffer를 detach하므로 파스마다 새 사본
  const raw = readFileSync(join(pdfDir, f))
  const buf = () => toAB(Buffer.from(raw))
  const probe = await parse(buf(), { ocr: false })
  if (!probe.success || !probe.pageQuality?.length) { rows.push({ doc: f, skip: "parse/quality 없음" }); continue }

  // 표본 쪽은 고정 목록(ocr-pages.json)이 있으면 그것 — 파서 출력 글자 수로 고르면 파서가 바뀔 때 표본이 흔들린다
  // (목차 리더 점을 글에서 빼자 목차 쪽이 200자 아래로 내려가 조직도 그림 쪽이 대신 뽑혔다 — 2026-09-28 채점 기준 변경)
  const cand = PINNED[f] && !Number.isFinite(limit) && pagesPerDoc === 2 ? PINNED[f] : probe.pageQuality
    .filter(q => !q.needsOcr && q.textChars >= MIN_PAGE_CHARS)
    .slice(0, pagesPerDoc).map(q => q.page)
  if (!cand.length) { rows.push({ doc: f, skip: "클린 텍스트층 페이지 없음" }); continue }
  const cov = await rasterGlyphCoverage(raw, cand)
  const clean = cand.filter(p => {
    const c = cov.get(p) ?? 1
    if (c >= MIN_GLYPH_COVERAGE) return true
    skippedPages.push({ doc: f, page: p, glyphCoverage: +c.toFixed(3), reason: "래스터에 텍스트층 글자가 그려지지 않음(글꼴 미렌더)" })
    return false
  })
  // 글줄 안 글자를 그림으로 찍은 쪽 — 텍스트층에 그 글자(괄호·쉼표·글머리)가 없어 정답이 불완전하다. 래스터 글자 검사(텍스트층
  // 글자가 안 그려진 쪽)와 짝인 표본 제외 (2026-09-29 채점 기준 변경)
  const rects = await imageRects(raw, clean)
  for (let i = clean.length - 1; i >= 0; i--) {
    const n = inlineGlyphImages(rects.get(clean[i]) ?? [])
    if (n < MAX_INLINE_GLYPH_IMAGES) continue
    skippedPages.push({ doc: f, page: clean[i], inlineGlyphImages: n, reason: "텍스트층이 글줄 안 글자를 그림으로 찍음(정답 불완전)" })
    clean.splice(i, 1)
  }
  if (!clean.length) { rows.push({ doc: f, skip: "래스터 글자 검사 미달 (skippedPages)" }); continue }

  const pages = clean.join(",")
  // 머리글/바닥글 제거는 텍스트층 y-클러스터 기반이라 OCR 경로와 비대칭 — 양쪽 다 끔
  // 양쪽 모두 원본 표 구조 그대로(layoutTables keep) — 텍스트층은 한컴 칸 클립·획으로 보이지 않는 틀을 풀지만 OCR 은 그림에서 칸 테두리를
  // 못 가려 틀을 못 푼다. OCR 인식 정확도를 재는 벤치라 틀 풀기와 무관하게 같은 조건에서 대조한다 (v4.17.0 채점 기준 변경)
  const gt = await parse(buf(), { pages, removeHeaderFooter: false, ocr: false, layoutTables: "keep" })
  const t0 = performance.now()
  const ocr = await parse(buf(), { pages, removeHeaderFooter: false, ocr: "force", layoutTables: "keep" })
  const ocrMs = performance.now() - t0
  if (!gt.success || !ocr.success) { rows.push({ doc: f, skip: `재파싱 실패: ${gt.error ?? ocr.error ?? "?"}` }); continue }
  if (!ocr.warnings?.some(w => w.code === "OCR_APPLIED")) {
    envFailures++
    rows.push({ doc: f, skip: `OCR 미적용: ${ocr.warnings?.find(w => w.code === "OCR_FAILED")?.message ?? "?"}` })
    continue
  }

  if (dumpDir) {
    mkdirSync(dumpDir, { recursive: true })
    writeFileSync(join(dumpDir, f + ".json"), JSON.stringify({ pages: clean, ms: ocrMs, gt: gt.blocks, ocr: ocr.blocks, warnings: ocr.warnings }))
  }
  // v2: 텍스트층 글이 하나도 없는 그림 영역(인포그래픽·삽화) 안의 OCR 글은 뺀다 — 정답(텍스트층)이 담을 수 없는 글이다.
  // 글이 얹힌 배경 그림(안에 텍스트층 블록이 있는 그림)은 그대로 둔다 (2026-09-28 채점 기준 변경)
  const inRect = (bb, r) => {
    if (!bb) return false
    const ix = Math.min(bb.x + bb.width, r.x2) - Math.max(bb.x, r.x1), iy = Math.min(bb.y + bb.height, r.y2) - Math.max(bb.y, r.y1)
    return ix > 0 && iy > 0 && ix * iy >= 0.6 * Math.max(1, bb.width * bb.height)
  }
  // 글 있는 그림 — 그림 안에 든 텍스트층 블록이 있거나, 그림 넓이의 10% 넘게 겹치는 텍스트층 블록(칸마다 그림을 넣은 쪽 전체 표)이 있다
  const overlaps = (bb, r) => {
    const ix = Math.min(bb.x + bb.width, r.x2) - Math.max(bb.x, r.x1), iy = Math.min(bb.y + bb.height, r.y2) - Math.max(bb.y, r.y1)
    return ix > 0 && iy > 0 && ix * iy >= 0.1 * (r.x2 - r.x1) * (r.y2 - r.y1)
  }
  const textlessAt = (pg, rs, r) => TEXTLESS_BY_GLYPH
    ? !(rs.textPts ?? []).some(p => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2)
    : !gt.blocks.some(g => g.pageNumber === pg && g.type !== "image" && g.bbox && (inRect(g.bbox, r) || overlaps(g.bbox, r)))
  const textless = [...rects].flatMap(([pg, rs]) => rs.filter(r => (r.x2 - r.x1) * (r.y2 - r.y1) > 2000 && textlessAt(pg, rs, r)).map(r => ({ pg, r })))
  const ocrKept = ocr.blocks.filter(o => !textless.some(({ pg, r }) => o.pageNumber === pg && inRect(o.bbox, r)))
  // v3: 본문 글과 한 블록에 섞인 글 없는 그림(머리 띠 로고·표 칸 로고·글줄 속 글자 그림) — 블록이 그림 밖까지 걸쳐 위 블록 판정이
  // 못 가른다. 그 그림만 잘라 같은 OCR 로 읽고, OCR 출력이 정답보다 남긴 글자 가운데 그 글로 설명되는 만큼만 글자 대조(P/R)에서
  // 뺀다 — 정답과 짝지어질 글자는 건드리지 않아 재현율은 그대로다. 위 블록 판정으로 이미 뺀 그림은 건너뛴다. CER 은 v2 그대로
  const imageText = []
  if (IMAGE_TEXT_V3) {
    const byPage = new Map()
    for (const [pg, rs] of rects) for (const r of rs) {
      if (r.x2 - r.x1 < 3 || r.y2 - r.y1 < 3 || !textlessAt(pg, rs, r)) continue
      if (ocr.blocks.some(o => o.pageNumber === pg && inRect(o.bbox, r) && textless.some(t => t.pg === pg && t.r === r))) continue
      if ((byPage.get(pg) ?? []).some(q => q.x1 === r.x1 && q.y1 === r.y1 && q.x2 === r.x2 && q.y2 === r.y2)) continue
      byPage.set(pg, [...(byPage.get(pg) ?? []), r])
    }
    for (const png of await renderRectPngs(raw, byPage)) {
      const res = await parse(toAB(png))
      if (res.success) imageText.push(...blockTexts(res.blocks))
    }
  }
  const gSegs = blockTexts(gt.blocks), oSegs = blockTexts(ocrKept)
  const a = fairText(gSegs).slice(0, MAX_CMP_CHARS)
  const b = fairText(oSegs).slice(0, MAX_CMP_CHARS)
  const as = normStrict(blockTexts(gt.blocks, { v1: true }).join(" ")).slice(0, MAX_CMP_CHARS)
  const bs = normStrict(blockTexts(ocr.blocks, { v1: true }).join(" ")).slice(0, MAX_CMP_CHARS)
  const dist = editDistance(a, b)
  const distS = editDistance(as, bs)
  const cer = a.length ? dist / a.length : 0
  const cerStrict = as.length ? distS / as.length : 0
  // 그림 글은 2자 이상 낱말이 OCR 출력에 그대로 있을 때만 — 글자 크기 그림(괄호·글머리)을 잘라 읽은 한두 자 잡음이 다른 잉여를 지우지 않게
  const imageWords = imageText.flatMap(t => t.split(/\s+/)).map(t => fairText([t])).filter(t => [...t].length >= 2 && b.includes(t))
  const bBag = imageWords.length ? dropExplainedExtras(a, b, imageWords.join("")) : b
  // 그려지지 않은 텍스트층 글(흰 글·투명 글·그림에 덮인 글 — 속기록 표지의 숨은 "국회본회의회의록")은 OCR 이 볼 수 없다. 정답이 OCR 보다
  // 남긴 글자 가운데 그 글로 설명되는 만큼만 글자 대조에서 뺀다 — OCR 이 읽은 글자와 짝지어질 글자는 건드리지 않아 정밀도는 그대로다
  const hidden = clean.flatMap(p => cov.hidden?.get(p) ?? [])
  const aBag = HIDDEN_TEXT_V3 && hidden.length ? dropExplainedMisses(a, bBag, fairText(hidden)) : a
  const bag = charBagPR(aBag, bBag)
  // 한글 음절만의 recall — 래스터에 글꼴이 안 그려진 페이지를 드러내는 보조 신호
  const ha = hangulOnly(a), hg = charBagPR(ha, hangulOnly(b))

  // 구조 채점 불가 ref 제외 — 비어있지 않은 셀 <3 이면 표 "구조"가 없다: 장식 벡터
  // 그리드(클립아트 창문 격자 — goe p3 5x6에 2셀)·단일 텍스트박스(1x1 제목/목차 박스).
  // 텍스트 자체는 recall/CER 트랙이 이미 채점하므로 이중 감점도 아니다. 문서명이 아닌
  // 구조 기준이며 제외 수는 skippedRefTables로 노출 (무음 컷 금지).
  const allRef = collectIrGrids(gt.blocks).map(g => ({ rows: g.rows, cols: g.cols, cells: g.anchors }))
  const refGrids = allRef.filter(g => g.cells.filter(x => x.text.trim()).length >= 3)
  const skippedRef = allRef.length - refGrids.length
  const hyp = collectIrGrids(ocr.blocks)
  let tbl = null
  if (refGrids.length) {
    const s = scoreTables(refGrids, hyp)
    const matched = refGrids.length - s.unmatchedRef
    tbl = { ref: refGrids.length, matched, exact: s.exactCount, cellF1: s.cellF1, skippedRef }
    tblAgg.refTables += refGrids.length
    tblAgg.matched += matched
    tblAgg.exact += s.exactCount
    tblAgg.skippedRef += skippedRef
    if (s.cellF1 != null) tblAgg.f1s.push(s.cellF1)
  } else if (skippedRef > 0) {
    tblAgg.skippedRef += skippedRef
  }

  A.dist += dist; A.len += a.length; A.distS += distS; A.lenS += as.length
  A.lenR += aBag.length
  A.hit += bag.hit; A.hyp += bBag.length; A.hHit += hg.hit; A.hLen += ha.length
  A.pages += clean.length; A.ms += ocrMs
  rows.push({
    doc: f, pages: clean, gtChars: a.length, dist, cer: +cer.toFixed(4), cerStrict: +cerStrict.toFixed(4),
    charRecall: +bag.recall.toFixed(4), charPrecision: +bag.precision.toFixed(4), hangulRecall: +hg.recall.toFixed(4),
    secPerPage: +(ocrMs / 1000 / clean.length).toFixed(2), tbl,
  })
  console.log(`${f} p[${pages}] CER ${(cer * 100).toFixed(2)}% (strict ${(cerStrict * 100).toFixed(2)}%) recall ${(bag.recall * 100).toFixed(1)}% prec ${(bag.precision * 100).toFixed(1)}% 한글recall ${(hg.recall * 100).toFixed(1)}% ${(ocrMs / 1000 / clean.length).toFixed(1)}s/p${tbl ? ` 표 ${tbl.matched}/${tbl.ref} cellF1 ${tbl.cellF1?.toFixed(3)}` : ""}`)
}

const scored = rows.filter(r => !r.skip)
const median = (xs) => xs.length ? +[...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)].toFixed(5) : null
const recall = A.lenR ? A.hit / A.lenR : null
const precision = A.hyp ? A.hit / A.hyp : null
const summary = {
  generatedAt: new Date().toISOString(),
  docs: scored.length, skipped: rows.length - scored.length,
  pages: A.pages,
  skippedPages,
  cerMicro: A.len ? +(A.dist / A.len).toFixed(5) : null,
  cerMedian: median(scored.map(r => r.cer)),
  charRecallMicro: recall != null ? +recall.toFixed(5) : null,
  charPrecisionMicro: precision != null ? +precision.toFixed(5) : null,
  charF1: recall != null && precision != null ? +(2 * recall * precision / Math.max(1e-9, recall + precision)).toFixed(5) : null,
  hangulRecallMicro: A.hLen ? +(A.hHit / A.hLen).toFixed(5) : null,
  cerMicroStrict: A.lenS ? +(A.distS / A.lenS).toFixed(5) : null,
  cerMedianStrict: median(scored.map(r => r.cerStrict)),
  secPerPage: A.pages ? +(A.ms / 1000 / A.pages).toFixed(2) : null,
  tables: tblAgg.refTables ? {
    refTables: tblAgg.refTables, matched: tblAgg.matched, exact: tblAgg.exact,
    matchedRate: +(tblAgg.matched / tblAgg.refTables).toFixed(4),
    exactRate: +(tblAgg.exact / tblAgg.refTables).toFixed(4),
    cellF1Mean: tblAgg.f1s.length ? +(tblAgg.f1s.reduce((x, y) => x + y, 0) / tblAgg.f1s.length).toFixed(4) : null,
    // 구조 채점 불가로 모수에서 뺀 ref (비어있지 않은 셀 <3 — 장식 그리드·단일 텍스트박스)
    skippedRefTables: tblAgg.skippedRef,
  } : null,
  note: "정답=같은 PDF의 클린 텍스트층, 입력=216dpi 렌더 강제 OCR — 실스캔 노이즈/스큐 미반영(상한치). cer=v2 fair 정규화, cerStrict=v1",
}

// 플로어는 전체 모수 집계값 기준 — --doc·--limit·--pages 부분 실행은 보고만 (환경 실패만 판정)
const full = !docFilter && !Number.isFinite(limit) && pagesPerDoc === 2
const gates = {
  cerMicro: { value: summary.cerMicro, threshold: `≤ ${GATES.cerMicroMax}`, pass: !full || (summary.cerMicro != null && summary.cerMicro <= GATES.cerMicroMax) },
  charRecall: { value: summary.charRecallMicro, threshold: `≥ ${GATES.charRecallMin}`, pass: !full || (summary.charRecallMicro ?? 0) >= GATES.charRecallMin },
  charPrecision: { value: summary.charPrecisionMicro, threshold: `≥ ${GATES.charPrecisionMin}`, pass: !full || (summary.charPrecisionMicro ?? 0) >= GATES.charPrecisionMin },
  hangulRecall: { value: summary.hangulRecallMicro, threshold: `≥ ${GATES.hangulRecallMin}`, pass: !full || (summary.hangulRecallMicro ?? 0) >= GATES.hangulRecallMin },
  tableMatched: { value: summary.tables?.matchedRate ?? null, threshold: `≥ ${GATES.tableMatchedMin}`, pass: !full || (summary.tables?.matchedRate ?? 0) >= GATES.tableMatchedMin },
  tableCellF1: { value: summary.tables?.cellF1Mean ?? null, threshold: `≥ ${GATES.tableCellF1Min}`, pass: !full || (summary.tables?.cellF1Mean ?? 0) >= GATES.tableCellF1Min },
  population: { value: `${summary.docs}/${summary.pages}`, threshold: `≥ ${GATES.minDocs}/${GATES.minPages}`, pass: !full || (summary.docs >= GATES.minDocs && summary.pages >= GATES.minPages) },
  environment: { value: envFailures, threshold: "0 (OCR 미적용 문서)", pass: envFailures === 0 },
}
const pass = Object.values(gates).every(g => g.pass)

mkdirSync(join(root, "out"), { recursive: true })
writeFileSync(join(root, "out", "ocr-accuracy.json"), JSON.stringify({ summary, pass, gates, rows }, null, 2))
console.log("\n== OCR accuracy (clean-render ceiling) ==")
console.log(JSON.stringify(summary, null, 2))
for (const [k, g] of Object.entries(gates)) console.log(`${g.pass ? "✅" : "❌"} ${k}: ${g.value} (${g.threshold})`)
console.log(`report → bench/out/ocr-accuracy.json | ${pass ? "PASS ✅" : "FAIL ❌"}${gateMode ? "" : " (보고 전용 — --gate 시 exit code 반영)"}`)
if (gateMode && !pass) process.exit(1)
