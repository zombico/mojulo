/**
 * airplane — the fixed-wing flight primitive (views/science/airplane-view.plan section of
 * rocket-view.plan.md's family). The atmospheric sibling of physics/rocket.js: where the
 * rocket fights gravity with brute thrust, an airplane flies on the FOUR FORCES — lift,
 * weight, thrust, drag — and this integrates a complete airline-style flight from brake
 * release to full stop: takeoff roll, rotation, climb, cruise, the 3° descent, approach,
 * flare, touchdown and rollout. A 'glide' mission cuts the engines at cruise and rides
 * best-L/D to a deadstick landing (the glide-ratio lesson).
 *
 * Forces, every step:
 *   LIFT   L = ½ρv²·S·C_L(α, config) — C_L linear in angle-of-attack up to the stall,
 *          then a smooth post-stall droop; flap configs shift the curve up (and the stall
 *          angle down). α = pitch − flight-path angle: the pilot commands PITCH, the
 *          trajectory sets γ, and the wing feels only the difference.
 *   DRAG   D = ½ρv²·S·(C_D0(config, gear, spoilers) + C_L²/(π·AR·e)) — parasite + INDUCED
 *          drag (the lift-dependent term that makes slow flight draggy).
 *   THRUST T = throttle · T_static · σ^0.7 (jet lapse with density ratio σ).
 *   WEIGHT mg, constant (a short hop burns ~1-2 % of mass in fuel — stated carve-out).
 *   GROUND while rolling: normal force N = max(0, W − L), rolling or braking friction μN.
 * Atmosphere is the sibling's US Standard 1976 model — imported from rocket.js so there is
 * exactly one authoritative ρ(h)/p(h) in the codebase.
 *
 * The honesty line, same as the rocket: the FORCES are real; the PILOT is scripted — rate-
 * limited pitch commands driven by simple proportional laws (hold a speed, hold a path
 * angle, flare), throttle by phase. Real jets fly FMS/autothrottle logic; ours is an
 * honest autopilot caricature, and the facts panel says so. Carve-outs: 2-D planar (no
 * turns — the hop flies straight to a runway downrange), point-mass with kinematic pitch,
 * constant mass, no ground effect, no wind.
 *
 * Registry doctrine (flight.js/rocket.js): a NAMED aircraft ships with cited constants and
 * its own test band or it doesn't ship. `a320` carries public A320-class numbers (wing
 * area/AR from Airbus, thrust from CFM, aero coefficients from published reconstructions);
 * airplane.test.js pins takeoff roll, rotation speed, climb, approach geometry, touchdown
 * sink and the ~17:1 glide. A CUSTOM spec is the operator's own dial.
 *
 * Pure & deterministic: same spec → byte-identical flight.
 * Frame: z-up, metres, SI. Flight travels +x. Pitch is the NOSE angle above horizontal.
 */

import { atmosphere, gravityAt, G0 } from './rocket.js';

const DEG = Math.PI / 180;
const RHO0 = 1.225;

// ── the aircraft registry ──
export const AIRCRAFT = {
  a320: {
    label: 'A320-class narrowbody',
    mass: 70000,                  // kg — typical mid-weight (MTOW 78 t, OEW 42.6 t; Airbus)
    S: 122.6,                     // m² wing reference area (Airbus)
    AR: 9.5,                      // aspect ratio, span 35.8 m (Airbus)
    e: 0.78,                      // Oswald efficiency (published reconstructions)
    thrustStatic: 241200,         // N — 2 × CFM56-5B4 @ 120.6 kN (CFM)
    cd0: 0.023,                   // clean parasite drag (published reconstructions)
    a: 5.3,                       // lift-curve slope /rad (≈2π corrected for AR)
    alphaStall: 15 * DEG,         // clean stall AoA
    // flap configurations: ΔC_L0 shifts the lift curve up, ΔC_D0 pays for it, and the
    // stall angle comes down as the curve shifts. gear/spoiler drag added separately.
    configs: {
      clean: { dcl: 0.15, dcd: 0, dstall: 0 },
      takeoff: { dcl: 0.60, dcd: 0.012, dstall: -1.5 * DEG },
      landing: { dcl: 1.05, dcd: 0.055, dstall: -3 * DEG },
    },
    cdGear: 0.017,
    cdSpoiler: 0.060,
    muRoll: 0.02, muBrake: 0.35,
  },
};

