/**
 * THE RAIL — an arcade flier carried down a stage's path (opt-in: composed into a page only when an entity's rule is
 * `rail`). Flight as a concept, not a simulation: the stage sets the speed and the way, the player steers the craft
 * about the way and fights.
 *
 *   • THE PATH: `path` [[x, y, z], …] metres, its points in order; the craft's frame moves along it at `speed` (m/s), its
 *     distance along it `along` (a fact: the stage's waves are woken by it, a gauge's `along`). At the path's end the
 *     frame stops there (`railEnd`): the boss's arena, held round its last point.
 *   • THE BOX: the stick moves the craft about the path inside `box` { hx, hz } (metres right and left, up and down):
 *     A / D across (`turn`), Space / Shift up and down (`lift`), at `sway` m/s (not `steer`: that word is the car's wheels, worlds/controllable/steer.js), eased in by `agility` (per second). At
 *     a side of the box it stops; the box's sides are the way's edges, never a crash.
 *   • THE FLOOR (`floor`, metres; absent in space): the craft is never lower than that over the ground under it. Ground
 *     rising under it lifts it: the ground is a floor, never a crash. What hurts is what stands in the way (a wall, an
 *     arch, a pillar, a foe's round), and that is the level's to say (its hazards and hits, on the bus).
 *   • THE THROTTLE: W boosts (`boost` { mul?, time?, recharge? }: faster while its meter lasts), S brakes (`brake` {
 *     mul? }: slower, from the same meter); emptied, it stays shut until the key is let go. `boosting`, `braking`,
 *     `boostE` (the meter) are facts.
 *   • THE ROLL (`roll` { time?, side?, cooldown? }, the fly rule's): Q / E rolls the craft a full turn, carrying it
 *     `side` m that way (inside the box), and it takes no hits while it rolls (`rolling`, `invincible`).
 *
 * The attitude follows the steer: banked into a move across, the nose up or down into a move up or down, turned a
 * little toward it (the mesh sync draws `tilt`). Facts as the fly rule's where they mean the same (airspeed, bank,
 * airborne, locomotion 'fly', climbRate, gaitPhase), so the HUD, the camera and the gauges read a rail as a flight.
 *
 * A FOE ON STATION (`ai` with `rule.station`, wrapped here as foe.js wraps it): a stage's fighter rides the same path as
 * the craft it fights, held ahead of it, so a wave is met in front and never chases from behind.
 *   station  { of?, lead, at?: [x, z], weave?: [ax, az, period], phase?, stay?, close? }   `of` the craft (its `rule.path`
 *            and its `along`; the pilot when absent); `lead` m ahead of it, straight down the way's heading where the
 *            craft is (a bend never puts it off the craft's nose), closed at `close` (per s) from where it was posted; `at` its place in the box (metres right and up of the way; where it was posted when
 *            absent), weaving about it (`weave`: metres across and up, a period in s; `phase` its share of the swing);
 *            facing the craft, its trigger pulled in its `burst` and let go in its `pause` (the rule's own words) while
 *            the craft is in its gun's range; after `stay` s it peels off, ahead and up, and is gone. A body down, gone
 *            or asleep is the mind's as ever; a craft with no rail leaves it to the mind too.
 *   Facts: stAlong, stOff, stT (the craft's along plus its distance ahead, its place in the box, its time on station),
 *   aiFire.
 *
 * Pure + deterministic; reads the input snapshot and world.ground, writes only its entity.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function.
 */

