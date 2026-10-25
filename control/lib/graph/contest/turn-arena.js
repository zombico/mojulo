/**
 * THE TURN ARENA — a turn sport's venue as a stage recipe (era/stage.js: one open room on a stage kit, the course or
 * the lane in its middle, the stands behind the far end), carrying the `turns` the World page's channel plays
 * (scene/channels/contest.js), as the court arena carries its court (match-arena.js).
 *
 *   readTurns(spec) → M           { sport, seats, players, register, level, rounds, seed, kit, look?, crowd, title } checked
 *   turnsCourse(M) → the course in the stage's frame: the room (the largest round's frame with run-off), where the
 *                                 course frame's origin stands in it, each round's frame and par
 *   turnsManifest(spec) → a `kind: 'stage'` recipe: the room, the stands, the camera, the `turns` key
 *   turnsArenaData(v) → the page's data: the game read, the sport's dials, the contest compiled, the course, the wire
 *
 * Stage coordinates are metres, z up; the course frame's origin is at (0, stage.originY), its y the stage's y, so the
 * tee and the approach are nearer the open side (y = 0) where the camera stands. Pure and deterministic.
 */
import { contestRead } from './contest-kernel.js';
import { SPORTS, TURN_SPORT_IDS } from './sports.js';
import { TURN_REGISTER_IDS } from './turn-sim.js';
import { MIND_LEVEL_IDS } from './contest-mind.js';
import { ARENA_KITS } from '../versus/versus-arena.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, CONTRACT_VERSION } from '../game/level-contract.js';

