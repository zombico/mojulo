/**
 * THE BACK YARDS — an evoked block's yards, each designed on its own: a PLAN of three zones, each a FEATURE (what the
 * household does there), built on the yard's level pad; a balcony on some houses' backs; the FENCES between yards. In the
 * plot's frame (metres: u along its frontage from 0 to its width, v into it from its front line, z up from its pad), so
 * the scene seats it as it seats the plot.
 *
 *   YARDS        { <feature>: { read, zone, need, wide?, trees, large? } }: a feature, its zone (near the back door,
 *                the yard's middle, by its back fence, or 'any'), the yard depth it needs, the width it needs, the trees
 *                it keeps (a `large` one a shade tree)
 *   ZONES        the zones a plan names, in order from the house: near, mid, back
 *   yardOf({ near, mid, back }, { w, v0, v1, R }) → { faces: [{ corners, out, role, hex? }], trees: [{ u, v, large? }],
 *       plan }: the yard from the house's back wall (v0) to the plot's back line (v1), each zone given its depth in
 *       order (a feature without the room is lawn: `plan` the one drawn); R its dice
 *   balconyOf({ u0, u1, v, z, R }) → faces: a balcony off the house's back wall (at v) at an upper floor (z)
 *   fenceOf(fence, [u0, v0], [u1, v1], z0) → the fence's faces along a line (a thin box, or a hedge's thick one)
 *   carOf(u, v, along, hex) → a car's faces standing at (u, v), its length along 'u' or 'v', its body painted `hex`
 *   CAR_PAINTS   the cars' paints
 *   garageOf(rect, door?) → a garage's faces, its door at v0 (a mansion's drive) or v1 (a lane behind)
 *   serviceOf(kind, { w, v0, v1, R }) → { faces }: a shop's service yard (its bins, now and then a car) or a walk-up's lot
 *                (its stalls painted, cars in some), from the building's back wall (v0) to the plot's back line (v1)
 *
 * `role` says how the scene paints a face: timber, deck, paving, soil, leaf, sand, shed, roof, door, canvas, metal,
 * gravel, mat, grill, mulch, compost, glass (a face's own `hex` over its role's: a trampoline's rim, a slide).
 * Pure: the dice are the caller's.
 */
import { box } from './fronts.js';

export const YARDS = Object.freeze({
  lawn: Object.freeze({ read: 'open lawn (in the yard\'s middle a tree over it)', zone: 'any', need: 0, trees: 1 }),
  // near the house, off its back door
  patio: Object.freeze({ read: 'a paved patio off the back door: a table and its chairs under a parasol, or a grill and two loungers', zone: 'near', need: 3.4, trees: 0 }),
  deck: Object.freeze({ read: 'a timber deck at the back door\'s height, its rail, its steps down to the lawn, a planter or two', zone: 'near', need: 3.6, trees: 0 }),
  // the yard's middle
  garden: Object.freeze({ read: 'raised beds in rows across the yard, things growing in them', zone: 'mid', need: 2.8, trees: 0 }),
  play: Object.freeze({ read: 'a swing on its A-frames, a sandbox or a slide beside it', zone: 'mid', need: 4.2, wide: 3.8, trees: 0 }),
  trampoline: Object.freeze({ read: 'a round trampoline on its legs, its padded rim, the posts and ring of its net', zone: 'mid', need: 4.2, wide: 4.4, trees: 0 }),
  pool: Object.freeze({ read: 'a pool in its stone coping, a terrace of flags round it, two loungers', zone: 'mid', need: 7.4, wide: 5.5, trees: 0 }),
  // by the back fence
  shed: Object.freeze({ read: 'a garden shed in a back corner, gravel before its door, a small tree in the other', zone: 'back', need: 4.6, trees: 1 }),
  beds: Object.freeze({ read: 'a kitchen garden along the back fence, a compost bin in its corner', zone: 'back', need: 2.4, trees: 0 }),
  tree: Object.freeze({ read: 'a large shade tree at the back, a ring of mulch round it and a bench under it', zone: 'back', need: 4, trees: 1, large: true }),
});
export const YARD_IDS = Object.freeze(Object.keys(YARDS));
export const ZONES = Object.freeze(['near', 'mid', 'back']);
export const FENCES = Object.freeze({
  board: Object.freeze({ read: 'a board fence, head high', h: 1.8, t: 0.05, role: 'timber' }),
  picket: Object.freeze({ read: 'a painted picket fence, waist high', h: 1.1, t: 0.06, role: 'picket' }),
  hedge: Object.freeze({ read: 'a clipped hedge', h: 1.5, t: 0.7, role: 'leaf' }),
});
export const FENCE_IDS = Object.freeze(Object.keys(FENCES));

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const P = (x, y, z) => [r4(x), r4(y), r4(z)];
const roll = (R, lo, hi) => lo + (hi - lo) * R();
const quad = (u0, v0, u1, v1, z, role, extra = {}) => ({ corners: [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], out: [0, 0, 1], role, ...extra });
// n points round (cu, cv) at radius r, height z
const ring = (cu, cv, r, n, z) => Array.from({ length: n }, (_, k) => [cu + r * Math.cos((2 * Math.PI * k) / n), cv + r * Math.sin((2 * Math.PI * k) / n), z]);
// a trampoline's rim, a slide's chute: one a yard
const PADS = ['#2f6fb5', '#3a9a52', '#c8432f', '#e0a526', '#6a4a9a'];
const SLIDES = ['#d8452f', '#2f7fd8', '#f2b632', '#3aa35a'];

