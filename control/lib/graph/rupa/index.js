/**
 * rupa — destructible physics (internal name; the person says "destructible physics", the level `destruction:
 * 'physical'`). Matter that breaks by what it is made of, falls by what holds it, and ground that craters and digs.
 * Opt-in by design: walls hold and objects break stays every game's default; a game that needs physics asks for it.
 *
 *   matter.js       the table (density, stiffness, strength, the bond between blocks, brittleness, toughness; soils)
 *   ground.js       a soil heightfield: crater, ejecta, slump, dig, deposit, shovel
 *   fluid.js        liquid on the ground grid (pour, flow, drain) and inside: tanks, tubs, pipes, pumps, nozzles
 *   the runtime     worlds/controllable/rupa.js (an opt-in builder); its physics is re-exported here, the same source
 *
 *   POWER                 the tiers a world's blows are scaled by: each an order of magnitude or more over the last
 *   readMatterSpec(v)     → the level's `matter` ({ power?, swing?, shot?, blastZ?, heatShare?, fireTime?, cool?,
 *                           pools? }) checked, as the page's rupa spec (a pool: { min, max, liquid? }, its surface at max)
 *   impactJoules(m, v)    ½mv² (a cannonball, a car, a falling slab)
 *   breaches(matter, box, joules, fill?) → { joules, capacity, breaks, left } does that blow break that block
 *   rupaPhysics           blastKg, blastJoules, faceArea, burstShare, blowJoules, loadPass (the page's own functions)
 */
import { buildRupa } from '../worlds/controllable/rupa.js';
import { blockMatter, resolveMatter, isLiquid } from './matter.js';

const P0 = {};
buildRupa(P0);
export const rupaPhysics = P0.rupaPhysics;

/** A blow's multiplier by who deals it: a person, an action hero, a superhero, a giant monster, a cosmic being. */
export const POWER = Object.freeze({
  human: Object.freeze({ by: 1, says: 'a person: a sword swing ~300 J, a rifle round ~2 kJ' }),
  heroic: Object.freeze({ by: 10, says: 'an action hero: hits like ten people; a brick course falls to a few blows' }),
  super: Object.freeze({ by: 1e3, says: 'a superhero: a punch is an artillery shell; concrete gives, solid steel dents' }),
  titan: Object.freeze({ by: 1e5, says: 'a giant monster: a step levels a house; a building comes down' }),
  cosmic: Object.freeze({ by: 1e8, says: 'a cosmic being: nothing in the world holds' }),
});
export const POWER_IDS = Object.freeze(Object.keys(POWER));

const SPEC_KEYS = ['power', 'swing', 'shot', 'blastZ', 'heatShare', 'fireTime', 'cool', 'pools'];
const SPEC_UNITS = { swing: 'joules', shot: 'joules', blastZ: 'm/kg^⅓', fireTime: 'fire seconds a play second', cool: 'seconds' };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const pos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** The level's `matter` settings → the runtime's spec. Absent → {} (a person's blows, the defaults). */
export function readMatterSpec(v, where = 'matter') {
  if (v === undefined || v === null) return {};
  if (!isObj(v)) throw new Error(`${where} is { power?, swing?, shot?, blastZ?, heatShare?, fireTime?, cool? }: how hard the world's blows land (power: ${POWER_IDS.join(', ')}, or a multiplier) and how its fires run`);
  for (const k of Object.keys(v)) if (!SPEC_KEYS.includes(k)) throw new Error(`${where}.${k} is not one of ${SPEC_KEYS.join(', ')}`);
  const out = {};
  if (v.power !== undefined) {
    if (typeof v.power === 'string') { if (!POWER[v.power]) throw new Error(`${where}.power is ${POWER_IDS.join(', ')}, or a multiplier`); out.power = POWER[v.power].by; }
    else if (pos(v.power)) out.power = v.power;
    else throw new Error(`${where}.power is ${POWER_IDS.join(', ')}, or a multiplier above 0`);
  }
  for (const k of ['swing', 'shot', 'blastZ', 'fireTime', 'cool']) if (v[k] !== undefined) { if (!pos(v[k])) throw new Error(`${where}.${k} is a number above 0 (${SPEC_UNITS[k]})`); out[k] = v[k]; }
  if (v.pools !== undefined) {
    if (!Array.isArray(v.pools)) throw new Error(`${where}.pools is a list of { min, max, liquid? }: liquid standing in the world, its surface at max's height`);
    out.pools = v.pools.map((p, i) => {
      const w = `${where}.pools[${i}]`;
      if (!p || !Array.isArray(p.min) || !Array.isArray(p.max) || p.min.length !== 3 || p.max.length !== 3) throw new Error(`${w} needs min and max [x, y, z]`);
      const m = resolveMatter(p.liquid ?? 'water', `${w}.liquid`);
      if (!isLiquid(m)) throw new Error(`${w}.liquid: ${m.id} is not a liquid`);
      return { min: [...p.min], max: [...p.max], liquid: m.id, density: m.density, viscosity: m.viscosity };
    });
  }
  if (v.heatShare !== undefined) { if (!(Number.isFinite(v.heatShare) && v.heatShare >= 0 && v.heatShare <= 1)) throw new Error(`${where}.heatShare is the share of a burst's energy that is heat, 0 to 1`); out.heatShare = v.heatShare; }
  return out;
}

export const impactJoules = (mass, speed) => 0.5 * mass * speed * speed;

/** Does a blow of `joules` break a block of `matter` (an id, a custom record, or { matter, fill }) the size of `box`? */
export function breaches(matter, box, joules) {
  const b = blockMatter(box, matter);
  return { joules, capacity: b.joules, breaks: joules >= b.joules, left: Math.max(0, b.joules - joules), mass: b.mass };
}
