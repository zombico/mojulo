import { describe, it, expect } from 'vitest';
import { printWaveManji, validateWaveManji, waveManjiScriptIds } from './wave-manji.js';
import { GOLDEN_ANGLE, GOLDEN_RATIO } from './wave-manji-scripts/util.js';
import { walkManjiTree3D } from './manji-program.js';

const ORIGIN = { x: 0, y: 0, z: 0 };
const PHYSICS = { gravity: { x: 0, y: 0, z: -1 } };

function singleSlotScene() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [{ id: 'center', position: { x: 0, y: 0, z: 0 } }],
  };
}

// ─── validator ────────────────────────────────────────────────────────

describe('validateWaveManji — mint-time check', () => {
  const emitted = walkManjiTree3D(singleSlotScene());

  it('accepts a minimal endpoint-path spec', () => {
    const errors = validateWaveManji(
      [{ singularity: 'world/slot/center', script: 'ouroboros' }],
      emitted,
    );
    expect(errors).toEqual([]);
  });

  it('accepts a {x,y,z} singularity', () => {
    const errors = validateWaveManji(
      [{ singularity: { x: 1, y: 2, z: 3 }, script: 'mandala' }],
      emitted,
    );
    expect(errors).toEqual([]);
  });

  it('rejects missing singularity', () => {
    const errors = validateWaveManji([{ script: 'ouroboros' }], emitted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/waveManji\[0\]\.singularity: required/);
  });

  it('reports a bad endpoint path with array index', () => {
    const errors = validateWaveManji(
      [{ singularity: 'world/slot/missing', script: 'ouroboros' }],
      emitted,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/waveManji\[0\]\.singularity:/);
    expect(errors[0]).toMatch(/slot 'missing'/);
  });

  it('rejects an unknown script', () => {
    const errors = validateWaveManji(
      [{ singularity: ORIGIN, script: 'fake-script' }],
      emitted,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/waveManji\[0\]\.script: must be one of/);
  });

  it('returns an empty array for a non-array input', () => {
    expect(validateWaveManji(undefined, emitted)).toEqual([]);
    expect(validateWaveManji(null, emitted)).toEqual([]);
  });
});

// ─── printer per-archetype ────────────────────────────────────────────

