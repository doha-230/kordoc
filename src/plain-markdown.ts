/**
 * 평문 Markdown(`plain` 옵션) — 글만 필요한 색인·RAG 용. 구조(제목·목록·표)는 두고 글이 아닌 표기만 걷는다:
 * 그림 자리 표시(`![image](…)`·칸 안 `<img>`), 링크 URL(`[글](https://…)` → 글), 밑줄 `<u>`, 굵게 `**`.
 * 첨자 `<sup>`·`<sub>` 는 값이 바뀌지 않게 `^`·`_` 로 편다("10^4"·"H_2O", script-tags plainScripts).
 * 이미지 바이트를 저장하지 않는 호출에서 그림 자리 표시는 가리키는 파일이 없는 링크다.
 */

import { plainScripts } from "./script-tags.js"

export function toPlainMarkdown(md: string): string {
  return plainScripts(md)
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/(?<!!)\[([^\]\n]*)\]\((?:https?|mailto|ftp):[^)\s]*\)/g, "$1")
    .replace(/<\/?u>/g, "")
    .replace(/(?<!\\)\*\*(?=\S)([^\n]*?\S)(?<!\\)\*\*/g, "$1")
    .replace(/(<br>)+(?=<\/t[dh]>)/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
