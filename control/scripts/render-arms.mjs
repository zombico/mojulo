/**
 * Visual review of the arms library (lib/graph/equipment/arms): each build lowered as the workbench lowers it and drawn
 * on the World page from the side and from the front three-quarter, with its triangle count and its laws readout. No
 * database writes.
 *
 * From control/:
 *   node scripts/render-arms.mjs <output-directory> [preset,preset,…|all] [--builds '<json array of builds>'] [--views side,quarter,top]
 * Presets are named rows below (pistol, blaster, revolver, carbine, rifle, marksman, bullpup, smg, pump, tactical,
 * knife, tanto, karambit, dagger, and their future-line twins). Writes <preset>-<view>.png, the pages and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { expandEquipment, stampArms } = await import('../lib/graph/equipment/expand.js');
const { lowerObjectFaces } = await import('../lib/graph/worlds/workbench.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

export const PRESETS = {
  pistol: { item: 'pistol', model: 'service' },
  'pistol-fde-dot': { item: 'pistol', model: 'service', style: 'fde', parts: { optic: 'reddot', underbarrel: 'light' } },
  heavy: { item: 'pistol', model: 'heavy', style: 'stainless' },
  revolver: { item: 'pistol', model: 'revolver', style: 'walnut', parts: { barrel: 'long' } },
  blaster: { item: 'pistol', model: 'service', line: 'future' },
  'blaster-gunship': { item: 'pistol', model: 'heavy', style: 'gunship' },
  carbine: { item: 'carbine' },
  rifle: { item: 'rifle', style: 'fde' },
  'pulse-rifle': { item: 'rifle', style: 'white' },
  marksman: { item: 'rifle', model: 'marksman', style: 'od' },
  railgun: { item: 'rifle', model: 'marksman', style: 'titan' },
  bullpup: { item: 'rifle', model: 'bullpup' },
  'bullpup-hazard': { item: 'rifle', model: 'bullpup', style: 'hazard' },
  smg: { item: 'smg', parts: { muzzle: 'suppressor' } },
  pump: { item: 'shotgun', style: 'walnut' },
  tactical: { item: 'shotgun', model: 'tactical' },
  scatter: { item: 'shotgun', model: 'tactical', style: 'gunship' },
  knife: { item: 'knife' },
  tanto: { item: 'knife', model: 'tanto', style: 'od' },
  dagger: { item: 'knife', model: 'dagger', style: 'stainless' },
  karambit: { item: 'knife', model: 'karambit' },
  vibroblade: { item: 'knife', line: 'future', style: 'white' },
  'anime-pistol': { item: 'pistol', model: 'service', dials: { stylize: 0.7 } },
};

const args = process.argv.slice(2);
const output = args[0];
if (!output) { console.error('Usage: node scripts/render-arms.mjs <output-directory> [preset,…|all] [--builds json] [--views side,quarter,top]'); process.exit(2); }
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const viewList = (flag('--views') || 'side,quarter').split(',');
let rows;
if (flag('--builds')) rows = JSON.parse(flag('--builds')).map((b, i) => [b.name || `build${i}`, b]);
else { const pick = args[1] && !args[1].startsWith('--') && args[1] !== 'all' ? args[1].split(',') : Object.keys(PRESETS); rows = pick.map((k) => { if (!PRESETS[k]) throw new Error(`unknown preset ${k}`); return [k, PRESETS[k]]; }); }
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 900, height = 560;
let gallery = '';
const report = [];
for (const [name, b] of rows) {
  const build = { type: 'equipment', ...b };
  const e = expandEquipment(stampArms(build));
  const faces = lowerObjectFaces({ kind: 'workbench', units: 'cm', build: stampArms(build) });
  const tris = faces.reduce((n, f) => n + f.corners.length - 2, 0);
  // bounds → cameras that frame it (cm; the item's frame is +z along it, +y up; the World is z-up, so turn it: x→x, y→z, z→y)
  // a proper rotation (no mirror): a gun's up (+y) to the World's, its left side to the camera; a blade's flat to the
  // camera, its edge down
  const blade = b.item === 'knife' || ['dagger', 'sword', 'greatsword'].includes(b.item);
  const turn = blade ? ([x, y, z]) => [z, y, -x] : ([x, y, z]) => [z, x, y];
  const turned = faces.map((f) => ({ ...f, corners: f.corners.map(turn), ...(f.outNormal ? { outNormal: turn(f.outNormal) } : {}) }));
  const pts = turned.flatMap((f) => f.corners);
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const mid = lo.map((v, i) => (v + hi[i]) / 2), L = Math.max(hi[0] - lo[0], hi[2] - lo[2]) || 10;
  const ground = lo[2] - 0.6;
  turned.push({ corners: [[mid[0] - L * 3, mid[1] - L * 3, ground], [mid[0] + L * 3, mid[1] - L * 3, ground], [mid[0] + L * 3, mid[1] + L * 3, ground], [mid[0] - L * 3, mid[1] + L * 3, ground]], fill: '#9da3a8' });
  const cams = {
    side: [mid[0], mid[1] - L * 1.75, mid[2] + L * 0.05],
    quarter: [mid[0] + L * 1.0, mid[1] - L * 1.25, mid[2] + L * 0.6],
    top: [mid[0] + L * 0.02, mid[1] - L * 0.2, mid[2] + L * 1.6],
    rear: [mid[0] - L * 0.9, mid[1] - L * 0.9, mid[2] + L * 0.45],
  };
  gallery += `<h2>${name}</h2><p>${tris.toLocaleString('en-US')} triangles · ${e.trace.length} cm · ${JSON.stringify(e.trace.variants)}</p><p>${JSON.stringify(e.trace.arms ?? {})}</p><section>`;
  for (const view of viewList) {
    const html = emitThreeWorld({ faces: turned, inline: true, hud: false, title: name, bg: '#cfd5da', metersPerUnit: 0.01, cameras: [{ name: view, worldFraming: { cameraPosition: cams[view], lookAt: mid, horizontalFov: 38, pictureCenter: [width / 2, height / 2] } }], viewBox: { width, height } });
    const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
    writeFileSync(path.join(outDir, `${name}-${view}.png`), png);
    writeFileSync(path.join(outDir, `${name}-${view}.html`), html);
    gallery += `<figure><a href="${name}-${view}.html"><img alt="${name}, ${view}" src="${name}-${view}.png"></a><figcaption>${view}</figcaption></figure>`;
    console.log(`Rendered ${name}-${view} (${tris} tris)`);
  }
  gallery += '</section>';
  report.push({ name, build, triangles: tris, length: e.trace.length, sockets: e.sockets, arms: e.trace.arms });
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Arms review</title><style>body{margin:0;padding:24px;background:#101722;color:#edf2f8;font:15px system-ui}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{margin:0;background:#202b3b;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:8px}p{color:#b8c4d4;font-size:13px;word-break:break-word}@media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>Arms review</h1>${gallery}</html>`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
