// grok-headless-affordances P5 — the override note tells the truth about LOWERED slots.
// The city theme adapter folds { context, asset, … } onto the recipe's top level
// (`context.depth` → `depth`, `asset.monument` → `landmark`), so the flat key check
// flagged `context` on every themed city mint even when every child had landed.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { composeWorld } from './compose-world.js';

const CONTEXT = { depth: 3, density: 0.82, baseScale: 0.7, locale: 'north-america', time: 'day' };

describe('compose_world override note — folded slots', () => {
  it('a context slot whose every child landed is reflected: no note (the Grok seed-91 city)', () => {
    const r = composeWorld({ base: 'city', seed: 91, overrides: { context: CONTEXT, region: { x: 0, y: 0, w: 36, d: 36 } } });
    expect(r.recipe.depth).toBe(3);
    expect(r.recipe.locale).toBe('north-america');
    expect(r.recipe.time).toBe('day');
    expect(r.note).toBeUndefined();
  });

  it('a slot child the adapter RENAMES (asset.monument → landmark) counts as reflected', () => {
    const r = composeWorld({ base: 'city', seed: 3, overrides: { asset: { monument: 'cn-tower', anchor: 'tower' } } });
    expect(r.recipe.landmark).toBeTruthy();
    expect(r.recipe.anchor).toBe('tower');
    expect(r.note).toBeUndefined();
  });

  it('a stray child is named as slot.child and the rest of the slot is reported as folded', () => {
    const r = composeWorld({ base: 'city', seed: 5, overrides: { context: { depth: 2, bogus: 1, time: 'noon' } } });
    expect(r.recipe.depth).toBe(2);
    expect(r.recipe.time).toBeUndefined();          // 'noon' is not a valid time → not stored → named
    expect(r.note).toMatch(/not reflected in the stored recipe: context\.bogus, context\.time/);
    expect(r.note).toMatch(/the rest of `context` folded onto the recipe's top level/);
    expect(r.note).not.toMatch(/: context\b[^.]/);  // never the whole slot when part of it landed
  });

  it('a slot whose every child missed is named whole; a flat unknown key stays named flat', () => {
    const r = composeWorld({ base: 'city', seed: 7, overrides: { context: { bogus: 1 }, bogus_knob: 1 } });
    expect(r.note).toMatch(/context, bogus_knob/);
    expect(r.note).not.toMatch(/folded/);
  });
});
