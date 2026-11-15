/**
 * Visual review of the highway's haulers (lib/graph/car-designer/road-haul.js), the farm's machines
 * (lib/graph/car-designer/road-farm.js) and the city's working trucks (lib/graph/car-designer/road-city-truck.js): each class compiled realistic, at its class's numbers, in its kind's plain
 * livery, drawn in the vehicle ODM's physically lit review page (car-designer/vehicle-review.js) from the front quarter,
 * the side and the rear quarter, under a brief's words when one is given (a trailer's kind, `empty`, a machine at work).
 * No database writes.
 *
 * From control/:
 *   node scripts/render-haul.mjs <output-directory> [class,…] [views: quarter,side,rear,front] [brief] [livery]
 * Writes <class>[-<brief>]-<view>.png, the pages, report.json and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { HAUL_CLASSES } = await import('../lib/graph/car-designer/road-haul.js');
const { MIL_MATERIALS } = await import('../lib/graph/car-designer/road-military.js');
const { compileRealistic } = await import('../lib/graph/car-designer/realistic.js');
const { rollVehicleSheet } = await import('../lib/graph/car-designer/sheet.js');
const { VEHICLES } = await import('../lib/graph/roads/vehicles.js');
const { emitVehicleReview } = await import('../lib/graph/car-designer/vehicle-review.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');
const { FARM_CLASSES: FARM } = await import('../lib/graph/car-designer/road-farm.js');
const { CITY_TRUCK_CLASSES: CITY } = await import('../lib/graph/car-designer/road-city-truck.js');

const [output, classArg, viewArg, brief, liveryArg] = process.argv.slice(2);
if (!output) { console.error('Usage: node scripts/render-haul.mjs <output-directory> [class,…] [views] [brief] [livery]'); process.exit(2); }
const classes = classArg ? classArg.split(',') : [...Object.keys(HAUL_CLASSES), ...Object.keys(FARM), ...Object.keys(CITY)], views = (viewArg || 'quarter,side,rear').split(',');
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600, report = [], tag = brief ? `-${brief.replace(/[^a-z0-9]+/gi, '_')}` : '';
let gallery = '';
for (const cls of classes) {
  const v = VEHICLES[cls], H = v.H;
  gallery += `<h2>${cls}${brief ? ` (${brief})` : ''}</h2><section>`;
  const c = compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 3, ...(brief ? { brief } : {}) }), { form: true, ...(liveryArg ? { livery: liveryArg } : {}) });
  const all = Object.values(c.form).flat(), pts = all.flatMap((f) => f.corners);
  const L = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])), Wd = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
  const span = Math.max(L, Wd), d = span * 0.9 + 4;
  for (const view of views) {
    const cams = {
      quarter: [[d * 0.62, d * 0.72, H * 0.9 + span * 0.12], [0, span * 0.06, H * 0.4], 44],
      side: [[d * 1.3, 0, H * 0.5 + 0.4], [0, 0, H * 0.45], 46],
      rear: [[-d * 0.5, -d * 0.75, H * 0.9 + span * 0.1], [0, -span * 0.08, H * 0.4], 44],
      front: [[1.2, span * 0.5 + 6, H * 0.7], [0, 0, H * 0.45], 40],
      close: [[5.5, span * 0.5 + 3.5, H * 0.75], [0, span * 0.5 - 2.5, H * 0.45], 50],
    };
    const cam = cams[view];
    if (!cam) continue;
    const html = emitVehicleReview({ faces: { all }, materials: MIL_MATERIALS, census: c.census }, { title: `${cls} ${view}`, cameraPosition: cam[0], lookAt: cam[1], horizontalFov: cam[2] });
    writeFileSync(path.join(outDir, `${cls}${tag}-${view}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
    writeFileSync(path.join(outDir, `${cls}${tag}-${view}.html`), html);
    gallery += `<figure><a href="${cls}${tag}-${view}.html"><img alt="${cls}, ${view}" src="${cls}${tag}-${view}.png"></a><figcaption>${view}</figcaption></figure>`;
    console.log(`Rendered ${cls}${tag}-${view}`);
  }
  report.push({ class: cls, brief: brief ?? null, census: c.census, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0) });
  gallery += '</section>';
}
writeFileSync(path.join(outDir, `report${tag}.json`), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, `index${tag}.html`), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Haulers and farm review</title><style>body{font:14px system-ui;margin:24px;background:#f3f4f5}section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{width:480px}</style><h1>Haulers and farm review</h1>${gallery}`);
console.log(`Review sheet: ${path.join(outDir, `index${tag}.html`)}`);
