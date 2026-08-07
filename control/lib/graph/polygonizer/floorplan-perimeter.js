/**
 * floorplan-perimeter — the LOT the house sits on (exterior-view site layer).
 *
 * The fifth floorplan layer, OUTSIDE the envelope: property line, yards, fence,
 * driveway, carport, shed, front path, back patio. Lot-scale sibling of
 * `exteriorAdjacents` (porch/deck/balcony) in floorplan-structure.js — that hangs
 * built structures off the house's DOORS; this hangs them off the house's
 * FOOTPRINT and the STREET.
 *
 * Frame (inherited from structure): 1 world unit = 1 foot, z up, z=0 = grade.
 * The exterior camera looks from `-y`, so the STREET is the `-y` side — the front.
 * Orientation is deterministic (no seed): front yard at `-y`, back yard at `+y`,
 * driveway + carport on the `+x` side, shed in the back `-x,+y` corner.
 *
 * Self-contained geometry (its own box/slab built on vexar shading) so the
 * structure module can import it without a cycle. Faces are engine-agnostic
 * `{ corners, fill, doubleSided, ground?, group }` — the same shape the rest of
 * the house emits, so CSS-3D and three.js both render them unchanged.
 *
 * See floorplan-perimeter.plan.md.
 */

import { shadeHex, scaleHex, makeLight } from './vexar.js';

export const PERIMETER_DEFAULTS = {
  // lot setbacks (feet)
  frontSetback: 24,        // house front (fp.y0) → street (lot.y0)
  backYard: 40,            // fp.y1 → lot.y1 (the deep rear yard)
  sideYard: 14,            // each side
  grassTint: '#3a4632',    // lawn

  // fence (property line)
  fence: true,
  fenceHeight: 4,          // side + back lines
  frontFenceHeight: 3,     // lower at the street, with gaps for drive + path
  fenceThick: 0.4,
  fencePost: 8,            // post spacing (ft)
  fenceTint: '#9a8a66',

  // driveway (+x side, street → carport)
  driveway: true,
  driveWidth: 10,
  driveGap: 1,             // gap between the house's +x wall and the drive
  driveTint: '#6f7378',

  // carport (over the driveway head, beside the house front)
  carport: true,
  carportDepth: 19,        // one car
  carportClear: 9,         // clear height under the roof
  carportSlabTint: '#74787d',
  carportPostTint: '#cfd3d8',
  carportRoofTint: '#54585e',

  // front path (street → house front, centred on the footprint)
  path: true,
  pathWidth: 3.5,
  pathTint: '#8a8f86',

  // back patio (off the rear wall, centred)
  patio: true,
  patioW: 14,
  patioD: 11,
  patioTint: '#7e8278',

  // — landscaping (opt-in) —
  interlock: false,        // pave the driveway/apron/path/patio in interlocking pavers
  paverBase: '#54585e',    // grout / sand-set base between pavers
  paverTints: ['#9a8f80', '#a89c8b', '#8f8576', '#b0a594'],   // warm concrete pavers, slight variation
  paverW: 1.8, paverH: 0.9, paverGap: 0.1,

  landscape: false,        // shrubs + hedges + a front garden bed
  foliageTints: ['#3f6b39', '#4a7a42', '#37602f', '#588a4c'],
  soilTint: '#4a3a2c',
  bedCurbTint: '#8d8576',
  flowerTints: ['#c95b6e', '#d99a3c', '#c7b23f', '#b56fb0'],

  // shed (back -x,+y corner, gabled)
  shed: true,
  shedW: 8,
  shedD: 10,
  shedWallH: 7,
  shedRise: 3,
  shedInset: 4,            // from the lot corner
  shedTint: '#7d6f53',
  shedRoofTint: '#4a4036',
};

// Drive-head structure (over the driveway, beside the house front).
//   carport — open posts + flat roof (default)   garage — enclosed walls + door + gable
const DRIVE_STRUCT_DEFAULTS = {
  garage: false,           // build an enclosed garage instead of the open carport
  garageWidth: 11,         // one bay, enclosed (front-loaded layout)
  garageDepth: 20,         // one bay, enclosed
  garageWallH: 9,
  garageRise: 2.6,         // gable rise
  garageTint: '#b9b2a4',
  garageDoorTint: '#9aa0a6',
  garageRoofTint: '#5a5048',
};
Object.assign(PERIMETER_DEFAULTS, DRIVE_STRUCT_DEFAULTS);

// Lot-size presets. `lotStyle:'compact'` is the same layout on a tighter parcel
// (less yard) — the side driveway still fits, just narrower. Explicit opts win.
export const LOT_STYLES = {
  suburban: {},                                                                       // the defaults
  compact: { frontSetback: 14, backYard: 20, sideYard: 11, driveWidth: 9, shed: false, patioW: 11, patioD: 7 },
  skinny: { frontSetback: 30, backYard: 12, sideYard: 4, driveWidth: 10, shed: false, patio: false, fencePost: 6 },
};

