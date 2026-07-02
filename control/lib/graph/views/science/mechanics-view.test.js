import { describe, expect, it } from 'vitest';

import { planMechanicsScene, assembleMechanicsScene, MECHANICS_SCENARIOS } from './mechanics-view.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

const PROJECTILE = { kind: 'mechanics-view', scenario: 'projectile', v0: 18, angle: 55, g: 9.8 };

describe('planMechanicsScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical faces and mover path', () => {
    const a = planMechanicsScene(PROJECTILE), b = planMechanicsScene(PROJECTILE);
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
    expect(JSON.stringify(a.movers[0].path)).toBe(JSON.stringify(b.movers[0].path));
  });

  it('emits a solid pickable body + a single mover, with set dressing that is NOT picked', () => {
    const plan = planMechanicsScene(PROJECTILE);
    const groups = new Set(plan.faces.map((f) => f.group));
    expect(groups.has('body')).toBe(true);
    expect(groups.has('scene')).toBe(true);
    expect(plan.movers.length).toBe(1);
    expect(plan.movers[0].group).toBe('body');
    // only the body is pickable
    expect(plan.picks.map((p) => p.name)).toEqual(['body']);
  });

  it('falls back to projectile on an unknown scenario', () => {
    expect(planMechanicsScene({ kind: 'mechanics-view', scenario: 'wormhole' }).stats.scenario).toBe('projectile');
  });

  it('assemble frames side-first with glow off and threads the mover channel', () => {
    const scene = assembleMechanicsScene(PROJECTILE, {});
    expect(scene.glow).toBe(false);
    expect(scene.cameras[0].name).toBe('side');
    expect(scene.movers[0].group).toBe('body');
  });
});

describe('planMechanicsScene — physics sanity', () => {
  it('projectile range ≈ v0²·sin(2θ)/g', () => {
    const plan = planMechanicsScene(PROJECTILE);
    const path = plan.movers[0].path;
    const range = path[path.length - 1][0] - path[0][0];
    const expected = (18 * 18 * Math.sin(2 * 55 * Math.PI / 180)) / 9.8;
    expect(Math.abs(range - expected)).toBeLessThan(expected * 0.02);
  });

  it('free-fall covers ½gt² and is one-shot', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'free-fall', height: 20, g: 9.8 });
    const path = plan.movers[0].path;
    const drop = path[0][2] - path[path.length - 1][2];
    expect(Math.abs(drop - 20)).toBeLessThan(0.2);
    expect(plan.movers[0].loop).toBe(false);
  });

  it('pendulum period ≈ small-angle 2π√(L/g) at modest amplitude, and loops', () => {
    const L = 12, g = 9.8;
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'pendulum', length: L, angle: 12, g });
    const small = 2 * Math.PI * Math.sqrt(L / g);
    // nonlinear period is slightly longer than small-angle, but within a few % at 12°.
    expect(Math.abs(plan.stats.T - small)).toBeLessThan(small * 0.05);
    expect(plan.movers[0].loop).toBe(true);
    expect(plan.movers[0].tether).toBeTruthy();
  });

  it('inclined-plane acceleration matches g(sinα − μcosα)', () => {
    const g = 9.8, al = 30 * Math.PI / 180, mu = 0.1;
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inclined-plane', angle: 30, mu, length: 20, g });
    const a = g * (Math.sin(al) - mu * Math.cos(al));
    // peak reported acceleration magnitude tracks the constant ramp acceleration.
    expect(Math.abs(plan.movers[0].maxAccel - a)).toBeLessThan(a * 0.1);
  });

  it('equal-dt invariant: under acceleration the samples STRETCH (not arc-length uniform)', () => {
    const path = planMechanicsScene({ kind: 'mechanics-view', scenario: 'free-fall', height: 30 }).movers[0].path;
    const seg = (i) => Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][2] - path[i][2]);
    // first step (near rest) is much shorter than a late step (near impact).
    expect(seg(1)).toBeLessThan(seg(path.length - 3));
  });
});

