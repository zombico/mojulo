/**
 * stairs — a WALK from one level to the next: the body never leaves its feet. Called by its ends like a bridge: `from`,
 * the foot of the first riser on the level below, and `to`, the top nosing on the level above; or `from`, a `rise` and
 * the way up (`facing`), and the stair lays its own run by its laws.
 *
 *   flight  a built stair: treads on closed risers between stringers, balusters under a handrail, newels at its ends,
 *           a landing when a flight runs long
 *   steps   outdoor steps cut into a bank: a riser edge held at each step (a board staked in, or a laid stone, by the
 *           kit's EDGE word), the treads gravel, edging along the sides, a post at each end
 *   ramp    a slope under the walk's grade: a deck between kerbs, cleats across it for the feet, a rail past a fall,
 *           trestles under a long one
 *
 * The going comes from the stride: 2R + T, the riser as near its law's top as the rise allows, the tread what the stride
 * leaves; the outdoor steps' laws are the man-made index's own (era/out-made.js `steps`), measured with its function, so
 * a scapeshift trail's stairs site and this entry are held to the same numbers. ELEMENTS can be turned off.
 *
 * It answers as a link does: the WALK (rise, run, pitch, seconds at the walker's pace), its LAWS, and the pieces the
 * world runs: a floor face and a solid block under each tread (a stair the platform rule steps up, riser by riser) or
 * under each stretch of a ramp, and the rails as lines. Judged side-on: its elevation, as the man-made index draws it.
 */
import { obox, blockSink } from '../../era/props.js';
import { r5, P } from '../../era/geom.js';
import { madeLaws } from '../../era/out-made.js';

const Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const within = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;

// the walker's pace on a stair (m/s along the run): slower than the walk, a ramp nearly the walk
export const STAIR_PACE = Object.freeze({ flight: 2.4, steps: 2.2, ramp: 4.5 });

export const STAIRS_VARIANTS = {
  flight: { about: 'treads on closed risers between stringers, balusters under a handrail past a 0.6 m rise, newels at the ends, a landing when long', elements: ['treads', 'risers', 'stringers', 'balusters', 'handrail', 'newels', 'landing', 'nosings'],
    going: { riser: [0.15, 0.19], blondel: 0.63, flight: 16, landing: 1.0 } },
  steps: { about: 'outdoor steps cut into a bank: a staked board or a laid stone at each riser, gravel treads, edging, a post at each end', elements: ['bank', 'treads', 'risers', 'stakes', 'pins', 'edging', 'posts', 'landing'],
    going: { riser: [0.1, 0.16], blondel: 0.65, flight: 10, landing: 1.2 } },
  ramp: { about: 'a slope under the walk\'s grade: a deck between kerbs, cleats for the feet, a rail past a fall, trestles under a long one', elements: ['deck', 'kerbs', 'cleats', 'posts', 'handrail', 'trestles'],
    going: { grade: 0.25 } },
};
export const STAIRS_VARIANT_IDS = Object.freeze(Object.keys(STAIRS_VARIANTS));
export const STAIRS_ELEMENTS = Object.freeze([...new Set(Object.values(STAIRS_VARIANTS).flatMap((v) => v.elements))]);
export const STAIRS_EDGES = Object.freeze(['timber', 'stone']);   // the kit's EDGE word (era/out-made.js MADE_RAILS)

