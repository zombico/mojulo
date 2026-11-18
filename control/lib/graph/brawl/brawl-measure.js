/**
 * brawl measure — A MAP'S FIGHT, MEASURED: a street (its belt, its waves, its things, its play) fought down on the
 * brawl's own simulation by a BOT that plays the player's kit through its buttons, at each difficulty, and what came of
 * it read against the FIGHT LAWS. The machine gate of a map's encounters: it says how the fight goes for a player who
 * does the obvious and for one who plays with care, wave by wave, before a person plays it. It advises; it refuses
 * nothing, and it is not the eyes gate (whether the fight is FUN is a person's to say).
 *
 *   MEASURE_BOTS[id]            the players it is measured with, each by play type: its buttons a frame
 *     masher    the floor: walks at the nearest body, lines up and presses attack (or holds the trigger); it dodges nothing
 *     careful   a player with care: it steps off the line of a round coming and away from a grenade, goes for food when
 *               hurt, breaks a crate for what it holds, lobs a grenade into a knot of bodies
 *   measureStreet(street, { bot?, tier?, secs?, takes? }) → one run (the middle of its takes):
 *     { bot, tier, takes, won (how many takes were won), result: 'won' | 'lost' | 'timeout' (the middle take's, as the rest), seconds, health (share left, 0…1), at (m along it ended),
 *       waves: [{ screen, held, seconds, lost (share of the health bar it took), felled, of, passed? }],
 *       rounds?: { fired, landed, accuracy } }
 *     (`watch(street, frame, buttons)`: called each frame, for a probe)
 *     street: { belt, players: [{ recipe, style? }], waves, things?, gunner? } as streetOf takes it
 *   measureMap(street, { secs? })   → { runs: [every bot at every tier], laws: fightLaws(runs) }
 *   fightLaws(runs)                 → [{ id, ok, says, advice? }]: the FIGHT LAWS (FIGHT_LAWS says each)
 *   tieredStreet(street, tier)      → the street as a tier fights it (brawl-street-read.js STREET_DIFFICULTY: the
 *                                     crowd's rules, a boss's mind), as the page lays it
 *
 * Pure: no clock, no dice (the simulation's own seeded variation only): the same street measures the same.
 */
import { streetOf, stepStreet, CROWD_TYPES } from './brawl-crowd.js';
import { newReader, readButtons } from './brawl-moves.js';
import { newGunReader, readGunButtons } from './brawl-gunner.js';
import { STREET_DIFFICULTY, tallyRounds, accuracyOf, streetRead } from './brawl-street-read.js';
import { CPU_LEVELS } from '../versus/versus-cpu.js';
import { THINGS } from './brawl-things.js';
import { viewHalf } from './brawl-belt.js';

const sgn = Math.sign, abs = Math.abs;
const standing = (s) => s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko && b.st !== 'wait' && b.st !== 'hide');
const nearest = (me, list) => list.reduce((a, p) => (!a || abs(p.x - me.x) + 2 * abs(p.z - me.z) < abs(a.x - me.x) + 2 * abs(a.z - me.z) ? p : a), null);

// ── what a careful player sees coming ──────────────────────────────────────────────────────────────────────

