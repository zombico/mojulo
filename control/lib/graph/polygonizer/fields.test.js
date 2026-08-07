/**
 * Unit tests for the scalar-fields module.
 *
 * Covers:
 *   - validateFields: kind enum, finite-number checks, beyond enum,
 *     endpoint-path resolution against an emitted-node table.
 *   - buildFieldResolver + evaluators: constant returns its scalar;
 *     radial interpolates inner→outer; gradient projects + lerps along
 *     the from→to axis; beyond='clamp' (default) and 'extrapolate'
 *     behave differently outside the declared range.
 *   - evaluateScalarOrFieldRef: scalar passthrough, field-ref lookup,
 *     undefined → default, malformed → throw.
 */

import { describe, it, expect } from 'vitest';

import {
  validateFields,
  buildFieldResolver,
  evaluateScalarOrFieldRef,
  nullFieldResolver,
  FIELD_KINDS,
} from './fields.js';
import { walkManjiTree3D } from './manji-program.js';

function singleSlotScene() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'center', position: { x: 0, y: 0, z: 0 } },
      { id: 'east',   position: { x: 10, y: 0, z: 0 } },
    ],
  };
}

describe('FIELD_KINDS — the closed enumerable set', () => {
  it('lists the substrate kinds in stable order', () => {
    expect(FIELD_KINDS).toEqual(['constant', 'radial', 'gradient', 'wave-surface', 'noise', 'sum', 'curve-projection', 'curve-distance', 'terrain-region']);
  });
});

describe('validateFields — mint-time shape check', () => {
  const emitted = walkManjiTree3D(singleSlotScene());

  it('accepts an empty / missing fields block', () => {
    expect(validateFields(undefined, emitted)).toEqual([]);
    expect(validateFields(null, emitted)).toEqual([]);
    expect(validateFields({}, emitted)).toEqual([]);
  });

  it('rejects a non-object fields block', () => {
    const errors = validateFields([], emitted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/`fields` must be an object/);
  });

  it('accepts the three valid kinds', () => {
    const errors = validateFields({
      c: { kind: 'constant', value: 1.5 },
      r: {
        kind: 'radial',
        center: 'world/slot/center',
        innerRadius: 1, innerValue: 2,
        outerRadius: 5, outerValue: 0.5,
      },
      g: {
        kind: 'gradient',
        from: 'world/slot/center', fromValue: 0,
        to: 'world/slot/east', toValue: 10,
      },
    }, emitted);
    expect(errors).toEqual([]);
  });

  it('rejects an unknown kind', () => {
    const errors = validateFields({ bad: { kind: 'magic-curve' } }, emitted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/fields\['bad'\]\.kind: must be one of constant, radial, gradient, wave-surface, noise, sum/);
  });

  it('rejects non-finite constant value', () => {
    expect(validateFields({ c: { kind: 'constant', value: NaN } }, emitted)[0])
      .toMatch(/fields\['c'\]\.value/);
    expect(validateFields({ c: { kind: 'constant' } }, emitted)[0])
      .toMatch(/fields\['c'\]\.value/);
  });

  it('rejects radial with bad endpoint path', () => {
    const errors = validateFields({
      r: { kind: 'radial', center: 'world/slot/missing',
        innerRadius: 1, innerValue: 2, outerRadius: 5, outerValue: 0.5 },
    }, emitted);
    expect(errors[0]).toMatch(/slot 'missing'/);
  });

  it("rejects radial where outerRadius <= innerRadius", () => {
    const errors = validateFields({
      r: { kind: 'radial', center: { x: 0, y: 0, z: 0 },
        innerRadius: 5, innerValue: 2, outerRadius: 5, outerValue: 0.5 },
    }, emitted);
    expect(errors).toContainEqual(expect.stringMatching(/outerRadius must be greater than innerRadius/));
  });

  it("rejects unknown beyond value", () => {
    const errors = validateFields({
      r: { kind: 'radial', center: { x: 0, y: 0, z: 0 },
        innerRadius: 1, innerValue: 2, outerRadius: 5, outerValue: 0.5,
        beyond: 'reflect' },
    }, emitted);
    expect(errors[0]).toMatch(/beyond: must be 'clamp' or 'extrapolate'/);
  });

  it('rejects gradient with non-finite values', () => {
    const errors = validateFields({
      g: { kind: 'gradient', from: { x: 0, y: 0, z: 0 }, fromValue: 'NaN',
        to: { x: 1, y: 0, z: 0 }, toValue: 1 },
    }, emitted);
    expect(errors[0]).toMatch(/fromValue/);
  });
});

