/**
 * THE UPDATE LAW's pin for the stylism tuner (index.js): `hero.stylism` holds words resolved on every read, so what a
 * version resolves them to is a compatibility promise over minted heroes. Per case, at STYLISM_LAWS_VERSION, the hash of
 * the outfit the words resolve to and of the notes beside it. One case per procedure: the detail budget at its two ends;
 * each genre lowers through its own
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

// re-pinned in place (version 1 is unreleased): the value stage's stand-in palette joined the outfit (intent.palette),
// the plates wear the `metal` role, the detail solver spends the budget (detail list, ornament, fittings, trims), and the
// silhouette keeps its baseline sizes while the register warps after the design
const PINS = {
  1: {
    'fantasy grounded': '397286cafd43634f', 'fantasy mythic': '4960927bbe955a57',
    'modern grounded': '6b24f1e0d29fab8f', 'modern mythic': '65f89331d3493ff0',
    'scifi grounded': 'ce455086956aa34c', 'scifi mythic': '28f9a73a329db060',
    'alien grounded': 'd9b8043826c57c3a', 'alien mythic': '7b7e277af9dd4059',
    'named': '31c0745d0b293675',
    'detail plain': '93dab3d7bf4395df', 'detail ornate': '78e748dc859ae514',
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
  // the detail budget's two ends, on one genre's outline chosen in code: the solver's spending is the procedure
  for (const detail of ['plain', 'ornate']) it(`detail ${detail}: the outfit and the notes are as pinned`, () => {
    const h = { cast: 'female', head: 'anime', stylism: { genre: GENRE_NAMES[0], silhouette: OUTLINES[0], register: 'heroic', detail, laws: STYLISM_LAWS_VERSION } };
    const got = hash({ outfit: styledHero(h).outfit, notes: stylismLedger(h).notes });
    if (process.env.REPIN) console.log('PIN', `detail ${detail}`, got);
    expect(got).toBe(PINS[STYLISM_LAWS_VERSION][`detail ${detail}`]);
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
