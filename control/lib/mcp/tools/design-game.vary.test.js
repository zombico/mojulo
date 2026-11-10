// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK_HERO } from '@/lib/graph/gameworld/index';

// A department's variations (design_game { ref, vary }): a mangekyou order over a game, routed to the department whose
// chapter owns what it varies, answered as proposals; nothing is written until a variant's patch is taken.

const GATED = { ...MEADOWMARK_HERO, mode: 'gated' };
// a pinned roll: an order's dice are drawn at the door, so an unpinned test is a different kaleidoscope every run (one
// roll in a few hundred lifts most of a late tier's ornaments past their 0–3 scale and the gate leaves fewer than n)
const ROLL = 7919;

describe('design_game: vary', () => {
  beforeEach(() => { closeDb(); });

  it("a chapter's variations: routed to its department, proposals only, the game unwritten", async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const before = SketchRepository.getByRef('gw').manifest;
    const out = await designGameHandler({ ref: 'gw', chapter: 'equipment', vary: { concept: 'regal, then darker', n: 3, roll: ROLL } });
    expect(out.vary.order).toMatchObject({ by: 'characters', at: '/equipment', team: { department: 'characters', keep: 'design_game' } });
    expect(out.vary.variants).toHaveLength(3);
    for (const v of out.vary.variants) for (const op of v.patch) expect(op.path.startsWith('/equipment/')).toBe(true);
    expect(SketchRepository.getByRef('gw').manifest).toEqual(before);
    expect(out.next).toMatch(/patch/);
  });

  it('a pass is carried by patches, and a taken variant is a patch like any other', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const first = await designGameHandler({ ref: 'gw', vary: { at: '/characters/hero', n: 2, roll: ROLL } });
    expect(first.vary.order.team.department).toBe('characters');
    const next = await designGameHandler({ ref: 'gw', vary: { at: '/characters/hero', n: 2, keep: [first.vary.variants[0].patch], roll: first.vary.order.roll } });
    expect(next.vary.order.pass.kept).toBe(1);
    const taken = await designGameHandler({ ref: 'gw', patch: next.vary.variants[0].patch });
    expect(taken.ref).toBe('gw');
    const stored = SketchRepository.getByRef('gw').manifest;
    for (const op of next.vary.variants[0].patch) expect(op.path.split('/').slice(1).reduce((v, k) => v[k], stored)).toEqual(op.value);
  });

  it('vary goes alone with its ref', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    await expect(designGameHandler({ ref: 'gw', vary: {}, run: true })).rejects.toThrow(/vary goes with a ref/);
    await expect(designGameHandler({ vary: {} })).rejects.toThrow(/vary goes with a ref/);
    await expect(designGameHandler({ ref: 'gw', vary: { keep: ['v1'] } })).rejects.toThrow(/variant patches/);
  });
});
