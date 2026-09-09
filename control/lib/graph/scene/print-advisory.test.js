// continuous-guardrails.plan.md G3 — declared-feature arithmetic against a printer profile.
import { describe, it, expect } from 'vitest';
import { PRINTER_DEFAULT, PROCESS_LIMITS, resolvePrinter, declaredFeatures, printAdvisories, advisoryLines } from './print-advisory.js';

describe('resolvePrinter', () => {
  it('defaults, partial override, nozzle implies two perimeters', () => {
    expect(resolvePrinter()).toEqual({ ...PRINTER_DEFAULT, bed_mm: [220, 220, 250] });
    expect(resolvePrinter({ nozzle_mm: 0.6 }).min_wall_mm).toBeCloseTo(1.2);
    expect(resolvePrinter({ nozzle_mm: 0.6, min_wall_mm: 0.9 }).min_wall_mm).toBe(0.9);
    expect(resolvePrinter({ bed_mm: [300, 300, 400] }).bed_mm).toEqual([300, 300, 400]);
  });
  it('refuses malformed fields loudly', () => {
    expect(() => resolvePrinter({ nozzle_mm: -1 })).toThrow(/nozzle_mm/);
    expect(() => resolvePrinter({ bed_mm: [1, 2] })).toThrow(/bed_mm/);
    expect(() => resolvePrinter('0.4')).toThrow(/printer/);
    expect(() => resolvePrinter({ process: 'laser' })).toThrow(/process/);
    expect(() => resolvePrinter({ self_support_deg: 95 })).toThrow(/self_support_deg/);
  });

  // text-to-cad-seam.plan.md T1 — a process picks its row; explicit fields still win
  it('process rows: FDM by default, SLA tightens the floor and the angle, powder supports everything', () => {
    expect(resolvePrinter().process).toBe('fdm');
    expect(resolvePrinter().self_support_deg).toBe(45);
    const sla = resolvePrinter({ process: 'sla' });
    expect(sla).toEqual(expect.objectContaining({ process: 'sla', nozzle_mm: null, min_wall_mm: 0.5, self_support_deg: 30, trapped_volume: true }));
    const sls = resolvePrinter({ process: 'sls' });
    expect(sls.self_support_deg).toBeNull();
    expect(sls.trapped_volume).toBe(true);
    // overrides ride on top of the row
    expect(resolvePrinter({ process: 'sla', min_wall_mm: 0.3 }).min_wall_mm).toBe(0.3);
    expect(resolvePrinter({ process: 'fdm', self_support_deg: null }).self_support_deg).toBeNull();
    // a resolved profile round-trips through resolvePrinter (nozzle_mm: null is legal)
    expect(resolvePrinter(sla)).toEqual(sla);
    expect(Object.keys(PROCESS_LIMITS)).toEqual(['fdm', 'sla', 'sls', 'mjf']);
  });
});

describe('declaredFeatures', () => {
  it('reads walls, floors, sweep diameters, and lathe necks; skips poles', () => {
    const m = {
      extrudes: [{ wallThickness: 0.3, floorThickness: 0.2 }, { wallThickness: 0 }],
      sweeps: [{ radius: 0.1 }],
      lathes: [{ profile: [{ t: 0, radius: 0 }, { t: 0.5, radius: 0.15 }, { t: 1, radius: 2 }] }],
    };
    expect(declaredFeatures(m)).toEqual([
      { at: 'extrudes[0].wallThickness', role: 'wall', value: 0.3 },
      { at: 'extrudes[0].floorThickness', role: 'floor', value: 0.2 },
      { at: 'sweeps[0].radius', role: 'section', value: 0.2 },
      { at: 'lathes[0].profile (narrowest station)', role: 'section', value: 0.3 },
    ]);
    expect(declaredFeatures({ kind: 'figure' })).toEqual([]);
    expect(declaredFeatures(null)).toEqual([]);
  });
});

describe('printAdvisories', () => {
  it('the scale decides: the same declared wall is thin at ×10 (0.5 mm) and clean at ×20 (1.0 mm)', () => {
    const m = { extrudes: [{ wallThickness: 0.05 }] };
    expect(printAdvisories({ manifest: m, scale: 10 }).map((r) => r.kind)).toEqual(['thin_wall']);
    expect(printAdvisories({ manifest: m, scale: 20 })).toEqual([]);
  });
  it('kinds land where they should', () => {
    const m = { extrudes: [{ wallThickness: 0.05 }], sweeps: [{ radius: 0.02 }] };
    const rows = printAdvisories({ manifest: m, scale: 10, sizeMm: [300, 40, 60] });
    expect(rows.map((r) => r.kind)).toEqual(['thin_wall', 'tiny_feature', 'over_bed']);
    expect(rows[0].mm).toBe(0.5);
    expect(rows[1].mm).toBe(0.4);
    expect(rows[2].detail).toContain('on x');
    // a bigger printer clears the bed row; a coarser floor keeps the wall row
    expect(printAdvisories({ manifest: m, scale: 10, sizeMm: [300, 40, 60], printer: { bed_mm: [400, 400, 400] } }).map((r) => r.kind)).toEqual(['thin_wall', 'tiny_feature']);
    // at ×20 the wall is 1.0 mm and the sweep exactly 0.8 mm — both clear the floor
    expect(printAdvisories({ manifest: m, scale: 20, sizeMm: [10, 10, 10] })).toEqual([]);
  });
  it('advisoryLines reads clean or itemised, and names the process', () => {
    expect(advisoryLines([])[0]).toMatch(/none — every declared feature/);
    expect(advisoryLines([])[0]).toContain('profile: FDM, 0.4 mm nozzle, 0.8 mm min wall, 45° self-support');
    expect(advisoryLines([], { process: 'sls' })[0]).toContain('profile: SLS, 0.7 mm min wall, 300 × 300 × 300 mm bed');
    const lines = advisoryLines([{ kind: 'thin_wall', detail: 'x' }]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('  - thin_wall: x');
  });

  // T1: the same declared wall is judged by the process; powder states the trapped-volume caveat
  it('the process decides: a 0.6 mm declared wall is thin under FDM, clear under SLA; powder adds trapped_volume', () => {
    const m = { extrudes: [{ wallThickness: 0.06 }] }; // 0.6 mm at ×10
    expect(printAdvisories({ manifest: m, scale: 10 }).map((r) => r.kind)).toEqual(['thin_wall']);
    expect(printAdvisories({ manifest: m, scale: 10, printer: { process: 'sla' } }).map((r) => r.kind)).toEqual(['trapped_volume']);
    const sls = printAdvisories({ manifest: m, scale: 10, printer: { process: 'sls' } });
    expect(sls.map((r) => r.kind)).toEqual(['thin_wall', 'trapped_volume']); // 0.6 < 0.7
    expect(sls[0].detail).toContain('0.7 mm SLS wall floor');
    expect(sls[1].detail).toMatch(/powder/);
    // an overhang measurement is suppressed for powder, worded for FDM
    const measure = { overhang: { area_mm2: 12, fraction: 0.1, worst_deg: 60 }, support: { footprint_mm2: 10 }, orientation: { best: 'x+' }, walls: { measured: false } };
    expect(printAdvisories({ printer: { process: 'sls' }, measure }).map((r) => r.kind)).toEqual(['trapped_volume']);
    const fdm = printAdvisories({ measure });
    expect(fdm.map((r) => r.kind)).toEqual(['overhang']);
    expect(fdm[0].detail).toContain('least support if built along x+');
  });
});