/** A gable roof over [x0, x1] × [y0, y1], its ridge along v, eaves at `ze`, `rise` over them, `o` over the walls. */
function gable(x0, y0, x1, y1, ze, rise, o, role) {
  const xm = (x0 + x1) / 2, zr = ze + rise, a = x0 - o, b = x1 + o, c = y0 - o, d = y1 + o;
  return [
    { corners: [P(a, c, ze), P(xm, c, zr), P(xm, d, zr), P(a, d, ze)], out: [-1, 0, 1], role },
    { corners: [P(b, d, ze), P(xm, d, zr), P(xm, c, zr), P(b, c, ze)], out: [1, 0, 1], role },
    { corners: [P(x0, y0, ze), P(x1, y0, ze), P(xm, y0, zr)], out: [0, -1, 0], role: 'shed' },
    { corners: [P(x1, y1, ze), P(x0, y1, ze), P(xm, y1, zr)], out: [0, 1, 0], role: 'shed' },
  ];
}

/** A back yard's plan, built: each zone given its depth in order from the house, a feature without its room lawn. */
export function yardOf(plan, { w, v0, v1, R }) {
  const out = [], trees = [], depth = v1 - v0, inset = 0.6, fit = { near: 'lawn', mid: 'lawn', back: 'lawn' };
  const wide = (id) => w >= (YARDS[id]?.wide ?? 3) - 1e-9;
  // a tree where the zone leaves open ground, clear of the yard's sides
  const tree = (vLo, vHi, large = false) => { if (vHi - vLo > 0.5 && w > 3) trees.push({ u: r4(roll(R, 1.4, w - 1.4)), v: r4(roll(R, vLo, vHi)), ...(large ? { large } : {}) }); };
  // near the house: never more than two fifths of the yard; by the back fence: when a strip of lawn stays between
  const nD = plan.near && plan.near !== 'lawn' ? Math.min(YARDS[plan.near].need, depth * 0.4) : 0;
  if (nD >= 2.2 && wide(plan.near)) fit.near = plan.near;
  const n1 = fit.near === 'lawn' ? v0 : v0 + nD;
  const bD = plan.back && plan.back !== 'lawn' ? YARDS[plan.back].need : 0;
  if (bD > 0 && v1 - bD - n1 >= 1.5 && wide(plan.back)) fit.back = plan.back;
  const b0 = fit.back === 'lawn' ? v1 : v1 - bD, m0 = n1 + 0.4, m1 = b0 - 0.4;
  if (plan.mid && plan.mid !== 'lawn' && m1 - m0 >= YARDS[plan.mid].need - 1e-9 && wide(plan.mid)) fit.mid = plan.mid;

  // ── near: off the back door ──
  if (fit.near === 'patio') {
    const u0 = inset, u1 = w - inset, cu = (u0 + u1) / 2, cv = (v0 + n1) / 2 + 0.1;
    out.push(quad(u0, v0, u1, n1, 0.03, 'paving'));
    if (R() < 0.55 || w < 5) {
      // a table, its chairs, a parasol over it
      out.push(...box(cu - 0.6, cv - 0.4, cu + 0.6, cv + 0.4, 0.7, 0.76, 'timber'), ...box(cu - 0.04, cv - 0.04, cu + 0.04, cv + 0.04, 0.03, 0.7, 'metal'));
      for (const [du, dv] of [[-0.95, 0], [0.95, 0], [0, -0.75], [0, 0.75]]) out.push(...box(cu + du - 0.22, cv + dv - 0.22, cu + du + 0.22, cv + dv + 0.22, 0.03, 0.45, 'timber'));
      const ph = 2.3, pr = 1.1;
      out.push(...box(cu - 0.025, cv - 0.025, cu + 0.025, cv + 0.025, 0.76, ph, 'metal'));
      for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) out.push({ corners: [P(cu + a[0] * pr, cv + a[1] * pr, ph - 0.35), P(cu + b[0] * pr, cv + b[1] * pr, ph - 0.35), P(cu, cv, ph)], out: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1], role: 'canvas' });
    } else {
      // a grill by one side, two loungers by the other, their backs raised
      const gu = u0 + 0.4, gv = n1 - 1.1;
      out.push(...box(gu, gv, gu + 0.6, gv + 0.45, 0.03, 0.82, 'metal'), ...box(gu - 0.02, gv - 0.02, gu + 0.62, gv + 0.47, 0.82, 1.02, 'grill'));
      for (const k of [0, 1]) {
        const a = u1 - 0.75 - k * 0.95, b = a + 0.7, s = v0 + 0.5, e = s + 1.3;
        if (a < gu + 1.2) continue;
        out.push(...box(a, s, b, e, 0.03, 0.34, 'timber'));
        out.push({ corners: [P(a, s, 0.34), P(b, s, 0.34), P(b, s - 0.45, 0.85), P(a, s - 0.45, 0.85)], out: [0, 1, 1], role: 'timber' });
      }
    }
  } else if (fit.near === 'deck') {
    // a deck at the back door's height, its rail, its steps down at its middle, a planter or two on it
    const dv = n1 - v0, u0 = inset * 0.5, u1 = w - inset * 0.5, z = 0.6, cu = (u0 + u1) / 2;
    out.push(...box(u0, v0, u1, v0 + dv, 0, z, 'deck'));
    for (const [a, b] of [[[u0, v0 + dv], [cu - 0.6, v0 + dv]], [[cu + 0.6, v0 + dv], [u1, v0 + dv]], [[u0, v0], [u0, v0 + dv]], [[u1, v0], [u1, v0 + dv]]]) {
      const along = a[1] === b[1];
      out.push(...(along ? box(Math.min(a[0], b[0]), a[1] - 0.04, Math.max(a[0], b[0]), a[1] + 0.04, z + 0.85, z + 0.95, 'timber') : box(a[0] - 0.04, Math.min(a[1], b[1]), a[0] + 0.04, Math.max(a[1], b[1]), z + 0.85, z + 0.95, 'timber')));
      for (const p of [a, b]) { const y0 = Math.max(v0, p[1] - 0.05); out.push(...box(p[0] - 0.05, y0, p[0] + 0.05, y0 + 0.1, z, z + 0.95, 'timber')); }
    }
    for (let k = 0; k < 3; k++) out.push(...box(cu - 0.55, v0 + dv + k * 0.28, cu + 0.55, v0 + dv + (k + 1) * 0.28, 0, z - (k + 1) * 0.2, 'deck'));
    for (const u of R() < 0.6 ? [u0 + 0.25, u1 - 0.85] : [u1 - 0.85]) {
      const v = v0 + dv - 0.85;
      out.push(...box(u, v, u + 0.6, v + 0.6, z, z + 0.45, 'timber'), ...box(u + 0.08, v + 0.08, u + 0.52, v + 0.52, z + 0.45, z + 0.45 + 0.3 + 0.4 * R(), 'leaf'));
    }
  }

  // ── the yard's middle ──
  if (fit.mid === 'garden') {
    // beds in rows across the yard, a path between them, things growing in each
    const n = Math.max(1, Math.min(4, Math.floor((m1 - m0 + 0.8) / 1.8)));
    for (let i = 0; i < n; i++) {
      const a = m0 + i * 1.8, u0 = inset + 0.3, u1 = w - inset - 0.3;
      out.push(...box(u0, a, u1, a + 1, 0, 0.3, 'timber'));
      out.push(quad(u0 + 0.05, a + 0.05, u1 - 0.05, a + 0.95, 0.31, 'soil'));
      for (let u = u0 + 0.4; u < u1 - 0.3; u += 0.7 + 0.4 * R()) { const s = 0.25 + 0.25 * R(); out.push(...box(u - s / 2, a + 0.5 - s / 2, u + s / 2, a + 0.5 + s / 2, 0.31, 0.31 + s * (0.8 + R()), 'leaf')); }
    }
  } else if (fit.mid === 'play') {
    // a swing on its A-frames (its beam across the yard, its seats swinging along it), and a sandbox or a slide beside
    // it when the yard is wide enough, after it when it is long enough
    const span = Math.min(2.6, w - 1.2), side = w >= 6.6, su1 = side ? w - 0.6 : w / 2 + span / 2, a = su1 - span, qv = m0 + 2, top = 2.3;
    for (const u of [a, su1]) for (const dv of [-0.7, 0.7]) out.push({ corners: [P(u - 0.05, qv + dv, 0), P(u + 0.05, qv + dv, 0), P(u + 0.05, qv, top), P(u - 0.05, qv, top)], out: [0, Math.sign(dv), 0.3], role: 'metal' });
    out.push(...box(a, qv - 0.05, su1, qv + 0.05, top - 0.1, top, 'metal'));
    for (const u of [a + span / 4, su1 - span / 4]) {
      out.push(...box(u - 0.25, qv - 0.12, u + 0.25, qv + 0.12, 0.45, 0.5, 'timber'));
      for (const du of [-0.22, 0.22]) out.push(...box(u + du - 0.01, qv - 0.01, u + du + 0.01, qv + 0.01, 0.5, top - 0.1, 'metal').slice(1));
    }
    const at = side ? [0.7, m0 + 0.2] : m1 - m0 >= 7.6 ? [w / 2 - 0.9, m0 + 4.2] : null;
    if (at && R() < 0.5) {
      const [u, v] = at;
      out.push(...box(u, v, u + 1.8, v + 1.8, 0, 0.28, 'timber'), quad(u + 0.1, v + 0.1, u + 1.7, v + 1.7, 0.22, 'sand'));
    } else if (at) {
      // a slide: its ladder up to a platform, its chute down along the yard
      const [u, v] = at, hex = SLIDES[Math.floor(R() * SLIDES.length)], c0 = u + 0.65, c1 = u + 1.15, ph = 1.2, p0 = v + 0.4, p1 = p0 + 0.8;
      for (const [x, y] of [[u + 0.5, p0], [u + 1.3, p0], [u + 0.5, p1], [u + 1.3, p1]]) out.push(...box(x - 0.04, y - 0.04, x + 0.04, y + 0.04, 0, ph + 0.6, 'timber').slice(1));
      out.push(...box(u + 0.5, p0, u + 1.3, p1, ph - 0.06, ph, 'timber'));
      for (let k = 1; k <= 3; k++) out.push(...box(u + 0.6, p0 - 0.4, u + 1.2, p0 - 0.36, (ph * k) / 4 - 0.02, (ph * k) / 4 + 0.02, 'timber'));
      for (const x of [u + 0.6, u + 1.2]) out.push({ corners: [P(x, p0 - 0.42, 0), P(x, p0, 0), P(x, p0, ph), P(x, p0 - 0.04, ph)], out: [1, 0, 0], role: 'timber' });
      out.push({ corners: [P(c0, p1, ph), P(c1, p1, ph), P(c1, p1 + 2.1, 0.08), P(c0, p1 + 2.1, 0.08)], out: [0, 0.5, 1], role: 'slide', hex });
      for (const x of [c0, c1]) out.push({ corners: [P(x, p1, ph), P(x, p1 + 2.1, 0.08), P(x, p1 + 2.1, 0.28), P(x, p1, ph + 0.2)], out: [x === c0 ? -1 : 1, 0, 0], role: 'slide', hex });
    }
  } else if (fit.mid === 'trampoline') {
    // a round mat on its legs, its padded rim, the posts of its net and the padded ring along their tops
    const r = 1.6, rr = 1.85, n = 12, zm = 0.9, hex = PADS[Math.floor(R() * PADS.length)];
    const lo = rr + 0.4, hi = w - rr - 0.4, cu = hi > lo ? roll(R, lo, hi) : w / 2, cv = (m0 + m1) / 2;
    const mat = ring(cu, cv, r, n, zm), rim = ring(cu, cv, rr, n, zm - 0.03), top = ring(cu, cv, rr, n, 2.62), top0 = ring(cu, cv, rr, n, 2.52);
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      out.push({ corners: [P(cu, cv, zm), P(...mat[k]), P(...mat[k1])], out: [0, 0, 1], role: 'mat' });
      out.push({ corners: [P(...mat[k]), P(...rim[k]), P(...rim[k1]), P(...mat[k1])], out: [0, 0, 1], role: 'pad', hex });
      out.push({ corners: [P(...top0[k]), P(...top0[k1]), P(...top[k1]), P(...top[k])], out: [Math.cos((2 * Math.PI * (k + 0.5)) / n), Math.sin((2 * Math.PI * (k + 0.5)) / n), 0], role: 'pad', hex });
    }
    for (let k = 0; k < n; k += 2) { const [x, y] = rim[k]; out.push(...box(x - 0.03, y - 0.03, x + 0.03, y + 0.03, k % 4 === 0 ? 0 : zm - 0.03, 2.55, 'metal').slice(1)); }
  } else if (fit.mid === 'pool') {
    // a pool in its coping, a terrace of flags round it, two loungers on the terrace
    const pw = Math.min(4.2, w - 3), a = m0 + 1.2, pl = Math.min(9, m1 - m0 - 2.4), cu = w / 2;
    out.push(quad(cu - pw / 2 - 1.4, a - 1.2, cu + pw / 2 + 1.4, a + pl + 1.2, 0.03, 'paving'), quad(cu - pw / 2, a, cu + pw / 2, a + pl, 0.04, 'water'));
    for (const [x0, y0, x1, y1] of [[cu - pw / 2 - 0.3, a - 0.3, cu + pw / 2 + 0.3, a], [cu - pw / 2 - 0.3, a + pl, cu + pw / 2 + 0.3, a + pl + 0.3], [cu - pw / 2 - 0.3, a, cu - pw / 2, a + pl], [cu + pw / 2, a, cu + pw / 2 + 0.3, a + pl]]) out.push(...box(x0, y0, x1, y1, 0.03, 0.12, 'coping'));
    for (const k of [0, 1]) { const u = cu + pw / 2 + 0.5, v = a + 1 + k * 2.2; if (u + 0.7 < w - 0.3) out.push(...box(u, v, u + 0.7, v + 1.9, 0.03, 0.35, 'timber')); }
  } else if (m1 - m0 > 1.5) tree(m0 + 0.8, m1 - 0.3);

  // ── by the back fence ──
  if (fit.back === 'shed') {
    // a shed in a back corner, its door to the house, gravel before it, a small tree in the other corner
    const sw = Math.min(2.4, w - 1.2), sd = 2.8, left = R() < 0.5, u0 = left ? 0.5 : w - 0.5 - sw, vB = v1 - 0.5 - sd;
    out.push(quad(u0 - 0.4, vB - 1.4, u0 + sw + 0.4, vB, 0.02, 'gravel'));
    out.push(...box(u0, vB, u0 + sw, vB + sd, 0, 2.1, 'shed').slice(1), ...gable(u0, vB, u0 + sw, vB + sd, 2.1, 0.7, 0.15, 'roof'));
    out.push({ corners: [P(u0 + sw / 2 - 0.45, vB - 0.02, 0.05), P(u0 + sw / 2 + 0.45, vB - 0.02, 0.05), P(u0 + sw / 2 + 0.45, vB - 0.02, 1.95), P(u0 + sw / 2 - 0.45, vB - 0.02, 1.95)], out: [0, -1, 0], role: 'door' });
    if (w - sw - 1 > 2.4) trees.push({ u: r4(left ? Math.max(u0 + sw + 1.2, w - 1.6) : Math.min(1.6, u0 - 1.2)), v: r4(v1 - 2) });
  } else if (fit.back === 'beds') {
    // a long bed along the back fence, things growing in it, a compost bin in its corner
    const cb = w >= 4.2, u0 = 0.5, u1 = cb ? w - 1.7 : w - 0.5, a = v1 - 1.6;
    out.push(...box(u0, a, u1, a + 1, 0, 0.35, 'timber'), quad(u0 + 0.05, a + 0.05, u1 - 0.05, a + 0.95, 0.36, 'soil'));
    for (let u = u0 + 0.35; u < u1 - 0.25; u += 0.55 + 0.35 * R()) { const s = 0.3 + 0.3 * R(), v = a + 0.3 + 0.4 * R(); out.push(...box(u - s / 2, v - s / 2, u + s / 2, v + s / 2, 0.36, 0.36 + s * (1 + 1.4 * R()), 'leaf')); }
    if (cb) out.push(...box(w - 1.4, a + 0.05, w - 0.5, a + 0.95, 0, 0.95, 'compost'), ...box(w - 1.43, a + 0.02, w - 0.47, a + 0.98, 0.95, 1.0, 'timber'));
  } else if (fit.back === 'tree') {
    // a large shade tree, a ring of mulch round it, and now and then a bench under it
    const tu = w >= 3.6 ? roll(R, 1.8, w - 1.8) : w / 2, tv = v1 - 2.2, rim = ring(tu, tv, 1, 6, 0.02);
    for (let k = 0; k < 6; k++) out.push({ corners: [P(tu, tv, 0.02), P(...rim[k]), P(...rim[(k + 1) % 6])], out: [0, 0, 1], role: 'mulch' });
    if (R() < 0.6) out.push(...box(tu - 0.75, tv - 1.5, tu + 0.75, tv - 1.1, 0.4, 0.46, 'timber'), ...box(tu - 0.7, tv - 1.45, tu - 0.6, tv - 1.15, 0, 0.4, 'timber').slice(1), ...box(tu + 0.6, tv - 1.45, tu + 0.7, tv - 1.15, 0, 0.4, 'timber').slice(1));
    trees.push({ u: r4(tu), v: r4(tv), large: true });
  }
  return { faces: out, trees, plan: fit };
}

