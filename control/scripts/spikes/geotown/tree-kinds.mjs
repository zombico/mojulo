#!/usr/bin/env node
/**
 * SPIKE: tree kinds one at a time on the forest level (era/leaf-forms.js through the stage): the hero tree whole from the
 * trail, its trunk's bark up close, and the level down the trail, each kind its own row: for a kind's stems, branching,
 * bark colour (the theorist's offer, era/flora-colours.js) and bark marks (matte-paint/dressed.js BARK_FORM_IDS).
 *
 *   cd control && node scripts/spikes/geotown/tree-kinds.mjs [name] ['kind-json' …]
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
const [name = 'tree-kinds', ...ks] = process.argv.slice(2);
const KINDS = ks.length ? ks.map((s) => JSON.parse(s)) : [
  { form: 'spray', scale: 0.95, spread: 0.26, branch: 0.55, split: 1, bark: 4, barkForm: 'banded' },
  { form: 'spray', stems: 2, splay: 22, trunk: 0.38, bark: 1 },
  { form: 'tuft', stems: 3, splay: 16, branch: 0.7, leaf: 1, bark: 3, barkForm: 'smooth' },
  { form: 'weep', split: 2, branch: 0.5, leaf: 2, bark: 2, barkForm: 'peeling' },
  { form: 'tuft', trunk: 0.62, spread: 0.3, girth: 0.06, bark: 1, barkForm: 'plated' },
  { form: 'plate', stems: 2, splay: 12, branch: 0.8, leaf: 1, bark: 2, barkForm: 'smooth' },
];
const W = 440, H = 360, r3 = (v) => Math.round(v * 1000) / 1000;
const label = (k) => Object.entries(k).map(([a, b]) => (a === 'form' ? b : a + ' ' + b)).join(' · ');
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
const y0 = mid - 14, x0 = site.trailX(y0), y1 = mid + 10;
const rows = [];
try {
  for (const kind of KINDS) {
    const { payload: P } = await resolveWorldScene({ title: 'tree kinds', manifest: { kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: { from: 'forest', flora: { trees: { kinds: [kind] } } } } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const hh = hero.h * (kind.scale ?? 1);
    const cells = [
      { cap: 'the hero tree from the trail', src: await shoot(P, cam([hero.x + hero.side * 9, hero.y - 3, hero.z + 1.7], [hero.x, hero.y, hero.z + hh * 0.5], 66)) },
      { cap: 'its bark, close', src: await shoot(P, cam([hero.x + hero.side * 2.2, hero.y - 0.6, hero.z + 1.5], [hero.x, hero.y, hero.z + 1.4], 50)) },
      { cap: 'down the trail', src: await shoot(P, cam([x0, y0, site.ground(x0, y0) + 1.7], [site.trailX(y1), y1, site.ground(site.trailX(y1), y1) + 2.5], 75)) },
    ];
    rows.push({ cap: label(kind), cells }); console.log(label(kind));
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
