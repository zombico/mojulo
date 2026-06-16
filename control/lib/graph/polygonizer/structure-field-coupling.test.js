/**
 * Tests for the wave-side-discovered patterns ported back to structure
 * manji: field-coupled scalars (move 1) + replicate.scaleStep (move 2).
 *
 * Covers:
 *   - validateStructureManjiFieldRefs: catches unknown field ids,
 *     malformed shapes, scaleStep non-numbers.
 *   - walkManjiTree3D with `fields`: scale, slotScale, lengthScale
 *     evaluate through field refs at the right positions.
 *   - replicate.scaleStep: instance i gets scaleStep^i applied on top
 *     of the base scale.
 *   - The v1 limitation: a root-level structure scalar referencing a
 *     field whose center is the root's OWN slots throws (root isn't
 *     emitted yet at root-scale-eval time).
 *
 * Design rationale:
 * lite-template/integration/0605/structure-manji-unlocks.plan.md.
 */

import { describe, it, expect } from 'vitest';

import {
  walkManjiTree3D,
  validateStructureManjiFieldRefs,
} from './manji-program.js';

const PHYSICS = { gravity: { x: 0, y: 0, z: -1 } };

function rootScene(overrides = {}) {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 1.0 },
      bar2: { axis: 'E-W', tails: { E: 'closed', W: 'closed' }, lengthScale: 1.0 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'center', position: { x: 0, y: 0, z: 0 } },
      { id: 'east',   position: { x: 4, y: 0, z: 0 } },
    ],
    ...overrides,
  };
}

// ─── validator ────────────────────────────────────────────────────────

describe('validateStructureManjiFieldRefs', () => {
  it('passes a tree with no field refs', () => {
    expect(validateStructureManjiFieldRefs(rootScene(), null)).toEqual([]);
    expect(validateStructureManjiFieldRefs(rootScene(), {})).toEqual([]);
  });

  it('catches a node.scale referencing an unknown field', () => {
    const tree = { ...rootScene(), scale: { field: 'missing' } };
    const errors = validateStructureManjiFieldRefs(tree, { other: { kind: 'constant', value: 1 } });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/scale.*unknown field 'missing'.*available: other/s);
    expect(errors[0]).toMatch(/Structure scalars can only reference manifest-declared fields/);
  });

  it('catches a bar.lengthScale referencing an unknown field', () => {
    const tree = {
      ...rootScene(),
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: { field: 'no-such' } },
      },
    };
    const errors = validateStructureManjiFieldRefs(tree, null);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/lengthScale.*unknown field 'no-such'/);
  });

  it('catches a child.slotScale referencing an unknown field', () => {
    const tree = {
      ...rootScene(),
      children: [
        { slot: 'center', slotScale: { field: 'missing' }, node: rootScene() },
      ],
    };
    const errors = validateStructureManjiFieldRefs(tree, null);
    expect(errors[0]).toMatch(/slotScale.*unknown field 'missing'/);
  });

  it('catches scaleStep that is not a number', () => {
    const tree = {
      ...rootScene(),
      replicate: { offsets: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] },
      scaleStep: { field: 'foo' },
      node: rootScene(),
    };
    const errors = validateStructureManjiFieldRefs(tree, null);
    expect(errors[0]).toMatch(/scaleStep: must be a finite number/);
  });

  it('catches malformed scalar shapes', () => {
    const tree = { ...rootScene(), scale: 'two' };
    const errors = validateStructureManjiFieldRefs(tree, null);
    expect(errors[0]).toMatch(/must be a number or \{ field: '<id>' \}/);
  });

  it('accepts valid field refs against declared fields', () => {
    const tree = {
      ...rootScene(),
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: { field: 'taper' } },
        bar2: { axis: 'E-W', tails: { E: 'closed', W: 'closed' }, lengthScale: 1.0 },
      },
    };
    expect(validateStructureManjiFieldRefs(tree, { taper: { kind: 'constant', value: 0.5 } }))
      .toEqual([]);
  });
});

// ─── walker behavior ──────────────────────────────────────────────────

