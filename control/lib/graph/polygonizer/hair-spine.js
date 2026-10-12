/** hair-spine.js — the SPINE of a lock: the grass blade's elastica (vegetation/mechanics.js), grown from a scalp root.
 *
 * A lock is a cantilever under its own weight, clamped at the root along its comb (the aim) and free at the tip:
 *   θ'' = B (1 − s) cos θ,  θ(0) = θ0,  θ'(1) = 0,   s ∈ [0, 1] the arc, θ the angle above the plane normal to the load.
 * Positions are integrated ALONG THE ARC, so the lock is exactly its length at every B, in every wind. One number carries
 * the look: B = w L³ / (E I) of the CLUMP (one keratin strand at 30 cm is B ≈ 280 and hangs limp; hair holds a shape
 * as clumps: a 1 mm clump at that length is B ≈ 1.4). Low B stands (the drawn anime lock), high B hangs (a western
 * fall). B grows with L³, so on one head the long locks droop and the short ones stand without another knob.
 *
 * The solve is planar: in the plane spanned by the load and the aim, with the aim's elevation above the load's normal
 * plane in [−90°, 90°] by construction (the in-plane horizontal is the aim's own component across the load), which is
 * the case the shooting bracket covers — every vegetation caller keeps the same idiom (an azimuth plane, an elevation).
 *
 * WIND is the same solve: a drag of R weights across the weight is still one uniform load, of size √(1+R²) along
 * atan R from straight down (vegetation/wind.js), so the lock is solved at B·√(1+R²) in the load's own frame.
 *
 * Past the self-buckling load (B ≈ 7.84 for an upright root) the shooting problem has several roots: the upright
 * (unstable), the drooped and the looped. A bare bisection keeps whichever its bracket happens to hold; this law scans
 * the root curvature θ'(0) for every sign change of θ'(1), refines each, and keeps the root of LEAST potential energy
 * (½∫θ'² ds bending + B∫y ds weight): the shape a real lock settles into.
 *
 * Pure deterministic arithmetic (dmath): no dice, no clock. */
import * as dmath from '../../util/dmath.js';

/** the stiffness words, as B at the reference length (`B_REF_L`): the clump's carriage, from standing to plastered */
export const SPINE_STIFFNESS = Object.freeze({ stiff: 2, springy: 8, soft: 30, limp: 120 });
export const B_REF_L = 0.22;   // m: the long fall's drop at length 1 (humanoid-hair.js `long`)
const STEPS = 16, SCAN = 48, REFINE = 40;
/** the root's bending layer is ~1/√B of the arc: at high B the steps grow so RK4 resolves it (16 to 96) */
export const stepsFor = (B) => Math.min(96, Math.max(STEPS, Math.ceil(4 * Math.sqrt(Math.max(0, B)))));

/** one RK4 run from (θ0, θ'(0) = k0): the end curvature θ'(1), the points at s = i/n (units of L), the energy */
function run(B, th0, k0, n, keep) {
  let th = th0, k = k0, x = 0, y = 0, e = 0; const h = 1 / n; const pts = keep ? [[0, 0]] : null;
  const f = (s, t) => B * (1 - s) * dmath.cos(t);
  for (let i = 0; i < n; i++) {
    const s = i * h;
    const a1 = k, b1 = f(s, th);
    const a2 = k + b1 * h / 2, b2 = f(s + h / 2, th + a1 * h / 2);
    const a3 = k + b2 * h / 2, b3 = f(s + h / 2, th + a2 * h / 2);
    const a4 = k + b3 * h, b4 = f(s + h, th + a3 * h);
    const thN = th + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4), kN = k + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    const yN = y + h * dmath.sin((th + thN) / 2);
    e += h * (0.25 * (k * k + kN * kN) + 0.5 * B * (y + yN));   // trapezoid: ½θ'² + B·y
    x += h * dmath.cos((th + thN) / 2); y = yN; th = thN; k = kN;
    if (keep) pts.push([x, y]);
  }
  return { k, pts, e };
}

