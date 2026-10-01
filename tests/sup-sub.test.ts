/**
 * 위·아래첨자 — 평문으로 펴면 "10⁴ m²" 가 "104 m2", "F_st" 가 "Fst" 로 값이 바뀐다. 파서는 <sup>·<sub> 로 감싸고,
 * plain 은 "10^4"·"H_2O" 로 편다 (계량법 별표·ODL 논문 실측).
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { parse } from "../src/index.js"
import { wrapScript, tidyScriptTags, plainScripts, stripScriptTags } from "../src/script-tags.js"
import { extractHwpxStyles } from "../src/hwpx/styles.js"
import { parseSectionXml } from "../src/hwpx/section-walker.js"
import { blocksToMarkdown } from "../src/table/builder.js"
import { appendParaText, createParaTextState } from "../src/hwp5/record.js"
import { scriptKindsOfLine, tagScripts } from "../src/pdf/script-items.js"
import { splitTwoColumnProse } from "../src/pdf/page-regions.js"
import { toPlainMarkdown } from "../src/plain-markdown.js"
import type { NormItem } from "../src/pdf/text-line.js"
import { normalizeLabel } from "../src/form/match.js"

describe("첨자 태그 공용", () => {
  it("wrapScript — 공백은 태그 밖, 공백뿐이면 그대로", () => {
    assert.equal(wrapScript(" 2 ", "sup"), " <sup>2</sup> ")
    assert.equal(wrapScript("  ", "sub"), "  ")
    assert.equal(wrapScript("x", null), "x")
  })

  it("tidyScriptTags — 이웃 태그 합치기·공백 밖으로·빈 태그 지우기", () => {
    assert.equal(tidyScriptTags("10<sup>-</sup><sup>3</sup>"), "10<sup>-3</sup>")
    assert.equal(tidyScriptTags("m<sup> 2</sup>"), "m <sup>2</sup>")
    assert.equal(tidyScriptTags("a<sub></sub>b"), "ab")
  })

  it("plain — 값이 남게 ^·_ 로, 연산이 섞이면 괄호", () => {
    assert.equal(plainScripts("10<sup>4</sup> m<sup>2</sup>, H<sub>2</sub>O, x<sup>n+1</sup>, Kim<sup>∗†</sup>"), "10^4 m^2, H_2O, x^(n+1), Kim^∗†")
    assert.equal(toPlainMarkdown("10<sup>-3</sup> m<sup>3</sup>"), "10^-3 m^3")
  })

  it("양식 이름표 — 첨자 태그는 매칭에서 걷는다", () => {
    assert.equal(normalizeLabel("면적(m<sup>2</sup>)"), normalizeLabel("면적(m2)"))
  })

  it("마크다운 — 태그는 살리고 안의 글은 이스케이프", () => {
    assert.equal(blocksToMarkdown([{ type: "paragraph", text: "Kim<sup>*</sup> 10<sup>4</sup>" }]).trim(), "Kim<sup>\\*</sup> 10<sup>4</sup>")
  })
})

describe("HWPX — hh:supscript·subscript 글자 모양", () => {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" version="1.4"><hh:refList><hh:charProperties>
  <hh:charPr id="0" height="1000"/>
  <hh:charPr id="1" height="1000"><hh:supscript/></hh:charPr>
  <hh:charPr id="2" height="1000"><hh:subscript/></hh:charPr>
</hh:charProperties></hh:refList></hh:head>`
  const run = (id: number, t: string) => `<hp:run charPrIDRef="${id}"><hp:t>${t}</hp:t></hp:run>`
  const sec = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">${body}</hs:sec>`

  it("run 마다 감싸고 이웃 run 은 합친다 — \"10⁴ m²\"·\"F_st\"", async () => {
    const zip = new JSZip()
    zip.file("Contents/header.xml", header)
    const styles = await extractHwpxStyles(zip)
    assert.equal(styles.charProperties.get("1")?.script, "sup")
    const blocks = parseSectionXml(sec(`<hp:p>${run(0, "1 ha = 10")}${run(1, "-")}${run(1, "3")}${run(0, " m")}${run(1, "2")}${run(0, ", F")}${run(2, "st")}</hp:p>`), styles)
    assert.equal(blocksToMarkdown(blocks).trim(), "1 ha = 10<sup>-3</sup> m<sup>2</sup>, F<sub>st</sub>")
  })
})

describe("HWP5 — 글자 모양 위치표로 글자마다 첨자", () => {
  it("scriptAt 이 있으면 첨자 글자를 감싸고 제어 문자 앞에서 닫는다", () => {
    const state = createParaTextState()
    // "10" + 위첨자 "4" + " m" + 위첨자 "2" — 글자 위치 2·5 가 위첨자
    state.scriptAt = (p) => (p === 2 || p === 5 ? "sup" : null)
    appendParaText(state, Buffer.from("104 m2", "utf16le"))
    assert.equal(state.text, "10<sup>4</sup> m<sup>2</sup>")
  })

  it("scriptAt 이 없으면 종전 그대로", () => {
    const state = createParaTextState()
    appendParaText(state, Buffer.from("104 m2", "utf16le"))
    assert.equal(state.text, "104 m2")
  })
})

describe("DOCX — w:vertAlign", () => {
  it("superscript·subscript run 을 감싼다", async () => {
    const zip = new JSZip()
    zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`)
    zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`)
    const r = (t: string, va?: string) => `<w:r>${va ? `<w:rPr><w:vertAlign w:val="${va}"/></w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`
    zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${r("HNO")}${r("3", "subscript")}${r(" and E = mc")}${r("2", "superscript")}</w:p></w:body></w:document>`)
    const buf = await zip.generateAsync({ type: "arraybuffer" })
    const res = await parse(buf)
    assert.ok(res.success)
    assert.match(res.markdown, /HNO<sub>3<\/sub> and E = mc<sup>2<\/sup>/)
    // scriptTags: false — 모든 형식 평문(종전 출력)
    const off = await parse(buf, { scriptTags: false })
    assert.ok(off.success)
    assert.match(off.markdown, /HNO3 and E = mc2/)
    assert.ok(!JSON.stringify(off.blocks).includes("<su"))
  })
})

describe("scriptTags 끔 — 태그만 걷는다", () => {
  it("마크다운·쪽별 마크다운·IR(문단·span·각주·표 칸·캡션)", () => {
    const r = stripScriptTags({
      markdown: "10<sup>4</sup>",
      pages: [{ markdown: "m<sup>2</sup>" }],
      blocks: [
        { type: "paragraph", text: "H<sub>2</sub>O", spans: [{ text: "x<sup>2</sup>" }], footnoteText: "a<sup>1</sup>" },
        { type: "table", table: { rows: 1, cols: 1, hasHeader: false, caption: "c<sup>3</sup>", cells: [[{ text: "k<sub>B</sub>", colSpan: 1, rowSpan: 1 }]] } },
      ],
    })
    assert.equal(r.markdown, "104")
    assert.equal(r.pages![0].markdown, "m2")
    assert.ok(!JSON.stringify(r.blocks).includes("<su"))
  })
})

describe("PDF — 기준선·크기로 첨자 판정", () => {
  const it0 = (text: string, x: number, y: number, fontSize = 10, w = text.length * fontSize * 0.5) => ({ text, x, y, w, fontSize })

  it("왼쪽 글자에 붙은 작은 조각 — 뜨면 위, 가라앉으면 아래", () => {
    const line = [it0("10", 0, 100), it0("4", 10, 104, 7, 3.5), it0("m", 16, 100), it0("H", 30, 100), it0("2", 35, 98, 7, 3.5), it0("O", 38.5, 100)]
    assert.deepEqual(scriptKindsOfLine(line), [null, "sup", null, null, "sub", null])
  })

  it("떨어져 선 작은 조각(줄 머리 각주 번호·표 칸 사이)은 첨자가 아니다", () => {
    assert.deepEqual(scriptKindsOfLine([it0("1", 0, 104, 7, 3.5), it0("Note text here", 6, 100)]), [null, null])
    assert.deepEqual(scriptKindsOfLine([it0("value", 0, 100), it0("2", 40, 104, 7, 3.5)]), [null, null])
  })

  it("tagScripts — 이은 글에서 조각을 짚어 넣고, 어긋나면 손대지 않는다", () => {
    const line = [it0("10", 0, 100), it0("4", 10, 104, 7, 3.5), it0(" m", 14, 100)]
    assert.equal(tagScripts("104 m", [line]), "10<sup>4</sup> m")
    assert.equal(tagScripts("10-4 m", [line]), "10-4 m")
  })

  it("2단 지면 저자 줄 — 떠 있는 소속 표시(∗†)가 단 경계에서 갈리지 않고 이름 줄에 붙는다 (ODL 185)", () => {
    const n = (text: string, x: number, y: number, fontSize: number, w: number) =>
      ({ text, x, y, w, h: fontSize, fontSize, fontName: "F", seq: 0 }) as unknown as NormItem
    const items = [
      n("Dahyun Kim", 97, 724.4, 12, 65), n("∗", 163.5, 728.8, 8, 4), n(", Chanjun Park", 168, 724.4, 12, 79),
      n("∗†", 247.5, 728.8, 8, 8), n(", Sanghoon Kim", 256, 724.4, 12, 82), n("∗†", 338, 728.8, 8, 8), n(", Wonho Song", 346.5, 724.4, 12, 70),
      // 두 단 본문
      n("left body line of prose", 90, 600, 10, 200), n("right body line of prose", 306, 600, 10, 200),
    ]
    const groups = splitTwoColumnProse(items, 300)
    const authors = groups.find(g => g.some(i => i.text === "Dahyun Kim"))!
    assert.equal(authors.filter(i => /[∗†]/.test(i.text)).length, 3, "기호 셋 모두 이름 줄 묶음에")
    assert.ok(!groups.some(g => g.length && g.every(i => /^[∗†]+$/.test(i.text))), "기호만 모인 묶음 없음")
  })
})
