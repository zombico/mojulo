/**
 * motion-vocabulary — the neutral, view-agnostic home for the "rules of motion" shared across the
 * science views (mechanics-view, orbit-view, fluid-view, …). See motion-vocabulary.plan.md.
 *
 * Dependency rule (settled): views import FROM here; this module imports from no view. It is pure — no
 * rendering, no three.js, no DB. Same inputs → byte-identical outputs.
 *
 * This first slice carries the primitives that were genuinely shared (copied verbatim) across views:
 *   • small math + vec helpers (were duplicated in mechanics-view.js and orbit-view.js),
 *   • the finite-difference kinematics extractor `deriveKinematics`,
 *   • the force-channel palette (the shared colours for the per-sample free-body diagram).
 * The per-scenario rule objects (keplerSweep, ballisticArc, springSHM, …) land in later slices, once
 * the move is proven snapshot-clean. Note: orbit-view computes its speed/accel from physics (vis-viva)
 * and a centripetal `avec`, NOT from `deriveKinematics` — they are deliberately different, so orbit
 * shares only the math/vec helpers here, not the kinematics extractor.
 */

// ── math + vec helpers (were duplicated in mechanics-view.js / orbit-view.js) ──
export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;
export const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ── per-sample kinematics, finite-differenced from an equal-dt polyline. velocity = forward difference
// (direction + |Δ|/dt = m/s); acceleration = central second difference ((b − 2a + p)/dt² = m/s²).
// Endpoints copy their neighbour to avoid the one-sided spike. Because the polyline is sampled at equal
// TIME steps, the spacing of the samples already encodes the speed — so the same path yields honest
// m/s and m/s² with no time-warp logic in the renderer. ──
export function deriveKinematics(path, dt) {
  const N = path.length;
  const vdir = [], speed = [], avec = [], accel = [];
  for (let i = 0; i < N; i++) {
    const a = path[i], b = path[Math.min(N - 1, i + 1)], p = path[Math.max(0, i - 1)];
    const vd = i === N - 1 ? sub(a, p) : sub(b, a);
    speed.push(len(vd) / dt);
    vdir.push(norm(vd));
    const av = scl(add(sub(b, a), sub(p, a)), 1 / (dt * dt));   // (b − 2a + p)/dt²
    avec.push(av); accel.push(len(av));
  }
  if (N > 2) { avec[0] = avec[1]; accel[0] = accel[1]; avec[N - 1] = avec[N - 2]; accel[N - 1] = accel[N - 2]; }
  return { vdir, speed, avec, accel, maxSpeed: Math.max(...speed, 1e-6), maxAccel: Math.max(...accel, 1e-6) };
}

// ── force-channel palette: the shared colours for the per-sample free-body diagram (real force vectors
// in newtons — direction + magnitude both meaningful). three.js ints. `repVec` lays a constant force
// over a path of `n` samples; `weightChannel` is the gravity force (mg, down −z) every grounded
// scenario carries. ──
export const F_WEIGHT = 0xe05a5a, F_NORMAL = 0x46c8e0, F_FRICTION = 0xb074ff, F_TENSION = 0xf4c542, F_SPRING = 0x5fd0c0;

// the mechanics scenarios sample their trajectory at this resolution (equal-dt). `repVec` / `weightChannel`
// default to it so the rule bodies below read cleanly; pass an explicit `n` to reuse them elsewhere.
export const MECHANICS_SAMPLES = 140;
const N_SAMPLES = MECHANICS_SAMPLES;
export const repVec = (v, n = MECHANICS_SAMPLES) => Array.from({ length: n }, () => v.slice());
export const weightChannel = (m, g, n = MECHANICS_SAMPLES) => ({ label: 'weight (mg)', color: F_WEIGHT, vecs: repVec([0, 0, -m * g], n) });

