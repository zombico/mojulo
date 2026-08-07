/**
 * Tree-IR walker modifier tests: `replicate` and `reflect`.
 *
 * Covers:
 *   - walkManjiTree(2D) with replicate.offsets and replicate.pattern
 *   - walkManjiTree(2D) with reflect: 'N-S' / 'E-W' / array form
 *   - walkManjiTree3D with replicate + reflect over the Zenith-Nadir axis
 *   - validateManjiTree(3D) traverses replicate inner nodes and rejects
 *     unknown reflect axes
 *   - Replicated subtrees emit suffixed ids (`#i`) so the line-between
 *     resolver can address each instance.
 */

import { describe, it, expect } from 'vitest';
import {
  walkManjiTree,
  walkManjiTree3D,
  validateManjiTree,
  validateManjiTree3D,
  REFLECT_AXES,
} from './manji-program.js';

const canonical2D = {
  spine: {
    bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
    bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
  },
  slots: [],
};

const canonical3D = {
  spine: {
    bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
    bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
    bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' } },
  },
  slots: [],
};

describe('REFLECT_AXES', () => {
  it('exports the three cardinal axes', () => {
    expect(REFLECT_AXES).toEqual(['N-S', 'E-W', 'Zenith-Nadir']);
  });
});

describe('walkManjiTree 2D — replicate', () => {
  it('expands explicit offsets into one instance per offset', () => {
    const tree = {
      replicate: { offsets: [{ x: -3, y: 0 }, { x: 3, y: 0 }] },
      node: { id: 'pair', ...canonical2D },
    };
    const out = walkManjiTree(tree);
    expect(out).toHaveLength(2);
    expect(out.map((n) => n.id)).toEqual(['pair#0', 'pair#1']);
    expect(out[0].anchor).toEqual({ x: -3, y: 0 });
    expect(out[1].anchor).toEqual({ x: 3, y: 0 });
  });

  it('expands an anchor pattern by id', () => {
    const tree = {
      replicate: { pattern: 'ring-N', params: { n: 4, radius: 5 } },
      node: { id: 'spoke', ...canonical2D },
    };
    const out = walkManjiTree(tree);
    expect(out).toHaveLength(4);
    // Each instance carries the cardinal spine — i.e. centerCoord lives at the offset.
    expect(out.map((n) => n.id)).toEqual(['spoke#0', 'spoke#1', 'spoke#2', 'spoke#3']);
    const radii = out.map((n) => Math.hypot(n.anchor.x, n.anchor.y));
    for (const r of radii) expect(r).toBeCloseTo(5, 6);
  });

  it('composes group anchor with per-instance offsets', () => {
    const tree = {
      replicate: { offsets: [{ x: -2, y: 0 }, { x: 2, y: 0 }] },
      anchor: { x: 10, y: 0 },
      node: { id: 'pair', ...canonical2D },
    };
    const out = walkManjiTree(tree);
    expect(out[0].anchor).toEqual({ x: 8, y: 0 });
    expect(out[1].anchor).toEqual({ x: 12, y: 0 });
  });

  it('adds inner node anchor to the replicate offset', () => {
    const tree = {
      replicate: { offsets: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      node: { id: 'p', anchor: { x: 1, y: 5 }, ...canonical2D },
    };
    const out = walkManjiTree(tree);
    expect(out[0].anchor).toEqual({ x: 1, y: 5 });
    expect(out[1].anchor).toEqual({ x: 11, y: 5 });
  });
});

describe('walkManjiTree 2D — reflect', () => {
  it('mirrors slot world positions across N-S (negates x)', () => {
    // 2-center-horizontal yields anchors at (-3, 0), (3, 0) with gap=6.
    // After reflect N-S, x is negated so left/right swap world positions.
    const tree = {
      reflect: 'N-S',
      spine: canonical2D.spine,
      slotPattern: { id: '2-center-horizontal', params: { gap: 6 } },
      slotLabels: ['left', 'right'],
    };
    const out = walkManjiTree(tree);
    const slots = out[0].slots;
    expect(slots.find((s) => s.id === 'left').worldPosition).toEqual({ x: 3, y: 0 });
    expect(slots.find((s) => s.id === 'right').worldPosition).toEqual({ x: -3, y: 0 });
  });

  it('mirrors evaluated bar arm-tips across E-W (negates y)', () => {
    const tree = { reflect: 'E-W', ...canonical2D };
    const out = walkManjiTree(tree);
    // Center stays at worldAnchor; reflection is around that point.
    expect(out[0].spineManji.center).toEqual({ x: 0, y: 0 });
    // Every arm-tip is finite and the bar2 (E-W axis) tips have y signs
    // opposite to the un-reflected case.
    const unreflected = walkManjiTree({ ...canonical2D });
    const baseTips = unreflected[0].spineManji.armTips;
    const reflTips = out[0].spineManji.armTips;
    for (let i = 0; i < baseTips.length; i++) {
      expect(reflTips[i].x).toBeCloseTo(baseTips[i].x, 6);
      expect(reflTips[i].y).toBeCloseTo(-baseTips[i].y, 6);
    }
  });

  it('accepts array form to compose multiple reflections', () => {
    // 4-center-diamond with radius=5: positions at (0,-5), (5,0), (0,5), (-5,0).
    // Reflect both N-S and E-W → negate x and y → (0,5), (-5,0), (0,-5), (5,0).
    const tree = {
      reflect: ['N-S', 'E-W'],
      spine: canonical2D.spine,
      slotPattern: { id: '4-center-diamond', params: { radius: 5 } },
      slotLabels: ['n', 'e', 's', 'w'],
    };
    const out = walkManjiTree(tree);
    const slots = out[0].slots;
    expect(slots.find((s) => s.id === 'n').worldPosition).toEqual({ x: 0, y: 5 });
    expect(slots.find((s) => s.id === 'e').worldPosition).toEqual({ x: -5, y: 0 });
    expect(slots.find((s) => s.id === 's').worldPosition).toEqual({ x: 0, y: -5 });
    expect(slots.find((s) => s.id === 'w').worldPosition).toEqual({ x: 5, y: 0 });
  });

  it('propagates reflect into descendants', () => {
    const tree = {
      reflect: 'N-S',
      spine: canonical2D.spine,
      slotPattern: { id: '2-center-horizontal', params: { gap: 10 } },
      slotLabels: ['L', 'R'],
      children: [
        {
          slot: 'L',
          node: {
            spine: canonical2D.spine,
            slotPattern: { id: '2-center-horizontal', params: { gap: 4 } },
            slotLabels: ['inner-L', 'inner-R'],
          },
        },
      ],
    };
    const out = walkManjiTree(tree);
    // Parent's 'L' slot world position = +5 (was -5, N-S flips x).
    const parentL = out[0].slots.find((s) => s.id === 'L');
    expect(parentL.worldPosition.x).toBeCloseTo(5, 6);
    // Child inherits axisSigns. Its 'inner-L' slot is at local x=-2, but
    // its parent's signs flip x → world position = parentAnchor (5) + (-(-2)) = 7.
    const child = out.find((n) => n.depth === 1);
    const childInnerL = child.slots.find((s) => s.id === 'inner-L');
    expect(childInnerL.worldPosition.x).toBeCloseTo(7, 6);
  });

  it('errors on unknown reflect axis', () => {
    const tree = { reflect: 'X-Y', ...canonical2D };
    expect(() => walkManjiTree(tree)).toThrow(/unknown axis 'X-Y'/);
  });
});

describe('walkManjiTree3D — replicate + reflect', () => {
  it('replicates a 3D subtree with explicit 3D offsets', () => {
    const tree = {
      replicate: {
        offsets: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 5 },
        ],
      },
      node: { id: 'cube', ...canonical3D },
    };
    const out = walkManjiTree3D(tree);
    expect(out).toHaveLength(2);
    expect(out[0].anchor).toEqual({ x: 0, y: 0, z: 0 });
    expect(out[1].anchor).toEqual({ x: 0, y: 0, z: 5 });
    expect(out.map((n) => n.id)).toEqual(['cube#0', 'cube#1']);
  });

  it('lifts a 2D anchor pattern into z=0 plane for 3D walker', () => {
    const tree = {
      replicate: { pattern: 'ring-N', params: { n: 6, radius: 4 } },
      node: { id: 'pillar', ...canonical3D },
    };
    const out = walkManjiTree3D(tree);
    expect(out).toHaveLength(6);
    for (const node of out) {
      expect(node.anchor.z).toBe(0);
      expect(Math.hypot(node.anchor.x, node.anchor.y)).toBeCloseTo(4, 6);
    }
  });

  it('mirrors a 3D slot across Zenith-Nadir (negates z)', () => {
    const tree = {
      reflect: 'Zenith-Nadir',
      spine: canonical3D.spine,
      slots: [{ id: 'top', position: { x: 0, y: 0, z: 3 } }],
    };
    const out = walkManjiTree3D(tree);
    expect(out[0].slots[0].worldPosition).toEqual({ x: 0, y: 0, z: -3 });
  });

  it('errors when a replicate node has no inner `node`', () => {
    const tree = { replicate: { offsets: [{ x: 0, y: 0, z: 0 }] } };
    expect(() => walkManjiTree3D(tree)).toThrow(/replicate node must carry inner `node` spec/);
  });
});

