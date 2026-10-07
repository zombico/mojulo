import { describe, it, expect } from 'vitest';
import { massProperties, analyseDynamics, validateDynamics, wantsDynamics, MOTOR_TORQUE, MOTOR_USABLE, FLUCTUATION_TARGET } from './dynamics.js';
import { solveMechanism, mechanismReport } from './mechanism.js';

const D = Math.PI / 180;
const Z = [0, 0, 1];
// a closed box as triangles, outward winding
const box = (x0, y0, z0, a, b, c) => {
  const v = [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0], [0, 0, c], [a, 0, c], [a, b, c], [0, b, c]].map((p) => [p[0] + x0, p[1] + y0, p[2] + z0]);
  return [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]].map((t) => t.map((i) => v[i]));
};
const run = (mech, partTris) => { const s = solveMechanism(mech); return analyseDynamics(s, mechanismReport(s), { partTris }); };

// a slider-crank r 10, L 40, all the mass in the piston (stated), so the textbook two-mass formulas apply exactly
const SC_TRIS = (rodW = 6, rodT = 4) => ({ crank: box(-2, -2, 0, 4, 4, 4), rod: box(10, -rodW / 2, 9, 40, rodW, rodT), piston: box(45, -5, 0, 10, 10, 5) });
const sliderCrank = (extra = {}) => ({
  joints: { crank: { type: 'revolute', center: [0, 0, 0], axis: Z }, piston: { type: 'prismatic', axis: [1, 0, 0] } },
  couplings: [{ type: 'link', a: 'crank', pa: [10, 0, 9], b: 'piston', pb: [50, 0, 9], rod: 'rod' }],
  drive: { part: 'crank', speed: 3000 }, bodies: { crank: { mass: 0 }, rod: { mass: 0 }, piston: { mass: 0.1 } }, ...extra,
});

describe('dynamics — mass properties from the mesh', () => {
  it('a box off the origin: volume, centroid and inertia tensor exact, whichever way it is wound', () => {
    const mp = massProperties(box(5, 5, 5, 20, 10, 4));
    expect(mp.volume).toBeCloseTo(800, 9);
    expect(mp.centroid.map((v) => +v.toFixed(9))).toEqual([15, 10, 7]);
    expect(mp.I[0][0]).toBeCloseTo(800 * (100 + 16) / 12, 6);
    expect(mp.I[1][1]).toBeCloseTo(800 * (400 + 16) / 12, 6);
    expect(mp.I[2][2]).toBeCloseTo(800 * (400 + 100) / 12, 6);
    expect(Math.abs(mp.I[0][1])).toBeLessThan(1e-9);
    const flipped = massProperties(box(5, 5, 5, 20, 10, 4).map(([a, b, c]) => [a, c, b]));
    expect(flipped.volume).toBeCloseTo(800, 9);
    expect(flipped.I[2][2]).toBeCloseTo(mp.I[2][2], 6);
  });
});

describe('dynamics — effort by energy', () => {
  it('a flywheel: τ = J·α at start-up, nothing at a steady speed', () => {
    const d = run({ joints: { fw: { type: 'revolute', center: [0, 0, 0], axis: Z } }, drive: { part: 'fw', speed: 600, spinup: 0.5 }, material: 's235' }, { fw: box(-50, -50, 0, 100, 100, 10) });
    const M = 1e-4 * 7850; const Izz = M * (0.01 + 0.01) / 12; const w = 600 * 2 * Math.PI / 60;
    expect(d.bodies.fw.mass_g).toBeCloseTo(M * 1000, 0);
    expect(d.startup.peak).toBeCloseTo(Izz * w / 0.5, 3);
    expect(d.effort.peak).toBeLessThan(1e-9);
  });
  it('an arm swinging under gravity: m·g·(L/2) where it is level, and it drives the motor on the way down', () => {
    const d = run({ joints: { arm: { type: 'revolute', center: [0, 0, 0], axis: [0, 1, 0] } }, drive: { part: 'arm', to: 90, period: 1000 }, material: 'pla' }, { arm: box(0, -10, -5, 200, 20, 10) });
    const M = 200 * 20 * 10 * 1e-9 * 1240;
    expect(d.effort.components_peak.gravity).toBeCloseTo(M * 9.81 * 0.1, 4);
    expect(d.effort.at_drive).toBe(0);   // level
    expect(d.flags.find((f) => f.kind === 'back-driving')).toBeTruthy();   // +θ about +y swings it down: gravity drives
  });
  it('a slider-crank: the inertia torque matches m·x′·x″·ω², and the shaking force is the piston\'s m·a', () => {
    const d = run(sliderCrank(), SC_TRIS());
    const r = 0.01, L = 0.04, w = 3000 * 2 * Math.PI / 60; let best = 0;
    for (let t = 0; t < 2 * Math.PI; t += 0.0005) {
      const S = Math.sin(t), C = Math.cos(t), q = Math.sqrt(L * L - r * r * S * S);
      const x1 = -r * S - r * r * S * C / q, x2 = -r * C - (r * r * (C * C - S * S)) / q - (r ** 4 * S * S * C * C) / q ** 3;
      best = Math.max(best, Math.abs(0.1 * x1 * x2 * w * w));
    }
    expect(Math.abs(d.effort.components_peak.inertia - best) / best).toBeLessThan(0.01);
    expect(Math.abs(d.shaking.peak_n - 0.1 * r * w * w * (1 + r / L)) / (0.1 * r * w * w * (1 + r / L))).toBeLessThan(0.02);
  });
  it('the fluctuation and its flywheel are consistent: J_fly = ΔE / (Cs·ω²) − J̄', () => {
    const d = run(sliderCrank({ drive: { part: 'crank', speed: 300 }, loads: [{ part: 'piston', force: 80 }] }), SC_TRIS());
    const w = 300 * 2 * Math.PI / 60; const f = d.fluctuation;
    expect(f.target).toBe(FLUCTUATION_TARGET);
    expect(f.flywheel).toBeCloseTo(f.energy_j / (FLUCTUATION_TARGET * w * w) - f.j_mean, 4);
  });
});

