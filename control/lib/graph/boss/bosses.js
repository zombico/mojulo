/**
 * THE BOSSES — a human boss is a GIMMICK: a name and a design read as one idea (a flame trooper, a marksman, a breaker,
 * a lineman), its MOVES (the shelf's patterns, patterns.js, each under the boss's own name and tell, tuned to the idea),
 * the LOOK of its tells, what its ARENA wants, and its PHASES: from full health and at each threshold under it, the moves
 * it reaches for and how often (`moves`, weights), how long it waits between them (`tempo`, seconds), the temper its mind
 * fights in (`temper`, mind.js), and what the crossing does to the arena (`event`). A new boss is a row.
 *
 *   BOSSES                      the shelf
 *   readBoss(b)                 → the boss checked: its moves read against the shelf, its phases falling (throws naming the fault)
 *   moveOf(boss, id)            → the move's pattern, tuned (its tell said in the boss's words)
 *   mindPhases(boss)            → the rows a boss's mind crosses (mind.js phases: { below, aggressiveness?, shift }),
 *                                 its first phase the one it starts in
 *   bossLaws(boss, body?)       → [{ law, holds, says }]   moves-hold (each move's pattern laws) · its-own (three moves
 *                                 or more, each phase two or more) · falling (thresholds fall) · an-opening-each-phase
 *
 * Pure data and readers.
 */
import { PATTERNS, readPattern } from './patterns.js';
import { patternLaws, BODY } from './laws.js';

const no = (msg) => { throw new Error(`boss: ${msg}`); };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const TEMPERS = ['bold', 'opportunist', 'relentless'];
// (how its mind fights between its moves, mind.js `motivation`: a sentry holds where it stands and fires)
const MOTIVATIONS = ['sentry', 'guard'];
const EVENTS = Object.freeze({
  burn: 'the floor by the walls catches and burns: the ground the boss gives up',
  relocate: 'it leaves its perch for another: the cover that faced it no longer does',
  tear: 'it tears a piece of cover out of the floor: what stood is gone',
  live: 'the floor\'s tiles come alive under a pattern of their own between its moves',
  adds: 'it calls its crew in: two guards join it',
});
export const BOSS_EVENTS = EVENTS;
// A COUNTER is how a boss is beaten other than by rounds poured in: a condition and what it does. `part`: a piece of the
// boss's own (a canister, a coil pack) that takes `hits` of what it `takes`, only `from` where it shows (`behind`: from
// behind it) and only `when` it is bare (`vent`: in the opening of a move that turns its back to vent), and what its
// breaking does (`breaks`: a `stagger` of seconds, a `harm` of its health, a move's hazards shortened to a share of their
// reach). A new kind of counter is a row here and its judge in the director (worlds/controllable/boss.js).
// `flash`: a stun that bursts `within` metres of its eyes, `from` in front of it, while it holds a SCOPE (a move that puts
// its eye to a sight: `when: 'scope'`); it is blinded `blind` seconds where it stands, every move called off, and takes
// `mult` times what lands on it till it sees again. A flash is never used up: each lock is another chance.
const COUNTERS = Object.freeze({ part: 'a piece of its own that breaks under what hits it there, while it is bare', flash: 'a stun burst in its sight while its eye is at a scope: blinded' });
const COUNTER_FROM = ['behind', 'front', 'any'], COUNTER_WHEN = ['vent', 'scope', 'open', 'always'], COUNTER_TAKES = ['round', 'explosive', 'stun'];
// (a hand grenade's flight from the throw to its burst, about: what a body needs on top of its reaction to flash a scope)
const THROW = 1;
export const BOSS_COUNTERS = COUNTERS;