// ── the mechanics scenarios — the Newtonian "rules of motion". Each (P) → an equal-dt trajectory in
// METRES (= world units) + the real flight time T + the popup facts + per-sample force channels (real
// newtons). Pure + deterministic (no Math.random, no rendering). Relocated verbatim from mechanics-view
// (the prototype that formalised them) so every view reaches the same force laws. ──
export const MECHANICS_RULES = {
  // a projectile launched from the ground: the parabolic arc. vx constant, vz accelerating (−g).
  projectile(P) {
    const g = P.g, m = clampNum(P.mass, 0.1, 100, 1), v0 = clampNum(P.v0, 1, 80, 18), th = clampNum(P.angle, 5, 85, 55) * DEG;
    const vx = v0 * Math.cos(th), vz = v0 * Math.sin(th);
    const T = (2 * vz) / g, dt = T / (N_SAMPLES - 1);
    const path = Array.from({ length: N_SAMPLES }, (_, i) => { const t = i * dt; return [vx * t, 0, Math.max(0, vz * t - 0.5 * g * t * t)]; });
    return { path, T, loop: false, label: 'Projectile',
      facts: [['v₀', `${v0} m/s`], ['angle', `${Math.round(th / DEG)}°`], ['range', `${(vx * T).toFixed(1)} m`], ['apex', `${(vz * vz / (2 * g)).toFixed(1)} m`]],
      forceChannels: [weightChannel(m, g)] };   // in flight gravity is the only force — the arc is mg alone
  },
  // a body dropped from rest at `height`: constant downward acceleration a = g.
  'free-fall'(P) {
    const g = P.g, m = clampNum(P.mass, 0.1, 100, 1), H = clampNum(P.height, 2, 120, 20);
    const T = Math.sqrt((2 * H) / g), dt = T / (N_SAMPLES - 1);
    const path = Array.from({ length: N_SAMPLES }, (_, i) => { const t = i * dt; return [0, 0, Math.max(0, H - 0.5 * g * t * t)]; });
    return { path, T, loop: false, label: 'Free fall',
      facts: [['drop', `${H} m`], ['a', `${g} m/s² (down)`], ['t_fall', `${T.toFixed(2)} s`], ['v_impact', `${(g * T).toFixed(1)} m/s`]],
      forceChannels: [weightChannel(m, g)] };
  },
  // a ball released down a ramp of angle α with friction μ: a = g(sinα − μcosα), constant.
  'inclined-plane'(P) {
    const g = P.g, m = clampNum(P.mass, 0.1, 100, 1), al = clampNum(P.angle, 5, 75, 30) * DEG, Lr = clampNum(P.length, 4, 60, 20), mu = clampNum(P.mu, 0, 1.5, 0.1);
    const top = [-Lr * Math.cos(al), 0, Lr * Math.sin(al)];
    const slope = norm([Math.cos(al), 0, -Math.sin(al)]);   // down-the-ramp unit
    const up = [Math.sin(al), 0, Math.cos(al)];             // ramp surface normal (so the ball rests ON it)
    const rest = clampNum(P._restOffset, 0, 4, 0.7);
    const restPos = add(top, scl(up, rest));
    const ramp = { top, bottomCorner: [top[0], 0, 0], origin: [0, 0, 0], depth: Math.max(2, Lr * 0.18) };
    const Nf = m * g * Math.cos(al);                        // normal force magnitude, mg·cosα
    const normalCh = { label: 'normal (N)', color: F_NORMAL, vecs: repVec(scl(up, Nf)) };
    // a = g(sinα − μcosα). When tanα ≤ μ, static friction wins and the body NEVER slides — show that
    // honestly (a body at rest + a "static" readout) instead of clamping a to a crawl that fakes motion.
    const aRaw = g * (Math.sin(al) - mu * Math.cos(al));
    if (aRaw <= 0) {
      const path = Array.from({ length: N_SAMPLES }, () => restPos.slice());
      // static: friction rises to exactly cancel the down-slope pull (mg·sinα), so ΣF = 0 — equilibrium.
      const frictionStatic = { label: 'friction (μₛN)', color: F_FRICTION, vecs: repVec(scl(slope, -m * g * Math.sin(al))) };
      return { path, T: 3, loop: false, hold: 0, static: true, label: 'Inclined plane (static)',
        facts: [['angle', `${Math.round(al / DEG)}°`], ['μ', `${mu}`], ['state', 'static — μₛ holds'],
          ['why', `tanθ = ${Math.tan(al).toFixed(2)} ≤ μ`], ['a', '0 (no motion)']], ramp,
        forceChannels: [weightChannel(m, g), normalCh, frictionStatic] };
    }
    const a = aRaw, T = Math.sqrt((2 * Lr) / a), dt = T / (N_SAMPLES - 1);
    const path = Array.from({ length: N_SAMPLES }, (_, i) => { const t = i * dt; const s = 0.5 * a * t * t; return add(restPos, scl(slope, s)); });
    // kinetic friction opposes the (down-slope) motion → points up-slope, magnitude μN. Weight + normal +
    // friction sum to ma down the slope — the orange accel arrow is exactly that resultant.
    const frictionKin = { label: 'friction (μN)', color: F_FRICTION, vecs: repVec(scl(slope, -mu * Nf)) };
    return { path, T, loop: false, label: 'Inclined plane',
      facts: [['angle', `${Math.round(al / DEG)}°`], ['μ', `${mu}`], ['a', `${a.toFixed(2)} m/s²`], ['length', `${Lr} m`]], ramp,
      forceChannels: [weightChannel(m, g), normalCh, frictionKin] };
  },
  // a pendulum bob released from θ0, integrated HONESTLY (nonlinear, RK4) so the large-angle swing
  // slows correctly — the very thing the equal-dt sampling exists to reveal. Periodic → loops.
  pendulum(P) {
    const g = P.g, m = clampNum(P.mass, 0.1, 100, 1), L = clampNum(P.length, 2, 40, 12), th0 = clampNum(P.angle, 5, 80, 35) * DEG;
    const f = (th, w) => [w, -(g / L) * Math.sin(th)];
    const rk4 = (th, w, h) => {
      const [a1, b1] = f(th, w);
      const [a2, b2] = f(th + 0.5 * h * a1, w + 0.5 * h * b1);
      const [a3, b3] = f(th + 0.5 * h * a2, w + 0.5 * h * b2);
      const [a4, b4] = f(th + h * a3, w + h * b3);
      return [th + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4), w + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4)];
    };
    // quarter period: from rest at θ0, fine-step until the bob crosses θ = 0.
    let th = th0, w = 0, tq = 0; const hf = 0.0004;
    while (th > 0 && tq < 60) { [th, w] = rk4(th, w, hf); tq += hf; }
    const T = 4 * tq, dt = T / (N_SAMPLES - 1);
    const pivot = [0, 0, L];
    const bob = (ang) => [L * Math.sin(ang), 0, L - L * Math.cos(ang)];
    // re-integrate over the full period at the sample step, recording the bob position + (θ, ω) each step.
    const path = [], tension = []; let a = th0, v = 0;
    for (let i = 0; i < N_SAMPLES; i++) {
      const bp = bob(a); path.push(bp);
      // string tension = m(g·cosθ + ω²L) (gravity component along the string + centripetal term); it
      // points from the bob toward the pivot. Largest at the bottom (fast), least at the turning points.
      const mag = m * (g * Math.cos(a) + v * v * L);
      tension.push(scl(norm(sub(pivot, bp)), mag));
      [a, v] = rk4(a, v, dt);
    }
    return { path, T, loop: true, hold: 0, label: 'Pendulum', tether: pivot,
      pivot, bobR: Math.max(0.3, L * 0.05),
      facts: [['length', `${L} m`], ['θ₀', `${Math.round(th0 / DEG)}°`], ['period', `${T.toFixed(2)} s`], ['small-∠ T', `${(2 * Math.PI * Math.sqrt(L / g)).toFixed(2)} s`]],
      forceChannels: [weightChannel(m, g), { label: 'tension (T)', color: F_TENSION, vecs: tension }] };
  },
  // a mass on a horizontal spring: F = −kx (Hooke), simple harmonic motion x = A·cos(ωt), ω = √(k/m).
  // The LINEAR sibling of the pendulum — restoring force ∝ displacement, so the period is amplitude-
  // independent (unlike the pendulum). Energy trades between KE and elastic PE = ½kx² (peArray below).
  spring(P) {
    const m = clampNum(P.mass, 0.1, 100, 1), k = clampNum(P.k, 0.5, 400, 12), A = clampNum(P.amplitude, 1, 30, 6);
    const w = Math.sqrt(k / m), T = (2 * Math.PI) / w, dt = T / (N_SAMPLES - 1);
    const zc = Math.max(2, A * 0.5);                 // ride an elevated rail so the body isn't in the floor
    // analytic energy (KE = ½kA²sin², elastic PE = ½kA²cos²) so the total reads EXACTLY flat — the
    // finite-difference KE the other scenarios use ripples ~4% for SHM (a sampling artifact, not physics).
    const path = [], pe = [], ke = [], fvec = [];
    for (let i = 0; i < N_SAMPLES; i++) {
      const ph = w * i * dt, x = A * Math.cos(ph);
      path.push([x, 0, zc]); pe.push(0.5 * k * x * x); ke.push(0.5 * k * A * A * Math.sin(ph) * Math.sin(ph));
      fvec.push([-k * x, 0, 0]);                     // restoring force F = −kx
    }
    const anchor = [-(A + 1.6), 0, zc];              // wall mount on the left; the tether line reads as the spring
    return { path, T, loop: true, hold: 0, label: 'Spring (SHM)', tether: anchor, pivot: anchor, peArray: pe, keArray: ke,
      facts: [['k', `${k} N/m`], ['m', `${m} kg`], ['amplitude', `${A} m`], ['period', `${T.toFixed(2)} s`]],
      forceChannels: [{ label: 'spring (−kx)', color: F_SPRING, vecs: fvec }] };
  },
  // uniform circular motion: a body tracing a circle of radius R at CONSTANT speed v. The whole point is
  // that acceleration ≠ speeding up — the (centripetal) acceleration v²/R points to the centre the whole
  // way round even though |v| never changes. Idealised (motor-driven turntable), so no gravity/energy.
  circular(P) {
    const m = clampNum(P.mass, 0.1, 100, 1), R = clampNum(P.radius, 2, 40, 10), v = clampNum(P.v0, 1, 60, 12);
    const w = v / R, T = (2 * Math.PI) / w, dt = T / (N_SAMPLES - 1);
    const C = [0, 0, R];                              // centre; the circle's bottom touches the ground at z=0
    const path = [], fvec = [];
    for (let i = 0; i < N_SAMPLES; i++) {
      const th = w * i * dt, p = [R * Math.sin(th), 0, R - R * Math.cos(th)];
      path.push(p); fvec.push(scl(norm(sub(C, p)), m * v * v / R));   // centripetal net force, always inward
    }
    return { path, T, loop: true, hold: 0, noEnergy: true, label: 'Circular motion', tether: C, pivot: C, bobR: Math.max(0.3, R * 0.06),
      facts: [['radius', `${R} m`], ['speed', `${v} m/s`], ['period', `${T.toFixed(2)} s`], ['a_c', `${(v * v / R).toFixed(1)} m/s² (inward)`]],
      forceChannels: [{ label: 'centripetal mv²/R', color: F_TENSION, vecs: fvec }] };
  },
};

