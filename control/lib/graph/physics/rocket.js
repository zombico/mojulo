/**
 * rocket — the launch-vehicle ascent/return primitive (views/science/rocket-view.plan.md, v1).
 * The big sibling of physics/flight.js: where flight.js integrates a struck ball through real
 * air, this integrates a FALCON-9-CLASS booster through a full mission — liftoff, gravity
 * turn, Max-Q, MECO, stage separation, (RTLS) boostback, entry burn, tail-first descent and
 * the hoverslam landing burn — with every acceleration coming from a real force.
 *
 * Forces, every step: THRUST T(h) = T_vac − A_e·p(h) along the scripted attitude, with mass
 * flow ṁ = T/(Isp(h)·g₀) and Isp interpolating sea-level→vacuum on the pressure ratio ·
 * DRAG ½ρ(h)v²C_d(M)A against a US Standard Atmosphere 1976 fit (C_d Mach-dependent on
 * ascent — subsonic plateau, transonic rise, supersonic decay — and a blunt tail-first
 * constant on descent) · GRAVITY inverse-square g(h).
 *
 * The honesty line (stated, enforced): the FORCES are real; the CONTROL INPUTS are scripted,
 * not closed-loop. Real F9 flies onboard convex-optimization guidance; here the ascent is a
 * true gravity turn (thrust held along velocity after a small pitch kick), MECO fires on the
 * propellant return-reserve, the RTLS boostback cutoff is solved by deterministic iteration
 * so the booster actually comes home, the entry burn is threshold-triggered, and the landing
 * burn flies the constant-deceleration hoverslam law a_cmd = v²/(2h) + g. The hoverslam is
 * genuinely forced: one Merlin at minimum throttle out-thrusts the near-dry booster's weight
 * (TWR_min > 1), so it cannot hover — it must time the burn to hit v≈0 at h≈0.
 *
 * Carve-outs (each a stated simplification, not a hidden lie): 2-D planar (x downrange,
 * z up — no cross-range, no Earth rotation), point-mass with kinematic attitude (the pitch
 * angle is posed, not torque-integrated), drag-only aerodynamics (no AoA lift; grid fins
 * enter as the descent C_d, not surfaces), one averaged engine (no engine-out), fairing
 * stays with stage 2.
 *
 * The registry is CLOSED vocabulary, flight.js-style: a NAMED vehicle ships with cited
 * constants and its own test band (rocket.test.js pins the falcon9 profiles against public
 * webcast telemetry envelopes) or it doesn't ship. Beside it, a CUSTOM vehicle spec is the
 * operator's own explicit dial — same integrator, the operator owns the constants.
 *
 * Pure & deterministic: same spec → byte-identical mission. Zero imports on purpose.
 * Frame: z-up, metres, SI. Ascent travels +x.
 */

export const G0 = 9.80665;          // m/s² — standard gravity (Isp convention)
export const R_EARTH = 6371000;     // m — mean radius, for inverse-square g(h)

// gravitational acceleration at altitude h (m) — inverse-square, ~4 % lighter at a 140 km apogee.
export const gravityAt = (h) => G0 * (R_EARTH / (R_EARTH + Math.max(0, h))) ** 2;

// ── US Standard Atmosphere 1976, geopotential layers to 84.85 km (base temperature Tb K,
// lapse L K/m, base pressure Pb Pa per layer), exponential tail above. Returns temperature,
// pressure, density and speed of sound — p(h) drives thrust/Isp altitude compensation, ρ(h)
// drives drag, a(h) gives the Mach number the ascent C_d curve keys on. ──
const ATM_LAYERS = [
  { hb: 0, Tb: 288.15, L: -0.0065, Pb: 101325 },
  { hb: 11000, Tb: 216.65, L: 0, Pb: 22632.06 },
  { hb: 20000, Tb: 216.65, L: 0.001, Pb: 5474.889 },
  { hb: 32000, Tb: 228.65, L: 0.0028, Pb: 868.0187 },
  { hb: 47000, Tb: 270.65, L: 0, Pb: 110.9063 },
  { hb: 51000, Tb: 270.65, L: -0.0028, Pb: 66.93887 },
  { hb: 71000, Tb: 214.65, L: -0.002, Pb: 3.956420 },
];
const R_AIR = 287.053, GAMMA = 1.4, H_TOP = 84852;

