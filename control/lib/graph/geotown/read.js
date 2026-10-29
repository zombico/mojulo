/**
 * THE GEOTOWN'S RECIPE — what a town on a cube's land may say, and the reader that holds it to its rails. Anything off
 * them is refused by name; nothing here rolls a die.
 *
 *   geotown: {
 *     evoke?:   'segment' | 'neighbourhood' | 'metro',             // how the town is told (EVOKES): one block segment
 *                                                                   // (the default), four or more composed into a
 *                                                                   // neighbourhood, or every plot to scale (metro)
 *     segment?: <segment type>,                                     // the segment's kind (pattern.js SEGMENTS: houses,
 *                                                                   // main-street, apartments, park): houses by default
 *     neighbourhood?: <id> | { layout: ['HHP', …], main?: ['ew-0', …] },   // the pattern's neighbourhood (its
 *                                                                   // `neighbourhoods`), or one written: rows of
 *                                                                   // letters north to south, the main streets
 *     pattern?: <pattern id> | { from: <pattern id>, …changes },   // the block pattern (pattern.js PATTERNS)
 *     grid?:    [cols, rows],                                       // the town laid to scale (metro): blocks across (x,
 *                                                                   // east) and along (y, north), 1–4
 *     hills?:   false | { height?, span?, from? },                  // the land: metres from its lowest to its highest
 *                                                                   // (0–40, 10), metres its painting spans (100–2000,
 *                                                                   // 600), the painted landscape it is read from
 *     blocks?:  { '<A1>': { use?: <segment type>, built?: false } },   // a block by hand, on the grid's board
 *     margin?:  metres of the land drawn round the town, its border (0–120, 12)
 *   }
 *
 *   EVOKES            { <level>: { read } | null (metro: to scale) }
 *   readGeotown(spec) → { evoke, pattern: { id, …P }, grid, cells: [[type…] south to north], mains: [line id…], hills:
 *                         { height, span, from } | null, blocks, margin }
 */
import { PATTERNS, PATTERN_IDS, DEFAULT_PATTERN, SEGMENTS, SEGMENT_IDS, SEGMENT_LETTERS } from './pattern.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`geotown: ${msg}`); };
const KEYS = ['evoke', 'segment', 'neighbourhood', 'pattern', 'grid', 'hills', 'blocks', 'margin'];
/**
 * THE EVOCATIONS: a game does not lay a neighbourhood out, it EVOKES one. A BLOCK SEGMENT (a block: houses back to back,
 * or shops on a main street, or a walk-up among houses, or a park) is the unit, a few buildings each designed on its
 * own; a NEIGHBOURHOOD is four or more segments composed on a grid, each tuned to the cell it lands in; several
 * neighbourhoods are a geocity's graph (each one's `ports`, its perimeter streets). `metro` is the town to scale, every
 * plot (the fractal city's metro: high fidelity to scale).
 */
export const EVOKES = Object.freeze({
  segment: Object.freeze({ read: 'one block segment: a few buildings, each its own, back to back' }),
  neighbourhood: Object.freeze({ read: 'four or more segments composed: their streets ranked, each segment tuned to its cell' }),
  metro: null,
});
export const EVOKE_IDS = Object.freeze(Object.keys(EVOKES));
export const DEFAULT_EVOKE = 'segment';
// a neighbourhood is at least this many segments
export const NEIGHBOURHOOD_LEAST = 4;
export const GRID_MOST = 4;
// the land a geotown stands on when its recipe names none: a gentle swell, read from a painted landscape's heartbeat
export const HILLS = Object.freeze({ height: 10, span: 600, from: Object.freeze({ heartbeat: 'gentle-pulse', splatch: 'verdure-trio', seed: 'g2' }) });
const LETTERS = 'ABCD';
/** A block's name on the grid's board: its column's letter (west to east), its row's number (south to north). */
export const blockId = (i, j) => `${LETTERS[i]}${j + 1}`;

