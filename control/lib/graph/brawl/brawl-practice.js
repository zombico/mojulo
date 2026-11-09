/**
 * brawl practice — the brawler's practice room: a yard to learn a brawler in, the street's own blocks (the belt, the
 * core, the moves, the crowd's mind, the things) under a practice mind. Not the fighting game's training: a brawler is
 * learned by SPACE and CROWDS (lining up across the street, the chain and what drops it, the clinch, the desperation's
 * price, reading who swings next), so the room says those, not frames.
 *
 *   practiceOf({ belt, players, dummies, things?, health? }) → a room: { ctx, s, mind, yard }
 *     players  [{ recipe, style? }], one to four (a seat each)
 *     dummies  [{ type? (a CROWD_TYPES id, 'thug' by default) | recipe?, mode, at?, n? }]: at m along the belt and n m
 *              across it (spread along the room by default); a dummy's MODE (PRACTICE_MODES):
 *                stand   stands where it is put
 *                walk    walks back and forth across the street where it stands (lining up on a moving body)
 *                swing   steps onto the player's line and throws its blow on a slow beat (reading a blow)
 *                crowd   the street's own crowd mind, its tokens and its ring (being surrounded)
 *                grab    walks into the player to take hold, knees and throws (getting out of a hold)
 *     things   the street's (brawl-things.js), in the belt's metres: put back as they were on a reset
 *     health   'chains' (a dummy's health a few of the player's chains: it falls, and is back on its spot BACK frames
 *              later) or 'refill' (its health back whenever it is free: it never falls)
 *   A player never dies in the yard: knocked out, it is back on its feet where it lies, its health whole.
 *   stepYard(room, buttons) → the room a frame on: each seat's buttons ({ x, z, a, j, s }) read by the brawler's reader
 *              (brawl-moves.js), the dummies' pads by their modes, the core's step, the room's rules, and each press's
 *              VERDICT kept (`yard.log`): taken (how many frames late) or dropped, and why
 *   resetYard(room) → everyone on their spots, whole, the things put back, the logs cleared
 *   yardRead(room, player?) → what the room shows a player: the line to each dummy, the chain (its steps landed, how it
 *              ended and why), the press log, the clinch, the last combo, the tokens, a state held, a weapon held
 *   brawlMoveList(F) → a brawler's moves as its player reads them, by kind (the command-list idiom's `kinds`)
 *
 * Pure: no clock, no dice (the yard's frame is the core's).
 */
import { newBrawl, stepBrawl, BRAWL_RULES } from './brawl-core.js';
import { brawlFighter, newReader, readButtons, BRAWL_STYLES } from './brawl-moves.js';
import { crowdPads, newCrowdMind, crowdFighter, CROWD_TYPES } from './brawl-crowd.js';
import { readThings, THINGS } from './brawl-things.js';
import { viewHalf } from './brawl-belt.js';

export const PRACTICE_MODES = Object.freeze({
  stand: 'stands where it is put',
  walk: 'walks back and forth across the street where it stands: line up on a moving body',
  swing: 'steps onto your line and throws its blow on a slow beat: read it, step off the line, answer',
  crowd: 'the street\'s own crowd: a few close in at once and the rest circle; learn to read who swings next',
  grab: 'walks into you to take hold, knees and throws: get out with the desperation',
});
export const PRACTICE_MODE_IDS = Object.freeze(Object.keys(PRACTICE_MODES));
export const HEALTH_MODES = Object.freeze(['chains', 'refill']);
/** frames a felled dummy lies before it is back on its spot; a dummy's health in the player's chains; the swing's beat */
export const BACK = 180;
export const CHAINS = 2.5;
export const BEAT = 90;
const LOG = 8;
const FREE = new Set(['stand', 'walk', 'land']);
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** a brawler style's chain damage: its blows down to the knockdown, summed (what a dummy's health is measured in) */
const chainDamage = (F) => Array.from({ length: F.brawl.chain }, (_, k) => F.moves[`chain.${k + 1}`].damage * (F.moves[`chain.${k + 1}`].hits || 1)).reduce((a, b) => a + b, 0);

