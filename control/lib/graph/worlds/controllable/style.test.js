// THE STYLE METER (style.js): how well the pilot fights, read off the world each step. A hero with the basic set and a
// foe that stands, struck on scripted presses at 60 Hz (as the moveset's own tests are).
import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, styleOf, castFacts } from '../controllable-world.js';
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
  it('the Halo Meter fills by fighting, in stocks, more on a hit taken, never past its stocks and never falling; none ⇒ no gauge', () => {
    expect(styleOf(room().w).halo).toBeUndefined();
    const A = room({ meter: { halo: { stocks: 2, per: 30, hit: 6, hurt: 10 } } });
    A.lights(3);
    const after = styleOf(A.w).halo;
    expect(after.stocks).toBe(2);
    expect(after.fill).toBeGreaterThan(0.5);
    for (let f = 0; f < 600; f++) A.step();
    expect(styleOf(A.w).halo.fill).toBe(after.fill);
    A.p.hits = (A.p.hits || 0) + 1; A.step();
    expect(styleOf(A.w).halo.fill).toBeCloseTo(after.fill + 10 / 30, 2);
    A.lights(12);
    expect(styleOf(A.w).halo.fill).toBe(2);
  });
  it('the transformation: bought with the stocks it takes, the blows harder and the run faster while the meter drains, given back as it ends', () => {
    const A = room({ meter: { halo: { stocks: 2, per: 20, at: 2, drain: 1, might: 2, swift: 1.5, heal: 0 } } });
    // (short of its stocks: the press does nothing)
    A.lights(1); A.step({ transform: 1 }); A.step();
    expect(styleOf(A.w).halo.on).toBe(false);
    A.lights(10);
    expect(styleOf(A.w).halo).toMatchObject({ fill: 2, ready: true, on: false });
    const before = { dmg: A.p.rule.strikeDamage, speed: A.p.rule.speed };
    A.step({ transform: 1 }); A.step({ transform: 1 });   // (held: one press)
    expect(styleOf(A.w).halo).toMatchObject({ on: true, count: 1 });
    expect(A.p.halo).toBe(true);
    expect(A.p.rule.strikeDamage).toBe(before.dmg * 2);
    expect(A.p.rule.speed).toBe(before.speed * 1.5);
    // (transformed, it fills no further: blows landed while it drains)
    A.lights(3);
    expect(styleOf(A.w).halo.fill).toBeLessThan(2);
    for (let f = 0; f < 140; f++) A.step();
    expect(styleOf(A.w).halo).toMatchObject({ on: false, fill: 0 });
    expect({ dmg: A.p.rule.strikeDamage, speed: A.p.rule.speed }).toEqual(before);
    expect(A.p.halo).toBe(false);
  });
  it('a second press ends it early, the stocks left kept; a body\'s own health heals while it lasts', () => {
    const A = room({ meter: { halo: { stocks: 3, per: 20, at: 1, drain: 0.5, heal: 60 } } });
    A.lights(12);
    A.p.hpMax = 1e6; A.p.body.hp = 1e6 - 100;
    A.step({ transform: 1 }); for (let f = 0; f < 30; f++) A.step();
    expect(A.p.body.hp).toBeGreaterThan(1e6 - 100 + 25);
    const mid = styleOf(A.w).halo.fill;
    A.step({ transform: 1 }); A.step();
    expect(styleOf(A.w).halo.on).toBe(false);
    expect(styleOf(A.w).halo.fill).toBeCloseTo(mid, 1);
    expect(A.p.rule.speed).toBe(6);
  });
  it('the bus hears it: ready the moment it fills, on and off, and the whole points it mends', () => {
    const A = room({ meter: { halo: { stocks: 2, per: 20, at: 1, drain: 0.5, heal: 30 } } });
    let prev = castFacts(A.w, null).prev; const heard = [];
    const tick = (inp) => { A.step(inp); const r = castFacts(A.w, prev); prev = r.prev; heard.push(...r.events.filter((e) => e.type.startsWith('halo:'))); };
    for (let f = 0; f < 12 * 14 + 60 && !styleOf(A.w).halo.ready; f++) tick(f % 14 === 0 ? { fire: 1 } : {});
    expect(heard.map((e) => e.type)).toEqual(['halo:ready']);
    tick({ transform: 1 }); for (let f = 0; f < 60; f++) tick({});
    const types = heard.map((e) => e.type), mended = heard.filter((e) => e.type === 'halo:heal').reduce((n, e) => n + e.by, 0);
    expect(types).toContain('halo:on');
    expect(mended).toBeGreaterThanOrEqual(29); expect(mended).toBeLessThanOrEqual(31);   // (30 a second, one second)
    for (let f = 0; f < 240; f++) tick({});
    expect(heard.map((e) => e.type)).toContain('halo:off');
  });
  it('is nothing on a world that asks for none', () => {
    const A = room({ meter: null });
    A.lights(3);
    expect(A.w.style).toBeUndefined();
    expect(styleOf(A.w)).toBeNull();
  });
});
