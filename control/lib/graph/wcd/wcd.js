/**
 * THE WALLED-CORE DUNGEON (WCD) — a dungeon built as layers on a critical path toward a final area, the CORE. Each layer
 * gates the next and takes the player deeper: across, down or up (a concept followed, not a map's shape). Shadow Moses
 * (a dock, a forward base, the interior base, the fortifications, the core) and the three walls (Maria, Rose, Sina) are
 * both WCDs; a stealth game is close to a stack of them, a metroidvania WCDs side by side, one core's reward opening
 * another's gate.
 *
 * Three kinds of space, and the joins between them:
 *   inner          a new dungeon: a place of its own, its own rooms, its own look; the core is always one
 *   outer          a space that binds inners together: crossed to reach the next; never the core
 *   intermediary   a door between two spaces (a lift, a teleporter, a door, a stair), carrying what opens it (its gate)
 *
 * The recipe (a design_game world's `wcd`):
 *   { core: '<space id>',
 *     spaces: { <id>: { kind: 'inner' | 'outer', depth: 0…, level?: '<world level id>', use?: '<program use>',
 *                       look?: compose words | { words?, construction?, palette? }, tone?: a stage's tone, built?: false } },
 *     doors: [{ from, to, via: 'lift' | 'teleporter' | 'door' | 'stair', gate?: { clearance: 1…9 } | { power: '<id>' },
 *               oneWay?: true }] }
 *   depth     0 the outermost; the core the deepest. A space marked `built: false` is on the path and not made yet (a
 *             vertical slice ships the inner layers alone).
 *   oneWay    a door that opens only from `from` (a shortcut back out, or a drop): a two-way door by default.
 *   look, tone   a space bound to a building level builds it: its look the stage's composed construction and palette
 *             (a base building's level is composed, and so stocked, with or without one: era/stocking.js), its tone the
 *             stage's colour (era/tone.js), carried on the dungeon so a rerun of the world keeps it.
 *   a lift and a teleporter move within one level (a lift between its storeys, a teleporter pad to pad); a door and a
 *   stair may join two levels.
 *
 * Refused (malformed): an unknown key, a core that is no space, a door to no space, a word outside its list.
 * Advised (the PRINCIPLES, as laws: measured, never refusing), each { law, holds, says }:
 *   deeper        the critical path deepens at every door and ends in the core, the deepest space
 *   core-inner    the core is an inner
 *   outers-bind   every outer joins two spaces or more (an outermost one binds the world outside to what it joins)
 *   gated         every space past the outermost is entered through a door, and a door inward says what opens it
 *   distinct      two spaces a door joins differ in construction or palette (the light is the theme's, set once)
 *   same-level    a lift or a teleporter joins spaces in one level
 *
 *   WCD_KINDS, WCD_VIAS, WCD_PRINCIPLES
 *   readWcd(spec, { levels? })   → { core, spaces, doors, path, unbuilt, laws }   levels: the world's level ids, to check
 *                                    a space's `level` by
 *   wcdLaws(read)                → the laws above
 *
 * Pure, no dice.
 */
import { readCompose } from '../era/compose.js';
import { PROGRAM_IDS } from '../era/programs.js';
import { readTone } from '../era/tone.js';

export const WCD_KINDS = Object.freeze({
  inner: 'a new dungeon: a place of its own, its own rooms and look; the core is always one',
  outer: 'a space that binds inners together, crossed to reach the next; never the core',
});
export const WCD_VIAS = Object.freeze({
  lift: 'a deck between storeys, inside one level',
  teleporter: 'a pad that sends you to its other pad, inside one level',
  door: 'a doorway or a blast door; may join two levels',
  stair: 'a flight between storeys; may join two levels',
});
export const WCD_PRINCIPLES = Object.freeze({
  deeper: 'Deeper on every step: the critical path deepens at every door and ends in the core.',
  'core-inner': 'The core is an inner.',
  'outers-bind': 'Outers bind, inners hold: every outer joins two spaces or more.',
  gated: 'Every gate is an intermediary: a space past the outermost is entered through a door that says what opens it.',
  distinct: 'A layer looks unlike the last: two spaces a door joins differ in construction or palette.',
  'same-level': 'A lift or a teleporter moves you within one level.',
});
const KEYS = ['core', 'spaces', 'doors'];
const SPACE_KEYS = ['kind', 'depth', 'level', 'use', 'look', 'tone', 'built'];
const DOOR_KEYS = ['from', 'to', 'via', 'gate', 'oneWay'];
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => { throw new Error(`wcd: ${m}`); };

function readGate(g, at) {
  if (g === undefined) return null;
  if (!isObj(g) || Object.keys(g).length !== 1) fail(`${at}.gate is { clearance: 1…9 } or { power: '<id>' }`);
  if (g.clearance !== undefined) {
    if (!(Number.isInteger(g.clearance) && g.clearance >= 1 && g.clearance <= 9)) fail(`${at}.gate.clearance is a whole number, 1 to 9`);
    return { clearance: g.clearance };
  }
  if (g.power !== undefined) {
    if (typeof g.power !== 'string' || !ID.test(g.power)) fail(`${at}.gate.power is a power's id (lower-case, hyphens)`);
    return { power: g.power };
  }
  return fail(`${at}.gate is { clearance: 1…9 } or { power: '<id>' }`);
}

