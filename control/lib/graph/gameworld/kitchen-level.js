/**
 * THE KITCHEN LEVEL: a work shift for two to four cooks on one screen (a quick work goal's `cooks`, `kitchen`), played in
 * a room of its own, not by a trail: the game room's arena (gameroom/area.js: the trade's floor, its walls cut away on
 * the camera's side, what stands outside; gameroom/dress.js: each place drawn as the trade's thing), the kitchen laid
 * for its cooks inside it (worksim/kitchen.js: its sides, its counter and the passes in it), the whole room on one fixed
 * overhead screen (soul.frame: fixed). The floor carries no recipe: the work room's arrows teach in practice, and in the
 * game what goes where next is the cooks' to work out.
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
import { SCENARIOS } from '../worksim/scenarios.js';
import { layKitchen, kitchenLaws, KITCHENS } from '../worksim/kitchen.js';
import { tuneKitchen } from '../worksim/work-proof.js';
import { WORK_COLORS } from '../game/work-mechanics.js';
import { dressOf, dressPlaces, DRESSES } from '../gameroom/dress.js';
import { readArea, buildArea, raiseWalls } from '../gameroom/area.js';
import { makeLight, shadeHex, newellNormal } from '../polygonizer/vexar.js';
import { foodOf, foodFaces } from '../food/derive.js';
import { workMascot, everydayFeel, areaOut, WORK_CAST, WORK_LEGEND, OVERHEAD } from './work-room.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
// how far from a counter's middle a place's E reaches (its side: the counters stand solid)
const REACH = 1.6;
const FILL = { ...WORK_COLORS, counter: '#c9ced3', wall: '#ddd5c8', bg: '#f4f0e8' };

/**
 * THE STUDIO LIGHT: the kitchen lit as a set is, from above and in front.
 *   the KEY      from high front-left (the camera's side), warm; the FILL from the right, cool and low; each of the room's
 *                faces shaded by them as it faces the camera (its flat colour was its albedo, unlit)
 *   the BAKE     ambient occlusion on the faces, the floor subdivided so where a counter stands is darkened round its foot
 *   the LIVE     the counters' shadows cast once from the key, the cooks' each frame; contact occlusion; the seams inked
 *   the GRADE    warm, a touch of contrast, a vignette
 * The tiled floor quieted to two near tones, so the play reads over it.
 */
