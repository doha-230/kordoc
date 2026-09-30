/**
 * PPTX (Office Open XML Presentation) 파서 — 슬라이드 텍스트·표·차트·SmartArt·이미지(OCR).
 *
 * PPTX 는 HWPX/XLSX/DOCX 와 같은 ZIP+XML 이지만 조판 캐시가 없다. 페이지(=슬라이드) 경계는
 * `ppt/presentation.xml` 의 `p:sldIdLst` 순서가 곧 화면 순서라 그대로 1..N 으로 매긴다.
 *
 * 읽기 순서: 슬라이드의 `p:spTree` 를 **문서 순서대로 재귀 순회**한다. 도형 전체를 먼저 훑고
 * 표를 나중에 붙이면 표와 텍스트가 번갈아 놓인 슬라이드에서 순서가 뒤집힌다.
 *
 * 조판·렌더링 없이 얻을 수 있는 글:
 *   - 도형 텍스트 (`a:p`/`a:t`) — 제목 자리표시자는 heading 2, `lvl` 1 이상은 목록, 그 밖은 문단.
 *   - 표 (`a:tbl`) — `gridSpan`·`rowSpan` 과 `hMerge`·`vMerge` 이어짐 칸을 반영해 격자를 재구성.
 *   - 차트 (`c:chartSpace`) — 계열 이름·항목·값의 **캐시**(`c:tx`/`c:cat`/`c:val`)만 읽어 표로 낸다.
 *     엑셀 원본이나 PowerPoint 없이도 숫자가 남는다. 캐시가 없으면 표를 만들 수 없다.
 *   - SmartArt (`dgm:data`) — 노드 글을 문서 순서대로 목록으로 낸다(계층은 담지 않는다).
 *   - 그림 (`a:blip`) — 슬라이드 미디어를 `images` 로 내보내고, `ocr` 옵션에 따라 글자를 읽는다.
 *   - 발표자 노트 (`notesSlide`) — 슬라이드 본문 뒤에 붙인다.
 *
 * 이미지 OCR 정책은 PDF 경로와 같다: `ocr: true`/`"force"`/함수면 수행하고, 미지정이면
 * **모델이 이미 캐시에 있을 때만** 수행한다(자동 다운로드 없음). `ocr: false` 는 끈다.
 * OCR 실패(sharp 미설치 등)는 경고만 남기고 본문 추출은 계속한다.
 */

import JSZip from "jszip"
import { DOMParser } from "@xmldom/xmldom"
import type {
  CellContext,
  DocumentMetadata,
  ExtractedImage,
  IRBlock,
  InternalParseResult,
  OutlineItem,
  ParseOptions,
  ParseWarning,
} from "../types.js"
import { KordocError, precheckZipSize, unzipLimitBytes, stripDtd } from "../utils.js"
import { parsePageRange } from "../page-range.js"
import { blocksToMarkdown, buildTable } from "../table/builder.js"
import { detectImageMime } from "../hwp5/images.js"

/** ZIP 압축 해제 누적 최대 크기 (100MB) — ZIP bomb 방지 (docx/xlsx 와 같은 캡) */
const MAX_DECOMPRESS_SIZE = unzipLimitBytes(100 * 1024 * 1024)
/** 슬라이드 수 상한 — 손상·악의적 입력의 메모리 폭주 방지 (정상 업무 덱은 훨씬 작다) */
const MAX_SLIDES = 2000
/** OCR 을 시도하는 래스터 확장자 — 나머지(emf·wmf·svg·tiff)는 내보내기만 */
const OCR_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"])
/** 미디어 확장자 → MIME */
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  emf: "image/emf",
  wmf: "image/wmf",
}
/** 관계 네임스페이스 — xmldom 폴백용 */
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

// ─── XML 헬퍼 (네임스페이스 접두어 무시) ─────────────────

const xml = (s: string) => new DOMParser().parseFromString(stripDtd(s), "text/xml") as unknown as Document

