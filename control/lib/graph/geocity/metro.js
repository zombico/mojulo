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
 *     heights       the HEIGHT FIELD (heights.js), in storeys:
 *                     <ring>: { rail: [lo, hi], median: [outer, inner] }   what each ring may build, and its median
 *                                   storeys at its outer reach and at its inner (the core's inner the seat), between
 *                                   them by distance, geometrically (the core's towers stand past its median: its tail)
 *                     corridor: { spine, arterial, depth }   the arterials' FRONTAGE: the band `depth` metres deep along
 *                                   each arterial side of a neighbourhood may rise to this many storeys where its ring's
 *                                   rail stops short (a main street's mid-rise past the core)
 *                     nodes: { every, reach }   secondary NODES: every `every`-th spine crossing out past the core's
 *                                   reach is one, the neighbourhoods round it built a ring inward and its median rising
 *                                   toward it within `reach` metres (a Yonge and Eglinton)
 *     green         { share, parks, most, weights: { core, frame, outskirts }, park: { share: { <ring> }, least, aspect } }:
 *                   the least share of the land that is green, the city parks reserved whole (frame neighbourhoods
 *                   first), the most any neighbourhood's quota asks of its ground, how the rest is shared out by ring (by
 *                   area times weight), and each neighbourhood's own PARK: the share of its quota it takes by ring, the
 *                   least park (m²; less is left to its segments: parkettes, plazas, verges, yards), its longest side
 *                   over its shortest
 *     streets       { collector, civic, school }: a neighbourhood wider than `collector` metres gets a collector across it
 *                   that way; one of `civic` blocks or more gets its civic block (the core's square, the outskirts'
 *                   school), a school's block at least `school` m²
 *     segments      { core: { tower, podium }, frame: { midrise, slab }, outskirts: { houses, apartments, lowrise } }:
 *                   the weights a block off its arterials and collectors is given to each segment by (blocks.js)
 *     roads         each arterial's cross-section (roads.js): { lane, parking, bike, lanes, median: { share, w },
 *                   oneway: { pairs, lanes }, streetcar: { spine, share, gauge, row } }: four lanes a major street,
 *                   a spacer on some, one-way pairs of three lanes by the core, streetcar rails on the spines and some
 *     lively        { <ring>: { construction, parking, vacant } }: the share of a ring's blocks (off its civic one) a
 *                   building going up, a surface parking lot, a vacant lot takes in place of its segment (blocks.js)
 *     grade         the steepest arterial (rise over run): steeper is advice
 *     grammar       its city grammar (city/plan/grammars.js: an Earth flavour or a world grammar): its streets' sections,
 *                   its towers, its skins
 *     outskirts     the geotown pattern its outskirts are made of (geotown/pattern.js PATTERNS)
 *
 *   the recipe beside its metro's settings: how it is TOLD, and at what scale
 *     evoke         'metro' (the default: every block to scale), 'skyline' (the whole metro, its tall buildings and its
 *                   water only), 'neighbourhood' (one at a building's detail, `at` its id), 'corridor' (an arterial's
 *                   frontage at detail, `along` its id), 'segment' (one block at detail, `at` its id): EVOKES
 *     at, along     what an evocation centres on (by default the core's neighbourhood or tower block nearest the seat,
 *                   the spine that runs from the shore inland)
 *     play          'real' (lengths to scale: a metro you could drive for an hour) or 'game' (what a walker covers
 *                   compressed: the map, the arterials' spacing, the rings, the blocks, the streets; never a storey, a
 *                   lane or a door): PLAY. An evocation is 'game' unless it says, the metro 'real'
 *
 *   and what it composes
 *     geotowns      { '<neighbourhood id>' | '<block id>': true | { …a geotown's recipe } }: the geotown composed in, at
 *                   any grain and anywhere (the edge or the core), on the metro's land (geocity/towns.js): a
 *                   NEIGHBOURHOOD ('D3') fitted by its ring (true: the outskirts' pattern to scale, as many blocks as it
 *                   holds, a segment where none fits; its streetscape leafy in the outskirts, snug in the frame, urban
 *                   in the core) or the town its recipe asks (`{ neighbourhood: 'annex' }`, a layout, an evocation); a
 *                   BLOCK ('D3.2.1') laid by one of the geotown's block segments (true: the block's own if it is one,
 *                   else its ring's; or `{ segment: 'main-street' }`), cropped to its block and centred in the metro's
 *
 *   readGeocity(spec) → { metro: { id, …card }, grammar, pattern, hills, evoke, at, along, play, geotowns }
 *
 * Metres throughout. Anything off the card is refused by name; nothing here rolls a die.
 */
import { resolveGrammar } from '../city/plan/grammars.js';
import { grammarAtPlay } from '../city/plan/grammar.js';
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
    heights: {
      core: { rail: [8, 80], median: [14, 40] },
      frame: { rail: [5, 15], median: [6, 12] },
      outskirts: { rail: [1, 4], median: [2, 3] },
      corridor: { spine: 8, arterial: 6, depth: 36 },
      nodes: { every: 2, reach: 320 },
    },
    green: { share: 0.12, parks: 1, most: 0.3, weights: { core: 0.4, frame: 1, outskirts: 1.3 }, park: { share: { core: 0.35, frame: 0.5, outskirts: 0.6 }, least: 4000, aspect: 2 } },
    streets: { collector: 600, civic: 6, school: 9000 },
    roads: { lane: 3.3, parking: 2.4, bike: 1.6, lanes: 4, median: { share: 0.25, w: 4 }, oneway: { pairs: 1, lanes: 3 }, streetcar: { spine: true, share: 0.35, gauge: 1.495, row: 7.5 } },
    segments: { core: { tower: 3, podium: 2 }, frame: { midrise: 3, slab: 2 }, outskirts: { houses: 7, apartments: 1, lowrise: 1 } },
    lively: { core: { construction: 0.07, parking: 0.04, vacant: 0.01 }, frame: { construction: 0.06, parking: 0.05, vacant: 0.03 }, outskirts: { construction: 0.02, parking: 0.01, vacant: 0.02 } },
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
    heights: {
      core: { rail: [6, 40], median: [8, 20] },
      frame: { rail: [4, 10], median: [4, 8] },
      outskirts: { rail: [1, 3], median: [1.5, 2.5] },
      corridor: { spine: 6, arterial: 4, depth: 30 },
      nodes: { every: 3, reach: 260 },
    },
    green: { share: 0.16, parks: 1, most: 0.35, weights: { core: 0.4, frame: 1, outskirts: 1.4 }, park: { share: { core: 0.35, frame: 0.5, outskirts: 0.6 }, least: 3000, aspect: 2 } },
    streets: { collector: 560, civic: 6, school: 8000 },
    roads: { lane: 3.2, parking: 2.3, bike: 1.5, lanes: 4, median: { share: 0.4, w: 5 }, oneway: { pairs: 1, lanes: 3 }, streetcar: { spine: true, share: 0, gauge: 1.435, row: 7 } },
    segments: { core: { tower: 2, podium: 3 }, frame: { midrise: 4, slab: 1 }, outskirts: { houses: 8, apartments: 2, lowrise: 0 } },
    lively: { core: { construction: 0.05, parking: 0.04, vacant: 0.02 }, frame: { construction: 0.04, parking: 0.03, vacant: 0.03 }, outskirts: { construction: 0.02, parking: 0.01, vacant: 0.03 } },
    grade: 0.08,
    grammar: 'mediterranean',
    outskirts: 'bay-and-gable',
  }),
});
export const METRO_IDS = Object.freeze(Object.keys(METROS));
export const EVOKES = Object.freeze({
  metro: 'every block to scale, the whole metro as massing',
  skyline: 'the whole metro seen from afar: its tall buildings, its water and its land, nothing low drawn',
  neighbourhood: 'one neighbourhood at a building\'s detail, the eight round it as massing, the rest its skyline',
  corridor: 'an arterial\'s frontage at a building\'s detail from end to end, the neighbourhoods along it as massing, the rest its skyline',
  segment: 'one block at a building\'s detail, its neighbourhood and the ones round it as massing, the rest its skyline',
});
export const EVOKE_IDS = Object.freeze(Object.keys(EVOKES));
/** PLAY SCALES: what `game` multiplies (city/plan's game scale's numbers): the lengths a walker covers, the depth of a
 *  frontage and of a block's rows, a park's least area by both; never a storey, a lane or a door. */
