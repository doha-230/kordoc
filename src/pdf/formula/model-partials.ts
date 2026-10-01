/** Process-owned temporary model downloads. Never infer abandonment from age alone. */
import { createHash, randomUUID } from "node:crypto"
import { readFileSync, readlinkSync } from "node:fs"
import { readdir, unlink } from "node:fs/promises"
import { hostname } from "node:os"
import { basename, dirname, join } from "node:path"

let scope: string | undefined
function ownerScope(): string {
  if (scope) return scope
  let namespace = ""
  if (process.platform === "linux") {
    try {
      // A cache may be shared by containers whose PID spaces differ. A missing
      // PID in this namespace says nothing about a download in another one.
      // Boot identity also separates machines with matching hostnames/ns inodes.
      const boot = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim()
      if (!boot) throw new Error("Kernel boot identity unavailable")
      namespace = `${boot}:${readlinkSync("/proc/self/ns/pid")}`
    } catch {
      // Fail closed if namespace identity is unavailable: only this process can
      // recognize its own paths; it will not scavenge another process's files.
      namespace = randomUUID()
    }
  }
  scope = createHash("sha256").update(`${process.platform}\0${hostname()}\0${namespace}`).digest("hex").slice(0, 32)
  return scope
}

export function modelDownloadPartialPath(localPath: string): string {
  return `${localPath}.kordoc-${ownerScope()}-${process.pid}-${randomUUID()}.part`
}

/** Best effort: cache maintenance must not prevent use of a valid model. */
export async function cleanupModelDownloadPartials(localPath: string): Promise<void> {
  const dir = dirname(localPath)
  const prefix = `${basename(localPath)}.kordoc-${ownerScope()}-`
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    // Do not follow symlinks, touch other models, or guess ownership for old
    // UUID-only partials/foreign hosts/namespaces. Their owner could still be live.
    if (!entry.isFile() || !entry.name.startsWith(prefix)) continue
    const match = /^([1-9]\d*)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.part$/.exec(entry.name.slice(prefix.length))
    if (!match) continue
    const pid = Number(match[1])
    if (!Number.isSafeInteger(pid) || pid > 0x7fffffff) continue
    try {
      process.kill(pid, 0)
      continue // Includes a reused PID: retaining an orphan beats deleting live data.
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ESRCH") continue // EPERM/unknown = potentially live.
    }
    try { await unlink(join(dir, entry.name)) } catch { /* Another cleaner may have won. */ }
  }
}
