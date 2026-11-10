import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { BASIC_ARSENAL, BASIC_COMBOS, readCombos, lowerCombos, lowerArsenal, lowerJuggle } from '../../gameworld/combos.js';

// THE LAUNCHER AND THE JUGGLE (gameworld/combos.js: the launcher's back + heavy, the air strings, the arsenal's
// `juggle`; combat-melee.js stepMoveset: bH, the rise, the air tree, the kick and the hang; combat-hit.js: the airborne
// stun re-armed by each blow at its decayed length, the slam's knockdown, the air recovery). HITSTUN is the juggle's
// budget: each blow buys the foe less time in the air, and when it runs out there the foe flips out, invincible.
const CW = composeLive();
const copy = (o) => JSON.parse(JSON.stringify(o));
const J = lowerJuggle(BASIC_ARSENAL.juggle);
const world = ({ rule = {}, at = 1.3 } = {}) => {
  const W = lowerArsenal(BASIC_ARSENAL);
  const w = CW.createWorld({ entities: [
    { id: 'p', rule: { type: 'platform', eye: 0, speed: 5, airControl: 0.4, jumpSpeed: 8.17, gravity: 22, fallGravity: 32, jumpCut: 6, strike: 'melee', strikeReach: 1.6, strikeDamage: 2, strikeContact: [0.44, 0.52], weapons: W, moveset: W[0].moveset, ...rule },
      body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100, poise: 10, radius: 0.35 }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'f', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1000, poise: 2, radius: 0.35, egg: { a: 0.35, c: 0.94, cz: 0.94 }, combo: J.combo },
      rule: { type: 'static' }, transform: { pos: [at, 0, 0], heading: Math.PI } },
  ] });
  const p = w.byId.p, f = w.byId.f, log = [], hooks = { ground: () => 0 };
  let seq = 0;
  const run = (script, n) => { for (let i = 0; i < n; i++) { CW.stepWorld(w, script(i) || {}, 1 / 60, hooks); const P = p.mvPress; if (P && P.seq !== seq) { seq = P.seq; log.push(`${P.beat} ${P.verdict}: ${P.why}`); } } };
  run(() => ({}), 3);
  return { p, f, log, run };
};
// back + heavy, the heavy held through the launch (the stick back for the press's frames only)
const launch = (A, held = 30) => A.run((i) => (i < held ? { heavy: 1, forward: i < 3 ? -1 : 0 } : {}), held);

