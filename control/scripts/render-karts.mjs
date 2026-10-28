/**
 * Visual review of cartoon racers, cel against smooth. No database writes.
 * From control/: node scripts/render-karts.mjs /workspace/kart-review [innocent,outlaw,ruler] [seed]
 * Per racer: the chase view in the World renderer for each shade, and the smooth one in the lit material review
 * (vehicle-review.js); PNGs, the HTML beside each, and index.html with the census. Chromium must already be installed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { rollEgocube } = await import('../lib/graph/egocube/egocube.js');
const { ARCHETYPES } = await import('../lib/graph/egocube/facets.js');
const { racerFromSheet, solveRacer, SHADES } = await import('../lib/graph/car-designer/racer.js');
const { racerReviewInput } = await import('../lib/graph/car-designer/racer-shade.js');
const { emitVehicleReview } = await import('../lib/graph/car-designer/vehicle-review.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const output = process.argv[2];
const archetypes = process.argv[3]?.split(',') ?? ['innocent', 'outlaw', 'ruler'];
const seed = Number(process.argv[4] ?? 3);
if (!output || archetypes.some((a) => !Object.hasOwn(ARCHETYPES, a)) || !Number.isInteger(seed)) {
  console.error(`Usage: node scripts/render-karts.mjs <output-directory> [${Object.keys(ARCHETYPES).slice(0, 3).join(',')},...] [seed]`);
  process.exit(2);
}
const outDir = path.resolve(output);
mkdirSync(outDir, { recursive: true });
const width = 720, height = 480, esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
let gallery = '';
const report = [];
for (const archetype of archetypes) {
  const R = racerFromSheet(rollEgocube({ facets: { archetype }, seed: 11 }), { seed });
  gallery += `<h2>${esc(archetype)} · ${esc(R.vehicle.facets.motif)} ${esc(R.vehicle.facets.silhouette)}</h2><section>`;
  for (const shade of SHADES) {
    const S = solveRacer(R, { seed, shade });
    const faces = [S.faces.root, ...S.faces.wheels.map((w) => w.faces), ...S.faces.bones.map((b) => b.faces)].flat();
    const ys = faces.flatMap((f) => f.corners.map((p) => p[1])), top = Math.max(...faces.flatMap((f) => f.corners.map((p) => p[2])));
    const lookAt = [0, (Math.min(...ys) + Math.max(...ys)) / 2, top * 0.45], cameraPosition = [2.2 * top, lookAt[1] - 3.2 * top, lookAt[2] + 1.4 * top];
    const shots = [[`${archetype}-${shade}`, emitThreeWorld({
      faces: [...faces, { corners: [[-20, -20, -0.005], [20, -20, -0.005], [20, 20, -0.005], [-20, 20, -0.005]], fill: '#b8b9b8' }],
      inline: true, hud: false, title: `${archetype} ${shade}`, bg: '#d7dfe7', metersPerUnit: 1,
      cameras: [{ name: 'chase', worldFraming: { cameraPosition, lookAt, horizontalFov: 34, pictureCenter: [width / 2, height / 2] } }],
      viewBox: { width, height },
    }), shade]];
    if (shade !== 'cel') shots.push([`${archetype}-${shade}-material`, emitVehicleReview(racerReviewInput(S), { title: `${archetype} material review`, cameraPosition, lookAt, horizontalFov: 34 }), 'material review']);
    for (const [stem, html, caption] of shots) {
      const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
      writeFileSync(path.join(outDir, `${stem}.html`), html);
      writeFileSync(path.join(outDir, `${stem}.png`), png);
      gallery += `<figure><a href="${stem}.html"><img alt="${esc(archetype)}, ${esc(caption)}" src="${stem}.png"></a><figcaption>${esc(caption)} · ${S.census.faces.toLocaleString('en-US')} / ${S.census.faceBudget.toLocaleString('en-US')} faces · ${S.census.triangles.toLocaleString('en-US')} triangles</figcaption></figure>`;
    }
    report.push({ archetype, shade, motif: R.vehicle.facets.motif, census: S.census, laws: S.laws });
  }
  gallery += '</section>';
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kart review</title>
<style>body{margin:24px;font:14px system-ui;background:#eef1f4;color:#263343}section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{width:${width / 2}px;border-radius:4px}figcaption{font-size:12px}</style></head>
<body><h1>Kart review: cel and smooth</h1><p>Seed ${seed}. The World renderer's chase view for each shade, and the smooth racer in the lit material review.</p>${gallery}</body></html>`);
console.log(`wrote ${report.length} racer views to ${outDir}`);
