/**
 * craft-common — the shared kit of the craft-* part shelf (aircraft and spacecraft).
 *
 * The craft shelf is the flying sibling of the veh-* shelf (vehicle-designer/): the same
 * six colour roles, so a veh palette dresses a craft part and a craft palette a car part;
 * the same seeded helpers; the same `garage` block on every recipe. What differs is scale:
 * a craft part is authored in true METRES (`units: 'm'`), because an airliner and a pilot
 * must share one ruler.
 *
 * Craft space: +y forward (toward the nose), +z up, +x right (starboard). Every part is
 * authored around its MOUNT at the origin; `resolveCraftPart` can seat it on the grid for
 * a lone preview, and `assembleCraft` places it by that mount.
 */

import { VEH_COLOR_ROLES, VEH_PALETTES, clone, hashSeed, mulberry32, round3 } from '../vehicle-designer/veh-common.js';
import { perpBasis } from '../polygonizer/extrude-faces.js';

export { clone, hashSeed, mulberry32, round3 };

// The six roles, shared with the veh-* shelf: `chrome` is bare metal, `light` is anything that
// glows (nav lights, exhaust, an ion vent).
export const CRAFT_COLOR_ROLES = VEH_COLOR_ROLES;

export const CRAFT_PALETTES = {
  // earth
  airlinerWhite: { paint: '#eef0f2', trim: '#1f4e8c', glass: '#26323c', rubber: '#1a1b1d', chrome: '#a9b0b7', light: '#e94b3c' },
  navyGrey: { paint: '#8c949c', trim: '#5f676f', glass: '#5e6f45', rubber: '#1c1d1f', chrome: '#6c737a', light: '#ff8a3c' },
  trainerYellow: { paint: '#e9b524', trim: '#202326', glass: '#7fa6bf', rubber: '#1b1c1e', chrome: '#c4c8cc', light: '#e94b3c' },
  warbirdOlive: { paint: '#5a5f3c', trim: '#b9b39a', glass: '#8fb0c4', rubber: '#1b1c1e', chrome: '#9aa0a6', light: '#ffb347' },
  polishedAlu: { paint: '#c6ccd2', trim: '#20242a', glass: '#7ea8c4', rubber: '#181a1c', chrome: '#e3e7eb', light: '#e94b3c' },
  // space
  scoutIvory: { paint: '#d9d4c7', trim: '#a8473a', glass: '#2b3a44', rubber: '#3b3d40', chrome: '#8d9196', light: '#ff7a4a' },
  interceptorSlate: { paint: '#6f767e', trim: '#2d3238', glass: '#1d2a33', rubber: '#24272b', chrome: '#9aa1a8', light: '#7fd3ff' },
  colonialSteel: { paint: '#b7bbbd', trim: '#7d2a26', glass: '#2a3540', rubber: '#2a2c2f', chrome: '#8f9498', light: '#ffb347' },
  carrierBlue: { paint: '#56616f', trim: '#c9a64a', glass: '#1f2b36', rubber: '#26292d', chrome: '#a3a9b0', light: '#8fd0ff' },
};

const PALETTE_IDS = Object.keys(CRAFT_PALETTES);
const ALL_PALETTES = { ...VEH_PALETTES, ...CRAFT_PALETTES };

/** A palette id (craft or veh) plus per-role overrides → { id, colors }. */
export function resolveCraftPalette(palette, colors = {}, fallback) {
  const id = palette || fallback || PALETTE_IDS[0];
  const base = ALL_PALETTES[id];
  if (!base) throw new Error(`Unknown craft palette '${id}' - expected one of: ${Object.keys(ALL_PALETTES).join(', ')}`);
  const out = { ...base };
  for (const [role, value] of Object.entries(colors || {})) {
    if (!CRAFT_COLOR_ROLES.includes(role)) throw new Error(`Unknown craft color role '${role}' - expected one of: ${CRAFT_COLOR_ROLES.join(', ')}`);
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`craft color '${role}' must be a #RRGGBB hex string; received ${JSON.stringify(value)}`);
    out[role] = value.toLowerCase();
  }
  return { id, colors: out };
}

export const DEG = Math.PI / 180;
const round4 = (n) => Math.round(n * 1e4) / 1e4;
export const p3 = (v) => ({ x: round3(v[0]), y: round3(v[1]), z: round3(v[2]) });

/**
 * A profile authored in WORLD terms for a straight monomer running `from` → `to`: each point is
 * a world offset vector in the plane square to the axis, projected onto the kernel's own (u, v)
 * basis (`perpBasis`, the extrude/loft framing). The kernel's basis flips with the axis
 * direction; authoring in world terms keeps every part honest whichever way it points.
 */
export function planeUV(from, to, offsets) {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const n = Math.hypot(d[0], d[1], d[2]);
  const [u, v] = perpBasis([d[0] / n, d[1] / n, d[2] / n]);
  // 0.1 mm, not 1 mm: a thin trailing edge rounded to the millimetre zig-zags, and its cap tears
  return offsets.map((o) => [round4(o[0] * u[0] + o[1] * u[1] + o[2] * u[2]), round4(o[0] * v[0] + o[1] * v[1] + o[2] * v[2])]);
}

