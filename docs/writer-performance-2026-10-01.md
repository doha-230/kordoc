# 공문서 생성 성능 검증 — 4.18.0 / 2026-10-01

문단 맞춤에서 같은 문자를 후보마다 다시 해독하고 글꼴 폭표를 조회하던 비용을 줄였다. 원 폭과 UTF-16 이동 길이, 어절 묶음을 문단 안에서만 준비해 재사용한다. 폭을 곱하고 더하는 순서는 그대로 유지하며, 단문은 준비 비용을 내지 않는다.

4.17.6 공개 API의 고정 dist와 4.18.0 후보 dist를 같은 프로세스에서 AB/BA 순서로 번갈아 실행했다. 조건마다 준비 2회와 측정 11회를 수행했다. 측정 중 다른 로컬 테스트·빌드·벤치 작업은 실행하지 않았다. 실제 서울시 방침서 Markdown 5개 × 공문서 프리셋 7개와 작은 합성 입력 1개 × 7개의 총 42조건이며, 입력 SHA-256과 모든 원시 측정값을 보존한다.

실제 문서 35조건 모두 생성 시간이 19.665–34.754% 감소했다. 조건별 중앙값 합은 505.061→353.456ms(약 30.0% 감소)이며, 이를 실서비스 전체 처리량으로 일반화하지 않는다. 작은 합성 입력 7조건은 −4.836~+9.519% 변동했다. 가장 큰 증가도 약 0.076ms였고, 양수 변동도 원시 결과에 남겼다.

| 문서 | 문자 수 | 7개 프리셋 시간 감소 범위 |
| --- | ---: | ---: |
| 33586650.md | 38209 | 28.82–34.75% |
| 34906816.md | 5647 | 19.66–27.27% |
| 35530133.md | 15915 | 19.67–32.26% |
| 36153188.md | 2976 | 23.36–27.18% |
| 36425365.md | 2489 | 20.98–26.32% |

42조건 모두 마지막 측정 쌍의 경고와 ZIP 내부 모든 파일이 바이트 동일하다. 독립 소스 검증은 줄 배치 25,512건·압축 결정 1,584건, 별도 생성 24건·ZIP 항목 216개가 동일하며 관련 테스트 127개와 typecheck가 통과했다. 외부 ODL 200문서 × 기본·plain/htmlTables·OCR 끔 3옵션은 600개 Markdown이 기존 4.17.6과 바이트 동일하며 모든 문서별·전체 점수가 정확히 동일하다. 기본 overall 96.062328%, plain/htmlTables 97.223473%, OCR 끔 93.733001%를 유지한다. 이번 변경은 생성 성능 개선이며 파싱 점수 상승으로 표현하지 않는다. [원본 평가 요약](writer-performance-2026-10-01/odl-summary.json)과 문서별 JSONL에 모수 200/42/107·누락 0을 보존한다. 정상 npm 게시의 전체 게이트를 통과했다. 전체 테스트는 2,906 통과·실패 0·Linux 전용 5 skip(Darwin), 해당 다섯 테스트는 Linux Node20/22/24에서 실제 통과했다. fuzz 23,700회 사고 0, reflow 59/59, 개인정보 마스킹·OCR 게이트도 통과했다. HWPX 표 9,849/9,865(99.8378%), HWP5 표 4,244/4,244(100%), PDF 표·본문·부록·기타 포맷·OCR의 문서별 지표도 기존과 같다. [실제 배포 기록](release-4.18.0.json)과 [정상 게이트 로그](writer-normal-console-gates-2026-10-01.txt)에 원점수와 제한을 보존한다.

RSS 값은 두 버전이 함께 들어 있는 프로세스의 표본이다. 버전별 최고 메모리 감소를 입증하지 않으므로 메모리 개선이라고 주장하지 않는다. 원본의 GT·평가기·표본·제외는 변경하지 않았다. 한컴 GUI 실렌더 시각 오라클은 실행하지 않았으며, ZIP 동일성과 reflow 게이트를 시각 만점으로 표현하지 않는다.

재현:

```sh
# 두 디렉토리에서 빌드 완료 후 벤치 중 재빌드 금지
node bench/perf-writer-fit.mjs /path/to/4.17.6 /path/to/4.18.0 \
  /path/to/bench/corpus-gen/seoul-bangchim /tmp/writer-performance.json
```

[요약과 고정 dist 해시](writer-performance-2026-10-01.json), 프리셋별 원시 측정 JSONL: [official](writer-performance-2026-10-01/official.jsonl), [report](writer-performance-2026-10-01/report.jsonl), [plan](writer-performance-2026-10-01/plan.jsonl), [notice](writer-performance-2026-10-01/notice.jsonl), [minutes](writer-performance-2026-10-01/minutes.jsonl), [ministry](writer-performance-2026-10-01/ministry.jsonl), [bangchim](writer-performance-2026-10-01/bangchim.jsonl).

공개 npm latest/독립 설치 CLI는 4.18.0이다. 공개 ESM/CJS 생성·재파싱과 공개 CLI jobs1/2 JSON 출력 동등성이 통과했고, 공개 dist 136파일은 실제 게시 빌드와 바이트 동일하다. npm·로컬 pack·다운로드한 GitHub 자산은 5,644,063바이트이며 SHA-256 `509e62a7f3087d3cc31f8b30acb93ff88ec66eac0bc3b0f0edb6adcf39b61fd9`로 동일하다. 측정 worktree와 primary 간 CJS 소스맵 14개에는 체크아웃 절대 경로만 다르며, 실행 코드·선언·sourcesContent·mappings는 동일하다. [양쪽 원시 해시](writer-publish-build-2026-10-01.json)를 보존했다.
