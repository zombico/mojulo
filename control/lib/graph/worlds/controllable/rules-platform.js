/**
 * rules-platform.js — the platform rule: the 3D character controller WITH gravity + jump
 * (controllable-split.plan.md, S4). Horizontal control is direct + tight like `walk`; the z axis
 * is dynamic — gravity, jump, the ground hook. The platformer-FEEL knobs live here on purpose:
 * ground acceleration, variable jump height, coyote time, jump buffering, asymmetric gravity,
 * reduced air control, stop-and-charge leaps, kneel, SPACE mode (6DoF Newtonian float), and the THRUSTER layer (boost
 * speed/gauge/overheat/hover/flame) — engine features, all opt-in per rule.
 *
 * THE MANEUVER SEAM (S4): the combat/pack maneuvers that used to be woven inline (dodge, tackle,
 * loadout cycling, melee strike/throw) are now REGISTERED PHASES over a shared per-frame ctx:
 *   maneuver → equip → [boost flags + kneel] → act → [surface/move] → dash → [vertical] → claim
 * Each hook reads/writes the same ctx fields the inline code shared (dodging/tackling/swinging/
 * boosting/activeCfg/…), at the same points in the frame — behavior-identical by construction,
 * pinned by the golden traces and the phase-order test. A composition without a pack simply has
 * empty phases: the base platformer (+ combat's strike, which registers from combat-melee) runs.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; core precedes this in EMISSION.
 */

