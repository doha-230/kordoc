/** 표 위 무괘선 단위 줄 — 원 구조에서는 합성 행, 보이는 표에서는 자기 테두리 없는 문단이다. */
import type { IRCell } from "../types.js"
import type { NormItem } from "./text-line.js"
import type { TableGrid } from "./line-types.js"
import { cleanCellText } from "./cell-text.js"
import { CELL_EDGES } from "../table/layout-frames.js"
import { NO_EDGES } from "./cell-edges.js"

const UNIT = /^\s*\(\s*단위\s*[:：]/

/** 과소분할 표 재구축을 위한 단위 줄 증거 — 표 위 18pt 안의 줄을 아래부터 본다. */
export function rebuildUnitLine(items: NormItem[], grid: TableGrid): NormItem[] {
  const nearby = items.filter(item => item.y >= grid.bbox.y2 && item.y - grid.bbox.y2 <= 18
    && item.x >= grid.bbox.x1 - 3 && item.x + item.w <= grid.bbox.x2 + 3)
  for (const y of [...new Set(nearby.map(item => Math.round(item.y)))].sort((a, b) => a - b)) {
    const line = nearby.filter(item => Math.abs(item.y - y) <= 1).sort((a, b) => a.x - b.x)
    if (UNIT.test(line.map(item => item.text).join(""))) return line
  }
  return []
}

export function prependUnitRow(cells: IRCell[][], cols: number, line: NormItem[], usedItems: Set<NormItem>): void {
  const text = cleanCellText(line.map(item => item.text).join(""))
  cells.unshift(Array.from({ length: cols }, (_, c) => ({ text: c === 0 ? text : "", colSpan: c === 0 ? cols : 1, rowSpan: 1 })))
  for (const cell of cells[0]) CELL_EDGES.set(cell, NO_EDGES)
  for (const item of line) usedItems.add(item)
}

/**
 * 칸 안쪽 여백(1.8mm≈5.1pt)만큼 들어간 단위 줄은 원 구조에 합친다.
 * 표 오른끝에 붙은 문단·칸 절반 넘게 빈 조각 격자는 제외한다.
 */
export function attachUnitRow(items: NormItem[], grid: TableGrid, cells: IRCell[][], cols: number, usedItems: Set<NormItem>): boolean {
  const all = cells.flat()
  if (all.filter(c => c.text.trim()).length * 2 < all.length || UNIT.test(cells[0]?.[0]?.text ?? "")) return false
  const above = items.filter(it => !usedItems.has(it) && it.y >= grid.bbox.y2 && it.y - grid.bbox.y2 <= 8
    && it.x >= grid.bbox.x1 - 3 && it.x + it.w <= grid.bbox.x2 + 3)
  let nearest = Infinity
  for (const it of above) nearest = Math.min(nearest, it.y)
  const line = above.filter(it => Math.abs(it.y - nearest) <= 1).sort((a, b) => a.x - b.x)
  const text = line.map(it => it.text).join("")
  const inset = line.length ? grid.bbox.x2 - (line[line.length - 1].x + line[line.length - 1].w) : 0
  if (!line.length || !UNIT.test(text) || inset < 4.6 || inset > 5.6) return false
  prependUnitRow(cells, cols, line, usedItems)
  return true
}
