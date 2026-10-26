/**
 * THE MEET ARENA — an athletic event's venue as a stage recipe (era/stage.js: one long room on a stage kit, its camera
 * side open, the stands behind the lanes), carrying the `meet` the World page's channel runs (scene/channels/contest.js),
 * as the versus arena carries its fight (versus/versus-arena.js).
 *
 *   MEET_EVENTS                   the events: a sprint (lanes, a distance), the hurdles (ten flights from 13.72 m every
 *                                 9.14 m: the 110 m hurdles' spacing, over the distance asked), the long jump (a runway
 *                                 to the board, three attempts)
 *   readMeet(spec) → M            { event, lanes, players, register, distance, attempts?, seed, kit, look?, crowd, title, athletes? }
 *                                 checked; throws, teaching
 *   meetTrack(M) → T              the track in the stage's frame (metres): the room, each lane's y, the start x, the
 *                                 finish, the hurdles, the board
 *   meetManifest(spec) → a `kind: 'stage'` recipe: the room, the stands, the broadcast camera, the `meet` key
 *   meetArenaData(v) → the page's data: the meet read, its track, the contest compiled (contest-kernel.js read), the wire
 *   meetSpec(M) → the contest kernel's spec for the event
 *   contestSource(file)           a sibling module as a classic-script fragment (the channel inlines the kernel and the
 *                                 sim by source, as versus's page does)
 *
 * Stage coordinates are metres, z up; the track runs along x at y = LANE_Y0 + lane × LANE_W, the open side at y = 0 where
 * the camera stands. Pure and deterministic.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { contestRead } from './contest-kernel.js';
import { ARENA_KITS } from '../versus/versus-arena.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, CONTRACT_VERSION } from '../game/level-contract.js';
import { MEET_REGISTER_IDS } from './meet-sim.js';
import { readAthletes } from './athletes.js';

export const MEET_WIRE = Object.freeze({ ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, version: CONTRACT_VERSION });
const SRC = moduleDir(import.meta.url, 'lib/graph/contest');
/** A sibling module as a classic-script fragment (import lines and `export ` stripped). */
export const contestSource = (file) => readFileSync(join(SRC, file), 'utf8').replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');

