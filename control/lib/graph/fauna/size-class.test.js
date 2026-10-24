// Size classes (size-class.js): measured off the rosters, never tagged.
import { describe, expect, it } from 'vitest';
import { SIZE_CLASSES, SIZE_CLASS_IDS, classOfExtent, extentOf, sizeClassOf } from './size-class.js';
import { BUG_SPECIES } from '../bugs/species.js';

describe('size classes', () => {
  it('are ordered smallest first, each bound past the one before', () => {
    const bounds = SIZE_CLASS_IDS.map((k) => SIZE_CLASSES[k].under);
    expect(bounds).toEqual([...bounds].sort((a, b) => a - b));
    expect(bounds.at(-1)).toBe(Infinity);
    for (const [i, k] of SIZE_CLASS_IDS.entries()) {
      expect(classOfExtent(i ? SIZE_CLASSES[SIZE_CLASS_IDS[i - 1]].under : 0)).toBe(k);
      if (Number.isFinite(SIZE_CLASSES[k].under)) expect(classOfExtent(SIZE_CLASSES[k].under - 1e-6)).toBe(k);
    }
    expect(() => classOfExtent(-1)).toThrow(/metres/);
  });

  it('measures a bug by its bauplan\'s length', () => {
    const id = Object.keys(BUG_SPECIES)[0];
    expect(sizeClassOf(id)).toMatchObject({ roster: 'bugs', extent: BUG_SPECIES[id].length, class: classOfExtent(BUG_SPECIES[id].length) });
  });

  it('measures an animal off its skeleton, in the words the classes are defined by', () => {
    // (each class's own example: a cat is a pet, a sheep past it, a hippo a behemoth, an elephant terrain)
    expect(sizeClassOf('monarch').class).toBe('mini');
    expect(sizeClassOf('houseCat')).toMatchObject({ roster: 'fauna', class: 'smol' });
    expect(sizeClassOf('sheep').class).toBe('chonky');
    expect(sizeClassOf('hippo').class).toBe('behemoth');
    expect(sizeClassOf('elephant').class).toBe('gargantuan');
    expect(extentOf('sheep')).toBe(extentOf('sheep'));
    expect(sizeClassOf('unicorn')).toBeNull();
  });
});
