import { describe, expect, it } from 'vitest';

import { planPythagorasScene, assemblePythagorasScene, PYTHAGORAS_SCENARIOS } from './pythagoras-view.js';

describe('planPythagorasScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planPythagorasScene({ scenario: 'squares', a: 3, b: 4 }))).toBe(JSON.stringify(planPythagorasScene({ scenario: 'squares', a: 3, b: 4 })));
  });

  it('falls back to squares on an unknown scenario', () => {
    expect(planPythagorasScene({ scenario: 'tiling' }).stats.scenario).toBe('squares');
  });

  it('exposes the two scenarios', () => {
    expect(PYTHAGORAS_SCENARIOS).toEqual(['squares', 'dissection']);
  });

  it('every face is padded to a 4-corner quad (the renderer drops <4-corner faces)', () => {
    for (const scen of PYTHAGORAS_SCENARIOS) {
      for (const f of planPythagorasScene({ scenario: scen, a: 3, b: 4 }).faces) {
        expect(f.corners).toHaveLength(4);
      }
    }
  });
});

describe('pythagoras-view — a² + b² = c² (the math)', () => {
  it('for the 3-4-5 triangle: aSq=9, bSq=16, cSq=25, and a²+b²=c²', () => {
    const { aSq, bSq, cSq } = planPythagorasScene({ scenario: 'squares', a: 3, b: 4 }).stats;
    expect(aSq).toBe(9);
    expect(bSq).toBe(16);
    expect(cSq).toBeCloseTo(25, 6);
    expect(aSq + bSq).toBeCloseTo(cSq, 6);
  });
});

describe('pythagoras-view — face groups per scenario', () => {
  it('squares: emits sqA, sqB, sqC squares and a triangle', () => {
    const groups = new Set(planPythagorasScene({ scenario: 'squares', a: 3, b: 4 }).faces.map((f) => f.group));
    expect(groups.has('sqA')).toBe(true);
    expect(groups.has('sqB')).toBe(true);
    expect(groups.has('sqC')).toBe(true);
    expect(groups.has('tri')).toBe(true);
  });

  it('dissection: 4 triangle faces (tri) + an inner square (inner), and NO big fill group', () => {
    const faces = planPythagorasScene({ scenario: 'dissection', a: 3, b: 4 }).faces;
    expect(faces.filter((f) => f.group === 'tri')).toHaveLength(4);
    expect(faces.filter((f) => f.group === 'inner')).toHaveLength(1);
    expect(faces.some((f) => f.group === 'big')).toBe(false);
  });
});

describe('assemblePythagorasScene — payload', () => {
  it('first camera is named front', () => {
    expect(assemblePythagorasScene({ scenario: 'squares' }).cameras[0].name).toBe('front');
  });
});
