import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';

// a craft's fight on the fly rule: lock-on missiles (combat-ranged.js stepMissiles), flares, the boost and the barrel
// roll (rules-fly.js). Shapes, not pinned numbers.

const DT = 1 / 30;
const space = { ground: () => null };
const craftRule = (extra = {}) => ({ type: 'fly', mass: 10000, thrust: 64000, drag: 2.5, stallSpeed: 20, maxSpeed: 160, eye: 0, gravity: false, lift: false, turnRate: 0.55, pitchMax: 1.3, space: true, launchSpeed: 100, ...extra });
const MSL = { count: 2, range: 1500, speed: 150, turn: 2.5, cone: 15, lockTime: 1, damage: 3, splash: 10, prox: 8, hitsAs: 5, flares: 2 };
const target = (extra = {}) => ({ id: 'foe-1', team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 10, egg: { a: 4, c: 3, cz: 0 } }, transform: { pos: [700, 40, 0], heading: Math.PI }, ...extra });
const world = (rule, foe) => {
  const w = createWorld({ entities: [{ id: 'player', pilotable: true, rule, body: { type: 'mesh', hittable: true, egg: { a: 4, c: 2, cz: 0 } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } }, foe] });
  w.byId.player.airspeed = 0.01; w.byId.player.airborne = true;   // hold still: the craft's motion is not under test here
  return w;
};
const run = (w, input, n) => { for (let i = 0; i < n; i++) stepWorld(w, typeof input === 'function' ? input(i) : input, DT, space); };

describe('lock-on missiles', () => {
  it('lock builds on the foe in the cone and holds; a press launches a round that homes and hits as hitsAs hits', () => {
    const w = world(craftRule({ missiles: MSL }), target()), p = w.byId.player, f = w.byId['foe-1'];
    run(w, {}, 10);
    expect(p.mlock).toMatchObject({ target: 'foe-1', locked: false });
    run(w, {}, 30);
    expect(p.mlock.locked).toBe(true);
    run(w, (i) => ({ missile: i === 0 ? 1 : 0 }), 1);
    const m = w.projectiles.find((q) => q.missile);
    expect(m.homing.target).toBe('foe-1');
    expect(p.missilesLeft).toBe(1);
    run(w, {}, 300);
    expect(f.hits).toBe(MSL.hitsAs);
    expect(f.body.hp).toBeLessThan(10);
  });

  it('unlocked, a missile flies straight; a press held does not fire twice; empty, nothing', () => {
    const w = world(craftRule({ missiles: MSL }), target()), p = w.byId.player;
    run(w, { missile: 1 }, 10);   // held from the first frame: one launch, before any lock
    expect(w.projectiles.filter((q) => q.missile)).toHaveLength(1);
    expect(w.projectiles[0].homing).toBeNull();
    run(w, {}, 1); run(w, { missile: 1 }, 1); run(w, {}, 30); run(w, { missile: 1 }, 1);
    expect(p.missilesLeft).toBe(0);
  });

  it('a flare burning on the target breaks the lock: the round flies on straight and misses', () => {
    const w = world(craftRule({ missiles: MSL }), target({ rule: { type: 'static', missiles: { count: 0, flares: 1, flareTime: 3 } } })), f = w.byId['foe-1'];
    run(w, {}, 40);
    f.flareT = 3;   // the foe's flare, lit as the round leaves (a mind lights its own when a round homes in: stepMissiles)
    run(w, { missile: 1 }, 1);
    expect(w.projectiles.find((q) => q.missile).decoyed).toBe(true);
    run(w, {}, 300);
    expect(w.projectiles.every((q) => !q.homing)).toBe(true);
    expect(f.hits ?? 0).toBe(0);
  });

  it('a team never locks its own; a mind fires when locked and lights a flare when a round homes in on it', () => {
    const foeMind = { type: 'ai', space: true, speed: 0, turn: 3, standoff: 0, eye: 0, missiles: { ...MSL, count: 1, cooldown: 5 } };
    const w = createWorld({ entities: [
      { id: 'player', pilotable: true, rule: craftRule({ missiles: MSL }), body: { type: 'mesh', hittable: true, egg: { a: 4, c: 2, cz: 0 } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      { id: 'foe-1', team: 'foes', rule: foeMind, body: { type: 'mesh', hittable: true, hp: 10, egg: { a: 4, c: 3, cz: 0 } }, transform: { pos: [700, 0, 0], heading: Math.PI } },
      { id: 'foe-2', team: 'foes', rule: foeMind, body: { type: 'mesh', hittable: true, hp: 10, egg: { a: 4, c: 3, cz: 0 } }, transform: { pos: [700, 30, 0], heading: Math.PI } },
    ] });
    w.byId.player.airspeed = 0.01; w.byId.player.airborne = true;
    run(w, {}, 120);
    for (const id of ['foe-1', 'foe-2']) expect(w.byId[id].mlock?.target ?? 'player').toBe('player');
    const theirs = w.projectiles.filter((q) => q.missile && q.owner !== 'player');
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((q) => !q.homing || q.homing.target === 'player')).toBe(true);
  });
});

describe('the boost and the barrel roll', () => {
  it('boost: twice the thrust while the charge lasts, refilling when let go', () => {
    const go = (boost) => { const w = createWorld({ entities: [{ id: 'p', pilotable: true, rule: craftRule({ boost: { thrust: 2, time: 3, recharge: 0.5 } }), transform: { pos: [0, 0, 0], heading: 0 } }] }); w.byId.p.airborne = true; run(w, { forward: 1, boost }, 60); return w.byId.p; };
    const b = go(1), n = go(0);
    expect(b.airspeed).toBeGreaterThan(n.airspeed);
    expect(b.boostE).toBeLessThan(3);
    expect(n.boostE).toBe(3);
  });

  it('roll: a strafe press spins a full turn, carries the craft aside, untouchable meanwhile, then cools down', () => {
    const w = createWorld({ entities: [{ id: 'p', pilotable: true, rule: craftRule({ roll: { time: 0.7, side: 30, cooldown: 1.5 } }), transform: { pos: [0, 0, 0], heading: 0 } }] }), p = w.byId.p;
    p.airborne = true;
    run(w, { strafe: 1 }, 3);
    expect(p.rolling).toBe(true);
    expect(p.invincible).toBe(true);
    run(w, { strafe: 1 }, 30);
    expect(p.rolling).toBe(false);
    expect(p.invincible).toBe(false);
    expect(p.transform.pos[1]).toBeLessThan(-25);   // heading +x, rolled right: carried toward −y
    const y = p.transform.pos[1];
    run(w, {}, 1); run(w, { strafe: 1 }, 3);
    expect(p.rolling).toBe(false);                  // still cooling down
    expect(p.transform.pos[1]).toBeCloseTo(y, 6);
  });

  it('every new key absent: the fly rule and the weapon system as they were', () => {
    const go = (rule) => { const w = createWorld({ entities: [{ id: 'p', pilotable: true, rule, transform: { pos: [0, 0, 0], heading: 0 } }] }); w.byId.p.airborne = true; run(w, (i) => ({ forward: 1, strafe: i % 20 < 10 ? 1 : 0, boost: 1, missile: 1, flare: 1 }), 90); return w; };
    const a = go(craftRule()), b = go(craftRule({ boost: undefined, roll: undefined, missiles: undefined }));
    expect(a.byId.p.transform.pos).toEqual(b.byId.p.transform.pos);
    expect(a.projectiles ?? []).toEqual([]);
  });
});
