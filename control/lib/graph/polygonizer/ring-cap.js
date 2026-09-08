/**
 * ring-cap — triangulating a closed profile ring for an end cap.
 *
 * The extrude and loft caps were a fan from the ring's CENTROID, which is only right when the
 * centroid can see every edge (a convex or star-shaped ring). A C-shaped clamp profile has its
 * centroid in the open slot: the fan crossed the void, the caps overlapped, the web tier drew a
 * wedge where the slot should be, and Manifold called the shell NotManifold (print-loop demo,
 * 2026-09-08). The rule now: a CONVEX ring keeps the fan (byte-identical for every existing
 * rect / rounded-rect / circle / convex points profile); a concave ring is ear-clipped.
 *
 * Pure, deterministic, index-level: callers map indices onto their own ring frames.
 */

const EPS = 1e-9;

const cross2 = (ax, ay, bx, by) => ax * by - ay * bx;

/** Signed area of a ring of { u, v } (CCW ⇒ > 0). */
export function ringSignedArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p.u * q.v - q.u * p.v;
  }
  return a / 2;
}

/**
 * isConvexRing(ring) → true when every turn has the same sign (collinear runs allowed). Either
 * winding. Fewer than four points is convex by construction.
 */
export function isConvexRing(ring) {
  const n = ring.length;
  if (n < 4) return true;
  let sign = 0;
  for (let i = 0; i < n; i += 1) {
    const a = ring[i], b = ring[(i + 1) % n], c = ring[(i + 2) % n];
    const z = cross2(b.u - a.u, b.v - a.v, c.u - b.u, c.v - b.v);
    if (Math.abs(z) <= EPS) continue;
    const s = z > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

const pointInTri = (p, a, b, c) => {
  // strictly inside or on the boundary of CCW triangle abc
  const d1 = cross2(b.u - a.u, b.v - a.v, p.u - a.u, p.v - a.v);
  const d2 = cross2(c.u - b.u, c.v - b.v, p.u - b.u, p.v - b.v);
  const d3 = cross2(a.u - c.u, a.v - c.v, p.u - c.u, p.v - c.v);
  return d1 >= -EPS && d2 >= -EPS && d3 >= -EPS;
};

/**
 * earClipRing(ring) → [[i, j, k], …] index triangles over a simple polygon of { u, v }, wound
 * the same way as the ring (CCW ring ⇒ CCW triangles). Degenerate (collinear) ears are dropped
 * without emitting; if no ear can be found (a self-intersecting ring), the remainder is fanned
 * so the cap is never missing — a bad ring still gets a lid.
 */
export function earClipRing(ring) {
  const n = ring.length;
  if (n < 3) return [];
  const ccw = ringSignedArea(ring) >= 0;
  const idx = [];
  for (let i = 0; i < n; i += 1) idx.push(ccw ? i : n - 1 - i);
  const P = (i) => ring[i];
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard < n * n) {
    guard += 1;
    let clipped = false;
    for (let t = 0; t < idx.length; t += 1) {
      const ia = idx[(t - 1 + idx.length) % idx.length], ib = idx[t], ic = idx[(t + 1) % idx.length];
      const a = P(ia), b = P(ib), c = P(ic);
      const z = cross2(b.u - a.u, b.v - a.v, c.u - b.u, c.v - b.v);
      if (Math.abs(z) <= EPS) { idx.splice(t, 1); clipped = true; break; }   // collinear: drop, no face
      if (z < 0) continue;                                                     // reflex vertex: not an ear
      let blocked = false;
      for (const io of idx) {
        if (io === ia || io === ib || io === ic) continue;
        const o = P(io);
        if ((o.u === a.u && o.v === a.v) || (o.u === b.u && o.v === b.v) || (o.u === c.u && o.v === c.v)) continue;
        if (pointInTri(o, a, b, c)) { blocked = true; break; }
      }
      if (blocked) continue;
      tris.push([ia, ib, ic]); idx.splice(t, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  else if (idx.length > 3) for (let t = 1; t + 1 < idx.length; t += 1) tris.push([idx[0], idx[t], idx[t + 1]]);
  // A CW ring was clipped on its reversal; hand back triangles in the ring's own winding.
  return ccw ? tris : tris.map(([i, j, k]) => [k, j, i]);
}
