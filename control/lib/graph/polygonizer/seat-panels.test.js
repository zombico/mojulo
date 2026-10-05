import { describe, expect, it } from 'vitest';
import { clipCells, seatPanels } from './seat-panels.js';

const corner = (j) => ({ w: [0, 1, 2].map((k) => (k === j ? 1 : 0)) });
const area = (R) => { let s = 0; for (let i = 1; i + 1 < R.length; i++) { const [a, b, c] = [R[0].w, R[i].w, R[i + 1].w]; s += (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]); } return Math.abs(s) / 2; };

describe('seat-panels', () => {
  it('clipCells: a band thinner than the face, its corners all outside, is cut out of it; the cells tile the face', () => {
    // a band across the face between two planes (no corner inside: a face test by its corners would miss it)
    const band = [[[0.4, -0.6, 0.4], [-0.5, 0.5, -0.5]]];
    const cells = clipCells([0, 1, 2].map(corner), band, (w) => ({ w }));
    expect(cells.filter((c) => c.inside)).toHaveLength(1);
    expect(cells.reduce((a, c) => a + area(c.ring), 0)).toBeCloseTo(0.5, 12);
    // an edge's crossing keeps the opposite corner's weight exactly 0 (the point lies on the face's own edge)
    expect(cells.flatMap((c) => c.ring).some((p) => p.w.includes(0) && !p.w.includes(1))).toBe(true);
    // a set wholly outside cuts nothing in
    expect(clipCells([0, 1, 2].map(corner), [[[1, 1, 1]]], (w) => ({ w })).every((c) => !c.inside)).toBe(true);
  });
  it('seatPanels: none on a mesh without the structured pelvis', () => {
    expect(seatPanels({ vertices: [], faces: [], groups: [], provenance: [], parts: { torso: {} } })).toBe(null);
  });
});
