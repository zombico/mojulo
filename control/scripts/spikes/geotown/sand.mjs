#!/usr/bin/env node
/**
 * SPIKE: a stage's sand (era/substrate.js, the formation's turn drawn) on a cube — the densest sand patch, wide, at a
 * person's eye, close and down onto it — for the sand's ground, what lies on it and the dune grass, per set.
 *
 *   cd control && node scripts/spikes/geotown/sand.mjs [name] [cube-json|trail-json|caption …]
 *     a set `beach:<cube>|caption`: the cube's own land (`show: 'land'`, its island), framed on its strand
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

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'sand', ...sets] = process.argv.slice(2);
const SANDSTONE = JSON.stringify({ from: 'limestone-crags', outside: { land: { skin: 'sandstone' } } });
const SETS = (sets.length ? sets : [`${SANDSTONE}|{}|sandstone`]).map((s) => s.split('|'));
const W = 480, H = 360, rows = [], r3 = (v) => Math.round(v * 1000) / 1000;
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
try {
  for (const [cube, dress = '{}', caption] of SETS) {
    const beach = cube.startsWith('beach:'), c0 = beach ? cube.slice(6) : cube, spec = c0.startsWith('{') ? JSON.parse(c0) : c0;
    const t0 = Date.now(), { payload: P } = await resolveWorldScene({ title: 'sand', manifest: beach ? { kind: 'geocube', cube: spec, show: 'land' } : { kind: 'stage', geocube: spec, trail: JSON.parse(dress), seed: 3 } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    // (the densest 6 m of sand, its centre)
    const bins = new Map();
    for (const f of P.faces) if (f.group === (beach ? 'isekai:strand' : 'isekai:sand')) { const c = [0, 1, 2].map((k) => f.corners.reduce((a, q) => a + q[k], 0) / f.corners.length), k = `${Math.floor(c[0] / 6)},${Math.floor(c[1] / 6)}`; const b = bins.get(k) ?? { n: 0, s: [0, 0, 0] }; b.n++; b.s = b.s.map((v, i) => v + c[i]); bins.set(k, b); }
    if (!bins.size) { console.log(caption, 'no', beach ? 'strand' : 'sand'); continue; }
    const best = [...bins.values()].sort((a, b) => b.n - a.n)[0], C = best.s.map((v) => v / best.n);
    const at = (dx, dy, dz) => [C[0] + dx, C[1] + dy, C[2] + dz].map(r3);
    const cam = (nm, from, to, fov) => ({ name: nm, worldFraming: { cameraPosition: from, lookAt: to, horizontalFov: fov } });
    const cams = [cam('wide', at(-9, -12, 7), at(0, 0, 0), 70), cam('eye', at(-1.5, -5, 1.7), at(0, 1, 0), 75), cam('close', at(0, -1.6, 1), at(0, 0.8, 0), 60), cam('down', at(0, -0.4, 2.2), at(0, 0.6, 0), 70)];
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: `${caption ?? cube} (${P.faces.length} faces, ${((Date.now() - t0) / 1000).toFixed(1)} s, sand at ${C.map((v) => v.toFixed(1))})`, cells });
    console.log(rows[rows.length - 1].cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 500 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
