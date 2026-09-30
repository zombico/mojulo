/**
 * grown-plant characterization net: one hash per species' pool (one variant, seed 't', to L1, unlit and lit), and the
 * terrain page channel for a composed world without and with plants (its data; the kernels' source text is left out,
 * since a bundler's transform reprints a function).
 *
 * A terrain or painted world grows its plants on every read, so the growth engine's default path is a compatibility
 * promise over minted recipes. The pins were captured at a49d474 (before the aerial-root, grass and region lines) and
 * checked equal at their tip; the self-comparison tests beside them (ficus, grass, terrain-plants) only show
 * determinism. They were re-pinned when the growth engine and the terrain world took their transcendentals from
 * lib/util/dmath.js, which gives these bytes on every CPU and Node version (the earlier pins were macOS arm64's on
 * Node 24, and no other platform grew them). Re-pin ONLY alongside a change that says a species' growth or the
 * channel's emission changes.
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
  oak: ['625e6a0db2b6ce27', '02c0e3e50599282b'],
  beech: ['c1a57167e93963aa', '3bf8a1438fcb8cbc'],
  fir: ['9d5ee347655cec4e', '60a0a605bbacdf4a'],
  schefflera: ['78de85942741b097', '5fbd29de5d48950d'],
  coconut: ['623478a079a65197', '2eebf6c673ac1140'],
  vulgaris: ['13d46384deb36cb6', '4c9668eaa30f053e'],
};

describe('grown plants keep their bytes', () => {
  it.each(Object.keys(POOLS))('%s: its pool, unlit and lit', (species) => {
    const pool = (light) => plantPool({ species, variants: 1, seed: 't', maxLevel: 'L1', ...(light ? { light } : {}) });
    expect([h(pool(null)), h(pool(LIGHT))]).toEqual(POOLS[species]);
  }, 60_000);
  it('the terrain page channel, without plants and with them', () => {
    const W = { kind: 'terrain', world: { features: [{ feature: 'lake', size: 'tarn' }], climate: 'alpine', seed: 'golden' } };
    expect(h(noSource(assembleTerrainWorld(W, { live: true }).terrain))).toBe('91ba2043f00b8c5b');
    expect(h(noSource(assembleTerrainWorld({ ...W, plants: { variants: 1, level: 'L1' } }, { live: true }).terrain))).toBe('4704c5b175ffd28b');
  }, 120_000);
});
