// A gameworld's `keying`: its bodies drawn on twos or threes in play (worlds/controllable/keying.js), laid on every level
// as `keying`; 'auto' takes the juice's look; a world that writes none is the world it was.

import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { keyingOfGame, keyingSuggestion, KEYING_OF_LOOK } from './keying.js';
import { JUICE_LOOKS } from '../scene/juice-style.js';

const order = (W) => { const G = readGameworld(W), st = gameStages(W)[0]; return stageLevelOrder(G, st, { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest; };
const keyedLook = Object.keys(KEYING_OF_LOOK).find((l) => KEYING_OF_LOOK[l]), smoothLook = Object.keys(KEYING_OF_LOOK).find((l) => !KEYING_OF_LOOK[l]);

describe('a gameworld\'s keying', () => {
  it('reads with the world, and teaches on a grain it does not know', () => {
    expect(readGameworld({ ...MEADOWMARK, keying: 'twos' }).keying).toBe('twos');
    expect(readGameworld(MEADOWMARK).keying).toBeUndefined();
    expect(() => readGameworld({ ...MEADOWMARK, keying: 'fours' })).toThrow(/ones, twos or threes.*'auto'/s);
  });

  it('lays nothing on a world that writes none, or false; the same level with its keying on one that does', () => {
    const plain = order(MEADOWMARK), off = order({ ...MEADOWMARK, keying: false }), on = order({ ...MEADOWMARK, keying: { hero: 'ones', cast: 'twos' } });
    expect(plain.keying).toBeUndefined();
    expect(JSON.stringify(off)).toBe(JSON.stringify(plain));
    expect(on.keying).toEqual({ hero: 1, cast: 2, fps: 24 });
    const { keying: _k, ...rest } = on;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(plain));
  });

  it('\'auto\' takes the juice\'s look: one drawn on twos keys its bodies on twos, one drawn every frame does not', () => {
    expect(Object.keys(KEYING_OF_LOOK).sort()).toEqual(Object.keys(JUICE_LOOKS).sort());
    const keyed = readGameworld({ ...MEADOWMARK, juice: { look: keyedLook }, keying: 'auto' });
    expect(keyingOfGame(keyed)).toMatchObject({ keying: { hero: 2, cast: 2 }, from: 'look' });
    expect(keyingOfGame(readGameworld({ ...MEADOWMARK, juice: { look: smoothLook }, keying: 'auto' }))).toBeNull();
    expect(keyingSuggestion(readGameworld({ ...MEADOWMARK, juice: { look: keyedLook } }))).toMatchObject({ from: 'look' });
    expect(keyingSuggestion(keyed)).toBeNull();
  });
});
