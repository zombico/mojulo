/**
 * physics-sim — the pure, deterministic integrator behind the `physics` PROPERTY of an
 * actions-world (see actions-world.plan.md). It is the simulated-matter substrate: bodies with
 * mass / restitution / friction / velocity / SPIN, advanced by a fixed-timestep semi-implicit
 * Euler step with a narrow collision set (sphere↔plane, sphere↔sphere, sphere↔aabb), plus
 * autonomous force RULES (wind / drag / attractors) that act with no user input.
 *
 * SINGLE SOURCE OF TRUTH. The whole integrator lives inside `buildSim()`, a self-contained closure
 * that references nothing outside itself. Node imports the live instance below (tested in
 * physics-sim.test.js); the browser `/world` runs the SAME code by emitting `buildSim.toString()`
 * into the page (see scene-three.js physicsChannelScript). There is therefore no second, drifting
 * browser integrator — the live loop and the node tests share one definition byte-for-byte.
 *
 * Determinism: same inputs → byte-identical outputs, so a SEEDED, no-input playthrough is
 * reproducible (that keeps the GIF/.glb degradation story alive for actions-worlds).
 *
 * Rotation: dynamic spheres carry an angular velocity + orientation quaternion with isotropic
 * inertia I = 2/5·m·r². Friction at the contact point couples linear and angular motion, so a ball
 * thrown across the floor starts to roll. Planes and aabbs are static (mass 0, no spin).
 */

