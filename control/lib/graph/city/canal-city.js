/**
 * canal-city — the `profile: 'canal'` planner: a Low Countries canal town (Amsterdam's canal ring
 * first, a Delft / Leiden parallel-canal grid second) at metro's true scale.
 *
 * The stock and metro planners lay out a quad-tree of streets. A canal town is not that shape: its
 * primary network is WATER (concentric U-rings, or parallel lines), and its streets are secondary:
 * a quay on each bank and short cross streets that bridge the canals. So this planner owns its own
 * layout and hands back the same plan shape (boxes / grounds / ribbons / faces / sources / stats /
 * cues) that assembleFractalCityScene renders.
 *
 * Layout. A layout is an OFFSET field over the frame and a list of BANDS over the offset (core,
 * quay, water, quay, block, … outward), plus STREET rects. The ring's offset is the Chebyshev
 * distance from a centre on the frame's far edge (so each band is a squared-off U open to that edge);
 * the parallel layout's offset is plain y. A breakpoint grid over every band and street edge
 * classifies each cell (water, bridge, quay, junction, street, land) and merges land into block
 * rects; each block edge knows what it fronts, and house rows go on the edges that front a quay or a
 * street, quay rows first.
 *
 * Height is a property of the stock, not a dial: houses are 3–5 floors with a gable, nothing is
 * drawn from a tower generator, and the one mass allowed above the eaves band is a church steeple.
 * Real-world bands and their sources: the canal-city plan's reference sheet.
 *
 * Deterministic: one mulberry32 stream off the seed (salted, so a canal recipe never shares the
 * stock stream), no Math.random, Date or Intl.
 */
import { makeRowhouseFacade } from '../architecture/building-facade.js';
import { RIDGE_T } from '../architecture/canal-house.js';
import { groundStreet } from './roads.js';
import { vehicleAntFaces } from '../vehicles/vehicles-css3d.js';
import { pedestrianFaces, IDLE_POSES, STROLL_POSES, PALETTES } from '../figures/pedestrian-asset.js';
import { METRO, CITY_METERS_PER_UNIT } from './fractal-city.js';
import * as dmath from '../../util/dmath.js';

// Every value is in city units at CITY_METERS_PER_UNIT (3.66 m). Bands: the plan's reference sheet.
export const CANAL = {
  region: { x: 2, y: 2, w: 240, d: 150 },   // ≈ 880 × 550 m: the old core, three rings and part of a fourth
  water: 7.4,              // ring canal ≈ 27 m (Keizersgracht 28.3 m)
  quay: 2.5,               // each bank ≈ 9.2 m, water edge → facade:
  quayParts: { trees: 0.6, park: 0.55, lane: 0.85, walk: 0.5 },
  block: 23,               // facade to facade across a ring block ≈ 84 m (a canal interval ≈ 130 m)
  core: 22,                // the old core's half-size inside the first canal (≈ 160 × 80 m)
  freeboard: 0.3,          // water ≈ 1.1 m below the quay
  bed: 0.7,
  street: { w: 2.1, lane: 1.4, spacing: [50, 66], first: [16, 30] },   // ≈ 7.7 m cross streets, a bridge every 180–240 m
  coreStreet: { w: 1.6, lane: 1.0, spacing: [10, 15] },                // the old core's lanes ≈ 5.9 m
  house: {
    front: [1.4, 2.3], streetFront: [1.3, 2.0], double: [3.2, 4.6], doubleP: 0.1,
    depth: [4.6, 7.5], garden: 2.2,                                      // ≈ 17–27 m deep; a garden strip always survives
    ground: 1.07, upper: 0.85, parapet: 0.12,                            // a 3.9 m ground floor, 3.1 m uppers
    pitch: [50, 57], maxTop: 6.25,                                       // gable tops stay under ≈ 23 m (mid-rise is barred)
  },
  gables: { quay: { cornice: 0.45, neck: 0.2, bell: 0.2, spout: 0.08, step: 0.07 }, street: { cornice: 0.6, spout: 0.15, neck: 0.1, bell: 0.1, step: 0.05 } },
  bridge: { hump: 0.3, parapet: 0.25, arch: { span: 1.9, rise: 0.57 }, side: { span: 1.2, rise: 0.42 }, threeP: 0.4 },
  boat: { len: [5.5, 6.8], w: 1.37, h: 0.68, gap: 0.55, clear: 2.7, p: 0.45 },
  tree: [3.2, 4.2], lampEvery: 2, carStep: 1.45, carP: 0.32, carMesh: { ns: 5, na: 6 },   // parked cars are seen from a quay: a lighter shell
  budget: { cyclists: 16, people: 90 },   // riders (~3.5k faces) and walkers (~1.8k) are the heavy dressing: a frame-wide cap
  church: { nave: [15, 18], width: [6.4, 7.4] },
};
const PAINTED = ['#e4dfd3', '#d6cab0', '#2b2d2b', '#28362d'];   // white / cream stucco, black, dark green
const BRICK = ['#6e3a2e', '#7a4232', '#5a342b', '#8a4a36', '#4a3530', '#6a4a3a', '#7c5a44', '#643b30'];
const ROOFS = ['#3b3e44', '#43464c', '#34373c', '#7a3f2e', '#6b3a2c', '#4a4c50'];   // slate / black glazed pantile / red pantile
const FRAME = '#e6dfcc';   // "Bentheimer" cream window frames
const DOOR = ['#1c2b22', '#1f2a24', '#23201d', '#2a1d1b'];     // "grachtengroen" and near-blacks
const GROUND = { walk: '#8a857c', earth: '#4d4840', paving: '#6c5448', lawn: '#56643f', bed: '#1a211e', brick: '#8c5d4b', water: '#3c524e', waterNight: '#131b1d' };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
const within = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d;
const overlaps = (a, b, e = 1e-3) => a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.d - e && b.y < a.y + a.d - e;
function weighted(r, table) {
  const keys = Object.keys(table), tot = keys.reduce((s, k) => s + table[k], 0);
  let u = r * tot;
  for (const k of keys) { u -= table[k]; if (u <= 0) return k; }
  return keys[keys.length - 1];
}