/** The built stair's laws (a flight indoors, a ramp); outdoor steps are measured by the man-made index's `steps`. */
export const STAIRS_LAWS = Object.freeze([
  { forms: ['flight'], law: 'blondel', want: '2 × riser + tread 0.60–0.66 m', why: 'one stride: a stair out of step with the pace trips people', test: (m) => within(m.blondel, [0.6, 0.66]), show: (m) => m.blondel },
  { forms: ['flight'], law: 'riser', want: 'riser 0.15–0.19 m', why: 'higher is a climb, lower a shuffle', test: (m) => within(m.R, [0.15, 0.19]), show: (m) => m.R },
  { forms: ['flight'], law: 'tread', want: 'tread ≥ 0.25 m', why: 'the ball of the foot and the heel both land', test: (m) => m.T >= 0.25 - 1e-9, show: (m) => m.T },
  { forms: ['flight'], law: 'flight', want: '≤ 16 risers, then a landing', why: 'a pause before the legs give out', test: (m) => m.flight <= 16, show: (m) => m.flight },
  { forms: ['flight', 'ramp'], law: 'handrail', want: 'a rail on each open side past a 0.6 m rise', why: 'where a slip would fall, there is something to catch', test: (m) => m.rise <= 0.6 || m.railed, show: (m) => (m.rise <= 0.6 ? 'not needed' : m.railed ? 'railed' : 'open') },
  { forms: ['ramp'], law: 'grade', want: `grade ≤ 0.3 (the walk's)`, why: 'steeper is a stair or a scramble', test: (m) => m.grade <= 0.3 + 1e-9, show: (m) => m.grade },
  { forms: ['ramp'], law: 'kerbs', want: 'kerbed both sides', why: 'a wheel or a foot is kept on the slope', test: (m) => m.kerbs === 2, show: (m) => m.kerbs },
  { forms: ['ramp'], law: 'landing', want: 'a level landing every 9 m of run', why: 'a long slope is a long pull', test: (m) => m.longest <= 9 + 1e-9, show: (m) => m.longest },
]);
export const stairsLaws = (form, m) => (form === 'steps'
  ? madeLaws('steps', m)
  : STAIRS_LAWS.filter((l) => l.forms.includes(form)).map((l) => ({ law: l.law, want: l.want, why: l.why, ok: l.test(m), value: l.show(m) })));

export function stairsParams({ variant = 'flight', from, to, rise, facing, width, riser, grade, edge = 'timber', elements = {} } = {}) {
  const V = STAIRS_VARIANTS[variant];
  if (!V) throw new Error(`playscape: stairs have no variant '${variant}' (variants: ${STAIRS_VARIANT_IDS.join(', ')})`);
  if (!from) throw new Error('stairs: give their ends: `from`, the foot on the level below, and `to`, the top on the level above (or a `rise` and a `facing`)');
  for (const k of Object.keys(elements)) if (!STAIRS_ELEMENTS.includes(k)) throw new Error(`stairs: '${k}' is not a stairs element (${STAIRS_ELEMENTS.join(', ')})`);
  if (!STAIRS_EDGES.includes(edge)) throw new Error(`stairs: edge is one of ${STAIRS_EDGES.join(', ')}`);
  const H = r5(to ? to[2] - from[2] : rise);
  if (!(H >= 0.2)) throw new Error('stairs: the level above must stand at least 0.2 m over the foot');
  const flat = to ? [to[0] - from[0], to[1] - from[1], 0] : [...(facing || [0, 1]).slice(0, 2), 0];
  const run0 = to ? Math.hypot(flat[0], flat[1]) : 0, D = unit(to && run0 < 0.05 ? [...(facing || [0, 1]).slice(0, 2), 0] : flat);
  const w = width ?? (variant === 'ramp' ? 1.4 : variant === 'steps' ? 1.4 : 1.1);
  if (!(w >= 0.6)) throw new Error('stairs: width is the walkable metres across, 0.6 or more');
  const fixed = to && run0 >= 0.05 ? run0 : null;
  let going;
  if (variant === 'ramp') {
    const g = fixed ? H / fixed : grade ?? V.going.grade, flights = Math.max(1, Math.ceil(H / g / 9 - 1e-9)), landing = flights > 1 ? 1.5 : 0;
    const slope = fixed ? (fixed - (flights - 1) * landing) : H / g;
    going = { grade: r5(H / slope), flights, landing, slope: r5(slope), run: r5(slope + (flights - 1) * landing) };
  } else {
    // risers as high as the law allows (fewest steps), then the tread the stride leaves; a long stair breaks for landings.
    // Given its run (both ends), it FITS the going to it: of the riser counts the law allows, the one whose tread keeps
    // the stride nearest its mark (a stair too cramped or too drawn out for any is laid at the nearest, and measured)
    const L = Math.max(V.going.landing, w), lay = (n) => {
      const flights = Math.ceil(n / V.going.flight), Rr = H / n;
      const T = fixed ? (fixed - (flights - 1) * L) / Math.max(1, n - flights) : V.going.blondel - 2 * Rr;
      return { n, R: r5(Rr), T: r5(T), flights, per: Math.ceil(n / flights), landing: flights > 1 ? L : 0, run: r5((n - flights) * T + (flights - 1) * L) };
    };
    const n0 = Math.max(1, Math.ceil(H / (riser ?? V.going.riser[1]) - 1e-9));
    if (fixed && riser === undefined) {
      const n1 = Math.max(n0, Math.floor(H / V.going.riser[0] + 1e-9));
      going = Array.from({ length: n1 - n0 + 1 }, (_, k) => lay(n0 + k)).reduce((a, b) => (Math.abs(2 * b.R + b.T - V.going.blondel) < Math.abs(2 * a.R + a.T - V.going.blondel) ? b : a));
    } else going = lay(n0);
  }
  const top = to && fixed ? P(to) : P(add(from, add(mul(D, going.run), [0, 0, H])));
  return { variant, from: P(from), to: top, rise: H, D: P(D), S: P(unit([-D[1], D[0], 0])), width: r5(w), edge, elements, ...going };
}

