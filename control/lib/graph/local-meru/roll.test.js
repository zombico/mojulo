/**
 * A rolled way up (roll.js): a meru's own tiers varied by a seed, kept only when the roll breaks no law the recipe's own
 * tiers keep. One preset per way up (chosen from the catalogue in code), a few seeds each.
 */
import { describe, expect, it } from 'vitest';

import { LOCAL_MERU_PRESETS } from './presets.js';
import { readLocalMeru, planLocalMeru, localMeruLaws } from './plan.js';
import { rollTiers } from './roll.js';

// the first preset whose tiers take each way up: a spiral, a stair, a climb
const VIAS = ['spiral', 'stair', 'climb'];
const viaOf = (t) => t.up?.via ?? (t.form === 'tower' ? 'climb' : 'spiral');
const CASES = [...new Set(VIAS.map((v) => Object.keys(LOCAL_MERU_PRESETS).find((p) => LOCAL_MERU_PRESETS[p].tiers.some((t) => viaOf(t) === v))))];
const SEEDS = [1, 2, 3];
const shape = (r) => readLocalMeru(r).tiers.map((t) => [t.form, t.sides ?? null, t.up.via]);
const broken = (r) => localMeruLaws(planLocalMeru(r)).filter((l) => !l.ok).map((l) => l.law);

describe('rollTiers: the way up varied by a seed', () => {
  it('covers every way up', () => {
    expect(new Set(CASES.flatMap((p) => readLocalMeru({ preset: p }).tiers.map((t) => t.up.via)))).toEqual(new Set(VIAS));
  });
  for (const preset of CASES) {
    it(`${preset}: one seed one way up, another seed another, the same tiers, no law the recipe keeps broken`, () => {
      const own = { preset }, rolls = SEEDS.map((s) => rollTiers(own, s));
      expect(rollTiers(own, 2)).toEqual(rolls[1]);
      expect(new Set(rolls.map((r) => JSON.stringify(r.tiers))).size).toBeGreaterThan(1);
      const keeps = new Set(localMeruLaws(planLocalMeru(own)).filter((l) => l.ok).map((l) => l.law));
      for (const r of rolls) {
        expect(shape(r)).toEqual(shape(own));
        expect(broken(r).filter((l) => keeps.has(l))).toEqual([]);
      }
    });
  }
  it('keeps the rest of the recipe, and rolls the older words as tiers', () => {
    const r = rollTiers({ preset: 'mountain-lookout', island: { walk: 'all' }, approach: 3 }, 5);
    expect(r).toMatchObject({ island: { walk: 'all' }, approach: 3 });
    expect(r.preset).toBeUndefined();
    const old = rollTiers({ mound: { height: 10 }, path: { turns: 1.5 }, tower: {} }, 5);
    expect(old.mound).toBeUndefined();
    expect(shape(old)).toEqual(shape({ mound: { height: 10 }, path: { turns: 1.5 }, tower: {} }));
  });
});
