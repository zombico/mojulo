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