describe('printWaveManji — per-archetype', () => {
  it('exposes every script id through waveManjiScriptIds()', () => {
    const ids = waveManjiScriptIds();
    expect(ids).toContain('ouroboros');
    expect(ids).toContain('mandala');
    expect(ids).toContain('wind-chime');
    expect(ids).toContain('rasengan');
    expect(ids).toContain('rasengan-sphere');
    expect(ids).toContain('smoke-ring');
    expect(ids).toContain('celtic');
    expect(ids).toContain('cloud');
    expect(ids).toContain('tusk');
    expect(ids).toContain('helix');
  });

  it('ouroboros emits exactly 1 polyline that closes back on itself', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'ouroboros' },
      PHYSICS,
    );
    expect(polylines).toHaveLength(1);
    const poly = polylines[0];
    expect(poly.length).toBeGreaterThan(8);
    const first = poly[0];
    const last = poly[poly.length - 1];
    // Closed loop: last sample should land within numerical tolerance of first.
    expect(Math.abs(first.x - last.x)).toBeLessThan(1e-6);
    expect(Math.abs(first.y - last.y)).toBeLessThan(1e-6);
    expect(Math.abs(first.z - last.z)).toBeLessThan(1e-6);
  });

  it('mandala with N=6 emits exactly 6 polylines', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'mandala', params: { N: 6 } },
      PHYSICS,
    );
    expect(polylines).toHaveLength(6);
  });

  it('wind-chime with N=8 emits exactly 8 sub-loops', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'wind-chime', params: { N: 8 } },
      PHYSICS,
    );
    expect(polylines).toHaveLength(8);
  });

  it('rasengan emits the requested pass count via density', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'rasengan', density: 12 },
      PHYSICS,
    );
    expect(polylines).toHaveLength(12);
  });

  it('smoke-ring emits N=24 cross-sections by default', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'smoke-ring' },
      PHYSICS,
    );
    expect(polylines).toHaveLength(24);
  });

  it('celtic emits one continuous closed polyline', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'celtic' },
      PHYSICS,
    );
    expect(polylines).toHaveLength(1);
    const poly = polylines[0];
    const first = poly[0];
    const last = poly[poly.length - 1];
    expect(Math.abs(first.x - last.x)).toBeLessThan(1e-6);
    expect(Math.abs(first.y - last.y)).toBeLessThan(1e-6);
    expect(Math.abs(first.z - last.z)).toBeLessThan(1e-6);
  });

  it('cloud emits the requested pass count via density', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'cloud', density: 10, seed: 'fixed' },
      PHYSICS,
    );
    expect(polylines).toHaveLength(10);
  });

  it('rasengan-sphere keeps the singularity fixed while tilting the basis', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'rasengan-sphere', density: 20, params: { totalTilt: Math.PI } },
      PHYSICS,
    );
    expect(polylines).toHaveLength(20);
    // Drop the duplicated closing sample (i = N closes back to i = 0) so
    // the centroid is the true loop center, not biased by an extra point.
    for (const poly of polylines) {
      const open = poly.slice(0, poly.length - 1);
      const cx = open.reduce((s, p) => s + p.x, 0) / open.length;
      const cy = open.reduce((s, p) => s + p.y, 0) / open.length;
      const cz = open.reduce((s, p) => s + p.z, 0) / open.length;
      expect(Math.abs(cx)).toBeLessThan(1e-9);
      expect(Math.abs(cy)).toBeLessThan(1e-9);
      expect(Math.abs(cz)).toBeLessThan(1e-9);
    }
  });

  it("rasengan accepts phaseStep: 'golden' and matches numeric GOLDEN_ANGLE", () => {
    const named = printWaveManji(
      { singularity: ORIGIN, script: 'rasengan', density: 8, params: { phaseStep: 'golden' } },
      PHYSICS,
    ).polylines;
    const numeric = printWaveManji(
      { singularity: ORIGIN, script: 'rasengan', density: 8, params: { phaseStep: GOLDEN_ANGLE } },
      PHYSICS,
    ).polylines;
    expect(named).toEqual(numeric);
  });

  it('tusk produces an exponential golden-spiral expansion', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'tusk', density: 12 },
      PHYSICS,
    );
    expect(polylines).toHaveLength(12);
    // Verify the radial expansion ratio between successive passes matches
    // the expected per-pass growth: φ^(phaseStep / 2π).
    const expectedPerPass = Math.pow(GOLDEN_RATIO, GOLDEN_ANGLE / (2 * Math.PI));
    const firstRadius = avgRadius(polylines[0], ORIGIN);
    const secondRadius = avgRadius(polylines[1], ORIGIN);
    const ratio = secondRadius / firstRadius;
    expect(Math.abs(ratio - expectedPerPass)).toBeLessThan(0.01);
  });

  it('tusk with precess: false stays in the original plane', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'tusk', density: 12, params: { precess: false } },
      PHYSICS,
    );
    let maxAbsZ = 0;
    for (const poly of polylines) {
      for (const p of poly) {
        if (Math.abs(p.z) > maxAbsZ) maxAbsZ = Math.abs(p.z);
      }
    }
    expect(maxAbsZ).toBeLessThan(1e-6);
  });

  it('tusk default (precess: true) sweeps the plane through space', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'tusk', density: 12 },
      PHYSICS,
    );
    let maxAbsZ = 0;
    for (const poly of polylines) {
      for (const p of poly) {
        if (Math.abs(p.z) > maxAbsZ) maxAbsZ = Math.abs(p.z);
      }
    }
    expect(maxAbsZ).toBeGreaterThan(0.1);
  });

  it('helix translates the loop center along the axis per pass', () => {
    // Default axis is the plane normal; with PHYSICS gravity = (0,0,-1) the
    // plane normal = (0,0,-1), so successive loops should differ in Z by
    // ±pitch. We compare averaged Z centroids per pass — the deltas should
    // all equal pitch (sign tracked from start = -extent/2 to end = +extent/2).
    const pitch = 0.5;
    const passes = 8;
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'helix', density: passes, params: { N: 0, radius: 1, pitch, phaseStep: 0.1 } },
      PHYSICS,
    );
    expect(polylines).toHaveLength(passes);
    const centroidsZ = polylines.map((poly) => {
      const open = poly.slice(0, poly.length - 1);
      return open.reduce((s, p) => s + p.z, 0) / open.length;
    });
    // Run is centered on singularity: extent = pitch*(passes-1); first centroid
    // at -extent/2 along axis (which has z = -1), last at +extent/2 along axis.
    // So centroid Z values run from +(extent/2) to -(extent/2) — pitch = 0.5,
    // passes = 8 → extent = 3.5, first z = +1.75, last z = -1.75.
    const extent = pitch * (passes - 1);
    expect(Math.abs(centroidsZ[0] - extent / 2)).toBeLessThan(1e-9);
    expect(Math.abs(centroidsZ[passes - 1] + extent / 2)).toBeLessThan(1e-9);
    // Each step Δz = -pitch (axis z = -1).
    for (let i = 1; i < passes; i += 1) {
      expect(Math.abs((centroidsZ[i] - centroidsZ[i - 1]) + pitch)).toBeLessThan(1e-9);
    }
  });

  it('helix with phaseStep > 0 spirals — consecutive loops rotate in-plane', () => {
    // With a non-zero phase step and a single n=N harmonic, the LOBE
    // positions rotate per pass. Compare each loop's first sample's
    // in-plane angle: it should advance by exactly phaseStep.
    const phaseStep = 0.2;
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'helix', density: 6,
        params: { N: 6, radius: 1, lobeDepth: 0, pitch: 0.1, phaseStep } },
      PHYSICS,
    );
    // Each loop's first sample's in-plane angle should advance by exactly
    // ±phaseStep between consecutive passes — the direction (positive vs.
    // negative atan2 delta) depends on the basis handedness derived from
    // the scene's gravity normal, which is an implementation detail. What
    // matters for the spiraling behavior is that the magnitude is right
    // and the direction is consistent across passes.
    const angles = polylines.map((poly) => Math.atan2(poly[0].y, poly[0].x));
    const deltas = [];
    for (let i = 1; i < angles.length; i += 1) {
      const raw = angles[i] - angles[i - 1];
      const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
      deltas.push(wrapped);
    }
    for (const d of deltas) {
      expect(Math.abs(Math.abs(d) - phaseStep)).toBeLessThan(1e-9);
    }
    // Consistent direction across passes.
    const firstSign = Math.sign(deltas[0]);
    for (const d of deltas) expect(Math.sign(d)).toBe(firstSign);
  });

  it('helix with N=0 (smooth spring) emits the requested pass count', () => {
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'helix', density: 10, params: { N: 0, pitch: 0.3 } },
      PHYSICS,
    );
    expect(polylines).toHaveLength(10);
  });

  it('helix bending damps the pitch (tighter coil)', () => {
    const tight = printWaveManji(
      { singularity: ORIGIN, script: 'helix', bending: 2.0, density: 6, params: { N: 0, pitch: 0.5 } },
      PHYSICS,
    ).polylines;
    const loose = printWaveManji(
      { singularity: ORIGIN, script: 'helix', bending: 0.5, density: 6, params: { N: 0, pitch: 0.5 } },
      PHYSICS,
    ).polylines;
    const zRange = (polys) => {
      let minZ = Infinity, maxZ = -Infinity;
      for (const poly of polys) for (const p of poly) {
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      return maxZ - minZ;
    };
    expect(zRange(tight)).toBeLessThan(zRange(loose));
  });

  it('rasengan-sphere sweeps loops out of the original plane', () => {
    // Default plane is gravity = (0,0,-1), so the flat-rasengan loops live
    // in the xy plane and have z ≈ 0 everywhere. rasengan-sphere with a
    // half-sweep should produce loops whose z extents are non-trivial.
    const { polylines } = printWaveManji(
      { singularity: ORIGIN, script: 'rasengan-sphere', density: 20, params: { totalTilt: Math.PI, maxRadius: 1.0 } },
      PHYSICS,
    );
    let maxAbsZ = 0;
    for (const poly of polylines) {
      for (const p of poly) {
        if (Math.abs(p.z) > maxAbsZ) maxAbsZ = Math.abs(p.z);
      }
    }
    expect(maxAbsZ).toBeGreaterThan(0.3);
  });
});