/** PERIMETER_DEFAULTS < lot-style preset < explicit opts. */
export function resolvePerimeterOpts(opts = {}) {
  return { ...PERIMETER_DEFAULTS, ...(LOT_STYLES[opts.lotStyle] || {}), ...opts };
}

const PAVE = 0.12;         // paved-slab thickness (driveway / path / patio)

function defaultLight() {
  return makeLight({ direction: [0.34, 0.42, -0.84], ambient: 0.54, diffuse: 0.5 });
}

// ── primitives (mirror floorplan-structure's boxFaces face/normal conventions) ──

/** A solid axis-aligned box. `group` tags every face for World sub-mesh toggling. */
function box(x0, x1, y0, y1, z0, z1, tint, light, { top = true, bottom = false, group } = {}) {
  const f = [];
  const quad = (corners, normal) => f.push({ corners, fill: shadeHex(tint, normal, light), doubleSided: true, ...(group ? { group } : {}) });
  quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]);
  quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  quad([[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]], [0, -1, 0]);
  if (top) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  if (bottom) quad([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], [0, 0, -1]);
  return f;
}

/** A thin paved slab over a rect, from z0 up by `thick`. */
function slab(rect, z0, tint, light, group, thick = PAVE) {
  return box(rect.x0, rect.x1, rect.y0, rect.y1, z0, z0 + thick, tint, light, { group });
}

// ── the lot ──────────────────────────────────────────────────────────────────

/** Footprint bbox + setbacks → the lot rect. Street is the `-y` (front) side. */
export function computeLot(footprint, opts = {}) {
  const o = resolvePerimeterOpts(opts);
  return {
    x0: footprint.x0 - o.sideYard,
    x1: footprint.x1 + o.sideYard,
    y0: footprint.y0 - o.frontSetback,
    y1: footprint.y1 + o.backYard,
    street: '-y',
    frontSetback: o.frontSetback,
    backYard: o.backYard,
    sideYard: o.sideYard,
  };
}

/** One lawn quad over the whole lot at grade. */
export function lotGroundFaces(lot, baseZ, o) {
  return [{
    corners: [[lot.x0, lot.y0, baseZ], [lot.x1, lot.y0, baseZ], [lot.x1, lot.y1, baseZ], [lot.x0, lot.y1, baseZ]],
    fill: o.grassTint || '#3a4632',
    doubleSided: true,
    ground: true,
    group: 'perimeter:lawn',
  }];
}

// ── fence ──────────────────────────────────────────────────────────────────

/**
 * A fence along an axis-aligned segment p0→p1: a thin panel from grade to
 * `height`, plus square posts (slightly taller) at `fencePost` intervals and both
 * ends. Works for a run along x (constant y) or along y (constant x).
 */
export function fenceRun(p0, p1, height, baseZ, o, group = 'perimeter:fence') {
  const faces = [];
  const t = o.fenceThick ?? 0.4;
  const tint = o.fenceTint ?? '#9a8a66';
  const postTint = scaleHex(tint, 0.78);
  const horiz = Math.abs(p1[1] - p0[1]) < 1e-6;       // constant y → along x
  const at = horiz ? p0[1] : p0[0];
  const a0 = horiz ? Math.min(p0[0], p1[0]) : Math.min(p0[1], p1[1]);
  const a1 = horiz ? Math.max(p0[0], p1[0]) : Math.max(p0[1], p1[1]);
  if (a1 - a0 < 0.5) return faces;
  // panel
  if (horiz) faces.push(...box(a0, a1, at - t / 2, at + t / 2, baseZ, baseZ + height, tint, o.light, { group }));
  else faces.push(...box(at - t / 2, at + t / 2, a0, a1, baseZ, baseZ + height, tint, o.light, { group }));
  // posts at intervals + both ends
  const pr = t * 0.9;
  const stops = [];
  const step = o.fencePost ?? 8;
  for (let s = a0; s < a1 - 1e-6; s += step) stops.push(s);
  stops.push(a1);
  for (const s of stops) {
    if (horiz) faces.push(...box(s - pr, s + pr, at - pr, at + pr, baseZ, baseZ + height + 0.5, postTint, o.light, { group }));
    else faces.push(...box(at - pr, at + pr, s - pr, s + pr, baseZ, baseZ + height + 0.5, postTint, o.light, { group }));
  }
  return faces;
}

// subtract a set of [a,b] gap intervals from [lo,hi] → remaining sub-segments
export function subtractIntervals(lo, hi, gaps) {
  let segs = [[lo, hi]];
  for (const [g0, g1] of gaps) {
    const next = [];
    for (const [s0, s1] of segs) {
      if (g1 <= s0 || g0 >= s1) { next.push([s0, s1]); continue; }
      if (g0 > s0) next.push([s0, g0]);
      if (g1 < s1) next.push([g1, s1]);
    }
    segs = next;
  }
  return segs.filter(([s0, s1]) => s1 - s0 > 0.75);
}