export function atmosphere(hRaw) {
  const h = Math.max(0, hRaw);
  if (h >= H_TOP) {
    // exponential tail — density is already ~1e-5 kg/m³ here; keeps ρ/p smooth and positive.
    const top = atmosphere(H_TOP - 1);
    const f = Math.exp(-(h - H_TOP) / 6000);
    return { T: top.T, p: top.p * f, rho: top.rho * f, a: top.a };
  }
  let L = ATM_LAYERS[0];
  for (const layer of ATM_LAYERS) { if (h >= layer.hb) L = layer; else break; }
  const T = L.Tb + L.L * (h - L.hb);
  const p = L.L === 0
    ? L.Pb * Math.exp((-G0 * (h - L.hb)) / (R_AIR * L.Tb))
    : L.Pb * (T / L.Tb) ** (-G0 / (R_AIR * L.L));
  return { T, p, rho: p / (R_AIR * T), a: Math.sqrt(GAMMA * R_AIR * T) };
}

// ── ascent drag coefficient vs Mach: subsonic plateau → transonic rise → supersonic decay.
// Same smooth-curve idiom as flight.js's drag crisis; constants are the generic slender
// launch-vehicle shape from published C_d(M) reconstructions, owned by the vehicle entry. ──
export function ascentCd(mach, aero = {}) {
  const sub = aero.cdSub ?? 0.28, peak = aero.cdPeak ?? 0.62, sup = aero.cdSup ?? 0.24;
  const mPeak = aero.mPeak ?? 1.1, wUp = aero.wUp ?? 0.09, kDown = aero.kDown ?? 0.9;
  if (mach <= mPeak) return sub + (peak - sub) / (1 + Math.exp(-(mach - (mPeak - 0.18)) / wUp));
  return sup + (peak - sup) * Math.exp(-(mach - mPeak) / kDown);
}

// ── the vehicle registry. falcon9 constants are SpaceX-published specs plus the widely
// corroborated public estimates (dry mass), source-commented; the test band in
// rocket.test.js is the gate that keeps them honest. ──
export const VEHICLES = {
  falcon9: {
    label: 'Falcon 9 Block 5',
    diameter: 3.66,                 // m (SpaceX)
    stack: { length: 70 },          // m, full vehicle (SpaceX)
    stage1: {
      length: 47.7,                 // m booster w/ interstage (public reconstruction)
      dry: 25600,                   // kg — public estimate (SpaceX does not publish)
      prop: 395700,                 // kg LOX/RP-1 (SpaceX)
      thrustSL: 7607000,            // N, 9 engines sea level (SpaceX)
      thrustVac: 8227000,           // N, 9 engines vacuum (SpaceX)
      ispSL: 282, ispVac: 311,      // s, Merlin 1D (SpaceX)
      nEngines: 9,
      minThrottle: 0.4,             // per-engine deep throttle, public estimate
      cdDescent: 2.9,               // EFFECTIVE tail-first C_d on the base area — folds in grid fins,
                                    // legs, engine bells and AoA (public reentry reconstructions put
                                    // the effective drag area at ~2-3× the bare 10.5 m² base)
    },
    stage2: {
      length: 13.8,                 // m w/ MVac skirt (public reconstruction)
      dry: 3900,                    // kg — public estimate
      prop: 92670,                  // kg (SpaceX)
      thrustVac: 981000,            // N MVac (SpaceX)
      ispVac: 348,                  // s (SpaceX)
    },
    fairing: 1900,                  // kg (public estimate); stays attached in v1
    aeroAscent: {},                 // generic slender-vehicle C_d(M) defaults above
  },
};

/**
 * Resolve a vehicle spec — a registry key ('falcon9') or a CUSTOM object with the same
 * shape (stage1/stage2/diameter/…, missing fields inherited from falcon9). Everything must
 * come out positive and finite — a vehicle that can't exist refuses to integrate.
 */
