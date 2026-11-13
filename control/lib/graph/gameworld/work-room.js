/**
 * THE WORK ROOM — the practice rooms' sibling for a work shift (game/work-mechanics.js): a world's Shovels & Buckets
 * card played on a greybox floor before any level, by a hero chosen from the presets the action rooms use. The world's
 * own hero where made, else a stand-in body (male or female). Movement is a feel template (feel/cards.js POLES): the
 * world's own feel, or the one asked for, else the everyday walker (the realistic template that runs slowest).
 * The line stands as counters, blocks coloured by their verb: crates, the stations' slots, the shelves, the hand-in.
 * The card is tuned by the solver for one player at the world's challenge, and the shift is measured by the work proof
 * at the template's own run (worksim/work-proof.js).
 *
 *   workRoom(G, { refs?, cast?, feel?, card?, challenge?, sound? }) → { manifest, card, feel, hero: 'own' | 'stand-in',
 *     layout, measured, choices: { feels: [{ id, name, base, run }], casts } }
 *   workOf(G)       → { card, challenge } the shift a world asks for (its quick work goal), or null
 *   WORK_LEGEND     the keys
 *   everydayFeel()  the default template: of the realistic ones, the slowest run
 *
 * Pure (the solver and the proof are seeded). Its page: practice-room-page.js workRoomHtml.
 */
import { POLES, POLE_IDS } from './feel/cards.js';
import { feelRule, readFeel } from './feel/lower.js';
import { floorOf } from './practice-room.js';
import { playerWorld } from '../playscape/player.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { composeMechanics } from '../game/mechanics.js';
import { layWork } from '../game/work-mechanics.js';
import { solve } from '../worksim/solve.js';
import { SCENARIOS } from '../worksim/scenarios.js';
import { proveWork } from '../worksim/work-proof.js';

export const WORK_LEGEND = 'W A S D  walk · mouse  look · E  take, work, put down, hand in (stand at a station to work it; walk off and it waits) · F  sprint · H  HUD';
const FILL = { shovel: '#5b84b1', bucket: '#8fb15b', crate: '#b07a3a', shelf: '#8a8170', serve: '#d9d2c3' };
const REACH = 1.6;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The shift a world asks for: its quick game's work goal (card, challenge), or null. */
export function workOf(G) {
  const Q = G?.quick;
  if (!Q || Q.goal !== 'work') return null;
  return { card: Q.card ?? 'kitchen', challenge: Q.challenge ?? 'beginner' };
}

let EVERYDAY = null;
/** The everyday walker: of the realistic templates, the one that runs slowest (chosen from the catalog, not named). */
export function everydayFeel() {
  if (EVERYDAY) return EVERYDAY;
  const real = POLE_IDS.filter((id) => POLES[id].base === 'realistic').map((id) => ({ id, run: feelRule(id).speed }));
  EVERYDAY = real.sort((a, b) => a.run - b.run || POLE_IDS.indexOf(a.id) - POLE_IDS.indexOf(b.id))[0].id;
  return EVERYDAY;
}

/** The work room (see the header). */
export function workRoom(G, { refs = {}, cast = 'male', feel = null, card = null, challenge = null, sound = 'realistic' } = {}) {
  const asked = workOf(G) ?? { card: 'kitchen', challenge: 'beginner' };
  const raw0 = card ?? asked.card, raw = isObj(raw0) ? raw0 : SCENARIOS[raw0];
  if (!raw) throw new Error(`work room: card is a starter (${Object.keys(SCENARIOS).join(', ')}) or a Shovels & Buckets card`);
  const F = feel ?? G?.feel ?? everydayFeel();
  readFeel(F);
  // the card tuned for the room's one player at the world's challenge
  const tuned = solve({ ...raw, crew: { ...(raw.crew ?? {}), workers: 1 } }, challenge ?? asked.challenge);
  const C = tuned.card;

  // THE HERO: on the template's rule, moving where the camera looks; facing the line from in front of the hand-in
  const own = typeof refs.hero === 'string';
  const rule = { ...feelRule(F), move: 'camera' };
  const P = playerWorld({ heroRef: own ? refs.hero : 'stand-in', id: 'hero', title: 'work room', controls: WORK_LEGEND, rule });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const figures = { hero: own ? { ...lib, heroRef: refs.hero } : { ...lib, hero: { cast } } };
  const L = layWork(C, [0, 0, 0], 0), spawn = [0, L.serve[1] + 2.5, 0];
  const heroE = { ...P.entities[0], transform: { pos: spawn, heading: -Math.PI / 2 } };

  // THE LINE: a counter a place, coloured by what is done there
  const blocks = [];
  const block = (id, at, w, d, h, fill) => blocks.push({ id, x: [at[0] - w / 2, at[0] + w / 2], y: [at[1] - d / 2, at[1] + d / 2], h, fill, group: 'room:work' });
  for (const [sid, list] of Object.entries(L.stations)) list.forEach((at, k) => block(`${sid}-${k}`, at, 1, 1, 0.9, FILL[C.stations[sid].verb]));
  for (const [item, at] of Object.entries(L.crates)) block(`crate-${item}`, at, 0.8, 0.8, 0.7, FILL.crate);
  for (const [item, at] of Object.entries(L.shelves)) block(`shelf-${item}`, at, 0.6, 0.6, 1.1, FILL.shelf);
  block('serve', L.serve, 1.6, 0.8, 1, FILL.serve);
  const xs = [...blocks.flatMap((b) => b.x), spawn[0]], ys = [...blocks.flatMap((b) => b.y), spawn[1]];
  const half = Math.ceil(Math.max(...xs.map(Math.abs), ...ys.map(Math.abs)) + 3);
  const { faces, colliders } = floorOf({ half, blocks });

  // THE SHIFT: the work mechanic on the line, its markers over the counters, its E reached from a counter's side
  const params = { card: C, at: [0, 0, 0], heading: 0, reach: REACH, bases: false };
  const composed = composeMechanics([{ kind: 'work', ...params }], { player: 'hero', spawn, fall: 'none' });
  if (composed.errors?.length) throw new Error(`work room: ${composed.errors.join('; ')}`);
  const ev = composed.events, pe = P.events ?? {}, events = { ...pe, vars: { ...(pe.vars ?? {}), ...ev.vars } };
  for (const [k, v] of Object.entries(ev)) if (Array.isArray(v) && v.length) events[k] = [...(pe[k] ?? []), ...v];

  const soundOf = (word) => { const v = sound === 'none' ? null : sfxSound(word, { style: sound }); return v && v.gestures ? v.gestures : null; };
  const step = soundOf('step-concrete');
  const manifest = {
    kind: 'controllable', title: `Work room · ${G?.name ?? G?.id ?? 'game'}`, bg: '#1b1d22', faces, colliders, figures, entities: [heroE],
    camera: { ...P.camera, steer: 'orbit', mouseLook: true }, ...(step ? { audio: { footsteps: { step } } } : {}), events,
  };
  // MEASURED: the shift played on the bus by a walker who knows the card, at the template's run
  const measured = proveWork(params, { player: 'hero', spawn, speed: rule.speed });
  const feels = POLE_IDS.map((id) => ({ id, name: POLES[id].name, base: POLES[id].base, run: feelRule(id).speed }));
  return {
    manifest, card: C, solved: { target: tuned.target.name, verdict: tuned.verdict, metrics: tuned.metrics }, feel: readFeel(F).pole,
    hero: own ? 'own' : 'stand-in', layout: L, measured, choices: { feels, casts: ['male', 'female'] },
  };
}
