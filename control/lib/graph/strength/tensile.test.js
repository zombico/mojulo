// Tension and the tensile view: the tie against F/A and ∫F/EA, the hollow-section Kt fix, the idealised curves,
// the working point placed on them, coupon calibration, and the World panel that draws the view.
import { describe, it, expect } from 'vitest';
import { tie, strut } from './checks.js';
import { MATERIALS } from './materials.js';
import { strengthReading, strengthSpecErrors, strengthMarks, applyCoupons } from './index.js';
import { materialCurve, directionalCurve, tensileSvg } from './tensile.js';
import { normalizeMarks, marksChannelScript } from '../scene/channels/marks.js';

// side walls of loops extruded along z (sections perpendicular to the member never need the caps)
function prism(loops, z0, z1) {
  const out = [];
  for (const L of loops) for (let i = 0; i < L.length; i++) {
    const [ax, ay] = L[i], [bx, by] = L[(i + 1) % L.length];
    out.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1);
  }
  return out;
}
const soup = (...parts) => new Float32Array(parts.flat());
function box(x0, y0, z0, x1, y1, z1) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const o = []; for (const t of f) for (const i of t) o.push(...v[i]); return o;
}
const rect = (w, h, cx = 0, cy = 0) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
const cw = (loop) => [...loop].reverse();
const circ = (r, n = 256, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => { const a = (-2 * Math.PI * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const near = (got, want, rel = 0.02) => expect(Math.abs(got - want) / Math.abs(want)).toBeLessThan(rel);
const STEEL = { material: MATERIALS.s235, build: null };
const read = (s, spec) => strengthReading(s, spec).readings[0];

describe('tie: a member in tension', () => {
  it('a prismatic bar reads F/A, stretches FL/EA, and reports its strain', () => {
    const t = tie(soup(prism([rect(10, 4)], 0, 100)), { from: [0, 0, 0], to: [0, 0, 100], force: 1000 }, STEEL);
    near(t.modes[0].stress_mpa, 25, 0.01);
    expect(t.modes[0].mode).toBe('tension');
    near(t.elongation_mm, (1000 * 100) / (210000 * 40), 0.02);
    near(t.strain_pct, (25 / 210000) * 100, 0.02);
    expect(t.modes.some((m) => m.rigidity)).toBe(false);   // no limit given: reported, not judged
  });
  it('a stepped bar stretches by ∫F/EA, and a limit makes the stretch a rigidity mode', () => {
    const s = soup(prism([rect(10, 10)], 0, 50), prism([rect(10, 5)], 50, 100));
    const t = tie(s, { from: [0, 0, 0], to: [0, 0, 100], force: 1000, limit: { elongation_mm: 0.005 } }, STEEL);
    near(t.elongation_mm, (1000 / 210000) * (50 / 100 + 50 / 50), 0.03);
    near(t.modes[0].stress_mpa, 20, 0.01);
    expect(t.modes[1]).toEqual(expect.objectContaining({ mode: 'elongation', rigidity: true }));
    expect(t.modes[1].utilization).toBeGreaterThan(1);
  });
  it('an off-centre pull adds bending: σ = F/A + F·e·c/I', () => {
    const t = tie(soup(prism([rect(10, 10)], 0, 100)), { from: [2, 0, 0], to: [2, 0, 100], force: 1000 }, STEEL);
    near(t.modes[0].stress_mpa, 10 + (1000 * 2 * 5) / (10 * 1000 / 12), 0.02);
    expect(t.assumptions.join(' ')).toMatch(/off-centre pull adds bending/);
  });
  it('a cross-hole reads the net section with the axial Kt (brittle)', () => {
    // a 20 × 4 strap along z with a 6 mm square hole through it at mid-length (two ligaments there)
    const plate = soup(box(-10, -2, 0, 10, 2, 47), box(-10, -2, 53, 10, 2, 100), box(-10, -2, 47, -3, 2, 53), box(3, -2, 47, 10, 2, 53));
    const r = read(plate, { material: 'pla', build: 'y+', checks: [{ element: 'tie', from: [0, 0, 0], to: [0, 0, 100], force: 200 }] });
    expect(r.weak_spot.raisers).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'hole', kt: 2.5 })]));
    near(r.modes[0].stress_mpa, (2.5 * 200) / ((20 - 6) * 4), 0.04);
  });
  it('a push is refused by the tie and a pull by the strut, each pointing at the other', () => {
    const bar = soup(prism([rect(10, 4)], 0, 100));
    expect(() => strut(bar, { from: [0, 0, 0], to: [0, 0, 100], force: -1000 }, STEEL)).toThrow(/element 'tie'/);
    expect(() => tie(bar, { from: [0, 0, 0], to: [0, 0, 100], force: -1000 }, STEEL)).toThrow(/element 'strut'/);
  });
  it('a cantilever loaded straight along its length says it is a tie or a strut', () => {
    const r = read(soup(prism([rect(10, 4)], 0, 100)), { material: 's235', checks: [{ element: 'cantilever', root: { at: [0, 0, 0], normal: [0, 0, 1] }, load: { at: [0, 0, 100], force: [0, 0, 1000] } }] });
    expect(r.assumptions.join(' ')).toMatch(/check a pull as a tie/);
  });
});