/** the way (−1 | 1) to step across the street off a line of fire through `z`, staying in the band; 0: not on it */
function offLine(me, z, belt, width = 380) {
  if (abs(z - me.z) > width) return 0;
  const [n0, n1] = belt.depth.map((v) => v * 1000), away = sgn(me.z - z) || 1;
  // (toward the side with more room, unless already leaving the line)
  return me.z + away * 700 > n1 - 200 ? -1 : me.z + away * 700 < n0 + 200 ? 1 : away;
}
/** a threat on the player's line: a round flying down it toward the player and near, a grenade coming down close */
function threat(st, me) {
  const { s, ctx } = st;
  for (const r of s.shots) if (r.side === 'crowd' && r.life > 0 && !r.lob && sgn(r.vx) === sgn(me.x - r.x) && abs(me.x - r.x) < 2000) { const way = offLine(me, r.z + (r.vz / (abs(r.vx) || 1)) * abs(me.x - r.x), ctx.belt, 320); if (way) return way; }
  // (a lobbed grenade or a rocket landing near: walk on from it)
  for (const r of s.shots) if (r.side === 'crowd' && r.life > 0 && r.lob && abs(r.x - me.x) < 1500 && abs(r.z - me.z) < 900) return sgn(me.z - r.z) || 1;
  return 0;
}
const food = (s, me) => (s.things ?? []).filter((t) => t.kind === 'food' && abs(t.x - me.x) < 6000 && t.x > s.cam - 4000).sort((a, b) => abs(a.x - me.x) - abs(b.x - me.x))[0] ?? null;
const crate = (s, me, belt) => (s.things ?? []).filter((t) => t.kind === 'box' && t.holds && abs(t.x - me.x) < 9000 && (!belt || t.x > s.cam - viewHalf(belt) * 1000 + 600)).sort((a, b) => abs(a.x - me.x) - abs(b.x - me.x))[0] ?? null;

// ── the bots: buttons a frame, by play type ────────────────────────────────────────────────────────────────

