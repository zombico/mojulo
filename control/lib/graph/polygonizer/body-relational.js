/** body-relational.js — the BODY as a form field: the realistic register's vertical slice. The hero's trunk read the way
 * head-relational.js reads the head: bone where it shows and the muscle masses placed from the hero's REST JOINTS (so the
 * field rides any cast and any tune), summed into one skin (log-sum-exp: each mass a bump in one wave, the valleys
 * between them the grooves an artist cuts), and the hero's torso cage re-sampled onto it, denser.
 *
 *   positions  x and y in W (the half biacromial: the shoulder joint's x), z as t along the torso bone (0 the navel,
 *              1 the neck hub); every length in W
 *   the base   the core (the spine's column, so every ring's centre sits inside), the ribcage's egg, the abdomen, the
 *              flank above the pelvis, the neck's column: summed with a wide blend (`kBase`)
 *   muscles    each a belly (an ellipsoid) SEATED on the base: cast from the trunk's axis toward the front, the back or an
 *              azimuth, its centre on the base's surface pushed out by `proud` less its depth, its fibre laid in the
 *              surface's tangent plane; or a cone between two points (the clavicle, the upper trapezius). A mass off the
 *              midline is mirrored; summed onto the base with a tight blend (`kMuscle`), so where two meet a groove
 *   dimples    smooth subtractions (the navel)
 *
 * formSlice(recipe, R, build) re-samples the torso: rings between the authored stations (the address keeps its u), more
 * slots round each (the front slot 0, the back half way), each slot pushed along its ring's radial line (from the ring's
 * centre through the authored cage's point there) to the field's first crossing outward. The bind follows the authored
 * one (its station and slot shares interpolated), the dials' station blends by u, so the rig poses it unchanged. The
 * pectoral and bust parts leave: the field carries their form. A dev path for the body lane (`body-study --form`), not
 * the door: no minted hero changes. Pure and deterministic (dmath). */
