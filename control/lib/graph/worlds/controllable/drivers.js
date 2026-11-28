/**
 * drivers.js — A TAKEN CAR'S DRIVER (an OPT-IN builder, compose.js EMISSION_OPT_IN.drivers: emitted only into a page whose
 * world carries `drivers`, so every other page keeps its bytes): a car stopped in the traffic and taken (a cab the page
 * stood in for it, `mount.spare`: scene/channels/cab-pool.js; never a parked one, which has nobody in it) has someone in
 * it, and they get out of the open door as the one taking it comes to it:
 *
 *   ARMED   the taker's gun out (`gunOut`): out with their hands up and their head down (`surrender`, a pose the page
 *           lays over the run), a moment there, then running off away from the car, gone once out of the way; the
 *           taker gets in
 *   BARE    no gun out: out to fight (a body of the world's `fight` pool, its own melee rule: it seeks the taker and
 *           swings), and the taker does not get in: the car stands where it was stopped, free once the fight is over
 *           (the driver down, or left behind); a driver down is gone a few seconds on
 *
 * Each car has one driver, out once: taken again, it is empty.
 *
 *   world spec `drivers`: {
 *     flee:  [id]    bodies stood asleep (dormant, gone) to get out with their hands up
 *     fight: [id]    bodies stood asleep to get out fighting (each its own melee rule, a pursuer's)
 *     out?:  0.8     m out from the door they stand at
 *     up?:   1.1     s their hands are up before they run
 *     run?:  4.8     m/s they run off at
 *     runFor?: 6     s they run before they are gone
 *     far?:  45      m a fighter left behind is gone at
 *     lie?:  4       s a fighter down lies before it is gone
 *   }
 *
 *   state.drivers { flee, fight, …, seq, log }   ·   on a driver: e.drv { kind: 'flee' | 'fight', car, phase, t, away }
 *   bus: `driver:flee` { car, driver }, `driver:fight` { car, driver }, `driver:down` { car, driver } (castFacts, wrapped)
 *
 * Wraps stepWorld, after the mount (compose.js): its before sees the taker start for the door (mount.js `approach`).
 * Import-free (the page runs this source via toString(), compose.js).
 */
