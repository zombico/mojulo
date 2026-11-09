/**
 * rupa/knock.js — a level's knockback read off the page (worlds/controllable/knock.js moves it): knockback apart from
 * damage, an impact's energy split between the ground and what stands near it.
 *
 *   readKnockback(v, where?) → the world spec's `knock` (true | { scale?, hero?, cap?, splash?, min?, slam?, natural? }),
 *                              or throws what is wrong with it
 *   carriesKnock(...parts)   → true when an attack in them carries its own kinetic or impact (a weapon's `knock`, a
 *                              strike's `strikeKnock`, a beam's `knock`): the world then moves it, without the level's
 *   KNOCK_ENERGY             the words an attack's energy may be said in, in joules
 */
export const KNOCK_ENERGY = Object.freeze({ tap: 50, light: 300, heavy: 3000, massive: 30000 });

export function readKnockback(v, where = 'knockback') {
  if (v === true) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} is true, or { scale?, hero?, cap?, splash?, min?, slam?, natural? }: an impact's energy split between the ground and what stands near it, apart from damage`);
  const keys = ['scale', 'hero', 'cap', 'splash', 'min', 'slam', 'natural'];
  for (const k of Object.keys(v)) if (!keys.includes(k)) throw new Error(`${where}.${k} is not a knockback word (${keys.join(', ')})`);
  for (const k of ['scale', 'cap']) if (v[k] !== undefined && !(typeof v[k] === 'number' && v[k] > 0)) throw new Error(`${where}.${k} is a number above 0 (${k === 'cap' ? 'm/s, the fastest a body is thrown' : 'a multiple of the energy a body takes'})`);
  for (const k of ['hero', 'slam', 'natural']) if (v[k] !== undefined && typeof v[k] !== 'boolean') throw new Error(`${where}.${k} is true or false`);
  if (v.splash !== undefined && !['proximity', 'flat'].includes(v.splash)) throw new Error(`${where}.splash is 'proximity' (a burst's damage falls off with distance) or 'flat'`);
  if (v.min !== undefined && !(typeof v.min === 'number' && v.min >= 0 && v.min <= 1)) throw new Error(`${where}.min is the least share of a burst's damage inside its reach, 0 to 1`);
  return { ...v };
}

/** Whether an attack in these parts (entities, events, a game) carries its own kinetic or impact. */
export function carriesKnock(...parts) {
  return parts.some((p) => p != null && /"(?:knock|strikeKnock)":\{/.test(JSON.stringify(p)));
}
