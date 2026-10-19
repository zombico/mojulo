// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

// Structures are kind-generic (world-scene.js grows manifest.structures in every kind), so the front door takes them on
// any base: read eagerly (a word that does not read refuses the mint, teaching), stamped when the base's whitelist drops
// them, and the stored world opens with the towers in its faces.
describe('compose_world structures passthrough', () => {
  const base = { base: 'transport-hub', seed: 7 };
  const towers = [{ preset: 'turning', at: [40, 0], size: 8 }, { preset: 'auto', seed: 3, at: [-40, 0] }];

  it('absent ⇒ not stored, no note', () => {
    const r = composeWorld({ ...base, overrides: { mode: 'subway' } });
    expect(r.recipe.structures).toBeUndefined();
    expect(r.note).toBeUndefined();
  });

  it('stored on the recipe and the row, not flagged as ignored, and grown when the world opens', async () => {
    const r = composeWorld({ ...base, overrides: { mode: 'subway', structures: towers } });
    expect(r.recipe.structures).toEqual(towers);
    expect(r.note).toBeUndefined();
    const stored = SketchRepository.getByRef(r.ref);
    expect(stored.manifest.structures).toEqual(towers);
    const { payload } = await resolveWorldScene(stored);
    expect(payload.faces.some((f) => String(f.group).startsWith('structure:'))).toBe(true);
  });

  it('a structure it cannot read refuses the mint and points at the card', () => {
    expect(() => composeWorld({ ...base, overrides: { mode: 'subway', structures: [{ preset: 'spire', at: [0, 0], rise: { curve: 'gothic' } }] } }))
      .toThrow(/rise\.curve: one of needle, cone, rekha.*get_view_vocab\(\{ id: 'structures' \}\)/s);
  });
});
