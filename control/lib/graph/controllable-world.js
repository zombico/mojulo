/**
 * controllable-world — ONE primitive for "control a thing in a world" (see
 * controllable-world.plan.md). An entity is a transform (position + heading/pitch) plus a RULE that
 * updates it each frame. The figure, the ball, the drone — and the CAMERA — are all entities; only
 * the rule (what drives the transform) and the body (what it looks like) differ.
 *
 * SINGLE SOURCE OF TRUTH, like physics-sim.js: the whole model lives inside `buildControllable()`,
 * a self-contained closure. Node imports the live instance below (tested in
 * controllable-world.test.js); the browser `/world` runs the SAME code via `buildControllable.toString()`
 * (the renderer wiring lands in Phase 3). No second, drifting copy.
 *
 * Purity: rules consume a NORMALIZED input snapshot (axes already mapped from keys/mouse by the
 * renderer) and a fixed dt, so the same inputs → byte-identical outputs. Ground-snap / wall-slide
 * (raycasts against world geometry) and the physics integrator are passed in as `hooks` by the
 * renderer; the model itself stays geometry-free and deterministic.
 *
 * World convention: z-up, heading = yaw about +Z. Phase 1/2 rules: glide, walk, follow. orbit /
 * physics / path are renderer seams / later (see plan).
 */

