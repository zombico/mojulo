/**
 * THE LAND READ AS FORM (gen-7): a geocube payload's land — the island's or a trail's — read as the form render draws
 * it, lifted out of the island spike (scripts/spikes/form/island.mjs) for the World page's `form` channel. Its faces as
 * material (form/land-form.js) over the bases the cube's light solves (era/cube-light.js: the palette's colours are
 * targets, the bases and one light solved to show them; the sea a mirror over a body, color-theorist/light.js); the
 * layers' weights, the path's mask, the scree's stones (form/land-layers.js, form/land-stones.js); the layers' textures
 * (the matte painter's natural cuts) in one atlas each for base, normal and orm (height in blue); the sea's depth over
 * the land; the dirt's tones (color-theorist/ground.js soilTones).
 *
 *   landRead(payload, cube, { hour?, dress?, grass?, relief?, reliefSeed?, moss?, sward?, drifts? }) → { P, L, light,
 *       sun, bases,
 *       ranges, pos, c7, spl, nrm, faceOf, cornerOf, …the layers, the mask, the depth, the stones, the relief, the
 *       grass' map and rows when asked }
 *     payload: a resolved geocube payload (its faces, cameras, sky); cube: the resolved cube (era/geocube.js readGeocube);
 *     hour: an hour (a number) the light is read at, the bases kept at the cube's own; dress: a trail's dress
 *     ({ surface, rubble, dust, clay, patches }, its degrees); grass: lay the grass' ground map and brush rows ('map':
 *     the map alone, the page grows its brush); sward: how long it is (the biocube's `flora.grass.sward`: 'tall',
 *     'short' or { short: 0–1 }), in the map's fourth channel; drifts: wheat, chaff, any grass kind and the flowers in
 *     areas of their own (form/grass-drifts.js readDrifts: [{ id, share, mix? }]), a channel each of a second map; relief:
 *     the rock's relief (form/rock-relief.js: a preset id or a document; false for none), drawn with `reliefSeed`; moss:
 *     how much moss the rock wears, 0–1 (the biocube's `flora.moss`), none by default.
 *     Each vertex's face and corner (`faceOf`, `cornerOf`) so a caller can lay its own per-vertex readings beside. Null
 *     for a payload with no land.
 *   formPayload(read) → the World page's `form` input (scene/channels/form-land.js draws it): the land's vertices
 *     (base64), its ranges, the light, the layers' textures, the mask, the depth, the stones, the dress, the relief,
 *     and `hides` (the painted groups it draws in their place). Plain data, JSON-safe.
 *
 * Pure, seeded: the same payload and cube, the same read, byte for byte. Nothing in a recipe reads it.
 */
import { cubeLight } from '../era/cube-light.js';
import { solveMirror, seen, decodeSrgb, encodeSrgb } from '../color-theorist/light.js';
import { landForm, LAND_CLASSES, DEEP_FADE, DEEP_TONE, UNDER_TONE, WET_BAND, WET_TONE, WET_ROUGH } from './land-form.js';
import { b64 } from '../scene/emit-util.js';
import { dressedMaterial, screeDice } from '../matte-paint/dressed.js';
import { encodePng } from '../landscape/surface-textures.js';
import { landLayers, LAYER_OF, PATH_REACH } from './land-layers.js';
import { strHash } from '../city/plan/dice.js';
import { landStones, stoneForms, SHAPES } from './land-stones.js';
import { soilTones } from '../color-theorist/ground.js';
import { readRelief, reliefMap } from './rock-relief.js';
import { DRIFT_CELL, DRIFT_SEAM, driftForms } from './grass-drifts.js';

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** The sward's short areas: the field's cell (metres) and the seam a short area eases into a tall one over (a share of
 *  the grass). */
export const SWARD_CELL = 22, SWARD_SEAM = 0.12;
/** The gen-6 grass's blade cards (era/isekai.js): left out of the read, and out of the form render's page. */
export const GRASS_CARDS = 'isekai:grass';
/** The rock's relief when none is asked for: the ledged face (form/rock-relief.js). */
export const RELIEF_DEFAULT = 'ledged';
/** A trail's dress when none is written: rubble half, a little dust, some clay, the three patch kinds. */
export const DRESS_DEFAULT = Object.freeze({ surface: 'earth', rubble: 0.5, dust: 0.3, clay: 0.45, patches: Object.freeze(['worn', 'damp', 'gravel']) });