/** A practice room. */
export function practiceOf({ belt, players, dummies = [], things, health = 'chains' } = {}) {
  if (!belt) throw new Error('brawl: a practice room needs its belt');
  if (!Array.isArray(players) || !players.length || players.length > 4) throw new Error('brawl: a practice room has 1 to 4 players');
  if (!HEALTH_MODES.includes(health)) throw new Error(`brawl: a practice room's health is ${HEALTH_MODES.join(' | ')}`);
  if (!Array.isArray(dummies) || dummies.length > 8) throw new Error('brawl: a practice room has up to 8 dummies');
  const fighters = players.map((p) => brawlFighter(p.recipe, { style: p.style }));
  const L = belt.length, [n0, n1] = belt.depth;
  const half = viewHalf(belt);
  // the dummies' fighters (a crowd type's, or a recipe's), their spots, their modes
  const kinds = {}, spec = dummies.map((d, i) => {
    if (!PRACTICE_MODES[d.mode ?? 'stand']) throw new Error(`brawl: dummies[${i}].mode is one of ${PRACTICE_MODE_IDS.join(', ')}`);
    if (d.type !== undefined && !CROWD_TYPES[d.type]) throw new Error(`brawl: dummies[${i}].type is one of ${Object.keys(CROWD_TYPES).join(', ')}`);
    const key = d.recipe ? `recipe:${i}` : `type:${d.type ?? 'thug'}`;
    if (kinds[key] === undefined) { kinds[key] = fighters.length; fighters.push(d.recipe ? brawlFighter(d.recipe) : crowdFighter(d.type ?? 'thug')); }
    const at = d.at ?? Math.min(L - 1, half + 2 + i * 1.6), n = d.n ?? ((i % 3) - 1) * 1.2;
    if (!(at >= 0 && at <= L && n >= n0 && n <= n1)) throw new Error(`brawl: dummies[${i}] stands on the belt, in its band`);
    return { fighter: kinds[key], mode: d.mode ?? 'stand', type: d.recipe ? 'thug' : d.type ?? 'thug', home: [Math.round(at * 1000), Math.round(n * 1000)] };
  });
  // each player's armed self for every weapon on the floor (a box's too), as the street compiles them
  const T = things ? readThings(things, belt) : [];
  const weapons = [...new Set(T.flatMap((t) => [t, t.holds].filter(Boolean)).filter((t) => t.kind === 'weapon').map((t) => t.what))];
  const armed = {};
  players.forEach((pl, i) => { for (const w of weapons) { armed[`${i}:${w}`] = fighters.length; fighters.push(brawlFighter({ ...pl.recipe, weapon: w }, { style: pl.style })); } });
  const ctx = { fighters, belt, ...(weapons.length ? { armed } : {}) };
  const homes = players.map((_, i) => [Math.round((half - 2 + i * 0.7) * 1000), Math.round(n0 * 1000 + ((i + 1) * (n1 - n0) * 1000) / (players.length + 1))]);
  const bodies = [
    ...players.map((_, i) => ({ fighter: i, side: 'player', x: homes[i][0], z: homes[i][1] })),
    ...spec.map((d) => ({ fighter: d.fighter, side: 'crowd', x: d.home[0], z: d.home[1], face: -1, ...(d.mode === 'grab' ? {} : { grabs: false }) })),
  ];
  const s = newBrawl(ctx, { bodies, ...(T.length ? { things: T } : {}) });
  // (a dummy's health: a few of the first player's chains, or its own refilled)
  const hpOf = Math.max(1, Math.round(chainDamage(fighters[0]) * CHAINS));
  if (health === 'chains') for (const d of s.bodies.slice(players.length)) d.hp = hpOf;
  const P = players.length;
  const yard = {
    players: P, health, hp: s.bodies.map((b) => b.hp), homes: [...homes, ...spec.map((d) => d.home)],
    modes: spec.map((d) => d.mode), things: T.map((t) => ({ ...t })),
    readers: players.map(() => newReader()), prev: players.map(() => ({})), pending: players.map(() => []),
    log: players.map(() => []), chain: players.map(() => ({ steps: [], last: null })), combo: players.map(() => ({ hits: 0, damage: 0, last: null })),
    ko: {}, free: {},
  };
  const mind = newCrowdMind(Object.fromEntries(spec.map((d, j) => [P + j, d.type])));
  return { ctx, s, mind, yard };
}

