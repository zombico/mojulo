/**
 * GEOCUBE — one style for a level's inside and its outside, as data, so the two cannot clash: a gothic night's land
 * is the same stone, the same shade and the same air as its hall. A cube holds the core look and nothing placed:
 *
 *   light     the sixth-gen reference both sides share (`reference`), the moon a night outside takes (`moon`), how
 *             thick the outside's air is against the reference's (`outsideFog`), the inside's `shadows` (the
 *             stage's: torch, sun, cells; the gen-6 upgrades by default), and the outside's `sky` (zenith, horizon,
 *             fog; the reference's dome and fog colour where it names none)
 *   colour    key colours, each a ramp (look-facets.js rampFrom): stone, floor, trim, accent, grass, foliage, water,
 *             and optionally sand; `shade` is the hue every ramp's dark end leans to (degrees, blue by default)
 *   palette   the color theorist's spec (color-theorist/solve.js) the colours are SOLVED from: with a seed, the colours,
 *             the tone's key, the moon and the sky come from the solve (cubeColours), a written colour with a role of
 *             its own is a lock the solve fits the rest round, and the other written keys win. A preset's palette is
 *             its character (GEOCUBE_PALETTES); without a seed (a recipe minted before, or 'auto' not yet stamped)
 *             the cube's own colours stand, as they always did
 *   register  the tone's bands (`steps`, 0 continuous) and its key
 *   contrast  how the light is shaped in the vertex across the whole world (vertex-contrast.js: `'wii'`, the terms, or
 *             absent for none): the sky over, the ground under, the foot of a wall, crease and contact in the shade's
 *             colour, warm lit against cool shade, a slow drift of value. The land hands its crease and ridge to it
 *   surfaces  the patterns of the wall, the floor and the accent (surface-textures.js tile specs)
 *   inside    the bones (a room kit, bare), the specimen room's size, the accent wall
 *   outside   the base (an isekai card), the landform's tiers and island, `land`: the polygon land's rules, and
 *             `relief` (optional): the plain's own ground, a relief card or { from, …changes } (noise/relief.js); and
 *             its TERRAINS: the cube's own outside is one (named by `terrain`, 'default' unless named), `terrains`
 *             the others, each a few changes to it ({ reads?, base?, land?, relief?, colour? }: a shore, a highland). A level
 *             asks for one, or its heartbeat names the one it was made for, and the answer says which it got
 *   why       the principles, one line each, carried into the outside's look card for whatever builds next
 *   era       the look's generation (eras.js; gen-6 by default): its light and surface conventions, at any resolution
 *   target    what the level is drawn for (target.js: resolution, framing, error; 1080p third-person by default): how
 *             many pixels a metre covers, so how dense its cast's rings and its surfaces' texels need to be. A hero lit
 *             by the cube takes its era and its target unless it names its own target
 *
 *   readGeocube(spec)          a preset id, a document, or { from: preset, …changes } → the cube, checked
 *   lowerGeocube(cube, side)   'inside' | 'outside' → a stage manifest
 *   assembleGeocubeScene(m)    the `geocube` world kind: { cube, show: 'room' | 'land' } → its specimen
 *   withGeocube(manifest)      a stage recipe's `geocube`: the cube lowered under the recipe's own keys
 *   pickTerrain(cube, ask, hint)   which terrain a level gets, and from whom: → { name, from, offered, wanted? }
 *   cubeContrast(cube, side)       the cube's `contrast` resolved against its light and colour, as a payload carries it
 *   geocubeContrastOf(manifest)    the resolved contrast of the cube a world manifest is painted by, or null
 */
import { SIXTH_GEN, SIXTH_GEN_REFERENCES, SIXTH_GEN_LOOK_IDS, resolveLook } from './sixth-gen.js';
import { rampFrom, resample } from './look-facets.js';
import { ISEKAI_STYLES } from './isekai.js';
import { SWATCHES } from './style/swatches.js';
import { registerLook } from './style/looks.js';
import { STAGE_KITS, isGroundKit } from './stage.js';
import { tileFamilyOf } from './tile-specs.js';
import { fingerprint } from '../gameworld/review.js';
import { DEFAULT_ERA, eraError } from './eras.js';
import { DEFAULT_TARGET, readTarget } from './target.js';
import { readContrast } from './vertex-contrast.js';
import { readRelief } from '../noise/relief.js';
import { sunDir } from './sun.js';
import { solvePalette, readPaletteSpec } from '../color-theorist/solve.js';
import { cubeColours } from '../color-theorist/adapters.js';
import { oklch, lchOf, hexToRgb, rgbToHex } from '../color-theorist/oklab.js';

const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const ISLE = { geology: true, walk: 'base' };
const STONE = { gen: 'stone-brick', stone: [150, 150, 150], mortar: [88, 88, 88], rows: 6, cols: 4, mortarThick: 0.1, vary: 28, grain: 11, bevel: 0.2, accent: 0.14, accentDark: 40, accentLight: 26, seed: 13 };
const FLAGS = { gen: 'flagstone', stone: [140, 140, 140], mortar: [58, 58, 58], gravel: [96, 96, 96], cells: 5, mortarThick: 0.05, wobble: 2.2, vary: 22, grain: 12, lost: 0.04, cracked: 0.2, seed: 17 };
const ROCK = { gen: 'rock', style: 'cave', base: [170, 170, 170], seed: 1 };
const LAND = { smooth: true, crevice: 0.6, ridge: 0.35, blend: 0.6 };
// the gen-6 shadows: torch shadows, a soft sun edge, surfaces cut to half a metre so a shadow has corners. The
// torch's own soft edge ('soft') costs about four times the bake for what the half-metre cells already blur.
const SHADOWS = { torch: 'hard', sun: 1.5, cells: 0.5 };

