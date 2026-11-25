/**
 * sol/geocubes — THE CHILDREN OF SOL UNDER FOOT: a geocube (era/geocube.js) for each body of the roster (sol/roster.js)
 * but the Earth, its ground and its sky as one style, so a level asks for `geocube: 'mars'` and stands on Mars. Read into
 * the geocube presets (GEOCUBE_PRESETS) beside the hand-made Earths, with their palettes and their buildings.
 *
 *   the airless (Mercury, the Moon, Pluto)   the airless plain (era/style/airless-plain.js): craters, regolith, a black
 *            sky with the stars out by day; the sun a low hard key (the cube's `moon`, the reference a night's, so the
 *            fill is dark and every rock throws a long shadow), at its own width (Mercury's huge, Pluto's a star); the
 *            body nearest in the sky hanging there (the Earth over the Moon, Charon over Pluto): era/heavens.js
 *   the airy (Venus, Mars)   the airless plain given air (`heavens.void: false`): Mars rust under a butterscotch sky, its
 *            dunes, Phobos; Venus dark basalt under a lid of yellow-orange cloud, no sun seen, the air thick
 *
 * The giants (Jupiter, Saturn, Uranus, Neptune) have no ground to stand on, so no geocube: they are flown, over their
 * cloud tops (sol/skies.js, a flight sky's `world`).
 *
 * The colours are the bodies' own (spacecraft and lander photographs, read as a painter would: the shade a colour,
 * never black); each cube's palette spec says its character for a seeded solve (color-theorist/solve.js).
 *
 *   SOL_GEOCUBES            the presets, by body id
 *   SOL_GEOCUBE_PALETTES    each one's character, as GEOCUBE_PALETTES
 *   SOL_GEOCUBE_BUILDINGS   the buildings a colony on it plausibly has, as GEOCUBE_BUILDINGS
 *
 * Pure data.
 */

// (the specimen's surfaces: the geocube presets' stone, flags and rock, quiet; a colony's walls are panels, not masonry)
const PANEL = { gen: 'stone-brick', stone: [150, 150, 150], mortar: [96, 96, 96], rows: 3, cols: 2, mortarThick: 0.06, vary: 10, grain: 5, bevel: 0.15, accent: 0.1, accentDark: 30, accentLight: 20, seed: 13 };
const DECK = { gen: 'flagstone', stone: [140, 140, 140], mortar: [70, 70, 70], gravel: [100, 100, 100], cells: 4, mortarThick: 0.04, wobble: 0.6, vary: 10, grain: 5, lost: 0, cracked: 0.05, seed: 17 };
const ROCK = { gen: 'rock', style: 'cave', base: [170, 170, 170], seed: 1 };
const SURFACES = { wall: PANEL, floor: DECK, accent: ROCK };
// (inside: a station's room, the colony's lab)
const INSIDE = { bones: 'research-lab', size: [12, 12, 7], accentWall: '+y' };
const LAND = { smooth: true, crevice: 0.6, ridge: 0.35, blend: 0.6 };
// (the island every cube's outside is grown from, era/geocube.js MERU_ISLE: at a game's scale, flown, not walked; the
// path is walked)
const ISLE = { geology: true, walk: 'none', seabed: 'merged', cell: 1.5, scale: 3, cover: 'soil', beach: 27, sea: 2.1, depth: 9, high: { height: 13.5 } };
// (a rocky world's island: a broad low mesa and a crater-rimmed rise)
const ROCKY_TIERS = [{ form: 'mound', height: 14, foot: 34, summit: 18 }, { form: 'mound', height: 9, foot: 15, summit: 7, up: { turns: 1 } }];

const airless = ({ key, gain = 1.6, sky, disc, companion }) => ({
  light: { reference: 'gothic-night', moon: { color: '#fffaf0', elevation: key[0], azimuth: key[1], gain }, outsideFog: 0.05, sky,
    heavens: { void: { stars: 1, glow: 0.4 }, disc, ...(companion ? { companion } : {}) } },
});

