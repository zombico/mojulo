/**
 * THE BATTLEFIELD CUBES — the geocubes a frame's fields are cut from (Mech Battle Kai's lands, and any frame level's):
 * sandstone country at a mech's scale, pure terrain. There is no trail and no seam: the floor a frame skates on is the
 * land itself, read off its radar and its beacons, so each cube's outside is a field (an open island nobody walks onto)
 * with its standing rock as its own words (local-meru/massif.js). Cliffs, gorges, rock, scree and water are the
 * elements; buildings come after.
 *
 *   FIELD_GEOCUBES            the cubes (era/geocube.js GEOCUBE_PRESETS carries them): sandstone-wadi, sandstone-gorge,
 *                             scree-scarp, wadi-oasis
 *   FIELD_GEOCUBE_PALETTES    each one's palette spec (a seeded variant is solved from it)
 *   FIELD_GEOCUBE_BUILDINGS   the outposts each plausibly has (a recommendation, never a placement)
 *   FIELD_ROCK                each field's rock colour by its column (form/rock-colour.js, a geocube's `outside.rock`)
 *   FIELD_OUTSIDE(massif, rock?) → a field's outside: the island at a frame's scale, its floor a sand plain rolled by the
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
const ISLAND = f({ geology: false, walk: 'none', open: true, seabed: 'merged', cell: 4, scale: 3, cover: 'soil', beach: 10, sea: 2.1, depth: 9, shore: 600, high: f({ height: 40, span: 360 }) });
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
  scree: f({ beds: f([f({ to: 14, toward: 'floor', mix: 0.2, value: -0.1 }), f({ to: 62 }), f({ to: 2000, toward: 'trim', mix: 0.4, value: 0.04 })]), blend: 4, thin: f({ beds: f([6, 14]), jitter: 0.09 }), wear: f({ ...WEAR, edge: 0.28 }), sections: f({ ...SECTIONS, size: 24, value: 0.12 }), varnish: f({ ...VARNISH, strength: 0.5 }) }),
});

/** A field's outside: the island, the swell, the sand floor rolled by the wind, the massif's card on it and its rock's colour. */
export const FIELD_OUTSIDE = (massif, rock = FIELD_ROCK[massif] ?? FIELD_ROCK.wadi, seed = massif) => f({
  base: 'airless-plain', tiers: SWELL, island: ISLAND, land: LAND,
  ground: f({ from: f({ heartbeat: 'gentle-pulse', splatch: 'bone-trio', seed }), span: 1800, height: 7 }),
  // (the floor's dunes long and low at a frame's scale: a skate over them, never a climb)
  relief: f({ from: 'dune', height: 2.5, scale: 90, finest: 8 }), massif, rock,
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

export const FIELD_GEOCUBES = f({
  'sandstone-wadi': f({
    id: 'sandstone-wadi', title: 'Sandstone wadi', reads: 'Sheer red sandstone jebels round an open sand floor, a siq between two, under a hard desert sun',
    light: DESERT(), colour: SANDSTONE, register: f({ steps: 0, key: 0.55 }), surfaces: SURFACES, inside: INSIDE,
    outside: FIELD_OUTSIDE('wadi'), wind: f({ speed: 5, dir: 240 }), why: WHY,
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
    outside: FIELD_OUTSIDE('scree'), wind: f({ speed: 6, dir: 260 }),
    why: f([WHY[0], WHY[1], 'The scarp sheds its rock: the fans run out from its foot and the blocks lie where they fell, broken ground and cover all the way across.']),
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
  'wadi-oasis': f({ intent: 'red sandstone round a blue lake on an orange floor', key: 'high', heat: 0.55, weight: 0.1, activity: 0.1, scheme: 'complementary', hues: f({ sky: 212, rock: 18, soil: 26, ground: 30, foliage: 70, accent: '#2f8aa0' }) }),
});

// (a field's outpost: its labs and workshops, its quarters, its hall and its mast)
const OUTPOST = f({ anchor: 'tiered', uses: f([f({ use: 'lab', enter: 'door' }), f({ use: 'workshop', enter: 'walk' }), f({ use: 'dwelling', enter: 'door' }), f({ use: 'hall', enter: 'walk' }), f({ use: 'tower', enter: 'walk' })]) });
export const FIELD_GEOCUBE_BUILDINGS = f(Object.fromEntries(Object.keys(FIELD_GEOCUBES).map((id) => [id, OUTPOST])));
