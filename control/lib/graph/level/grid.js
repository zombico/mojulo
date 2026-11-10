/**
 * THE GLYPH GRID — a map level written as a small grid of characters, one SQUARE tile each, the way a floorplan is
 * written in room glyphs. Every tile is the same square, so tiles always sit side by side: no tile lies over another,
 * and every seam is a shared edge.
 *
 *   grid: {
 *     tile?: 48,                     // metres a side (GRID_TILE)
 *     rows: [                        // north row first; a space between glyphs is allowed and ignored
 *       '. . # . .',
 *       '. t # t .',
 *       '# # # # #',
 *       '. . # . S',
 *     ],
 *     key?: { <glyph>: <what stands on it> },   // the PLACES the geocube lays round the paths (a town block, a
 *                                               // building, a wood…); '#' a path, '.' open land and '~' water
 *                                               // (era/out-tile-water.js: a body, its edge a beach or a cliff) are
 *                                               // always known
 *     regions?: { rows, key },                  // a second layer of glyphs, the map's own shape: each tile's REGION
 *   }                                           // ('.' the level's own)
 *
 * Or PLANNED (plan.js): `{ tile?, plan, segments? }` in place of rows, key and regions: the segments laid out, the walk
 * through them, each segment written on its own (or laid from the plan), stitched into one grid here, each segment its
 * region; the read carries `plan`, its readout (the route, the gates, the roles, which segments are written).
 *
 * A REGION (`regions.key.<letter>`: REGION_WORDS) names a part of the map (the town, the meadows, the larch woods, the
 * pass) and dresses its tiles: the stage's own words each is built with (its look, what grows there, its grass), and
 * its RISE, metres over the level's land, eased between tile centres so the land stays one height across every seam.
 *
 * A PLACE has one DOOR: the side of it its key names (`door: 'n' | 'e' | 's' | 'w'`), else the side whose path tile is
 * the main road (the one with the most paths of its own round it; the first clockwise from north on a tie). A path
 * opens toward a place only where that place's door faces it, so no road runs into a building's back.
 *
 * A PATH tile's shape is SOLVED from its path neighbours, never written: its open edges are the sides a path tile
 * (or a place a path reaches: a building's door) lies on. One edge open is an END, two opposite an I, two adjacent an
 * L, three a T, four an X; the shape's turn says which edges (the I running north–south or east–west, the L's
 * corner, the T's stem). A path crosses an edge at its middle, so two tiles' paths always meet.
 *
 *   readGrid(g)  → { tile, rows, cols, cells: [{ r, c, glyph, kind: 'path' | 'land' | 'place', place?, shape?, open?,
 *                   region? }], at(r, c), regions?, rise? (the tiles' rises, for era/out-tile.js riseAt) }
 *   SHAPES       the shapes by their open edges
 *
 * Coordinates: column c runs east (+x), row r runs south (−y): the tile (r, c) has its centre at
 * (c + ½, −(r + ½)) × tile on the level's frame, north up. Pure.
 */
import { stitchPlan } from './plan.js';

export const GRID_TILE = Object.freeze({ d: 48, lo: 24, hi: 96 });
export const GRID_GLYPHS = Object.freeze({ path: '#', land: '.', water: '~' });
// a tile's sides, clockwise from north: their unit step on the grid (row, column)
export const SIDES = Object.freeze({ n: [-1, 0], e: [0, 1], s: [1, 0], w: [0, -1] });
const ORDER = ['n', 'e', 's', 'w'];

