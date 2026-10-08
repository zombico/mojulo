/**
 * THE BAKE — a baked plate's floor and occlusion read off the world it froze (a resolved World payload: faces with
 * corners and normals, colliders). Nothing is authored: the floor is where a figure can stand, and what hides it is
 * the world's own geometry.
 *
 *   bakeFloor(payload)                    a grid of BAKE_CELL m over the ground: a cell walks when an up face lies
 *                                         under its centre within STEP of the ground and nothing stands across it at
 *                                         body height (a standing face, a collider). → { cell, origin, nx, ny, walk,
 *                                         rects } with the walking cells merged into rectangles (metres).
 *   cellOf(bake, [x, y])                  the cell index under a point, or −1 off the grid
 *   walkable(bake, [x, y])
 *   components(bake)                      the walking cells grouped by 4-connection → { label: Int32Array, count }
 *   bakeMask(payload, B, size, bake, w)   the occlusion mask at w columns: per cell 0 nothing, 1 floor seen, 2 floor
 *                                         hidden (a figure standing there loses its feet behind a nearer face)
 *
 * Pure and deterministic: the grid, the merge and the raster read the faces in order.
 */
import { project, lift } from './camera.js';
import { clipNear } from './geom.js';
import { inPoly } from './geom.js';

export const BAKE_CELL = 0.25;
export const STEP = 0.35;            // an up face this high over the ground is still floor (a kerb, a dais step)
export const BODY = Object.freeze([0.3, 1.7]);   // a standing face crossing this band blocks the cell

const isUp = (f) => f.normal && f.normal[2] > 0.9;
const isStanding = (f) => f.normal && Math.abs(f.normal[2]) < 0.5;
// what a figure can stand on or be hidden by: not a decal (blend), a light volume (water, cornerAlpha) or a cutout
// card (a cobweb, ivy: alpha-tested, see-through)
export const solidOf = (payload) => { const cut = new Set((payload && payload.cutouts) || []); return (f) => !f.blend && !f.water && !f.cornerAlpha && !(f.texture && cut.has(f.texture)); };

export function bakeFloor(payload, { cell = BAKE_CELL } = {}) {
  const faces = ((payload && payload.faces) || []).filter(solidOf(payload));
  const ups = faces.filter((f) => isUp(f) && Math.max(...f.corners.map((c) => c[2])) <= STEP);
  if (!ups.length) throw new Error('walkmesh bake: the world has no ground (no up face within a step of z = 0)');
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of ups) for (const [x, y] of f.corners) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const nx = Math.max(1, Math.round((x1 - x0) / cell)), ny = Math.max(1, Math.round((y1 - y0) / cell));
  const floor = new Uint8Array(nx * ny), block = new Uint8Array(nx * ny);
  const ix = (x) => Math.floor((x - x0) / cell), iy = (y) => Math.floor((y - y0) / cell);
  for (const f of ups) {
    const poly = f.corners.map((c) => [c[0], c[1]]);
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    for (let j = Math.max(0, iy(Math.min(...ys))); j <= Math.min(ny - 1, iy(Math.max(...ys))); j++) {
      for (let i = Math.max(0, ix(Math.min(...xs))); i <= Math.min(nx - 1, ix(Math.max(...xs))); i++) {
        if (inPoly([x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell], poly)) floor[j * nx + i] = 1;
      }
    }
  }
  const mark = (x, y) => { const i = ix(x), j = iy(y); if (i >= 0 && i < nx && j >= 0 && j < ny) block[j * nx + i] = 1; };
  for (const f of faces) {
    if (!isStanding(f)) continue;
    const zs = f.corners.map((c) => c[2]);
    if (Math.max(...zs) < BODY[0] || Math.min(...zs) > BODY[1]) continue;
    // a standing face's footprint is a segment: its two most distant corners in plan
    let a = f.corners[0], b = f.corners[0], far = -1;
    for (const p of f.corners) for (const q of f.corners) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > far) { far = d; a = p; b = q; } }
    const n = Math.max(1, Math.ceil(far / (cell / 2)));
    for (let k = 0; k <= n; k++) mark(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n);
  }
  for (const c of (payload && payload.colliders) || []) {
    if (c.max[2] < BODY[0] || c.min[2] > BODY[1]) continue;
    for (let j = Math.max(0, iy(c.min[1])); j <= Math.min(ny - 1, iy(c.max[1])); j++) for (let i = Math.max(0, ix(c.min[0])); i <= Math.min(nx - 1, ix(c.max[0])); i++) {
      const cx = x0 + (i + 0.5) * cell, cy = y0 + (j + 0.5) * cell;
      if (cx >= c.min[0] && cx <= c.max[0] && cy >= c.min[1] && cy <= c.max[1]) block[j * nx + i] = 1;
    }
  }
  const walk = new Uint8Array(nx * ny);
  for (let k = 0; k < walk.length; k++) walk[k] = floor[k] && !block[k] ? 1 : 0;
  return { cell, origin: [x0, y0], nx, ny, walk, rects: mergeRects(walk, nx, ny, cell, [x0, y0]) };
}

