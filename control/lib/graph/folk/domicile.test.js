import { describe, it, expect } from 'vitest';
import { readDomicile, notationOf, rollDomicile, partnerLean, childLean, SHAPES, SHAPE_ODDS, MAX_CHILDREN } from './domicile.js';
import { AGES } from '../egocube/facets.js';
import { mulberry32 } from '../vegetation/grow.js';

const BANDS = Object.keys(AGES);

describe('domicile: the notation', () => {
  it('reads D + 0, D + P, D of F (P + Cx) and D + Cx, and writes them back', () => {
    expect(readDomicile('D + 0')).toEqual({ shape: 'alone', children: 0 });
    expect(readDomicile('D+P')).toEqual({ shape: 'couple', children: 0 });
    expect(readDomicile('D of F (P + C2)')).toEqual({ shape: 'family', children: 2 });
    expect(readDomicile('D + P + C3')).toEqual({ shape: 'family', children: 3 });
    expect(readDomicile('D + C2')).toEqual({ shape: 'single', children: 2 });
    for (const n of ['D + 0', 'D + P', 'D of F (P + C2)', 'D + C1']) expect(notationOf(readDomicile(n))).toBe(n);
  });

  it('reads the words too, and refuses what is not a house, teaching', () => {
    expect(readDomicile({ shape: 'family' })).toEqual({ shape: 'family', children: 1 });
    expect(() => readDomicile('D + Q')).toThrow(/'D \+ 0' \(alone\)/);
    expect(() => readDomicile(`D of F (P + C${MAX_CHILDREN + 1})`)).toThrow(/1 to 4 children/);
    expect(() => readDomicile({ shape: 'couple', children: 2 })).toThrow(/only a family or a single parent has children/);
    expect(() => readDomicile({ shape: 'crowd' })).toThrow(/shape is alone, couple, family, single/);
  });
});

describe('domicile: the dweller\'s age says what a house can be', () => {
  it('rolls only the shapes the age has odds for, children only where the shape has them', () => {
    const rand = mulberry32(7);
    for (const age of ['youth', 'elder']) for (let i = 0; i < 40; i++) {
      const d = rollDomicile(age, rand, [2, 3]);
      expect(SHAPE_ODDS[age][d.shape]).toBeGreaterThan(0);
      expect(d.children > 0).toBe(SHAPES[d.shape].children);
      expect(d.children).toBeLessThanOrEqual(MAX_CHILDREN);
    }
  });

  it('throws the same dice whatever the shape, so a house never moves the next', () => {
    const a = mulberry32(3), b = mulberry32(3);
    rollDomicile('youth', a); rollDomicile('adult', b);
    expect(a()).toBe(b());
  });

  it('leans a child younger than the dweller and a partner near their age', () => {
    for (const age of ['adult', 'elder']) {
      const i = BANDS.indexOf(age);
      for (const [b, w] of Object.entries(childLean(age).age)) if (w > 0) expect(BANDS.indexOf(b)).toBeLessThan(i);
      for (const [b, w] of Object.entries(partnerLean(age).age)) if (w > 0) expect(Math.abs(BANDS.indexOf(b) - i)).toBeLessThanOrEqual(1);
    }
    expect(partnerLean('youth').age.child).toBe(0);
  });
});
