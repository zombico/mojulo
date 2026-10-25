#!/usr/bin/env node
/**
 * SPIKE: snow (era/snow.js) on a cube's forest: none, snowcapped (a line on the crags), a winter cover, deep snow, the
 * cover by night, and a quiet cube under its cover; the trail toward the crags, a clump and its bushes, and from above.
 *
 *   cd control && node scripts/spikes/geotown/snow.mjs [name] [rows]
 *     → ../lite-template/integration/1021/spike-output/geotown/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const { ISEKAI_STYLES } = await import('../../../lib/graph/era/isekai.js');
const { readBiocube, withFlora } = await import('../../../lib/graph/era/biocube.js');
const { outTrailSite } = await import('../../../lib/graph/era/out-trail.js');
const { treeItems } = await import('../../../lib/graph/era/nature.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'snow', only = ''] = process.argv.slice(2);
const BIO = { from: 'forest', flora: {
  trees: { kinds: [{ form: 'tuft', trunk: 0.6, girth: 0.03, branch: 0.7, bark: 2, barkForm: 'smooth' }, { form: 'spray' }], clump: { shin: 0, soe: 1, hikae: { bush: 0 }, filler: { bush: 1 } }, harmony: 'value' },
  bushes: { kinds: [{ form: 'spray', height: [1.1, 1.6], spread: 0.6, leaf: 1 }, { form: 'whorl', height: [0.7, 1.0], walk: 'through', leaf: 3 }], sections: { count: 6 } } } };
// (deep winter: the season bare, the leaves fallen from what has a fall, the firs evergreen: the clump's tall line a fir)
const BARE = { ...BIO, flora: { ...BIO.flora, trees: { ...BIO.flora.trees, season: 'bare', kinds: [{ form: 'spire', trunk: 0.15, spread: 0.26, leaf: 1 }, BIO.flora.trees.kinds[0]] } } };
const cube = (extra = {}, from = 'limestone-crags', bio = BIO) => ({ geocube: { from, biocube: bio, ...extra } });
const ROWS0 = [
  ['no snow', cube()],
  ['snowcapped: a line 6 m up, on the crags and the far ridges', cube({ snow: { line: 6 } })],
  ['a winter cover', cube({ snow: 'cover' })],
  ['deep snow', cube({ snow: 'deep' })],
  ['deep winter: deep snow, the season bare: the leaves fallen, the firs (spire) green', cube({ snow: 'deep' }, 'limestone-crags', BARE)],
  ['a winter cover by night', { ...cube({ snow: 'cover' }), hour: 'night' }],
  ['a quiet cube (valley-morning) under a cover', cube({ snow: 'cover' }, 'valley-morning')],
  ['a fir wood under a cover (spire alone)', cube({ snow: 'cover' }, 'limestone-crags', { from: 'forest', flora: { trees: { kinds: [{ form: 'spire', trunk: 0.15, spread: 0.26, leaf: 1 }], season: 'bare' } } })],
];
const ROWS = only ? ROWS0.filter((_, i) => only.split(',').includes(String(i))) : ROWS0;
const W = 400, H = 300, r3 = (v) => Math.round(v * 1000) / 1000;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam, before = null) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4500));
  if (before) { await page.evaluate(before.fn, before.arg); await new Promise((r) => setTimeout(r, 2500)); }
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
const cam = (from, to, fov = 60) => ({ name: 'v', worldFraming: { cameraPosition: from.map(r3), lookAt: to.map(r3), horizontalFov: fov } });
const rows = [];
try {
  for (const [cap, m] of ROWS) {
    const { payload: P } = await resolveWorldScene({ title: 'night', manifest: { kind: 'stage', trail: {}, ...m } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    // (the site from the payload's own ground: the stage's trail on the cube's land)
    const S = P.anchors.filter((a) => a.kind === 'thicket').sort((a, b) => a.at[1] - b.at[1]), A = S[Math.floor(S.length / 2)];
    const st = withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube(BIO)), site = outTrailSite(st, {}, 1), ts = treeItems(st, site, 1), mid = site.D / 2;
    const C = ts.filter((t) => t.role === 'shin').sort((a, b) => Math.abs(a.y - mid) - Math.abs(b.y - mid))[0], tx = site.trailX(C.y - 9);
    const g = (x, y) => site.ground(x, y);
    const views = [
      ['a clump from the trail', cam([tx, C.y - 9, g(tx, C.y - 9) + 1.7], [C.x, C.y, g(C.x, C.y) + C.h * 0.45], 64)],
      ['the trail to the crags', cam([site.trailX(4), 4, g(site.trailX(4), 4) + 1.7], [site.trailX(30) - 8, 30, g(site.trailX(30), 30) + 6], 70)],
      ['from above', cam([site.W * 0.5, -14, 46], [site.W * 0.5, site.D * 0.5, 0], 70)],
    ];
    // (a close look at the clump's second tree, its \`soe\`: the fir in deep winter)
    const So = ts.filter((t) => t.role === 'soe').sort((a, b) => Math.abs(a.y - mid) - Math.abs(b.y - mid))[0];
    if (process.env.FIR && So) views.unshift(['the soe tree, close', cam([site.trailX(So.y - 6), So.y - 6, g(site.trailX(So.y - 6), So.y - 6) + 1.7], [So.x, So.y, g(So.x, So.y) + So.h * 0.5], 60)]);
    // (footprints: a walk pressed up the trail through the page's own bed, scene/channels/snow-prints.js)
    const feet = [];
    for (let k = 0; k < 18; k++) { const y = 7 + k * 0.38, x = site.trailX(y) + (k % 2 ? 0.11 : -0.11); feet.push({ x, y, heading: Math.PI / 2, length: 0.28, width: 0.11, rim: 0.03, push: [0, 1] }); }
    const walk = P.snowPrints ? { fn: ({ feet, sink }) => { window.__mojSnow.place(feet[8].x, feet[8].y); for (const f of feet) window.__mojSnow.press({ ...f, sink }); }, arg: { feet, sink: P.snowPrints.sink } } : null;
    const fy = 7 + 17 * 0.38, fx = site.trailX(5);
    if (walk) views.push(['footprints up the trail', cam([fx - 0.6, 4.6, g(fx, 4.6) + 1.5], [site.trailX(10), 10, g(site.trailX(10), 10)], 55)]);
    const cells = [];
    for (const [c, v] of views) cells.push({ cap: c, src: await shoot(P, v, c.startsWith('footprints') ? walk : null) });
    rows.push({ cap, cells }); console.log(cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 70, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
