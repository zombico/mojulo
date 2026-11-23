// The drawn relief (side-map/relief.js): the cake's painted pieces drawn with their depth. The concepts: a proud piece
// takes a lit edge on its top and its left and a drop shadow only where it shows past the piece, down its right and along
// its foot, darker than what it falls on and never under the piece; a groove leaves the stone over it in shade and the
// stone under it lit; a recess its lip's shadow inside along the top; a piece of no kind, none; the lit map carries
// them, the flat one none; the same faces, the same relief.
import { describe, it, expect } from 'vitest';
import { reliefFaces } from './relief.js';
import { assembleSideMap } from './scene.js';

const q = (x, s0, s1, z0, z1, fill, group) => ({ corners: [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], normal: [1, 0, 0], fill, group });
const base = q(1.504, 0, 10, 0, 4, '#606060', 'sidemap:paint-cake-base');
const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
const box = (f) => { const ss = f.corners.map((c) => c[1]), zs = f.corners.map((c) => c[2]); return { s0: Math.min(...ss), s1: Math.max(...ss), z0: Math.min(...zs), z1: Math.max(...zs), x: f.corners[0][0] }; };

describe('the drawn relief', () => {
  it('a proud piece: lit top and left on it; its drop shadow past it, down its right and along its foot, never under it', () => {
    const panel = q(1.508, 2, 4, 1, 3, '#8090a0', 'sidemap:paint-cake-panel'), R = reliefFaces([base, panel]);
    const hi = R.filter((f) => f.group === 'sidemap:paint-relief-hi').map(box), lo = R.filter((f) => f.group === 'sidemap:paint-relief-lo');
    expect(hi.some((b) => b.z1 === 3 && b.s0 === 2 && b.s1 === 4)).toBe(true);
    expect(hi.some((b) => b.s0 === 2 && b.s1 < 2.1)).toBe(true);
    expect(hi.every((b) => b.x > panel.corners[0][0])).toBe(true);
    expect(lo.length).toBe(2);
    for (const f of lo) {
      const b = box(f);
      expect(lum(f.fill)).toBeLessThan(lum(base.fill));
      expect(b.x).toBeLessThan(1.508);
      expect(b.x).toBeGreaterThan(1.504);
      // (never under the piece)
      expect(b.s0 >= 4 - 1e-6 || b.z1 <= 1 + 1e-6).toBe(true);
    }
  });
  it('a groove: the stone over it in shade, under it lit; a recess: its lip\'s shadow inside along the top', () => {
    const course = q(1.504, 0, 10, 2, 2.05, '#303030', 'sidemap:paint-course'), built = q(1.5, 0, 10, 0, 4, '#606060', 'sidemap:built');
    const G = reliefFaces([built, course]).map((f) => [f, box(f)]);
    expect(G.find(([f, b]) => b.z0 >= 2.05 - 1e-6 && f.group.endsWith('-lo'))).toBeDefined();
    expect(G.find(([f, b]) => b.z1 <= 2 + 1e-6 && f.group.endsWith('-hi'))).toBeDefined();
    const vent = q(1.512, 2, 3, 1, 1.2, '#202020', 'sidemap:paint-cake-vent'), V = reliefFaces([base, vent]).map((f) => [f, box(f)]);
    expect(V.find(([f, b]) => f.group.endsWith('-lo') && b.z1 === 1.2 && b.s1 === 3)).toBeDefined();
    expect(reliefFaces([base, q(1.508, 2, 4, 1, 3, '#8090a0', 'sidemap:paint-cake-soil')])).toEqual([]);
  });
  it('the lit map carries them, the flat one none; the same faces, the same relief', () => {
    const m = (light) => ({ kind: 'geocube', show: 'sidemap', cube: 'city-night', seed: 3, ...(light ? { light } : {}), sidemap: { premise: 'p', fill: 'machine', zones: [{ run: 'across', screens: 2, beat: 'rest' }, { run: 'across', screens: 3, teach: 'basic' }] } });
    const has = (P) => P.faces.some((f) => /^sidemap:paint-relief-/.test(f.group));
    expect(has(assembleSideMap(m()))).toBe(true);
    expect(has(assembleSideMap(m('flat')))).toBe(false);
    const panel = q(1.508, 2, 4, 1, 3, '#8090a0', 'sidemap:paint-cake-panel');
    expect(reliefFaces([base, panel])).toEqual(reliefFaces([base, panel]));
  });
});
