# Changelog archive

[Current releases](CHANGELOG.md)

## [3.18.1] - 2026-07-10

v3.17.0→v3.18.0 릴리스 범위 프로덕션 리뷰(적대 검증 에이전트 2기 + 실증 재현)에서 확인된
결함 수정. P1 3건은 전부 스크립트로 재현 후 수정했다.

### Fixed
- **서식 프로필 표 정합 붕괴 — 남의 서식이 엉뚱한 표에 무경고 적용 (P1)**: 추출기는 원본의
  모든 top-level `<hp:tbl>`을 세지만 parse 마크다운은 일부 표(1×1 제목박스, 머리말/꼬리말 표
  등)를 표로 방출하지 않아 순번(`table_index`) 매칭이 어긋났다 — 재현: `[1×1, 2×2 RED, 2×2
  GREEN]` 원본에서 재생성 시 두 번째 표에 RED 음영이 무경고 적용. 프로필에 첫 셀 정규화 앵커
  `anchor_text`(스키마 0.2.0)를 싣고, 소비는 **행·열 필수 + 앵커 일치 우선, 앵커 없으면
  순번 정확일치**로 전환 — 매칭 실패는 무서식(잘못된 서식보다 안전). 앵커 없는 손편집 sparse
  프로필(`table_index`로 특정 표 지정)의 기존 의미는 보존된다.
- **html_table 생성 실패 시 이후 표 프로필이 한 칸씩 시프트 (P1 연쇄)**: 표 순번을 생성
  성공이 아니라 **시도 기준**으로 세도록 변경 — 깨진 HTML 표가 문단 폴백돼도 뒤 표들의
  순번 매칭이 밀리지 않는다.
- **MCP `parse_document` 이미지 인라인 회귀 (P1)**: v3.18.0이 기본 인라인(base64, 4MB 상한)으로
  바꿨으나 MCP 텍스트 응답의 data URI는 모델이 이미지로 해석하지 못하고, 사진 1장(≈100KB →
  base64 133KB ≈ 34k 토큰)만으로 클라이언트 도구 응답 한도(Claude Code 기본 25k 토큰)를 넘겨
  호출이 깨졌다 — v3.17.0의 파일 참조(`image_NNN`) 방식으로 복원. 자체 완결형 마크다운이
  필요하면 CLI `--inline-images`를 사용.
- **병합/중첩 표 셀 이미지 유실 (P1)**: HWP5 표 셀 이미지는 `<img src="image_NNN.bmp">`(HTML
  표 경로)로 방출되는데 인라이너가 `![image](...)` 문법만 치환해, CLI `--inline-images`가
  이미지 저장을 생략하면서 표 셀 이미지만 dangling 참조로 유실 — `<img src>` 참조도 인라인.
  `--out-dir`의 `images/` 경로 접두사도 `<img src>`에 함께 적용(비인라인 모드 참조 깨짐 수정).
- **프로필 `fontRef_hangul` dangling IDREF (P2)**: 원본 fontfaces 순번(3 이상 흔함)을
  생성 header(HANGUL 3종, id 0~2)에 없는 id로 그대로 방출하던 것 — 범위 밖은 기본 글꼴(0)로.
- **BMP 픽셀 상한 64MP→36MP (P2)**: A4 전면 600dpi(≈35MP)는 허용하되, 헤더가 주장하는
  초대형 BMP가 rgba+raw 300MB+와 수 초의 `deflateSync` 동기 블로킹(MCP 서버 정지)을
  유발하지 않도록 축소. 초과분은 원본 바이트 폴백(기존 동작).

### Docs
- **v3.18.0 미기재 변경 소급 기재**: CLI `--inline-images`(HWP5 전용 base64 인라인,
  BMP→PNG 압축) / `--dedupe-headers`(HWP5 러닝 헤더 중복 제거 opt-in, 기본 off) 옵션 신설,
  레이아웃 표 해체 시 중첩 구조(`cell.blocks`) 보존으로 중첩표 유실 수정, 비-HWP5 포맷에서
  `--inline-images` 지정 시에도 이미지 저장 유지(유실 방지). `--inline-images` help 문구의
  "별도 파일 미저장"을 실동작(인라인된 경우만 미저장)으로 정정.
- format-profile-spec.md 0.2.0 현행화(`anchor_text`·매칭 규칙·fontRef 클램프).

### Notes
- 검증: npm test 842/842 (신규: 방출 누락 표 앵커 정합, 동형 쌍둥이 표 순서, html 실패
  무시프트, fontRef 클램프, `<img src>` 인라인).

## [3.18.0] - 2026-07-09

