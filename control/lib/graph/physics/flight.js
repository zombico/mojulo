/**
 * flight — the spin-aware ballistic primitive (integration/0818/ball-flight.plan.md, F0).
 * Promoted from vehicles/ball-flight.js: physically faithful trajectory of a struck ball.
 *
 * Three forces, with the coefficients that actually vary in reality:
 *   gravity · drag with a speed-dependent C_d (the DRAG CRISIS) · Magnus lift with a
 *   spin-ratio-dependent C_l. That speed/spin dependence is the line between a parabola
 *   that "looks physics-y" and a flight faithful to a real strike (carry, dip, curl, the
 *   late knuckle-drop). Constants follow the soccer-ball aerodynamics literature
 *   (Goff & Carré; Asai), not invented numbers.
 *
 * Pure & deterministic: launch conditions in → trajectory out. No persistent state, no
 * runtime authority — a re-bakeable readout. The ~40-byte LAUNCH SPEC is the recipe atom;
 * consumers store the launch, never the samples, and re-integrate identically anywhere.
 *
 * The registry is CLOSED vocabulary: a NAMED projectile ships with cited C_d/C_l curves
 * and its own test band (soccer: Goff & Carré free-kick band in flight.test.js) or it
 * doesn't ship. Beside the presets, a CUSTOM SPHERE spec ({ mass | density, radius |
 * diameter | circumference, aero? }) is the operator's own explicit dial — same sphere
 * model, the operator owns the constants. The model is sphere-only: a non-sphere (rugby
 * ball, shuttlecock, discus) has categorically different aerodynamics, so "shape" enters
 * only through the aero constants, never a geometry parameter.
 *
 * Zero imports on purpose: page emitters may inline this source (exports stripped) so
 * browser-side consumers run byte-for-byte the physics the server tests validate.
 *
 * Frame: z-up, metres, SI. Default travel is +x.
 */

export const G = 9.81;                 // m/s²
export const RHO_SEA_LEVEL = 1.225;    // kg/m³ (air, 15 °C) — a fidelity dial (altitude)
export const BALL = (() => {
  const mass = 0.43;                   // kg (FIFA size-5)
  const circumference = 0.69;          // m  (FIFA size-5)
  const radius = circumference / (2 * Math.PI);   // ≈ 0.1098 m
  return { mass, circumference, radius, area: Math.PI * radius * radius, diameter: 2 * radius };
})();
const NU_AIR = 1.48e-5;                // kinematic viscosity of air, m²/s (for Re)

// The projectile registry. `aero` are that ball's C_d/C_l curve constants — the defaults
// dragCoeff/liftCoeff fall back to are soccer's, so kickBall without a registry entry keeps
// its historical behaviour. Other sports enter only with literature-cited curves + tests.
export const PROJECTILES = {
  soccer: {
    label: 'soccer ball (FIFA size 5)',
    ...BALL,
    aero: { cdSup: 0.18, cdSub: 0.50, vCrit: 12.5, vWidth: 1.3, clMax: 0.25, s0: 0.25 },
  },
};

export const rps = (revsPerSec) => revsPerSec * 2 * Math.PI;   // rev/s → rad/s helper

/**
 * Resolve a projectile spec — a registry KEY ('soccer') or a CUSTOM SPHERE object — into
 * the full { mass, radius, area, diameter, circumference, aero } the integrator needs.
 * Custom spheres compose over the soccer baseline: size from radius | diameter |
 * circumference (else soccer's), mass from mass | density (ρ → m = ρ·⁴⁄₃πr³, else
 * soccer's), aero constants merged over soccer's. Everything must come out positive
 * and finite — a ball that doesn't exist refuses rather than integrating nonsense.
 */