/** A balcony off the house's back wall (at v, facing +v) over [u0, u1], its floor at z: its slab, its rail and
 *  balusters on its three open sides, its glazed door, the brackets under it. */
export function balconyOf({ u0, u1, v, z, R }) {
  const dv = 1.1 + 0.4 * R(), t = 0.16, h = 1, v1 = v + dv, out = [...box(u0, v, u1, v1, z - t, z, 'deck')];
  out.push(...box(u0, v1 - 0.05, u1, v1, z + h - 0.06, z + h, 'rail'), ...box(u0, v, u0 + 0.05, v1, z + h - 0.06, z + h, 'rail'), ...box(u1 - 0.05, v, u1, v1, z + h - 0.06, z + h, 'rail'));
  const n = Math.max(2, Math.round((u1 - u0) / 0.45));
  for (let k = 0; k <= n; k++) { const u = u0 + 0.025 + ((u1 - u0 - 0.05) * k) / n; out.push(...box(u - 0.02, v1 - 0.045, u + 0.02, v1 - 0.005, z, z + h - 0.06, 'rail').slice(1)); }
  for (const u of [u0 + 0.025, u1 - 0.025]) out.push(...box(u - 0.02, v + dv / 2 - 0.02, u + 0.02, v + dv / 2 + 0.02, z, z + h - 0.06, 'rail').slice(1));
  const cu = (u0 + u1) / 2;
  out.push({ corners: [P(cu - 0.5, v + 0.03, z), P(cu + 0.5, v + 0.03, z), P(cu + 0.5, v + 0.03, z + 2.1), P(cu - 0.5, v + 0.03, z + 2.1)], out: [0, 1, 0], role: 'glass' });
  for (const u of [u0 + 0.2, u1 - 0.2]) out.push({ corners: [P(u, v, z - t), P(u, v + dv * 0.8, z - t), P(u, v, z - t - 0.9)], out: [1, 0, 0], role: 'timber' });
  return out;
}
/** A fence along a line in the plot's frame, standing on `z0`. */
export function fenceOf(fence, [u0, v0], [u1, v1], z0 = 0) {
  const F = FENCES[fence], t = F.t / 2;
  return box(Math.min(u0, u1) - (u0 === u1 ? t : 0), Math.min(v0, v1) - (v0 === v1 ? t : 0), Math.max(u0, u1) + (u0 === u1 ? t : 0), Math.max(v0, v1) + (v0 === v1 ? t : 0), z0, z0 + F.h, F.role);
}

