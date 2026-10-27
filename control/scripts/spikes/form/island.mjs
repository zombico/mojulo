// THE PATHLESS ISLAND, READ IN THE FORM RENDER (gen-7's first composed scene): the geocube island's land, one recipe,
// drawn twice from the same camera. Left, gen-6: each face's fill, the light baked in, drawn unlit (as the World page
// draws it). Right, gen-7: each face's material (form/land-form.js over the bases the palette solves, era/cube-light.js:
// the cube's colours are targets, the base colours and one light solved to show them), lit by that sun and sky light at
// the cube's hour, its shadow map drawn once; the sea a glossy surface with the sky in it, the sand under its line wet.
// The sun can be moved to show the right side is lit (never to animate the hour).
// `window.measure()` is the machine gate: cliff faces turned to the hour's sun against those turned away, wet sand
// against dry, in both halves, and the shadow passes drawn; with `swatches`, a patch of each role square to the sun and
// one under the sky alone, read off the screen against the palette's targets. The look is the operator's.
//
// `--show trail` lays the island from a seed (`--seed`) and its trail, drawn as the path layer worn into the ground.
//
// `--hour` reads the island at another hour (a number 0–24 or a word: dawn … night, the moon the key after dark): the
// bases the palette solves stay as at the cube's own hour, only the light moves. `--stone` writes the rock's colour (a
// lock over the preset's or the palette's).
//
//   node scripts/spikes/form/island.mjs [--out <file.html>] [--cube island-noon] [--palette <seed>] [--hour <h>] [--stone #rrggbb] [--show land|trail] [--seed <n>] [--cdn]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { readGeocube, GEOCUBE_PALETTES } = await import('../../../lib/graph/era/geocube.js');
const { cubeLight } = await import('../../../lib/graph/era/cube-light.js');
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const { solveMirror, seen, decodeSrgb, encodeSrgb } = await import('../../../lib/graph/color-theorist/light.js');
const { landForm, LAND_CLASSES, DEEP_FADE, DEEP_TONE, UNDER_TONE, WET_BAND, WET_TONE, WET_ROUGH } = await import('../../../lib/graph/form/land-form.js');
const { b64, safeJson, CDN_IMPORTMAP, inlineImportmap } = await import('../../../lib/graph/scene/emit-util.js');
const { dressedMaterial, screeDice } = await import('../../../lib/graph/matte-paint/dressed.js');
const { encodePng } = await import('../../../lib/graph/landscape/surface-textures.js');
const { landLayers, LAYER_OF } = await import('../../../lib/graph/form/land-layers.js');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'island.html')), id = arg('--cube', 'island-noon'), seed = arg('--palette'), cdn = process.argv.includes('--cdn');
const show = arg('--show', 'land'), landSeed = Number(arg('--seed', 1));
// (a seeded palette as the game design loop stamps it: the preset's character, the seed)
const stone = arg('--stone'), hourArg = arg('--hour'), hour = hourArg === undefined ? undefined : /^[\d.]+$/.test(hourArg) ? Number(hourArg) : hourArg;
const cube = seed === undefined && !stone ? id : { from: id, ...(seed === undefined ? {} : { palette: { ...GEOCUBE_PALETTES[id], seed: Number(seed) } }), ...(stone ? { colour: { stone } } : {}) };

