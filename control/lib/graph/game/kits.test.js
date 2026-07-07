import { describe, it, expect } from 'vitest';

import { KIT_IDS, getKit, listKits, scaffoldGameFromKit } from './kits.js';
import { getKitVocabCatalog, listKitVocab } from './kit-cards/loader.js';
import { validateGameManifest } from './game-manifest.js';
import { composeMechanics } from './mechanics.js';
import { resolveGame } from './game-resolve.js';

// ── M4: game kits (game-mechanics.plan.md) ──────────────────────────────────────────────────────
// A kit scaffolds a whole game from per-level geometry: a ready store, per-level game channels
// (mechanics + fall), and progression gates. Everything it produces must be valid downstream —
// the store validates, the level channels lower, and the assembled game passes resolveGame.

const DUNGEON = {
  title: 'Test Crypt',
  levels: [
    { ref: 'crypt-1', exit: [20, 0, 0], pickups: [{ item: 'coin', at: [8, 0, 0] }], hazards: [{ at: [12, 0, 0], damage: 25 }] },
    { ref: 'crypt-2', exit: [24, 0, 0], pickups: [{ item: 'key', at: [10, 4, 0] }] },
    { ref: 'crypt-3', exit: [18, 0, 0] },
  ],
};

describe('scaffoldGameFromKit', () => {
  it('produces a valid store, gated progression, and per-level game channels', () => {
    const out = scaffoldGameFromKit('dungeon-crawler', DUNGEON);
    // store is the kit's, and it validates as a game store
    expect(validateGameManifest({ kind: 'game', title: 'x', store: out.store, levels: out.gameLevels }).ok).toBe(true);
    // gated progression: level 2 gates on level 1, level 3 on level 2; level 1 is open
    expect(out.gameLevels[0].gate).toBeUndefined();
    expect(out.gameLevels[1].gate).toEqual({ completed: 'crypt-1' });
    expect(out.gameLevels[2].gate).toEqual({ completed: 'crypt-2' });
    // each level channel carries mechanics that lower cleanly against the kit's store
    for (const ref of Object.keys(out.levelChannels)) {
      const ch = out.levelChannels[ref];
      expect(ch.levelRef).toBe(ref);
      expect(() => composeMechanics(ch.mechanics, { player: 'hero', spawn: [0, 0, 2], fall: ch.fall, storeSchema: out.store })).not.toThrow();
    }
    // level 1 (with hazards) got the fail-on-death terminal; level 3 (bare) did not
    const l1 = out.levelChannels['crypt-1'].mechanics.map((m) => m.kind);
    expect(l1).toEqual(expect.arrayContaining(['reach-exit', 'collect', 'hazard-damage', 'fail-on-death']));
    const l3 = out.levelChannels['crypt-3'].mechanics.map((m) => m.kind);
    expect(l3).toEqual(['reach-exit']);
  });

  it('the scaffolded game assembles through resolveGame (levels stored with their channels)', () => {
    const out = scaffoldGameFromKit('dungeon-crawler', DUNGEON);
    // fake the level sketches the kit expects to exist (world + its game channel)
    const store = {};
    for (const ref of Object.keys(out.levelChannels)) {
      store[ref] = { manifest: { kind: 'controllable', entities: [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 2] } }], game: out.levelChannels[ref] } };
    }
    const manifest = { kind: 'game', title: DUNGEON.title, store: out.store, levels: out.gameLevels };
    const resolved = resolveGame(manifest, (r) => store[r] || null, (r) => `/api/sketches/${r}/world`);
    expect(resolved.levels.length).toBe(3);
    // the synthesized contract carries the grant produces + the audits (for auto-audit)
    expect(resolved.levels[0].contract.produces.events.some((e) => e.type === 'grant')).toBe(true);
    expect(resolved.levels[0].contract.audits.some((a) => a.kind === 'walkto')).toBe(true);
  });

  it('collectathon (linear) has no gates; survival-arena builds survive+fail terminals', () => {
    const coll = scaffoldGameFromKit('collectathon', { title: 'C', levels: [{ ref: 'g1', exit: [10, 0, 0], pickups: [{ item: 'gem', at: [4, 0, 0] }] }, { ref: 'g2', exit: [12, 0, 0] }] });
    expect(coll.gameLevels.every((l) => !l.gate)).toBe(true);   // linear → no gates
    const arena = scaffoldGameFromKit('survival-arena', { title: 'A', levels: [{ ref: 'a1', seconds: 20, hazards: [{ at: [3, 0, 0] }] }] });
    expect(arena.levelChannels.a1.mechanics.map((m) => m.kind)).toEqual(expect.arrayContaining(['survive', 'fail-on-death', 'hazard-damage']));
  });

  it('throws on an unknown kit or a level missing its ref', () => {
    expect(() => scaffoldGameFromKit('roguelike', DUNGEON)).toThrow(/unknown game kit/);
    expect(() => scaffoldGameFromKit('dungeon-crawler', { levels: [{ exit: [1, 0, 0] }] })).toThrow(/needs a ref/);
  });
});

describe('kit vocab cards (generated from the registry)', () => {
  it('one card per kit, each carrying store + a worked example', () => {
    const cat = getKitVocabCatalog();
    for (const id of KIT_IDS) expect(cat.has(id), id).toBe(true);
    const card = cat.get('dungeon-crawler');
    expect(card.body).toMatch(/reach-exit|create_game/);
    expect(card.body).toMatch(/"kind": "progression"/);
    for (const row of listKitVocab()) {
      expect(row.summary.length).toBeGreaterThan(20);
      expect(row.when.length).toBeGreaterThan(15);
    }
  });

  it('the registry and the card catalog agree (no drift)', () => {
    expect([...getKitVocabCatalog().keys()].sort()).toEqual([...KIT_IDS].sort());
    expect(listKits().map((k) => k.id).sort()).toEqual([...KIT_IDS].sort());
    expect(getKit('dungeon-crawler').progression).toBe('gated');
  });
});