describe('dynamics — forces, friction and wear', () => {
  it('the rod force: m·r·ω²(1 − r/L) compression at the bottom of the stroke, (1 + r/L) tension at the top; the slide carries the rod\'s side load', () => {
    const d = run(sliderCrank({ friction: {} }), SC_TRIS());
    const r = 0.01, L = 0.04, w = 3000 * 2 * Math.PI / 60;
    const rod = d.forces.couplings[0];
    expect(rod.compression_peak).toBeCloseTo(0.1 * r * w * w * (1 - r / L), 1);
    expect(Math.abs(rod.tension_peak - 0.1 * r * w * w * (1 + r / L)) / (0.1 * r * w * w * (1 + r / L))).toBeLessThan(0.02);
    const slide = d.forces.joints.piston;
    expect(slide.friction_peak_n).toBeCloseTo(0.2 * slide.normal_peak_n, 2);
  });
  it('a gear mesh: Ft = τ/r on the driven gear, with the 20° radial push on both bearings', () => {
    const d = run({ joints: { g1: { type: 'revolute', center: [0, 0, 0], axis: Z }, g2: { type: 'revolute', center: [18, 0, 0], axis: Z } }, couplings: [{ type: 'gear', a: 'g1', b: 'g2', teeth: [12, 24] }], drive: { part: 'g1', speed: 60 }, loads: [{ part: 'g2', torque: 2 }], bodies: { g1: { mass: 0 }, g2: { mass: 0 } } },
      { g1: box(-5, -5, 0, 10, 10, 5), g2: box(13, -5, 0, 10, 10, 5) });
    const Ft = 2 / (0.018 * 24 / 36);
    expect(d.forces.couplings[0].peak).toBeCloseTo(Ft, 0);
    expect(d.forces.joints.g2.radial_peak_n).toBeCloseTo(Ft / Math.cos(20 * D), 0);
  });
  it('a sized pin: friction μ·R·r, and PV against the material\'s rule of thumb', () => {
    const m = sliderCrank({ drive: { part: 'crank', speed: 300 }, loads: [{ part: 'piston', force: 80 }], material: 'petg', bodies: { crank: { mass: 0 }, rod: { mass: 0 }, piston: { mass: 0 } }, friction: {} });
    m.joints.crank.pin_r = 3; m.joints.crank.pin_len = 4.5;
    const d = run(m, SC_TRIS());
    const j = d.forces.joints.crank;
    expect(j.friction_torque_peak_nm).toBeCloseTo(0.15 * j.radial_peak_n * 0.003, 4);
    expect(j.pv.value).toBeGreaterThan(j.pv.limit);   // 80 N on a 6 mm PETG pin at 300 rpm wears
    expect(d.flags.some((f) => f.kind === 'wear')).toBe(true);
    const frictionless = run({ ...m, friction: undefined }, SC_TRIS());
    expect(d.effort.mean).toBeGreaterThan(frictionless.effort.mean);   // friction costs drive torque
  });
  it('parts riding a carrier are named indeterminate, not given made-up forces', () => {
    const d = run({
      joints: { sun: { type: 'revolute', center: [0, 0, 0], axis: Z }, carrier: { type: 'revolute', center: [0, 0, 0], axis: Z }, p: { type: 'revolute', center: [13.5, 0, 0], axis: Z, on: 'carrier' } },
      couplings: [{ type: 'gear', a: 'sun', b: 'p', teeth: [12, 15] }, { type: 'ring', a: 'p', b: 'ring', teeth: [15, 42] }], drive: { part: 'sun' }, material: 'petg',
    }, { sun: box(-5, -5, 0, 10, 10, 5), carrier: box(-2, -2, 6, 4, 4, 2), p: box(9, -4, 0, 9, 8, 5), ring: box(-30, -30, -3, 60, 60, 2) });
    expect(d.forces.computed).toBe(false);
    expect(d.forces.reason).toMatch(/rides another/);
    expect(d.effort).toBeTruthy();   // the energy method still holds
  });
});