// ── simple machines (quasi-static): an EFFORT applied over a distance dIn moves a LOAD through a
// (usually smaller) distance dOut with a (usually larger) force. The headline is mechanical advantage
// MA = dIn/dOut = loadForce/effortForce and the conservation of WORK: a machine multiplies force, NEVER
// work — W_in = W_out (ideal); W_in = W_out + W_friction (real, efficiency η<1). Unlike the dynamics
// rules above, each (P) → a TWO-PATH quasi-static spec (the load's real motion + an optional effort
// marker) plus PRECOMPUTED cumulative work arrays the renderer only reads. Pure + deterministic; the
// machine structure (beam / ramp / pulley / threads) is static set-dressing the planner draws, since
// the mover engine only translates — nothing here rotates. dOut is always the VERTICAL height the load
// gains (so W_out = loadForce·dOut is the useful work); dIn is the distance the effort travels. ──
export const MACHINE_SAMPLES = 96;
const M_SAMPLES = MACHINE_SAMPLES;
const lerpPath = (from, to, n = M_SAMPLES) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1);
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
});
// rotate a point about the VERTICAL (y) axis through `c` by angle `a` — matches three.js makeRotationY,
// so a marker on a `turn` mover's group and a marker placed by this helper stay glued together.
const rotY = (p, c, a) => { const dx = p[0] - c[0], dz = p[2] - c[2], cs = Math.cos(a), sn = Math.sin(a); return [c[0] + dx * cs + dz * sn, p[1], c[2] - dx * sn + dz * cs]; };
const arcPath = (p, c, ang, n = M_SAMPLES) => Array.from({ length: n }, (_, i) => rotY(p, c, ang * (i / (n - 1))));
// cumulative work over a linear stroke: at fraction t of the cycle the effort has moved t·dIn (work
// effortForce·dIn·t) and the load has risen t·dOut (useful work loadForce·dOut·t). The difference is the
// friction loss. Ideal (η=1) → effortForce·dIn = loadForce·dOut, so the in/out bars track exactly equal.
function workArrays(effortForce, dIn, loadForce, dOut, n = M_SAMPLES) {
  const workIn = [], workOut = [], workFriction = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), a = effortForce * dIn * t, b = loadForce * dOut * t;
    workIn.push(a); workOut.push(b); workFriction.push(Math.max(0, a - b));
  }
  return { workIn, workOut, workFriction };
}
// assemble the neutral machine spec from the per-machine geometry + the force/distance budget. effortForce
// follows from MA and efficiency: ideal effort = load/MA, scaled up by 1/η for the real (lossy) machine.
function machineSpec({ label, machine, MA_ideal, loadForce, dIn, dOut, eff, loadPath, effortPath, structure, facts, stages, T = 2.8 }) {
  const effortForce = loadForce / (MA_ideal * eff);
  return {
    kind: 'machine', machine, label, MA_ideal, MA_actual: MA_ideal * eff,
    effortForce, loadForce, dIn, dOut, efficiency: eff,
    loadPath, ...(effortPath ? { effortPath } : {}), ...(stages ? { stages } : {}),
    ...workArrays(effortForce, dIn, loadForce, dOut, loadPath.length),
    structure, facts, T, loop: false, hold: 1.4,
  };
}

