import { describe, it, expect } from 'vitest';
import {
  buildEndpointResolver,
  validateConnections,
  sampleLineBetween,
  sampleLineBetweenVolumized,
  arcLengthOfLineBetween,
  defaultPhysics,
} from './line-between.js';
import { walkManjiTree3D } from './manji-program.js';

// Fixture: two tiny tower manjis at known world positions. Their
// Zenith-Nadir bars terminate at predictable points; their `top` slots
// sit even higher. Used for both resolver and sampler tests.
function towerScene() {
  const towerSpine = (height) => ({
    spine: {
      bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'closed' }, lengthScale: height },
      bar1: { axis: 'N-S',          tails: { N: 'open', S: 'open' },             lengthScale: 0.4 },
      bar2: { axis: 'E-W',          tails: { W: 'open', E: 'open' },             lengthScale: 0.4 },
    },
    slots: [{ id: 'top', position: { x: 0, y: 0, z: 5 } }],
  });
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'L', position: { x: -6, y: 0, z: 0 } },
      { id: 'R', position: { x:  6, y: 0, z: 0 } },
    ],
    children: [
      { slot: 'L', node: { id: 'tower-L', ...towerSpine(2) } },
      { slot: 'R', node: { id: 'tower-R', ...towerSpine(2) } },
    ],
  };
}

describe('buildEndpointResolver — path grammar', () => {
  const emitted = walkManjiTree3D(towerScene());
  const resolve = buildEndpointResolver(emitted);

  it('resolves slot paths to world XYZ', () => {
    const p = resolve('tower-L/slot/top');
    expect(p).toEqual({ x: -6, y: 0, z: 5 });
  });

  it('resolves bar tip paths to world XYZ', () => {
    const p = resolve('tower-L/bar/Zenith-Nadir/posTip');
    // bar3 at lengthScale=2: posEnd at +2, posTip at +2 + 2 = +4 (Zenith open)
    expect(p).toEqual({ x: -6, y: 0, z: 4 });
  });

  it('resolves both endpoints of a connection independently', () => {
    expect(resolve('tower-L/bar/Zenith-Nadir/posTip')).toEqual({ x: -6, y: 0, z: 4 });
    expect(resolve('tower-R/bar/Zenith-Nadir/posTip')).toEqual({ x:  6, y: 0, z: 4 });
  });

  it('throws on unknown node id with the available ids in the error', () => {
    expect(() => resolve('tower-X/slot/top')).toThrow(/unknown node id 'tower-X'.*world.*tower-L.*tower-R/);
  });

  it('throws on unknown slot with available slots in the error', () => {
    expect(() => resolve('tower-L/slot/nope')).toThrow(/slot 'nope' not on node 'tower-L'.*top/);
  });

  it('throws on unknown axis with available axes in the error', () => {
    expect(() => resolve('tower-L/bar/Vertical/posTip')).toThrow(/bar 'Vertical' not on node 'tower-L'/);
  });

  it('throws on unknown point name with the available list', () => {
    expect(() => resolve('tower-L/bar/Zenith-Nadir/middleTip')).toThrow(/point 'middleTip'.*center.*negEnd.*posEnd.*negTip.*posTip/);
  });

  it('throws on malformed paths (missing slash)', () => {
    expect(() => resolve('tower-L')).toThrow(/must be a string like/);
  });

  it("throws when the second segment is not 'slot' or 'bar'", () => {
    expect(() => resolve('tower-L/something/top')).toThrow(/second segment must be 'slot' or 'bar'/);
  });
});

