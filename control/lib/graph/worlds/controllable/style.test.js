// THE STYLE METER (style.js): how well the pilot fights, read off the world each step. A hero with the basic set and a
// foe that stands, struck on scripted presses at 60 Hz (as the moveset's own tests are).
import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, styleOf } from '../controllable-world.js';
import { BASIC_ARSENAL, lowerArsenal } from '../../gameworld/combos.js';

const room = ({ meter = {}, arsenal = BASIC_ARSENAL, foeHp = 1e6 } = {}) => {
  const W = lowerArsenal(arsenal);
  const w = createWorld({ ...(meter === null ? {} : { styleMeter: meter }), entities: [
    { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], weapons: W, moveset: W[0].moveset }, body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1e6 }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: foeHp, poise: 1 }, rule: { type: 'static' }, transform: { pos: [1.4, 0, 0], heading: Math.PI } },
  ] });
  const hooks = { ground: () => 0 };
  const step = (inp = {}) => stepWorld(w, inp, 1 / 60, hooks);
  for (let i = 0; i < 4; i++) step();
  // a string: a light pressed every `gap` frames, `n` times, then let play out
  const lights = (n, gap = 14) => { for (let f = 0; f < n * gap + 60; f++) step(f % gap === 0 && f / gap < n ? { fire: 1 } : {}); };
  return { w, p: w.byId.p, step, lights };
};

describe('the style meter', () => {
  it('rises on blows landed, and a varied string is worth more than one move repeated', () => {
    const A = room();
    A.lights(3);
    const varied = styleOf(A.w);
    expect(varied.combo).toBe(3);
    expect(varied.points).toBeGreaterThan(0);
    // the same opener three times over (let each end before the next: the string never chains)
    const B = room();
    for (let k = 0; k < 3; k++) B.lights(1, 14);
    const same = styleOf(B.w);
    expect(same.combo).toBe(3);
    expect(varied.earned).toBeGreaterThan(same.earned);
  });
  it('falls with time once nothing lands, to nothing, and the combo with it', () => {
    const A = room();
    A.lights(3);
    const at = styleOf(A.w).points;
    for (let f = 0; f < 60 * 3; f++) A.step();
    const later = styleOf(A.w).points;
    expect(later).toBeLessThan(at);
    for (let f = 0; f < 60 * 30; f++) A.step();
    expect(styleOf(A.w)).toMatchObject({ points: 0, tier: 0, combo: 0 });
    expect(styleOf(A.w).best).toBe(3);
  });
  it('drops a tier on a hit taken, and counts it', () => {
    const A = room({ meter: { step: 20 } });
    A.lights(3);
    const before = styleOf(A.w);
    expect(before.tier).toBeGreaterThan(0);
    A.p.hits = (A.p.hits || 0) + 1;
    A.step();
    const after = styleOf(A.w);
    expect(after.points).toBeLessThan(before.points - 15);
    expect(after).toMatchObject({ combo: 0, hurt: 1 });
    expect(after.peak).toBe(before.peak);
  });
  it('pays for a switch cancel, a foe felled and a launch; names its tiers, the game\'s own where it says them', () => {
    const A = room({ arsenal: { ...BASIC_ARSENAL, switch: 'cancel' } });
    A.step({ fire: 1 }); A.step(); A.step({ cycle: 1 });
    for (let f = 0; f < 60; f++) A.step();
    const sw = styleOf(A.w);
    const B = room({ arsenal: { ...BASIC_ARSENAL, switch: 'cancel' } });
    B.step({ fire: 1 }); for (let f = 0; f < 61; f++) B.step();
    expect(sw.earned).toBeGreaterThan(styleOf(B.w).earned);
    const C = room({ foeHp: 1 });
    C.lights(1);
    expect(styleOf(C.w).earned).toBeGreaterThan(styleOf(B.w).earned);
    const D = room({ meter: { tiers: ['dull', 'keen', 'wild'], step: 5 } });
    D.lights(3);
    expect(styleOf(D.w).tiers).toEqual(['dull', 'keen', 'wild']);
    expect(['keen', 'wild']).toContain(styleOf(D.w).name);
  });
  it('the devil gauge fills by fighting, in stocks, more on a hit taken, never past its stocks and never falling; none ⇒ no gauge', () => {
    expect(styleOf(room().w).devil).toBeUndefined();
    const A = room({ meter: { devil: { stocks: 2, per: 30, hit: 6, hurt: 10 } } });
    A.lights(3);
    const after = styleOf(A.w).devil;
    expect(after.stocks).toBe(2);
    expect(after.fill).toBeGreaterThan(0.5);
    for (let f = 0; f < 600; f++) A.step();
    expect(styleOf(A.w).devil.fill).toBe(after.fill);
    A.p.hits = (A.p.hits || 0) + 1; A.step();
    expect(styleOf(A.w).devil.fill).toBeCloseTo(after.fill + 10 / 30, 2);
    A.lights(12);
    expect(styleOf(A.w).devil.fill).toBe(2);
  });
  it('is nothing on a world that asks for none', () => {
    const A = room({ meter: null });
    A.lights(3);
    expect(A.w.style).toBeUndefined();
    expect(styleOf(A.w)).toBeNull();
  });
});