/** The runs a walk may take over a rise, by its laws: the shortest (the steepest lawful going), the longest (the
 *  lowest risers and the longest stride) and the comfortable one it lays on its own. */
export function goingRange(variant, rise) {
  const V = STAIRS_VARIANTS[variant], at = (riser, tread) => { const n = Math.ceil(rise / riser - 1e-9), f = Math.ceil(n / (V.going.flight || 1e9)); return r5((n - f) * tread + (f - 1) * V.going.landing); };
  if (variant === 'ramp') return { min: r5(rise / 0.3), max: Infinity, comfortable: stairsParams({ variant, from: [0, 0, 0], rise }).run };
  const B = variant === 'flight' ? [0.6, 0.66] : [0.6, 0.7], T0 = variant === 'flight' ? 0.25 : 0.28, [R0, R1] = V.going.riser;
  return { min: at(R1, Math.max(T0, B[0] - 2 * R1)), max: at(R0, B[1] - 2 * R0), comfortable: stairsParams({ variant, from: [0, 0, 0], rise }).run };
}

const on = (p, k) => p.elements[k] !== false;

/** The stations of the treads: [{ x0, x1, z }], x along the run from the foot, z the tread's top over the foot. */
export function treads(p) {
  if (p.variant === 'ramp') return [];
  const out = [];
  let x = 0;
  for (let i = 0; i < p.n; i++) {
    const z = r5((i + 1) * p.R), last = i === p.n - 1, land = !last && (i + 1) % p.per === 0;
    const len = last ? 0.3 : land ? p.landing : p.T;   // the top tread is the level's edge: a nosing's depth of it
    out.push({ x0: r5(x), x1: r5(x + len), z, landing: land, top: last });
    x += len;
  }
  return out;
}
/** A ramp's surface: [{ x0, x1, z0, z1 }] slopes and landings. */
export function slopes(p) {
  const out = [], per = p.slope / p.flights, rise = p.rise / p.flights;
  let x = 0, z = 0;
  for (let k = 0; k < p.flights; k++) {
    out.push({ x0: r5(x), x1: r5(x + per), z0: r5(z), z1: r5(z + rise) }); x += per; z += rise;
    if (k < p.flights - 1) { out.push({ x0: r5(x), x1: r5(x + p.landing), z0: r5(z), z1: r5(z), landing: true }); x += p.landing; }
  }
  return out;
}
// the walk line's height at station x (the nosings' line on a stair, the deck on a ramp)
function lineZ(p, x) {
  if (p.variant === 'ramp') {
    const s = slopes(p).find((q) => x <= q.x1 + 1e-9) || slopes(p).at(-1);
    const u = Math.min(1, Math.max(0, (x - s.x0) / Math.max(1e-9, s.x1 - s.x0)));
    return s.z0 + (s.z1 - s.z0) * u;
  }
  // the pitch line through the nosings, flat across a landing, carried on straight before the first riser (a rail's
  // foot and the newel there sit on it)
  const T = treads(p);
  if (x <= 0) return (x * p.R) / p.T;
  for (const t of T) if (x <= t.x1 + 1e-9) return t.landing ? t.z : Math.max(t.z - p.R, Math.min(t.z, t.z - p.R + (p.R * (x - t.x0)) / Math.max(1e-9, t.x1 - t.x0)));
  return p.rise;
}

