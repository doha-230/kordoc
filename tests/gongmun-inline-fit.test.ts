import { describe, it } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { markdownToHwpx, parse } from "../src/index.js"

async function section(md: string, band = false) {
  const data = await markdownToHwpx(md, { gongmun: { preset: "보고서", cover: false, ...(band ? { h2Marker: "band" as const } : {}) } })
  const zip = await JSZip.loadAsync(data)
  return { data, sec: await zip.file("Contents/section0.xml")!.async("text"), head: await zip.file("Contents/header.xml")!.async("text") }
}

describe("공문서 표시 텍스트 조판", () => {
  it("짧은 링크 항목을 긴 URL 때문에 압축하지 않는다", async () => {
    const { sec, head } = await section("# 보고서\n\n- [사업 안내](https://example.com/" + "long-path/".repeat(2) + ")")
    const item = [...sec.matchAll(/<hp:p\b[^>]*>[\s\S]*?<\/hp:p>/g)].find(m => m[0].includes("사업 안내"))![0]
    const refs = [...item.matchAll(/charPrIDRef="(\d+)"/g)].map(m => m[1])
    for (const id of refs) {
      const char = head.match(new RegExp('<hh:charPr id="' + id + '"[\\s\\S]*?</hh:charPr>'))![0]
      assert.match(char, /<hh:ratio hangul="100"/, char)
      assert.match(char, /<hh:spacing hangul="0"/, char)
    }
  })
  it("장 띠에 링크 URL과 인라인 문법을 인쇄하지 않는다", async () => {
    for (const title of ["[사업 안내](https://example.com/guide)", "__사업 안내__", "~~사업 안내~~", "<u>사업 안내</u>"]) {
      const { data } = await section("# 보고서\n\n## " + title + "\n\n본문", true)
      const parsed = await parse(data)
      assert.ok(parsed.success)
      const headings = parsed.blocks.filter(b => b.type === "heading" && b.level === 2)
      assert.equal(headings[0]?.text, "사업 안내", title)
    }
  })
  it("부호만 강조한 공문서를 다시 읽어도 본문에 강조 구분자가 남지 않는다", async () => {
    const data = await markdownToHwpx("# 계획\n\n**ㅇ** 설명\n\n__-__ 세부\n\n**※** 참고", { gongmun: { preset: "bangchim" } })
    const parsed = await parse(data)
    assert.ok(parsed.success)
    assert.deepEqual(parsed.blocks.filter(b => b.type === "paragraph").map(b => b.text), ["ㅇ 설명", "- 세부", "※ 참고"])
  })
})
