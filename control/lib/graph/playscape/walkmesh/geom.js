/**
 * Plane geometry the walkmesh needs: in-polygon, distance to an edge, a scanline through a polygon set, and clipping
 * a world polygon to the camera's near side. Pure.
 */
import { NEAR } from './camera.js';

export function inPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function segDist([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** The distance from a point to a polygon's boundary. */
export function edgeDist(p, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

/** Two polygons touch when one holds a vertex of the other or their edges pass within tol. */
export function touches(a, b, tol = 0) {
  if (a.some((p) => inPoly(p, b)) || b.some((p) => inPoly(p, a))) return true;
  return a.some((p) => edgeDist(p, b) <= tol) || b.some((p) => edgeDist(p, a) <= tol);
}

/** The runs [x0, x1] where the line at y crosses the polygons' insides. */
export function scanline(polys, y) {
  const runs = [];
  for (const poly of polys) {
    const xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) runs.push([xs[k], xs[k + 1]]);
  }
  return runs.sort((a, b) => a[0] - b[0]);
}

export const bounds = (pts) => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);

/** A world polygon ([x, y, z] corners) cut to the part in front of the camera's near plane (Sutherland–Hodgman). */
export function clipNear(B, poly) {
  const side = (P) => (P[0] - B.position[0]) * B.forward[0] + (P[1] - B.position[1]) * B.forward[1] + (P[2] - B.position[2]) * B.forward[2] - NEAR * 1.0001;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], sp = side(P), sq = side(Q);
    if (sp >= 0) out.push(P);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([0, 1, 2].map((k) => P[k] + (Q[k] - P[k]) * t)); }
  }
  return out;
}
