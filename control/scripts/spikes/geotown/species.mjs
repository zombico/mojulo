#!/usr/bin/env node
/**
 * SPIKE: a gritty forest's trees as species (era/leaf-forms.js via the biocube's `flora.trees.species`) — today's
 * chipped forest against the same level grown as each set of species: down the trail, a hero tree from the trail, a
 * clump at mid distance and the level from above, with each build's faces, chips and time.
 *
 *   cd control && node scripts/spikes/geotown/species.mjs [name] [species,species …] …
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
const { ISEKAI_STYLES, TREE_BANDS } = await import('../../../lib/graph/era/isekai.js');
const { readBiocube, withFlora } = await import('../../../lib/graph/era/biocube.js');
const { outTrailSite } = await import('../../../lib/graph/era/out-trail.js');
const { treeItems } = await import('../../../lib/graph/era/nature.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'species', ...sets] = process.argv.slice(2);
const SETS = [null, ...(sets.length ? sets.map((s) => s.split(',')) : [['oak', 'beech', 'willow'], ['pine', 'schefflera', 'oak']])];
const W = 480, H = 360, r3 = (v) => Math.round(v * 1000) / 1000;
const biocube = (species) => ({ from: 'forest', ...(species ? { flora: { trees: { species } } } : {}) });
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
const st = withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube('forest')), site = outTrailSite(st, {}, 1), mid = site.D / 2;
const ts = treeItems(st, site, 1).map((t) => ({ ...t, d: site.trailDist(t.x, t.y) - site.halfWAt(t.y), z: site.ground(t.x, t.y), side: Math.sign(site.trailX(t.y) - t.x) || 1 }));
const hero = ts.filter((t) => t.d < TREE_BANDS.hero).sort((a, b) => Math.abs(a.y - mid) - Math.abs(b.y - mid))[0];
const clump = ts.filter((t) => t.d > TREE_BANDS.hero && t.d < TREE_BANDS.far).sort((a, b) => Math.abs(a.y - mid - 6) - Math.abs(b.y - mid - 6))[0];
const y0 = mid - 14, x0 = site.trailX(y0), y1 = mid + 10;
const VIEWS = [
  ['down the trail', cam([x0, y0, site.ground(x0, y0) + 1.7], [site.trailX(y1), y1, site.ground(site.trailX(y1), y1) + 2.5], 75)],
  ['a hero tree from the trail', cam([hero.x + hero.side * 7, hero.y - 2, hero.z + 1.7], [hero.x, hero.y, hero.z + hero.h * 0.5], 64)],
  ['a stock clump, mid distance', cam([site.trailX(clump.y - 4), clump.y - 4, site.ground(site.trailX(clump.y - 4), clump.y - 4) + 1.7], [clump.x, clump.y, clump.z + clump.h * 0.5], 55)],
  ['from above', cam([site.W * 0.5, -14, 46], [site.W * 0.5, site.D * 0.5, 0], 70)],
];
const rows = [];
try {
  for (const species of SETS) {
    const t0 = Date.now(), { payload: P } = await resolveWorldScene({ title: 'species', manifest: { kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: biocube(species) } });
    const ms = Date.now() - t0;
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const n = (g) => P.faces.filter((f) => f.group === g).length, rep = P.repeats.reduce((a, r) => a + r.template.length, 0), inst = P.repeats.reduce((a, r) => a + r.transforms.length, 0);
    const cap = `${species ? species.join(' · ') : "today's chipped crowns"} — ${P.faces.length} faces (chips ${n('isekai:chips')}, core ${n('isekai:core')}, wood ${n('isekai:wood')}), ${P.repeats.length} templates (${rep} faces) × ${inst} stock trees, resolved in ${(ms / 1000).toFixed(1)} s`;
    const cells = [];
    for (const [c, v] of VIEWS) cells.push({ cap: c, src: await shoot(P, v) });
    rows.push({ cap, cells }); console.log(cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
