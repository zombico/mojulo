import { describe, it, expect } from 'vitest';
import { beatUnit, beatRemit, questUnits } from './quest-reqs.js';
import { questPlays, withQuestLevels } from './main-quest-lay.js';
import { MEADOWMARK } from './index.js';

// The quest as the queue (quest-reqs.js): a beat asked for is the level a run plays it on, its remit filled from the
// quest; the quest's built beats in its order are the ledger's queue.

const [L1, L2] = Object.keys(MEADOWMARK.levels);
const mainQuest = { acts: [
  { id: 'one', name: 'Setting out', goal: 'set out', beats: [{ id: 'shore-first', goal: 'the shore first', as: { level: L2 } }] },
  { id: 'two', goal: 'the coast', beats: [{ id: 'windy-shore', goal: 'cross the windy shore', gains: ['gust'], foes: ['crab'] }] },
  { id: 'three', goal: 'the end', beats: [{ id: 'the-keep', goal: 'into the keep', built: false }] },
] };
const W = { ...MEADOWMARK, mainQuest };

describe('a beat asked for', () => {
  it('is the level a run plays it on: an existing level, or the one a run would lay from its words', () => {
    expect(beatUnit(W, 'shore-first')).toEqual({ beat: 'shore-first', level: L2, laid: false });
    expect(beatUnit(W, 'windy-shore')).toEqual({ beat: 'windy-shore', level: 'windy-shore', laid: true });
    expect(questPlays(W).plays['windy-shore']).toBe('windy-shore');
    // once laid (as a run lays it), it is in the recipe
    expect(beatUnit(withQuestLevels(W), 'windy-shore').laid).toBe(false);
  });

  it('is refused when there is nothing to make, saying what the quest holds', () => {
    expect(() => beatUnit(W, 'the-keep')).toThrow(/planned \(built: false\)/);
    expect(() => beatUnit(W, 'nowhere')).toThrow(/no beat 'nowhere' \(its beats: shore-first, windy-shore, the-keep\)/);
    expect(() => beatUnit(MEADOWMARK, 'shore-first')).toThrow(/no main quest/);
  });

  it('carries a remit from the quest: its act and stage, its foes and gains, the beats around it, the core loop', () => {
    const first = beatRemit(W, 'shore-first'), second = beatRemit(W, 'windy-shore');
    expect(first).toMatchObject({ beat: 'act 1 of 3, Setting out (early): the shore first', band: 'early: act 1 of 3', in: 'the game\'s start', out: `on to 'cross the windy shore' (level:windy-shore)` });
    expect(first.idea).toBeUndefined();
    expect(second).toMatchObject({ band: 'mid: act 2 of 3', foes: 'crab', idea: 'the hero gains gust here', in: `from 'the shore first' (level:${L2})`, out: 'the quest\'s last built beat' });
    expect(second.loop).toMatch(/move, jump/);
  });
});

describe('the quest as the queue', () => {
  it('every built beat\'s level in the quest\'s order; the planned ones said', () => {
    expect(questUnits(W)).toEqual({ units: [{ beat: 'shore-first', level: L2 }, { beat: 'windy-shore', level: 'windy-shore' }], planned: ['the-keep'], unhosted: [] });
    expect(questUnits(W).units.map((u) => u.level)).not.toContain(L1);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(beatRemit(W, 'windy-shore'))).toBe(JSON.stringify(beatRemit(structuredClone(W), 'windy-shore')));
  });
});