/** The pattern a recipe names, its changes over it: each of its settings replaced, or merged a level deep. */
function readPattern(v) {
  if (v === undefined) return { id: DEFAULT_PATTERN, ...PATTERNS[DEFAULT_PATTERN] };
  if (typeof v === 'string') { if (!PATTERNS[v]) no(`pattern '${v}' is not a block pattern (${PATTERN_IDS.join(', ')})`); return { id: v, ...PATTERNS[v] }; }
  if (!isObj(v) || typeof v.from !== 'string' || !PATTERNS[v.from]) no(`pattern is a pattern id (${PATTERN_IDS.join(', ')}) or { from: <id>, …changes }`);
  const base = PATTERNS[v.from], out = { id: `${v.from}+`, ...base };
  for (const [k, x] of Object.entries(v)) {
    if (k === 'from') continue;
    if (!(k in base) || k === 'read' && typeof x !== 'string') no(`pattern.${k} is not a setting of a pattern (${Object.keys(base).join(', ')})`);
    if (isObj(base[k])) {
      if (!isObj(x)) no(`pattern.${k} is { ${Object.keys(base[k]).join(', ')} }`);
      for (const kk of Object.keys(x)) if (!(kk in base[k])) no(`pattern.${k}.${kk} is not a setting (${Object.keys(base[k]).join(', ')})`);
      out[k] = { ...base[k], ...x };
    } else out[k] = x;
  }
  // a rail is [lo, hi], lo ≤ hi; a share is 0…1
  const rail = (path, r) => { if (!(Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] <= r[1] && r[0] >= 0)) no(`pattern.${path} is [least, most] metres`); };
  for (const [k, kk] of [['block', 'long'], ['block', 'depth'], ['plot', 'semi'], ['plot', 'detached'], ['house', 'depth'], ['house', 'side']]) rail(`${k}.${kk}`, out[k][kk]);
  rail('setback', out.setback);
  const share = (path, x) => { if (!(typeof x === 'number' && x >= 0 && x <= 1)) no(`pattern.${path} is a share, 0 to 1`); };
  share('mix.semi', out.mix.semi); share('mix.detached', out.mix.detached);
  if (out.mix.semi + out.mix.detached <= 0) no('pattern.mix: some share of semis or detached houses');
  if (out.block.long[0] < 40) no('pattern.block.long is at least 40 m');
  if (out.block.depth[0] < out.setback[1] + out.house.depth[0] + 2) no('pattern.block.depth leaves no room for a house behind its front yard');
  return out;
}

/** A street line's name: `ns-<k>` the k-th north-south from the west, `ew-<j>` the j-th east-west from the south. */
const LINE = /^(ns|ew)-(\d)$/;

/** The layout a recipe asks: its grid, its cells' segments (south to north), its main streets. */
function readLayout(spec, evoke, P) {
  if (evoke === 'metro') {
    if (spec.segment !== undefined || spec.neighbourhood !== undefined) no('segment and neighbourhood are an evocation\'s; the town to scale (metro) is its grid of houses');
    const grid = spec.grid ?? [2, 2];
    if (!(Array.isArray(grid) && grid.length === 2 && grid.every((n) => Number.isInteger(n) && n >= 1 && n <= GRID_MOST))) no(`grid is [cols, rows], each a whole number 1–${GRID_MOST}`);
    return { grid: [...grid], cells: Array.from({ length: grid[1] }, () => Array(grid[0]).fill('houses')), mains: [] };
  }
  if (spec.grid !== undefined) no(`grid is the town laid to scale's (evoke: 'metro'); an evocation's is its segment's or its neighbourhood's layout`);
  if (evoke === 'segment') {
    if (spec.neighbourhood !== undefined) no('neighbourhood is evoke: \'neighbourhood\'s; a segment is one block');
    const t = spec.segment ?? 'houses';
    if (!SEGMENTS[t]) no(`segment is ${SEGMENT_IDS.join(', ')} (got ${JSON.stringify(spec.segment)})`);
    // (a main-street segment alone fronts its main street to the south)
    return { grid: [1, 1], cells: [[t]], mains: SEGMENTS[t].main ? ['ew-0'] : [] };
  }
  if (spec.segment !== undefined) no('segment is evoke: \'segment\'s; a neighbourhood\'s segments are its layout\'s');
  const N0 = spec.neighbourhood ?? Object.keys(P.neighbourhoods ?? {})[0], ids = Object.keys(P.neighbourhoods ?? {});
  const N = typeof N0 === 'string' ? P.neighbourhoods?.[N0] : N0;
  if (!N || !isObj(N)) no(`neighbourhood is one of the pattern's (${ids.join(', ') || 'none'}) or { layout: ['HHP', …], main?: ['ew-0', …] }`);
  for (const k of Object.keys(N)) if (!['read', 'layout', 'main'].includes(k)) no(`neighbourhood.${k} is not a setting (layout, main)`);
  const L = N.layout;
  if (!Array.isArray(L) || !L.length || L.length > GRID_MOST || !L.every((r) => typeof r === 'string' && r.length === L[0].length && r.length <= GRID_MOST)) no(`neighbourhood.layout is rows of letters north to south, each as long, at most ${GRID_MOST} by ${GRID_MOST}`);
  const cells = L.slice().reverse().map((r, j) => [...r].map((c, i) => SEGMENT_LETTERS[c] ?? no(`neighbourhood.layout row ${L.length - j}, column ${i + 1}: '${c}' is not a segment's letter (${Object.entries(SEGMENT_LETTERS).map(([l, t]) => `${l} ${t}`).join(', ')})`)));
  const grid = [cells[0].length, cells.length];
  if (grid[0] * grid[1] < NEIGHBOURHOOD_LEAST) no(`a neighbourhood is at least ${NEIGHBOURHOOD_LEAST} segments (got ${grid[0] * grid[1]}); one block is evoke: 'segment'`);
  const mains = N.main ?? [];
  if (!Array.isArray(mains)) no('neighbourhood.main is the main streets, [\'ew-0\', …]');
  for (const m of mains) { const x = LINE.exec(m); if (!x || Number(x[2]) > (x[1] === 'ns' ? grid[0] : grid[1])) no(`neighbourhood.main '${m}' is not a street of a ${grid[0]} × ${grid[1]} layout (ns-0…ns-${grid[0]}, ew-0…ew-${grid[1]})`); }
  return { grid, cells, mains: [...mains] };
}

