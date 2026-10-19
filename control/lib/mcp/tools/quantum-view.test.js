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

const TUNNEL = {
  model: {
    system: 'line', line: { length: '100 nm', points: 2048 },
    laws: [{ law: 'barrier', height: '0.3 eV', width: '1 nm' }],
    state: { packet: { at: '-10 nm', width: '2.5 nm', energy: '0.2 eV' } }, duration: '120 fs',
  },
};

describe("create_view({ kind: 'quantum' }): a science world, end to end", () => {
  it('mints the recipe as given and returns the machine gate', async () => {
    const r = await createViewHandler({ kind: 'quantum', params: TUNNEL, title: 'tunnelling' });
    expect(r.recipe).toEqual({ kind: 'quantum-view', ...TUNNEL, title: 'tunnelling' });
    expect(r.gates.find((g) => g.id === 'closed-form:transmission').ok).toBe(true);
    expect(r.observed.transmitted.value).toBeGreaterThan(0.1);
    expect(r.note).toMatch(/Machine gate only/);
  });

  it('renders as an orbit-only World with the science block', async () => {
    const manifest = { kind: 'quantum-view', ...TUNNEL };
    expect(sketchRenderMode(manifest)).toBe('world');
    expect(classifyBucket(manifest)).toBe('object');
    const { payload } = await resolveWorldScene({ manifest, title: null });
    expect(payload.science.rows.map((r) => r.html)).toEqual(['⟨E⟩', '⟨x⟩', 'spread', 'beyond the barrier']);
    expect(emitThreeWorld({ ...payload, inline: true })).toContain('stepScience(t)');
  });

  it('reads back through measure_view per system, and the reviewer recomputes what the mint reported', async () => {
    const minted = await createViewHandler({ kind: 'quantum', params: TUNNEL });
    const m = await measureViewHandler({ ref: minted.ref, every: 40 });
    expect(m.tier).toBe('si');
    expect(m.system).toBe('line');
    expect(m.series[0].samples.every((s) => Math.abs(s.norm - 1) < 1e-8)).toBe(true);
    expect(m.sources.length).toBeGreaterThan(0);
    expect(recomputeViewStats(SketchRepository.getByRef(minted.ref).manifest)).toEqual(minted.stats);
    const atom = await createViewHandler({ kind: 'quantum', params: { model: { system: 'atom', laws: [{ law: 'hydrogen' }], state: { orbitals: [{ n: 2, l: 0, m: 0 }] }, samples: 400 } } });
    const a = await measureViewHandler({ ref: atom.ref, every: 100 });
    expect(a.series[0].name).toBe('2s');
    expect(Math.abs(a.series[0].measuredMeanRadius - a.series[0].meanRadius) / a.series[0].meanRadius).toBeLessThan(0.1);
  });

  it('points a bad recipe at its card', async () => {
    await expect(createViewHandler({ kind: 'quantum', params: { model: { ...TUNNEL.model, system: 'string' } } }))
      .rejects.toThrow(/one of line, atom, spin, decay.*get_view_vocab\(\{ id: 'quantum' \}\)/);
  });
});
