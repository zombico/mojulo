#!/usr/bin/env node
/**
 * SPIKE: the leaf-chip crown (era/leaf-chips.js) in a gallery — one meadow tree (the stage's crown recipe), under three
 * suns (from the front, the side, behind), as its dark core alone and with chips sparse, medium and dense, with each
 * one's face count: for the chips' size, count, cup and band thresholds before the stage takes them.
 *
 *   cd control && node scripts/spikes/geotown/chips.mjs [name] [chips-json …]   (each column's leafChips options)
 *     → ../lite-template/integration/1021/spike-output/geotown/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
await import('../../../lib/graph/era/stage.js');
const { ISEKAI_STYLES } = await import('../../../lib/graph/era/isekai.js');
const { leafChips, chipCore } = await import('../../../lib/graph/era/leaf-chips.js');
const { tube } = await import('../../../lib/graph/era/nature.js');
const { hash3 } = await import('../../../lib/graph/era/dirt.js');
const { makeSunShadow } = await import('../../../lib/graph/era/sun.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'chips', ...cols] = process.argv.slice(2);
const st = ISEKAI_STYLES['isekai-meadow'], C = st.trees.crown, ramp = st.palette.foliage, mix = (a, b, t) => a + (b - a) * t;
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
// the tree: the stage's crown recipe (era/isekai.js treeFaces), at the origin
const h = 9, k = 77, Rc = C.radius * h, c = [0, 0, C.height * h], masses = [{ at: [c[0], c[1], c[2] + 0.38 * Rc], r: 0.6 * Rc }];
const n = C.masses[0] + Math.floor(hash3(k, 5, 957) * (C.masses[1] - C.masses[0] + 1)), yaw = 2 * Math.PI * hash3(k, 6, 959);
for (let i = 0; i < n; i++) {
  const a = yaw + (2 * Math.PI * (i + 0.3 * hash3(k, 10 + i, 961))) / n, e = mix(-0.25, 0.45, hash3(k, 30 + i, 967)), d = Rc * mix(0.55, 0.72, hash3(k, 50 + i, 971));
  masses.push({ at: [c[0] + Math.cos(a) * Math.cos(e) * d, c[1] + Math.sin(a) * Math.cos(e) * d, c[2] + Math.sin(e) * d * 0.8], r: Rc * mix(0.4, 0.55, hash3(k, 70 + i, 977)) });
}
const trunk0 = []; tube(trunk0, [[0, 0, 0], [0, 0, c[2] * 0.6], c], [C.trunk * h, C.trunk * h * 0.7, C.trunk * h * 0.5], 6, null, 'isekai:wood');
const trunk = trunk0.map((f) => ({ ...f, fill: hex(st.palette.bark[1]) }));
const ground = { corners: [[-30, -30, 0], [30, -30, 0], [30, 30, 0], [-30, 30, 0]].map((p) => [p[0], p[1], -0.01]), normal: [0, 0, 1], fill: hex(st.palette.grass[2]) };
const SUNS = [['sun in front', [0.35, -0.8, 0.6]], ['sun to the side', [1, -0.1, 0.5]], ['sun behind', [-0.2, 0.9, 0.45]]].map(([l, v]) => { const L = Math.hypot(...v); return [l, v.map((x) => x / L)]; });
const COLS = cols.length ? cols.map((s) => JSON.parse(s)) : [null, { count: 600, size: 0.1 }, { count: 1000, size: 0.08 }, { count: 1700, size: 0.065 }];
const W = 420, H = 420, rows = [];
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (faces) => {
  const html = emitThreeWorld({ faces, bg: '#9cc3e6', inline: true, cameras: [{ name: 'c', worldFraming: { cameraPosition: [2, -11, 5], lookAt: [0, 0, c[2] + 0.6], horizontalFov: 42, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H } });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
try {
  for (const [label, toSun] of SUNS) {
    const crown = { c, Rc, squash: C.squash }, core0 = chipCore(masses, { crown, ramp }), shadow = makeSunShadow([...core0, ...trunk], toSun, { cell: 0.3 }), core = chipCore(masses, { crown, ramp, toSun, shadow }), cells = [];
    for (const o of COLS) {
      const chips = o ? leafChips(masses, { crown, toSun, shadow, ramp, seed: 3, ...o }) : [];
      cells.push({ cap: o ? `chips ${JSON.stringify(o)} — ${chips.length} chips, ${core.length + chips.reduce((a, f) => a + f.corners.length - 2, 0)} crown triangles` : `the core alone (the far band) — ${core.length} triangles`, src: await shoot([ground, ...trunk, ...core, ...chips]) });
    }
    rows.push({ cap: label, cells }); console.log(label);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(${COLS.length},${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}figcaption{font-size:11px;color:#aaa}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c2) => `<figure><img src="${c2.src}"><figcaption>${c2.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: COLS.length * W + 60, height: 600 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
