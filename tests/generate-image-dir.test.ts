/** #95 — generate --image-dir: 한글 이름 그림도 싣고, 폴더 밖 참조는 경고와 함께 뺀다 */

import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import JSZip from "jszip"

const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url))
// 1×1 PNG
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c90000000049454e44ae426082", "hex")

test("#95: 한글 파일 이름 그림이 실리고 폴더 밖 참조는 경고로 알린다", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kordoc-imgdir-"))
  try {
    const imgs = join(dir, "img")
    mkdirSync(imgs)
    writeFileSync(join(imgs, "재고-합계.png"), PNG)
    writeFileSync(join(imgs, "그림 하나.png"), PNG)
    writeFileSync(join(dir, "밖.png"), PNG)
    symlinkSync(join(dir, "밖.png"), join(imgs, "linked.png"))
    symlinkSync(dir, join(imgs, "linked-dir"), "dir")
    const md = join(dir, "문서.md")
    writeFileSync(md, `# 보고\n\n![그래프](재고-합계.png)\n\n![인코딩](${encodeURIComponent("그림 하나.png")})\n\n![밖](../밖.png)\n\n![링크](linked.png)\n\n![폴더 링크](linked-dir/밖.png)\n`)
    const out = join(dir, "문서.hwpx")
    const r = spawnSync(process.execPath, ["--import", "tsx", CLI, "generate", md, "-o", out, "--image-dir", imgs], { encoding: "utf-8", timeout: 60000 })
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stderr, /이미지 임베드: 2개/)
    assert.match(r.stderr, /이미지 건너뜀: \.\.\/밖\.png \(이미지 폴더 밖\)/)
    assert.match(r.stderr, /이미지 건너뜀: linked\.png \(이미지 폴더 밖\)/)
    assert.match(r.stderr, /이미지 건너뜀: linked-dir\/밖\.png \(이미지 폴더 밖\)/)
    const zip = await JSZip.loadAsync(readFileSync(out))
    const images = await Promise.all(Object.values(zip.files)
      .filter(file => !file.dir && file.name.startsWith("BinData/"))
      .map(file => file.async("nodebuffer")))
    assert.equal(images.filter(bytes => bytes.equals(PNG)).length, 2, "허용된 두 그림만 원본 바이트로 실려야 함")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
