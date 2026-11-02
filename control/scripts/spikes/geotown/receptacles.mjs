#!/usr/bin/env node
/**
 * STUDY: the street's and the yard's rubbish receptacles (lib/graph/geotown/receptacles.js), each kind true to its size
 * in the REALISTIC register, then the same kinds in the ASKEW register (a toon cube's: each part by its own dice, under
 * banded light and an ink outline), one cell a kind, each with its read.
 *
 *   INK=1 adds the World's ink outline to the askew row
 *   cd control && node scripts/spikes/geotown/receptacles.mjs <out-dir> [seed]   → <out-dir>/receptacles.png and .html
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { RECEPTACLES, RECEPTACLE_IDS, RECEPTACLE_GROUPS, receptacleOf } = await import('../../../lib/graph/geotown/receptacles.js');
const { proportions } = await import('../../../lib/graph/geotown/doodads.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { makeLight, shadeHex } = await import('../../../lib/graph/polygonizer/vexar.js');
const { mulberry32 } = await import('../../../lib/graph/city/plan/dice.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const [outArg, seedArg, ...groups0] = process.argv.slice(2);
if (!outArg) { console.error('usage: receptacles.mjs <out-dir> [seed] [group …]'); process.exit(1); }
const outDir = path.resolve(outArg), SEED = Number(seedArg || 3), W = 420, H = 420, GROUPS = groups0.length ? groups0 : RECEPTACLE_GROUPS;
mkdirSync(outDir, { recursive: true });
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } const l = Math.hypot(...n) || 1; return n.map((v) => v / l); };

/** A row of every kind, each lit, on a pavement; its cameras one a kind. */
function row(askew, ids) {
  const L = makeLight({ direction: [0.45, 0.55, -0.7], ambient: 0.42, diffuse: 0.62, ...(askew ? { bands: 3 } : {}) }), faces = [], cameras = [];
  const put = (cs, want, hex, group) => { let c = cs, n = newell(c); if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { c = c.slice().reverse(); n = n.map((v) => -v); } const fill = shadeHex(hex, n, L); faces.push({ corners: c.map((p) => p.map(r5)), normal: n.map(r5), outNormal: n.map(r5), group, fill, cornerFills: c.map(() => fill) }); };
  // (each kind its own room along the row: its size and as much again round it, so no neighbour leaks into its frame)
  const xs = []; let at = 0;
  for (const id of ids) { const K = RECEPTACLES[id], room = Math.max(K.w, K.d, K.h) * 2.6 + 3; xs.push(at + room / 2); at += room; }
  put([[-4, -8, 0], [at + 4, -8, 0], [at + 4, 8, 0], [-4, 8, 0]], [0, 0, 1], askew ? '#f0d6e4' : '#c9c4b8', 'ground');
  ids.forEach((id, i) => {
    const R = mulberry32(SEED * 101 + RECEPTACLE_IDS.indexOf(id) * 7 + 1), D = proportions(R, askew), x = xs[i];
    for (const f of receptacleOf(id, D, R)) put(f.corners.map(([a, b, c]) => [a + x, b, c]), f.out, f.hex ?? '#888888', `rc:${id}`);
    const K = RECEPTACLES[id], far = Math.max(K.w, K.d * 0.8, K.h) * 1.9 + 0.8;
    cameras.push({ name: id, worldFraming: { cameraPosition: [x + far * 0.55, -far, K.h * 0.95 + 0.35].map(r5), lookAt: [x, 0, K.h * 0.45].map(r5), horizontalFov: 42 } });
  });
  // (the ink outline only with INK=1: the World's hull ink smears open and thin parts, see the study's notes)
  return { faces, cameras, ...(askew && process.env.INK === '1' ? { toon: { ink: true } } : {}) };
}

const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const rows = [];
try {
  for (const g of GROUPS) for (const askew of [false, true]) {
    const P = row(askew, RECEPTACLE_IDS.filter((id) => RECEPTACLES[id].group === g)), cells = [];
    for (const cam of P.cameras) {
      const html = emitThreeWorld({ faces: P.faces, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true, bg: '#dfe8ef', title: cam.name, ...(P.toon ? { toon: P.toon } : {}) });
      const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
      await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 2500));
      await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
      const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
      await page.close();
      cells.push({ cap: cam.name, read: RECEPTACLES[cam.name].read, src: `data:image/png;base64,${png.toString('base64')}` });
    }
    rows.push({ cap: `${g} · ` + (askew ? `the askew register (a toon cube's: each part its own dice, banded light${process.env.INK === '1' ? ', ink' : ''})` : 'the realistic register (true to size)'), cells });
    console.log(rows[rows.length - 1].cap);
  }
} finally { await browser.close(); }
const cols = 5;
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(${cols},${W}px);gap:8px;margin-bottom:18px}img{display:block;width:${W}px}figure{margin:0}figcaption{margin-top:3px}figcaption b{display:block;color:#fff}figcaption span{opacity:.65}h3{margin:8px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption><b>${c.cap}</b><span>${c.read}</span></figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, 'receptacles.html'), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: cols * W + 70, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'receptacles.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, 'receptacles.png'));
