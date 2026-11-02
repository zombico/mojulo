// the door's held-thing words are the solvers' own tables, word for word
import { describe, it, expect } from 'vitest';
import { HOLD_WORDS, GUARD_WORDS, BOW_WORDS } from './hero-held-words.js';
import { BOW_SHOT_NAMES } from './hero-bow.js';
import { HOLDS } from './hero-carry.js';
import { GUARD_NAMES } from './hero-grip.js';

describe('the held-thing words', () => {
  it('the holds are hero-carry\'s HOLDS and the guards hero-grip\'s GUARD_NAMES, in their order', () => {
    expect([...HOLD_WORDS]).toEqual(Object.keys(HOLDS));
    expect([...GUARD_WORDS]).toEqual([...GUARD_NAMES]);
    expect([...BOW_WORDS]).toEqual([...BOW_SHOT_NAMES]);
  });
});
