import { describe, it, expect } from 'vitest';
import { validateMechanism, solveMechanism, mechanismReport, mechanismMovers, transformsAt, screwEfficiency } from './mechanism.js';
import { planScad, loadOpenscad, measureScadMotion } from './scad-render.js';
import { assembleScadScene } from '../worlds/scad.js';

const hasWasm = await loadOpenscad() != null;
const wasm = hasWasm ? it : it.skip;
const D = Math.PI / 180;
const Z = [0, 0, 1];
const rev = (center, extra = {}) => ({ type: 'revolute', center, axis: Z, ...extra });
const at = (s, deg) => s.samples.find((x) => Math.abs(x.s / D - deg) < 1.3);

// a slider-crank: crank r = 10 about z at the origin, rod L = 40, piston sliding along x (rest: pin at x = 50)
const sliderCrank = (extra = {}) => ({
  joints: { crank: rev([0, 0, 0]), piston: { type: 'prismatic', axis: [1, 0, 0] } },
  couplings: [{ type: 'link', a: 'crank', pa: [10, 0, 9], b: 'piston', pb: [50, 0, 9], rod: 'rod' }],
  drive: { part: 'crank' }, ...extra,
});
// a four-bar assembled on its upper branch: ground 0 → d, crank a (vertical at rest), coupler b, rocker c
function fourBar(a, b, c, d = 40) {
  const A = [0, a, 0]; const dx = d - A[0], dy = -A[1], L = Math.hypot(dx, dy);
  const x = (b * b - c * c + L * L) / (2 * L), h = Math.sqrt(b * b - x * x);
  const B = [A[0] + dx * x / L - dy * h / L, A[1] + dy * x / L + dx * h / L, 0];
  return { joints: { crank: rev([0, 0, 0]), rocker: rev([d, 0, 0]) }, couplings: [{ type: 'link', a: 'crank', pa: A, b: 'rocker', pb: B, rod: 'coupler' }], drive: { part: 'crank' } };
}

describe('mechanism — the contract', () => {
  it('refuses what cannot be a mechanism, and names the field', () => {
    expect(validateMechanism({ joints: {}, drive: {} }, null)[0]).toMatch(/needs `parts`/);
    const v = (m, parts = ['a', 'b', 'r']) => validateMechanism(m, parts).join('\n');
    expect(v({ joints: { z: rev([0, 0, 0]) }, drive: { part: 'z' } })).toMatch(/joints\.z: names no part/);
    expect(v({ joints: { a: { type: 'hinge' } }, drive: { part: 'a' } })).toMatch(/type must be one of revolute, prismatic, fixed/);
    expect(v({ joints: { a: rev([0, 0, 0]), b: { type: 'prismatic', axis: [1, 0, 0] } }, couplings: [{ type: 'gear', a: 'a', b: 'b', teeth: [10, 20] }], drive: { part: 'a' } })).toMatch(/a gear needs b \('b'\) on a revolute joint/);
    expect(v({ joints: { a: rev([0, 0, 0]), r: rev([1, 0, 0]) }, couplings: [{ type: 'link', a: 'a', pa: [1, 0, 0], b: 'b', pb: [5, 0, 0], rod: 'r' }], drive: { part: 'a' } })).toMatch(/rod: 'r' has a joint/);
    expect(v({ joints: { a: { type: 'prismatic', axis: [1, 0, 0] } }, drive: { part: 'a' } })).toMatch(/prismatic drive needs `to`/);
    expect(v({ joints: { a: rev([0, 0, 0], { on: 'b' }), b: rev([0, 0, 0], { on: 'a' }) }, drive: { part: 'a' } })).toMatch(/`on` makes a loop/);
    expect(v({ joints: { a: rev([0, 0, 0]) }, drive: { part: 'a' }, loads: [{ part: 'a', force: 3 }] })).toMatch(/its load is a torque/);
    expect(validateMechanism(sliderCrank(), ['crank', 'piston', 'rod'])).toEqual([]);
  });
  it('counts degrees of freedom: a joint nothing drives is named', () => {
    expect(() => solveMechanism({ joints: { a: rev([0, 0, 0]), idler: rev([9, 0, 0]) }, drive: { part: 'a' } })).toThrow(/'idler' is free — nothing couples it to the drive 'a'/);
  });
  it('a drive that starts away from rest walks there on its couplings first', () => {
    const m = { joints: { a: rev([0, 0, 0]), b: rev([20, 0, 0]) }, couplings: [{ type: 'ratio', a: 'a', b: 'b', ratio: -0.5 }], drive: { part: 'a', from: 30, to: 90 } };
    const s = solveMechanism(m);
    expect(s.lock).toBeNull();
    expect(s.samples[0].q.b / D).toBeCloseTo(-15, 6);
  });
});

