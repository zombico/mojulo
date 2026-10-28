/**
 * THE FIELD ARENA — a bat-and-ball game's venue (baseball's diamond and its fence, cricket's oval and its rope) as a
 * stage recipe, carrying the `innings` the World page's channel plays (scene/channels/contest.js), as the court and the
 * pitch carry theirs.
 *
 *   readInnings(spec) → M          { sport, players, register, level, innings?, overs?, seed, kit, look?, crowd, title,
 *                                   athletes?, broadcast?, venue? } checked
 *   inningsField(M)                the field in the stage's frame: the room, where the batter stands (the field
 *                                   frame's origin), the fence's radius
 *   inningsManifest(spec)          a `kind: 'stage'` recipe: the room, the stands, the broadcast camera, the `innings` key
 *   inningsArenaData(v)            the page's data: the game read, the sport's dials, the contest compiled, the field,
 *                                   the wire, the athletes' bodies (v, { bodies }: contest/athletes.js)
 *
 * Stage coordinates are metres, z up; the field frame's origin is the batter at (0, originY), the field along +y. Pure
 * and deterministic.
 */
import { contestRead } from './contest-kernel.js';
import { INNINGS_SPORT_IDS, resolveSport, sportDialsOf, sportKeyOf } from './sports.js';
import { BAT_REGISTER_IDS } from './bat-sim.js';
import { MIND_LEVEL_IDS } from './contest-mind.js';
import { ARENA_KITS } from '../versus/versus-arena.js';
import { readBroadcast, broadcastData } from '../broadcast/broadcast-package.js';
import { MSG_READY, MSG_INIT, MSG_OUTCOME, CONTRACT_VERSION } from '../game/level-contract.js';
import { readAthletes } from './athletes.js';
import { readVenue, venueManifest } from '../stadium/venue.js';

export const INNINGS_WIRE = Object.freeze({ ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, version: CONTRACT_VERSION });
/** The modules the field page inlines, in the order each only uses names from the ones before it. */
export const INNINGS_PAGE_MODULES = Object.freeze([
  'physics/flight.js', 'contest/ball-card.js', 'worlds/physics-sim.js',
  'contest/contest-kernel.js', 'contest/bat-sim.js', 'contest/contest-stats.js', 'broadcast/broadcast.client.js', 'contest/innings-arena.client.js',
]);
export const INNINGS_DEFAULTS = Object.freeze({ sport: 'baseball', players: 1, register: 'action', level: 'regular', seed: 1, kit: 'island-plaza' });
const RUN_OFF = 8, FIELD_H = 14;
const KIT_LOOK = { 'island-plaza': 'island-noon' };
const r3 = (v) => Math.round(v * 1000) / 1000;
const even = (v) => 2 * Math.ceil(v / 2);
const fail = (m) => { throw new Error(`innings: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['sport', 'players', 'register', 'level', 'innings', 'overs', 'seed', 'kit', 'look', 'crowd', 'title', 'athletes', 'broadcast', 'venue'];

/** The game's words, checked. */
export function readInnings(spec = {}) {
  if (!isObj(spec)) fail(`a field is { ${KEYS.join('?, ')}? }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) fail(`a field has no '${k}' (${KEYS.join(', ')})`);
  const M = { ...INNINGS_DEFAULTS, ...spec };
  if (typeof M.sport === 'string' && !INNINGS_SPORT_IDS.includes(M.sport)) fail(`sport '${M.sport}' is one of ${INNINGS_SPORT_IDS.join(', ')} (a bat-and-ball game), or one written out`);
  let sp;
  try { sp = resolveSport(M.sport, 'innings'); } catch (e) { fail(e.message.replace(/^contest: /, '')); }
  if (!(Number.isInteger(M.players) && M.players >= 0 && M.players <= 2)) fail('players is 0 (an exhibition), 1 (against the computer) or 2 (both sides local)');
  if (!BAT_REGISTER_IDS.includes(M.register)) fail(`register is one of ${BAT_REGISTER_IDS.join(', ')}`);
  if (!MIND_LEVEL_IDS.includes(M.level)) fail(`level is one of ${MIND_LEVEL_IDS.join(', ')} (the computer's)`);
  const base = sp.spec().innings;
  if (M.innings !== undefined && !(Number.isInteger(M.innings) && M.innings >= 1 && M.innings <= 9)) fail('innings is 1 to 9 (each side bats so many times)');
  if (M.overs !== undefined && !(base.overs && Number.isInteger(M.overs) && M.overs >= 1 && M.overs <= 20)) fail(base.overs ? 'overs is 1 to 20 (a side\'s innings)' : `overs belong to a game of overs; ${typeof M.sport === 'string' ? M.sport : M.sport.id} counts its innings by outs`);
  if (!Number.isInteger(M.seed)) fail('seed is a whole number');
  if (!ARENA_KITS.includes(M.kit)) fail(`kit '${M.kit}' is one of ${ARENA_KITS.join(', ')}`);
  if (M.crowd !== undefined && M.crowd !== false && !isObj(M.crowd)) fail('crowd is false or { rows?, fill? }');
  if (M.title !== undefined && typeof M.title !== 'string') fail('title is a string');
  const athletes = readAthletes(M.athletes, 2 * sp.side, fail);   // side a's fielders in order, then side b's
  const broadcast = M.broadcast === undefined ? undefined : readBroadcast(M.broadcast, 'innings');
  return { sport: sportKeyOf(M.sport), players: M.players, register: M.register, level: M.level, ...(M.innings !== undefined ? { innings: M.innings } : {}), ...(M.overs !== undefined ? { overs: M.overs } : {}), seed: M.seed, kit: M.kit, ...(M.look ? { look: M.look } : {}), crowd: M.crowd === false ? false : { rows: 3, fill: 0.8, ...(M.crowd ?? {}) }, ...(M.title ? { title: M.title } : {}), ...(athletes ? { athletes } : {}), ...(broadcast ? { broadcast } : {}), ...(M.venue ? { venue: readVenue(M.venue, fail) } : {}) };
}

