/**
 * THE ZONE CHAIN (the traditional side-scroller map, docs/side-map-principles.md): a side map written as WORDS, the chain
 * of camera zones its level is laid from. Read and refused with teaching, never guessed; laid in screens and the hero's
 * reach by the side map's layout. The words are keyed in the cosmos cube: the form a level form of space
 * (`space.levelForm=side-map`), its fills reality's (`reality.fill`, fills.js).
 *
 *   sidemap: { premise?, fill?, crates?, boss?, zones: [ZONE, …] }
 *     premise   one sentence: who goes through this place, and toward what
 *     fill      the closed parts' fill where a zone names none (fills.js)
 *     crates    true: breakable crates on its runs (crates.js), hopped or shot apart; the level breaks `objects`
 *     boss      the boss its last room holds (a roster id, gameworld/bosses.js; the world checks it): stood there, its fall
 *               the level's end (side-map/boss-cast.js)
 *   ZONE (a RUN or a ROOM, never both):
 *     run       'across' | 'up' | 'down': a run, one screen thick, scrolling along its axis
 *     screens   its length in screens (a run's; at least one)
 *     room      [wide, tall] in screens (each at least one): a room that scrolls both ways
 *     teach     what it teaches (the first level's words, course.js TEACH): basic | meet | advanced | gauntlet | boss
 *     beat      or a beat that teaches nothing new: rest | reveal | landing | commit
 *     climb     an up run's form: ledges | switchback | chimney | stair | ladder | tower | atrium (CLIMBS; a chimney
 *               unsaid)
 *     rises     an up run's frame rises on its own: the screen from below
 *     drop      a down run's form: cascade (steps, free) | chute (one-way: a commit)
 *     place     the place it is (a word: the gate, the factory floor), and `fill` its closed parts' own
 *     spawners  the places foes come from along it (a count); `pillars` over a gap (a count); `ceiling` true: a held one
 *     reveal    true: the next place is shown off as it is reached
 *
 *   readSideMap(v, at?) → the chain as read: { premise?, fill?, crates?, zones: [{ kind: 'run' | 'room', … }] }; throws, teaching
 *   SIDE_MAP_KEYS, ZONE_KEYS, RUN_AXES, BEATS, CLIMBS, DROPS
 *
 * Pure.
 */
import { TEACH } from '../course.js';
import { FILLS } from './fills.js';
import { VISTA_IDS } from './vista.js';

export const SIDE_MAP_KEYS = Object.freeze(['premise', 'fill', 'crates', 'boss', 'zones']);
export const ZONE_KEYS = Object.freeze(['run', 'screens', 'room', 'teach', 'beat', 'climb', 'rises', 'drop', 'place', 'fill', 'spawners', 'pillars', 'ceiling', 'reveal', 'vista']);
export const RUN_AXES = Object.freeze(['across', 'up', 'down']);
/** the beats that teach nothing new (a zone's `teach` is the first level's own words) */
export const BEATS = Object.freeze({
  rest: 'a breath between tests: nothing asked',
  reveal: 'the place shown off: the next thing seen at its size',
  landing: 'after a climb or a fight: wide, flat, a pickup, a view',
  commit: 'no way back: a one-way drop or a door that shuts',
});
/** the forms of climbing, in the order a stage climbs them (what each adds) */
export const CLIMBS = Object.freeze({
  ledges: 'ledges up a face in the open, each no higher than the jump: rising by jumps alone',
  switchback: 'floors inside a mass climbed back and forth: rising to and fro, enclosed',
  chimney: 'a shaft between two walls climbed by kicks, with rests: the wall kick, sustained',
  stair: 'a short flight of ledges inside: a breather between climbs',
  ladder: 'climbed hand over hand: the free way up, or the way back',
  tower: 'a screen wide, climbed by its structure: stairs walked across it, landings on its walls, a ladder at each turn',
  atrium: 'two screens wide round a core, climbed by its structure, the way woven through the core from screen to screen',
});
export const DROPS = Object.freeze({ cascade: 'steps down: going down is free', chute: 'a one-way drop: a commit' });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (o) => Object.keys(o).join(' | ');

