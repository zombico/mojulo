/**
 * sol/roster — THE CHILDREN OF SOL: one row per body of our own solar system, under the names people say, so a game, an
 * exhibit or a space level that wants Mars or Saturn gets the real one from one place instead of making it again.
 *
 * A row NAMES and MEASURES; the looks live where their drawers read them, each a handle on the row:
 *   model     the body seen whole: the ray-traced planet study (views/science/saturn-view.js `planet`), its whole
 *             globe, a close pass over its cloud tops and, ringed, a pass through its rings (SOL_VIEWS)
 *   world     the body in a space level's sky (skyscape/planet-gen.js: its knobs fixed to the real world, sol/worlds.js),
 *             named in `space.backdrop.worlds` like any kind of world, far off or held in orbit over it
 *   geocube   the body under foot (era/geocube.js presets, sol/geocubes.js): its ground and its sky as one style, the
 *             walk on its surface. Earth has none of its own: every other geocube is an Earth
 *   flight    a giant's, which has no ground to stand on: flown over its cloud tops (sol/skies.js, an airspace's
 *             `sky: { world }`), its deck the floor, its towers and its haze, Saturn's rings arched over it
 *
 * A row:
 *   label, words   what it is called, and the words that reach it (3+ characters, lower case)
 *   class          'planet' | 'moon' | 'dwarf'
 *   parent         the body it circles ('sol' for the planets)
 *   order          its place out from the Sun (the Moon beside the Earth)
 *   figures        the real numbers: radius (km), gravity (Earth's = 1), day (its solar day, hours), au (its mean
 *                  distance from the Sun), tilt (its axial tilt, °), air (none | trace | thin | thick | giant: what a
 *                  sky over it is), pressure (bar at its surface, or at its cloud tops for a giant), temperature (°C, the
 *                  mean at its surface or its 1-bar level), sun (the Sun's width in its sky, Earth's = 1), moons (known)
 *   sky            what is seen looking up from it: a line, and what hangs there (`companion`, the body nearest in its
 *                  sky; `rings`, a ringed giant's arch)
 *   close          what its close view shows: 'clouds' (a giant's or a cloudy world's tops), 'rings', 'surface'
 *   rings          a ringed giant's rings: inner and outer edge (in its radii), and how they read
 *   line, fact     one line of what it is, one of what is striking about it
 *
 * Pure data and pure functions: no clock, no dice.
 */

const R = (o) => Object.freeze(o);

export const SOL_CLASSES = Object.freeze({ planet: 'a planet of the Sun', moon: 'a moon', dwarf: 'a dwarf planet' });

