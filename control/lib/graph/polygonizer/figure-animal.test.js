import { describe, expect, it } from 'vitest';

import { quadrupedArmature, QUADRUPED_ARCHETYPE_NAMES } from './figure-animal.js';

describe('figure-animal archetype metadata', () => {
  it('carries a skin material tag on every archetype', () => {
    const tags = Object.fromEntries(QUADRUPED_ARCHETYPE_NAMES.map((name) => [name, quadrupedArmature(name).skin?.tag]));

    expect(tags).toEqual({
      rodent: 'fur',
      canine: 'fur',
      feline: 'fur',
      stumpy: 'hide',
      equine: 'hide',
      gazelle: 'hide',
      sauropod: 'scale',
      theropod: 'scale',
      raptor: 'feather',
      avian: 'feather',
      ursine: 'fur',
      raccoon: 'fur',
    });
  });
});
