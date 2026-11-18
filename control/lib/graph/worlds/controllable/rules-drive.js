/**
 * rules-drive.js — the `drive` rule: a designed vehicle you can board and DRIVE
 * (vehicle-designer/drivable-vehicles.plan.md, D2). A pure KINEMATIC ground-vehicle controller,
 * sibling of `platform` — a longitudinal-dynamics feel model, NOT a four-wheel rigid body:
 *
 *   • THROTTLE (W): engine force F = min(powerN / max(|v|, vFloor), tractionCap) — the real power
 *     curve F = P/v capped by traction at low speed, so horsepower shapes acceleration falloff
 *     naturally. powerN derives from `horsepower` (× 745.7 W), tractionCap ≈ grip · mass · g.
 *   • BRAKE / REVERSE (S): while moving forward, `brakeForce` opposes motion (momentum vs mass,
 *     explicitly — a heavy truck stops LONG); at a standstill it reverses, capped at
 *     `reverseSpeed`. Arcade-standard S. W while rolling backward brakes the reverse the same way.
 *   • COASTING: quadratic drag (`drag` = the lumped ½ρ·cdA) + constant rolling resistance, so
 *     lifting off decays speed believably (a walker's flat damping reads wrong for a car).
 *   • STEERING (A/D): bicycle model — headingRate = v / wheelbase · tan(steer), with `steer`
 *     slewed toward the input at `steerSpeed` and the max angle TIGHTENED as speed rises
 *     (`steerTighten`), so a long truck genuinely turns wider than a coupe and nobody U-turns at
 *     highway speed. Reversing flips the heading rate for free (the model's sign does it).
 *   • WHEELS: wheelPhase advances by distance / (2π·wheelRadius) — distance-true, no skate; it
 *     doubles as the gaitPhase driving the baked `roll` clip (D1's rig), exactly as ground
 *     distance drives a walker's stride.
 *   • VERTICAL + WALLS: ground-locked v1 (no airborne cars) — z follows the ground probe, cast
 *     from body height (the ai's rising-terrain read), and a ledge is followed DOWN at a clamped
 *     `fallRate`; walls via the shared footprint eject (slide survives, so momentum against a
 *     wall behaves right for free).
 *
 * Rule params (all tuned defaults; real-ish units — kg, hp, meters — per the plan's decision 3):
 * { horsepower, mass, brakeForce?, topSpeed?, wheelbase, wheelRadius, grip?, drag?, rollResist?,
 *   steerMax?, steerSpeed?, steerTighten?, reverseSpeed?, vFloor?, fallRate?, eye?,
 *   collideRadius?, collideHeight?, step? }
 *
 * AFFORDANCE FACTS (D5 — named once, effects bind later): locomotion:'drive', speed (signed u/s),
 * wheelPhase / wheelSpin, steerAngle, throttle (0..1), braking (+ brakeStart edge), skidding
 * (lateral demand > grip; + skidStart edge), boarded (first-driven-frame edge; dismount rides the
 * pilot-swap event). The F key is RESERVED (no-op) per open decision 1.
 *
 * THE `racer` RULE — a driver no one pilots: the same drive, its stick moved by the road ahead. Its `line` is points
 * in order (`closed`: round again after the last); it aims at the point `look` ahead of the one it has reached, set
 * `lane` metres to the line's left, steers into the error and lifts or brakes when the turn ahead is sharp at speed.
 * Stuck (throttling, not moving, a second), it backs off for one. `pace` is how hard it drives (its throttle, 0..1).
 * Every drive param is its own (a rival in the player's car carries the car's rule). With the ai off it coasts.
 * Facts: `lineAt` (the point reached) and `laps` (times it crossed its line's first point, the start line: a car on
 * the grid crosses it once as the race begins; closed lines).
 *
 * THE `chaser` RULE — a driver no one pilots, after a body (`target`, or what it rides): the law's police car. Far off
 * it keeps to the `roads` ([[axis, cross, lo, hi], …], the streets' middle lines), routed over their junctions; near it
 * drives straight at it; beside a target that stands, it holds it, counted every `every` s (`pin` m): its `helds`,
 * `heldBy` this car (the bus's `held:<target>`: a hold, no wound). Facts: `chaseRoute`, `chaseAt`.
 *
 * PHYSICS (opt-in, the vehicle classes' rule: roads/vehicles.js vehicleRule): `drivenShare` (grip through the driven
 * wheels only), `brakeEff` (brakes capped by grip), `lateralGrip` (no tighter than μ g holds), `surfaceGrip` (the
 * world's `surface(pos)` → { mu, roll } scales grip and rolling), `muScale` (the weather), `air` (flight: see fly),
 * `wheels: 2` (a lean). Absent, every one multiplies by 1 or takes the old branch: a ride drives as it did.
 *
 * Pure + deterministic like every rule: reads only the input snapshot + world hooks, writes only
 * its entity — same inputs + dt → byte-identical replay, tests headless in Node
 * (rules-drive.test.js). BUILDER CONTRACT (compose.js): import-free inside the function.
 */

