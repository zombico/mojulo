/**
 * ARCHITECTURAL STYLE — what a place's builders build, as one document the model writes (or takes from a starter and
 * changes): the town, the city and the dress follow from it, and anything it does not say the cube's defaults keep. A
 * style composes what exists: the building language's elements on their rails (era/out-anchor-elements.js) and the
 * material words below; the buildings' design stays the model's, and the starters are examples, never the limit.
 *
 *   { read, class: 'ancient' | 'modern',
 *     language:  an anchor's id | an anchor's own { elements, compose, read?, storeyH? }
 *                | { from: <anchor id>, elements: { <id>: element | null }, compose?, read?, storeyH? }
 *                  (an element written whole, with its kind, replaces the anchor's; one without a kind changes the
 *                  anchor's own; null drops it)
 *     materials: { <surface>: word } (a city's wall rhythms take a word or a list, a building picking one by its dice)
 *     palette:   { <surface>: '#rrggbb' } a colour over its word's own
 *     city:      { grain?: a city grammar's id, …a grammar's changes } (city/plan/grammars.js) }
 *
 * The SURFACES: a town's plaster, stone, timber, shell, paint (shutters, bands: a colour only), plinth and roof (whatever
 * covers its caps); a city's punched, pier, banded and grid walls; the road and the walk of a city and of a town's street.
 *
 *   MATERIAL_WORDS         the words, each { class, on, colour, read, tile? }: a dressed tile (matte-paint/dressed.js) a
 *                          gritty cube lays as relief, and a colour of its own (null: the cube's); a class 'either' is
 *                          built in both (clay tile, slate)
 *   STYLE_STARTERS         a small catalogue across periods and places, each a recipe to take { from, …changes }
 *   readStyle(spec)        → the style resolved (its language composed and checked), or refused saying what is allowed
 *   styleLaws(S)           → [{ law, ok, value }]: what advises, never refuses
 *   styleTownDress(S, cube, dress)   a town's dress with the style's words over the cube's own (town-dress.js)
 *   styleGrammar(S, kit, seed, language)   the city grammar a style builds: its language (or the one a settlement
 *                          names over it) at its grain, its changes over it
 *   styleReadout(S)        what a specimen says of its style
 *
 * Pure; the cube's numbers only.
 */
import { ELEMENT_SETS, composeAnchor } from './out-anchor-elements.js';
import { ANCHOR_IDS } from './out-anchor-structure.js';
import { GRAMMAR_IDS, resolveGrammar } from '../city/plan/grammars.js';
import { civilizationGrammar } from '../city/plan/civilization.js';
import { grittyOf } from '../matte-paint/fabric.js';

