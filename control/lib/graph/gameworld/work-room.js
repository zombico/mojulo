/**
 * THE WORK ROOM — the practice rooms' sibling for a work shift (game/work-mechanics.js): a world's Shovels & Buckets
 * card played on a greybox floor before any level, by a hero chosen from the presets the action rooms use. The world's
 * own hero where made, else a stand-in body (male or female). Movement is a feel template (feel/cards.js POLES): the
 * world's own feel, or the one asked for, else the everyday walker (the realistic template that runs slowest).
 * The line stands as counters, blocks coloured by their verb: crates, the stations' slots, the shelves, the hand-in.
 * A card with a `site` (card.js) stands its line on a deck that high (a roof) and its hand-in on the ground below, joined
 * by the real climb (playscape/objects/ladder.js: its rails, rungs and climbable surface, climbed by the hero's own
 * rule); the hero starts on the deck, and the proof walks to the climb, takes it at its own speed and walks on.
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
import { readCard } from '../worksim/card.js';
import { resolveObject } from '../playscape/objects/index.js';

export const WORK_LEGEND = 'W A S D  walk · mouse  look · E  take, work, put down, hand in (stand at a station to work it; walk off and it waits) · F  sprint · H  HUD';
const FILL = { shovel: '#5b84b1', bucket: '#8fb15b', crate: '#b07a3a', shelf: '#8a8170', serve: '#d9d2c3', deck: '#6e5a4a', ladder: '#b8894f', joint: '#7a5a34' };
const REACH = 1.6;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;

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
  // A SITE (card.js site): the line up on a deck (a roof), the hand-in on the ground below, the real climb between
  const site = readCard(C).site, up = site ? site.up : 0;
  const L = layWork(C, [0, 0, up], 0);
  const deckPlaces = [...Object.values(L.stations).flat(), ...Object.values(L.crates), ...Object.values(L.shelves)];
  let deck = null, climb = null, path = null, serveAt = L.serve, extra = { faces: [], entities: [] };
  if (site) {
    const x0 = Math.min(...deckPlaces.map((q) => q[0])) - 1.5, x1 = Math.max(...deckPlaces.map((q) => q[0])) + 1.5;
    const y0 = Math.min(...deckPlaces.map((q) => q[1])) - 1.5, y1 = Math.max(...deckPlaces.map((q) => q[1])) + 1.5;
    deck = { x: [x0, x1], y: [y0, y1] };
    // the climb at the deck's far corner, so the way to it is walked; the hand-in a few steps out from its foot
    const lip = [r3(x1 - 1.2), r3(y1), up];
    const o = resolveObject({ entry: 'ladder', variant: site.climb, to: lip, rise: up, facing: [0, 1] });
    climb = { top: o.climb.top, bottom: o.climb.bottom, seconds: site.seconds, form: o.climb.form };
    serveAt = [climb.bottom[0], r3(climb.bottom[1] + 3), 0];
    extra = {
      faces: o.faces.map((f) => ({ corners: f.corners, fill: f.part === 'joints' ? FILL.joint : FILL.ladder, group: 'room:ladder', doubleSided: true })),
      entities: o.world.entities,
    };
    // the way between the deck and the ground: to the climb, along it in its own seconds, on to the place
    const onDeck = (q) => q[2] > up / 2, span = Math.hypot(...climb.top.map((v, k) => v - climb.bottom[k]));
    const downLeg = { at: climb.bottom, speed: span / climb.seconds }, upLeg = { at: climb.top, speed: span / climb.seconds };
    path = (from, to) => (onDeck(from) === onDeck(to) ? [{ at: to }] : onDeck(from) ? [{ at: climb.top }, downLeg, { at: to }] : [{ at: climb.bottom }, upLeg, { at: to }]);
  }
  const spawn = site ? [0, r3(deck.y[1] - 1), up] : [0, L.serve[1] + 2.5, 0];
  const heroE = { ...P.entities[0], transform: { pos: spawn, heading: -Math.PI / 2 } };

  // THE LINE: a counter a place, coloured by what is done there (on a deck, standing on it)
  const blocks = [];
  const block = (id, at, w, d, h, fill) => blocks.push({ id, x: [r3(at[0] - w / 2), r3(at[0] + w / 2)], y: [r3(at[1] - d / 2), r3(at[1] + d / 2)], h: r3(at[2] + h), fill, group: 'room:work' });
  if (deck) blocks.push({ id: 'deck', x: deck.x.map(r3), y: deck.y.map(r3), h: up, fill: FILL.deck, group: 'room:deck' });
  for (const [sid, list] of Object.entries(L.stations)) list.forEach((at, k) => block(`${sid}-${k}`, at, 1, 1, 0.9, FILL[C.stations[sid].verb]));
  for (const [item, at] of Object.entries(L.crates)) block(`crate-${item}`, at, 0.8, 0.8, 0.7, FILL.crate);
  for (const [item, at] of Object.entries(L.shelves)) block(`shelf-${item}`, at, 0.6, 0.6, 1.1, FILL.shelf);
  block('serve', serveAt, 1.6, 0.8, 1, FILL.serve);
  const xs = [...blocks.flatMap((b) => b.x), spawn[0]], ys = [...blocks.flatMap((b) => b.y), spawn[1]];
  const half = Math.ceil(Math.max(...xs.map(Math.abs), ...ys.map(Math.abs)) + 3);
  const room = floorOf({ half, blocks }), faces = [...room.faces, ...extra.faces], colliders = room.colliders;

  // THE SHIFT: the work mechanic on the line, its markers over the counters, its E reached from a counter's side
  const params = { card: C, at: { origin: [0, 0, up], stations: L.stations, crates: L.crates, shelves: L.shelves, serve: serveAt }, heading: 0, reach: REACH, bases: false };
  const composed = composeMechanics([{ kind: 'work', ...params }], { player: 'hero', spawn, fall: 'none' });
  if (composed.errors?.length) throw new Error(`work room: ${composed.errors.join('; ')}`);
  const ev = composed.events, pe = P.events ?? {}, events = { ...pe, vars: { ...(pe.vars ?? {}), ...ev.vars } };
  for (const [k, v] of Object.entries(ev)) if (Array.isArray(v) && v.length) events[k] = [...(pe[k] ?? []), ...v];

  const soundOf = (word) => { const v = sound === 'none' ? null : sfxSound(word, { style: sound }); return v && v.gestures ? v.gestures : null; };
  const step = soundOf('step-concrete');
  const manifest = {
    kind: 'controllable', title: `Work room · ${G?.name ?? G?.id ?? 'game'}`, bg: '#1b1d22', faces, colliders, figures, entities: [heroE, ...extra.entities],
    camera: { ...P.camera, steer: 'orbit', mouseLook: true }, ...(step ? { audio: { footsteps: { step } } } : {}), events,
  };
  // MEASURED: the shift played on the bus by a walker who knows the card, at the template's run
  const measured = proveWork(params, { player: 'hero', spawn, speed: rule.speed, ...(path ? { path } : {}) });
  const feels = POLE_IDS.map((id) => ({ id, name: POLES[id].name, base: POLES[id].base, run: feelRule(id).speed }));
  return {
    manifest, card: C, solved: { target: tuned.target.name, verdict: tuned.verdict, metrics: tuned.metrics }, feel: readFeel(F).pole,
    hero: own ? 'own' : 'stand-in', layout: { ...L, serve: serveAt }, ...(site ? { site: { up, climb: climb.form, seconds: climb.seconds, top: climb.top, bottom: climb.bottom } } : {}), measured, choices: { feels, casts: ['male', 'female'] },
  };
}
