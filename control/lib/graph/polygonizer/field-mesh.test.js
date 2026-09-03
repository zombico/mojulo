/**
 * field-mesh — the watertight surface-net polygonizer (blenderish-animals.plan.md
 * phase 1). The property under test is the one the ring-stack surfacer can never
 * give: ZERO boundary edges, on any field — including the smooth-union creature
 * fields whose per-axis march leaves thousands of open edges.
 */
import { describe, expect, it } from 'vitest';

import { primBounds, surfaceNetFaces } from './field-mesh.js';
import { smin, sdRoundCone } from './vajra.js';
import { findOpenBoundaries } from './face-closure.js';

const sdSphere = (p, c, r) => Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) - r;
const toAudit = (faces) => faces.map((f) => ({ corners: f.corners.map((q) => [q.x, q.y, q.z]) }));

describe('surfaceNetFaces — watertight by construction', () => {
  it('a sphere meshes closed, near the right radius, with outward normals', () => {
    const field = (p) => sdSphere(p, { x: 0, y: 0, z: 0 }, 1);
    const bounds = { min: { x: -1.4, y: -1.4, z: -1.4 }, max: { x: 1.4, y: 1.4, z: 1.4 } };
    const faces = surfaceNetFaces(field, bounds, { cells: 24 });
    expect(faces.length).toBeGreaterThan(100);
    expect(findOpenBoundaries(toAudit(faces)).boundaryEdgeCount).toBe(0);
    for (const f of faces) {
      const cen = f.corners.reduce((m, q) => ({ x: m.x + q.x / 4, y: m.y + q.y / 4, z: m.z + q.z / 4 }), { x: 0, y: 0, z: 0 });
      const r = Math.hypot(cen.x, cen.y, cen.z);
      expect(r).toBeGreaterThan(0.85);
      expect(r).toBeLessThan(1.1);
      // outward: the gradient normal points away from the centre
      expect(f.n[0] * cen.x + f.n[1] * cen.y + f.n[2] * cen.z).toBeGreaterThan(0);
    }
  });

  it('a smin-welded two-lobe body (the creature field shape) meshes closed', () => {
    const a = { x: -0.4, y: 0, z: 0 }, b = { x: 0.4, y: 0, z: 0.15 };
    const field = (p) => smin(
      smin(sdSphere(p, a, 0.3), sdSphere(p, b, 0.25), 0.1),
      sdRoundCone(p, a, b, 0.12, 0.1),
      0.1,
    );
    const bounds = primBounds([{ c: a, r: 0.3 }, { c: b, r: 0.25 }, { a, b, ra: 0.12, rb: 0.1 }], 0.2);
    const faces = surfaceNetFaces(field, bounds, { cells: 40 });
    expect(faces.length).toBeGreaterThan(200);
    expect(findOpenBoundaries(toAudit(faces)).boundaryEdgeCount).toBe(0);
  });

  it('winding agrees with the authored normal (STL derives normals from winding)', () => {
    const field = (p) => sdSphere(p, { x: 0, y: 0, z: 0 }, 0.5);
    const bounds = { min: { x: -0.8, y: -0.8, z: -0.8 }, max: { x: 0.8, y: 0.8, z: 0.8 } };
    for (const f of surfaceNetFaces(field, bounds, { cells: 16 })) {
      let wx = 0, wy = 0, wz = 0;
      for (let m = 0; m < 4; m++) {
        const p = f.corners[m], q = f.corners[(m + 1) % 4];
        wx += (p.y - q.y) * (p.z + q.z); wy += (p.z - q.z) * (p.x + q.x); wz += (p.x - q.x) * (p.y + q.y);
      }
      expect(wx * f.n[0] + wy * f.n[1] + wz * f.n[2]).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic — same field + options → byte-identical faces', () => {
    const field = (p) => sdSphere(p, { x: 0.1, y: -0.05, z: 0.2 }, 0.6);
    const bounds = { min: { x: -0.7, y: -0.9, z: -0.6 }, max: { x: 0.9, y: 0.7, z: 1.0 } };
    const a = surfaceNetFaces(field, bounds, { cells: 20 });
    const b = surfaceNetFaces(field, bounds, { cells: 20 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