describe('planMechanicsScene — energy & friction honesty', () => {
  it('free-fall conserves energy: total KE+PE is flat as the body trades PE→KE', () => {
    const mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'free-fall', height: 30, mass: 2 }).movers[0];
    expect(mv.energy).toBe(true);
    expect(mv.etotal.length).toBe(mv.path.length);
    // PE falls, KE rises, total stays put. Check the conserved total over interior samples (endpoints
    // carry a one-sided finite-difference bias).
    const tot = mv.etotal.slice(2, -2);
    const lo = Math.min(...tot), hi = Math.max(...tot);
    expect((hi - lo) / hi).toBeLessThan(0.03);
    // and PE genuinely converts into KE (start is PE-dominated, end is KE-dominated).
    expect(mv.pe[0]).toBeGreaterThan(mv.ke[0]);
    expect(mv.ke[mv.ke.length - 1]).toBeGreaterThan(mv.pe[mv.pe.length - 1]);
  });

  it('inclined-plane with friction LOSES energy: total sinks end-to-start (friction → heat)', () => {
    const mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inclined-plane', angle: 35, mu: 0.2, length: 20 }).movers[0];
    expect(mv.etotal[mv.etotal.length - 3]).toBeLessThan(mv.etotal[2]);
  });

  it('energy:false drops the energy payload from the mover', () => {
    const mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'free-fall', energy: false }).movers[0];
    expect(mv.energy).toBeUndefined();
    expect(mv.ke).toBeUndefined();
  });

  it('inclined-plane goes STATIC when tanα ≤ μ — the body never slides', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inclined-plane', angle: 10, mu: 0.5, length: 20 });
    const mv = plan.movers[0];
    const moved = Math.hypot(...['0', '1', '2'].map((j) => mv.path[mv.path.length - 1][+j] - mv.path[0][+j]));
    expect(moved).toBeLessThan(1e-9);                 // resting body: start === end
    expect(plan.picks[0].label).toMatch(/static/i);   // and the readout says so
  });
});

describe('planMechanicsScene — force arrows (free-body diagram)', () => {
  it('forces are opt-in: absent by default, present with forces:true', () => {
    expect(planMechanicsScene({ ...PROJECTILE }).movers[0].forces).toBeUndefined();
    const mv = planMechanicsScene({ ...PROJECTILE, forces: true }).movers[0];
    expect(Array.isArray(mv.forces)).toBe(true);
    expect(mv.maxForce).toBeGreaterThan(0);
  });

  it('projectile in flight carries weight = mg only, pointing straight down', () => {
    const mv = planMechanicsScene({ ...PROJECTILE, forces: true, mass: 3, g: 10 }).movers[0];
    expect(mv.forces.length).toBe(1);
    expect(mv.forces[0].vecs[0]).toEqual([0, 0, -30]);   // m·g downward
  });

  it("inclined-plane forces (weight+normal+friction) sum to ma down the slope — Newton's 2nd law", () => {
    const g = 9.8, m = 2, alDeg = 35, mu = 0.15;
    const al = alDeg * Math.PI / 180;
    const mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inclined-plane', angle: alDeg, mu, length: 20, g, mass: m, forces: true }).movers[0];
    expect(mv.forces.length).toBe(3);
    // ΣF at the first sample
    const sum = mv.forces.reduce((acc, ch) => [acc[0] + ch.vecs[0][0], acc[1] + ch.vecs[0][1], acc[2] + ch.vecs[0][2]], [0, 0, 0]);
    const a = g * (Math.sin(al) - mu * Math.cos(al));
    expect(Math.hypot(...sum)).toBeCloseTo(m * a, 4);     // |ΣF| = ma
  });

  it('static inclined-plane forces sum to ZERO (equilibrium)', () => {
    const mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inclined-plane', angle: 10, mu: 0.5, forces: true }).movers[0];
    const sum = mv.forces.reduce((acc, ch) => [acc[0] + ch.vecs[0][0], acc[1] + ch.vecs[0][1], acc[2] + ch.vecs[0][2]], [0, 0, 0]);
    expect(Math.hypot(...sum)).toBeLessThan(1e-9);
  });

  it('pendulum string tension peaks at the bottom of the swing, least at the turning point', () => {
    const mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'pendulum', length: 12, angle: 60, forces: true }).movers[0];
    const tension = mv.forces[1].vecs.map((v) => Math.hypot(v[0], v[1], v[2]));
    const atRelease = tension[0];                          // θ = θ₀, ω = 0
    const peak = Math.max(...tension);
    expect(peak).toBeGreaterThan(atRelease);               // gravity-along-string + centripetal term
  });
});

describe('planMechanicsScene — strobe & trace dressing', () => {
  it('strobe + trace add only non-picked scene faces; both can be turned off', () => {
    const on = planMechanicsScene({ ...PROJECTILE });
    const off = planMechanicsScene({ ...PROJECTILE, strobe: false, trace: false });
    expect(on.faces.length).toBeGreaterThan(off.faces.length);
    // everything strobe/trace adds is scene dressing — still only the body is pickable.
    expect(on.picks.map((p) => p.name)).toEqual(['body']);
    expect(on.movers[0].path.length).toBe(off.movers[0].path.length);   // dressing never touches the motion
  });

  it('static inclined-plane emits no strobe ghosts (no motion to strobe)', () => {
    const stat = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inclined-plane', angle: 10, mu: 0.5 });
    const moving = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inclined-plane', angle: 40, mu: 0.05 });
    expect(stat.faces.length).toBeLessThan(moving.faces.length);
  });
});

