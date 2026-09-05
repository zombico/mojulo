// interchange-seams.plan.md seam 4a — `union: true` on the print formats: the
// printable shells become ONE Manifold solid with a measured volume before the
// file is written; off ⇒ the export is untouched.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-union-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';

// two overlapping capped cylinders (closed lathes) — a classic multi-shell part
const CYL_A = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };
const CYL_B = { axisFrom: { x: 1.5, y: 0, z: 2 }, axisTo: { x: 1.5, y: 0, z: 8 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };

describe('export_model union', () => {
  it('unions the shells into one solid with a volume, in both print formats', async () => {
    SketchRepository.create({ ref: 'sk_union_two', title: 'two cylinders', manifest: { kind: 'workbench', units: 'cm', lathes: [CYL_A, CYL_B] } });
    const plain = await exportModelHandler({ ref: 'sk_union_two', format: 'stl', write: false });
    expect(plain.union).toBeUndefined();
    const stl = await exportModelHandler({ ref: 'sk_union_two', format: 'stl', union: true });
    expect(stl.ok).toBe(true);
    expect(stl.union.applied).toBe(true);
    expect(stl.union.unioned).toBeGreaterThanOrEqual(1);
    expect(stl.union.genus).toBe(0);
    expect(stl.union.volume_mm3).toBeGreaterThan(0);
    // two r=2 h=6 cylinders overlapping: less than the sum, more than one
    const one = Math.PI * 4 * 6 * 1000; // cm³ → mm³ at ×10
    expect(stl.union.volume_mm3).toBeGreaterThan(one);
    expect(stl.union.volume_mm3).toBeLessThan(2 * one);
    expect(stl.closure.closed).toBe(true);
    expect(stl.note).toContain('Manifold union');
    expect(stl.note).toContain('ONE solid');
    expect(stl.triangles).toBeGreaterThan(0);
    expect(stl.size_mm[2]).toBeCloseTo(80, 1); // 0..8 cm tall at ×10
    expect(readFileSync(stl.path).length).toBe(84 + stl.triangles * 50);

    const mf = await exportModelHandler({ ref: 'sk_union_two', format: '3mf', union: true, write: false });
    expect(mf.union.applied).toBe(true);
    expect(mf.objects).toBe(1); // one shell now
  });

  it('is deterministic', async () => {
    const a = await exportModelHandler({ ref: 'sk_union_two', format: 'stl', union: true });
    const first = readFileSync(a.path);
    const b = await exportModelHandler({ ref: 'sk_union_two', format: 'stl', union: true });
    expect(readFileSync(b.path).equals(first)).toBe(true);
  });

  it('refuses union on non-print formats', async () => {
    await expect(exportModelHandler({ ref: 'sk_union_two', format: 'glb', union: true })).rejects.toThrow(/print formats/);
  });

  it('an open shell is reported, never fatal', async () => {
    SketchRepository.create({ ref: 'sk_union_tube', title: 'open tube', manifest: { kind: 'workbench', units: 'cm', sweeps: [{ path: [[0, 0, 0], [0, 0, 5]], radius: 1.5, caps: false }] } });
    const res = await exportModelHandler({ ref: 'sk_union_tube', format: 'stl', union: true, write: false });
    expect(res.ok).toBe(true);
    expect(res.union.applied).toBe(false);
    expect(res.note).toContain('Union NOT applied');
  });
});
