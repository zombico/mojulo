/**
 * Tests for the curve-projection vector field + component extraction
 * in scalar field refs (iteration 2 of the iterative landscape
 * closeout).
 *
 * Covers:
 *   - validateFields catches malformed curve-projection declarations
 *   - the evaluator returns the closest point on the polyline
 *   - scalar consumers extract components via { field, component }
 *   - structure-ref validator catches missing component on vector ref
 *
 * Design: lite-template/integration/0605/curve-projection-field.plan.md.
 */

import { describe, it, expect } from 'vitest';

import {
  buildFieldResolver,
  validateFields,
  evaluateScalarOrFieldRef,
  isVectorFieldKind,
  FIELD_KINDS,
  VECTOR_FIELD_KINDS,
} from './fields.js';
import {
  walkManjiTree3D,
  validateStructureManjiFieldRefs,
} from './manji-program.js';

// ─── enum + classification ────────────────────────────────────────────

describe('FIELD_KINDS — curve-projection joins the substrate', () => {
  it('lists curve-projection', () => {
    expect(FIELD_KINDS).toContain('curve-projection');
  });

  it('classifies curve-projection as vector', () => {
    expect(VECTOR_FIELD_KINDS).toContain('curve-projection');
    expect(isVectorFieldKind('curve-projection')).toBe(true);
    expect(isVectorFieldKind('constant')).toBe(false);
    expect(isVectorFieldKind('wave-surface')).toBe(false);
  });
});

// ─── validator ────────────────────────────────────────────────────────

describe('validateFields — curve-projection kind', () => {
  it('accepts a minimal 2-waypoint curve', () => {
    expect(validateFields({
      c: {
        kind: 'curve-projection',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }],
      },
    }, [])).toEqual([]);
  });

  it('rejects waypoints with fewer than 2 entries', () => {
    const errors = validateFields({
      c: { kind: 'curve-projection', waypoints: [{ x: 0, y: 0, z: 0 }] },
    }, []);
    expect(errors[0]).toMatch(/waypoints: must be an array of at least 2/);
  });

  it('rejects waypoints with missing components', () => {
    const errors = validateFields({
      c: { kind: 'curve-projection', waypoints: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1 }] },
    }, []);
    expect(errors[0]).toMatch(/waypoints\[1\]: must be a finite \{x,y,z\}/);
  });

  it('rejects non-array waypoints', () => {
    const errors = validateFields({
      c: { kind: 'curve-projection', waypoints: 'curve' },
    }, []);
    expect(errors[0]).toMatch(/waypoints: must be an array/);
  });
});

// ─── closest-point math ───────────────────────────────────────────────

