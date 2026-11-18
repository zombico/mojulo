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
  it('a job that is offered is taken first, where its giver stands; its quest starts then and taking it is no step', async () => {
    const { jobsOf, jobQuests } = await import('./city-guide.js');
    const offer = { kind: 'offer', id: 'fare', at: [10, 8, 0], flag: 'took-fare', says: 'Hop in.', radius: 7, place: 'diner' };
    const M = [offer, { ...trade, flag: 'had-passenger', after: 'took-fare' }, deliver({ repeat: true, flag: 'done-fare' })];
    const G = cityGuide(level(M));
    expect(G.steps.map((s) => s.id)).toEqual(['car', 'take-fare', 'pick-passenger', 'deliver-fare']);
    expect(G.steps[1]).toMatchObject({ say: 'Meet your contact at the diner', at: [10, 8, 0], radius: 7, says: 'Hop in.' });
    expect(G.steps[1].take).toBeUndefined();
    expect(G.loop).toBe(2);
    expect(jobsOf(M)[0].starts).toBe('took-fare');
    expect(jobQuests(M)).toEqual([{ id: 'fare', name: 'Fare', starts: 'took-fare', steps: [{ log: 'Pick up the passenger', done: 'had-passenger' }, { log: 'Deliver the passenger', done: 'done-fare' }] }]);
  });
  it('a contact\'s next job comes by phone: it is taken nowhere; a one-off is brought back to who gave it', async () => {
    const { jobsOf, jobQuests, contactName } = await import('./city-guide.js');
    const M = [{ kind: 'offer', id: 'parcel', at: [10, 8, 0], flag: 'took-parcel', place: 'diner', contact: 'dispatch' },
      { kind: 'trade', item: 'gadget', job: 'parcel', at: [70, 2, 0], flag: 'had-gadget', after: 'took-parcel' },
      { kind: 'deliver', id: 'parcel', wants: [{ item: 'gadget', min: 1 }], at: [10, 8, 0], home: true, place: 'diner', flag: 'done-parcel', after: 'took-parcel' },
      { kind: 'call', id: 'fare', flag: 'took-fare', on: 'errand:done:parcel', from: 'Dispatch', says: 'Fares are waiting.', contact: 'dispatch' },
      { ...trade, flag: 'had-passenger', after: 'took-fare' }, deliver({ repeat: true, flag: 'done-fare', after: 'took-fare' })];
    const J = jobsOf(M);
    expect(J.map((j) => [j.id, j.starts, j.called === true, j.contact])).toEqual([['parcel', 'took-parcel', false, 'dispatch'], ['fare', 'took-fare', true, 'dispatch']]);
    expect(J[0].steps.map((x) => x.say)).toEqual(['Meet dispatch at the diner', 'Pick up the gadget', 'Bring the gadget back to dispatch at the diner']);
    expect(J[1].steps.map((x) => x.id)).toEqual(['pick-passenger', 'deliver-fare']);
    expect(jobQuests(M).map((q) => q.starts)).toEqual(['took-parcel', 'took-fare']);
    expect([contactName(), contactName('contact'), contactName('dispatch')]).toEqual(['Your contact', 'Your contact', 'Dispatch']);
  });
});
