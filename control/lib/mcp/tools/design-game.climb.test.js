// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { auditGameLevel } from './create-game.js';
import { levelBrowser } from '@/lib/graph/game/first-frame-check';

// A climb's level walked for real (the headless browser the audit uses, when one is installed). With a hero, it climbs
// the flights, takes hold of the ladder its climb lays (levels.js climbLadders) and mounts the top its exit stands on:
// proved. Before the ladder, the drawn one was no surface and the walk stood under the exit. A world with no hero is
// walked first person, and a walker cannot climb: the pre-compile check says so before the build, the audit after.

const browser = await levelBrowser({ env: {} });
const climbsOf = (out) => out.ran.filter((r) => r.key.startsWith('level-')).map((r) => r.ref).filter((ref) => SketchRepository.getByRef(ref)?.manifest?.meru);

beforeEach(() => { closeDb(); process.env.MOJULO_RUN_BUDGET_MS = '0'; });

describe.skipIf(!browser.path)('design_game: a climb, walked', () => {
  it('with a hero: up its flights, up its ladder, to its exit, proved', async () => {
    const out = await designGameHandler({ quick: { goal: 'reach', climb: true, hero: { cast: 'female' }, world: { id: 'summit', style: { kit: 'isekai-meadow' } } }, ref: 'gh' });
    const [ref] = climbsOf(out);
    expect(ref).toBeTruthy();
    expect(SketchRepository.getByRef(ref).manifest.entities.some((e) => e.rule?.type === 'climbable')).toBe(true);
    const verdict = await auditGameLevel({ gameRef: 'gh-game', levelRef: ref, findBrowser: async () => browser });
    expect(verdict, verdict.note).toMatchObject({ completable: true, note: expect.stringMatching(/reach-exit.*success/) });
  }, 400000);

  it('walked first person: the check says it cannot be finished before the build, the walk says why after', async () => {
    const out = await designGameHandler({ compose: { prompt: 'a sunny island coast', levels: 1, seed: 3 }, ref: 'gw', run: true });
    const [ref] = climbsOf(out);
    expect(out.compile.advises).toEqual(expect.arrayContaining([expect.objectContaining({ chapter: 'levels', says: expect.stringMatching(/pilot's rule is 'walk': only a platform hero climbs/) })]));
    const verdict = await auditGameLevel({ gameRef: 'gw-game', levelRef: ref, findBrowser: async () => browser });
    expect(verdict.completable).toBe(false);
    expect(verdict.note).toMatch(/\(a climb\) stopped at .*never took hold.*rule is 'walk'/);
  }, 400000);
});
