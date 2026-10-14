/**
 * THE UPDATE LAW's pin for the stylism tuner (index.js): `hero.stylism` holds words resolved on every read, so what a
 * version resolves them to is a compatibility promise over minted heroes. Per case, at STYLISM_LAWS_VERSION, the hash of
 * the outfit the words resolve to and of the notes beside it. One case per procedure: each genre lowers through its own
 * card, at an outline chosen in code from OUTLINES (never the whole catalog), and the register's two ends. A moved hash is
 * a change that says the resolution changes AND bumps STYLISM_LAWS_VERSION (the old version kept for heroes stamped with
 * it, its pins beside the new), or a change of the outfit grammar beneath it, re-pinned with that grammar's own pins.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { STYLISM_LAWS_VERSION, styledHero, stylismLedger } from './index.js';
import { GENRE_NAMES } from './genres.js';
import { OUTLINES } from './silhouette.js';
import { NAMED_SILHOUETTES } from './silhouettes.js';

const PINS = {
  1: {
    'fantasy grounded': '1d4ef5532c867045', 'fantasy mythic': 'e1a9c4ffd5bed062',
    'modern grounded': 'ada3046c55d7847c', 'modern mythic': '5392b21db6eaaf16',
    'scifi grounded': '9bd2a486c215012f', 'scifi mythic': 'e562ba903f33fa7b',
    'named': 'a0c65f4429f21dfd',
  },
};
const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);

describe('stylism laws: the update law pin', () => {
  // a named silhouette lowers through its own card (silhouettes.js), not the genre's: one, chosen in code
  it('named: the outfit and the notes are as pinned', () => {
    const h = { cast: 'female', head: 'anime', stylism: { silhouette: NAMED_SILHOUETTES[0], register: 'heroic', detail: 'rich', laws: STYLISM_LAWS_VERSION } };
    const got = hash({ outfit: styledHero(h).outfit, notes: stylismLedger(h).notes });
    if (process.env.REPIN) console.log('PIN', 'named', got);
    expect(got).toBe(PINS[STYLISM_LAWS_VERSION].named);
  });
  GENRE_NAMES.forEach((genre, i) => {
    for (const register of ['grounded', 'mythic']) {
      const key = `${genre} ${register}`;
      it(`${key}: the outfit and the notes are as pinned`, () => {
        const h = { cast: 'female', head: 'anime', stylism: { genre, register, silhouette: OUTLINES[(2 * i + (register === 'mythic' ? 1 : 0)) % OUTLINES.length], laws: STYLISM_LAWS_VERSION } };
        const got = hash({ outfit: styledHero(h).outfit, notes: stylismLedger(h).notes });
        if (process.env.REPIN) console.log('PIN', key, got);
        expect(PINS[STYLISM_LAWS_VERSION]?.[key], `a pin for ${key}`).toBeDefined();
        expect(got, key).toBe(PINS[STYLISM_LAWS_VERSION][key]);
      });
    }
  });
});
