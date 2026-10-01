/** 같은 공문 문단의 압축 후보는 글꼴 폭 해독을 재사용하되 줄 배치는 보존한다. */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { prepareWrap, simulateWrap, type FaceClass, type WrapMode } from "../src/hwpx/text-metrics.js"
import { fitParagraph } from "../src/hwpx/fit-line.js"

describe("공문 문단 압축 후보의 폭 해독 재사용", () => {
  it("같은 문단의 장평·자간 후보마다 글꼴 폭표를 다시 선택하지 않는다", () => {
    const text = "사업계획 漢字 검토 AI-2026 😀𝐀 (추진·성과) ".repeat(3)
    let lookups = 0
    const font = { get faceClass(): FaceClass { lookups++; return "font:한컴돋움" } }
    const prepared = prepareWrap(text, "keep", font)
    for (const ratio of [100, 97, 95, 92, 90]) for (const spacingPct of [0, -3, -5]) {
      const expected = simulateWrap(text, 40000, 35000, 1400, ratio, "keep", { faceClass: "font:한컴돋움", spacingPct })
      const actual = simulateWrap(text, 40000, 35000, 1400, ratio, "keep", {
        get faceClass() { return font.faceClass }, spacingPct, prepared,
      })
      assert.deepEqual(actual, expected)
    }
    assert.equal(lookups, 1, "폭표 선택은 준비할 때 한 번, 후보 조판은 준비된 문자 폭 사용")
  })

  it("한글·한자·라틴·astral 문자와 다른 첫 줄 폭의 기존 줄 시작을 보존한다", () => {
    const text = "가나다 漢字 AI-2026 😀𝐀 (사업·검토) 가나 다라"
    const prepared = prepareWrap(text, "keep", { faceClass: "font:한컴돋움" })
    assert.deepEqual(simulateWrap(text, 14000, 10000, 1400, 97, "keep", {
      prepared, spacingPct: -3,
    }), { lines: 3, starts: [0, 15, 28], lastLineWidth: 5927.67 })
  })

  it("초장 어절의 글자 분해와 금칙 보정도 같은 UTF-16 위치에서 끊는다", () => {
    const text = "검토 구(강남·강서·광진·동대문·마포·서대문·성동·성북·종로)가 추진"
    const prepared = prepareWrap(text, "charAll", { faceClass: "font:한컴돋움" })
    assert.deepEqual(simulateWrap(text, 12000, 12000, 1400, 97, "charAll", {
      prepared, spacingPct: -4,
    }), { lines: 4, starts: [0, 11, 22, 32], lastLineWidth: 6355.4400000000005 })
  })

  it("빈 문단·탭·묶음 빈칸은 기존 공백 폭과 줄 시작을 유지한다", () => {
    assert.deepEqual(simulateWrap("", 40000, 35000, 1400, 95, "keep", {
      prepared: prepareWrap("", "keep"), spacingPct: -5,
    }), { lines: 1, starts: [0], lastLineWidth: 0 })
    const text = "가\t나   다\u00a0라 😀"
    assert.deepEqual(simulateWrap(text, 6000, 4500, 1000, 100, "keep", {
      prepared: prepareWrap(text, "keep", { faceClass: "fixedPitch" }),
    }), { lines: 2, starts: [0, 6], lastLineWidth: 4000 })
  })

  it("묶음 날짜·공백 폭 오버라이드를 어절·글자 모드 모두 보존한다", () => {
    const text = "사업 2026.\u00a09.\u00a023. 및 실적 😀𝐀 검토"
    for (const mode of ["keep", "charAll"] as WrapMode[]) {
      const opts = { faceClass: "font:휴먼명조" as FaceClass, spaceEm: 300, spacingPct: -7 }
      const expected = simulateWrap(text, 15000, 12000, 1400, 95, mode, opts)
      const actual = simulateWrap(text, 15000, 12000, 1400, 95, mode, {
        ...opts, prepared: prepareWrap(text, mode, opts),
      })
      assert.deepEqual(actual, expected)
      assert.ok(actual.starts.every((i) => text[i] !== "\u00a0" && text[i - 1] !== "\u00a0"))
    }
  })

  it("run 별 사용자 폭이 있으면 준비된 글꼴 폭보다 우선한다", () => {
    const text = "가 😀 나"
    const widths = [1000, 500, 600, 700, 500, 800]
    const prepared = prepareWrap(text, "keep", { faceClass: "font:한컴돋움" })
    assert.deepEqual(
      simulateWrap(text, 2000, 1800, 1400, 95, "keep", { widths, prepared }),
      simulateWrap(text, 2000, 1800, 1400, 95, "keep", { widths }),
    )
  })

  it("고아 줄 압축은 같은 최소 자간을 고르고 단문에는 압축을 만들지 않는다", () => {
    assert.equal(fitParagraph("가나다 라마바" + " 사아".repeat(7), "한컴돋움", 15, 40000, 40000, 90), null)
    assert.deepEqual(fitParagraph("가나다 라마바" + " 사아".repeat(8), "한컴돋움", 15, 40000, 40000, 90), { ratio: 100, spacing: -2 })
    assert.equal(fitParagraph("짧은 항목", "한컴돋움", 15, 40000, 40000, 90), null)
  })
})
