/**
 * location — the set department's first job: a place PROPOSED for a scene from its own words. A scene that names no
 * set plays on a bare stage; where its words (a client's notes on the event, else its script) name a place, the
 * department says which kind of place suits it and what to ask the geocube for (film.js `sets`: a place asked for), and
 * the hour its words name. It proposes; the film's author takes it or not.
 *
 *   WHICH KIND OF PLACE (what a scene asks decides how the geocube is laid):
 *     a street, a house, a door, a village     → a neighbourhood (`show: 'geotown'`): houses, their fronts, a street
 *     a city, a corner, a tower, traffic       → a metro (`show: 'geocity'`)
 *     land: a field, a lake, a trail, a shore  → a land with nobody on it, in the scene's own words (`{ words }`)
 *   proposeLocation(text) → { ask, hour?, kind: 'geotown' | 'geocity' | 'land', from: [<the words that decided>] } | null
 *     ask    a film's set, asked for: { cube, show } for a town or a city (the preset a starting look, to change), or
 *            { words } for a land (the words of the text the geocube reads as land, in their order)
 *     hour   the hour the text names, where it names one
 *   SHOW_WORDS, SHOW_CUBE, LAND_HINTS   the tables
 *
 * Pure and deterministic.
 */
import { sceneOfWords } from '../gameworld/scene-words.js';
import { HOUR_WORDS } from '../era/geocube-hours.js';

/** the words that ask for a neighbourhood, and for a metro */
export const SHOW_WORDS = Object.freeze({
  geotown: Object.freeze(['street', 'house', 'home', 'door', 'doorstep', 'porch', 'village', 'town', 'neighbourhood', 'neighborhood', 'suburb', 'garden', 'yard', 'kerb', 'curb', 'sidewalk', 'pavement', 'driveway', 'fence']),
  geocity: Object.freeze(['city', 'downtown', 'corner', 'tower', 'towers', 'skyscraper', 'skyline', 'avenue', 'metro', 'traffic', 'alley', 'crossing', 'intersection', 'boulevard', 'waterfront']),
});
/** words that mean a land the geocube's own table does not read, each with the word it is asked as (a land with a
 * trail is what a land is laid as; open ground is a field) */
export const LAND_HINTS = Object.freeze({ trail: 'field', trailhead: 'field', path: 'field', hill: 'hills', hillside: 'hills', moor: 'meadow', clearing: 'meadow', lakeside: 'lake', riverbank: 'river', seaside: 'coast' });
/** the preset each is first asked in: a starting look, changed by whoever takes the proposal */
export const SHOW_CUBE = Object.freeze({ geotown: 'valley-morning', geocity: 'city-night' });
const wordsOf = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);

/** A place proposed from a scene's words (see the header) */
export function proposeLocation(text) {
  const W = wordsOf(text);
  if (!W.length) return null;
  const hourWord = W.find((w) => Object.hasOwn(HOUR_WORDS, w)) ?? (W.includes('evening') ? 'dusk' : W.includes('midnight') ? 'night' : W.includes('sunrise') ? 'dawn' : W.includes('sunset') ? 'dusk' : W.includes('midday') ? 'noon' : null);
  const hour = hourWord ? { hour: hourWord } : {};
  // (a city's word outweighs a town's: a street corner downtown is the metro's)
  for (const kind of ['geocity', 'geotown']) {
    const from = W.filter((w) => SHOW_WORDS[kind].includes(w));
    if (from.length) return { kind, ask: { cube: SHOW_CUBE[kind], show: kind }, ...hour, from: [...new Set(from)] };
  }
  // land: the words the geocube itself reads as a place (not its hour, which is the scene's)
  let read = [];
  try { read = sceneOfWords(W.join(' ')).brief.read; } catch { return null; }
  const land = read.filter((r) => !r.decides.includes('hour') && !Object.hasOwn(HOUR_WORDS, r.word)).map((r) => r.word);
  const hinted = W.filter((w) => Object.hasOwn(LAND_HINTS, w));
  if (!land.length && !hinted.length) return null;
  // (the words the geocube reads, then what the hints stand for where it did not read them)
  const asked = [...new Set([...land, ...hinted.map((w) => LAND_HINTS[w])])];
  return { kind: 'land', ask: { words: asked.join(' ') }, ...hour, from: [...new Set([...land, ...hinted])] };
}
