/** 그림으로 단이 드러나는 3단 리플릿 — 클러스터 표 감지 전에 독립 패널을 나눈다. */
import { detectPanelGutters, type ColRect } from "./two-column.js"
import { groupByY, type NormItem } from "./text-line.js"

export function splitImagePanels(items: NormItem[], figures: ColRect[]): NormItem[][] | null {
  if (figures.length === 0) return null
  const rects = items.map(i => ({ x: i.x, y: i.y, w: i.w, h: i.h > 0 ? i.h : i.fontSize }))
  const cuts = detectPanelGutters([...rects, ...figures])
  // 전폭 제목·표를 가르는 단은 기존 밴드 경로에 맡긴다.
  if (!cuts || cuts.length !== 2 || items.some(i => cuts.some(x => i.x < x && i.x + i.w > x))) return null
  const groups = [
    items.filter(i => i.x + i.w <= cuts[0]),
    items.filter(i => i.x >= cuts[0] && i.x + i.w <= cuts[1]),
    items.filter(i => i.x >= cuts[1]),
  ]
  const rows = groupByY(items)
  // 같은 행을 공유하는 세 열은 독립 조판보다 표의 증거다 (2단 거터와 같은 65% 가드).
  const sharedRows = rows.filter(row => new Set(row.map(i => i.x >= cuts[1] ? 2 : i.x >= cuts[0] ? 1 : 0)).size === 3).length
  if (sharedRows / Math.min(...groups.map(group => groupByY(group).length)) > 0.65) return null
  // 제목이 여러 PDF 텍스트 조각으로 나뉘어도 작은 어절 틈으로 이어진 전폭 줄은 가르지 않는다.
  for (const row of rows) {
    const ordered = [...row].sort((a, b) => a.x - b.x)
    let start = ordered[0].x, end = start + ordered[0].w, height = ordered[0].h || ordered[0].fontSize
    for (const i of ordered.slice(1)) {
      const h = i.h || i.fontSize
      if (i.x - end > Math.max(height, h) * 2) start = i.x
      end = Math.max(end, i.x + i.w)
      height = h
      if (cuts.some(x => start < x && end > x)) return null
    }
  }
  return groups
}
