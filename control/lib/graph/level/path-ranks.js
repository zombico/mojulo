/**
 * PATH RANKS — the ways of a glyph map (grid.js) told apart by what they carry, so a map reads as roads, tracks and
 * footpaths and not one dirt line everywhere. A path tile's RANK is solved from the network, never written tile by tile:
 *
 *   road    the TRUNK where it runs through a town (a tile within TOWN_REACH of a building) or on a way joining two
 *           places, door to door: wide, laid (setts beside the houses, a stone road out of them), a narrow verge
 *   track   the rest of the trunk: the kit's own trail, beaten earth
 *   path    a BRANCH off the trunk that leads somewhere (a place, or on to more ways): a footpath, narrower
 *   trace   a branch that leads to nothing (a dead end no place stands at): a game trail worn into the grass
 *
 * THE TRUNK is every path tile on a shortest way between two of the map's TERMINALS: its places' doors, its start
 * (grid.js mapStart), and, for a planned map (plan.js), each gate between its segments. A map with no goal (or fewer
 * than two terminals) adds the path end farthest from its start, so the walk's way is the trunk. A BRANCH leads
 * somewhere when it reaches a terminal, forks, or meets the trunk at two tiles or more (a way through: a loop round a
 * pond); else it is a dead end, a trace.
 *
 * A REGION may say its own (`path`, grid.js REGION_WORDS): a rank word, or { rank?, surface?, width? } over its tiles'
 * solved rank (a ruined town's roads earth, a pass's way a trace).
 *
 * WIDTHS MEET AT EVERY EDGE: an edge between two path tiles is as wide as the wider of them (a road runs on into a track
 * at its own width and narrows inside the track's tile), a door's edge as wide as its tile; a tile's own width is at its
 * middle. era/out-tile.js lays them (halfAt) and wanders them a little on the level's frame, so both tiles of an edge
 * read one width there.
 *
 *   PATH_RANKS                 the ranks: { width, fringe, surface, town? } (metres; surface a trail-dress word)
 *   pathRanks(G)               → Map('r,c' → { rank, width, fringe, surface, town, edges: { <side>: { width, fringe } } }) for every path
 *                                tile; { trunk } the trunk's tiles, for a readout
 *   rankWords(v, at)           a region's `path`, checked → { rank?, surface?, width? }
 * Pure.
 */
import { SIDES, mapStart, mapGoal } from './grid.js';

export const PATH_RANKS = Object.freeze({
  road: Object.freeze({ width: 4.2, fringe: 0.45, surface: 'stone-road', town: 'setts' }),
  track: Object.freeze({ width: 2.4, fringe: 0.8, surface: 'earth' }),
  path: Object.freeze({ width: 1.5, fringe: 0.7, surface: 'earth' }),
  trace: Object.freeze({ width: 0.9, fringe: 0.75, surface: 'earth' }),
});
export const RANK_ORDER = Object.freeze(['trace', 'path', 'track', 'road']);
// (how near a building a trunk tile is a town's street, in tiles, across or along)
export const TOWN_REACH = 1;
// (the narrowest and widest a region may make a way, metres)
export const RANK_WIDTH = Object.freeze({ lo: 0.6, hi: 7 });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const key = (r, c) => `${r},${c}`;

/** A region's `path`: a rank word, or { rank?, surface?, width? }. */
export function rankWords(v, at = 'path') {
  if (typeof v === 'string') { if (!PATH_RANKS[v]) throw new Error(`level: ${at} '${v}' is not a way's rank (${RANK_ORDER.join(', ')})`); return { rank: v }; }
  if (!isObj(v)) throw new Error(`level: ${at} is a rank (${RANK_ORDER.join(', ')}) or { rank?, surface?, width? }`);
  for (const k of Object.keys(v)) if (!['rank', 'surface', 'width'].includes(k)) throw new Error(`level: ${at}.${k} is not a way's setting (settings: rank, surface, width)`);
  if (v.rank !== undefined && !PATH_RANKS[v.rank]) throw new Error(`level: ${at}.rank '${v.rank}' is not a way's rank (${RANK_ORDER.join(', ')})`);
  if (v.surface !== undefined && typeof v.surface !== 'string') throw new Error(`level: ${at}.surface is a ground word (a trail's surface: earth, gravel, stone-road, setts, flags…)`);
  if (v.width !== undefined && !(typeof v.width === 'number' && v.width >= RANK_WIDTH.lo && v.width <= RANK_WIDTH.hi)) throw new Error(`level: ${at}.width is metres across, ${RANK_WIDTH.lo} to ${RANK_WIDTH.hi}`);
  return { ...v };
}

// the path tiles as a graph: each tile's neighbours along its open edges (a path tile, never a place)
function graphOf(G) {
  const path = new Map(G.cells.filter((x) => x.kind === 'path').map((x) => [key(x.r, x.c), x]));
  const next = (x) => (x.open ?? []).map((s) => path.get(key(x.r + SIDES[s][0], x.c + SIDES[s][1]))).filter(Boolean);
  return { path, next };
}
// every tile's distance from `from` along the paths and the tile it was reached from (the first in clockwise order on a
// tie, as the open edges are listed: deterministic)
function bfs(next, from) {
  const dist = new Map([[key(from.r, from.c), 0]]), prev = new Map(), q = [from];
  while (q.length) { const x = q.shift(); for (const y of next(x)) { const k = key(y.r, y.c); if (!dist.has(k)) { dist.set(k, dist.get(key(x.r, x.c)) + 1); prev.set(k, x); q.push(y); } } }
  return { dist, prev };
}