/** Side + back property-line fence at full height; front line lower with gaps. */
export function buildFences(lot, baseZ, o, { driveRect, pathRect } = {}) {
  const faces = [];
  const H = o.fenceHeight ?? 4;
  // left (-x) and right (+x) side lines, full depth
  faces.push(...fenceRun([lot.x0, lot.y0], [lot.x0, lot.y1], H, baseZ, o));
  faces.push(...fenceRun([lot.x1, lot.y0], [lot.x1, lot.y1], H, baseZ, o));
  // back (+y) line
  faces.push(...fenceRun([lot.x0, lot.y1], [lot.x1, lot.y1], H, baseZ, o));
  // front (-y) line: lower, with gaps for the driveway and the path
  const gaps = [];
  if (driveRect) gaps.push([driveRect.x0 - 1, driveRect.x1 + 1]);
  if (pathRect) gaps.push([pathRect.x0 - 1, pathRect.x1 + 1]);
  for (const [s0, s1] of subtractIntervals(lot.x0, lot.x1, gaps)) {
    faces.push(...fenceRun([s0, lot.y0], [s1, lot.y0], o.frontFenceHeight ?? 3, baseZ, o, 'perimeter:fence-front'));
  }
  return faces;
}

// ── driveway + carport ───────────────────────────────────────────────────────

/** A paved drive up the `+x` side, from the street to the house front. */
export function buildDriveway(lot, fp, baseZ, o) {
  const gap = o.driveGap ?? 1;
  const x0 = fp.x1 + gap;
  const x1 = Math.min(x0 + (o.driveWidth ?? 10), lot.x1 - 0.5);
  const rect = { x0, x1, y0: lot.y0, y1: fp.y0 };
  return { faces: paved(rect, baseZ, o.driveTint || '#6f7378', o, 'perimeter:driveway'), rect };
}

/** A carport over the driveway head, beside the house front: 4 posts + flat roof. */
export function buildCarport(driveRect, fp, baseZ, o) {
  const faces = [];
  const x0 = driveRect.x0, x1 = driveRect.x1;
  const y0 = fp.y0, y1 = fp.y0 + (o.carportDepth ?? 19);
  const clear = o.carportClear ?? 9;
  const rect = { x0, x1, y0, y1 };
  // grade slab
  faces.push(...paved(rect, baseZ, o.carportSlabTint || '#74787d', o, 'perimeter:carport'));
  // 4 corner posts (square, inset)
  const pr = 0.28, inset = 0.5;
  const corners = [[x0 + inset, y0 + inset], [x1 - inset, y0 + inset], [x0 + inset, y1 - inset], [x1 - inset, y1 - inset]];
  for (const [cx, cy] of corners) {
    faces.push(...box(cx - pr, cx + pr, cy - pr, cy + pr, baseZ, baseZ + clear, o.carportPostTint || '#cfd3d8', o.light, { group: 'perimeter:carport' }));
  }
  // flat roof slab with a small overhang
  const oh = 0.8;
  faces.push(...box(x0 - oh, x1 + oh, y0 - oh, y1 + oh, baseZ + clear, baseZ + clear + 0.4, o.carportRoofTint || '#54585e', o.light, { group: 'perimeter:carport' }));
  return { faces, rect };
}

/**
 * An ENCLOSED garage over a rect: solid walls + a gable roof + a roll-up door
 * panel on the `facing` face. The enclosed sibling of `buildCarport` — swapped in
 * by `o.garage`. `facing` is the side the door (and driveway) meet: '-y' for a
 * street-facing front/side garage.
 */
export function buildGarage(rect, baseZ, o, { facing = '-y', group = 'perimeter:garage', roof = 'gable' } = {}) {
  const { x0, x1, y0, y1 } = rect;
  const wallH = o.garageWallH ?? 9;
  const faces = [...box(x0, x1, y0, y1, baseZ, baseZ + wallH, o.garageTint || '#b9b2a4', o.light, { top: false, group })];
  if (roof === 'flat') {
    // flat parapet cap — the modern/tofu read, matching a flat-deck house
    faces.push(...box(x0 - 0.25, x1 + 0.25, y0 - 0.25, y1 + 0.25, baseZ + wallH, baseZ + wallH + 0.5, o.garageRoofTint || '#5a5048', o.light, { group }));
  } else {
    faces.push(...gableRoof(x0, x1, y0, y1, baseZ + wallH, o.garageRise ?? 2.6, o.garageRoofTint || '#5a5048', o.light, group));
  }
  // door panel on the facing wall, proud of the plane, centred with a side margin
  const m = Math.min(1.0, (x1 - x0) * 0.12, (y1 - y0) * 0.12);
  const dz0 = baseZ + 0.2, dz1 = baseZ + wallH - 1.2, t = 0.14, dt = o.garageDoorTint || '#9aa0a6';
  if (facing === '-y') faces.push(...box(x0 + m, x1 - m, y0 - t, y0, dz0, dz1, dt, o.light, { group }));
  else if (facing === '+y') faces.push(...box(x0 + m, x1 - m, y1, y1 + t, dz0, dz1, dt, o.light, { group }));
  else if (facing === '-x') faces.push(...box(x0 - t, x0, y0 + m, y1 - m, dz0, dz1, dt, o.light, { group }));
  else faces.push(...box(x1, x1 + t, y0 + m, y1 - m, dz0, dz1, dt, o.light, { group }));
  return { faces, rect };
}

