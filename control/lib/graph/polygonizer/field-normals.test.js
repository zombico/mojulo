/**
 * Corner normals off the field (field-normals.plan.md phase 1).
 *
 * The point of these: a corner normal here is EXACT (the analytic gradient at that point),
 * not an average of neighbouring face normals. So they can be checked against ground truth
 * on a shape whose normals are known in closed form, which a smoothing-group implementation
 * could never be.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { surfaceNetFaces } from './field-mesh.js';
import { sphere, roundCone, smoothUnion } from './field-terms.js';

const P = (x, y, z) => ({ x, y, z });
const BALL = sphere({ center: P(0, 0, 0), radius: 0.5 });
const BLOB = smoothUnion(
  roundCone({ a: P(0, 0, -0.5), b: P(0, 0, 0.3), ra: 0.42, rb: 0.30 }),
  sphere({ center: P(0, -0.1, 0.65), radius: 0.28 }),
  0.16,
);
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('smooth: false is the old behaviour, exactly', () => {
  it('faces are byte-identical to an un-flagged call', () => {
    const bare = surfaceNetFaces(BLOB.d, BLOB.bounds, { cells: 24 });
    const off = surfaceNetFaces(BLOB.d, BLOB.bounds, { cells: 24, smooth: false });
    expect(sha(off)).toBe(sha(bare));
  });

  it('no face carries cornerNormals unless asked', () => {
    for (const f of surfaceNetFaces(BLOB.d, BLOB.bounds, { cells: 20 })) {
      expect(f.cornerNormals).toBeUndefined();
    }
  });

  it('turning smooth ON leaves the geometry and the centre normal untouched', () => {
    const flat = surfaceNetFaces(BLOB.d, BLOB.bounds, { cells: 22 });
    const smooth = surfaceNetFaces(BLOB.d, BLOB.bounds, { cells: 22, smooth: true });
    expect(smooth.length).toBe(flat.length);
    for (let i = 0; i < flat.length; i++) {
      expect(smooth[i].corners).toEqual(flat[i].corners);   // same vertices — no remeshing
      expect(smooth[i].n).toEqual(flat[i].n);               // same flat fallback
    }
  });
});

describe('the corner normals are the field gradient, exactly', () => {
  const smooth = surfaceNetFaces(BALL.d, BALL.bounds, { cells: 28, smooth: true });

  it('one unit normal per corner', () => {
    expect(smooth.length).toBeGreaterThan(100);
    for (const f of smooth) {
      expect(f.cornerNormals).toHaveLength(f.corners.length);
      for (const n of f.cornerNormals) expect(len(n)).toBeCloseTo(1, 6);
    }
  });

  it('on a ball they ARE the radial — the closed-form ground truth', () => {
    for (const f of smooth) {
      for (let i = 0; i < f.corners.length; i++) {
        const q = f.corners[i], l = Math.hypot(q.x, q.y, q.z) || 1;
        expect(dot(f.cornerNormals[i], [q.x / l, q.y / l, q.z / l])).toBeGreaterThan(0.999);
      }
    }
  });

  it('they beat the flat normal at the corners — which is the whole point', () => {
    // The flat normal is one centre sample reused at all four corners; the corner sample is
    // exact there. On a curved surface the corner must be strictly closer to ground truth.
    let better = 0, total = 0;
    for (const f of smooth) {
      for (let i = 0; i < f.corners.length; i++) {
        const q = f.corners[i], l = Math.hypot(q.x, q.y, q.z) || 1;
        const truth = [q.x / l, q.y / l, q.z / l];
        total += 1;
        if (dot(f.cornerNormals[i], truth) > dot(f.n, truth)) better += 1;
      }
    }
    expect(better / total).toBeGreaterThan(0.95);
  });

  it('a shared vertex gets the SAME normal from every face that touches it', () => {
    // This is what makes the shading continuous across an edge — and it is true here without
    // any adjacency pass, because the normal is a function of position, not of the mesh.
    const byVert = new Map();
    for (const f of smooth) {
      for (let i = 0; i < f.corners.length; i++) {
        const q = f.corners[i];
        const key = `${q.x.toFixed(9)},${q.y.toFixed(9)},${q.z.toFixed(9)}`;
        const prev = byVert.get(key);
        if (prev) for (let k = 0; k < 3; k++) expect(f.cornerNormals[i][k]).toBeCloseTo(prev[k], 12);
        else byVert.set(key, f.cornerNormals[i]);
      }
    }
    expect(byVert.size).toBeGreaterThan(50);
  });
});

describe('determinism', () => {
  it('same field + smooth → byte-identical', () => {
    const a = surfaceNetFaces(BLOB.d, BLOB.bounds, { cells: 20, smooth: true });
    const b = surfaceNetFaces(BLOB.d, BLOB.bounds, { cells: 20, smooth: true });
    expect(sha(a)).toBe(sha(b));
  });
});