/** Everyone on their spots and whole, the things put back, the logs cleared. */
export function resetYard(room) {
  const { yard, ctx } = room;
  const fresh = newBrawl(ctx, { bodies: room.s.bodies.map((b, i) => ({ fighter: i < yard.players ? i : b.fb ?? b.fi, side: b.side, x: yard.homes[i][0], z: yard.homes[i][1], face: i < yard.players ? 1 : -1, ...(b.ng ? { grabs: false } : {}) })), ...(yard.things.length ? { things: yard.things.map((t) => ({ ...t })) } : {}) });
  fresh.bodies.forEach((b, i) => { b.hp = yard.hp[i]; });
  fresh.f = room.s.f;
  return { ...room, s: fresh, mind: newCrowdMind(room.mind.type), yard: { ...yard, readers: yard.readers.map(() => newReader()), prev: yard.prev.map(() => ({})), pending: yard.pending.map(() => []), log: yard.log.map(() => []), chain: yard.chain.map(() => ({ steps: [], last: null })), combo: yard.combo.map(() => ({ hits: 0, damage: 0, last: null })), ko: {}, free: {} } };
}

// ── the dummies' practice mind ───────────────────────────────────────────────────────────────────────────────

function dummyPads(room, M) {
  const { s, ctx, yard } = room, P = yard.players, pads = [];
  const crowd = s.bodies.filter((b, i) => i >= P && yard.modes[i - P] === 'crowd');
  // (the crowd mode's dummies think as the street's crowd; the others by their own mode)
  if (crowd.length) {
    const all = crowdPads(s, ctx, { ...M, type: Object.fromEntries(crowd.map((b) => [b.id, M.type[b.id]])) });
    for (const b of crowd) pads[b.id] = all[b.id] ?? {};
  }
  const line = Math.round(s.rules.line / 3), [n0, n1] = ctx.belt.depth.map((v) => Math.round(v * 1000));
  for (let i = P; i < s.bodies.length; i++) {
    const d = s.bodies[i], mode = yard.modes[i - P], home = yard.homes[i];
    if (mode === 'crowd' || d.gone || d.ko) continue;
    const T = d.tg >= 0 ? s.bodies[d.tg] : null;
    if (mode === 'stand') { pads[i] = Math.abs(d.x - home[0]) > 300 && FREE.has(d.st) ? { x: sgn(home[0] - d.x) } : {}; continue; }
    if (mode === 'walk') {
      // across the street and back where it stands: the far edge, then the near
      const dir = (yard.free[i] ??= 1);
      if ((dir > 0 && d.z >= n1 - 150) || (dir < 0 && d.z <= n0 + 150)) yard.free[i] = -dir;
      pads[i] = { z: yard.free[i], x: Math.abs(d.x - home[0]) > 300 ? sgn(home[0] - d.x) : 0 };
      continue;
    }
    if (!T) { pads[i] = {}; continue; }
    if (mode === 'grab') {
      if (d.st === 'hold') { pads[i] = s.f % 16 === 8 ? { hold: (d.kn ?? 0) >= 2 ? 'forward' : 'knee' } : {}; continue; }
      pads[i] = Math.abs(d.z - T.z) > line ? { z: sgn(T.z - d.z) } : { x: sgn(T.x - d.x) };
      continue;
    }
    // swing: onto the player's line, in to its blow's reach, and the blow on the beat
    const F = ctx.fighters[d.fi], m = F.moves['chain.1'], reach = m.reach - 150, dx = Math.abs(T.x - d.x);
    if (Math.abs(d.z - T.z) > line) { pads[i] = { z: sgn(T.z - d.z) }; continue; }
    if (dx > reach) { pads[i] = { x: sgn(T.x - d.x) }; continue; }
    pads[i] = FREE.has(d.st) && FREE.has(T.st) && s.f % BEAT === 0 && d.face === sgn(T.x - d.x) ? { mv: 'chain.1' } : {};
  }
  return pads;
}

// ── a press's verdict ────────────────────────────────────────────────────────────────────────────────────────