import * as dmath from '../../util/dmath.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : [0, 0, 1]; };
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** an ellipsoid's signed distance (the bound Inigo Quilez's k0·(k0 − 1)/k1: exact on the surface, close near it) */
function sdEgg(p, e) {
  const d = sub(p, e.c), q = [dot(d, e.ax[0]) / e.r[0], dot(d, e.ax[1]) / e.r[1], dot(d, e.ax[2]) / e.r[2]];
  const k0 = len(q), k1 = len([q[0] / e.r[0], q[1] / e.r[1], q[2] / e.r[2]]);
  return k1 > 1e-12 ? (k0 * (k0 - 1)) / k1 : -Math.min(...e.r);
}
/** a round cone's signed distance (the hull of two spheres; vajra.js's, on arrays) */
function sdCone(p, a, b, r1, r2) {
  const ba = sub(b, a), l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr;
  if (l2 < 1e-12 || a2 <= 1e-12) return Math.min(len(sub(p, a)) - r1, len(sub(p, b)) - r2);
  const il2 = 1 / l2, pa = sub(p, a), y = dot(pa, ba), z = y - l2;
  const xv = sub(scl(pa, l2), scl(ba, y)), x2 = dot(xv, xv), y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
/** the skin wave: −k · ln Σ e^(−dᵢ/k) (the union's surface, each mass a bump in it; shifted by the least for range) */
function lse(ds, k) {
  let m = Infinity; for (const d of ds) if (d < m) m = d;
  let s = 0; for (const d of ds) s += dmath.exp(-(d - m) / k);
  return m - k * dmath.log(s);
}
const smaxp = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

/** THE BUILDS. Each mass names its anatomy; a belly is { on: { x, t, face } | { az, t }, along, r: [along, across,
 * depth], proud }, `along` a direction laid into the surface (world axes: +x out to the right, +y forward, +z up), `az`
 * the azimuth from the front toward the right (degrees). `mid` keeps a mass on the midline unmirrored. */
const NORRIN = {
  note: 'lean, sculpted, the anatomy legible under one smooth skin: the male slice (a Silver Surfer-like body)',
  // the hero's own tune under the build: the shoulders 10 % closer (every mass rides W, so the frame narrows with them)
  tune: { shoulders: 0.9 },
  kBase: 0.12, kMuscle: 0.03,
  base: [
    { id: 'core', cone: [[0, -0.09, -0.42], [0, -0.09, 1.0]], r: [0.3, 0.27] },
    { id: 'ribcage', egg: [0, -0.06, 0.5], r: [0.62, 0.44, 0.8] },
    { id: 'abdomen', egg: [0, 0.0, -0.16], r: [0.58, 0.42, 0.56] },
    { id: 'flank', egg: [0, -0.02, -0.4], r: [0.76, 0.46, 0.35] },
    // (the neck thin at the top and flaring out to its root, into the trapezius: a column read pinched at the base)
    { id: 'neck', cone: [[0, -0.05, 0.86], [0, -0.06, 1.8]], r: [0.31, 0.2] },
    { id: 'girdle', cone: [[0.25, -0.06, 0.8], [0.9, -0.02, 0.84]], r: [0.26, 0.2] },
  ],
  muscles: [
    { id: 'pectoralSternal', on: { x: 0.35, t: 0.62, face: 'front' }, along: [1, 0, 0.32], r: [0.44, 0.32, 0.11], proud: 0.1 },
    { id: 'pectoralClavicular', on: { x: 0.33, t: 0.86, face: 'front' }, along: [1, 0, -0.25], r: [0.3, 0.14, 0.06], proud: 0.05 },
    { id: 'rectus1', on: { x: 0.15, t: 0.36, face: 'front' }, along: [0, 0, 1], r: [0.11, 0.14, 0.05], proud: 0.05 },
    { id: 'rectus2', on: { x: 0.15, t: 0.15, face: 'front' }, along: [0, 0, 1], r: [0.11, 0.14, 0.05], proud: 0.055 },
    { id: 'rectus3', on: { x: 0.15, t: -0.05, face: 'front' }, along: [0, 0, 1], r: [0.11, 0.14, 0.05], proud: 0.055 },
    { id: 'rectus4', on: { x: 0.14, t: -0.3, face: 'front' }, along: [0, 0, 1], r: [0.2, 0.13, 0.05], proud: 0.05 },
    { id: 'obliqueExternal', on: { az: 74, t: -0.24 }, along: [0, 0.3, 1], r: [0.3, 0.22, 0.08], proud: 0.045 },
    { id: 'serratus1', on: { az: 60, t: 0.3 }, along: [0, 1, -0.5], r: [0.13, 0.05, 0.035], proud: 0.03 },
    { id: 'serratus2', on: { az: 62, t: 0.44 }, along: [0, 1, -0.45], r: [0.13, 0.05, 0.035], proud: 0.03 },
    { id: 'serratus3', on: { az: 64, t: 0.58 }, along: [0, 1, -0.4], r: [0.12, 0.05, 0.035], proud: 0.03 },
    { id: 'latissimus', on: { az: 118, t: 0.42 }, along: [0.35, 0, 1], r: [0.6, 0.24, 0.1], proud: 0.09 },
    { id: 'infraspinatus', on: { x: 0.42, t: 0.68, face: 'back' }, along: [1, 0, -0.35], r: [0.26, 0.18, 0.11], proud: 0.05 },
    { id: 'trapeziusLower', on: { x: 0, t: 0.62, face: 'back' }, along: [0, 0, 1], r: [0.6, 0.36, 0.12], proud: 0.035, mid: true },
    { id: 'erector', on: { x: 0.14, t: -0.2, face: 'back' }, along: [0, 0, 1], r: [0.5, 0.13, 0.08], proud: 0.07 },
    // the sternocleidomastoid: from behind the ear down and in to the sternum's head, the neck's V from the front
    { id: 'sternocleidomastoid', cone: [[0.22, -0.06, 1.58], [0.06, 0.2, 0.98]], r: [0.07, 0.06] },
    { id: 'trapeziusUpper', cone: [[0.12, -0.15, 1.3], [0.7, -0.06, 0.98]], r: [0.14, 0.1] },
    // the armpit FILLED (the hanging arm covers it): the pectoral's and the latissimus's tendons into the arm and the
    // hollow between them, a cone from a point low on the chest's wall up to the shoulder, its side only ever moving
    // out as it rises. Without it the torso's rays at the shoulder's height crossed a gap between the chest's wall and
    // the deltoid's cap, by turns, in fins; a round mass only moved the gap under its own overhang
    { id: 'axilla', cone: [[0.5, -0.03, 0.0], [0.76, -0.03, 0.68]], r: [0.05, 0.17] },
    // the pectoral's tendon running under the anterior deltoid into the arm (the pocket between them, by turns the
    // pec's wall and the deltoid's, read as fins)
    { id: 'pectoralTendon', egg: [0.8, 0.14, 0.74], r: [0.22, 0.18, 0.18] },
    { id: 'clavicle', cone: [[0.1, 0.24, 0.94], [0.7, 0.06, 0.98]], r: [0.06, 0.07] },
  ],
  dimples: [{ id: 'navel', on: { x: 0, t: -0.02, face: 'front' }, r: 0.025, k: 0.03 }],
  // the arms (the right; the left its mirror): s along the bone, az round it (0 the front, 90 the outside)
  kLimb: 0.03,
  limbs: {
    upperArm: { from: 'shoulderR', to: 'elbowR', rings: 19, masses: [
      { id: 'humerus', cone: [0, 1], r: [0.15, 0.13] },
      { id: 'deltoidAnterior', s: 0.16, az: 25, off: 0.11, r: [0.3, 0.16, 0.13] },
      { id: 'deltoidLateral', s: 0.2, az: 90, off: 0.12, r: [0.32, 0.19, 0.14] },
      { id: 'deltoidPosterior', s: 0.18, az: 155, off: 0.11, r: [0.3, 0.16, 0.12] },
      { id: 'biceps', s: 0.56, az: 5, off: 0.1, r: [0.36, 0.17, 0.15] },
      { id: 'brachialis', s: 0.74, az: 70, off: 0.09, r: [0.2, 0.13, 0.11] },
      { id: 'tricepsLong', s: 0.44, az: 200, off: 0.11, r: [0.42, 0.17, 0.14] },
      { id: 'tricepsLateral', s: 0.38, az: 135, off: 0.11, r: [0.3, 0.15, 0.12] },
      { id: 'elbow', s: 0.98, r: [0.13, 0.17, 0.13] },
    ] },
    foreArm: { from: 'elbowR', to: 'wristR', rings: 17, masses: [
      { id: 'radiusUlna', cone: [0, 1], r: [0.14, 0.085] },
      { id: 'elbow', s: 0.02, r: [0.12, 0.16, 0.13] },
      { id: 'brachioradialis', s: 0.22, az: 45, off: 0.1, r: [0.36, 0.15, 0.13] },
      { id: 'flexors', s: 0.28, az: -55, off: 0.1, r: [0.38, 0.16, 0.13] },
      { id: 'extensors', s: 0.3, az: 135, off: 0.09, r: [0.34, 0.15, 0.11] },
      { id: 'wrist', s: 0.97, r: [0.1, 0.1, 0.14] },
    ] },
  },
};
/** a build's masses with their radii (and a belly's proud) scaled: one hand on a whole group's mass */
const scaled = (masses, f, proud = f) => masses.map((m) => ({ ...m, r: m.r.map((x) => x * f), ...(m.proud !== undefined ? { proud: m.proud * proud } : {}) }));
const byId = (masses, edits) => masses.map((m) => (edits[m.id] ? { ...m, ...edits[m.id] } : m));
const SHALLA = {
  note: 'lean and toned, the anatomy softer under one smooth skin, the bust in the field: the female slice',
  kBase: 0.12, kMuscle: 0.04,
  // (the half biacromial already carries her narrower shoulders: on it her waist and flank stand wider than his)
  base: byId(NORRIN.base, { abdomen: { r: [0.6, 0.45, 0.6] }, flank: { r: [0.8, 0.5, 0.38] } }),
  muscles: [
    ...byId(scaled(NORRIN.muscles.filter((m) => !/^pectoral(Sternal|Clavicular)$/.test(m.id)), 1, 0.6), {
      rectus1: { proud: 0.025 }, rectus2: { proud: 0.028 }, rectus3: { proud: 0.028 }, rectus4: { proud: 0.03 },
      trapeziusUpper: { r: [0.13, 0.08] }, sternocleidomastoid: { r: [0.07, 0.055] },
    }),
    { id: 'pectoralSternal', on: { x: 0.33, t: 0.64, face: 'front' }, along: [1, 0, 0.3], r: [0.36, 0.26, 0.08], proud: 0.05 },
    // the bust, seated on the chest: its apex a little under half way up the torso bone, out and down along its fibre
    { id: 'bust', on: { x: 0.4, t: 0.47, face: 'front' }, along: [1, 0, -0.3], r: [0.42, 0.37, 0.3], proud: 0.3 },
  ],
  // the fold under the bust: the torso's rays there come down from above (t the fold's height on the torso bone, w the
  // window's half width in t, h the raise in W)
  lift: { t: 0.25, w: 0.22, h: 0.7 },
  dimples: NORRIN.dimples,
  kLimb: 0.035,
  limbs: {
    upperArm: { ...NORRIN.limbs.upperArm, masses: scaled(NORRIN.limbs.upperArm.masses, 0.98) },
    foreArm: { ...NORRIN.limbs.foreArm, masses: scaled(NORRIN.limbs.foreArm.masses, 1.02) },
  },
};
export const BODY_BUILDS = Object.freeze({ norrin: NORRIN, shalla: SHALLA });


/** the build's measures from the rest joints: the half biacromial W, the navel's height and the torso bone's length T */
export function bodyFrame(R) {
  const J = R.joints, W = J.shoulderR[0], z0 = J.navel[2], T = J.neckHub[2] - J.navel[2];
  return { W, z0, T, at: ([x, y, t]) => [x * W, y * W, z0 + t * T] };
}

/** the field: { sd(p), base(p), masses } for a build on a rig's rest */
export function bodyField(R, build, { extra = [] } = {}) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  if (!B) throw new Error(`body-relational: unknown build '${build}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
  const F = bodyFrame(R), W = F.W;
  const frameOf = (along, n) => { const u = unit(sub(along, scl(n, dot(along, n)))), v = cross(n, u); return [u, v, n]; };
  const prim = (m) => {
    if (m.cone) return { cone: [F.at(m.cone[0]), F.at(m.cone[1])], r: m.r.map((x) => x * W) };
    // an egg without a fibre lies on the world's axes (r: x, y, z); with one, r is along, across, depth (depth forward)
    const ax = m.along ? frameOf(unit(m.along), [0, 1, 0]) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    return { egg: true, c: F.at(m.egg), ax, r: m.r.map((x) => x * W) };
  };
  const mirror = (p) => (p.cone ? { ...p, cone: p.cone.map(([x, y, z]) => [-x, y, z]) } : { ...p, c: [-p.c[0], p.c[1], p.c[2]], ax: p.ax.map(([x, y, z]) => [-x, y, z]) });
  const sides = (m, p) => (m.mid || (p.cone ? p.cone.every((q) => q[0] === 0) : p.c[0] === 0) ? [p] : [p, mirror(p)]);
  // (a mass with `clip` is cut smoothly under a cone round the trunk's axis, rising outward from (rho, z) at `slope`:
  // what a neighbour's field owns under it stays out of this one, and the cut faces outward, so a ray from the axis
  // leaves through it once; a level cut left a flat underside the rays grazed)
  const sdOf = (p, q) => {
    const d = p.cone ? sdCone(q, p.cone[0], p.cone[1], p.r[0], p.r[1]) : sdEgg(q, p); if (!p.clip) return d;
    const c = p.clip, s2 = Math.hypot(1, c.slope), cut = (c.slope * (Math.hypot(q[0], q[1]) - c.rho) - (q[2] - c.z)) / s2;
    return smaxp(d, cut, c.k);
  };
  const baseP = B.base.flatMap((m) => sides(m, { ...prim(m), id: m.id })), kB = B.kBase * W, kM = B.kMuscle * W;
  const base = (q) => lse(baseP.map((p) => sdOf(p, q)), kB);
  const grad = (fn, q) => { const e = 1e-4; return unit([fn(add(q, [e, 0, 0])) - fn(sub(q, [e, 0, 0])), fn(add(q, [0, e, 0])) - fn(sub(q, [0, e, 0])), fn(add(q, [0, 0, e])) - fn(sub(q, [0, 0, e]))]); };
  // a point seated on the base: cast from the trunk's axis at height t toward the face, the base's first crossing
  const seat = (on) => {
    const z = F.z0 + on.t * F.T, o = [0, 0, z];
    const dir = on.az !== undefined ? [dmath.sin((on.az * Math.PI) / 180), dmath.cos((on.az * Math.PI) / 180), 0] : [0, on.face === 'back' ? -1 : 1, 0];
    const from = on.az !== undefined ? o : [on.x * W, 0, z];
    const s = crossing(base, from, dir, 0.6) ?? from;
    return { s, n: grad(base, s) };
  };
  const muscles = B.muscles.flatMap((m) => {
    if (m.cone || m.egg) return sides(m, { ...prim(m), id: m.id });
    const { s, n } = seat(m.on), r = m.r.map((x) => x * W);
    const ax = frameOf(unit(m.along), n);
    return sides(m, { egg: true, c: add(s, scl(n, m.proud * W - r[2])), ax, r });
  });
  // masses another field owns and this one shares (the arm's deltoid heads: the shoulder's cap, so both shells agree)
  muscles.push(...extra.flatMap((p) => [p, mirror(p)]));
  const dimples = (B.dimples || []).flatMap((d) => { const { s } = seat(d.on); return [{ c: s, r: d.r * W, k: d.k * W }]; });
  const sd = (q) => {
    let d = lse([base(q), ...muscles.map((p) => sdOf(p, q))], kM);
    for (const h of dimples) d = smaxp(d, -(len(sub(q, h.c)) - h.r), h.k);
    return d;
  };
  // a field of some masses alone (by id): a part whose rings run inside another's (the neck's root in the torso) reads
  // only its own, or its rays catch the shoulder's
  const only = (ids) => { const sel = [...baseP, ...muscles].filter((p) => ids.includes(p.id)); return (q) => lse(sel.map((p) => sdOf(p, q)), kM); };
  return { build: B, frame: F, base, sd, only, masses: { base: baseP, muscles, dimples } };
}

/** the first crossing outward (inside → outside) of a field along a ray, within `reach` metres; null when none */
export function crossing(fn, o, dir, reach, step = 0.0015) {
  let t0 = 0, f0 = fn(o);
  if (f0 > 0) {   // the start outside: find the field first, then leave it
    for (let t = step; t <= reach; t += step) { if (fn(add(o, scl(dir, t))) <= 0) { t0 = t; f0 = -1; break; } }
    if (f0 > 0) return null;
  }
  for (let t = t0 + step; t <= reach; t += step) {
    if (fn(add(o, scl(dir, t))) > 0) {
      let a = t - step, b = t;
      for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (fn(add(o, scl(dir, m))) > 0) b = m; else a = m; }
      return add(o, scl(dir, (a + b) / 2));
    }
  }
  return null;
}

/** a point carried onto a field's zero set down its gradient (Newton on the distance; steps capped) */
export function project(fn, p, iters = 24) {
  let q = p;
  for (let i = 0; i < iters; i++) {
    const d = fn(q); if (Math.abs(d) < 1e-6) break;
    const e = 1e-4, g = [fn(add(q, [e, 0, 0])) - fn(sub(q, [e, 0, 0])), fn(add(q, [0, e, 0])) - fn(sub(q, [0, e, 0])), fn(add(q, [0, 0, e])) - fn(sub(q, [0, 0, e]))].map((x) => x / (2 * e));
    const gg = dot(g, g); if (gg < 1e-12) return null;
    const step = scl(g, -d / gg), l = len(step); q = add(q, l > 0.01 ? scl(step, 0.01 / l) : step);
  }
  return Math.abs(fn(q)) < 1e-4 ? q : null;
}

/** a ring of N slot names: the front, N/2 − 1 down the right, the back, and the left back to the front (midline parts
 * mirror right to left by name) */
export function ringSlots(N) {
  const h = N / 2, pad = (k) => String(k).padStart(2, '0');
  return ['front', ...Array.from({ length: h - 1 }, (_, k) => `s${pad(k + 1)}R`), 'back', ...Array.from({ length: h - 1 }, (_, k) => `s${pad(h - 1 - k)}L`)];
}

const mixW = (a, b, t) => {
  const w = {}; for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) { const v = r6((a[k] ?? 0) * (1 - t) + (b[k] ?? 0) * t); if (v > 0) w[k] = v; }
  const ks = Object.keys(w), big = ks.reduce((x, k) => (w[k] > w[x] ? k : x), ks[0]); w[big] = r6(1 - ks.filter((k) => k !== big).reduce((t2, k) => t2 + w[k], 0)); return w;
};
const stationId = (u) => (Number.isInteger(u) ? `st${u}` : `st${Math.floor(u)}_st${Math.ceil(u)}_${String(Math.round((u - Math.floor(u)) * 1000)).padStart(3, '0')}`);

/** a closed part re-sampled onto a field: `rings` stations over its authored u, `around` slots round each, each slot on
 * the ray from `origin(c)` (the ring's centre by default) through the authored cage's point there, at the field's first
 * crossing outward; `ease(u)` how far the field wins over the authored point (1 everywhere by default). The bind's
 * shares interpolated: per slot where the authored bind names slots, by station elsewhere; a HARD limb (`bind.zone`)
 * keeps its bone rigid, a joint's share easing in only within the zone of the joint's ring (the refine pass's rule) */
export function resamplePart(P, sd, { around, rings, origin = (c) => c, ease = () => 1, relax = 0, capsOnto = false } = {}) {
  // (stations without a `u` are at their index, as the compiler reads them)
  const st = P.stations.map((x, i) => ({ ...x, u: x.u ?? i })), SL = P.slots, n0 = SL.length, U = st[st.length - 1].u, b = P.bind, own = { [b.bone]: 1 };
  const centre = (s) => scl(SL.reduce((a, k) => add(a, s.points[k]), [0, 0, 0]), 1 / n0);
  const ptAt = (s, q) => { const f = q * n0, k = Math.floor(f) % n0, t = f - Math.floor(f); return add(scl(s.points[SL[k]], 1 - t), scl(s.points[SL[(k + 1) % n0]], t)); };
  const bracket = (u) => { let i = 0; while (i < st.length - 2 && st[i + 1].u < u) i++; const a = st[i], c = st[i + 1]; return [a, c, (u - a.u) / (c.u - a.u)]; };
  const cageAt = (u, q) => { const [a, c, t] = bracket(u); return add(scl(ptAt(a, q), 1 - t), scl(ptAt(c, q), t)); };
  const byId = Object.fromEntries(st.map((x) => [x.id, x]));
  const perSlot = Object.keys(b.blend || {}).some((k) => k.includes('.'));
  const shareAt = (sx, q) => (perSlot && b.blend[`${sx.id}.${SL[Math.round(q * n0) % n0]}`]) || b.blend?.[sx.id] || own;
  // a hard limb: the shares by the integer stations, eased within the zone of the joint's ring
  const atInt = (i) => b.blend?.[`st${i}`] ?? own, rigid = (w) => Object.keys(w).length === 1 && w[b.bone] === 1;
  const zoneShare = (u, c) => {
    const i0 = Math.floor(u), i1 = Math.ceil(u), lo = atInt(i0), hi = atInt(i1); if (i0 === i1) return lo;
    let t = u - i0; const loR = rigid(lo), hiR = rigid(hi);
    if (loR !== hiR) { const cj = centre(byId[`st${loR ? i1 : i0}`]), d = len(sub(c, cj)), x = Math.max(0, Math.min(1, 1 - d / b.zone)), sm = x * x * (3 - 2 * x); t = loR ? sm : 1 - sm; }
    return mixW(lo, hi, t);
  };
  const slots = ringSlots(around), blend = { ...(b.blend?.back ? { back: b.blend.back } : {}), ...(b.blend?.tip ? { tip: b.blend.tip } : {}) };
  const stations = [];
  for (let i = 0; i < rings; i++) {
    const u = r6((U * i) / (rings - 1)), [a, c2, t] = bracket(u), id = stationId(u);
    const c = add(scl(centre(a), 1 - t), scl(centre(c2), t)), o = origin(c), points = {}, e = ease(u);
    if (b.zone > 0) { const w = zoneShare(u, c); if (!rigid(w)) blend[id] = w; }
    slots.forEach((sl, j) => {
      const q = j / around, p0 = cageAt(u, q), hit = crossing(sd, o, unit(sub(p0, o)), 2.5 * len(sub(p0, o)) + 0.05);
      points[sl] = (hit ? add(scl(p0, 1 - e), scl(hit, e)) : p0).map(r6);
      if (!(b.zone > 0)) { const w = mixW(shareAt(a, q), shareAt(c2, q), t); if (!rigid(w)) blend[`${id}.${sl}`] = w; }
    });
    stations.push({ id, u, points });
  }
  if (relax) relaxOnto(stations, slots, sd, relax, (i) => ease(stations[i].u) >= 1);
  // the poles on the field too (`caps`): from the end ring's centre toward the authored pole (an authored pole stood
  // proud of the new skin, a tent on the shoulder's top)
  const caps = P.caps && capsOnto ? Object.fromEntries(Object.entries(P.caps).map(([k, q]) => {
    const ring = stations[k === 'back' ? 0 : stations.length - 1], c = scl(slots.reduce((a, sl) => add(a, ring.points[sl]), [0, 0, 0]), 1 / slots.length);
    const hit = crossing(sd, c, unit(sub(q, c)), 2 * len(sub(q, c)) + 0.05);
    return [k, (hit ?? q).map(r6)];
  })) : P.caps;
  const { slotT: _t, ...rest } = P;
  return { ...rest, slots, stations, ...(caps ? { caps } : {}), bind: { ...b, blend } };
}
/** the sampled grid RELAXED onto the field: each inner point drawn toward its four neighbours' mean, then carried back
 * onto the skin down the field's gradient, `iters` times. Where a ring's rays crossed a pocket (the armpit's front, the
 * nape) they landed by turns on its two walls, in fins, or folded back on the ring below; the mean evens them and the
 * projection keeps the anatomy (a groove is the field's, so the points return into it). Only the rings the field owns
 * (`owned`): one eased toward the authored cage would be pulled off it */
function relaxOnto(stations, slots, sd, iters, owned = () => true, w = 0.5) {
  const n = slots.length;
  for (let it = 0; it < iters; it++) {
    const next = stations.map((s) => ({ ...s.points }));
    for (let i = 1; i < stations.length - 1; i++) if (owned(i)) slots.forEach((sl, j) => {
      const P0 = stations[i].points, nb = [P0[slots[(j + 1) % n]], P0[slots[(j + n - 1) % n]], stations[i - 1].points[sl], stations[i + 1].points[sl]];
      const m = scl(nb.reduce((a, q) => add(a, q), [0, 0, 0]), 0.25), p = add(scl(P0[sl], 1 - w), scl(m, w));
      next[i][sl] = (project(sd, p, 12) ?? p).map(r6);
    });
    stations.forEach((s, i) => { s.points = next[i]; });
  }
}

/** a right limb's part mirrored to the left: x negated, R ↔ L on the slots and the bones (the symmetry's contract) */
const swapRL = (k) => k.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
function mirrorPart(P, L) {
  const flip = (p) => [-p[0], p[1], p[2]], swapW = (w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [swapRL(k), v]));
  const blend = Object.fromEntries(Object.entries(P.bind.blend).map(([k, w]) => { const [s, sl] = k.split('.'); return [sl ? `${s}.${swapRL(sl)}` : s, swapW(w)]; }));
  return { ...L, slots: P.slots, stations: P.stations.map((s) => ({ ...s, points: Object.fromEntries(P.slots.map((sl) => [sl, flip(s.points[swapRL(sl)])])) })), bind: { ...L.bind, blend } };
}

/** a limb's field for a build: its masses in the bone's frame (s along it from its head joint, az round it from the
 * front toward the outside, off from its axis; r along, round, out; all in W), summed with the build's `kLimb` */
export function limbField(R, build, limb, extra = []) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build, Lb = B.limbs[limb], F = bodyFrame(R), W = F.W, J = R.joints;
  const h = J[Lb.from], tl = J[Lb.to], ax = unit(sub(tl, h)), L = len(sub(tl, h));
  const fr = unit(sub([0, 1, 0], scl(ax, ax[1]))), out = unit(cross(ax, fr));
  const dirAt = (az) => add(scl(fr, dmath.cos((az * Math.PI) / 180)), scl(out, dmath.sin((az * Math.PI) / 180)));
  const at = (s, az = 0, off = 0) => add(add(h, scl(ax, s * L)), scl(dirAt(az), off * W));
  const prims = Lb.masses.map((m) => {
    if (m.cone) return { id: m.id, cone: [at(m.cone[0], m.az, m.off?.[0] ?? 0), at(m.cone[1], m.az, m.off?.[1] ?? 0)], r: m.r.map((x) => x * W) };
    const rad = dirAt(m.az ?? 0), tan = unit(cross(ax, rad));
    return { id: m.id, egg: true, c: at(m.s, m.az, m.off ?? 0), ax: [ax, tan, rad], r: m.r.map((x) => x * W) };
  });
  const all = [...prims, ...extra], k = B.kLimb * W;
  const sdOf = (p, q) => (p.cone ? sdCone(q, p.cone[0], p.cone[1], p.r[0], p.r[1]) : sdEgg(q, p));
  return { sd: (q) => lse(all.map((p) => sdOf(p, q)), k), prims };
}

/** the slice: the torso and the arms re-sampled onto the build's field (the torso `around` × `rings`, each limb
 * `limbAround` × its build's rings), the pectoral and bust parts gone (the field carries their form), the dials' station
 * blends extended by u. Returns { recipe, field, removed } */
export function formSlice(recipe, R, build, { around = 48, rings = 37, limbAround = 24 } = {}) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  if (!B) throw new Error(`body-relational: unknown build '${build}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
  // the limbs' fields first: the arm's deltoid heads are the shoulder's cap on the torso too, so the two shells agree
  const limbs = Object.fromEntries(Object.keys(B.limbs || {}).map((k) => [k, limbField(R, B, k)]));
  // THE DELTOID SHARED between the two shells and handed over along one cone round the trunk's axis (`clip`, rising
  // outward from above the armpit): above it the torso's skin shows (the shoulder's cap), below it the arm's. On the
  // torso the heads are cut under the cone (torso rays had slipped between the chest and the arm); the arm keeps them
  // all, set `tuck` inside above the cone (eased in over `band`), so its top ring and its cap sit under the torso's. Both
  // from the same masses, so the skins meet along the cone: the arm standing out of a smaller cap left a ledge on the
  // shoulder, the two on one surface z-fought in a sawtooth, and an arm cut away where the torso's field lay left it
  // hanging from a stalk
  const W0 = bodyFrame(R).W, clip = { rho: 0.9 * W0, z: R.joints.shoulderR[2] - 0.6 * W0, slope: 1, k: 0.08 * W0 }, tuck = 0.003, band = 0.01;
  const shared = (limbs.upperArm?.prims || []).filter((p) => /^deltoid/.test(p.id)).map((p) => ({ ...p, clip }));
  const field = bodyField(R, B, { extra: shared }), r = structuredClone(recipe), P = r.parts.torso;
  const under = (q) => (clip.slope * (Math.hypot(q[0], q[1]) - clip.rho) - (q[2] - clip.z)) / Math.hypot(1, clip.slope);
  if (limbs.upperArm) { const arm = limbs.upperArm.sd; limbs.upperArm.sd = (q) => { const x = Math.max(0, Math.min(1, -under(q) / band)); return arm(q) + tuck * x * x * (3 - 2 * x); }; }
  // the torso: above the chest the rays fan from one point on the trunk's axis (a ring's own radial line grazes the
  // shoulder's slope and the neck's root, where the authored rings tilt; rays from one origin never cross), and under
  // the navel it lands on the authored pelvis's top, the field easing in from the waist's first station
  const bottom = P.stations.find((s) => s.id === 'st1')?.u ?? 1, zFan = R.joints.shoulderR[2] - 0.35 * field.frame.W;
  // and round an undercut (`lift`: the fold under the bust) they come down from a point raised above the ring, so they
  // meet the underside face on (level rays left one ring on the bust's underside and the next on the chest's wall, and
  // the band between them shaded in a sawtooth)
  const Fr = field.frame, L = B.lift, raise = (z) => { if (!L) return 0; const x = Math.min(1, Math.abs((z - Fr.z0) / Fr.T - L.t) / L.w); return L.h * Fr.W * (1 - x * x * (3 - 2 * x)); };
  r.parts.torso = resamplePart(P, field.sd, { around, rings, origin: (c) => (c[2] > zFan ? [c[0], c[1], zFan] : [c[0], c[1], c[2] + raise(c[2])]), ease: (u) => { const e = Math.min(1, u / (bottom || 1)); return e * e * (3 - 2 * e); }, relax: 4 });
  // the neck on its own masses of the same field (its column, the sternocleidomastoids, the trapezius's climb), so the
  // torso's top and the neck's root agree
  if (r.parts.neck) r.parts.neck = resamplePart(r.parts.neck, field.only(['neck', 'sternocleidomastoid', 'trapeziusUpper']), { around: 32, rings: 15, relax: 2 });
  // the midline exactly on it, the left the right's mirror (a midline part's contract)
  for (const T of [r.parts.torso, r.parts.neck].filter(Boolean)) for (const s of T.stations) { s.points.front[0] = 0; s.points.back[0] = 0; for (const sl of T.slots) if (sl.endsWith('L')) { const p = s.points[`${sl.slice(0, -1)}R`]; s.points[sl] = [-p[0], p[1], p[2]]; } }
  // the limbs: the right one sampled on its field, the left its mirror
  const done = ['torso', 'neck'];
  for (const [limb, Lb] of Object.entries(B.limbs || {})) {
    const pr = `${limb}R`, pl = `${limb}L`; if (!r.parts[pr]) continue;
    r.parts[pr] = resamplePart(r.parts[pr], limbs[limb].sd, { around: limbAround, rings: Lb.rings, capsOnto: true });
    if (r.parts[pl]) r.parts[pl] = mirrorPart(r.parts[pr], r.parts[pl]);
    done.push(pr, pl);
  }
  const gone = Object.keys(r.parts).filter((k) => /^(pectoral|bust)[RL]$/.test(k));
  for (const k of gone) delete r.parts[k];
  for (const d of Object.values(r.dials || {})) {
    if (Array.isArray(d.parts)) d.parts = d.parts.filter((p) => !gone.includes(p));
    if (d.blend && d.parts?.some((p) => done.includes(p))) for (const pn of done) for (const s of r.parts[pn]?.stations || []) if (d.blend[s.id] === undefined) { const lo = d.blend[`st${Math.floor(s.u)}`] ?? 0, hi = d.blend[`st${Math.ceil(s.u)}`] ?? 0, t = s.u - Math.floor(s.u); d.blend[s.id] = r6(lo * (1 - t) + hi * t); }
  }
  return { recipe: r, field, removed: gone };
}
