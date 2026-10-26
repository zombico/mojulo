// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * compose_world({ base: 'stadium' }): a preset and the words over it mint a `stadium` row that resolves on the World
 * page; a bad word refuses at mint, pointing at the manual.
 */
import { describe, expect, it } from 'vitest';

import { composeWorld } from './compose-world.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

describe("compose_world base 'stadium'", () => {
  it('mints a venue from a preset and words over it, and the World page resolves it', async () => {
    const r = composeWorld({ base: 'stadium', overrides: { preset: 'municipal', field: { w: 20, d: 30 }, time: 'night', masts: 2 } });
    expect(r.recipe).toMatchObject({ kind: 'stadium', preset: 'municipal', field: { w: 20, d: 30 }, time: 'night', masts: 2 });
    expect(r.recipe.context).toBeUndefined();   // the theme's slots do not land on a stadium
    const { kind, payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref), { live: true });
    expect(kind).toBe('stadium'); expect(payload.faces.length).toBeGreaterThan(1000); expect(payload.sky.preset).toBe('night');
  });
  it('refuses a word that is not a stadium\'s, pointing at the manual', () => {
    expect(() => composeWorld({ base: 'stadium', overrides: { bowl: { roof: 'tent' } } })).toThrow(/bowl.roof is one of .*get_view_vocab\(\{ id: 'stadium' \}\)/);
  });
});
