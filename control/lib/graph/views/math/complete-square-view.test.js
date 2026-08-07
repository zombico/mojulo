import { describe, expect, it } from 'vitest';

import { planCompleteSquareScene, assembleCompleteSquareScene, COMPLETE_SQUARE_SCENARIOS } from './complete-square-view.js';

describe('planCompleteSquareScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planCompleteSquareScene({ scenario: 'square', x: 3, b: 4 }))).toBe(JSON.stringify(planCompleteSquareScene({ scenario: 'square', x: 3, b: 4 })));
  });

  it('falls back to square on an unknown scenario', () => {
    expect(planCompleteSquareScene({ scenario: 'huge' }).stats.scenario).toBe('square');
  });

  it('exposes the three scenarios', () => {
    expect(COMPLETE_SQUARE_SCENARIOS).toEqual(['narrow', 'square', 'wide']);
  });

  it('every face is a 4-corner quad', () => {
    for (const f of planCompleteSquareScene({ scenario: 'square', x: 3, b: 4 }).faces) {
      expect(f.corners).toHaveLength(4);
    }
  });
});

describe('complete-square-view — x² + bx = (x + b/2)² − (b/2)² (the math)', () => {
  it('for {x:3, b:4}: corner = (b/2)² = 4 and completedSide = x + b/2 = 5', () => {
    const { corner, completedSide } = planCompleteSquareScene({ scenario: 'square', x: 3, b: 4 }).stats;
    expect(corner).toBeCloseTo(4, 6);
    expect(completedSide).toBeCloseTo(5, 6);
  });

  it('the identity closes: x² + bx + (b/2)² = (x + b/2)²', () => {
    const x = 3, b = 4;
    const { corner, completedSide } = planCompleteSquareScene({ scenario: 'square', x, b }).stats;
    expect(x * x + b * x + corner).toBeCloseTo(completedSide * completedSide, 6);
  });
});

describe('complete-square-view — face groups', () => {
  it('emits the x² tile (sq), the two bx strips (stripR, stripT), and the completion corner', () => {
    const groups = new Set(planCompleteSquareScene({ scenario: 'square', x: 3, b: 4 }).faces.map((f) => f.group));
    expect(groups.has('sq')).toBe(true);
    expect(groups.has('stripR')).toBe(true);
    expect(groups.has('stripT')).toBe(true);
    expect(groups.has('corner')).toBe(true);
  });
});

describe('assembleCompleteSquareScene — payload', () => {
  it('first camera is named front', () => {
    expect(assembleCompleteSquareScene({ scenario: 'square' }).cameras[0].name).toBe('front');
  });
});