/** 접두어를 뗀 요소 이름 — xmldom 은 네임스페이스 미선언 시 localName 이 비어 태그명으로 폴백한다 */
function local(el: Element): string {
  return el.localName || el.tagName.replace(/^.*:/, "")
}

/** 직속 자식 중 이름이 일치하는 요소 */
function childrenLocal(root: Node, name: string): Element[] {
  const out: Element[] = []
  for (let c = root.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1 && local(c as Element) === name) out.push(c as Element)
  }
  return out
}

function childLocal(root: Node, name: string): Element | undefined {
  return childrenLocal(root, name)[0]
}

/** 후손 전체(문서 순서) 중 이름이 일치하는 요소 */
function descendants(root: ParentNode, name: string): Element[] {
  const out: Element[] = []
  const walk = (n: Node) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue
      const e = c as Element
      if (local(e) === name) out.push(e)
      walk(e)
    }
  }
  walk(root as unknown as Node)
  return out
}

function firstDescendant(root: ParentNode, name: string): Element | undefined {
  return descendants(root, name)[0]
}

/** 요소 안의 모든 `a:t` 텍스트를 이어붙인다 (`a:br` 는 줄바꿈) */
function textOf(root: ParentNode): string {
  const parts: string[] = []
  const walk = (n: Node) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue
      const e = c as Element
      const name = local(e)
      if (name === "br") parts.push("\n")
      else if (name === "t") parts.push(e.textContent ?? "")
      else walk(e)
    }
  }
  walk(root as unknown as Node)
  return parts.join("").replace(/[ \t]+$/gm, "").trim()
}

/** 관계(rels) 파일 → { Id: Target }. 외부 관계(TargetMode=External)는 컨테이너 안 파일이 아니다 */
function relsMap(doc: Document | undefined): Map<string, string> {
  const out = new Map<string, string>()
  for (const rel of doc ? descendants(doc, "Relationship") : []) {
    const id = rel.getAttribute("Id")
    const target = rel.getAttribute("Target")
    if (id && target && rel.getAttribute("TargetMode") !== "External") out.set(id, target)
  }
  return out
}

/** 관계 Id → 관계 종류(`image`·`chart`·`notesSlide` …) */
function relKindMap(doc: Document | undefined): Map<string, string> {
  const out = new Map<string, string>()
  for (const rel of doc ? descendants(doc, "Relationship") : []) {
    const id = rel.getAttribute("Id")
    if (id) out.set(id, relKind(rel.getAttribute("Type")))
  }
  return out
}

/** 관계 Type(정규 URI) 의 마지막 조각 — `…/relationships/chart` → `chart`. 줄임표기는 그대로 */
function relKind(type: string | null): string {
  return type ? (type.split("/").filter(Boolean).pop() ?? "") : ""
}

/** 패키지 상대 경로 정규화 (`ppt/slides` + `../charts/c1.xml` → `ppt/charts/c1.xml`) */
function resolvePart(base: string, target: string): string {
  const parts = (target.startsWith("/") ? target.slice(1) : `${base}/${target}`).split("/")
  const out: string[] = []
  for (const p of parts) {
    if (p === "..") out.pop()
    else if (p && p !== ".") out.push(p)
  }
  return out.join("/")
}

// ─── 표 ────────────────────────────────────────────────

/**
 * `a:tbl` → IRTable. DrawingML 은 병합 칸을 두 방향으로 표현한다: 시작 칸은 `gridSpan`/`rowSpan`
 * 값을 갖고, 이어지는 칸은 `hMerge`/`vMerge="1"` 로 표시된다. 이어짐 칸을 버리고 시작 칸의
 * span 만 남겨야 격자가 어긋나지 않는다.
 */