/** The cubes to start from. A cube is a starter: copy one with `from` and change what the level needs. */
export const GEOCUBE_PRESETS = Object.freeze({
  'gothic-night': {
    id: 'gothic-night', title: 'Gothic night', reads: 'A cold stone night lit by fire',
    light: { reference: 'gothic-night', moon: { color: '#9fb0e0', elevation: 34, azimuth: 300, gain: 0.8 }, outsideFog: 0.22 },
    colour: { stone: '#5c6272', floor: '#4f4b4a', trim: '#6c707c', accent: '#8a1c1c', grass: '#3d5a4c', foliage: '#2f4a42', water: '#22324a', sand: '#5e5c5a' },
    register: { steps: 0, key: 0.3 },
    surfaces: { wall: STONE, floor: FLAGS, accent: ROCK },
    inside: { bones: 'gothic-stone', size: [12, 12, 6], accentWall: '+y' },
    outside: { base: 'isekai-meadow', tiers: TWO_BASES, island: ISLE, land: LAND },
    why: [
      'Stone is cool blue-grey, never warm: the only warm light is fire.',
      'One accent, a deep red, on one wall inside; outside it lives only in the light.',
      'Shade is a colour, never black: the deepest stop leans blue.',
      'Depth is air: blue-black fog inside, thinner over the water.',
      'Inside, the torches are the key; outside, the moon is.',
    ],
  },
  'island-noon': {
    id: 'island-noon', title: 'Island noon', reads: 'Stucco, terracotta and a hard sun',
    light: { reference: 'island-noon', outsideFog: 1 },
    colour: { stone: '#e2cba0', floor: '#c4875a', trim: '#efe4cc', accent: '#3a80d0', grass: '#7cbf48', foliage: '#4a983a', water: '#3a9cc6', sand: '#e6d3a4' },
    register: { steps: 0, key: 0.55 },
    surfaces: { wall: STONE, floor: FLAGS, accent: ROCK },
    inside: { bones: 'gothic-stone', size: [12, 12, 6], accentWall: '+y' },
    outside: { base: 'isekai-meadow', tiers: TWO_BASES, island: ISLE, land: LAND },
    why: [
      'A hard high sun: what is lit is warm and pale, what is in shade is sky blue.',
      'Stucco and terracotta inside and out; the accent is the sea\'s blue.',
      'Air barely there: you see across the bay.',
      'Saturated, never neon: every colour stays on its ramp.',
    ],
  },
  'jungle-haze': {
    id: 'jungle-haze', title: 'Jungle haze', reads: 'Olive concrete, mud and a soft hazy sun',
    light: { reference: 'jungle-haze', outsideFog: 0.5 },
    colour: { stone: '#767a64', floor: '#5a5242', trim: '#686856', accent: '#8a5f34', grass: '#566c3c', foliage: '#3c5630', water: '#4a5848', sand: '#7a6e56' },
    register: { steps: 0, key: 0.4 },
    surfaces: { wall: STONE, floor: FLAGS, accent: ROCK },
    inside: { bones: 'research-lab', size: [12, 12, 7], accentWall: '+y' },
    outside: { base: 'isekai-bamboo', tiers: TWO_BASES, island: ISLE, land: { ...LAND, crevice: 0.4, ridge: 0.2 } },
    why: [
      'One family of olives and muds: concrete, ground and leaf share it.',
      'The light is soft and filmic through haze; contrast stays low.',
      'Rust is the only accent.',
      'Distance turns grey-green in the air.',
    ],
  },
  'valley-morning': {
    id: 'valley-morning', title: 'Valley morning', reads: 'Limestone, red roofs, a green valley',
    light: { reference: 'island-noon', outsideFog: 1.6 },
    colour: { stone: '#b8aa8c', floor: '#9a7a58', trim: '#e6dcc4', accent: '#b8442c', grass: '#64a83a', foliage: '#3a7a32', water: '#3a8cb8', sand: '#d6c49a', shade: 236 },
    register: { steps: 0, key: 0.5 },
    contrast: 'wii',
    surfaces: { wall: STONE, floor: FLAGS, accent: ROCK },
    inside: { bones: 'gothic-stone', size: [12, 12, 6], accentWall: '+y' },
    outside: { base: 'isekai-meadow', tiers: TWO_BASES, island: ISLE, land: LAND },
    why: [
      'The contrast lives in the vertex: the sky on every top, the ground under every overhang.',
      'A wall is darker at its foot and lighter toward the eaves.',
      'Creases and contacts fall into a blue-violet shade, never black.',
      'The lit side warms toward the sun; the shade side cools.',
      'One accent, the red of the roofs; the valley green carries the rest.',
    ],
  },
});

/**
 * The buildings a cube's world plausibly has, as SEEDS: the language its builders speak (`anchor`, an anchor structure)
 * and the uses that suit the look, each with how it is entered (`'door'`: the scene changes; `'walk'`: walked in as
 * terrain). A recommendation, never a placement: a stage on the cube with `program: { use }` speaks the anchor, and a
 * town or trail draws its uses from the list. Kept beside the presets so a preset's own bytes do not move; a cube
 * document may carry its own `buildings`.
 */