describe('a hollow section is not a hole', () => {
  const outer = rect(20, 10), inner = cw(rect(18.4, 8.4));
  const I = (20 * 1000 - 18.4 * 8.4 ** 3) / 12;
  const cant = { element: 'cantilever', root: { at: [0, 0, 0], normal: [0, 0, 1] }, load: { at: [0, 0, 200], force: [0, -60, 0] } };
  it('a tube running through reads its nominal stress, with no raiser (it read 2× before)', () => {
    const r = read(soup(prism([outer, inner], 0, 200)), { material: 'pla', build: 'x+', checks: [cant] });
    expect(r.weak_spot.raisers).toBeUndefined();
    near(r.modes[0].stress_mpa, (60 * 200 * 5) / I, 0.02);   // 79.2 MPa
  });
  it('the control: a cavity that stops mid-span takes the hole Kt where it ends', () => {
    const r = read(soup(prism([outer, inner], 0, 100), prism([outer], 100, 200)), { material: 'pla', build: 'x+', checks: [{ ...cant, load: { at: [0, 0, 200], force: [0, -20, 0] } }] });
    const tube = read(soup(prism([outer, inner], 0, 200)), { material: 'pla', build: 'x+', checks: [{ ...cant, load: { at: [0, 0, 200], force: [0, -20, 0] } }] });
    const ends = strengthReading(soup(prism([outer, inner], 0, 100), prism([outer], 100, 200)), { material: 'pla', build: 'x+', checks: [{ ...cant, root: { at: [0, 0, 90], normal: [0, 0, 1] } }] }).readings[0];
    expect(ends.weak_spot.raisers).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'hole' })]));
    expect(r.margin.sf).toBeGreaterThan(0); expect(tube.weak_spot.raisers).toBeUndefined();
  });
});

describe('the idealised curves', () => {
  it('brittle runs straight to the break; a metal is bilinear to its ultimate at break', () => {
    expect(materialCurve(MATERIALS.pla)).toEqual(expect.objectContaining({ brittle: true, points: [[0, 0], [1.563, 50]] }));
    const s = materialCurve(MATERIALS.s235);
    expect(s.points).toEqual([[0, 0], [0.112, 235], [26, 360]]);
    expect(s.model).toMatch(/bilinear/);
    expect(materialCurve(MATERIALS.petg).model).toMatch(/plateau/);
  });
  it('across the layers a print is drawn brittle at its reduced strength', () => {
    const c = directionalCurve(MATERIALS.petg, { strength: 0.6, E: 0.8, across: 1 });
    expect(c.brittle).toBe(true); expect(c.ultimate_mpa).toBe(27);
    expect(directionalCurve(MATERIALS.petg, { strength: 1, E: 1, across: 0 })).toEqual(materialCurve(MATERIALS.petg));
  });
});