// ── the build, in the stair's own frame: x along the run (D), y across (S), z up from the foot ─────────────────────
const surf = (group, v) => ({ key: null, scale: 1, tint: [v, v, v], group });
function put(out, part, group, v, c, A, B, C, h) {
  const from = out.length;
  obox(out, c, A, B, C, h, surf(group, v), 8);
  for (let i = from; i < out.length; i++) Object.assign(out[i], { part, value: v });
  if (out.boxes) out.boxes[out.boxes.length - 1].part = part;
}
const W = (p, x, y, z) => add(add(add(p.from, mul(p.D, x)), mul(p.S, y)), [0, 0, z]);
function box(out, p, part, group, v, x0, x1, y0, y1, z0, z1) {
  put(out, part, group, v, W(p, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), p.D, p.S, Z, [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2]);
}
// a member from (xa, za) to (xb, zb) at y, `t` across and `h` tall, hung straight down from the line
function slope(out, p, part, group, v, xa, za, xb, zb, y, t, h) {
  const a = W(p, xa, y, za), b = W(p, xb, y, zb), A = unit(sub(b, a)), C = unit([-A[0] * A[2], -A[1] * A[2], 1 - A[2] * A[2]]);
  put(out, part, group, v, add(mul(add(a, b), 0.5), [0, 0, -h / 2]), A, p.S, C, [Math.hypot(...sub(b, a)) / 2, t / 2, (h / 2) * Math.cos(Math.asin(Math.min(1, Math.abs(A[2]))))]);
}
// a run along the walk line from x0 to x1, `dz` over it, broken at each change of pitch so it follows a landing
function follow(out, p, part, group, v, x0, x1, y, dz, t, h) {
  const knots = [x0, ...(p.variant === 'ramp' ? slopes(p).flatMap((s) => [s.x0, s.x1]) : treads(p).filter((q) => q.landing).flatMap((q) => [q.x0, q.x1])), x1]
    .filter((x) => x >= x0 - 1e-9 && x <= x1 + 1e-9).sort((a, b) => a - b).filter((x, i, a) => !i || x - a[i - 1] > 1e-6);
  for (let i = 0; i + 1 < knots.length; i++) slope(out, p, part, group, v, knots[i], lineZ(p, knots[i]) + dz, knots[i + 1], lineZ(p, knots[i + 1]) + dz, y, t, h);
}
const inThird = (p, x) => x >= p.run / 3 - 1e-6 && x <= (2 * p.run) / 3 + 1e-6;
// the treads that carry a stair's 33: the middle third's, and never fewer than the middle three
function middleTreads(p) {
  const T = treads(p).filter((t) => !t.top && !t.landing), mid = T.filter((t) => inThird(p, t.x0));
  if (mid.length >= 3 || T.length <= 3) return new Set((mid.length >= 3 ? mid : T).map((t) => t.x0));
  const c = p.run / 2;
  return new Set([...T].sort((a, b) => Math.abs(a.x0 - c) - Math.abs(b.x0 - c)).slice(0, 3).map((t) => t.x0));
}

