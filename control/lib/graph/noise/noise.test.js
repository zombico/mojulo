/**
 * The shared noise: the terrain kernel's gradient noise, its analytic gradient, the fractal flavours, and the promise
 * that a field is integer-exact (no transcendental call on a height path), so it is the same number in every engine.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { gnoise2, gnoised2, fractal2, warp2, terrace, FLAVOURS } from './noise.js';
import { terrainKernel } from '../terrain/terrain-kernel.js';

// a fixed scatter of sample points off the lattice, negatives included
const PTS = Array.from({ length: 64 }, (_, k) => [((k * 37) % 61) / 7.3 - 4.1, ((k * 53) % 59) / 6.1 - 4.7]);

describe('noise: gradient noise', () => {
  it('is the terrain kernel\'s gn, value for value', () => {
    // the kernel closes over its own copy: lift it out of the source rather than re-type it
    const src = terrainKernel.toString(), lift = (name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n  }', src.indexOf(`function ${name}(`)) + 4);
    const head = src.slice(src.indexOf('const GX'), src.indexOf('function gh('));
    const gn = new Function(`${head}\n${lift('gh').split('\n')[0]}\n${lift('gn')}\nreturn gn;`)();
    for (const [x, y] of PTS) for (const s of [0, 7, -3]) expect(gnoise2(x, y, s)).toBe(gn(x, y, s));
  });

  it('is zero on the lattice, bounded off it, and its gradient matches the value', () => {
    expect(gnoise2(3, -2, 5)).toBe(0);
    const h = 1e-5;
    for (const [x, y] of PTS) {
      const [v, dx, dy] = gnoised2(x, y, 11);
      expect(v).toBe(gnoise2(x, y, 11));
      expect(Math.abs(v)).toBeLessThanOrEqual(1.0001);
      expect(dx).toBeCloseTo((gnoise2(x + h, y, 11) - gnoise2(x - h, y, 11)) / (2 * h), 4);
      expect(dy).toBeCloseTo((gnoise2(x, y + h, 11) - gnoise2(x, y - h, 11)) / (2 * h), 4);
    }
  });
});

describe('noise: fractal sums', () => {
  it('keeps every flavour about [−1, 1], seeded and repeatable', () => {
    for (const flavour of FLAVOURS) {
      const F = { seed: 3, octaves: 5, flavour };
      const vs = PTS.map(([x, y]) => fractal2(x, y, F)[0]);
      expect(Math.max(...vs.map(Math.abs))).toBeLessThanOrEqual(1);
      expect(new Set(vs).size).toBeGreaterThan(50);
      expect(PTS.map(([x, y]) => fractal2(x, y, F)[0])).toEqual(vs);
      expect(PTS.map(([x, y]) => fractal2(x, y, { ...F, seed: 4 })[0])).not.toEqual(vs);
    }
    expect(() => fractal2(0, 0, { flavour: 'perlin' })).toThrow(/flavour 'perlin' is not one/);
  });

  it('carries an exact gradient through the turned octaves (fbm, billow, ridged)', () => {
    const h = 1e-6;
    for (const flavour of ['fbm', 'billow', 'ridged']) {
      const F = { seed: 9, octaves: 4, flavour };
      for (const [x, y] of PTS.slice(0, 16)) {
        const [, dx, dy] = fractal2(x, y, F);
        const cx = (fractal2(x + h, y, F)[0] - fractal2(x - h, y, F)[0]) / (2 * h), cy = (fractal2(x, y + h, F)[0] - fractal2(x, y - h, F)[0]) / (2 * h);
        // |n| has a kink at its zero crossing; these samples straddle none
        expect(dx).toBeCloseTo(cx, 3);
        expect(dy).toBeCloseTo(cy, 3);
      }
    }
  });

  it('damps the fine octaves where the coarse ones are steep', () => {
    // the damped sum moves less, octave to octave, than the plain one over the same plane
    const rough = (fl) => { let s = 0; for (let k = 0; k < 400; k++) { const x = k * 0.05; s += Math.abs(fractal2(x + 0.05, 1.3, { seed: 2, octaves: 6, flavour: fl })[0] - fractal2(x, 1.3, { seed: 2, octaves: 6, flavour: fl })[0]); } return s; };
    expect(rough('damped')).toBeLessThan(rough('fbm'));
  });

  it('warps and terraces', () => {
    const [x, y] = warp2(10, 20, { strength: 3, scale: 8, seed: 1 });
    expect(Math.hypot(x - 10, y - 20)).toBeGreaterThan(0);
    expect(Math.hypot(x - 10, y - 20)).toBeLessThanOrEqual(3 * Math.SQRT2);
    expect(terrace(0.1, 1, 0.3)).toBe(0);
    expect(terrace(1.95, 1, 0.3)).toBeGreaterThan(1.5);
    expect(terrace(1.5, 1, 0.3)).toBe(1);
  });
});

describe('noise: integer-exact', () => {
  it('calls no transcendental on a height path', () => {
    for (const f of ['noise.js', 'relief.js']) {
      const src = readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(src).not.toMatch(/Math\.(sin|cos|tan|atan2?|pow|exp|log2?|log10|hypot|random)\b|\*\*/);
    }
  });
});