export function resolveVehicle(spec = 'falcon9') {
  if (typeof spec === 'string') {
    const v = VEHICLES[spec];
    if (!v) throw new Error(`resolveVehicle: unknown vehicle '${spec}' — registry: ${Object.keys(VEHICLES).join(', ')}; or pass a custom spec object`);
    return { key: spec, ...v };
  }
  if (!spec || typeof spec !== 'object') throw new Error('resolveVehicle: pass a registry key or a custom vehicle spec object');
  const base = VEHICLES.falcon9;
  const v = {
    key: 'custom', label: spec.label ?? 'custom vehicle',
    diameter: spec.diameter ?? base.diameter,
    stack: { ...base.stack, ...(spec.stack || {}) },
    stage1: { ...base.stage1, ...(spec.stage1 || {}) },
    stage2: { ...base.stage2, ...(spec.stage2 || {}) },
    fairing: spec.fairing ?? base.fairing,
    aeroAscent: { ...base.aeroAscent, ...(spec.aeroAscent || {}) },
  };
  for (const [k, val] of [['diameter', v.diameter], ['stage1.dry', v.stage1.dry], ['stage1.prop', v.stage1.prop],
    ['stage1.thrustSL', v.stage1.thrustSL], ['stage1.thrustVac', v.stage1.thrustVac], ['stage2.dry', v.stage2.dry]]) {
    if (!Number.isFinite(val) || val <= 0) throw new Error(`resolveVehicle: '${k}' must be positive and finite (got ${val})`);
  }
  return v;
}

// ── mission profiles: the scripted-guidance constants per return mode. Tuned so the falcon9
// preset sits inside the rocket.test.js telemetry bands; every knob is overridable through
// the spec's `guidance` object (the operator's dial — the physics underneath doesn't move). ──
export const PROFILES = {
  rtls: {
    label: 'return to launch site',
    payload: 10000,          // kg default (Dragon-class LEO)
    tKick: 7, kickDur: 9, kickDeg: 3.4,   // pitch-over kick, then a true gravity turn
    qBucket: 34000, bucketThrottle: 0.72, // throttle bucket while q > qBucket (contiguous: q is unimodal on ascent)
    aMaxG: 3.6,              // ascent acceleration cap (throttle-down as the stage lightens — real F9 flies one)
    maxAscentPitchDeg: 42,   // gravity-turn guard — RTLS flies STEEP so the boostback stays affordable
    reserveFrac: 0.125,      // stage-1 prop held back for boostback + entry + landing
    sepDelay: 4, flipDur: 14, reorientDur: 16,
    boostback: true, boostbackEngines: 3,
    entryAlt: 60000, entryDv: 800, entryEngines: 3,
    landMargin: 1.10, landEngines: 1, landIgnMaxAlt: 7500,
  },
  asds: {
    label: 'downrange droneship landing',
    payload: 13000,
    tKick: 7, kickDur: 9, kickDeg: 3.0,   // flatter ascent — no boostback, the ship waits downrange
    qBucket: 34000, bucketThrottle: 0.72,
    aMaxG: 3.9,
    maxAscentPitchDeg: 78,
    reserveFrac: 0.055,
    sepDelay: 4, flipDur: 14, reorientDur: 0,
    boostback: false, boostbackEngines: 0,
    entryAlt: 55000, entryDv: 700, entryEngines: 3,
    landMargin: 1.10, landEngines: 1, landIgnMaxAlt: 7500,
  },
};

const DEG = Math.PI / 180;
const TAU_ATT = 999;   // (attitude blends are explicit sweeps, no filter)

// per-engine sea-level/vacuum thrust + the altitude-compensated totals at ambient pressure p.
function thrustAt(s1, p, nEngines, throttle) {
  const p0 = 101325;
  const perVac = s1.thrustVac / s1.nEngines, perSL = s1.thrustSL / s1.nEngines;
  const per = perVac - (perVac - perSL) * Math.min(1, p / p0);
  const isp = s1.ispVac - (s1.ispVac - s1.ispSL) * Math.min(1, p / p0);
  return { thrust: per * nEngines * throttle, isp };
}

