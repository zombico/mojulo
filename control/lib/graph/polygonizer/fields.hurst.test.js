/**
 * The `noise` field kind's opt-in roughness law (rock-formation.plan.md R3). Claims under test: the octave amplitudes
 * follow the wavelength law (one exponent → ratio 2^-H; two → 2^-large above the crossover, 2^-small below);
 * `hurst: 1` is the default persistence 0.5 up to rounding; a fracture-rough small scale is measurably rougher at
 * short lags than the default; the validator teaches (range, shape, and hurst-or-persistence).
 */
import { describe, expect, it } from 'vitest';

import { hurstAmplitudes, buildFieldResolver, validateFields } from './fields.js';

const ratios = (a) => a.slice(1).map((x, i) => x / a[i]);

describe('hurstAmplitudes', () => {
  it('one exponent is one ratio, 2^-H', () => {
    for (const r of ratios(hurstAmplitudes(8, 0.01, 0.8))) expect(r).toBeCloseTo(2 ** -0.8, 12);
  });
  it('two regimes: relief-smooth above the crossover, fracture-rough below, continuous', () => {
    // scale 1/2048 → wavelengths 2048, 1024, …, 16; crossover 100
    const a = hurstAmplitudes(8, 1 / 2048, { small: 0.8, large: 0.5, crossover: 100 });
    const r = ratios(a);
    expect(r[0]).toBeCloseTo(2 ** -0.5, 12);                 // 2048 → 1024
    expect(r[3]).toBeCloseTo(2 ** -0.5, 12);                 // 256 → 128
    expect(r[6]).toBeCloseTo(2 ** -0.8, 12);                 // 32 → 16
    const lam = (o) => 2048 / 2 ** o;                        // continuity: the law is one curve through (100, 100)
    for (let o = 0; o < 8; o++) expect(a[o]).toBeCloseTo(100 * (lam(o) / 100) ** (lam(o) >= 100 ? 0.5 : 0.8), 9);
  });
});

describe('the noise field with hurst', () => {
  const at = (fields, id) => buildFieldResolver(fields, new Map())(id);
  it('hurst: 1 is the default persistence ladder', () => {
    const plain = at({ n: { kind: 'noise', scale: 0.05, octaves: 6, seed: 'k' } }, 'n');
    const h1 = at({ n: { kind: 'noise', scale: 0.05, octaves: 6, seed: 'k', hurst: 1 } }, 'n');
    for (const [x, y] of [[0, 0], [3.3, -7.1], [40, 12], [-90.5, 64]]) expect(h1({ x, y, z: 0 })).toBeCloseTo(plain({ x, y, z: 0 }), 12);
  });
  it('a fracture-rough small scale is rougher at short lags than the default', () => {
    const rough = at({ n: { kind: 'noise', scale: 1 / 512, octaves: 9, seed: 7, hurst: { small: 0.8, large: 0.5, crossover: 64 } } }, 'n');
    const smooth = at({ n: { kind: 'noise', scale: 1 / 512, octaves: 9, seed: 7 } }, 'n');
    const shortToLong = (f) => { let s = 0, l = 0; for (let i = 0; i < 400; i++) { const x = i * 3.1; s += (f({ x: x + 2, y: 5, z: 0 }) - f({ x, y: 5, z: 0 })) ** 2; l += (f({ x: x + 128, y: 5, z: 0 }) - f({ x, y: 5, z: 0 })) ** 2; } return s / l; };
    expect(shortToLong(rough)).toBeGreaterThan(1.5 * shortToLong(smooth));
  });
  it('validation teaches', () => {
    const errs = (decl) => validateFields({ n: { kind: 'noise', ...decl } }, new Map()).join(' ');
    expect(errs({ hurst: 0.8 })).toBe('');
    expect(errs({ hurst: { small: 0.8, large: 0.5, crossover: 100 } })).toBe('');
    expect(errs({ hurst: 3 })).toMatch(/roughness exponent in \[0\.1, 1\.5\]/);
    expect(errs({ hurst: { small: 0.8 } })).toMatch(/crossover/);
    expect(errs({ hurst: 0.8, persistence: 0.6 })).toMatch(/hurst replaces persistence/);
    expect(errs({ hurst: 0.8, scale: 0 })).toMatch(/scale: must be > 0 with hurst/);   // its octaves had no wavelength: NaN ground
    expect(errs({ hurst: 0.8, scale: -0.1 })).toMatch(/scale: must be > 0 with hurst/);
    expect(errs({ scale: 0 })).toBe('');                                                // without hurst, a zero scale is a constant, as before
  });
});
