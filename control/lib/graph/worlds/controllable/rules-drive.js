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
    const grip = r.grip > 0 ? r.grip : 1;
    const tractionCap = grip * mass * G;
    const brakeForce = r.brakeForce > 0 ? r.brakeForce : mass * G * 0.8;
    const dragK = r.drag ?? 0.42;
    const rollForce = (r.rollResist ?? 0.015) * mass * G;
    const wheelbase = r.wheelbase > 0 ? r.wheelbase : 2.8;
    const wheelR = r.wheelRadius > 0 ? r.wheelRadius : 0.33;
    const reverseSpeed = r.reverseSpeed > 0 ? r.reverseSpeed : 6;
    const steerMax = r.steerMax ?? 0.55, steerSpeed = r.steerSpeed ?? 2.5;
    const vFloor = r.vFloor > 0 ? r.vFloor : 2;
    const eye = r.eye ?? 0;
    let v = e.speed || 0;

    // ── longitudinal force: throttle / brake / reverse ──
    const throttle = clamp(input.forward, 0, 1);
    const brakeIn = clamp(-input.forward, 0, 1);
    const engineF = (sign) => sign * Math.min(powerN / Math.max(Math.abs(v), vFloor), tractionCap);
    let F = 0;
    let braking = false;
    if (throttle > 0) {
      if (v >= -1e-3) F = engineF(1) * throttle;                    // drive forward
      else { F = brakeForce * throttle; braking = true; }           // W against reverse motion = brake
    } else if (brakeIn > 0) {
      if (v > 1e-3) { F = -brakeForce * brakeIn; braking = true; }  // brake the forward roll
      else F = engineF(-1) * brakeIn;                               // standstill/rolling back → reverse drive
    }
    const resist = dragK * v * Math.abs(v) + (Math.abs(v) > 1e-3 ? rollForce * Math.sign(v) : 0);
    const v0 = v;
    v += ((F - resist) / mass) * dt;
    // resistive forces stop a coasting car — they never reverse it (no throttle → clamp at 0)
    if (F === 0 && v0 !== 0 && Math.sign(v) !== Math.sign(v0)) v = 0;
    if (F === 0 && Math.abs(v) < 0.15) v = 0;                       // rest deadband: a parked car stays parked
    v = clamp(v, -reverseSpeed, r.topSpeed > 0 ? r.topSpeed : Infinity);

    // ── steering: slewed bicycle model, tightened with speed ──
    const effMax = steerMax / (1 + Math.abs(v) * (r.steerTighten ?? 0.03));
    const steerTarget = clamp(-input.turn, -1, 1) * effMax;         // A = steer left = heading+ (tank convention)
    e.steerAngle = (e.steerAngle || 0) + clamp(steerTarget - (e.steerAngle || 0), -steerSpeed * dt, steerSpeed * dt);
    t.heading = (t.heading + (v / wheelbase) * Math.tan(e.steerAngle) * dt) % TAU;

    // ── integrate + walls + ground ──
    const f = fwdXY(t.heading);
    t.pos[0] += f[0] * v * dt;
    t.pos[1] += f[1] * v * dt;
    if (world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 3, r.collideRadius ?? 0, world.colliders, r.step ?? 0.3);
    // ground: cast from body height so rising terrain is seen (the ai's head-height read); climb
    // snaps, a ledge is followed DOWN at the clamped fall rate — no airborne cars in v1.
    const gz = world && world.ground ? world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 3)]) : null;
    if (gz != null) {
      const want = gz + eye;
      if (want < t.pos[2]) t.pos[2] = Math.max(want, t.pos[2] - (r.fallRate ?? 25) * dt);
      else t.pos[2] = want;
    }

    // ── the affordance facts (D5): named once, surfaced every frame ──
    e.speed = v;
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
  }

  Object.assign(RULES, { drive });
}