export const MACHINE_RULES = {
  // a lever: a beam on a fulcrum. MA = effort arm / load arm. Class 1 (fulcrum between effort and load,
  // e.g. seesaw); class 2 (load between, MA>1, e.g. wheelbarrow); class 3 (effort between, MA<1 — honest
  // sub-unity, e.g. the forearm trading force for speed). The ends move VERTICALLY (the beam is drawn at
  // rest); the effort end travels dIn = a·sinθ, the load end rises dOut = b·sinθ, so dIn/dOut = a/b = MA.
  lever(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 2);
    const a = clampNum(P.armEffort, 1, 40, 8), b = clampNum(P.armLoad, 0.5, 40, 4);
    const cls = [1, 2, 3].includes(+P.leverClass) ? +P.leverClass : 1;
    const eff = clampNum(P.efficiency, 0.2, 1, 1);
    const MA = a / b, loadForce = mLoad * g, TH = 16 * DEG;
    const dOut = b * Math.sin(TH), dIn = a * Math.sin(TH);
    const pz = Math.max(a, b) * Math.sin(TH) + Math.max(a, b) * 0.1 + 1.6;   // beam height keeps the ends above z=0
    const fx = 0, ex = a, lx = cls === 1 ? -b : b;              // class 1 puts the load on the opposite side
    const sense = cls === 1 ? 1 : -1;                           // class 1 dips the effort end; class 2/3 lift it
    const fulcrum = [fx, 0, pz], loadEnd = [lx, 0, pz], effortEnd = [ex, 0, pz];
    // the ends ride the true ARC of the tilting beam (the planner rotates the beam by the same angle), so
    // marker and beam stay glued — not an approximate vertical slide.
    const loadPath = arcPath(loadEnd, fulcrum, sense * TH);
    const effortPath = arcPath(effortEnd, fulcrum, sense * TH);
    const structure = { type: 'lever', fulcrum, loadEnd, effortEnd, theta: TH, sense, cls };
    return machineSpec({ label: `Lever (class ${cls})`, machine: 'lever', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, effortPath, structure,
      facts: [['class', `${cls}`], ['MA', MA.toFixed(2)], ['effort arm', `${a} m`], ['load arm', `${b} m`], ['load', `${mLoad} kg`]] });
  },
  // wheel & axle: a large wheel rigidly fixed to a small axle, sharing an angle φ. MA = Rwheel/raxle. A
  // rope on the wheel rim is pulled dIn = R·φ; the load on the axle rises dOut = r·φ → MA = R/r.
  'wheel-axle'(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 3);
    const R = clampNum(P.rWheel, 1, 30, 6), r = clampNum(P.rAxle, 0.3, 20, 1.5);
    const eff = clampNum(P.efficiency, 0.2, 1, 1);
    const MA = R / r, loadForce = mLoad * g, turn = 0.9;        // radians turned over the cycle
    const dIn = R * turn, dOut = r * turn, cz = dIn + R * 0.4 + 1.5;       // lift the hub so the pulled-down rope clears z=0
    const loadPath = lerpPath([r, 0, cz - 1 - dOut], [r, 0, cz - 1]);      // load rope winds ONTO the axle → rises
    const effortPath = lerpPath([R, 0, cz - 1], [R, 0, cz - 1 - dIn]);     // effort rope unwinds off the rim → pulled down
    const structure = { type: 'wheel-axle', center: [0, 0, cz], R, r, turn, loadAnchor: [r, 0, cz], effortAnchor: [R, 0, cz] };
    return machineSpec({ label: 'Wheel & axle', machine: 'wheel-axle', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, effortPath, structure,
      facts: [['MA', MA.toFixed(2)], ['wheel R', `${R} m`], ['axle r', `${r} m`], ['load', `${mLoad} kg`]] });
  },
  // pulley: fixed (MA=1, only redirects effort), movable (MA=2, the load rides a movable block), or
  // compound/block-and-tackle (MA = number of rope segments supporting the load). The effort end is pulled
  // down dIn = MA·dOut; the load (movable block) rises dOut → MA = dIn/dOut.
  pulley(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 4);
    const type = ['fixed', 'movable', 'compound'].includes(P.pulleyType) ? P.pulleyType : 'movable';
    const ropes = type === 'fixed' ? 1 : type === 'movable' ? 2 : Math.round(clampNum(P.ropes, 2, 6, 4));
    const eff = clampNum(P.efficiency, 0.2, 1, 1);
    const MA = type === 'fixed' ? 1 : ropes, loadForce = mLoad * g;
    const dOut = 2.6, dIn = dOut * MA, topZ = dIn + 5;          // top bar above the longest effort pull
    const blockZ0 = 2;                                          // the movable block / load starts low
    const loadPath = lerpPath([0, 0, blockZ0], [0, 0, blockZ0 + dOut]);
    const effortPath = lerpPath([3, 0, topZ - 1], [3, 0, topZ - 1 - dIn]);
    const structure = { type: 'pulley', topZ, ropes, ptype: type, blockZ0, pr: 0.9, loadAnchor: [0, 0, topZ - 1], effortAnchor: [3, 0, topZ - 1] };
    return machineSpec({ label: `Pulley (${type})`, machine: 'pulley', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, effortPath, structure,
      facts: [['type', type], ['MA', MA.toFixed(2)], ['rope falls', `${ropes}`], ['load', `${mLoad} kg`]] });
  },
  // inclined plane as a MACHINE: rolling the load up a ramp of length L raises it a height h with less
  // force than a straight lift. MA = L/h = 1/sinα. The load travels the REAL slope (dIn = L along the
  // ramp); its USEFUL rise is dOut = h (vertical) → MA = dIn/dOut = L/h.
  incline(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 3);
    const al = clampNum(P.angle, 5, 75, 25) * DEG, L = clampNum(P.length, 4, 60, 18);
    const eff = clampNum(P.efficiency, 0.2, 1, 1);
    const h = L * Math.sin(al), MA = L / h, loadForce = mLoad * g;
    const dIn = L, dOut = h, slopeUp = norm([Math.cos(al), 0, Math.sin(al)]);
    const base = [0, 0, 0.4];
    const loadPath = lerpPath(base, add(base, scl(slopeUp, L)));
    const structure = { type: 'incline', al, L, h };
    return machineSpec({ label: 'Inclined plane', machine: 'incline', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, structure,
      facts: [['MA', MA.toFixed(2)], ['angle', `${Math.round(al / DEG)}°`], ['length', `${L} m`], ['rise', `${h.toFixed(1)} m`]] });
  },
  // wedge: two inclined planes back-to-back driven UNDER/INTO a load. MA = length/thickness. Driving the
  // wedge in dIn = L spreads the load aside dOut = t (the thickness) against its resistance → MA = L/t.
  wedge(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 4);
    const L = clampNum(P.length, 3, 40, 12), t = clampNum(P.thickness, 0.5, 20, 3);
    const eff = clampNum(P.efficiency, 0.2, 1, 1);
    const MA = L / t, loadForce = mLoad * g, dIn = L, dOut = t;
    const cz0 = 0.8, yf = -t * 1.4;                             // load rides just in FRONT of the wedge (−y, toward
    const loadPath = lerpPath([0, yf, cz0], [0, yf, cz0 + t]);  // the camera) so the static wedge doesn't occlude it
    const structure = { type: 'wedge', L, t, cz0 };
    return machineSpec({ label: 'Wedge', machine: 'wedge', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, structure,
      facts: [['MA', MA.toFixed(2)], ['length', `${L} m`], ['thickness', `${t} m`], ['load', `${mLoad} kg`]] });
  },
  // screw: an inclined plane wrapped around a cylinder. MA = circumference/pitch = 2πr/p. One full turn of
  // the handle moves the effort dIn = 2πr while the load advances only one pitch dOut = p → MA = 2πr/p.
  screw(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 5);
    const r = clampNum(P.radius, 0.5, 20, 3), pitch = clampNum(P.pitch, 0.2, 10, 1);
    const eff = clampNum(P.efficiency, 0.2, 1, 1);
    const circ = TAU * r, MA = circ / pitch, loadForce = mLoad * g, turns = 3;
    const dIn = circ * turns, dOut = pitch * turns, axisLen = 9;
    const plateZ0 = axisLen - 1, yf = -r;                                 // the nut rides ON the thread's front (−y)
    const loadPath = lerpPath([0, yf, plateZ0], [0, yf, plateZ0 - dOut]); // and advances DOWN one pitch per turn
    const structure = { type: 'screw', r, pitch, axisLen, turns };
    return machineSpec({ label: 'Screw', machine: 'screw', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, structure,
      facts: [['MA', MA.toFixed(2)], ['radius', `${r} m`], ['pitch', `${pitch} m`], ['load', `${mLoad} kg`]] });
  },

  // ── COMPOUND machines: two or more simple machines in series, where the OUTPUT of one drives the next.
  // The headline is that mechanical advantage MULTIPLIES through the chain (MA = MA₁·MA₂·…) while WORK is
  // still conserved end-to-end. Same machineSpec/work-bars; a `stages` list drives the "MA = a × b" readout. ──

  // gear train (a geared winch): a hand crank turns a small driver gear into a big gear (reduction MA₁),
  // a small gear on that same shaft drives a big output gear (reduction MA₂); the output shaft's drum winds
  // a rope (windlass MA₃ = handle/drum). Meshing gears counter-rotate at ω ∝ 1/r. MA = MA₁·MA₂·MA₃.
  'gear-train'(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 6), eff = clampNum(P.efficiency, 0.2, 1, 1);
    const rD = 2.2, rA = 4.4, rB = 2.2, rC = 4.4, handleR = 3, drumR = 1.2, teeth = 12;
    const s1 = rA / rD, s2 = rC / rB, wl = handleR / drumR, MA = s1 * s2 * wl;
    const loadForce = mLoad * g, dOut = 2.2, dIn = dOut * MA;
    const zc = Math.max(rA, rC) + 2.2, x1 = 0, x2 = x1 + (rD + rA), x3 = x2 + (rB + rC);
    const thD = (dOut / drumR) * s1 * s2;                       // driver turns this far over the cycle
    const gears = [
      { x: x1, z: zc, r: rD, teeth, angle: thD, crank: handleR },                 // driver + crank
      { x: x2, z: zc, r: rA, teeth, angle: -thD * (rD / rA) },                     // big gear (stage 1)
      { x: x2, z: zc, r: rB, teeth, angle: -thD * (rD / rA), shaft: true },        // small gear (compound, same shaft)
      { x: x3, z: zc, r: rC, teeth, angle: thD * (rD / rA) * (rB / rC) },          // output gear (stage 2)
    ];
    const loadX = x3, loadZ0 = zc - rC - 2;
    const loadPath = lerpPath([loadX, -drumR * 1.6, loadZ0], [loadX, -drumR * 1.6, loadZ0 + dOut]);
    const structure = { type: 'gear-train', gears, drum: { x: x3, z: zc, r: drumR }, loadAnchor: [loadX, 0, zc - rC * 0.2] };
    return machineSpec({ label: 'Gear train (winch)', machine: 'gear-train', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, structure, stages: [['gears①', s1], ['gears②', s2], ['windlass', wl]],
      facts: [['MA', MA.toFixed(1)], ['stages', '3'], ['ratio', `${s1}·${s2}·${wl.toFixed(1)}`], ['load', `${mLoad} kg`]] });
  },
  // screw jack: a long lever ARM turns a screw to raise a heavy load — a lever (MA₁ = arm/screw-radius) in
  // series with a screw (MA₂ = 2πr/pitch), so MA = 2π·arm/pitch (huge). The load nut climbs the turning
  // thread while the lever sweeps; tiny effort over a long sweep raises a great weight a little.
  'screw-jack'(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 10), eff = clampNum(P.efficiency, 0.2, 1, 1);
    const r = clampNum(P.radius, 0.5, 8, 1.6), pitch = clampNum(P.pitch, 0.2, 4, 0.8), L = clampNum(P.armEffort, 2, 24, 8);
    const s1 = L / r, s2 = (TAU * r) / pitch, MA = s1 * s2;     // = 2π·L/pitch
    const loadForce = mLoad * g, dOut = 2.0, dIn = dOut * MA, axisLen = 6, turns = dOut / pitch;
    const platZ0 = 1.2, yf = -r;
    const loadPath = lerpPath([0, yf, platZ0], [0, yf, platZ0 + dOut]);   // the load nut climbs the front of the thread
    const structure = { type: 'screw-jack', r, pitch, axisLen, turns, L, leverZ: axisLen, angle: turns * TAU };
    return machineSpec({ label: 'Screw jack', machine: 'screw-jack', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, structure, stages: [['lever', s1], ['screw', s2]],
      facts: [['MA', MA.toFixed(0)], ['arm', `${L} m`], ['pitch', `${pitch} m`], ['load', `${mLoad} kg`]] });
  },
  // crane (block-and-tackle winch): a hand crank (wheel & axle, MA₁ = handle/drum) winds a hoist rope that
  // runs over a fixed pulley down to a MOVABLE pulley block carrying the load (MA₂ = 2). MA = MA₁·2.
  crane(P) {
    const g = P.g, mLoad = clampNum(P.mass, 0.1, 100, 8), eff = clampNum(P.efficiency, 0.2, 1, 1);
    const R = clampNum(P.rWheel, 2, 12, 5), r = clampNum(P.rAxle, 0.4, 6, 1.2), ropes = 2;
    const s1 = R / r, MA = s1 * ropes, loadForce = mLoad * g;
    const dOut = 2.0, dIn = dOut * MA, theta = (2 * dOut) / r;  // crank turns 2·dOut/r as the load rises dOut
    const cz = R + 2, px = 4 + R, topZ = cz + R + 3;            // crank on the left; fixed pulley up-right
    const loadX = px, loadZ0 = 1.5;
    const loadPath = lerpPath([loadX, -1.4, loadZ0], [loadX, -1.4, loadZ0 + dOut]);
    const structure = { type: 'crane', R, r, theta, cz, px, topZ, pr: 1.0,
      crankAnchor: [R, 0, cz], fixedPulley: [px, 0, topZ], loadAnchor: [loadX, 0, topZ] };
    return machineSpec({ label: 'Crane (winch + tackle)', machine: 'crane', MA_ideal: MA, loadForce, dIn, dOut, eff,
      loadPath, structure, stages: [['wheel & axle', s1], ['movable pulley', ropes]],
      facts: [['MA', MA.toFixed(1)], ['wheel R', `${R} m`], ['axle r', `${r} m`], ['load', `${mLoad} kg`]] });
  },
};