function parseTable(tbl: Element): IRBlock | undefined {
  const rows: CellContext[][] = []
  for (const tr of childrenLocal(tbl, "tr")) {
    const cells: CellContext[] = []
    for (const tc of childrenLocal(tr, "tc")) {
      if (tc.getAttribute("hMerge") === "1" || tc.getAttribute("vMerge") === "1") continue
      const span = Number(tc.getAttribute("gridSpan"))
      const rowSpan = Number(tc.getAttribute("rowSpan"))
      const txBody = childLocal(tc, "txBody") ?? tc
      const paragraphs = childrenLocal(txBody, "p").map(p => textOf(p)).filter(Boolean)
      cells.push({
        text: paragraphs.join("\n"),
        colSpan: Number.isInteger(span) && span > 0 ? span : 1,
        rowSpan: Number.isInteger(rowSpan) && rowSpan > 0 ? rowSpan : 1,
      })
    }
    if (cells.length) rows.push(cells)
  }
  if (!rows.length) return undefined
  const table = buildTable(rows)
  return table.rows ? { type: "table", table } : undefined
}

// ─── 차트 ──────────────────────────────────────────────

/** `c:pt` 목록을 `idx` 순으로 정렬해 값 문자열로. idx 가 없으면 문서 순서 */
function pointValues(scope: Element): string[] {
  const pts = descendants(scope, "pt")
  if (!pts.length) {
    // pt 없이 리터럴만 쓰는 라이터 폴백
    return descendants(scope, "v").map(v => (v.textContent ?? "").trim()).filter(Boolean)
  }
  const indexed = pts.map(p => ({
    idx: Number(p.getAttribute("idx")),
    value: firstDescendant(p, "v")?.textContent?.trim() ?? "",
  }))
  if (indexed.every(p => Number.isInteger(p.idx))) indexed.sort((a, b) => a.idx - b.idx)
  // 빈 항목도 위치를 차지한다. 제거하면 뒤 숫자가 앞 항목에 잘못 붙는다.
  return indexed.map(p => p.value)
}

/**
 * 다중 수준 항목(`c:multiLvlStrRef`)은 가장 깊은 `c:lvl` 을 항목 이름으로 쓴다
 * (연도 › 분기 같은 상위 수준은 잎 라벨이 아니다).
 */
function categoryValues(container: Element | undefined): string[] {
  if (!container) return []
  const lvls = childrenLocal(container, "lvl")
  return pointValues(lvls.length ? lvls[lvls.length - 1] : container)
}

interface ChartSeries {
  name: string
  cats: string[]
  vals: string[]
}

function parseChart(chartSpace: Document): { title?: string; series: ChartSeries[]; bare: string[] } {
  // 주의: 인자는 Document 다 — `c:chartSpace` 는 루트 요소라 직속 자식 탐색은 루트에서 시작해야 한다
  const chartEl = firstDescendant(chartSpace, "chart")
  const title = chartEl ? firstDescendant(chartEl, "title") : undefined
  const series: ChartSeries[] = []
  for (const ser of descendants(chartSpace, "ser")) {
    const tx = childLocal(ser, "tx")
    series.push({
      name: tx ? (firstDescendant(tx, "v")?.textContent?.trim() ?? "") : "",
      cats: categoryValues(childLocal(ser, "cat")),
      vals: categoryValues(childLocal(ser, "val")),
    })
  }
  // 계열 구조를 못 읽은 차트(비표준·부분 손상)는 값이라도 잃지 않게 모아둔다
  const bare = [...new Set(descendants(chartSpace, "v").map(v => (v.textContent ?? "").trim()).filter(Boolean))]
  return { title: title ? textOf(title) || undefined : undefined, series: series.filter(s => s.vals.length || s.cats.length || s.name), bare }
}

