#!/usr/bin/env node
/**
 * SPIKE: the composed flora by night — a forest of cast clumps (a line, a mass, a bush anchor, brush fillers) and bush
 * sections (a blocking hedge, brush walked through) on a cube's land: its own palette at noon, dusk and night, and a cube
 * whose palette is the night's altogether; the clump from the trail, a bush section, and the level from above.
 *
 *   cd control && node scripts/spikes/geotown/night.mjs [name]
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
const [name = 'night'] = process.argv.slice(2);
const BIO = { from: 'forest', flora: {
  trees: { kinds: [{ form: 'tuft', trunk: 0.6, girth: 0.03, branch: 0.7, bark: 2, barkForm: 'smooth' }, { form: 'spray' }], clump: { shin: 0, soe: 1, hikae: { bush: 0 }, filler: { bush: 1 } }, harmony: 'value' },
  bushes: { kinds: [{ form: 'spray', height: [1.1, 1.6], spread: 0.6, leaf: 1 }, { form: 'whorl', height: [0.7, 1.0], walk: 'through', leaf: 3 }], sections: { count: 6 } } } };
const ROWS = [
  ['limestone-crags, its own palette — noon', { geocube: { from: 'limestone-crags', biocube: BIO }, hour: 'noon' }],
  ['limestone-crags, its own palette — dusk', { geocube: { from: 'limestone-crags', biocube: BIO }, hour: 'dusk' }],
  ['limestone-crags, its own palette — night', { geocube: { from: 'limestone-crags', biocube: BIO }, hour: 'night' }],
  ['gothic-night (gritty): a night palette altogether', { geocube: { from: 'gothic-night', grit: 0.7, biocube: BIO } }],
];
const W = 440, H = 330, r3 = (v) => Math.round(v * 1000) / 1000;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4500));
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
      ['a bush section', cam([site.trailX(A.at[1] - 6), A.at[1] - 6, A.at[2] + 1.8], [A.at[0], A.at[1], A.at[2] + 0.5], 62)],
      ['from above', cam([site.W * 0.5, -14, 46], [site.W * 0.5, site.D * 0.5, 0], 70)],
    ];
    const cells = [];
    for (const [c, v] of views) cells.push({ cap: c, src: await shoot(P, v) });
    rows.push({ cap, cells }); console.log(cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
