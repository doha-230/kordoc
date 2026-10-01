/**
 * 개조식 장 헤더 제목 칸 글자 폭 맞춤(chapterFit) — 기본은 본문 폭 그대로, 켜면 제목 칸이 글자 실폭에 맞는다.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import JSZip from "jszip"
import { markdownToHwpx, parse } from "../src/index.js"
import { buildGongmunOptions } from "../src/hwpx/gongmun-surface.js"
import { measureTextWidth, faceClassForGen } from "../src/hwpx/text-metrics.js"

const md = `# 강사 프로필\n\n## 기본 정보\n\n내용임\n\n## 강의 가능 분야\n\n내용임\n\n## ${"아주 긴 장 제목".repeat(8)}\n\n내용임`

/** 장 헤더 표마다 [표 폭, 제목 칸 폭, 좌우 바깥 여백, 제목 글] */
async function chapterTables(buf: ArrayBuffer): Promise<{ tblW: number; titleW: number; outLR: string; title: string }[]> {
  const sec = await (await JSZip.loadAsync(buf)).file("Contents/section0.xml")!.async("text")
  const out: { tblW: number; titleW: number; outLR: string; title: string }[] = []
  for (const m of sec.matchAll(/<hp:tbl [^>]*>(?:(?!<hp:tbl ).)*?name="__kordoc_h2".*?<\/hp:tbl>/gs)) {
    const t = m[0]
    const tblW = Number(t.match(/<hp:sz width="(\d+)"/)![1])
    const titleCell = t.slice(t.indexOf('name="__kordoc_h2"'))
    out.push({
      tblW,
      titleW: Number(titleCell.match(/<hp:cellSz width="(\d+)"/)![1]),
      outLR: t.match(/<hp:outMargin left="(\d+)" right="(\d+)"/)!.slice(1).join(","),
      title: titleCell.match(/<hp:t>([^<]*)<\/hp:t>/)![1].trim(),
    })
  }
  return out
}

describe("개조식 장 헤더 제목 칸 글자 폭 맞춤 (chapterFit)", () => {
  it("기본값은 종전 그대로 — 장 헤더 표가 모두 같은 본문 폭", async () => {
    const tbls = await chapterTables(await markdownToHwpx(md, { gongmun: { preset: "gaejosik", cover: false, toc: false } }))
    assert.equal(tbls.length, 3)
    assert.ok(tbls.every(t => t.tblW === tbls[0].tblW && t.titleW === tbls[0].titleW), JSON.stringify(tbls))
  })

  it("켜면 제목 칸이 글자 실폭 + 여유로 줄고, 표 폭도 같이 준다", async () => {
    const full = await chapterTables(await markdownToHwpx(md, { gongmun: { preset: "gaejosik", cover: false, toc: false } }))
    const fit = await chapterTables(await markdownToHwpx(md, { gongmun: { preset: "gaejosik", cover: false, toc: false, chapterFit: true } }))
    const text = (s: string) => measureTextWidth(` ${s} `, 1700, 100, { faceClass: faceClassForGen("HY헤드라인M") })
    for (const i of [0, 1]) {
      assert.ok(fit[i].titleW >= text(fit[i].title) + 282, `글자가 칸 안에 든다: ${fit[i].title}`)
      assert.ok(fit[i].titleW < full[i].titleW / 3, `본문 폭보다 훨씬 좁다: ${fit[i].titleW}`)
      assert.equal(full[i].tblW - fit[i].tblW, full[i].titleW - fit[i].titleW, "줄어든 만큼 표 폭도 준다")
      assert.equal(fit[i].outLR, full[i].outLR, "바깥 여백이 같아 왼쪽 끝이 종전 자리")
    }
    assert.ok(fit[1].titleW > fit[0].titleW, "긴 제목일수록 칸이 넓다")
    // 본문 폭보다 긴 제목은 종전 폭에서 멈춘다(넘치지 않음)
    assert.equal(fit[2].titleW, full[2].titleW)
  })

  it("장 크기 오버라이드(sizes.chapter)를 폭 계산에 반영", async () => {
    const base = await chapterTables(await markdownToHwpx(md, { gongmun: { preset: "gaejosik", cover: false, toc: false, chapterFit: true } }))
    const big = await chapterTables(await markdownToHwpx(md, { gongmun: { preset: "gaejosik", cover: false, toc: false, chapterFit: true, sizes: { chapter: 22 } } }))
    assert.ok(big[0].titleW > base[0].titleW, `22pt 가 17pt 보다 넓다: ${big[0].titleW} vs ${base[0].titleW}`)
  })

  it("왕복 — 폭을 줄여도 파서가 장 헤더를 heading 2 로 복원", async () => {
    const back = await parse(await markdownToHwpx(md, { gongmun: { preset: "gaejosik", cover: false, toc: false, chapterFit: true } }))
    assert.ok(back.success)
    const h2 = back.blocks.filter(b => b.type === "heading" && b.level === 2).map(b => b.text)
    assert.deepEqual(h2.slice(0, 2), ["기본 정보", "강의 가능 분야"])
  })

  it("CLI·MCP 공용 조립(buildGongmunOptions)이 chapterFit 을 전달", () => {
    assert.equal(buildGongmunOptions({ preset: "gaejosik", chapterFit: true }).chapterFit, true)
    assert.ok(!("chapterFit" in buildGongmunOptions({ preset: "gaejosik" })))
  })
})
