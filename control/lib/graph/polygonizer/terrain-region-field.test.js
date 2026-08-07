import { describe, it, expect } from 'vitest';
import { validateFields, buildFieldResolver, FIELD_KINDS } from './fields.js';

function evalField(fields, id, p) {
  return buildFieldResolver(fields, [])(id)(p);
}

describe('terrain-region field', () => {
  it('is registered in the closed field-kind set', () => {
    expect(FIELD_KINDS).toContain('terrain-region');
  });

  const region = {
    hill: {
      kind: 'terrain-region',
      center: { x: 0, y: 0, z: 0 },
      radius: 10,
      peak: 6,
      waves: [{ amplitude: 0.5, cycles: { u: 2, v: 2 } }],
    },
  };

  it('validates a well-formed region and rejects a bad one', () => {
    expect(validateFields(region, [])).toEqual([]);
    const bad = { r: { kind: 'terrain-region', center: { x: 0, y: 0, z: 0 }, radius: -1 } };
    expect(validateFields(bad, []).some((e) => e.includes('radius'))).toBe(true);
    const badFalloff = { r: { kind: 'terrain-region', center: { x: 0, y: 0, z: 0 }, radius: 5, falloff: 'sharp' } };
    expect(validateFields(badFalloff, []).some((e) => e.includes('falloff'))).toBe(true);
  });

  it('INVARIANT 2 — reaches exactly 0 at and beyond the border (grounded)', () => {
    // At radius the window is 0, so the whole contribution vanishes.
    expect(evalField(region, 'hill', { x: 10, y: 0, z: 0 })).toBe(0);
    expect(evalField(region, 'hill', { x: 20, y: 0, z: 0 })).toBe(0);
    expect(evalField(region, 'hill', { x: 0, y: -10, z: 0 })).toBe(0);
  });

  it('INVARIANT 2 — smooth falloff has no crease (small step near the border)', () => {
    // smootherstep has zero slope at t=1, so values just inside the border
    // are already tiny — the join to baseline is flat, not a linear crease.
    const justInside = Math.abs(evalField(region, 'hill', { x: 9.7, y: 0, z: 0 }));
    expect(justInside).toBeLessThan(0.25);
  });

  it('peaks near the landform amplitude at the center', () => {
    // At center the window is 1; tex contributes sin terms, so the value
    // is peak ± wave amplitude. With peak 6 and amp 0.5, stay in [5.5, 6.5].
    const v = evalField(region, 'hill', { x: 0, y: 0, z: 0 });
    expect(v).toBeGreaterThan(5.4);
    expect(v).toBeLessThan(6.6);
  });

  it('INVARIANT 1 — distinct regions carry distinct waveforms', () => {
    const fields = {
      rolling: { kind: 'terrain-region', center: { x: 0, y: 0, z: 0 }, radius: 10, peak: 0, waves: [{ amplitude: 1, cycles: { u: 1, v: 0 } }] },
      jagged: { kind: 'terrain-region', center: { x: 0, y: 0, z: 0 }, radius: 10, peak: 0, waves: [{ amplitude: 1, cycles: { u: 6, v: 0 } }] },
    };
    const p = { x: 2.5, y: 0, z: 0 };
    expect(evalField(fields, 'rolling', p)).not.toBeCloseTo(evalField(fields, 'jagged', p), 3);
  });

  it('sum of two overlapping regions is continuous across a border (no fold-up)', () => {
    const fields = {
      a: { kind: 'terrain-region', center: { x: -4, y: 0, z: 0 }, radius: 10, peak: 5, waves: [{ amplitude: 0.6, cycles: { u: 3, v: 1 } }] },
      b: { kind: 'terrain-region', center: { x: 4, y: 0, z: 0 }, radius: 10, peak: 3, waves: [{ amplitude: 0.4, cycles: { u: 5, v: 2 } }] },
      terrain: { kind: 'sum', components: [{ field: 'a' }, { field: 'b' }] },
    };
    const resolve = buildFieldResolver(fields, [])('terrain');
    // Sample densely across the x axis; no adjacent pair should jump more
    // than a small epsilon (the field is C0 everywhere, C1 at borders).
    let prev = resolve({ x: -16, y: 0, z: 0 });
    let maxJump = 0;
    for (let x = -16; x <= 16; x += 0.1) {
      const cur = resolve({ x, y: 0, z: 0 });
      maxJump = Math.max(maxJump, Math.abs(cur - prev));
      prev = cur;
    }
    expect(maxJump).toBeLessThan(0.2);
  });
});
