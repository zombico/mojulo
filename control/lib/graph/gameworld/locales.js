/**
 * A CITY GAME'S LOCALES — where a Hijack City is (gameworld/hijack-city.js `locale`): each a row of words the game
 * already reads, said together so a city reads as a place. Its suburbs' register (geotown/pattern.js, via the district's
 * `outskirts`), the part of town it stands in unless the person names one (`district`, HIJACK_DISTRICTS), its light (the
 * geocube it is lit by and the hour), its sky (`clouds`), its air (gen-7 `air`: a haze or a mist, its colour, how far
 * it sees) and its colour grade (the world's `grade`, laid over every frame); and its CITY (`city`, the district's own
 * geocity settings over its metro's: geocity/metro.js), the old fractal city's theming brought in: its grammar (a
 * document over one of the legacy metro's Earth flavours, city/city-flavors.js: its masses' cladding and its palettes,
 * its towers' share and shapes, its facades' affectations, its green), its land (its hills, its fall to its water) and
 * its heights by ring. A template's defaults: every word a person writes wins, and a new locale is a row, never code.
 *
 *   LOCALES              { <id>: { read, register, district?, cube, hour?, clouds?, air?, grade?, city?, night } }
 *                        `night`: the locale after dark (hijackCityWorld's `hour` past dusk): { read, lamps (its street
 *                        lamps' light), air, grade }
 *   LOCALE_IDS
 *   localeOf(id)         → the row, or throws naming the locales
 *
 * Pure data and a reader.
 */
