import { describe, it, expect } from 'vitest';
import { sampleWaveField, validateWaveFields } from './wave-field.js';
import { walkManjiTree3D } from './manji-program.js';

// Fixture: a "world" manji with 4 corner slots at known positions on
// the z=0 plane. Used as both the validator's emitted-nodes source and
// as the corner-resolution target for sampleWaveField tests.
function floorPlanScene() {
  return {
    id: 'world',
    spine: {
      bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.3 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [
      { id: 'nw', position: { x: -10, y: -10, z: 0 } }, // u=0, v=0
      { id: 'ne', position: { x:  10, y: -10, z: 0 } }, // u=1, v=0
      { id: 'se', position: { x:  10, y:  10, z: 0 } }, // u=1, v=1
      { id: 'sw', position: { x: -10, y:  10, z: 0 } }, // u=0, v=1
    ],
  };
}

const PHYSICS = { gravity: { x: 0, y: 0, z: -1 } };

function squareCorners() {
  return [
    { x: -10, y: -10, z: 0 },
    { x:  10, y: -10, z: 0 },
    { x:  10, y:  10, z: 0 },
    { x: -10, y:  10, z: 0 },
  ];
}

describe('validateWaveFields — mint-time check', () => {
  const emitted = walkManjiTree3D(floorPlanScene());

  it('accepts a flat field (no waves) with 4 valid corner paths', () => {
    const errors = validateWaveFields([
      { corners: ['world/slot/nw', 'world/slot/ne', 'world/slot/se', 'world/slot/sw'] },
    ], emitted);
    expect(errors).toEqual([]);
  });

  it('accepts a waved field with multiple components', () => {
    const errors = validateWaveFields([
      {
        corners: ['world/slot/nw', 'world/slot/ne', 'world/slot/se', 'world/slot/sw'],
        waves: [
          { amplitude: 1.0, cycles: { u: 2, v: 0 } },
          { amplitude: 0.3, cycles: { u: 0, v: 4 } },
        ],
      },
    ], emitted);
    expect(errors).toEqual([]);
  });

  it('rejects a field with fewer than 4 corners', () => {
    const errors = validateWaveFields([
      { corners: ['world/slot/nw', 'world/slot/ne', 'world/slot/se'] },
    ], emitted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/must be a 4-element array/);
  });

  it('reports an error per unresolvable corner', () => {
    const errors = validateWaveFields([
      { corners: ['world/slot/nw', 'world/slot/missing', 'world/slot/se', 'world/slot/sw'] },
    ], emitted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/waveFields\[0\]\.corners\[1\]:/);
    expect(errors[0]).toMatch(/slot 'missing' not on node 'world'/);
  });

  it('rejects a non-array waves field', () => {
    const errors = validateWaveFields([
      {
        corners: ['world/slot/nw', 'world/slot/ne', 'world/slot/se', 'world/slot/sw'],
        waves: 'oops',
      },
    ], emitted);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/waves: must be an array/);
  });
});