const no = (msg) => { throw new Error(`style: ${msg}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const r2 = (v) => Math.round(v * 100) / 100;

export const STYLE_CLASSES = Object.freeze(['ancient', 'modern']);
/** The surfaces a style dresses: what each takes (a wall, a roof or a ground word; paint a colour only). */
export const SURFACES = Object.freeze({
  plaster: 'wall', stone: 'wall', timber: 'wall', shell: 'wall', plinth: 'wall', paint: null, roof: 'roof',
  punched: 'wall', pier: 'wall', banded: 'wall', grid: 'wall', road: 'ground', walk: 'ground',
});
const CITY_WALLS = ['punched', 'pier', 'banded', 'grid'];

// ── the words ───────────────────────────────────────────────────────────────────────────────────────────────────────
// a word's tile from the cube's numbers (X: its stone, mortar, coat, floor and trim colours, its wear): the dressed
// tile's params without gen or seed, and the metres it repeats at
const W = (cls, on, colour, read, tile = null) => Object.freeze({ class: cls, on, colour, read, ...(tile ? { tile } : {}) });
export const MATERIAL_WORDS = Object.freeze({
  // ANCIENT: hand-worked, lime-bound, worn by loss, spalling and lichen
  limewash: W('ancient', 'wall', '#ece6d9', 'a lime coat washed white over rubble, worn thin where the weather takes it',
    (X) => ({ params: { cut: 'render', stone: X.stone, mortar: X.mortar, render: [236, 230, 217], rows: 7, cols: 3, ...X.wear, loss: r2(X.loss * 0.15) }, metres: 3 })),
  'lime-render': W('ancient', 'wall', null, 'a lime render over coursed stone, fallen away in patches to the stone',
    (X) => ({ params: { cut: 'render', stone: X.stone, mortar: X.mortar, render: X.coat, rows: 6, cols: 2, ...X.wear, loss: X.loss }, metres: 3 })),
  ashlar: W('ancient', 'wall', null, 'squared blocks in courses, tooled (rock-faced on a gritty cube)',
    (X) => ({ params: { stone: X.stone, mortar: X.mortar, rows: 5, cols: 2, tool: X.grit >= 0.85 ? 'pitched' : 'tooled', ...X.wear }, metres: 2.4 })),
  rubble: W('ancient', 'wall', null, 'rough stones in uneven courses, wide joints of lime',
    (X) => ({ params: { stone: X.stone, mortar: X.mortar, rows: 7, cols: 3, tool: 'pitched', joint: 0.03, vary: 30, ...X.wear }, metres: 2.4 })),
  'hand-brick': W('ancient', 'wall', '#a0583f', 'soft hand-made brick laid in lime, each its own size and burn',
    (X) => ({ params: { stone: [160, 88, 63], mortar: [196, 186, 166], rows: 14, cols: 5, tool: 'none', joint: 0.012, vary: 22, ...X.wear }, metres: 1.2 })),
  adobe: W('ancient', 'wall', '#b48a63', 'mud brick under an earth plaster, washed away at the foot and the arrises',
    (X) => ({ params: { cut: 'render', stone: [150, 112, 80], mortar: [120, 90, 64], render: [180, 138, 99], rows: 8, cols: 3, ...X.wear, loss: r2(X.loss * 0.25) }, metres: 3 })),
  boards: W('ancient', 'wall', null, 'upright boards, gapped, cupped and weathered',
    (X) => ({ params: { cut: 'boards', stone: X.trim, mortar: X.mortar, cols: 9, ...X.wear }, metres: 2 })),
  'clay-tile': W('either', 'roof', '#a55a40', 'clay tiles in lapped courses',
    (X) => ({ params: { cut: 'tile', stone: [165, 90, 64], mortar: X.mortar, rows: 10, cols: 8, ...X.wear }, metres: 2 })),
  slate: W('either', 'roof', '#4f555e', 'thin slates, half-bonded, each a little askew',
    (X) => ({ params: { cut: 'slate', stone: [79, 85, 94], mortar: X.mortar, rows: 12, cols: 6, ...X.wear }, metres: 2 })),
  shingle: W('ancient', 'roof', '#6b6258', 'split timber shingles in close courses',
    (X) => ({ params: { cut: 'slate', stone: [107, 98, 88], mortar: X.mortar, rows: 14, cols: 8, ...X.wear }, metres: 2 })),
  thatch: W('ancient', 'roof', '#9c8456', 'reed or straw laid thick (a colour: no tile paints it yet)'),
  flags: W('ancient', 'ground', null, 'worn flagstones',
    (X) => ({ params: { face: 'floor', stone: X.floor, mortar: X.mortar, rows: 3, cols: 3, tool: 'none', ...X.wear }, metres: 1.8 })),
  setts: W('ancient', 'ground', null, 'small stones in courses, crowned and worn smooth',
    (X) => ({ params: { cut: 'setts', face: 'floor', stone: X.stone, mortar: X.floor, rows: 10, cols: 8, vary: 24, ...X.wear }, metres: 1.2 })),
  earth: W('ancient', 'ground', '#8a7358', 'a beaten earth way (a colour)'),
  // (the rooms' floor brick, art-direction.js BRICK_FLOOR: stone-brick in herringbone, a paver a fifth of a metre; painted
  // in greys, laid as a detail under the word's colour)
  'brick-paving': W('either', 'ground', '#9a5a44', 'floor bricks in herringbone, sand in the joints',
    (X) => ({ params: { gen: 'stone-brick', bond: 'herringbone', stone: [176, 176, 176], mortar: [132, 132, 132], rows: 8, radius: 0.2, shadow: 0.45, mortarThick: 0.1, bevel: 0.18, vary: 14, grain: 11, accent: 0.08, jointDepth: 0.5, chips: r2(Math.min(0.45, 0.1 + 0.35 * X.grit)) }, metres: 1.6 })),
  // (the rooms' rubble floor, art-direction.js RUBBLE's bond: rounded field stones with wide earth between them)
  'stone-road': W('ancient', 'ground', null, 'field stones set in the earth, the dirt between them',
    (X) => ({ params: { gen: 'stone-brick', bond: 'rubble', stone: [184, 184, 184], mortar: [112, 112, 112], rows: 7, radius: 0.5, shadow: 0.6, mortarThick: 0.14, bevel: 0.28, vary: 22, grain: 12, jointDepth: 0.6, chips: r2(Math.min(0.45, 0.1 + 0.3 * X.grit)) }, metres: 1.6 })),
  gravel: W('either', 'ground', null, 'small stones lying close in a bed of grit',
    (X) => ({ params: { cut: 'gravel', face: 'floor', stone: X.stone, mortar: X.mortar, vary: 18, ...X.wear }, metres: 1 })),
  // MODERN: machine-made, cement-bound, worn by the weather and never by loss
  'wire-brick': W('modern', 'wall', '#9c5440', 'wire-cut brick in an exact stretcher bond, thin struck joints',
    (X) => ({ params: { cut: 'brick', stone: [158, 82, 62], mortar: [176, 170, 160], rows: 16, cols: 5, vary: 14, ...X.machine }, metres: 1.2 })),
  stucco: W('modern', 'wall', null, 'a floated coat with a control joint, hairline cracks and a soft repaint',
    (X) => ({ params: { cut: 'stucco', stone: X.stone, mortar: X.mortar, render: X.coat, ...X.machine }, metres: 3 })),
  'sawn-stone': W('modern', 'wall', null, 'sawn stone with hairline joints and no chips',
    (X) => ({ params: { stone: X.stone, mortar: X.mortar, rows: 4, cols: 2, tool: 'none', joint: 0.005, recess: 0.002, chamfer: 0.003, pillow: 0.0005, vary: 10, ...X.machine }, metres: 2.4 })),
  precast: W('modern', 'wall', '#c9c3b5', 'chamfered precast panels, dark sealant joints, the dirt washed down from each',
    (X) => ({ params: { cut: 'precast', stone: [204, 198, 186], mortar: X.mortar, cols: 2, rows: 1, vary: 8, ...X.machine }, metres: 3 })),
  concrete: W('modern', 'wall', '#a9a7a1', 'board-formed concrete: the boards\' grain pressed in, tie holes in rows',
    (X) => ({ params: { cut: 'concrete', stone: [168, 166, 160], mortar: X.mortar, cols: 2, rows: 1, vary: 10, ...X.machine }, metres: 2.4 })),
  glass: W('modern', 'wall', null, 'a curtain wall of glass in metal mullions (left as the city draws it)'),
  pavement: W('modern', 'ground', '#b8b5ae', 'a concrete sidewalk scored into slabs, broom-finished',
    (X) => ({ params: { cut: 'pavement', face: 'floor', stone: [176, 174, 168], mortar: X.mortar, cols: 2, vary: 8, ...X.machine }, metres: 3 })),
  asphalt: W('modern', 'ground', '#3f3e3c', 'aggregate in its binder, patched and sealed',
    (X) => ({ params: { cut: 'asphalt', face: 'floor', stone: [70, 70, 72], mortar: X.mortar, vary: 8, ...X.machine }, metres: 4 })),
});
export const MATERIAL_WORD_IDS = Object.freeze(Object.keys(MATERIAL_WORDS));
const wordsFor = (on) => MATERIAL_WORD_IDS.filter((w) => MATERIAL_WORDS[w].on === on);

/** A cube's numbers a word's tile is painted from. */
export function materialContext(cube) {
  const g = cube.grit ?? 0, stone = rgbOf(cube.colour.stone);
  return {
    grit: g, stone, mortar: stone.map((v) => Math.round(v * 0.68)), floor: rgbOf(cube.colour.floor), trim: rgbOf(cube.colour.trim),
    coat: rgbOf(cube.colour.floor).map((v) => Math.min(255, Math.round(v * 1.05 + 10))),
    wear: { grit: g, spall: Math.min(1, g), pit: Math.round(60 * g) / 100 }, machine: { grit: g, spall: 0, pit: Math.round(10 * g) / 100 },
    loss: Math.round(Math.min(1, 0.1 + 0.6 * g) * 100) / 100,
  };
}
/** A word's dressed tile spec on a cube ({ gen, …params, seed }, metres), or null (a colour-only word). */
export function wordTile(word, X, seed) {
  const T = MATERIAL_WORDS[word]?.tile?.(X);
  return T ? { spec: { gen: 'dressed', ...T.params, seed }, metres: T.metres } : null;
}

// ── the starters ────────────────────────────────────────────────────────────────────────────────────────────────────
const st = (group, value, bond = 'none') => ({ group, value, bond });
export const STYLE_STARTERS = Object.freeze({
  'whitewashed-island': {
    read: 'a whitewashed island village: cubic houses under flat roofs, limewash over rubble, small lights with blue shutters, a flagged lane between rendered yard walls',
    class: 'ancient',
    language: { from: 'timber-hall', read: 'a cube of whitewashed rubble under a flat roof, small square lights, shutters', elements: {
      wall: { storeys: [st('str:plaster', 0.92), st('str:plaster', 0.94)] },
      roof: { kind: 'cap', form: 'flat', eave: 0.2, group: 'str:plaster', value: 0.95 },
      lights: { w: 0.8, h: 1, bay: 2.4, frame: 0.06, glazing: 'casement', trim: 'str:paint', trimValue: 0.5 }, door: { leaf: 'boards', steps: 1 },
      socle: { h: 0.35, group: 'str:plaster', value: 0.86 }, shutters: { share: 0.8, form: 'boards' },
      sills: null, lintels: null, quoins: null, stack: null, frame: null, pickets: null,
      road: { paving: 'flags' }, yards: { form: 'rendered' },
    }, compose: { mass: { w: 7, d: 6.5 } } },
    materials: { plaster: 'limewash', plinth: 'rubble', road: 'flags', walk: 'flags', punched: 'limewash', pier: 'limewash', banded: 'limewash' },
    palette: { paint: '#2f5d8a' },
    city: { grain: 'mediterranean' },
  },
  'tudor-market': {
    read: 'a Tudor market town: a rubble ground storey, lime render between dark timbers above, steep clay-tiled gables, a setts lane',
    class: 'ancient',
    language: { from: 'timber-hall', elements: {
      wall: { storeys: [st('str:stone', 0.58, 'coursed'), st('str:plaster', 0.9)] },
      roof: { pitch: 50, eave: 0.6, value: 0.42 }, frame: { member: 0.24, value: 0.18 }, shutters: { share: 0.3, form: 'boards' },
      lights: { frame: 0.08, glazing: 'lattice', trim: 'str:timber', trimValue: 0.2 }, door: { leaf: 'boards', surround: 'frame', steps: 1 },
    } },
    materials: { plaster: 'lime-render', stone: 'rubble', timber: 'boards', roof: 'clay-tile', plinth: 'rubble', road: 'setts', walk: 'flags', punched: 'lime-render', pier: 'ashlar', banded: 'lime-render' },
    palette: { timber: '#3b2b22', plaster: '#e9e0c9' },
    city: { grain: 'london' },
  },
  'georgian-terrace': {
    read: 'a Georgian brick terrace: hand-made brick in two even storeys, tall sash lights in white stucco surrounds, a slate hip behind a cornice, railings',
    class: 'ancient',
    language: { from: 'timber-hall', elements: {
      wall: { storeys: [st('str:stone', 0.5, 'brick'), st('str:stone', 0.52, 'brick')] },
      roof: { form: 'hip', pitch: 30, eave: 0.3, group: 'str:slate', value: 0.36 },
      lights: { w: 1, h: 1.8, bay: 2.6, sill: 0.7, frame: 0.06, glazing: 'sash', trim: 'str:paint', trimValue: 0.95 },
      door: { w: 1.1, h: 2.2, leaf: 'panels', surround: 'pilasters', fanlight: 'arch', steps: 2 },
      socle: { group: 'str:plaster', value: 0.86 }, sills: { group: 'str:plaster', value: 0.9 }, lintels: { group: 'str:plaster', value: 0.9 },
      cornice: { kind: 'cornice', h: 0.3, proud: 0.2, group: 'str:plaster', value: 0.9 },
      quoins: null, frame: null, shutters: null, pickets: { form: 'rail' },
    }, compose: { mass: { w: 7, d: 9 }, annex: null } },
    materials: { stone: 'hand-brick', plaster: 'limewash', roof: 'slate', plinth: 'ashlar', road: 'setts', walk: 'flags', punched: 'hand-brick', pier: 'ashlar', banded: 'lime-render' },
    palette: { paint: '#f1eee6' },
    city: { grain: 'london' },
  },
  'adobe-pueblo': {
    read: 'an adobe pueblo: earth-plastered mud brick stepped back storey by storey under flat roofs, small deep lights under timber lintels, an earth lane',
    class: 'ancient',
    language: { from: 'timber-hall', read: 'stepped adobe under flat roofs, small lights under timber lintels', elements: {
      wall: { storeys: [st('str:plaster', 0.68), st('str:plaster', 0.7)] },
      roof: { kind: 'cap', form: 'flat', eave: 0.3, group: 'str:plaster', value: 0.64 },
      lights: { w: 0.7, h: 0.8, bay: 3, sill: 1, frame: 0.12, glazing: 'casement', trim: 'str:timber', trimValue: 0.3 }, door: { w: 0.9, h: 2, leaf: 'boards', surround: 'frame' },
      lintels: { group: 'str:timber', value: 0.3 },
      socle: null, sills: null, quoins: null, stack: null, frame: null, shutters: null, pickets: null,
      road: { paving: 'earth' }, footway: { form: 'flush', w: 1.4 }, yards: { form: 'rendered' },
    }, compose: { mass: { w: 8, d: 7 }, tiers: { shrink: 0.72, every: true }, annex: null } },
    materials: { plaster: 'adobe', timber: 'boards', plinth: 'adobe', road: 'earth', walk: 'earth', punched: 'adobe', pier: 'adobe', banded: 'adobe' },
    city: { grain: 'latin-american' },
  },
  'nordic-harbour': {
    read: 'a Nordic timber harbour: board-clad houses painted red over rubble plinths, white trim at the lights, steep dark tiled gables, a boardwalk',
    class: 'ancient',
    language: { from: 'timber-hall', elements: {
      wall: { storeys: [st('str:timber', 0.5, 'boards'), st('str:timber', 0.52, 'boards')] },
      roof: { pitch: 45, eave: 0.5, value: 0.3 }, lights: { w: 0.9, h: 1.3, frame: 0.08, glazing: 'casement', trim: 'str:paint', trimValue: 0.92 },
      door: { leaf: 'panels', surround: 'frame', steps: 1 },
      lintels: { group: 'str:paint', value: 0.92 }, sills: { group: 'str:paint', value: 0.92 }, socle: { h: 0.6 },
      quoins: null, frame: null, shutters: null, footway: { form: 'boards' }, pickets: { form: 'paling' },
    } },
    materials: { timber: 'boards', stone: 'rubble', plinth: 'rubble', roof: 'clay-tile', road: 'setts', walk: 'flags', punched: 'lime-render', pier: 'ashlar', banded: 'boards' },
    palette: { timber: '#8e2f25', roof: '#3a3532', paint: '#ece7dc' },
    city: { grain: 'london' },
  },
  'moorish-medina': {
    read: 'a Moorish medina: lime-plastered walls under flat roofs, round-headed lights screened in star-pattern lattice and doors with keystones, a tiled dado and a band at each storey',
    class: 'ancient',
    language: { from: 'timber-hall', read: 'plastered courtyard houses under flat roofs, round-headed lights, a tiled dado', elements: {
      wall: { storeys: [st('str:plaster', 0.84), st('str:plaster', 0.86)] },
      roof: { kind: 'cap', form: 'flat', eave: 0.25, group: 'str:plaster', value: 0.82 },
      lights: { form: 'arch', w: 0.8, h: 1.5, bay: 3.2, frame: 0.14, glazing: 'arabesque', trim: 'str:timber', trimValue: 0.35 },
      door: { form: 'arch', w: 1.2, h: 2.5, leaf: 'boards', surround: 'frame' },
      lintels: { form: 'key', group: 'str:stone', value: 0.75 }, bands: { kind: 'band', w: 0.22, group: 'str:paint', value: 0.5 },
      socle: { h: 0.7, group: 'str:paint', value: 0.45 },
      sills: null, quoins: null, stack: null, frame: null, shutters: null, pickets: null,
      road: { paving: 'flags' }, footway: { form: 'flush', w: 1.2 }, yards: { form: 'rendered' },
    } },
    materials: { plaster: 'limewash', stone: 'ashlar', road: 'flags', walk: 'flags', punched: 'limewash', pier: 'ashlar', banded: 'limewash' },
    palette: { plaster: '#e2cfae', paint: '#2d6e70' },
    city: { grain: 'mediterranean' },
  },
  'gothic-parish': {
    read: 'a Gothic parish: coursed stone under steep slate, tall round-headed lights of stained glass in stone surrounds, keystones, a deep socle',
    class: 'ancient',
    language: { from: 'timber-hall', read: 'coursed stone under steep slate, tall stained-glass lights', elements: {
      wall: { storeys: [st('str:stone', 0.6, 'coursed'), st('str:stone', 0.62, 'coursed')] },
      roof: { pitch: 58, eave: 0.35, group: 'str:slate', value: 0.3 },
      lights: { form: 'arch', w: 0.9, h: 2, bay: 3.2, sill: 0.9, frame: 0.12, glazing: 'stained', trim: 'str:stone', trimValue: 0.7 },
      door: { form: 'arch', w: 1.3, h: 2.5, leaf: 'boards', surround: 'frame', steps: 2 },
      lintels: { form: 'key', group: 'str:stone', value: 0.7 }, socle: { h: 0.9, value: 0.5 },
      sills: null, quoins: null, stack: null, frame: null, shutters: null, pickets: null,
      road: { paving: 'setts' },
    } },
    materials: { stone: 'rubble', plinth: 'ashlar', roof: 'slate', road: 'setts', walk: 'flags', punched: 'ashlar', pier: 'ashlar', banded: 'ashlar' },
    palette: { stone: '#b9b2a4', paint: '#7a2f3a' },
    city: { grain: 'london' },
  },
  'beaux-arts': {
    read: 'Beaux-Arts boulevards: sawn stone in courses, tall round-headed lights with keystones, a band at each storey, a deep cornice, steep slate roofs',
    class: 'modern',
    language: { from: 'timber-hall', elements: {
      wall: { storeys: [st('str:stone', 0.72, 'ashlar'), st('str:stone', 0.76, 'ashlar')] },
      roof: { form: 'hip', pitch: 55, eave: 0.3, group: 'str:slate', value: 0.34 },
      lights: { form: 'arch', w: 1.2, h: 2, bay: 3.2, sill: 0.7, frame: 0.1, glazing: 'sash', trim: 'str:stone', trimValue: 0.82 },
      door: { form: 'rect', w: 1.4, h: 2.3, leaf: 'glazed', surround: 'pilasters', fanlight: 'rect', steps: 3 },
      cornice: { kind: 'cornice', h: 0.42, proud: 0.28, group: 'str:stone', value: 0.82 }, bands: { kind: 'band', w: 0.2, group: 'str:stone', value: 0.8 },
      lintels: { form: 'key', group: 'str:stone', value: 0.82 }, socle: { h: 0.8, value: 0.56 },
      frame: null, shutters: null, pickets: { form: 'rail' }, road: { paving: 'flags' },
    } },
    materials: { stone: 'sawn-stone', plinth: 'sawn-stone', roof: 'slate', punched: 'sawn-stone', pier: 'sawn-stone', banded: 'sawn-stone', road: 'asphalt', walk: 'pavement' },
    palette: { stone: '#d8ccb4' },
    city: { grain: 'paris', facade: { roof: { form: 'mansard' } } },
  },
  'art-deco': {
    read: 'Art Deco: smooth pale masses stepping back under flat roofs, piers running up between leaded sunburst lights, a crowning finial, dark bands',
    class: 'modern',
    language: { from: 'timber-hall', read: 'a stepped pale mass, piers between the lights, a finial', elements: {
      wall: { storeys: [st('str:stone', 0.74), st('str:stone', 0.78)] },
      roof: { kind: 'cap', form: 'flat', eave: 0.2, group: 'str:stone', value: 0.7 },
      lights: { w: 1, h: 1.8, bay: 2.8, frame: 0.05, glazing: 'ornamental', trim: 'str:paint', trimValue: 0.25 },
      door: { w: 1.4, h: 2.4, leaf: 'glazed', surround: 'frame', steps: 1 },
      ribs: { kind: 'rib', count: 4, w: 0.22, share: 1, group: 'str:stone', value: 0.86 },
      finial: { kind: 'point', count: 1, len: 0.25, base: 0.3, group: 'str:stone', value: 0.86 },
      bands: { kind: 'band', w: 0.16, group: 'str:paint', value: 0.4 }, socle: { h: 0.9, value: 0.4 },
      sills: null, lintels: null, quoins: null, stack: null, frame: null, shutters: null, pickets: null,
    }, compose: { mass: { w: 9, d: 9 }, tiers: { shrink: 0.82, every: true }, annex: null } },
    materials: { stone: 'stucco', plinth: 'sawn-stone', punched: 'stucco', pier: 'precast', banded: 'precast', road: 'asphalt', walk: 'pavement' },
    palette: { stone: '#e3d8c4', paint: '#2b4a52' },
    city: { grain: 'new-york', skin: { stoneRhythm: ['pier', 'banded'] } },
  },
  brutalist: {
    read: 'Brutalist: board-formed concrete in heavy flat-roofed masses, deep ribbon lights between fins, a massive fascia',
    class: 'modern',
    language: { from: 'timber-hall', read: 'a concrete mass, fins between deep lights, a heavy fascia', elements: {
      wall: { storeys: [st('str:stone', 0.56, 'panels'), st('str:stone', 0.58, 'panels')] },
      roof: { kind: 'cap', form: 'flat', eave: 0.6, group: 'str:stone', value: 0.5 },
      lights: { w: 1.4, h: 1.1, bay: 3.4, sill: 1, frame: 0.2, glazing: 'plate', trim: 'str:stone', trimValue: 0.5 },
      door: { w: 1.4, h: 2.2, leaf: 'glazed', surround: 'hood', steps: 1 },
      cornice: { kind: 'cornice', h: 0.45, proud: 0.3, group: 'str:stone', value: 0.6 },
      ribs: { kind: 'rib', count: 6, w: 0.3, share: 1, group: 'str:stone', value: 0.5 }, socle: { h: 0.9, value: 0.45 },
      sills: null, lintels: null, quoins: null, stack: null, frame: null, shutters: null, pickets: null,
      road: { paving: 'flags' }, footway: { paving: 'slabs' }, yards: { form: 'coursed' },
    }, compose: { mass: { w: 11, d: 9 } } },
    materials: { stone: 'concrete', plinth: 'concrete', punched: 'concrete', pier: 'concrete', banded: 'precast', road: 'asphalt', walk: 'pavement' },
    city: { grain: 'london', skin: { stoneRhythm: ['banded', 'pier', 'grid'], mix: { glass: [0, 0.1, 0] }, towerGlass: 0.1 } },
  },
  // (a geotown's pattern of the same name builds its houses in it: geotown/pattern.js)
  'bay-and-gable': {
    read: 'a Victorian and Edwardian streetcar suburb: red brick in two storeys over a stone socle, a steep slate gable to the street, tall sash lights on stone sills under stone lintels, a panelled door up two steps under its transom',
    class: 'modern',
    language: { from: 'timber-hall', read: 'a narrow brick house end-on to its street under a steep gable', elements: {
      wall: { storeys: [st('str:stone', 0.48, 'brick'), st('str:stone', 0.5, 'brick')] },
      roof: { form: 'gable', pitch: 52, eave: 0.4, group: 'str:slate', value: 0.32 },
      lights: { w: 0.95, h: 1.9, bay: 2.5, sill: 0.75, frame: 0.07, glazing: 'sash', trim: 'str:paint', trimValue: 0.92 },
      door: { w: 1, h: 2.3, leaf: 'panels', surround: 'frame', fanlight: 'rect', steps: 2 },
      socle: { h: 0.7, group: 'str:plaster', value: 0.66 }, sills: { group: 'str:plaster', value: 0.86 }, lintels: { group: 'str:plaster', value: 0.86 },
      quoins: null, frame: null, shutters: null, cornice: null, pickets: null,
    }, compose: { mass: { w: 9, d: 14 }, annex: null } },
    materials: { stone: 'wire-brick', plaster: 'sawn-stone', roof: 'slate', plinth: 'sawn-stone', punched: 'wire-brick', pier: 'sawn-stone', banded: 'stucco', road: 'asphalt', walk: 'pavement' },
    palette: { paint: '#efe8da' },
    city: { grain: 'north-american' },
  },
  // (a geotown's main street and its walk-ups: geotown/pattern.js rows)
  'main-street': {
    read: 'a Victorian main street: brick shops in a row, two and three storeys, tall sash lights over the shopfronts, a bracketed cornice before a flat roof',
    class: 'modern',
    language: { from: 'timber-hall', read: 'a brick shop built to its walk, a cornice over a flat roof', elements: {
      wall: { storeys: [st('str:stone', 0.5, 'brick'), st('str:stone', 0.52, 'brick')] },
      roof: { kind: 'cap', form: 'flat', eave: 0.2, group: 'str:stone', value: 0.36 },
      lights: { w: 0.95, h: 1.9, bay: 2.4, sill: 0.8, frame: 0.07, glazing: 'sash', trim: 'str:paint', trimValue: 0.9 },
      door: { w: 1.1, h: 2.4, leaf: 'glazed', surround: 'frame', fanlight: 'rect', steps: 0 },
      cornice: { kind: 'cornice', h: 0.45, proud: 0.3, group: 'str:paint', value: 0.86 },
      socle: { h: 0.35, value: 0.45 }, sills: { group: 'str:plaster', value: 0.86 }, lintels: { group: 'str:plaster', value: 0.86 },
      quoins: null, stack: null, frame: null, shutters: null, pickets: null,
    }, compose: { mass: { w: 8, d: 16 }, annex: null } },
    materials: { stone: 'wire-brick', plaster: 'sawn-stone', plinth: 'sawn-stone', punched: 'wire-brick', pier: 'sawn-stone', banded: 'stucco', road: 'asphalt', walk: 'pavement' },
    palette: { paint: '#e9e1cf' },
    city: { grain: 'north-american' },
  },
  'walk-up': {
    read: 'a brick walk-up of the twenties: four storeys of paired lights between stone bands, a flat roof behind a deep cornice, a glazed door under a hood',
    class: 'modern',
    language: { from: 'timber-hall', read: 'a long brick block, banded at each storey, a cornice over a flat roof', elements: {
      wall: { storeys: [st('str:stone', 0.55, 'brick'), st('str:stone', 0.57, 'brick')] },
      roof: { kind: 'cap', form: 'flat', eave: 0.2, group: 'str:stone', value: 0.36 },
      lights: { w: 1.1, h: 1.6, bay: 2.8, sill: 0.85, frame: 0.06, glazing: 'casement', trim: 'str:paint', trimValue: 0.88 },
      door: { w: 1.4, h: 2.4, leaf: 'glazed', surround: 'hood', fanlight: 'rect', steps: 1 },
      bands: { kind: 'band', w: 0.18, group: 'str:plaster', value: 0.85 },
      cornice: { kind: 'cornice', h: 0.45, proud: 0.3, group: 'str:plaster', value: 0.85 },
      socle: { h: 0.6, value: 0.45 }, sills: { group: 'str:plaster', value: 0.86 }, lintels: { group: 'str:plaster', value: 0.86 },
      quoins: null, stack: null, frame: null, shutters: null, pickets: null,
    }, compose: { mass: { w: 26, d: 14 }, annex: null } },
    materials: { stone: 'wire-brick', plaster: 'sawn-stone', plinth: 'sawn-stone', punched: 'wire-brick', pier: 'sawn-stone', banded: 'stucco', road: 'asphalt', walk: 'pavement' },
    palette: { stone: '#b9875e', paint: '#e6decb' },
    city: { grain: 'north-american' },
  },
});
export const STYLE_IDS = Object.freeze(Object.keys(STYLE_STARTERS));

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const KEYS = ['from', 'read', 'class', 'language', 'materials', 'palette', 'city'];
// a language's changes over another's: elements by id (written whole with a kind: replaced; without: changed; null:
// dropped), the composition's parts merged (null drops one), the rest replaced
function mergeLanguage(base, L) {
  if (typeof L === 'string' || !isObj(L) || L.from !== undefined || (L.elements && L.compose?.mass?.kind)) return L;
  if (typeof base === 'string') return { from: base, ...L };
  if (!isObj(base)) return L;
  // (a change over a change: its nulls kept, so they still drop the anchor's own)
  const elements = { ...(base.elements ?? {}) }, compose = { ...(base.compose ?? {}) };
  for (const [id, el] of Object.entries(L.elements ?? {})) elements[id] = isObj(el) && el.kind === undefined && isObj(elements[id]) ? { ...elements[id], ...el } : el;
  for (const [k, v] of Object.entries(L.compose ?? {})) compose[k] = isObj(v) && isObj(compose[k]) ? { ...compose[k], ...v } : v;
  return { ...base, ...L, elements, ...(Object.keys(compose).length ? { compose } : {}) };
}
function mergeElement(into, id, el) {
  if (el === null) delete into[id];
  else into[id] = isObj(el) && el.kind === undefined && into[id] ? { ...into[id], ...el } : el;
}
function mergeCompose(base, C) {
  if (!C) return base;
  const out = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(C)) {
    if (v === null) delete out[k];
    else out[k] = isObj(v) && isObj(out[k]) ? { ...out[k], ...v } : v;
  }
  return out;
}
/** A language as written → { id, doc } (doc the anchor's elements document, composed and checked), id an anchor's id or null. */
function languageOf(L, label, at) {
  if (typeof L === 'string') {
    if (!ANCHOR_IDS.includes(L)) no(`${at} '${L}' is not an anchor (${ANCHOR_IDS.join(', ')}); or write its elements, or { from: <anchor>, elements: { <id>: element | null } }`);
    return { id: L, doc: ELEMENT_SETS[L] };
  }
  if (!isObj(L)) no(`${at} is an anchor's id, its elements { elements, compose }, or { from: <anchor>, elements: { <id>: element | null } }`);
  for (const k of Object.keys(L)) if (!['from', 'read', 'storeyH', 'elements', 'compose'].includes(k)) no(`${at}.${k} is not a language's (from, read, storeyH, elements, compose)`);
  if (L.elements !== undefined && !isObj(L.elements)) no(`${at}.elements is { <id>: element | null }`);
  let doc;
  if (L.from !== undefined) {
    const B = typeof L.from === 'string' ? ELEMENT_SETS[L.from] : null;
    if (!B) no(`${at}.from is an anchor (${ANCHOR_IDS.join(', ')})`);
    const elements = { ...B.elements };
    for (const [id, el] of Object.entries(L.elements ?? {})) mergeElement(elements, id, el);
    doc = { read: L.read ?? B.read, storeyH: L.storeyH ?? B.storeyH, elements, compose: mergeCompose(B.compose, L.compose) };
  } else doc = { read: L.read ?? `${label}'s language`, storeyH: L.storeyH ?? 2.9, elements: L.elements, compose: L.compose };
  try { composeAnchor(doc); } catch (e) { no(`${at}: ${e.message}`); }
  return { id: null, doc: { id: label, ...doc } };
}
function wordOrNo(w, surface, at) {
  const on = SURFACES[surface], M = MATERIAL_WORDS[w];
  if (!M || M.on !== on) no(`${at} is a ${on} word (${wordsFor(on).join(', ')})${M ? `: '${w}' is a ${M.on}'s` : ''}`);
  return w;
}
// a city's changes deep over its grammar: objects merge, lists replace
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a?.[k]) ? deepMerge(a[k], v) : v;
  return out;
}