/** why a press asked for `want` was not taken, from the body as the press ran out */
function whyNot(p, F, want, rules) {
  if (F.moves[want]?.cool && p.cd > 0) return `on cooldown: the strong back in ${p.cd} frames`;
  if (p.st === 'hold') return 'holding a body: attack knees it or throws it';
  if (p.st === 'hit' || p.st === 'fall' || p.st === 'down' || p.st === 'rise' || p.st === 'held' || p.st === 'thrown') return 'reeling: a body being hit acts on nothing';
  if (p.st === 'air' || p.st === 'prejump') return p.mv || p.airMove ? 'in the air, its air attack spent' : 'in the air';
  if (p.hs > 0) return 'held in the blow\'s hitstop';
  if (p.mv) {
    const m = F.moves[p.mv];
    if (!p.conn && (want.startsWith('chain.') || want === 'strong.break' || want === 'strong.out')) return 'the blow before missed: a chain goes on only from a hit';
    if (p.mf > m.startup + m.active - 1 + rules.cancelLate) return 'too late: the blow\'s window had closed';
    return 'not from this blow';
  }
  if (p.st === 'land' || p.st === 'pick') return 'landing: a moment\'s recovery';
  return 'busy';
}
const PRESS_WORDS = { a: 'attack', h: 'strong', j: 'jump', s: 'special' };

function verdicts(room, i, buttons, before, after) {
  const { yard, s } = room, p = s.bodies[i], F = room.ctx.fighters[p.fi], prev = yard.prev[i], log = yard.log[i];
  const say = (e) => { log.push({ f: s.f, ...e }); if (log.length > LOG) log.shift(); };
  // a new press: what the reader made of it
  const pressed = Object.keys(PRESS_WORDS).filter((k) => buttons[k] && !prev[k]);
  if (pressed.length) {
    const words = pressed.map((k) => PRESS_WORDS[k]).join(' + ');
    if (before.st === 'hold' && buttons.a) yard.pending[i].push({ f: s.f, words, want: 'hold', kn: before.kn ?? 0 });
    else if (after.want && after.want !== (yard.pending[i].at(-1)?.want)) yard.pending[i].push({ f: s.f, words, want: after.want });
    else if (pressed.includes('a') && p.st === 'pick') say({ words, verdict: 'taken', what: 'picked up', late: 0 });
    else if (pressed.includes('j') && !after.want) yard.pending[i].push({ f: s.f, words, want: 'jump' });
    else if (!after.want && !after.tk) say({ words, verdict: 'dropped', why: whyNot(p, F, pressed.includes('h') ? 'strong' : 'chain.1', s.rules) });
  }
  // the presses waiting: taken once the body starts what they asked, dropped once the reader lets them go
  yard.pending[i] = yard.pending[i].filter((q) => {
    const late = s.f - q.f;
    if (q.want === 'hold') {
      if ((p.kn ?? 0) !== q.kn || p.st !== 'hold') { say({ words: q.words, verdict: 'taken', what: p.st === 'hold' ? 'knee' : 'throw', late }); return false; }
      if (late > 6) { say({ words: q.words, verdict: 'dropped', why: 'the knee before still landing' }); return false; }
      return true;
    }
    if (q.want === 'jump') {
      if (p.st === 'prejump' || p.st === 'air') { say({ words: q.words, verdict: 'taken', what: 'jump', late }); return false; }
      if (late > 4) { say({ words: q.words, verdict: 'dropped', why: whyNot(p, F, 'jump', s.rules) }); return false; }
      return true;
    }
    if (p.mv === q.want) { say({ words: q.words, verdict: 'taken', what: q.want, late, ...(q.note ? { note: q.note } : {}) }); return false; }
    // (a chain's next blow, its last missed: the reader made it a fresh chain once the body was free)
    if (after.want === 'chain.1' && q.want.startsWith('chain.') && q.want !== 'chain.1') { q.note = 'the blow before missed: a new chain'; q.want = 'chain.1'; return true; }
    // (the breaker or the blowout, its blow before missed: the reader made it the opener once the body was free)
    if (after.want === 'strong' && (q.want === 'strong.break' || q.want === 'strong.out')) { q.note = 'the blow before missed: the opener'; q.want = 'strong'; return true; }
    if (after.want !== q.want) { say({ words: q.words, verdict: 'dropped', want: q.want, why: q.why ?? whyNot(p, F, q.want, s.rules) }); return false; }
    // (why it waits, while it waits: what the body is doing that it cannot be taken)
    if (!FREE.has(p.st) || (F.moves[q.want]?.cool && p.cd > 0)) q.why = whyNot(p, F, q.want, s.rules);
    return true;
  });
  yard.prev[i] = { ...buttons };
}

