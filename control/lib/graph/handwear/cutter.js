// handwear/cutter — the GLOVER'S CUT: a glove's pattern pieces as regions of the hand in its DESIGN COORDINATES (the
// plating library's fitted shell, plating/shell.js: `t` 0 … 1 along a segment, the wrist to the knuckles on the hand, the
// palm's inside to the pad on a digit; `s` round it, 0 the back of the hand (a digit's nail side), + the thumb's side, ±1
// the palm, past ±1 on through it), so one cut fits both hands and any body's hand.
//
//   GLOVE_REGIONS                         the named pieces: { seg, t: [t0, t1], s: [s0, s1] }, `seg` a segment kind,
//                                         or `fingers` (the four), or `digits` (the five)
//   cutPiece(P, S, kind, A, region, opts) a piece cut from the surface `P` (the glove's leather, or the bare skin) on
//                                         side `S`: a thin slab over it, bevelled, `lift` off it, kept to the stretch of
//                                         the segment the surface covers (a fingerless glove's digit)
//
// Pure and deterministic.
import { fairShell, shellPanel, slotOf, circleEdges } from '../plating/shell.js';

/** the GLOVER'S PIECES, by name */
export const GLOVE_REGIONS = Object.freeze({
  back: Object.freeze({ seg: 'hand', t: [0.12, 0.8], s: [-0.42, 0.42] }),
  palm: Object.freeze({ seg: 'hand', t: [0.12, 0.96], s: [0.58, 1.42] }),
  heel: Object.freeze({ seg: 'hand', t: [0.04, 0.42], s: [0.6, 1.4] }),
  knuckles: Object.freeze({ seg: 'hand', t: [0.76, 0.99], s: [-0.55, 0.5] }),
  fingerBacks: Object.freeze({ seg: 'fingers', t: [0.27, 0.99], s: [-0.36, 0.36] }),
  fingerPads: Object.freeze({ seg: 'digits', t: [0.55, 0.99], s: [0.6, 1.4] }),
  thumb: Object.freeze({ seg: 'thumb', t: [0.25, 0.99], s: [-0.95, 0.95] }),
});
export const FINGER_KINDS = Object.freeze(['index', 'middle', 'ring', 'little']);
/** a region's segment kinds */
export const kindsOf = (seg) => (seg === 'fingers' ? FINGER_KINDS : seg === 'digits' ? ['thumb', ...FINGER_KINDS] : [seg]);

const shells = new WeakMap();
/** the surface's fair shell (cached by surface) */
export const shellOf = (P) => { let F = shells.get(P); if (!F) shells.set(P, (F = fairShell(P))); return F; };

/** the stretch of a segment's `t` the surface `P` covers (its stations' `u`, or their index, over the segment's) */
export function extentOf(P, kind, A) {
  const U = P.stations.map((st, i) => st.u ?? i), whole = A.u(kind, 1) || 1;
  return [U[0] / whole, U[U.length - 1] / whole];
}

/** a PIECE cut from `P` on side `S` (see the head of this file): `region` { t, s } or { circle: { t, s, r } }; `lift`,
 * `thick`, `dome` (m) */
export function cutPiece(P, S, kind, A, region, { lift = 0.0012, thick = 0.0015, dome = 0 } = {}) {
  const F = shellOf(P), uOf = (t) => A.u(kind, t), fOf = slotOf(P.slots.length, S), [e0, e1] = extentOf(P, kind, A);
  let t, left, right;
  if (region.circle) ({ t, left, right } = circleEdges(F, uOf, region.circle));
  else { t = region.t; left = [[t[0], region.s[0]], [t[1], region.s[0]]]; right = [[t[0], region.s[1]], [t[1], region.s[1]]]; }
  const t0 = Math.max(t[0], e0 + 0.01), t1 = Math.min(t[1], e1 - 0.01);
  if (t1 - t0 < 0.02) return null;
  // (its columns as many as its width round asks, a band's chords lying on the ring rather than sagging into it)
  const wide = Math.max(...left.map(([, v], i) => Math.abs((right[i]?.[1] ?? right[right.length - 1][1]) - v)));
  return shellPanel(F, { t0, t1, left, right, lift, thick, bevel: Math.min(0.0008, 0.6 * lift), bevelW: 0.004, seam: 0.0008, dome, uOf, fOf, rows: 6, cols: Math.max(9, Math.ceil(wide * 16) + 1) });
}
