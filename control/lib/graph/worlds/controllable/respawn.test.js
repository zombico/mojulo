import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// A FAIR RESPAWN: the cast's spawn `among` stands the fallen at the spawn farthest from the living, and its `guard`
// keeps it from harm a few seconds or until it fires. A LED SHOT: a mind with a travelling round aims where a moving
// target will be.

const E = composeLive();
const hooks = { ground: () => 0 };
const PERSON = { a: 0.35, c: 0.9, cz: 0.9 };
const body = (id, pos, extra = {}) => ({ id, rule: { type: 'walk', speed: 0, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 100, egg: { ...PERSON } }, transform: { pos, heading: 0, pitch: 0 }, ...extra });
const gun = { fireClass: 'sight', auto: false, cooldown: 0.2, magazine: 30, damage: 10, range: 60, coreAngle: 1.5, eye: 1.3 };

describe('the farthest spawn', () => {
  it('the fallen stands where the nearest living body is farthest; a tie to the first', () => {
    const spawns = [[0, 0, 0], [30, 0, 0], [0, 30, 0]];
    const w = E.createWorld({ entities: [body('a', [5, 5, 0]), body('b', [2, 0, 0]), body('c', [28, 2, 0])] });
    E.castOps(w, [{ op: 'kill', who: 'a' }, { op: 'spawn', who: 'a', among: spawns }]);
    expect(w.byId.a.transform.pos.slice(0, 2)).toEqual([0, 30]);
    // nobody standing: every spawn ties, the first wins
    const v = E.createWorld({ entities: [body('a', [5, 5, 0])] });
    E.castOps(v, [{ op: 'kill', who: 'a' }, { op: 'spawn', who: 'a', among: spawns }]);
    expect(v.byId.a.transform.pos.slice(0, 2)).toEqual([0, 0]);
  });
});

describe('the spawn guard', () => {
  const duel = () => E.createWorld({ entities: [
    body('a', [0, 0, 0], { weapon: { ...gun }, pilotable: true }),
    body('b', [10, 0, 0]),
  ] });
  it('a guarded body takes no rounds for its seconds, then does', () => {
    const w = duel(), a = w.byId.a, b = w.byId.b;
    E.castOps(w, [{ op: 'kill', who: 'b' }, { op: 'spawn', who: 'b', at: [10, 0, 0], guard: 1 }]);
    for (let k = 0; k < 20; k++) E.stepWorld(w, { fire: k % 2 }, 1 / 30, hooks);
    expect(b.hits || 0).toBe(0);
    expect(a.weapon.shots).toBeGreaterThan(0);
    for (let k = 0; k < 30; k++) E.stepWorld(w, {}, 1 / 30, hooks);
    for (let k = 0; k < 10; k++) E.stepWorld(w, { fire: k % 2 }, 1 / 30, hooks);
    expect(b.hits).toBeGreaterThan(0);
  });
  it('firing breaks it at once', () => {
    const w = duel(), a = w.byId.a;
    E.castOps(w, [{ op: 'kill', who: 'a' }, { op: 'spawn', who: 'a', at: [0, 0, 0], guard: 5 }]);
    E.stepWorld(w, {}, 1 / 30, hooks);
    expect([a.spawnGuard, a.invincible]).toEqual([true, true]);
    E.stepWorld(w, { fire: 1 }, 1 / 30, hooks);
    expect(a.weapon.shots).toBe(1);
    expect([a.spawnGuard, a.invincible]).toEqual([false, false]);
  });
});

describe('a led shot', () => {
  it('a launcher aims ahead of a target crossing its line, and lands where a plain aim would miss', () => {
    const lob = { fireClass: 'lob', auto: false, cooldown: 0.8, magazine: 99, damage: 10, range: 60, eye: 1.3, lobAngle: 0, projectileSpeed: 20, projectileGravity: 0, splashRadius: 0.3, projRadius: 0.2, armTime: 0.05, fuse: 3 };
    const w = E.createWorld({ entities: [
      { id: 'a', rule: { type: 'ai', mind: { motivation: 'frag', perception: 'memory' }, sightRange: 60, sightCone: 2, standoff: 30, speed: 0, turn: 8, burst: 0.3, pause: 0.5, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, weapon: lob, body: { type: 'mesh', hittable: true, hp: 1e6, egg: { ...PERSON } }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      body('t', [16, -8, 0], { body: { type: 'mesh', hittable: true, hp: 1e6, egg: { ...PERSON } } }),
    ] });
    const a = w.byId.a, T = w.byId.t;
    let ahead = 0, n = 0;
    for (let k = 0; k < 150; k++) {
      T.transform.pos[1] += 4 / 30;   // it crosses at 4 m/s
      E.stepWorld(w, {}, 1 / 30, hooks);
      if (k > 20 && k < 110) { const to = Math.atan2(T.transform.pos[1], T.transform.pos[0]); ahead += a.transform.heading - to; n++; }
    }
    expect(ahead / n).toBeGreaterThan(0.05);   // the aim runs ahead of the line to the target, the way it walks
    expect(T.hits || 0).toBeGreaterThan(0);
  });
});
