import { describe, expect, it } from 'vitest';

import { planQuadraticScene, assembleQuadraticScene, QUADRATIC_SCENARIOS } from './quadratic-view.js';

describe('planQuadraticScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planQuadraticScene({ scenario: 'two' }))).toBe(JSON.stringify(planQuadraticScene({ scenario: 'two' })));
  });

  it('falls back to two on an unknown scenario', () => {
    expect(planQuadraticScene({ scenario: 'cubic' }).stats.scenario).toBe('two');
  });

  it('exposes the four scenarios', () => {
    expect(QUADRATIC_SCENARIOS).toEqual(['two', 'double', 'none', 'down']);
  });
});

describe('quadratic-view — discriminant & roots (the math)', () => {
  it('two: Δ > 0 and exactly two real roots that satisfy a·r²+b·r+c ≈ 0', () => {
    const { a, b, c, disc, roots } = planQuadraticScene({ scenario: 'two' }).stats;
    expect(disc).toBeGreaterThan(0);
    expect(roots).toHaveLength(2);
    for (const r of roots) expect(a * r * r + b * r + c).toBeCloseTo(0, 4);
  });

  it('double: Δ ≈ 0 and exactly one (double) root, equal to the vertex x', () => {
    const { disc, roots, vertex } = planQuadraticScene({ scenario: 'double' }).stats;
    expect(disc).toBeCloseTo(0, 6);
    expect(roots).toHaveLength(1);
    expect(roots[0]).toBeCloseTo(vertex[0], 6);
  });

  it('none: Δ < 0 and zero roots (parabola floats above the axis)', () => {
    const { disc, roots } = planQuadraticScene({ scenario: 'none' }).stats;
    expect(disc).toBeLessThan(0);
    expect(roots).toHaveLength(0);
  });

  it('down: the leading coefficient a < 0', () => {
    expect(planQuadraticScene({ scenario: 'down' }).stats.a).toBeLessThan(0);
  });

  it('explicit {a:1, b:0, c:-4} gives roots ≈ -2 and 2', () => {
    const roots = planQuadraticScene({ scenario: 'two', a: 1, b: 0, c: -4 }).stats.roots;
    expect(roots).toHaveLength(2);
    expect(roots[0]).toBeCloseTo(-2, 6);
    expect(roots[1]).toBeCloseTo(2, 6);
  });
});

describe('assembleQuadraticScene — payload', () => {
  it('threads faces + tracers, front camera first, no surfaces channel', () => {
    const payload = assembleQuadraticScene({ scenario: 'two' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.tracers.length).toBeGreaterThan(0);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('front');
  });
});
