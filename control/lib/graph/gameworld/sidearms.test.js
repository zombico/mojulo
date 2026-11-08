import { describe, it, expect } from 'vitest';
import { BASIC_ARSENAL, lowerArsenal, readArsenal } from './combos.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

// THE SIDEARMS (combos.js `ranged`, a weapon's `sidearm`; worlds/controllable combat-ranged.js on the S press): the bow
// draws while S is held and looses once drawn (let go early, nothing); the pistols fire at their rate while it is held,
// never running dry. The cycle carries each weapon's own.
const world = ({ foeAt = 8 } = {}) => {
  const W = lowerArsenal(BASIC_ARSENAL);
  const w = createWorld({ entities: [
    { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], weapons: W, moveset: W[0].moveset, weapon: W[0].sidearm.weapon }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100, poise: 50, radius: 0.35, egg: { a: 0.35, c: 0.752, cz: 0.752 } }, rule: { type: 'static' }, transform: { pos: [foeAt, 0, 0], heading: Math.PI } },
  ] });
  const hooks = { ground: () => 0 }, p = w.byId.p, log = [];
  const step = (inp = {}) => { stepWorld(w, inp, 1 / 60, hooks); const P = p.mvPress; if (P && (!log.length || log[log.length - 1].seq !== P.seq)) log.push({ ...P }); };
  for (let i = 0; i < 4; i++) step();
  return { w, p, foe: w.byId.foe, step, log };
};

describe('the bow: hold to draw, let go once drawn', () => {
  it('a full draw looses an arrow that wounds the foe; let go early, nothing', () => {
    const A = world();
    expect(A.p.weapon.early).toBe('none');
    for (let f = 0; f < 10; f++) A.step({ special: 1 });
    expect(A.p.weapon.charging).toBe(true);
    A.step();   // (let go a sixth of a second in: not drawn)
    expect(A.p.weapon.shots).toBe(0);
    for (let f = 0; f < 40; f++) A.step();
    for (let f = 0; f < 36; f++) A.step({ special: 1 });   // (0.6 s: drawn)
    expect(A.p.weapon.chargeReady).toBe(true);
    A.step();
    expect(A.p.weapon.shots).toBe(1);
    for (let f = 0; f < 60; f++) A.step();
    expect(A.foe.body.hp).toBeLessThan(100);
  });
  it('the draw walks the hero at the aim\'s pace and refuses the blade', () => {
    const run = (special) => { const A = world({ foeAt: 30 }); const x0 = A.p.transform.pos[0]; for (let f = 0; f < 25; f++) A.step({ forward: 1, special }); return { d: A.p.transform.pos[0] - x0, A }; };
    const free = run(0), aiming = run(1);
    expect(aiming.d).toBeLessThan(free.d * 0.6);
    aiming.A.step({ forward: 1, special: 1, fire: 1 });
    expect(aiming.A.log[aiming.A.log.length - 1]).toMatchObject({ beat: 'L', verdict: 'dropped', why: 'drawing the bow' });
  });
});

describe('the pistols: hold to fire', () => {
  it('fire at their rate while S is held, never running dry, each weapon its own sidearm', () => {
    const A = world({ foeAt: 6 });
    A.step({ cycle: 1 }); A.step();
    expect(A.p.mvWeapon).toBe('fist');
    expect(A.p.weapon.infinite).toBe(true);
    const ammo = A.p.weapon.ammo;
    for (let f = 0; f < 60; f++) A.step({ special: 1 });
    expect(A.p.weapon.shots).toBeGreaterThanOrEqual(8);
    expect(A.p.weapon.ammo).toBe(ammo);
    // (every round on the foe: the sidearm aims for the body in front, the hand's own offset aside)
    expect(100 - A.foe.body.hp).toBeCloseTo(A.p.weapon.shots * 0.4, 5);
    // (back to the sword: its bow, its quiver as it was)
    A.step({ cycle: 1 }); A.step();
    expect(A.p.weapon.early).toBe('none');
  });
});

describe('the aim', () => {
  it('a foe off to the side, inside the cone: the hero turns to it and the rounds land; none in front, none aimed', () => {
    const A = world({ foeAt: 6 });
    A.foe.transform.pos = [5, 2.5, 0];   // (26° off the facing)
    A.step({ cycle: 1 }); A.step();
    for (let f = 0; f < 30; f++) A.step({ special: 1 });
    expect(Math.abs(A.p.transform.heading - Math.atan2(2.5, 5))).toBeLessThan(0.02);
    expect(A.foe.body.hp).toBeLessThan(100);
    const B = world({ foeAt: 6 });
    B.foe.transform.pos = [0, 6, 0];   // (90° off: outside the cone)
    B.step({ cycle: 1 }); B.step();
    for (let f = 0; f < 30; f++) B.step({ special: 1 });
    expect(B.p.mvAim).toBeNull();
    expect(B.foe.body.hp).toBe(100);
  });
});

describe('the arsenal\'s sidearms, read', () => {
  it('a weapon names a sidearm the arsenal has; a sidearm speaks its own mode\'s words', () => {
    const A = JSON.parse(JSON.stringify(BASIC_ARSENAL));
    A.weapons[0].sidearm = 'crossbow';
    expect(() => readArsenal(A)).toThrow(/sidearm 'crossbow' is none of the arsenal's ranged \(bow, pistols\)/);
    const B = JSON.parse(JSON.stringify(BASIC_ARSENAL));
    B.ranged[1].draw = 0.5;
    expect(() => readArsenal(B)).toThrow(/ranged\[1\]\.draw is not part of a auto sidearm/);
  });
});
