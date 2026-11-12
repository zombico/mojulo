/**
 * WETNESS — how wet a place is, by degree, and what each degree lays (era/laws.js 'wet-hugs-the-surface'). Two things
 * make a wet place and they are never confused:
 *
 *   a WETNESS   no thickness, no edge of its own: a state of the surface (its faces dark and sheened, its joints full)
 *   a POOL      standing water: in a slab's hollow it lies level with the slab; set down on a true flat it stands proud
 *               (a sample, rupa/liquid-look.js)
 *
 * The rules that join them:
 *   1. Water finds the low ground first: joints, then hollows, then faces. A place is never wetter on its faces than
 *      in its joints, and never has a pool where its faces are dry (a pool is ringed by wet).
 *   2. A wetness has a CAUSE. Rain is everywhere at once, so everything out of doors is wet and no edge shows; a leak,
 *      a spill, a hose is somewhere, so its wetness is a SPOT that fades from its heart (wet enough there to stand
 *      as a pool, if it is asked to) to nothing, by distance and never at a line.
 *   3. A wall is wet by what runs down it: streaks, heaviest at its foot. A wall is never wetter than the ground
 *      under it.
 *   4. While it rains the pools are struck: rings in every one. When it has stopped they lie still and the faces dry
 *      before the joints, the joints before the pools.
 *
 *   DEGREES   dry      nothing
 *             damp     it rained a while ago: the joints hold, the faces a little dark, the walls' feet; no pool
 *             wet      it has just rained: faces sheened, joints full, pools in the hollows, the walls run
 *             raining  as wet, more of it, the pools struck with rings
 *             downpour water standing over nearly all the ground, struck hard
 *   wetOfWeather(weather) → the degree a weather's state leaves (rain: raining, a downpour or a thunderstorm: downpour,
 *             drizzle: wet, mist or fog: damp), or null: a recipe's weather and its wetness are one thing said once
 *   readWetness(wet) → { amount, walls, pools, rain, spots: [{ at: [x, y, z], r, amount, pool }] } | null
 *     wet     true ('wet') | a degree's name | 0 to 1 (the faces' dial alone: damp to brimming, no pool)
 *             | { degree?, amount?, spots?: [{ at: [x, y] | [x, y, z], size, amount?, pool? }] }
 *     amount  the 0-depth dial; walls how strongly they run; pools the share of open ground standing in water;
 *             rain 0 or 1; a spot's `r` its reach (m), `pool` whether its heart stands as water
 *
 * Pure.
 */
export const DEGREES = Object.freeze({
  dry: Object.freeze({ amount: 0, walls: 0, pools: 0, rain: 0 }),
  damp: Object.freeze({ amount: 0.38, walls: 0.35, pools: 0, rain: 0 }),
  wet: Object.freeze({ amount: 0.78, walls: 0.75, pools: 0.22, rain: 0 }),
  raining: Object.freeze({ amount: 0.95, walls: 1, pools: 0.34, rain: 1 }),
  // (a downpour: the ground cannot shed it, so water stands over nearly all of it, and the rain strikes hard)
  downpour: Object.freeze({ amount: 1, walls: 1, pools: 0.9, rain: 2 }),
});
/** How wet a weather leaves a place (weather/weather.js states): a recipe that names a weather and no `wet` is this wet. */
export const WET_OF_WEATHER = Object.freeze({ mist: 'damp', fog: 'damp', drizzle: 'wet', rain: 'raining', downpour: 'downpour', thunderstorm: 'downpour' });
export const wetOfWeather = (weather) => (typeof weather === 'string' ? WET_OF_WEATHER[weather] ?? null : null);
export const WET_SPOTS_MOST = 6;

export function readWetness(wet) {
  if (wet === undefined || wet === null || wet === false) return null;
  const no = () => { throw new Error(`wet is true, a degree (${Object.keys(DEGREES).join(', ')}), how wet from 0 to 1, or { degree?, amount?, spots?: [{ at: [x, y, z?], size, amount?, pool? }] } (at most ${WET_SPOTS_MOST} spots)`); };
  if (wet === true) return { ...DEGREES.wet, spots: [] };
  if (typeof wet === 'string') return DEGREES[wet] ? (wet === 'dry' ? null : { ...DEGREES[wet], spots: [] }) : no();
  if (typeof wet === 'number') return wet >= 0 && wet <= 1 ? (wet === 0 ? null : { amount: wet, walls: wet, pools: 0, rain: 0, spots: [] }) : no();
  if (typeof wet !== 'object' || Array.isArray(wet) || Object.keys(wet).some((k) => !['degree', 'amount', 'spots'].includes(k))) return no();
  if (wet.degree !== undefined && !DEGREES[wet.degree]) return no();
  if (wet.amount !== undefined && !(typeof wet.amount === 'number' && wet.amount >= 0 && wet.amount <= 1)) return no();
  const spots = wet.spots ?? [];
  if (!Array.isArray(spots) || spots.length > WET_SPOTS_MOST || spots.some((s) => !s || !Array.isArray(s.at) || ![2, 3].includes(s.at.length) || !s.at.every(Number.isFinite) || !(s.size > 0.1 && s.size <= 40)
    || (s.amount !== undefined && !(s.amount > 0 && s.amount <= 1)) || (s.pool !== undefined && typeof s.pool !== 'boolean'))) return no();
  const D = DEGREES[wet.degree ?? 'dry'], out = { ...D, ...(wet.amount !== undefined ? { amount: wet.amount, walls: wet.amount } : {}),
    spots: spots.map((s) => ({ at: [s.at[0], s.at[1], s.at[2] ?? 0], r: s.size / 2, amount: s.amount ?? 0.9, pool: s.pool === true })) };
  return out.amount > 0 || out.spots.length ? out : null;
}
