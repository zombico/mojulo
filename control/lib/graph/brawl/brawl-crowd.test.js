import { describe, it, expect } from 'vitest';
import { streetOf, stepStreet, readWaves, crowdFighter, readPlays, playSlot, CROWD_TYPES, CROWD_TYPE_IDS, CROWD_RULES, CROWD_PLAYS } from './brawl-crowd.js';
import { brawlFighter } from './brawl-moves.js';
import { newReader, readButtons } from './brawl-moves.js';
import { readBelt, viewHalf } from './brawl-belt.js';
import { brawlHash } from './brawl-core.js';
import { solveFighter } from '../versus/versus-solver.js';

// THE CROWD: a few close in at once and the rest circle, one swings at a time so the player always gets a frame, half
// work round the back, the hurt back off; each type throws its own; waves come in from the edges and the back and hold
// their gate until the last falls; a scripted player beats every wave; no body leaves the belt.
const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, gate: true }, { length: 16, boss: true }] });
const hero = (hp = 1000) => ({ recipe: { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder', hp } });
const FREE = new Set(['stand', 'walk', 'land']);
// (a passive player stood at the gate's screen, its wave come in: the crowd's behaviour on its own)
function standing(crowd, frames, hp = 99999) {
  let st = streetOf({ belt, players: [hero(hp)], waves: [{ screen: 1, crowd }] });
  st.s.bodies[0].x = 22000;
  const log = [];
  for (let k = 0; k < frames; k++) { st = stepStreet(st, [{}]); log.push(st); }
  return log;
}
// (a scripted player: the nearest standing thug lined up, closed on, the chain pressed; walking on when none stands)
function bot() {
  let r = newReader();
  return (st) => {
    const s = st.s, me = s.bodies[0], F = st.ctx.fighters[0];
    const foes = s.bodies.filter((p) => p.side === 'crowd' && !p.gone && !p.ko);
    let b = { x: 1 };
    if (foes.length) {
      const t = foes.reduce((a, p) => (Math.abs(p.x - me.x) + 2 * Math.abs(p.z - me.z) < Math.abs(a.x - me.x) + 2 * Math.abs(a.z - me.z) ? p : a));
      const dx = t.x - me.x, dz = t.z - me.z;
      b = Math.abs(dz) > 150 ? { z: Math.sign(dz), x: Math.abs(dx) < 500 ? -Math.sign(dx) : 0 } : Math.abs(dx) > 750 ? { x: Math.sign(dx) } : { a: s.f % 5 === 0, x: me.face === Math.sign(dx) ? 0 : Math.sign(dx) };
    }
    const [pad, r2] = readButtons(r, b, me, F);
    r = r2;
    return pad;
  };
}

describe('brawl crowd: its words', () => {
  it('every type is a brawler\'s body: its fighter, its plays all on it; the knife is armed, the heavy alone grabs', () => {
    for (const id of CROWD_TYPE_IDS) {
      const F = crowdFighter(id);
      expect(F.hp, id).toBe(CROWD_TYPES[id].hp);
      if (CROWD_TYPES[id].weapon) expect(F.weapon?.kind, id).toBe(CROWD_TYPES[id].weapon);
      expect(() => readPlays(CROWD_TYPES[id].plays, F, id)).not.toThrow();
      // (every move a player has, a thug has too)
      for (const slot of ['chain.1', 'strong', 'strong.break', 'strong.out', 'strong.air', 'strong.dive', 'run.attack', 'air.L', 'air.M', 'desperate']) expect(F.moves[slot], `${id} ${slot}`).toBeTruthy();
    }
    expect(() => readPlays(['chain', 'sing'], crowdFighter('thug'))).toThrow(/play/);
    const st = streetOf({ belt, players: [hero()], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }, { type: 'heavy', n: 1 }] }] });
    expect(st.s.bodies.map((p) => !!p.ng)).toEqual([false, true, false]);
  });
  it('a type\'s own timing and damage: its blows later and lighter (or heavier) than the same fighter\'s untuned', () => {
    const T = CROWD_TYPES.heavy, F = crowdFighter('heavy');
    const plain = brawlFighter({ ...solveFighter({ id: 'heavy', archetype: T.archetype }).recipe, archetype: T.archetype, hp: T.hp });
    for (const slot of ['chain.1', 'run.attack', 'air.M']) {
      expect(F.moves[slot].startup, slot).toBe(plain.moves[slot].startup + T.tune.startup);
      expect(F.moves[slot].recovery, slot).toBe(plain.moves[slot].recovery + T.tune.recovery);
      expect(F.moves[slot].damage, slot).toBe(Math.round((plain.moves[slot].damage * T.tune.damage) / 100));
    }
    expect(F.moves.strong.cool).toBe(Math.round((plain.moves.strong.cool * T.tune.cool) / 100));
    expect(F.moves.desperate.damage).toBe(Math.round((plain.moves.desperate.damage * (plain.moves.desperate.hits || 1) * T.tune.damage) / 100 / (plain.moves.desperate.hits || 1)));
  });
  it('a wave holds a held screen, once; its crowd is a known type', () => {
    expect(() => readWaves([{ screen: 0, crowd: [{ type: 'thug', n: 1 }] }], belt)).toThrow(/held/);
    expect(() => readWaves([{ screen: 1, crowd: [{ type: 'ninja', n: 1 }] }], belt)).toThrow(/type/);
    expect(() => readWaves([{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }, { screen: 1, crowd: [{ type: 'thug', n: 1 }] }], belt)).toThrow(/already/);
  });
});