describe('validateConnections — mint-time check', () => {
  const emitted = walkManjiTree3D(towerScene());

  it('returns no errors for well-formed connections', () => {
    const errors = validateConnections([
      { from: 'tower-L/bar/Zenith-Nadir/posTip', to: 'tower-R/bar/Zenith-Nadir/posTip' },
    ], emitted);
    expect(errors).toEqual([]);
  });

  it('reports a path-naming-aware error per bad endpoint', () => {
    const errors = validateConnections([
      { from: 'tower-L/slot/missing', to: 'tower-R/bar/Zenith-Nadir/posTip' },
    ], emitted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/connections\[0\]\.from:/);
    expect(errors[0]).toMatch(/slot 'missing' not on node 'tower-L'/);
  });

  it('reports both ends independently when both are wrong', () => {
    const errors = validateConnections([
      { from: 'nope/slot/top', to: 'nope-too/slot/top' },
    ], emitted);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/connections\[0\]\.from:/);
    expect(errors[1]).toMatch(/connections\[0\]\.to:/);
  });

  it('returns no errors for an empty list or undefined input', () => {
    expect(validateConnections([], emitted)).toEqual([]);
    expect(validateConnections(undefined, emitted)).toEqual([]);
  });
});

describe('sampleLineBetween — curve geometry', () => {
  const from = { x: -8, y: 0, z: 6 };
  const to   = { x:  8, y: 0, z: 6 };

  it('emits samples+1 points pinned at the endpoints', () => {
    const pts = sampleLineBetween({ from, to }, defaultPhysics());
    expect(pts.length).toBeGreaterThan(8);
    expect(pts[0]).toEqual(from);
    expect(pts[pts.length - 1]).toEqual(to);
  });

  it('default half-cycle sag follows gravity downward (lower z at midpoint)', () => {
    const pts = sampleLineBetween({ from, to }, defaultPhysics());
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.z).toBeLessThan(from.z);
  });

  it('negative sag bulges UP against gravity (higher z at midpoint)', () => {
    const pts = sampleLineBetween({ from, to, sag: -3 }, defaultPhysics());
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.z).toBeGreaterThan(from.z);
  });

  it('sag=0 produces a straight line (interior points lie on the chord)', () => {
    const pts = sampleLineBetween({ from, to, sag: 0 }, defaultPhysics());
    for (const p of pts) {
      expect(Math.abs(p.z - 6)).toBeLessThan(1e-9);
    }
  });

  it('explicit plane overrides gravity-perpendicular default', () => {
    // Force displacement in +Y rather than -Z.
    const pts = sampleLineBetween({ from, to, sag: 2, plane: { x: 0, y: 1, z: 0 } }, defaultPhysics());
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.y).toBeGreaterThan(0);
    expect(Math.abs(mid.z - 6)).toBeLessThan(1e-9);
  });

  it('multi-wavelength wave crosses the chord multiple times', () => {
    const pts = sampleLineBetween({
      from, to,
      sag: 1,
      wavelengths: 4,
      plane: { x: 0, y: 0, z: 1 },
      samples: 200,
    }, defaultPhysics());
    let crossings = 0;
    let prevSign = 0;
    for (const p of pts) {
      const dz = p.z - 6;
      const s = Math.sign(dz);
      if (s !== 0 && prevSign !== 0 && s !== prevSign) crossings += 1;
      if (s !== 0) prevSign = s;
    }
    // 4 full cycles → 8 zero crossings (minus the two pinned endpoints).
    expect(crossings).toBeGreaterThanOrEqual(7);
  });

  it('vertical segment (colinear with gravity) falls back to a stable plane', () => {
    // Pure vertical line; gravity perpendicular component is zero. Sampler
    // should still emit finite samples without dividing by zero.
    const pts = sampleLineBetween(
      { from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 5 } },
      defaultPhysics(),
    );
    for (const p of pts) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
  });

  it('honors physics.gravityStrength multiplier on auto-sag', () => {
    const lunar = { ...defaultPhysics(), gravityStrength: 0.166 };
    const earthPts = sampleLineBetween({ from, to }, defaultPhysics());
    const lunarPts = sampleLineBetween({ from, to }, lunar);
    const earthMidDz = 6 - earthPts[Math.floor(earthPts.length / 2)].z;
    const lunarMidDz = 6 - lunarPts[Math.floor(lunarPts.length / 2)].z;
    expect(lunarMidDz).toBeLessThan(earthMidDz);
    expect(lunarMidDz / earthMidDz).toBeCloseTo(0.166, 2);
  });

  it('throws if from or to is missing', () => {
    expect(() => sampleLineBetween({ to }, defaultPhysics())).toThrow(/from.*to.*required/);
    expect(() => sampleLineBetween({ from }, defaultPhysics())).toThrow(/from.*to.*required/);
  });

  describe('relativeSag precedence', () => {
    const fromPt = { x: -8, y: 0, z: 6 };
    const toPt   = { x:  8, y: 0, z: 6 };
    const span = 16;
    const physics = defaultPhysics();

    it('relativeSag scales sag by span (portable across endpoint distances)', () => {
      // relativeSag = -0.25 → sag = -0.25 × 16 = -4 (UP against gravity)
      const pts = sampleLineBetween({ from: fromPt, to: toPt, relativeSag: -0.25 }, physics);
      const mid = pts[Math.floor(pts.length / 2)];
      // Negative sag → midpoint z increases by 4 (against gravity = -Z).
      expect(mid.z).toBeCloseTo(10, 4);
    });

    it('relativeSag stays consistent at different spans (a 32-unit span gets a sag of -8)', () => {
      const farTo = { x: 24, y: 0, z: 6 };
      const pts = sampleLineBetween({ from: fromPt, to: farTo, relativeSag: -0.25 }, physics);
      const mid = pts[Math.floor(pts.length / 2)];
      expect(mid.z).toBeCloseTo(6 + 8, 4); // span 32 × 0.25 = 8
    });

    it('explicit sag wins over relativeSag when both are provided', () => {
      const pts = sampleLineBetween(
        { from: fromPt, to: toPt, sag: -1, relativeSag: -0.25 },
        physics,
      );
      const mid = pts[Math.floor(pts.length / 2)];
      // sag wins → -1 → midpoint z = 6 + 1 = 7 (not 10).
      expect(mid.z).toBeCloseTo(7, 4);
    });

    it('relativeSag overrides physics auto-sag', () => {
      // Physics defaultSagFactor = 0.12; relativeSag = 0.30 should win.
      const pts = sampleLineBetween({ from: fromPt, to: toPt, relativeSag: 0.30 }, physics);
      const mid = pts[Math.floor(pts.length / 2)];
      // span × 0.30 = 4.8, gravity-down (with-gravity) → z decreases by 4.8
      expect(mid.z).toBeCloseTo(6 - 4.8, 4);
    });

    it('neither sag nor relativeSag falls through to auto-sag', () => {
      const pts = sampleLineBetween({ from: fromPt, to: toPt }, physics);
      const mid = pts[Math.floor(pts.length / 2)];
      const expected = 6 - span * physics.defaultSagFactor * physics.gravityStrength;
      expect(mid.z).toBeCloseTo(expected, 4);
    });

    it('relativeSag = 0 yields a straight line just like sag = 0', () => {
      const pts = sampleLineBetween({ from: fromPt, to: toPt, relativeSag: 0 }, physics);
      // Number.isFinite(0) is true, so 0 × span = 0, straight line.
      for (const p of pts) {
        expect(Math.abs(p.z - 6)).toBeLessThan(1e-9);
      }
    });
  });
});