export const MEET_EVENTS = Object.freeze({
  sprint: Object.freeze({ measure: 'time', distance: 100, min: 40, max: 400, words: 'a sprint: the gun, the clock, the line' }),
  hurdles: Object.freeze({ measure: 'time', distance: 110, min: 60, max: 400, first: 13.72, gap: 9.14, flights: 10, words: 'the hurdles: ten flights cleared on the stride, a clipped one costs the run' }),
  longJump: Object.freeze({ measure: 'distance', distance: 40, min: 20, max: 60, attempts: 3, words: 'the long jump: a runway to the board, three attempts, the best counts' }),
});
export const MEET_EVENT_IDS = Object.freeze(Object.keys(MEET_EVENTS));
export const LANE_W = 1.22, LANE_Y0 = 2, RUN_IN = 4, RUN_OUT = 12, TRACK_H = 8;
export const MEET_DEFAULTS = Object.freeze({ event: 'sprint', lanes: 4, players: 1, register: 'realistic', seed: 1, kit: 'island-plaza' });
const KIT_LOOK = { 'island-plaza': 'island-noon' };
const r3 = (v) => Math.round(v * 1000) / 1000;
const even = (v) => 2 * Math.ceil(v / 2);   // the stage's rooms sit on a one-metre grid, their x a whole number: even metres
const fail = (m) => { throw new Error(`meet: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The meet's words, checked. */
export function readMeet(spec = {}) {
  if (!isObj(spec)) fail('a meet is { event, lanes?, players?, register?, distance?, attempts?, seed?, kit?, look?, crowd?, title?, athletes? }');
  for (const k of Object.keys(spec)) if (!['event', 'lanes', 'players', 'register', 'distance', 'attempts', 'seed', 'kit', 'look', 'crowd', 'title', 'athletes'].includes(k)) fail(`a meet has no '${k}' (event, lanes, players, register, distance, attempts, seed, kit, look, crowd, title, athletes)`);
  const M = { ...MEET_DEFAULTS, ...spec };
  const E = MEET_EVENTS[M.event];
  if (!E) fail(`event '${M.event}' is one of ${MEET_EVENT_IDS.join(', ')}`);
  if (!(Number.isInteger(M.lanes) && M.lanes >= 1 && M.lanes <= 8)) fail('lanes is 1 to 8 (one lane: a time trial)');
  if (!(Number.isInteger(M.players) && M.players >= 0 && M.players <= 4)) fail('players is 0 to 4 (the lanes players hold; the rest are the computer\'s)');
  if (M.players > M.lanes) fail(`players (${M.players}) is at most the lanes (${M.lanes})`);
  if (!MEET_REGISTER_IDS.includes(M.register)) fail(`register is one of ${MEET_REGISTER_IDS.join(', ')}`);
  const distance = M.distance ?? E.distance;
  if (!(Number.isFinite(distance) && distance >= E.min && distance <= E.max)) fail(`distance for ${M.event} is ${E.min} to ${E.max} m`);
  const attempts = E.attempts ? M.attempts ?? E.attempts : undefined;
  if (E.attempts && !(Number.isInteger(attempts) && attempts >= 1 && attempts <= 6)) fail('attempts is 1 to 6');
  if (!E.attempts && M.attempts !== undefined) fail(`${M.event} is a race: it has no attempts`);
  if (!Number.isInteger(M.seed)) fail('seed is a whole number');
  if (!ARENA_KITS.includes(M.kit)) fail(`kit '${M.kit}' is one of ${ARENA_KITS.join(', ')}`);
  if (M.crowd !== undefined && M.crowd !== false && !isObj(M.crowd)) fail('crowd is false or { rows?, fill? }');
  if (M.title !== undefined && typeof M.title !== 'string') fail('title is a string');
  const athletes = readAthletes(M.athletes, M.lanes, fail);   // a lane's runner each
  return { event: M.event, lanes: M.lanes, players: M.players, register: M.register, distance, ...(attempts ? { attempts } : {}), seed: M.seed, kit: M.kit, ...(M.look ? { look: M.look } : {}), crowd: M.crowd === false ? false : { rows: 3, fill: 0.8, ...(M.crowd ?? {}) }, ...(M.title ? { title: M.title } : {}), ...(athletes ? { athletes } : {}) };
}

/** The contest kernel's spec for the meet's event. */
export const meetSpec = (M) => ({ shape: 'meet', title: M.title ?? M.event, event: { kind: M.event, lanes: M.lanes, measure: MEET_EVENTS[M.event].measure, ...(M.attempts ? { attempts: M.attempts } : {}) } });

/** The track in the stage's frame: the room, each lane's y, the start, the finish, the hurdles, the board. */
export function meetTrack(M) {
  const E = MEET_EVENTS[M.event];
  const length = even(M.distance + RUN_IN + RUN_OUT), depth = even(LANE_Y0 * 2 + M.lanes * LANE_W);
  const x0 = r3(-length / 2 + RUN_IN);
  const lanesY = Array.from({ length: M.lanes }, (_, i) => r3(LANE_Y0 + (i + 0.5) * LANE_W));
  const hurdles = M.event === 'hurdles' ? Array.from({ length: E.flights }, (_, k) => r3(E.first + k * E.gap)).filter((h) => h < M.distance - 2) : [];
  return {
    room: { w: r3(length), d: r3(depth), h: TRACK_H }, x0, lanesY, laneW: LANE_W,
    distance: M.distance, finish: r3(x0 + M.distance), hurdles, hurdlesX: hurdles.map((h) => r3(x0 + h)),
    ...(E.measure === 'distance' ? { board: M.distance, boardX: r3(x0 + M.distance) } : {}),
  };
}

/** The venue: a stage set with its camera side open, the stands behind the lanes, the meet the page runs. */
export function meetManifest(spec = {}) {
  const M = readMeet(spec), T = meetTrack(M);
  const title = M.title ?? `${M.event} · ${M.lanes} lanes`;
  const camDist = Math.max(10, M.lanes * LANE_W * 1.6);
  return {
    kind: 'stage',
    kit: M.kit,
    ...(M.look ?? KIT_LOOK[M.kit] ? { reference: M.look ?? KIT_LOOK[M.kit] } : {}),
    title,
    dress: false,
    viewBox: { width: 1280, height: 720 },
    rooms: [{ id: 'track', x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d, h: T.room.h, open: ['-y'] }],
    lights: 'auto',
    ...(M.crowd ? { stands: { from: r3(T.room.d - 0.5), rows: M.crowd.rows, fill: M.crowd.fill, shade: 0.62, seed: M.seed } } : {}),
    camera: { name: 'broadcast', worldFraming: { cameraPosition: [T.x0 + 8, r3(-camDist * 0.2), 3], lookAt: [T.x0 + 8, r3(T.room.d / 2), 1], horizontalFov: 64, pictureCenter: [640, 360] } },
    meet: { ...M, ...(M.title ? {} : { title }) },
  };
}

/** The page's data: the meet, its track, the compiled contest and the wire a hosting shell speaks; `bodies` its athletes'
 * (athletes.js athleteBodies), when it has any. */
export function meetArenaData(v = {}, { bodies = null } = {}) {
  const M = readMeet(v), T = meetTrack(M);
  const C = contestRead(meetSpec(M));
  return {
    ...M, track: T,
    event: { kind: M.event, measure: MEET_EVENTS[M.event].measure, distance: M.distance, hurdles: T.hurdles, ...(T.board !== undefined ? { board: T.board } : {}), ...(M.attempts ? { attempts: M.attempts } : {}), words: MEET_EVENTS[M.event].words },
    C, wire: MEET_WIRE, ...(bodies ? { bodies } : {}),
  };
}
