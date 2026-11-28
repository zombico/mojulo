/**
 * THE BATTLEFIELD CUBES — the geocubes a frame's fields are cut from (Mech Battle Kai's lands, and any frame level's):
 * sandstone country at a mech's scale, pure terrain. There is no trail and no seam: the floor a frame skates on is the
 * land itself, read off its radar and its beacons, so each cube's outside is a field (an open island nobody walks onto)
 * with its standing rock as its own words (local-meru/massif.js). Cliffs, gorges, rock, scree and water are the
 * elements; buildings come after.
 *
 *   FIELD_GEOCUBES            the cubes (era/geocube.js GEOCUBE_PRESETS carries them): sandstone-wadi, sandstone-gorge,
 *                             scree-scarp, crater-plain, wadi-oasis, the works' halls, and the space ground's belt-asteroid
 *   FIELD_GEOCUBE_PALETTES    each one's palette spec (a seeded variant is solved from it)
 *   FIELD_GEOCUBE_BUILDINGS   the outposts each plausibly has (a recommendation, never a placement)
 *   FIELD_ROCK                each field's rock colour by its column (form/rock-colour.js, a geocube's `outside.rock`)
 *   FIELD_OUTSIDE(massif, { rock?, dry? }) → a field's outside: the island at a frame's scale, its floor a sand plain rolled by the
 *                             wind, the massif's card on it, its rock's colour (assault-frame/field.js reads the same)
 *
 * The scale (a frame is 7.5 to 9 m tall, it boosts and climbs): its square some 800 m a side; walls 40 to 120 m, high
 * enough to climb over on the booster and tall enough to break a lock; gorges 25 to 200 m across, a siq a frame threads
 * at a skate and a canyon it fights down; talus aprons 10 to 40 m out; fallen blocks 3 to 7 m, cover a frame crouches
 * behind; water a sheet the suits hover over (nobody fights under it).
 */
const f = Object.freeze;

// (the island a field is grown from: its land in 4 m quads, its rim raised all round so its sea is never seen; open, its
// ground rolling right round with no trail's apron; its sea line 2.1 m under the floor, so a hollow carved deeper is water)
// (no geology: the massif is the rock, and the joints would break the floor's own dunes into rock)
// (its rim a low far rise, not a wall: the skyline is the massif's horizon, its escarpments round the field)
const ISLAND = f({ geology: false, walk: 'none', open: true, seabed: 'merged', cell: 4, scale: 3, cover: 'soil', beach: 10, sea: 2.1, depth: 9, shore: 600, high: f({ height: 12, span: 360 }) });
// (a dry field's sea far under its floor: a crater's bowl or a wash cut deep never fills; its rim still hides it)
const DRY_ISLAND = f({ ...ISLAND, sea: 60 });
// (a local meru stands on a tier: a low swell at the middle, under the floor's own roll)
const SWELL = f([f({ form: 'mound', height: 1.5, foot: 24, summit: 10, profile: 0.6 })]);
const LAND = f({ smooth: true, crevice: 0.6, ridge: 0.35, blend: 0.6 });

