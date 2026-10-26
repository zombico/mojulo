/**
 * THE COMIC HERO PACK'S LOOKS: one dial from the comic page to the realistic hero, every stop a geocube the tree reads
 * TODAY (era/geocube.js readGeocube: a `from` preset with a named register over it) and the hero direction that goes
 * with it (gameworld/characters.js). The WORLD walks the registers (cel, ink-wash, continuous); the HERO is never cel
 * shaded: the western tradition at every stop (the landmark head, heroic proportions, no character light, no ink),
 * on the standard tiered body at the comic and painted stops and on the realistic body at the realistic stop. The
 * dial's two ends are the two bodies.
 *
 *   DIAL            the stops in order, the comic page first: [{ id, body, reads }]
 *   LOOKS           { <look id>: { stop, reads, geocube, paint, hero, why } } a look is a stop by day or by night
 *                     geocube  the spec a level's `geocube` takes, readable now; its `light` the air (outsideFog against
 *                              the reference's, the sky's fog colour), its `contrast` and `grit` how hard the light and
 *                              the wear are (the gritty look)
 *                     paint    the rest of a city level's `paint` beside the geocube (city/plan/look.js): the `hour` the
 *                              cube lights it at and the `clouds` over it, which set the dome, the air and the haze
 *                     hero     the gameworld `characters.direction` for it, plus `form` where the body is the realistic one
 *   lookOf(id)      one, or throws naming the known ids
 *
 * A look is not yet a `reality.look` value: `comic-day` and `comic-night` stand in the registry as planned (absent), and
 * the sixth-gen look row that would make them is the `comic-look` package. Until then a world takes the geocube directly.
 */
export const DIAL = Object.freeze([
  { id: 'comic', body: 'tiered', reads: 'the comic page: the world in three bands with an ink outline and bold flat colour; the hero the tiered body, shaded smooth' },
  { id: 'painted', body: 'tiered', reads: 'the painted cover: the world in continuous light under an ink wash and a fine line; the hero the tiered body' },
  { id: 'realistic', body: 'realistic', reads: 'the live-action film: light on material, the realistic hero, no outline; gritty when the air is thick and the walls are worn' },
]);

// the comic palette: a bold two-ramp key, a primary against its complement, the shade leaning blue (geocube default)
const COMIC_COLOUR = Object.freeze({ accent: '#e03a2f', trim: '#2a56c6' });

export const LOOKS = Object.freeze({
  'comic-day': {
    stop: 'comic', reads: 'the comic page at noon: a hard sun, white light, primaries',
    geocube: { from: 'island-noon', register: 'cel', colour: { ...COMIC_COLOUR, stone: '#d9d2c4', floor: '#b8aa96' }, light: { outsideFog: 0.7 } },
    paint: { hour: 'noon', clouds: 'fair' },
    hero: { tradition: 'western', from: 'world', primary: 'the emblem', secondary: 'the belt' },
    why: ['Three bands and an outline on the world: what a printed page can hold.', 'A red against a blue, nothing muddy.', 'The hero is the tiered body shaded smooth, the landmark head, heroic proportions: never cel shaded.', 'Clear air: a page has no haze; the far towers stay drawn.'],
  },
  'comic-night': {
    stop: 'comic', reads: 'the comic page by night: the same ink and bands, the city\'s sodium and neon, rim light on the cast',
    geocube: { from: 'city-night', register: 'cel', colour: COMIC_COLOUR, light: { outsideFog: 0.5, sky: { zenith: '#120f1e', horizon: '#3a2c4a', fog: '#2a2440' } } },
    paint: { hour: 'night', clouds: 'high' },
    hero: { tradition: 'western', from: 'world', primary: 'the emblem', secondary: 'the cowl' },
    why: ['Night is a colour, not black: the city\'s own light.', 'The outline carries the figure where the bands go dark.', 'A thin violet air under high cloud: the page\'s night, not a fog.'],
  },
  'painted-dusk': {
    stop: 'painted', reads: 'the painted cover at dusk: a warm sky, a wash in the corners, a fine line',
    geocube: { from: 'valley-morning', register: 'ink-wash', colour: { accent: '#c8452c' }, light: { outsideFog: 1.4, sky: { zenith: '#5a6fa0', horizon: '#e0a070', fog: '#c9a58a' } } },
    paint: { hour: 'dusk', clouds: 'overcast' },
    hero: { tradition: 'western', from: 'world', primary: 'the cape\'s line', secondary: 'the gauntlets' },
    why: ['Continuous light, inked: the cover, not the page.', 'The hero in material light on the tiered body; the world keeps its line.', 'Dusk under a lid of cloud, a warm haze pooling down the street: the wash is in the air too.'],
  },
  'realistic-city': {
    stop: 'realistic', reads: 'the film: a night city, worked steel and leather, no outline',
    geocube: { from: 'city-night', register: 'continuous', materials: { age: 'worn' }, light: { outsideFog: 0.9 } },
    paint: { hour: 'night', clouds: 'overcast' },
    hero: { tradition: 'western', from: 'world', form: 'realistic', primary: 'the silhouette', secondary: 'the emblem, small' },
    why: ['Light on material, as a camera sees it.', 'The suit is worn: a film\'s costume, not a print.', 'Overcast night, the air a little thick: the city lights bloom, the far towers soften.'],
  },
  'gritty-night': {
    stop: 'realistic', reads: 'the gritty film: a storm night, the air thick with the city\'s own light, worn walls shaped by a hard key',
    // the light shaped in the vertex (vertex-contrast.js wii: the foot of a wall, crease and contact, warm against cool),
    // the walls dressed from relief at grit (city/plan/dress.js: streaks, stains, a bloom), the air thick enough to swallow
    // the far towers and carry the sodium up into the sky
    geocube: { from: 'city-night', register: { name: 'continuous', key: 0.3 }, contrast: 'wii', grit: 0.8, materials: { age: 'old' }, light: { outsideFog: 2.2, moon: { color: '#b4bce0', elevation: 40, azimuth: 220, gain: 0.45 }, sky: { zenith: '#0c0a0c', horizon: '#3a2c26', fog: '#3a2c26' } } },
    paint: { hour: 'night', clouds: 'storm', materials: 'modern' },
    hero: { tradition: 'western', from: 'world', form: 'realistic', primary: 'the silhouette', secondary: 'the emblem, small' },
    why: ['The atmosphere is the light: what is lit is what the air lets through.', 'A low key, the walls worn and streaked, the shade warm against a cold sky.', 'The far city is gone into the air; the near street is all there is.'],
  },
});

export function lookOf(id) {
  const L = LOOKS[id];
  if (!L) throw new Error(`comic-hero: no look '${id}' (known: ${Object.keys(LOOKS).join(', ')})`);
  return L;
}
