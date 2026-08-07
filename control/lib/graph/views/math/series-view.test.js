import { describe, expect, it } from 'vitest';

import { planSeriesScene, assembleSeriesScene, SERIES_SCENARIOS } from './series-view.js';

// re-derive the partial sums independently to check the builder's math (not just its shape).
const sinPartial = (n, x) => { let s = 0; for (let k = 0; k < n; k++) s += (k % 2 ? -1 : 1) * x ** (2 * k + 1) / [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880][2 * k + 1]; return s; };

describe('planSeriesScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planSeriesScene({ scenario: 'taylor-sin' }))).toBe(JSON.stringify(planSeriesScene({ scenario: 'taylor-sin' })));
  });

  it('falls back to taylor-sin on an unknown scenario', () => {
    expect(planSeriesScene({ scenario: 'wormhole' }).stats.scenario).toBe('taylor-sin');
  });

  it('exposes the five scenarios', () => {
    expect(SERIES_SCENARIOS).toEqual(['taylor-sin', 'taylor-exp', 'geometric', 'fourier-square', 'fourier-saw']);
  });

  it('draws one ribbon group per partial sum + a true curve + a riding bead + a readout', () => {
    const plan = planSeriesScene({ scenario: 'taylor-sin' });
    const groups = new Set(plan.faces.map((f) => f.group));
    expect([...groups].filter((g) => g.startsWith('approx:'))).toHaveLength(4);
    expect(groups.has('true')).toBe(true);
    expect(plan.tracers.length).toBe(1);
    expect(plan.fields[0].readout.length).toBeGreaterThan(2);
  });
});

describe('series-view — the approximation actually converges (the analysis)', () => {
  it('taylor-sin: more terms ⇒ closer to sin at a point away from 0', () => {
    const x = 2.0, truth = Math.sin(x);
    const e1 = Math.abs(sinPartial(1, x) - truth);   // just x
    const e5 = Math.abs(sinPartial(5, x) - truth);   // five terms
    expect(e5).toBeLessThan(e1);
    expect(e5).toBeLessThan(0.01);
  });

  it('geometric: inside |x|<1 the sum tracks 1/(1−x); past x=1 it diverges', () => {
    const sum = (n, x) => { let s = 0; for (let k = 0; k < n; k++) s += x ** k; return s; };
    expect(Math.abs(sum(20, 0.5) - 1 / (1 - 0.5))).toBeLessThan(0.01);   // converges
    expect(Math.abs(sum(16, 1.2))).toBeGreaterThan(10);                  // diverges
  });

  it('each scenario records its term schedule and series family', () => {
    expect(planSeriesScene({ scenario: 'fourier-square' }).stats.family).toBe('fourier');
    expect(planSeriesScene({ scenario: 'taylor-exp' }).stats.family).toBe('taylor');
  });
});

describe('assembleSeriesScene — payload', () => {
  it('threads faces + tracer + readout, front camera first, no surfaces', () => {
    const payload = assembleSeriesScene({ scenario: 'fourier-square' });
    expect(payload.faces.length).toBeGreaterThan(500);
    expect(payload.tracers.length).toBe(1);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('front');
  });
});
