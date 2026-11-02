#!/usr/bin/env node
/**
 * SPIKE: ONE SHOP under the cube's exaggerate.front and .streets (geotown/front-loud.js, street-loud.js) — a main
 * street's shop square on, at three quarters, down its row, and its street from over the walk: one row plumb, one a hand (a name, or JSON terms), the same shop from the same places.
 *
 *   cd control && node scripts/spikes/geotown/loud-front.mjs <out-dir> [hand …]   (default: a front of street's only)
 *     → <out-dir>/loud-front.png and .html
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const { EXAGGERATE_PRESETS } = await import('../../../lib/graph/era/exaggerate.js');

const [outArg, ...hands0] = process.argv.slice(2);
if (!outArg) { console.error('usage: loud-front.mjs <out-dir> [hand …]'); process.exit(1); }
const outDir = path.resolve(outArg), FRONT_ONLY = JSON.stringify({ front: EXAGGERATE_PRESETS.street.front });
const hands = ['plumb', ...(hands0.length ? hands0 : [FRONT_ONLY])];
mkdirSync(outDir, { recursive: true });
const CUBE = process.env.CUBE || 'valley-morning', SHOP = Number(process.env.SHOP || 1), W = 640, H = 460, r3 = (v) => Math.round(v * 1000) / 1000;
const GEOTOWN = { segment: 'main-street', hills: { height: 2 } };
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 5000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
const rows = [];
let cams = null;
try {
  for (const hand of hands) {
    // (a hand ending '@<register>' is drawn in that register too: '@cel' its toon)
    const [h0, reg] = hand.split('@'), cube = h0 === 'plumb' ? (reg ? { from: CUBE, register: reg } : CUBE) : { from: CUBE, exaggerate: h0.startsWith('{') ? JSON.parse(h0) : h0, ...(reg ? { register: reg } : {}) };
    const { payload: P } = await resolveWorldScene({ title: 'shop', manifest: { kind: 'geocube', cube, show: 'geotown', seed: 3, hour: 'afternoon', walk: false, geotown: GEOTOWN } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false })); delete P.walk; delete P.route;
    if (!cams) {
      const shops = P.anchors.filter((a) => a.kind === 'house' && a.row === 'shops');
      if (!shops.length) throw new Error(`no shop on this segment (rows: ${[...new Set(P.anchors.map((a) => a.row))].join(', ')})`);
      const h = shops[Math.min(SHOP, shops.length - 1)], N = h.N, T = [-N[1], N[0]];
      const at = (n, t, z) => [h.at[0] + N[0] * n + T[0] * t, h.at[1] + N[1] * n + T[1] * t, h.floor + z].map(r3);
      const cam = (name, from, to, fov) => ({ name, worldFraming: { cameraPosition: from, lookAt: to, horizontalFov: fov } });
      // (the doodads up close: the hydrant and the bin nearest the shop, from a walker's eye)
      const mid = (f) => f.corners.reduce((a, c) => a.map((v, k) => v + c[k] / f.corners.length), [0, 0, 0]);
      const nearest = (g) => P.faces.filter((f) => f.group === g).map(mid).sort((a, b) => Math.hypot(a[0] - h.at[0], a[1] - h.at[1]) - Math.hypot(b[0] - h.at[0], b[1] - h.at[1]))[0];
      const close = (name, g) => { const q = nearest(g); return q ? cam(name, [q[0] + N[0] * 2.4 + T[0] * 1.6, q[1] + N[1] * 2.4 + T[1] * 1.6, h.floor + 1.5].map(r3), [q[0], q[1], h.floor + 0.6].map(r3), 60) : null; };
      cams = [close('a hydrant', 'geotown:hydrant'), close('a bin', 'geotown:streetbin'), close('a post box', 'geotown:postbox')].filter(Boolean);
      cams.push(cam('three quarters', at(6.5, -6, 1.8), at(0, 1, 3), 64), cam('the street', at(3, 6, 5.5), at(14, -16, 0), 74));
    }
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: hand === FRONT_ONLY ? 'street\'s front only (no lean, no furniture)' : hand, cells });
    console.log(rows[rows.length - 1].cap, P.faces.length, 'faces');
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:14px system-ui}.r{display:grid;grid-template-columns:repeat(5,${W}px);gap:8px;margin-bottom:16px}img{display:block;width:${W}px}figure{margin:0}figcaption{opacity:.7;margin-top:3px}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, 'loud-front.html'), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 5 * W + 70, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'loud-front.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, 'loud-front.png'));