// the public list a planner / MCP tool validates machine scenarios against.
export const MACHINE_SCENARIOS = Object.keys(MACHINE_RULES);

// ── ENGINES: reciprocating mechanisms. A traditional steam engine is the canonical SLIDER-CRANK — a
// piston's reciprocating (linear) motion is converted to the crankshaft's rotary motion (and back) through
// a connecting rod, with a heavy flywheel carrying the crank through the dead-centres where the piston
// momentarily stops. Pure kinematics (exact slider-crank), sampled over one revolution and LOOPED. ──
export const ENGINE_SAMPLES = 120;
export const ENGINE_RULES = {
  // a horizontal double-acting steam engine. Crank centre at the flywheel axis; the piston reciprocates
  // along the cylinder axis (a line through the crank centre). Exact slider-crank:
  //   crank pin = O + r(cosθ, sinθ);  piston x = Oₓ + r·cosθ − √(L² − r²sin²θ)   (piston on the −x side).
  // Stroke = 2r. Piston speed → 0 at θ = 0°/180° (the dead-centres) and peaks near mid-stroke.
  'steam-engine'(P) {
    const r = clampNum(P.crankRadius, 0.5, 8, 2);              // crank throw → stroke 2r
    const L = clampNum(P.rodLength, 4, 30, 7.5);               // connecting rod length
    const fR = clampNum(P.flywheelR, r + 1.2, 20, 4.4);        // flywheel radius (> crank throw)
    const rpm = Math.round(clampNum(P.rpm, 20, 600, 60));
    const N = ENGINE_SAMPLES, zc = fR + 1.8, xO = 0;          // crank/flywheel axis height; centre at x=0
    const crankPin = [], pistonPin = [], angle = [];
    for (let i = 0; i < N; i++) {
      const th = TAU * (i / (N - 1));
      angle.push(th);
      crankPin.push([xO + r * Math.cos(th), 0, zc + r * Math.sin(th)]);
      const px = xO + r * Math.cos(th) - Math.sqrt(Math.max(0, L * L - r * r * Math.sin(th) * Math.sin(th)));
      pistonPin.push([px, 0, zc]);
    }
    const period = clampNum(150 / rpm, 1.4, 4.5, 2.6);         // playback seconds/rev (watchable; rpm is the label)
    return {
      kind: 'engine', engine: 'steam', label: 'Steam engine', rpm, stroke: 2 * r,
      crankCenter: [xO, 0, zc], r, L, fR, zc, crankPin, pistonPin, angle, period,
    };
  },
  // a single-cylinder 4-stroke (Otto) engine: the SAME slider-crank, mounted VERTICALLY, but the working
  // cycle spans TWO crank revolutions (720°) — intake ↓, compression ↑, power ↓ (combustion), exhaust ↑ —
  // so a poppet INTAKE valve opens over the 1st stroke and an EXHAUST valve over the 4th, and the spark
  // fires at TDC ending compression. Crank angle φ measured from TDC: piston height = zC + r·cosφ +
  // √(L²−r²sin²φ); crank pin = (xC + r·sinφ, zC + r·cosφ). Pure kinematics, looped over the 720° cycle.
  combustion(P) {
    const r = clampNum(P.crankRadius, 0.5, 8, 2.2), L = clampNum(P.rodLength, 4, 30, 8);
    const fR = clampNum(P.flywheelR, r + 1.2, 20, 4), rpm = Math.round(clampNum(P.rpm, 60, 8000, 1200));
    const N = 160, zC = fR + 1.2, xC = 0, bore = r * 0.92;
    const crankPin = [], pistonPin = [], angle = [], intakeLift = [], exhaustLift = [];
    for (let i = 0; i < N; i++) {
      const ph = 2 * TAU * (i / (N - 1));                      // φ over 0 → 720° (two revolutions)
      angle.push(ph);
      crankPin.push([xC + r * Math.sin(ph), 0, zC + r * Math.cos(ph)]);
      pistonPin.push([xC, 0, zC + r * Math.cos(ph) + Math.sqrt(Math.max(0, L * L - r * r * Math.sin(ph) * Math.sin(ph)))]);
      intakeLift.push(ph < Math.PI ? Math.sin(ph) : 0);                       // open over the intake stroke
      exhaustLift.push(ph >= 3 * Math.PI ? Math.sin(ph - 3 * Math.PI) : 0);   // open over the exhaust stroke
    }
    const period = clampNum(2 * 150 / rpm * 8, 2.0, 5.0, 3.2);  // watchable seconds per FULL 720° cycle
    return {
      kind: 'engine', engine: 'four-stroke', label: '4-stroke engine', rpm, stroke: 2 * r, bore,
      crankCenter: [xC, 0, zC], r, L, fR, zC, crankPin, pistonPin, angle, intakeLift, exhaustLift,
      sparkPhase: 0.5, period,                                  // spark at φ = 360° (½ of the 720° cycle)
    };
  },
  // an INLINE-4 four-stroke: four slider-cranks on ONE crankshaft (rotating about its long axis), crank
  // throws at 0°/180°/180°/0°, firing order 1-3-4-2 — so the four power strokes are evenly spaced every
  // 180° (one per half-revolution) and the engine runs smoothly. Cylinder k's cycle = globalφ + Δ_k, with
  // Δ = [0,180,540,360]° (Δ mod 360 = the geometric throw angle); the throw sweeps in the y-z plane, so
  // the crank pin carries a depth (y) component. Pure kinematics over the 720° cycle, looped.
  'inline-four'(P) {
    const r = clampNum(P.crankRadius, 0.5, 6, 1.8), L = clampNum(P.rodLength, 3, 24, 7);
    const fR = clampNum(P.flywheelR, r + 1, 16, 3.2), rpm = Math.round(clampNum(P.rpm, 60, 9000, 1500));
    const N = 140, zC = fR + 1.2, bore = r * 0.9, spacing = Math.max(2.8 * r, 2 * r + 2.4);
    const deltas = [0, Math.PI, 3 * Math.PI, 2 * Math.PI];        // Δ_k (rad) for cylinders 1..4 → firing 1-3-4-2
    const x0 = -((4 - 1) / 2) * spacing;
    const cylinders = deltas.map((d, k) => ({ x: x0 + k * spacing, delta: d, crankPin: [], pistonPin: [], intakeLift: [], exhaustLift: [],
      sparkU: (((TAU - d) % (2 * TAU)) + 2 * TAU) % (2 * TAU) / (2 * TAU) }));   // power TDC (ψ=360°) → loop fraction
    const angle = [];
    for (let i = 0; i < N; i++) {
      const gphi = 2 * TAU * (i / (N - 1));                      // global crank angle 0 → 720°
      angle.push(gphi);
      for (const c of cylinders) {
        const a = gphi + c.delta;                                // this cylinder's crank angle (geometry is mod 2π)
        c.crankPin.push([c.x, r * Math.sin(a), zC + r * Math.cos(a)]);
        c.pistonPin.push([c.x, 0, zC + r * Math.cos(a) + Math.sqrt(Math.max(0, L * L - r * r * Math.sin(a) * Math.sin(a)))]);
        const ps = (a % (2 * TAU) + 2 * TAU) % (2 * TAU);        // cycle angle mod 720° → strokes/valves
        c.intakeLift.push(ps < Math.PI ? Math.sin(ps) : 0);
        c.exhaustLift.push(ps >= 3 * Math.PI ? Math.sin(ps - 3 * Math.PI) : 0);
      }
    }
    return {
      kind: 'engine', engine: 'inline', label: 'Inline-4 engine', rpm, r, L, fR, zC, bore, spacing,
      cylinders, angle, deltas: deltas.map((d) => Math.round(d / DEG)), order: '1-3-4-2', period: 3.6,
    };
  },
};
export const ENGINE_SCENARIOS = Object.keys(ENGINE_RULES);

