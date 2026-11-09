import { describe, it, expect } from 'vitest';
import { streetOf, stepStreet, readWaves, crowdFighter, CROWD_TYPES, CROWD_TYPE_IDS, CROWD_RULES } from './brawl-crowd.js';
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
  it('every type is a fighter; the knife is armed, the heavy alone grabs', () => {
    for (const id of CROWD_TYPE_IDS) {
      const F = crowdFighter(id);
      expect(F.hp, id).toBe(CROWD_TYPES[id].hp);
      if (CROWD_TYPES[id].weapon) expect(F.weapon?.kind, id).toBe(CROWD_TYPES[id].weapon);
      if (CROWD_TYPES[id].attack !== 'chain' && CROWD_TYPES[id].attack !== 'grab') expect(F.moves[CROWD_TYPES[id].attack], id).toBeTruthy();
    }
    const st = streetOf({ belt, players: [hero()], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }, { type: 'heavy', n: 1 }] }] });
    expect(st.s.bodies.map((p) => !!p.ng)).toEqual([false, true, false]);
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

describe('brawl crowd: each type throws its own', () => {
  for (const id of ['charger', 'jumper', 'heavy']) {
    it(`${id}: ${CROWD_TYPES[id].says}`, () => {
      const log = standing([{ type: id, n: 1 }], 600);
      const ev = log.flatMap((st) => st.s.events);
      if (CROWD_TYPES[id].attack === 'grab') {
        expect(ev.some((e) => e.t === 'grab' && e.clinch && e.d === 0)).toBe(true);
        expect(ev.some((e) => e.t === 'throw' && e.d === 0)).toBe(true);
      } else {
        expect(log.some((st) => st.s.bodies[1].mv === CROWD_TYPES[id].attack)).toBe(true);
        expect(ev.some((e) => e.t === 'hit' && e.d === 0 && e.p === 1)).toBe(true);
      }
    });
  }
});

describe('brawl crowd: the waves', () => {
  const waves = [{ screen: 1, crowd: [{ type: 'thug', n: 4 }, { type: 'knife', n: 2 }, { type: 'jumper', n: 1 }] }, { screen: 2, crowd: [{ type: 'thug', n: 3 }, { type: 'charger', n: 1 }, { type: 'heavy', n: 1 }] }];
  let st = streetOf({ belt, players: [hero(99999)], waves });
  const play = bot(), log = [];
  for (let k = 0; k < 9000 && st.s.cleared.length < waves.length; k++) { st = stepStreet(st, [play(st)]); log.push(st); }
  const ev = log.flatMap((x) => x.s.events.map((e) => [x.s.f, e, x]));
  it('a scripted player beats every wave, and each gate opens as its last falls', () => {
    expect(st.s.cleared).toEqual([1, 2]);
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
    expect(after.slice(0, 3).every((x) => !(x.mind.tok[0] ?? []).includes(id))).toBe(true);
    expect(after.some((x) => { const p = x.s.bodies[id]; return p.ko || Math.abs(p.x - x.s.bodies[0].x) > CROWD_RULES.ring / 2; })).toBe(true);
  });
});

describe('brawl crowd: determinism', () => {
  it('the same street and buttons are the same brawl', () => {
    const run = () => { let st = streetOf({ belt, players: [hero(99999)], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 3 }, { type: 'heavy', n: 1 }] }] }); const play = bot(); for (let k = 0; k < 900; k++) st = stepStreet(st, [play(st)]); return brawlHash(st.s) + JSON.stringify(st.mind.tok); };
    expect(run()).toBe(run());
  });
});
