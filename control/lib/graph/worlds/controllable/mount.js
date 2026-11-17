/**
 * mount.js — A MOUNT: a horse (lib/graph/mount/, its game pack mount/game.js) any character who rides can get on, ride
 * and get off. Two halves, both pure and deterministic like every rule:
 *
 *   THE `ride` RULE (the horse's, always): ridden (its rider the pilot) it reads the stick: W urges it on (up through the
 *     gaits, `accel` m/s² to the fastest gait's speed), letting go it comes back to a halt (`coast`), S checks it
 *     (`brake`) and, halted, reins it back; A/D turn it, less sharply the faster it goes (`turn` rad/s at a halt over
 *     1 + v·`tighten`), on the spot at a halt (a turn on the forehand, its walk). The gait is the speed's: each gait's
 *     band runs from the middle between it and the one below to the middle between it and the one above, a hysteresis
 *     `band` either side, so a horse held at a speed between two gaits does not flicker. Its legs keep time with the
 *     ground (gaitPhase advances by distance over the gait's own stride: no skating). Jump (Space) at a trot or faster:
 *     the jump's clip played once (its take-off, flight and landing), carried on at its own speed, the ground's walls
 *     cleared up to `jump.clear` while it is in the air (`jump.air`: the flight's share of the clip); a wall it cannot pass
 *     pulls it up (its speed what it covered: a fence above its jump refused). Unridden it stands
 *     at ease, its loose clips (no carriage, the reins on the neck), its idle looping. Ground followed (the probe cast from
 *     its height), walls by the shared footprint eject.
 *   GETTING ON AND OFF (wraps stepWorld): the pilot (a body that `rides`: its figure carries the riding clips, mount/game.js)
 *     standing within a horse's `reach` presses interact (`input.interact`, or the page's `state.mountPress`): it walks to
 *     the horse's near side (`stand`, in the horse's frame, facing the horse) and gets on (both bodies play `mount`
 *     together, the rider carried in the horse's frame), and then the horse is the pilot: the camera follows it, the
 *     stick rides it, and the rider sits it, every clip the horse plays its own of the same name at the same phase.
 *     Interact again with the horse at a walk or halted: both play `dismount`, the horse halted, and the rider is set down
 *     where that clip leaves it, the pilot again, its own rule back. A follow camera goes with the pilot, framed by the horse's
 *     `camera` ({ dist, height, lookH }) while it is ridden and given its own back after.
 *
 *   A CAB (`mount.cab: true`: a car, any body on its own rule, the `drive` rule's): got INTO, not onto. Any walker may
 *     (no riding clips: it is not seen riding): it walks to the cab's `stand` (its door), is in after `mount.s`, and is
 *     gone from the world while it is (`gone`: unseen, no one's target), carried in the cab; the cab is the pilot.
 *     Interact again when it is slow (`slow`): out after `dismount.s`, set down at the door, pushed clear of a wall
 *     that stands there, the pilot again. The cab plays no clip of the rider's: its own rule drives it, and only while
 *     it is driven: a cab no one drives is parked (`cabRule` keeps its rule), so a held stick moves nothing.
 *
 * Opt-in (compose.js EMISSION_OPT_IN): emitted only into a page whose world has a mount; on the live instance a world
 * without one steps exactly as before. Import-free (the page runs this source via toString()). Field ownership: the
 * horse's e.riderId, e.mountClip / e.mountU (a getting-on or -off clip's name and share, the rule plays it), e.gaitIx,
 * e.jumpT, e.speed; the rider's e.mountedOn, e.mountPhase ('approach' | 'mount' | 'ride' | 'dismount'), e.mountT,
 * e.mountFrom, e.riderRule (its own rule while it rides).
 */