describe('walkManjiTree3D — field-coupled scalars', () => {
  it('evaluates a node.scale field ref at the node anchor', () => {
    // A constant field returns the same value everywhere — simplest
    // proof that the resolver is being called.
    const tree = { ...rootScene(), scale: { field: 'half' } };
    const emitted = walkManjiTree3D(tree, () => null, {
      fields: { half: { kind: 'constant', value: 0.5 } },
    });
    // World scale = rootScale (1) * localScale (0.5) = 0.5
    expect(emitted[0].scale).toBeCloseTo(0.5, 10);
  });

  it('evaluates a bar.lengthScale field ref before spine compilation', () => {
    // lengthScale halves the bar arm length. The spineManji's N-S bar
    // posEnd should sit at half its default distance from center.
    const treeBase = rootScene();
    const treeFromConst = walkManjiTree3D(
      { ...treeBase, spine: {
        bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.5 },
        bar2: { axis: 'E-W', tails: { E: 'closed', W: 'closed' }, lengthScale: 1.0 },
      } },
    );
    const treeFromField = walkManjiTree3D(
      { ...treeBase, spine: {
        bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: { field: 'half' } },
        bar2: { axis: 'E-W', tails: { E: 'closed', W: 'closed' }, lengthScale: 1.0 },
      } },
      () => null,
      { fields: { half: { kind: 'constant', value: 0.5 } } },
    );
    const constBar = treeFromConst[0].spineManji.bars.find((b) => b.axis === 'N-S');
    const fieldBar = treeFromField[0].spineManji.bars.find((b) => b.axis === 'N-S');
    expect(fieldBar.points.posEnd.y).toBeCloseTo(constBar.points.posEnd.y, 10);
  });

  it('evaluates child.slotScale field ref at the slot world position', () => {
    // Field is radial centered at world origin: innerValue=2 within r<1,
    // outerValue=0.5 past r>=10. Child placed at slot 'east' which is at
    // x=4, so the gradient value should be between innerValue and outerValue.
    const childManji = rootScene({ id: 'child' });
    const tree = {
      ...rootScene(),
      children: [
        { slot: 'east', slotScale: { field: 'falloff' }, node: childManji },
      ],
    };
    const emitted = walkManjiTree3D(tree, () => null, {
      fields: {
        falloff: {
          kind: 'radial',
          center: { x: 0, y: 0, z: 0 },
          innerRadius: 1, innerValue: 2,
          outerRadius: 10, outerValue: 0.5,
        },
      },
    });
    const child = emitted.find((n) => n.id === 'child');
    // x=4 → t = (4-1)/(10-1) = 1/3. Expected slotScale = 2 + (1/3)*(0.5 - 2) = 1.5
    // worldScale = parentScale (1) * slotScale (1.5) = 1.5
    expect(child.scale).toBeCloseTo(1.5, 10);
  });
});

// ─── replicate.scaleStep ──────────────────────────────────────────────

describe('walkManjiTree3D — replicate.scaleStep per-instance modulation', () => {
  it('applies scaleStep^i per replica', () => {
    const inner = rootScene({ id: 'inst' });
    const tree = {
      replicate: { offsets: [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 15, y: 0, z: 0 },
      ] },
      scaleStep: 0.7,
      node: inner,
    };
    const emitted = walkManjiTree3D(tree);
    const instances = emitted.filter((n) => n.id?.startsWith('inst'));
    expect(instances).toHaveLength(4);
    // Scales should follow 1, 0.7, 0.49, 0.343
    expect(instances[0].scale).toBeCloseTo(1.0, 10);
    expect(instances[1].scale).toBeCloseTo(0.7, 10);
    expect(instances[2].scale).toBeCloseTo(0.49, 10);
    expect(instances[3].scale).toBeCloseTo(0.343, 10);
  });

  it('defaults to scaleStep=1 (uniform replication, current behavior)', () => {
    const inner = rootScene({ id: 'inst' });
    const tree = {
      replicate: { offsets: [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }] },
      node: inner,
    };
    const emitted = walkManjiTree3D(tree);
    const instances = emitted.filter((n) => n.id?.startsWith('inst'));
    expect(instances[0].scale).toBe(1);
    expect(instances[1].scale).toBe(1);
  });

  it('composes scaleStep with node.scale on the inner template', () => {
    const inner = rootScene({ id: 'inst', scale: 2 });
    const tree = {
      replicate: { offsets: [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }] },
      scaleStep: 0.5,
      node: inner,
    };
    const emitted = walkManjiTree3D(tree);
    const instances = emitted.filter((n) => n.id?.startsWith('inst'));
    // Instance 0: parentScale (1 * 0.5^0 = 1) * node.scale (2) = 2
    // Instance 1: parentScale (1 * 0.5^1 = 0.5) * node.scale (2) = 1
    expect(instances[0].scale).toBeCloseTo(2, 10);
    expect(instances[1].scale).toBeCloseTo(1, 10);
  });
});

// ─── v1 limitations documented as tests ────────────────────────────────

describe('walkManjiTree3D — v1 limitation visibility', () => {
  it("throws when a root's own scale references a field whose position requires the root's own slots", () => {
    // The root is the FIRST node to be processed; its scale is
    // evaluated before any node has been emitted, so a field whose
    // center is a path into the root throws.
    const tree = {
      ...rootScene(),
      scale: { field: 'self-radial' },
    };
    expect(() =>
      walkManjiTree3D(tree, () => null, {
        fields: {
          'self-radial': {
            kind: 'radial',
            center: 'world/slot/center',
            innerRadius: 1, innerValue: 0.5,
            outerRadius: 5, outerValue: 1.5,
          },
        },
      }),
    ).toThrow(/unknown node id 'world'/);
  });

  it("a deep child's scale CAN reference a field whose position is a parent slot (parent already emitted)", () => {
    const child = rootScene({
      id: 'child',
      anchor: undefined,
      scale: { field: 'parent-centered' },
    });
    const tree = {
      ...rootScene(),
      children: [{ slot: 'east', node: child }],
    };
    const emitted = walkManjiTree3D(tree, () => null, {
      fields: {
        'parent-centered': {
          kind: 'radial',
          center: 'world/slot/center', // resolves to (0,0,0)
          innerRadius: 1, innerValue: 0.25,
          outerRadius: 10, outerValue: 1.5,
        },
      },
    });
    const childNode = emitted.find((n) => n.id === 'child');
    // x=4 from world center → t = 3/9 = 0.333; expected = 0.25 + 0.333*(1.5-0.25) = 0.667
    expect(childNode.scale).toBeCloseTo(0.667, 2);
  });
});
