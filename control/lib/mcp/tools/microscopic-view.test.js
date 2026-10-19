process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createViewHandler } from './create-view.js';
import { measureViewHandler, recomputeViewStats } from './measure-view.js';
import { sketchRenderMode, classifyBucket } from '@/lib/graph/sketch/sketch-manifest';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

beforeEach(() => { closeDb(); });

const MEMBRANE = {
  model: {
    box: { size: ['20 µm', '10 µm', '10 µm'] },
    species: [{ id: 'water', radius: '0.14 nm', count: 60, where: 'left' }, { id: 'sugar', radius: '0.5 nm', count: 60, where: 'left' }],
    laws: [{ law: 'brownian' }, { law: 'membrane', permeability: { water: '100 µm/s' } }],
    duration: '0.3 s', observe: ['counts', { quantity: 'sides', of: 'water' }],
  },
};

describe("create_view({ kind: 'microscopic' }): a science world, end to end", () => {
  it('mints the recipe as given and returns the machine gate', async () => {
    const r = await createViewHandler({ kind: 'microscopic', params: MEMBRANE, title: 'a selective membrane' });
    expect(r.recipe).toEqual({ kind: 'microscopic-view', ...MEMBRANE, title: 'a selective membrane' });
    expect(r.gates.find((g) => g.id === 'membrane-holds:sugar').ok).toBe(true);
    expect(r.observed['sides:water'].of).toBe(60);
    expect(r.note).toMatch(/Machine gate only/);
    expect(SketchRepository.getByRef(r.ref).manifest.tracks).toBeUndefined();
  });

  it('renders as an orbit-only World with the science block', async () => {
    const manifest = { kind: 'microscopic-view', ...MEMBRANE };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('object');
    const { payload } = await resolveWorldScene({ manifest, title: null });
    expect(payload.science.rows.map((r) => r.html)).toEqual(['water', 'sugar', 'water on the near side', 'sugar on the near side']);
    expect(emitThreeWorld({ ...payload, inline: true })).toContain('stepScience(t)');
  });

  it('reads back in SI through measure_view, and the reviewer recomputes what the mint reported', async () => {
    const minted = await createViewHandler({ kind: 'microscopic', params: MEMBRANE });
    const m = await measureViewHandler({ ref: minted.ref, every: 20 });
    expect(m.tier).toBe('si');
    expect(m.series.map((s) => s.name)).toEqual(['water', 'sugar']);
    expect(m.series[1].samples.every((s) => s.near[0] === 60)).toBe(true);   // the sugar never crosses
    expect(recomputeViewStats(SketchRepository.getByRef(minted.ref).manifest)).toEqual(minted.stats);
  });

  it('points a bad recipe at its card', async () => {
    await expect(createViewHandler({ kind: 'microscopic', params: { model: { ...MEMBRANE.model, box: { size: [1, 1] } } } }))
      .rejects.toThrow(/wants \[x, y, z\].*get_view_vocab\(\{ id: 'microscopic' \}\)/);
  });
});
