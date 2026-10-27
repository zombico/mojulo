/**
 * THE FOE CLASS SHELF: one row per class (classes/<id>.js exporting `foe`), checked as it loads. A new class is a row
 * first; code only when a row needs a move or an attack word that does not exist (./vocab.js).
 *
 *   FOE_CLASSES       { [id]: row }, in the shelf's order
 *   foeClass(id)      one, or throws naming the known ids
 *   validateClass(row)  throws naming the word that is wrong; the shelf runs it on every row
 *   classStatus(row)  → { status, marks: { [engine]: mark }, short: ['move pace (absent)', …] }: the worst of its
 *                     move's and its attack's lowerings, so a class is built only when everything it does runs
 *
 * A row: { id, reads, move, pace?, attack: { kind, pattern?, timing?, reach?, zone? }, mind: { aggressiveness,
 * motivation?, perception?, pathing? }, fits: { support?, size?, gaits?, wings? }, presence (its body's size, its
 * longest extent, as a share of the hero's height), toll: { downs, harm }, stomp, threat, standIn }. `mind.motivation` defaults to the move's; rank and skill are the foe's, never the class's.
 *
 * Pure; reads the mind's vocabulary and the engines' marks only (no fauna), so the cosmos facets can import it.
 */
import { PACES, MOVES, ATTACKS, STOMPS } from './vocab.js';
import { MOTIVATIONS, AGGRESSIVENESS } from '../mind/vocab.js';
import { marksAcross, MARKED_ENGINES } from '../scene/engines/registry.js';
import { worstMark } from '../scene/engines/marks.js';
import { foe as walker } from './classes/walker.js';
import { foe as hopper } from './classes/hopper.js';
import { foe as charger } from './classes/charger.js';
import { foe as swooper } from './classes/swooper.js';
import { foe as turret } from './classes/turret.js';
import { foe as lobber } from './classes/lobber.js';
import { foe as swarm } from './classes/swarm.js';
import { foe as lurker } from './classes/lurker.js';
import { foe as brute } from './classes/brute.js';
import { foe as stalker } from './classes/stalker.js';

const ROW_KEYS = ['id', 'reads', 'move', 'pace', 'attack', 'mind', 'fits', 'presence', 'toll', 'stomp', 'threat', 'standIn'];
const ATTACK_KEYS = ['kind', 'pattern', 'timing', 'reach', 'zone'];
const TIMING_KEYS = ['startup', 'active', 'recovery'];
const MIND_KEYS = ['motivation', 'aggressiveness', 'perception', 'pathing'];
const FIT_KEYS = ['support', 'size', 'gaits', 'wings'];
const SUPPORTS = ['four', 'two', 'wingwalk', 'fins', 'none'];
const ZONES = ['orange', 'red'];
// fauna/size-class.js SIZE_CLASS_IDS, said here so the shelf imports no skeleton (the laws hold the two equal)
export const SIZES = Object.freeze(['mini', 'smol', 'chonky', 'behemoth', 'gargantuan']);

const known = (what, v, table) => {
  const keys = Array.isArray(table) ? table : Object.keys(table);
  if (!keys.includes(v)) throw new Error(`foe class: unknown ${what} '${v}' (known: ${keys.join(', ')})`);
};
const closed = (what, o, keys) => { for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`foe class: ${what} has no key '${k}' (known: ${keys.join(', ')})`); };
const count = (what, v, min) => { if (!(Number.isFinite(v) && v >= min)) throw new Error(`foe class: ${what} is a number, at least ${min} (not ${v})`); };

