// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { heroWordsChecked } from './design-game.js';
import { quickWorld } from '@/lib/graph/gameworld/quick.js';

// A HEROES BRAWL's heroes given the hero door's own words (create_character's spec) are read by the door when the game
// is designed, each as its mint will have it, so a refused word is said before anything is made
const brawl = (heroes) => [quickWorld({ id: 'w', name: 'Heroes', quick: { goal: 'brawl', heroes } }), heroes];
describe('a heroes brawl\'s own words read by the hero door at design', () => {
  it('words the door takes pass; one it refuses is said with the hero it belongs to', () => {
    expect(() => heroWordsChecked(...brawl({ team: [{ name: 'Tempest', brief: 'a weather witch', pole: 'female', spec: { hair: ['braid', { length: 1.4 }], palette: { Hair: '#eeeeee' } } }] }))).not.toThrow();
    expect(() => heroWordsChecked(...brawl({ team: [{ name: 'Tempest', brief: 'a weather witch', pole: 'female', spec: { wings: true } }] }))).toThrow(/hero door refuses.*Tempest.*wings/);
    expect(() => heroWordsChecked(...brawl({ villain: { member: 'mastermind', spec: { wings: true } } }))).toThrow(/hero door refuses/);
  });
  it('a brawl whose heroes say no words of their own is not read twice', () => {
    expect(() => heroWordsChecked(null, { team: ['beam'] })).not.toThrow();
  });
});
