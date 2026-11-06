/**
 * OUT-TILE — one square tile of a glyph map (level/grid.js) as a SITE, in the shape every outdoor builder reads (the
 * trail site's and nature.js natureSite's: ground, trailDist, halfWAt, trailX, the grid…), so the kit's own builder
 * lays a tile's grass, rocks and trees as it lays a trail's. A tile is the square [0, size] × [0, size] of its own frame
 * (x east, y north), its south-west corner at `origin` on the level's frame; tiles are never turned.
 *
 *   THE PATH: from the middle of each open edge to the tile's centre (an END stops there, an I runs straight through, a
 *             T and an X meet at the centre); an L is a quarter arc round the corner its two edges share, so it reads
 *             as a bend, never a kink. A tile with no open edge (open land, a place's ground) has no path.
 *   THE GROUND: one height over the whole level (levelHeight: rolling land at the level's scale, a little roll on it),
 *             read at the tile's own place, so every tile meets its neighbours at their shared edge by construction. The
 *             path's bed eases level across it (its height the land's at the nearest point of the path), as a trail's
 *             does: so where two tiles' paths meet at an edge's middle, they meet at one height.
 *
 *   outTileSite(st, tile, seed) → a site; tile: { size, open: ['n' | 'e' | 's' | 'w'], origin: [x, y], level?: { seed,
 *                                 hills, roll, rise } }
 *   tilePath(size, open)        → the path's polylines in the tile's frame
 *   levelHeight(x, y, L)        → the level's land at (x, y) of the level's frame (L.rise: the regions' rise, riseAt)
 * Pure.
 */
import { vnoise } from './dirt.js';
import { landformGrid, bakeGrid, gridSample } from '../polygonizer/landform.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** The level's land: rolling hills a long stride apart, a gentle roll over them (metres). */
export const LEVEL_LAND = Object.freeze({ hills: 5, stride: 90, roll: 0.8, rollStride: 18 });
export function levelHeight(x, y, L = {}) {
  const s = (L.seed ?? 1) | 0, H = L.hills ?? LEVEL_LAND.hills, R = L.roll ?? LEVEL_LAND.roll;
  return H * (vnoise(x / LEVEL_LAND.stride, y / LEVEL_LAND.stride, s + 501) - 0.5) * 2 + R * (vnoise(x / LEVEL_LAND.rollStride, y / LEVEL_LAND.rollStride, s + 503) - 0.5) * 2 + (L.rise ? riseAt(x, y, L.rise) : 0);
}

/**
 * A region's RISE (level/grid.js regions): each tile's rise stands at its centre and eases to its neighbours' between
 * them (smoothstep across each pair of centres, so the land is level round a tile's middle and climbs between): one
 * continuous height over the whole map, whatever the regions. rise: { tile, cols, rows, z: [per tile, north row first] }.
 */
export function riseAt(x, y, R) {
  const T = R.tile, u = Math.max(0, Math.min(R.cols - 1, x / T - 0.5)), v = Math.max(0, Math.min(R.rows - 1, -y / T - 0.5));
  const i = Math.min(R.cols - 2, Math.floor(u)), j = Math.min(R.rows - 2, Math.floor(v));
  const at = (r, c) => R.z[Math.max(0, Math.min(R.rows - 1, r)) * R.cols + Math.max(0, Math.min(R.cols - 1, c))];
  const ease = (t) => t * t * (3 - 2 * t), fu = R.cols > 1 ? ease(u - Math.max(0, i)) : 0, fv = R.rows > 1 ? ease(v - Math.max(0, j)) : 0;
  const c0 = Math.max(0, i), r0 = Math.max(0, j);
  const top = mix(at(r0, c0), at(r0, c0 + 1), fu), bot = mix(at(r0 + 1, c0), at(r0 + 1, c0 + 1), fu);
  return mix(top, bot, fv);
}

// an edge's middle in the tile's frame
const MID = (T) => ({ n: [T / 2, T], s: [T / 2, 0], e: [T, T / 2], w: [0, T / 2] });
const CORNER = (T) => ({ ne: [T, T], nw: [0, T], se: [T, 0], sw: [0, 0] });