// THE ROCK'S COLOUR (form/rock-colour.js) by each field's column: a dark plinth, the massive red wall, a lighter band, the
// pale upper beds weathered toward the cube's trim (Wadi Rum's Disi over its Umm Ishrin); each thin bed its own tone;
// the varnish streaked down the walls, some walls clean
const VARNISH = f({ strength: 0.8, width: 18, mask: 160 }), THIN = f({ beds: f([4, 9]), jitter: 0.07 });
// (worn by its own shape: its edges lifted, its creases darkened; and in sections, each block of a wall its own mood)
const WEAR = f({ edge: 0.22, crease: 0.3, reach: 1.6 }), SECTIONS = f({ size: 36, value: 0.09, hue: 0.18 });
export const FIELD_ROCK = f({
  wadi: f({ beds: f([f({ to: 8, value: -0.14 }), f({ to: 54 }), f({ to: 84, toward: 'floor', mix: 0.3, value: 0.04 }), f({ to: 2000, toward: 'trim', mix: 0.5, value: 0.06 })]), blend: 3, thin: THIN, wear: WEAR, sections: SECTIONS, varnish: VARNISH }),
  gorge: f({ beds: f([f({ to: 6, value: -0.16 }), f({ to: 46 }), f({ to: 64, toward: 'floor', mix: 0.3, value: 0.04 }), f({ to: 2000, toward: 'trim', mix: 0.55, value: 0.05 })]), blend: 2.5, thin: THIN, wear: WEAR, sections: SECTIONS, varnish: f({ ...VARNISH, strength: 0.8 }) }),
  craters: f({ beds: f([f({ to: 6, value: -0.12 }), f({ to: 30 }), f({ to: 2000, toward: 'trim', mix: 0.35, value: 0.04 })]), blend: 3, thin: THIN, wear: WEAR, sections: f({ ...SECTIONS, size: 28 }), varnish: f({ ...VARNISH, strength: 0.6 }) }),
  scree: f({ beds: f([f({ to: 14, toward: 'floor', mix: 0.2, value: -0.1 }), f({ to: 62 }), f({ to: 2000, toward: 'trim', mix: 0.4, value: 0.04 })]), blend: 4, thin: f({ beds: f([6, 14]), jitter: 0.09 }), wear: f({ ...WEAR, edge: 0.28 }), sections: f({ ...SECTIONS, size: 24, value: 0.12 }), varnish: f({ ...VARNISH, strength: 0.5 }) }),
});

/** A field's outside: the island, the swell, the sand floor rolled by the wind, the massif's card on it and its rock's colour. */
export const FIELD_OUTSIDE = (massif, { rock = FIELD_ROCK[massif] ?? FIELD_ROCK.wadi, seed = massif, dry = false } = {}) => f({
  base: 'airless-plain', tiers: SWELL, island: dry ? DRY_ISLAND : ISLAND, land: LAND,
  ground: f({ from: f({ heartbeat: 'gentle-pulse', splatch: 'bone-trio', seed }), span: 1800, height: 7 }),
  // (the floor's dunes long and low at a frame's scale: a skate over them, never a climb)
  relief: f({ from: 'dune', height: 2.5, scale: 90, finest: 8 }), massif, rock,
  // (a kilometre of the same rock and sand: its tiles never repeating in a grid)
  tiling: 'stochastic',
  // (the ground in front of a frame at its scale: rubble to its knee, half a metre to two and a half across, on the
  // talus, in the washes and the scree's patches)
  rubble: f({ sizes: f([0.4, 1.8]), density: 0.16 }),
});

// (no inside of its own worth naming: an outpost's research rooms and its panelled walls, Sol's)
const PANEL = f({ gen: 'stone-brick', stone: [150, 150, 150], mortar: [96, 96, 96], rows: 3, cols: 2, mortarThick: 0.06, vary: 10, grain: 5, bevel: 0.15, accent: 0.1, accentDark: 30, accentLight: 20, seed: 13 });
const DECK = f({ gen: 'flagstone', stone: [140, 140, 140], mortar: [70, 70, 70], gravel: [100, 100, 100], cells: 4, mortarThick: 0.04, wobble: 0.6, vary: 10, grain: 5, lost: 0, cracked: 0.05, seed: 17 });
const SURFACES = f({ wall: PANEL, floor: DECK, accent: f({ gen: 'rock', style: 'cave', base: [170, 170, 170], seed: 1 }) });
const INSIDE = f({ bones: 'research-lab', size: f([12, 12, 7]), accentWall: '+y' });
// (a clear desert day: a hard high sun, a deep sky paling to a dusty horizon; the air clear enough that a wall 400 m off
// keeps its colour, the far walls only going pale into the dust)
const DESERT_SKY = f({ zenith: '#3f78c0', horizon: '#d6e2ea', fog: '#e2d6c4' });
// (the outside's card is the airless plain's, bare rock and no grass; its void dropped for the air of a world with weather)
const DESERT = (fog = 0.25) => f({ reference: 'island-noon', outsideFog: fog, sun: f({ color: '#fff4e2' }), sky: DESERT_SKY, heavens: f({ void: false, disc: f({ size: 1, glow: 1.1 }) }) });
// (the sandstone: red-brown walls, a paler upper rock, an orange-pink floor; shade a cool blue, never black)
const SANDSTONE = f({ stone: '#a4573a', floor: '#cf8a5c', trim: '#e6c8a0', accent: '#2f7fd0', grass: '#b88454', foliage: '#76703e', water: '#3c7f98', sand: '#d99c68', shade: 218 });

