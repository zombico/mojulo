// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';

// The interpreter as a door: a few words become a whole world, stored as `world` is (its cube's palette stamped, the
// world taking it), answered with what each word decided; and a world before its people makes its levels on a run.
beforeEach(() => { closeDb(); });
const stored = (ref) => SketchRepository.getByRef(ref)?.manifest;
const PROMPT = 'a sunny island coast with arches and a timber village';

describe('design_game compose', () => {
  it('stores the world the words compose, its cube and palette stamped, and answers with what each word decided', async () => {
    const out = await designGameHandler({ compose: { prompt: PROMPT, levels: 2, seed: 3 }, ref: 'isle' });
    expect(out.ok).toBe(true);
    const W = stored('isle');
    expect(W).toMatchObject({ kind: 'gameworld', mode: 'autonomous', brief: { prompt: PROMPT } });
    expect(Object.keys(W.levels)).toHaveLength(2);
    expect(W.style.geocube).toMatchObject({ from: 'island-noon', palette: { seed: expect.any(Number) } });
    expect(W.style.palette).toEqual(W.style.geocube.palette);
    expect(out.composed).toMatchObject({ prompt: PROMPT, cube: { id: 'island-noon', word: 'sunny' } });
    expect(out.composed.read).toEqual(expect.arrayContaining([expect.stringMatching(/^sunny: .*geocube/)]));
  });

  it('refuses a world, a patch or a quick game beside it, and a compose without words', async () => {
    await expect(designGameHandler({ compose: { prompt: PROMPT }, world: { id: 'x', levels: {} } })).rejects.toThrow(/give it alone/);
    await expect(designGameHandler({ compose: { prompt: PROMPT }, quick: { goal: 'reach' } })).rejects.toThrow(/give it alone/);
    await expect(designGameHandler({ compose: { prompt: ' ' } })).rejects.toThrow(/the few words/);
    await expect(designGameHandler({ compose: { prompt: PROMPT, levels: 9 } })).rejects.toThrow(/1 to 6/);
    await expect(designGameHandler({ compose: { prompt: PROMPT, colour: 'red' } })).rejects.toThrow(/compose.colour is not a setting/);
  });

  it('a run makes its levels at once, walked in first person, and the game over them', async () => {
    const out = await designGameHandler({ compose: { prompt: PROMPT, levels: 1, seed: 3 }, ref: 'isle1', run: true });
    const levels = Object.entries(out.made ?? {}).filter(([k]) => k.startsWith('level-'));
    expect(levels.length).toBeGreaterThan(0);
    expect(out.made.game).toBeDefined();
    expect(out.made.hero).toBeUndefined();
    const L = stored(levels[0][1].ref ?? levels[0][1]);
    expect(JSON.stringify(L)).not.toContain('"heroRef":"isle1-hero"');
  }, 600_000);
});
