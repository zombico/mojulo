// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintGame } from './create-game.js';
import { updateSketchHandler } from './sketches.js';

// edit-3d-recipes.plan.md Phase 1: game manifests used to fall through
// update_sketch's diagram fallback ("manifest.viewBox is required"), so tweaking
// a level list or difficulty meant re-minting a new ref and re-binding project
// membership. kind:'game' now pays create_game's structural gate on update.

beforeEach(() => {
  closeDb();
});

function mintLevel(ref, contract) {
  return SketchRepository.create({
    ref,
    title: ref,
    manifest: { kind: 'orbit-view', scenario: 'circular', game: contract },
  });
}

const STORE = {
  slices: [
    { name: 'bag', kind: 'inventory' },
    { name: 'campaign', kind: 'progression' },
  ],
};

const contract = (levelRef) => ({
  levelRef,
  produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] },
});

async function mintCryptGame() {
  mintLevel('crypt-1', contract('crypt-1'));
  mintLevel('crypt-2', contract('crypt-2'));
  return mintGame({
    title: 'Crypt Campaign',
    store: STORE,
    levels: [{ ref: 'crypt-1' }, { ref: 'crypt-2', gate: { completed: 'crypt-1' } }],
    ref: 'crypt-game',
    allowUnaudited: true,
  });
}

describe('update_sketch on game manifests', () => {
  it('a valid game edit updates IN PLACE (no new ref, no diagram validator)', async () => {
    await mintCryptGame();
    const stored = SketchRepository.getByRef('crypt-game');
    // drop a level + add a difficulty pick — the top edit use cases
    const edited = {
      ...stored.manifest,
      levels: stored.manifest.levels.filter((l) => l.ref !== 'crypt-2'),
      difficulty: { options: [{ id: 'easy', name: 'Story' }, { id: 'max', name: 'Iron' }] },
    };
    const r = await updateSketchHandler({ ref: 'crypt-game', manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.ref).toBe('crypt-game');
    expect(r.note).toBeUndefined();   // no level was ADDED, so no unaudited note
    const after = SketchRepository.getByRef('crypt-game');
    expect(after.manifest.kind).toBe('game');
    expect(after.manifest.levels.map((l) => l.ref)).toEqual(['crypt-1']);
    expect(after.manifest.difficulty.options.map((o) => o.id)).toEqual(['easy', 'max']);
  });

  it('adding a NEW level passes the structural gate but is recorded as unaudited', async () => {
    await mintCryptGame();
    mintLevel('crypt-3', contract('crypt-3'));
    const stored = SketchRepository.getByRef('crypt-game');
    const edited = { ...stored.manifest, levels: [...stored.manifest.levels, { ref: 'crypt-3' }] };
    const r = await updateSketchHandler({ ref: 'crypt-game', manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/crypt-3/);
    expect(r.note).toMatch(/completability/);
    expect(SketchRepository.getByRef('crypt-game').manifest.levels.map((l) => l.ref))
      .toEqual(['crypt-1', 'crypt-2', 'crypt-3']);
  });

  it('a broken game edit is refused with a GAME error naming the ref, not a diagram one', async () => {
    await mintCryptGame();
    const stored = SketchRepository.getByRef('crypt-game');
    const broken = { ...stored.manifest, levels: [...stored.manifest.levels, { ref: 'ghost' }] };
    await expect(updateSketchHandler({ ref: 'crypt-game', manifest: broken }))
      .rejects.toThrow(/Invalid game manifest/);
    await expect(updateSketchHandler({ ref: 'crypt-game', manifest: broken }))
      .rejects.not.toThrow(/viewBox is required/);
    // the stored recipe never moved
    expect(SketchRepository.getByRef('crypt-game').manifest.levels.map((l) => l.ref))
      .toEqual(['crypt-1', 'crypt-2']);
  });

  it("refuses a level whose contract the edited store can no longer apply (dry-run holds on update)", async () => {
    await mintCryptGame();
    const stored = SketchRepository.getByRef('crypt-game');
    // drop the 'bag' slice the levels' contracts grant into
    const broken = { ...stored.manifest, store: { slices: stored.manifest.store.slices.filter((s) => s.name !== 'bag') } };
    await expect(updateSketchHandler({ ref: 'crypt-game', manifest: broken }))
      .rejects.toThrow(/Invalid game manifest/);
    expect(SketchRepository.getByRef('crypt-game').manifest.store.slices.map((s) => s.name))
      .toContain('bag');
  });
});
