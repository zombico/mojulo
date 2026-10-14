import { describe, it, expect } from 'vitest';
import { rollEgocube } from './egocube.js';
import { planFromSheet } from './plan.js';
import { LINEAGES, HUMAN_IDS } from './ancestry.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { validateHeroSpec } from '@/lib/mcp/tools/layered.js';

// the exhaustive sweep: every people over ten seeds, through the door its sheet names
describe('planFromSheet, every people over ten seeds', () => {
  for (const anc of [...Object.keys(LINEAGES), ...HUMAN_IDS]) it(anc, () => {
    for (let seed = 1; seed <= 10; seed++) {
      const p = planFromSheet(rollEgocube({ seed, facets: { ancestry: anc } }));
      if (p.door === 'creature') expect(() => expandPlan(p.create.spec.plan), `seed ${seed}`).not.toThrow();
      else expect(validateHeroSpec(p.create.spec), `seed ${seed}`).toEqual([]);
    }
  }, 120000);
});