describe('the manifest', () => {
  it('lowers back + heavy to the launcher, and the air string to a tree of its own', () => {
    const M = lowerCombos(BASIC_COMBOS);
    expect(M.tree.bH).toMatchObject({ move: 'launcher' });
    expect(M.tree.H.move).toBe('thrust');
    expect(M.airTree.L.next.L.next.L).toMatchObject({ move: 'air-slam', ends: ['aerial-rave'] });
    expect(M.moves.launcher).toMatchObject({ rise: true });
    expect(M.moves['air-slam']).toMatchObject({ air: true, slam: 16, topple: true });
    // (the juggle in seconds: the hitstun its budget, decaying per blow; the air's hang and kick for the hero)
    expect(J.combo.hitstun).toEqual({ base: 0.6667, decay: 0.85, min: 0.2 });
    expect(J.combo.juggle).toMatchObject({ land: 'knockdown', recover: true });
    expect(J.air).toEqual({ hang: 0.15, kick: 1.2 });
  });
  it('refuses an air move out of place, in words', () => {
    const bad = (patch, re) => { const C = copy(BASIC_COMBOS); patch(C); expect(() => readCombos(C)).toThrow(re); };
    bad((C) => { C.moves['cut-1'].slam = 10; }, /slam is the foe's speed down/);
    bad((C) => { C.moves.thrust.rise = true; }, /rise is true on a launching move/);
    bad((C) => { C.combos.push({ id: 'x', beats: ['L', 'L', 'L', 'L'], moves: ['cut-1', 'cut-2', 'cleave', 'air-1'] }); }, /'air-1' is an air move in a ground string/);
  });
});

describe('the launcher and the air string', () => {
  it('heavy without the stick back is the thrust; with it, the launcher', () => {
    const A = world();
    A.run((i) => (i < 3 ? { heavy: 1 } : {}), 3);
    expect(A.log[0]).toMatch(/H taken: an opener: thrust/);
    const B = world();
    launch(B, 3);
    expect(B.log[0]).toMatch(/bH taken: an opener: launcher/);
  });

  it('back is away from the engaged foe, locked on or not: the stick pulled back turns the hero away, and back + heavy still launches, turned to the foe', () => {
    // (world movement: the stick is where the body goes, so pulling back faces the hero away from the foe before the press)
    const A = world({ rule: { move: 'world', moveYaw: 0 } });
    A.run(() => ({ forward: -1 }), 9);
    expect(Math.cos(A.p.transform.heading)).toBeLessThan(0);
    A.run((i) => ({ forward: -1, heavy: i < 3 ? 1 : 0 }), 3);
    expect(A.log[0]).toMatch(/bH taken: an opener: launcher/);
    expect(Math.cos(A.p.transform.heading)).toBeGreaterThan(0.99);
    A.run(() => ({}), 20);
    expect(A.f.juggle).toBeTruthy();
    // no foe engaged (one 10 m off): back is the hero's own, so the stick back faces it away and heavy is the thrust
    const B = world({ rule: { move: 'world', moveYaw: 0 }, at: 10 });
    B.run(() => ({ forward: -1 }), 12);
    B.run((i) => ({ forward: -1, heavy: i < 3 ? 1 : 0 }), 3);
    expect(B.log[0]).toMatch(/H taken: an opener: thrust/);
  });

  it('after the launch the hero faces the foe it threw: rising with the stick held away, and each air move taken at it', () => {
    const A = world({ rule: { move: 'world', moveYaw: 0 } });
    // (the foe off to the side: the launch throws it, then the stick is held straight back, away from it, all the way up)
    A.f.transform.pos = [1.1, 0.6, 0];
    A.run((i) => ({ heavy: 1, forward: i < 3 ? -1 : 0 }), 24);
    expect(A.p.grounded).toBe(false);
    const toward = () => Math.cos(Math.atan2(A.f.transform.pos[1] - A.p.transform.pos[1], A.f.transform.pos[0] - A.p.transform.pos[0]) - A.p.transform.heading);
    A.run(() => ({ forward: -1 }), 6);
    expect(toward()).toBeGreaterThan(0.97);
    A.run((i) => ({ forward: -1, fire: i < 3 ? 1 : 0 }), 3);
    expect(A.log).toContain('L taken: an air opener: air-1');
    expect(toward()).toBeGreaterThan(0.97);
    // landed, the aim is let go
    A.run(() => ({}), 120);
    expect(A.p.grounded).toBe(true);
    expect(A.p.mvThrown).toBeNull();
  });

  it('the launcher is the upswing straight ahead, a lunge in and a long window: a foe at the edge of reach is thrown up', () => {
    const A = world({ at: 2.1 });
    launch(A, 3);
    A.run(() => ({}), 30);
    expect(A.f.juggle).toBeTruthy();
  });

  it('held through the launch the hero rises with the foe; L L L in the air keeps it up, each blow buying less stun; the slam knocks it down', () => {
    const A = world();
    launch(A);
    expect(A.f.juggle).toBeTruthy();
    expect(A.log).toContain('H taken: held through the launch: rising with it');
    expect(A.p.grounded).toBe(false);
    const stuns = [];
    let was = A.f.comboHits;
    // L L L, each press held a few frames, as a key is
    A.run((i) => { if (A.f.comboHits !== was) { was = A.f.comboHits; if (A.f.juggle) stuns.push(A.f.juggle.stunT); } return i % 17 < 4 && i < 51 ? { fire: 1 } : {}; }, 60);
    expect(A.log.filter((x) => /L taken/.test(x)).map((x) => x.split(': ').pop())).toEqual(['air-1', 'air-2', 'air-slam (ends aerial-rave)']);
    // (each blow re-arms the stun, shorter than the last)
    expect(stuns.length).toBeGreaterThanOrEqual(2);
    expect(stuns[1]).toBeLessThan(stuns[0]);
    // the slam: the foe driven into the ground, the landing its knockdown, no recovery
    A.run(() => ({}), 60);
    expect(A.f.juggle).toBeNull();
    expect(A.f.reactClip).toBe('topple');
    expect(A.f.airRecoveries || 0).toBe(0);
  });

  it('left alone in the air, the foe\'s stun runs out: it flips out invincible and lands on its feet, the combo spent', () => {
    const A = world();
    launch(A);
    let inv = false;
    A.run(() => { if (A.f.juggle && A.f.juggle.recover && A.f.invincible) inv = true; return {}; }, 120);
    expect(inv).toBe(true);
    expect(A.f.airRecoveries).toBe(1);
    expect(A.f.juggle).toBeNull();
    expect(A.f.staggerT).toBeNull();
    expect(A.f.invincible).toBe(false);
    expect(A.f.comboHits).toBe(0);
  });

  it('an air move stops the climb and hangs the hero: it falls slower than the jump alone', () => {
    const fall = (strike) => {
      const A = world();
      launch(A);
      A.run((i) => (strike && i < 3 ? { fire: 1 } : {}), 12);
      return A.p.transform.pos[2];
    };
    const free = fall(false), held = fall(true);
    // (the free rise climbs on from the launch; the struck one stopped at a small kick and hangs about there)
    expect(held).toBeLessThan(free);
    const A = world();
    launch(A);
    const z0 = A.p.transform.pos[2];
    A.run((i) => (i < 3 ? { fire: 1 } : {}), 20);
    expect(Math.abs(A.p.transform.pos[2] - z0)).toBeLessThan(0.35);
  });
});
