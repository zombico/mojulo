import { describe, expect, it } from 'vitest';

import { planProbabilityScene, assembleProbabilityScene, PROBABILITY_SCENARIOS } from './probability-view.js';

// recover a bin bar's height from its face (the quad's top z).
const barHeights = (plan, n) => {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const f = plan.faces.find((q) => q.group === `bin:${k}`);
    out.push(Math.max(...f.corners.map((c) => c[2])));
  }
  return out;
};

describe('planProbabilityScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planProbabilityScene({ scenario: 'classic' }))).toBe(JSON.stringify(planProbabilityScene({ scenario: 'classic' })));
  });

  it('falls back to classic on an unknown scenario', () => {
    expect(planProbabilityScene({ scenario: 'wormhole' }).stats.scenario).toBe('classic');
  });

  it('exposes the four scenarios', () => {
    expect(PROBABILITY_SCENARIOS).toEqual(['few', 'classic', 'tall', 'skew']);
  });

  it('builds n+1 bins, a peg triangle, a Gaussian overlay, and falling balls', () => {
    const plan = planProbabilityScene({ scenario: 'classic' });
    expect(plan.faces.filter((f) => f.group.startsWith('bin:'))).toHaveLength(13);   // n+1 = 13
    expect(plan.faces.filter((f) => f.group === 'pegs').length).toBeGreaterThan(50); // 1+2+…+12 = 78
    expect(plan.faces.some((f) => f.group === 'gaussian')).toBe(true);
    expect(plan.tracers.length).toBeGreaterThan(0);
  });
});

describe('probability-view — the distribution is the real binomial (the statistics)', () => {
  it('few: the bar heights are proportional to C(6,k) = 1,6,15,20,15,6,1', () => {
    const h = barHeights(planProbabilityScene({ scenario: 'few' }), 6);
    const C = [1, 6, 15, 20, 15, 6, 1], peak = Math.max(...C);
    h.forEach((hk, k) => expect(hk / Math.max(...h)).toBeCloseTo(C[k] / peak, 5));
  });

  it('fair boards are symmetric and peak at the centre; the mean is n/2', () => {
    const c = planProbabilityScene({ scenario: 'classic' }).stats;
    expect(c.mean).toBeCloseTo(6); expect(c.peakBin).toBe(6);
  });

  it('skew (p=0.66): the bell shifts right of centre — mean np > n/2', () => {
    const s = planProbabilityScene({ scenario: 'skew' }).stats;
    expect(s.mean).toBeGreaterThan(s.rows / 2);
    expect(s.peakBin).toBeGreaterThan(s.rows / 2);
  });

  it('more rows ⇒ a tighter relative spread (σ/n shrinks — the CLT sharpening)', () => {
    const a = planProbabilityScene({ scenario: 'classic' }).stats;   // n=12
    const b = planProbabilityScene({ scenario: 'tall' }).stats;      // n=20
    expect(b.sigma / b.rows).toBeLessThan(a.sigma / a.rows);
  });
});

describe('assembleProbabilityScene — payload', () => {
  it('threads faces + tracers + readout, front camera first, no surfaces', () => {
    const payload = assembleProbabilityScene({ scenario: 'tall' });
    expect(payload.faces.length).toBeGreaterThan(100);
    expect(payload.tracers.length).toBeGreaterThan(0);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('front');
  });
});