const WHY = f([
  'The rock is the subject: sheer walls banded by their beds, the same beds at the same heights on every block, so the country reads as one rock cut apart.',
  'A hard high sun: the lit walls warm and bright, the shade under them a cool blue a frame can still be read in.',
  'The floor is open sand, the place to skate and fight; the rock is cover, height and a wall to climb.',
  'Talus at every foot, at its repose, its fallen blocks the cover a frame crouches behind.',
]);

// THE WORKS' FIELDS: an industrial interior at a frame's scale, no sky (form/interior-light.js), its floor the land dressed
// in the works' materials (form/land-materials.js), its hall and machines the works (local-meru/works.js)
const FLAT = f({ from: 'rolling', height: 0.6, scale: 60, finest: 6 });
export const WORKS_OUTSIDE = (works, massif = works, materials = 'foundry', rock = SOOT) => f({
  base: 'airless-plain', tiers: SWELL, island: DRY_ISLAND, land: LAND, relief: FLAT, massif, works, materials, rock, tiling: 'stochastic',
  // (its rubble the slag's: lumps a frame kicks through)
  rubble: f({ sizes: f([0.3, 1.1]), density: 0.12 }),
});
// (the steel blackened low by the soot of the floor's traffic, panels of their own tone, rust run down from the seams)
const SOOT = f({ beds: f([f({ to: 5, value: -0.3 }), f({ to: 14, value: -0.12 }), f({ to: 2000 })]), blend: 3, thin: false, wear: f({ edge: 0.25, crease: 0.35, reach: 1 }), sections: f({ size: 14, value: 0.1, hue: 0.12, toward: 'sand' }), varnish: f({ strength: 0.6, width: 8, mask: 90 }) });
const HALL_LIGHT = (lamps, glow, haze, sky = DESERT_SKY) => f({ reference: 'island-noon', outsideFog: 0.3, sun: f({ color: lamps }), sky,
  interior: f({ void: '#0b0908', haze: f({ colour: haze, density: 0.0016 }), lamps: f({ colour: lamps, power: 1.2, spacing: 88, height: 70 }), glow: f({ colour: glow, power: 1.5 }) }) });

// THE SPACE GROUND: a rock in the belt, airless, played at the space ground's gravity (assault-frame/pilot.js
// FRAME_GRAVITY.space). Its sky black with the stars out at noon, the Sun small and hard at the belt's distance (about
// two and three quarter times ours: a third of its width), a neighbouring rock of the same cluster hanging in it
const BELT_SKY = f({ zenith: '#010102', horizon: '#04050a', fog: '#08090c' });
const BELT = f({ reference: 'gothic-night', moon: f({ color: '#fff8ee', elevation: 30, azimuth: 235, gain: 1.75 }), outsideFog: 0.04, sky: BELT_SKY,
  heavens: f({ void: f({ stars: 1, glow: 0.35 }), disc: f({ size: 0.45, glow: 0.6 }), companion: f({ azimuth: 150, elevation: 26, size: 2.4, phase: 0.55, color: '#5c564e' }) }) });
