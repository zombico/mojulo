/**
 * rupa/vayo-move.js — the vayo moves read and resolved off the page: a hero's `rule.vayo` (a special ability that moves it
 * on its own air: a dash, a flight, an air jump) checked with teaching messages, resolved to the numbers its runtime moves by, and
 * read in words for the power book. The law itself lives in the runtime's builder (worlds/controllable/vayo-move.js,
 * import-free so the page runs it), and is taken from there, so Node and the page move by one law.
 *
 *   readVayo(v, where?)          → the spec as given, or throws what is wrong with it
 *   resolveVayo(v, rule?, power?) → { element, color, cap, power, regen, dash?, flight? } (play and fiction speeds, the
 *                                   air's pressure and density, the dash's rise and carry, the flight's climb)
 *   vayoWords(v, rule?, power?)  → a line for the book ("dashes on the wind: 12 m/s, a 6 m carry")
 *   VAYO_ELEMENTS, VAYO_POWER, vayoLaw
 */
import { buildVayoMove } from '../worlds/controllable/vayo-move.js';

const L = {};
buildVayoMove(L);
export const vayoLaw = L.vayoMove.law;
export const VAYO_ELEMENTS = Object.freeze(Object.keys(L.vayoMove.ELEMENTS));
export const VAYO_POWER = Object.freeze({ ...L.vayoMove.POWER });

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const pos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const MOVE_KEYS = {
  dash: ['speed', 'rise', 'carry', 'dir', 'steer', 'air', 'iframes', 'cost', 'cooldown', 'pressure', 'density'],
  flight: ['speed', 'rise', 'carry', 'climb', 'boost', 'drain', 'pressure', 'density'],
  jump: ['height', 'rise', 'count', 'pressure', 'density'],
};

/** A hero's `rule.vayo`, checked. */
export function readVayo(v, where = 'rule.vayo') {
  if (!isObj(v)) throw new Error(`${where} is { element?, power?, cap?, regen?, dash?, flight?, jump? }: a special ability that moves the hero on its own air`);
  const known = ['element', 'power', 'cap', 'regen', 'dash', 'flight', 'jump'];
  for (const k of Object.keys(v)) if (!known.includes(k)) throw new Error(`${where}.${k} is not a vayo word (${known.join(', ')})`);
  if (v.element !== undefined && !VAYO_ELEMENTS.includes(v.element)) throw new Error(`${where}.element is one of ${VAYO_ELEMENTS.join(', ')}`);
  if (v.power !== undefined && !(pos(v.power) || VAYO_POWER[v.power])) throw new Error(`${where}.power is a tier (${Object.keys(VAYO_POWER).join(', ')}) or a multiplier above 0`);
  for (const k of ['cap', 'regen']) if (v[k] !== undefined && !pos(v[k])) throw new Error(`${where}.${k} is a number above 0 (${k === 'cap' ? 'm/s, the play cap' : 'the meter a second'})`);
  if (!v.dash && !v.flight && !v.jump) throw new Error(`${where} names no move: a dash, a flight, a jump, or more than one`);
  for (const kind of ['dash', 'flight', 'jump']) {
    const m = v[kind];
    if (m === undefined || m === true) continue;
    if (!isObj(m)) throw new Error(`${where}.${kind} is true or { ${MOVE_KEYS[kind].join(', ')} }`);
    for (const k of Object.keys(m)) if (!MOVE_KEYS[kind].includes(k)) throw new Error(`${where}.${kind}.${k} is not a ${kind} word (${MOVE_KEYS[kind].join(', ')})`);
    if (m.count !== undefined && !(Number.isInteger(m.count) && m.count >= 1)) throw new Error(`${where}.${kind}.count is a whole number of 1 or more (how many before the ground again)`);
    for (const k of ['speed', 'rise', 'carry', 'climb', 'boost', 'height', 'pressure', 'density']) if (m[k] !== undefined && !pos(m[k])) throw new Error(`${where}.${kind}.${k} is a number above 0`);
    for (const k of ['cost', 'drain', 'cooldown', 'steer']) if (m[k] !== undefined && !(typeof m[k] === 'number' && m[k] >= 0)) throw new Error(`${where}.${kind}.${k} is a number of 0 or more`);
    if ((m.pressure === undefined) !== (m.density === undefined)) throw new Error(`${where}.${kind}: pressure and density go together (or neither: speed, rise and carry say it)`);
    if (m.dir !== undefined && !['input', 'facing'].includes(m.dir)) throw new Error(`${where}.${kind}.dir is 'input' (the stick's way) or 'facing'`);
    if (m.air !== undefined && typeof m.air !== 'boolean') throw new Error(`${where}.${kind}.air is true or false`);
    if (m.iframes !== undefined) {
      const ok = (a) => Array.isArray(a) && a.length === 2 && a.every((x) => typeof x === 'number' && x >= 0) && a[1] > a[0];
      if (!(ok(m.iframes) || (isObj(m.iframes) && ok(m.iframes.frames)))) throw new Error(`${where}.${kind}.iframes is [from, to] in seconds from its start, or { frames: [from, to] } at 60 fps`);
    }
  }
  return v;
}

/** A hero's vayo resolved to the numbers its runtime moves by (the world's power when the hero names none). */
export function resolveVayo(v, rule = {}, power = undefined) { return L.vayoMove.resolve(readVayo(v), rule, power); }

const r1 = (x) => Math.round(x * 10) / 10;
/** The vayo moves in words, for the power book. */
export function vayoWords(v, rule = {}, power = undefined) {
  const R = resolveVayo(v, rule, power), on = R.element ? ` on the ${R.element}` : '', out = [];
  const tier = (m) => (m.over > 0 ? ` (its tier's ${Math.round(m.fiction)} m/s, held to ${R.cap} for play)` : '');
  if (R.dash) out.push(`dashes${on}: ${r1(R.dash.play)} m/s in ${Math.round(R.dash.rise * 1000)} ms, a ${r1(R.dash.carry)} m carry${tier(R.dash)}${R.dash.iframes ? ', untouchable for part of it' : ''}`);
  if (R.jump) out.push(`jumps again in the air${on}: ${r1(R.jump.height)} m up on its own air${R.jump.count > 1 ? `, ${R.jump.count} times before the ground` : ''}${tier(R.jump)}`);
  if (R.flight) out.push(`flies${on}: ${r1(R.flight.play)} m/s, climbs at ${r1(R.flight.climb)}, hovers when let go${tier(R.flight)}`);
  return out.join('; ');
}
