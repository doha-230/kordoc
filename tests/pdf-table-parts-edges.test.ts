/**
 * PDF 쪽 넘김 표 잇기 — 가장자리 열이 빠진 조각과 쪽을 통째로 넘긴 칸 조각 (table-parts·cell-continuation).
 *
 * 한컴 PDF 는 쪽마다 그 쪽에 그려진 칸만 클립으로 깐다. 세로 병합 칸이 쪽 전체를 덮고 그 쪽에 글이 없으면 그 칸 자리에 클립이
 * 없어 가운데 쪽 조각은 왼쪽 열 없이 나오고, 쪼개진 끝 행에서 글 없이 넘어간 좌우 열도 다음 쪽 조각에서 빠진다.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { mergeCrossPageTables } from "../src/pdf/table-parts.js"
import { mergeContinuedCells } from "../src/pdf/cell-continuation.js"
import { CLIP_TABLES, CONT_PARTS, FILLER_CELLS, TABLE_COLXS, recordCellLines } from "../src/pdf/table-meta.js"
import type { IRBlock, IRCell, IRTable } from "../src/types.js"

/** 앵커 목록 → 덮인 자리까지 채운 IR 격자 ([행, 열, 글, 열병합, 행병합]) */
function grid(rows: number, cols: number, anchors: Array<[number, number, string, number?, number?]>): IRTable {
  const cells: IRCell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ text: "", colSpan: 1, rowSpan: 1 })))
  for (const [r, c, text, cs = 1, rs = 1] of anchors) cells[r][c] = { text, colSpan: cs, rowSpan: rs }
  return { rows, cols, cells, hasHeader: rows > 1 }
}

/** 쪽·위치를 가진 클립 표 블록 (y 는 밑변, 쪽 좌표) */
function clipBlock(table: IRTable, colXs: number[], page: number, y: number, height: number): IRBlock {
  CLIP_TABLES.add(table)
  TABLE_COLXS.set(table, colXs)
  return { type: "table", table, pageNumber: page, bbox: { page, x: colXs[0], y, width: colXs[colXs.length - 1] - colXs[0], height } }
}

/** 칸 글줄 기록 — [왼끝, 오른끝, 기준선] 줄마다 글자 크기 10 */
function lines(cell: IRCell, spec: Array<[number, number, number]>): void {
  recordCellLines(cell, spec.map(([l, r, y]) => ({ x: l, y, w: r - l, fontSize: 10, h: 10 })))
}

const H3 = new Map([[1, 842], [2, 842], [3, 842]])

describe("쪽 넘김 — 앞 조각에 왼쪽 열이 빠진 가운데 쪽", () => {
  it("쪽 전체를 차지한 조각의 왼끝이 뒤 조각 안쪽 경계 위에 있으면 잇고, 빠진 열은 앞 쪽 세로 병합 칸이 이어 덮는다 (해양경찰 관할구역)", () => {
    const blocks: IRBlock[] = [
      clipBlock(grid(2, 3, [[0, 0, "명칭", 2], [0, 2, "관할구역"], [1, 0, "중부청"], [1, 1, "인천서"], [1, 2, "가"]]), [0, 50, 100, 300], 1, 70, 700),
      // "중부청" 칸이 2쪽을 통째로 덮어 클립이 없다 — 2쪽 조각은 두 열뿐
      clipBlock(grid(1, 2, [[0, 0, "평택서"], [0, 1, "나"]]), [50, 100, 300], 2, 70, 700),
      clipBlock(grid(2, 3, [[0, 0, ""], [0, 1, "태안서"], [0, 2, "다"], [1, 0, "서해청"], [1, 1, "군산서"], [1, 2, "라"]]), [0, 50, 100, 300], 3, 500, 270),
    ]
    FILLER_CELLS.add(blocks[2].table!.cells[0][0])
    mergeCrossPageTables(blocks, H3)
    assert.equal(blocks.length, 1)
    const t = blocks[0].table!
    assert.equal(t.rows, 5)
    assert.equal(t.cells[1][0].text, "중부청")
    assert.equal(t.cells[1][0].rowSpan, 3)
    assert.equal(t.cells[4][0].text, "서해청")
  })

  it("빠진 열은 두 조각을 가로지르는 한 칸이라 \"두 쪽 모두 클립 없는 빈 칸 조각\" 증거가 아니다 (국가전략기술 \"너. …\" / 다음 쪽 \"더. …\")", () => {
    const blocks: IRBlock[] = [
      clipBlock(grid(2, 1, [[0, 0, "거. 원자층 증착 기술"], [1, 0, "너. 고순도 불화수소 기술"]]), [100, 300], 2, 70, 700),
      clipBlock(grid(2, 2, [[0, 0, ""], [0, 1, "더. 블랭크 마스크 기술"], [1, 0, "2. 이차전지"], [1, 1, "가. 고에너지밀도"]]), [0, 100, 300], 3, 500, 270),
    ]
    FILLER_CELLS.add(blocks[1].table!.cells[0][0])
    mergeCrossPageTables(blocks, H3)
    assert.equal(blocks.length, 1)
    const t = blocks[0].table!
    assert.equal(t.rows, 4)
    assert.equal(t.cells[1][1].text, "너. 고순도 불화수소 기술")
    assert.equal(t.cells[2][1].text, "더. 블랭크 마스크 기술")
  })

  it("쪽 머리에서 시작하지 않은 조각(표 첫머리)은 왼쪽 열이 빠졌다고 보지 않는다", () => {
    const blocks: IRBlock[] = [
      clipBlock(grid(1, 2, [[0, 0, "구분"], [0, 1, "내용"]]), [50, 100, 300], 2, 70, 300),
      clipBlock(grid(1, 3, [[0, 0, "1"], [0, 1, "가"], [0, 2, "나"]]), [0, 50, 100, 300], 3, 500, 270),
    ]
    mergeCrossPageTables(blocks, H3)
    assert.equal(blocks.length, 2)
  })
})

