import { describe, it, expect } from 'vitest';
import { validatePaintedLandscape, buildTerrainWorldMesh } from './painted-landscape.js';

// Flat field so terrain-anchoring is deterministic (z ≈ 0 everywhere).
const FLAT = {
  fields: { z: { kind: 'constant', value: 0 } },
  field: 'z',
  samples: { u: 8, v: 8 },
};
const base = (extra) => ({
  kind: 'painted-landscape',
  splatch: 'bone-trio',
  seed: 'builds-test',
  elevation: FLAT,
  ...extra,
});

describe('painted-landscape — builds (metal box structures)', () => {
  it('validates well-formed builds and rejects malformed ones', () => {
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: -9, w: 4, d: 4, h: 1, material: 'brushed-hull', tint: '#8f96a1' }] }))).toEqual([]);
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0 }] }))).toEqual([]); // defaults for w/d/h
    expect(validatePaintedLandscape(base({ builds: 'nope' })).some((e) => e.includes('builds must be an array'))).toBe(true);
    expect(validatePaintedLandscape(base({ builds: [{ y: 0 }] })).some((e) => e.includes('x and y are required'))).toBe(true);
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0, w: -2 }] })).some((e) => e.includes('.w must be a positive'))).toBe(true);
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0, tint: 'red' }] })).some((e) => e.includes('.tint must be a #rrggbb'))).toBe(true);
  });

  it('emits 5 material faces per box (top + 4 walls), terrain-anchored', () => {
    const { extraFaces } = buildTerrainWorldMesh(base({ builds: [{ x: 0, y: -9, w: 4, d: 4, h: 2, material: 'brushed-hull', tint: '#8f96a1' }] }));
    const mat = extraFaces.filter((f) => f.material);
    expect(mat.length).toBe(5);
    for (const f of mat) {
      expect(f.doubleSided).toBe(true);
      expect(typeof f.fill).toBe('string');           // SVG/CSS/collision fallback shade
      expect(f.material).toEqual({ kind: 'brushed-hull', tint: '#8f96a1' });
      expect(f.corners).toHaveLength(4);
    }
    // top face sits at z = terrain(0) + h(2) - sink(0); all four top corners at z≈2
    const top = mat.find((f) => f.corners.every((c) => Math.abs(c[2] - 2) < 1e-6));
    expect(top).toBeTruthy();
  });

  it('string material carries through without a tint object', () => {
    const { extraFaces } = buildTerrainWorldMesh(base({ builds: [{ x: 1, y: -9, material: 'weathered-hull' }] }));
    expect(extraFaces.filter((f) => f.material === 'weathered-hull').length).toBe(5);
  });

  it('texture builds emit textureLit faces with per-face uv (depot panels), not material', () => {
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: -9, w: 4, d: 4, h: 2, texture: 'deck-checker', tile: 1.1 }] }))).toEqual([]);
    const { extraFaces } = buildTerrainWorldMesh(base({ builds: [{ x: 0, y: -9, w: 4, d: 4, h: 2, texture: 'deck-checker', tile: 1.1 }] }));
    const tf = extraFaces.filter((f) => f.texture === 'deck-checker');
    expect(tf.length).toBe(5);
    for (const f of tf) {
      expect(f.textureLit).toBe(true);
      expect(f.uv).toHaveLength(4);
      expect(f.material).toBeUndefined();     // texture channel replaces material
      expect(typeof f.fill).toBe('string');
    }
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0, tile: -1 }] })).some((e) => e.includes('.tile must be a positive'))).toBe(true);
  });

  it('ramp (slope) builds emit a wedge whose top rises to z0+h at the high edge', () => {
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: -9, w: 2, d: 4, h: 1.5, slope: '+y', texture: 'deck-tread' }] }))).toEqual([]);
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0, slope: 'up' }] })).some((e) => e.includes('.slope must be one of'))).toBe(true);
    const { extraFaces } = buildTerrainWorldMesh(base({ builds: [{ x: 0, y: -9, w: 2, d: 4, h: 1.5, slope: '+y', material: 'brushed-hull' }] }));
    const mat = extraFaces.filter((f) => f.material);
    expect(mat.length).toBe(5);   // sloped top + 4 walls (no flat top)
    // terrain z=0 here; low edge (y=-11) ≈ ground, high edge (y=-7) top ≈ 1.5
    const allZ = mat.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.max(...allZ)).toBeCloseTo(1.5, 3);
    expect(Math.min(...allZ)).toBeCloseTo(0, 3);
    // the high edge (y = -7) sits at ~1.5, the low edge (y = -11) near ground
    const top = mat.find((f) => Math.abs(Math.max(...f.corners.map((c) => c[2])) - 1.5) < 1e-3 && f.corners.some((c) => Math.abs(c[2]) < 0.1));
    expect(top).toBeTruthy();   // a face spanning ground→top exists (the ramp incline or a side wall)
  });

  it('cylinder builds emit an N-gon prism (side + cap per facet) within the diameter', () => {
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: -9, shape: 'cylinder', sides: 24, w: 3, d: 3, h: 0.5, material: 'brushed-steel' }] }))).toEqual([]);
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0, shape: 'blob' }] })).some((e) => e.includes(".shape must be 'box' or 'cylinder'"))).toBe(true);
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0, shape: 'cylinder', sides: 3 }] })).some((e) => e.includes('.sides must be a number >= 6'))).toBe(true);
    const N = 24;
    const { extraFaces } = buildTerrainWorldMesh(base({ builds: [{ x: 0, y: -9, shape: 'cylinder', sides: N, w: 3, d: 3, h: 0.5, material: 'brushed-steel' }] }));
    const cf = extraFaces.filter((f) => f.material === 'brushed-steel');
    expect(cf.length).toBe(N * 2);   // one side quad + one cap wedge per facet
    // every vertex lies within the disc radius (1.5) of the centre
    for (const f of cf) for (const c of f.corners) expect(Math.hypot(c[0] - 0, c[1] - -9)).toBeLessThanOrEqual(1.5 + 1e-6);
  });

  it('rotZ spins the footprint about its centre (45° box grows its x-extent by √2)', () => {
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: -9, w: 2, d: 2, h: 1, rotZ: 45, material: 'brushed-hull' }] }))).toEqual([]);
    expect(validatePaintedLandscape(base({ builds: [{ x: 0, y: 0, rotZ: 'sideways' }] })).some((e) => e.includes('.rotZ must be a finite number'))).toBe(true);
    const spanX = (fs) => { let lo = Infinity, hi = -Infinity; for (const f of fs) for (const c of f.corners) { if (c[0] < lo) lo = c[0]; if (c[0] > hi) hi = c[0]; } return hi - lo; };
    const straight = buildTerrainWorldMesh(base({ builds: [{ x: 0, y: -9, w: 2, d: 2, h: 1, material: 'brushed-hull' }] })).extraFaces.filter((f) => f.material);
    const turned = buildTerrainWorldMesh(base({ builds: [{ x: 0, y: -9, w: 2, d: 2, h: 1, rotZ: 45, material: 'brushed-hull' }] })).extraFaces.filter((f) => f.material);
    expect(spanX(straight)).toBeCloseTo(2, 5);
    expect(spanX(turned)).toBeCloseTo(2 * Math.SQRT2, 4);   // diagonal of a 2×2 square
  });

  it('extent scales the builds with the terrain', () => {
    const b = { builds: [{ x: 0, y: -9, w: 4, d: 4, h: 2 }] };
    const plain = buildTerrainWorldMesh(base(b)).extraFaces.filter((f) => f.material);
    const scaled = buildTerrainWorldMesh(base({ ...b, extent: 2 })).extraFaces.filter((f) => f.material);
    const spanX = (fs) => { let lo = Infinity, hi = -Infinity; for (const f of fs) for (const c of f.corners) { if (c[0] < lo) lo = c[0]; if (c[0] > hi) hi = c[0]; } return hi - lo; };
    expect(spanX(scaled) / spanX(plain)).toBeCloseTo(2, 5);
  });

  it('absent builds emit no material faces (byte-identical guarantee)', () => {
    const { extraFaces } = buildTerrainWorldMesh(base());
    expect(extraFaces.some((f) => f.material)).toBe(false);
  });

  it('is deterministic', () => {
    const b = base({ builds: [{ x: 0, y: -9, w: 4, d: 4, h: 2, material: 'brushed-hull' }] });
    expect(buildTerrainWorldMesh(b).faces).toEqual(buildTerrainWorldMesh(b).faces);
  });
});
