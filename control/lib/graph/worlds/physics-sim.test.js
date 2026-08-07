import { describe, expect, it } from 'vitest';

import {
  normalizeBody, createState, step, simulate, addBody, REST_SPEED,
} from './physics-sim.js';

const vlen = (v) => Math.hypot(v[0], v[1], v[2]);

const sphere = (over = {}) => ({ collider: 'sphere', position: [0, 0, 10], radius: 0.5, ...over });
const floor = (over = {}) => ({ collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, ...over });

describe('normalizeBody', () => {
  it('defaults a sphere to dynamic mass 1 with finite invMass', () => {
    const b = normalizeBody({ collider: 'sphere' });
    expect(b.mass).toBe(1);
    expect(b.invMass).toBe(1);
    expect(b.radius).toBe(0.5);
  });

  it('defaults a plane and aabb to static (invMass 0)', () => {
    expect(normalizeBody({ collider: 'plane' }).invMass).toBe(0);
    expect(normalizeBody({ collider: 'aabb' }).invMass).toBe(0);
  });

  it('normalizes the plane normal and clamps material props', () => {
    const p = normalizeBody({ collider: 'plane', normal: [0, 0, 5] });
    expect(p.normal).toEqual([0, 0, 1]);
    const s = normalizeBody({ collider: 'sphere', restitution: 9, friction: -2 });
    expect(s.restitution).toBe(1);
    expect(s.friction).toBe(0);
  });

  it('assigns a stable fallback id from the index', () => {
    expect(normalizeBody({}, 3).id).toBe('body-3');
    expect(normalizeBody({ id: 'ball' }, 3).id).toBe('ball');
  });
});

describe('integration (semi-implicit Euler)', () => {
  it('a free body falls under gravity, matching closed-form within a step', () => {
    const s = createState({ gravity: [0, 0, -10], bodies: [sphere({ position: [0, 0, 100] })] });
    simulate(s, 1 / 100, 100); // 1 second
    // semi-implicit Euler overshoots the analytic ½gt²=5 slightly; assert it's in the right ballpark.
    const z = s.bodies[0].position[2];
    expect(z).toBeLessThan(100);
    expect(z).toBeGreaterThan(94);
    expect(z).toBeLessThan(96);
    expect(s.bodies[0].velocity[2]).toBeCloseTo(-10, 1);
  });

  it('a static body never moves', () => {
    const s = createState({ bodies: [floor()] });
    simulate(s, 1 / 120, 240);
    expect(s.bodies[0].position).toEqual([0, 0, 0]);
  });
});

describe('determinism (the invariant that justifies the class)', () => {
  it('two seeded no-input playthroughs are byte-identical', () => {
    const spec = { gravity: [0, 0, -9.8], seed: 7, bodies: [sphere(), sphere({ id: 'b', position: [0.3, 0, 8] }), floor()] };
    const a = simulate(createState(spec), 1 / 120, 600);
    const b = simulate(createState(spec), 1 / 120, 600);
    expect(JSON.stringify(a.bodies)).toBe(JSON.stringify(b.bodies));
  });

  it('a fixed playthrough is stable to its recorded snapshot', () => {
    const s = simulate(createState({ bodies: [sphere(), floor()] }), 1 / 120, 400);
    const ball = s.bodies[0];
    // settles on the floor at z = radius, at rest.
    expect(ball.position[2]).toBeCloseTo(0.5, 2);
    expect(ball.resting).toBe(true);
  });
});

describe('collider: sphere ↔ plane', () => {
  it('bounces with restitution then settles to rest', () => {
    const s = createState({ bodies: [sphere({ restitution: 0.8, position: [0, 0, 5] }), floor()] });
    // run until it rests; capture peak rebound height on the way.
    let bounced = false;
    for (let i = 0; i < 2000; i++) {
      step(s, 1 / 120);
      if (s.bodies[0].velocity[2] > 0.1) bounced = true;
    }
    expect(bounced).toBe(true); // it left the floor at least once
    expect(s.bodies[0].position[2]).toBeCloseTo(0.5, 1);
    expect(s.bodies[0].resting).toBe(true);
    expect(Math.abs(s.bodies[0].velocity[2])).toBeLessThan(REST_SPEED);
  });

  it('a zero-restitution ball does not rebound', () => {
    const s = createState({ bodies: [sphere({ restitution: 0, position: [0, 0, 3] }), floor()] });
    let maxUp = 0;
    for (let i = 0; i < 1200; i++) { step(s, 1 / 120); maxUp = Math.max(maxUp, s.bodies[0].velocity[2]); }
    expect(maxUp).toBeLessThan(0.2);
    expect(s.bodies[0].position[2]).toBeCloseTo(0.5, 1);
  });

  it('reports a contact in state.contacts while touching', () => {
    const s = createState({ bodies: [sphere({ id: 'ball', position: [0, 0, 0.5] }), floor({ id: 'ground' })] });
    step(s, 1 / 120);
    const c = s.contacts.find((x) => x.a === 'ball' && x.b === 'ground');
    expect(c).toBeTruthy();
    expect(c.normal).toEqual([0, 0, 1]);
  });
});