describe("쪽 넘김 — 뒤 조각에 양옆 열이 빠진 쪼개진 끝 행", () => {
  const prevTable = (): IRTable => grid(2, 4, [[0, 0, "6. 판매업자", 1, 2], [0, 1, "거. 운반신고"], [0, 2, "법 제26조"], [0, 3, "○"],
    [1, 1, "너. 총포의 위치추적\n전자장치를 임의로"], [1, 2, "법 제46조\n(영 제14조의"], [1, 3, "○"]])

  it("뒤 조각 경계가 모두 앞 조각 경계 위에 있고 쪼개진 행이면 옮기지 않고 제자리 열에 이어 붙인다 (총포 행정처분기준 \"제거 또는 훼손\")", () => {
    const prev = prevTable()
    lines(prev.cells[1][1], [[53, 98, 60], [53, 98, 45]])
    const curr = grid(1, 2, [[0, 0, "제거 또는 훼손"], [0, 1, "5제1호나목\n후단)"]])
    lines(curr.cells[0][0], [[53, 80, 780]])
    const blocks: IRBlock[] = [clipBlock(prev, [0, 50, 100, 150, 300], 1, 70, 700), clipBlock(curr, [50, 100, 150], 2, 740, 40)]
    mergeCrossPageTables(blocks, H3)
    assert.equal(blocks.length, 1)
    const t = blocks[0].table!
    assert.equal(t.rows, 2)
    assert.equal(t.cells[1][1].text, "너. 총포의 위치추적\n전자장치를 임의로\n제거 또는 훼손")
    assert.equal(t.cells[1][2].text, "법 제46조\n(영 제14조의\n5제1호나목\n후단)")
  })

  it("쪼개진 행 증거가 없으면 경계가 맞물려도 잇지 않는다 (앞 표 경계 위에 우연히 놓인 새 표)", () => {
    const blocks: IRBlock[] = [
      clipBlock(prevTable(), [0, 50, 100, 150, 300], 1, 70, 700),
      clipBlock(grid(1, 2, [[0, 0, "비고"], [0, 1, "없음"]]), [50, 100, 150], 2, 740, 40),
    ]
    mergeCrossPageTables(blocks, H3)
    assert.equal(blocks.length, 2)
  })
})

describe("쪽 넘김 — 칸 하나가 쪽을 통째로 넘긴 뒤의 조각", () => {
  const part = (text: string, from: { x1: number; x2: number }, page: number, y: number, height: number): IRBlock => {
    const t = grid(1, 1, [[0, 0, text]])
    CONT_PARTS.set(t, from)
    return clipBlock(t, [from.x1, from.x2], page, y, height)
  }

  it("쪽 바닥까지 찬 이어짐 조각을 붙인 표는 그 조각 쪽 다음 쪽 표와 잇는다 (체류자격 첨부서류 20쪽)", () => {
    const blocks: IRBlock[] = [
      clipBlock(grid(2, 2, [[0, 0, "거주"], [0, 1, "○ 결혼증명서"], [1, 0, "동반"], [1, 1, "○ 출생증명서"]]), [0, 100, 300], 1, 70, 700),
      part("- 재정능력 입증 서류", { x1: 100, x2: 300 }, 2, 32, 750),
      clipBlock(grid(1, 2, [[0, 0, "재외동포"], [0, 1, "○ 가족관계기록"]]), [0, 100, 300], 3, 500, 270),
    ]
    mergeContinuedCells(blocks, H3)
    mergeCrossPageTables(blocks, H3)
    assert.equal(blocks.length, 1)
    const t = blocks[0].table!
    assert.equal(t.rows, 3)
    assert.equal(t.cells[1][1].text, "○ 출생증명서\n- 재정능력 입증 서류")
    assert.equal(t.cells[2][0].text, "재외동포")
  })

  it("쪽 중간에서 끝난 이어짐 조각 바로 아래 표는 종전대로 앞 표 다음 쪽 첫머리 표로 잇는다 (규제영향분석서 \"근거설명\")", () => {
    const blocks: IRBlock[] = [
      clipBlock(grid(2, 2, [[0, 0, "구분"], [0, 1, "내용"], [1, 0, "근거"], [1, 1, "ㅇ 비용부담자"]]), [0, 100, 300], 1, 70, 700),
      part("주민대표단", { x1: 100, x2: 300 }, 2, 750, 33),
      clipBlock(grid(1, 2, [[0, 0, "근거설명"], [0, 1, "ㅇ 편익 수혜자"]]), [0, 100, 300], 2, 500, 250),
    ]
    mergeContinuedCells(blocks, H3)
    mergeCrossPageTables(blocks, H3)
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].table!.rows, 3)
  })
})