/** 차트 → 제목 heading + 데이터 표(항목 × 계열). 표를 못 만들면 값 문단으로 폴백 */
function chartBlocks(chartSpace: Document, page: number): IRBlock[] {
  const { title, series, bare } = parseChart(chartSpace)
  const out: IRBlock[] = [{ type: "heading", level: 2, text: title ? `차트: ${title}` : "차트", pageNumber: page }]
  const rowCount = Math.max(0, ...series.map(s => s.cats.length))
  if (!series.length || rowCount === 0) {
    if (bare.length) out.push({ type: "paragraph", text: bare.join(" | "), pageNumber: page })
    return out
  }
  const rows: CellContext[][] = [
    [
      { text: series.length > 1 ? "구분" : "항목", colSpan: 1, rowSpan: 1 },
      ...series.map((s, i) => ({ text: s.name || `계열 ${i + 1}`, colSpan: 1, rowSpan: 1 })),
    ],
  ]
  for (let i = 0; i < rowCount; i++) {
    rows.push([
      { text: series[0].cats[i] ?? "", colSpan: 1, rowSpan: 1 },
      ...series.map(s => ({ text: s.vals[i] ?? s.cats[i] ?? "", colSpan: 1, rowSpan: 1 })),
    ])
  }
  const table = buildTable(rows)
  if (table.rows) out.push({ type: "table", table, pageNumber: page })
  else if (bare.length) out.push({ type: "paragraph", text: bare.join(" | "), pageNumber: page })
  return out
}

// ─── SmartArt ──────────────────────────────────────────

/** `dgm:data` → 노드 글 목록 (문서 순서 = 다이어그램 흐름 순서) */
function smartArtBlocks(data: Document, page: number): IRBlock[] {
  const nodes: string[] = []
  for (const pt of descendants(data, "pt")) {
    // `dgm:t`(= a:t 묶음)만 본다 — `dgm:pt` 안의 다른 값(모델 id 등)은 글자가 아니다
    const t = childLocal(pt, "t")
    const text = t ? textOf(t) : ""
    if (text) nodes.push(text)
  }
  if (!nodes.length) return []
  return [
    { type: "heading", level: 2, text: "SmartArt", pageNumber: page },
    ...nodes.map(text => ({ type: "list" as const, listType: "unordered" as const, text, pageNumber: page })),
  ]
}

// ─── 슬라이드 순회 컨텍스트 ──────────────────────────────

interface SlideContext {
  zip: JSZip
  blocks: IRBlock[]
  images: ExtractedImage[]
  warnings: ParseWarning[]
  options?: ParseOptions
  ocrWanted: boolean
  page: number
  slideDir: string
  slideRels: Map<string, string>
  slideRelsKind: Map<string, string>
  slideRelsDoc?: Document
  /** 이미 블록으로 낸 관계 Id · 파트 경로 — 끝에서 미링크 미디어를 중복 없이 붙이기 위한 것 */
  linkedMedia: Set<string>
  linkedParts: Set<string>
  /** 내보낸 이미지 순번 (문서 전체 공유) */
  counter: { image: number }
}

/** 도형 트리 재귀 순회 — 요소 종류마다 제자리에서 블록을 낸다 */
async function walkShapes(ctx: SlideContext, node: Node): Promise<void> {
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1) continue
    const el = c as Element
    switch (local(el)) {
      case "sp":
      case "cxnSp": {
        const phType = firstDescendant(el, "ph")?.getAttribute("type") ?? ""
        const isTitle = phType === "title" || phType === "ctrTitle"
        const txBody = childLocal(el, "txBody")
        for (const p of txBody ? childrenLocal(txBody, "p") : []) {
          const text = textOf(p)
          if (!text) continue
          const lvl = Number(childLocal(p, "pPr")?.getAttribute("lvl"))
          if (isTitle) ctx.blocks.push({ type: "heading", level: 2, text, pageNumber: ctx.page })
          else if (Number.isInteger(lvl) && lvl > 0) ctx.blocks.push({ type: "list", listType: "unordered", text, pageNumber: ctx.page })
          else ctx.blocks.push({ type: "paragraph", text, pageNumber: ctx.page })
        }
        await emitBlips(ctx, el)
        break
      }
      case "graphicFrame": {
        const tbl = firstDescendant(el, "tbl")
        if (tbl) {
          const block = parseTable(tbl)
          if (block) ctx.blocks.push({ ...block, pageNumber: ctx.page })
          break
        }
        await emitGraphicFrameObjects(ctx, el)
        break
      }
      case "pic":
        await emitBlips(ctx, el)
        break
      case "grpSp":
        await walkShapes(ctx, el)
        break
      default:
        // p:contentPart(잘린 덱)·알 수 없는 개체 — 안에 표·그림이 있을 수 있으니 계속 내려간다
        await walkShapes(ctx, el)
    }
  }
}