export const SOL_GEOCUBES = Object.freeze({
  mercury: {
    id: 'mercury', title: 'Mercury', reads: 'Scorched grey-brown craters under a black sky and a huge white Sun',
    ...airless({ key: [26, 70], gain: 1.9, sky: { zenith: '#020203', horizon: '#07070a', fog: '#0a0a0c' }, disc: { size: 3, glow: 1.4 } }),
    colour: { stone: '#6e6862', floor: '#5a554f', trim: '#9a948c', accent: '#c89a40', grass: '#7a746c', foliage: '#5e5952', water: '#5a554f', sand: '#8a847b', shade: 30 },
    register: { steps: 0, key: 0.42 },
    surfaces: SURFACES, inside: INSIDE,
    outside: { base: 'airless-plain', tiers: ROCKY_TIERS, island: ISLE, land: LAND },
    why: [
      'The Sun is the subject: two and a half times as wide as ours, white, and the light it throws is hard and hot.',
      'No air: the far rims as crisp as the near ones, the sky black at noon with the stars out.',
      'Grey-brown, darker than the Moon: the regolith in value steps, the shade the colour of the rock, never black.',
      'Craters on craters, and the long scarps where the planet shrank as it cooled.',
    ],
  },
  venus: {
    id: 'venus', title: 'Venus', reads: 'Dark basalt plains under a low lid of yellow-orange cloud, the air thick and hot',
    light: { reference: 'jungle-haze', outsideFog: 3.4, sun: { color: '#ffb35a' }, sky: { zenith: '#7a4e1c', horizon: '#d9a24e', fog: '#c48a3c' },
      heavens: { void: false, disc: false } },
    colour: { stone: '#4a3a2e', floor: '#5e4a38', trim: '#8a6a48', accent: '#e0a030', grass: '#6a5236', foliage: '#4e3e2c', water: '#3a2c20', sand: '#7a6040', shade: 22 },
    register: { steps: 0, key: 0.34 },
    surfaces: SURFACES, inside: INSIDE,
    outside: { base: 'airless-plain', tiers: ROCKY_TIERS, island: ISLE, land: LAND },
    why: [
      'The sky is a lid: one low ceiling of yellow-orange cloud, no Sun seen, the light dim and from everywhere.',
      'The air is the depth: ninety times Earth\'s, so a few hundred metres off the land is already the sky\'s colour.',
      'Everything is lit orange: dark basalt slabs, never grey, their shade a deep brown.',
      'Nothing moves but the heat: flat plains of broken rock, low volcanic rises, the far land swallowed by the haze.',
    ],
  },
  moon: {
    id: 'moon', title: 'The Moon', reads: 'Grey regolith and craters under a black sky, the Earth hanging in it',
    ...airless({ key: [18, 60], sky: { zenith: '#010102', horizon: '#05060a', fog: '#0a0b0e' }, disc: { size: 1.1, glow: 0.5 },
      companion: { azimuth: 140, elevation: 30, size: 5, phase: 0.62, color: '#3a6ab8', spots: ['#f2f4f6', '#7a8a5a'] } }),
    colour: { stone: '#6c6b69', floor: '#7e7c78', trim: '#aaa8a2', accent: '#d0a040', grass: '#8c8a86', foliage: '#5e5d5b', water: '#7e7c78', sand: '#9c9a94', shade: 38 },
    register: { steps: 0, key: 0.45 },
    surfaces: SURFACES, inside: INSIDE,
    outside: { base: 'airless-plain', tiers: ROCKY_TIERS, island: ISLE, land: LAND, cliff: false },
    why: [
      'The Earth is the subject: blue and white in the black, four times the Moon in ours, and it never moves.',
      'The sky is the darkest thing: black at noon, the stars out, the Sun a small white disc.',
      'Hard low light, no fill: every boulder throws a long shadow, its shade the regolith\'s grey leaned blue.',
      'Grey in value steps, no hue: the colour is kept for what was made and for the Earth.',
      'Craters make the big shapes, bowls with raised rims, the plain open to the horizon.',
    ],
  },
  mars: {
    id: 'mars', title: 'Mars', reads: 'Rust dunes and red rock under a butterscotch sky',
    light: { reference: 'island-noon', outsideFog: 1.3, sun: { color: '#fff0dc' }, sky: { zenith: '#b98866', horizon: '#e0b48a', fog: '#d0a07a' },
      heavens: { void: false, disc: { size: 0.9, glow: 1.4 }, companion: { azimuth: 170, elevation: 42, size: 1.2, phase: 0.6, color: '#8a7a6a' } } },
    colour: { stone: '#7a3a22', floor: '#a8582f', trim: '#c89070', accent: '#40a0c0', grass: '#b4643a', foliage: '#8a4a2a', water: '#6a3a28', sand: '#c47a4a', shade: 14 },
    register: { steps: 0, key: 0.48 },
    surfaces: SURFACES, inside: INSIDE,
    outside: { base: 'airless-plain', tiers: ROCKY_TIERS, island: ISLE, land: LAND, dunes: true },
    wind: { speed: 6, dir: 250 },
    why: [
      'The dust is the colour: rust ground, red rock, and a butterscotch sky, all one family of warm oranges.',
      'The air is thin but dusty: the far cliffs go pink into it, never blue.',
      'One cool accent, what was made, the only thing on Mars that is not rust.',
      'Dunes laid by the wind across the plain, boulders strewn, craters softened by the dust.',
      'A small pale Sun with a glow round it; Phobos a grey lump in the sky.',
    ],
  },
  pluto: {
    id: 'pluto', title: 'Pluto', reads: 'Pale nitrogen ice and red-brown highlands in a dim light, Charon huge in the sky',
    ...airless({ key: [12, 50], gain: 1.1, sky: { zenith: '#020206', horizon: '#1a2a48', fog: '#121a2c' }, disc: { size: 0.08, glow: 0.35 },
      companion: { azimuth: 140, elevation: 34, size: 9, phase: 0.5, color: '#8e8a84', spots: ['#6a6460', '#a8a49c'] } }),
    colour: { stone: '#8a5a40', floor: '#c8b8a0', trim: '#ece4d8', accent: '#4a8ad0', grass: '#e4dac8', foliage: '#a88870', water: '#d8ccb8', sand: '#e8e0d2', shade: 18 },
    register: { steps: 0, key: 0.4 },
    surfaces: SURFACES, inside: INSIDE,
    outside: { base: 'airless-plain', tiers: ROCKY_TIERS, island: ISLE, land: LAND },
    why: [
      'Charon is the subject: half Pluto\'s size, hanging huge and still, the two facing each other always.',
      'The light is dim, a long twilight: the Sun a blinding star, the shadows long and blue.',
      'Pale nitrogen ice on the plains, red-brown tholin on the highlands: the warm and the pale, nothing grey.',
      'A thin blue haze lies along the horizon; above it the sky is black and the stars out.',
    ],
  },
});

