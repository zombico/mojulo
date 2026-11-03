/**
 * Visual review of the construction shelf (lib/graph/construction-shelf): each machine assembled at its named poses and
 * drawn on the World page from the side, the front three-quarter, the front and above, with its triangle count, its
 * envelope and its laws. The machine gate's eyes are the operator's: this draws, it does not judge. No database writes.
 *
 * From control/:
 *   node scripts/render-construction.mjs <output-directory> [archetype,…|all] [--poses rest,dig,dump] [--views side,quarter,front,top,rear] [--joints '{"boom":20}'] [--tool breaker] [--carrier wheels]
 * Writes <archetype>-<pose>-<view>.png, the pages and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { CON_ARCHETYPES, assembleMachine } = await import('../lib/graph/construction-shelf/index.js');
const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const args = process.argv.slice(2);
const output = args[0];
if (!output) { console.error('Usage: node scripts/render-construction.mjs <output-directory> [archetype,…|all] [--poses rest,dig] [--views side,quarter,front,top,rear] [--joints json]'); process.exit(2); }
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const views = (flag('--views') || 'side,quarter').split(',');
const joints = flag('--joints') ? JSON.parse(flag('--joints')) : null;
const tool = flag('--tool') ?? undefined, carrier = flag('--carrier') ?? undefined;
const pick = args[1] && !args[1].startsWith('--') && args[1] !== 'all' ? args[1].split(',') : Object.keys(CON_ARCHETYPES);
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600;
let gallery = '';
for (const id of pick) {
  const poses = joints ? ['joints'] : (flag('--poses') || Object.keys(CON_ARCHETYPES[id].poses).join(',')).split(',');
  for (const pose of poses) {
    const { manifest, readout } = assembleMachine(id, { pose: joints ?? pose, tool, carrier });
    const { payload } = await resolveWorldScene({ ref: `${id}-${pose}`, kind: 'assembler', manifest });
    const name = `${id}${carrier ? `-${carrier}` : ''}${tool ? `-${tool}` : ''}-${pose}`;
    const faces = payload.faces.filter((f) => !f.studio);
    const tris = faces.reduce((n, f) => n + f.corners.length - 2, 0);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of faces) for (const p of f.corners) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
    const mid = lo.map((v, i) => (v + hi[i]) / 2), L = Math.max(hi[1] - lo[1], (hi[2] - lo[2]) * 1.6, hi[0] - lo[0]);
    faces.push({ corners: [[mid[0] - L * 3, mid[1] - L * 3, -0.002], [mid[0] + L * 3, mid[1] - L * 3, -0.002], [mid[0] + L * 3, mid[1] + L * 3, -0.002], [mid[0] - L * 3, mid[1] + L * 3, -0.002]], fill: '#a59d8c' });
    const cams = {
      side: [mid[0] + L * 1.75, mid[1], mid[2] + L * 0.05],
      quarter: [mid[0] + L * 1.2, mid[1] + L * 1.0, mid[2] + L * 0.45],
      front: [mid[0] + L * 0.12, mid[1] + L * 1.8, mid[2] + L * 0.12],
      rear: [mid[0] - L * 0.9, mid[1] - L * 1.3, mid[2] + L * 0.4],
      top: [mid[0] + L * 0.02, mid[1] - L * 0.05, mid[2] + L * 1.7],
    };
    const fail = readout.laws.laws.filter((l) => !l.ok).map((l) => l.id);
    gallery += `<h2>${id} · ${pose}: ${readout.label}</h2><p>${tris.toLocaleString('en-US')} triangles · joints ${JSON.stringify(readout.joints)} · ${JSON.stringify(readout.measures)} · envelope ${JSON.stringify(readout.envelope)} · laws ${fail.length ? `failing ${fail.join(', ')}` : 'all hold'}</p><section>`;
    for (const view of views) {
      const html = emitThreeWorld({ faces, textures: payload.textures ?? {}, inline: true, hud: false, title: `${id} ${pose}`, bg: '#cfd5da', metersPerUnit: 1, cameras: [{ name: view, worldFraming: { cameraPosition: cams[view], lookAt: mid, horizontalFov: 36, pictureCenter: [width / 2, height / 2] } }], viewBox: { width, height } });
      const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
      writeFileSync(path.join(outDir, `${name}-${view}.png`), png);
      writeFileSync(path.join(outDir, `${name}-${view}.html`), html);
      gallery += `<figure><a href="${name}-${view}.html"><img alt="${name}, ${view}" src="${name}-${view}.png"></a><figcaption>${pose} · ${view}</figcaption></figure>`;
      console.log(`Rendered ${name}-${view} (${tris} tris)`);
    }
    gallery += '</section>';
  }
}
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Construction shelf review</title><style>body{margin:0;padding:24px;background:#101722;color:#edf2f8;font:15px system-ui}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{margin:0;background:#202b3b;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:8px}p{color:#b8c4d4;font-size:13px;word-break:break-word}@media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>Construction shelf review</h1>${gallery}</html>`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
