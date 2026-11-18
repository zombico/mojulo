/**
 * THE KITCHEN LEVEL: a work shift for two to four cooks on one screen (a quick work goal's `cooks`, `kitchen`), played in
 * a room of its own, not by a trail: the game room's arena (gameroom/area.js: the trade's floor, its walls cut away on
 * the camera's side, what stands outside; gameroom/dress.js: each place drawn as the trade's thing), the kitchen laid
 * for its cooks inside it (worksim/kitchen.js: its sides, its counter and the passes in it), the recipe drawn on the
 * floor as arrows (work-room.js flowchart), the whole room on one fixed overhead screen (soul.frame: fixed).
 *
 * The shift is tuned to its cooks in this kitchen (work-proof.js tuneKitchen: the solver for that many hands, then the
 * proof on the kitchen's own sides until they keep up; the goal four fifths of what they served). Each cook is a seat
 * (the level's `seats`, drop-in): seat 1 the hero, seat n a body of the hero's own (`hero-<n>`) on its side, held still
 * while nobody sits in it; the work mechanic gives each its own hands (game/work-mechanics.js, ctx.seats).
 *
 *   kitchenOf(quick)                 → the kitchen a quick work goal's cooks share ('split' for two or more), or null
 *   kitchenLevel(G, { ref?, heroRef?, title? }) → { manifest, laws, tuned: { card, goal, rounds, says }, kitchen }
 *
 * Pure (the solver and the proof are seeded); a shift tuned once is kept, since the stage and its level both read it.
 */
import { feelRule, readFeel } from './feel/lower.js';
import { floorOf } from './practice-room.js';
import { playerWorld } from '../playscape/player.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { readCard } from '../worksim/card.js';
import { SCENARIOS } from '../worksim/scenarios.js';
import { layKitchen, kitchenLaws, KITCHENS } from '../worksim/kitchen.js';
import { tuneKitchen } from '../worksim/work-proof.js';
import { WORK_COLORS } from '../game/work-mechanics.js';
import { dressOf, dressPlaces, DRESSES } from '../gameroom/dress.js';
import { readArea, buildArea, raiseWalls } from '../gameroom/area.js';
import { workMascot, everydayFeel, flowchart, areaOut, WORK_CAST, WORK_LEGEND, OVERHEAD } from './work-room.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
// how far from a counter's middle a place's E reaches (its side: the counters stand solid)
const REACH = 1.6;
const FILL = { ...WORK_COLORS, counter: '#cfc6b8', wall: '#ddd5c8', bg: '#f4f0e8' };

export const kitchenOf = (quick) => (quick?.goal !== 'work' ? null : quick.kitchen ?? ((quick.cooks ?? 1) > 1 ? 'split' : null));

const TUNED = new Map(), KEEP = 8;
function tunedFor(Q) {
  const key = JSON.stringify([Q.card ?? null, Q.challenge ?? null, Q.cooks ?? 1, kitchenOf(Q)]);
  if (!TUNED.has(key)) {
    const raw = Q.card === undefined ? SCENARIOS.kitchen : isObj(Q.card) ? Q.card : SCENARIOS[Q.card];
    TUNED.set(key, tuneKitchen(raw, { kitchen: kitchenOf(Q), cooks: Q.cooks ?? 1, challenge: Q.challenge ?? 'beginner' }));
    if (TUNED.size > KEEP) TUNED.delete(TUNED.keys().next().value);
  }
  return TUNED.get(key);
}