describe('planMechanicsScene — spring (SHM) & circular (centripetal)', () => {
  it('spring period is amplitude-independent: T ≈ 2π√(m/k)', () => {
    const m = 2, k = 18;
    const a = planMechanicsScene({ kind: 'mechanics-view', scenario: 'spring', mass: m, k, amplitude: 4 });
    const b = planMechanicsScene({ kind: 'mechanics-view', scenario: 'spring', mass: m, k, amplitude: 9 });
    const expected = 2 * Math.PI * Math.sqrt(m / k);
    expect(Math.abs(a.stats.T - expected)).toBeLessThan(expected * 0.01);
    expect(a.stats.T).toBeCloseTo(b.stats.T, 6);   // amplitude does not change the period
  });

  it('spring conserves energy via elastic PE = ½kx² (not gravitational mgz)', () => {
    const mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'spring', mass: 1, k: 20, amplitude: 5 }).movers[0];
    expect(mv.energy).toBe(true);
    const tot = mv.etotal.slice(2, -2);
    const lo = Math.min(...tot), hi = Math.max(...tot);
    expect((hi - lo) / hi).toBeLessThan(0.03);                 // KE ↔ elastic PE, total flat
    expect(mv.pe[0]).toBeGreaterThan(mv.pe[Math.floor(mv.pe.length / 4)]);   // PE max at the extreme (x=A), min at centre
  });

  it('circular motion holds constant speed; acceleration points to the centre and is opt-out of energy', () => {
    const R = 10, v = 12;
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'circular', radius: R, v0: v });
    const mv = plan.movers[0];
    expect(mv.energy).toBeUndefined();                         // idealised → no energy bars
    const sp = mv.speed.slice(2, -2);
    const spread = (Math.max(...sp) - Math.min(...sp)) / Math.max(...sp);
    expect(spread).toBeLessThan(0.02);                         // |v| ~ constant all the way round
    // centripetal acceleration ≈ v²/R
    expect(Math.abs(mv.maxAccel - (v * v / R))).toBeLessThan((v * v / R) * 0.05);
  });

  it('circular acceleration vector aims inward (toward the centre at z=R)', () => {
    const R = 10, mv = planMechanicsScene({ kind: 'mechanics-view', scenario: 'circular', radius: R, v0: 12 }).movers[0];
    const i = Math.floor(mv.path.length / 4);                  // quarter turn — body out to the side
    const p = mv.path[i], av = mv.avec[i];
    const toC = [-p[0], 0, R - p[2]];                          // body → centre [0,0,R]
    const dot = av[0] * toC[0] + av[2] * toC[2];
    expect(dot).toBeGreaterThan(0);                            // acceleration has a positive component toward the centre
  });
});

describe('planMechanicsScene — collision (two-body, momentum)', () => {
  const collide = (over = {}) => planMechanicsScene({ kind: 'mechanics-view', scenario: 'collision', m1: 1, m2: 1, u1: 5, u2: 0, e: 1, ...over });

  it('emits two pickable bodies + two movers; only body 1 carries the system readout', () => {
    const plan = collide();
    expect(plan.picks.map((p) => p.name)).toEqual(['body', 'body2']);
    expect(plan.movers.map((m) => m.group)).toEqual(['body', 'body2']);
    expect(plan.movers[0].system).toBeTruthy();
    expect(plan.movers[1].system).toBeUndefined();
    expect(plan.stats.scenario).toBe('collision');
  });

  it('conserves momentum for every restitution e', () => {
    for (const e of [0, 0.5, 1]) {
      const sys = collide({ m1: 3, m2: 1, u1: 4, u2: -1, e }).movers[0].system;
      const pBefore = 3 * 4 + 1 * -1;
      // p is reported constant; it must equal m1u1 + m2u2.
      expect(sys.pTotal).toBeCloseTo(pBefore, 6);
      // and the post-collision velocities (last sample) reproduce that same total momentum.
      const pAfter = sys.m1 * sys.vx1[sys.vx1.length - 1] + sys.m2 * sys.vx2[sys.vx2.length - 1];
      expect(pAfter).toBeCloseTo(pBefore, 6);
    }
  });

  it('elastic (e=1) conserves KE; perfectly inelastic (e=0) loses it and the bodies end at one velocity', () => {
    const el = collide({ e: 1 }).movers[0].system;
    expect(el.keNow[el.keNow.length - 1]).toBeCloseTo(el.keBefore, 6);

    const inel = collide({ e: 0 }).movers[0].system;
    expect(inel.keNow[inel.keNow.length - 1]).toBeLessThan(inel.keBefore);
    expect(inel.vx1[inel.vx1.length - 1]).toBeCloseTo(inel.vx2[inel.vx2.length - 1], 6);   // stuck together
  });

  it('equal-mass elastic head-on EXCHANGES velocities (Newton’s cradle)', () => {
    const s = collide({ m1: 1, m2: 1, u1: 6, u2: 0, e: 1 }).movers[0].system;
    expect(s.vx1[s.vx1.length - 1]).toBeCloseTo(0, 6);   // body 1 stops
    expect(s.vx2[s.vx2.length - 1]).toBeCloseTo(6, 6);   // body 2 leaves at 6
  });

  it('non-closing inputs are corrected so a collision actually happens', () => {
    const s = collide({ u1: 0, u2: 5 }).movers[0].system;   // would never meet as given
    expect(s.vx1[0]).toBeGreaterThan(s.vx2[0]);             // body 1 nudged to close on body 2
  });
});