const RAIL_H = 0.9;
const BUILD = {
  flight(out, p) {
    const half = p.width / 2, T = treads(p), nose = 0.03;
    for (const [i, t] of T.entries()) {
      // the top tread is the level's own edge: only its riser is the stair's
      if (on(p, 'treads') && !t.top && (!t.landing || on(p, 'landing'))) box(out, p, t.landing ? 'landing' : 'treads', 'obj:fill', 0.74 - 0.05 * (i % 2), t.x0 - nose, t.x1, -half, half, t.z - 0.04, t.z);
      if (on(p, 'risers')) box(out, p, 'risers', 'obj:fill', 0.56, t.x0 - 0.02, t.x0, -half, half, t.z - p.R, t.z - 0.04);
    }
    const railedAt = p.rise > 0.6 ? on(p, 'handrail') : p.elements.handrail === true;
    // a short or open stair's 33 (no run of balusters to carry it): the middle third's nosings, dark
    const mids = middleTreads(p);
    if ((!railedAt || p.run < 2.4 || !on(p, 'balusters')) && on(p, 'treads')) for (const t of T) if (mids.has(t.x0)) box(out, p, 'nosings', 'obj:detail', 0.16, t.x0 - 0.035, t.x0 + 0.03, -half, half, t.z - 0.045, t.z + 0.004);
    const end = T.at(-1).x0, railed = p.rise > 0.6 ? on(p, 'handrail') : p.elements.handrail === true, top = RAIL_H + 0.06;
    for (const y of [-half - 0.04, half + 0.04]) {
      // the closed string, newel to newel: its top over the nosings, its foot cut level on the floor (it is never deeper
      // than the height it stands at), its head at the top newel
      // (in short pieces while it is shallower than its depth, so its underside stays on the floor)
      if (on(p, 'stringers')) for (let x = -0.12, x1; x < end - 1e-6; x = x1) {
        const d = Math.min(0.34, lineZ(p, x) + 0.1);
        x1 = Math.min(end, x + (d < 0.34 ? 0.05 : 0.3));
        slope(out, p, 'stringers', 'obj:body', 0.42, x - (x > -0.12 ? 0.01 : 0), lineZ(p, x) + 0.1, x1 + (x1 < end ? 0.01 : 0), lineZ(p, x1) + 0.1, y, 0.06, d);
      }
      // the newels, from the floor to the rail's top and never proud of it: at the foot, at the head (carried down to the
      // floor, the string framed into it) and at each landing's far end, where the stair stands on it
      if (on(p, 'newels')) for (const x of [-0.12, end, ...T.filter((t) => t.landing).map((t) => t.x1)]) box(out, p, 'newels', 'obj:body', 0.38, x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0, lineZ(p, x) + top - 0.03);
      if (railed) follow(out, p, 'handrail', 'obj:fill', 0.7, -0.12, end, y, top, 0.07, 0.06);
      // balusters under the rail, two a tread; the 33 on a long flight: the middle third's, dark, the rhythm the eye runs along
      if (on(p, 'balusters') && railed) for (const t of T.slice(0, -1)) for (const f of t.landing ? [0.15, 0.45, 0.75] : [0.25, 0.75]) {
        const x = t.x0 + (t.x1 - t.x0) * f, z = lineZ(p, x), mid = p.run >= 2.4 && inThird(p, x);
        box(out, p, 'balusters', mid ? 'obj:detail' : 'obj:fill', mid ? 0.16 : 0.64, x - 0.02, x + 0.02, y - 0.02, y + 0.02, z + 0.1, z + RAIL_H);
      }
    }
  },
  steps(out, p) {
    const half = p.width / 2, T = treads(p), stone = p.edge === 'stone', mids = middleTreads(p);
    for (const [i, t] of T.entries()) {
      const z0 = t.z - p.R;
      // the bank under each tread, cut back to the riser: the soil the step is dug into
      // (the first and last run on under the end posts)
      if (on(p, 'bank')) box(out, p, 'bank', 'obj:body', 0.36, i === 0 ? -0.42 : t.x0 - (stone ? 0.2 : 0), t.top ? t.x0 + 0.42 : t.x1, -half - 0.15, half + 0.15, -0.3, t.z - 0.05);
      if (on(p, 'treads') && (!t.landing || on(p, 'landing'))) box(out, p, t.landing ? 'landing' : 'treads', 'obj:fill', 0.66 - 0.04 * (i % 2), t.x0, t.x1, -half, half, t.z - 0.05, t.z - 0.01);
      if (on(p, 'risers')) {
        if (stone) box(out, p, 'risers', 'obj:fill', 0.54 - 0.06 * (i % 2), t.x0 - 0.24, t.x0 + 0.02, -half, half, z0 - 0.04, t.z);
        else box(out, p, 'risers', 'obj:fill', 0.5, t.x0 - 0.05, t.x0, -half, half, z0 - 0.12, t.z);
      }
      // the 33: what holds the middle third's risers, dark: the stakes behind a board, the pinning stones in a stone's joints
      const mid = mids.has(t.x0), g = mid ? 'obj:detail' : 'obj:fill', v = mid ? 0.16 : 0.56;
      if (!stone && on(p, 'stakes')) for (const y of [-half + 0.08, half - 0.08]) box(out, p, 'stakes', g, v, t.x0 - 0.1, t.x0 - 0.05, y - 0.03, y + 0.03, z0 - 0.3, t.z - 0.02);
      if (stone && on(p, 'pins') && mid) for (const y of [-half / 3, half / 3]) box(out, p, 'pins', 'obj:detail', 0.16, t.x0 - 0.2, t.x0 - 0.04, y - 0.05, y + 0.05, t.z - 0.03, t.z + 0.005);
    }
    const end = T.at(-1).x0;
    for (const y of [-half - 0.08, half + 0.08]) {
      if (on(p, 'edging')) follow(out, p, 'edging', 'obj:body', 0.44, -0.3, end + 0.3, y, 0.12, 0.14, 0.3);
      if (on(p, 'posts')) for (const x of [-0.36, end + 0.36]) box(out, p, 'posts', 'obj:body', 0.4, x - 0.06, x + 0.06, y - 0.06, y + 0.06, lineZ(p, x) - 0.3, lineZ(p, x) + 0.55);
    }
  },
  ramp(out, p) {
    const half = p.width / 2, railed = on(p, 'handrail') && p.rise > 0.6;
    if (on(p, 'deck')) follow(out, p, 'deck', 'obj:fill', 0.72, -0.05, p.run + 0.05, 0, 0, p.width, 0.12);
    for (const y of [-half - 0.06, half + 0.06]) {
      if (on(p, 'kerbs')) follow(out, p, 'kerbs', 'obj:body', 0.44, -0.05, p.run + 0.05, y, 0.1, 0.12, 0.26);
      if (railed && on(p, 'posts')) { const k = Math.max(1, Math.round(p.run / 1.6)); for (let i = 0; i <= k; i++) { const x = (p.run * i) / k; box(out, p, 'posts', 'obj:body', 0.4, x - 0.05, x + 0.05, y - 0.05, y + 0.05, lineZ(p, x) + 0.05, lineZ(p, x) + RAIL_H + 0.08); } }
      if (railed) follow(out, p, 'handrail', 'obj:fill', 0.68, -0.05, p.run + 0.05, y, RAIL_H + 0.08, 0.08, 0.07);
    }
    // cleats across the deck for the feet, under the kerbs' line; the 33: the middle third's, dark
    if (on(p, 'cleats')) for (let x = 0.25; x < p.run - 0.1; x += 0.25) { const z = lineZ(p, x), mid = inThird(p, x); box(out, p, 'cleats', mid ? 'obj:detail' : 'obj:fill', mid ? 0.18 : 0.6, x - 0.025, x + 0.025, -half + 0.02, half - 0.02, z - 0.01, z + 0.025); }
    // trestles: legs to the floor and a cap under the deck, under each landing (and under the middle of a lone slope
    // of 2 m or more)
    const stations = p.flights > 1 ? slopes(p).filter((q) => q.landing).map((q) => (q.x0 + q.x1) / 2) : p.run >= 2 ? [p.run / 2] : [];
    if (on(p, 'trestles')) for (const x of stations) {
      const z = lineZ(p, x) - 0.12;
      for (const y of [-half + 0.1, half - 0.1]) box(out, p, 'trestles', 'obj:body', 0.38, x - 0.07, x + 0.07, y - 0.07, y + 0.07, 0, z);
      box(out, p, 'trestles', 'obj:body', 0.38, x - 0.09, x + 0.09, -half, half, z - 0.14, z);
    }
  },
};

