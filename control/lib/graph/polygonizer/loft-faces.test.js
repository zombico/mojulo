/**
 * loft-faces — a profile that changes along its path (field-solids.plan.md F1). Claims: a
 * two-station straight loft is BYTE-IDENTICAL to the matching endProfile extrude (the regression
 * anchor); a five-station hull closes with zero boundary edges; a curved-path loft closes; the
 * validator names the station with the wrong point count; output is deterministic.
 */
import { describe, expect, it } from 'vitest';

import { loftToFaces, validateLofts, DEFAULT_SIDES } from './loft-faces.js';
import { extrudeToFaces } from './extrude-faces.js';
import { findOpenBoundaries } from './face-closure.js';
import { faceListToMesh } from '../figures/face-mesh.js';

const tri = [[-2, -1], [2, -1], [0, 2]];
const triSmall = [[-1, -0.5], [1, -0.5], [0, 1]];
const axis = { axisFrom: { x: 0.1, y: 0.2, z: 0.3 }, axisTo: { x: 0.4, y: 0.7, z: 3.3 } };

describe('loftToFaces — the extrude anchor', () => {
  it('a two-station straight loft equals the endProfile extrude byte for byte', () => {
    const loft = loftToFaces({ ...axis, stations: [{ t: 0, profile: tri }, { t: 1, profile: triSmall }], tint: '#c79a4b' });
    const ext = extrudeToFaces({ ...axis, profile: { points: tri }, endProfile: { points: triSmall }, tint: '#c79a4b' });
    expect(loft.length).toBe(3 + 3 + 3);
    expect(JSON.stringify(loft)).toBe(JSON.stringify(ext));
  });
  it('…with a material too (tags ride along identically)', () => {
    const loft = loftToFaces({ ...axis, stations: [{ t: 0, profile: tri }, { t: 1, profile: triSmall }] }, { material: 'gold' });
    const ext = extrudeToFaces({ ...axis, profile: { points: tri }, endProfile: { points: triSmall } }, { material: 'gold' });
    expect(JSON.stringify(loft)).toBe(JSON.stringify(ext));
  });
  it('a 2-point `path` is the same straight axis', () => {
    const a = loftToFaces({ path: [[0.1, 0.2, 0.3], [0.4, 0.7, 3.3]], stations: [{ t: 0, profile: tri }, { t: 1, profile: triSmall }] });
    const b = loftToFaces({ ...axis, stations: [{ t: 0, profile: tri }, { t: 1, profile: triSmall }] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// a boat hull: keel → forefoot → midship → quarter → transom, along x
const hull = {
  path: [[0, 0, 0], [12, 0, 0]],
  stations: [
    { t: 0, profile: [[0, 0.2], [0.05, 0.05], [0, 0], [-0.05, 0.05]] },                 // a pinched bow
    { t: 0.25, profile: [[1.2, 1.6], [1.0, 0.2], [-1.0, 0.2], [-1.2, 1.6]] },
    { t: 0.55, profile: [[1.8, 1.7], [1.5, 0.1], [-1.5, 0.1], [-1.8, 1.7]] },
    { t: 0.8, profile: [[1.6, 1.6], [1.4, 0.15], [-1.4, 0.15], [-1.6, 1.6]] },
    { t: 1, profile: [[1.2, 1.5], [1.1, 0.4], [-1.1, 0.4], [-1.2, 1.5]] },
  ],
};

describe('loftToFaces — stations', () => {
  it('a five-station hull closes with zero boundary edges (linear and smooth)', () => {
    for (const interp of ['linear', 'smooth']) {
      const faces = loftToFaces({ ...hull, interp });
      expect(faces.length).toBeGreaterThan(20);
      const audit = findOpenBoundaries(faces);
      expect(audit.boundaryEdgeCount).toBe(0);
      expect(faces.every((f) => f.corners.length === 4 && Array.isArray(f.outNormal))).toBe(true);
    }
  });
  it('smooth interpolation adds rings (segments per station gap) and passes through the stations', () => {
    const lin = loftToFaces({ ...hull, interp: 'linear', caps: false });
    const sm = loftToFaces({ ...hull, interp: 'smooth', segments: 4, caps: false });
    expect(lin.length).toBe(4 * 4);
    expect(sm.length).toBe(4 * 4 * 4);
    // the ring at a station is the station itself in both modes: the midship top-right corner
    const hasCorner = (faces) => faces.some((f) => f.corners.some(([x, y, z]) => Math.abs(x - 12 * 0.55) < 1e-9 && Math.abs(y - 1.8) < 1e-9 && Math.abs(z - 1.7) < 1e-9));
    expect(hasCorner(lin)).toBe(true);
    expect(hasCorner(sm)).toBe(true);
  });
  it('round stations ({ radius, sides }) and roll: a twisted square-to-circle transition closes', () => {
    const faces = loftToFaces({
      axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 5 },
      stations: [
        { t: 0, profile: [[-1, -1], [1, -1], [1, 1], [-1, 1]] },
        { t: 1, profile: { radius: 1, sides: 4 }, roll: 45 },
      ],
    });
    expect(findOpenBoundaries(faces).boundaryEdgeCount).toBe(0);
    expect(faces.length).toBe(4 + 4 + 4);
  });
  it('a curved path uses parallel-transport frames and stays closed', () => {
    const path = []; for (let i = 0; i <= 12; i += 1) { const a = (i / 12) * Math.PI; path.push([Math.cos(a) * 4, Math.sin(a) * 4, i * 0.3]); }
    const faces = loftToFaces({ path, stations: [{ t: 0, profile: { radius: 0.6 } }, { t: 0.5, profile: { radius: 1.1 } }, { t: 1, profile: { radius: 0.4 } }] });
    expect(faces.length).toBe(12 * DEFAULT_SIDES + 2 * DEFAULT_SIDES);
    expect(findOpenBoundaries(faces).boundaryEdgeCount).toBe(0);
    expect(faces.every((f) => f.corners.every((c) => c.every(Number.isFinite)))).toBe(true);
  });
  it('caps:false drops both fans; the faces survive face-mesh triangulation; deterministic', () => {
    const open = loftToFaces({ ...hull, caps: false });
    expect(open.length).toBe(4 * 4);
    const mesh = faceListToMesh(loftToFaces(hull));
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(JSON.stringify(loftToFaces(hull))).toBe(JSON.stringify(loftToFaces(hull)));
  });
});

describe('validateLofts', () => {
  const ok = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, stations: [{ t: 0, profile: tri }, { t: 1, profile: triSmall }] };
  it('accepts a valid loft', () => { expect(validateLofts([ok])).toEqual([]); });
  it('names the station whose point count differs', () => {
    const e = validateLofts([{ ...ok, stations: [{ t: 0, profile: tri }, { t: 0.5, profile: [[0, 0], [1, 0], [1, 1], [0, 1]] }, { t: 1, profile: triSmall }] }]);
    expect(e.length).toBe(1);
    expect(e[0]).toMatch(/stations\[1\]\.profile has 4 points but stations\[0\] has 3/);
    const e2 = validateLofts([{ ...ok, stations: [{ t: 0, profile: tri }, { t: 1, profile: { radius: 1 } }] }]);
    expect(e2[0]).toMatch(new RegExp(`has ${DEFAULT_SIDES} points but stations\\[0\\] has 3`));
  });
  it('rejects a missing/short path, a zero-length axis, one station, a bad t, a shared t, a bad interp', () => {
    expect(validateLofts([{ stations: ok.stations }])[0]).toMatch(/needs a `path`/);
    expect(validateLofts([{ path: [[0, 0, 0]], stations: ok.stations }])[0]).toMatch(/≥2 points/);
    expect(validateLofts([{ path: [[0, 0, 0], [0, 0, 0], [1, 0, 0]], stations: ok.stations }])[0]).toMatch(/coincide/);
    expect(validateLofts([{ ...ok, axisTo: ok.axisFrom }])[0]).toMatch(/must differ/);
    expect(validateLofts([{ ...ok, stations: [ok.stations[0]] }])[0]).toMatch(/≥2/);
    expect(validateLofts([{ ...ok, stations: [{ t: -1, profile: tri }, { t: 1, profile: triSmall }] }])[0]).toMatch(/\.t: must be/);
    expect(validateLofts([{ ...ok, stations: [{ t: 0.5, profile: tri }, { t: 0.5, profile: triSmall }] }])[0]).toMatch(/share t=0.5/);
    expect(validateLofts([{ ...ok, interp: 'bezier' }])[0]).toMatch(/interp/);
    expect(validateLofts([{ ...ok, segments: 0 }])[0]).toMatch(/segments/);
  });
});
