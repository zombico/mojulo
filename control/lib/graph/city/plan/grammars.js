/**
 * GRAMMARS AS DOCUMENTS: a plan's `grammar` is a grammar's id, or a document `{ from: <id>, …changes }` that rewrites
 * any field of the grammar it starts from (objects merge, lists replace), held to GRAMMAR_SCHEMA and refused by name.
 * That is how a city that is not of Earth is written: the same fields as Paris, other values, and the vocabulary the
 * Earth grammars never reach for (a facade every lot wears, mass shapes, a maglev).
 *
 * The WORLD GRAMMARS below are written that way, as data, and ship beside the Earth ones as proof the abstraction holds:
 * a cyberpunk sprawl from Tokyo's grain, an alien garden city from the Mediterranean's.
 */
import { CITY_GRAMMARS as EARTH, TRANSIT_MODES, LAYOUTS } from './grammar.js';
import { readFacade, ROOFTOP_KIT, MASS_SHAPES } from './facades.js';
import { SPECIES } from '../../vegetation/species.js';

const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// leaf tests: each returns null when it holds, else what it wants
const num = (lo, hi) => (v) => (typeof v === 'number' && v >= lo && v <= hi ? null : `a number ${lo}–${hi}`);
const int = (lo, hi) => (v) => (Number.isInteger(v) && v >= lo && v <= hi ? null : `a whole number ${lo}–${hi}`);
const range = (lo, hi) => (v) => (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && x >= lo && x <= hi) && v[0] <= v[1] ? null : `[low, high], ${lo}–${hi}`);
const str = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 80 ? null : 'a short text');
const word = (xs) => (v) => (xs.includes(v) ? null : xs.map((x) => `'${x}'`).join(' | '));
const hexes = (v) => (Array.isArray(v) && v.length > 0 && v.every((h) => HEX.test(h)) ? null : "a list of '#rrggbb'");
const pairs = (v) => (Array.isArray(v) && v.length > 0 && v.every((p) => Array.isArray(p) && p.length === 2 && p.every((h) => HEX.test(h))) ? null : "a list of ['#rrggbb', '#rrggbb'] pairs");
const words = (xs, min = 1) => (v) => (Array.isArray(v) && v.length >= min && v.every((x) => xs.includes(x)) ? null : `a list of ${xs.join(', ')}`);
const mixRow = (v) => (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && x >= 0 && x <= 4) ? null : '[base, core, edge], each 0–4');
const prob = num(0, 1);
const lane = { road: num(4, 40), walk: num(1.5, 12) };

/** Every field a grammar document may write, and what each leaf holds. */
export const GRAMMAR_SCHEMA = Object.freeze({
  label: str, locale: str, climate: str, traffic: word(['right', 'left']), layout: word(LAYOUTS),
  block: { pitch: range(30, 300), avenueEvery: int(2, 8) },
  street: { minor: lane, major: lane },
  lot: { front: range(3, 40), wide: range(6, 80), wideP: prob, depth: range(6, 60), court: num(4, 80) },
  height: { core: num(3, 600), edge: num(3, 300), sigmaCore: num(0, 1.5), sigmaEdge: num(0, 1.5), lambda: range(50, 3000), lambdaFrac: num(0.05, 1), slender: num(2, 20), cap: num(3, 900) },
  tower: { p: prob, second: prob, secondAt: prob, h: range(20, 900), slender: range(2, 20), base: range(8, 120), spindle: prob, shapes: (v) => (Array.isArray(v) && v.length === 3 && v.every((x, i) => typeof x === 'number' && x >= (i ? v[i - 1] : 0) && x <= 1) ? null : '[setback, box, podium] cumulative odds, the rest cylinder') },
  floorH: { residential: num(2.4, 8), office: num(2.8, 8) },
  skin: { mix: { glass: mixRow, stone: mixRow, brick: mixRow }, glass: pairs, stone: pairs, brick: pairs, roof: hexes, stoneRhythm: words(['curtain', 'grid', 'banded', 'pier', 'punched']), district: num(50, 1000), tilt: num(1, 10), brickMax: num(3, 300), towerGlass: prob },
  // the legacy flavour's affectation words (city-flavors.js), in its units
  facade: {
    fireEscape: prob, storefront: prob,
    kit: (v) => (Array.isArray(v) && v.every((k) => isObj(k) && ROOFTOP_KIT.includes(k.item) && typeof k.p === 'number' && Number.isInteger(k.minFloors)) ? null : `a list of { item (${ROOFTOP_KIT.join(', ')}), p, minFloors }`),
    awning: { p: prob, tints: hexes },
    sign: { p: prob, palette: hexes },
    blades: { p: prob, minFloors: int(1, 60), maxFloors: int(1, 200), palette: hexes },
    balcony: { p: prob, types: words(['slab', 'vertical-rail', 'french', 'partitioned', 'continuous']), bays: words(['all', 'alt', 'col']), floors: (v) => (Array.isArray(v) && v.every((x) => Number.isInteger(x) && x >= 1) ? null : 'a list of floors') },
    roof: { form: word(['mansard', 'hip']), p: prob, maxFloors: int(1, 60), on: words(['glass', 'stone', 'brick']), rise: num(0.2, 4), tints: hexes, chimneys: (v) => (typeof v === 'boolean' ? null : 'true or false') },
  },
  wear: 'facade',
  shapes: { box: num(0, 10), setback: num(0, 10), podium: num(0, 10), cylinder: num(0, 10), undulate: num(0, 10), spindle: num(0, 10), minFloors: int(1, 100) },
  night: { windows: prob, shops: prob, palette: hexes },
  green: { street: prob, median: prob, park: prob, plaza: prob, court: prob, stride: num(4, 40), walk: num(1, 12), palms: prob, conifers: prob, shrubs: prob,
    trees: (v) => (Array.isArray(v) && v.length && v.every((x) => SPECIES[x]?.kind === 'tree') ? null : `a list of tree species (${Object.keys(SPECIES).filter((k) => SPECIES[k].kind === 'tree').join(', ')})`),
    conifer: word(Object.keys(SPECIES).filter((k) => SPECIES[k].kind === 'conifer' || k === 'fir')),
    palm: word(Object.keys(SPECIES).filter((k) => SPECIES[k].kind === 'palm')) },
  transit: { modes: words(TRANSIT_MODES), stop: num(50, 2000), reach: num(50, 3000) },
  walk: { crossing: num(40, 600), beat: num(20, 400), speed: num(0.5, 10) },
});

