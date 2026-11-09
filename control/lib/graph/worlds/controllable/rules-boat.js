/**
 * rules-boat.js — the `boat` rule: a hull driven over the water, at its class's figures (craft-shelf/boat-drive.js).
 * Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose world has a boat,
 * so every other page keeps every byte.
 *
 *   • THE THROTTLE (W / S): a lever, as a boat's is: it stays where it is set, ahead or (a half's worth) astern.
 *   • ITS THRUST: its engine's power over its speed (power = thrust × speed, at its propeller's efficiency), no more than
 *     its bollard pull standing (an outboard's about 0.1 N a watt, a ship's big slow screws less, by its length): so it
 *     pulls hard from rest and less the faster it goes.
 *   • ITS HULL'S RESISTANCE: quadratic in its speed, set so its power holds it at its top speed; a displacing hull meets
 *     a wall past its hull speed (Froude 0.35 on its waterline: the wave it makes as long as it is), a hull that planes a
 *     hump below its planing speed (Froude about 1.5 on its displacement) and lifts over it. So a planing boat climbs
 *     onto the plane, bow up, and runs; a ship never passes its wave.
 *   • THE HELM (A / D): at speed it turns on its turning circle (`circle`, m), and no tighter than its hull's grip lets it
 *     (about 0.6 g on the plane, a ship's far less), its turn eased in as its hull's weight allows (a bigger hull slower); an outboard's or a jet's thrust is turned (`vector`), so it turns standing too; a
 *     rudder needs way. Its way across its heading dies on its hull's grip: it slides out of a fast turn and carves.
 *   • THE WATER: it floats at its waterline over `water` (m, the surface's height; 0) on the swell (`swell`: the trains
 *     the page draws), heaving, pitching and rolling as the water under its bow and stern, port and starboard, moves;
 *     a planing hull rides higher on the plane, trims bow up over its hump, banks into its turn; a ship heels out of it.
 *     Where the bottom comes up within its draft it runs aground: stopped.
 *
 * Rule: { mass (kg), power (W), top (m/s), lw (its waterline's length, m), beam, volume (m³ displaced), draft, waterline
 * (its waterline's height over its origin), planing, vector, circle, lever?, leverRate?, water?, swell? }
 * Facts: speed (ahead, m/s), vel ([x, y, z] m/s, what a round it fires carries), throttle (the lever's share, for its
 * engine), trim, aground, locomotion 'sail', tilt { pitch, roll }, sailT (its water's clock: the page's sheet runs on it).
 * Field ownership: e.vel, e.lever, e.yawV, e.side (its way across), e.sailT.
 */
