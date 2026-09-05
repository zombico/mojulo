// interchange-seams.plan.md seam 1a — the 3MF print handoff rides every STL
// print seam (profile, scale derivation, closure audit, README print notes) and
// adds what STL cannot carry: units in the file, colours, instanced objects.

// Isolate to in-memory SQLite + a scratch outcomes dir — must run before any
// import that pulls in db/index.js (same pattern as export-model.stl.test.js).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-3mf-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readZip } from '@/lib/graph/scene/zip-writer';
import { exportModelHandler } from './sketch-model-export.js';

// A capped cylinder lathe: real end radii at both ends ⇒ flat caps ⇒ closed.
const CYLINDER = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 6 },
  profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }],
};

function modelXml(file) {
  const entry = readZip(readFileSync(file)).find((e) => e.name === '3D/3dmodel.model');
  return entry.data.toString('utf8');
}

describe('export_model 3mf', () => {
  it('derives true scale from units, declares millimetres in the file, audits closed', async () => {
    SketchRepository.create({
      ref: 'sk_3mf_cyl',
      title: 'cylinder',
      manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] },
    });
    const res = await exportModelHandler({ ref: 'sk_3mf_cyl', format: '3mf' });
    expect(res.ok).toBe(true);
    expect(res.format).toBe('3mf');
    expect(res.url).toBe('/api/sketches/sk_3mf_cyl/model.3mf');
    expect(res.scale).toBe(10);
    expect(res.print_profile).toBe('literal');
    expect(res.size_mm).toEqual([40, 40, 60]);
    expect(res.closure).toEqual(expect.objectContaining({ audited: true, closed: true, holes: 0 }));
    expect(res.objects).toBe(1);
    expect(res.items).toBe(1);
    expect(res.colors).toBeGreaterThanOrEqual(1);
    expect(res.note).toContain('millimetres declared in the file');
    expect(res.note).toContain('prints 40 × 40 × 60 mm');

    expect(res.path.endsWith('model.3mf')).toBe(true);
    const xml = modelXml(res.path);
    expect(xml).toContain('unit="millimeter"');
    expect(xml).toContain('<metadata name="Title">cylinder</metadata>');
    // the studio floor + grid stay home: no vertex below the object's base plane
    const zs = [...xml.matchAll(/ z="(-?[\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...zs)).toBeCloseTo(60, 3);

    const readme = readFileSync(path.join(res.dir, 'README.md'), 'utf8');
    expect(readme).toContain('## Print notes');
    expect(readme).toContain('millimetres are declared in the file');
    expect(readme).toContain('basematerials');
  });

  it('re-export is byte-identical (the kernel baseline)', async () => {
    const a = await exportModelHandler({ ref: 'sk_3mf_cyl', format: '3mf' });
    const first = readFileSync(a.path);
    const b = await exportModelHandler({ ref: 'sk_3mf_cyl', format: '3mf' });
    expect(readFileSync(b.path).equals(first)).toBe(true);
  });

  it('shares the STL scale seams: explicit scale and target_mm', async () => {
    const explicit = await exportModelHandler({ ref: 'sk_3mf_cyl', format: '3mf', scale: 2, write: false });
    expect(explicit.scale).toBe(2);
    const fit = await exportModelHandler({ ref: 'sk_3mf_cyl', format: '3mf', target_mm: 120, write: false });
    expect(fit.scale).toBeCloseTo(20, 5);
    expect(fit.size_mm[2]).toBeCloseTo(120, 1);
  });

  it('flags an open shell, advisory only', async () => {
    SketchRepository.create({
      ref: 'sk_3mf_tube',
      title: 'open tube',
      manifest: { kind: 'workbench', units: 'cm', sweeps: [{ path: [[0, 0, 0], [0, 0, 5]], radius: 1.5, caps: false }] },
    });
    const res = await exportModelHandler({ ref: 'sk_3mf_tube', format: '3mf', write: false });
    expect(res.ok).toBe(true);
    expect(res.closure.closed).toBe(false);
    expect(res.note).toContain('open rim');
  });

  it('rejects an unknown format loudly', async () => {
    await expect(exportModelHandler({ ref: 'sk_3mf_cyl', format: 'obj' })).rejects.toThrow(/'glb', 'stl', '3mf'/);
  });
});