export function validateClass(row) {
  if (!row || typeof row !== 'object') throw new Error('foe class: a class is a row ({ id, reads, move, attack, mind, fits, toll, stomp, threat, standIn })');
  closed(`'${row.id}'`, row, ROW_KEYS);
  const at = (w) => `'${row.id}' ${w}`;
  if (typeof row.id !== 'string' || !row.id) throw new Error('foe class: a class needs its id');
  if (typeof row.reads !== 'string' || !row.reads) throw new Error(`foe class: ${at('needs `reads`, the line it reads as')}`);
  known(at('move'), row.move, MOVES);
  if (row.pace !== undefined) known(at('pace'), row.pace, PACES);
  closed(at('attack'), row.attack || {}, ATTACK_KEYS);
  known(at('attack'), row.attack?.kind, ATTACKS);
  if (row.attack.timing) {
    closed(at('attack.timing'), row.attack.timing, TIMING_KEYS);
    for (const [k, v] of Object.entries(row.attack.timing)) count(at(`attack.timing.${k}`), v, 0);
  }
  if (row.attack.reach !== undefined) count(at('attack.reach'), row.attack.reach, 0);
  if (row.attack.zone !== undefined) known(at('attack.zone'), row.attack.zone, ZONES);
  closed(at('mind'), row.mind || {}, MIND_KEYS);
  known(at('mind.aggressiveness'), row.mind?.aggressiveness, AGGRESSIVENESS);
  if (row.mind.motivation !== undefined) known(at('mind.motivation'), row.mind.motivation, MOTIVATIONS);
  if (row.mind.perception !== undefined) known(at('mind.perception'), row.mind.perception, ['sight', 'memory']);
  if (row.mind.pathing !== undefined) known(at('mind.pathing'), row.mind.pathing, ['direct', 'navmesh']);
  closed(at('fits'), row.fits || {}, FIT_KEYS);
  for (const s of row.fits.support ?? []) known(at('fits.support'), s, SUPPORTS);
  for (const s of row.fits.size ?? []) known(at('fits.size'), s, SIZES);
  if (row.fits.gaits !== undefined && !(Array.isArray(row.fits.gaits) && row.fits.gaits.length)) throw new Error(`foe class: ${at('fits.gaits')} is a list of gait words, any of which the body has`);
  if (row.fits.wings !== undefined && typeof row.fits.wings !== 'boolean') throw new Error(`foe class: ${at('fits.wings')} is true or false`);
  if (!(Number.isFinite(row.presence) && row.presence > 0 && row.presence <= 4)) throw new Error(`foe class: ${at('presence')} is its body's size (its longest extent) as a share of the hero's height, above 0 and at most 4`);
  closed(at('toll'), row.toll || {}, ['downs', 'harm']);
  count(at('toll.downs'), row.toll?.downs, 1); count(at('toll.harm'), row.toll?.harm, 0);
  known(at('stomp'), row.stomp, STOMPS);
  count(at('threat'), row.threat, 1);
  if (typeof row.standIn !== 'string' || !row.standIn) throw new Error(`foe class: ${at('needs a `standIn`, the species it plays on unskinned')}`);
  return row;
}

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
const row = (o) => deepFreeze(structuredClone(validateClass(o)));

export const FOE_CLASSES = Object.freeze(Object.fromEntries([walker, hopper, charger, swooper, turret, lobber, swarm, lurker, brute, stalker].map((o) => [o.id, row(o)])));

export function foeClass(id) {
  const c = FOE_CLASSES[id];
  if (!c) throw new Error(`foe: no class '${id}' (known: ${Object.keys(FOE_CLASSES).join(', ')})`);
  return c;
}

const SEVERITY = { built: 0, partial: 1, local: 2, absent: 3 };

// a lowering's mark in every engine: written on its row, read from the mind it rides on, or built when it lowers to
// nothing (an attack that does not attack)
function marksOfWord(w) {
  if (w.rides) return marksAcross((M, e) => M.mindMark(w.rides[0], w.rides[1])[e]);
  return Object.fromEntries(MARKED_ENGINES.map((e) => [e, w[e] ?? (w.status === 'built' ? 'built' : 'absent')]));
}

export function classStatus(c) {
  const parts = [['move', c.move, MOVES[c.move]], ['attack', c.attack.kind, ATTACKS[c.attack.kind]]];
  let status = 'built';
  const short = [], marks = Object.fromEntries(MARKED_ENGINES.map((e) => [e, 'built']));
  for (const [what, id, w] of parts) {
    if (SEVERITY[w.status] > SEVERITY[status]) status = w.status;
    if (w.status !== 'built') short.push(`${what} ${id} (${w.status})`);
    const m = marksOfWord(w);
    for (const e of MARKED_ENGINES) marks[e] = worstMark(marks[e], m[e]);
  }
  return { status, marks, short };
}
