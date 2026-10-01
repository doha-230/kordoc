/**
 * 그림 든 표의 쪽 넘김·쌓인 표 — 복장 도면·안전보건표지처럼 칸에 큰 그림이 든 한컴 PDF 표 (법령 별표 실측을 합성 좌표로).
 *
 * 경찰복제 특수복식: 그림 행을 쪼개지 않아 앞 쪽 바닥이 크게 빈 채 다음 쪽으로 넘어간 표, 같은 머리를 단 표가 쪽마다 새로 놓인 것,
 * 2.76pt 틈을 두고 쌓은 두 표, 쪽 경계에 걸친 세로 병합 칸의 긴 글. 안전보건표지 [별표 6]: 열 짜임이 전혀 다른 다음 쪽 표.
 * 위험물 안전관리자 교육 [별표 4]: 마지막 칸이 한 쪽을 통째로 채우고 그다음 쪽 조각으로 이어지는 표.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { joinSplitParts, mergeCrossPageTables } from "../src/pdf/table-parts.js"
import { mergeContinuedCells } from "../src/pdf/cell-continuation.js"
import { buildClipCellGrids } from "../src/pdf/clip-cells.js"
import { CLIP_TABLES, CONT_PARTS, FILLER_CELLS, TABLE_COLXS, TABLE_ROWYS, recordCellLines } from "../src/pdf/table-meta.js"
import { markImageCell } from "../src/pdf/table-trim.js"
import type { IRBlock, IRCell, IRTable } from "../src/types.js"
import type { LineSegment } from "../src/pdf/line-types.js"

/** 앵커 목록 → 덮인 자리까지 채운 IR 격자 ([행, 열, 글, 열병합, 행병합]) */
function grid(rows: number, cols: number, anchors: Array<[number, number, string, number?, number?]>): IRTable {
  const cells: IRCell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ text: "", colSpan: 1, rowSpan: 1 })))
  for (const [r, c, text, cs = 1, rs = 1] of anchors) cells[r][c] = { text, colSpan: cs, rowSpan: rs }
  return { rows, cols, cells, hasHeader: rows > 1 }
}

/** 쪽·위치를 가진 클립 표 블록 (y 는 밑변, 쪽 좌표). rowYs 를 주면 행 경계도 기록 */
function clipBlock(table: IRTable, colXs: number[], page: number, y: number, height: number, rowYs?: number[]): IRBlock {
  CLIP_TABLES.add(table)
  TABLE_COLXS.set(table, colXs)
  if (rowYs) TABLE_ROWYS.set(table, rowYs)
  return { type: "table", table, pageNumber: page, bbox: { page, x: colXs[0], y, width: colXs[colXs.length - 1] - colXs[0], height } }
}

/** 칸 글줄 기록 — [왼끝, 오른끝, 기준선] 줄마다 글자 크기 10 */
function lines(cell: IRCell, spec: Array<[number, number, number]>): void {
  recordCellLines(cell, spec.map(([l, r, y]) => ({ x: l, y, w: r - l, fontSize: 10, h: 10 })))
}

const PAGE_H = new Map([[1, 841], [2, 841], [3, 841]])

describe("쪽 넘김 잇기 — 그림 행이 밀려난 표", () => {
  /** 앞 쪽 조각 — 밑변 142pt (쪽 끝 띠 0.16 × 841 = 134.6pt 위) */
  const front = () => clipBlock(grid(2, 3, [[0, 0, "상의"], [0, 1, "가. 방한외투"], [0, 2, "진청색"], [1, 0, "하의"], [1, 1, "나. 방한복"], [1, 2, "회청색"]]),
    [58, 80, 270, 537], 1, 142, 641, [783, 700, 142])

  it("다음 쪽 첫 행 묶음(세로 병합으로 이은 세 행, 그림 칸)이 앞 쪽 남은 자리보다 높으면 밀려난 것이라 잇는다", () => {
    // 첫 칸이 세 행을 덮는다 — 783 → 596 (187pt) 가 앞 쪽 밑변 142pt 아래에 들어갈 수 없다
    const lead = () => {
      const t = grid(3, 3, [[0, 0, "방한외투 및 방한복", 1, 3], [0, 1, "마. 방한복 하의"], [0, 2, "회청백색", 1, 3], [1, 1, "1) 앞면"], [2, 1, ""]])
      return { t, block: clipBlock(t, [58, 80, 270, 537], 2, 596, 187, [783, 762, 740, 596]) }
    }
    const pushed = lead()
    markImageCell(pushed.t.cells[2][1]) // 도면 그림 칸
    const blocks = [front(), pushed.block]
    mergeCrossPageTables(blocks, PAGE_H)
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].table!.rows, 5)
    // 글만 든 묶음은 쪽 경계에서 쪼개질 수 있어 밀려남의 증거가 아니다
    const textOnly = [front(), lead().block]
    mergeCrossPageTables(textOnly, PAGE_H)
    assert.equal(textOnly.length, 2)
  })

  it("머리 행 한 줄로 시작하는 새 표는 첫 묶음이 낮아(21pt) 잇지 않는다", () => {
    const back = clipBlock(grid(3, 3, [[0, 1, "도형"], [0, 2, "색상 및 재질"], [1, 0, "상의", 1, 2], [1, 1, "가. 근무복"], [1, 2, "검은색", 1, 2], [2, 1, ""]]),
      [58, 80, 270, 537], 2, 400, 383, [783, 762, 600, 400])
    const blocks = [front(), back]
    mergeCrossPageTables(blocks, PAGE_H)
    assert.equal(blocks.length, 2)
  })
})

