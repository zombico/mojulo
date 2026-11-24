// Hijack City (hijack-city.js): the open city's crime game as a rail and its starter. One case per concept: the starter
// is a world the book reads, a locked pitch lays it and the creator's words win, a brief's words find it.
import { describe, it, expect } from 'vitest';
import { hijackCityWorld, hijackCityStart, HIJACK_CITY, HIJACK_GROWS } from './hijack-city.js';
import { pitchStart } from './pitch-start.js';
import { readGameworld } from './world.js';
import { nearestRails, railOf, railSheet, laidGenre } from './rails.js';
import { suggestGenres } from './intent.js';
import { gameStages } from './levels.js';

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

  it('asks its district for its sky, its air, its finish and its view cone, carried as its hour is; a style that names none adds nothing', () => {
    const W = hijackCityWorld(), m = gameStages(readGameworld(W))[0].manifest;
    expect(m).toMatchObject({ kind: 'geocube', show: 'geocity', clouds: W.style.clouds, air: W.style.air, cone: W.style.cone, light: { finish: W.style.finish } });
    const { clouds: _c, air: _a, finish: _f, cone: _k, ...bare } = W.style;
    const m0 = gameStages(readGameworld({ ...W, style: { ...bare, hour: 'dusk' } }))[0].manifest;
    for (const k of ['clouds', 'air', 'cone', 'light']) expect(m0[k], k).toBeUndefined();
    expect(Object.keys(m0).slice(-1)).toEqual(['hour']);
    // (each word read by its own reader: a bad one refused, named)
    expect(() => readGameworld({ ...W, style: { ...W.style, clouds: 'drizzly' } })).toThrow(/style\.clouds/);
    expect(() => readGameworld({ ...W, style: { ...W.style, air: 'smog' } })).toThrow(/style\.air/);
    expect(() => readGameworld({ ...W, style: { ...W.style, finish: { glow: 1 } } })).toThrow(/style\.finish/);
  });

  it('its district\'s outskirts read in a register a person names: the West Coast\'s unless named, a tropical coast\'s by one word', () => {
    expect(Object.values(hijackCityWorld().levels)[0].geocity.outskirts).toBe('west-coast');
    const W = hijackCityWorld({ register: 'tropical' });
    expect(Object.values(W.levels)[0].geocity.outskirts).toBe('tropical');
    expect(() => readGameworld(W)).not.toThrow();
    expect(() => readGameworld(hijackCityWorld({ register: 'prairie' }))).toThrow(/outskirts/);
  });
});
