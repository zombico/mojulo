import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// A SHELL'S FLIGHT (combat-ranged.js, a travelling round's opt-in `projectileDrag` and its gun's cone): drag sheds its
// speed as e^(−k·x) along a flat path; without it a round falls on gravity alone, as before; a weapon's seeded cone
// scatters its shells as it does its bullets, the same each time.
const E = composeLive(), DT = 1 / 60, hooks = { ground: () => 0 };
const lob = (over = {}) => ({ fireClass: 'lob', auto: false, cooldown: 0.1, magazine: 30, damage: 1, projectileSpeed: 1000, projectileGravity: 9.81, lobAngle: 0, fuse: 20, armTime: 0.02, projRadius: 0.05, ...over });
function fire(weapon, n = 1) {
  const w = E.createWorld({ entities: [{ id: 'g', pilotable: true, rule: { type: 'static' }, body: { type: 'none' }, weapon: { eye: 0, ...weapon }, transform: { pos: [0, 0, 500], heading: 0, pitch: 0 } }] });
  const out = [];
  for (let i = 0; i < n; i++) {
    const k0 = w.projSeq || 0;
    E.stepWorld(w, { fire: 1 }, DT, hooks); E.stepWorld(w, {}, DT, hooks); E.stepWorld(w, {}, DT, hooks);
    out.push(w.projectiles.find((p) => p.id === `proj-${k0}`));
    for (let f = 0; f < 10; f++) E.stepWorld(w, {}, DT, hooks);
  }
  return { w, rounds: out };
}

describe('a shell\'s flight', () => {
  it('drag sheds its speed as e^(−k·x) along its path; without drag a round falls on gravity alone', () => {
    const k = 1e-4, { w, rounds: [p] } = fire(lob({ projectileDrag: k }));
    while (p.pos[0] < 1000) E.stepWorld(w, {}, DT, hooks);
    expect(Math.hypot(...p.vel) / 1000).toBeCloseTo(Math.exp(-k * p.pos[0]), 2);
    const B = fire(lob()), q = B.rounds[0], t0 = q.age;
    expect(q.drag).toBeUndefined();
    for (let f = 0; f < 60; f++) E.stepWorld(B.w, {}, DT, hooks);
    expect(Math.hypot(q.vel[0], q.vel[1])).toBeCloseTo(1000, 6);
    expect(-q.vel[2]).toBeCloseTo(9.81 * q.age, 0);
    expect(q.age - t0).toBeCloseTo(1, 6);
  });
  it('a gun\'s cone scatters its shells, seeded: the same rounds each time, none without a cone', () => {
    const cone = { spread: { base: 0.5, move: 0, bloom: 0, recover: 0, max: 0.5 } };
    const dirs = (r) => r.rounds.map((p) => [Math.atan2(p.vel[1], p.vel[0]), p.vel[2]].map((v) => +v.toFixed(9)).join());
    const a = dirs(fire(lob(cone), 6)), b = dirs(fire(lob(cone), 6)), none = dirs(fire(lob(), 6));
    expect(a).toEqual(b);
    expect(new Set(a).size).toBeGreaterThan(3);
    expect(new Set(none.map((d) => d.split(',')[0])).size).toBe(1);
  });
});
