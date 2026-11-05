// The character read's lowering and its refining plan (character-lower.js), with no store and no mint: a look's words
// over the read's but for its choices, a build-only cast keeping the picture's pole, the likeness verdict recorded as
// given, and a refining read that never moves a word the person changed.
import { describe, expect, it } from 'vitest';

import { lowerCharacterRead, refineCharacterWords } from './character-lower.js';

const read = (over = {}) => ({ look: 'toon', likeness: { verdict: 'original' }, words: {}, ...over });

describe('lowering a character read', () => {
  it("lays the look's words over the read's, but for a word the look lets you choose, and says what it overrode", () => {
    const A = lowerCharacterRead(read({ look: 'anime', words: { head: 'landmark', hair: 'bob' } }));
    expect(A.spec.head).toBe('anime');
    expect(A.spec.hair).toBe('bob');
    expect(A.overridden).toEqual([{ word: 'head', read: 'landmark', look: 'anime' }]);
    const S = lowerCharacterRead(read({ look: 'statue', words: { statue: 'roman' } }));
    expect(S.spec.statue).toBe('roman');
    expect(S.overridden).toEqual([]);
  });

  it("keeps the picture's pole under a build-only look, and says when the read's build gave way", () => {
    expect(lowerCharacterRead(read({ look: 'chibi', words: { cast: 'female' } })).spec.cast).toEqual({ pole: 'female', build: 'chibi' });
    const L = lowerCharacterRead(read({ look: 'chibi', words: { cast: { pole: 'male', build: 'heroic' } } }));
    expect(L.spec.cast).toEqual({ pole: 'male', build: 'chibi' });
    expect(L.overridden).toEqual([{ word: 'cast.build', read: 'heroic', look: 'chibi' }]);
  });

  it('takes the register beside the words, the look\'s by default, and stamps the verdict as given', () => {
    const L = lowerCharacterRead(read({ look: 'toon', register: 'lowpoly', likeness: { verdict: 'x-like', like: 'a caped space ranger', changed: ['the name', 'the chest emblem'] } }), { stash: 'st_x' });
    expect(L.spec.register).toBe('lowpoly');
    expect(L.spec.reference).toEqual({ likeness: 'x-like', like: 'a caped space ranger', changed: ['the name', 'the chest emblem'], stash: 'st_x' });
    expect(lowerCharacterRead(read({ look: 'anime' })).spec.register).toBe('round');
  });

  it('refuses a read whose form is wrong, never one for what it depicts', () => {
    expect(() => lowerCharacterRead(read({ likeness: undefined }))).toThrow(/likeness.*required/);
    expect(() => lowerCharacterRead(read({ words: { reference: { likeness: 'original' } } }))).toThrow(/stamp/);
    expect(() => lowerCharacterRead(read({ look: 'noir' }))).toThrow(/not a look/);
    expect(() => lowerCharacterRead(read({ register: 'smooth' }))).toThrow(/not a register/);
  });
});

describe('refining a character by a second read', () => {
  const minted = { hair: { style: 'bob', length: 1 }, palette: { Top: '#aa3344', Hair: '#222222' }, cast: 'female' };

  it('moves what the person left alone and keeps what they changed, word by word inside an object', () => {
    const current = { ...minted, hair: 'ponytail' };
    const prior = { hair: 'bob', palette: { Top: '#aa3344', Hair: '#222222' }, cast: 'female' };
    const next = { hair: 'pixie', palette: { Top: '#3344aa', Hair: '#222222' }, cast: 'female' };
    const R = refineCharacterWords({ next, prior, current, minted });
    expect(R.kept).toEqual(['hair']);
    expect(R.moved).toEqual(['palette.Top']);
    expect(R.spec).toEqual({ palette: { Top: '#3344aa' } });
  });

  it('keeps a word the person took off, and moves nothing when the reads agree', () => {
    const current = { ...minted }; delete current.palette;
    const R = refineCharacterWords({ next: { palette: { Top: '#000000' } }, prior: { palette: { Top: '#aa3344' } }, current, minted });
    expect(R.kept).toEqual(['palette']);
    expect(refineCharacterWords({ next: { cast: 'female' }, prior: { cast: 'female' }, current: minted, minted }).spec).toEqual({});
  });

  it('takes the new read whole on replace, and takes off what only the last read set', () => {
    const R = refineCharacterWords({ next: { hair: 'pixie' }, prior: { hair: 'bob', gesture: 'proud' }, current: { ...minted, hair: 'ponytail' }, minted, replace: true });
    expect(R.spec).toEqual({ hair: 'pixie', gesture: null });
    expect(R.kept).toEqual([]);
  });
});