export const BOSSES = Object.freeze({
  // A FLAME TROOPER: its name the fire, its suit scorched, a tank on its back; it burns the ground it denies
  cinder: { name: 'Cinder', title: 'the flame trooper', reads: 'a pipeline welder who never put the torch down: a welding mask, leather sleeves, a fuel tank on his back and a lance in his hand',
    look: { tell: '#ff7a2a', hazard: '#ffb347' }, arena: { cover: 'low walls and drums to break the arc', size: 'a hall, room to circle' },
    moves: {
      'arc-of-flame': { pattern: 'sweep', says: 'plants the lance; the arc it will burn glows on the floor', tune: { reach: 11 }, vent: 'turns his back to vent the lance: the canister is bare' },
      'firewalk': { pattern: 'charge', says: 'lowers the nozzle and walks the lane in fire' },
      'flashover': { pattern: 'ring', says: 'opens the tank\'s valve; the air round it shimmers', tune: { harm: 0.22 } },
      'fuel-drums': { pattern: 'rain', says: 'kicks drums of fuel rolling; each lands where it is marked and goes up' },
    },
    phases: [
      { moves: { 'arc-of-flame': 3, 'firewalk': 1 }, tempo: 2.4 },
      { below: 0.66, moves: { 'arc-of-flame': 2, 'flashover': 2, 'firewalk': 1 }, tempo: 1.9, temper: 'opportunist', event: 'burn' },
      { below: 0.33, moves: { 'arc-of-flame': 2, 'flashover': 2, 'fuel-drums': 2, 'firewalk': 1 }, tempo: 1.4, temper: 'relentless', look: 'cracked' },
    ],
    // (the canister on his back: bare only while he vents, and only from behind him; four rounds and it ruptures)
    counters: [{ kind: 'part', id: 'canister', reads: 'the fuel canister on his back', tip: 'rounds into the tank on his back while he vents rupture it', takes: ['round'], hits: 4, from: 'behind', when: 'vent',
      prop: { shape: 'canister', r: 0.15, h: 0.62, colour: '#b8662a', band: '#c9a14a', hose: '#1d1a17' },
      breaks: { says: 'the canister ruptures: he goes up in his own fire', stagger: 3, harm: 0.2, shorten: { 'arc-of-flame': 0.6 } } }],
    // (the looks its phases wear: the mask cracked to show the face in the last)
    looks: { cracked: 'the welding mask cracked open, the face showing through the break' } },
  // A MARKSMAN: its name the glint of its scope; it fights from perches, a lock that follows before it fires
  glint: { name: 'Glint', title: 'the marksman', reads: 'a range officer who learned to love the long shot: a duster coat, a scarf wound high, mirrored shooting glasses, a rifle longer than his arm',
    look: { tell: '#e8f4ff', hazard: '#ff4d4d' }, arena: { cover: 'hard cover tall enough to stand behind', size: 'long, with perches' },
    moves: {
      'the-lock': { pattern: 'lock', says: 'the scope catches the light; the line follows, holds, and fires', scope: 'his eye at the scope through the whole lock' },
      'buckshot': { pattern: 'fan', says: 'swaps to the scattergun as you close; the fan is drawn' },
      'flares': { pattern: 'rain', says: 'fires flares over you; each lands burning where it is marked', tune: { harm: 0.12 } },
    },
    phases: [
      { moves: { 'the-lock': 3, 'buckshot': 1 }, tempo: 2.6 },
      { below: 0.66, moves: { 'the-lock': 2, 'flares': 2, 'buckshot': 1 }, tempo: 2.1, event: 'relocate' },
      { below: 0.33, moves: { 'the-lock': 3, 'flares': 1, 'buckshot': 2 }, tempo: 1.6, temper: 'relentless', event: 'relocate' },
    ],
    // (the glint: his eye at the scope for the whole lock; a stun bursting in front of him then blinds him)
    // (a marksman holds his perch: his mind a sentry's, turned on what it sees and firing, never walking down to it)
    mind: { motivation: 'sentry' },
    counters: [{ kind: 'flash', id: 'glint', reads: 'his eye at the scope', tip: 'a stun grenade in front of him while his scope is up blinds him', takes: ['stun'], hits: 1, from: 'front', when: 'scope', within: 8,
      breaks: { says: 'the flash goes down his scope: blind, off the rifle, standing in the open', blind: 4, mult: 2 } }] },
  // A BREAKER: its name what it does to cover; a giant with a pile driver who brings the floor to it
  breaker: { name: 'Breaker', title: 'the demolisher', reads: 'a giant in demolition armour, a pile driver for a fist',
    look: { tell: '#ffd23f', hazard: '#c8a26a' }, arena: { cover: 'pillars it can tear out', size: 'a yard' },
    moves: {
      'pile-driver': { pattern: 'ring', says: 'raises the driver over its head; the floor round it cracks' },
      'bulldozer': { pattern: 'charge', says: 'paws the floor; the lane it will run lights', tune: { harm: 0.3 } },
      'rubble': { pattern: 'rain', says: 'heaves a slab apart; the pieces land where they are marked' },
    },
    phases: [
      { moves: { 'bulldozer': 2, 'pile-driver': 2 }, tempo: 2.4 },
      { below: 0.66, moves: { 'bulldozer': 2, 'pile-driver': 2, 'rubble': 1 }, tempo: 2, temper: 'opportunist', event: 'tear' },
      { below: 0.33, moves: { 'bulldozer': 3, 'pile-driver': 2, 'rubble': 2 }, tempo: 1.5, temper: 'relentless', event: 'tear' },
    ] },
  // A LINEMAN: its name the high-voltage line; cables on its back, the floor's tiles its weapon
  lineman: { name: 'Lineman', title: 'the high-voltage man', reads: 'a lineman in rubber and copper, cables coiled on its back',
    look: { tell: '#7fd4ff', hazard: '#bfe9ff' }, arena: { cover: 'insulated crates', size: 'a tiled floor (a deck\'s plate, a hall\'s)' },
    moves: {
      'live-floor': { pattern: 'grid', says: 'grounds its cable; the tiles it charges hum and light' },
      'arc-line': { pattern: 'lock', says: 'raises the rod; the arc reaches for you and snaps', tune: { harm: 0.25 } },
      'discharge': { pattern: 'ring', says: 'its coils whine; the floor round it crackles' },
      'cable-whip': { pattern: 'scythe', says: 'swings the live cable back at chest height' },
    },
    phases: [
      { moves: { 'live-floor': 2, 'cable-whip': 2 }, tempo: 2.4 },
      { below: 0.66, moves: { 'live-floor': 2, 'arc-line': 2, 'cable-whip': 1 }, tempo: 2, event: 'live' },
      { below: 0.33, moves: { 'live-floor': 2, 'arc-line': 2, 'discharge': 2, 'cable-whip': 1 }, tempo: 1.5, temper: 'relentless', event: 'adds' },
    ] },
});
export const BOSS_IDS = Object.keys(BOSSES);

