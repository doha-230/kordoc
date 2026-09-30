import { test } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { parse, parsePptx } from "../src/index.js"

const P = "http://schemas.openxmlformats.org/presentationml/2006/main"
const A = "http://schemas.openxmlformats.org/drawingml/2006/main"
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const C = "http://schemas.openxmlformats.org/drawingml/2006/chart"
const DGM = "http://schemas.openxmlformats.org/drawingml/2006/diagram"
const REL = "http://schemas.openxmlformats.org/package/2006/relationships"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

/**
 * 실제 PowerPoint 산출물과 같은 구조의 최소 덱 (2장).
 * 1장: 제목·본문(레벨 목록) + 표(가로 병합) + 차트 + SmartArt + 그림 + 발표자 노트
 * 2장: 그룹 도형 안의 텍스트
 */
async function fixture(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file("ppt/presentation.xml",
    `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>`)
  zip.file("ppt/_rels/presentation.xml.rels",
    `<Relationships xmlns="${REL}"><Relationship Id="rId2" Type="${R}/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="${R}/slide" Target="slides/slide2.xml"/></Relationships>`)

  zip.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:c="${C}" xmlns:dgm="${DGM}" xmlns:r="${R}"><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:bodyPr/><a:p><a:r><a:t>분기 실적</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
      <p:txBody><a:bodyPr/><a:p><a:pPr lvl="0"/><a:r><a:t>요약</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:t>매출 증가</a:t></a:r></a:p><a:p><a:pPr lvl="1"/><a:r><a:t>비용 감소</a:t></a:r></a:p></p:txBody></p:sp>
    <p:graphicFrame><a:graphic><a:graphicData><a:tbl>
      <a:tr><a:tc gridSpan="2"><a:txBody><a:p><a:r><a:t>구분</a:t></a:r></a:p></a:txBody></a:tc><a:tc hMerge="1"/><a:tc><a:txBody><a:p><a:r><a:t>금액</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
      <a:tr><a:tc><a:txBody><a:p><a:r><a:t>1분기</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>2분기</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>42</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
    </a:tbl></a:graphicData></a:graphic></p:graphicFrame>
    <p:graphicFrame><a:graphic><a:graphicData><c:chart r:id="rIdChart"/></a:graphicData></a:graphic></p:graphicFrame>
    <p:graphicFrame><a:graphic><a:graphicData><dgm:relIds r:dm="rIdDgm"/></a:graphicData></a:graphic></p:graphicFrame>
    <p:pic><p:nvPicPr><p:cNvPr id="3" name="Picture"/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/></p:blipFill></p:pic>
  </p:spTree></p:cSld></p:sld>`)
  zip.file("ppt/slides/_rels/slide1.xml.rels", `<Relationships xmlns="${REL}">
    <Relationship Id="rIdChart" Type="${R}/chart" Target="../charts/chart1.xml"/>
    <Relationship Id="rIdDgm" Type="${R}/diagramData" Target="../diagrams/data1.xml"/>
    <Relationship Id="rIdImg" Type="${R}/image" Target="../media/image1.png"/>
    <Relationship Id="rIdNotes" Type="${R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
    <Relationship Id="rIdLink" Type="${R}/hyperlink" Target="https://example.com" TargetMode="External"/>
  </Relationships>`)

  zip.file("ppt/slides/slide2.xml", `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>
    <p:grpSp><p:sp><p:nvSpPr><p:cNvPr id="4" name="Grouped"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>그룹 안 글</a:t></a:r></a:p></p:txBody></p:sp></p:grpSp>
  </p:spTree></p:cSld></p:sld>`)

  zip.file("ppt/charts/chart1.xml", `<c:chartSpace xmlns:c="${C}" xmlns:a="${A}">
    <c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>매출 추이</a:t></a:r></a:p></c:rich></c:tx></c:title>
      <c:plotArea><c:barChart><c:ser>
        <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>매출</c:v></c:pt></c:strCache></c:strRef></c:tx>
        <c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>1분기</c:v></c:pt><c:pt idx="1"><c:v>2분기</c:v></c:pt></c:strCache></c:strRef></c:cat>
        <c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>42</c:v></c:pt><c:pt idx="1"><c:v>57</c:v></c:pt></c:numCache></c:numRef></c:val>
      </c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>`)
  zip.file("ppt/diagrams/data1.xml", `<dgm:data xmlns:dgm="${DGM}" xmlns:a="${A}"><dgm:ptLst>
    <dgm:pt type="doc"><dgm:t><a:p><a:r><a:t>기획</a:t></a:r></a:p></dgm:t></dgm:pt>
    <dgm:pt type="node"><dgm:t><a:p><a:r><a:t>실행</a:t></a:r></a:p></dgm:t></dgm:pt>
  </dgm:ptLst></dgm:data>`)
  zip.file("ppt/notesSlides/notesSlide1.xml", `<p:notes xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="5" name="Notes"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>숫자는 잠정치</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld></p:notes>`)
  zip.file("ppt/media/image1.png", PNG)
  zip.file("docProps/core.xml", `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
    <dc:title>분기 보고</dc:title><dc:creator>홍길동</dc:creator><cp:keywords>실적,보고</cp:keywords></cp:coreProperties>`)
  return zip.generateAsync({ type: "nodebuffer" })
}

test("PPTX: 슬라이드 텍스트·표(병합)·차트 데이터·SmartArt·그림·노트·메타데이터", async () => {
  const result = await parse(await fixture())
  assert.equal(result.success, true)
  if (!result.success) return
  const md = result.markdown

  assert.equal(result.fileType, "pptx")
  assert.equal(result.metadata?.title, "분기 보고")
  assert.equal(result.metadata?.author, "홍길동")
  assert.deepEqual(result.metadata?.keywords, ["실적", "보고"])

  // 슬라이드 경계 · 제목 자리표시자는 heading 2
  assert.match(md, /# 슬라이드 1/)
  assert.match(md, /## 분기 실적/)
  assert.match(md, /# 슬라이드 2/)
  assert.match(md, /그룹 안 글/)

  // 목록 레벨
  assert.match(md, /- 매출 증가/)
  assert.match(md, /- 비용 감소/)

  // 표 — hMerge 이어짐 칸을 버리고 gridSpan=2 를 살린다 (격자 3열)
  const table = result.blocks.find(b => b.type === "table")?.table
  assert.ok(table)
  assert.equal(table.cols, 3)
  assert.equal(table.rows, 2)
  assert.equal(table.cells[0][0].text, "구분")
  assert.equal(table.cells[0][0].colSpan, 2)
  assert.equal(table.cells[1][2].text, "42")

  // 차트 — 제목 + 항목×계열 데이터 표 (엑셀 없이 캐시에서)
  assert.match(md, /## 차트: 매출 추이/)
  const chartTable = result.blocks.filter(b => b.type === "table")[1]?.table
  assert.ok(chartTable)
  assert.deepEqual(chartTable.cells[0].map(c => c.text), ["항목", "매출"])
  assert.deepEqual(chartTable.cells[1].map(c => c.text), ["1분기", "42"])
  assert.deepEqual(chartTable.cells[2].map(c => c.text), ["2분기", "57"])

  // SmartArt — 노드 글을 목록으로
  assert.match(md, /## SmartArt/)
  assert.match(md, /- 기획/)
  assert.match(md, /- 실행/)

  // 그림 추출 + 마크다운 참조
  assert.equal(result.images?.length, 1)
  assert.equal(result.images?.[0].source, "ppt/media/image1.png")
  assert.match(md, /!\[image\]\(image_001\.png\)/)

  // 발표자 노트
  assert.match(md, /## 발표자 노트/)
  assert.match(md, /숫자는 잠정치/)

  // 페이지 사영
  assert.equal(result.pageCount, 2)
  assert.equal(result.pages?.length, 2)
  assert.match(result.pages![0].markdown, /분기 실적/)
  assert.match(result.pages![1].markdown, /그룹 안 글/)
})

test("PPTX: 읽기 순서 — 표 뒤 텍스트가 표 앞으로 오지 않는다", async () => {
  const zip = new JSZip()
  zip.file("ppt/presentation.xml", `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`)
  zip.file("ppt/_rels/presentation.xml.rels", `<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${R}/slide" Target="slides/slide1.xml"/></Relationships>`)
  zip.file("ppt/slides/slide1.xml", `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="1"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>앞 문단</a:t></a:r></a:p></p:txBody></p:sp>
    <p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>셀</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>
    <p:sp><p:nvSpPr><p:cNvPr id="2"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>뒤 문단</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld></p:sld>`)
  const result = await parse(await zip.generateAsync({ type: "nodebuffer" }))
  assert.equal(result.success, true)
  if (!result.success) return
  const order = result.blocks.map(b => b.type === "table" ? "table" : b.text).filter(Boolean)
  assert.deepEqual(order, ["슬라이드 1", "앞 문단", "table", "뒤 문단"])
})

