// vegetation/wind — wind as a world element: one seeded gust field, and how much of it each plant takes.
//
// The field: a mean wind (m/s at 2 m) toward `dir`, gusts carried downwind at the mean speed (frozen turbulence: a
// gust seen here arrives `d / speed` seconds later d metres downwind), stretched twice as long down the wind as across
// it, reshaping over `evolve` seconds; a log profile over the ground's roughness, so a lawn feels less than a tree's
// crown; and a direction that wanders with the gusts (`veer`).
//
// Flaccidity φ ∈ [0, 1]: the share of the air's push a thing takes. Everything that existed before wind is φ = 0 and
// does not move; grass and plants are born at 1 (`flaccidity` tunes each). φ is a coupling, not a stiffness: how far a
// plant bends for the push it takes is its own mechanics, below.
//
// A plant in the wind is a cantilever under its own weight w plus a drag per unit length that is R·w sideways. A uniform
// load in a fixed direction is still the elastica (mechanics.js), with B scaled by |load| = √(1 + R²) and the clamp
// angle measured from the plane normal to the load, so a plant's pose in wind is the same solve as its droop. R is
//     R = φ · sail · F[ |u|^(1+V) u ]
//   sail: drag over weight at 1 m/s; V: the Vogel exponent (drag ∝ u^(2+V)): flexible things streamline as they bend,
//   grass about −1, a rigid bluff body 0 (Vogel 1989; Gosselin & de Langre 2011). Without it every blade lies flat by
//   5 m/s and φ = ½ looks like φ = 1.
//   F: a damped oscillator's impulse response at the plant's first natural frequency, unit DC gain, sampled at lags:
//   a steady wind gives exactly the static pose; a gust overshoots and rings. For a uniform cantilever
//   f1 = (1.875²/2π)·√(EI/(m L⁴)), and with B = m g L³/(EI) that is 0.56·√(g/(B L)).
// The page (scene/channels/terrain-wind.js) evaluates this per vertex on the GPU over the baked `bendTable`.
import { elastica } from './mechanics.js';
import { GRASSES } from './grass.js';

export const TERRAIN_WIND_DEFAULTS = Object.freeze({ speed: 5, dir: 0, gust: 0.5, scale: 8, evolve: 6, veer: 20, seed: 1, flaccidity: Object.freeze({ grass: 1, plants: 1 }) });
export const WIND_LAGS = 16;          // samples of the response filter, per vertex

/**
 * How each kind of plant takes the wind, as ONE cantilever the height of the whole plant (a tuft, a tree):
 * B its bending number, sail (drag/weight at 1 m/s), vogel, zeta (damping ratio), flutter (m at the top at full drag:
 * a blade's or a leaf's own quiver, out of phase with its neighbours). Estimates in the literature's ranges, tuned by eye:
 * a grass kind's B is the middle of its blades' (grass.js); a tree's is set so a 10 m tree's crown moves tens of cm at
 * 10 m/s (field sway records are 0.1–0.5 m), not the B of its weight alone, which a trunk's stiffness dwarfs.
 */
export const WIND_TAKERS = Object.freeze({
  tree: Object.freeze({ B: 0.5, sail: 0.02, vogel: -0.5, zeta: 0.15, flutter: 0.08 }),
  palm: Object.freeze({ B: 1.2, sail: 0.03, vogel: -0.6, zeta: 0.12, flutter: 0.15 }),
  culm: Object.freeze({ B: 2, sail: 0.04, vogel: -0.6, zeta: 0.1, flutter: 0.1 }),
  tuft: Object.freeze({ B: 2, sail: 0.1, vogel: -0.8, zeta: 0.2, flutter: 0.04 }),
});
// A tuft's sail is less than one blade's (≈ 0.35 for a blade 0.3 mm thick): its outer blades shelter the inner ones.
// 0.15 is set by eye: a meadow at 7 m/s waves and bows in the gusts but does not lie down.
export const GRASS_TAKER = Object.freeze({ sail: 0.15, vogel: -0.9, zeta: 0.25, flutter: 0.025 });
// A tuft is a bundle: its blades lean on each other, so it sways as a stem of half its blades' middle B. That keeps every
// kind under Greenhill's self-buckling number (≈ 7.84): an upright stem past it cannot stand, and would fall over at the first breath.
export const grassTaker = (kind) => { const G = GRASSES[kind]; return { B: G ? (G.B[0] + G.B[1]) / 4 : 1.5, ...GRASS_TAKER }; };
export const naturalFrequency = (B, L) => 0.5596 * Math.sqrt(9.81 / (Math.max(B, 1e-3) * L));

