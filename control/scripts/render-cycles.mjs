/**
 * Visual review of the cycle shelf (lib/graph/cycle-shelf): each machine assembled and drawn on the World page from the
 * side, the front three-quarter, the front and above, upright or parked on its stand, with its triangle count and its
 * laws. The machine gate's eyes are the operator's: this draws, it does not judge. No database writes.
 *
 * From control/:
 *   node scripts/render-cycles.mjs <output-directory> [archetype,…|all] [--views side,quarter,front,top,rear] [--pose '{"stand":"down","steer":20}'] [--look police] [--rider [posture]]
 * Writes <archetype>-<view>.png, the pages and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { CYCLE_ARCHETYPES, assembleCycle } = await import('../lib/graph/cycle-shelf/index.js');
const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const args = process.argv.slice(2);
const output = args[0];
if (!output) { console.error('Usage: node scripts/render-cycles.mjs <output-directory> [archetype,…|all] [--views side,quarter,front,top,rear] [--pose json]'); process.exit(2); }
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const views = (flag('--views') || 'side,quarter,front,top').split(',');
const pose = flag('--pose') ? JSON.parse(flag('--pose')) : {};
const look = flag('--look') ?? undefined;
const ridden = args.includes('--rider'), posture = ridden && flag('--rider') && !flag('--rider').startsWith('--') ? flag('--rider') : undefined;
const { riderOn } = await import('../lib/graph/cycle-shelf/cycle-rider.js');
const pick = args[1] && !args[1].startsWith('--') && args[1] !== 'all' ? args[1].split(',') : Object.keys(CYCLE_ARCHETYPES);
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600;
let gallery = '';
for (const id of pick) {
  const { manifest, readout } = assembleCycle(id, { pose, ...(look ? { look } : {}) });
  const { payload } = await resolveWorldScene({ ref: id, kind: 'assembler', manifest });
  const faces = payload.faces.filter((f) => !f.studio);
  // (its rider astride, posed on its own rider points: cycle-rider.js)
  const rider = ridden ? await riderOn(id, { posture, rider: readout.rider }) : null;
  if (rider) faces.push(...rider.faces);
  const tris = faces.reduce((n, f) => n + f.corners.length - 2, 0);
  const pts = faces.flatMap((f) => f.corners);
  const lo = [0, 1, 2].map((i) => pts.reduce((m, p) => Math.min(m, p[i]), Infinity)), hi = [0, 1, 2].map((i) => pts.reduce((m, p) => Math.max(m, p[i]), -Infinity));
  const mid = lo.map((v, i) => (v + hi[i]) / 2), L = hi[1] - lo[1];
  faces.push({ corners: [[mid[0] - L * 3, mid[1] - L * 3, -0.002], [mid[0] + L * 3, mid[1] - L * 3, -0.002], [mid[0] + L * 3, mid[1] + L * 3, -0.002], [mid[0] - L * 3, mid[1] + L * 3, -0.002]], fill: '#9aa0a4' });
  const cams = {
    side: [mid[0] + L * 1.9, mid[1], mid[2] + L * 0.05],
    quarter: [mid[0] + L * 1.25, mid[1] + L * 1.05, mid[2] + L * 0.45],
    front: [mid[0] + L * 0.12, mid[1] + L * 1.9, mid[2] + L * 0.12],
    rear: [mid[0] - L * 0.9, mid[1] - L * 1.4, mid[2] + L * 0.4],
    top: [mid[0] + L * 0.02, mid[1] - L * 0.05, mid[2] + L * 1.8],
  };
  const fail = readout.laws.laws.filter((l) => !l.ok).map((l) => l.id);
  gallery += `<h2>${id}: ${readout.label}</h2><p>${tris.toLocaleString('en-US')} triangles · ${JSON.stringify(readout.measures)} · ${JSON.stringify(readout.geometry)} · laws ${fail.length ? `failing ${fail.join(', ')}` : 'all hold'}${readout.lean ? ` · on its stand at ${readout.lean}°` : ''}${rider ? ` · ridden ${rider.report.posture}, leaning ${rider.report.hinge}°, hands ${rider.report.hands.L} / ${rider.report.hands.R} m off` : ''}</p><section>`;
  for (const view of views) {
    const html = emitThreeWorld({ faces, textures: payload.textures ?? {}, inline: true, hud: false, title: id, bg: '#cfd5da', metersPerUnit: 1, cameras: [{ name: view, worldFraming: { cameraPosition: cams[view], lookAt: mid, horizontalFov: 36, pictureCenter: [width / 2, height / 2] } }], viewBox: { width, height } });
    const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
    writeFileSync(path.join(outDir, `${id}-${view}.png`), png);
    writeFileSync(path.join(outDir, `${id}-${view}.html`), html);
    gallery += `<figure><a href="${id}-${view}.html"><img alt="${id}, ${view}" src="${id}-${view}.png"></a><figcaption>${view}</figcaption></figure>`;
    console.log(`Rendered ${id}-${view} (${tris} tris)`);
  }
  gallery += '</section>';
}
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Cycle shelf review</title><style>body{margin:0;padding:24px;background:#101722;color:#edf2f8;font:15px system-ui}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{margin:0;background:#202b3b;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:8px}p{color:#b8c4d4;font-size:13px;word-break:break-word}@media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>Cycle shelf review</h1>${gallery}</html>`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
