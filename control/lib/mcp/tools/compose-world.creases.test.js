// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { CREASE_DEFAULTS } from '@/lib/graph/scene/channels/creases';

// Creases are kind-generic (world-scene.js hands manifest.creases to the World page for every kind), so the front door
// takes them on any base: read eagerly (a setting that does not read refuses the mint, teaching), stamped when the base's
// whitelist drops them, and the stored world's payload carries the resolved terms.
describe('compose_world creases passthrough', () => {
  const base = { base: 'transport-hub', seed: 7 };

  it('absent ⇒ not stored, no note', () => {
    const r = composeWorld({ ...base, overrides: { mode: 'subway' } });
    expect(r.recipe.creases).toBeUndefined();
    expect(r.note).toBeUndefined();
  });

  it('stored on the recipe and the row, not flagged as ignored, and carried when the world opens', async () => {
    const r = composeWorld({ ...base, overrides: { mode: 'subway', creases: { reach: 1 } } });
    expect(r.recipe.creases).toEqual({ reach: 1 });
    expect(r.note).toBeUndefined();
    const stored = SketchRepository.getByRef(r.ref);
    expect(stored.manifest.creases).toEqual({ reach: 1 });
    const { payload } = await resolveWorldScene(stored);
    expect(payload.creases).toEqual({ ...CREASE_DEFAULTS, reach: 1 });
  });

  it('a setting it cannot read refuses the mint and points at the card', () => {
    expect(() => composeWorld({ ...base, overrides: { mode: 'subway', creases: { width: 2 } } }))
      .toThrow(/overrides\.creases\.width is not a setting.*get_view_vocab\(\{ id: 'creases' \}\)/s);
  });
});
