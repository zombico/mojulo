/**
 * field-mesh — a WATERTIGHT polygonizer over a signed-distance field
 * (blenderish-animals.plan.md phase 1: the gap figure-animal.plan.md and
 * zoo-mammals.plan.md both name — "true watertight = marching-cubes").
 *
 * Naive surface nets over a uniform grid: one vertex per sign-change cell
 * (the mean of its edge crossings), one quad per sign-change grid edge
 * (spanning the 4 cells that share it). Every emitted quad joins 4 cell
 * vertices that neighbouring quads reuse, so the surface is closed by
 * construction — no open ring tubes, no seam bridges, no per-axis
 * star-shape limit. Quad output (not triangles) on purpose: it is the
 * face-list currency, and it subdivides cleanly in a DCC (phase 4).
 *
 * Deterministic: pure loops in fixed order over a grid derived from the
 * spec — same field + same options → byte-identical faces, forever.
 *
 * The field contract is figure-animal-skin's `makeField` (JS SDF: negative
 * inside, positive outside), but any (p:{x,y,z}) => number works.
 */

/** Axis-aligned bounds of a prim list (spheres `{c,r}` / round cones `{a,b,ra,rb}`), padded. */
export function primBounds(prims, pad = 0) {
  const mn = { x: Infinity, y: Infinity, z: Infinity }, mx = { x: -Infinity, y: -Infinity, z: -Infinity };
  const eat = (p, r) => {
    for (const k of ['x', 'y', 'z']) {
      if (p[k] - r < mn[k]) mn[k] = p[k] - r;
      if (p[k] + r > mx[k]) mx[k] = p[k] + r;
    }
  };
  for (const pr of prims) {
    if (pr.r !== undefined) eat(pr.c, pr.r);
    else { const r = Math.max(pr.ra, pr.rb); eat(pr.a, r); eat(pr.b, r); }
  }
  return {
    min: { x: mn.x - pad, y: mn.y - pad, z: mn.z - pad },
    max: { x: mx.x + pad, y: mx.y + pad, z: mx.z + pad },
  };
}

/**
 * Surface-net the field's iso-surface (field = 0) inside `bounds`.
 *
 * @param {(p:{x,y,z}) => number} field   signed distance (negative inside)
 * @param {{min:{x,y,z}, max:{x,y,z}}} bounds   must contain the surface with margin
 * @param {{cells?:number}} [opts]   grid cells along the LONGEST side (default 64)
 * @returns {{corners:{x,y,z}[], n:number[]}[]}   outward-wound quads + unit gradient normal
 */
