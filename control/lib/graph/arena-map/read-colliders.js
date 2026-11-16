/**
 * A PLACE AS IT STANDS, READ AS AN ARENA MAP — a resolved page's own colliders rasterised onto the arena grid
 * (blocks.js), so the arena's laws (laws.js) and a mission's phases (phases.js) are measured on the place as it is
 * walked: a geocube's building on its land with its yard's containers, its masts and whatever is parked in it. No plan
 * is read and nothing is guessed from a recipe: what stops a body on the page stops it here.
 *
 *   readCollidersMap(colliders, { rect, z, cell?, skip? }) → map
 *     colliders  [{ min: [x, y, z], max: [x, y, z] }] the page's (payload.colliders)
 *     rect       [x0, y0, x1, y1] the ground read, metres (a building's apron)
 *     z          the ground's height there (a body's feet)
 *     skip       (collider) → true for one left out (a net under the ground)
 *   map: { nx, ny, nz: 1, floors, solids, walls, ramps: [], ladders: [], read: { cell, origin, z, notes } }
 *
 * HOW IT IS READ (each approximation said):
 *   - ONE LEVEL, the ground's: an upper storey, a stair and a gallery are not read (said when the colliders stand
 *     higher than a storey). A cell is a SOLID where what stands at a body's height covers half of it or more.
 *   - WALLS. A wall is thinner than a cell: between two neighbouring cells of ground, what stands across the line
 *     joining them is a wall on that edge wherever no body's width of it is clear: full where it stands over an eye,
 *     low where some of it stands only over a knee (a barrier, a low crate). A doorway opens the edge it stands on.
 *   - ONE GROUND. The map is the largest ground a body walks; ground the reading leaves no way into is read as mass.
 *   - THE EDGE is left open: the ground read is a part of a wider land, and `bounded` says so.
 *
 * Pure, no dice: a function of the colliders and the rect.
 */
import { CELL, EYE } from './blocks.js';

const KNEE = 0.5, SUB = 3, OFFS = [0, -0.2, 0.2, -0.38, 0.38];
const r2 = (v) => Math.round(v * 100) / 100;

export function readCollidersMap(colliders, { rect, z = 0, cell = CELL, skip = null } = {}) {
  const [x0, y0, x1, y1] = rect, nx = Math.max(2, Math.round((x1 - x0) / cell)), ny = Math.max(2, Math.round((y1 - y0) / cell)), notes = [];
  // what stands in a body's way at this ground: over a knee, under a head's height above it
  const C = (colliders ?? []).filter((c) => c && c.min && c.max && !(skip && skip(c)) && c.max[2] > z + KNEE && c.min[2] < z + EYE)
    .map((c) => ({ x0: c.min[0], y0: c.min[1], x1: c.max[0], y1: c.max[1], tall: c.max[2] >= z + EYE }));
  if ((colliders ?? []).some((c) => c && c.max && c.max[2] > z + 5)) notes.push('read at the ground alone: an upper storey, a stair and a gallery are not in the map');
  const at = (i, j) => [x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell];
  const solid = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let n = 0;
    for (let b = 0; b < SUB; b++) for (let a = 0; a < SUB; a++) {
      const x = x0 + (i + (a + 0.5) / SUB) * cell, y = y0 + (j + (b + 0.5) / SUB) * cell;
      if (C.some((c) => c.tall && x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1)) n++;
    }
    if (n * 2 >= SUB * SUB) solid[j * nx + i] = 1;
  }
  // a segment from p to q meets a box
  const crosses = (c, p, q) => {
    let t0 = 0, t1 = 1;
    for (const [a, d, lo, hi] of [[p[0], q[0] - p[0], c.x0, c.x1], [p[1], q[1] - p[1], c.y0, c.y1]]) {
      if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) return false; continue; }
      const u = (lo - a) / d, v = (hi - a) / d; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
      if (t0 > t1) return false;
    }
    return true;
  };
  const floors = [], solids = [], walls = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    floors.push([i, j, 0]);
    if (solid[j * nx + i]) { solids.push([i, j, 0]); continue; }
    for (const [di, dj, side] of [[1, 0, 'e'], [0, 1, 'n']]) {
      const a = i + di, b = j + dj;
      if (a >= nx || b >= ny || solid[b * nx + a]) continue;
      // (a way through is anywhere a body passes along the edge the two share: a doorway seldom stands on a cell's
      // middle. Lines across the edge, a body's width apart; open where one is clear, low where one is clear over an eye)
      const p = at(i, j), q = at(a, b);
      let open = false, over = false;
      for (const o of OFFS) {
        const d = o * cell, P0 = di ? [p[0], p[1] + d] : [p[0] + d, p[1]], Q0 = di ? [q[0], q[1] + d] : [q[0] + d, q[1]], hit = C.filter((c) => crosses(c, P0, Q0));
        if (!hit.length) { open = true; break; }
        if (!hit.some((c) => c.tall)) over = true;
      }
      if (!open) walls.push({ at: [i, j, 0], side, kind: over ? 'low' : 'full' });
    }
  }
  // ONE GROUND: the map is the largest ground a body walks; a room no doorway of the reading opens, a yard cut off, is
  // closed and read as mass, said
  const wk = new Set(walls.map((w) => `${w.at[0]},${w.at[1]},${w.side}`)), comp = new Int32Array(nx * ny).fill(-1), sizes = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (solid[j * nx + i] || comp[j * nx + i] >= 0) continue;
    const id = sizes.length, q = [[i, j]]; comp[j * nx + i] = id; let n = 0;
    while (q.length) {
      const [a, b] = q.pop(); n++;
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = a + da, e = b + db;
        if (c < 0 || e < 0 || c >= nx || e >= ny || solid[e * nx + c] || comp[e * nx + c] >= 0) continue;
        if (wk.has(da ? `${Math.min(a, c)},${b},e` : `${a},${Math.min(b, e)},n`)) continue;
        comp[e * nx + c] = id; q.push([c, e]);
      }
    }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes, 0));
  let closed = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!solid[j * nx + i] && comp[j * nx + i] !== main) { solid[j * nx + i] = 1; solids.push([i, j, 0]); closed++; }
  if (closed) {
    notes.push(`${closed} cell${closed === 1 ? '' : 's'} of ground no way of the reading leads to (a room whose doorway it does not open) read as mass: the map is one ground`);
    for (let k = walls.length - 1; k >= 0; k--) { const w = walls[k], [i, j] = w.at, a = w.side === 'e' ? i + 1 : i, b = w.side === 'n' ? j + 1 : j; if (solid[j * nx + i] || solid[b * nx + a]) walls.splice(k, 1); }
  }
  notes.push('its edge left open: the ground read is part of a wider land');
  return { nx, ny, nz: 1, floors, solids, walls, ramps: [], ladders: [], read: { cell, origin: [r2(x0), r2(y0)], z: r2(z), notes } };
}