export function buildRulesBoat(E) {
  const { clamp, TAU, RULES } = E;
  const G = 9.81, RHO = 1025;
  // the swell's height under a point, at a time (the page's trains: ω = √(g·k))
  function swellAt(S, x, y, t) {
    let h = 0;
    if (S) for (const w of S) { const k = 2 * Math.PI / w.length; h += w.amp * Math.sin(k * (Math.cos(w.dir) * x + Math.sin(w.dir) * y) - Math.sqrt(G * k) * t + (w.ph || 0)); }
    return h;
  }
  function boat(e, input, dt, world) {
    const r = e.rule, t = e.transform;
    const m = r.mass > 0 ? r.mass : 500, P = r.power > 0 ? r.power : 20000, top = r.top > 0 ? r.top : 10, lw = r.lw > 0 ? r.lw : 5;
    const vol = r.volume > 0 ? r.volume : m / RHO, level = r.water || 0;
    e.sailT = (e.sailT || 0) + dt;
    // ── the lever: W / S move it, it stays (astern to half) ──
    const was = e.lever ?? (r.leverStart || 0);
    e.lever = clamp(was + (input.forward || 0) * (r.leverRate ?? 0.5) * dt, -0.5, 1);
    const thr = e.lever;
    // ── its way on its own axes: ahead (u) and across (v) ──
    const vel = e.vel || (e.vel = [0, 0, 0]);
    const ch = Math.cos(t.heading), sh = Math.sin(t.heading);
    let u = vel[0] * ch + vel[1] * sh, v = -vel[0] * sh + vel[1] * ch;
    // ── the resistance's shape: a planing hull's hump, a displacing hull's wall ──
    const frV = (s) => Math.abs(s) / Math.sqrt(G * Math.cbrt(vol)), frL = (s) => Math.abs(s) / Math.sqrt(G * lw);
    const shape = (s) => (r.planing ? 1 + 1.2 * Math.exp(-(((frV(s) - 1.5) / 0.6) ** 2)) : 1 + 25 * Math.max(0, frL(s) - 0.35) ** 2);
    // ── the thrust: its power over its speed, capped standing at its bollard pull; astern at half (the resistance set
    // so the thrust it has at its top speed holds it there) ──
    const eta = 0.6, pull = 0.1 * P * Math.pow(Math.min(1, 5 / lw), 0.4), thrust = (s) => Math.min((eta * P) / Math.max(Math.abs(s), 1e-3), pull);
    const a = thrust(top) / (top * top * shape(top));
    const T = thr * thrust(u);
    const R = a * u * Math.abs(u) * shape(u);
    const M = 1.1 * m;   // (and the water it carries along with it)
    u += ((T - R) / M) * dt;
    if (thr === 0 && Math.abs(u) < 0.02) u = 0;
    // ── the helm: its turn eased in; at speed on its circle, standing only where its thrust is turned ──
    const steer = clamp(input.turn || 0, -1, 1), tau = 0.3 * Math.sqrt(lw);
    const radius = Math.max(r.circle > 0 ? r.circle / 2 : 2 * lw, (u * u) / ((r.planing ? 0.6 : 0.12) * G));
    const want = -steer * (u / radius + (r.vector ? 0.35 * Math.abs(thr) * Math.sign(u || 1) * Math.max(0, 1 - Math.abs(u) / (0.3 * top)) : 0));
    e.yawV = (e.yawV || 0) + (want - (e.yawV || 0)) * (1 - Math.exp(-dt / tau));
    t.heading = (t.heading + e.yawV * dt) % TAU;
    // ── its way across dies on its hull's grip (a planing hull's slide, a keel's bite) ──
    v *= Math.exp(-(r.planing ? 1.5 : 3) * dt);
    const ch2 = Math.cos(t.heading), sh2 = Math.sin(t.heading);
    const nx = t.pos[0] + (u * ch2 - v * sh2) * dt, ny = t.pos[1] + (u * sh2 + v * ch2) * dt;
    // ── the bottom: within its draft of the surface it is aground, stopped where it was ──
    const gz = world && world.ground ? world.ground([nx, ny, level + 10]) : null;
    e.aground = gz != null && gz > level - (r.draft || 0.3);
    if (e.aground) { u = 0; v = 0; e.yawV = 0; }
    else { t.pos[0] = nx; t.pos[1] = ny; }
    vel[0] = u * ch2 - v * sh2; vel[1] = u * sh2 + v * ch2; vel[2] = 0;
    // ── the water under it: heave, pitch and roll from the swell at its ends and its sides ──
    const S = r.swell, tt = e.sailT, fx = ch2, fy = sh2, half = lw / 2, hb = (r.beam || 2) / 2;
    const hBow = swellAt(S, t.pos[0] + fx * half, t.pos[1] + fy * half, tt), hSt = swellAt(S, t.pos[0] - fx * half, t.pos[1] - fy * half, tt);
    const hStb = swellAt(S, t.pos[0] + fy * hb, t.pos[1] - fx * hb, tt), hPort = swellAt(S, t.pos[0] - fy * hb, t.pos[1] + fx * hb, tt);
    // (a planing hull: trimmed bow up over its hump, riding higher on the plane; a ship: a little squat)
    const plane = r.planing ? clamp((frV(u) - 1) / 1.5, 0, 1) : 0;
    const trim = r.planing ? 0.11 * Math.exp(-(((frV(u) - 1.4) / 0.7) ** 2)) + 0.04 * plane : -0.004 * clamp(frL(u) / 0.35, 0, 1);
    const turn = Math.atan((u * -e.yawV) / G);
    const roll = (r.planing ? 0.5 : -0.12) * turn + Math.atan((hPort - hStb) / (2 * hb)) * 0.8;
    t.pitch = Math.atan((hBow - hSt) / lw) + trim;
    t.pos[2] = level + (hBow + hSt + hStb + hPort) / 4 + plane * 0.4 * (r.draft || 0.3) - (r.waterline || 0);
    e.bank = roll;
    e.tilt = { pitch: t.pitch, roll };
    // ── the facts ──
    e.speed = u; e.airspeed = Math.abs(u); e.throttle = Math.abs(thr); e.trim = trim;
    e.locomotion = 'sail'; e.moving = Math.abs(u) > 0.05 || Math.abs(v) > 0.05;
    e.gaitPhase = (e.gaitPhase || 0) + (0.2 + Math.abs(thr)) * 8 * dt;
  }
  Object.assign(RULES, { boat });
}
