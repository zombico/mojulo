import { describe, it, expect } from 'vitest';
import { readRoutines, routineCues, withRoutineCues } from './routines.js';

const play = { routines: [{ who: 'baker', plan: [{ hour: 6, to: 'oven', pose: 'use' }, { hour: 12, to: 'square' }, { hour: 20, to: 'home', pose: 'sit' }] }] };

describe('routines: the cast keeping their day', () => {
  it('a cue an hour of the plan, and where the hour finds them as the level starts', () => {
    const cues = routineCues(play);
    expect(cues.filter((c) => c.when.var === 'hour').map((c) => [c.when.eq, c.then.walk.to])).toEqual([[6, 'oven'], [12, 'square'], [20, 'home']]);
    expect(cues.find((c) => c.id === 'routine-baker-from-6')).toMatchObject({ when: { start: true }, if: [{ var: 'hour', gte: 6 }, { var: 'hour', lt: 12 }] });
    // before the first hour of the day they are where the last one left them
    expect(cues.find((c) => c.id === 'routine-baker-from-0')).toMatchObject({ if: { var: 'hour', lt: 6 }, then: { walk: { who: 'baker', to: 'home', pose: 'sit' } } });
    expect(withRoutineCues({ cues: [] }).cues).toEqual([]);
    expect(withRoutineCues(play).cues).toHaveLength(cues.length);
  });
  it('says what is wrong', () => {
    expect(() => readRoutines({ routines: [{ who: 'baker', plan: [{ hour: 6, to: 'oven' }] }] })).toThrow(/two or more/);
    expect(() => readRoutines({ routines: [{ who: 'baker', plan: [{ hour: 12, to: 'a' }, { hour: 6, to: 'b' }] }] })).toThrow(/go up/);
    expect(() => readRoutines({ routines: [{ who: 'baker', plan: [{ hour: 25, to: 'a' }, { hour: 26, to: 'b' }] }] })).toThrow(/0 to 23/);
  });
});