/** The walk's numbers, for its laws. */
function measuresOf(p, faces) {
  const parts = new Set(faces.boxes.map((b) => b.part));
  if (p.variant === 'ramp') return { grade: p.grade, kerbs: parts.has('kerbs') ? 2 : 0, longest: r5(p.slope / p.flights), rise: p.rise, railed: parts.has('handrail') };
  return { blondel: r5(2 * p.R + p.T), R: p.R, T: p.T, uneven: 0, flight: p.per, rise: p.rise, railed: parts.has('handrail') };
}

export const STAIRS = {
  id: 'stairs',
  name: 'Stairs',
  role: 'a walk from one level to the next: a flight, outdoor steps, a ramp',
  interest: 'prop',
  variants: STAIRS_VARIANTS,
  skins: { greybox: true },
  when: 'stairs, a staircase, a flight of stairs, steps up the hill, garden steps, steps cut in the bank, a ramp, a slope up, up to the next floor, up to the terrace, a stoop',

  resolve({ variant, skin = 'greybox', params, ...spec } = {}) {
    if (skin !== 'greybox') throw new Error("playscape: stairs have no skin '" + skin + "' (skins: greybox)");
    const p = params || stairsParams({ variant: variant ?? spec.variant, ...spec }), faces = blockSink();
    BUILD[p.variant](faces, p);
    const pace = STAIR_PACE[p.variant], length = Math.hypot(p.run, p.rise);
    return {
      entry: 'stairs', variant: p.variant, skin, params: p, interest: this.interest,
      frame: { at: P(W(p, p.run / 2, 0, 0)), N: P(p.S.map((x) => -x)), U: p.D },   // judged side-on: its elevation
      faces,
      walk: { rise: p.rise, run: p.run, pitch: r5((Math.atan2(p.rise, p.run) * 180) / Math.PI), seconds: r5(length / pace), bottom: p.from, top: p.to },
      laws: stairsLaws(p.variant, measuresOf(p, faces)),
      elements: [...new Set(faces.boxes.map((b) => b.part))],
      world: this.lower(p),
    };
  },

  /** Each tread a floor face over a solid block to the foot (the platform rule steps up it), or each stretch of a ramp;
   *  the rails as lines. */
  lower(p) {
    const h = p.width / 2, faces = [], colliders = [];
    const quad = (x0, x1, z0, z1) => {
      const c = [W(p, x0, -h, z0), W(p, x1, -h, z1), W(p, x1, h, z1), W(p, x0, h, z0)];
      faces.push({ corners: c.map(P), fill: '#9aa0a8', group: 'floor' });
      colliders.push({ min: P([0, 1, 2].map((k) => Math.min(...c.map((q) => q[k])) - (k === 2 ? Math.max(z0, z1) - Math.min(z0, z1) + 0 : 0))).map((v, k) => (k === 2 ? r5(p.from[2] - 0.1) : v)), max: P([0, 1, 2].map((k) => Math.max(...c.map((q) => q[k])))) });
    };
    if (p.variant === 'ramp') for (const s of slopes(p)) { const n = Math.max(1, Math.ceil((s.x1 - s.x0) / 0.5)); for (let i = 0; i < n; i++) { const a = s.x0 + ((s.x1 - s.x0) * i) / n, b = s.x0 + ((s.x1 - s.x0) * (i + 1)) / n; quad(a, b, lineZ(p, a), lineZ(p, b)); } }
    else for (const t of treads(p)) quad(t.x0, t.x1, t.z, t.z);
    const railed = p.variant !== 'steps' && (p.rise > 0.6 ? p.elements.handrail !== false : p.elements.handrail === true);
    const end = p.variant === 'ramp' ? p.run : treads(p).at(-1).x0, xs = Array.from({ length: 9 }, (_, i) => (end * i) / 8);
    const rails = railed ? [-1, 1].map((sd) => ({ line: xs.map((x) => P(W(p, x, sd * (h + 0.05), lineZ(p, x)))), height: RAIL_H })) : [];
    return { faces, colliders, rails, entities: [] };
  },
};
