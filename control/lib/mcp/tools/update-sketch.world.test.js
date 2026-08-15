// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { composeWorld } from './compose-world.js';
import { updateSketchHandler } from './sketches.js';
import { SketchRepository } from '@/lib/db/repositories/sketches.js';

// R4 (0813 persona sims): update_sketch ran the stations/marks diagram validator
// against world manifests ("manifest.viewBox is required … stations[] or marks[]"),
// so iterating a world meant minting near-duplicate refs. World kinds now validate
// by resolving through the world registry — the render contract itself.

const DUNGEON = {
  chambers: [
    { id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 },
    { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 },
  ],
  tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }],
};

describe('update_sketch on world manifests', () => {
  it('a valid world edit updates IN PLACE (no new ref, no diagram validator)', async () => {
    const minted = composeWorld({ base: 'dungeon', seed: 11, overrides: DUNGEON, title: 'iterate me' });
    const edited = {
      ...minted.recipe,
      chambers: DUNGEON.chambers.map((c) => (c.id === 'west' ? { ...c, radius: 8 } : c)),
    };
    const r = await updateSketchHandler({ ref: minted.ref, manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.ref).toBe(minted.ref);
    const stored = SketchRepository.getByRef(minted.ref);
    expect(stored.manifest.chambers.find((c) => c.id === 'west').radius).toBe(8);
  });

  it('a broken world edit is refused with a WORLD error, not a diagram one', async () => {
    const minted = composeWorld({ base: 'dungeon', seed: 12, overrides: DUNGEON });
    const broken = {
      ...minted.recipe,
      tunnels: [{ from: 'hub', to: 'nowhere', style: 'corridor' }],
    };
    await expect(updateSketchHandler({ ref: minted.ref, manifest: broken }))
      .rejects.toThrow(/Invalid world manifest \(kind 'dungeon'\)/);
    await expect(updateSketchHandler({ ref: minted.ref, manifest: broken }))
      .rejects.not.toThrow(/viewBox is required/);
    // the stored recipe never moved
    const stored = SketchRepository.getByRef(minted.ref);
    expect(stored.manifest.tunnels[0].to).toBe('west');
  });

  it('title-only updates on a world still work without touching the manifest', async () => {
    const minted = composeWorld({ base: 'dungeon', seed: 13, overrides: DUNGEON });
    const r = await updateSketchHandler({ ref: minted.ref, title: 'renamed dungeon' });
    expect(r.ok).toBe(true);
    expect(SketchRepository.getByRef(minted.ref).title).toBe('renamed dungeon');
  });

  it('diagram manifests still route through the diagram validator', async () => {
    await expect(updateSketchHandler({ ref: 'sk_nope_diagram', manifest: { title: 'x' } }))
      .rejects.toThrow(/viewBox is required/);
  });
});