// a space's look as the composer resolves it (era/compose.js): its construction and palette, or null when it names none
function lookOf(look, at) {
  if (look === undefined) return null;
  const c = typeof look === 'string' ? { words: look } : look;
  if (!isObj(c) || Object.keys(c).some((k) => !['words', 'construction', 'palette'].includes(k))) fail(`${at}.look is the composer's words, or { words?, construction?, palette? }`);
  let resolved;
  try { ({ resolved } = readCompose(c)); } catch (e) { fail(`${at}.look: ${e.message.replace(/^stage: compose:? ?/, '')}`); }
  return { construction: resolved.construction, palette: resolved.palette };
}

/** The recipe read and checked; its critical path; its laws. */
export function readWcd(spec, { levels = null } = {}) {
  if (!isObj(spec)) fail('a walled-core dungeon is { core, spaces: { <id>: { kind, depth, … } }, doors: [{ from, to, via, gate?, oneWay? }] }');
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) fail(`'${k}' is not a setting (${KEYS.join(', ')})`);
  if (!isObj(spec.spaces) || !Object.keys(spec.spaces).length) fail('spaces is { <id>: { kind: inner | outer, depth, … } }, at least one');
  const spaces = {};
  for (const [id, S] of Object.entries(spec.spaces)) {
    const at = `spaces.${id}`;
    if (!ID.test(id)) fail(`${at}: an id is a short lower-case name (letters, digits, hyphens)`);
    if (!isObj(S)) fail(`${at} is { ${SPACE_KEYS.join(', ')} }`);
    for (const k of Object.keys(S)) if (!SPACE_KEYS.includes(k)) fail(`${at}.${k} is not a space setting (${SPACE_KEYS.join(', ')})`);
    if (!WCD_KINDS[S.kind]) fail(`${at}.kind is ${Object.keys(WCD_KINDS).join(' or ')}`);
    if (!(Number.isInteger(S.depth) && S.depth >= 0)) fail(`${at}.depth is a whole number, 0 the outermost`);
    if (S.level !== undefined && (typeof S.level !== 'string' || (levels && !levels.includes(S.level)))) fail(`${at}.level '${S.level}' is not a level of the world${levels ? ` (${levels.join(', ')})` : ''}`);
    if (S.use !== undefined && !PROGRAM_IDS.includes(S.use)) fail(`${at}.use '${S.use}' is not a building use (${PROGRAM_IDS.join(', ')})`);
    if (S.built !== undefined && S.built !== false) fail(`${at}.built is false (a space on the path, not made yet), or left out`);
    if (S.tone !== undefined) try { readTone(S.tone); } catch (e) { fail(`${at}.tone: ${e.message.replace(/^stage: tone:? ?/, '')}`); }
    spaces[id] = { id, kind: S.kind, depth: S.depth, ...(S.level ? { level: S.level } : {}), ...(S.use ? { use: S.use } : {}), look: lookOf(S.look, at), ...(S.tone !== undefined ? { tone: S.tone } : {}), built: S.built !== false };
  }
  if (typeof spec.core !== 'string' || !spaces[spec.core]) fail(`core is one of the spaces (${Object.keys(spaces).join(', ')})`);
  if (spec.doors !== undefined && !Array.isArray(spec.doors)) fail('doors is a list of { from, to, via, gate?, oneWay? }');
  const doors = [];
  for (const [i, D] of (spec.doors ?? []).entries()) {
    const at = `doors[${i}]`;
    if (!isObj(D)) fail(`${at} is { ${DOOR_KEYS.join(', ')} }`);
    for (const k of Object.keys(D)) if (!DOOR_KEYS.includes(k)) fail(`${at}.${k} is not a door setting (${DOOR_KEYS.join(', ')})`);
    for (const k of ['from', 'to']) if (!spaces[D[k]]) fail(`${at}.${k} '${D[k]}' is not a space`);
    if (D.from === D.to) fail(`${at} joins '${D.from}' to itself`);
    if (!WCD_VIAS[D.via]) fail(`${at}.via is ${Object.keys(WCD_VIAS).join(', ')}`);
    if (D.oneWay !== undefined && D.oneWay !== true) fail(`${at}.oneWay is true (it opens only from '${D.from}'), or left out`);
    doors.push({ from: D.from, to: D.to, via: D.via, gate: readGate(D.gate, at), oneWay: D.oneWay === true });
  }
  const read = { core: spec.core, spaces, doors };
  read.path = criticalPath(read);
  read.unbuilt = Object.values(spaces).filter((s) => !s.built).map((s) => s.id);
  read.laws = wcdLaws(read);
  return read;
}