// ── the public catalogue of motion rules an operator / MCP tool can name. Currently the Newtonian set;
// other rule families register here as they are promoted into the vocabulary. ──
export const MOTION_RULES = { ...MECHANICS_RULES };

/**
 * placeMover — turn a rule's local (origin-anchored, metre-frame) simulation into a renderer-ready
 * mover positioned anywhere in a HOST world. This is the seam that lets ANY scene generator (not just
 * the science views) animate an object with correct physics: bake a rule, place its path at `at`
 * (scaled by `scale`), and the equal-dt sampling carries the dynamics. Kinematics (vel/accel for the
 * optional arrows) are finite-differenced from the PLACED path, so magnitudes read in host-world units.
 * @param {{path:number[][], T:number, loop?:boolean, hold?:number, tether?:number[], label?:string}} sim
 * @returns a mover object shaped for emitThreeWorld's mover channel.
 */
export function placeMover(sim, opts = {}) {
  const { at = [0, 0, 0], scale = 1, group = 'body', vectors = false, arrowLen = 0, label, period, loop } = opts;
  const place = (p) => [at[0] + p[0] * scale, at[1] + p[1] * scale, at[2] + p[2] * scale];
  const path = sim.path.map(place);
  const dt = sim.T / Math.max(1, path.length - 1);
  const k = deriveKinematics(path, dt);
  return {
    group, path, basePos: path[0],
    vdir: k.vdir, speed: k.speed, avec: k.avec, accel: k.accel, maxSpeed: k.maxSpeed, maxAccel: k.maxAccel,
    period: period != null ? period : Math.max(2.5, Math.min(7, sim.T)),
    loop: loop != null ? loop : !!sim.loop,
    hold: sim.hold != null ? sim.hold : (sim.loop ? 0 : 1.2),
    vectors, arrowLen, label: label || sim.label,
    ...(sim.tether ? { tether: place(sim.tether) } : {}),
  };
}

