/**
 * A GLYPH MAP'S ENDS — what a game reads off a level written as a glyph grid (grid.js), read from the grid and the
 * level's one land (era/out-tile.js levelHeight) without building the page: where the hero is set down, where the level
 * is left, the way between and what lies off it, and where each place's door stands.
 *
 *   gridEnds(level) → { spawn, heading, exit, exitFrom, planar, beats, hazards, via, regions, doors: [], places }
 *     spawn     where a walk of the map starts (grid.js mapStart, the page's own spawn), at its path's middle, on the land
 *     exit      a place whose key says `goal` (its door), else the path end the most tiles away along the paths
 *     via       the tiles' middles (on their paths: a bend's along its arc, its quarter points) along the paths from the spawn to the exit (the fewest tiles), the door last
 *     beats     `along` each tile of that way between its ends; `pocket` each path END off it (a side way's end: what
 *               a quest hides or a pack waits in); `landmark` each place standing on it; each its tile and region
 *     map, home a glyph map's ends (true), and the region the walk sets out from (the town the party comes back to)
 *     places    each place's door ({ id, glyph, use?, at, N, region? }: the building's id on the page, its door on the
 *               land, the way out of it), what folk stand by
 * Pure; the land's heights are the level's own, as every tile lays them.
 */
import { readGrid, placeDoors, walkFrom, mapGoal, mapStart } from './grid.js';
import { levelHeight, tilePath } from '../era/out-tile.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const FACING = { '+y': [0, 1], '-y': [0, -1], '+x': [1, 0], '-x': [-1, 0] };

export function gridEnds(level) {
  const G = readGrid(level.grid, 'level.grid'), T = G.tile, L = { seed: level.seed ?? 1, ...(G.rise ? { rise: G.rise } : {}) };
  const on = (x, y) => [r3(x), r3(y), r3(levelHeight(x, y, L))];
  // (a tile's middle on its path: the path's point nearest its centre; an L's path is an arc, its centre off it)
  const mid = (x) => {
    const P = x.kind === 'path' ? tilePath(T, x.open).flat() : [], o = [x.c * T, -(x.r + 1) * T];
    const q = P.reduce((m, p) => (!m || Math.hypot(p[0] - T / 2, p[1] - T / 2) < Math.hypot(m[0] - T / 2, m[1] - T / 2) ? p : m), null) ?? [T / 2, T / 2];
    return on(o[0] + q[0], o[1] + q[1]);
  };
  const id = (x) => `${x.r},${x.c}`, regionOf = (x) => (x.region ? (G.regions[x.region].name ?? x.region) : null);
  // (a place's door on the land: its tile's door point, the way out of it the way it faces)
  const doorOf = (x) => { const s = x.open[0], D = placeDoors(T)[s]; return { at: on(x.c * T + D.x, -(x.r + 1) * T + D.y), N: FACING[D.facing] }; };
  // the network: paths and the places a path reaches, joined across their open sides
  const net = G.cells.filter((x) => x.kind === 'path' || (x.kind === 'place' && x.open?.length));
  const start = mapStart(G);
  if (!start) throw new Error('levels: the glyph map lays no path to set the hero down on');
  const { dist, prev } = walkFrom(G, start), goal = mapGoal(G);
  const ends = net.filter((x) => x.kind === 'path' && x.shape === 'end' && x !== start);
  const last = goal ?? ends.reduce((m, x) => (!m || dist.get(id(x)) > dist.get(id(m)) ? x : m), null) ?? start;
  const way = []; for (let x = last; x; x = prev.get(id(x))) way.unshift(x);
  const onWay = new Set(way.map(id));
  const spawn = mid(start), exitAt = last.kind === 'place' ? doorOf(last).at : mid(last);
  // (a bend is walked along its arc: its quarter points too, in the order the way enters it)
  const along = (x, i) => {
    if (x.kind !== 'path' || x.shape !== 'L') return [mid(x)];
    const A = tilePath(T, x.open)[0], o = [x.c * T, -(x.r + 1) * T], from = way[i - 1];
    const P = from && (Math.hypot(A[0][0] + o[0] - (from.c + 0.5) * T, A[0][1] + o[1] + (from.r + 0.5) * T) > Math.hypot(A.at(-1)[0] + o[0] - (from.c + 0.5) * T, A.at(-1)[1] + o[1] + (from.r + 0.5) * T)) ? [...A].reverse() : A;
    return [0.25, 0.5, 0.75].map((t) => { const q = P[Math.round(t * (P.length - 1))]; return on(o[0] + q[0], o[1] + q[1]); });
  };
  const via = [...way.flatMap((x, i) => (x.kind === 'path' ? along(x, i) : [])), ...(last.kind === 'place' ? [exitAt] : [])];
  const toward = via[1] ?? exitAt;
  const tag = (x) => ({ tile: [x.r, x.c], ...(regionOf(x) ? { region: regionOf(x) } : {}) });
  const beats = [
    ...way.slice(1, -1).filter((x) => x.kind === 'path').map((x) => ({ beat: 'along', at: mid(x), ...tag(x) })),
    ...ends.filter((x) => !onWay.has(id(x))).sort((a, b) => dist.get(id(a)) - dist.get(id(b))).map((x) => ({ beat: 'pocket', at: mid(x), ...tag(x) })),
    ...net.filter((x) => x.kind === 'place' && x !== last && way.some((w) => Math.abs(w.r - x.r) + Math.abs(w.c - x.c) === 1)).map((x) => ({ beat: 'landmark', at: doorOf(x).at, ...tag(x) })),
  ];
  const places = net.filter((x) => x.kind === 'place').map((x) => ({ id: `${x.glyph}-${x.r}-${x.c}`, glyph: x.glyph, ...(x.place?.use ? { use: x.place.use } : {}), ...doorOf(x), ...(regionOf(x) ? { region: regionOf(x) } : {}) }));
  const out = {
    spawn, heading: r3(Math.atan2(toward[1] - spawn[1], toward[0] - spawn[0])), exit: exitAt,
    exitFrom: last.kind === 'place' ? `the ${last.place?.use ?? 'place'}'s door (${last.glyph})` : 'the path\'s far end',
    planar: true, beats, hazards: [], via: via.map((p) => [p[0], p[1]]), doors: [], places, map: true, ...(regionOf(start) ? { home: regionOf(start) } : {}),
    ...(G.regions ? { regions: Object.fromEntries(Object.entries(G.regions).map(([k, v]) => [k, v.name ?? k])) } : {}),
  };
  // the land's height at a point, as every tile lays it (not data)
  Object.defineProperty(out, 'ground', { value: (x, y) => levelHeight(x, y, L), enumerable: false });
  return out;
}
