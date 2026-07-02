import { describe, expect, it } from 'vitest';

import {
  DEG, TAU, clampNum, clamp, add, sub, scl, len, norm,
  deriveKinematics, repVec, weightChannel, F_WEIGHT,
  MECHANICS_RULES, MECHANICS_SAMPLES,
  MOTION_RULES, placeMover, resolveMotionMovers,
} from './motion-vocabulary.js';

describe('math + vec helpers', () => {
  it('exposes the standard constants', () => {
    expect(DEG).toBeCloseTo(Math.PI / 180, 12);
    expect(TAU).toBeCloseTo(Math.PI * 2, 12);
  });

  it('clampNum clamps and falls back on non-finite input', () => {
    expect(clampNum(5, 0, 10, 1)).toBe(5);
    expect(clampNum(-3, 0, 10, 1)).toBe(0);
    expect(clampNum(99, 0, 10, 1)).toBe(10);
    expect(clampNum('nope', 0, 10, 7)).toBe(7);
    expect(clampNum(undefined, 0, 10, 7)).toBe(7);
  });

  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });

  it('add / sub / scl operate component-wise', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(scl([1, -2, 3], 2)).toEqual([2, -4, 6]);
  });

  it('len / norm measure and normalize, norm guards the zero vector', () => {
    expect(len([3, 4, 0])).toBeCloseTo(5, 12);
    const n = norm([0, 0, 5]);
    expect(n).toEqual([0, 0, 1]);
    expect(norm([0, 0, 0])).toEqual([0, 0, 0]);   // l || 1 guard → no NaN
  });
});

describe('deriveKinematics — finite-difference of an equal-dt polyline', () => {
  it('constant velocity → constant speed, ~zero acceleration, forward direction', () => {
    const dt = 0.5;
    const v = 4;                                   // m/s along +x
    const path = Array.from({ length: 20 }, (_, i) => [v * dt * i, 0, 0]);
    const k = deriveKinematics(path, dt);
    // interior samples move exactly v·dt per step → speed = v.
    for (let i = 1; i < path.length - 1; i++) {
      expect(k.speed[i]).toBeCloseTo(v, 9);
      expect(k.vdir[i]).toEqual([1, 0, 0]);
      expect(k.accel[i]).toBeCloseTo(0, 9);
    }
    expect(k.maxSpeed).toBeCloseTo(v, 9);
  });

  it('constant acceleration (free fall) → recovers g as the second difference', () => {
    const g = 9.8, dt = 0.01;
    const H = 20;
    const N = 140;
    const path = Array.from({ length: N }, (_, i) => { const t = i * dt; return [0, 0, H - 0.5 * g * t * t]; });
    const k = deriveKinematics(path, dt);
    // interior acceleration magnitude is g (downward). endpoints are copied from their neighbour.
    for (let i = 1; i < N - 1; i++) {
      expect(k.accel[i]).toBeCloseTo(g, 6);
      expect(k.avec[i][2]).toBeCloseTo(-g, 6);     // pointing down −z
    }
    expect(k.avec[0]).toEqual(k.avec[1]);          // endpoint copy guard
    expect(k.avec[N - 1]).toEqual(k.avec[N - 2]);
    // speed grows linearly; the forward difference samples v at the step MIDPOINT, so the exact
    // discrete value at i is g·(i + ½)·dt.
    expect(k.speed[100]).toBeCloseTo(g * 100.5 * dt, 9);
  });

  it('is pure — same path yields byte-identical output', () => {
    const dt = 0.1;
    const path = Array.from({ length: 30 }, (_, i) => [Math.sin(i * 0.2), 0, Math.cos(i * 0.2)]);
    expect(JSON.stringify(deriveKinematics(path, dt))).toBe(JSON.stringify(deriveKinematics(path, dt)));
  });
});

describe('force-channel palette', () => {
  it('repVec lays a constant force over n samples, each a distinct copy', () => {
    const vecs = repVec([0, 0, -9.8], 5);
    expect(vecs.length).toBe(5);
    expect(vecs.every((v) => v[2] === -9.8)).toBe(true);
    vecs[0][2] = 0;                                 // mutating one copy must not touch the rest
    expect(vecs[1][2]).toBe(-9.8);
  });

  it('weightChannel is mg pointing down, in the weight colour', () => {
    const ch = weightChannel(2, 9.8, 3);
    expect(ch.color).toBe(F_WEIGHT);
    expect(ch.vecs.length).toBe(3);
    expect(ch.vecs[0]).toEqual([0, 0, -19.6]);
  });
});

