/**
 * KARST JOINTS — a limestone pavement's clints and grikes as one function of the tile's own space, shared by its painter
 * (dressed.js `karst` cut) and by what roots in it (era/rock-flora.js), so a plant stands in a joint the tile draws.
 *
 *   karstJoints({ M, rows, cols, seed }) → { dist(x, y) (metres to the nearest grike over that grike's own width, as
 *                                           if it were a full one; x and y anywhere: the tile repeats every M), clint(x, y) (the clint's own index, for its tone) }
 *
 * The clints lie in courses: `rows` bands across the tile, their beds (the master joints, running through) at jittered
 * heights; in each course about `cols` clints, the cross joints slid along it, some only cracks; every joint wandered by
 * periodic noise, so none is a ruled line. Pure: hashed dice, periodic in M.
 */
import { hash01 } from './relief.js';

const wrap = (v, M) => ((v % M) + M) % M;

export function karstJoints({ M, rows = 3, cols = 3, seed = 1 }) {
  // the beds: the master set, running through; the cross joints: a course's own count (one more or less than `cols`),
  // jittered, a share of them only cracks, the rest grikes of their own widths
  const beds = Array.from({ length: rows }, (_, r) => ((r + 0.5 * (hash01(r, 1, seed) - 0.5)) / rows) * M);
  const cuts = Array.from({ length: rows }, (_, r) => {
    const n = Math.max(2, cols + (hash01(r, 9, seed) < 0.33 ? -1 : hash01(r, 9, seed) > 0.66 ? 1 : 0)), w = M / n, slide = hash01(r, 2, seed) * w;
    return Array.from({ length: n }, (_, q) => ({ at: wrap(slide + (q + 0.6 * (hash01(r, q + 3, seed) - 0.5)) * w, M), wide: hash01(r, q + 21, seed) < 0.35 ? 0.3 : 0.6 + 0.6 * hash01(r, q + 23, seed) }));
  });
  // the warped point: each axis wandered by periodic value noise at two scales (a joint holds its bearing, but never a
  // ruled line), the noise wrapping with the tile
  const A = 0.032 * M, noise = (x, y, n, s) => {
    const u = (x / M) * n, v = (y / M) * n, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, sm = (t) => t * t * (3 - 2 * t);
    const h = (a, b) => hash01(((a % n) + n) % n, ((b % n) + n) % n, seed + s) * 2 - 1, su = sm(fu), sv = sm(fv);
    const a0 = h(i, j) + (h(i + 1, j) - h(i, j)) * su, a1 = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * su;
    return a0 + (a1 - a0) * sv;
  };
  const warp = (x, y) => [x + A * (noise(x, y, 4, 31) + 0.45 * noise(x, y, 11, 37)), y + A * (noise(x, y, 4, 41) + 0.45 * noise(x, y, 11, 43))];
  const gap = (v, a) => { const t = Math.abs(v - a); return Math.min(t, M - t); };
  const courseOf = (y) => { let r = rows - 1; for (let k = 0; k < rows; k++) if (y >= beds[k]) r = k; return y < beds[0] ? rows - 1 : r; };
  const at = (x, y) => { const [u, v] = warp(wrap(x, M), wrap(y, M)); const U = wrap(u, M), V = wrap(v, M); return [U, V, courseOf(V)]; };
  return {
    // (a joint's distance over its width: a bed widening and narrowing along its run, a crack a third of a grike)
    dist(x, y) {
      const [U, V, r] = at(x, y), bw = Math.max(0.25, 0.75 + 0.6 * noise(x, y, 3, 51));
      let d = Math.min(...beds.map((b) => gap(V, b))) / bw;
      for (const c of cuts[r]) d = Math.min(d, gap(U, c.at) / c.wide);
      return d;
    },
    clint(x, y) { const [U, V, r] = at(x, y); let q = 0; cuts[r].forEach((c, k) => { if (U >= c.at) q = k + 1; }); return r * 16 + (q % cuts[r].length); },
  };
}
