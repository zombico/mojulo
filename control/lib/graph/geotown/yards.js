/**
 * THE BACK YARDS — an evoked block's yards, each designed on its own: a PROGRAM (what the household does there) built
 * on the yard's level pad, and the FENCES between yards. In the plot's frame (metres: u along its frontage from 0 to its
 * width, v into it from its front line, z up from its pad), so the scene seats it as it seats the plot.
 *
 *   YARDS        { <program>: { read, trees } }: lawn, garden, patio, deck, shed, play; `trees` the most it keeps
 *   FENCES       { <fence>: { read, h, t, role } }: board, picket, hedge
 *   yardOf(program, { w, v0, v1, R }) → { faces: [{ corners, out, role }], trees: [{ u, v }] }
 *       the yard from the house's back wall (v0) to the plot's back line (v1); R its dice; each tree where the program
 *       leaves open ground
 *   fenceOf(fence, [u0, v0], [u1, v1], z0) → the fence's faces along a line (a thin box, or a hedge's thick one)
 *
 * `role` says how the scene paints a face: timber, deck, paving, soil, leaf, sand, shed, roof, door, canvas, metal, gravel.
 * Pure: the dice are the caller's.
 */
import { box } from './fronts.js';

export const YARDS = Object.freeze({
  lawn: Object.freeze({ read: 'a lawn, and a tree or two over it', trees: 2 }),
  garden: Object.freeze({ read: 'raised beds in rows across the yard, things growing in them', trees: 1 }),
  patio: Object.freeze({ read: 'a paved patio off the back door, a table, its chairs and a parasol', trees: 1 }),
  deck: Object.freeze({ read: 'a timber deck off the back door, its rail and its steps down to the lawn', trees: 1 }),
  shed: Object.freeze({ read: 'a garden shed at the back, gravel before it', trees: 1 }),
  play: Object.freeze({ read: 'a sandbox and a swing', trees: 1 }),
});
export const YARD_IDS = Object.freeze(Object.keys(YARDS));
export const FENCES = Object.freeze({
  board: Object.freeze({ read: 'a board fence, head high', h: 1.8, t: 0.05, role: 'timber' }),
  picket: Object.freeze({ read: 'a painted picket fence, waist high', h: 1.1, t: 0.06, role: 'picket' }),
  hedge: Object.freeze({ read: 'a clipped hedge', h: 1.5, t: 0.7, role: 'leaf' }),
});
export const FENCE_IDS = Object.freeze(Object.keys(FENCES));

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const P = (x, y, z) => [r4(x), r4(y), r4(z)];
const roll = (R, lo, hi) => lo + (hi - lo) * R();

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