describe('sampleWaveField — geometry', () => {
  it('with no waves, every grid point lies exactly on the bilinear quad', () => {
    const { gridPoints } = sampleWaveField(
      { samples: { u: 4, v: 4 } },
      PHYSICS,
      squareCorners(),
    );
    // The bilinear surface of the square corners on z=0 has every grid
    // point at z=0 too — a flat floor, the "flat is still good" case.
    for (let iu = 0; iu < gridPoints.length; iu += 1) {
      for (let iv = 0; iv < gridPoints[iu].length; iv += 1) {
        expect(Math.abs(gridPoints[iu][iv].z)).toBeLessThan(1e-9);
      }
    }
  });

  it('endpoints are pinned even when waves are present', () => {
    // sin(2π · 0) = 0 at u=0,v=0. For pure cycles{u:N,v:0}, the corners
    // at (0,0), (1,0), (1,1), (0,1) all sit at integer multiples of the
    // wave period in u — also zero. So the corners stay flat.
    const { gridPoints } = sampleWaveField(
      {
        samples: { u: 8, v: 8 },
        waves: [{ amplitude: 2, cycles: { u: 1, v: 0 } }],
      },
      PHYSICS,
      squareCorners(),
    );
    const corners = [
      gridPoints[0][0], gridPoints[8][0],
      gridPoints[8][8], gridPoints[0][8],
    ];
    for (const c of corners) {
      expect(Math.abs(c.z)).toBeLessThan(1e-9);
    }
  });

  it('a 1-cycle wave in u has a crest at u=0.25 and trough at u=0.75', () => {
    const N = 20;
    const { gridPoints } = sampleWaveField(
      {
        samples: { u: N, v: N },
        waves: [{ amplitude: 3, cycles: { u: 1, v: 0 } }],
      },
      PHYSICS,
      squareCorners(),
    );
    // Gravity points in -Z, so positive wave height displaces in -Z.
    // sin(2π · 0.25) = +1 → height +3 → world z = 0 + 3 × (-1) = -3.
    // sin(2π · 0.75) = -1 → height -3 → world z = 0 + (-3) × (-1) = +3.
    const crestIdx = Math.round(N * 0.25);
    const troughIdx = Math.round(N * 0.75);
    const crest = gridPoints[crestIdx][0];
    const trough = gridPoints[troughIdx][0];
    expect(crest.z).toBeCloseTo(-3, 4);
    expect(trough.z).toBeCloseTo(3, 4);
  });

  it('explicit displacement overrides gravity', () => {
    // Displace along +Y instead of gravity's -Z.
    const { gridPoints } = sampleWaveField(
      {
        samples: { u: 20, v: 4 },
        waves: [{ amplitude: 3, cycles: { u: 1, v: 0 } }],
        displacement: { x: 0, y: 1, z: 0 },
      },
      PHYSICS,
      squareCorners(),
    );
    const peak = gridPoints[5][0]; // around u = 0.25
    expect(Math.abs(peak.z)).toBeLessThan(1e-9);   // no z change
    expect(peak.y).toBeGreaterThan(-10);            // displaced in +y from base y=-10
  });

  it('multi-component waves superpose linearly', () => {
    const N = 12;
    const waves = [
      { amplitude: 2, cycles: { u: 1, v: 0 } },
      { amplitude: 1, cycles: { u: 4, v: 0 }, phase: Math.PI / 2 },
    ];
    const { gridPoints } = sampleWaveField(
      { samples: { u: N, v: N }, waves },
      PHYSICS,
      squareCorners(),
    );
    // Verify at a single grid point that height = component1 + component2.
    const iu = 3;
    const u = iu / N;
    const h1 = 2 * Math.sin(2 * Math.PI * u);
    const h2 = 1 * Math.sin(2 * Math.PI * 4 * u + Math.PI / 2);
    const expectedZ = (h1 + h2) * -1; // gravity in -Z
    expect(gridPoints[iu][0].z).toBeCloseTo(expectedZ, 4);
  });

  it('emits (Nu+1) iso-u polylines and (Nv+1) iso-v polylines', () => {
    const { isoUPolylines, isoVPolylines } = sampleWaveField(
      { samples: { u: 8, v: 6 } },
      PHYSICS,
      squareCorners(),
    );
    expect(isoUPolylines).toHaveLength(9);
    expect(isoVPolylines).toHaveLength(7);
    expect(isoUPolylines[0]).toHaveLength(7); // varies in v
    expect(isoVPolylines[0]).toHaveLength(9); // varies in u
  });

  it('respects minimum sample density of 2 per axis', () => {
    const { gridPoints } = sampleWaveField(
      { samples: { u: 0, v: -3 } },
      PHYSICS,
      squareCorners(),
    );
    expect(gridPoints).toHaveLength(3); // Nu=2 → 3 grid rows
    expect(gridPoints[0]).toHaveLength(3); // Nv=2 → 3 grid cols
  });

  it('throws on missing or malformed corners', () => {
    expect(() => sampleWaveField({}, PHYSICS, undefined)).toThrow(/4 resolved corners required/);
    expect(() => sampleWaveField({}, PHYSICS, [{ x: 0, y: 0, z: 0 }])).toThrow(/4 resolved corners required/);
  });
});
