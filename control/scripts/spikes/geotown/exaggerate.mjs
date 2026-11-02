#!/usr/bin/env node
/**
 * SPIKE: the cube's exaggerate on a geotown evocation — the same town plumb and under each hand, from over its block, along
 * its street at a person's eye, and up close at a house's front: one row a hand.
 *
 *   cd control && node scripts/spikes/geotown/exaggerate.mjs <out-dir> [hand …]   (hands: crooked storybook street, or
 *     JSON terms '{"from":"crooked","lean":8}';
 *     'plumb' is always the first row) → <out-dir>/exaggerate.png and .html
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const [outArg, ...hands0] = process.argv.slice(2);
if (!outArg) { console.error('usage: exaggerate.mjs <out-dir> [hand …]'); process.exit(1); }
const outDir = path.resolve(outArg), hands = ['plumb', ...(hands0.length ? hands0 : ['crooked'])];
mkdirSync(outDir, { recursive: true });
const CUBE = process.env.CUBE || 'valley-morning', W = 640, H = 420, r3 = (v) => Math.round(v * 1000) / 1000;
const GEOTOWN = { evoke: 'metro', grid: [1, 1], hills: { height: 4 }, margin: 12 };
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
    const cube = hand === 'plumb' ? CUBE : { from: CUBE, exaggerate: hand.startsWith('{') ? JSON.parse(hand) : hand };
    const { payload: P } = await resolveWorldScene({ title: hand, manifest: { kind: 'geocube', cube, show: 'geotown', seed: 4, hour: 'afternoon', walk: false, geotown: GEOTOWN } });
    // (the page's own camera, not the walker's: nobody follows)
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false })); delete P.walk; delete P.route;
    // (the cameras chosen once, on the plumb town, so every row is seen from the same places)
    if (!cams) {
      const hs = P.anchors.filter((a) => a.kind === 'house'), h = hs[Math.floor(hs.length / 2)], N = h.N, T = [-N[1], N[0]];
      const at = (n, t, z) => [h.at[0] + N[0] * n + T[0] * t, h.at[1] + N[1] * n + T[1] * t, h.floor + z].map(r3);
      const cam = (name, from, to, fov) => ({ name, worldFraming: { cameraPosition: from, lookAt: to, horizontalFov: fov } });
      cams = [
        cam('over the block', at(46, -40, 30), at(-6, 6, 2), 55),
        cam('down the street', at(9, -26, 1.7), at(5, 12, 4), 70),
        cam('a house\'s front', at(13, 5, 2.4), at(0, 0, 4), 62),
      ];
    }
    const laws = (P.geotown.laws || []).filter((l) => ['foot', 'fold', 'plumb'].includes(l.law)).map((l) => `${l.law} ${l.ok ? '✓' : '✗'} ${l.value}`).join(' · ');
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: `${hand}${laws ? ` — ${laws}` : ''}`, cells });
    console.log(rows[rows.length - 1].cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:14px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px;margin-bottom:16px}img{display:block;width:${W}px}figure{margin:0}figcaption{opacity:.7;margin-top:3px}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, 'exaggerate.html'), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 50, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'exaggerate.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, 'exaggerate.png'));