export const GEOCUBE_BUILDINGS = Object.freeze({
  'gothic-night': { anchor: 'tiered', uses: [{ use: 'crypt', enter: 'door' }, { use: 'temple', enter: 'door' }, { use: 'keep', enter: 'door' }, { use: 'guardhouse', enter: 'door' }, { use: 'tower', enter: 'walk' }, { use: 'dwelling', enter: 'door' }] },
  'island-noon': { anchor: 'tiered', uses: [{ use: 'dwelling', enter: 'door' }, { use: 'shop', enter: 'door' }, { use: 'tavern', enter: 'door' }, { use: 'hall', enter: 'walk' }, { use: 'temple', enter: 'door' }] },
  'jungle-haze': { anchor: 'timber-hall', uses: [{ use: 'lab', enter: 'door' }, { use: 'workshop', enter: 'walk' }, { use: 'dwelling', enter: 'door' }, { use: 'temple', enter: 'walk' }] },
  'valley-morning': { anchor: 'tiered', uses: [{ use: 'dwelling', enter: 'door' }, { use: 'shop', enter: 'door' }, { use: 'tavern', enter: 'door' }, { use: 'temple', enter: 'door' }, { use: 'tower', enter: 'walk' }] },
});
/**
 * Each preset's character in the color theorist's terms: what the stamp (color-theorist/stamp.js) writes into a cube on
 * the preset at authoring time, with its seed, so a stored cube carries the spec it is solved from and a change here
 * never moves it. The preset's own hex stays as what an unseeded cube reads, so a recipe minted before keeps its
 * colours. Kept beside the presets so a preset's own bytes do not move.
 */
export const GEOCUBE_PALETTES = Object.freeze({
  'gothic-night': { intent: 'a cold stone night lit by fire', key: 'low', heat: -0.7, weight: 0.6, activity: -0.4, scheme: 'mono-accent', hues: { rock: 255 }, lock: { accent: '#8a1c1c' } },
  'island-noon': { intent: 'stucco, terracotta and a hard sun', key: 'high', heat: 0.6, weight: -0.3, activity: 0.3, scheme: 'complementary', hues: { sky: 232, rock: 72, soil: 38, ground: 118, foliage: 132, accent: '#3a80d0' } },
  'jungle-haze': { intent: 'olive concrete, mud and a soft hazy sun', key: 'mid', heat: 0.15, weight: 0.2, activity: -0.6, scheme: 'analogous', hue: '#767a64', hues: { sky: 120, accent: '#8a5f34' } },
  'valley-morning': { intent: 'limestone, red roofs and a green valley in the morning', key: 'high', heat: 0.35, weight: -0.1, activity: 0.2, scheme: 'complementary', hues: { sky: 225, rock: 52, soil: 36, ground: 112, foliage: 128, accent: '#b8442c' } },
});
// each preset's principles that name its colours: under a solved palette they give way to the palette's own reading
const COLOUR_WHY = Object.freeze({ 'gothic-night': [0, 1, 2, 3], 'island-noon': [0, 1], 'jungle-haze': [0, 2, 3], 'valley-morning': [2, 4] });
// a written colour with a role of its own is a lock the solve fits the rest round; trim, water and sand are kept as written
const LOCK_ROLE = Object.freeze({ stone: 'rock', floor: 'soil', grass: 'ground', foliage: 'foliage', accent: 'accent' });
/** A palette the cube is solved from: a spec with its seed (stamped at authoring time). */
export const seededPalette = (p) => isObj(p) && Number.isInteger(p.seed);

/** A cube's building seeds: its own, else its preset's (a variant reads its preset's), else none. */
export function cubeBuildings(cube) {
  return cube.buildings ?? GEOCUBE_BUILDINGS[cube.id] ?? GEOCUBE_BUILDINGS[String(cube.id).replace(/-variant$/, '')] ?? null;
}

const HEX = /^#[0-9a-f]{6}$/i;
const COLOURS = ['stone', 'floor', 'trim', 'accent', 'grass', 'foliage', 'water'];
const WALLS = ['+x', '-x', '+y', '-y'];
const KEYS = { id: 1, title: 1, reads: 1, era: 1, target: 1, light: 1, colour: 1, register: 1, contrast: 1, surfaces: 1, inside: 1, outside: 1, why: 1, buildings: 1, palette: 1 };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b === undefined ? a : b);
const no = (msg) => { throw new Error(`geocube: ${msg}`); };
// a relief checked where the cube names it: its own words, said as the cube's
const reliefOrNo = (v, at) => { try { readRelief(v); } catch (e) { no(`${at}: ${e.message.replace(/^relief: /, '')}`); } };
const only = (o, keys, at) => { for (const k of Object.keys(o)) if (!keys.includes(k)) no(`${at}.${k} is not a setting (${at}: ${keys.join(', ')})`); };

