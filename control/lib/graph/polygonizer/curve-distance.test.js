/**
 * Tests for the curve-distance scalar field — sibling to
 * curve-projection. Same input (polyline waypoints), different output
 * (scalar world-unit distance from query to the closest point on the
 * polyline instead of the closest point itself).
 *
 * Covers:
 *   - FIELD_KINDS enumeration includes curve-distance, classified scalar
 *   - validateFields catches malformed curve-distance declarations
 *   - the evaluator returns 0 when query lies on the polyline
 *   - perpendicular distances to axis-aligned segments
 *   - past-the-end queries snap to endpoint distance
 *   - closest-segment selection on multi-segment polylines
 *   - zero-length segments handled gracefully
 *   - z-aware 3D distance
 *   - sum-field composition (curve-distance as a sum component)
 *
 * Design: lite-template/integration/0605/polygonizer-capability-additions.plan.md
 * (Item 1).
 */

import { describe, it, expect } from 'vitest';

import {
  buildFieldResolver,
  validateFields,
  isVectorFieldKind,
  FIELD_KINDS,
  VECTOR_FIELD_KINDS,
} from './fields.js';

// ─── enum + classification ────────────────────────────────────────────

describe('FIELD_KINDS — curve-distance joins the substrate', () => {
  it('lists curve-distance', () => {
    expect(FIELD_KINDS).toContain('curve-distance');
  });

  it('classifies curve-distance as scalar (not vector)', () => {
    expect(VECTOR_FIELD_KINDS).not.toContain('curve-distance');
    expect(isVectorFieldKind('curve-distance')).toBe(false);
  });
});

// ─── validator ────────────────────────────────────────────────────────

describe('validateFields — curve-distance kind', () => {
  it('accepts a minimal 2-waypoint curve', () => {
    expect(validateFields({
      d: {
        kind: 'curve-distance',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }],
      },
    }, [])).toEqual([]);
  });

  it('rejects waypoints with fewer than 2 entries', () => {
    const errors = validateFields({
      d: { kind: 'curve-distance', waypoints: [{ x: 0, y: 0, z: 0 }] },
    }, []);
    expect(errors[0]).toMatch(/waypoints: must be an array of at least 2/);
  });

  it('rejects waypoints with missing components', () => {
    const errors = validateFields({
      d: { kind: 'curve-distance', waypoints: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1 }] },
    }, []);
    expect(errors[0]).toMatch(/waypoints\[1\]: must be a finite \{x,y,z\}/);
  });

  it('rejects non-array waypoints', () => {
    const errors = validateFields({
      d: { kind: 'curve-distance', waypoints: 'curve' },
    }, []);
    expect(errors[0]).toMatch(/waypoints: must be an array/);
  });
});

// ─── distance math ────────────────────────────────────────────────────

