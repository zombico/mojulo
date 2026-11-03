/**
 * Visual review of the rail shelf's cab cars (lib/graph/rail-shelf/): each card composed, finished and drawn on a
 * stretch of track in the vehicle ODM's physically lit review page (car-designer/vehicle-review.js), from the front
 * quarter, the side, at the nose and under it at the bogie. No database writes.
 *
 * From control/:
 *   node scripts/render-rail.mjs <output-directory> [game|studio|hero] [preset,…] [views: quarter,side,nose,bogie,rear]
 * A preset may be a bogie's archetype (bogie-odm.js), drawn alone on its track: views quarter, side, top, end, spun
 * (its wheels turned a quarter and swung 6° on its pivot); or a pantograph's (panto-odm.js), on a roof plate under its
 * wire: views folded, half, raised (to the wire), quarter. A cab car with pantographs runs under a catenary at
 * `RAIL_WIRE` metres (5.6), its pantographs raised to it. A preset may also be a car's archetype (car-odm.js), drawn
 * alone (quarter, side, end), or `train:<family>` (consist.js), the whole train coupled (side, quarter, coupling, tail).
 * Writes <preset>-<view>.png, the pages, report.json and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { composeCab, CAB_LIBRARY, finishRailFaces, compileBogieSurface, BOGIE_KINDS, RAIL_MATERIALS, compilePantoSurface, PANTO_KINDS, compileCatenary, compileCarSurface, CAR_KINDS, composeTrain, TRAIN_PLANS } = await import('../lib/graph/rail-shelf/index.js');
const { emitVehicleReview } = await import('../lib/graph/car-designer/vehicle-review.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');

const [output, quality = 'studio', presetArg, viewArg] = process.argv.slice(2);
if (!output) { console.error('Usage: node scripts/render-rail.mjs <output-directory> [game|studio|hero] [preset,…] [views]'); process.exit(2); }
const presets = presetArg ? presetArg.split(',') : Object.keys(CAB_LIBRARY), views = (viewArg || 'quarter,side,nose,bogie').split(',');
const outDir = path.resolve(output); mkdirSync(outDir, { recursive: true });
const width = 960, height = 600, report = [], r2 = (v) => Math.round(v * 100) / 100;
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
  if (BOGIE_KINDS.includes(preset)) {
    const vs = viewArg ? views.filter((v) => ['quarter', 'side', 'top', 'end', 'spun'].includes(v)) : ['quarter', 'side', 'top', 'end', 'spun'];
    gallery += `<h2>${preset} bogie</h2><section>`;
    for (const v of vs) {
      const b = compileBogieSurface({ seed: 11, archetype: preset }, { quality, lead: true, pose: v === 'spun' ? { spin: 90, yaw: 6 } : {} }), dd = b.design;
      const compiled = { faces: { ...b.faces, track: track(dd.base + 1) }, materials: RAIL_MATERIALS, census: b.census };
      const k = 1.6 * Math.max(1, dd.base / 2.2), cam = { quarter: [[2.4 * k, 2.6 * k, 1.5 * k], [0, 0, 0.55], 40], side: [[4.4 * k, 0, 0.7], [0, 0, 0.55], 40], top: [[0.01, 0, 4.8 * k], [0, 0, 0.4], 44],
        end: [[0.6, 4.2 * k, 0.9], [0, 0, 0.55], 40], spun: [[2.4 * k, 2.6 * k, 1.5 * k], [0, 0, 0.55], 40] }[v];
      const html = emitVehicleReview(compiled, { title: `${preset} bogie`, cameraPosition: cam[0], lookAt: cam[1], horizontalFov: cam[2] });
      writeFileSync(path.join(outDir, `${preset}-${v}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
      writeFileSync(path.join(outDir, `${preset}-${v}.html`), html);
      gallery += `<figure><a href="${preset}-${v}.html"><img alt="${preset}, ${v}" src="${preset}-${v}.png"></a><figcaption>${v}</figcaption></figure>`;
      console.log(`Rendered ${preset}-${v}`);
      if (v === vs[0]) report.push({ preset, design: dd, census: b.census, hardpoints: b.hardpoints });
    }
    gallery += '</section>';
    continue;
  }
  if (CAR_KINDS.includes(preset)) {
    const c = compileCarSurface({ seed: 11, archetype: preset }, { quality }), dd = c.design, L = dd.frame.length;
    const compiled = { ...c, faces: { ...c.faces, track: track(L) } };
    const vs = viewArg ? views.filter((v) => ['quarter', 'side', 'end'].includes(v)) : ['quarter', 'side', 'end'];
    gallery += `<h2>${preset}</h2><p>${c.census.triangles.toLocaleString('en-US')} triangles · ${L} m · laws ${dd.valid ? 'held' : 'failed'}</p><section>`;
    for (const v of vs) {
      const cam = { quarter: [[L * 0.45 + 4, L * 0.55 + 4, 4], [0, 0, 1.8], 40], side: [[L * 0.95 + 6, 0, 2.2], [0, 0, 1.9], 40], end: [[3.2, L / 2 + 6, 3], [0, L / 2, 1.7], 42] }[v];
      const html = emitVehicleReview(compiled, { title: preset, cameraPosition: cam[0], lookAt: cam[1], horizontalFov: cam[2] });
      writeFileSync(path.join(outDir, `${preset}-${v}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
      writeFileSync(path.join(outDir, `${preset}-${v}.html`), html);
      gallery += `<figure><a href="${preset}-${v}.html"><img alt="${preset}, ${v}" src="${preset}-${v}.png"></a><figcaption>${v}</figcaption></figure>`;
      console.log(`Rendered ${preset}-${v}`);
    }
    gallery += '</section>';
    report.push({ preset, design: c.design, census: c.census });
    continue;
  }
  if (preset.startsWith('train:') && TRAIN_PLANS[preset.slice(6)]) {
    const fam = preset.slice(6), WIRE = Number(process.env.RAIL_WIRE) || 5.6, probe = composeCab({ preset: Object.keys(CAB_LIBRARY).find((k) => CAB_LIBRARY[k].brief.archetype === TRAIN_PLANS[fam].cab), surface: { quality: 'game' } });
    const hasP = (probe.design.pantographs || []).length > 0;
    const T = composeTrain({ family: fam, seed: 11, quality: 'game', ...(hasP ? { pose: { wire: WIRE } } : {}) }), L = T.length, mid = -L / 2 + T.vehicles[0].length / 2;
    const tr = track(L * 2).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y + mid, z]) }));
    const compiled = { faces: { ...T.faces, track: tr, ...(hasP ? compileCatenary({ length: L + 40, height: WIRE, quality: 'game', y0: -L - 20 }).faces : {}) }, materials: T.materials, census: T.census };
    const c1 = T.vehicles[0].y - T.vehicles[0].length / 2 - T.couplings[0].gap / 2, tip = probe.design.anchors.tip;
    const vs = viewArg ? views.filter((v) => ['side', 'quarter', 'coupling', 'tail'].includes(v)) : ['side', 'quarter', 'coupling', 'tail'];
    gallery += `<h2>${fam} train</h2><p>${T.vehicles.length} vehicles · ${L} m · ${T.census.triangles.toLocaleString('en-US')} triangles · laws ${T.valid ? 'held' : 'failed'}</p><section>`;
    for (const v of vs) {
      const cam = { side: [[L * 0.62, mid, 3], [0, mid, 1.9], 52], quarter: [[14, tip + 18, 6.5], [0, tip - 30, 1.8], 44], coupling: [[3.6, c1 + 3.2, 2.4], [0, c1, 1.4], 44],
        tail: [[6, -L + tip - 10, 4.2], [0, -L + tip + 10, 1.8], 44] }[v];
      const html = emitVehicleReview(compiled, { title: `${fam} train`, cameraPosition: cam[0], lookAt: cam[1], horizontalFov: cam[2] });
      writeFileSync(path.join(outDir, `train-${fam}-${v}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
      writeFileSync(path.join(outDir, `train-${fam}-${v}.html`), html);
      gallery += `<figure><a href="train-${fam}-${v}.html"><img alt="${fam}, ${v}" src="train-${fam}-${v}.png"></a><figcaption>${v}</figcaption></figure>`;
      console.log(`Rendered train-${fam}-${v}`);
    }
    gallery += '</section>';
    report.push({ preset, plan: T.plan, vehicles: T.vehicles, couplings: T.couplings, laws: T.laws, census: T.census });
    continue;
  }
  if (PANTO_KINDS.includes(preset)) {
    const vs = viewArg ? views.filter((v) => ['folded', 'half', 'raised', 'quarter'].includes(v)) : ['folded', 'half', 'raised', 'quarter'];
    const roofZ = 4.0, wire = 5.7;
    gallery += `<h2>${preset} pantograph</h2><section>`;
    for (const v of vs) {
      const pose = v === 'folded' ? { raise: 0 } : v === 'half' ? { raise: 0.45 } : { wire: wire - roofZ };
      const pc = compilePantoSurface({ seed: 11, archetype: preset }, { quality, pose });
      const lift = (fs) => fs.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y, z + roofZ]) }));
      const plate = finishRailFaces([{ corners: [[-1.4, -3, roofZ], [1.4, -3, roofZ], [1.4, 3, roofZ], [-1.4, 3, roofZ]], part: 'body.roof', fill: '#9aa0a5', outNormal: [0, 0, 1] }]);
      const cat = compileCatenary({ length: 60, height: wire, quality, y0: -30 });
      const compiled = { faces: { panto: lift(Object.values(pc.faces).flat()), plate, ...cat.faces }, materials: RAIL_MATERIALS, census: pc.census };
      const cam = { folded: [[4.6, 0.4, roofZ + 0.8], [0, 0, roofZ + 0.5], 40], half: [[4.8, 0.4, roofZ + 1.5], [0, 0, roofZ + 1.1], 42], raised: [[5.6, 0.6, roofZ + 1.8], [0, 0, roofZ + 1.0], 44],
        quarter: [[3.6, 4.2, roofZ + 2.4], [0, 0, roofZ + 0.9], 44] }[v];
      const html = emitVehicleReview(compiled, { title: `${preset} pantograph`, cameraPosition: cam[0], lookAt: cam[1], horizontalFov: cam[2] });
      writeFileSync(path.join(outDir, `${preset}-${v}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
      writeFileSync(path.join(outDir, `${preset}-${v}.html`), html);
      gallery += `<figure><a href="${preset}-${v}.html"><img alt="${preset}, ${v}" src="${preset}-${v}.png"></a><figcaption>${v} · contact ${r2(pc.pose.contact + roofZ)} m</figcaption></figure>`;
      console.log(`Rendered ${preset}-${v}`);
      if (v === vs[0]) report.push({ preset, design: pc.design, census: pc.census });
    }
    gallery += '</section>';
    continue;
  }
  const WIRE = Number(process.env.RAIL_WIRE) || 5.6, hasP = (composeCab({ preset, seed: 11, surface: { quality: 'game' } }).design.pantographs || []).length > 0;
  const c = composeCab({ preset, seed: 11, surface: { quality, ...(hasP ? { pose: { wire: WIRE } } : {}) } }), d = c.design, L = d.frame.length, tip = d.anchors.tip;
  const compiled = { ...c, faces: { ...c.faces, track: track(L), ...(hasP ? compileCatenary({ length: L + 30, height: WIRE, quality, y0: -L / 2 - 10 }).faces : {}) } };
  const yB = d.frame.bogies[0];
  const cams = {
    quarter: [[L * 0.32 + 4, tip + L * 0.42 + 4, 3.4], [0, tip - L * 0.25, 1.8], 40],
    side: [[L * 0.95 + 6, 0, 2.2], [0, 0, 1.9], 40],
    nose: [[3.6, tip + 4.6, 2.6], [0, tip - Math.min(2, d.front.nose * 0.5), 1.9], 42],
    bogie: [[3.4, yB + 2.2, 0.9], [0, yB, 0.6], 44],
    rear: [[4, -L / 2 - 7, 3], [0, -L / 2 + 3, 2], 40],
    roof: [[5.5, (d.pantographs?.[0]?.y ?? 0) + 5, d.frame.height + 2.6], [0, d.pantographs?.[0]?.y ?? 0, d.frame.height + 0.8], 44],
  };
  gallery += `<h2>${CAB_LIBRARY[preset].title}</h2><p>${c.census.triangles.toLocaleString('en-US')} triangles · ${c.census.materialGroups} materials · ${L} m long, ${d.frame.width} m wide, ${d.frame.height} m high · laws ${d.laws.every((l) => l.pass) ? 'held' : 'failed'}</p><section>`;
  for (const v of views.filter((x) => cams[x])) {
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