function check(v, schema, at) {
  if (schema === 'facade') return readFacade(v, at);
  if (typeof schema === 'function') { const want = schema(v); if (want) throw new Error(`city: ${at} is ${want} (got ${JSON.stringify(v)})`); return v; }
  if (!isObj(v)) throw new Error(`city: ${at} is { ${Object.keys(schema).join(', ')} }`);
  for (const [k, x] of Object.entries(v)) {
    if (!(k in schema)) throw new Error(`city: ${at}.${k} is not a grammar field (${Object.keys(schema).join(', ')})`);
    check(x, schema[k], `${at}.${k}`);
  }
  return v;
}
// objects merge, lists and leaves replace
function merge(base, over) {
  if (!isObj(over)) return over;
  const out = { ...(isObj(base) ? base : {}) };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  return out;
}

/**
 * THE WORLD GRAMMARS: cities that are not of Earth, written as documents over Earth grammars. Each stays inside the
 * schema: what it cannot say yet (organic masses grown from a surface, vehicles on its guideways) is said in its label
 * as what it reaches toward, not faked.
 */
export const WORLD_GRAMMAR_DOCS = Object.freeze({
  'neon-sprawl': {
    from: 'tokyo', label: 'Neon sprawl (cyberpunk)', locale: 'off-world', climate: 'wet',
    skin: {
      mix: { glass: [0.25, 1.6, 0], stone: [0.6, 0, 0.3], brick: [0, 0, 0] },
      glass: [['#1d2733', '#0e1218'], ['#22303c', '#3a4654'], ['#18202a', '#59626d'], ['#2a2440', '#14121c']],
      stone: [['#1a1d22', '#4a4f57'], ['#202329', '#5b5f66'], ['#16181c', '#3c4047'], ['#24272d', '#6a6e74']],
      roof: ['#2a2d33', '#33363c', '#1f2226'], stoneRhythm: ['banded', 'grid'], towerGlass: 1,
    },
    facade: {
      blades: { p: 0.9, minFloors: 2, maxFloors: 40, palette: ['#ff2a6d', '#05d9e8', '#f9f871', '#d1f7ff', '#ff6c11', '#b967ff'] },
      sign: { p: 0.9, palette: ['#ff2a6d', '#05d9e8', '#f9f871', '#b967ff'] },
      kit: [{ item: 'satellite-dish', p: 0.6, minFloors: 3 }, { item: 'antenna', p: 0.5, minFloors: 3 }, { item: 'billboard', p: 0.35, minFloors: 5 }],
      awning: { p: 0.5, tints: ['#14121c', '#2a2440', '#ff2a6d'] },
      storefront: 0.95,
    },
    wear: { crown: 'screen', mullion: 2.4 },
    height: { core: 70, edge: 16, sigmaCore: 0.9, sigmaEdge: 0.6, slender: 12 },
    tower: { p: 1, second: 0.9, secondAt: 0.3, h: [160, 420], slender: [7, 11], shapes: [0.45, 0.6, 0.9] },
    shapes: { box: 6, setback: 2, podium: 2, cylinder: 0, minFloors: 10 },
    // a sprawl paved over: a few trees in planters, the parks the green there is
    green: { street: 0.12, plaza: 0.3, court: 0.1 },
    // a sprawl that never sleeps: more of it lit, in screen light as much as lamplight
    night: { windows: 0.45, shops: 1, palette: ['#9ff3ff', '#ff9ad0', '#fff3c4', '#c8b6ff', '#7fd9ff', '#ffd38a'] },
    transit: { modes: ['maglev', 'bus'] },
  },
  'xeno-garden': {
    // organic masses (organic.js) carry it: rippling walls and roofs with sculpted chimneys, spires that swell and taper
    from: 'mediterranean', label: 'Xeno garden (alien modernista: rippling walls, spindle spires)', locale: 'off-world', climate: 'alien',
    skin: {
      mix: { glass: [0.1, 0.5, 0], stone: [1, 0, 0], brick: [0, 0, 0] },
      stone: [['#1f4a4c', '#e3c9a0'], ['#2c3f5a', '#d98f6b'], ['#3d2f4f', '#f0e6d2'], ['#244f3a', '#c9b46a'], ['#4a2f2a', '#8fc7c0'], ['#2a3b4a', '#e8a8a0']],
      glass: [['#4fa3a0', '#2a5f5c'], ['#7c6fb0', '#3d3466'], ['#a3c96a', '#4f6b2f']],
      roof: ['#3f8f84', '#5aa58f', '#b56b45', '#2f6f74'], stoneRhythm: ['punched', 'pier'], towerGlass: 0.3,
    },
    facade: {
      balcony: { p: 0.85, types: ['continuous', 'french'], bays: ['all', 'alt'] },
      roof: { form: 'hip', p: 0.25, maxFloors: 6, on: ['stone'], rise: 1.6, tints: ['#3f8f84', '#b56b45', '#5aa58f'] },
      awning: { p: 0.4, tints: ['#3f8f84', '#d98f6b', '#7c6fb0'] },
      storefront: 0.5,
    },
    wear: { crown: 'none' },
    height: { core: 42, edge: 14, sigmaCore: 0.5, sigmaEdge: 0.35, cap: 140 },
    tower: { p: 0.6, h: [60, 140], slender: [3, 5], shapes: [0.05, 0.1, 0.25], spindle: 0.75 },
    shapes: { box: 0.6, setback: 0.4, podium: 0.3, cylinder: 1.2, undulate: 4, spindle: 0.6, minFloors: 3 },
    lot: { front: [9, 20], wide: [22, 40], wideP: 0.3 },
    // a garden city: everything grows, much of it strange (palms and shrubs where the Mediterranean had planes)
    green: { street: 0.85, park: 1, plaza: 0.8, court: 0.8, palms: 0.3, shrubs: 0.6, trees: ['schefflera', 'strangler'], palm: 'treefern' },
    // rooms lit by what grows in them
    night: { windows: 0.35, shops: 0.9, palette: ['#9dffce', '#7ff0ff', '#e2ff9a', '#ffd6f4', '#b8fff0'] },
    transit: { modes: ['maglev', 'tram'] },
  },
});

