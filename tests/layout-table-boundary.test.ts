import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { CELL_EDGES, CONTENT_CELLS, unframeLayoutTables, type Edges } from "../src/table/layout-frames.js"
import { blocksToMarkdown } from "../src/table/builder.js"
import type { IRBlock, IRCell, IRTable } from "../src/types.js"

const NONE: Edges = { t: false, b: false, l: false, r: false }
const BOX: Edges = { t: true, b: true, l: true, r: true }
const cell = (text: string, edges: Edges = NONE): IRCell => {
  const c: IRCell = { text, colSpan: 1, rowSpan: 1 }
  CELL_EDGES.set(c, edges)
  return c
}
const visible = (cells: IRCell[]): IRTable => {
  const table: IRTable = { rows: 1, cols: cells.length, cells: [cells], hasHeader: false }
  const out = unframeLayoutTables([{ type: "table", table }])
  assert.equal(out.length, 1)
  assert.equal(out[0].type, "table")
  return out[0].table!
}

describe("표 띠의 한쪽 테두리", () => {
  it("오른쪽 선 하나만 있어도 선 밖 빈 들여쓰기 칸을 접는다", () => {
    const out = visible([cell(""), cell("(ii)"), cell("E-mail address:", { ...NONE, r: true })])
    assert.equal(out.cols, 2)
    assert.deepEqual(out.cells[0].map(c => c.text), ["(ii)", "E-mail address:"])
  })

  it("단독 입력 항목도 선 밖 빈 칸을 붙이지 않는다", () => {
    const out = visible([cell(""), cell("Office of earlier filing:", { ...NONE, r: true })])
    assert.equal(out.cols, 1)
    assert.equal(out.cells[0][0].text, "Office of earlier filing:")
  })

  it("글이 비어도 그림이 있는 칸은 선 밖 여백이 아니다", () => {
    const picture = cell("")
    CONTENT_CELLS.add(picture)
    const out = visible([picture, cell("설명", { ...NONE, r: true })])
    assert.equal(out.cols, 2)
    assert.equal(out.cells[0][0], picture)
  })

  it("이미지 칸만 남아 1×1이 되어도 이미지가 출력된다", () => {
    const picture = cell("", { ...NONE, r: true })
    picture.blocks = [{ type: "image", text: "image.png" }]
    const out = visible([cell(""), picture])
    assert.equal(out.cols, 1)
    assert.ok(blocksToMarkdown([{ type: "table", table: out }]).includes("![image](image.png)"))
  })

  it("한 열 표도 이미지·안내문 표시·각주를 블록 순서대로 출력한다", () => {
    const t = grid(2, 1, [[0, 0, "안내 제목", 1, 1, BOX], [1, 0, "", 1, 1, BOX]])
    t.cells[0][0].blocks = [{ type: "paragraph", text: "안내 제목", spans: [{ text: "안내", placeholder: true }, { text: "제목" }], footnoteText: "주석" }]
    t.cells[1][0].blocks = [{ type: "image", text: "image.png" }]
    const md = blocksToMarkdown(unframe(t))
    assert.ok(!md.includes("안내"), md)
    assert.ok(md.includes("제목 (주: 주석)"), md)
    assert.ok(md.includes("![image](image.png)"), md)
    assert.ok(md.indexOf("제목") < md.indexOf("image.png"), md)
  })

  it("본문 글이 없는 단독 각주도 출력한다", () => {
    const t = grid(1, 1, [[0, 0, "(주: 단독 각주)", 1, 1, BOX]])
    t.cells[0][0].blocks = [{ type: "paragraph", text: "", footnoteText: "단독 각주" }]
    assert.ok(blocksToMarkdown(unframe(t)).includes("(주: 단독 각주)"))
  })

  it("평문 blocks만 있으면 기존 한 칸 번호 서식을 유지한다", () => {
    const t = grid(1, 1, [[0, 0, "1. 항목", 1, 1, BOX]])
    t.cells[0][0].blocks = [{ type: "paragraph", text: "1. 항목" }]
    assert.equal(blocksToMarkdown(unframe(t)), "**1. 항목**")
  })

  it("빈 span 배열은 한 칸의 실제 본문을 숨기지 않는다", () => {
    const t = grid(1, 1, [[0, 0, "본문", 1, 1, BOX]])
    t.cells[0][0].blocks = [{ type: "paragraph", text: "본문", spans: [] }]
    assert.equal(blocksToMarkdown(unframe(t)), "본문")
  })

  it("빈 span 문단도 이미지·각주와 섞이면 순서대로 남긴다", () => {
    const t = grid(1, 1, [[0, 0, "본문", 1, 1, BOX]])
    t.cells[0][0].blocks = [{ type: "paragraph", text: "본문", spans: [] },
      { type: "image", text: "image.png" }, { type: "paragraph", text: "", footnoteText: "단독 각주" }]
    assert.equal(blocksToMarkdown(unframe(t)), "본문\n![image](image.png)\n (주: 단독 각주)")
  })
})