/** A preset id, a whole document, or { from: preset, …changes } (merged key by key; arrays are replaced) → the cube. */
export function readGeocube(spec) {
  if (typeof spec === 'string') {
    if (!GEOCUBE_PRESETS[spec]) no(`'${spec}' is not a preset (presets: ${Object.keys(GEOCUBE_PRESETS).join(', ')}); or write the cube`);
    return readGeocube({ ...GEOCUBE_PRESETS[spec] });
  }
  if (!isObj(spec)) no('a cube is a preset id or a document { light, colour, register, surfaces, inside, outside, why }');
  if (spec.from !== undefined) {
    const { from, ...rest } = spec;
    if (!GEOCUBE_PRESETS[from]) no(`from: '${from}' is not a preset (presets: ${Object.keys(GEOCUBE_PRESETS).join(', ')})`);
    const base = structuredClone(GEOCUBE_PRESETS[from]);
    // solved: the preset's own colours, tone key, moon colour and colour principles give way to the palette (the
    // stamp writes the preset's character into it, GEOCUBE_PALETTES); what the variant writes still wins
    if (seededPalette(rest.palette)) {
      delete base.colour; delete base.register.key;
      if (base.light.moon) delete base.light.moon.color;
      base.why = base.why.filter((_, i) => !COLOUR_WHY[from]?.includes(i));
    }
    return readGeocube(merge(base, { id: `${from}-variant`, ...rest }));
  }
  only(spec, Object.keys(KEYS), 'cube');
  const c = structuredClone(spec);
  // the palette: a seeded spec solves the colours; 'auto' or an unseeded spec waits for its seed (the stamp's), and the
  // cube's own colours stand until then; false is the cube's own colours
  // (a cube already read carries its palette's `id` beside the spec: its colours are the solve's, read as written)
  const solved = isObj(c.palette) && c.palette.id !== undefined;
  if (c.palette !== undefined && !solved) {
    try { c.palette = readPaletteSpec(c.palette, 'palette'); } catch (e) { no(e.message); }
    if (c.palette === false) delete c.palette;
  }
  const P = !solved && seededPalette(c.palette) ? c.palette : null;
  for (const k of ['light', 'surfaces', 'inside', 'outside', ...(P ? [] : ['colour', 'register', 'why'])]) if (c[k] === undefined) no(`${k} is missing${P ? '' : ['colour', 'register', 'why'].includes(k) ? ' (or a seeded palette to solve it from)' : ''}`);
  if (P) { c.colour ??= {}; c.register ??= { steps: 0 }; c.why ??= []; }
  if (typeof c.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(c.id)) no('id is a lowercase slug');
  c.title ??= c.id; c.reads ??= ''; c.era ??= DEFAULT_ERA; c.target ??= { ...DEFAULT_TARGET };
  if (eraError(c.era)) no(eraError(c.era));
  try { readTarget(c.target); } catch (e) { no(e.message); }
  // light
  only(c.light, ['reference', 'moon', 'outsideFog', 'shadows', 'sky'], 'light');
  c.light.shadows ??= SHADOWS;
  if (!SIXTH_GEN_LOOK_IDS.includes(c.light.reference)) no(`light.reference '${c.light.reference}' is not one (${SIXTH_GEN_LOOK_IDS.join(', ')})`);
  const ref = SIXTH_GEN_REFERENCES[resolveLook(c.light.reference)];
  if (P) solveInto(c, P, ref);
  if (c.light.sky !== undefined) {
    if (!isObj(c.light.sky)) no('light.sky is { zenith, horizon, fog? }: the outside\'s sky, #rrggbb each');
    only(c.light.sky, ['zenith', 'horizon', 'fog'], 'light.sky');
    for (const k of ['zenith', 'horizon']) if (!HEX.test(c.light.sky[k] ?? '')) no(`light.sky.${k} is a #rrggbb colour`);
    if (c.light.sky.fog !== undefined && !HEX.test(c.light.sky.fog)) no('light.sky.fog is a #rrggbb colour');
  }
  if (!ref.light.key && !c.light.moon) no(`light.moon is needed: '${c.light.reference}' has no sun, so the outside is lit by a moon { color, elevation, azimuth, gain }`);
  if (c.light.moon) {
    only(c.light.moon, ['color', 'elevation', 'azimuth', 'gain'], 'light.moon');
    if (!HEX.test(c.light.moon.color ?? '')) no('light.moon.color is a #rrggbb colour');
    for (const k of ['elevation', 'azimuth', 'gain']) if (!Number.isFinite(c.light.moon[k])) no(`light.moon.${k} is a number`);
  }
  c.light.outsideFog ??= 1;
  if (!(c.light.outsideFog > 0 && c.light.outsideFog <= 4)) no('light.outsideFog is the outside\'s fog against the reference\'s, above 0 and at most 4');
  // colour
  only(c.colour, [...COLOURS, 'sand', 'shade'], 'colour');
  for (const k of COLOURS) if (!HEX.test(c.colour[k] ?? '')) no(`colour.${k} is a #rrggbb colour`);
  if (c.colour.sand !== undefined && !HEX.test(c.colour.sand)) no('colour.sand is a #rrggbb colour');
  if (c.colour.shade !== undefined && !(Number.isFinite(c.colour.shade) && c.colour.shade >= 0 && c.colour.shade < 360)) no('colour.shade is a hue in degrees, 0..359');
  // register
  only(c.register, ['steps', 'key'], 'register');
  if (!(Number.isInteger(c.register.steps) && c.register.steps >= 0 && c.register.steps <= 8)) no('register.steps is the tone\'s bands, 0 (continuous) to 8');
  if (!(c.register.key > 0 && c.register.key < 1)) no('register.key is the median value the tone brings the light to, 0..1');
  // contrast (optional): the shaping in the vertex; absent or false ⇒ none
  if (c.contrast !== undefined) { try { readContrast(c.contrast); } catch (e) { no(e.message); } }
  // surfaces
  only(c.surfaces, ['wall', 'floor', 'accent'], 'surfaces');
  for (const k of ['wall', 'floor', 'accent']) tileFamilyOf(c.surfaces[k], `geocube surfaces.${k}`);
  // inside
  only(c.inside, ['bones', 'size', 'accentWall'], 'inside');
  if (!STAGE_KITS[c.inside.bones] || isGroundKit(c.inside.bones)) no(`inside.bones '${c.inside.bones}' is not a room kit (${Object.keys(STAGE_KITS).filter((k) => !isGroundKit(k)).join(', ')})`);
  c.inside.size ??= [12, 12, 6]; c.inside.accentWall ??= '+y';
  if (!(Array.isArray(c.inside.size) && c.inside.size.length === 3 && c.inside.size.every((v) => v >= 3 && v <= 40))) no('inside.size is [w, d, h] metres, each 3..40');
  if (!WALLS.includes(c.inside.accentWall)) no(`inside.accentWall is one of ${WALLS.join(', ')}`);
  // outside
  only(c.outside, ['base', 'tiers', 'island', 'land', 'relief', 'terrain', 'terrains'], 'outside');
  if (c.outside.relief !== undefined) reliefOrNo(c.outside.relief, 'outside.relief');
  if (c.outside.terrain !== undefined && !(typeof c.outside.terrain === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(c.outside.terrain))) no('outside.terrain is the name of the cube\'s own terrain, a lowercase slug');
  if (c.outside.terrains !== undefined) {
    if (!isObj(c.outside.terrains)) no('outside.terrains is { <name>: { reads?, base?, land?, relief?, colour? } }: the cube\'s other terrains');
    for (const [name, t] of Object.entries(c.outside.terrains)) {
      const at = `outside.terrains.${name}`;
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(name) || name === (c.outside.terrain ?? 'default')) no(`${at}: a terrain's name is a lowercase slug, not the cube's own ('${c.outside.terrain ?? 'default'}')`);
      if (!isObj(t)) no(`${at} is { reads?, base?, land?, relief?, colour? }`);
      only(t, ['reads', 'base', 'land', 'relief', 'colour'], at);
      if (t.relief !== undefined && t.relief !== false) reliefOrNo(t.relief, `${at}.relief`);
      if (t.base !== undefined && (!ISEKAI_STYLES[t.base] || !SWATCHES[t.base])) no(`${at}.base '${t.base}' is not an isekai card (${Object.keys(ISEKAI_STYLES).filter((k) => SWATCHES[k]).join(', ')})`);
      if (t.land !== undefined && t.land !== false) only(t.land, ['smooth', 'crevice', 'ridge', 'blend', 'sun'], `${at}.land`);
      if (t.colour !== undefined) {
        only(t.colour, ['stone', 'floor', 'grass', 'foliage', 'water', 'sand'], `${at}.colour`);
        for (const [k, v] of Object.entries(t.colour)) if (!HEX.test(v)) no(`${at}.colour.${k} is a #rrggbb colour`);
      }
    }
  }
  if (!ISEKAI_STYLES[c.outside.base] || !SWATCHES[c.outside.base]) no(`outside.base '${c.outside.base}' is not an isekai card (${Object.keys(ISEKAI_STYLES).filter((k) => SWATCHES[k]).join(', ')})`);
  c.outside.tiers ??= TWO_BASES; c.outside.island ??= ISLE; c.outside.land ??= LAND;
  if (!Array.isArray(c.outside.tiers) || !c.outside.tiers.length) no('outside.tiers is the landform\'s tiers (local meru), one or more');
  if (c.outside.land !== false) only(c.outside.land, ['smooth', 'crevice', 'ridge', 'blend', 'sun'], 'outside.land');
  // buildings (optional): the seeds a world on this cube builds from
  if (c.buildings !== undefined) {
    if (!isObj(c.buildings)) no('buildings is { anchor?, uses: [{ use, enter }] }');
    only(c.buildings, ['anchor', 'uses'], 'buildings');
    if (!Array.isArray(c.buildings.uses) || !c.buildings.uses.every((u) => isObj(u) && typeof u.use === 'string' && ['door', 'walk', false].includes(u.enter ?? 'door'))) no("buildings.uses is [{ use, enter: 'door' | 'walk' | false }]");
  }
  // why
  if (!Array.isArray(c.why) || !c.why.length || !c.why.every((w) => typeof w === 'string' && w.length && w.length <= 200)) no('why is the principles, one line each (200 characters at most)');
  return c;
}