export const TURNS_WIRE = Object.freeze({ ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, version: CONTRACT_VERSION });
export const TURNS_PAGE_MODULES = Object.freeze([
  'physics/flight.js', 'contest/ball-card.js', 'polygonizer/hero-swing.js', 'contest/hit.js', 'worlds/physics-sim.js',
  'contest/contest-kernel.js', 'contest/contest-mind.js', 'contest/turn-sim.js', 'contest/turn-arena.client.js',
]);
export const TURNS_DEFAULTS = Object.freeze({ sport: 'golf', seats: 1, players: 1, register: 'realistic', level: 'regular', seed: 1, kit: 'island-plaza' });
export const COURSE_RUN_OFF = Object.freeze({ side: 6, end: 8 });
export const COURSE_H = 12;
const KIT_LOOK = { 'island-plaza': 'island-noon' };
const r3 = (v) => Math.round(v * 1000) / 1000;
const fail = (m) => { throw new Error(`turns: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const roundsOf = (sport) => (sport === 'golf' ? { key: 'holes', max: SPORTS.golf.holes.length, words: 'holes' } : { key: 'frames', max: 10, words: 'frames' });

/** The game's words, checked. */
export function readTurns(spec = {}) {
  if (!isObj(spec)) fail('a turn sport is { sport?, seats?, players?, register?, level?, rounds?, seed?, kit?, look?, crowd?, title? }');
  for (const k of Object.keys(spec)) if (!['sport', 'seats', 'players', 'register', 'level', 'rounds', 'seed', 'kit', 'look', 'crowd', 'title'].includes(k)) fail(`a turn sport has no '${k}' (sport, seats, players, register, level, rounds, seed, kit, look, crowd, title)`);
  const M = { ...TURNS_DEFAULTS, ...spec };
  if (!TURN_SPORT_IDS.includes(M.sport)) fail(`sport '${M.sport}' is one of ${TURN_SPORT_IDS.join(', ')} (a turn sport; a net game plays on a court)`);
  if (!(Number.isInteger(M.seats) && M.seats >= 1 && M.seats <= 8)) fail('seats is 1 to 8 (played hot-seat in order)');
  if (!(Number.isInteger(M.players) && M.players >= 0 && M.players <= M.seats)) fail(`players is 0 to the seats (${M.seats}): the seats people hold at the pad; the rest are the computer's`);
  if (!TURN_REGISTER_IDS.includes(M.register)) fail(`register is one of ${TURN_REGISTER_IDS.join(', ')}`);
  if (!MIND_LEVEL_IDS.includes(M.level)) fail(`level is one of ${MIND_LEVEL_IDS.join(', ')} (the computer's)`);
  const R = roundsOf(M.sport), rounds = M.rounds ?? R.max;
  if (!(Number.isInteger(rounds) && rounds >= 1 && rounds <= R.max)) fail(`rounds for ${M.sport} is 1 to ${R.max} (the ${R.words})`);
  if (!Number.isInteger(M.seed)) fail('seed is a whole number');
  if (!ARENA_KITS.includes(M.kit)) fail(`kit '${M.kit}' is one of ${ARENA_KITS.join(', ')}`);
  if (M.crowd !== undefined && M.crowd !== false && !isObj(M.crowd)) fail('crowd is false or { rows?, fill? }');
  if (M.title !== undefined && typeof M.title !== 'string') fail('title is a string');
  return { sport: M.sport, seats: M.seats, players: M.players, register: M.register, level: M.level, rounds, seed: M.seed, kit: M.kit, ...(M.look ? { look: M.look } : {}), crowd: M.crowd === false ? false : { rows: 3, fill: 0.8, ...(M.crowd ?? {}) }, ...(M.title ? { title: M.title } : {}) };
}

/** The sport's dials the page carries (its spec is compiled apart). */
export const turnSportDials = (id) => { const { spec, ...dials } = SPORTS[id]; void spec; return { id, ...dials }; };
const specOf = (M) => (M.sport === 'golf' ? SPORTS.golf.spec({ holes: M.rounds }) : SPORTS.bowling.spec({ frames: M.rounds }));

/** The course in the stage's frame: the room holds the largest round. */
export function turnsCourse(M) {
  const C = contestRead(specOf(M));
  const frames = C.rounds.map((r) => r.course.frame);
  const w = Math.max(...frames.map((f) => f[0])), d = Math.max(...frames.map((f) => f[1]));
  const room = { w: r3(w + 2 * COURSE_RUN_OFF.side), d: r3(d + 2 * COURSE_RUN_OFF.end), h: COURSE_H };
  return { width: w, depth: d, originY: r3(room.d / 2), room, rounds: C.rounds.map((r, i) => ({ round: i + 1, par: r.par, frame: r.course.frame.slice(), regions: Object.keys(r.course.regions) })) };
}

/** The venue: a stage set with its camera side open behind the tee or the approach, the stands behind the far end. */
export function turnsManifest(spec = {}) {
  const M = readTurns(spec), T = turnsCourse(M);
  const R = roundsOf(M.sport);
  const title = M.title ?? `${M.sport} · ${M.rounds} ${R.words} · ${M.players >= 2 ? `${M.players} players` : M.players === 1 ? (M.seats > 1 ? 'you against the computer' : 'solo') : 'an exhibition'}`;
  return {
    kind: 'stage',
    kit: M.kit,
    ...(M.look ?? KIT_LOOK[M.kit] ? { reference: M.look ?? KIT_LOOK[M.kit] } : {}),
    title,
    dress: false,
    viewBox: { width: 1280, height: 720 },
    rooms: [{ id: 'course', x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d, h: T.room.h, open: ['-y'] }],
    lights: 'auto',
    ...(M.crowd ? { stands: { from: r3(T.room.d - 0.5), rows: M.crowd.rows, fill: M.crowd.fill, shade: 0.62, seed: M.seed } } : {}),
    camera: { name: 'follow', worldFraming: { cameraPosition: [0, r3(T.originY - T.depth / 2 - 10), 6], lookAt: [0, T.originY, 0.5], horizontalFov: 58, pictureCenter: [640, 360] } },
    turns: { ...M, ...(M.title ? {} : { title }) },
  };
}

/** The page's data: the game, the sport's dials, the contest compiled, the course, the wire a hosting shell speaks. */
export function turnsArenaData(v = {}) {
  const M = readTurns(v), T = turnsCourse(M);
  const C = contestRead({ ...specOf(M), players: M.seats });
  return { ...M, sport: turnSportDials(M.sport), C, course: T, wire: TURNS_WIRE };
}