export function resolveProjectile(spec = 'soccer') {
  if (typeof spec === 'string') {
    const p = PROJECTILES[spec];
    if (!p) throw new Error(`resolveProjectile: unknown projectile '${spec}' — registry: ${Object.keys(PROJECTILES).join(', ')}; or pass a custom sphere { mass|density, radius|diameter|circumference }`);
    return { key: spec, ...p };
  }
  if (!spec || typeof spec !== 'object') throw new Error('resolveProjectile: pass a registry key or a custom sphere spec object');
  const base = PROJECTILES.soccer;
  const radius = spec.radius ?? (spec.diameter != null ? spec.diameter / 2
    : spec.circumference != null ? spec.circumference / (2 * Math.PI) : base.radius);
  const mass = spec.mass ?? (spec.density != null ? spec.density * (4 / 3) * Math.PI * radius ** 3 : base.mass);
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(mass) || mass <= 0) {
    throw new Error(`resolveProjectile: custom sphere needs positive finite size and mass (got radius ${radius}, mass ${mass})`);
  }
  return {
    key: 'custom', label: spec.label ?? 'custom sphere',
    mass, radius, diameter: 2 * radius, circumference: 2 * Math.PI * radius,
    area: Math.PI * radius * radius,
    aero: { ...base.aero, ...(spec.aero && typeof spec.aero === 'object' ? spec.aero : {}) },
  };
}

// --- coefficients -----------------------------------------------------------------

// Drag coefficient with the crisis: a logistic from the SUBcritical (slow, laminar
// boundary layer, high drag) plateau down to the SUPERcritical (fast, turbulent, low
// drag) plateau. At launch a hard strike sits supercritical (~0.18, flies far); as it
// slows past v_crit drag climbs toward ~0.5 → the late deceleration / knuckle-drop.
// crisis:false pins C_d at the supercritical value — the A/B that isolates the effect.
export function dragCoeff(speed, opts = {}) {
  const cdSup = opts.cdSup ?? 0.18, cdSub = opts.cdSub ?? 0.50;
  if (opts.crisis === false) return cdSup;
  const vCrit = opts.vCrit ?? 12.5, vWidth = opts.vWidth ?? 1.3;
  return cdSup + (cdSub - cdSup) / (1 + Math.exp((speed - vCrit) / vWidth));
}

// Lift coefficient as a function of the spin ratio S = r·ω⊥/|v| — rises from 0 and
// SATURATES (doubling spin does not double curl at high spin). Shape after the measured
// soccer-ball lift curves; only the spin component perpendicular to v makes Magnus force.
export function liftCoeff(S, opts = {}) {
  const clMax = opts.clMax ?? 0.25, s0 = opts.s0 ?? 0.25;
  return clMax * (1 - Math.exp(-S / s0));
}

export function reynolds(speed, ball = BALL) { return (speed * ball.diameter) / NU_AIR; }

// Friendly spin dials → an angular-velocity vector, relative to the launch HEADING:
//   curlRev  sidespin rev/s — + curls LEFT of aim (vertical spin axis, heading-free)
//   spinRev  rev/s — + backspin (floats/carries) · − topspin (dips)
// At azimuth 0 this is { x:0, y:−rps(spinRev), z:rps(curlRev) } — the kick-page mapping.
export function spinFromDials({ curlRev = 0, spinRev = 0, azimuthDeg = 0 } = {}) {
  const az = azimuthDeg * Math.PI / 180;
  return { x: rps(spinRev) * Math.sin(az), y: -rps(spinRev) * Math.cos(az), z: rps(curlRev) };
}

// --- dynamics ---------------------------------------------------------------------

const hypot3 = (a) => Math.hypot(a.x, a.y, a.z);