/** The ranks of a map's ways (see the header). → Map('r,c' → { rank, width, fringe, surface, edges }), with `.trunk`. */
export function pathRanks(G) {
  const { path, next } = graphOf(G), out = new Map();
  out.trunk = new Set();
  if (!path.size) return out;
  // THE TERMINALS: the path tile at each place's door, the start, each gate's two tiles
  const terms = new Map(), add = (x) => { if (x && path.has(key(x.r, x.c))) terms.set(key(x.r, x.c), x); }, doors = new Set();
  for (const p of G.cells) if (p.kind === 'place' && p.open?.length) { const s = p.open[0], d = path.get(key(p.r + SIDES[s][0], p.c + SIDES[s][1])); add(d); if (d) doors.add(key(d.r, d.c)); }
  const start = mapStart(G);
  add(start);
  for (const g of G.plan?.gates ?? []) for (const t of g.tiles ?? []) add(path.get(key(t[0], t[1])));
  // (a map with no goal, or too few terminals: the path end farthest from the start, so the walk's way is the trunk)
  if (terms.size < 2 || !mapGoal(G)) {
    const from = start && path.has(key(start.r, start.c)) ? start : [...path.values()][0], { dist } = bfs(next, from);
    let far = null; for (const [k, d] of dist) if (path.get(k).shape === 'end' && (!far || d > far.d)) far = { k, d };
    if (far) add(path.get(far.k));
  }
  // THE TRUNK: every tile on a shortest way between two terminals; THE ROADS among it, those on a way between two doors
  const T = [...terms.values()], roads = new Set();
  for (let i = 0; i < T.length; i++) {
    const { prev } = bfs(next, T[i]);
    for (let j = i + 1; j < T.length; j++) {
      let k = key(T[j].r, T[j].c);
      if (k !== key(T[i].r, T[i].c) && !prev.has(k)) continue;
      const between = doors.has(key(T[i].r, T[i].c)) && doors.has(k);
      for (;;) { out.trunk.add(k); if (between) roads.add(k); const p = prev.get(k); if (!p) break; k = key(p.r, p.c); }
    }
  }
  // (a town: within TOWN_REACH of a building place, across or along)
  const places = G.cells.filter((x) => x.kind === 'place');
  const inTown = (x) => places.some((p) => Math.max(Math.abs(p.r - x.r), Math.abs(p.c - x.c)) <= TOWN_REACH);
  // a BRANCH's tiles (off the trunk): whether it leads anywhere (a place's door, or more of the map's ways past it), by the
  // ways reached from it without crossing the trunk
  const leads = new Map();
  for (const [k, x] of path) {
    if (out.trunk.has(k) || leads.has(k)) continue;
    // (the branch's tiles: off the trunk, joined; it leads somewhere when any of them stands at a door, or forks)
    const seen = [x], set = new Set([k]);
    for (let i = 0; i < seen.length; i++) for (const y of next(seen[i])) { const ky = key(y.r, y.c); if (!out.trunk.has(ky) && !set.has(ky)) { set.add(ky); seen.push(y); } }
    // (or it is a way through: it meets the trunk at two tiles or more, a loop round a pond, a second road between two)
    const meets = new Set(); for (const y of seen) for (const z of next(y)) { const kz = key(z.r, z.c); if (out.trunk.has(kz)) meets.add(kz); }
    const somewhere = meets.size >= 2 || seen.some((y) => terms.has(key(y.r, y.c)) || y.shape === 'T' || y.shape === 'X');
    for (const y of seen) leads.set(key(y.r, y.c), somewhere);
  }
  for (const [k, x] of path) {
    const rank0 = out.trunk.has(k) ? (inTown(x) || roads.has(k) ? 'road' : 'track') : leads.get(k) ? 'path' : 'trace';
    // (a region's own words over the solved rank)
    const R = x.region ? G.regions?.[x.region]?.path : undefined, own = R === undefined ? {} : rankWords(R, `regions.key.${x.region}.path`);
    const rank = own.rank ?? rank0, P = PATH_RANKS[rank];
    const surface = own.surface ?? (rank === 'road' && P.town && inTown(x) ? P.town : P.surface);
    out.set(k, { rank, width: own.width ?? P.width, fringe: P.fringe, surface, town: inTown(x) });
  }
  // THE EDGES: as wide as the wider of their two tiles, its verge that tile's (a door's, its own tile's)
  for (const [k, x] of path) {
    const me = out.get(k), edges = {};
    for (const s of x.open ?? []) { const y = out.get(key(x.r + SIDES[s][0], x.c + SIDES[s][1])), w = y && y.width > me.width ? y : me; edges[s] = { width: w.width, fringe: w.fringe }; }
    me.edges = edges;
  }
  return out;
}
