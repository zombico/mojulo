/**
 * Tests for the three landscape-followup substrate additions:
 *   - noise field kind (deterministic, octave summing, seed isolation)
 *   - sum field combinator (weighted summation, cycle detection)
 *   - wave-field primitive accepts inline {x,y,z} corners
 *
 * Design: lite-template/integration/0605/landscape-followups.plan.md.
 */

import { describe, it, expect } from 'vitest';

import {
  buildFieldResolver,
  validateFields,
  FIELD_KINDS,
} from './fields.js';
import { validateWaveFields } from './wave-field.js';
import { walkManjiTree3D } from './manji-program.js';

// ─── FIELD_KINDS membership ───────────────────────────────────────────

describe('FIELD_KINDS — noise + sum join the substrate', () => {
  it('includes noise and sum in the enum', () => {
    expect(FIELD_KINDS).toContain('noise');
    expect(FIELD_KINDS).toContain('sum');
  });
});

// ─── noise field validation ───────────────────────────────────────────

describe('validateFields — noise kind', () => {
  it('accepts a minimal noise field', () => {
    expect(validateFields({ n: { kind: 'noise', seed: 'mountains' } }, [])).toEqual([]);
  });

  it('accepts noise with no explicit seed (defaults apply)', () => {
    expect(validateFields({ n: { kind: 'noise' } }, [])).toEqual([]);
  });

  it('rejects non-string non-number seed', () => {
    const errors = validateFields({ n: { kind: 'noise', seed: { complex: true } } }, []);
    expect(errors[0]).toMatch(/seed: must be a string or finite number/);
  });

  it('rejects non-finite numeric params', () => {
    const errors = validateFields({
      n: { kind: 'noise', amplitude: NaN },
    }, []);
    expect(errors[0]).toMatch(/amplitude: must be a finite number/);
  });

  it('rejects octaves out of range', () => {
    const errors = validateFields({
      n: { kind: 'noise', octaves: 0 },
    }, []);
    expect(errors[0]).toMatch(/octaves: must be an integer in \[1, 12\]/);
  });
});

// ─── noise field evaluation ────────────────────────────────────────────