// Acceleration (m/s²) on the ball at velocity v with spin ω, in air of density rho.
function accel(v, omega, rho, opts) {
  const ball = opts.ball ?? BALL;
  const speed = hypot3(v);
  const a = { x: 0, y: 0, z: -G };
  if (speed < 1e-6) return a;
  const m = ball.mass, A = ball.area;

  if (opts.drag !== false) {
    const Cd = dragCoeff(speed, opts);
    const k = (0.5 * rho * A * Cd * speed) / m;   // |F_d| = ½ρA C_d|v|², dir −v̂ → factor·v
    a.x -= k * v.x; a.y -= k * v.y; a.z -= k * v.z;
  }

  if (opts.spin !== false) {
    const cx = omega.y * v.z - omega.z * v.y;     // ω × v
    const cy = omega.z * v.x - omega.x * v.z;
    const cz = omega.x * v.y - omega.y * v.x;
    const cmag = Math.hypot(cx, cy, cz);
    if (cmag > 1e-9) {
      const omegaPerp = cmag / speed;             // |ω×v|/|v| = component of ω ⟂ to v
      const S = (ball.radius * omegaPerp) / speed;
      const Cl = liftCoeff(S, opts);
      const fm = (0.5 * rho * A * Cl * speed * speed) / m;   // |F_m| = ½ρA C_l|v|²
      a.x += fm * cx / cmag; a.y += fm * cy / cmag; a.z += fm * cz / cmag;
    }
  }
  return a;
}

const add = (p, d, h) => ({ x: p.x + d.x * h, y: p.y + d.y * h, z: p.z + d.z * h });

// One RK4 step of {p, v} with ω frozen (spin varies slowly; it's decayed between steps).
function rk4(state, omega, rho, opts, dt) {
  const d = (s) => ({ dp: s.v, dv: accel(s.v, omega, rho, opts) });
  const k1 = d(state);
  const k2 = d({ p: add(state.p, k1.dp, dt / 2), v: add(state.v, k1.dv, dt / 2) });
  const k3 = d({ p: add(state.p, k2.dp, dt / 2), v: add(state.v, k2.dv, dt / 2) });
  const k4 = d({ p: add(state.p, k3.dp, dt), v: add(state.v, k3.dv, dt) });
  const comb = (a, b, c, e) => ({
    x: (a.x + 2 * b.x + 2 * c.x + e.x) / 6,
    y: (a.y + 2 * b.y + 2 * c.y + e.y) / 6,
    z: (a.z + 2 * b.z + 2 * c.z + e.z) / 6,
  });
  return {
    p: add(state.p, comb(k1.dp, k2.dp, k3.dp, k4.dp), dt),
    v: add(state.v, comb(k1.dv, k2.dv, k3.dv, k4.dv), dt),
  };
}

/**
 * Simulate a struck ball's flight.
 *
 * @param {object} launch
 *   speed        launch speed (m/s)   — "force" maps here via impulse/mass (v0 = J/m)
 *   elevationDeg launch angle above the ground plane
 *   azimuthDeg   heading in the ground plane (0 = +x)
 *   spin         {x,y,z} angular velocity (rad/s); use rps() for rev/s. Default none.
 *   velocity     {x,y,z} explicit launch velocity (overrides speed/angles)
 *   position     {x,y,z} launch point (default origin, z = opts.z0 ?? 0)
 * @param {object} [opts]
 *   dt 0.002 · rho RHO_SEA_LEVEL · spinDecay 0.04 /s · groundZ 0 · maxT 15 · ball BALL
 *   drag:false / spin:false / crisis:false to ablate a term · C_d/C_l constants pass through
 * @returns {{ samples: Array, summary: object }}
 */
