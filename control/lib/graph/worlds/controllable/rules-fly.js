/**
 * rules-fly.js — the `fly` rule: fixed-wing FLIGHT, same lessons as `drive`
 * (drivable-vehicles.plan.md; the second vehicle feel-model builder). A pure kinematic
 * energy-and-attitude controller, NOT an aerodynamics sim:
 *
 *   • THROTTLE (W / RT): thrust builds airspeed along the flight path; drag is quadratic; S / LT
 *     is the airbrake (a hard drag multiplier — and wheel brakes on the ground).
 *   • ENERGY EXCHANGE: gravity acts ALONG the path — climbing bleeds airspeed, diving buys it
 *     back (a·dt gains −g·sin(pitch) while airborne). This one term is most of what makes a
 *     plane feel like a plane.
 *   • BANK-TO-TURN (A/D): the stick rolls the plane (`bankRate`, capped `bankMax`, self-leveling
 *     when released); heading follows the COORDINATED turn: headingRate = (g / v) · tan(bank).
 *     D banks right and the nose comes right, matching the tank convention everywhere else.
 *   • PITCH (mouse Y, or Space/Shift trim): direct attitude, clamped ±pitchMax. The climb rate
 *     IS v·sin(pitch) — no magic lift number to tune.
 *   • STALL: below `stallSpeed` the elevator loses authority — the nose DROPS (`stallDrop`) and
 *     the plane sinks (`sinkRate` scaled by the speed deficit) until airspeed returns. Surfaced
 *     as the `stalled` fact (+ edge) for warning effects.
 *   • RUNWAY: on the ground below `takeoffSpeed` it TAXIS — nosewheel steer scaled by rolling
 *     speed, wings level, nose down. At rotation speed the pitch input takes and the climb-out
 *     leaves the ground; touching down (any sink, v1 — no crash model) clamps to the surface and
 *     hands you the wheel brakes. `takeoff` / `touchdown` edges fire once each.
 *
 * Rule params (tuned defaults, real-ish units like drive — kg / N / m/s):
 * { mass, thrust?, drag?, brakeDrag?, wheelBrake?, stallSpeed?, takeoffSpeed?, maxSpeed?,
 *   bankMax?, bankRate?, levelRate?, pitchMax?, pitchRate?, lookSens?, taxiTurn?, stallDrop?,
 *   sinkRate?, propRate?, eye? }
 *
 * AFFORDANCE FACTS (the D5 doctrine): locomotion 'fly'|'taxi', airspeed, throttle, bank,
 * climbRate, stalled (+stallStart), airborne, takeoff/touchdown edges, gaitPhase as the prop
 * driver, and `tilt` { pitch, roll } — the renderer's mesh sync reads it to attitude the body.
 *
 * Pure + deterministic; reads the input snapshot + world.ground, writes only its entity.
 * BUILDER CONTRACT (compose.js): import-free inside the function.
 */

