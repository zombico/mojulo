import { describe, expect, it } from 'vitest';

import { isConvexRing, earClipRing, ringSignedArea } from './ring-cap.js';

const ring = (pts) => pts.map(([u, v]) => ({ u, v }));
const triArea = (r, [i, j, k]) => {
  const a = r[i], b = r[j], c = r[k];
  return ((b.u - a.u) * (c.v - a.v) - (c.u - a.u) * (b.v - a.v)) / 2;
};

// The desk-edge headphone hook's clamp: a C whose centroid (11, 13.5) lies in the open slot.
const C = ring([[-6, 0], [25, 0], [25, 4], [0, 4], [0, 23], [25, 23], [25, 27], [-6, 27]]);

describe('ring-cap', () => {
  it('convexity: rect and triangle yes, the C and an L no, either winding', () => {
    expect(isConvexRing(ring([[0, 0], [4, 0], [4, 6], [0, 6]]))).toBe(true);
    expect(isConvexRing(ring([[0, 0], [0, 6], [4, 6], [4, 0]]))).toBe(true);
    expect(isConvexRing(ring([[-2, -1], [2, -1], [0, 2]]))).toBe(true);
    expect(isConvexRing(C)).toBe(false);
    expect(isConvexRing(ring([[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]]))).toBe(false);
  });

  it('ear-clips the C into n−2 triangles that tile exactly its area, all wound like the ring', () => {
    const tris = earClipRing(C);
    expect(tris.length).toBe(C.length - 2);
    const area = ringSignedArea(C);
    expect(area).toBeCloseTo(362, 9);
    const sum = tris.reduce((acc, t) => acc + triArea(C, t), 0);
    expect(sum).toBeCloseTo(area, 9);
    for (const t of tris) expect(triArea(C, t)).toBeGreaterThan(0);
  });

  it('a CW ring comes back CW, same tiling', () => {
    const cw = [...C].reverse();
    const tris = earClipRing(cw);
    expect(tris.length).toBe(cw.length - 2);
    const sum = tris.reduce((acc, t) => acc + triArea(cw, t), 0);
    expect(sum).toBeCloseTo(ringSignedArea(cw), 9);
    for (const t of tris) expect(triArea(cw, t)).toBeLessThan(0);
  });

  it('drops collinear vertices without emitting a zero-area face', () => {
    const sq = ring([[0, 0], [2, 0], [4, 0], [4, 4], [0, 4]]);
    const tris = earClipRing(sq);
    expect(tris.every((t) => Math.abs(triArea(sq, t)) > 1e-9)).toBe(true);
    expect(tris.reduce((acc, t) => acc + triArea(sq, t), 0)).toBeCloseTo(16, 9);
  });
});