test("PPTX: pages 옵션은 슬라이드 단위로 자른다", async () => {
  const result = await parsePptx(await fixture(), { pages: "2", images: false })
  assert.equal(result.success, true)
  if (!result.success) return
  assert.match(result.markdown, /슬라이드 2/)
  assert.doesNotMatch(result.markdown, /분기 실적/)
  assert.equal(result.images, undefined)
})

test("PPTX: 차트의 빈 값과 SmartArt의 같은 이름 노드를 보존한다", async () => {
  const zip = await JSZip.loadAsync(await fixture())
  const chart = await zip.file("ppt/charts/chart1.xml")!.async("text")
  zip.file("ppt/charts/chart1.xml", chart.replace('<c:pt idx="0"><c:v>42</c:v></c:pt>', '<c:pt idx="0"><c:v></c:v></c:pt>'))
  const diagram = await zip.file("ppt/diagrams/data1.xml")!.async("text")
  zip.file("ppt/diagrams/data1.xml", diagram.replace("</dgm:ptLst>", '<dgm:pt type="node"><dgm:t><a:p><a:r><a:t>실행</a:t></a:r></a:p></dgm:t></dgm:pt></dgm:ptLst>'))
  const result = await parsePptx(await zip.generateAsync({ type: "nodebuffer" }), { ocr: false })
  assert.equal(result.success, true)
  if (!result.success) return
  const chartTable = result.blocks.filter(b => b.type === "table")[1]?.table
  assert.ok(chartTable)
  assert.equal(chartTable.cells[1][1].text, "")
  assert.equal(chartTable.cells[2][1].text, "57")
  assert.equal(result.blocks.filter(b => b.type === "list" && b.text === "실행").length, 2)
})

test("PPTX: 슬라이드 그림을 사용자 OCR 공급자로 읽는다", async () => {
  const calls: Array<{ bytes: number; page: number; mime: string }> = []
  const result = await parsePptx(await fixture(), {
    ocr: async (image, page, mime) => {
      calls.push({ bytes: image.byteLength, page, mime })
      return "그림 속 문구"
    },
  })
  assert.equal(result.success, true)
  if (!result.success) return
  assert.deepEqual(calls, [{ bytes: PNG.byteLength, page: 1, mime: "image/png" }])
  assert.ok(result.blocks.some(b => b.type === "heading" && b.text === "이미지 OCR (image_001.png)"))
  assert.match(result.markdown, /그림 속 문구/)
})

test("PPTX: presentation.xml 이 없으면 UNSUPPORTED_FORMAT 대신 형식 오류", async () => {
  const zip = new JSZip()
  zip.file("ppt/other.xml", "<x/>")
  const result = await parsePptx(await zip.generateAsync({ type: "nodebuffer" }))
  assert.equal(result.success, false)
  if (result.success) return
  assert.equal(result.fileType, "pptx")
  assert.match(result.error, /유효하지 않은 PPTX/)
})