describe('defaultPhysics', () => {
  it('returns Earth-like defaults', () => {
    const p = defaultPhysics();
    expect(p.gravity).toEqual({ x: 0, y: 0, z: -1 });
    expect(p.gravityStrength).toBe(1);
    expect(p.defaultSagFactor).toBeGreaterThan(0);
    expect(p.defaultSagFactor).toBeLessThan(1);
  });
});

describe('modes — richer Fourier (Phase 1)', () => {
  const from = { x: -8, y: 0, z: 6 };
  const to   = { x:  8, y: 0, z: 6 };
  const physics = { ...defaultPhysics(), defaultSagFactor: 0 };

  it('explicit modes override sag/wavelengths', () => {
    const pts = sampleLineBetween({ from, to, modes: [{ amplitude: -2, cycles: 0.5 }] }, physics);
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.z).toBeCloseTo(8, 4);
  });

  it('sums multiple modes', () => {
    const pts = sampleLineBetween({
      from, to,
      modes: [
        { amplitude: 1, cycles: 0.5 },
        { amplitude: 0, cycles: 1.5 },
      ],
    }, physics);
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.z).toBeCloseTo(5, 3);
  });

  it('empty modes array falls through to legacy sag/wavelengths shim', () => {
    const earth = defaultPhysics();
    const pts = sampleLineBetween({ from, to, modes: [], sag: -1 }, earth);
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid.z).toBeCloseTo(7, 3);
  });
});