const row = (says, plays) => Object.freeze({ says, ...plays });
export const MEASURE_BOTS = Object.freeze({
  masher: row('the floor: walks at the nearest body, lines up and attacks; it dodges nothing', {
    brawl: (st, me) => {
      const t = nearest(me, standing(st.s));
      if (!t) return { x: 1 };
      const dx = t.x - me.x, dz = t.z - me.z;
      return abs(dz) > 150 ? { z: sgn(dz), x: abs(dx) < 500 ? -sgn(dx) : 0 } : abs(dx) > 750 ? { x: sgn(dx) } : { a: st.s.f % 6 < 3, x: me.face === sgn(dx) ? 0 : sgn(dx) };
    },
    gun: (st, me) => {
      const t = nearest(me, standing(st.s));
      if (!t) return { x: 1 };
      const dx = t.x - me.x, dz = t.z - me.z;
      // (onto its line, then the trigger held, facing it; closing while it is far)
      return abs(dz) > 220 ? { z: sgn(dz), x: me.face === sgn(dx) ? 0 : sgn(dx), a: abs(dz) < 500 } : { x: abs(dx) > 5200 ? sgn(dx) : me.face === sgn(dx) ? 0 : sgn(dx), a: 1 };
    },
  }),
  careful: row('a player with care: off the line of a round coming; food when hurt, a crate broken for what it holds, a grenade into a knot', {
    brawl: (st, me, mem) => {
      const s = st.s, F = st.ctx.fighters[me.fb ?? me.fi], way = threat(st, me);
      if (way) return { z: way };
      // (hurt, and food lying near: to it, and take it)
      const eat = me.hp < F.hp * 0.5 ? food(s, me) : null;
      if (eat) { const dx = eat.x - me.x, dz = eat.z - me.z; return abs(dx) < 250 && abs(dz) < 250 ? { a: s.f % 6 < 3 } : { x: abs(dx) > 200 ? sgn(dx) : 0, z: abs(dz) > 200 ? sgn(dz) : 0 }; }
      const foes = standing(s), t = nearest(me, foes);
      // (ringed: the desperation, all round, at its price; not twice in a breath)
      if (foes.filter((p) => abs(p.x - me.x) < 850 && abs(p.z - me.z) < 420).length >= 2 && me.hp > F.hp * 0.25 && s.f - (mem.whirl ?? -999) > 100) { mem.whirl = s.f; return { a: 1, j: 1 }; }
      if (!t) { const c = crate(s, me, st.ctx.belt); if (c && (abs(c.x - me.x) < 3000 || (me.hp < F.hp * 0.7 && c.holds.kind === 'food'))) { const dx = c.x - me.x, dz = c.z - me.z; return abs(dz) > 150 ? { z: sgn(dz) } : abs(dx) > 700 ? { x: sgn(dx) } : { a: s.f % 6 < 3, x: me.face === sgn(dx) ? 0 : sgn(dx) }; } return { x: 1 }; }
      const dx = t.x - me.x, dz = t.z - me.z;
      return abs(dz) > 150 ? { z: sgn(dz), x: abs(dx) < 500 ? -sgn(dx) : 0 } : abs(dx) > 750 ? { x: sgn(dx) } : { a: s.f % 6 < 3, x: me.face === sgn(dx) ? 0 : sgn(dx) };
    },
    gun: (st, me, mem) => {
      const s = st.s, F = st.ctx.fighters[me.fb ?? me.fi], way = threat(st, me), foes = standing(s), t = nearest(me, foes);
      // (off the line first, the trigger kept down where a foe is still on the gun's)
      if (way) return { z: way, a: t && abs(t.z - me.z) < 300 ? 1 : 0, x: 0 };
      const eat = me.hp < F.hp * 0.5 ? food(s, me) : null;
      if (eat && !foes.some((p) => abs(p.x - me.x) < 2500)) { const dx = eat.x - me.x, dz = eat.z - me.z; return { x: abs(dx) > 150 ? sgn(dx) : 0, z: abs(dz) > 150 ? sgn(dz) : 0 }; }
      if (!t) {
        // (no one standing: a crate shot open for what it holds, what lies on the floor walked over, then on)
        const c = crate(s, me, st.ctx.belt), lying = (s.things ?? []).filter((g) => (g.kind === 'gun' || g.kind === 'food') && abs(g.x - me.x) < 5000 && (g.kind === 'gun' || me.hp < F.hp))[0];
        if (lying) { const dx = lying.x - me.x, dz = lying.z - me.z; return { x: abs(dx) > 120 ? sgn(dx) : 0, z: abs(dz) > 120 ? sgn(dz) : 0 }; }
        if (c) { const dx = c.x - me.x, dz = c.z - me.z; return abs(dz) > 200 ? { z: sgn(dz) } : { x: abs(dx) > 3000 ? sgn(dx) : me.face === sgn(dx) ? 0 : sgn(dx), a: abs(dx) <= 3000 ? 1 : 0 }; }
        return { x: 1 };
      }
      const dx = t.x - me.x, dz = t.z - me.z;
      // (a knot of bodies in a grenade's reach: one lobbed, not more than one a while)
      const knot = foes.filter((p) => abs(p.x - t.x) < 1300 && abs(p.z - t.z) < 900).length;
      if (knot >= 3 && me.gr > 0 && abs(dx) > 2000 && abs(dx) < 4200 && s.f - (mem.lob ?? -999) > 150) { mem.lob = s.f; return { s: 1, x: sgn(dx) }; }
      // (a brawler closing: back off from it, firing; a shooter: onto its line between its volleys, the trigger held)
      const rush = !CROWD_TYPES[st.mind.type[t.id]]?.gun && abs(dx) < 1500;
      // (a brawler at arm's length: a roll away from it (the stick tapped twice), then the gun turned on it)
      if (mem.roll) { const k = mem.roll.k++; if (k >= 2) { const way = mem.roll.way; mem.roll = null; mem.rolled = s.f; return { x: way }; } return k === 0 ? { x: mem.roll.way } : {}; }
      if (rush && abs(dx) < 900 && abs(dz) < 500 && s.f - (mem.rolled ?? -999) > 70) { const [lo, hi] = [s.cam - 5000, s.cam + 5000], way = me.x - sgn(dx) * 2500 < lo || me.x - sgn(dx) * 2500 > hi ? sgn(dx) : -sgn(dx); mem.roll = { way, k: 1 }; return { x: way }; }
      if (abs(dz) > 220) return { z: sgn(dz), x: rush ? -sgn(dx) : me.face === sgn(dx) ? 0 : sgn(dx), a: abs(dz) < 500 ? 1 : 0 };
      return rush ? { x: me.face === sgn(dx) ? 0 : sgn(dx), a: 1 } : { x: abs(dx) > 4800 ? sgn(dx) : me.face === sgn(dx) ? 0 : sgn(dx), a: 1 };
    },
  }),
});
export const MEASURE_BOT_IDS = Object.freeze(Object.keys(MEASURE_BOTS));
export const MEASURE_TIERS = Object.freeze(Object.keys(STREET_DIFFICULTY));