describe('mechanism — the solver against closed forms', () => {
  it('a gear pair turns at −za/zb', () => {
    const s = solveMechanism({ joints: { a: rev([0, 0, 0]), b: rev([23.5, 0, 0]) }, couplings: [{ type: 'gear', a: 'a', b: 'b', teeth: [17, 30] }], drive: { part: 'a' } });
    expect(s.samples.at(-1).q.b / D).toBeCloseTo(-360 * 17 / 30, 5);
  });
  it('a planetary with the ring fixed: carrier at zs/(zs+zr), planets by Willis, a ring with no joint stands on the ground', () => {
    const m = {
      joints: { sun: rev([0, 0, 0]), carrier: rev([0, 0, 0]), p1: rev([13.5, 0, 0], { on: 'carrier' }), p2: rev([-13.5, 0, 0], { on: 'carrier' }) },
      couplings: [{ type: 'gear', a: 'sun', b: 'p1', teeth: [12, 15] }, { type: 'ring', a: 'p1', b: 'ring', teeth: [15, 42] }, { type: 'gear', a: 'sun', b: 'p2', teeth: [12, 15] }, { type: 'ring', a: 'p2', b: 'ring', teeth: [15, 42] }],
      drive: { part: 'sun' },
    };
    expect(validateMechanism(m, ['sun', 'carrier', 'p1', 'p2', 'ring'])).toEqual([]);
    const end = solveMechanism(m).samples.at(-1).q;
    expect(end.carrier / D).toBeCloseTo(360 * 12 / 54, 5);
    expect(end.p1 / D).toBeCloseTo(-(12 / 15) * (360 - 80), 4);   // relative to the carrier
  });
  it('a slider-crank: x = r·cosθ + √(L² − r²sin²θ)', () => {
    const s = solveMechanism(sliderCrank());
    for (const deg of [30, 90, 200, 300]) {
      const smp = at(s, deg); const t = smp.s;
      expect(smp.q.piston).toBeCloseTo(10 * Math.cos(t) + Math.sqrt(1600 - 100 * Math.sin(t) ** 2) - 50, 6);
    }
  });
  it('a Grashof four-bar turns fully with the coupler rigid; a non-Grashof one locks and says where', () => {
    const m = fourBar(10, 35, 30);
    const s = solveMechanism(m);
    expect(s.lock).toBeNull();
    const A0 = m.couplings[0].pa, B0 = m.couplings[0].pb;
    for (const smp of [at(s, 75), at(s, 160), at(s, 290)]) {
      const T = transformsAt(s.model, smp.q, ['crank', 'rocker', 'coupler']);
      const apply = (t, v) => [0, 1, 2].map((i) => t.R[i][0] * v[0] + t.R[i][1] * v[1] + t.R[i][2] * v[2] + t.p[i]);
      const A = apply(T.crank, A0), B = apply(T.rocker, B0);
      expect(Math.hypot(B[0] - A[0], B[1] - A[1])).toBeCloseTo(35, 5);
      // the coupler part rides its pins
      const cA = apply(T.coupler, A0), cB = apply(T.coupler, B0);
      expect(Math.hypot(cA[0] - A[0], cA[1] - A[1])).toBeLessThan(1e-6);
      expect(Math.hypot(cB[0] - B[0], cB[1] - B[1])).toBeLessThan(1e-6);
    }
    const bad = solveMechanism(fourBar(25, 20, 30));   // 20 + 40 > 25 + 30: the crank cannot go round
    expect(bad.lock).toEqual(expect.objectContaining({ unit: '°' }));
    expect(bad.lock.drive).toBeGreaterThan(0);
    expect(bad.lock.drive).toBeLessThan(90);
    expect(bad.lock.reason).toMatch(/Grashof/);
  });
  it('a screw: a right-hand screw turned + drives its nut −lead per turn, a left-hand one +lead', () => {
    const m = (hand) => ({ joints: { s: rev([0, 0, 0]), n: { type: 'prismatic', axis: Z } }, couplings: [{ type: 'screw', a: 's', b: 'n', lead: 2, hand }], drive: { part: 's', to: 720 } });
    expect(solveMechanism(m('right')).samples.at(-1).q.n).toBeCloseTo(-4, 6);
    expect(solveMechanism(m('left')).samples.at(-1).q.n).toBeCloseTo(4, 6);
  });
  it('a rack: the direction comes from which side of the pinion the rack sits', () => {
    const m = { joints: { p: rev([0, 0, 0]), r: { type: 'prismatic', axis: [1, 0, 0] } }, couplings: [{ type: 'rack', a: 'p', b: 'r', r: 10 }], drive: { part: 'p', to: 90 } };
    const mid = (bounds) => solveMechanism(m, { bounds }).samples[72].q.r;   // a swing: the midpoint is +90°
    expect(mid({ r: { min: [-50, -14, 0], max: [50, -9, 5] } })).toBeCloseTo(10 * Math.PI / 2, 5);   // below: a CCW turn pushes it +x
    expect(mid({ r: { min: [-50, 9, 0], max: [50, 14, 5] } })).toBeCloseTo(-10 * Math.PI / 2, 5);
  });
});

