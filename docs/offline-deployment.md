# 폐쇄망(내부망) 배포 가이드

인터넷이 차단된 망에 kordoc 을 반입·설치·운영하는 절차와, 보안성 검토에서 흔히
요구되는 항목의 근거를 정리한다. 대상 버전: **4.15.0 이상**.

## 1. 요약

| 항목 | kordoc |
|------|--------|
| 상시 외부 통신 | 없음 — 문서 파싱·생성·변환은 전 과정 로컬 |
| 조건부 외부 통신 | OCR 모델 최초 1회 다운로드, `watch --webhook` (둘 다 opt-in) |
| 외부 통신 차단 | `KORDOC_OFFLINE=1` — 요청 발신 전 차단 |
| 파일 접근 제한 | `KORDOC_ROOT=<디렉토리>` — MCP 읽기·쓰기를 해당 하위로 한정 |
| 계정·API 키 | 없음 (인증 요소를 사용하지 않음) |
| 텔레메트리·사용 통계 | 없음 |
| 설치 방식 | 오프라인 tarball · 포터블 ZIP · MSI (npm 레지스트리 불필요) |

## 2. 반입 번들 만들기 (인터넷 되는 PC)

네이티브 모듈이 포함되므로 **반입 대상과 같은 OS/CPU** 에서 만들어야 한다.
번들 파일명에 플랫폼이 박힌다 (`kordoc-offline-4.7.2-linux-x64.tar.gz`).

```bash
git clone https://github.com/chrisryugj/kordoc.git && cd kordoc
npm ci && npm run build

# 기본 (파서만, 가벼움)
node scripts/pack-offline.mjs

# OCR 엔진 + 모델까지 포함
node scripts/pack-offline.mjs --with-ocr --with-models
```

`--with-models` 는 로컬 캐시의 모델을 SHA-256 검증 후 동봉한다. 캐시가 비어 있으면
먼저 `kordoc check-ocr-models` / `kordoc check-formula-models` 로 내려받는다.

산출물은 `dist-offline/` 에 생기고, 압축 안에 `INSTALL.md` 가 함께 들어간다.

### Windows — 포터블 ZIP 과 MSI

Windows 반입은 압축 형식만 다르고 내용은 같은 두 산출물을 쓴다. 어느 쪽이든 **압축을 풀거나
설치한 뒤 그 자리에서 바로 실행**되며 npm 레지스트리를 찾지 않는다.

```powershell
# 1) 포터블 ZIP — 압축을 풀면 끝 (관리자 권한·설치 흔적 없음)
node scripts/pack-offline.mjs --target win32-x64 --format zip
#    → dist-offline/kordoc-offline-<버전>-win32-x64.zip

# 2) MSI — OCR 엔진·모델 포함 (WiX Toolset v5 필요)
node dist/cli.js check-ocr-models
node scripts/build-msi.mjs --target win32-x64 --with-ocr --with-models
#    → dist-offline/kordoc-<버전>-win-x64.msi
```

두 스크립트는 **같은 staging 트리**를 쓰므로 ZIP 과 MSI 의 내용이 갈라지지 않는다.

| | 포터블 ZIP | MSI |
|---|---|---|
| 설치 위치 | 푼 디렉토리 그대로 | `%ProgramFiles%\kordoc` |
| 실행기 | 압축 안 `bin\kordoc.cmd`·`bin\kordoc-mcp.cmd` (PATH 추가는 사용자가) | 같은 실행기를 PATH 에 자동 추가 |
| 환경변수 | 사용자가 설정 | `KORDOC_OFFLINE=1` 을 시스템 변수로 설정 |
| OCR 모델 | `--with-models` 로 넣었다면 `models --import` 실행 | `--with-models` 로 넣었다면 설치 폴더의 모델을 `KORDOC_MODEL_CACHE` 로 자동 연결 |
| 이전 버전 | 폴더를 지우면 끝 | `MajorUpgrade` 로 자동 대체 (같은 `UpgradeCode`) |
| 관리자 권한 | 불필요 | 필요 |

둘 다 Node.js 20 이상이 설치되어 있고 `node` 가 PATH 에 있어야 한다(실행기가 `node` 를 부른다).

MSI 는 WiX Toolset 이 필요하므로 Windows 또는 CI 에서 만든다.
[`.github/workflows/windows-package.yml`](../.github/workflows/windows-package.yml) 이
windows-latest 러너에서 `typecheck → test → build → 포터블 ZIP → MSI` 를 한 번에 돌리고,
태그(`v*`) 푸시면 OCR 엔진·모델을 포함한 두 파일을 GitHub Release 에 첨부한다.

```bash
# 태그 없이 산출물만 받기
gh workflow run "Windows package (portable ZIP + MSI)"
gh run download -n kordoc-windows-<sha>
```

## 3. 설치 (내부망 PC)

```bash
tar -xzf kordoc-offline-<버전>-<플랫폼>.tar.gz
cd kordoc-offline-<버전>-<플랫폼>
node node_modules/kordoc/dist/cli.js --version
```

Windows 는 압축 안 `INSTALL.md` 의 PowerShell 절차를 따르거나 MSI 를 설치한다.

```powershell
Expand-Archive -Path kordoc-offline-<버전>-win32-x64.zip -DestinationPath .
cd kordoc-offline-<버전>-win32-x64
node node_modules\kordoc\dist\cli.js --version
```

npm 레지스트리 접근이 일어나지 않는다. 모델을 별도로 반입했다면:

```bash
node node_modules/kordoc/dist/cli.js models --import ./models   # SHA-256 검증 포함
node node_modules/kordoc/dist/cli.js models --status
```