describe('planMechanicsScene — comparison mode (3d)', () => {
  it('gravity compare runs the scenario twice; the lower-g body takes longer', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'free-fall', height: 30, compare: 'gravity', g: 9.8, g2: 1.62 });
    expect(plan.picks.map((p) => p.name)).toEqual(['body', 'body2']);
    expect(plan.movers.length).toBe(2);
    const c = plan.movers[0].compare;
    expect(c).toBeTruthy();
    expect(c.tb).toBeGreaterThan(c.ta);                    // Moon (g2=1.62) falls slower than Earth
    // the two bodies sit in separate depth lanes (different y), so the angled camera can show both.
    expect(plan.movers[0].path[0][1]).not.toBeCloseTo(plan.movers[1].path[0][1], 3);
  });

  it('mass compare moves the two bodies in lockstep (Galileo: same flight time)', () => {
    const c = planMechanicsScene({ kind: 'mechanics-view', scenario: 'free-fall', height: 30, compare: 'mass', mass: 1, mass2: 8 }).movers[0].compare;
    expect(c.ta).toBeCloseTo(c.tb, 6);                     // mass cancels — identical motion
  });

  it('compare leads with the angled camera (depth lanes are invisible side-on)', () => {
    const scene = assembleMechanicsScene({ kind: 'mechanics-view', scenario: 'projectile', compare: 'gravity' }, {});
    expect(scene.cameras[0].name).toBe('angle');
  });

  it('compare is ignored for scenarios without a single-body flight time', () => {
    // 'collision' takes its own two-body branch regardless of a stray compare flag.
    expect(planMechanicsScene({ kind: 'mechanics-view', scenario: 'collision', compare: 'gravity' }).stats.scenario).toBe('collision');
  });
});

describe('mechanics-view registration', () => {
  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'mechanics-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the dynamics scenarios, the machines, the engines, the motors, then the vehicles', () => {
    expect(MECHANICS_SCENARIOS).toEqual(['projectile', 'free-fall', 'inclined-plane', 'pendulum', 'spring', 'circular', 'collision',
      'lever', 'wheel-axle', 'pulley', 'incline', 'wedge', 'screw', 'gear-train', 'screw-jack', 'crane', 'steam-engine', 'combustion', 'inline-four', 'dc-motor', 'ac-motor', 'drone', 'drone-flight', 'submarine']);
  });
});

