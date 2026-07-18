// applyLatheDetail — the model-level `detail` dial for lathe part-graphs.
// The taming contract under test: hero masses gain resolution ahead of detail
// beads (size-weighted), the total stays under the face budget (added
// resolution damps, authored counts never reduce), and detail absent/≤1 is a
// strict no-op (same array back — byte-identical renders).

import { describe, it, expect } from 'vitest';
import { applyLatheDetail, LATHE_DETAIL_FACE_BUDGET } from './lathe.js';

const lathe = (len, maxR, crossSections, samples) => ({
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: len, y: 0, z: 0 },
  profile: [{ t: 0, radius: maxR * 0.3 }, { t: 0.5, radius: maxR }, { t: 1, radius: maxR * 0.3 }],
  ...(crossSections !== undefined ? { crossSections } : {}),
  ...(samples !== undefined ? { samples } : {}),
});

const faces = (specs) => specs.reduce(
  (sum, s) => sum + (s.crossSections ?? 24) * (s.samples ?? 36),
  0,
);

describe('applyLatheDetail', () => {
  it('is a strict no-op when detail is absent, 1, or invalid', () => {
    const specs = [lathe(3, 1, 28, 34), lathe(0.2, 0.09, 14, 16)];
    expect(applyLatheDetail(specs, undefined)).toBe(specs);
    expect(applyLatheDetail(specs, 1)).toBe(specs);
    expect(applyLatheDetail(specs, 0)).toBe(specs);
    expect(applyLatheDetail(specs, 'high')).toBe(specs);
    expect(applyLatheDetail([], 2)).toEqual([]);
  });

  it('boosts hero masses more than detail beads', () => {
    const hero = lathe(3, 1, 28, 34);
    const bead = lathe(0.2, 0.09, 14, 16);
    const [heroOut, beadOut] = applyLatheDetail([hero, bead], 2);
    const heroGain = heroOut.crossSections / hero.crossSections;
    const beadGain = (beadOut.crossSections ?? bead.crossSections) / bead.crossSections;
    expect(heroGain).toBeCloseTo(2, 1); // the biggest mass gets the full dial
    expect(heroGain).toBeGreaterThan(beadGain + 0.5);
    expect(beadGain).toBeGreaterThanOrEqual(1); // never below authored
  });

  it('does not mutate the input specs', () => {
    const specs = [lathe(3, 1, 28, 34)];
    const before = JSON.stringify(specs);
    applyLatheDetail(specs, 2);
    expect(JSON.stringify(specs)).toBe(before);
  });

  it('damps the added resolution to stay near the face budget', () => {
    // 30 equal hero masses at 48×64 = ~92k authored; detail 4 undamped would
    // be ~1.5M — damping must land the total back near the budget.
    const specs = Array.from({ length: 30 }, () => lathe(3, 1, 48, 64));
    const out = applyLatheDetail(specs, 4);
    // The damping iteration is convergent-approximate (integer rounding), so
    // allow a 10% overshoot of the soft budget.
    expect(faces(out)).toBeLessThanOrEqual(LATHE_DETAIL_FACE_BUDGET * 1.1);
    expect(faces(out)).toBeGreaterThanOrEqual(faces(specs)); // never below authored
  });

  it('leaves an already-over-budget authored model at its authored counts', () => {
    const specs = Array.from({ length: 10 }, () => lathe(3, 1, 256, 512));
    const out = applyLatheDetail(specs, 2);
    for (let i = 0; i < specs.length; i += 1) {
      expect(out[i].crossSections).toBe(specs[i].crossSections);
      expect(out[i].samples).toBe(specs[i].samples);
    }
  });

  it('clamps the dial at LATHE_DETAIL_MAX and respects sampler caps', () => {
    const out = applyLatheDetail([lathe(3, 1, 200, 900)], 16);
    expect(out[0].crossSections).toBeLessThanOrEqual(256);
    expect(out[0].samples).toBeLessThanOrEqual(1024);
  });
});
