import { test } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"
import JSZip from "jszip"
import { extractRenderedRegions } from "../src/render/regions.js"
import { renderHwpxPages, renderSectionRoots, assemblePageSvgs } from "../src/render/svg-render.js"
import { buildPara, prepareDeletedRanges } from "../src/render/para-model.js"
import { pageStories } from "../src/render/page-stories.js"
import { createXmlParser } from "../src/hwpx/parser-shared.js"
import { cachedPara, cover, photo, gradient, imageFill, occlusionFixture } from "./fixtures/render-occlusion-fixture.js"

async function redPixels(input: Uint8Array, reflow = true): Promise<number[]> {
  const result = await extractRenderedRegions(input, { types: ["image"], maxWidthPx: 1191, reflow })
  return Promise.all(result.map(async r => {
    const { data, info } = await sharp(r.data).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let red = 0
    for (let i = 0; i < data.length; i += info.channels) if (data[i] > 180 && data[i + 1] < 80 && data[i + 2] < 80) red++
    return red
  }))
}
test("image crop contains the page's front objects independent of paragraph order", async () => {
  const control = await occlusionFixture([cachedPara(photo(), 1600)])
  assert.ok((await redPixels(control))[0] > 1000)
  for (const reverse of [false, true]) {
    const body = [cachedPara(photo(), 1600), cachedPara(cover(), 3200)]
    if (reverse) body.reverse()
    // Preserve increasing cached paragraph positions when changing XML object order.
    const input = await occlusionFixture(body.map((p, i) => p.replace(/vertpos="\d+"/, `vertpos="${1600 * (i + 1)}"`)))
    assert.deepEqual(await redPixels(input), [0])
  }
})
for (const [name, opts] of [["gradient", { fill: gradient }], ["image brush", { fill: imageFill }], ["LINE curve", { tag: "curve" }], ["rotation", { angle: 90 }]] as const) {
  test(`${name} shape obscures the covered photo pixels`, async () => {
    const input = await occlusionFixture([cachedPara(photo(), 1600), cachedPara(cover(opts), 3200)])
    assert.deepEqual(await redPixels(input), [0])
    const { scene } = await renderHwpxPages(input)
    assert.equal(scene.stats.shapes, 1)
    if (name === "rotation") {
      const box = scene.regions.find(r => r.type === "shape")!.regions[0]
      assert.deepEqual(box, { page: 1, x: 195, y: 179.5, width: 90, height: 66 })
    }
  })
}
test("master page and header front objects participate in page painting", async () => {
  for (const input of [
    await occlusionFixture([cachedPara(photo(), 1600)], { master: cachedPara(cover()) }),
    await occlusionFixture([cachedPara(`<hp:ctrl><hp:header applyPageType="BOTH"><hp:subList>${cachedPara(cover())}</hp:subList></hp:header></hp:ctrl>`, 800), cachedPara(photo(), 1600)]),
  ]) assert.deepEqual(await redPixels(input), [0])
})
test("uncached decoration objects keep their declared PAPER anchor without reflow", async () => {
  const uncached = cachedPara(cover()).replace(/<hp:linesegarray>.*?<\/hp:linesegarray>/, "")
  const input = await occlusionFixture([cachedPara(photo(), 1600)], { master: uncached })
  assert.deepEqual(await redPixels(input, false), [0])
})
test("deleted content is absent while cached text positions keep their slots", async () => {
  const inner = '<hp:t>A</hp:t><hp:ctrl><hp:deleteBegin Id="1"/></hp:ctrl>' + photo() + '<hp:t>hidden😀<hp:tab width="500"/></hp:t><hp:ctrl><hp:deleteEnd Id="1"/></hp:ctrl><hp:t>B</hp:t>'
  const doc = createXmlParser().parseFromString(`<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">${cachedPara(inner)}</hs:sec>`, "text/xml")
  const p = doc.documentElement.firstChild as unknown as Element
  const model = buildPara(p)
  assert.equal(model.objs.length, 0)
  assert.equal(model.chars.map(c => c.ch).join(""), "AB")
  assert.equal(model.chars.length, 42)
  assert.ok(model.chars.every(c => !c.tab))
  const input = await occlusionFixture([cachedPara(inner, 1600)])
  assert.deepEqual(await redPixels(input), [])
})