const ATLAS_TEX = 512, ATLAS_W = ATLAS_TEX * 3, ATLAS_H = ATLAS_TEX * 3, atlasMemo = new Map();
const atlasPng = (b) => `data:image/png;base64,${encodePng(b, ATLAS_W, ATLAS_H).toString('base64')}`;
// the layers' textures in one atlas each (base, normal, orm with the height in blue), each layer's linear mean beside,
// and the scree's dice: the cuts' own, no cube's, so painted once per dress surface (the path's layer the one that
// differs) and kept for the process
function layerAtlas(LAYERS, surface) {
  if (atlasMemo.has(surface)) return atlasMemo.get(surface);
  const TEX = ATLAS_TEX, AW = ATLAS_W, AH = ATLAS_H;
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
  const png = atlasPng;
  // the scree's dice (matte-paint/dressed.js `screeDice`, the same tile): each stone's own, 1 between them, so a scree
  // thinning out keeps whole stones by their dice and the ground shows between (era/scree-tiles.js, 6.5's edge)
  const SC = LAYERS.find((Ly) => Ly.id === 'scree'), dice = screeDice({ cut: 'scree', metres: SC.metres, stone: [170, 160, 140], grit: 0.5 }, { size: TEX, seed: 3 });
  const dicePng = `data:image/png;base64,${encodePng(Buffer.from(Array.from(dice, (v) => Math.round((v >= 0 ? Math.min(0.99, v) : 1) * 255)).flatMap((v) => [v, v, v])), TEX, TEX).toString('base64')}`;
  const R = { A, means, png, dicePng };
  atlasMemo.set(surface, R);
  return R;
}