/** 도형·그림 안의 `a:blip`(r:embed) → 슬라이드 미디어 */
async function emitBlips(ctx: SlideContext, scope: Element): Promise<void> {
  for (const blip of descendants(scope, "blip")) {
    const rid = blip.getAttribute("r:embed") || blip.getAttributeNS(REL_NS, "embed") || blip.getAttribute("embed")
    if (!rid) continue
    const relTarget = ctx.slideRels.get(rid)
    if (!relTarget) continue
    ctx.linkedMedia.add(rid)
    await emitImage(ctx, resolvePart(ctx.slideDir, relTarget))
  }
}

/** graphicFrame 안의 차트·SmartArt (OLE 개체는 경고만) */
async function emitGraphicFrameObjects(ctx: SlideContext, scope: Element): Promise<void> {
  const rels = ctx.slideRelsDoc ? descendants(ctx.slideRelsDoc, "Relationship") : []
  const byId = new Map(rels.map(r => [r.getAttribute("Id") ?? "", r]))
  const ids = new Set<string>()
  for (const el of descendants(scope, "chart")) {
    const v = el.getAttribute("r:id") || el.getAttributeNS(REL_NS, "id")
    if (v) ids.add(v)
  }
  // SmartArt 는 `r:dm`(데이터) — `r:lo`(레이아웃)·`r:qs`(스타일)·`r:cs`(색) 은 글자가 아니다
  for (const el of descendants(scope, "relIds")) {
    const v = el.getAttribute("r:dm") || el.getAttributeNS(REL_NS, "dm")
    if (v) ids.add(v)
  }
  if (firstDescendant(scope, "oleObj")) {
    ctx.warnings.push({ code: "SKIPPED_OLE", page: ctx.page, message: "PowerPoint OLE 개체는 내용을 추출하지 않습니다 (내용은 개체 주변 텍스트에만 남습니다)" })
  }
  for (const rid of ids) {
    const rel = byId.get(rid)
    const relTarget = rel?.getAttribute("Target")
    if (!relTarget) continue
    const kind = relKind(rel!.getAttribute("Type"))
    const part = resolvePart(ctx.slideDir, relTarget)
    if (ctx.linkedParts.has(part)) continue
    ctx.linkedParts.add(part)
    const f = ctx.zip.file(part)
    if (!f) {
      ctx.warnings.push({ code: "PARTIAL_PARSE", page: ctx.page, message: `${kind || "개체"} 파일을 찾을 수 없습니다: ${part}` })
      continue
    }
    const doc = xml(await f.async("text"))
    if (kind === "chart") ctx.blocks.push(...chartBlocks(doc, ctx.page))
    else if (kind === "diagramData") ctx.blocks.push(...smartArtBlocks(doc, ctx.page))
  }
}

