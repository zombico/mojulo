// lit-handoff.plan.md step 1 — export_model({ lit: true }) is the lit handoff: an
// unshaded payload under real PBR materials. glb only.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-lit-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';

const CYLINDER = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };
const glbJson = (bytes) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));

describe('export_model lit', () => {
  it('writes a lit GLB and says so; the default stays unlit', async () => {
    SketchRepository.create({ ref: 'sk_lit_cyl', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const lit = await exportModelHandler({ ref: 'sk_lit_cyl', format: 'glb', lit: true });
    expect(lit.ok).toBe(true);
    expect(lit.lit).toBe(true);
    expect(lit.lit_note).toMatch(/pbrMetallicRoughness/);
    const j = glbJson(readFileSync(lit.path));
    expect(j.extensionsUsed || []).not.toContain('KHR_materials_unlit');
    const plain = await exportModelHandler({ ref: 'sk_lit_cyl', format: 'glb' });
    expect(plain.lit).toBeUndefined();
    expect(glbJson(readFileSync(plain.path)).extensionsUsed).toContain('KHR_materials_unlit');
  });

  it('refuses lit on non-glb formats', async () => {
    SketchRepository.create({ ref: 'sk_lit_cyl2', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    await expect(exportModelHandler({ ref: 'sk_lit_cyl2', format: 'stl', lit: true })).rejects.toThrow(/glb/);
  });
});
