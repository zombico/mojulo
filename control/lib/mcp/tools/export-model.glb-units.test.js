// launch-falls-short.plan.md P1 — the plain glTF lands at true size: a recipe's own `units`
// label reaches the payload (resolveWorldScene), the glTF root is scaled by it, the result
// reports it, and the Blender verify gate can check the imported size in metres.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-glb-units-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { compareUsdGate } from '@/lib/graph/scene/usd-gate.js';
import { glbNodeInventory } from '@/lib/graph/scene/blender-gate.js';
import { glbToScene } from '@/lib/graph/scene/scene-gltf-read.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene.js';
import { exportModelHandler } from './sketch-model-export.js';

const CYLINDER = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 6 },
  profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }],
};

function glbJson(file) {
  const b = readFileSync(file);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}
const rootNode = (json) => json.nodes[json.scenes[0].nodes[0]];

describe('export_model glb — the recipe unit reaches the root', () => {
  it('a cm workbench scales the mojulo root by 0.01 and reports it', async () => {
    SketchRepository.create({ ref: 'sk_glbu_cm', title: 'cm cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_glbu_cm'));
    expect(payload.metersPerUnit).toBe(0.01);
    const res = await exportModelHandler({ ref: 'sk_glbu_cm', format: 'glb' });
    expect(res.ok).toBe(true);
    expect(res.meters_per_unit).toBe(0.01);
    expect(Array.isArray(res.size_units)).toBe(true);
    expect(res.units_note).toContain("units:'cm'");
    const json = glbJson(res.path);
    const root = rootNode(json);
    expect(root.name).toBe('mojulo');
    expect(root.scale).toEqual([0.01, 0.01, 0.01]);
    expect(root.extras['moj:metersPerUnit']).toBe(0.01);
    // the Blender verify gate now has a real size check: the studio grid + cylinder read in metres
    const sizeM = res.size_units.map((v) => v * 0.01);
    const verdict = compareUsdGate({ exported: res, blender: { triangles: res.triangles, size: sizeM, vertex_colour_meshes: 1, cameras: res.cameras } });
    expect(verdict.checks.size_m.ok).toBe(true);
    expect(verdict.checks.size_m.meters_per_unit).toBe(0.01);
    // the contract inventory and the face reader both invert the root: recipe units come back
    const inv = glbNodeInventory(readFileSync(res.path));
    expect(inv.metersPerUnit).toBe(0.01);
    expect(inv.bounds.size.map((v) => Math.round(v * 100) / 100)).toEqual(res.size_units.map((v) => Math.round(v * 100) / 100));
    const back = glbToScene(readFileSync(res.path));
    expect(back.ledger.metersPerUnit).toBe(0.01);
    const zs = back.faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.round((Math.max(...zs) - Math.min(...zs)) * 100) / 100).toBe(res.size_units[2]);
    // and a 100× reader (the 9 m mug) now fails it loudly
    const wrong = compareUsdGate({ exported: res, blender: { triangles: res.triangles, size: res.size_units, vertex_colour_meshes: 1, cameras: res.cameras } });
    expect(wrong.checks.size_m.ok).toBe(false);
  });

  it('a label-less workbench is byte-identical: no root scale, no unit fields', async () => {
    SketchRepository.create({ ref: 'sk_glbu_none', title: 'unlabelled', manifest: { kind: 'workbench', lathes: [CYLINDER] } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_glbu_none'));
    expect(payload.metersPerUnit).toBeUndefined();
    const res = await exportModelHandler({ ref: 'sk_glbu_none', format: 'glb' });
    expect(res.ok).toBe(true);
    expect(res.meters_per_unit).toBeUndefined();
    expect(res.size_units).toBeUndefined();
    const root = rootNode(glbJson(res.path));
    expect(root.scale).toBeUndefined();
    expect(root.extras).toBeUndefined();
    const nullGate = compareUsdGate({ exported: res, blender: { triangles: res.triangles, size: [1, 1, 1], vertex_colour_meshes: 1 } });
    expect(nullGate.checks.size_m.ok).toBeNull();
  });

  it('metres leave the key unset; a recipe-level metersPerUnit still wins over the label', async () => {
    SketchRepository.create({ ref: 'sk_glbu_m', title: 'm cylinder', manifest: { kind: 'workbench', units: 'm', lathes: [CYLINDER] } });
    expect((await resolveWorldScene(SketchRepository.getByRef('sk_glbu_m'))).payload.metersPerUnit).toBeUndefined();
    SketchRepository.create({ ref: 'sk_glbu_both', title: 'both', manifest: { kind: 'workbench', units: 'cm', metersPerUnit: 0.5, lathes: [CYLINDER] } });
    expect((await resolveWorldScene(SketchRepository.getByRef('sk_glbu_both'))).payload.metersPerUnit).toBe(0.5);
  });
});
