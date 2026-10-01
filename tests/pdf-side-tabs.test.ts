/** 쪽 옆 색인 탭 — 장·절 이름을 쪽 바깥 띠에 세로로 찍은 것은 되풀이 장식이다 (src/pdf/side-tabs.ts) */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { removeSideTabs } from "../src/pdf/side-tabs.js"
import type { IRBlock } from "../src/types.js"

const W = 555
const b = (text: string, page: number, x: number, width = 12): IRBlock => ({ type: "paragraph", text, pageNumber: page, bbox: { page, x, y: 400, width, height: 12 } })

describe("removeSideTabs", () => {
  it("drops short text repeated in the outer side band across pages (행정업무운영 편람 '제1절'·'공')", () => {
    const pages = [33, 35, 37, 39]
    const blocks = pages.flatMap(p => [b("제1절", p, 505), b("공", p, 510), b("본문 단락입니다. 내용이 이어집니다", p, 100, 300)])
    const out = removeSideTabs(blocks, new Map(pages.map(p => [p, W] as [number, number])))
    assert.deepEqual(out.map(x => x.text), Array(4).fill("본문 단락입니다. 내용이 이어집니다"))
  })

  it("장마다 되풀이되는 절 탭 — 책 전체로는 성겨도 한 장 안에서 몰려 되풀이되면 뺀다 ('제1절' 이 장마다 몇 쪽씩)", () => {
    const pages = [10, 11, 12, 13, 60, 61, 62, 120, 121, 122, 123]
    const blocks = pages.flatMap(p => [b("제1절", p, 505), b("본문 단락입니다. 내용이 이어집니다", p, 100, 300)])
    const out = removeSideTabs(blocks, new Map(pages.map(p => [p, W] as [number, number])))
    assert.ok(out.every(x => x.text !== "제1절"))
  })

  it("keeps side text that appears once or sparsely, and long text", () => {
    const blocks = [b("주석", 1, 505), b("주석", 30, 505), b("주석", 60, 505), b("가장자리에 놓인 긴 설명 문장입니다", 2, 500, 50), b("두 단 왼단 첫머리 뒤 본문 줄입니다", 5, 28, 250), b("따라서", 5, 28, 30), b("따라서", 6, 28, 30), b("따라서", 7, 28, 30), b("두 단 왼단 첫머리 뒤 본문 줄입니다", 6, 28, 250), b("두 단 왼단 첫머리 뒤 본문 줄입니다", 7, 28, 250)]
    // 두 단 왼단 첫머리의 짧은 줄("따라서")은 본문 왼끝에 붙어 있어 탭이 아니다 (수능 모의고사 해설)
    assert.equal(removeSideTabs(blocks, new Map([1, 2, 5, 6, 7, 30, 60].map(p => [p, W] as [number, number]))).length, blocks.length)
  })
})
