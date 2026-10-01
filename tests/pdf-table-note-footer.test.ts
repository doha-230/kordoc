import { it } from "node:test"
import assert from "node:assert/strict"
import { removeHeaderFooterBlocks } from "../src/pdf/block-detect.js"
import type { IRBlock } from "../src/types.js"

function repeated(text: string, gap = 1, noteX = 50): IRBlock[] {
  return [1, 2, 3].flatMap(page => [
    { type: "table" as const, pageNumber: page, bbox: { page, x: 45, y: 97, width: 504, height: 600 } },
    { type: "paragraph" as const, text, pageNumber: page, bbox: { page, x: noteX, y: 97 - gap - 11, width: 269, height: 11 } },
  ])
}
const heights = new Map([[1, 830], [2, 830], [3, 830]])
it("반복 표 바로 아래 주석은 footer 영역에 들어가도 보존한다", () => {
  for (const label of ["주1) 2019a: 가계동향조사(소득부문)", "주: 통계 범위", "자료: 통계청", "출처: 공공데이터"]) {
    assert.deepEqual(removeHeaderFooterBlocks(repeated(label), heights, []), [])
  }
})
it("표와 떨어진 주석 모양 footer는 종전처럼 제거한다", () => {
  assert.deepEqual(removeHeaderFooterBlocks(repeated("자료: 통계청", 40), heights, []), [1, 3, 5])
})
it("표 옆의 반복 footer와 주석 표지 없는 running footer는 제거한다", () => {
  assert.deepEqual(removeHeaderFooterBlocks(repeated("자료: 통계청", 1, 550), heights, []), [1, 3, 5])
  assert.deepEqual(removeHeaderFooterBlocks(repeated("가계동향조사 보고서"), heights, []), [1, 3, 5])
})
it("드문드문 되풀이되는 절 제목(서식마다 첫 쪽)은 러닝 헤더가 아니다", () => {
  // 규제영향분석서: "Ⅰ. 규제의 필요성" 이 156쪽 중 10쪽(약 15쪽 간격) 머리 띠에 — 원본 서식의 제목이다
  const pages = [5, 21, 35, 49, 62]
  const blocks: IRBlock[] = pages.map(page => ({ type: "paragraph", text: "Ⅰ. 규제의 필요성", pageNumber: page, bbox: { page, x: 60, y: 780, width: 200, height: 14 } }))
  const hs = new Map(pages.map(p => [p, 830] as [number, number]))
  assert.deepEqual(removeHeaderFooterBlocks(blocks, hs, []), [])
  // 매 쪽 되풀이는 종전대로 머리글
  const every = [1, 2, 3, 4].map(page => ({ type: "paragraph" as const, text: "행정업무운영 편람", pageNumber: page, bbox: { page, x: 60, y: 780, width: 200, height: 14 } }))
  assert.deepEqual(removeHeaderFooterBlocks(every, new Map([1, 2, 3, 4].map(p => [p, 830] as [number, number])), []), [0, 1, 2, 3])
})
it("쪽 번호가 바뀌며 되풀이되는 바닥글은 드문드문해도 러닝 푸터다", () => {
  // hwp3-sample11 "DCT Technology Inc.\t55" — 여러 쪽에선 표에 흡수돼 따로 선 등장이 드문드문하다
  const pages = [6, 20, 41, 55]
  const blocks: IRBlock[] = pages.map(page => ({ type: "paragraph", text: `DCT Technology Inc.\t${page}`, pageNumber: page, bbox: { page, x: 60, y: 20, width: 400, height: 10 } }))
  assert.deepEqual(removeHeaderFooterBlocks(blocks, new Map(pages.map(p => [p, 830] as [number, number])), []), [0, 1, 2, 3])
})
it("쪽 머리 띠에 통째로 든 작은 표가 되풀이되면 러닝 헤더다 (괘선 상자 머리말)", () => {
  // exam_kor "2 | 홀수형" / "홀수형 | 3" (짝·홀 쪽 번갈아), 온새미로 본교재 짝수 쪽 "01 누적과 연결 & 세계와 자아의 관계"
  const cell = (text: string) => ({ text, colSpan: 1, rowSpan: 1 })
  const box = (page: number, texts: string[]): IRBlock => ({
    type: "table", pageNumber: page, bbox: { page, x: 62, y: 737, width: 471, height: 34 },
    table: { rows: 1, cols: texts.length, cells: [texts.map(cell)], hasHeader: false },
  })
  const pages = [2, 3, 4, 5, 6, 7, 8]
  const blocks = pages.map(p => box(p, p % 2 ? ["홀수형", "", String(p)] : [String(p), "", "홀수형"]))
  const hs = new Map(pages.map(p => [p, 841] as [number, number]))
  // 표 상자는 쪽 넘김 표 병합 뒤 따로 거른다(tables=true) — 글 차례에선 건드리지 않는다
  assert.deepEqual(removeHeaderFooterBlocks(blocks, hs, []), [])
  assert.deepEqual(removeHeaderFooterBlocks(blocks, hs, [], undefined, true), [0, 1, 2, 3, 4, 5, 6])
  // 머리 띠를 벗어난 본문 표는 되풀이돼도 그대로
  const body = pages.map(p => ({ ...box(p, ["구분", "내용"]), bbox: { page: p, x: 62, y: 400, width: 471, height: 34 } }))
  assert.deepEqual(removeHeaderFooterBlocks(body, hs, [], undefined, true), [])
  // 드문드문한 안건 표지 상자("제2차 재정운용전략협의회 | 26-2-1", 56쪽 중 4쪽)는 번호가 바뀌어도 머리말이 아니다
  const agenda = [5, 27, 47, 60].map((p, k) => box(p, ["제2차 재정운용전략협의회", `26-2-${k + 1}`]))
  assert.deepEqual(removeHeaderFooterBlocks(agenda, new Map([5, 27, 47, 60].map(p => [p, 841] as [number, number])), [], undefined, true), [])
})
it("쪽 아래 표 주석 상자(주 | 1) | …)는 바로 위 표에 딸린 글이라 되풀이돼도 남긴다", () => {
  // 사업체노동력조사 보도자료: 통계표 쪽마다 "주 | 1) | ( )내는 전년동기대비 증감률 | 2) | p: 잠정치"
  const cell = (text: string) => ({ text, colSpan: 1, rowSpan: 1 })
  const pages = [30, 31, 32]
  const blocks: IRBlock[] = pages.flatMap(page => [
    { type: "table" as const, pageNumber: page, bbox: { page, x: 58, y: 100, width: 436, height: 600 }, table: { rows: 1, cols: 1, cells: [[cell("통계")]], hasHeader: false } },
    { type: "table" as const, pageNumber: page, bbox: { page, x: 58, y: 72, width: 436, height: 23 },
      table: { rows: 2, cols: 3, cells: [["주", "1)", "( )내는 전년동기대비 증감률"].map(cell), ["", "2)", "p: 잠정치"].map(cell)], hasHeader: false } },
  ])
  assert.deepEqual(removeHeaderFooterBlocks(blocks, new Map(pages.map(p => [p, 841] as [number, number])), [], undefined, true), [])
})
it("본문 위첨자 참조 표시가 있는 쪽의 각주는 숫자만 바뀌며 되풀이돼도 꼬리말이 아니다", () => {
  // 선박 코드 부속서: 쪽마다 "3) 제19장 부속서 3의 2.3.4 참조 - 역주" 꼴 각주 — 숫자를 지우면 같은 글이라 러닝 푸터로 지워졌다
  const pages = [8, 9, 10]
  const blocks: IRBlock[] = pages.map((page, k) => ({ type: "paragraph", text: `${k + 3}) 제19장 부속서 3의 2.3.${k + 4} 참조 - 역주`, pageNumber: page, bbox: { page, x: 57, y: 29, width: 300, height: 25 } }))
  const hs = new Map(pages.map(p => [p, 841] as [number, number]))
  const notes = new Map(pages.map((p, k) => [p, { marks: [{ mark: `${k + 3})`, y: 500 }], seps: [60] }] as const))
  assert.deepEqual(removeHeaderFooterBlocks(blocks, hs, [], notes), [])
  // 참조 표시가 없는 쪽이면 종전대로 꼬리말
  assert.deepEqual(removeHeaderFooterBlocks(blocks, hs, []), [0, 1, 2])
})