const TUNES = ['reach', 'harm', 'at'];
/** The move's pattern, tuned: `reach` the distance it is thrown at, `harm` each hazard's, `at` its landing put back or on. */
export function moveOf(boss, id) {
  const m = boss.moves[id];
  if (!m) no(`${boss.name}: no move '${id}' (${Object.keys(boss.moves).join(', ')})`);
  const P = readPattern(m.pattern), T = m.tune || {};
  return { ...P, id, says: m.says, ...(m.vent ? { vent: m.vent } : {}), ...(m.scope ? { scope: m.scope } : {}), ...(T.reach ? { reach: T.reach } : {}), tell: { ...P.tell, says: m.says },
    hazards: P.hazards.map((h) => ({ ...h, ...(T.harm ? { harm: T.harm } : {}), ...(T.at ? { at: h.at + T.at } : {}) })),
    open: { ...P.open, ...(T.at ? { at: P.open.at + T.at } : {}) },
    // (a flight's path waits with its hazards: its take-off kept, every later key `at` later)
    ...(P.flies ? { flies: P.flies.map((q, i) => (i && T.at ? [q[0] + T.at, q[1], q[2]] : [...q])) } : {}) };
}

/** Read a boss (a row of BOSSES, or one of the same shape); → the boss (throws naming the fault). */
export function readBoss(b, where = 'boss') {
  if (typeof b === 'string') { if (!BOSSES[b]) no(`${where}: '${b}' is one of ${BOSS_IDS.join(', ')}`); b = BOSSES[b]; }
  if (!b || typeof b !== 'object' || typeof b.name !== 'string') no(`${where}: { name, title, reads, moves, phases }`);
  if (!b.moves || !Object.keys(b.moves).length) no(`${where}: its moves, { <name>: { pattern, says, tune? } }`);
  for (const [id, m] of Object.entries(b.moves)) {
    if (!PATTERNS[m.pattern]) no(`${where}.moves.${id}: pattern is one of ${Object.keys(PATTERNS).join(', ')}`);
    for (const k of Object.keys(m.tune || {})) if (!TUNES.includes(k)) no(`${where}.moves.${id}.tune: ${k} is not one of ${TUNES.join(', ')}`);
    if (m.vent !== undefined && typeof m.vent !== 'string') no(`${where}.moves.${id}.vent: what it does as it turns away to vent, in words`);
    if (m.scope !== undefined && typeof m.scope !== 'string') no(`${where}.moves.${id}.scope: its eye at a sight through the move, in words`);
  }
  (b.counters || []).forEach((c, k) => {
    const at = `${where}.counters[${k}]`;
    if (!COUNTERS[c.kind]) no(`${at}.kind is one of ${Object.keys(COUNTERS).join(', ')}`);
    if (typeof c.id !== 'string') no(`${at}.id: its name`);
    if (!Array.isArray(c.takes) || !c.takes.length || c.takes.some((x) => !COUNTER_TAKES.includes(x))) no(`${at}.takes: a list of ${COUNTER_TAKES.join(', ')}`);
    if (!isNum(c.hits) || c.hits < 1) no(`${at}.hits: how many break it`);
    if (!COUNTER_FROM.includes(c.from)) no(`${at}.from is one of ${COUNTER_FROM.join(', ')}`);
    if (!COUNTER_WHEN.includes(c.when)) no(`${at}.when is one of ${COUNTER_WHEN.join(', ')}`);
    if (c.when === 'vent' && !Object.values(b.moves).some((m) => m.vent)) no(`${at}.when 'vent': a move of its must vent`);
    if (c.when === 'scope' && !Object.values(b.moves).some((m) => m.scope)) no(`${at}.when 'scope': a move of its must put its eye to a scope`);
    if (c.kind === 'flash' && !c.takes.includes('stun')) no(`${at}: a flash is taken by a stun`);
    if (c.tip !== undefined && typeof c.tip !== 'string') no(`${at}.tip: what a body does to it, in a line`);
    const B = c.breaks || {};
    for (const m of Object.keys(B.shorten || {})) { if (!b.moves[m]) no(`${at}.breaks.shorten: '${m}' is not one of its moves`); if (!isNum(B.shorten[m]) || B.shorten[m] <= 0 || B.shorten[m] > 1) no(`${at}.breaks.shorten.${m} is a share of its reach, over 0 and 1 or under`); }
    if (B.harm !== undefined && (!isNum(B.harm) || B.harm < 0 || B.harm >= 1)) no(`${at}.breaks.harm is a share of its health`);
    if (c.kind === 'flash' && (!isNum(B.blind) || B.blind <= 0)) no(`${at}.breaks.blind: the seconds it is blinded`);
  });
  if (!Array.isArray(b.phases) || !b.phases.length) no(`${where}: its phases, the first from full health`);
  if (b.mind !== undefined && !(b.mind && MOTIVATIONS.includes(b.mind.motivation))) no(`${where}.mind.motivation is one of ${MOTIVATIONS.join(', ')}`);
  b.phases.forEach((ph, k) => {
    if (k === 0 && ph.below !== undefined) no(`${where}.phases[0] is from full health: no below`);
    if (k > 0 && (!isNum(ph.below) || ph.below <= 0 || ph.below >= 1)) no(`${where}.phases[${k}].below is a share of its health, between 0 and 1`);
    for (const [id, w] of Object.entries(ph.moves || {})) { if (!b.moves[id]) no(`${where}.phases[${k}].moves: '${id}' is not one of its moves`); if (!isNum(w) || w <= 0) no(`${where}.phases[${k}].moves.${id} is a weight over 0`); }
    if (!isNum(ph.tempo) || ph.tempo <= 0) no(`${where}.phases[${k}].tempo is the seconds between its moves`);
    if (ph.temper !== undefined && !TEMPERS.includes(ph.temper)) no(`${where}.phases[${k}].temper is one of ${TEMPERS.join(', ')}`);
    if (ph.event !== undefined && !EVENTS[ph.event]) no(`${where}.phases[${k}].event is one of ${Object.keys(EVENTS).join(', ')}`);
    if (ph.look !== undefined && !(b.looks && b.looks[ph.look])) no(`${where}.phases[${k}].look is one of its looks (${Object.keys(b.looks || {}).join(', ') || 'none'})`);
  });
  return b;
}

