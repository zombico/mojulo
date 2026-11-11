/**
 * THE PAGE'S LIGHT, ONE RECORD (the World page, scene/scene-three.js): where the sun stands, what colour it and the sky
 * are, resolved once from a payload so that every channel that shades or casts reads the same light. Before it each
 * channel took its own argument with its own fallback, and two could disagree on one page (a gen-7 city's shadows fell
 * along a default sun while its land was lit by the cube's).
 *
 *   pageLight({ light, form, sky }) → { toLight: [x, y, z] toward the sun (unit), from, sun?, ambient?, sky?, indoor }
 *     from     where the direction was read, the first that holds:
 *                'land'    the form render's land (form.land.sun: the cube's solved sun at the level's hour)
 *                'town'    a town's or a city's baked buildings (form.town: its one lamp, far off along the sun's way)
 *                'stage'   a stage under a sun or a moon (form.room with `sun`: its last lamp, the same)
 *                'baked'   the payload's baked light (light.toLight)
 *                'default' none of them: the polygonizer's default light (polygonizer/vexar.js DEFAULT_LIGHT)
 *     sun, ambient   the solved light where the form render carries it (linear, the solve's units), else absent
 *     sky      { zenith, horizon } where the payload paints one
 *     indoor   a room under no sun (form.room without `sun`): its lamps are its light, the direction a formality
 *   shadowToLight(record, shadows?) → the direction a shadow is cast along: the world's own (`shadows.toLight`) where it
 *     names one; else the record's, unless the sun stands on the horizon (under SHADOW_LOW: a shadow of unbounded
 *     length) or the page has no light of its own ('default'), where it is SHADOW_SUN, as it always was (a minted
 *     page's shadows stay where they fell)
 *   lightAgrees(dirs, tol?) → do these directions agree (each within `tol` of the first, by their cosine)? The machine
 *     gate's check that one page has one sun.
 *
 *   readFinish(light) → null | { curve, reflect }: a world's `light.finish`, the opt-in to what is laid over the bake
 *     (absent ⇒ null ⇒ the page as it was). `true` or a curve's word ('neutral') is the default finish; an object names
 *     its parts ({ curve?, reflect? }). An unknown word or key teaches
 *   skyEnv(sky) → { zenith, horizon, ground } (display rgb, 0..1): the painted sky as an environment a face reflects,
 *     its ground the horizon darkened (SKY_ENV.ground)
 *   envAt(z, env) → the environment's colour along a direction whose height is z (−1..1): the law the specular
 *     channel's shader runs (channels/specular.js), mirrored here so a test holds the two together; the metal's studio
 *     (channels/metal.js metStudio) is the same dome and ground
 *
 * Pure: no dice, no clock. Shading reads `toLight`; only shadow casting reads `shadowToLight`.
 */
import { DEFAULT_LIGHT } from '../polygonizer/vexar.js';

/** The sun a shadow is cast along where the page's own cannot be used, and how low a sun may stand to cast one. */
export const SHADOW_SUN = Object.freeze([0.55, 0.4, 0.72]), SHADOW_LOW = 0.05;

const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-9 ? v.map((x) => x / l) : null; };
// a lamp set far off along the sun's way (form/sun-light.js, era/stage.js): its place is its direction
const farLamp = (lights) => { const l = Array.isArray(lights) ? lights.find((x) => x && x.radius > 1e8 && vec3(x.at)) : null; return l ? unit(l.at) : null; };

export function pageLight({ light = null, form = null, sky = null } = {}) {
  const land = form && form.land, town = form && form.town, room = form && form.room;
  const skyOf = (s) => (s && Array.isArray(s.zenith) && Array.isArray(s.horizon) ? { zenith: s.zenith, horizon: s.horizon } : null);
  const painted = skyOf(land && land.sky) || skyOf(sky);
  const out = (toLight, from, extra = {}) => ({ toLight, from, ...extra, ...(painted ? { sky: painted } : {}), indoor: !!(room && !room.sun) });
  if (land && vec3(land.sun)) return out(land.sun, 'land', land.light && vec3(land.light.sun) ? { sun: land.light.sun, ...(vec3(land.light.ambient) ? { ambient: land.light.ambient } : {}) } : {});
  const lit = (F) => { const l = F.lights.find((x) => x && x.radius > 1e8); return { ...(l && vec3(l.key) ? { sun: l.key } : {}), ...(vec3(F.ambient) ? { ambient: F.ambient } : {}) }; };
  if (town && farLamp(town.lights)) return out(farLamp(town.lights), 'town', lit(town));
  if (room && room.sun && farLamp(room.lights)) return out(farLamp(room.lights), 'stage', lit(room));
  if (light && vec3(light.toLight)) return out(light.toLight, 'baked');
  return out(DEFAULT_LIGHT.toLight, 'default');
}

export function shadowToLight(record, shadows = null) {
  if (shadows && vec3(shadows.toLight)) return shadows.toLight;
  return record.from !== 'default' && record.toLight[2] > SHADOW_LOW ? record.toLight : [...SHADOW_SUN];
}

export function lightAgrees(dirs, tol = 1e-3) {
  const U = dirs.map((d) => (vec3(d) ? unit(d) : null));
  if (U.some((u) => !u)) return false;
  return U.every((u) => u[0] * U[0][0] + u[1] * U[0][1] + u[2] * U[0][2] > 1 - tol);
}

/** The finish's curves (the tone curve a page's lit frame is drawn through), and the sky's environment: how the dome
 *  rises from the horizon (`rise`), how dark the ground is against the horizon (`ground`), how fast it falls to the
 *  ground under the horizon (`fall`), and the horizon's share just under itself (`under`). */
export const FINISH_CURVES = Object.freeze(['neutral']);
export const SKY_ENV = Object.freeze({ rise: 0.7, ground: 0.35, fall: 8, under: 0.6 });

export function readFinish(light) {
  const f = light && typeof light === 'object' ? light.finish : undefined;
  if (f === undefined || f === null || f === false) return null;
  const no = (msg) => { throw new Error(`light.finish: ${msg}`); };
  const curve = (w) => (FINISH_CURVES.includes(w) ? w : no(`curve '${w}' is not one of ${FINISH_CURVES.join(', ')}`));
  if (f === true) return { curve: 'neutral', reflect: true };
  if (typeof f === 'string') return { curve: curve(f), reflect: true };
  if (typeof f !== 'object' || Array.isArray(f)) no('is true, a curve\'s word, or { curve?, reflect? }');
  for (const k of Object.keys(f)) if (!['curve', 'reflect'].includes(k)) no(`'${k}' is not a part of it (curve, reflect)`);
  if (f.reflect !== undefined && typeof f.reflect !== 'boolean') no('reflect is true or false');
  return { curve: f.curve === undefined ? 'neutral' : curve(f.curve), reflect: f.reflect !== false };
}

const rgb01 = (c) => (c.some((v) => v > 1) ? c.map((v) => v / 255) : [...c]).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4);
export function skyEnv(sky) {
  if (!sky || !Array.isArray(sky.zenith) || !Array.isArray(sky.horizon)) return null;
  const zenith = rgb01(sky.zenith.slice(0, 3)), horizon = rgb01(sky.horizon.slice(0, 3));
  return { zenith, horizon, ground: horizon.map((v) => Math.round(v * SKY_ENV.ground * 1e4) / 1e4) };
}
export function envAt(z, env) {
  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  return z > 0 ? mix(env.horizon, env.zenith, z ** SKY_ENV.rise) : mix(env.ground, env.horizon.map((v) => v * SKY_ENV.under), Math.exp(SKY_ENV.fall * z));
}