// (a dark carbonaceous rock: charcoal regolith, its fresh crater walls a shade paler, no varnish where nothing weathers)
const REGOLITH = f({ stone: '#3e3a36', floor: '#55504a', trim: '#7a736a', accent: '#d07a2a', grass: '#605a52', foliage: '#47423c', water: '#55504a', sand: '#6a645c', shade: 220 });
const BELT_ROCK = f({ beds: f([f({ to: 6, value: -0.1 }), f({ to: 40 }), f({ to: 2000, toward: 'trim', mix: 0.3, value: 0.05 })]), blend: 3, thin: false, wear: f({ edge: 0.3, crease: 0.35, reach: 1.4 }), sections: f({ size: 30, value: 0.08, hue: 0.06 }) });
// (no wind has ever moved it: its floor broken and rolling, never dunes)
const BROKEN = f({ from: 'rolling', height: 3.5, scale: 70, finest: 6 });

export const FIELD_GEOCUBES = f({
  'sandstone-wadi': f({
    id: 'sandstone-wadi', title: 'Sandstone wadi', reads: 'Sheer red sandstone jebels round an open sand floor, a siq between two, under a hard desert sun',
    light: DESERT(), colour: SANDSTONE, register: f({ steps: 0, key: 0.55 }), surfaces: SURFACES, inside: INSIDE,
    outside: FIELD_OUTSIDE('wadi', { dry: true }), wind: f({ speed: 5, dir: 240 }), why: WHY,
  }),
  'sandstone-gorge': f({
    id: 'sandstone-gorge', title: 'Sandstone gorge', reads: 'A winding canyon cut through a sandstone plateau, side canyons into it, a river on its floor',
    light: DESERT(0.28), colour: f({ ...SANDSTONE, stone: '#9a5236', floor: '#c48256' }), register: f({ steps: 0, key: 0.52 }), surfaces: SURFACES, inside: INSIDE,
    outside: FIELD_OUTSIDE('gorge'), wind: f({ speed: 4, dir: 200 }),
    why: f([...WHY.slice(0, 2), 'The canyon is the field: its floor to fight down, its walls to climb, its rim to look over; the river a sheet the suits hover over.']),
  }),
  'scree-scarp': f({
    id: 'scree-scarp', title: 'Scree scarp', reads: 'A long scarp over a broad apron of scree fans and fallen blocks, low buttes out on a broken floor',
    light: DESERT(0.32), colour: f({ ...SANDSTONE, stone: '#8e5a40', floor: '#b88a64', sand: '#c99a70' }), register: f({ steps: 0, key: 0.5 }), surfaces: SURFACES, inside: INSIDE,
    outside: FIELD_OUTSIDE('scree', { dry: true }), wind: f({ speed: 6, dir: 260 }),
    why: f([WHY[0], WHY[1], 'The scarp sheds its rock: the fans run out from its foot and the blocks lie where they fell, broken ground and cover all the way across.']),
  }),
  'crater-plain': f({
    id: 'crater-plain', title: 'Crater plain', reads: 'A stony desert plain struck all over by meteorites, craters of every size, low buttes standing out',
    light: DESERT(0.27), colour: f({ ...SANDSTONE, stone: '#86503a', floor: '#bd8a60', sand: '#cc9a6c' }), register: f({ steps: 0, key: 0.52 }), surfaces: SURFACES, inside: INSIDE,
    outside: FIELD_OUTSIDE('craters', { dry: true }), wind: f({ speed: 5, dir: 250 }),
    why: f([WHY[1], 'The craters are the ground: bowls to drop into and fight across, their rims cover, the great one a field of its own.', 'Young craters sharp and strewn with their thrown blocks; old ones worn shallow and filled with sand.']),
  }),
  'belt-asteroid': f({
    id: 'belt-asteroid', title: 'Belt asteroid', reads: 'A dark rock in the asteroid belt: charcoal regolith struck by craters of every size under a black sky, the Sun small and hard, a neighbouring rock hanging over it',
    light: BELT, colour: REGOLITH, register: f({ steps: 0, key: 0.42 }), surfaces: SURFACES, inside: INSIDE,
    outside: f({ ...FIELD_OUTSIDE('asteroid', { dry: true, rock: BELT_ROCK, seed: 'belt' }), relief: BROKEN }),
    why: f([
      'The sky is the darkest thing: black at noon, the stars out, the Sun a small white disc a third of ours.',
      'Hard low light and no air: every rim and block throws a long shadow, its shade the regolith leaned blue, never black.',
      'Charcoal rock in value steps, no hue: the colour is kept for what was made, a frame and its paint.',
      'The craters are the ground: bowls to drop into and fight across, their rims the cover.',
    ]),
  }),
  'belt-crag': f({
    id: 'belt-crag', title: 'Belt crag', reads: 'A broken rock in the asteroid belt: charcoal spurs and blocks thrown up round a cratered floor under a black sky, the Sun small and hard, a neighbouring rock hanging over it',
    light: BELT, colour: REGOLITH, register: f({ steps: 0, key: 0.42 }), surfaces: SURFACES, inside: INSIDE,
    outside: f({ ...FIELD_OUTSIDE('crag', { dry: true, rock: BELT_ROCK, seed: 'crag' }), relief: BROKEN }),
    why: f([
      'The sky is the darkest thing: black at noon, the stars out, the Sun a small white disc a third of ours.',
      'Hard low light and no air: every spur throws a long shadow, its shade the regolith leaned blue, never black.',
      'Charcoal rock in value steps, no hue: the colour is kept for what was made, a frame and its paint.',
      'The spurs are the cover: tall rock between a frame and what fights it from overhead, benched to climb, its clefts to slip through.',
    ]),
  }),
  'smelter-hall': f({
    id: 'smelter-hall', title: 'Smelter hall', reads: 'A steelworks melt shop half a kilometre across: furnaces glowing under their hoods, decks and ramps, a crane overhead, slag on a concrete floor',
    light: HALL_LIGHT('#ffdcae', '#ff6a18', '#3b2d22'),
    colour: f({ stone: '#45474a', floor: '#625d56', trim: '#2a2624', accent: '#ff7a1a', grass: '#4f4a45', foliage: '#4a4640', water: '#2a3038', sand: '#3f3a35', shade: 28 }),
    register: f({ steps: 0, key: 0.45 }), surfaces: SURFACES, inside: INSIDE,
    outside: WORKS_OUTSIDE('smelter'), wind: f({ speed: 1, dir: 0 }),
    why: f([
      'No sky: the light is the works\' own, rows of high-bay lamps under the trusses and the furnaces\' glow, in a smoke that swallows the far wall.',
      'Steel and concrete as materials, lit: the plate catches the lamps, the slag drinks them, the molten metal is the brightest thing in the hall.',
      'A frame fights across its floor and up its decks, under the crane, between the furnaces.',
    ]),
  }),
  'refinery-works': f({
    id: 'refinery-works', title: 'Refinery works', reads: 'A refinery\'s superstructure under one enclosure: process frames level on level, distillation columns, spheres, pipe racks and the walkways between',
    // (the hall's fill as sodium as its lamps: no cool sky to shade the floor blue)
    light: HALL_LIGHT('#ffb35c', '#ff5a10', '#2e2a24', f({ zenith: '#5a4a38', horizon: '#7a6448', fog: '#4a3c2e' })),
    colour: f({ stone: '#5a5e60', floor: '#6e6a62', trim: '#3a3632', accent: '#ffb000', grass: '#55524c', foliage: '#4e4b46', water: '#20262c', sand: '#3a352f', shade: 30 }),
    register: f({ steps: 0, key: 0.45 }), surfaces: SURFACES, inside: INSIDE,
    outside: WORKS_OUTSIDE('refinery', 'refinery', 'refinery'), wind: f({ speed: 1, dir: 0 }),
    why: f([
      'A place built up, not out: the fight climbs the process frames a level at a time, crosses on the walkways and drops through the grating.',
      'Sodium lamps under every level and the fired heaters\' glow; the columns and spheres catch them as steel, the floor\'s gravel drinks them.',
      'Every level is seen through: a frame on the grating is a target from below, and the columns, the spheres and the racks are the cover.',
    ]),
  }),
  'wadi-oasis': f({
    id: 'wadi-oasis', title: 'Wadi oasis', reads: 'A lake on a wadi\'s floor among sheer sandstone jebels, a pool beside it',
    light: DESERT(0.26), colour: f({ ...SANDSTONE, water: '#2f8aa0' }), register: f({ steps: 0, key: 0.55 }), surfaces: SURFACES, inside: INSIDE,
    outside: FIELD_OUTSIDE('oasis'), wind: f({ speed: 4, dir: 230 }),
    why: f([WHY[0], WHY[1], 'The water is the only cool colour on the floor: a sheet the suits hover over, never fight under.']),
  }),
});