/** A style (a starter's id, a document, or { from: <starter>, …changes }) → resolved, or refused saying what is allowed. */
export function readStyle(spec, at = 'style') {
  let S = spec, id = null;
  if (typeof spec === 'string') {
    if (!STYLE_STARTERS[spec]) no(`${at} '${spec}' is not a starter (${STYLE_IDS.join(', ')}); or write one { read, class, language, materials, palette?, city? }`);
    S = STYLE_STARTERS[spec]; id = spec;
  }
  if (!isObj(S)) no(`${at} is a starter (${STYLE_IDS.join(', ')}), { from: <starter>, …changes }, or { read, class, language, materials, palette?, city? }`);
  for (const k of Object.keys(S)) if (!KEYS.includes(k)) no(`${at}.${k} is not a style's (${KEYS.join(', ')})`);
  if (S.from !== undefined) {
    const B = STYLE_STARTERS[S.from];
    if (!B) no(`${at}.from is a starter (${STYLE_IDS.join(', ')})`);
    const M = { ...B.materials }, P = { ...(B.palette ?? {}) };
    for (const [k, v] of Object.entries(S.materials ?? {})) { if (v === null) delete M[k]; else M[k] = v; }
    for (const [k, v] of Object.entries(S.palette ?? {})) { if (v === null) delete P[k]; else P[k] = v; }
    S = { read: S.read ?? B.read, class: S.class ?? B.class, language: S.language === undefined ? B.language : mergeLanguage(B.language, S.language),
      materials: M, palette: P, city: S.city === undefined ? B.city : isObj(S.city) && isObj(B.city) ? deepMerge(B.city, S.city) : S.city };
    id = `${spec.from}*`;
  }
  if (typeof S.read !== 'string' || !S.read.length || S.read.length > 240) no(`${at}.read is what the style reads as, in words (up to 240 characters)`);
  const cls = S.class ?? 'ancient';
  if (!STYLE_CLASSES.includes(cls)) no(`${at}.class is ${STYLE_CLASSES.map((c) => `'${c}'`).join(' or ')}`);
  if (S.language === undefined) no(`${at}.language is the builders' language: an anchor (${ANCHOR_IDS.join(', ')}), its elements, or { from, elements }`);
  const label = id ?? 'style';
  const language = languageOf(S.language, label, `${at}.language`);
  // the words, a surface each
  const materials = {};
  if (S.materials !== undefined && !isObj(S.materials)) no(`${at}.materials is { <surface>: word } (surfaces: ${Object.keys(SURFACES).filter((s) => SURFACES[s]).join(', ')})`);
  for (const [s, w] of Object.entries(S.materials ?? {})) {
    if (!(s in SURFACES) || !SURFACES[s]) no(`${at}.materials.${s} is not a surface a word dresses (${Object.keys(SURFACES).filter((k) => SURFACES[k]).join(', ')})`);
    if (CITY_WALLS.includes(s) && Array.isArray(w)) { if (!w.length || w.length > 4) no(`${at}.materials.${s} is a word or a list of one to four`); materials[s] = w.map((x, i) => wordOrNo(x, s, `${at}.materials.${s}[${i}]`)); }
    else materials[s] = wordOrNo(w, s, `${at}.materials.${s}`);
  }
  const palette = {};
  if (S.palette !== undefined && !isObj(S.palette)) no(`${at}.palette is { <surface>: '#rrggbb' }`);
  for (const [s, c] of Object.entries(S.palette ?? {})) {
    if (!(s in SURFACES)) no(`${at}.palette.${s} is not a surface (${Object.keys(SURFACES).join(', ')})`);
    if (typeof c !== 'string' || !HEX.test(c)) no(`${at}.palette.${s} is '#rrggbb'`);
    palette[s] = c.toLowerCase();
  }
  let city = null;
  if (S.city !== undefined) {
    if (!isObj(S.city)) no(`${at}.city is { grain?, …a city grammar's changes }`);
    const { grain, ...changes } = S.city;
    if (grain !== undefined && !GRAMMAR_IDS.includes(grain)) no(`${at}.city.grain is a city grammar (${GRAMMAR_IDS.join(', ')})`);
    if ('from' in changes) no(`${at}.city takes its grammar's base as grain`);
    try { resolveGrammar({ from: grain ?? 'london', ...changes }, `${at}.city`); } catch (e) { no(e.message.replace(/^[^:]*grammar[^:]*: /, '')); }
    city = { ...(grain !== undefined ? { grain } : {}), ...changes };
  }
  return Object.freeze({ id: id ?? null, read: S.read, class: cls, language, materials, palette, city });
}

