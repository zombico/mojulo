/**
 * rules-basic.js — the basic RULE shelf (controllable-split.plan.md, S1): glide, walk, follow,
 * clock, mover. Each mutates entity.transform from (entity, input, dt, world) and registers into
 * the shared E.RULES registry (created by core.js). The combat-woven rules — platform and ai —
 * stay in all.js until the S4 maneuver seam.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; core helpers destructured from
 * E at build time (core is builder #1). Field ownership: these rules write e.transform, e.vel,
 * e.gaitPhase, e.locomotion, e.moving; follow additionally e.lookAt/e.flipMix; mover e._mt.
 * (follow's cinematic branch reads world.cinematic — stamped by the tackle set piece in all.js;
 * it moves out with the S4 pack, the read here is just a nullable world field.)
 */

export function buildRulesBasic(E) {
  const { add, sub, scl, clamp, smooth, fwdXY, rightXY, fwd3, TAU, HALF_PI, RULES } = E;

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
    // strafe = E/Q (strafe axis) OR A/D (turn axis): the drone is MOUSE-steered, so the tank-turn axis
    // has no other job here — folding it in makes the spectator camera fly on true WASD (A/D strafe).
    a = add(a, scl(rt, (input.strafe + input.turn) * accel));
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
  // `reverse:true` mirrors the chase pose to the FRONT of the target (looking slightly behind it) —
  // the detail view: WASD keeps driving the target exactly as before, you just watch it face-on.
  // The flag is live-flippable (the world HUD toggles it); the flip eases as an ORBIT about the
  // target (flipMix 0→1 rotates the whole chase basis by π at `flipRate`/sec) so the camera swings
  // around the unit instead of lerping straight through it.
  // VERTICAL AIM: the camera pitches WITH the target's look pitch (set by mouse Y in the platform
  // rule), so looking up/down frames higher/lower things and screen-center tracks the shot line.
  // `pitchFollow` (0..1, default 1) scales it; 0 keeps the old flat chase. At pitch 0 the framing is
  // byte-identical to before — the offset just rotates in the heading-vertical plane about the target.
  function follow(e, input, dt, world) {
    const r = e.rule;
    // CINEMATIC (tackle-cinematic.plan.md): while a shove-down set piece runs, frame the PAIR from the
    // side (ease in on the same lerp); clearing world.cinematic eases the chase back.
    const cine = world.cinematic;
    if (cine) {
      const A = world.byId[cine.a], B = world.byId[cine.b];
      if (A && B) {
        const pa = A.transform.pos, pb = B.transform.pos;
        const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, mz = (pa[2] + pb[2]) / 2;
        let ux = pb[0] - pa[0], uy = pb[1] - pa[1]; const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
        const sx = -uy * cine.side, sy = ux * cine.side;   // the chosen perpendicular (side)
        // FRAME THE FULL BODIES: pulled back + raised (was 16 / 7, too close — heads clipped) and the
        // look point lifted to BODY CENTER (was mz+1.5, near the feet) so the whole head-to-toe shove
        // reads. Tunable per camera (cineDist / cineHeight / cineLookH) for a tighter or wider set piece.
        const cd = r.cineDist ?? 42, chh = r.cineHeight ?? 15;
        const want = [mx + sx * cd, my + sy * cd, mz + chh];
        e.transform.pos = add(e.transform.pos, scl(sub(want, e.transform.pos), smooth(r.lerp ?? 8, dt)));
        e.lookAt = [mx, my, mz + (r.cineLookH ?? 12)];
        return;
      }
    }
    const tgt = world.byId[r.target];
    if (!tgt) return;
    // TARGET LOCK tracking (lock.js, opt-in `lockTrack: true | { mix, dist, rate }`): while the
    // followed pilot holds a lock, `lockMix` eases 0→1 at `rate`/s; the chase distance scales by
    // `1 + (dist − 1)·lockMix` (pull back, default ×1.2) and the look point blends `mix·lockMix`
    // (default 0.5) toward the target, so the frame holds both. Off (or unlocked) ⇒ lockMix 0 and
    // every number below is the plain chase — worlds without lockTrack never touch this branch.
    let lkTgt = null, lkMix = 0;
    if (r.lockTrack) {
      const lk = world.lock, lo = r.lockTrack === true ? {} : r.lockTrack;
      const on = lk && lk.target && lk.pilot === r.target && world.byId[lk.target] ? world.byId[lk.target] : null;
      if (e.lockMix == null) e.lockMix = 0;
      e.lockMix += ((on ? 1 : 0) - e.lockMix) * smooth(lo.rate ?? 4, dt);
      if (on) e.lockTgt = on.id;
      lkTgt = e.lockMix > 1e-3 ? world.byId[e.lockTgt] : null;
      lkMix = lkTgt ? e.lockMix : 0;
      e._lkLook = lo.mix ?? 0.5; e._lkDist = lo.dist ?? 1.2;
    }
    const dist = (r.dist ?? 6) * (lkMix ? 1 + (e._lkDist - 1) * lkMix : 1), height = r.height ?? 3, shoulder = r.shoulder ?? 0, lead = r.lead ?? 4, lookH = r.lookH ?? 1.5, lerp = r.lerp ?? 8;
    const wantFlip = r.reverse ? 1 : 0;
    if (e.flipMix == null) e.flipMix = wantFlip;   // start settled (no swing on load)
    e.flipMix += (wantFlip - e.flipMix) * smooth(r.flipRate ?? 3, dt);
    const h = tgt.transform.heading + Math.PI * e.flipMix, f = fwdXY(h), rt = rightXY(h);
    // pitch: flip negates it so the reverse (face-on) cam tilts to keep the unit framed the same way.
    const pf = r.pitchFollow == null ? 1 : r.pitchFollow;
    const p = (tgt.transform.pitch || 0) * pf * (e.flipMix > 0.5 ? -1 : 1);
    const cp = Math.cos(p), sp = Math.sin(p);
    // chase offset behind the target, rotated by pitch: pull in by cos(p) horizontally, drop the camera
    // by dist·sin(p) and raise the look point by lead·sin(p) — the view tilts up when you look up.
    const want = [
      tgt.transform.pos[0] - f[0] * dist * cp + rt[0] * shoulder,
      tgt.transform.pos[1] - f[1] * dist * cp + rt[1] * shoulder,
      tgt.transform.pos[2] + height - dist * sp,
    ];
    const k = smooth(lerp, dt);
    e.transform.pos = add(e.transform.pos, scl(sub(want, e.transform.pos), k));
    e.lookAt = [
      tgt.transform.pos[0] + f[0] * lead * cp,
      tgt.transform.pos[1] + f[1] * lead * cp,
      tgt.transform.pos[2] + lookH + lead * sp,
    ];
    if (lkMix) {   // blend the look point toward the locked target (its own lookH above its pos)
      const m = e._lkLook * lkMix, tp = lkTgt.transform.pos;
      e.lookAt = [e.lookAt[0] + (tp[0] - e.lookAt[0]) * m, e.lookAt[1] + (tp[1] - e.lookAt[1]) * m, e.lookAt[2] + (tp[2] + lookH - e.lookAt[2]) * m];
    }
  }

  // clock — autonomous frame playback: advance the gait/anim phase by time, no input. Turns a
  // figure-frames body into a self-playing loop (a turntable / ambient walker). `rate` = cycles/sec.
  function clock(e, input, dt) {
    e.gaitPhase = (e.gaitPhase || 0) + dt * (e.rule.rate ?? 1);
    e.moving = true;
  }

  // mover — a scripted moving PLATFORM / lift: the carrier a platform-rule rider rides. No input; the
  // entity ping-pongs between `from` and `to` over `period` seconds on a smoothstepped triangle wave,
  // fully deterministic + dt-driven (replay-safe — no wall clock, no dice). `from`/`to` default to the
  // authored start pose (→ a static platform). A grounded platform/walk rider resting on this entity's
  // top inherits its per-tick HORIZONTAL motion via the carry post-pass in stepWorld; vertical carry
  // comes free from re-grounding on the moving top. Mark the entity `body.carrier:true` (+ a footprint:
  // `body.carryHalf:[hx,hy]` AABB or `body.carryRadius`; `body.deck` offsets the ride surface off pos-z).
  // A RAIL (`path`: two or more points, round if `loop`) moves the carrier by DISTANCE along the polyline, so it runs at
  // one pace; `mode: 'loop'` runs t as a saw (one way round), else the smoothed ping-pong below. A RIDE drive
  // (`drive: 'ride'`, `speed` t/s, `dwell` s) waits at the path's start until a rider stands on it (the carry pass
  // marks `e._ridden`), runs to the end, waits `dwell` empty, and comes home. A mover with neither runs as before.
  function railPoint(path, loop, t) {
    const pts = loop ? path.concat([path[0]]) : path;
    let total = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(L); total += L; }
    let s = Math.min(1, Math.max(0, t)) * total, i = 0;
    while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
    const f = seg[i] ? s / seg[i] : 0, a = pts[i], b = pts[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function mover(e, input, dt) {
    const r = e.rule;
    if (Array.isArray(r.path) && r.path.length >= 2) {
      let t;
      if (r.drive === 'ride') {
        const st = e._ride || (e._ride = { t: 0, target: 0, wait: 0 });
        const atEnd = st.t >= 1 - 1e-9, atHome = st.t <= 1e-9;
        if (e._ridden && atHome) st.target = 1;
        if (atEnd && !e._ridden) { st.wait += dt; if (st.wait >= (r.dwell ?? 2)) { st.target = 0; st.wait = 0; } } else if (!atEnd) st.wait = 0;
        const step = (r.speed > 0 ? r.speed : 0.25) * dt;
        st.t = st.t < st.target ? Math.min(st.target, st.t + step) : Math.max(st.target, st.t - step);
        t = st.t;
      } else {
        const period = r.period > 0 ? r.period : 4;
        e._mt = (e._mt || 0) + dt;
        const s = ((e._mt / period + (r.phase || 0)) % 1 + 1) % 1;
        const tri = 1 - Math.abs(s * 2 - 1);
        t = r.mode === 'loop' ? s : tri * tri * (3 - 2 * tri);
      }
      const p = railPoint(r.path, !!r.loop, t);
      e.transform.pos[0] = p[0]; e.transform.pos[1] = p[1]; e.transform.pos[2] = p[2];
      e.moving = true;
      return;
    }
    const from = Array.isArray(r.from) ? r.from : (e.spawn ? e.spawn.pos : e.transform.pos);
    const to = Array.isArray(r.to) ? r.to : from;
    const period = r.period > 0 ? r.period : 4;
    e._mt = (e._mt || 0) + dt;
    const s = ((e._mt / period + (r.phase || 0)) % 1 + 1) % 1;   // 0..1 saw (phase-shiftable, always ≥0)
    const tri = 1 - Math.abs(s * 2 - 1);                         // triangle: 0→1→0 ping-pong
    const u = tri * tri * (3 - 2 * tri);                         // smoothstep → soft turnaround at the ends
    e.transform.pos[0] = from[0] + (to[0] - from[0]) * u;
    e.transform.pos[1] = from[1] + (to[1] - from[1]) * u;
    e.transform.pos[2] = from[2] + (to[2] - from[2]) * u;
    e.moving = true;
  }
  // launcher — a pad that stays put and throws a platform-rule rider who comes onto it. It ticks its own reload (`_cool`)
  // and the throw's t (`_arm`, 0 → 1 fast, back over `reload`, for the renderer); the launch itself is the world pass
  // below, after the rules, where it can read how the rider came in. Rule fields: `mode` fixed | redirect | bounce,
  // `dir` [x, y] (the throw's heading), `angle` deg, `power` m/s, `gain` (how much of the approach carries), `cap` m/s,
  // `restitution` (bounce), `cone` deg (the approaches it takes, absent = any), `half` [hx, hy] and `top` (the pad's
  // face, off pos-z), `reload` s, `locked` (the rider cannot steer until it lands: a scenic route).
  function launcher(e, input, dt) {
    e._cool = Math.max(0, (e._cool || 0) - dt);
    const reload = e.rule.reload ?? 0.6;
    e._arm = e._cool > 0 ? Math.min(1, (reload - e._cool) / 0.08, e._cool / Math.max(1e-6, reload - 0.08)) : 0;
  }
  Object.assign(RULES, { glide, walk, follow, clock, mover, launcher });

  // the launch: each rider's last tick (where it stood, how fast it fell) is kept on the pad, so a rider arriving this
  // tick is read by its approach: its run across the ground and its fall. Fixed throws one arc whatever the approach;
  // redirect keeps the run's speed (× gain) and sends it along the pad; bounce returns the fall (× restitution) and
  // keeps the run. The throw is the platform rule's own momentum: vel z, and `dashVel` (the carry that ends on touchdown).
  const LAUNCH_EPS = 0.05;
  E.registerWorldPass('launch', (state, input, dt) => {
    const pads = state.entities.filter((p) => p.rule && p.rule.type === 'launcher' && !p.gone);
    if (!pads.length) return;
    const riders = state.entities.filter((e) => !e.isCamera && !e.downed && !e.gone && e.rule && e.rule.type === 'platform' && !e.rule.space && e.vel);
    for (const e of riders) if (e.launchedBy && e.grounded && e._launchAt !== state.time) { e.launchLock = false; e.launchedBy = null; }   // landed
    for (const p of pads) {
      const r = p.rule, seen = p._seen || (p._seen = {}), half = r.half || [0.75, 0.75], top = p.transform.pos[2] + (r.top ?? 0);
      for (const e of riders) {
        const foot = e.transform.pos[2] - (e.rule.eye ?? 0), rr = e.rule.collideRadius ?? 0;
        const on = e.grounded && Math.abs(foot - top) <= (e.rule.snap ?? 0.15) + LAUNCH_EPS
          && Math.abs(e.transform.pos[0] - p.transform.pos[0]) <= half[0] + rr && Math.abs(e.transform.pos[1] - p.transform.pos[1]) <= half[1] + rr;
        const last = seen[e.id];
        seen[e.id] = { pos: [e.transform.pos[0], e.transform.pos[1]], vz: e.vel[2], on };
        if (!on || (last && last.on) || p._cool > 0) continue;
        const run = last ? [(e.transform.pos[0] - last.pos[0]) / dt, (e.transform.pos[1] - last.pos[1]) / dt] : [0, 0], fall = last ? Math.max(0, -last.vz) : 0;
        const dn = Math.hypot(r.dir ? r.dir[0] : 1, r.dir ? r.dir[1] : 0) || 1, d = [(r.dir ? r.dir[0] : 1) / dn, (r.dir ? r.dir[1] : 0) / dn];
        const runSpeed = Math.hypot(run[0], run[1]);
        if (r.cone != null && !(runSpeed > 0.5 && (run[0] * d[0] + run[1] * d[1]) / runSpeed >= Math.cos((r.cone / 2) * Math.PI / 180))) continue;
        const a = (r.angle ?? 60) * Math.PI / 180, cap = r.cap ?? 40, gain = r.gain ?? 1;
        let v;
        if (r.mode === 'bounce') {
          const vz = Math.min(cap, Math.max(r.power ?? 12, (r.restitution ?? 0.8) * fall));
          v = [run[0] * gain, run[1] * gain, vz];
        } else {
          const s = Math.min(cap, (r.power ?? 12) + (r.mode === 'redirect' ? gain * runSpeed : 0));
          v = [d[0] * s * Math.cos(a), d[1] * s * Math.cos(a), s * Math.sin(a)];
        }
        e.vel[2] = v[2]; e.dashVel = [v[0], v[1]]; e.grounded = false; e.coyote = 1; e.jumpBuf = 0;
        e.launchedBy = p.id; e.launchLock = !!r.locked; e._launchAt = state.time;
        seen[e.id].on = true;
        p._cool = r.reload ?? 0.6;
        p.lastLaunch = { t: state.time, rider: e.id, vel: v, mode: r.mode || 'fixed' };
      }
    }
  }, 25);

  // a LOCKED launch takes the pilot's steering until it lands (look still turns the camera): the scenic route
  E.registerPreStep('launch-lock', (state, input) => {
    const me = state.pilotId ? state.byId[state.pilotId] : null;
    if (!me || !me.launchLock) return null;
    return { ...input, forward: 0, strafe: 0, turn: 0, jump: 0, jumpHeld: 0, boost: 0 };
  }, 60);
}
