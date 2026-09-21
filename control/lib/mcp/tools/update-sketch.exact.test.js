// field-exact: the EDIT path readies the kernel before its synchronous plan gate, and the export
// ledger reads an exact cut as exact. Before this the first update_sketch of an `exact: true` row
// in a fresh process (a restarted dashboard) refused with "the exact kernel is not loaded", while
// the mint and the world resolve had their awaits — reproduced on the live flange, 2026-09-21.
// This file runs in its own module registry, so the kernel is COLD when the update runs.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-exact-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';
import { updateSketchHandler } from './sketches.js';
import { exactKernelReady } from '@/lib/graph/polygonizer/field-exact';

// the package's presence only — importing it registers nothing, so the kernel stays cold
let hasKernel = true;
try { await import('manifold-3d'); } catch { hasKernel = false; }

const flange = { id: 'flange', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }], material: 'steel' };
const bore = (id, x, y, r) => ({ id, path: [[x, y, -1], [x, y, 3]], radius: r });
const RECIPE = {
  kind: 'workbench', units: 'cm',
  lathes: [flange],
  sweeps: [bore('bore', 0, 0, 1.2), bore('b1', 4.5, 0, 0.45), bore('b2', -4.5, 0, 0.45), bore('b3', 0, 4.5, 0.45)],
  cuts: [{ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2', 'b3'], exact: true, segments: 64 }],
};

describe('update_sketch on an exact row — the kernel is cold when the edit arrives', () => {
  it('readies the kernel before the plan gate; the export ledger reads the cut as exact', async () => {
    if (!hasKernel) return;
    SketchRepository.create({ title: 'exact flange', manifest: RECIPE, ref: 'sk_exact_flange' });
    expect(exactKernelReady()).toBe(false);
    const r = await updateSketchHandler({ ref: 'sk_exact_flange', patch: [{ op: 'set', path: '/cuts/0/segments', value: 32 }] });
    expect(r.ok).toBe(true);
    expect(exactKernelReady()).toBe(true);
    expect(SketchRepository.getByRef('sk_exact_flange').manifest.cuts[0].segments).toBe(32);

    const stl = await exportModelHandler({ ref: 'sk_exact_flange', format: 'stl', write: false });
    expect(stl.ok).toBe(true);
    expect(stl.field_solids.count).toBe(1);
    expect(stl.field_solids.exact).toBe(1);
    expect(stl.field_solids.cells).toBeUndefined();          // no grid
    expect(stl.field_solids.edge_rounding).toBeUndefined();  // no rounding
    expect(stl.field_solids.cuts).toEqual([{ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2', 'b3'], cells: 64, exact: true, edge_rounding: 0 }]);
    expect(stl.field_solids.note).toMatch(/Every field solid here is `exact: true`/);
    expect(stl.size_mm[0]).toBeCloseTo(120, 6);   // a 12 cm disc prints at 120.000 mm, not 119.x
  });
});
