/** OCR 로 읽은 제목 후보 강등 — 인포그래픽 글 조각은 제목이 아니다 (src/pdf/heading-demote.ts) */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { demoteNonHeadingRoles } from "../src/pdf/heading-demote.js"
import type { IRBlock } from "../src/types.js"

const h = (text: string, y: number, fontName = "ocr"): IRBlock => ({ type: "heading", level: 3, text, pageNumber: 1,
  bbox: { page: 1, x: 60, y, width: 300, height: 20 }, style: { fontName, fontSize: 18 } })

describe("OCR heading candidates", () => {
  it("demotes OCR fragments: leading punctuation, ellipsis, a lone letter, sentence-long lines", () => {
    // ODL 141 "10 THINGS YOU SHOULD KNOW ABOUT COPYRIGHT" 인포그래픽
    const blocks = [h("COPYRIGHT", 700), h(". Uploading you … llection of music, movies,", 600), h("C", 500),
      h("Facts and ideas are not protected bycopyright, neither", 400)]
    demoteNonHeadingRoles(blocks, new Map([[1, 800]]))
    assert.deepEqual(blocks.map(b => b.type), ["heading", "paragraph", "paragraph", "paragraph"])
  })

  it("keeps the same shapes when they come from the text layer", () => {
    const blocks = [h("Facts and ideas are not protected by copyright, neither are", 400, "Body")]
    demoteNonHeadingRoles(blocks, new Map([[1, 800]]))
    assert.equal(blocks[0].type, "heading")
  })
})

describe("OCR display titles and crowded prose", () => {
  const sized = (text: string, y: number, size: number, height = size * 0.9): IRBlock => ({
    type: "heading", level: 1, text, pageNumber: 1,
    bbox: { page: 1, x: 100, y, width: 500, height }, style: { fontName: "ocr", fontSize: size },
  })
  const prose = (text: string, y: number, size: number, height = size * 0.9): IRBlock => ({ ...sized(text, y, size, height), type: "paragraph", level: undefined })

  it("keeps a display line twice the prose size above an even larger title", () => {
    const blocks = [sized("THINGS EVERY AUTHOR SHOULD KNOW", 900, 66, 59), sized("CREATIVITY", 640, 190, 171),
      ...Array.from({ length: 8 }, (_, i) => prose("Readers and authors create and share their own work every day.", 500 - i * 40, 30))]
    demoteNonHeadingRoles(blocks, new Map([[1, 1000]]))
    assert.equal(blocks[0].type, "heading")
    assert.equal(blocks[1].type, "heading")
  })

  it("still demotes a prose-sized kicker on a page with body typography", () => {
    const blocks = [sized("A GUIDE TO WRITING", 700, 12), sized("WRITING", 665, 24),
      ...Array.from({ length: 8 }, (_, i) => prose("Readers and authors create and share their own work every day.", 550 - i * 40, 12))]
    demoteNonHeadingRoles(blocks, new Map([[1, 800]]))
    assert.equal(blocks[0].type, "paragraph")
    assert.equal(blocks[1].type, "heading")
  })

  it("demotes a text-layer kicker even when chart notes make the body size tiny", () => {
    const blocks = [sized("Overview of a service", 368, 11), sized("Model performance evaluation", 341, 17),
      ...Array.from({ length: 8 }, (_, i) => prose("Chart notes explain the evaluation criteria and the measured results.", 150 - i * 12, 4))]
    for (const block of blocks) block.style!.fontName = "Text"
    demoteNonHeadingRoles(blocks, new Map([[1, 405]]))
    assert.equal(blocks[0].type, "paragraph")
    assert.equal(blocks[1].type, "heading")
  })

  it("demotes an inflated OCR box overlapping prose on both sides", () => {
    const blocks = [prose("The protection eventually expires.", 709, 32, 29),
      sized("Eventually authors may share their work", 685, 45, 40),
      prose("The work then becomes available to readers.", 667, 32, 29)]
    demoteNonHeadingRoles(blocks, new Map([[1, 1000]]))
    assert.equal(blocks[1].type, "paragraph")
  })

  it("keeps a separate heading between body paragraphs", () => {
    const blocks = [prose("A paragraph before the next section.", 750, 32, 29),
      sized("Sharing creative work", 685, 45, 40),
      prose("A paragraph explaining the next section.", 630, 32, 29)]
    demoteNonHeadingRoles(blocks, new Map([[1, 1000]]))
    assert.equal(blocks[1].type, "heading")
  })

  it("does not apply the OCR overlap rule to text-layer font sizes", () => {
    const blocks = [prose("The protection eventually expires.", 709, 32, 29),
      { ...sized("Eventually authors may share their work", 685, 45, 40), style: { fontName: "Title", fontSize: 45 } },
      prose("The work then becomes available to readers.", 667, 32, 29)]
    demoteNonHeadingRoles(blocks, new Map([[1, 1000]]))
    assert.equal(blocks[1].type, "heading")
  })
  it("keeps headings when overlap is one-sided, in another column, or from other fonts", () => {
    for (const kind of ["one-sided", "other-column", "other-font"] as const) {
      const before = prose("The paragraph before the next section.", 709, 32, 29)
      const after = prose("The paragraph after the next section.", 667, 32, 29)
      if (kind === "one-sided") after.bbox!.y = 630
      if (kind === "other-column") after.bbox!.x = 700
      if (kind === "other-font") after.style!.fontName = "Body"
      const blocks = [before, sized("Sharing creative work", 685, 45, 40), after]
      demoteNonHeadingRoles(blocks, new Map([[1, 1000]]))
      assert.equal(blocks[1].type, "heading", kind)
    }
  })

})
