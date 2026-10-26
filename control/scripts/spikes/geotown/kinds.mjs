#!/usr/bin/env node
/**
 * SPIKE: a gritty forest's trees as composed KINDS (era/leaf-forms.js via the biocube's `flora.trees.kinds`), their
 * colours picked from the theorist's offer (era/flora-colours.js, shown as swatches) — today's chipped forest against
 * the same level grown as each set of kinds: down the trail, a hero tree from the trail, a clump at mid distance and
 * the level from above, with each build's faces and chips.
 *
 *   cd control && node scripts/spikes/geotown/kinds.mjs [name] ['[kind, …]' …]   (each set a JSON list of kinds)
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
const [name = 'kinds', ...sets] = process.argv.slice(2);
const SETS = [null, ...(sets.length ? sets.map((s) => JSON.parse(s)) : [
  [{ form: 'spray', bark: 1 }, { form: 'plate', scale: 1.2, trunk: 0.55, leaf: 1, bark: 2 }, { form: 'weep', scale: 0.85, leaf: 2, bark: 1 }],
  [{ form: 'whorl', scale: 1.3, trunk: 0.7, girth: 0.03, spread: 0.45, leaf: 1, bark: 3 }, { form: 'tuft', density: 1.5, leaf: 3, bark: 2 }, { form: 'spray', leaf: 2 }],
])];
const { floraColours } = await import('../../../lib/graph/era/flora-colours.js');
const W = 480, H = 360, r3 = (v) => Math.round(v * 1000) / 1000;
const kindLabel = (k) => (typeof k === 'string' ? k : Object.entries(k).map(([a, b]) => (a === 'form' ? b : a + ' ' + b)).join(' '));
const label = (kinds) => (kinds ? kinds.map(kindLabel).join(' · ') : "today's chipped crowns");
const biocube = (kinds) => ({ from: 'forest', ...(kinds ? { flora: { trees: { kinds } } } : {}) });
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
  for (const kinds of SETS) {
    const t0 = Date.now(), { payload: P } = await resolveWorldScene({ title: 'species', manifest: { kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: biocube(kinds) } });
    const ms = Date.now() - t0;
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const n = (g) => P.faces.filter((f) => f.group === g).length, rep = P.repeats.reduce((a, r) => a + r.template.length, 0), inst = P.repeats.reduce((a, r) => a + r.transforms.length, 0);
    const cap = label(kinds) + ' — ' + `${P.faces.length} faces (chips ${n('isekai:chips')}, core ${n('isekai:core')}, wood ${n('isekai:wood')}), ${P.repeats.length} templates (${rep} faces) × ${inst} stock trees`;
    const cells = [];
    for (const [c, v] of VIEWS) cells.push({ cap: c, src: await shoot(P, v) });
    rows.push({ cap, cells }); console.log(cap);
  }
} finally { await browser.close(); }
const midOf = (r) => r[Math.floor(r.length / 2)], pal = st.palette, offer = floraColours({ foliage: midOf(pal.foliage), grass: midOf(pal.grass), rock: midOf(pal.rock), soil: midOf(pal.soil) });
const sw = (c, l) => `<span style="display:inline-block;width:64px;height:28px;margin-right:6px;background:rgb(${c.join(',')});font-size:10px;color:#fff;text-shadow:0 0 2px #000;padding:2px">${l}</span>`;
const swatches = `<h3>the theorist's offer for this world — leaf: ${sw(midOf(pal.foliage), '0 world')}${offer.leaves.map((c, i) => sw(c, `${i + 1} ${['deep', 'young', 'turn'][i]}`)).join('')} bark: ${sw(midOf(pal.bark), '0 world')}${offer.barks.map((c, i) => sw(c, `${i + 1} ${['warm', 'pale', 'dark'][i]}`)).join('')}</h3>`;
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${swatches}${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
