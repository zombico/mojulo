/**
 * THE COURT ARENA — a net game's venue as a stage recipe (era/stage.js: one open room on a stage kit, the court in its
 * middle, the stands behind the far baseline), carrying the `court` the World page's channel plays
 * (scene/channels/contest.js), as the meet arena carries its meet (meet-arena.js).
 *
 *   readMatch(spec) → M           { sport, players, register, level, sets, seed, kit, look?, crowd, title, athletes? } checked
 *   matchCourt(M) → the court in the stage's frame: the room, the court's half sizes, where its centre stands (the
 *                                 court frame's origin), the net's height and posts
 *   matchManifest(spec) → a `kind: 'stage'` recipe: the room, the stands, the broadcast camera, the `court` key
 *   matchArenaData(v) → the page's data: the match read, the sport's dials, the contest compiled, the court, the wire, the
 *                                 athletes' bodies (v, { bodies }: contest/athletes.js)
 *   graphSource(rel)              a module under lib/graph as a classic-script fragment (the channel inlines the ball's
 *                                 flight, the ball card, the swing system, the hit, the physics integrator, the kernel,
 *                                 the mind and the sim by source)
 *
 * Stage coordinates are metres, z up; the court frame's origin is the net's centre at (0, stage.netY); its y runs along
 * the stage's y, so side a's end is nearer the open side (y = 0), where the camera stands. Pure and deterministic.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { contestRead } from './contest-kernel.js';
import { MATCH_SPORT_IDS, resolveSport, sportDialsOf, sportKeyOf } from './sports.js';
import { MATCH_REGISTER_IDS } from './match-sim.js';
import { MIND_LEVEL_IDS } from './contest-mind.js';
import { ARENA_KITS } from '../versus/versus-arena.js';
import { readBroadcast, broadcastData } from '../broadcast/broadcast-package.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, CONTRACT_VERSION } from '../game/level-contract.js';
import { readAthletes } from './athletes.js';
import { readVenue, venueManifest } from '../stadium/venue.js';

export const COURT_WIRE = Object.freeze({ ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, version: CONTRACT_VERSION });
const GRAPH = join(moduleDir(import.meta.url, 'lib/graph/contest'), '..');
/** A module under lib/graph as a classic-script fragment (import lines and `export ` stripped). */
export const graphSource = (rel) => readFileSync(join(GRAPH, rel), 'utf8').replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '');
/** The modules the court page inlines, in the order each only uses names from the ones before it. */
export const COURT_PAGE_MODULES = Object.freeze([
  'physics/flight.js', 'contest/ball-card.js', 'polygonizer/hero-swing.js', 'contest/hit.js', 'worlds/physics-sim.js',
  'contest/contest-kernel.js', 'contest/contest-mind.js', 'contest/match-sim.js', 'contest/contest-stats.js', 'broadcast/broadcast.client.js', 'contest/match-arena.client.js',
]);

/**
 * THE COURT'S SURFACE: how the floor meets the ball (the physics' contact takes the lower restitution and the root of
 * the frictions, worlds/physics-sim.js). Absent, the floor is neutral (the ball's own bounce and a full grip): the court
 * as it has always played, which is the clay's. Grass skids and keeps low, a hard court plays true between them.
 */
