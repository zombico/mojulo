import { describe, it, expect } from 'vitest';
import { solveClassical } from './solve.js';
import { sampleMechanicsPhysics } from '../../views/science/mechanics-view.js';
import { sampleOrbitPhysics } from '../../views/science/orbit-view.js';
import { G_NEWTON } from './laws.js';

// The curated science views are signposts, not migration targets: the same setup, composed from the law table,
// must give their numbers. Each compares one distinct procedure (a ballistic arc, a constrained swing, a linear
// oscillator, a slide with friction, a Kepler orbit). The curated kinds are untouched.

const DEG = Math.PI / 180;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const observed = (r, key) => r.observed[key].value;

describe('science worlds: the classical solver agrees with the curated views', () => {
  it('a projectile: the mechanics kind\'s range and apex', () => {
    const v0 = 18, th = 55 * DEG, g = 9.8;
    const m = sampleMechanicsPhysics({ scenario: 'projectile', v0, angle: 55, g });
    const last = m.samples.at(-1), apex = Math.max(...m.samples.map((s) => s.pos[2]));
    const r = solveClassical({ model: {
      frame: { g }, bodies: [{ id: 'ball', mass: 1, at: [0, 0, 0], v: [v0 * Math.cos(th), 0, v0 * Math.sin(th)] }],
      laws: [{ law: 'gravity-uniform' }], duration: m.T * 1.1,
      observe: [{ quantity: 'range', of: 'ball' }, { quantity: 'apex', of: 'ball' }],
    } });
    expect(rel(observed(r, 'range:ball'), last.pos[0])).toBeLessThan(1e-3);
    expect(rel(observed(r, 'apex:ball'), apex)).toBeLessThan(1e-3);
  });

  it('a wide pendulum: the mechanics kind\'s RK4 period', () => {
    const L = 12, th = 35 * DEG, g = 9.8;
    const m = sampleMechanicsPhysics({ scenario: 'pendulum', length: L, angle: 35, g });
    const r = solveClassical({ model: {
      frame: { g }, bodies: [{ id: 'bob', mass: 1, at: [L * Math.sin(th), 0, L - L * Math.cos(th)] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'rod', between: ['bob', [0, 0, L]] }], duration: m.T * 2.5,
      observe: [{ quantity: 'period', of: 'bob', axis: [1, 0, 0] }],
    } });
    expect(rel(observed(r, 'period:bob'), m.T)).toBeLessThan(1e-3);
  });

  it('a spring: the mechanics kind\'s period', () => {
    const k = 12, A = 6;
    const m = sampleMechanicsPhysics({ scenario: 'spring', k, amplitude: A, mass: 1 });
    const r = solveClassical({ model: {
      // the rest length exceeds the swing, so the mass never passes through the anchor (where a spring is not linear)
      bodies: [{ id: 'mass', mass: 1, at: [10 + A, 0, 0] }],
      laws: [{ law: 'spring', between: ['mass', [0, 0, 0]], k, rest: 10 }], duration: m.T * 2.5,
      observe: [{ quantity: 'period', of: 'mass' }],
    } });
    expect(rel(observed(r, 'period:mass'), m.T)).toBeLessThan(1e-3);
  });

  it('a rough ramp: the mechanics kind\'s slide time', () => {
    const angle = 30, mu = 0.1, Lr = 20;
    const m = sampleMechanicsPhysics({ scenario: 'inclined-plane', angle, mu, length: Lr });
    const r = solveClassical({ model: {
      bodies: [{ id: 'block', mass: 1, radius: 0.1, at: [0, 0, 0], on_plane: 'ramp' }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', id: 'ramp', tilt: `${angle} deg`, mu }], duration: m.T,
      observe: [{ quantity: 'position', of: 'block' }],
    } });
    const o = r.observed['position:block'];
    expect(rel(Math.hypot(...o.end.map((c, i) => c - o.start[i])), Lr)).toBeLessThan(1e-3);
  });

  it('an ellipse: the orbit kind\'s true period and apsides', () => {
    const o = sampleOrbitPhysics({ scenario: 'ellipse' });
    const body = o.series[0], mu = o.mu_km3_s2 * 1e9, a = body.a_km * 1e3, e = body.e;
    const rp = a * (1 - e), vp = Math.sqrt(mu * (2 / rp - 1 / a));
    const r = solveClassical({ model: {
      bodies: [{ id: 'star', mass: mu / G_NEWTON, at: [0, 0, 0], fixed: true }, { id: 'planet', mass: 1, at: [rp, 0, 0], v: [0, vp, 0] }],
      laws: [{ law: 'gravity-newton' }], duration: body.period_s * 2.3,
      observe: [{ quantity: 'period', of: 'planet', axis: [1, 0, 0] }],
    } });
    expect(rel(observed(r, 'period:planet'), body.period_s)).toBeLessThan(1e-3);
    const far = Math.max(...r.tracks.bodies.planet.x.map((p) => Math.hypot(...p)));
    expect(rel(far, a * (1 + e))).toBeLessThan(1e-3);
  });
});