/**
 * resolveMotionMovers — resolve an operator-supplied `motion` spec (a list of named rules placed into a
 * world) into ready-to-append movers. Each entry: { rule, params?, at?, scale?, group?, vectors?,
 * period?, loop? }. Unknown rule names are skipped (never thrown) so a typo can't break a render. This
 * is what makes "attach motion to any world" a one-call capability for the dispatch seam / an MCP tool.
 */
export function resolveMotionMovers(spec) {
  if (!Array.isArray(spec)) return [];
  const movers = [];
  for (let i = 0; i < spec.length; i++) {
    const m = spec[i] || {};
    const gen = MOTION_RULES[m.rule];
    if (typeof gen !== 'function') continue;   // unknown rule → skip
    const sim = gen({ g: 9.8, ...(m.params && typeof m.params === 'object' ? m.params : {}) });
    movers.push(placeMover(sim, {
      at: Array.isArray(m.at) ? m.at : [0, 0, 0],
      scale: Number.isFinite(+m.scale) ? +m.scale : 1,
      group: typeof m.group === 'string' && m.group ? m.group : `motion${i}`,
      vectors: m.vectors === true,
      period: Number.isFinite(+m.period) ? +m.period : undefined,
      loop: typeof m.loop === 'boolean' ? m.loop : undefined,
    }));
  }
  return movers;
}
