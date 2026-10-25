// Leaf chips (leaf-chips.js): a crown's masses a dark core with chips over them, each chip low, mid or high in the
// foliage ramp by where it sits in the crown's light.
import { describe, expect, it } from 'vitest';
import { leafChips, chipCore, CHIP_DEFAULTS } from './leaf-chips.js';

const ramp = [[30, 78, 82], [52, 118, 66], [96, 164, 58], [156, 204, 78], [206, 232, 132]];
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const masses = [{ at: [0, 0, 5], r: 1.8 }, { at: [1.6, 0.3, 4.6], r: 1.3 }], crown = { c: [0.5, 0, 5], Rc: 3, squash: 0.82 };

describe('leaf chips', () => {
  it('chips a crown in the ramp\'s own stops, the same chips for the same dice, each one face of its corners', () => {
    const A = leafChips(masses, { crown, toSun: [0, 0, 1], ramp, seed: 3 });
    expect(A.length).toBeGreaterThan(100);
    expect(leafChips(masses, { crown, toSun: [0, 0, 1], ramp, seed: 3 })).toEqual(A);
    expect(A.every((f) => f.corners.length === CHIP_DEFAULTS.corners && f.doubleSided)).toBe(true);
    expect(new Set(A.map((f) => f.fill)).size).toBeGreaterThan(2);
    expect(A.every((f) => ramp.slice(1).map(hex).includes(f.fill))).toBe(true);
  });

  it('lights the side toward the sun: more high chips there than on the far side', () => {
    const A = leafChips(masses, { crown, toSun: [1, 0, 0], ramp, seed: 3 }), high = new Set([hex(ramp[3]), hex(ramp[4])]);
    const side = (f) => f.corners.reduce((a, c) => a + c[0], 0) / f.corners.length > 0.5;
    const share = (fs) => fs.filter((f) => high.has(f.fill)).length / Math.max(1, fs.length);
    expect(share(A.filter(side))).toBeGreaterThan(share(A.filter((f) => !side(f))) + 0.2);
  });

  it('draws the core in the darkest stop, the next where the sun reaches it', () => {
    const K = chipCore(masses, { crown, ramp, toSun: [0, 0, 1] }), fills = new Set(K.map((f) => f.fill));
    expect(fills).toEqual(new Set([hex(ramp[0]), hex(ramp[1])]));
    expect(K.filter((f) => f.fill === hex(ramp[1])).every((f) => f.normal[2] > 0.15)).toBe(true);
  });
});