describe('brawl crowd: the tokens', () => {
  const log = standing([{ type: 'thug', n: 6 }], 1500);
  it('never more close in on a player than the tokens allow, and the rest wait on the ring', () => {
    expect(log.every((st) => (st.mind.tok[0] ?? []).length <= CROWD_RULES.tokens)).toBe(true);
    expect(log.some((st) => st.s.bodies.filter((p) => p.side === 'crowd' && !p.gone && !p.ko).length > CROWD_RULES.tokens)).toBe(true);
  });
  it('one swings at a time: a player always gets a frame to act between two attackers\' blows', () => {
    let last = null, freeSince = true;
    for (const st of log) {
      const me = st.s.bodies[0];
      for (const e of st.s.events) if (e.t === 'hit' && e.d === 0) {
        if (last !== null && e.p !== last) expect(freeSince, `frame ${st.s.f}: ${e.p} after ${last}`).toBe(true);
        last = e.p; freeSince = false;
      }
      if (FREE.has(me.st)) freeSince = true;
    }
    expect(last).not.toBeNull();
  });
  it('the ring works round the player: bodies on both sides of it', () => {
    expect(log.some((st) => { const me = st.s.bodies[0]; const c = st.s.bodies.filter((p) => p.side === 'crowd' && !p.gone && !p.ko); return c.some((p) => p.x < me.x) && c.some((p) => p.x > me.x); })).toBe(true);
  });
});

describe('brawl crowd: every play a player\'s move', () => {
  // (one test a play: a street of one type that has it, the moves its body threw, and whether one landed on the player)
  const typeWith = (play) => CROWD_TYPE_IDS.find((id) => CROWD_TYPES[id].plays.includes(play));
  const thrown = (id, frames = 2400) => {
    const log = standing([{ type: id, n: 1 }], frames);
    return { mvs: new Set(log.map((st) => st.s.bodies[1].mv).filter(Boolean)), sts: new Set(log.map((st) => st.s.bodies[1].st)), ev: log.flatMap((st) => st.s.events) };
  };
  const cases = { chain: 'chain.1', break: 'strong.break', blowout: 'strong.out', strong: 'strong', run: 'run.attack', kick: 'air.M', dive: 'strong.dive', 'special.back': 'special.back.M', 'special.down': 'special.down.M' };
  for (const [play, slot] of Object.entries(cases)) {
    it(`${play}: ${CROWD_PLAYS[play.startsWith('special.') ? 'special' : play]}`, () => {
      const id = typeWith(play);
      expect(id, play).toBeTruthy();
      expect(playSlot(play)).toBe(play === 'break' || play === 'blowout' ? 'chain.1' : slot);
      const { mvs, ev } = thrown(id);
      expect([...mvs], `${id} ${play}`).toContain(slot);
      expect(ev.some((e) => e.t === 'hit' && e.d === 0 && e.p === 1), id).toBe(true);
    });
  }
  it('grab: it walks into the player, takes hold, knees and throws', () => {
    const { ev } = thrown(typeWith('grab'), 900);
    expect(ev.some((e) => e.t === 'grab' && e.clinch && e.d === 0)).toBe(true);
    expect(ev.some((e) => e.t === 'throw' && e.d === 0)).toBe(true);
  });
  it('desperate: held by a player, it breaks out with its desperation', () => {
    const id = typeWith('desperate');
    // (the player walks into it and holds on)
    let st = streetOf({ belt, players: [hero(99999)], waves: [{ screen: 1, crowd: [{ type: id, n: 1 }] }] });
    st.s.bodies[0].x = 22000;
    let r = newReader(), broke = false;
    for (let k = 0; k < 900 && !broke; k++) {
      const me = st.s.bodies[0], t = st.s.bodies[1];
      const b = t.gone ? {} : Math.abs(t.z - me.z) > 150 ? { z: Math.sign(t.z - me.z) } : { x: Math.sign(t.x - me.x) || 1 };
      const [pad, r2] = readButtons(r, me.st === 'hold' ? {} : b, me, st.ctx.fighters[0]); r = r2;
      st = stepStreet(st, [pad]);
      broke = st.s.bodies[1].mv === 'desperate';
    }
    expect(broke).toBe(true);
  });
});

