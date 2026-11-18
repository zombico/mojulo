// A MISSION ON A GEOCUBE'S SITE, ITS WORDS (mission-site.js). The place is the geocube's own recipe: the concepts here
// are that a site reads its words on rails, says what it is when it names nothing, and lowers to the geocube's own
// recipe (a building with a hall on its yard, its hour, its weather, what is parked), nothing drawn. The level whole
// is the e2e tier's (mission-site.live.test.js): it resolves the place.
import { describe, expect, it } from 'vitest';
import { readSite, siteRecipe, SITE } from './mission-site.js';
import { PROGRAM_IDS, PROGRAMS } from '../era/programs.js';
import { ERAS } from '../era/eras.js';

const G = { id: 's', name: 'S', seed: 1 };
const HALL = PROGRAM_IDS.find((u) => PROGRAMS[u].annex), FLAT = PROGRAM_IDS.find((u) => PROGRAMS[u].shape === 'core' && !PROGRAMS[u].annex);

describe('a site, read', () => {
  it('is what it is when it names nothing, and takes each word on its rail', () => {
    expect(readSite()).toEqual({ ...SITE, parked: [...SITE.parked] });
    expect(readSite(true)).toEqual(readSite({}));
    expect(readSite({ use: HALL, containers: 0, floods: 0, weather: false, parked: false })).toMatchObject({ use: HALL, containers: 0, floods: 0, weather: false, parked: [] });
    expect(() => readSite({ use: FLAT })).toThrow(/a building with a hall on a yard/);
    expect(() => readSite({ containers: 99 })).toThrow(/0 to 40/);
    expect(() => readSite({ floods: 99 })).toThrow(/0 to 8/);
    expect(() => readSite({ hour: 'teatime' })).toThrow(/hour is a number/);
    expect(() => readSite({ weather: 'soup' })).toThrow(/the air over it/);
    expect(() => readSite({ parked: 'a tank' })).toThrow(/the vehicles standing in its hall/);
    expect(() => readSite({ moat: true })).toThrow(/not a site's word/);
  });
  it('lowers to the geocube\'s own recipe: the building on its yard, its hour and weather, its hall kept clear for what is parked', () => {
    const R = siteRecipe(G, readSite());
    expect(R.kind).toBe('geocube');
    expect(ERAS[R.cube.era].surface).toBe('form');
    expect(R).toMatchObject({ hour: SITE.hour, weather: SITE.weather });
    expect(R.buildings).toHaveLength(1);
    expect(R.buildings[0]).toMatchObject({ use: SITE.use, yard: { containers: SITE.containers, floods: SITE.floods, floodsAt: SITE.floodsAt }, look: { dressing: 'garage' } });
    expect(R.parked).toBeUndefined();
    // (a dry day with an empty yard and nothing parked asks for none of it)
    const bare = siteRecipe(G, readSite({ containers: 0, floods: 0, weather: false, parked: false, hour: 'noon' }));
    expect(bare.weather).toBeUndefined();
    expect(bare.buildings[0].yard).toBeUndefined();
    expect(bare.buildings[0].look.dressing).toBeUndefined();
    expect(siteRecipe(G, readSite(), { parked: [{ vehicle: 'x', at: [0, 0, 0], heading: 0 }] }).parked).toHaveLength(1);
  });
});