export const SOL_BODIES = Object.freeze({
  mercury: R({ label: 'Mercury', words: ['mercury', 'innermost planet', 'swift planet'], class: 'planet', parent: 'sol', order: 1,
    figures: R({ radius: 2439.7, gravity: 0.38, day: 4222.6, au: 0.387, tilt: 0.03, air: 'none', pressure: 0, temperature: 167, sun: 2.6, moons: 0 }),
    sky: R({ reads: 'black at noon, the stars out, the Sun two and a half times as wide as ours and blinding' }),
    close: 'surface', model: 'mercury', world: 'mercury', geocube: 'mercury',
    line: 'Mercury: cratered, airless, the smallest planet', fact: 'a day longer than its year; 430 °C by day, −180 °C by night' }),
  venus: R({ label: 'Venus', words: ['venus', 'evening star', 'morning star'], class: 'planet', parent: 'sol', order: 2,
    figures: R({ radius: 6051.8, gravity: 0.9, day: 2802, au: 0.723, tilt: 177.4, air: 'thick', pressure: 92, temperature: 464, sun: 1.38, moons: 0 }),
    sky: R({ reads: 'a low ceiling of yellow-orange cloud, no Sun to be seen, the light dim and from everywhere' }),
    close: 'clouds', model: 'venus', world: 'venus', geocube: 'venus',
    line: 'Venus: a world under a lid of sulphuric-acid cloud', fact: '92 times Earth\'s air, hot enough to melt lead; it turns backwards' }),
  earth: R({ label: 'Earth', words: ['earth', 'home world', 'blue planet', 'terra'], class: 'planet', parent: 'sol', order: 3,
    figures: R({ radius: 6371, gravity: 1, day: 24, au: 1, tilt: 23.44, air: 'thin', pressure: 1, temperature: 15, sun: 1, moons: 1 }),
    sky: R({ reads: 'blue by day; every other geocube is an Earth' }),
    close: 'clouds', model: 'earth', world: 'earth', geocube: null,
    line: 'Earth: oceans, continents, clouds, a blue atmosphere', fact: 'the only world known to harbour life' }),
  moon: R({ label: 'the Moon', words: ['moon', 'the moon', 'luna', 'lunar', 'selene'], class: 'moon', parent: 'earth', order: 3.5,
    figures: R({ radius: 1737.4, gravity: 0.165, day: 708.7, au: 1, tilt: 1.54, air: 'none', pressure: 0, temperature: -20, sun: 1, moons: 0 }),
    sky: R({ reads: 'black by day, the stars out, the Earth hanging in it, blue and white, four times the Moon in ours', companion: 'earth' }),
    close: 'surface', model: 'moon', world: 'moon', geocube: 'moon',
    line: 'the Moon: grey highlands and dark maria under a black sky', fact: 'it keeps one face to the Earth, so the Earth stands still in its sky' }),
  mars: R({ label: 'Mars', words: ['mars', 'red planet', 'martian'], class: 'planet', parent: 'sol', order: 4,
    figures: R({ radius: 3389.5, gravity: 0.38, day: 24.66, au: 1.524, tilt: 25.19, air: 'thin', pressure: 0.006, temperature: -63, sun: 0.66, moons: 2 }),
    sky: R({ reads: 'butterscotch by day from the dust, its sunsets blue; a small pale Sun', companion: 'phobos' }),
    close: 'surface', model: 'mars', world: 'mars', geocube: 'mars',
    line: 'Mars: a rust desert under a dusty pink sky', fact: 'Olympus Mons, three times Everest; its sunset is blue' }),
  jupiter: R({ label: 'Jupiter', words: ['jupiter', 'jove', 'jovian'], class: 'planet', parent: 'sol', order: 5,
    figures: R({ radius: 69911, gravity: 2.53, day: 9.93, au: 5.2, tilt: 3.13, air: 'giant', pressure: 1, temperature: -110, sun: 0.19, moons: 95 }),
    sky: R({ reads: 'over its cloud tops: a deep blue overhead, a cream and rust deck to the horizon, storm towers climbing out of it' }),
    close: 'clouds', rings: R({ inner: 1.29, outer: 1.81, reads: 'a faint ring of dust, barely there' }), model: 'jupiter', world: 'jupiter', geocube: null, flight: 'jupiter',
    line: 'Jupiter: brown belts and cream zones, the Great Red Spot', fact: 'the Great Red Spot is a storm wider than the Earth' }),
  saturn: R({ label: 'Saturn', words: ['saturn', 'ringed planet', 'saturnian'], class: 'planet', parent: 'sol', order: 6,
    figures: R({ radius: 58232, gravity: 1.07, day: 10.7, au: 9.58, tilt: 26.73, air: 'giant', pressure: 1, temperature: -140, sun: 0.1, moons: 146 }),
    sky: R({ reads: 'over its gold cloud tops the rings stand in the sky as an arch from horizon to horizon', rings: true }),
    close: 'rings', rings: R({ inner: 1.24, outer: 2.27, reads: 'bright, broad and structured: the C, B and A rings, the Cassini Division' }), model: 'saturn', world: 'saturn', geocube: null, flight: 'saturn',
    line: 'Saturn: the bright structured rings over gold bands', fact: 'its rings are ice, 280 000 km across and mostly tens of metres thick' }),
  uranus: R({ label: 'Uranus', words: ['uranus', 'ice giant', 'tilted planet'], class: 'planet', parent: 'sol', order: 7,
    figures: R({ radius: 25362, gravity: 0.9, day: 17.24, au: 19.2, tilt: 97.77, air: 'giant', pressure: 1, temperature: -195, sun: 0.05, moons: 28 }),
    sky: R({ reads: 'pale cyan haze over a featureless deck, its dark rings a thin arch, near invisible', rings: true }),
    close: 'rings', rings: R({ inner: 1.64, outer: 2.0, reads: 'thin dark ringlets, the epsilon ring the brightest' }), model: 'uranus', world: 'uranus', geocube: null, flight: 'uranus',
    line: 'Uranus: pale cyan, tipped on its side', fact: 'its axis lies nearly in its orbit: each pole has 42 years of day' }),
  neptune: R({ label: 'Neptune', words: ['neptune', 'blue giant', 'windiest planet'], class: 'planet', parent: 'sol', order: 8,
    figures: R({ radius: 24622, gravity: 1.14, day: 16.11, au: 30.07, tilt: 28.32, air: 'giant', pressure: 1, temperature: -200, sun: 0.033, moons: 16 }),
    sky: R({ reads: 'a deep methane blue, white streaks of high cirrus over it' }),
    close: 'clouds', rings: R({ inner: 1.69, outer: 2.54, reads: 'faint narrow rings, the Adams ring in bright arcs' }), model: 'neptune', world: 'neptune', geocube: null, flight: 'neptune',
    line: 'Neptune: deep methane blue, a Great Dark Spot', fact: 'the fastest winds in the solar system, 2 000 km/h' }),
  pluto: R({ label: 'Pluto', words: ['pluto', 'dwarf planet', 'plutonian'], class: 'dwarf', parent: 'sol', order: 9,
    figures: R({ radius: 1188.3, gravity: 0.063, day: 153.3, au: 39.48, tilt: 122.5, air: 'trace', pressure: 0.00001, temperature: -229, sun: 0.025, moons: 5 }),
    sky: R({ reads: 'near black, a thin blue haze at the horizon, the Sun a blinding star, Charon huge and still', companion: 'charon' }),
    close: 'surface', model: 'pluto', world: 'pluto', geocube: 'pluto',
    line: 'Pluto: nitrogen ice plains and red-brown highlands, the heart', fact: 'Charon is half its size, and the two face each other always' }),
});

