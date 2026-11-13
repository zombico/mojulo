/**
 * THE WORK ROOM — the practice rooms' sibling for a work shift (game/work-mechanics.js): a world's Shovels & Buckets
 * card played before any level in a CONCEPTUAL space, where the fidelity is in showing the work, not in the bodies. The
 * worker is a MASCOT (egocube/mascot.js), rolled from a form chosen from the presets (orb, sprout, toon: the mascot
 * forms) and carried inline (world-scene.js `layered`: nothing minted), piloted by its own body (egocube/mascot-pilot.js);
 * the world's own hero where made. Movement is a feel template (feel/cards.js POLES): the world's own feel, or the one
 * asked for, else the everyday walker (the realistic template that runs slowest).
 * The space is a plain plane ruled every two metres. The line stands as counters coloured by their verb (shovel work
 * warm, bucket work cool), and THE FLOOR IS THE FLOWCHART: the card's recipe drawn as arrows from each crate, shelf and
 * station to where its thing goes next, coloured by the work it feeds. The work shows where it happens (the mechanic's
 * `show`): pips over a station fill as it is worked, fill again as it runs alone and go out toward the burn; a shelf
 * shows a pip a unit it holds.
 * A card with a `site` (card.js) stands its line on a deck that high (a roof) and its hand-in on the ground below, joined
 * by the real climb (playscape/objects/ladder.js: its rails, rungs and climbable surface, climbed by the hero's own
 * rule); the hero starts on the deck, and the proof walks to the climb, takes it at its own speed and walks on.
 * The card is tuned by the solver for one player at the world's challenge, and the shift is measured by the work proof
 * at the template's own run (worksim/work-proof.js).
 *
 *   workRoom(G, { refs?, cast?, feel?, card?, challenge?, sound? }) → { manifest, card, feel, hero: 'own' | 'mascot',
 *     layout, measured, choices: { feels: [{ id, name, base, run }], casts } }
 *   workOf(G)       → { card, challenge } the shift a world asks for (its quick work goal), or null
 *   tunedShift(card?, challenge?) → the solver's result: the card tuned for one player at the challenge
 *   WORK_LEGEND     the keys
 *   WORK_CASTS, WORK_CAST   the mascot forms a worker is chosen from, and the default
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
import { WORK_COLORS } from '../game/work-mechanics.js';
import { rollMascot } from '../egocube/mascot.js';
import { mascotPlanFromSheet, FORM_MEASURES } from '../egocube/mascot-form.js';
import { mascotPilot } from '../egocube/mascot-pilot.js';

export const WORK_LEGEND = 'W A S D  move (W up the screen) · E  take, work, put down, hand in (stand at a station to work it; walk off and it waits) · F  sprint · H  HUD';
// the space: a pale plane, its rules, the room's low wall; the line in the mechanic's verb colours, the rest neutral
const FILL = { ...WORK_COLORS, plane: '#ece6db', rule: '#d9d0c1', wall: '#ddd5c8', deck: '#d3c9b9', ladder: '#9b7b56', joint: '#6f5638', bg: '#f4f0e8' };
export const WORK_CASTS = Object.freeze(Object.keys(FORM_MEASURES));
export const WORK_CAST = WORK_CASTS.includes('sprout') ? 'sprout' : WORK_CASTS[0];

/** The worker: a mascot of the form asked, rolled once (seed 1) and compiled to its plan (the creature door's spec). */
export function workMascot(form = WORK_CAST, { speed = 4 } = {}) {
  if (!WORK_CASTS.includes(form)) throw new Error(`work room: cast is a mascot form (${WORK_CASTS.join(', ')})`);
  const P = mascotPlanFromSheet(rollMascot({ facets: { form }, seed: 1 }), { title: `the ${form} worker` });
  const dials = Object.fromEntries((P.after || []).filter((op) => op.op === 'set' && /^\/dials\/[^/]+$/.test(op.path)).map((op) => [op.path.slice(7), op.value]));
  return { layered: { ...P.create.spec, ...(Object.keys(dials).length ? { dials } : {}) }, pilot: mascotPilot(P.create.spec.plan, { speed }), thesis: P.thesis };
}
const REACH = 1.6;
// THE VIEW: the ¾ overhead camera (rules-basic.js overhead), north up the screen, so the work flows up it: the crates
// at the bottom, the line, the shelves, the hand-in at the top; W walks up the screen
export const OVERHEAD = Object.freeze({ rule: 'overhead', target: 'hero', yaw: Math.PI / 2, tilt: 0.95, dist: 15, lookH: 0.4 });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A shift's card (a starter's name or a card) tuned by the solver for one player at a challenge: { card, solved }. */
export function tunedShift(card = 'kitchen', challenge = 'beginner') {
  const raw = isObj(card) ? card : SCENARIOS[card];
  if (!raw) throw new Error(`work room: card is a starter (${Object.keys(SCENARIOS).join(', ')}) or a Shovels & Buckets card`);
  return solve({ ...raw, crew: { ...(raw.crew ?? {}), workers: 1 } }, challenge);
}

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
export function workRoom(G, { refs = {}, cast = WORK_CAST, feel = null, card = null, challenge = null, sound = 'realistic' } = {}) {
  const asked = workOf(G) ?? { card: 'kitchen', challenge: 'beginner' };

  const F = feel ?? G?.feel ?? everydayFeel();
  readFeel(F);
  // the card tuned for the room's one player at the world's challenge
  const tuned = tunedShift(card ?? asked.card, challenge ?? asked.challenge);
  const C = tuned.card;

  // THE HERO: on the template's rule, moving where the camera looks; facing the line from in front of the hand-in
  const own = typeof refs.hero === 'string';
  const rule = { ...feelRule(F), move: 'world', moveYaw: OVERHEAD.yaw };
  const M = own ? null : workMascot(cast, { speed: rule.speed });
  const P = playerWorld({ heroRef: own ? refs.hero : 'mascot', id: 'hero', title: 'work room', controls: WORK_LEGEND, rule, ...(M ? { pilot: M.pilot } : {}) });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const figures = { hero: own ? { ...lib, heroRef: refs.hero } : { ...lib, layered: M.layered } };
  // A SITE (card.js site): the line up on a deck (a roof), the hand-in on the ground below, the real climb between
  const RC = readCard(C), site = RC.site, up = site ? site.up : 0;
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
  // the worker starts among the work, in the walk between the stations and the shelves (the camera centred on the line)
  const rowY = (list) => (list.length ? Math.min(...list.map((q) => q[1])) : null), stY = Math.max(...Object.values(L.stations).flat().map((q) => q[1]));
  const shY = rowY(Object.values(L.shelves)) ?? stY + 2.4;
  const spawn = [0, r3((stY + shY) / 2), up];
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
  const room = floorOf({ half, blocks }), colliders = room.colliders;
  // THE SPACE: the checkered floor given up for a pale plane ruled every two metres, the wall in the plane's tone
  const plane = [];
  for (let i = -half; i < half; i += 4) for (let j = -half; j < half; j += 4) {
    const a = Math.min(i + 4, half), b = Math.min(j + 4, half);
    plane.push({ corners: [[i, j, 0], [a, j, 0], [a, b, 0], [i, b, 0]], fill: FILL.plane, group: 'room:plane', doubleSided: true });
  }
  for (let k = -half + 2; k < half; k += 2) {
    plane.push(flat([k - 0.015, -half], [k + 0.015, -half], [k + 0.015, half], [k - 0.015, half], 0.003, FILL.rule, 'room:rule'));
    plane.push(flat([-half, k - 0.015], [half, k - 0.015], [half, k + 0.015], [-half, k + 0.015], 0.003, FILL.rule, 'room:rule'));
  }
  const kept = room.faces.filter((f) => f.group !== 'room:floor').map((f) => (f.group === 'room:wall' ? { ...f, fill: FILL.wall } : f));
  const faces = [...plane, ...kept, ...flowchart(RC, L, serveAt, climb, up), ...extra.faces];

  // THE SHIFT: the work mechanic on the line, its markers over the counters, its E reached from a counter's side
  const params = { card: C, at: { origin: [0, 0, up], stations: L.stations, crates: L.crates, shelves: L.shelves, serve: serveAt }, heading: 0, reach: REACH, bases: false, show: true };
  const composed = composeMechanics([{ kind: 'work', ...params }], { player: 'hero', spawn, fall: 'none' });
  if (composed.errors?.length) throw new Error(`work room: ${composed.errors.join('; ')}`);
  const ev = composed.events, pe = P.events ?? {}, events = { ...pe, vars: { ...(pe.vars ?? {}), ...ev.vars } };
  for (const [k, v] of Object.entries(ev)) if (Array.isArray(v) && v.length) events[k] = [...(pe[k] ?? []), ...v];

  const soundOf = (word) => { const v = sound === 'none' ? null : sfxSound(word, { style: sound }); return v && v.gestures ? v.gestures : null; };
  const step = soundOf('step-concrete');
  const manifest = {
    kind: 'controllable', title: `Work room · ${G?.name ?? G?.id ?? 'game'}`, bg: FILL.bg, faces, colliders, figures, entities: [heroE, ...extra.entities],
    camera: { ...OVERHEAD }, ...(step ? { audio: { footsteps: { step } } } : {}), events,
  };
  // MEASURED: the shift played on the bus by a walker who knows the card, at the template's run
  const measured = proveWork(params, { player: 'hero', spawn, speed: rule.speed, ...(path ? { path } : {}) });
  const feels = POLE_IDS.map((id) => ({ id, name: POLES[id].name, base: POLES[id].base, run: feelRule(id).speed }));
  return {
    manifest, card: C, solved: { target: tuned.target.name, verdict: tuned.verdict, metrics: tuned.metrics }, feel: readFeel(F).pole,
    hero: own ? 'own' : 'mascot', ...(M ? { mascot: { form: cast, thesis: M.thesis } } : {}), layout: { ...L, serve: serveAt }, ...(site ? { site: { up, climb: climb.form, seconds: climb.seconds, top: climb.top, bottom: climb.bottom } } : {}), measured, choices: { feels, casts: WORK_CASTS },
  };
}

