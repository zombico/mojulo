#!/usr/bin/env node
/**
 * SPIKE: the World's crease pass (scene/channels/creases.js) on gritty ground — a gritty cube's room, its town's street
 * (a door, the street from the door) and a gritty forest by its trail — each with the creases off, soft, the wii
 * register's and the pass's defaults, and each view's frame time with the pass off and on, the same page toggled.
 *
 *   cd control && node scripts/spikes/geotown/creases.mjs [name] [cube]
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
const { readCreases, CREASE_DEFAULTS } = await import('../../../lib/graph/scene/channels/creases.js');
const { tagCreaseRoles } = await import('../../../lib/graph/scene/crease-roles.js');
const { readGeocube } = await import('../../../lib/graph/era/geocube.js');
const { registerInks, REGISTERS } = await import('../../../lib/graph/era/colour-register.js');
const { ISEKAI_STYLES, TREE_BANDS } = await import('../../../lib/graph/era/isekai.js');
const { readBiocube, withFlora } = await import('../../../lib/graph/era/biocube.js');
const { outTrailSite } = await import('../../../lib/graph/era/out-trail.js');
const { treeItems } = await import('../../../lib/graph/era/nature.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'creases', cubeId = 'limestone-crags'] = process.argv.slice(2);
const W = 480, H = 360, r3 = (v) => Math.round(v * 1000) / 1000;
const cubeInk = registerInks(readGeocube(cubeId)).creases;
// the settings, left to right (null: the pass off, the page byte-identical to one without it)
const SETTINGS = [
  { cap: 'off', c: null },
  { cap: 'soft (line 0.2, wash 0.35, reach 1.5)', c: { line: 0.2, wash: 0.35, reach: 1.5 } },
  { cap: `wii (line ${REGISTERS.wii.creases.line}, wash ${REGISTERS.wii.creases.wash})`, c: { ...REGISTERS.wii.creases } },
  { cap: `defaults (line ${CREASE_DEFAULTS.line}, wash ${CREASE_DEFAULTS.wash})`, c: {} },
];
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const open = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  return page;
};
const snap = async (page) => { const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' })); return `data:image/png;base64,${png.toString('base64')}`; };
// a frame's time: the mean interval between animation frames over a second and a half (headless, software GL: compare, don't quote)
const frameMs = (page) => page.evaluate(() => new Promise((res) => { const t = []; const f = (now) => { t.push(now); if (now - t[0] < 1500) requestAnimationFrame(f); else res((t.at(-1) - t[1]) / (t.length - 2)); }; requestAnimationFrame(f); }));
const withCreases = (P, c, ink) => (c === null ? P : tagCreaseRoles({ ...P, creases: readCreases({ ink, ...c }) }));
const cam = (nm, from, to, fov) => ({ name: nm, worldFraming: { cameraPosition: from.map(r3), lookAt: to.map(r3), horizontalFov: fov } });
const rows = [];
const row = async (cap, P, view, ink) => {
  const cells = [];
  for (const S of SETTINGS) {
    const page = await open(withCreases(P, S.c, ink), view);
    let cell = S.cap;
    if (S.c && !Object.keys(S.c).length) {
      const on = await frameMs(page); await page.evaluate(() => window.__mojCreases.set(false)); const off = await frameMs(page); await page.evaluate(() => window.__mojCreases.set(true));
      cell += ` — frame ${off.toFixed(1)} ms off, ${on.toFixed(1)} ms on`;
    }
    cells.push({ cap: cell, src: await snap(page) }); await page.close();
  }
  rows.push({ cap, cells }); console.log(cap, '|', cells.at(-1).cap);
};
try {
  // a gritty cube's room, through its own camera
  const { payload: R } = await resolveWorldScene({ title: 'creases', manifest: { kind: 'geocube', cube: cubeId, show: 'room', walk: false } });
  R.walkers = (R.walkers || []).map((w) => ({ ...w, follow: false }));
  const rc = R.cameras?.[0] ?? cam('room', [0, -5, 1.7], [0, 0, 1.5], 70);
  await row(`${cubeId} · the room (${R.faces.length} faces)`, R, rc, cubeInk);
  // its town: a door at four metres, the street from the door
  const { payload: T } = await resolveWorldScene({ title: 'creases', manifest: { kind: 'geocube', cube: cubeId, show: 'town', walk: false, seed: 3 } });
  T.walkers = (T.walkers || []).map((w) => ({ ...w, follow: false }));
  const h = T.anchors.find((a) => a.kind === 'house'), N = h.N, Tn = [-N[1], N[0]], at = (n, t, z) => [h.at[0] + N[0] * n + Tn[0] * t, h.at[1] + N[1] * n + Tn[1] * t, h.floor + z];
  await row(`${cubeId} · the town: a door (${T.faces.length} faces)`, T, cam('door', at(4.2, 1.2, 1.6), at(0, 0, 1.3), 62), cubeInk);
  await row(`${cubeId} · the town: the street from the door`, T, cam('street', at(1.6, 0, 1.7), at(14, -6, 1.2), 80), cubeInk);
  // a gritty forest: a hero tree from the trail, and down the trail
  const stage = { kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: 'forest' };
  const { payload: F } = await resolveWorldScene({ title: 'creases', manifest: stage });
  F.walkers = (F.walkers || []).map((w) => ({ ...w, follow: false }));
  const st = withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube('forest')), site = outTrailSite(st, {}, 1), mid = site.D / 2;
  const hero = treeItems(st, site, 1).map((t) => ({ ...t, d: site.trailDist(t.x, t.y) - site.halfWAt(t.y), z: site.ground(t.x, t.y), side: Math.sign(site.trailX(t.y) - t.x) || 1 }))
    .filter((t) => t.d < TREE_BANDS.hero).sort((a, b) => Math.abs(a.y - mid) - Math.abs(b.y - mid))[0];
  await row(`forest (grit 0.7) · a hero tree from the trail (${F.faces.length} faces)`, F, cam('hero', [hero.x + hero.side * 6, hero.y - 2, hero.z + 1.7], [hero.x, hero.y, hero.z + 2.2], 62), CREASE_DEFAULTS.ink);
  const y0 = mid - 12, x0 = site.trailX(y0);
  await row('forest (grit 0.7) · down the trail', F, cam('trail', [x0, y0, site.ground(x0, y0) + 1.7], [site.trailX(mid + 8), mid + 8, site.ground(site.trailX(mid + 8), mid + 8) + 1.2], 75), CREASE_DEFAULTS.ink);
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
