# Benchmark details

Scoring rules, reproduction steps and per-option numbers behind the README [Performance](../README-EN.md#-performance) section. Every number is reproduced by `npm run bench:gate`, which every `npm publish` must pass.

## PDF → Markdown — opendataloader-bench

[opendataloader-bench](https://github.com/opendataloader-project/opendataloader-bench) scores 200 PDFs (papers, reports, slides, posters, scans) against human-made ground truth for **reading order (NID), table structure (TEDS) and heading hierarchy (MHS)** (1.0 = identical to the ground truth).

### kordoc by option

| Setting | Overall | Reading order | Tables | Headings | Time / page |
| --- | ---: | ---: | ---: | ---: | ---: |
| default (OCR model cached) | 0.960 | 0.961 | 0.979 | 0.945 | 0.52 s |
| default + `plain: true` | 0.968 | 0.969 | 0.981 | 0.952 | 0.52 s |
| default + `plain: true, htmlTables: true` | 0.972 | 0.976 | 0.983 | 0.955 | 0.52 s |
| `ocr: false` (= default without the OCR model) | 0.937 | 0.938 | 0.936 | 0.933 | 0.04 s |
| `ocr: false, plain: true` | 0.946 | 0.948 | 0.937 | 0.940 | 0.04 s |
| `ocr: false, plain: true, htmlTables: true` | 0.949 | 0.954 | 0.940 | 0.943 | 0.04 s |
| `ocr: true` | 0.960 | 0.960 | 0.979 | 0.949 | 0.57 s |
| `ocr: true, plain: true` | 0.967 | 0.968 | 0.981 | 0.956 | 0.57 s |
| `ocr: true, plain: true, htmlTables: true` | 0.973 | 0.977 | 0.983 | 0.959 | 0.58 s |

Time per page: 200 documents parsed sequentially in one process on an Apple M4 24GB, 2026-09-29 (scoring excluded).

### What the options do

- **Default OCR** — when the OCR model is already cached (`kordoc models`, or an earlier `ocr: true`), **pages without a text layer (scans, glyphs drawn as curves)** and **text inside large images (over 5% of the page) that have no text layer** are read automatically (72 of 200 documents). Without a cached model nothing is downloaded; `NEEDS_OCR` / `SKIPPED_IMAGE` warnings are raised.
- **`ocr: true`** — also reads small images (over 2% of the page) and page-header logos. **`ocr: false`** turns the automatic OCR off too (fastest).
- **`plain: true`** — drops image placeholders, link URLs and underline/bold marks for indexing and RAG. The ground truth has none of these, so the score rises too.
- **`htmlTables: true`** — emits every table as indented HTML.

### Reproduction

- Other engines' scores are the benchmark repository's published results (Apple M4 32GB).
- kordoc used the same PDFs, ground truth and the **unmodified evaluator** (Apple M4 24GB, 200 documents sequentially in one process).
- Re-scoring the repository's opendataloader-hybrid predictions with the same evaluator gives 0.9066, matching its published score.
- Run: `node bench/odl-bench.mjs <bench clone>`, then the benchmark's `src/evaluator.py`.

### LM-Kit One (unmerged PR #34)

LM-Kit One (commercial; results-only PR) reports 0.948 without OCR and 0.963 with OCR. Most of the gap is table markup — it writes cells in the ground truth's HTML shape (`<td> text </td>`, header rows as `<td>`). Normalised to the same markup, kordoc `plain` scores 0.951 vs LM-Kit 0.948; with `htmlTables` kordoc leads both rows: 0.949 without OCR, 0.973 with OCR.

## Korean government documents — scored against the original HWPX

Real government documents (press releases, approval documents, statutory forms, budgets) for which both the HWPX original and its PDF export exist; text and tables extracted from the PDF are scored with the original as ground truth.

### Scoring rules (revised 2026-09-29, visible tables 2026-09-30, history in the [CHANGELOG](../CHANGELOG.md))

**Table ground truth = the tables you see in the original** (v4.17.0)
- Tables are split the way their cell borders draw them (header.xml borderFill; line type NONE and white lines are invisible). `bench/ref/visible-tables.mjs`, no code shared with the parser.
- A row with a visible vertical edge, or with two or more cells between full-width horizontal rules, is a table row; each run of table rows is one visible table. Other rows are text (still counted in text recall).
- Gridlines no cell edge uses, empty indent cells outside the ruled extent, blank spacer rows without lines, and trailing empty columns are folded.
- A fraction built from two cells and a rule is an equation (removed from the text population, counted once in equation presence). Two full-width cells count as a fraction only in a 2×1 table.
- Image check against Hancom PDFs of statute annexes (66 original pages, 50 visible tables): 42/50 matched, 48/50 after the spacer-row (A1) and fraction false-positive (P1) fixes. The remaining two are a continued row and a formula inside a bordered box, one case each, so no rule was added.

**Statute annexes** (`bench/annex-gt.mjs`)
- The HWP original and the Hancom PDF of 272 statute annexes from the Ministry of Government Legislation (licbyl-byl, licbyl-byl2), scored against the same ground truth. PDFs are parsed with `ocr: false` (same as the Korean Law MCP and lexdiff servers).

**PDF text**
- Reading order: a line that appears several times counts at its in-order occurrence.
- Floating text boxes and lines without letters or digits (masking "*****") are excluded from order scoring only.
- List markers "- " and the footnote wrapper "(주: …)" are stripped from both plain texts.

**PDF text/table population**
- Pairs whose PDF is a different edition (PDF text over 3×) are excluded.
- Pairs whose PDF text layer (pdftotext) holds less than 93% of the ground-truth characters (render-defect repros etc.) are excluded.
- PDF coverage removes leader-dot runs.

**OCR**
- Sample pages are fixed (`bench/ocr-pages.json`).
- OCR text inside image regions with no text-layer text is left out of the character comparison (for logos mixed into a body block, only the surplus explained by reading the image alone).
- Text-layer text that is never drawn (white or covered text) is left out of the character comparison.
- Pages that draw in-line characters as images are dropped from the sample.
- Characters pixels cannot tell apart are folded — middle dots · • ∙, unit ㎡ vs m², corner brackets ｢｣ 「」.
- Table rows whose value cells stack several lines side by side are unfolded by line index.

## HWP · HWPX → Markdown — against HwpForge

The same corpus converted by [HwpForge](https://github.com/ai-screams/HwpForge) 0.16.6 (`to_md`, lossy) and by kordoc, both scored against the **original HWPX XML** with the same scorer. Tables from both outputs go through the same Markdown table parser; single-column tables are excluded.

- **Table gap** — HwpForge focuses on generation and editing; its Markdown uses pipe tables only, so merged cells cannot be expressed.
- **Why single-column tables are excluded** — the 1,288 single-column tables are decorative frames (43% title/body boxes, 28% blank spacer frames, 3% lists), so table vs. lines is a presentation choice and their text is scored by text recall. Including them: HWPX 10,392 tables, kordoc 90.6% vs HwpForge 36.0%; HWP 3,500 tables, 92.8% vs 32.1%.
- **HWP document count** — excludes one pair whose HWPX is distribution-encrypted (no ground truth).
- **Reproduce** — `bench/hwpforge-bench.py`, then `node bench/compare-md-parsers.mjs <output dir>` (`--include-single-col` to include single-column tables).