// the solves, by spec: a cube is read many times a build, and the same spec solves the same palette
const SOLVED = new Map();
function solveOnce(spec) {
  const k = JSON.stringify(spec);
  if (!SOLVED.has(k)) { if (SOLVED.size >= 64) SOLVED.clear(); SOLVED.set(k, solvePalette(spec)); }
  return SOLVED.get(k);
}
// a colour at another's value: the palette's hue and chroma (quietened), the reference's lightness. A night's sky and
// water take the reference's dark and the palette's hue, so a cold night stays dark whatever the palette's sky is
const atValueOf = (hex, rgb) => { const [, C, h] = lchOf(hexToRgb(hex)), [L] = lchOf(rgb); return rgbToHex(oklch(L, Math.min(C, 0.06), h)); };
/** The cube's colours, tone key, moon and sky solved from its palette: what the cube writes wins key by key, and a
 * written colour with a role of its own is locked in the solve. Writes into `c`; `P` is the seeded spec. */
function solveInto(c, P, ref) {
  const locks = Object.fromEntries(Object.entries(c.colour).filter(([k, v]) => LOCK_ROLE[k] && HEX.test(v ?? '')).map(([k, v]) => [LOCK_ROLE[k], v]));
  const K = solveOnce(Object.keys(locks).length ? { ...P, lock: { ...locks, ...(P.lock ?? {}) } } : P), S = cubeColours(K);
  const night = !ref.light.key, dome = ref.air.dome;
  const colour = { ...S.colour, ...(night ? { water: atValueOf(S.colour.water, dome.zenith) } : {}) };
  c.colour = { ...colour, ...c.colour };
  c.register = { ...c.register, key: c.register.key ?? S.key };
  if (c.light.moon) c.light.moon = { ...c.light.moon, color: c.light.moon.color ?? S.moon };
  c.light.sky ??= night ? { zenith: atValueOf(S.sky.zenith, dome.zenith), horizon: atValueOf(S.sky.horizon, dome.horizon), fog: atValueOf(S.sky.fog, hexToRgb(ref.air.fog.color)) } : S.sky;
  c.why = [...c.why, `Its colours are the color theorist's (${K.id}): ${K.read.says}, in a ${K.read.key} key.`,
    ...(K.read.moonlit ? ['The moon is the cool light and the dark is warm: a cold night inverts the palette.'] : [])];
  c.palette = { ...P, id: K.id, reads: `${K.read.scheme}, a ${K.read.key} key` };
}

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shadeHue = (cube) => cube.colour.shade ?? 222;
// the shade colour a crevice darkens toward: the cube's shade hue at a soft saturation
function shadeHex(hue) {
  const s = 0.4, l = 0.5, a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + hue / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return hexOf([f(0), f(8), f(4)].map((v) => v * 255));
}
/** Each key colour as a ramp of `n` stops, dark to light, every dark end leaning to the cube's shade hue. */
export function geocubeRamps(cube, n = 5) {
  const shadow = shadeHue(cube);
  return Object.fromEntries(Object.entries(cube.colour).filter(([k]) => k !== 'shade').map(([k, h]) => [k, rampFrom(rgbOf(h), n, { shadow }).map(hexOf)]));
}