const STUDIO_KEY = Object.freeze([-0.42, -0.5, 0.76]);   // toward the key: high, front (−y), left (−x)
const STUDIO = makeLight({ direction: STUDIO_KEY.map((v) => -v), ambient: 0.6, diffuse: 0.42, fill: { direction: [-0.75, 0.15, -0.35], diffuse: 0.14 } });
const STUDIO_FLOOR = Object.freeze(['#ebe5d9', '#dfd8ca']);
const STUDIO_LOOK = Object.freeze({
  ao: { subdivide: true, strength: 0.55 },
  // (the camera's side cut low and what stands outside cast nothing in: the key comes over them)
  shadows: { actors: true, hour: true, toLight: [...STUDIO_KEY], alpha: 0.28, noCastGroups: ['room:area:wall', 'room:area:cut', 'room:area:dining', 'room:area:street'] },
  occlusion: { strength: 0.5, reach: 0.6 },
  creases: true,
  grade: { from: 'warm', vignette: 0.28, contrast: 1.06, saturation: 1.08 },
});
// a face lit by the studio as it faces the camera (its winding is no matter: the side the camera sees is lit)
function studioLit(f, eye) {
  if (Array.isArray(f.cornerFills) || typeof f.fill !== 'string' || !/^#[0-9a-f]{6}$/i.test(f.fill)) return f;
  const n = newellNormal(f.corners), c = [0, 1, 2].map((k) => f.corners.reduce((t, p) => t + p[k], 0) / f.corners.length);
  const toEye = eye.map((v, k) => v - c[k]), m = n[0] * toEye[0] + n[1] * toEye[1] + n[2] * toEye[2] < 0 ? n.map((x) => -x) : n;
  return { ...f, fill: shadeHex(f.fill, m, STUDIO) };
}

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
  const cooks = Q.cooks ?? 1, T = tunedFor(Q), C = T.card;
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
    ...Object.entries(at.shelves).map(([item, p]) => ({ id: `shelf-${item}`, kind: 'shelf', at: p, size: [0.6, 0.6, 1.1], item, ...(K.passes.includes(item) ? { across: true } : {}) })),
    { id: 'serve', kind: 'pass', at: at.serve, size: [0.8, 1.6, 1] },
  ];
  const trade = G.room?.dress === false ? null : dressOf(C, typeof G.room?.dress === 'string' ? G.room.dress : null);
  const D = trade ? dressPlaces(places, trade, { card: C }) : { faces: [], dressed: new Set(), laid: [] };
  const blocks = places.map((p) => ({ id: p.id, x: [r3(p.at[0] - p.size[0] / 2), r3(p.at[0] + p.size[0] / 2)], y: [r3(p.at[1] - p.size[1] / 2), r3(p.at[1] + p.size[1] / 2)], h: r3(p.size[2]), fill: p.kind === 'counter' ? FILL[p.verb] : FILL[{ bin: 'crate', shelf: 'shelf', pass: 'serve' }[p.kind]], group: D.dressed.has(p.id) ? `room:dressed:${p.id}` : 'room:work' }));
  // the counter between the sides (its passes are the shelves above)
  K.blocks.filter((b) => b.kind === 'counter').forEach((b, k) => blocks.push({ id: `counter-${k}`, x: [b.min[0], b.max[0]], y: [b.min[1], b.max[1]], h: r3(b.max[2] - b.min[2]), fill: FILL.counter, group: 'room:counter' }));
  const room = floorOf({ half, blocks });
  // THE AREA: the trade's floor, its walls (cut away on the camera's side, the south) and what stands outside
  // (the trade's area, its floor quieted for the studio unless the world says its own)
  const A = readArea(G.room?.area ?? (trade === 'kitchen' ? { like: 'kitchen', floor: { pattern: 'tiles', colors: [...STUDIO_FLOOR] } } : undefined), trade ?? 'hall');
  const AR = A ? buildArea(A, { half, cut: ['s'], seed: 1 }) : null;
  const colliders = raiseWalls(room.colliders, half, AR?.heights);
  const kept = room.faces.filter((f) => f.group !== 'room:floor' && !String(f.group).startsWith('room:dressed:') && !(AR && f.group === 'room:wall')).map((f) => (f.group === 'room:wall' ? { ...f, fill: FILL.wall } : f));
  const lit = (list) => list.map((f) => studioLit(f, K.frame.at));
  // WHAT EACH CRATE HOLDS: its raw thing (the food shelf's, read off the card) sitting on it, so a crate is read at a glance
  const FOOD = foodOf(C);
  const onCrates = Object.entries(at.crates).flatMap(([item, p]) => (FOOD[item] ? foodFaces(FOOD[item], { at: [p[0], p[1], r3(p[2] + 0.72)], size: 0.5, group: 'room:food' }) : []));
  const faces = [...lit([...(AR ? AR.faces : room.faces.filter((f) => f.group === 'room:floor')), ...kept, ...D.faces]), ...onCrates];

  // THE SHIFT: the work mechanic on the kitchen's places, a hand a cook (the level's seats), its goal the tuned one
  const game = {
    levelRef: ref, fall: { mode: 'respawn' },
    mechanics: [{ kind: 'work', card: C, at: { origin: [0, 0, 0], stations: at.stations, crates: at.crates, shelves: at.shelves, serve: at.serve }, heading: 0, reach: REACH, bases: false, show: true, rail: true, ...(Q.serve ? { goal: Q.serve } : { goal: T.goal }) }],
  };
  const step = sfxSound('step-concrete', { style: 'realistic' })?.gestures ?? null;
  const manifest = {
    kind: 'controllable', title: title ?? `${G.name ?? G.id ?? 'The'} kitchen`, bg: AR ? AR.bg : FILL.bg, faces, colliders, figures,
    entities: [hero, ...bodies],
    camera: { rule: 'fixed', target: 'hero', stations: [{ at: K.frame.at, focus: K.frame.focus }], track: 0, lookH: 0 },
    ...(bodies.length ? { seats: { bodies: bodies.map((b) => b.id), max: cooks, join: 'drop-in', drop: 'pause' } } : {}),
    ...(step ? { audio: { footsteps: { step } } } : {}),
    // (the studio's baked and live light, and its grade: see STUDIO_LOOK)
    ...JSON.parse(JSON.stringify(STUDIO_LOOK)),
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
