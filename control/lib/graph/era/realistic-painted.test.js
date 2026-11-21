/**
 * REALISTIC TREES PAINTED (era/isekai.js realisticBands): a gen-6 trail's `crowns: 'realistic'` draws the trees the form
 * render keeps (form/flora-read.js realisticPlan), from their templates' own structure, as painted faces: the hero near
 * built whole, the rest stamped from turned variants. One stand of trees in both eras; a trail without the word as it was.
 */
import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { realisticPlan } from '../form/flora-read.js';
import { REAL_BANDS } from './isekai.js';

const M = { kind: 'stage', kit: 'isekai-meadow', seed: 5 };

describe('realistic trees painted (gen-6)', () => {
  it('draws the form render\'s own stand: the same trees at the same places and heights, built near and stamped past', () => {
    const six = assembleStageScene({ ...M, crowns: 'realistic' }), seven = assembleStageScene({ ...M, crowns: 'realistic' }, { form: true });
    const plan = realisticPlan(seven.plants), want = plan.map(({ i, h }) => [seven.plants.trees[i].x, seven.plants.trees[i].y, h]);
    const R = six.realistic, key = (q) => `${q[0].toFixed(2)},${q[1].toFixed(2)},${q[2].toFixed(2)}`;
    expect(R.trees.length).toBeGreaterThan(0);
    expect(R.trees.map(key).sort()).toEqual(want.map(key).sort());
    // (the near built whole, the rest stamped: every tree drawn once, each stamp from one of its template's variants)
    const stamped = (six.repeats ?? []).reduce((a, r) => a + r.transforms.length, 0);
    expect(R.built + stamped).toBe(R.trees.length);
    expect((six.repeats ?? []).length).toBeLessThanOrEqual(new Set(plan.map((p) => p.T)).size * REAL_BANDS.variants);
    // (its wood the template's chains as tubes, its crown the puffs)
    expect(six.faces.some((f) => f.group === 'isekai:wood')).toBe(true);
    // (without the word: no realistic trees, no readout)
    expect(assembleStageScene(M).realistic).toBeUndefined();
  }, 300000);
});