// ─── determinism + bending semantics ──────────────────────────────────

describe('printWaveManji — determinism + bending', () => {
  it('same spec + same seed produces identical output (cloud)', () => {
    const spec = { singularity: ORIGIN, script: 'cloud', seed: 'leaf-7', density: 6 };
    const a = printWaveManji(spec, PHYSICS).polylines;
    const b = printWaveManji(spec, PHYSICS).polylines;
    expect(a).toEqual(b);
  });

  it('different seeds produce different clouds', () => {
    const a = printWaveManji({ singularity: ORIGIN, script: 'cloud', seed: 'a', density: 6 }, PHYSICS).polylines;
    const b = printWaveManji({ singularity: ORIGIN, script: 'cloud', seed: 'b', density: 6 }, PHYSICS).polylines;
    // Polyline counts are equal but at least one sample differs.
    expect(a.length).toBe(b.length);
    let anyDiff = false;
    outer: for (let i = 0; i < a.length; i += 1) {
      for (let j = 0; j < a[i].length; j += 1) {
        if (Math.abs(a[i][j].x - b[i][j].x) > 1e-9 || Math.abs(a[i][j].y - b[i][j].y) > 1e-9) {
          anyDiff = true;
          break outer;
        }
      }
    }
    expect(anyDiff).toBe(true);
  });

  it('stronger bending shrinks the rasengan outer radius', () => {
    const tightSpec = { singularity: ORIGIN, script: 'rasengan', bending: 2.0, density: 20 };
    const looseSpec = { singularity: ORIGIN, script: 'rasengan', bending: 0.5, density: 20 };
    const tight = printWaveManji(tightSpec, PHYSICS).polylines;
    const loose = printWaveManji(looseSpec, PHYSICS).polylines;
    const tightOuterR = maxRadius(tight[tight.length - 1], ORIGIN);
    const looseOuterR = maxRadius(loose[loose.length - 1], ORIGIN);
    // bending 2.0 caps maxRadius at 0.5; bending 0.5 lets it reach 2.0.
    expect(tightOuterR).toBeLessThan(looseOuterR);
  });

  it('rejects a string singularity at print time', () => {
    expect(() =>
      printWaveManji({ singularity: 'world/slot/center', script: 'ouroboros' }, PHYSICS),
    ).toThrow(/singularity must be \{x,y,z\}/);
  });

  it('rejects an unknown script at print time', () => {
    expect(() =>
      printWaveManji({ singularity: ORIGIN, script: 'fake' }, PHYSICS),
    ).toThrow(/unknown script 'fake'/);
  });
});

function maxRadius(poly, center) {
  let max = 0;
  for (const p of poly) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const dz = p.z - center.z;
    const r = Math.hypot(dx, dy, dz);
    if (r > max) max = r;
  }
  return max;
}

function avgRadius(poly, center) {
  // Use open loop (drop the duplicated closing sample) so the average
  // isn't biased by counting the start point twice.
  const open = poly.slice(0, poly.length - 1);
  let sum = 0;
  for (const p of open) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const dz = p.z - center.z;
    sum += Math.hypot(dx, dy, dz);
  }
  return sum / open.length;
}