export function buildMount(E) {
  const { clamp, fwdXY, resolveBlocking, TAU, RULES, ZERO_INPUT, registerNormalize } = E;
  const step = E.stepWorld;
  // (a horse's `mount` and a body's `rides`, carried onto the entity)
  registerNormalize((ent, raw) => { if (raw.mount && typeof raw.mount === 'object') ent.mount = { ...raw.mount }; if (raw.rides === true) ent.rides = true; });
  // (a car no one gets into, the law's police car: its hull, and the body the page draws it with)
  registerNormalize((ent, raw) => { if (Array.isArray(raw.carHull) && raw.carHull.length === 2) ent.carHull = raw.carHull.slice(); if (raw.carBody && typeof raw.carBody === 'object') ent.carBody = { ...raw.carBody }; });

  // a point in a horse's frame (its figure's: +y forward, +x its right) → the world, at the horse's place and heading
  const local = (h, p) => { const a = h.transform.heading - Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [h.transform.pos[0] + p[0] * c - p[1] * s, h.transform.pos[1] + p[0] * s + p[1] * c, h.transform.pos[2]]; };
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

  // ── THE CABS' HULLS (`mount.hull`: [half width, half length], a box turned with its car) ──────────────────────
  // After every body has moved: a cab that overlaps another is pushed back out of it along the least overlap (the one
  // that moves gives way, two that move share it; one that stands holds) and loses the speed it carried into it; a
  // walker (a body on foot with a `collideRadius`) is pushed out of every hull. The traffic the page hands the world
  // (`state.trafficHulls`: [{ p, heading, hull }], scene/channels/flow.js) holds as a parked car does. Facts: e.bumped (the speed lost, the
  // step it struck). A cab with no hull, and a world with no cab, are as they were.
  // (a car no one gets into, `carHull`: the law's police car, a hull all the same)
  const hullOf = (h) => (h.mount ? h.mount.hull : h.carHull);
  const axes = (h) => { const a = h.transform.heading, c = Math.cos(a), sn = Math.sin(a), u = hullOf(h); return { f: [c, sn], r: [sn, -c], hw: u[0], hl: u[1], p: h.transform.pos }; };
  // the least push that takes box A out of box B (separating axes, on the ground plane), or null where they are apart
  function apart(A, B) {
    const d = [A.p[0] - B.p[0], A.p[1] - B.p[1]];
    let best = null;
    for (const n of [A.f, A.r, B.f, B.r]) {
      const ra = A.hl * Math.abs(n[0] * A.f[0] + n[1] * A.f[1]) + A.hw * Math.abs(n[0] * A.r[0] + n[1] * A.r[1]);
      const rb = B.hl * Math.abs(n[0] * B.f[0] + n[1] * B.f[1]) + B.hw * Math.abs(n[0] * B.r[0] + n[1] * B.r[1]);
      const c = d[0] * n[0] + d[1] * n[1], pen = ra + rb - Math.abs(c);
      if (pen <= 0) return null;
      if (!best || pen < best.pen) best = { pen, n: c < 0 ? [-n[0], -n[1]] : n };
    }
    return best;
  }
  function hulls(state, cabs) {
    const H = [...cabs.filter((h) => h.mount.cab && h.mount.hull && !h.gone), ...state.entities.filter((e) => e.carHull && !e.mount && !e.gone)];
    if (!H.length && !(state.trafficHulls && state.trafficHulls.length)) return;
    const moves = (h) => Math.abs(h.speed || 0) > 0.01;
    const struck = (h, n) => { const v = h.speed || 0, into = -(Math.cos(h.transform.heading) * n[0] + Math.sin(h.transform.heading) * n[1]) * Math.sign(v); if (into > 0) { const lost = Math.abs(v) * into; h.speed = v * (1 - into); if (lost > 0.2) h.bumped = lost; } };
    for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
      const a = H[i], b = H[j];
      if (Math.abs(a.transform.pos[2] - b.transform.pos[2]) > 2 || (!moves(a) && !moves(b))) continue;
      const hit = apart(axes(a), axes(b));
      if (!hit) continue;
      const wa = moves(a) ? (moves(b) ? 0.5 : 1) : 0, wb = 1 - wa;
      a.transform.pos[0] += hit.n[0] * hit.pen * wa; a.transform.pos[1] += hit.n[1] * hit.pen * wa;
      b.transform.pos[0] -= hit.n[0] * hit.pen * wb; b.transform.pos[1] -= hit.n[1] * hit.pen * wb;
      if (wa) struck(a, hit.n);
      if (wb) struck(b, [-hit.n[0], -hit.n[1]]);
    }
    // (the traffic near the pilot, scene/channels/flow.js: boxes that hold; a cab that moves is pushed out of them)
    const T = (state.trafficHulls || []).map((x) => ({ f: [Math.cos(x.heading), Math.sin(x.heading)], r: [Math.sin(x.heading), -Math.cos(x.heading)], hw: x.hull[0], hl: x.hull[1], p: x.p }));
    for (const a of H) {
      if (!moves(a)) continue;
      for (const X of T) {
        if (Math.abs(a.transform.pos[2] - X.p[2]) > 2) continue;
        const hit = apart(axes(a), X);
        if (!hit) continue;
        a.transform.pos[0] += hit.n[0] * hit.pen; a.transform.pos[1] += hit.n[1] * hit.pen; struck(a, hit.n);
      }
    }
    const boxes = [...H.map(axes), ...T];
    for (const e of state.entities) {
      const cr = e.rule && e.rule.collideRadius;
      if (!(cr > 0) || e.mount || e.carHull || e.mountedOn || e.gone || e.isCamera) continue;
      for (const X of boxes) {
        const dx = e.transform.pos[0] - X.p[0], dy = e.transform.pos[1] - X.p[1];
        if (Math.abs(e.transform.pos[2] - (e.rule.eye || 0) - X.p[2]) > 2) continue;
        const u = dx * X.r[0] + dy * X.r[1], v = dx * X.f[0] + dy * X.f[1], cu = clamp(u, -X.hw, X.hw), cv = clamp(v, -X.hl, X.hl);
        let ou = u - cu, ov = v - cv, d = Math.hypot(ou, ov), pen;
        if (d > 1e-9) { if (d >= cr) continue; pen = cr - d; ou /= d; ov /= d; }
        // (its middle inside the box: out through the nearer side)
        else if (X.hw - Math.abs(u) < X.hl - Math.abs(v)) { ou = u < 0 ? -1 : 1; ov = 0; pen = X.hw - Math.abs(u) + cr; }
        else { ou = 0; ov = v < 0 ? -1 : 1; pen = X.hl - Math.abs(v) + cr; }
        e.transform.pos[0] += (ou * X.r[0] + ov * X.f[0]) * pen; e.transform.pos[1] += (ou * X.r[1] + ov * X.f[1]) * pen;
      }
    }
  }

  // ── THE RIDE RULE ────────────────────────────────────────────────────────────────────────────────────────────────
  function ride(e, input, dt, world) {
    const r = e.rule, t = e.transform, G = r.gaits || [];
    // (a horse no one can ride: it stands at ease)
    if (!G.length) { const I = r.idle; if (I) { e.locomotion = I.loose || I.clip; e.gaitPhase = (e.gaitPhase || 0) + dt / (I.s || 4); e.moving = true; } return; }
    const ground = () => {
      const gz = world && world.ground ? world.ground([t.pos[0], t.pos[1], t.pos[2] + (r.height ?? 2.2)]) : null;
      if (gz != null) t.pos[2] = gz < t.pos[2] ? Math.max(gz, t.pos[2] - (r.fallRate ?? 12) * dt) : gz;
    };
    // getting on or off: the clip the wrapper names, halted
    if (e.mountClip) { e.locomotion = e.mountClip; e.gaitPhase = Math.min(0.999, e.mountU || 0); e.moving = true; e.speed = 0; e.jumpT = null; ground(); return; }
    const ridden = !!e.riderId && world && world.pilotId === e.id;
    const inp = ridden ? input : ZERO_INPUT, clip = (g) => (ridden ? g.clip : (g.loose || g.clip));
    let v = e.speed || 0;
    const top = G[G.length - 1].v;
    // the jump in flight: its clip once, carried at its own speed, steered a little
    if (e.jumpT != null && r.jump) {
      e.jumpT += dt;
      if (e.jumpT >= r.jump.s) e.jumpT = null;
      else {
        const u = e.jumpT / r.jump.s, J = r.jump;
        v = J.v; t.heading = (t.heading - clamp(inp.turn, -1, 1) * (r.turn ?? 1.6) * 0.25 * dt) % TAU;
        const f = fwdXY(t.heading); t.pos[0] += f[0] * v * dt; t.pos[1] += f[1] * v * dt;
        const air = J.air && u >= J.air[0] && u <= J.air[1];
        if (world && world.colliders) resolveBlocking(t.pos, t.pos[2], r.height ?? 2.2, r.radius ?? 0.55, world.colliders, air ? (J.clear ?? 1.1) : (r.step ?? 0.35));
        ground();
        e.speed = v; e.locomotion = J.clip; e.gaitPhase = Math.min(0.999, u); e.moving = true; e.airborne = !!air;
        return;
      }
    }
    e.airborne = false;
    // the stick: on, back to a halt, checked, reined back
    const fwd = clamp(inp.forward, -1, 1), cap = top * (r.cap ?? 1), back = r.back ? r.back.v : 0;
    if (fwd > 0) v = v < 0 ? Math.min(0, v + (r.brake ?? 7) * dt) : Math.min(cap, v + (r.accel ?? 3) * fwd * dt);
    else if (fwd < 0) v = v > 0 ? Math.max(0, v + (r.brake ?? 7) * fwd * dt) : Math.max(-back, v - (r.accel ?? 3) * 0.5 * dt);
    else v = v > 0 ? Math.max(0, v - (r.coast ?? 2.5) * dt) : Math.min(0, v + (r.coast ?? 2.5) * dt);
    if (Math.abs(v) < 1e-3) v = 0;
    // the turn: tighter at a halt, wider the faster
    const turnIn = clamp(inp.turn, -1, 1), rate = (r.turn ?? 1.6) / (1 + Math.abs(v) * (r.tighten ?? 0.08));
    t.heading = (t.heading - turnIn * rate * dt) % TAU;
    const f = fwdXY(t.heading), x0 = t.pos[0], y0 = t.pos[1];
    t.pos[0] += f[0] * v * dt; t.pos[1] += f[1] * v * dt;
    if (world && world.colliders) resolveBlocking(t.pos, t.pos[2], r.height ?? 2.2, r.radius ?? 0.55, world.colliders, r.step ?? 0.35);
    // (a wall that takes most of the step stops it: its speed what it covered, so a fence above its jump is refused, the
    // horse pulled up at it and its gait come down, never galloping on the spot)
    if (Math.abs(v) > 0.5) { const got = ((t.pos[0] - x0) * f[0] + (t.pos[1] - y0) * f[1]) / dt; if (Math.abs(got) < Math.abs(v) * 0.5) v = Math.sign(v) * Math.max(0, Math.abs(got)); }
    ground();
    // the gait: the speed's band, held across its edges by the hysteresis
    let gi = Number.isInteger(e.gaitIx) ? Math.min(G.length - 1, e.gaitIx) : 0;
    const band = r.band ?? 0.25, lo = (i) => (i > 0 ? (G[i - 1].v + G[i].v) / 2 : -Infinity), hi = (i) => (i < G.length - 1 ? (G[i].v + G[i + 1].v) / 2 : Infinity);
    while (gi < G.length - 1 && v > hi(gi) + band) gi++;
    while (gi > 0 && v < lo(gi) - band) gi--;
    e.gaitIx = gi;
    // the jump asked: at a trot or faster
    if (ridden && r.jump && inp.jump && gi >= (r.jump.from ?? 1)) { e.jumpT = 0; e.speed = Math.max(v, r.jump.v); e.locomotion = r.jump.clip; e.gaitPhase = 0; e.moving = true; return; }
    e.speed = v; e.moving = true;
    if (v > 0) { e.locomotion = clip(G[gi]); e.gaitPhase = (e.gaitPhase || 0) + v * dt / G[gi].stride; }
    else if (v < 0 && r.back) { e.locomotion = r.back.clip; e.gaitPhase = (e.gaitPhase || 0) + -v * dt / r.back.stride; }
    else if (turnIn !== 0) { e.locomotion = clip(G[0]); e.gaitPhase = (e.gaitPhase || 0) + rate * Math.abs(turnIn) * dt * (r.pivot ?? 0.35); }
    else { const I = r.idle || G[0]; e.locomotion = ridden ? I.clip : (I.loose || I.clip); e.gaitPhase = (e.gaitPhase || 0) + dt / (I.s || 4); }
  }
  // the rider's while it sits the horse: nothing of its own (the wrapper carries it)
  function mounted() {}
  Object.assign(RULES, { ride, mounted });

  // ── GETTING ON AND OFF ──────────────────────────────────────────────────────────────────────────────────────────
  const busy = (p) => p.swingT != null || p.dodgeT != null || p.tackleT != null || p.staggerT != null || p.jumpCharge >= 0 || p.grounded === false || p.downed;
  // the follow camera handed over, and (`mount.camera`: a horse and its rider are bigger than a walker) pulled back while
  // riding, its own framing given back on getting off
  function retarget(state, from, to, cam) {
    const C = state.camera && state.camera.rule;
    if (!C || C.target !== from) return;
    C.target = to;
    if (cam) { state.mountCam = { dist: C.dist, height: C.height, lookH: C.lookH }; Object.assign(C, cam); }
    else if (state.mountCam) { for (const k of ['dist', 'height', 'lookH']) { if (state.mountCam[k] === undefined) delete C[k]; else C[k] = state.mountCam[k]; } state.mountCam = null; }
  }
  function carry(p, h) { p.transform.pos[0] = h.transform.pos[0]; p.transform.pos[1] = h.transform.pos[1]; p.transform.pos[2] = h.transform.pos[2] + ((p.riderRule && p.riderRule.eye) || 0); p.transform.heading = h.transform.heading; p.moving = true; p.vel = [0, 0, 0]; }
  function event(state, ev) { (state.mountEvents || (state.mountEvents = [])).push(ev); }

  E.stepWorld = function stepWithMounts(state, input, dt, hooks) {
    const horses = state.entities.filter((e) => e.mount);
    if (!horses.length) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    // (a cab no one drives is PARKED: it stands on no rule of its own, so the stick its driver-to-be still holds on the
    // way to its door moves nothing; its own rule is back the step after its driver is in)
    for (const h of horses) {
      if (!h.mount.cab) continue;
      const driven = state.pilotId === h.id;
      if (!driven && !h.cabRule) { h.cabRule = h.rule; h.rule = { type: 'mounted' }; h.speed = 0; }
      else if (driven && h.cabRule) { h.rule = h.cabRule; h.cabRule = null; }
    }
    const press = !!(input && input.interact) || !!state.mountPress;
    state.mountPress = 0;
    const pilot = state.byId[state.pilotId];
    // the rider of the piloted horse, or the pilot itself on foot
    const P = pilot && pilot.mount ? state.byId[pilot.riderId] : pilot;
    if (press && P && !P.mount && !P.mountedOn && !busy(P)) {
      // GET ON: the nearest free horse in reach (a body that rides), or the nearest free cab (any walker)
      let best = null, bd = Infinity;
      for (const h of horses) {
        if (h.riderId || h.downed || h.gone || !(P.rides || h.mount.cab)) continue;
        const d = Math.hypot(h.transform.pos[0] - P.transform.pos[0], h.transform.pos[1] - P.transform.pos[1]);
        if (d < (h.mount.reach ?? 2.6) && d < bd) { bd = d; best = h; }
      }
      if (best) {
        best.riderId = P.id; best.speed = 0; best.jumpT = null;
        P.mountedOn = best.id; P.mountPhase = 'approach'; P.mountT = 0; P.mountFrom = [P.transform.pos[0], P.transform.pos[1], P.transform.pos[2], P.transform.heading];
        P.riderRule = P.rule; P.rule = { type: 'mounted' }; P.swingT = null; P.dodgeT = null; P.dashVel = null;
      }
    } else if (press && P && P.mountedOn && P.mountPhase === 'ride') {
      // GET OFF: at a walk or halted
      const h = state.byId[P.mountedOn];
      if (h && Math.abs(h.speed || 0) <= (h.mount.slow ?? 1.8) && h.jumpT == null) { P.mountPhase = 'dismount'; P.mountT = 0; h.mountClip = h.mount.dismount.clip || null; h.mountU = 0; }
    }
    // THROWN OUT (the cast's `dismount`, `e.eject`: the law's bust): a rider made to get off now, the car stopped, set
    // down at `eject.to` when it names one; one on foot is as it was
    for (const h of horses) {
      const p = h.riderId && state.byId[h.riderId];
      if (!p || !p.eject) continue;
      h.speed = 0; h.mountClip = null; p.mountPhase = 'dismount'; p.mountT = (h.mount.dismount && h.mount.dismount.s) || 0;
    }
    for (const e of state.entities) if (e.eject && !e.mountedOn) e.eject = null;
    // the moment before the step: approaching, getting on, getting off
    for (const h of horses) {
      const p = h.riderId && state.byId[h.riderId];
      if (!p) continue;
      const M = h.mount;
      if (p.mountPhase === 'approach') {
        // walk to the near side, turning to face the horse; then on
        p.mountT += dt;
        const at = local(h, M.stand), want = h.transform.heading + (M.facing ?? -Math.PI / 2);
        const dx = at[0] - p.transform.pos[0], dy = at[1] - p.transform.pos[1], d = Math.hypot(dx, dy), sp = M.approach ?? 1.4;
        const go = Math.min(d, sp * dt);
        if (d > 1e-6) { p.transform.pos[0] += dx / d * go; p.transform.pos[1] += dy / d * go; }
        const turnTo = d > 0.3 ? Math.atan2(dy, dx) : want, da = wrapA(turnTo - p.transform.heading);
        p.transform.heading += clamp(da, -4 * dt, 4 * dt);
        p.locomotion = d > 0.05 ? (M.walk || 'forward') : 'idle'; p.moving = d > 0.05; p.gaitPhase = (p.gaitPhase || 0) + go / (M.stride ?? 1.4);
        if ((d <= 0.05 && Math.abs(wrapA(want - p.transform.heading)) < 0.05) || p.mountT > (M.approachMax ?? 3)) {
          p.mountPhase = 'mount'; p.mountT = 0; h.mountClip = M.mount.clip || null; h.mountU = 0;
          // (into a cab: gone from the world from the door on)
          if (M.cab) p.gone = true;
          event(state, { type: 'mounting', rider: p.id, mount: h.id });
        }
      }
    }
    step(state, input, dt, hooks);
    hulls(state, horses);
    // the moment after: the rider carried in its horse's frame, playing the horse's clip
    for (const h of horses) {
      const p = h.riderId && state.byId[h.riderId];
      if (!p) continue;
      const M = h.mount;
      if (p.mountPhase === 'mount') {
        p.mountT += dt; const u = p.mountT / M.mount.s;
        h.mountU = Math.min(1, u); carry(p, h); if (M.mount.clip) p.locomotion = M.mount.clip; p.gaitPhase = Math.min(0.999, u);
        if (u >= 1) {
          // on: the horse is the pilot now
          p.mountPhase = 'ride'; h.mountClip = null; h.mountU = 0; h.gaitIx = 0; h.speed = 0;
          state.pilotId = h.id; retarget(state, p.id, h.id, M.camera || null);
          event(state, { type: 'mounted', rider: p.id, mount: h.id });
        }
      } else if (p.mountPhase === 'ride') {
        carry(p, h); p.locomotion = h.locomotion; p.gaitPhase = h.gaitPhase;
      } else if (p.mountPhase === 'dismount') {
        p.mountT += dt; const u = p.mountT / M.dismount.s;
        h.mountU = Math.min(1, u); carry(p, h); if (M.dismount.clip) p.locomotion = M.dismount.clip; p.gaitPhase = Math.min(0.999, u);
        if (u >= 1) {
          // off: set down where the clip leaves the rider, its own rule back, the pilot again
          const at = local(h, M.dismount.stand || M.stand);
          p.transform.pos[0] = at[0]; p.transform.pos[1] = at[1]; p.transform.pos[2] = h.transform.pos[2] + ((p.riderRule && p.riderRule.eye) || 0);
          p.transform.heading = (h.transform.heading + (M.dismount.facing ?? M.facing ?? -Math.PI / 2)) % TAU;
          p.rule = p.riderRule; p.riderRule = null; p.mountedOn = null; p.mountPhase = null; p.mountT = 0; p.moving = false; p.locomotion = 'idle'; p.vel = [0, 0, 0];
          // (out of a cab: in the world again, clear of a wall that stands at its door)
          if (M.cab) { p.gone = false; if (state.colliders) resolveBlocking(p.transform.pos, p.transform.pos[2] - ((p.rule && p.rule.eye) || 0), (p.rule && p.rule.collideHeight) || 1.8, (p.rule && p.rule.collideRadius) || 0.3, state.colliders, (p.rule && p.rule.step) || 0.35); }
          h.riderId = null; h.mountClip = null; h.mountU = 0; h.speed = 0; h.gaitIx = 0;
          state.pilotId = p.id; retarget(state, h.id, p.id, null);
          event(state, { type: 'dismounted', rider: p.id, mount: h.id });
          if (p.eject) { const to = p.eject.to; if (Array.isArray(to)) { p.transform.pos[0] = to[0]; p.transform.pos[1] = to[1]; p.transform.pos[2] = to[2]; } p.eject = null; }
        }
      }
    }
    return state;
  };
}
