// interchange-seams.plan.md seam 2 — OpenUSD through export_model: usda writes its
// texture sidecars beside it, usdz packs one aligned file; metersPerUnit rides the
// recipe's declared units so Quick Look shows true scale.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-usd-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readZip } from '@/lib/graph/scene/zip-writer';
import { exportModelHandler } from './sketch-model-export.js';

const CYLINDER = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 6 },
  profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }],
};

describe('export_model usd', () => {
  it('usda: z-up layer, metersPerUnit from units, README notes', async () => {
    SketchRepository.create({ ref: 'sk_usd_cyl', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const res = await exportModelHandler({ ref: 'sk_usd_cyl', format: 'usda' });
    expect(res.ok).toBe(true);
    expect(res.format).toBe('usda');
    expect(res.url).toBe('/api/sketches/sk_usd_cyl/model.usda');
    expect(res.meters_per_unit).toBe(0.01);
    expect(res.nodes).toBeGreaterThanOrEqual(1);
    expect(res.note).toContain("metersPerUnit 0.01 (from units:'cm')");
    // no print fields on a USD export
    expect(res.scale).toBeUndefined();
    expect(res.closure).toBeUndefined();
    const text = readFileSync(res.path, 'utf8');
    expect(text.startsWith('#usda 1.0')).toBe(true);
    expect(text).toContain('upAxis = "Z"');
    expect(text).toContain('metersPerUnit = 0.01');
    expect(text).toContain('string title = "cylinder"');
    const readme = readFileSync(path.join(res.dir, 'README.md'), 'utf8');
    expect(readme).toContain('USD declares `upAxis = "Z"`');
    expect(readme).toContain('PointInstancers');
  });

  it('usdz: one aligned package, re-export byte-identical, no units ⇒ 1 m per unit', async () => {
    SketchRepository.create({ ref: 'sk_usd_bare', title: 'bare', manifest: { kind: 'workbench', lathes: [CYLINDER] } });
    const res = await exportModelHandler({ ref: 'sk_usd_bare', format: 'usdz' });
    expect(res.ok).toBe(true);
    expect(res.meters_per_unit).toBe(1);
    expect(res.files).toEqual(['model.usda']);
    expect(res.note).toContain('AR Quick Look');
    expect(existsSync(res.path)).toBe(true);
    const entries = readZip(readFileSync(res.path));
    expect(entries[0].name).toBe('model.usda');
    expect(entries[0].offset % 64).toBe(0);
    const first = readFileSync(res.path);
    const again = await exportModelHandler({ ref: 'sk_usd_bare', format: 'usdz' });
    expect(readFileSync(again.path).equals(first)).toBe(true);
  });

  it('write:false computes metadata without touching disk', async () => {
    const res = await exportModelHandler({ ref: 'sk_usd_cyl', format: 'usdz', write: false });
    expect(res.ok).toBe(true);
    expect(res.path).toBeUndefined();
    expect(res.bytes).toBeGreaterThan(0);
  });

  it('rejects an unknown format with the full list', async () => {
    await expect(exportModelHandler({ ref: 'sk_usd_cyl', format: 'usd' })).rejects.toThrow(/'usda', 'usdz'/);
  });
});
