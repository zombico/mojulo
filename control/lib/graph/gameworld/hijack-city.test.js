// Hijack City (hijack-city.js): the open city's crime game as a rail and its starter. One case per concept: the starter
// is a world the book reads, a locked pitch lays it and the creator's words win, a brief's words find it.
import { describe, it, expect } from 'vitest';
import { hijackCityWorld, hijackCityStart, HIJACK_CITY, HIJACK_GROWS, HIJACK_DISTRICTS, HIJACK_DISTRICT } from './hijack-city.js';
import { designGeocity } from '../geocity/design.js';
import { pitchStart } from './pitch-start.js';
import { readGameworld } from './world.js';
import { nearestRails, railOf, railSheet, laidGenre } from './rails.js';
import { suggestGenres } from './intent.js';

describe('Hijack City', () => {
  it('its starter is a gameworld the book reads: a district, a contact\'s missions, the law and the shops', () => {
    const W = hijackCityWorld();
    expect(W.name).toBe(HIJACK_CITY);
    expect(() => readGameworld(W)).not.toThrow();
    expect(Object.values(W.levels)[0].geocity).toBeTruthy();
    expect(W.errands.filter((e) => e.mission).map((e) => !!e.mission.final)).toContain(true);
    expect(W.law).toBe(true); expect(W.shops).toEqual({ respray: true, guns: true });
    // (each word a person grows it by is a key of the world)
    for (const k of Object.keys(HIJACK_GROWS)) expect(k in W, k).toBe(true);
    // a plain value: the same words, the same world
    expect(JSON.stringify(hijackCityWorld())).toBe(JSON.stringify(W));
  });

  it('a locked pitch on its rail lays the starter, the game\'s own name and keys winning', () => {
    const P = pitchStart({ id: 'my-city', name: 'Neon Docks', rail: { from: 'hijack-city', locked: true }, law: { stars: 3 } });
    expect(P.laid.by).toBe('hijack-city'); expect(P.laid.says).toMatch(/starter/);
    expect(P.world).toMatchObject({ id: 'my-city', name: 'Neon Docks', law: { stars: 3 }, intent: { from: 'open-city-crime' } });
    expect(() => readGameworld(P.world)).not.toThrow();
    expect(hijackCityStart({ levels: {} })).toBeNull();
  });

  it('is found by the words a brief uses for it, and its genre is one the book lays', () => {
    expect(nearestRails('a gta-like game: steal cars, a wanted level, police chases')[0].id).toBe('hijack-city');
    expect(suggestGenres('a crime sandbox like grand theft auto')[0].id).toBe('open-city-crime');
    expect(railOf('hijack-city').name).toBe(HIJACK_CITY);
    expect(laidGenre('open-city-crime')).toBe(true);
    expect(railSheet('hijack-city').starts).toBe('open-city-crime');
  });

  it('stands in a district by its word: downtown as it was, the inner city\'s low-rise or the suburbs, each its ring\'s', () => {
    expect(hijackCityWorld({ district: 'downtown' })).toEqual(hijackCityWorld());
    expect(hijackCityWorld().levels.district.geocity).toEqual(JSON.parse(JSON.stringify(HIJACK_DISTRICT)));
    expect(() => hijackCityWorld({ district: 'uptown' })).toThrow(/district is/);
    // (each district's neighbourhood its ring's, and lived in: the inner city's walk-ups and low-rises among its
    // midrises, the suburbs' houses and garden apartments)
    const want = { 'inner-city': ['frame', ['lowrise', 'apartments', 'main-street']], suburbs: ['outskirts', ['houses', 'garden', 'apartments', 'lowrise']] };
    for (const [word, [ring, homes]] of Object.entries(want)) {
      const W = hijackCityWorld({ district: word });
      expect(() => readGameworld(W)).not.toThrow();
      const d = designGeocity(W.levels.district.geocity, { seed: W.seed }), r = d.regions.find((x) => x.id === d.evoked.at);
      expect(r.builds ?? r.ring, word).toBe(ring);
      expect(r.blocks.some((b) => homes.includes(b.kind)), word).toBe(true);
      expect(d.laws.filter((l) => !l.ok).map((l) => l.law), word).toEqual([]);
    }
    expect(Object.keys(HIJACK_DISTRICTS)).toEqual(['downtown', 'inner-city', 'suburbs']);
  });
});

