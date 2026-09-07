// continuous-guardrails.plan.md G2 — measure_solid: the numbers export_model ships, without the file.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-measure-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { measureSolidHandler } from './measure-solid.js';
import { exportModelHandler } from './sketch-model-export.js';

const CYLINDER = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };

describe('measure_solid', () => {
  it('reads bounds, mm size, closure, volume, and parts off a workbench cylinder', async () => {
    SketchRepository.create({ ref: 'ms_cyl', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const m = await measureSolidHandler({ ref: 'ms_cyl' });
    expect(m.ok).toBe(true);
    expect(m.print_profile).toBe('literal');
    expect(m.scale).toBe(10);
    expect(m.bounds.size).toEqual([4, 4, 6]);
    expect(m.size_mm).toEqual([40, 40, 60]);
    expect(m.closure).toEqual(expect.objectContaining({ audited: true, closed: true, holes: 0 }));
    expect(m.parts).toHaveLength(1);
    expect(m.parts[0]).toEqual(expect.objectContaining({ kind: 'lathe', index: 0, base: 0, top: 6 }));
    // π·20²·60 ≈ 75,398 mm³ for a true cylinder; the lathe is faceted, so a little under
    expect(m.volume.applied).toBe(true);
    expect(m.volume.volume_mm3).toBeGreaterThan(70000);
    expect(m.volume.volume_mm3).toBeLessThan(75500);
    expect(m.volume.genus).toBe(0);
    expect(m.print_advisories).toEqual([]);
    expect(m.note).toContain('prints 40 × 40 × 60 mm');
  });

  it('agrees with export_model on the same ref and knobs — one scale seam, one closure seam', async () => {
    const m = await measureSolidHandler({ ref: 'ms_cyl', target_mm: 120 });
    const e = await exportModelHandler({ ref: 'ms_cyl', format: 'stl', target_mm: 120, write: false });
    expect(m.scale).toBeCloseTo(e.scale, 9);
    expect(m.size_mm).toEqual(e.size_mm);
    expect(m.closure).toEqual(e.closure);
    expect(m.print_advisories).toEqual(e.print_advisories);
  });

  it('an open shell reads as open, volume skips the non-manifold shell by name', async () => {
    SketchRepository.create({ ref: 'ms_tube', title: 'tube', manifest: { kind: 'workbench', units: 'cm', lathes: [{ ...CYLINDER, caps: false }] } });
    const m = await measureSolidHandler({ ref: 'ms_tube' });
    expect(m.ok).toBe(true);
    expect(m.closure.closed).toBe(false);
    expect(m.closure.holes).toBe(2);
    expect(m.volume.applied).toBe(false);
    expect(m.volume.non_manifold[0].name).toBe('base');
    expect(m.note).toContain('Volume not measured');
  });

  it('surfaces the print advisories at the resolved scale, and volume:false skips the union', async () => {
    const TRAY = { profile: { rect: { w: 4, h: 3 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, wallThickness: 0.03 };
    SketchRepository.create({ ref: 'ms_tray', title: 'tray', manifest: { kind: 'workbench', units: 'cm', extrudes: [TRAY] } });
    const m = await measureSolidHandler({ ref: 'ms_tray', volume: false });
    expect(m.print_advisories.map((r) => r.kind)).toEqual(['thin_wall']);
    expect(m.volume).toEqual({ skipped: true, reason: 'volume: false' });
    const fine = await measureSolidHandler({ ref: 'ms_tray', volume: false, printer: { nozzle_mm: 0.1 } });
    expect(fine.print_advisories).toEqual([]);
  });

  it('a flat diagram is not measurable; a missing ref throws', async () => {
    SketchRepository.create({ ref: 'ms_flat', title: 'flat', manifest: { kind: 'stations', viewBox: { w: 100, h: 100 }, stations: [] } });
    const m = await measureSolidHandler({ ref: 'ms_flat' });
    expect(m.ok).toBe(false);
    expect(m.eligible).toBe(false);
    await expect(measureSolidHandler({ ref: 'nope' })).rejects.toThrow(/No sketch/);
    await expect(measureSolidHandler({ ref: 'ms_cyl', scale: 0 })).rejects.toThrow(/scale/);
  });
});
