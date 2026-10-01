/** 표 셀의 실제 표시문자와 열폭·행높이·자동 글자 축소의 정합. */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { markdownToHwpx } from "../src/hwpx/generator.js"
import { colRoles, requiredTableWidth } from "../src/hwpx/gen-table.js"

const url = `https://example.org/${"very-long-path/".repeat(40)}`
const tableMd = (cell: string) => `# 검토보고\n\n> 검토하고자 함\n\n| 구분 | 내용 | 비고 |\n|---|---|---|\n| 대상 | ${cell} | 확인 |`

async function geometry(cell: string) {
  const zip = await JSZip.loadAsync(await markdownToHwpx(tableMd(cell), { gongmun: { preset: "report" } }))
  const sec = await zip.file("Contents/section0.xml")!.async("text")
  const head = await zip.file("Contents/header.xml")!.async("text")
  const at = sec.indexOf("<hp:t>구분</hp:t>")
  const start = sec.lastIndexOf("<hp:tbl ", at)
  const table = sec.slice(start, sec.indexOf("</hp:tbl>", start) + 9)
  const heights = [...table.matchAll(/<hp:cellSz width="(\d+)" height="(\d+)"/g)].map(m => [Number(m[1]), Number(m[2])])
  const fontSizes = [...table.matchAll(/<hp:run charPrIDRef="(\d+)"><hp:t>/g)].map(m =>
    Number(head.match(new RegExp(`<hh:charPr id="${m[1]}" height="(\\d+)"`))![1]))
  return { heights, fontSizes, table }
}

describe("GFM 표 셀 표시문자 측정", () => {
  it("링크 URL·취소선·첨자·강조를 셀 폭에 포함하지 않는다", () => {
    const rows = [["구분", "내용"], ["대상", "검토 대상"]]
    const expected = requiredTableWidth(rows, 1200, "font:한컴돋움")
    for (const cell of [`[검토 대상](${url})`, "~~검토 대상~~", "<sup>검토 대상</sup>", "<sub>검토 대상</sub>", "<u>검토 대상</u>", "*검토 대상*", "***검토 대상***"]) {
      assert.equal(requiredTableWidth([rows[0], ["대상", cell]], 1200, "font:한컴돋움"), expected, cell)
    }
  })

  it("링크·취소선·첨자 셀이 같은 평문 셀과 열폭·행높이·글자크기가 같다", async () => {
    const expected = await geometry("검토 대상")
    for (const cell of [`[검토 대상](${url})`, "~~검토 대상~~", "<sup>검토 대상</sup>"]) {
      const actual = await geometry(cell)
      assert.deepEqual(actual.heights, expected.heights, cell)
      assert.deepEqual(actual.fontSizes, expected.fontSizes, cell)
    }
    const linked = await geometry(`[검토 대상](${url})`)
    assert.match(linked.table, /type="HYPERLINK"/)
    assert.match(linked.table, /<hp:t>검토 대상<\/hp:t>/)
  })

  it("링크로 쓴 헤더의 표시문자로 내용·비고 열을 판정한다", () => {
    assert.deepEqual(colRoles(["구분", `[내용](${url})`, `[근거](${url})`]), [null, "content", "remark"])
  })

  it("셀 안 명시 개행도 표시문자별로 측정하고 두 문단을 유지한다", async () => {
    const expected = await geometry("검토 대상<br>후속 확인")
    const actual = await geometry(`[검토 대상](${url})<br><u>후속 확인</u>`)
    assert.deepEqual(actual.heights, expected.heights)
    assert.deepEqual(actual.fontSizes, expected.fontSizes)
    assert.match(actual.table, /<hp:t>후속 확인<\/hp:t>/)
  })

  it("이스케이프된 별표와 코드 안의 문법 문자는 표시 폭에 남는다", () => {
    const expected = requiredTableWidth([["**검토**"]], 1200)
    const literal = requiredTableWidth([["\\*\\*검토\\*\\*"]], 1200)
    const code = requiredTableWidth([["`**검토**`"]], 1200)
    assert.equal(literal, code)
    assert.ok(literal > expected)
  })
})