type Anchor = [r: number, c: number, text: string, rs: number, cs: number, edges: Edges]
function grid(rows: number, cols: number, anchors: Anchor[]): IRTable {
  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => cell("")))
  for (const [r, c, text, rs, cs, edges] of anchors) {
    cells[r][c] = cell(text, edges)
    cells[r][c].rowSpan = rs
    cells[r][c].colSpan = cs
  }
  return { rows, cols, cells, hasHeader: false }
}
const unframe = (table: IRTable): IRBlock[] => unframeLayoutTables([{ type: "table", table }])

describe("빈 여백 행과 병합 덮개 행", () => {
  const R: Edges = { ...NONE, r: true }
  it("실제 빈 행만 접고 그 아래 병합으로 덮인 행은 유지한다", () => {
    const t = grid(3, 2, [
      [0, 0, "", 1, 1, { ...R, t: true }], [0, 1, "참고 안내", 3, 1, BOX],
      [1, 0, "", 2, 1, R],
    ])
    const out = unframe(t)[0].table!
    assert.equal(out.rows, 2)
    assert.equal(out.cols, 2)
    assert.equal(out.cells[0][1].rowSpan, 2)
  })

  it("절차 표의 병합 범위와 다음 단계 위치를 유지한다", () => {
    const t = grid(4, 3, [
      [0, 0, "신청서", 3, 1, BOX], [0, 1, "", 1, 1, R], [0, 2, "접수", 3, 1, BOX],
      [1, 1, "", 2, 1, R], [3, 0, "검토", 1, 3, BOX],
    ])
    const out = unframe(t)[0].table!
    assert.equal(out.rows, 3)
    assert.equal(out.cells[0][0].rowSpan, 2)
    assert.equal(out.cells[0][2].rowSpan, 2)
    assert.equal(out.cells[2][0].text, "검토")
  })

  it("선 밖 빈 들여쓰기 칸을 먼저 빼고 여백 행을 판정한다", () => {
    const t = grid(3, 3, [
      [0, 0, "", 1, 1, { ...R, t: true }], [0, 1, "참고 안내", 3, 1, BOX],
      [1, 0, "", 2, 1, R],
    ])
    const out = unframe(t)[0].table!
    assert.equal(out.rows, 2)
    assert.equal(out.cols, 2)
    assert.equal(out.cells[0][1].rowSpan, 2)
  })

  it("인쇄되지 않는 안내문만 있는 여백 행은 접고 원본 안내 span은 보존한다", () => {
    const t = grid(2, 2, [[0, 0, "소속관서", 1, 2, { ...BOX, b: false }],
      [1, 0, "제목", 1, 1, { ...BOX, t: false }], [1, 1, "내용", 1, 1, { ...BOX, t: false }]])
    const guide = t.cells[0][0]
    guide.blocks = [{ type: "paragraph", text: "소속관서", spans: [{ text: "소속관서", placeholder: true }] }]
    const out = unframe(t)[0].table!
    assert.equal(out.rows, 1)
    assert.equal(out.cells[0][0].text, "제목")
    assert.equal(guide.blocks[0].spans![0].placeholder, true)
    assert.equal(guide.text, "소속관서")
  })

  it("실제 글·이미지·주석이 있는 행은 접지 않는다", () => {
    for (const content of [
      { type: "paragraph", text: "소속관서", spans: [{ text: "소속관서" }] },
      { type: "image", text: "" },
      { type: "paragraph", text: "", footnoteText: "설명" },
      { type: "paragraph", text: "안내 제목", spans: [{ text: "안내", placeholder: true }, { text: "제목" }] },
    ] satisfies IRBlock[]) {
      const t = grid(2, 1, [[0, 0, "", 1, 1, { ...BOX, b: false }], [1, 0, "본문", 1, 1, { ...BOX, t: false }]])
      t.cells[0][0].blocks = [content]
      assert.equal(unframe(t)[0].table!.rows, 2)
    }
  })

  it("수식만 있는 열도 실제 내용으로 유지한다", () => {
    const t = grid(2, 2, [[0, 0, "$z$", 1, 1, BOX], [0, 1, "$P(0 \\le Z \\le z)$", 1, 1, BOX],
      [1, 0, "1.0~1.3", 1, 1, BOX], [1, 1, "$0.3413 \\sim 0.4032$", 1, 1, BOX]])
    const out = unframe(t)[0].table!
    assert.equal(out.cols, 2)
    assert.equal(out.cells[0][1].text, "$P(0 \\le Z \\le z)$")
    assert.equal(out.cells[1][1].text, "$0.3413 \\sim 0.4032$")
  })
})

