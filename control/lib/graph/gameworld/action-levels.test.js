// THE ACTION LEVEL PLANS (action-levels.js): where a stylish game's level is fought, by name or by the pitch's words; a
// plan's level, its fights by room and its light. One plan picked in code (one that is not the citadel): the concept.
import { describe, it, expect } from 'vitest';
import { ACTION_LEVELS, ACTION_LEVEL_IDS, levelPlan, planOfWords } from './action-levels.js';
import { LIGHT_MOODS } from './action-first-level.js';

const id = ACTION_LEVEL_IDS.find((k) => k !== 'citadel' && ACTION_LEVELS[k].fights.length >= 3);

describe('an action level plan', () => {
  it('lays its building, a task a fight room in order, each fight its kind\'s waves, and its mood\'s light', () => {
    const P = levelPlan(id), R = ACTION_LEVELS[id];
    expect(P.level.building).toMatchObject({ use: R.use, geocube: { from: R.cube.from, inside: R.cube.inside } });
    expect(P.level.goal.tasks).toEqual(R.fights.map(([r]) => ({ fight: r, at: r })));
    for (const [r, kind] of R.fights) { expect(P.fights[r].kind).toBe(kind); expect(P.fights[r].waves.length).toBeGreaterThan(0); }
    expect(Object.keys(P.level.building.plot)).toEqual(R.fights.map(([r]) => r));
    expect(P.level.building.geocube.light.shade).toBe(LIGHT_MOODS[R.mood].shade);
    // (another mood asked: its light, nothing else changing)
    const other = Object.keys(LIGHT_MOODS).find((m) => m !== R.mood), Q = levelPlan(id, { mood: other });
    expect(Q.grade).toEqual(LIGHT_MOODS[other].grade); expect(Q.level.goal).toEqual(P.level.goal); expect(Q.fights).toEqual(P.fights);
    expect(() => levelPlan('no-such')).toThrow(/action level plan/);
  });
  it('is named by the words a pitch says, the first plan that owns them; none, none', () => {
    const w = ACTION_LEVELS[id].words[0];
    expect(planOfWords(`A ${w.toUpperCase()} of the damned`)).toBe(id);
    expect(planOfWords('a game about nothing in particular')).toBeNull();
  });
});
