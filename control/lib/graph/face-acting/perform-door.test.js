// The hero door's `perform`: a realistic hero's face performances, each a take checked as the performer checks it,
// refused by name on another head, kept on the record.
import { describe, expect, it } from 'vitest';
import { validateHeroSpec, heroRecord } from '../../mcp/tools/layered.js';

const TAKE = { seconds: 3, beats: [{ at: 0, face: 'neutral' }, { at: 1, face: 'amused', flash: true }] };

describe('the door\'s performances', () => {
  it('takes them on the realistic hero and keeps them on its record', () => {
    expect(validateHeroSpec({ cast: 'female', form: 'realistic', perform: { hello: TAKE } })).toEqual([]);
    expect(heroRecord({ cast: 'female', form: 'realistic', perform: { hello: TAKE } }).perform).toEqual({ hello: TAKE });
    expect(heroRecord({ cast: 'female', form: 'realistic' }).perform).toBeUndefined();
  });
  it('refuses them by name on another head, a take by its own errors, and a name that is no word', () => {
    expect(validateHeroSpec({ cast: 'female', perform: { hello: TAKE } })[0]).toMatch(/^perform: a face's performance is the realistic hero's/);
    expect(validateHeroSpec({ cast: 'female', form: 'realistic', perform: { hello: { beats: [{ at: 0, face: 'joy' }] } } })[0]).toMatch(/^perform\.hello\.beats\[0\]\.face/);
    expect(validateHeroSpec({ cast: 'female', form: 'realistic', perform: { 'two words': TAKE } })[0]).toMatch(/a take's name is a word/);
    expect(validateHeroSpec({ cast: 'female', form: 'realistic', perform: {} })[0]).toMatch(/^perform: \{ <take>/);
  });
});