describe('mechanism — forces by virtual work', () => {
  it('a slider-crank: τ = F·|dx/dθ| at its worst point, and the margin against a stated drive torque', () => {
    const s = solveMechanism(sliderCrank({ drive: { part: 'crank', torque: 2 }, loads: [{ part: 'piston', force: 100 }] }));
    const r = mechanismReport(s);
    // dx/dθ peaks a little past 90° at ≈ r·(1 + r²/(2L²))-ish; numerically the max of |dx/dθ| over the cycle
    let peak = 0; for (let t = 0; t < 2 * Math.PI; t += 0.0005) { const dx = -10 * Math.sin(t) - (100 * Math.sin(t) * Math.cos(t)) / Math.sqrt(1600 - 100 * Math.sin(t) ** 2); peak = Math.max(peak, Math.abs(dx)); }
    expect(r.effort.unit).toBe('N·m');
    expect(r.effort.peak).toBeCloseTo(100 * peak / 1000, 2);
    expect(r.effort.margin).toEqual(expect.objectContaining({ ok: true, rating: 2 }));
    expect(r.available.piston.min).toBeCloseTo(2 / (peak / 1000), -1);
    const weak = mechanismReport(solveMechanism(sliderCrank({ drive: { part: 'crank', torque: 0.5 }, loads: [{ part: 'piston', force: 100 }] })));
    expect(weak.effort.margin.ok).toBe(false);
  });
  it('a lead screw: τ = F·lead / (2π·η), η from the lead angle, and self-locking said', () => {
    const e = screwEfficiency({ lead: 2, d: 8 });
    expect(e.selfLocking).toBe(true);
    const lam = Math.atan(2 / (Math.PI * 8)), phi = Math.atan(0.2);
    expect(e.eta).toBeCloseTo(Math.tan(lam) / Math.tan(lam + phi), 9);
    expect(screwEfficiency({ lead: 8, d: 8 }).selfLocking).toBe(false);
    const s = solveMechanism({ joints: { s: rev([0, 0, 0]), n: { type: 'prismatic', axis: Z } }, couplings: [{ type: 'screw', a: 's', b: 'n', lead: 2, d: 8 }], drive: { part: 's', to: 720 }, loads: [{ part: 'n', force: 200 }] });
    const r = mechanismReport(s);
    expect(r.effort.peak).toBeCloseTo(200 * 0.002 / (2 * Math.PI * e.eta), 3);
    expect(r.screws[0]).toEqual(expect.objectContaining({ self_locking: true }));
  });
  it('a gear train carries the stated efficiencies and the speeds', () => {
    const s = solveMechanism({ joints: { a: rev([0, 0, 0]), b: rev([18, 0, 0]), c: rev([18, 30, 0]) }, couplings: [{ type: 'gear', a: 'a', b: 'b', teeth: [12, 36] }, { type: 'gear', a: 'b', b: 'c', teeth: [36, 20] }], drive: { part: 'a', speed: 600 }, loads: [{ part: 'c', torque: 0.3 }] });
    const r = mechanismReport(s);
    expect(r.joints.c.ratio.constant).toBeCloseTo(12 / 20, 4);
    expect(r.joints.c.peak_speed).toEqual({ value: 360, unit: 'rpm' });
    expect(r.joints.c.efficiency_from_drive).toBeCloseTo(0.98 * 0.98, 3);
    expect(r.effort.peak).toBeCloseTo(0.3 * 0.6 / (0.98 * 0.98), 3);
  });
});