// ── path + patio ─────────────────────────────────────────────────────────────

/** A walk from the street to the house front, centred on the footprint. */
export function buildPath(lot, fp, baseZ, o) {
  const cx = (fp.x0 + fp.x1) / 2, hw = (o.pathWidth ?? 3.5) / 2;
  const rect = { x0: cx - hw, x1: cx + hw, y0: lot.y0, y1: fp.y0 };
  return { faces: paved(rect, baseZ, o.pathTint || '#8a8f86', o, 'perimeter:path'), rect };
}

/** A paved patio off the rear (+y) wall, centred. */
export function buildPatio(lot, fp, baseZ, o) {
  const cx = (fp.x0 + fp.x1) / 2, hw = (o.patioW ?? 14) / 2;
  const x0 = Math.max(lot.x0 + 1, cx - hw), x1 = Math.min(lot.x1 - 1, cx + hw);
  const rect = { x0, x1, y0: fp.y1, y1: Math.min(fp.y1 + (o.patioD ?? 11), lot.y1 - 2) };
  return { faces: paved(rect, baseZ, o.patioTint || '#7e8278', o, 'perimeter:patio'), rect };
}

// ── shed (gabled) ──────────────────────────────────────────────────────────

/** A gable roof over a rect: two slopes (ridge along y) + two gable-end triangles. */
function gableRoof(x0, x1, y0, y1, zEave, rise, tint, light, group) {
  const f = [];
  const cx = (x0 + x1) / 2, zRidge = zEave + rise;
  const push = (corners, normal) => f.push({ corners, fill: shadeHex(tint, normal, light), doubleSided: true, ...(group ? { group } : {}) });
  // west slope (x0 eave → ridge)
  push([[x0, y0, zEave], [cx, y0, zRidge], [cx, y1, zRidge], [x0, y1, zEave]], [-rise, 0, (cx - x0)]);
  // east slope (ridge → x1 eave)
  push([[cx, y0, zRidge], [x1, y0, zEave], [x1, y1, zEave], [cx, y1, zRidge]], [rise, 0, (x1 - cx)]);
  // gable-end triangles (y0 and y1)
  push([[x0, y0, zEave], [x1, y0, zEave], [cx, y0, zRidge]], [0, -1, 0]);
  push([[x0, y1, zEave], [cx, y1, zRidge], [x1, y1, zEave]], [0, 1, 0]);
  return f;
}

/** A small gabled shed in the back `-x,+y` corner of the lot. */
export function buildShed(lot, fp, baseZ, o) {
  const w = o.shedW ?? 8, d = o.shedD ?? 10, inset = o.shedInset ?? 4;
  const x0 = lot.x0 + inset, x1 = x0 + w;
  const y1 = lot.y1 - inset, y0 = y1 - d;
  const rect = { x0, x1, y0, y1 };
  const wallH = o.shedWallH ?? 7;
  const faces = [
    ...box(x0, x1, y0, y1, baseZ, baseZ + wallH, o.shedTint || '#7d6f53', o.light, { top: false, group: 'perimeter:shed' }),
    ...gableRoof(x0, x1, y0, y1, baseZ + wallH, o.shedRise ?? 3, o.shedRoofTint || '#4a4036', o.light, 'perimeter:shed'),
  ];
  return { faces, rect };
}

// ── interlock paving + planting ──────────────────────────────────────────────

// deterministic 0..1 hash (no Math.random — same lot renders the same every time)
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * Interlocking pavers over a rect: a grout/sand base + a RUNNING-BOND grid of paver
 * top-quads (alternate rows half-offset), each inset by the joint so the grout shows.
 * Geometry, not a texture — so it reads in both the CSS-3D and WebGL paths.
 */
export function interlockSurface(rect, baseZ, o, group = 'perimeter:paving') {
  const { x0, x1, y0, y1 } = rect;
  const pw = o.paverW ?? 1.8, ph = o.paverH ?? 0.9, g = (o.paverGap ?? 0.1) / 2;
  const tints = o.paverTints || ['#9a8f80'];
  const faces = [...slab(rect, baseZ, o.paverBase || '#54585e', o.light, group, 0.05)];
  let row = 0;
  for (let y = y0; y < y1 - 1e-6; y += ph, row += 1) {
    const yy1 = Math.min(y + ph, y1);
    const off = (row % 2) * (pw / 2);
    for (let x = x0 - off; x < x1 - 1e-6; x += pw) {
      const a = Math.max(x, x0) + g, b = Math.min(x + pw, x1) - g, c = Math.max(y, y0) + g, d = yy1 - g;
      if (b - a < 0.15 || d - c < 0.15) continue;
      const tint = tints[Math.floor(hash(row * 131 + Math.round((x - x0) / pw)) * tints.length) % tints.length];
      const z = baseZ + 0.07;
      faces.push({ corners: [[a, c, z], [b, c, z], [b, d, z], [a, d, z]], fill: shadeHex(tint, [0, 0, 1], o.light), doubleSided: true, group });
    }
  }
  return faces;
}

