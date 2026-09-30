/**
 * rock-minerals — the lattice half of a rock (rock-formation.plan.md R1). Claims under test: the plane normals derived
 * from each cell reproduce the textbook interfacial angles (so the table is the crystallography, not a guess); the
 * point groups close to their orders; each mineral's cleavage resolves to the right number of distinct planes; the
 * chain width shows in the angle (pyroxene ≈ 87°, amphibole ≈ 56°); rock mixes validate with teaching errors.
 */
import { describe, expect, it } from 'vitest';

import { MINERALS, ROCK_PRESETS, ROCK_PRESET_IDS, planeNormal, angleDeg, pointGroup, cleavageNormals, formNormals, resolveRock, validateRockMix } from './rock-minerals.js';

const between = (m, a, b) => angleDeg(planeNormal(MINERALS[m].cell, a), planeNormal(MINERALS[m].cell, b));

describe('lattice-derived angles match the textbook', () => {
  it('calcite cleavage rhomb: 74.95° / 105.05°', () => {
    const n = between('calcite', [1, 0, -1, 4], [-1, 1, 0, 4]);
    expect(n).toBeCloseTo(74.94, 1);
    expect(180 - n).toBeCloseTo(105.06, 1);
  });
  it('quartz r face 51.8° from c; m∧r 38.2°', () => {
    expect(angleDeg(planeNormal(MINERALS.quartz.cell, [1, 0, -1, 1]), [0, 0, 1])).toBeCloseTo(51.79, 1);
    expect(between('quartz', [1, 0, -1, 0], [1, 0, -1, 1])).toBeCloseTo(38.21, 1);
  });
  it('feldspars: orthoclase 90° exactly, albite oblique 86.4° (plagio-clase)', () => {
    expect(between('orthoclase', [0, 0, 1], [0, 1, 0])).toBeCloseTo(90, 6);
    expect(between('albite', [0, 0, 1], [0, 1, 0])).toBeCloseTo(86.38, 1);
  });
  it('the chain width is in the angle: pyroxene ≈ 87/93°, amphibole ≈ 56/124°', () => {
    const px = between('augite', [1, 1, 0], [1, -1, 0]); const am = between('hornblende', [1, 1, 0], [1, -1, 0]);
    expect(Math.min(px, 180 - px)).toBeGreaterThan(86); expect(Math.min(px, 180 - px)).toBeLessThan(88.5);
    expect(Math.min(am, 180 - am)).toBeGreaterThan(55); expect(Math.min(am, 180 - am)).toBeLessThan(57);
  });
  it('halite cube and mica (110)∧(010) ≈ 60° (pseudo-hexagonal)', () => {
    expect(between('halite', [1, 0, 0], [0, 1, 0])).toBeCloseTo(90, 9);
    expect(between('muscovite', [1, 1, 0], [0, 1, 0])).toBeCloseTo(60.24, 1);
  });
  it('Miller–Bravais i must equal -(h+k)', () => {
    expect(() => planeNormal(MINERALS.quartz.cell, [1, 0, 0, 1])).toThrow(/i must equal/);
  });
});

describe('symmetry', () => {
  it('point groups close to their orders', () => {
    expect(Object.fromEntries(['m-3m', '32', '-3m', 'mmm', '2/m', '-1'].map((g) => [g, pointGroup(g).length]))).toEqual({ 'm-3m': 48, '32': 6, '-3m': 12, mmm: 8, '2/m': 4, '-1': 2 });
  });
  it('a form is invariant under its group', () => {
    const set = formNormals('calcite', [1, 0, -1, 4]);
    expect(set.length).toBe(6);
    for (const M of pointGroup('-3m')) for (const v of set) {
      const w = [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
      expect(set.some((s) => s[0] * w[0] + s[1] * w[1] + s[2] * w[2] > 1 - 1e-6)).toBe(true);
    }
  });
  it('cleavage planes per mineral (± is one plane)', () => {
    expect(Object.fromEntries(Object.keys(MINERALS).map((m) => [m, cleavageNormals(m).length]))).toEqual({
      quartz: 0, orthoclase: 2, albite: 2, muscovite: 1, biotite: 1, augite: 2, hornblende: 2, olivine: 1, calcite: 3, halite: 3,
    });
  });
});

describe('rocks', () => {
  it('every preset resolves and every mode is a known mineral', () => {
    for (const id of ROCK_PRESET_IDS) {
      expect(validateRockMix(id)).toEqual([]);
      for (const [m, f] of resolveRock(id).modes) { expect(MINERALS[m]).toBeTruthy(); expect(f).toBeGreaterThan(0); }
    }
    expect(Object.keys(ROCK_PRESETS)).toEqual(['granite', 'slate', 'marble', 'quartzite', 'basalt']);
  });
  it('a custom mix validates; mistakes teach', () => {
    expect(validateRockMix({ modes: [['quartz', 0.6], ['calcite', 0.4]], grain: 0.002 })).toEqual([]);
    expect(validateRockMix('granit')[0]).toMatch(/unknown preset 'granit'.*granite/);
    expect(validateRockMix({ modes: [['unobtainium', 1]], grain: 0.01 })[0]).toMatch(/mineral one of quartz/);
    expect(validateRockMix({ modes: [['quartz', 1]] })[0]).toMatch(/grain size in metres/);
    expect(() => resolveRock('nope')).toThrow(/unknown preset/);
  });
});
