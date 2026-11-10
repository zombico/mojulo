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
 *   outTileSite(st, tile, seed) → a site; tile: { size, open: ['n' | 'e' | 's' | 'w'], origin: [x, y], cell?, level?: { seed,
 *                                 hills, roll, rise } }
 *   tilePath(size, open)        → the path's polylines in the tile's frame
 *   levelHeight(x, y, L)        → the level's land at (x, y) of the level's frame (L.rise: the regions' rise, riseAt)
 * Pure.
 */
import { vnoise } from './dirt.js';
import { landformGrid, bakeGrid, gridSample } from '../polygonizer/landform.js';
import { tileWater } from './out-tile-water.js';

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

// the nearest point on the polylines with where it lies: its polyline, its segment and how far along it
function nearestAt(paths, x, y) {
  let best = { d: Infinity, at: null, p: 0, i: 0, t: 0 };
  for (let p = 0; p < paths.length; p++) {
    const P = paths[p];
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
      if (d < best.d) best = { d, at: [px, py], p, i, t };
    }
  }
  return best;
}

/**
 * A WAY OF RANK on a tile (level/path-ranks.js): its width and verge at the tile's middle, each open edge's at the edge,
 * eased between over the outer three quarters of each half (TAPER), and wandering a little (WAY_WANDER, a share of the
 * width) on the level's frame, so two tiles read one width where their ways meet. → per polyline, per point { w, f }
 * (the whole width and the verge).
 */
export const TAPER = 0.25;
export const WAY_WANDER = Object.freeze({ share: 0.1, stride: 7 });
function wayWidths(T, open, paths, way, [ox, oy], seed) {
  const C = [T / 2, T / 2], ease = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const edge = (s) => way.edges?.[s] ?? { width: way.width, fringe: way.fringe };
  const wander = (x, y) => 1 + WAY_WANDER.share * (2 * vnoise((ox + x) / WAY_WANDER.stride, (oy + y) / WAY_WANDER.stride, seed + 911) - 1);
  const at = (p, e, t) => { const k = ease(TAPER, 1, t); return { w: mix(way.width, e.width, k) * wander(p[0], p[1]), f: mix(way.fringe, e.fringe, k) }; };
  const L = open.length === 2 && paths.length === 1;
  return paths.map((P) => {
    if (L) {
      // (an L's arc, from one edge to the other: each end its edge's, the middle the tile's)
      const n = P.length - 1;
      return P.map((p, k) => { const u = n ? k / n : 0; return at(p, edge(u < 0.5 ? open[0] : open[1]), Math.abs(1 - 2 * u)); });
    }
    // (a branch from an edge's middle to the tile's: open[i] its edge, `t` how far out from the middle)
    const s = open[paths.indexOf(P)];
    return P.map((p) => at(p, edge(s), Math.min(1, Math.hypot(p[0] - C[0], p[1] - C[1]) / (T / 2))));
  });
}

