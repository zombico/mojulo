// THE CITY'S GUIDE: read off a played level's own recipe: the nearest car, then each job's pick-up and hand-in where the
// level laid them; a standing job goes round again; a level with no job is simply open; one with no car has no guide.
import { describe, it, expect } from 'vitest';
import { cityGuide, CITY_GUIDE } from './city-guide.js';

const hero = { id: 'hero', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 } };
const cab = (id, pos, extra = {}) => ({ id, mount: { cab: true, hull: [0.9, 2.2], ...extra }, transform: { pos, heading: 0 } });
const trade = { kind: 'trade', item: 'passenger', count: 1, at: [70, 2, 0.5], radius: 7 };
const deliver = (extra = {}) => ({ kind: 'deliver', id: 'fare', wants: [{ item: 'passenger', min: 1 }], reward: [{ item: 'coin', n: 12 }], at: [180, 40, 1], radius: 7, ...extra });
const level = (mechanics, entities = [hero, cab('car-2', [30, 0, 0]), cab('car-1', [4, 3, 0.2]), cab('car-spare-1', [1, 0, -60], { spare: true })]) => ({ title: 'Open city · district · district', entities, game: { mechanics } });

describe('the city\'s guide', () => {
  it('leads to the nearest car, then the job\'s pick-up and its hand-in, where the level laid them', () => {
    const G = cityGuide(level([{ kind: 'bag', slice: 'bag' }, trade, deliver()]));
    expect(G.steps.map((s) => s.id)).toEqual(['car', 'pick-passenger', 'deliver-fare']);
    // (the nearest car that stands in the world: never a spare kept out of it)
    expect(G.steps[0]).toMatchObject({ at: [4, 3, 0.2], radius: CITY_GUIDE.car, say: 'Get into a car', cab: true });
    expect(G.steps[1]).toMatchObject({ at: [70, 2, 0.5], radius: 7, say: 'Pick up the passenger', says: 'Passenger aboard' });
    expect(G.steps[2]).toMatchObject({ at: [180, 40, 1], radius: 7, say: 'Deliver the passenger', says: 'Paid 12 coin' });
    expect(G.intro).toBe('Open city. Take any car. A job waits where the light stands.');
    expect(G.lessons.map((l) => l.fact)).toEqual(['move', undefined, undefined]);
    // (a job done once ends its level: nothing to go round)
    expect(G.loop).toBeUndefined();
  });
  it('a standing job goes round again from its pick-up', () => {
    expect(cityGuide(level([trade, deliver({ repeat: true })])).loop).toBe(1);
  });
  it('with no job the city is open, and says so; with no car, or no hero, it says nothing', () => {
    const G = cityGuide(level([]));
    expect(G.steps.map((s) => s.id)).toEqual(['car']);
    expect(G.intro).toMatch(/The city is open/);
    expect(G.done).toBe(CITY_GUIDE.open);
    expect(cityGuide(level([trade, deliver()], [hero]))).toBeNull();
    expect(cityGuide(level([], [cab('car-1', [0, 0, 0])]))).toBeNull();
    expect(cityGuide({})).toBeNull();
  });
});