// ── the yard a frame on ──────────────────────────────────────────────────────────────────────────────────────

export function stepYard(room, buttons = []) {
  const yard = { ...room.yard, readers: room.yard.readers.slice(), prev: room.yard.prev.slice(), pending: room.yard.pending.map((q) => q.map((e) => ({ ...e }))), log: room.yard.log.map((l) => l.slice()), chain: room.yard.chain.map((c) => ({ ...c, steps: c.steps.slice() })), combo: room.yard.combo.map((c) => ({ ...c })), ko: { ...room.yard.ko }, free: { ...room.yard.free } };
  const mind = { ...room.mind, tok: Object.fromEntries(Object.entries(room.mind.tok).map(([k, v]) => [k, v.slice()])), b: Object.fromEntries(Object.entries(room.mind.b).map(([k, v]) => [k, { ...v }])) };
  const r0 = { ...room, yard, mind };
  const pads = dummyPads(r0, mind);
  const before = room.s.bodies.map((b) => ({ st: b.st, kn: b.kn, mv: b.mv }));
  const readerAfter = [];
  for (let i = 0; i < yard.players; i++) {
    const p = room.s.bodies[i];
    const [pad, r] = readButtons(yard.readers[i], buttons[i] ?? {}, p, room.ctx.fighters[p.fi]);
    yard.readers[i] = r; readerAfter[i] = r; pads[i] = pad;
  }
  const s = stepBrawl(room.s, pads, room.ctx);
  const out = { ...r0, s };
  for (let i = 0; i < yard.players; i++) verdicts(out, i, buttons[i] ?? {}, before[i], readerAfter[i]);
  rules(out);
  return out;
}

// the room's own rules after each frame: no player dies, a felled dummy comes back, refilled health, the chain and the
// combo kept for the readouts
function rules(room) {
  const { s, yard, ctx } = room, P = yard.players;
  for (const e of s.events) {
    if (e.t === 'hit' && e.p < P) {
      const c = yard.combo[e.p];
      if (!c.open) { c.hits = 0; c.damage = 0; c.open = 1; }
      c.hits++; c.damage += e.dmg;
      const mv = s.bodies[e.p].mv;
      if (mv && mv.startsWith('chain.')) { const k = parseInt(mv.slice(6), 10); if (!yard.chain[e.p].steps.includes(k)) yard.chain[e.p].steps.push(k); }
      // (the strong in the chain: the opener stands for its first blow; the breaker and the blowout end it)
      if (mv === 'strong' && !yard.chain[e.p].steps.includes(1)) { yard.chain[e.p].steps.push(1); yard.chain[e.p].open = 'strong'; }
      if (mv === 'strong.break' || mv === 'strong.out') yard.chain[e.p].ender = mv;
    }
  }
  for (let i = 0; i < P; i++) {
    const p = s.bodies[i], ch = yard.chain[i];
    // a chain ends when the body leaves it: the finisher landed, or dropped (the press log says why)
    if (ch.steps.length && !(p.mv && (p.mv.startsWith('chain.') || p.mv.startsWith('strong')))) {
      const n = ctx.fighters[p.fi].brawl.chain, done = ch.steps.includes(n) || ch.steps.some((k) => k > n);
      const lastWhy = yard.log[i].slice().reverse().find((e) => e.verdict === 'dropped');
      // (how it ended: the finisher, the breaker, the blowout, or dropped and why; opened by the strong, said so)
      const end = ch.ender === 'strong.break' ? 'breaker' : ch.ender === 'strong.out' ? 'blowout' : done ? 'finisher' : 'dropped';
      ch.last = { steps: ch.steps.slice(), of: n, end, ...(ch.open ? { open: ch.open } : {}), ...(end === 'dropped' ? { why: lastWhy?.why ?? 'no press after the last hit' } : {}) };
      ch.steps = []; delete ch.ender; delete ch.open;
    }
    // a combo over: once no dummy reels from it
    const c = yard.combo[i];
    if (c.open && !s.bodies.some((d, j) => j >= P && !d.gone && (d.st === 'hit' || d.st === 'fall') && d.combo > 0)) { c.last = { hits: c.hits, damage: c.damage }; c.open = 0; }
    // never dies: knocked out, back on its feet where it lies, whole
    if (p.ko && p.st === 'ko') { p.ko = 0; p.hp = ctx.fighters[p.fi].hp; p.st = 'rise'; p.sf = 0; }
  }
  for (let i = P; i < s.bodies.length; i++) {
    const d = s.bodies[i];
    if (d.ko && yard.ko[i] === undefined) yard.ko[i] = s.f;
    if (yard.ko[i] !== undefined && s.f - yard.ko[i] >= BACK) {
      // back on its spot, whole, a moment untouchable
      Object.assign(d, { ko: 0, gone: 0, hp: yard.hp[i], st: 'stand', sf: 0, mv: null, x: yard.homes[i][0], z: yard.homes[i][1], y: 0, vx: 0, vy: 0, vz: 0, combo: 0, jug: 0, inv: 30 });
      delete yard.ko[i];
      s.events.push({ t: 'back', p: i });
    }
    if (yard.health === 'refill' && FREE.has(d.st) && d.hp < yard.hp[i]) d.hp = yard.hp[i];
  }
}

