import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { IRBlock } from "../src/types.js"
import { isProseBesidePanel } from "../src/pdf/page-blocks.js"

const para = (x: number, y: number, width: number, height: number): IRBlock =>
  ({ type: "paragraph", text: "prose", pageNumber: 1, bbox: { page: 1, x, y, width, height } })

describe("isProseBesidePanel — 오른쪽 패널 옆 본문 단", () => {
  // ODL 157 실측: 패널 x 223~339 · y 151~547, 본문 단 x 57~214, 끝줄만 x 57~240 으로 패널 밑에서 삐져나감
  const panel = { x: 223, y: 151, width: 116, height: 396 }

  it("패널 옆 줄과 패널 아래로 완전히 내려간 넓은 끝줄", () => {
    assert.equal(isProseBesidePanel([para(57, 461, 157, 51), para(57, 125, 183, 9)], panel), true)
  })

  it("옆에서 시작해 패널 밑으로 내려오며 넓어진 문단도 같은 단이다", () => {
    assert.equal(isProseBesidePanel([para(57, 461, 157, 51), para(57, 125, 183, 37)], panel), true)
  })

  it("패널과 나란히 넓게 걸친 블록이 있으면 옆 단이 아니다", () => {
    assert.equal(isProseBesidePanel([para(57, 461, 157, 51), para(57, 300, 300, 20)], panel), false)
  })
})
