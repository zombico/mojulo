/**
 * Visual review of the rail shelf's cab cars (lib/graph/rail-shelf/): each card composed, finished and drawn on a
 * stretch of track in the vehicle ODM's physically lit review page (car-designer/vehicle-review.js), from the front
 * quarter, the side, at the nose and under it at the bogie. No database writes.
 *
 * From control/:
 *   node scripts/render-rail.mjs <output-directory> [game|studio|hero] [preset,…] [views: quarter,side,nose,bogie,rear]
 * Writes <preset>-<view>.png, the pages, report.json and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { composeCab, CAB_LIBRARY, finishRailFaces } = await import('../lib/graph/rail-shelf/index.js');
const { emitVehicleReview } = await import('../lib/graph/car-designer/vehicle-review.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const [output, quality = 'studio', presetArg, viewArg] = process.argv.slice(2);
if (!output) { console.error('Usage: node scripts/render-rail.mjs <output-directory> [game|studio|hero] [preset,…] [views]'); process.exit(2); }
const presets = presetArg ? presetArg.split(',') : Object.keys(CAB_LIBRARY), views = (viewArg || 'quarter,side,nose,bogie').split(',');
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600, report = [];
let gallery = '';
// (the track under it: two rails on the gauge, sleepers, a ballast bed)
function track(L) {
  const f = [], q = (corners, part, fill, n) => f.push({ corners, part, fill, outNormal: n });
  const y0 = -L / 2 - 6, y1 = L / 2 + 14, g = 0.7175;
  q([[-2.6, y0, -0.32], [2.6, y0, -0.32], [2.6, y1, -0.32], [-2.6, y1, -0.32]], 'ballast', '#8a857c', [0, 0, 1]);
  for (let y = y0; y < y1; y += 0.65) q([[-1.3, y, -0.2], [1.3, y, -0.2], [1.3, y + 0.25, -0.2], [-1.3, y + 0.25, -0.2]], 'sleeper', '#6b665e', [0, 0, 1]);
  for (const sx of [1, -1]) {
    const x = sx * (g + 0.035);
    q([[x - 0.035, y0, 0], [x + 0.035, y0, 0], [x + 0.035, y1, 0], [x - 0.035, y1, 0]], 'rail', '#a9adb1', [0, 0, 1]);
    q([[x + sx * 0.035, y0, -0.18], [x + sx * 0.035, y1, -0.18], [x + sx * 0.035, y1, 0], [x + sx * 0.035, y0, 0]], 'rail', '#7d8287', [sx, 0, 0]);
  }
  return finishRailFaces(f).map((x) => ({ ...x, material: x.part === 'rail' ? 'alloy' : 'seal' }));
}
for (const preset of presets) {
  const c = composeCab({ preset, seed: 11, surface: { quality } }), d = c.design, L = d.frame.length, tip = d.anchors.tip;
  const compiled = { ...c, faces: { ...c.faces, track: track(L) } };
  const yB = d.frame.bogies[0];
  const cams = {
    quarter: [[L * 0.32 + 4, tip + L * 0.42 + 4, 3.4], [0, tip - L * 0.25, 1.8], 40],
    side: [[L * 0.95 + 6, 0, 2.2], [0, 0, 1.9], 40],
    nose: [[3.6, tip + 4.6, 2.6], [0, tip - Math.min(2, d.front.nose * 0.5), 1.9], 42],
    bogie: [[3.4, yB + 2.2, 0.9], [0, yB, 0.6], 44],
    rear: [[4, -L / 2 - 7, 3], [0, -L / 2 + 3, 2], 40],
  };
  gallery += `<h2>${CAB_LIBRARY[preset].title}</h2><p>${c.census.triangles.toLocaleString('en-US')} triangles · ${c.census.materialGroups} materials · ${L} m long, ${d.frame.width} m wide, ${d.frame.height} m high · laws ${d.laws.every((l) => l.pass) ? 'held' : 'failed'}</p><section>`;
  for (const v of views) {
    const [cameraPosition, lookAt, horizontalFov] = cams[v];
    const html = emitVehicleReview(compiled, { title: CAB_LIBRARY[preset].title, cameraPosition, lookAt, horizontalFov });
    writeFileSync(path.join(outDir, `${preset}-${v}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
    writeFileSync(path.join(outDir, `${preset}-${v}.html`), html);
    gallery += `<figure><a href="${preset}-${v}.html"><img alt="${preset}, ${v}" src="${preset}-${v}.png"></a><figcaption>${v}</figcaption></figure>`;
    console.log(`Rendered ${preset}-${v}`);
  }
  gallery += '</section>';
  report.push({ preset, composition: c.composition, frame: d.frame, laws: d.laws, census: c.census });
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Rail cab review</title><style>body{font:14px system-ui;margin:24px;background:#f3f4f5}section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{width:480px}</style><h1>Rail cab review</h1>${gallery}`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
