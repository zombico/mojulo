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

export const TERRAIN_WIND_DEFAULTS = Object.freeze({ speed: 5, dir: 0, gust: 0.5, scale: 8, evolve: 6, veer: 20, seed: 1, flaccidity: Object.freeze({ grass: 1, plants: 1, debris: 1 }) });
// loose debris around the camera, carried by the same field: fallen leaves and dust (counts), within `radius` metres
export const WIND_DEBRIS_DEFAULTS = Object.freeze({ leaves: 700, dust: 1200, radius: 30 });
const FLACCID = ['grass', 'plants', 'debris'];
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

/** `wind` on a terrain manifest: true, or { speed?, dir?, gust?, scale?, evolve?, veer?, seed?, flaccidity?, debris? }. → error strings. */
export function validateTerrainWind(wind, manifest = {}) {
  if (wind === undefined || wind === null || wind === false) return [];
  const shape = 'terrain.wind must be true or { speed?, dir?, gust?, scale?, evolve?, veer?, seed?, flaccidity?: { grass?, plants?, debris? }, debris?: false | { leaves?, dust?, radius? } }';
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
    if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).some((k) => !FLACCID.includes(k))) e.push('terrain.wind.flaccidity must be { grass?, plants?, debris? }');
    else for (const k of FLACCID) if (f[k] !== undefined && !(Number.isFinite(f[k]) && f[k] >= 0 && f[k] <= 1)) e.push(`terrain.wind.flaccidity.${k} must be 0–1 (the share of the wind's push it takes; 0 holds it still)`);
  }
  const d = wind.debris;
  if (d !== undefined && d !== true && d !== false) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some((k) => !['leaves', 'dust', 'radius'].includes(k))) e.push('terrain.wind.debris must be true, false or { leaves?, dust?, radius? }');
    else {
      const cnt = (k, hi) => { if (d[k] !== undefined && !(Number.isInteger(d[k]) && d[k] >= 0 && d[k] <= hi)) e.push(`terrain.wind.debris.${k} must be an integer 0–${hi}`); };
      cnt('leaves', 3000); cnt('dust', 6000);
      if (d.radius !== undefined && !(Number.isFinite(d.radius) && d.radius >= 10 && d.radius <= 80)) e.push('terrain.wind.debris.radius must be 10–80 (metres around the camera where debris lies)');
    }
  }
  return e;
}

/** The wind spec, normalized, or null when absent. */
export function resolveTerrainWind(wind) {
  if (wind === undefined || wind === null || wind === false) return null;
  const w = wind === true ? {} : wind;
  const debris = w.debris === false ? null : { ...WIND_DEBRIS_DEFAULTS, ...(w.debris && w.debris !== true ? w.debris : {}) };
  return { ...TERRAIN_WIND_DEFAULTS, ...w, flaccidity: { ...TERRAIN_WIND_DEFAULTS.flaccidity, ...(w.flaccidity || {}) }, debris: debris && debris.leaves + debris.dust > 0 ? debris : null };
}

// ── the field, as one self-contained function ─────────────────────────────────────────────────────────────────
/**
 * windField(W) closes over nothing: the server and the tests call it, and the World page inlines its source, so the
 * page's particles and its vertex shader read the same gusts. W: { speed, dir (rad), gust, scale, evolve, veer (rad),
 * seed, z0 }. → { N, noise (N·N RGBA bytes: R the gust, G the veer, B the updraught), at(x, y, z, t) → [ux, uy, uz] }.
 * The noise is read as the GPU reads a linear-filtered, repeating 8-bit texture: texel centres at i + ½.
 */
export function windField(W) {
  let a = W.seed | 0; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const N = 64, noise = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { noise[4 * i] = Math.floor(rnd() * 256); noise[4 * i + 1] = Math.floor(rnd() * 256); noise[4 * i + 2] = Math.floor(rnd() * 256); noise[4 * i + 3] = 255; }
  const tex = (u, v, ch) => {
    const x = u - 0.5, y = v - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const g = (i, j) => noise[((((y0 + j) % N) + N) % N * N + ((((x0 + i) % N) + N) % N)) * 4 + ch] / 255 * 2 - 1;
    return (g(0, 0) * (1 - fx) + g(1, 0) * fx) * (1 - fy) + (g(0, 1) * (1 - fx) + g(1, 1) * fx) * fy;
  };
  const dx = Math.cos(W.dir), dy = Math.sin(W.dir), L2 = Math.log((2 + W.z0) / W.z0);
  function at(x, y, z, t) {
    if (!(W.speed > 0)) return [0, 0, 0];
    const e = t / W.evolve, qa = (x * dx + y * dy - W.speed * t) / (2 * W.scale), qb = (dx * y - dy * x) / W.scale;
    const ua = qa + 0.37 * e, va = qb - 0.23 * e, ub = qa * 2.03 - 0.51 * e + 0.5, vb = qb * 2.03 + 0.61 * e + 0.5;
    const n = (ch) => 0.7 * tex(ua, va, ch) + 0.3 * tex(ub, vb, ch);
    const prof = Math.log((Math.max(z, 0) + W.z0) / W.z0) / L2, s = W.speed * prof * Math.max(0, 1 + 2 * W.gust * n(0)), th = W.veer * W.gust * n(1);
    const c = Math.cos(th), si = Math.sin(th);
    // the updraught: turbulence reaches the ground (half of it at the surface), so a gust can loft a leaf
    return [s * (dx * c - dy * si), s * (dx * si + dy * c), 0.35 * W.speed * W.gust * (0.5 + 0.5 * Math.min(1, prof)) * n(2)];
  }
  return { N, noise, at };
}