const { payload: P } = await resolveWorldScene({ title: 'island', manifest: { kind: 'geocube', cube, show, ...(show === 'land' ? {} : { seed: landSeed }), ...(hour === undefined ? {} : { hour }) } }, {});
const { HOUR_WORDS } = await import('../../../lib/graph/era/geocube-hours.js');
const C = readGeocube(cube), own = cubeLight(C), light = hour === undefined ? own : cubeLight(C, { hour: typeof hour === 'string' ? HOUR_WORDS[hour] : hour }), sun = light.sun.dir;
// THE SEA, a mirror over a body: from the island camera's view down onto it, the palette's sea colour is what the sky it
// reflects (the dome at that angle, as the page draws it) and its body under the light show together, the floor under
// it showing through its alpha (the deep water's colour, the body's own: solved twice)
const isleCam = P.cameras.find((c) => c.name === 'island').worldFraming, [cx, cy, cz] = isleCam.cameraPosition, [lx, ly, lz] = isleCam.lookAt;
const view = (Math.atan2(cz - lz, Math.hypot(cx - lx, cy - ly)) * 180) / Math.PI, up = Math.sin((view * Math.PI) / 180) ** 0.6;
const lin = (c) => c.map((v) => decodeSrgb(v / 255)), hexL = (c) => '#' + c.map((v) => Math.round(encodeSrgb(Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
// (solved at the cube's own hour, as every base is: at another hour the sea keeps its body and the light moves)
const sees = hexL(lin(own.sky.horizon).map((v, k) => v * (1 - up) + lin(own.sky.zenith)[k] * up));
const at = { ambient: own.ambient.linear, sun: own.sun.linear }, mirror = (under) => solveMirror({ target: C.colour.water, sees, view, light: at, cos: own.sun.dir[2], alpha: 0.9, under });
let water = mirror('#000000');
water = mirror(seen(water.base.map((v) => v * DEEP_TONE), at, 0));
const bases = { ...light.bases, water: hexL(water.base) };
const L = landForm(P.faces, bases, { seed: 1 });

// THE LAYERED GROUND (the plan's phase 2, form/land-layers.js): every land corner carries a weight for each natural layer
// (rock, scree, soil, sand) and the path is a mask at its own resolution over the trail; the renderer blends the layers'
// materials by them, by height. A layer's texture modulates its palette-solved base about its own mean, so the palette's
// colours hold on average.
const LAYERS = [
  { id: 'rock', cut: 'crag', metres: 4, role: 'stone' }, { id: 'scree', cut: 'scree', metres: 4, role: 'stone' },
  { id: 'soil', cut: 'soil', metres: 1.5, role: 'floor' }, { id: 'sand', cut: 'sand', metres: 1.5, role: 'sand' },
  { id: 'path', cut: 'path', metres: 1.5, role: 'floor' }];
const TEX = 512, AW = TEX * 3, AH = TEX * 2, LY = landLayers(P.faces, L, { seed: 3 }), layered = (F, i) => LY.layered(i) && !!F;
const A = { base: Buffer.alloc(AW * AH * 3), normal: Buffer.alloc(AW * AH * 3), orm: Buffer.alloc(AW * AH * 3) }, means = [];
LAYERS.forEach((Ly, li) => {
  const M = dressedMaterial({ cut: Ly.cut, metres: Ly.metres, stone: [170, 160, 140], grit: 0.5 }, { size: TEX, seed: 3, rough: 0.9 });
  let lo = Infinity, hi = -Infinity; for (const v of M.height) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const ox = (li % 3) * TEX, oy = Math.floor(li / 3) * TEX, sum = [0, 0, 0];
  for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++) {
    const k = j * TEX + i, o = ((oy + j) * AW + ox + i) * 3;
    for (let c = 0; c < 3; c++) { A.base[o + c] = M.baseColor[k * 3 + c]; A.normal[o + c] = M.normal[k * 3 + c]; sum[c] += decodeSrgb(M.baseColor[k * 3 + c] / 255); }
    A.orm[o] = M.orm[k * 3]; A.orm[o + 1] = M.orm[k * 3 + 1]; A.orm[o + 2] = Math.round(((M.height[k] - lo) / Math.max(1e-9, hi - lo)) * 255);
  }
  means.push(sum.map((v) => Math.round((v / (TEX * TEX)) * 1e4) / 1e4));
});
const png = (b) => `data:image/png;base64,${encodePng(b, AW, AH).toString('base64')}`;
// the scree's dice (matte-paint/dressed.js `screeDice`, the same tile): each stone's own, 1 between them, so a scree
// thinning out keeps whole stones by their dice and the ground shows between (era/scree-tiles.js, 6.5's edge)
const SC = LAYERS.find((Ly) => Ly.id === 'scree'), dice = screeDice({ cut: 'scree', metres: SC.metres, stone: [170, 160, 140], grit: 0.5 }, { size: TEX, seed: 3 });
const dicePng = `data:image/png;base64,${encodePng(Buffer.from(Array.from(dice, (v) => Math.round((v >= 0 ? Math.min(0.99, v) : 1) * 255)).flatMap((v) => [v, v, v])), TEX, TEX).toString('base64')}`;
// the path's mask as the page reads it: the weight a byte, the trail's height two (over the trail's own span)
const PM = LY.path, pathTex = PM && (() => {
  let zlo = Infinity, zhi = -Infinity; for (let k = 0; k < PM.z.length; k++) if (PM.weight[k] > 0) { zlo = Math.min(zlo, PM.z[k]); zhi = Math.max(zhi, PM.z[k]); }
  const span = Math.max(1e-6, zhi - zlo), px = new Uint8Array(PM.weight.length * 4);
  for (let k = 0; k < PM.weight.length; k++) { const q = Math.round(((PM.z[k] - zlo) / span) * 65535); px[k * 4] = Math.round(PM.weight[k] * 255); px[k * 4 + 1] = q >> 8; px[k * 4 + 2] = q & 255; px[k * 4 + 3] = 255; }
  return { origin: PM.origin, size: PM.size, metres: PM.size.map((n) => n * PM.cell), cell: PM.cell, z: [zlo, span], px: b64(px) };
})();
const roleBase = LAYERS.map((Ly) => hexRgb(bases[Ly.role]));
// the sand under the line, corner by corner, as form/land-form.js fades it into the deep water's colour: every sand
// face, the ones the line crosses too, so the sand meets its shallows without a step at a face's edge
const sandZ = P.faces.flatMap((f, i) => (L.faces[i].cls === 'sand' ? f.corners.map((c) => c[2]) : []));
const FADE = L.waterZ === null ? DEEP_FADE : Math.max(DEEP_FADE, L.waterZ - Math.min(L.waterZ, ...sandZ)), sandBase = hexRgb(bases.sand);
const underAt = (z) => { const lost = Math.min(1, Math.max(0, (L.waterZ - z) / FADE)) ** 2; return sandBase.map((v, c) => Math.round(v * UNDER_TONE * (1 - lost) + L.deep[c] * lost)); };

// faces ordered by their material (a class, wet or dry), triangulated as fans, each corner carrying both halves' colours
// and the gate's bucket: 1 a cliff turned to the hour's sun, 2 one turned away, 3 wet sand, 4 dry sand
const keyOf = (i) => { const F = L.faces[i]; return F.cls ? `${F.cls}${F.under ? ':under' : F.wet ? ':wet' : ''}` : 'unread'; };
const order = P.faces.map((_, i) => i).sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : a - b));
const dot = (n) => n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
// and the seen laws' id: the role a face shows (cliff and rock the stone, ground the grass, dry sand, the trail the floor,
// the sea) × 4, + 1 turned to the hour's sun (within ~40° of square to it: the palette's lit colour is a face square to the
// sun, so a steep face lit at a glance is not compared with a flat one), 2 turned away
const SEEN_ROLES = ['stone', 'grass', 'sand', 'floor', 'water'], roleOf = { cliff: 'stone', rock: 'stone', scree: 'stone', ground: 'grass', soil: 'floor', sand: 'sand', trail: 'floor', water: 'water' };
// the land SHADED SMOOTH (6.5's lesson: a faceted ground draws its faces' edges through every transition): a corner's
// normal the mean of the faces round it that lie within CREASE of the face's own, so a cliff's edge stays crisp
const CREASE = Math.cos((55 * Math.PI) / 180), nKey = (c) => `${Math.round(c[0] * 100)},${Math.round(c[1] * 100)},${Math.round(c[2] * 100)}`, NB = new Map();
P.faces.forEach((f, i) => { if (!L.faces[i].cls || L.faces[i].cls === 'water' || L.faces[i].under) return; const n = f.normal || [0, 0, 1]; for (const c of f.corners) (NB.get(nKey(c)) ?? NB.set(nKey(c), []).get(nKey(c))).push(n); });
const smoothAt = (c, n) => { const m = [0, 0, 0]; for (const q of NB.get(nKey(c)) || [n]) if (q[0] * n[0] + q[1] * n[1] + q[2] * n[2] >= CREASE) { m[0] += q[0]; m[1] += q[1]; m[2] += q[2]; } const l = Math.hypot(...m) || 1; return m.map((v) => Math.round((v / l) * 127)); };
const pos = [], c6 = [], c7 = [], bk = [], sid = [], spl = [], nrm = [], ranges = [];
for (const i of order) {
  const f = P.faces[i], F = L.faces[i], key = keyOf(i), n = f.normal || [0, 0, 1];
  const bucket = F.cls === 'cliff' ? (dot(n) >= 0.5 ? 1 : dot(n) <= 0.05 ? 2 : 0) : F.cls === 'sand' && !F.under ? (F.wet ? 3 : 4) : 0;
  const role = F.cls && !F.under && !F.wet ? SEEN_ROLES.indexOf(roleOf[F.cls]) + 1 : 0, facing = dot(n) >= 0.75 ? 1 : dot(n) <= 0.05 ? 2 : 0;
  const seenId = role && facing ? role * 4 + facing : 0;
  const fills = f.cornerFills || f.corners.map(() => f.fill), alpha = f.cornerAlpha || f.corners.map(() => 1);
  // (a layered face's corner: its layers' weights, and its base their solved bases by weight; wet sand keeps its own)
  const wAt = (j) => (layered(F, i) ? LY.weightAt(f.corners[j]) : F.under ? [0, 0, 0, 1] : [0, 0, 0, 0]);
  const base = F.cls ? F.base : hexRgb(f.fill), baseAt = (j) => (F.cls === 'sand' && L.waterZ !== null && f.corners[j][2] <= L.waterZ ? underAt(f.corners[j][2]) : F.corners ? F.corners[j] : layered(F, i) ? [0, 1, 2].map((c) => Math.round(wAt(j).reduce((s, x, li) => s + x * roleBase[li][c], 0))) : base);
  let R = ranges[ranges.length - 1];
  if (!R || R.key !== key) ranges.push(R = { key, start: pos.length / 3, count: 0, rough: F.cls ? F.rough : 0.9 });
  for (let k = 1; k + 1 < f.corners.length; k++) for (const j of [0, k, k + 1]) {
    pos.push(...f.corners[j]); c6.push(...hexRgb(fills[j]), Math.round(alpha[j] * 255)); c7.push(...baseAt(j), Math.round(alpha[j] * 255)); bk.push(bucket); sid.push(seenId); spl.push(...wAt(j).map((x) => Math.round(x * 255))); nrm.push(...smoothAt(f.corners[j], n)); R.count += 1;
  }
}
// the shadow's frame: what stands above the water, not the sea's floor or the sea to the horizon
const land = P.faces.filter((f, i) => L.faces[i].cls && L.faces[i].cls !== 'water' && !L.faces[i].under).flatMap((f) => f.corners);
const sea = P.faces.filter((f, i) => L.faces[i].cls === 'water').flatMap((f) => f.corners), seaX = sea.map((c) => c[0]), seaY = sea.map((c) => c[1]);
const box = [0, 1, 2].map((k) => [Math.min(...land.map((c) => c[k])), Math.max(...land.map((c) => c[k]))]);
// the SHORE: a camera standing on the wet line looking along the beach, and a low sun ahead along it (where a glint shows
// and the island, to one side, shades nothing); the beach chosen in code, the wet face furthest out on the island
// camera's side
const isle = P.cameras.find((c) => c.name === 'island')?.worldFraming.lookAt || [0, 0, 0];
const wetMids = P.faces.flatMap((f, i) => (L.faces[i].wet && !L.faces[i].under ? [[0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length)] : []));
const shoreAt = wetMids.reduce((a, m) => (m[0] > a[0] ? m : a), wetMids[0]);
const out2 = [shoreAt[0] - isle[0], shoreAt[1] - isle[1]], ol = Math.hypot(...out2), d2 = out2.map((v) => v / ol);
const along = [-d2[1], d2[0]];
const shore = { name: 'shore', cameraPosition: [shoreAt[0] + d2[0], shoreAt[1] + d2[1], shoreAt[2] + 1.7], lookAt: [shoreAt[0] + along[0] * 25, shoreAt[1] + along[1] * 25, L.waterZ], horizontalFov: 70 };
// the BORDERS: a camera over the mound's foot looking down its scree onto the soil, and one over the top of the beach
// looking along it, each at the corner where the layers meet most (chosen in code from the weights)
const corners = P.faces.flatMap((f, i) => (LY.layered(i) && !L.faces[i].wet ? f.corners.map((c) => ({ c, w: LY.weightAt(c) })) : []));
const best = (score) => corners.reduce((a, q) => (score(q.w) > score(a.w) ? q : a), corners[0]).c;
const footAt = best((w) => Math.min(w[1], w[2]) * (w[0] === 0 ? 1 : 0)), beachAt = best((w) => Math.min(w[2], w[3]) * (w[1] < 0.05 ? 1 : 0));
const closeOn = (name, q, back, high) => { const o = [q[0] - isle[0], q[1] - isle[1]], l = Math.hypot(...o) || 1, d = o.map((v) => v / l); return { name, cameraPosition: [q[0] + d[0] * back, q[1] + d[1] * back, q[2] + high], lookAt: [q[0] - d[0] * 2, q[1] - d[1] * 2, q[2]], horizontalFov: 60 }; };
const look = (name, q, back, high, ahead = 2) => ({ ...closeOn(name, q, back, high), lookAt: (() => { const o = [q[0] - isle[0], q[1] - isle[1]], l = Math.hypot(...o) || 1; return [q[0] - (o[0] / l) * ahead, q[1] - (o[1] / l) * ahead, q[2]]; })() });
const borders = [['foot', footAt], ['beach', beachAt]].flatMap(([n, q]) => [look(`${n}-wide`, q, 14, 9), look(`${n}-eye`, q, 6, 1.7, 4), look(`${n}-close`, q, 2.5, 1.4, 0.5), look(`${n}-down`, q, 0.05, 2.6, 0.05)]);
const shoreSun = [Math.round((Math.atan2(along[1], along[0]) - Math.atan2(sun[1], sun[0])) * 180 / Math.PI), 10];
// THE SEA ONE SURFACE: the payload's sea faces end on whole cells, so their edge on the beach is a saw; the gen-7 half
// draws the sea as one plane at the line instead (where it meets the beach is then the beach's own contour) and fades
// it in over the depth under it (to DEPTH_MAX, the floor's fade: the shallows show their sand), read from the land
// rasterized from above (DEPTH_CELL metres; DEPTH_MAX deep a byte)
const DEPTH_CELL = 0.5, DEPTH_MAX = DEEP_FADE, depthMap = L.waterZ === null ? null : (() => {
  // (over the land's own box and a margin: past it the sea is deep)
  const x0 = box[0][0] - 10, y0 = box[1][0] - 10, nx = Math.ceil((box[0][1] + 10 - x0) / DEPTH_CELL) + 1, ny = Math.ceil((box[1][1] + 10 - y0) / DEPTH_CELL) + 1;
  const top = new Float32Array(nx * ny).fill(-Infinity);
  P.faces.forEach((f, i) => {
    if (!L.faces[i].cls || L.faces[i].cls === 'water') return;
    for (let k = 1; k + 1 < f.corners.length; k++) {
      const [a, b, c] = [f.corners[0], f.corners[k], f.corners[k + 1]], det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(det) < 1e-9) continue;
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / DEPTH_CELL)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / DEPTH_CELL));
      const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - y0) / DEPTH_CELL)), j1 = Math.min(ny - 1, Math.ceil((Math.max(a[1], b[1], c[1]) - y0) / DEPTH_CELL));
      for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
        const x = x0 + ii * DEPTH_CELL, y = y0 + j * DEPTH_CELL, l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const z = l1 * a[2] + l2 * b[2] + l3 * c[2], q = j * nx + ii; if (z > top[q]) top[q] = z;
      }
    }
  });
  const px = new Uint8Array(nx * ny * 4);
  for (let q = 0; q < nx * ny; q++) { const d = top[q] === -Infinity ? DEPTH_MAX : Math.max(0, Math.min(DEPTH_MAX, L.waterZ - top[q])); px[q * 4] = Math.round((d / DEPTH_MAX) * 255); px[q * 4 + 3] = 255; }
  return { origin: [x0, y0], cell: DEPTH_CELL, size: [nx, ny], max: DEPTH_MAX, px: b64(px) };
})();
const data = {
  depth: depthMap,
  cube, sun, sky: { zenith: P.sky.zenith, horizon: P.sky.horizon }, haze: P.haze, box, waterZ: L.waterZ, unread: L.unread, deep: L.deep,
  seabed: { x: [Math.min(...seaX), Math.max(...seaX)], y: [Math.min(...seaY), Math.max(...seaY)], z: L.waterZ - DEEP_FADE - 1 },
  classes: Object.fromEntries(Object.entries(LAND_CLASSES).map(([k, K]) => [k, K.rough])),
  cameras: [...P.cameras.map((c) => ({ name: c.name, ...c.worldFraming })), shore, ...borders], shoreSun, ranges,
  // the shore's reading: a line from where the water begins (2 m past the wet line) straight out to sea, at its face
  shoreLine: Array.from({ length: 41 }, (_, i) => [shoreAt[0] + d2[0] * (i + 2), shoreAt[1] + d2[1] * (i + 2), L.waterZ]),
  light: { sun: light.sun.linear, ambient: light.ambient.linear, sea: { view: Math.round(view * 10) / 10, fresnel: water.fresnel, sees, base: bases.water, target: C.colour.water, ...(water.unreached ? { unreached: true } : {}) },
    swatches: ['stone', 'grass', 'sand', 'floor'].map((r) => ({ role: r, base: light.linearBases[r], lit: light.targets[r].reached ?? C.colour[r], shade: light.targets[r].shade })) },
  pos: b64(Float32Array.from(pos)), c6: b64(Uint8Array.from(c6)), c7: b64(Uint8Array.from(c7)), bk: b64(Uint8Array.from(bk)), sid: b64(Uint8Array.from(sid)), spl: b64(Uint8Array.from(spl)), nrm: b64(Int8Array.from(nrm)), wet: { z: L.waterZ, band: WET_BAND, tone: WET_TONE, rough: WET_ROUGH }, seenRoles: SEEN_ROLES,
  layers: { base: png(A.base), normal: png(A.normal), orm: png(A.orm), mean: means, tile: LAYERS.map((Ly) => Ly.metres), keys: Object.keys(LAYER_OF), pathBase: light.linearBases.floor, dice: dicePng, size: TEX }, path: pathTex,
  palette: { sky: light.ambient.color, targets: Object.fromEntries(SEEN_ROLES.map((r) => [r, { lit: light.targets[r].reached ?? C.colour[r], shade: light.targets[r].shade }])) },
};
const importmap = cdn ? CDN_IMPORTMAP : inlineImportmap();

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Island in Gen 7</title>
<style>
  :root { --bg: #15171c; --panel: #1d2028; --line: #2c313c; --fg: #e8eaee; --muted: #9aa1ae; --accent: #f0b35a; color-scheme: dark; }
  html, body { height: 100%; margin: 0; } body { background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; display: flex; flex-direction: column; }
  header { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
  h1 { font-size: 15px; margin: 0; } label { display: flex; gap: 8px; align-items: center; color: var(--muted); }
  input[type=range] { width: 130px; accent-color: var(--accent); } select, button { background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; font: inherit; }
  #wrap { flex: 1; position: relative; min-height: 0; } canvas { display: block; width: 100%; height: 100%; }
  .tags { position: absolute; left: 0; right: 0; top: 10px; display: grid; grid-template-columns: 1fr 1fr; text-align: center; pointer-events: none; }
  .tags b { display: block; } .tags span { color: var(--muted); font-size: 12px; } .tags div { text-shadow: 0 1px 3px #000a; }
</style></head><body>
<header><h1>Island in Gen 7</h1>
  <label for="cam">camera <select id="cam"></select></label>
  <label for="az">sun turned <input id="az" type="range" min="-180" max="180" value="0"></label>
  <label for="el">sun height <input id="el" type="range" min="4" max="88" value="0"></label>
  <button id="hour" type="button">the hour's sun</button>
</header>
<div id="wrap"><canvas id="c"></canvas>
  <div class="tags"><div><b>gen-6</b><span>the fills: light baked in, drawn unlit</span></div><div><b>gen-7</b><span>the cube's colours, lit by the sun and the sky</span></div></div>
</div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const D = ${safeJson(data)};
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// (the fills and colours are sRGB bytes; three's vertex colours are linear)
const LIN = Float32Array.from({ length: 256 }, (_, v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
const linear = (b) => Float32Array.from(b, (v, i) => (i % 4 === 3 ? v / 255 : LIN[v]));
const POS = new Float32Array(bytes(D.pos).buffer), C6 = linear(bytes(D.c6)), C7 = linear(bytes(D.c7)), BK = bytes(D.bk), SID = bytes(D.sid), SPL = bytes(D.spl), NRM = new Int8Array(bytes(D.nrm).buffer);
const cv = document.getElementById('c'), renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const rgb = (a) => new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace);

// the sky: a dome from the horizon's colour to the zenith's, behind both halves and the gen-7 side's light and reflections
function skyDome() {
  const g = new THREE.SphereGeometry(4000, 48, 24), p = g.attributes.position, col = new Float32Array(p.count * 3), z = rgb(D.sky.zenith), h = rgb(D.sky.horizon);
  for (let i = 0; i < p.count; i++) { const t = Math.pow(Math.max(0, p.getZ(i) / 4000), 0.6), c = h.clone().lerp(z, t); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.rotateX(0);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
}
function part(R, colours, extra = {}) {
  const g = new THREE.BufferGeometry();
  if (extra.smooth) g.setAttribute('normal', new THREE.BufferAttribute(NRM.subarray(R.start * 3, (R.start + R.count) * 3), 3, true));
  if (extra.splat) g.setAttribute('splat', new THREE.BufferAttribute(SPL.subarray(R.start * 4, (R.start + R.count) * 4), 4, true));
  g.setAttribute('position', new THREE.BufferAttribute(POS.subarray(R.start * 3, (R.start + R.count) * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(colours.subarray(R.start * 4, (R.start + R.count) * 4), 4));
  if (extra.bucket) { g.setAttribute('bucket', new THREE.BufferAttribute(BK.subarray(R.start, R.start + R.count), 1)); g.setAttribute('seenid', new THREE.BufferAttribute(SID.subarray(R.start, R.start + R.count), 1)); }
  return g;
}
const fog = () => new THREE.FogExp2(new THREE.Color(D.haze.color), D.haze.density);

// gen-6: the fills as they are, unlit and untouched by the tone curve
const six = new THREE.Scene(); six.fog = fog(); six.add(skyDome());
for (const R of D.ranges) {
  const water = R.key === 'water';
  six.add(new THREE.Mesh(part(R, C6), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: water, depthWrite: !water, side: THREE.DoubleSide, toneMapped: false })));
}
// gen-7: the material, lit
const seven = new THREE.Scene(); seven.fog = fog(); seven.add(skyDome());
// (the sky in the sea's reflections only: the land's light is the solved sun and sky light, nothing over it)
const pm = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(skyDome());
const skyEnv = pm.fromScene(envScene, 0, 1, 6000).texture;
// the solved light in three's units: its diffuse is base × light / π, so each light is π × the solve's level
const solved = (lin) => { const m = Math.max(...lin, 1e-9); return [new THREE.Color().setRGB(lin[0] / m, lin[1] / m, lin[2] / m, THREE.LinearSRGBColorSpace), Math.PI * m]; };
seven.add(new THREE.AmbientLight(...solved(D.light.ambient)));
let wetMat = null;
// the layered ground's shader, chained over the standard material's: each layer along the face's dominant axis, its
// weight raised by its own height (the border decided by the relief), its normal, roughness and occlusion, and its
// colour about its mean over the corner's base
// (each layer its own slice of an array, repeating on its own: an atlas's cells bleed into each other's mips as seams)
const loadImg = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; });
const mipped = (t, srgb) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true; return t; };
async function layerArray(u, srgb) {
  const im = await loadImg(u), T = D.layers.size, cv2 = document.createElement('canvas'); cv2.width = im.width; cv2.height = im.height;
  const x = cv2.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const data = new Uint8Array(T * T * 4 * 5);
  for (let i = 0; i < 5; i++) data.set(x.getImageData((i % 3) * T, Math.floor(i / 3) * T, T, T).data, i * T * T * 4);
  return mipped(new THREE.DataArrayTexture(data, T, T, 5), srgb);
}
const [tBase, tNorm, tOrm] = await Promise.all([layerArray(D.layers.base, true), layerArray(D.layers.normal), layerArray(D.layers.orm)]);
const tDice = mipped(await new THREE.TextureLoader().loadAsync(D.layers.dice), false); tDice.minFilter = THREE.NearestMipmapNearestFilter; tDice.magFilter = THREE.NearestFilter;
// (the path's mask: the weight in red, the trail's height in green and blue; none without a trail)
const pathMap = D.path ? new THREE.DataTexture(bytes(D.path.px), D.path.size[0], D.path.size[1], THREE.RGBAFormat) : new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
pathMap.magFilter = pathMap.minFilter = THREE.LinearFilter; pathMap.needsUpdate = true;
const LAYER_U = { tBase: { value: tBase }, tNorm: { value: tNorm }, tOrm: { value: tOrm }, tDice: { value: tDice }, uTile: { value: D.layers.tile }, uMean: { value: D.layers.mean.map((m) => new THREE.Vector3(...m)) },
  tPath: { value: pathMap }, uPathO: { value: new THREE.Vector2(...(D.path ? D.path.origin.map((v) => v - D.path.cell / 2) : [0, 0])) }, uPathM: { value: new THREE.Vector2(...(D.path ? D.path.metres : [1, 1])) },
  uPathZ: { value: new THREE.Vector2(...(D.path ? D.path.z : [0, 1])) }, uHasPath: { value: D.path ? 1 : 0 }, uPathBase: { value: new THREE.Vector3(...D.layers.pathBase) }, uWet: { value: new THREE.Vector4(D.wet.z ?? -1e9, D.wet.band, D.wet.tone, D.wet.rough) } };
function layeredGround(m, roughScale) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LAYER_U, { uRough: { value: roughScale } });
    sh.vertexShader = 'attribute vec4 splat;\\nvarying vec4 vSplat;\\nvarying vec3 vWPos;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vSplat = splat; vWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = 'uniform sampler2DArray tBase, tNorm, tOrm;\\nuniform sampler2D tPath, tDice;\\nuniform float uTile[5];\\nuniform vec3 uMean[5];\\nuniform float uRough, uHasPath;\\nuniform vec2 uPathO, uPathM, uPathZ;\\nuniform vec3 uPathBase;\\nuniform vec4 uWet;\\nvarying vec4 vSplat;\\nvarying vec3 vWPos;\\nfloat hn( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\\nfloat vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( hn( i ), hn( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hn( i + vec2( 0.0, 1.0 ) ), hn( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }\\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', \`
  vec3 nW = normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz ), aN = abs( nW );
  vec2 uvW; vec3 tT, tB;
  if ( aN.z >= aN.x && aN.z >= aN.y ) { uvW = vWPos.xy; tT = vec3( 1.0, 0.0, 0.0 ); tB = vec3( 0.0, 1.0, 0.0 ); }
  else if ( aN.x >= aN.y ) { uvW = vec2( vWPos.y * sign( nW.x ), vWPos.z ); tT = vec3( 0.0, sign( nW.x ), 0.0 ); tB = vec3( 0.0, 0.0, 1.0 ); }
  else { uvW = vec2( -vWPos.x * sign( nW.y ), vWPos.z ); tT = vec3( -sign( nW.y ), 0.0, 0.0 ); tB = vec3( 0.0, 0.0, 1.0 ); }
  // the path: the mask at this point of the plan, on ground that faces up and at the trail's own height (not the flank
  // under a shelf), every natural layer giving way to it
  float pw = 0.0;
  if ( uHasPath > 0.5 ) {
    vec2 pu = ( vWPos.xy - uPathO ) / uPathM;
    if ( pu.x > 0.0 && pu.y > 0.0 && pu.x < 1.0 && pu.y < 1.0 ) {
      vec4 pm = texture2D( tPath, pu );
      float pz = uPathZ.x + ( pm.g * 255.0 * 256.0 + pm.b * 255.0 ) / 65535.0 * uPathZ.y;
      pw = pm.r * smoothstep( 0.6, 0.85, nW.z ) * ( 1.0 - smoothstep( 0.6, 1.5, abs( vWPos.z - pz ) ) );
    }
  }
  float hgt[5]; vec3 bs[5]; vec3 ns[5]; vec2 rs[5];
  for ( int i = 0; i < 5; i++ ) {
    vec3 a = vec3( uvW / uTile[ i ], float( i ) );
    vec4 o = texture( tOrm, a );
    hgt[ i ] = o.b; rs[ i ] = o.rg;
    bs[ i ] = texture( tBase, a ).rgb / uMean[ i ];
    ns[ i ] = texture( tNorm, a ).xyz * 2.0 - 1.0;
  }
  float ws[5]; ws[0] = vSplat.x * ( 1.0 - pw ); ws[1] = vSplat.y * ( 1.0 - pw ); ws[2] = vSplat.z * ( 1.0 - pw ); ws[3] = vSplat.w * ( 1.0 - pw ); ws[4] = pw;
  // (each layer present here nudged by its own noise over the plan, a few metres across: the corners' weights run
  // straight across a triangle, the border they give must not)
  // the scree thins out by its stones: a stone is kept whole where its dice fall under the scree's share here (nudged
  // like the rest), and then it lies over whatever else is here; between the kept stones the others show
  float wsum = max( 1e-4, ws[0] + ws[1] + ws[2] + ws[3] + ws[4] ), sh = ws[1] / wsum;
  float sn = vn( vWPos.xy / 2.5 + 17.3 ) * 0.7 + vn( vWPos.xy / 0.8 + 5.1 ) * 0.3 - 0.5;
  float kept = sh > 0.001 ? step( texture( tDice, uvW / uTile[ 1 ] ).r, min( 1.0, sh * 1.2 + sn * 0.3 ) ) : 0.0;
  float top = 0.0;
  for ( int i = 0; i < 5; i++ ) {
    float nz = vn( vWPos.xy / 2.5 + float( i ) * 17.3 ) * 0.7 + vn( vWPos.xy / 0.8 + float( i ) * 5.1 ) * 0.3 - 0.5;
    ws[ i ] = i == 1 ? kept * 4.0 : ws[ i ] > 0.001 ? ws[ i ] + hgt[ i ] * 0.35 + nz * 0.35 : 0.0; top = max( top, ws[ i ] );
  }
  float tw = 0.0; vec3 mb = vec3( 0.0 ), mn = vec3( 0.0 ); vec2 mr = vec2( 0.0 );
  for ( int i = 0; i < 5; i++ ) { float w = max( ws[ i ] - ( top - 0.08 ), 0.0 ); tw += w; mb += bs[ i ] * w; mr += rs[ i ] * w; mn += ns[ i ] * w; ws[ i ] = w; }
  mb /= max( 1e-4, tw ); mr /= max( 1e-4, tw ); mn = normalize( mn );
  // (the path's own base under its share: the floor the palette names, whatever the ground round it)
  diffuseColor.rgb = mix( diffuseColor.rgb, uPathBase, ws[ 4 ] / max( 1e-4, tw ) );
  diffuseColor.rgb *= mb * mix( 1.0, mr.x, 0.5 );
  roughnessFactor = clamp( mr.y * uRough, 0.04, 1.0 );
  // (the sand WET by its height over the water, at this point, not face by face: the line it leaves follows the
  // shore smoothly, wandering a little, and only the sand's share darkens and shines; under the line its own colour
  // takes over, the sea's)
  float wet = ( 1.0 - smoothstep( 0.0, uWet.y, abs( vWPos.z - uWet.x + ( vn( vWPos.xy / 1.7 + 3.1 ) - 0.5 ) * uWet.y * 0.8 ) ) ) * ws[ 3 ] / max( 1e-4, tw );
  diffuseColor.rgb *= mix( 1.0, uWet.z, wet );
  roughnessFactor = mix( roughnessFactor, uWet.w, wet );
  normal = normalize( ( viewMatrix * vec4( normalize( tT * mn.x + tB * mn.y + nW * mn.z ), 0.0 ) ).xyz );\`);
  };
  m.customProgramCacheKey = () => 'layered-ground';
  return m;
}
const sunLight = new THREE.DirectionalLight(...solved(D.light.sun)); sunLight.castShadow = true;
const [bx, by, bz] = D.box, mid = new THREE.Vector3((bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2, (bz[0] + bz[1]) / 2), rad = Math.hypot(bx[1] - bx[0], by[1] - by[0], bz[1] - bz[0]) / 2;
Object.assign(sunLight.shadow.camera, { left: -rad, right: rad, top: rad, bottom: -rad, near: 0.5, far: rad * 4 });
sunLight.shadow.mapSize.set(4096, 4096); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.04;
sunLight.target.position.copy(mid); seven.add(sunLight, sunLight.target);
for (const R of D.ranges) {
  const water = R.key === 'water';
  if (water && D.depth) continue;
  const m = water
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: R.rough, metalness: 0, transparent: true, depthWrite: false, envMap: skyEnv, envMapIntensity: 1 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: R.rough, metalness: 0, side: THREE.DoubleSide });
  const ground = !water && D.layers.keys.includes(R.key.split(':')[0]);
  if (ground) layeredGround(m, 1);
  // (the land is shaded flat, its normals the faces'; the sea's are its own; the shallows' floor, all but level, lit as
  // one surface facing up, so its faces never show through the sea as facets)
  const floor = R.key === 'sand:under', g = part(R, C7, { splat: ground, smooth: !water && !floor && R.key !== 'unread' });
  if (water) g.computeVertexNormals();
  if (floor) g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from({ length: R.count * 3 }, (_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = !water; mesh.receiveShadow = true; seven.add(mesh);
  if (R.key === 'sand:wet') wetMat = m;
}
if (D.depth) {
  const Q = D.depth, dm = new THREE.DataTexture(bytes(Q.px), Q.size[0], Q.size[1], THREE.RGBAFormat); dm.magFilter = dm.minFilter = THREE.LinearFilter; dm.needsUpdate = true;
  const w = Q.size[0] * Q.cell, h = Q.size[1] * Q.cell, B = D.seabed, g = new THREE.PlaneGeometry(B.x[1] - B.x[0], B.y[1] - B.y[0]); g.translate((B.x[0] + B.x[1]) / 2, (B.y[0] + B.y[1]) / 2, D.waterZ);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(D.light.sea.base), roughness: D.classes.water, metalness: 0, transparent: true, depthWrite: false, envMap: skyEnv, envMapIntensity: 1, opacity: 0.9 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tDepth: { value: dm }, uDO: { value: new THREE.Vector2(Q.origin[0] - Q.cell / 2, Q.origin[1] - Q.cell / 2) }, uDM: { value: new THREE.Vector2(w, h) }, uDMax: { value: Q.max } });
    sh.vertexShader = 'varying vec2 vSeaXY;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  vSeaXY = ( modelMatrix * vec4( transformed, 1.0 ) ).xy;');
    sh.fragmentShader = 'uniform sampler2D tDepth;\\nuniform vec2 uDO, uDM;\\nuniform float uDMax;\\nvarying vec2 vSeaXY;\\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n  vec2 du = ( vSeaXY - uDO ) / uDM;\\n  diffuseColor.a *= du.x < 0.0 || du.y < 0.0 || du.x > 1.0 || du.y > 1.0 ? 1.0 : smoothstep( 0.0, uDMax, texture2D( tDepth, du ).r * uDMax );');
  };
  m.customProgramCacheKey = () => 'sea-plane';
  const sea = new THREE.Mesh(g, m); sea.receiveShadow = true; seven.add(sea);
}
// open sea: deep water's colour under it, where the recipe lays no floor (the shallows' floor fades into the same colour)
{ const B = D.seabed, g = new THREE.PlaneGeometry(B.x[1] - B.x[0], B.y[1] - B.y[0]); g.translate((B.x[0] + B.x[1]) / 2, (B.y[0] + B.y[1]) / 2, B.z);
  seven.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: rgb(D.deep), roughness: 1, metalness: 0 }))); }
// the gate's buckets: a flat pass, each face in its bucket's colour, the sea hiding what is under it
const ids = new THREE.Scene(); ids.background = new THREE.Color(0);
const idMat = new THREE.ShaderMaterial({ vertexShader: 'attribute float bucket; attribute float seenid; varying float b; varying float s; void main() { b = bucket; s = seenid; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying float b; varying float s; void main() { gl_FragColor = vec4(b / 255.0, s / 255.0, 0.0, 1.0); }', side: THREE.DoubleSide });
for (const R of D.ranges) ids.add(new THREE.Mesh(part(R, C7, { bucket: true }), idMat));

// the sun: the hour's, turned and raised from it by the sliders
const hourAz = Math.atan2(D.sun[1], D.sun[0]), hourEl = Math.asin(D.sun[2]);
const az = document.getElementById('az'), el = document.getElementById('el');
el.value = Math.round(hourEl * 180 / Math.PI);
// (the shadow passes counted where three draws them: once per placing of the sun, never per frame)
let shadowPasses = 0, frames = 0;
const SM = renderer.shadowMap, drawShadow = SM.render;
SM.render = function (lights, ...rest) { if (SM.needsUpdate && lights.length) shadowPasses += 1; return drawShadow.call(this, lights, ...rest); };
function setSun(azDeg, elDeg) {
  const a = hourAz + azDeg * Math.PI / 180, e = elDeg * Math.PI / 180, d = new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e));
  sunLight.position.copy(mid).addScaledVector(d, rad * 2); sunLight.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true;
  return d;
}
const sunNow = () => setSun(Number(az.value), Number(el.value));
az.oninput = el.oninput = () => { sunNow(); draw(); };
document.getElementById('hour').onclick = () => { az.value = 0; el.value = Math.round(hourEl * 180 / Math.PI); sunNow(); draw(); };

// the camera: the cube's own framings, z up
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 9000); camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, cv); controls.addEventListener('change', () => draw());
const sel = document.getElementById('cam'); for (const c of D.cameras) sel.add(new Option(c.name, c.name));
let hfov = 58;
function frame(name) {
  const c = D.cameras.find((k) => k.name === name) || D.cameras[0]; hfov = c.horizontalFov;
  camera.position.set(...c.cameraPosition); controls.target.set(...c.lookAt); controls.update(); draw();
}
sel.onchange = () => frame(sel.value);

function size() { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); return [w, h]; }
function fit(w, h) { camera.aspect = w / h; camera.fov = 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / camera.aspect) * 180 / Math.PI; camera.updateProjectionMatrix(); }
function draw() {
  const [w, h] = size(), half = Math.floor(w / 2); fit(half, h); renderer.setScissorTest(true);
  renderer.setViewport(0, 0, half, h); renderer.setScissor(0, 0, half, h); renderer.render(six, camera);
  renderer.setViewport(half, 0, w - half, h); renderer.setScissor(half, 0, w - half, h); renderer.render(seven, camera);
  renderer.setScissorTest(false); frames += 1;
}
addEventListener('resize', draw);

// the machine gate: each half drawn across the whole screen (through the tone curve, as it is seen), the id pass beside
// it, each bucket's mean luminance (and the wet and dry sand's brightest twentieth, where a glint shows), and each role's
// mean colour lit and in shade (the seen laws' samples)
// (the id pass to a target of the screen's size with no antialiasing: blended edges would make ids that are no face's)
function readIds() {
  const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, rt = new THREE.WebGLRenderTarget(w, h, { samples: 0 });
  fit(w, h); renderer.setRenderTarget(rt); renderer.render(ids, camera); const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(null); rt.dispose(); return px;
}
function readScreen(scene) {
  const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, cv.clientWidth, cv.clientHeight); fit(w, h);
  renderer.render(scene, camera); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px;
}
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function buckets(px, id) {
  const S = {}, C = {}; for (let i = 0; i < id.length; i += 4) {
    const b = id[i], s = id[i + 1];
    if (b) (S[b] ??= []).push(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
    if (s) { const a = (C[s] ??= [0, 0, 0, 0]); a[0] += px[i]; a[1] += px[i + 1]; a[2] += px[i + 2]; a[3] += 1; }
  }
  const name = { 1: 'cliffToSun', 2: 'cliffAway', 3: 'wetSand', 4: 'drySand' }, out = {}, roles = {};
  for (const [b, ys] of Object.entries(S)) { ys.sort((a, c) => a - c); out[name[b]] = { px: ys.length, mean: +(ys.reduce((a, c) => a + c, 0) / ys.length).toFixed(1), top: +ys[Math.floor(ys.length * 0.95)].toFixed(1), peak: +ys[Math.floor(ys.length * 0.99)].toFixed(1) }; }
  for (const [s, a] of Object.entries(C)) if (a[3] >= 40) { const r = D.seenRoles[Math.floor(s / 4) - 1]; (roles[r] ??= {})[s % 4 === 1 ? 'lit' : 'shade'] = hex(a.slice(0, 3).map((v) => v / a[3])); }
  return Object.assign(out, { roles });
}
// the swatches: a patch of each role's base square to the sun, then under the sky alone, drawn to the screen through
// the same tone curve and read back against the palette's targets
function swatches() {
  const W = D.light.swatches, n = W.length, S = new THREE.Scene(), cam = new THREE.OrthographicCamera(-n, n, 1, -1, 0.1, 10);
  cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);
  const sunS = new THREE.DirectionalLight(...solved(D.light.sun)); sunS.position.set(0, 0, 10); S.add(sunS, new THREE.AmbientLight(...solved(D.light.ambient)));
  W.forEach((w, i) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...w.base, THREE.LinearSRGBColorSpace), roughness: 1, metalness: 0 })); q.position.x = -n + 1 + 2 * i; S.add(q); });
  const gl = renderer.getContext(), read = () => W.map((_, i) => { const px = new Uint8Array(4); gl.readPixels(Math.round(((1 + 2 * i) / (2 * n)) * gl.drawingBufferWidth), Math.round(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return '#' + [...px.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join(''); });
  renderer.setRenderTarget(null); renderer.setViewport(0, 0, cv.clientWidth, cv.clientHeight);
  renderer.render(S, cam); const lit = read(); sunS.intensity = 0; renderer.render(S, cam); const shade = read();
  const off = (a, b) => Math.max(...[1, 3, 5].map((k) => Math.abs(parseInt(a.slice(k, k + 2), 16) - parseInt(b.slice(k, k + 2), 16))));
  draw();
  return W.map((w, i) => ({ role: w.role, lit: lit[i], want: w.lit, litOff: off(lit[i], w.lit), shade: shade[i], wantShade: w.shade, shadeOff: off(shade[i], w.shade) }));
}
window.swatches = swatches;
// the shore, read from straight above (flown over it, an orthographic eye 60 m up): each half's luminance along the line
// from the wet line out to sea: the shallows should read lighter than the deep, and the floor fall away without steps
window.shoreReading = () => {
  const L = D.shoreLine, a = L[0], z = L[L.length - 1], mid = [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2, a[2]], half = 26;
  const eye = new THREE.OrthographicCamera(-half, half, half, -half, 1, 400); eye.position.set(mid[0], mid[1], mid[2] + 60); eye.up.set(z[0] - a[0], z[1] - a[1], 0); eye.lookAt(...mid);
  const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, v = new THREE.Vector3(), cam = camera;
  eye.left = -half * w / h; eye.right = half * w / h; eye.updateProjectionMatrix();
  const along = (scene) => {
    renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, cv.clientWidth, cv.clientHeight); renderer.render(scene, eye);
    const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return L.map((q) => { v.set(...q).project(eye); const x = Math.round((v.x + 1) / 2 * w), y = Math.round((v.y + 1) / 2 * h); const i = (y * w + x) * 4; return Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]); });
  };
  const read = (ys) => { const n = Math.max(1, Math.floor(ys.length / 5)), m = (b) => Math.round(b.reduce((s, y) => s + y, 0) / b.length);
    let rises = 0; for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 3) rises += 1;
    return { samples: ys.length, shallow: m(ys.slice(0, n)), deep: m(ys.slice(-n)), rises, line: ys }; };
  const out = { gen6: read(along(six)), gen7: read(along(seven)) }; draw(); return out;
};
window.measure = ({ camera: name, sun } = {}) => {
  if (name) frame(name);
  const before = [Number(az.value), Number(el.value)];
  sun ??= [0, Math.round(hourEl * 180 / Math.PI)]; az.value = sun[0]; el.value = sun[1];
  sunNow();
  const id = readIds(), g6 = buckets(readScreen(six), id), g7 = buckets(readScreen(seven), id);
  // the wet band's sheen: the same view with its roughness the dry sand's, so what remains is what the wet's gloss adds
  let sheen = null;
  if (wetMat && g7.wetSand) { const r = wetMat.roughness; wetMat.roughness = D.classes.sand; const matte = buckets(readScreen(seven), id).wetSand; wetMat.roughness = r; sheen = { glossy: g7.wetSand, matte }; }
  az.value = before[0]; el.value = before[1]; sunNow(); draw();
  return { camera: name || sel.value, sun, gen6: g6, gen7: g7, sheen, shadowPasses, frames, unread: D.unread };
};
window.shoreSun = D.shoreSun; window.palette = D.palette; window.ready = true;
setSun(0, hourEl * 180 / Math.PI); frame(D.cameras[0].name);
</script></body></html>`;
fs.writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1e6).toFixed(1)} MB, ${P.faces.length} faces, ${data.ranges.map((r) => `${r.key} ${r.count / 3}`).join(', ')}; unread ${L.unread}; water at ${L.waterZ}`);
