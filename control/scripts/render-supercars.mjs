/**
 * Visual review of the ODM at game, studio or hero detail. No database writes.
 * From control/: node scripts/render-supercars.mjs /workspace/vehicle-review game
 * Produces full-vehicle and detail PNGs, orbitable HTML views and a review sheet.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { composeSupercar, SUPERCAR_LIBRARY } = await import('../lib/graph/car-designer/vehicle-library.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { emitVehicleReview, vehicleReviewStats } = await import('../lib/graph/car-designer/vehicle-review.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const output = process.argv[2];
const quality = process.argv[3] || 'game';
const rendering = process.argv[4] || 'pbr';
const views = process.argv[5]?.split(',');
const presets = process.argv[6]?.split(',') || Object.keys(SUPERCAR_LIBRARY);
if(presets.some(p => !Object.hasOwn(SUPERCAR_LIBRARY,p))) throw new Error('Unknown composition preset');
if (views?.some(v => !['front','side','rear','chase','lights','mirror','cabin','spoiler','vents'].includes(v))) throw new Error('Unknown review camera');
if (!output || !['game', 'studio', 'hero'].includes(quality) || !['pbr','baked'].includes(rendering)) {
  console.error('Usage: node scripts/render-supercars.mjs <output-directory> [game|studio|hero] [pbr|baked] [front,cabin,spoiler,...] [razor,strada,...]');
  process.exit(2);
}
const outDir = path.resolve(output);
mkdirSync(outDir, { recursive: true });
const cameras = [
  ['front', [6, 7, 3.3]],
  ['side', [8, 0, 1.8]],
  ['rear', [-6, -7, 3.3]],
  ['chase', [3.8, -6.0, 2.1]],
];
const width = 960, height = 600, seed = 1014;
const report = [];
let gallery = '';
for (const preset of presets) {
  const variant = SUPERCAR_LIBRARY[preset];
  const compiled = composeSupercar({preset,seed,surface:{quality}});
  const faces = Object.values(compiled.faces).flat();
  faces.push({ corners: [[-10,-10,-0.01],[10,-10,-0.01],[10,10,-0.01],[-10,10,-0.01]], fill: '#b8b9b8' });
  gallery += `<h2>${variant.title}</h2><p>${compiled.census.triangles.toLocaleString('en-US')} / ${compiled.census.triangleBudget.toLocaleString('en-US')} triangles · ${compiled.census.materialGroups} material groups · ${compiled.headlightStyle} headlights · ${compiled.cabinStyle} cabin · ${compiled.spoilerStyle} spoiler</p><section>`;
  const focus = (part,oneSide=true) => {
    const points = faces.filter(f => (typeof part==='function'?part(f.part):f.part === part) && (!oneSide || f.corners.every(p => p[0] > 0))).flatMap(f => f.corners);
    return [0,1,2].map(i => (Math.min(...points.map(p => p[i])) + Math.max(...points.map(p => p[i]))) / 2);
  };
  const lamp = focus('lamp.front.lens'), mirror = focus('mirror.glass');
  const cabin=focus(p=>p==='body.roof'||p==='glass.screen',false);
  const spoiler=compiled.spoilerStyle==='none'?null:focus(p=>p==='aero.wing'||p==='aero.ducktail',false);
  const vents=compiled.ventStyle==='none'?null:focus(p=>p?.startsWith('vent.')&&p.endsWith('.throat'));
  const detailCameras = [
    ['lights', [lamp[0]+1, lamp[1]+1.5, lamp[2]+0.65], lamp, 38],
    ['mirror', [mirror[0]+0.9, mirror[1]-1, mirror[2]+0.45], mirror, 38],
    ['cabin', [cabin[0]+2.4,cabin[1]+2.7,cabin[2]+1.0],cabin,40],
    ...(spoiler?[['spoiler',[spoiler[0]+2.1,spoiler[1]-2.0,spoiler[2]+0.9],spoiler,42]]:[]),
    ...(vents?[['vents',[vents[0]+1.4,vents[1]+1,vents[2]+0.65],vents,38]]:[]),
  ];
  for (const [name, cameraPosition, lookAt = [0,0,0.65], horizontalFov = 42] of [...cameras, ...detailCameras].filter(([name]) => !views || views.includes(name))) {
    const stem = `${preset}-${name}`;
    const html = rendering==='pbr' ? emitVehicleReview(compiled,{title:variant.title,cameraPosition,lookAt,horizontalFov}) : emitThreeWorld({
      faces, inline: true, hud: false, title: variant.title, bg: '#d7dfe7', metersPerUnit: 1,
      cameras: [{ name, worldFraming: { cameraPosition, lookAt, horizontalFov, pictureCenter: [width/2,height/2] } }],
      viewBox: { width, height },
    });
    const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
    writeFileSync(path.join(outDir, `${stem}.html`), html);
    writeFileSync(path.join(outDir, `${stem}.png`), png);
    gallery += `<figure><a href="${stem}.html"><img alt="${variant.title}, ${name}" src="data:image/png;base64,${png.toString('base64')}"></a><figcaption>${name}</figcaption></figure>`;
    console.log(`Rendered ${stem}`);
  }
  gallery += '</section>';
  report.push({ preset, ...variant, composition:compiled.composition, cabinStyle:compiled.cabinStyle, ventStyle:compiled.ventStyle, spoilerStyle:compiled.spoilerStyle, seed, quality, rendering, headlightStyle:compiled.headlightStyle, census: compiled.census, ...(rendering==='pbr'?{renderStats:vehicleReviewStats(compiled)}:{}), laws: compiled.design.laws });
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Supercar visual review</title>
<style>body{margin:0;padding:24px;background:#101722;color:#edf2f8;font:16px system-ui}h1{font-size:26px;margin:0 0 8px}p{color:#b8c4d4}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{margin:0;background:#202b3b;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:10px}h2{font-size:19px;margin:22px 0 10px}@media(max-width:700px){section{grid-template-columns:1fr}}</style>
<h1>Supercar visual review</h1><p>Seed ${seed} · ${quality} detail · ${rendering} materials · ${views?.join(' / ') || 'front / side / rear / chase / lights / mirror / cabin / spoiler / vents'}. Select a picture to orbit its model.</p>${gallery}</html>`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
