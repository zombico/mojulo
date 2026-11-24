// THE OUTSKIRTS' REGISTER (register.js): how a metro's outskirts read as massing, its outskirts pattern's `metro` block
// over the streetcar suburb's. One case per concept: a card that says none reads as before; a card's block is read over
// it; a bad word is refused, named.
import { describe, it, expect } from 'vitest';
import { outskirtsLook, OUTSKIRTS_LOOK } from './register.js';
import { PATTERNS } from '../geotown/pattern.js';

describe('the outskirts\' register', () => {
  it('a card with no metro block reads as the streetcar suburb always has', () => {
    expect(outskirtsLook(null)).toBe(OUTSKIRTS_LOOK);
    expect(outskirtsLook(PATTERNS['bay-and-gable'])).toBe(OUTSKIRTS_LOOK);
    expect(OUTSKIRTS_LOOK.house).toMatchObject({ form: 'gable', most: 3 });
  });

  it('reads a card\'s metro block over it: what it says wins, what it leaves out is the suburb\'s', () => {
    const L = outskirtsLook({ metro: { house: { form: 'hip', pitch: 0.12, most: 1 }, walls: ['#eeeeee'], trees: { low: ['washingtonia'] }, finishes: { 'geocity:house': 'stucco' } } });
    expect(L.house).toEqual({ ...OUTSKIRTS_LOOK.house, form: 'hip', pitch: 0.12, most: 1 });
    expect(L.walls).toEqual(['#eeeeee']);
    expect(L.roofs).toBe(OUTSKIRTS_LOOK.roofs);
    expect(L.trees).toEqual({ dense: OUTSKIRTS_LOOK.trees.dense, low: ['washingtonia'], sidewalk: OUTSKIRTS_LOOK.trees.sidewalk });
    expect(L.finishes).toEqual({ 'geocity:house': 'stucco' });
  });

  it('refuses a bad word, naming it', () => {
    expect(() => outskirtsLook({ metro: { house: { form: 'dome' } } })).toThrow(/house\.form/);
    expect(() => outskirtsLook({ metro: { house: { most: 5 } } })).toThrow(/most/);
    expect(() => outskirtsLook({ metro: { trees: { dense: ['baobab'] } } })).toThrow(/trees\.dense/);
    expect(() => outskirtsLook({ metro: { finishes: { 'geocity:tower': 'stucco' } } })).toThrow(/finishes/);
    expect(() => outskirtsLook({ metro: { roofs: ['#111111'] } })).toThrow(/roofs/);
  });
});
