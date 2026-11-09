/**
 * rules-hover.js — the `hover` rule: a ROTORCRAFT (a helicopter, a multirotor drone), held up by its rotors' thrust
 * along its disc's axis and moved by tilting it, as the `fly` rule flies a fixed wing. Import-free (the page runs this
 * source via toString(), compose.js); emitted only into a page whose world has a rotorcraft, so every other page keeps
 * every byte. Its numbers are a type's envelope (skyscape/rotor.js hoverRule).
 *
 *   • THE DISC: its thrust acts along the rotor's axis, tilted by the craft's pitch (+ nose up) and bank (+ right wing
 *     down); what the tilt leans of it moves the craft, what is left holds it up. Drag is quadratic, across the ground
 *     (`drag`) and up and down (`dragZ`): at its most tilt, holding its height, it comes to its top speed; with its
 *     thrust spare, to its best climb.
 *   • THE COLLECTIVE (Space / Shift): asks a climb (to `climb` m/s) or a descent (to `descent`); let go, it holds its
 *     height. The thrust that asks is the craft's own and never more than `thrust`: tilted far, holding its height
 *     takes more of it, and past that it sinks.
 *   • THE CYCLIC (W / S fore and aft, Q / E to the side): a helicopter's asks its disc's tilt (to `tiltMax`), and let go
 *     it levels and coasts; a drone's flight controller (`hold`) asks a speed, the stick's share of its top, and let go
 *     it brakes to a hover. Its disc tilts at `tiltRate`.
 *   • THE PEDALS (A / D, and the hand's look across when no gun takes it): turn it about its rotor (`yawRate`); at speed
 *     the disc banks into the turn (a coordinated turn: tan(bank) = v·ω / g), so its path turns with its nose.
 *   • THE GROUND: it settles on it (its skids, its gear, its feet); `touchdown` and `takeoff` edges, the speed it met
 *     the ground at (`impact`, m/s). `collideHeight` (m, 3): how far above its belly its ground is looked for.
 *   • THE BOUND: as the fly rule's (`bound`: { hx, hy, cx?, cy?, warn? }): out of the reach for `warn` s, it is turned
 *     back toward the centre.
 *
 * AFFORDANCE FACTS: locomotion 'hover' | 'land', airspeed (across the ground), climbRate, throttle (its thrust's share of
 * its most), bank, airborne, takeoff / touchdown, impact, vel ([x, y, z] m/s, the world's: what a round it fires carries),
 * gaitPhase (its rotors' turn), tilt { pitch, roll } (the page attitudes the body by it).
 * Field ownership: e.vel, e.bank, e.yawV (its turn, rad/s).
 */
