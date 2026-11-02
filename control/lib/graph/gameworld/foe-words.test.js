import { describe, it, expect } from 'vitest';
import { readFoeWords, foePacks } from './foe-words.js';
import { composeGameworld } from './compose.js';
import { readGameworld } from './world.js';

describe('the foes a sentence names', () => {
  it('read in the sentence\'s order, a pair said as one, the first look a kind is asked for its own; none, nothing', () => {
    const R = readFoeWords('skeletons and beast folk, then werewolves');
    expect(R.kinds).toEqual(['skeleton', 'wolf', 'bandit']);
    expect(R.looks).toEqual({ wolf: { people: 'lupine' }, bandit: { people: 'feline' } });
    expect(R.read.map((r) => r.word)).toEqual(['skeletons', 'beast folk', 'werewolves']);
    expect(readFoeWords('a quiet meadow')).toBeNull();
  });

  it('the packs grow one, two, three, walked round the kinds', () => {
    expect(foePacks(['zombie'])).toEqual([['zombie'], ['zombie', 'zombie'], ['zombie', 'zombie', 'zombie'], ['zombie', 'zombie', 'zombie']]);
    expect(foePacks(['skeleton', 'zombie'])[2]).toEqual(['skeleton', 'zombie', 'skeleton']);
  });

  it('a world that fights turn by turn fights what its sentence names; one that does not is as before', () => {
    const w = composeGameworld({ prompt: 'a jrpg where a party battles skeletons, zombies and beast folk', seed: 3 });
    expect(w.battles.packs.flat()).toEqual(expect.arrayContaining(['skeleton', 'zombie', 'wolf', 'bandit']));
    expect(w.battles.looks).toEqual({ wolf: { people: 'lupine' }, bandit: { people: 'feline' } });
    expect(w.brief.unread).not.toContain('skeletons');
    expect(w.brief.read.find((r) => r.word === 'zombies').decides).toEqual(['battles.foe=zombie']);
    expect(() => readGameworld(w)).not.toThrow();
    expect(composeGameworld({ prompt: 'a jrpg where a party battles monsters', seed: 3 }).battles).toBeUndefined();
  });
});
