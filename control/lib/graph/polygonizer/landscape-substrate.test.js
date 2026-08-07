/**
 * Tests for the landscape-substrate slice:
 *   - `wave-surface` field kind — exposes wave-field math as a queryable
 *     scalar field. For a horizontal quad at z=0 with no waves, the
 *     field should evaluate to 0 everywhere. With wave components, it
 *     should match the same sin-sum the wave-field primitive emits.
 *   - `node.anchor.{x,y,z}` widened to accept field refs — a tree
 *     node's anchor.z reads from the terrain field at its (x, y) so
 *     scattered objects sit on the surface.
 *
 * Design: lite-template/integration/0605/landscape-substrate.plan.md.
 */

import { describe, it, expect } from 'vitest';

import {
  buildFieldResolver,
  validateFields,
  FIELD_KINDS,
} from './fields.js';
import {
  walkManjiTree3D,
  validateStructureManjiFieldRefs,
} from './manji-program.js';

// ─── FIELD_KINDS ──────────────────────────────────────────────────────

describe('wave-surface joins the field-kind enum', () => {
  it('includes wave-surface in FIELD_KINDS', () => {
    expect(FIELD_KINDS).toContain('wave-surface');
  });
});

// ─── validateFields ───────────────────────────────────────────────────

describe('validateFields — wave-surface kind', () => {
  it('accepts a minimal valid spec (4 corners, no waves)', () => {
    const errors = validateFields({
      terrain: {
        kind: 'wave-surface',
        corners: [
          { x: -10, y: -10, z: 0 },
          { x:  10, y: -10, z: 0 },
          { x:  10, y:  10, z: 0 },
          { x: -10, y:  10, z: 0 },
        ],
      },
    }, []);
    expect(errors).toEqual([]);
  });

  it('rejects a non-4-corner array', () => {
    const errors = validateFields({
      t: { kind: 'wave-surface', corners: [{ x: 0, y: 0, z: 0 }] },
    }, []);
    expect(errors[0]).toMatch(/corners: must be a 4-element array/);
  });

  it('rejects waves entries with non-finite amplitude', () => {
    const errors = validateFields({
      t: {
        kind: 'wave-surface',
        corners: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        waves: [{ cycles: { u: 1, v: 1 } }],
      },
    }, []);
    expect(errors[0]).toMatch(/waves\[0\]\.amplitude: must be a finite number/);
  });

  it('rejects a bad displacement vector', () => {
    const errors = validateFields({
      t: {
        kind: 'wave-surface',
        corners: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        displacement: { x: 0, y: 'up', z: 1 },
      },
    }, []);
    expect(errors[0]).toMatch(/displacement: must be a finite \{x,y,z\}/);
  });
});

// ─── compiled wave-surface field ──────────────────────────────────────

describe('buildFieldResolver — wave-surface evaluator', () => {
  const TERRAIN = {
    kind: 'wave-surface',
    corners: [
      { x: -10, y: -10, z: 0 },
      { x:  10, y: -10, z: 0 },
      { x:  10, y:  10, z: 0 },
      { x: -10, y:  10, z: 0 },
    ],
    waves: [
      { amplitude: 3.0, cycles: { u: 1, v: 0 }, phase: 0 },
    ],
  };

  it('a flat (no waves) quad at z=0 evaluates to 0 everywhere', () => {
    const resolver = buildFieldResolver({
      flat: {
        kind: 'wave-surface',
        corners: TERRAIN.corners,
      },
    }, []);
    const f = resolver('flat');
    expect(f({ x: 0, y: 0, z: 0 })).toBeCloseTo(0, 10);
    expect(f({ x: 5, y: -3, z: 7 })).toBeCloseTo(0, 10);
  });

  it('a single-component wave evaluates to sin(2π·u) × amplitude', () => {
    const resolver = buildFieldResolver({ terrain: TERRAIN }, []);
    const f = resolver('terrain');
    // u runs from 0 at x=-10 to 1 at x=+10. At x=-10 → u=0 → sin(0)=0.
    expect(f({ x: -10, y: 0, z: 0 })).toBeCloseTo(0, 6);
    // x=-5 → u=0.25 → sin(2π·0.25) = 1 → amplitude 3.0 → 3.
    expect(f({ x: -5, y: 0, z: 0 })).toBeCloseTo(3.0, 6);
    // x=0 → u=0.5 → sin(π) = 0.
    expect(f({ x: 0, y: 0, z: 0 })).toBeCloseTo(0, 6);
    // x=5 → u=0.75 → sin(3π/2) = -1 → -3.
    expect(f({ x: 5, y: 0, z: 0 })).toBeCloseTo(-3.0, 6);
  });

  it('clamps to nearest edge values outside the quad', () => {
    const resolver = buildFieldResolver({ terrain: TERRAIN }, []);
    const f = resolver('terrain');
    // x=-1000 clamps to u=0 → value 0.
    expect(f({ x: -1000, y: 0, z: 0 })).toBeCloseTo(0, 6);
    // x=+1000 clamps to u=1 → sin(2π) = 0.
    expect(f({ x: 1000, y: 0, z: 0 })).toBeCloseTo(0, 6);
  });
});