function readZone(z, at) {
  if (!isObj(z)) throw new Error(`side map: ${at} is a zone: { run, screens, … } or { room: [wide, tall], … }`);
  for (const k of Object.keys(z)) if (!ZONE_KEYS.includes(k)) throw new Error(`side map: ${at}.${k} is not a zone's word (${ZONE_KEYS.join(', ')})`);
  const run = z.run !== undefined, room = z.room !== undefined;
  if (run === room) throw new Error(`side map: ${at} is a run ({ run: ${RUN_AXES.join(' | ')}, screens }) or a room ({ room: [wide, tall] }), one of them`);
  const out = {};
  if (run) {
    if (!RUN_AXES.includes(z.run)) throw new Error(`side map: ${at}.run is ${RUN_AXES.join(' | ')} (the axis it scrolls along)`);
    if (!(Number.isFinite(z.screens) && z.screens >= 1)) throw new Error(`side map: ${at}.screens is its length in screens, at least one (a run is never less than a screen)`);
    Object.assign(out, { kind: 'run', run: z.run, screens: z.screens });
  } else {
    if (!(Array.isArray(z.room) && z.room.length === 2 && z.room.every((n) => Number.isFinite(n) && n >= 1))) throw new Error(`side map: ${at}.room is [wide, tall] in screens, each at least one`);
    if (z.screens !== undefined) throw new Error(`side map: ${at}.screens is a run's length; a room says its size in room: [wide, tall]`);
    Object.assign(out, { kind: 'room', room: [...z.room] });
  }
  // (what the camera sees behind it, vista.js: a vista from the library, or 'wall', the plain back wall; unsaid, its place's)
  if (z.vista !== undefined) { if (!VISTA_IDS.includes(z.vista)) throw new Error(`side map: ${at}.vista is ${VISTA_IDS.join(' | ')} (what stands behind it; 'wall' the plain back wall)`); out.vista = z.vista; }
  if (z.teach !== undefined && z.beat !== undefined) throw new Error(`side map: ${at} says what it teaches (teach) or a beat that teaches nothing new (beat), not both`);
  if (z.teach !== undefined) { if (!TEACH.includes(z.teach)) throw new Error(`side map: ${at}.teach is ${TEACH.join(' | ')} (the first level's words)`); out.teach = z.teach; }
  if (z.beat !== undefined) { if (!BEATS[z.beat]) throw new Error(`side map: ${at}.beat is ${Object.entries(BEATS).map(([k, v]) => `${k} (${v})`).join('; ')}`); out.beat = z.beat; }
  // the up run's words, the down run's, the across run's
  const only = (k, axis, what) => { if (z[k] !== undefined && out.run !== axis) throw new Error(`side map: ${at}.${k} is ${what}: ${axis === 'down' ? 'a' : 'an'} ${axis} run's word`); };
  only('climb', 'up', 'how it is climbed'); only('rises', 'up', 'the screen from below'); only('drop', 'down', 'how it is dropped down');
  only('pillars', 'across', 'tops over a gap to cross'); only('ceiling', 'across', 'a held ceiling');
  if (out.run === 'up') {
    const c = z.climb ?? 'chimney';
    if (!CLIMBS[c]) throw new Error(`side map: ${at}.climb is ${Object.entries(CLIMBS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
    out.climb = c;
    if (z.rises !== undefined) { if (typeof z.rises !== 'boolean') throw new Error(`side map: ${at}.rises is true (its frame rises on its own) or false`); if (z.rises) out.rises = true; }
  }
  if (out.run === 'down') {
    const d = z.drop ?? 'cascade';
    if (!DROPS[d]) throw new Error(`side map: ${at}.drop is ${Object.entries(DROPS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
    out.drop = d;
    // (a chute is one-way: its beat is a commit, said or not)
    if (d === 'chute' && out.beat === undefined && out.teach === undefined) out.beat = 'commit';
  }
  for (const k of ['spawners', 'pillars']) if (z[k] !== undefined) { if (!(Number.isInteger(z[k]) && z[k] >= 0)) throw new Error(`side map: ${at}.${k} is a count (0 or more)`); out[k] = z[k]; }
  for (const k of ['ceiling', 'reveal']) if (z[k] !== undefined) { if (typeof z[k] !== 'boolean') throw new Error(`side map: ${at}.${k} is true or false`); if (z[k]) out[k] = true; }
  if (z.place !== undefined) { if (!(typeof z.place === 'string' && z.place.trim())) throw new Error(`side map: ${at}.place is the place it is, a word (the gate, the factory floor)`); out.place = z.place.trim(); }
  if (z.fill !== undefined) { if (!FILLS[z.fill]) throw new Error(`side map: ${at}.fill is ${list(FILLS)} (what its closed parts are painted as)`); out.fill = z.fill; }
  return out;
}

/** A side map as written → the chain as read; throws, teaching, on any word it does not know. */
export function readSideMap(v, at = 'sidemap') {
  if (!isObj(v)) throw new Error(`side map: ${at} is { premise?, fill?, zones: [ … ] }, a chain of camera zones`);
  for (const k of Object.keys(v)) if (!SIDE_MAP_KEYS.includes(k)) throw new Error(`side map: ${at}.${k} is not a side map's word (${SIDE_MAP_KEYS.join(', ')})`);
  if (!(Array.isArray(v.zones) && v.zones.length)) throw new Error(`side map: ${at}.zones is the chain: a list of zones, at least one`);
  const out = {};
  if (v.premise !== undefined) { if (!(typeof v.premise === 'string' && v.premise.trim())) throw new Error(`side map: ${at}.premise is one sentence: who goes through this place, and toward what`); out.premise = v.premise.trim(); }
  if (v.fill !== undefined) { if (!FILLS[v.fill]) throw new Error(`side map: ${at}.fill is ${list(FILLS)}`); out.fill = v.fill; }
  if (v.crates !== undefined) { if (typeof v.crates !== 'boolean') throw new Error(`side map: ${at}.crates is true or false (breakable crates on its runs)`); if (v.crates) out.crates = true; }
  out.zones = v.zones.map((z, i) => readZone(z, `${at}.zones[${i}]`));
  if (v.boss !== undefined) {
    if (!(typeof v.boss === 'string' && /^[a-z][a-z0-9-]*$/.test(v.boss))) throw new Error(`side map: ${at}.boss is a boss's id (a short lower-case name: the roster's)`);
    if (!(out.zones.at(-1).kind === 'room' && out.zones.at(-1).teach === 'boss')) throw new Error(`side map: ${at}.boss stands in its last zone, a room that teaches the boss ({ room: [w, h], teach: 'boss' })`);
    out.boss = v.boss;
  }
  return out;
}
