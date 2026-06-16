import { describe, it, expect } from 'vitest';
import {
  makeLight, DEFAULT_LIGHT, litFactor, shadeHex, scaleHex,
  newellNormal, orientOutward, shadeFace, norm3, dot3,
} from './vexar.js';

const z0 = (a) => a.map((x) => x + 0);   // normalize -0 → 0 for deep-equality

describe('vexar', () => {
  it('makeLight normalizes direction and exposes the to-light vector', () => {
    const L = makeLight({ direction: [0, 0, -2], ambient: 0.4, diffuse: 0.6 });
    expect(z0(L.dir)).toEqual([0, 0, -1]);
    expect(z0(L.toLight)).toEqual([0, 0, 1]);
    expect(L.ambient).toBe(0.4);
  });

  it('litFactor: a face pointing at the light is brightest, away is the ambient floor', () => {
    const L = makeLight({ direction: [0, 0, -1], ambient: 0.4, diffuse: 0.6 });
    expect(litFactor([0, 0, 1], L)).toBeCloseTo(1.0);   // normal toward the light
    expect(litFactor([0, 0, -1], L)).toBeCloseTo(0.4);  // away → clamped to ambient
    expect(litFactor([1, 0, 0], L)).toBeCloseTo(0.4);   // perpendicular → ambient
  });

  it('shadeHex scales a fill by the Lambert factor', () => {
    const L = makeLight({ direction: [0, 0, -1], ambient: 0.5, diffuse: 0.5 });
    expect(shadeHex('#ffffff', [0, 0, 1], L)).toBe('#ffffff');   // factor 1.0
    expect(shadeHex('#ffffff', [0, 0, -1], L)).toBe('#808080');  // factor 0.5
    expect(scaleHex('#202020', 2)).toBe('#404040');
  });

  it('newellNormal + orientOutward yield a true outward normal regardless of winding', () => {
    // a quad in the z=1 plane, wound either way
    const ccw = [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    const cw = [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]];
    const inside = [0.5, 0.5, 0];   // below the quad
    const nCcw = orientOutward(newellNormal(ccw), [0.5, 0.5, 1], inside);
    const nCw = orientOutward(newellNormal(cw), [0.5, 0.5, 1], inside);
    expect(z0(nCcw)).toEqual([0, 0, 1]);   // both point up, away from inside
    expect(z0(nCw)).toEqual([0, 0, 1]);
  });

  it('shadeFace returns a lit fill + outward normal in one call', () => {
    const corners = [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
    const L = makeLight({ direction: [0, 0, -1], ambient: 0.5, diffuse: 0.5 });
    const { fill, normal } = shadeFace(corners, '#ffffff', { light: L, inside: [0.5, 0.5, 0] });
    expect(z0(normal)).toEqual([0, 0, 1]);
    expect(fill).toBe('#ffffff');      // faces straight at the light
  });

  it('vector helpers behave', () => {
    expect(norm3([3, 0, 4])).toEqual([0.6, 0, 0.8]);
    expect(dot3([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(DEFAULT_LIGHT.ambient).toBeGreaterThan(0);
  });
});