// a flat quad a hair over its level (a rule, a strip of the flowchart)
export function flat(a, b, c, d, z, fill, group) {
  return { corners: [[r3(a[0]), r3(a[1]), z], [r3(b[0]), r3(b[1]), z], [r3(c[0]), r3(c[1]), z], [r3(d[0]), r3(d[1]), z]], fill, group, doubleSided: true };
}

/**
 * THE FLOWCHART on the floor: the card's recipe as arrows, each from where a thing is had (a crate, a shelf, a station
 * that makes it) to where it goes next (the station that takes it, the shelf that keeps it, the hand-in), coloured by
 * the work it feeds (a station's verb; into a shelf or the hand-in, bucket work: sorting to storage or the next step). An
 * arrow keeps off the counters at both ends; on a site, a product's arrow runs to the climb on the deck and on from its
 * foot on the ground.
 */
export function flowchart(C, L, serveAt, climb, up) {
  const out = [], seen = new Set(), W = 0.07, Z = 0.012;
  const arrow = (a, b, color) => {
    const key = `${a}|${b}`; if (seen.has(key)) return; seen.add(key);
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 1.5) return;
    const u = [dx / len, dy / len], n = [-u[1], u[0]], s = 0.7, e = len - 0.75, z = a[2] + Z;
    const p = (t, w) => [a[0] + u[0] * t + n[0] * w, a[1] + u[1] * t + n[1] * w];
    out.push(flat(p(s, -W), p(e - 0.3, -W), p(e - 0.3, W), p(s, W), z, color, 'room:flow'));
    // the head: a triangle (a quad with its tip doubled)
    out.push(flat(p(e - 0.32, -0.2), p(e, 0), p(e, 0), p(e - 0.32, 0.2), z, color, 'room:flow'));
  };
  const slots = (item) => (C.producers[item] ?? []).flatMap((sid) => L.stations[sid].map((at) => ({ at, verb: C.stations[sid].verb })));
  for (const [sid, st] of Object.entries(C.stations)) for (const at of L.stations[sid]) {
    for (const i of Object.keys(st.takes)) {
      if (L.crates[i]) arrow(L.crates[i], at, WORK_COLORS[st.verb]);
      else if (L.shelves[i]) arrow(L.shelves[i], at, WORK_COLORS[st.verb]);
      else for (const q of slots(i)) arrow(q.at, at, WORK_COLORS[st.verb]);
    }
    if (L.shelves[st.item]) arrow(at, L.shelves[st.item], WORK_COLORS.bucket);
  }
  // what the orders want, to the hand-in (on a site, by way of the climb)
  for (const it of new Set(C.demand.orders.flatMap((o) => Object.keys(o.wants)))) {
    const from = L.shelves[it] ? [L.shelves[it]] : slots(it).map((q) => q.at);
    for (const f of from) {
      if (climb) { arrow(f, [climb.top[0], climb.top[1] - 0.6, up], WORK_COLORS.bucket); arrow([climb.bottom[0], climb.bottom[1] - 0.6, 0], serveAt, WORK_COLORS.bucket); }
      else arrow(f, serveAt, WORK_COLORS.bucket);
    }
  }
  return out;
}
