/**
 * CITY GRAMMARS: how a city is laid out and built, as data, in metres. A grammar answers "how": how long a block runs,
 * how wide a street's right-of-way is, how a lot is cut, how its height falls off the core, what its masses are clad
 * in. Who builds (a civilization) and how it is lit and painted (a geocube or kit) sit beside it, not in it.
 *
 * The Earth grammars are not written here: they are READ from the legacy metro city (fractal-city.js METRO and
 * city-flavors.js CITY_FLAVORS), its city units turned into metres, so the reconstruction gate can hold the new city
 * to the old one's output and both stay one source. A grammar that is not of Earth is written as the same fields.
 *
 * `play` scales a grammar for the way it will be used: 'real' keeps real-world lengths (a layout plan, a matte), 'game'
 * compresses the ground a walker covers (block pitch, rights-of-way, lot depth, the height field's reach) and never
 * what a walker measures themselves against (a storey, a door, a car, a person).
 */
import { METRO, CITY_METERS_PER_UNIT } from '../fractal-city.js';
import { CITY_FLAVORS } from '../city-flavors.js';

const U = CITY_METERS_PER_UNIT;
const r2 = (v) => Math.round(v * 100) / 100;
const m = (v) => r2(v * U);
const span = ([a, b]) => [m(a), m(b)];

// the legacy metro skin palettes, [glass, frame] pairs, read once (fractal-city.js METRO_SKIN is private: these are its
// values, and the reconstruction gate reads the mix, not the colours)
const BASE_SKIN = {
  glass: [['#56636f', '#3a3f45'], ['#627180', '#9aa0a6'], ['#4b5560', '#2b2e32'], ['#6b7a88', '#c3c7ca'], ['#5d6c69', '#7c827f']],
  stone: [['#3f4952', '#c4bfb4'], ['#444c55', '#b2aea6'], ['#3b434b', '#a7a8a5'], ['#475260', '#c3b9a6'], ['#4a5561', '#d0cdc5']],
  brick: [['#835d50', '#cfc6b6'], ['#8d6454', '#d5ccbc'], ['#74584e', '#bdb4a6'], ['#9b8170', '#d8d0c1'], ['#6a5149', '#b9afa1']],
  roof: ['#9e9c96', '#a8a59e', '#86837c', '#6c6d6c', '#bdbcb6', '#8f918d'],
  mix: { glass: [0.05, 1.2, 0], stone: [0.3, 0, 0], brick: [0, 0, 0.5] },
  district: 60, tilt: 3, brickMax: 14, towerGlass: 0.85,   // city units: a material clusters over about two blocks; brick stays under ~15 floors
};

/** The fields every grammar carries. A grammar names each, in metres (heights and storeys in metres too). */
export const GRAMMAR_FIELDS = Object.freeze(['label', 'locale', 'climate', 'traffic', 'layout', 'block', 'street', 'lot', 'height', 'tower', 'floorH', 'skin', 'facade', 'wear', 'shapes', 'transit', 'walk']);
/** The transit modes a grammar may run. A maglev rides an elevated guideway on pylons; a tram and a bus run at grade. */
export const TRANSIT_MODES = Object.freeze(['tram', 'bus', 'maglev']);
/** The street layouts a grammar may name. The plan lays 'grid' today; the others are the grammar's word for later. */
export const LAYOUTS = Object.freeze(['grid']);

