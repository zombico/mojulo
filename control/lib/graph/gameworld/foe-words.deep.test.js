import { describe, it, expect } from 'vitest';
import { FOE_WORDS } from './foe-words.js';
import { FOE_PRESETS } from '../playscape/rpg/presets.js';
import { readPeopleSkin } from '../foes/people.js';

// the sweep over the word table: each word names foes the presets fight, each look a people the character doors make
describe('the foe words, every one', () => {
  it('each kind a preset, each look a people', () => {
    for (const [w, list] of Object.entries(FOE_WORDS)) for (const { kind, look } of list) {
      expect(FOE_PRESETS[kind], `${w}: ${kind}`).toBeTruthy();
      if (look) expect(() => readPeopleSkin(look, w)).not.toThrow();
    }
  });
});