/** The shapes by their open edges, and which way each is turned (its open edges, clockwise from north). */
export const SHAPES = Object.freeze({
  end: 'one edge open: the path stops in the tile (a place reached, a dead end, a lookout)',
  I: 'two opposite edges: the path runs straight through',
  L: 'two adjacent edges: the path turns a corner',
  T: 'three edges: the path forks (a Y where the art wants it)',
  X: 'four edges: a crossing',
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const GLYPH = /^[A-Za-z#.~]$/;

/** The shape of a path tile from its open edges (a set of side names). */
export function shapeOf(open) {
  const n = open.length;
  if (n === 0) return null;
  if (n === 1) return 'end';
  if (n === 2) { const [a, b] = open.map((s) => ORDER.indexOf(s)); return (b - a) % 2 === 0 ? 'I' : 'L'; }
  return n === 3 ? 'T' : 'X';
}

export function readGrid(g, at = 'grid') {
  if (!isObj(g)) throw new Error(`level: ${at} is { tile?, rows, key? }`);
  // A PLAN (plan.js): the map planned as segments and written in them, stitched into one plain grid first, so every
  // reader of the grid (the page, its ends, the game) reads the same map
  if (g.plan !== undefined) {
    for (const k of Object.keys(g)) if (!['tile', 'plan', 'segments'].includes(k)) throw new Error(`level: ${at}.${k}: a planned map is written in its plan and its segments (settings: tile, plan, segments), never in rows`);
    const S = stitchPlan(g, { at, regionWords: REGION_WORDS.filter((w) => w !== 'name' && w !== 'rise') });
    return { ...readGrid(S.grid, at), plan: S.plan };
  }
  if (g.segments !== undefined) throw new Error(`level: ${at}.segments are written against a plan (${at}.plan)`);
  for (const k of Object.keys(g)) if (!['tile', 'rows', 'key', 'regions'].includes(k)) throw new Error(`level: ${at}.${k} is not a grid setting (settings: tile, rows, key, regions, or plan and segments)`);
  const tile = g.tile ?? GRID_TILE.d;
  if (!(Number.isFinite(tile) && tile >= GRID_TILE.lo && tile <= GRID_TILE.hi)) throw new Error(`level: ${at}.tile is a tile's side in metres, ${GRID_TILE.lo} to ${GRID_TILE.hi}`);
  if (!Array.isArray(g.rows) || !g.rows.length || !g.rows.every((r) => typeof r === 'string')) throw new Error(`level: ${at}.rows is the map written as rows of glyphs, north first ('#' a path, '.' open land)`);
  const rows = g.rows.map((r) => r.replace(/\s+/g, ''));
  const cols = rows[0].length;
  if (!cols || rows.some((r) => r.length !== cols)) throw new Error(`level: ${at}.rows are all one width (${rows.map((r) => r.length).join(', ')} glyphs)`);
  const key = g.key === undefined ? {} : g.key;
  if (!isObj(key)) throw new Error(`level: ${at}.key is { <glyph>: <what stands on it> }`);
  for (const k of Object.keys(key)) if (!/^[A-Za-z]$/.test(k)) throw new Error(`level: ${at}.key.${k}: a place's glyph is one letter ('#' and '.' are the path and open land)`);
  const glyphAt = (r, c) => (r >= 0 && c >= 0 && r < rows.length && c < cols ? rows[r][c] : null);
  // (every glyph read before any shape is solved: a place the key does not name is named as that)
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols; c++) {
    const glyph = rows[r][c];
    if (!GLYPH.test(glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is not a glyph (a letter, '#' a path, '.' open land, '~' water)`);
    if (glyph !== GRID_GLYPHS.land && glyph !== GRID_GLYPHS.path && glyph !== GRID_GLYPHS.water && !Object.hasOwn(key, glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is a place the key does not name (key: ${Object.keys(key).join(', ') || 'none'})`);
  }
  // every PLACE's door: its key's, else toward its main road
  const isPath = (r, c) => glyphAt(r, c) === GRID_GLYPHS.path;
  const roads = (r, c) => ORDER.filter((s) => isPath(r + SIDES[s][0], c + SIDES[s][1])).length;
  const doors = new Map();
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols; c++) {
    const glyph = rows[r][c];
    if (glyph === GRID_GLYPHS.path || glyph === GRID_GLYPHS.land || glyph === GRID_GLYPHS.water) continue;
    const sides = ORDER.filter((s) => isPath(r + SIDES[s][0], c + SIDES[s][1])), want = key[glyph]?.door;
    if (want !== undefined && !ORDER.includes(want)) throw new Error(`level: ${at}.key.${glyph}.door is a side: ${ORDER.join(', ')}`);
    if (want !== undefined && !sides.includes(want)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' opens its door ${want}, where no path lies`);
    const door = want ?? sides.reduce((best, s) => (best === null || roads(r + SIDES[s][0], c + SIDES[s][1]) > roads(r + SIDES[best][0], c + SIDES[best][1]) ? s : best), null);
    if (door) doors.set(`${r},${c}`, door);
  }
  // (a place's door faces this path tile: the place lies on that side, its door the opposite way)
  const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  const doorFaces = (r, c, s) => doors.get(`${r + SIDES[s][0]},${c + SIDES[s][1]}`) === OPP[s];
  const cells = [];
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols; c++) {
    const glyph = rows[r][c];
    if (!GLYPH.test(glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is not a glyph (a letter, '#' a path, '.' open land)`);
    if (glyph === GRID_GLYPHS.land) { cells.push({ r, c, glyph, kind: 'land' }); continue; }
    // (WATER: open land a body of water lies on, era/out-tile-water.js; never walked, no path opens toward it)
    if (glyph === GRID_GLYPHS.water) { cells.push({ r, c, glyph, kind: 'land', water: true }); continue; }
    if (glyph !== GRID_GLYPHS.path) {
      if (!Object.hasOwn(key, glyph)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${glyph}' is a place the key does not name (key: ${Object.keys(key).join(', ') || 'none'})`);
      // (a place opens on its door only)
      const door = doors.get(`${r},${c}`);
      cells.push({ r, c, glyph, kind: 'place', place: key[glyph], open: door ? [door] : [] });
      continue;
    }
    // a PATH: open toward every side a path or a place lies on
    const open = ORDER.filter((s) => isPath(r + SIDES[s][0], c + SIDES[s][1]) || doorFaces(r, c, s));
    if (!open.length) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: a path tile that meets no other path nor place (a path runs somewhere)`);
    cells.push({ r, c, glyph, kind: 'path', shape: shapeOf(open), open });
  }
  // ONE NETWORK: every path and every place a path reaches is walked to from every other (a map is one level)
  const walk = cells.filter((x) => x.kind === 'path' || (x.kind === 'place' && x.open.length));
  if (walk.length) {
    const id = (x) => `${x.r},${x.c}`, seen = new Set([id(walk[0])]), queue = [walk[0]];
    const byId = new Map(walk.map((x) => [id(x), x]));
    while (queue.length) {
      const x = queue.shift();
      for (const s of x.open ?? []) { const y = byId.get(`${x.r + SIDES[s][0]},${x.c + SIDES[s][1]}`); if (y && !seen.has(id(y))) { seen.add(id(y)); queue.push(y); } }
    }
    const lost = walk.filter((x) => !seen.has(id(x)));
    if (lost.length) throw new Error(`level: ${at}: the paths are not one network (row ${lost[0].r + 1}, column ${lost[0].c + 1} is not reached from row ${walk[0].r + 1}, column ${walk[0].c + 1}); a map is one level, walked end to end`);
  }
  // THE REGIONS: each tile's region (its dress and its rise)
  const R = readRegions(g.regions, rows.length, cols, `${at}.regions`);
  if (R) for (const x of cells) { const k = R.rows[x.r][x.c]; if (k !== GRID_GLYPHS.land) { x.region = k; } }
  const at2 = (r, c) => cells[r * cols + c] ?? null;
  return { tile, rows: rows.length, cols, cells, at: at2, ...(R ? { regions: R.key, rise: { tile, cols, rows: rows.length, z: cells.map((x) => (x.region ? R.key[x.region].rise ?? 0 : 0)) } } : {}) };
}

/** What a region may say: its name, its rise (metres, the land's height there over the level's own), and the stage's
 *  own words every tile in it is built with (its look, what grows there, its grass, wind and snow). */
export const REGION_WORDS = Object.freeze(['name', 'rise', 'style', 'biocube', 'shrubs', 'grass', 'wind', 'snow', 'palette', 'path', 'shore']);
// (the words a region says of the MAP, never handed to a tile's stage: its name, its rise, its ways' rank
// (level/path-ranks.js) and its water's edge (era/out-tile-water.js))
export const MAP_WORDS = Object.freeze(['name', 'rise', 'path', 'shore']);
export const REGION_RISE = Object.freeze({ lo: -24, hi: 60 });

function readRegions(g, nr, nc, at) {
  if (g === undefined) return null;
  if (!isObj(g) || !Array.isArray(g.rows) || !isObj(g.key)) throw new Error(`level: ${at} is { rows, key }: the map's regions written as a second layer of glyphs over its tiles ('.' the level's own)`);
  const rows = g.rows.map((r) => (typeof r === 'string' ? r.replace(/\s+/g, '') : ''));
  if (rows.length !== nr || rows.some((r) => r.length !== nc)) throw new Error(`level: ${at}.rows are the map's own shape (${nr} rows of ${nc} glyphs)`);
  for (const [k, v] of Object.entries(g.key)) {
    if (!/^[A-Za-z]$/.test(k)) throw new Error(`level: ${at}.key.${k}: a region's glyph is one letter ('.' the level's own)`);
    if (!isObj(v)) throw new Error(`level: ${at}.key.${k} is { ${REGION_WORDS.join(', ')} }`);
    for (const w of Object.keys(v)) if (!REGION_WORDS.includes(w)) throw new Error(`level: ${at}.key.${k}.${w} is not a region's word (words: ${REGION_WORDS.join(', ')})`);
    if (v.rise !== undefined && !(Number.isFinite(v.rise) && v.rise >= REGION_RISE.lo && v.rise <= REGION_RISE.hi)) throw new Error(`level: ${at}.key.${k}.rise is metres over the level's land, ${REGION_RISE.lo} to ${REGION_RISE.hi}`);
  }
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const k = rows[r][c];
    if (k !== GRID_GLYPHS.land && !Object.hasOwn(g.key, k)) throw new Error(`level: ${at}.rows[${r}] column ${c + 1}: '${k}' is a region the key does not name (key: ${Object.keys(g.key).join(', ') || 'none'})`);
  }
  return { rows, key: g.key };
}

/** The tiles a walk from `from` reaches along the paths (through places a path reaches), each its distance in tiles and
 *  the tile it came from: { dist: Map(id → n), prev: Map(id → cell | null) }, ids `r,c`. */
export function walkFrom(G, from) {
  const id = (x) => `${x.r},${x.c}`, net = new Map(G.cells.filter((x) => x.kind === 'path' || (x.kind === 'place' && x.open?.length)).map((x) => [id(x), x]));
  const dist = new Map([[id(from), 0]]), prev = new Map([[id(from), null]]), queue = [from];
  while (queue.length) {
    const x = queue.shift();
    for (const s of x.open ?? []) { const y = net.get(`${x.r + SIDES[s][0]},${x.c + SIDES[s][1]}`); if (y && !dist.has(id(y))) { dist.set(id(y), dist.get(id(x)) + 1); prev.set(id(y), x); queue.push(y); } }
  }
  return { dist, prev };
}
/** The map's GOAL: the place whose key says `goal` (and a path reaches), or null. */
export const mapGoal = (G) => G.cells.find((x) => x.kind === 'place' && x.open?.length && x.place && typeof x.place === 'object' && x.place.goal) ?? null;
/** Where a walk of the map STARTS: the path end farthest along the paths from its goal (the far side of the map from
 *  where it is going), else its first path end, else its first path tile; a planned map's, in its arrival segment. */
export function mapStart(G) {
  // (a PLANNED map, plan.js, sets out from its route's first segment, the arrival: its path end farthest from the goal,
  // else, where its ways all end at doors, its path tile farthest from the goal; never the first path in reading order,
  // which may lie in any segment)
  if (G.plan) {
    const home = G.cells.filter((x) => x.kind === 'path' && x.region === G.plan.route[0]);
    const pool = home.filter((x) => x.shape === 'end').length ? home.filter((x) => x.shape === 'end') : home, goal = mapGoal(G);
    if (!pool.length) return null;
    if (!goal) return pool[0];
    const { dist } = walkFrom(G, goal), d = (x) => dist.get(`${x.r},${x.c}`) ?? -1;
    return pool.reduce((m, x) => (d(x) > d(m) ? x : m));
  }
  const ends = G.cells.filter((x) => x.kind === 'path' && x.shape === 'end'), goal = mapGoal(G);
  if (goal && ends.length) { const { dist } = walkFrom(G, goal), d = (x) => dist.get(`${x.r},${x.c}`) ?? -1; return ends.reduce((m, x) => (d(x) > d(m) ? x : m)); }
  return ends[0] ?? G.cells.find((x) => x.kind === 'path') ?? null;
}

/** Where a place's building stands its door on its tile (the tile's own frame, x east, y north): the middle of the
 *  side its path reaches, PLACE_DOOR_IN metres in, facing out toward the path. */
export const PLACE_DOOR_IN = 5;
export const placeDoors = (T) => ({ n: { x: T / 2, y: T - PLACE_DOOR_IN, facing: '+y' }, s: { x: T / 2, y: PLACE_DOOR_IN, facing: '-y' }, e: { x: T - PLACE_DOOR_IN, y: T / 2, facing: '+x' }, w: { x: PLACE_DOOR_IN, y: T / 2, facing: '-x' } });

/** A tile's centre on the level's frame (north up: columns east, rows south). */
export const tileCentre = (G, r, c) => [(c + 0.5) * G.tile, -(r + 0.5) * G.tile];
/** The middle of a tile's side on the level's frame: where its path crosses it. */
export function sideMiddle(G, r, c, side) {
  const [x, y] = tileCentre(G, r, c), h = G.tile / 2, [dr, dc] = SIDES[side];
  return [x + dc * h, y - dr * h];
}
