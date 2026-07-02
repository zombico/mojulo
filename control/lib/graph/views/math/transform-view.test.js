import { describe, expect, it } from 'vitest';

import {
  classifyMatrix, planTransformScene, assembleTransformScene, TRANSFORM_SCENARIOS,
} from './transform-view.js';

const EPS = 1e-6;

describe('classifyMatrix — closed-form linear algebra (hand-worked cases)', () => {
  it('eigenbasis [[2,1],[1,2]]: real eigenvalues 3, 1 on the diagonals', () => {
    const r = classifyMatrix([[2, 1], [1, 2]]);
    expect(r.det).toBeCloseTo(3);
    expect(r.trace).toBeCloseTo(4);
    expect(r.rank).toBe(2);
    expect(r.kind).toBe('real-distinct');
    expect(r.eigen.map((e) => e.lambda).sort((a, b) => a - b)).toEqual([expect.closeTo(1), expect.closeTo(3)]);
    const e3 = r.eigen.find((e) => Math.abs(e.lambda - 3) < EPS);
    expect(Math.abs(e3.vector[0])).toBeCloseTo(Math.abs(e3.vector[1])); // along [1,1]
    expect(r.singular[0]).toBeCloseTo(3); expect(r.singular[1]).toBeCloseTo(1); // symmetric ⇒ σ = |λ|
  });

  it('scale [[2,0],[0,½]]: eigenvectors on the axes; σ = 2, ½; area preserved', () => {
    const r = classifyMatrix([[2, 0], [0, 0.5]]);
    expect(r.det).toBeCloseTo(1);
    expect(r.singular).toEqual([expect.closeTo(2), expect.closeTo(0.5)]);
  });

  it('shear [[1,1],[0,1]]: DEFECTIVE — one repeated eigenvalue, a single eigenvector, σ = φ, 1/φ', () => {
    const r = classifyMatrix([[1, 1], [0, 1]]);
    expect(r.det).toBeCloseTo(1);
    expect(r.kind).toBe('defective');
    expect(r.eigen).toHaveLength(1);
    expect(r.eigen[0].lambda).toBeCloseTo(1);
    expect(r.eigen[0].vector.map((v) => Math.abs(v))).toEqual([expect.closeTo(1), expect.closeTo(0)]);
    expect(r.singular[0] * r.singular[1]).toBeCloseTo(1); // σ₁σ₂ = |det|
  });

  it('rotation R(35°): COMPLEX eigenvalues, NO real eigenvector', () => {
    const t = (35 * Math.PI) / 180, M = [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]];
    const r = classifyMatrix(M);
    expect(r.kind).toBe('complex');
    expect(r.eigen.every((e) => e.vector === null)).toBe(true);
    expect(Math.abs(r.eigen[0].imag)).toBeGreaterThan(0.1);
    expect(r.singular).toEqual([expect.closeTo(1), expect.closeTo(1)]); // orthogonal ⇒ σ = 1
  });

  it('projection [[1,0],[0,0]]: det 0, rank 1, σ₂ = 0, kernel along [0,1]', () => {
    const r = classifyMatrix([[1, 0], [0, 0]]);
    expect(r.det).toBeCloseTo(0);
    expect(r.rank).toBe(1);
    expect(r.singular[1]).toBeCloseTo(0);
    const e0 = r.eigen.find((e) => Math.abs(e.lambda) < EPS);  // λ=0 ⇒ the collapsed direction
    expect(e0.vector.map((v) => Math.abs(v))).toEqual([expect.closeTo(0), expect.closeTo(1)]);
  });

  it('reflection [[0,1],[1,0]]: det < 0 — orientation reversed', () => {
    expect(classifyMatrix([[0, 1], [1, 0]]).det).toBeCloseTo(-1);
  });
});

describe('planTransformScene — determinism, scenarios, picks', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planTransformScene({ scenario: 'eigenbasis' });
    const b = planTransformScene({ scenario: 'eigenbasis' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to eigenbasis on an unknown scenario', () => {
    expect(planTransformScene({ scenario: 'wormhole' }).stats.scenario).toBe('eigenbasis');
  });

  it('an explicit matrix is auto-classified and overrides the scenario preset', () => {
    const plan = planTransformScene({ scenario: 'scale', matrix: [[2, 1], [1, 2]] });
    expect(plan.stats.scenario).toBe('custom');
    expect(plan.stats.det).toBeCloseTo(3);
  });

  it('every scenario emits a readout and at least one pick', () => {
    for (const s of TRANSFORM_SCENARIOS) {
      const plan = planTransformScene({ scenario: s });
      expect(plan.fields[0].readout.length).toBeGreaterThan(2);
      expect(plan.picks.length).toBeGreaterThan(0);
    }
  });

  it('rotation emits no eigen-ray group (complex); eigenbasis emits two', () => {
    expect(planTransformScene({ scenario: 'rotation' }).morphGroups.filter((g) => g.startsWith('eig:'))).toHaveLength(0);
    expect(planTransformScene({ scenario: 'eigenbasis' }).morphGroups.filter((g) => g.startsWith('eig:'))).toHaveLength(2);
  });
});

describe('transform-view morph wiring (deform channel)', () => {
  it('animate (default) carries every image group identity → A on the deform channel', () => {
    const payload = assembleTransformScene({ scenario: 'eigenbasis' });
    expect(payload.deforms.length).toBe(7);
    expect(payload.deforms.every((d) => d.mode === 'morph')).toBe(true);
    // `to` is the matrix A itself (the deform channel embeds 2×2 → 3×3).
    expect(payload.deforms[0].to).toEqual([[2, 1], [1, 2]]);
    expect(payload.deforms.map((d) => d.group)).toEqual(['grid:img', 'det', 'svd', 'i:img', 'j:img', 'eig:0', 'eig:1']);
  });

  it('animate:false bakes the final A statically — no deform channel', () => {
    const payload = assembleTransformScene({ scenario: 'eigenbasis', animate: false });
    expect(payload.deforms).toBeUndefined();
    // baked: the image basis arrow points along the COLUMNS of A. î → column 1 = [2,1] ⇒ slope ½.
    // (Use the arrow's far end via the mean of its outer corners, robust to the arrowhead box size.)
    const corners = payload.faces.filter((f) => f.group === 'i:img').flatMap((f) => f.corners);
    const far = corners.filter((c) => Math.hypot(c[0], c[1]) > 0.6 * Math.max(...corners.map((p) => Math.hypot(p[0], p[1]))));
    const mean = far.reduce((s, c) => [s[0] + c[0], s[1] + c[1]], [0, 0]).map((v) => v / far.length);
    expect(mean[1] / mean[0]).toBeCloseTo(0.5, 1); // first quadrant, slope ≈ ½
  });
});