// unwrap-continuous angle helper: returns b moved by full turns to sit nearest a.
const unwrapNear = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d; };

/**
 * Fly a full booster mission. The spec is the storable recipe atom:
 *   { vehicle?: 'falcon9' | customSpec, profile?: 'rtls' | 'asds', payload?: kg,
 *     guidance?: { any PROFILES knob }, drag?: false }
 * @param {object} [opts] — dtInt integration step (default 0.05 s) · record every `recordEvery`
 *   steps (default 4 → 0.2 s samples) · maxT safety cap (default 900 s)
 * @returns {{ vehicle, profile, samples, stage2Samples, events, summary }}
 *   samples: [{ t, x, z, vx, vz, m, pitch, thrust, throttle, engines, isp, q, mach, rho, drag, phase }]
 *   pitch is the NOSE angle from vertical (+ toward +x), radians, unwrap-continuous — pose-ready.
 */
export function flyMission(spec = {}, opts = {}) {
  const vehicle = resolveVehicle(spec.vehicle ?? 'falcon9');
  const profileKey = spec.profile === 'asds' ? 'asds' : 'rtls';
  const P = { ...PROFILES[profileKey], ...(spec.guidance && typeof spec.guidance === 'object' ? spec.guidance : {}) };
  const payload = Number.isFinite(+spec.payload) && +spec.payload >= 0 ? +spec.payload : P.payload;
  const dragOn = spec.drag !== false;

  if (!P.boostback) return integrateMission(vehicle, profileKey, P, payload, dragOn, 0, opts);

  // RTLS: solve the boostback cutoff (the return horizontal velocity) by deterministic
  // iteration — fly the whole mission, measure the touchdown miss, correct linearly. The
  // predictor is the sim itself, so drag is inside the loop; 6 fixed passes converge to
  // well under the pad tolerance and the pass count is fixed → same spec, same mission.
  let vxReturn = -120;   // m/s initial guess: modest return velocity toward the pad
  let out = null;
  for (let pass = 0; pass < 6; pass++) {
    out = integrateMission(vehicle, profileKey, P, payload, dragOn, vxReturn, opts);
    const missX = out.events.touchdown ? out.events.touchdown.x : 0;
    const tFall = out.events.touchdown && out.events.boostbackEnd
      ? Math.max(30, out.events.touchdown.t - out.events.boostbackEnd.t) : 300;
    vxReturn -= missX / tFall;
  }
  return out;
}

