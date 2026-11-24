// A metro's outskirts in their register (register.js) as geocity/scene.js stands them: one small evoked district, its
// outskirts the streetcar suburb's and a West Coast tract's. The concept: what its register names is what stands (its
// street trees here); the suburb's card is the city it was.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from './scene.js';
import { outskirtsLook } from './register.js';
import { PATTERNS } from '../geotown/pattern.js';

const SPEC = { metro: { from: 'lakeshore', rings: { core: 160, frame: 330 } }, extent: [1300, 1100], water: { sides: ['s'], depth: 100 }, core: [0.5, 0.3], evoke: 'neighbourhood', at: 'A1' };
const city = (outskirts) => assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { ...SPEC, ...(outskirts ? { outskirts } : {}) } });
const treeSpecies = (P) => new Set((P.repeats ?? []).map((r) => r.group).filter((g) => g.startsWith('geocity:tree-')).map((g) => g.slice('geocity:tree-'.length).replace(/-L\d$/, '')));

describe('a metro\'s outskirts in their register', () => {
  it('its streets are planted with its register\'s trees: a West Coast\'s palms, the streetcar suburb\'s maples', () => {
    const suburb = treeSpecies(city()), west = treeSpecies(city('west-coast')), L = outskirtsLook(PATTERNS['west-coast']);
    expect([...west].every((sp) => [...L.trees.dense, ...L.trees.low, ...L.trees.sidewalk].includes(sp))).toBe(true);
    expect(west.has('washingtonia')).toBe(true);
    expect(suburb.has('washingtonia')).toBe(false);
    expect([...suburb].some((sp) => ['maple', 'beech', 'cherry'].includes(sp))).toBe(true);
  }, 120_000);
});
