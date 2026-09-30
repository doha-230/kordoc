// Windows MSI 설치 패키지 생성 (WiX Toolset v5).
//
// 포터블 ZIP 은 "압축을 풀면 끝" 이지만, 폐쇄망 반입 절차에 설치 프로그램을 요구하는 곳이
// 많다. 이 스크립트는 pack-offline 과 **같은 staging** 을 그대로 MSI 로 굽는다 — 두 산출물의
// 내용이 갈라지지 않는다.
//
// 사용 (Windows 또는 WiX v5 가 있는 CI 러너):
//   node scripts/build-msi.mjs [--target win32-x64] [--out <dir>] [--with-ocr] [--with-models] [--keep-stage] [--from-stage]
//
// 필요한 도구: WiX v5 — `dotnet tool install --global wix --version 5.0.0`
//   WIX_EXE 환경변수로 실행 파일을 지정할 수도 있다 (기본: PATH 의 `wix`).
//
// MSI 가 하는 일:
//   - [ProgramFiles64Folder]\kordoc 에 설치 트리 전체를 넣는다
//   - KORDOC_OFFLINE=1 을 시스템 환경변수로 설정한다 (폐쇄망 기본 — 제거 가능)
//   - [ProgramFiles64Folder]\kordoc\bin 을 시스템 PATH 뒤에 덧붙인다 (kordoc / kordoc-mcp 실행기)
//   - MajorUpgrade 로 이전 버전을 대체한다 (같은 UpgradeCode)

import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, renameSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs as parsePackArgs, stageOfflineBundle } from "./pack-offline.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** 모든 버전이 공유해야 하는 업그레이드 식별자 — 바꾸면 이전 설치를 대체하지 못한다 */
const UPGRADE_CODE = "8c4c0d6a-9f2e-4c81-b0a3-5f1d7e6b2a44"
/** 환경변수 컴포넌트의 고정 Guid — 버전마다 다시 만들면 업그레이드 때 고아 컴포넌트가 남는다 */
const ENV_COMPONENT_GUID = "3f6d9a51-7b28-4e0c-8d94-6a1b0c5e7f32"

const args = process.argv.slice(2)
const pack = parsePackArgs(args)
const target = pack.target.startsWith("win32") ? pack.target : "win32-x64"
const arch = target.endsWith("arm64") ? "arm64" : "x64"
const outDir = pack.outDir
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"))

const version = pkg.version
const msiName = `kordoc-${version}-${arch === "arm64" ? "win-arm64" : "win-x64"}.msi`
const workDir = join(outDir, `msi-work-${version}-${arch}`)

console.error(`[build-msi] kordoc ${version} ${arch} → ${join(outDir, msiName)}`)
rmSync(workDir, { recursive: true, force: true })
mkdirSync(workDir, { recursive: true })

// 1. pack-offline 과 같은 staging (ZIP/타르볼과 내용 동일)
const staged = args.includes("--from-stage")
  ? { stage: join(outDir, `kordoc-offline-${version}-${target}`) }
  : stageOfflineBundle({ ...pack, target, outDir: workDir, withModels: pack.withModels })
if (!existsSync(staged.stage)) throw new Error(`MSI 입력 staging 이 없습니다: ${staged.stage}`)
const payload = join(workDir, "payload")
renameSync(staged.stage, payload)

// 2. WiX v5 소스 — <Files Include> 로 트리 전체를 수확한다 (heat 불필요)
const wxs = join(workDir, "kordoc.wxs")
writeFileSync(wxs, wixSource({ version, manufacturer: pkg.author ?? "kordoc", arch, withModels: pack.withModels }))

