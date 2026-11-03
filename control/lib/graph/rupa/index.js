/**
 * rupa — destructible physics (internal name; the person says "destructible physics", the level `destruction:
 * 'physical'`). Matter that breaks by what it is made of, falls by what holds it, and ground that craters and digs.
 * Opt-in by design: walls hold and objects break stays every game's default; a game that needs physics asks for it.
 *
 *   matter.js       the table (density, stiffness, strength, the bond between blocks, brittleness, toughness; soils)
 *   ground.js       a soil heightfield: crater, ejecta, slump, dig, deposit, shovel
 *   fluid.js        liquid on the ground grid (pour, flow, drain) and inside: tanks, tubs, pipes, pumps, nozzles
 *   debris.js       what a breaking leaves: pieces and dust for solids, dirt for a crater, a splash for a liquid
 *   the runtime     worlds/controllable/rupa.js (an opt-in builder); its physics is re-exported here, the same source
 *
 *   POWER                 the tiers a world's blows are scaled by: each an order of magnitude or more over the last
 *   readMatterSpec(v)     → the level's `matter` ({ power?, swing?, shot?, blastZ?, heatShare?, fireTime?, cool?,
 *                           pools?, wind? }) checked, as the page's rupa spec (a pool: { min, max, liquid? }, its surface
 *                           at max; the wind: { speed at 10 m, dir, terrain?, gust?, seed? })
 *   impactJoules(m, v)    ½mv² (a cannonball, a car, a falling slab)
 *   breaches(matter, box, joules, fill?) → { joules, capacity, breaks, left } does that blow break that block
 *   rupaPhysics           blastKg, blastJoules, faceArea, burstShare, blowJoules, loadPass, dentOf, dishOf, TOOLS, toolOf
 *                         (the page's own functions)
 *   TOOL_IDS, readTool(v, where) → a strike's `strikeTool` checked: a tool's name, or { is?, edge, stroke?, strength,
 *                           force?, contact? } (what a blow is struck with: controllable/rupa.js TOOL)
 */
import { buildRupa } from '../worlds/controllable/rupa.js';
import { MATTER, blockMatter, resolveMatter, isLiquid, isSoil } from './matter.js';

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

const SPEC_KEYS = ['power', 'swing', 'shot', 'blastZ', 'heatShare', 'fireTime', 'cool', 'pools', 'wind'];
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
      return { min: [...p.min], max: [...p.max], liquid: m.id, density: m.density, viscosity: m.viscosity, tension: m.tension };
    });
  }
  if (v.wind !== undefined) {
    const w = v.wind, at = `${where}.wind`;
    if (!isObj(w) || !pos(w.speed)) throw new Error(`${at} is { speed (m/s at 10 m), dir? (degrees, or [x, y]), terrain? (sea, open, city), gust? (0 to 1), seed? }`);
    if (w.terrain !== undefined && !['sea', 'open', 'city'].includes(w.terrain)) throw new Error(`${at}.terrain is sea, open or city`);
    if (w.gust !== undefined && !(w.gust >= 0 && w.gust <= 1)) throw new Error(`${at}.gust is the gusts' share, 0 to 1`);
    out.wind = { speed: w.speed, dir: w.dir ?? 0, ...(w.terrain ? { terrain: w.terrain } : {}), ...(w.gust !== undefined ? { gust: w.gust } : {}), ...(w.seed !== undefined ? { seed: w.seed } : {}) };
  }
  if (v.heatShare !== undefined) { if (!(Number.isFinite(v.heatShare) && v.heatShare >= 0 && v.heatShare <= 1)) throw new Error(`${where}.heatShare is the share of a burst's energy that is heat, 0 to 1`); out.heatShare = v.heatShare; }
  return out;
}

export const impactJoules = (mass, speed) => 0.5 * mass * speed * speed;

