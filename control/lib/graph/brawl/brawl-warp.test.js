// A STREET THAT ALREADY STANDS, on a band that drifts (brawl-warp.js): the built town sheared across its belt.
import { describe, it, expect } from 'vitest';
import { driftWarp } from './brawl-warp.js';
import { readBelt } from './brawl-belt.js';

const screens = [{ length: 20 }, { length: 20, gate: true }];
const straight = readBelt({ at: [10, 0], heading: 0, depth: [-2.5, 2.5], screens }, 'belt');
const belt = readBelt({ at: [10, 0], heading: 0, depth: [-2.5, 2.5], screens, drift: [[0, 0], [10, 0], [20, 6], [40, 6]] }, 'belt');
const face = (x0, x1, y = 5, more = {}) => ({ corners: [[x0, y, 0], [x1, y, 0], [x1, y, 3], [x0, y, 3]], normal: [0, -1, 0], outNormal: [0, -1, 0], fill: '#808080', cornerFills: ['#000000', '#ffffff', '#ffffff', '#000000'], ...more });
const scene = () => ({
  faces: [face(12, 18), face(22, 28), face(32, 38), face(15, 35, 6, { uv: [[0, 0], [20, 0], [20, 3], [0, 3]] })],
  repeats: [{ group: 'lamp', template: [], transforms: [{ pos: [25, 4, 0], rotZ: 0 }, { pos: [45, 4, 0], rotZ: 1 }] }],
  colliders: [{ min: [42, 5, 0], max: [48, 9, 6], of: 'house' }], anchors: [{ id: 'a', at: [45, 5, 0] }], route: [[12, 0, 0], [45, 0, 0]],
});

describe('the shear', () => {
  it('a straight belt warps nothing', () => { const P = scene(); expect(driftWarp(P, straight)).toEqual(scene()); });
  it('before the drift the town is as it was; past it moved across whole; on the diagonal it lies along the band\'s line', () => {
    const P = driftWarp(scene(), belt), [a, b, c] = P.faces;
    expect(a).toEqual(face(12, 18));
    expect(c.corners.map((p) => p[1])).toEqual([11, 11, 11, 11]); expect(c.normal).toEqual([0, -1, 0]);
    // (x 22 to 28 is 2 to 8 m along the diagonal's 10: its ends 1.2 and 4.8 m across)
    expect(b.corners[0][1]).toBeCloseTo(6.2, 4); expect(b.corners[1][1]).toBeCloseTo(9.8, 4);
    // (its normal found again, still facing the camera's side, square to its own new line)
    expect(b.normal[1]).toBeLessThan(0); expect(b.normal[0] * 6 + b.normal[1] * 3.6).toBeCloseTo(0, 3);
  });
  it('a face that crosses a bend is cut there, its colours and its uv found along the cut', () => {
    const P = driftWarp(scene(), belt), cut = P.faces.filter((f) => f.uv);
    expect(cut).toHaveLength(3);                                   // (bends at 20 and 30 m of the world's x)
    for (const f of cut) for (const p of f.corners) { const s = p[0] - 10, want = s <= 10 ? 0 : s >= 20 ? 6 : (s - 10) * 0.6; expect(p[1] - 6).toBeCloseTo(want, 4); }
    const mid = cut.find((f) => f.corners.every((p) => p[0] >= 20 - 1e-6 && p[0] <= 30 + 1e-6));
    expect(mid.uv.map((u) => u[0]).sort((p, q) => p - q)).toEqual([5, 5, 15, 15]);
    expect(new Set(mid.cornerFills)).toEqual(new Set(['#404040', '#bfbfbf']));
  });
  it('an instanced thing is moved whole, never sheared; the boxes, the anchors and the route move with the ground', () => {
    const P = driftWarp(scene(), belt);
    expect(P.repeats[0].transforms).toEqual([{ pos: [25, 7, 0], rotZ: 0 }, { pos: [45, 10, 0], rotZ: 1 }]);
    expect(P.colliders[0]).toMatchObject({ min: [42, 11, 0], max: [48, 15, 6] });
    expect(P.anchors[0].at).toEqual([45, 11, 0]); expect(P.route).toEqual([[12, 0, 0], [45, 6, 0]]);
  });
});