// the ways out of a space: a two-way door both ways, a one-way door from its `from`
const waysFrom = (W, id) => W.doors.flatMap((d) => (d.from === id ? [d.to] : !d.oneWay && d.to === id ? [d.from] : []));

/** The critical path: the shortest way from an outermost space to the core (breadth first, in the recipe's order), or
 *  null when the core cannot be reached. */
function criticalPath(W) {
  const ids = Object.keys(W.spaces), top = Math.min(...ids.map((id) => W.spaces[id].depth));
  const starts = ids.filter((id) => W.spaces[id].depth === top), prev = new Map(starts.map((s) => [s, null])), queue = [...starts];
  while (queue.length) {
    const at = queue.shift();
    if (at === W.core) break;
    for (const n of waysFrom(W, at)) if (!prev.has(n)) { prev.set(n, at); queue.push(n); }
  }
  if (!prev.has(W.core)) return null;
  const path = [];
  for (let at = W.core; at !== null; at = prev.get(at)) path.unshift(at);
  return path;
}

const law = (id, holds, says) => ({ law: id, holds, says });

/** The principles, measured on a read recipe. */
export function wcdLaws(W) {
  const S = W.spaces, out = [], ids = Object.keys(S), core = S[W.core];
  // deeper: the path reaches the core, deepening at every step, and the core is the deepest space
  const deepest = Math.max(...ids.map((id) => S[id].depth));
  if (!W.path) out.push(law('deeper', false, `no way in reaches the core '${W.core}'`));
  else {
    const flat = W.path.slice(1).flatMap((id, i) => (S[id].depth <= S[W.path[i]].depth ? [`${W.path[i]} → ${id} does not go deeper`] : []));
    const shallow = core.depth < deepest ? [`the core is at depth ${core.depth}, '${ids.find((id) => S[id].depth === deepest)}' at ${deepest}`]
      : W.path.length === 1 && ids.length > 1 ? [`the core '${W.core}' is an outermost space: nothing lies before it`] : [];
    const why = [...flat, ...shallow];
    out.push(law('deeper', !why.length, why.length ? why.join('; ') : `${W.path.join(' → ')}: deeper at every door`));
  }
  out.push(law('core-inner', core.kind === 'inner', core.kind === 'inner' ? `the core '${W.core}' is an inner` : `the core '${W.core}' is an outer: a core is a dungeon of its own`));
  // outers bind: each outer joins two or more spaces; an outermost one binds the world outside to what it joins
  const top = Math.min(...ids.map((id) => S[id].depth));
  const joins = (id) => new Set(W.doors.flatMap((d) => (d.from === id ? [d.to] : d.to === id ? [d.from] : []))).size + (S[id].depth === top ? 1 : 0);
  const loose = ids.filter((id) => S[id].kind === 'outer' && joins(id) < 2);
  out.push(law('outers-bind', !loose.length, loose.length ? `${loose.join(', ')} join${loose.length === 1 ? 's' : ''} fewer than two spaces` : 'every outer joins two spaces or more (an outermost one, the world outside and one)'));
  // gated: every space past the outermost is entered by a door, and a door inward names what opens it
  const unentered = ids.filter((id) => S[id].depth > top && !W.doors.some((d) => d.to === id || (!d.oneWay && d.from === id)));
  const ungated = W.doors.filter((d) => S[d.to].depth > S[d.from].depth && !d.gate).map((d) => `${d.from} → ${d.to}`);
  out.push(law('gated', !unentered.length && !ungated.length, [...unentered.map((id) => `nothing enters '${id}'`), ...ungated.map((s) => `${s} names no gate`)].join('; ') || 'every space is entered through a door, and every door inward names its gate'));
  // distinct: two spaces a door joins differ in construction or palette (both must name a look to be read)
  const same = [], unread = [];
  for (const d of W.doors) {
    const a = S[d.from].look, b = S[d.to].look;
    if (!a || !b) { unread.push(`${d.from} → ${d.to}`); continue; }
    if (a.construction === b.construction && a.palette === b.palette) same.push(`${d.from} → ${d.to} (${a.construction}, ${a.palette})`);
  }
  out.push(law('distinct', !same.length, same.length ? `${same.join('; ')}: the same construction and palette` : unread.length && unread.length === W.doors.length ? 'no door joins two spaces that both name a look' : `every door joins two looks that differ${unread.length ? ` (${unread.length} unread: a space names no look)` : ''}`));
  // same-level: a lift or a teleporter joins spaces in one level (read where both name theirs)
  const split = W.doors.filter((d) => (d.via === 'lift' || d.via === 'teleporter') && S[d.from].level && S[d.to].level && S[d.from].level !== S[d.to].level).map((d) => `${d.via} ${d.from} (${S[d.from].level}) → ${d.to} (${S[d.to].level})`);
  out.push(law('same-level', !split.length, split.length ? `${split.join('; ')}: a lift or a teleporter moves within one level` : 'every lift and teleporter moves within one level'));
  return out;
}