/** the rows a boss's mind crosses (mind.js `phases`): each phase after the first, its threshold and temper, a shift beat */
/** its mind's own words over a boss's (mind.js): its motivation, where its row asks for one */
export const mindOf = (boss) => ({ ...(readBoss(boss).mind || {}) });
export function mindPhases(boss) {
  return readBoss(boss).phases.slice(1).map((ph) => ({ below: ph.below, ...(ph.temper ? { aggressiveness: ph.temper } : {}), shift: 1.2 }));
}

/** A boss's laws (see the header). */
export function bossLaws(boss, body = BODY) {
  const b = readBoss(boss), out = [];
  const bad = [];
  for (const id of Object.keys(b.moves)) { const L = patternLaws(moveOf(b, id), body); for (const l of L) if (!l.holds) bad.push(`${id}: ${l.law}`); }
  out.push({ law: 'moves-hold', holds: !bad.length, says: bad.length ? `moves that break a pattern's law: ${bad.join('; ')}` : 'every move told, escapable, survivable and opened after' });
  const few = b.phases.map((ph, k) => [k, Object.keys(ph.moves || {}).length]).filter(([, n]) => n < 2);
  out.push({ law: 'its-own', holds: Object.keys(b.moves).length >= 3 && !few.length, says: Object.keys(b.moves).length < 3 ? `${Object.keys(b.moves).length} moves: a gimmick shows itself in three or more` : few.length ? `phases with one move: ${few.map(([k]) => k).join(', ')}` : `${Object.keys(b.moves).length} moves of its own, two or more a phase` });
  const th = b.phases.slice(1).map((p) => p.below), falls = th.every((v, k) => k === 0 || v < th[k - 1]);
  out.push({ law: 'falling', holds: falls, says: falls ? `phases at ${th.map((v) => Math.round(v * 100) + '%').join(', ')} of its health` : 'its thresholds do not fall' });
  const harder = b.phases.every((p, k) => k === 0 || p.tempo <= b.phases[k - 1].tempo);
  out.push({ law: 'rising', holds: harder, says: harder ? 'each phase as quick or quicker than the one before' : 'a later phase waits longer between moves than an earlier one' });
  // (a counter REACHABLE: the move that bares it in every phase, and its window long enough: a vent's opening to react
  // and land its hits, a round each quarter second; a scope's lock, from its start to its shot, to react and throw)
  for (const c of b.counters || []) {
    const bares = Object.keys(b.moves).filter((id) => (c.when === 'vent' ? b.moves[id].vent : c.when === 'scope' ? b.moves[id].scope : true));
    const missing = b.phases.map((ph, k) => [k, bares.some((id) => (ph.moves || {})[id] > 0)]).filter(([, ok]) => !ok).map(([k]) => k);
    const windowOf = (id) => { const M = moveOf(b, id); return c.when === 'scope' ? Math.min(...M.hazards.map((h) => h.at)) : M.open.for; };
    const need = Math.round((body.reaction + (c.when === 'scope' ? THROW : c.hits * 0.25)) * 100) / 100, short = bares.filter((id) => windowOf(id) < need);
    const holds = !missing.length && !short.length;
    out.push({ law: `counter-${c.id}`, holds, says: holds ? `${c.reads}: bared by ${bares.join(', ')} in every phase, a window of ${Math.min(...bares.map(windowOf))} s or more for the ${need} s it needs`
      : missing.length ? `${c.reads}: no move bares it in phases ${missing.join(', ')}` : `${c.reads}: the window of ${short.join(', ')} is under the ${need} s it needs` });
  }
  return out;
}
