// THE LIGHT MOODS (action-first-level.js): a building level's light as one word, written as its rooms' plot, its cube's
// shade and the world's grade; the stylish starter dressed by one. One mood picked in code; every mood in the deep sweep.
import { describe, it, expect } from 'vitest';
import { LIGHT_MOODS, MOOD_IDS, moodOf, actionStarter } from './action-first-level.js';

describe('a light mood', () => {
  const mood = MOOD_IDS.find((m) => Object.keys(LIGHT_MOODS[m].rooms).length > 0 && Object.keys(LIGHT_MOODS[m].rooms).length < 4) ?? MOOD_IDS[0];
  it('lights every room it is given, a room it does not name by its own reading, with its shade and its grade', () => {
    const rooms = ['gate', 'hall', 'crypt'], M = moodOf(mood, rooms), L = LIGHT_MOODS[mood];
    expect(Object.keys(M.plot)).toEqual(rooms);
    expect(M.plot.crypt).toEqual(L.room);
    for (const r of rooms) if (L.rooms[r]) expect(M.plot[r]).toEqual(L.rooms[r]);
    expect(M).toMatchObject({ shade: L.shade, grade: L.grade });
    expect(() => moodOf('no-such', rooms)).toThrow(/light mood/);
  });
  it('dresses the starter: the first mood by default, another when asked, nothing else of the level changing', () => {
    const A = actionStarter(), B = actionStarter({ mood });
    expect(A.level.building.geocube.light.shade).toBe(LIGHT_MOODS[MOOD_IDS[0]].shade);
    expect(B.level.building.geocube.light.shade).toBe(LIGHT_MOODS[mood].shade); expect(B.grade).toEqual(LIGHT_MOODS[mood].grade);
    const strip = (X) => { const { plot: _p, geocube: _g, ...b } = X.level.building; return { ...X, grade: null, level: { ...X.level, building: b } }; };
    expect(strip(B)).toEqual(strip(A));
  });
});
