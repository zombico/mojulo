// A PLAYED CITY'S SCORE (cue-sheet.js cityScore): ambient beats under its streets on the game's identity; where its law
// or its factions can come for the player, a chase the level changes to as the tension rises, held while any star is on.
import { describe, it, expect } from 'vitest';
import { cityScore, CITY_SCORE } from './cue-sheet.js';
import { resolveTension } from '../beats/adaptive-music.js';

describe('a played city\'s score', () => {
  it('ambient beats under its streets, on the game\'s identity; no chase where nothing comes for the player', () => {
    expect(cityScore({}, { identity: 7 })).toEqual({ soundtrack: { score: { mood: CITY_SCORE.walk, style: 'club', game: 7 } } });
  });
  it('a chase where the law or a fight can come: its meter raised by a star and held by the wanted level\'s calm', () => {
    const S = cityScore({ law: { stars: 5 } }, { identity: 7 });
    expect(S.combat).toEqual({ score: { mood: CITY_SCORE.chase, style: 'club', game: 7 } });
    const T = resolveTension(S.tension);
    expect(T.on['wanted:*']).toBe(1); expect(T.on['calming:wanted']).toBeGreaterThan(0);
    // (held: a second's calm while wanted raises the meter more than a second's leak takes)
    expect(T.on['calming:wanted']).toBeGreaterThan(1 - Math.exp(-1 / T.decay));
    expect(cityScore({ factions: [{ id: 'reds' }] }).combat).toBeTruthy();
  });
});