export const GRAMMAR_IDS = Object.freeze([...Object.keys(EARTH), ...Object.keys(WORLD_GRAMMAR_DOCS)]);

/** A grammar document (or an id) resolved to a whole grammar. Documents chain through `from`. */
export function resolveGrammar(spec, at = 'grammar', seen = []) {
  if (typeof spec === 'string') {
    if (EARTH[spec]) return EARTH[spec];
    if (WORLD_GRAMMAR_DOCS[spec]) return resolveGrammar(WORLD_GRAMMAR_DOCS[spec], at, [...seen, spec]);
    throw new Error(`city: ${at} is one of ${GRAMMAR_IDS.join(', ')}, or a document { from: <one of them>, …changes } (got ${JSON.stringify(spec)})`);
  }
  if (!isObj(spec)) throw new Error(`city: ${at} is a grammar's id or a document { from, …changes }`);
  const { from, ...changes } = spec;
  if (typeof from !== 'string' || !(EARTH[from] || WORLD_GRAMMAR_DOCS[from])) throw new Error(`city: ${at}.from is the grammar it starts from: ${GRAMMAR_IDS.join(', ')}`);
  if (seen.includes(from)) throw new Error(`city: ${at}.from '${from}' comes back to itself`);
  for (const [k, v] of Object.entries(changes)) {
    if (!(k in GRAMMAR_SCHEMA)) throw new Error(`city: ${at}.${k} is not a grammar field (${Object.keys(GRAMMAR_SCHEMA).join(', ')})`);
    check(v, GRAMMAR_SCHEMA[k], `${at}.${k}`);
  }
  const base = resolveGrammar(from, `${at}.from`, seen);
  const out = merge(base, changes);
  if (out.height.edge > out.height.core) throw new Error(`city: ${at}.height.edge (${out.height.edge} m) stands over its core (${out.height.core} m)`);
  return out;
}

export const WORLD_GRAMMARS = Object.freeze(Object.fromEntries(Object.keys(WORLD_GRAMMAR_DOCS).map((k) => [k, Object.freeze(resolveGrammar(k))])));
export const isEarthGrammar = (id) => typeof id === 'string' && !!EARTH[id];
/** The label a grammar spec reads as. */
export const grammarLabel = (spec) => resolveGrammar(spec).label;
