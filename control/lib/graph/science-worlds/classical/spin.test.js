import { describe, it, expect } from 'vitest';
import { solveClassical } from './solve.js';
import { CLASSICAL_LAW } from './laws.js';
import { MATTER } from '../../rupa/matter.js';

// Spin: one case per procedure (rolling from rest under static friction, a skid settling into a roll, backspin, a bounce
// trading speed and spin, Magnus lift, a spin untouched in flight, a shell's inertia), the refusals, and the
// absent-channel rule (a model with no spin is the run it always was).

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const last = (r, id, k) => r.tracks.bodies[id][k].at(-1);
const floor = (mu) => ({ law: 'plane', id: 'floor', mu });
const ball = (extra) => ({ id: 'ball', mass: 1, radius: 0.1, at: [0, 0, 0.1], on_plane: 'floor', ...extra });

describe('science worlds: spin and rolling', () => {
  it('leaves a model with no spin as it was: no spin track, no spin gate, and a ramp still slides', () => {
    const r = solveClassical({ model: CLASSICAL_LAW.plane.example });
    expect(r.tracks.bodies.block.w).toBeUndefined();
    expect(gateOf(r, 'spin-held')).toBeUndefined();
    expect(gateOf(r, 'closed-form:incline').ok).toBe(true);
    expect(gateOf(r, 'closed-form:rolling')).toBeUndefined();
  });

  it('rolls a ball from rest down a ramp at 5/7 of the slide, and holds its energy, spin included', () => {
    const r = solveClassical({ model: {
      bodies: [{ id: 'ball', mass: 1, radius: 0.05, at: [0, 0, 0], on_plane: 'ramp', spin: [0, 0, 0] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', id: 'ramp', tilt: '20 deg', mu: 0.3 }], duration: 1.5, observe: ['energy'],
    } });
    expect(gateOf(r, 'closed-form:rolling').ok).toBe(true);
    expect(gateOf(r, 'closed-form:incline')).toBeUndefined();
    expect(r.observed.energy.end).toBeCloseTo(r.observed.energy.start, 6);
    // rolling: the contact point stands still, v = ω·r
    expect(Math.hypot(...last(r, 'ball', 'v'))).toBeCloseTo(Math.hypot(...last(r, 'ball', 'w')) * 0.05, 6);
  });

  it('settles a skid into a roll at 5/7 of its speed, and brings a backspun ball back', () => {
    const skid = solveClassical({ model: { bodies: [ball({ v: [5, 0, 0], spin: [0, 0, 0] })], laws: [{ law: 'gravity-uniform' }, floor(0.2)], duration: 3 } });
    expect(last(skid, 'ball', 'v')[0]).toBeCloseTo((5 * 5) / 7, 6);
    expect(gateOf(skid, 'energy-never-gained').ok).toBe(true);
    const back = solveClassical({ model: { bodies: [ball({ v: [3, 0, 0], spin: [0, -100, 0] })], laws: [{ law: 'gravity-uniform' }, floor(0.2)], duration: 4 } });
    // angular momentum about the contact point holds: v = (5·v₀ − 2·r·ω₀)/7
    expect(last(back, 'ball', 'v')[0]).toBeCloseTo((5 * 3 - 2 * 0.1 * 100) / 7, 6);
  });

  it('trades speed and spin at a rough bounce: topspin throws a ball forward', () => {
    const run = (spin) => solveClassical({ model: {
      bodies: [{ id: 'ball', mass: 0.06, radius: 0.033, at: [0, 0, 1], v: [2, 0, 0], spin }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', e: 0.75, mu: 0.4 }], duration: 0.6,
    } });
    const top = run([0, 200, 0]), none = run([0, 0, 0]);
    expect(last(top, 'ball', 'v')[0]).toBeGreaterThan(2);
    expect(last(none, 'ball', 'v')[0]).toBeLessThan(2);
    expect(gateOf(top, 'spin-held').ok).toBe(true);
  });

  it('curves a spinning ball with Magnus lift, sideways for sidespin, and leaves its spin alone in the air', () => {
    const r = solveClassical({ model: CLASSICAL_LAW.magnus.example });
    const straight = solveClassical({ model: { ...CLASSICAL_LAW.magnus.example, laws: CLASSICAL_LAW.magnus.example.laws.filter((l) => l.law !== 'magnus') } });
    expect(last(straight, 'ball', 'x')[1]).toBe(0);
    expect(last(r, 'ball', 'x')[1]).toBeGreaterThan(1);
    expect(last(r, 'ball', 'w')).toEqual(r.tracks.bodies.ball.w[0]);
    expect(gateOf(r, 'spin-held').ok).toBe(true);
  });

  it('gives a shell of matter more inertia than a solid ball of the same mass, so it rolls slower', () => {
    const shell = Object.keys(MATTER).find((id) => MATTER[id].fill < 1 && MATTER[id].family === 'metal');
    const roll = (matter) => solveClassical({ model: {
      bodies: [{ id: 'ball', mass: 1, matter, radius: 0.1, at: [0, 0, 0], on_plane: 'ramp', spin: [0, 0, 0] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', id: 'ramp', tilt: '10 deg', mu: 0.5 }], duration: 1,
    } });
    const solid = roll('steel'), hollow = roll(shell);
    expect(hollow.model.bodies[0].inertia).toBeGreaterThan(solid.model.bodies[0].inertia);
    expect(solid.model.bodies[0].inertia).toBeCloseTo(0.4 * 1 * 0.01, 12);
    expect(gateOf(hollow, 'closed-form:rolling').ok).toBe(true);
    expect(Math.hypot(...last(hollow, 'ball', 'v'))).toBeLessThan(Math.hypot(...last(solid, 'ball', 'v')));
  });

  it('reads spin in rad/s, rpm or rev/s, and refuses Hz, a point and a fixed body', () => {
    const one = (spin, extra = {}) => solveClassical({ model: { bodies: [{ id: 'b', mass: 1, radius: 0.1, at: [0, 0, 1], spin, ...extra }], laws: [], duration: 0.1 } });
    expect(one([0, 0, '60 rpm']).model.bodies[0].spin[2]).toBeCloseTo(2 * Math.PI, 12);
    expect(() => one([0, 0, '1 Hz'])).toThrow(/rev\/s/);
    expect(() => one([0, 0, 1], { radius: 0 })).toThrow(/a point does not spin/);
    expect(() => one([0, 0, 1], { fixed: true })).toThrow(/does not spin/);
    expect(() => solveClassical({ model: { bodies: [{ id: 'b', mass: 1, radius: 0.1, at: [0, 0, 1] }], laws: [{ law: 'magnus' }], duration: 0.1 } })).toThrow(/give a body spin/);
  });
});