export function kitchenLevel(G, { ref = 'kitchen', heroRef = null, title = null } = {}) {
  const Q = G.quick, kitchen = kitchenOf(Q);
  if (!kitchen) throw new Error('kitchen level: a quick work goal with cooks (or a kitchen named)');
  const cooks = Q.cooks ?? 1, T = tunedFor(Q), C = T.card, RC = readCard(C);
  // THE ROOM: square (the game room's area is), its side the kitchen's own rounded up to whole metres; the kitchen
  // stretched to fill it, its middle the room's
  const K0 = layKitchen(C, { kitchen, cooks }), half = Math.ceil(Math.max(...K0.size) / 2);
  const K = layKitchen(C, { kitchen, cooks, room: 2 * half });

  // THE COOKS: the world's feel (else the everyday walker), moving where the fixed camera looks (north up the screen);
  // the hero the world's own, else a mascot carried inline
  const F = G.feel ?? everydayFeel();
  readFeel(F);
  const rule = { ...feelRule(F), move: 'world', moveYaw: OVERHEAD.yaw };
  const own = typeof heroRef === 'string', M = own ? null : workMascot(WORK_CAST, { speed: rule.speed });
  const P = playerWorld({ heroRef: own ? heroRef : 'mascot', id: 'hero', title: title ?? 'the kitchen', controls: WORK_LEGEND, rule, ...(M ? { pilot: M.pilot } : {}) });
  const { heroRef: _r, ...lib } = P.figures.hero;
  const figures = { hero: own ? { ...lib, heroRef } : { ...lib, layered: M.layered } };
  const facing = (p) => r3(Math.atan2(-p[1], -p[0]));
  const hero = { ...P.entities[0], team: 'party', transform: { pos: K.spawns[0].slice(), heading: facing(K.spawns[0]) } };
  const bodies = K.spawns.slice(1).map((p, k) => ({ ...hero, id: `hero-${k + 2}`, ambient: { type: 'static' }, transform: { pos: p.slice(), heading: facing(p) } }));

  // THE PLACES, dressed as the trade's things (a kitchen's range and workbenches), each its collider kept
  const at = K.at;
  const places = [
    ...Object.entries(at.stations).flatMap(([sid, list]) => list.map((p, k) => ({ id: `${sid}-${k}`, kind: 'counter', at: p, size: [1, 1, 0.9], sid, verb: C.stations[sid].verb }))),
    ...Object.entries(at.crates).map(([item, p]) => ({ id: `crate-${item}`, kind: 'bin', at: p, size: [0.8, 0.8, 0.7], item })),
    ...Object.entries(at.shelves).map(([item, p]) => ({ id: `shelf-${item}`, kind: 'shelf', at: p, size: [0.6, 0.6, 1.1], item })),
    { id: 'serve', kind: 'pass', at: at.serve, size: [0.8, 1.6, 1] },
  ];
  const trade = G.room?.dress === false ? null : dressOf(C, typeof G.room?.dress === 'string' ? G.room.dress : null);
  const D = trade ? dressPlaces(places, trade, { card: C }) : { faces: [], dressed: new Set(), laid: [] };
  const blocks = places.map((p) => ({ id: p.id, x: [r3(p.at[0] - p.size[0] / 2), r3(p.at[0] + p.size[0] / 2)], y: [r3(p.at[1] - p.size[1] / 2), r3(p.at[1] + p.size[1] / 2)], h: r3(p.size[2]), fill: p.kind === 'counter' ? FILL[p.verb] : FILL[{ bin: 'crate', shelf: 'shelf', pass: 'serve' }[p.kind]], group: D.dressed.has(p.id) ? `room:dressed:${p.id}` : 'room:work' }));
  // the counter between the sides (its passes are the shelves above)
  K.blocks.filter((b) => b.kind === 'counter').forEach((b, k) => blocks.push({ id: `counter-${k}`, x: [b.min[0], b.max[0]], y: [b.min[1], b.max[1]], h: r3(b.max[2] - b.min[2]), fill: FILL.counter, group: 'room:counter' }));
  const room = floorOf({ half, blocks });
  // THE AREA: the trade's floor, its walls (cut away on the camera's side, the south) and what stands outside
  const A = readArea(G.room?.area, trade ?? 'hall');
  const AR = A ? buildArea(A, { half, cut: ['s'], seed: 1 }) : null;
  const colliders = raiseWalls(room.colliders, half, AR?.heights);
  const kept = room.faces.filter((f) => f.group !== 'room:floor' && !String(f.group).startsWith('room:dressed:') && !(AR && f.group === 'room:wall')).map((f) => (f.group === 'room:wall' ? { ...f, fill: FILL.wall } : f));
  const faces = [...(AR ? AR.faces : room.faces.filter((f) => f.group === 'room:floor')), ...kept, ...flowchart(RC, at, at.serve, null, 0), ...D.faces];

  // THE SHIFT: the work mechanic on the kitchen's places, a hand a cook (the level's seats), its goal the tuned one
  const game = {
    levelRef: ref, fall: { mode: 'respawn' },
    mechanics: [{ kind: 'work', card: C, at: { origin: [0, 0, 0], stations: at.stations, crates: at.crates, shelves: at.shelves, serve: at.serve }, heading: 0, reach: REACH, bases: false, show: true, ...(Q.serve ? { goal: Q.serve } : { goal: T.goal }) }],
  };
  const step = sfxSound('step-concrete', { style: 'realistic' })?.gestures ?? null;
  const manifest = {
    kind: 'controllable', title: title ?? `${G.name ?? G.id ?? 'The'} kitchen`, bg: AR ? AR.bg : FILL.bg, faces, colliders, figures,
    entities: [hero, ...bodies],
    camera: { rule: 'fixed', target: 'hero', stations: [{ at: K.frame.at, focus: K.frame.focus }], track: 0, lookH: 0 },
    ...(bodies.length ? { seats: { bodies: bodies.map((b) => b.id), max: cooks, join: 'drop-in', drop: 'pause' } } : {}),
    ...(step ? { audio: { footsteps: { step } } } : {}),
    game,
  };
  // THE LAWS: the kitchen's (its sides, its passes, its frame), the cooks' jump asked of its counter
  const jump = Number.isFinite(rule.jump) && Number.isFinite(rule.gravity) ? r3((rule.jump * rule.jump) / (2 * rule.gravity)) : null;
  const laws = kitchenLaws(K, { jump }).map((l) => ({ concern: 'kitchen', ...l }));
  return {
    manifest, laws, kitchen: { name: kitchen, about: KITCHENS[kitchen].about, cooks, size: K.size, passes: K.passes, zones: K.zones.map((z) => z.id) },
    tuned: { card: C.id, every: C.demand.every ?? null, goal: game.mechanics[0].goal, rounds: T.rounds, says: T.proof.says },
    dress: trade ? { trade, about: DRESSES[trade].about } : null, area: areaOut(A, AR),
  };
}
