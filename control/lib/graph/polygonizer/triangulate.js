/**
 * triangulate — ear-clipping triangulation of contour SETS with holes.
 *
 * The carve-solid kernel describes a cap (the flat top/bottom of an extruded
 * outline) as a set of closed [x,y] rings drawn evenodd: an outer ring plus
 * inner counter rings (the hole in an 'O', 'A', 'e' …). An SVG renderer fills
 * that with `fill-rule="evenodd"` for free. A 3D face list cannot — the World
 * renderers (CSS-3D / three.js) consume flat triangle/quad faces, so a cap with
 * holes must be tessellated into triangles first.
 *
 * `triangulateRings(rings)` classifies rings by even/odd nesting depth (even =
 * solid, odd = hole — the evenodd rule), bridges each hole into its containing
 * outer (Eberly's max-x bridge), then ear-clips the resulting simple polygon.
 * Output: a flat array of triangles `[[x,y],[x,y],[x,y]]`. Pure 2D; the caller
 * lifts each vertex to its cap plane (z) and into world.
 */

const EPS = 1e-9;

const signedArea = (r) => { let s = 0; for (let i = 0; i < r.length; i += 1) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Even-odd ray-cast point-in-ring (ring is a closed loop of [x,y]). */
function pointInRing(p, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi || EPS) + xi)) inside = !inside;
  }
  return inside;
}

/** Strict-interior point-in-triangle (boundary points excluded). */
function pointInTriangle(p, a, b, c) {
  const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
  const hasNeg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
  const hasPos = d1 > EPS || d2 > EPS || d3 > EPS;
  return !(hasNeg && hasPos) && Math.abs(d1) > EPS && Math.abs(d2) > EPS && Math.abs(d3) > EPS;
}

/** Drop consecutive-duplicate and closing-duplicate vertices. */
function cleanRing(r) {
  const out = [];
  for (const p of r) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > EPS) out.push([p[0], p[1]]); }
  if (out.length > 1) { const a = out[0], b = out[out.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS) out.pop(); }
  return out;
}

// Group rings into { outer, holes } sets by even/odd containment depth.
function groupRings(rings) {
  const clean = rings.map(cleanRing).filter((r) => r.length >= 3 && Math.abs(signedArea(r)) > EPS);
  const depth = clean.map((r, i) => { let d = 0; for (let k = 0; k < clean.length; k += 1) if (k !== i && pointInRing(r[0], clean[k])) d += 1; return d; });
  const groups = [];
  clean.forEach((r, i) => { if (depth[i] % 2 === 0) groups.push({ outer: r, oi: i, holes: [] }); });
  clean.forEach((r, i) => {
    if (depth[i] % 2 === 0) return;
    let best = -1, bestD = -1;
    groups.forEach((g, gi) => { if (depth[g.oi] === depth[i] - 1 && pointInRing(r[0], g.outer) && depth[g.oi] > bestD) { bestD = depth[g.oi]; best = gi; } });
    if (best >= 0) groups[best].holes.push(r);
  });
  return groups;
}

// Splice one CW hole into a CCW outer via a bridge from the hole's max-x vertex.
function bridgeHole(outer, hole) {
  let mi = 0; for (let i = 1; i < hole.length; i += 1) if (hole[i][0] > hole[mi][0]) mi = i;
  const M = hole[mi];
  // Closest intersection with an outer edge on the ray M → +x.
  let bestX = Infinity, bestEdge = null;
  for (let i = 0; i < outer.length; i += 1) {
    const A = outer[i], B = outer[(i + 1) % outer.length];
    if ((A[1] > M[1]) === (B[1] > M[1])) continue;            // edge must straddle y = M.y
    const t = (M[1] - A[1]) / (B[1] - A[1]);
    const x = A[0] + t * (B[0] - A[0]);
    if (x < M[0] - EPS) continue;                              // to the right of M
    if (x < bestX) { bestX = x; bestEdge = [i, (i + 1) % outer.length]; }
  }
  if (!bestEdge) return null;
  const I = [bestX, M[1]];
  // Candidate bridge vertex: the edge endpoint with larger x …
  let P = outer[bestEdge[0]][0] > outer[bestEdge[1]][0] ? bestEdge[0] : bestEdge[1];
  // … unless a reflex vertex falls inside triangle (M, I, P) — then take the one closest in angle to +x.
  let bestAng = Infinity;
  for (let i = 0; i < outer.length; i += 1) {
    if (i === P) continue;
    if (pointInTriangle(outer[i], M, I, outer[P])) {
      const ang = Math.abs(Math.atan2(outer[i][1] - M[1], outer[i][0] - M[0]));
      if (ang < bestAng) { bestAng = ang; P = i; }
    }
  }
  // Splice: outer[0..P], M, hole-loop from mi back to mi, M, outer[P], outer[P+1..].
  const res = [];
  for (let i = 0; i <= P; i += 1) res.push(outer[i]);
  for (let k = 0; k < hole.length; k += 1) res.push(hole[(mi + k) % hole.length]);
  res.push([M[0], M[1]]);
  res.push(outer[P]);
  for (let i = P + 1; i < outer.length; i += 1) res.push(outer[i]);
  return res;
}

// Ear-clip a simple polygon (no holes) → triangles. Polygon may wind either way.
function earClip(poly) {
  const V = poly.map((_, i) => i);
  if (signedArea(poly) < 0) V.reverse();
  const tris = [];
  let guard = poly.length * poly.length + 16;
  while (V.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < V.length; i += 1) {
      const a = poly[V[(i - 1 + V.length) % V.length]], b = poly[V[i]], c = poly[V[(i + 1) % V.length]];
      if (cross(a, b, c) <= EPS) continue;                     // reflex / straight — not an ear (CCW)
      let ok = true;
      for (let k = 0; k < V.length; k += 1) { const vi = V[k]; if (poly[vi] === a || poly[vi] === b || poly[vi] === c) continue; if (pointInTriangle(poly[vi], a, b, c)) { ok = false; break; } }
      if (!ok) continue;
      tris.push([a, b, c]); V.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (V.length === 3) tris.push([poly[V[0]], poly[V[1]], poly[V[2]]]);
  return tris;
}

/**
 * Triangulate a set of evenodd rings → flat array of triangles [[x,y]×3].
 * Outer rings are normalized CCW, holes CW, then bridged + ear-clipped.
 */
export function triangulateRings(rings) {
  const out = [];
  for (const g of groupRings(rings)) {
    let outer = signedArea(g.outer) < 0 ? g.outer.slice().reverse() : g.outer.slice();
    const holes = g.holes.map((h) => (signedArea(h) > 0 ? h.slice().reverse() : h.slice()))
      .sort((a, b) => Math.max(...b.map((p) => p[0])) - Math.max(...a.map((p) => p[0])));
    for (const h of holes) { const merged = bridgeHole(outer, h); if (merged) outer = merged; }
    out.push(...earClip(outer));
  }
  return out;
}

export { signedArea };
