// The side map's shadows (side-map/shadow.js, light.js). The concepts: a box throws a crisp polygon onto the back wall,
// beside and below it along the light, cut to the wall's rectangle; one behind the wall, or a top's own slab, throws none
// on it; what stands on a top darkens its foot; the lit map carries them as faces a hair proud of their receiver, darker
// than it in its own light; a face toward the camera falls into shade deeper in its block; the same map, the same shadows.
import { describe, it, expect } from 'vitest';
import { shadowOn, shadowCasters, SHADOW } from './shadow.js';
import { sideMapOf, assembleSideMap } from './scene.js';

const box = { x0: -1.5, x1: 1.5, s0: 4, s1: 6, z0: 2, z1: 3, of: 'solid' };
const wall = { axis: 'x', at: -3, s0: -50, s1: 50, a0: -10, a1: 10 };
const m = { kind: 'geocube', show: 'sidemap', cube: 'city-night', seed: 3, sidemap: { premise: 'p', zones: [{ run: 'across', screens: 2, beat: 'rest' }, { run: 'across', screens: 3, teach: 'basic' }, { room: [1, 1], teach: 'boss' }] } };

describe('the side map\'s shadows', () => {
  it('a box throws a polygon onto the back wall, along the light, cut to the wall', () => {
    const [P] = shadowOn(wall, [box]);
    expect(P.every((c) => c[0] === -3 + SHADOW.lift)).toBe(true);
    // (down from it and toward where the light goes, never past the light's reach of its far side)
    const zs = P.map((c) => c[2]), ss = P.map((c) => c[1]);
    expect(Math.min(...zs)).toBeLessThan(box.z0);
    expect(Math.max(...ss)).toBeGreaterThan(box.s1);
    const [Q] = shadowOn({ ...wall, a0: 1.5 }, [box]);
    expect(Math.min(...Q.map((c) => c[2]))).toBeGreaterThanOrEqual(1.5 - 1e-6);
    // (behind the wall, or the receiver's own slab: none)
    expect(shadowOn(wall, [{ ...box, x0: -5, x1: -4 }])).toEqual([]);
    expect(shadowOn({ axis: 'z', at: 3, s0: 4, s1: 6, a0: -1.5, a1: 1.5, own: box }, [box])).toEqual([]);
  });
  it('the lit map carries them: a hair proud of their receiver, darker than it; its foot darkened where a thing stands', () => {
    const P = assembleSideMap(m), sh = P.faces.filter((f) => f.group === 'sidemap:shadow');
    expect(sh.some((f) => f.normal[0] > 0.9 && f.corners[0][0] < 0)).toBe(true);
    const back = P.faces.find((f) => f.group === 'sidemap:back');
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return (n >> 16) + ((n >> 8) & 255) + (n & 255); };
    const onBack = sh.filter((f) => f.normal[0] > 0.9 && f.corners[0][0] < 0);
    expect(onBack.every((f) => Math.abs(f.corners[0][0] - back.corners[0][0]) < 0.05)).toBe(true);
    expect(onBack.some((f) => lum(f.fill) < lum(back.fill))).toBe(true);
    const { layout: L } = sideMapOf(m);
    expect(shadowCasters(L).length).toBe(L.solids.length);
  });
  it('a face toward the camera falls into shade deeper in its block', () => {
    const P = assembleSideMap(m), face = P.faces.find((f) => f.group === 'sidemap:rock' && f.normal[0] > 0.9 && Array.isArray(f.cornerFills) && Math.max(...f.corners.map((c) => c[2])) > -0.5 && Math.min(...f.corners.map((c) => c[2])) < -1.5);
    const lum = (h) => { const n = parseInt(h.slice(1), 16); return (n >> 16) + ((n >> 8) & 255) + (n & 255); };
    const hi = face.corners.reduce((a, c, i) => (c[2] > face.corners[a][2] ? i : a), 0), lo = face.corners.reduce((a, c, i) => (c[2] < face.corners[a][2] ? i : a), 0);
    expect(lum(face.cornerFills[lo])).toBeLessThan(lum(face.cornerFills[hi]));
  });
  it('the same map, the same shadows', () => {
    const a = assembleSideMap(m).faces.filter((f) => f.group === 'sidemap:shadow'), b = assembleSideMap(m).faces.filter((f) => f.group === 'sidemap:shadow');
    expect(a).toEqual(b);
  });
});