/** The planar elastica on the stable branch: points at s = i/n, in units of L, x across the load, y against it. */
export function stableElastica(B, theta0, n = stepsFor(B)) {
  if (!(B > 1e-9)) { const c = dmath.cos(theta0), s = dmath.sin(theta0); return Array.from({ length: n + 1 }, (_, i) => [c * i / n, s * i / n]); }
  // the root moment is the weight's moment about the root: |θ'(0)| ≤ B/2 on any shape
  const lo = -B / 2 - 1e-9, hi = B / 2 + 1e-9;
  // the end curvature turns faster in θ'(0) as B grows: the scan densifies with √B so no close pair of roots hides
  const scan = Math.max(SCAN, Math.ceil(16 * Math.sqrt(B)));
  let best = null, pk = lo, pf = run(B, theta0, lo, n, false).k;
  for (let j = 1; j <= scan; j++) {
    const k0 = lo + (hi - lo) * j / scan, fk = run(B, theta0, k0, n, false).k;
    if (pf * fk <= 0) {
      let a = pk, b = k0, fa = pf;
      for (let i = 0; i < REFINE; i++) { const m = (a + b) / 2, fm = run(B, theta0, m, n, false).k; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
      const r = (a + b) / 2, e = run(B, theta0, r, n, false).e;
      if (!best || e < best.e - 1e-12) best = { r, e };
    }
    pk = k0; pf = fk;
  }
  return run(B, theta0, best ? best.r : 0, n, true).pts;
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm = (a) => { const l = Math.sqrt(dot(a, a)); return l > 1e-12 ? scale(a, 1 / l) : null; };

/** the load of gravity and a still wind: `wind` { R (weights of drag), dir (degrees in the head's plan: 0 blows from the
 * face toward the back, 90 toward +x) } → the unit load direction and its size */
export function spineLoad(wind) {
  const R = wind && Number.isFinite(wind.R) ? Math.max(0, wind.R) : 0;
  if (!R) return { down: [0, 0, -1], m: 1 };
  const a = (Number.isFinite(wind.dir) ? wind.dir : 0) * Math.PI / 180;
  return { down: norm([R * dmath.sin(a), -R * dmath.cos(a), -1]), m: Math.sqrt(1 + R * R) };
}

/** The spine of one lock in world space: `root` (a point), `aim` (the comb at the root, any length), `L` (m), `B` (the
 * clump's bending number at its own length), `hold` (the share of the arc the scalp holds straight along the aim: volume
 * at the roots), `wind`. Returns `n + 1` points at equal arc s = i/n. */
export function lockSpine({ root, aim, L, B, hold = 0, wind = null, n = STEPS }) {
  const { down, m } = spineLoad(wind);
  const a = norm(aim) ?? scale(down, -1), up = scale(down, -1);
  const along = a.map((v, i) => v - dot(a, up) * up[i]);
  // the in-plane horizontal: the aim across the load; an aim straight along the load leans toward the face
  const hor = norm(along) ?? norm([0, 1, 0].map((v, i) => v - up[1] * up[i])) ?? [1, 0, 0];
  const th0 = dmath.atan2(dot(a, up), dot(a, hor));
  const held = Math.max(0, Math.min(0.9, hold)), Lf = L * (1 - held);
  // solved at the law's own resolution, then re-sampled at the caller's n (a six-ring tail still hangs true)
  const Bf = B * m * (1 - held) ** 3, ns = stepsFor(Bf), plane = stableElastica(Bf, th0, ns);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    if (s <= held) { out.push(plus(root, scale(a, L * s))); continue; }
    // the free length past the held root, at its own arc
    const u = (s - held) / (1 - held) * ns, j = Math.min(ns - 1, Math.floor(u)), t = u - j;
    const x = plane[j][0] + (plane[j + 1][0] - plane[j][0]) * t, y = plane[j][1] + (plane[j + 1][1] - plane[j][1]) * t;
    out.push(plus(plus(root, scale(a, L * held)), plus(scale(hor, Lf * x), scale(up, Lf * y))));
  }
  return out;
}

/** a point at arc fraction s on equal-arc spine samples */
export function spineAt(spine, s) {
  const n = spine.length - 1, u = Math.max(0, Math.min(1, s)) * n, j = Math.min(n - 1, Math.floor(u)), t = u - j;
  return spine[j].map((v, k) => v + (spine[j + 1][k] - v) * t);
}

/** the bending number of a lock of length L from a stiffness word or number (B at the reference length), scaled by L³ */
export const lockB = (stiffness, L) => {
  const B0 = typeof stiffness === 'number' ? stiffness : SPINE_STIFFNESS[stiffness] ?? SPINE_STIFFNESS.soft;
  return B0 * (L / B_REF_L) ** 3;
};

/** `'elastica'` | { law?, stiffness?, hold?, wind? } → the stored spine; errors (empty = valid) */
export function validateSpine(spec, label = 'hair.spine') {
  if (spec === 'elastica') return [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: 'elastica' or { law: 'elastica', stiffness: ${Object.keys(SPINE_STIFFNESS).join(' | ')} | B > 0, hold: 0 … 0.6, wind: { R ≥ 0, dir: degrees } }`];
  const errs = [];
  for (const k of Object.keys(spec)) if (!['law', 'stiffness', 'hold', 'wind'].includes(k)) errs.push(`${label}.${k}: unknown (have law, stiffness, hold, wind)`);
  if (spec.law !== undefined && spec.law !== 'elastica') errs.push(`${label}.law: '${spec.law}' (have 'elastica')`);
  const st = spec.stiffness;
  if (st !== undefined && !(typeof st === 'number' ? st > 0 && Number.isFinite(st) : Object.hasOwn(SPINE_STIFFNESS, st))) errs.push(`${label}.stiffness: a word (${Object.keys(SPINE_STIFFNESS).join(', ')}) or a number > 0`);
  if (spec.hold !== undefined && !(Number.isFinite(spec.hold) && spec.hold >= 0 && spec.hold <= 0.6)) errs.push(`${label}.hold: 0 … 0.6 (the share of the lock the scalp holds)`);
  const w = spec.wind;
  if (w !== undefined && (!w || typeof w !== 'object' || !(Number.isFinite(w.R) && w.R >= 0) || (w.dir !== undefined && !Number.isFinite(w.dir)))) errs.push(`${label}.wind: { R: weights of drag ≥ 0, dir?: degrees }`);
  return errs;
}
/** the stored form: the word becomes the object, defaults left absent (read at build time) */
export const resolveSpine = (spec) => (spec === 'elastica' ? { law: 'elastica' } : { law: 'elastica', ...spec });

/** Drape a spine over colliders: `{ surface: { pts, nrm, gap, reach } }` a sampled skin (each point kept `gap` outside
 * its nearest sample's tangent plane, within `reach`), `{ c, r }` an ellipsoid and `{ axis: [x, y], r, top, bottom }`
 * an upright column (the neck). Follow the leader from the root: each point is pushed out of every collider (along its own radial,
 * to the surface + margin) and then set back on its segment length from the point before, so the lock wraps the body and
 * stays its length. A lock that never enters is returned as it was. */
export function drapeSpine(spine, colliders, margin = 0.04) {
  const list = Array.isArray(colliders) ? colliders : [colliders];
  const seg = spine.slice(1).map((p, i) => Math.hypot(p[0] - spine[i][0], p[1] - spine[i][1], p[2] - spine[i][2]));
  const push = (p) => keepOut(p, list, margin);
  if (!spine.slice(1).some((p) => push(p).hit)) return spine;
  const out = [spine[0]];
  for (let i = 1; i < spine.length; i++) {
    const prev = out[i - 1];
    // the lock's own direction from the previous point, carried from the undraped spine
    let p = plus(prev, [spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1], spine[i][2] - spine[i - 1][2]]);
    for (let it = 0; it < 3; it++) {
      p = push(p).p;
      const d = norm([p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]]) ?? [0, 0, -1];
      p = plus(prev, scale(d, seg[i - 1]));
    }
    out.push(p);
  }
  return out;
}

/** the samples bucketed in cells of the reach (built once per surface), so a nearest search reads 27 cells, not all */
const GRIDS = new WeakMap();
const cellKey = (x, y, z) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
function surfaceGrid(S) {
  let g = GRIDS.get(S); if (g) return g;
  g = new Map();
  S.pts.forEach((q, i) => { const k = cellKey(Math.floor(q[0] / S.reach), Math.floor(q[1] / S.reach), Math.floor(q[2] / S.reach)); const c = g.get(k); if (c) c.push(i); else g.set(k, [i]); });
  GRIDS.set(S, g); return g;
}

/** One point pushed out of every collider: `{ p, hit }`. */
export function keepOut(p, colliders, margin = 0.04) {
  const list = Array.isArray(colliders) ? colliders : [colliders];
  let hit = false;
  for (const C of list) {
    if (C.surface) {
      // the head's own skin, sampled by address: the nearest sample's tangent plane; a point less than the margin
      // outside it (or under it) is lifted along that sample's normal to the margin
      const { pts, nrm, gap, reach } = C.surface, grid = surfaceGrid(C.surface); let bi = -1, bd = Infinity;
      const cx = Math.floor(p[0] / reach), cy = Math.floor(p[1] / reach), cz = Math.floor(p[2] / reach);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
        const cell = grid.get(cellKey(cx + a, cy + b, cz + e)); if (!cell) continue;
        for (const i of cell) { const q = pts[i], d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd || (d === bd && i < bi)) { bd = d; bi = i; } }
      }
      if (bi < 0 || bd > reach * reach) continue;
      const q = pts[bi], n = nrm[bi], h = (p[0] - q[0]) * n[0] + (p[1] - q[1]) * n[1] + (p[2] - q[2]) * n[2];
      if (h >= gap) continue;
      // `frame`: hair frames the face. Where the skin faces forward (a cheek, a temple) the lift goes sideways and back,
      // never out in front of the face; a skin facing straight forward (the nose's line) keeps its normal
      let d = n;
      if (C.surface.frame && n[1] > 0) { const side = norm([n[0], 0, n[2]]); if (side && dot(side, n) > 0.3) d = side; }
      hit = true; p = plus(p, scale(d, (gap - h) / dot(d, n)));
    } else if (C.axis) {
      if (p[2] > C.top || p[2] < C.bottom) continue;
      const dx = p[0] - C.axis[0], dy = p[1] - C.axis[1], d = Math.hypot(dx, dy), R = C.r * (1 + margin);
      if (d >= R) continue;
      hit = true; const k = d > 1e-9 ? R / d : 0; p = d > 1e-9 ? [C.axis[0] + dx * k, C.axis[1] + dy * k, p[2]] : [C.axis[0], C.axis[1] - R, p[2]];
    } else {
      const q = ((p[0] - C.c[0]) / C.r[0]) ** 2 + ((p[1] - C.c[1]) / C.r[1]) ** 2 + ((p[2] - C.c[2]) / C.r[2]) ** 2;
      if (q >= (1 + margin) ** 2) continue;
      hit = true; const k = (1 + margin) / Math.sqrt(Math.max(q, 1e-12)); p = [0, 1, 2].map((j) => C.c[j] + (p[j] - C.c[j]) * k);
    }
  }
  return { p, hit };
}
