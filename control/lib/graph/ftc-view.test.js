import { describe, expect, it } from 'vitest';

import { planFtcScene, assembleFtcScene, FTC_SCENARIOS } from './ftc-view.js';

const hasGroup = (faces, group) => faces.some((f) => f.group === group);

describe('planFtcScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planFtcScene({ scenario: 'sine' }))).toBe(JSON.stringify(planFtcScene({ scenario: 'sine' })));
  });

  it('falls back to linear on an unknown scenario', () => {
    expect(planFtcScene({ scenario: 'gaussian' }).stats.scenario).toBe('linear');
  });

  it('exposes the four scenarios', () => {
    expect(FTC_SCENARIOS).toEqual(['constant', 'linear', 'sine', 'square']);
  });

  it('bakes the shaded area, the f-curve, the A-curve, a height bar, a tangent, and 2 tracers', () => {
    const plan = planFtcScene({ scenario: 'linear' });
    expect(hasGroup(plan.faces, 'area')).toBe(true);
    expect(hasGroup(plan.faces, 'fcurve')).toBe(true);
    expect(hasGroup(plan.faces, 'acurve')).toBe(true);
    expect(hasGroup(plan.faces, 'height')).toBe(true);
    expect(hasGroup(plan.faces, 'tangent')).toBe(true);
    expect(plan.tracers.length).toBe(2);
  });
});

describe('ftc-view — A′(x) = f(x), the theorem (the calculus)', () => {
  it('constant: f = 1 and A(x) = x', () => {
    const { at, fAt, areaAt } = planFtcScene({ scenario: 'constant' }).stats;
    expect(fAt).toBeCloseTo(1, 5);
    expect(areaAt).toBeCloseTo(at, 2);
  });

  it('linear: f(x) = x and A(x) = x²/2', () => {
    const { at, fAt, areaAt } = planFtcScene({ scenario: 'linear' }).stats;
    expect(fAt).toBeCloseTo(at, 2);
    expect(areaAt).toBeCloseTo((at * at) / 2, 2);
  });

  it('square: f(x) = x² and A(x) = x³/3', () => {
    const { at, fAt, areaAt } = planFtcScene({ scenario: 'square' }).stats;
    expect(fAt).toBeCloseTo(at * at, 2);
    expect(areaAt).toBeCloseTo((at * at * at) / 3, 2);
  });
});

describe('assembleFtcScene — payload', () => {
  it('threads faces + tracers, front camera first, no surfaces channel', () => {
    const payload = assembleFtcScene({ scenario: 'square' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.tracers.length).toBe(2);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('front');
  });
});