describe('collider: sphere ↔ sphere', () => {
  it('two overlapping equal-mass spheres separate symmetrically', () => {
    const s = createState({ gravity: [0, 0, 0], bodies: [
      sphere({ id: 'a', position: [-0.3, 0, 0], velocity: [1, 0, 0] }),
      sphere({ id: 'b', position: [0.3, 0, 0], velocity: [-1, 0, 0] }),
    ] });
    step(s, 1 / 120);
    // equal masses, head-on, restitution<1 → they should be moving apart (or stopped), not through.
    const [a, b] = s.bodies;
    expect(a.position[0]).toBeLessThan(b.position[0]); // a stays left of b
    expect(a.velocity[0]).toBeLessThanOrEqual(b.velocity[0] + 1e-9); // no inter-penetration velocity
  });

  it('a heavy sphere barely moves when hit by a light one', () => {
    const s = createState({ gravity: [0, 0, 0], bodies: [
      sphere({ id: 'light', mass: 1, position: [-0.3, 0, 0], velocity: [2, 0, 0] }),
      sphere({ id: 'heavy', mass: 1000, position: [0.3, 0, 0], velocity: [0, 0, 0] }),
    ] });
    for (let i = 0; i < 5; i++) step(s, 1 / 120);
    const heavy = s.bodies[1];
    expect(Math.abs(heavy.velocity[0])).toBeLessThan(0.05);
  });
});

describe('collider: sphere ↔ aabb', () => {
  it('a falling ball rests on top of a static box', () => {
    const s = createState({ bodies: [
      sphere({ id: 'ball', position: [0, 0, 5] }),
      { collider: 'aabb', id: 'box', position: [0, 0, 0], half: [1, 1, 1], mass: 0 },
    ] });
    simulate(s, 1 / 120, 800);
    // box top is z=1, ball radius 0.5 → centre rests near z=1.5.
    expect(s.bodies[0].position[2]).toBeCloseTo(1.5, 1);
    expect(s.bodies[0].resting).toBe(true);
  });

  it('pushes a ball out along the nearest face when its centre is inside the box', () => {
    const s = createState({ gravity: [0, 0, 0], bodies: [
      sphere({ id: 'ball', position: [0.9, 0, 0], radius: 0.3 }),
      { collider: 'aabb', id: 'box', position: [0, 0, 0], half: [1, 1, 1], mass: 0 },
    ] });
    step(s, 1 / 120);
    // nearest face is +X (x=1); ball gets pushed toward/through it.
    expect(s.bodies[0].position[0]).toBeGreaterThan(0.9);
  });
});

