// Isolate to an in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as create-view.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createGameHandler, getGameVocabHandler, mintGame } from './create-game.js';
import { getGameVocabCatalog } from '@/lib/graph/game/slice-cards/loader';

beforeEach(() => {
  closeDb();
});

// a LEVEL = a world sketch carrying a `game:` contract channel. orbit-view is a pure
// assembler, so it stands in for any world kind without touching textures/DB.
function mintLevel(ref, contract) {
  return SketchRepository.create({
    ref,
    title: ref,
    manifest: { kind: 'orbit-view', scenario: 'circular', game: contract },
  });
}

const STORE = {
  slices: [
    { name: 'hero', kind: 'character', init: { stats: { hp: 100 } } },
    { name: 'bag', kind: 'inventory' },
    { name: 'campaign', kind: 'progression' },
  ],
};

const contract = (levelRef) => ({
  levelRef,
  consumes: [{ slice: 'bag', pick: { max: 2 } }],
  produces: { events: [{ type: 'grant', slice: 'bag' }, { type: 'promote', slice: 'campaign', max: 1 }] },
});

describe('create_game — mint + promotion discipline', () => {
  it('mints a game over validated levels and returns the play URL', async () => {
    mintLevel('crypt-1', contract('crypt-1'));
    mintLevel('crypt-2', contract('crypt-2'));
    const out = await mintGame({
      title: 'Crypt Campaign',
      store: STORE,
      levels: [{ ref: 'crypt-1', title: 'The Door' }, { ref: 'crypt-2', gate: { completed: 'crypt-1' } }],
      ref: 'crypt-game',
      allowUnaudited: true,   // structural test — completability is exercised in create-game.audit.test.js
    });
    expect(out.ok).toBe(true);
    expect(out.ref).toBe('crypt-game');
    expect(out.playUrl).toBe('/api/sketches/crypt-game/game');
    expect(out.levels).toEqual(['crypt-1', 'crypt-2']);
    expect(out.audits.every((a) => a.audited === false)).toBe(true);   // promoted unaudited, recorded
    // the stored row is a game manifest (a recipe of refs), not the resolved contracts
    const row = SketchRepository.getByRef('crypt-game');
    expect(row.manifest.kind).toBe('game');
    expect(row.manifest.levels.map((l) => l.ref)).toEqual(['crypt-1', 'crypt-2']);
  });

  it('refuses to promote a level that does not exist', async () => {
    mintLevel('crypt-1', contract('crypt-1'));
    await expect(createGameHandler({
      title: 'Broken', store: STORE, levels: [{ ref: 'crypt-1' }, { ref: 'ghost' }],
    })).rejects.toThrow(/no sketch with that ref/);
  });

  it('refuses a level whose sketch carries no game channel (a plain world is not a level)', async () => {
    mintLevel('crypt-1', contract('crypt-1'));
    SketchRepository.create({ ref: 'plain', title: 'plain', manifest: { kind: 'orbit-view', scenario: 'circular' } });
    await expect(createGameHandler({
      title: 'Broken', store: STORE, levels: [{ ref: 'crypt-1' }, { ref: 'plain' }],
    })).rejects.toThrow(/carries no `game` channel/);
  });

  it("refuses a level whose contract produces an event the game's store can't apply", async () => {
    // level wants to setFlag, but the game declares no flags slice
    mintLevel('bad', { levelRef: 'bad', produces: { events: [{ type: 'grant', slice: 'bag' }] } });
    mintLevel('flagger', { levelRef: 'flagger', produces: { events: [{ type: 'setFlag', slice: 'world' }] } });
    await expect(createGameHandler({
      title: 'Mismatch', store: STORE, levels: [{ ref: 'bad' }, { ref: 'flagger' }],
    })).rejects.toThrow(/not declared in the game's store schema|store-schema manuals/);
  });

  it('teaches (points at the vocab) when the manifest itself is malformed', async () => {
    await expect(createGameHandler({ title: 'X', store: { slices: [] }, levels: [] }))
      .rejects.toThrow(/store-schema manuals: get_game_vocab/);
  });
});

describe('get_game_vocab', () => {
  it('lists index rows and reads a card in full', async () => {
    const list = await getGameVocabHandler({});
    expect(list.ok).toBe(true);
    expect(list.cards.map((c) => c.id)).toContain('slice-party');
    const card = await getGameVocabHandler({ id: 'slice-party' });
    expect(card.card.body).toMatch(/roster/);
  });

  it('every slice-card + typed-events card is registered (mirror of the kernel vocabulary)', () => {
    const cat = getGameVocabCatalog();
    for (const id of ['slice-character', 'slice-inventory', 'slice-party', 'slice-progression', 'slice-flags', 'typed-events']) {
      expect(cat.has(id), id).toBe(true);
    }
  });

  it('serves BOTH families: slice + mechanic cards, filterable by scope', async () => {
    const all = await getGameVocabHandler({});
    const ids = all.cards.map((c) => c.id);
    expect(ids).toContain('slice-party');        // store family
    expect(ids).toContain('reach-exit');         // mechanic family
    expect(all.cards.find((c) => c.id === 'reach-exit').scope).toBe('mechanic');
    // reads a mechanic card by id
    const rx = await getGameVocabHandler({ id: 'reach-exit' });
    expect(rx.card.body).toMatch(/goal:reached/);
    // scope filters the list
    const onlyMech = await getGameVocabHandler({ scope: 'mechanic' });
    expect(onlyMech.cards.every((c) => c.scope === 'mechanic')).toBe(true);
    expect(onlyMech.cards.some((c) => c.id === 'fall-policy')).toBe(true);
    const onlySlice = await getGameVocabHandler({ scope: 'slice' });
    expect(onlySlice.cards.some((c) => c.id.startsWith('slice-'))).toBe(true);
    expect(onlySlice.cards.some((c) => c.id === 'reach-exit')).toBe(false);
  });

  it('serves the KIT family too (game types) + reads a kit card by id', async () => {
    const all = await getGameVocabHandler({});
    expect(all.cards.some((c) => c.id === 'dungeon-crawler' && c.scope === 'kit')).toBe(true);
    const kit = await getGameVocabHandler({ id: 'dungeon-crawler' });
    expect(kit.card.body).toMatch(/create_game/);
    const onlyKits = await getGameVocabHandler({ scope: 'kit' });
    expect(onlyKits.cards.every((c) => c.scope === 'kit')).toBe(true);
    expect(onlyKits.cards.some((c) => c.id === 'survival-arena')).toBe(true);
  });
});

describe('registration — the tools are listed and invokable', () => {
  it('create_game + get_game_vocab register and appear in tools/list', async () => {
    const { ensureToolsRegistered, isToolListed } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    expect(isToolListed('create_game')).toBe(true);
    expect(isToolListed('get_game_vocab')).toBe(true);
  });
});
