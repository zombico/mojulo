/**
 * THE MAP'S WATER — a glyph map's water tiles (grid.js `~`, an approved sketch's `w`: map-sketch.js) gathered into
 * BODIES, each at one level, and each shore tile's EDGE: what era/out-tile-water.js cuts into every tile near them.
 *
 *   A BODY      water tiles joined side by side; its LEVEL stands SHORE.under under the lowest of the land along its
 *               outline (sampled every OUTLINE_STEP metres on its edges with the land, not the map's edge), so no shore
 *               is under it
 *   AN EDGE     each land tile beside water (across or along) says what its shore is: 1 a CLIFF, 0 a BEACH. Written: its
 *               region's `shore` ('beach' | 'cliff'), else its sketched ground (a cliff `c` or rocks `r`: a cliff; a
 *               meadow, a grove, scrub or a forest: by the drop); else by the DROP, the land at its middle over the
 *               water's level: past CLIFF_DROP metres the land stands as a cliff, under it a beach runs down
 *
 *   A PLACE     beside the water keeps its land as it lies (handed on as `hold`: era/out-tile-water.js)
 *
 *   mapWater(G, { seed, ground? }) → null (no water) | { cells: [[r, c, body]], levels, shore: [[r, c, k]], bodies:
 *                                    [{ id, tiles, level, beach, cliff }], near(r, c) → the tile's `water` or null }
 *                                    (G: readGrid's, with levelGrid's rise and sketch; `ground` the sketch's ground map)
 * Pure.
 */
import { levelHeight } from '../era/out-tile.js';
import { SHORE } from '../era/out-tile-water.js';

export const CLIFF_DROP = 2.6;
// (the outline's sampling, m; how far round a water tile its neighbours are handed it, in tiles)
export const OUTLINE_STEP = 2;
export const WATER_REACH = 3;
export const SHORE_WORDS = Object.freeze(['beach', 'cliff']);
const STEPS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

/** The water tiles of a map: a grid's `~`, and an approved sketch's `w` on open land (never on a path or a place). */
export function waterTiles(G) {
  const out = new Set();
  for (const x of G.cells) if (x.water || (x.kind === 'land' && G.sketch?.ground?.get(`${x.r},${x.c}`) === 'w')) out.add(`${x.r},${x.c}`);
  return out;
}

export function mapWater(G, { seed = 1 } = {}) {
  const wet = waterTiles(G);
  if (!wet.size) return null;
  const T = G.tile, L = { seed, ...(G.rise ? { rise: G.rise } : {}) }, land = (x, y) => levelHeight(x, y, L);
  const inMap = (r, c) => r >= 0 && c >= 0 && r < G.rows && c < G.cols;
  // THE BODIES: water tiles joined side by side, in reading order
  const body = new Map(), bodies = [];
  for (const x of G.cells) {
    const k = `${x.r},${x.c}`;
    if (!wet.has(k) || body.has(k)) continue;
    const id = bodies.length, tiles = [[x.r, x.c]], q = [[x.r, x.c]];
    body.set(k, id);
    while (q.length) {
      const [r, c] = q.shift();
      for (const [dr, dc] of STEPS) { const kk = `${r + dr},${c + dc}`; if (wet.has(kk) && !body.has(kk)) { body.set(kk, id); tiles.push([r + dr, c + dc]); q.push([r + dr, c + dc]); } }
    }
    // ITS LEVEL: under the lowest land along its outline's edges with the land (a body with none, under its own lowest)
    let lo = Infinity;
    for (const [r, c] of tiles) for (const [dr, dc] of STEPS) {
      const r2 = r + dr, c2 = c + dc;
      if (!inMap(r2, c2) || wet.has(`${r2},${c2}`)) continue;
      // (the shared edge's line, sampled along it)
      for (let t = 0; t <= T + 1e-9; t += OUTLINE_STEP) {
        const [x, y] = dr ? [c * T + t, dr < 0 ? -r * T : -(r + 1) * T] : [dc > 0 ? (c + 1) * T : c * T, -r * T - t];
        lo = Math.min(lo, land(x, y));
      }
    }
    if (lo === Infinity) for (const [r, c] of tiles) lo = Math.min(lo, land((c + 0.5) * T, -(r + 0.5) * T));
    bodies.push({ id, tiles, level: Math.round((lo - SHORE.under) * 1e5) / 1e5 });
  }
  // THE EDGES: each land tile beside a body (across or along), by its words, its sketch, else its drop
  const shore = [];
  for (const x of G.cells) {
    const k = `${x.r},${x.c}`;
    if (wet.has(k)) continue;
    let near = null;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const b = body.get(`${x.r + dr},${x.c + dc}`); if (b !== undefined && (near === null || bodies[b].level < bodies[near].level)) near = b; }
    if (near === null) continue;
    const said = x.region ? G.regions?.[x.region]?.shore : undefined;
    if (said !== undefined && !SHORE_WORDS.includes(said)) throw new Error(`level: regions.key.${x.region}.shore is '${SHORE_WORDS.join("' or '")}' (the edge its water has on its tiles)`);
    const g = G.sketch?.ground?.get(k);
    const drop = land((x.c + 0.5) * T, -(x.r + 0.5) * T) - bodies[near].level;
    const kind = said ?? (g === 'c' || g === 'r' ? 'cliff' : drop > CLIFF_DROP ? 'cliff' : 'beach');
    shore.push([x.r, x.c, kind === 'cliff' ? 1 : 0]);
    bodies[near][kind] = (bodies[near][kind] ?? 0) + 1;
  }
  const cells = [...body].map(([k, b]) => { const [r, c] = k.split(',').map(Number); return [r, c, b]; });
  // (the places, their land held as it lies round them: era/out-tile-water.js)
  const places = G.cells.filter((x) => x.kind === 'place').map((x) => [x.r, x.c]);
  const levels = bodies.map((b) => b.level);
  // what a tile is handed: the water and the shore within WATER_REACH of it, or null when none is near
  const within = (r, c) => ([r2, c2]) => Math.max(Math.abs(r2 - r), Math.abs(c2 - c)) <= WATER_REACH;
  const near = (r, c) => {
    const cs = cells.filter(within(r, c));
    if (!cs.some(([r2, c2]) => Math.max(Math.abs(r2 - r), Math.abs(c2 - c)) <= 2)) return null;
    const hold = places.filter(within(r, c));
    return { rows: G.rows, cols: G.cols, cells: cs, levels, shore: shore.filter(within(r, c)), ...(hold.length ? { hold } : {}) };
  };
  return { cells, levels, shore, bodies: bodies.map((b) => ({ id: b.id, tiles: b.tiles, level: b.level, beach: b.beach ?? 0, cliff: b.cliff ?? 0 })), near };
}
