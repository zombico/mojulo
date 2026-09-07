// continuous-guardrails.plan.md G3 — declared-feature arithmetic against a printer profile.
import { describe, it, expect } from 'vitest';
import { PRINTER_DEFAULT, resolvePrinter, declaredFeatures, printAdvisories, advisoryLines } from './print-advisory.js';

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
  it('advisoryLines reads clean or itemised', () => {
    expect(advisoryLines([])[0]).toMatch(/none — every declared feature/);
    const lines = advisoryLines([{ kind: 'thin_wall', detail: 'x' }]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('  - thin_wall: x');
  });
});
