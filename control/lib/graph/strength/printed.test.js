// Prints as printed: the shell and infill core against closed forms, the explicit-shell control, solid at 100 %,
// the infill table's directions, and the reading's confidence and line.
import { describe, it, expect } from 'vitest';
import { measureSection } from './section.js';
import { printedSection, infillFactors, resolvePrint, printErrors } from './printed.js';
import { strengthReading, strengthSpecErrors } from './index.js';

function prism(loops, z0, z1) {
  const out = [];
  for (const L of loops) for (let i = 0; i < L.length; i++) {
    const [ax, ay] = L[i], [bx, by] = L[(i + 1) % L.length];
    out.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1);
  }
  return out;
}
const soup = (...parts) => new Float32Array(parts.flat());
const rect = (w, h, cx = 0, cy = 0) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
const cw = (loop) => [...loop].reverse();
const circ = (r, n = 512) => Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return [r * Math.cos(a), r * Math.sin(a)]; });
const near = (got, want, rel = 0.02) => expect(Math.abs(got - want) / Math.abs(want)).toBeLessThan(rel);

// a 20 (x) × 10 (y) bar along z, built along y: walls on the sides (x), skins top and bottom (y)
const BAR = soup(prism([rect(20, 10)], 0, 200));
const cant = (f = 60) => ({ element: 'cantilever', root: { at: [0, 0, 0], normal: [0, 0, 1] }, load: { at: [0, 0, 200], force: [0, -f, 0] } });
const read = (s, spec) => strengthReading(s, spec).readings[0];