// 3. wix build
const exe = resolveWix()
if (!exe) {
  console.error(
    "[build-msi] WiX Toolset v5 를 찾지 못했습니다.\n" +
      "  Windows:  dotnet tool install --global wix --version 5.0.0\n" +
      "  그 밖:    .github/workflows/windows-package.yml 이 windows-latest 러너에서 이 스크립트를 실행합니다.\n" +
      `  준비된 staging 은 그대로 남겨둡니다: ${workDir}`,
  )
  process.exit(1)
}
console.error(`[build-msi] wix build (${exe}) …`)
const built = spawnSync(exe.command, [...exe.prefix, "build", wxs, "-arch", arch, "-o", join(outDir, msiName)], {
  cwd: workDir,
  stdio: "inherit",
})
if (built.status !== 0) {
  console.error(`[build-msi] wix build 실패 (exit ${built.status ?? "?"}) — staging 은 ${workDir} 에 남겨둡니다`)
  process.exit(built.status ?? 1)
}
if (!existsSync(join(outDir, msiName))) {
  console.error("[build-msi] wix build 가 성공을 보고했지만 산출물이 없습니다")
  process.exit(1)
}

if (!pack.keepStage) rmSync(workDir, { recursive: true, force: true })
console.error(`[build-msi] 완료: ${join(outDir, msiName)}`)

/** `wix` 실행 파일 탐색 — WIX_EXE > PATH > dotnet tool */
function resolveWix() {
  if (process.env.WIX_EXE) return { command: process.env.WIX_EXE, prefix: [] }
  for (const [command, prefix] of [["wix", []], ["wix.exe", []], ["dotnet", ["tool", "run", "wix", "--"]]]) {
    try {
      execFileSync(command, [...prefix, "--version"], { stdio: "ignore" })
      return { command, prefix }
    } catch {
      /* 다음 후보 */
    }
  }
  return undefined
}

/** WiX v5 소스. Files Include 는 이 .wxs 가 있는 디렉터리 기준 상대경로다 */
function wixSource({ version, manufacturer, arch, withModels }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
  <Package
    Name="kordoc"
    Manufacturer="${escapeXml(manufacturer)}"
    Version="${version}"
    UpgradeCode="${UPGRADE_CODE}"
    Scope="perMachine"
    Compressed="yes">
    <MajorUpgrade DowngradeErrorMessage="kordoc 최신 버전이 이미 설치되어 있습니다. 제어판에서 기존 버전을 제거한 뒤 다시 실행하세요." />
    <MediaTemplate EmbedCab="yes" />

    <StandardDirectory Id="ProgramFiles64Folder">
      <Directory Id="INSTALLFOLDER" Name="kordoc" />
    </StandardDirectory>

    <Feature Id="Main" Title="kordoc ${version}" Level="1">
      <ComponentGroupRef Id="PayloadFiles" />
      <ComponentGroupRef Id="PayloadEnvironment" />
    </Feature>
  </Package>

  <Fragment>
    <ComponentGroup Id="PayloadFiles" Directory="INSTALLFOLDER">
      <Files Include="payload\\**" />
    </ComponentGroup>
  </Fragment>

  <Fragment>
    <ComponentGroup Id="PayloadEnvironment" Directory="INSTALLFOLDER">
      <Component Id="KordocEnvironment" Guid="${ENV_COMPONENT_GUID}">
        <CreateFolder />
        <!-- 폐쇄망 기본값: 아웃바운드(모델 다운로드·webhook)를 시도 전에 막는다 -->
        <Environment Id="Offline" Name="KORDOC_OFFLINE" Value="1" Action="set" Part="all" System="yes" Permanent="no" />
        ${withModels ? '<Environment Id="ModelCache" Name="KORDOC_MODEL_CACHE" Value="[INSTALLFOLDER]models" Action="set" Part="all" System="yes" Permanent="no" />' : ''}
        <!-- kordoc / kordoc-mcp 실행기(bin\\*.cmd)를 PATH 뒤에 덧붙인다 -->
        <Environment Id="PathEntry" Name="PATH" Value="[INSTALLFOLDER]bin" Action="set" Part="last" System="yes" Permanent="no" />
      </Component>
    </ComponentGroup>
  </Fragment>
</Wix>
`
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch])
}
