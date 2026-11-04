/**
 * rupa/one-wind.js — one wind for a world: the level's `wind` (the plants', grass's and hung cloth's: vegetation/wind.js,
 * a speed at 2 m over a log profile) read as destructible physics reads air (controllable/rupa.js windOf: a speed at 10 m
 * rising by a power law), so a bending tree, a drifting leaf, a toppling stack and a plume of smoke feel the same air.
 * rupa is the internal name.
 *
 * THE MATCH: the plants' profile is logarithmic over the ground's roughness z0 (PLANT_Z0, the page's), u(z) ∝ ln(z/z0);
 * the physics' is a power law, u(z) = u10·(z/10)^α. They are made to agree exactly at 2 m and at 10 m (the two heights a
 * person and a crown stand at): u10 = u2·ln(10/z0)/ln(2/z0), α = ln(u10/u2)/ln 5. Between them they differ by under 2%;
 * above 10 m the power law keeps rising a little faster, as measured profiles do over a crown. The direction is the
 * same angle; the gusts' share and seed carry over.
 *
 *   PLANT_Z0                     the roughness the plants' log profile stands on (m)
 *   at10(u2, z0?) · at2(u10, z0?) the wind at 10 m from the wind at 2 m, and back
 *   matchAlpha(z0?)              the power-law exponent that agrees with the log profile at 2 m and 10 m
 *   physicsWind(wind)            the level's `wind` (true or the plants' spec) → the physics' wind spec
 *                                { speed (10 m), dir (degrees), alpha, gust, seed }, or null
 *   plantWind(spec)              the physics' wind spec ({ speed at 10 m, dir, terrain?, alpha?, gust?, seed? }) → the
 *                                plants' { speed (2 m), dir, gust, seed }: a world that names only a physics wind
 */
import { resolveTerrainWind } from '../vegetation/wind.js';

export const PLANT_Z0 = 0.05;
const ALPHA = { sea: 0.11, open: 0.14, city: 0.3 };   // the physics' (controllable/rupa.js windOf)
export const at10 = (u2, z0 = PLANT_Z0) => (u2 * Math.log(10 / z0)) / Math.log(2 / z0);
export const at2 = (u10, z0 = PLANT_Z0) => (u10 * Math.log(2 / z0)) / Math.log(10 / z0);
export const matchAlpha = (z0 = PLANT_Z0) => Math.log(Math.log(10 / z0) / Math.log(2 / z0)) / Math.log(5);

export function physicsWind(wind) {
  const W = resolveTerrainWind(wind);
  if (!W || !(W.speed > 0)) return null;
  return { speed: at10(W.speed), dir: W.dir, alpha: matchAlpha(), gust: W.gust, seed: W.seed };
}

export function plantWind(spec) {
  if (!spec || !(spec.speed > 0)) return null;
  const alpha = spec.alpha ?? ALPHA[spec.terrain] ?? ALPHA.open, dir = Array.isArray(spec.dir) ? (Math.atan2(spec.dir[1], spec.dir[0]) * 180) / Math.PI : spec.dir ?? 0;
  return { speed: spec.speed * Math.pow(0.2, alpha), dir, ...(spec.gust !== undefined ? { gust: spec.gust } : {}), ...(spec.seed !== undefined ? { seed: spec.seed } : {}) };
}
