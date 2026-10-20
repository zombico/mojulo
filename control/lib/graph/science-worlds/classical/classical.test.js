import { describe, it, expect } from 'vitest';
import { solveClassical } from './solve.js';
import { buildClassical, classical } from './kernel.js';
import { CLASSICAL_LAW } from './laws.js';
import { ellipticK } from './analytic.js';

// One case per procedure: the conservative stepper, the constrained one, a losing system, contacts, collisions,
// fields, the regime gates, dt advice and gaps. Each picks the smallest model that exercises it.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const law = (id) => CLASSICAL_LAW[id].example;

describe('science worlds: classical', () => {
  it('is deterministic, and the kernel is one self-contained closure a page can run', () => {
    const a = solveClassical({ model: law('rod') });
    const b = solveClassical({ model: law('rod') });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // the page runs buildClassical.toString(): the same text must give the same numbers
    const page = new Function(`return (${buildClassical.toString()})()`)();
    const desc = {
      bodies: [{ m: 1, r: 0, q: 0, fixed: false, x: [0.5, 0, 0], v: [0, 0, 0] }],
      forces: [{ kind: 'gravity-uniform', g: [0, 0, -9.8], idx: [0] }],
      rods: [{ a: 0, b: -1, anchor: [0, 0, 1], L: Math.hypot(0.5, 1), rope: false }],
    };
    const opts = { interval: 0.02, substeps: 8, samples: 50, stepper: 'rk4' };
    expect(JSON.stringify(page.run(desc, opts))).toBe(JSON.stringify(classical.run(desc, opts)));
  });

  it('steps a conservative system with Verlet and holds every conservation law (a Kepler orbit)', () => {
    const r = solveClassical({ model: law('gravity-newton') });
    expect(r.stepper).toBe('verlet');
    for (const id of ['energy-conserved', 'momentum-conserved', 'angular-momentum-conserved', 'closed-form:kepler']) expect(gateOf(r, id)?.ok, id).toBe(true);
    expect(r.held).toBe(true);
  });

  it('holds rods exactly with RK4 and matches the pendulum period at a wide swing', () => {
    const theta = 2.1;
    const r = solveClassical({ model: {
      bodies: [{ id: 'bob', mass: 1, at: [Math.sin(theta), 0, 1 - Math.cos(theta)] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'rod', between: ['bob', [0, 0, 1]] }], duration: 8,
    } });
    expect(r.stepper).toBe('rk4');
    const cf = gateOf(r, 'closed-form:pendulum');
    expect(cf.ok).toBe(true);
    // far from the small-angle 2π√(L/g): the elliptic integral is doing the work
    expect(cf.value.expected.period).toBeCloseTo(4 * Math.sqrt(1 / 9.8) * ellipticK(Math.sin(theta / 2)), 4);
    expect(cf.value.expected.period / (2 * Math.PI * Math.sqrt(1 / 9.8))).toBeGreaterThan(1.3);
    expect(gateOf(r, 'constraints-held').ok).toBe(true);
    // a chain of two rods: the multipliers are solved together
    const chain = solveClassical({ model: {
      bodies: [{ id: 'a', mass: 1, at: [1, 0, 2] }, { id: 'b', mass: 1, at: [2, 0, 2] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'rod', between: ['a', [0, 0, 2]] }, { law: 'rod', between: ['b', 'a'] }], duration: 6,
    } });
    expect(gateOf(chain, 'energy-conserved').ok).toBe(true);
    expect(gateOf(chain, 'constraints-held').ok).toBe(true);
  });

  it('lets a losing system only lose, and reaches the closed-form terminal speed', () => {
    const r = solveClassical({ model: { ...law('drag-quadratic'), duration: 24 } });
    expect(gateOf(r, 'energy-never-gained').ok).toBe(true);
    expect(gateOf(r, 'energy-conserved')).toBeUndefined();
    expect(gateOf(r, 'closed-form:terminal').ok).toBe(true);
  });

  it('bounces exactly, comes to rest when it loses, and slides or holds on a ramp by friction', () => {
    const drop = (plane) => solveClassical({ model: {
      bodies: [{ id: 'ball', mass: 0.1, radius: 0.05, at: [0, 0, 1] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', ...plane }], duration: 5, observe: [{ quantity: 'height', of: 'ball' }],
    } });
    expect(gateOf(drop({}), 'energy-conserved').value.drift).toBeLessThan(1e-9);
    const lossy = drop({ e: 0.6 });
    expect(gateOf(lossy, 'energy-never-gained').ok).toBe(true);
    expect(lossy.observed['height:ball'].end).toBeCloseTo(0.05, 6);
    expect(gateOf(solveClassical({ model: law('plane') }), 'closed-form:incline').ok).toBe(true);
    const held = solveClassical({ model: { ...law('plane'), laws: [{ law: 'gravity-uniform' }, { law: 'plane', id: 'ramp', tilt: '20 deg', mu: 0.5 }] } });
    expect(gateOf(held, 'closed-form:incline').value.measured.distance).toBe(0);
  });

  it('collides spheres with exact momentum and the closed-form outcome', () => {
    const r = solveClassical({ model: law('collision') });
    expect(gateOf(r, 'momentum-conserved').ok).toBe(true);
    expect(gateOf(r, 'closed-form:collision').ok).toBe(true);
    expect(gateOf(r, 'no-tunnelling').ok).toBe(true);
  });

  it('turns a charge in a magnetic field without changing its energy, at the cyclotron period', () => {
    const r = solveClassical({ model: law('lorentz') });
    expect(gateOf(r, 'energy-conserved').ok).toBe(true);
    expect(gateOf(r, 'closed-form:cyclotron').ok).toBe(true);
  });

  it('advises, never refuses, when a model leaves the classical regime', () => {
    const electron = (v, B, duration) => solveClassical({ model: {
      bodies: [{ id: 'e', mass: 9.109e-31, charge: '-1 e', at: [0, 0, 0], v: [v, 0, 0] }], laws: [{ law: 'lorentz', B: [0, 0, B] }], duration,
    } });
    const fast = electron(1.5e8, 0.01, 1e-8);
    expect(gateOf(fast, 'newtonian-regime').ok).toBe(false);
    expect(fast.held).toBe(false);
    expect(fast.tracks.t.length).toBeGreaterThan(1);
    const small = electron(100, 1e-3, 1e-7);
    expect(gateOf(small, 'newtonian-regime').ok).toBe(true);
    expect(gateOf(small, 'classical-regime').ok).toBe(false);
  });

  it('says when dt cannot resolve the motion, and still runs', () => {
    const r = solveClassical({ model: {
      bodies: [{ id: 'a', mass: 1e10, at: [0, 0, 0] }, { id: 'b', mass: 1e10, at: [1, 0, 0] }], laws: [{ law: 'gravity-newton' }], duration: 10,
    } });
    expect(gateOf(r, 'dt-resolves').ok).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/step budget/);
    expect(r.steps).toBeLessThanOrEqual(400000);
  });

  it('names a missing law as a gap with the scale that owns it, and runs the rest', () => {
    const r = solveClassical({ model: { ...law('gravity-uniform'), laws: [{ law: 'gravity-uniform' }, { law: 'diffusion' }, { law: 'orbital' }, { law: 'magnus' }] } });
    expect(r.gaps.map((g) => g.law)).toEqual(['diffusion', 'orbital', 'magnus']);
    expect(r.gaps[0].why).toMatch(/microscopic/);
    expect(r.gaps[1].why).toMatch(/quantum/);
    expect(r.gaps[2].why).toMatch(/mechanics/);
    expect(gateOf(r, 'closed-form:ballistic').ok).toBe(true);
  });

  it('reads units with their dimension, and refuses a quantity in the wrong one', () => {
    const r = solveClassical({ model: { bodies: [{ id: 'b', mass: '500 g', at: [0, 0, 0], v: ['36 km/h', 0, '10 m/s'] }], laws: [{ law: 'gravity-uniform' }], duration: '1500 ms' } });
    expect(r.model.bodies[0].mass).toBe(0.5);
    expect(r.model.bodies[0].v[0]).toBeCloseTo(10, 12);
    expect(r.model.duration).toBe(1.5);
    expect(() => solveClassical({ model: { bodies: [{ id: 'b', mass: '3 m/s', at: [0, 0, 0] }], laws: [], duration: 1 } })).toThrow(/wants a mass/);
    expect(() => solveClassical({ model: { ...law('spring'), laws: [{ law: 'spring', between: ['mass', [0, 0, 0]], k: '20 N' }] } })).toThrow(/wants a stiffness/);
    expect(() => solveClassical({ model: { ...law('spring'), laws: [{ law: 'spring', between: ['mass', [0, 0, 0]], k: 20, stiff: 1 }] } })).toThrow(/has no 'stiff'/);
    expect(() => solveClassical({ model: law('spring'), bodies: [] })).toThrow(/goes under 'model'/);
  });

  it('never lets the dress reach the model', () => {
    const plain = solveClassical({ model: law('spring') });
    const dressed = solveClassical({ model: law('spring'), dress: { look: 'brass', labels: [{ on: 'mass', text: 'm' }] }, liberties: [{ what: 'the spring is drawn thicker', why: 'to read at a distance' }] });
    expect(JSON.stringify(dressed.tracks)).toBe(JSON.stringify(plain.tracks));
    expect(JSON.stringify(dressed.gates)).toBe(JSON.stringify(plain.gates));
    expect(dressed.dress.look).toBe('brass');
    expect(dressed.liberties).toEqual([{ what: 'the spring is drawn thicker', why: 'to read at a distance' }]);
    expect(dressed.assumptions.some((a) => /Hooke/.test(a))).toBe(true);
  });
});