/** 슬라이드 미디어 1건 → images + 이미지 블록 (+ `ocrWanted` 면 OCR) */
async function emitImage(ctx: SlideContext, part: string): Promise<void> {
  const media = ctx.zip.file(part)
  if (!media) return
  const data = await media.async("uint8array")
  const ext = part.split(".").pop()?.toLowerCase() ?? "bin"
  const mimeType = MIME_BY_EXT[ext] ?? detectImageMime(data) ?? "application/octet-stream"
  const filename = `image_${String(++ctx.counter.image).padStart(3, "0")}.${ext}`
  if (ctx.options?.images !== false) ctx.images.push({ filename, data, mimeType, source: part })
  ctx.blocks.push({ type: "image", text: filename, pageNumber: ctx.page })
  if (!ctx.ocrWanted || !OCR_EXTENSIONS.has(ext)) return
  try {
    const { parseImageDocument } = await import("../ocr/image-ocr.js")
    const result = await parseImageDocument(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, ctx.options)
    if (!result.blocks.length) return
    ctx.blocks.push({ type: "heading", level: 3, text: `이미지 OCR (${filename})`, pageNumber: ctx.page })
    for (const b of result.blocks) ctx.blocks.push({ ...b, pageNumber: ctx.page })
    ctx.warnings.push(...result.warnings.map(w => ({ ...w, page: ctx.page })))
  } catch (e) {
    // sharp 미설치·모델 없음 등 — 본문 추출은 계속한다
    ctx.warnings.push({
      code: "NEEDS_OCR",
      page: ctx.page,
      message: `이미지 OCR을 수행하지 못했습니다 (${filename}): ${e instanceof Error ? e.message : String(e)}`,
    })
  }
}

// ─── 메인 파서 ─────────────────────────────────────────

export async function parsePptxDocument(buffer: ArrayBuffer, options?: ParseOptions): Promise<InternalParseResult> {
  precheckZipSize(buffer, MAX_DECOMPRESS_SIZE)
  const zip = await JSZip.loadAsync(buffer)
  const presentation = zip.file("ppt/presentation.xml")
  if (!presentation) throw new KordocError("유효하지 않은 PPTX 파일: ppt/presentation.xml이 없습니다")

  const warnings: ParseWarning[] = []
  const blocks: IRBlock[] = []
  const images: ExtractedImage[] = []
  const pDoc = xml(await presentation.async("text"))
  const presRelsFile = zip.file("ppt/_rels/presentation.xml.rels")
  const presRels = relsMap(presRelsFile ? xml(await presRelsFile.async("text")) : undefined)
  const slideIds = descendants(pDoc, "sldId")
    .map(el => el.getAttribute("r:id") || el.getAttributeNS(REL_NS, "id") || "")
    .filter(Boolean)
  const total = Math.min(slideIds.length, MAX_SLIDES)
  if (slideIds.length > total) {
    warnings.push({ code: "PARTIAL_PARSE", message: `슬라이드 수 상한(${MAX_SLIDES})을 넘어 앞 ${total}장만 파싱했습니다` })
  }

  const chosen = options?.pages ? parsePageRange(options.pages, total) : undefined
  // 이미지 OCR 정책 — PDF 경로와 같다 (명시 opt-in, 또는 모델이 이미 캐시에 있을 때만)
  const autoOcr = options?.ocr === undefined && (await ocrModelsCachedSafe())
  const ocrWanted = options?.ocr !== false && (Boolean(options?.ocr) || autoOcr)
  const counter = { image: 0 }

  for (let i = 0; i < total; i++) {
    const page = i + 1
    if (chosen && !chosen.has(page)) continue
    const target = presRels.get(slideIds[i])
    if (!target) {
      warnings.push({ code: "PARTIAL_PARSE", page, message: "슬라이드 관계(presentation.xml.rels)를 찾을 수 없습니다" })
      continue
    }
    const path = resolvePart("ppt", target)
    const slideFile = zip.file(path)
    if (!slideFile) {
      warnings.push({ code: "PARTIAL_PARSE", page, message: `슬라이드 파일을 찾을 수 없습니다: ${path}` })
      continue
    }

    blocks.push({ type: "heading", level: 1, text: `슬라이드 ${page}`, pageNumber: page })
    const slide = xml(await slideFile.async("text"))
    const slideDir = path.slice(0, path.lastIndexOf("/"))
    const slideRelsPath = `${slideDir}/_rels/${path.split("/").pop()!}.rels`
    const slideRelsDoc = zip.file(slideRelsPath) ? xml(await zip.file(slideRelsPath)!.async("text")) : undefined
    const ctx: SlideContext = {
      zip, blocks, images, warnings, options, ocrWanted, page, slideDir,
      slideRels: relsMap(slideRelsDoc), slideRelsKind: relKindMap(slideRelsDoc), slideRelsDoc,
      linkedMedia: new Set(), linkedParts: new Set(), counter,
    }

    const tree = firstDescendant(slide, "spTree")
    if (tree) await walkShapes(ctx, tree)

    // 본문에서 링크되지 않은 그림(도형 채우기 그림 등)은 슬라이드 끝에 붙인다 —
    // "파일만 저장되고 본문 참조 없음" 을 만들지 않는다. 그림 관계만 본다
    // (노트·차트·SmartArt 파트를 그림으로 오인해 내보내지 않게).
    for (const [rid, relTarget] of ctx.slideRels) {
      if (ctx.slideRelsKind.get(rid) !== "image") continue
      const part = resolvePart(slideDir, relTarget)
      if (ctx.linkedMedia.has(rid) || ctx.linkedParts.has(part) || !zip.file(part)) continue
      await emitImage(ctx, part)
    }

    // 발표자 노트 — 슬라이드 본문 뒤
    for (const rel of slideRelsDoc ? descendants(slideRelsDoc, "Relationship") : []) {
      if (relKind(rel.getAttribute("Type")) !== "notesSlide") continue
      const relTarget = rel.getAttribute("Target")
      if (!relTarget) continue
      const notesFile = zip.file(resolvePart(slideDir, relTarget))
      if (!notesFile) continue
      const notes = xml(await notesFile.async("text"))
      const lines = descendants(notes, "sp")
        .flatMap(sp => childrenLocal(childLocal(sp, "txBody") ?? sp, "p"))
        .map(p => textOf(p))
        .filter(Boolean)
      if (!lines.length) continue
      blocks.push({ type: "heading", level: 2, text: "발표자 노트", pageNumber: page })
      for (const text of lines) blocks.push({ type: "paragraph", text, pageNumber: page })
    }
  }

  const metadata = await readMetadata(zip)
  metadata.pageCount = total
  const outline: OutlineItem[] = blocks
    .filter(b => b.type === "heading" && b.level && b.text)
    .map(b => ({ level: b.level!, text: b.text!, pageNumber: b.pageNumber }))

  return {
    markdown: blocksToMarkdown(blocks),
    blocks,
    metadata,
    outline: outline.length ? outline : undefined,
    warnings: warnings.length ? warnings : undefined,
    images: images.length ? images : undefined,
  }
}

