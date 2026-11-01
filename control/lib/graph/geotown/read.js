/**
 * THE GEOTOWN'S RECIPE — what a town on a cube's land may say, and the reader that holds it to its rails. Anything off
 * them is refused by name; nothing here rolls a die.
 *
 *   geotown: {
 *     evoke?:   'segment' | 'neighbourhood' | 'metro',             // how the town is told (EVOKES): one block segment
 *                                                                   // (the default), four or more composed into a
 *                                                                   // neighbourhood, or every plot to scale (metro)
 *     segment?: <segment type>,                                     // the segment's kind (pattern.js SEGMENTS: houses,
 *                                                                   // main-street, apartments, park, school, sports,
 *                                                                   // edge): houses by default; a school or a sports
 *                                                                   // field two cells, one block; an edge fronts its
 *                                                                   // major street
 *     neighbourhood?: <id> | { layout: ['EEE', …], main?: […], major?: […] },   // the pattern's neighbourhood (its
 *                                                                   // `neighbourhoods`), or one written: rows of
 *                                                                   // letters north to south (a wide letter side by
 *                                                                   // side, P S F, one block), the main streets and
 *                                                                   // the major ones ('ew-0', 'ns-3', …)
 *     pattern?: <pattern id> | { from: <pattern id>, …changes },   // the block pattern (pattern.js PATTERNS)
 *     grid?:    [cols, rows],                                       // the town laid to scale (metro): blocks across (x,
 *                                                                   // east) and along (y, north), 1–4
 *     hills?:   false | { height?, span?, from? },                  // the land: metres from its lowest to its highest
 *                                                                   // (0–40, 10), metres its painting spans (100–2000,
 *                                                                   // 600), the painted landscape it is read from
 *     streetscape?: <id> | { from?, setback?, gates?, parking?, trees?, lights?, signals?, stops? },
 *                                                                   // how close to the city, read from its sidewalk
 *                                                                   // (the pattern's `streetscapes`: leafy,
 *                                                                   // snug, urban): `setback` [least, most] metres from
 *                                                                   // the walk to a house (0–12), `gates` none | some |
 *                                                                   // most | all or a share, `parking` none | one | both
 *                                                                   // sides of a street, `trees` the share of street
 *                                                                   // trees planted (0–1), `lights` metres between
 *                                                                   // streetlights (0 none), `signals` a signal every n
 *                                                                   // crossings along a main or major street, `stops`
 *                                                                   // the share of local crossings stopped all ways
 *     blocks?:  { '<A1>': { use?: <segment type>, built?: false } },   // a block by hand, on the grid's board
 *     margin?:  metres of the land drawn round the town, its border (0–120, 12)
 *   }
 *
 *   EVOKES            { <level>: { read } | null (metro: to scale) }
 *   readStreetscape(P, v) → the pattern with its streetscape laid over it (`streetscape` its id; `trees`, `parking`,
 *                         `gates` its own)
 *   readGeotown(spec) → { evoke, pattern: { id, streetscape, …P }, grid, cells: [[type…] south to north], mains: [line id…], hills:
 *                         { height, span, from } | null, blocks, margin }
 */
import { PATTERNS, PATTERN_IDS, DEFAULT_PATTERN, SEGMENTS, SEGMENT_IDS, SEGMENT_LETTERS, STREETSCAPE_SETTINGS, GATE_SHARES, PARKING_SIDES, GATE_KINDS } from './pattern.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`geotown: ${msg}`); };
const KEYS = ['evoke', 'segment', 'neighbourhood', 'pattern', 'streetscape', 'grid', 'hills', 'blocks', 'margin'];
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

// a streetscape's changes over the pattern, a level deep, and the settings it replaces whole
const SCAPE_MERGE = ['street', 'plot', 'mix', 'block', 'house', 'evoke'], SCAPE_WHOLE = ['setback', 'back'];

/** The pattern with its streetscape laid over it: the pattern's (the first of its `streetscapes` by default), and a
 *  recipe's changes over that (STREETSCAPE_SETTINGS). A setback deeper than the block holds deepens the block. */