export const FIELD_GEOCUBE_PALETTES = f({
  'sandstone-wadi': f({ intent: 'red sandstone walls over an orange sand floor under a deep desert sky', key: 'high', heat: 0.6, weight: 0.1, activity: 0, scheme: 'complementary', hues: f({ sky: 214, rock: 18, soil: 26, ground: 30, foliage: 62, accent: '#2f7fd0' }) }),
  'sandstone-gorge': f({ intent: 'a red sandstone canyon, its floor and its river under a deep desert sky', key: 'mid', heat: 0.55, weight: 0.2, activity: 0, scheme: 'complementary', hues: f({ sky: 212, rock: 16, soil: 24, ground: 30, foliage: 64, accent: '#2f7fd0' }) }),
  'scree-scarp': f({ intent: 'a brown scarp over pale scree fans in a hard dry light', key: 'mid', heat: 0.45, weight: 0.2, activity: -0.1, scheme: 'analogous', hue: '#8e5a40', hues: f({ sky: 214, accent: '#2f7fd0' }) }),
  'belt-asteroid': f({ intent: 'a charcoal asteroid under a black sky, one warm accent', key: 'low', heat: -0.1, weight: 0.5, activity: -0.4, scheme: 'mono-accent', hues: f({ rock: 30 }), lock: f({ accent: '#d07a2a' }) }),
  'belt-crag': f({ intent: 'a charcoal crag in the belt under a black sky, one warm accent', key: 'low', heat: -0.1, weight: 0.5, activity: -0.4, scheme: 'mono-accent', hues: f({ rock: 30 }), lock: f({ accent: '#d07a2a' }) }),
  'crater-plain': f({ intent: 'a stony desert plain struck by meteorites under a deep sky', key: 'mid', heat: 0.5, weight: 0.2, activity: 0.1, scheme: 'analogous', hue: '#86503a', hues: f({ sky: 214, accent: '#2f7fd0' }) }),
  'smelter-hall': f({ intent: 'a steelworks melt shop: dark steel and concrete in smoke, lit by lamps and molten metal', key: 'low', heat: 0.4, weight: 0.5, activity: 0.2, scheme: 'mono-accent', hues: f({ rock: 210 }), lock: f({ accent: '#ff7a1a' }) }),
  'refinery-works': f({ intent: 'a refinery under its enclosure: grey steel and gravel in sodium light, heaters glowing', key: 'low', heat: 0.5, weight: 0.5, activity: 0.3, scheme: 'mono-accent', hues: f({ rock: 205 }), lock: f({ accent: '#ffb000' }) }),
  'wadi-oasis': f({ intent: 'red sandstone round a blue lake on an orange floor', key: 'high', heat: 0.55, weight: 0.1, activity: 0.1, scheme: 'complementary', hues: f({ sky: 212, rock: 18, soil: 26, ground: 30, foliage: 70, accent: '#2f8aa0' }) }),
});

// (a field's outpost: its labs and workshops, its quarters, its hall and its mast)
const OUTPOST = f({ anchor: 'tiered', uses: f([f({ use: 'lab', enter: 'door' }), f({ use: 'workshop', enter: 'walk' }), f({ use: 'dwelling', enter: 'door' }), f({ use: 'hall', enter: 'walk' }), f({ use: 'tower', enter: 'walk' })]) });
export const FIELD_GEOCUBE_BUILDINGS = f(Object.fromEntries(Object.keys(FIELD_GEOCUBES).map((id) => [id, OUTPOST])));
