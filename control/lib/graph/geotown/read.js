/**
 * THE GEOTOWN'S RECIPE — what a town on a cube's land may say, and the reader that holds it to its rails. Anything off
 * them is refused by name; nothing here rolls a die.
 *
 *   geotown: {
 *     evoke?:   'low' | 'mid' | 'high' | 'metro',                   // how the town is told (EVOKES): a few houses standing
 *                                                                   // for it (low, the default: one block of six to
 *                                                                   // eight back to back), or every plot to scale (metro)
 *     pattern?: <pattern id> | { from: <pattern id>, …changes },   // the block pattern (pattern.js PATTERNS)
 *     grid?:    [cols, rows],                                       // the town laid to scale (metro): blocks across (x,
 *                                                                   // east) and along (y, north), 1–4; an evocation's
 *                                                                   // grid is its level's
 *     hills?:   false | { height?, span?, from? },                  // the land: metres from its lowest to its highest
 *                                                                   // (0–40, 10), metres its painting spans (100–2000,
 *                                                                   // 600), the painted landscape it is read from
 *     blocks?:  { '<A1>': { use?: 'houses' | 'park', built?: false } },   // a block by hand, on the grid's board
 *     margin?:  metres of the land drawn round the town (0–120, 40)
 *   }
 *
 *   EVOKES            { <level>: { grid, houses: [least, most] a row, read } | null (metro: to scale) }
 *   readGeotown(spec) → { evoke, pattern: { id, …P }, grid, hills: { height, span, from } | null, blocks, margin }
 */
import { PATTERNS, PATTERN_IDS, DEFAULT_PATTERN } from './pattern.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`geotown: ${msg}`); };
const KEYS = ['evoke', 'pattern', 'grid', 'hills', 'blocks', 'margin'];
/**
 * THE EVOCATIONS: a game does not lay a neighbourhood out, it EVOKES one. A few houses stand for the town laid to scale,
 * each designed on its own and each yard its own, so the polygons go to the structures, not their count. `metro` is the
 * town to scale, every plot (the fractal city's metro: high fidelity to scale).
 */
export const EVOKES = Object.freeze({
  low: Object.freeze({ grid: Object.freeze([1, 1]), houses: Object.freeze([3, 4]), read: 'one block: three or four houses a side, back to back, their back yards meeting' }),
  mid: Object.freeze({ grid: Object.freeze([2, 1]), houses: Object.freeze([4, 5]), read: 'two blocks across a street: houses facing each other, a block behind each' }),
  high: Object.freeze({ grid: Object.freeze([2, 2]), houses: Object.freeze([4, 6]), read: 'four blocks round a crossing' }),
  metro: null,
});
export const EVOKE_IDS = Object.freeze(Object.keys(EVOKES));
export const DEFAULT_EVOKE = 'low';
export const BLOCK_USES = Object.freeze(['houses', 'park']);
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

/** The recipe's `geotown`, checked → the town as the design reads it. */
export function readGeotown(spec = {}) {
  if (!isObj(spec)) no(`geotown is { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of a geotown (${KEYS.join(', ')})`);
  const evoke = spec.evoke ?? DEFAULT_EVOKE;
  if (!EVOKE_IDS.includes(evoke)) no(`evoke is ${EVOKE_IDS.map((e) => `'${e}'`).join(', ')} (got ${JSON.stringify(spec.evoke)})`);
  const pattern = readPattern(spec.pattern);
  if (spec.grid !== undefined && evoke !== 'metro') no(`grid is the town laid to scale's (evoke: 'metro'); an evocation's grid is its level's (${evoke}: ${EVOKES[evoke].grid.join(' × ')})`);
  const grid = evoke === 'metro' ? spec.grid ?? [2, 2] : [...EVOKES[evoke].grid];
  if (!(Array.isArray(grid) && grid.length === 2 && grid.every((n) => Number.isInteger(n) && n >= 1 && n <= GRID_MOST))) no(`grid is [cols, rows], each a whole number 1–${GRID_MOST}`);
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
      if (b.use !== undefined && !BLOCK_USES.includes(b.use)) no(`blocks.${id}.use is ${BLOCK_USES.join(' or ')}`);
      if (b.built !== undefined && typeof b.built !== 'boolean') no(`blocks.${id}.built is false (laid, not yet built) or true`);
      blocks[id] = { ...b };
    }
  }
  const margin = spec.margin ?? 40;
  if (!(typeof margin === 'number' && margin >= 0 && margin <= 120)) no('margin is the metres of land drawn round the town, 0 to 120');
  return { evoke, pattern, grid: [...grid], hills, blocks, margin };
}