// ---- sections -------------------------------------------------------------------------------

const AIRFOIL_STEPS = 13;  // per surface; a section is 2 * 13 - 2 = 24 points, TE → upper → LE → lower

/**
 * A wing section as [chordwise, thickness] pairs, chord running 0 (LE) → 1 (TE), scaled later.
 *  - `naca`: the 4-digit thickness form with a closed trailing edge and a light camber;
 *  - `slab`: a flat plate with rounded edges (a starfighter foil, a radiator panel);
 *  - `facet`: a flat-paneled section, a hexagon of straight facets (a faceted stealth wing, a
 *    starship's armour panel): every chordwise strip of skin is a plane;
 *  - `diamond`: the supersonic double wedge, two facets a side.
 */
export function airfoil({ thickness = 0.12, camber = 0, kind = 'naca' } = {}) {
  const xs = [];
  for (let i = 0; i < AIRFOIL_STEPS; i += 1) xs.push(0.5 * (1 - Math.cos((Math.PI * i) / (AIRFOIL_STEPS - 1))));
  const half = (x) => {
    if (kind === 'slab') return (thickness / 2) * Math.min(1, Math.sqrt(Math.min(x, 1 - x) / 0.06));
    if (kind === 'facet') return (thickness / 2) * Math.min(1, x / 0.25, (1 - x) / 0.35);
    if (kind === 'diamond') return (thickness / 2) * (1 - Math.abs(2 * x - 1));
    return 5 * thickness * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  };
  const mean = (x) => camber * 4 * x * (1 - x);
  const upper = xs.slice().reverse().map((x) => [x, mean(x) + half(x)]);        // TE → LE
  const lower = xs.slice(1, -1).map((x) => [x, mean(x) - half(x)]);               // LE → TE, no repeats
  return [...upper, ...lower];
}

export const SECTION_POINTS = 24;

/**
 * A fuselage or hull cross-section: a superellipse of half-width a, half-height b, exponent n
 * (2 an ellipse, 4 a rounded box, 1.5 a chined diamond), its lower half scaled by `belly`
 * (1 symmetric, < 1 a flat-bottomed hull). Returns [x, z] pairs, CCW seen from the nose.
 */
export function section(a, b, n = 2, belly = 1) {
  const pts = [];
  for (let j = 0; j < SECTION_POINTS; j += 1) {
    const th = (j / SECTION_POINTS) * 2 * Math.PI;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / n);
    const z = b * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push([x, z < 0 ? z * belly : z]);
  }
  return pts;
}

/**
 * A flat-paneled section: a closed polygon `shape` ([x, z] in −1..1, CCW from +x) scaled to
 * half-width a and half-height b, resampled to SECTION_POINTS with every corner kept, so each
 * side stays one flat facet and stations morph corner to corner.
 */
export function facetSection(a, b, shape) {
  const n = shape.length;
  const len = shape.map((p, i) => { const q = shape[(i + 1) % n]; return Math.hypot((q[0] - p[0]) * a, (q[1] - p[1]) * b); });
  const total = len.reduce((s, l) => s + l, 0);
  // every corner is a point; the rest share out by edge length (largest remainder, deterministic)
  const spare = SECTION_POINTS - n;
  const raw = len.map((l) => (l / total) * spare);
  const extra = raw.map(Math.floor);
  let left = spare - extra.reduce((s, k) => s + k, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]).forEach(([, i]) => { if (left > 0) { extra[i] += 1; left -= 1; } });
  const pts = [];
  shape.forEach((p, i) => {
    const q = shape[(i + 1) % n];
    for (let k = 0; k <= extra[i]; k += 1) {
      const t = k / (extra[i] + 1);
      pts.push([(p[0] + t * (q[0] - p[0])) * a, (p[1] + t * (q[1] - p[1])) * b]);
    }
  });
  return pts;
}

/** A lathe profile from [t, radius] pairs. */
export function latheProfile(pairs) {
  return pairs.map(([t, radius]) => ({ t: round3(t), radius: round3(radius) }));
}

export function lathe(id, from, to, pairs, tint, extra = {}) {
  return { id, axisFrom: p3(from), axisTo: p3(to), profile: latheProfile(pairs), tint, ...extra };
}

export function sweep(id, path, radius, tint, extra = {}) {
  return { id, path: path.map((q) => q.map(round3)), radius: round3(radius), tint, ...extra };
}

/** A straight extrude whose polygon is authored in world offsets square to the axis. */
export function extrudeWorld(id, from, to, offsets, tint, extra = {}) {
  return { id, axisFrom: p3(from), axisTo: p3(to), profile: { points: planeUV(from, to, offsets) }, tint, ...extra };
}

/** A straight loft whose station polygons are authored in world offsets square to the axis. */
export function loftWorld(id, from, to, stations, tint, extra = {}) {
  return {
    id,
    axisFrom: p3(from),
    axisTo: p3(to),
    stations: stations.map((st) => ({ t: round3(st.t), profile: planeUV(from, to, st.points) })),
    tint,
    ...extra,
  };
}
