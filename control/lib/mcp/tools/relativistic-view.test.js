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

const SUN = { law: 'schwarzschild', mass: '1 M☉' };
const MERCURY = { model: { system: 'orbit', laws: [SUN, { law: 'body', id: 'mercury', at: ['46001200 km', 0, 0], v: [0, '58.98 km/s', 0] }], duration: '1 yr' } };
const HOLE = { model: { system: 'light', laws: [{ law: 'schwarzschild', mass: '10 M☉' }, { law: 'observer', distance: '30 Rs', inclination: '75°' }, { law: 'disk', outer: '12 Rs' }] } };

describe("create_view({ kind: 'relativistic' }): a science world, end to end", () => {
  it('mints the recipe as given and returns the machine gate, naming the shader a light world is drawn by', async () => {
    const r = await createViewHandler({ kind: 'relativistic', params: HOLE, title: 'a black hole' });
    expect(r.recipe).toEqual({ kind: 'relativistic-view', ...HOLE, title: 'a black hole' });
    expect(r.gates.find((g) => g.id === 'closed-form:shadow').ok).toBe(true);
    expect(r.note).toMatch(/shader conformance gate/);
    const o = await createViewHandler({ kind: 'relativistic', params: MERCURY });
    expect(o.note).not.toMatch(/shader/);
    expect(o.gates.find((g) => g.id === 'closed-form:advance:mercury').ok).toBe(true);
  });

  it('renders a light world as a shader layer on an orbit-only World, its probe only on a capture run', async () => {
    const manifest = { kind: 'relativistic-view', ...HOLE };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('object');
    const { payload } = await resolveWorldScene({ manifest, title: null });
    expect(payload.effects).toHaveLength(1);
    expect(emitThreeWorld({ ...payload, inline: true })).not.toContain('__sciProbe');
    expect(emitThreeWorld({ ...payload, inline: true, capture: true })).toContain('window.__sciProbe');
  });

  it('reads an orbit back in SI through measure_view, and the reviewer recomputes what the mint reported', async () => {
    const minted = await createViewHandler({ kind: 'relativistic', params: MERCURY });
    const m = await measureViewHandler({ ref: minted.ref, every: 40 });
    expect(m.tier).toBe('si');
    expect(m.series[0].name).toBe('mercury');
    expect(m.series[0].samples[0].r).toBeCloseTo(46001200e3, -3);
    expect(m.observed.mercury['advance per century'].unit).toBe('″');
    expect(recomputeViewStats(SketchRepository.getByRef(minted.ref).manifest)).toEqual(minted.stats);
  });

  it('points a bad recipe at its card', async () => {
    await expect(createViewHandler({ kind: 'relativistic', params: { model: { ...HOLE.model, system: 'wormhole' } } }))
      .rejects.toThrow(/one of light, orbit, clocks.*get_view_vocab\(\{ id: 'relativistic' \}\)/);
  });
});
