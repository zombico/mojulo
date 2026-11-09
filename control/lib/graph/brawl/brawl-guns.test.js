import { describe, it, expect } from 'vitest';
import { GUNS, GUN_IDS, readGun, aimVector, roundsOf, AIMS, ACROSS, GUN_MUZZLE } from './brawl-guns.js';
import { newBrawl, stepBrawl, brawlHash, BRAWL_RULES } from './brawl-core.js';
import { brawlFighter } from './brawl-moves.js';
import { solveFighter } from '../versus/versus-solver.js';

// THE RUN & GUN'S GUNS: a round FLIES (never a hitscan), along the street and across it, landing only within its line
// (step off it: dodged); it pierces as its gun says, a rocket and a grenade burst, a pick-up's ammo runs out to the
// sidearm, the roll is untouchable, and a stream cannot pin a body.
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const F = brawlFighter(recipe);
const guns = ['sidearm', 'machine-gun', 'flame', 'rocket', 'grenade'].map((g) => readGun(g));
const G = Object.fromEntries(guns.map((g, i) => [g.id, i]));
const ctx = { fighters: [F], guns };
// (a gunner at 0 facing along, and the bodies of the crowd it shoots at)
const range = (gun, crowd, o = {}) => newBrawl(ctx, { bodies: [{ fighter: 0, side: 'player', x: 0, gun: G[gun], ...o }, ...crowd.map(([x, z = 0]) => ({ fighter: 0, side: 'crowd', x, z, grabs: false, face: -1 }))] });
function run(s, n, pad = () => ({ fire: [1, 0] }), crowd = () => ({})) {
  const ev = [];
  for (let k = 0; k < n; k++) { s = stepBrawl(s, [pad(k, s), ...s.bodies.slice(1).map(() => crowd(k, s))], ctx); ev.push(...s.events.map((e) => [k, e])); }
  return { s, ev };
}
const hitsOn = (ev, d) => ev.filter(([, e]) => e.t === 'hit' && e.d === d);

describe('brawl guns: the shelf', () => {
  it('a gun by its name, or dials over one passed in to be tried; a key it has not, or out of range, refused', () => {
    expect(readGun('spread').pellets).toBe(GUNS.spread.pellets);
    const tuned = readGun({ from: 'machine-gun', rate: 3, damage: 6 });
    expect([tuned.rate, tuned.damage, tuned.speed, tuned.id]).toEqual([3, 6, GUNS['machine-gun'].speed, 'machine-gun-tuned']);
    expect(() => readGun('laser')).toThrow(/one of/);
    expect(() => readGun({ from: 'sidearm', recoil: 3 })).toThrow(/recoil/);
    expect(() => readGun({ speed: 0 })).toThrow(/speed/);
  });
  it('a foe\'s round is slow enough to step off; a player\'s stream fast', () => {
    const foes = GUN_IDS.filter((g) => GUNS[g].telegraph > 0), mine = GUN_IDS.filter((g) => !GUNS[g].telegraph && !GUNS[g].lob);
    expect(Math.max(...foes.map((g) => GUNS[g].speed))).toBeLessThan(Math.min(...mine.filter((g) => !GUNS[g].area && GUNS[g].pierce === 1).map((g) => GUNS[g].speed)));
  });
  it('eight aims on the floor; the across ones shallow, straight across at full speed', () => {
    expect(AIMS.length).toBe(8);
    const [x, z] = aimVector([1, 1], 1);
    expect(z / x).toBeCloseTo(ACROSS, 2);
    expect(aimVector([0, 1], 1)).toEqual([0, 1000]);
    expect(aimVector(null, -1)).toEqual([-1000, 0]);
    // (a fan about its aim, its middle round on it)
    const fan = roundsOf(GUNS.spread, [1, 0], 1);
    expect(fan.length).toBe(GUNS.spread.pellets);
    expect(fan[2]).toEqual([GUNS.spread.speed, 0]);
  });
});

