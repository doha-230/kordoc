# kordoc

**모두 파싱해버리겠다** — Parse them all.

[![npm version](https://img.shields.io/npm/v/kordoc.svg)](https://www.npmjs.com/package/kordoc)
[![license](https://img.shields.io/npm/l/kordoc.svg)](https://github.com/chrisryugj/kordoc/blob/main/LICENSE)

> *Korea's document hell is second to none. Built by a civil servant who survived seven years in it.*

HWP 3.x/5.x, HWPX, HWPML, PDF, XLS, XLSX, DOCX, images (PNG/JPG/WebP) — parse, compare and generate the documents Korean government offices run on. [한국어](./README.md)

- 📊 **#1 on the public PDF benchmark** — opendataloader-bench (200 documents) overall 0.960, above all 12 published parsers (commercial included) (OCR off: 0.937 at 0.04 s per page)
- 🇰🇷 **Korean tables as they look** — scored against what the original HWPX shows, 99.6% of 9,865 visible tables match cell for cell; invisible-border layout frames become text and cell-built fractions become `$\frac{}{}$`

[![kordoc — watch the demo](./docs/video-demo.jpg)](https://youtu.be/Q13GmgDcIw0)

<sub>▶ Click to play on YouTube. Narration is in Korean.</sub>

**Contents** — [Install](#-install) · [Features](#-features) · [Performance](#-performance) · [Quick Start](#-quick-start) · [CLI](#-cli) · [MCP Server](#-mcp-server) · [API](#-api) · [Supported Formats](#-supported-formats) · [Security](#-security) · [Recent Changes](#-recent-changes)

---

## What's New in v4.18.1

**PPTX (PowerPoint) is now parsed.** Slides are read in `sldIdLst` order: `a:p` text becomes paragraphs and lists (title placeholders become `##`), tables keep their merges (`gridSpan`/`rowSpan` plus `hMerge`/`vMerge` continuation cells), and charts are read from their **cached** series names, categories and values (`c:tx`/`c:cat`/`c:val`) into a category × series table — the numbers survive without the source workbook or PowerPoint. SmartArt (`dgm:data`) becomes an ordered list of node texts and speaker notes are appended per slide under `## 발표자 노트` (Speaker notes). Slide images are exported to `images` (with the original part path as `source`) and, with `ocr: true`, read by the **same built-in engine** as image input (PP-OCRv5, including raster table reconstruction); the model is used automatically when already cached and never downloaded otherwise (`ocr: false` turns it off). Reading order follows the shape tree, so tables interleaved with text stay in place. `pages`/`pageCount` are slide-based and `--pages 2-4` narrows the parse.

**Closed-network Windows artifacts — portable ZIP and MSI.** `node scripts/pack-offline.mjs --target win32-x64 --format zip` produces a tree that runs straight after extraction (with Windows `bin\kordoc.cmd` / `bin\kordoc-mcp.cmd` launchers and a PowerShell `INSTALL.md`), and `npm run build:msi` bakes the **same staging** with WiX v5 into an OCR engine and model bundled `kordoc-<version>-win-x64.msi` (installs to `%ProgramFiles%\kordoc`, sets system `KORDOC_OFFLINE=1`, appends `bin` to PATH, points to the bundled models, replaces older versions via `MajorUpgrade`). The MSI needs WiX, so it is built on Windows/CI — [`.github/workflows/windows-package.yml`](.github/workflows/windows-package.yml) produces both and attaches OCR bundled artifacts to a GitHub Release on `v*` tags. See [docs/offline-deployment.md](docs/offline-deployment.md).

PPTX support ends the #80 behaviour where PPTX reported an unsupported format — `parse()` now parses it. Tools that edit the original file in place (`fill_form` with `hwpx-preserve`, `patch_document`) still refuse by name with `감지된 포맷: pptx`.

## ⚡ Install

All you need is Node.js 20+ (macOS / Linux / Windows).

### AI agent integration (MCP) — 30 seconds

```bash
npx -y kordoc setup
```

Pick your installed AI client (Claude Desktop · Cursor · Claude Code · Windsurf · VS Code · Gemini CLI · Zed · Antigravity · Codex) and the settings are written for you. Restart it and the [17 document tools](#-mcp-server) are on.

### Claude Code plugin

```
/plugin marketplace add chrisryugj/kordoc
/plugin install kordoc@kordoc
```

The skill turns on by itself for `.hwp`/`.hwpx` files and official-document requests (no separate install).

### Library · CLI

```bash
npm install kordoc        # CLI only? no install needed: npx kordoc <file>
```

PDF and OCR dependencies are installed by default (`--omit=optional` slims the install but drops PDF and OCR). Only PDF print rendering (`markdownToPdf`) needs `puppeteer-core` installed separately.

<details>
<summary>Troubleshooting</summary>

- **`MODULE_NOT_FOUND` / `Cannot find module ...\dist\cli.js`** — a broken global install is lingering.
  ```powershell
  npm uninstall -g kordoc
  npx -y kordoc@latest setup
  ```
- **PowerShell `npx.ps1 … PSSecurityException`** — PowerShell's default policy. Run `npx -y kordoc setup` in cmd, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and reopen PowerShell.
- **PNG rendering / image OCR fail with `MISSING_DEPENDENCY` (sharp) on network-restricted linux/x64** (#99) — onnxruntime's CUDA download failed and took sharp with it.
  ```bash
  ONNXRUNTIME_NODE_INSTALL=skip npx -y kordoc@^4 <command> ...
  ```
- **Air-gapped networks** — see [Security](#-security).

</details>

---

## 💡 Features

| Feature | What it does |
| --- | --- |
| 📄 **Document → Markdown** | HWP · HWPX · PDF · DOCX · XLS(X) · images to Markdown + structured IR (`IRBlock[]`) |
| 📊 **Tables** | As they look in the original: ruled tables keep merges and nesting, invisible-border layout frames become text, cell-built fractions become equations. Borderless PDF tables and clause comparison tables too |
| 🔍 **Redline** | Block- and cell-level differences between two documents (HWP ↔ HWPX works) |
| 📝 **Markdown → HWPX** | AI-written text back to HWPX, with tables, equations and charts |
| 🏛️ **Official documents** | Gaejosik reports, draft documents, press releases and Seoul policy-plan presets, plus a 19-rule notation linter (`kordoc lint`) |
| 🔄 **Format-preserving edits** | Apply edited Markdown to the original — only changed text is swapped (`patchHwpx`/`patchHwp`) |
| ✏️ **Form fill** | Fill blanks and click-here fields without touching formatting; two built-in draft templates |
| 🔴 **Stamps** | Float a stamp image over "(인)" (`kordoc seal`) |
| 🖼️ **Render** | SVG/PNG/PDF previews exactly as laid out, without Hancom |
| 📈 **Charts** | A Markdown fence becomes a native Hancom chart (20 types) |
| 👓 **Built-in OCR** | Scanned PDFs and images on local CPU — no API key |
| 📑 **RAG · citations** | Breadcrumb chunks and real page numbers for citations |
| 🕶️ **PII masking** | Finds resident numbers, phones, accounts and more; masks HWPX/HWP in place (a human check before publishing is required) |
| 🤖 **MCP** | Call the document tools from Claude, Cursor or Codex |

---

## 📊 Performance

Every number is reproduced by `npm run bench:gate`, which every release must pass. Scoring rules, reproduction steps and per-option numbers: [docs/benchmarks-en.md](docs/benchmarks-en.md).

### PDF → Markdown (opendataloader-bench, 200 documents)

200 PDFs (papers, reports, slides, scans) scored against human-made ground truth for reading order, table structure and heading hierarchy (1.0 = identical).

| Rank | Engine | Overall | Reading order | Tables | Headings | Time / page |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| **1** | **kordoc default** | **0.960** | **0.961** | **0.979** | **0.945** | **0.52 s** |
| ref. | kordoc `ocr: false` (fastest) | 0.937 | 0.938 | 0.936 | 0.933 | 0.04 s |
| ref. | kordoc `ocr: true, plain: true, htmlTables: true` | 0.973 | 0.977 | 0.983 | 0.959 | 0.58 s |
| 2 | opendataloader-hybrid | 0.907 | 0.934 | 0.928 | 0.821 | 0.46 s |
| 3 | nutrient (commercial) | 0.885 | 0.925 | 0.708 | 0.819 | 0.01 s |
| 4 | docling | 0.882 | 0.898 | 0.887 | 0.824 | 0.76 s |
| 5 | marker | 0.861 | 0.890 | 0.808 | 0.796 | 53.9 s |
| 6 | unstructured-hires | 0.841 | 0.904 | 0.588 | 0.749 | 3.01 s |
| 7 | edgeparse | 0.837 | 0.894 | 0.717 | 0.706 | 0.04 s |
| 8 | mineru | 0.831 | 0.857 | 0.873 | 0.743 | 5.96 s |
| 9 | opendataloader | 0.831 | 0.902 | 0.489 | 0.739 | 0.02 s |
| 10 | pymupdf4llm | 0.732 | 0.885 | 0.401 | 0.412 | 0.09 s |
| 11 | unstructured | 0.686 | 0.882 | 0.000 | 0.388 | 0.08 s |
| 12 | markitdown | 0.589 | 0.844 | 0.273 | 0.000 | 0.11 s |
| 13 | liteparse | 0.576 | 0.866 | 0.000 | 0.000 | 1.06 s |

- The default alone is first on all four columns — no GPU, cloud API or LLM, just Node.js. `ocr: false` is also first on all four.
- When the OCR model is cached, the default reads scanned pages and text inside large images. Image-heavy documents get slower; use `ocr: false` when speed matters.

### Korean government documents — scored against the original HWPX

Real government documents (press releases, approval documents, statutory forms, budgets) that exist both as HWPX and as a PDF export. The table ground truth is the **visible** table, i.e. what the cell borders draw (v4.17.0 scoring).

| Area | Size | Result |
| --- | --- | --- |
| HWPX text & tables | 2,286 documents, 9,865 visible tables | 0 missing text · 99.6% of tables match cell for cell · reading order 100% |
| HWP 5.x | 1,120 HWP/HWPX pairs | identical to the HWPX result |
| PDF text | 744 pairs | char recall 99.8% · precision 99.6% · reading order 99.1% · word F1 98.8% |
| PDF tables | 708 pairs, 2,331 visible tables | found 99.7% · exact cell match 97.3% · cell F1 0.989 |
| Statute annexes (HWP · Hancom PDF) | 272 annexes, 346 visible tables | HWP all tables match · PDF 96.8% · cell-built fractions 11/11 (HWP) |
| PDF overall | 1,911 documents | text coverage 99.8% |
| Scanned OCR (local CPU) | 53 documents, 102 pages | char recall 99.0% · precision 99.4% · about 1 s/page |
| DOCX · XLSX · XLS · HML | 88 documents | 0 missing text or numbers |
| Markdown → HWPX → Markdown | 83 runs | no loss of text, tables, headings or equations |

### HWP · HWPX → Markdown — against HwpForge

The same corpus scored against the original HWPX XML with the same scorer (single-column tables excluded). Measured at v4.16 against the previous ground truth (HWPX table structure as is).

| | kordoc | HwpForge 0.16.6 |
| --- | ---: | ---: |
| HWPX, 2,305 docs — conversion failures | **0** | 123 |
| HWPX — text recall (converted docs only) | **100.00%** (100.00%) | 59.23% (98.64%) |
| HWPX — exact tables (9,123) | **100.0%** (9,122) | 32.2% |
| HWPX — cell F1 | **1.000** | 0.428 |
| HWP 5.x, 1,108 docs — conversion failures | **0** | 19 |
| HWP — text recall | **100.00%** | 86.41% |
| HWP — exact tables (3,111) | **100%** | 27.0% |
| HWP — cell F1 | **1.000** | 0.349 |

Most of the table gap comes from HwpForge's pipe tables, which cannot express merged cells.

---

## 🚀 Quick Start

### Parse a document

```typescript
import { parse } from "kordoc"
import { readFileSync } from "fs"

const result = await parse(readFileSync("business-plan.hwpx"))   // a file path string works too

if (result.success) {
  result.markdown   // markdown
  result.blocks     // IRBlock[] structured data
  result.metadata   // { title, author, createdAt, pageMode, ... }
  result.pages      // [{ pageNumber, markdown }] per-page body
}
```

- `pages` appears only for formats whose blocks carry page numbers (HWP · HWPX · PDF; XLS(X): one sheet = one page). DOCX, which has no page numbering, omits the field.
- Page-boundary reliability is `metadata.pageMode` — `"layout"` (real pages from the typesetting cache) / `"section"` (section approximation).

**Parse options** (`parse(buffer, options)` · CLI flag)

| Option | CLI | Description |
| --- | --- | --- |
| `pages` | `-p, --pages` | `"1-3"` · `"1,3,5-7"` · `[1, 5, 10]` — real pages for PDF and Hancom-saved files, section approximation without a typesetting cache |
| `ocr` | `--ocr` · `--ocr-force` | default: scanned pages + text in large images (when the model is cached) · `true`: + small images and logos (~18MB model auto-download) · `"force"`: every page · `false`: off · function: external OCR |
| `formulaOcr` | `--formula-ocr` | PDF formula OCR (MFD+MFR, ~155MB models) — detected formulas as `$…$` / `$$…$$` |
| `scriptTags` | `--script-tags` · `--no-script-tags` | superscripts/subscripts as `<sup>`/`<sub>` (so "10⁴ m²" does not flatten to "104 m2"). Default: on for HWPX · HWP · DOCX, off for PDF (`true` recommended for papers and math) |
| `images` | `--no-images` | `false` skips image bytes (placeholders remain; PDF skips PNG encoding) |
| `plain` | `--plain` | text-first Markdown without image placeholders, link URLs, underline or bold (headings, lists and table structure kept; `blocks` unchanged). `<sup>`/`<sub>` become `10^4`/`H_2O` |
| `htmlTables` | `--html-tables` | every table as HTML, one tag per indented line (first row `<th>`) |
| `password` | `--password` | open password (HWPX · HWP3 · HWP5; not Hancom DRM) |
| `tables` | `--no-tables` | `false` turns off PDF table detection (two-column exam sheets whose boxes read as tables and flip the order) |
| `removeHeaderFooter` | `--no-header-footer` | remove PDF running headers/footers (default on, 3+ pages) |
| `layoutTables` | `--keep-layout-tables` | invisible-border layout tables. Default `"visual"`: as they look (frames become text, only ruled parts stay tables, cell-built fractions become equations). `"keep"`: original table structure (use it for markdown you will `patch` back) |
| `keepTrailingEmptyCols` | `--keep-empty-cols` | keep empty trailing table columns (form input columns) |
| `keepEmptyParagraphs` | `--keep-empty-paragraphs` | keep empty paragraphs — source paragraph count = line count (HWPX) |
| `includeFieldPlaceholders` | `--include-field-placeholders` | also emit unfilled click-here field guide text (HWPX · HWP5) |
| `dedupeRunningHeaders` | `--dedupe-headers` | drop running headers repeated per page in HWP5 layout tables (opt-in: may also drop per-attachment renumbering) |
| `inlineImages` | `--inline-images` | inline images as base64 data URIs (BMP→PNG, HWP5) |
| `classifyTables` | — | classify tables as data / layout / uncertain into `IRTable.classification` |
| `onProgress` | — | progress callback `(current, total)` |

### Compare documents (redline)

```typescript
import { compare } from "kordoc"

const diff = await compare(oldBuffer, newBuffer)   // cross-format HWP ↔ HWPX works
// diff.stats → { added: 3, removed: 1, modified: 5, unchanged: 42 }
// diff.diffs → BlockDiff[] (tables include cell-level diffs)
```

### Extract and fill form fields

```typescript
import { parse, extractFormFields, fillForm } from "kordoc"
import { readFileSync, writeFileSync } from "fs"

const r = await parse(buffer)
if (r.success) {
  const form = extractFormFields(r.blocks)
  // form.fields → [{ label: "성명", value: "홍길동", row: 0, col: 0 }, ...], form.confidence → 0.85
}

// HWPX format-preserving mode — fonts, sizes, alignment intact
const filled = await fillForm(readFileSync("application.hwpx"), {
  성명: "홍길동", 주민등록번호: "900101-1234567", 주소: "서울특별시 광진구 능동로 120",
}, "hwpx-preserve")
writeFileSync("application_filled.hwpx", Buffer.from(filled.output as ArrayBuffer))
// filled.fill.filled → filled fields, filled.fill.unmatched → keys that failed to match
```

### Built-in standard draft templates + click-here fields

Standard draft-document forms (annexed to the 「Enforcement Rules of the Regulation on Administrative Efficiency and Collaboration」) ship with the package, so you can produce an official document by name alone. Form source: [rhwp](https://github.com/edwardkim/rhwp) (MIT).

| Name | Form | Use | Click-here fields |
|------|------|-----|-------------------|
| `gian` (general draft) | Annex Form No. 1 | outgoing / cooperation documents | 23 — agency name, recipient, via, title, body, attachments, sender, drafter, reviewer, approver, enforcement number, … |
| `gian-simple` (simple draft) | Annex Form No. 2 | internal approval reports/plans (approval table) | 13 — registration number, approval titles 1–4, title, summary, date, … |

```bash
npx kordoc fill --list-templates                                # built-in templates + fields
npx kordoc fill --template gian -j values.json -o draft.hwpx
npx kordoc fill templates:간이기안문 -f '제목=…' -o report.hwpx   # positional form works too
```

- Click-here fields are matched by name first, then remaining keys by label — works on any HWPX form with click-here fields.
- Multi-line values become in-paragraph line breaks; the original formatting is kept.
- API: `extractClickHereFields` → `fillHwpx(buf, values)`. The MCP `fill_form` tool takes the same templates via `template`.

### Generate HWPX (Markdown → HWPX)

```typescript
import { markdownToHwpx } from "kordoc"

const hwpx = await markdownToHwpx("# Title\n\nBody\n\n| Name | Rank |\n| --- | --- |\n| 홍길동 | 과장 |")

// display math → native HWPX equations (<hp:equation>) — LaTeX-like subset: \frac, \sqrt, scripts, Greek, integrals/limits, arrows, relations, matrices
await markdownToHwpx("Pythagoras\n\n$$a^2 + b^2 = c^2$$")

// official-document mode — 8-level item numbering + hanging indent + official margins / serif fonts
// preset: official | report | plan | notice | minutes | gaejosik | press | ministry (work report) | bangchim (Seoul policy plan)
await markdownToHwpx("1. 추진배경\n  - 세부 항목\n2. 추진계획", { gongmun: { preset: "보고서" } })

// government-standard gaejosik report — cover, TOC (banner), Roman-numeral chapter headers, body title box, page numbers ("- 1 -", not on cover/TOC)
await markdownToHwpx(md, {
  gongmun: {
    preset: "개조식",
    cover: { org: "Agency", date: "2026. 7. 11." },
    toc: true,                          // h2 list → Ⅰ Ⅱ Ⅲ TOC (on by default for gaejosik)
    approval: ["담당", "팀장", "과장"],   // approval box (optional)
    pageNumbers: true,                  // page numbers (on by default for gaejosik/report/plan)
    endMark: false,                     // "끝." at the end (on by default for drafts)
  },
})
```

- Tables follow government conventions automatically (shaded header, double bottom rule, content-proportional widths). Themes and a reference document's table format (`hwpxToProfile`) are accepted too.
- CLI: `kordoc generate report.md -o report.hwpx --preset 개조식 --org Agency --approval 담당,팀장,과장`

### Layout-preserving render

Draws documents exactly as laid out, from the typesetting cache Hancom stores in HWPX (no Hancom on the server). Files without a cache (generated files) are typeset by the built-in reflow engine. Equation objects are not rendered yet.

```typescript
import { renderHwpxToSvg, renderDocument, extractRenderedRegions } from "kordoc"

const r = await renderHwpxToSvg(readFileSync("approval.hwpx"), { highlights: ["예산"] })
// r.svg, r.width/r.height (pt), r.pageCount, r.stats { texts, images, tables }, r.warnings
const g = await renderHwpxToSvg(generatedHwpx, { reflow: true })   // cache-less files

// unified renderer — HWPX and HWP (5.x), per-page PNG + table crops
const { scene, assets } = await renderDocument("approval.hwp", { format: "png", pages: "1-2" })
const crops = await extractRenderedRegions("approval.hwp", { types: ["table"] })
```

CLI: `kordoc render approval.hwpx -o approval.svg` (`--highlight 예산`, `--no-reflow`). For preview apps, `kordoc render-worker` stays resident.

### Bulk conversion — persistent parse worker

```typescript
await parse(buffer, { images: false })                   // no image bytes
await parse(buffer, { plain: true, htmlTables: true })   // text-first + every table as HTML
```

`kordoc parse-worker` stays running and answers one line per stdin JSON line (no new node process per file).

```text
ready     {"ready":true,"version":"4.16.0","protocol":1}
request   {"id":1,"file":"doc.hwpx","images":false,"ocr":"off"}
response  {"id":1,"rss":183500800,"result":{ …same as --format json, failures as success:false… }}
quit      {"cmd":"quit"}  (or close stdin)
```

Requests accept `ocr` (`"off"` · `"auto"` · `"force"`), `formulaOcr` and `password`; use the response's `rss` (memory) to decide when to recycle the worker.

### OCR (scanned / image-based PDFs)

```typescript
await parse(buffer, { ocr: true })      // pages that need OCR + text in images (PP-OCRv5 korean, ~18MB model on first use)
await parse(buffer, { ocr: "force" })   // force every page
await parse(buffer, {                   // external OCR (Claude Vision, Tesseract, …)
  ocr: async (pageImage, pageNumber, mimeType) => myOcrService.recognize(pageImage),
})
```

- Runs on local CPU with no API key (PP-OCRv5 korean ONNX — all 11,172 precomposed Hangul syllables).
- Only pages without a text layer or with a broken one are OCR'd, and table structure is recovered from scans.
- Model management: `kordoc models --status` (`--export`/`--import` for air-gapped networks).

### PDF text-quality signals

`parsePdf` returns per-page quality signals — use them to send pages with a broken text layer to OCR.

```typescript
const r = await parsePdf(buffer)
if (r.success && r.qualitySummary?.needsOcr) await parse(buffer, { ocr: true })   // or route to your OCR queue
for (const p of r.pageQuality ?? []) if (p.needsOcr) console.log(`p${p.page} needs review: ${p.ocrReason}`)
```

Signals: `textChars` · `hangulRatio` · `controlCharRatio` · `replacementCharRatio` · `puaRatio`, `needsOcr`, `ocrReason` (`low_text` · `high_pua` · `high_control` · `high_replacement` · `garbled_hangul` · `vector_text`).

---

## 💻 CLI

[Parallel batch benchmarks and limits](docs/parallel-batch.md)

`--jobs N` runs whole-file conversions in parallel using N reusable processes (default: 1). With `--jobs > 1`, multiple inputs require `-d` and distinct filename stems, including across extensions. Per-file failures do not stop other files, and any failure sets a nonzero exit status. Completion messages and failure JSON arrive in completion order. More workers use more memory; tiny files may be slower, and OCR already uses native CPU threads. This does not parallelize pages within one document or change the JavaScript/MCP APIs.

```bash
# convert
npx kordoc business-plan.hwpx                       # print to terminal
npx kordoc report.hwp -o report.md                  # save to file (images in images/report/)
npx kordoc *.pdf -d ./converted/                    # batch conversion
npx kordoc *.pdf --jobs 4 -d ./converted/           # parallel batch (4 reusable processes)
npx kordoc review.hwpx --format json                # JSON (blocks + pages + metadata)
npx kordoc review.pdf --format chunks               # RAG structure chunks (breadcrumbs + standalone tables)
npx kordoc report.hwpx --pages 1-3                  # page range
npx kordoc scan.pdf --ocr                           # built-in OCR (--ocr-force for every page)
npx kordoc locked.hwpx --password 'secret'          # password-protected HWPX/HWP3/HWP5
npx kordoc exam.pdf --no-tables                     # turn off PDF table detection
npx kordoc doc.pdf --format json --no-images        # no images (also --plain, --html-tables)

# fill forms
npx kordoc fill form.hwpx -f '성명=홍길동,주소=서울' -o filled.hwpx
npx kordoc fill form.hwpx -j values.json -o filled.hwpx
npx kordoc fill form.hwpx --dry-run                                 # list fields only (incl. click-here)
npx kordoc fill form.hwpx -j values.json --formats '{"날짜":"yy.mm.dd"}' # per-field value format
npx kordoc fill form.hwpx -j values.json --require-unique           # refuse if one key matches 2+ spots
npx kordoc fill form.hwpx -j values.json --mask                     # don't echo filled values to stdout
npx kordoc fill --template gian -j values.json -o draft.hwpx        # built-in draft template (--list-templates)

# generate · edit · verify
npx kordoc generate report.md -o report.hwpx --preset 보고서         # Markdown → official HWPX
npx kordoc patch original.hwpx edited.md -o patched.hwpx            # format-preserving patch (.hwp auto)
npx kordoc seal form.hwpx --image stamp.png --anchor "(인)" -o sealed.hwpx
npx kordoc validate output.hwpx                                     # HWPX structure validation (ZIP, required parts, XML)
npx kordoc lint report.md                                           # 19-rule notation linter (md/txt, '-' = stdin, exit 1 on errors)
npx kordoc profile agency-form.hwpx                                 # table format profile JSON → generate --profile

# PII masking
npx kordoc redact complaint.hwpx -o redacted.hwpx                   # format-preserving masking + re-scan (exit 2 if anything remains)
npx kordoc redact complaint.hwpx --mask-char '*' -o redacted.hwpx   # mask character (default ●)
npx kordoc redact contract.hwp --rules rrn,phone,crn --json --dry-run  # pick rules + per-location report only (crn, IP are opt-in)
npx kordoc redact complaint.hwpx --rules rrn,phone,email,name,address -o redacted.hwpx  # names and addresses too (opt-in)
npx kordoc redact notice.pdf                                        # PDF/DOCX/etc.: masked .redacted.md only

# render
npx kordoc render approval.hwpx -o preview.svg                      # layout-preserving SVG (reflow when cache-less)
npx kordoc render approval.hwpx --format png --pages 2-4 -d ./pages # also PNG, JPEG, HTML, PDF
npx kordoc render approval.hwpx --reflow-mode charAll -o preview.svg # reflow line breaking: keep (word, default) | charAll (character)

# models · watch
npx kordoc models --status                          # OCR model status (--export/--import for air-gapped sideloading)
npx kordoc check-ocr-models --status-only           # status only as JSON (without the flag, missing models are downloaded)
npx kordoc check-formula-models --status-only       # formula OCR models (MFD+MFR+tokenizer, ~155MB) status only
npx kordoc watch ./inbox -d ./converted             # folder watch (keeps subfolders)
npx kordoc watch ./docs --webhook https://api/hook  # webhook notification
```

- `watch -d` keeps the subfolder structure.
- `check-ocr-models` and `check-formula-models` download missing models — pass `--status-only` to inspect only.
- `lint` checks Markdown/text. For HWPX: `kordoc doc.hwpx | kordoc lint -`.

### Failure contract — machine-readable failure JSON

Conversion failures emit the JSON below to stdout in every `--format` and exit 1 — branch on `code`.

```json
{ "success": false, "fileType": "hwpx", "file": "report.hwpx", "error": "…", "code": "ENCRYPTED" }
```

- A failure is always a `success:false` object, so it never collides with success output (text or arrays). With multiple inputs each failure emits one line.
- Exit codes and fields are stable; `code` values are only ever added. The `error` string is for humans, not part of the contract.

| `code` | Meaning |
|---|---|
| `ENCRYPTED` | open password required (`--password`) or wrong |
| `DRM_PROTECTED` | Hancom document security (DRM) — cannot be opened |
| `UNSUPPORTED_FORMAT` | unsupported format |
| `CORRUPTED` | signature mismatch or unrecoverable damage |
| `IMAGE_BASED_PDF` | scanned PDF without a text layer (needs `--ocr`) |
| `ZIP_BOMB` / `DECOMPRESSION_BOMB` | decompression-bomb guard triggered |
| `NO_SECTIONS` | no body sections |
| `OUTPUT_TOO_LARGE` | output serialization exceeds the runtime string limit |
| `MISSING_DEPENDENCY` | optional dependency not installed (pdfjs-dist, …) |
| `EMPTY_INPUT` | empty input |
| `FILE_NOT_FOUND` | input path does not exist (ENOENT) |
| `PARSE_ERROR` | any other parse failure |

### Image bundles — `images/<document name>/manifest.json`

With `-o`/`-d`, images go to a per-document folder `images/<document name>/` with a `manifest.json` (converting several documents into one folder never overwrites images). `--format json --image-refs` keeps only paths instead of bytes.

```json
[ { "name": "image_001.png", "mimeType": "image/png", "bytes": 68, "source": "BinData/image1.png" } ]
```

- `mimeType` is detected from the file header (magic bytes); `source` is the path inside the original container.
- Images are stored as-is (only PDF images are re-encoded to PNG) — trust `mimeType` over the extension.

---

## 🤖 MCP Server

Automatic setup: [`npx -y kordoc setup`](#ai-agent-integration-mcp--30-seconds). Manual registration:

```bash
codex mcp add kordoc -- npx -y kordoc mcp          # Codex
```

```json
{ "mcpServers": { "kordoc": { "command": "npx", "args": ["-y", "kordoc", "mcp"] } } }
```

On Windows, if Claude Desktop can't find `.cmd`, use `"command": "cmd", "args": ["/c", "npx", "-y", "kordoc", "mcp"]`.

**17 tools**

| Tool | Description |
|------|-------------|
| `parse_document` | HWP/HWPX/PDF/XLSX/DOCX → Markdown (with metadata) |
| `detect_format` | format detection via magic bytes |
| `parse_metadata` | fast metadata only |
| `parse_pages` | a page range only |
| `parse_table` | the Nth table only |
| `parse_chunks` | RAG structure chunks — heading/outline breadcrumbs + standalone table chunks |
| `compare_documents` | compare two documents (cross-format) |
| `parse_form` | form fields as JSON |
| `fill_form` | fill a form (HWPX format-preserving, format/uniqueness guards, built-in `template`) |
| `patch_document` | apply edited Markdown back into the original HWPX/HWP, format preserved |
| `extract_profile` | table format profile JSON from a reference HWPX — reuse via `generate_document`'s `profile_path` |
| `generate_document` | Markdown (tables/equations/charts) → HWPX, official-document presets |
| `place_seal` | float a stamp/signature image over an anchor phrase |
| `render_document` | render HWPX/HWP as typeset to PNG/JPEG (inline) or SVG/HTML/PDF files — lets the AI visually check generated/edited output |
| `redact_document` | PII detection + format-preserving masking (HWPX/HWP incl. headers, footnotes, previews and document info, with a re-scan; other formats: masked Markdown) |
| `crop_regions` | crop rendered regions (tables/images/paragraphs/shapes) from page images at true scale + regions.json |
| `extract_tables` | table classification (data / org-chart-like / uncertain) + page·bbox + policy-based crops — org charts as images, data tables as structure |

---

## 📚 API

### Parsing

| Function | Description |
|----------|-------------|
| `parse(buffer, options?)` | auto format detection → Markdown + `IRBlock[]` (a file path string works too) |
| `parseHwpx` · `parseHwp` · `parseHwp3` · `parseHwpml` | HWPX · HWP 5.x · HWP 3.x (1996–2002) · HWPML only — all `(buffer, options?)` |
| `parsePdf` · `parseDocx` · `parseXlsx` · `parseXls` | PDF · DOCX · XLSX · XLS (Excel 97–2003, BIFF8) only |
| `parseImage(buffer, options?)` | images (PNG/JPG/WebP) only — built-in OCR always on |
| `detectFormat(buffer)` | synchronous magic-byte detection — returns `hwpx` for ZIP and `hwp` for OLE2 for backward compatibility |
| `await detectZipFormat(buffer)` | ZIP entries → `hwpx` · `xlsx` · `docx` · `pptx` · `unknown` |
| `detectOle2Format(buffer)` | OLE2 streams → `hwp` · `xls` · `unknown` |

PPTX is parsed by `parse()`. To tell ZIP formats apart, call `await detectZipFormat(buffer)` when `detectFormat()` returns `hwpx`.

### Compare · forms · editing

| Function | Description |
|----------|-------------|
| `compare(bufferA, bufferB, options?)` | IR-level document comparison |
| `extractFormFields(blocks)` / `extractFormSchema(blocks)` | form field recognition / + type, required, empty inference |
| `fillForm(input, values, outputFormat?)` | fill a form — `"markdown"` (default) · `"hwpx"` · `"hwpx-preserve"`, returns `{ output, format, fill }` |
| `fillFormFields(blocks, values)` | replace field values on IRBlock[] |
| `fillHwpx(buffer, values)` | direct HWPX XML manipulation (format-preserving) |
| `extractClickHereFields(buffer)` | inspect HWPX click-here (CLICK_HERE) fields — names and guide text |
| `resolveBuiltinTemplate(name)` / `readBuiltinTemplate(t)` | look up / load built-in draft templates (`gian` · `gian-simple`) |
| `patchHwpx(original, editedMarkdown, options?)` | edited Markdown → format-preserving HWPX patch |
| `patchHwp(original, editedMarkdown, options?)` | edited Markdown → format-preserving HWP 5.x binary patch |
| `openHwpxDocument(bytes, options?)` | `HwpxSession` incremental block-patch session for editors |
| `patchHwpxBlocks(bytes, edits, options?)` | one-shot block edits without a session |
| `placeSealHwpx(buffer, seals)` | float stamp/signature images over anchor phrases |
| `validateHwpx(buffer)` | HWPX structure validation — ZIP, mimetype, required parts, XML well-formedness |

### Generate · render

| Function | Description |
|----------|-------------|
| `markdownToHwpx(markdown, options?)` | Markdown → HWPX (theme, format profile, page options, official-document presets) |
| `hwpxToProfile(buffer)` | reference HWPX → table format profile JSON (reuse via `markdownToHwpx(md, { profile })`) |
| `markdownToPdf(markdown, options?)` / `blocksToPdf(blocks, options?)` | Markdown / IRBlock[] → PDF (install `puppeteer-core` separately) |
| `renderHtml(blocks, options?)` | IRBlock[] → print-ready HTML (no puppeteer; raw HTML passes only allowed tags, plus CSP) |
| `renderHwpxToSvg(buffer, options?)` | HWPX → layout-preserving SVG — multi-page, highlights, shapes; `reflow` when cache-less |
| `renderDocument(input, { format, pages?, … })` | HWPX / HWP (5.x) → per-page svg/png/jpeg or document html/pdf assets + `RenderScene` (page-local pt bboxes, deterministic region ids) |
| `extractRenderedRegions(input, { types?, pages?, … })` | crop table/image/paragraph/shape regions from page images at true scale |
| `extractTables(input, { policy?, … })` | table classification (data / org-chart-like / uncertain) + render-region join + policy-based crops |

### Text · conversion helpers

| Function | Description |
|----------|-------------|
| `lintGongmunText(text, { document? })` | 19 official-notation rules + 2 AI-slop rules (`document: true` adds document-level attachment / "끝." checks) |
| `redactMarkdown(text, options?)` / `redactText(...)` | PII detection + masking — text level (file level: CLI `redact`, MCP `redact_document`) |
| `blocksToChunks(blocks, options?)` | RAG structure chunks — heading/outline breadcrumbs + standalone table chunks |
| `blocksToMarkdown(blocks)` | IRBlock[] → Markdown |
| `blocksToPages(blocks)` | IRBlock[] → `[{ pageNumber, markdown }]` |

### Types

```typescript
import type {
  ParseResult, ParseSuccess, ParseFailure, FileType,
  IRBlock, IRBlockType, IRTable, IRCell, CellContext,
  DocumentMetadata, ParseOptions, ErrorCode, OutlineItem,
  DiffResult, BlockDiff, CellDiff, DiffChangeType,
  FormField, FormResult, FormFieldType, FormFieldSchema, FormSchemaResult,
  FillResult, HwpxFillResult, FillOutputFormat, FillFormOutput,
  ClickHereField, BuiltinTemplate,
  PatchOptions, PatchResult, PatchSkip,
  HwpxTheme, MarkdownToHwpxOptions, PageOptions,
  PrintPreset, PrintOptions, PageMargin,
  RenderSvgOptions, RenderSvgResult,
  SealOp, SealPlacement, PlaceSealResult,
  ValidateResult, ValidateIssue,
  RedactRule, RedactOptions, RedactHit, RedactTextResult,
  DocChunk, ChunkOptions, GongmunLintFinding,
  OcrProvider, WatchOptions,
} from "kordoc"
```

---

## 📂 Supported Formats

| Format | Engine | Highlights |
|--------|--------|-----------|
| **HWPX** (Hancom 2020+) | ZIP + XML DOM | manifest, nested tables, merged cells, corrupted-ZIP recovery, real page boundaries from the typesetting cache, open passwords, form check boxes and radio buttons |
| **HWP 5.x** (Hancom legacy) | OLE2 + CFB | distribution-copy decryption, open passwords, corrupted-CFB recovery, footnotes/hyperlinks, 21 control chars, image extraction, real page boundaries |
| **HWP 3.x** (1996–2002) | single binary | Johab → Unicode, 5,893 Hanja/symbol lookup, nested paragraphs, arae-a (archaic Hangul), open passwords |
| **HWPML 2.x** (XML-based HWP) | XML DOM | HeadingType-based headings, merged cells, DoS guards |
| **PDF** | pdfjs-dist | ruled, clip-based and borderless tables, XY-Cut reading order, two-column pages, headings, footnotes/endnotes, math-font recovery, OCR, underline/links, image extraction, text-quality signals |
| **XLSX** (Excel) | ZIP + XML DOM | shared strings, merged cells, multiple sheets, formula display, date cells to ISO, large-sheet streaming |
| **XLS** (Excel 97–2003) | OLE2 + BIFF8 | Workbook stream, SST shared strings, cell/sheet extraction |
| **DOCX** (Word) | ZIP + XML DOM | style-based headings, numbering (real number labels), footnotes, hyperlinks, image extraction |
| **Images** (PNG/JPG/WebP) | sharp + built-in OCR | screenshots and scans as direct input, tables recovered from raster rules |

---

## 🔒 Security

- Guards against ZIP and decompression bombs, XXE, path traversal and SSRF — details in [SECURITY.md](./SECURITY.md).
- **Air-gapped networks**: `KORDOC_OFFLINE=1` blocks all outbound traffic, and `KORDOC_ROOT=<dir>` confines MCP file access to that directory. Offline install bundles and moving models: [docs/offline-deployment.md](docs/offline-deployment.md).

---

## 📝 Recent Changes

### v4.17.1
- DOCX scientific supplements: inline equations stay in place (#104) · Symbol-font characters °·×·μ (#105) · `\langle` spacing and equation numbers as `\tag` (#106) · text inside `w:dir`/`w:bdo` (#107) · `images: false` leaves media parts out of the 100 MB unzip limit (#108)

### v4.17.0
- Reads Korean documents **as they look**: invisible-border layout frames become text, only ruled parts stay tables, fractions built from two cells and a rule become `$\frac{…}{…}$` (`layoutTables`, default visual; `--keep-layout-tables` keeps the old structure). Statute annexes, 346 visible tables matched: HWP 72 → 346, PDF 66 → 335
- PDF cross-page tables: split rows, unjoined fragments, tables with pictures, very large grids (151×76)
- Text after dotted (leader) tabs is no longer cut off (HWPX · HWP5 · HWP3, HWPML tabs)
- Markdown for `kordoc patch` must come from `--keep-layout-tables` (visual-mode edits are rejected with instructions)

Full history in the [CHANGELOG](CHANGELOG.md).

---

## About the Author

A local civil servant in Korea. Built this after seven years of wrestling HWP files at the Gwangjin-gu District Office in Seoul. Validated on thousands of real government documents across five public-sector projects.

## License

[MIT](./LICENSE). This project includes the following open-source software:

- **rhwp** (MIT, edwardkim) — HWP5 distribution-copy decryption and lenient CFB parsing algorithms, the draft templates in `templates/`
- **claw-hwp** (MIT, DoHyun468) — OOXML chartSpace assembly, floating stamp placement metrics, secure-fill format engine, validate check set
- **OpenDataLoader PDF** (Apache 2.0, Hancom Inc.) — PDF table detection algorithm
- **hml-equation-parser** (Apache 2.0, Open Bapul) — HML equation parsing
- **PaddleOCR** (Apache 2.0, PaddlePaddle) — derived text OCR engine (PP-OCRv5 korean)
- **Pix2Text** (MIT, breezedeus) — formula OCR (MFD/MFR) algorithm port. Models are downloaded at runtime and not redistributed — the MFD weights are based on Ultralytics YOLOv8 (AGPL-3.0), so commercial or closed products relying on formula OCR should check those terms separately
- **cfb** (Apache 2.0, SheetJS) — HWP5 OLE2 container parsing
- **pdfjs-dist** (Apache 2.0, Mozilla) — PDF text extraction
- **JSZip** (MIT, Stuart Knightley et al.) — ZIP-based format parsing

Full notices are in [NOTICE](./NOTICE) and license texts in `THIRD_PARTY/` — both ship in the npm package.