export function buildRulesFly(E) {
  const { fwd3, clamp, TAU, RULES } = E;

  const G = 9.81;

  function fly(e, input, dt, world) {
    const r = e.rule;
    const t = e.transform;
    const mass = r.mass > 0 ? r.mass : 1200;
    const maxThrust = r.thrust > 0 ? r.thrust : mass * 6;     // N — thrust/weight ≈ 0.6, sporty prop
    const dragK = r.drag ?? 0.6;
    const vStall = r.stallSpeed > 0 ? r.stallSpeed : 18;
    const vTakeoff = r.takeoffSpeed > 0 ? r.takeoffSpeed : Math.round(vStall * 1.25);
    const vMax = r.maxSpeed > 0 ? r.maxSpeed : 80;
    const bankMax = r.bankMax ?? 1.0, bankRate = r.bankRate ?? 1.8, levelRate = r.levelRate ?? 0.9;
    const pitchMax = r.pitchMax ?? 0.6, pitchRate = r.pitchRate ?? 1.1, lookSens = r.lookSens ?? 0.0025;
    const eye = r.eye ?? 0;
    let v = e.airspeed || 0;

    const throttle = clamp(input.forward, 0, 1);
    const brakeIn = clamp(-input.forward, 0, 1);

    // ground read from body height (the rising-terrain-safe cast the ai/drive use)
    const gz = world && world.ground ? world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 3)]) : null;
    const onGround = gz != null && t.pos[2] - eye <= gz + 0.05;
    const wasAirborne = !!e.airborne;

    // ── airspeed: thrust − drag − brakes − gravity-along-path ──
    let force = maxThrust * throttle - dragK * v * v;
    if (brakeIn > 0) force -= ((r.brakeDrag ?? dragK * 5) * v * v + (onGround ? (r.wheelBrake ?? mass * G * 0.5) : 0)) * brakeIn;
    let a = force / mass;
    if (!onGround) a -= G * Math.sin(t.pitch || 0);           // the energy exchange: climb bleeds, dive buys back
    v = clamp(v + a * dt, 0, vMax);
    if (onGround && throttle === 0 && brakeIn === 0 && v < 0.4) v = 0;   // parked stays parked

    // ── attitude ──
    const bankIn = clamp(input.turn, -1, 1);                  // D = +1 = bank right
    let stalled = false;
    if (onGround && v < vTakeoff) {
      // TAXI: nosewheel steer (authority grows with rolling speed), wings level, nose down.
      t.heading = (t.heading - bankIn * (r.taxiTurn ?? 1.1) * Math.min(1, v / vTakeoff) * dt) % TAU;
      e.bank = (e.bank || 0) - clamp(e.bank || 0, -levelRate * 2 * dt, levelRate * 2 * dt);
      t.pitch = (t.pitch || 0) - clamp(t.pitch || 0, -pitchRate * dt, pitchRate * dt);
    } else {
      e.bank = clamp((e.bank || 0) + bankIn * bankRate * dt, -bankMax, bankMax);
      if (bankIn === 0) e.bank -= clamp(e.bank, -levelRate * dt, levelRate * dt);   // self-leveling
      t.heading = (t.heading - (G / Math.max(v, vStall)) * Math.tan(e.bank) * dt) % TAU;   // coordinated: bank right → turn right
      t.pitch = clamp((t.pitch || 0) + input.lookDY * lookSens + (input.lift || 0) * pitchRate * dt, -pitchMax, pitchMax);
      // STALL: the elevator loses the nose below stall speed — it drops until airspeed returns.
      if (!onGround && v < vStall) {
        stalled = true;
        t.pitch = Math.max(-pitchMax, t.pitch - (r.stallDrop ?? 0.8) * dt);
      }
    }

    // ── integrate the flight path. The path pitch is 0 while ROLLING below rotation speed; at
    // vTakeoff the held pitch takes and the climb-out lifts off the runway (the rotation).
    const pathPitch = onGround && v < vTakeoff ? 0 : (t.pitch || 0);
    const dir = fwd3(t.heading, pathPitch);
    t.pos[0] += dir[0] * v * dt;
    t.pos[1] += dir[1] * v * dt;
    let vz = onGround && pathPitch <= 0 ? 0 : dir[2] * v;     // a grounded nose-down path stays rolling
    if (!onGround && stalled) vz -= (r.sinkRate ?? 6) * (1 - v / vStall);   // the mush: sink by the deficit
    t.pos[2] += vz * dt;

    // ── ground contact: clamp + the takeoff / touchdown edges (0.1 hysteresis) ──
    let airborne;
    if (gz != null) {
      const surf = gz + eye;
      // the clamp threshold MATCHES the onGround read (0.05) — a descent ending inside the band
      // must land, not freeze with grounded physics and airborne flags.
      if (t.pos[2] <= surf + 0.05) { t.pos[2] = surf; airborne = false; }
      else airborne = t.pos[2] > surf + 0.1 ? true : wasAirborne;
    } else airborne = true;                                   // over a void: flying whether you like it or not
    e.takeoff = airborne && !wasAirborne ? true : false;
    e.touchdown = !airborne && wasAirborne ? true : false;
    e.airborne = airborne;

    // ── the affordance facts ──
    e.airspeed = v;
    e.throttle = throttle;
    e.climbRate = airborne ? vz : 0;
    e.stallStart = stalled && !e.stalled ? true : false;
    e.stalled = stalled;
    e.tilt = { pitch: airborne ? (t.pitch || 0) : 0, roll: e.bank || 0 };   // the mesh sync attitudes the body
    e.locomotion = airborne ? 'fly' : 'taxi';
    e.gaitPhase = (e.gaitPhase || 0) + (0.2 + throttle) * (r.propRate ?? 3) * dt;   // the prop driver
    e.moving = v > 1e-3;
  }

  Object.assign(RULES, { fly });
}
