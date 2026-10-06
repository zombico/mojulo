// The rigidity sensor: exact sections off the mesh, each element check against a textbook answer, an overload
// control that must flip every reading, and confidence that drops when it should.
import { describe, it, expect } from 'vitest';
import { measureSection } from './section.js';
import { cantilever, shaft, strut, bolt, gear, lever, lewisY, shoulderKt } from './checks.js';
import { MATERIALS, directionFactor, resolveMaterial } from './materials.js';
import { strengthReading, strengthSpecErrors, strengthMarks } from './index.js';
import { normalizeMarks } from '../scene/channels/marks.js';
import { qty, toUnit } from '../machina/quantities.js';
import { loadOpenscad, renderScadParts } from '../scad/scad-render.js';

// ── closed test solids, outward winding ──
function prism(loops, z0, z1) {
  const out = [];
  for (const L of loops) for (let i = 0; i < L.length; i++) {
    const [ax, ay] = L[i], [bx, by] = L[(i + 1) % L.length];
    out.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1);
  }
  return new Float32Array(out);
}
function box(x0, y0, z0, x1, y1, z1) {
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  const o = []; for (const t of f) for (const i of t) o.push(...v[i]); return new Float32Array(o);
}
function cyl(r, z0, z1, n = 128) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n, b = (2 * Math.PI * (i + 1)) / n;
    const p = [r * Math.cos(a), r * Math.sin(a)], q = [r * Math.cos(b), r * Math.sin(b)];
    o.push(p[0], p[1], z0, q[0], q[1], z0, q[0], q[1], z1, p[0], p[1], z0, q[0], q[1], z1, p[0], p[1], z1,
      0, 0, z0, q[0], q[1], z0, p[0], p[1], z0, 0, 0, z1, p[0], p[1], z1, q[0], q[1], z1);
  }
  return new Float32Array(o);
}
const rect = (w, h, cx = 0, cy = 0) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
const circ = (r, n = 256, cw = false) => Array.from({ length: n }, (_, i) => { const a = ((cw ? -1 : 1) * 2 * Math.PI * i) / n; return [r * Math.cos(a), r * Math.sin(a)]; });
const near = (got, want, rel = 0.02) => expect(Math.abs(got - want) / Math.abs(want)).toBeLessThan(rel);
const STEEL = { material: MATERIALS.s235, build: null };

describe('section properties off the mesh match closed form', () => {
  it('rectangle (off-centre), tube with a hole, and an L with tilted principal axes', () => {
    const r = measureSection(prism([rect(20, 10, 3, 4)], 0, 50), [0, 0, 25], [0, 0, 1]).props;
    expect(r.area).toBeCloseTo(200, 6);
    expect(r.Iuu + r.Ivv).toBeCloseTo((20 * 1000) / 12 + (10 * 8000) / 12, 4);
    const t = measureSection(prism([circ(10), circ(8, 256, true)], 0, 50), [0, 0, 25], [0, 0, 1]).props;
    expect(t.holes).toBe(1);
    near(t.area, Math.PI * (100 - 64), 0.001);
    near(t.J0, (Math.PI / 2) * (1e4 - 4096), 0.001);
    // L 40 × 30 × 5: hand values I1 ≈ 61,443, I2 ≈ 13,275 mm⁴, |Ixy| ≈ 20,193 mm⁴
    const l = measureSection(prism([[[0, 0], [30, 0], [30, 5], [5, 5], [5, 40], [0, 40]]], 0, 50), [0, 0, 25], [0, 0, 1]).props;
    expect(l.area).toBeCloseTo(325, 6);
    near(l.I1, 61443, 0.001); near(l.I2, 13275, 0.001); near(Math.abs(l.Iuv), 20193, 0.001);
  });
  it('a flipped normal gives the same area; a plane that misses is empty', () => {
    expect(measureSection(box(-10, -5, 0, 10, 5, 50), [0, 0, 25], [0, 0, -1]).props.area).toBeCloseTo(200, 6);
    expect(measureSection(box(-10, -5, 0, 10, 5, 50), [0, 0, 80], [0, 0, 1]).props.empty).toBe(true);
  });
});

