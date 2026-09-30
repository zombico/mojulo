import { describe, it, expect } from 'vitest';
import { METALS, METAL_NAMES, FINISH_NAMES, metalRgb, metalLut, LUT_D, LUT_A, resolveMetalSurface, metalSurfaceError, metalShelfRow, isMetalSurface, copperAge } from './metal-surface.js';
import { MATERIALS, resolveMaterial, validateMaterialRef } from '../polygonizer/materials.js';

// linear-sRGB colour name, coarse, for the film-order checks (the spike's classifier)
const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
function hue(lin) { const [r, g, b] = lin.map((v) => enc(Math.max(0, Math.min(1, v)))); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return { h: 0, s: 0 };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h, s: d / mx }; }
const isBlue = (c) => { const { h, s } = hue(c); return s > 0.3 && h >= 195 && h < 250; };
const isWarm = (c) => { const { h, s } = hue(c); return s > 0.2 && (h < 70 || h >= 345); };
const isPurple = (c) => { const { h, s } = hue(c); return s > 0.25 && h >= 250 && h < 345; };

describe('metal surface — the metal table (measured n + ik)', () => {
  it('head-on colours land on the spike table (same data, same maths)', () => {
    const want = { steel: [0.574, 0.567, 0.563], aluminium: [0.908, 0.916, 0.922], titanium: [0.618, 0.58, 0.542], gold: [1, 0.786, 0.342], chrome: [0.55, 0.556, 0.554] };
    for (const [m, w] of Object.entries(want)) metalRgb(m).forEach((v, k) => expect(Math.abs(v - w[k])).toBeLessThan(0.002));
  });
  it('every metal whitens at grazing (past the principal-angle dip Schlick misses) and stays in [0, 1]', () => {
    for (const m of METAL_NAMES) { const f0 = metalRgb(m), e = metalRgb(m, { cos: 0.01 }); for (let k = 0; k < 3; k++) { expect(e[k]).toBeGreaterThan(Math.min(0.9, f0[k])); expect(f0[k]).toBeLessThanOrEqual(1); expect(f0[k]).toBeGreaterThanOrEqual(0); } }
  });
  it('lookup tables: 64 × 16 for a film metal, 1 × 16 for a bare one, identical bytes on a rebuild', () => {
    expect(metalLut('titanium').length).toBe(LUT_D * LUT_A * 3); expect(metalLut('gold').length).toBe(LUT_A * 3);
    expect(Buffer.from(metalLut('bismuth')).toString('base64')).toBe(Buffer.from(metalLut('bismuth')).toString('base64'));
  });
});

describe('metal surface — films follow the shop charts', () => {
  it('titanium anodize: 15 V warm (bronze), 20 V purple, 25 V blue', () => {
    const at = (V) => resolveMetalSurface({ metal: 'titanium', film: { anodize: V } }).normal;
    expect(isWarm(at(15))).toBe(true); expect(isPurple(at(20))).toBe(true); expect(isBlue(at(25))).toBe(true);
  });
  it('steel temper: straw below brown below blue with rising temperature, then grey scale', () => {
    const d = (T) => resolveMetalSurface({ metal: 'steel', finish: 'polished', film: { temper: T } }).d;
    expect(d(220)).toBeLessThan(d(255)); expect(d(255)).toBeLessThan(d(295));
    expect(isBlue(resolveMetalSurface({ metal: 'steel', finish: 'polished', film: { temper: 300 } }).normal)).toBe(true);
    const hot = resolveMetalSurface({ metal: 'steel', finish: 'polished', film: { temper: 420 } }).normal; expect(Math.max(...hot)).toBeLessThan(0.2);
  });
  it('copper age: no green before four years, green by forty', () => {
    expect(copperAge(3).green).toBe(0); expect(copperAge(40).green).toBe(1); expect(copperAge(0.1).brown).toBe(0);
  });
});

describe('metal surface — the spec', () => {
  it('recognises only a string `metal` (the shelf rows carry metal: 1)', () => {
    expect(isMetalSurface({ metal: 'steel' })).toBe(true); expect(isMetalSurface({ metal: 1 })).toBe(false); expect(isMetalSurface('steel')).toBe(false);
  });
  it('refuses loudly, naming the choices', () => {
    expect(metalSurfaceError({ metal: 'golden' })).toMatch(/unknown metal 'golden'.*stainless/);
    expect(metalSurfaceError({ metal: 'steel', finish: 'satin' })).toMatch(/unknown finish.*brushed/);
    expect(metalSurfaceError({ metal: 'steel', finish: 'spangle' })).toMatch(/belongs to zinc/);
    expect(metalSurfaceError({ metal: 'gold', film: { temper: 300 } })).toMatch(/grows no coloured film/);
    expect(metalSurfaceError({ metal: 'steel', film: { anodize: 20 } })).toMatch(/only titanium/);
    expect(metalSurfaceError({ metal: 'steel', along: 'sideways' })).toMatch(/along is one of/);
    expect(metalSurfaceError({ metal: 'steel', colour: 'red' })).toMatch(/not colour/);
    for (const f of FINISH_NAMES) { const only = { spangle: 'zinc', mill: 'steel', hopper: 'bismuth' }[f] || 'stainless'; expect(metalSurfaceError({ metal: only, finish: f })).toBeNull(); }
    // a prototype name is not a metal, an alias or a finish: it used to validate, then throw (or resolve NaN) at render
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(metalSurfaceError({ metal: name })).toMatch(new RegExp(`unknown metal '${name}'`));
      expect(metalSurfaceError({ metal: 'steel', finish: name })).toMatch(new RegExp(`unknown finish '${name}'`));
      expect(validateMaterialRef({ metal: name })).toMatch(/unknown metal/);
      expect(validateMaterialRef(name)).toMatch(/unknown material/);
      expect(resolveMaterial({ metal: name })).toBe(MATERIALS.steel);   // the documented fallback, not a TypeError
      expect(resolveMaterial(name)).toBe(MATERIALS.steel);
    }
  });
  it('resolves to a canonical key, defaults from the metal, aliases by plain word', () => {
    const a = resolveMetalSurface({ metal: 'aluminum' }); expect(a.metal).toBe('aluminium'); expect(a.finish).toBe(METALS.aluminium.finish);
    expect(resolveMetalSurface({ metal: 'zinc' }).finish).toBe('spangle');
    expect(resolveMetalSurface({ metal: 'bismuth' }).spread).toBeGreaterThan(0);
    expect(resolveMetalSurface({ metal: 'steel', seed: 2 }).key).toBe(resolveMetalSurface({ seed: 2, metal: 'steel' }).key);
  });
  it('a shelf row carries the surface and reads as a metal', () => {
    const row = metalShelfRow(resolveMetalSurface({ metal: 'stainless', finish: 'brushed' }));
    expect(row.metal).toBe(1); expect(row.surface.finish).toBe('brushed'); expect(row.base).toMatch(/^#[0-9a-f]{6}$/);
    expect(resolveMetalSurface({ metal: 'steel' }).hex).not.toBe(resolveMetalSurface({ metal: 'steel', finish: 'polished' }).hex);   // mill scale is dark
  });
});