/** The street as a tier fights it: the tier's crowd rules over the street's, its bosses on the tier's mind. */
export function tieredStreet(street, tier) {
  const T = tier ? STREET_DIFFICULTY[tier] : null;
  if (tier && !T) throw new Error(`brawl: a street is measured at ${MEASURE_TIERS.join(' | ')}`);
  if (!T) return street;
  const minds = Object.keys(CPU_LEVELS);
  return { ...street, waves: T.cpu ? street.waves.map((w) => (w.boss ? { ...w, boss: { ...w.boss, cpu: T.cpu === 'first' ? minds[0] : minds[minds.length - 1] } } : w)) : street.waves, ...(Object.keys(T.crowd).length ? { crowd: { ...(street.crowd ?? {}), ...T.crowd } } : {}) };
}

/** One take: the street fought down by a bot at a tier, to its end or `secs` of play. */
function oneTake(street, { bot, tier, secs, watch, wait }) {
  const B = MEASURE_BOTS[bot];
  if (!B) throw new Error(`brawl: a street is measured with ${MEASURE_BOT_IDS.join(' | ')}`);
  const play = street.gunner ? 'gun' : 'brawl', think = B[play], mem = {};
  let st = streetOf(tieredStreet(street, tier)), reader = play === 'gun' ? newGunReader() : newReader();
  const belt = st.ctx.belt, hp0 = st.s.bodies[0].hp, held = belt.screens.map((sc, i) => (sc.gate || sc.boss ? i : -1)).filter((i) => i >= 0);
  const W = st.mind.waves.map((w) => ({ screen: w.screen, held: !!(belt.screens[w.screen].gate || belt.screens[w.screen].boss), seconds: 0, lost: 0, felled: 0, of: w.crowd.reduce((n, c) => n + c.n, 0) + (w.boss ? 1 + (w.boss.phases ?? []).reduce((n, ph) => n + (ph.calls ?? []).reduce((m, c) => m + c.n, 0), 0) : 0), from: null }));
  let tally = { fired: 0, landed: 0 }, result = null, f = 0, hp = hp0, on = -1;
  for (; f < secs * 60 && !result; f++) {
    const me = st.s.bodies[0];
    // (a take's own start: the player stands a moment first, so every body's timing falls differently)
    let buttons = f < wait ? {} : think(st, me, mem);
    // (ROUND WHAT STANDS IN THE WAY, as any player does: walking and not moving, it steps across the band, away from
    // the cover it is against, for a moment)
    if (buttons.x && me.st === 'walk' && Math.abs(me.x - (mem.lx ?? -1)) < 5) mem.held = (mem.held ?? 0) + 1; else mem.held = 0;
    mem.lx = me.x;
    if (mem.held > 10) {
      // (the side of it with the wider way past, held until the body is clear of it)
      const c = (st.s.things ?? []).filter((t) => t.kind === 'cover' || t.kind === 'box').sort((x, y) => abs(x.x - me.x) - abs(y.x - me.x))[0], [n0, n1] = belt.depth.map((v) => v * 1000);
      const hd = c ? Math.round(((THINGS[c.kind][c.what].d ?? THINGS[c.kind][c.what].w) * 1000) / 2) + 500 : 0;
      mem.round = c ? { z: n1 - (c.z + hd) > (c.z - hd) - n0 ? 1 : -1, c: c.z, hd, until: f + 240 } : { z: 1, c: me.z, hd: 600, until: f + 45 };
      mem.held = 0;
    }
    if (mem.round && f < mem.round.until && abs(me.z - mem.round.c) < mem.round.hd) buttons = { ...buttons, z: mem.round.z }; else mem.round = null;
    const [pad, r2] = play === 'gun' ? readGunButtons(reader, { x: 0, z: 0, ...buttons }, me) : readButtons(reader, { x: 0, z: 0, ...buttons }, me, st.ctx.fighters[me.fi]);
    reader = r2;
    const before = new Set(st.s.bodies.filter((b) => b.side === 'crowd' && b.ko).map((b) => b.id));
    st = stepStreet(st, [pad]);
    const now = st.s.bodies[0];
    for (const e of st.s.events) { if (e.t === 'wave') { on = W.findIndex((w) => w.screen === e.screen); if (on >= 0) W[on].from = f; } if (e.t === 'passed') { const k = W.findIndex((w) => w.screen === e.screen); if (k >= 0) W[k].passed = true; } }
    // (health lost goes to the wave being fought: the last to come in)
    if (now.hp < hp && on >= 0) W[on].lost += hp - now.hp;
    hp = now.hp;
    for (const b of st.s.bodies) if (b.side === 'crowd' && b.ko && !before.has(b.id) && !b.gone && W[b.wv]) W[b.wv].felled++;
    if (on >= 0 && W[on].from !== null && !st.s.cleared.includes(W[on].screen) && !W[on].passed) W[on].seconds = (f - W[on].from) / 60;
    if (play === 'gun') tally = tallyRounds(tally, st.s.events, 1);
    if (watch) watch(st, f, buttons);
    // (its end the street's own: lost when every player is down with no fall left, won at its last held screen)
    const R = streetRead(st, []);
    if (R.lost) result = 'lost';
    else if (R.won) result = 'won';
  }
  const r2 = (v) => Math.round(v * 100) / 100, me = st.s.bodies[0];
  return {
    bot, tier, play, result: result ?? 'timeout', seconds: Math.round(f / 6) / 10, health: r2(Math.max(0, me.hp) / hp0), at: Math.round(me.x / 100) / 10,
    waves: W.map(({ from, ...w }) => ({ ...w, seconds: Math.round(w.seconds * 10) / 10, lost: r2(w.lost / hp0), reached: from !== null })),
    ...(play === 'gun' ? { rounds: { ...tally, accuracy: accuracyOf(tally) } } : {}),
    // (a street with lives: the falls it took, of those allowed)
    ...(st.mind.lives ? { falls: st.mind.lives.falls, lives: st.mind.lives.of } : {}),
  };
}

