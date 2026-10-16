// A field of liveries: cars painted to be told from their road and from each other, by every eye. The concepts: the
// laws hold for a field on a neutral circuit and on a world's palette (its ground read off its roles); a ground given
// is kept clear by its own distance; patterns rotate; the seed decides; junk is refused.
import { describe, it, expect } from 'vitest';
import { solveLiveries, groundOf, NEUTRAL_CIRCUIT, PAIR_MIN, LIVERY_FIELD_PATTERNS } from './livery.js';
import { solvePalette } from './solve.js';
import { deltaE, hexToRgb } from './oklab.js';

const dE = (a, b) => deltaE(hexToRgb(a), hexToRgb(b));

describe('a field of liveries', () => {
  it('paints a field on a neutral circuit clear of its ground and of each other', () => {
    const r = solveLiveries({ n: 6, seed: 4 });
    expect(r.against).toHaveLength(NEUTRAL_CIRCUIT.length);
    expect(r.laws.every((l) => l.ok)).toBe(true);
    for (const [i, l] of r.liveries.entries()) {
      for (const g of r.against) expect(dE(l.paint, g.hex), `${l.paint} on ${g.what}`).toBeGreaterThanOrEqual(g.min);
      for (const o of r.liveries.slice(i + 1)) expect(dE(l.paint, o.paint)).toBeGreaterThanOrEqual(PAIR_MIN);
      expect(dE(l.paint, l.secondary)).toBeGreaterThan(0.2);
    }
    r.liveries.forEach((l, i) => i && expect(l.pattern).not.toBe(r.liveries[i - 1].pattern));
    expect(new Set(r.liveries.map((l) => l.pattern))).toEqual(new Set(LIVERY_FIELD_PATTERNS));
  });

  it('reads a world\'s ground off its palette, and keeps a ground given by its own distance', () => {
    const K = solvePalette({ seed: 9, heat: 0.2, weight: 0.8, activity: 0.5, key: 'low' });
    const r = solveLiveries({ n: 4, seed: 4, palette: K });
    expect(r.against).toEqual(groundOf(K).map((g) => expect.objectContaining(g)));
    expect(r.laws.every((l) => l.ok)).toBe(true);
    const grey = solveLiveries({ n: 4, seed: 4, against: [{ what: 'road', hex: '#808080', min: 0.2 }] });
    for (const l of grey.liveries) expect(dE(l.paint, '#808080')).toBeGreaterThanOrEqual(0.2);
  });

  it('the seed decides, the same every time', () => {
    expect(solveLiveries({ n: 4, seed: 7 })).toEqual(solveLiveries({ n: 4, seed: 7 }));
    expect(solveLiveries({ n: 4, seed: 7 }).liveries).not.toEqual(solveLiveries({ n: 4, seed: 8 }).liveries);
  });

  it('refuses what is not a field', () => {
    expect(() => solveLiveries({ n: 0 })).toThrow(/1 to 12/);
    expect(() => solveLiveries({ n: 2, seed: 1.5 })).toThrow(/whole number/);
    expect(() => solveLiveries({ n: 2, against: [{ hex: 'red' }] })).toThrow(/#rrggbb/);
  });
});