describe('sampleLineBetweenVolumized — Phase 1 (lateral) + Phase 2 (tube)', () => {
  const from = { x: -4, y: 0, z: 0 };
  const to   = { x:  4, y: 0, z: 0 };
  const physics = { ...defaultPhysics(), defaultSagFactor: 0 };

  it('lateral returns matched-length centerline + edge polylines', () => {
    const r = sampleLineBetweenVolumized({
      from, to, sag: 0, crossSection: 'lateral', radius: 0.3,
    }, physics);
    expect(r.kind).toBe('lateral');
    expect(r.leftEdge.length).toBe(r.centerline.length);
    expect(r.rightEdge.length).toBe(r.centerline.length);
  });

  it('lateral edges are offset by the resolved radius from the centerline', () => {
    const r = sampleLineBetweenVolumized({
      from, to, sag: 0, crossSection: 'lateral', radius: 0.5,
    }, physics);
    const mid = Math.floor(r.centerline.length / 2);
    const dL = Math.hypot(
      r.leftEdge[mid].x - r.centerline[mid].x,
      r.leftEdge[mid].y - r.centerline[mid].y,
      r.leftEdge[mid].z - r.centerline[mid].z,
    );
    expect(dL).toBeCloseTo(0.5, 5);
  });

  it('radius profile interpolates linearly between control points', () => {
    const r = sampleLineBetweenVolumized({
      from, to, sag: 0, crossSection: 'lateral',
      radius: [{ t: 0, r: 0.1 }, { t: 1, r: 0.5 }],
    }, physics);
    const mid = Math.floor(r.centerline.length / 2);
    const dMid = Math.hypot(
      r.leftEdge[mid].x - r.centerline[mid].x,
      r.leftEdge[mid].y - r.centerline[mid].y,
      r.leftEdge[mid].z - r.centerline[mid].z,
    );
    expect(dMid).toBeCloseTo(0.3, 2);
  });

  it('tube returns one K-sample ring per centerline station', () => {
    const r = sampleLineBetweenVolumized({
      from, to, sag: 0, crossSection: 'tube', radius: 0.3, ringSamples: 8,
    }, physics);
    expect(r.kind).toBe('tube');
    expect(r.rings.length).toBe(r.centerline.length);
    for (const ring of r.rings) {
      expect(ring.length).toBe(8);
    }
  });

  it('tube ring points sit at the resolved radius from the centerline', () => {
    const r = sampleLineBetweenVolumized({
      from, to, sag: 0, crossSection: 'tube', radius: 0.4, ringSamples: 12,
    }, physics);
    const mid = Math.floor(r.centerline.length / 2);
    for (const rp of r.rings[mid]) {
      const d = Math.hypot(
        rp.x - r.centerline[mid].x,
        rp.y - r.centerline[mid].y,
        rp.z - r.centerline[mid].z,
      );
      expect(d).toBeCloseTo(0.4, 4);
    }
  });

  it("errors when crossSection is set without a radius", () => {
    expect(() => sampleLineBetweenVolumized(
      { from, to, sag: 0, crossSection: 'lateral' },
      physics,
    )).toThrow(/radius is required/);
  });
});

describe('arcLengthOfLineBetween — Phase 3 numerical quadrature', () => {
  const physics = { ...defaultPhysics(), defaultSagFactor: 0 };

  it('returns the chord length for a straight line', () => {
    const from = { x: 0, y: 0, z: 0 };
    const to   = { x: 1, y: 0, z: 0 };
    const len = arcLengthOfLineBetween({ from, to, sag: 0 }, physics);
    expect(len).toBeCloseTo(1, 4);
  });

  it('returns more than the chord for a sagged line', () => {
    const from = { x: 0, y: 0, z: 0 };
    const to   = { x: 1, y: 0, z: 0 };
    const straight = arcLengthOfLineBetween({ from, to, sag: 0 }, physics);
    const sagged = arcLengthOfLineBetween({ from, to, modes: [{ amplitude: -0.3, cycles: 0.5 }] }, physics);
    expect(sagged).toBeGreaterThan(straight);
  });
});