// Everything self-contained so `buildSim.toString()` is a complete, runnable unit in the browser.
export function buildSim() {
  // ── vec helpers (inlined, not imported, so the closure stays self-contained) ──
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const vcopy = (a) => [a[0], a[1], a[2]];
  const ZERO = [0, 0, 0];

  // Rest thresholds: a body in contact below BOTH the linear and angular thresholds is snapped to
  // rest (kills jitter, lets stacks settle). A fast-spinning ball is NOT at rest even if its centre
  // is still — so spin has its own threshold.
  const REST_SPEED = 0.05;
  const REST_SPIN = 0.15;
  const CORRECTION = 1.0;            // fraction of penetration removed per step
  const DEFAULT_GRAVITY = [0, 0, -9.8];

  // dot(dir, (invI·(r×dir)) × r) — the angular contribution to a contact's effective mass along
  // `dir`. Zero when invI is 0 (static / no spin) or when r ∥ dir (a sphere's normal arm).
  function angularTerm(invI, r, dir) {
    if (invI === 0) return 0;
    const rxd = cross(r, dir);
    return dot(dir, cross(scl(rxd, invI), r));
  }

  // q' = normalize(q + 0.5·(ω as pure quat)⊗q·dt). Quaternion is [x,y,z,w].
  function integrateOrientation(q, w, dt) {
    const wx = w[0], wy = w[1], wz = w[2];
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const dqx = 0.5 * (wx * qw + wy * qz - wz * qy);
    const dqy = 0.5 * (-wx * qz + wy * qw + wz * qx);
    const dqz = 0.5 * (wx * qy - wy * qx + wz * qw);
    const dqw = 0.5 * (-wx * qx - wy * qy - wz * qz);
    const nx = qx + dqx * dt, ny = qy + dqy * dt, nz = qz + dqz * dt, nw = qw + dqw * dt;
    const n = Math.hypot(nx, ny, nz, nw) || 1;
    return [nx / n, ny / n, nz / n, nw / n];
  }

  // ── body normalization ──
  function normalizeBody(raw, index) {
    raw = raw || {};
    const collider = raw.collider === 'plane' || raw.collider === 'aabb' ? raw.collider : 'sphere';
    const defaultMass = collider === 'sphere' ? 1 : 0;
    const mass = Number.isFinite(raw.mass) ? Math.max(0, raw.mass) : defaultMass;
    const body = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : 'body-' + (index || 0),
      collider,
      mass,
      invMass: mass > 0 ? 1 / mass : 0,
      restitution: Number.isFinite(raw.restitution) ? clamp(raw.restitution, 0, 1) : 0.4,
      friction: Number.isFinite(raw.friction) ? clamp(raw.friction, 0, 1) : 0.2,
      position: Array.isArray(raw.position) ? vcopy(raw.position) : [0, 0, 0],
      velocity: Array.isArray(raw.velocity) ? vcopy(raw.velocity) : [0, 0, 0],
      angularVelocity: Array.isArray(raw.angularVelocity) ? vcopy(raw.angularVelocity) : [0, 0, 0],
      orientation: Array.isArray(raw.orientation) && raw.orientation.length === 4 ? raw.orientation.slice() : [0, 0, 0, 1],
      invInertia: 0,
      resting: false,
    };
    if (collider === 'sphere') {
      body.radius = Number.isFinite(raw.radius) && raw.radius > 0 ? raw.radius : 0.5;
      // isotropic solid-sphere inertia I = 2/5·m·r² → scalar invInertia (0 if static).
      const I = 0.4 * mass * body.radius * body.radius;
      body.invInertia = I > 0 ? 1 / I : 0;
    } else if (collider === 'plane') {
      body.normal = Array.isArray(raw.normal) && len(raw.normal) > 0 ? norm(raw.normal) : [0, 0, 1];
    } else if (collider === 'aabb') {
      body.half = Array.isArray(raw.half) ? raw.half.map((h) => Math.abs(+h) || 0) : [0.5, 0.5, 0.5];
    }
    return body;
  }

  // createState(physics) — normalize a manifest `physics` property into runtime sim state.
  // `forces` are world-level autonomous RULES (wind/drag/attractor) applied to every dynamic body.
  function createState(physics) {
    physics = physics || {};
    const gravity = Array.isArray(physics.gravity) ? vcopy(physics.gravity) : vcopy(DEFAULT_GRAVITY);
    const bodies = Array.isArray(physics.bodies) ? physics.bodies.map(normalizeBody) : [];
    const forces = Array.isArray(physics.forces) ? physics.forces.filter((f) => f && f.kind) : [];
    return { gravity, forces, seed: Number.isFinite(physics.seed) ? physics.seed : 0, bodies, time: 0, contacts: [] };
  }

  // Autonomous force RULES → an extra acceleration on one body (gravity is added separately).
  //   wind:      a constant FORCE [x,y,z] (÷ mass, so heavy bodies resist) — `vector`.
  //   drag:      F = −c·v (÷ mass) — `coefficient`.
  //   attractor: a gravity-like ACCELERATION field strength·dir/(d²+soft²), mass-independent;
  //              `position`, `strength`, optional `softening`, `radius` (cutoff), `repel`.
  function fieldAccel(body, forces) {
    let a = [0, 0, 0];
    for (let i = 0; i < forces.length; i++) {
      const f = forces[i];
      if (f.kind === 'wind' && Array.isArray(f.vector)) {
        a = add(a, scl(f.vector, body.invMass));
      } else if (f.kind === 'drag') {
        const c = Number.isFinite(f.coefficient) ? f.coefficient : 0.1;
        a = add(a, scl(body.velocity, -c * body.invMass));
      } else if (f.kind === 'attractor' && Array.isArray(f.position)) {
        const d = sub(f.position, body.position);
        const dist = len(d);
        if (dist > 1e-4 && (!Number.isFinite(f.radius) || dist <= f.radius)) {
          const soft = Number.isFinite(f.softening) ? f.softening : 0.5;
          const g = (Number.isFinite(f.strength) ? f.strength : 10) / (dist * dist + soft * soft);
          a = add(a, scl(d, (1 / dist) * g * (f.repel ? -1 : 1)));
        }
      }
    }
    return a;
  }

  // ── collision primitives. Each returns null or { normal, depth }; `normal` points from B→A. ──
  function sphereVsPlane(a, p) {
    const signed = dot(sub(a.position, p.position), p.normal) - a.radius;
    if (signed >= 0) return null;
    return { normal: p.normal, depth: -signed };
  }
  function sphereVsSphere(a, b) {
    const d = sub(a.position, b.position);
    const dist = len(d);
    const sum = a.radius + b.radius;
    if (dist >= sum) return null;
    const normal = dist > 1e-9 ? scl(d, 1 / dist) : [0, 0, 1];
    return { normal, depth: sum - dist };
  }
  function sphereVsAabb(a, b) {
    const closest = [0, 1, 2].map((i) => clamp(a.position[i], b.position[i] - b.half[i], b.position[i] + b.half[i]));
    const d = sub(a.position, closest);
    const dist = len(d);
    if (dist >= a.radius) return null;
    if (dist <= 1e-9) {
      const overlaps = [0, 1, 2].map((i) => b.half[i] - Math.abs(a.position[i] - b.position[i]));
      let axis = 0;
      for (let i = 1; i < 3; i++) if (overlaps[i] < overlaps[axis]) axis = i;
      const sign = a.position[axis] >= b.position[axis] ? 1 : -1;
      const normal = [0, 0, 0];
      normal[axis] = sign;
      return { normal, depth: overlaps[axis] + a.radius };
    }
    return { normal: scl(d, 1 / dist), depth: a.radius - dist };
  }
  function detect(a, b) {
    if (a.collider === 'sphere' && b.collider === 'sphere') return sphereVsSphere(a, b);
    if (a.collider === 'sphere' && b.collider === 'plane') return sphereVsPlane(a, b);
    if (a.collider === 'sphere' && b.collider === 'aabb') return sphereVsAabb(a, b);
    return null;
  }

  const combineRestitution = (a, b) => Math.min(a.restitution, b.restitution);
  const combineFriction = (a, b) => Math.sqrt(a.friction * b.friction);

  // The contact arm from a body's centre to the contact point. Only spheres have one (along the
  // normal by their radius); plane/aabb are static so their arm is irrelevant (invInertia 0).
  function contactArm(body, normal, sign) {
    return body.collider === 'sphere' ? scl(normal, sign * body.radius) : [0, 0, 0];
  }

  // Resolve one contact with RIGID-BODY response: positional de-penetration (linear, mass-split),
  // a normal restitution impulse, and a tangential friction impulse — both applied at the contact
  // point so they impart spin (invInertia·(r×J)). `c.normal` points B→A.
  function resolve(a, b, c) {
    const invSum = a.invMass + b.invMass;
    if (invSum <= 0) return;
    // positional correction (linear only), split by inverse mass.
    const push = scl(c.normal, (c.depth * CORRECTION) / invSum);
    a.position = add(a.position, scl(push, a.invMass));
    b.position = sub(b.position, scl(push, b.invMass));

    const rA = contactArm(a, c.normal, -1);   // contact is toward B from A's centre
    const rB = contactArm(b, c.normal, 1);
    const velAt = (body, r) => add(body.velocity, cross(body.angularVelocity, r));
    let rv = sub(velAt(a, rA), velAt(b, rB));
    const vn = dot(rv, c.normal);
    if (vn >= 0) return;   // separating

    // normal impulse (for spheres the normal arm is zero, so this reduces to the linear case).
    const e = combineRestitution(a, b);
    const kn = invSum + angularTerm(a.invInertia, rA, c.normal) + angularTerm(b.invInertia, rB, c.normal);
    const jn = (-(1 + e) * vn) / kn;
    const impN = scl(c.normal, jn);
    a.velocity = add(a.velocity, scl(impN, a.invMass));
    b.velocity = sub(b.velocity, scl(impN, b.invMass));
    a.angularVelocity = add(a.angularVelocity, scl(cross(rA, impN), a.invInertia));
    b.angularVelocity = sub(b.angularVelocity, scl(cross(rB, impN), b.invInertia));

    // friction impulse along the tangent of the post-normal contact velocity, Coulomb-clamped.
    rv = sub(velAt(a, rA), velAt(b, rB));
    const vt = sub(rv, scl(c.normal, dot(rv, c.normal)));
    const tlen = len(vt);
    if (tlen <= 1e-9) return;
    const t = scl(vt, 1 / tlen);
    const kt = invSum + angularTerm(a.invInertia, rA, t) + angularTerm(b.invInertia, rB, t);
    const mu = combineFriction(a, b);
    const jt = clamp(-dot(rv, t) / kt, -mu * jn, mu * jn);
    const impT = scl(t, jt);
    a.velocity = add(a.velocity, scl(impT, a.invMass));
    b.velocity = sub(b.velocity, scl(impT, b.invMass));
    a.angularVelocity = add(a.angularVelocity, scl(cross(rA, impT), a.invInertia));
    b.angularVelocity = sub(b.angularVelocity, scl(cross(rB, impT), b.invInertia));
  }

  // step(state, dt) — advance one fixed timestep. Mutates and returns `state`. Order: integrate
  // (gravity + force rules, then orientation) → detect+resolve all pairs → rest-snap.
  function step(state, dt) {
    dt = dt || 1 / 120;
    const bodies = state.bodies;
    const gravity = state.gravity;
    const forces = state.forces || [];
    for (let k = 0; k < bodies.length; k++) {
      const body = bodies[k];
      if (body.invMass === 0) continue;
      const acc = add(gravity, fieldAccel(body, forces));
      body.velocity = add(body.velocity, scl(acc, dt));
      body.position = add(body.position, scl(body.velocity, dt));
      if (body.invInertia > 0) body.orientation = integrateOrientation(body.orientation, body.angularVelocity, dt);
      body.resting = false;
    }
    const contacts = [];
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        let a = bodies[i];
        let b = bodies[j];
        if (a.collider !== 'sphere' && b.collider === 'sphere') { const t = a; a = b; b = t; }
        const c = detect(a, b);
        if (!c) continue;
        resolve(a, b, c);
        contacts.push({ a: a.id, b: b.id, normal: c.normal, depth: c.depth });
      }
    }
    state.contacts = contacts;
    const touched = {};
    for (let i = 0; i < contacts.length; i++) { touched[contacts[i].a] = 1; touched[contacts[i].b] = 1; }
    for (let k = 0; k < bodies.length; k++) {
      const body = bodies[k];
      if (body.invMass === 0) continue;
      if (touched[body.id] && len(body.velocity) < REST_SPEED && len(body.angularVelocity) < REST_SPIN) {
        body.velocity = vcopy(ZERO);
        body.angularVelocity = vcopy(ZERO);
        body.resting = true;
      }
    }
    state.time += dt;
    return state;
  }

  // simulate(state, dt, steps) — run `steps` fixed steps (no input). Byte-deterministic.
  function simulate(state, dt, steps) {
    dt = dt || 1 / 120;
    steps = steps || 1;
    for (let i = 0; i < steps; i++) step(state, dt);
    return state;
  }

  // addBody(state, raw) — append a body at runtime (used by the spawn action verb / emitters).
  function addBody(state, raw) {
    const body = normalizeBody(raw, state.bodies.length);
    state.bodies.push(body);
    return body;
  }

  return { normalizeBody, createState, step, simulate, addBody, REST_SPEED, REST_SPIN };
}

// Live node instance (tested in physics-sim.test.js). The browser does NOT import these — it runs
// buildSim().toString() so its integrator is this exact source. Keep them in sync via buildSim only.
const _sim = buildSim();
export const normalizeBody = _sim.normalizeBody;
export const createState = _sim.createState;
export const step = _sim.step;
export const simulate = _sim.simulate;
export const addBody = _sim.addBody;
export const REST_SPEED = _sim.REST_SPEED;
export const REST_SPIN = _sim.REST_SPIN;