describe('brawl guns: a round flies', () => {
  it('it lands when its flight reaches the body, never at once', () => {
    const { ev } = run(range('sidearm', [[3500]]), 40, (k) => (k === 0 ? { fire: [1, 0] } : {}));
    const hit = hitsOn(ev, 1)[0];
    expect(hit).toBeTruthy();
    const frames = hit[0];
    // (no sooner than its flight from the muzzle to the body's near side takes)
    expect(frames).toBeGreaterThan(Math.floor((3500 - GUN_MUZZLE[0] - 600) / GUNS.sidearm.speed) - 1);
    expect(hit[1].kind).toBe('round');
  });
  it('off its line it passes: step across the street and it misses', () => {
    const on = run(range('sidearm', [[3000, 150]]), 40, (k) => (k === 0 ? { fire: [1, 0] } : {}));
    const off = run(range('sidearm', [[3000, GUNS.sidearm.line + 200]]), 40, (k) => (k === 0 ? { fire: [1, 0] } : {}));
    expect(hitsOn(on.ev, 1).length).toBe(1);
    expect(hitsOn(off.ev, 1).length).toBe(0);
  });
  it('aimed across the street at a slant, it reaches a body there', () => {
    // (two metres along, a metre across: the diagonal's slant)
    const { ev } = run(range('sidearm', [[2400, 1000]]), 60, (k) => (k === 0 ? { fire: [1, 1] } : {}));
    expect(hitsOn(ev, 1).length).toBe(1);
  });
  it('a round is spent on the first body it meets; a flame passes through to the next', () => {
    const line = [[1800], [2600]];
    const one = run(range('sidearm', line), 40, (k) => (k === 0 ? { fire: [1, 0] } : {}));
    expect([hitsOn(one.ev, 1).length, hitsOn(one.ev, 2).length]).toEqual([1, 0]);
    const flame = run(range('flame', [[900], [1300]]), 30, (k) => (k === 0 ? { fire: [1, 0] } : {}));
    expect(hitsOn(flame.ev, 1).length && hitsOn(flame.ev, 2).length).toBeTruthy();
  });
  it('held, it fires at its gun\'s rate', () => {
    const { ev } = run(range('machine-gun', [[20000]], { gun: G['machine-gun'] }), 60);
    const shots = ev.filter(([, e]) => e.t === 'fire');
    expect(shots.length).toBe(Math.ceil(60 / GUNS['machine-gun'].rate));
  });
});

describe('brawl guns: bursts, the lob, ammo, the roll, a stream', () => {
  it('a rocket bursts where it meets the first, flooring the bodies round it', () => {
    const { ev } = run(range('rocket', [[2500], [3100, 400]]), 60, (k) => (k === 0 ? { fire: [1, 0] } : {}));
    expect(ev.some(([, e]) => e.t === 'burst')).toBe(true);
    for (const d of [1, 2]) expect(ev.some(([, e]) => e.t === 'land' && e.p === d), `body ${d}`).toBe(true);
  });
  it('a grenade is lobbed over the near body and bursts where it comes down', () => {
    const s0 = range('sidearm', [[900], [3000]], { grenades: 2, grenadeGun: G.grenade });
    const { s, ev } = run(s0, 90, (k) => (k === 0 ? { lob: [1, 0] } : {}));
    const b = ev.find(([, e]) => e.t === 'burst');
    expect(b).toBeTruthy();
    expect(b[1].x).toBeGreaterThan(1200);
    expect(s.bodies[0].gr).toBe(1);
    expect(hitsOn(ev, 2).length).toBe(1);
  });
  it('a pick-up\'s ammo spent, the body is back on its sidearm', () => {
    const s0 = range('sidearm', [[20000]]);
    s0.bodies[0].gn = G['machine-gun']; s0.bodies[0].am = 3;
    const { s, ev } = run(s0, 30);
    expect(ev.some(([, e]) => e.t === 'empty' && e.gun === 'machine-gun')).toBe(true);
    expect(s.bodies[0].gn).toBe(G.sidearm);
  });
  it('a roll is untouchable as it starts: the round passes through', () => {
    // (the crowd body rolls across as the round reaches it)
    const s0 = range('sidearm', [[1400]]);
    const { ev } = run(s0, 30, (k) => (k === 0 ? { fire: [1, 0] } : {}), (k) => (k === 1 ? { dash: 'roll', z: 1 } : {}));
    expect(hitsOn(ev, 1).length).toBe(0);
  });
  it('a stream cannot pin a body: it reels, then stands between rounds', () => {
    const { ev, s } = run(range('machine-gun', [[1600]], { gun: G['machine-gun'] }), 120, () => ({ fire: [1, 0] }), () => ({}));
    expect(hitsOn(ev, 1).length).toBeGreaterThan(10);
    // (the body free at times under the stream: its stun not renewed by every round)
    let free = 0, st = range('machine-gun', [[1600]], { gun: G['machine-gun'] });
    for (let k = 0; k < 120; k++) { st = stepBrawl(st, [{ fire: [1, 0] }, {}], ctx); if (st.bodies[1].st === 'stand') free++; }
    expect(free).toBeGreaterThan(0);
    expect(s.bodies[1].hp).toBeLessThan(F.hp);
  });
  it('the same shots, the same brawl', () => {
    const a = run(range('spread', [[2000], [2600, 300]], { gun: 0 }), 90, (k) => ({ fire: [1, k % 30 < 15 ? 1 : 0] }));
    const b = run(range('spread', [[2000], [2600, 300]], { gun: 0 }), 90, (k) => ({ fire: [1, k % 30 < 15 ? 1 : 0] }));
    expect(brawlHash(a.s)).toBe(brawlHash(b.s));
    expect(BRAWL_RULES.rollInv).toBeGreaterThan(0);
  });
});
