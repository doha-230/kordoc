/**
 * 보도자료 연락처 표 — "담당 부서 | 부서 | 책임자·담당자 | 직위 | 이름 | 연락처". HWPX 원본은 코퍼스 470여 개가 모두 이 6열이지만,
 * 칸 클립 없이 점선으로 테두리만 그린 구버전 한컴 PDF 는 직위·이름·연락처 사이 세로선이 없고 이름과 연락처가 한 글 조각이라
 * 4열("과 장 정희철 (044-214-2730)" 한 칸)로 읽힌다. 끝 칸이 행마다 "직위 이름 (연락처)" 꼴이면 세 칸으로 가르고, 앞 두 열의
 * 전 행 병합 칸은 글줄이 행 수 이하면 줄마다 제 행 칸으로 나눈다(가로선이 없을 뿐 원본은 행마다 칸이다)
 */

import type { IRBlock, IRCell } from "../types.js"

export const CONTACT_HEAD = /^(?:담당\s*부서|<[^<>]+>)$/
export const CONTACT_ROLE = /^(?:책임자|담당자)$/
/** 직위(띄어 쓴 두 글자 "과 장" 포함) · 이름 2~4자 · 연락처(괄호 전화·전자우편) */
const PERSON = /^(.+?)\s+([가-힣]{2,4})\s+(\([^()]*\d[^()]*\)|\S+@\S+)$/

export function splitContactTables(blocks: IRBlock[]): void {
  for (const b of blocks) {
    const t = b.type === "table" ? b.table : undefined
    if (!t || t.cols !== 4 || t.rows < 2) continue
    const rows = t.cells
    if (!CONTACT_HEAD.test(rows[0][0].text.replace(/\s+/g, " ").trim())) continue
    const people = rows.map(r => PERSON.exec(r[3].text.replace(/\s+/g, " ").trim()))
    if (people.some(p => !p) || rows.some(r => !CONTACT_ROLE.test(r[2].text.replace(/\s+/g, "")) || r[2].rowSpan !== 1 || r[3].rowSpan !== 1)) continue
    // 앞 두 열 — 전 행 병합 칸만 줄마다 나눈다 (행마다 칸이면 그대로)
    const lead: string[][] = []
    let ok = true
    for (const c of [0, 1]) {
      const top = rows[0][c]
      if (top.rowSpan === 1) { lead.push(rows.map(r => r[c].text)); continue }
      const lines = top.text.split("\n").map(s => s.trim()).filter(Boolean)
      if (top.rowSpan !== t.rows || lines.length > t.rows) { ok = false; break }
      lead.push(rows.map((_, r) => lines[r] ?? ""))
    }
    if (!ok) continue
    const one = (text: string): IRCell => ({ text, colSpan: 1, rowSpan: 1 })
    t.cells = rows.map((r, i) => [one(lead[0][i]), one(lead[1][i]), one(r[2].text), one(people[i]![1]), one(people[i]![2]), one(people[i]![3])])
    t.cols = 6
  }
}