// ── what the room shows ──────────────────────────────────────────────────────────────────────────────────────

/** What the room shows a player (index `i`): mm and frames, the HUD's to word. */
export function yardRead(room, i = 0) {
  const { s, yard, ctx, mind } = room, p = s.bodies[i], F = ctx.fighters[p.fi], P = yard.players;
  const reach = F.moves['chain.1'].reach;
  const line = s.bodies.slice(P).filter((d) => !d.gone).map((d) => {
    const dz = d.z - p.z, dx = d.x - p.x;
    return { id: d.id, at: [d.x, d.z], dz, dx, lined: Math.abs(dz) <= s.rules.line, inReach: Math.abs(dx) <= reach + F.idle.stand.push[2], ko: !!d.ko, hp: d.hp, hpMax: yard.hp[d.id], mode: yard.modes[d.id - P], token: (mind.tok[i] ?? []).includes(d.id) };
  });
  const ch = yard.chain[i];
  return {
    line,
    chain: { of: F.brawl.chain, now: ch.steps.slice(), last: ch.last },
    log: yard.log[i].slice(),
    clinch: p.st === 'hold' ? { knees: s.rules.knees - (p.kn ?? 0), left: Math.max(0, s.rules.hold - p.sf), of: s.rules.hold, back: !!p.back } : null,
    combo: { ...(yard.combo[i].open ? { hits: yard.combo[i].hits, damage: yard.combo[i].damage } : { hits: 0, damage: 0 }), last: yard.combo[i].last },
    tokens: (mind.tok[i] ?? []).slice(),
    state: p.ist ? { id: p.ist[0], left: p.ist[1] } : null,
    weapon: p.wpn ?? null,
    hp: p.hp, hpMax: F.hp,
  };
}

// ── the move list ────────────────────────────────────────────────────────────────────────────────────────────

const words = (slot) => slot.split('.').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
// a blow by its own name (its family's: jab, straight, roundhouse), else its slot's
const blowWords = (m, slot) => (m && typeof m.id === 'string' ? m.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : words(slot));
const dataOf = (m) => [
  { what: 'startup', value: String(m.startup) }, { what: 'active', value: String(m.active) }, { what: 'recovery', value: String(m.recovery ?? '—') },
  { what: 'damage', value: String((m.damage ?? 0) * (m.hits || 1)) },
];
/** A brawler's moves as its player reads them, by kind: the chain (its style's), in the air, the clinch, the desperation,
 * the special, the street's things; the strong blows and their cooldown. */