test("front objects cover later paragraph text, behind objects stay behind photos", async () => {
  const text = cachedPara('<hp:t>XXXXX XXXXX XXXXX</hp:t>', 9500)
  const front = await occlusionFixture([cachedPara(photo("IN_FRONT_OF_TEXT"), 1600), text])
  const bare = await occlusionFixture([cachedPara(photo("IN_FRONT_OF_TEXT"), 1600)])
  const crop = async (input: Uint8Array) => {
    const asset = (await extractRenderedRegions(input, { types: ["image"], maxWidthPx: 1191 }))[0]
    // cropRect floors the start: its outer pixel can include content just outside
    // the object's rectangle. Compare interior pixels where the photo is opaque.
    return sharp(asset.data).extract({ left: 2, top: 2, width: asset.widthPx - 4, height: asset.heightPx - 4 }).raw().toBuffer()
  }
  assert.ok((await crop(front)).equals(await crop(bare)))
  const behind = await occlusionFixture([cachedPara(photo(), 1600), cachedPara(cover({ wrap: "BEHIND_TEXT", z: 99 }), 3200)])
  assert.ok((await redPixels(behind))[0] > 1000)
  for (const z of [0, 10]) {
    const input = await occlusionFixture([cachedPara(cover({ z }), 1600), cachedPara(photo("IN_FRONT_OF_TEXT", 5), 3200)])
    assert.equal((await redPixels(input))[0] === 0, z === 10)
  }
})

test("floating object layers and page decorations remain page-local", async () => {
  const body = [cachedPara(cover(), 800), cachedPara(photo(), 1600), cachedPara(photo(), 0)]
  const input = await occlusionFixture(body)
  const values = await redPixels(input)
  assert.equal(values.length, 2)
  assert.equal(values[0], 0)
  assert.ok(values[1] > 1000)
  const { scene, pageSvgs } = await renderHwpxPages(input, {}, new Set([2]))
  assert.equal(scene.pages.length, 2)
  assert.deepEqual([...pageSvgs.keys()], [2])
  for (const opts of [
    { master: cachedPara(cover()), masterType: "ODD" },
    { master: cachedPara(cover()), visibility: '<hp:visibility hideFirstMasterPage="1"/>' },
    { master: cachedPara(cover()), front: false },
  ]) {
    const reds = await redPixels(await occlusionFixture([cachedPara(photo(), 1600), cachedPara(photo(), 0)], opts))
    assert.equal(reds.length, 2)
    if (opts.front === false) assert.ok(reds.every(n => n > 1000))
    else if (opts.visibility) { assert.ok(reds[0] > 1000); assert.equal(reds[1], 0) }
    else { assert.equal(reds[0], 0); assert.ok(reds[1] > 1000) }
  }
})

test("deleted ranges can cross paragraphs without shifting cached line slots", () => {
  const xml = `<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">${cachedPara('<hp:ctrl><hp:deleteBegin Id="1"/></hp:ctrl><hp:t>old</hp:t>')}${cachedPara(photo() + '<hp:t>old</hp:t><hp:ctrl><hp:deleteEnd Id="1"/></hp:ctrl><hp:t>new</hp:t>')}</hs:sec>`
  const root = createXmlParser().parseFromString(xml, "text/xml").documentElement as unknown as Element
  prepareDeletedRanges(root)
  const second = buildPara(root.lastChild as Element)
  assert.equal(second.objs.length, 0)
  assert.equal(second.chars.map(c => c.ch).join(""), "new")
  assert.equal(second.chars[19].ch, "n")
})

test("master page selection follows parity override and special-page overlap", () => {
  const parse = (xml: string): Element => createXmlParser().parseFromString(xml, "text/xml").documentElement as unknown as Element
  const master = (type: string, text: string, duplicate = 0) => parse(`<masterPage type="${type}" pageNumber="2" pageDuplicate="${duplicate}"><subList><p>${text}</p></subList></masterPage>`)
  const root = parse('<sec/>'), geom = { ML: 8504, MT: 9920, PH: 84186, BODY_W: 42520 }
  const masters = [master("BOTH", "both"), master("ODD", "odd"), master("LAST_PAGE", "last")]
  const select = () => pageStories(root, masters, new Map(), 3, 0, geom).map(s => [s.page, s.sub.textContent])
  assert.deepEqual(select(), [[0, "odd"], [1, "both"], [2, "last"]])
  masters[2].setAttribute("pageDuplicate", "1")
  assert.deepEqual(select(), [[0, "odd"], [1, "both"], [2, "odd"], [2, "last"]])
  masters.push(master("OPTIONAL_PAGE", "optional"))
  assert.deepEqual(select(), [[0, "odd"], [1, "optional"], [2, "odd"], [2, "last"]])
})