describe('lengthMode preserve — Phase 3 reification validation', () => {
  const emitted = walkManjiTree3D(towerScene());
  const physics = { ...defaultPhysics(), defaultSagFactor: 0 };

  // L↔R world distance in towerScene = 12 (slot L at x=-6, slot R at x=6).
  it('accepts preserve when limbLength matches the chord (sag=0, within tolerance)', () => {
    const errors = validateConnections([
      {
        from: 'tower-L/slot/top', to: 'tower-R/slot/top',
        sag: 0,
        lengthMode: 'preserve',
        limbLength: 12,
      },
    ], emitted, physics);
    expect(errors).toEqual([]);
  });

  it('rejects preserve when limbLength is too short for the chord', () => {
    const errors = validateConnections([
      {
        from: 'tower-L/slot/top', to: 'tower-R/slot/top',
        sag: 0,
        lengthMode: 'preserve',
        limbLength: 8,
      },
    ], emitted, physics);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/lengthMode 'preserve' violated/);
    expect(errors[0]).toMatch(/limbLength 8\.000/);
  });

  it('rejects preserve when limbLength is much longer than the wave can fit', () => {
    const errors = validateConnections([
      {
        from: 'tower-L/slot/top', to: 'tower-R/slot/top',
        sag: 0,
        lengthMode: 'preserve',
        limbLength: 30,
      },
    ], emitted, physics);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/limbLength 30\.000/);
  });

  it('accepts a sagged wave whose arc length matches limbLength', () => {
    const len = arcLengthOfLineBetween(
      { from: { x: -6, y: 0, z: 5 }, to: { x: 6, y: 0, z: 5 }, modes: [{ amplitude: -2, cycles: 0.5 }] },
      physics,
    );
    const errors = validateConnections([
      {
        from: 'tower-L/slot/top', to: 'tower-R/slot/top',
        modes: [{ amplitude: -2, cycles: 0.5 }],
        lengthMode: 'preserve',
        limbLength: len,
      },
    ], emitted, physics);
    expect(errors).toEqual([]);
  });

  it("errors when lengthMode='preserve' is set without limbLength", () => {
    const errors = validateConnections([
      { from: 'tower-L/slot/top', to: 'tower-R/slot/top', lengthMode: 'preserve' },
    ], emitted, physics);
    expect(errors.some((e) => /requires limbLength/.test(e))).toBe(true);
  });
});

describe('volume-spec range validation — Phase 1/3 shape checks', () => {
  const emitted = walkManjiTree3D(towerScene());

  it('rejects unknown crossSection kinds', () => {
    const errors = validateConnections([
      { from: 'tower-L/slot/top', to: 'tower-R/slot/top', crossSection: 'wrong', radius: 0.1 },
    ], emitted);
    expect(errors.some((e) => /crossSection/.test(e))).toBe(true);
  });

  it('rejects crossSection set without a radius', () => {
    const errors = validateConnections([
      { from: 'tower-L/slot/top', to: 'tower-R/slot/top', crossSection: 'lateral' },
    ], emitted);
    expect(errors.some((e) => /requires a radius/.test(e))).toBe(true);
  });

  it('rejects negative radius', () => {
    const errors = validateConnections([
      { from: 'tower-L/slot/top', to: 'tower-R/slot/top', crossSection: 'lateral', radius: -0.1 },
    ], emitted);
    expect(errors.some((e) => /non-negative/.test(e))).toBe(true);
  });

  it('rejects mode with non-positive cycles', () => {
    const errors = validateConnections([
      { from: 'tower-L/slot/top', to: 'tower-R/slot/top', modes: [{ amplitude: 1, cycles: 0 }] },
    ], emitted);
    expect(errors.some((e) => /cycles/.test(e))).toBe(true);
  });
});