describe('each element against its textbook answer', () => {
  const bar = box(0, -10, -5, 100, 10, 5);   // 100 mm, 20 wide × 10 deep
  it('cantilever: σ = M·c/I and δ = F·L³/3EI', () => {
    const c = cantilever(bar, { root: { at: [0, 0, 0], normal: [1, 0, 0] }, load: { at: [100, 0, 0], force: [0, 0, -200] } }, STEEL);
    near(c.modes[0].stress_mpa, 60, 0.01);                                     // 200·100·5 / 1666.7
    near(c.modes[2].deflection_mm, (200 * 1e6) / (3 * 210000 * (20 * 1000 / 12)), 0.01);   // 0.1905 mm
    expect(c.weak_spot.side).toBe('tension');                                  // a hanging load: the top fibre
    expect(c.weak_spot.at[2]).toBeCloseTo(5, 3);
  });
  it('lever: effort from machina, the fulcrum section carries load × load arm', () => {
    const lv = lever(bar, { fulcrum: { at: [20, 0, 0] }, load: { at: [0, 0, 0], force: [0, 0, -400] }, effort: { at: [100, 0, 0], dir: [0, 0, -1] } }, STEEL);
    expect(lv.effort_n).toBe(100); expect(lv.mechanical_advantage).toBe(4);
    near(lv.modes[0].stress_mpa, (400 * 20 * 5) / (20 * 1000 / 12), 0.01);    // 24 MPa
  });
  it('shaft: τ = 16T/πd³ and θ = TL/GJ', () => {
    const s = shaft(cyl(5, 0, 100), { axis: { at: [0, 0, 0], dir: [0, 0, 1] }, length: 100, torque: 10 }, STEEL);
    near(s.modes[0].stress_mpa, (16 * 10000) / (Math.PI * 1000), 0.01);       // 50.9 MPa
    near(s.modes[1].twist_deg, 0.7226, 0.01);
  });
  it('strut: Euler P = π²EI/L²', () => {
    const st = strut(cyl(5, 0, 500, 256), { from: [0, 0, 0], to: [0, 0, 500], force: 1000 }, STEEL);
    near(st.modes[1].critical_n, (Math.PI ** 2 * 210000 * (Math.PI * 625 / 4)) / 250000, 0.01);   // 4070 N
    expect(st.modes[1].formula).toBe('Euler');
  });
  it('bolt: ISO stress area; gear: Lewis', () => {
    near(bolt(null, { size: 'M8', grade: '8.8', tension: 10000 }, STEEL).modes[0].stress_mpa, 10000 / 36.6, 0.005);
    near(gear(null, { module: 3, teeth: 20, face: 30, torque: 30 }, STEEL).modes[0].stress_mpa, 1000 / (30 * 3 * 0.322), 0.005);
    expect(lewisY(23)).toBeCloseTo(0.334, 3);
    expect(() => gear(null, { module: 1, teeth: 10, face: 5, torque: 1 }, STEEL)).toThrow(/12 teeth/);
  });
});

describe('every reading flips when overloaded (the control)', () => {
  const bar = box(0, -10, -5, 100, 10, 5);
  const spec = (checks) => ({ material: 's235', checks });
  const verdict = (soup, c) => strengthReading(soup, spec([c])).readings[0].verdict;
  it('cantilever, shaft, strut, bolt, gear', () => {
    const cant = (f) => ({ element: 'cantilever', root: { at: [0, 0, 0], normal: [1, 0, 0] }, load: { at: [100, 0, 0], force: [0, 0, -f] } });
    expect(verdict(bar, cant(200))).not.toMatch(/fail/);
    expect(verdict(bar, cant(1200))).toBe('predicted to fail');               // 360 MPa > 235
    const sh = (t) => ({ element: 'shaft', axis: { at: [0, 0, 0], dir: [0, 0, 1] }, length: 100, torque: t });
    expect(verdict(cyl(5, 0, 100), sh(10))).not.toMatch(/fail/);
    expect(verdict(cyl(5, 0, 100), sh(30))).toBe('predicted to fail');
    const st = (f) => ({ element: 'strut', from: [0, 0, 0], to: [0, 0, 500], force: f });
    expect(verdict(cyl(5, 0, 500, 256), st(1000))).not.toMatch(/fail/);
    expect(verdict(cyl(5, 0, 500, 256), st(5000))).toBe('predicted to fail');
    expect(strengthReading(null, spec([{ element: 'bolt', size: 'M8', grade: '8.8', tension: 30000 }])).readings[0].verdict).toBe('predicted to fail');
    expect(strengthReading(null, spec([{ element: 'gear', module: 1, teeth: 20, face: 5, torque: 10 }])).readings[0].verdict).toBe('predicted to fail');
  });
});