export function landRead(P0, C, { hour, dress = DRESS_DEFAULT, grass: withGrass = false, relief = RELIEF_DEFAULT, reliefSeed = 3, moss = 0, sward = 'tall', drifts = [] } = {}) {
  // (no land to read: a payload with no faces of the land's groups)
  if (!P0.faces.some((f) => /^isekai:(sand|ground|soil|scree|cliff|rock|water)$/.test(f.group))) return null;
  // (the cards a land stands up, the grass's blades and the sky's clouds, are drawn by their cut-out textures: not read here
  // yet, so left out of both halves)
  const CARDS = new Set([GRASS_CARDS, 'isekai:cloud']), P = { ...P0, faces: P0.faces.filter((f) => !CARDS.has(f.group)) };
  const own = cubeLight(C), light = hour === undefined ? own : cubeLight(C, { hour }), sun = light.sun.dir;
  // THE SEA, a mirror over a body: from the island camera's view down onto it, the palette's sea colour is what the sky it
  // reflects (the dome at that angle, as the page draws it) and its body under the light show together, the floor under
  // it showing through its alpha (the deep water's colour, the body's own: solved twice)
  // (a land with no island camera, the path's: its first)
  const isleCam = (P.cameras.find((c) => c.name === 'island') ?? P.cameras[0]).worldFraming, [cx, cy, cz] = isleCam.cameraPosition, [lx, ly, lz] = isleCam.lookAt;
  // (looking down at the sea: a camera level with it or looking up reads it from 2°)
  const view = Math.max(2, (Math.atan2(cz - lz, Math.hypot(cx - lx, cy - ly)) * 180) / Math.PI), up = Math.sin((view * Math.PI) / 180) ** 0.6;
  const lin = (c) => c.map((v) => decodeSrgb(v / 255)), hexL = (c) => '#' + c.map((v) => Math.round(encodeSrgb(Math.max(0, Math.min(1, v))) * 255).toString(16).padStart(2, '0')).join('');
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
    { id: 'rock', cut: 'strata', metres: 6, role: 'stone' }, { id: 'scree', cut: 'scree', metres: 4, role: 'stone' },
    // (the cover's slot: dirt, on every land; on a green one the undergrowth grows over it, its own slot last)
    { id: 'soil', cut: 'soil', metres: 1.5, role: 'floor' },
    { id: 'sand', cut: 'sand', metres: 1.5, role: 'sand' },
    dress.surface === 'sand' ? { id: 'path', cut: 'sand', metres: 1.5, role: 'sand' } : { id: 'path', cut: 'powder', metres: 1.2, role: 'floor' },
    // (the dirt's other half: clay's clods)
    { id: 'clay', cut: 'clay', metres: 1.4, role: 'floor' },
    // (what grows under the grass, over the dirt, on a green land)
    { id: 'undergrowth', cut: 'undergrowth', metres: 1.0, role: 'grass' }];
  const GREEN = L.faces.some((F) => F.cls === 'ground');
  const TEX = ATLAS_TEX, LY = landLayers(P.faces, L, { seed: 3 }), layered = (F, i) => LY.layered(i) && !!F;
  // (the layers' textures are the cuts', the same for every cube: painted once per dress surface and kept)
  const { A, means, png, dicePng } = layerAtlas(LAYERS, dress.surface);
  // the path's mask as the page reads it: the weight a byte, the trail's height two (over the trail's own span)
  // (the mask's distance SIGNED: inside the trail negative, to SD_IN deep, so its edge can feather both ways)
  const SD_IN = 1.5, PM = LY.path, pathTex = PM && (() => {
    let zlo = Infinity, zhi = -Infinity; for (let k = 0; k < PM.z.length; k++) if (PM.weight[k] > 0) { zlo = Math.min(zlo, PM.z[k]); zhi = Math.max(zhi, PM.z[k]); }
    const span = Math.max(1e-6, zhi - zlo), px = new Uint8Array(PM.weight.length * 4);
    for (let k = 0; k < PM.weight.length; k++) { const q = Math.round(((PM.z[k] - zlo) / span) * 65535); px[k * 4] = Math.round(PM.weight[k] * 255); px[k * 4 + 1] = Math.round(((PM.dist[k] - PM.inside[k] + SD_IN) / (SD_IN + PATH_REACH)) * 255); px[k * 4 + 2] = q >> 8; px[k * 4 + 3] = q & 255; }
    return { origin: PM.origin, size: PM.size, metres: PM.size.map((n) => n * PM.cell), cell: PM.cell, z: [zlo, span], px: b64(px) };
  })();
  // (the cover's dirt, under the undergrowth on a green land, the theorist's humus; the bare island's soil its own floor)
  const roleBase = LAYERS.map((Ly, li) => (li === 2 && GREEN ? hexL(lin(hexRgb(soilTones(C.colour.floor).humus)).map((v, c) => light.linearBases.floor[c] * v / Math.max(1e-6, lin(hexRgb(C.colour.floor))[c]))) : bases[Ly.role])).map((h) => hexRgb(h));
  // the sand under the line, corner by corner, as form/land-form.js fades it into the deep water's colour: every sand
  // face, the ones the line crosses too, so the sand meets its shallows without a step at a face's edge
  const sandZ = P.faces.flatMap((f, i) => (L.faces[i].cls === 'sand' ? f.corners.map((c) => c[2]) : []));
  const FADE = L.waterZ === null ? DEEP_FADE : Math.max(DEEP_FADE, L.waterZ - Math.min(L.waterZ, ...sandZ)), sandBase = hexRgb(bases.sand);
  const underAt = (z) => { const lost = Math.min(1, Math.max(0, (L.waterZ - z) / FADE)) ** 2; return sandBase.map((v, c) => Math.round(v * UNDER_TONE * (1 - lost) + L.deep[c] * lost)); };

  // faces ordered by their material (a class, wet or dry), triangulated as fans, each corner carrying both halves' colours
  // and the gate's bucket: 1 a cliff turned to the hour's sun, 2 one turned away, 3 wet sand, 4 dry sand
  const keyOf = (i) => { const F = L.faces[i]; return F.cls ? `${F.cls}${F.under ? ':under' : F.wet ? ':wet' : ''}` : 'unread'; };
  const order = P.faces.map((_, i) => i).sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : a - b));
  // the land SHADED SMOOTH (6.5's lesson: a faceted ground draws its faces' edges through every transition): a corner's
  // normal the mean of the faces round it that lie within CREASE of the face's own, so a cliff's edge stays crisp
  const CREASE = Math.cos((55 * Math.PI) / 180), nKey = (c) => `${Math.round(c[0] * 100)},${Math.round(c[1] * 100)},${Math.round(c[2] * 100)}`, NB = new Map();
  P.faces.forEach((f, i) => { if (!L.faces[i].cls || L.faces[i].cls === 'water' || L.faces[i].under) return; const n = f.normal || [0, 0, 1]; for (const c of f.corners) (NB.get(nKey(c)) ?? NB.set(nKey(c), []).get(nKey(c))).push(n); });
  const smoothAt = (c, n) => { const m = [0, 0, 0]; for (const q of NB.get(nKey(c)) || [n]) if (q[0] * n[0] + q[1] * n[1] + q[2] * n[2] >= CREASE) { m[0] += q[0]; m[1] += q[1]; m[2] += q[2]; } const l = Math.hypot(...m) || 1; return m.map((v) => Math.round((v / l) * 127)); };
  const pos = [], c7 = [], spl = [], nrm = [], faceOf = [], cornerOf = [], ranges = [];
  for (const i of order) {
    const f = P.faces[i], F = L.faces[i], key = keyOf(i), n = f.normal || [0, 0, 1];
    const alpha = f.cornerAlpha || f.corners.map(() => 1);
    // (a layered face's corner: its layers' weights, and its base their solved bases by weight; wet sand keeps its own)
    const wAt = (j) => (layered(F, i) ? LY.weightAt(f.corners[j]) : F.under ? [0, 0, 0, 1] : [0, 0, 0, 0]);
    const base = F.cls ? F.base : hexRgb(f.fill), baseAt = (j) => (F.cls === 'sand' && L.waterZ !== null && f.corners[j][2] <= L.waterZ ? underAt(f.corners[j][2]) : F.corners ? F.corners[j] : layered(F, i) ? [0, 1, 2].map((c) => Math.round(wAt(j).reduce((s, x, li) => s + x * roleBase[li][c], 0))) : base);
    let R = ranges[ranges.length - 1];
    if (!R || R.key !== key) ranges.push(R = { key, start: pos.length / 3, count: 0, rough: F.cls ? F.rough : 0.9 });
    for (let k = 1; k + 1 < f.corners.length; k++) for (const j of [0, k, k + 1]) {
      pos.push(...f.corners[j]); c7.push(...baseAt(j), Math.round(alpha[j] * 255)); faceOf.push(i); cornerOf.push(j); spl.push(...wAt(j).map((x) => Math.round(x * 255))); nrm.push(...smoothAt(f.corners[j], n)); R.count += 1;
    }
  }
  // the shadow's frame: what stands above the water, not the sea's floor or the sea to the horizon
  const land = P.faces.filter((f, i) => L.faces[i].cls && L.faces[i].cls !== 'water' && !L.faces[i].under).flatMap((f) => f.corners);
  const sea = P.faces.filter((f, i) => L.faces[i].cls === 'water').flatMap((f) => f.corners), seaX = sea.map((c) => c[0]), seaY = sea.map((c) => c[1]);
  const box = [0, 1, 2].map((k) => [Math.min(...land.map((c) => c[k])), Math.max(...land.map((c) => c[k]))]);
  const isle = (P.cameras.find((c) => c.name === 'island') ?? P.cameras[0])?.worldFraming.lookAt || [0, 0, 0];
  const wetMids = P.faces.flatMap((f, i) => (L.faces[i].wet && !L.faces[i].under ? [[0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length)] : []));
  // (a land with no sea, the path's: no shore, its readings and its camera left out)
  const hasSea = L.waterZ !== null && wetMids.length > 0, shoreAt = hasSea ? wetMids.reduce((a, m) => (m[0] > a[0] ? m : a), wetMids[0]) : [isle[0] + 1, isle[1], isle[2]];
  // THE SEA ONE SURFACE: the payload's sea faces end on whole cells, so their edge on the beach is a saw; the gen-7 half
  // draws the sea as one plane at the line instead (where it meets the beach is then the beach's own contour) and fades
  // it in over the depth under it (to DEPTH_MAX, the floor's fade: the shallows show their sand), read from the land
  // rasterized from above (DEPTH_CELL metres; DEPTH_MAX deep a byte)
  const DEPTH_CELL = 0.5, DEPTH_MAX = DEEP_FADE, depthMap = !hasSea ? null : (() => {
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
  // THE SCREE'S STONES (form/land-stones.js): the larger stones stood up as real ones where the scree is, lit and shadowed;
  // the finer ones stay the layer's (its normal map, its parallax near)
  // the DIRT'S TWO TONES (color-theorist/ground.js soilTones): the floor's powder and clay as targets, their bases the floor's
  // solved base moved by each target's share of the floor's (so the light that shows the floor shows them)
  const tones = soilTones(C.colour.floor, light.sun.color), floorLin = lin(hexRgb(C.colour.floor));
  const dirtBase = Object.fromEntries(Object.entries(tones).map(([k, t]) => [k, lin(hexRgb(t)).map((v, c) => Math.round(light.linearBases.floor[c] * v / Math.max(1e-6, floorLin[c]) * 1e4) / 1e4)]));
  const STONES = landStones(P.faces, LY, { seed: 3, rubble: dress.rubble }), stoneBase = light.linearBases.stone;
  const stonePack = Float32Array.from(STONES.flatMap((q) => [...q.at, q.r, ...q.n, q.tone, q.v]));
  // THE GRASS (gen-7): the ground seen from above at GCELL (its height, and where grass grows: a green land's level ground,
  // off the trail), read by the near blades on the page; and the FAR, rows of brushes laid along the ground both ways
  const GCELL = 0.5, grassMap = GREEN && withGrass ? (() => {
    const x0 = box[0][0] - 2, y0 = box[1][0] - 2, nx = Math.ceil((box[0][1] + 2 - x0) / GCELL) + 1, ny = Math.ceil((box[1][1] + 2 - y0) / GCELL) + 1;
    const top = new Float32Array(nx * ny).fill(-Infinity), cov = new Float32Array(nx * ny);
    P.faces.forEach((f, i) => {
      const F = L.faces[i]; if (!F.cls || F.cls === 'water' || F.cls === 'crown' || F.cls === 'wood') return;
      const n = f.normal || [0, 0, 1], green = F.cls === 'ground' && n[2] > 0.75 ? 1 : 0;
      for (let k = 1; k + 1 < f.corners.length; k++) {
        const [a, b, c] = [f.corners[0], f.corners[k], f.corners[k + 1]], det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(det) < 1e-9) continue;
        const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / GCELL)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / GCELL));
        const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - y0) / GCELL)), j1 = Math.min(ny - 1, Math.ceil((Math.max(a[1], b[1], c[1]) - y0) / GCELL));
        for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
          const x = x0 + ii * GCELL, y = y0 + j * GCELL, l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det, l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const z = l1 * a[2] + l2 * b[2] + l3 * c[2], q = j * nx + ii; if (z > top[q]) { top[q] = z; cov[q] = green; }
        }
      }
    });
    // (and where grass grows at all: a field wandering at two scales, so the land has its bare stretches, the grass thinning
    // out toward them rather than stopping at a line)
    const lat = (x, y, cell, tag) => { const u = x / cell, v = y / cell, i = Math.floor(u), j = Math.floor(v), e = (t) => t * t * (3 - 2 * t), a = e(u - i), b = e(v - j), h = (p, q) => strHash(`3|${tag}|${p},${q}`) / 4294967296;
      return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b; };
    const ease = (t) => t * t * (3 - 2 * t);
    for (let j = 0; j < ny; j++) for (let ii = 0; ii < nx; ii++) { const x = x0 + ii * GCELL, y = y0 + j * GCELL, n = 0.65 * lat(x, y, 7, 'grass-at') + 0.35 * lat(x, y, 2.5, 'grass-at2'); cov[j * nx + ii] *= ease(Math.min(1, Math.max(0, (n - 0.27) / 0.2))); }
    // (off the trail: the path's mask takes the grass, its weight past a half)
    if (PM) for (let j = 0; j < ny; j++) for (let ii = 0; ii < nx; ii++) {
      const x = x0 + ii * GCELL, y = y0 + j * GCELL, pi = Math.round((x - PM.origin[0]) / PM.cell), pj = Math.round((y - PM.origin[1]) / PM.cell);
      if (pi >= 0 && pj >= 0 && pi < PM.size[0] && pj < PM.size[1]) { const d = PM.dist[pj * PM.size[0] + pi] - PM.inside[pj * PM.size[0] + pi]; cov[j * nx + ii] *= Math.min(1, Math.max(0, (d - 0.1) / 0.6)); }
    }
    let zlo = Infinity, zhi = -Infinity; for (const z of top) if (z > -Infinity) { zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
    const span = Math.max(1e-6, zhi - zlo), px = new Uint8Array(nx * ny * 4);
    // (the sward: how long the grass is, a mood's choice: tall everywhere, short everywhere, or a share of the grass laid as
    // short areas a couple of dozen metres across, each wholly one or the other, eased over a seam: the field's rank over
    // the grass's own cells, so the share is the land's whatever its size)
    // (a cell of grass: one the map shows as any cover at all)
    const shortShare = sward === 'short' ? 1 : sward === 'tall' || !sward ? 0 : sward.short, cellXY = (q) => [x0 + (q % nx) * GCELL, y0 + Math.floor(q / nx) * GCELL], isGrass = (q) => Math.round(cov[q] * 255) > 0;
    const swardF = (x, y) => 0.7 * lat(x, y, SWARD_CELL, 'sward') + 0.3 * lat(x, y, SWARD_CELL / 3, 'sward2');
    const ranks = shortShare > 0 && shortShare < 1 ? Float64Array.from(cov.reduce((a, c, q) => (isGrass(q) ? (a.push(swardF(...cellXY(q))), a) : a), [])).sort() : null;
    const rankOf = (f) => { let lo = 0, hi = ranks.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ranks[m] < f) lo = m + 1; else hi = m; } return lo / Math.max(1, ranks.length); };
    const shortAt = (x, y) => (shortShare >= 1 ? 1 : shortShare <= 0 || !ranks.length ? 0 : ease(Math.min(1, Math.max(0, (shortShare - rankOf(swardF(x, y))) / SWARD_SEAM + 0.5))));
    for (let q = 0; q < nx * ny; q++) { const zq = top[q] === -Infinity ? 0 : Math.round(((top[q] - zlo) / span) * 65535); px[q * 4] = zq >> 8; px[q * 4 + 1] = zq & 255; px[q * 4 + 2] = Math.round(cov[q] * 255); px[q * 4 + 3] = Math.round(shortAt(...cellXY(q)) * 255); }
    // (the drifts: each its own field at a finer cell, ranked to its share over the grass's cells no drift named before it
    // has taken, a channel each; so each holds its share of the land's grass, and no two share a cell)
    const dpx = drifts.length ? new Uint8Array(nx * ny * 4) : null, nGrass = cov.reduce((a, c, q) => a + (isGrass(q) ? 1 : 0), 0);
    drifts.forEach((Dr, k) => {
      const f = (x, y) => 0.7 * lat(x, y, DRIFT_CELL, `drift:${Dr.id}`) + 0.3 * lat(x, y, DRIFT_CELL / 3, `drift2:${Dr.id}`);
      const free = (q) => { if (!isGrass(q)) return false; for (let e = 0; e < k; e++) if (dpx[q * 4 + e] > 127) return false; return true; };
      const R = []; for (let q = 0; q < nx * ny; q++) if (free(q)) R.push(f(...cellXY(q)));
      if (!R.length) return;
      const S = Float64Array.from(R).sort(), share = Math.min(1, (Dr.share * nGrass) / S.length);
      const rank = (v) => { let lo = 0, hi = S.length; while (lo < hi) { const m = (lo + hi) >> 1; if (S[m] < v) lo = m + 1; else hi = m; } return lo / S.length; };
      for (let q = 0; q < nx * ny; q++) if (free(q)) dpx[q * 4 + k] = Math.round((share >= 1 ? 1 : ease(Math.min(1, Math.max(0, (share - rank(f(...cellXY(q)))) / DRIFT_SEAM + 0.5)))) * 255);
    });
    const at = (x, y) => { const ii = Math.round((x - x0) / GCELL), j = Math.round((y - y0) / GCELL); if (ii < 0 || j < 0 || ii >= nx || j >= ny) return null; const q = j * nx + ii; return top[q] === -Infinity ? null : { z: top[q], c: cov[q] }; };
    return { origin: [x0, y0], cell: GCELL, size: [nx, ny], z: [zlo, span], px: b64(px), at, ...(dpx ? { drift: b64(dpx) } : {}) };
  })() : null;
  // the far: fins along the ground in rows three ways (60° apart, ROW apart, SEG long), each row's line wandering so the
  // rows weave rather than rule, each fin from the ground up a height that wanders (its bristles drawn on the page), only
  // where grass grows; the page dissolves them in past the near blades
  const ROW = 0.9, SEG = 0.8, brush = { pos: [], uvh: [] }, cx0 = (box[0][0] + box[0][1]) / 2, cy0 = (box[1][0] + box[1][1]) / 2, half = Math.hypot(box[0][1] - box[0][0], box[1][1] - box[1][0]) / 2;
  const u01b = (k) => strHash(k) / 4294967296;
  // (the drifts' plants, the library's, their colours carried into the cube's light by the ratio its grass was solved by)
  const gTarget = C.colour.grass ? lin(hexRgb(C.colour.grass)) : null;
  const driftKinds = grassMap?.drift ? drifts.map((d) => driftForms(d, gTarget ? light.linearBases.grass.map((v, k) => v / Math.max(1e-6, gTarget[k])) : [1, 1, 1])) : null;
  // (`grass: 'map'`, the World page's read: the map alone, the page grows its brush; channels/form-grass.js)
  if (grassMap && withGrass !== 'map') for (let dir = 0; dir < 3; dir++) {
    const a = (dir * Math.PI) / 3 + 0.21, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    for (let r = -half; r <= half; r += ROW) for (let u = -half; u < half; u += SEG) {
      // (the row's offset at each end: its own wander, shared by the fins either side so the row runs on unbroken)
      const off = (uu) => (u01b(`w|${dir}|${r.toFixed(2)}|${uu.toFixed(2)}`) - 0.5) * ROW * 0.7;
      const P0 = [cx0 + ux * u + vx * (r + off(u)), cy0 + uy * u + vy * (r + off(u))], P1 = [cx0 + ux * (u + SEG) + vx * (r + off(u + SEG)), cy0 + uy * (u + SEG) + vy * (r + off(u + SEG))];
      const g0 = grassMap.at(...P0), g1 = grassMap.at(...P1);
      if (!g0 || !g1 || g0.c < 0.5 || g1.c < 0.5) continue;
      const h0 = (0.18 + 0.24 * u01b(`b|${dir}|${r.toFixed(2)}|${u.toFixed(2)}`)) * (0.5 + 0.5 * g0.c), h1 = (0.18 + 0.24 * u01b(`b|${dir}|${r.toFixed(2)}|${(u + SEG).toFixed(2)}`)) * (0.5 + 0.5 * g1.c);
      const q = [[...P0, g0.z - 0.02], [...P1, g1.z - 0.02], [...P1, g1.z + h1], [...P0, g0.z + h0]];
      for (const k of [0, 1, 2, 0, 2, 3]) { brush.pos.push(...q[k]); brush.uvh.push(u + (k === 1 || k === 2 ? SEG : 0), k >= 2 ? 1 : 0, k === 2 ? h1 : k === 3 ? h0 : 0); }
    }
  }

  return { P, L, own, light, sun, view, sees, water, bases, LAYERS, GREEN, LY, TEX, A, means, png, dicePng, SD_IN, PM, pathTex, roleBase, FADE, underAt,
    ranges, pos, c7, spl, nrm, faceOf, cornerOf, land, sea, seaX, seaY, box, isle, wetMids, hasSea, shoreAt, DEPTH_CELL, DEPTH_MAX, depthMap,
    tones, dirtBase, STONES, stonePack, stoneBase, GCELL, grassMap, driftKinds, ROW, SEG, brush, dress, moss,
    // the rock's relief (form/rock-relief.js): the cliff's ledges and cracks as a map the page displaces its faces by
    relief: relief ? reliefMap(readRelief(relief), { seed: reliefSeed }) : null };
}

