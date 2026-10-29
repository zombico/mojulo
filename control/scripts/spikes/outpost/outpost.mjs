// AN OUTPOST BUILDING SEEN (era/stage-buildings.js, a composed bay building on open ground): one base building seated on
// a geocube's trail, captured at each hour from the approach (a walker's eye on the way to its door), wide (the building
// on its land, from up the slope), the yard (low, by its corner) and inside looking out (a ground-storey room toward its
// windows, the land beyond them). The machine gate: no page errors, the building seated (its look, its floor, how far it
// is cut into its slope), its windows open and its sun patches counted; the look is the operator's.
//
//   node scripts/spikes/outpost/outpost.mjs [--out <dir>] [--cube valley-morning] [--hours noon,dusk] [--use barracks]
//     [--look '{"construction":"military"}'] [--plan '{"wings":"I","bays":1,"loading":"single"}'] [--era gen-7]
// (the plan defaults to an outpost's: one bay of a single-loaded wing on two storeys, about 18 m by 22, which a trail's
// site holds; a base building's own plan is a level's)
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { assembleStageScene } = await import('@/lib/graph/era/stage');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'outpost')), W = 1120, H = 700;
const cube = arg('--cube', 'valley-morning'), hours = arg('--hours', 'noon,dusk').split(','), use = arg('--use', 'barracks'), era = arg('--era', 'gen-7');
const look = arg('--look', null);
fs.mkdirSync(out, { recursive: true });
const plan = JSON.parse(arg('--plan', '{"wings":"I","bays":1,"loading":"single"}'));
const building = { use, ...plan, ...(look ? { look: JSON.parse(look) } : {}) };

const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);
const addv = (a, b, k = 1) => a.map((v, i) => v + k * (b[i] ?? 0));
// the land's height near a point (the highest ground face within 3 m), so a camera stands over the slope, not in it
const groundAt = (P, p) => Math.max(0, ...P.faces.filter((f) => /:(ground|trail|top)$/.test(f.group)).map(mid).filter((m) => Math.hypot(m[0] - p[0], m[1] - p[1]) < 3).map((m) => m[2]));
// the cameras, from the building's anchor (its door, the way it faces out, its rooms) and its panes
function cams(P) {
  const A = P.anchors.find((a) => a.kind === 'building'), N = [A.N[0], A.N[1], 0], S = [-N[1], N[0], 0], z = A.floor;
  const boxes = A.rooms.map((r) => r.box), lo = [0, 1].map((k) => Math.min(...boxes.map((b) => b.min[k]))), hi = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k])));
  const centre = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, z + (hi[2] - z) / 2];
  const C = {
    approach: { pos: addv(addv([...A.at.slice(0, 2), z + 1.7], N, 16), S, 5), target: [A.at[0], A.at[1], z + 2.6], vfov: 62 },
    wide: { pos: (() => { const p = addv(addv([...A.at.slice(0, 2), 0], N, 30), S, -22); return [p[0], p[1], groundAt(P, p) + 12]; })(), target: centre, vfov: 55 },
    yard: { pos: addv(addv([...A.at.slice(0, 2), z + 1.5], N, 7), S, -14), target: [centre[0], centre[1], z + 4], vfov: 70 },
  };
  // inside: the ground-storey room with the most panes, from its far side toward them
  const panes = P.faces.filter((f) => f.group === 'stage:pane').map((f) => ({ m: mid(f), n: f.normal })).filter((p) => p.m[2] < z + 3.2);
  const inRoom = (p, b) => p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1];
  const near = (p, b) => inRoom(p, { min: [b.min[0] - 0.6, b.min[1] - 0.6], max: [b.max[0] + 0.6, b.max[1] + 0.6] });
  const best = A.rooms.filter((r) => !r.storey).map((r) => ({ r, ps: panes.filter((p) => near(p.m, r.box)) })).sort((a, b) => b.ps.length - a.ps.length)[0];
  if (best && best.ps.length) {
    const p = best.ps[Math.floor(best.ps.length / 2)], b = best.r.box, depth = Math.min(6, Math.abs(p.n[0]) > 0.5 ? b.max[0] - b.min[0] - 0.6 : b.max[1] - b.min[1] - 0.6);
    C.inside = { pos: [p.m[0] + p.n[0] * depth, p.m[1] + p.n[1] * depth, z + 1.6], target: [p.m[0] - p.n[0] * 20, p.m[1] - p.n[1] * 20, z + 2.2], vfov: 72 };
  }
  return C;
}

const pages = [];
for (const hour of hours) {
  const manifest = { kind: 'stage', geocube: cube, trail: true, hour, buildings: [building] };
  const t = Date.now(), P = assembleStageScene(manifest), B = P.buildings[0];
  console.log(`${hour.padEnd(6)} ${B.id}: look ${JSON.stringify(B.look ?? null)} floor ${B.floor} cut ${B.into} m into its slope, rough ${B.rough}; panes ${P.faces.filter((f) => f.group === 'stage:pane').length}, sun patches ${P.faces.filter((f) => f.group === 'stage:sunpatch').length}, sky cards ${P.faces.filter((f) => f.group === 'stage:sky').length} (${Date.now() - t} ms)`);
  for (const f of B.findings) console.log(`       ${f}`);
  const { payload } = await resolveWorldScene({ ref: `outpost-${hour}`, title: `${use} at ${hour}`, manifest }, { era, live: true });
  pages.push({ name: `${use}-${cube}-${hour}`, payload, cams: cams(P) });
}
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const p of pages) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  for (const [shot, cam] of Object.entries(p.cams)) {
    await page.evaluate(async (c) => { window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(c); }, cam);
    await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.name}-${shot}.png`) });
  }
  console.log(p.name, errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
  await page.close();
}
await browser.close();
process.exit(0);
