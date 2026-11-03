/**
 * Visual review of the boats on the craft shelf (lib/graph/craft-shelf/boat-*.js): each boat assembled, lowered as the
 * assembler lowers it and drawn on the World page from the side, the quarter, above and astern, with a sheet of water at
 * the waterline its weight sets (its readout's `afloat`). No database writes.
 *
 * From control/:
 *   node scripts/render-boats.mjs <output-directory> [archetype,…|all] [--pose '{"tilt":0,"yaw":0,"prop":0}'] [--fold 0…1] [--views side,quarter,top,stern,bow,motor,transom,wake] [--dry]
 *     [--look pleasure|naval] [--form [--livery <pattern|json>] [--wear pristine|used|battered]] [--deck] [--knots <n> [--live]]
 * `--form` draws the form render (craft-form.js: its livery's camo and marks, its wear), each face its albedo under a
 * plain key light; `--look` dresses it in a look card (boat-looks.js). `--deck` parks a carrier's aircraft on its flight
 * deck's spots, wings folded (vehicle-registry/carry.js `flightDeck`: what a level lays there), for review. `--knots`
 * sets it underway at that speed (craft-shelf/boat-wake.js: its wake on the water), framed on the boat, not its wake;
 * `--live` runs it round a course on the World page's live water instead (worlds/seaway-scene.js), its views the
 * page's own cameras (chase, wake, course).
 * `--fold` folds what folds (an outboard's tiller); `--dry` draws it out of the water. (The sheet of water runs through an
 * open hull's floor too: it is the review's water, not the boat's.) Writes <boat>-<view>.png, the pages, report.json and index.html.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { assembleCraft, CRAFT_ARCHETYPES } = await import('../lib/graph/craft-shelf/index.js');
const { craftForm } = await import('../lib/graph/craft-shelf/craft-form.js');
const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { renderWorldToPng } = await import('../lib/graph/scene/scene-png.js');
const { flightDeck } = await import('../lib/graph/vehicle-registry/carry.js');

const args = process.argv.slice(2);
const output = args[0];
if (!output) { console.error('Usage: node scripts/render-boats.mjs <output-directory> [archetype,…|all] [--pose json] [--views side,quarter,top,stern,bow] [--dry]'); process.exit(2); }
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const views = (flag('--views') || 'side,quarter,top,stern').split(',');
const pose = flag('--pose') ? JSON.parse(flag('--pose')) : {};
const dry = args.includes('--dry');
const fold = flag('--fold') !== null ? Number(flag('--fold')) : undefined;
// (the form render: its marks and its wear, a look card; each face its albedo under a plain key light, for review)
const live = args.includes('--live'), knots = flag('--knots') !== null ? Number(flag('--knots')) : undefined, deckFlag = args.includes('--deck'), form = args.includes('--form'), look = flag('--look') ?? undefined, livery = flag('--livery') ? (flag('--livery').startsWith('{') ? JSON.parse(flag('--livery')) : flag('--livery')) : undefined, wear = flag('--wear') ?? undefined;
const KEY = (() => { const v = [0.42, -0.5, 0.76], l = Math.hypot(...v); return v.map((x) => x / l); })();
const shadeOf = (hex, n) => { const k = 0.42 + 0.58 * Math.abs(n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]), c = parseInt(hex.slice(1), 16); return `#${[16, 8, 0].map((b) => Math.min(255, Math.round(((c >> b) & 255) * k)).toString(16).padStart(2, '0')).join('')}`; };
const avg = (hs) => { const t = [0, 0, 0]; for (const h of hs) { const c = parseInt(h.slice(1), 16); t[0] += (c >> 16) & 255; t[1] += (c >> 8) & 255; t[2] += c & 255; } return `#${t.map((v) => Math.round(v / hs.length).toString(16).padStart(2, '0')).join('')}`; };
const boats = Object.keys(CRAFT_ARCHETYPES).filter((k) => CRAFT_ARCHETYPES[k].realm === 'water');
const pick = args[1] && !args[1].startsWith('--') && args[1] !== 'all' ? args[1].split(',') : boats;
const outDir = path.resolve(output);
mkdirSync(outDir, { recursive: true });
const width = 960, height = 600;
let gallery = '';
const report = [];
for (const id of pick) {
  // (live water: the seaway page, rendered from its own cameras)
  if (live && knots) {
    const A = assembleCraft(id, { pose, underway: { knots, course: true } });
    const { payload } = await resolveWorldScene({ ref: id, kind: 'assembler', manifest: A.manifest });
    gallery += `<h2>${id} (live)</h2><p>${A.readout.underway.knots} kn, ${A.readout.underway.regime}, Fr ${A.readout.underway.froude} · loop ${A.manifest.seaway.course.loop} m · water ${payload.seaway.water.n}² over ${payload.seaway.water.size} m</p><section>`;
    for (const cam of payload.cameras.filter((c) => views.includes(c.name) || views.join() === 'side,quarter,top,stern')) {
      const html = emitThreeWorld({ ...payload, cameras: [cam], inline: true, hud: false, viewBox: { width, height } });
      writeFileSync(path.join(outDir, `${id}-live-${cam.name}.png`), await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 }));
      writeFileSync(path.join(outDir, `${id}-live-${cam.name}.html`), html);
      gallery += `<figure><a href="${id}-live-${cam.name}.html"><img alt="${id}, ${cam.name}" src="${id}-live-${cam.name}.png"></a><figcaption>${cam.name}</figcaption></figure>`;
      console.log(`Rendered ${id}-live-${cam.name}`);
    }
    gallery += '</section>';
    report.push({ id, live: true, underway: A.readout.underway, seaway: { course: A.manifest.seaway.course, water: { n: payload.seaway.water.n, size: payload.seaway.water.size }, boat: payload.seaway.boat.tris } });
    continue;
  }
  let faces, textures = {}, readout, frameOn = null;
  if (form) {
    const C = craftForm(id, { pose, ...(look ? { look } : {}), ...(livery ? { livery } : {}), ...(wear ? { wear } : {}) });
    readout = C.readout;
    faces = C.items.flatMap((it) => it.faces.map((f) => ({ corners: f.corners, outNormal: f.outNormal, fill: shadeOf(f.cornerAlbedo ? avg(f.cornerAlbedo) : f.albedo, f.outNormal) })));
  } else {
    const A = assembleCraft(id, { pose, ...(fold !== undefined ? { fold } : {}), ...(look ? { look } : {}), ...(knots ? { underway: { knots } } : {}) });
    readout = A.readout;
    const { payload } = await resolveWorldScene({ ref: id, kind: 'assembler', manifest: A.manifest });
    faces = payload.faces.filter((f) => !f.studio);
    textures = payload.textures ?? {};
    // (framed on the boat: its wake runs far past the frame)
    if (knots) frameOn = (await resolveWorldScene({ ref: id, kind: 'assembler', manifest: { ...A.manifest, items: A.manifest.items.filter((it) => it.id !== 'wake') } })).payload.faces.filter((f) => !f.studio);
  }
  // (a carrier's aircraft on its spots, wings folded: each turned to its heading, its wheels on the deck)
  const F = deckFlag ? flightDeck(id) : null;
  if (F?.holds.length) {
    const craft = F.holds[0].craft;
    let air;
    if (form) air = craftForm(craft, { pose: {}, fold: 1 }).items.flatMap((it) => it.faces.map((f) => ({ corners: f.corners, outNormal: f.outNormal, albedo: f.cornerAlbedo ? avg(f.cornerAlbedo) : f.albedo })));
    else air = (await resolveWorldScene({ ref: craft, kind: 'assembler', manifest: assembleCraft(craft, { fold: 1 }).manifest })).payload.faces.filter((f) => !f.studio);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of air) for (const c of f.corners) for (let i = 0; i < 3; i += 1) { lo[i] = Math.min(lo[i], c[i]); hi[i] = Math.max(hi[i], c[i]); }
    const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
    for (const sp of F.spots) {
      const a = (sp.heading * Math.PI) / 180, R = (v) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
      for (const f of air) {
        const corners = f.corners.map((c) => { const r = R([c[0] - cx, c[1] - cy, c[2] - lo[2]]); return [r[0] + sp.at[0], r[1] + sp.at[1], r[2] + sp.at[2]]; });
        const n = f.outNormal ? R(f.outNormal) : null;
        faces.push(form ? { corners, outNormal: n, fill: shadeOf(f.albedo, n) } : { ...f, corners, ...(n ? { outNormal: n } : {}) });
      }
    }
  }
  const tris = faces.reduce((n, f) => n + f.corners.length - 2, 0);
  const pts = (frameOn || faces).flatMap((f) => f.corners);
  // (bounds by a loop: a ship's corners are too many to spread into Math.min)
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let i = 0; i < 3; i += 1) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; }
  const mid = lo.map((v, i) => (v + hi[i]) / 2), L = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const wl = readout.afloat && !dry ? readout.afloat.waterline : lo[2];
  const sheet = (z, fill, extra = {}) => ({ corners: [[mid[0] - L * 3, mid[1] - L * 3, z], [mid[0] + L * 3, mid[1] - L * 3, z], [mid[0] + L * 3, mid[1] + L * 3, z], [mid[0] - L * 3, mid[1] + L * 3, z]], fill, ...extra });
  const scene = [...faces, dry ? sheet(lo[2] - 0.002, '#9da3a8') : sheet(wl, '#3f6f86', { alpha: 0.55, group: 'water' })];
  const cams = {
    side: [mid[0] + L * 1.5, mid[1], mid[2] + L * 0.05],
    quarter: [mid[0] + L * 0.95, mid[1] + L * 0.75, mid[2] + L * 0.5],
    top: [mid[0] + 0.01, mid[1] - L * 0.05, mid[2] + L * 1.45],
    stern: [mid[0] + L * 0.45, mid[1] - L * 0.95, mid[2] + L * 0.35],
    bow: [mid[0] - L * 0.5, mid[1] + L * 0.95, mid[2] + L * 0.3],
    motor: [mid[0] + L * 0.35, lo[1] - L * 0.25, mid[2] + L * 0.05],
    // (from astern and above, into a motor well: the notch, the splashwell, its bulkhead)
    transom: [mid[0] + L * 0.12, lo[1] - L * 0.38, hi[2] + L * 0.12],
    // (from ahead and high above, down its track: the wake it leaves)
    wake: [mid[0] + L * 0.9, mid[1] + L * 1.1, mid[2] + L * 1.6],
  };
  gallery += `<h2>${id}</h2><p>${tris.toLocaleString('en-US')} triangles · ${JSON.stringify(readout.measures)} · ${JSON.stringify(readout.afloat ?? {})}${readout.underway ? ` · underway ${readout.underway.knots} kn, ${readout.underway.regime}, Fr ${readout.underway.froude}` : ''}</p><section>`;
  for (const view of views) {
    const look = view === 'motor' ? [mid[0], lo[1] + 0.25, wl] : view === 'transom' ? [mid[0], lo[1] + L * 0.12, wl + 0.2] : view === 'wake' ? [mid[0], mid[1] - L * 1.2, wl] : mid;
    const html = emitThreeWorld({ faces: scene, textures, inline: true, hud: false, title: id, bg: '#cfd5da', metersPerUnit: 1, cameras: [{ name: view, worldFraming: { cameraPosition: cams[view], lookAt: look, horizontalFov: view === 'motor' ? 30 : view === 'wake' ? 55 : 40, pictureCenter: [width / 2, height / 2] } }], viewBox: { width, height } });
    const png = await renderWorldToPng(html, { width, height, deviceScaleFactor: 1 });
    writeFileSync(path.join(outDir, `${id}-${view}.png`), png);
    writeFileSync(path.join(outDir, `${id}-${view}.html`), html);
    gallery += `<figure><a href="${id}-${view}.html"><img alt="${id}, ${view}" src="${id}-${view}.png"></a><figcaption>${view}</figcaption></figure>`;
    console.log(`Rendered ${id}-${view} (${tris} tris)`);
  }
  gallery += '</section>';
  report.push({ id, triangles: tris, measures: readout.measures, reference: readout.reference, afloat: readout.afloat, ...(readout.underway ? { underway: readout.underway } : {}), joints: readout.joints, audit: readout.audit });
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Boats review</title><style>body{margin:0;padding:24px;background:#101722;color:#edf2f8;font:15px system-ui}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}figure{margin:0;background:#202b3b;border-radius:8px;overflow:hidden}img{width:100%;display:block}figcaption{padding:8px}p{color:#b8c4d4;font-size:13px;word-break:break-word}@media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>Boats review</h1>${gallery}</html>`);
console.log(`Review sheet: ${path.join(outDir, 'index.html')}`);