/** Resolve an aircraft spec — a registry key ('a320') or a CUSTOM object inheriting a320's fields. */
export function resolveAircraft(spec = 'a320') {
  if (typeof spec === 'string') {
    const a = AIRCRAFT[spec];
    if (!a) throw new Error(`resolveAircraft: unknown aircraft '${spec}' — registry: ${Object.keys(AIRCRAFT).join(', ')}; or pass a custom spec object`);
    return { key: spec, ...a };
  }
  if (!spec || typeof spec !== 'object') throw new Error('resolveAircraft: pass a registry key or a custom aircraft spec object');
  const base = AIRCRAFT.a320;
  const a = { key: 'custom', ...base, ...spec, configs: { ...base.configs, ...(spec.configs || {}) }, label: spec.label ?? 'custom aircraft' };
  for (const [k, v] of [['mass', a.mass], ['S', a.S], ['AR', a.AR], ['thrustStatic', a.thrustStatic]]) {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`resolveAircraft: '${k}' must be positive and finite (got ${v})`);
  }
  return a;
}

// lift coefficient: linear to the (config-shifted) stall, then a smooth droop toward a
// post-stall plateau — enough to make an overpull fall through honestly, not a wind tunnel.
export function liftCoeff(alpha, cfg, ac) {
  const aStall = ac.alphaStall + cfg.dstall;
  const clAt = (al) => cfg.dcl + ac.a * al;
  if (alpha <= aStall) return clAt(alpha);
  const over = alpha - aStall;
  return Math.max(0.6, clAt(aStall) - 2.2 * over);   // droop past the stall
}
export function dragCoeff(cl, cfg, ac, { gear = false, spoilers = false } = {}) {
  return ac.cd0 + cfg.dcd + (gear ? ac.cdGear : 0) + (spoilers ? ac.cdSpoiler : 0)
    + (cl * cl) / (Math.PI * ac.AR * ac.e);
}

// stall speed for a config at weight W and density rho (level flight, C_L at the stall).
const stallSpeed = (W, rho, S, clMax) => Math.sqrt((2 * W) / (rho * S * clMax));

// mission profile defaults (the scripted airline hop; every knob overridable via `guidance`)
export const AIRPLANE_PROFILES = {
  hop: {
    label: 'airline hop (takeoff → cruise → landing)',
    cruiseAlt: 2400,          // m — a short-hop cruise so the whole flight frames in one scene
    climbSpeed: 85,           // m/s IAS-ish target after cleanup
    cruiseSpeed: 105,         // m/s at cruise
    glideslope: -3 * DEG,     // the standard approach path
    flareAlt: 12,             // m — begin the flare
    pitchRate: 3 * DEG,       // max pitch rate /s (the rate limit on every command)
    rotateFactor: 1.10,       // Vr = factor · Vs(takeoff config)
    appFactor: 1.28,          // Vapp = factor · Vs(landing config)
    climbPitch: 12 * DEG,     // initial rotate-to target
  },
  glide: {
    label: 'engines-out glide (best L/D)',
    cruiseAlt: 3000, climbSpeed: 85, cruiseSpeed: 105,
    glideslope: -3 * DEG, flareAlt: 30, pitchRate: 3 * DEG,   // deadstick flares HIGH — no thrust to save a late one
    rotateFactor: 1.10, appFactor: 1.28, climbPitch: 12 * DEG,
  },
};

/**
 * Fly a complete fixed-wing mission. Spec: { aircraft?: 'a320'|custom, mission?: 'hop'|'glide',
 * guidance?: {profile overrides}, drag?: false }.
 * @returns {{ aircraft, mission, samples, events, summary }}
 *   samples: [{ t, x, z, vx, vz, pitch, alpha, gamma, cl, ld, lift, drag, thrust, throttle,
 *               v, config, gear, phase }]
 */
