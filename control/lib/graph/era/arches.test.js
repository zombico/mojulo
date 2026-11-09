// arches — the archivolt is laid as voussoirs: no arch is carved whole from one stone.
import { describe, it, expect } from 'vitest';
import { archRing, roundArch } from './arches.js';

const F = { o: [0, 0, 0], U: [1, 0, 0], N: [0, -1, 0], len: 10 };
const surf = { key: 'stone', scale: 1, group: 'trim', tint: null };
// the ring's front faces (those facing out of the wall, at its stand), grouped into stones by the joints between them
const fronts = (out, proud) => out.filter((f) => f.normal[1] < -0.99 && f.corners.every((c) => c[1] <= -proud + 1e-6));

describe('the archivolt', () => {
  it('is an odd count of wedge stones, joints between them, the keystone at the crown prouder and higher', () => {
    const out = [];
    const { inner, outer } = archRing(out, F, 2, 4, 2, 1, 8, 0.3, 0.05, surf);
    expect(inner).toEqual(roundArch(2, 4, 2, 1, 8));
    expect(outer).toHaveLength(9);
    // the faces round the stones' sides (each its intrados and extrados, and a face either side of every joint; none
    // at the springers, which sit on the jambs)
    const sides = out.filter((f) => Math.abs(f.normal[1]) < 1e-6 && f.corners.some((c) => c[1] < -1e-6));
    const front = fronts(out, 0.05), n = front.length;
    expect(n).toBeGreaterThanOrEqual(5);
    // the keystone: the one front face standing past the others' stand
    const prouder = out.filter((f) => f.normal[1] < -0.99 && f.corners.every((c) => c[1] < -0.07));
    expect(prouder.length).toBeGreaterThan(0);
    expect(Math.min(...prouder.flatMap((f) => f.corners.map((c) => c[0])))).toBeGreaterThan(2.7);
    expect(Math.max(...prouder.flatMap((f) => f.corners.map((c) => c[0])))).toBeLessThan(3.3);
    // one front a stone (a short ring, one face each), an odd count
    expect(n % 2).toBe(1);
    expect(sides).toHaveLength(2 * n + 2 * (n - 1));
  });
});
