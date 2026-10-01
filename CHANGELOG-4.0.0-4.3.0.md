# Changelog archive

[Current releases](CHANGELOG.md)

## [4.3.0] - 2026-07-29

프로덕션 전면 리뷰 기반 대규모 정비 — 정부 표준 기안문 서식 내장(누름틀 채우기), 빈 문단
보존 옵션(#57), 기능 버그 7건, rhwp 렌더 정합 포팅, 성능 2건(최대 637배), 중복 통합
(수식·번호·XML 헬퍼), MCP 전면 비동기화, 발행 게이트 복원.

### Added

- **🏛️ 정부 표준 기안문 서식 내장 + 누름틀 채우기**: 「행정 효율과 협업 촉진에 관한 규정
  시행규칙」 별지 제1호(일반기안문, 누름틀 23곳)·제2호(간이기안문, 13곳) 서식을
  `templates/`로 번들 — `kordoc fill --template gian|gian-simple`, `--list-templates`,
  MCP `fill_form`의 `template` 파라미터로 파일 경로 없이 사용. 신설 누름틀 경로
  (`fieldBegin type="CLICK_HERE"` name 정확 일치 → splice 치환, 서식/charPr 보존,
  `\n`→`<hp:lineBreak/>`)는 안내문을 비교조차 하지 않아 안내문=실값 충돌 침묵 유실이
  구조적으로 불가능. 누름틀 우선 매칭 후 남은 키는 기존 라벨 매칭과 공존.
  서식 자산은 rhwp(MIT) 결정적 생성본 — `THIRD_PARTY/rhwp-forms.txt` 어트리뷰션.
- **빈 문단 보존 옵션 (#57)**: `keepEmptyParagraphs` / CLI `--keep-empty-paragraphs` /
  MCP `keep_empty_paragraphs` — 본문은 `text:""` paragraph 블록, 표 셀은 빈 줄로 순서
  보존해 "원문 문단 수 = 줄 수" 대응 유지 (행 줄맞춤 서식 문서용). 기본 off(현행 유지,
  #47 전례). 개체만 있는 문단은 대상 아님. (@jumaniac 제보)
- **MCP `parse_document` 파싱 옵션 5종 노출** (CLI 파리티): `ocr:"force"`,
  `remove_header_footer`, `formula_ocr`, `dedupe_running_headers`,
  `keep_trailing_empty_cols`.
- **hwpml 중첩표 구조 보존**: HWPML 셀 안 중첩표를 평탄화 텍스트가 아닌
  `IRCell.blocks`(hwpx table-build 계약)로 보존.
- **합성 성능 벤치 `bench/perf-synth.mjs`** — 대형 입력(조각 2만·적층 표 50)에서
  클러스터/괘선 표 경로 실측.

### Fixed

- **에러 계약 7건 (전면 리뷰)**: ① HWPX DRM이 메시지 순서 탓에 `ENCRYPTED`로
  오분류되던 것 → `DRM_PROTECTED` ② 암호화 XLS가 `success:true`+빈 markdown으로
  실패를 숨기던 것 → `ENCRYPTED` 실패 ③ HWP3 암호화·압축 해제·HWPML 크기 초과·sharp
  미설치 진단 메시지가 plain Error라 "문서 처리 중 오류"로 뭉개지던 것 → KordocError
  보존 (+`optional dependency`→`MISSING_DEPENDENCY` 분류) ④ MCP `parse_pages`만
  `filePath` 누락 — 배포용 HWP COM 폴백 불발 ⑤ MCP `detect_format`/`parse_metadata`의
  OLE2 세분화 누락 — `.xls`를 `hwp`로 오판·시그니처 에러 ⑥ `parse_metadata`에
  xls/image case 부재 — 무음 `undefined` ⑦ 최상위 `pageCount`가 image 외 전 포맷에서
  미전파 — MCP "페이지: N" 표시 사문화.
- **TAC 인라인 표 outMargin 가로 배선 (rhwp #3396 포팅)**: 글자취급 인라인 표의 가로
  전진폭에 outMargin 좌/우가 빠져 우정렬 host 문단 등이 시프트되던 결함 — 전진·배치·
  줄폭 4개소 배선. 코퍼스 60건 스윕: 결재란 보유 20건 정당 시프트(델타=om값 정확 일치),
  나머지 40건 바이트 동일.
- **OcrProvider mime 계약**: 이미지 직접 입력이 jpeg/webp를 넘기는데 타입은
  `"image/png"` 리터럴만 선언 — union으로 확장.

### Changed

- **CLI `render` reflow 기본 켬** (`--no-reflow`로 끔) — MCP `render_document`와 정합.
  조판 캐시 있는 문서는 종전과 동일(reflow 무시), 캐시 없는 생성본이 이제 CLI에서도
  기본 렌더됨.
- **수식 변환기 통합 (274→91줄)**: hwp5 독자 엔진을 hwpx 정본(`hmlToLatex`)에 위임 —
  같은 수식이 포맷에 따라 다른 LaTeX가 나오던 갈림 해소. `matrix{A # B # C}`의 `#`를
  열 구분으로 오역하던 것을 EqEdit 스펙대로 행 구분(`\\`)으로 수정.
- **번호 서식 엔진 통합**: `src/shared/numbering.ts` 신설 — hwp5 원숫자 20자 컷을
  gongmun 기준(㉑~㊿ 50한도)으로 통일. XML DOM 헬퍼도 `src/shared/xml.ts`로 승격해
  hwpml·docx 복제 3벌 제거.
- **MCP 핸들러 전면 비동기 I/O**: readFileSync/writeFileSync 등 ~35개소를
  `fs/promises`로 — 장수 stdio 프로세스가 수십 MB 문서 I/O 중 멈추던 블로킹 제거.
- **발행 게이트 복원**: `prepublishOnly` = sync-meta 드리프트 검사 + typecheck + test +
  build + `bench/gate-if-corpus.mjs`(코퍼스 부재 기기는 bench만 SKIP) — 코퍼스 없는
  기기에서 상시 FAIL → `--ignore-scripts` 우회 관행을 제거. 코퍼스 의존 e2e 테스트도
  모수 하한(170) 미달 시 suite 단위 skip. CI에 `tsc --noEmit` 타입체크 추가 (종전엔
  cli.ts·mcp.ts 본문이 어디서도 타입체크되지 않았다). `scripts/sync-meta.mjs`로
  plugin.json 버전·engine-spec SSOT 자동 동기화.

### Performance

- **ole-surgeon 섹터 할당 O(n²) 제거**: 512B마다 `Buffer.concat` 전체 복사 → 기하급수
  capacity — +4MB 스트림 삽입 1,967ms→3.1ms (**637배**), 출력 바이트 동일.
- **PDF 괘선 표 `buildVertices` 버킷화**: 수평×수직 전수 이중루프 → y-대역 버킷 —
  대형 적층 표 99→73ms, 스냅샷 해시 동일.

### 검증

테스트 1,349 pass / 0 fail (신규: 누름틀 11·빈 문단 5·TAC outMargin 3·LIKE 등),
typecheck 클린, build 성공. TAC 배선 코퍼스 60건 스윕 무회귀. 이번 릴리스부터
`npm publish`가 우회 플래그 없이 게이트 전 구간을 통과한다.

## [4.2.9] - 2026-07-26

HWP3 파서 rhwp 최신판(v0.8.0) 정합 4종 — 날짜 필드 desync·차례 표식 오염·유령 음절·예약 코드.

### Fixed

- **날짜 형식(ch=7)·날짜 코드(ch=8) 스트림 소비 (rhwp #2844)**: 두 코드를 6바이트짜리 simple
  control로 처리해, 실제 구조(spec §10.3 표 37 = 84바이트, §10.4 표 38 = 96바이트) 대비
  76/88바이트를 덜 소비하던 문제 — 날짜 필드 뒤 문단 전체가 desync로 오염됐다. 8바이트 헤더
  경로로 옮기고 나머지를 소비한다. 공문서는 날짜가 거의 항상 들어가 실피해가 컸다.
- **제목/표/그림 차례 표식(ch=25) 잉여 하이픈 (rhwp #2765)**: 하이픈(ch=24)과 같은 항목이라
  차례 표식마다 본문에 `-`가 삽입되던 문제. spec §10.19 표 60의 비가시 표식이므로 글리프를
  방출하지 않는다(바이트·hchar 소비량은 동일 유지). 하이픈(24)은 종전대로 `-`.
- **조합형 무효 종성 인덱스 (rhwp #2924)**: 예약/무효 종성 인덱스(0·18·30·31)를 '받침 없음'
  으로 치환해 원문에 없던 완성형 음절을 조용히 합성하던 문제. 무효면 한자/기호 lookup →
  `JOHAB_UNMAPPED` 경로로 넘긴다. 받침 없음(인덱스 1)·정상 받침은 무회귀.
- **ch=12는 '선'이 아니라 예약 코드 (spec 표 31)**: 선(ch=14)의 info 84바이트를 12에도 적용해
  84바이트를 과소비하던 문제. 표 31상 12는 예약이고 선은 14다. 8바이트 헤더만 소비한다.
- **SVG 렌더의 XML 1.0 비허용 제어문자 (rhwp #3382 동종)**: `render/svg-render.ts`의
  `escapeXml`이 `& < > "`만 처리해 C0 제어문자(0x00-0x08·0x0B·0x0C·0x0E-0x1F)를 그대로
  방출하던 문제 — 산출 SVG가 불법 XML이 되어 브라우저·뷰어가 그 페이지 렌더를 통째로
  중단한다("PCDATA invalid Char value"). 생성기(`gen-ids.escapeXml`)·왕복
  (`source-map.escapeXmlText`)이 이미 쓰던 필터 계약을 렌더 경로에도 맞췄다. 탭·개행·복귀는
  XML 1.0 허용 문자라 유지. 테스트를 위해 `escapeXml`을 export한다.

### 검증

테스트 1,333(신규 12 — 5종 전부 수정 전 실패 확인, 대조군 ch=24·ch=14·정상 받침·탭/개행
보존·마크업 이스케이프 무회귀), 게이트 roundtrip·formats·fuzz(crash 0·hang 0)·pdf-table
PASS. score는 코퍼스 구본(85/347) 모수 하한으로 baseline과 동일 FAIL, verify-reflow는
`bench/corpus/seoul` 부재로 미실행.

## [4.2.8] - 2026-07-25

캡션 안 표를 셀(`IRCell.blocks`)과 같은 구조 계약으로 제공 (#55).

### Added

- **캡션 구조 보존 `IRTable.captionBlocks` (#55)**: v4.0.6(#46)에서 캡션 안 중첩표를
  `caption` 문자열 평탄화로 살렸지만, 같은 문서에서 셀 안 표는 구조(`IRCell.blocks`)로
  그려지는데 캡션 안 표만 문자열로 남는 IR 비대칭이 있었다 — 구조 대조 검증에서 캡션
  쪽만 제외해야 했다. 이제 캡션에 표가 있으면 `captionBlocks`에 문단·표 블록을 원문
  순서대로 함께 싣는다. `IRCell.blocks`와 같은 계약(구조는 blocks, `text`/`caption`은
  하위 호환용 평탄화)이라 breaking 없음 — 표가 없는 평문 캡션은 종전대로 문자열만
  제공하고(무게 억제), 마크다운 출력·왕복 경로는 무변경. (@jumaniac 제안)

## [4.2.7] - 2026-07-22

빈 표 셀 채우기 시 공백만 있던 원문 문자가 조용히 사라지던 문제 수정 (#54).

### Fixed

- **빈 셀 공백 보존 (#54)**: `applyCellEdit`로 IR상 빈 표 셀에 값을 채울 때, 그 셀
  문단의 원문 텍스트 노드가 XML 공백만 포함하면 `buildParagraphSplices`가 그 공백
  `hp:t`를 통째 교체 대상으로 삼아 제거하던 문제 — 요청한 삽입 경계 밖의 원문(공백
  문자)이 patch 성공 보고와 함께 소실됐다. 이제 raw t-도메인이 공백만일 때는 t 맨 앞에
  zero-length 삽입(`buildRangeSplices`)으로 값을 넣어 기존 공백을 뒤에 보존하고, 삽입
  경계를 유일하게 정할 수 없으면(엔티티/내부 태그로 t-좌표 불일치) 성공 대신 skip한다
  (fail-closed). 비-공백 셀 교체·빈 t·자기닫힘 t/run 삽입 경로는 무회귀. (@Raphael-KR 제보)

## [4.2.6] - 2026-07-22

개조식·보고서 공문서 본문의 양쪽정렬을 왼쪽정렬로 — 항목 줄 어절 간격 벌어짐 수정.

### Fixed

- **개조식·보고서 본문 왼쪽정렬 (□/○/-)**: 개조식(gaejosik)·보고서(report) numbering의
  본문 리스트 문단을 양쪽정렬(JUSTIFY)에서 왼쪽정렬(LEFT)로 변경. 어절유지(BREAK_WORD)와
  양쪽정렬이 겹치면 짧게 끊긴 항목 줄(예: 다음 어절이 길어 조기 개행된 25자 줄을 34자
  폭으로 확장)의 어절 간격이 정상 대비 ~2.8배로 벌어져 "깨진 듯" 보이던 문제. 행정업무
  운영편람 개조식 예시가 왼쪽정렬인 근거와도 일치. 기안문(standard numbering, official
  등)의 서술형 본문은 종전 양쪽정렬 유지. 코퍼스 게이트(recall 1.0·실렌더 59/59·reflow
  100%) 무회귀.

## [4.2.5] - 2026-07-22

4.2.4 인라인 표 순서 수정의 후속(#52, @jumaniac 제보) — 평탄화 구분자 시각 충실도.

### Fixed

- **글자취급 표 경계 평탄화 구분자 (#52 후속)**: 4.2.4가 `IRCell.text` 평탄화 순서를
  바로잡으면서 글자취급(`treatAsChar="1"`) 표 경계까지 `\n`으로 분리해, 원문에서 앞뒤
  텍스트와 같은 줄에 놓이는 인라인 표가 두 줄로 평탄화되던 것 수정(`"▦∼▦ 연락처 :"`가
  4.2.4에서 `"▦∼\n▦ 연락처 :"`로 갈라지던 회귀). 글자취급 표·인라인 텍스트 경계는
  공백으로 잇고, 블록·float 표와 문단 경계는 종전대로 `\n`. 순서·블록 구조는 불변
  (#49/#50/#53 회귀 없음, 인라인 흐름 상태를 `lineOpen`으로 추적).

## [4.2.4] - 2026-07-21

4.2.3 인라인 표 순서 회차의 후속 결함 2건(#52·#53, @jumaniac 제보) 수정 —
같은 회차에서 놓친 셀 텍스트 평탄화 순서와 인라인 표 공존 시 float 표 추월 퇴행.

### Fixed

- **`IRCell.text` 평탄화 문서 순서 (#52)**: 셀 한 run에 표·텍스트가 혼재할 때 문단
  텍스트를 통째로 `cell.text`에 선(先)append해 중첩표 평탄화 텍스트가 그 뒤에 붙어
  순서가 역전되던 것 수정 — `cell.blocks`는 정상이나 `text`만 `types.ts`의 "text =
  blocks의 평탄화" 계약을 위반했다. 선append를 제거하고 각 세그먼트를 표와 교대로
  나온 자리에 이어붙인다.
- **인라인 표 공존 시 float 표의 텍스트 추월 (#53, 퇴행)**: 같은 문단에 인라인 표가
  있으면 float 표가 앞선 텍스트를 추월하던 4.2.0→4.2.3 퇴행 수정. `walkParagraphChildren`가
  텍스트 조각 방출을 인라인 표에만 하던 것을 모든 표 직전으로 확장한다(잔여 세그먼트
  없으면 no-op이라 float 다수여도 안전). 자기참조 벤치 GT(`hwpx-ref`)도 동일 모델로 동기화.

## [4.2.3] - 2026-07-19

인라인 표 순서 보존 회차 — 한 문단·한 셀 안에서 글자취급(treatAsChar) 표와 텍스트가
번갈아 놓일 때 순서가 역전되던 결함 2건(#49·#50, @jumaniac 제보) 수정.

### Fixed

- **최상위 `blocks` 문서 순서 (#50)**: 한 문단 안에서 인라인 표 뒤에 오는 텍스트가
  표보다 앞 블록으로 나오던 역전 수정. `walkSection`이 문단 텍스트를 통째로 먼저
  push하던 것을, 표 경계 마커(`\x1E`)로 분할해 표 직전마다 해당 조각을 방출하도록
  변경. float·페이지 앵커 표는 텍스트 흐름 불참(reflow 개체 흐름 모델과 동일 구분) —
  종전대로 텍스트 뒤에 방출한다. `ParseSuccess.blocks`의 문서 순서 보존을 타입
  계약으로 명문화.
- **`IRCell.blocks` 셀 안 교대 배치 (#49)**: 셀 안에서 `[표] 텍스트 [표] 텍스트`가
  하나의 문단으로 병합되어 맨 앞으로 이동하던 것 수정 — 서식 기간 입력란
  (`[날짜] 부터 [날짜] 까지`)의 시작/끝 구분이 살아난다. 생성기(`generateHtmlTableXml`)도
  셀 텍스트 전량 선방출을 원문 배치 순서 방출로 바꿔 라운드트립 대칭 확보. 평탄화
  `IRCell.text`도 문서 순서를 따른다.
- **벤치 순서 GT 정합**: 자기참조 XML GT(`hwpx-ref`)의 순서 모델을 파서와 동일한
  인라인 분할 방출로 갱신 — 코퍼스 347문서 orderAvg 1.0 (구 모델 대비 결재문서류
  5건의 실제 읽기 순서 오류가 드러나 함께 해소).

## [4.2.2] - 2026-07-19

rhwp 최신판 정합 회차 — 원저장소(edwardkim/rhwp)의 1만 건 실문서 서베이·실측 패치에서
파서 스코프에 해당하는 2건을 이식.

### Added

- **취소선 추출 (HWP5·HWPX)**: 법령 개정문 등의 삭제 표시를 `~~취소선~~` 마크다운으로
  방출. 판정은 취소선 **모양** whitelist — 한컴은 취소선 없는 문자에도 취소선 비트를
  기본값 1로 저장하므로 비트만 믿으면 본문 전체가 취소선이 된다 (rhwp 0a967e0d/#154
  실측). HWP5 는 shape id(bit 26-29) ≤12, HWPX 는 `<hh:strikeout shape>` 의 OWPML
  LineSym2 13종만 인정, 미지 값은 fail-closed. HWPX 는 run-span 채널로 부분 취소선까지,
  HWP5 는 대표(최빈) 스타일 기준 문단 단위. (PDF 경로의 취소선 감지는 종전부터 지원)

### Changed

- **ZIP 해제 한도 100→256MB**: rhwp 서베이에서 `section1.xml` 단독 75.2MB(압축비
  35:1)인 정상 문서가 실재 확인됨 (rhwp #1917) — 종전 100MB 총합 컷이 대형 실문서를
  ZIP bomb 으로 오인 거부하던 것을 상향.

## [4.2.1] - 2026-07-19

이미지 직접 입력 회차 — PNG/JPG/WebP 를 PDF 래핑 없이 바로 변환하고,
스캔/이미지의 표 괘선을 픽셀에서 직접 감지해 병합셀 표를 복원한다.

### Added

- **이미지(PNG/JPG/WebP) 직접 입력**: `kordoc 서식.png` / `parse(buffer)` /
  MCP `parse_document` — 매직바이트 감지(`fileType: "image"`) 후 내장 OCR 을
  자동 적용 (텍스트층이 없으므로 플래그 불필요). 디코딩은 optional dependency
  `sharp`, 사용자 OcrProvider 도 종전 계약대로 위임. `src/ocr/image-ocr.ts` 신규.
- **래스터 괘선 감지 (`src/ocr/ruling-lines.ts`)**: OCR 경로가 그래픽 ops 없이
  클러스터 감지만 타서 병합 라벨 셀 + 다중줄 서술형 서식(정부 제출 서식류)의
  표가 무너지던 것을, 페이지 픽셀 이진화+런렝스로 수평/수직 괘선을 직접 찾아
  선 기반 표 파이프라인(table-grid)에 공급하는 방식으로 해결 — rowspan/colspan
  이 살아있는 표로 복원. 오탐 방어 3겹: 최소 길이 20pt·두께 상한 2.5pt(굵은
  글리프 획 차단)·양측 잉크 포위 제외(색상바 내 흰 글자 틈새).
  `extractPageBlocksWithLines` 에 `extraLines` 옵션 파라미터 추가 (기존 PDF
  경로 무변경).

## [4.2.0] - 2026-07-17

내장 텍스트 OCR 회차 — 스캔/이미지 PDF를 API 키 없이 로컬 추론으로 읽는다.
+ rhwp 업스트림 정합 3종 + 수식 OCR off-by-one 등 리뷰 확정 결함 수리.

### Added

- **내장 텍스트 OCR (PP-OCRv5 korean)**: `parse(buffer, { ocr: true })` /
  CLI `--ocr`·`--ocr-force` / MCP `parse_document.ocr` — det(DBNet)+rec(SVTR/CTC)
  ONNX 를 onnxruntime-node 로 로컬 추론. 모델 ~18MB(det 4.6+rec 12.8+사전)는
  첫 사용 시 PaddlePaddle 공식 HF 리포에서 자동 다운로드+SHA-256 검증
  (`~/.cache/kordoc/models/ppocr/`, Apache-2.0). 한국어 사전 11,945자(완성형
  한글 11,172 음절 전량). `src/ocr/engine.ts`·`models.ts`·`pdf-ocr.ts` 신규,
  `kordoc check-ocr-models` 커맨드 추가. 실측: 보도자료 스캔 1페이지 0.9s(M-series
  CPU), 본문 conf 0.95+.
  - **페이지 단위 정밀 적용**: 품질 신호(`needsOcr` — low_text·high_pua·
    garbled_hangul 등)가 가리키는 페이지만 OCR 하고 정상 페이지 파싱 결과는
    유지. 문서 전체가 이미지 기반이면 전 페이지. `"force"` 는 무조건 전 페이지.
  - **스캔본 표 복원**: OCR 라인 박스를 PDF 포인트 좌표로 환산해 기존 블록
    파이프라인(xy-cut 읽기 순서 + 클러스터 표 감지)에 태움 — 담당부서 표 등이
    HTML 표로 복원된다.
  - 기존 `OcrProvider` 콜백 계약은 유지 (외부 OCR 연동).

### Fixed

- **OCR 실행 판정과 품질 신호 분리 (리뷰 F1~F3)**: 종전에는 문서 평균 10자/페이지
  미만일 때만 OCR 이 걸려 — ToUnicode 가 깨진(PUA·garbled_hangul) PDF 는 프로바이더가
  있어도 호출되지 않았고, 혼합 문서(텍스트+스캔)의 스캔 페이지는 무음 손실,
  진입 시 정상 페이지까지 통째로 OCR 결과로 대체됐다. 페이지 단위 선정·병합으로 전면 재설계.
- **OCR 페이지 실패의 본문 오염 (F6/F7)**: 실패 마커("[OCR 실패: 페이지 N]")가
  성공 마크다운으로 반환돼 RAG 청킹·redact·diff 에 유입되던 것 — 실패는
  `OCR_FAILED` 경고 채널로, 환경 오류(의존성·모델 미설치)는 원인 메시지를 보존해
  NEEDS_OCR 폴백. 텍스트 OCR 렌더를 pdfjs+node-canvas(미등재 의존성, F5)에서
  **pdfium+sharp**(기존 optional 의존성)로 교체 — `src/ocr/provider.ts` 제거.
- **수식 OCR 페이지 off-by-one**: `@hyzyla/pdfium` 의 `page.number` 는 **0-based
  pageIndex** 인데 1-based pdfjs 블록·pageFilter 와 그대로 대조 — `--pages` 필터가
  한 페이지 밀리고 수식이 이전 페이지 블록에 붙던 잠복 결함. 텍스트 OCR 계약
  테스트로 함께 잠금.
- **`qualitySummary` OCR 후 자기모순 (F14)**: OCR 적용 페이지가 여전히
  `needsOcr`/`ocrCandidatePages` 로 보고되던 것 — `PageQuality.ocrApplied` 신설,
  적용 페이지는 후보에서 제외.
- **XLSX/XLS `keepTrailingEmptyCols` 배선 누락 (#47 후속)**: 옵션이 두 포맷에만
  전달되지 않아 XLSX/XLS 양식의 빈 입력란 열 보존이 무음 무시되던 것.
- **HWP3 rhwp 업스트림 정합 3종** (원저장소 후속 패치 반영):
  - 탭(ch=9)은 8 byte 구조(hchar+탭폭+점끌기+닫기) — 2 byte 만 소비해 탭마다
    6 byte 씩 어긋나 이후 텍스트가 오염되던 것 (rhwp d89b689 #929).
  - ch=5(필드코드)·ch=6(책갈피) 스트림 소비 — 미소비 시 desync 로 이후 문단 전체
    오염 (rhwp dcf64b4 #877, 업스트림 실측 77→1058 문단 복구).
  - 사적 graphic char(0x0080~0x7FFF) 매핑 — 로마숫자 Ⅰ~Ⅹ("Ⅰ. 사업개요"),
    원문자 ①~⑩, 좌우 큰따옴표, 화살표, □ 글머리 등이 통째로 증발하던 것.
    kordoc 은 한컴 표시값을 직접 방출 (PUA 는 builder 가 제거하므로).
    U+F03C5→□ 는 HWP5 공용 PUA 맵에도 추가.

## [4.1.0] - 2026-07-17

프로덕션 전면 리뷰 회차 — 5축 병렬 감사(HWPX·PDF·바이너리·인터페이스·주변 모듈)로
확정 결함 ~80건 수정 + 신기능 3종(render_document·redact·chunks) + #47.

### Added

- **`render_document` MCP 도구**: HWPX를 조판 그대로 PNG 이미지(MCP image
  content)/SVG로 렌더 — 생성·패치·양식 채움 결과를 AI가 눈으로 검증하고 다시
  고치는 루프가 MCP 안에서 닫힌다. 한컴본은 조판 캐시, 생성본은 reflow.
  `src/render/rasterize.ts` 신규 (sharp optional, 1400px/8000px/4MB 자동 스케일).
- **`kordoc redact` CLI + `redact_document` MCP 도구**: 개인정보(주민번호·전화·
  이메일·카드·계좌 기본, 여권·운전면허 opt-in) 탐지 + 서식 보존 마스킹.
  HWPX/HWP는 patch로 원본 서식 1바이트 보존, 리포트에 원본 PII 미포함(`masked`만).
  생년월일·Luhn 검증으로 오탐 축소, base64 이미지 라인 제외. `src/redact.ts` 신규.
- **`--format chunks` CLI + `parse_chunks` MCP 도구**: RAG용 구조 청크 JSON —
  헤딩·개조식 위계(□○- / 1.·가.·1))를 breadcrumb 경로로, 표는 독립 청크로.
  자르기 정책(토큰 상한·오버랩)은 소비자 몫. `src/chunks.ts` 신규.
- **XLSX/XLS 날짜 셀 변환**: numFmt(내장 14-22·45-47 + 커스텀 y/m/d/h) 감지로
  날짜 시리얼("45306")을 ISO("2024-01-15")로. date1904·1900 윤년 버그 보정.
- CLI `fill`에 `--formats`·`--require-unique`·`--mask` (MCP fill_form 파리티).

### Fixed

- **#47 표 오른쪽 끝 빈 열 삭제 — 서식 입력란 소실**: `ParseOptions.
  keepTrailingEmptyCols` 신설(CLI `--keep-empty-cols`) — 켜면 실제 셀 앵커가 있는
  빈 입력란 열을 보존하고 앵커 없는 유령 열(span 인플레이션)만 트림한다. **양식
  경로(parse_form·fill_form·CLI fill)는 내부 상시 ON**이라 fill이 인식하는 입력란이
  --dry-run 필드 목록에도 그대로 나타난다. 기본 파싱은 종전 트림 유지(마크다운
  가독성 — 실코퍼스에서 앵커 있는 빈 후행 열이 흔해 기본 보존은 표 구조 대량 변경).
- **P0**: 인라인 수식 정규식 ReDoS(악성 `$\\\\…` 로 파서 행) · HTML 표
  colspan/rowspan 무클램프(생성기 OOM) · HWP3 압축 해제 폭탄 무가드 ·
  XLSX 셀 ref 행/병합 범위 무클램프(그리드 폭주).
- **P1 파서 정합성**: 표-전용 PDF의 이미지 기반 오판(OCR 켜면 정상 표 폐기) ·
  PDF 셀 미매핑 텍스트 무음 소멸 · HWP5 제어문자 0x18/0x1e/0x1f 매핑 스왑 ·
  DOCX 변경추적 삽입(w:ins) 전량 소실 · XLS SST CONTINUE 경계 인덱스 밀림 ·
  XLSX r 속성 부재 행 무음 드롭 · 도형 대체텍스트 정규식의 본문 오삭제 ·
  `| - | - |` 데이터 행 소실 · GFM 셀 `\|` 왕복 붕괴 · 미종결 `<table>`이 문서
  잔여 흡수 · OMML frac 다중그룹 오판.
- **P1 form**: 헤더행 표 라벨 셀 덮어쓰기 · 인라인 복합 라벨("신청인 성명"/
  "대리인 성명") 붕괴 · splice 실패 시 배열 값 무음 소실 · 역방향 접두사 임계
  상향(0.6→0.75).
- **보안·안정성**: MCP 쓰기 경로(output_path 7곳·image_path·profile_path) 검증
  신설 · HWP5 patch 삭제 텍스트 섹터 잔존(remanence) 제로화 · watch 동시 폭주
  무음 유실(대기 큐) · fs.watch error 핸들러 · webhook DNS 재검증 · XML 불법
  제어문자 스트립 · lenient CFB 할당 증폭 캡.
- **성능**: PDF vertex 병합 O(V²)→버킷(62,500 vertex 3.1s→0.2s) · XLS SST 선형
  스캔 제거 · diff 길이비 프리필터 · SVG 중첩표 측정 메모이즈 · 이미지 인라인
  단일 패스.
- README fillForm 예제 API 불일치(따라 하면 크래시) · `parse(buffer.buffer)`
  풀 오염 패턴 · MCP 응답 200k 상한 · MCP·watch `.xls`/`.hml` 지원 · MCP DRM
  COM fallback filePath 전달 · parse_metadata 헤더 스니핑 512B(HWP3/HWPML 감지).

## [4.0.8] - 2026-07-16

4포맷 이미지 무음 유실 근본수정 — 코퍼스 447파일 전수 실측으로 PDF(추출 자체
미구현)·HWPX(11장)·HWP5(1장)·DOCX(1장) 유실을 각각 해소. HWPX/HWP5 스윕 후
코퍼스 이미지 복구율 686/686·92/92 (100%).

### Added

- **PDF 이미지 바이트 추출** (`src/pdf/image-extract.ts` 신규): 종전에는 이미지
  *영역 좌표*만 계산하고(정보손실 경고용) 바이너리는 전량 유실. 이미지 XObject를
  pdfjs 디코딩 픽셀(RGB/RGBA/1bpp)로 받아 순수 JS PNG 인코딩(`transcode.ts`
  `encodePng` 재사용) 후 페이지 말미 위치에 `![image](...)` 참조로 방출한다.
  코퍼스 52 PDF 중 이미지 보유 45파일에서 731장 추출 확인.
  - **비동기 디코딩 대기**: pdfjs는 `getOperatorList()` resolve 후에도 워커에서
    이미지 디코딩이 진행되므로(`buildPaintImageXObject`는 await 안 함) 동기
    `objs.has()`로는 다수를 놓친다(실측 551→731장). 콜백형 `objs.get()`으로
    완료를 기다린다(5초 안전망, 디코딩 실패는 pdfjs가 null resolve).
  - 페이지 경계 표 병합(`mergeCrossPageTables`) 인접성을 깨지 않도록 image
    블록은 병합 후 주입(`injectPageImageBlocks`). 장식 조각(<8px)·페이지 간
    동일 내용(로고·워터마크) dedupe, 문서당 200장/128MB 상한.

### Fixed

- **HWPX 본문 미도달 BinData 이미지 유실** (`src/hwpx/images.ts`): 꼬리말/머리말
  안 `hp:pic`(보도자료 로고·사진 스트립), header.xml `borderFill`의 `hc:imgBrush`
  (결재문서 셀 배경 이미지) 등 본문 워크가 닿지 않는 BinData가 전량 유실되던 것.
  전체 파싱 시 미참조 BinData 이미지를 문서 끝 image 블록으로 스윕 보강한다
  (확장자/매직바이트로 이미지만, OLE 등 비이미지 제외, `pages` 부분 파싱 시 제외).
- **HWP5 미참조 BinData 이미지 유실** (`src/hwp5/images.ts`): pic 컨트롤이
  참조하지 않는 BinData 이미지(image 블록 0개인 문서 포함)를 같은 방식으로 스윕.
- **DOCX w:object v:imagedata 유실** (`src/docx/parser.ts`): OLE 개체 미리보기
  등 `w:object` 안 `<v:imagedata r:id>` 이미지가 blip 전용 수집에서 빠지던 것.
  mc:Fallback 밖 imagedata를 이미지 맵·본문 인라인 방출에 포함한다 (Fallback 안
  사본은 Choice blip과 중복이므로 종전대로 제외).
- **PDF images 결과 누락** (`src/index.ts`): `parsePdf`가 내부 결과의 `images`를
  구조분해에서 빠뜨려 API 결과에 이미지가 실리지 않던 것.
- **`PageQuality.ocrReason` 타입 정합** (`src/types.ts`): v4.0.7이 추가한
  `garbled_hangul`이 공개 타입 union에 빠져 `tsc --noEmit`이 실패하던 것.

## [4.0.7] - 2026-07-15

DOCX 하이퍼링크·이미지 무음 유실 근본수정 + PDF 오매핑 mojibake 감지. 외부
품질 평가에서 지적된 3건(PDF 깨진 한글 무경고 통과, DOCX 하이퍼링크 176→21
손실, 이미지 추출되나 본문 링크 누락)을 각각 해소.

### Fixed

- **DOCX 하이퍼링크 대량 손실** (`src/docx/parser.ts`): 문단당 `href` 단일
  스칼라가 루프에서 덮어써져 한 문단에 링크가 여러 개여도 마지막 1개만(그것도
  문단 전체를 감싸) 남던 구조를 제거. `collectInline`이 문단 자식을 문서 순서로
  순회해 링크마다 인라인 `[text](url)`를 생성한다. 또 `w:fldSimple` / `w:fldChar`
  begin·separate·end + `w:instrText` **필드코드 HYPERLINK**(워드·구글독스·한글
  익스포트가 흔히 쓰는 방식 — 종전 전량 유실)와 `w:anchor` 내부 링크(`[text](#anchor)`)
  처리를 추가. HWP5/HWPX 파서와 동작 정합.
- **DOCX 이미지 본문 링크 누락** (`src/docx/parser.ts`): 이미지 바이너리는
  추출·저장되나 `extractImages`가 만든 image 블록이 본문 배열에 병합되지 않고
  폐기돼 markdown에 `![image](...)` 참조가 하나도 안 들어가던 것. `buildImageMap`
  (embed 단위 파일 dedup) + `emitParagraphImages`로 본문 워크 중 문단 위치에
  image 블록을 인라인 방출(문서 순서 보존). 표 셀 등 놓친 이미지는 문서 끝에
  참조를 보강.
- **PDF 오매핑 mojibake 무경고 통과** (`src/pdf/quality.ts`): ToUnicode가 잘못
  매핑돼 글리프가 PUA/FFFD가 아니라 정상 한글 음절 영역의 엉뚱한 글자로 떨어지는
  케이스("GPU쭒컫 많핂슪")를 종전 품질 게이트(PUA/제어/대체문자)가 못 잡던 것.
  종성(받침) 분포를 신호로 추가 — 자연 한국어(받침없음 다수·겹받침 희소) vs CID
  스크램블(받침 균등)을 받침없음<0.15 AND 희귀받침≥0.25 두 조건으로 판정(사전
  불필요·오탐 방지), `garbled_hangul` 사유로 페이지별 `NEEDS_OCR` 경고 방출.
- **bench 경로 이식성** (`bench/*.mjs`): `new URL('.', import.meta.url).pathname`이
  Windows에서 `/D:/...`를 반환해 `join` 시 `D:\D:\...`로 크래시하던 것을
  `fileURLToPath`로 교정(score·roundtrip·pdf-table-gt·formats-sweep·fuzz-sweep).
- **배포 메타 버전 동기화**: `plugins/kordoc/.claude-plugin/plugin.json`이 4.0.5로
  뒤처져 release-metadata 테스트가 실패하던 것 정합.

## [4.0.6] - 2026-07-12

무음 유실 2건 근본수정 — PDF 무괘선 밴드 표 파편화(예산서 부서명 유실) +
HWPX 캡션 안 중첩표 텍스트 유실(#46 실파일 재현 확정분).

### Fixed

- **PDF 무괘선 요약행 밴드 표 파편화** (`src/pdf/vertical-bridge.ts` 신규):
  세출예산 사업명세서류 표는 재원구분(시/구) 요약행 밴드에 수직 괘선을 긋지
  않아 동일 열 수직선이 위/아래로 끊기고, Union-Find 그룹 파편화로 헤더행·
  부서/정책 요약행이 그리드에서 탈락 → 부서명이 열 순서 뒤바뀐 추측성 클러스터
  표로 유실되던 것(광진구 2026 세출예산 전량 실측: 637곳). 끊긴 수직선 쌍을
  4중 가드(간격 5~120pt·간격 내 수평선 실존·같은 밴드 3열+ 동시 단절·수평선
  끝점-내부 열 경계 정합)로 브리지해 한 그리드로 복원 — 별개 적층 표·표 사이
  전폭 구분선은 가드에서 탈락. 합성 세그먼트는 이웃 세그먼트 전체를 덮어
  cell-extract 단일 세그먼트 75% 커버 판정을 통과(로직 무변경). GT 6쌍 지표
  기준선과 소수점 동일(오발동 0), 부수 개선: ice-arc-2026 +1,135자·캡션
  오흡수 102→85·표 내 페이지번호 행 92→82.
- **HWPX 캡션 안 중첩표 텍스트 통유실 (#46)**: `hp:caption > subList > p >
  run > hp:tbl` 구조(별지 제9호 서식 실측 — 위치 TOP/BOTTOM 무관)에서 캡션의
  표 앞 텍스트만 남고 표 내용이 통째로 사라지던 것(304자 중 297자 유실).
  `collectSubListText`가 문단 내 최상위 tbl을 수집해 표 평탄화 규칙(셀 `" / "`
  구분·행별 줄바꿈)으로 문서 순서 그대로 이어붙임 — 머리말/꼬리말 내 표도
  동일하게 유실 대신 보존. 회귀: 캡션 중첩표 TOP/BOTTOM·앞뒤 문단 순서 3건 +
  PDF 브리지 5건 추가 (테스트 1,034). 제보·최소 재현파일 제공 [@jumaniac](https://github.com/jumaniac),
  회귀 테스트 설계 조언 [@hiSandog](https://github.com/hiSandog) — 감사합니다.

## [4.0.5] - 2026-07-12

v4.0.4 플랜 이월 🟡 3건 마감 — 인라인 강조 채널의 외래·gongmun 일반화 +
gongmun 리스트 depth 왕복. 생성 경로 무변경(npm 4.0.4 대비 대표 10케이스
ZIP 실파일 60개 바이트 동일 확증 — 시각 오라클 렌더 등가). 게이트: 테스트
1,019 / bench:gate 전 체인 / HWPX 코퍼스 전 지표 baseline 동일(recall 1.0).

### Added

- **외래 한컴 문서 볼드/이탤릭 일반화**: kordoc 메타 없는 HWPX도 charPr
  실속성(`<hh:bold/>`·`<hh:italic/>`)으로 인라인 강조를 복원해 `**`·`*` 마커
  재방출. 한컴이 편집 이력 경계에서 같은 서식 run을 임의 분할하는 것에 대비해
  인접 동일 서식 span을 병합(`**안****녕**` 오염 방지). 자사 id 규약(코드 id4·
  인용 paraPr6)은 외래에 미적용. 셀은 혼합 가드(무서식+서식 span 공존 시만) —
  헤더행·라벨열의 전체 볼드는 구조 서식이라 마커 억제.
  채점기 선행 검증: mdToPlain이 bare 별표(=마커, escapeGfm이 리터럴을 전부
  이스케이프)를 제거하되 HTML 병합표 라인(이스케이프 없는 경로, 중첩표 후행
  포함)은 제외 — 결재문서 리터럴 별표 마스킹 훼손 없이 recall 조각화 차단.
- **gongmun 레이아웃 인라인 강조 왕복**: run-span 채널을 kordoc-layout
  "gongmun"까지 확장 (기본 charPr 0~10 블록은 default와 동일 — id4 code·
  paraPr6 인용 유효). 혼합 가드로 구조 볼드(비실측 report 1단계 □ 전체
  CHAR_BOLD, 표 헤더행)와 인라인 강조를 구분 — 부호 run이 무서식이라 진짜
  인라인 강조는 항상 혼합이 된다.
- **IRBlock.indent 소비 — gongmun 리스트 depth 왕복** (`IRBlock.listDepth`):
  md 리스트 문법과 충돌하는 부호('`- `'·'`1) `')는 재생성 시 md 파서가
  list_item으로 선점해 리터럴 부호 재분류가 못 받고 depth0으로 붕괴('1)'→'2.',
  '-'→□ 승격 + 후속 형제 순번 오염). paraPr 들여쓰기를 run 글자크기(=levelIndent
  단위, 개조식 반계단 역산 포함)로 역산해 blocksToMarkdown이 2칸/단계 선행
  공백을 방출 — 기안문·보고서·개조식 2차 왕복 고정점 검증. 알려진 한계:
  'ㆍ'(depth3~7 공용 부호)·부호생략 문단의 4단계+ 구분은 글리프 재분류 상한
  (depth3)에 수렴, '`* `' 부호(press)는 escapeGfm 얽힘으로 이월.

## [4.0.4] - 2026-07-12

v4.0.3 이후 미발행 작업 3회분을 단일 릴리스로 통합(npm 연속 버전 유지) —
① 프로덕션 하드닝(44개 부채 인벤토리), ② 잔여 부채 마감(T1~T5),
③ 잔여 타겟 최대목표 소진(R1~R4). 게이트: 테스트 1,012 / bench:gate 전 체인 /
시각 오라클 14종 해밍0.

### ③ 잔여 타겟 소진 — R1~R4 (2026-07-12)

#### Added

- **reflow Phase 3 — 개체 세로 흐름 모델** (R2): float(treatAsChar=0,
  TOP_AND_BOTTOM, PARA 앵커) 개체는 텍스트를 `vertOffset+outTop+개체높이+outBottom`
  아래로 밀고(두문 결재표 실측 140+16653+852=17645 정확 일치), PAGE/PAPER 앵커·
  BEHIND/IN_FRONT_OF_TEXT는 본문 흐름 불참(페이지 하단 직인이 커서를 밀던 것 제거),
  inline(treatAsChar=1) 표는 실효높이+줄 leading 전진. 빈 문단(개체 전용 포함)은
  run charPrIDRef로 pitch 산출(종전 DEFAULT_CHAR 1000 → 본문 1300 실측 정합).
  **혼합 캐시 문서 지원**: 한컴 저장본을 프로그램 편집해 일부 문단만 캐시가 없는
  파일도 reflow 옵션이면 진입 — 캐시 문단의 한컴 좌표(vertpos+textheight+spacing)로
  커서를 이어받아 캐시 없는 문단이 흐름 위치에 붙는다(종전 페이지 상단 0에 겹침).
  reflow 자기일관성 **58/59 → 59/59**(36264961 전 문단 d=0), 게이트 플로어 95→**100%**.
- **서식 프로필 스키마 0.3.0** (R1): ①`fontName_hangul` 폰트명 왕복 — 추출이
  fontfaces에서 이름을 함께 담고, 생성이 header fontface에 append+리맵(HANGUL·LATIN
  id 3+/실측 프리셋 8+)해 원본 글꼴 목록 없이 글꼴 재현. 순번 폴딩(PROFILE_FONT_MAX)은
  이름 없는 구버전 프로필의 dangling 방지로만 잔존. ②`anchor_row` 첫 행 전체
  지문(셀 경계 '|' 보존, 셀별 24자 정규화) — (0,0) 빈 셀 크로스탭의 동형 쌍둥이 표를
  순번 폴백 대신 지문으로 매칭. ③행0이 전부 병합인 표의 col_widths 소실 수정 —
  어느 행이든 span-1 셀로 확정 + 잔여 열은 병합 폭 균등 분배. ④profile-io zod 강화 —
  border type(HWPX LineType2 열거)·width("N.NN mm")·color(#RRGGBB|none) 손편집 오타를
  한컴 로드 전 거부.
- **공문서 옵션 표면 SSOT** (R3, 인벤토리 영역1-1): `gongmun-surface.ts` —
  CLI(cli.ts)·MCP(mcp.ts)가 각자 복붙하던 GongmunOptions 조립을 buildGongmunOptions
  하나로, 값 집합(열거·중첩 키 목록·수치 범위)을 상수로 통일해 zod shape를 파생.
  리팩터 전후 CLI 산출물 **10케이스 바이트 동일**(ZIP 엔트리 해시) 검증. MCP preset
  enum을 PRESET_ALIAS 파생으로 바꿔 누락 별칭 6종(시행문·공문·공문서·계획·알림·안내)
  회복.
- **IRBlock.indent 관찰 슬롯** (R4): 파서가 paraPr `<hh:margin>` 자식요소형
  hc:left(+양수 hc:intent)를 읽어 문단 들여쓰기(HWPUNIT)를 IR에 노출 — gongmun
  리스트 depth 재유도·양식 분석 원료. 마크다운 방출은 불변(점수 무영향).
- **셀 인라인 강조 왕복** (R4): run-span 채널(v4.0.6 최상위 한정)을 GFM 셀 문단으로
  확장 — 파서가 셀 블록에 span을 달고(table-build가 span 문단 blocks 운반),
  GFM 방출이 `**`·`*`·`` ` `` 마커를 재방출, generateRuns가 되읽는다.
- **시각 오라클 14종**: `heading-levels` 신규 — default(비공문서) 모드 h1~h4
  OUTLINE 방출의 한컴 실렌더 확증. 개요번호("1.", "1.1.") 미강제 실측(미정의
  numbering idRef=0 참조) — gongmun과 달리 명명 스타일 이전 불필요 판정.
- computeColWidths 불변식 property test — 결정적 LCG 500케이스에서
  합=totalWidth·전 열 양의 정수 잠금.

#### Fixed

- **원문자 폴백 파서 정합** (R4): 생성기 circledNumber 51+·circledHangul 15+가
  순환(mod)하던 것을 파서 자동번호 폴백(para-heading)과 같은 규칙(괄호수·가나다
  서수)으로 — 왕복 시 형제 순번 재유도 모호성 제거.
- **docFoot 구분선 컬럼폭 적응** (R4): '─'×46 고정이 좁은 커스텀 여백에서 두 줄로
  꺾이던 것을 컬럼폭 비례로(기본 여백 175mm에서 46자 불변 — 기존 산출물 무변경).
- **HTML 중첩표 높이 재사용** (R4): 호스트 셀 높이 추정이 행수×cellH 근사라 중첩
  셀이 접히면(긴 텍스트 wrap) 과소하던 것을 재귀가 확정한 hp:sz 실높이로.

#### 정책 결정

- **joinSoftBreaks 보류**: md-runs의 "라인=문단"이 계약 — 공문서는 짧은 개조식
  라인이 지배적이라 소프트랩 조인이 오히려 위험, 3표면 옵션 신설 비용 대비 수요
  없음. 필요 시 재론.

### ② 잔여 부채 마감 — T1~T5 (PDF 표 구조·reflow 폰트·인라인 강조 왕복·표면 파리티·수식)

#### Added

- **인라인 강조 run-span 왕복 채널** (T3): 생성 content.hpf에 `generator`/`kordoc-layout`
  opf 메타를 심고, 파서가 자사 생성 default 레이아웃 파일에서 볼드·이탤릭·인라인 코드
  run과 인용 문단(paraPr 6)을 마크다운 마커(`**` `*` `` ` `` `> `)로 복원 — IR에
  optional `spans`(IRSpan[])·`quote` 추가, blocksToMarkdown이 재방출. 외래 문서는 메타
  부재로 채널이 꺼져 오검출 없음(회귀테스트). fixture basic fwd 0.525→**1.0** ·
  law 0.943→1.0 · corpus fwd/bwd micro 0.9998→**1.0**. 시각 13종 해밍0(메타 무해 실측).
- **서식 프로필 표면 노출** (#41, T4): `kordoc profile <ref.hwpx> -o prof.json` 서브커맨드
  + `generate --profile` 플래그 + MCP `extract_profile` 도구·`generate_document`
  `profile_path` 파라미터 — 라이브러리 전용이던 간판 기능을 3경로 파리티로. FormatProfile
  zod 경계 검증 1벌 공유(profile-io.ts) — 손편집 오타 JSON을 위치·사유와 함께 거부.
- **프리셋 비호환 옵션 경고** (T4): `incompatibleGongmunWarnings` — docHead/docFoot(비
  기안문)·noticeHead(비통지)·press(비보도자료)·표지목차(보도자료)·sizes(비실측 프리셋)·
  suppressSingle(비standard 번호 체계)의 조용한 폐기를 CLI stderr·MCP 응답 경고로 노출.
- **reflow 고정폭 글꼴 폭 테이블** (T2): `faceClass`('hcr'|'fixedPitch') — 굴림체·돋움체·
  바탕체·궁서체 문단을 한글 1.0em/ASCII 0.5em으로 측정(종전 함초롬 0.97em 근사가 줄당
  1~2자 과대적재로 wrap 어긋남). head-styles가 charPr fontRef→글꼴명 해석, reflow가 지배
  charPr 힌트 전달 — 힌트 없으면 현행 테이블(생성 경로 불변). 자기일관성 55/59→**58/59**
  (게이트 플로어 90→95% 상향). 잔여 1건 = 대형 표 페이지 분할(Phase 3) known limitation.
- **PDF 적층 표 분리** (T1): 경계 수평선 하나를 공유한 별개 표 두 개(채용공고 머리
  스트립+응시원서 본표)를 Union-Find가 프랑켄 그리드로 묶던 것을 컷 라인 판정(전폭
  수평선 + 관통 논리 수직선 0 + 양쪽 독립 수직선 + 내부 x-집합 비겹침)으로 절단.
  관통 판정은 체인 뷰(맞닿은 세그먼트=논리 수직선) — 외곽선을 섹션별 세그먼트로 그린
  단일 표(nrich 지원서)는 절단하지 않음. 분리 밴드는 vertex를 자기 선으로 재계산(공유
  경계선 위 교차점이 반대편 표의 수직선 x를 나르던 열 오염 제거). cellExact
  0.6977→**0.7279** · NED 0.5237→0.5308. 잔여 비-exact는 GT 표현 차(투명 테두리 행·
  중첩 평탄화·유령 좁은 열)로 재확인 — bench/pdf-table-gt.mjs 11차 헤더 기록.
- **수식 COMMAND_MAP 역인덱스 충전** (T5): 읽기맵(CONVERT_MAP) 단일 명령 ~60개(\div
  \approx \therefore \because \oplus \uparrow \propto \cong \equiv \sim \angle \mapsto
  \ll \gg \dagger \models 등)를 자동 역매핑 — '맨 알파벳' 누출 0(전수 회귀 잠금). 미지원
  명령은 리터럴 따옴표 보호(가시화·\text 되읽기 안정), EqEdit 함수 키워드(sin·cos·log 등
  27개)는 identity 통과. `cases`/`vmatrix` 환경 EqEdit 네이티브 토큰 고정점 +
  `Bmatrix`/`align` 계열 렌더·내용 보존.

#### Fixed

- **CLI parseKv**: 값의 '=' 보존(첫 '='만 분리), '=' 없는 조각(쉼표로 잘린 값 꼬리)
  무증상 드랍 → stderr 경고 — `--doc-head "title=상반기 계획, 주요사업"`의 값 유실이
  조용히 지나가던 것 봉합.
- **MCP generate_document 드리프트**: `line_spacing` 파라미터·`sizes.bodyTitle` 키가
  CLI에만 있고 MCP에 없던 것 봉합.
- **MCP detect_format**: 16바이트 헤더 판정이 XLSX/DOCX를 'hwpx'로 오보 — 내부 구조
  세분화로 parse_metadata와 판정 일치.
- **CLI seal 숫자 플래그**: `--occurrence -1` 통과·`--dx/--dy` 비숫자 NaN→0 무증상
  강제를 엄격 검증으로 (MCP zod 동등).
- **hwpx styles bold/italic**: charPr 자식 요소(`<hh:bold/>`)도 감지 — 실측 한컴 HWPX는
  요소만 쓰는데 속성형(bold="1")만 읽던 것 (구버전 HWPML 잔재는 계속 인정).

#### 벤치 (전 게이트 PASS + 시각 13/13 해밍0, 테스트 978→994)

| 지표 | 전 | 후 |
|---|---|---|
| roundtrip fwd / bwd (corpus micro) | 0.999816 / 0.999908 | **1 / 1** |
| roundtrip fixture basic fwd | 0.525 | **1** |
| pdf-table cellExact / contentNED | 0.697712 / 0.523722 | **0.727941** / 0.530784 |
| reflow 자기일관성 | 55/59 (93%) | **58/59 (98%)** |

무후퇴 플로어 상향: roundtrip fwd 0.999→0.9995 · bwd 0.998→0.9995 · tableExact
0.72→0.85, pdf-table cellExact 0.69→0.72 · NED 0.52→0.525, reflow 90%→95%.

### ① 프로덕션 하드닝 (구조부채·correctness·왕복 충실도·파서 정밀도)

44개 잔여 기술부채 인벤토리(6영역 병렬 발굴) 기반 하드닝. P0 구조부채 3건은
리팩터 전후 산출물 SHA-256 대조(14조합 매트릭스)로 바이트 무변경 검증.

#### Added

- **id 파티션 불변식** (P0-1): charPr/paraPr/borderFill 방출 직전 "중복·구멍 없는
  연속 id" 런타임 검증 — 카운트 상수 드리프트가 무음 폰트오염 대신 즉시 에러.
  `GJ_CHAR_COUNT`·`charVariantBase`·`staticBfEnd` 수기 산술을 명명 상수·실방출
  목록 파생으로 교체. 회귀: 12조합 id 연속·itemCnt·dangling 0 테스트.
- **geometry.ts SSOT** (P0-3): A4 크기·mm→HWPUNIT·본문폭(계산 48189 vs 실측
  48180 구분 보존)·표 id 네임스페이스(1000/9.1M/9.2M/9.3M/9.4M) 중앙화.
- **두 자리 부호 내어쓰기 변형 paraPr** (P1-1): '10.'·'10)'·'(10)' 항목에
  (depth, 부호폭) 전용 paraPr(id 34~)를 문서별 발급 — 둘째 줄이 내용 첫 글자에
  정렬 (종전 ~0.55타 왼쪽 어긋남). 두 자리 항목 없으면 미발급(기존 산출물 불변).
- **왕복 채널** (P2): 장식표 제목 셀 `name="__kordoc_h1~6"` 마커 — 개조식
  표지·장헤더·1페이지형 제목박스가 재파싱 시 heading으로 복원, 목차·제목반복
  파생물은 스킵(중복 제거). 리터럴 부호 문단('가.'·'1)'·'□')의 list_item 재분류로
  2차 생성 시 8단계 자동 재번호. hr('─' 구분선) → separator 역매핑.
- **이미지 placeholder 방출** (gen-image.ts): `![alt](url)`·`<img>`를 1×1
  placeholder 바이너리(BinData) + 실측 미러 `<hp:pic>`로 방출 — 이미지 참조·표
  구조가 왕복 보존 (종전 alt 텍스트 각인은 이미지 열 붕괴 원인). GFM 셀·HTML
  병합 셀·단독 문단 3경로.

#### Fixed

- **ragged HTML 행 격자구멍** (P1-2): colCnt보다 짧은 `<tr>`(rowspan 미커버)의
  미점유 좌표를 빈 tc로 충전 — malformed 표(행 폭합 ≠ tblW) 방지.
- **중첩표 containment**: 4000 하한이 좁은 부모 셀폭을 넘으면 상한(셀폭−마진)에
  양보 — 셀 경계 침범 제거. 시각 baseline seal-nested 재박제(의도 기하 변경).
- **개조식 장식표 outMargin 절대임계(48000) 제거**: 컬럼폭(bodyWidth) 기준 판정 —
  커스텀 여백(예: 좌우 35mm)에서 본문폭급 표의 우측 여백 침범(GAP-01 재현) 수정.
- **목차·장헤더 번호 SSOT**: 표지 제외 h1+h2 단일 배열을 목차와 본문 로마
  장헤더가 공유 — 2×h1 문서에서 번호 +1 밀림 수정.
- **computeColWidths 합 불변식**: 음수 잔여(반올림 상향) 회수 루프 추가, 잔여
  분배 시 80% 캡 존중 — `sum == totalWidth` 상시 보장.
- **'끝.' 표시 단어경계**: 마침표 동반 독립 토큰만 기존 끝표시로 인정("…성황리에
  끝" 오인 제거) + 중복 판정을 마지막 렌더 블록 기준으로(말미 표 뒤 누락 수정).
- **h2 box '□' idempotency**: stripChapterNumber가 말머리 문자(□·○·ㅇ·-·ㆍ)도
  제거 — 반복 재생성 시 '□ □ 제목' 단조 누적 수정.
- **빈 번호 문단 카운터 드리프트**: 파서가 텍스트 없는 번호 문단도 카운터를
  진행(한글 실동작 일치) — 이후 항목 번호 1씩 낮게 재현되던 결함 수정.
- **서수 시퀀스 단일화**: 파서 자동번호(가나다·원문자)가 생성기 gongmun.ts
  시퀀스를 재사용 — 15번째+ 형제 mod-14 순환 어긋남 수정.
- **마크다운 파싱 정밀화** (md-runs): 리스트 중첩 depth를 들여쓰기 스택으로
  산출(탭·4칸 입력이 8단계 위계를 깨뜨리던 결함), GFM 전부-빈 행을 데이터 행으로
  보존, 연속 `>` 인용 개행 조인(개조식 ※ 쪼개짐 방지·줄 경계 보존), `_`/`__`
  강조 단어내부 비활성(snake_case·던더 오염 방지).
- **벤치 채점기 귀속 오류 3건** (bench/): Pass 3 앵커를 콘텐츠 보유 유닛으로
  한정, 중복 등장 텍스트 문서순 배정(Pass 1.5), 자동번호 phantom 관용 —
  recallMicro 0.999985→1, recallDoc 워스트 0.99359→1, phantom 0.000056→0.000003
  (347건 재채점 악화 0).

#### Changed

- `blocksToSectionXml` 갓함수(~420줄) 분리 (P0-2): SectionOpener("첫 run이
  secPr/colPr를 나른다" 계약 단일점, 종전 6회 복붙)·buildPreamble·블록타입별
  render* 핸들러로 분해 — 산출물 바이트 동일(해시 대조).
- `precomputeGongmunList` 반환이 `GongmunListPlan`(items + indentVariants)으로.

#### 시각 오라클 확대 (P6 — 8종 → 13종, 전부 해밍0)

- 신규 실렌더 baseline 5종: **gaejosik-cover**(표지 투톤 바·제목·날짜·기관명),
  **gaejosik-body**(장헤더 Ⅰ~Ⅲ + □○-ㆍ 4단계 + ※ + 데이터 표 밀집),
  **gaejosik-margins35**(커스텀 여백 35mm — outMargin 수정 실렌더 검증),
  **official-docframe**(결재란+두문+결문 조합), **press-full**(머리박스+부제+담당 표).
  종전에는 gongmun 프리셋 중 report 1종만 실렌더 커버.

#### 벤치 (전 게이트 PASS + 시각 13/13 해밍0)

| 지표 | 전 | 후 |
|---|---|---|
| recallMicro / recallDoc 워스트 | 0.999985 / 0.99359 | **1 / 1** |
| phantom | 0.000056 | 0.000003 |
| roundtrip fwd / bwd | 0.999632 / 0.99915 | 0.999816 / 0.999908 |
| roundtrip tableExact | 0.727848 | **0.879747** |
| roundtrip cellExact | 0.994702 | 0.995344 |

## [4.0.3] - 2026-07-11

프로덕션 하드닝 릴리스 — v4.0.0~4.0.2 변경분 전체에 대한 2중 프로덕션 리뷰
(6페이즈 하드닝 + 8앵글 리뷰·검증 패스)에서 확정된 결함을 수정. v4 계열 첫 npm 발행.

### Changed (프리셋 기본값 — 기존 산출물 기하 변경)

- **기안문(official) 본문 기본 15pt → 12pt**: 서울 정보소통광장 실결재 104건 중 64건
  지배값. 종전 크기가 필요하면 `--pt 15`(`body_pt: 15`).
- **계획서(plan) 항목부호 기본 `1. 가. 1)` → `□ → ㅇ → *`**: 실측 추진계획안 계층.
  법정 번호가 필요하면 `numbering: 'standard'` 명시 (suppressSingle도 standard 전용).
- 계획서 2단계 부호 기본 `○` → `ㅇ`.

### Added

- **입력 검증 방어선**: `bodyPt`·`lineSpacing`·`margins`·`sizes`·`autoFit.minRatio`의
  NaN/무한대/비정상 범위와 7개 이상 `approval` 라벨을 라이브러리·CLI·MCP 공통으로
  명시적 오류 처리 — 잘못된 입력이 XML `NaN` 기하로 번지지 않음.
- **비개조식 표지·목차**: `cover`/`toc`를 기안문·통지·회의록 등 전 프리셋에서 지원
  (보도자료 제외 — 머리박스 서식과 양립 불가라 명시적으로 무시).
- 폰트명 XML 특수문자(`&` `"` `<`) 이스케이프 — 임의 폰트명으로 XML이 깨지지 않음.
- 배포 메타데이터 회귀 가드 테스트(package/lock/plugin 버전 정합).

### Fixed

- **본문 폰트 유실**: 비실측 프리셋에 표지·목차를 켜면 `--font gothic`·`fonts.body`
  지정이 무시되고 함초롬바탕으로 렌더되던 결함 (본문 charPr·docframe 두 경로 모두).
- **헤딩 위계 역전**: 본문 13pt 이하에서 `####`(h4)가 `###`(h3)보다 크게 렌더되던
  결함 — h4를 h3 이하로 캡.
- **표 캡션**: 표 셀 안 도형·개체의 캡션이 바깥 표 캡션으로 오귀속되던 결함 + 캡션이
  보존되는데도 "미지원 제어 요소의 텍스트 손실" 거짓 경고가 쌓이던 결함. ctrl 래핑
  표 캡션은 보존(#46 후속).
- **결재란 라벨 줄간격**: 1pt 바 스페이서용 paraPr(70%)를 재사용해 긴 라벨 줄바꿈 시
  줄이 겹치던 것을 실측 결재선과 같은 전용 100% paraPr(33)로 분리.
- 여러 줄 셀·중첩표를 담은 HTML 표의 `hp:sz` 높이가 확장된 행 높이 합과 일치(타 뷰어
  잘림 방지), 382HU 제목박스 바의 1pt 전용 스페이서, `bodyTitleBox` 단독 지정 시
  표 폰트가 바뀌던 부작용 제거, 보도자료에서 표지·제목·부제가 충돌해 부제가 유실되던
  조합 차단.
- xmldom 0.9.10·markdown-it 14.3.0 범프 — 프로덕션 의존성 감사 취약점 0건.

## [4.0.2] - 2026-07-11

실측 벤치마킹 릴리스 — 부처별 양식 3종 + 실물 8종 + 서울 정보소통광장 실결재 기안문
60건(계획·보고·공고) 전수 디코드 분포를 근거로 괴리 17건 전수 목록화(GAP-01~17), 9건 반영.
전 프리셋 한글 COM 실렌더 → PDF 벡터 좌표 실측으로 조판영역 초과 0건 게이트 통과.

### Fixed

- **조판영역 우측 침범 근본수정 (GAP-01)**: 생성 문서에 단 컬럼 정의(`<hp:colPr>`)가 없어
  한글이 컬럼 영역을 좌우 10mm(2835HU)씩 좁게 잡던 결함 — 본문 텍스트는 우측 여백에
  10mm 미달하고, 컬럼보다 넓은 treatAsChar 표(제목박스 +10mm·데이터표 +3.6mm·목차박스
  +5mm)는 우측 여백을 침범했다(실무자 보고 재현). secPr 뒤 같은 run에 colPr 방출로 수정 —
  COM 실렌더 실측: 본문 190.0mm 정합, 전 프리셋 초과 0. 표지·본문 제목박스(48180)는
  outMargin 좌우 0(실물 t2와 동일 — 283이면 진행폭이 컬럼을 넘어 1mm 침범)
- **report/plan 리스트 문단 위 간격 실측값 (GAP-05)**: 1단계 □만 body×0.5(750)이던 것을
  실측 저장값 □3000/○2000/-1200/ㆍ600(t2 「2_보고서 양식」 paraPr)으로 — 개조식과 동일
  스케일. □ 항목 `keepWithNext`도 report로 확장
- **기안문 여백 실결재 지배값 (GAP-10)**: 편람 공식 20/10/20/20 → 실결재 지배값
  **20/15/20/15**(정보소통광장 60건 중 41건). 보고서·계획서·통지·보도자료는 실측 상하
  15mm(GAEJOSIK_MARGINS), 통지·보도자료 머리말·꼬리말 10mm. `margins`로 공식값 지정 가능

### Fixed — 실무자 눈 QA 반려 4건

- **단일 형제 부호 생략 기본 off**: 편람 규정(형제 없는 단독 항목은 부호 생략)을 기본
  적용하던 것을 `suppressSingle` 옵트인으로 — "말머리 빠지면 열 위치가 맛간 것처럼
  보인다"(실무자, 실무 관행 > 규정). 부호 생략 항목이 depth 공용 paraPr의 음수 내어쓰기를
  물려받아 둘째 줄이 있지도 않은 부호 폭만큼 더 들어가던 유령 내어쓰기도 전용 plain
  paraPr(25~32, 내어쓰기 0)로 수정
- **비실측 프리셋 표 셀 12pt**: 기안문·통지·회의록 표 셀이 본문 15pt를 그대로 써 서술
  열이 세로로 길어지던 것 → 실결재 지배값 12pt(굴림체 12·맑은고딕 11 실측)의 전용
  charPr 11·12 신설, 자동 장평 variant 기점 11→13 (실측 프리셋은 종전 GJ 22·23 유지)
- **표 열폭 배분 재작성**: 짧은 열이 글자 단위로 세로 쪼개지던 결함 — 열 하한 = 최장
  어절 폭(글자 단위 세로 분해 금지), 셀 실패딩 1200HU(tbl inMargin 510×2 — hasMargin=0이라
  cellMargin 무시) 기준으로 짧은 열부터 실폭 고정, 최장 서술 열만 유연
- **h2 `number` 시 리스트 위계 시프트**: 공고문에서 h2가 "1. 2." 부호를 차지하는데
  리스트도 1.부터 시작해 제목·본문에 동일 부호가 중복되던 규정 위반 — 리스트를 법정
  8단계 위계의 가.부터 시작 + 1자 들여쓰기(precomputeGongmunList depthOffset)

### Added

- **기안문 두문·결문 (GAP-02)**: 행안부 별지 제1호서식 — `docHead`(기관명 18pt bold
  중앙·수신·경유·제목 라벨 bold) / `docFoot`(발신명의 22pt 중앙·구분선·기안자/검토자/
  결재권자·협조자·시행/접수·주소·전화/전송/이메일/공개구분 9pt). CLI `--doc-head`/`--doc-foot`
- **보도자료 프리셋 `press`/`보도자료` (GAP-03)**: 국토부 실물(bodojaryo-reference) 실측 —
  머리박스("보도자료" 20pt bold + 보도시점/배포 10pt bold) + 제목 25pt bold 중앙 + 부제
  `- … -` + 본문 바탕 14pt □→ㅇ→\*(각주 12pt) + 담당 부서/담당자/연락처 표.
  `press` 옵션·CLI `--press-head`/`--press-sub`
- **업무보고 보고정보 행 (GAP-04)**: `reportInfo` — 최상단 우측 12pt "(보고일시, 보고자,
  연락처)" (실측 t3: 휴먼명조 12pt RIGHT). CLI `--report-info`
- **2단계 부호 ㅇ/○ 프리셋 분화 (GAP-06)**: 실결재 기안문 ㅇ 134 : ○ 5 실측 분포 —
  `bullet2` 옵션 신설, 기본값 통지·보도자료 `ㅇ`, 보고서 양식 계열 `○`. CLI `--bullet2`
- **공고문 두문·결문 (GAP-08)**: `noticeHead` — 공고번호(본문 위 bold 좌)·날짜(우측)·
  발신명의(우측 bold), h2 말머리 기본 `number`("1. 사업개요" — 바이오헬스 공고문 실측).
  CLI `--notice-head`
- **`*` 참고 항목 (GAP-15)**: 실측 프리셋에서 `*` 마커 리스트 항목 → ※ 참고 스타일
  (실결재·부처별 양식에서 참고를 `*`로 표기하는 관행이 ※보다 많음 — 부호 `*` 유지)
- MCP `generate_document`: `bullet2`/`doc_head`/`doc_foot`/`report_info`/`notice_head`/`press` 노출
- 측정 도구: `scripts/style-digest.mjs`가 `hp:switch` 안의 margin·lineSpacing도 읽음
  (전자결재 기안문 필수), `bench/collect-opengov.mjs` Windows 경로 수정

### 보류 (실측 근거 부족·갈림 — .claude/plans/gap-table-v4.1.md 기록)

- 내어쓰기 실측 광분산(GAP-07 — 현행 부호실폭 유지), 회의록 실측 부재(GAP-09),
  □ 부호 별도 run(GAP-12 — 표본 3:2), 기안문 개조식형 HY견고딕 17pt 스타일(GAP-14)

## [4.0.1] - 2026-07-11

v4.0.0 실무자(현직 공무원) 눈 QA 3건 수정 — 근거는 부처별 실측 양식 3종(업무보고·보고서×2)
전수 디코드 + 실무자 확인. 전 프리셋 한글 COM 실렌더 PDF 육안 게이트 통과.

### Fixed — QA 결함 3건

- **"정체모를 폰트" 제거 (QA-1)**: ① bold 시 HY견고딕/Arial Black 강제 치환(charPr 헬퍼)
  삭제 — 굵기는 `<hh:bold/>` 정본 요소만, 폰트는 항상 원 폰트 유지. ② 실측 폰트 세트를
  보고서·계획서 프리셋으로 확장(`usesReportFonts`) — 본문 휴먼명조, 제목·□ HY헤드라인M,
  ※ 한양중고딕 13pt, 표 셀 맑은 고딕 12pt, 제목박스 HY헤드라인M 22pt. `fonts` 4역할
  오버라이드도 보고서·계획서에 적용. 기안문·통지·회의록은 함초롬 유지(전자결재 관행)
- **h2 섹션 제목 말머리 (QA-2)**: OUTLINE 번호 제거(v4.0.0)의 대체 부재 수정 —
  `h2Marker` 옵션 신설: `box`(□ + 문단 위 2×본문 + 부호폭 내어쓰기, 실측 □ 대항목과 동일 —
  보고서·계획서 기본) / `number`(1. 2. 순번 재부여, 공고문 관행) / `none`. 선행 번호 자동
  제거 후 재부여. CLI `--h2-marker`, MCP `h2_marker`
- **개조식 소분류 부호 ― → 하이픈 `-` (QA-3)**: GT3 양식 저장값(U+2015)을 실무 관행으로
  교정 — 실무자 확인 + 부처별 양식 3종 중 2종이 하이픈. 내어쓰기 폭은 부호 실폭 연동이라 자동

### Added

- **공문서 표기법 검수 13룰** (`gongmun-lint.ts`, jkf87/hwpx-skill gonmun_lint 이식·보강):
  날짜(온점 뒤 공백·0패딩·2자리 연도·끝 마침표)·시간(24시각제·쌍점)·금액(천원·금 붙여쓰기)·
  붙임 쌍점·물결표+까지 중복·외국어 우선·쌍점 띄어쓰기. URL(`://`)·코드펜스 오탐 가드.
  공문서 모드 generate 시 경고 병기(생성은 진행) + `kordoc lint <file>`(error 시 exit 1) +
  `lintGongmunText`/`gongmunLintWarnings` 공개 API
- 보고서·계획서에서 ※ 문단/항목·blockquote → ※ 참고 스타일, 리스트 1단계 □ →
  HY헤드라인M 16pt (개조식과 동일 실측 위계)

## [4.0.0] - 2026-07-11

"완벽한 공문서 생산로직" 릴리스 — 실제 정부 공문서 16종(내부 실무문서 포함)을 요소 전수
디코드해 대조하고, 괴리 전수 목록(골격 20건·표 16건·방법론 9건)을 실측 근거로 메꿨다.
미발행 3.17.0(어절 줄나눔 역전 정정)을 포함한다. 전 산출물은 한글 COM 실렌더
무인 검증 체인(`bench/hangul-com-pdf.ps1`→`extract-pdf-lines.mjs`→`verify-junctions.mjs`) 통과.

### Added — 공문서 구조 요소 (전부 실측 근거)

- **쪽번호**: 하단 중앙 `- 1 -`(`pageNum BOTTOM_CENTER sideChar="-"`) + 표지·목차
  `pageHiding hidePageNum` 숨김 + 본문 첫 페이지 `newNum` 1 리셋 — 「2_보고서 양식」 원문
  그대로. 개조식·보고서·계획서 기본 켜짐, `pageNumbers` 옵션 (B9·G01·G14)
- **본문 첫 페이지 제목 반복 박스**: 표지 축소판 3×3 투톤 바 표(행높이 600/3566/600,
  HY헤드라인M 22pt) — 목차 뒤 새 페이지 선두. `bodyTitleBox` 옵션, 표지 켜진 개조식 기본 (B6·G02)
- **목차 장식 배너**: "목  차" 라벨이 1×7 스트라이프 표(#193AAA·#E0E5FA, 열폭
  [565,565,1414,13191,1414,565,565]) — 평문단 라벨 대체 (B7·G05)
- **결재란**: `approval: ["담당","팀장","과장"]` — 직위 라벨+서명 공란 2×N 표,
  문서 최상단 우측(외곽 0.4mm·내부 0.12mm) (B5·G03 간이형)
- **"끝." 표시**: 본문 끝 2타+"끝." 자동 (기안문 기본, `endMark` 옵션, 중복 방지) (B11·G18)
- **1페이지형 제목박스**: 보고서·계획서·통지 첫 h1 → 색상바(#0080C0)+제목+gradient
  (#0080C0→#3CBFFF RADIAL) 3단 표 (G04, GT2/GT6/GT7 실측)
- **`<right>` 태그**: 우측정렬 출처행(`<right>2026. 7. 11. 홍보담당관</right>`) (G19)
- **폰트 경고 (A2)**: `fonts` 오버라이드가 한컴 번들·통상 설치 목록에 없으면 경고
  (생성은 진행) — `unknownFontWarnings()` 공개 API, CLI stderr·MCP 결과 병기
- **CLI/MCP 옵션**: `--toc/--no-toc`·`--cover/--no-cover`(CLI toc 미전달 함정 수정),
  `--approval`, `--page-numbers`, `--end-mark`, `--no-body-title-box` + MCP 동등 파라미터
- **styleDigest 스크립트**: `scripts/style-digest.mjs` — HWPX 전수 요소 다이제스트
  (스타일 해석 완료 압축 JSON). 이번 전수 대조의 기반 도구 (B12 실용형)

### Changed — 표 완벽 재현 (실측 문법)

- **테두리 위계**: 외곽 0.4mm / 내부 0.12mm / 헤더행 하변 DOUBLE_SLIM 0.5mm 이중선 —
  셀 위치별 동적 borderFill 레지스트리(`gen-table-bf.ts`) (TBL-01·02)
- **헤더행 bold** + **라벨열**(2열 표 짧은 1열) #E7E7E7 음영·bold·CENTER (TBL-05·06)
- **셀 문단**: 헤더·짧은 열 CENTER 130%, 장문 열 LEFT 130% (기존 JUSTIFY 160% 대체) (TBL-11)
- **배치**: 데이터 표 본문폭 −1800 축폭 + 호스트 문단 우측정렬 (GT6/GT7/GT11 관행) (TBL-09)
- **열폭**: 짧은 열(수치·라벨) 실폭+12% 고정 — 긴 서술 열에 밀려 "4,673"이 꺾이는 협착 해소
- HTML 병합표 경로에도 동일 문법 적용 (병합 셀 스팬 기준 외곽/이중선 판정)

### Changed — 조판·기타

- **개조식 여백**: 상하 15mm + 머리말·꼬리말 영역 15mm (실측 GT1/GT3/GT9 공통.
  기존 20/10·0/0은 기안문 편람 값 — 기안문은 유지)
- **A3 기하 크기연동**: 장헤더 행높이·표지 제목칸·본문 제목박스·목차 배너가
  `sizes` 오버라이드에 비례 스케일 (기존 고정값)
- **□ 대항목 keepWithNext**: 쪽 하단 고아 표제 방지 (장헤더와 동일 관행)
- **hr**: 공문서 모드에서 간격 문단 (실측: 정부 문서에 문자 구분선 0건 — G17)
- **목차 페이지 조판**: 배너·박스 호스트 저줄간격 — 줄간격 160%가 표 줄높이에
  곱해져 배너와 박스가 페이지 분리되던 문제 해소 (실렌더 확인)

### Fixed

- **헤딩 개요 번호 노출 (선재 결함)**: 공문서 모드 헤딩(OUTLINE)이 한글에서
  "1. 제목"·"1.1. 제목"으로 렌더 — COM 실렌더로 최초 확인. OUTLINE 대신
  **명명 스타일("개요 1~4")**로 헤딩 의미 보존(파서에 스타일명 기반 헤딩 감지 추가,
  왕복 유지). `outlineShapeIDRef=0`·`numFormat=NONE` 실험 모두 무효 확인
- MCP `generate_document`에 자연어 프리셋 매핑·생성 전 확인 안내 명시 (오생성 방지)

### 내부

- charPr id 25(본문 제목박스) 추가 — 개조식 전용 15종(11~25), 장평 변형 26부터
- paraPr 재배치: RIGHT(17)·표 셀 CENTER/LEFT(18·19) 신설, 개조식 전용 20~24로 시프트
- borderFill: 개조식 3~9(+배너 스트라이프), 헤더 음영 10, 동적 레지스트리 11+
- 신규 모듈: `gen-table-bf.ts`(테두리 위계 레지스트리), `gen-gongmun-extra.ts`(결재란·
  끝표시·제목박스), `font-catalog.ts`(폰트 경고)
- 테스트 831 (신규 9: 쪽번호·제목박스·배너·결재란·끝표시·`<right>`·gradient·표 문법·기하연동)