describe("캡션 안 중첩표", () => {
  it("단위 글은 캡션 문단으로 풀고 본체 격자만 남긴다", () => {
    const caption = grid(2, 2, [[0, 0, "단위: 천원", 1, 2, NONE], [1, 0, "신축", 1, 1, BOX], [1, 1, "증축", 1, 1, BOX]])
    const body = grid(1, 1, [[0, 0, "주표", 1, 1, BOX]])
    body.captionBlocks = [{ type: "table", table: caption }]
    const out = unframe(body)[0].table!.captionBlocks!
    assert.deepEqual(out.map(b => b.type), ["paragraph", "table"])
    assert.equal(out[0].text, "단위: 천원")
    assert.equal(out[1].table!.rows, 1)
    assert.equal(out[1].table!.cols, 2)
  })

  it("부모가 글 틀로 풀려도 캡션의 중첩 격자와 순서를 보존한다", () => {
    const caption = grid(1, 2, [[0, 0, "신축", 1, 1, BOX], [0, 1, "증축", 1, 1, BOX]])
    const frame = grid(1, 1, [[0, 0, "본문", 1, 1, NONE]])
    frame.caption = "캡션 신축 증축"
    frame.captionBlocks = [{ type: "paragraph", text: "캡션" }, { type: "table", table: caption }]
    const out = unframe(frame)
    assert.deepEqual(out.map(b => b.type), ["paragraph", "table", "paragraph"])
    assert.equal(out[0].text, "캡션")
    assert.equal(out[1].table, caption)
    assert.equal(out[2].text, "본문")
  })

  it("캡션 틀이 이미지·문단으로 풀려도 Markdown과 HTML에 이미지가 남는다", () => {
    const caption = grid(1, 2, [[0, 0, "", 1, 1, NONE], [0, 1, "설명", 1, 1, NONE]])
    caption.cells[0][0].blocks = [{ type: "image", text: "chart.png" }]
    const body = grid(1, 2, [[0, 0, "항목", 1, 1, BOX], [0, 1, "값", 1, 1, BOX]])
    body.caption = "캡션 설명"
    body.captionBlocks = [{ type: "table", table: caption }]
    const blocks = unframe(body)
    assert.ok(blocksToMarkdown(blocks).includes("![image](chart.png)"))
    const parent = grid(1, 1, [[0, 0, "", 1, 1, BOX]])
    parent.cells[0][0].blocks = blocks
    const html = blocksToMarkdown(unframe(parent))
    assert.ok(html.includes('<img src="chart.png" alt="image">'), html)
    assert.ok(html.includes("설명"), html)
  })

  it("각주만 있는 캡션도 Markdown과 HTML에 남긴다", () => {
    const body = grid(1, 2, [[0, 0, "항목", 1, 1, BOX], [0, 1, "값", 1, 1, BOX]])
    body.captionBlocks = [{ type: "paragraph", text: "", footnoteText: "캡션 각주" }]
    const blocks = unframe(body)
    assert.ok(blocksToMarkdown(blocks).includes("**(주: 캡션 각주)**"))
    const parent = grid(1, 1, [[0, 0, "", 1, 1, BOX]])
    parent.cells[0][0].blocks = blocks
    assert.ok(blocksToMarkdown(unframe(parent)).includes("(주: 캡션 각주)"))
  })

  it("부모 표가 글틀로 풀려도 캡션 단독 각주를 남긴다", () => {
    const frame = grid(1, 1, [[0, 0, "본문", 1, 1, NONE]])
    frame.caption = "(주: 캡션 각주)"
    frame.captionBlocks = [{ type: "paragraph", text: "", footnoteText: "캡션 각주" }]
    assert.equal(blocksToMarkdown(unframe(frame)), "(주: 캡션 각주)\n\n본문")
  })
})
