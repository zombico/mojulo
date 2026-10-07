/**
 * polytope — the solid a block becomes when it is cut. A recorded box (`obox` into a `blockSink`) is a convex
 * polytope; a plane cuts a convex polytope into one convex polytope on each side, so any cut made of planes (a grid,
 * a Voronoi cell, a slice) keeps every piece convex and closed, whatever the item's shape. Only boxes go in; nothing
 * here knows what the item is.
 *
 *   boxPolytope(box)             → { faces: [{ pts, n, src }] }   six faces, outward, with the box's value and part
 *   clip(poly, n, d, cap)        → the part where n·p ≤ d (null if none); the new face is the CAP (`cap` is its src)
 *   volume(poly), centroid(poly), vertices(poly)
 *
 * A face's `src` is what it shows: the box's own skin ({ value, group, part }) or the cut ({ ...value, cut: true },
 * a step darker: the inside). Pure; rounded only where it is read out.
 */

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const V = { add, sub, mul, dot, cross, len, unit };

const EPS = 1e-9;

/** The six faces of a recorded box, each wound counter-clockwise seen from outside. */
export function boxPolytope(b) {
  const A = unit(b.A), B = unit(b.B), C = unit(b.C), [ha, hb, hc] = b.h, src = { value: b.value, group: b.group, part: b.part };
  const faces = [];
  for (const [N, U, W, hn, hu, hw] of [[A, B, C, ha, hb, hc], [B, C, A, hb, hc, ha], [C, A, B, hc, ha, hb]]) {
    for (const s of [1, -1]) {
      const n = mul(N, s), o = add(b.c, mul(n, hn)), u = mul(U, hu), w = mul(W, hw);
      let pts = [sub(sub(o, u), w), sub(add(o, u), w), add(add(o, u), w), add(sub(o, u), w)];
      if (dot(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])), n) < 0) pts = pts.reverse();
      faces.push({ pts, n, src });
    }
  }
  return { faces };
}

/** Every distinct vertex. */
export function vertices(poly) {
  const out = [];
  for (const f of poly.faces) for (const p of f.pts) if (!out.some((q) => len(sub(p, q)) < 1e-7)) out.push(p);
  return out;
}

/** The part of a convex polytope where n·p ≤ d; the cut face is the cap, wearing `cap`. Null when nothing is left. */
export function clip(poly, n, d, cap) {
  const faces = [], onPlane = [];
  let cutAny = false;
  for (const f of poly.faces) {
    const out = [], P = f.pts;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], da = dot(n, a) - d, db = dot(n, b) - d;
      if (da <= EPS) out.push(a);
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const x = add(a, mul(sub(b, a), da / (da - db)));
        out.push(x); onPlane.push(x); cutAny = true;
      } else if (Math.abs(da) <= EPS) onPlane.push(a);
      if (da > EPS) cutAny = true;
    }
    if (out.length >= 3) faces.push({ ...f, pts: out });
  }
  if (!faces.length) return null;
  if (!cutAny) return poly;
  // the cap: the points on the plane, ordered round their centre, wound so the cap faces +n (outward on this side)
  const uniq = [];
  for (const p of onPlane) if (!uniq.some((q) => len(sub(p, q)) < 1e-7)) uniq.push(p);
  if (uniq.length >= 3) {
    const c = mul(uniq.reduce(add, [0, 0, 0]), 1 / uniq.length);
    const e1 = unit(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0])), e2 = cross(n, e1);
    uniq.sort((p, q) => Math.atan2(dot(sub(p, c), e2), dot(sub(p, c), e1)) - Math.atan2(dot(sub(q, c), e2), dot(sub(q, c), e1)));
    faces.push({ pts: uniq, n: [...n], src: cap });
  }
  return { faces };
}

/** Volume by tetrahedra from an inside point. */
export function volume(poly) {
  const o = mul(vertices(poly).reduce(add, [0, 0, 0]), 1 / Math.max(1, vertices(poly).length));
  let v = 0;
  for (const f of poly.faces) for (let i = 1; i < f.pts.length - 1; i++) v += Math.abs(dot(sub(f.pts[0], o), cross(sub(f.pts[i], o), sub(f.pts[i + 1], o)))) / 6;
  return v;
}

/** The centre of mass (uniform density). */
export function centroid(poly) {
  const vs = vertices(poly), o = mul(vs.reduce(add, [0, 0, 0]), 1 / Math.max(1, vs.length));
  let v = 0, c = [0, 0, 0];
  for (const f of poly.faces) for (let i = 1; i < f.pts.length - 1; i++) {
    const a = f.pts[0], b = f.pts[i], e = f.pts[i + 1], tv = Math.abs(dot(sub(a, o), cross(sub(b, o), sub(e, o)))) / 6;
    v += tv; c = add(c, mul(add(add(o, a), add(b, e)), tv / 4));
  }
  return v > 0 ? mul(c, 1 / v) : o;
}