// ── layouts ─────────────────────────────────────────────────────────────────────────────────────
// A layout: { offset(x, y), bands: [{ type, a, b, ring }] (ascending), streets: [{ x, y, w, d, axis }],
// legX: the offsets at which the field's contours cross the x axis (breakpoints), centre }.
function ringBands(maxOffset) {
  const C = CANAL, bands = [{ type: 'core', a: 0, b: C.core, ring: -1 }];
  let o = C.core, k = 0;
  while (o < maxOffset + 1e-6) {
    bands.push({ type: 'quay', a: o, b: o + C.quay, ring: k, side: 'in' });
    bands.push({ type: 'water', a: o + C.quay, b: o + C.quay + C.water, ring: k });
    bands.push({ type: 'quay', a: o + C.quay + C.water, b: o + 2 * C.quay + C.water, ring: k, side: 'out' });
    bands.push({ type: 'block', a: o + 2 * C.quay + C.water, b: o + 2 * C.quay + C.water + C.block, ring: k });
    o += 2 * C.quay + C.water + C.block; k++;
  }
  return bands;
}
const bandAt = (bands, o) => bands.find((b) => o >= b.a && o < b.b) || bands[bands.length - 1];
// how far in a street crossing the bands at `across` (its distance off the U's axis) reaches: it
// passes every band whose inner edge is clear of it and stops at the outer edge of the first band
// that is not — so it ends on a quay (a T into the quay road), never in a block or mid-canal
function reach(bands, across, hw) {
  for (let i = bands.length - 1; i >= 0; i--) if (bands[i].a <= across + hw) return bands[i].b;
  return 0;
}
function ringLayout(R, rng) {
  const C = CANAL, cx = R.x + R.w / 2, cy = R.y + R.d;
  const maxOffset = Math.max(R.w / 2, R.d);
  const bands = ringBands(maxOffset);
  const offset = (x, y) => Math.max(Math.abs(x - cx), cy - y);
  const streets = [], hw = C.street.w / 2;
  // cross streets on each leg (horizontal, from the frame's side edge in) and on the bottom run
  // (vertical, from the near edge up): independent sequences, so the two legs don't mirror
  for (const side of [-1, 1]) {
    for (let dy = lerp(...C.street.first, rng()); dy < R.d - 4; dy += lerp(...C.street.spacing, rng())) {
      const e = reach(bands, dy, hw), y = cy - dy - hw;
      const x0 = side < 0 ? R.x : cx + e, x1 = side < 0 ? cx - e : R.x + R.w;
      if (x1 - x0 > 1) streets.push({ x: x0, y, w: x1 - x0, d: C.street.w, axis: 'x' });
    }
    for (let dx = lerp(4, 14, rng()); dx < R.w / 2 - 4; dx += lerp(...C.street.spacing, rng())) {
      const e = reach(bands, dx, hw), x = cx + side * dx - hw;
      if (cy - e - R.y > 1) streets.push({ x, y: R.y, w: C.street.w, d: cy - e - R.y, axis: 'y' });
    }
  }
  // the old core: a finer lattice of lanes inside the first canal
  const S = C.coreStreet;
  for (let dy = lerp(6, 10, rng()); dy < C.core - 4; dy += lerp(...S.spacing, rng())) streets.push({ x: cx - C.core, y: cy - dy - S.w / 2, w: 2 * C.core, d: S.w, axis: 'x', core: true });
  for (let dx = -C.core + lerp(6, 10, rng()); dx < C.core - 4; dx += lerp(...S.spacing, rng())) streets.push({ x: cx + dx - S.w / 2, y: cy - C.core, w: S.w, d: C.core, axis: 'y', core: true });
  const xs = [], ys = [];
  for (const b of bands) for (const o of [b.a, b.b]) { xs.push(cx - o, cx + o); ys.push(cy - o); }
  return { kind: 'ring', offset, bands, streets, xs, ys, centre: { x: cx, y: cy } };
}
const PARALLEL_FIRST = CANAL.block * 0.5 + 2;
function parallelLayout(R, rng) {
  const C = CANAL, bands = [];
  let o = PARALLEL_FIRST, k = 0;   // no rng: the cameras read the canals off the recipe alone
  bands.push({ type: 'block', a: -1e9, b: o, ring: -1 });
  while (o < R.d + 1e-6) {
    bands.push({ type: 'quay', a: o, b: o + C.quay, ring: k, side: 'in' });
    bands.push({ type: 'water', a: o + C.quay, b: o + C.quay + C.water, ring: k });
    bands.push({ type: 'quay', a: o + C.quay + C.water, b: o + 2 * C.quay + C.water, ring: k, side: 'out' });
    bands.push({ type: 'block', a: o + 2 * C.quay + C.water, b: o + 2 * C.quay + C.water + C.block, ring: k });
    o += 2 * C.quay + C.water + C.block; k++;
  }
  const offset = (x, y) => y - R.y;
  const streets = [];
  for (let x = R.x + lerp(...C.street.first, rng()); x < R.x + R.w - 4; x += lerp(...C.street.spacing, rng())) streets.push({ x: x - C.street.w / 2, y: R.y, w: C.street.w, d: R.d, axis: 'y' });
  const ys = bands.flatMap((b) => [R.y + b.a, R.y + b.b]);
  return { kind: 'parallel', offset, bands, streets, xs: [], ys, centre: { x: R.x + R.w / 2, y: R.y } };
}

