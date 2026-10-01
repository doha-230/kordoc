/**
 * 위·아래첨자 표지 — 파서가 첨자 글을 인라인 HTML `<sup>`·`<sub>` 로 감싸 IR 글에 넣는다(밑줄 `<u>` 와 같은 방식,
 * GFM 에 첨자 문법이 없다). 평문으로 펴면 "10⁴ m²" 가 "104 m2", "x_i" 가 "xi" 로 값이 바뀐다.
 * HWPX·HWP5·DOCX 는 글자 모양 속성, PDF 는 기준선·글자 크기로 판정한다.
 */

import type { IRBlock } from "./types.js"

export type ScriptKind = "sup" | "sub"

/** 첨자 글을 태그로 감싼다 — 앞뒤 공백은 태그 밖으로, 공백뿐이면 그대로 */
export function wrapScript(text: string, kind: ScriptKind | null | undefined): string {
  if (!kind) return text
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!
  return m[2] ? `${m[1]}<${kind}>${m[2]}</${kind}>${m[3]}` : text
}

/** 조각마다 감싼 태그 정리 — 이웃한 같은 태그를 합치고, 태그 안 앞뒤 공백을 밖으로 내고, 빈 태그를 지운다 */
export function tidyScriptTags(text: string): string {
  if (!text.includes("<su")) return text
  return text
    .replace(/<\/(sup|sub)><\1>/g, "")
    .replace(/<(sup|sub)>(\s+)/g, "$2<$1>")
    .replace(/(\s+)<\/(sup|sub)>/g, "</$2>$1")
    .replace(/<(sup|sub)><\/\1>/g, "")
}

/**
 * 평문(`plain`) 표기 — 태그를 걷되 값이 바뀌지 않게 `^`·`_` 로: "10^4"·"m^2"·"H_2O"·"x^(n+1)".
 * 글자·숫자(와 앞 부호)만이거나 주석 기호뿐이면 괄호 없이, 그 밖은 괄호로 묶는다.
 */
export function plainScripts(md: string): string {
  if (!md.includes("<su")) return md
  return md.replace(/<(sup|sub)>([^<\n]*)<\/\1>/g, (_, kind: string, body: string) => {
    const mark = kind === "sup" ? "^" : "_"
    return /^(?:[+\-−]?[\p{L}\p{N}]+|[*∗†‡§¶]+)$/u.test(body) ? mark + body : `${mark}(${body})`
  })
}

const TAG_RE = /<\/?su[bp]>/g

/**
 * 첨자 표기를 끈 결과(`scriptTags: false`, PDF·이미지 기본) — 마크다운·쪽별 마크다운·IR 글(문단·span·각주·목록·표 칸·캡션)에서
 * 태그만 걷는다. 파이프라인은 그대로 돌고 끝에서 걷으므로 글자 순서는 첨자 판정 전과 같다
 */
export function stripScriptTags<T extends { markdown?: string; blocks?: IRBlock[]; pages?: Array<{ markdown: string }> }>(r: T): T {
  const s = (t: string) => (t.includes("<su") ? t.replace(TAG_RE, "") : t)
  const walk = (bs: IRBlock[] | undefined): void => {
    for (const b of bs ?? []) {
      if (b.text) b.text = s(b.text)
      if (b.footnoteText) b.footnoteText = s(b.footnoteText)
      for (const sp of b.spans ?? []) sp.text = s(sp.text)
      walk(b.children)
      if (b.table) {
        if (b.table.caption) b.table.caption = s(b.table.caption)
        walk(b.table.captionBlocks)
        for (const row of b.table.cells) for (const c of row) { c.text = s(c.text); walk(c.blocks) }
      }
    }
  }
  walk(r.blocks)
  if (r.markdown) r.markdown = s(r.markdown)
  for (const p of r.pages ?? []) p.markdown = s(p.markdown)
  return r
}
