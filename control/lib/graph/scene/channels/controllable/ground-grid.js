/**
 * THE GROUND BY GRID — a downward ray (a walker finding its feet, `__ground`) on a big static mesh tests only the
 * triangles over its own (x, y), from a 2D grid of them built once, the first time a ray asks: a ground of 67k triangles
 * was every one of them tested for every walker every frame (the town's people at their doors made it the frame's
 * cost). Any other ray (the camera's, held off the walls from the hero's head) walks the cells its line crosses and tests
 * theirs: near a building that one ray a frame was three's raycast over every triangle of the town's stone and its
 * chips. A mesh that has moved, or one of several materials, takes three's own raycast.
 *
 *   gridIndex(pos, idx, cell)            → { x0, y0, cell, nx, ny, cells }   each cell the triangles whose xy box meets it
 *   gridFit(pos, idx, most?)             → a grid whose fullest cell holds `most` triangles or fewer (cells halved)
 *   gridRayDown(G, pos, idx, x, y, z)    → [{ t, z }]                         every triangle under (x, y) at or below z:
 *                                                                              its height there; vertical faces have none
 *   gridRayCast(G, pos, idx, o, d, near, far, side) → [{ t, x, y, z, f }]  every triangle the ray meets in [near, far],
 *                                                                              nearest first, through the cells it crosses
 *   groundGridScript()                   → the page's `__gridRaycast(mesh)`: the mesh's raycast by grid
 *
 * Pure (the page emits these by their source). Positions in the mesh's own frame, which is the world's for a static group.
 */

/** The 2D grid of a triangle list: `pos` x, y, z per corner, `idx` three corners a triangle (null: corners in order). */
export function gridIndex(pos, idx, cell) {
  const n = idx ? idx.length / 3 : pos.length / 9, at = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); y0 = Math.min(y0, pos[i + 1]); y1 = Math.max(y1, pos[i + 1]); }
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell) + 1), ny = Math.max(1, Math.ceil((y1 - y0) / cell) + 1);
  const cells = new Array(nx * ny);
  for (let t = 0; t < n; t++) {
    let ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
    for (let k = 0; k < 3; k++) { const v = at(t, k) * 3; ax = Math.min(ax, pos[v]); bx = Math.max(bx, pos[v]); ay = Math.min(ay, pos[v + 1]); by = Math.max(by, pos[v + 1]); }
    const i0 = Math.floor((ax - x0) / cell), i1 = Math.floor((bx - x0) / cell), j0 = Math.floor((ay - y0) / cell), j1 = Math.floor((by - y0) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) (cells[j * nx + i] ??= []).push(t);
  }
  return { x0, y0, cell, nx, ny, cells };
}

/** A grid that fits its mesh: from 2 m cells, halved while its fullest cell holds more than `most` triangles (a scatter of
 * stones, a mesh's crowded corner), to a quarter metre at the finest. */
export function gridFit(pos, idx, most = 192) {
  let G = gridIndex(pos, idx, 2);
  const fullest = (g) => g.cells.reduce((m, c) => Math.max(m, c ? c.length : 0), 0);
  while (G.cell > 0.25 && fullest(G) > most) G = gridIndex(pos, idx, G.cell / 2);
  return G;
}

/** Every triangle under (x, y) whose height there is at or below z: [{ t, z }], nearest first. */
export function gridRayDown(G, pos, idx, x, y, z) {
  const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((y - G.y0) / G.cell);
  if (i < 0 || j < 0 || i >= G.nx || j >= G.ny) return [];
  const list = G.cells[j * G.nx + i], out = [];
  if (!list) return out;
  const at = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k) * 3;
  for (const t of list) {
    const a = at(t, 0), b = at(t, 1), c = at(t, 2);
    const ax = pos[a], ay = pos[a + 1], bx = pos[b], by = pos[b + 1], cx = pos[c], cy = pos[c + 1];
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-12) continue;   // a vertical face: no height under a point
    const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d, w = 1 - u - v;
    if (u < -1e-7 || v < -1e-7 || w < -1e-7) continue;
    const h = u * pos[a + 2] + v * pos[b + 2] + w * pos[c + 2];
    if (h <= z + 1e-7) out.push({ t, z: h });
  }
  return out.sort((p, q) => q.z - p.z);
}

/** Every triangle a ray (origin `o`, unit direction `d`) meets between `near` and `far`: the cells its line crosses over
 * the grid's xy walked in order, each triangle tested once. `side` as three reads a material's: 0 its front only, 1 its
 * back only, 2 both. [{ t, x, y, z, f }] nearest first (`f` the triangle). */