export function buildRulesDrive(E) {
  const { fwdXY, clamp, resolveBlocking, TAU, RULES } = E;

  const G = 9.81;   // real-ish units doctrine: world meters, kg, seconds

  function drive(e, input, dt, world) {
    const r = e.rule;
    const t = e.transform;
    const mass = r.mass > 0 ? r.mass : 1400;
    const powerN = (r.horsepower > 0 ? r.horsepower : 130) * 745.7;
    // SURFACE + CONDITIONS (opt-in, `surfaceGrip` / `muScale`: vehicles.js): the ground under the car and the weather
    // scale its tyres' grip, and the ground its rolling (grass and sand drag); arcade's `surfaceSoft` forgives a share
    const S = r.surfaceGrip && world && world.surface ? world.surface(t.pos) : null;
    const soft = r.surfaceSoft > 0 ? r.surfaceSoft : 1;
    const grip = (r.grip > 0 ? r.grip : 1) * (S ? 1 - (1 - S.mu) * soft : 1) * (r.muScale > 0 ? r.muScale : 1);
    // grip pushes only through the driven wheels (`drivenShare` of the weight); brakes stop no harder than grip lets
    // them (`brakeEff`: ABS, air brakes)
    const tractionCap = grip * mass * G * (r.drivenShare > 0 ? r.drivenShare : 1);
    const brakeForce0 = r.brakeForce > 0 ? r.brakeForce : mass * G * 0.8;
    const brakeForce = r.brakeEff > 0 ? Math.min(brakeForce0, grip * mass * G * r.brakeEff) : brakeForce0;
    const dragK = r.drag ?? 0.42;
    const rollForce = (r.rollResist ?? 0.015) * mass * G * (S ? 1 + (S.roll - 1) * soft : 1);
    const airborne = !!(r.air && e.airborne);
    const wheelbase = r.wheelbase > 0 ? r.wheelbase : 2.8;
    const wheelR = r.wheelRadius > 0 ? r.wheelRadius : 0.33;
    const reverseSpeed = r.reverseSpeed > 0 ? r.reverseSpeed : 6;
    const steerMax = r.steerMax ?? 0.55, steerSpeed = r.steerSpeed ?? 2.5;
    const vFloor = r.vFloor > 0 ? r.vFloor : 2;
    const eye = r.eye ?? 0;
    let v = e.speed || 0;
    // BOOST PADS (opt-in: a track's pads, roads/surface.js padAt, the world's `padAt(pos)` → seconds): a wheel on one
    // lights a boost that long: a push past the engine's while the throttle is held, and a top speed raised by `boostTop`
    // (1.6) while it lasts.
    // A world with no pads has no hook: a drive is as it was
    if (world && world.padAt && !airborne) { const b = world.padAt(t.pos); if (b > 0) e.boostT = Math.max(e.boostT || 0, b); }
    const boostOn = (e.boostT || 0) > 0;
    if (boostOn) e.boostT = Math.max(0, e.boostT - dt);

    // ── longitudinal force: throttle / brake / reverse ──
    const throttle = clamp(input.forward, 0, 1);
    const brakeIn = clamp(-input.forward, 0, 1);
    const engineF = (sign) => sign * Math.min(powerN / Math.max(Math.abs(v), vFloor), tractionCap);
    let F = 0;
    let braking = false;
    if (airborne) { /* nothing touches the road: no drive, no brake */ }
    else if (throttle > 0) {
      if (v >= -1e-3) F = engineF(1) * throttle;                    // drive forward
      else { F = brakeForce * throttle; braking = true; }           // W against reverse motion = brake
    } else if (brakeIn > 0) {
      if (v > 1e-3) { F = -brakeForce * brakeIn; braking = true; }  // brake the forward roll
      else F = engineF(-1) * brakeIn;                               // standstill/rolling back → reverse drive
    }
    const resist = dragK * v * Math.abs(v) + (!airborne && Math.abs(v) > 1e-3 ? rollForce * Math.sign(v) : 0);
    const v0 = v;
    v += ((F - resist) / mass) * dt;
    // resistive forces stop a coasting car — they never reverse it (no throttle → clamp at 0)
    if (F === 0 && v0 !== 0 && Math.sign(v) !== Math.sign(v0)) v = 0;
    if (F === 0 && Math.abs(v) < 0.15) v = 0;                       // rest deadband: a parked car stays parked
    // (a boost pushes on at `boostAccel` m/s² up to the raised top while the throttle is held: lifting for a bend spends it)
    if (boostOn && throttle > 0 && v > -1e-3) { const top = (r.topSpeed > 0 ? r.topSpeed : 30) * (r.boostTop ?? 1.6); if (v < top) v = Math.min(top, v + (r.boostAccel ?? 18) * throttle * dt); }
    v = clamp(v, -reverseSpeed, r.topSpeed > 0 ? r.topSpeed * (boostOn ? (r.boostTop ?? 1.6) : 1) : Infinity);

    // ── steering: slewed bicycle model, tightened with speed ──
    let effMax = steerMax / (1 + Math.abs(v) * (r.steerTighten ?? 0.03));
    // LATERAL GRIP (opt-in): no tighter than the tyres hold at this speed (v² tan δ / wheelbase ≤ μ g): it understeers
    if (r.lateralGrip && Math.abs(v) > 1) effMax = Math.min(effMax, Math.atan((grip * G * wheelbase) / (v * v)));
    const steerTarget = clamp(-input.turn, -1, 1) * effMax;         // A = steer left = heading+ (tank convention)
    e.steerAngle = (e.steerAngle || 0) + clamp(steerTarget - (e.steerAngle || 0), -steerSpeed * dt, steerSpeed * dt);
    if (!airborne) t.heading = (t.heading + (v / wheelbase) * Math.tan(e.steerAngle) * dt) % TAU;

    // ── integrate + walls + ground ──
    const f = fwdXY(t.heading);
    t.pos[0] += f[0] * v * dt;
    t.pos[1] += f[1] * v * dt;
    if (world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 3, r.collideRadius ?? 0, world.colliders, r.step ?? 0.3);
    // ground: cast from body height so rising terrain is seen (the ai's head-height read); climb
    // snaps, a ledge is followed DOWN at the clamped fall rate — no airborne cars in v1.
    const gz = world && world.ground ? world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 3)]) : null;
    if (gz != null && r.air) v = fly(e, gz + eye, v, f, dt, world);
    else if (gz != null) {
      const want = gz + eye;
      if (want < t.pos[2]) t.pos[2] = Math.max(want, t.pos[2] - (r.fallRate ?? 25) * dt);
      else t.pos[2] = want;
    }

    // ── the affordance facts (D5): named once, surfaced every frame ──
    e.speed = v;
    if (world && world.padAt) e.boosting = boostOn;
    e.wheelPhase = (e.wheelPhase || 0) + v * dt / (TAU * wheelR);   // distance-true roll
    e.wheelSpin = v / (TAU * wheelR);                                // cycles/sec (engine-tone macro)
    e.throttle = throttle;
    e.brakeStart = braking && !e.braking ? true : false;
    e.braking = braking;
    const latDemand = (v * v * Math.abs(Math.tan(e.steerAngle))) / wheelbase;   // v²/R demand
    const skidNow = latDemand > grip * G;
    e.skidStart = skidNow && !e.skidding ? true : false;
    e.skidding = skidNow;
    e.boarded = !e._driven ? true : false;   // first driven frame (the swap seats the pilot; dismount rides the swap)
    e._driven = true;
    e.locomotion = 'drive';
    e.gaitPhase = e.wheelPhase;              // the D1 `roll` clip's driver — stride = 2πr
    e.moving = Math.abs(v) > 1e-3;
    // a two-wheeler leans into its turn (the rig's lean: tan λ = v² κ / g)
    if (r.wheels === 2) e.lean = Math.atan((v * v * Math.tan(e.steerAngle || 0)) / (wheelbase * G));
  }

  // FLIGHT (opt-in `air`): the car leaves the ground where it falls away faster than gravity would take it (a ramp's
  // lip, a crest at v² κ > g), flies ballistic under g, and lands where the probe meets it, keeping the speed along the
  // landing (cos of the angle between its path and the ground; arcade's `landKeep` at least) and losing the rest.
  // Facts: airborne, airTime (the last flight's), landed (edge), landLoss. → the speed after.
  function fly(e, want, v, f, dt, world) {
    const r = e.rule, t = e.transform, z0 = t.pos[2], vz = e.vz || 0, ballistic = z0 + vz * dt - 0.5 * G * dt * dt;
    const eye = r.eye ?? 0, top = want - eye + (r.collideHeight ?? 3), dir = v < 0 ? -1 : 1, sp = Math.abs(v);
    const gAt = (d) => { const g = world.ground([t.pos[0] + f[0] * d * dir, t.pos[1] + f[1] * d * dir, top]); return g == null ? null : g + eye; };
    e.landed = false;
    if (e.airborne) {
      e.vz = vz - G * dt; e.airT = (e.airT || 0) + dt;
      if (ballistic > want) { t.pos[2] = ballistic; return v; }
      // the landing: the ground's slope along the way, a metre on
      const ahead = gAt(1), slope = ahead != null ? ahead - want : 0;
      const keep = Math.max(Math.cos(Math.atan2(vz, sp) - Math.atan(slope)), r.landKeep > 0 ? r.landKeep : 0);
      t.pos[2] = want; e.airborne = false; e.landed = true; e.airTime = e.airT; e.landLoss = 1 - keep;
      e.vz = sp * keep * slope; e.vzs = e.vz;
      return v * keep;
    }
    // on the ground: its climb is the slope just behind (20 cm: a lip's own angle), its vertical acceleration the change
    // of the slope over the last metre (a crest's curvature, smoothed over a mesh's facets)
    const b2 = gAt(-0.2), b1 = gAt(-1);
    const vzLip = b2 != null ? sp * (want - b2) / 0.2 : (want - z0) / dt, vzS = b1 != null ? sp * (want - b1) : vzLip;
    const az = e.vzs == null ? 0 : (vzS - e.vzs) / dt;
    if (want < ballistic - 0.003 && sp > 1) {
      // a lip's drop, crossed somewhere in the last step: found (where the ground still rises into it), and the car
      // launched from there at the lip's own slope, flown on for the rest of the step
      const onRamp = (d) => { const a = gAt(d), b = gAt(d - 0.05); return a != null && b != null && a - b > -0.02; };
      let lo = -sp * dt - 0.05, hi = 0;
      if (onRamp(lo)) {
        for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (onRamp(m)) lo = m; else hi = m; }
        // the slope read behind the lip (the search can stop a hair onto its drop), carried forward to it
        const za = gAt(lo - 0.03), zb = gAt(lo - 0.23), slope = za != null && zb != null ? (za - zb) / 0.2 : vz / sp;
        const zl = (za ?? want) + slope * 0.03, vzl = clamp(sp * slope, -50, sp * 0.8), tau = -lo / sp;
        t.pos[2] = Math.max(zl + vzl * tau - 0.5 * G * tau * tau, want); e.vz = vzl - G * tau;
      } else { t.pos[2] = Math.max(ballistic, want); e.vz = vz - G * dt; }
      e.airborne = true; e.airT = 0; e.vzs = null;
      return v;
    }
    if (az < -G) {
      // a crest at v²κ > g: the ground falls away faster than gravity takes the car
      t.pos[2] = Math.max(ballistic, want); e.airborne = true; e.airT = 0; e.vz = vz - G * dt; e.vzs = null;
      return v;
    }
    e.vz = clamp(vzLip, -50, sp * 0.8); e.vzs = vzS;
    t.pos[2] = want;
    return v;
  }


  function racer(e, input, dt, world) {
    const r = e.rule, L = r.line || [], n = L.length;
    if (!n || !world.aiEnabled) { drive(e, { forward: 0, turn: 0 }, dt, world); return; }
    const t = e.transform, at = (i) => L[r.closed ? ((i % n) + n) % n : Math.min(i, n - 1)];
    if (e.lineAt == null) {
      // the first: the nearest point ahead of where it stands
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.hypot(L[i][0] - t.pos[0], L[i][1] - t.pos[1]); if (d < bd) { bd = d; best = i; } }
      const f = fwdXY(t.heading), q = L[best];
      e.lineAt = (q[0] - t.pos[0]) * f[0] + (q[1] - t.pos[1]) * f[1] < 0 ? best + 1 : best;
      e.laps = 0; e.stuckT = 0; e.backT = 0;
    }
    // reached: within `reach`, or passed (behind the car along the line's way)
    const reach = r.reach > 0 ? r.reach : 4;
    for (let k = 0; k < n; k++) {
      const p = at(e.lineAt), nx = at(e.lineAt + 1);
      const d = Math.hypot(p[0] - t.pos[0], p[1] - t.pos[1]);
      const passed = (t.pos[0] - p[0]) * (nx[0] - p[0]) + (t.pos[1] - p[1]) * (nx[1] - p[1]) > 0;
      if (!(d < reach || (passed && d < reach * 3))) break;
      if (!r.closed && e.lineAt >= n - 1) break;
      e.lineAt++;
      if (r.closed && e.lineAt % n === 0) e.laps++;
    }
    // the aim: `look` points on, `lane` to the left of the way there
    const look = r.look > 0 ? r.look : 3, a = at(e.lineAt + look - 1), b = at(e.lineAt + look);
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, lane = r.lane || 0;
    const aim = [b[0] - ((b[1] - a[1]) / dl) * lane, b[1] + ((b[0] - a[0]) / dl) * lane];
    let err = Math.atan2(aim[1] - t.pos[1], aim[0] - t.pos[0]) - t.heading;
    err = ((err + Math.PI) % TAU + TAU) % TAU - Math.PI;
    // the turn ahead: the line's bend over the next few points
    const c = at(e.lineAt + look * 2), h1 = Math.atan2(b[1] - a[1], b[0] - a[0]), h2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let bend = h2 - h1; bend = Math.abs(((bend + Math.PI) % TAU + TAU) % TAU - Math.PI);
    const v = e.speed || 0, pace = r.pace > 0 ? r.pace : 1, corner = r.corner > 0 ? r.corner : 9;
    let forward = pace;
    if (bend > 0.25 && v > corner / bend) forward = -0.6;                 // brake into a sharp bend at speed
    else if (Math.abs(err) > 0.6 && v > corner) forward = 0;              // lift while the nose comes round
    // GRIP-BOUND (a vehicle class's rule, `lateralGrip`): a speed plan, not a rule of thumb. Every point ahead within
    // braking reach allows √(μg/κ) through its bend (μ the ground's under the car now, the weather's); the speed now is
    // what still brakes down to each in the distance to it. Far off the line, slow enough to turn back to it.
    if (r.lateralGrip) {
      const Sg = r.surfaceGrip && world.surface ? world.surface(t.pos) : null;
      const mu = (r.grip > 0 ? r.grip : 1) * (r.muScale > 0 ? r.muScale : 1) * (Sg ? Sg.mu : 1) * 0.9, aB = mu * G * (r.brakeEff > 0 ? r.brakeEff : 0.8);
      let want = Infinity, d = Math.hypot(at(e.lineAt)[0] - t.pos[0], at(e.lineAt)[1] - t.pos[1]);
      for (let k = 0; k < 60 && d < (v * v) / (2 * aB) + 30; k++) {
        const p0 = at(e.lineAt + k - 2), p1 = at(e.lineAt + k), p2 = at(e.lineAt + k + 2);
        const ab = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), bc = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), ac = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
        const kap = ab && bc && ac ? Math.abs(2 * ((p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]))) / (ab * bc * ac) : 0;
        if (kap > 1e-4) want = Math.min(want, Math.sqrt((mu * G) / kap + 2 * aB * d));
        const q = at(e.lineAt + k + 1); d += Math.hypot(q[0] - p1[0], q[1] - p1[1]);
      }
      // turning back to the aim: no faster than a circle through it allows
      const toAim = Math.hypot(aim[0] - t.pos[0], aim[1] - t.pos[1]);
      if (Math.abs(err) > 0.35) want = Math.min(want, Math.sqrt((mu * G * toAim) / (2 * Math.sin(Math.min(Math.abs(err), Math.PI / 2)))));
      forward = v > want ? -1 : v > want * 0.97 ? 0 : pace;
    }
    // a ramp ahead (`ramps`: [{ at, hi }], its lip and the fastest speed that lands it): lift, or brake, not to overshoot
    // (aiming at the middle of its landing band, from as far out as braking to it takes)
    if (r.ramps) for (const q of r.ramps) {
      const dx = q.at[0] - t.pos[0], dy = q.at[1] - t.pos[1], fw = fwdXY(t.heading), aim = q.lo != null ? (q.lo + q.hi) / 2 : q.hi;
      const reachB = (v * v - aim * aim) / (2 * 6) + 15;
      if (dx * fw[0] + dy * fw[1] > 0 && Math.hypot(dx, dy) < Math.max(15, reachB) && v > aim) forward = Math.min(forward, v > aim + 0.4 ? -1 : 0);
    }
    // stuck: throttling into something; back off a second, steering the other way
    if (e.backT > 0) { e.backT -= dt; drive(e, { forward: -1, turn: clamp(err * 2, -1, 1) }, dt, world); return; }
    e.stuckT = forward > 0 && Math.abs(v) < 0.5 ? e.stuckT + dt : 0;
    if (e.stuckT > 1) { e.stuckT = 0; e.backT = 1; }
    drive(e, { forward, turn: clamp(-err * 2.5, -1, 1) }, dt, world);
  }

  // THE `chaser` RULE — a driver no one pilots, after a body (the law's police car): the same drive, its stick moved
  // toward `target` (or what it rides). Far off it keeps to the ROADS (`roads`: [[axis 0 = along x | 1 = along y,
  // cross, lo, hi], …], the street's middle lines): a route from the road nearest it to the road nearest the target,
  // over the junctions where they cross (the shortest by distance), replanned every `replan` s; near (`near` m) it drives
  // straight at it, and beside it holds there. Slowing into a turn ahead at speed, backing off a second when stuck.
  // PINNED: the target barely moving and this car at it (`pin` m), a hold every `every` s, counted on the target (its
  // `helds` and `heldBy`, the bus's `held:<target>`): boxed in, the player is caught as on foot, unhurt.
  function roadRoute(R, from, to, join) {
    const near = (p) => { let best = null; for (let i = 0; i < R.length; i++) { const [a, c, lo, hi] = R[i], u = clamp(a ? p[1] : p[0], lo, hi), d = Math.hypot(a ? p[0] - c : p[1] - c, (a ? p[1] : p[0]) - u); if (!best || d < best.d) best = { i, u, d }; } return best; };
    const A = near(from), B = near(to);
    if (!A || !B) return null;
    const pt = (i, u) => (R[i][0] ? [R[i][1], u] : [u, R[i][1]]);
    // the nodes: each junction (two roads crossing within their spans), and the two ends
    const nodes = [pt(A.i, A.u), pt(B.i, B.u)], on = R.map(() => []);
    on[A.i].push([A.u, 0]); on[B.i].push([B.u, 1]);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      if (R[i][0] === R[j][0]) continue;
      const x = R[i][0] ? R[i] : R[j], y = R[i][0] ? R[j] : R[i];   // x: along y at x = cross; y: along x at y = cross
      // (a street's run stops at the kerb of the one it meets: joined within `join` m of its end)
      if (y[1] < x[2] - join || y[1] > x[3] + join || x[1] < y[2] - join || x[1] > y[3] + join) continue;
      const k = nodes.length; nodes.push([x[1], y[1]]);
      on[R[i][0] ? i : j].push([y[1], k]); on[R[i][0] ? j : i].push([x[1], k]);
    }
    const adj = nodes.map(() => []);
    for (const L of on) { L.sort((a, b) => a[0] - b[0] || a[1] - b[1]); for (let k = 1; k < L.length; k++) { const w = Math.abs(L[k][0] - L[k - 1][0]); adj[L[k][1]].push([L[k - 1][1], w]); adj[L[k - 1][1]].push([L[k][1], w]); } }
    // (the shortest, by distance: a small graph, a plain search)
    const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
    dist[0] = 0;
    for (;;) {
      let u = -1; for (let k = 0; k < nodes.length; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0 || u === 1) break;
      done[u] = true;
      for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    if (dist[1] === Infinity) return null;
    const path = []; for (let k = 1; k >= 0; k = prev[k]) { path.unshift(nodes[k]); if (k === 0) break; }
    return path;
  }
  function chaser(e, input, dt, world) {
    const r = e.rule, T = world.byId && world.byId[r.target];
    if (e.gone || e.dormant || !T || !world.aiEnabled) { if (!e.gone) drive(e, { forward: 0, turn: 0 }, dt, world); return; }
    const H = (T.mountedOn && world.byId[T.mountedOn]) || T, t = e.transform, tp = H.transform.pos;
    const dT = Math.hypot(tp[0] - t.pos[0], tp[1] - t.pos[1]), nearM = r.near > 0 ? r.near : 28;
    e.planT = (e.planT || 0) - dt;
    if (e.planT <= 0) { e.planT = r.replan > 0 ? r.replan : 1; e.chaseRoute = dT > nearM && r.roads && r.roads.length ? roadRoute(r.roads, t.pos, tp, r.join > 0 ? r.join : 14) : null; e.chaseAt = 0; }
    let aim = tp, next = null;
    if (e.chaseRoute && e.chaseRoute.length) {
      const reach = r.reach > 0 ? r.reach : 7;
      while (e.chaseAt < e.chaseRoute.length - 1 && Math.hypot(e.chaseRoute[e.chaseAt][0] - t.pos[0], e.chaseRoute[e.chaseAt][1] - t.pos[1]) < reach) e.chaseAt++;
      aim = e.chaseRoute[e.chaseAt]; next = e.chaseRoute[e.chaseAt + 1] || null;
    }
    let err = Math.atan2(aim[1] - t.pos[1], aim[0] - t.pos[0]) - t.heading;
    err = ((err + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const v = e.speed || 0, pace = r.pace > 0 ? r.pace : 1, corner = r.corner > 0 ? r.corner : 10;
    let forward = pace;
    // (a turn at the next junction: slow to take it, from as far out as braking to it takes)
    if (next) {
      const dA = Math.hypot(aim[0] - t.pos[0], aim[1] - t.pos[1]);
      let bend = Math.atan2(next[1] - aim[1], next[0] - aim[0]) - Math.atan2(aim[1] - t.pos[1], aim[0] - t.pos[0]);
      bend = Math.abs(((bend + Math.PI) % TAU + TAU) % TAU - Math.PI);
      if (bend > 0.5 && v > corner && dA < (v * v - corner * corner) / (2 * 7) + 6) forward = -0.8;
    }
    if (Math.abs(err) > 0.7 && v > corner) forward = Math.min(forward, 0);
    // (at it: closing slow, holding beside it while it stands)
    // (standing: a car at a crawl, a body on foot that is not moving)
    const still = H === T ? !T.moving : Math.abs(H.speed || 0) < 2;
    // (a target that stands: braked to a stop beside it, from as far out as stopping takes; one that moves, flat out)
    const lastLeg = !e.chaseRoute || e.chaseAt >= e.chaseRoute.length - 1;
    if (still && lastLeg && dT < 40) { const want = Math.sqrt(2 * 6 * Math.max(0, dT - 5)); forward = v > want + 0.5 ? -1 : dT < 5 ? 0 : Math.min(forward, 0.5); }
    else if (dT < 9) forward = pace;
    if (e.backT > 0) { e.backT -= dt; drive(e, { forward: -1, turn: clamp(err * 2, -1, 1) }, dt, world); }
    else {
      // (stuck: throttling a second and not a metre on, against a wall or a car, whatever its wheels say)
      if (forward > 0 && dT > 6) {
        if (!e.chaseFrom) e.chaseFrom = [t.pos[0], t.pos[1], 0];
        e.chaseFrom[2] += dt;
        if (e.chaseFrom[2] >= 1) { const moved = Math.hypot(t.pos[0] - e.chaseFrom[0], t.pos[1] - e.chaseFrom[1]); e.chaseFrom = null; if (moved < 1) { e.backT = 1.2; e.speed = 0; e.planT = 0; } }
      } else e.chaseFrom = null;
      drive(e, { forward, turn: clamp(-err * 2.5, -1, 1) }, dt, world);
    }
    // PINNED: a blow every `every` s while the target stands and this car is at it
    if (dT < (r.pin > 0 ? r.pin : 6) && still && Math.abs(e.speed || 0) < 3) {
      e.pinT = (e.pinT || 0) + dt;
      if (e.pinT >= (r.every > 0 ? r.every : 1)) { e.pinT = 0; T.helds = (T.helds || 0) + 1; T.heldBy = e.id; }
    } else e.pinT = 0;
  }

  Object.assign(RULES, { drive, racer, chaser });
}
