import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { WATERFALL_SCENARIOS, assembleWaterfallScene, planWaterfallScene } from './waterfall-view.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { waterAt } from '../materials/shallows.js';

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);

describe('waterfall-view (the falling-water primitive in a landscape)', () => {
  it('names three kinds and falls back to the veil', () => {
    expect(WATERFALL_SCENARIOS).toEqual(['veil', 'curtain', 'horsetail']);
    expect(planWaterfallScene({ scenario: 'niagara' }).stats.scenario).toBe('veil');
  });

  it('is deterministic: the same recipe is the same bytes; a new seed reshapes the land', () => {
    for (const scenario of WATERFALL_SCENARIOS) expect(hash(planWaterfallScene({ scenario, seed: 4 }))).toBe(hash(planWaterfallScene({ scenario, seed: 4 })));
    expect(hash(planWaterfallScene({ seed: 1 }).faces)).not.toBe(hash(planWaterfallScene({ seed: 2 }).faces));
  });

  it('the fall lands in its plunge pool, a sheet for a lip and a round spout for a notch', () => {
    for (const scenario of WATERFALL_SCENARIOS) {
      const p = planWaterfallScene({ scenario }), [jet] = p.jets, [pool] = p.shallows.bodies;
      expect(jet.into).toBe(pool.id);
      expect(jet.shape === 'sheet').toBe(scenario !== 'horsetail');
      // where it hits: the throw out from the cliff, under water
      const hitY = jet.at[1] - p.stats.throw;
      expect(waterAt([pool], jet.at[0], hitY)).not.toBeNull();
      expect(p.faces.every((f) => f.corners.every((c) => c.every(Number.isFinite)))).toBe(true);
    }
    expect(planWaterfallScene({ scenario: 'veil' }).stats.breakup).toBeLessThan(planWaterfallScene({ scenario: 'curtain' }).stats.breakup);
  });

  it('flow and scale reach the fall', () => {
    const a = planWaterfallScene({ flow: 4 }), b = planWaterfallScene({ scale: 2 });
    expect(a.jets[0].flow).toBe(4000);
    expect(a.stats.throw).toBeGreaterThan(planWaterfallScene({}).stats.throw);
    expect(b.jets[0].at[2]).toBeCloseTo(2 * planWaterfallScene({}).jets[0].at[2], 3);
    expect(assembleWaterfallScene({ scale: 2 }).metersPerUnit).toBe(0.5);
  });

  it('emits a page that runs the pool and the fall', () => {
    const page = emitThreeWorld({ ...assembleWaterfallScene({ scenario: 'curtain' }), inline: false });
    expect(page).toMatch(/stepShallows\(t\);/);
    expect(page).toMatch(/stepJets\(t\);/);
    expect(page).toMatch(/function sheetProfile/);
  });
});