/** A legacy flavour (or none) read as a grammar, in metres. */
export function grammarFromFlavor(key) {
  const F = key ? CITY_FLAVORS[key] : null;
  if (key && !F) throw new Error(`city grammar: '${key}' is not a city flavour (${Object.keys(CITY_FLAVORS).join(', ')})`);
  const H = { ...METRO.height, ...(F?.height || {}) }, T = { ...METRO.tower, ...(F?.tower || {}) }, L = { ...METRO.lot, ...(F?.lot || {}) };
  const skin = F?.skin || {};
  return {
    label: F?.label || 'North American downtown',
    locale: F?.locale || 'north-america',
    climate: F?.climate || 'temperate',
    traffic: 'right',
    layout: 'grid',
    // the legacy recursion stops cutting a region narrower than `leaf` and refuses a child under `minBlock`
    block: { pitch: [m(METRO.leaf * 0.95), m(METRO.leaf * 1.4)], avenueEvery: 3 },
    // right-of-way per side: the legacy `walk` is both sidewalks together
    street: {
      minor: { road: m(METRO.street.minor), walk: m(METRO.walk.minor / 2) },
      major: { road: m(METRO.street.major), walk: m(METRO.walk.major / 2) },
    },
    lot: { front: span(L.front), wide: span(L.wide), wideP: L.wideP, depth: span(L.depth), court: m(L.court) },
    height: {
      core: m(H.core), edge: m(H.edge), sigmaCore: H.sigmaCore, sigmaEdge: H.sigmaEdge,
      lambda: span(H.lambda), lambdaFrac: H.lambdaFrac, slender: H.slender, ...(H.cap !== undefined ? { cap: m(H.cap) } : {}),
    },
    tower: { p: T.p, second: T.second, secondAt: T.secondAt, h: span(T.h), slender: T.slender, base: span(T.base), shapes: T.shapes || [0.35, 0.7, 0.85] },
    floorH: { residential: m(METRO.floorH.residential), office: m(METRO.floorH.office) },
    skin: {
      mix: skin.mix || BASE_SKIN.mix,
      glass: skin.glass || BASE_SKIN.glass, stone: skin.stone || BASE_SKIN.stone, brick: skin.brick || BASE_SKIN.brick,
      roof: skin.roof || BASE_SKIN.roof,
      ...(skin.stoneRhythm ? { stoneRhythm: skin.stoneRhythm } : {}),
      // a district (a lattice of `district` m) tilts toward its own material by `tilt`; brick never over `brickMax` m;
      // a tower is curtainwall `towerGlass` of the time
      district: m(BASE_SKIN.district), tilt: BASE_SKIN.tilt, brickMax: m(skin.brickMax ?? BASE_SKIN.brickMax), towerGlass: BASE_SKIN.towerGlass,
    },
    // the flavour's affectations, in the legacy flavour's own words and units (city-flavors.js), laid by its flavorFacade
    facade: F?.facade || {},
    // a facade every lot wears over its skin (a descriptor, facades.js FACADE_FIELDS), and the shapes a lot's mass may
    // stand as ({ box, setback, podium, cylinder: weight, minFloors }): none for an Earth grammar
    wear: null,
    shapes: null,
    // a stop every `stop` m along a line; every lot within `reach` m of one
    transit: { modes: ['tram', 'bus'], stop: 400, reach: 500 },
    // the walk: a crossing at least every `crossing` m of block face, something to meet (a shopfront, a place, a stop,
    // a corner) every `beat` m
    walk: { crossing: 200, beat: 120, speed: 1.4 },
  };
}

/** The grammars a plan may name: every Earth flavour of the legacy metro city, read into metres. */
export const CITY_GRAMMARS = Object.freeze(Object.fromEntries(Object.keys(CITY_FLAVORS).map((k) => [k, Object.freeze(grammarFromFlavor(k))])));
export const GRAMMAR_IDS = Object.freeze(Object.keys(CITY_GRAMMARS));
export const DEFAULT_GRAMMAR = 'north-american';

/**
 * PLAY SCALES. `game` compresses what the walker covers: block pitch (×0.6), the right-of-way (×0.8, never a lane under
 * 3 m), lot depth (×0.8), the height field's reach (×0.6), stop spacing and transit reach (×0.6), and holds the walk to
 * a tighter rhythm; a game city is timed at a player's run (5 m/s), a real one at a person's walk (1.4 m/s). A storey, a
 * lot's frontage, a tower's height are never scaled.
 */
export const PLAY_SCALES = Object.freeze({
  real: { pitch: 1, row: 1, depth: 1, field: 1, transit: 1, crossing: 1, beat: 1, cell: 100, pace: 1.4 },
  game: { pitch: 0.6, row: 0.8, depth: 0.8, field: 0.6, transit: 0.6, crossing: 0.6, beat: 0.5, cell: 50, pace: 5 },
});
export const PLAY_IDS = Object.freeze(Object.keys(PLAY_SCALES));

/** A grammar at a play scale: the lengths the walker covers scaled, nothing a walker measures themselves by. */
export function grammarAtPlay(G, play) {
  const P = PLAY_SCALES[play];
  if (!P) throw new Error(`city grammar: play is ${PLAY_IDS.join(' or ')} (got ${JSON.stringify(play)})`);
  const lane = (s) => ({ road: r2(Math.max(6, s.road * P.row)), walk: r2(Math.max(2.4, s.walk * P.row)) });
  return {
    ...G,
    play,
    block: { ...G.block, pitch: G.block.pitch.map((v) => r2(v * P.pitch)) },
    street: { minor: lane(G.street.minor), major: lane(G.street.major) },
    lot: { ...G.lot, depth: G.lot.depth.map((v) => r2(v * P.depth)), court: r2(G.lot.court * P.depth) },
    height: { ...G.height, lambda: G.height.lambda.map((v) => r2(v * P.field)) },
    transit: { ...G.transit, stop: r2(G.transit.stop * P.transit), reach: r2(G.transit.reach * P.transit) },
    walk: { ...G.walk, crossing: r2(G.walk.crossing * P.crossing), beat: r2(G.walk.beat * P.beat), speed: P.pace },
  };
}