// a car's paint, one a car
export const CAR_PAINTS = ['#8a2a2a', '#2a3f6a', '#d8d6d0', '#3a3d42', '#6a6f75', '#2f5a3a', '#c9b48a'];
/** A car standing at (u, v), its length along `along` ('u' or 'v'): its body and its cabin, as boxes. */
export function carOf(u, v, along, hex) {
  const [L, Wd] = along === 'u' ? [4.3, 1.8] : [1.8, 4.3], [l, wd] = along === 'u' ? [2.3, 1.6] : [1.6, 2.3];
  return [...box(u - L / 2, v - Wd / 2, u + L / 2, v + Wd / 2, 0.25, 0.95, 'car'), ...box(u - l / 2, v - wd / 2, u + l / 2, v + wd / 2, 0.95, 1.45, 'cabin')].map((f) => ({ ...f, ...(f.role === 'car' ? { hex } : {}) }));
}

/** A shop's service yard or a walk-up's lot, built. */
export function serviceOf(kind, { w, v0, v1, R }) {
  const out = [], depth = v1 - v0;
  if (kind === 'apartments' || kind === 'lowrise') {
    // stalls across the lot, their lines painted, a car in some
    const vA = v0 + 2.5, vB = Math.min(v1 - 1, vA + 5.2);
    for (let u = 1; u + 2.6 <= w - 1; u += 2.6) {
      out.push({ corners: [P(u - 0.05, vA, 0.02), P(u + 0.05, vA, 0.02), P(u + 0.05, vB, 0.02), P(u - 0.05, vB, 0.02)], out: [0, 0, 1], role: 'line' });
      if (R() < 0.55 && vB - vA > 4.6) out.push(...carOf(u + 1.3, (vA + vB) / 2, 'v', CAR_PAINTS[Math.floor(R() * CAR_PAINTS.length)]));
    }
    return { faces: out };
  }
  // a shop: two bins by its back wall, and a car in its yard now and then
  for (const k of [0, 1]) { const u = 0.8 + k * 1.1; if (u + 0.9 < w) out.push(...box(u, v0 + 0.4, u + 0.9, v0 + 1.4, 0, 1.2, 'bin')); }
  if (depth > 6.5 && w > 2.6 && R() < 0.5) out.push(...carOf(w / 2, v0 + Math.min(depth - 2.5, 4.5), 'v', CAR_PAINTS[Math.floor(R() * CAR_PAINTS.length)]));
  return { faces: out };
}

