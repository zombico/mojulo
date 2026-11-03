/**
 * Visual review of the mecha shelf (lib/graph/mecha-shelf): each frame assembled at its stances and drawn on the World
 * page from the side, the front three-quarter, the front, the rear and above, with its triangle count, its joints and its
 * laws; `--rider` seats the realistic hero (cycle-shelf/cycle-rider.js) in it. The machine gate's eyes are the
 * operator's: this draws, it does not judge. No database writes.
 *
 * From control/:
 *   node scripts/render-mecha.mjs <output-directory> [archetype,…|all] [--poses stand,board] [--views side,quarter,front,rear,top] [--palette fieldOlive] [--rider] [--task demolition] [--tools r:breaker,l:grapple] [--arms r:long]
 * Writes <archetype>-<pose>-<view>.png, the pages and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { MECHA_ARCHETYPES, assembleFrame } = await import('../lib/graph/mecha-shelf/index.js');
const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const args = process.argv.slice(2);
const output = args[0];
if (!output) { console.error('Usage: node scripts/render-mecha.mjs <output-directory> [archetype,…|all] [--poses stand,board] [--views side,quarter,front,rear,top] [--palette id] [--rider]'); process.exit(2); }
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const views = (flag('--views') || 'side,quarter,front').split(',');
const palette = flag('--palette') ?? undefined, seated = args.includes('--rider'), task = flag('--task') ?? undefined;
const pairs = (v) => (v ? Object.fromEntries(v.split(',').map((kv) => kv.split(':'))) : undefined), tools = pairs(flag('--tools')), arms = pairs(flag('--arms'));
const pick = args[1] && !args[1].startsWith('--') && args[1] !== 'all' ? args[1].split(',') : Object.keys(MECHA_ARCHETYPES);
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 720;
let gallery = '';
for (const id of pick) {
  const poses = (flag('--poses') || Object.keys(MECHA_ARCHETYPES[id].stances).join(',')).split(',');
  for (const pose of poses) {
    const { manifest, readout } = assembleFrame(id, { pose, palette, task, tools, arms });
    const { payload } = await resolveWorldScene({ ref: `${id}-${pose}`, kind: 'assembler', manifest });
    const name = `${id}${palette ? `-${palette}` : ''}${task ? `-${task}` : ''}${tools ? `-${Object.values(tools).join('-')}` : ''}-${pose}${seated ? '-rider' : ''}`;
    const faces = payload.faces.filter((f) => !f.studio);
    if (seated) {
      const { seatRider } = await import('../lib/graph/mecha-shelf/mecha-figure.js');
      const R = await seatRider(readout.composed ?? id, readout);
      faces.push(...R.faces);
      console.log(`rider: ${JSON.stringify(R.report)}`);
    }
    const tris = faces.reduce((n, f) => n + f.corners.length - 2, 0);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of faces) for (const p of f.corners) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
    const mid = lo.map((v, i) => (v + hi[i]) / 2), L = Math.max(hi[1] - lo[1], (hi[2] - lo[2]) * 1.15, hi[0] - lo[0]);
    faces.push({ corners: [[mid[0] - L * 4, mid[1] - L * 4, -0.002], [mid[0] + L * 4, mid[1] - L * 4, -0.002], [mid[0] + L * 4, mid[1] + L * 4, -0.002], [mid[0] - L * 4, mid[1] + L * 4, -0.002]], fill: '#a59d8c' });
    const cams = {
      side: [mid[0] + L * 2.1, mid[1], mid[2] + L * 0.08],
      quarter: [mid[0] + L * 1.45, mid[1] + L * 1.25, mid[2] + L * 0.5],
      front: [mid[0] + L * 0.1, mid[1] + L * 2.1, mid[2] + L * 0.15],
      rear: [mid[0] - L * 1.1, mid[1] - L * 1.6, mid[2] + L * 0.45],
      top: [mid[0] + L * 0.02, mid[1] - L * 0.05, mid[2] + L * 2.2],
    };
    const fail = readout.laws.laws.filter((l) => !l.ok).map((l) => l.id);
    gallery += `<h2>${id} · ${pose}: ${readout.label}</h2><p>${tris.toLocaleString('en-US')} triangles · pelvis ${JSON.stringify(readout.root)} · ${JSON.stringify(readout.measures)} · ${readout.mass.gross} kg gross · laws ${fail.length ? `failing ${fail.join(', ')}` : 'all hold'}</p><section>`;
    for (const view of views) {
      const html = emitThreeWorld({ faces, textures: payload.textures ?? {}, inline: true, hud: false, title: `${id} ${pose}`, bg: '#cfd5da', metersPerUnit: 1, cameras: [{ name: view, worldFraming: { cameraPosition: cams[view], lookAt: mid, horizontalFov: 34, pictureCenter: [width / 2, height / 2] } }], viewBox: { width, height } });
      const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
      writeFileSync(path.join(outDir, `${name}-${view}.png`), png);
      writeFileSync(path.join(outDir, `${name}-${view}.html`), html);
      gallery += `<figure><a href="${name}-${view}.html"><img alt="${name}, ${view}" src="${name}-${view}.png"></a><figcaption>${pose} · ${view}</figcaption></figure>`;
      console.log(`Rendered ${name}-${view} (${tris} tris)`);
    }
    gallery += '</section>';
  }
}
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Mecha shelf review</title><style>body{margin:0;padding:24px;background:#101722;color:#edf2f8;font:15px system-ui}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{margin:0;background:#202b3b;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:8px}p{color:#b8c4d4;font-size:13px;word-break:break-word}@media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>Mecha shelf review</h1>${gallery}</html>`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
