# kordoc

**모두 파싱해버리겠다.**

[![npm version](https://img.shields.io/npm/v/kordoc.svg)](https://www.npmjs.com/package/kordoc)
[![license](https://img.shields.io/npm/l/kordoc.svg)](https://github.com/chrisryugj/kordoc/blob/main/LICENSE)

> *대한민국에서 둘째가라면 서러울 문서지옥. 거기서 7년 버틴 공무원이 만들었습니다.*

HWP 3.x/5.x, HWPX, HWPML, PDF, XLS, XLSX, DOCX, 이미지(PNG/JPG/WebP) — 관공서 문서를 파싱·비교·생성합니다. [English](./README-EN.md)

- 📊 **PDF 공개 벤치 1위** — opendataloader-bench 200문서 종합 0.960, 공개 12개 파서(상용 포함)보다 높음 (OCR 끄면 0.937·쪽당 0.04초)
- 🇰🇷 **한국 공문서 표 무손실** — 원본 HWPX 를 정답으로 채점해 HWPX 표 13,041개가 칸까지 일치

[![Kordoc 활용하기 — 영상 보기](./docs/video-demo.jpg)](https://youtu.be/Q13GmgDcIw0)

<sub>▶ 클릭하면 유튜브에서 재생됩니다.</sub>

**목차** — [설치](#-설치) · [주요 기능](#-주요-기능) · [성능](#-성능) · [빠른 시작](#-빠른-시작) · [CLI](#-cli) · [MCP 서버](#-mcp-서버) · [API](#-api) · [지원 포맷](#-지원-포맷) · [보안](#-보안) · [최근 변경](#-최근-변경)

---

## v4.18.1 변경사항

**PPTX(PowerPoint)를 파싱합니다.** 슬라이드 순서(`sldIdLst`)대로 읽어 슬라이드마다 `a:p` 글을 문단·목록으로 내고(제목 자리표시자는 `##`), 표는 `gridSpan`·`rowSpan` 과 `hMerge`·`vMerge` 이어짐 칸을 반영해 병합 그대로 복원합니다. 차트는 계열 이름·항목·값의 **캐시**(`c:tx`/`c:cat`/`c:val`)를 읽어 항목×계열 표로 내므로 엑셀 원본이나 PowerPoint 없이도 숫자가 남습니다. SmartArt(`dgm:data`)는 노드 글을 흐름 순서대로 목록으로, 발표자 노트는 슬라이드 본문 뒤 `## 발표자 노트` 로 붙입니다. 슬라이드 그림은 `images` 로 추출하고(원본 파트 경로가 `source`), `ocr: true` 면 이미지 입력과 **같은 내장 엔진**(PP-OCRv5, 괘선 표 복원 포함)으로 글자를 읽습니다 — OCR 모델이 이미 캐시에 있으면 자동, 없으면 다운로드하지 않고 추출만 합니다(`ocr: false` 로 끔).

**읽기 순서를 도형 트리 순서 그대로** 지킵니다. 종전처럼 도형 글을 모두 먼저 내고 표를 나중에 붙이면 표와 텍스트가 번갈아 놓인 슬라이드에서 순서가 뒤집힙니다. `pages`/`pageCount` 는 슬라이드 단위이고, `--pages 2-4` 로 일부 슬라이드만 읽습니다.

**폐쇄망 Windows 반입 산출물 — 포터블 ZIP 과 MSI.** `node scripts/pack-offline.mjs --target win32-x64 --format zip` 이 압축만 풀면 바로 쓰는 트리를(압축 안에 Windows용 `bin\kordoc.cmd`·`bin\kordoc-mcp.cmd` 실행기와 PowerShell 기준 `INSTALL.md` 포함), `npm run build:msi` 가 **같은 staging** 을 WiX v5 로 구워 OCR 엔진·모델을 포함한 `kordoc-<버전>-win-x64.msi` 를 만듭니다(설치 위치 `%ProgramFiles%\kordoc`, 시스템 `KORDOC_OFFLINE=1`, `bin` 을 PATH 에 추가, 동봉 모델 경로 설정, `MajorUpgrade` 로 이전 버전 대체). MSI 는 WiX 가 필요한 Windows/CI 에서 만들어지며 [`.github/workflows/windows-package.yml`](.github/workflows/windows-package.yml) 이 두 산출물을 한 번에 올립니다(태그 푸시면 OCR 포함 산출물을 릴리스에 첨부). 절차는 [docs/offline-deployment.md](docs/offline-deployment.md).

PPTX 지원으로 #80 의 "PPTX 는 지원하지 않는 형식" 동작은 끝납니다 — 이제 `parse()` 는 PPTX 를 파싱합니다. 원본 서식을 그대로 고치는 도구(`fill_form` hwpx-preserve·`patch_document`)는 종전대로 `감지된 포맷: pptx` 로 명시 거부합니다.

## ⚡ 설치

Node.js 20+ 만 있으면 됩니다 (macOS / Linux / Windows).

### AI 에이전트 연동 (MCP) — 30초

```bash
npx -y kordoc setup
```

설치된 AI 클라이언트(Claude Desktop · Cursor · Claude Code · Windsurf · VS Code · Gemini CLI · Zed · Antigravity · Codex)를 골라 설정을 자동으로 넣습니다. 재시작하면 [17개 문서 도구](#-mcp-서버)가 켜집니다.

### Claude Code 플러그인

```
/plugin marketplace add chrisryugj/kordoc
/plugin install kordoc@kordoc
```

`.hwp`/`.hwpx` 파일이나 공문서 작성 요청에 스킬이 자동으로 켜집니다(별도 설치 불필요).

### 라이브러리 · CLI

```bash
npm install kordoc        # CLI 만 쓸 거면 설치 없이 npx kordoc <파일>
```

PDF·OCR 의존성은 기본으로 설치됩니다(줄이려면 `--omit=optional` — 대신 PDF·OCR 이 빠짐). PDF 인쇄 렌더(`markdownToPdf`)만 `puppeteer-core` 를 따로 설치하세요.

<details>
<summary>설치 문제 해결</summary>

- **`MODULE_NOT_FOUND` / `Cannot find module ...\dist\cli.js`** — 깨진 글로벌 설치가 남은 상태입니다.
  ```powershell
  npm uninstall -g kordoc
  npx -y kordoc@latest setup
  ```
- **PowerShell `npx.ps1 … PSSecurityException`** — PowerShell 기본 정책 문제입니다. 명령 프롬프트(cmd)에서 `npx -y kordoc setup` 을 실행하거나, `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 후 PowerShell 을 다시 여세요.
- **제한 네트워크 linux/x64 에서 PNG 렌더·이미지 OCR 만 `MISSING_DEPENDENCY`(sharp)** (#99) — onnxruntime 의 CUDA 다운로드가 실패하면서 sharp 까지 빠진 경우입니다.
  ```bash
  ONNXRUNTIME_NODE_INSTALL=skip npx -y kordoc@^4 <command> ...
  ```
- **폐쇄망** — [보안](#-보안) 참고.

</details>

---

## 💡 주요 기능

| 기능 | 내용 |
| --- | --- |
| 📄 **문서 → Markdown** | HWP·HWPX·PDF·DOCX·XLS(X)·이미지를 Markdown + 구조 IR(`IRBlock[]`)로 |
| 📊 **표 복원** | 원본에서 보이는 모습 그대로: 선이 그어진 표는 병합·중첩까지 표로, 테두리 없는 틀은 글로, 칸으로 조립한 분수는 수식으로. 선 없는 PDF 표, 신구조문대비표까지 |
| 🔍 **신구대조표** | 두 문서 차이를 블록·셀 단위로 (HWP ↔ HWPX 교차 비교) |
| 📝 **Markdown → HWPX** | AI 가 쓴 글을 표·수식·차트 포함 HWPX 로 |
| 🏛️ **공문서 생성** | 개조식 보고서·기안문·보도자료·서울 방침서 프리셋, 표기법 검수 19룰(`kordoc lint`) |
| 🔄 **서식 보존 편집** | 고친 Markdown 을 원본에 반영 — 바뀐 글만 교체 (`patchHwpx`/`patchHwp`) |
| ✏️ **양식 채우기** | 빈칸·누름틀을 서식 그대로 채움, 내장 표준 기안문 2종 |
| 🔴 **도장 날인** | "(인)" 자리에 도장 이미지를 띄움 (`kordoc seal`) |
| 🖼️ **렌더** | 한컴 없이 원본 모양 그대로 SVG/PNG/PDF 미리보기 |
| 📈 **차트** | Markdown 펜스 → 한컴 네이티브 차트 20종 |
| 👓 **내장 OCR** | 스캔 PDF·이미지를 로컬 CPU 로 — API 키 불필요 |
| 📑 **RAG · 인용** | 위계 breadcrumb 청크, 실제 쪽 번호로 인용 |
| 🕶️ **개인정보 마스킹** | 주민번호·전화·계좌 등을 찾아 HWPX/HWP 는 서식 그대로 가림 (공개 전 사람 확인 필수) |
| 🤖 **MCP** | Claude·Cursor·Codex 에서 문서 도구로 직접 호출 |

---

## 📊 성능

모든 수치는 `npm run bench:gate` 로 재현되고, 배포 때마다 이 게이트를 통과해야 합니다. 채점 기준·재현 방법·옵션별 수치는 [docs/benchmarks.md](docs/benchmarks.md).

### PDF → Markdown (opendataloader-bench 200문서)

논문·보고서·슬라이드·스캔 PDF 200개를 사람이 만든 정답과 비교해 읽기 순서·표 구조·제목 위계를 잽니다(1.0 = 정답).

| 순위 | 엔진 | 종합 | 읽기 순서 | 표 | 제목 | 쪽당 시간 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| **1** | **kordoc 기본값** | **0.960** | **0.961** | **0.979** | **0.945** | **0.52초** |
| 참고 | kordoc `ocr: false` (가장 빠름) | 0.937 | 0.938 | 0.936 | 0.933 | 0.04초 |
| 참고 | kordoc `ocr: true, plain: true, htmlTables: true` | 0.973 | 0.977 | 0.983 | 0.959 | 0.58초 |
| 2 | opendataloader-hybrid | 0.907 | 0.934 | 0.928 | 0.821 | 0.46초 |
| 3 | nutrient (상용) | 0.885 | 0.925 | 0.708 | 0.819 | 0.01초 |
| 4 | docling | 0.882 | 0.898 | 0.887 | 0.824 | 0.76초 |
| 5 | marker | 0.861 | 0.890 | 0.808 | 0.796 | 53.9초 |
| 6 | unstructured-hires | 0.841 | 0.904 | 0.588 | 0.749 | 3.01초 |
| 7 | edgeparse | 0.837 | 0.894 | 0.717 | 0.706 | 0.04초 |
| 8 | mineru | 0.831 | 0.857 | 0.873 | 0.743 | 5.96초 |
| 9 | opendataloader | 0.831 | 0.902 | 0.489 | 0.739 | 0.02초 |
| 10 | pymupdf4llm | 0.732 | 0.885 | 0.401 | 0.412 | 0.09초 |
| 11 | unstructured | 0.686 | 0.882 | 0.000 | 0.388 | 0.08초 |
| 12 | markitdown | 0.589 | 0.844 | 0.273 | 0.000 | 0.11초 |
| 13 | liteparse | 0.576 | 0.866 | 0.000 | 0.000 | 1.06초 |

- 기본값만으로 네 항목 모두 1위 — GPU·클라우드 API·LLM 없이 Node.js 하나로. `ocr: false` 도 네 항목 모두 1위입니다.
- 기본값은 OCR 모델이 캐시에 있으면 스캔 쪽과 큰 그림 속 글을 자동으로 읽습니다. 그림이 많은 문서가 느려지니 속도가 중요하면 `ocr: false`.

### 한국 공문서 — 원본 HWPX 가 정답

HWPX 원본과 그 PDF 가 짝으로 있는 실제 정부 문서(보도자료·결재문서·법령 서식·예산서 등)로 잽니다. 표 정답은 원본에서 **보이는 표**입니다(칸 테두리로 그린 모습, v4.17.0 채점 기준).

| 분야 | 규모 | 결과 |
| --- | --- | --- |
| HWPX 본문·표 | 2,286문서, 보이는 표 9,865개 | 글 누락 0 · 표 칸까지 일치 99.6% · 읽기 순서 100% |
| HWP 5.x | HWPX 와 짝 1,120쌍 | HWPX 결과와 전부 일치 |
| PDF 글 | 744쌍 | 글자 재현율 99.8% · 정확도 99.6% · 읽기 순서 99.1% · 어절 F1 98.8% |
| PDF 표 | 708쌍, 보이는 표 2,331개 | 표 찾기 99.7% · 칸까지 완전 일치 97.3% · 칸 F1 0.989 |
| 법령 별표 (HWP·한컴 PDF) | 272건, 보이는 표 346개 | HWP 표 전부 칸까지 일치 · PDF 96.8% · 칸으로 조립한 분수 수식 11/11(HWP) |
| PDF 전체 | 1,911문서 | 글 커버리지 99.8% |
| 스캔 OCR (로컬 CPU) | 53문서 102쪽 | 글자 재현율 99.0% · 정확도 99.4% · 쪽당 약 1초 |
| DOCX·XLSX·XLS·HML | 88문서 | 글·숫자 누락 0 |
| Markdown → HWPX → Markdown | 83건 | 글·표·제목·수식 손실 0 |

### HWP·HWPX → Markdown — HwpForge 비교

같은 코퍼스를 원본 HWPX XML 을 정답으로 같은 채점기에 넣었습니다(1열 표 제외). v4.16 시점, 종전 정답(HWPX 표 구조 그대로) 기준 측정입니다.

| | kordoc | HwpForge 0.16.6 |
| --- | ---: | ---: |
| HWPX 2,305문서 — 변환 실패 | **0** | 123 |
| HWPX — 글 재현율 (변환 성공 문서만) | **100.00%** (100.00%) | 59.23% (98.64%) |
| HWPX — 표 완전 일치 (9,123표) | **100.0%** (9,122) | 32.2% |
| HWPX — 칸 F1 | **1.000** | 0.428 |
| HWP 5.x 1,108문서 — 변환 실패 | **0** | 19 |
| HWP — 글 재현율 | **100.00%** | 86.41% |
| HWP — 표 완전 일치 (3,111표) | **100%** | 27.0% |
| HWP — 칸 F1 | **1.000** | 0.349 |

표 점수 차이는 대부분 HwpForge 의 파이프 표가 병합 칸을 못 담는 데서 옵니다.

---

## 🚀 빠른 시작

### 문서 파싱

```typescript
import { parse } from "kordoc"
import { readFileSync } from "fs"

const result = await parse(readFileSync("사업계획서.hwpx"))   // 파일 경로 문자열도 받음

if (result.success) {
  result.markdown   // 마크다운
  result.blocks     // IRBlock[] 구조화 데이터
  result.metadata   // { title, author, createdAt, pageMode, ... }
  result.pages      // [{ pageNumber, markdown }] 쪽 단위 본문
}
```

- `pages` 는 블록에 쪽 번호가 붙는 포맷(HWP·HWPX·PDF, XLS(X)는 시트 = 한 쪽)에서만 나옵니다. 쪽을 매기지 않는 DOCX 에서는 필드를 생략합니다.
- 쪽 경계 신뢰도는 `metadata.pageMode` — `"layout"`(조판 캐시 기반 실제 쪽) / `"section"`(섹션 근사).

**파싱 옵션** (`parse(buffer, options)` · CLI 플래그)

| 옵션 | CLI | 설명 |
| --- | --- | --- |
| `pages` | `-p, --pages` | `"1-3"`·`"1,3,5-7"`·`[1, 5, 10]` — PDF·한컴 저장본은 실제 쪽, 조판 캐시 없으면 섹션 근사 |
| `ocr` | `--ocr` · `--ocr-force` | 기본: 스캔 쪽 + 큰 그림 속 글(모델 캐시 있을 때) · `true`: + 작은 그림·로고까지(모델 ~18MB 자동 다운로드) · `"force"`: 전 쪽 · `false`: 끔 · 함수: 외부 OCR |
| `formulaOcr` | `--formula-ocr` | PDF 수식 OCR(MFD+MFR, 모델 ~155MB) — 감지한 수식을 `$…$`·`$$…$$` 로 |
| `scriptTags` | `--script-tags` · `--no-script-tags` | 위·아래첨자를 `<sup>`·`<sub>` 로("10⁴ m²" 가 "104 m2" 로 펴지지 않게). 기본: HWPX·HWP·DOCX 켬, PDF 끔(논문·수식 PDF 는 `true` 권장) |
| `images` | `--no-images` | `false` 면 이미지 바이트를 싣지 않음(그림 자리 표시는 남김, PDF 는 PNG 인코딩 생략) |
| `plain` | `--plain` | 그림 자리 표시·링크 URL·밑줄·굵게 없이 글 위주 Markdown(제목·목록·표 구조 유지, `blocks` 는 그대로). 첨자 `<sup>`·`<sub>` 는 `10^4`·`H_2O` 로 |
| `htmlTables` | `--html-tables` | 모든 표를 HTML 로, 태그마다 한 줄씩 들여써서(첫 행 `<th>`) |
| `password` | `--password` | 열기 암호 문서(HWPX·HWP3·HWP5, 한컴 DRM 은 해당 없음) |
| `tables` | `--no-tables` | `false` 면 PDF 표 감지 끔(테두리 상자가 표로 잡혀 순서가 뒤집히는 2단 시험지 등) |
| `removeHeaderFooter` | `--no-header-footer` | PDF 머리글/바닥글 제거(기본 켬, 3쪽 이상) |
| `layoutTables` | `--keep-layout-tables` | 테두리 안 보이는 틀 표 처리. 기본 `"visual"`: 보이는 대로(틀은 글, 선이 보이는 부분만 표, 칸으로 조립한 분수는 수식). `"keep"`: 원본 표 구조 그대로(`patch` 로 되돌릴 편집본은 이것으로) |
| `keepTrailingEmptyCols` | `--keep-empty-cols` | 표 오른쪽 끝 빈 열(서식 입력란) 보존 |
| `keepEmptyParagraphs` | `--keep-empty-paragraphs` | 빈 문단 보존 — 원문 문단 수 = 줄 수(HWPX) |
| `includeFieldPlaceholders` | `--include-field-placeholders` | 미기입 누름틀 안내문도 출력(HWPX·HWP5) |
| `dedupeRunningHeaders` | `--dedupe-headers` | HWP5 레이아웃 표의 쪽마다 반복된 러닝 헤더 제거(붙임별 재번호도 지울 수 있어 opt-in) |
| `inlineImages` | `--inline-images` | 이미지를 base64 data URI 로 인라인(BMP→PNG, HWP5) |
| `classifyTables` | — | 표를 의미표/레이아웃/불확실로 분류해 `IRTable.classification` 에 |
| `onProgress` | — | 진행률 콜백 `(current, total)` |

### 문서 비교 (신구대조표)

```typescript
import { compare } from "kordoc"

const diff = await compare(구버전Buffer, 신버전Buffer)   // HWP ↔ HWPX 교차 비교 가능
// diff.stats → { added: 3, removed: 1, modified: 5, unchanged: 42 }
// diff.diffs → BlockDiff[] (표는 셀 단위 diff 포함)
```

### 양식 필드 추출 · 채우기

```typescript
import { parse, extractFormFields, fillForm } from "kordoc"
import { readFileSync, writeFileSync } from "fs"

const r = await parse(buffer)
if (r.success) {
  const form = extractFormFields(r.blocks)
  // form.fields → [{ label: "성명", value: "홍길동", row: 0, col: 0 }, ...], form.confidence → 0.85
}

// HWPX 원본 서식 보존 모드 — 글꼴·크기·정렬 유지
const filled = await fillForm(readFileSync("신청서.hwpx"), {
  성명: "홍길동", 주민등록번호: "900101-1234567", 주소: "서울특별시 광진구 능동로 120",
}, "hwpx-preserve")
writeFileSync("신청서_작성완료.hwpx", Buffer.from(filled.output as ArrayBuffer))
// filled.fill.filled → 채운 필드, filled.fill.unmatched → 매칭 실패한 키
```

### 내장 표준 기안문 서식 + 누름틀 채우기

표준 기안문 서식(「행정 효율과 협업 촉진에 관한 규정 시행규칙」 별지)이 패키지에 들어 있어 이름만으로 공문서를 만듭니다. 서식 출처: [rhwp](https://github.com/edwardkim/rhwp) (MIT).

| 이름 | 서식 | 용도 | 누름틀 |
|------|------|------|--------|
| `gian` (일반기안문) | 별지 제1호서식 | 대외 시행문·협조문 | 23곳 — 행정기관명·수신자·경유·제목·본문·붙임·발신명의·기안자·검토자·결재권자·시행번호 등 |
| `gian-simple` (간이기안문) | 별지 제2호서식 | 내부결재 보고서·계획서(결재란 표) | 13곳 — 생산등록번호·결재직위1~4·제목·요약설명·작성일 등 |

```bash
npx kordoc fill --list-templates                                # 내장 서식 목록 + 필드
npx kordoc fill --template gian -j 값.json -o 기안문.hwpx
npx kordoc fill templates:간이기안문 -f '제목=…' -o 보고.hwpx     # 위치 인자 표기도 같음
```

- 누름틀 이름으로 먼저 채우고 남은 키는 라벨로 찾습니다 — 누름틀이 있는 어떤 HWPX 서식에도 동작.
- 여러 줄 값은 문단 안 줄바꿈으로 들어가고, 원본 서식은 그대로입니다.
- API: `extractClickHereFields` → `fillHwpx(buf, 값)`. MCP `fill_form` 은 `template` 파라미터로 같은 서식을 씁니다.

### HWPX 생성 (Markdown → HWPX)

```typescript
import { markdownToHwpx } from "kordoc"

const hwpx = await markdownToHwpx("# 제목\n\n본문\n\n| 이름 | 직급 |\n| --- | --- |\n| 홍길동 | 과장 |")

// display math → HWPX 네이티브 수식(<hp:equation>) — \frac·\sqrt·첨자·Greek·적분/극한·화살표·관계 연산자·matrix 의 LaTeX-like subset
await markdownToHwpx("피타고라스\n\n$$a^2 + b^2 = c^2$$")

// 공문서 모드 — 항목부호 8단계 + 내어쓰기 + 공식 여백/명조 자동
// preset: official | report | plan | notice | minutes | gaejosik | press | ministry(업무보고) | bangchim(서울방침)
await markdownToHwpx("1. 추진배경\n  - 세부 항목\n2. 추진계획", { gongmun: { preset: "보고서" } })

// 정부 표준 개조식 보고서 — 표지·목차(장식 배너)·로마숫자 장헤더·본문 제목박스·쪽번호("- 1 -", 표지·목차 제외)
await markdownToHwpx(md, {
  gongmun: {
    preset: "개조식",
    cover: { org: "기관명", date: "2026. 7. 11." },
    toc: true,                          // h2 목록 → Ⅰ Ⅱ Ⅲ 목차 (개조식 기본 켬)
    approval: ["담당", "팀장", "과장"],   // 결재란 (선택)
    pageNumbers: true,                  // 쪽번호 (개조식·보고서·계획서 기본 켬)
    endMark: false,                     // 본문 끝 "끝." (기안문 기본 켬)
  },
})
```

- 표는 정부 문서 관행(머리행 음영·이중 하변·내용 비례 열폭)을 자동 적용합니다. 테마·참조 문서 표 서식(`hwpxToProfile`)도 받습니다.
- CLI: `kordoc generate 보고서.md -o 보고서.hwpx --preset 개조식 --org 기관명 --approval 담당,팀장,과장`

### 레이아웃 보존 렌더

한컴이 HWPX 에 저장한 조판 캐시로 원본 모양을 그대로 그립니다(서버에 한컴 불필요). 캐시가 없는 생성본은 내장 reflow 엔진이 조판합니다. 수식 개체는 아직 미지원.

```typescript
import { renderHwpxToSvg, renderDocument, extractRenderedRegions } from "kordoc"

const r = await renderHwpxToSvg(readFileSync("결재문서.hwpx"), { highlights: ["예산"] })
// r.svg, r.width/r.height (pt), r.pageCount, r.stats { texts, images, tables }, r.warnings
const g = await renderHwpxToSvg(generatedHwpx, { reflow: true })   // 조판 캐시 없는 생성본

// 통합 렌더 — HWPX·HWP(5.x), 페이지별 PNG + 표 영역 crop
const { scene, assets } = await renderDocument("결재문서.hwp", { format: "png", pages: "1-2" })
const crops = await extractRenderedRegions("결재문서.hwp", { types: ["table"] })
```

CLI: `kordoc render 결재문서.hwpx -o 결재문서.svg` (`--highlight 예산`, `--no-reflow`). 미리보기 앱 연동용 상주 렌더는 `kordoc render-worker`.

### 대량 변환 — 상주 파싱 워커

```typescript
await parse(buffer, { images: false })                   // 이미지 바이트 없이
await parse(buffer, { plain: true, htmlTables: true })   // 글 위주 + 모든 표를 HTML 로
```

`kordoc parse-worker` 는 프로세스를 띄워 둔 채 stdin JSON 한 줄마다 한 줄로 답합니다(파일마다 node 를 새로 띄우지 않음).

```text
시작  {"ready":true,"version":"4.16.0","protocol":1}
요청  {"id":1,"file":"문서.hwpx","images":false,"ocr":"off"}
응답  {"id":1,"rss":183500800,"result":{ …--format json 과 같은 결과, 실패도 success:false 로… }}
종료  {"cmd":"quit"}  (또는 stdin 닫기)
```

요청은 `ocr`(`"off"`·`"auto"`·`"force"`)·`formulaOcr`·`password` 를 받고, 응답의 `rss`(메모리)로 워커 교체 시점을 정하면 됩니다.

### OCR (스캔·이미지 PDF)

```typescript
await parse(buffer, { ocr: true })      // OCR 필요 쪽 + 그림 속 글 (PP-OCRv5 korean, 첫 사용 시 모델 ~18MB 다운로드)
await parse(buffer, { ocr: "force" })   // 전 쪽 강제
await parse(buffer, {                   // 외부 OCR (Claude Vision, Tesseract 등)
  ocr: async (pageImage, pageNumber, mimeType) => myOcrService.recognize(pageImage),
})
```

- API 키 없이 로컬 CPU 로 읽습니다(PP-OCRv5 korean ONNX — 완성형 한글 11,172자 전량).
- 텍스트층이 없거나 깨진 쪽만 OCR 하고, 스캔본의 표 구조도 복원합니다.
- 모델 관리: `kordoc models --status` (폐쇄망은 `--export`/`--import`).

### PDF 텍스트 품질 신호

`parsePdf` 는 쪽별 품질 신호를 줍니다 — 텍스트층이 깨진 쪽을 골라 OCR 로 보낼 수 있습니다.

```typescript
const r = await parsePdf(buffer)
if (r.success && r.qualitySummary?.needsOcr) await parse(buffer, { ocr: true })   // 또는 외부 OCR 큐로
for (const p of r.pageQuality ?? []) if (p.needsOcr) console.log(`p${p.page} 검토 필요: ${p.ocrReason}`)
```

신호: `textChars`·`hangulRatio`·`controlCharRatio`·`replacementCharRatio`·`puaRatio`, `needsOcr`, `ocrReason`(`low_text`·`high_pua`·`high_control`·`high_replacement`·`garbled_hangul`·`vector_text`).

---

## 💻 CLI

[병렬 변환 성능 측정과 제한 사항](docs/parallel-batch.md)

`--jobs N`은 상주 프로세스 N개로 파일 단위 병렬 변환을 실행합니다(기본 1). `--jobs > 1`의 다중 입력은 `-d`가 필요하며, 확장자를 제외한 파일 이름이 서로 달라야 합니다. 일부 파일이 실패해도 나머지는 계속 처리하고 종료 코드는 실패로 설정합니다. 완료 로그와 실패 JSON은 완료 순서로 나옵니다. 프로세스 수만큼 메모리 사용이 늘고, 작은 파일은 오히려 느릴 수 있습니다. OCR은 자체 네이티브 스레드도 사용합니다. 단일 문서의 페이지 병렬화나 JavaScript/MCP API 변경은 포함하지 않습니다.

```bash
# 변환
npx kordoc 사업계획서.hwpx                           # 터미널 출력
npx kordoc 보고서.hwp -o 보고서.md                   # 파일 저장 (그림은 images/보고서/)
npx kordoc *.pdf -d ./변환결과/                      # 일괄 변환
npx kordoc *.pdf --jobs 4 -d ./변환결과/             # 병렬 변환 (상주 프로세스 4개)
npx kordoc 검토서.hwpx --format json                # JSON (blocks + pages + metadata)
npx kordoc 검토서.pdf --format chunks               # RAG 구조 청크 JSON (breadcrumb + 표 독립 청크)
npx kordoc 보고서.hwpx --pages 1-3                   # 쪽 범위
npx kordoc 스캔본.pdf --ocr                          # 내장 OCR (--ocr-force 로 전 쪽)
npx kordoc 잠긴문서.hwpx --password '암호'            # 열기 암호 HWPX/HWP3/HWP5
npx kordoc 시험지.pdf --no-tables                    # PDF 표 감지 끄기
npx kordoc 문서.pdf --format json --no-images         # 이미지 없이 (--plain·--html-tables 도 있음)

# 양식 채우기
npx kordoc fill 신청서.hwpx -f '성명=홍길동,주소=서울' -o 결과.hwpx
npx kordoc fill 신청서.hwpx -j values.json -o 결과.hwpx
npx kordoc fill 신청서.hwpx --dry-run                              # 필드 목록만 (누름틀 포함)
npx kordoc fill 신청서.hwpx -j 값.json --formats '{"날짜":"yy.mm.dd"}' # 필드별 값 서식
npx kordoc fill 신청서.hwpx -j 값.json --require-unique            # 한 키가 2곳 이상 매칭되면 거부
npx kordoc fill 신청서.hwpx -j 값.json --mask                      # stdout 에 채운 값 대신 안내만
npx kordoc fill --template gian -j 값.json -o 기안문.hwpx           # 내장 표준 기안문 (--list-templates)

# 생성 · 편집 · 검증
npx kordoc generate 보고서.md -o 보고서.hwpx --preset 보고서        # Markdown → 공문서 HWPX
npx kordoc patch 원본.hwpx 편집.md -o 반영.hwpx                    # 서식 보존 패치 (.hwp 도 자동)
npx kordoc seal 신청서.hwpx --image 도장.png --anchor "(인)" -o 날인.hwpx
npx kordoc validate 산출물.hwpx                                    # HWPX 구조 검증 (ZIP·필수 파트·XML)
npx kordoc lint 보고서.md                                          # 공문서 표기법 19룰 (md/txt, '-'=stdin, error 면 exit 1)
npx kordoc profile 기관서식.hwpx                                   # 표 서식 프로필 JSON → generate --profile

# 개인정보 마스킹
npx kordoc redact 민원서류.hwpx -o 마스킹.hwpx                      # 서식 보존 마스킹 + 잔존 재검사 (남으면 exit 2)
npx kordoc redact 민원서류.hwpx --mask-char '*' -o 마스킹.hwpx      # 마스크 문자 (기본 ●)
npx kordoc redact 계약서.hwp --rules rrn,phone,crn --json --dry-run # 룰 선택 + 위치별 리포트만 (crn·IP 는 opt-in)
npx kordoc redact 민원서류.hwpx --rules rrn,phone,email,name,address -o 마스킹.hwpx  # 이름·주소까지 (opt-in)
npx kordoc redact 공문.pdf                                         # PDF·DOCX 등은 마스킹된 .redacted.md 만

# 렌더
npx kordoc render 결재문서.hwpx -o 미리보기.svg                     # 레이아웃 보존 SVG (캐시 없으면 reflow)
npx kordoc render 결재문서.hwpx --format png --pages 2-4 -d ./pages # PNG·JPEG·HTML·PDF 도
npx kordoc render 결재문서.hwpx --reflow-mode charAll -o 미리보기.svg # reflow 줄바꿈 keep(어절, 기본)|charAll(글자)

# 모델 · 감시
npx kordoc models --status                          # OCR 모델 상태 (--export/--import 폐쇄망 사이드로드)
npx kordoc check-ocr-models --status-only           # 상태만 JSON (옵션 빼면 없는 모델을 받음)
npx kordoc check-formula-models --status-only       # 수식 OCR 모델(MFD+MFR+tokenizer, ~155MB) 상태만
npx kordoc watch ./수신함 -d ./변환결과              # 폴더 감시 (하위 폴더 구조 유지)
npx kordoc watch ./문서 --webhook https://api/hook  # 웹훅 알림
```

- `watch -d` 는 하위 폴더 구조를 그대로 둡니다.
- `check-ocr-models`·`check-formula-models` 는 없는 모델을 내려받습니다 — 상태만 보려면 `--status-only`.
- `lint` 는 Markdown·텍스트용입니다. HWPX 는 `kordoc 문서.hwpx | kordoc lint -`.

### 실패 계약 — 기계 판독 가능한 실패 JSON

변환 실패는 모든 `--format` 에서 stdout 에 아래 JSON 을 내고 exit 1 로 끝납니다 — `code` 로 분기하세요.

```json
{ "success": false, "fileType": "hwpx", "file": "보고서.hwpx", "error": "암호화된 문서입니다 …", "code": "ENCRYPTED" }
```

- 실패는 언제나 `success:false` 객체라 성공 출력(텍스트·배열)과 겹치지 않습니다. 여러 파일이면 실패마다 한 줄씩 나옵니다.
- 종료 코드와 필드는 유지되고 `code` 값은 추가만 됩니다. `error` 문구는 사람용이라 계약이 아닙니다.

| `code` | 의미 |
|---|---|
| `ENCRYPTED` | 열기 암호 문서 (`--password` 필요 또는 불일치) |
| `DRM_PROTECTED` | 한컴 문서보안(DRM) — 열 수 없음 |
| `UNSUPPORTED_FORMAT` | 지원하지 않는 형식 |
| `CORRUPTED` | 시그니처 불일치·복구 불가 손상 |
| `IMAGE_BASED_PDF` | 텍스트층 없는 스캔 PDF (`--ocr` 필요) |
| `ZIP_BOMB` / `DECOMPRESSION_BOMB` | 압축 폭탄 방어 발동 |
| `NO_SECTIONS` | 본문 섹션 없음 |
| `OUTPUT_TOO_LARGE` | 출력 직렬화가 런타임 문자열 한계 초과 |
| `MISSING_DEPENDENCY` | 선택 의존성 미설치 (pdfjs-dist 등) |
| `EMPTY_INPUT` | 빈 입력 |
| `FILE_NOT_FOUND` | 입력 경로 없음 (ENOENT) |
| `PARSE_ERROR` | 그 외 파싱 실패 |

### 이미지 번들 — `images/<문서 이름>/manifest.json`

`-o`/`-d` 로 저장하면 그림은 문서마다 `images/<문서 이름>/` 에 `manifest.json` 과 함께 저장됩니다(같은 폴더로 여러 문서를 변환해도 안 덮어씀). `--format json --image-refs` 는 바이트 대신 경로만 남깁니다.

```json
[ { "name": "image_001.png", "mimeType": "image/png", "bytes": 68, "source": "BinData/image1.png" } ]
```

- `mimeType` 은 파일 머리(매직바이트)로 확인한 값, `source` 는 원본 컨테이너 안 경로입니다.
- 그림은 원본 그대로 저장합니다(PDF 만 PNG 로 재인코딩). 형식은 확장자보다 `mimeType` 을 믿으세요.

---

## 🤖 MCP 서버

자동 설치는 [`npx -y kordoc setup`](#ai-에이전트-연동-mcp--30초). 수동 등록:

```bash
codex mcp add kordoc -- npx -y kordoc mcp          # Codex
```

```json
{ "mcpServers": { "kordoc": { "command": "npx", "args": ["-y", "kordoc", "mcp"] } } }
```

Windows 에서 Claude Desktop 이 `.cmd` 를 못 찾으면 `"command": "cmd", "args": ["/c", "npx", "-y", "kordoc", "mcp"]`.

**17개 도구**

| 도구 | 설명 |
|------|------|
| `parse_document` | HWP/HWPX/PDF/XLSX/DOCX → Markdown (메타데이터 포함) |
| `detect_format` | 매직 바이트로 포맷 감지 |
| `parse_metadata` | 메타데이터만 빠르게 |
| `parse_pages` | 특정 쪽 범위만 |
| `parse_table` | N번째 표만 |
| `parse_chunks` | RAG 구조 청크 JSON — 헤딩·개조식 위계 breadcrumb + 표 독립 청크 |
| `compare_documents` | 두 문서 비교 (교차 포맷) |
| `parse_form` | 양식 필드를 JSON 으로 |
| `fill_form` | 양식에 값 채우기 (HWPX 서식 보존, 서식·유일성 가드, 내장 `template`) |
| `patch_document` | 편집한 Markdown 을 원본 HWPX/HWP 에 서식 보존 반영 |
| `extract_profile` | 참조 HWPX 의 표 서식 프로필 JSON — `generate_document` 의 `profile_path` 로 재현 |
| `generate_document` | Markdown(표·수식·차트) → HWPX, 공문서 프리셋 |
| `place_seal` | 도장/서명 이미지를 앵커 문구 위에 부유 배치 |
| `render_document` | HWPX·HWP 를 조판 그대로 PNG/JPEG(응답 이미지)·SVG/HTML/PDF(파일)로 — 생성·수정 결과를 AI 가 눈으로 검증 |
| `redact_document` | 개인정보 탐지 + 서식 보존 마스킹 (HWPX/HWP 는 머리말·각주·미리보기·문서 정보까지 + 잔존 재검사, 그 외는 마스킹된 Markdown) |
| `crop_regions` | 렌더 영역(표·이미지·문단·도형)을 쪽 이미지에서 실배율로 잘라 저장 + regions.json |
| `extract_tables` | 표 분류(데이터표/조직도류/불확실) + 쪽·bbox + 정책별 crop — 조직도는 이미지로, 데이터표는 구조로 |

---

## 📚 API

### 파싱

| 함수 | 설명 |
|------|------|
| `parse(buffer, options?)` | 포맷 자동 감지 → Markdown + `IRBlock[]` (파일 경로 문자열도 받음) |
| `parseHwpx` · `parseHwp` · `parseHwp3` · `parseHwpml` | HWPX · HWP 5.x · HWP 3.x(1996~2002) · HWPML 전용 — 모두 `(buffer, options?)` |
| `parsePdf` · `parseDocx` · `parseXlsx` · `parseXls` | PDF · DOCX · XLSX · XLS(Excel 97~2003, BIFF8) 전용 |
| `parseImage(buffer, options?)` | 이미지(PNG/JPG/WebP) 전용 — 내장 OCR 상시 적용 |
| `detectFormat(buffer)` | 동기 매직 바이트 감지 — 하위 호환을 위해 ZIP 은 `hwpx`, OLE2 는 `hwp` 반환 |
| `await detectZipFormat(buffer)` | ZIP 내부 구조로 `hwpx`·`xlsx`·`docx`·`pptx`·`unknown` 구분 |
| `detectOle2Format(buffer)` | OLE2 내부 스트림으로 `hwp`·`xls`·`unknown` 구분 |

PPTX 도 `parse()` 로 파싱합니다. ZIP 종류를 가르려면 `detectFormat()` 이 `hwpx` 일 때 `await detectZipFormat(buffer)` 를 쓰세요.

### 비교 · 양식 · 편집

| 함수 | 설명 |
|------|------|
| `compare(bufferA, bufferB, options?)` | IR 레벨 문서 비교 |
| `extractFormFields(blocks)` / `extractFormSchema(blocks)` | 양식 필드 인식 / + 타입·필수·빈값 추론 |
| `fillForm(input, values, outputFormat?)` | 양식 채우기 — `"markdown"`(기본)·`"hwpx"`·`"hwpx-preserve"`, 반환 `{ output, format, fill }` |
| `fillFormFields(blocks, values)` | IRBlock[] 기반 필드 값 교체 |
| `fillHwpx(buffer, values)` | HWPX XML 직접 조작 (원본 서식 보존) |
| `extractClickHereFields(buffer)` | HWPX 누름틀(CLICK_HERE) 필드 조사 — 이름·안내문 |
| `resolveBuiltinTemplate(name)` / `readBuiltinTemplate(t)` | 내장 표준 기안문 서식 조회·로드 (`gian`·`gian-simple`) |
| `patchHwpx(original, editedMarkdown, options?)` | 편집 Markdown → 원본 HWPX 서식 보존 패치 |
| `patchHwp(original, editedMarkdown, options?)` | 편집 Markdown → 원본 HWP 5.x 바이너리 서식 보존 패치 |
| `openHwpxDocument(bytes, options?)` | 에디터용 블록 단위 증분 패치 세션 `HwpxSession` |
| `patchHwpxBlocks(bytes, edits, options?)` | 세션 없이 블록 편집 1회 패치 |
| `placeSealHwpx(buffer, seals)` | 도장/서명 이미지를 앵커 문구 위에 부유 배치 |
| `validateHwpx(buffer)` | HWPX 구조 검증 — ZIP·mimetype·필수 파트·XML 웰폼드 |

### 생성 · 렌더

| 함수 | 설명 |
|------|------|
| `markdownToHwpx(markdown, options?)` | Markdown → HWPX (테마·서식 프로필·쪽 옵션·공문서 프리셋) |
| `hwpxToProfile(buffer)` | 참조 HWPX → 표 서식 프로필 JSON (`markdownToHwpx(md, { profile })` 로 재현) |
| `markdownToPdf(markdown, options?)` / `blocksToPdf(blocks, options?)` | Markdown·IRBlock[] → PDF (`puppeteer-core` 별도 설치) |
| `renderHtml(blocks, options?)` | IRBlock[] → 인쇄용 HTML (puppeteer 불필요, 원문 HTML 은 허용 태그만 통과 + CSP) |
| `renderHwpxToSvg(buffer, options?)` | HWPX → 레이아웃 보존 SVG — 다페이지·형광펜·도형, 캐시 없으면 `reflow` |
| `renderDocument(입력, { format, pages?, … })` | HWPX·HWP(5.x) → 쪽별 svg/png/jpeg·문서 html/pdf 자산 + `RenderScene`(쪽 로컬 pt bbox·결정적 region id) |
| `extractRenderedRegions(입력, { types?, pages?, … })` | 표·이미지·문단·도형 영역을 쪽 이미지에서 실배율 crop |
| `extractTables(입력, { policy?, … })` | 표 분류(의미표/조직도류/불확실) + 렌더 영역 조인 + 정책별 crop |

### 텍스트 · 변환 도구

| 함수 | 설명 |
|------|------|
| `lintGongmunText(text, { document? })` | 공문서 표기법 19룰 + AI 슬롭 2룰 (`document: true` 면 붙임·"끝." 문서 단위 검사 포함) |
| `redactMarkdown(text, options?)` / `redactText(...)` | 개인정보 탐지 + 마스킹 — 텍스트 단위 (파일 단위는 CLI `redact`·MCP `redact_document`) |
| `blocksToChunks(blocks, options?)` | RAG 구조 청크 — 헤딩·개조식 위계 breadcrumb + 표 독립 청크 |
| `blocksToMarkdown(blocks)` | IRBlock[] → Markdown |
| `blocksToPages(blocks)` | IRBlock[] → `[{ pageNumber, markdown }]` |

### 타입

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

## 📂 지원 포맷

| 포맷 | 엔진 | 특징 |
|------|------|------|
| **HWPX** (한컴 2020+) | ZIP + XML DOM | 매니페스트, 중첩 표, 병합 셀, 손상 ZIP 복구, 조판 캐시 기반 실제 쪽 경계, 열기 암호, 양식 선택 상자·라디오 단추 |
| **HWP 5.x** (한컴 레거시) | OLE2 + CFB | 배포용 복호화, 열기 암호, 손상 CFB 복구, 각주·하이퍼링크, 21종 제어문자, 이미지 추출, 실제 쪽 경계 |
| **HWP 3.x** (1996~2002) | 단일 binary | 상용조합형 → 유니코드, 한자·기호 5,893자 lookup, 중첩 문단, 아래아(옛한글), 열기 암호 |
| **HWPML 2.x** (XML HWP) | XML DOM | HeadingType 기반 헤딩, 병합 셀, DoS 방어 |
| **PDF** | pdfjs-dist | 선·클립·무괘선 표, XY-Cut 읽기 순서, 2단 지면, 헤딩, 각주·미주, 수식 글꼴 복원, OCR, 밑줄·링크, 이미지 추출, 텍스트 품질 신호 |
| **XLSX** (Excel) | ZIP + XML DOM | 공유 문자열, 병합 셀, 다중 시트, 수식 표시, 날짜 셀 ISO 변환, 대형 시트 스트리밍 |
| **XLS** (Excel 97~2003) | OLE2 + BIFF8 | Workbook 스트림, SST 공유 문자열, 셀·시트 추출 |
| **DOCX** (Word) | ZIP + XML DOM | 스타일 헤딩, 번호 매기기(실제 번호 라벨), 각주, 하이퍼링크, 이미지 추출 |
| **이미지** (PNG/JPG/WebP) | sharp + 내장 OCR | 스크린샷·스캔 이미지 직접 입력, 래스터 괘선으로 표 복원 |

---

## 🔒 보안

- ZIP·압축 폭탄, XXE, 경로 순회, SSRF 를 막습니다 — 자세한 내용은 [SECURITY.md](./SECURITY.md).
- **폐쇄망**: `KORDOC_OFFLINE=1` 은 모든 외부 통신을 막고, `KORDOC_ROOT=<디렉토리>` 는 MCP 파일 접근을 그 안으로 제한합니다. 오프라인 설치 번들·모델 옮기기는 [docs/offline-deployment.md](docs/offline-deployment.md).

---

## 📝 최근 변경

### v4.17.2
- PDF 표 복원·3단 리플릿 읽기 순서, HWPX 선 없는 칸 판정, 공문서 굵은 항목부호를 개선하고 표 글자 배정·공문서 폭 계산을 최적화합니다. OCR 모델 다운로드 중단 후 남은 임시파일도 안전하게 정리합니다(#109, #111).

### v4.17.1
- DOCX 과학 문서: 인라인 수식 제자리 (#104) · Symbol 기호 °·×·μ (#105) · `\langle` 띄어쓰기·수식 번호 `\tag` (#106) · `w:dir`·`w:bdo` 안 글 (#107) · `images: false` 면 그림 파트를 100MB 상한에 안 셈 (#108)

### v4.17.0
- 원본에서 **보이는 모습대로**: 테두리 없는 틀 표는 글로, 선이 보이는 부분만 표로, 칸으로 조립한 분수는 `$\frac{…}{…}$` (`layoutTables`, 기본 visual · `--keep-layout-tables` 로 종전 구조). 법령 별표 보이는 표 346개 일치: HWP 72 → 346, PDF 66 → 335
- PDF 쪽 넘김 표: 쪼개진 행·안 이어지던 조각·그림 섞인 표·초대형 표(151×76) 복원
- 점선(채움) 탭 뒤 글이 잘리던 것 수정 (HWPX·HWP5·HWP3, HWPML 탭)
- `kordoc patch` 편집본은 `--keep-layout-tables` 로 뽑는다(기본 출력 편집본은 방법을 알려 거절)

전체 이력은 [CHANGELOG.md](CHANGELOG.md).

---

## 만든 사람

대한민국 지방공무원. 광진구청에서 7년간 HWP 파일과 싸우다가 이걸 만들었습니다. 5개 공공 프로젝트에서 수천 건의 실제 관공서 문서를 파싱하며 검증했습니다.

## 라이선스

[MIT](./LICENSE). 이 프로젝트는 아래 오픈소스를 포함합니다:

- **rhwp** (MIT, edwardkim) — HWP5 배포용 복호화·lenient CFB 파싱 알고리즘, `templates/` 의 기안문 서식
- **claw-hwp** (MIT, DoHyun468) — OOXML chartSpace 조립, 도장 부유 배치 메트릭, secure-fill 포맷엔진, validate 검사셋
- **OpenDataLoader PDF** (Apache 2.0, Hancom Inc.) — PDF 표 감지 알고리즘
- **hml-equation-parser** (Apache 2.0, Open Bapul) — HML 수식 파싱
- **PaddleOCR** (Apache 2.0, PaddlePaddle) — 텍스트 OCR 엔진 파생 (PP-OCRv5 korean)
- **Pix2Text** (MIT, breezedeus) — 수식 OCR(MFD/MFR) 알고리즘 포팅. 모델은 런타임 다운로드이며 재배포하지 않습니다 — MFD 가중치의 기반인 Ultralytics YOLOv8 은 AGPL-3.0 이므로 수식 OCR 에 의존하는 상용·비공개 제품은 해당 조건을 별도 확인하세요
- **cfb** (Apache 2.0, SheetJS) — HWP5 OLE2 컨테이너 파싱
- **pdfjs-dist** (Apache 2.0, Mozilla) — PDF 텍스트 추출
- **JSZip** (MIT, Stuart Knightley 외) — ZIP 기반 포맷 파싱

전체 고지는 [NOTICE](./NOTICE), 라이선스 전문은 `THIRD_PARTY/` — 둘 다 npm 배포 패키지에 포함됩니다.