/** A back yard's program, built. */
export function yardOf(program, { w, v0, v1, R }) {
  const out = [], trees = [], depth = v1 - v0, inset = 0.6;
  // a tree where the program leaves open ground: in the yard's back half, clear of its sides
  const tree = (vLo = v0 + depth * 0.55, vHi = v1 - 1.8) => { if (vHi - vLo > 0.5 && w > 3) trees.push({ u: r4(roll(R, 1.4, w - 1.4)), v: r4(roll(R, vLo, vHi)) }); };
  if (program === 'garden') {
    // beds in rows across the yard, a path between them, things growing in each
    const n = Math.max(1, Math.min(4, Math.floor((depth * 0.55) / 1.8))), vS = v0 + 2.2;
    for (let i = 0; i < n; i++) {
      const a = vS + i * 1.8, u0 = inset + 0.3, u1 = w - inset - 0.3;
      if (a + 1 > v1 - 1) break;
      out.push(...box(u0, a, u1, a + 1, 0, 0.3, 'timber'));
      out.push({ corners: [P(u0 + 0.05, a + 0.05, 0.31), P(u1 - 0.05, a + 0.05, 0.31), P(u1 - 0.05, a + 0.95, 0.31), P(u0 + 0.05, a + 0.95, 0.31)], out: [0, 0, 1], role: 'soil' });
      for (let u = u0 + 0.4; u < u1 - 0.3; u += 0.7 + 0.4 * R()) { const s = 0.25 + 0.25 * R(); out.push(...box(u - s / 2, a + 0.5 - s / 2, u + s / 2, a + 0.5 + s / 2, 0.31, 0.31 + s * (0.8 + R()), 'leaf')); }
    }
    if (R() < 0.6) tree(v1 - 3, v1 - 1.5);
  } else if (program === 'patio') {
    // flags off the back door, a table, its chairs, a parasol over it
    const pv = Math.min(3.6, depth * 0.4), u0 = inset, u1 = w - inset, cu = (u0 + u1) / 2, cv = v0 + pv / 2 + 0.2;
    out.push({ corners: [P(u0, v0, 0.03), P(u1, v0, 0.03), P(u1, v0 + pv, 0.03), P(u0, v0 + pv, 0.03)], out: [0, 0, 1], role: 'paving' });
    out.push(...box(cu - 0.6, cv - 0.4, cu + 0.6, cv + 0.4, 0.7, 0.76, 'timber'), ...box(cu - 0.04, cv - 0.04, cu + 0.04, cv + 0.04, 0.03, 0.7, 'metal'));
    for (const [du, dv] of [[-0.95, 0], [0.95, 0], [0, -0.75], [0, 0.75]]) out.push(...box(cu + du - 0.22, cv + dv - 0.22, cu + du + 0.22, cv + dv + 0.22, 0.03, 0.45, 'timber'));
    const ph = 2.3, pr = 1.1;
    out.push(...box(cu - 0.025, cv - 0.025, cu + 0.025, cv + 0.025, 0.76, ph, 'metal'));
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) out.push({ corners: [P(cu + a[0] * pr, cv + a[1] * pr, ph - 0.35), P(cu + b[0] * pr, cv + b[1] * pr, ph - 0.35), P(cu, cv, ph)], out: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1], role: 'canvas' });
    tree();
  } else if (program === 'deck') {
    // a deck at the back door's height, its rail, its steps down at its middle
    const dv = Math.min(3.4, depth * 0.4), u0 = inset * 0.5, u1 = w - inset * 0.5, z = 0.6, cu = (u0 + u1) / 2;
    out.push(...box(u0, v0, u1, v0 + dv, 0, z, 'deck'));
    for (const [a, b] of [[[u0, v0 + dv], [cu - 0.6, v0 + dv]], [[cu + 0.6, v0 + dv], [u1, v0 + dv]], [[u0, v0], [u0, v0 + dv]], [[u1, v0], [u1, v0 + dv]]]) {
      const along = a[1] === b[1];
      out.push(...(along ? box(Math.min(a[0], b[0]), a[1] - 0.04, Math.max(a[0], b[0]), a[1] + 0.04, z + 0.85, z + 0.95, 'timber') : box(a[0] - 0.04, Math.min(a[1], b[1]), a[0] + 0.04, Math.max(a[1], b[1]), z + 0.85, z + 0.95, 'timber')));
      for (const p of [a, b]) out.push(...box(p[0] - 0.05, p[1] - 0.05, p[0] + 0.05, p[1] + 0.05, z, z + 0.95, 'timber'));
    }
    for (let k = 0; k < 3; k++) out.push(...box(cu - 0.55, v0 + dv + k * 0.28, cu + 0.55, v0 + dv + (k + 1) * 0.28, 0, z - (k + 1) * 0.2, 'deck'));
    tree();
  } else if (program === 'shed') {
    // a shed in a back corner, its door to the house, gravel before it
    const sw = Math.min(2.4, w - 1.2), sd = 2.8, left = R() < 0.5, u0 = left ? 0.5 : w - 0.5 - sw, vB = v1 - 0.5 - sd;
    if (sw > 1.2 && vB > v0 + 2) {
      out.push({ corners: [P(u0 - 0.4, vB - 1.4, 0.02), P(u0 + sw + 0.4, vB - 1.4, 0.02), P(u0 + sw + 0.4, vB, 0.02), P(u0 - 0.4, vB, 0.02)], out: [0, 0, 1], role: 'gravel' });
      out.push(...box(u0, vB, u0 + sw, vB + sd, 0, 2.1, 'shed').slice(1), ...gable(u0, vB, u0 + sw, vB + sd, 2.1, 0.7, 0.15, 'roof'));
      out.push({ corners: [P(u0 + sw / 2 - 0.45, vB - 0.02, 0.05), P(u0 + sw / 2 + 0.45, vB - 0.02, 0.05), P(u0 + sw / 2 + 0.45, vB - 0.02, 1.95), P(u0 + sw / 2 - 0.45, vB - 0.02, 1.95)], out: [0, -1, 0], role: 'door' });
      // the tree in the other back corner
      trees.push({ u: r4(left ? Math.max(u0 + sw + 1.2, w - 1.6) : Math.min(1.6, u0 - 1.2)), v: r4(v1 - 2) });
    } else tree();
  } else if (program === 'play') {
    // a sandbox, and a swing on its A-frames
    const cu = w / 2, sv = v0 + Math.min(3, depth * 0.3);
    out.push(...box(cu - 0.9, sv, cu + 0.9, sv + 1.8, 0, 0.28, 'timber'));
    out.push({ corners: [P(cu - 0.8, sv + 0.1, 0.22), P(cu + 0.8, sv + 0.1, 0.22), P(cu + 0.8, sv + 1.7, 0.22), P(cu - 0.8, sv + 1.7, 0.22)], out: [0, 0, 1], role: 'sand' });
    const qv = Math.min(v1 - 2.2, sv + 4.2), span = Math.min(2.6, w - 1.6), a = cu - span / 2, b = cu + span / 2, top = 2.3;
    for (const u of [a, b]) for (const dv of [-0.7, 0.7]) out.push({ corners: [P(u - 0.05, qv + dv, 0), P(u + 0.05, qv + dv, 0), P(u + 0.05, qv, top), P(u - 0.05, qv, top)], out: [0, Math.sign(dv), 0.3], role: 'metal' });
    out.push(...box(a, qv - 0.05, b, qv + 0.05, top - 0.1, top, 'metal'));
    for (const u of [cu - span / 4, cu + span / 4]) {
      out.push(...box(u - 0.25, qv - 0.12, u + 0.25, qv + 0.12, 0.45, 0.5, 'timber'));
      for (const du of [-0.22, 0.22]) out.push(...box(u + du - 0.01, qv - 0.01, u + du + 0.01, qv + 0.01, 0.5, top - 0.1, 'metal').slice(1));
    }
    tree(qv + 1.5, v1 - 1.5);
  } else {
    // a lawn: its trees and nothing else
    tree(v0 + depth * 0.35, v1 - 1.8);
    if (R() < 0.7) tree();
  }
  return { faces: out, trees };
}

/** A fence along a line in the plot's frame, standing on `z0`. */
export function fenceOf(fence, [u0, v0], [u1, v1], z0 = 0) {
  const F = FENCES[fence], t = F.t / 2;
  return box(Math.min(u0, u1) - (u0 === u1 ? t : 0), Math.min(v0, v1) - (v0 === v1 ? t : 0), Math.max(u0, u1) + (u0 === u1 ? t : 0), Math.max(v0, v1) + (v0 === v1 ? t : 0), z0, z0 + F.h, F.role);
}