/** A garage over [u0, v0, u1, v1] in its plot's frame: its walls, a gable roof along v, its door to the drive (a
 *  mansion's, at v0) or to the lane behind (a house's off a lane, `door` 'v1'). */
export function garageOf([u0, v0, u1, v1], door = 'v0') {
  const out = box(u0, v0, u1, v1, 0, 2.6, 'garage').slice(1), at = door === 'v1' ? v1 : v0, s = door === 'v1' ? 1 : -1;
  out.push(...gable(u0, v0, u1, v1, 2.6, 1.1, 0.25, 'roof').map((f) => (f.role === 'shed' ? { ...f, role: 'garage' } : f)));
  out.push({ corners: [P(u0 + 0.4, at + s * 0.02, 0.02), P(u1 - 0.4, at + s * 0.02, 0.02), P(u1 - 0.4, at + s * 0.02, 2.3), P(u0 + 0.4, at + s * 0.02, 2.3)], out: [0, s, 0], role: 'door' });
  for (let z = 0.6; z < 2.3; z += 0.55) out.push({ corners: [P(u0 + 0.4, at + s * 0.04, z), P(u1 - 0.4, at + s * 0.04, z), P(u1 - 0.4, at + s * 0.04, z + 0.04), P(u0 + 0.4, at + s * 0.04, z + 0.04)], out: [0, s, 0], role: 'garage' });
  return out;
}
