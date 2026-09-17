import { describe, it, expect } from 'vitest';
import {
  makeLight, DEFAULT_LIGHT, litFactor, shadeHex, scaleHex,
  newellNormal, orientOutward, shadeFace, norm3, dot3,
  withBands, bandFactor, resolveToon, shadeHexMat, FLAT_LIGHT,
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

describe('toon bands (toon-shading)', () => {
  const L = makeLight({ direction: [0, 0, -1], ambient: 0.4, diffuse: 0.6 });
  const n = (deg) => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];

  it('withBands: absent or < 2 hands the SAME light back; FLAT_LIGHT stays flat; the input is untouched', () => {
    expect(withBands(L)).toBe(L);
    expect(withBands(L, 1)).toBe(L);
    expect(withBands(FLAT_LIGHT, 3)).toBe(FLAT_LIGHT);
    expect(withBands(L, 3).bands).toBe(3);
    expect(withBands(L, 3.9).bands).toBe(3);
    expect(L.bands).toBeUndefined();
    expect(makeLight({ bands: 4 }).bands).toBe(4);
    expect(makeLight({})).not.toHaveProperty('bands');
  });

  it('bands snap the factor to N tones: same tone → equal, endpoints kept, mid tone at ambient + range/2', () => {
    const B = withBands(L, 3);
    expect(litFactor(n(80), B)).toBe(litFactor(n(85), B));      // both in the shadow tone
    expect(litFactor(n(80), L)).not.toBe(litFactor(n(85), L));  // continuous Lambert separates them
    expect(litFactor(n(0), B)).toBeCloseTo(1.0);
    expect(litFactor(n(180), B)).toBeCloseTo(0.4);
    expect(litFactor(n(50), B)).toBeCloseTo(0.7);               // mid tone
    expect(litFactor(n(50), L)).toBeCloseTo(0.7857, 3);
  });

  it('bandFactor bands the whole [ambient, ambient+range] span and is inert below two tones', () => {
    expect(bandFactor(0.55, 0.4, 0.6, 1)).toBe(0.55);
    expect(bandFactor(0.55, 0.4, 0, 3)).toBe(0.55);
    expect(bandFactor(0.55, 0.4, 0.6, 2)).toBeCloseTo(0.4);
    expect(bandFactor(0.75, 0.4, 0.6, 2)).toBeCloseTo(1.0);
  });

  it('shadeHexMat: the light bands a material without cel; a material cel wins over the light', () => {
    const B = withBands(L, 3);
    expect(shadeHexMat('#ffffff', n(50), { ambient: 0.4, diffuse: 0.6 }, { light: B })).toBe('#b3b3b3');   // 0.7
    expect(shadeHexMat('#ffffff', n(50), { ambient: 0.4, diffuse: 0.6 }, { light: L })).toBe('#c8c8c8');   // 0.786
    expect(shadeHexMat('#ffffff', n(50), { ambient: 0.4, diffuse: 0.6, cel: 4 }, { light: B }))
      .toBe(shadeHexMat('#ffffff', n(50), { ambient: 0.4, diffuse: 0.6, cel: 4 }, { light: L }));
  });

  it('resolveToon normalizes the manifest dial', () => {
    expect(resolveToon(true)).toEqual({ bands: 3, ink: true });
    expect(resolveToon({ bands: 4 })).toEqual({ bands: 4 });
    expect(resolveToon({ bands: 2.7, ink: { color: '#000' } })).toEqual({ bands: 2, ink: { color: '#000' } });
    expect(resolveToon({ ink: true })).toEqual({ ink: true });
    expect(resolveToon({ bands: 1 })).toBeNull();
    expect(resolveToon({})).toBeNull();
    expect(resolveToon('toon')).toBeNull();
    expect(resolveToon(undefined)).toBeNull();
  });
});
