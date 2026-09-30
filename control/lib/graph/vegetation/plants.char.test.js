/**
 * grown-plant characterization net: one hash per species' pool (one variant, seed 't', to L1, unlit and lit), and the
 * terrain page channel for a composed world without and with plants (its data; the kernels' source text is left out,
 * since a bundler's transform reprints a function).
 *
 * A terrain or painted world grows its plants on every read, so the growth engine's default path is a compatibility
 * promise over minted recipes. The pins were captured at a49d474 (before the aerial-root, grass and region lines) and
 * checked equal at their tip; the self-comparison tests beside them (ficus, grass, terrain-plants) only show
 * determinism. Re-pin ONLY alongside a change that says a species' growth or the channel's emission changes.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { plantPool } from './pool.js';
import { assembleTerrainWorld } from '../terrain/terrain-world.js';
import { makeLight } from '../polygonizer/vexar.js';

const h = (v) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16);
const noSource = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && /^function[\s*]/.test(x) ? 'fn' : x));
const LIGHT = makeLight({ direction: [-0.5, -0.32, -0.8], ambient: 0.56, diffuse: 0.56 });

const POOLS = {
  oak: ['c5851c572e526566', '4c2448e506ec5b70'],
  beech: ['74909ededd5fe69b', 'c0bc5d3d5cd3ff9c'],
  fir: ['53c9e737f225c476', '2994f6041e29634b'],
  schefflera: ['513879ffe50dbddc', '58b43fa5667e80c7'],
  coconut: ['a14977e2d8cc1ff0', '672b9832bac7ada1'],
  vulgaris: ['543915f8e1eb620d', '7a2037ef2e515350'],
};

describe('grown plants keep their bytes', () => {
  it.each(Object.keys(POOLS))('%s: its pool, unlit and lit', (species) => {
    const pool = (light) => plantPool({ species, variants: 1, seed: 't', maxLevel: 'L1', ...(light ? { light } : {}) });
    expect([h(pool(null)), h(pool(LIGHT))]).toEqual(POOLS[species]);
  }, 60_000);
  it('the terrain page channel, without plants and with them', () => {
    const W = { kind: 'terrain', world: { features: [{ feature: 'lake', size: 'tarn' }], climate: 'alpine', seed: 'golden' } };
    expect(h(noSource(assembleTerrainWorld(W, { live: true }).terrain))).toBe('6dccdaca111730cc');
    expect(h(noSource(assembleTerrainWorld({ ...W, plants: { variants: 1, level: 'L1' } }, { live: true }).terrain))).toBe('4fe1f2be3ad77788');
  }, 120_000);
});
