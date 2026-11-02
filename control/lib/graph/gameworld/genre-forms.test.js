// The genre's form (genre-forms.js): what the sentence door lays for a genre it reads. One case per procedure: a form
// laid (the flight courses), a hand-off said and nothing laid, a refusal with what it waits on (the registry's, or the
// book's: a genre it cannot lay from a sentence yet), and a genre the book lays in its own walks laid as it was.
import { describe, expect, it } from 'vitest';

import { GENRE_FORMS, HAND_OFFS, PENDING, WAITS, pendingOf, refusalOf } from './genre-forms.js';
import { GENRES } from './intent.js';
import { composeGameworld } from './compose.js';
import { readGameworld } from './world.js';

describe('the genre\'s form', () => {
  it('names genres that exist, and each form\'s level is a level the book reads', () => {
    for (const id of [...Object.keys(GENRE_FORMS), ...Object.keys(HAND_OFFS)]) expect(GENRES[id], id).toBeTruthy();
    for (const [id, F] of Object.entries(GENRE_FORMS)) expect(() => readGameworld({ id: 'w', levels: { a: F.level(0, 1) } }), id).not.toThrow();
  });

  it('a genre with a form has every level laid in it: no walk, no town, the brief says so', () => {
    const W = composeGameworld({ prompt: 'a flight sim: take off and fly through the rings', seed: 1 });
    expect(W.intent).toEqual({ from: 'flight-sim' });
    expect(W.brief.levelForm).toEqual({ genre: 'flight-sim', form: 'airspace' });
    const levels = Object.values(W.levels);
    expect(levels.length).toBeGreaterThan(1);
    for (const L of levels) { expect(L.airspace).toBeTruthy(); expect(L.walk).toBeUndefined(); expect(L.places).toBeUndefined(); }
    expect(() => readGameworld(W)).not.toThrow();
    expect(composeGameworld({ prompt: 'a flight sim: take off and fly through the rings', seed: 1 })).toEqual(W);
  });

  it('a genre another door makes is said, naming the door, and nothing is laid', () => {
    expect(() => composeGameworld({ prompt: 'a match-3 puzzle saga', seed: 1 })).toThrow(/create_pixelizer_game\(\{ reducer: 'stone-saga' \}\)/);
  });

  it('a genre the registry cannot make yet is refused with what it waits on, nothing laid in its place', () => {
    const R = refusalOf('co-op-kitchen');
    expect(R.verdict).toBe('blocked');
    expect(R.waits.length).toBeGreaterThan(0);
    expect(refusalOf('flight-sim')).toBeNull();
    expect(() => composeGameworld({ prompt: 'a co-op kitchen game: four friends cook the orders together', seed: 1 })).toThrow(new RegExp(`waits on ${R.waits[0].replace(/[.=]/g, '\\$&')}`));
  });

  it('a genre the book lays in its own walks is laid as before: walks and buildings, its words\' goals', () => {
    const W = composeGameworld({ prompt: 'a dungeon crawler through crypt rooms full of loot', seed: 1 });
    expect(W.brief.levelForm).toBeUndefined();
    expect(Object.values(W.levels).every((L) => L.walk || L.building)).toBe(true);
  });
});

describe('a genre the book cannot lay from a sentence yet', () => {
  it('is refused with what it waits on and the one level it plays alone, nothing laid in its place', () => {
    for (const [id, why] of Object.entries(PENDING)) { expect(GENRES[id], id).toBeTruthy(); expect(WAITS[why], id).toBeTruthy(); expect(GENRE_FORMS[id], id).toBeUndefined(); }
    expect(pendingOf('kart-racer')).toEqual({ waits: WAITS.ride, one: 'race' });
    expect(() => composeGameworld({ prompt: 'a kart racer: three laps against rival drivers', seed: 1 })).toThrow(/waits on a ride the book drives[\s\S]*design_game\(\{ quick: \{ goal: 'race' \} \}\)/);
    // (one per kind of wait: a weapon, a form, the hero)
    expect(() => composeGameworld({ prompt: 'a first-person shooter: clear a warehouse of armed guards', seed: 1 })).toThrow(/waits on the hero's weapon/);
    expect(() => composeGameworld({ prompt: 'a tower defence game', seed: 1 })).toThrow(/waits on its kernel as a book level/);
    expect(() => composeGameworld({ prompt: 'an endless runner down three lanes', seed: 1 })).toThrow(/waits on a hero by default/);
  });

  it('the genres a hero completes are laid: stealth\'s guards, a co-op platformer\'s side camera, a party\'s world', () => {
    for (const id of ['stealth', 'co-op-platformer', 'jrpg', 'dungeon-crawler', 'collectathon', 'metroidvania']) expect(pendingOf(id), id).toBeNull();
    expect(composeGameworld({ prompt: 'a stealth game sneaking past guards in a castle', seed: 1 }).intent).toEqual({ from: 'stealth' });
  });
});
