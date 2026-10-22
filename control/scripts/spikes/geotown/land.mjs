#!/usr/bin/env node
/**
 * SPIKE: a cube's land close up in its micro-town (the geocube kind's `show: 'town'`): the trail's edge, the nearest
 * tree, the nearest cliff, each cube on a row: the gritty land read against the same land unworn.
 *
 *   cd control && node scripts/spikes/geotown/land.mjs [name] [cube …]   (a cube a preset or a JSON spec)
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
const [name = 'land', ...sets] = process.argv.slice(2);
const SETS = (sets.length ? sets : ['limestone-crags', '{"from":"limestone-crags","grit":0.3}']).map((s) => [s]);
const W = 520, H = 400, rows = [], r3 = (v) => Math.round(v * 1000) / 1000;
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
  for (const [cube] of SETS) {
    const { payload: P } = await resolveWorldScene({ title: 'land', manifest: { kind: 'geocube', cube: cube.startsWith('{') ? JSON.parse(cube) : cube, show: 'town', walk: false, seed: 3 } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const h = P.anchors.find((a) => a.kind === 'house'), N = h.N, T = [-N[1], N[0]], at = (n, t, z) => [h.at[0] + N[0] * n + T[0] * t, h.at[1] + N[1] * n + T[1] * t, h.floor + z].map(r3);
    const cam = (nm, from, to, fov) => ({ name: nm, worldFraming: { cameraPosition: from, lookAt: to, horizontalFov: fov } });
    // the nearest of a group's faces to the house, and a point backed off from it toward the house
    const mid = (f) => f.corners.reduce((a, c) => a.map((v, k) => v + c[k] / f.corners.length), [0, 0, 0]);
    const near = (g) => P.faces.filter((f) => f.group === g).map(mid).sort((a, b) => Math.hypot(a[0] - h.at[0], a[1] - h.at[1]) - Math.hypot(b[0] - h.at[0], b[1] - h.at[1]))[0];
    const off = (p, d, z) => { const v = [h.at[0] - p[0], h.at[1] - p[1]], l = Math.hypot(...v) || 1; return [p[0] + (v[0] / l) * d, p[1] + (v[1] / l) * d, p[2] + z].map(r3); };
    const tree = near('isekai:crown'), cliff = near('isekai:cliff');
    // the trail's edge: from the town's trail camera, a few metres along and down at the path's side
    const TF = P.cameras.find((c) => c.name === 'trail')?.worldFraming, along = TF ? [0, 1, 2].map((k) => TF.lookAt[k] - TF.cameraPosition[k]) : null;
    const edge = TF ? cam('edge', [TF.cameraPosition[0], TF.cameraPosition[1], TF.cameraPosition[2] - 0.5].map(r3), [0, 1, 2].map((k) => r3(TF.cameraPosition[k] + along[k] * 0.3 + (k === 2 ? -1.6 : 0))), 60) : cam('ground', at(6, 3, 1.4), at(1.5, 6, 0), 70);
    const cams = [edge, cam('tree', off(tree, 6, -1.5), tree.map(r3), 60), cam('cliff', off(cliff, 9, 0), cliff.map(r3), 70)];
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: cube, cells });
    console.log(rows[rows.length - 1].cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 50, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