describe('brawl crowd: the waves', () => {
  const waves = [{ screen: 1, crowd: [{ type: 'thug', n: 4 }, { type: 'knife', n: 2 }, { type: 'jumper', n: 1 }] }, { screen: 2, crowd: [{ type: 'thug', n: 3 }, { type: 'charger', n: 1 }, { type: 'heavy', n: 1 }] }];
  let st = streetOf({ belt, players: [hero(99999)], waves });
  const play = bot(), log = [];
  for (let k = 0; k < 9000 && !(st.s.cleared.includes(1) && st.s.cleared.includes(2)); k++) { st = stepStreet(st, [play(st)]); log.push(st); }
  const ev = log.flatMap((x) => x.s.events.map((e) => [x.s.f, e, x]));
  it('a scripted player beats every wave, and each gate opens as its last falls', () => {
    // (the boss screen, waveless here, open from the start; then each wave's gate in turn)
    expect(st.s.cleared).toEqual([3, 1, 2]);
    const crowd = st.s.bodies.filter((p) => p.side === 'crowd');
    expect(crowd.every((p) => p.ko)).toBe(true);
  });
  it('nothing comes in until a player walks into its screen; it comes in from the right, the left and the back', () => {
    const first = ev.find(([, e]) => e.t === 'wave');
    expect(first[2].s.bodies[0].x).toBeGreaterThanOrEqual((belt.screens[1].from + 2) * 1000);
    const from = new Set(ev.filter(([, e]) => e.t === 'enter').map(([, e]) => e.from));
    expect([...from].sort()).toEqual(['back', 'left', 'right']);
    // (the edges outside the view, the back at the band's far edge)
    for (const [, e, x] of ev.filter(([, e]) => e.t === 'enter')) {
      const half = viewHalf(belt) * 1000;
      if (e.from === 'back') expect(e.z).toBe(belt.depth[1] * 1000);
      else if (e.x > 0 && e.x < belt.length * 1000) expect(Math.abs(e.x - x.s.cam)).toBeGreaterThan(half);
    }
  });
  it('at most its limit on the street at once', () => {
    expect(log.every((x) => x.s.bodies.filter((p) => p.side === 'crowd' && !p.gone && !p.ko).length <= CROWD_RULES.limit)).toBe(true);
  });
  it('no body leaves the belt or its band', () => {
    const L = belt.length * 1000, [n0, n1] = belt.depth.map((v) => v * 1000);
    const off = log.flatMap((x) => x.s.bodies.filter((p) => !(p.gone || (p.x >= 0 && p.x <= L && p.z >= n0 && p.z <= n1))).map((p) => `${x.s.f} ${p.id} ${p.st} ${p.x},${p.z}`));
    expect(off.slice(0, 5)).toEqual([]);
  });
  it('a body struck gives its token back and backs away to the ring', () => {
    const struck = ev.find(([, e]) => e.t === 'hit' && e.p === 0 && e.kind !== 'flung');
    const id = struck[1].d, at = log.indexOf(struck[2]);
    const after = log.slice(at, at + 200);
    // (from the frame after the blow: the mind thinks before the step the blow lands in)
    expect(after.slice(1, 4).every((x) => !(x.mind.tok[0] ?? []).includes(id))).toBe(true);
    expect(after.some((x) => { const p = x.s.bodies[id]; return p.ko || Math.abs(p.x - x.s.bodies[0].x) > CROWD_RULES.ring / 2; })).toBe(true);
  });
});

describe('brawl crowd: determinism', () => {
  it('the same street and buttons are the same brawl', () => {
    const run = () => { let st = streetOf({ belt, players: [hero(99999)], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 3 }, { type: 'heavy', n: 1 }] }] }); const play = bot(); for (let k = 0; k < 900; k++) st = stepStreet(st, [play(st)]); return brawlHash(st.s) + JSON.stringify(st.mind.tok); };
    expect(run()).toBe(run());
  });
});