export function outTileSite(st, tile, seed = 1) {
  const T = tile.size, open = tile.open ?? [], [ox, oy] = tile.origin ?? [0, 0], L = { seed: tile.level?.seed ?? seed, ...(tile.level ?? {}) };
  const paths = tilePath(T, open), land0 = (x, y) => levelHeight(ox + x, oy + y, L);
  // (THE MAP'S WATER, `tile.water` (era/out-tile-water.js): its bodies cut into the level's one land, a beach or a cliff
  // at their edge; the land the rest of the tile reads is the land with the water in it)
  const WT = tile.water ? tileWater({ ...tile.water, seed: tile.water.seed ?? L.seed }, { size: T, origin: [ox, oy], land: land0, fill: st.water?.fill ?? '#3a8cb8' }) : null;
  const land = WT ? (x, y) => WT.carve(x, y, land0(x, y)) : land0;
  // (a way of rank, `tile.way`: its width read where it is, the walk's tests against its edge kept true by `trailDist`
  // standing that much nearer or further; absent, the kit's one width, as it always was)
  const WW = tile.way && paths.length ? wayWidths(T, open, paths, tile.way, [ox, oy], L.seed) : null;
  const halfW = WW ? tile.way.width / 2 : st.trail.width / 2, fringe0 = WW ? tile.way.fringe : st.trail.fringe;
  const halfWAt = () => halfW, fringeAt = () => fringe0;
  // (the way's half-width and verge at the point of it nearest (x, y))
  const wayAt = WW ? (N) => { const A = WW[N.p][N.i], B = WW[N.p][Math.min(WW[N.p].length - 1, N.i + 1)]; return { h: mix(A.w, B.w, N.t) / 2, f: mix(A.f, B.f, N.t) }; } : null;
  const halfAt = WW ? (x, y) => wayAt(nearestAt(paths, x, y)).h : () => halfW;
  const fringeAtXY = WW ? (x, y) => wayAt(nearestAt(paths, x, y)).f : () => fringe0;
  const trailDist = WW ? (x, y) => { const N = nearestAt(paths, x, y); return Math.max(0, N.d - (wayAt(N).h - halfW)); } : (x, y) => (paths.length ? nearest(paths, x, y).d : Infinity);
  // the path's line across the tile at a depth y: where its points stand nearest that depth (the middle with no path)
  const trailX = (y) => { let bx = T / 2, bd = Infinity; for (const P of paths) for (const p of P) { const d = Math.abs(p[1] - y) + 0.01 * Math.abs(p[0] - T / 2); if (d < bd) { bd = d; bx = p[0]; } } return bx; };
  // the ground: the land, its path's bed eased level across it at the land's height on the path
  const valley = (x, y) => {
    if (!paths.length) return land(x, y);
    // (a way's bed is the land's where it runs, never the water's: a way beside the shore keeps its bank)
    if (WW) { const N = nearestAt(paths, x, y), A = wayAt(N), k = smooth(A.h + A.f + 0.8, A.h * 0.5, N.d); return mix(land(x, y), Math.max(land(N.at[0], N.at[1]), land0(N.at[0], N.at[1])) - 0.08, k); }
    const N = nearest(paths, x, y), k = smooth(halfW + st.trail.fringe + 0.8, halfW * 0.5, N.d);
    return mix(land(x, y), land(N.at[0], N.at[1]) - 0.08, k);
  };
  // (`cell`: a tile's own ground cell, coarser where nobody walks; else the kit's)
  const Lf = st.landform, g = landformGrid({ x0: 0, x1: T, y0: 0, y1: T, res: Math.round(T / (tile.cell ?? Lf.cell)) + 1 });
  bakeGrid(g, valley);
  const ground = (x, y) => gridSample(g, x, y), apronAt = () => 0;
  // (open ground: no cliff in the tile; its line past the tile's west edge, out of every placement's reach)
  const cliffX = () => -40;
  // the composition's foci: the path's middle, where a tile has one
  const foci = paths.length ? [{ name: 'tile', x: T / 2, y: T / 2, r: Math.min(10, T / 4) }] : [];
  const inRadius = (x, y) => foci.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
  // (`boulders`: how many the tile strews along its path, a sketched rocky tile's: level/map-sketch.js; absent, the kit's)
  return { W: T, D: T, halfW, halfWAt, fringeAt, trailX, trailDist, cliffX, ground, valley, apronAt, grid: g, scree: [], foci, inRadius, open: true, ...(tile.boulders !== undefined ? { boulders: tile.boulders } : {}),
    ...(WT ? { water: WT, wet: WT.bare, clear: WT.clear } : {}), tile: { size: T, open, origin: [ox, oy], paths, seed: L.seed, ...(WW ? { halfAt, fringeAt: fringeAtXY, way: tile.way } : {}) } };
}

/** A point `u` (0…1) of the way along a site's path, and its right hand ({ c: [x, y], n }): a trail's line by depth; a
 *  tile's polylines (era/out-tile.js) by their length, one after another (a way of rank's half-width and verge there,
 *  `h` and `f`). `length` its metres (0: no path). */
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
      const c = [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t];
      // (a way of rank: its half-width and verge there, `h` and `f`, for what is set along its edge)
      return { c, n: [dy, -dx], ...(site.tile.halfAt ? { h: site.tile.halfAt(c[0], c[1]), f: site.tile.fringeAt(c[0], c[1]) } : {}) };
    },
  };
}
