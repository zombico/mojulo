// Hijack City (hijack-city.js): the open city's crime game as a rail and its starter. One case per concept: the starter
// is a world the book reads, a locked pitch lays it and the creator's words win, a brief's words find it.
import { describe, it, expect } from 'vitest';
import { hijackCityWorld, hijackCityStart, HIJACK_CITY, HIJACK_GROWS, HIJACK_DISTRICTS, HIJACK_DISTRICT, HIJACK_NIGHT, HIJACK_MUSEUM, HIJACK_ENTER } from './hijack-city.js';
import { designGeocity } from '../geocity/design.js';
import { pitchStart } from './pitch-start.js';
import { readGameworld } from './world.js';
import { nearestRails, railOf, railSheet, laidGenre } from './rails.js';
import { suggestGenres } from './intent.js';
import { gameStages } from './levels.js';
import { LOCALES, LOCALE_IDS } from './locales.js';

describe('Hijack City', () => {
  it('its starter is a gameworld the book reads: a district, a contact\'s missions, the law and the shops', () => {
    const W = hijackCityWorld();
    expect(W.name).toBe(HIJACK_CITY);
    expect(() => readGameworld(W)).not.toThrow();
    expect(Object.values(W.levels)[0].geocity).toBeTruthy();
    expect(W.errands.filter((e) => e.mission).map((e) => !!e.mission.final)).toContain(true);
    expect(W.law).toBe(true); expect(W.shops).toEqual({ respray: true, guns: true, forger: true });
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

  it('a San Francisco register lays a hill city\'s district in its fog; the default is the West Coast\'s lakeshore district', () => {
    for (const register of ['san-francisco', 'sunset']) {
      const W = hijackCityWorld({ register }), g = Object.values(W.levels)[0].geocity;
      expect(g).toMatchObject({ outskirts: register, metro: { from: 'bayside' } });
      expect(W.style.air).toMatchObject({ kind: 'mist' });
      expect(() => readGameworld(W)).not.toThrow();
    }
    expect(Object.values(hijackCityWorld().levels)[0].geocity.metro.from).toBe('lakeshore');
    // (a San Francisco register on the inner city's or the suburbs' word: the hill city at that ring)
    expect(Object.values(hijackCityWorld({ district: 'suburbs', register: 'sunset' }).levels)[0].geocity).toMatchObject({ metro: { from: 'bayside' }, at: 'outskirts', outskirts: 'sunset' });
  });

  it('stands in a district by its word: downtown as it was, the inner city\'s low-rise or the suburbs, each its ring\'s', () => {
    expect(hijackCityWorld({ district: 'downtown' })).toEqual(hijackCityWorld());
    // (a car park of it built as the dump, where the bin round empties its truck: jobsified.js; a working dock; an office
    // tower walked into, a temp's desk: temp-agency.js; and its
    // museum across from the start, geocity/museum.js, none where it asks for none)
    expect(hijackCityWorld().levels.district.geocity).toEqual({ ...JSON.parse(JSON.stringify(HIJACK_DISTRICT)), dump: true, dock: true, office: true, cityhall: true, enter: [...HIJACK_ENTER], museum: { ...HIJACK_MUSEUM } });
    expect(hijackCityWorld({ museum: false }).levels.district.geocity).toEqual({ ...JSON.parse(JSON.stringify(HIJACK_DISTRICT)), dump: true, dock: true, office: true, cityhall: true, enter: [...HIJACK_ENTER] });
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

  it('stands in a locale by its word: its suburbs, its light, its sky, its air and its grade; the person\'s own words win; none is the starter as it was', () => {
    expect(hijackCityWorld({ locale: null })).toEqual(hijackCityWorld());
    expect(() => hijackCityWorld({ locale: 'atlantis' })).toThrow(/locale is/);
    const L = LOCALES['los-angeles'], W = hijackCityWorld({ locale: 'los-angeles' }), g = Object.values(W.levels)[0].geocity;
    expect(W.style).toMatchObject({ geocube: { from: L.cube }, hour: L.hour, clouds: L.clouds, air: L.air });
    expect(W.grade).toBe(L.grade);
    expect(g.outskirts).toBe(L.register);
    expect(() => readGameworld(W)).not.toThrow();
    // (its city over the district's metro: its grammar, the old fractal city's flavour it is a document over, its land,
    // its heights; the metro reads it as its own)
    expect(g).toMatchObject({ grammar: { from: L.city.grammar.from, label: L.city.grammar.label }, hills: L.city.hills, fall: L.city.fall, heights: L.city.heights });
    expect(designGeocity(g, { seed: W.seed }).grammar.label).toBe(L.city.grammar.label);
    // (a locale's own part of town, and the hill city for San Francisco's register)
    expect(Object.values(hijackCityWorld({ locale: 'boston' }).levels)[0].geocity).toMatchObject({ metro: { from: 'northeast' }, at: 'frame' });
    expect(Object.values(hijackCityWorld({ locale: 'san-francisco' }).levels)[0].geocity.metro.from).toBe('bayside');
    // (the person's words over it)
    expect(Object.values(hijackCityWorld({ locale: 'los-angeles', register: 'tropical', district: 'suburbs' }).levels)[0].geocity).toMatchObject({ outskirts: 'tropical', at: 'outskirts' });
    // (a row on each of its paths reads as a world: the lakeshore city's above, the Northeast's district and the hill city's)
    for (const id of ['boston', 'san-francisco']) expect(() => readGameworld(hijackCityWorld({ locale: id })), id).not.toThrow();
    expect(LOCALE_IDS).toContain('los-angeles');
  });

  it('plays its locale after dark by the hour: its night\'s lamps, air and grade; by day as it was', () => {
    const day = hijackCityWorld({ locale: 'los-angeles' }), night = hijackCityWorld({ locale: 'los-angeles', hour: 'night' });
    expect(day.levels.district.geocity.lamps).toBeUndefined();
    expect(night.levels.district.geocity.lamps).toBe(LOCALES['los-angeles'].night.lamps);
    expect(night.grade).toBe(LOCALES['los-angeles'].night.grade);
    expect(night.style.air).toEqual(LOCALES['los-angeles'].night.air);
    expect(night.style.hour).toBe('night');
    expect(() => readGameworld(night)).not.toThrow();
    // (no locale: the city's own night)
    expect(hijackCityWorld({ hour: 'dusk' }).levels.district.geocity.lamps).toBe(HIJACK_NIGHT.lamps);
    expect(hijackCityWorld({ hour: 'noon' })).toEqual({ ...hijackCityWorld(), style: { ...hijackCityWorld().style, hour: 'noon' } });
  });
});
