/**
 * weather — THE SCENE'S WEATHER: what the sky is doing while a scene is shot, whatever its set was made under. One of
 * the world's own weather states (matte-paint/sky.js CLOUDS_OF_WEATHER: clear, haze, mist, fog, dust, overcast,
 * drizzle, rain, downpour, thunderstorm, snow, blizzard, duststorm), lowered to what the Blender light performs
 * (motion/blender-film.js film_light.py): how much of the sun gets through and how soft its shadow is, the sky when
 * cloud covers it, the air (a haze, a mist, a fog), and what falls (rain, snow). The set's form does not change.
 *
 *   WEATHER_STATES            the states a scene takes
 *   weatherSpec(state, { about?, reach? }) → { state, cover, sun, soften, sky?, air?, rain?, snow?, about, reach }
 *     cover   the sky's cover (clear | fair | haze | overcast | storm): CLOUDS_OF_WEATHER
 *     sun     how much of the sun's (or the moon's) light gets through, 0…1
 *     soften  the sun's disc, degrees: a clear sun 0.6, an overcast sky a light from everywhere
 *     sky     { color: [r, g, b], strength } the sky when cloud covers it (a clear sky is the hour's own)
 *     air     { height, density, color } a haze, a mist or a fog: the film's fog volume (the density in mojulo's fog
 *             units, as a world's own fog is: effects/effects-fog.js)
 *     rain, snow   how hard it falls, 0…1
 *     about, reach   where it falls: about the cast ([x, y, z], the scene's frame), out to `reach` metres
 *
 * Pure and deterministic.
 */
import { CLOUDS_OF_WEATHER } from '../matte-paint/sky.js';

/** the sky's cover → the sun through it, its softness, and the sky under cloud */
const COVER = Object.freeze({
  clear: { sun: 1, soften: 0.6 },
  fair: { sun: 0.9, soften: 2 },
  haze: { sun: 0.6, soften: 8 },
  overcast: { sun: 0.14, soften: 40, sky: { color: [0.56, 0.59, 0.63], strength: 0.85 } },
  storm: { sun: 0.05, soften: 50, sky: { color: [0.2, 0.22, 0.26], strength: 0.75 } },
});
const GREY = [0.8, 0.83, 0.87], TAN = [0.78, 0.66, 0.48], WHITE = [0.92, 0.94, 0.97];
/** what a state adds to its cover: the air, and what falls */
const STATE = Object.freeze({
  haze: { air: { height: 60, density: 0.012, color: GREY } },
  mist: { air: { height: 25, density: 0.05, color: GREY } },
  fog: { air: { height: 40, density: 0.16, color: GREY } },
  dust: { air: { height: 50, density: 0.04, color: TAN } },
  drizzle: { rain: 0.3, air: { height: 40, density: 0.015, color: GREY } },
  rain: { rain: 0.6, air: { height: 50, density: 0.02, color: GREY } },
  downpour: { rain: 1, air: { height: 50, density: 0.05, color: GREY } },
  thunderstorm: { rain: 0.9, air: { height: 50, density: 0.04, color: GREY } },
  snow: { snow: 0.5, air: { height: 40, density: 0.015, color: WHITE } },
  blizzard: { snow: 1, air: { height: 40, density: 0.09, color: WHITE } },
  duststorm: { air: { height: 60, density: 0.14, color: TAN } },
});
/** the states a scene takes: the world's, but the two that are things on the wind (petals, leaves), which no film makes */
export const WEATHER_STATES = Object.freeze(Object.keys(CLOUDS_OF_WEATHER).filter((k) => k !== 'petals' && k !== 'leaves'));
/** how far about the cast rain and snow fall, metres */
export const WEATHER_REACH = 30;

/** A weather state as the Blender light performs it (see the header) */
export function weatherSpec(state, { about = [0, 0, 0], reach = WEATHER_REACH } = {}) {
  if (!WEATHER_STATES.includes(state)) throw new Error(`weather is one of ${WEATHER_STATES.join(', ')}; got ${JSON.stringify(state)}`);
  const cover = CLOUDS_OF_WEATHER[state], C = COVER[cover], S = STATE[state] ?? {};
  return {
    state, cover, sun: C.sun, soften: C.soften,
    ...(C.sky ? { sky: { color: [...C.sky.color], strength: C.sky.strength } } : {}),
    ...(S.air ? { air: { height: S.air.height, density: S.air.density, color: [...S.air.color] } } : {}),
    ...(S.rain ? { rain: S.rain } : {}), ...(S.snow ? { snow: S.snow } : {}),
    about: about.map((v) => Math.round(v * 1000) / 1000), reach,
  };
}
