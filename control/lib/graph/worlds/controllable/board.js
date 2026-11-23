/**
 * board.js — A VEHICLE GOT INTO AND RIDDEN: a machine the pilot climbs into, drives and fights from, and gets out of (a
 * transforming walker's armoured cabin: gameworld/combat/frames.js its frame, gameworld/infiltration-room.js `ride`).
 * Opt-in on the vehicle:
 *
 *   entity.board: {
 *     reach?: 3.5,        metres from the vehicle's middle within which the action gets in
 *     out?: [x, y],       where its rider steps down, in the vehicle's frame (+x its right, +y ahead): absent, its left side
 *     form?: '<form>',    the form it is got into and left in (a walker's tank form: boarded collapsed, its saddle low);
 *                         asked to be left in another, it takes this one first (forms.js wantTransform), then lets go
 *     climb?: 0.6,        seconds the rider takes climbing in (it plays `mantle`, carried onto the vehicle) and down again
 *   }
 *   The vehicle is `pilotable` (its pilot rule its driving's, its ambient rule its standing still: core.js).
 *
 *   input.act   an edge (the action, E). On foot, within a vehicle's reach and with nothing nearer to take (a takedown, a
 *               sleeper to drag: takedown.js, knockout.js, both outside this): the pilot climbs in, then the vehicle is
 *               the pilot (its pilot rule, the stick, the trigger, its turret's look), the camera following it where it
 *               followed the rider, and the rider is aboard (out of sight, not hit, carried with the vehicle). In the
 *               vehicle: it is halted and left (in its boarding form first), the rider set down at `out`, the pilot
 *               again, its own rule and camera back.
 *   A vehicle downed with its rider aboard throws the rider out where it stands.
 *
 * Field ownership: on the rider e.aboard (the vehicle's id), e.boarding ({ v, t, of, from, to, out? }), e.boardCam (the
 * camera rule it had), e.boardHit (its body's hittable before); on the vehicle e.boardedBy, e.boardLeave (a leave asked for
 * while it changes form); state.boardActPrev. While climbing, the rider's held, locomotion, gaitPhase and moving.
 *
 * Wraps stepWorld inside the takedown and the knockout (compose.js), so the action is theirs first. Import-free (the page
 * runs this source via toString(), compose.js); emitted only into a page whose world has a vehicle to board, so every
 * other page keeps every byte.
 */