export function flyAirplane(spec = {}, opts = {}) {
  const ac = resolveAircraft(spec.aircraft ?? 'a320');
  const missionKey = spec.mission === 'glide' ? 'glide' : 'hop';
  const P = { ...AIRPLANE_PROFILES[missionKey], ...(spec.guidance && typeof spec.guidance === 'object' ? spec.guidance : {}) };
  const dragOn = spec.drag !== false;
  const dt = opts.dtInt ?? 0.04;
  const recordEvery = Math.max(1, Math.round(opts.recordEvery ?? 5));
  const maxT = opts.maxT ?? 1800;

  const m = ac.mass, W = m * G0, S = ac.S;
  const clMaxTO = liftCoeff(ac.alphaStall + ac.configs.takeoff.dstall, ac.configs.takeoff, ac);
  const clMaxLDG = liftCoeff(ac.alphaStall + ac.configs.landing.dstall, ac.configs.landing, ac);
  const Vr = P.rotateFactor * stallSpeed(W, RHO0, S, clMaxTO);
  const Vapp = P.appFactor * stallSpeed(W, RHO0, S, clMaxLDG);
  const bestGlide = Math.sqrt((2 * W) / (RHO0 * S * Math.sqrt(Math.PI * ac.AR * ac.e * ac.cd0)));   // max-L/D speed (clean, SL)

  // phase machine: roll → rotate → climb → cruise → descent → approach → flare → rollout → stop
  let phase = 'roll';
  let x = 0, z = 0, vx = 0.1, vz = 0, pitch = 0, t = 0, step = 0;
  let config = 'takeoff', gear = true, spoilers = false, enginesOut = false, impactSink = 0;
  let xThreshold = null;   // the far runway threshold the descent aims at (set at top of descent)
  const samples = [], events = { brakeRelease: { t: 0 } };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // every pitch command goes through the same rate limiter — the pilot has hands, not teleports.
  const seekPitch = (target, rate = P.pitchRate) => { pitch += clamp(target - pitch, -rate * dt, rate * dt); };

  while (t < maxT) {
    const atm = atmosphere(z);
    const v = Math.hypot(vx, vz);
    const gamma = v > 1 ? Math.atan2(vz, vx) : 0;
    const onGround = z <= 0.01 && (phase === 'roll' || phase === 'rotate' || phase === 'rollout' || phase === 'stop');
    const alpha = onGround ? pitch : pitch - gamma;
    const cfg = ac.configs[config];
    const cl = liftCoeff(alpha, cfg, ac);
    const q = 0.5 * atm.rho * v * v;
    const lift = q * S * cl;
    const cd = dragCoeff(cl, cfg, ac, { gear, spoilers });
    const dragF = dragOn ? q * S * cd : 0;
    const sigma = atm.rho / RHO0;

    // ── the scripted pilot (throttle by phase, pitch through rate-limited P-laws) ──
    let throttle = 0;
    if (phase === 'roll') {
      throttle = 1; seekPitch(0);
      if (v >= Vr) { phase = 'rotate'; events.rotate = { t, v, x }; }
    } else if (phase === 'rotate') {
      throttle = 1; seekPitch(P.climbPitch);
      if (z > 2 && vz > 0) {
        phase = 'climb'; gear = false; events.liftoff = { t, v, x, groundRoll: x };
      }
    } else if (phase === 'climb') {
      throttle = 1;
      if (config === 'takeoff' && v > Vr * 1.25) config = 'clean';   // flaps up through the cleanup speed
      seekPitch(clamp(pitch + 0.02 * (v - P.climbSpeed) * DEG, 2 * DEG, 16 * DEG));   // pitch-for-speed
      if (z >= P.cruiseAlt) {
        phase = 'cruise'; events.topOfClimb = { t, x, alt: z };
        if (missionKey === 'glide') { enginesOut = true; events.enginesOut = { t, x, alt: z, v }; }
      }
    } else if (phase === 'cruise') {
      throttle = clamp(0.5 + 0.02 * (P.cruiseSpeed - v), 0, 0.85);   // speed-hold: throttle balances drag
      seekPitch(clamp(pitch - (0.004 * (z - P.cruiseAlt) + 0.06 * vz) * DEG, -3 * DEG, 8 * DEG));   // hold altitude
      // top of descent: when the 3° cone to a threshold ~cruiseAlt/tan3° ahead opens, go down.
      const toGo = P.cruiseAlt / Math.tan(-P.glideslope);
      const cruiseRun = missionKey === 'glide' ? 1 : 12000;   // the glide mission descends immediately
      if (x >= (events.topOfClimb.x + cruiseRun)) {
        xThreshold = x + toGo; phase = 'descent';
        events.topOfDescent = { t, x, alt: z, threshold: xThreshold };
      }
    } else if (phase === 'descent' || phase === 'approach') {
      // the standard control split: PITCH tracks the path (γ target + the trim AoA that holds
      // lift ≈ W·cosγ at the current airspeed), THROTTLE tracks the speed, and the speedbrakes
      // come out when idle thrust still leaves it fast — exactly what a real descent does.
      const vTgt = enginesOut ? (phase === 'approach' ? Vapp * 1.08 : bestGlide) : (phase === 'approach' ? Vapp : P.cruiseSpeed * 0.92);
      // a deadstick CANNOT hold the powered 3° slope — it rides its own polar all the way down;
      // powered flight aims at the threshold, then locks the standard slope once established.
      const gammaTgt = enginesOut
        ? -Math.atan(1 / Math.max(4, lift / Math.max(1, dragF)))
        : (z < 300 ? P.glideslope
          : clamp(Math.atan2(0 - z, Math.max(200, xThreshold - x)), P.glideslope * 1.25, -0.4 * DEG));
      const alphaTrim = clamp(((W * Math.cos(gammaTgt)) / Math.max(1, q * S) - cfg.dcl) / ac.a, -2 * DEG, 10 * DEG);
      seekPitch(clamp(gammaTgt + alphaTrim, -8 * DEG, 10 * DEG));
      throttle = enginesOut ? 0 : clamp(0.30 + 0.025 * (vTgt - v), 0, 0.85);
      spoilers = !enginesOut && v > vTgt + 8;                      // speedbrakes on overspeed
      if (phase === 'descent' && z < 900) {
        // gear + flaps for landing — a deadstick keeps the takeoff setting (better L/D; the
        // full-flap drag would steepen a glide it cannot afford to steepen).
        phase = 'approach'; config = enginesOut ? 'takeoff' : 'landing'; gear = true; spoilers = false;
        events.approach = { t, x, alt: z, v };
      }
      if (z <= P.flareAlt && phase === 'approach') { phase = 'flare'; events.flare = { t, v, sink: -vz }; }
    } else if (phase === 'flare') {
      throttle = 0;
      // sink-proportional flare: pitch up harder the faster it is coming down, easing to a
      // sub-metre-per-second touch — kinetic energy traded for a soft arrival.
      seekPitch(clamp(pitch + 0.9 * DEG * (-vz - 0.5), 0, 9.5 * DEG), P.pitchRate * 2.2);
      if (z <= 0.01 && vz <= 0) {
        phase = 'rollout'; spoilers = true; config = 'clean';
        events.touchdown = { t, x, v, sink: impactSink };   // the pre-clamp sink — the honest number
      }
    } else if (phase === 'rollout') {
      throttle = 0; seekPitch(0);
      if (v < 2) { phase = 'stop'; events.stop = { t, x, rolloutLen: x - events.touchdown.x }; }
    }
    if (phase === 'stop') {
      samples.push({ t, x, z: 0, vx: 0, vz: 0, pitch, alpha: pitch, gamma: 0, cl, ld: 0, lift: 0, drag: 0, thrust: 0, throttle: 0, v: 0, config, gear, phase });
      break;
    }

    const thrust = enginesOut ? 0 : throttle * ac.thrustStatic * Math.pow(sigma, 0.7);

    if (step % recordEvery === 0) {
      samples.push({ t, x, z, vx, vz, pitch, alpha, gamma, cl, ld: dragF > 1 ? lift / dragF : 0, lift, drag: dragF, thrust, throttle, v, config, gear, phase });
    }

    // ── forces → acceleration. Lift ⟂ velocity (rotated +90° from v̂), drag ∥ −v̂,
    // thrust along the body axis (pitch), weight down; ground adds normal + friction. ──
    const vhat = v > 0.5 ? [vx / v, vz / v] : [1, 0];
    const lhat = [-vhat[1], vhat[0]];
    let ax = (thrust * Math.cos(pitch) + lift * lhat[0] - dragF * vhat[0]) / m;
    let az = (thrust * Math.sin(pitch) + lift * lhat[1] - dragF * vhat[1]) / m - gravityAt(z);
    if (onGround) {
      const N = Math.max(0, W - lift);
      const mu = phase === 'rollout' ? ac.muBrake : ac.muRoll;
      ax -= mu * N * Math.sign(vx || 1) / m;
      if (az < 0) az = 0;   // the runway holds the wheels up
    }
    vx += ax * dt; vz += az * dt;
    x += vx * dt; z += vz * dt;
    if (z < 0) { z = 0; if (vz < 0) { impactSink = -vz; vz = 0; } }
    t += dt; step++;
  }

  const glideRatio = events.enginesOut && events.touchdown
    ? (events.touchdown.x - events.enginesOut.x) / Math.max(1, events.enginesOut.alt) : null;

  return {
    aircraft: ac, mission: missionKey, guidance: P,
    samples, events,
    summary: {
      Vr, Vapp, bestGlide,
      groundRoll: events.liftoff ? events.liftoff.groundRoll : null,
      touchdown: events.touchdown || null,
      glideRatio,
      T: samples.length ? samples[samples.length - 1].t : 0,
      range: samples.length ? samples[samples.length - 1].x : 0,
    },
  };
}