describe("쪽 넘김 잇기 — 다음 쪽의 다른 표", () => {
  it("안쪽 열 경계가 하나도 안 맞물리고 첫 행부터 칸이 셋 이상이면 새 표다 (안전보건표지 13열 → 10열)", () => {
    const prev = clipBlock(grid(2, 4, [[0, 0, "1."], [0, 1, "101"], [0, 2, "102"], [0, 3, "103"], [1, 0, ""], [1, 1, ""], [1, 2, ""], [1, 3, ""]]),
      [58, 82, 196, 334, 534], 1, 115, 668)
    const curr = clipBlock(grid(2, 4, [[0, 0, "4."], [0, 1, "401"], [0, 2, "402"], [0, 3, "403"], [1, 0, ""], [1, 1, ""], [1, 2, ""], [1, 3, ""]]),
      [58, 105, 213, 404, 534], 2, 500, 283)
    const blocks = [prev, curr]
    mergeCrossPageTables(blocks, PAGE_H)
    assert.equal(blocks.length, 2)
  })

  it("1열 앞 조각(제목 틀)은 안쪽 경계가 없어 따지지 않고 잇는다", () => {
    const prev = clipBlock(grid(2, 1, [[0, 0, "[별표 3]"], [1, 0, "과징금의 부과기준"]]), [60, 508], 1, 47, 700)
    const curr = clipBlock(grid(2, 3, [[0, 0, "위반행위"], [0, 1, "근거"], [0, 2, "금액"], [1, 0, "가."], [1, 1, "법 제1조"], [1, 2, "100"]]),
      [60, 228, 347, 508], 2, 600, 183)
    const blocks = [prev, curr]
    mergeCrossPageTables(blocks, PAGE_H)
    assert.equal(blocks.length, 1)
  })

  it("같은 머리 글을 단 다음 쪽 표도 머리 칸 자리가 다르면 되풀이 머리 행이 아니라 새 표다", () => {
    const prev = grid(2, 3, [[0, 1, "도형"], [0, 2, "형태 및 규격"], [1, 0, "상의"], [1, 1, "가."], [1, 2, "1) 흰색"]])
    const same = grid(2, 3, [[0, 1, "도형"], [0, 2, "형태 및 규격"], [1, 0, "하의"], [1, 1, "라."], [1, 2, "1) 정복"]])
    assert.equal(joinSplitParts(prev, [58, 78, 263, 513], same, [58, 78, 254, 513]), null, "칸 경계 263 ↔ 254")
    const repeated = joinSplitParts(prev, [58, 78, 263, 513], same, [58, 78, 263, 513])
    assert.ok(repeated, "칸 자리까지 같으면 되풀이 머리 행")
    assert.equal(repeated.table.rows, 3)
    const moved = joinSplitParts(prev, [58, 78, 263, 513], same, [59.4, 79.4, 264.4, 514.4])
    assert.ok(moved, "짝·홀 쪽 여백만큼 통째로 옮겨진 머리 행도 되풀이 머리 행")
    assert.equal(moved.table.rows, 3)
  })
})

describe("쪽 넘김 잇기 — 쪽을 통째로 채운 마지막 칸", () => {
  it("다음 쪽 조각을 붙인 표는 그 쪽에서 끝난 것으로 보고 그다음 쪽 표와 잇는다", () => {
    const t1 = grid(2, 1, [[0, 0, "나. 실무교육"], [1, 0, "1) 교육시기"]])
    const b1 = clipBlock(t1, [53, 531], 1, 33, 750)
    // 2쪽: 마지막 칸의 이어짐 1칸 조각 — 쪽을 통째로 채운다
    const part = grid(1, 1, [[0, 0, "(3) 교육대상자인 위험물 안전관리자가 그 사유를 증명하"]])
    const b2 = clipBlock(part, [53, 531], 2, 36, 740)
    CONT_PARTS.set(part, { x1: 53, x2: 531 })
    lines(part.cells[0][0], [[60, 525, 60], [60, 525, 45]])
    // 3쪽: 이어진 글로 시작하는 표
    const t3 = grid(2, 1, [[0, 0, "는 서류를 제출해야 한다."], [1, 0, "2. 포장된 위험물"]])
    lines(t3.cells[0][0], [[60, 300, 770]])
    const b3 = clipBlock(t3, [53, 531], 3, 300, 482)
    const blocks = [b1, b2, b3]
    mergeContinuedCells(blocks, PAGE_H)
    assert.equal(blocks.length, 2, "2쪽 조각은 1쪽 칸에 붙는다")
    mergeCrossPageTables(blocks, PAGE_H)
    assert.equal(blocks.length, 1, "1쪽 표(2쪽에서 끝남)와 3쪽 표를 잇는다")
    assert.equal(blocks[0].table!.rows, 3, "3쪽 첫 행은 쪼개진 행")
  })
})