describe('dynamics — strength and flags', () => {
  it('a rod is checked as a strut at its peak compression: a thick one meets, a thin one is predicted to fail', () => {
    const m = (load) => sliderCrank({ drive: { part: 'crank', speed: 300 }, loads: [{ part: 'piston', force: load }], material: 'petg', bodies: { crank: { mass: 0 } } });
    const thick = run(m(40), SC_TRIS(8, 6)).strength;
    expect(thick.readings[0]).toEqual(expect.objectContaining({ part: 'rod', element: 'strut' }));
    expect(thick.worst.verdict).toMatch(/^meets/);
    const thin = run(m(400), SC_TRIS(3, 0.8)).strength;
    expect(thin.worst.verdict).toBe('predicted to fail');
  });
  it('a gear train is checked by Lewis at each gear\'s peak torque', () => {
    const d = run({ joints: { g1: { type: 'revolute', center: [0, 0, 0], axis: Z }, g2: { type: 'revolute', center: [27, 0, 0], axis: Z } }, couplings: [{ type: 'gear', a: 'g1', b: 'g2', teeth: [12, 24] }], drive: { part: 'g1', speed: 600 }, loads: [{ part: 'g2', torque: 1 }], material: 'pla' },
      { g1: box(-9, -9, 0, 18, 18, 6), g2: box(9, -18, 0, 36, 36, 6) });
    const g = d.strength.readings.filter((r) => r.element === 'gear');
    expect(g.map((r) => r.part).sort()).toEqual(['g1', 'g2']);
    expect(g.every((r) => Number.isFinite(r.sf))).toBe(true);
  });
  it('flags: cycles over the duty, a motor below the need, a self-locking screw holding a sustained load on a creeping material', () => {
    const d = run(sliderCrank({ drive: { part: 'crank', speed: 300, motor: 'nema17-40' }, loads: [{ part: 'piston', force: 80 }], duty: { hours: 10 }, material: 'petg' }), SC_TRIS());
    expect(d.flags.find((f) => f.kind === 'cycles').cycles).toBe(300 * 60 * 10);
    const motor = d.flags.find((f) => f.kind === 'motor');
    expect(motor.usable_nm).toBe(MOTOR_TORQUE['nema17-40'] * MOTOR_USABLE);
    expect(motor.ok).toBe(false);
    const screw = run({ joints: { s: { type: 'revolute', center: [0, 0, 0], axis: Z }, n: { type: 'prismatic', axis: Z } }, couplings: [{ type: 'screw', a: 's', b: 'n', lead: 2, d: 8 }], drive: { part: 's', to: 720 }, loads: [{ part: 'n', force: 200, sustained: true }], material: 'pla' },
      { s: box(-4, -4, 0, 8, 8, 40), n: box(-8, -8, 10, 16, 16, 8) });
    expect(screw.flags.find((f) => f.kind === 'creep')).toBeTruthy();
  });
  it('validates the new fields, and asks for dynamics only when one is given', () => {
    const errs = validateDynamics({ material: 'unobtainium', bodies: { ghost: {}, rod: { fill: 2 } }, friction: { pin: -1 }, drive: { spinup: 0, motor: 'nema99' }, duty: { hours: 0 } }, ['rod']).join('\n');
    expect(errs).toMatch(/mechanism.material: unknown material 'unobtainium'/);
    expect(errs).toMatch(/bodies.ghost: names no part/);
    expect(errs).toMatch(/bodies.rod.fill/);
    expect(errs).toMatch(/friction.pin/);
    expect(errs).toMatch(/spinup/);
    expect(errs).toMatch(/motor must be one of/);
    expect(errs).toMatch(/duty/);
    expect(wantsDynamics(sliderCrank({ bodies: undefined }))).toBe(false);
    expect(wantsDynamics(sliderCrank())).toBe(true);
  });
});
