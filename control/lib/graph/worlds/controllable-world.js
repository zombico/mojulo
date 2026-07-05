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
 * World convention: z-up, heading = yaw about +Z. Rules: glide, walk, platform (gravity+jump),
 * follow, clock. orbit / physics / path are renderer seams / later (see plan).
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
  const ZERO_INPUT = { forward: 0, strafe: 0, turn: 0, lift: 0, lookDX: 0, lookDY: 0, buttons: 0, jump: 0, jumpHeld: 0 };
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

  // platform — 3D character controller WITH gravity + jump (the platformer rule). Horizontal control
  // is direct + tight like `walk`; the z axis is now DYNAMIC — a vertical velocity (e.vel[2]) that
  // gravity pulls down, a jump launches, and the ground hook lands. The platformer-FEEL knobs live
  // here on purpose: a good platformer is a TUNED controller, not a rigid body — variable jump height
  // (release-to-shorten), coyote time (grace after a ledge), jump buffering (press just before
  // landing), asymmetric gravity (snappier fall), reduced air control. 3D-NATIVE: heading is free, so
  // a 2.5D side-scroller is just this rule with `strafe:0` and a fixed heading — no separate path.
  // Surfaces `grounded` + `jumped`/`landed` edges on the entity (for facts / animation).
  function platform(e, input, dt, world) {
    const r = e.rule;
    const speed = r.speed ?? 6, turnRate = r.turn ?? 2.4, strafe = r.strafe ?? 1, eye = r.eye ?? 0;
    const riseG = r.gravity ?? 20, fallG = r.fallGravity ?? riseG * 1.7;         // asymmetric: snappier fall
    const jumpV = r.jumpSpeed ?? 8.5, maxFall = r.maxFall ?? 26, snap = r.snap ?? 0.15, step = r.step ?? 0.35;
    const coyoteT = r.coyote ?? 0.1, bufferT = r.buffer ?? 0.1, cutV = r.jumpCut ?? 0, air = r.airControl ?? 0.7;
    const t = e.transform;

    // probe the surface under the FEET (from feet + a small step tolerance, looking down): the nearest
    // solid below, IGNORING any platform whose top sits higher than a step above the feet — so you JUMP
    // onto a ledge, you don't warp up by walking into its base. (The renderer's __ground probes from the
    // passed origin; passing feet+step here is what makes that true.)
    const probe = (fz) => (world && world.ground ? world.ground([t.pos[0], t.pos[1], fz + step]) : null);

    // look: A/D tank-turn (default) or full mouse-look (yaw + pitch). In mouselook the MOUSE steers, so
    // A/D (the turn axis) is freed up to STRAFE instead — standard FPS WASD. Pitch is clamped to just
    // shy of straight up/down and drives ONLY the camera, never the (horizontal-plane) movement.
    const lookMode = (r.turnMode ?? 'tank') !== 'tank', lookSens = r.lookSens ?? 0.0025;
    if (lookMode) {
      t.heading = (t.heading + input.lookDX * lookSens) % TAU;
      t.pitch = clamp((t.pitch || 0) + input.lookDY * lookSens, -HALF_PI + 0.05, HALF_PI - 0.05);
    } else t.heading = (t.heading - input.turn * turnRate * dt) % TAU;   // tank: A=left, D=right (heading+ is a LEFT turn)

    // grounded = resting on the surface under the feet, not rising.
    const footZ = t.pos[2] - eye;
    const gz0 = probe(footZ);
    const wasGrounded = e.grounded === true;
    e.grounded = gz0 != null && e.vel[2] <= 1e-4 && Math.abs(footZ - gz0) <= snap;

    // coyote (grace after walking off a ledge) + jump-buffer (press just before touchdown) timers.
    e.coyote = e.grounded ? 0 : Math.min((e.coyote ?? coyoteT) + dt, 1);
    e.jumpBuf = input.jump ? bufferT : Math.max(0, (e.jumpBuf ?? 0) - dt);

    // jump: launch if a press is live/buffered and we are grounded or inside the coyote window.
    let jumped = false;
    if ((input.jump || e.jumpBuf > 0) && (e.grounded || e.coyote < coyoteT)) {
      e.vel[2] = jumpV; e.grounded = false; e.coyote = coyoteT; e.jumpBuf = 0; jumped = true;
    }
    // variable height: releasing jump while still rising caps the climb (short hop vs full jump).
    if (e.vel[2] > 0 && !input.jumpHeld) e.vel[2] = Math.min(e.vel[2], cutV);

    // horizontal move — full authority grounded, reduced in the air. Strafe = Q/E always, plus A/D
    // when mouselook frees them (so A/D actually does something in FPS mode).
    const sideIn = clamp(input.strafe + (lookMode ? input.turn : 0), -1, 1);
    const f = fwdXY(t.heading), rt = rightXY(t.heading), ctl = e.grounded ? 1 : air;
    const fwdMove = input.forward * speed * ctl * dt, sideMove = sideIn * strafe * speed * ctl * dt;
    t.pos = add(t.pos, add(scl(f, fwdMove), scl(rt, sideMove)));

    // vertical — gravity (asymmetric), terminal clamp, integrate, then LAND on the surface below.
    e.vel[2] = Math.max(-maxFall, e.vel[2] - (e.vel[2] > 0 ? riseG : fallG) * dt);
    t.pos[2] += e.vel[2] * dt;
    const gz1 = probe(t.pos[2] - eye);
    let landed = false;
    if (gz1 != null && e.vel[2] <= 0 && t.pos[2] - eye <= gz1 + 1e-4) {
      t.pos[2] = gz1 + eye; e.vel[2] = 0; e.coyote = 0; landed = !wasGrounded; e.grounded = true;
      if (e.jumpBuf > 0) { e.vel[2] = jumpV; e.grounded = false; e.jumpBuf = 0; }   // buffered jump fires on touchdown
    }

    // edges + gait (surfaced to the bus later; drive land-dust / jump-sound / a figure's frame).
    e.jumped = jumped; e.landed = landed;
    // locomotion clip + gait: the DOMINANT planar axis picks which walk cycle plays (a figure-frames
    // body side-STEPS when strafing, walks when going fore/aft — same `speed`, so the cadence matches)
    // and its signed distance drives the phase (back-walk + left/right side-steps play it opposite ways).
    const strideLen = r.stride ?? 2.4;
    if (Math.abs(sideMove) > Math.abs(fwdMove)) { e.locomotion = 'strafe'; e.gaitPhase = (e.gaitPhase || 0) + sideMove / strideLen; }
    else { e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + fwdMove / strideLen; }
    e.moving = (Math.abs(fwdMove) + Math.abs(sideMove)) > 1e-6;
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

  const RULES = { glide, walk, platform, follow, clock };

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
      locomotion: 'forward',   // which walk clip a figure-frames body plays (set by walk/platform rules)
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

  // ── figure delivery math (renderer-ladder.plan.md, Phase 2 rung 1) ────────────────────────────
  // The gait rules above WRITE gaitPhase/locomotion/moving; these two pure helpers are how a
  // figure-frames body READS them smoothly. Baked figure clips have fixed topology (same corner
  // list every frame — the invariant packFigureFrames relies on), so the renderer can lerp corner
  // positions between a frame PAIR instead of snapping to floor(phase·N), and crossfade between
  // locomotion modes (forward↔strafe↔idle) instead of hard-switching geometry.

  // gaitFramePair(N, phase) → { i0, i1, t }: the two frames bracketing a continuous, wrapping
  // phase (negative phases wrap too — strafe left runs the same clip backwards) and the lerp
  // weight between them. N=1 degenerates to a static frame.
  function gaitFramePair(N, phase) {
    if (!(N > 1)) return { i0: 0, i1: 0, t: 0 };
    const ph = ((phase % 1) + 1) % 1;
    const x = ph * N;
    const i0 = Math.min(N - 1, Math.floor(x));
    return { i0, i1: (i0 + 1) % N, t: x - i0 };
  }

  // advanceGaitMix(mix, mode, phase, dt, blendTime) — crossfade bookkeeping between locomotion
  // modes. `mix` is per-body state the renderer owns ({} initially): { mode, phase, prevMode,
  // prevPhase, w }. On a mode switch the OUTGOING pose is frozen at its last phase and faded out
  // over `blendTime` seconds (default 0.18). w ∈ [0,1] is the incoming mode's weight; prevMode is
  // null once the fade completes. dt-driven, so fixed-step replay reproduces it exactly.
  function advanceGaitMix(mix, mode, phase, dt, blendTime) {
    const bt = blendTime > 0 ? blendTime : 0.18;
    if (!mix.mode) { mix.mode = mode; mix.phase = phase; mix.w = 1; mix.prevMode = null; return mix; }
    if (mode !== mix.mode) {
      mix.prevMode = mix.mode;
      mix.prevPhase = mix.phase;
      mix.mode = mode;
      mix.w = 0;
    }
    mix.phase = phase;
    if (mix.w < 1) {
      mix.w = Math.min(1, mix.w + (dt || 0) / bt);
      if (mix.w >= 1) mix.prevMode = null;
    }
    return mix;
  }

  return { RULES, normalizeEntity, createWorld, stepWorld, fwdXY, rightXY, gaitFramePair, advanceGaitMix };
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
export const gaitFramePair = _cw.gaitFramePair;
export const advanceGaitMix = _cw.advanceGaitMix;
export const RULES = _cw.RULES;