/** OCR 모델 캐시 확인 — 실패해도 파싱은 계속(모델 없음 = 자동 OCR 없음) */
async function ocrModelsCachedSafe(): Promise<boolean> {
  try {
    const { ocrModelsCached } = await import("../ocr/models.js")
    return await ocrModelsCached()
  } catch {
    return false
  }
}

/** docProps/core.xml — best-effort(없거나 깨져도 파싱은 계속) */
async function readMetadata(zip: JSZip): Promise<DocumentMetadata> {
  const metadata: DocumentMetadata = {}
  const core = zip.file("docProps/core.xml")
  if (!core) return metadata
  try {
    const doc = xml(await core.async("text"))
    metadata.title = tag(doc, "title")
    metadata.author = tag(doc, "creator") ?? tag(doc, "lastModifiedBy")
    metadata.description = tag(doc, "description")
    metadata.createdAt = tag(doc, "created")
    metadata.modifiedAt = tag(doc, "modified")
    const keywords = tag(doc, "keywords")
    if (keywords) metadata.keywords = keywords.split(/[,;]/).map(k => k.trim()).filter(Boolean)
  } catch (e) {
    metadata.description = undefined
    // 메타데이터는 부가 정보 — 파싱 실패로 문서 전체를 버리지 않는다
    if (process.env.KORDOC_DEBUG) process.stderr.write(`[kordoc-pptx] core.xml 파싱 실패: ${e instanceof Error ? e.message : String(e)}\n`)
  }
  return metadata
}

function tag(doc: Document, name: string): string | undefined {
  return descendants(doc, name)[0]?.textContent?.trim() || undefined
}
