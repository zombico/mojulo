/**
 * clouds — THE SCENE'S CLOUDS: the sky over a scene while it is shot, whatever its set was made under. One of the
 * world's own skies (matte-paint/sky.js WEATHERS: clear, fair, overcast, storm, haze, high), or { kind, cover?, seed? }
 * as a world's recipe says it (`readClouds`). The film takes two things from it (motion/blender-film.js film_light.py):
 * the LIGHT (how much of the sun gets through and how soft its shadow is, a grey sky under a full cover: the weather's
 * own table, film/weather.js COVER, slid by `cover`), and the CLOUDS SEEN: the world's painted cloud band
 * (`paintCloudBand`, the band a geocube's dome wears), painted for the film's own sun at the scene's hour and laid
 * round the Blender sky. The weather is what the air does and what falls; a scene may have both.
 *
 *   CLOUD_KINDS               the skies a scene takes
 *   cloudsErrors(v)           → [message]
 *   cloudsSpec(v, { preset? }) → { kind, cover, seed, sun, soften, sky?, band: 'clouds.png', top }
 *   cloudsPng(spec, { preset? }) → the band as a PNG (round the dome from +x toward +y, the horizon up to `top` degrees)
 *
 * Pure and deterministic: the band's dice are its seed's.
 */
import { WEATHERS, readClouds, paintCloudBand } from '../matte-paint/sky.js';
import { encodePngRgba } from '../landscape/surface-textures.js';
import { COVER } from './weather.js';

export const CLOUD_KINDS = Object.freeze(Object.keys(WEATHERS));
export const CLOUDS_FILE = 'clouds.png';
const r3 = (v) => Math.round(v * 1000) / 1000;

/** the film's own sun and sky at each of its light's presets (film_light.py: the sun's height and bearing, its colour),
 *  and how bright the painted band stands against that sky (`gain`: the film's day sky is a physical one, far brighter
 *  than a painted colour; its night sky far darker) */
const AZIMUTH = 215;
const HOURS = Object.freeze({
  day: { elevation: 35, key: '#fff3e2', zenith: '#3f6fb5', horizon: '#b7cde6', night: 0, gain: 3 },
  dawn: { elevation: 12, key: '#ffb47a', zenith: '#3d4f80', horizon: '#eda878', night: 0, gain: 1.5 },
  dusk: { elevation: 12, key: '#ffb47a', zenith: '#3d4f80', horizon: '#eda878', night: 0, gain: 1.5 },
  night: { elevation: 40, key: '#a9bfff', zenith: '#070a14', horizon: '#141a28', night: 1, gain: 0.06 },
});
const hourOf = (preset) => HOURS[preset] ?? HOURS.day;

export function cloudsErrors(v) {
  try { readClouds(v); return []; } catch (e) { return [`clouds: the sky over the scene, ${e.message.replace(/^clouds /, '')}`]; }
}

/** The scene's clouds as the film's light takes them. `cover` 0.5 is the sky's own: less lets more sun through. */
export function cloudsSpec(v, { preset = 'day' } = {}) {
  const C = readClouds(v), K = COVER[C.kind] ?? COVER.fair, k = C.cover / 0.5, grey = !!K.sky && C.cover >= 0.5;
  return {
    kind: C.kind, cover: C.cover, seed: C.seed,
    sun: r3(K.sun ** k), soften: r3(Math.max(0.6, K.soften * k)),
    ...(grey ? { sky: { color: [...K.sky.color], strength: K.sky.strength } } : {}),
    // (under a grey sky the band is laid over a painted colour like itself: no gain)
    band: CLOUDS_FILE, top: 62, gain: grey && preset !== 'night' ? 1 : hourOf(preset).gain, azimuth: AZIMUTH, elevation: hourOf(preset).elevation,
  };
}

/** The band, painted for the film's sun at the scene's hour. */
export function cloudsPng(spec, { preset = 'day', W = 3072, H = 384 } = {}) {
  const Hh = hourOf(preset), el = (Hh.elevation * Math.PI) / 180, az = (AZIMUTH * Math.PI) / 180;
  const B = paintCloudBand({ clouds: { kind: spec.kind, cover: spec.cover, seed: spec.seed }, sun: [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)],
    key: Hh.key, zenith: Hh.zenith, horizon: Hh.horizon, night: Hh.night }, { W, H, top: spec.top });
  return encodePngRgba(B.rgba, B.W, B.H);
}