describe('force rules (autonomous, no input)', () => {
  it('wind pushes a body and is resisted by mass (heavier moves less)', () => {
    const spec = (mass) => createState({ gravity: [0, 0, 0], forces: [{ kind: 'wind', vector: [10, 0, 0] }], bodies: [sphere({ mass, position: [0, 0, 0], velocity: [0, 0, 0] })] });
    const light = simulate(spec(1), 1 / 120, 60);
    const heavy = simulate(spec(10), 1 / 120, 60);
    expect(light.bodies[0].position[0]).toBeGreaterThan(0);
    expect(heavy.bodies[0].position[0]).toBeGreaterThan(0);
    expect(light.bodies[0].position[0]).toBeGreaterThan(heavy.bodies[0].position[0] * 5);
  });

  it('drag bleeds speed toward zero', () => {
    const s = createState({ gravity: [0, 0, 0], forces: [{ kind: 'drag', coefficient: 2 }], bodies: [sphere({ velocity: [8, 0, 0], position: [0, 0, 0] })] });
    const v0 = vlen(s.bodies[0].velocity);
    simulate(s, 1 / 120, 240);
    const v1 = vlen(s.bodies[0].velocity);
    expect(v1).toBeLessThan(v0 * 0.2);
  });

  it('an attractor pulls a body toward it; repel pushes away', () => {
    const pull = createState({ gravity: [0, 0, 0], forces: [{ kind: 'attractor', position: [0, 0, 0], strength: 50 }], bodies: [sphere({ position: [5, 0, 0], velocity: [0, 0, 0] })] });
    simulate(pull, 1 / 120, 60);
    expect(pull.bodies[0].position[0]).toBeLessThan(5);   // drawn inward
    const push = createState({ gravity: [0, 0, 0], forces: [{ kind: 'attractor', position: [0, 0, 0], strength: 50, repel: true }], bodies: [sphere({ position: [5, 0, 0], velocity: [0, 0, 0] })] });
    simulate(push, 1 / 120, 60);
    expect(push.bodies[0].position[0]).toBeGreaterThan(5); // pushed outward
  });

  it('an attractor radius cutoff leaves distant bodies unaffected', () => {
    const s = createState({ gravity: [0, 0, 0], forces: [{ kind: 'attractor', position: [0, 0, 0], strength: 50, radius: 2 }], bodies: [sphere({ position: [5, 0, 0], velocity: [0, 0, 0] })] });
    simulate(s, 1 / 120, 60);
    expect(s.bodies[0].position[0]).toBeCloseTo(5, 6);    // outside the radius → untouched
  });
});

describe('rotation (spin)', () => {
  it('a sphere has isotropic inertia; a static body has none', () => {
    expect(normalizeBody({ collider: 'sphere', mass: 2, radius: 1 }).invInertia).toBeCloseTo(1 / (0.4 * 2 * 1), 9);
    expect(normalizeBody({ collider: 'plane' }).invInertia).toBe(0);
  });

  it('a ball thrown across the floor starts to roll (friction → spin)', () => {
    const s = createState({ bodies: [
      sphere({ id: 'ball', position: [0, 0, 0.5], velocity: [6, 0, 0], friction: 0.6 }),
      floor({ friction: 0.6 }),
    ] });
    simulate(s, 1 / 120, 30);
    // rolling about +Y (x-motion on a +Z floor → ω_y negative by right-hand rule).
    expect(Math.abs(s.bodies[0].angularVelocity[1])).toBeGreaterThan(0.5);
  });

  it('a ball dropped straight down does not spin', () => {
    const s = createState({ bodies: [sphere({ position: [0, 0, 5], velocity: [0, 0, 0] }), floor()] });
    simulate(s, 1 / 120, 400);
    expect(vlen(s.bodies[0].angularVelocity)).toBeLessThan(1e-6);
  });

  it('orientation stays a unit quaternion through a spin', () => {
    const s = createState({ bodies: [sphere({ position: [0, 0, 0.5], velocity: [6, 0, 0], friction: 0.6 }), floor({ friction: 0.6 })] });
    simulate(s, 1 / 120, 120);
    const q = s.bodies[0].orientation;
    expect(Math.hypot(q[0], q[1], q[2], q[3])).toBeCloseTo(1, 6);
  });

  it('rest-snap zeros a tiny residual spin in contact', () => {
    // a ball barely touching the floor with sub-threshold velocity AND spin (no rolling resistance
    // in the model, so a fast roll would continue forever — this exercises the jitter-kill snap).
    const s = createState({ gravity: [0, 0, 0], bodies: [
      sphere({ id: 'ball', position: [0, 0, 0.49], velocity: [0.01, 0, 0], angularVelocity: [0, 0.05, 0] }),
      floor(),
    ] });
    step(s, 1 / 120);
    expect(s.bodies[0].resting).toBe(true);
    expect(vlen(s.bodies[0].velocity)).toBe(0);
    expect(vlen(s.bodies[0].angularVelocity)).toBe(0);
  });
});

describe('addBody (runtime spawn / emitters)', () => {
  it('appends a normalized body that the next step integrates', () => {
    const s = createState({ bodies: [floor()] });
    const b = addBody(s, { id: 'spawned', collider: 'sphere', position: [0, 0, 10] });
    expect(s.bodies.length).toBe(2);
    expect(b.id).toBe('spawned');
    step(s, 1 / 120);
    expect(s.bodies[1].position[2]).toBeLessThan(10);   // it fell
  });
});