/** Pave a rect as interlock (when `o.interlock`) or a plain slab. */
function paved(rect, baseZ, tint, o, group) {
  return o.interlock ? interlockSurface(rect, baseZ, o, group) : slab(rect, baseZ, tint, o.light, group);
}

/** A rounded foliage mound: a two-ring dome to an apex — a clipped shrub / bush. */
function foliageDome(cx, cy, z0, r, h, light, tint, group) {
  const sides = 7, faces = [];
  const ring = (rr, zz, k) => { const a = (k / sides) * 2 * Math.PI; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a), zz]; };
  const apex = [cx, cy, z0 + h];
  for (let k = 0; k < sides; k += 1) {
    const am = ((k + 0.5) / sides) * 2 * Math.PI, nrm = [Math.cos(am) * 0.85, Math.sin(am) * 0.85, 0.5];
    const a = ring(r, z0, k), b = ring(r, z0, k + 1), c = ring(r * 0.6, z0 + h * 0.55, k + 1), d = ring(r * 0.6, z0 + h * 0.55, k);
    faces.push({ corners: [a, b, c, d], fill: shadeHex(tint, nrm, light), doubleSided: true, group });
    faces.push({ corners: [d, c, apex], fill: shadeHex(tint, [nrm[0], nrm[1], 1], light), doubleSided: true, group });
  }
  return faces;
}

/** A shrub at (cx,cy) — a single rounded foliage mound, tint varied by seed. */
export function buildShrub(cx, cy, baseZ, o, { r = 1.2, h = 1.9, seed = 0 } = {}) {
  const tints = o.foliageTints || ['#3f6b39'];
  const tint = tints[Math.floor(hash(seed * 7 + 1) * tints.length) % tints.length];
  return foliageDome(cx, cy, baseZ, r, h, o.light, tint, 'perimeter:shrub');
}

/** A clipped HEDGE along an axis-aligned segment: a green body + a rounded crown cap. */
export function buildHedge(p0, p1, baseZ, o, { height = 3, depth = 1.4 } = {}) {
  const tint = (o.foliageTints || ['#3f6b39'])[1] || '#4a7a42';
  const horiz = Math.abs(p1[1] - p0[1]) < 1e-6;
  const at = horiz ? p0[1] : p0[0];
  const a0 = horiz ? Math.min(p0[0], p1[0]) : Math.min(p0[1], p1[1]);
  const a1 = horiz ? Math.max(p0[0], p1[0]) : Math.max(p0[1], p1[1]);
  const G = 'perimeter:hedge';
  const span = (i0, i1, z0, z1, t) => horiz
    ? box(i0, i1, at - depth / 2, at + depth / 2, z0, z1, t, o.light, { group: G })
    : box(at - depth / 2, at + depth / 2, i0, i1, z0, z1, t, o.light, { group: G });
  const crown = (i0, i1, z0, z1, t) => horiz
    ? box(i0, i1, at - depth / 2 + 0.15, at + depth / 2 - 0.15, z0, z1, t, o.light, { group: G })
    : box(at - depth / 2 + 0.15, at + depth / 2 - 0.15, i0, i1, z0, z1, t, o.light, { group: G });
  return [...span(a0, a1, baseZ, baseZ + height, tint), ...crown(a0 + 0.15, a1 - 0.15, baseZ + height, baseZ + height + 0.4, scaleHex(tint, 1.08))];
}