export function buildRulesHover(E) {
  const { clamp, TAU, RULES } = E;
  const G = 9.81;
  const toward = (v, to, d) => v + clamp(to - v, -d, d);
  function hover(e, input, dt, world) {
    const r = e.rule, t = e.transform;
    const m = r.mass > 0 ? r.mass : 1, W = m * G, Tmax = r.thrust > 0 ? r.thrust : W * 1.5;
    const k = r.drag > 0 ? r.drag : m * 0.02, kz = r.dragZ > 0 ? r.dragZ : m * 0.2;
    const tiltMax = r.tiltMax > 0 ? r.tiltMax : 0.5, tiltRate = r.tiltRate > 0 ? r.tiltRate : 1, yawRate = r.yawRate > 0 ? r.yawRate : 1;
    const vmax = r.maxSpeed > 0 ? r.maxSpeed : 30;
    const vel = e.vel || (e.vel = [0, 0, 0]);
    const ch = Math.cos(t.heading), sh = Math.sin(t.heading);
    // (its velocity on its own axes: ahead and to its right)
    const vf = vel[0] * ch + vel[1] * sh, vr = vel[0] * sh - vel[1] * ch;
    let fwd = clamp(input.forward || 0, -1, 1), side = clamp(input.strafe || 0, -1, 1), yawIn = clamp(input.turn || 0, -1, 1);
    const up = clamp(input.lift || 0, -1, 1);
    // ── the bound: out of the reach for `warn` s, it is turned back toward the centre and flown home ──
    if (r.bound) {
      const B = r.bound, cx = B.cx || 0, cy = B.cy || 0;
      const out = Math.abs(t.pos[0] - cx) > B.hx || Math.abs(t.pos[1] - cy) > B.hy;
      e.boundT = out ? (e.boundT || 0) + dt : 0;
      e.outOfBounds = out;
      if (out && e.boundT > (B.warn ?? 5)) {
        let d = Math.atan2(cy - t.pos[1], cx - t.pos[0]) - t.heading;
        d = ((d % TAU) + TAU + Math.PI) % TAU - Math.PI;
        yawIn = clamp(-2 * d, -1, 1); fwd = 0.6; side = 0;
      }
    }
    // ── the pedals: its turn eased toward the ask (D right: its heading falls), and the hand's look across; at speed no
    // faster than a bank of seven tenths of its disc's most turns its path (ω = g·tan(bank) / v), the rest of its tilt
    // left to keep its speed ──
    const wMax = Math.min(yawRate, (G * Math.tan(0.7 * tiltMax)) / Math.max(Math.abs(vf), 1));
    e.yawV = toward(e.yawV || 0, -yawIn * wMax, yawRate * 4 * dt);
    t.heading = (t.heading + e.yawV * dt + (input.lookDX || 0) * (r.lookSens ?? 0.003)) % TAU;
    // ── the cyclic: the disc's tilt asked, fore (θf, + toward the nose) and to the side (θr, + to the right) ──
    let tf, tr;
    if (r.hold) {
      // a drone's flight controller: the speed asked, the tilt that brings it there and holds it against its drag
      const kv = 1.5, af = kv * (fwd * vmax - vf) + (k / m) * vf * Math.abs(vf), ar = kv * (side * vmax - vr) + (k / m) * vr * Math.abs(vr);
      tf = Math.atan(af / G); tr = Math.atan(ar / G);
    } else { tf = fwd * tiltMax; tr = side * tiltMax; }
    // (the turn coordinated: at speed the disc banks into it, so the path turns with the nose; the bank first, the tilt
    // ahead what is left of the disc's most, so it holds its height through the turn and slows in it)
    tr = clamp(tr + (vf > 0 ? Math.atan((vf * -e.yawV) / G) : 0), -tiltMax, tiltMax);
    const fore = Math.sqrt(Math.max(0, tiltMax * tiltMax - tr * tr));
    tf = clamp(tf, -fore, fore);
    const airborne0 = !!e.airborne;
    if (airborne0 || e.airborne === undefined) {
      t.pitch = toward(t.pitch || 0, -tf, tiltRate * dt);
      e.bank = toward(e.bank || 0, tr, tiltRate * dt);
    } else { t.pitch = toward(t.pitch || 0, 0, tiltRate * dt); e.bank = toward(e.bank || 0, 0, tiltRate * dt); }
    // ── the collective: the climb asked (or the height held), the thrust that gets it, within its most ──
    const p = t.pitch || 0, b = e.bank || 0, uf = -Math.sin(p), ur = Math.sin(b) * Math.cos(p), uz = Math.cos(b) * Math.cos(p);
    const vzWant = up > 0 ? up * (r.climb ?? 5) : up * (r.descent ?? 4);
    const T = clamp((W + m * 2 * (vzWant - vel[2]) + kz * vel[2] * Math.abs(vel[2])) / Math.max(uz, 0.2), 0, Tmax);
    // ── the forces: the thrust along the disc's axis, the weight, the drag ──
    const ax = (T / m) * (uf * ch + ur * sh), ay = (T / m) * (uf * sh - ur * ch), az = (T / m) * uz - G;
    const vh = Math.hypot(vel[0], vel[1]);
    vel[0] += (ax - (k / m) * vh * vel[0]) * dt;
    vel[1] += (ay - (k / m) * vh * vel[1]) * dt;
    vel[2] += (az - (kz / m) * vel[2] * Math.abs(vel[2])) * dt;
    t.pos[0] += vel[0] * dt; t.pos[1] += vel[1] * dt; t.pos[2] += vel[2] * dt;
    // ── the ground: it settles on it, its slide rubbed out ──
    const gz = world && world.ground ? world.ground([t.pos[0], t.pos[1], t.pos[2] + (r.collideHeight ?? 3)]) : null;
    let airborne = true;
    e.impact = 0;
    if (gz != null && t.pos[2] <= gz + 0.02) {
      if (vel[2] < 0) e.impact = Math.hypot(vel[0], vel[1], vel[2]);
      t.pos[2] = gz;
      vel[2] = Math.max(0, vel[2]);
      const rub = Math.exp(-6 * dt); vel[0] *= rub; vel[1] *= rub;
      airborne = vel[2] > 0.05;
    }
    e.takeoff = airborne && !airborne0 && e.airborne !== undefined;
    e.touchdown = !airborne && airborne0;
    e.airborne = airborne;
    // ── the facts ──
    e.airspeed = Math.hypot(vel[0], vel[1]);
    e.climbRate = vel[2];
    e.throttle = T / Tmax;
    e.tilt = { pitch: t.pitch || 0, roll: e.bank || 0 };
    e.locomotion = airborne ? 'hover' : 'land';
    e.gaitPhase = (e.gaitPhase || 0) + (airborne ? 1 : 0.4 + 0.6 * e.throttle) * (r.rotorRate ?? 6) * dt;
    e.moving = e.airspeed > 0.05 || Math.abs(vel[2]) > 0.05;
  }
  Object.assign(RULES, { hover });
}
