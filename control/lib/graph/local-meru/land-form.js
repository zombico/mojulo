/**
 * THE LAND'S FORM, read off its height grid: the shared half of the polygon land (local-meru/shading.js lights it), for
 * the island (scene.js) and an isekai stage's land (era/isekai.js `shading`) alike.
 *
 *   valleyOf(g)                              how much sky each ground corner loses to the land round it (the rule
 *                                            `valley` reads it)
 *   planarise(g, z, at, isCliff, span)       the grid's rock drawn toward planes (`facet`): one pass, in place on `z`
 *   FACET_PASSES                             the passes a land takes
 *
 * `g` a landform grid ({ x0, y0, dx, nx, ny, z }, polygonizer/landform.js). Pure.
 */
import { gridX, gridY, gridSample } from '../polygonizer/landform.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mean = (cs) => cs.reduce((a, p) => [a[0] + p[0] / cs.length, a[1] + p[1] / cs.length, a[2] + p[2] / cs.length], [0, 0, 0]);
const facet = (c, toward) => { const n = unit(cross(sub(c[2], c[0]), sub(c[3], c[1]))); return dot(n, toward) < 0 ? n.map((v) => -v) : n; };

// the valley's horizon: eight bearings, read out to 32 m in doublings over the ground smoothed a metre wide (the
// rock's jags are crevice and ridge's to read, not the valley's)
const BEARINGS = [[1, 0], [-1, 0], [0, 1], [0, -1], [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2]];
const REACHES = [2, 4, 8, 16, 32], SMOOTH_CELLS = 2;
const sine = (t) => t / Math.sqrt(1 + t * t);
function blurred(g) {
  const { nx, ny } = g, a = new Float64Array(nx * ny), b = new Float64Array(nx * ny), R = SMOOTH_CELLS;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, n = 0; for (let d = -R; d <= R; d++) { const k = i + d; if (k >= 0 && k < nx) { s += g.z[j * nx + k]; n++; } } a[j * nx + i] = s / n; }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let s = 0, n = 0; for (let d = -R; d <= R; d++) { const k = j + d; if (k >= 0 && k < ny) { s += a[k * nx + i]; n++; } } b[j * nx + i] = s / n; }
  return b;
}
/**
 * How much sky each ground corner loses to the land round it, beyond what an even slope of its own grade loses (0 on
 * a plain or an even slope … about 0.3 at the foot of a wall, more down a gully), on the ground grid: per bearing, the
 * sine of the highest angle the land rises to, less the sine of the slope's own rise that way, averaged.
 * → { at(corner) → 0..1, or null off the ground (a boulder's top, a wall's head: half a metre and more off it) }.
 */
export function valleyOf(g) {
  const sm = blurred(g), occ = new Float64Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), z = sm[j * g.nx + i];
    let s = 0;
    for (const [bx, by] of BEARINGS) {
      const k = (gridSample(g, x + bx, y + by, sm) - gridSample(g, x - bx, y - by, sm)) / 2;
      let t = 0;
      for (const r of REACHES) { const u = (gridSample(g, x + bx * r, y + by * r, sm) - z) / r; if (u > t) t = u; }
      const o = sine(t) - sine(k > 0 ? k : 0);
      if (o > 0) s += o;
    }
    occ[j * g.nx + i] = s / BEARINGS.length;
  }
  return { at: (c) => (Math.abs(c[2] - gridSample(g, c[0], c[1], g.z)) > 0.5 ? null : gridSample(g, c[0], c[1], occ)) };
}

/**
 * Rock in planes (shading `facet`, metres): the grid's rock quads grown into facets (from each unclaimed quad in row
 * order, across shared edges, while a neighbour's normal is within ~25° of the first quad's and its centre within half
 * the span), each facet's plane its quads' area-weighted centre and normal; then every grid corner all of whose quads
 * are rock is drawn to the mean of its facets' planes (vertically: the ground stays a heightfield; at most half a metre,
 * a plane steeper than ~78° left out). A corner shared with grass stays, so the land's seams do not move. The rock is
 * then planes of stone in its geometry: its light, crease and contact read planes, not the grid's jags. Three passes,
 * each regrowing the facets on the last one's rock, straighten it about a third (one pass, about a seventh).
 */
const FACET_COS = 0.9, FACET_MOVE = 0.5, FACET_STEEP = 0.2;
export const FACET_PASSES = 3;
export function planarise(g, z, at, isCliff, span) {
  const qx = g.nx - 1, qy = g.ny - 1, Q = new Array(qx * qy).fill(null);
  for (let j = 0; j < qy; j++) for (let i = 0; i < qx; i++) {
    const cs = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], n = facet(cs, [0, 0, 1]);
    if (isCliff(cs, n)) Q[j * qx + i] = { n, c: mean(cs), a: Math.hypot(...cross(sub(cs[2], cs[0]), sub(cs[3], cs[1]))) / 2, f: -1 };
  }
  const planes = [], r2 = (span / 2) * (span / 2);
  for (let k = 0; k < Q.length; k++) {
    const q0 = Q[k]; if (!q0 || q0.f >= 0) continue;
    const id = planes.length, members = [k]; q0.f = id;
    for (let m = 0; m < members.length; m++) {
      const kk = members[m], i = kk % qx, j = (kk / qx) | 0;
      for (const [ni, nj] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (ni < 0 || nj < 0 || ni >= qx || nj >= qy) continue;
        const q = Q[nj * qx + ni];
        if (!q || q.f >= 0 || dot(q.n, q0.n) < FACET_COS) continue;
        const d = sub(q.c, q0.c); if (dot(d, d) > r2) continue;
        q.f = id; members.push(nj * qx + ni);
      }
    }
    let n = [0, 0, 0], c = [0, 0, 0], A = 0;
    for (const kk of members) { const q = Q[kk]; n = add(n, mul(q.n, q.a)); c = add(c, mul(q.c, q.a)); A += q.a; }
    planes.push({ n: unit(n), c: mul(c, 1 / (A || 1)) });
  }
  const out = Float64Array.from(z);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const ids = new Set(); let all = true;
    for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) {
      if (a < 0 || b < 0 || a >= qx || b >= qy) continue;
      const q = Q[b * qx + a]; if (!q) { all = false; break; } ids.add(q.f);
    }
    if (!all || !ids.size) continue;
    const x = gridX(g, i), y = gridY(g, j), z0 = z[j * g.nx + i];
    let s = 0, k = 0;
    for (const id of ids) { const P = planes[id]; if (P.n[2] < FACET_STEEP) continue; s += P.c[2] - (P.n[0] * (x - P.c[0]) + P.n[1] * (y - P.c[1])) / P.n[2]; k++; }
    if (k) { const dz = s / k - z0; out[j * g.nx + i] = z0 + Math.max(-FACET_MOVE, Math.min(FACET_MOVE, dz)); }
  }
  z.set(out);
}