/** A fight is not one number: a street is fought `takes` times, each from a slightly later start, and the MIDDLE take
 * is the run (by how it ended, then the health kept); `won` says how many of them were won. */
const RANK = { won: 2, timeout: 1, lost: 0 };
export function measureStreet(street, { bot = 'masher', tier = 'medium', secs = 300, takes = 5, watch = null } = {}) {
  if (!(Number.isInteger(takes) && takes >= 1 && takes <= 9)) throw new Error('brawl: a street is measured over 1 to 9 takes');
  const all = Array.from({ length: takes }, (_, k) => oneTake(street, { bot, tier, secs, watch: k === 0 ? watch : null, wait: k * 13 }));
  const sorted = [...all].sort((a, b) => RANK[a.result] - RANK[b.result] || a.health - b.health || b.seconds - a.seconds);
  return { ...sorted[Math.floor((takes - 1) / 2)], takes, won: all.filter((r) => r.result === 'won').length };
}

// ── the fight laws ─────────────────────────────────────────────────────────────────────────────────────────

/** THE FIGHT LAWS: what a map's fight is held to, each read off the runs. Advice, never a refusal. */
export const FIGHT_LAWS = Object.freeze({
  'easy-is-won': 'on easy, a player who only walks up and attacks reaches the end: the floor is not a wall',
  'care-is-rewarded': 'as written (medium), a player who plays with care wins with a quarter of its health or more',
  'max-can-be-won': 'at its hardest, a player who plays with care still wins',
  'no-spike': 'no one wave takes over half the health bar from a careful player as written: a wave that does is a wall',
  'no-slog': 'no held wave lasts a careful player over a minute and a half as written',
  'it-opens-gently': 'the first wave takes less from a careful player than the hardest does: a map teaches before it tests',
  'it-ends': 'every run ends (won or lost) inside its time: nothing stalls',
});
export const FIGHT_LIMITS = Object.freeze({ spike: 0.5, slog: 90, kept: 0.25 });
export function fightLaws(runs) {
  const at = (bot, tier) => runs.find((r) => r.bot === bot && r.tier === tier) ?? null;
  const pct = (v) => `${Math.round(v * 100)}%`, where = (w) => `the wave on screen ${w.screen + 1}`;
  const out = [], law = (id, run, ok, advice) => { if (run !== null) out.push({ id, ok: !!ok, says: FIGHT_LAWS[id], ...(ok ? {} : { advice }) }); };
  const floor = at('masher', 'easy'), mid = at('careful', 'medium'), top = at('careful', 'max');
  const stopped = (r) => { const w = [...r.waves].reverse().find((x) => x.reached); return w ? `${r.result === 'lost' ? 'it fell' : 'it was still fighting'} at ${where(w)} (${w.felled} of ${w.of} down)` : 'it never met a wave'; };
  law('easy-is-won', floor, floor?.result === 'won', floor && `on easy the floor player did not finish: ${stopped(floor)}; thin that wave, or put food before it`);
  law('care-is-rewarded', mid, mid?.result === 'won' && mid.health >= FIGHT_LIMITS.kept, mid && (mid.result === 'won' ? `a careful player wins with ${pct(mid.health)} of its health: lay food, or ease the wave that takes most` : `a careful player did not finish as written: ${stopped(mid)}`));
  law('max-can-be-won', top, top?.result === 'won', top && `at max a careful player did not finish: ${stopped(top)}`);
  if (mid) {
    const worst = mid.waves.filter((w) => w.reached).sort((a, b) => b.lost - a.lost)[0], slow = mid.waves.filter((w) => w.reached && w.held).sort((a, b) => b.seconds - a.seconds)[0], first = mid.waves.find((w) => w.reached);
    law('no-spike', mid, !worst || worst.lost <= FIGHT_LIMITS.spike, worst && `${where(worst)} takes ${pct(worst.lost)} of the health bar: fewer bodies at once, cover or food before it`);
    law('no-slog', mid, !slow || slow.seconds <= FIGHT_LIMITS.slog, slow && `${where(slow)} lasts ${Math.round(slow.seconds)} s: fewer bodies, or less health on them`);
    law('it-opens-gently', mid, !first || !worst || first === worst ? mid.waves.filter((w) => w.reached).length < 2 || first.lost <= 0.15 : true, first && `the first wave is the hardest (${pct(first.lost)} of the health bar): open with fewer`);
  }
  if (runs.length) out.push({ id: 'it-ends', ok: runs.every((r) => r.result !== 'timeout'), says: FIGHT_LAWS['it-ends'], ...(runs.every((r) => r.result !== 'timeout') ? {} : { advice: `${runs.filter((r) => r.result === 'timeout').map((r) => `${r.bot} on ${r.tier} (at ${r.at} m)`).join(', ')} did not end: a wave that cannot be reached or will not come in` }) });
  return out;
}

/** A map measured: every bot at every tier, and the laws read off them. */
export function measureMap(street, { secs = 300, takes = 5, bots = MEASURE_BOT_IDS, tiers = MEASURE_TIERS } = {}) {
  const runs = [];
  for (const tier of tiers) for (const bot of bots) runs.push(measureStreet(street, { bot, tier, secs, takes }));
  return { runs, laws: fightLaws(runs) };
}