/** Each Sol cube's character in the color theorist's terms (GEOCUBE_PALETTES' shape): what a seeded solve keeps. */
export const SOL_GEOCUBE_PALETTES = Object.freeze({
  mercury: { intent: 'scorched grey-brown craters under a black sky', key: 'mid', heat: 0.2, weight: 0.5, activity: -0.6, scheme: 'mono-accent', hues: { rock: 40 }, lock: { accent: '#c89a40' } },
  venus: { intent: 'dark basalt under a yellow-orange lid of cloud', key: 'low', heat: 0.9, weight: 0.7, activity: -0.5, scheme: 'analogous', hue: '#5e4a38', hues: { sky: 40, accent: '#e0a030' } },
  moon: { intent: 'grey regolith under a black sky, the blue Earth', key: 'mid', heat: -0.2, weight: 0.4, activity: -0.7, scheme: 'mono-accent', hues: { rock: 60 }, lock: { accent: '#d0a040' } },
  mars: { intent: 'rust dunes and red rock under a butterscotch sky', key: 'mid', heat: 0.7, weight: 0.3, activity: -0.2, scheme: 'analogous', hue: '#a8582f', hues: { sky: 30, accent: '#40a0c0' } },
  pluto: { intent: 'pale nitrogen ice and red-brown tholin in a dim light', key: 'mid', heat: 0.1, weight: 0.1, activity: -0.4, scheme: 'complementary', hues: { sky: 220, rock: 22, soil: 36, ground: 38 }, lock: { accent: '#4a8ad0' } },
});

// (a colony's buildings: its labs and workshops, its quarters, its hall and its mast)
const COLONY = { anchor: 'tiered', uses: [{ use: 'lab', enter: 'door' }, { use: 'workshop', enter: 'walk' }, { use: 'dwelling', enter: 'door' }, { use: 'hall', enter: 'walk' }, { use: 'tower', enter: 'walk' }] };
/** The buildings a colony on each plausibly has (GEOCUBE_BUILDINGS' shape): an outpost's, on every body. */
export const SOL_GEOCUBE_BUILDINGS = Object.freeze(Object.fromEntries(Object.keys(SOL_GEOCUBES).map((id) => [id, COLONY])));
