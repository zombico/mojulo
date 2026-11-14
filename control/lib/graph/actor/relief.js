/**
 * relief — the GROUND a scene is played on where it is not flat, read with the world's own walk (network/walk-gate.js:
 * the page's ground probe, the highest top under the feet within a riser). A scene's blocking, its coverage and its
 * storyboard are planned on a level floor (actor/scene.js, coverage.js); on a hillside the film keeps that plan and
 * carries the land beside it: the set is read with its ground laid level (so rising land is not a thing in the way),
 * and the film lifts each actor, camera and prop back onto the ground under it.
 *
 *   reliefOf(faces, seeds, { reach?, cell? }) → { x0, y0, cell, nx, ny, z: [..], lo, hi } | null
 *     faces   [{ corners: [[x, y, z], …], normal? }] in metres, the world's own heights
 *     seeds   [[x, y, z], …] where the scene is played (its marks, each with the height its place names; a place
 *             that names a height under its ground is stood on the lowest ground above it)
 *     z       the ground's height at each cell's middle, row by row from (x0, y0), in the faces' own heights: walked
 *             outward from the seeds a cell at a time, a step taken where the ground under it is within a RISER up or
 *             a DROP down (a bank is climbed, a wall or a cliff is not); a cell the walk never reached (inside a
 *             house, on a roof, past a cliff) takes the height of the nearest it did
 *     null    where no seed stands on anything
 *   heightAt(R, x, y)  → the ground's height at a point (between cells' middles; held past the edges)
 *   landBetween(coverage, R) → the shots whose camera has the land between it and what it looks at
 *   levelled(faces, R, floor) → the faces with the ground laid level: each corner lowered by the ground under it, the
 *                        ground at z 0
 *
 * Pure and deterministic.
 */
import { walker } from '../network/walk-gate.js';

/** what a walker steps up, and down, a cell (m); how far about the seeds the ground is walked, and its cell */
export const RISER = 0.45, DROP = 0.9, REACH = 16, CELL = 0.5;
/** how far above a place's own height its ground is looked for, metres */
const LIFT = 12;
/** the grid's most cells a side: a wider ground is walked coarser */
const SIDE = 200;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The ground about a scene (see the header) */
export function reliefOf(faces, seeds, { reach = REACH, cell = CELL } = {}) {
  const pts = (seeds ?? []).filter((p) => Array.isArray(p) && p.slice(0, 3).every(Number.isFinite));
  if (!pts.length || !Array.isArray(faces) || !faces.length) return null;
  const x0 = Math.min(...pts.map((p) => p[0])) - reach, x1 = Math.max(...pts.map((p) => p[0])) + reach;
  const y0 = Math.min(...pts.map((p) => p[1])) - reach, y1 = Math.max(...pts.map((p) => p[1])) + reach;
  const c = Math.max(cell, (x1 - x0) / SIDE, (y1 - y0) / SIDE), nx = Math.max(1, Math.ceil((x1 - x0) / c)), ny = Math.max(1, Math.ceil((y1 - y0) / c));
  const { ground } = walker({ faces });
  const z = new Float64Array(nx * ny).fill(NaN), queue = [];
  const mid = (i, j) => [x0 + (i + 0.5) * c, y0 + (j + 0.5) * c];
  for (const p of pts) {
    const i = Math.min(nx - 1, Math.max(0, Math.floor((p[0] - x0) / c))), j = Math.min(ny - 1, Math.max(0, Math.floor((p[1] - y0) / c))), k = j * nx + i;
    if (!Number.isNaN(z[k])) continue;
    // (the place's own height first; a place that names none, or one in the air, is stood on the highest ground under it)
    let g = ground(...mid(i, j), p[2] + RISER);
    // (nothing at that height: the lowest ground above it, looked for a step at a time, so a place given low under a
    //  city's street is stood on the street and not on the roof over it; then whatever is highest)
    for (let up = RISER; g === null && up <= LIFT; up += RISER) g = ground(...mid(i, j), p[2] + RISER + up);
    g = g ?? ground(...mid(i, j), Infinity);
    if (g === null) continue;
    z[k] = g; queue.push(k);
  }
  if (!queue.length) return null;
  // the walk: breadth first, so a cell takes the height of the shortest way to it
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q], i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = jj * nx + ii;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || !Number.isNaN(z[kk])) continue;
      const g = ground(...mid(ii, jj), z[k] + RISER);
      if (g === null || g < z[k] - DROP) continue;
      z[kk] = g; queue.push(kk);
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (const k of queue) { lo = Math.min(lo, z[k]); hi = Math.max(hi, z[k]); }
  // what the walk never reached takes the nearest ground's height (outward from the reached, a cell at a time)
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q], i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = jj * nx + ii;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || !Number.isNaN(z[kk])) continue;
      z[kk] = z[k]; queue.push(kk);
    }
  }
  return { x0: r3(x0), y0: r3(y0), cell: r3(c), nx, ny, z: Array.from(z, r3), lo: r3(lo), hi: r3(hi) };
}

