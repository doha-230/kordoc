import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseSection } from "../src/hwp5/body.js"
import {
  parseDocInfo, TAG_BORDER_FILL, TAG_PARA_HEADER, TAG_PARA_TEXT, TAG_CTRL_HEADER, TAG_LIST_HEADER, TAG_TABLE,
  type HwpDocInfo, type HwpRecord,
} from "../src/hwp5/record.js"
import { CELL_EDGES, unframeLayoutTables } from "../src/table/layout-frames.js"

const NONE = { t: false, b: false, l: false, r: false }
const BOX = { t: true, b: true, l: true, r: true }
const rec = (tagId: number, level: number, data: Buffer): HwpRecord => ({ tagId, level, size: data.length, data })

function docInfo(): HwpDocInfo {
  const fill = Buffer.alloc(26)
  for (let k = 0; k < 4; k++) fill[2 + 6 * k] = 1
  return parseDocInfo([rec(TAG_BORDER_FILL, 0, fill)])
}

function parseTable(info: HwpDocInfo | null, titleBorder = 0, titleBytes = 34) {
  const table = Buffer.alloc(8)
  table.writeUInt16LE(2, 4)
  table.writeUInt16LE(2, 6)
  const records = [
    rec(TAG_PARA_HEADER, 0, Buffer.alloc(12)),
    rec(TAG_CTRL_HEADER, 1, Buffer.from(" lbt", "ascii")),
    rec(TAG_TABLE, 2, table),
  ]
  for (const [r, c, cs, text, border, bytes] of [
    [0, 0, 2, "[별지 서식]", titleBorder, titleBytes],
    [1, 0, 1, "성명", 1, 34],
    [1, 1, 1, "홍길동", 1, 34],
  ] as const) {
    const lh = Buffer.alloc(bytes)
    lh.writeUInt16LE(1, 0)
    lh.writeUInt16LE(c, 8)
    lh.writeUInt16LE(r, 10)
    lh.writeUInt16LE(cs, 12)
    lh.writeUInt16LE(1, 14)
    if (bytes >= 34) lh.writeUInt16LE(border, 32)
    records.push(rec(TAG_LIST_HEADER, 2, lh), rec(TAG_PARA_HEADER, 2, Buffer.alloc(12)), rec(TAG_PARA_TEXT, 3, Buffer.from(text, "utf16le")))
  }
  const blocks = parseSection(records, info, [], 1)
  const ir = blocks.find(b => b.type === "table")!.table!
  return { blocks, ir }
}

describe("HWP5 borderFillId 0 — 정의가 있는 1-based 목록의 선 없는 참조", () => {
  it("0 참조 글 행은 문단으로 풀고 양수 참조 표는 보존한다", () => {
    const { blocks, ir } = parseTable(docInfo())
    assert.deepEqual(CELL_EDGES.get(ir.cells[0][0]), NONE)
    assert.deepEqual(CELL_EDGES.get(ir.cells[1][0]), BOX)
    const visible = unframeLayoutTables(blocks)
    assert.deepEqual(visible.map(b => b.type), ["paragraph", "table"])
    assert.equal(visible[0].text, "[별지 서식]")
    assert.equal(visible[1].table!.rows, 1)
    assert.equal(visible[1].table!.cols, 2)
    assert.deepEqual(visible[1].table!.cells[0].map(c => c.text), ["성명", "홍길동"])
  })

  it("DocInfo 또는 테두리 정의가 없으면 0을 미상으로 둔다", () => {
    for (const info of [null, parseDocInfo([])]) {
      const { blocks, ir } = parseTable(info)
      assert.equal(CELL_EDGES.has(ir.cells[0][0]), false)
      assert.equal(unframeLayoutTables(blocks)[0].table, ir)
    }
  })

  it("정의 없는 양수 참조와 borderFillId 필드 없는 짧은 셀은 미상으로 둔다", () => {
    for (const [id, bytes] of [[2, 34], [0, 32]]) {
      const { blocks, ir } = parseTable(docInfo(), id, bytes)
      assert.equal(CELL_EDGES.has(ir.cells[0][0]), false)
      assert.equal(unframeLayoutTables(blocks)[0].table, ir)
    }
  })
})