export function readStreetscape(P, v) {
  const ids = Object.keys(P.streetscapes ?? {});
  if (!ids.length) { if (v !== undefined) no(`streetscape: pattern '${P.id}' has none`); return P; }
  const [id, ch] = v === undefined ? [ids[0], {}] : typeof v === 'string' ? [v, {}] : isObj(v) ? [v.from ?? ids[0], v] : no(`streetscape is one of the pattern's (${ids.join(', ')}) or { from?, ${STREETSCAPE_SETTINGS.join('?, ')}? }`);
  if (!P.streetscapes[id]) no(`streetscape '${id}' is not one of the pattern's (${ids.join(', ')})`);
  for (const k of Object.keys(ch)) if (k !== 'from' && !STREETSCAPE_SETTINGS.includes(k)) no(`streetscape.${k} is not a setting (from, ${STREETSCAPE_SETTINGS.join(', ')})`);
  const S = P.streetscapes[id], out = { ...P, streetscape: id };
  for (const k of SCAPE_MERGE) if (S[k]) out[k] = { ...P[k], ...S[k] };
  for (const k of SCAPE_WHOLE) if (S[k] !== undefined) out[k] = S[k];
  out.trees = { stride: P.grow.stride, share: 1, ...S.trees };
  out.parking = { sides: 'none', lane: 2.2, share: 0, pads: 0, least: 0, ...S.parking };
  out.gates = { share: 0, kinds: { iron: 1 }, ...S.gates };
  out.traffic = { lights: 0, signals: 0, stops: 0, ...S.traffic };
  if (ch.lights !== undefined && !(ch.lights === 0 || (typeof ch.lights === 'number' && ch.lights >= 12 && ch.lights <= 80))) no('streetscape.lights is the metres between streetlights, 12 to 80, or 0 for none');
  if (ch.signals !== undefined && !(Number.isInteger(ch.signals) && ch.signals >= 0 && ch.signals <= 4)) no('streetscape.signals is a signal every that many crossings along a main or major street, 1 to 4, or 0 for none');
  if (ch.stops !== undefined && !(typeof ch.stops === 'number' && ch.stops >= 0 && ch.stops <= 1)) no('streetscape.stops is the share of local crossings with all-way stops, 0 to 1');
  for (const k of ['lights', 'signals', 'stops']) if (ch[k] !== undefined) out.traffic = { ...out.traffic, [k]: ch[k] };
  if (ch.setback !== undefined) {
    const r = ch.setback;
    if (!(Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] >= 0 && r[0] <= r[1] && r[1] <= 12)) no('streetscape.setback is [least, most] metres from the walk to a house, 0 to 12');
    out.setback = [...r];
  }
  if (ch.gates !== undefined) {
    const g = typeof ch.gates === 'string' ? GATE_SHARES[ch.gates] : ch.gates;
    if (!(typeof g === 'number' && g >= 0 && g <= 1)) no(`streetscape.gates is ${Object.keys(GATE_SHARES).join(', ')} or a share of fronts, 0 to 1`);
    out.gates = { ...out.gates, share: g };
  }
  if (ch.parking !== undefined) {
    if (!PARKING_SIDES.includes(ch.parking)) no(`streetscape.parking is the sides of a street parked: ${PARKING_SIDES.join(', ')}`);
    out.parking = { ...out.parking, sides: ch.parking };
  }
  if (ch.trees !== undefined) {
    if (!(typeof ch.trees === 'number' && ch.trees >= 0 && ch.trees <= 1)) no('streetscape.trees is the share of the street\'s trees planted, 0 to 1');
    out.trees = { ...out.trees, share: ch.trees };
  }
  for (const k of Object.keys(out.gates.kinds)) if (!GATE_KINDS.includes(k)) no(`streetscape '${id}': a gate is ${GATE_KINDS.join(', ')} (got '${k}')`);
  // (the block as deep as its setback, its house and its back yard need)
  const least = out.setback[1] + out.house.depth[0] + out.back;
  if (out.block.depth[0] < least) out.block = { ...out.block, depth: [least, Math.max(least, out.block.depth[1])] };
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
    return { grid: [...grid], cells: Array.from({ length: grid[1] }, () => Array(grid[0]).fill('houses')), mains: [], majors: [] };
  }
  if (spec.grid !== undefined) no(`grid is the town laid to scale's (evoke: 'metro'); an evocation's is its segment's or its neighbourhood's layout`);
  if (evoke === 'segment') {
    if (spec.neighbourhood !== undefined) no('neighbourhood is evoke: \'neighbourhood\'s; a segment is one block');
    const t = spec.segment ?? 'houses';
    if (!SEGMENTS[t]) no(`segment is ${SEGMENT_IDS.join(', ')} (got ${JSON.stringify(spec.segment)})`);
    // (a main-street segment alone fronts its main street to the south; a wide one spans its `span` cells, one block)
    const n = SEGMENTS[t].span ?? 1;
    return { grid: [n, 1], cells: [Array(n).fill(t)], mains: SEGMENTS[t].main ? ['ew-0'] : [], majors: SEGMENTS[t].major ? ['ew-0'] : [] };
  }
  if (spec.segment !== undefined) no('segment is evoke: \'segment\'s; a neighbourhood\'s segments are its layout\'s');
  const N0 = spec.neighbourhood ?? Object.keys(P.neighbourhoods ?? {})[0], ids = Object.keys(P.neighbourhoods ?? {});
  const N = typeof N0 === 'string' ? P.neighbourhoods?.[N0] : N0;
  if (!N || !isObj(N)) no(`neighbourhood is one of the pattern's (${ids.join(', ') || 'none'}) or { layout: ['HHP', …], main?: ['ew-0', …] }`);
  for (const k of Object.keys(N)) if (!['read', 'layout', 'main', 'major', 'bike'].includes(k)) no(`neighbourhood.${k} is not a setting (layout, main, major, bike)`);
  const L = N.layout;
  if (!Array.isArray(L) || !L.length || L.length > GRID_MOST || !L.every((r) => typeof r === 'string' && r.length === L[0].length && r.length <= GRID_MOST)) no(`neighbourhood.layout is rows of letters north to south, each as long, at most ${GRID_MOST} by ${GRID_MOST}`);
  const cells = L.slice().reverse().map((r, j) => [...r].map((c, i) => SEGMENT_LETTERS[c] ?? no(`neighbourhood.layout row ${L.length - j}, column ${i + 1}: '${c}' is not a segment's letter (${Object.entries(SEGMENT_LETTERS).map(([l, t]) => `${l} ${t}`).join(', ')})`)));
  const grid = [cells[0].length, cells.length];
  if (grid[0] * grid[1] < NEIGHBOURHOOD_LEAST) no(`a neighbourhood is at least ${NEIGHBOURHOOD_LEAST} segments (got ${grid[0] * grid[1]}); one block is evoke: 'segment'`);
  const mains = N.main ?? [];
  if (!Array.isArray(mains)) no('neighbourhood.main is the main streets, [\'ew-0\', …]');
  // (a major street: an arterial round the edge, where an edge's avenue faces; never a main street too)
  const majors = N.major ?? [], bikes = N.bike ?? [];
  if (!Array.isArray(majors)) no('neighbourhood.major is the major streets, [\'ew-0\', …]');
  if (!Array.isArray(bikes)) no('neighbourhood.bike is the streets with bike lanes, [\'ns-1\', …]');
  for (const [k, list] of [['main', mains], ['major', majors], ['bike', bikes]]) for (const m of list) { const x = LINE.exec(m); if (!x || Number(x[2]) > (x[1] === 'ns' ? grid[0] : grid[1])) no(`neighbourhood.${k} '${m}' is not a street of a ${grid[0]} × ${grid[1]} layout (ns-0…ns-${grid[0]}, ew-0…ew-${grid[1]})`); }
  for (const m of majors) if (mains.includes(m)) no(`neighbourhood: '${m}' is main or major, not both`);
  return { grid, cells, mains: [...mains], majors: [...majors], bikes: [...bikes] };
}

