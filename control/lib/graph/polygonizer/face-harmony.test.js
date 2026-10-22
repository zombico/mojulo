import { describe, it, expect } from 'vitest';

import { RELATIONS, RELATION_POLES, relationalHead } from './head-relational.js';
import { HEAD_TUNES } from './hero-relational-head.js';
import { dimorphRelations, harmonyMeasures, DIMORPH_RANGE } from './face-harmony.js';

describe('the sex axis', () => {
  it('runs from the male pole (0) to the female pole (1), only over the ratios the poles move', () => {
    const at0 = dimorphRelations(0), at1 = dimorphRelations(1);
    expect(Object.keys(at1).sort()).toEqual([...new Set([...Object.keys(RELATION_POLES.male), ...Object.keys(RELATION_POLES.female)])].sort());
    for (const k of Object.keys(at1)) {
      expect(at0[k]).toBeCloseTo(RELATION_POLES.male[k] ?? RELATIONS[k], 12);
      expect(at1[k]).toBeCloseTo(RELATION_POLES.female[k] ?? RELATIONS[k], 12);
    }
  });
  it('reaches a little past either pole, and no further', () => {
    expect(dimorphRelations(1.5).jaw).toBeLessThan(RELATION_POLES.female.jaw);
    expect(() => dimorphRelations(DIMORPH_RANGE[1] + 0.01)).toThrow(/dimorph/);
    expect(() => dimorphRelations(Number.NaN)).toThrow(/dimorph/);
  });
});

describe('the harmony calipers', () => {
  it('read the chin, the bridge and the lower face, and a narrower chin reads narrower and pointier', () => {
    const base = harmonyMeasures(relationalHead({ sex: 'male', tune: HEAD_TUNES.male }));
    for (const v of Object.values(base)) expect(Number.isFinite(v)).toBe(true);
    const fine = harmonyMeasures(relationalHead({ sex: 'male', tune: HEAD_TUNES.male, relations: { chinWidth: -0.12, dorsum: -0.4 } }));
    expect(fine['chin width']).toBeLessThan(base['chin width'] - 5);
    expect(fine['chin fall 10']).toBeGreaterThan(base['chin fall 10']);
    expect(fine['root width']).toBeLessThan(base['root width']);
  });
});