// ── the laws ────────────────────────────────────────────────────────────────────────────────────────────────────────
const COVER_MIN = { thatch: 45, 'clay-tile': 30, shingle: 26, slate: 25 };
const PITCHED = new Set(['gable', 'hip', 'pyramid']);
// the town surfaces a language builds: its walls', its cap's and its ornaments' groups (a plinth under every house)
function surfacesBuilt(doc) {
  const out = new Set(['plinth']), E = doc.elements;
  const add = (g) => { if (typeof g !== 'string') return; const s = g.replace(/^str:/, ''); out.add(['tile', 'slate', 'shingle', 'thatch'].includes(s) ? 'roof' : s); };
  for (const el of Object.values(E)) { if (el.kind === 'wall') for (const s of el.storeys ?? []) add(s.group); else if (el.kind === 'cap') { if (el.form !== 'none') add(el.group); } else add(el.group); }
  // (a built light's frame and bars, and a built door's surround, are painted in the light's trim: era/out-openings.js)
  const light = Object.values(E).find((e) => e.kind === 'light'), door = Object.values(E).find((e) => e.kind === 'door');
  if (light && (light.frame !== undefined || light.glazing !== undefined || (door && (door.surround || door.fanlight)))) add(light.trim ?? 'str:paint');
  // (a stained light's panes are the paint's and the lens's: era/out-openings.js)
  if (light?.glazing === 'stained') add('str:paint');
  return out;
}
/** What advises on a style, never refusing: each { law, ok, value }. */
export function styleLaws(S) {
  const E = S.language.doc.elements, els = Object.values(E), cap = els.find((e) => e.kind === 'cap'), wall = els.find((e) => e.kind === 'wall'), light = els.find((e) => e.kind === 'light');
  const words = Object.entries(S.materials).flatMap(([s, w]) => (Array.isArray(w) ? w : [w]).map((x) => [s, x]));
  const off = words.filter(([, w]) => MATERIAL_WORDS[w].class !== 'either' && MATERIAL_WORDS[w].class !== S.class).map(([s, w]) => `${s}: ${w} (${MATERIAL_WORDS[w].class})`);
  const laws = [{ law: 'class', ok: !off.length, value: off.length ? off : S.class }];
  // the cover against the pitch: a cover that sheds water needs its fall, and a flat cap carries none
  const cover = S.materials.roof;
  if (cover) {
    const pitched = cap && PITCHED.has(cap.form), min = COVER_MIN[cover] ?? 0;
    laws.push({ law: 'cover-pitch', ok: !!pitched && (cap.pitch ?? 0) >= min, value: { cover, cap: cap?.form ?? 'none', pitch: cap?.pitch ?? null, min } });
  }
  // the value order: the walls over the roof over the openings (a flat roof is not seen from the street)
  const wallV = Math.min(...(wall?.storeys ?? []).map((s) => s.value)), roofV = cap && PITCHED.has(cap.form) ? cap.value : null, openV = light?.value ?? 0;
  laws.push({ law: 'value-order', ok: wallV > openV && (roofV === null || (wallV > roofV && roofV > openV)), value: { wall: wallV, roof: roofV, opening: openV } });
  // a word or a colour for a surface the language never builds says nothing
  const built = surfacesBuilt(S.language.doc), town = ['plaster', 'stone', 'timber', 'shell', 'paint', 'plinth', 'roof'];
  const idle = [...new Set([...Object.keys(S.materials), ...Object.keys(S.palette)])].filter((s) => town.includes(s) && !built.has(s));
  laws.push({ law: 'surfaces-built', ok: !idle.length, value: idle.length ? idle : [...built].filter((s) => town.includes(s)).sort() });
  return laws;
}