export function buildRulesPlatform(E) {
  const {
    add, scl, clamp, smooth, fwdXY, rightXY, fwd3, laneNear, TAU, HALF_PI,
    resolveBlocking, resolveBlocking3D, RULES, registerSuppressedTick,
  } = E;

  // ── the platform-phase registry: maneuvers plug in here (ms pack, combat-melee) ──
  const PHASES = { maneuver: [], equip: [], act: [], dash: [], claim: [] };
  const registerPlatformManeuver = (phase, key, fn, order) => {
    const l = PHASES[phase];
    l.push({ key, fn, order: order ?? 100 });
    l.sort((a, b) => a.order - b.order);
  };
  const runPhase = (phase, e, input, dt, world, ctx) => { for (const h of PHASES[phase]) h.fn(e, input, dt, world, ctx); };
  // claim: the first hook that CLAIMS the locomotion (returns true) wins; the base ladder runs otherwise.
  const runClaims = (e, input, dt, world, ctx) => { for (const h of PHASES.claim) if (h.fn(e, input, dt, world, ctx)) return true; return false; };
  const platformPhaseOrder = () => Object.fromEntries(Object.entries(PHASES).map(([p, l]) => [p, l.map((h) => h.key)]));

  // THE DASH'S BURST (`dash`, below): its share of the way through (0 → 1); the speed it drives at there — up from where
  // it started to the card's over the first DASH_RISE (eased out), held to DASH_EASE, then eased down to the run's
  const DASH_RISE = 0.25, DASH_EASE = 0.6;
  const dashU = (e) => (e.dashLen > 0 ? 1 - e.dashT / e.dashLen : 1);
  function dashNow(e, run) {
    const u = dashU(e), top = e.dashSpeed, from = Math.min(top, e.dashFrom || 0), end = Math.min(run, top);
    if (u < DASH_RISE) { const k = u / DASH_RISE; return from + (top - from) * (1 - (1 - k) * (1 - k)); }
    if (u < DASH_EASE) return top;
    const k = (u - DASH_EASE) / (1 - DASH_EASE);
    return top + (end - top) * k * k * (3 - 2 * k);
  }

  function platform(e, input, dt, world) {
    const r = e.rule;
    // A PERSON WALKS AND RUNS (opt-in `walkSpeed`, a hero's: playscape/player.js): no thrusters, so F is nothing of its
    // own. The stick's travel is the pace (below, once the stick is read): a key, full travel, runs at `speed`; a pad's
    // stick walks under `runAt` of its travel and runs past it; the walk key held (`input.walk`) walks. A rule whose F is
    // its gear's (`gear`) or a space suit keeps the boost. Absent → the boost below, byte-identical.
    const walker = r.walkSpeed > 0 && r.space !== true && !r.gear;
    // A HERO SPRINTS ON ITS STAMINA (opt-in `stamina: true`, a feel's: gameworld/feel/lower.js): the boost held is a sprint on the ground,
    // a walker's too, at `boostSpeed` along the stick (never with the stick at rest, never in the air), its legs the run's
    // clip faster, never a thruster's lean; the GAUGE is its STAMINA (`boostMax` seconds of sprint, `boostRegen` back,
    // empty is WINDED until `boostUnlockFrac` of it refills at `overheatRegen`), a jump free of it unless `jumpBoostCost`
    // says. Absent → the boost as it was, byte-identical.
    const sprints = r.stamina === true && r.space !== true;
    // (F is the feel's when its card gives it one, a dash or a run button: never the thrusters, walk pace or none, as on
    // a side-scroller's lane, whose hero only runs)
    const ownF = !!(r.dash || r.sprint) && r.space !== true && !r.gear;
    let speed = r.speed ?? 6;
    const turnRate = r.turn ?? 2.4, strafe = r.strafe ?? 1, eye = r.eye ?? 0;
    const boostSpeed = r.boostSpeed ?? speed * 3.5;
    const riseG = r.gravity ?? 20, fallG = r.fallGravity ?? riseG * 1.7;         // asymmetric: snappier fall
    const jumpV = r.jumpSpeed ?? 8.5, maxFall = r.maxFall ?? 26, snap = r.snap ?? 0.15, step = r.step ?? 0.35;
    const coyoteT = r.coyote ?? 0.1, bufferT = r.buffer ?? 0.1, cutV = r.jumpCut ?? 0, air = r.airControl ?? 0.7;
    const accel = r.accel > 0 && r.space !== true ? r.accel : 0, decel = r.decel > 0 ? r.decel : accel;   // ground acceleration (opt-in, below)
    const t = e.transform;

    // SPACE MODE (opt-in `space:true`, R18) — the second play mode: no gravity, no ground, everyone
    // FLOATS in a true 3-axis void. The vertical + horizontal integrate becomes 6DoF NEWTONIAN drift
    // (momentum + damping along the full look basis, like the `glide` rule), and the locomotion→clip
    // ladder becomes THRUST poses instead of walk strides. Everything else — fire, loadout, the suit
    // switcher, the boost gauge, melee/throw, stagger, the aim lock — is the SHARED ground code,
    // untouched. There is no jump and no kneel in space: Space (`jumpHeld`) = ASCEND, X (`kneel`) =
    // DESCEND, F = boost (same keys, reinterpreted by mode). Absent `space` → the entire ground path
    // below runs behavior-identical.
    const space = r.space === true;
    const ascend = space && !!input.jumpHeld;    // Space held → thrust up (no jump in space)
    const descend = space && !!input.kneel;      // X held → thrust down (no kneel in space)

    // probe the surface under the FEET (from feet + a small step tolerance, looking down): the nearest
    // solid below, IGNORING any platform whose top sits higher than a step above the feet — so you JUMP
    // onto a ledge, you don't warp up by walking into its base. (The renderer's __ground probes from the
    // passed origin; passing feet+step here is what makes that true.)
    const probe = (fz) => (world && world.ground ? world.ground([t.pos[0], t.pos[1], fz + step]) : null);

    // BOOST GAUGE (opt-in `boostMax`, in SECONDS of continuous thrust): boosting drains it in
    // real time, jumps bite `jumpBoostCost` (default 0.8 — legs still jump at empty, the
    // thruster assist just isn't there to pay for), an acrobatic dodge OVERHEATS it outright
    // (dumps the gauge + locks it) unless a modifier exempts it (`dodgeOverheat:false` heat sink →
    // cost-only + chainable; `dodgeBoostCost:0` → free rolls), and changing the dash direction
    // mid-boost bites `boostTurnCost` (default 0.75 — the vectoring modifier). It refills to full
    // in ~5s (`boostRegen`, default boostMax/5 per sec) whenever the thrusters are cold; hitting
    // empty (or overheating) LOCKS them — the OVERHEAT state, thrust dead — until 15% recovers so
    // the cutoff doesn't flutter. No `boostMax` → no gauge: infinite boost,
    // every pre-gauge world behavior-identical.
    const boostMax = r.boostMax > 0 ? r.boostMax : 0;
    const hasGauge = boostMax > 0;
    if (hasGauge && e.boost == null) e.boost = boostMax;
    const payBoost = (cost) => { if (hasGauge && cost > 0) e.boost = Math.max(0, e.boost - cost); };
    const jumpCost = r.jumpBoostCost ?? (sprints ? 0 : 0.8);

    // look: A/D tank-turn (default) or full mouse-look (yaw + pitch). In mouselook the MOUSE steers, so
    // A/D (the turn axis) is freed up to STRAFE instead — standard FPS WASD. Pitch is clamped to just
    // shy of straight up/down and drives ONLY the camera, never the (horizontal-plane) movement.
    const lookMode = space || (r.turnMode ?? 'tank') !== 'tank', lookSens = r.lookSens ?? 0.0025;   // space is always 6DoF mouse-look
    let turnAmt;   // heading delta THIS frame — drives the turn-in-place step below
    // WORLD MOVEMENT (opt-in `move: 'world'`, ground only): W/A/S/D make one vector in the frame of a fixed camera
    // (`moveYaw`, the way up the screen points; π/2 is north). The body moves along it and turns toward it at
    // `faceRate` rad/s, so W walks up the screen whichever way the hero faces. The `overhead` camera's partner.
    // LANE MOVEMENT (opt-in `move: 'lane'` with `lane`, a polyline [[x, y], …] on the ground plane): the side-scroller's
    // rule. D runs along the lane the way it was drawn, A back, W/S do nothing; the body faces its run and is held on the
    // line after every step (below), however the line bends. The `side` camera's partner.
    // CAMERA MOVEMENT (opt-in `move: 'camera'`, a 3D platformer's): world movement whose frame is the camera's live yaw
    // (a steered chase publishes it, rules-basic.js follow `steer`), so the stick's up runs away from the camera however
    // it has turned; with no steered camera, the hero's own heading
    const laneMove = !space && r.move === 'lane' && Array.isArray(r.lane) && r.lane.length >= 2;
    const camMove = !space && r.move === 'camera';
    const worldMove = !space && (r.move === 'world' || laneMove || camMove);
    let wmX = 0, wmY = 0, wmMag = 0;
    if (worldMove) {
      const side = clamp(input.strafe + input.turn, -1, 1);
      if (laneMove) {
        const L = laneNear(r.lane, t.pos[0], t.pos[1], side);
        wmX = L.tx * side; wmY = L.ty * side;
      } else {
        const my = camMove ? (world && world.cameraYaw != null ? world.cameraYaw : t.heading) : (r.moveYaw ?? HALF_PI), wf = fwdXY(my), wr = rightXY(my);
        wmX = wf[0] * input.forward + wr[0] * side; wmY = wf[1] * input.forward + wr[1] * side;
      }
      wmMag = Math.min(1, Math.hypot(wmX, wmY));
      turnAmt = 0;
      if (wmMag > 1e-3) {
        const d = ((Math.atan2(wmY, wmX) - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI, mx = (r.faceRate ?? 12) * dt;
        turnAmt = clamp(d, -mx, mx);
        t.heading = (t.heading + turnAmt) % TAU;
      }
    } else if (lookMode) {
      turnAmt = input.lookDX * lookSens;
      t.heading = (t.heading + turnAmt) % TAU;
      t.pitch = clamp((t.pitch || 0) + input.lookDY * lookSens, -HALF_PI + 0.05, HALF_PI - 0.05);
    } else { turnAmt = -input.turn * turnRate * dt; t.heading = (t.heading + turnAmt) % TAU; }   // tank: A=left, D=right (heading+ is a LEFT turn)

    // grounded = resting on the surface under the feet, not rising. In SPACE there is no surface —
    // the unit is never grounded, so the airborne/thrust locomotion path is always live.
    const footZ = t.pos[2] - eye;
    let landedEdge = false;
    if (space) {
      e.grounded = false;
    } else {
      const gz0 = probe(footZ);
      const wasGrounded = e.grounded === true;
      // impact speed carried into this frame (before gravity), captured on the LANDING edge below.
      const fallSpeed = wasGrounded ? 0 : Math.max(0, -e.vel[2]);
      e.grounded = gz0 != null && e.vel[2] <= 1e-4 && Math.abs(footZ - gz0) <= snap;
      // LANDING edge = the grounded rising transition. Derived here (not from the hard-touchdown snap
      // at the bottom) because `snap` grounds the unit a few frames before it actually touches, which
      // would otherwise swallow the edge on any fall faster than `snap` per frame. Fires once; the
      // renderer's landing CLANG reads it + the captured fall speed (e.landVel) for loudness.
      landedEdge = e.grounded && !wasGrounded;
      if (landedEdge) e.landVel = fallSpeed;

      // coyote (grace after walking off a ledge) + jump-buffer (press just before touchdown) timers.
      e.coyote = e.grounded ? 0 : Math.min((e.coyote ?? coyoteT) + dt, 1);
      e.jumpBuf = input.jump ? bufferT : Math.max(0, (e.jumpBuf ?? 0) - dt);
    }

    // movement basis (needed by the jump block below for directed charge leaps)
    // under world movement the whole input is one forward push along the input vector (no strafe), so every reader
    // below (the dash, the boost, the clips) sees a body running where the stick points
    const fwdIn = worldMove ? wmMag : input.forward;
    const sideIn = worldMove ? 0 : clamp(input.strafe + (lookMode ? input.turn : 0), -1, 1);
    const wmH = worldMove && wmMag > 1e-3 ? Math.atan2(wmY, wmX) : null;
    const f = fwdXY(wmH ?? t.heading), rt = rightXY(wmH ?? t.heading), ctl = e.grounded ? 1 : air;
    // A PERSON'S PACE (`walkSpeed`): the stick's travel, 0 to 1. Under `runAt` (0.6) a pad's stick WALKS, its pace rising
    // with the push to `walkSpeed` (the `walk` clip over `walkStride`); past it the body RUNS, from `walkSpeed` up to the
    // run's `speed` at full travel (`forward` over `stride`), the two meeting where the stick crosses. A key is full
    // travel: W runs. The walk key held (`input.walk`) caps the pace at the walk's. `speed` becomes the scale that turns
    // the stick's travel into that pace, so every reader below (the drive, the step, the air) moves at it.
    const travel = walker ? Math.min(1, Math.hypot(fwdIn, sideIn)) : 0, runAt = r.runAt ?? 0.6;
    const walking = walker && travel > 1e-6 && (!!input.walk || travel < runAt);
    // THE RUN BUTTON (opt-in `sprint`, a feel card's `ground.sprint` with its takes, a dash-less hero's F): held while
    // running on the ground, the run's top speed builds toward `sprint.speed` over `sprint.build` seconds, and eases back
    // over `sprint.fall` once let go (or the body stops or walks); the air keeps what it had. Momentum, not a move: the
    // drive (`accel`) carries the body up to the speed as it builds. Absent → the run as it was.
    if (ownF && r.sprint && !r.dash) {
      const S = r.sprint, push = !!input.boost && Math.hypot(fwdIn, sideIn) > 1e-3 && !walking;
      if (e.grounded) e.sprintK = push ? Math.min(1, (e.sprintK || 0) + dt / S.build) : Math.max(0, (e.sprintK || 0) - dt / S.fall);
      if (e.sprintK > 0) speed += (S.speed - speed) * e.sprintK;
    }
    if (walker && travel > 1e-6) {
      const pace = walking ? r.walkSpeed * Math.min(1, travel / runAt) : r.walkSpeed + (speed - r.walkSpeed) * (travel - runAt) / (1 - runAt);
      speed = pace / travel;
    }

    // jump — two opt-in shapes on top of the default snappy launch:
    // `jumpWindup` (seconds) inserts a brief SQUAT between press and launch;
    // `chargeMax` (seconds) replaces the whole press model with STOP-AND-CHARGE:
    // holding Space roots the entity and coils the squat (locomotion 'squat',
    // gaitPhase = charge fraction → the clip's depth ramp); releasing launches
    // with jump velocity scaled by the charge (0.6× at a tap → `chargeMult`×
    // at full); reaching full charge AUTO-LAUNCHES toward the held WASD
    // direction — a directed leap carried by a horizontal dash velocity
    // (`chargeDash`, world-space, cleared on landing). Neither param set →
    // byte-identical legacy timing (buffer/coyote/jump-cut intact).
    const windup = r.jumpWindup ?? 0;
    const chargeMax = r.chargeMax ?? 0;
    let jumped = false, airJumped = false;
    let charging = false;
    let chargeFrac = 0;   // 0..1 while gathering — the renderer reads it for the charge-up sound
    if (space) {
      // no jump / charge / jump-cut in space — Space is ASCEND, handled by the 6DoF integrate below.
    } else if (chargeMax > 0) {
      const active = e.jumpCharge >= 0;
      if (!active && input.jumpHeld && e.grounded && !input.boost) e.jumpCharge = 0;
      if (e.jumpCharge >= 0) {
        if (!e.grounded || input.boost) e.jumpCharge = -1;   // lost footing / boost cancels
        else {
          e.jumpCharge += dt;
          const frac = Math.min(1, e.jumpCharge / chargeMax);
          chargeFrac = frac;
          if (!input.jumpHeld || frac >= 1) {
            const vmul = 0.6 + ((r.chargeMult ?? 2.2) - 0.6) * frac;
            e.vel[2] = jumpV * vmul;
            e.jumpPower = frac;   // the launch power (0..1) — the release SOUND scales on it
            e.grounded = false; e.coyote = coyoteT; jumped = true;
            if (frac >= 1) {
              // full charge: leap toward the held direction (normalized, world-space)
              const dn = Math.hypot(fwdIn, sideIn);
              if (dn > 1e-3) {
                const dashSpd = r.chargeDash ?? speed * 1.6;
                e.dashVel = [
                  (f[0] * fwdIn + rt[0] * sideIn) / dn * dashSpd,
                  (f[1] * fwdIn + rt[1] * sideIn) / dn * dashSpd,
                ];
              }
            }
            e.jumpCharge = -1;
          } else {
            charging = true;
            e.gaitPhase = frac * 0.9;   // drive the squat clip's depth ramp (below the wrap point)
          }
        }
      }
    } else {
      if ((input.jump || e.jumpBuf > 0) && (e.grounded || e.coyote < coyoteT) && !(e.jumpWind > 0)) {
        if (windup > 0) { e.jumpWind = windup; e.jumpBuf = 0; }
        else { e.vel[2] = jumpV; e.grounded = false; e.coyote = coyoteT; e.jumpBuf = 0; jumped = true; }
      }
      if (e.jumpWind > 0) {
        e.jumpWind -= dt;
        e.gaitPhase = (1 - Math.max(0, e.jumpWind) / windup) * 0.9;   // quick dip down the same squat ramp
        if (e.jumpWind <= 0) { e.jumpWind = 0; e.vel[2] = jumpV; e.grounded = false; e.coyote = coyoteT; jumped = true; }
      }
      // THE WALL KICK (opt-in `cling`, a feel card's: gameworld/feel/lower.js): a jump pressed against a wall (or within
      // `cling.coyote` seconds of leaving it) kicks off it, before any air jump: up at `cling.kick`, away along the wall's
      // normal at `cling.away` (with the dash held, a `dash.wall` card kicks at the dash's speed and keeps it), the stick
      // locked out for `cling.lock` seconds. Absent `cling` → nothing here runs.
      if (r.cling && input.jump && !jumped && !e.grounded && e.wallN && (e.cling || (e.wallCoyote ?? 0) > 0)) {
        const dashKick = !!(r.dash && r.dash.wall && input.boost), away = dashKick ? r.dash.speed : r.cling.away;
        e.vel[2] = r.cling.kick; e.kick = [e.wallN[0] * away, e.wallN[1] * away]; e.kickT = r.cling.lock; e.carry = dashKick ? away : 0;
        e.cling = null; e.wallCoyote = 0; e.jumpBuf = 0; jumped = true;
        if (e.drive) { e.drive[0] = e.kick[0]; e.drive[1] = e.kick[1]; }
      }
      // AIR JUMPS (opt-in `airJumps`, a power's double jump): a press in the air, past the coyote grace, launches again at
      // once (no wind-up) at `airJumpMult` of the jump speed; the count resets on the ground. Absent → nothing here runs.
      const airJumps = r.airJumps ?? 0;
      if (airJumps > 0) {
        if (e.grounded) e.airJumpsUsed = 0;
        else if (input.jump && !jumped && !(e.jumpWind > 0) && e.coyote >= coyoteT && (e.airJumpsUsed ?? 0) < airJumps) {
          e.vel[2] = jumpV * (r.airJumpMult ?? 0.9); e.airJumpsUsed = (e.airJumpsUsed ?? 0) + 1; e.jumpBuf = 0; jumped = true; airJumped = true;
        }
      }
      // variable height: releasing jump while still rising caps the climb (short hop vs full jump).
      // A rider thrown by a launcher (`launchedBy`, cleared on landing) is not jumping: its climb is the throw's.
      if (e.vel[2] > 0 && !input.jumpHeld && !e.launchedBy) e.vel[2] = Math.min(e.vel[2], cutV);
    }
    // surface the charge state for the renderer's jump audio: `charging`/`chargeFrac` drive the
    // rising GATHER whine, `jumpPower` (0..1) scales the RELEASE on launch. A non-charge (tap/windup)
    // jump has no ramp, so it launches at a fixed light power.
    e.charging = charging;
    e.chargeFrac = charging ? chargeFrac : 0;
    if (jumped && chargeMax <= 0) e.jumpPower = 0.2;

    // THE DASH (opt-in `dash`, a feel card's, a person's F: gameworld/feel/lower.js): a BURST, its length the card's
    // whatever the button does. Pressed on the ground it drives the body along the stick (its facing with the stick at
    // rest), from the speed it had up to `dash.speed` over the burst's first share, held there, then eased back down to
    // the run's by its end (dashNow); the body leaves it at the run's speed. Pressed in the air, an AIR DASH (`dash.air`:
    // so many an airtime, given back by the ground and a wall): the same burst on its own line, the fall stopped while it
    // is at speed and given back as it eases. A jump in a ground dash is a DASH JUMP (`dash.jump`): it leaves at once and
    // the air keeps the speed the burst had (`e.carry`) to the touch-down. Absent `dash` → nothing here runs.
    const DS = r.dash && ownF && !space ? r.dash : null;
    if (DS) {
      const press = !!input.boost && !e.dashHeld; e.dashHeld = !!input.boost;
      if (e.grounded && !jumped) { e.airDashes = DS.air ? DS.air.count : 0; e.carry = 0; }
      if (e.dashT > 0 && jumped && !e.dashAir) { if (DS.jump) e.carry = Math.max(speed, dashNow(e, speed)); e.dashT = 0; }
      if (press && !(e.dashT > 0) && !e.cling && !(e.kickT > 0)) {
        const air = !e.grounded;
        if (!air || (DS.air && e.airDashes > 0)) {
          const wx = f[0] * fwdIn + rt[0] * sideIn, wy = f[1] * fwdIn + rt[1] * sideIn, wm = Math.hypot(wx, wy), F0 = fwdXY(t.heading);
          e.dashDir = wm > 1e-3 ? [wx / wm, wy / wm] : [F0[0], F0[1]];
          // (the speed it starts from: the body's own along the dash, never back past rest)
          const dv = e.drive ? e.drive[0] * e.dashDir[0] + e.drive[1] * e.dashDir[1] : 0;
          e.dashAir = air; e.dashSpeed = air ? DS.air.speed : DS.speed; e.dashT = e.dashLen = air ? DS.air.time : DS.time; e.dashFrom = Math.max(0, dv);
          if (!air && e.dashGait == null) e.dashGait = e.gaitPhase || 0;   // (the stride cycle kept for after the lunge)
          if (air) { e.airDashes--; e.vel[2] = 0; }
        }
      }
      // the dash jump's speed held through the air, the stick still steering it; the ground ends an air dash
      if (e.carry > speed && !e.grounded) speed = e.carry;
      if (e.grounded && e.dashAir && e.dashT > 0 && !jumped) e.dashT = 0;
    }
    // the ground lets go of the wall; off it, the kick's grace counts down
    if (r.cling && !space) {
      if (e.grounded && !jumped) { e.cling = null; e.wallCoyote = 0; e.kickT = 0; }
      else if (!e.cling && e.wallCoyote > 0) e.wallCoyote = Math.max(0, e.wallCoyote - dt);
    }


    // ── S4 maneuver seams: the shared per-frame ctx the phase hooks read/write ──
    const ctx = {
      r, t, space, ascend, descend, eye, speed, boostSpeed, strafe, hasGauge, probe, f, rt, ctl, sideIn, lookMode,
      charging, jumped, dodging: false, tackling: false, kneeling: false, swinging: false, boosting: false,
      activeCfg: null, strideLen: 0,
    };
    runPhase('maneuver', e, input, dt, world, ctx);   // dodge + tackle (ms pack)
    const dodging = ctx.dodging, tackling = ctx.tackling;
    runPhase('equip', e, input, dt, world, ctx);      // loadout weapon cycling (ms pack)

    // horizontal move — full authority grounded, reduced in the air. Strafe = Q/E always, plus A/D
    // when mouselook frees them (so A/D actually does something in FPS mode).
    // The BOOST GAUGE gates thrust: an empty (or locked-recovering) gauge means F does nothing
    // until 15% refills. No gauge (hasGauge false) → always available (infinite boost).
    // BOOST-CANCEL MELEE (R22): a melee opener may CUT the thrust (`e.boostCut`, set in the
    // strike block below) — the cancel is a cancel, not a pause: F stays dead until the key is
    // RELEASED, then a fresh press dashes again.
    const boostAvailable = !hasGauge || (e.boost > 1e-6 && !e.boostLock);
    if (!input.boost) e.boostCut = false;
    let boosting = (!walker || sprints) && !ownF && !!input.boost && !dodging && !tackling && boostAvailable && !e.boostCut && (!sprints || (e.grounded && Math.abs(fwdIn) + Math.abs(sideIn) > 1e-3));
    // KNEEL (opt-in `kneel:true` on the rule; held X): a grounded one-knee
    // hold — roots the entity and plays the 'kneel' clip. Boost and the
    // charge jump both take precedence (either input stands the unit up).
    const kneeling = r.kneel === true && !!input.kneel && e.grounded && !boosting && !charging && !dodging && !tackling;

    ctx.boosting = boosting; ctx.kneeling = kneeling;
    runPhase('act', e, input, dt, world, ctx);        // melee strike + throw (combat-melee)
    boosting = ctx.boosting;                          // a melee boost-cancel may have CUT the thrust
    const swinging = ctx.swinging;

    // BOOST ARMOR (R23): surface the live boost state so the hit adjudicators (stepWeapon /
    // burstProjectile, run later in stepWorld) can read whether THIS suit is thrusting when a
    // stun lands — a boosting suit with `body.boostArmor` halves incoming stun (below). Final here:
    // `boosting` is settled (a melee boost-cancel already flipped it false, so a cancelled dash
    // is unarmored — you're planted and swinging, not thrusting).
    e.boosting = boosting;
    // boost thrust vector from the held direction keys (normalized; plain F = forward)
    let bf = boosting ? fwdIn : 0, bs = boosting ? sideIn : 0;
    if (boosting && Math.abs(bf) + Math.abs(bs) < 1e-3) bf = 1;
    const bn = Math.hypot(bf, bs) || 1;
    // STOP-AND-CHARGE (and the kneel, the melee strike, the dodge) root the
    // entity's normal drive — the dodge substitutes its own committed dash.
    const halt = charging || kneeling || swinging || dodging || tackling ? 0 : 1;
    let fwdMove = 0, sideMove = 0;   // the ground planar step this frame (drives the ground locomotion phase)
    if (space) {
      // 6DoF NEWTONIAN drift: accelerate along the full look basis (fwd3 = heading + pitch) + a
      // vertical Space/X trim, damp toward rest, clamp to a mode speed cap (boost raises accel AND
      // cap). No gravity, no ground. A swing halts NEW thrust but momentum coasts — you drift on.
      // Plain F with no stick (like the ground bf=1 default) thrusts along the look forward.
      const boostK = boosting ? (r.spaceBoostAccel ?? 2) : 1;
      const sAccel = (r.spaceAccel ?? speed * 4) * boostK;
      const sMax = boosting ? (r.spaceBoostMax ?? boostSpeed) : (r.spaceMaxSpeed ?? speed * 2);
      const f3 = fwd3(t.heading, t.pitch || 0), rt3 = rightXY(t.heading);
      let inF = fwdIn, inS = sideIn, inV = (ascend ? 1 : 0) - (descend ? 1 : 0);
      if (boosting && Math.abs(inF) + Math.abs(inS) + Math.abs(inV) < 1e-3) inF = 1;
      let a = [0, 0, 0];
      a = add(a, scl(f3, inF * sAccel * halt));
      a = add(a, scl(rt3, inS * strafe * sAccel * halt));
      a = add(a, scl([0, 0, 1], inV * (r.liftAccel ?? (speed * 4)) * boostK));   // vertical trim is not halted by a swing
      let v = add(scl(e.vel, 1 - smooth(r.spaceDamping ?? 3.5, dt)), scl(a, dt));   // momentum + damping
      const sp = Math.hypot(v[0], v[1], v[2]);
      if (sp > sMax) v = scl(v, sMax / sp);
      e.vel = v;
      t.pos = add(t.pos, scl(v, dt));
    } else if (halt && (e.kickT > 0 || e.dashT > 0)) {
      // the wall kick's fixed flight (the stick locked out) and the dash's line: each its own speed, read into the drive
      // so the body leaves them with that momentum (cling and dash, above)
      const ds = e.kickT > 0 ? 0 : dashNow(e, speed), v = e.kickT > 0 ? e.kick : [e.dashDir[0] * ds, e.dashDir[1] * ds];
      t.pos[0] += v[0] * dt; t.pos[1] += v[1] * dt;
      fwdMove = Math.hypot(v[0], v[1]) * dt;
      if (accel > 0) { const d = e.drive || (e.drive = [0, 0]); d[0] = v[0]; d[1] = v[1]; }
      if (e.kickT > 0) e.kickT = Math.max(0, e.kickT - dt);
      else { e.dashT -= dt; if (e.dashT < 1e-4) e.dashT = 0; }
    } else if (accel > 0) {
      // GROUND ACCELERATION (opt-in `accel`, units/s², a feel card's ground.accel): the body carries its own planar
      // velocity, the DRIVE (`e.drive`, world-space), which builds toward the stick's velocity at `accel` and sheds
      // toward rest (no stick, or a stick against the motion) at `decel` (default `accel`). In the air both rates are
      // scaled by `airControl` (the target stays the full speed) and an unpushed body keeps its drive: momentum through
      // the jump. A root (charge, kneel, swing, dodge, tackle) stops it at once, as the direct step does. A boost sets
      // it to the dash (the dash is instant), so letting go of F sheds the dash at `decel`; with `boostInertia` the
      // skid owns the release instead and the drive starts from rest. The step is read back onto f/rt, so the gait and
      // the clips see what the direct step gave them. Absent `accel` → the direct step below, byte-identical.
      const d = e.drive || (e.drive = [0, 0]);
      if (!halt) { d[0] = 0; d[1] = 0; }
      else if (boosting && !sprints) {
        const k = r.boostInertia > 0 ? 0 : boostSpeed * ctl / bn;
        d[0] = (f[0] * bf + rt[0] * bs) * k; d[1] = (f[1] * bf + rt[1] * bs) * k;
      } else {
        const pushed = Math.abs(fwdIn) + Math.abs(sideIn) > 1e-3;
        if (pushed || e.grounded) {
          // (a sprint builds to its own speed as the run does to the run's)
          const pace = boosting ? boostSpeed : speed;
          const wx = (f[0] * fwdIn + rt[0] * sideIn * strafe) * pace, wy = (f[1] * fwdIn + rt[1] * sideIn * strafe) * pace;
          const dx = wx - d[0], dy = wy - d[1], dl = Math.hypot(dx, dy);
          if (dl > 1e-12) {
            const building = pushed && Math.hypot(wx, wy) >= Math.hypot(d[0], d[1]) - 1e-9 && wx * d[0] + wy * d[1] >= 0;
            const k = Math.min(1, ((building ? accel : decel) * ctl * dt) / dl);
            d[0] += dx * k; d[1] += dy * k;
          }
        }
      }
      fwdMove = (d[0] * f[0] + d[1] * f[1]) * dt;
      sideMove = (d[0] * rt[0] + d[1] * rt[1]) * dt;
      t.pos = add(t.pos, [d[0] * dt, d[1] * dt, 0]);
    } else {
      fwdMove = (boosting && !sprints ? (bf / bn) * boostSpeed * ctl * dt : fwdIn * (boosting ? boostSpeed : speed) * ctl * dt) * halt;
      sideMove = (boosting && !sprints ? (bs / bn) * boostSpeed * ctl * dt : sideIn * strafe * (boosting ? boostSpeed : speed) * ctl * dt) * halt;
      t.pos = add(t.pos, add(scl(f, fwdMove), scl(rt, sideMove)));
    }

    runPhase('dash', e, input, dt, world, ctx);       // dodge/tackle dashes (pack), charge carry (base), cleave step (melee)

    // LATERAL BLOCKING (opt-in `world.colliders`): after every horizontal write (walk / boost /
    // dodge-dash / charge-leap), eject the footprint out of any solid box whose z-band the body
    // overlaps. `collideRadius` is the suit's footprint (shoulder half-width); `collideHeight` its
    // standing height (gates walk-under). Pure — no colliders → untouched (the open void has none).
    if (world && world.colliders) {
      if (space) resolveBlocking3D(t.pos, e.vel, r.collideRadius ?? 0, world.colliders);   // 3D solid — the station + rocks stop the suit
      else {
        const px = t.pos[0], py = t.pos[1];
        resolveBlocking(t.pos, footZ, r.collideHeight ?? (eye || 24), r.collideRadius ?? 0, world.colliders, step);
        // THE WALL SLIDE (opt-in `cling`): falling against a wall with the stick into it (more than `cling.toward` of the
        // push) holds the body to it, sliding down at `cling.slide` (below) and facing out; its air jumps and air dashes
        // come back. Let go of it and the kick's grace (`cling.coyote`) counts down
        if (r.cling && !e.grounded && e.vel[2] <= 0 && !(e.kickT > 0)) {
          const ex = t.pos[0] - px, ey = t.pos[1] - py, el = Math.hypot(ex, ey);
          const wx = f[0] * fwdIn + rt[0] * sideIn, wy = f[1] * fwdIn + rt[1] * sideIn, wm = Math.hypot(wx, wy);
          if (el > 1e-9 && wm > 1e-3 && -(wx * ex + wy * ey) / el > r.cling.toward * wm) {
            e.cling = [ex / el, ey / el]; e.wallN = e.cling; e.wallCoyote = r.cling.coyote; e.airJumpsUsed = 0;
            if (r.dash && r.dash.air) e.airDashes = r.dash.air.count;
            e.dashT = 0; e.carry = 0;
          } else if (e.cling) e.cling = null;
        }
        // a wall takes the part of the drive that went into it (the push-out's direction is the wall's normal); the
        // part along it stays, so the body slides on
        if (accel > 0 && e.drive) {
          const ex = t.pos[0] - px, ey = t.pos[1] - py, el = Math.hypot(ex, ey);
          if (el > 1e-9) { const vn = (e.drive[0] * ex + e.drive[1] * ey) / el; if (vn < 0) { e.drive[0] -= (vn * ex) / el; e.drive[1] -= (vn * ey) / el; } }
        }
      }
    }
    // the lane holds: after every horizontal write, the body goes back onto its line (and a drive, onto its tangent)
    if (laneMove) {
      const L = laneNear(r.lane, t.pos[0], t.pos[1]); t.pos[0] = L.px; t.pos[1] = L.py;
      if (accel > 0 && e.drive) { const along = e.drive[0] * L.tx + e.drive[1] * L.ty; e.drive[0] = L.tx * along; e.drive[1] = L.ty * along; }
    }

    // vertical — gravity (asymmetric), terminal clamp, integrate, then LAND on the surface below.
    // SPACE integrated its own z above (Newtonian, no gravity), so this whole block is ground-only.
    // BOOST HOVER (opt-in `boostHover`, ground mode): live thrust carries the suit at that ground
    // CLEARANCE above the surface below — the movement assist: an obstacle lower than the lifted
    // feet never meets the body's z-band (resolveBlocking) and its top reads as passing terrain
    // to the down-probe, so the suit SKIMS OVER it instead of stopping. Below the clearance the
    // thrusters LIFT toward it (`hoverRise` per sec, gravity suspended); above it (a boost-jump's
    // arc, a cliff edge) gravity drops the suit onto the thrust CUSHION — caught and held at the
    // clearance, a float, never a touchdown (no landing edge/clang while the jets are live), and
    // the skim follows terrain up and down. Releasing F (or an empty/locked gauge killing
    // `boosting`) removes the cushion and the ordinary fall + touchdown take over. Over a void
    // (probe null) thrust saves nothing — you fall like always. Absent `boostHover` → hover 0 →
    // this whole block is byte-identical legacy gravity.
    if (!space) {
      const hover = boosting && r.boostHover > 0 ? r.boostHover : 0;
      const gzH = hover > 0 && e.vel[2] <= 1e-6 ? probe(t.pos[2] - eye) : null;
      e.hovering = false;
      if (gzH != null && t.pos[2] - eye < gzH + hover - 1e-9) {
        // below the clearance, not rising → thrust lift: a rate-limited climb toward it
        t.pos[2] = Math.min(gzH + hover + eye, t.pos[2] + (r.hoverRise ?? jumpV) * dt);
        e.vel[2] = 0; e.grounded = false; e.hovering = true;
      } else {
        const footZ0 = t.pos[2] - eye;   // pre-fall foot height (the swept-probe origin)
        // GLIDE (opt-in `glideFall`, a power's glide): jump held while falling caps the fall at that speed. Absent → maxFall.
        const fallCap = r.glideFall > 0 && input.jumpHeld && e.vel[2] <= 0 ? Math.min(maxFall, r.glideFall) : maxFall;
        if (e.cling && r.cling) e.vel[2] = -r.cling.slide;   // down the wall at a constant speed
        else if (e.dashT > 0 && e.dashAir && dashU(e) < DASH_EASE) e.vel[2] = 0;    // the air dash holds its height at speed
        else e.vel[2] = Math.max(-fallCap, e.vel[2] - (e.vel[2] > 0 ? riseG : fallG) * dt);
        t.pos[2] += e.vel[2] * dt;
        // SWEEP the touchdown probe from the HIGHER of the pre/post foot, not the post-fall foot. A fast
        // fall (low framerate / big dt, a knockback launch, the drop-in settle over the wavy drape) moves
        // more than `step` in one frame, so probing from the NEW foot starts the down-ray BELOW the
        // surface just crossed → the raycast finds nothing → no touchdown → the unit sinks further next
        // frame and TUNNELS THROUGH THE GROUND, falling forever. From the pre-fall foot the ray always
        // starts above that surface and catches it. Byte-identical when not crossing a surface this frame
        // (same nearest-surface-below), and rising frames (vel>0) fail the `vel<=0` gate below regardless.
        const gz1 = probe(Math.max(footZ0, t.pos[2] - eye));
        if (gz1 != null && e.vel[2] <= 0 && t.pos[2] - eye <= gz1 + hover + 1e-4) {
          if (hover > 0) {
            // caught on the thrust cushion at the clearance — held afloat, not landed
            t.pos[2] = gz1 + hover + eye; e.vel[2] = 0; e.hovering = true;
            e.dashVel = null;   // a charged leap's carry ends where the fall is caught
          } else {
            t.pos[2] = gz1 + eye; e.vel[2] = 0; e.coyote = 0; e.grounded = true;   // hard touchdown: lock to the surface
            e.dashVel = null;   // the charged leap's carry ends at touchdown
            if (chargeMax <= 0 && e.jumpBuf > 0) { e.vel[2] = jumpV; e.grounded = false; e.jumpBuf = 0; }   // buffered jump fires on touchdown (legacy mode)
          }
        } else if (e.vel[2] <= 0 && !e.grounded && world && world.ground) {
          // EMBED RECOVERY: boosting/walking into terrain that rises faster than the per-frame step-up
          // (a ramp, a steep slope), or a drop-in seated a hair under the wavy surface, leaves the FOOT
          // below the floor at this (x,y). The touchdown probe above only looks DOWN, so it sails under
          // that floor and the suit sinks and falls through the map (the sky dome used to "catch" it at
          // z≈-3460). Cast from HEAD height: a surface ABOVE the foot but within the body means the suit
          // is embedded → climb onto it. A real roof (clearance > body) stays above the head, never
          // grabbed, so walk-under is intact.
          const footNow = t.pos[2] - eye;
          const climbUp = r.collideHeight ?? (eye || 24);
          const head = world.ground([t.pos[0], t.pos[1], footNow + climbUp]);
          if (head != null && head > footNow + 1e-4 && head <= footNow + climbUp + 1e-4) {
            t.pos[2] = head + eye; e.vel[2] = 0; e.grounded = true; e.dashVel = null;
          }
        }
      }
      // hover GRACE: tap-tap-F (the dodge) after a hover boost happens mid-drop — the cushion
      // vanished with the F release, but the maneuver deserves its ground read. Keep the
      // grounded-only gates open for a beat after hovering ends, like coyote time.
      e.hoverGrace = e.hovering ? (r.hoverCoyote ?? 0.45) : Math.max(0, (e.hoverGrace || 0) - dt);
    }

    // edges + gait (surfaced to the bus later; drive land-dust / jump-sound / a figure's frame).
    // `landed` is the grounded rising edge computed up top (snap-inclusive), not this touchdown block.
    e.jumped = jumped; e.landed = landedEdge;
    // locomotion clip + gait: the DOMINANT planar axis picks which walk cycle plays (a figure-frames
    // body side-STEPS when strafing, walks when going fore/aft — same `speed`, so the cadence matches)
    // and its signed distance drives the phase (back-walk + left/right side-steps play it opposite ways).
    // (a sprint's stride the run's half again, `sprintStride`, so its legs cycle as a sprint's, never a run's spun up)
    const strideLen = boosting && sprints ? (r.sprintStride ?? (r.stride ?? 2.4) * 1.45) : (r.stride ?? 2.4);
    // the directional flight clip: dominant axis picks side vs fore/aft
    // side dashes are DIRECTIONAL (bs > 0 = right): the flying-kick clips. Bodies baked before
    // the split fall back boost_right/left → boost_side → forward in the renderer.
    const boostClip = () => (Math.abs(bs) > Math.abs(bf) ? (bs > 0 ? 'boost_right' : 'boost_left') : (bf < 0 ? 'boost_back' : 'boost'));
    const boostPhase = () => { e.gaitPhase = (e.gaitPhase || 0) + (Math.abs(sideMove) > Math.abs(fwdMove) ? sideMove : fwdMove) / strideLen; };
    ctx.strideLen = strideLen;
    if (!runClaims(e, input, dt, world, ctx)) {      // tackle/dodge own the body's clip (pack claims)
    if (space) {
      // SPACE THRUST LADDER — no walk strides: the body ALWAYS thrusts, on a 3-rung intensity ladder
      // (idle float → soft forward/strafe thrust → full boost), plus dedicated ascend/descend poses.
      // A mid-air swing still shows its swing clip. The gait phase advances by the SPEED travelled, so
      // the thrust tremor always lives and speeds UP when you go faster (boost / ascend / descend).
      // The clips themselves are swapped in at bake time (bakeUnitRig({ space:true })).
      if (swinging) { e.locomotion = e.swingClip || 'swing_neutral'; e.gaitPhase = Math.min(e.swingT, 0.999); e.moving = true; }
      else {
        e.gaitPhase = (e.gaitPhase || 0) + Math.hypot(e.vel[0], e.vel[1], e.vel[2]) * dt / strideLen;
        const movingXY = Math.abs(fwdIn) + Math.abs(sideIn) > 1e-3;
        if (boosting) e.locomotion = boostClip();
        else if (ascend && !descend) e.locomotion = 'ascend';
        else if (descend && !ascend) e.locomotion = 'descend';
        else if (movingXY) e.locomotion = Math.abs(sideIn) > Math.abs(fwdIn) ? 'strafe' : 'forward';
        else e.locomotion = 'idle';
        e.moving = boosting || ascend || descend || movingXY;   // idle float plays via the baked idle when false
      }
    } else if (!e.grounded) {
      // AIRBORNE: the legs stop cycling — the pose HOLDS for the whole flight.
      // Boost (any direction) or forward drive plays the matching thruster
      // pose (its phase keeps advancing so the tremor lives); a plain
      // vertical jump holds 'leap' with the phase frozen. Bodies without
      // those clips fall back to 'forward' in the renderer.
      if (boosting) { e.locomotion = boostClip(); boostPhase(); }
      else if (fwdIn > 0) { e.locomotion = 'boost'; e.gaitPhase = (e.gaitPhase || 0) + fwdMove / strideLen; }
      else e.locomotion = 'leap';
      e.moving = true;
    } else if (e.jumpWind > 0 || charging) {
      // wind-up / charge: hold the anticipation crouch (gaitPhase carries the
      // squat clip's depth ramp — set by the jump block, not by distance)
      e.locomotion = 'squat';
      e.moving = true;
    } else if (boosting && !sprints) { e.locomotion = boostClip(); boostPhase(); e.moving = true; }
    else if (kneeling) { e.locomotion = 'kneel'; e.moving = true; }
    else if (swinging) {
      // one-shot strike: the gait phase IS the swing progress (clamped under
      // the wrap point so the pose never interpolates finish→windup)
      e.locomotion = e.swingClip || 'swing_neutral';
      e.gaitPhase = Math.min(e.swingT, 0.999);
      e.moving = true;
    }
    else if (Math.abs(fwdMove) + Math.abs(sideMove) < 1e-6 && Math.abs(turnAmt) > (r.turnStepMin ?? 0.0025)) {
      // TURN IN PLACE: the heading is changing (mouse-look / tank turn) but the body
      // is NOT translating — step the feet AROUND the turn (the 'turn' clip crosses
      // one foot over the other) instead of skating the planted pose. gaitPhase
      // advances by the SIGNED turn angle (turning the two ways plays the step
      // opposite ways), scaled by `turnStride` (radians per step cycle) so a pivot
      // reads as a few steps. Bodies without a 'turn' clip fall back to forward.
      e.locomotion = 'turn';
      e.gaitPhase = (e.gaitPhase || 0) + turnAmt / (r.turnStride ?? 0.6);
      e.moving = true;
    }
    else if (walking) {
      // a person walking (`walkSpeed`): the walk plays whichever way the step goes, its phase by the step's length
      const lead = Math.abs(sideMove) > Math.abs(fwdMove) ? sideMove : fwdMove;
      e.locomotion = 'walk'; e.gaitPhase = (e.gaitPhase || 0) + lead / (r.walkStride ?? strideLen); e.moving = (Math.abs(fwdMove) + Math.abs(sideMove)) > 1e-6;
    }
    else if (Math.abs(sideMove) > Math.abs(fwdMove)) { e.locomotion = 'strafe'; e.gaitPhase = (e.gaitPhase || 0) + sideMove / strideLen; e.moving = (Math.abs(fwdMove) + Math.abs(sideMove)) > 1e-6; }
    else { e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + fwdMove / strideLen; e.moving = (Math.abs(fwdMove) + Math.abs(sideMove)) > 1e-6; }

    // THE TAKES (opt-in `takes`, a feel's: gameworld/feel/lower.js): the hero's own jumps played on THIS flight. A jump
    // from standing (or a walk) plays `jump_up`, one out of the run `jump_fwd`, an air jump `jump_air` (the double jump
    // from its kick). Each take's clip is shared out by `takes`: its gather [0, off) over the wind-up, its air [off, on)
    // over the flight, the rise to the apex the first half and the fall the second, both read off the vertical speed (a
    // jump cut short rescales the rise from where it stands, so the clip never skips; the fall's end is the speed a drop
    // from this apex lands at), and its landing [on, 1) over `takes.land` seconds once down. Walking off an edge plays
    // the standing take's fall. Absent `takes` → the ladder above, byte-identical.
    if (r.takes && !space && !swinging && !boosting && !kneeling) {
      const K = r.takes, span = (k) => (k === 'jump_air' ? K.air : k === 'jump_fwd' ? K.fwd : K.up);
      // (out of a ground dash's lunge, below: the stride cycle given back where it left it, before a jump keeps it)
      if (e.dashGait != null && !(e.dashT > 0 && e.grounded)) { e.gaitPhase = e.dashGait; e.dashGait = null; }
      const pick = () => ((e.drive ? Math.hypot(e.drive[0], e.drive[1]) / Math.max(1e-6, r.speed ?? 6) : Math.hypot(fwdIn, sideIn)) > 0.35 && !walking ? 'jump_fwd' : 'jump_up');
      // the stride cycle's phase is kept from the take-off and given back when the take ends, so the run picks up its
      // cycle where it left it (as the held leap left it)
      const hold = () => { if (e.takeGait == null) e.takeGait = e.gaitPhase || 0; };
      const end = () => { e.take = null; e.takeLand = 0; if (e.takeGait != null) e.gaitPhase = e.takeGait; e.takeGait = null; };
      const fly = (k, p0) => { hold(); e.take = k; e.takeV0 = Math.max(1e-3, e.vel[2]); e.takeVz = e.vel[2]; e.takeZ = t.pos[2]; e.takeEnd = null; e.takeP = p0; e.takeLand = 0; e.takeGather = false; };
      // (a launch this frame did not count: a jump buffered into the touch-down, a launcher's throw: the speed rose)
      let landK = 0;   // the landing's share still to play this frame (1 on its first, toward 0)
      const relaunch = !jumped && !e.grounded && !!e.take && !e.takeGather && e.vel[2] > (e.takeVz ?? 0) + 1e-3;
      if (airJumped) fly('jump_air', 0);
      else if (jumped || relaunch) fly(e.takeGather ? e.take : pick(), 0);
      else if (e.jumpWind > 0 && !e.takeGather) { hold(); e.take = pick(); e.takeGather = true; e.takeLand = 0; }
      else if (!e.grounded && !e.take) { fly('jump_up', 0.5); e.takeEnd = Math.sqrt(2 * fallG); }   // off an edge: the fall alone
      if (landedEdge && e.take && !e.takeGather) e.takeLand = K.land;
      const S = e.take ? span(e.take) : null;
      if (S && e.takeGather && e.jumpWind > 0) {
        e.locomotion = e.take; e.gaitPhase = S[0] * (1 - Math.max(0, e.jumpWind) / (windup || 1)); e.moving = true;
      } else if (S && !e.grounded) {
        const vz = e.vel[2];
        if (vz > 0) {
          // a cut (the release capped the rise): the rise rescaled so the clip carries on from where it is
          if (vz < e.takeVz - riseG * dt - 1e-6) e.takeV0 = vz / Math.max(1e-3, 1 - 2 * e.takeP);
          e.takeP = Math.max(e.takeP, 0.5 * (1 - vz / e.takeV0));
        } else {
          if (e.takeEnd == null) e.takeEnd = Math.sqrt(2 * fallG * Math.max(0.05, t.pos[2] - e.takeZ));
          e.takeP = Math.max(e.takeP, 0.5 + 0.5 * Math.min(1, -vz / e.takeEnd));
        }
        e.takeVz = vz;
        e.locomotion = e.take; e.gaitPhase = S[0] + (S[1] - S[0]) * Math.min(e.takeP, 0.999); e.moving = true;
      } else if (S && e.takeLand > 0) {
        landK = e.takeLand / K.land;
        e.locomotion = e.take; e.gaitPhase = Math.min(0.999, S[1] + (1 - S[1]) * (1 - landK)); e.moving = true;
        // (the card's seconds are rounded to 0.1 ms: a remainder under that was the last frame's; the take ends next frame)
        e.takeLand -= dt;
        if (e.takeLand < 1e-4) e.takeLand = 0;
      } else if (e.take && e.grounded && !e.takeGather) end();
      // THE LOOK (`takes.squash`, the card's): squash and stretch about the feet, the volume kept. The gather sinks
      // into it, the flight stretches with the speed (none at the apex), the landing squashes and springs back over
      // the landing's frames. `e.squash` is [across, up] for the renderer; null when the body is its own shape
      const Q = K.squash > 0 ? K.squash : 0;
      let up = 1;
      if (Q && e.take) {
        if (e.takeGather && e.jumpWind > 0) up = 1 - 0.5 * Q * (1 - Math.max(0, e.jumpWind) / (windup || 1));
        else if (!e.grounded) up = 1 + 0.5 * Q * Math.min(1, Math.abs(e.vel[2]) / Math.max(1e-3, e.takeV0));
        else if (landK > 0) up = 1 - Q * landK;
      }
      e.squash = Q && up !== 1 ? [1 / Math.sqrt(up), up] : null;
      // THE DASH'S LUNGE (`dash`): a ground dash is a burst, not a run, so it takes no strides: the hero holds the running
      // jump's gather, leaning into it as the burst gets up to speed and rising out of it as it eases
      if (r.dash && e.dashT > 0 && e.grounded && !e.take) {
        const u = dashU(e), k = u < DASH_RISE ? u / DASH_RISE : u < DASH_EASE ? 1 : 1 - (u - DASH_EASE) / (1 - DASH_EASE);
        e.locomotion = 'jump_fwd'; e.gaitPhase = K.fwd[0] * (0.5 + 0.45 * k); e.moving = true;
      }
    }
    }

    // thruster flame intensity (renderer lights the unit's backpack + foot jets,
    // channels.js __updateThrusters): FULL on any boost, a lighter plume on an
    // airborne forward-drive glide (the boost-jet arc), 0 otherwise. The renderer
    // eases it, so a bare 0/1 here reads as a flare-up / fade-out.
    // SPACE floors the plume nonzero — there is ALWAYS thrust: idle float ~0.25 → walk ~0.5 →
    // ascend/descend ~0.6 → full boost 1. Ground keeps the old 0-floor (boost / airborne-glide only).
    e.thrust = space
      ? (boosting || tackling ? 1 : (ascend || descend ? 0.6 : (Math.abs(fwdIn) + Math.abs(sideIn) > 1e-3 ? 0.5 : 0.25)))
      : (boosting || tackling ? 1 : (!e.grounded && fwdIn > 0 ? 0.6 : 0));
    // thrust DIRECTION as a body-frame yaw (0 = forward, + = toward the right,
    // ±π = back): the renderer VECTORS the backpack jets to exhaust opposite
    // the dash, so a left dash blows the flames out to the right.
    e.thrustYaw = boosting ? Math.atan2(bs / bn, bf / bn) : 0;

    // (a sprint on the ground plays the body's own `sprint` clip, the run's where it has none: the page falls back)
    if (boosting && sprints && e.locomotion === 'forward') e.locomotion = 'sprint';

    // BOOST GAUGE bookkeeping (opt-in): charge this frame's costs, regen when the thrusters are
    // cold, and latch/clear the empty-lock. `e.boost` is the live seconds-of-thrust remaining;
    // the renderer reads it for the HUD gauge. Deterministic (pure functions of input + dt).
    if (hasGauge) {
      if (jumped) payBoost(jumpCost);   // every launch bites the jump cost (legs still jump at empty)
      if (boosting) {
        payBoost(dt);   // continuous thrust drains 1 unit / sec — boostMax seconds of boost
        // direction-change bite: a set cost each time the DOMINANT dash direction flips mid-boost
        // (`boostTurnCost`, default 0.75 — the vectoring modifier; 0 disables it).
        const dir = boostClip();
        const turnCost = r.boostTurnCost ?? (sprints ? 0 : 0.75);
        if (turnCost > 0 && e.boostDir && e.boostDir !== dir) payBoost(turnCost);
        e.boostDir = dir;
      } else {
        e.boostDir = null;
        // recharge whenever the thrusters are cold. HOLDING F during an OVERHEAT does NOTHING — the
        // bar recharges regardless of whether the button is held (operator: the old "release to
        // recharge" penalty is gone; a spent booster no longer sits empty while you mash it).
        // Ordinary partial-bar recovery is quick (`boostRegen`, default boostMax/5 — full in ~5s); an
        // OVERHEAT recovery (the bar was drained and locked — a dodge dump, or thrusting it dry)
        // climbs at `overheatRegen` (default boostMax/7.5 — the ~7.5s outage, rev3).
        const rr = e.boostLock ? (r.overheatRegen ?? boostMax / 7.5) : (r.boostRegen ?? boostMax / 5);
        e.boost = Math.min(boostMax, e.boost + rr * dt);
      }
      // empty-lock: latch spent when drained; the OVERHEAT holds until the bar recovers FULL
      // (rev3 — `boostUnlockFrac` default 1; a world may pin the old 0.15 hysteresis).
      if (e.boost <= 1e-6) e.boostLock = true;
      else if (e.boostLock && e.boost >= boostMax * (r.boostUnlockFrac ?? 1)) e.boostLock = false;
    }
  }
  Object.assign(RULES, { platform });

  // the base's own dash-phase entry: the charged leap's horizontal carry (ground only).
  registerPlatformManeuver('dash', 'charge-dash-carry', (e, input, dt, world, ctx) => {
    if (!ctx.space && e.dashVel) { e.transform.pos[0] += e.dashVel[0] * dt; e.transform.pos[1] += e.dashVel[1] * dt; }
  }, 30);

  // tickBoostRecovery(e, dt) — the PASSIVE thruster recharge (+ overheat unlock), the boost-gauge
  // analog of tickWeapon's autoloader. The recharge normally lives INSIDE the platform rule, but the
  // rule is SUPPRESSED while a suit is reeling / dropping / clashing — so without this the gauge (and
  // the OVERHEAT lock) FREEZE for the whole knockdown (operator, 2026-07-30: "during topple the
  // overheat is stopped"). Run world-side whenever the rule DIDN'T run this frame, so the thruster
  // keeps recovering like the reload does. Mutually exclusive with the in-rule recharge (only the
  // else-branch calls this), so no double-charge. No gauge (boostMax<=0) → no-op.
  function tickBoostRecovery(e, dt) {
    const r = e.rule; if (!r) return;
    const boostMax = r.boostMax;
    if (!(boostMax > 0)) return;
    const rr = e.boostLock ? (r.overheatRegen ?? boostMax / 7.5) : (r.boostRegen ?? boostMax / 5);
    e.boost = Math.min(boostMax, (e.boost ?? boostMax) + rr * dt);
    if (e.boost <= 1e-6) e.boostLock = true;
    else if (e.boostLock && e.boost >= boostMax * (r.boostUnlockFrac ?? 1)) e.boostLock = false;
  }
  // rule owns the gauge when it runs; suppressed (reeling / dropping / clashing) the thruster
  // still recharges — the boost/overheat analog of the autoloader.
  registerSuppressedTick('boost-recovery', (e, dt) => tickBoostRecovery(e, dt), 10);
  // a body something else owns (reeling, dropping, clashing) is not driving: its drive stops, so it never resumes at a
  // run it was knocked out of. No `accel` → no drive → nothing to stop.
  registerSuppressedTick('drive-stop', (e) => { if (e.drive) { e.drive[0] = 0; e.drive[1] = 0; } }, 20);

  Object.assign(E, { registerPlatformManeuver, platformPhaseOrder });
}