/** The recipe's `geotown`, checked → the town as the design reads it. */
export function readGeotown(spec = {}) {
  if (!isObj(spec)) no(`geotown is { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of a geotown (${KEYS.join(', ')})`);
  const evoke = spec.evoke ?? DEFAULT_EVOKE;
  if (!EVOKE_IDS.includes(evoke)) no(`evoke is ${EVOKE_IDS.map((e) => `'${e}'`).join(', ')} (got ${JSON.stringify(spec.evoke)})`);
  const pattern = readPattern(spec.pattern), { grid, cells, mains } = readLayout(spec, evoke, pattern);
  let hills = null;
  if (spec.hills !== false) {
    const h = spec.hills ?? {};
    if (!isObj(h)) no('hills is false (level land) or { height?, span?, from? }');
    for (const k of Object.keys(h)) if (!['height', 'span', 'from'].includes(k)) no(`hills.${k} is not a setting (height, span, from)`);
    hills = { ...HILLS, ...h };
    if (!(typeof hills.height === 'number' && hills.height >= 0 && hills.height <= 40)) no('hills.height is metres from the land\'s lowest to its highest under the town, 0 to 40');
    if (!(typeof hills.span === 'number' && hills.span >= 100 && hills.span <= 2000)) no('hills.span is the metres the land\'s painting spans, 100 to 2000');
    if (!isObj(hills.from)) no('hills.from is a painted landscape recipe ({ heartbeat, splatch, seed, … })');
    if (hills.height === 0) hills = null;
  }
  const blocks = {};
  if (spec.blocks !== undefined) {
    if (!isObj(spec.blocks)) no('blocks is { \'A1\': { use?, built? } }, a block by its name on the grid');
    for (const [id, b] of Object.entries(spec.blocks)) {
      const m = /^([A-D])([1-4])$/.exec(id);
      if (!m || LETTERS.indexOf(m[1]) >= grid[0] || Number(m[2]) > grid[1]) no(`blocks.${id} is not a block of a ${grid[0]} × ${grid[1]} grid (columns A… west to east, rows 1… south to north)`);
      if (!isObj(b)) no(`blocks.${id} is { use?, built? }`);
      for (const k of Object.keys(b)) if (!['use', 'built'].includes(k)) no(`blocks.${id}.${k} is not a setting (use, built)`);
      if (b.use !== undefined && !SEGMENT_IDS.includes(b.use)) no(`blocks.${id}.use is ${SEGMENT_IDS.join(', ')}`);
      if (b.use !== undefined && evoke === 'metro' && !['houses', 'park'].includes(b.use)) no(`blocks.${id}.use is houses or park in the town to scale (metro)`);
      if (b.built !== undefined && typeof b.built !== 'boolean') no(`blocks.${id}.built is false (laid, not yet built) or true`);
      blocks[id] = { ...b };
    }
  }
  const margin = spec.margin ?? 12;
  if (!(typeof margin === 'number' && margin >= 0 && margin <= 120)) no('margin is the metres of land drawn round the town, 0 to 120');
  // (a block by hand changes its cell's segment)
  for (const [id, b] of Object.entries(blocks)) if (b.use) cells[Number(id[1]) - 1][LETTERS.indexOf(id[0])] = b.use;
  return { evoke, pattern, grid, cells, mains, hills, blocks, margin };
}
