// The steady Kelvin field the World page's seaway channel draws (kelvin.js, inlined into the page as written): nothing
// ahead of the source or outside its 19.47° wedge, a transverse crest on the track every wavelength 2πU²/g, the height
// falling down the track and highest toward the cusp, a fast boat's divergent waves strongest on its apparent angle, and
// waves too short for the sheet faded rather than aliased.
import { describe, it, expect } from 'vitest';
import { kelvinField } from './kelvin.js';

const G = 9.81, U = 8, k0 = G / (U * U), lam = (2 * Math.PI) / k0, P = { k0, a0: 0.5, reach: 40 * lam, lw: lam, lifted: false, app: Math.asin(1 / 3), cell: 0 };

describe('the Kelvin field behind a moving source', () => {
  it('is still ahead of the source and outside its wedge', () => {
    expect(kelvinField(-5, 0, P)).toBe(0);
    expect(kelvinField(0, 3, P)).toBe(0);
    const x = 6 * lam;
    expect(kelvinField(x, x * Math.tan(Math.asin(1 / 3)) * 1.02, P)).toBe(0);
    expect(Math.abs(kelvinField(x, x * 0.2, P))).toBeGreaterThan(0);
  });
  it('crests on its track every transverse wavelength 2πU²/g, troughs between', () => {
    for (const n of [3, 4, 5]) {
      expect(kelvinField(n * lam, 0, P)).toBeGreaterThan(0);
      expect(kelvinField((n + 0.5) * lam, 0, P)).toBeLessThan(0);
      // (a local maximum along the track at the crest)
      expect(kelvinField(n * lam, 0, P)).toBeGreaterThan(kelvinField(n * lam + 0.1 * lam, 0, P));
      expect(kelvinField(n * lam, 0, P)).toBeGreaterThan(kelvinField(n * lam - 0.1 * lam, 0, P));
    }
  });
  it('falls down the track and rises toward the cusp', () => {
    expect(kelvinField(3 * lam, 0, P)).toBeGreaterThan(kelvinField(12 * lam, 0, P));
    // (the envelope across a crest's reach: sampled over a wavelength near the track and near the cusp)
    const env = (beta) => { let m = 0; for (let k = 0; k < 200; k += 1) { const x = 8 * lam + (k / 200) * lam; m = Math.max(m, Math.abs(kelvinField(x, x * Math.tan(beta), P))); } return m; };
    expect(env(0.95 * Math.asin(1 / 3))).toBeGreaterThan(env(0.02));
  });
  it('a lifted boat\'s divergent waves strongest along its apparent angle; short waves faded on a coarse sheet', () => {
    const app = 8 * Math.PI / 180, L = { ...P, lifted: true, app };
    const env = (beta) => { let m = 0; for (let k = 0; k < 400; k += 1) { const x = 2 * lam + (k / 400) * lam; m = Math.max(m, Math.abs(kelvinField(x, x * Math.tan(beta), L))); } return m; };
    expect(env(app)).toBeGreaterThan(env(17 * Math.PI / 180));
    const near = (cell) => { let m = 0; for (let k = 0; k < 400; k += 1) { const x = 2 * lam + (k / 400) * lam; m = Math.max(m, Math.abs(kelvinField(x, x * Math.tan(0.33), { ...P, cell }))); } return m; };
    expect(near(lam)).toBeLessThan(near(0));
    expect(near(4 * lam)).toBe(0);
  });
});