export function buildControllable() {
  // ── vec helpers (inlined so the closure is self-contained for browser emission) ──
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const vcopy = (a) => [a[0], a[1], a[2]];

  // headed basis on the XY plane (z-up). forward = facing; right = forward × up.
  const fwdXY = (h) => [Math.cos(h), Math.sin(h), 0];
  const rightXY = (h) => [Math.sin(h), -Math.cos(h), 0];
  // full forward including pitch (for free-flight / look-driven rules).
  const fwd3 = (h, p) => [Math.cos(p) * Math.cos(h), Math.cos(p) * Math.sin(h), Math.sin(p)];

  // frame-rate-independent smoothing factor for a given rate (1/sec): approaches target without
  // depending on dt size. factor → 1 as dt grows, → rate·dt for small dt.
  const smooth = (rate, dt) => 1 - Math.exp(-Math.max(0, rate) * dt);

  // A normalized input snapshot the renderer fills each frame. Pure rules read ONLY this.
  const ZERO_INPUT = { forward: 0, strafe: 0, turn: 0, lift: 0, lookDX: 0, lookDY: 0, buttons: 0 };
  const readInput = (i) => ({ ...ZERO_INPUT, ...(i || {}) });

  const TAU = Math.PI * 2;
  const HALF_PI = Math.PI / 2;

  // ── the RULE shelf: each mutates entity.transform from (entity, input, dt, world) ──

  // glide — free flight with momentum, NO gravity. Look (mouse) steers heading+pitch; W/S/strafe/lift
  // accelerate along the look basis; velocity damps toward rest. The spectator/drone rule.
  function glide(e, input, dt) {
    const r = e.rule;
    const lookSens = r.lookSens ?? 0.0025, accel = r.accel ?? 24, damping = r.damping ?? 4, maxSpeed = r.maxSpeed ?? 18;
    const t = e.transform;
    t.heading = (t.heading + input.lookDX * lookSens) % TAU;
    t.pitch = clamp((t.pitch || 0) + input.lookDY * lookSens, -HALF_PI + 0.05, HALF_PI - 0.05);
    const f = fwd3(t.heading, t.pitch), rt = rightXY(t.heading);
    let a = [0, 0, 0];
    a = add(a, scl(f, input.forward * accel));
    a = add(a, scl(rt, input.strafe * accel));
    a = add(a, scl([0, 0, 1], input.lift * accel));
    let v = add(scl(e.vel, 1 - smooth(damping, dt)), scl(a, dt));   // momentum + damping
    const sp = Math.hypot(v[0], v[1], v[2]);
    if (sp > maxSpeed) v = scl(v, maxSpeed / sp);
    e.vel = v;
    t.pos = add(t.pos, scl(v, dt));
  }

  // walk — ground-locked. `turn:'tank'` (default): A/D rotate heading, W/S move along facing. The
  // figure / FPS rule. Advances a gait phase by signed ground distance so a figure-frames body picks
  // its frame; z is left to the ground hook (flat otherwise). Strafe optional.
  function walk(e, input, dt, world) {
    const r = e.rule;
    const speed = r.speed ?? 6, turn = r.turn ?? 2.2, stride = r.stride ?? 2.4, strafe = r.strafe ?? 0;
    const t = e.transform;
    if ((r.turnMode ?? 'tank') === 'tank') t.heading = (t.heading + input.turn * turn * dt) % TAU;
    else t.heading = (t.heading + input.lookDX * (r.lookSens ?? 0.0025)) % TAU;
    const f = fwdXY(t.heading), rt = rightXY(t.heading);
    const moveF = input.forward * speed * dt;
    const moveS = input.strafe * strafe * speed * dt;
    t.pos = add(t.pos, add(scl(f, moveF), scl(rt, moveS)));
    const ground = world && world.ground ? world.ground(t.pos) : null;   // renderer hook (raycast)
    if (ground != null) t.pos[2] = ground + (r.eye ?? 0);
    const dist = Math.hypot(moveF, moveS);
    e.gaitPhase = ((e.gaitPhase || 0) + (moveF < 0 ? -dist : dist) / stride);
    e.moving = Math.abs(input.forward) + Math.abs(input.strafe) > 1e-3;
  }

  // follow — a chase/over-the-shoulder camera. Eases toward a pose behind+above its target and looks
  // slightly ahead of it. offset 0 + height 0 → rides inside the target (FPV). Not input-driven; it
  // is slaved to the entity you control (control flows input → target → camera).
  function follow(e, input, dt, world) {
    const r = e.rule;
    const tgt = world.byId[r.target];
    if (!tgt) return;
    const dist = r.dist ?? 6, height = r.height ?? 3, shoulder = r.shoulder ?? 0, lead = r.lead ?? 4, lookH = r.lookH ?? 1.5, lerp = r.lerp ?? 8;
    const h = tgt.transform.heading, f = fwdXY(h), rt = rightXY(h);
    const want = add(add(add(vcopy(tgt.transform.pos), scl(f, -dist)), [0, 0, height]), scl(rt, shoulder));
    const k = smooth(lerp, dt);
    e.transform.pos = add(e.transform.pos, scl(sub(want, e.transform.pos), k));
    e.lookAt = add(add(vcopy(tgt.transform.pos), scl(f, lead)), [0, 0, lookH]);
  }

  // clock — autonomous frame playback: advance the gait/anim phase by time, no input. Turns a
  // figure-frames body into a self-playing loop (a turntable / ambient walker). `rate` = cycles/sec.
  function clock(e, input, dt) {
    e.gaitPhase = (e.gaitPhase || 0) + dt * (e.rule.rate ?? 1);
    e.moving = true;
  }

  const RULES = { glide, walk, follow, clock };

  // ── world construction ──
  function normalizeEntity(raw, i) {
    raw = raw || {};
    const tr = raw.transform || {};
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : 'ent-' + i,
      transform: {
        pos: Array.isArray(tr.pos) ? vcopy(tr.pos) : [0, 0, 0],
        heading: Number.isFinite(tr.heading) ? tr.heading : 0,
        pitch: Number.isFinite(tr.pitch) ? tr.pitch : 0,
      },
      rule: raw.rule && raw.rule.type ? { ...raw.rule } : { type: 'static' },
      body: raw.body && raw.body.type ? { ...raw.body } : { type: 'none' },
      isCamera: !!raw.isCamera,
      vel: Array.isArray(raw.vel) ? vcopy(raw.vel) : [0, 0, 0],
      gaitPhase: 0,
      moving: false,
      lookAt: null,
    };
  }

  // createWorld(spec) — normalize { entities, camera } into runtime state. The `camera` sugar
  // (`{ rule, target, ... }`) becomes an isCamera entity appended to the list.
  function createWorld(spec) {
    spec = spec || {};
    const entities = (Array.isArray(spec.entities) ? spec.entities : []).map(normalizeEntity);
    if (spec.camera && spec.camera.rule) {
      entities.push(normalizeEntity({ id: '__camera', isCamera: true, transform: spec.camera.transform, rule: { type: spec.camera.rule, ...spec.camera }, body: { type: 'none' } }, entities.length));
    }
    const byId = {};
    for (const e of entities) byId[e.id] = e;
    const camera = entities.find((e) => e.isCamera) || null;
    return { entities, byId, camera, time: 0 };
  }

  // stepWorld(state, input, dt, hooks) — advance every entity one frame. Non-camera rules run first
  // (so a follow camera reads updated targets), then cameras. `hooks` supplies renderer seams:
  // `hooks.physics(dt)` steps the shared integrator (physics-rule entities read their body back),
  // `hooks.ground(pos)` returns terrain height for walk. Mutates and returns `state`.
  function stepWorld(state, input, dt, hooks) {
    dt = dt || 1 / 60;
    input = readInput(input);
    hooks = hooks || {};
    if (hooks.physics) hooks.physics(dt);
    const world = { byId: state.byId, ground: hooks.ground || null };
    for (const e of state.entities) {
      if (e.isCamera) continue;
      const fn = RULES[e.rule.type];
      if (fn) fn(e, input, dt, world);
    }
    if (state.camera) {
      const fn = RULES[state.camera.rule.type];
      if (fn) fn(state.camera, input, dt, world);
    }
    state.time += dt;
    return state;
  }

  return { RULES, normalizeEntity, createWorld, stepWorld, fwdXY, rightXY };
}

