// The readable rung (readable-rung.js): a piece's own faces at a coarser grain. Its detail under the cell melts, its
// silhouette (its extent) stays within a cell, the vertices shared stay shared, what a face carries per corner follows
// its corners, and the same faces and cell give the same faces.
import { describe, expect, it } from 'vitest';
import { readableFaces } from './readable-rung.js';
import { latheToFaces } from '../polygonizer/lathe-faces.js';

// a drum, half a unit across, with a knob far under the cell on its side
const drum = () => [
  ...latheToFaces({ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 }, profile: [{ t: 0, radius: 0.25 }, { t: 1, radius: 0.25 }] }),
  ...latheToFaces({ axisFrom: { x: 0.25, y: 0, z: 0.5 }, axisTo: { x: 0.27, y: 0, z: 0.5 }, profile: [{ t: 0, radius: 0.01 }, { t: 1, radius: 0.01 }] }),
];
const extent = (faces) => [0, 1, 2].map((a) => faces.flatMap((f) => f.corners.map((v) => v[a]))).map((xs) => [Math.min(...xs), Math.max(...xs)]);

describe('the readable rung', () => {
  it('far fewer faces; the extent within a cell; the knob melted; shared vertices still shared; deterministic', () => {
    const cell = 0.08, F = drum(), R = readableFaces(F, { cell });
    expect(R.length).toBeLessThan(F.length / 4);
    const [a, b] = [extent(F), extent(R)];
    for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) expect(Math.abs(a[k][j] - b[k][j])).toBeLessThanOrEqual(cell);
    // (no face stands where only the knob stood: past the drum's wall)
    expect(R.every((f) => f.corners.every((v) => Math.hypot(v[0], v[1]) < 0.25 + cell))).toBe(true);
    // (each vertex a cell's one point: two faces meeting at a place meet at the same coordinates)
    const at = new Map();
    for (const f of R) for (const v of f.corners) { const k = v.map((x) => Math.round(x / cell)).join(); if (at.has(k)) expect(at.get(k)).toEqual(v); else at.set(k, v); }
    expect(readableFaces(drum(), { cell })).toEqual(R);
    expect(() => readableFaces(F, {})).toThrow(/cell is the grain/);
  });

  it('what a face carries per corner follows its corners', () => {
    const quad = { corners: [[0, 0, 0], [1, 0, 0], [1.01, 0.01, 0], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [9, 9], [1, 1], [0, 1]], fill: '#808080' };
    const [f] = readableFaces([quad], { cell: 0.1 });
    expect(f.corners.length).toBe(4);
    expect(f.uv).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(f.fill).toBe('#808080');
  });
});