export const COURT_SURFACES = Object.freeze({
  clay: Object.freeze({ restitution: 1, friction: 1, words: 'clay: the ball grips and sits up, the rallies long' }),
  hard: Object.freeze({ restitution: 0.72, friction: 0.7, words: 'a hard court: a true, medium-fast bounce' }),
  grass: Object.freeze({ restitution: 0.66, friction: 0.45, words: 'grass: the ball skids and keeps low, the serve rules' }),
});
export const MATCH_DEFAULTS = Object.freeze({ sport: 'tennis', players: 1, register: 'realistic', level: 'regular', sets: 1, seed: 1, kit: 'island-plaza' });
export const RUN_OFF = Object.freeze({ side: 4, end: 7 });   // metres of floor beside the lines and behind each baseline
export const COURT_H = 9;
const KIT_LOOK = { 'island-plaza': 'island-noon' };
const r3 = (v) => Math.round(v * 1000) / 1000;
const even = (v) => 2 * Math.ceil(v / 2);   // the stage's rooms sit on a one-metre grid, their x a whole number: even metres
const fail = (m) => { throw new Error(`court: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The match's words, checked. */
export function readMatch(spec = {}) {
  if (!isObj(spec)) fail('a court is { sport?, players?, register?, level?, sets?, surface?, seed?, kit?, look?, crowd?, title?, athletes?, broadcast?, venue? }');
  for (const k of Object.keys(spec)) if (!['sport', 'players', 'register', 'level', 'sets', 'surface', 'seed', 'kit', 'look', 'crowd', 'title', 'athletes', 'broadcast', 'venue'].includes(k)) fail(`a court has no '${k}' (sport, players, register, level, sets, surface, seed, kit, look, crowd, title, athletes, broadcast, venue)`);
  if (spec.surface !== undefined && !COURT_SURFACES[spec.surface]) fail(`surface '${spec.surface}' is one of ${Object.keys(COURT_SURFACES).join(', ')} (how the court plays)`);
  const M = { ...MATCH_DEFAULTS, ...spec };
  if (typeof M.sport === 'string' && !MATCH_SPORT_IDS.includes(M.sport)) fail(`sport '${M.sport}' is one of ${MATCH_SPORT_IDS.join(', ')} (a net game; a turn sport plays on a course, a team game on a pitch), or a net game written out`);
  try { resolveSport(M.sport, 'match'); } catch (e) { fail(e.message.replace(/^contest: /, '')); }
  if (!(Number.isInteger(M.players) && M.players >= 0 && M.players <= 2)) fail('players is 0 (an exhibition), 1 (against the computer) or 2 (both sides local)');
  if (!MATCH_REGISTER_IDS.includes(M.register)) fail(`register is one of ${MATCH_REGISTER_IDS.join(', ')}`);
  if (!MIND_LEVEL_IDS.includes(M.level)) fail(`level is one of ${MIND_LEVEL_IDS.join(', ')} (the computer's)`);
  if (!(Number.isInteger(M.sets) && M.sets >= 1 && M.sets <= 3)) fail('sets is 1 to 3 (the sets to win)');
  if (!Number.isInteger(M.seed)) fail('seed is a whole number');
  if (!ARENA_KITS.includes(M.kit)) fail(`kit '${M.kit}' is one of ${ARENA_KITS.join(', ')}`);
  if (M.crowd !== undefined && M.crowd !== false && !isObj(M.crowd)) fail('crowd is false or { rows?, fill? }');
  if (M.title !== undefined && typeof M.title !== 'string') fail('title is a string');
  const athletes = readAthletes(M.athletes, 2, fail);   // side a's player, then side b's
  const broadcast = M.broadcast === undefined ? undefined : readBroadcast(M.broadcast, 'court');
  return { sport: sportKeyOf(M.sport), players: M.players, register: M.register, level: M.level, sets: M.sets, ...(M.surface ? { surface: M.surface } : {}), seed: M.seed, kit: M.kit, ...(M.look ? { look: M.look } : {}), crowd: M.crowd === false ? false : { rows: 3, fill: 0.8, ...(M.crowd ?? {}) }, ...(M.title ? { title: M.title } : {}), ...(athletes ? { athletes } : {}), ...(broadcast ? { broadcast } : {}), ...(M.venue ? { venue: readVenue(M.venue, fail) } : {}) };
}

/** The sport's dials the page carries (its spec is compiled apart). */
export const sportDials = (v) => sportDialsOf(resolveSport(v, 'match'));

/** The court in the stage's frame. */
export function matchCourt(M) {
  const sp = resolveSport(M.sport, 'match'), spec = sp.spec({ sets: M.sets }), [w, l] = spec.court.frame;
  const room = { w: even(w + 2 * RUN_OFF.side), d: even(l + 2 * RUN_OFF.end), h: COURT_H };
  return { width: w, length: l, halfW: r3(w / 2), halfL: r3(l / 2), netY: r3(room.d / 2), room, net: sp.net, regions: spec.court.regions };
}

/** The venue: a stage set with its camera side open behind side a's baseline, the stands behind the far one. */
export function matchManifest(spec = {}) {
  const M = readMatch(spec), T = matchCourt(M);
  const title = M.title ?? `${typeof M.sport === 'string' ? M.sport : M.sport.id} · ${M.players === 2 ? 'two players' : M.players === 1 ? 'you against the computer' : 'an exhibition'}`;
  const camera = { name: 'broadcast', worldFraming: { cameraPosition: [0, r3(T.netY - T.halfL - 12), 7], lookAt: [0, T.netY, 0.5], horizontalFov: 58, pictureCenter: [640, 360] } };
  const channel = { court: { ...M, ...(M.title ? {} : { title }) } };
  // (in a stadium when the arena names one: its room the field, its camera its own)
  if (M.venue) return venueManifest(M.venue, { room: { x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d }, surface: M.surface ?? (M.sport === 'tennis' ? 'grass' : 'hard'), camera, title, channel });
  return {
    kind: 'stage',
    kit: M.kit,
    ...(M.look ?? KIT_LOOK[M.kit] ? { reference: M.look ?? KIT_LOOK[M.kit] } : {}),
    title,
    dress: false,
    viewBox: { width: 1280, height: 720 },
    rooms: [{ id: 'court', x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d, h: T.room.h, open: ['-y'] }],
    lights: 'auto',
    ...(M.crowd ? { stands: { from: r3(T.room.d - 0.5), rows: M.crowd.rows, fill: M.crowd.fill, shade: 0.62, seed: M.seed } } : {}),
    camera,
    ...channel,
  };
}

/** The page's data: the match, the sport's dials, the contest compiled, the court, the wire a hosting shell speaks; `bodies`
 * its athletes' (athletes.js athleteBodies), when it has any. */
export function matchArenaData(v = {}, { bodies = null } = {}) {
  const M = readMatch(v), T = matchCourt(M);
  const C = contestRead(resolveSport(M.sport, 'match').spec({ sets: M.sets }));
  return { ...M, sport: sportDials(M.sport), C, court: T, ...(M.surface ? { floor: { restitution: COURT_SURFACES[M.surface].restitution, friction: COURT_SURFACES[M.surface].friction } } : {}), wire: COURT_WIRE, broadcast: broadcastData(M.broadcast, { register: M.register, count: 2, kind: 'sides', where: 'court' }), ...(bodies ? { bodies } : {}) };
}