export function brawlMoveList(F) {
  const S = BRAWL_STYLES[F.brawl.style], n = F.brawl.chain;
  const chain = Array.from({ length: n }, (_, k) => {
    const m = F.moves[`chain.${k + 1}`];
    return { name: `${k + 1}. ${blowWords(m, S.chain[k])}`, input: 'A', about: k === n - 1 ? 'the last of the chain: it knocks down' : k ? 'on a hit, the next' : 'the first blow; a whiff ends the chain', data: dataOf(m) };
  });
  if (F.moves[`chain.${n}f`]) chain.push({ name: `${n}. ${blowWords(F.moves[`chain.${n}f`], S.finisher)} (finisher)`, input: '→ + A', about: 'toward the foe on the last press: the other finisher', data: dataOf(F.moves[`chain.${n}f`]) });
  const D = F.moves.desperate;
  const special = ['neutral', 'forward', 'back', 'down'].filter((d) => F.moves[`special.${d}.M`]).map((d) => ({ name: `${words(F.moves[`special.${d}.M`].id ?? d)}`, input: d === 'neutral' ? 'S' : d === 'forward' ? '→ + S' : d === 'back' ? '← + S' : '↕ + S', about: 'the fighter\'s special', data: dataOf(F.moves[`special.${d}.M`]) }));
  const cool = `${F.brawl.cool} frames from its start`;
  const strong = [
    { name: `Strong: ${blowWords(F.moves.strong, S.strong.slot)}`, input: 'St', about: 'from a stand, the opener: heavier and slower, it staggers long, and the chain follows on from its second blow (St, A, A …)', data: [...dataOf(F.moves.strong), { what: 'cooldown', value: cool }] },
    { name: 'Breaker', input: 'A …, St', about: 'after a fast blow that hit: the chain ended early, the body knocked down', data: [...dataOf(F.moves['strong.break']), { what: 'cooldown', value: cool }] },
    { name: 'Blowout', input: 'A …, → + St', about: 'after a fast blow that hit, toward the foe: the body flung down the street, bowling over the crowd behind it', data: [...dataOf(F.moves['strong.out']), { what: 'cooldown', value: cool }] },
    { name: 'Dive', input: 'J, St', about: 'in the air: a strong blow down that knocks down', data: [...dataOf(F.moves['strong.air']), { what: 'cooldown', value: cool }] },
  ];
  return [
    { label: 'Chain', moves: chain },
    { label: 'Strong', moves: strong },
    { label: 'Air', moves: [
      { name: 'Stomp', input: 'J, A', about: 'a jump straight up, then attack: straight down', data: dataOf(F.moves['air.M']) },
      { name: 'Jump kick', input: '→ J, A', about: 'a jump with a direction, then attack', data: dataOf(F.moves['air.H']) },
    ] },
    { label: 'Clinch', moves: [
      { name: 'Take hold', input: 'walk into', about: 'walk into a foe lined up in front of you', data: [{ what: 'frames walking in', value: String(BRAWL_RULES.grab) }] },
      { name: 'Knee', input: 'A', about: `held: a knee to the body; the ${BRAWL_RULES.knees}rd knocks down`, data: [{ what: 'damage', value: String(F.brawl.knee) }] },
      { name: 'Throw', input: '→ + A', about: 'held: thrown forward, into whoever stands behind', data: [{ what: 'damage', value: String(F.brawl.throw) }] },
      { name: 'Throw behind', input: '← + A', about: 'held: thrown behind you', data: [{ what: 'damage', value: String(F.brawl.throw) }] },
      { name: 'Suplex', input: 'A + ←/→', about: 'taken from behind: slammed down behind you', data: [{ what: 'damage', value: String(F.brawl.suplex) }] },
    ] },
    { label: 'Desperation', moves: [
      { name: 'Desperation', input: 'A + J', about: 'invincible, it strikes all round and knocks down; it costs health when it lands, never the last of it; it breaks a hold', data: [...dataOf(D), { what: 'price', value: String(D.price) }] },
    ] },
    ...(special.length ? [{ label: 'Special', moves: special }] : []),
    { label: 'Street', moves: [
      { name: 'Pick up', input: 'A over it', about: `food heals, a power-up holds its state, a weapon arms the chain (${Object.keys(THINGS.weapon).join(', ')})`, data: [] },
      { name: 'Throw the weapon', input: 'S', about: 'holding one: it strikes the first foe lined up ahead', data: [] },
    ] },
  ];
}