function lowerInside(cube) {
  const R = geocubeRamps(cube), [w, d, h] = cube.inside.size;
  const tone = {
    texture: 'value', steps: cube.register.steps, key: cube.register.key, gain: 1, detail: 0.45, default: 'stone',
    ramps: { stone: R.stone, floor: R.floor, trim: R.trim, accent: R.accent },
    groups: { 'stage:floor': 'floor', 'stage:gutter': 'floor', 'stage:rubble': 'floor', 'stage:trim': 'trim', 'stage:motif-band': 'trim', 'stage:kick': 'trim', 'stage:skirt': 'trim', 'stage:column': 'trim', 'stage:accent': 'accent' },
    keep: ['stage:fixture', 'stage:lamp'],
  };
  return { kind: 'stage', kit: cube.inside.bones, reference: cube.light.reference, dress: false, shadows: cube.light.shadows,
    tiles: { wall: cube.surfaces.wall, floor: cube.surfaces.floor }, tone,
    rooms: [{ id: 'room', x: 0, y: 0, w, d, h, open: ['-y', '+x'] }] };
}

/** The cube's terrains by name: its own first. → [{ name, reads, own }]. */
export function geocubeTerrains(cube) {
  return [{ name: cube.outside.terrain ?? 'default', reads: cube.reads, own: true },
    ...Object.entries(cube.outside.terrains ?? {}).map(([name, t]) => ({ name, reads: t.reads ?? '', own: false }))];
}
/**
 * Which terrain a level gets: the one it asks for (`ask`, which must be the cube's), else the one its heartbeat was
 * made for (`hint`) when the cube has it, else the cube's own. → { name, from: 'level' | 'heartbeat' | 'cube',
 * offered, wanted? } (`wanted`: the heartbeat's, when the cube has no such terrain).
 */
export function pickTerrain(cube, ask, hint) {
  const offered = geocubeTerrains(cube).map((t) => t.name);
  if (ask !== undefined && ask !== null) {
    if (!offered.includes(ask)) no(`terrain '${ask}' is not one of ${cube.id}'s (terrains: ${offered.join(', ')})`);
    return { name: ask, from: 'level', offered };
  }
  if (hint && offered.includes(hint)) return { name: hint, from: 'heartbeat', offered };
  return { name: offered[0], from: 'cube', offered, ...(hint ? { wanted: hint } : {}) };
}
// the cube as one of its terrains: the cube's own outside, or a terrain's changes over it
function onTerrain(cube, name) {
  if (name === undefined || name === (cube.outside.terrain ?? 'default')) return cube;
  const t = cube.outside.terrains?.[name];
  if (!t) no(`terrain '${name}' is not one of ${cube.id}'s (terrains: ${geocubeTerrains(cube).map((x) => x.name).join(', ')})`);
  return { ...cube, id: `${cube.id}-${name}`, reads: t.reads ?? cube.reads, colour: { ...cube.colour, ...(t.colour ?? {}) },
    outside: { ...cube.outside, base: t.base ?? cube.outside.base, land: t.land ?? cube.outside.land, ...(t.relief !== undefined ? { relief: t.relief } : {}) } };
}

function lowerOutside(cube0, terrain) {
  const cube = onTerrain(cube0, terrain);
  const base = cube.outside.base, card = ISEKAI_STYLES[base], sw = SWATCHES[base], land0 = sw.land;
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], shadow = shadeHue(cube);
  const fit = (hex, name) => resample(rampFrom(rgbOf(hex), 7, { shadow }), land0[name].length);
  // the sky: the cube's own (a solved cube's is its palette's), else the reference's dome
  const S = cube.light.sky, dome = S ? { zenith: rgbOf(S.zenith), horizon: rgbOf(S.horizon) } : ref.air.dome, sky = [dome.zenith, dome.zenith.map((v, k) => (v + dome.horizon[k]) / 2), dome.horizon].map((c) => c.map(Math.round));
  const land = { ...land0, rock: fit(cube.colour.stone, 'rock'), soil: fit(cube.colour.floor, 'soil'), grass: fit(cube.colour.grass, 'grass'),
    foliage: fit(cube.colour.foliage, 'foliage'), far: resample(sky.slice(1).concat([dome.horizon]), land0.far.length), sky: resample(sky, land0.sky.length),
    ...(cube.colour.sand ? { sand: resample(rampFrom(rgbOf(cube.colour.sand), 7, { shadow }), land0.soil.length) } : {}) };
  const key = ref.light.key ? { color: ref.light.key.color, elevation: ref.light.key.elevation, azimuth: ref.light.key.azimuth ?? 225 } : { color: cube.light.moon.color, elevation: cube.light.moon.elevation, azimuth: cube.light.moon.azimuth };
  const light = { ...card.light, key, ambient: ref.light.ambient, ...(ref.light.key ? {} : { sunGain: cube.light.moon.gain }) };
  const air = { ...card.air, fog: { color: S?.fog ?? ref.air.fog.color, density: +(ref.air.fog.density * cube.light.outsideFog).toFixed(5) } };
  const lookCard = { ...card, palette: land, light, air, water: { fill: geocubeRamps(cube).water[2] }, principles: cube.why };
  // the look's id carries its content's print, so a cube's changes register a new look and a re-read the same one
  const id = `geocube-${cube.id}-${fingerprint([base, lookCard]).slice(0, 6)}`;
  registerLook({ id, base, read: cube.reads || cube.title, card: lookCard, swatches: { ...sw, land } });
  // a cube with contrast owns the crease and the ridge (vertex-contrast.js); the land keeps its blend, smoothing and sun
  const L = cube.outside.land, own = readContrast(cube.contrast) ? { crevice: 0, ridge: 0 } : {}, R = cube.outside.relief;
  return { kind: 'stage', kit: id, meru: { tiers: cube.outside.tiers, island: cube.outside.island,
    ...(L === false ? {} : { shading: { ...L, shade: shadeHex(shadeHue(cube)), ...own } }), ...(R !== undefined && R !== false ? { relief: R } : {}) } };
}