export function formPayload(R) {
  const { P, L, light, sun, bases, water, LAYERS, GREEN, TEX, A, means, png, dicePng, SD_IN, pathTex, ranges, pos, c7, spl, nrm, box, seaX, seaY, hasSea, depthMap, dirtBase, STONES, stonePack, stoneBase, dress, relief, moss, grassMap, driftKinds } = R;
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return {
    hides: [...new Set(P.faces.filter((f, i) => L.faces[i].cls).map((f) => f.group))].sort(),
    sun, sky: { zenith: P.sky.zenith, horizon: P.sky.horizon }, box, waterZ: L.waterZ, deep: L.deep,
    seabed: hasSea ? { x: [Math.min(...seaX), Math.max(...seaX)], y: [Math.min(...seaY), Math.max(...seaY)], z: L.waterZ - DEEP_FADE - 1 } : null,
    classes: Object.fromEntries(Object.entries(LAND_CLASSES).map(([k, K]) => [k, K.rough])),
    ranges, pos: b64(Float32Array.from(pos)), c7: b64(Uint8Array.from(c7)), spl: b64(Uint8Array.from(spl)), nrm: b64(Int8Array.from(nrm)),
    wet: { z: L.waterZ, band: WET_BAND, tone: WET_TONE, rough: WET_ROUGH },
    light: { sun: light.sun.linear, ambient: light.ambient.linear, sea: { base: bases.water } },
    dress: { surface: dress.surface, clay: dress.clay, rubble: dress.rubble, dust: dress.dust, patches: ['worn', 'damp', 'gravel'].map((k) => (dress.patches.includes(k) ? 1 : 0)), reach: PATH_REACH, sdIn: SD_IN },
    // (the stones' shapes as the rock studies break a rock, form/land-stones.js stoneForms: chipped near, the block far)
    stones: { n: STONES.length, shapes: SHAPES, base: stoneBase, px: b64(new Uint8Array(stonePack.buffer)),
      forms: Object.fromEntries(Object.entries(stoneForms()).map(([k, L]) => [k, L.map((f) => ({ pos: b64(new Uint8Array(f.pos.buffer)), nrm: b64(Int8Array.from(f.nrm, (x) => Math.round(x * 127))) }))])) },
    layers: { base: png(A.base), normal: png(A.normal), orm: png(A.orm), mean: means, tile: LAYERS.map((Ly) => Ly.metres), keys: Object.keys(LAYER_OF),
      pathBase: dress.surface === 'sand' ? light.linearBases.sand : dirtBase.powder, clayBase: dirtBase.clay, underBase: light.linearBases.grass.map((v) => r4(v * 0.82)),
      green: GREEN, stoneBase: light.linearBases.stone, dice: dicePng, size: TEX, ...(moss ? { moss } : {}) },
    path: pathTex, depth: depthMap,
    // (the grass's ground map: its height and where grass grows, at GCELL; channels/form-grass.js draws the grass from it)
    grass: grassMap && { origin: grassMap.origin, cell: grassMap.cell, size: grassMap.size, z: grassMap.z, px: grassMap.px, base: light.linearBases.grass,
      // (the drifts: their map, a channel each, and their plants)
      ...(driftKinds ? { drifts: { px: grassMap.drift, kinds: driftKinds } } : {}) },
    // (the relief's heights in 16 bits over its range, row by row up the face)
    relief: relief && { tile: relief.tile, size: relief.size, lo: r4(relief.lo), hi: r4(relief.hi), px: b64(new Uint8Array(Uint16Array.from(relief.h, (v) => Math.round(((v - relief.lo) / Math.max(1e-6, relief.hi - relief.lo)) * 65535)).buffer)) },
  };
}