describe('confidence drops when it should, and the factor it calls for follows', () => {
  const bar = box(0, -10, -5, 100, 10, 5);
  const cant = { element: 'cantilever', root: { at: [0, 0, 0], normal: [1, 0, 0] }, load: { at: [100, 0, 0], force: [0, 0, -50] } };
  const read = (extra, c = {}) => strengthReading(bar, { material: 'petg', build: 'z+', ...extra, checks: [{ ...cant, ...c }] }).readings[0];
  it('steel with a measured load reads high; the grade sets the required factor', () => {
    const r = strengthReading(bar, { material: 's235', checks: [{ ...cant, certainty: 'measured' }] }).readings[0];
    expect(r.confidence.grade).toBe('high'); expect(r.confidence.required_sf).toBe(1.5);
  });
  it('unknown print direction, a guessed load, a creeping material under a sustained load, and heat each lower it', () => {
    const base = read({});
    expect(base.confidence.grade).toBe('medium');
    expect(read({ build: undefined }).confidence.grade).toBe('low');
    expect(read({}, { certainty: 'guess' }).confidence.grade).toBe('low');
    expect(read({}, { sustained: true }).confidence.reasons.join(' ')).toMatch(/creeps/);
    expect(read({ temperature: 80 }).confidence.grade).toBe('very low');
    expect(read({ temperature: 80 }).confidence.required_sf).toBe(4);
  });
  it('a brittle material calls for 1.25 × the factor', () => {
    const r = strengthReading(bar, { material: 'acrylic', checks: [{ ...cant, certainty: 'measured' }] }).readings[0];
    expect(r.confidence.brittle).toBe(true);
    expect(r.confidence.required_sf).toBe(r.confidence.grade === 'high' ? 1.88 : 2.5);
  });
  it('a broken load path reads very low, and the line never says safe', () => {
    const gap = new Float32Array([...box(0, -10, -5, 40, 10, 5), ...box(60, -10, -5, 100, 10, 5)]);
    const r = strengthReading(gap, { material: 's235', checks: [cant] }).readings[0];
    expect(r.confidence.grade).toBe('very low');
    expect(r.line).not.toMatch(/\bsafe\b/i);
  });
});