describe('the working point on the curve', () => {
  const bar = soup(prism([rect(10, 4)], 0, 170));
  const pull = (force, extra = {}) => read(bar, { material: 'petg', build: 'x+', ...extra, checks: [{ element: 'tie', from: [0, 0, 0], to: [0, 0, 170], force }] }).tensile;
  it('the dogbone gauge at 1000 N sits at 25 MPa, 1.25 % strain, elastic', () => {
    const v = pull(1000);
    near(v.working.stress_mpa, 25, 0.01); near(v.working.strain_pct, 1.25, 0.01);
    expect(v.working.zone).toBe('elastic');
    expect(v.allowed_mpa).toBe(22.5);                   // medium confidence: SF 2 on 45
    expect(v.line).toMatch(/Tensile view: .* elastic; this confidence allows 22\.5 MPa/);
  });
  it('the control: 1900 N is past yield', () => {
    const over = pull(1900);
    expect(over.working.zone).toMatch(/^past yield/);
    expect(over.working.strain_pct).toBeNull();           // a plateau gives no single strain
  });
  it('pulled across the layers it reads on the across-layer curve, with the in-plane one beside it', () => {
    const v = pull(500, { build: 'z+' });
    expect(v.curve.brittle).toBe(true); expect(v.in_plane).toHaveLength(3); expect(v.direction.strength).toBe(0.6);
  });
  it('a bolt reads on its grade, torsion as its von Mises equivalent, and buckling is named when it governs', () => {
    const b = strengthReading(null, { material: 's235', checks: [{ element: 'bolt', size: 'M8', grade: '8.8', tension: 10000 }] }).readings[0].tensile;
    expect(b.material).toBe('bolt class 8.8'); near(b.working.stress_mpa, 10000 / 36.6, 0.01);
    const rod = soup(prism([circ(5, 128).reverse()], 0, 500));
    const st = read(rod, { material: 's235', checks: [{ element: 'strut', from: [0, 0, 0], to: [0, 0, 500], force: 3000 }] }).tensile;
    expect(st.governed_by).toBe('buckling'); expect(st.line).toMatch(/governed by buckling, not by the material/);
    const sh = read(rod, { material: 's235', checks: [{ element: 'shaft', axis: { at: [0, 0, 0], dir: [0, 0, 1] }, length: 500, torque: 10 }] }).tensile;
    expect(sh.line).toMatch(/von Mises equivalent/);
  });
});

describe('coupon calibration', () => {
  it('a flat coupon sets the in-plane strength; an upright one the layer factor', () => {
    const flat = applyCoupons(MATERIALS.petg, { break_n: 1600 });
    expect(flat.strength).toBe(40); expect(flat.calibration).toEqual(expect.objectContaining({ flat_mpa: 40, table_mpa: 45 }));
    const both = applyCoupons(MATERIALS.petg, [{ break_n: 1800 }, { break_n: 1000, build: 'upright' }]);
    expect(both.layer).toBeCloseTo(25 / 45, 6);
  });
  it('a reading made with a coupon is calibrated, says so, and the gate checks the coupon', () => {
    const s = strengthReading(soup(prism([rect(10, 4)], 0, 100)), { material: 'petg', build: 'x+', coupon: { break_n: 1600 }, checks: [{ element: 'tie', from: [0, 0, 0], to: [0, 0, 100], force: 400 }] });
    expect(s.material.strength_mpa).toBe(40); expect(s.material.calibration.coupons).toBe(1);
    expect(s.readings[0].confidence.reasons.join(' ')).toMatch(/calibrated by your strength coupon/);
    expect(strengthSpecErrors({ material: 'petg', coupon: { break_n: -1, build: 'sideways' }, checks: [{ element: 'tie' }] }).join(' ')).toMatch(/break_n.*build must be flat or upright/);
  });
});

describe('the World panel', () => {
  it('a weak spot carries its chart; the channel draws a panel only when a chart is there', () => {
    const r = strengthReading(soup(prism([rect(10, 4)], 0, 100)), { material: 'petg', build: 'x+', checks: [{ element: 'tie', from: [0, 0, 0], to: [0, 0, 100], force: 1000 }] });
    const chart = r.marks[0].chart;
    expect(chart.startsWith('<svg')).toBe(true); expect(chart).toMatch(/25 MPa/);
    const base = { at: [0, 0, 0], dir: [0, 0, 1], size: 1, color: '#3fb950' };
    const kept = normalizeMarks([{ ...base, chart }, { ...base, chart: '<svg onload="x()"></svg>' }]);
    expect(kept[0].chart).toBe(chart); expect(kept[1].chart).toBeUndefined();
    expect(marksChannelScript(normalizeMarks([base]))).not.toMatch(/__mkPanel/);
    expect(marksChannelScript(kept)).toMatch(/__mkPanel/);
  });
  it('a metal zooms the strain axis to its working point and names the break', () => {
    const v = read(soup(prism([rect(10, 4)], 0, 100)), { material: 's235', checks: [{ element: 'tie', from: [0, 0, 0], to: [0, 0, 100], force: 4000 }] }).tensile;
    expect(tensileSvg(v)).toMatch(/zoomed; breaks at 26 %/);
  });
});