/** A planted garden BED: soil + a curb border + a grid of mini shrubs and flowers. */
export function buildGardenBed(rect, baseZ, o) {
  const { x0, x1, y0, y1 } = rect;
  const G = 'perimeter:garden';
  const faces = [{ corners: [[x0, y0, baseZ + 0.05], [x1, y0, baseZ + 0.05], [x1, y1, baseZ + 0.05], [x0, y1, baseZ + 0.05]], fill: shadeHex(o.soilTint || '#4a3a2c', [0, 0, 1], o.light), doubleSided: true, group: G }];
  const cw = 0.3, ch = 0.45, curb = o.bedCurbTint || '#8d8576';
  faces.push(...box(x0, x1, y0, y0 + cw, baseZ, baseZ + ch, curb, o.light, { group: G }));
  faces.push(...box(x0, x1, y1 - cw, y1, baseZ, baseZ + ch, curb, o.light, { group: G }));
  faces.push(...box(x0, x0 + cw, y0, y1, baseZ, baseZ + ch, curb, o.light, { group: G }));
  faces.push(...box(x1 - cw, x1, y0, y1, baseZ, baseZ + ch, curb, o.light, { group: G }));
  const fl = o.flowerTints || ['#c95b6e'], fo = o.foliageTints || ['#3f6b39'];
  for (let py = y0 + 1; py <= y1 - 0.7; py += 1.5) {
    for (let px = x0 + 1; px <= x1 - 0.7; px += 1.5) {
      const s = Math.floor(hash(px * 13.3 + py * 7.7) * 997);
      if (hash(px * 3.1 + py * 5.7) < 0.4) faces.push(...foliageDome(px, py, baseZ + 0.05, 0.34, 0.55, o.light, fl[s % fl.length], G));
      else faces.push(...foliageDome(px, py, baseZ + 0.05, 0.5, 0.85, o.light, fo[s % fo.length], G));
    }
  }
  return faces;
}

/** A row of foundation shrubs along a wall line at y=`wy`, skipping gap x-ranges. */
function plantRow(wy, x0, x1, baseZ, o, gaps = []) {
  const faces = [];
  for (let x = x0 + 1.4; x <= x1 - 1.0; x += 2.6) {
    if (gaps.some(([g0, g1]) => x >= g0 - 0.8 && x <= g1 + 0.8)) continue;
    faces.push(...buildShrub(x, wy, baseZ, o, { r: 1.0, h: 1.7, seed: Math.round(x * 3 + wy) }));
  }
  return faces;
}

// ── compose ──────────────────────────────────────────────────────────────────

/**
 * Build the whole lot around a house footprint. Returns the faces, the lot rect
 * (for exterior camera framing) and each feature's rect (for the site-plan SVG).
 * Every feature is opt-out via its flag (driveway/carport/shed/fence/path/patio).
 */
export function buildPerimeter(footprint, baseZ = 0, opts = {}) {
  const o = { ...resolvePerimeterOpts(opts), light: opts.light || defaultLight() };
  const lot = computeLot(footprint, o);
  const faces = [...lotGroundFaces(lot, baseZ, o)];

  let driveRect = null, carportRect = null, garageRect = null, pathRect = null, patioRect = null, shedRect = null;
  if (o.driveway !== false) { const d = buildDriveway(lot, footprint, baseZ, o); faces.push(...d.faces); driveRect = d.rect; }
  // drive-head structure: an enclosed garage (o.garage) OR the open carport.
  if (driveRect && o.garage) {
    const headRect = { x0: driveRect.x0, x1: driveRect.x1, y0: footprint.y0, y1: footprint.y0 + (o.garageDepth ?? 20) };
    const g = buildGarage(headRect, baseZ, o, { facing: '-y' });
    faces.push(...g.faces); garageRect = headRect;
  } else if (driveRect && o.carport !== false) {
    const c = buildCarport(driveRect, footprint, baseZ, o); faces.push(...c.faces); carportRect = c.rect;
  }
  if (o.path !== false) { const p = buildPath(lot, footprint, baseZ, o); faces.push(...p.faces); pathRect = p.rect; }
  if (o.patio !== false) { const p = buildPatio(lot, footprint, baseZ, o); faces.push(...p.faces); patioRect = p.rect; }
  if (o.shed !== false) { const sh = buildShed(lot, footprint, baseZ, o); faces.push(...sh.faces); shedRect = sh.rect; }
  if (o.fence !== false) faces.push(...buildFences(lot, baseZ, o, { driveRect, pathRect }));

  // landscaping: foundation shrubs along the front wall (skipping the path + drive),
  // a garden bed in the front yard opposite the drive, and shrubs flanking the entry.
  if (o.landscape) {
    const gaps = [pathRect, driveRect, garageRect, carportRect].filter(Boolean).map((r) => [r.x0, r.x1]);
    faces.push(...plantRow(footprint.y0 - 1.4, footprint.x0, footprint.x1, baseZ, o, gaps));
    const bx0 = lot.x0 + 2.5, bx1 = Math.min(bx0 + 9, footprint.x0 - 1.5);
    if (bx1 - bx0 > 3) faces.push(...buildGardenBed({ x0: bx0, x1: bx1, y0: lot.y0 + 4, y1: lot.y0 + 12 }, baseZ, o));
    if (pathRect) {
      faces.push(...buildShrub(pathRect.x0 - 1.3, footprint.y0 - 1.6, baseZ, o, { r: 0.9, h: 1.5, seed: 5 }));
      faces.push(...buildShrub(pathRect.x1 + 1.3, footprint.y0 - 1.6, baseZ, o, { r: 0.9, h: 1.5, seed: 9 }));
    }
  }

  return { faces, lot, driveRect, carportRect, garageRect, pathRect, patioRect, shedRect, textureKeys: [] };
}

// ── split-mirror duplex: two mirrored long houses on one split lot ───────────