// ── the town ────────────────────────────────────────────────────────────────────────────────────────────────────────
// a town surface's source groups, and the seeds their tiles are painted at (the cube's own dress's, era/town-dress.js)
const TOWN_GROUPS = { plaster: ['str:plaster'], stone: ['str:stone'], timber: ['str:timber'], shell: ['str:shell'], paint: ['str:paint'], plinth: ['plinth'], roof: ['str:tile', 'str:slate', 'str:shingle', 'str:thatch'], road: ['street:road'], walk: ['street:walk'] };
const TOWN_SEEDS = { 'str:plaster': 23, 'str:stone': 29, plinth: 31, 'str:shell': 37, 'str:timber': 41, 'str:tile': 43, 'str:slate': 47, 'str:shingle': 53, 'str:thatch': 59, 'str:paint': 61, 'street:road': 151, 'street:walk': 141 };
/**
 * A town's dress under a style: each surface the style names, its word's tile (on a gritty cube) and its colour (the
 * palette's, else the word's), over the cube's own dress (`dress`, or null on a quiet cube). An entry is { spec?,
 * metres?, roof?, colour? }: the colour a hue the lit face leans to (town-dress.js leanHue). Null when it says nothing.
 */
export function styleTownDress(S, cube, dress) {
  const X = materialContext(cube), gritty = grittyOf(cube) !== null, out = { ...(dress ?? {}) };
  for (const [surface, groups] of Object.entries(TOWN_GROUPS)) {
    const w = S.materials[surface], colour = S.palette[surface] ?? (w ? MATERIAL_WORDS[w].colour : null);
    if (!w && !colour) continue;
    for (const g of groups) {
      const T = w && gritty ? wordTile(w, X, TOWN_SEEDS[g]) : null, kept = !w && dress?.[g] ? dress[g] : null;
      const e = { ...(T ? { spec: T.spec, metres: T.metres } : kept ? { spec: kept.spec, metres: kept.metres } : {}), ...(surface === 'roof' ? { roof: true } : {}), ...(surface === 'road' || surface === 'walk' ? { floor: true } : {}), ...(colour ? { colour } : {}) };
      if (e.spec || e.colour) out[g] = e; else delete out[g];
    }
  }
  return Object.keys(out).length ? out : null;
}