describe('buildFieldResolver + evaluators', () => {
  const emitted = walkManjiTree3D(singleSlotScene());
  const fields = {
    flat: { kind: 'constant', value: 1.25 },
    well: {
      kind: 'radial',
      center: { x: 0, y: 0, z: 0 },
      innerRadius: 1, innerValue: 3,
      outerRadius: 5, outerValue: 0.5,
    },
    'well-extrapolate': {
      kind: 'radial',
      center: { x: 0, y: 0, z: 0 },
      innerRadius: 1, innerValue: 3,
      outerRadius: 5, outerValue: 0.5,
      beyond: 'extrapolate',
    },
    ramp: {
      kind: 'gradient',
      from: 'world/slot/center', fromValue: 0,
      to: 'world/slot/east', toValue: 10,
    },
  };
  const resolveField = buildFieldResolver(fields, emitted);

  it('constant returns the same value at any position', () => {
    const f = resolveField('flat');
    expect(f({ x: 0, y: 0, z: 0 })).toBe(1.25);
    expect(f({ x: 1000, y: -1000, z: 1000 })).toBe(1.25);
  });

  it('radial clamps to innerValue inside innerRadius', () => {
    const f = resolveField('well');
    expect(f({ x: 0, y: 0, z: 0 })).toBe(3);
    expect(f({ x: 0.5, y: 0, z: 0 })).toBe(3);
    expect(f({ x: 1, y: 0, z: 0 })).toBe(3);
  });

  it('radial linearly interpolates between innerRadius and outerRadius', () => {
    const f = resolveField('well');
    // r=3 is midway between innerRadius=1 and outerRadius=5 → t=0.5
    // expected = 3 + 0.5*(0.5 - 3) = 1.75
    expect(f({ x: 3, y: 0, z: 0 })).toBeCloseTo(1.75, 10);
  });

  it("radial clamps to outerValue past outerRadius (default beyond='clamp')", () => {
    const f = resolveField('well');
    expect(f({ x: 50, y: 0, z: 0 })).toBe(0.5);
    expect(f({ x: 0, y: 100, z: 0 })).toBe(0.5);
  });

  it("radial extrapolates linearly when beyond='extrapolate'", () => {
    const f = resolveField('well-extrapolate');
    // r=9 → 2 outerRadiuses past inner-to-outer span; linear: outerValue + (r-outerRadius)/denom * (outerValue - innerValue)
    // denom = 5-1 = 4. (9-5)/4 = 1. delta = 0.5 - 3 = -2.5. outerValue + 1*(-2.5) = -2.0
    expect(f({ x: 9, y: 0, z: 0 })).toBeCloseTo(-2.0, 10);
  });

  it('gradient lerps along the from→to axis', () => {
    const f = resolveField('ramp');
    expect(f({ x: 0, y: 0, z: 0 })).toBeCloseTo(0, 10);
    expect(f({ x: 5, y: 0, z: 0 })).toBeCloseTo(5, 10);
    expect(f({ x: 10, y: 0, z: 0 })).toBeCloseTo(10, 10);
  });

  it('gradient projects perpendicular components onto the axis (only axis-aligned component contributes)', () => {
    const f = resolveField('ramp');
    // The from→to axis is +x; y and z components are perpendicular and shouldn't affect the result.
    expect(f({ x: 5, y: 999, z: -999 })).toBeCloseTo(5, 10);
  });

  it("gradient clamps to fromValue / toValue past either endpoint (default beyond='clamp')", () => {
    const f = resolveField('ramp');
    expect(f({ x: -100, y: 0, z: 0 })).toBe(0);
    expect(f({ x: 100, y: 0, z: 0 })).toBe(10);
  });

  it('throws on an unknown field id with the available list', () => {
    expect(() => resolveField('does-not-exist')).toThrow(
      /unknown field 'does-not-exist' \(available: flat, well, well-extrapolate, ramp\)/,
    );
  });

  it('nullFieldResolver throws for any field ref', () => {
    const noFields = nullFieldResolver();
    expect(() => noFields('any')).toThrow(/manifest declares no fields/);
  });
});

describe('evaluateScalarOrFieldRef — the parameter widening helper', () => {
  const fields = { flat: { kind: 'constant', value: 7 } };
  const emitted = walkManjiTree3D(singleSlotScene());
  const resolveField = buildFieldResolver(fields, emitted);

  it('returns the scalar when given a number', () => {
    expect(evaluateScalarOrFieldRef(2.5, resolveField, { x: 0, y: 0, z: 0 }, 1.0))
      .toBe(2.5);
  });

  it('returns the default when given undefined / null', () => {
    expect(evaluateScalarOrFieldRef(undefined, resolveField, { x: 0, y: 0, z: 0 }, 1.0))
      .toBe(1.0);
    expect(evaluateScalarOrFieldRef(null, resolveField, { x: 0, y: 0, z: 0 }, 1.0))
      .toBe(1.0);
  });

  it('resolves a field reference at the given position', () => {
    expect(evaluateScalarOrFieldRef({ field: 'flat' }, resolveField, { x: 0, y: 0, z: 0 }, 1.0))
      .toBe(7);
  });

  it('throws on a malformed shape', () => {
    expect(() => evaluateScalarOrFieldRef({ notField: 'x' }, resolveField, { x: 0, y: 0, z: 0 }, 1.0))
      .toThrow(/must be a number or \{ field: '<id>' \}/);
    expect(() => evaluateScalarOrFieldRef('two', resolveField, { x: 0, y: 0, z: 0 }, 1.0))
      .toThrow(/must be a number or \{ field: '<id>' \}/);
  });

  it("throws when given a field ref but no resolver is provided", () => {
    expect(() => evaluateScalarOrFieldRef({ field: 'flat' }, null, { x: 0, y: 0, z: 0 }, 1.0))
      .toThrow(/no resolver is available/);
  });
});
