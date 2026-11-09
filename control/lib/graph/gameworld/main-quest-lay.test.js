import { describe, it, expect } from 'vitest';
import { questPlays, withQuestLevels, layBeat } from './main-quest-lay.js';
import { readGameworld, runSteps, MEADOWMARK } from './index.js';
import { FOE_CLASSES } from '../foes/index.js';

// The levels a main quest's beats are played on: a beat played as a structure on the level that holds it, a beat with
// only a goal laid its own level from its words (once), a planned beat laid nothing, and the game in the quest's order.

const FOE = Object.values(FOE_CLASSES)[0].id;
const [L1, L2] = Object.keys(MEADOWMARK.levels);
const W = {
  ...MEADOWMARK, mode: 'autonomous', review: undefined, foes: { grunt: { class: FOE } },
  mainQuest: { acts: [
    { id: 'one', goal: 'set out', beats: [{ id: 'second-first', goal: 'the shore first', as: { level: L2 } }] },
    { id: 'two', goal: 'the coast', beats: [{ id: 'windy-shore', goal: 'cross the windy shore', foes: ['grunt'] }] },
    { id: 'three', goal: 'the end', beats: [{ id: 'the-keep', goal: 'into the keep', built: false }] },
  ] },
};

describe('the main quest, laid', () => {
  it('says what each beat is played on, what a run lays, what is planned, and the quest\'s order', () => {
    expect(questPlays(W)).toEqual({
      plays: { 'second-first': L2, 'windy-shore': 'windy-shore', 'the-keep': null },
      lays: [{ beat: 'windy-shore', level: 'windy-shore', goal: 'cross the windy shore' }],
      planned: ['the-keep'],
      // the beats' levels first, in the beats' order, then the world's others
      order: [L2, 'windy-shore', L1],
    });
    expect(questPlays(MEADOWMARK)).toBeNull();
  });

  it('lays a goal-only beat a level from its words, named by its goal, standing its foes; the book keeps its style', () => {
    const L = withQuestLevels(W);
    expect(Object.keys(L.levels)).toEqual([L2, 'windy-shore', L1]);
    expect(L.levels['windy-shore']).toMatchObject({ name: 'Cross the windy shore', foes: { from: ['grunt'] }, walk: expect.any(Object) });
    expect(L.style).toEqual(W.style);
    // the planned beat laid nothing
    expect(L.levels['the-keep']).toBeUndefined();
    // deterministic: the same quest lays the same level
    expect(withQuestLevels(structuredClone(W)).levels['windy-shore']).toEqual(L.levels['windy-shore']);
    expect(layBeat({ id: 'windy-shore', goal: 'cross the windy shore', foes: ['grunt'] }, { foes: { grunt: 'minion' } })).toEqual(L.levels['windy-shore']);
    // the world it gives reads, and its run lays a level step for the laid level and none for the planned one
    expect(readGameworld(L).ids).toEqual([L2, 'windy-shore', L1]);
    const keys = runSteps(L, { ref: 'gw' }).map((s) => s.key);
    expect(keys.some((k) => k.startsWith('level-windy-shore-'))).toBe(true);
    expect(keys.some((k) => k.includes('the-keep'))).toBe(false);
    // and the run's levels come in the quest's order
    const order = [...new Set(keys.filter((k) => k.startsWith('level-')).map((k) => k.replace(/^level-/, '').replace(/-\d+$/, '')))];
    expect(order).toEqual([L2, 'windy-shore', L1]);
  });

  it('lays once: a level the beat already has (laid by a run, edited since) is the creator\'s and is kept', () => {
    const edited = { ...withQuestLevels(W) };
    edited.levels = { ...edited.levels, 'windy-shore': { ...edited.levels['windy-shore'], name: 'The gale coast' } };
    expect(questPlays(edited).lays).toEqual([]);
    expect(withQuestLevels(edited).levels['windy-shore'].name).toBe('The gale coast');
    // a world already laid and in order is given back as it is
    expect(withQuestLevels(edited)).toBe(edited);
    expect(withQuestLevels(MEADOWMARK)).toBe(MEADOWMARK);
  });
});