export function buildRulesRail(E) {
  const { clamp, RULES } = E;

  // the path's lengths so far, once an entity (cached on it: the path is its rule's and never moves)
  function lengths(P) {
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
    return cum;
  }
  // the frame at `s` along it: the point, and the unit tangent of the leg it is on
  function frameAt(P, cum, s) {
    const L = cum[cum.length - 1];
    s = clamp(s, 0, L);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], seg = cum[hi] - cum[lo] || 1, f = (s - cum[lo]) / seg;
    const tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg, tz = (b[2] - a[2]) / seg;
    return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], t: [tx, ty, tz] };
  }

  function rail(e, input, dt, world) {
    const r = e.rule, t = e.transform, P = r.path;
    if (!Array.isArray(P) || P.length < 2) return;
    if (!e.railCum) e.railCum = lengths(P);
    const cum = e.railCum, L = cum[cum.length - 1];

    // ── the throttle: the stage's speed, boosted or braked from one meter ──
    let mul = 1;
    const B = r.boost;
    if (B) {
      const full = B.time ?? 3;
      if (e.boostE == null) e.boostE = full;
      const fwd = input.forward || 0;
      // (emptied, the meter is shut until the key is let go: a sliver refilled while it is held does not flicker it on)
      if (fwd === 0) e.boostShut = false;
      e.boosting = fwd > 0 && e.boostE > 0 && !e.boostShut;
      e.braking = fwd < 0 && e.boostE > 0 && r.brake !== false && !e.boostShut;
      if (e.boosting) mul = B.mul ?? 1.7;
      else if (e.braking) mul = (r.brake && r.brake.mul) ?? 0.5;
      if (e.boosting || e.braking) { e.boostE = Math.max(0, e.boostE - dt); if (e.boostE === 0) e.boostShut = true; }
      else e.boostE = Math.min(full, e.boostE + (B.recharge ?? 0.6) * dt);
    }
    const v = (r.speed > 0 ? r.speed : 60) * mul;
    const was = e.along ?? (r.start || 0);
    e.along = Math.min(L, was + v * dt);
    e.railEnd = e.along >= L - 1e-6;
    const F = frameAt(P, cum, e.along);

    // ── the steer: an offset about the path (right, up), moved by the stick, eased in ──
    const box = r.box || {}, hx = box.hx ?? 30, hz = box.hz ?? 18, steer = r.sway > 0 ? r.sway : 28;
    const k = Math.min(1, (r.agility ?? 6) * dt);
    if (!e.railV) e.railV = [0, 0];
    if (!e.off) e.off = [0, 0];
    const wantX = clamp(input.turn || 0, -1, 1) * steer, wantZ = clamp(input.lift || 0, -1, 1) * steer;
    e.railV[0] += (wantX - e.railV[0]) * k;
    e.railV[1] += (wantZ - e.railV[1]) * k;
    // the barrel roll (the fly rule's): a full turn, carried `side` m that way, unhurt while it lasts
    let spin = 0, shove = 0;
    if (r.roll) {
      const R = r.roll, T = R.time ?? 0.6, sIn = Math.sign(input.strafe || 0);
      if (e.rollCd > 0) e.rollCd = Math.max(0, e.rollCd - dt);
      if (!(e.rollT > 0) && sIn && !e.strafePrev && !(e.rollCd > 0)) { e.rollT = T; e.rollDir = sIn; e.rollCd = R.cooldown ?? 1.2; }
      if (e.rollT > 0) {
        const step = Math.min(dt, e.rollT);
        shove = e.rollDir * ((R.side ?? 14) / T) * step;
        e.rollT -= step;
        spin = e.rollDir * 2 * Math.PI * (1 - Math.max(0, e.rollT) / T);
      }
      e.rolling = e.rollT > 0; e.invincible = e.rolling;
      e.strafePrev = !!sIn;
    }
    e.off[0] = clamp(e.off[0] + e.railV[0] * dt + shove, -hx, hx);
    e.off[1] = clamp(e.off[1] + e.railV[1] * dt, -hz, hz);
    if (Math.abs(e.off[0]) >= hx && e.railV[0] * e.off[0] > 0) e.railV[0] = 0;   // at a side: stopped there
    if (Math.abs(e.off[1]) >= hz && e.railV[1] * e.off[1] > 0) e.railV[1] = 0;

    // ── where it is: the path's point, the offset across (level, square to the way) and up ──
    const hl = Math.hypot(F.t[0], F.t[1]) || 1, rx = F.t[1] / hl, ry = -F.t[0] / hl;
    const x = F.p[0] + rx * e.off[0], y = F.p[1] + ry * e.off[0];
    let z = F.p[2] + e.off[1], under = null;
    // the floor: never under it over the ground beneath; the ground lifts it, it is never a crash
    if (Number.isFinite(r.floor) && world && world.ground) {
      const g = world.ground([x, y, z + (r.probe ?? 400)]);
      under = g;
      if (g != null && z < g + r.floor) {
        z = g + r.floor;
        e.off[1] = z - F.p[2];
        if (e.railV[1] < 0) e.railV[1] = 0;
      }
    }
    const lastZ = t.pos[2];
    t.pos[0] = x; t.pos[1] = y; t.pos[2] = z;

    // ── the attitude: along the way, turned and pitched a little into the steer, banked into a move across ──
    const sx = e.railV[0] / steer, sz = e.railV[1] / steer;
    t.heading = Math.atan2(F.t[1], F.t[0]) - sx * (r.yawInto ?? 0.3);
    t.pitch = Math.asin(clamp(F.t[2], -1, 1)) + sz * (r.pitchInto ?? 0.35);
    e.bank = sx * (r.bankInto ?? 0.9);
    e.tilt = { pitch: t.pitch, roll: e.bank + spin };

    // ── the facts a flight's reader takes ──
    e.airspeed = v;
    e.airborne = true;
    e.locomotion = 'fly';
    e.climbRate = dt > 0 ? (z - lastZ) / dt : 0;
    e.agl = under != null ? z - under : null;
    e.gaitPhase = (e.gaitPhase || 0) + (1 + (e.boosting ? 1 : 0)) * 3 * dt;
    e.moving = true;
  }

  // ── a foe on station: held ahead of the craft down its path, facing it, firing in bursts ──
  function station(e, dt, world) {
    const S = e.rule.station, T = world && world.byId ? world.byId[S.of || world.pilotId] : null;
    if (!T || T.gone || !T.rule || !Array.isArray(T.rule.path) || T.rule.path.length < 2 || !Number.isFinite(T.along)) return false;
    const P = T.rule.path;
    if (!T.railCum) T.railCum = lengths(P);
    const cum = T.railCum, t = e.transform, q = T.transform.pos;
    const across = (F) => { const hl = Math.hypot(F.t[0], F.t[1]) || 1; return [F.t[1] / hl, -F.t[0] / hl]; };
    if (e.stAlong == null) {
      // (taken on where it was posted: a distance ahead of the craft, its place about the way there)
      const F0 = frameAt(P, cum, T.along), R0 = across(F0), d0 = [t.pos[0] - F0.p[0], t.pos[1] - F0.p[1], t.pos[2] - F0.p[2]];
      const ahead0 = d0[0] * F0.t[0] + d0[1] * F0.t[1] + d0[2] * F0.t[2];
      e.stAlong = T.along + Math.max(0, ahead0);
      e.stOff = [d0[0] * R0[0] + d0[1] * R0[1], t.pos[2] - (F0.p[2] + F0.t[2] * Math.max(0, ahead0))];
      e.stT = 0;
    }
    e.stT += dt;
    const v = T.airspeed || 0, gone = S.stay != null ? e.stT - S.stay : -1;
    // the way: closed toward its lead ahead of the craft; peeling off, run on ahead of it
    const want = T.along + S.lead + (gone > 0 ? gone * 0.8 * v : 0);
    e.stAlong = Math.max(T.along, e.stAlong + (v + (S.close ?? 0.8) * (want - e.stAlong)) * dt);
    // its place in the box: eased to `at`, weaving about it; peeling off, up and away
    const at = S.at || e.stOff, k = Math.min(1, 1.5 * dt);
    e.stOff = [e.stOff[0] + (at[0] - e.stOff[0]) * k, e.stOff[1] + (at[1] - e.stOff[1]) * k];
    const W = S.weave, w = W ? (2 * Math.PI) / (W[2] || 4) : 0, ph = (S.phase || 0) * 2 * Math.PI;
    const ox = e.stOff[0] + (W ? W[0] * Math.sin(w * e.stT + ph) : 0), oz = e.stOff[1] + (W ? W[1] * Math.sin(0.77 * w * e.stT + ph) : 0) + (gone > 0 ? 40 * gone : 0);
    // (straight ahead of the craft down its own heading on the way, so a bend never puts it off the craft's nose)
    const F = frameAt(P, cum, T.along), R = across(F), ah = e.stAlong - T.along;
    t.pos[0] = F.p[0] + F.t[0] * ah + R[0] * ox; t.pos[1] = F.p[1] + F.t[1] * ah + R[1] * ox; t.pos[2] = F.p[2] + F.t[2] * ah + oz;
    // facing the craft; its trigger in bursts while the craft is in range
    const dx = q[0] - t.pos[0], dy = q[1] - t.pos[1], dz = q[2] - t.pos[2], d = Math.hypot(dx, dy, dz);
    t.heading = Math.atan2(dy, dx); t.pitch = Math.atan2(dz, Math.hypot(dx, dy) || 1e-6);
    const burst = e.rule.burst ?? 0.4, cyc = burst + (e.rule.pause ?? 2), range = e.weapon ? e.weapon.range ?? 0 : 0;
    e.aiFire = gone < 0 && world.aiEnabled !== false && d <= range && ((e.stT + (S.phase || 0) * cyc) % cyc) < burst ? 1 : 0;
    e.moving = true; e.locomotion = 'fly'; e.airborne = true; e.airspeed = v;
    if (gone > 4) { e.gone = true; e.aiFire = 0; }
    return true;
  }

  Object.assign(RULES, { rail });
  const ai = RULES.ai;
  if (ai) RULES.ai = function stationAi(e, input, dt, world) {
    if (e.rule.station && !e.downed && !e.gone && !e.dormant && station(e, dt, world)) return;
    ai(e, input, dt, world);
  };
}