// the single-pass mission integrator: one booster, one scripted flight, RK4 on [x, z, vx, vz, m].
function integrateMission(vehicle, profileKey, P, payload, dragOn, vxReturn, opts = {}) {
  const dt = opts.dtInt ?? 0.05;
  const recordEvery = Math.max(1, Math.round(opts.recordEvery ?? 4));
  const maxT = opts.maxT ?? 900;
  const s1 = vehicle.stage1, s2 = vehicle.stage2;
  const A = Math.PI * (vehicle.diameter / 2) ** 2;
  const upperMass = s2.dry + s2.prop + vehicle.fairing + payload;   // hauled to MECO, then gone
  const reserve = P.reserveFrac * s1.prop;
  const perEngineVacMax = s1.thrustVac / s1.nEngines;

  // mission mode state machine (times are set as events fire)
  let mode = 'liftoff';   // liftoff → ascent → separation → flip → boostback → coast → entry → descent → landing → down
  let tMeco = null, tSep = null, tFlipEnd = null, tBoostEnd = null, entryDvLeft = P.entryDv, landCut = false;
  let pitchAtMeco = 0, pitchAtFlipEnd = 0;

  // state
  let x = 0, z = 0, vx = 0, vz = 0, prop = s1.prop;
  let pitch = 0;          // nose angle from vertical, unwrap-continuous
  let t = 0, step = 0;
  const samples = [];
  const events = { liftoff: { t: 0 } };
  let maxQ = { t: 0, q: 0, alt: 0 }, entryPeakQ = { t: 0, q: 0, alt: 0 }, apogee = { t: 0, alt: 0 };

  // attitude script: where the NOSE points in each mode (radians from +z toward +x)
  const retroPitch = (vxN, vzN) => {
    const sp = Math.hypot(vxN, vzN);
    if (sp < 1) return unwrapNear(pitch, 0);
    return unwrapNear(pitch, Math.atan2(-vxN / sp, -vzN / sp));
  };
  const noseFor = (tt, vxN, vzN) => {
    const sp = Math.hypot(vxN, vzN);
    if (mode === 'liftoff') return 0;
    if (mode === 'ascent') {
      if (tt < P.tKick + P.kickDur) return ((tt - P.tKick) / P.kickDur) * P.kickDeg * DEG;   // the pitch kick
      const prograde = sp > 1 ? Math.atan2(vxN / sp, vzN / sp) : pitch;
      // gravity turn: nose on velocity, floored at the kick (until v catches up) and capped by
      // the guard (so a flat profile can't run away into a dive before MECO).
      return unwrapNear(pitch, Math.min(Math.max(prograde, P.kickDeg * DEG), P.maxAscentPitchDeg * DEG));
    }
    if (mode === 'separation') return pitch;   // hold through sep
    if (mode === 'flip') {
      const f = Math.min(1, (tt - tSep - P.sepDelay) / P.flipDur);
      const target = P.boostback ? -90 * DEG : retroPitch(vxN, vzN);
      return pitchAtMeco + (unwrapNear(pitchAtMeco, target) - pitchAtMeco) * f;
    }
    if (mode === 'boostback') return unwrapNear(pitch, -90 * DEG);
    if (mode === 'coast' && P.boostback && tBoostEnd != null && t - tBoostEnd < P.reorientDur) {
      const f = (t - tBoostEnd) / P.reorientDur;   // reorient: boostback attitude → retrograde
      const target = retroPitch(vxN, vzN);
      return pitchAtFlipEnd + (unwrapNear(pitchAtFlipEnd, target) - pitchAtFlipEnd) * f;
    }
    return retroPitch(vxN, vzN);   // coast / entry / descent / landing: tail into the wind
  };

  // engines + throttle for the current mode (the scripted control inputs)
  const burnFor = (q, m, atm) => {
    if (mode === 'liftoff' || mode === 'ascent') {
      // the throttle bucket around Max-Q, then the acceleration cap as the stage lightens:
      // throttle so thrust/m never exceeds aMaxG·g₀ (floored at the engine's real minimum).
      const maxNow = thrustAt(s1, atm.p, s1.nEngines, 1).thrust;
      const gCap = Math.min(1, (m * P.aMaxG * G0) / Math.max(1, maxNow));
      const throttle = Math.max(s1.minThrottle, Math.min(q > P.qBucket ? P.bucketThrottle : 1, gCap));
      return { n: s1.nEngines, throttle };
    }
    if (mode === 'boostback') return { n: P.boostbackEngines, throttle: 1 };
    if (mode === 'entry') return { n: P.entryEngines, throttle: 1 };
    if (mode === 'landing' && !landCut) {
      // the hoverslam law: command the constant deceleration that zeroes v exactly at the pad,
      // minus what drag already provides; floor at the engine's real minimum throttle.
      const sp = Math.hypot(vx, vz);
      const need = m * ((sp * sp) / (2 * Math.max(1, z)) + gravityAt(z)) - (dragOn ? 0.5 * atm.rho * sp * sp * s1.cdDescent * A : 0);
      const perMax = thrustAt(s1, atm.p, 1, 1).thrust;
      return { n: P.landEngines, throttle: Math.max(s1.minThrottle, Math.min(1, need / Math.max(1, perMax * P.landEngines))) };
    }
    return { n: 0, throttle: 0 };
  };

  // instantaneous derivatives at a trial state (thrust/attitude/drag frozen per step — they
  // vary on mission timescales, not integrator timescales)
  const deriv = (st, thrust, pitchNow, cdNow, aRef) => {
    const g = gravityAt(st.z);
    const sp = Math.hypot(st.vx, st.vz);
    const atmH = atmosphere(st.z);
    let ax = thrust.ax, az = thrust.az - g;
    if (dragOn && sp > 1e-6) {
      const kD = 0.5 * atmH.rho * cdNow * aRef * sp / st.m;
      ax -= kD * st.vx; az -= kD * st.vz;
    }
    return { dx: st.vx, dz: st.vz, dvx: ax, dvz: az, dm: thrust.mdot };
  };

  const stackPhase = () => mode === 'liftoff' || mode === 'ascent';

  while (t < maxT) {
    const atm = atmosphere(z);
    const sp = Math.hypot(vx, vz);
    const q = 0.5 * atm.rho * sp * sp;
    const mach = sp / atm.a;
    const m = (stackPhase() ? upperMass : 0) + s1.dry + prop;

    // mode transitions (scripted events, threshold-triggered)
    if (mode === 'liftoff' && t >= P.tKick) mode = 'ascent';
    if (mode === 'ascent' && prop <= reserve) {
      mode = 'separation'; tMeco = t; pitchAtMeco = pitch;
      events.meco = { t, v: sp, alt: z, x, propLeft: prop };
    }
    if (mode === 'separation' && t >= tMeco + P.sepDelay) {
      mode = 'flip'; tSep = tMeco;   // flip timer keys off sep (= MECO + sepDelay start)
      events.sep = { t, alt: z, x, vx, vz };
    }
    if (mode === 'flip' && t >= tMeco + P.sepDelay + P.flipDur) {
      tFlipEnd = t; pitchAtFlipEnd = pitch;
      if (P.boostback) { mode = 'boostback'; events.boostbackStart = { t, vx }; }
      else { mode = 'coast'; }
    }
    if (mode === 'boostback' && vx <= vxReturn) {
      mode = 'coast'; tBoostEnd = t; pitchAtFlipEnd = pitch;
      events.boostbackEnd = { t, vx, alt: z, x };
    }
    if ((mode === 'coast') && vz < 0 && z <= P.entryAlt) {
      mode = 'entry'; events.entryStart = { t, alt: z, v: sp };
    }
    if (mode === 'entry' && entryDvLeft <= 0) {
      mode = 'descent'; events.entryEnd = { t, alt: z, v: sp };
    }
    if (mode === 'descent' && z <= P.landIgnMaxAlt) {
      // hoverslam ignition: the altitude the remaining speed needs at max landing-engine
      // authority. Gated LOW — up high this condition is trivially true (the burn could
      // never stop it), but drag is still doing the braking; the burn is the last word.
      const perMax = thrustAt(s1, atm.p, 1, 1).thrust;
      const aNet = (perMax * P.landEngines) / m - gravityAt(z);
      if (aNet > 0 && z <= P.landMargin * (sp * sp) / (2 * aNet)) {
        mode = 'landing'; events.landingIgnition = { t, alt: z, v: sp };
      }
    }
    if (mode === 'landing' && !landCut && vz > -0.5 && z > 2) landCut = true;   // hoverslam over-deceleration: cut, drop the last bit

    // control inputs for this step
    const burn = prop > 0 ? burnFor(q, m, atm) : { n: 0, throttle: 0 };
    const { thrust: Tmag, isp } = burn.n > 0 ? thrustAt(s1, atm.p, burn.n, burn.throttle) : { thrust: 0, isp: s1.ispVac };
    pitch = noseFor(t, vx, vz);
    const thrustVec = {
      ax: (Tmag / m) * Math.sin(pitch),
      az: (Tmag / m) * Math.cos(pitch),
      mdot: -Tmag / (isp * G0),
    };
    const cdNow = stackPhase() ? ascentCd(mach, vehicle.aeroAscent) : s1.cdDescent;
    const dragMag = dragOn ? 0.5 * atm.rho * sp * sp * cdNow * A : 0;

    if (step % recordEvery === 0) {
      samples.push({ t, x, z, vx, vz, m, pitch, thrust: Tmag, throttle: burn.throttle, engines: burn.n, isp, q, mach, rho: atm.rho, drag: dragMag, prop, phase: mode });
    }
    if (stackPhase() && q > maxQ.q) maxQ = { t, q, alt: z };            // the ascent Max-Q callout
    if (!stackPhase() && q > entryPeakQ.q) entryPeakQ = { t, q, alt: z };   // the re-entry heating peak
    if (z > apogee.alt) apogee = { t, alt: z };

    // touchdown: z crosses the ground going down (post-ascent) — interpolate the crossing
    if (!stackPhase() && z <= 0 && vz <= 0 && t > 30) {
      events.touchdown = { t, v: Math.hypot(vx, vz), x, propLeft: prop };
      samples.push({ t, x, z: 0, vx, vz, m, pitch, thrust: 0, throttle: 0, engines: 0, isp, q, mach, rho: atm.rho, drag: 0, prop, phase: 'down' });
      break;
    }

    // RK4 step of [x, z, vx, vz, m] with the step's control frozen
    const st0 = { x, z, vx, vz, m };
    const k1 = deriv(st0, thrustVec, pitch, cdNow, A);
    const mid1 = { x: x + k1.dx * dt / 2, z: z + k1.dz * dt / 2, vx: vx + k1.dvx * dt / 2, vz: vz + k1.dvz * dt / 2, m: m + k1.dm * dt / 2 };
    const k2 = deriv(mid1, thrustVec, pitch, cdNow, A);
    const mid2 = { x: x + k2.dx * dt / 2, z: z + k2.dz * dt / 2, vx: vx + k2.dvx * dt / 2, vz: vz + k2.dvz * dt / 2, m: m + k2.dm * dt / 2 };
    const k3 = deriv(mid2, thrustVec, pitch, cdNow, A);
    const end = { x: x + k3.dx * dt, z: z + k3.dz * dt, vx: vx + k3.dvx * dt, vz: vz + k3.dvz * dt, m: m + k3.dm * dt };
    const k4 = deriv(end, thrustVec, pitch, cdNow, A);
    x += (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx) / 6 * dt;
    z += (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz) / 6 * dt;
    vx += (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx) / 6 * dt;
    vz += (k1.dvz + 2 * k2.dvz + 2 * k3.dvz + k4.dvz) / 6 * dt;
    prop = Math.max(0, prop + (k1.dm + 2 * k2.dm + 2 * k3.dm + k4.dm) / 6 * dt);
    if (mode === 'entry') entryDvLeft -= (Tmag / m) * dt;
    if (z < 0 && stackPhase()) z = 0;   // pad clamp before liftoff clears
    t += dt; step++;
  }

  events.maxQ = maxQ; events.entryPeakQ = entryPeakQ; events.apogee = apogee;

  // stage 2 continuation (for the view's second mover): from the sep state, prograde MVac
  // burn in near-vacuum for 120 s — enough to draw it pulling away toward orbit.
  const stage2Samples = [];
  if (events.sep) {
    let m2 = upperMass, x2 = events.sep.x, z2 = events.sep.alt, vx2 = events.sep.vx, vz2 = events.sep.vz;
    const dt2 = 0.2;
    for (let t2 = events.sep.t; t2 <= events.sep.t + 120; t2 += dt2) {
      const sp2 = Math.hypot(vx2, vz2);
      const p2 = Math.max(0, Math.atan2(vx2 / (sp2 || 1), vz2 / (sp2 || 1)));
      stage2Samples.push({ t: t2, x: x2, z: z2, pitch: p2 });
      const g2 = gravityAt(z2);
      const aT = s2.thrustVac / m2;
      vx2 += (aT * Math.sin(p2)) * dt2;
      vz2 += (aT * Math.cos(p2) - g2) * dt2;
      x2 += vx2 * dt2; z2 += vz2 * dt2;
      m2 = Math.max(s2.dry + vehicle.fairing + payload, m2 - (s2.thrustVac / (s2.ispVac * G0)) * dt2);
    }
  }

  const liftoffM = s1.dry + s1.prop + upperMass;
  return {
    vehicle, profile: profileKey, guidance: P, payload,
    samples, stage2Samples, events,
    summary: {
      liftoffMass: liftoffM,
      liftoffTWR: vehicle.stage1.thrustSL / (liftoffM * G0),
      maxQ, apogee,
      meco: events.meco || null,
      touchdown: events.touchdown || null,
      T: samples.length ? samples[samples.length - 1].t : 0,
    },
  };
}