describe('mechanism — the World plays it', () => {
  it('a ground revolute is a turn table, a slide a path, a rod a pose that carries its pins', () => {
    const s = solveMechanism(sliderCrank());
    const mv = mechanismMovers(s, ['frame', 'crank', 'piston', 'rod']);
    const by = Object.fromEntries(mv.map((m) => [m.group, m]));
    expect(Object.keys(by).sort()).toEqual(['crank', 'piston', 'rod']);   // the frame never moves: no mover
    expect(by.crank.turn).toEqual(expect.objectContaining({ absolute: true, center: [0, 0, 0] }));
    expect(by.crank.turn.angles).toHaveLength(s.samples.length);
    expect(by.piston.path[0]).toEqual([0, 0, 0]);
    expect(by.rod.pose).toBe(true);
    // the pose at a sample maps the rod's authored crank-side pin onto the crank's pin
    const i = 40; const th = s.samples[i].q.crank;
    const ang = by.rod.tilt.angles[i] * Math.sign(by.rod.tilt.axis[2]), p = by.rod.path[i], c = Math.cos(ang), sn = Math.sin(ang);   // the tilt axis is ±z
    const pin = [10 * c - 0 * sn + p[0], 10 * sn + p[1]];
    expect(pin[0]).toBeCloseTo(10 * Math.cos(th), 4);
    expect(pin[1]).toBeCloseTo(10 * Math.sin(th), 4);
  });
});

// ── through OpenSCAD: the mint, the scene, the sweep ──

const SLIDER = (stop) => ({
  kind: 'scad',
  source: `module frame(){ translate([-20,-20,0]) cube([115,40,3]); cylinder(d=6,h=9,$fn=32); for (s=[-1,1]) translate([18, s>0 ? 6.5 : -9.5, 3]) cube([75,3,5.5]); ${stop ? 'translate([24,-6,3]) cube([3,12,5]);' : ''} }
module crank(){ difference(){ union(){ translate([0,0,3.5]) cylinder(r=14,h=4.5,$fn=48); translate([10,0,3.5]) cylinder(d=5,h=9.5,$fn=24); } translate([0,0,3]) cylinder(d=6.8,h=6,$fn=32); } }
module rod(){ translate([0,0,9]) difference(){ hull(){ translate([10,0,0]) cylinder(d=10,h=3,$fn=32); translate([50,0,0]) cylinder(d=10,h=3,$fn=32); } for(x=[10,50]) translate([x,0,-1]) cylinder(d=5.8,h=5,$fn=24); } }
module piston(){ translate([44,-6,3.5]) cube([12,12,5]); translate([50,0,3.5]) cylinder(d=5,h=9.5,$fn=24); }`,
  parts: { frame: 'frame();', crank: 'crank();', rod: 'rod();', piston: 'piston();' },
  mechanism: { ...sliderCrank(), steps: 16 },
});
const GEARS = (zb) => ({
  kind: 'scad',
  source: 'module a(){ mj_spur_gear(1, 17, 4, bore = 5); } module b(){ mj_gear_meshed(1, 17, 30, 0) mj_spur_gear(1, 30, 4, bore = 5); }',
  parts: { a: 'a();', b: 'b();' },
  mechanism: { joints: { a: rev([0, 0, 0]), b: rev([23.5, 0, 0]) }, couplings: [{ type: 'gear', a: 'a', b: 'b', teeth: [17, zb] }], drive: { part: 'a', to: 60 }, steps: 8 },
});

