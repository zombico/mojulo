// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK } from '@/lib/graph/gameworld/index';

// A main quest made through the real door (gameworld/main-quest-lay.js): a run lays a goal-only beat its own level into
// the recipe and makes it, plays the game in the quest's order, prices a planned beat and never makes it, and lays
// nothing twice.

const [L1, L2] = Object.keys(MEADOWMARK.levels);
const mainQuest = { acts: [
  { id: 'one', goal: 'set out', beats: [{ id: 'shore-first', goal: 'the shore first', as: { level: L2 } }] },
  { id: 'two', goal: 'the coast', beats: [{ id: 'windy-shore', goal: 'cross the windy shore' }] },
  { id: 'three', goal: 'the end', beats: [{ id: 'the-keep', goal: 'into the keep', built: false }] },
] };
const stored = (ref) => SketchRepository.getByRef(ref).manifest;

describe('design_game: a main quest, laid and made', () => {
  let before, first;
  beforeAll(async () => {
    closeDb();
    process.env.MOJULO_RUN_BUDGET_MS = '0';
    before = await designGameHandler({ world: { ...MEADOWMARK, mode: 'autonomous', review: undefined, mainQuest }, ref: 'gq' });
    first = await designGameHandler({ ref: 'gq', run: true });
  }, 400000);

  it('before the run: what each beat is played on, what the run will lay, the planned beat priced apart', async () => {
    expect(before.mainQuest).toMatchObject({ plays: { 'shore-first': L2, 'windy-shore': 'windy-shore', 'the-keep': null }, lays: ['windy-shore'], planned: 1 });
    const build = await designGameHandler({ ref: 'gq', chapter: 'build' });
    expect(build.compile.estimate.planned).toEqual({ beats: 1, seconds: expect.any(Number) });
  });

  it('the run lays the beat\'s level into the recipe and makes it; the game plays the quest\'s order', () => {
    expect(Object.keys(stored('gq').levels)).toEqual([L2, 'windy-shore', L1]);
    expect(stored('gq').levels['windy-shore']).toMatchObject({ name: 'Cross the windy shore' });
    const levels = first.ran.filter((r) => r.key.startsWith('level-')).map((r) => r.key.replace(/^level-/, '').replace(/-\d+$/, ''));
    expect([...new Set(levels)]).toEqual([L2, 'windy-shore', L1]);
    expect(first.ran.filter((r) => r.key.startsWith('level-windy-shore-')).every((r) => r.action === 'make')).toBe(true);
    const game = stored('gq-game');
    expect(game.levels.map((l) => l.ref)[0]).toBe(`gq-level-${L2}-0`);
    // the planned beat: nothing made for it
    expect(first.ran.some((r) => r.key.includes('the-keep'))).toBe(false);
    expect(first.mainQuest.lays).toBeUndefined();
  });

  it('lays nothing twice; a creator\'s edit to the laid level is theirs', async () => {
    const again = await designGameHandler({ ref: 'gq', run: true });
    expect(again.ran.filter((r) => r.key.startsWith('level-')).every((r) => r.action === 'keep')).toBe(true);
    await designGameHandler({ ref: 'gq', patch: [{ op: 'set', path: '/levels/windy-shore/name', value: 'The gale coast' }] });
    await designGameHandler({ ref: 'gq', run: true });
    expect(stored('gq').levels['windy-shore'].name).toBe('The gale coast');
  }, 400000);
});
