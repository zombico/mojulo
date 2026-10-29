// The hero door's `emote`: a realistic hero's held states, each a loop checked as the registry checks it, refused by
// name on another head, kept on the record as given; resolved into clips by name, list or map.
import { describe, expect, it } from 'vitest';
import { validateHeroSpec, heroRecord } from '../../mcp/tools/layered.js';
import { emoteClips, FACE_EMOTE_NAMES } from './emotes.js';

const [A, B] = FACE_EMOTE_NAMES;

describe('the door\'s emotes', () => {
  it('takes a name, a list or a map on the realistic hero and keeps it on its record', () => {
    for (const emote of [A, [A, B], { idle: A, idleMirrored: { emote: A, mirror: true, intensity: 0.8 } }]) {
      expect(validateHeroSpec({ cast: 'male', form: 'realistic', emote })).toEqual([]);
      expect(heroRecord({ cast: 'male', form: 'realistic', emote }).emote).toEqual(emote);
    }
    expect(heroRecord({ cast: 'male', form: 'realistic' }).emote).toBeUndefined();
    expect(emoteClips([A, B])).toEqual({ [A]: A, [B]: B });
    expect(emoteClips(A)).toEqual({ [A]: A });
  });
  it('refuses them by name on another head, an unknown emote, a bad dial, and a clip name that is no word', () => {
    expect(validateHeroSpec({ cast: 'male', emote: A })[0]).toMatch(/^emote: a face's emote is the realistic hero's/);
    expect(validateHeroSpec({ cast: 'male', form: 'realistic', emote: 'sulking' })[0]).toMatch(/^emote: 'sulking' is not an emote/);
    expect(validateHeroSpec({ cast: 'male', form: 'realistic', emote: [A, 'sulking'] })[0]).toMatch(/^emote\[1\]\.emote: 'sulking'/);
    expect(validateHeroSpec({ cast: 'male', form: 'realistic', emote: { idle: { emote: A, mirror: 1 } } })[0]).toMatch(/^emote\.idle\.mirror/);
    expect(validateHeroSpec({ cast: 'male', form: 'realistic', emote: { 'two words': A } })[0]).toMatch(/a clip's name is a word/);
    expect(validateHeroSpec({ cast: 'male', form: 'realistic', emote: {} })[0]).toMatch(/^emote: a name/);
  });
});
