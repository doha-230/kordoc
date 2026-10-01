/** CLI/MCP image references share Unicode handling and filesystem confinement. */
import { constants } from "fs"
import { open, realpath } from "fs/promises"
import { isAbsolute, relative, resolve, sep } from "path"

function isChild(directory: string, target: string): boolean {
  const rel = relative(directory, target)
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

export async function loadGenerationImages(
  markdown: string,
  imageDir: string,
  assertPath?: (path: string) => void,
): Promise<{ images: Record<string, Uint8Array>; warnings: string[] }> {
  const directory = await realpath(resolve(imageDir))
  assertPath?.(directory)
  const images: Record<string, Uint8Array> = Object.create(null)
  const warnings: string[] = []
  const seen = new Set<string>()
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const url = match[1]
    // Remote URLs are not fetched; inline data is handled by the generator.
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || seen.has(url)) continue
    seen.add(url)
    let name = url
    try { name = decodeURIComponent(url) } catch { /* Keep literal malformed percent sequences. */ }
    const candidate = resolve(directory, name)
    const skip = (reason: string) => warnings.push(`이미지 건너뜀: ${url} (${reason})`)
    if (isAbsolute(name) || name.includes("\\") || name.includes("\0") || /^[a-z][a-z0-9+.-]*:/i.test(name) || !isChild(directory, candidate)) {
      skip("이미지 폴더 밖")
      continue
    }
    try {
      // Check the file, not just its directory: leaf and ancestor symlinks can escape.
      const target = await realpath(candidate)
      if (!isChild(directory, target)) {
        skip("이미지 폴더 밖")
        continue
      }
      assertPath?.(target)
      const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
      try {
        if (!(await file.stat()).isFile()) {
          skip("일반 파일 아님")
          continue
        }
        images[url] = new Uint8Array(await file.readFile())
      } finally {
        await file.close()
      }
    } catch (err) {
      skip((err as NodeJS.ErrnoException)?.code === "ENOENT" ? "파일 없음" : "파일 접근 불가")
    }
  }
  return { images, warnings }
}
