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
 *   materials (optional) what the cube's people wear is made of: true (materials/dress-materials.js: plate as worked
 *             steel, kanamono as gold, leather as leather, by the armour's family and each metal group's own tone),
 *             or { age?, <group>: <material> } over that (`age`: new, worn, old or ancient: copper alloys tarnish
 *             and turn green, steel dulls and blackens); a hero takes it through its `geocube`. Absent: tones, as always
 *   inside    the bones (a room kit, bare), the specimen room's size, the accent wall; and its INTERIORS: the cube's own
 *             room is one (named by `interior`, 'room' unless named), `interiors` the others, each a few changes to it
 *             ({ reads?, bones?, size?, accentWall? }: a hall, a cellar)
 *   outside   the base (an isekai card), the landform's tiers and island, `land`: the polygon land's rules (with
 *             `mix`, `facet` and `valley`, local-meru/plan.js SHADING), `relief` (optional): the plain's own ground, a
 *             relief card or { from, …changes } (noise/relief.js), `ground` (optional): a terrain world's field
 *             under the plain ({ from: <painted-landscape recipe>, span?, height?, at? }, local-meru/ground.js),
 *             `crystals` (optional): gems grown out of its crags or in its hollows (a gem's name, or { gem, where?,
 *             count?, size?, glow?, seed? }, local-meru/crystals.js); and
 *             its TERRAINS: the cube's own outside is one (named by `terrain`, 'default' unless named), `terrains`
 *             the others, each a few changes to it, up to a whole land of its own ({ reads?, base?, tiers?, island?, land?,
 *             relief?, ground?, crystals?, colour? }: a shore, a highland). A level asks for one, or its heartbeat names the
 *             one it was made for, and the answer says which it got
 *   structures (optional) landmarks its builders raise, by name: { <name>: [<structure>…] }, each a fractal structure's
 *             words (fractal-structure/read.js) standing `at` [x, y, z?] or `on: 'summit'` (the top tier's top, `at` then
 *             an offset), painted from the cube's ramps unless it names its own palette, lit by the cube's key
 *   settlements (optional) the towns its builders make, by name: { <name>: { town?, houses?, enter?, doors?, anchor? } }
 *             (`town` a town plan, out-town.js; the street of it a trail walks through, era/stage-buildings.js), built
 *             in the cube's builders' language (its buildings' anchor) unless it names its own
 *   domains   (optional) the levels the cube makes, each a composition of its ingredients in its one style:
 *             { <name>: { reads?, terrain? | interior?, hour?, structures?, settlement? } } (outside on a terrain at an
 *             hour, with its structures and its town: each a name or written there, or inside an interior). A cube that names none offers one per terrain and one per interior. Expanding a domain lowers
 *             it: a level asks for one by name, as { from: <name>, …changes }, or composes its own from the cube's
 *             ingredients; style never changes in a domain (a different style is a different cube)
 *   why       the principles, one line each, carried into the outside's look card for whatever builds next
 *   grit      (optional) how gritty the style is, 0 (quiet) to 1: from local-meru GRIT_PIXELS its rock takes pixels (the
 *             page draws the rock's own fabric on the near cliffs, matte-paint/fabric.js); under it, or absent, rock is
 *             polygon only
 *   avoid     (optional) the mistakes the style names, [{ line, law }], each measured by its law when the cube is read
 *             (geocube-laws.js: a palette law off the solved contract, or the cube's own) and written back on the line
 *             as { ok, value }: advice, never a refusal
 *   era       the look's generation (eras.js; gen-6 by default): its light and surface conventions, at any resolution
 *   target    what the level is drawn for (target.js: resolution, framing, error; 1080p third-person by default): how
 *             many pixels a metre covers, so how dense its cast's rings and its surfaces' texels need to be. A hero lit
 *             by the cube takes its era and its target unless it names its own target
 *
 *   readGeocube(spec)          a preset id, a document, or { from: preset, …changes } → the cube, checked
 *   lowerGeocube(cube, side, place?, hour?, clouds?)   'inside' | 'outside' → a stage manifest (`place`: the interior or
 *                              the terrain; the outside at `hour`: geocube-hours.js; under `clouds`, painted round the
 *                              dome: matte-paint/sky.js)
 *   assembleGeocubeScene(m)    the `geocube` world kind: { cube, show: 'room' | 'land', domain? } → its specimen
 *   withGeocube(manifest)      a stage recipe's `geocube`: the cube lowered under the recipe's own keys (its `domain`
 *                              expanded: an outside domain alone stands on the cube's island)
 *   pickTerrain(cube, ask, hint)   which terrain a level gets, and from whom: → { name, from, offered, wanted? }
 *   pickDomain(cube, ask, hint)    which domain a level gets, and from whom: → { name, from, offered, domain, wanted? }
 *   expandGeocube(cube, ask, hint) domain expansion: the domain picked and lowered → { manifest, pick }
 *   geocubeStructures(manifest)    a stage's or a specimen's domain's structures, painted and placed → { list, light } | null
 *   geocubeTown(cube, domain)      a domain's settlement as a stage's `town` (its street on a trail) | null
 *   cubeContrast(cube, side)       the cube's `contrast` resolved against its light and colour, as a payload carries it
 *   geocubeContrastOf(manifest)    the resolved contrast of the cube a world manifest is painted by, or null
 */
import { SIXTH_GEN, SIXTH_GEN_REFERENCES, SIXTH_GEN_LOOK_IDS, resolveLook } from './sixth-gen.js';
import { readAvoid, measureAvoid } from './geocube-laws.js';
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
import { readGround } from '../local-meru/ground.js';
import { readCrystals } from '../local-meru/crystals.js';
import { materialsErrors } from '../materials/dress-materials.js';
import { sunDir } from './sun.js';
import { solvePalette, readPaletteSpec } from '../color-theorist/solve.js';
import { cubeColours } from '../color-theorist/adapters.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';
import { oklch, lchOf, hexToRgb, rgbToHex } from '../color-theorist/oklab.js';
import { hourLight, readHour, referenceHour } from './geocube-hours.js';
import { readClouds, WEATHERS, CLOUDS_OF_WEATHER } from '../matte-paint/sky.js';
import { validateStructures } from '../fractal-structure/read.js';
import { makeLight } from '../polygonizer/vexar.js';
import { planLocalMeru } from '../local-meru/plan.js';
import { readTownPlan } from './out-town.js';

const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const ISLE = { geology: true, walk: 'base' };
const STONE = { gen: 'stone-brick', stone: [150, 150, 150], mortar: [88, 88, 88], rows: 6, cols: 4, mortarThick: 0.1, vary: 28, grain: 11, bevel: 0.2, accent: 0.14, accentDark: 40, accentLight: 26, seed: 13 };
const FLAGS = { gen: 'flagstone', stone: [140, 140, 140], mortar: [58, 58, 58], gravel: [96, 96, 96], cells: 5, mortarThick: 0.05, wobble: 2.2, vary: 22, grain: 12, lost: 0.04, cracked: 0.2, seed: 17 };
const ROCK = { gen: 'rock', style: 'cave', base: [170, 170, 170], seed: 1 };
const LAND = { smooth: true, crevice: 0.6, ridge: 0.35, blend: 0.6 };
// the upland's ground: a rocky heartbeat at the level's own scale (local-meru/ground.js), and the land words that
// read it: surfaces mixed at their seams, rock in planes, the valleys' shade
const UPLAND = { from: { heartbeat: 'rocky-irregular', splatch: 'verdure-trio', seed: 'g2' }, span: 45, height: 3.5 };
const UPLAND_LAND = { ...LAND, mix: 1, facet: 4, valley: 0.7 };
// and its island's flat seabed drawn as a few large quads (most of the faces, under the deep water)
const UPLAND_ISLE = { ...ISLE, seabed: 'merged' };
// the gen-6 shadows: torch shadows, a soft sun edge, surfaces cut to half a metre so a shadow has corners. The
// torch's own soft edge ('soft') costs about four times the bake for what the half-metre cells already blur.
const SHADOWS = { torch: 'hard', sun: 1.5, cells: 0.5 };
// quiet surfaces (geocube-laws.js QUIET): the same stone and flags with half the block shift and the speckle
const QUIET_STONE = { ...STONE, vary: 12, grain: 5 };
const QUIET_FLAGS = { ...FLAGS, vary: 10, grain: 5 };

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
  'upland-morning': {
    id: 'upland-morning', title: 'Upland morning', reads: 'Limestone and red roofs on a rocky green upland',
    light: { reference: 'island-noon', outsideFog: 1.6 },
    colour: { stone: '#b8aa8c', floor: '#9a7a58', trim: '#e6dcc4', accent: '#b8442c', grass: '#64a83a', foliage: '#3a7a32', water: '#3a8cb8', sand: '#d6c49a', shade: 236 },
    register: { steps: 0, key: 0.5 },
    contrast: { from: 'wii', metal: 1 },
    materials: true,
    surfaces: { wall: STONE, floor: FLAGS, accent: ROCK },
    inside: { bones: 'gothic-stone', size: [12, 12, 6], accentWall: '+y' },
    outside: { base: 'isekai-meadow', tiers: TWO_BASES, island: UPLAND_ISLE, land: UPLAND_LAND, ground: UPLAND },
    why: [
      'The contrast lives in the vertex: the sky on every top, the ground under every overhang.',
      'A wall is darker at its foot and lighter toward the eaves.',
      'Creases and contacts fall into a blue-violet shade, never black.',
      'The lit side warms toward the sun; the shade side cools.',
      'One accent, the red of the roofs; the upland green carries the rest.',
      'The ground is a terrain\'s own, at the level\'s scale: the mounds rise out of its swells, grass meets rock in a curve.',
      'What people wear is made of something: plate is worked steel, gilt is gold, and metal sits in the same light as the stone.',
    ],
  },
  'theatre-grey': {
    id: 'theatre-grey', title: 'Theatre grey', reads: 'A grey, quiet world staged in pools of light',
    light: { reference: 'jungle-haze', outsideFog: 1.4 },
    colour: { stone: '#7c8084', floor: '#5e6064', trim: '#9a9ea2', accent: '#b8261e', grass: '#6a706a', foliage: '#4c524e', water: '#4a5258', sand: '#8a8a86', shade: 230 },
    register: { steps: 0, key: 0.42 },
    surfaces: { wall: QUIET_STONE, floor: QUIET_FLAGS, accent: ROCK },
    inside: { bones: 'research-lab', size: [12, 12, 7], accentWall: '+y' },
    outside: { base: 'isekai-meadow', tiers: TWO_BASES, island: ISLE, land: LAND },
    why: [
      'Volumes are simple and strong; the surfaces are quiet, so the light does the drawing.',
      'Grey, cool and low in colour: the world is nearly without hue.',
      'A small red is the only loud colour, and it marks what matters.',
      'Light falls in pools and beams; between them the space goes soft into the air.',
      'Shade stays a colour the eye can read into, never flat black.',
      'The player is found by light and placement, never by an outline or a glow.',
    ],
    avoid: [
      { line: 'Flat black where nothing can be read.', law: 'shade-is-colour' },
      { line: 'Noisy realistic textures.', law: 'quiet-surfaces' },
      { line: 'Bright colours unrelated to what matters.', law: 'accent-unique' },
    ],
  },
  // the first terrain past the sixth generation: the rock drawn as erosion leaves it (a formation, near the eye), its
  // edges broken and its stones strewn (grit), under a palette solved round the stone and a clear sky
  'limestone-crags': {
    id: 'limestone-crags', title: 'Limestone crags', reads: 'Pale limestone crags over a deep blue sea, the rock drawn near in its own beds',
    light: { reference: 'island-noon', outsideFog: 0.8, sky: { zenith: '#5a8cc8', horizon: '#cfe1ec', fog: '#c9d8df' } },
    colour: { stone: '#c4b69c', floor: '#a9867c', trim: '#bda09f', accent: '#f49a74', grass: '#aa8957', foliage: '#554700', water: '#365d84', sand: '#b2968d', shade: 270 },
    register: { steps: 0, key: 0.62 },
    contrast: 'wii',
    grit: 0.7,
    surfaces: { wall: STONE, floor: FLAGS, accent: ROCK },
    inside: { bones: 'gothic-stone', size: [12, 12, 6], accentWall: '+y' },
    outside: { base: 'isekai-meadow', tiers: TWO_BASES, island: ISLE, land: { ...LAND, skin: 'limestone' } },
    why: [
      'The rock is drawn as erosion leaves it: beds of their own hardness, joints, fallen blocks and their scars.',
      'Far, the polygons carry the crags; nearer, the rock refines, down to its grain, and never sooner than it can be seen.',
      'Pale stone in a hard clear light: the lit faces warm and bright, the shade cool and readable.',
      'No edge is a ruled line against the sky: boulders and rims break.',
      'Small stones lie where they would: on the boulders, along the paths, at the foot of the cliffs.',
      'The sea is deep, the sky clear, the scrub a dry olive: the sky and the stone light, the scrub mid, the shade dark.',
    ],
    avoid: [
      { line: 'Values that only read in colour.', law: 'greyscale-read' },
      { line: 'Flat black where nothing can be read.', law: 'shade-is-colour' },
      { line: 'Muddy values with no clear masses.', law: 'value-groups' },
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
  'upland-morning': { anchor: 'tiered', uses: [{ use: 'dwelling', enter: 'door' }, { use: 'tavern', enter: 'door' }, { use: 'temple', enter: 'door' }, { use: 'tower', enter: 'walk' }, { use: 'guardhouse', enter: 'door' }] },
  'theatre-grey': { anchor: 'tiered', uses: [{ use: 'lab', enter: 'door' }, { use: 'workshop', enter: 'walk' }, { use: 'tower', enter: 'walk' }, { use: 'dwelling', enter: 'door' }] },
  'limestone-crags': { anchor: 'tiered', uses: [{ use: 'dwelling', enter: 'door' }, { use: 'shop', enter: 'door' }, { use: 'tavern', enter: 'door' }, { use: 'temple', enter: 'door' }, { use: 'tower', enter: 'walk' }] },
});
/**
 * The levels a preset makes, beyond its own room and land: its other terrains and interiors, and the domains that
 * compose them (`domains` on the cube). Read into the preset when it is named (an id or `from`), so a preset's own
 * bytes do not move and its own room and land lower as they always did; a cube document carries its own.
 */
export const GEOCUBE_DOMAINS = Object.freeze({
  'limestone-crags': {
    outside: { terrains: { cove: { reads: 'A sand cove under low crags, the sea come in close',
      tiers: [{ form: 'mound', height: 3.5, foot: 12, summit: 7 }], island: { ...ISLE, beach: 16, high: { azimuth: null, height: 6, span: 150 } } } } },
    inside: { interiors: { hall: { reads: 'A tall pale temple hall, cool out of the light', bones: 'gothic-nave', size: [12, 20, 11] } } },
    structures: { shrine: [{ id: 'summit-shrine', preset: 'spire', on: 'summit', size: 2.4, seed: 7 }] },
    settlements: { harbour: { town: { length: 100, branches: 1, levels: 1, farms: 0.2 }, houses: 6, enter: 2 } },
    domains: {
      'crag-path': { reads: 'The crags in the hard clear light, the way up through the beds, a shrine on the top', structures: 'shrine' },
      'cove-dusk': { reads: 'The cove at dusk, the stone gone gold and the sea blue', terrain: 'cove', hour: 'dusk' },
      'harbour-town': { reads: 'Up the street of the harbour town, pale houses under red roofs', terrain: 'cove', settlement: 'harbour' },
      'temple-hall': { reads: 'Into the temple hall, tall and cool out of the light', interior: 'hall' },
    },
  },
});
// a preset as it is read: its own document with the levels it makes (GEOCUBE_DOMAINS) laid over it
const presetOf = (id) => merge(structuredClone(GEOCUBE_PRESETS[id]), structuredClone(GEOCUBE_DOMAINS[id] ?? {}));
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
  'upland-morning': { intent: 'limestone, red roofs and a rocky green upland in the morning', key: 'high', heat: 0.3, weight: 0, activity: 0.25, scheme: 'complementary', hues: { sky: 222, rock: 50, soil: 34, ground: 108, foliage: 126, accent: '#b8442c' } },
  'theatre-grey': { intent: 'a grey, quiet world staged in pools of light, one red for what matters', key: 'mid', heat: -0.25, weight: 0.35, activity: -0.8, scheme: 'mono-accent', hues: { rock: 230 }, lock: { accent: '#b8261e' } },
  'limestone-crags': { intent: 'pale limestone crags, dry olive scrub and a high clear sky', key: 'high', heat: 0.3, weight: 0.1, activity: -0.2, scheme: 'complementary', hues: { soil: 36, ground: 78, foliage: 96 }, lock: { rock: '#c4b69c', sky: '#8db8e4' }, values: { groups: 3 } },
});
// each preset's principles that name its colours: under a solved palette they give way to the palette's own reading
const COLOUR_WHY = Object.freeze({ 'gothic-night': [0, 1, 2, 3], 'island-noon': [0, 1], 'jungle-haze': [0, 2, 3], 'valley-morning': [2, 4], 'upland-morning': [2, 4], 'theatre-grey': [1, 2], 'limestone-crags': [2, 5] });
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
const KEYS = { id: 1, title: 1, reads: 1, era: 1, target: 1, light: 1, colour: 1, register: 1, contrast: 1, surfaces: 1, inside: 1, outside: 1, why: 1, avoid: 1, buildings: 1, palette: 1, materials: 1, grit: 1, structures: 1, settlements: 1, domains: 1 };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b === undefined ? a : b);
const no = (msg) => { throw new Error(`geocube: ${msg}`); };
// a relief checked where the cube names it: its own words, said as the cube's
const reliefOrNo = (v, at) => { try { readRelief(v); } catch (e) { no(`${at}: ${e.message.replace(/^relief: /, '')}`); } };
const groundOrNo = (v, at) => { try { readGround(v); } catch (e) { no(`${at}${e.message.replace(/^local-meru: ground/, '')}`); } };
const SLUG = /^[a-z][a-z0-9-]{0,31}$/;
const TERRAIN_KEYS = ['reads', 'base', 'tiers', 'island', 'land', 'relief', 'ground', 'crystals', 'colour'];
const DOMAIN_KEYS = ['reads', 'terrain', 'interior', 'hour', 'structures', 'settlement'];
const SETTLEMENT_KEYS = ['town', 'houses', 'enter', 'doors', 'anchor'];
const STRUCTURE_ON = ['summit'];
const LAND_WORDS = ['smooth', 'crevice', 'ridge', 'blend', 'sun', 'mix', 'facet', 'valley', 'skin', 'rocks'];
const only = (o, keys, at) => { for (const k of Object.keys(o)) if (!keys.includes(k)) no(`${at}.${k} is not a setting (${at}: ${keys.join(', ')})`); };

/** A preset id, a whole document, or { from: preset, …changes } (merged key by key; arrays are replaced) → the cube. */
export function readGeocube(spec) {
  if (typeof spec === 'string') {
    if (!GEOCUBE_PRESETS[spec]) no(`'${spec}' is not a preset (presets: ${Object.keys(GEOCUBE_PRESETS).join(', ')}); or write the cube`);
    return readGeocube(presetOf(spec));
  }
  if (!isObj(spec)) no('a cube is a preset id or a document { light, colour, register, surfaces, inside, outside, why }');
  if (spec.from !== undefined) {
    const { from, ...rest } = spec;
    if (!GEOCUBE_PRESETS[from]) no(`from: '${from}' is not a preset (presets: ${Object.keys(GEOCUBE_PRESETS).join(', ')})`);
    const base = presetOf(from);
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
  const checks = P ? solveInto(c, P, ref) : null;
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
  // grit (optional): how gritty the style is, 0..1; from GRIT_PIXELS its rock takes pixels (local-meru/plan.js)
  if (c.grit !== undefined && !(typeof c.grit === 'number' && c.grit >= 0 && c.grit <= 1)) no('grit is how gritty the style is, 0 (quiet) to 1; a gritty style\'s rock takes matte-painted pixels');
  // contrast (optional): the shaping in the vertex; absent or false ⇒ none
  if (c.contrast !== undefined) { try { readContrast(c.contrast); } catch (e) { no(e.message); } }
  if (c.materials !== undefined) { const e = materialsErrors(c.materials); if (e.length) no(e.join('; ')); }
  // surfaces
  only(c.surfaces, ['wall', 'floor', 'accent', 'pillar', 'plinth'], 'surfaces');
  for (const k of ['wall', 'floor', 'accent']) tileFamilyOf(c.surfaces[k], `geocube surfaces.${k}`);
  // (the pillars and the plinth, optional: pilasters, engaged columns and the baseboard in surfaces of their own)
  for (const k of ['pillar', 'plinth']) if (c.surfaces[k] !== undefined) tileFamilyOf(c.surfaces[k], `geocube surfaces.${k}`);
  // inside
  only(c.inside, ['bones', 'size', 'accentWall', 'interior', 'interiors'], 'inside');
  const roomOrNo = (r, at, own = false) => {
    if ((own || r.bones !== undefined) && (!STAGE_KITS[r.bones] || isGroundKit(r.bones))) no(`${at}.bones '${r.bones}' is not a room kit (${Object.keys(STAGE_KITS).filter((k) => !isGroundKit(k)).join(', ')})`);
    if (r.size !== undefined && !(Array.isArray(r.size) && r.size.length === 3 && r.size.every((v) => v >= 3 && v <= 40))) no(`${at}.size is [w, d, h] metres, each 3..40`);
    if (r.accentWall !== undefined && !WALLS.includes(r.accentWall)) no(`${at}.accentWall is one of ${WALLS.join(', ')}`);
  };
  roomOrNo(c.inside, 'inside', true);
  c.inside.size ??= [12, 12, 6]; c.inside.accentWall ??= '+y';
  if (c.inside.interior !== undefined && !(typeof c.inside.interior === 'string' && SLUG.test(c.inside.interior))) no('inside.interior is the name of the cube\'s own room, a lowercase slug');
  if (c.inside.interiors !== undefined) {
    if (!isObj(c.inside.interiors)) no('inside.interiors is { <name>: { reads?, bones?, size?, accentWall? } }: the cube\'s other rooms');
    for (const [name, r] of Object.entries(c.inside.interiors)) {
      const at = `inside.interiors.${name}`;
      if (!SLUG.test(name) || name === (c.inside.interior ?? 'room')) no(`${at}: an interior's name is a lowercase slug, not the cube's own ('${c.inside.interior ?? 'room'}')`);
      if (!isObj(r)) no(`${at} is { reads?, bones?, size?, accentWall? }`);
      only(r, ['reads', 'bones', 'size', 'accentWall'], at);
      roomOrNo(r, at);
    }
  }
  // outside
  only(c.outside, ['base', 'tiers', 'island', 'land', 'relief', 'ground', 'crystals', 'terrain', 'terrains'], 'outside');
  if (c.outside.relief !== undefined) reliefOrNo(c.outside.relief, 'outside.relief');
  if (c.outside.ground !== undefined) groundOrNo(c.outside.ground, 'outside.ground');
  if (c.outside.crystals !== undefined) { try { readCrystals(c.outside.crystals); } catch (e) { no(`outside${e.message.replace(/^local-meru: /, '.')}`); } }
  if (c.outside.terrain !== undefined && !(typeof c.outside.terrain === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(c.outside.terrain))) no('outside.terrain is the name of the cube\'s own terrain, a lowercase slug');
  if (c.outside.terrains !== undefined) {
    if (!isObj(c.outside.terrains)) no(`outside.terrains is { <name>: { ${TERRAIN_KEYS.map((k) => `${k}?`).join(', ')} } }: the cube's other terrains`);
    for (const [name, t] of Object.entries(c.outside.terrains)) {
      const at = `outside.terrains.${name}`;
      if (!/^[a-z][a-z0-9-]{0,31}$/.test(name) || name === (c.outside.terrain ?? 'default')) no(`${at}: a terrain's name is a lowercase slug, not the cube's own ('${c.outside.terrain ?? 'default'}')`);
      if (!isObj(t)) no(`${at} is { ${TERRAIN_KEYS.map((k) => `${k}?`).join(', ')} }`);
      only(t, TERRAIN_KEYS, at);
      if (t.tiers !== undefined && (!Array.isArray(t.tiers) || !t.tiers.length)) no(`${at}.tiers is the landform's tiers (local meru), one or more`);
      if (t.island !== undefined && t.island !== true && !isObj(t.island)) no(`${at}.island is true or { shore, beach, sea, depth, high, … } (local meru)`);
      if (t.crystals !== undefined && t.crystals !== false) { try { readCrystals(t.crystals); } catch (e) { no(`${at}${e.message.replace(/^local-meru: /, '.')}`); } }
      if (t.relief !== undefined && t.relief !== false) reliefOrNo(t.relief, `${at}.relief`);
      if (t.ground !== undefined && t.ground !== false) groundOrNo(t.ground, `${at}.ground`);
      if (t.base !== undefined && (!ISEKAI_STYLES[t.base] || !SWATCHES[t.base])) no(`${at}.base '${t.base}' is not an isekai card (${Object.keys(ISEKAI_STYLES).filter((k) => SWATCHES[k]).join(', ')})`);
      if (t.land !== undefined && t.land !== false) only(t.land, LAND_WORDS, `${at}.land`);
      if (t.colour !== undefined) {
        only(t.colour, ['stone', 'floor', 'grass', 'foliage', 'water', 'sand'], `${at}.colour`);
        for (const [k, v] of Object.entries(t.colour)) if (!HEX.test(v)) no(`${at}.colour.${k} is a #rrggbb colour`);
      }
    }
  }
  if (!ISEKAI_STYLES[c.outside.base] || !SWATCHES[c.outside.base]) no(`outside.base '${c.outside.base}' is not an isekai card (${Object.keys(ISEKAI_STYLES).filter((k) => SWATCHES[k]).join(', ')})`);
  c.outside.tiers ??= TWO_BASES; c.outside.island ??= ISLE; c.outside.land ??= LAND;
  if (!Array.isArray(c.outside.tiers) || !c.outside.tiers.length) no('outside.tiers is the landform\'s tiers (local meru), one or more');
  if (c.outside.land !== false) only(c.outside.land, LAND_WORDS, 'outside.land');
  // buildings (optional): the seeds a world on this cube builds from
  if (c.buildings !== undefined) {
    if (!isObj(c.buildings)) no('buildings is { anchor?, uses: [{ use, enter }] }');
    only(c.buildings, ['anchor', 'uses'], 'buildings');
    if (!Array.isArray(c.buildings.uses) || !c.buildings.uses.every((u) => isObj(u) && typeof u.use === 'string' && ['door', 'walk', false].includes(u.enter ?? 'door'))) no("buildings.uses is [{ use, enter: 'door' | 'walk' | false }]");
  }
  // structures (optional): the landmarks its builders raise, each set by name
  if (c.structures !== undefined) {
    if (!isObj(c.structures) || !Object.keys(c.structures).length) no('structures is { <name>: [<structure>…] }: the landmarks the cube\'s builders raise, by name');
    for (const [name, list] of Object.entries(c.structures)) {
      if (!SLUG.test(name)) no(`structures.${name}: a set's name is a lowercase slug`);
      structuresOrNo(list, `structures.${name}`);
    }
  }
  // settlements (optional): the towns its builders make, each by name
  if (c.settlements !== undefined) {
    if (!isObj(c.settlements) || !Object.keys(c.settlements).length) no(`settlements is { <name>: { ${SETTLEMENT_KEYS.map((k) => `${k}?`).join(', ')} } }: the towns the cube's builders make, by name`);
    for (const [name, t] of Object.entries(c.settlements)) {
      if (!SLUG.test(name)) no(`settlements.${name}: a settlement's name is a lowercase slug`);
      settlementOrNo(t, `settlements.${name}`);
    }
  }
  // domains (optional): the levels the cube makes; terrains and interiors share their names when the cube names none
  const places = [...geocubeTerrains(c), ...geocubeInteriors(c)].map((p) => p.name), twice = places.find((n, i) => places.indexOf(n) !== i);
  if (twice) no(`'${twice}' names a terrain and an interior: they share the cube's domain names, so name one of them again`);
  if (c.domains !== undefined) {
    if (!isObj(c.domains) || !Object.keys(c.domains).length) no(`domains is { <name>: { ${DOMAIN_KEYS.map((k) => `${k}?`).join(', ')} } }: the levels the cube makes, one or more`);
    for (const [name, d] of Object.entries(c.domains)) {
      if (!SLUG.test(name)) no(`domains.${name}: a domain's name is a lowercase slug`);
      composeDomain(c, d, `domains.${name}`);
    }
  }
  // why
  if (!Array.isArray(c.why) || !c.why.length || !c.why.every((w) => typeof w === 'string' && w.length && w.length <= 200)) no('why is the principles, one line each (200 characters at most)');
  // avoid (optional): the mistakes the style names, each measured by its law (geocube-laws.js)
  if (c.avoid !== undefined) { readAvoid(c.avoid, no); c.avoid = measureAvoid(c, checks); }
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
  return K.checks;
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

/**
 * A GRITTY cube's room (grit ≥ GRIT_PIXELS): its stone dressed from relief (matte-paint/dressed.js), as its outside's rock
 * is drawn near in its own beds. The stock pixel maps give way: the wall's stone-brick becomes ashlar, the floor's
 * flagstone worn slabs, in the colours they named; the pillars fluted and the plinth a course of long blocks, unless the
 * cube names its own. Grit tunes them: how much is broken, pitted and worn, a rock face from 0.85. A surface the cube
 * names in another generator, or already dressed, is kept. Quiet cubes are as they were.
 */
function dressedSurfaces(cube) {
  const S = cube.surfaces, g = cube.grit, W = S.wall, F = S.floor;
  const wear = { grit: g, spall: Math.min(1, g), pit: Math.round(60 * g) / 100 };
  const dark = (c, k) => c.map((v) => Math.round(v * k));
  const wall = W.gen === 'stone-brick' ? { gen: 'dressed', stone: W.stone, mortar: W.mortar, rows: 4, cols: 2, tool: g >= 0.85 ? 'pitched' : 'tooled', ...wear, seed: W.seed ?? 13 } : W;
  const floor = F.gen === 'flagstone' ? { gen: 'dressed', face: 'floor', stone: F.stone, mortar: F.mortar, rows: 4, cols: 3, tool: 'none', ...wear, seed: F.seed ?? 17 } : F;
  const stone = wall.stone ?? W.stone ?? [150, 150, 150], mortar = wall.mortar ?? W.mortar ?? [88, 88, 88];
  return { wall, floor,
    pillar: S.pillar ?? { gen: 'dressed', cut: 'fluted', stone, mortar, ...wear, seed: 5 },
    plinth: S.plinth ?? { gen: 'dressed', stone: dark(stone, 0.92), mortar, rows: 2, cols: 2, ...wear, seed: 9 } };
}

function lowerInside(cube) {
  const R = geocubeRamps(cube), [w, d, h] = cube.inside.size, gritty = cube.grit !== undefined && cube.grit >= GRIT_PIXELS;
  // (a gritty room's tone lets its stone's own light and dark through further: the grit is how much texture reads)
  const tone = {
    texture: 'value', steps: cube.register.steps, key: cube.register.key, gain: 1, detail: gritty ? Math.round((0.45 + 0.45 * cube.grit) * 100) / 100 : 0.45, default: 'stone',
    ramps: { stone: R.stone, floor: R.floor, trim: R.trim, accent: R.accent },
    groups: { 'stage:floor': 'floor', 'stage:gutter': 'floor', 'stage:rubble': 'floor', 'stage:trim': 'trim', 'stage:motif-band': 'trim', 'stage:kick': 'trim', 'stage:skirt': 'trim', 'stage:column': 'trim', 'stage:accent': 'accent' },
    keep: ['stage:fixture', 'stage:lamp'],
  };
  return { kind: 'stage', kit: cube.inside.bones, reference: cube.light.reference, dress: false, shadows: cube.light.shadows,
    tiles: gritty ? dressedSurfaces(cube) : { wall: cube.surfaces.wall, floor: cube.surfaces.floor, ...(cube.surfaces.pillar !== undefined ? { pillar: cube.surfaces.pillar } : {}), ...(cube.surfaces.plinth !== undefined ? { plinth: cube.surfaces.plinth } : {}) }, tone,
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
// the cube as one of its terrains: the cube's own outside, or a terrain's changes over it (up to a land of its own)
function onTerrain(cube, name) {
  if (name === undefined || name === (cube.outside.terrain ?? 'default')) return cube;
  const t = cube.outside.terrains?.[name];
  if (!t) no(`terrain '${name}' is not one of ${cube.id}'s (terrains: ${geocubeTerrains(cube).map((x) => x.name).join(', ')})`);
  return { ...cube, id: `${cube.id}-${name}`, reads: t.reads ?? cube.reads, colour: { ...cube.colour, ...(t.colour ?? {}) },
    outside: { ...cube.outside, base: t.base ?? cube.outside.base, land: t.land ?? cube.outside.land, ...(t.relief !== undefined ? { relief: t.relief } : {}), ...(t.ground !== undefined ? { ground: t.ground } : {}),
      ...(t.tiers !== undefined ? { tiers: t.tiers } : {}), ...(t.island !== undefined ? { island: t.island } : {}), ...(t.crystals !== undefined ? { crystals: t.crystals } : {}) } };
}

/** The cube's interiors by name: its own room first. → [{ name, reads, own }]. */
export function geocubeInteriors(cube) {
  return [{ name: cube.inside.interior ?? 'room', reads: cube.reads ? `${cube.reads}, indoors` : 'indoors', own: true },
    ...Object.entries(cube.inside.interiors ?? {}).map(([name, r]) => ({ name, reads: r.reads ?? '', own: false }))];
}
// the cube as one of its interiors: the cube's own room, or an interior's changes over it
function onInterior(cube, name) {
  if (name === undefined || name === (cube.inside.interior ?? 'room')) return cube;
  const r = cube.inside.interiors?.[name];
  if (!r) no(`interior '${name}' is not one of ${cube.id}'s (interiors: ${geocubeInteriors(cube).map((x) => x.name).join(', ')})`);
  return { ...cube, id: `${cube.id}-${name}`, inside: { ...cube.inside, bones: r.bones ?? cube.inside.bones, size: r.size ?? cube.inside.size, accentWall: r.accentWall ?? cube.inside.accentWall } };
}

// the keys of a cube that are its style or its ingredients: never a domain's to change
const STYLE_WORDS = ['light', 'colour', 'palette', 'register', 'contrast', 'grit', 'surfaces', 'era', 'target', 'materials', 'why', 'avoid', 'buildings'];
/** A domain read against the cube: outside on one of its terrains (at an hour), or inside one of its interiors. */
function composeDomain(cube, d, at) {
  if (!isObj(d)) no(`${at} is { ${DOMAIN_KEYS.map((k) => `${k}?`).join(', ')} }: outside on a terrain (at an hour), or inside an interior`);
  for (const k of Object.keys(d)) {
    if (STYLE_WORDS.includes(k)) no(`${at}.${k}: a domain composes the cube's ingredients in the cube's one style; a different ${k} is a different cube ({ from: '${cube.id}', ${k}: … })`);
    if (k === 'inside' || k === 'outside') no(`${at}.${k}: a domain names the cube's own ${k === 'inside' ? 'interiors' : 'terrains'}; add one to the cube's ${k}.${k === 'inside' ? 'interiors' : 'terrains'}`);
    if (!DOMAIN_KEYS.includes(k)) no(`${at}.${k} is not a setting (${at}: ${DOMAIN_KEYS.join(', ')})`);
  }
  if (d.reads !== undefined && !(typeof d.reads === 'string' && d.reads.length <= 200)) no(`${at}.reads is a line (200 characters at most)`);
  if (d.terrain !== undefined && d.interior !== undefined) no(`${at}: a domain is outside on a terrain or inside an interior, not both`);
  if (d.interior !== undefined) {
    const I = geocubeInteriors(cube).find((r) => r.name === d.interior);
    if (!I) no(`${at}.interior '${d.interior}' is not one of ${cube.id}'s (interiors: ${geocubeInteriors(cube).map((r) => r.name).join(', ')})`);
    if (d.hour !== undefined) no(`${at}.hour is the outside's: an interior takes none`);
    if (d.structures !== undefined) no(`${at}.structures stand outside: an interior takes none`);
    if (d.settlement !== undefined) no(`${at}.settlement is a town outside: an interior takes none`);
    return { side: 'inside', interior: d.interior, reads: d.reads ?? I.reads };
  }
  const T = d.terrain === undefined ? geocubeTerrains(cube)[0] : geocubeTerrains(cube).find((t) => t.name === d.terrain);
  if (!T) no(`${at}.terrain '${d.terrain}' is not one of ${cube.id}'s (terrains: ${geocubeTerrains(cube).map((t) => t.name).join(', ')})`);
  if (d.hour !== undefined) { try { readHour(d.hour); } catch (e) { no(`${at}.${e.message}`); } }
  if (typeof d.structures === 'string' && !cube.structures?.[d.structures]) no(`${at}.structures '${d.structures}' is not one of ${cube.id}'s (structures: ${Object.keys(cube.structures ?? {}).join(', ') || 'none'}); or list them`);
  if (d.structures !== undefined && typeof d.structures !== 'string') structuresOrNo(d.structures, `${at}.structures`);
  if (typeof d.settlement === 'string' && !cube.settlements?.[d.settlement]) no(`${at}.settlement '${d.settlement}' is not one of ${cube.id}'s (settlements: ${Object.keys(cube.settlements ?? {}).join(', ') || 'none'}); or write it`);
  if (d.settlement !== undefined && typeof d.settlement !== 'string') settlementOrNo(d.settlement, `${at}.settlement`);
  return { side: 'outside', terrain: T.name, ...(d.hour !== undefined ? { hour: d.hour } : {}), ...(d.structures !== undefined ? { structures: d.structures } : {}),
    ...(d.settlement !== undefined ? { settlement: d.settlement } : {}), reads: d.reads ?? T.reads };
}
// a set of structures as a cube names them: a fractal structure's words each, standing `at` or `on` an anchor
function structuresOrNo(list, at) {
  if (!Array.isArray(list) || !list.length) no(`${at} is [<structure>…]: a fractal structure's words each, standing at [x, y, z?] or on: 'summit'`);
  list.forEach((sp, i) => {
    if (!isObj(sp)) no(`${at}[${i}] is a structure's words`);
    const { on, ...words } = sp;
    if (on !== undefined && !STRUCTURE_ON.includes(on)) no(`${at}[${i}].on is ${STRUCTURE_ON.map((w) => `'${w}'`).join(' or ')}: where on the land it stands`);
    if (on === undefined && words.at === undefined) no(`${at}[${i}] stands at [x, y, z?], or on: 'summit'`);
    if (on !== undefined && words.at !== undefined && !(Array.isArray(words.at) && words.at.length >= 2 && words.at.length <= 3 && words.at.every(Number.isFinite))) no(`${at}[${i}].at is an offset from its anchor, [dx, dy] or [dx, dy, dz]`);
    const errs = validateStructures([{ ...words, at: on === undefined ? words.at : [0, 0] }]);
    if (errs.length) no(`${at}[${i}]: ${errs.map((e) => e.replace(/^structures\[0\]\.?/, '')).join('; ')}`);
  });
}
// a settlement as a cube names it: a town plan and how much of its street stands and is walked into
function settlementOrNo(t, at) {
  if (!isObj(t)) no(`${at} is { ${SETTLEMENT_KEYS.map((k) => `${k}?`).join(', ')} }: a town plan and its street`);
  only(t, SETTLEMENT_KEYS, at);
  if (t.town !== undefined) { try { readTownPlan(t.town); } catch (e) { no(`${at}.${e.message}`); } }
  if (t.houses !== undefined && !(Number.isInteger(t.houses) && t.houses >= 1 && t.houses <= 12)) no(`${at}.houses is 1 to 12: how many of its street's houses stand`);
  if (t.enter !== undefined && !(Number.isInteger(t.enter) && t.enter >= 0 && t.enter <= 4)) no(`${at}.enter is 0 to 4: the houses walked into`);
  if (t.doors !== undefined && typeof t.doors !== 'boolean') no(`${at}.doors is false (every house walked into as terrain) or true`);
  if (t.anchor !== undefined && typeof t.anchor !== 'string') no(`${at}.anchor is the builders' language, an anchor structure's id`);
}
/** A domain's settlement as a stage's `town` (era/stage-buildings.js): its street, in the cube's builders' language unless it names its own. */
export function geocubeTown(cube, D) {
  if (!D || D.settlement === undefined) return null;
  const t = typeof D.settlement === 'string' ? cube.settlements[D.settlement] : D.settlement, anchor = t.anchor ?? cubeBuildings(cube)?.anchor;
  return { ...(anchor !== undefined ? { anchor } : {}), ...(t.houses !== undefined ? { houses: t.houses } : {}), ...(t.enter !== undefined ? { enter: t.enter } : {}),
    ...(t.doors !== undefined ? { doors: t.doors } : {}), ...(t.town !== undefined ? { recipe: t.town } : {}) };
}
/**
 * The levels the cube makes, by name: its `domains`, else one per terrain (outside, its own first) and one per interior
 * (inside). → [{ name, side, terrain? | interior?, hour?, reads }].
 */
export function geocubeDomains(cube) {
  if (cube.domains) return Object.entries(cube.domains).map(([name, d]) => ({ name, ...composeDomain(cube, d, `domains.${name}`) }));
  return [...geocubeTerrains(cube).map((t) => ({ name: t.name, side: 'outside', terrain: t.name, reads: t.reads })),
    ...geocubeInteriors(cube).map((r) => ({ name: r.name, side: 'inside', interior: r.name, reads: r.reads }))];
}
/**
 * Which domain a level gets: the one it asks for (`ask`: one of the cube's by name; { from: <name>, …changes }; or a
 * composition of the cube's own ingredients), else the first on the terrain its heartbeat was made for (`hint`), else
 * the cube's first (on `side` when named: a level's sections are outside). → { name (null: composed), from: 'level' |
 * 'heartbeat' | 'cube', offered, domain, changed?, wanted? }.
 */
export function pickDomain(cube, ask, hint, side) {
  const menu = geocubeDomains(cube), offered = menu.map((d) => d.name);
  const strip = ({ name: _n, ...d }) => d;
  if (ask === undefined || ask === null) {
    const h = hint ? menu.find((d) => d.side === 'outside' && d.terrain === hint) : undefined;
    if (h) return { name: h.name, from: 'heartbeat', offered, domain: strip(h) };
    const first = menu.find((d) => side === undefined || d.side === side);
    if (!first) no(`${cube.id} makes no level ${side}: its domains are ${offered.join(', ')}`);
    return { name: first.name, from: 'cube', offered, domain: strip(first), ...(hint ? { wanted: hint } : {}) };
  }
  if (typeof ask === 'string') {
    const d = menu.find((x) => x.name === ask);
    if (!d) no(`domain '${ask}' is not one of ${cube.id}'s (domains: ${offered.join(', ')}); or compose one of its ingredients ({ terrain?, hour? } or { interior })`);
    return { name: ask, from: 'level', offered, domain: strip(d) };
  }
  if (!isObj(ask)) no('domain is the name of one of the cube\'s domains, { from: <name>, …changes }, or a composition { terrain?, hour? } | { interior }');
  const { from, ...changes } = ask;
  let base = {};
  if (from !== undefined) {
    const d = menu.find((x) => x.name === from);
    if (!d) no(`domain.from '${from}' is not one of ${cube.id}'s (domains: ${offered.join(', ')})`);
    // what a domain was written as, its reads aside (a changed domain reads as its changes say, else as composed)
    const { name: _n, side: _s, reads: _r, ...was } = d;
    base = was;
  }
  // a change of side takes the other side's ingredients with it
  const d = { ...base, ...changes };
  if (changes.terrain !== undefined) delete d.interior;
  if (changes.interior !== undefined) { delete d.terrain; delete d.hour; }
  return { name: from ?? null, from: 'level', offered, domain: composeDomain(cube, d, 'domain'), ...(from !== undefined ? { changed: Object.keys(changes) } : {}) };
}
/** A recipe's `domain`: a name, { from, …changes } or a composition (pickDomain's ask), or { ask?, hint? }. */
export function readDomainAsk(cube, domain) {
  if (isObj(domain) && Object.keys(domain).every((k) => k === 'ask' || k === 'hint')) return pickDomain(cube, domain.ask, domain.hint);
  return pickDomain(cube, domain);
}
/**
 * The structures a stage's or a specimen's domain raises (the stage's land: a climb, or a domain standing alone), each
 * painted from the cube's ramps on the domain's terrain (its own palette over them) and placed: `at`, or `on` an anchor of
 * the climb's plan (`at` an offset from it). Lit by the cube's key at the domain's hour, as the structures channel's
 * light. → { list, light } | null (no domain, an inside one, one with none, or a trail).
 */
export function geocubeStructures(manifest) {
  const m = manifest ?? {}, spec = m.kind === 'geocube' ? m.cube : m.geocube;
  if (m.domain === undefined || spec === undefined || m.trail !== undefined) return null;
  const cube = readGeocube(spec), D = readDomainAsk(cube, m.domain).domain;
  if (D.side !== 'outside' || D.structures === undefined) return null;
  const list = typeof D.structures === 'string' ? cube.structures[D.structures] : D.structures;
  const hourAsked = m.hour ?? D.hour, H = hourAsked === undefined ? undefined : readHourOf(hourAsked);
  // where it stands: the climb as the stage plans it (a level's climb follows its trail: its kit and seed are the trail's)
  const low = m.kind === 'geocube' ? lowerGeocube(cube, 'outside', D.terrain, H) : withGeocube(m), M = low.meru === true ? {} : low.meru;
  const plan = planLocalMeru({ ...M, after: M.after ? { seed: Number.isFinite(low.seed) ? low.seed : 1, ...M.after } : null });
  const top = plan.tiers[plan.tiers.length - 1], anchors = { summit: [top.centre[0], top.centre[1], top.base + top.height] };
  const R = geocubeRamps(onTerrain(cube, D.terrain)), paint = { body: R.stone[2], band: R.trim[1], crown: R.accent[3], plinth: R.floor[1] };
  const placed = list.map(({ on, ...words }) => {
    const a = on === undefined ? null : anchors[on], d = words.at ?? [0, 0];
    return { ...words, at: a ? [a[0] + d[0], a[1] + d[1], a[2] + (d[2] ?? 0)] : words.at, palette: { ...paint, ...(words.palette ?? {}) } };
  });
  // the cube's key (the hour's, or its sun, or its moon), as the structures' light: the channel's own ambient and fill
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], key = H !== undefined ? hourLight(cube, H).key : ref.light.key ?? cube.light.moon;
  const toKey = sunDir(key.elevation, key.azimuth ?? 225);
  return { list: placed, light: makeLight({ direction: toKey.map((v) => -v), ambient: 0.5, diffuse: 0.55, fill: { diffuse: 0.16 } }) };
}
/** Domain expansion: the domain a level asks for (pickDomain), lowered. → { manifest: a stage manifest, pick }. */
export function expandGeocube(cube, ask, hint) {
  const pick = pickDomain(cube, ask, hint), D = pick.domain;
  const manifest = D.side === 'inside' ? lowerGeocube(cube, 'inside', D.interior) : lowerGeocube(cube, 'outside', D.terrain, D.hour === undefined ? undefined : readHourOf(D.hour));
  return { manifest, pick };
}

function lowerOutside(cube0, terrain, hour, clouds) {
  const cube = onTerrain(cube0, terrain);
  const base = cube.outside.base, card = ISEKAI_STYLES[base], sw = SWATCHES[base], land0 = sw.land;
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], shadow = shadeHue(cube);
  const fit = (hex, name) => resample(rampFrom(rgbOf(hex), 7, { shadow }), land0[name].length);
  // at an hour, its light (geocube-hours.js), under clouds (matte-paint/sky.js) at the reference's own hour if it
  // names none; absent both, the cube's own, as it always was
  if (hour !== undefined || clouds !== undefined) return outsideAt(cube, hour ?? referenceHour(ref), clouds, { base, card, sw, land0, fit, shadow });
  // the sky: the cube's own (a solved cube's is its palette's), else the reference's dome
  const S = cube.light.sky, dome = S ? { zenith: rgbOf(S.zenith), horizon: rgbOf(S.horizon) } : ref.air.dome, sky = [dome.zenith, dome.zenith.map((v, k) => (v + dome.horizon[k]) / 2), dome.horizon].map((c) => c.map(Math.round));
  const land = { ...land0, rock: fit(cube.colour.stone, 'rock'), soil: fit(cube.colour.floor, 'soil'), grass: fit(cube.colour.grass, 'grass'),
    foliage: fit(cube.colour.foliage, 'foliage'), far: resample(sky.slice(1).concat([dome.horizon]), land0.far.length), sky: resample(sky, land0.sky.length),
    ...(cube.colour.sand ? { sand: resample(rampFrom(rgbOf(cube.colour.sand), 7, { shadow }), land0.soil.length) } : {}) };
  const key = ref.light.key ? { color: ref.light.key.color, elevation: ref.light.key.elevation, azimuth: ref.light.key.azimuth ?? 225 } : { color: cube.light.moon.color, elevation: cube.light.moon.elevation, azimuth: cube.light.moon.azimuth };
  const light = { ...card.light, key, ambient: ref.light.ambient, ...(ref.light.key ? {} : { sunGain: cube.light.moon.gain }) };
  const air = { ...card.air, fog: { color: S?.fog ?? ref.air.fog.color, density: +(ref.air.fog.density * cube.light.outsideFog).toFixed(5) } };
  const lookCard = { ...card, palette: land, light, air, water: { fill: geocubeRamps(cube).water[2] }, principles: cube.why };
  return outsideOf(cube, base, sw, land, lookCard);
}

/**
 * The outside at an hour: the land's ramps the cube's own (the bake relights them), the sky and the far layers the
 * hour's dome, the key the hour's sun or the moon at its gain, the ambient and the fog's colour the hour's (its density
 * the cube's), the water darkened into the night. A moonlit hour draws the card's night: the moon where the key is, the
 * stars out as far as the night has come.
 */
function outsideAt(cube, hour, clouds, { base, card, sw, land0, fit, shadow }) {
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], H = hourLight(cube, hour), dome = H.dome;
  const sky = [dome.zenith, dome.zenith.map((v, k) => (v + dome.horizon[k]) / 2), dome.horizon].map((c) => c.map(Math.round));
  const land = { ...land0, rock: fit(cube.colour.stone, 'rock'), soil: fit(cube.colour.floor, 'soil'), grass: fit(cube.colour.grass, 'grass'),
    foliage: fit(cube.colour.foliage, 'foliage'), far: resample(sky.slice(1).concat([dome.horizon]), land0.far.length), sky: resample(sky, land0.sky.length),
    ...(cube.colour.sand ? { sand: resample(rampFrom(rgbOf(cube.colour.sand), 7, { shadow }), land0.soil.length) } : {}) };
  // clouds lean the light: under cloud the key weakens, the shade fills toward the sky's grey, the air thickens and
  // greys, and the sun's disc is gone. Clouds that follow a live weather lean only the disc: the live channel carries
  // the air (weather/weather.js)
  const W0 = clouds ? WEATHERS[clouds.kind].light : null, Wl = !W0 ? { gain: 1, ambient: 0, fog: 1, disc: true } : clouds.live ? { gain: 1, ambient: 0, fog: 1, disc: W0.disc } : W0;
  const grey = (() => { const m = dome.zenith.map((v, k) => (v + dome.horizon[k]) / 2), y = (m[0] + m[1] + m[2]) / 3; return m.map((v) => (v + 2 * y) / 3); })();
  const lean = (hex, t) => (t ? hexOf(rgbOf(hex).map((v, k) => v + (grey[k] - v) * t)) : hex);
  const moonGain = cube.light.moon?.gain ?? 0.8;
  const light = { ...card.light, key: H.key, ambient: lean(H.ambient, Wl.ambient), sunGain: Math.round((H.moonlit ? moonGain : card.light.sunGain) * H.gainK * Wl.gain * 1000) / 1000 };
  const air = { ...card.air, fog: { color: lean(H.fog, Wl.ambient), density: +(ref.air.fog.density * cube.light.outsideFog * Wl.fog).toFixed(5) } };
  const water = geocubeRamps(H.water ? { ...cube, colour: { ...cube.colour, water: H.water } } : cube).water[2];
  const night = H.moonlit ? { night: { day: Math.round(Math.min(1, Math.max(0, 1.25 * (1 - H.night))) * 1000) / 1000, stars: 1, moon: { phase: 0.62, size: 1.3 } } } : {};
  // the cloud band the dome draws: the sky's sheets in the hour's light
  const band = clouds ? { cloudBand: { clouds: { kind: clouds.kind, cover: clouds.cover, seed: clouds.seed }, sun: sunDir(H.key.elevation, H.key.azimuth).map((v) => Math.round(v * 1e5) / 1e5), key: H.key.color, zenith: dome.zenith, horizon: dome.horizon, night: H.night } } : {};
  const { sun: disc, ...rest } = card;
  const lookCard = { ...rest, ...(Wl.disc && disc ? { sun: disc } : {}), palette: land, light, air, water: { fill: water }, principles: cube.why, hour: H.hour, ...night, ...band };
  return outsideOf(cube, base, sw, land, lookCard);
}

function outsideOf(cube, base, sw, land, lookCard) {
  // the look's id carries its content's print, so a cube's changes register a new look and a re-read the same one
  const id = `geocube-${cube.id}-${fingerprint([base, lookCard]).slice(0, 6)}`;
  registerLook({ id, base, read: cube.reads || cube.title, card: lookCard, swatches: { ...sw, land } });
  // a cube with contrast owns the crease and the ridge (vertex-contrast.js); the land keeps its blend, smoothing and sun
  const L = cube.outside.land, own = readContrast(cube.contrast) ? { crevice: 0, ridge: 0 } : {}, R = cube.outside.relief, G = cube.outside.ground, X = cube.outside.crystals;
  return { kind: 'stage', kit: id, meru: { tiers: cube.outside.tiers, island: cube.outside.island,
    ...(L === false ? {} : { shading: { ...L, shade: shadeHex(shadeHue(cube)), ...own, ...(cube.grit !== undefined ? { grit: cube.grit } : {}) } }), ...(R !== undefined && R !== false ? { relief: R } : {}),
    ...(G !== undefined && G !== false ? { ground: G } : {}), ...(X !== undefined && X !== false ? { crystals: X } : {}) } };
}

/**
 * The cube's `contrast` resolved against its own light and colour, as a world payload carries it (`vertexContrast`):
 * the terms, and the colours they lean to (the cube's sky, else the reference's; the side's ground, the cube's shade, the key: the sun, or
 * the moon with none), the key's direction, a seed from the cube's id, and the mode (`value` under a tone: only value
 * moves). null when the cube has none. `side`: 'inside' (the ground is the floor) or 'outside' (the grass).
 */
export function cubeContrast(cube, side, { terrain, value = false, hour } = {}) {
  const C = readContrast(cube.contrast);
  if (!C) return null;
  const k = side === 'outside' && terrain !== undefined ? onTerrain(cube, terrain) : cube;
  // the sky: the cube's own (a solved palette's), else the reference's dome; at an hour (the outside's), the hour's
  const ref = SIXTH_GEN_REFERENCES[resolveLook(k.light.reference)], sun = ref.light.key, H = side === 'outside' && hour !== undefined ? hourLight(k, hour) : null;
  const dome = H ? H.dome : k.light.sky ? { zenith: rgbOf(k.light.sky.zenith), horizon: rgbOf(k.light.sky.horizon) } : ref.air.dome;
  const lit = H ? H.key : sun ?? k.light.moon;
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
  // a hero on a cube whose contrast names `metal`: its metal alone takes the cube's occlusion (`only: 'metal'`); the rest
  // of it is lit by the cube's cast light, as before (era/cast-light.js)
  if (m.kind === 'layered') {
    if (!m.hero?.geocube) return null;
    const cube = readGeocube(m.hero.geocube), C = readContrast(cube.contrast);
    return C && C.metal > 0 ? { ...cubeContrast(cube, 'outside', { value }), only: 'metal' } : null;
  }
  const spec = m.kind === 'geocube' ? m.cube : m.kind === 'city' ? m.paint?.geocube : m.geocube;
  if (spec === undefined || spec === null) return null;
  const cube = readGeocube(spec);
  if (!readContrast(cube.contrast)) return null;
  // a stage's or a specimen's domain says its side, its terrain and its hour (the recipe's own hour over it)
  const D = (m.kind === 'stage' || m.kind === 'geocube') && m.domain !== undefined ? readDomainAsk(cube, m.domain).domain : null;
  const side = D ? D.side : m.kind === 'geocube' ? (m.show === 'land' ? 'outside' : 'inside') : m.kind === 'city' || m.meru !== undefined || m.trail !== undefined ? 'outside' : 'inside';
  const terrain = D ? D.terrain : side === 'outside' && m.kind === 'stage' && m.terrain !== undefined ? readTerrainAsk(cube, m.terrain).name : undefined;
  const hour = m.hour ?? D?.hour;
  return cubeContrast(cube, side, { terrain, value, ...(hour !== undefined && side === 'outside' ? { hour: readHour(hour) } : {}) });
}

const readHourOf = (v) => { try { return readHour(v); } catch (err) { return no(err.message); } };
const readCloudsOf = (v) => { try { return readClouds(v); } catch (err) { return no(err.message); } };
// a recipe's clouds: a sky of its own, or 'weather', the sky its live weather state is painted under (opt-in: a level
// minted with a weather keeps its bare dome)
function cloudsOf(clouds, weather) {
  if (clouds === undefined) return undefined;
  if (clouds !== 'weather') return readCloudsOf(clouds);
  if (typeof weather !== 'string' || !CLOUDS_OF_WEATHER[weather]) no(`clouds 'weather' paints the sky of the recipe's weather state (${Object.keys(CLOUDS_OF_WEATHER).join(', ')}); ${weather === undefined ? 'it names none' : 'a climate turns on the page: name its clouds'}`);
  return { kind: CLOUDS_OF_WEATHER[weather], cover: 0.5, seed: 1, live: true };
}

/** The cube lowered into one side: 'inside' (the bare room, in one of its interiors) or 'outside' (the landform, on one
 * of its terrains, under its clouds). `place` names the interior or the terrain; absent, the cube's own. */
export function lowerGeocube(cube, side, place, hour, clouds) {
  if (side === 'inside') return lowerInside(onInterior(cube, place));
  if (side === 'outside') return lowerOutside(cube, place, hour, clouds);
  return no(`side is 'inside' or 'outside', not '${side}'`);
}

/**
 * A stage recipe's `geocube`: the cube lowered under the recipe's own keys, which win. With `meru` it is the outside
 * (the look card, the land's ramps, light and air, the polygon land; the recipe's `meru` keys over the cube's); without,
 * the inside (the bones, reference, tone and tiles; the recipe's rooms, and the kit's dress unless the recipe says).
 */
export function withGeocube(manifest) {
  const { geocube, terrain, domain, hour, clouds, ...m } = manifest, cube = readGeocube(geocube);
  // `domain`: one of the levels the cube makes (or one composed of its ingredients), expanded: its terrain and hour on
  // the outside (a stage that names neither trail nor meru stands on the cube's island), or its interior
  if (domain !== undefined && terrain !== undefined) no('domain or terrain, not both: a domain names its terrain');
  const D = domain === undefined ? undefined : readDomainAsk(cube, domain).domain;
  if (D?.side === 'inside' && (m.meru !== undefined || m.trail !== undefined)) no(`the domain is inside (interior '${D.interior}'): a stage with ${m.meru !== undefined ? 'meru' : 'a trail'} is outside, so ask an outside domain`);
  // standing alone: a domain with a town walks a trail through its street; any other, the cube's island
  if (D?.side === 'outside' && m.meru === undefined && m.trail === undefined) {
    if (D.settlement !== undefined) { m.trail = {}; m.town ??= geocubeTown(cube, D); } else m.meru = true;
  }
  const T = D ? (D.side === 'outside' ? { name: D.terrain } : undefined) : terrain === undefined ? undefined : readTerrainAsk(cube, terrain);
  // `hour` (geocube-hours.js): the outside lit at that hour, its sky and air the hour's; the recipe's own over its
  // domain's. `clouds` (matte-paint/sky.js): painted round the dome
  const H = hour !== undefined ? readHourOf(hour) : D?.hour !== undefined ? readHourOf(D.hour) : undefined, Wr = cloudsOf(clouds, m.weather);
  // a trail: the cube paints it once, the outside's look on its open ground; the recipe's own kit, if it names one,
  // wins (a painted level is a starting point, not a lock)
  if (m.trail !== undefined) {
    if ((H !== undefined || clouds !== undefined) && m.kit !== undefined) no(`${H !== undefined ? 'hour' : 'clouds'} lights the cube's look; a trail in its own kit takes none (drop kit, or hour and clouds)`);
    const low = lowerGeocube(cube, 'outside', T?.name, H, m.kit === undefined ? Wr : undefined);
    return { ...m, kit: m.kit ?? low.kit };
  }
  if (m.meru !== undefined) {
    const low = lowerGeocube(cube, 'outside', T?.name, H, Wr);
    if (m.kit !== undefined) no('a stage on a geocube takes its kit from the cube; drop kit');
    // a climb that names its own preset or tiers keeps them; the cube's tiers stand where it names none. A climb that
    // follows a trail stands on it, not on the cube's island
    const own = m.meru === true ? {} : m.meru, { tiers: cubeTiers, island: cubeIsland, ...rest } = low.meru;
    const lowMeru = { ...(own.after ? {} : { island: cubeIsland }), ...rest };
    return { ...low, ...m, kit: low.kit, meru: { ...lowMeru, ...(T && (own.preset !== undefined || own.tiers !== undefined) ? {} : { tiers: cubeTiers }), ...own } };
  }
  if (T) no('terrain is the outside\'s: a stage on a geocube takes it with trail or meru');
  if (H !== undefined) no('hour is the outside\'s: a stage on a geocube takes it with trail or meru');
  if (clouds !== undefined) no('clouds are the outside\'s: a stage on a geocube takes them with trail or meru');
  const { dress: _d, rooms, ...low } = lowerGeocube(cube, 'inside', D?.interior);
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
/** What a stage painted by a cube got: the cube, the terrain (or the domain), from whom, and what the cube offered. */
export function geocubePaint(manifest) {
  const cube = readGeocube(manifest.geocube);
  if (manifest.domain !== undefined) {
    const P = readDomainAsk(cube, manifest.domain), D = P.domain, hour = manifest.hour ?? D.hour;
    return { geocube: cube.id, ...(cube.palette?.id ? { palette: cube.palette.id } : {}), domain: P.name, from: P.from, offered: P.offered, ...(P.changed ? { changed: P.changed } : {}), ...(P.wanted ? { wanted: P.wanted } : {}),
      ...(D.side === 'outside' ? { terrain: D.terrain, ...(hour !== undefined ? { hour } : {}) } : { interior: D.interior }), reads: D.reads,
      ...(D.structures !== undefined ? { structures: typeof D.structures === 'string' ? D.structures : 'written' } : {}),
      ...(D.settlement !== undefined ? { settlement: typeof D.settlement === 'string' ? D.settlement : 'written' } : {}),
      ...(manifest.kit !== undefined && manifest.trail !== undefined ? { kit: manifest.kit, note: 'the recipe\'s own kit over the cube\'s paint' } : {}),
      ...(cube.avoid ? { avoid: cube.avoid.map(({ law, ok }) => ({ law, ok })) } : {}) };
  }
  const T = manifest.terrain === undefined ? pickTerrain(cube) : readTerrainAsk(cube, manifest.terrain);
  return { geocube: cube.id, ...(cube.palette?.id ? { palette: cube.palette.id } : {}), terrain: T.name, from: T.from, offered: T.offered, ...(T.wanted ? { wanted: T.wanted } : {}), ...(manifest.kit !== undefined && manifest.trail !== undefined ? { kit: manifest.kit, note: 'the recipe\'s own kit over the cube\'s paint' } : {}),
    ...(cube.avoid ? { avoid: cube.avoid.map(({ law, ok }) => ({ law, ok })) } : {}) };
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
  for (const k of Object.keys(manifest)) if (!['kind', 'cube', 'show', 'title', 'walk', 'hour', 'clouds', 'weather', 'domain'].includes(k)) no(`'${k}' is not a setting of the geocube kind (cube, show, hour, clouds, weather, domain); build a level on a cube with a stage recipe's geocube`);
  const cube = readGeocube(manifest.cube ?? no('cube is a preset id or a document'));
  // a domain shows the level it makes: its room or its land, at its hour unless the recipe names one
  const P = manifest.domain === undefined ? null : readDomainAsk(cube, manifest.domain), D = P?.domain;
  const own = D ? (D.side === 'inside' ? 'room' : 'land') : null;
  if (own && manifest.show !== undefined && manifest.show !== own) no(`the domain is ${own === 'room' ? 'inside' : 'outside'}: show '${own}' (or leave show out)`);
  const show = own ?? manifest.show ?? 'room';
  if (!SHOW.includes(show)) no(`show is ${SHOW.map((s) => `'${s}'`).join(' or ')}`);
  for (const k of ['hour', 'clouds']) if (manifest[k] !== undefined && show !== 'land') no(`${k} ${k === 'hour' ? 'is' : 'are'} the land's: show 'land' to see the cube under ${k === 'hour' ? 'it' : 'them'}`);
  const hour = manifest.hour ?? D?.hour;
  const title = ctx.title || `${cube.title} · ${P ? P.name ?? 'composed' : show === 'room' ? 'room' : 'landform'}`;
  const low0 = lowerGeocube(cube, show === 'room' ? 'inside' : 'outside', D ? D.interior ?? D.terrain : undefined, hour === undefined ? undefined : readHourOf(hour),
    show === 'land' ? cloudsOf(manifest.clouds, manifest.weather) : undefined);
  // a domain with a town shows its street, on a trail in the land's look
  const town = geocubeTown(cube, D), low = town ? { kind: 'stage', kit: low0.kit, trail: {}, town } : low0;
  const payload = assemble({ ...low, ...(manifest.walk !== undefined ? { walk: manifest.walk } : {}) }, { ...ctx, title });
  if (show === 'room') withAccent(payload, onInterior(cube, D?.interior).inside.accentWall, cube.surfaces.accent);
  else withIslandCamera(payload);
  // the levels it makes: read out where it names more than its own room and land, or a domain was asked for
  const menu = P || cube.domains || cube.outside.terrains || cube.inside.interiors ? geocubeDomains(cube).map(({ name, side, reads }) => ({ name, side, reads })) : null;
  payload.geocube = { id: cube.id, title: cube.title, reads: cube.reads, show, why: cube.why, ramps: geocubeRamps(cube), era: cube.era, density: geocubeDensity(cube),
    ...(cube.palette?.id ? { palette: { id: cube.palette.id, reads: cube.palette.reads } } : {}), ...(cube.light.sky ? { sky: cube.light.sky } : {}),
    ...(readContrast(cube.contrast) ? { contrast: readContrast(cube.contrast) } : {}), ...(cube.avoid ? { avoid: cube.avoid } : {}),
    ...(menu ? { domains: menu } : {}), ...(P ? { domain: { name: P.name, from: P.from, ...D, ...(manifest.hour !== undefined ? { hour: manifest.hour } : {}), ...(P.changed ? { changed: P.changed } : {}) } } : {}) };
  return payload;
}
