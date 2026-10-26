/**
 * THE TEAM ARENA — a team goal game's venue as a stage recipe (era/stage.js: one open room on a stage kit, the pitch or
 * the rink in its middle, the stands behind the far goal), carrying the `pitch` the World page's channel plays
 * (scene/channels/contest.js), as the court arena carries its court (match-arena.js).
 *
 *   readTeam(spec) → M            { sport, players, register, level, periods?, seconds?, seed, kit, look?, crowd, title, athletes? } checked
 *   teamPitch(M) → the pitch in the stage's frame: the room, its half sizes, the goal, where its centre stands
 *   teamManifest(spec) → a `kind: 'stage'` recipe: the room, the stands, the camera, the `pitch` key
 *   teamArenaData(v) → the page's data: the game read, the sport's dials, the contest compiled, the pitch, the wire
 *
 * Stage coordinates are metres, z up; the court frame's origin is the pitch's centre at (0, stage.originY); side a's
 * goal is nearer the open side (y = 0), where the camera stands. Pure and deterministic.
 */
import { contestRead } from './contest-kernel.js';
import { TEAM_SPORT_IDS, resolveSport, sportDialsOf, sportKeyOf } from './sports.js';
import { TEAM_REGISTER_IDS } from './team-sim.js';
import { MIND_LEVEL_IDS } from './contest-mind.js';
import { ARENA_KITS } from '../versus/versus-arena.js';
import { readBroadcast, broadcastData, SIDE_KITS as BROADCAST_SIDE_KITS } from '../broadcast/broadcast-package.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, CONTRACT_VERSION } from '../game/level-contract.js';
import { readAthletes } from './athletes.js';
import { readVenue, venueManifest } from '../stadium/venue.js';

export const PITCH_WIRE = Object.freeze({ ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, version: CONTRACT_VERSION });
export const PITCH_PAGE_MODULES = Object.freeze([
  'physics/flight.js', 'contest/ball-card.js', 'polygonizer/hero-swing.js', 'contest/hit.js', 'worlds/physics-sim.js',
  'contest/contest-kernel.js', 'contest/contest-mind.js', 'contest/team-sim.js', 'contest/contest-stats.js', 'broadcast/broadcast.client.js', 'contest/team-arena.client.js',
]);
export const TEAM_DEFAULTS = Object.freeze({ sport: 'soccer', players: 1, register: 'realistic', level: 'regular', seed: 1, kit: 'island-plaza' });
/** Each side's kit colour, the broadcast's own when the recipe names none (broadcast-package.js SIDE_KITS, the page's
 * SIDE_COLORS): the shirt a side's rolled athletes wear, so the bug's chip and the shirt agree. */
