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

const PENDULUM = {
  model: {
    bodies: [{ id: 'bob', mass: 1, radius: 0.05, at: [0.866, 0, 0.5] }],
    laws: [{ law: 'gravity-uniform' }, { law: 'rod', between: ['bob', [0, 0, 1]] }],
    duration: 6, observe: ['energy', { quantity: 'period', of: 'bob' }],
  },
  liberties: [{ what: 'the rod is drawn thick', why: 'to read from the back of the room' }],
};

describe("create_view({ kind: 'classical' }): a science world, end to end", () => {
  it('mints the recipe as given, returns the machine gate, and says nobody has looked', async () => {
    const r = await createViewHandler({ kind: 'classical', params: PENDULUM, title: 'wide pendulum' });
    expect(r.ok).toBe(true);
    expect(r.recipe).toEqual({ kind: 'classical-view', ...PENDULUM, title: 'wide pendulum' });
    expect(r.held).toBe(true);
    expect(r.gates.find((g) => g.id === 'closed-form:pendulum').ok).toBe(true);
    expect(r.liberties.map((l) => l.what)).toContain('the rod is drawn thick');
    expect(r.note).toMatch(/Machine gate only/);
    // only the recipe is stored: no tracks, no geometry
    const stored = SketchRepository.getByRef(r.ref).manifest;
    expect(stored.tracks).toBeUndefined();
    expect(JSON.stringify(stored).length).toBeLessThan(600);
  });

  it('renders as an orbit-only World with the science block, and adds nothing to a page without it', async () => {
    const manifest = { kind: 'classical-view', ...PENDULUM };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('object');
    const { payload } = await resolveWorldScene({ manifest, title: null });
    expect(payload.cameras.length).toBeGreaterThan(0);
    expect(payload.science.honesty.sections.find((s) => s.head === 'Drawn, not real').items.map((i) => i.text)).toContain('the rod is drawn thick');
    const html = emitThreeWorld({ ...payload, inline: true });
    expect(html).toContain('stepScience(t)');
    const bare = emitThreeWorld({ ...payload, science: undefined, inline: true });
    expect(bare).not.toContain('science channel');
    expect(emitThreeWorld({ ...payload, science: null, inline: true })).toBe(bare);
  });

  it('reads back in SI through measure_view, and recomputes its stats the same way twice', async () => {
    const { ref } = await createViewHandler({ kind: 'classical', params: PENDULUM });
    const m = await measureViewHandler({ ref, every: 10 });
    expect(m.tier).toBe('si');
    expect(m.series.map((s) => s.name)).toEqual(['bob', 'system']);
    expect(m.series[1].samples[0]).toHaveProperty('e');
    const manifest = SketchRepository.getByRef(ref).manifest;
    // the reviewer recomputes exactly what the mint reported
    expect(recomputeViewStats(manifest)).toEqual((await createViewHandler({ kind: 'classical', params: PENDULUM })).stats);
    expect(recomputeViewStats(manifest).held).toBe(true);
  });

  it('points a bad recipe at its card, and rejects a model field put beside the model', async () => {
    await expect(createViewHandler({ kind: 'classical', params: { model: { ...PENDULUM.model, bodies: [{ id: 'bob', mass: '1 m', at: [0, 0, 0] }] } } }))
      .rejects.toThrow(/wants a mass.*get_view_vocab\(\{ id: 'classical' \}\)/);
    await expect(createViewHandler({ kind: 'classical', params: { ...PENDULUM, duration: 3 } })).rejects.toThrow(/unknown field 'duration'/);
    await expect(createViewHandler({ kind: 'classical', params: { ...PENDULUM, dress: { sparkle: true } } })).rejects.toThrow(/unknown field 'sparkle'/);
  });
});