/** The ground's height at a point (see the header) */
export function heightAt(R, x, y) {
  const u = Math.min(R.nx - 1, Math.max(0, (x - R.x0) / R.cell - 0.5)), v = Math.min(R.ny - 1, Math.max(0, (y - R.y0) / R.cell - 0.5));
  const i = Math.min(R.nx - 1, Math.floor(u)), j = Math.min(R.ny - 1, Math.floor(v)), i1 = Math.min(R.nx - 1, i + 1), j1 = Math.min(R.ny - 1, j + 1), fu = u - i, fv = v - j;
  const at = (a, b) => R.z[b * R.nx + a];
  return (at(i, j) * (1 - fu) + at(i1, j) * fu) * (1 - fv) + (at(i, j1) * (1 - fu) + at(i1, j1) * fu) * fv;
}

/** A relief with its heights measured from `floor` (what a film carries: the lift over the level plan) */
export const reliefFrom = (R, floor) => ({ ...R, z: R.z.map((v) => r3(v - floor)), lo: r3(R.lo - floor), hi: r3(R.hi - floor) });

/**
 * Where the LAND stands between a camera and what it looks at: the plan is level, so a rise between the two is not in
 * its sightlines (coverage.js fitSight reads the set with its ground laid level). Each shot's camera, at its first and
 * its middle key, raised onto the ground under it, and its line to what it looks at walked a half metre at a time.
 * `R`: the relief as a film carries it (heights over the set's floor). → [{ shot, at: [x, y], over }] where the
 * ground stands `over` metres above the line (the first place it does, a shot once).
 */
export function landBetween(coverage, R, { reach = 0.9, clear = 0.05 } = {}) {
  const out = [], r2 = (v) => Math.round(v * 100) / 100;
  for (const s of coverage?.shots ?? []) {
    const cam = coverage.cameras.find((c) => c.id === s.camera);
    const keys = (cam?.keys ?? []).filter((k) => Array.isArray(k.pos) && Array.isArray(k.poi) && k.t >= s.span[0] - 1e-3 && k.t <= s.span[1] + 1e-3);
    shot: for (const k of [keys[0], keys[Math.floor(keys.length / 2)]].filter(Boolean)) {
      const a = [k.pos[0], k.pos[1], k.pos[2] + heightAt(R, k.pos[0], k.pos[1])], b = [k.poi[0], k.poi[1], k.poi[2] + heightAt(R, k.poi[0], k.poi[1])];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil((len * reach) / 0.5));
      for (let i = 1; i <= n; i++) {
        const t = (i / n) * reach, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t, over = heightAt(R, x, y) - z;
        if (over > clear) { out.push({ shot: s.name, at: [r2(x), r2(y)], over: r2(over) }); break shot; }
      }
    }
  }
  return out;
}

/** The faces with the ground laid level (see the header) */
export function levelled(faces, R) {
  return faces.map((f) => ({ corners: f.corners.map((c) => [c[0], c[1], r3(c[2] - heightAt(R, c[0], c[1]))]) }));
}