export const SIDE_KITS = Object.freeze({ a: BROADCAST_SIDE_KITS[0], b: BROADCAST_SIDE_KITS[1] });
/** The most athletes a pitch carries: both sides of the largest team the sims play. */
export const TEAM_ATHLETES = 12;
export const PITCH_RUN_OFF = Object.freeze({ side: 5, end: 8 });
export const PITCH_H = 12;
const KIT_LOOK = { 'island-plaza': 'island-noon' };
const r3 = (v) => Math.round(v * 1000) / 1000;
const even = (v) => 2 * Math.ceil(v / 2);   // the stage's rooms sit on a one-metre grid, their x a whole number: even metres
const fail = (m) => { throw new Error(`team: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The game's words, checked. */
export function readTeam(spec = {}) {
  if (!isObj(spec)) fail('a team game is { sport?, players?, register?, level?, periods?, seconds?, seed?, kit?, look?, crowd?, title?, athletes?, broadcast?, venue? }');
  for (const k of Object.keys(spec)) if (!['sport', 'players', 'register', 'level', 'periods', 'seconds', 'seed', 'kit', 'look', 'crowd', 'title', 'athletes', 'broadcast', 'venue'].includes(k)) fail(`a team game has no '${k}' (sport, players, register, level, periods, seconds, seed, kit, look, crowd, title, athletes, broadcast, venue)`);
  const M = { ...TEAM_DEFAULTS, ...spec };
  if (typeof M.sport === 'string' && !TEAM_SPORT_IDS.includes(M.sport)) fail(`sport '${M.sport}' is one of ${TEAM_SPORT_IDS.join(', ')} (a team goal game; a net game plays on a court, a turn sport on a course), or a team game written out`);
  try { resolveSport(M.sport, 'team'); } catch (e) { fail(e.message.replace(/^contest: /, '')); }
  if (!(Number.isInteger(M.players) && M.players >= 0 && M.players <= 2)) fail('players is 0 (an exhibition), 1 (against the computer) or 2 (both sides local)');
  if (!TEAM_REGISTER_IDS.includes(M.register)) fail(`register is one of ${TEAM_REGISTER_IDS.join(', ')}`);
  if (!MIND_LEVEL_IDS.includes(M.level)) fail(`level is one of ${MIND_LEVEL_IDS.join(', ')} (the computer's)`);
  if (M.periods !== undefined && !(Number.isInteger(M.periods) && M.periods >= 1 && M.periods <= 4)) fail('periods is 1 to 4');
  if (M.seconds !== undefined && !(Number.isFinite(M.seconds) && M.seconds >= 20 && M.seconds <= 900)) fail('seconds is 20 to 900 a period');
  if (!Number.isInteger(M.seed)) fail('seed is a whole number');
  if (!ARENA_KITS.includes(M.kit)) fail(`kit '${M.kit}' is one of ${ARENA_KITS.join(', ')}`);
  if (M.crowd !== undefined && M.crowd !== false && !isObj(M.crowd)) fail('crowd is false or { rows?, fill? }');
  if (M.title !== undefined && typeof M.title !== 'string') fail('title is a string');
  const athletes = readAthletes(M.athletes, TEAM_ATHLETES, fail);   // side a's in its roles' order, then side b's
  const broadcast = M.broadcast === undefined ? undefined : readBroadcast(M.broadcast, 'team');
  return { sport: sportKeyOf(M.sport), players: M.players, register: M.register, level: M.level, ...(M.periods !== undefined ? { periods: M.periods } : {}), ...(M.seconds !== undefined ? { seconds: M.seconds } : {}), seed: M.seed, kit: M.kit, ...(M.look ? { look: M.look } : {}), crowd: M.crowd === false ? false : { rows: 3, fill: 0.8, ...(M.crowd ?? {}) }, ...(M.title ? { title: M.title } : {}), ...(athletes ? { athletes } : {}), ...(broadcast ? { broadcast } : {}), ...(M.venue ? { venue: readVenue(M.venue, fail) } : {}) };
}

/** The sport's dials the page carries (its spec is compiled apart). */
export const teamSportDials = (v) => sportDialsOf(resolveSport(v, 'team'));
/** The kernel's spec for the match: the book's with its clock, a written-out sport's as written (its clock as asked). */
const specOf = (M) => {
  const sp = resolveSport(M.sport, 'team');
  if (!sp.written) return sp.spec({ ...(M.periods !== undefined ? { periods: M.periods } : {}), ...(M.seconds !== undefined ? { seconds: M.seconds } : {}) });
  const spec = sp.spec();
  if (spec.clock && (M.periods !== undefined || M.seconds !== undefined)) spec.clock = { ...spec.clock, ...(M.periods !== undefined ? { periods: M.periods } : {}), ...(M.seconds !== undefined ? { seconds: M.seconds } : {}) };
  return spec;
};

/** The pitch in the stage's frame. */
export function teamPitch(M) {
  const sp = resolveSport(M.sport, 'team'), [w, l] = specOf(M).court.frame;
  const room = { w: even(w + 2 * PITCH_RUN_OFF.side), d: even(l + 2 * PITCH_RUN_OFF.end), h: PITCH_H };
  return { width: w, length: l, halfW: r3(w / 2), halfL: r3(l / 2), originY: r3(room.d / 2), room, goal: sp.goal, boards: sp.ground.boards };
}

/** The venue: a stage set with its camera side open behind side a's goal, the stands behind the far one. */
export function teamManifest(spec = {}) {
  const M = readTeam(spec), T = teamPitch(M);
  const title = M.title ?? `${typeof M.sport === 'string' ? M.sport : M.sport.id} · ${M.players === 2 ? 'two players' : M.players === 1 ? 'you against the computer' : 'an exhibition'}`;
  const camera = { name: 'end', worldFraming: { cameraPosition: [0, r3(T.originY - T.halfL - 14), 12], lookAt: [0, T.originY, 0.5], horizontalFov: 58, pictureCenter: [640, 360] } };
  const channel = { pitch: { ...M, ...(M.title ? {} : { title }) } };
  // (in a stadium when the arena names one: its room the field, its camera its own)
  if (M.venue) return venueManifest(M.venue, { room: { x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d }, surface: M.sport === 'hockey' ? 'ice' : 'grass', camera, title, channel });
  return {
    kind: 'stage',
    kit: M.kit,
    ...(M.look ?? KIT_LOOK[M.kit] ? { reference: M.look ?? KIT_LOOK[M.kit] } : {}),
    title,
    dress: false,
    viewBox: { width: 1280, height: 720 },
    rooms: [{ id: 'pitch', x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d, h: T.room.h, open: ['-y'] }],
    lights: 'auto',
    ...(M.crowd ? { stands: { from: r3(T.room.d - 0.5), rows: M.crowd.rows, fill: M.crowd.fill, shade: 0.62, seed: M.seed } } : {}),
    camera,
    ...channel,
  };
}

/** The page's data: the game, the sport's dials, the contest compiled, the pitch, the wire a hosting shell speaks; `bodies`
 * its athletes' (athletes.js athleteBodies), when it has any. */
export function teamArenaData(v = {}, { bodies = null } = {}) {
  const M = readTeam(v), T = teamPitch(M);
  const C = contestRead(specOf(M));
  return { ...M, sport: teamSportDials(M.sport), C, court: T, wire: PITCH_WIRE, broadcast: broadcastData(M.broadcast, { register: M.register, count: 2, kind: 'sides', where: 'pitch' }), ...(bodies ? { bodies } : {}) };
}