export function surfaceNetFaces(field, bounds, { cells = 64 } = {}) {
  const ex = bounds.max.x - bounds.min.x, ey = bounds.max.y - bounds.min.y, ez = bounds.max.z - bounds.min.z;
  const longest = Math.max(ex, ey, ez);
  if (!(longest > 0)) return [];
  const h = longest / cells;                                    // uniform cell size
  const nx = Math.max(2, Math.ceil(ex / h)), ny = Math.max(2, Math.ceil(ey / h)), nz = Math.max(2, Math.ceil(ez / h));
  const px = nx + 1, py = ny + 1, pz = nz + 1;                  // sample-point counts
  const gx = (i) => bounds.min.x + i * h, gy = (j) => bounds.min.y + j * h, gz = (k) => bounds.min.z + k * h;

  // 1. sample the field at every grid point
  const D = new Float64Array(px * py * pz);
  const at = (i, j, k) => D[(i * py + j) * pz + k];
  for (let i = 0; i < px; i++) for (let j = 0; j < py; j++) for (let k = 0; k < pz; k++) {
    D[(i * py + j) * pz + k] = field({ x: gx(i), y: gy(j), z: gz(k) });
  }

  // 2. one vertex per sign-change cell: the mean of its edge crossings
  //    (linear interpolation of the zero along each crossing cell edge)
  const CELL_EDGES = [
    // [corner index a, corner index b] over the cell's 8 corners (i,j,k bit-packed x|y<<1|z<<2)
    [0, 1], [2, 3], [4, 5], [6, 7],   // x edges
    [0, 2], [1, 3], [4, 6], [5, 7],   // y edges
    [0, 4], [1, 5], [2, 6], [3, 7],   // z edges
  ];
  const vertIdx = new Int32Array(nx * ny * nz).fill(-1);
  const verts = [];
  const cellAt = (i, j, k) => (i * ny + j) * nz + k;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const d = [
      at(i, j, k), at(i + 1, j, k), at(i, j + 1, k), at(i + 1, j + 1, k),
      at(i, j, k + 1), at(i + 1, j, k + 1), at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1),
    ];
    let inside = 0;
    for (const v of d) if (v <= 0) inside++;
    if (inside === 0 || inside === 8) continue;
    const corner = (c) => ({ x: gx(i + (c & 1)), y: gy(j + ((c >> 1) & 1)), z: gz(k + ((c >> 2) & 1)) });
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of CELL_EDGES) {
      const da = d[a], db = d[b];
      if ((da <= 0) === (db <= 0)) continue;
      const t = da / (da - db);                                 // zero crossing along a→b
      const pa = corner(a), pb = corner(b);
      sx += pa.x + (pb.x - pa.x) * t; sy += pa.y + (pb.y - pa.y) * t; sz += pa.z + (pb.z - pa.z) * t;
      n++;
    }
    vertIdx[cellAt(i, j, k)] = verts.length;
    verts.push({ x: sx / n, y: sy / n, z: sz / n });
  }

  // 3. one quad per sign-change interior grid edge, spanning the 4 cells around it.
  //    Winding: ordered so the quad faces from inside (d<=0) toward outside — then
  //    confirmed against the field gradient at the quad centre (the authored normal).
  const faces = [];
  const eps = h * 0.5;
  const gradAt = (p) => {
    const nvx = field({ x: p.x + eps, y: p.y, z: p.z }) - field({ x: p.x - eps, y: p.y, z: p.z });
    const nvy = field({ x: p.x, y: p.y + eps, z: p.z }) - field({ x: p.x, y: p.y - eps, z: p.z });
    const nvz = field({ x: p.x, y: p.y, z: p.z + eps }) - field({ x: p.x, y: p.y, z: p.z - eps });
    const l = Math.hypot(nvx, nvy, nvz) || 1;
    return [nvx / l, nvy / l, nvz / l];
  };
  const emit = (ca, cb, cc, cd, flip) => {
    const ia = vertIdx[ca], ib = vertIdx[cb], ic = vertIdx[cc], id = vertIdx[cd];
    if (ia < 0 || ib < 0 || ic < 0 || id < 0) return;           // boundary-truncated cell — bounds too tight
    const order = flip ? [ia, id, ic, ib] : [ia, ib, ic, id];
    let corners = order.map((v) => verts[v]);
    const cen = {
      x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
      y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
      z: (corners[0].z + corners[1].z + corners[2].z + corners[3].z) / 4,
    };
    const n = gradAt(cen);
    // Enforce winding against the gradient (Newell) — STL derives normals from
    // winding alone, so the corner order must agree with the authored normal.
    let wx = 0, wy = 0, wz = 0;
    for (let m = 0; m < 4; m++) {
      const a = corners[m], b = corners[(m + 1) % 4];
      wx += (a.y - b.y) * (a.z + b.z); wy += (a.z - b.z) * (a.x + b.x); wz += (a.x - b.x) * (a.y + b.y);
    }
    if (wx * n[0] + wy * n[1] + wz * n[2] < 0) corners = [corners[0], corners[3], corners[2], corners[1]];
    faces.push({ corners, n });
  };
  // x-directed edges: shared by cells (i, j-1..j, k-1..k)
  for (let i = 0; i < nx; i++) for (let j = 1; j < ny; j++) for (let k = 1; k < nz; k++) {
    const da = at(i, j, k), db = at(i + 1, j, k);
    if ((da <= 0) === (db <= 0)) continue;
    emit(cellAt(i, j - 1, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i, j - 1, k), da > 0);
  }
  // y-directed edges: shared by cells (i-1..i, j, k-1..k)
  for (let i = 1; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 1; k < nz; k++) {
    const da = at(i, j, k), db = at(i, j + 1, k);
    if ((da <= 0) === (db <= 0)) continue;
    emit(cellAt(i - 1, j, k - 1), cellAt(i - 1, j, k), cellAt(i, j, k), cellAt(i, j, k - 1), da > 0);
  }
  // z-directed edges: shared by cells (i-1..i, j-1..j, k)
  for (let i = 1; i < nx; i++) for (let j = 1; j < ny; j++) for (let k = 0; k < nz; k++) {
    const da = at(i, j, k), db = at(i, j, k + 1);
    if ((da <= 0) === (db <= 0)) continue;
    emit(cellAt(i - 1, j - 1, k), cellAt(i, j - 1, k), cellAt(i, j, k), cellAt(i - 1, j, k), da > 0);
  }
  return faces;
}
