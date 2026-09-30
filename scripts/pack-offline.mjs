// 폐쇄망(내부망) 반입용 오프라인 설치 번들 생성.
//
// kordoc tarball + 런타임 의존성을 **실제로 설치한 상태**로 묶는다. 내부망에서는
// 압축만 풀면 바로 실행되므로 npm 레지스트리도 인터넷도 필요 없다.
//
// 사용: node scripts/pack-offline.mjs [--out <dir>] [--with-ocr] [--with-models]
//                                    [--target <platform-arch>] [--format <tar.gz|zip>] [--keep-stage]
//   --with-ocr     OCR/수식 엔진(optional deps: onnxruntime-node·sharp·pdfium 등) 포함 (~수백MB)
//   --with-models  로컬 캐시의 OCR 모델을 함께 동봉 (kordoc models --export 와 동일 검증)
//   --target       산출물 이름에 박을 플랫폼 (기본: 이 PC 의 process.platform-process.arch).
//                  예: win32-x64 — Windows 반입용 번들을 Linux 에서 준비할 때
//   --format       압축 형식. 기본은 win32 대상이면 zip, 그 밖에는 tar.gz
//   --keep-stage   압축 후 staging 디렉터리를 지우지 않는다 (MSI 빌더·검증용)
//
// ⚠ 네이티브 모듈(sharp·onnxruntime-node·pdfium)은 OS/CPU 종속이다.
//    번들은 **반입 대상과 같은 OS/arch 에서** 만들어야 한다 — 파일명에 플랫폼을 박아둔다.
//    기본값처럼 optional 의존성을 뺀 번들은 순수 JS 라 OS 중립이지만, --with-ocr 는 아니다.

import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, readFileSync, writeFileSync, statSync, readdirSync, existsSync } from "node:fs"
import { join, dirname, resolve, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import JSZip from "jszip"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

// ─── CLI 인자 ────────────────────────────────────────

export function parseArgs(argv = process.argv.slice(2)) {
  const flag = name => argv.includes(`--${name}`)
  const value = (name, fallback) => {
    const at = argv.indexOf(`--${name}`)
    return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback
  }
  const target = value("target", `${process.platform}-${process.arch}`)
  const format = value("format", target.startsWith("win32") ? "zip" : "tar.gz")
  if (!["tar.gz", "zip"].includes(format)) throw new Error(`알 수 없는 --format: ${format} (tar.gz | zip)`)
  return {
    withOcr: flag("with-ocr"),
    withModels: flag("with-models"),
    keepStage: flag("keep-stage"),
    target,
    format,
    outDir: resolve(value("out", join(root, "dist-offline"))),
  }
}

export function run(cmd, cmdArgs, cwd = root) {
  return execFileSync(cmd, cmdArgs, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"] })
}

/** Windows 의 npm.cmd 는 execFileSync 로 직접 실행할 수 없어 npm CLI 를 node 로 부른다. */
function runNpm(args, cwd = root) {
  const cli = process.env.npm_execpath || join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
  if (existsSync(cli)) return run(process.execPath, [cli, ...args], cwd)
  if (process.platform === "win32") throw new Error(`npm CLI 파일을 찾을 수 없습니다: ${cli}`)
  return run("npm", args, cwd)
}

// ─── staging ─────────────────────────────────────────

/**
 * 설치 완료된 오프라인 트리를 `outDir/<stageName>/` 에 만든다.
 * 반환: { stage, stageName, version, platform }
 */
export function stageOfflineBundle(options) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"))
  const target = options.target ?? `${process.platform}-${process.arch}`
  const stageName = `kordoc-offline-${pkg.version}-${target}`
  const stage = join(options.outDir, stageName)

  console.error(`[pack-offline] ${stageName} (ocr=${options.withOcr}, models=${options.withModels})`)
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })

  // 1. kordoc 자체를 tarball 로 (npm pack 이 files 필드를 그대로 적용)
  console.error("[pack-offline] npm pack …")
  const packed = JSON.parse(runNpm(["pack", "--json", "--pack-destination", stage]))[0].filename
  const tgz = join(stage, packed)

  // 2. staging 에 실제 설치 — 내부망에서 압축만 풀면 되도록
  writeFileSync(
    join(stage, "package.json"),
    JSON.stringify({ name: "kordoc-offline", private: true, type: "module", dependencies: { kordoc: `file:${packed}` } }, null, 2) + "\n",
  )
  console.error("[pack-offline] npm install (오프라인 트리 구성) …")
  runNpm(["install", "--no-audit", "--no-fund", ...(options.withOcr ? [] : ["--omit=optional"])], stage)
  rmSync(tgz, { force: true })
  rmSync(join(stage, "package-lock.json"), { force: true })

  // 설치가 끝난 트리이므로 file: 참조를 남기지 않는다 — 내부망에서 npm install 을
  // 다시 돌리면 사라진 tgz 를 찾다 깨진다
  writeFileSync(
    join(stage, "package.json"),
    JSON.stringify(
      {
        name: "kordoc-offline",
        version: pkg.version,
        private: true,
        type: "module",
        description: "설치 완료된 kordoc 오프라인 트리 — npm install 불필요, INSTALL.md 참조",
      },
      null,
      2,
    ) + "\n",
  )

  // 3. 모델 동봉 (SHA 검증은 kordoc models --export 가 수행)
  if (options.withModels) {
    console.error("[pack-offline] 모델 내보내기 …")
    run(process.execPath, [join(root, "dist", "cli.js"), "models", "--export", join(stage, "models")])
  }

  // 4. Windows 는 PATH 에 올릴 bin/*.cmd 실행기 — "kordoc <파일>" 로 쓰기 위한 것
  if (target.startsWith("win32")) writeWindowsShims(stage)

  // 5. 설치 안내 — 폐쇄망 담당자가 이 파일만 보고 끝낼 수 있게
  writeFileSync(join(stage, "INSTALL.md"), installGuide(pkg.version, target, options.withModels))

  return { stage, stageName, version: pkg.version, target }
}