## 4. 운영 시 제한 모드

시스템 환경변수 또는 서비스 정의에 **두 변수를 고정**하는 것을 권장한다.

```bash
export KORDOC_OFFLINE=1
export KORDOC_ROOT=/srv/kordoc/work
```

| 변수 | 효과 | 위반 시 동작 |
|------|------|--------------|
| `KORDOC_OFFLINE` | 모델 다운로드·webhook 등 모든 아웃바운드를 시도 전에 차단 | 예외 발생, 사이드로드 방법 안내 |
| `KORDOC_ROOT` | MCP 서버의 파일 읽기·쓰기를 해당 디렉토리 하위로 제한 | `KORDOC_ROOT 밖의 경로입니다` 예외 |

`KORDOC_ROOT` 판정은 심볼릭 링크를 해석한 실제 경로(realpath)로 하므로 링크로
빠져나갈 수 없고, 형제 디렉토리(`/srv/kordoc/work-old`)도 통과하지 않는다.

MCP 서버는 기동 시 적용된 제한을 stderr 에 한 줄 남긴다:

```
[kordoc-mcp] 제한 모드: offline, root=/srv/kordoc/work
```

폐쇄망 모드에서 `kordoc setup` 을 실행하면 MCP 등록 항목이 `npx` 대신 설치된
`dist/mcp.js` 절대경로로 기록되고, 위 두 변수가 설정 파일의 `env` 에 함께 박힌다.

## 5. 아웃바운드 통신 전량 목록

소스 전체에서 `fetch` 를 호출하는 지점은 두 곳뿐이다.

| # | 위치 | 목적지 | 발생 조건 | 차단 |
|---|------|--------|-----------|------|
| 1 | `src/pdf/formula/models.ts` | `huggingface.co` | OCR/수식 기능 사용 + 모델 미캐시 (최초 1회) | `KORDOC_OFFLINE=1` |
| 2 | `src/watch.ts` | 운영자가 지정한 URL | `kordoc watch --webhook <url>` 명시 시에만 | `KORDOC_OFFLINE=1` |

검증(재현 가능):

```bash
grep -rnE '\bfetch\(' src --include='*.ts'          # 소스 기준 2건
grep -rn 'await fetch(' dist/*.js dist/*.cjs        # 빌드 산출물 기준(ESM/CJS 중복 포함)
```

인쇄·렌더 PDF의 Chromium 페이지는 `launchLockedPage`에서 JavaScript를 끄고
`data:`·`about:` 외 모든 요청을 차단한다. 이 제한은 `KORDOC_OFFLINE` 설정과 무관하게
항상 적용되며, 문서가 참조하는 외부 이미지·CSS·글꼴도 가져오지 않는다.

두 경로 모두 `assertNetworkAllowed()`(`src/shared/offline.ts`)를 먼저 통과한다.
새 통신 경로를 추가하려면 이 함수를 거치도록 강제되어 있으므로, 감사 지점은 하나다.

webhook 은 `KORDOC_OFFLINE` 과 무관하게 상시 SSRF 방어가 걸려 있다 — http/https 만
허용하고, 사설 대역·루프백·링크로컬·클라우드 메타데이터 주소를 문자열 검사와
DNS 해석 결과 재검증으로 이중 차단하며 리다이렉트를 금지한다. 즉 내부망 주소로는
애초에 보낼 수 없다.

## 6. 데이터 흐름

입력 문서는 프로세스 메모리 안에서만 처리되고, 결과는 표준출력 또는 사용자가 지정한
출력 경로에만 쓰인다. 원문·파싱 결과를 외부로 보내는 경로는 없다 (5장 표가 전량).

임시 파일은 모델 다운로드 시의 `.part` 파일이 유일하며, 캐시 디렉토리
(`~/.cache/kordoc/models/`, `KORDOC_MODEL_CACHE` 로 변경 가능) 안에서만 생성된다.

## 7. 의존성

런타임 필수 의존성은 5개(`@modelcontextprotocol/sdk`, `@xmldom/xmldom`, `jszip`,
`markdown-it`, `zod`)이다. `cfb` 도 `dependencies` 에 선언되어 있으나 빌드 시 번들에
인라인되어 배포본에는 모듈 참조가 남지 않는다. OCR·PDF·인쇄 기능은
optional dependency 로 분리되어, 쓰지 않으면 설치할 필요가 없다
(`pack-offline.mjs` 기본값이 이를 제외한다).

라이선스 고지는 [`NOTICE`](../NOTICE), [`THIRD_PARTY/`](../THIRD_PARTY) 참조.
`npm audit --omit=dev` 기준 알려진 취약점 0건이다.

## 8. 검토 체크리스트

- [ ] 반입 번들이 대상과 동일한 OS/CPU 에서 생성되었는가
- [ ] Windows 라면 포터블 ZIP 또는 MSI 중 반입 절차에 맞는 쪽을 골랐는가
- [ ] (MSI) 설치 후 `KORDOC_OFFLINE` 시스템 변수와 PATH 의 `bin` 이 의도대로 들어갔는가
- [ ] `KORDOC_OFFLINE=1` 이 시스템 환경변수로 고정되었는가
- [ ] `KORDOC_ROOT` 이 업무 디렉토리로 고정되었는가 (MCP 사용 시)
- [ ] 모델을 반입했다면 `models --status` 가 전 항목 `verified: true` 인가
- [ ] MCP 서버 기동 로그에 `제한 모드:` 줄이 찍히는가
- [ ] 문서 처리 중 외부 연결이 없음을 망 모니터링으로 확인했는가
