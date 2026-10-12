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

// ── the spine's words ──────────────────────────────────────────────────────────────────────────────────────────
// One vocabulary on both heads. The whole head: `stiffness`, `hold`, `wind`, `curl`. A REGION overrides it (`regions`:
// front, sides, back, crown, tail; on the landmark head a region may also scale its `length`), and on the anime head a
// named clump overrides its region (`locks`: 'fringe-3', 'back-2', … { stiffness, curl }); the most specific wins.
export const SPINE_REGIONS = Object.freeze(['front', 'sides', 'back', 'crown', 'tail']);
const SPINE_KEYS = ['law', 'stiffness', 'hold', 'wind', 'curl', 'regions', 'locks'];
const REGION_KEYS = ['stiffness', 'hold', 'length', 'curl'], LOCK_KEYS = ['stiffness', 'curl'];
/** CURL: a coil about the lock's own centre line. `radius` (m, at the coil's full size), `turns` (along the lock),
 * `hand` (1 right, −1 left), `from` (where along the lock it begins, 0 … 1; it grows in over the next tenth). The
 * lock's LENGTH is where it falls (the axis keeps it, as a length is said of hair); the coil's own run is longer. */
const CURL_KEYS = ['radius', 'turns', 'hand', 'from'];
const isWord = (st) => (typeof st === 'number' ? st > 0 && Number.isFinite(st) : Object.hasOwn(SPINE_STIFFNESS, st));
function curlErrors(c, at) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [`${at}: { radius: 0 … 0.06 m, turns: 0 … 16, hand?: 1 | -1, from?: 0 … 0.9 }`];
  const errs = [];
  for (const k of Object.keys(c)) if (!CURL_KEYS.includes(k)) errs.push(`${at}.${k}: unknown (have ${CURL_KEYS.join(', ')})`);
  if (!(Number.isFinite(c.radius) && c.radius >= 0 && c.radius <= 0.06)) errs.push(`${at}.radius: 0 … 0.06 (metres, the coil's radius)`);
  if (!(Number.isFinite(c.turns) && c.turns >= 0 && c.turns <= 16)) errs.push(`${at}.turns: 0 … 16 (coils along the lock)`);
  if (c.hand !== undefined && c.hand !== 1 && c.hand !== -1) errs.push(`${at}.hand: 1 (right) or -1 (left)`);
  if (c.from !== undefined && !(Number.isFinite(c.from) && c.from >= 0 && c.from <= 0.9)) errs.push(`${at}.from: 0 … 0.9 (where along the lock the coil begins)`);
  return errs;
}
function fieldErrors(o, keys, at) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return [`${at}: { ${keys.join(', ')} }`];
  const errs = [];
  for (const k of Object.keys(o)) if (!keys.includes(k)) errs.push(`${at}.${k}: unknown (have ${keys.join(', ')})`);
  if (o.stiffness !== undefined && !isWord(o.stiffness)) errs.push(`${at}.stiffness: a word (${Object.keys(SPINE_STIFFNESS).join(', ')}) or a number > 0`);
  if (o.hold !== undefined && !(Number.isFinite(o.hold) && o.hold >= 0 && o.hold <= 0.6)) errs.push(`${at}.hold: 0 … 0.6 (the share of the lock the scalp holds)`);
  if (o.length !== undefined && !(Number.isFinite(o.length) && o.length >= 0.3 && o.length <= 2.5)) errs.push(`${at}.length: a ratio 0.3 … 2.5 of the style's length there`);
  if (o.curl !== undefined && o.curl !== false) errs.push(...curlErrors(o.curl, `${at}.curl`));
  return errs;
}
/** `'elastica'` | { law?, stiffness?, hold?, wind?, curl?, regions?, locks? } → errors (empty = valid) */
export function validateSpine(spec, label = 'hair.spine') {
  if (spec === 'elastica') return [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: 'elastica' or { law: 'elastica', stiffness: ${Object.keys(SPINE_STIFFNESS).join(' | ')} | B > 0, hold: 0 … 0.6, wind: { R ≥ 0, dir: degrees }, curl: { radius, turns, hand?, from? }, regions: { ${SPINE_REGIONS.join(', ')} }, locks: { clump: { stiffness, curl } } }`];
  const errs = [];
  for (const k of Object.keys(spec)) if (!SPINE_KEYS.includes(k)) errs.push(`${label}.${k}: unknown (have ${SPINE_KEYS.join(', ')})`);
  if (spec.law !== undefined && spec.law !== 'elastica') errs.push(`${label}.law: '${spec.law}' (have 'elastica')`);
  if (spec.stiffness !== undefined && !isWord(spec.stiffness)) errs.push(`${label}.stiffness: a word (${Object.keys(SPINE_STIFFNESS).join(', ')}) or a number > 0`);
  if (spec.hold !== undefined && !(Number.isFinite(spec.hold) && spec.hold >= 0 && spec.hold <= 0.6)) errs.push(`${label}.hold: 0 … 0.6 (the share of the lock the scalp holds)`);
  const w = spec.wind;
  if (w !== undefined && (!w || typeof w !== 'object' || !(Number.isFinite(w.R) && w.R >= 0) || (w.dir !== undefined && !Number.isFinite(w.dir)))) errs.push(`${label}.wind: { R: weights of drag ≥ 0, dir?: degrees }`);
  if (spec.curl !== undefined && spec.curl !== false) errs.push(...curlErrors(spec.curl, `${label}.curl`));
  if (spec.regions !== undefined) {
    if (!spec.regions || typeof spec.regions !== 'object' || Array.isArray(spec.regions)) errs.push(`${label}.regions: { ${SPINE_REGIONS.join(', ')} } each { ${REGION_KEYS.join(', ')} }`);
    else for (const [r, o] of Object.entries(spec.regions)) { if (!SPINE_REGIONS.includes(r)) errs.push(`${label}.regions.${r}: not a region (have ${SPINE_REGIONS.join(', ')})`); else errs.push(...fieldErrors(o, REGION_KEYS, `${label}.regions.${r}`)); }
  }
  if (spec.locks !== undefined) {
    if (!spec.locks || typeof spec.locks !== 'object' || Array.isArray(spec.locks)) errs.push(`${label}.locks: { clump name: { ${LOCK_KEYS.join(', ')} } } (the anime head's clumps)`);
    else for (const [n, o] of Object.entries(spec.locks)) errs.push(...fieldErrors(o, LOCK_KEYS, `${label}.locks.${n}`));
  }
  return errs;
}
/** a lock's spine words: the head's, under its region's, under its own (the most specific wins; `curl: false` stops one) */
export function spineFor(spine, region, lock) {
  const R = (region && spine?.regions?.[region]) || {}, K = (lock && spine?.locks?.[lock]) || {};
  const pick = (k) => (K[k] !== undefined ? K[k] : R[k] !== undefined ? R[k] : spine?.[k]);
  const curl = pick('curl');
  return { stiffness: pick('stiffness'), hold: pick('hold'), length: R.length ?? 1, curl: curl && curl.radius > 0 && curl.turns > 0 ? curl : null, wind: spine?.wind };
}

/** CURL about a centre line: the offset of each equal-arc sample from its axis (parallel-transported frame, the coil's
 * radius growing in over a tenth from `from`), and `k`, the axis's share of the coil's run (1 / k is how much longer
 * the curled hair is than where it falls). */
export function coilOffsets(line, curl, L, out0 = null, planar = false, phase = 0) {
  const n = line.length - 1, from = curl.from ?? 0, hand = curl.hand ?? 1, r = curl.radius, T = curl.turns;
  const k = 1 / Math.sqrt(1 + ((2 * Math.PI * r * T) / Math.max(L * (1 - from), 1e-9)) ** 2);
  const tan = (i) => norm([0, 1, 2].map((j) => line[Math.min(n, i + 1)][j] - line[Math.max(0, i - 1)][j])) ?? [0, 0, -1];
  // the coil's first reach: `out0` (a guide's outward direction, so neighbouring guides coil in step around the head), else any normal
  let t0 = tan(0), a = (out0 && norm(plus(out0, scale(t0, -dot(out0, t0))))) ?? norm(cross3(t0, Math.abs(t0[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])) ?? [1, 0, 0];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = tan(i); a = norm(plus(a, scale(t, -dot(a, t)))) ?? a;   // parallel transport: the frame turns only as the line does
    const b = cross3(t, a), u = i / n, g = u <= from ? 0 : Math.min(1, (u - from) / 0.1), phi = hand * 2 * Math.PI * T * Math.max(0, u - from) / Math.max(1 - from, 1e-9) + (u > from ? phase : 0);
    const R = r * g * g * (3 - 2 * g);
    // starts on the axis (no jump where the coil begins), coiling out toward `a`; `planar`: the coil's reach toward `a`
    // only (an S-wave), for a curtain whose neighbouring guides would shear past each other if they coiled sideways
    out.push(planar ? scale(a, R * (Math.sin(phi) - Math.sin(phase))) : plus(scale(a, R - R * Math.cos(phi)), scale(b, R * Math.sin(phi))));
  }
  return { offsets: out, k };
}
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** a spine coiled: each sample set off its axis by the coil (the axis, and so where the lock falls, unchanged) */
export function coilSpine(spine, curl, L, out0 = null, planar = false, phase = 0) {
  if (!curl) return spine;
  const { offsets } = coilOffsets(spine, curl, L, out0, planar, phase);
  return spine.map((p, i) => plus(p, offsets[i]));
}
/** the samples a coil needs to be drawn: eight a turn, and never fewer than `base` */
export const coilSteps = (curl, base) => (curl ? Math.max(base, Math.ceil(8 * curl.turns) + 4) : base);

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
