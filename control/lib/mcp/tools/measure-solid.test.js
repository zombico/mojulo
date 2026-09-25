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
    expect(m.print_measure.walls.measured).toBe(true); // T2 rides measure_solid too
    expect(m.print_measure.overhang.area_mm2).toBe(0);
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
    // declared + sampled wall, and the closed shell's cavity ceiling is a bridge (overhang)
    expect(m.print_advisories.map((r) => r.kind)).toEqual(['thin_wall', 'thin_wall_measured', 'overhang']);
    expect(m.volume).toEqual({ skipped: true, reason: 'volume: false' });
    const fine = await measureSolidHandler({ ref: 'ms_tray', volume: false, printer: { nozzle_mm: 0.1 } });
    expect(fine.print_advisories.map((r) => r.kind)).toEqual(['overhang']); // the walls clear a 0.2 mm floor; the ceiling is still a bridge
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

// ring-plan: a layered solid measures its compiled parts and carries the exposure ledger (advisory)
import { mintSolidHandler } from './mint-solid.js';

describe('measure_solid on a layered solid', () => {
  it('reads the compiled parts, flags a buried detail in the exposure ledger and in warnings, and skips it on exposure:false', async () => {
    const plan = {
      schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' }, joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05] },
      segments: [
        { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24] }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, mirror: 'plane' },
        { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.14, rB: 0.1, mirror: 'name' },
        { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.1, rB: [0.08, 0.04], over: [0.6, 0.3], mirror: 'name' },
      ],
      details: [
        { name: 'spurR', kind: 'claw', base: [0.22, 0.27, 0.3], dir: [0, 1, 0.1], length: 0.15, radius: 0.02, pin: { parent: 'shinR', face: 'shinR/st1-st2.k0.b', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['shinR/st1.front', 'shinR/st2.front'], handedness: 1 }, mirror: 'spurL' },
        { name: 'hiddenR', kind: 'claw', base: [0.22, 0.25, 0.3], dir: [0, -1, 0], length: 0.05, radius: 0.012, pin: { parent: 'shinR', face: 'shinR/st1-st2.k0.b', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['shinR/st1.front', 'shinR/st2.front'], handedness: 1 } },
      ],
    };
    const minted = await mintSolidHandler({ kind: 'layered', via: 'plan', ref: 'ms_layered', spec: { plan, title: 'biped with a buried claw' } });
    expect(minted.ok).toBe(true);
    const m = await measureSolidHandler({ ref: 'ms_layered', volume: false });
    expect(m.ok).toBe(true); expect(m.kind).toBe('layered');
    expect(m.parts.map((p) => p.id).sort()).toEqual(['hiddenR', 'shinL', 'shinR', 'spurL', 'spurR', 'thighL', 'thighR', 'torso']);
    expect(m.parts.find((p) => p.id === 'torso').exposure).toBeUndefined();   // L1 parts are not in the ledger
    expect(m.parts.find((p) => p.id === 'spurR').exposure.flag).toBe('reads'); expect(m.parts.find((p) => p.id === 'hiddenR').exposure.flag).toBe('buried');
    expect(m.exposure.buried).toEqual(['hiddenR']); expect(m.exposure.views).toHaveLength(6);
    expect(m.warnings.some((w) => /buried detail.*hiddenR/.test(w))).toBe(true);
    const quiet = await measureSolidHandler({ ref: 'ms_layered', volume: false, exposure: false });
    expect(quiet.exposure).toBeUndefined(); expect(quiet.parts.find((p) => p.id === 'spurR').exposure).toBeUndefined(); expect(quiet.warnings).toBeUndefined();
  });
});
