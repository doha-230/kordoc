/** Page decorations are separate stories: their line positions never split body pages. */
import { findChildByLocalName } from "../hwpx/parser-shared.js"
import { elements, findFirst, isDeletedControl, ln, num } from "./para-model.js"

export interface PageStory { sub: Element; page: number; x: number; y: number; width: number; layer?: -2 | 2 }
export function pageStories(root: Element, masters: Element[], paraPages: Map<Element, number[]>, pageCount: number, pageBase: number,
  geom: { ML: number; MT: number; PH: number; BODY_W: number }): PageStory[] {
  const secPr = findFirst(root, "secPr"), visibility = secPr && findChildByLocalName(secPr, "visibility")
  const pagePr = secPr && findChildByLocalName(secPr, "pagePr"), margin = pagePr && findChildByLocalName(pagePr, "margin")
  const declarations: Array<{ el: Element; page: number; kind: string }> = []
  const hidden = new Map<number, Set<string>>()
  for (const p of elements(root)) if (ln(p) === "p") {
    const page = paraPages.get(p)?.[0] ?? 0
    for (const run of elements(p)) if (ln(run) === "run") for (const ctrl of elements(run)) if (ln(ctrl) === "ctrl") {
      for (const el of elements(ctrl)) {
        if (isDeletedControl(el)) continue
        const kind = ln(el)
        if (kind === "header" || kind === "footer") declarations.push({ el, page, kind })
        else if (kind === "pageHiding") {
          const kinds = hidden.get(page) ?? new Set<string>()
          for (const name of ["Header", "Footer", "MasterPage"]) if (num(el, `hide${name}`)) kinds.add(name)
          hidden.set(page, kinds)
        }
      }
    }
  }
  const parity = (type: string, n: number): boolean => type === "BOTH" || (type === "ODD" && n % 2 === 1) || (type === "EVEN" && n % 2 === 0)
  const out: PageStory[] = []
  for (let page = 0; page < pageCount; page++) {
    const n = pageBase + page + 1
    const hides = (name: string): boolean => hidden.get(page)?.has(name) === true || (page === 0 && num(visibility, `hideFirst${name}`) !== 0)
    if (!hides("MasterPage")) {
      // ODD/EVEN replace BOTH on their pages; they are not an overlay.
      const matching = masters.filter(m => m.getAttribute("type") === (n % 2 ? "ODD" : "EVEN"))
      const both = masters.filter(m => (m.getAttribute("type") || "BOTH") === "BOTH")
      const normal = (matching.length ? matching : both).slice(-1)
      const specific = masters.filter(m => m.getAttribute("type") === "LAST_PAGE" ? page === pageCount - 1 : m.getAttribute("type") === "OPTIONAL_PAGE" && num(m, "pageNumber") === page + 1)
      const special = specific.slice(-1)
      const selected = special.length && !num(special[0], "pageDuplicate") ? special : [...normal, ...special]
      for (const master of selected) {
        const sub = findChildByLocalName(master, "subList")
        if (sub) out.push({ sub, page, x: geom.ML, y: geom.MT, width: geom.BODY_W, layer: num(master, "pageFront") ? 2 : -2 })
      }
    }
    for (const kind of ["header", "footer"]) {
      if (hides(kind === "header" ? "Header" : "Footer")) continue
      const eligible = declarations.filter(d => d.kind === kind && d.page <= page && parity(d.el.getAttribute("applyPageType") || "BOTH", n))
      const decl = eligible[eligible.length - 1]
      const sub = decl && findChildByLocalName(decl.el, "subList")
      if (sub) out.push({ sub, page, x: geom.ML, y: kind === "header" ? num(margin, "top", 5668) : geom.PH - num(margin, "bottom", 4252) - num(margin, "footer"), width: geom.BODY_W })
    }
  }
  return out
}
