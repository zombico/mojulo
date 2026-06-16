/**
 * Unit tests for the lathe sampler + validator.
 *
 * Covers:
 *   - validateLathes: shape checks (endpoint paths, profile, harmonics).
 *   - sampleLathe: cross-section count, radius interpolation, harmonic
 *     summation, axis basis.
 */

import { describe, it, expect } from 'vitest';
import { sampleLathe, validateLathes } from './lathe.js';
import { walkManjiTree3D } from './manji-program.js';

function twoPointScene() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.5 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'top', position: { x: 0, y: 0, z: 4 } },
      { id: 'base', position: { x: 0, y: 0, z: 0 } },
    ],
  };
}

// ─── validator ────────────────────────────────────────────────────────

describe('validateLathes', () => {
  const emitted = walkManjiTree3D(twoPointScene());

  it('accepts a minimal valid spec', () => {
    expect(validateLathes([
      {
        axisFrom: 'world/slot/top',
        axisTo: 'world/slot/base',
        profile: [{ t: 0, radius: 0.5 }, { t: 1, radius: 0.3 }],
      },
    ], emitted)).toEqual([]);
  });

  it('rejects missing axisFrom / axisTo', () => {
    const errors = validateLathes([{ profile: [{ t: 0, radius: 1 }] }], emitted);
    expect(errors).toContainEqual(expect.stringMatching(/axisFrom: required/));
    expect(errors).toContainEqual(expect.stringMatching(/axisTo: required/));
  });

  it('rejects an unresolvable endpoint path', () => {
    const errors = validateLathes([
      {
        axisFrom: 'world/slot/missing',
        axisTo: 'world/slot/base',
        profile: [{ t: 0, radius: 1 }],
      },
    ], emitted);
    expect(errors[0]).toMatch(/slot 'missing'/);
  });

  it('accepts {x,y,z} inline endpoints', () => {
    expect(validateLathes([
      {
        axisFrom: { x: 0, y: 0, z: 0 },
        axisTo: { x: 0, y: 0, z: 1 },
        profile: [{ t: 0, radius: 1 }],
      },
    ], emitted)).toEqual([]);
  });

  it('rejects an empty / missing profile', () => {
    expect(validateLathes([
      { axisFrom: 'world/slot/top', axisTo: 'world/slot/base' },
    ], emitted)[0]).toMatch(/profile: required/);
    expect(validateLathes([
      { axisFrom: 'world/slot/top', axisTo: 'world/slot/base', profile: [] },
    ], emitted)[0]).toMatch(/profile: required/);
  });

  it('rejects non-monotonic profile t values', () => {
    const errors = validateLathes([
      {
        axisFrom: 'world/slot/top',
        axisTo: 'world/slot/base',
        profile: [{ t: 0, radius: 1 }, { t: 0.5, radius: 0.5 }, { t: 0.3, radius: 0.4 }],
      },
    ], emitted);
    expect(errors[0]).toMatch(/monotonically non-decreasing/);
  });

  it('rejects harmonics with bad shape', () => {
    const bad1 = validateLathes([
      {
        axisFrom: 'world/slot/top',
        axisTo: 'world/slot/base',
        profile: [{ t: 0, radius: 1 }],
        harmonics: [{ n: 0, amplitude: 0.1 }],
      },
    ], emitted);
    expect(bad1[0]).toMatch(/harmonics\[0\]\.n: must be a positive integer/);
  });
});

// ─── sampler ──────────────────────────────────────────────────────────

describe('sampleLathe', () => {
  const baseSpec = {
    axisFrom: { x: 0, y: 0, z: 0 },
    axisTo: { x: 0, y: 0, z: 4 },
    profile: [{ t: 0, radius: 1 }, { t: 1, radius: 0.5 }],
    crossSections: 8,
    samples: 16,
  };

  it('emits crossSections + 1 polylines, each samples + 1 long', () => {
    const { polylines } = sampleLathe(baseSpec);
    expect(polylines).toHaveLength(9);
    for (const poly of polylines) expect(poly.length).toBe(17);
  });

  it('frame interpolation: normals equal to the axis dir reproduce the rigid sweep byte-for-byte', () => {
    const rigid = sampleLathe(baseSpec);
    const bent = sampleLathe({ ...baseSpec, normalFrom: { x: 0, y: 0, z: 1 }, normalTo: { x: 0, y: 0, z: 1 } });
    expect(bent.polylines).toEqual(rigid.polylines);
  });

  it('frame interpolation: a 90° normal difference rotates the cross-section plane', () => {
    // normalFrom = +Z (rings in XY), normalTo = +X (rings in YZ). The last
    // ring's vertices should lie in a plane whose normal is ~+X, so their
    // x-spread collapses relative to the rigid (XY-plane) sweep.
    const bent = sampleLathe({
      ...baseSpec,
      normalFrom: { x: 0, y: 0, z: 1 },
      normalTo: { x: 1, y: 0, z: 0 },
    });
    const last = bent.polylines[bent.polylines.length - 1];
    const xs = last.map((p) => p.x - 0);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const ys = last.map((p) => p.y);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    // Ring now lives in the YZ plane → little x spread, full y spread.
    expect(spreadX).toBeLessThan(spreadY);
  });

  it('linearly interpolates profile radius', () => {
    const { polylines } = sampleLathe(baseSpec);
    // Midpoint cross-section (i=4 of 8 → t=0.5) → radius = 0.75 (lerp from 1 to 0.5).
    const mid = polylines[4];
    const center = mid[0];
    // sample at theta=0 is at (radius, 0, ?) relative to axis basis. Just
    // verify magnitude of horizontal projection.
    const rh = Math.hypot(center.x, center.y);
    expect(rh).toBeCloseTo(0.75, 6);
  });

  it('clamps profile values past t=0 and t=1', () => {
    const single = sampleLathe({
      axisFrom: { x: 0, y: 0, z: 0 },
      axisTo: { x: 0, y: 0, z: 4 },
      profile: [{ t: 0.5, radius: 0.7 }],
      crossSections: 4,
      samples: 8,
    });
    // Single profile point — radius is constant 0.7 everywhere.
    for (const poly of single.polylines) {
      const p = poly[0];
      const rh = Math.hypot(p.x, p.y);
      expect(rh).toBeCloseTo(0.7, 6);
    }
  });

  it('applies angular harmonics into the radius', () => {
    // A 6-fold harmonic with amplitude 0.1 should produce 6 maxima
    // around each cross-section. Check that the radius varies by ±0.1
    // around the baseline.
    const { polylines } = sampleLathe({
      ...baseSpec,
      profile: [{ t: 0, radius: 1.0 }, { t: 1, radius: 1.0 }],
      harmonics: [{ n: 6, amplitude: 0.1 }],
    });
    const mid = polylines[4];
    const radii = mid.slice(0, -1).map((p) => Math.hypot(p.x, p.y));
    const max = Math.max(...radii);
    const min = Math.min(...radii);
    expect(max).toBeCloseTo(1.1, 6);
    expect(min).toBeCloseTo(0.9, 6);
  });

  it('rejects a zero-length axis', () => {
    expect(() => sampleLathe({
      ...baseSpec,
      axisFrom: { x: 0, y: 0, z: 0 },
      axisTo: { x: 0, y: 0, z: 0 },
    })).toThrow(/zero-length axis/);
  });

  it('rejects unresolved string endpoints (caller must pre-resolve)', () => {
    expect(() => sampleLathe({
      ...baseSpec,
      axisFrom: 'world/slot/top',
    })).toThrow(/axisFrom must be \{x,y,z\}/);
  });
});