// ─── anchor.{x,y,z} field-coupling ────────────────────────────────────

function rootScene(overrides = {}) {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [{ id: 'mount', position: { x: 0, y: 0, z: 0 } }],
    ...overrides,
  };
}

describe('walkManjiTree3D — anchor components accept field refs', () => {
  it('anchor.z reads from a constant field', () => {
    const child = rootScene({ id: 'tree-on-mount', anchor: { x: 0, y: 0, z: { field: 'lift' } } });
    const tree = { ...rootScene(), children: [{ slot: 'mount', node: child }] };
    const emitted = walkManjiTree3D(tree, () => null, {
      fields: { lift: { kind: 'constant', value: 5 } },
    });
    const childNode = emitted.find((n) => n.id === 'tree-on-mount');
    expect(childNode.anchor.z).toBeCloseTo(5, 10);
  });

  it('anchor.z reads from a wave-surface field at the child world (x, y)', () => {
    // Same single-component wave as the wave-surface test above.
    const fields = {
      terrain: {
        kind: 'wave-surface',
        corners: [
          { x: -10, y: -10, z: 0 },
          { x:  10, y: -10, z: 0 },
          { x:  10, y:  10, z: 0 },
          { x: -10, y:  10, z: 0 },
        ],
        waves: [{ amplitude: 3.0, cycles: { u: 1, v: 0 } }],
      },
    };
    // Child at (x=-5, y=0) should land at z=3.0 (the wave's amplitude max).
    const child = rootScene({
      id: 'tree-on-hill',
      anchor: { x: -5, y: 0, z: { field: 'terrain' } },
    });
    const tree = { ...rootScene(), children: [{ slot: 'mount', node: child }] };
    const emitted = walkManjiTree3D(tree, () => null, { fields });
    const childNode = emitted.find((n) => n.id === 'tree-on-hill');
    expect(childNode.anchor.x).toBeCloseTo(-5, 6);
    expect(childNode.anchor.y).toBeCloseTo(0, 6);
    expect(childNode.anchor.z).toBeCloseTo(3.0, 6);
  });

  it('three replicated children land at three different terrain heights', () => {
    // Field that varies linearly in x: from -5 at x=-10 to +5 at x=+10.
    const fields = {
      ramp: {
        kind: 'gradient',
        from: { x: -10, y: 0, z: 0 }, fromValue: -5,
        to:   { x:  10, y: 0, z: 0 }, toValue:    5,
      },
    };
    const tree = {
      replicate: { offsets: [
        { x: -8, y: 0, z: 0 },
        { x:  0, y: 0, z: 0 },
        { x:  8, y: 0, z: 0 },
      ] },
      node: rootScene({
        id: 'tree',
        anchor: { x: 0, y: 0, z: { field: 'ramp' } },
      }),
    };
    const emitted = walkManjiTree3D(tree, () => null, { fields });
    const trees = emitted.filter((n) => n.id?.startsWith('tree'));
    expect(trees).toHaveLength(3);
    // x=-8 → t=0.1 → -5 + 0.1·10 = -4
    expect(trees[0].anchor.z).toBeCloseTo(-4, 6);
    // x=0 → t=0.5 → 0
    expect(trees[1].anchor.z).toBeCloseTo(0, 6);
    // x=+8 → t=0.9 → 4
    expect(trees[2].anchor.z).toBeCloseTo(4, 6);
  });
});

// ─── validator catches bad anchor refs ────────────────────────────────

describe('validateStructureManjiFieldRefs — anchor.z field ref checks', () => {
  it('catches an anchor.z that references an unknown field', () => {
    const tree = {
      ...rootScene(),
      children: [{
        slot: 'mount',
        node: rootScene({ id: 'tree', anchor: { x: 0, y: 0, z: { field: 'missing' } } }),
      }],
    };
    const errors = validateStructureManjiFieldRefs(tree, { other: { kind: 'constant', value: 1 } });
    expect(errors[0]).toMatch(/anchor\.z.*unknown field 'missing'/);
  });

  it('accepts an anchor.z field ref against a declared field', () => {
    const tree = {
      ...rootScene(),
      children: [{
        slot: 'mount',
        node: rootScene({ id: 'tree', anchor: { x: 0, y: 0, z: { field: 'terrain' } } }),
      }],
    };
    expect(validateStructureManjiFieldRefs(tree, { terrain: { kind: 'constant', value: 0 } }))
      .toEqual([]);
  });

  it('catches anchor field refs inside a replicate wrapper', () => {
    const tree = {
      replicate: { offsets: [{ x: 0, y: 0, z: 0 }] },
      node: {
        ...rootScene(),
        anchor: { x: { field: 'nope' }, y: 0, z: 0 },
      },
    };
    const errors = validateStructureManjiFieldRefs(tree, null);
    expect(errors[0]).toMatch(/anchor\.x.*unknown field 'nope'/);
  });
});
