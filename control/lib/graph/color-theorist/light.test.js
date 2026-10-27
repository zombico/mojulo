// The light a palette asks for (light.js): a mirror over a body (water) solved so the palette's colour is what is seen
// from a view, and named where the sky it reflects already outshines it; a solved day palette's light on the cube's sun.
import { describe, expect, it } from 'vitest';
import { solveLight, solveMirror, fresnelAt, toneNeutral, decodeSrgb, encodeSrgb } from './light.js';
import { readGeocube, GEOCUBE_PALETTES } from '../era/geocube.js';
import { cubeLight } from '../era/cube-light.js';

const L = solveLight({ targets: { sand: '#e6d3a4' }, sky: '#a6ccff', sun: '#fff4d8', contrast: 0.38 });
const display = (lin) => '#' + toneNeutral(lin).map((v) => Math.round(encodeSrgb(Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const lin = (hex) => [1, 3, 5].map((i) => decodeSrgb(parseInt(hex.slice(i, i + 2), 16) / 255));

describe('a mirror over a body', () => {
  it('seen from above the sea is its body under the light and a little sky; from low down mostly sky', () => {
    expect(fresnelAt(90)).toBeCloseTo(0.04, 3);
    expect(fresnelAt(10)).toBeGreaterThan(0.3);
    const target = '#3a9cc6', sees = '#9fc0e9', light = { ambient: L.ambient, sun: L.sun };
    const high = solveMirror({ target, sees, view: 70, light, cos: 0.85 });
    expect(high.unreached).toBeUndefined();
    // what the eye gets back: F × the sky + (1 − F) × body × light, through the tone curve, is the target
    const lit = L.ambient.map((a, k) => a + L.sun[k] * 0.85), F = high.fresnel;
    expect(display(high.base.map((b, k) => F * lin(sees)[k] + (1 - F) * b * lit[k]))).toBe(target);
    // a low view: the reflection alone outshines the target in red, so the body has nothing to give there: named
    expect(solveMirror({ target, sees, view: 14, light, cos: 0.85 }).unreached).toBeTruthy();
  });

  it('a solved day palette lights its sun in its own light; the hour\'s key where the cube names none', () => {
    const own = readGeocube('island-noon'), solved = readGeocube({ from: 'island-noon', palette: { ...GEOCUBE_PALETTES['island-noon'], seed: 5 } });
    expect(own.light.sun).toBeUndefined();
    expect(solved.light.sun.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(readGeocube(solved).light.sun).toEqual(solved.light.sun);
    expect(cubeLight(solved).sun.color).toBe(solved.light.sun.color);
    expect(() => readGeocube({ from: 'island-noon', light: { reference: 'island-noon', sun: { color: 'warm' } } })).toThrow(/light\.sun is \{ color/);
  });
});