describe('curve-distance evaluator — scalar distance to polyline', () => {
  it('returns 0 (within 1e-6) when query lies on a waypoint', () => {
    const resolver = buildFieldResolver({
      d: {
        kind: 'curve-distance',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
    }, []);
    const f = resolver('d');
    expect(f({ x: 0, y: 0, z: 0 })).toBeCloseTo(0, 6);
    expect(f({ x: 10, y: 0, z: 0 })).toBeCloseTo(0, 6);
    // Interior point of the segment.
    expect(f({ x: 5, y: 0, z: 0 })).toBeCloseTo(0, 6);
  });

  it('returns correct perpendicular distance to an axis-aligned segment', () => {
    const resolver = buildFieldResolver({
      d: {
        kind: 'curve-distance',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
    }, []);
    const f = resolver('d');
    // Query at (5, 7, 0) — perpendicular distance to the x-axis = 7.
    expect(f({ x: 5, y: 7, z: 0 })).toBeCloseTo(7, 6);
    // Query at (5, -3, 0) — perpendicular distance = 3.
    expect(f({ x: 5, y: -3, z: 0 })).toBeCloseTo(3, 6);
  });

  it('returns endpoint distance when query is past the end', () => {
    const resolver = buildFieldResolver({
      d: {
        kind: 'curve-distance',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
    }, []);
    const f = resolver('d');
    // Query at (20, 0, 0) — closest point is (10, 0, 0), distance = 10.
    expect(f({ x: 20, y: 0, z: 0 })).toBeCloseTo(10, 6);
    // Query at (-5, 0, 0) — closest point is (0, 0, 0), distance = 5.
    expect(f({ x: -5, y: 0, z: 0 })).toBeCloseTo(5, 6);
    // Diagonal off the start endpoint.
    expect(f({ x: -3, y: 4, z: 0 })).toBeCloseTo(5, 6);
  });

  it('selects the closest segment on a multi-segment polyline', () => {
    // L-shaped path along x then along y.
    const resolver = buildFieldResolver({
      d: {
        kind: 'curve-distance',
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 0 },
        ],
      },
    }, []);
    const f = resolver('d');
    // Query at (8, 5, 0):
    //   segment 0 (x-axis): closest (8, 0, 0), distance 5
    //   segment 1 (vertical at x=10): closest (10, 5, 0), distance 2
    // Pick segment 1.
    expect(f({ x: 8, y: 5, z: 0 })).toBeCloseTo(2, 6);
  });

  it('handles zero-length segments gracefully', () => {
    const resolver = buildFieldResolver({
      d: {
        kind: 'curve-distance',
        waypoints: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },  // duplicate — zero-length segment
          { x: 10, y: 0, z: 0 },
        ],
      },
    }, []);
    const f = resolver('d');
    // The valid segment is (0,0,0) → (10,0,0). Query at (5, 1, 0) → distance 1.
    expect(f({ x: 5, y: 1, z: 0 })).toBeCloseTo(1, 6);
  });

  it('returns world-unit distance for a fully-degenerate (coincident) polyline', () => {
    const resolver = buildFieldResolver({
      d: {
        kind: 'curve-distance',
        waypoints: [
          { x: 4, y: 4, z: 0 },
          { x: 4, y: 4, z: 0 },
        ],
      },
    }, []);
    const f = resolver('d');
    // All waypoints coincide — distance falls back to the single point.
    expect(f({ x: 4, y: 4, z: 0 })).toBeCloseTo(0, 6);
    expect(f({ x: 7, y: 8, z: 0 })).toBeCloseTo(5, 6);  // 3-4-5 triangle
  });

  it('is z-aware (3D distance, not xy-projected)', () => {
    const resolver = buildFieldResolver({
      d: {
        kind: 'curve-distance',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
    }, []);
    const f = resolver('d');
    // Query at (5, 0, 4) — directly above the segment midpoint, in z.
    // 3D-aware: distance is 4. xy-projected would be 0.
    expect(f({ x: 5, y: 0, z: 4 })).toBeCloseTo(4, 6);
    // Query at (5, 3, 4) — perpendicular displacement (3, 4) → distance 5.
    expect(f({ x: 5, y: 3, z: 4 })).toBeCloseTo(5, 6);
  });
});

// ─── sum-field composition ────────────────────────────────────────────

describe('curve-distance — composes via sum field', () => {
  it('feeds a sum-field offset for path-proximity scaling', () => {
    // tree-height = 0.4 + 0.1 * distance-to-river.
    // On the river: height = 0.4. 6 units away: height = 1.0.
    const resolver = buildFieldResolver({
      river: {
        kind: 'curve-distance',
        waypoints: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      },
      'tree-height': {
        kind: 'sum',
        components: [{ field: 'river', weight: 0.1 }],
        offset: 0.4,
      },
    }, []);
    const f = resolver('tree-height');
    // On the river at (5, 0, 0): distance 0 → height = 0.4.
    expect(f({ x: 5, y: 0, z: 0 })).toBeCloseTo(0.4, 6);
    // 6 units off the river: distance 6 → height = 0.4 + 0.6 = 1.0.
    expect(f({ x: 5, y: 6, z: 0 })).toBeCloseTo(1.0, 6);
    // 10 units off the river: distance 10 → height = 0.4 + 1.0 = 1.4.
    expect(f({ x: 5, y: 10, z: 0 })).toBeCloseTo(1.4, 6);
  });
});
