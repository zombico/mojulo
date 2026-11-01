/**
 * SHIRT COLLAR — a top's collar as one construction on either body, from its STAND (the band that rises from the
 * neckline, a closed ring piece: body-relational-tailor.js collarOn on the realistic body, authored-jacket.js standCollar
 * on the game body):
 *
 *   band     the stand alone: the V that goes up. OPEN, its front parted, the V widening up it; CLOSED, a ring
 *   turtle   the stand looped all round and tall, its top folded down over it (a turtleneck's roll); open, parted
 *   shirt    the stand and its FALL, a leaf folded down over it from its top, deepest at the front where its two points
 *            hang: from the front the fall's edges run out and down from the middle to the points and back up round the
 *            neck, an M. CLOSED, buttoned up, the stand a ring and the points nearly meeting under it; OPEN, the stand
 *            parted in its V and the points spread
 *
 *   collarSpec, collarRun, COLLAR, COLLAR_KINDS   the words and the measures (outfit/collar.js, re-exported)
 *   shapeCollar(stand, spec) → { stand, fall? }   the stand parted where it is open (openFront: two real edges), and the
 *                      fall made over it (a ring piece hung from its top, opened at the front where the kind parts it),
 *                      its points carried by the stand's top ring's weights
 *
 * The front is +y; the stand's slot 0 its front. Pure and deterministic.
 */
import { openFront, JACKET } from './body-relational-jacket.js';
import { COLLAR } from '../outfit/collar.js';

export { COLLAR, COLLAR_KINDS, collarSpec, collarRun } from '../outfit/collar.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/**
 * The FALL over a stand `S` (closed, its rings bottom to top): three rings hung from its top ring, listed from its edge up
 * to its middle and its fold just out over the stand's top; each point out along its ring's own direction and down by the drop at its turn (`drop(f)`, f
 * its frontness, 1 at the front), out by `out(f)`; each point carried by the stand's top ring's weights at its slot.
 */
function fallOver(S, { drop, out }) {
  const top = S.stations[S.stations.length - 1], low = S.stations[0], c = mean(Object.values(top.points)), c0 = mean(Object.values(low.points));
  const up = (() => { const d = [c[0] - c0[0], c[1] - c0[1], c[2] - c0[2]], l = Math.hypot(...d) || 1; return d.map((v) => v / l); })();
  const ring = (k, share) => Object.fromEntries(S.slots.map((sl) => {
    const p = top.points[sl], h = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...h) || 1, d = [h[0] / l, h[1] / l, 0], f = Math.max(0, d[1]);
    const o = COLLAR.fall.fold + (out(f) - COLLAR.fall.fold) * share, z = -drop(f) * share + (k === 0 ? 0.0015 : 0);
    return [sl, [p[0] + d[0] * o + up[0] * z, p[1] + d[1] * o + up[1] * z, p[2] + up[2] * z].map(r6)];
  }));
  // (its rings from its edge up to its fold, the stand's way: the compiler turns a piece out by the run of its rings)
  const stations = [{ id: 'st0', u: 0, points: ring(2, 1) }, { id: 'st1', u: 1, points: ring(1, 0.55) }, { id: 'st2', u: 2, points: ring(0, 0) }];
  const blend = {}, own = { [S.bind?.bone ?? 'neck']: 1 };
  for (const st of stations) for (const sl of S.slots) blend[`${st.id}.${sl}`] = S.bind?.blend?.[`${top.id}.${sl}`] ?? S.bind?.blend?.[top.id] ?? own;
  blend.back = S.bind?.blend?.tip ?? own; blend.tip = blend.back;
  const zs = stations.map((st) => mean(Object.values(st.points)));
  return { layer: 1, closure: 'closed', slots: S.slots, stations, caps: { back: zs[0].map(r6), tip: zs[2].map(r6) }, bind: { bone: S.bind?.bone ?? 'neck', blend } };
}

/** The collar shaped by its kind and its front (see the head of the file). `stand` a closed ring piece, slot 0 its front. */
export function shapeCollar(stand, spec) {
  if (!spec || !stand?.stations?.length) return { stand };
  const n = stand.slots.length, arc = Math.max(6, Math.round(n / 2));
  const zs = stand.stations.map((st) => mean(Object.values(st.points))[2]), zb = Math.min(...zs), zt = Math.max(...zs), hgt = Math.max(1e-6, zt - zb);
  // THE FALL first, over the stand as it stands closed (a parted stand is a shell of two faces: the fall hangs off its
  // outer one)
  let fall = null;
  if (spec.kind === 'shirt') {
    const F = COLLAR.fall;
    fall = fallOver(stand, { drop: (f) => F.back + (F.points - F.back) * smooth(f) ** 2, out: (f) => F.out * (1 + 0.6 * smooth(f)) });
  } else if (spec.kind === 'turtle') {
    const d = COLLAR.turtle.fold * hgt;
    fall = fallOver(stand, { drop: () => d, out: () => COLLAR.fall.out * 0.6 });
  }
  // (the fall parted at the front: a shirt's always, its points apart by the spread at its edge, meeting near the middle
  // at its fold; the M. A turtleneck's only open)
  if (fall && (spec.kind === 'shirt' || spec.open)) {
    const fz = fall.stations.map((st) => mean(Object.values(st.points))[2]), zf = Math.max(...fz), ze = Math.min(...fz), span = Math.max(1e-6, zf - ze);
    const g0 = spec.open ? COLLAR.v.top : JACKET.zipGap, g1 = g0 + (spec.open ? COLLAR.fall.spread.open : COLLAR.fall.spread.closed);
    fall = openFront(fall, { gap: (z) => g0 + (g1 - g0) * Math.max(0, Math.min(1, (zf - z) / span)), arc });
  }
  // THE STAND parted in its V where the front is open, the V widening up it
  const S = spec.open ? openFront(stand, { gap: (z) => COLLAR.v.foot + (COLLAR.v.top - COLLAR.v.foot) * Math.max(0, Math.min(1, (z - zb) / hgt)), arc }) : stand;
  return { stand: S, ...(fall ? { fall } : {}) };
}
