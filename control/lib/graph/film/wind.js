/**
 * wind — THE SCENE'S WIND: how hard the air moves while a scene is shot. A word (still, breeze, fresh, gale), a number
 * 0…1, `'weather'` (the wind the scene's own weather blows: weather/weather.js STATES `wind` and `gust`), or
 * { speed, gust?, from? } (`from`: the bearing it blows from, degrees clockwise from north, +y). The film takes it to
 * the set's PLANTS (motion/blender-film.js film_light.py `wind`): the trees, palms, bamboo and bushes near the cast lean
 * downwind and sway, more with height, their feet still, a flutter over it; each frame a function of the scene's time
 * alone (geometry nodes, no simulation), so any frame renders alone. The set's form does not change.
 *
 *   WIND_WORDS                the words a scene's wind takes, each its speed 0…1
 *   windErrors(v)             → [message]
 *   windSpec(v, { weather?, about? }) → { speed, gust, from, lean, sway, hz, flutter, plants, about, reach, most } | null
 *     (null: still air, nothing to perform)
 *     lean     how far a plant's top leans downwind, as a share of its height
 *     sway     how far it swings about that lean, the same share
 *     hz       how often an 8 m tree swings, a second (a shorter plant swings faster, by the root of its height)
 *     flutter  its leaves' own quiver, metres
 *     plants   the words a plant's object is known by in a set's pack
 *
 * Pure and deterministic.
 */
import { STATES } from '../weather/weather.js';
import { SPECIES } from '../vegetation/species.js';

export const WIND_WORDS = Object.freeze({ still: 0, breeze: 0.25, fresh: 0.5, gale: 1 });
const WIND_KEYS = ['speed', 'gust', 'from'];
/** how far about the cast the plants are moved, metres, and how many at most (the nearest first) */
export const WIND_REACH = 60, WIND_MOST = 120;
/** the words a plant's object carries in a set's pack, each a whole word of its name: a pooled tree
 *  (`…:tree-maple-L0:12`, `maple-L2:3`: the grower's species, vegetation/species.js), the form's flora (`form:flora:…`),
 *  and the shelves' own names */
export const PLANT_WORDS = Object.freeze([...new Set(['tree', 'flora', 'palm', 'bamboo', 'bush', 'shrub', 'hedge', 'conifer', 'fern', ...Object.keys(SPECIES).map((k) => k.toLowerCase())])]);
const r3 = (v) => Math.round(v * 1000) / 1000;
const unit = (v) => typeof v === 'number' && v >= 0 && v <= 1;

export function windErrors(v) {
  const says = `wind: how hard the air moves, one of ${Object.keys(WIND_WORDS).join(', ')}, 'weather' (the scene's weather's own), a number 0 to 1, or { speed, gust?, from? }`;
  if (typeof v === 'string') return v === 'weather' || Object.hasOwn(WIND_WORDS, v) ? [] : [says];
  if (typeof v === 'number') return unit(v) ? [] : [says];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [says];
  const errs = [], bad = Object.keys(v).filter((k) => !WIND_KEYS.includes(k));
  if (bad.length) errs.push(`wind takes ${WIND_KEYS.join(', ')} (not ${bad.join(', ')})`);
  if (!(unit(v.speed) || Object.hasOwn(WIND_WORDS, v.speed))) errs.push(`wind.speed: one of ${Object.keys(WIND_WORDS).join(', ')}, or a number 0 to 1`);
  if (v.gust !== undefined && !unit(v.gust)) errs.push('wind.gust: how much it comes and goes, 0 to 1');
  if (v.from !== undefined && !(Number.isFinite(v.from) && v.from >= 0 && v.from < 360)) errs.push('wind.from: the bearing it blows from, degrees clockwise from north (+y), 0 up to 360');
  return errs;
}

/** The scene's wind as the film's plants take it; null in still air. */
export function windSpec(v, { weather = null, about = [0, 0] } = {}) {
  const errs = windErrors(v);
  if (errs.length) throw new Error(errs[0]);
  const W = v === 'weather' ? STATES[weather] ?? null : null;
  if (v === 'weather' && !W) throw new Error(`wind 'weather' blows the scene's weather's own wind: give the scene a weather (${Object.keys(STATES).slice(0, 4).join(', ')}, …)`);
  const word = (s) => (typeof s === 'string' ? WIND_WORDS[s] : s);
  const speed = W ? W.wind : typeof v === 'object' ? word(v.speed) : word(v);
  const gust = W ? W.gust : typeof v === 'object' && v.gust !== undefined ? v.gust : r3(speed * 0.5);
  if (!(speed > 0)) return null;
  return {
    speed: r3(speed), gust: r3(gust), from: typeof v === 'object' && v.from !== undefined ? v.from : 250,
    // (a pendulum's push goes as the speed squared: a breeze stirs, a gale bends)
    lean: r3(0.07 * speed * speed), sway: r3(0.012 + 0.05 * speed * speed), hz: r3(0.3 + 0.25 * speed), flutter: r3(0.01 + 0.05 * speed),
    plants: [...PLANT_WORDS], about: [r3(about[0]), r3(about[1])], reach: WIND_REACH, most: WIND_MOST,
  };
}
