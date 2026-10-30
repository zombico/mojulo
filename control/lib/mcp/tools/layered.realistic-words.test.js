// The door's landmark words on the realistic face. A cast member or a crew (egocube/plan.js, comic-hero grunts.js) writes
// `hair` in the landmark library and `expression` in the western channels; on the realistic body the record dropped both
// without a word, so every realistic crew wore its rolled ancestry's cut and a neutral face. The record now carries the
// hair as the face's `scalp` (scalpOfHair) and the expression as the face rig's rest. Records only: no figure is built.

import { describe, expect, it } from 'vitest';

import { heroRecord, scalpOfHair, withRolledFace } from './layered.js';
import { HAIR_STYLE_NAMES } from '@/lib/graph/polygonizer/humanoid-hair';
import { readScalp } from '@/lib/graph/epidermis/dermal-hair';

describe('scalpOfHair', () => {
  it('reads every landmark style as a cut the scalp knows', () => {
    for (const s of HAIR_STYLE_NAMES) {
      const cut = scalpOfHair(s);
      if (cut !== 'none') expect(() => readScalp(cut), s).not.toThrow();
    }
    expect(scalpOfHair('none')).toBe('none');
  });

  it('a wave is the scalp\'s curl, and the wavy fall waves (the pack-v2 fix)', () => {
    expect(scalpOfHair({ style: 'wavy', wave: 1.2 })).toEqual({ style: 'long', type: 'wavy' });
    expect(scalpOfHair({ style: 'wavy', wave: 1.5 })).toEqual({ style: 'long', type: 'curly' });
    expect(scalpOfHair('long')).toBe('long');
  });
});

describe('the realistic record keeps the door\'s hair and expression', () => {
  it('the default relational head, as a crew mints it', () => {
    const r = heroRecord(withRolledFace({ form: 'realistic', cast: 'female', hair: { style: 'wavy', wave: 1.2 }, expression: { browRaise: 0.01 } }));
    expect(r.head).toBe('relational');
    expect(r.face.scalp).toEqual({ style: 'long', type: 'wavy' });
    expect(r.expression).toEqual({ browRaise: 0.01 });
  });

  it('an explicit relational head takes them too, and the face\'s own scalp wins', () => {
    const r = heroRecord({ form: 'realistic', head: 'relational', cast: 'male', face: { seed: 3, scalp: 'buzz' }, hair: 'quiff', expression: 'smile' });
    expect(r.face.scalp).toBe('buzz');
    expect(r.expression).toBe('smile');
  });

  it('absent, they add nothing', () => {
    const r = heroRecord({ form: 'realistic', cast: 'male', face: { seed: 3 } });
    expect(r.face).toEqual({ seed: 3 });
    expect('expression' in r).toBe(false);
  });
});
