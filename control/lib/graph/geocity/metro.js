/**
 * THE GEOCITY'S CARDS — what a metro is before anything is drawn, and the reader that holds a recipe to it. A metro is
 * data: a new one is a card, not code. Its major streets come first and carve it: the SPINE (the arterials through the
 * core's seat: a Yonge, a Queen) and the ARTERIALS round it, tight at the core and looser outward; the cells they enclose
 * are its NEIGHBOURHOODS, each in a RING by its distance from the seat (the core's towers, the frame's lower tall, the
 * outskirts at four storeys and lower, a geotown's fabric). Its land falls toward its water and rises in its hills, and
 * its streets keep that grade. Its green is budgeted from the top: a share of the land, a city park reserved whole, a
 * quota for every other neighbourhood by its area and its ring.
 *
 *   METROS          { <id>: the card }; METRO_IDS; DEFAULT_METRO
 *     extent        [W, D] metres, the whole map, water and all (x east, y north)
 *     water         { sides: ['s', …], depth }: a band of water along each side named (a shore, a harbour; all four an
 *                   island), `depth` metres out from the land
 *     core          [u, v]: the core's SEAT, shares of the land west to east and south to north (the spine crosses there)
 *     fall          { drop, toward }: the land falls `drop` metres across it toward a side (the shore); 0 level
 *     hills         false | { height, span?, from }: the hills over the fall, metres lowest to highest, read from a
 *                   painted landscape (`span` the metres its painting spans, the map's longer side by default)
 *     arterials     { core: [lo, hi], outer: [lo, hi], reach }: metres between arterials at the seat and at `reach`
 *                   metres from it and past, each step rolled inside the rail at its distance
 *     rings         { core, frame }: metres from the seat to a neighbourhood's middle each ring reaches; past the frame
 *                   the outskirts
 *     storeys       { frame: [lo, hi], outskirts: [lo, hi] }: each ring's storeys (the core's are its grammar's towers)
 *     green         { share, parks, most, weights: { core, frame, outskirts } }: the least share of the land that is
 *                   green, the city parks reserved whole (frame neighbourhoods first), the most any neighbourhood's quota
 *                   asks of its ground, and how the rest is shared out by ring (by area times weight)
 *     grade         the steepest arterial (rise over run): steeper is advice
 *     grammar       its city grammar (city/plan/grammars.js: an Earth flavour or a world grammar): its streets' sections,
 *                   its towers, its skins
 *     outskirts     the geotown pattern its outskirts are made of (geotown/pattern.js PATTERNS)
 *
 *   readGeocity(spec) → { metro: { id, …card }, grammar, pattern, hills, seat? }
 *
 * Metres throughout. Anything off the card is refused by name; nothing here rolls a die.
 */
import { resolveGrammar } from '../city/plan/grammars.js';
import { PATTERNS, PATTERN_IDS } from '../geotown/pattern.js';

export const SIDES = Object.freeze(['n', 'e', 's', 'w']);
export const RINGS = Object.freeze({
  core: 'the downtown: towers over their podiums, the height field\'s top',
  frame: 'round the core: the lower tall, mid-rise of six to fifteen storeys, slabs and their plazas',
  outskirts: 'four storeys and lower: low-rises, walk-ups, main streets and houses, a geotown\'s fabric',
});
export const RING_IDS = Object.freeze(Object.keys(RINGS));
// (the hills a metro stands on when its card names none: a long swell, the geotown's painting)
const SWELL = Object.freeze({ heartbeat: 'gentle-pulse', splatch: 'verdure-trio', seed: 'g2' });

export const METROS = Object.freeze({
  lakeshore: Object.freeze({
    read: 'a lakeshore metro (a Toronto): its core by the lake, the land falling to the shore down its spine, a grid of arterials loosening northward into streetcar suburbs',
    extent: [4400, 3400],
    water: { sides: ['s'], depth: 380 },
    core: [0.5, 0.12],
    fall: { drop: 45, toward: 's' },
    hills: { height: 14, from: SWELL },
    arterials: { core: [260, 360], outer: [780, 980], reach: 2000 },
    rings: { core: 650, frame: 1500 },
    storeys: { frame: [6, 15], outskirts: [1, 4] },
    green: { share: 0.12, parks: 1, most: 0.3, weights: { core: 0.4, frame: 1, outskirts: 1.3 } },
    grade: 0.06,
    grammar: 'north-american',
    outskirts: 'bay-and-gable',
  }),
  'harbour-island': Object.freeze({
    read: 'an island city: its core on a harbour at the west shore, the land rising inland to hills, water all round',
    extent: [3600, 3000],
    water: { sides: ['n', 'e', 's', 'w'], depth: 260 },
    core: [0.16, 0.5],
    fall: { drop: 30, toward: 'w' },
    hills: { height: 40, from: SWELL },
    arterials: { core: [240, 320], outer: [620, 820], reach: 1500 },
    rings: { core: 520, frame: 1200 },
    storeys: { frame: [5, 12], outskirts: [1, 3] },
    green: { share: 0.16, parks: 1, most: 0.35, weights: { core: 0.4, frame: 1, outskirts: 1.4 } },
    grade: 0.08,
    grammar: 'mediterranean',
    outskirts: 'bay-and-gable',
  }),
});
export const METRO_IDS = Object.freeze(Object.keys(METROS));
export const DEFAULT_METRO = 'lakeshore';
// what a recipe may say beside its metro: each a card's setting laid over the card's
const KEYS = Object.freeze(['metro', 'extent', 'water', 'core', 'fall', 'hills', 'green', 'grammar', 'outskirts']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`geocity: ${msg}`); };
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const pair = (r, lo, hi) => Array.isArray(r) && r.length === 2 && r.every((v) => num(v, lo, hi));
const rail = (r, lo, hi) => pair(r, lo, hi) && r[0] <= r[1];

