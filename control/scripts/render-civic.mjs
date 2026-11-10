/**
 * Visual review of the city's utility vehicles (lib/graph/car-designer/road-civic.js): each class compiled realistic, at
 * its class's numbers, in its kind's plain livery, drawn in the vehicle ODM's physically lit review page
 * (car-designer/vehicle-review.js) from the front quarter, the side, the rear quarter, and deployed (its words: a
 * tailgate tipped, a blade down, brooms down, a ladder or a bucket raised). No database writes.
 *
 * From control/:
 *   node scripts/render-civic.mjs <output-directory> [class,…] [views: quarter,side,rear,deployed] [livery]
 * Writes <class>-<view>.png, the pages, report.json and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { CIVIC_CLASSES, CIVIC_WORDS } = await import('../lib/graph/car-designer/road-civic.js');
const { MIL_MATERIALS } = await import('../lib/graph/car-designer/road-military.js');
const { compileRealistic } = await import('../lib/graph/car-designer/realistic.js');
const { rollVehicleSheet } = await import('../lib/graph/car-designer/sheet.js');
const { VEHICLES } = await import('../lib/graph/roads/vehicles.js');
const { emitVehicleReview } = await import('../lib/graph/car-designer/vehicle-review.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const [output, classArg, viewArg, liveryArg] = process.argv.slice(2);
if (!output) { console.error('Usage: node scripts/render-civic.mjs <output-directory> [class,…] [views] [livery]'); process.exit(2); }
const classes = classArg ? classArg.split(',') : Object.keys(CIVIC_CLASSES), views = (viewArg || 'quarter,side,rear,deployed').split(',');
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600, report = [];
let gallery = '';
for (const cls of classes) {
  const kind = CIVIC_CLASSES[cls], v = VEHICLES[cls], L = v.L, H = v.H;
  gallery += `<h2>${cls}</h2><section>`;
  for (const view of views) {
    const deployed = view === 'deployed', words = deployed ? CIVIC_WORDS[kind]?.[0] : undefined;
    if (deployed && !words) continue;
    const c = compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 3, ...(words ? { brief: words } : {}) }), { form: true, ...(liveryArg ? { livery: liveryArg } : {}) });
    const all = Object.values(c.form).flat(), top = Math.max(...all.flatMap((f) => f.corners.map((p) => p[2])));
    const k = Math.min(1, 16 / Math.max(L, top * 1.2));
    const cams = {
      quarter: [[L * 0.55 * k + 3.5, L * 0.6 * k + 3, H * 0.9 + 1.2], [0, L * 0.08, H * 0.45], 44],
      side: [[L * 0.95 * k + 5, 0, H * 0.55 + 0.4], [0, 0, H * 0.45], 46],
      rear: [[-(L * 0.45 * k + 3.5), -(L * 0.6 * k + 3), H * 0.9 + 1.0], [0, -L * 0.1, H * 0.45], 44],
      // (a tall reach seen whole: as far off as the review's orbit allows, its middle at mid-height, wide)
      deployed: top > 8 ? [[11.5, 10.5, top * 0.5 + 2.5], [0, 0, top * 0.48], top > 15 ? 96 : 76] : [[L * 0.6 * k + 5, L * 0.35 * k + 3, H + 1.5], [0, 0, H * 0.4], 46],
    };
    const cam = cams[view];
    if (!cam) continue;
    const html = emitVehicleReview({ faces: { all }, materials: MIL_MATERIALS, census: c.census }, { title: `${cls} ${view}`, cameraPosition: cam[0], lookAt: cam[1], horizontalFov: cam[2] });
    writeFileSync(path.join(outDir, `${cls}-${view}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
    writeFileSync(path.join(outDir, `${cls}-${view}.html`), html);
    gallery += `<figure><a href="${cls}-${view}.html"><img alt="${cls}, ${view}" src="${cls}-${view}.png"></a><figcaption>${view}${words ? ` (${words})` : ''}</figcaption></figure>`;
    console.log(`Rendered ${cls}-${view}`);
    if (view === views[0]) report.push({ class: cls, kind, census: c.census, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0) });
  }
  gallery += '</section>';
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>City utility review</title><style>body{font:14px system-ui;margin:24px;background:#f3f4f5}section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{width:480px}</style><h1>City utility review</h1>${gallery}`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