export function buildDrivers(E) {
  const step = E.stepWorld;
  const D = { out: 0.8, up: 1.1, run: 4.8, runFor: 6, far: 45, lie: 4 };
  // a point in a car's frame (its stand, mount.js `local`): x across it, y along it
  const local = (h, p) => { const a = h.transform.heading - Math.PI / 2, c = Math.cos(a), s = Math.sin(a); return [h.transform.pos[0] + p[0] * c - p[1] * s, h.transform.pos[1] + p[0] * s + p[1] * c]; };
  const feetOf = (e) => e.transform.pos[2] - ((e.rule && e.rule.eye) || 0);

  E.registerStateInit((state, spec) => {
    const S = spec.drivers;
    if (!S || !((S.flee && S.flee.length) || (S.fight && S.fight.length))) return;
    state.drivers = { flee: [...(S.flee || [])], fight: [...(S.fight || [])], ...D, ...Object.fromEntries(Object.entries(S).filter(([k]) => k in D)), seq: 0, log: [] };
  });

  const log = (S, type, car, driver) => S.log.push({ seq: S.seq++, type, car, driver });
  const free = (state, ids) => ids.map((id) => state.byId[id]).find((e) => e && e.dormant && e.gone && !e.drv) || null;
  function wake(e, at, z, heading) {
    e.dormant = false; e.gone = false; e.downed = false; e.deadAt = null; e.held = false; e.route = null; e.moving = false; e.locomotion = 'idle';
    e.reactClip = null; e.staggerT = null; e.swingT = null; e.vel = [0, 0, 0];
    if (Number.isFinite(e.hpMax) && e.body) { e.body.hp = e.hpMax; e.body.hittable = true; }
    e.transform.pos[0] = at[0]; e.transform.pos[1] = at[1]; e.transform.pos[2] = z + ((e.rule && e.rule.eye) || 0); e.transform.heading = heading;
    if (e.rule && e.rule.type === 'ai') { e.lastSeen = null; e.searchT = null; e.navPath = null; e.mindPhase = null; }
  }
  function away(e) { e.gone = true; e.dormant = true; e.held = false; e.moving = false; e.surrender = false; e.drv = null; e.downed = false; if (e.body) e.body.hittable = false; }

  E.stepWorld = function stepWorld(state, input, dt, hooks) {
    const S = state.drivers, P = S && state.pilotId ? state.byId[state.pilotId] : null;
    if (!S) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    // A TAKER AT THE DOOR: the one on foot just started for a car the traffic gave up (mount.js approach), its driver
    // not yet out
    const h = P && P.mountedOn && P.mountPhase === 'approach' ? state.byId[P.mountedOn] : null;
    if (h && h.mount && h.mount.spare && !h.driverOut) {
      h.driverOut = true;
      const st = h.mount.stand || [-1.2, 0], c = [h.transform.pos[0], h.transform.pos[1]], door = local(h, st);
      const ux = door[0] - c[0], uy = door[1] - c[1], ul = Math.hypot(ux, uy) || 1, u = [ux / ul, uy / ul];
      const at = [door[0] + u[0] * S.out, door[1] + u[1] * S.out], z = feetOf(P), face = Math.atan2(P.transform.pos[1] - at[1], P.transform.pos[0] - at[0]);
      const armed = !!P.gunOut;
      const d = free(state, armed ? S.flee : S.fight);
      if (d) {
        wake(d, at, z, face);
        if (armed) {
          // HANDS UP: still at the door, the pose the page lays over it, then off away from the car
          d.held = true; d.surrender = true; d.drv = { kind: 'flee', car: h.id, phase: 'up', t: 0, away: u };
          log(S, 'flee', h.id, d.id);
        } else {
          // FISTS UP: the taker does not get in (its own rule back, the car left as it stood), the driver at it
          P.rule = P.riderRule || P.rule; P.riderRule = null; P.mountedOn = null; P.mountPhase = null; P.mountT = 0; P.moving = false;
          h.riderId = null;
          d.drv = { kind: 'fight', car: h.id, phase: 'fight', t: 0 };
          log(S, 'fight', h.id, d.id);
        }
      }
    }
    const out = step(state, input, dt, hooks);
    for (const id of [...S.flee, ...S.fight]) {
      const e = state.byId[id], R = e && e.drv;
      if (!R) continue;
      R.t += dt;
      if (R.kind === 'flee') {
        if (R.phase === 'up') { e.held = true; e.moving = false; e.locomotion = 'idle'; if (R.t >= S.up) { R.phase = 'run'; R.t = 0; } continue; }
        // RUNNING OFF: out from the car's side, the way the door opened, hands still up, on the ground it crosses
        const q = e.transform.pos, step2 = S.run * dt;
        q[0] += R.away[0] * step2; q[1] += R.away[1] * step2;
        const g = hooks && hooks.ground ? hooks.ground([q[0], q[1], feetOf(e) + 1]) : null;
        if (g != null && Math.abs(g - feetOf(e)) < 1) q[2] = g + ((e.rule && e.rule.eye) || 0);
        e.transform.heading = Math.atan2(R.away[1], R.away[0]); e.held = true; e.moving = true; e.locomotion = 'sprint';
        e.gaitPhase = (e.gaitPhase || 0) + step2 / 1.6;
        if (R.t >= S.runFor) away(e);
        continue;
      }
      // A FIGHT: over when the driver is down (lying `lie` s, then gone) or left behind
      const T = P ? (P.mountedOn && state.byId[P.mountedOn]) || P : null;
      if (e.downed || (e.body && Number.isFinite(e.body.hp) && e.body.hp <= 0)) {
        if (R.phase !== 'down') { R.phase = 'down'; R.t = 0; log(S, 'down', R.car, e.id); }
        else if (R.t >= S.lie) away(e);
      } else if (T && Math.hypot(T.transform.pos[0] - e.transform.pos[0], T.transform.pos[1] - e.transform.pos[1]) > S.far) away(e);
    }
    return out;
  };

  // the bus hears who got out, and how, and a fighter down (the castFacts the events channel reads, wrapped)
  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev), S = state.drivers;
    if (!S) return out;
    const was = prev && prev.__drivers != null ? prev.__drivers : null;
    out.prev.__drivers = S.seq;
    if (was === null) return out;
    for (const r of S.log) if (r.seq >= was) out.events.push({ type: `driver:${r.type}`, entity: r.driver, car: r.car, driver: r.driver });
    S.log = S.log.filter((r) => r.seq >= S.seq - 16);
    return out;
  };
}
