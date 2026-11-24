/**
 * A CITY GAME'S LOCALES — where a Hijack City is (gameworld/hijack-city.js `locale`): each a row of words the game
 * already reads, said together so a city reads as a place. Its suburbs' register (geotown/pattern.js, via the district's
 * `outskirts`), the part of town it stands in unless the person names one (`district`, HIJACK_DISTRICTS), its light (the
 * geocube it is lit by and the hour), its sky (`clouds`), its air (gen-7 `air`: a haze or a mist, its colour, how far
 * it sees) and its colour grade (the world's `grade`, laid over every frame). A template's defaults: every word a person
 * writes wins, and a new locale is a row, never code.
 *
 *   LOCALES              { <id>: { read, register, district?, cube, hour?, clouds?, air?, grade? } }
 *   LOCALE_IDS
 *   localeOf(id)         → the row, or throws naming the locales
 *
 * Pure data and a reader.
 */
export const LOCALES = Object.freeze({
  'los-angeles': Object.freeze({
    read: 'Los Angeles: stucco ranches and palms under a low gold sun, the far blocks lost in a warm smog, the frame warm',
    register: 'west-coast', cube: 'valley-morning', hour: 'golden', clouds: 'clear',
    air: Object.freeze({ kind: 'haze', visibility: 2600, colour: '#d8c4a2' }), grade: 'warm',
  }),
  miami: Object.freeze({
    read: 'Miami: pastel block houses and coconut palms under a high noon sun, fair-weather cumulus, a bright sea haze, the colour vivid',
    register: 'tropical', cube: 'island-noon', hour: 'noon', clouds: 'fair',
    air: Object.freeze({ kind: 'haze', visibility: 4200, colour: '#cfe4ea' }), grade: 'vivid',
  }),
  'san-francisco': Object.freeze({
    read: 'San Francisco: painted Victorians up the hill city\'s streets in the morning, the fog lying low over them under a grey sky, the frame cool',
    register: 'san-francisco', cube: 'valley-morning', hour: 'morning', clouds: 'overcast',
    air: Object.freeze({ kind: 'mist' }), grade: 'cold',
  }),
  boston: Object.freeze({
    read: 'Boston: an inner city of brick walk-ups and main streets on a Northeast metro, an overcast afternoon, a soft haze, the frame filmic',
    register: 'northeast', district: 'inner-city', cube: 'upland-morning', hour: 'afternoon', clouds: 'overcast',
    air: Object.freeze({ kind: 'haze', visibility: 3000 }), grade: 'film',
  }),
  toronto: Object.freeze({
    read: 'Toronto: a lakeshore downtown and its streetcar suburbs of brick bay-and-gables, a fair morning, a light haze',
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
