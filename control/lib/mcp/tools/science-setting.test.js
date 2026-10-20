process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { composeWorld } from './compose-world.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

// A science demo stood in a real world through compose_world (the e2e tier: it makes a whole world).
beforeEach(() => { closeDb(); });

const BALL = { kind: 'classical', at: [0, 0, 0], ground: 'from-world', model: { bodies: [{ id: 'ball', mass: 0.45, radius: 0.11, at: [0, 0, 2], v: [1, 0, 3] }], laws: [{ law: 'gravity-uniform' }], duration: 2 } };

describe("compose_world({ overrides: { science } }): a demo in a world", () => {
  it('solves the demo at mint, stores it on the world, and the world page carries its readout, panel and gates', async () => {
    const r = composeWorld({ base: 'school', overrides: { science: BALL }, title: 'a ball in the school' });
    expect(r.science.held).toBe(true);
    expect(r.science.standsAs).toBe('1:1');
    expect(r.science.note).toMatch(/checked when the world renders/);
    const sk = SketchRepository.getByRef(r.ref);
    expect(sk.manifest.science.kind).toBe('classical');
    const { payload } = await resolveWorldScene({ manifest: sk.manifest, title: sk.title });
    expect(payload.cameras[0].name).toBe('demo');
    const checks = payload.science.honesty.sections.find((s) => s.head === 'Checked by the solver').items.map((i) => i.text);
    expect(checks.some((t) => /passes through the world's surfaces/.test(t))).toBe(true);
    expect(payload.movers.some((m) => m.group === 'sci:body:ball')).toBe(true);
  }, 120000);

  it('stamps the setting from the theme, and a bad model refuses the mint, teaching', () => {
    const mars = composeWorld({ base: 'school', theme: 'mars-colony', overrides: { science: BALL } });
    expect(SketchRepository.getByRef(mars.ref).manifest.science.setting).toBe('mars');
    expect(mars.science.gates.find((g) => g.id === 'setting-agrees').ok).toBe(false);   // Earth's g on Mars
    expect(() => composeWorld({ base: 'school', overrides: { science: { ...BALL, model: { ...BALL.model, duration: '2 kg' } } } })).toThrow(/wants a time.*science-setting/);
  }, 120000);
});