/**
 * The cube's `contrast` resolved against its own light and colour, as a world payload carries it (`vertexContrast`):
 * the terms, and the colours they lean to (the cube's sky, else the reference's; the side's ground, the cube's shade, the key: the sun, or
 * the moon with none), the key's direction, a seed from the cube's id, and the mode (`value` under a tone: only value
 * moves). null when the cube has none. `side`: 'inside' (the ground is the floor) or 'outside' (the grass).
 */
export function cubeContrast(cube, side, { terrain, value = false } = {}) {
  const C = readContrast(cube.contrast);
  if (!C) return null;
  const k = side === 'outside' && terrain !== undefined ? onTerrain(cube, terrain) : cube;
  // the sky: the cube's own (a solved palette's), else the reference's dome
  const ref = SIXTH_GEN_REFERENCES[resolveLook(k.light.reference)], sun = ref.light.key;
  const dome = k.light.sky ? { zenith: rgbOf(k.light.sky.zenith), horizon: rgbOf(k.light.sky.horizon) } : ref.air.dome;
  const lit = sun ?? k.light.moon;
  let seed = 2166136261;
  for (const ch of k.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return { ...C, sky: hexOf(dome.zenith.map((v, j) => (v + dome.horizon[j]) / 2)), ground: side === 'outside' ? k.colour.grass : k.colour.floor,
    shade: shadeHex(shadeHue(k)), key: lit.color, toLight: sunDir(lit.elevation, lit.azimuth ?? 225).map((v) => Math.round(v * 1e5) / 1e5),
    seed: seed % 100000, mode: value ? 'value' : 'colour' };
}

/**
 * The resolved contrast of the cube a world manifest is painted by: a stage's `geocube` (its outside with `meru` or a
 * `trail`, else its inside), the geocube kind's `cube` (its `show`), a city's `paint.geocube` (outside). null when no cube
 * paints it or the cube has no contrast. `value`: the payload carries a tone.
 */
export function geocubeContrastOf(manifest, { value = false } = {}) {
  const m = manifest ?? {};
  const spec = m.kind === 'geocube' ? m.cube : m.kind === 'city' ? m.paint?.geocube : m.geocube;
  if (spec === undefined || spec === null) return null;
  const cube = readGeocube(spec);
  if (!readContrast(cube.contrast)) return null;
  const side = m.kind === 'geocube' ? (m.show === 'land' ? 'outside' : 'inside') : m.kind === 'city' || m.meru !== undefined || m.trail !== undefined ? 'outside' : 'inside';
  const terrain = side === 'outside' && m.kind === 'stage' && m.terrain !== undefined ? readTerrainAsk(cube, m.terrain).name : undefined;
  return cubeContrast(cube, side, { terrain, value });
}

/** The cube lowered into one side: 'inside' (the bare room) or 'outside' (the landform, on one of its terrains). */
export function lowerGeocube(cube, side, terrain) {
  if (side === 'inside') return lowerInside(cube);
  if (side === 'outside') return lowerOutside(cube, terrain);
  return no(`side is 'inside' or 'outside', not '${side}'`);
}

/**
 * A stage recipe's `geocube`: the cube lowered under the recipe's own keys, which win. With `meru` it is the outside
 * (the look card, the land's ramps, light and air, the polygon land; the recipe's `meru` keys over the cube's); without,
 * the inside (the bones, reference, tone and tiles; the recipe's rooms, and the kit's dress unless the recipe says).
 */
export function withGeocube(manifest) {
  const { geocube, terrain, ...m } = manifest, cube = readGeocube(geocube);
  const T = terrain === undefined ? undefined : readTerrainAsk(cube, terrain);
  // a trail: the cube paints it once, the outside's look on its open ground; the recipe's own kit, if it names one,
  // wins (a painted level is a starting point, not a lock)
  if (m.trail !== undefined) {
    const low = lowerGeocube(cube, 'outside', T?.name);
    return { ...m, kit: m.kit ?? low.kit };
  }
  if (m.meru !== undefined) {
    const low = lowerGeocube(cube, 'outside', T?.name);
    if (m.kit !== undefined) no('a stage on a geocube takes its kit from the cube; drop kit');
    // a climb that names its own preset or tiers keeps them; the cube's tiers stand where it names none. A climb that
    // follows a trail stands on it, not on the cube's island
    const own = m.meru === true ? {} : m.meru, { tiers: cubeTiers, island: cubeIsland, ...rest } = low.meru;
    const lowMeru = { ...(own.after ? {} : { island: cubeIsland }), ...rest };
    return { ...low, ...m, kit: low.kit, meru: { ...lowMeru, ...(T && (own.preset !== undefined || own.tiers !== undefined) ? {} : { tiers: cubeTiers }), ...own } };
  }
  if (T) no('terrain is the outside\'s: a stage on a geocube takes it with trail or meru');
  const { dress: _d, rooms, ...low } = lowerGeocube(cube, 'inside');
  if (m.kit !== undefined && m.kit !== low.kit) no(`a stage on a geocube takes its kit from the cube's bones ('${low.kit}'); drop kit`);
  return { ...low, ...m, rooms: m.rooms ?? rooms, tone: m.tone ?? low.tone, tiles: m.tiles ?? low.tiles };
}

/** A stage's `terrain`: a name it asks for, or { ask?, hint? } (hint: its heartbeat's). → pickTerrain's answer. */
export function readTerrainAsk(cube, terrain) {
  if (typeof terrain === 'string') return pickTerrain(cube, terrain);
  if (!isObj(terrain)) no('terrain is the name of one of the cube\'s terrains, or { ask?, hint? }');
  only(terrain, ['ask', 'hint'], 'terrain');
  return pickTerrain(cube, terrain.ask, terrain.hint);
}
/** What a stage painted by a cube got: the cube, the terrain, from whom, and what the cube offered. */
export function geocubePaint(manifest) {
  const cube = readGeocube(manifest.geocube), T = manifest.terrain === undefined ? pickTerrain(cube) : readTerrainAsk(cube, manifest.terrain);
  return { geocube: cube.id, ...(cube.palette?.id ? { palette: cube.palette.id } : {}), terrain: T.name, from: T.from, offered: T.offered, ...(T.wanted ? { wanted: T.wanted } : {}), ...(manifest.kit !== undefined && manifest.trail !== undefined ? { kit: manifest.kit, note: 'the recipe\'s own kit over the cube\'s paint' } : {}) };
}

// the accent wall: the cube's wall re-tiled in the accent's pattern (a toned room keeps its value twins, so it does too)
const INWARD = { '-y': [0, 1], '+x': [-1, 0], '+y': [0, -1], '-x': [1, 0] };
function withAccent(payload, wall, tile) {
  const fam = tileFamilyOf(tile, 'geocube accent'), [nx, ny] = INWARD[wall];
  let n = 0;
  payload.faces = payload.faces.map((f) => {
    if (f.group !== 'stage:wall' || !Array.isArray(f.normal) || typeof f.texture !== 'string') return f;
    if (Math.abs(f.normal[0] - nx) > 0.05 || Math.abs(f.normal[1] - ny) > 0.05) return f;
    n++;
    return { ...f, texture: `${f.texture.startsWith('value:') ? 'value:' : ''}${fam}-${f.texture.slice(-1)}`, group: 'stage:accent' };
  });
  if (!n) no(`no wall faces on ${wall} to make the accent`);
}
// the island seen whole: the wide camera pulled back and up, first so the page opens on it
function withIslandCamera(payload) {
  const wide = payload.cameras.find((c) => c.name === 'wide');
  if (!wide) return;
  const { cameraPosition: p, lookAt: t } = wide.worldFraming, back = p.map((v, k) => t[k] + (v - t[k]) * 1.55);
  back[2] += 6;
  payload.cameras = [{ name: 'island', worldFraming: { ...wide.worldFraming, cameraPosition: back.map((v) => Math.round(v * 100) / 100), horizontalFov: 58 } }, ...payload.cameras];
}

/**
 * What the cube's target asks of its level, near a standing figure (1.8 m): pixels per metre, the texels a metre of
 * surface wants for one per pixel against what the sixth-gen tiles paint, and how many pixels a shadow cell spans.
 * A readout: nothing is resized here.
 */
export function geocubeDensity(cube) {
  const t = readTarget(cube.target), ppm = t.figurePx / 1.8, r1 = (v) => Math.round(v * 10) / 10;
  return { target: { resolution: t.resolution, framing: t.framing, error: t.error }, pxPerMetre: r1(ppm),
    texelsPerMetre: { wanted: r1(ppm), painted: [...SIXTH_GEN.texture.texelsPerMetre] }, shadowCellPx: r1(cube.light.shadows.cells * ppm) };
}

const SHOW = ['room', 'land'];
/** The `geocube` world kind: { cube, show } → the specimen, built by the stage. `assemble` is assembleStageScene. */
export function assembleGeocubeScene(manifest, ctx, assemble) {
  for (const k of Object.keys(manifest)) if (!['kind', 'cube', 'show', 'title', 'walk'].includes(k)) no(`'${k}' is not a setting of the geocube kind (cube, show); build a level on a cube with a stage recipe's geocube`);
  const cube = readGeocube(manifest.cube ?? no('cube is a preset id or a document')), show = manifest.show ?? 'room';
  if (!SHOW.includes(show)) no(`show is ${SHOW.map((s) => `'${s}'`).join(' or ')}`);
  const title = ctx.title || `${cube.title} · ${show === 'room' ? 'room' : 'landform'}`;
  const low = lowerGeocube(cube, show === 'room' ? 'inside' : 'outside');
  const payload = assemble({ ...low, ...(manifest.walk !== undefined ? { walk: manifest.walk } : {}) }, { ...ctx, title });
  if (show === 'room') withAccent(payload, cube.inside.accentWall, cube.surfaces.accent);
  else withIslandCamera(payload);
  payload.geocube = { id: cube.id, title: cube.title, reads: cube.reads, show, why: cube.why, ramps: geocubeRamps(cube), era: cube.era, density: geocubeDensity(cube),
    ...(cube.palette?.id ? { palette: { id: cube.palette.id, reads: cube.palette.reads } } : {}), ...(cube.light.sky ? { sky: cube.light.sky } : {}),
    ...(readContrast(cube.contrast) ? { contrast: readContrast(cube.contrast) } : {}) };
  return payload;
}