/**
 * The shared site for a SPLIT-MIRROR pair (the modern "split a wide lot at xa|xb
 * and build two long mirror houses" pattern). Each unit is FRONT-LOADED: a garage
 * on its OUTER side projecting into the front yard, door to the street, with a
 * short driveway apron; a front path on the inner side. One lawn + perimeter fence
 * spans the whole lot (front gaps at the aprons + paths), and a party-line fence
 * divides the rear yards on the split.
 *
 * @param lot     full split lot {x0,x1,y0,y1} (street on -y)
 * @param splitX  the xa|xb division line
 * @param fpA/fpB the two house footprints (B is A mirrored about splitX)
 */
export function buildSplitMirrorPerimeter(lot, splitX, fpA, fpB, baseZ = 0, opts = {}) {
  const o = { ...resolvePerimeterOpts({ lotStyle: 'skinny', ...opts }), light: opts.light || defaultLight() };
  const faces = [...lotGroundFaces(lot, baseZ, o)];
  const gW = Math.min(o.garageWidth ?? 11, (fpA.x1 - fpA.x0) - 1);
  const gD = o.garageDepth ?? 20;
  const pw = o.pathWidth ?? 3.5;
  const units = [];

  const buildUnit = (fp, outerSide) => {
    // garage on the outer side, projecting into the front yard, door to the street
    const gx0 = outerSide === '-x' ? fp.x0 : fp.x1 - gW;
    const gx1 = outerSide === '-x' ? fp.x0 + gW : fp.x1;
    const gy1 = fp.y0, gy0 = Math.max(lot.y0 + 6, fp.y0 - gD);     // short apron left to the street
    const garageRect = { x0: gx0, x1: gx1, y0: gy0, y1: gy1 };
    faces.push(...buildGarage(garageRect, baseZ, o, { facing: '-y', roof: o.garageRoof || 'gable' }).faces);
    const apronRect = { x0: gx0, x1: gx1, y0: lot.y0, y1: gy0 };
    faces.push(...paved(apronRect, baseZ, o.driveTint || '#6f7378', o, 'perimeter:driveway'));
    // front path on the inner side (toward the split), street → house front
    const ix = outerSide === '-x' ? fp.x1 - pw - 1 : fp.x0 + 1;
    const pathRect = { x0: ix, x1: ix + pw, y0: lot.y0, y1: fp.y0 };
    faces.push(...paved(pathRect, baseZ, o.pathTint || '#8a8f86', o, 'perimeter:path'));
    units.push({ fp, garageRect, apronRect, pathRect, outerSide });
  };
  buildUnit(fpA, '-x');
  buildUnit(fpB, '+x');

  // perimeter fence: side + back full height; front lower, gapped at aprons + paths
  faces.push(...fenceRun([lot.x0, lot.y0], [lot.x0, lot.y1], o.fenceHeight, baseZ, o));
  faces.push(...fenceRun([lot.x1, lot.y0], [lot.x1, lot.y1], o.fenceHeight, baseZ, o));
  faces.push(...fenceRun([lot.x0, lot.y1], [lot.x1, lot.y1], o.fenceHeight, baseZ, o));
  const gaps = units.flatMap((u) => [[u.apronRect.x0 - 0.8, u.apronRect.x1 + 0.8], [u.pathRect.x0 - 0.8, u.pathRect.x1 + 0.8]]);
  for (const [s0, s1] of subtractIntervals(lot.x0, lot.x1, gaps)) {
    faces.push(...fenceRun([s0, lot.y0], [s1, lot.y0], o.frontFenceHeight ?? 3, baseZ, o, 'perimeter:fence-front'));
  }
  // party-line fence dividing the rear yards on the split
  const yDiv0 = Math.max(fpA.y1, fpB.y1);
  if (lot.y1 - yDiv0 > 1) faces.push(...fenceRun([splitX, yDiv0], [splitX, lot.y1], o.fenceHeight, baseZ, o, 'perimeter:fence-party'));

  // landscaping: each unit gets foundation shrubs along its front wall (skipping its
  // garage + path) plus an entry shrub, and a low hedge runs the inner front edge.
  if (o.landscape) {
    for (const u of units) {
      const gaps = [[u.garageRect.x0, u.garageRect.x1], [u.pathRect.x0, u.pathRect.x1]];
      faces.push(...plantRow(u.fp.y0 - 1.4, u.fp.x0, u.fp.x1, baseZ, o, gaps));
      const ex = u.outerSide === '-x' ? u.pathRect.x1 + 1.2 : u.pathRect.x0 - 1.2;
      faces.push(...buildShrub(ex, u.fp.y0 - 1.6, baseZ, o, { r: 0.8, h: 1.4, seed: Math.round(ex) }));
    }
  }

  return { faces, lot, splitX, units };
}

// ── top-down site-plan SVG (visual review) ──────────────────────────────────

