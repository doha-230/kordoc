/** 변경추적으로 지운 개체가 최종본 이미지·글상자·캡션에 남지 않는다. */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { parseHwpxDocument } from "../src/hwpx/parser.js"
import { parseSectionXml } from "../src/hwpx/section-walker.js"

const section = (body: string) => `<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">${body}</hs:sec>`
const para = (body: string) => `<hp:p><hp:run>${body}</hp:run></hp:p>`
const pic = (ref: string, cap = "") => `<hp:pic><hp:img binaryItemIDRef="${ref}"/>${cap ? `<hp:caption><hp:subList>${para(`<hp:t>${cap}</hp:t>`)}</hp:subList></hp:caption>` : ""}</hp:pic>`
const marker = (begin: boolean, ctrl = true) => {
  const tag = `<hp:delete${begin ? "Begin" : "End"} Id="1"/>`
  return ctrl ? `<hp:ctrl>${tag}</hp:ctrl>` : tag
}

async function numberedShape(caption: string) {
  const zip = new JSZip()
  zip.file("mimetype", "application/hwp+zip")
  zip.file("Contents/header.xml", `<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"><hh:refList><hh:numberings><hh:numbering id="1" start="1"><hh:paraHead level="1" start="1" numFormat="DIGIT">^1.</hh:paraHead></hh:numbering></hh:numberings></hh:refList><hh:paraProperties><hh:paraPr id="1"><hh:heading type="NUMBER" idRef="1" level="0"/></hh:paraPr></hh:paraProperties></hh:head>`)
  const box = `<hp:drawText><hp:subList><hp:p paraPrIDRef="1"><hp:run><hp:t>Box</hp:t></hp:run></hp:p></hp:subList></hp:drawText>`
  zip.file("Contents/section0.xml", section(para(`<hp:shape>${box}<hp:caption><hp:subList>${caption}</hp:subList></hp:caption></hp:shape>`)))
  return parseHwpxDocument(await zip.generateAsync({ type: "arraybuffer" }))
}

