/**
 * bake-prep — face-list preparation for a per-vertex GI bake (scripts/bake-world-gi.mjs).
 *
 * A Cycles bake lands per VERTEX (COLOR_0), so a room-sized floor quad takes only its
 * four corners' light — and in a floorplan those corners sit ON the wall planes, where
 * a sample is self-occluded: the whole floor interpolated black while the walls (whose
 * top verts see the sky) looked fine. The floorplan finding of room-realism phase 3.
 *
 *   tessellateForBake — split large plain (and textured — uvs interpolated) quads into
 *     ≤ `cell` cells so the bake can carry a gradient (the wall-corner darkness becomes a
 *     one-cell AO rim: the truth).
 *   coveredMask — flag up-facing faces with a horizontal face directly above them (a
 *     rug over the boards, a seat over the floor): they bake dark for a TRUE reason
 *     and the coverage machine gate must not read that as wrong facing.
 *
 * Pure, dice-free, engine-agnostic; the driver imports both after its loader is up.
 */

const cent = (c) => { const o = [0, 0, 0]; for (const p of c) { o[0] += p[0]; o[1] += p[1]; o[2] += p[2]; } const n = c.length || 1; return [o[0] / n, o[1] / n, o[2] / n]; };

/** Bilinear split of every plain 4-corner face whose edges exceed `cell`. Faces with
 *  their own per-corner data (cornerFills / texture / uv), decals, water, and
 *  triangles pass through untouched; every other field is copied onto each cell. */
export function tessellateForBake(faces, cell, { maxPerEdge = 24 } = {}) {
  if (!(cell > 0)) return faces.slice();
  const out = [];
  const bil = (c, u, v) => [0, 1, 2].map((k) => c[0][k] + (c[1][k] - c[0][k]) * u + (c[3][k] - c[0][k]) * v + (c[0][k] - c[1][k] + c[2][k] - c[3][k]) * u * v);
  for (const f of faces) {
    const c = f.corners;
    if (!Array.isArray(c) || c.length !== 4 || f.cornerFills || f.decal || f.water) { out.push(f); continue; }
    const tex = typeof f.texture === 'string' && Array.isArray(f.uv) && f.uv.length === 4;   // a textured quad splits WITH its uvs
    if (f.uv && !tex) { out.push(f); continue; }
    const eu = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]);
    const ev = Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]);
    const nu = Math.min(maxPerEdge, Math.max(1, Math.ceil(eu / cell))), nv = Math.min(maxPerEdge, Math.max(1, Math.ceil(ev / cell)));
    if (nu === 1 && nv === 1) { out.push(f); continue; }
    for (let i = 0; i < nu; i += 1) for (let j = 0; j < nv; j += 1) {
      const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
      const cell = { ...f, corners: [bil(c, u0, v0), bil(c, u1, v0), bil(c, u1, v1), bil(c, u0, v1)] };
      if (tex) {
        const b2 = (t, a, b) => [t[0][0] + (t[1][0] - t[0][0]) * a + (t[3][0] - t[0][0]) * b + (t[0][0] - t[1][0] + t[2][0] - t[3][0]) * a * b, t[0][1] + (t[1][1] - t[0][1]) * a + (t[3][1] - t[0][1]) * b + (t[0][1] - t[1][1] + t[2][1] - t[3][1]) * a * b];
        cell.uv = [b2(f.uv, u0, v0), b2(f.uv, u1, v0), b2(f.uv, u1, v1), b2(f.uv, u0, v1)];
      }
      out.push(cell);
    }
  }
  return out;
}

/** For each face: true when it faces up and a horizontal face sits directly above its
 *  centroid (xy-gridded point-in-polygon; `lift` is the minimum height gap — small, so a
 *  rug a few hundredths above the boards still counts as cover). */
export function coveredMask(faces, { cell = 2, lift = 0.01 } = {}) {
  const grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const horiz = (f) => Array.isArray(f.outNormal) && Math.abs(f.outNormal[2]) > 0.5 && !f.decal && !f.water;
  faces.forEach((f, i) => {
    if (!horiz(f)) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of f.corners) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx += 1) {
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy += 1) { const k = `${gx},${gy}`; (grid.get(k) || grid.set(k, []).get(k)).push(i); }
    }
  });
  const inside = (pt, poly) => {
    let hit = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [xa, ya] = poly[a], [xb, yb] = poly[b];
      if ((ya > pt[1]) !== (yb > pt[1]) && pt[0] < ((xb - xa) * (pt[1] - ya)) / ((yb - ya) || 1e-12) + xa) hit = !hit;
    }
    return hit;
  };
  return faces.map((f, i) => {
    if (!Array.isArray(f.outNormal) || f.outNormal[2] <= 0.5) return false;
    const c = cent(f.corners);
    for (const j of grid.get(key(c[0], c[1])) || []) {
      if (j === i) continue;
      const g = faces[j];
      if (cent(g.corners)[2] <= c[2] + lift) continue;
      if (inside(c, g.corners)) return true;
    }
    return false;
  });
}
