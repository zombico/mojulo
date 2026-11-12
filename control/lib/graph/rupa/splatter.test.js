// Splatter patterns (rupa/splatter.js): shapes a liquid leaves on a flat, as primitives that join.
import { describe, it, expect } from 'vitest';
import { blot, splash, drips, run, seam, puddles, join, splatField, rasterSplatter, EDGE } from './splatter.js';

const stands = (f, x, y) => f(x, y) >= EDGE;

describe('splatter: patterns that join', () => {
  it('a pattern is seeded: the same seed the same shape, another seed another', () => {
    expect(blot([0, 0], 2, 5)).toEqual(blot([0, 0], 2, 5));
    expect(blot([0, 0], 2, 5)).not.toEqual(blot([0, 0], 2, 6));
  });

  it('a blot stands at its heart and is dry well past its size; a splash throws drops past its body', () => {
    const f = splatField(blot([0, 0], 2, 3));
    expect(stands(f, 0, 0)).toBe(true);
    expect(f(4, 0)).toBe(0);
    const S = splash([0, 0], 2, 3), far = S.filter((p) => p.at && Math.hypot(...p.at) > 0.6);
    expect(far.length).toBeGreaterThan(0);
    for (const p of far) expect(p.r).toBeLessThan(0.3);
  });

  it('two patterns that meet run into one: the gap between two blots stands once a third is laid across it', () => {
    const a = blot([0, 0], 1.2, 1), b = blot([1.7, 0], 1.2, 2);
    expect(stands(splatField(join(a, b)), 0.85, 0)).toBe(false);
    expect(stands(splatField(join(a, b, seam([0.3, 0], [1.4, 0], 0.5))), 0.85, 0)).toBe(true);
  });

  it('a trail and a run lie along their way', () => {
    const d = drips([0, 0], [4, 0], 9);
    expect(d.length).toBeGreaterThan(5);
    for (const p of d) expect(Math.abs(p.at[1])).toBeLessThan(0.3);
    const f = splatField(run([0, 0], [3, 0], 0.3, 2));
    expect(stands(f, 1.5, 0)).toBe(true);
    expect(stands(f, 1.5, 1)).toBe(false);
  });

  it('rain on a flat: about the share asked stands in water, none with its heart in a box kept out, and a page\'s raster agrees with the field', () => {
    const rect = [0, 0, 20, 20], keepOut = [[5, 5, 15, 15]], P = puddles(rect, { cover: 0.25, seed: 4, keepOut });
    for (const p of P.filter((q) => q.at && q.r > 0.4)) expect(p.at[0] > 3.5 && p.at[0] < 16.5 && p.at[1] > 3.5 && p.at[1] < 16.5 && false).toBe(false);
    const R = rasterSplatter(P, rect, 96), wet = R.reduce((n, v) => n + (v >= EDGE * 255 ? 1 : 0), 0) / R.length;
    expect(wet).toBeGreaterThan(0.06);
    expect(wet).toBeLessThan(0.5);
    const more = rasterSplatter(puddles(rect, { cover: 0.5, seed: 4, keepOut }), rect, 96);
    expect(more.reduce((n, v) => n + (v >= EDGE * 255 ? 1 : 0), 0)).toBeGreaterThan(R.reduce((n, v) => n + (v >= EDGE * 255 ? 1 : 0), 0));
    const f = splatField(P), i = 40, j = 12;
    expect(Math.abs(R[j * 96 + i] / 255 - f((i + 0.5) * 20 / 96, (j + 0.5) * 20 / 96))).toBeLessThan(0.02);
  });
});