describe('MECHANICS_RULES — the relocated Newtonian force laws', () => {
  const g = 9.8;

  it('every rule yields an equal-dt path of MECHANICS_SAMPLES points + facts + force channels', () => {
    for (const name of Object.keys(MECHANICS_RULES)) {
      const sim = MECHANICS_RULES[name]({ g });
      expect(sim.path.length).toBe(MECHANICS_SAMPLES);
      expect(Array.isArray(sim.facts)).toBe(true);
      expect(Array.isArray(sim.forceChannels)).toBe(true);
      expect(typeof sim.T).toBe('number');
    }
  });

  it('is deterministic — same params yield byte-identical output', () => {
    const a = MECHANICS_RULES.projectile({ g, v0: 18, angle: 55 });
    const b = MECHANICS_RULES.projectile({ g, v0: 18, angle: 55 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('projectile — parabolic arc with T = 2v₀sinθ/g, launched from the origin', () => {
    const v0 = 18, th = 55 * DEG;
    const sim = MECHANICS_RULES.projectile({ g, v0, angle: 55 });
    expect(sim.path[0]).toEqual([0, 0, 0]);
    expect(sim.T).toBeCloseTo((2 * v0 * Math.sin(th)) / g, 9);
    // gravity is the only force in flight → exactly one (weight) channel.
    expect(sim.forceChannels.length).toBe(1);
    expect(sim.loop).toBe(false);
  });

  it('free-fall — drops from rest at height H over T = √(2H/g)', () => {
    const H = 20;
    const sim = MECHANICS_RULES['free-fall']({ g, height: H });
    expect(sim.path[0]).toEqual([0, 0, H]);
    expect(sim.T).toBeCloseTo(Math.sqrt((2 * H) / g), 9);
    expect(sim.path[sim.path.length - 1][2]).toBeCloseTo(0, 6);
  });

  it('inclined-plane — when tanθ ≤ μ the body is static (no motion), else it accelerates', () => {
    const stat = MECHANICS_RULES['inclined-plane']({ g, angle: 20, mu: 0.8 }); // tan20°≈0.36 ≤ 0.8
    expect(stat.static).toBe(true);
    expect(stat.path.every((p) => p[0] === stat.path[0][0] && p[2] === stat.path[0][2])).toBe(true);
    const slides = MECHANICS_RULES['inclined-plane']({ g, angle: 40, mu: 0.1 }); // tan40°≈0.84 > 0.1
    expect(slides.static).toBeUndefined();
  });

  it('spring — SHM loops with amplitude-independent period T = 2π√(m/k) and ships analytic energy', () => {
    const m = 1, k = 12;
    const sim = MECHANICS_RULES.spring({ mass: m, k, amplitude: 6 });
    expect(sim.loop).toBe(true);
    expect(sim.T).toBeCloseTo((2 * Math.PI) / Math.sqrt(k / m), 9);
    expect(sim.keArray.length).toBe(MECHANICS_SAMPLES);
    // analytic total energy is flat: ½kA²sin² + ½kx² (with x=Acos) = ½kA² at every sample.
    const halfKA2 = 0.5 * k * 36;
    for (let i = 0; i < sim.path.length; i++) {
      expect(sim.keArray[i] + sim.peArray[i]).toBeCloseTo(halfKA2, 6);
    }
  });

  it('circular — constant speed (equal step lengths), centripetal force, energy opted out', () => {
    const sim = MECHANICS_RULES.circular({ mass: 1, radius: 10, v0: 12 });
    expect(sim.noEnergy).toBe(true);
    const step = (i) => len(sub(sim.path[i + 1], sim.path[i]));
    const s0 = step(0);
    for (let i = 1; i < sim.path.length - 1; i++) expect(step(i)).toBeCloseTo(s0, 6); // uniform speed
  });
});

describe('placeMover — drop a rule into an arbitrary host world', () => {
  it('places the trajectory at `at`, scaled, as a renderer-ready mover', () => {
    const sim = MECHANICS_RULES['free-fall']({ g: 9.8, height: 10 });   // local path starts at [0,0,10]
    const mv = placeMover(sim, { at: [30, 0, 0], scale: 1, group: 'drop' });
    expect(mv.group).toBe('drop');
    expect(mv.path[0]).toEqual([30, 0, 10]);            // origin + rule start
    expect(mv.basePos).toEqual(mv.path[0]);
    expect(mv.path.length).toBe(MECHANICS_SAMPLES);
    expect(mv.loop).toBe(false);                        // inherits the rule's loop
    expect(mv.vdir.length).toBe(MECHANICS_SAMPLES);     // kinematics present for arrows
    expect(mv.period).toBeGreaterThan(0);
  });

  it('scale multiplies the local frame; a looping rule places its tether too', () => {
    const sim = MECHANICS_RULES.pendulum({ g: 9.8, length: 12 });
    const mv = placeMover(sim, { at: [0, 0, 100], scale: 2, loop: true });
    expect(mv.loop).toBe(true);
    expect(mv.tether).toEqual([0, 0, 100 + 12 * 2]);    // pendulum pivot [0,0,L] placed + scaled
  });
});

describe('resolveMotionMovers — operator motion spec → placed movers', () => {
  it('resolves known rules and skips unknown ones without throwing', () => {
    const movers = resolveMotionMovers([
      { rule: 'free-fall', params: { height: 8 }, at: [5, 0, 0], group: 'a' },
      { rule: 'not-a-rule', at: [0, 0, 0] },            // skipped
      { rule: 'projectile', params: { v0: 20, angle: 45 } },
    ]);
    expect(movers.length).toBe(2);
    expect(movers[0].group).toBe('a');
    expect(movers[0].path[0]).toEqual([5, 0, 8]);
  });

  it('defaults the group name by index and tolerates a non-array spec', () => {
    expect(resolveMotionMovers(null)).toEqual([]);
    const [mv] = resolveMotionMovers([{ rule: 'circular', params: { radius: 6, v0: 10 } }]);
    expect(mv.group).toBe('motion0');
  });

  it('MOTION_RULES exposes the Newtonian catalogue by name', () => {
    expect(typeof MOTION_RULES.projectile).toBe('function');
    expect(typeof MOTION_RULES.pendulum).toBe('function');
  });
});
