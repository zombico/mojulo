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
import { withPngPixels } from '../../util/png-pixels.fixture.js';

// a pool's bark and the terrain's textures hash by their pixels: Node builds compress them differently (util/png-pixels.fixture.js)
const h = (v) => createHash('sha256').update(withPngPixels(typeof v === 'string' ? v : JSON.stringify(v))).digest('hex').slice(0, 16);
const noSource = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && /^function[\s*]/.test(x) ? 'fn' : x));
const LIGHT = makeLight({ direction: [-0.5, -0.32, -0.8], ambient: 0.56, diffuse: 0.56 });

const POOLS = {
  oak: ['aaeba7b40f7e2d7b', 'f72a3a618035df7d'],
  beech: ['2e547c606206ba4d', '3db208a89f423505'],
  fir: ['3d00f55bdceebc05', 'e79ed8ecca2a42b9'],
  schefflera: ['9641eaac4024dc5d', 'b3a4934fe6d7151b'],
  coconut: ['08c549586186bf48', '7ad5dd3327e2e17e'],
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
    expect(h(noSource(assembleTerrainWorld({ ...W, plants: { variants: 1, level: 'L1' } }, { live: true }).terrain))).toBe('8cd9fb472dd4ee00');
  }, 120_000);
});
