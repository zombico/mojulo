import { describe, expect, it } from 'vitest';

import { latheToFaces } from './lathe-faces.js';
import { faceListToMesh } from '../face-mesh.js';

const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
const finiteVec = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

// A plain constant-radius cylinder along +z.
const cylinder = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 4 },
  profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }],
  crossSections: 6,
  samples: 12,
};

describe('latheToFaces', () => {
  it('meshes a cylinder into 4-corner quads with hex fills', () => {
    const faces = latheToFaces(cylinder);
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) {
      expect(f.corners).toHaveLength(4);
      expect(f.corners.every(finiteVec)).toBe(true);
      expect(isHex(f.fill)).toBe(true);
      expect(f.doubleSided).toBe(true);
    }
  });

  it('emits cs×samples wall quads plus two end caps for a flat-ended cylinder', () => {
    const walls = 6 * 12;          // cs ring-pairs × samples quads
    const caps = 2 * 12;           // two fans of `samples` quads
    expect(latheToFaces(cylinder).length).toBe(walls + caps);
    expect(latheToFaces(cylinder, { caps: false }).length).toBe(walls);
  });

  it('honours an explicit mesh-density override', () => {
    const faces = latheToFaces(cylinder, { crossSections: 5, samples: 10, caps: false });
    expect(faces.length).toBe(5 * 10);
  });

  it('does NOT cap a self-closing R→0 profile (a sphere) and stays finite', () => {
    const sphere = {
      axisFrom: { x: 0, y: 0, z: -1 },
      axisTo: { x: 0, y: 0, z: 1 },
      profile: [{ t: 0, radius: 0 }, { t: 0.5, radius: 1 }, { t: 1, radius: 0 }],
      crossSections: 8,
      samples: 16,
    };
    const withCaps = latheToFaces(sphere);
    const noCaps = latheToFaces(sphere, { caps: false });
    expect(withCaps.length).toBe(noCaps.length); // R→0 ends add no caps
    expect(withCaps.length).toBeGreaterThan(0);
    for (const f of withCaps) for (const c of f.corners) expect(finiteVec(c)).toBe(true);
  });

  it('respects an explicit tint', () => {
    const faces = latheToFaces(cylinder, { tint: '#ff0000' });
    // every fill is a Lambert-scaled shade of pure red → r-channel dominates g and b.
    for (const f of faces) {
      const r = parseInt(f.fill.slice(1, 3), 16);
      const g = parseInt(f.fill.slice(3, 5), 16);
      const b = parseInt(f.fill.slice(5, 7), 16);
      expect(r).toBeGreaterThanOrEqual(g);
      expect(r).toBeGreaterThanOrEqual(b);
    }
  });

  it('is deterministic (same spec → identical faces)', () => {
    expect(latheToFaces(cylinder)).toEqual(latheToFaces(cylinder));
  });

  it('the faces survive face-mesh triangulation into the WebGL buffer', () => {
    const mesh = faceListToMesh(latheToFaces(cylinder));
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.positions.length % 3).toBe(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.radius).toBeGreaterThan(0);
  });
});
