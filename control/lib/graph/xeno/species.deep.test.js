// The starter species, swept (the deep tier: `npm run test:deep`, and CI): every species, worn on each head by each pole,
// lowers into words the hero door takes (its appliances a list it wears, its face, its build and its colours in that
// head's own words, inside their ranges), so a species added to the table is held to it the day it lands. xeno.test.js
// keeps the laws on one species.
import { describe, it, expect } from 'vitest';
import { validateHeroSpec } from '../../mcp/tools/layered.js';
import { XENO_SPECIES_IDS, validateXenoHeaddress, wornHeaddress, xenoWorn } from './index.js';

const HEADS = { landmark: {}, anime: { head: 'anime' }, realistic: { form: 'realistic' } };

describe('every starter species', () => {
  it('lowers into words the hero door takes, on every head, for either pole', () => {
    for (const id of XENO_SPECIES_IDS) {
      expect(validateXenoHeaddress(wornHeaddress({ xenoSpecies: id })), id).toEqual([]);
      for (const [head, words] of Object.entries(HEADS)) for (const cast of ['female', 'male']) {
        const { xenoHeaddress: _x, ...spec } = xenoWorn({ cast, ...words, xenoSpecies: id });
        expect(validateHeroSpec(spec), `${id} on ${head} (${cast})`).toEqual([]);
      }
    }
  });
});