describe('brawl crowd: the boss', () => {
  // (one of the fight's characters: a fighter from its solver, by name)
  const bossRecipe = { ...solveFighter({ id: 'bruno', archetype: 'grappler' }).recipe, id: 'bruno', name: 'Bruno', archetype: 'grappler' };
  const last = belt.screens.length - 1;
  const wave = (o = {}) => ({ screen: last, crowd: [{ type: 'thug', n: 2 }], boss: { recipe: bossRecipe, ...o } });
  it('a boss stands on the boss screen only, as a fighter\'s recipe', () => {
    expect(() => readWaves([{ screen: 1, crowd: [], boss: { recipe: bossRecipe } }], belt)).toThrow(/boss screen/);
    expect(() => readWaves([{ ...wave(), boss: { recipe: bossRecipe, cpu: 'godlike' } }], belt)).toThrow(/cpu/);
    expect(readWaves([{ screen: last, boss: { recipe: bossRecipe } }], belt)[0].crowd).toEqual([]);
  });
  // (a passive player stood in the boss's screen: the boss and its crowd on their own)
  // (walked in until its wave comes, then left alone)
  const log = [];
  const walkIn = (st) => { for (let k = 0; k < 3000 && st.mind.begun !== 0; k++) { st = stepStreet(st, [{ x: 1 }]); log.push(st); } return st; };
  let st = walkIn(streetOf({ belt, players: [hero(99999)], waves: [wave()] }));
  for (let k = 0; k < 2400; k++) { st = stepStreet(st, [{}]); log.push(st); }
  const bossId = Number(Object.keys(st.mind.bosses)[0]);
  const ev = log.flatMap((x) => x.s.events.map((e) => [x, e]));
  it('it comes in first, from the right, with its own bar', () => {
    const boss = ev.find(([, e]) => e.t === 'boss');
    expect(boss[1]).toMatchObject({ p: bossId, name: 'Bruno', hp: st.ctx.fighters[st.s.bodies[bossId].fi].hp });
    expect(ev.find(([, e]) => e.t === 'enter')[1]).toMatchObject({ p: bossId, from: 'right' });
  });
  it('the fight\'s opponent plays it: its normals, its specials, its throw, landing on the player', () => {
    const moves = new Set(log.map((x) => x.s.bodies[bossId].mv).filter(Boolean));
    const kinds = new Set([...moves].map((m) => st.ctx.fighters[st.s.bodies[bossId].fi].moves[m].kind));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(ev.some(([, e]) => (e.t === 'hit' || e.t === 'grab') && e.p === bossId && e.d === 0)).toBe(true);
  });
  it('it steps onto the player\'s line before it swings, and keeps the crowd\'s turn', () => {
    let free = true, lastBy = null;
    for (let k = 1; k < log.length; k++) {
      const a = log[k - 1].s.bodies[bossId], b = log[k].s.bodies[bossId], me = log[k].s.bodies[0];
      if (b.st === 'move' && a.st !== 'move' && !b.ko) expect(Math.abs(b.z - log[k].s.bodies[0].z)).toBeLessThanOrEqual(log[k].s.rules.line);
      for (const e of log[k].s.events) if (e.t === 'hit' && e.d === 0) { if (lastBy !== null && e.p !== lastBy) expect(free).toBe(true); lastBy = e.p; free = false; }
      if (FREE.has(me.st)) free = true;
    }
  });
  it('it takes no token', () => {
    expect(log.every((x) => !(x.mind.tok[0] ?? []).includes(bossId))).toBe(true);
  });
  it('beaten, the rest of its wave flees and the stage is clear', () => {
    let s2 = streetOf({ belt, players: [hero(99999)], waves: [{ ...wave({ hp: 400 }), crowd: [{ type: 'thug', n: 3 }] }] });
    expect(s2.s.cleared).toEqual([1, 2]);
    const play = bot(), seen = [];
    for (let k = 0; k < 8000 && !s2.s.cleared.includes(last); k++) { s2 = stepStreet(s2, [play(s2)]); seen.push(...s2.s.events); }
    expect(s2.s.cleared).toEqual([1, 2, last]);
    expect(seen.some((e) => e.t === 'stageClear')).toBe(true);
    expect(s2.s.bodies.filter((p) => p.side === 'crowd').every((p) => p.ko)).toBe(true);
  });
});