/** Render a top-down site plan: lot, paved areas, house, carport, shed, fence. */
export function renderSitePlanSvg(site, opts = {}) {
  const { lot, footprint: fp } = site;
  const pad = 4, scale = opts.scale || 7;
  const W = (lot.x1 - lot.x0 + pad * 2) * scale, H = (lot.y1 - lot.y0 + pad * 2) * scale;
  const tx = (x) => ((x - lot.x0 + pad) * scale).toFixed(1);
  const ty = (y) => ((y - lot.y0 + pad) * scale).toFixed(1);
  const rect = (r, fill, op = 1) => r
    ? `<rect x="${tx(r.x0)}" y="${ty(r.y0)}" width="${((r.x1 - r.x0) * scale).toFixed(1)}" height="${((r.y1 - r.y0) * scale).toFixed(1)}" fill="${fill}" opacity="${op}"/>`
    : '';
  const o = { ...PERIMETER_DEFAULTS, ...opts };
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">`];
  p.push(rect(lot, o.grassTint));                                   // lawn
  p.push(rect(site.driveRect, o.driveTint));                        // driveway
  p.push(rect(site.pathRect, o.pathTint));                          // path
  p.push(rect(site.patioRect, o.patioTint));                        // patio
  p.push(rect(site.carportRect, o.carportRoofTint, 0.6));           // carport (roof)
  p.push(rect(site.garageRect, o.garageTint));                      // garage
  p.push(rect(site.shedRect, o.shedTint));                          // shed
  p.push(rect(fp, '#c9c2b0'));                                      // house footprint
  // fence outline (side + back solid, front dashed = lower/gapped)
  p.push(`<rect x="${tx(lot.x0)}" y="${ty(lot.y0)}" width="${((lot.x1 - lot.x0) * scale).toFixed(1)}" height="${((lot.y1 - lot.y0) * scale).toFixed(1)}" fill="none" stroke="${o.fenceTint}" stroke-width="2"/>`);
  p.push(`<line x1="${tx(lot.x0)}" y1="${ty(lot.y0)}" x2="${tx(lot.x1)}" y2="${ty(lot.y0)}" stroke="#1b2230" stroke-width="3" stroke-dasharray="6 5"/>`); // street edge
  p.push(`<text x="${tx((lot.x0 + lot.x1) / 2)}" y="${(ty(lot.y0) - 4)}" fill="#9fb0c0" font-family="monospace" font-size="11" text-anchor="middle">street</text>`);
  p.push('</svg>');
  return p.join('');
}

/** Top-down site plan for a split-mirror pair (lawn, both houses, garages, paths, party line). */
export function renderSplitSitePlanSvg(s, opts = {}) {
  const { lot, splitX } = s;
  const units = s.perimeter?.units || [];
  const houses = s.houses || [];
  const pad = 4, scale = opts.scale || 6;
  const W = (lot.x1 - lot.x0 + pad * 2) * scale, H = (lot.y1 - lot.y0 + pad * 2) * scale;
  const tx = (x) => ((x - lot.x0 + pad) * scale).toFixed(1);
  const ty = (y) => ((y - lot.y0 + pad) * scale).toFixed(1);
  const o = { ...PERIMETER_DEFAULTS, ...opts };
  const rect = (r, fill, op = 1) => r ? `<rect x="${tx(r.x0)}" y="${ty(r.y0)}" width="${((r.x1 - r.x0) * scale).toFixed(1)}" height="${((r.y1 - r.y0) * scale).toFixed(1)}" fill="${fill}" opacity="${op}"/>` : '';
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">`];
  p.push(rect(lot, o.grassTint));
  for (const u of units) { p.push(rect(u.apronRect, o.driveTint)); p.push(rect(u.pathRect, o.pathTint)); }
  for (const h of houses) p.push(rect(h.footprint, '#c9c2b0'));
  for (const u of units) p.push(rect(u.garageRect, o.garageTint));
  p.push(`<rect x="${tx(lot.x0)}" y="${ty(lot.y0)}" width="${((lot.x1 - lot.x0) * scale).toFixed(1)}" height="${((lot.y1 - lot.y0) * scale).toFixed(1)}" fill="none" stroke="${o.fenceTint}" stroke-width="2"/>`);
  p.push(`<line x1="${tx(splitX)}" y1="${ty(lot.y0)}" x2="${tx(splitX)}" y2="${ty(lot.y1)}" stroke="#c2496a" stroke-width="2" stroke-dasharray="7 6"/>`);   // xa | xb split
  p.push(`<line x1="${tx(lot.x0)}" y1="${ty(lot.y0)}" x2="${tx(lot.x1)}" y2="${ty(lot.y0)}" stroke="#1b2230" stroke-width="3" stroke-dasharray="6 5"/>`);
  p.push(`<text x="${tx(splitX)}" y="${(ty(lot.y0) - 4)}" fill="#c2496a" font-family="monospace" font-size="11" text-anchor="middle">xa | xb</text>`);
  p.push('</svg>');
  return p.join('');
}
