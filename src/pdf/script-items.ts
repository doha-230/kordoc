/**
 * PDF 위·아래첨자 — 한 시각 줄에서 본문보다 작은 글자 조각이 왼쪽 글자에 붙어(간격 0.35em 안) 기준선이 올라가면 위첨자,
 * 내려가면 아래첨자다("10⁴"·"m²"·"H₂O"·"x_i"·"commitments.⁴"·"Kim∗†"). 줄 머리에 홀로 선 작은 조각(각주 본문 첫머리 "¹ …")은
 * 붙은 글자가 없어 건드리지 않는다.
 *
 * 태그는 글을 다 이은 뒤에 넣는다(tagScripts) — 줄 이음·칸 줄 병합 판정은 글 끝 글자를 보므로 평문으로 끝내야 종전과 같다.
 * 완성된 글에서 조각 글을 읽기 순서로 짚어 가다 조각 사이에 공백 아닌 차이가 보이면(하이픈 지움 등) 그 글은 태그 없이 둔다.
 */

import { tidyScriptTags, type ScriptKind } from "../script-tags.js"

interface ScriptItem { text: string; x: number; y: number; w: number; fontSize: number }

/** x 순으로 놓인 한 시각 줄 조각의 첨자 종류 */
export function scriptKindsOfLine(sorted: ScriptItem[]): (ScriptKind | null)[] {
  const kinds: (ScriptKind | null)[] = sorted.map(() => null)
  if (sorted.length < 2) return kinds
  // 본문 글자 크기 = 글자 수로 가중한 최빈 크기, 본문 기준선 = 그 크기 조각 y 의 가운데값
  const weight = new Map<number, number>()
  for (const it of sorted) {
    const k = Math.round(it.fontSize * 2) / 2
    weight.set(k, (weight.get(k) ?? 0) + it.text.trim().length)
  }
  let bodyFs = 0, best = -1
  for (const [fs, n] of weight) if (n > best || (n === best && fs > bodyFs)) { best = n; bodyFs = fs }
  if (bodyFs <= 0) return kinds
  const ys = sorted.filter(it => Math.abs(it.fontSize - bodyFs) <= bodyFs * 0.12).map(it => it.y).sort((a, b) => a - b)
  const bodyY = ys[ys.length >> 1]
  const isBody = (it: ScriptItem) => it.fontSize > bodyFs * 0.85
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i], prev = sorted[i - 1]
    const t = it.text.trim()
    if (!t || t.length > 16 || isBody(it)) continue
    if (!isBody(prev) && !kinds[i - 1]) continue
    const gap = it.x - (prev.x + prev.w)
    if (gap > bodyFs * 0.35 || gap < -bodyFs * 0.5) continue
    const dy = it.y - bodyY
    if (dy >= bodyFs * 0.15) kinds[i] = "sup"
    else if (dy <= -bodyFs * 0.08) kinds[i] = "sub"
  }
  return kinds
}

/**
 * 완성된 글에 첨자 태그를 넣는다 — lines 는 글을 만든 순서의 시각 줄(각 줄은 x 순). 조각 글이 순서대로,
 * 사이에 공백(공백·탭·줄바꿈)만 두고 나오지 않으면 원문 그대로 돌려준다
 */
export function tagScripts(text: string, lines: ScriptItem[][]): string {
  const marks: Array<[number, number, ScriptKind]> = []
  let cursor = 0
  for (const line of lines) {
    const kinds = scriptKindsOfLine(line)
    for (let k = 0; k < line.length; k++) {
      const t = line[k].text
      if (!t) continue
      const at = text.indexOf(t, cursor)
      if (at < 0 || /\S/.test(text.slice(cursor, at))) return text
      if (kinds[k]) marks.push([at, at + t.length, kinds[k]!])
      cursor = at + t.length
    }
  }
  if (!marks.length) return text
  let out = text
  for (let m = marks.length - 1; m >= 0; m--) {
    const [s, e, kind] = marks[m]
    out = out.slice(0, s) + `<${kind}>` + out.slice(s, e) + `</${kind}>` + out.slice(e)
  }
  return tidyScriptTags(out)
}
