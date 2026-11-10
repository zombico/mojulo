// The sun as a baked light (sun-light.js): a building's faces baked with their colour and their light apart, under the
// light a cube solves. One cube whose solve has a real sun, one wall, one roof, one soffit and a slab that shades:
// the concepts, on the smallest thing that shows them.
import { describe, it, expect } from 'vitest';
import { sunLitFaces, skyAt, baseOf, SUN_LIGHT } from './sun-light.js';
import { cubeLight, seen } from '../era/cube-light.js';
import { readGeocube } from '../era/geocube.js';
import { makeSunShadow } from '../era/sun.js';

const L = cubeLight(readGeocube('island-noon')), light = { sun: L.sun.linear, ambient: L.ambient.linear, dir: L.sun.dir };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const PAINT = '#b8a078';
// a wall facing the sun's bearing, a roof, a soffit, each a square of side 2 with its normal
const bearing = (() => { const d = [light.dir[0], light.dir[1]], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l, 0]; })();
const side = [-bearing[1], bearing[0], 0];
const wallAt = (z0) => ({ group: 'town:wall', fill: PAINT, normal: bearing, corners: [[-1, 0], [1, 0], [1, 2], [-1, 2]].map(([u, v]) => [side[0] * u, side[1] * u, z0 + v]) });
const flat = (z, nz, group) => ({ group, fill: PAINT, normal: [0, 0, nz], corners: [[-1, -1, z], [1, -1, z], [1, 1, z], [-1, 1, z]] });

describe('the sun as a baked light', () => {
  it('a face carries its colour and its light apart: the colour its paint\'s base, the light the day\'s on that face', () => {
    const { faces: [wall, roof, soffit], unreached } = sunLitFaces([wallAt(0), flat(4, 1, 'town:roof'), flat(3, -1, 'town:soffit')], light);
    expect(unreached).toEqual([]);
    // (one base for one paint, whatever way the face turns: the colour does not carry the light)
    expect(new Set([wall.fill, roof.fill, soffit.fill, ...wall.cornerFills]).size).toBe(1);
    // (the roof takes the whole sky and the sun by its height; the wall half the sky and the sun by its bearing; the
    // soffit no sun, and only what the ground throws back)
    const y = (f) => lum(f.cornerLight[0]);
    expect(y(roof)).toBeGreaterThan(y(wall));
    expect(y(wall)).toBeGreaterThan(y(soffit));
    expect(soffit.sunShare).toEqual([0, 0, 0, 0]);
    expect(wall.sunShare[0]).toBeGreaterThan(0);
    soffit.cornerLight[0].forEach((v, k) => expect(v).toBeCloseTo(skyAt([0, 0, -1], light)[k], 4));
    expect(lum(soffit.cornerLight[0])).toBeCloseTo(SUN_LIGHT.ground * (lum(light.ambient) + lum(light.sun) * Math.max(0, light.dir[2])), 3);
    // (deterministic)
    expect(JSON.stringify(sunLitFaces([wallAt(0)], light))).toBe(JSON.stringify(sunLitFaces([wallAt(0)], light)));
  });

  it('the base is the paint\'s colour shown square to the sun under the whole sky, the land\'s own reference', () => {
    const { base, unreached } = baseOf(PAINT, light);
    expect(unreached).toBe(false);
    expect(seen(base, L, 1)).toBe(PAINT);
    // (a colour brighter than this light can show is held, and its group named)
    const bright = sunLitFaces([{ ...wallAt(0), fill: '#ffffff', group: 'town:trim' }], { ...light, sun: light.sun.map((v) => v * 0.2), ambient: light.ambient.map((v) => v * 0.2) });
    expect(bright.unreached).toEqual(['town:trim']);
  });

  it('a corner the sun cannot see takes none of it: under a slab the wall is the sky\'s alone, above it the sun\'s too', () => {
    // (a slab standing off the wall toward the sun, over its lower half: an eave seen from below)
    const off = (d, z) => [bearing[0] * d, bearing[1] * d, z];
    const slab = { group: 'town:eave', fill: PAINT, normal: [0, 0, 1], corners: [[-3, 0.05], [3, 0.05], [3, 3], [-3, 3]].map(([u, d]) => { const p = off(d, 2.4); return [p[0] + side[0] * u, p[1] + side[1] * u, p[2]]; }) };
    const shadow = makeSunShadow([slab], light.dir);
    const low = sunLitFaces([wallAt(0)], light, { shadow }).faces[0], open = sunLitFaces([wallAt(0)], light).faces[0];
    // (the corners at the wall's foot sit under the slab where the sun stands high; its top corners, over it, are lit)
    const foot = low.corners.map((c, i) => [c[2], i]).sort((a, b) => a[0] - b[0])[0][1];
    if (light.dir[2] > 0.3) {
      expect(low.sunShare[foot]).toBe(0);
      expect(lum(low.cornerLight[foot])).toBeLessThan(lum(open.cornerLight[foot]));
    }
    expect(open.sunShare.every((s) => s > 0)).toBe(true);
  });

  it('a group kept as painted, and a face with no normal, are returned as they came', () => {
    const glass = { ...wallAt(0), group: 'town:glass' }, bare = { group: 'x', fill: PAINT, corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] };
    const { faces } = sunLitFaces([glass, bare], light, { keep: new Set(['town:glass']) });
    expect(faces[0]).toBe(glass);
    expect(faces[1]).toBe(bare);
  });
});