/** The recipe's `geotown`, checked → the town as the design reads it. */
export function readGeotown(spec = {}) {
  if (!isObj(spec)) no(`geotown is { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of a geotown (${KEYS.join(', ')})`);
  const evoke = spec.evoke ?? DEFAULT_EVOKE;
  if (!EVOKE_IDS.includes(evoke)) no(`evoke is ${EVOKE_IDS.map((e) => `'${e}'`).join(', ')} (got ${JSON.stringify(spec.evoke)})`);
  const pattern = readStreetscape(readPattern(spec.pattern), spec.streetscape), { grid, cells, mains, majors, bikes = [] } = readLayout(spec, evoke, pattern);
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
      if (b.use !== undefined && evoke === 'metro' && !['houses', 'park', 'school', 'sports'].includes(b.use)) no(`blocks.${id}.use is houses, park, school or sports in the town to scale (metro)`);
      if (b.built !== undefined && typeof b.built !== 'boolean') no(`blocks.${id}.built is false (laid, not yet built) or true`);
      blocks[id] = { ...b };
    }
  }
  const margin = spec.margin ?? 12;
  if (!(typeof margin === 'number' && margin >= 0 && margin <= 120)) no('margin is the metres of land drawn round the town, 0 to 120');
  // (a block by hand changes its cell's segment)
  for (const [id, b] of Object.entries(blocks)) if (b.use) cells[Number(id[1]) - 1][LETTERS.indexOf(id[0])] = b.use;
  return { evoke, pattern, grid, cells, mains, majors, bikes, hills, blocks, margin };
}
