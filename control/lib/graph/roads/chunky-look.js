/**
 * THE CHUNKY LOOK — a kart track's own drawing (the seventh generation's toy worlds): smooth polygons, never cubes.
 * Everything is a rounded, bevelled chunk a hand could hold, in few saturated colours, under a soft high light with
 * much sky in the shade, and its plastics are glossy. What makes the read:
 *
 *   round      a corner's normal the average of the faces that meet there (shaded-look.js shadeFaces), a wider crease
 *              than the shaded look's, so a bevel reads as a soft edge and not a facet
 *   soft       more sky and bounce than sun: a shade never far under its lit side, never black
 *   gloss      a plastic takes the key's highlight (a face's `gloss`); a matte thing (the way, the turf) none
 *   colour     the design language's own (track-language.js), a touch saturated
 *
 * Two ways to light it:
 *   baked      CHUNKY_LIGHT: the light in the faces' colours as they are built (the sixth generation's way)
 *   form       a kit's `form: true` (the seventh generation, era/eras.js): the faces built in their colour alone
 *              (CHUNKY_FORM_LIGHT: no light in them) with their normals kept, the day's light laid after by the track's
 *              form bake (track-form.js) and the sun's shadow cast live on the page
 *
 *   CHUNKY_LIGHT, CHUNKY_FORM_LIGHT, CHUNKY_SUN   the lights (the baked, the form's albedo pass, the form's day)
 *   chunkyLightOf(K)  → the light a kit's chunky faces are built under
 *   chunkyFaces(faces, { shadows?, light? }) → faces lit per corner. A face: { corners, hex, normal?, gloss? }
 *   chunkyFlat(hex, n, light?) → one flat face's colour under the same light (the way, the ground)
 *
 * Pure, deterministic.
 */
import { shadeFaces } from './shaded-look.js';
import { sunDir } from '../era/sun.js';

export const CHUNKY_LIGHT = Object.freeze({ key: Object.freeze({ elevation: 54, azimuth: 150, color: '#fff3dc' }), sky: '#cfe8ff', ground: '#ffe6c2', fill: 0.86, sunGain: 0.5, shadeFloor: 0.84, saturate: 1.12, crease: 62, glossPower: 14 });
/** The form's albedo pass: white sky and ground at full fill, no sun, no gloss: a face comes out its colour (saturated as
 *  the baked look saturates it), its normals kept for the light laid after. */
export const CHUNKY_FORM_LIGHT = Object.freeze({ key: Object.freeze({ ...CHUNKY_LIGHT.key, color: '#000000' }), sky: '#ffffff', ground: '#ffffff', fill: 1, sunGain: 0, shadeFloor: 0, saturate: CHUNKY_LIGHT.saturate, crease: CHUNKY_LIGHT.crease, glossPower: CHUNKY_LIGHT.glossPower, form: true });
/** The form's day, linear (form/sun-light.js): a warm late-morning sun, low enough (36°) that a post, a ball and an
 *  arch lay shadows long enough to be seen from the kart, the sky a cool blue share so a shadow is soft, never dark. */
export const CHUNKY_SUN = Object.freeze({ sun: Object.freeze([0.86, 0.78, 0.64]), ambient: Object.freeze([0.46, 0.53, 0.68]), dir: Object.freeze(sunDir(36, CHUNKY_LIGHT.key.azimuth)) });

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;

export const chunkyLightOf = (K) => (K?.form ? CHUNKY_FORM_LIGHT : CHUNKY_LIGHT);

export function chunkyFaces(faces, { shadows = false, light = CHUNKY_LIGHT } = {}) {
  return shadeFaces(faces, { colourOf: (f) => hexRgb(f.hex), light, shadows, ...(light.form ? { normals: true } : {}) });
}

export function chunkyFlat(hex, n, light = CHUNKY_LIGHT) {
  const L = sunDir(light.key.elevation, light.key.azimuth), key = hexRgb(light.key.color), sky = hexRgb(light.sky), grd = hexRgb(light.ground);
  const c0 = hexRgb(hex), l = 0.2126 * c0[0] + 0.7152 * c0[1] + 0.0722 * c0[2], c = c0.map((v) => l + (v - l) * light.saturate);
  const up = (n[2] + 1) / 2, lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  return toHex(c.map((v, i) => v * Math.max(light.shadeFloor * sky[i] * 0.9 + 0.1, (sky[i] * up + grd[i] * (1 - up)) * light.fill + key[i] * light.sunGain * lam)));
}
