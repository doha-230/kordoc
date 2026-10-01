/**
 * DOCX `w:sym` (Word "기호 삽입") → 유니코드 (#105)
 *
 * `<w:sym w:font="Symbol" w:char="F0B0"/>` 처럼 글자가 w:t 가 아니라 글꼴 코드로 저장된다.
 * Symbol 글꼴은 하위 바이트가 Adobe Symbol 인코딩(Unicode VENDORS/ADOBE/symbol.txt)이다.
 */

/** Adobe Symbol 0x20–0x7E · 0xA0–0xFE (한 글자씩, "\0" 은 대응 글자 없음 — 근호 연장선·미정의) */
const SYMBOL_LO = " !∀#∃%&∋()∗+,−./0123456789:;<=>?≅ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ[∴]⊥_\0αβχδεφγηιϕκλμνοπθρστυϖωξψζ{|}∼"
const SYMBOL_HI = "€ϒ′≤⁄∞ƒ♣♦♥♠↔←↑→↓°±″≥×∝∂•÷≠≡≈…⏐⎯↵ℵℑℜ℘⊗⊕∅∩∪⊃⊇⊄⊂⊆∈∉∠∇®©™∏√⋅¬∧∨⇔⇐⇑⇒⇓◊⟨®©™∑⎛⎜⎝⎡⎢⎣⎧⎨⎩⎪\0⟩∫⌠⎮⌡⎞⎟⎠⎤⎥⎦⎫⎬⎭"

/** 그림 글꼴 — 글자가 아니라 건너뛴다 */
const DINGBAT_FONT_RE = /^\s*(?:wingdings|webdings|marlett|zapf\s*dingbats)/i

/** w:sym 한 개의 글자 — 모르는 글리프는 "" */
export function symbolChar(font: string | null, char: string | null): string {
  const code = parseInt(char ?? "", 16)
  if (!(code >= 0x20 && code <= 0xffff) || DINGBAT_FONT_RE.test(font ?? "")) return ""
  if (/^\s*symbol\s*$/i.test(font ?? "")) {
    const lo = code & 0xff
    const c = lo >= 0x20 && lo <= 0x7e ? SYMBOL_LO[lo - 0x20] : lo >= 0xa0 && lo <= 0xfe ? SYMBOL_HI[lo - 0xa0] : ""
    return c === "\0" ? "" : c
  }
  // 그 밖의 글꼴: F000–F0FF 는 기호 글꼴 글리프 자리(뜻을 모른다), 나머지는 유니코드 코드 포인트
  return code >= 0xf000 && code <= 0xf0ff ? "" : String.fromCharCode(code)
}