describe('planMachineScene — simple machines (mechanical advantage + work)', () => {
  const machine = (scenario, extra = {}) => planMechanicsScene({ kind: 'mechanics-view', scenario, ...extra });
  const lead = (plan) => plan.movers[0].machine;

  it('is deterministic and attaches a machine readout (not energy/forces) to the load mover', () => {
    const a = machine('lever'), b = machine('lever');
    expect(JSON.stringify(a.movers[0].path)).toBe(JSON.stringify(b.movers[0].path));
    expect(a.movers[0].machine).toBeTruthy();
    expect(a.movers[0].energy).toBeUndefined();
    expect(a.movers[0].forces).toBeUndefined();
  });

  it('lever MA = effort arm / load arm, with the effort + load markers as two movers', () => {
    const plan = machine('lever', { armEffort: 8, armLoad: 4, mass: 2, g: 10 });
    const m = lead(plan);
    expect(m.MA_ideal).toBeCloseTo(2, 6);
    expect(m.loadForce).toBeCloseTo(20, 6);             // mass·g
    expect(m.effortForce).toBeCloseTo(10, 6);           // load / MA
    expect(plan.movers.map((mv) => mv.group).slice(0, 2)).toEqual(['body', 'body2']);
    // the beam itself articulates: a phase-driven `turn` mover tilts it about the fulcrum
    const beam = plan.movers.find((mv) => mv.group === 'lever_beam');
    expect(beam.turn).toBeTruthy();
    expect(beam.turn.angles.length).toBe(plan.movers[0].path.length);
  });

  it('lever class 3 gives a sub-unity MA (force traded for distance — honest, not clamped)', () => {
    const m = lead(machine('lever', { leverClass: 3, armEffort: 2, armLoad: 8 }));
    expect(m.MA_ideal).toBeCloseTo(0.25, 6);
    expect(m.effortForce).toBeGreaterThan(m.loadForce);
  });

  it('each machine MA matches its defining geometric ratio', () => {
    expect(lead(machine('wheel-axle', { rWheel: 6, rAxle: 1.5 })).MA_ideal).toBeCloseTo(4, 6);
    expect(lead(machine('pulley', { pulleyType: 'fixed' })).MA_ideal).toBeCloseTo(1, 6);
    expect(lead(machine('pulley', { pulleyType: 'movable' })).MA_ideal).toBeCloseTo(2, 6);
    expect(lead(machine('pulley', { pulleyType: 'compound', ropes: 4 })).MA_ideal).toBeCloseTo(4, 6);
    expect(lead(machine('incline', { angle: 30, length: 18 })).MA_ideal).toBeCloseTo(1 / Math.sin(30 * Math.PI / 180), 4);
    expect(lead(machine('wedge', { length: 12, thickness: 3 })).MA_ideal).toBeCloseTo(4, 6);
    expect(lead(machine('screw', { radius: 3, pitch: 1 })).MA_ideal).toBeCloseTo(2 * Math.PI * 3, 4);
  });

  it('MA = dIn / dOut for every machine (force trade ⇔ distance trade)', () => {
    for (const s of ['lever', 'wheel-axle', 'pulley', 'incline', 'wedge', 'screw']) {
      const m = lead(machine(s));
      expect(m.dIn / m.dOut).toBeCloseTo(m.MA_ideal, 4);
      expect(m.effortForce * m.MA_ideal).toBeCloseTo(m.loadForce, 4);   // ideal force balance
    }
  });

  it('conserves work in the ideal machine — W_in = W_out at every sample, no friction', () => {
    for (const s of ['lever', 'wheel-axle', 'pulley', 'incline', 'wedge', 'screw']) {
      const m = lead(machine(s));
      const last = m.workIn.length - 1;
      expect(m.workIn[last]).toBeCloseTo(m.workOut[last], 4);
      expect(m.workFriction[last]).toBeCloseTo(0, 6);
      for (let i = 0; i < m.workIn.length; i++) expect(m.workIn[i]).toBeCloseTo(m.workOut[i], 6);
    }
  });

  it('with efficiency < 1, W_in = W_out + W_friction and efficiency = W_out / W_in', () => {
    const m = lead(machine('lever', { efficiency: 0.6, armEffort: 8, armLoad: 4 }));
    const last = m.workIn.length - 1;
    expect(m.MA_actual).toBeCloseTo(m.MA_ideal * 0.6, 6);
    for (let i = 0; i < m.workIn.length; i++) {
      expect(m.workIn[i]).toBeCloseTo(m.workOut[i] + m.workFriction[i], 6);
    }
    expect(m.workOut[last] / m.workIn[last]).toBeCloseTo(0.6, 4);
  });

  it('articulates the machine body — rotating machines emit phase-driven `turn` movers, the wedge slides', () => {
    const N = machine('lever').movers[0].path.length;
    // a `turn` mover per rotating part, its angle array matching the load stroke length (so it stays in sync)
    for (const [s, group] of [['lever', 'lever_beam'], ['wheel-axle', 'wa_wheel'], ['screw', 'screw_thread']]) {
      const t = machine(s).movers.find((mv) => mv.group === group);
      expect(t && t.turn).toBeTruthy();
      expect(t.turn.angles.length).toBe(N);
      expect(t.turn.angles[0]).toBeCloseTo(0, 6);               // starts at rest
      expect(Math.abs(t.turn.angles.at(-1))).toBeGreaterThan(0.1);   // and actually rotates
    }
    // the compound pulley spins BOTH wheels, each about its own centre
    const pw = machine('pulley', { pulleyType: 'compound', ropes: 4 }).movers.filter((mv) => mv.turn);
    expect(pw.length).toBe(2);
    // the wedge is DRIVEN in: a slide mover with a multi-point path
    const wedge = machine('wedge').movers.find((mv) => mv.group === 'wedge_tool');
    expect(wedge.path.length).toBe(N);
    expect(wedge.path[0][0]).toBeLessThan(wedge.path.at(-1)[0]);   // travels +x
  });

  it('compound machines multiply MA through the chain while conserving work end-to-end', () => {
    for (const [s, nStages] of [['gear-train', 3], ['screw-jack', 2], ['crane', 2]]) {
      const m = lead(machine(s));
      expect(m.stages.length).toBe(nStages);
      const product = m.stages.reduce((acc, st) => acc * st[1], 1);
      expect(m.MA_ideal).toBeCloseTo(product, 4);             // MA = MA₁ · MA₂ · …
      expect(m.dIn / m.dOut).toBeCloseTo(m.MA_ideal, 4);      // the chained distance trade
      const last = m.workIn.length - 1;
      expect(m.workIn[last]).toBeCloseTo(m.workOut[last], 4); // work conserved across the whole chain
    }
  });

  it('the gear train spins every gear at ω ∝ 1/r (meshed gears counter-rotate)', () => {
    const plan = machine('gear-train');
    const gears = plan.movers.filter((mv) => mv.turn);
    expect(gears.length).toBe(4);                              // driver + 2 reduction gears + output
    // adjacent meshed gears turn in opposite senses
    const driver = gears[0].turn.angles.at(-1), big = gears[1].turn.angles.at(-1);
    expect(Math.sign(driver)).toBe(-Math.sign(big));
    expect(Math.abs(driver)).toBeGreaterThan(Math.abs(big));  // small driver spins faster than the big gear
  });

  it('steam engine is an exact slider-crank: stroke 2r, piston stops at the dead-centres, link + flywheel movers', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'steam-engine', crankRadius: 2, rodLength: 7.5 });
    const cross = plan.movers[0];                              // the crosshead drives the readout
    expect(cross.engine.stroke).toBeCloseTo(4, 6);            // 2·r
    // piston speed → 0 at the dead-centres (θ = 0° / 180°) and peaks mid-stroke
    const N = cross.speed.length, mid = Math.round(N / 4);
    expect(cross.speed[0]).toBeLessThan(cross.speed[mid] * 0.1);
    expect(cross.speed[N - 1]).toBeLessThan(cross.speed[mid] * 0.1);
    // the connecting rod is a LINK between the orbiting crank pin and the reciprocating crosshead
    const rod = plan.movers.find((mv) => mv.link);
    expect(rod && rod.from.length).toBe(N);
    expect(rod.to.length).toBe(N);
    // the flywheel is a continuously-looping TURN
    const fly = plan.movers.find((mv) => mv.turn);
    expect(fly.loop).toBe(true);
    expect(fly.turn.angles.at(-1)).toBeCloseTo(Math.PI * 2, 2);
    // determinism
    const b = planMechanicsScene({ kind: 'mechanics-view', scenario: 'steam-engine', crankRadius: 2, rodLength: 7.5 });
    expect(JSON.stringify(plan.movers.find((m) => m.link).from)).toBe(JSON.stringify(b.movers.find((m) => m.link).from));
  });

  it('4-stroke engine runs the full Otto cycle over two revolutions, with cam-timed valves + a power-stroke spark', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'combustion' });
    const piston = plan.movers[0];
    expect(piston.engine.engine).toBe('four-stroke');
    expect(piston.engine.angle.at(-1)).toBeCloseTo(4 * Math.PI, 2);   // the cycle is 720° (two crank revolutions)
    // flywheel turns TWICE per cycle (the cam/valves would run at half this)
    const fly = plan.movers.find((mv) => mv.turn);
    expect(fly.turn.angles.at(-1)).toBeCloseTo(4 * Math.PI, 2);
    // connecting rod is a LINK; the spark is a once-per-cycle PULSE at the power stroke (φ = 360° = ½ cycle)
    expect(plan.movers.some((mv) => mv.link)).toBe(true);
    const spark = plan.movers.find((mv) => mv.pulse);
    expect(spark.pulse.phase).toBeCloseTo(0.5, 6);
    // two poppet valves, cam-timed: intake OPEN over the intake stroke (φ<180°) and SHUT for compression;
    // exhaust the mirror. A valve mover's z dips below its rest (closed) position when open.
    const intake = plan.faces.some((f) => f.group === 'intake'), exhaust = plan.faces.some((f) => f.group === 'exhaust');
    expect(intake && exhaust).toBe(true);
    const N = piston.engine.angle.length;
    const iv = plan.movers.find((mv) => mv.group === 'intake'), restZ = iv.basePos[2];
    const at = (deg) => Math.round((deg / 720) * (N - 1));
    expect(iv.path[at(90)][2]).toBeLessThan(restZ - 1e-6);   // intake valve OPEN mid-intake-stroke
    expect(iv.path[at(270)][2]).toBeCloseTo(restZ, 6);       // and SHUT during compression
  });

  it('inline-4 phases four cylinders on one crankshaft, firing 1-3-4-2 (a power stroke every half-rev)', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'inline-four' });
    expect(plan.movers.filter((mv) => mv.link).length).toBe(4);     // four connecting rods
    expect(plan.movers.filter((mv) => mv.pulse).length).toBe(4);    // four spark plugs
    // one shared crankshaft (single turn group, two revolutions per cycle, rotating about its long x-axis)
    const cranks = plan.movers.filter((mv) => mv.turn);
    expect(cranks.length).toBe(1);
    expect(cranks[0].turn.axis).toEqual([1, 0, 0]);
    expect(cranks[0].turn.angles.at(-1)).toBeCloseTo(4 * Math.PI, 2);
    // the four sparks fire evenly across the cycle (every quarter = 180° of crank) → even firing
    const phases = plan.movers.filter((mv) => mv.pulse).map((mv) => mv.pulse.phase).sort((a, b) => a - b);
    expect(phases).toEqual([0, 0.25, 0.5, 0.75]);
    // cylinders 1 & 4 (crank throws 0° and 360°) share identical piston motion; 2 & 3 are the mirror pair
    const e = plan.movers[0].engine;
    expect(e.order).toBe('1-3-4-2');
    expect(e.deltas).toEqual([0, 180, 540, 360]);
  });

  it('dc-motor is an electromagnetic scene: a spinning armature coil + commutator in an N/S field', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'dc-motor' });
    // the armature coil is a continuously-looping TURN about +y, and it carries the motor readout (first mover)
    const coil = plan.movers[0];
    expect(coil.motor).toBeTruthy();
    expect(coil.turn.axis).toEqual([0, 1, 0]);
    expect(coil.loop).toBe(true);
    // the commutator is a second turn group spinning in step with the coil
    expect(plan.movers.filter((mv) => mv.turn).length).toBe(2);
    // no reciprocation/MA/work — this is a field machine: N + S poles are pickable
    expect(plan.picks.map((p) => p.name).sort()).toEqual(['coil', 'npole', 'spole']);
    expect(plan.movers.every((mv) => !mv.link && !mv.engine && !mv.machine)).toBe(true);
    // the magnetic field rides the real EM `fields` channel (curved field lines + direction needles), and
    // carries NO readout of its own (the motor HUD owns the readout — no collision)
    expect(plan.fields.length).toBe(1);
    expect(plan.fields[0].lines.length).toBeGreaterThan(2);
    expect(plan.fields[0].sets[0].samples.every((s) => Array.isArray(s.pos) && Array.isArray(s.dir))).toBe(true);
    expect('readout' in plan.fields[0]).toBe(false);
    expect(assembleMechanicsScene({ kind: 'mechanics-view', scenario: 'dc-motor' }).fields).toBeTruthy();
  });

  it('ac-motor is an induction motor: the field turns FASTER than the rotor (slip), no brushes/commutator', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'ac-motor' });
    // the rotating field arrow is a turn mover and carries the readout; it spins faster than the rotor
    const field = plan.movers[0], rotor = plan.movers.find((mv) => mv.group === 'rotor');
    expect(field.motor.type).toBe('ac');
    expect(field.turn).toBeTruthy();
    const fieldRevs = Math.abs(field.turn.angles.at(-1)), rotorRevs = Math.abs(rotor.turn.angles.at(-1));
    expect(fieldRevs).toBeGreaterThan(rotorRevs);                 // field outruns rotor → slip
    // both complete a WHOLE number of turns per loop so the field laps the rotor cleanly (no glitch)
    expect(fieldRevs / (2 * Math.PI)).toBeCloseTo(Math.round(fieldRevs / (2 * Math.PI)), 6);
    expect(rotorRevs / (2 * Math.PI)).toBeCloseTo(Math.round(rotorRevs / (2 * Math.PI)), 6);
    expect(field.motor.slip).toBeGreaterThan(0);
    expect(field.motor.rotorRpm).toBeLessThan(field.motor.syncRpm);   // rotor never reaches synchronous speed
    expect(plan.picks.map((p) => p.name).sort()).toEqual(['rotor', 'stator']);
  });

  it('drone is a Newtonian force-balance flight: ΣT vs mg → climb/hover/descend, rotors spin AND rise', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'drone', mass: 1.4, g: 10 });
    const body = plan.movers[0], W = 1.4 * 10;
    expect(body.drone.weight).toBeCloseTo(W, 6);
    expect(body.drone.rotors).toBe(4);
    // the free-body diagram: thrust (up) + weight (down), summing to ma
    expect(body.forces.length).toBe(2);
    const thrust = body.drone.thrust, N = thrust.length;
    expect(Math.max(...thrust)).toBeGreaterThan(W);            // climb: lift exceeds weight
    expect(Math.min(...thrust)).toBeLessThan(W);               // descend: lift below weight
    expect(thrust.some((t) => Math.abs(t - W) < 1e-6)).toBe(true);   // hover: lift EXACTLY balances weight (ΣF=0)
    // integrated path loops cleanly (lands back where it took off) and rises in between
    expect(body.path[0][2]).toBeCloseTo(body.path[N - 1][2], 4);
    expect(Math.max(...body.path.map((p) => p[2]))).toBeGreaterThan(body.path[0][2]);
    // four rotors that SPIN and carry a `lift` so they rise with the airframe
    const rotors = plan.movers.filter((mv) => mv.spin);
    expect(rotors.length).toBe(4);
    expect(rotors.every((r) => Array.isArray(r.lift) && r.lift.length === N)).toBe(true);
    expect(Math.max(...rotors[0].lift)).toBeGreaterThan(0);
  });

  it('drone-flight traverses a route through changing air: a pose mover (translate + tilt) + wind via fields', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'drone-flight' });
    const craft = plan.movers[0];
    // the craft TRANSLATES the route AND TILTS (pitch about y) — the new pose mover
    expect(craft.pose).toBe(true);
    expect(craft.tilt.axis).toEqual([0, 1, 0]);
    expect(craft.path.length).toBe(craft.tilt.angles.length);
    expect(craft.path.at(-1)[0]).toBeGreaterThan(craft.path[0][0]);   // flies forward across the route
    expect(Math.max(...craft.path.map((p) => p[2]))).toBeGreaterThan(craft.path[0][2]);   // climbs above the start
    expect(Math.min(...craft.tilt.angles)).toBeLessThan(0);           // pitches both ways (nose up climbing,
    expect(Math.max(...craft.tilt.angles)).toBeGreaterThan(0);        // nose down into the headwind)
    // the flight readout cycles through the aerial conditions
    expect(new Set(craft.flight.condition).size).toBeGreaterThanOrEqual(5);
    expect(craft.flight.condition).toContain('headwind');
    expect(craft.flight.condition).toContain('thermal updraft');
    // the wind in each zone rides the real EM `fields` channel (direction arrows + a faint route line), no readout
    expect(plan.fields[0].sets.length).toBe(3);                       // headwind / updraft / gust
    expect(plan.fields[0].lines.length).toBe(1);                      // the planned route
    expect('readout' in plan.fields[0]).toBe(false);
  });

  it('submarine is the buoyancy twin of the drone: B fixed, W swings via ballast → dive/hover/rise', () => {
    const plan = planMechanicsScene({ kind: 'mechanics-view', scenario: 'submarine', mass: 4, g: 10 });
    const boat = plan.movers[0], B = 4 * 10;
    expect(boat.sub.buoyancy).toBeCloseTo(B, 6);               // buoyancy = neutral weight (Archimedes, fixed)
    expect(boat.forces.length).toBe(2);                        // free-body: buoyancy (up) + weight (down)
    const W = boat.sub.weight;
    expect(Math.max(...W)).toBeGreaterThan(B);                 // dive: flood → W > B (heavier, sinks)
    expect(Math.min(...W)).toBeLessThan(B);                    // rise: blow → W < B (lighter, floats up)
    expect(W.some((w) => Math.abs(w - B) < 1e-6)).toBe(true);  // neutral: W EXACTLY balances B (ΣF = 0)
    // depth integrates: starts shallow, dives deep, returns (loops)
    expect(Math.max(...boat.sub.depth)).toBeGreaterThan(boat.sub.depth[0] + 1);
    expect(boat.path[0][2]).toBeCloseTo(boat.path.at(-1)[2], 4);
    // the propeller spins AND follows the hull's depth (spin `lift`); the water is a translucent medium
    const prop = plan.movers.find((mv) => mv.spin);
    expect(prop.spin.axis).toEqual([1, 0, 0]);
    expect(Array.isArray(prop.lift)).toBe(true);
    expect(plan.faces.some((f) => f.group === 'water' && f.alpha < 1)).toBe(true);
    // the MECHANISM: a ballast tank whose water level (a `fill` mover) FLOODS to dive and BLOWS to rise —
    // full when diving (W>B), empty when rising (W<B), half at neutral. It also rides the boat's depth.
    const tank = plan.movers.find((mv) => mv.fill);
    expect(tank).toBeTruthy();
    expect(Math.max(...tank.fill.frac)).toBeGreaterThan(0.98);   // floods full on the deepest dive
    expect(Math.min(...tank.fill.frac)).toBeLessThan(0.02);      // blows empty to surface
    expect(Array.isArray(tank.lift)).toBe(true);                 // the tank rides the boat
    // the fill fraction tracks the weight: more ballast water ⇒ heavier ⇒ sinks
    expect(boat.sub.ballast[W.indexOf(Math.max(...W))]).toBeGreaterThan(0.98);
    expect(boat.sub.ballast[W.indexOf(Math.min(...W))]).toBeLessThan(0.02);
  });

  it('frames as a world with a pickable load + static structure', () => {
    const plan = machine('pulley');
    const groups = new Set(plan.faces.map((f) => f.group));
    expect(groups.has('body')).toBe(true);
    expect(groups.has('scene')).toBe(true);
    expect(plan.picks[0].name).toBe('body');
    expect(plan.stats.scenario).toBe('pulley');
    expect(Number.isFinite(plan.bounds.radius)).toBe(true);
  });
});