// the walking cells as rectangles: runs along each row, a run carried down while the next row repeats it
function mergeRects(walk, nx, ny, cell, [x0, y0]) {
  const rects = [], open = new Map();
  for (let j = 0; j <= ny; j++) {
    const runs = [];
    if (j < ny) for (let i = 0; i < nx;) { if (!walk[j * nx + i]) { i++; continue; } const s = i; while (i < nx && walk[j * nx + i]) i++; runs.push(`${s}:${i}`); }
    for (const [key, from] of [...open]) if (!runs.includes(key)) { const [s, e] = key.split(':').map(Number); rects.push({ min: [x0 + s * cell, y0 + from * cell], max: [x0 + e * cell, y0 + j * cell] }); open.delete(key); }
    for (const key of runs) if (!open.has(key)) open.set(key, j);
  }
  return rects.sort((a, b) => a.min[1] - b.min[1] || a.min[0] - b.min[0]);
}

export function cellOf(bake, [x, y]) {
  const i = Math.floor((x - bake.origin[0]) / bake.cell), j = Math.floor((y - bake.origin[1]) / bake.cell);
  return i >= 0 && i < bake.nx && j >= 0 && j < bake.ny ? j * bake.nx + i : -1;
}
export const walkable = (bake, p) => { const k = cellOf(bake, p); return k >= 0 && bake.walk[k] === 1; };

export function components(bake) {
  const { nx, ny, walk } = bake, label = new Int32Array(nx * ny).fill(-1);
  let count = 0;
  for (let s = 0; s < walk.length; s++) {
    if (!walk[s] || label[s] >= 0) continue;
    const stack = [s]; label[s] = count;
    while (stack.length) {
      const k = stack.pop(), i = k % nx, j = (k - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj, q = b * nx + a;
        if (a >= 0 && a < nx && b >= 0 && b < ny && walk[q] && label[q] < 0) { label[q] = count; stack.push(q); }
      }
    }
    count++;
  }
  return { label, count };
}

/** The occlusion mask: the world rasterised from the plate camera at w columns, nearest face per cell. */
export function bakeMask(payload, B, [W, H], bake, w = 192) {
  const h = Math.max(1, Math.round((w * H) / W)), s = w / W;
  const depth = new Float32Array(w * h).fill(Infinity);
  const solid = solidOf(payload);
  for (const f of (payload && payload.faces) || []) {
    if (!solid(f)) continue;
    const poly = clipNear(B, f.corners);
    if (poly.length < 3) continue;
    const q = poly.map((P) => { const r = project(B, P); return r ? [r.px[0] * s, r.px[1] * s, r.depth] : null; });
    if (q.some((v) => !v)) continue;
    for (let k = 1; k + 1 < q.length; k++) {
      const p = [q[0], q[k], q[k + 1]];
      const den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
      if (Math.abs(den) <= 1e-12) continue;
      const i0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), i1 = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const j0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), j1 = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = i + 0.5, y = j + 0.5;
        const ba = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / den;
        const bb = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / den;
        const bc = 1 - ba - bb;
        if (ba < -1e-9 || bb < -1e-9 || bc < -1e-9) continue;
        const d = 1 / (ba / p[0][2] + bb / p[1][2] + bc / p[2][2]);
        if (d < depth[j * w + i]) depth[j * w + i] = d;
      }
    }
  }
  const cells = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const g = lift(B, [(i + 0.5) / s, (j + 0.5) / s], 0);
    if (!g || !walkable(bake, g)) continue;
    const gd = (g[0] - B.position[0]) * B.forward[0] + (g[1] - B.position[1]) * B.forward[1] + (g[2] - B.position[2]) * B.forward[2];
    cells[j * w + i] = depth[j * w + i] < gd - Math.max(0.15, gd * 0.01) ? 2 : 1;
  }
  return { w, h, cells };
}