/** `wind` on a terrain manifest: true, or { speed?, dir?, gust?, scale?, evolve?, veer?, seed?, flaccidity? }. → error strings. */
export function validateTerrainWind(wind, manifest = {}) {
  if (wind === undefined || wind === null || wind === false) return [];
  const shape = 'terrain.wind must be true or { speed?, dir?, gust?, scale?, evolve?, veer?, seed?, flaccidity?: { grass?, plants? } }';
  if (wind !== true && (typeof wind !== 'object' || Array.isArray(wind))) return [shape];
  const e = [];
  if (manifest.planet) e.push('terrain.wind is for flat worlds: its gusts and the plants it bends stand on flat ground');
  if (wind === true) return e;
  const num = (k, lo, hi, what) => { const v = wind[k]; if (v !== undefined && !(Number.isFinite(v) && v >= lo && v <= hi)) e.push(`terrain.wind.${k} must be ${lo}–${hi} (${what})`); };
  num('speed', 0, 30, 'm/s at 2 m above the ground: 3 a breeze, 8 a fresh wind, 15 a gale');
  num('dir', -360, 360, 'degrees the wind blows toward, from +x (east) toward +y (north)');
  num('gust', 0, 1, 'how gusty: 0 steady, 1 squalls twice the mean and lulls to nothing');
  num('scale', 2, 60, 'metres across a gust; twice that along the wind');
  num('evolve', 1, 60, 'seconds for a gust to change its shape as it travels');
  num('veer', 0, 90, 'degrees the direction wanders at full gust');
  if (wind.seed !== undefined && !Number.isInteger(wind.seed)) e.push('terrain.wind.seed must be an integer');
  const f = wind.flaccidity;
  if (f !== undefined) {
    if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).some((k) => !['grass', 'plants'].includes(k))) e.push('terrain.wind.flaccidity must be { grass?, plants? }');
    else for (const k of ['grass', 'plants']) if (f[k] !== undefined && !(Number.isFinite(f[k]) && f[k] >= 0 && f[k] <= 1)) e.push(`terrain.wind.flaccidity.${k} must be 0–1 (the share of the wind's push it takes; 0 holds it still)`);
  }
  return e;
}

/** The wind spec, normalized, or null when absent. */
export function resolveTerrainWind(wind) {
  if (wind === undefined || wind === null || wind === false) return null;
  const w = wind === true ? {} : wind;
  return { ...TERRAIN_WIND_DEFAULTS, ...w, flaccidity: { ...TERRAIN_WIND_DEFAULTS.flaccidity, ...(w.flaccidity || {}) } };
}

// ── the bend table ─────────────────────────────────────────────────────────────────────────────────────────────
// For a plant standing straight up of bending number B under a sideways load R (in its own weights), the elastica's
// change of shape from its shape in still air, at NS points along it: (Δ downwind, Δ up), in units of its length; no
// load is exactly no change. B stays under Greenhill's number, where an upright stem still stands. Axes: r = R spaced
// in log1p up to R_MAX; s = 0..1; B spaced in log1p up to B_MAX. The page reads it as a 3D texture, trilinear.
export const BEND = Object.freeze({ NR: 16, NS: 9, NB: 14, R_MAX: 12, B_MAX: 7 });
let bendMemo = null;
export function bendTable() {
  if (bendMemo) return bendMemo;
  const { NR, NS, NB, R_MAX, B_MAX } = BEND, n = 64, data = new Float32Array(NR * NS * NB * 2);
  for (let b = 0; b < NB; b++) {
    const B = Math.expm1((b / (NB - 1)) * Math.log1p(B_MAX));
    let still = null;
    for (let i = 0; i < NR; i++) {
      const R = Math.expm1((i / (NR - 1)) * Math.log1p(R_MAX)), m = Math.sqrt(1 + R * R);
      // a vertical stem under the load (R, −1): θ0 = asin(1/m) above the plane normal to it; (x, y) → world (h, v)
      const { pts } = elastica({ B: B * m, theta0: Math.asin(1 / m), n });
      const hv = [...Array(NS)].map((_, k) => { const [x, y] = pts[Math.round((n * k) / (NS - 1))]; return [(x - y * R) / m, (x * R + y) / m]; });
      if (!still) still = hv;
      for (let k = 0; k < NS; k++) { const o = ((b * NS + k) * NR + i) * 2; data[o] = hv[k][0] - still[k][0]; data[o + 1] = hv[k][1] - still[k][1]; }   // x fastest: r, then s, then B
    }
  }
  return (bendMemo = { ...BEND, data });
}

/**
 * The page's wind: the field, and how each grass kind and plant species takes it.
 * `grassKinds`: the grass channel's species names, in order; `plantKinds`: the plants channel's species kinds, in order.
 */
export function windPageChannel(spec, { grassKinds = [], plantKinds = [] } = {}) {
  const t = bendTable(), DEG = Math.PI / 180, phi = spec.flaccidity;
  return {
    speed: spec.speed, dir: spec.dir * DEG, gust: spec.gust, scale: spec.scale, evolve: spec.evolve, veer: spec.veer * DEG, seed: spec.seed, z0: 0.05, lags: WIND_LAGS,
    grass: grassKinds.map((k) => ({ ...grassTaker(k), phi: phi.grass })),
    plants: plantKinds.map((k) => ({ ...(WIND_TAKERS[k] || WIND_TAKERS.tree), phi: phi.plants })),
    bend: { NR: t.NR, NS: t.NS, NB: t.NB, R_MAX: t.R_MAX, B_MAX: t.B_MAX, data: { __b64: Buffer.from(t.data.buffer).toString('base64'), t: 'Float32Array' } },
  };
}