export function buildBoard(E) {
  const step = E.stepWorld;
  E.registerNormalize((ent, raw) => { if (raw.board && typeof raw.board === 'object') ent.board = { ...raw.board }; });
  // a point in a vehicle's frame (+x its right, +y ahead, +z up) → the world
  const toWorld = (v, p) => {
    const h = v.transform.heading, c = Math.cos(h), s = Math.sin(h), q = v.transform.pos;
    return [q[0] + c * p[1] + s * p[0], q[1] + s * p[1] - c * p[0], q[2] + (p[2] || 0)];
  };
  const outOf = (v) => v.board.out || [-((v.rule && v.rule.collideRadius) || 1.5) - 0.9, 0];
  /** The vehicle the action would get into now, or null. */
  E.boardTarget = (state, p) => {
    if (!p || p.aboard || p.boarding || p.downed || p.gone) return null;
    let best = null, bd = Infinity;
    for (const v of state.entities) {
      if (!v.board || v === p || v.boardedBy || v.downed || v.gone) continue;
      const d = Math.hypot(v.transform.pos[0] - p.transform.pos[0], v.transform.pos[1] - p.transform.pos[1]);
      if (d <= (v.board.reach ?? 3.5) && d < bd) { bd = d; best = v; }
    }
    return best;
  };
  // the pilot handed over (core.js's swap: the one let go to its ambient rule, the other to its pilot rule), the camera
  // with it
  function handOver(state, from, to) {
    from.rule = from.ambientRule || { type: 'static' }; from.moving = false;
    to.rule = to.pilotRule || to.rule;
    state.pilotId = to.id;
    const C = state.camera;
    if (C && C.rule && C.rule.target === from.id) C.rule = { ...C.rule, target: to.id };
  }
  function getIn(state, p, v) {
    p.aboard = v.id; p.boarding = null; p.held = true; p.boardHit = !!(p.body && p.body.hittable);
    if (p.body) p.body.hittable = false;
    p.boardCam = state.camera && state.camera.rule ? state.camera.rule : null;
    v.boardedBy = p.id; v.boardLeave = false;
    handOver(state, p, v);
  }
  function getOut(state, v, hooks) {
    const p = state.byId[v.boardedBy];
    v.boardedBy = null; v.boardLeave = false; v.speed = 0;
    if (!p) { v.rule = v.ambientRule || { type: 'static' }; return; }
    const at = toWorld(v, outOf(v)), g = hooks && hooks.ground ? hooks.ground([at[0], at[1], v.transform.pos[2] + 2]) : null;
    p.transform.pos = [at[0], at[1], g != null ? g : v.transform.pos[2]];
    p.transform.heading = v.transform.heading; p.aboard = null; p.held = false;
    if (p.body) p.body.hittable = p.boardHit !== false;
    handOver(state, v, p);
    // (the camera it had, on its own body again)
    if (p.boardCam && state.camera) state.camera.rule = { ...p.boardCam, target: p.id };
    p.boardCam = null;
  }

  E.stepWorld = function stepWithBoard(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null;
    if (!input || !p || !state.entities.some((e) => e.board)) return step(state, input, dt, hooks);
    const act = !!input.act, edge = act && !state.boardActPrev;
    state.boardActPrev = act;
    let inp = input;
    if (p.board && p.boardedBy) {
      // IN THE VEHICLE: the action halts it and lets its rider out, in its boarding form first
      if (edge && p.transformT == null) p.boardLeave = true;
      inp = { ...input, act: 0 };
      if (p.boardLeave) {
        inp = { ...inp, forward: 0, fire: 0 };
        const want = p.board.form;
        if (want && p.forms && p.form !== want) { if (p.transformT == null) p.wantTransform = want; }
        else if (p.transformT == null) { const out = step(state, inp, dt, hooks); getOut(state, p, hooks); return out; }
      }
    } else if (p.boarding) {
      // CLIMBING IN: carried from where it stood onto the vehicle, playing its climb; then aboard
      const B = p.boarding, v = state.byId[B.v];
      B.t += dt / Math.max(0.05, B.of);
      if (!v || v.boardedBy || v.downed || v.gone) { p.boarding = null; p.held = false; }
      else {
        const to = toWorld(v, [outOf(v)[0] * 0.4, 0, 1]), k = Math.min(1, B.t);
        p.transform.pos = [B.from[0] + (to[0] - B.from[0]) * k, B.from[1] + (to[1] - B.from[1]) * k, B.from[2] + (to[2] - B.from[2]) * k];
        p.transform.heading = Math.atan2(v.transform.pos[1] - B.from[1], v.transform.pos[0] - B.from[0]);
        p.locomotion = 'mantle'; p.gaitPhase = Math.min(0.999, B.t); p.moving = true;
        if (B.t >= 1) getIn(state, p, v);
      }
      inp = { ...input, act: 0, fire: 0, forward: 0, strafe: 0 };
    } else if (edge && !p.downed && p.staggerT == null && !(p.av && p.av.on) && p.throwT == null) {
      const v = E.boardTarget(state, p);
      if (v) { p.boarding = { v: v.id, t: 0, of: v.board.climb ?? 0.6, from: p.transform.pos.slice() }; p.held = true; inp = { ...input, act: 0 }; }
    }
    const out = step(state, inp, dt, hooks);
    // the riders carried in their vehicles; a vehicle downed throws its rider out
    for (const e of state.entities) {
      if (!e.aboard) continue;
      const v = state.byId[e.aboard];
      if (!v) { e.aboard = null; e.held = false; continue; }
      if (v.downed || v.gone) { getOut(state, v, hooks); continue; }
      e.transform.pos = v.transform.pos.slice(); e.transform.heading = v.transform.heading; e.moving = false;
    }
    // (climbing in, its clip carried on after the step's own: the step does not run a held body's rule)
    if (p.boarding) { p.locomotion = 'mantle'; p.moving = true; }
    return out;
  };
}
