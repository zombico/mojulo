/**
 * THE WALK GATE — a payload walked as the page walks it, for a machine gate over what is walked into (geocity/podium.js,
 * tunnels.js): the page's ground probe (straight down from just over the feet, standing on the highest top a riser and a
 * hand over them; a face that faces down, a ceiling or a flight's soffit, is stood on by nothing), its walls the faces
 * that stand up (a level ray at the knee and at the eye), its body kept out of the boxes.
 *
 *   walker(payload) → walk(points) → { steepest, walls, crossed, boxes, end }   a polyline walked from its first
 *       point's ground, a fifth of a metre a step: the tallest step it took up or down, how many walls it crossed (and
 *       `crossed`, each wall's group and where), which boxes it stood in, the height it ended at
 *
 * Pure. Not on the page: what the page's walk does, measured.
 */
export function walker(P) {
  const C = 2, tops = new Map(), walls = new Map(), key = (x, y) => `${Math.floor(x / C)},${Math.floor(y / C)}`;
  const index = (map, tri) => {
    const xs = tri.map((p) => p[0]), ys = tri.map((p) => p[1]);
    for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++) for (let j = Math.floor(Math.min(...ys) / C); j <= Math.floor(Math.max(...ys) / C); j++) {
      const k = `${i},${j}`; if (!map.has(k)) map.set(k, []); map.get(k).push(tri);
    }
  };
  // (a top faces up, as the probe meets it; a face that faces down, a ceiling or a flight's soffit, is stood on by nothing)
  for (const f of P.faces) {
    const c = f.corners;
    for (let k = 1; k + 1 < c.length; k++) {
      const tri = [c[0], c[k], c[k + 1]], u = [tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]], v = [tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n);
      if (l < 1e-9) continue;
      const nz = Array.isArray(f.normal) ? f.normal[2] : n[2] / l;
      tri.group = f.group;
      if (nz > 0.5) index(tops, tri); else if (Math.abs(nz) <= 0.5) index(walls, tri);
    }
  }
  // the highest top under (x, y) no higher than `from`
  const ground = (x, y, from) => {
    let best = null;
    for (const [a, b, c] of tops.get(key(x, y)) || []) {
      const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const z = l1 * a[2] + l2 * b[2] + l3 * c[2];
      if (z <= from + 1e-6 && (best === null || z > best)) best = z;
    }
    return best;
  };
  // whether a level segment from p to q at height z crosses a wall (Möller–Trumbore against each standing triangle)
  const crosses = (p, q, z) => {
    const dir = [q[0] - p[0], q[1] - p[1], 0], len = Math.hypot(dir[0], dir[1]);
    if (len < 1e-9) return false;
    const seen = new Set();
    for (const k of new Set([key(p[0], p[1]), key(q[0], q[1])])) for (const tri of walls.get(k) || []) {
      if (seen.has(tri)) continue; seen.add(tri);
      const [a, b, c] = tri, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const h = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
      if (Math.abs(det) < 1e-12) continue;
      const s = [p[0] - a[0], p[1] - a[1], z - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
      if (u < 0 || u > 1) continue;
      const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (dir[0] * qv[0] + dir[1] * qv[1] + dir[2] * qv[2]) / det;
      if (v < 0 || u + v > 1) continue;
      const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
      if (t > 1e-6 && t < 1 - 1e-6) return tri.group ?? true;
    }
    return false;
  };
  const boxed = (x, y, z, r = 0.25) => (P.colliders || []).find((c) => x > c.min[0] - r && x < c.max[0] + r && y > c.min[1] - r && y < c.max[1] + r && z + 0.5 > c.min[2] && z + 0.5 < c.max[2]);
  /** Walk a polyline from its first point's ground: each step a fifth of a metre, the feet stood on the highest top a
   *  riser and a hand over them; → { steepest, walls, boxes, end } */
  return (pts) => {
    let z = ground(pts[0][0], pts[0][1], pts[0][2] + 0.45), steepest = 0, wallsHit = 0;
    const crossed = [];
    const boxes = [];
    for (let k = 0; k + 1 < pts.length; k++) {
      const [p, q] = [pts[k], pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.2));
      for (let i = 1; i <= n; i++) {
        const x0 = p[0] + ((q[0] - p[0]) * (i - 1)) / n, y0 = p[1] + ((q[1] - p[1]) * (i - 1)) / n, x = p[0] + ((q[0] - p[0]) * i) / n, y = p[1] + ((q[1] - p[1]) * i) / n;
        const hit = crosses([x0, y0], [x, y], z + 0.9) || crosses([x0, y0], [x, y], z + 1.6);
        if (hit) { wallsHit++; crossed.push({ group: hit === true ? null : hit, at: [x, y, z].map((v) => Math.round(v * 100) / 100) }); }
        const g = ground(x, y, z + 0.45);
        if (g === null) { steepest = Infinity; continue; }
        steepest = Math.max(steepest, Math.abs(g - z)); z = g;
        const B = boxed(x, y, z); if (B) boxes.push(B.of);
      }
    }
    return { steepest, walls: wallsHit, crossed, boxes: [...new Set(boxes)], end: z };
  };
}