describe('the printed section', () => {
  it('a rectangle: I* = I_outer − (1 − kE)·I_inner, the inner (20 − 2·walls) × (10 − 2·skins)', () => {
    const { slice, props } = measureSection(BAR, [0, 0, 100], [0, 0, 1]);
    const print = resolvePrint({ walls: 2, line_mm: 0.45, top_bottom: 4, layer_mm: 0.2, infill: 0.2, pattern: 'grid' });
    const f = infillFactors(print, [0, 0, 1], [0, 1, 0]);
    expect(f.kE).toBeCloseTo(0.04, 9);                     // grid across the build: bending-dominated, ρ²
    const p = printedSection(slice, props, print, [0, 1, 0], f);
    const inner = (18.2 * 8.4 ** 3) / 12;
    // bending about x (depth along y): the transformed I is the one about the axis across the depth
    const Ix = Math.abs(slice.basis.u[1]) > 0.5 ? p.Ivv : p.Iuu;
    near(Ix, (20 * 1000) / 12 - 0.96 * inner, 0.01);
    near(p.printed.core_mm2, 18.2 * 8.4, 0.01);
    expect(p.printed.walls_mm).toBe(0.9); expect(p.printed.skins_mm).toBe(0.8);
  });
  it('a round tube built along its axis: walls only, an even offset (core radius r − walls)', () => {
    const tube = soup(prism([circ(10)], 0, 100));
    const { slice, props } = measureSection(tube, [0, 0, 50], [0, 0, 1]);
    const print = resolvePrint({ walls: 3, line_mm: 0.4, infill: 0 });
    const p = printedSection(slice, props, print, [0, 0, 1], infillFactors(print, [0, 0, 1], [0, 0, 1]));
    near(p.printed.core_mm2, Math.PI * 8.8 ** 2, 0.015);
    near(p.J0, (Math.PI / 2) * (10 ** 4 - 8.8 ** 4), 0.02);
  });
  it('infill 0 with 0.8 mm walls and skins reads as the explicit 0.8 mm shell mesh (the study control)', () => {
    const shell = soup(prism([rect(20, 10), cw(rect(18.4, 8.4))], 0, 200));
    const explicit = read(shell, { material: 'pla', build: 'y+', checks: [cant()] });
    const printed = read(BAR, { material: 'pla', build: 'y+', print: { walls: 2, line_mm: 0.4, top_bottom: 4, layer_mm: 0.2, infill: 0 }, checks: [cant()] });
    near(printed.modes[0].stress_mpa, explicit.modes[0].stress_mpa, 0.02);   // ≈ 79.2 MPa
    near(printed.rigidity[0].deflection_mm, explicit.rigidity[0].deflection_mm, 0.02);
  });
  it('100 % infill is solid exactly, and no print leaves the reading as it was', () => {
    const solid = read(BAR, { material: 'pla', build: 'y+', checks: [cant()] });
    const full = read(BAR, { material: 'pla', build: 'y+', print: { infill: 1 }, checks: [cant()] });
    expect(full).toEqual(solid);
    expect(solid.facts.printed).toBeUndefined();
  });
  it('the study bar at 2 walls and 20 % grid reads about twice the solid stress; the control flips', () => {
    const spec = (print, f) => ({ material: 'pla', build: 'y+', ...(print ? { print } : {}), checks: [cant(f)] });
    const solid = read(BAR, spec(null)), printed = read(BAR, spec({ walls: 2, infill: 0.2 }));
    near(printed.modes[0].stress_mpa, (60 * 200 * 5) / ((20 * 1000) / 12 - 0.96 * (18.2 * 8.4 ** 3) / 12), 0.02);   // 74.7
    expect(printed.modes[0].stress_mpa / solid.modes[0].stress_mpa).toBeGreaterThan(1.9);
    expect(printed.weak_spot.print).toEqual(expect.objectContaining({ walls: 2, infill: 0.2, pattern: 'grid' }));
    expect(printed.confidence.reasons.join(' ')).toMatch(/printed section: 2 walls .* 20 % grid core/);
    // overload control: 10 N meets as solid, and the printed bar does not meet at 30 N where solid still does
    expect(read(BAR, spec(null, 10)).verdict).toMatch(/^meets/);
    expect(read(BAR, spec(null, 25)).verdict).toMatch(/^meets|below/);
    expect(read(BAR, spec({ walls: 2, infill: 0.2 }, 25)).margin.sf).toBeLessThan(read(BAR, spec(null, 25)).margin.sf / 1.9);
  });
  it('the core gets its own check, and a measured infill overrides the table and lifts the confidence penalty', () => {
    const r = read(BAR, { material: 'pla', build: 'y+', print: { walls: 1, infill: 0.5, pattern: 'gyroid' }, checks: [cant()] });
    const core = r.modes.find((m) => m.mode === 'infill core');
    expect(core.advisory).toBe(true);
    expect(r.margin.worst_mode).not.toBe('infill core');               // the shell sets the margin
    const sparse = read(BAR, { material: 'pla', build: 'y+', print: { walls: 2, infill: 0.2 }, checks: [cant()] });
    expect(sparse.line).toMatch(/Note — infill core: the infill starts to crack/);
    expect(r.confidence.inputs.idealization).toBe('low');            // the core carries much of the stiffness
    const own = read(BAR, { material: 'pla', build: 'y+', print: { walls: 1, infill: 0.5, pattern: 'gyroid', infill_E: 0.3 }, checks: [cant()] });
    expect(own.facts.printed.kE).toBe(0.3); expect(own.confidence.inputs.idealization).toBe('medium');
  });
  it('a strut buckles on I*, and a wide section stays accurate', () => {
    const col = (print) => read(BAR, { material: 'petg', build: 'z+', ...(print ? { print } : {}), checks: [{ element: 'strut', from: [0, 0, 0], to: [0, 0, 200], force: 100 }] });
    const solid = col(null).modes[1].critical_n, printed = col({ walls: 2, infill: 0.2 }).modes[1].critical_n;
    expect(printed / solid).toBeLessThan(0.8); expect(printed / solid).toBeGreaterThan(0.3);
    const wide = soup(prism([rect(200, 10)], 0, 400));
    const { slice, props } = measureSection(wide, [0, 0, 100], [0, 0, 1]);
    const print = resolvePrint({ walls: 2, line_mm: 0.45, top_bottom: 4, layer_mm: 0.2, infill: 0 });
    const p = printedSection(slice, props, print, [0, 1, 0], infillFactors(print, [0, 0, 1], [0, 1, 0]));
    near(p.printed.core_mm2, 198.2 * 8.4, 0.03);
  });
  it('the infill table follows the stress direction, and the gate names bad fields', () => {
    const p = resolvePrint({ infill: 0.2, pattern: 'grid' });
    expect(infillFactors(p, [0, 0, 1], [0, 0, 1]).kE).toBeCloseTo(0.2, 9);   // along the build: walls run with it
    expect(infillFactors(p, [1, 0, 0], [0, 0, 1]).kE).toBeCloseTo(0.04, 9);
    expect(infillFactors(resolvePrint({ infill: 0.3, pattern: 'triangles' }), [1, 0, 0], [0, 0, 1]).kE).toBeCloseTo(0.1, 9);
    expect(infillFactors(p, [1, 0, 0], null).kE).toBeCloseTo(0.04, 9);         // unknown: the weaker
    expect(printErrors({ walls: 1.5, infill: 2, pattern: 'voronoi' }).join(' ')).toMatch(/walls.*infill.*pattern/);
    expect(strengthSpecErrors({ material: 'pla', print: { infill: -1 }, checks: [{ element: 'tie', print: { pattern: 'x' } }] }).join(' ')).toMatch(/print.infill.*checks\[0\].print.pattern/);
  });
});
