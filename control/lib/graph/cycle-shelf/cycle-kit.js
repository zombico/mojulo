/**
 * cycle-kit — the drawing helpers every cycle part builder shares (cycle-parts.js, cycle-families.js): a tube, a lathe
 * whose cross-sections are its profile's own points, a box, a flat panel square to x, a curve and a strip along it (a
 * fender), a pod lofted along the machine (a tank, a tail, a fairing, a scooter's body), a belt round two pulleys.
 * Pure.
 */
import { DEG, add, extrudeWorld, lathe, loftWorld, mul, rect, roundRect, sub, sweep, unit } from './cycle-common.js';
export const tube = (id, pts, r, tint, sides = 8) => sweep(id, pts, r, tint, { sides });
// (a lathe's cross-sections are its profile's own points: a straight one needs two, not the lowerer's default many)
export const spin = (id, from, to, pairs, tint, samples = 20) => lathe(id, from, to, pairs, tint, { samples, crossSections: pairs.length });
/** A box from `from` to `to`, `w` across (u) and `h` up (v, from the hint). */
export const box = (id, from, to, w, h, tint, up = [0, 0, 1]) => extrudeWorld(id, from, to, rect(sub(to, from), w, h, up), tint);
/** A flat panel square to x, its outline [[y, z]…] round its centroid, from x0 to x1. */
export function panel(id, x0, x1, outline, tint) {
  const yc = outline.reduce((s, p) => s + p[0], 0) / outline.length, zc = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  return extrudeWorld(id, [x0, yc, zc], [x1, yc, zc], outline.map(([y, z]) => [0, y - yc, z - zc]), tint);
}
/** A quadratic Bezier through a mount, a crown (its control point) and a tip, sampled at k + 1 points. */
export const curve = (a, c, b, k = 6) => Array.from({ length: k + 1 }, (_, i) => { const t = i / k, u = 1 - t; return add(add(mul(a, u * u), mul(c, 2 * u * t)), mul(b, t * t)); });
/** A thin strip along a path (a fender), each span a flat slab overlapping the next, its edges turned down by `skirt`
 *  (a U section: the fender's sides, what reads of it from the side). */
export function strip(id, pts, w, thick, tint, { taper = 0.7, skirt = 0 } = {}) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = unit(sub(pts[i + 1], pts[i])), from = sub(pts[i], mul(d, i ? 0.008 : 0)), to = add(pts[i + 1], mul(d, i + 2 < pts.length ? 0.008 : 0));
    const f = i / (pts.length - 2 || 1), wi = w * (1 - (1 - taper) * Math.abs(2 * f - 1) ** 2), ax = sub(to, from);
    out.push(extrudeWorld(`${id}_${i}`, from, to, rect(ax, wi, thick, [0, 0, 1]), tint));
    if (skirt) for (const s of [1, -1]) {
      const k = skirt;
      out.push(extrudeWorld(`${id}_${i}_${s > 0 ? 'r' : 'l'}`, from, to, rect(ax, thick, k, [0, 0, 1]).map((p) => add(p, [s * (wi / 2 - thick / 2), 0, -k / 2 + thick / 2])), tint));
    }
  }
  return out;
}
export const axleOf = (G, slot) => (slot === 'front' ? G.frontAxle : G.rearAxle);
export const need = (G, key) => { if (!G[key]) throw new Error(`cycle part: the chassis card has no '${key}'`); return G[key]; };

/** A belt round two pulleys in the plane square to x: the closed loop (its first point repeated last). */
export function beltLoop(x, c1, r1, c2, r2, step = 8 * DEG) {
  // c1 the small (front) pulley, c2 the large (rear); e from c2 to c1
  const D = Math.hypot(c1[0] - c2[0], c1[1] - c2[1]), phi = Math.atan2(c1[1] - c2[1], c1[0] - c2[0]), beta = Math.asin((r2 - r1) / D);
  const aU = phi + (Math.PI / 2 - beta), aL = phi - (Math.PI / 2 - beta), P = (c, r, t) => [x, c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
  const out = [];
  const arc = (c, r, a0, a1) => { const k = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step)); for (let i = 0; i <= k; i++) out.push(P(c, r, a0 + ((a1 - a0) * i) / k)); };
  arc(c1, r1, aU, aL);
  arc(c2, r2, aL, aU - 2 * Math.PI);
  out.push([...out[0]]);
  return out;
}

/**
 * A pod lofted along the machine's length (+y): its stations [{ y, z, w, h, r? }] each a rounded rectangle `w` across
 * and `h` high, centred at height `z` (a tank's teardrop, a tail, a fairing's nose, a scooter's body). Stations in order
 * of y, two at least.
 */
export function pod(id, stations, tint, { x = 0, k = 3 } = {}) {
  const y0 = stations[0].y, y1 = stations[stations.length - 1].y, ax = [0, 1, 0], z0 = stations[0].z;
  return loftWorld(id, [x, y0, z0], [x, y1, z0], stations.map((s) => ({ t: (s.y - y0) / (y1 - y0), points: roundRect(ax, s.w, s.h, s.r ?? Math.min(s.w, s.h) * 0.35, k).map((p) => add(p, [0, 0, s.z - z0])) })), tint);
}

/** A flat slab square to x from x0 to x1, its outline [[y, z]…] (a leg shield, a floorboard seen from the side). */
export const slab = (id, x0, x1, outline, tint) => panel(id, x0, x1, outline, tint);

/** Resolve a card's point: an [x, y, z] as written, or a named point of the solve ('head.lo', 'head.hi', 'pivot', 'bb',
 *  'axle.front', 'axle.rear'), optionally mirrored to the left. */
export function at(G, p, side) {
  let v;
  if (typeof p === 'string') {
    v = { 'head.lo': G.head.lo, 'head.hi': G.head.hi, pivot: G.pivot, bb: G.bb, 'axle.front': G.frontAxle, 'axle.rear': G.rearAxle }[p];
    if (!v) throw new Error(`cycle card: no named point '${p}'`);
  } else v = p;
  return side === 'l' ? [-v[0], v[1], v[2]] : [...v];
}

export { DEG, rect, unit };