describe('curve-projection evaluator — closest point', () => {
  it('snaps to the segment endpoint when query is past the end', () => {
    const resolver = buildFieldResolver({
      c: {
        kind: 'curve-projection',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
    }, []);
    const f = resolver('c');
    // Query at (20, 0, 0) — past the end. Closest = (10, 0, 0).
    expect(f({ x: 20, y: 0, z: 0 })).toEqual({ x: 10, y: 0, z: 0 });
    // Query at (-5, 0, 0) — before the start. Closest = (0, 0, 0).
    expect(f({ x: -5, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('projects perpendicular onto the nearest segment', () => {
    const resolver = buildFieldResolver({
      c: {
        kind: 'curve-projection',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
    }, []);
    const f = resolver('c');
    // Query at (5, 99, 0) — projects to (5, 0, 0).
    const p = f({ x: 5, y: 99, z: 0 });
    expect(p.x).toBeCloseTo(5, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('selects the closest segment in a multi-segment polyline', () => {
    // L-shaped path along x then along y.
    const resolver = buildFieldResolver({
      c: {
        kind: 'curve-projection',
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
      },
    }, []);
    const f = resolver('c');
    // Query at (8, 5, 0) — closest to (8, 0, 0) on segment 0, distance 5.
    // Also (10, 5, 0) on segment 1, distance 2. Pick segment 1.
    const p = f({ x: 8, y: 5, z: 0 });
    expect(p.x).toBeCloseTo(10, 6);
    expect(p.y).toBeCloseTo(5, 6);
  });

  it('handles zero-length segments gracefully', () => {
    const resolver = buildFieldResolver({
      c: {
        kind: 'curve-projection',
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },  // duplicate — zero-length segment
          { x: 10, y: 0, z: 0 },
        ],
      },
    }, []);
    const f = resolver('c');
    // The valid segment is (0,0,0) → (10,0,0). Query at (5, 1, 0) → (5, 0, 0).
    const p = f({ x: 5, y: 1, z: 0 });
    expect(p.x).toBeCloseTo(5, 6);
  });
});

// ─── component extraction ─────────────────────────────────────────────

describe('evaluateScalarOrFieldRef — vector field component extraction', () => {
  const resolver = buildFieldResolver({
    c: {
      kind: 'curve-projection',
      waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }],
    },
  }, []);

  it('extracts x of a vector field output', () => {
    const v = evaluateScalarOrFieldRef(
      { field: 'c', component: 'x' },
      resolver,
      { x: 100, y: 100, z: 100 },
      0,
    );
    expect(v).toBeCloseTo(10, 6);
  });

  it('extracts y of a vector field output', () => {
    const v = evaluateScalarOrFieldRef(
      { field: 'c', component: 'y' },
      resolver,
      { x: 100, y: 100, z: 100 },
      0,
    );
    expect(v).toBeCloseTo(20, 6);
  });

  it('extracts z of a vector field output', () => {
    const v = evaluateScalarOrFieldRef(
      { field: 'c', component: 'z' },
      resolver,
      { x: 100, y: 100, z: 100 },
      0,
    );
    expect(v).toBeCloseTo(30, 6);
  });

  it('throws on a vector field with no component specified', () => {
    expect(() =>
      evaluateScalarOrFieldRef(
        { field: 'c' },
        resolver,
        { x: 0, y: 0, z: 0 },
        0,
      ),
    ).toThrow(/returned a vector; consumer must specify/);
  });

  it('ignores component on a scalar field (scalar IS the result)', () => {
    const scalarRes = buildFieldResolver({ k: { kind: 'constant', value: 3.5 } }, []);
    expect(evaluateScalarOrFieldRef(
      { field: 'k', component: 'x' },
      scalarRes,
      { x: 0, y: 0, z: 0 },
      0,
    )).toBe(3.5);
  });
});

// ─── structure-ref validator ──────────────────────────────────────────

describe('validateStructureManjiFieldRefs — vector-field component required', () => {
  function rootScene() {
    return {
      id: 'world',
      spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 } },
      anchor: { x: 0, y: 0, z: 0 },
      slots: [{ id: 'mount', position: { x: 0, y: 0, z: 0 } }],
    };
  }

  const fields = {
    path: {
      kind: 'curve-projection',
      waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
    },
  };

  it('rejects an anchor.x referencing a vector field with no component', () => {
    const tree = {
      ...rootScene(),
      children: [{
        slot: 'mount',
        node: { ...rootScene(), id: 'leaf', anchor: { x: { field: 'path' }, y: 0, z: 0 } },
      }],
    };
    const errors = validateStructureManjiFieldRefs(tree, fields);
    expect(errors[0]).toMatch(/anchor\.x: field 'path' is a vector field/);
  });

  it('accepts an anchor.x with explicit component', () => {
    const tree = {
      ...rootScene(),
      children: [{
        slot: 'mount',
        node: { ...rootScene(), id: 'leaf', anchor: { x: { field: 'path', component: 'x' }, y: 0, z: 0 } },
      }],
    };
    expect(validateStructureManjiFieldRefs(tree, fields)).toEqual([]);
  });

  it('accepts a scalar field with component (component ignored)', () => {
    const tree = {
      ...rootScene(),
      children: [{
        slot: 'mount',
        node: { ...rootScene(), id: 'leaf', anchor: { x: { field: 'k', component: 'x' }, y: 0, z: 0 } },
      }],
    };
    expect(validateStructureManjiFieldRefs(tree, { k: { kind: 'constant', value: 5 } })).toEqual([]);
  });
});

// ─── end-to-end walker behavior ───────────────────────────────────────

describe('walkManjiTree3D — replicated trees snap to a curve', () => {
  it('each replica anchors to the closest point on the polyline', () => {
    const fields = {
      path: {
        kind: 'curve-projection',
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
      },
    };
    const tree = {
      replicate: { offsets: [
        { x: 2, y: 0, z: 0 },    // off-curve
        { x: 5, y: 0, z: 0 },    // off-curve
        { x: 8, y: 8, z: 0 },    // near-curve
      ] },
      node: {
        id: 'tree',
        anchor: {
          x: { field: 'path', component: 'x' },
          y: { field: 'path', component: 'y' },
          z: { field: 'path', component: 'z' },
        },
        spine: { bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.5 } },
        slots: [{ id: 'top', position: { x: 0, y: 0, z: 1 } }],
      },
    };
    const emitted = walkManjiTree3D(tree, () => null, { fields });
    const trees = emitted.filter((n) => n.id?.startsWith('tree'));
    expect(trees).toHaveLength(3);
    // Each tree's anchor should lie on the line from (0,0,0) to (10,10,0):
    // x == y.
    for (const t of trees) {
      expect(t.anchor.x).toBeCloseTo(t.anchor.y, 4);
    }
  });
});