describe('validateManjiTree(3D) with modifiers', () => {
  it('descends into replicate.node to validate the inner', () => {
    const tree = {
      replicate: { offsets: [{ x: 0, y: 0 }] },
      node: {
        reflect: 'not-an-axis',
        ...canonical2D,
      },
    };
    const errors = validateManjiTree(tree);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/replicate/);
    expect(errors[0]).toMatch(/reflect axis 'not-an-axis'/);
  });

  it('rejects unknown reflect axes in 3D', () => {
    const tree = {
      reflect: 'not-an-axis',
      spine: canonical3D.spine,
      slots: [],
    };
    const errors = validateManjiTree3D(tree);
    expect(errors.some((e) => e.includes("reflect axis 'not-an-axis'"))).toBe(true);
  });

  it('passes through a valid reflect + replicate tree', () => {
    const tree = {
      replicate: { pattern: '2-center-horizontal', params: { gap: 6 } },
      node: {
        reflect: 'E-W',
        ...canonical2D,
      },
    };
    const errors = validateManjiTree(tree);
    expect(errors).toEqual([]);
  });
});

describe('walker IR field passthrough — role + programRef', () => {
  // Renderers (manji-svg `nodeRole`) read both fields off emitted nodes
  // to pick a visual overlay. The 2D walker historically dropped them,
  // silently disabling card-family role inference for 2D scenes. These
  // tests lock the passthrough in for both walkers.
  it('2D walker carries explicit role and programRef onto emitted node', () => {
    const tree = { ...canonical2D, role: 'pillar', programRef: 'tall-thing' };
    // resolver returns the preset as-is for the programRef under test
    const out = walkManjiTree(tree, (ref) => (ref === 'tall-thing' ? canonical2D : null));
    expect(out[0].role).toBe('pillar');
    expect(out[0].programRef).toBe('tall-thing');
  });

  it('2D walker emits null for both fields when not specified', () => {
    const out = walkManjiTree({ ...canonical2D });
    expect(out[0].role).toBeNull();
    expect(out[0].programRef).toBeNull();
  });

  it('3D walker carries explicit role onto emitted node', () => {
    const tree = { ...canonical3D, role: 'figure' };
    const out = walkManjiTree3D(tree);
    expect(out[0].role).toBe('figure');
  });

  it('3D walker emits null role when not specified (programRef pre-existing)', () => {
    const out = walkManjiTree3D({ ...canonical3D });
    expect(out[0].role).toBeNull();
    expect(out[0].programRef).toBeNull();
  });
});
