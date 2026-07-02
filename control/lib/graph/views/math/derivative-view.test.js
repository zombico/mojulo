import { describe, expect, it } from 'vitest';

import { planDerivativeScene, assembleDerivativeScene, DERIVATIVE_SCENARIOS } from './derivative-view.js';

const hasGroup = (faces, pred) => faces.some((f) => pred(f.group));

describe('planDerivativeScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planDerivativeScene({ scenario: 'sine' }))).toBe(JSON.stringify(planDerivativeScene({ scenario: 'sine' })));
  });

  it('falls back to parabola on an unknown scenario', () => {
    expect(planDerivativeScene({ scenario: 'tangent-line' }).stats.scenario).toBe('parabola');
  });

  it('exposes the four scenarios', () => {
    expect(DERIVATIVE_SCENARIOS).toEqual(['parabola', 'cubic', 'sine', 'exp']);
  });

  it('bakes a curve, a tangent, a point bead, and a tracer', () => {
    const plan = planDerivativeScene({ scenario: 'parabola' });
    expect(hasGroup(plan.faces, (g) => g === 'curve')).toBe(true);
    expect(hasGroup(plan.faces, (g) => g === 'tangent')).toBe(true);
    expect(hasGroup(plan.faces, (g) => g === 'point')).toBe(true);
    expect(plan.tracers.length).toBeGreaterThan(0);
  });
});

describe('derivative-view — the secant slopes converge to f′(a) (the calculus)', () => {
  it('the smallest-h secant is closer to the true slope than the largest-h secant', () => {
    for (const scen of DERIVATIVE_SCENARIOS) {
      const { slope, secantSlopes } = planDerivativeScene({ scenario: scen }).stats;
      const first = Math.abs(secantSlopes[0] - slope);                          // largest h
      const last = Math.abs(secantSlopes[secantSlopes.length - 1] - slope);     // smallest h
      expect(last).toBeLessThan(first);
    }
  });

  it('parabola: f = x² so the tangent slope is 2·a', () => {
    const { at, slope } = planDerivativeScene({ scenario: 'parabola' }).stats;
    expect(slope).toBeCloseTo(2 * at, 2);
  });

  it('sine: the tangent slope is cos(a)', () => {
    const { at, slope } = planDerivativeScene({ scenario: 'sine' }).stats;
    expect(slope).toBeCloseTo(Math.cos(at), 2);
  });
});

describe('assembleDerivativeScene — payload', () => {
  it('threads faces + tracers, front camera first, no surfaces channel', () => {
    const payload = assembleDerivativeScene({ scenario: 'cubic' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.tracers.length).toBeGreaterThan(0);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('front');
  });
});