describe("HWPX 변경추적 삭제 개체", () => {
  for (const [name, controls] of [["정상", ""], ["빈 ctrl 삭제", marker(true) + marker(false)],
    ["빈 직계 삭제", marker(true, false) + marker(false, false)], ["삽입 ctrl", "<hp:ctrl><hp:insertBegin/><hp:insertEnd/></hp:ctrl>"]]) {
    it(`${name} 캡션이 글상자 뒤의 자동번호를 유지`, async () => {
      const result = await numberedShape(`<hp:p paraPrIDRef="1"><hp:run>${controls}<hp:t>Caption</hp:t></hp:run></hp:p>`)
      assert.deepEqual(result.blocks.map(b => b.text), ["1. Box", "2. Caption"])
    })
  }

  it("캡션 문단을 건너는 삭제 텍스트·사진을 제외하면서 살아있는 자동번호 순서를 유지", async () => {
    const caption = para(marker(true) + "<hp:t>지운 캡션</hp:t>" + pic("deleted"))
      + `<hp:p paraPrIDRef="1"><hp:run>${marker(false)}<hp:t>Caption</hp:t></hp:run></hp:p>`
    const result = await numberedShape(caption)
    assert.deepEqual(result.blocks.map(b => b.text), ["1. Box", "2. Caption"])
    assert.ok(!result.markdown.includes("지운 캡션"))
    assert.ok(result.warnings?.some(w => w.code === "HIDDEN_TEXT_FILTERED"))
  })

  for (const ctrl of [true, false]) it(`${ctrl ? "ctrl" : "run 직계"} 마커 사이 사진·캡션만 제거하고 전후 사진은 유지`, () => {
    const body = para(pic("live-before", "앞 캡션") + marker(true, ctrl) + pic("deleted", "지운 캡션") + marker(false, ctrl) + pic("live-after", "뒤 캡션"))
    const blocks = parseSectionXml(section(body))
    assert.deepEqual(blocks.filter(b => b.type === "image").map(b => b.text), ["live-before", "live-after"])
    assert.deepEqual(blocks.filter(b => b.type === "paragraph").map(b => b.text), ["앞 캡션", "뒤 캡션"])
  })

  it("삭제 구간이 run·문단 경계를 건너도 닫힌 뒤 살아있는 개체는 유지", () => {
    const body = para(`<hp:t>앞 본문</hp:t>${marker(true)}`)
      + `<hp:p><hp:run>${pic("deleted-1")}</hp:run><hp:run>${pic("deleted-2")}${marker(false)}${pic("live")}</hp:run></hp:p>`
      + para("<hp:t>뒤 본문</hp:t>")
    const blocks = parseSectionXml(section(body))
    assert.deepEqual(blocks.filter(b => b.type === "image").map(b => b.text), ["live"])
    assert.deepEqual(blocks.filter(b => b.type === "paragraph").map(b => b.text), ["앞 본문", "뒤 본문"])
  })

  it("삭제된 container·도형·직계 글상자와 ctrl 사진은 글·캡션까지 제거", () => {
    const draw = (text: string) => `<hp:drawText><hp:subList>${para(`<hp:t>${text}</hp:t>`)}</hp:subList></hp:drawText>`
    const hidden = `<hp:container><hp:rect>${draw("지운 상자")}${pic("nested")}</hp:rect></hp:container>`
      + draw("지운 직계 상자") + `<hp:ctrl>${pic("ctrl-deleted", "지운 ctrl 캡션")}</hp:ctrl>`
    const body = para(marker(true) + hidden + marker(false) + `<hp:rect>${draw("남은 상자")}</hp:rect>`)
    assert.deepEqual(parseSectionXml(section(body)).map(b => [b.type, b.text]), [["paragraph", "남은 상자"]])
  })

  it("삭제 마커가 문단 직계여도 사진 삭제를 반영", () => {
    const body = `<hp:p>${marker(true, false)}<hp:run>${pic("deleted")}</hp:run>${marker(false, false)}<hp:run>${pic("live")}</hp:run></hp:p>`
    assert.deepEqual(parseSectionXml(section(body)).filter(b => b.type === "image").map(b => b.text), ["live"])
  })

  it("살아있는 글상자 안 삭제된 중첩 글상자를 다시 수집하지 않는다", () => {
    const draw = (body: string) => `<hp:rect><hp:drawText><hp:subList>${para(body)}</hp:subList></hp:drawText></hp:rect>`
    const body = para(draw(marker(true) + draw("<hp:t>지운 중첩 상자</hp:t>") + marker(false) + "<hp:t>남은 상자</hp:t>"))
    assert.deepEqual(parseSectionXml(section(body)).map(b => b.text), ["남은 상자"])
  })

  it("살아있는 사진 캡션 안 삭제된 글상자를 다시 수집하지 않는다", () => {
    const hidden = `<hp:rect><hp:drawText><hp:subList>${para("<hp:t>지운 캡션 상자</hp:t>")}</hp:subList></hp:drawText></hp:rect>`
    const caption = `<hp:caption><hp:subList>${para(marker(true) + hidden + marker(false) + "<hp:t>남은 캡션</hp:t>")}</hp:subList></hp:caption>`
    const blocks = parseSectionXml(section(para(`<hp:pic><hp:img binaryItemIDRef="live"/>${caption}</hp:pic>`)))
    assert.deepEqual(blocks.map(b => [b.type, b.text]), [["image", "live"], ["paragraph", "남은 캡션"]])
  })

  it("살아있는 도형 캡션 안 삭제된 사진을 도형 이미지로 복구하지 않는다", () => {
    const caption = `<hp:caption><hp:subList>${para(marker(true) + pic("deleted") + marker(false) + "<hp:t>남은 캡션</hp:t>")}</hp:subList></hp:caption>`
    assert.deepEqual(parseSectionXml(section(para(`<hp:shape>${caption}</hp:shape>`))).map(b => [b.type, b.text]), [["paragraph", "남은 캡션"]])
  })

  it("삭제 사진의 바이너리는 images와 마크다운에 나오지 않는다", async () => {
    const zip = new JSZip()
    zip.file("mimetype", "application/hwp+zip")
    zip.file("Contents/section0.xml", section(para(marker(true) + pic("deleted") + marker(false) + pic("live"))))
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    zip.file("BinData/deleted.png", png)
    zip.file("BinData/live.png", png)
    const result = await parseHwpxDocument(await zip.generateAsync({ type: "arraybuffer" }))
    assert.equal(result.images?.length, 1)
    assert.equal(result.blocks.filter(b => b.type === "image").length, 1)
    assert.equal((result.markdown.match(/!\[/g) ?? []).length, 1)
  })

  for (const ctrl of [true, false]) it(`${ctrl ? "ctrl" : "직계"} 삭제가 살아있는 캡션 뒤에서 시작해 다음 문단까지 이어져도 캡션 이미지·글은 유지`, async () => {
    const zip = new JSZip()
    zip.file("mimetype", "application/hwp+zip")
    const caption = `<hp:caption><hp:subList>${para("<hp:t>살아있는 캡션</hp:t>" + pic("live-caption"))}</hp:subList></hp:caption>`
    const live = `<hp:pic><hp:img binaryItemIDRef="live"/>${caption}</hp:pic>`
    zip.file("Contents/section0.xml", section(para(live + marker(true, ctrl) + pic("actual-deleted"))
      + para(pic("also-deleted") + marker(false, ctrl) + "<hp:t>뒤 본문</hp:t>")))
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    for (const ref of ["live", "live-caption", "actual-deleted", "also-deleted"]) zip.file(`BinData/${ref}.png`, png)
    const result = await parseHwpxDocument(await zip.generateAsync({ type: "arraybuffer" }))
    assert.deepEqual(result.images?.map(img => img.source), ["BinData/live.png", "BinData/live-caption.png"])
    assert.deepEqual(result.blocks.filter(b => b.type === "paragraph").map(b => b.text), ["살아있는 캡션", "뒤 본문"])
    assert.equal(result.blocks.filter(b => b.type === "image").length, 2)
    assert.ok(result.markdown.includes("살아있는 캡션"))
  })

  it("삭제 묶음의 모든 참조를 제외하면서 같은 참조의 살아있는 사진과 미참조 이미지는 유지", async () => {
    const zip = new JSZip()
    zip.file("mimetype", "application/hwp+zip")
    const deleted = `<hp:container>${pic("deleted-1")}${pic("BinData/deleted-2.png")}${pic("shared")}</hp:container>`
    zip.file("Contents/section0.xml", section(para(marker(true) + deleted + marker(false) + pic("shared"))))
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    for (const name of ["deleted-1", "deleted-2", "shared", "unreferenced"]) zip.file(`BinData/${name}.png`, png)
    const result = await parseHwpxDocument(await zip.generateAsync({ type: "arraybuffer" }))
    assert.deepEqual(result.images?.map(img => img.source), ["BinData/shared.png", "BinData/unreferenced.png"])
    assert.equal(result.blocks.filter(b => b.type === "image").length, 2)
    assert.equal((result.markdown.match(/!\[/g) ?? []).length, 2)
  })
})