/** The path's polylines in the tile's frame (points every half metre). */
export function tilePath(T, open) {
  const M = MID(T), C = [T / 2, T / 2], step = 0.5, line = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); };
  if (!open.length) return [];
  if (open.length === 2 && !(open.includes('n') && open.includes('s')) && !(open.includes('e') && open.includes('w'))) {
    // an L: a quarter arc round the shared corner, radius half the tile
    const key = (open.includes('n') ? 'n' : 's') + (open.includes('e') ? 'e' : 'w'), K = CORNER(T)[key], a = M[open[0]], b = M[open[1]];
    const a0 = Math.atan2(a[1] - K[1], a[0] - K[0]), a1 = Math.atan2(b[1] - K[1], b[0] - K[0]);
    let d = a1 - a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    const n = Math.ceil((Math.abs(d) * T) / 2 / step);
    return [Array.from({ length: n + 1 }, (_, k) => { const t = a0 + (d * k) / n; return [K[0] + (T / 2) * Math.cos(t), K[1] + (T / 2) * Math.sin(t)]; })];
  }
  return open.map((s) => line(M[s], C));
}

// the distance from (x, y) to the polylines, and the nearest point on them
function nearest(paths, x, y) {
  let best = Infinity, at = null;
  for (const P of paths) for (let i = 0; i < P.length - 1; i++) {
    const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (d < best) { best = d; at = [px, py]; }
  }
  return { d: best, at };
}

export function outTileSite(st, tile, seed = 1) {
  const T = tile.size, open = tile.open ?? [], [ox, oy] = tile.origin ?? [0, 0], L = { seed: tile.level?.seed ?? seed, ...(tile.level ?? {}) };
  const halfW = st.trail.width / 2, paths = tilePath(T, open);
  const halfWAt = () => halfW, fringeAt = () => st.trail.fringe;
  const land = (x, y) => levelHeight(ox + x, oy + y, L);
  const trailDist = (x, y) => (paths.length ? nearest(paths, x, y).d : Infinity);
  // the path's line across the tile at a depth y: where its points stand nearest that depth (the middle with no path)
  const trailX = (y) => { let bx = T / 2, bd = Infinity; for (const P of paths) for (const p of P) { const d = Math.abs(p[1] - y) + 0.01 * Math.abs(p[0] - T / 2); if (d < bd) { bd = d; bx = p[0]; } } return bx; };
  // the ground: the land, its path's bed eased level across it at the land's height on the path
  const valley = (x, y) => {
    if (!paths.length) return land(x, y);
    const N = nearest(paths, x, y), k = smooth(halfW + st.trail.fringe + 0.8, halfW * 0.5, N.d);
    return mix(land(x, y), land(N.at[0], N.at[1]) - 0.08, k);
  };
  const Lf = st.landform, g = landformGrid({ x0: 0, x1: T, y0: 0, y1: T, res: Math.round(T / Lf.cell) + 1 });
  bakeGrid(g, valley);
  const ground = (x, y) => gridSample(g, x, y), apronAt = () => 0;
  // (open ground: no cliff in the tile; its line past the tile's west edge, out of every placement's reach)
  const cliffX = () => -40;
  // the composition's foci: the path's middle, where a tile has one
  const foci = paths.length ? [{ name: 'tile', x: T / 2, y: T / 2, r: Math.min(10, T / 4) }] : [];
  const inRadius = (x, y) => foci.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
  return { W: T, D: T, halfW, halfWAt, fringeAt, trailX, trailDist, cliffX, ground, valley, apronAt, grid: g, scree: [], foci, inRadius, open: true, tile: { size: T, open, origin: [ox, oy], paths, seed: L.seed } };
}

/** A point `u` (0…1) of the way along a site's path, and its right hand ({ c: [x, y], n }): a trail's line by depth; a
 *  tile's polylines (era/out-tile.js) by their length, one after another. `length` its metres (0: no path). */
export function pathAlong(site) {
  // (a trail's: its line at a depth, its right hand straight across x, as its stones were always laid)
  if (!site.tile) return { length: site.D, at: (u) => { const y = site.D * u; return { c: [site.trailX(y), y], n: [1, 0] }; } };
  const segs = [];
  let total = 0;
  for (const P of site.tile.paths) for (let i = 0; i + 1 < P.length; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if (l > 0) { segs.push({ a: P[i], b: P[i + 1], l, s: total }); total += l; } }
  return {
    length: total,
    at: (u) => {
      const s = Math.max(0, Math.min(1, u)) * total, k = segs.findIndex((g) => s <= g.s + g.l), g = segs[k < 0 ? segs.length - 1 : k], t = (s - g.s) / g.l;
      const dx = (g.b[0] - g.a[0]) / g.l, dy = (g.b[1] - g.a[1]) / g.l;
      return { c: [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t], n: [dy, -dx] };
    },
  };
}
