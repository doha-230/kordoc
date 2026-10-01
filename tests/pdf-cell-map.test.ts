import { it } from "node:test"
import assert from "node:assert/strict"
import { mapTextToCells } from "../src/pdf/cell-text.js"
import type { ExtractedCell, TextItem } from "../src/pdf/line-types.js"

const item = (text: string, x: number, y: number, w = 10): TextItem => ({ text, x, y, w, h: 10, fontSize: 10, fontName: "F" })
function grid(): ExtractedCell[] {
  return Array.from({ length: 20 * 5 }, (_, i) => ({ row: i / 5 | 0, col: i % 5, rowSpan: 1, colSpan: 1, bbox: { x1: i % 5 * 50, x2: (i % 5 + 1) * 50, y1: (i / 5 | 0) * 20, y2: (i / 5 | 0) * 20 + 20 } }))
}
it("큰 표의 세로 병합 칸과 정상 칸에 글을 원래 순서로 배정한다", () => {
  const cells = grid()
  cells[0].rowSpan = 20; cells[0].bbox.y2 = 400
  const inputs = Array.from({ length: 100 }, (_, i) => item(String(i), i % 5 * 50 + 5, (i / 5 | 0) * 20 + 5)).reverse()
  const out = mapTextToCells(inputs, cells)
  assert.deepEqual(out.get(cells[0])!.map(x => x.text), inputs.filter(x => x.x === 5).map(x => x.text))
  for (let i = 1; i < 100; i++) assert.deepEqual(out.get(cells[i])!.map(x => x.text), i % 5 ? [String(i)] : [])
})
it("교차율 동률이면 좌표 정렬에 관계없이 원래 첫 칸을 선택하고 표 밖 글은 남긴다", () => {
  const cells = grid()
  const inputs = Array.from({ length: 80 }, (_, i) => item(String(i), 105, 45))
  inputs.push(item("경계", 25, 15, 20), item("바깥", 300, 500))
  const out = mapTextToCells(inputs, [cells[5], cells[0], ...cells.filter((_, i) => i !== 0 && i !== 5)])
  assert.deepEqual(out.get(cells[5])!.map(x => x.text), ["경계"])
  assert.ok(![...out.values()].flat().some(x => x.text === "바깥"))
})
