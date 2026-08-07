import { describe, expect, it } from 'vitest';

import { planTrigCircleScene, assembleTrigCircleScene, TRIG_SCENARIOS } from './trig-circle-view.js';

describe('planTrigCircleScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planTrigCircleScene({ scenario: 'cosine', angle: 0.7 }))).toBe(JSON.stringify(planTrigCircleScene({ scenario: 'cosine', angle: 0.7 })));
  });

  it('falls back to sine on an unknown scenario', () => {
    expect(planTrigCircleScene({ scenario: 'secant' }).stats.scenario).toBe('sine');
  });

  it('exposes the three scenarios', () => {
    expect(TRIG_SCENARIOS).toEqual(['sine', 'cosine', 'tangent']);
  });

  it('bakes faces + two synced tracers (circle bead + wave bead) + a readout', () => {
    const plan = planTrigCircleScene({ scenario: 'sine', angle: 0.9 });
    expect(plan.faces.length).toBeGreaterThan(0);
    expect(plan.tracers).toHaveLength(2);
    expect(plan.fields[0].readout.length).toBeGreaterThan(2);
  });
});

describe('trig-circle-view — the unit circle (the math)', () => {
  it('the marker cos/sin satisfy cos²θ + sin²θ ≈ 1', () => {
    const { cos, sin } = planTrigCircleScene({ scenario: 'sine', angle: 0.9 }).stats;
    expect(cos * cos + sin * sin).toBeCloseTo(1, 4);
  });

  it('at θ = π/2 the point is at the top: sin ≈ 1, cos ≈ 0', () => {
    const { cos, sin } = planTrigCircleScene({ scenario: 'sine', angle: Math.PI / 2 }).stats;
    expect(sin).toBeCloseTo(1, 3);
    expect(cos).toBeCloseTo(0, 3);
  });
});

describe('assembleTrigCircleScene — payload', () => {
  it('threads faces + tracers + a readout, front camera first, no surfaces channel', () => {
    const payload = assembleTrigCircleScene({ scenario: 'cosine' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.tracers).toHaveLength(2);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('front');
  });
});