/** Windows 실행기 — 설치본 기준 상대경로로 부르며 node.exe 는 PATH 에 있어야 한다 */
function writeWindowsShims(stage) {
  const bin = join(stage, "bin")
  mkdirSync(bin, { recursive: true })
  const shim = script =>
    `@echo off\r\nrem kordoc 폐쇄망 실행기 — 이 파일은 node.exe 가 PATH 에 있는 환경에서 동작합니다\r\nnode "%~dp0..\\node_modules\\kordoc\\dist\\${script}" %*\r\n`
  writeFileSync(join(bin, "kordoc.cmd"), shim("cli.js"))
  writeFileSync(join(bin, "kordoc-mcp.cmd"), shim("mcp.js"))
  writeFileSync(
    join(bin, "README.txt"),
    "kordoc.cmd / kordoc-mcp.cmd 를 PATH 에 추가하면 어느 디렉터리에서든 실행할 수 있습니다.\r\n" +
      "Node.js 20 이상이 설치되어 있어야 합니다 (node.exe 가 PATH 에 있어야 함).\r\n",
  )
}

// ─── 압축 ────────────────────────────────────────────

/** staging 디렉터리 전체를 ZIP 으로. JSZip 은 순수 JS 라 어느 OS 에서도 같은 결과가 나온다 */
async function zipDirectory(sourceDir, destFile, rootName) {
  const zip = new JSZip()
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.isFile()) continue
      zip.file(`${rootName}/${relative(sourceDir, full).split("\\").join("/")}`, readFileSync(full))
    }
  }
  walk(sourceDir)
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } })
  writeFileSync(destFile, buf)
}