describe("쪽 넘김 잇기 — 쪽 경계에 걸친 세로 병합 칸의 긴 글", () => {
  it("한 열의 글이 끝줄을 꽉 채우고 이어지면 같은 모양의 옆 칸도 세로 병합으로 잇는다", () => {
    // 앞 조각: "상의" 이름표·규격·색상 칸이 두 행을 덮고, 도형 칸은 둘째 행에서 끝난다
    const prev = grid(2, 4, [[0, 0, "상의", 1, 2], [0, 1, "2) 여자 근무복"], [0, 2, "가) 상의\n남자 것과 같이 하되, 허리에 곡선을\n주며 주머니를 작게 한", 1, 2], [0, 3, "2) 여자\n가) 상의", 1, 2], [1, 1, "가) 상의 앞면"]])
    lines(prev.cells[0][2], [[270, 330, 90], [270, 450, 75], [270, 450, 60]])
    lines(prev.cells[0][3], [[460, 520, 90], [460, 500, 75]])
    // 뒤 조각: 이름표 칸은 클립 없이 넘어가고(채움), 도형 칸은 그림 두 칸으로 새 행, 규격·색상 칸은 이어진 글
    const curr = grid(1, 5, [[0, 1, ""], [0, 2, ""], [0, 3, "다."], [0, 4, "(1) 아이보리색"]])
    FILLER_CELLS.add(curr.cells[0][0])
    lines(curr.cells[0][3], [[270, 285, 770]])
    lines(curr.cells[0][4], [[460, 530, 770]])
    const res = joinSplitParts(prev, [58, 80, 265, 455, 537], curr, [58, 80, 170, 265, 455, 537], 0, 40)
    assert.ok(res)
    const t = res.table
    assert.equal(t.rows, 3)
    const spec = t.cells[0].find(c => c.text.startsWith("가) 상의\n남자"))!
    assert.equal(spec.rowSpan, 3, "규격 칸이 다음 쪽 행까지")
    assert.ok(spec.text.endsWith("다."))
    const color = t.cells[0].find(c => c.text.startsWith("2) 여자\n가) 상의"))!
    assert.equal(color.rowSpan, 3, "같은 모양의 색상 칸도")
    assert.ok(color.text.includes("아이보리색"))
  })
})

describe("buildClipCellGrids — 좁은 틈을 두고 쌓은 두 표", () => {
  const h = (y: number, x1: number, x2: number, lineWidth = 0.36): LineSegment => ({ x1, y1: y, x2, y2: y, lineWidth })
  // 위 표: 두 행(맞닿음), 아래 표: 두 행(맞닿음) — 가운데 열 경계가 다르다. 사이 2.76pt 틈
  const upper = [
    { x1: 58, y1: 585.9, x2: 80.8, y2: 783 }, { x1: 80.8, y1: 585.9, x2: 537.4, y2: 783 },
    { x1: 58, y1: 548.04, x2: 78.8, y2: 585.9 }, { x1: 78.8, y1: 548.04, x2: 259.5, y2: 585.9 }, { x1: 259.5, y1: 548.04, x2: 537.4, y2: 585.9 },
  ]
  const lower = [
    { x1: 58, y1: 523.9, x2: 78.8, y2: 545.28 }, { x1: 78.8, y1: 523.9, x2: 299.1, y2: 545.28 }, { x1: 299.1, y1: 523.9, x2: 537.4, y2: 545.28 },
    { x1: 58, y1: 262, x2: 78.8, y2: 523.9 }, { x1: 78.8, y1: 262, x2: 537.4, y2: 523.9 },
  ]

  it("틈 양끝에 제 테두리가 따로 그어졌으면 두 표 (경찰복제 특수복식 8쪽)", () => {
    const { grids } = buildClipCellGrids([...upper, ...lower], [h(548.04, 57.6, 538, 1.08), h(545.28, 57.6, 538)], [], 595, 841)
    assert.equal(grids.length, 2)
  })

  it("틈 한쪽 끝에만 괘선이 있으면(클립 없는 얇은 빈 행) 한 표", () => {
    const { grids } = buildClipCellGrids([...upper, ...lower], [h(548.04, 57.6, 538)], [], 595, 841)
    assert.equal(grids.length, 1)
  })

  it("이중선 테두리의 1pt 안팎 틈은 양끝에 괘선이 있어도 한 표 (지적공부 열람 신청서 0.95pt)", () => {
    const up = upper.map(r => ({ ...r })), low = lower.map(r => r.y2 === 545.28 ? { ...r, y2: 547.09 } : { ...r })
    const { grids } = buildClipCellGrids([...up, ...low], [h(548.04, 57.6, 538, 0.84), h(547.09, 57.6, 538, 0.84)], [], 595, 841)
    assert.equal(grids.length, 1)
  })
})
