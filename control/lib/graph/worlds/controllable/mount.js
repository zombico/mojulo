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

  // a point in a horse's frame (its figure's: +y forward, +x its right) → the world, at the horse's place and heading
  const local = (h, p) => { const a = h.transform.heading - Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [h.transform.pos[0] + p[0] * c - p[1] * s, h.transform.pos[1] + p[0] * s + p[1] * c, h.transform.pos[2]]; };
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

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
    const press = !!(input && input.interact) || !!state.mountPress;
    state.mountPress = 0;
    const pilot = state.byId[state.pilotId];
    // the rider of the piloted horse, or the pilot itself on foot
    const P = pilot && pilot.mount ? state.byId[pilot.riderId] : pilot;
    if (press && P && P.rides && !P.mountedOn && !busy(P)) {
      // GET ON: the nearest free horse in reach
      let best = null, bd = Infinity;
      for (const h of horses) {
        if (h.riderId || h.downed || h.gone) continue;
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
      if (h && Math.abs(h.speed || 0) <= (h.mount.slow ?? 1.8) && h.jumpT == null) { P.mountPhase = 'dismount'; P.mountT = 0; h.mountClip = h.mount.dismount.clip; h.mountU = 0; }
    }
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
          p.mountPhase = 'mount'; p.mountT = 0; h.mountClip = M.mount.clip; h.mountU = 0;
          event(state, { type: 'mounting', rider: p.id, mount: h.id });
        }
      }
    }
    step(state, input, dt, hooks);
    // the moment after: the rider carried in its horse's frame, playing the horse's clip
    for (const h of horses) {
      const p = h.riderId && state.byId[h.riderId];
      if (!p) continue;
      const M = h.mount;
      if (p.mountPhase === 'mount') {
        p.mountT += dt; const u = p.mountT / M.mount.s;
        h.mountU = Math.min(1, u); carry(p, h); p.locomotion = M.mount.clip; p.gaitPhase = Math.min(0.999, u);
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
        h.mountU = Math.min(1, u); carry(p, h); p.locomotion = M.dismount.clip; p.gaitPhase = Math.min(0.999, u);
        if (u >= 1) {
          // off: set down where the clip leaves the rider, its own rule back, the pilot again
          const at = local(h, M.dismount.stand || M.stand);
          p.transform.pos[0] = at[0]; p.transform.pos[1] = at[1]; p.transform.pos[2] = h.transform.pos[2] + ((p.riderRule && p.riderRule.eye) || 0);
          p.transform.heading = (h.transform.heading + (M.dismount.facing ?? M.facing ?? -Math.PI / 2)) % TAU;
          p.rule = p.riderRule; p.riderRule = null; p.mountedOn = null; p.mountPhase = null; p.mountT = 0; p.moving = false; p.locomotion = 'idle'; p.vel = [0, 0, 0];
          h.riderId = null; h.mountClip = null; h.mountU = 0; h.speed = 0; h.gaitIx = 0;
          state.pilotId = p.id; retarget(state, h.id, p.id, null);
          event(state, { type: 'dismounted', rider: p.id, mount: h.id });
        }
      }
    }
    return state;
  };
}
