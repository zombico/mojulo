import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

// A JUMP CARRIES ITS TAKEOFF (rules-platform.js, a hero sprinting on its stamina: `stamina`, `accel`): the air keeps the
// sprint the body left the ground with; the stick, still pushed, steers it and never brakes it to the run's pace.
const CW = composeLive();
const world = () => {
  const w = CW.createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 5, boostSpeed: 7.5, stamina: true, boostMax: 6, boostRegen: 1.5, accel: 30, decel: 40, airControl: 0.4, jumpSpeed: 5.7, gravity: 17, fallGravity: 22 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
  return { w, p: w.byId.p, step: (inp) => CW.stepWorld(w, inp, 1 / 60, { ground: () => 0 }) };
};
const planar = (p) => Math.hypot(p.drive[0], p.drive[1]);

describe('a jump carries its takeoff', () => {
  it('a sprint\'s speed through the air, the stick still pushed; a run\'s as it was', () => {
    const A = world();
    for (let f = 0; f < 90; f++) A.step({ forward: 1, boost: 1 });
    const v0 = planar(A.p);
    expect(v0).toBeCloseTo(7.5, 1);
    let air = 0;
    for (let f = 0; f < 90 && (air === 0 || !A.p.grounded); f++) { A.step({ forward: 1, boost: 1, ...(f < 8 ? { jump: 1, jumpHeld: 1 } : {}) }); if (!A.p.grounded) { air++; expect(planar(A.p)).toBeGreaterThan(v0 - 0.05); } }
    expect(air).toBeGreaterThan(12);
    const B = world();
    for (let f = 0; f < 90; f++) B.step({ forward: 1 });
    for (let f = 0; f < 20; f++) B.step({ forward: 1, ...(f < 8 ? { jump: 1, jumpHeld: 1 } : {}) });
    expect(B.p.grounded).toBe(false);
    expect(planar(B.p)).toBeCloseTo(5, 1);
  });
});