// ── standalone `controllable` world kind ─────────────────────────────────────────────────────────
// Most controllable worlds RIDE on an existing kind (a figure walking a stored city). This assembler
// is for the standalone case: a bare stage (a floor, or caller-supplied `faces`) that exists only to
// host entities, so an entities-only manifest renders without piggybacking on another kind. NOT part
// of the browser-emitted closure — it builds server-side faces like every other assemble*Scene.
function defaultGround(spec = {}) {
  const size = spec.size || 40, cell = spec.cell || 4, n = Math.max(2, Math.round(size / cell));
  const a = spec.colorA || '#2f3b50', b = spec.colorB || '#3b4a64';
  const faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -size / 2 + i * cell, y = -size / 2 + j * cell;
    faces.push({ corners: [[x, y, 0], [x + cell, y, 0], [x + cell, y + cell, 0], [x, y + cell, 0]], fill: (i + j) % 2 ? a : b, doubleSided: true });
  }
  return faces;
}

/**
 * assembleControllableScene(manifest, opts) → payload for emitThreeWorld. The `entities` / `camera`
 * / `figures` are layered on by resolveWorldScene's controllable passthrough (same as on any kind);
 * this just provides the static stage + an initial camera framing.
 */
export function assembleControllableScene(manifest = {}, opts = {}) {
  const faces = Array.isArray(manifest.faces) && manifest.faces.length ? manifest.faces : defaultGround(manifest.ground || {});
  const framing = manifest.worldFraming || manifest.framing || { cameraPosition: [14, -18, 10], lookAt: [0, 0, 1], horizontalFov: 60 };
  return {
    faces,
    cameras: [{ worldFraming: framing }],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: opts.title || manifest.title || 'mojulo controllable world',
    bg: manifest.bg || '#0b1220',
  };
}

// Live node instance (tested in controllable-world.test.js). The browser runs
// buildControllable().toString() (Phase 3), so there is no second copy — keep them in sync via
// buildControllable only.
const _cw = buildControllable();
export const createWorld = _cw.createWorld;
export const stepWorld = _cw.stepWorld;
export const normalizeEntity = _cw.normalizeEntity;
export const RULES = _cw.RULES;
