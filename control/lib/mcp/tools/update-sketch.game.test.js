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

describe('update_sketch on a versus game (a fighter)', () => {
  // every fighter a character, fought on arenas: the arena refs are the game's levels, here only named
  const ARENAS = [{ ref: 'fight-plaza', name: 'Plaza' }];
  const hero = async (ref, spec, extra = {}) => {
    const { heroRecord } = await import('./layered.js');
    SketchRepository.create({ ref, title: ref, manifest: { kind: 'layered', hero: heroRecord(spec), ...extra } });
  };

  it('an edit that gives a fighter a weapon, a tune and the game a system lands in place; one that cannot compile says why', async () => {
    await hero('kata', { cast: 'male' });
    SketchRepository.create({ ref: 'fight-game', title: 'Fight', manifest: { kind: 'game', engine: 'versus', title: 'Fight', roster: [{ id: 'kata', hero: { ref: 'kata' } }], arenas: ARENAS } });
    const manifest = {
      kind: 'game', engine: 'versus', title: 'Fight', arenas: ARENAS,
      roster: [{ id: 'kata', hero: { ref: 'kata' }, weapon: 'sword', tune: { 'stand.M': { adv: { block: 1 } } } }],
      rules: { systems: ['parry'] },
    };
    const out = await updateSketchHandler({ ref: 'fight-game', manifest });
    expect(SketchRepository.getByRef('fight-game').manifest).toEqual(manifest);
    expect(out.laws).toEqual([expect.objectContaining({ id: 'kata', held: expect.any(Number), of: expect.any(Number), broken: expect.any(Array) })]);
    await expect(updateSketchHandler({ ref: 'fight-game', manifest: { ...manifest, rules: { systems: ['dodge'] } } })).rejects.toThrow(/Invalid versus game: .*systems/);
  });

  it('every fighter is a character and the game is fought on arenas: a stick fighter or no arena is refused by name', async () => {
    await hero('lone', { cast: 'female' });
    const manifest = { kind: 'game', engine: 'versus', title: 'Fight', arenas: ARENAS, roster: [{ id: 'lone', hero: { ref: 'lone' } }] };
    SketchRepository.create({ ref: 'strict-fight', title: 'Fight', manifest });
    await expect(updateSketchHandler({ ref: 'strict-fight', manifest: { ...manifest, roster: [{ id: 'kata', archetype: 'all-rounder' }] } }))
      .rejects.toThrow(/roster\[0\] is not a character: every fighter is one/);
    const { arenas: _a, ...flat } = manifest;
    await expect(updateSketchHandler({ ref: 'strict-fight', manifest: flat })).rejects.toThrow(/arenas: a versus game is fought on its arenas/);
  });

  it('a character from the store fights in its own body, as its sheet reads: stored as its ref, measured and read on read, refused when it is not there', async () => {
    const { withCharacters } = await import('@/lib/graph/versus/versus-character.js');
    const { versusGameData } = await import('@/lib/graph/versus/versus-page.js');
    const { createSketchHandler } = await import('./sketches.js');
    // a sheet as the character loop keeps it, and the brute it made (the record the character door writes)
    const cube = await createSketchHandler({ title: 'Bruno (sheet)', manifest: { kind: 'egocube', roll: { facets: { role: 'frontline', archetype: 'ruler', build: 'brute', motivation: 0.1 }, seed: 2 } } });
    const { egocubePrint } = await import('@/lib/graph/egocube/kind.js');
    await hero('brawler', { cast: { pole: 'male', build: 'brute' } }, { egocube: { ref: cube.ref, rev: 1, print: egocubePrint(SketchRepository.getByRef(cube.ref).manifest) } });
    await hero('plain', { cast: 'male' });
    SketchRepository.create({ ref: 'char-fight', title: 'Fight', manifest: { kind: 'game', engine: 'versus', title: 'Fight', arenas: ARENAS, roster: [{ id: 'kata', hero: { ref: 'plain' } }] } });
    const manifest = { kind: 'game', engine: 'versus', title: 'Fight', arenas: ARENAS, roster: [{ id: 'kata', hero: { ref: 'plain' } }, { id: 'bruno', hero: { ref: 'brawler' } }] };
    const out = await updateSketchHandler({ ref: 'char-fight', manifest });
    expect(SketchRepository.getByRef('char-fight').manifest.roster[1]).toEqual({ id: 'bruno', hero: { ref: 'brawler' } });
    expect(out.laws.map((l) => l.id)).toEqual(['kata', 'bruno']);
    // the sheet's reading, said: the frontline ruler grapples, heavy
    expect(out.fighters[1]).toMatchObject({ id: 'bruno', character: 'brawler', sheet: cube.ref, reads: expect.arrayContaining([expect.objectContaining({ facet: 'role', word: 'grappler' })]) });
    expect(out.fighters[0]).not.toHaveProperty('sheet');
    const [kata, bruno] = versusGameData(await withCharacters(manifest)).roster;
    expect(kata).toMatchObject({ character: 'plain', archetype: 'all-rounder' });
    expect(bruno).toMatchObject({ character: 'brawler', archetype: 'grappler', name: 'The Ruler', recipe: { body: { arm: expect.any(Number) } } });
    expect(bruno.recipe.body.arm).toBeGreaterThan(1);   // the brute's long arms
    await expect(updateSketchHandler({ ref: 'char-fight', manifest: { ...manifest, roster: [{ id: 'x', hero: { ref: 'ghost' } }] } }))
      .rejects.toThrow(/Invalid versus game: roster\[0\]\.hero\.ref 'ghost' is not a stored character/);
  });
});
