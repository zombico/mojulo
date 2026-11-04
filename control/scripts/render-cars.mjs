/**
 * Visual review of the car shelf (lib/graph/car-shelf/): each card (or composition) compiled in the form render at its
 * class's numbers, drawn in the vehicle ODM's physically lit review page (car-designer/vehicle-review.js) from the front
 * quarter, the side, the rear quarter and above. No database writes.
 *
 * From control/:
 *   node scripts/render-cars.mjs <output-directory> [card,… | '{"preset":…}'] [views: quarter,side,rear,top]
 * Writes <card>-<view>.png, the pages, report.json and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { CAR_CARD_IDS, compileCar, carMaterials } = await import('../lib/graph/car-shelf/index.js');
const { emitVehicleReview } = await import('../lib/graph/car-designer/vehicle-review.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const [output, cardArg, viewArg] = process.argv.slice(2);
if (!output) { console.error('Usage: node scripts/render-cars.mjs <output-directory> [card,… | JSON] [views]'); process.exit(2); }
const specs = !cardArg ? CAR_CARD_IDS.map((id) => [id, id]) : cardArg.trim().startsWith('{') ? [['composed', JSON.parse(cardArg)]] : cardArg.split(',').map((id) => [id, id]);
const views = (viewArg || 'quarter,side,rear').split(',');
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600, report = [];
let gallery = '';
for (const [name, spec] of specs) {
  const c = compileCar(spec, { form: true }), all = Object.values(c.form).flat(), L = c.spec.L, H = c.spec.H;
  gallery += `<h2>${name} · ${c.design.title}</h2><section>`;
  const cams = {
    quarter: [[L * 0.62 + 2.2, L * 0.7 + 1.8, H * 0.7 + 1.0], [0, L * 0.04, H * 0.42], 40],
    side: [[L * 1.25 + 2.5, 0, H * 0.5 + 0.3], [0, 0, H * 0.45], 40],
    rear: [[-(L * 0.55 + 2.0), -(L * 0.7 + 1.8), H * 0.7 + 1.1], [0, -L * 0.05, H * 0.42], 40],
    top: [[L * 0.3 + 1, L * 0.35 + 1.0, H + 3.4], [0, 0, H * 0.4], 44],
  };
  for (const view of views) {
    const cam = cams[view];
    if (!cam) continue;
    const html = emitVehicleReview({ faces: { all }, materials: carMaterials(c.design), census: c.census }, { title: `${c.design.title} · ${view}`, cameraPosition: cam[0], lookAt: cam[1], horizontalFov: cam[2] });
    writeFileSync(path.join(outDir, `${name}-${view}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
    writeFileSync(path.join(outDir, `${name}-${view}.html`), html);
    gallery += `<figure><a href="${name}-${view}.html"><img alt="${name}, ${view}" src="${name}-${view}.png"></a><figcaption>${view}</figcaption></figure>`;
  }
  console.log(`Rendered ${name}`);
  report.push({ name, title: c.design.title, class: c.class, census: c.census, laws: c.design.laws.filter((l) => !l.pass).map((l) => l.id), triangles: all.reduce((t, f) => t + f.corners.length - 2, 0) });
  gallery += '</section>';
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Car shelf review</title><style>body{font:14px system-ui;margin:24px;background:#f3f4f5}section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{width:480px}</style><h1>Car shelf review</h1>${gallery}`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
