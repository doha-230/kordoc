import { describe, it } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { parseHwpxDocument } from "../src/hwpx/parser.js"

async function form(value = "소속관서", dirty = "0"): Promise<ArrayBuffer> {
  const zip = new JSZip()
  const border = (side: string, visible: boolean) => `<hh:${side}Border type="${visible ? "SOLID" : "NONE"}" color="#000000"/>`
  const fill = (id: number, top: boolean, bottom: boolean) => `<hh:borderFill id="${id}">${border("left", true)}${border("right", true)}${border("top", top)}${border("bottom", bottom)}</hh:borderFill>`
  zip.file("Contents/header.xml", `<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"><hh:refList><hh:borderFills>${fill(1, true, false)}${fill(2, false, true)}</hh:borderFills></hh:refList></hh:head>`)
  const guide = `<hp:ctrl><hp:fieldBegin id="7" type="CLICK_HERE" dirty="${dirty}"><hp:parameters><hp:stringParam name="Direction">소속관서</hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl></hp:run><hp:run><hp:t>${value}</hp:t></hp:run><hp:run><hp:ctrl><hp:fieldEnd beginIDRef="7"/></hp:ctrl>`
  const tc = (r: number, c: number, cs: number, content: string) => `<hp:tc borderFillIDRef="${r + 1}"><hp:subList><hp:p><hp:run>${content}</hp:run></hp:p></hp:subList><hp:cellAddr rowAddr="${r}" colAddr="${c}"/><hp:cellSpan rowSpan="1" colSpan="${cs}"/></hp:tc>`
  zip.file("Contents/section0.xml", `<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"><hp:p><hp:run><hp:tbl rowCnt="2" colCnt="2"><hp:tr>${tc(0, 0, 2, guide)}</hp:tr><hp:tr>${tc(1, 0, 1, "<hp:t>제목</hp:t>")}${tc(1, 1, 1, "<hp:t>내용</hp:t>")}</hp:tr></hp:tbl></hp:run></hp:p></hs:sec>`)
  return zip.generateAsync({ type: "arraybuffer" })
}

describe("누름틀 안내문 행의 보기·편집 모드", () => {
  it("기본 출력은 인쇄되지 않는 여백 행을 접는다", async () => {
    const result = await parseHwpxDocument(await form())
    assert.equal(result.blocks[0].table!.rows, 1)
    assert.ok(!result.markdown.includes("소속관서"))
    assert.ok(result.markdown.includes("제목") && result.markdown.includes("내용"))
  })

  it("원본 구조 모드는 안내문과 셀 주소를 유지한다", async () => {
    const result = await parseHwpxDocument(await form(), { layoutTables: "keep" })
    const t = result.blocks[0].table!
    assert.equal(t.rows, 2)
    assert.equal(t.cells[0][0].text, "소속관서")
    assert.equal(t.cells[0][0].blocks![0].spans![0].placeholder, true)
  })

  it("안내문 표시 옵션은 안내문 행도 유지한다", async () => {
    const result = await parseHwpxDocument(await form(), { includeFieldPlaceholders: true })
    assert.equal(result.blocks[0].table!.rows, 2)
    assert.ok(result.markdown.includes("소속관서"))
  })

  it("입력된 값과 수정 표시가 있는 안내문은 실제 글로 유지한다", async () => {
    for (const [value, dirty] of [["소속관서", "1"], ["서울경찰서", "0"]]) {
      const result = await parseHwpxDocument(await form(value, dirty))
      assert.equal(result.blocks[0].table!.rows, 2)
      assert.ok(result.markdown.includes(value))
    }
  })
})