describe('materials, units and the spec gate', () => {
  it('Hankinson across layers and across grain', () => {
    expect(directionFactor(MATERIALS.pla, [0, 0, 1], [0, 0, 1]).strength).toBeCloseTo(0.5, 6);
    expect(directionFactor(MATERIALS.pla, [1, 0, 0], [0, 0, 1]).strength).toBe(1);
    expect(directionFactor(MATERIALS.pla, [Math.SQRT1_2, 0, Math.SQRT1_2], [0, 0, 1]).strength).toBeCloseTo(2 / 3, 6);
    expect(directionFactor(MATERIALS.pla, [1, 0, 0], null)).toEqual(expect.objectContaining({ strength: 0.5, known: false }));
    expect(directionFactor({ ...MATERIALS.oak, grainDir: [1, 0, 0] }, [1, 0, 0]).strength).toBe(1);
  });
  it('stress quantities convert and the guard still refuses a mismatch', () => {
    expect(toUnit(qty(1, 'MPa'), 'N/mm²')).toBeCloseTo(1, 12);
    expect(toUnit(qty(1, 'Nm'), 'N·mm')).toBeCloseTo(1000, 9);
    expect(() => toUnit(qty(1, 'MPa'), 'N')).toThrow(/dimension mismatch/);
  });
  it('a force can be a vector, a value with a unit, or a hanging mass', () => {
    const bar = box(0, -10, -5, 100, 10, 5);
    const at = { root: { at: [0, 0, 0], normal: [1, 0, 0] } };
    const a = cantilever(bar, { ...at, load: { at: [100, 0, 0], mass: 10 } }, STEEL).load_n;
    const b = cantilever(bar, { ...at, load: { at: [100, 0, 0], force: { value: 10, unit: 'kgf' } } }, STEEL).load_n;
    expect(a).toBeCloseTo(98, 1); expect(b).toBeCloseTo(98.07, 1);
  });
  it('the spec gate names what is wrong', () => {
    expect(strengthSpecErrors({ material: 'unobtainium', checks: [] }).join(' ')).toMatch(/unknown material.*non-empty/);
    expect(strengthSpecErrors({ material: 'pla', checks: [{ element: 'spring' }] }).join(' ')).toMatch(/element must be one of/);
    expect(strengthSpecErrors({ material: { E: 1000, strength: 20 }, checks: [{ element: 'bolt', kind: 'impact' }] })).toEqual([]);
    expect(resolveMaterial({ E: 1000, strength: 20 }).custom).toBe(true);
  });
  it('shoulder Kt falls as the fillet grows, and marks are well formed', () => {
    expect(shoulderKt(0.01, 2)).toBeGreaterThan(shoulderKt(0.06, 2));
    expect(shoulderKt(0.06, 2)).toBeGreaterThan(shoulderKt(0.3, 2));
    expect(shoulderKt(0.01, 1.1)).toBeLessThan(shoulderKt(0.01, 2));
    const m = strengthMarks([{ element: 'cantilever', verdict: 'predicted to fail', margin: { sf: 0.8 }, confidence: { grade: 'low' }, weak_spot: { at: [10, 0, 5], mode: 'bending' } }], 1);
    expect(m[0]).toEqual(expect.objectContaining({ at: [10, 0, 5], color: '#e5484d', tone: 'fail' }));
    expect(normalizeMarks([{ at: [0, 0, 0], dir: [0, 0, 1], size: 1 }, { at: [0, 0] }, null])).toHaveLength(1);
  });
});

const hasWasm = (await loadOpenscad()) != null;
describe.skipIf(!hasWasm)('stress raisers on a real OpenSCAD bracket (WASM)', () => {
  const soupOf = async (source) => { const recs = (await renderScadParts({ source })).parts[0].records; const o = []; for (const r of recs) for (const c of r.corners) o.push(...c); return new Float32Array(o); };
  // a 70 mm arm, 20 × 10, off a 5 mm wall plate that runs DOWN from the arm's top: the inside corner is underneath
  const bracket = (r) => `union(){ translate([0,-10,-40]) cube([5,20,50]); translate([0,-10,0]) cube([80,20,10]); ${r ? `translate([5,-10,0]) rotate([-90,0,0]) difference(){ cube([${r},${r},20]); translate([${r},${r},-1]) cylinder(r=${r},h=22,$fn=64);} ` : ''} }`;
  const spec = { material: 'pla', build: 'z+', checks: [{ element: 'cantilever', root: { at: [5, 0, 5], normal: [1, 0, 0] }, load: { at: [75, 0, 10], mass: 10 } }] };
  it('finds the corner, puts its Kt on the stepped face, and a fillet lowers it and moves the weak spot', async () => {
    const sharp = strengthReading(await soupOf(bracket(0)), spec).readings[0];
    const round = strengthReading(await soupOf(bracket(6)), spec).readings[0];
    expect(sharp.weak_spot.raisers[0]).toEqual(expect.objectContaining({ kind: 'shoulder', sharp: true }));
    expect(sharp.weak_spot.kt_applied).toBe(true);                 // PLA is brittle: Kt counts under a static load
    expect(sharp.weak_spot.at[2]).toBeCloseTo(0, 1);               // the inside corner, under the arm
    expect(round.weak_spot.kt).toBeLessThan(sharp.weak_spot.kt);
    expect(round.weak_spot.raisers[0].fillet_mm).toBeGreaterThan(3);   // a 6 mm fillet reads as several mm
    expect(round.weak_spot.at[0]).toBeGreaterThan(sharp.weak_spot.at[0] + 3);   // the weak spot moves past the fillet
    expect(round.margin.sf).toBeGreaterThan(sharp.margin.sf * 1.3);
  });
}, 120000);
