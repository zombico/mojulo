#!/usr/bin/env node
/**
 * SPIKE: an arranged clump cast and coloured by role (era/biocube.js `clump`, `harmony`; era/flora-colours.js) — the
 * forest's kinds uncast, then one cast (a line, a mass, a mound) in each harmony, and a second cast: the clump nearest
 * the middle of the trail from the trail, close, and the level from above.
 *
 *   cd control && node scripts/spikes/geotown/clump-harmony.mjs [name]   (name `clump-bushes`: the anchor and fillers as bushes)
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
const [name = 'clump-harmony'] = process.argv.slice(2);
const LINE_MASS_MOUND = [{ form: 'tuft', trunk: 0.6, girth: 0.03, branch: 0.7, bark: 2, barkForm: 'smooth' }, { form: 'spray' }, { form: 'spray', scale: 0.45, trunk: 0.15, spread: 0.55, stems: 3 }];
const CAST = { shin: 0, soe: 1, hikae: 2, filler: 1 };
const SECOND = [{ form: 'weep', scale: 1.1, split: 1, branch: 0.6, bark: 4, barkForm: 'banded' }, { form: 'plate', stems: 2, splay: 12 }, { form: 'whorl', scale: 0.5, trunk: 0.25, spread: 0.5 }];
const ROWS = [
  ['the same kinds, uncast (each clump one kind)', { kinds: LINE_MASS_MOUND }],
  ['line · mass · mound, cast — analogous', { kinds: LINE_MASS_MOUND, clump: CAST, harmony: 'analogous' }],
  ['line · mass · mound, cast — value', { kinds: LINE_MASS_MOUND, clump: CAST, harmony: 'value' }],
  ['line · mass · mound, cast — accent', { kinds: LINE_MASS_MOUND, clump: CAST, harmony: 'accent' }],
  ['line · mass · mound, cast — season', { kinds: LINE_MASS_MOUND, clump: CAST, harmony: 'season' }],
  ['a weeping birch line · a two-stemmed plate · a small umbrella, cast — season', { kinds: SECOND, clump: CAST, harmony: 'season' }],
];
// (with `clump-bushes` as the name: the clumps' anchor and fillers cast as bushes, flora.bushes, thickets.js)
const BUSHES = { kinds: [{ form: 'spray', height: [0.9, 1.3], spread: 0.75, stems: 6 }, { form: 'tuft', height: [0.5, 0.9], spread: 0.8, walk: 'through' }, { form: 'whorl', height: [0.7, 1.1], spread: 0.7, walk: 'through' }], sections: { count: 0 } };
const BUSH_ROWS = [
  ['line and mass trees, a blocking bush as the anchor, brush walked through as the fillers — value', { kinds: LINE_MASS_MOUND, clump: { shin: 0, soe: 1, hikae: { bush: 0 }, filler: { bush: 1 } }, harmony: 'value' }],
  ['the same — accent (the anchor bush the turned note)', { kinds: LINE_MASS_MOUND, clump: { shin: 0, soe: 1, hikae: { bush: 0 }, filler: { bush: 1 } }, harmony: 'accent' }],
  ['a weeping birch line, a two-stemmed plate, a whorl shrub anchor, brush fillers — season', { kinds: SECOND, clump: { shin: 0, soe: 1, hikae: { bush: 2 }, filler: { bush: 1 } }, harmony: 'season' }],
];
const W = 440, H = 330, r3 = (v) => Math.round(v * 1000) / 1000;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
const cam = (from, to, fov = 60) => ({ name: 'v', worldFraming: { cameraPosition: from.map(r3), lookAt: to.map(r3), horizontalFov: fov } });
// the clump: a full triad near the middle of the trail
const st = withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube('forest')), site = outTrailSite(st, {}, 1), ts = treeItems(st, site, 1), mid = site.D / 2;
const clumps = [...new Set(ts.map((t) => t.cluster))].map((ci) => ts.filter((t) => t.cluster === ci)).filter((C) => ['shin', 'soe', 'hikae'].every((r) => C.some((t) => t.role === r)));
const C = clumps.sort((a, b) => Math.abs(a[0].y - mid) - Math.abs(b[0].y - mid))[0];
const cx = C.reduce((a, t) => a + t.x, 0) / C.length, cy = C.reduce((a, t) => a + t.y, 0) / C.length, cz = site.ground(cx, cy), top = Math.max(...C.map((t) => t.h));
const tx = site.trailX(cy - 6), side = Math.sign(cx - tx) || 1;
const VIEWS = [
  ['the clump from the trail', cam([tx, cy - 9, site.ground(tx, cy - 9) + 1.7], [cx, cy, cz + top * 0.45], 64)],
  ['close', cam([cx - side * 9, cy - 4, cz + 2.2], [cx, cy, cz + top * 0.5], 70)],
  ['from above', cam([site.W * 0.5, -14, 46], [site.W * 0.5, site.D * 0.5, 0], 70)],
];
const rows = [];
try {
  for (const [cap, trees] of name === 'clump-bushes' ? BUSH_ROWS : ROWS) {
    const { payload: P } = await resolveWorldScene({ title: 'clump harmony', manifest: { kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: { from: 'forest', flora: { trees, ...(name === 'clump-bushes' ? { bushes: BUSHES } : {}) } } } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const cells = [];
    for (const [c, v] of VIEWS) cells.push({ cap: c, src: await shoot(P, v) });
    rows.push({ cap: `${cap} — ${P.repeats.length} templates`, cells }); console.log(rows.at(-1).cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
