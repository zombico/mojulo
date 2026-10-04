import { describe, it, expect } from 'vitest';
import { solidFaces, orientSolid } from './solids.js';
import { orientBox, battered, placeAsset } from './kit.js';
import { makeLight } from '../../polygonizer/vexar.js';

const L = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mid = (ps) => ps.reduce((s, p) => [s[0] + p[0] / ps.length, s[1] + p[1] / ps.length, s[2] + p[2] / ps.length], [0, 0, 0]);
// the emitter's front: (c1 − c0) × (c3 − c0) for a panel, (c1 − c0) × (c2 − c0) for a triangle
const front = (f) => cross(sub(f.corners[1], f.corners[0]), sub(f.corners[f.corners.length === 3 ? 2 : 3], f.corners[0]));
const outward = (faces, centre) => faces.every((f) => dot(front(f), sub(mid(f.corners), centre)) > 0);

describe('historic solids: the angled masses', () => {
  it('a battered block is a top and four leaning sides, all wound outward, with no masked panels', () => {
    const b = battered({ x: 0, y: 0, w: 10, d: 6 }, 0, 8, '#a08a6a', 1);
    const faces = solidFaces(b, L);
    expect(faces.length).toBe(9);   // the top, and each leaning side a panel + a sliver
    expect(outward(faces, [5, 3, 3])).toBe(true);
    expect(faces.filter((f) => f.clip).length).toBe(0);
    expect(faces[0].corners.every((c) => c[2] === 8)).toBe(true);
  });
  it('a wedge rises toward its rise side; a vault is round with an open dark end', () => {
    const w = solidFaces({ solid: 'wedge', x: 0, y: 0, w: 2, d: 10, z0: 0, z1: 5, rise: 'y+', tint: '#a08a6a' }, L);
    const zAt = (y) => Math.max(...w.flatMap((f) => f.corners).filter((c) => c[1] === y).map((c) => c[2]));
    expect(zAt(10)).toBe(5); expect(zAt(0)).toBe(0);
    expect(outward(w, [1, 5, 1.6])).toBe(true);
    const v = solidFaces({ solid: 'vault', x: 0, y: 0, w: 6, d: 12, z0: 0, z1: 5, axis: 'y', open: 'lo', tint: '#c8ad62' }, L);
    expect(Math.max(...v.flatMap((f) => f.corners).map((c) => c[2]))).toBeCloseTo(5);
    expect(v.length).toBeGreaterThan(10);
    expect(outward(v.filter((f) => !f.corners.every((c) => c[1] === 0)), [3, 6, 1.5])).toBe(true);
  });
  it('a solid turns with its slot: the top rect, the rise and the vault axis all follow the facing', () => {
    const rect = { x: 100, y: 200, w: 8, d: 4 };
    expect(orientSolid({ solid: 'wedge', rise: 'y+' }, 'e', (r) => r)).toEqual({ rise: 'x-' });
    expect(orientSolid({ solid: 'wedge', rise: 'x+' }, 's', (r) => r)).toEqual({ rise: 'x-' });
    expect(orientSolid({ solid: 'vault', axis: 'y', open: 'lo' }, 'w', (r) => r)).toEqual({ axis: 'x', open: 'lo' });
    // a block leaning on its front only: turned to face east, the lean is on the east side
    const A = { id: 't', build: ({ W, D }) => [battered({ x: 0, y: 0, w: W, d: D }, 0, 5, '#fff', 1, { sides: ['front'] })] };
    const [m] = placeAsset(A, { asset: 't', rect, facing: 'e' }, {}).boxes;
    expect(m.top).toEqual({ x: 100, y: 200, w: 7, d: 4 });
    expect(orientBox({ x: 0, y: 1, w: 4, d: 7 }, rect, 'e')).toEqual({ x: 100, y: 200, w: 7, d: 4 });
  });
});