export const TOOL_IDS = Object.freeze(Object.keys(rupaPhysics.TOOLS));
const EDGES = ['blunt', 'edge', 'point'], STROKES = ['level', 'chop'];
/** A strike's tool: a preset's name, or its own numbers laid over one (`is`). Checked at mint; the page reads it as given. */
export function readTool(v, where = 'strikeTool') {
  const say = `${where} is a tool (${TOOL_IDS.join(', ')}) or { is?, edge (${EDGES.join(', ')}), stroke? (${STROKES.join(', ')}), strength (Pa), force? (N), contact? (m) }`;
  if (typeof v === 'string') { if (!rupaPhysics.TOOLS[v]) throw new Error(say); return v; }
  if (!isObj(v)) throw new Error(say);
  for (const k of Object.keys(v)) if (!['is', 'edge', 'stroke', 'strength', 'force', 'contact'].includes(k)) throw new Error(`${where}.${k} is not part of a tool (is, edge, stroke, strength, force, contact)`);
  if (v.is !== undefined && !rupaPhysics.TOOLS[v.is]) throw new Error(`${where}.is: ${say}`);
  const t = rupaPhysics.toolOf(v);
  if (!t || !EDGES.includes(t.edge)) throw new Error(`${where}.edge is ${EDGES.join(', ')} (or name a tool it is, \`is\`)`);
  if (t.stroke !== undefined && !STROKES.includes(t.stroke)) throw new Error(`${where}.stroke is ${STROKES.join(', ')}`);
  if (!pos(t.strength)) throw new Error(`${where}.strength is Pa above 0: the most pressure its face takes`);
  for (const k of ['force', 'contact']) if (t[k] !== undefined && t[k] !== null && !pos(t[k])) throw new Error(`${where}.${k} is a number above 0`);
  return { ...v };
}

/** Does a blow of `joules` break a block of `matter` (an id, a custom record, or { matter, fill }) the size of `box`? */
export function breaches(matter, box, joules) {
  const b = blockMatter(box, matter);
  return { joules, capacity: b.joules, breaks: joules >= b.joules, left: Math.max(0, b.joules - joules), mass: b.mass };
}

/**
 * A level's `scars` (cosmetic damage: the map may not change, but blows still paint what they would do): `true`, or
 * { ground?, wall? } (a matter each), → the runtime's spec: the ground's soil record (what a crater digs and throws) and
 * the walls' matter record (its strength, how big a bowl a blow crushes or, where it yields, dents; what spalls off).
 * Unnamed, the world's cube gives them (`cube`: era/geocube.js cubeMatter, its ground or floor, its walls), else loam
 * and brick. A floor that is not a soil (flagstones) digs as its toughness allows and throws chunks.
 */
export function readScarsSpec(v, { cube = null, where = 'scars' } = {}) {
  if (v === undefined || v === null || v === false) return null;
  if (v !== true && !isObj(v)) throw new Error(`${where} is true or { ground?, wall? }: blows paint what they would do on a map that may not change`);
  if (isObj(v)) for (const k of Object.keys(v)) if (!['ground', 'wall'].includes(k)) throw new Error(`${where}.${k} is not one of ground, wall`);
  const pick = (k, roles, fallback) => (isObj(v) && v[k] !== undefined ? v[k] : roles.map((r) => cube && cube[r] && cube[r].matter).find(Boolean) ?? fallback);
  const g = resolveMatter(pick('ground', ['ground', 'floor'], 'loam'), `${where}.ground`), w = resolveMatter(pick('wall', ['wall'], 'brick'), `${where}.wall`);
  for (const [m, k] of [[g, 'ground'], [w, 'wall']]) if (m.family === 'liquid' || m.family === 'gas') throw new Error(`${where}.${k}: ${m.id} is a ${m.family}`);
  const ground = isSoil(g)
    ? { id: g.id, dig: g.dig, density: g.density, swell: g.swell, c: g.c, mu: g.mu, grain: g.grain, fines: g.fines, particle: g.particle }
    : { id: g.id, dig: g.toughness * 200, density: g.density, swell: 1.2, c: g.bond ?? g.tensile ?? 0, mu: 0.45, grain: 0.002, fines: 0.1, particle: g.density };
  const wall = { id: w.id, density: w.density, compressive: w.compressive, frac: w.frac, shape: w.shape, spread: w.spread, ...(w.yield > 0 ? { yield: w.yield } : {}) };
  return { ground, wall };
}