export function kickBall(launch = {}, opts = {}) {
  const dt = opts.dt ?? 0.002;
  const rho = opts.rho ?? RHO_SEA_LEVEL;
  const groundZ = opts.groundZ ?? 0;
  const maxT = opts.maxT ?? 15;
  const spinDecay = opts.spinDecay ?? 0.04;

  const el = (launch.elevationDeg ?? 0) * Math.PI / 180;
  const az = (launch.azimuthDeg ?? 0) * Math.PI / 180;
  const v0 = launch.speed ?? 0;
  let v = launch.velocity ? { ...launch.velocity } : {
    x: v0 * Math.cos(el) * Math.cos(az),
    y: v0 * Math.cos(el) * Math.sin(az),
    z: v0 * Math.sin(el),
  };
  let p = launch.position ? { ...launch.position } : { x: 0, y: 0, z: opts.z0 ?? 0 };
  let omega = launch.spin ? { ...launch.spin } : { x: 0, y: 0, z: 0 };

  const start = { ...p };
  const samples = [{ t: 0, p: { ...p }, v: { ...v }, omega: { ...omega }, speed: hypot3(v) }];
  let t = 0, apex = p.z, maxSpeed = hypot3(v);

  while (t < maxT) {
    const next = rk4({ p, v }, omega, rho, opts, dt);
    // landing: z crosses the ground going down — interpolate to the exact crossing
    if (next.p.z <= groundZ && p.z > groundZ && next.v.z <= 0) {
      const frac = (p.z - groundZ) / (p.z - next.p.z);
      p = { x: p.x + (next.p.x - p.x) * frac, y: p.y + (next.p.y - p.y) * frac, z: groundZ };
      v = next.v; t += dt * frac;
      samples.push({ t, p: { ...p }, v: { ...v }, omega: { ...omega }, speed: hypot3(v) });
      break;
    }
    p = next.p; v = next.v;
    const decay = Math.exp(-spinDecay * dt);
    omega = { x: omega.x * decay, y: omega.y * decay, z: omega.z * decay };
    t += dt;
    const sp = hypot3(v);
    if (sp > maxSpeed) maxSpeed = sp;
    if (p.z > apex) apex = p.z;
    samples.push({ t, p: { ...p }, v: { ...v }, omega: { ...omega }, speed: sp });
  }

  const land = samples[samples.length - 1];
  // ground-plane unit vectors: along the launch azimuth, and its left-perpendicular
  const ax = Math.cos(az), ay = Math.sin(az);
  const range = (land.p.x - start.x) * ax + (land.p.y - start.y) * ay;   // downrange distance
  const lateralOf = (s) => -(s.p.x - start.x) * ay + (s.p.y - start.y) * ax;   // +left of aim
  let peakLateral = 0;
  for (const s of samples) if (Math.abs(lateralOf(s)) > Math.abs(peakLateral)) peakLateral = lateralOf(s);
  const descentDeg = Math.atan2(-land.v.z, Math.hypot(land.v.x, land.v.y)) * 180 / Math.PI;

  return {
    samples,
    summary: {
      range, apex, flightTime: land.t,
      lateral: lateralOf(land), peakLateral,
      landing: { ...land.p }, landingSpeed: land.speed, descentDeg,
      maxSpeed,
    },
  };
}

/**
 * The registry door — resolve a LAUNCH SPEC against a projectile and integrate. The spec
 * is the storable recipe atom: `{ projectile, speed, elevationDeg, azimuthDeg?, spin? }`
 * where `projectile` is a registry key OR a custom sphere spec (resolveProjectile), and
 * spin is either the friendly dials `{ curlRev, spinRev }` or a raw `{x,y,z}` rad/s
 * vector. The projectile's aero constants become the coefficient-curve defaults
 * (explicit opts still win — the ablation dials keep working).
 * @returns {{ samples, summary, projectile, ball }} — `ball` is the resolved sphere
 * ({ mass, radius, diameter, … }), so consumers can label readouts without re-resolving.
 */
export function flightPath(launch = {}, opts = {}) {
  const proj = resolveProjectile(launch.projectile ?? 'soccer');
  const dials = launch.spin && (launch.spin.curlRev != null || launch.spin.spinRev != null);
  const spin = dials ? spinFromDials({ ...launch.spin, azimuthDeg: launch.azimuthDeg ?? 0 }) : launch.spin;
  const { samples, summary } = kickBall({ ...launch, spin }, { ...proj.aero, ...opts, ball: proj });
  return { samples, summary, projectile: proj.key, ball: proj };
}
