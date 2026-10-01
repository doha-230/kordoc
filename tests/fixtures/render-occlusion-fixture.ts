import JSZip from "jszip"
import sharp from "sharp"
import { markdownToHwpx } from "../../src/hwpx/generator.js"
import { seg } from "./render-fixture.js"

const ns = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page"'
export function floatingPos(x: number, y: number): string {
  return `<hp:pos treatAsChar="0" vertRelTo="PAPER" horzRelTo="PAPER" vertAlign="TOP" horzAlign="LEFT" vertOffset="${y}" horzOffset="${x}"/>`
}
export function photo(wrap = "TOP_AND_BOTTOM", z = 1): string {
  return `<hp:pic id="photo" zOrder="${z}" textWrap="${wrap}"><hp:sz width="20000" height="12500"/>${floatingPos(10000, 15000)}<hc:img binaryItemIDRef="photo"/><hp:imgDim dimwidth="400" dimheight="250"/></hp:pic>`
}
export const solid = '<hc:winBrush faceColor="#000000"/>'
export const gradient = '<hc:gradation type="LINEAR" angle="90" alpha="0"><hc:color value="#000000"/><hc:color value="#000000"/></hc:gradation>'
export const imageFill = '<hc:imgBrush mode="TOTAL"><hc:img binaryItemIDRef="black"/></hc:imgBrush>'
export function cover(opts: { fill?: string; tag?: string; angle?: number; z?: number; wrap?: string } = {}): string {
  const { fill = solid, tag = "rect", angle = 0, z = 5, wrap = "IN_FRONT_OF_TEXT" } = opts
  const w = angle ? 6600 : 9000, h = angle ? 9000 : 7500
  const x = angle ? 20700 : 19500, y = angle ? 16750 : 17500
  const geometry = tag === "curve" ? [[0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]].map(p => `<hp:seg type="LINE" x1="${p[0]}" y1="${p[1]}" x2="${p[2]}" y2="${p[3]}"/>`).join("") : ""
  return `<hp:${tag} id="cover" zOrder="${z}" textWrap="${wrap}"><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="${w}" height="${h}"/><hp:sz width="${w}" height="${h}"/><hp:rotationInfo angle="${angle}" centerX="${w / 2}" centerY="${h / 2}"/>${floatingPos(x, y)}<hp:lineShape style="NONE"/><hc:fillBrush>${fill}</hc:fillBrush>${geometry}</hp:${tag}>`
}
export function cachedPara(inner: string, v = 0): string {
  return `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${inner}</hp:run><hp:linesegarray>${seg(v, 42520)}</hp:linesegarray></hp:p>`
}
export async function occlusionFixture(body: string[], opts: { master?: string; front?: boolean; visibility?: string; masterType?: string } = {}): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await markdownToHwpx("기준"))
  const secPr = `<hp:secPr><hp:pagePr width="59528" height="84186"><hp:margin left="8504" right="8504" top="5668" bottom="4252" header="4252" footer="4252"/></hp:pagePr>${opts.visibility ?? ""}${opts.master ? '<hp:masterPage idRef="master0"/>' : ""}</hp:secPr>`
  zip.file("Contents/section0.xml", `<hs:sec ${ns}>${cachedPara(secPr)}${body.join("")}</hs:sec>`)
  if (opts.master) zip.file("Contents/masterpage0.xml", `<hm:masterPage ${ns} id="master0" type="${opts.masterType ?? "BOTH"}" pageFront="${opts.front === false ? 0 : 1}" pageDuplicate="0"><hp:subList>${opts.master}</hp:subList></hm:masterPage>`)
  const pixels = Buffer.alloc(400 * 250 * 3)
  for (let y = 0; y < 250; y++) for (let x = 0; x < 400; x++) {
    const i = (y * 400 + x) * 3, red = x >= 200 && x < 360 && y >= 60 && y < 190
    pixels.set(red ? [210, 30, 30] : [150, 170, 190], i)
  }
  zip.file("BinData/photo.png", await sharp(pixels, { raw: { width: 400, height: 250, channels: 3 } }).png().toBuffer())
  zip.file("BinData/black.png", await sharp({ create: { width: 8, height: 8, channels: 3, background: "black" } }).png().toBuffer())
  return new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }))
}