// ── the breakpoint grid ─────────────────────────────────────────────────────────────────────────
function classGrid(R, L) {
  const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const uniq = (vs) => [...new Set(vs.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  const xs = uniq([R.x, R.x + R.w, ...L.xs.map((v) => clip(v, R.x, R.x + R.w)), ...L.streets.flatMap((s) => [clip(s.x, R.x, R.x + R.w), clip(s.x + s.w, R.x, R.x + R.w)])]);
  const ys = uniq([R.y, R.y + R.d, ...L.ys.map((v) => clip(v, R.y, R.y + R.d)), ...L.streets.flatMap((s) => [clip(s.y, R.y, R.y + R.d), clip(s.y + s.d, R.y, R.y + R.d)])]);
  const cols = xs.length - 1, rows = ys.length - 1, cls = new Array(cols * rows), meta = new Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = (xs[i] + xs[i + 1]) / 2, y = (ys[j] + ys[j + 1]) / 2;
    const band = bandAt(L.bands, L.offset(x, y)), st = L.streets.find((s) => within(s, x, y));
    let c;
    if (band.type === 'water') c = st ? (st.axis === 'x' ? 'bridgeX' : 'bridgeY') : 'water';
    else if (band.type === 'quay') c = st ? 'junction' : 'quay';
    else c = st ? (st.core ? 'lane' : 'street') + st.axis.toUpperCase() : 'land';
    cls[j * cols + i] = c; meta[j * cols + i] = { band, street: st || null };
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rows ? null : cls[j * cols + i]);
  return { xs, ys, cols, rows, cls, meta, at };
}
// maximal rects of one class: row runs, then runs stacked with the same x-span
function mergeClass(G, want) {
  const rects = [], open = new Map();
  for (let j = 0; j < G.rows; j++) {
    const runs = [];
    for (let i = 0; i < G.cols; i++) {
      if (!want(G.at(i, j))) continue;
      const i0 = i; while (i + 1 < G.cols && want(G.at(i + 1, j)) && G.at(i + 1, j) === G.at(i0, j)) i++;
      runs.push([i0, i, G.at(i0, j)]);
    }
    const next = new Map();
    for (const [i0, i1, c] of runs) {
      const key = `${i0},${i1},${c}`, prev = open.get(key);
      if (prev) { prev.j1 = j; next.set(key, prev); open.delete(key); } else next.set(key, { i0, i1, j0: j, j1: j, cls: c });
    }
    for (const r of open.values()) rects.push(r);
    open.clear(); for (const [k, v] of next) open.set(k, v);
  }
  for (const r of open.values()) rects.push(r);
  return rects.map((r) => ({ ...r, x: G.xs[r.i0], y: G.ys[r.j0], w: G.xs[r.i1 + 1] - G.xs[r.i0], d: G.ys[r.j1 + 1] - G.ys[r.j0] }));
}
// what lies beyond one side of a cell rect: runs of [lo, hi, class] along that side
function sideRuns(G, r, side) {
  const out = [];
  const horiz = side === 'S' || side === 'N';
  const n0 = horiz ? r.i0 : r.j0, n1 = horiz ? r.i1 : r.j1;
  for (let k = n0; k <= n1; k++) {
    const c = side === 'S' ? G.at(k, r.j0 - 1) : side === 'N' ? G.at(k, r.j1 + 1) : side === 'W' ? G.at(r.i0 - 1, k) : G.at(r.i1 + 1, k);
    const lo = horiz ? G.xs[k] : G.ys[k], hi = horiz ? G.xs[k + 1] : G.ys[k + 1];
    const last = out[out.length - 1];
    if (last && last[2] === c && Math.abs(last[1] - lo) < 1e-6) last[1] = hi; else out.push([lo, hi, c]);
  }
  return out;
}
const FRONT = { quay: 2, junction: 2, streetX: 1, streetY: 1, laneX: 1, laneY: 1 };
const FACE_OF = { S: '-y', N: '+y', W: '-x', E: '+x' };

// ── canal houses ────────────────────────────────────────────────────────────────────────────────
function houseSpec(rng, kind, W, D) {
  const H = CANAL.house, dbl = W > 2.65;
  const r = rng();
  const floors = kind === 'quay' ? (r < 0.12 ? 3 : r < 0.62 ? 4 : 5) : (r < 0.1 ? 2 : r < 0.7 ? 3 : 4);
  const z1 = H.ground + (floors - 1) * H.upper + H.parapet;
  const painted = rng() < 0.12;
  const wall = painted ? PAINTED[Math.floor(rng() * PAINTED.length)] : BRICK[Math.floor(rng() * BRICK.length)];
  const roofTint = ROOFS[Math.floor(rng() * ROOFS.length)];
  if (dbl) {
    const hr = Math.min(1.3, D * 0.45, H.maxTop - z1);
    return { floors, z1, wall, roofTint, gable: 'cornice', ridge: 'parallel', ridgeH: hr, gableH: 0.35, topZ: z1 + Math.max(hr, 0.35), painted };
  }
  const gable = weighted(rng(), CANAL.gables[kind]);
  const pitch = (lerp(...H.pitch, rng()) * Math.PI) / 180;
  let hr = (W / 2) * dmath.tan(pitch);
  let gh = gable === 'cornice' ? hr : hr / RIDGE_T;
  const room = H.maxTop - z1;
  if (gh > room) { const k = room / gh; gh *= k; hr *= k; }   // a flatter roof, never a taller house than the ring allows
  return { floors, z1, wall, roofTint, gable, ridge: 'perp', ridgeH: hr, gableH: gh, topZ: z1 + (gable === 'cornice' ? hr : gh), painted };
}
// lay one attached row of houses along a block side; returns the units placed
function houseRow(ctx, { block, side, lo, hi, kind, depth, cornerLo, cornerHi }) {
  const { rng, boxes, faces, houses, blocked } = ctx, H = CANAL.house;
  const horiz = side === 'S' || side === 'N';
  const range = kind === 'quay' ? H.front : H.streetFront;
  const units = [];
  let pos = lo;
  while (hi - pos > 0.9) {
    let W = kind === 'quay' && rng() < H.doubleP ? lerp(...H.double, rng()) : lerp(...range, rng());
    if (hi - pos - W < range[0] * 0.85) W = hi - pos;            // the last lot takes the remainder
    if (W > H.double[1]) W = (hi - pos) / 2;                      // …unless that would be wider than a double lot
    units.push([pos, pos + W]); pos += W;
  }
  let placed = 0;
  units.forEach(([a, b], idx) => {
    const W = b - a, first = idx === 0, last = idx === units.length - 1;
    const D = (first && cornerLo) || (last && cornerHi) ? depth : lerp(Math.min(H.depth[0], depth), depth, rng());
    const rect = side === 'S' ? { x: a, y: block.y, w: W, d: D } : side === 'N' ? { x: a, y: block.y + block.d - D, w: W, d: D }
      : side === 'W' ? { x: block.x, y: a, w: D, d: W } : { x: block.x + block.w - D, y: a, w: D, d: W };
    if (blocked.some((o) => overlaps(o, rect)) || houses.some((o) => overlaps(o, rect))) return;
    const spec = houseSpec(rng, kind, W, D);
    const face = FACE_OF[side];
    const bays = W < 1.7 ? 2 : W < 2.65 ? 3 : Math.max(4, Math.round(W / 0.85));
    const facade = { ...makeRowhouseFacade('dutch-row', (ctx.seed * 7919 + ctx.houseCount * 2654435761) >>> 0, ctx.houseCount), glass: spec.wall, frame: FRAME, floorH: spec.z1 / spec.floors, bayW: W / bays };
    const box = { kind: 'canalhouse', ...rect, z0: 0, z1: spec.z1, face, row: kind, gable: spec.gable, ridge: spec.ridge, ridgeH: spec.ridgeH, gableH: spec.gableH, topZ: spec.topZ, floors: spec.floors, bays, roofTint: spec.roofTint, trim: FRAME, facade, canal: true };
    boxes.push(box); houses.push(rect); ctx.houseCount++; placed++;
    dressHouse(ctx, box, W, rng);
  });
  return placed;
}
// the stoop and door on the front, and the hoisting beam under the gable's peak
function dressHouse(ctx, b, W, rng) {
  const { boxes, faces } = ctx;
  const f = b.face, out = f === '-y' || f === '-x' ? -1 : 1, alongX = f === '-y' || f === '+y';
  const front = f === '-y' ? b.y : f === '+y' ? b.y + b.d : f === '-x' ? b.x : b.x + b.w;
  const s0 = alongX ? b.x : b.y;
  const doorAt = s0 + W * (rng() < 0.5 ? 0.24 : 0.76), doorW = Math.min(0.32, W * 0.2);
  const onFront = (s, sw, depthOut, z0, z1, kind, tint) => (alongX
    ? { kind, x: s - sw / 2, y: out > 0 ? front : front - depthOut, w: sw, d: depthOut, z0, z1, tint }
    : { kind, x: out > 0 ? front : front - depthOut, y: s - sw / 2, w: depthOut, d: sw, z0, z1, tint });
  boxes.push(onFront(doorAt, doorW + 0.22, 0.34, 0, 0.16, 'canal-stoop', '#8d877c'));
  boxes.push(onFront(doorAt, doorW + 0.22, 0.2, 0.16, 0.32, 'canal-stoop', '#948e83'));
  const p = (s, z) => (alongX ? [s, front + out * 0.012, z] : [front + out * 0.012, s, z]);
  faces.push({ kind: 'canal-door', doubleSided: true, fill: DOOR[Math.floor(rng() * DOOR.length)], corners: [p(doorAt - doorW / 2, 0.32), p(doorAt + doorW / 2, 0.32), p(doorAt + doorW / 2, 1.05), p(doorAt - doorW / 2, 1.05)] });
  faces.push({ kind: 'canal-door', doubleSided: true, fill: '#cfc4a4', corners: [p(doorAt - doorW / 2, 1.07), p(doorAt + doorW / 2, 1.07), p(doorAt + doorW / 2, 1.22), p(doorAt - doorW / 2, 1.22)] });   // the fanlight
  if (b.ridge === 'perp') {
    const zb = b.gable === 'cornice' ? b.z1 + b.gableH * 0.1 : b.z1 + b.gableH * 0.84;
    boxes.push(onFront(s0 + W / 2, 0.07, 0.34, zb, zb + 0.08, 'canal-hoist', '#2e241d'));
  }
}
function placeHouses(ctx, G, blocks) {
  const H = CANAL.house;
  // quay-fronting rows first (the canal face is the prestige face), then street rows; long first
  const segs = [];
  for (const block of blocks) {
    const sides = {};
    for (const side of ['S', 'N', 'W', 'E']) sides[side] = sideRuns(G, block, side).filter(([, , c]) => FRONT[c]);
    for (const side of ['S', 'N', 'W', 'E']) {
      const horiz = side === 'S' || side === 'N', cross = horiz ? block.d : block.w;
      const opp = { S: 'N', N: 'S', W: 'E', E: 'W' }[side];
      const depth = sides[opp].length ? Math.min(H.depth[1], (cross - H.garden) / 2) : Math.min(H.depth[1], cross - H.garden);
      if (depth < 2.4) continue;
      for (const [lo, hi, c] of sides[side]) segs.push({ block, side, lo, hi, kind: FRONT[c] === 2 ? 'quay' : 'street', pri: FRONT[c], depth, sides });
    }
  }
  segs.sort((a, b) => b.pri - a.pri || (b.hi - b.lo) - (a.hi - a.lo) || a.block.x - b.block.x || a.block.y - b.block.y || a.lo - b.lo);
  const done = new Map();   // `${block}|${side}` → depth of the row placed there
  const key = (s) => `${s.block.x.toFixed(3)},${s.block.y.toFixed(3)}|${s.side}`;
  for (const s of segs) {
    const horiz = s.side === 'S' || s.side === 'N';
    const b0 = horiz ? s.block.x : s.block.y, b1 = horiz ? s.block.x + s.block.w : s.block.y + s.block.d;
    const perpLo = horiz ? 'W' : 'S', perpHi = horiz ? 'E' : 'N';
    // does the perpendicular side's front reach the corner this side shares with it?
    const lowEnd = s.side === 'S' || s.side === 'W';
    const touches = (perp) => {
      const alongY = perp === 'W' || perp === 'E';
      const cLow = alongY ? s.block.y : s.block.x, cHigh = alongY ? s.block.y + s.block.d : s.block.x + s.block.w;
      return s.sides[perp].some(([lo, hi]) => (lowEnd ? lo <= cLow + 1e-6 : hi >= cHigh - 1e-6));
    };
    let lo = s.lo, hi = s.hi, cornerLo = false, cornerHi = false;
    if (Math.abs(lo - b0) < 1e-6 && touches(perpLo)) {
      const d = done.get(`${s.block.x.toFixed(3)},${s.block.y.toFixed(3)}|${perpLo}`);
      if (d != null) lo += d; else cornerLo = true;
    }
    if (Math.abs(hi - b1) < 1e-6 && touches(perpHi)) {
      const d = done.get(`${s.block.x.toFixed(3)},${s.block.y.toFixed(3)}|${perpHi}`);
      if (d != null) hi -= d; else cornerHi = true;
    }
    if (hi - lo < 1.2) continue;
    houseRow(ctx, { block: s.block, side: s.side, lo, hi, kind: s.kind, depth: s.depth, cornerLo, cornerHi });
    done.set(key(s), s.depth);
  }
}

// scatter trees on what is left of each block's garden (clear of every house, by a margin)
function plantGardens(ctx, blocks) {
  const { rng, boxes, houses, blocked } = ctx, step = 5.5;
  let n = 0;
  for (const b of blocks) for (let x = b.x + 2; x < b.x + b.w - 2; x += step) for (let y = b.y + 2; y < b.y + b.d - 2; y += step) {
    if (rng() > 0.45) continue;
    const px = x + (rng() - 0.5) * 3, py = y + (rng() - 0.5) * 3, pad = { x: px - 0.9, y: py - 0.9, w: 1.8, d: 1.8 };
    if (houses.some((h) => overlaps(h, pad)) || blocked.some((h) => overlaps(h, pad))) continue;
    gardenTree(boxes, px, py, rng); n++;
  }
  return n;
}

// ── water, quays, streets, bridges ──────────────────────────────────────────────────────────────
function waterAndWalls(ctx, G, waters) {
  const { faces, grounds, boxes } = ctx, C = CANAL, zw = -C.freeboard, zb = -C.bed;
  for (const r of waters) {
    grounds.push({ kind: 'canal-bed', x: r.x, y: r.y, w: r.w, d: r.d, z: zb, fill: GROUND.bed });
    faces.push({ kind: 'canal-water', water: true, moonless: true, alpha: 0.9, doubleSided: true, fill: ctx.water, corners: [[r.x, r.y, zw], [r.x + r.w, r.y, zw], [r.x + r.w, r.y + r.d, zw], [r.x, r.y + r.d, zw]] });
    // a brick quay wall on every side that meets land (not more water, not the frame edge)
    const t = 0.14;
    for (const side of ['S', 'N', 'W', 'E']) for (const [lo, hi, c] of sideRuns(G, r, side)) {
      if (!c || c === 'water' || c.startsWith('bridge')) continue;
      const wall = side === 'S' ? { x: lo, y: r.y, w: hi - lo, d: t } : side === 'N' ? { x: lo, y: r.y + r.d - t, w: hi - lo, d: t }
        : side === 'W' ? { x: r.x, y: lo, w: t, d: hi - lo } : { x: r.x + r.w - t, y: lo, w: t, d: hi - lo };
      boxes.push({ kind: 'quay-wall', ...wall, z0: zb, z1: 0.045, tint: '#5e4639' });
    }
  }
}
// the side of a rect that runs along the water (the one with the most water beyond it)
function waterSide(G, r) {
  let best = null, bestLen = 0;
  for (const side of ['S', 'N', 'W', 'E']) {
    const len = sideRuns(G, r, side).reduce((s, [lo, hi, c]) => s + (c === 'water' || (c && c.startsWith('bridge')) ? hi - lo : 0), 0);
    if (len > bestLen) { bestLen = len; best = side; }
  }
  return best;
}
function quays(ctx, G, rects) {
  const { grounds, ribbons, boxes, faces, rng } = ctx, C = CANAL, P = C.quayParts;
  let trees = 0, lamps = 0, cars = 0;
  for (const r of rects) {
    grounds.push({ kind: 'quay', x: r.x, y: r.y, w: r.w, d: r.d, z: 0.02, fill: GROUND.walk });
    const side = waterSide(G, r);
    if (!side) continue;
    const horiz = side === 'S' || side === 'N', len = horiz ? r.w : r.d, across = horiz ? r.d : r.w;
    if (across < C.quay - 1e-3 || len < 1.5) continue;           // a corner square: paving only
    const edge = side === 'S' ? r.y : side === 'N' ? r.y + r.d : side === 'W' ? r.x : r.x + r.w;
    const inward = side === 'S' || side === 'W' ? 1 : -1;
    const a0 = horiz ? r.x : r.y;
    const at = (s, v) => (horiz ? [s, edge + inward * v] : [edge + inward * v, s]);   // s along the quay, v in from the water
    // the tree strip at the water's edge, the brick-paved lane + parking, the walk along the houses
    const tv0 = 0, tv1 = P.trees;
    const t0 = at(a0, inward > 0 ? tv0 : tv1), t1 = at(a0 + len, inward > 0 ? tv1 : tv0);
    grounds.push({ kind: 'quay-verge', x: Math.min(t0[0], t1[0]), y: Math.min(t0[1], t1[1]), w: Math.abs(t1[0] - t0[0]), d: Math.abs(t1[1] - t0[1]), z: 0.026, fill: GROUND.earth });
    const laneV = P.trees + (P.park + P.lane) / 2;
    for (const rb of groundStreet(at(a0, laneV), at(a0 + len, laneV), { width: P.park + P.lane, asphalt: GROUND.brick, surface: 'brick' }).ribbons) ribbons.push({ ...rb, textureScale: 0.26 });
    // trees and lamps on the verge, clear of the bridge / junction ends
    const clearEnd = 1.4;
    let k = 0;
    for (let s = a0 + clearEnd + rng() * 1.2; s < a0 + len - clearEnd; s += lerp(...C.tree, rng()), k++) {
      const [x, y] = at(s, P.trees * 0.5);
      if (ctx.elements.cityTrees !== false) { canalTree(boxes, x, y, rng); trees++; }
      if (k % C.lampEvery === 1 && ctx.elements.streetLamps !== false) {
        const [lx, ly] = at(s + 1.3, P.trees * 0.45);
        canalLamp(boxes, lx, ly); lamps++;
      }
    }
    // cars parked nose to tail on the water side of the lane
    if (ctx.elements.cars !== false) {
      for (let s = a0 + clearEnd + 0.9; s < a0 + len - clearEnd - 0.9; s += C.carStep) {
        if (rng() > C.carP) continue;
        const [x, y] = at(s, P.trees + P.park / 2);
        faces.push(...vehicleAntFaces({ rng, context: 'lot', cx: x, cy: y, axis: horiz ? 'x' : 'y', dir: rng() < 0.5 ? 1 : -1, scale: METRO.car, ...C.carMesh }));
        cars++;
      }
      // a cyclist now and then in the lane
      for (let s = a0 + 3; s < a0 + len - 3; s += 9) {
        if (rng() > 0.35 || ctx.cyclists >= C.budget.cyclists) continue;
        ctx.cyclists++;
        const [x, y] = at(s + rng() * 4, P.trees + P.park + P.lane / 2);
        faces.push(...vehicleAntFaces({ rng, context: 'bike', cx: x, cy: y, axis: horiz ? 'x' : 'y', dir: rng() < 0.5 ? 1 : -1, scale: 0.9 * METRO.figure }));
      }
    }
    if (ctx.people) walkPeople(ctx, at, a0, len, C.quay - P.walk * 0.5, horiz);
  }
  return { trees, lamps, cars };
}
function walkPeople(ctx, at, a0, len, v, horiz) {
  const { rng, faces } = ctx;
  for (let s = a0 + 1; s < a0 + len - 1; s += 3.2) {
    if (rng() > 0.3 || ctx.walkers >= CANAL.budget.people) continue;
    ctx.walkers++;
    const [x, y] = at(s + rng() * 2, v);
    const heading = (horiz ? 0 : Math.PI / 2) + (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.3;
    faces.push(...pedestrianFaces({ cx: x, cy: y, heading, scale: METRO.figure * (0.94 + rng() * 0.12), archetype: rng() < 0.5 ? 'adultM' : 'adultF', pose: STROLL_POSES[Math.floor(rng() * STROLL_POSES.length)] || IDLE_POSES[0], palette: PALETTES[Math.floor(rng() * PALETTES.length)] }));
  }
}
function canalTree(boxes, x, y, rng) {
  // an elm / linden on the quay: taller and broader than the stock street tree, its crown over the water
  const h = 1.6 + rng() * 0.4;
  boxes.push({ kind: 'city-tree', shape: 'tree', x: x - 0.22, y: y - 0.22, w: 0.44, d: 0.44, z0: 0, z1: h + 2.6,
    plant: { height: h, stemRadius: 0.13 + rng() * 0.04, depth: 1, branches: 4, foliage: 'cluster', clusterSize: 0.85 + rng() * 0.15, foliageTiers: 5, branchAngle: 34, upBias: 0.4, lengthRatio: 0.72 } });
}
// a garden tree in a block's interior: the stock street tree's light build (the courts read green and treed)
function gardenTree(boxes, x, y, rng) {
  const h = 1.3 + rng() * 0.6;
  boxes.push({ kind: 'city-tree', shape: 'tree', x: x - 0.18, y: y - 0.18, w: 0.36, d: 0.36, z0: 0, z1: h + 1.4,
    plant: { height: h, stemRadius: 0.09 + rng() * 0.03, depth: 1, branches: 3, foliage: 'cluster', clusterSize: 0.42 + rng() * 0.12, foliageTiers: 4, branchAngle: 22, upBias: 0.55, lengthRatio: 0.62 } });
}
function canalLamp(boxes, x, y) {
  // a canal lantern ≈ 4.4 m: a dark post and a warm head (lampSources reads the head's tint)
  boxes.push({ kind: 'street-lamp', x: x - 0.035, y: y - 0.035, w: 0.07, d: 0.07, z0: 0, z1: 1.14, tint: '#2d3033' });
  boxes.push({ kind: 'street-lamp', x: x - 0.08, y: y - 0.08, w: 0.16, d: 0.16, z0: 1.1, z1: 1.3, tint: '#f0d982' });
  boxes.push({ kind: 'street-lamp', x: x - 0.1, y: y - 0.1, w: 0.2, d: 0.2, z0: 1.3, z1: 1.36, tint: '#2d3033' });
}
function streetsAndJunctions(ctx, rects) {
  const { grounds, ribbons } = ctx;
  for (const r of rects) {
    if (r.cls === 'junction') { grounds.push({ kind: 'junction', x: r.x, y: r.y, w: r.w, d: r.d, z: 0.03, fill: GROUND.paving }); continue; }
    grounds.push({ kind: 'street', x: r.x, y: r.y, w: r.w, d: r.d, z: 0.02, fill: GROUND.walk });
    const alongX = r.cls.endsWith('X'), lane = r.cls.startsWith('lane') ? CANAL.coreStreet.lane : CANAL.street.lane;
    const a = alongX ? [r.x, r.y + r.d / 2] : [r.x + r.w / 2, r.y], b = alongX ? [r.x + r.w, r.y + r.d / 2] : [r.x + r.w / 2, r.y + r.d];
    if ((alongX ? r.w : r.d) > 0.6) for (const rb of groundStreet(a, b, { width: Math.min(lane, alongX ? r.d : r.w), asphalt: GROUND.brick, surface: 'brick' }).ribbons) ribbons.push({ ...rb, textureScale: 0.26 });
  }
}
function bridges(ctx, rects) {
  const { boxes, rng } = ctx, B = CANAL.bridge;
  for (const r of rects) {
    const axis = r.cls === 'bridgeX' ? 'x' : 'y';                 // the span runs along the street
    const span = axis === 'x' ? r.w : r.d;
    const three = span > 6 && rng() < B.threeP;
    const arches = three
      ? [{ at: 0.5, span: B.arch.span, rise: B.arch.rise }, { at: 0.5 - (B.arch.span / 2 + 0.55 + B.side.span / 2) / span, ...B.side }, { at: 0.5 + (B.arch.span / 2 + 0.55 + B.side.span / 2) / span, ...B.side }]
      : [{ at: 0.5, span: Math.min(B.arch.span * 1.2, span * 0.4), rise: B.arch.rise }];
    boxes.push({ kind: 'canalbridge', x: r.x, y: r.y, w: r.w, d: r.d, z0: -CANAL.bed, z1: B.hump + B.parapet + 0.05, axis, water: -CANAL.freeboard, deck: 0.05, hump: B.hump, parapet: B.parapet, arches, tint: '#6a4638', paving: GROUND.brick, canal: true });
  }
  return rects.length;
}
function houseboats(ctx, G, waters) {
  const { boxes, rng } = ctx, K = CANAL.boat, zw = -CANAL.freeboard;
  const HULL = ['#2b2f33', '#30343a', '#3a2d25'], CABIN = ['#4d5f48', '#5a4636', '#5d6b78', '#d6d3ca', '#6b3a2e', '#3f4a3c'];
  let n = 0;
  for (const r of waters) {
    const horiz = r.w >= r.d, len = horiz ? r.w : r.d;
    if (len < 12) continue;
    // one bank per canal stretch carries boats (clear of the bridges at either end)
    const bank = rng() < 0.5 ? 0 : 1;
    for (let s = (horiz ? r.x : r.y) + K.clear; s < (horiz ? r.x + r.w : r.y + r.d) - K.clear - K.len[1];) {
      const L = lerp(...K.len, rng());
      if (rng() < K.p) {
        const v = bank === 0 ? 0.18 : (horiz ? r.d : r.w) - 0.18 - K.w;
        const hull = horiz ? { x: s, y: r.y + v, w: L, d: K.w } : { x: r.x + v, y: s, w: K.w, d: L };
        boxes.push({ kind: 'houseboat', ...hull, z0: zw - 0.35, z1: zw + 0.18, tint: HULL[Math.floor(rng() * HULL.length)] });
        const ins = 0.12, cab = horiz ? { x: s + L * 0.12, y: hull.y + ins, w: L * 0.76, d: K.w - 2 * ins } : { x: hull.x + ins, y: s + L * 0.12, w: K.w - 2 * ins, d: L * 0.76 };
        boxes.push({ kind: 'houseboat', ...cab, z0: zw + 0.18, z1: zw + K.h, tint: CABIN[Math.floor(rng() * CABIN.length)] });
        n++;
      }
      s += L + K.gap;
    }
  }
  return n;
}
// one chapel church on a ring block's quay front: the steeple is the only mass above the eaves
function placeChurch(ctx, G, blocks, layout) {
  const { rng, boxes, blocked, locale } = ctx, K = CANAL.church;
  const cands = [];
  for (const b of blocks) {
    const ring = G.meta[b.j0 * G.cols + b.i0].band.ring;
    if (layout.kind === 'ring' && ring !== 1 && ring !== 2) continue;
    for (const side of ['S', 'N', 'W', 'E']) for (const [lo, hi, c] of sideRuns(G, b, side)) if (c === 'quay' && hi - lo > K.nave[1] + 6) cands.push({ b, side, lo, hi });
  }
  if (!cands.length) return null;
  const pick = cands[Math.floor(rng() * cands.length)];
  const L = lerp(...K.nave, rng()), Wn = lerp(...K.width, rng());
  const s = lerp(pick.lo + 3, pick.hi - 3 - L, rng()), set = 1.2;   // set back behind a small churchyard
  const { b, side } = pick;
  const rect = side === 'S' ? { x: s, y: b.y + set, w: L, d: Wn } : side === 'N' ? { x: s, y: b.y + b.d - set - Wn, w: L, d: Wn }
    : side === 'W' ? { x: b.x + set, y: s, w: Wn, d: L } : { x: b.x + b.w - set - Wn, y: s, w: Wn, d: L };
  const cLen = Math.min(rect.w, rect.d);
  boxes.push({ kind: 'building', shape: 'church', class: 'religious', structure: 'church', churchVariant: 'chapel', locale: locale || 'nl', ...rect, z0: 0,
    z1: cLen * 0.95 + cLen * 0.6 + cLen * 0.55 + cLen * 0.62 * 1.7 });
  const yard = side === 'S' ? { x: s - 1, y: b.y, w: L + 2, d: Wn + set + 1 } : side === 'N' ? { x: s - 1, y: b.y + b.d - Wn - set - 1, w: L + 2, d: Wn + set + 1 }
    : side === 'W' ? { x: b.x, y: s - 1, w: Wn + set + 1, d: L + 2 } : { x: b.x + b.w - Wn - set - 1, y: s - 1, w: Wn + set + 1, d: L + 2 };
  blocked.push(yard);
  ctx.grounds.push({ kind: 'churchyard', ...yard, z: 0.024, fill: GROUND.paving });
  return rect;
}

/** Plan a canal city. Same output shape as planFractalCity's, so the scene assembler renders it. */
export function planCanalCity({ region = null, seed = 1, elements = {}, locale = null, people = null, canals = null, time = null } = {}) {
  const R = region || CANAL.region;
  const rng = mulberry32(((seed >>> 0) ^ 0xca9a1c17) >>> 0 || 1);
  const layoutKind = canals && canals.layout === 'parallel' ? 'parallel' : 'ring';
  const layout = layoutKind === 'parallel' ? parallelLayout(R, rng) : ringLayout(R, rng);
  const G = classGrid(R, layout);
  const ctx = { rng, seed: seed >>> 0, boxes: [], grounds: [], ribbons: [], faces: [], houses: [], blocked: [], houseCount: 0, cyclists: 0, walkers: 0, water: time === 'night' ? GROUND.waterNight : GROUND.water, elements: elements || {}, locale, people };
  const blocks = mergeClass(G, (c) => c === 'land');
  const quayRects = mergeClass(G, (c) => c === 'quay');
  const roadRects = mergeClass(G, (c) => c === 'junction' || (c && (c.startsWith('street') || c.startsWith('lane'))));
  const bridgeRects = mergeClass(G, (c) => c && c.startsWith('bridge'));
  const waterOnly = mergeClass(G, (c) => c === 'water');
  // gardens: every block is green first; houses and paving land on top
  for (const b of blocks) ctx.grounds.push({ kind: 'garden', x: b.x, y: b.y, w: b.w, d: b.d, z: 0.02, fill: GROUND.lawn });
  const church = placeChurch(ctx, G, blocks, layout);
  placeHouses(ctx, G, blocks);
  const gardenTrees = ctx.elements.cityTrees !== false ? plantGardens(ctx, blocks) : 0;
  waterAndWalls(ctx, G, waterOnly);
  const bridgeCount = bridges(ctx, bridgeRects);
  // the water sheet under each bridge (the walls stop at the bridge; the deck stands over water)
  for (const r of bridgeRects) {
    const zw = -CANAL.freeboard;
    ctx.grounds.push({ kind: 'canal-bed', x: r.x, y: r.y, w: r.w, d: r.d, z: -CANAL.bed, fill: GROUND.bed });
    ctx.faces.push({ kind: 'canal-water', water: true, moonless: true, alpha: 0.9, doubleSided: true, fill: ctx.water, corners: [[r.x, r.y, zw], [r.x + r.w, r.y, zw], [r.x + r.w, r.y + r.d, zw], [r.x, r.y + r.d, zw]] });
  }
  const q = quays(ctx, G, quayRects);
  streetsAndJunctions(ctx, roadRects);
  const boats = houseboats(ctx, G, waterOnly);
  const sources = [];
  for (const b of ctx.boxes) if (b.kind === 'street-lamp' && b.tint === '#f0d982') sources.push({ pos: [b.x + b.w / 2, b.y + b.d / 2, b.z0], dir: [0, 0, -1], spread: 66, color: [1, 0.78, 0.44], intensity: 2.2, rays: 64, bounces: 1, glowBlur: 18, glowSpread: 8, fixtureR: 0.14 });
  const houses = ctx.boxes.filter((b) => b.kind === 'canalhouse');
  const waterArea = waterOnly.concat(bridgeRects).reduce((s, r) => s + r.w * r.d, 0);
  const stats = {
    profile: 'canal', layout: layoutKind, houses: houses.length, blocks: blocks.length, bridges: bridgeCount, houseboats: boats,
    trees: q.trees, gardenTrees, lamps: q.lamps, parked: q.cars, church: !!church, waterShare: +(waterArea / (R.w * R.d)).toFixed(3),
    boxes: ctx.boxes.length, faces: ctx.faces.length,
  };
  return {
    boxes: ctx.boxes, grounds: ctx.grounds, ribbons: ctx.ribbons, faces: ctx.faces, sources, stats,
    elements: { ...(elements || {}) }, locale,
    cues: { figure: METRO.figure, car: METRO.car, pedHeight: METRO.pedHeight },
    canal: { layout: layoutKind, water: -CANAL.freeboard, centre: layout.centre },
  };
}

// ── cameras: plan-free (the canals sit at fixed offsets; only the streets draw from the rng) ─────
// street: a 1.7 m eye at a quay's edge (inside the tree line, which stands 0.3 u in), looking across
// the canal at the far row;
// aerial: low and shallow (a steep downward shot is a miniature cue); canal: from a bridge's height
// over the middle of a canal, down its length.
// the bottom run's first cross street sits 4–15 u off the centre and the next ≥ 54 u out, so a camera
// 26 u off the centre stands between bridges and looks down the canal through the next one
const CAM_GAP = 26;
export function canalCameras(recipe = {}) {
  const R = recipe.region || CANAL.region, C = CANAL, eye = 1.7 / CITY_METERS_PER_UNIT, pc = [560, 390];
  const P = 2 * C.quay + C.water + C.block, span = Math.max(R.w, R.d);
  const aerialOf = (cx, cy) => ({ name: 'aerial', worldFraming: { cameraPosition: [cx - R.w * 0.28, R.y - R.d * 0.22, span * 0.2], lookAt: [cx, cy, 0], horizontalFov: 58, pictureCenter: pc } });
  if (recipe.canals && recipe.canals.layout === 'parallel') {
    const k = PARALLEL_FIRST + P + C.quay + C.water < R.d - 4 ? 1 : 0;
    const w0 = R.y + PARALLEL_FIRST + k * P + C.quay, w1 = w0 + C.water, x = R.x + R.w * 0.72;
    return [
      { name: 'street', worldFraming: { cameraPosition: [x, w1 + 0.1, eye], lookAt: [x - 30, w0 - C.quay - 2, eye + 2.2], horizontalFov: 76, pictureCenter: pc } },
      aerialOf(R.x + R.w / 2, R.y + R.d / 2),
      { name: 'canal', worldFraming: { cameraPosition: [x + 8, (w0 + w1) / 2, 0.85], lookAt: [x - 50, (w0 + w1) / 2, 1.4], horizontalFov: 64, pictureCenter: pc } },
    ];
  }
  const cx = R.x + R.w / 2, cy = R.y + R.d;
  const k = C.core + P + C.quay + C.water < R.d - 4 ? 1 : 0;
  const o = C.core + k * P, wHi = cy - o - C.quay, wLo = wHi - C.water;   // ring k's bottom run: water between wLo and wHi
  return [
    { name: 'street', worldFraming: { cameraPosition: [cx - CAM_GAP, wHi + 0.1, eye], lookAt: [cx - CAM_GAP - 30, wLo - C.quay - 2, eye + 2.2], horizontalFov: 76, pictureCenter: pc } },
    aerialOf(cx, cy - R.d * 0.45),
    { name: 'canal', worldFraming: { cameraPosition: [cx + CAM_GAP, (wLo + wHi) / 2, 0.85], lookAt: [cx - 40, (wLo + wHi) / 2, 1.4], horizontalFov: 64, pictureCenter: pc } },
  ];
}

// ── the census: the machine gate's measures, in metres ──────────────────────────────────────────
export function canalCityCensus(plan, region = CANAL.region) {
  const m = CITY_METERS_PER_UNIT, q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  const houses = plan.boxes.filter((b) => b.kind === 'canalhouse');
  const eaves = houses.map((b) => b.z1 * m), tops = houses.map((b) => b.topZ * m);
  const front = houses.map((b) => (b.face === '-y' || b.face === '+y' ? b.w : b.d) * m);
  const others = plan.boxes.filter((b) => b.kind !== 'canalhouse' && b.kind !== 'building' && b.kind !== 'city-tree').map((b) => b.z1 * m);
  const church = plan.boxes.find((b) => b.shape === 'church');
  return {
    houses: houses.length,
    eaves: { p50: q(eaves, 0.5), p90: q(eaves, 0.9), max: Math.max(0, ...eaves) },
    top: { p50: q(tops, 0.5), p90: q(tops, 0.9), max: Math.max(0, ...tops) },
    maxOverP50: q(tops, 0.5) ? Math.max(...tops) / q(tops, 0.5) : 0,
    frontage: { p10: q(front, 0.1), p50: q(front, 0.5), p90: q(front, 0.9) },
    gables: houses.reduce((o, b) => ((o[b.gable] = (o[b.gable] || 0) + 1), o), {}),
    otherMax: Math.max(0, ...others),
    church: church ? { height: church.z1 * m } : null,
    waterShare: plan.stats.waterShare,
    region: { w: region.w * m, d: region.d * m },
  };
}