export async function archiveStage({ stage, stageName, outDir, format, keepStage }) {
  console.error(`[pack-offline] 압축 (${format}) …`)
  const name = `${stageName}.${format}`
  if (format === "zip") await zipDirectory(stage, join(outDir, name), stageName)
  else run("tar", ["-czf", name, stageName], outDir)
  if (!keepStage) rmSync(stage, { recursive: true, force: true })
  const sizeMb = (statSync(join(outDir, name)).size / 1024 / 1024).toFixed(1)
  console.error(`[pack-offline] 완료: ${join(outDir, name)} (${sizeMb}MB)`)
  return join(outDir, name)
}

// ─── 설치 안내 ───────────────────────────────────────

function installGuide(version, target, models) {
  const windows = target.startsWith("win32")
  const plat = target
  const extract = windows
    ? `Expand-Archive -Path kordoc-offline-${version}-${target}.zip -DestinationPath .
cd kordoc-offline-${version}-${target}`
    : `tar -xzf kordoc-offline-${version}-${plat}.tar.gz
cd kordoc-offline-${version}-${plat}`
  const cli = windows ? `node node_modules\\kordoc\\dist\\cli.js` : `node node_modules/kordoc/dist/cli.js`
  const shimNote = windows
    ? `

PATH 에 \`bin\\\` 을 추가하면 그 뒤로는 \`kordoc\` / \`kordoc-mcp\` 로 바로 부를 수 있습니다
(Node.js 20 이상이 설치되어 있고 \`node\` 가 PATH 에 있어야 합니다).`
    : ""
  return `# kordoc ${version} 오프라인 설치 (${plat})

인터넷·npm 레지스트리 접근 없이 설치합니다. 이 번들은 **${plat}** 전용입니다
(네이티브 모듈이 든 경우 다른 OS/CPU 에서는 같은 플랫폼에서 다시 만들어야 합니다).

## 1. 압축 해제

\`\`\`${windows ? "powershell" : "bash"}
${extract}
\`\`\`${shimNote}

## 2. 동작 확인

\`\`\`${windows ? "powershell" : "bash"}
${cli} --version
\`\`\`

## 3. 폐쇄망 제한 적용 (권장)

두 환경변수를 시스템/서비스 단위로 고정하십시오.

| 변수 | 값 | 효과 |
|------|-----|------|
| \`KORDOC_OFFLINE\` | \`1\` | 모든 아웃바운드 통신(모델 다운로드·webhook)을 시도 전에 차단 |
| \`KORDOC_ROOT\` | 작업 디렉토리 절대경로 | MCP 서버의 파일 읽기/쓰기를 해당 디렉토리 하위로 제한 |

## 4. MCP 서버 등록 (선택)

\`\`\`${windows ? "powershell" : "bash"}
${windows ? '$env:KORDOC_OFFLINE = "1"; $env:KORDOC_ROOT = "C:\\work";' : 'KORDOC_OFFLINE=1 KORDOC_ROOT=/작업/경로'} ${cli} setup
\`\`\`

폐쇄망 모드에서는 \`npx\` 대신 설치된 \`dist/mcp.js\` 절대경로로 등록되고,
위 두 변수가 MCP 설정 파일의 \`env\` 에 함께 기록됩니다.

${models
      ? `## 5. OCR 모델

동봉된 \`models/\` 를 캐시에 설치합니다 (SHA-256 검증 포함).

\`\`\`${windows ? "powershell" : "bash"}
${cli} models --import ./models
${cli} models --status
\`\`\`
`
      : `## 5. OCR 모델 (미동봉)

이 번들에는 OCR 모델이 없습니다. 필요하면 인터넷이 되는 PC 에서
\`kordoc models --export <디렉토리>\` 로 내보내 반입한 뒤
\`kordoc models --import <디렉토리>\` 로 설치하십시오.
`}
`
}

// ─── 진입점 ──────────────────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs()
  mkdirSync(options.outDir, { recursive: true })
  const staged = stageOfflineBundle(options)
  await archiveStage({ ...staged, outDir: options.outDir, format: options.format, keepStage: options.keepStage })
}