// ── debris, as one self-contained function ────────────────────────────────────────────────────────────────────
/**
 * debrisKernel(D, at, groundAt) closes over nothing (the page inlines it). D: { seed, phi, leaves, dust, radius }; at: the
 * field's at(); groundAt(x, y) → the surface z (water counts: a leaf floats). Debris lies within `radius` of the camera.
 * A piece takes φ of the wind: on the ground it lies still until the wind 5 cm up passes its lift (dust 0.6 m/s, a leaf
 * 1.2: about a fifth of the wind at 2 m over grass, so leaves skitter from a moderate breeze), then it is airborne under implicit linear drag toward φ·u with a still-air settling speed, and lands. A piece
 * carried out of the radius comes back in at its mirror through the camera, lying on the ground, so the density holds.
 * → { n, kind (0 leaf, 1 dust), x, y, z, vx, vy, vz, spin, place(cx, cy), step(dt, t, cx, cy) }.
 */
export function debrisKernel(D, at, groundAt) {
  const KINDS = [{ tau: 0.3, settle: 0.9, lift: 1.2 }, { tau: 0.04, settle: 0.12, lift: 0.6 }];
  let a = (D.seed ^ 0x5bd1e995) | 0; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const n = D.leaves + D.dust, R = D.radius, f = () => new Float64Array(n);
  const S = { n, kind: new Uint8Array(n), x: f(), y: f(), z: f(), gz: f(), vx: f(), vy: f(), vz: f(), spin: f(), du: f(), dv: f() };   // gz: the ground under it, read once a move
  for (let i = 0; i < n; i++) { S.kind[i] = i < D.leaves ? 0 : 1; const r = R * Math.sqrt(rnd()), q = 2 * Math.PI * rnd(); S.du[i] = r * Math.cos(q); S.dv[i] = r * Math.sin(q); S.spin[i] = 2 * Math.PI * rnd(); }
  const lay = (i, x, y) => { S.x[i] = x; S.y[i] = y; S.z[i] = S.gz[i] = groundAt(x, y); S.vx[i] = 0; S.vy[i] = 0; S.vz[i] = 0; };
  S.place = (cx, cy) => { for (let i = 0; i < n; i++) lay(i, cx + S.du[i], cy + S.dv[i]); };
  S.step = (dt, t, cx, cy) => {
    for (let i = 0; i < n; i++) {
      let ex = S.x[i] - cx, ey = S.y[i] - cy;
      if (ex * ex + ey * ey > R * R) {                       // out of reach: in again at the mirror, or at its own spot if that is out too
        if (ex * ex + ey * ey < 4 * R * R) lay(i, cx - ex * 0.98, cy - ey * 0.98); else lay(i, cx + S.du[i], cy + S.dv[i]);
        continue;
      }
      const P = KINDS[S.kind[i]], g = S.z[i] <= S.gz[i] + 1e-6;
      let ux = 0, uy = 0, uz = 0;
      if (D.phi > 0) { const u = at(S.x[i], S.y[i], Math.max(0.05, S.z[i] - S.gz[i]), t); ux = D.phi * u[0]; uy = D.phi * u[1]; uz = D.phi * u[2]; }
      if (g) {
        const uh = Math.hypot(ux, uy);
        if (uh > P.lift) { S.vz[i] = Math.min(3, 1.5 * (uh - P.lift) + Math.max(0, uz)); S.vx[i] = 0.5 * ux; S.vy[i] = 0.5 * uy; }
        else { const k = Math.exp(-dt / 0.15); S.vx[i] *= k; S.vy[i] *= k; S.vz[i] = 0; if (Math.abs(S.vx[i]) + Math.abs(S.vy[i]) > 1e-3) { S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt; S.z[i] = S.gz[i] = groundAt(S.x[i], S.y[i]); } else { S.vx[i] = 0; S.vy[i] = 0; } continue; }
      }
      const k = dt / P.tau;
      S.vx[i] = (S.vx[i] + k * ux) / (1 + k); S.vy[i] = (S.vy[i] + k * uy) / (1 + k); S.vz[i] = (S.vz[i] + k * (uz - P.settle)) / (1 + k);
      S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt; S.z[i] += S.vz[i] * dt;
      const gz = S.gz[i] = groundAt(S.x[i], S.y[i]);
      if (S.z[i] <= gz) { S.z[i] = gz; S.vz[i] = 0; S.vx[i] *= 0.5; S.vy[i] *= 0.5; }
      S.spin[i] += dt * (3 + 2 * Math.hypot(S.vx[i], S.vy[i]));
    }
  };
  return S;
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
    ...(spec.debris ? { debris: { ...spec.debris, phi: phi.debris } } : {}),   // φ 0: it lies where it fell
    speed: spec.speed, dir: spec.dir * DEG, gust: spec.gust, scale: spec.scale, evolve: spec.evolve, veer: spec.veer * DEG, seed: spec.seed, z0: 0.05, lags: WIND_LAGS,
    grass: grassKinds.map((k) => ({ ...grassTaker(k), phi: phi.grass })),
    plants: plantKinds.map((k) => ({ ...(WIND_TAKERS[k] || WIND_TAKERS.tree), phi: phi.plants })),
    bend: { NR: t.NR, NS: t.NS, NB: t.NB, R_MAX: t.R_MAX, B_MAX: t.B_MAX, data: { __b64: Buffer.from(t.data.buffer).toString('base64'), t: 'Float32Array' } },
  };
}