### Added
- **서식 프로필(format profile)**: 표의 위상(병합)뿐 아니라 **borderFill(테두리·음영)·열 실측폭·셀 글꼴**까지 원본 문서 없이 재현. `markdownToHwpx(md, { profile })`로 서식을 입히고, `hwpxToProfile(hwpx)`로 레퍼런스 hwpx에서 서식만 JSON으로 추출 — 원본 유출 없이 기관 서식만 공유·재현(이슈 #41, 스키마 `docs/format-profile-spec.md`). 표별 로컬 id를 문서 전역 id로 리맵해 `gongmun` preset과 병용해도 charPr id 충돌 없음. profile 미지정 시 출력 바이트 불변(하위호환). 스키마·문서 초안·비식별 예시 기여: @ai-localgov-officer (PR #42).

## [3.17.0] - 2026-07-06

### Added
- **렌더 per-run 폰트**: charPr fontRef(hangul) → head.xml fontfaces 글꼴명 → CSS font-family 스택을 `<text>`에 방출. 전 텍스트가 root 함초롬바탕(serif)으로 렌더돼 고딕 공문 제목이 바탕체로 나오던 것 해소.
- **다구역(multi-section) 렌더**: `renderHwpxToSvg`가 section0만 렌더하던 것을 전 구역 세로 스택으로 확장 — 표지+본문 다구역 문서가 첫 구역만 보이던 것이 전체 페이지로.
- **겹침 감지 도구**: `bench/reflow-overlap-check.mjs` — SVG 텍스트 bbox 쌍별 교차 검사로 결재란 등 중첩표 조판 회귀를 수치화.

### Fixed
- **결재란(전자결재 스탬프) 표 겹침(reflow)**: 실텍스트 0(인라인 개체만) 문단의 합성 lineseg textpos가 `chars.length`로 폴백돼 planLines의 plan.start가 개체 index를 넘고, advanceTo 가로 전진에서 개체가 전부 배제 — 라벨표·스탬프표가 같은 x에 포개 찍히던 것을 textpos 0으로 수정해 한컴과 동일하게 나란히 배치. 재현 fixture overlap-check 2쌍→0쌍, 코퍼스 75건 스윕 악화 0.
- **중첩표 셀 높이 과소측정**: `cellContentExtent`가 인라인 개체(중첩표·treatAsChar 이미지)를 건너뛰어 표지 중첩표 텍스트가 겹치고 페이지 밖으로 넘치던 것 — 인라인 개체 높이(중첩표는 measureTableHeight) 반영.
- **가로(landscape) 문서 잘림**: pagePr `landscape="NARROWLY"`(90° 회전)를 무시해 가로 표가 세로 프레임 우측에서 잘리던 것 — 용지 W/H 스왑 (HWPX는 가로 문서도 용지 치수를 세로값으로 저장).
- **연속 표 문단 페이지 포개짐**: 페이지 전체가 표 하나인 문단이 연속이면 분할 프리패스(vertpos strict 역행 기준)가 경계를 못 잡아 뒤 페이지들이 한 페이지에 겹쳐 그려지던 것 — 문단 첫 seg + v 동일 + h 비전진일 때 경계 추가 인정 (같은 줄이 개체 좌우로 갈라진 seg는 오탐 제외).
## [3.17.0] - 미발행 (4.0.0에 포함)

### Fixed

- **한글 어절 줄나눔 — `breakNonLatinWord` 의미 역전 정정** (v3.5.3 회귀 아님·최초 정정):
  한컴 실구현에서 이 속성은 이름과 반대로 동작한다 — **`BREAK_WORD`=어절 유지,
  `KEEP_WORD`=글자 단위**. 한글 COM 실렌더 A/B 매트릭스(동일 문서·속성 1개씩 토글,
  정렬 JUSTIFY/LEFT·condense·snapToGrid 교차)로 실측 확정:
  - `KEEP_WORD` 문단은 정렬 무관 "실증되었/고," 같은 어절 중간 분리, `BREAK_WORD`
    문단은 줄바꿈 전부 어절 경계 + 영어 단어(`Kubernetes` 등) 통째 유지.
  - `breakLatinWord`는 이름대로(`KEEP_WORD`=단어 유지). 정본 양식(2_보고서)의
    `KEEP_WORD/KEEP_WORD`가 한글 기본값 '글자/단어'와 일치하는 것과도 정합.
  - `snapToGrid`는 줄나눔과 무관함이 같은 실측에서 확인(3.5.3의 "격자가 어절을
    깬다" 서술과 3.5.3 하단 "macOS 뷰어가 KEEP_WORD를 무시한다"는 해석은 오독 —
    뷰어·전자결재 변환기 모두 KEEP_WORD(=글자)를 정확히 따르고 있었다).
  - 반영: 공문서(어절 의도) 문단이 실제로 어절로 저장되고, 일반 경로는 종전
    실조판(BREAK_WORD=어절)을 명시적 `keepWord: true`로 행동 보존.
- **렌더 reflow가 문단 `breakSetting` 선언을 따름** — 종전에는 전역
  `reflowMode` 옵션만 봐서 미리보기와 한글 실조판의 줄바꿈이 달랐다. 이제
  paraPr 선언(BREAK_WORD=어절/KEEP_WORD=글자)이 우선, 옵션은 선언 없는 문단의
  폴백. (`RenderParaGeom.wrapMode` 신설)

### Added

- **개조식(gaejosik) 정부 표준 보고서 프리셋** — 표지(파랑 바·제목 자동 축소)·목차·
  장헤더 표·□○― 계층·공문서 표 스타일(내용비례 열폭·헤더 음영·repeatHeader)·
  fonts/sizes 커스터마이징. 상세 실측 근거는 `docs/gongmunseo-engine-spec.md` (f)장.

## [3.16.2] - 2026-07-05

### Fixed
- **PDF 표(pline-1)**: `shouldDemoteTable`의 텍스트박스 패턴(`/<[^>]+>/`)이 길이 가드 없이 실행돼 신구조문대비표의 `<신 설>`·`<단서 신설>` 표기를 요약 박스 마커로 오인, 표 전체를 문단으로 강등하던 것 — 텍스트 200자 이하일 때만 텍스트박스로 판정(같은 함수의 "200자 초과=정상 표" 기존 정책과 정합). KAIST 30p 개정안 대비표가 3조각+본문 누출 2건 → 통째 1표로 복원, pdf-table 게이트 지표 동일(회귀 0).

### Changed
- **bench:visual 오라클 개편(gate-2)**: 도장 유무가 40mm에서도 aHash 0/1024비트로 무감지되던 원인 확정 — 창 crop에 한컴 작업영역 배경(테마 따라 검정/회색)이 37% 포함돼 전역 평균이 254→169로 눌리고, 도장(얇은 붉은 테두리+흰 속)은 32×32 셀 평균이 209~220까지만 희석돼 임계를 못 넘던 것. 순백(≥248) 픽셀 비율로 페이지 경계를 검출해 **페이지만 해시**(신규 `bench/visual/hash-lib.mjs`, 한컴 없이 오프라인 검증 가능)하고, 도장 케이스는 **붉은 픽셀 질량·중심좌표**를 baseline과 대조(소실 50%↓·과다 2배↑·중심 5%p 이동 시 실패). 테마 교차 동일 문서 해밍 26→0(환경 독립), 도장 소실 red 0↔753px 완전 분리, `--seal-sens` 감도 실측 모드 상설화. baseline 2행 포맷 전환·전 케이스 재박제.

### Notes
- 검증: npm test 799 / bench:gate 56/59(reflow 95%) / bench:visual 재박제 + 신 오라클 게이트(한컴 실렌더).
- gate-2 감도 실측(재박제 캡처): 도장 15/25/40mm aHash 9/29/53비트 + red-mass 3,228~21,367px — 소형 도장 검출 정본은 red-mass, aHash는 레이아웃 붕괴·백지·대형 소실 담당.

## [3.16.1] - 2026-07-05

통합 검증 프로덕션 리뷰(v3.15/3.16 발행분 적대 리뷰)의 신규 결함 + 전 클러스터 프레시 스켑틱 재검증에서 발견된 잔여 결함을 수정한다. 대부분 "성공 메시지 + 조용히 틀린 산출물" 계열 — 공문서 자동화에서 무신호 오출력을 차단한다.

### Fixed

- **도장(place_seal)**: rowSpan 결재란에서 도장이 한 열 왼쪽에 찍히던 것(그리드 열폭 테이블로 면역, seal-1) · 가로 병합(colspan) 제목행 아래 데이터행에서 병합폭 이중계상으로 도장이 표 밖에 찍히던 것(colSpan>1 셀 제외, seal-1 colspan) · 중첩표 셀 앵커에서 바깥 셀 오프셋 미가산으로 도장이 옆 셀로 밀리던 것(조상 셀 체인 가산 — 한컴 실측으로 '항상 페이지 단' 원점 모델 확정, seal-2) · CLI --size-mm NaN·음수 검증, 이미지 매직바이트 검증, 섹션 숫자 정렬, 앵커 run charPr 폴백, 탭/다중줄 근사 경고(seal-4~8).
- **차트(chart)**: 천단위 콤마 `1,000`이 [1,0,2,0]으로 오염되던 값 파서(자릿수 패턴 결합, chart-1) · 기안문 표준번호 모드에서 항목 사이 차트가 항목번호 run을 끊던 것(passThrough에 chart 배선, chart-2) · CRLF 마크다운에서 펜스 감지 전멸+헤딩·리스트 파괴(md 입구 개행 정규화, chart-3) · 계열이 라벨보다 길 때 꼬리 값 무음 절단(라벨 확장 보존, chart-5) · 비숫자 토큰·개수 불일치·들여쓴 펜스·PrvText·size 클램프(chart-4·6·7·8).
- **secure-fill**: require_unique 가드가 기본 경로(hwpx-preserve)와 전략0(인셀 패턴)에서 무력하던 것 — 전 전략 key 배선 + 접두사 폴백 오염 차단(sfill-1·2) · 날짜/전화/마스크 서식 엣지(미패딩·대소문자·02 지역번호·자릿수 불일치)·mask_values verify 정규화·출력 PII 마스킹(sfill-3~8).
- **CLI/플러그인**: `fill`·`watch`의 `-o`/`-d`/`--format` 루트 옵션 가로채기로 파일 미생성·출력 무시되던 것(루트 폴백 배선, plugin-1·5) · pdfjs-dist optionalDependencies 승격, SKILL/README 문구·차트 예시 정정(plugin-2·3·4).
- **수식·왕복**: escapeGfm이 `$…$` 수식 스팬 내부 `~`/`*`를 이스케이프하던 것, replaceFrac 분자 비인접 삭제, findKeywordToken·분자 역탐색 공백류(개행·탭) 정합, `[별표 N]`·이탤릭 escapeGfm, render-worker null 라인 크래시·quit 종료(eqrt-1~6).
- **PDF 표**: 개방변 표 y-간격 상한이 병합 큰 행을 두 표로 절단하던 회귀 — 밴드 관통 수직선을 표 x-범위로 국소화 인지(pline-1·2) · fill 유래 선분 스테일 폭으로 폭 판별자가 무력화되던 것(fromFill 태깅, pline-3).
- **HWP5 왕복(§4b)**: 표기 무변경(`\n`↔`<br>`) 오판, 다중줄 verification 자기잔차, `<br><br>` 빈 줄, 음수 gridBefore 클램프(hwp5-1·2·4·5).
- **게이트·렌더**: 시각 게이트 baseline 부재=실패(박제는 --update 분리), 해밍 임계 48→16(재캡처 노이즈 0 실측), score 모수하한 면제, `--case` 무매치 실패(gate-1~4) · 렌더 진입점 압축폭탄 가드(압축해제 전 검사, reflow-1).

### Added
- **bench:visual 케이스 2종**: seal-colspan(가로 병합 제목행)·seal-nested(중첩표) — seal-1·seal-2 도장 배치를 한컴 실렌더 aHash 게이트로 잠금.

### Notes
- deferred(문서화 한계): seal-3(글상자 원점 — 합성 트리거 확보 곤란), eqrt-1(`$…$` 통화 오보호 — LOW·3중 조건부), pline-1(무구분 전폭 병합행 — 관통선 없어 미보호), hwp5-3(리터럴 `<br>` 보존 — builder 방출 규약 신설 필요).
- 검증: npm test 799 / bench:gate 56/59(reflow 95%) / bench:visual 8케이스(한컴 실렌더).

## [3.16.0] - 2026-07-05

### Added
- **차트 생성 (P5)**: 마크다운 \`\`\`chart 펜스 → 한컴 네이티브 차트. HWPX 차트는 OLE가 아니라 Chart/chartN.xml(OOXML DrawingML chartSpace) 파트 + manifest 등재 + `<hp:chart chartIDRef>` 참조 구조 — claw-hwp(MIT)의 한컴독스 GT 검증 구현을 TS 이식. 막대·선·원·도넛·영역·분산·방사형 + 누적·3D 변형 20종(한국어 별칭 지원), `type:/cat:/size:/colors:` + "이름: 숫자들" 계열 라인 규약, 파싱 실패 시 일반 코드블록 폴백. 차트는 글자처럼 취급(treatAsChar=1)이라 삽입 위치에 고정된다.
- **도장/서명 배치 (P6)**: `kordoc seal 문서.hwpx --image 도장.png --anchor "(인)"` / `placeSealHwpx()` / MCP `place_seal`(11번째 도구). 앵커 문구("(인)"·"서명 또는 인" 등)를 폰트 메트릭(전각 1em·반각 0.5em)으로 찾아 도장 PNG를 글 앞 부유로 배치 — treatAsChar=0 + flowWithText=0 + allowOverlap=1 (claw-hwp GT 규칙)이라 **표/페이지가 커지지 않는다**. 가운데/오른쪽 정렬 문단의 블록 이동 보정, occurrence 선택, auto/overlap/right 모드, 7~18mm 자동 크기, dx/dy 미세조정.
- **Claude Code 플러그인 (P7)**: `/plugin marketplace add chrisryugj/kordoc` → kordoc 스킬(SKILL.md — 파싱·생성·채움·패치·날인·검증·렌더 워크플로와 함정 문서화). `.claude-plugin/marketplace.json` + `plugins/kordoc/`, `claude plugin validate` 통과.
- **bench:visual 케이스 2종 추가**: seal(도장 부유·표 불확장)·chart(차트 실렌더) — 한컴 실렌더 aHash 게이트에 신기능 편입.

### Fixed
- `patchZipEntries`에 additions 파라미터 — 신규 ZIP 엔트리(BinData 도장 파트)를 기존 로컬 레코드 뒤·CD 앞에 추가 (UTF-8 이름·고정 타임스탬프·기압축 STORE 폴백). 비변경 엔트리 바이트 보존 불변.

### Notes
- 리뷰 #13(PDF 신구조문 대비표 오강등, PLAUSIBLE)은 실파일 2종(권익위 4p·KAIST 30p)에서 **미재현** — 실존 대비표 PDF는 괘선이 있어 표로 정상 복원(행 대응 유지). 트리거 실파일(무괘선 대비표) 확보 시 재개, 미재현 상태로는 속기록 정발화 회귀 위험 때문에 수정하지 않음.

## [3.15.0] - 2026-07-05

### Added

- **Tier-2 reflow 렌더** — 조판 캐시(`linesegarray`)가 없는 HWPX(`markdownToHwpx`
  산출물·에이전트 생성본·편집본)도 순수 TS 조판으로 렌더한다.
  `renderHwpxToSvg(buf, { reflow: true })` / CLI `kordoc render --reflow`.
  `simulateWrap`(수평 줄나눔, 실측 `linesegarray` 98% 일치) + 세로 모델
  (`baseline = round(0.85 × textheight)`·줄 pitch = `round(textheight × lineSpacing%/100)`,
  한컴 저장본 실측 역설계)로 lineseg를 합성 주입 → 기존 렌더 파이프(정렬·표·이미지·
  형광펜·다페이지)를 그대로 재사용한다. 단문단 텍스트 + 표 셀(셀 로컬 좌표) + 표
  밀어내기 + 자동 페이지 분할. 자기일관성 게이트(`bench/verify-reflow.mjs` —
  한컴본 strip→reflow→기하 diff) 9/10(내용 매치 91~100%·세로 오차 0.1~1pt).
  **캐시가 있으면 캐시 재생(Tier-1 무회귀)** — reflow는 캐시 부재 문단만 채운다.
- **그리기 도형 렌더** — `rect`/`ellipse`/`line`/`polygon`/`curv`/`arc`를 SVG shape로
  그린다(`lineShape` 선 색·굵기·점선, `fillBrush` 채움, `curSz`/`orgSz` 스케일,
  개체 로컬 좌표). 기존에는 경고 후 생략해 "원본과 다름"의 큰 원인이었다.
- **persistent 렌더 워커** — `kordoc render-worker`가 stdin NDJSON 요청
  (`{id,file,out,reflow,highlight}`)을 받아 조판 SVG를 파일로 출력한다(프로세스 유지 →
  node 콜드스타트 제거). 임베더(docufinder 등)의 연속 미리보기 렌더에 유리.

### Changed

- `RenderStyles`에 `paraGeom`(줄간격·여백) 추가 — reflow 세로 조판용. 기존 파싱 무영향.
- **HWP5 다중줄 채움/수정** — 표 셀·본문 문단·빈 문단에 `<br>` 표기로 강제 줄바꿈
  (0x000a) 값을 채운다. LINE_SEG를 줄 수만큼 합성해 한컴이 실제 여러 줄로 렌더
  (1세그면 flat 렌더되는 실측 반영). 본문 문단의 다중줄 수정은 `<br>` 명시 시에만.
- **양식 채움 서식엔진** — `fill_form`에 `formats`(date:yy.mm.dd·phone:hyphen·
  rrn:masked·`#` 숫자마스크·자유 패턴), `require_unique`(모호 라벨 거부),
  `mask_values`(응답 값 마스킹 + 재파싱 FILLED 검증) 추가.
- `prepublishOnly`에 `bench:gate` 편입 — 발행 전 정확도 게이트 강제. 게이트에
  트랙별 모수 하한·표 순서구제(reordered) 무증가 플로어 추가.
- `bench:visual` 신설 — 로컬 한컴 실렌더 캡처를 aHash로 대조하는 시각 게이트
  (macOS GUI 전용, 발행 전 수동 1회).

### Fixed

- **HWP5 파서: 강제 줄바꿈(0x000a) 뒤 7글자 증발** — 코드 10을 확장 컨트롤로
  오분류해 14바이트를 소비하던 자료손상. 패치 경로(`splitParaText`)도 대칭 수정.
- **DOCX 병합표 `gridBefore` 미처리** — 행 앞 건너뛴 그리드 열을 읽지 않아 셀이
  왼쪽 열로 무음 오배치되던 자료손상.
- **PDF 개방변 표 합성의 상하 표 용접** — y-간격 무제한 그룹핑이 스택된 두 표를
  하나로 합치고 사이 본문을 흡수하던 자료손상.
- reflow: 셀 콘텐츠로 자란 표의 실효 높이를 반영 — 표 뒤 문단이 표 위에 겹치던
  문제 해소 (`measureTableHeight`, 한컴 실렌더 대조 검증).
- reflow: 캐시 감지를 태그 마크업 매치로 — 본문에 "linesegarray" 단어가 있으면
  전면 백지가 되던 오판 해소. 렌더 이미지 개수·누적 캡 + dataURI defs 1회 참조로
  반복 참조 문서 OOM 차단. 탭을 8슬롯 인라인 컨트롤로 정정(줄 경계 밀림).
- 수식: `over`/`root`/`of` 부분문자열 오파싱으로 왕복이 붕괴하던 문제 —
  리터럴/`\text{}` 마스킹 + 토큰 경계 스캔. LaTeX 공백 매크로(`\,` 등)가
  리터럴 구두점으로 렌더되던 주입 제거.
- 마스킹 별표가 heading/list 왕복에서 볼드로 소비·삭제되던 escapeGfm 누락.
- DOCX: restart 없는 vMerge continue 셀 내용 보존, 텍스트박스 수식 이중 방출 방지.
- PDF: 음영 스택 필터가 패딩 0 글상자의 실제 테두리를 삼키던 문제(말단 이질줄 트리밍).
- render-worker: 비JSON 라인에 `{ok:false}` 응답 (무응답 행 방지).

## [3.14.0] - 2026-07-04

### Added

- **렌더 다페이지 지원** — `kordoc render`가 전 페이지를 세로 스택 SVG로 그린다
  (페이지별 흰 배경·경계선·클립, `data-page` 속성, `RenderSvgResult.pageCount`).
  최상위 lineseg `vertpos`가 페이지 로컬(페이지마다 0부터 리셋)인 성질로 경계를
  감지하며, 다단(colCount>1)은 horzpos 복귀 조건을 함께 본다. 기존에는 전 페이지가
  첫 페이지 한 장에 겹쳐 그려졌다.
- **렌더 검색어 형광펜** — `--highlight <쉼표구분어>` / `RenderSvgOptions.highlights`.
  텍스트 조각을 매치 경계로 분할해 매치 세그먼트에만 배경 rect 를 깐다(대소문자 무시).
  세그먼트와 rect 가 동일한 `textLength` 폭·위치로 계산돼 정렬 오차가 없다.
  charPr 경계에 걸친 매치는 칠하지 못하는 한계.

### Fixed

- **렌더 줄 경계 어긋남** — lineseg `textpos`는 HWP5 문자 스트림 슬롯 기준(표·구역
  정의 등 컨트롤 8슬롯, 탭·lineBreak 등 문자형 컨트롤 1슬롯, 서로게이트 쌍 2슬롯)
  인데 순수 텍스트 코드포인트로만 세어, 컨트롤·탭이 섞인 문단에서 첫 줄에 글자가
  몰리고 다음 줄이 비는 현상. 슬롯 스트림 재구성으로 정합 (데모 코퍼스 1,132개
  멀티라인 문단에서 경계가 8슬롯 블록 중간에 걸린 사례 0건으로 검증).
- **렌더 이미지 크롭 오판(로고 깨짐)** — `imgClip` 좌표계를 `orgSz`(최초 삽입 크기)
  기준으로 해석해, 삽입 후 리사이즈된 이미지(dim<org, 로고 대부분)를 좌상단 코너로
  잘못 잘라 로고가 흐린 조각이나 빈칸으로 깨졌다. `imgClip`은 `imgDim`(내용 상자)
  기준임을 반영 (데모 코퍼스 pic 267개 중 254개가 clip==dim=크롭 없음, 실제 크롭
  8개도 모두 dim 기준으로 정상 렌더).

## [3.13.0] - 2026-07-04

### Added

- **PDF 프로즈 박스 감지** — 상단 라벨탭(제목 칩)이 박스 테두리에 걸쳐 만든 가짜
  열 위로 본문이 전폭 프로즈로 흐르는 표(검정고시 응시자격 박스 등)를 감지해
  표를 버리고 아이템을 프로즈 폴백(자연 읽기순)으로 재추출. 판정은 두 신호의
  교집합 — 기하(내부 수직 구분선 없는 전폭 행이 표 높이의 60%+) × 텍스트(80자+
  긴 셀 3개+ 이고 채운 셀의 40%+). 기하 단독은 다줄셀 정규표, 텍스트 단독은
  서술형 2열표와 구분되지 않아 둘 다 충족할 때만 발동. 셀 조인(demote)이 찢긴
  조각을 스크램블하던 문제 해소 — pdf 코퍼스 7파일 개선/중립, pairs 무변경

### Fixed

- **HML 표 캡션 소실** — hwpml 파서가 `TABLE > SHAPEOBJECT > CAPTION` 텍스트를
  통째로 버리던 것을 별도 문단으로 보존(`Side=Top/Left`면 표 앞, 그 외는 뒤).
  `collectCharText`가 SHAPEOBJECT를 스킵해 표 주석("※ …참조" 등 도형 캡션)이
  소실되던 문제 (bizinfo hmlRecall 0.9727→0.9857)

## [3.12.0] - 2026-07-03

### Added

- **PDF 개방 변 합성 체인 뷰** — `closeOpenTableEdges`의 끝점 정렬 판정을 콜리니어
  세그먼트(셀 단위로 쪼개 그은 괘선)를 논리 괘선으로 이은 체인 뷰 기준으로 전환.
  물리 수평선은 수정하지 않아 셀 배치 부작용 없이, 중간 괘선이 셀 경계마다 분절된
  표(문의처 2x4 등)의 좌우 개방 변이 닫힘

### Fixed

- **라벨 헤더 표 오강등** — 첫 행 전체가 마커 없는 짧은 라벨이고 본문에 내용이
  있는 표는 텍스트 박스 강등(`shouldDemoteTable`)에서 면제. 본문 셀의 ○/ㅇ
  항목부호(채용분야|담당업무|우대조건)와 양식 표의 빈 기입란(성명|응시분야|비고)이
  텍스트 박스 패턴으로 오인돼 문단으로 강등되던 문제 — pdf 코퍼스 14파일에서
  예산표·라벨 열·대비표 등이 표로 복구 (coverage 무후퇴)

### Benchmark

- pdf표GT 트랙 3픽스 + 모수 예외: ⓐbag 교집합 0 매칭 차단 (dims-only 누수가
  진짜 짝을 선점하던 것 해소) ⓑ전체 텍스트 접두 유사도 폴백 (세밀 분할 프로즈
  박스 구제) ⓒ흐름띠·거의 빈 표 모수 제외 (hwpx가 표를 레이아웃 도구로 쓴 표현
  차, 양측 대칭). 게이트 재잠금: 매칭 0.90→0.98 / exact 0.58→0.65 /
  cellF1 0.65→0.72 / cellExact 0.67→0.69 / NED 0.49→0.52

## [3.11.0] - 2026-07-03

### Added

- **PDF 개방 변 표 테두리 합성** (`closeOpenTableEdges`) — 좌/우 바깥 테두리를 생략하는
  행정문서 표 스타일(수평 괘선 전폭 + 내부 수직선만)에서 교차점 기반 그리드가 가장자리
  열을 통째로 잃던 것을, 끝점 정렬 괘선 묶음(≥3줄)에 내부 수직선이 실존할 때 끝점 x에
  가상 수직 테두리를 합성해 복원

### Fixed

- **글상자 그라디언트 음영의 괘선 오염** — 한컴 PDF가 배경 그라디언트를 같은 범위의
  가는 수평선 수십 개(0.5pt 간격)로 그려, 근접 평행선 병합이 스택과 함께 주변의 실제
  상하 테두리까지 연쇄 흡수하던 것을 음영 스택 필터(≥6줄·<2pt 간격 run 제거)로 차단
- 위 두 수정으로 채용공고류 1페이지 병리 완치 — 2x6 표가 가운데 4열만 감지되고 지역·비고
  열과 아래 본문·섹션 제목·담당업무 표까지 13x2 유령 표로 흡수되던 사례 (pair05 실측)

### Benchmark

- pdf표GT(6쌍): 매칭 0.8472→**0.9028** / exact 0.5417→**0.5833** / cellF1 0.6324→**0.6518**
  (채점기 bagExtra 매칭 보강 포함 — pdf가 평탄화하는 동의서류 중첩표 박스 4건 매칭 회복.
  contentNED 플로어는 0.5→0.49 재잠금: 종전 미매칭 표의 빈 셀이 받던 공짜 exact가
  정직한 좌표 대조로 바뀐 의미 변화, 상세는 bench/pdf-table-gt.mjs 헤더)
- 그 외 전 트랙 무후퇴: hwpx recallMicro 1.0 · 표 611/611 · pdf coverage 0.99608 ·
  roundtrip/formats/fuzz 게이트 전부 PASS · 테스트 683/683

## [3.10.1] - 2026-07-03

### Fixed

- **렌더 SVG 크기 단위** — `width`/`height`를 pt 단위로 명시. 단위 없는 px로는
  브라우저 단독 열람 시 A4 실물(96dpi)보다 25% 작게 보였음 (viewBox 스케일링은 기존과 동일)

## [3.10.0] - 2026-07-03

### Added

- **레이아웃 보존 렌더 (`renderHwpxToSvg` / `kordoc render`)** — 조판 엔진 없이
  한컴이 HWPX에 저장한 조판 캐시(`linesegarray`·`cellAddr`·`hp:pos`)를 SVG
  절대배치로 그려 원본 1페이지 레이아웃(결재문서 헤더·표·본문·결재란·사진)을
  재현. 지원: run별 charPr(크기·굵기·색·밑줄·자간·장평), paraPr 정렬
  (JUSTIFY/CENTER/RIGHT/배분 — 줄바꿈은 원본 lineseg로 고정), 셀
  배경색·테두리(borderFill), 셀 수직 정렬, 병합 셀 그리드(스팬 제약 경계 전파
  솔버), 콘텐츠 초과 행 성장, 인라인(`treatAsChar`) 개체, 이미지 크롭(imgClip),
  `PAGE`/`PAPER`/`PARA` 개체 앵커(밀어내기 역산). 한컴 저장본 전용 —
  `markdownToHwpx` 산출물엔 조판 캐시가 없어 명확한 에러를 반환.
  코퍼스 hwpx 85건 크래시 0 실측

### Fixed

- **uint32 음수 좌표 해석** — `vertOffset="4294967103"`(= −193)처럼 uint32로
  저장된 음수 오프셋을 부호 있는 값으로 해석 (사진대지 사진 1장이 페이지 밖으로
  사라지던 원인)
- **셀 내부 `COLUMN` 기준계** — 셀 안 개체의 `horzRelTo="COLUMN"`을 페이지
  단이 아닌 현재 셀 영역 기준으로 해석 (우측 셀 사진이 페이지 왼쪽에 겹치던 원인)

### Added

- **Markdown display math → HWPX native 수식 생성** — `$$ … $$` 블록을
  `<hp:equation>`(EqEdit script)으로 생성. 지원: `\frac`·`\sqrt[n]`·첨자/위첨자·
  그리스 문자·적분/극한·화살표·관계 연산자·`matrix`/`pmatrix`/`bmatrix`·
  `\left(`/`\left\{` 구분자·`\text`/`\mathrm` 리터럴. 생성 어휘는 읽기
  (`hmlToLatex`) 토큰맵과 왕복 정합 — 전 토큰 고정점 테스트로 잠금.
  (#38, #39 — @leehuiso 기여 + 리뷰 확정 8건 수술)

### Fixed

- **`$$` 스캐너** — 닫히지 않은 `$$`가 문서 나머지를 통삼킴하던 것을 일반 문단
  폴백으로, 닫는 `$$` 뒤 잔여 텍스트 무음 소실을 문단 보존으로 수정. 빈 줄/
  코드펜스 경계에서 멀티라인 수집 중단, 이스케이프 `\$$` 여닫이 제외
- **수식 변환기 가드** — 중괄호 폭탄·`\frac` 체인의 스택 오버플로를 깊이 64
  리터럴 폴백으로, 초장문 입력을 소스 10K 상한으로 차단 (MCP/CLI 비신뢰 입력)
- **왕복 비대칭** — `\pm`/`\cdot`/`\ast`/`\leftarrow`가 재파싱 불가 토큰으로
  나가던 것 수정(읽기 맵에 `+-`·`cdot` 추가 포함), `RIGHT )` 공백 접합 제거,
  `\left\{` 백슬래시 잔재 수정, 첨자 예약어를 토큰맵에서 도출해 따옴표 누수
  해소(읽기 쪽 `"…"` → `\text{…}` 언쿼트 동반)
- **공문 모드** — 항목 사이에 낀 수식이 번호 run을 끊어 번호가 리셋/소멸하던
  것 수정 (표와 동일한 run 연속 예외)

### Bench

- roundtrip: equation·law(법령 줄 무결성) fixture + `equationErrors`/`lineErrors`
  게이트 — 코퍼스에 `$$`가 없어 무감이던 수식 클래스·조문 줄바꿈 클래스 고정
- fuzz: `markdownToHwpx` mdgen 60런(crash/hang/slow/genInvalid) 편입

## [3.9.0]

_(README 버전별 변경사항에서 옮김 — 날짜 기록 없음)_

- **🧮 Markdown 수식 → HWPX native 수식 생성**: `$$ \frac{a}{b} $$` 같은 display math 블록이 한컴 수식 개체(`<hp:equation>`)로 생성됩니다. `\frac`·`\sqrt`·첨자·그리스 문자·적분/극한·행렬(matrix/pmatrix/bmatrix)·`\left(` 구분자·`\text` 리터럴 지원. 생성한 수식은 kordoc으로 다시 파싱해도 같은 LaTeX로 돌아옵니다 (#38, @leehuiso 기여).
- **🛡️ 수식 입력 가드**: 닫히지 않은 `$$`가 문서 전체를 삼키던 문제(일반 문단 폴백), 중괄호 폭탄 크래시(깊이/길이 상한), 닫는 `$$` 뒤 텍스트 소실을 수정했습니다.
- **📋 공문 모드 번호 연속**: 항목 사이에 수식이 끼어도 항목 번호가 이어집니다 (표와 동일).
- **⚖️ 법령 문서 왕복 무결성 게이트**: 조문 번호 뒤 분리·문장 중간 끊김이 없음을 실측(민원처리법 전문 228문단)하고 벤치 게이트로 고정했습니다.

## [3.8.4] - 2026-07-03

### Fixed

- **DOCX 병합표 셀 통유실** — 앵커 셀 밀집 배열을 그리드 인덱스 규약(IRTable.cells)으로
  그대로 넘겨 렌더러의 skip-walk가 gridSpan 뒤 셀을 통째 버리던 버그. 공용
  buildTable(colAddr/rowAddr 직접 배치)로 교체. val 없는 `<w:vMerge/>`(계속 셀)를
  일반 셀로 오독해 세로 병합이 아예 동작하지 않던 것도 수정 — 신고서류 병합표 회수율
  0.675 → **1.0**.
- **DOCX 텍스트박스 전체 유실** — `w:txbxContent`를 읽지 않아 KS표준안류 문서의
  텍스트박스 수백 개가 통째로 빠지던 버그. 앵커 문단 뒤 별도 블록으로 수집
  (mc:Fallback 서브트리는 Choice 이중 렌더라 스킵) — 회수율 0.917 → **0.9985**.
- **개인정보 마스킹 별표가 마크다운 문법으로 오독** — `******`(마스킹 런)이 수평선으로,
  `홍**`·`010-****-1234`가 볼드/강조로 소비되던 문제. 모든 포맷의 마크다운 출력에서
  `*`를 `\*`로 이스케이프 (본문·표 셀 공통). 별표 각주 마커(`* 단, …`)가 리스트로
  오인되던 것도 함께 해소.
- **md→HWPX 재변환(라운드트립) 충실도** — 3종 수술로 왕복 텍스트 보존율 0.947 → **0.9996**:
  - 헤딩(`#`~`######`)이 재파싱에서 일반 문단으로 죽던 것 → 생성 paraPr에 개요(OUTLINE)
    정보를 심어 보존 (한컴 문서 찾아가기에도 개요로 표시, 번호 서식은 비워 화면 무변화)
  - 순서 리스트가 `2. 3. 4.`로 시작해도 `1.`부터 재부여되던 것 → 원본 번호·구분자 보존
    (`-`→`·` 기호 변형도 폐지)
  - 이스케이프된 마크다운(`\*` 등)의 백슬래시가 문서 본문에 박히거나 별표가 강조로
    소비되던 것 → 센티널 마스킹 후 리터럴 복원
- **HWPX 개요 번호 발명** — 번호 서식이 명시적으로 빈 개요/자동번호 문단(한컴 "번호
  없음")에 파서가 `1.` 접두를 만들어 붙이던 버그. 정의 자체가 없는 레벨의 폴백은 유지.

### Changed

- 검증 인프라(내부): 라운드트립 헤딩 무결성 게이트 신설 + 텍스트 플로어 0.945→0.999
  상향, PDF 표 구조 GT 트랙에 2단 조판 순서 예외 구제(매칭 81.9→84.7%·exact 51.4→54.2%)
  + 무후퇴 플로어를 걸어 bench:gate 체인 편입.

## [3.8.3] - 2026-07-03

### Fixed

- **2단 조판 본문(속기록류)을 표·컬럼으로 오인** — 문단 끝 짧은 줄 쌍이 표 머리글로
  오인돼 2단 본문 전체가 2열 표로 흡수되고 좌우 단이 뒤섞이던 버그. 줄-투표 기반
  중앙 빈 띠 판별(`findTwoColumnProseCutX`)로 표를 강등하고 단 분리 읽기 순서를
  복원. 전폭 목차 줄이 XY-Cut을 막는 페이지는 컷 x로 좌/우/전폭 직접 분리.
  (코퍼스 8,411페이지 전수에서 발화는 속기록 1건 — 타 문서 출력 바이트 동일)
- **손상 PDF 파싱 시간 폭주(DoS) 가드** — 오염된 좌표(±Infinity·1e9)가 2단 판별
  격자 스캔을 페이지당 수십억 회로 폭주시켜 파싱이 144.8초 걸리던 것을 2.3초로.
  비유한 좌표 즉시 반환 + 스캔 후보 상한 400. (퍼즈 스윕으로 발굴, 정상 코퍼스
  hash-sweep 바이트 동일)
- **한셀(HCell) 저장 XLSX 파싱 실패** — 한셀은 spreadsheetml 요소를 `x:` 접두사로
  선언(`<x:sheet>`)하는데 요소 조회가 정규화 이름만 매칭해 "시트가 없습니다"로
  실패하던 것 수정 (네임스페이스 폴백 추가).
- **HML(HWPML) 문단 앵커 표 통째 소실** — 표가 `<P>` 안에 앵커된 문서에서 표
  전체가 빠지고, 셀 안 중첩표는 "[중첩 테이블]" 마커로 내용이 사라지던 버그.
  해수부 공고 실코퍼스 9건 recall 0.231 → 0.996.

### Changed

- 검증 인프라 4종 신설(내부) — 생성 라운드트립(md→hwpx→재파싱 커버리지), 퍼즈
  스윕(절단·비트플립 183파일×4변형 732런 전부 통과), HWP↔HWPX 동일문서 쌍
  게이트(유사도 0.9946), 포맷 트랙(DOCX/XLSX/HML 자기참조 recall).
  `npm run bench:gate`로 일괄 실행.
- HWPX 표 채점 cellExact·contentNED **1.0 도달** — 셀 자동부호(한컴 화면 렌더
  동일) 채점 비대칭 해소 후 게이트 상향 잠금.

## [3.8.2] - 2026-07-03

### Fixed

- **PDF 선 추출 CTM 추적** — 콘텐츠 스트림이 축소/플립 변환을 깔면([0.75,0,0,-0.75,0,H],
  성과계획서류) 괘선 좌표가 텍스트와 다른 좌표계에 놓여 그리드-텍스트 매핑이 전멸,
  괘선 표가 선 없는 표 경로로 떨어져 2줄 셀("측정산식/또는 측정방법")이 행으로
  쪼개지던 버그. 이제 rowspan 병합 셀로 정상 복원. (항등 CTM 문서는 출력 무변화)
- **pdfjs CID 폰트 자산(cmaps/standard_fonts) 경로 지정** — 미지정이면 CMap 필요
  폰트의 텍스트가 통째로 소실됐다. 스캔본으로 오판정되던 66페이지 의사록에서
  임베디드 텍스트층 129KB 전문 추출 복구 (pdftotext도 못 읽는 문서).

### Changed

- **hwpx/generator.ts 1,068줄 → 7모듈 분리 (내부, 공개 API 무변경)** — 생성물
  ZIP 내부 엔트리 sha256 전/후 동일 검증(`bench/gen-sweep.mjs` 신설).
- PDF 정확도 벤치: 실코퍼스 42건 coverage 0.99591, 전건 정식 채점(OCR 격리 0).

## [3.8.1] - 2026-07-03

### Fixed

- **PDF 회전 텍스트(90°/270°) hidden 오분류** — 사이드탭 챕터 인덱스·세로로 눕힌 표
  (계속비 총괄표 등)가 숨김텍스트 필터(prompt injection 방어)에 걸려 통째로 빠지던
  버그. 회전 행렬 `[0,s,-s,0]`에서 대각 성분만 보던 fontSize 계산을 변환행렬
  열벡터 노름으로 교체. 진짜 0 스케일 숨김텍스트 방어는 그대로 유지.
  (실코퍼스 기준 문서당 최대 3,000개 텍스트 아이템 복구)

### Changed

- **대형 파일 모듈 분리 (내부, 공개 API 무변경)** — `pdf/line-detector.ts`(1,247줄)
  → 7모듈, `hwpx/parser.ts`(1,619줄) → 8모듈. 기존 import 경로는 재수출 허브로
  전부 유지. 실파일 87건 markdown+blocks sha256 전/후 동일 검증(`bench/hash-sweep.mjs`).
- **PDF 정확도 벤치 참조 채점 대칭화** (`bench/`) — 목차 리더 점선 런 붕괴,
  페이지 가장자리 반복 러닝헤더 제거(파서 규칙과 대칭), 참조 trigram 줄 단위 계산
  (줄 경계 gram은 추출기 순회 순서라 배제). 실코퍼스 42건 coverage 게이트
  0.985 PASS (0.99471).

## [3.8.0] - 2026-07-02

### Added

- **HWP 5.x 빈 셀/빈 문단 채우기** (`patchHwp`) — 원본에서 비어 있던 표 셀에
  편집 마크다운으로 값을 넣으면 이제 HWP 바이너리에 삽입된다.
  - `splitParaText`: 일반 텍스트가 없는 문단(빈/개체만)도 전 토큰이 비가시면
    빈 코어로 분해 — 새 텍스트가 [선두 개체 뒤, 문단끝 앞]에 들어간다. 탭 등
    가시 control이 있는 문단은 기존대로 건드리지 않음.
  - PARA_TEXT 생략형(텍스트 레코드 자체가 없는 빈 문단)은 레코드를 신규 삽입
    (`SectionScan5.inserts` + `serializeRecords` 확장, nChars 하위비트로 문단끝
    정합). 실측 기준 한컴 빈 문단의 지배형(hwplib 실파일 57/66)이 이 형태.
  - GFM/HTML/1x1 전 경로 지원. 실파일 검증: no-op 12/12 바이트동일,
    비우기→재채움 왕복 무결, rhwp 렌더 육안 확인.
- **공문서 모드: 항목 사이 표가 번호 흐름을 끊지 않음** (`markdownToHwpx`
  gongmun) — "1. 항목 → 근거 표 → 2. 항목"처럼 리스트 사이에 표(GFM/HTML)가
  끼어도 항목부호가 이어진다(공문 관행). 문단이 끼면 기존대로 리셋.
- **성능 벤치 신설** (`bench/perf.mjs`) — 실파일 코퍼스 속도(median/p95·MB/s)·
  no-op 라운드트립 바이트동일·폼 인식 집계. 기준선: hwpx median 7.8ms·11.8MB/s,
  no-op 88/88, 실파일 실패 0.

### Fixed

- **DOCX 무경고 실패 5종 경고화** — 이미지/스타일/번호매기기/각주/메타데이터
  파싱 실패를 조용히 무시하던 것을 `warnings`로 보고 (이미지=`SKIPPED_IMAGE`,
  나머지=`PARTIAL_PARSE`). 파싱은 기존대로 계속되므로 결과는 동일, 실패가
  보이게만 바뀜.

### Performance

- **이미지 대량 참조 메모리 폭발 해소 (HWP5·HWPX 공통)** — 같은 이미지를
  참조하는 개체마다 데이터를 복사·중복 추출하던 것을 참조(BinData storageId /
  HWPX ref)당 1회 변환·버퍼 공유로 전환. 3.7MB 이미지를 도형 12,822개가
  참조하는 실파일(hwplib big_file.hwp)이 **피크 17GB OOM 완주 불가 → 197ms·
  피크 445MB**로 완주. 실패도 캐시해 `SKIPPED_IMAGE` 경고는 참조당 1회만.

## [3.7.0] - 2026-07-02

### Added

- **표 행 추가/삭제** (`patchHwpx`, `src/roundtrip/table-rows.ts`) — 편집 마크다운의
  GFM/HTML 표 행 수가 원본과 달라도 이제 반영된다. 행 정렬(LCS)로 삽입/삭제/수정을
  구분하고, 행 추가는 인접 행 `<hp:tr>`을 복제해 셀 텍스트만 교체(서식·테두리·높이
  승계), 행 삭제는 `<hp:tr>` 제거. `rowCnt`·이후 행 `cellAddr rowAddr`·표 `hp:sz`
  높이를 함께 갱신하고 복제 조각의 `linesegarray`는 제거한다.
  - **보수적 게이트** (전부 통과해야 수행, 실패 시 표 전체 graceful skip): 세로
    병합(rowSpan)이 변경 지점을 가로지르면 미지원, 삭제/서식기준 행에 개체(중첩표·
    이미지·수식·필드) 포함 시 미지원, 셀 주소 표기 혼재 미지원, 편집 결과가 builder
    렌더에서 변형되면(빈 행 드롭·첫 열 전파) 미지원.
  - 실문서 검증: 결재문서 코퍼스 45건 행 추가 스윕 — GFM 6/9·HTML 34/45 클린 적용
    (재파싱 잔차 0), 나머지는 사유와 함께 skip, 손상·예외 0. rhwp 렌더 육안 확인.
- **채우기 두 경로 정합** (`fillFormFields` ↔ `fillHwpx`) — IR 경로의 병합 라벨셀
  값 유실(silent) 수정: 라벨이 colSpan≥2면 값이 병합 플레이스홀더에 쓰여 렌더에서
  사라지던 것을 hwpx 경로처럼 "라벨 span 뒤 같은 행의 실제 다음 셀"에 쓰도록 교정.
  셀 안 중첩표 라벨도 재귀 채우기(depth 16, hwpx 경로와 동일). 전략2(명부형)의
  병합 커버 칸 값 소진 차단. 두 경로 filled/unmatched 동등성 테스트 신설.
- **라벨 인식 확장** (`isLabelCell`) — 숫자 낀 라벨("연번1"·"제1항목"·"1차소속"),
  9~12자 한글 라벨("제1소위원회위원장"), 콜론 없는 영문 라벨("Name"·"Date of
  Birth", 관행 단어 목록 한정) 인식. 가드: 수량/단위 값("6개월"·"1억원"·"5백만원")·
  서술형 어미("해당없음")·법인명("(주)…")·9자 이상 구간의 3어절 이상 제목성 문구는
  거부. 코퍼스 45건 정량: 380→386 필드(+8 전부 실제 라벨, −2 순수 오탐 제거).
- **`PatchSkip.partial`** — "적용은 됐지만 편집 원형 그대로는 아님"(셀 내 줄 병합,
  이미지 혼재 텍스트만 적용, 줄 삭제 시 빈 문단 잔존)을 완전 미적용 skip과 구분해
  보고. HWPX·HWP5 공통. 셀 줄 삭제 시 빈 문단 잔존 보고 신설(기존 무보고).

### Fixed

- **중첩표 blocks 유실 방지** (`buildTableWithCellMeta`) — cellAddr·텍스트 매칭이
  모두 실패한 셀(동일 텍스트 중복·스팬 불일치)의 중첩표/이미지 blocks가 조용히
  사라지던 것에 서수(tc 순서) 3차 폴백 추가. 소스 tc 수와 격자 앵커 수가 1:1일
  때만 발동(오부착 방지). 코퍼스 45건 markdown 해시 전/후 동일(무회귀).

### Changed

- `alignUnits`(정확 일치 LCS + 갭 유사도 페어링)를 `patcher.ts` →
  `markdown-units.ts`로 이동 (표 행 정렬과 공용, patcher는 re-export 유지).
- 수식+병합 표의 GFM 강등(builder)은 실측 결과 유지 — 코퍼스 표 217개 중 수식
  포함 0건으로 완화 근거 없음. `flattenLayoutTables`의 hwp5-only 호출 정책과
  파서 깊이 상수(hwpx 200=XML 요소 / hwp5 8=표 중첩 / filler 16=표 중첩)의
  좌표계 차이를 주석으로 명문화.

## [3.6.0] - 2026-07-02

### Added

- **함초롬바탕 실측 텍스트 메트릭 + 줄바꿈 시뮬레이션 엔진** (`src/hwpx/text-metrics.ts`) —
  한컴 공개 배포 함초롬바탕 정품 TTF의 advance를 전수 추출(한글 음절 11,172자
  균일 0.97em, 숫자 0.55em, 온점·괄호 0.32em, Bold=Regular 폭 동일 확인)해
  HWP 프로그램 없이 줄폭·줄바꿈을 계산한다. 어절(KEEP_WORD)/글자 단위 두 모델 +
  한컴 금칙 처리(줄머리 금지 문자 밀어내기, 여는 괄호 줄끝 금지) 구현.
  - **실측 검증**: `bench/verify-linebreak.mjs` 신설 — 서울 정보소통광장 실제
    결재문서 45건의 `linesegarray`(한컴 계열 조판기가 계산한 줄 시작 오프셋)를
    정답지로 대조, 정밀 폭 버킷(고정폭 글꼴)에서 **줄바꿈점 98% 일치**(56/57).
    이 과정에서 확정: 공백=0.5em 고정(useFontSpace=0), 장평·자간은 공백에도
    적용, 자간=글자폭×(1+sp/100), 시작금칙은 직전 1글자 동반 밀어내기.
  - API: `measureTextWidth`, `simulateWrap`, `fitRatioForFewerLines`, `charWidthEm1000`
- **공문서 문단별 자동 장평(`GongmunOptions.autoFit`, 기본 켜짐)** — 한두 글자
  (짧은 꼬리)만 다음 줄로 넘어가는 문단을 찾아 그 문단만 장평 95→90% 범위에서
  자동 축소해 한 줄에 담는다(공무원 실무 관행의 자동화). 전역 95%로는 못 잡던
  orphan을 문단 단위로 해결 — 필요한 문단에만 변형 charPr을 발급하고 나머지는
  그대로. `autoFit: false`로 끄거나 `{ minRatio }`로 하한 조정.
- **HTML 표(병합·중첩) → HWPX 생성** — `markdownToHwpx`가 kordoc parse 출력
  형식의 `<table>`(colspan/rowspan/중첩 `<table>`)을 구조 보존으로 생성한다.
  그리드 배치(병합 점유 반영 cellAddr/cellSpan) + 셀 안 중첩표 재귀 생성.
  parse → 편집 → markdownToHwpx 라운드트립에서 병합·중첩표가 살아남는다
  (이전엔 HTML 태그가 문단 텍스트로 박혔음).
- **다중값(배열) 채우기 — 2~30장 반복 양식·명부** — `fillHwpx`/`fillFormFields`/
  `fillForm`의 values 값에 `string[]` 허용. 배열이면 같은 라벨의 등장 순서대로
  하나씩 소진(반복 양식), 명부형 표(헤더+데이터 행)는 행마다 다음 값을 채운다.
  소진 후 등장은 채우지 않음. 문자열(스칼라)은 기존과 동일(모든 등장 동일값,
  명부는 첫 행만). CLI `fill`의 JSON values는 배열이 자연 투과.

### Fixed

- **fillHwpx·HwpxSession이 linesegarray를 제거하지 않던 문제** — 텍스트를 바꾸고
  줄 레이아웃 캐시를 그대로 둬, 채운 문서를 한컴에서 열면 변조 경고가 뜨거나
  옛 줄배치로 렌더될 수 있었다(줄바꿈 틀어짐). patchHwpx(v3.2.1)와 동일하게
  수정된 섹션의 linesegarray를 전부 비운다 — 뷰어가 열 때 재계산. 무변경 문서는
  기존대로 바이트 동일.
- **생성 표 테두리가 뷰어에서 안 보이던 문제** — `borderFill` id를 0부터 매겨
  1-based로 해석하는 뷰어(rhwp 등 한컴 규약 구현체)에서 셀의 테두리 참조가
  무테두리 fill로 풀렸다. 실제 한컴 산출 파일 규약대로 1-based(1=무테두리,
  2=SOLID)로 재번호하고 `centerLine` 속성을 불리언("0")에서 enum("NONE")으로
  수정. `<hh:fillInfo/>`(비표준)·불필요한 diagonal 요소 제거.
- **공문서 항목 내어쓰기 폭 실측화** — `markerWidth`를 문자 부류 근사(괄호
  0.45em, 숫자 0.5em, 온점 0.25em)에서 함초롬바탕 실제 advance(0.32/0.55/0.32em)
  기반으로 교체. `(1)` 마커 기준 내어쓰기 오차 약 0.2글자 제거 — 둘째 줄이
  첫 줄 내용 첫 글자에 정확히 정렬된다.

### Changed

- `bench/collect-opengov.mjs` — 2026-07 정보소통광장 개편 대응(다운로드 링크에서
  `dname=` 제거, 파일명이 `title-down` 요소로 이동). 첨부 `<li>` 블록 단위
  (파일명, 원문 링크) 추출로 재작성 + 제목 포함/제외 정규식 필터 인자 추가.
- `tests/roundtrip-e2e.test.ts` 코퍼스 디렉토리에 `review` 추가.

