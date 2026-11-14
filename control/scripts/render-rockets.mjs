/**
 * Visual review of the launch vehicles (lib/graph/craft-shelf/rocket-archetypes.js): each archetype assembled at its
 * class figures and stood on its pad, lowered through the world scene as an assembler, drawn from a distance whole
 * (`stack`), close on its tail (`base`: its engines, its legs, its boosters' skirts) and close on its head (`head`: its
 * fairing, its capsule, its tower, its ship's nose), and from the side (`side`). No database writes.
 *
 * From control/:
 *   node scripts/render-rockets.mjs <output-directory> [archetype,…|all] [--views stack,base,head,side] [--pose json]
 * Writes <archetype>-<view>.png, the pages, report.json and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { assembleCraft, CRAFT_ARCHETYPES } = await import('../lib/graph/craft-shelf/index.js');
const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const args = process.argv.slice(2), output = args[0];
if (!output) { console.error('Usage: node scripts/render-rockets.mjs <output-directory> [archetype,…|all] [--views stack,base,head,side] [--pose json]'); process.exit(2); }
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const views = (flag('--views') || 'stack,base,head').split(','), pose = flag('--pose') ? JSON.parse(flag('--pose')) : {};
const all = Object.keys(CRAFT_ARCHETYPES).filter((k) => CRAFT_ARCHETYPES[k].realm === 'launch');
const pick = args[1] && !args[1].startsWith('--') && args[1] !== 'all' ? args[1].split(',') : all;
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600, report = [];
let gallery = '';
for (const id of pick) {
  const A = assembleCraft(id, { pose }), readout = A.readout;
  const { payload } = await resolveWorldScene({ ref: id, kind: 'assembler', manifest: A.manifest });
  const faces = payload.faces.filter((f) => !f.studio), textures = payload.textures ?? {};
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const p of f.corners) for (let i = 0; i < 3; i += 1) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; }
  const mid = lo.map((v, i) => (v + hi[i]) / 2), H = hi[2] - lo[2], Wd = Math.max(hi[0] - lo[0], hi[1] - lo[1]), L = Math.max(H, Wd);
  const pad = { corners: [[mid[0] - L * 2, mid[1] - L * 2, lo[2] - 0.01], [mid[0] + L * 2, mid[1] - L * 2, lo[2] - 0.01], [mid[0] + L * 2, mid[1] + L * 2, lo[2] - 0.01], [mid[0] - L * 2, mid[1] + L * 2, lo[2] - 0.01]], fill: '#a4a7a6' };
  const near = Math.max(Wd * 2.2, 12);
  // (far enough that the frame's height, narrower than its width, holds the whole stack and a margin)
  const vfov = (f) => 2 * Math.atan(Math.tan((f * Math.PI) / 360) * (height / width)), far = (f, h) => (h * 0.58) / Math.tan(vfov(f) / 2);
  const dS = far(42, Math.max(H, Wd * 1.6)), u = [0.77, -0.64];
  const cams = {
    stack: [[mid[0] + dS * u[0], mid[1] + dS * u[1], lo[2] + H * 0.42], [mid[0], mid[1], lo[2] + H * 0.5], 42],
    side: [[mid[0] + dS, mid[1], lo[2] + H * 0.5], [mid[0], mid[1], lo[2] + H * 0.5], 42],
    base: [[mid[0] + near * 0.8, mid[1] - near * 0.9, lo[2] + near * 0.35], [mid[0], mid[1], lo[2] + near * 0.25], 50],
    head: [[mid[0] + near * 0.75, mid[1] - near * 0.85, hi[2] - near * 0.15], [mid[0], mid[1], hi[2] - near * 0.42], 50],
  };
  const tris = faces.reduce((n, f) => n + f.corners.length - 2, 0);
  gallery += `<h2>${id}</h2><p>${tris.toLocaleString('en-US')} triangles · ${JSON.stringify(readout.measures)} · ref ${JSON.stringify(readout.reference)}</p><section>`;
  for (const view of views) {
    const [pos, look, fov] = cams[view];
    const html = emitThreeWorld({ faces: [...faces, pad], textures, inline: true, hud: false, title: id, bg: '#cfd8e0', metersPerUnit: 1, cameras: [{ name: view, worldFraming: { cameraPosition: pos, lookAt: look, horizontalFov: fov, pictureCenter: [width / 2, height / 2] } }], viewBox: { width, height } });
    writeFileSync(path.join(outDir, `${id}-${view}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
    writeFileSync(path.join(outDir, `${id}-${view}.html`), html);
    gallery += `<figure><a href="${id}-${view}.html"><img alt="${id}, ${view}" src="${id}-${view}.png"></a><figcaption>${view}</figcaption></figure>`;
    console.log(`Rendered ${id}-${view} (${tris} tris)`);
  }
  gallery += '</section>';
  report.push({ id, triangles: tris, measures: readout.measures, reference: readout.reference, audit: readout.audit });
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Launch vehicle review</title><style>body{font:14px system-ui;margin:24px;background:#f3f4f5}section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{width:480px}</style><h1>Launch vehicle review</h1>${gallery}`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
