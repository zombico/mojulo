/**
 * CARVE — an opening cut into a wall (era/laws.js 'openings-have-depth'). A wall is laid as flat rectangles; a niche
 * drawn on it is a dark panel and reads flat. Here the wall's faces are cut round a hole, so what is built behind the
 * hole (its back, its floor, its head, its sides: era/crypt.js) is seen through it and lit as it stands.
 *
 *   hole          { F, poly }: the wall's frame (o, U, N) and a CONVEX outline in the wall's own (u, z), counter-clockwise
 *   carveFaces(faces, holes, { groups }) → faces: every face of `groups` that lies in a hole's wall plane and crosses
 *                 the hole is replaced by the pieces of it outside the hole (each convex, three or four corners), its
 *                 texture carried across by the face's own mapping; every other face is returned as it was
 *
 * Pure. No holes: the same array back, so a kit that carves nothing changes by nothing.
 */
import { P, r5 } from './geom.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const EPS = 1e-6;

// a polygon cut by the line a→b: the part on its left (`keep` 1) or its right (−1)
function clip(poly, a, b, keep) {
  const side = (p) => keep * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])), out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp >= -EPS) out.push(p);
    if ((sp > EPS && sq < -EPS) || (sp < -EPS && sq > EPS)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
const area = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; };

export function carveFaces(faces, holes, { groups = ['stage:wall'] } = {}) {
  if (!holes || !holes.length) return faces;
  const G = new Set(groups), out = [];
  const H = holes.map((h) => ({ ...h, u0: Math.min(...h.poly.map((p) => p[0])), u1: Math.max(...h.poly.map((p) => p[0])), z0: Math.min(...h.poly.map((p) => p[1])), z1: Math.max(...h.poly.map((p) => p[1])) }));
  for (const f of faces) {
    if (!G.has(f.group) || !f.normal) { out.push(f); continue; }
    let pieces = null, frame = null;
    for (const h of H) {
      const F = h.F;
      if (Math.abs(dot(f.normal, F.N) - 1) > 1e-3) continue;
      const rel = f.corners.map((c) => [c[0] - F.o[0], c[1] - F.o[1], c[2]]);
      if (rel.some((c) => Math.abs(c[0] * F.N[0] + c[1] * F.N[1]) > 2e-3)) continue;
      const poly = rel.map((c) => [c[0] * F.U[0] + c[1] * F.U[1], c[2]]);
      if (Math.max(...poly.map((p) => p[0])) <= h.u0 + EPS || Math.min(...poly.map((p) => p[0])) >= h.u1 - EPS || Math.max(...poly.map((p) => p[1])) <= h.z0 + EPS || Math.min(...poly.map((p) => p[1])) >= h.z1 - EPS) continue;
      frame = frame || { F, poly };
      if (frame.F !== F) continue;
      // (the face less a convex hole: for each of the hole's edges, what lies outside it and inside the edges before)
      const next = [];
      for (let rem of pieces || [poly]) {
        for (let i = 0; i < h.poly.length && rem.length >= 3; i++) {
          const a = h.poly[i], b = h.poly[(i + 1) % h.poly.length], outside = clip(rem, a, b, -1);
          if (outside.length >= 3 && area(outside) > 1e-7) next.push(outside);
          rem = clip(rem, a, b, 1);
        }
      }
      pieces = next;
    }
    if (!pieces) { out.push(f); continue; }
    // the face's own mapping, (u, z) → uv: affine, from three of its corners
    const F = frame.F, p0 = frame.poly[0], p1 = frame.poly[1], p2 = frame.poly[frame.poly.length - 1];
    const e1 = [p1[0] - p0[0], p1[1] - p0[1]], e2 = [p2[0] - p0[0], p2[1] - p0[1]], det = e1[0] * e2[1] - e1[1] * e2[0];
    const uvAt = f.uv && Math.abs(det) > 1e-12 ? (p) => { const d = [p[0] - p0[0], p[1] - p0[1]], s = (d[0] * e2[1] - d[1] * e2[0]) / det, t = (e1[0] * d[1] - e1[1] * d[0]) / det, n = f.uv.length - 1;
      return [r5(f.uv[0][0] + (f.uv[1][0] - f.uv[0][0]) * s + (f.uv[n][0] - f.uv[0][0]) * t), r5(f.uv[0][1] + (f.uv[1][1] - f.uv[0][1]) * s + (f.uv[n][1] - f.uv[0][1]) * t)]; } : null;
    const off = dot([f.corners[0][0] - F.o[0], f.corners[0][1] - F.o[1], 0], F.N);
    const world = (p) => P([F.o[0] + F.U[0] * p[0] + F.N[0] * off, F.o[1] + F.U[1] * p[0] + F.N[1] * off, p[1]]);
    for (const poly of pieces) for (let i = 1; i + 1 < poly.length; i += 2) {
      const part = [poly[0], poly[i], poly[i + 1], ...(i + 2 < poly.length ? [poly[i + 2]] : [])];
      out.push({ ...f, corners: part.map(world), ...(uvAt ? { uv: part.map(uvAt) } : {}) });
    }
  }
  return out;
}
