/**
 * Visual review of the vehicle themes (car-designer/vehicle-theme.js) on the race machines. No database writes.
 * From control/: node scripts/render-themes.mjs /workspace/theme-review [candy,neon,…] [archetype] [variants]
 * Per theme: a racer (the archetype's, gloss) and a supercar (studio quality) in the lit material review
 * (vehicle-review.js: the theme's finish on the material rows), and `variants` more racers of the theme's series;
 * PNGs, the HTML beside each, and index.html. Chromium must already be installed ($MOJULO_CHROMIUM).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { THEME_IDS, readTheme, seriesTheme } = await import('../lib/graph/car-designer/vehicle-theme.js');
const { racerSpec, racerOf } = await import('../lib/graph/car-designer/roster.js');
const { racerReviewInput } = await import('../lib/graph/car-designer/racer-shade.js');
const { supercarOfSpec, themeFaces, themedMaterials } = await import('../lib/graph/car-designer/supercar-figure.js');
const { emitVehicleReview } = await import('../lib/graph/car-designer/vehicle-review.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const output = process.argv[2];
const themes = process.argv[3]?.split(',') ?? THEME_IDS;
const archetype = process.argv[4] ?? 'explorer';
const variants = Number(process.argv[5] ?? 2);
if (!output || themes.some((t) => !THEME_IDS.includes(t))) {
  console.error(`Usage: node scripts/render-themes.mjs <output-directory> [${THEME_IDS.join(',')}] [archetype] [variants]`);
  process.exit(2);
}
const outDir = path.resolve(output);
mkdirSync(outDir, { recursive: true });
const width = 640, height = 420, esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const frame = (faces, k = 1) => {
  const all = faces.flatMap((f) => f.corners), ys = all.map((p) => p[1]), top = Math.max(...all.map((p) => p[2]));
  const lookAt = [0, (Math.min(...ys) + Math.max(...ys)) / 2, top * 0.45];
  return { lookAt, cameraPosition: [2.2 * top * k, lookAt[1] - 3.2 * top * k, lookAt[2] + 1.4 * top * k] };
};
let gallery = '';
for (const name of themes) {
  const T = readTheme(name);
  gallery += `<h2>${esc(name)}</h2><p>${esc(T.reads ?? '')}</p><section>`;
  const shots = [];
  for (let k = 0; k <= variants; k++) {
    const { S } = racerOf(racerSpec({ archetype, seed: 5, theme: seriesTheme(name, k) }, 0, 1));
    const input = racerReviewInput(S), faces = Object.values(input.faces).flat();
    shots.push([`${name}-racer-${k}`, emitVehicleReview(input, { title: `${name} racer ${k ? `variant ${k}` : ''}`, ...frame(faces), horizontalFov: 34 }), k ? `racer, variant ${k}` : 'racer']);
  }
  const { car, theme } = supercarOfSpec({ theme: name, surface: { line: 'streamline' } }, { quality: 'studio' });
  const faces = { body: themeFaces(car.faces.body, theme, car), detail: themeFaces(car.faces.detail, theme, car), wheels: themeFaces(car.faces.wheels, theme, car) };
  const materials = themedMaterials(car, theme);
  shots.push([`${name}-supercar`, emitVehicleReview({ faces, materials, census: car.census }, { title: `${name} supercar`, cameraPosition: [6, -7, 3.3], lookAt: [0, 0, 0.65], horizontalFov: 42 }), 'supercar']);
  for (const [stem, html, caption] of shots) {
    const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
    writeFileSync(path.join(outDir, `${stem}.html`), html);
    writeFileSync(path.join(outDir, `${stem}.png`), png);
    gallery += `<figure><a href="${stem}.html"><img alt="${esc(name)}, ${esc(caption)}" src="${stem}.png"></a><figcaption>${esc(caption)}</figcaption></figure>`;
  }
  gallery += '</section>';
  console.log(`${name}: ${shots.length} views`);
}
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Theme review</title>
<style>body{margin:24px;font:14px system-ui;background:#eef1f4;color:#263343}section{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{width:${width / 2}px;border-radius:4px}figcaption{font-size:12px}</style></head>
<body><h1>Theme review</h1><p>The ${esc(archetype)}'s racer in each theme and its series' first variations, and a supercar, in the lit material review.</p>${gallery}</body></html>`);
