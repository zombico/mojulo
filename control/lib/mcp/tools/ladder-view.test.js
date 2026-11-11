process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createViewHandler } from './create-view.js';
import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

beforeEach(() => { closeDb(); });

const LADDER = { rungs: [
  { id: 'drop', label: 'A steel ball dropped', simulated: { kind: 'classical', model: {
    bodies: [{ id: 'ball', matter: 'steel', radius: '5 cm', at: [0, 0, 1] }], laws: [{ law: 'gravity-uniform' }, { law: 'plane' }], duration: 1 } } },
  { below: { rung: 'drop', body: 'ball' } },
] };

describe("create_exhibit({ id: 'science/ladder' }): a ladder of scales, end to end", () => {
  it('mints the recipe as given, reports every rung and its gates, and renders one page with a crumb per rung', async () => {
    const r = await createViewHandler({ kind: 'ladder', params: LADDER });
    expect(r.recipe.kind).toBe('ladder-view');
    expect(r.rungs.map((x) => x.status)).toEqual(['simulated', 'explained', 'depicted', 'explained', 'explained']);
    expect(r.held).toBe(true);
    expect(r.gates.some((g) => g.id === 'drop/energy-never-gained')).toBe(true);
    const sketch = SketchRepository.getByRef(r.ref);
    expect(sketch.manifest.rungs).toEqual(LADDER.rungs);
    expect(sketchRenderMode(sketch.manifest)).not.toBe('svg');
    const { payload } = await resolveWorldScene(sketch);
    expect(payload.science.ladder.crumbs).toHaveLength(5);
    const html = emitThreeWorld(payload);
    expect(html).toContain('A steel ball dropped');
  });

  it('refuses a stray field', async () => {
    await expect(createViewHandler({ kind: 'ladder', params: { ...LADDER, model: {} } })).rejects.toThrow(/unknown field 'model'/);
  });
});