// ── the city ────────────────────────────────────────────────────────────────────────────────────────────────────────
const capOf = (L) => Object.values((typeof L === 'string' ? ELEMENT_SETS[L] : L).elements ?? {}).find((e) => e.kind === 'cap')?.form;
const ANCIENT_HEIGHT = () => { const { core, edge, sigmaCore, sigmaEdge, cap } = resolveGrammar('paris').height; return { core, edge, sigmaCore, sigmaEdge, cap }; };
/** The city grammar a style builds: its language read at its grain, an ancient class without curtain walls or towers, its roof's
 *  colour on the caps, then its own changes over all of it. */
export function styleGrammar(S, kit, seed = 1, language = S.language.id ?? S.language.doc) {
  const { grain, ...changes } = S.city ?? {};
  let doc = civilizationGrammar(language, kit, seed, grain !== undefined ? { base: grain } : {});
  // (an ancient city: no curtain walls, no towers, no taller than Haussmann's Paris)
  if (S.class === 'ancient') doc = deepMerge(doc, { skin: { mix: { glass: [0, 0, 0] }, towerGlass: 0, stoneRhythm: doc.skin.stoneRhythm.filter((r) => r !== 'curtain') }, height: ANCIENT_HEIGHT(), tower: { p: 0 } });
  // (a flat cap is not a roof the city raises: the civilization's reading caps every capped language)
  if (capOf(language) === 'flat') doc = { ...doc, facade: { ...doc.facade, roof: { p: 0 } } };
  const roof = S.palette.roof ?? (S.materials.roof ? MATERIAL_WORDS[S.materials.roof].colour : null);
  if (roof && doc.facade?.roof?.p > 0) { const c = rgbOf(roof); doc = deepMerge(doc, { facade: { roof: { tints: [roof, hexOf(c.map((v) => v * 1.12)), hexOf(c.map((v) => v * 0.86))] } } }); }
  return deepMerge(doc, changes);
}

/** What a specimen says of its style. */
export function styleReadout(S) {
  return { ...(S.id ? { id: S.id } : {}), read: S.read, class: S.class, language: S.language.id ?? S.language.doc.id, materials: S.materials,
    ...(Object.keys(S.palette).length ? { palette: S.palette } : {}), laws: styleLaws(S) };
}