test("headers start on their declaration page and choose the last eligible definition", () => {
  const root = createXmlParser().parseFromString('<sec><p><run><ctrl><header applyPageType="BOTH"><subList><p>first</p></subList></header></ctrl></run></p><p><run><ctrl><header applyPageType="ODD"><subList><p>odd</p></subList></header><footer applyPageType="BOTH"><subList><p>foot</p></subList></footer></ctrl></run></p></sec>', "text/xml").documentElement as unknown as Element
  const ps = Array.from(root.childNodes) as unknown as Element[]
  const stories = pageStories(root, [], new Map([[ps[0], [1]], [ps[1], [2]]]), 4, 0, { ML: 8504, MT: 9920, PH: 84186, BODY_W: 42520 })
  assert.deepEqual(stories.map(s => [s.page, s.sub.textContent]), [[1, "first"], [2, "odd"], [2, "foot"], [3, "first"], [3, "foot"]])
})

test("deleted header/footer and hiding controls do not override live decorations", async () => {
  const dead = '<hp:ctrl><hp:deleteBegin Id="1"/><hp:header applyPageType="BOTH"><hp:subList><hp:p><hp:run><hp:t>deleted header</hp:t></hp:run></hp:p></hp:subList></hp:header><hp:footer applyPageType="BOTH"><hp:subList><hp:p><hp:run><hp:t>deleted footer</hp:t></hp:run></hp:p></hp:subList></hp:footer><hp:pageHiding hideHeader="1" hideMasterPage="1"/><hp:deleteEnd Id="1"/></hp:ctrl>'
  const live = '<hp:ctrl><hp:header applyPageType="BOTH"><hp:subList>' + cachedPara('<hp:t>live header</hp:t>') + '</hp:subList></hp:header></hp:ctrl>'
  const input = await occlusionFixture([cachedPara(live, 800), cachedPara(dead, 1600), cachedPara(photo(), 3200)], { master: cachedPara(cover()) })
  const { pageSvgs } = await renderHwpxPages(input, { reflow: true })
  const svg = pageSvgs.get(1)!
  assert.ok(svg.includes('live header'))
  assert.ok(!svg.includes('deleted header'))
  assert.ok(!svg.includes('deleted footer'))
  assert.deepEqual(await redPixels(input), [0])
})

test("repeated TOTAL image brushes share one embedded paint image", async () => {
  const input = await occlusionFixture([cachedPara(photo(), 1600), cachedPara(cover({ fill: imageFill }), 3200), cachedPara(cover({ fill: imageFill }), 4800)])
  const { pageSvgs } = await renderHwpxPages(input)
  const svg = pageSvgs.get(1)!
  assert.equal((svg.match(/data:image\/png;base64,/g) ?? []).length, 2)
  assert.equal((svg.match(/<pattern /g) ?? []).length, 1)
  assert.deepEqual(await redPixels(input), [0])
})

test("rotated shape text regions crop the painted glyphs", async () => {
  for (const angle of [0, 90, -90, 45]) {
    const text = cachedPara('<hp:t>TEXT</hp:t>').replace('horzsize="42520"', 'horzsize="3000"')
    const shape = cover({ angle, fill: '<hc:winBrush faceColor="none"/>' }).replace('</hp:rect>', `<hp:drawText><hp:subList>${text}</hp:subList></hp:drawText></hp:rect>`)
    const input = await occlusionFixture([cachedPara(shape, 1600)])
    const { scene } = await renderHwpxPages(input)
    const para = scene.regions.find(r => r.type === "paragraph")!
    assert.equal(para.parentId, scene.regions.find(r => r.type === "shape")!.id)
    if (angle === 0) assert.deepEqual(para.regions[0], { page: 1, x: 195, y: 175, width: 30, height: 10 })
    if (angle === 90) assert.deepEqual(para.regions[0], { page: 1, x: 275, y: 179.5, width: 10, height: 30 })
    const assets = await extractRenderedRegions(input, { types: ["paragraph"], maxWidthPx: 1191 })
    assert.equal(assets.length, 1)
    const { data, info } = await sharp(assets[0].data).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let dark = 0
    for (let i = 0; i < data.length; i += info.channels) if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) dark++
    assert.ok(dark > 20, `angle ${angle}: text crop has ${dark} dark pixels`)
  }
})

