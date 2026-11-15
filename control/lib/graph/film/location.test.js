import { describe, it, expect } from 'vitest';
import { proposeLocation, SHOW_WORDS, SHOW_CUBE, LAND_HINTS } from './location.js';
import { filmErrors } from './film.js';
import { filmReadout } from './readout.js';
import { filmOfOrder } from './order.js';
import { ADVICE_HOME } from './departments.js';

// the set department's location job: a place proposed from a scene's own words
describe('a place proposed for a scene', () => {
  it('is a street for a house, a city for a corner downtown, a land in the scene\'s own words', () => {
    expect(proposeLocation('Evening outside her house.')).toEqual({ kind: 'geotown', ask: { cube: SHOW_CUBE.geotown, show: 'geotown' }, hour: 'dusk', from: ['house'] });
    expect(proposeLocation('Night, a street corner in the city.')).toMatchObject({ kind: 'geocity', ask: { show: 'geocity' }, hour: 'night', from: ['corner', 'city'] });
    expect(proposeLocation('A snowy forest by a frozen river')).toEqual({ kind: 'land', ask: { words: 'snowy forest river' }, from: ['snowy', 'forest', 'river'] });
    // a word that means land the geocube does not read is asked as one it does
    expect(proposeLocation(`Dawn at the ${Object.keys(LAND_HINTS)[0]}.`)).toMatchObject({ kind: 'land', hour: 'dawn', ask: { words: Object.values(LAND_HINTS)[0] } });
    // every proposal is a set a film takes
    for (const text of ['her house', 'the city', 'a lake']) expect(filmErrors({ cast: { a: {} }, sets: { s: proposeLocation(text).ask }, scenes: [{ id: 'x', set: 's', cast: { a: {} }, script: 'A: Hi.' }] })).toEqual([]);
    expect(SHOW_WORDS.geotown).toContain('street');
  });

  it('is nothing where the words name no place', () => {
    expect(proposeLocation('ANA: Ready?\nBEN: Ready.')).toBe(null);
    expect(proposeLocation('')).toBe(null);
    expect(proposeLocation('At noon they argue.')).toBe(null);
  });

  it('is advised for a scene with no set, from the client\'s notes, with the patch that takes it; a scene with a set is left alone', () => {
    const F = filmOfOrder({ cast: { ana: {} }, places: { yard: 'sk_yard' }, events: [
      { id: 'door', notes: 'Evening outside her house.', script: 'ANA: Home.' },
      { id: 'talk', notes: 'They talk.', script: 'ANA: So.' },
      { id: 'yard', place: 'yard', notes: 'Night in the city.', script: 'ANA: Here.' }] });
    const R = filmReadout(F, Object.fromEntries(F.scenes.map((S) => [S.id, { error: 'x' }])), {});
    const A = R.advice.filter((a) => a.id === 'no-set');
    expect(A.map((a) => a.scene)).toEqual(['door']);
    expect(A[0].says).toMatch(/has no set.*\(house\).*a street of houses, at dusk/);
    expect(A[0].department).toBe('set');
    expect(JSON.parse(A[0].try.slice(A[0].try.indexOf('['), A[0].try.lastIndexOf(']') + 1))).toEqual([
      { op: 'set', path: '/sets/door', value: { cube: SHOW_CUBE.geotown, show: 'geotown' } }, { op: 'set', path: '/scenes/0/set', value: 'door' }, { op: 'set', path: '/scenes/0/hour', value: 'dusk' }]);
    expect(ADVICE_HOME['no-set']).toBe('set');
  });
});

describe('a set\'s construction', () => {
  const film = (set) => ({ cast: { a: {} }, sets: { s: set }, scenes: [{ id: 'x', set: 's', cast: { a: {} }, script: 'A: Hi.' }] });
  it('names what its builders build and how the place is laid, in the geocube\'s own keys', () => {
    expect(filmErrors(film({ cube: 'valley-morning', show: 'geotown', style: 'tudor-market', geotown: { streetscape: 'leafy' } }))).toEqual([]);
    expect(filmErrors(film({ cube: 'valley-morning', show: 'geotown', style: 7 })).join()).toMatch(/style: what its builders build/);
    expect(filmErrors(film({ cube: 'city-night', show: 'geocity', geocity: 'big' })).join()).toMatch(/geocity: how the city is laid/);
  });
});

describe('a room asked for', () => {
  const film = (set) => ({ cast: { a: {} }, sets: { s: set }, scenes: [{ id: 'x', set: 's', cast: { a: {} }, script: 'A: Hi.' }] });
  it('is one of the interior designer\'s rooms, with its size, style and brief, and none of a place outdoors', () => {
    expect(filmErrors(film({ room: 'living' }))).toEqual([]);
    expect(filmErrors(film({ room: 'study', size: ['12ft', '14ft'], style: 'dark-academia', brief: 'a writer works here' }))).toEqual([]);
    expect(filmErrors(film({ room: 'cellar' })).join()).toMatch(/room: one of living, bedroom/);
    expect(filmErrors(film({ room: 'living', show: 'geotown' })).join()).toMatch(/a room is indoors.*not show/);
    expect(filmErrors(film({ words: 'a field', size: ['1ft', '2ft'] })).join()).toMatch(/size: a room's/);
  });

  it('is proposed for a scene indoors, unless the scene says it is outside', () => {
    expect(proposeLocation('Late, in the study. He is at the desk.')).toEqual({ kind: 'room', ask: { room: 'study' }, from: ['study', 'desk'] });
    expect(proposeLocation('They wait inside.')).toMatchObject({ kind: 'room', ask: { room: 'living' } });
    expect(proposeLocation('Outside the bedroom window, on the street.')).toMatchObject({ kind: 'geotown' });
    expect(filmErrors(film(proposeLocation('in the lounge').ask))).toEqual([]);
  });
});