describe('buildFieldResolver — noise evaluator', () => {
  it('is deterministic — same seed + same position gives same value', () => {
    const resolver = buildFieldResolver({
      n: { kind: 'noise', seed: 'fixed', scale: 0.1 },
    }, []);
    const f = resolver('n');
    const v1 = f({ x: 3.14, y: -2.71, z: 0 });
    const v2 = f({ x: 3.14, y: -2.71, z: 0 });
    expect(v1).toBe(v2);
  });

  it('different seeds produce different values at the same position', () => {
    const r = buildFieldResolver({
      a: { kind: 'noise', seed: 'one' },
      b: { kind: 'noise', seed: 'two' },
    }, []);
    const va = r('a')({ x: 5, y: 5, z: 0 });
    const vb = r('b')({ x: 5, y: 5, z: 0 });
    expect(va).not.toBe(vb);
  });

  it('returns values in roughly [-amplitude, amplitude] + offset', () => {
    const resolver = buildFieldResolver({
      n: { kind: 'noise', seed: 'range-check', scale: 0.5, amplitude: 2, offset: 10 },
    }, []);
    const f = resolver('n');
    const samples = [];
    for (let i = 0; i < 200; i += 1) {
      samples.push(f({ x: i * 0.3, y: i * 0.7, z: 0 }));
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    // Octave summing means we don't hit ±amplitude exactly, but we
    // should be in a reasonable range around the offset.
    expect(min).toBeGreaterThan(10 - 2 - 0.5);
    expect(max).toBeLessThan(10 + 2 + 0.5);
  });

  it('ignores the z component (2D noise on the xy plane)', () => {
    const resolver = buildFieldResolver({
      n: { kind: 'noise', seed: 'flat' },
    }, []);
    const f = resolver('n');
    const v0 = f({ x: 1, y: 2, z: 0 });
    const v1 = f({ x: 1, y: 2, z: 100 });
    const v2 = f({ x: 1, y: 2, z: -50 });
    expect(v1).toBe(v0);
    expect(v2).toBe(v0);
  });
});

// ─── sum field validation ──────────────────────────────────────────────

describe('validateFields — sum kind', () => {
  it('accepts a minimal sum referencing declared fields', () => {
    expect(validateFields({
      a: { kind: 'constant', value: 1 },
      b: { kind: 'constant', value: 2 },
      total: { kind: 'sum', components: [{ field: 'a' }, { field: 'b' }] },
    }, [])).toEqual([]);
  });

  it('rejects empty / missing components', () => {
    const noComp = validateFields({ s: { kind: 'sum' } }, []);
    expect(noComp[0]).toMatch(/components: must be a non-empty array/);
    const empty = validateFields({ s: { kind: 'sum', components: [] } }, []);
    expect(empty[0]).toMatch(/components: must be a non-empty array/);
  });

  it('rejects a component referencing an undeclared field', () => {
    const errors = validateFields({
      a: { kind: 'constant', value: 1 },
      s: { kind: 'sum', components: [{ field: 'a' }, { field: 'missing' }] },
    }, []);
    expect(errors[0]).toMatch(/unknown field 'missing'/);
  });

  it('rejects non-finite weight', () => {
    const errors = validateFields({
      a: { kind: 'constant', value: 1 },
      s: { kind: 'sum', components: [{ field: 'a', weight: 'half' }] },
    }, []);
    expect(errors[0]).toMatch(/weight: must be a finite number/);
  });

  it('catches a direct self-reference cycle', () => {
    const errors = validateFields({
      s: { kind: 'sum', components: [{ field: 's' }] },
    }, []);
    expect(errors[0]).toMatch(/cycle detected through sum field — s → s/);
  });

  it('catches a transitive cycle', () => {
    const errors = validateFields({
      a: { kind: 'sum', components: [{ field: 'b' }] },
      b: { kind: 'sum', components: [{ field: 'c' }] },
      c: { kind: 'sum', components: [{ field: 'a' }] },
    }, []);
    // The detector reports the cycle starting from whichever field it
    // visits first — either a, b, or c; assert it's present and closes.
    const cycleMsg = errors.find((e) => /cycle detected/.test(e));
    expect(cycleMsg).toBeTruthy();
    expect(cycleMsg).toMatch(/cycle detected through sum field — (a → b → c → a|b → c → a → b|c → a → b → c)/);
  });
});

// ─── sum field evaluation ──────────────────────────────────────────────

describe('buildFieldResolver — sum evaluator', () => {
  it('sums components with default weight 1', () => {
    const resolver = buildFieldResolver({
      a: { kind: 'constant', value: 3 },
      b: { kind: 'constant', value: 5 },
      total: { kind: 'sum', components: [{ field: 'a' }, { field: 'b' }] },
    }, []);
    const f = resolver('total');
    expect(f({ x: 0, y: 0, z: 0 })).toBe(8);
  });

  it('applies per-component weights', () => {
    const resolver = buildFieldResolver({
      a: { kind: 'constant', value: 10 },
      b: { kind: 'constant', value: 10 },
      weighted: { kind: 'sum', components: [
        { field: 'a', weight: 0.5 },
        { field: 'b', weight: -0.25 },
      ] },
    }, []);
    expect(resolver('weighted')({ x: 0, y: 0, z: 0 })).toBeCloseTo(10 * 0.5 + 10 * -0.25, 10);
  });

  it('applies the optional offset', () => {
    const resolver = buildFieldResolver({
      a: { kind: 'constant', value: 1 },
      shifted: { kind: 'sum', components: [{ field: 'a' }], offset: 5 },
    }, []);
    expect(resolver('shifted')({ x: 0, y: 0, z: 0 })).toBe(6);
  });

  it('composes sum-of-sums (one sum field references another)', () => {
    const resolver = buildFieldResolver({
      a: { kind: 'constant', value: 2 },
      b: { kind: 'constant', value: 3 },
      ab: { kind: 'sum', components: [{ field: 'a' }, { field: 'b' }] }, // 5
      c: { kind: 'constant', value: 7 },
      total: { kind: 'sum', components: [{ field: 'ab' }, { field: 'c' }] }, // 12
    }, []);
    expect(resolver('total')({ x: 0, y: 0, z: 0 })).toBe(12);
  });
});

// ─── wave-field primitive accepts inline corners ──────────────────────

describe('validateWaveFields — inline {x,y,z} corners', () => {
  it('accepts a 4-corner inline spec', () => {
    expect(validateWaveFields([
      {
        corners: [
          { x: -1, y: -1, z: 0 },
          { x:  1, y: -1, z: 0 },
          { x:  1, y:  1, z: 0 },
          { x: -1, y:  1, z: 0 },
        ],
      },
    ], [])).toEqual([]);
  });

  it('still accepts endpoint-path corners', () => {
    const emitted = walkManjiTree3D({
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [
        { id: 'NW', position: { x: -5, y: -5, z: 0 } },
        { id: 'NE', position: { x:  5, y: -5, z: 0 } },
        { id: 'SE', position: { x:  5, y:  5, z: 0 } },
        { id: 'SW', position: { x: -5, y:  5, z: 0 } },
      ],
    });
    expect(validateWaveFields([
      {
        corners: ['world/slot/NW', 'world/slot/NE', 'world/slot/SE', 'world/slot/SW'],
      },
    ], emitted)).toEqual([]);
  });

  it('accepts a mix of inline and path corners', () => {
    const emitted = walkManjiTree3D({
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [{ id: 'pin', position: { x: 0, y: 0, z: 0 } }],
    });
    expect(validateWaveFields([
      {
        corners: [
          { x: -5, y: -5, z: 0 },
          'world/slot/pin',
          { x:  5, y:  5, z: 0 },
          { x: -5, y:  5, z: 0 },
        ],
      },
    ], emitted)).toEqual([]);
  });

  it('rejects a missing corner (non-vec non-string)', () => {
    const errors = validateWaveFields([
      { corners: [{ x: 0, y: 0, z: 0 }, null, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }] },
    ], []);
    expect(errors[0]).toMatch(/corners\[1\]/);
  });
});