describe('mechanism — through OpenSCAD', () => {
  wasm('a manifest without `mechanism` is untouched: no stats.mechanism, movers as authored', async () => {
    const m = { kind: 'scad', source: 'module a() cube(4); module b() translate([6,0,0]) cube(4);', parts: { a: 'a();', b: 'b();' } };
    expect((await planScad(m)).stats.mechanism).toBeUndefined();
    expect((await assembleScadScene(m)).movers).toBeUndefined();
    const hinge = [{ group: 'b', label: 'b', basePos: [0, 0, 0], turn: { center: [6, 0, 0], axis: [0, 1, 0], absolute: true }, states: [0, -1] }];
    expect((await assembleScadScene({ ...m, movers: hinge })).movers).toEqual(hinge);
  });
  wasm('the mint solves it, the scene carries the derived movers', async () => {
    const p = await planScad(SLIDER(false));
    expect(p.stats.mechanism).toEqual(expect.objectContaining({ drive: 'crank', moving: 3 }));
    expect(p.stats.warnings).toBeUndefined();
    const scene = await assembleScadScene(SLIDER(false));
    expect(scene.movers.map((m) => m.group).sort()).toEqual(['crank', 'piston', 'rod']);
    await expect(planScad({ ...SLIDER(false), mechanism: { ...sliderCrank(), joints: { ...sliderCrank().joints, frame: rev([0, 0, 0]) } } })).rejects.toThrow(/'frame' is free/);
  }, 60000);
  wasm('the sweep: a clear slider-crank, and an end stop in the piston path caught at the angles it is hit', async () => {
    const clear = await measureScadMotion(SLIDER(false));
    expect(clear.collisions.pairs.filter((p) => p.clear === false)).toEqual([]);
    const hit = await measureScadMotion(SLIDER(true));
    const bad = hit.collisions.pairs.filter((p) => p.clear === false);
    expect(bad.map((p) => [p.a, p.b])).toEqual([['frame', 'piston']]);
    // the piston's near face reaches x = 24 at θ = 180°; the stop spans 24–27, so it is hit around the bottom of the stroke
    expect(bad[0].first_at).toBeGreaterThan(90);
    expect(bad[0].first_at).toBeLessThan(180);
    expect(bad[0].worst.drive).toBe(180);
  }, 120000);
  wasm('dynamics only on request: no material, no `dynamics` key; with one, mass from the real meshes and the rod checked', async () => {
    expect((await measureScadMotion(SLIDER(false))).dynamics).toBeUndefined();
    const m = SLIDER(false);
    m.mechanism = { ...m.mechanism, material: 'petg', bodies: { frame: { mass: 0 } }, drive: { part: 'crank', speed: 300 }, loads: [{ part: 'piston', force: 80 }] };
    const d = (await measureScadMotion(m)).dynamics;
    expect(d.bodies.frame.mass_g).toBe(0);
    expect(d.bodies.rod.mass_g).toBeGreaterThan(1);   // a 40 mm PETG rod, 10 × 3 with two eyes: about 1.6 g
    expect(d.bodies.rod.mass_g).toBeLessThan(2.5);
    expect(d.forces.couplings[0].compression_peak).toBeGreaterThan(80);   // the 80 N load plus the piston's inertia
    expect(d.strength.readings[0]).toEqual(expect.objectContaining({ part: 'rod', element: 'strut' }));
  }, 120000);
  wasm('a gear pair driven through mesh sweeps clear; the wrong ratio collides at the mesh', async () => {
    const good = await measureScadMotion(GEARS(30));
    expect(good.collisions.pairs).toEqual([expect.objectContaining({ a: 'a', b: 'b', clear: true })]);
    const wrong = await measureScadMotion(GEARS(26));
    const p = wrong.collisions.pairs[0];
    expect(p.clear).toBe(false);
    expect(p.worst.at[0]).toBeGreaterThan(6);   // between the centres (0 and 23.5), where the teeth meet
    expect(p.worst.at[0]).toBeLessThan(12);
  }, 120000);
});