export const PLAY = Object.freeze({ real: null, game: Object.freeze({ pitch: 0.6, depth: 0.8 }) });
export const DEFAULT_METRO = 'lakeshore';
// what a recipe may say beside its metro: each a card's setting laid over the card's
const KEYS = Object.freeze(['metro', 'extent', 'water', 'core', 'fall', 'hills', 'heights', 'green', 'streets', 'segments', 'lively', 'roads', 'grammar', 'outskirts', 'evoke', 'at', 'along', 'play', 'geotowns']);
// (how the recipe is told, and what it composes, not a setting of its metro)
const TOLD = Object.freeze(['evoke', 'at', 'along', 'play', 'geotowns']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`geocity: ${msg}`); };
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
// objects merge all the way down, anything else (a list, a number) replaces
const merge = (a, b) => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b);
const pair = (r, lo, hi) => Array.isArray(r) && r.length === 2 && r.every((v) => num(v, lo, hi));
const rail = (r, lo, hi) => pair(r, lo, hi) && r[0] <= r[1];

/** The metro a recipe names, and its changes over it: each setting replaced, or merged (an object all the way down). */
function readMetro(v) {
  if (v === undefined) return { id: DEFAULT_METRO, ...METROS[DEFAULT_METRO] };
  if (typeof v === 'string') { if (!METROS[v]) no(`metro '${v}' is not a metro (${METRO_IDS.join(', ')})`); return { id: v, ...METROS[v] }; }
  if (!isObj(v) || typeof v.from !== 'string' || !METROS[v.from]) no(`metro is a metro's id (${METRO_IDS.join(', ')}) or { from: <id>, …changes }`);
  const base = METROS[v.from], out = { id: `${v.from}+`, ...base };
  for (const [k, x] of Object.entries(v)) {
    if (k === 'from') continue;
    if (!(k in base)) no(`metro.${k} is not a setting of a metro (${Object.keys(base).join(', ')})`);
    out[k] = merge(base[k], x);
  }
  return out;
}