export const LOCALES = Object.freeze({
  'los-angeles': Object.freeze({
    read: 'Los Angeles: stucco ranches and palms under a low gold sun, the far blocks lost in a warm smog, the frame warm',
    night: Object.freeze({ read: 'its night: sodium-amber lamps down every street, the smog lit from under', lamps: '#ffb766', air: Object.freeze({ kind: 'haze', visibility: 2400, colour: '#3b2e2a' }), grade: 'night' }),
    register: 'west-coast', cube: 'valley-morning', hour: 'golden', clouds: 'clear',
    air: Object.freeze({ kind: 'haze', visibility: 2600, colour: '#d8c4a2' }), grade: 'warm',
    // (a basin: the land nearly flat to its shore, its hills held back and low; a downtown of a few glass towers over a
    // low city of stucco and concrete, cream and sand and salmon, awnings on its shops, palms along its streets)
    city: Object.freeze({
      hills: Object.freeze({ height: 6 }), fall: Object.freeze({ drop: 12, toward: 's' }),
      // (its downtown a handful of towers among podiums and parking, lower than a lakeshore core's; its frame and
      // outskirts low and wide)
      heights: Object.freeze({ core: Object.freeze({ rail: [4, 55], median: [6, 18] }), frame: Object.freeze({ rail: [2, 6], median: [2, 4] }), outskirts: Object.freeze({ rail: [1, 2], median: [1, 1.5] }) }),
      segments: Object.freeze({ core: Object.freeze({ tower: 1, podium: 4 }) }),
      lively: Object.freeze({ core: Object.freeze({ parking: 0.12 }) }),
      grammar: Object.freeze({
        from: 'north-american', label: 'Los Angeles',
        skin: { mix: { glass: [0.05, 1, 0], stone: [0.7, 0.3, 0.4], brick: [0, 0, 0.1] },
          stone: [['#3f4852', '#e6d6b8'], ['#4a4640', '#d9b99a'], ['#3f4852', '#efe6d4'], ['#4a4640', '#d8a98e'], ['#3f4852', '#cfc3a8']],
          roof: ['#c9c2b2', '#b8b1a2', '#d6d0c4', '#a8a59e'] },
        facade: { awning: { p: 0.4, tints: ['#b8432f', '#2f5d50', '#d9a441', '#2e4a7a'] }, storefront: 0.55 },
        tower: { p: 0.25 },
        green: { palms: 0.7, palm: 'washingtonia' },
      }),
    }),
  }),
  miami: Object.freeze({
    read: 'Miami: pastel block houses and coconut palms under a high noon sun, fair-weather cumulus, a bright sea haze, the colour vivid',
    night: Object.freeze({ read: 'its night: white LED lamps, a clear sea air, the colour kept vivid', lamps: '#eef2ff', air: Object.freeze({ kind: 'haze', visibility: 4000, colour: '#1d2a3a' }), grade: 'vivid' }),
    register: 'tropical', cube: 'island-noon', hour: 'noon', clouds: 'fair',
    air: Object.freeze({ kind: 'haze', visibility: 4200, colour: '#cfe4ea' }), grade: 'vivid',
    // (flat to the water; slender white and blue-glass condo towers at its core, their balconies stacked, a low city of
    // white and pastel render round them, palms everywhere: the Gulf's grammar in a coast's colours)
    city: Object.freeze({
      hills: Object.freeze({ height: 2 }), fall: Object.freeze({ drop: 3, toward: 's' }),
      heights: Object.freeze({ core: Object.freeze({ rail: [8, 70], median: [16, 40] }), frame: Object.freeze({ rail: [3, 12], median: [4, 8] }) }),
      grammar: Object.freeze({
        from: 'gulf', label: 'Miami', locale: 'north-america',
        skin: { mix: { glass: [0.1, 1.3, 0], stone: [0.8, 0.4, 0.3], brick: [0, 0, 0] },
          glass: [['#4f6a78', '#e8eef0'], ['#5d7d8c', '#c3d6dc'], ['#3f5f6e', '#f2f2ee'], ['#6a8c96', '#dfe8ea']],
          stone: [['#3a4550', '#f2efe6'], ['#3a4550', '#e9c3b4'], ['#3a4550', '#bfe0d8'], ['#3a4550', '#f0e2a8'], ['#3a4550', '#e8e4da']],
          roof: ['#e3ddd2', '#d6d0c4', '#c9c2b6'] },
        facade: { balcony: { p: 0.6, types: ['slab', 'continuous'], bays: ['all'] } },
        tower: { slender: [6, 10] },
        green: { palms: 0.85, palm: 'coconut' },
      }),
    }),
  }),
  'san-francisco': Object.freeze({
    read: 'San Francisco: painted Victorians up the hill city\'s streets in the morning, the fog lying low over them under a grey sky, the frame cool',
    night: Object.freeze({ read: 'its night: the fog in, every lamp a halo in it, the frame cool', lamps: '#ffcf8f', air: Object.freeze({ kind: 'mist' }), grade: 'cold' }),
    register: 'san-francisco', cube: 'valley-morning', hour: 'morning', clouds: 'overcast',
    air: Object.freeze({ kind: 'mist' }), grade: 'cold',
    // (the hill city's own land, steep; a downtown of white and grey stone and glass towers, its frame of pale render
    // and bay-windowed flats three and four storeys high)
    city: Object.freeze({
      grammar: Object.freeze({
        from: 'north-american', label: 'San Francisco',
        skin: { mix: { glass: [0.04, 1, 0], stone: [0.6, 0.4, 0.5], brick: [0.1, 0, 0.2] },
          stone: [['#3f4852', '#e9e6de'], ['#444c55', '#d6d2c8'], ['#3b434b', '#f2efe8'], ['#475260', '#cfc8b8']] },
        facade: { balcony: { p: 0.15, types: ['french'], bays: ['alt'] }, storefront: 0.5 },
      }),
    }),
  }),
  boston: Object.freeze({
    read: 'Boston: an inner city of brick walk-ups and main streets on a Northeast metro, an overcast afternoon, a soft haze, the frame filmic',
    night: Object.freeze({ read: 'its night: cold white lamps over its brick, a thin haze', lamps: '#e9f0ff', air: Object.freeze({ kind: 'haze', visibility: 2800, colour: '#22262f' }), grade: 'night' }),
    register: 'northeast', district: 'inner-city', cube: 'upland-morning', hour: 'afternoon', clouds: 'overcast',
    air: Object.freeze({ kind: 'haze', visibility: 3000 }), grade: 'film',
    // (New York's brick and brownstone, without its fire escapes and its water tanks: bow-fronted brick rows, granite
    // and limestone downtown, a few towers; its land in low hills, its drumlins)
    city: Object.freeze({
      hills: Object.freeze({ height: 30 }),
      // (its downtown a cluster of moderate towers over a low brick city)
      heights: Object.freeze({ core: Object.freeze({ rail: [5, 45], median: [8, 20] }) }),
      segments: Object.freeze({ core: Object.freeze({ tower: 2, podium: 3 }) }),
      grammar: Object.freeze({
        from: 'new-york', label: 'Boston',
        facade: { fireEscape: 0.1, kit: [], awning: { p: 0.2, tints: ['#2f4a3a', '#6a2c2c', '#2c3a4c'] }, storefront: 0.5 },
        tower: { p: 0.3 },
      }),
    }),
  }),
  toronto: Object.freeze({
    read: 'Toronto: a lakeshore downtown and its streetcar suburbs of brick bay-and-gables, a fair morning, a light haze',
    night: Object.freeze({ read: 'its night: warm lamps along its streetcar streets, a clear lake air', lamps: '#ffd9a2', air: Object.freeze({ kind: 'haze', visibility: 3200, colour: '#232833' }), grade: 'night' }),
    register: 'bay-and-gable', cube: 'valley-morning', clouds: 'fair',
    air: Object.freeze({ kind: 'haze', visibility: 3500 }),
  }),
});
export const LOCALE_IDS = Object.freeze(Object.keys(LOCALES));

/** A locale's row by its id, or throws naming them. */
export function localeOf(id) {
  if (!LOCALES[id]) throw new Error(`hijack city: locale is ${LOCALE_IDS.join(', ')}`);
  return LOCALES[id];
}