export function gridRayCast(G, pos, idx, o, d, near, far, side) {
  const out = [], seen = new Set(), C = G.cell, at = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k) * 3;
  let t0 = near, t1 = far;
  // (the ray held to the grid's box in x and y)
  for (const [p, q, lo, hi] of [[o.x, d.x, G.x0, G.x0 + G.nx * C], [o.y, d.y, G.y0, G.y0 + G.ny * C]]) {
    if (Math.abs(q) < 1e-12) { if (p < lo || p >= hi) return out; continue; }
    let a = (lo - p) / q, b = (hi - p) / q;
    if (a > b) { const s = a; a = b; b = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  if (!(t0 <= t1)) return out;
  const cl = (v, n) => Math.min(n - 1, Math.max(0, v));
  let i = cl(Math.floor((o.x + d.x * t0 - G.x0) / C), G.nx), j = cl(Math.floor((o.y + d.y * t0 - G.y0) / C), G.ny);
  const si = d.x > 1e-12 ? 1 : d.x < -1e-12 ? -1 : 0, sj = d.y > 1e-12 ? 1 : d.y < -1e-12 ? -1 : 0;
  const ex = si ? C / Math.abs(d.x) : Infinity, ey = sj ? C / Math.abs(d.y) : Infinity;
  let mx = si ? (G.x0 + (i + (si > 0 ? 1 : 0)) * C - o.x) / d.x : Infinity, my = sj ? (G.y0 + (j + (sj > 0 ? 1 : 0)) * C - o.y) / d.y : Infinity;
  for (;;) {
    for (const f of G.cells[j * G.nx + i] || []) {
      if (seen.has(f)) continue;
      seen.add(f);
      const a = at(f, 0), b = at(f, 1), c = at(f, 2);
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      // (its face as three reads it: the normal of a, b, c in turn, its front met against that normal)
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, dn = d.x * nx + d.y * ny + d.z * nz;
      if (Math.abs(dn) < 1e-12 || (side === 0 && dn > 0) || (side === 1 && dn < 0)) continue;
      const wx = o.x - pos[a], wy = o.y - pos[a + 1], wz = o.z - pos[a + 2];
      const t = -(wx * nx + wy * ny + wz * nz) / dn;
      if (t < near || t > far) continue;
      const px = wx + d.x * t, py = wy + d.y * t, pz = wz + d.z * t;
      // (inside it: the point's weights along the two edges from a)
      const uu = ux * ux + uy * uy + uz * uz, uv = ux * vx + uy * vy + uz * vz, vv = vx * vx + vy * vy + vz * vz;
      const pu = px * ux + py * uy + pz * uz, pv = px * vx + py * vy + pz * vz, D = uu * vv - uv * uv;
      const s1 = (vv * pu - uv * pv) / D, s2 = (uu * pv - uv * pu) / D;
      if (s1 < -1e-7 || s2 < -1e-7 || s1 + s2 > 1 + 1e-7) continue;
      out.push({ t, x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t, f });
    }
    if (!si && !sj) break;
    if (mx < my) { if (mx > t1) break; i += si; mx += ex; } else { if (my > t1) break; j += sj; my += ey; }
    if (i < 0 || j < 0 || i >= G.nx || j >= G.ny) break;
  }
  return out.sort((p, q) => p.t - q.t);
}

/** The page's grid raycast for a big static mesh (THREE in scope). */
export function groundGridScript() {
  return `
// THE GROUND BY GRID (ground-grid.js): a ray on a big static mesh tests the triangles of the cells it crosses only
const __gridIndex = ${gridIndex.toString()};
const __gridRayDown = ${gridRayDown.toString()};
const __gridRayCast = ${gridRayCast.toString()};
const __gridFit = ${gridFit.toString().replace(/\bgridIndex\(/g, '__gridIndex(')};
const __gridSlow = THREE.Mesh.prototype.raycast;
function __gridRaycast(rc, out) {
  const d = rc.ray.direction, o = rc.ray.origin, mat = this.material;
  // (a mesh that stands where it was built: the grid; one that has moved, or a slanting ray on a mesh of several
  // materials: three's own)
  const down = d.z <= -0.9999;
  if (!this.matrixWorld.equals(__gridI) || (!down && (!mat || Array.isArray(mat)))) return __gridSlow.call(this, rc, out);
  const g = this.geometry, pos = g.attributes.position.array, idx = g.index ? g.index.array : null;
  const G = g.userData.__grid || (g.userData.__grid = __gridFit(pos, idx));
  if (!down) {
    // (any other ray: the cells its line crosses, each face as its material shows it)
    const side = mat.side === THREE.BackSide ? 1 : mat.side === THREE.DoubleSide ? 2 : 0;
    for (const h of __gridRayCast(G, pos, idx, o, d, rc.near, rc.far, side)) out.push({ distance: h.t, point: new THREE.Vector3(h.x, h.y, h.z), object: this, faceIndex: h.f });
    return;
  }
  for (const h of __gridRayDown(G, pos, idx, o.x, o.y, o.z)) {
    const dist = o.z - h.z;
    if (dist < rc.near || dist > rc.far) continue;
    out.push({ distance: dist, point: new THREE.Vector3(o.x, o.y, h.z), object: this, faceIndex: h.t });
  }
}
const __gridI = new THREE.Matrix4();
// (every big static mesh: the solids and the groups' textured faces, a thousand triangles or more)
function __gridMeshes() {
  scene.traverse((m) => { if (m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && m.geometry && m.raycast === __gridSlow && (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) >= 3000) m.raycast = __gridRaycast; });
}
`;
}