/** The recipe's `geocity`, checked → the metro as the design reads it. */
export function readGeocity(spec = {}) {
  if (!isObj(spec)) no(`geocity is { ${KEYS.map((k) => `${k}?`).join(', ')} }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a setting of a geocity (${KEYS.join(', ')})`);
  const M = readMetro(spec.metro);
  // a recipe's own settings over its metro's (an object merged all the way down)
  for (const k of KEYS.slice(1)) if (spec[k] !== undefined && !TOLD.includes(k)) M[k] = merge(M[k], spec[k]);
  const evoke = spec.evoke ?? 'metro';
  if (!EVOKES[evoke]) no(`evoke is ${EVOKE_IDS.join(', ')}`);
  const play = spec.play ?? (evoke === 'metro' ? 'real' : 'game');
  if (!(play in PLAY)) no(`play is ${Object.keys(PLAY).join(' or ')}`);
  if (spec.at !== undefined && !['neighbourhood', 'segment'].includes(evoke)) no('at is what a neighbourhood or a segment evocation centres on');
  if (spec.along !== undefined && evoke !== 'corridor') no('along is the arterial a corridor evocation runs along');
  if (spec.at !== undefined && typeof spec.at !== 'string') no('at is a neighbourhood\'s id (\'D3\') or a block\'s (\'D3.2.1\')');
  if (spec.along !== undefined && typeof spec.along !== 'string') no('along is an arterial\'s id (\'ns-3\')');
  // the geotowns it composes: a neighbourhood by its id, laid by the geotown (true: fitted by its ring, or its recipe)
  const geotowns = spec.geotowns ?? {};
  if (!isObj(geotowns) || !Object.entries(geotowns).every(([k, v]) => /^[A-Z]+[0-9]+(\.[0-9]+\.[0-9]+)?$/.test(k) && (v === true || isObj(v)))) no('geotowns is { \'<neighbourhood id>\' | \'<block id>\': true | { …a geotown\'s recipe } }: a neighbourhood (\'D3\') or one block (\'D3.2.1\') laid by the geotown');

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
  const Hs = M.heights;
  if (!isObj(Hs)) no('heights is { core, frame, outskirts, corridor, nodes }');
  for (const k of Object.keys(Hs)) if (![...RING_IDS, 'corridor', 'nodes'].includes(k)) no(`heights.${k} is not a setting (${[...RING_IDS, 'corridor', 'nodes'].join(', ')})`);
  for (const r of RING_IDS) {
    const h = Hs[r];
    if (!isObj(h) || !rail(h.rail, 1, 200) || !pair(h.median, 1, 200) || h.median[0] > h.median[1]) no(`heights.${r} is { rail: [lo, hi] storeys, median: [outer, inner] storeys, outer ≤ inner }`);
    if (h.median.some((v) => v < h.rail[0] || v > h.rail[1])) no(`heights.${r}.median stands inside its rail (${h.rail.join('–')})`);
  }
  if (Hs.outskirts.rail[1] > Hs.frame.rail[1] || Hs.frame.rail[1] > Hs.core.rail[1]) no('heights: each ring\'s rail tops out no higher than the ring inside it');
  if (!isObj(Hs.corridor) || !num(Hs.corridor.spine, 1, 200) || !num(Hs.corridor.arterial, 1, 200) || !num(Hs.corridor.depth, 0, 200)) no('heights.corridor is { spine, arterial: storeys, depth: metres }');
  if (!isObj(Hs.nodes) || !(Number.isInteger(Hs.nodes.every) && Hs.nodes.every >= 0 && Hs.nodes.every <= 12) || !num(Hs.nodes.reach, 0, 3000)) no('heights.nodes is { every: 0–12 (0 none), reach: metres }');
  const Gr = M.green;
  if (!isObj(Gr) || !num(Gr.share, 0, 0.6) || !(Number.isInteger(Gr.parks) && Gr.parks >= 0 && Gr.parks <= 6) || !num(Gr.most, 0, 1) || !isObj(Gr.weights) || !RING_IDS.every((r) => num(Gr.weights[r], 0, 10))) no('green is { share: 0–0.6, parks: 0–6, most: 0–1, weights: { core, frame, outskirts }, park }');
  const Pk = Gr.park;
  if (!isObj(Pk) || !isObj(Pk.share) || !RING_IDS.every((r) => num(Pk.share[r], 0, 1)) || !num(Pk.least, 0, 1e6) || !num(Pk.aspect, 1, 6)) no('green.park is { share: { core, frame, outskirts } 0–1, least: m², aspect: 1–6 }');
  const St = M.streets;
  if (!isObj(St) || !num(St.collector, 100, 12000) || !(Number.isInteger(St.civic) && St.civic >= 1) || !num(St.school, 0, 1e6)) no('streets is { collector: metres, civic: blocks (a whole number), school: m² }');
  const SEG = { core: ['tower', 'podium'], frame: ['midrise', 'slab'], outskirts: ['houses', 'apartments', 'lowrise'] };
  if (!isObj(M.segments)) no('segments is { core, frame, outskirts }, each its segments\' weights');
  for (const [ring, ids] of Object.entries(SEG)) {
    const w = M.segments[ring];
    if (!isObj(w) || Object.keys(w).some((k) => !ids.includes(k)) || !Object.values(w).every((v) => num(v, 0, 100)) || !Object.values(w).some((v) => v > 0)) no(`segments.${ring} is weights over ${ids.join(', ')}, one of them above 0`);
  }
  if (!isObj(M.lively) || !RING_IDS.every((r) => isObj(M.lively[r]) && ['construction', 'parking', 'vacant'].every((k) => num(M.lively[r][k] ?? 0, 0, 0.5)) && Object.keys(M.lively[r]).every((k) => ['construction', 'parking', 'vacant'].includes(k)))) no('lively is { core, frame, outskirts }, each { construction, parking, vacant } shares 0–0.5');
  const Rd = M.roads;
  if (!isObj(Rd) || !num(Rd.lane, 2.5, 4.5) || !num(Rd.parking, 0, 4) || !num(Rd.bike, 0, 3) || !(Number.isInteger(Rd.lanes) && Rd.lanes >= 2 && Rd.lanes <= 8 && Rd.lanes % 2 === 0)) no('roads is { lane: 2.5–4.5 m, parking: m, bike: m, lanes: an even 2–8, median, oneway, streetcar }');
  if (!isObj(Rd.median) || !num(Rd.median.share, 0, 1) || !num(Rd.median.w, 1, 20)) no('roads.median is { share: 0–1, w: metres }');
  if (!isObj(Rd.oneway) || !(Number.isInteger(Rd.oneway.pairs) && Rd.oneway.pairs >= 0 && Rd.oneway.pairs <= 4) || !(Number.isInteger(Rd.oneway.lanes) && Rd.oneway.lanes >= 1 && Rd.oneway.lanes <= 5)) no('roads.oneway is { pairs: 0–4, lanes: 1–5 }');
  if (!isObj(Rd.streetcar) || typeof Rd.streetcar.spine !== 'boolean' || !num(Rd.streetcar.share, 0, 1) || !num(Rd.streetcar.gauge, 0.6, 2) || !num(Rd.streetcar.row, 4, 20)) no('roads.streetcar is { spine: boolean, share: 0–1, gauge: metres, row: metres }');
  if (!num(M.grade, 0.01, 0.3)) no('grade is the steepest arterial, rise over run, 0.01 to 0.3');
  if (!PATTERNS[M.outskirts]) no(`outskirts is a geotown pattern (${PATTERN_IDS.join(', ')})`);
  let grammar = resolveGrammar(M.grammar, 'geocity.grammar'), pattern = { id: M.outskirts, ...PATTERNS[M.outskirts] };
  // at game scale what a walker covers is compressed (checked to scale above, so a card holds either way)
  const k = PLAY[play];
  if (k) {
    const p = (v) => Math.round(v * k.pitch * 100) / 100, q = (v) => Math.round(v * k.depth * 100) / 100;
    M.extent = M.extent.map(p);
    M.water = { ...M.water, depth: p(M.water.depth) };
    M.arterials = { core: M.arterials.core.map(p), outer: M.arterials.outer.map(p), reach: p(M.arterials.reach) };
    M.rings = { core: p(M.rings.core), frame: p(M.rings.frame) };
    M.heights = { ...M.heights, corridor: { ...M.heights.corridor, depth: q(M.heights.corridor.depth) }, nodes: { ...M.heights.nodes, reach: p(M.heights.nodes.reach) } };
    M.green = { ...M.green, park: { ...M.green.park, least: Math.round(M.green.park.least * k.pitch * k.depth) } };
    M.streets = { ...M.streets, collector: p(M.streets.collector), school: Math.round(M.streets.school * k.pitch * k.depth) };
    if (hills) hills = { ...hills, span: p(hills.span) };
    grammar = grammarAtPlay(grammar, 'game');
    pattern = { ...pattern, block: { long: pattern.block.long.map(p), depth: pattern.block.depth.map(q) } };
  }
  return { metro: M, grammar, pattern, hills, evoke, play, geotowns, ...(spec.at !== undefined ? { at: spec.at } : {}), ...(spec.along !== undefined ? { along: spec.along } : {}) };
}
