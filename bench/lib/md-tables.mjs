// markdown 표 → IR 표 격자 — 다른 파서 출력과 kordoc 출력을 같은 규칙으로 격자화한다(compare-md-parsers·annex-gt 공용).
// 파이프 표·HTML 표(colspan·rowspan·칸 안 중첩 표)를 table-score 의 collectIrGrids 가 받는 IR 표 블록으로.
import { unescapeMd } from "./normalize.mjs"

// 칸 글 정규화는 본문 채점(mdToPlain)과 같은 규칙이다. 참조 칸 글은 이미지·수식을 빼고 링크는 보이는 글만이라
// 이미지 참조·수식 스팬·링크 문법을 걷고, 태그는 영문자로 시작하는 진짜 태그만 지운다(칸 글 "<비온 후 1일차>" 보존).
// 종전엔 \| 만 풀고 "<…>" 를 모두 지워 마스킹 별표 칸 "\*\*\*"·꺾쇠 캡션 칸이 참조와 교집합 0 → 같은 표를 못 짝지었다
const HTML_ENTITY = { lt: "<", gt: ">", quot: "\"", "#39": "'", amp: "&" }
const stripArtifacts = s => s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/<img\b[^>]*>/gi, " ")
  .replace(/\$\$[^$]+\$\$/g, " ").replace(/(^|[^\\$])\$(?!\s)((?:\\.|[^$\n\\])+?)\$/g, "$1 ")
  .replace(/\[([^\[\]]*)\]\((?:https?:|mailto:|tel:|#)[^)\s]*\)/gi, "$1")
// HTML 칸: 원시 HTML 이라 백슬래시 이스케이프는 글이고(CommonMark §4.6) 글은 엔티티로 나온다
const htmlCellText = s => stripArtifacts(s).replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[A-Za-z][^>]*>/g, "")
  .replace(/&(lt|gt|quot|#39|amp);/g, (_m, e) => HTML_ENTITY[e]).trim()
// 파이프 칸: 이스케이프되지 않은 강조 부호(* ~~)를 걷고 이스케이프를 푼다
const pipeCellText = s => unescapeMd(stripArtifacts(s).replace(/(?<!\\)<br\s*\/?>/gi, "\n").replace(/(?<!\\)<\/?[A-Za-z][^>]*>/g, "")
  .replace(/\\\*/g, "\x02").replace(/\*/g, "").replace(/\x02/g, "\\*")
  .replace(/\\~/g, "\x02").replace(/~~/g, "").replace(/\x02/g, "\\~")).trim()

/** HTML 표 한 개(중첩 포함) → IR 표. 칸 안의 중첩 표는 칸 blocks 로 */
export function htmlTable(html) {
  const re = /<(\/?)(table|tr|td|th)\b([^>]*)>/gi
  const stack = [] // { rows: [[{ text, colSpan, rowSpan, blocks }]], cell: {start, attrs} | null, innerTables: [] }
  let top = null
  let m
  while ((m = re.exec(html)) !== null) {
    const close = m[1] === "/", tag = m[2].toLowerCase(), attrs = m[3]
    const cur = stack[stack.length - 1]
    if (tag === "table") {
      if (!close) stack.push({ rows: [], cell: null, start: m.index })
      else {
        const done = stack.pop()
        const table = toIr(done.rows)
        if (stack.length === 0) { top = table; break }
        const parent = stack[stack.length - 1]
        if (parent.cell) parent.cell.blocks.push({ type: "table", table })
      }
    } else if (!cur) continue
    else if (tag === "tr" && !close) cur.rows.push([])
    else if ((tag === "td" || tag === "th") && !close) {
      const span = k => Math.max(1, parseInt((new RegExp(`${k}\\s*=\\s*["']?(\\d+)`, "i").exec(attrs) ?? [])[1] ?? "1", 10))
      cur.cell = { from: re.lastIndex, colSpan: span("colspan"), rowSpan: span("rowspan"), blocks: [] }
      if (!cur.rows.length) cur.rows.push([])
    } else if ((tag === "td" || tag === "th") && close && cur.cell) {
      // 칸 글 = 칸 원문에서 중첩 표를 뺀 글
      const raw = html.slice(cur.cell.from, m.index).replace(/<table\b[\s\S]*<\/table>/gi, " ")
      cur.rows[cur.rows.length - 1].push({ text: htmlCellText(raw), colSpan: cur.cell.colSpan, rowSpan: cur.cell.rowSpan, blocks: cur.cell.blocks })
      cur.cell = null
    }
  }
  return top
}

/** 행마다 (colSpan·rowSpan 을 가진) 칸 목록 → 가려진 자리를 채운 격자 IR 표 */
function toIr(rows) {
  const grid = []
  let cols = 0
  rows.forEach((row, r) => {
    grid[r] = grid[r] ?? []
    let c = 0
    for (const cell of row) {
      while (grid[r][c]) c++
      for (let dr = 0; dr < cell.rowSpan; dr++) for (let dc = 0; dc < cell.colSpan; dc++) {
        grid[r + dr] = grid[r + dr] ?? []
        grid[r + dr][c + dc] = dr === 0 && dc === 0 ? { text: cell.text, colSpan: cell.colSpan, rowSpan: cell.rowSpan, ...(cell.blocks.length ? { blocks: cell.blocks } : {}) } : "covered"
      }
      c += cell.colSpan
      cols = Math.max(cols, c)
    }
  })
  const out = grid.slice(0, Math.max(rows.length, 1)).map(row => Array.from({ length: cols }, (_, c) => {
    const v = row?.[c]
    return v && v !== "covered" ? v : { text: "", colSpan: 1, rowSpan: 1 }
  }))
  return { rows: out.length, cols, cells: out, hasHeader: true }
}

function splitPipeRow(line) {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  return t.split(/(?<!\\)\|/).map(c => pipeCellText(c))
}

/** markdown → 표 블록 목록 (문서 순서) */
export function mdTables(md) {
  const blocks = []
  const lines = md.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*<table\b/i.test(line)) {
      // HTML 표 — 여는 태그부터 짝이 맞는 닫는 태그까지
      let depth = 0, j = i, buf = ""
      for (; j < lines.length; j++) {
        buf += lines[j] + "\n"
        depth += (lines[j].match(/<table\b/gi) ?? []).length - (lines[j].match(/<\/table>/gi) ?? []).length
        if (depth <= 0) break
      }
      const t = htmlTable(buf)
      if (t) blocks.push({ type: "table", table: t })
      i = j
    } else if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const rows = [splitPipeRow(line)]
      let j = i + 2
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) rows.push(splitPipeRow(lines[j]))
      blocks.push({ type: "table", table: toIr(rows.map(r => r.map(text => ({ text, colSpan: 1, rowSpan: 1, blocks: [] })))) })
      i = j - 1
    }
  }
  return blocks
}