test("direct paragraph and run deletion markers preserve their existing slot positions", () => {
  const parse = (xml: string) => createXmlParser().parseFromString(`<sec>${xml}</sec>`, "text/xml").documentElement as unknown as Element
  const runRoot = parse('<p><run><t>A</t><deleteBegin/><t>old</t><deleteEnd/><t>B</t></run></p>')
  const runPara = buildPara(runRoot.firstChild as Element)
  assert.equal(runPara.chars.map(c => c.ch).join(""), "AB")
  assert.equal(runPara.chars.length, 21)
  assert.equal(runPara.chars[20].ch, "B")
  const pRoot = parse('<p><deleteBegin/><run><t>old</t></run></p><p><run><t>old</t></run><deleteEnd/><run><t>new</t></run></p>')
  prepareDeletedRanges(pRoot)
  assert.equal(buildPara(pRoot.firstChild as Element).chars.map(c => c.ch).join(""), "")
  const last = buildPara(pRoot.lastChild as Element)
  assert.equal(last.chars.map(c => c.ch).join(""), "new")
  assert.equal(last.chars[3].ch, "n")
})

test("nested rotations bound original shape corners once, including cancelling rotations", async () => {
  const cases = [
    { outer: 0, inner: 0, box: { page: 1, x: 195, y: 175, width: 90, height: 75 } },
    { outer: 45, inner: -45, box: { page: 1, x: 207, y: 167.5, width: 66, height: 90 } },
    { outer: 45, inner: 45, box: { page: 1, x: 195, y: 179.5, width: 90, height: 66 } },
  ]
  for (const c of cases) {
    const inner = cover({ angle: c.inner })
    const outer = cover({ angle: c.outer, fill: '<hc:winBrush faceColor="none"/>' }).replace('</hp:rect>', `<hp:drawText><hp:subList>${cachedPara(inner)}</hp:subList></hp:drawText></hp:rect>`)
    const input = await occlusionFixture([cachedPara(outer, 1600)])
    const { scene } = await renderHwpxPages(input)
    const [parent, child] = scene.regions.filter(r => r.type === "shape")
    assert.equal(child.parentId, parent.id)
    assert.deepEqual(child.regions[0], c.box)
    const [crop] = await extractRenderedRegions(input, { types: ["shape"], filter: r => r.parentId === parent.id, maxWidthPx: 1191 })
    const { data, info } = await sharp(crop.data).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let dark = 0
    for (let i = 0; i < data.length; i += info.channels) if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) dark++
    assert.ok(dark / (info.width * info.height) > 0.9, `nested ${c.outer}/${c.inner}: crop must fit the painted rectangle`)
  }
})

test("proven marker-free XML and conservative deletion scanning produce identical output", async () => {
  const input = await occlusionFixture([cachedPara(photo(), 1600), cachedPara(cover(), 3200)], { master: cachedPara('<hp:t>master</hp:t>') })
  const zip = await JSZip.loadAsync(input)
  const xml = await zip.file("Contents/section0.xml")!.async("string")
  zip.file("Contents/section0.xml", xml.replace('</hs:sec>', '<!-- deleteBegin deleteEnd: force conservative scan --></hs:sec>'))
  const scan = new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }))
  assert.deepEqual(await renderHwpxPages(input), await renderHwpxPages(scan))
})

test("custom DOMs default to scanning deletion ranges across paragraphs", () => {
  const root = createXmlParser().parseFromString('<sec><p><run><ctrl><deleteBegin/></ctrl><t>hidden</t></run></p><p><run><t>hidden too</t><ctrl><deleteEnd/></ctrl><t>visible</t></run></p></sec>', "text/xml").documentElement as unknown as Element
  const rendered = renderSectionRoots([{ root, index: 0 }], {
    styles: { charPr: new Map(), paraAlign: new Map(), paraGeom: new Map(), borderFill: new Map() },
    images: new Map(), warnings: [], reflow: true, reflowMode: "keep",
  })
  const svg = assemblePageSvgs(rendered, "hwpx").pageSvgs.get(1)!
  assert.ok(svg.includes('visible'))
  assert.ok(!svg.includes('hidden'))
})

test("marker-free body metadata does not skip deletion ranges in separate master stories", async () => {
  const master = cachedPara('<hp:ctrl><hp:deleteBegin/></hp:ctrl>' + cover() + '<hp:t>hidden master</hp:t>') + cachedPara('<hp:ctrl><hp:deleteEnd/></hp:ctrl><hp:t>visible master</hp:t>', 1600)
  const input = await occlusionFixture([cachedPara(photo(), 1600)], { master })
  const { scene, pageSvgs } = await renderHwpxPages(input, { reflow: true })
  assert.equal(scene.stats.shapes, 0)
  assert.ok(pageSvgs.get(1)!.includes('visible master'))
  assert.ok(!pageSvgs.get(1)!.includes('hidden master'))
  assert.ok((await redPixels(input))[0] > 1000)
})
