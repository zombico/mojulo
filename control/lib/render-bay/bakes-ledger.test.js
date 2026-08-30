process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * The bake ledger IS the sketch store. `bake-world-gi.mjs` stamps `giBake` on the
 * sketch it produced rather than writing a table of its own, so the Render Bay's
 * bakes lane is a read over manifests — and it must find both adapters, because
 * they leave their mark in two different places.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { bakeGates, bakePrompt, bakeViewHref } from './lanes.js';

beforeEach(() => { closeDb(); });

const world = (over = {}) => ({ kind: 'fractal-city', seed: 1, ...over });

describe('SketchRepository.giBakes', () => {
  it('finds nothing in a workshop that has never baked', () => {
    SketchRepository.create({ title: 'City', manifest: world() });
    expect(SketchRepository.giBakes()).toEqual([]);
  });

  it('finds an inline-faces bake, which recoloured the world in place', () => {
    SketchRepository.create({
      ref: 'sk_arena',
      title: 'Arena',
      manifest: world({
        kind: 'painted-landscape',
        faces: [],
        giBake: { adapter: 'inline-faces', preset: 'exterior', bakedAt: '2026-08-01T00:00:00.000Z', matchRate: 0.91, floorBlackFrac: 0.02 },
      }),
    });
    const [bake] = SketchRepository.giBakes();
    expect(bake.ref).toBe('sk_arena');
    expect(bake.manifest.giBake.adapter).toBe('inline-faces');
  });

  it('finds a generated-mesh bake, which lives in its own _gi variant', () => {
    SketchRepository.create({ ref: 'sk_city', title: 'City', manifest: world() });
    SketchRepository.create({
      ref: 'sk_city_gi',
      title: 'City (GI)',
      manifest: world({
        giBake: { adapter: 'generated-mesh', from: 'sk_city', preset: 'interior-day', bakedAt: '2026-08-02T00:00:00.000Z', meshN: 1 },
      }),
    });
    const refs = SketchRepository.giBakes().map((s) => s.ref);
    expect(refs).toEqual(['sk_city_gi']);   // the source world is not itself a bake
  });

  it('orders newest bake first, by when it was baked rather than when it was minted', () => {
    SketchRepository.create({
      ref: 'sk_old', title: 'Old',
      manifest: world({ giBake: { adapter: 'inline-faces', bakedAt: '2026-01-01T00:00:00.000Z' } }),
    });
    SketchRepository.create({
      ref: 'sk_new', title: 'New',
      manifest: world({ giBake: { adapter: 'inline-faces', bakedAt: '2026-08-01T00:00:00.000Z' } }),
    });
    expect(SketchRepository.giBakes().map((s) => s.ref)).toEqual(['sk_new', 'sk_old']);
  });

  it('reads the two gates off a real stored bake without conflating them', () => {
    SketchRepository.create({
      ref: 'sk_city_gi', title: 'City (GI)',
      manifest: world({
        giBake: { adapter: 'generated-mesh', from: 'sk_city', preset: 'space', bakedAt: '2026-08-02T00:00:00.000Z', matchRate: 0.88, floorBlackFrac: 0.04 },
      }),
    });
    const sketch = SketchRepository.giBakes()[0];
    const row = { ref: sketch.ref, ...sketch.manifest.giBake };
    const gates = bakeGates(row);
    expect(gates.machine.passed).toBe(true);
    expect(gates.machine.floorBlackFrac).toBe(0.04);
    expect(gates.eyes.recorded).toBe(false);
    expect(bakeViewHref(row)).toBe('/sketches/sk_city_gi?display=baked');
    expect(bakePrompt(row)).toContain('--ref sk_city ');
  });
});