/** The bodies in order out from the Sun (the Moon after the Earth). */
export const SOL_ORDER = Object.freeze(Object.keys(SOL_BODIES).sort((a, b) => SOL_BODIES[a].order - SOL_BODIES[b].order));
/** The bodies that have a surface geocube (the ones with ground, but the Earth). */
export const SOL_GEOCUBE_IDS = Object.freeze(SOL_ORDER.filter((id) => SOL_BODIES[id].geocube));
/** The giants, flown over their cloud tops instead (sol/skies.js). */
export const SOL_FLIGHT_IDS = Object.freeze(SOL_ORDER.filter((id) => SOL_BODIES[id].flight));

/** The views of a body's model: its whole globe, a close pass over it, a pass through its rings (a ringed body's). */
export const SOL_VIEWS = Object.freeze({
  globe: 'the whole body, sunlit, turning',
  close: 'a close pass over its cloud tops or its ground, the limb and the terminator in view',
  rings: 'a pass through its ring plane, the rings sweeping toward it (a ringed body\'s; others get the close pass)',
});

const WORD = new Map();
for (const [id, b] of Object.entries(SOL_BODIES)) { WORD.set(id, id); for (const w of b.words) WORD.set(w, id); }

/** A body's id from a word people say ('Mars', 'the red planet', 'luna'), or null. */
export function solId(word) {
  if (typeof word !== 'string') return null;
  const w = word.trim().toLowerCase().replace(/\s+/g, ' ');
  return WORD.get(w) ?? WORD.get(w.replace(/^the /, '')) ?? null;
}

/** A body's row by a word people say. Throws, teaching, on a word that names none. */
export function solBody(word) {
  const id = solId(word);
  if (!id) throw new Error(`sol: '${word}' is not a child of Sol (${SOL_ORDER.join(', ')})`);
  return { id, ...SOL_BODIES[id] };
}

/** What a game asks for when it wants a body: its model recipe (a view of it), its space level's world, its surface, or a
 *  giant's flight over its cloud tops (an airspace recipe: a jet seated aloft over the deck, skyscape/craft.js).
 *  → { id, label, model: <saturn-view recipe>, backdrop: { worlds: [id] }, geocube: <id> | null, flight: <airspace> | null, figures } */
export function solHandles(word, { view = 'globe' } = {}) {
  const B = solBody(word);
  if (!SOL_VIEWS[view]) throw new Error(`sol: view is ${Object.keys(SOL_VIEWS).join(' | ')}`);
  const scenario = view === 'globe' ? 'classic' : view === 'rings' && B.rings ? 'rings' : 'close';
  const flight = B.flight ? { kind: 'airspace', map: { form: 'plain', craft: 'jet', field: 12000 }, sky: { world: B.flight }, fly: true } : null;
  return { id: B.id, label: B.label, model: { kind: 'saturn-view', planet: B.model, scenario }, backdrop: { worlds: [B.world] }, geocube: B.geocube, flight, figures: B.figures };
}