/** The sport's dials the page carries (its spec is compiled apart). */
export const inningsSportDials = (v) => sportDialsOf(resolveSport(v, 'innings'));
const specOf = (M) => resolveSport(M.sport, 'innings').spec({ ...(M.innings !== undefined ? { innings: M.innings } : {}), ...(M.overs !== undefined ? { overs: M.overs } : {}) });

/** The field in the stage's frame: a diamond's room in front of the plate, an oval's round the wicket. */
export function inningsField(M) {
  const sp = resolveSport(M.sport, 'innings'), F = sp.field, r = F.fence;
  const behind = F.fair ? 14 : r + RUN_OFF;   // a diamond's room starts behind the plate; an oval's round it
  const room = { w: even(2 * (r + RUN_OFF)), d: even(behind + r + RUN_OFF), h: FIELD_H };
  return { fence: r, fenceHeight: F.fenceHeight ?? 0, fair: F.fair ?? null, originY: r3(behind), room };
}

/** The venue: a stage set with its camera side open behind the batter, the stands round the far side. */
export function inningsManifest(spec = {}) {
  const M = readInnings(spec), T = inningsField(M);
  const id = typeof M.sport === 'string' ? M.sport : M.sport.id;
  const title = M.title ?? `${id} · ${M.players === 2 ? 'two players' : M.players === 1 ? 'you against the computer' : 'an exhibition'}`;
  const camera = { name: 'plate', worldFraming: { cameraPosition: [0, r3(T.originY - 12), 9], lookAt: [0, r3(T.originY + 30), 0.5], horizontalFov: 62, pictureCenter: [640, 360] } };
  const channel = { innings: { ...M, ...(M.title ? {} : { title }) } };
  if (M.venue) return venueManifest(M.venue, { room: { x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d }, surface: 'grass', camera, title, channel });
  return {
    kind: 'stage',
    kit: M.kit,
    ...(M.look ?? KIT_LOOK[M.kit] ? { reference: M.look ?? KIT_LOOK[M.kit] } : {}),
    title,
    dress: false,
    viewBox: { width: 1280, height: 720 },
    rooms: [{ id: 'field', x: r3(-T.room.w / 2), y: 0, w: T.room.w, d: T.room.d, h: T.room.h, open: ['-y'] }],
    lights: 'auto',
    ...(M.crowd ? { stands: { from: r3(T.room.d - 0.5), rows: M.crowd.rows, fill: M.crowd.fill, shade: 0.62, seed: M.seed } } : {}),
    camera,
    ...channel,
  };
}

/** The page's data: the game, the sport's dials, the contest compiled, the field, the wire a hosting shell speaks;
 * `bodies` its athletes' (athletes.js athleteBodies), when it has any. */
export function inningsArenaData(v = {}, { bodies = null } = {}) {
  const M = readInnings(v), T = inningsField(M);
  const C = contestRead(specOf(M));
  return { ...M, sport: inningsSportDials(M.sport), C, field: T, wire: INNINGS_WIRE, broadcast: broadcastData(M.broadcast, { register: M.register, count: 2, kind: 'sides', where: 'innings' }), ...(bodies ? { bodies } : {}) };
}
