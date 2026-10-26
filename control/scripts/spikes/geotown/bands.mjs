#!/usr/bin/env node
/**
 * SPIKE: a forest's trees by band and by clump (era/isekai.js treeBands, era/nature.js arrangedClump) — the bands
 * coloured from above (stock blue, far orange, the hero as drawn), a hero, a stock and a far tree each close from the
 * trail's side, the same with every tree whole, and a clump scattered against arranged.
 *
 *   cd control && node scripts/spikes/geotown/bands.mjs [name]
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
const [name = 'bands'] = process.argv.slice(2);
const W = 480, H = 360, r3 = (v) => Math.round(v * 1000) / 1000;
const stage = (trees) => ({ kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: { from: 'forest', flora: { trees } } });
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
const mean = (cs) => [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k], 0) / cs.length);
const scene = async (trees) => { const { payload: P } = await resolveWorldScene({ title: 'bands', manifest: stage(trees) }); P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false })); return P; };
// the trees as the stage places them, each its band
const items = (compose) => {
  const st = withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube(stage({ compose }).biocube)), site = outTrailSite(st, {}, 1), ts = treeItems(st, site, 1);
  for (const t of ts) { const d = site.trailDist(t.x, t.y) - site.halfWAt(t.y); t.band = d < TREE_BANDS.hero ? 'hero' : d > TREE_BANDS.far ? 'far' : 'stock'; t.z = site.ground(t.x, t.y); t.side = Math.sign(site.trailX(t.y) - t.x) || 1; }
  return { site, ts };
};
// a tree close from its trail side, 7 m off, at eye height
const closeOn = (t) => cam([t.x + t.side * 7, t.y - 2, t.z + 1.7], [t.x, t.y, t.z + t.h * 0.55], 62);
const rows = [];
try {
  const { site, ts } = items('ikebana'), mid = site.D / 2, pick = (b) => ts.filter((t) => t.band === b).sort((a, c) => Math.abs(a.y - mid) - Math.abs(c.y - mid))[0];
  const hero = pick('hero'), stock = pick('stock'), far = pick('far'), above = cam([site.W * 0.5, -14, 46], [site.W * 0.5, site.D * 0.5, 0], 70);
  // banded, its bands coloured from above
  const B = await scene({});
  const map = { ...B, repeats: B.repeats.map((r) => ({ ...r, transforms: r.transforms.map((t) => ({ ...t, tint: [0.25, 0.5, 4] })) })),
    faces: B.faces.map((f) => { if (f.group !== 'isekai:crown' && f.group !== 'isekai:wood') return f; const c = mean(f.corners); return ts.some((t) => t.band === 'far' && Math.hypot(c[0] - t.x, c[1] - t.y) < t.h * 0.4) ? { ...f, texture: undefined, cornerFills: undefined, fill: '#e08a3a' } : f; }) };
  const g = (P) => { const m = {}; for (const f of P.faces) m[f.group] = (m[f.group] ?? 0) + 1; return m; };
  rows.push({ cap: `banded — ${B.faces.length} faces, crowns ${g(B)['isekai:crown']}, ${B.repeats.reduce((a, r) => a + r.transforms.length, 0)} stock trees from ${B.repeats.length} templates (${B.repeats.reduce((a, r) => a + r.template.length, 0)} faces)`, cells: [
    { cap: 'the bands from above: stock blue, far orange, hero as drawn', src: await shoot(map, above) }, { cap: `a hero tree, ${r3(site.trailDist(hero.x, hero.y) - site.halfWAt(hero.y))} m off the trail`, src: await shoot(B, closeOn(hero)) },
    { cap: `a stock tree (a template), ${r3(site.trailDist(stock.x, stock.y) - site.halfWAt(stock.y))} m off`, src: await shoot(B, closeOn(stock)) }, { cap: `a far tree (its shell), ${r3(site.trailDist(far.x, far.y) - site.halfWAt(far.y))} m off`, src: await shoot(B, closeOn(far)) }] });
  console.log(rows.at(-1).cap);
  const Wh = await scene({ bands: false });
  rows.push({ cap: `the same forest, every tree whole — ${Wh.faces.length} faces, crowns ${g(Wh)['isekai:crown']}`, cells: [
    { cap: 'from above', src: await shoot(Wh, above) }, { cap: 'the hero tree', src: await shoot(Wh, closeOn(hero)) }, { cap: 'the stock tree, whole', src: await shoot(Wh, closeOn(stock)) }, { cap: 'the far tree, whole', src: await shoot(Wh, closeOn(far)) }] });
  console.log(rows.at(-1).cap);
  // clumps scattered against arranged (bands off in both, every tree whole), from the trail onto the same stretch
  const clumpView = (S) => { const { site: s2, ts: t2 } = S, cs = [...new Set(t2.map((t) => t.cluster))].map((ci) => { const q = t2.filter((t) => t.cluster === ci); return { c: mean(q.map((t) => [t.x, t.y, t.z])), n: q.length }; }).filter((c) => c.n >= 3).sort((a, b) => Math.abs(a.c[1] - 34) - Math.abs(b.c[1] - 34))[0].c;
    const tx = s2.trailX(cs[1] - 8); return cam([tx, cs[1] - 8, s2.ground(tx, cs[1] - 8) + 1.7], [cs[0], cs[1], cs[2] + 4], 70); };
  const Sc = await scene({ compose: false, bands: false }), Ar = await scene({ bands: false }), ic = items(false), ia = items('ikebana');
  rows.push({ cap: 'clumps scattered (compose false) | clumps arranged (compose ikebana) — every tree whole in both', cells: [
    { cap: 'scattered, from the trail', src: await shoot(Sc, clumpView(ic)) }, { cap: 'scattered, from above', src: await shoot(Sc, above) },
    { cap: 'arranged, from the trail', src: await shoot(Ar, clumpView(ia)) }, { cap: 'arranged, from above', src: await shoot(Ar, above) }] });
  console.log(rows.at(-1).cap);
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 600 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
