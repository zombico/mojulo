import { describe, expect, it } from 'vitest';

import { planComplexScene, assembleComplexScene, COMPLEX_SCENARIOS } from './complex-view.js';

const zRange = (plan) => {
  let lo = Infinity, hi = -Infinity;
  for (const f of plan.faces) for (const c of f.corners) { if (c[2] < lo) lo = c[2]; if (c[2] > hi) hi = c[2]; }
  return [lo, hi];
};

describe('planComplexScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planComplexScene({ scenario: 'rational' }))).toBe(JSON.stringify(planComplexScene({ scenario: 'rational' })));
  });

  it('falls back to square on an unknown scenario', () => {
    expect(planComplexScene({ scenario: 'wormhole' }).stats.scenario).toBe('square');
  });

  it('exposes the five scenarios', () => {
    expect(COMPLEX_SCENARIOS).toEqual(['square', 'reciprocal', 'rational', 'exp', 'mobius']);
  });

  it('bakes a shaded domain-colouring surface + a readout + a pick', () => {
    const plan = planComplexScene({ scenario: 'square' });
    expect(plan.faces.filter((f) => f.group === 'surface').length).toBeGreaterThan(1000);
    expect(new Set(plan.faces.map((f) => f.fill)).size).toBeGreaterThan(100); // the hue wheel ⇒ many colours
    expect(plan.fields[0].readout.length).toBeGreaterThan(2);
    expect(plan.picks.some((p) => p.kind === 'domain-colour')).toBe(true);
  });
});

describe('complex-view — zeros pit and poles spike (the complex analysis)', () => {
  it('square z²: a deep PIT (the double zero at the origin) — the surface dips near its floor', () => {
    const [lo, hi] = zRange(planComplexScene({ scenario: 'square' }));
    expect(lo).toBeLessThan(-3);                 // a pit
    expect(Math.abs(hi)).toBeLessThan(Math.abs(lo)); // no comparable pole — z² has no poles in view
  });

  it('reciprocal 1/z: a tall SPIKE (the pole at the origin)', () => {
    const [, hi] = zRange(planComplexScene({ scenario: 'reciprocal' }));
    expect(hi).toBeGreaterThan(3);
  });

  it('rational (z²−1)/(z²+1): BOTH a deep pit (zeros ±1) and a tall spike (poles ±i)', () => {
    const [lo, hi] = zRange(planComplexScene({ scenario: 'rational' }));
    expect(lo).toBeLessThan(-3);
    expect(hi).toBeGreaterThan(3);
  });

  it('exp eᶻ: phase = y ⇒ horizontal colour bands (far fewer distinct hues than a winding scenario)', () => {
    const bands = new Set(planComplexScene({ scenario: 'exp' }).faces.map((f) => f.fill)).size;
    const winds = new Set(planComplexScene({ scenario: 'square' }).faces.map((f) => f.fill)).size;
    expect(bands).toBeLessThan(winds / 2);
  });
});

describe('assembleComplexScene — payload', () => {
  it('threads faces + readout, 3/4 camera first, no surfaces channel', () => {
    const payload = assembleComplexScene({ scenario: 'mobius' });
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('3/4');
  });
});