/** The metro a recipe names, and its changes over it: each setting replaced, or merged a level deep. */
function readMetro(v) {
  if (v === undefined) return { id: DEFAULT_METRO, ...METROS[DEFAULT_METRO] };
  if (typeof v === 'string') { if (!METROS[v]) no(`metro '${v}' is not a metro (${METRO_IDS.join(', ')})`); return { id: v, ...METROS[v] }; }
  if (!isObj(v) || typeof v.from !== 'string' || !METROS[v.from]) no(`metro is a metro's id (${METRO_IDS.join(', ')}) or { from: <id>, …changes }`);
  const base = METROS[v.from], out = { id: `${v.from}+`, ...base };
  for (const [k, x] of Object.entries(v)) {
    if (k === 'from') continue;
    if (!(k in base)) no(`metro.${k} is not a setting of a metro (${Object.keys(base).join(', ')})`);
    out[k] = isObj(base[k]) && isObj(x) ? { ...base[k], ...x } : x;
  }
  return out;
}

/** The recipe's `geocity`, checked → the metro as the design reads it. */
export function readGeocity(spec = {}) {
  if (!isObj(spec)) no('geocity is { metro?, extent?, water?, core?, fall?, hills?, green?, grammar?, outskirts? }');
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of a geocity (${KEYS.join(', ')})`);
  const M = readMetro(spec.metro);
  // a recipe's own settings over its metro's (an object merged a level deep)
  for (const k of KEYS.slice(1)) if (spec[k] !== undefined) M[k] = isObj(M[k]) && isObj(spec[k]) ? { ...M[k], ...spec[k] } : spec[k];

  if (!pair(M.extent, 600, 12000)) no('extent is [W, D], metres east and north, each 600 to 12000');
  const [W, D] = M.extent;
  if (!isObj(M.water) || !Array.isArray(M.water.sides) || !M.water.sides.every((s) => SIDES.includes(s)) || new Set(M.water.sides).size !== M.water.sides.length) no(`water.sides is the sides with water, of ${SIDES.join(', ')}`);
  if (!num(M.water.depth, 0, Math.min(W, D) / 4)) no(`water.depth is the metres of water out from the land, 0 to a quarter of the shorter side (${Math.min(W, D) / 4})`);
  if (!(Array.isArray(M.core) && M.core.length === 2 && M.core.every((v) => num(v, 0, 1)))) no('core is [u, v], the seat\'s shares of the land west to east and south to north, each 0 to 1');
  if (!isObj(M.fall) || !num(M.fall.drop, 0, 200) || !SIDES.includes(M.fall.toward)) no(`fall is { drop: metres 0–200, toward: ${SIDES.join(' | ')} }`);
  let hills = null;
  if (M.hills !== false && M.hills !== undefined) {
    const h = M.hills;
    if (!isObj(h)) no('hills is false (no hills over the fall) or { height, span?, from }');
    for (const k of Object.keys(h)) if (!['height', 'span', 'from'].includes(k)) no(`hills.${k} is not a setting (height, span, from)`);
    if (!num(h.height, 0, 150)) no('hills.height is metres from the hills\' lowest to their highest, 0 to 150');
    if (h.span !== undefined && !num(h.span, 200, 40000)) no('hills.span is the metres the painting spans, 200 to 40000');
    if (!isObj(h.from)) no('hills.from is a painted landscape recipe ({ heartbeat, splatch, seed, … })');
    if (h.height > 0) hills = { height: h.height, span: h.span ?? Math.max(W, D), from: h.from };
  }
  const A = M.arterials;
  if (!isObj(A) || !rail(A.core, 80, 3000) || !rail(A.outer, 80, 3000) || !num(A.reach, 0, 12000)) no('arterials is { core: [lo, hi], outer: [lo, hi] metres between them, reach: metres from the seat }');
  if (!isObj(M.rings) || !num(M.rings.core, 0, 12000) || !num(M.rings.frame, M.rings.core, 12000)) no('rings is { core, frame }: metres from the seat each reaches, the frame past the core');
  if (!isObj(M.storeys) || !rail(M.storeys.frame, 1, 60) || !rail(M.storeys.outskirts, 1, 12)) no('storeys is { frame: [lo, hi], outskirts: [lo, hi] }');
  const Gr = M.green;
  if (!isObj(Gr) || !num(Gr.share, 0, 0.6) || !(Number.isInteger(Gr.parks) && Gr.parks >= 0 && Gr.parks <= 6) || !num(Gr.most, 0, 1) || !isObj(Gr.weights) || !RING_IDS.every((r) => num(Gr.weights[r], 0, 10))) no('green is { share: 0–0.6, parks: 0–6, most: 0–1, weights: { core, frame, outskirts } }');
  if (!num(M.grade, 0.01, 0.3)) no('grade is the steepest arterial, rise over run, 0.01 to 0.3');
  const grammar = resolveGrammar(M.grammar, 'geocity.grammar');
  if (!PATTERNS[M.outskirts]) no(`outskirts is a geotown pattern (${PATTERN_IDS.join(', ')})`);
  return { metro: M, grammar, pattern: { id: M.outskirts, ...PATTERNS[M.outskirts] }, hills };
}
