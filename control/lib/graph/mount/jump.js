/**
 * jump — a mount over a fence from the canter, back to the canter: a one-shot on the schedule poser (schedule.js) with
 * its own footfalls and a body that FLIES. After the show-jumping record (MUYBRIDGE 1887's jumping plates; Clayton &
 * Barlow's take-off and landing kinematics, in BACK & CLAYTON 2013), at the level a sheet can be held to:
 *
 *  - THE FLIGHT from the fence: the centre of mass must peak a tucked leg's depth over the rail, so the launch's
 *    upward speed is √(2g·rise); the airtime and the ground flown follow (lengthened for a spread fence). In the air
 *    the centre of mass falls at g exactly and the trunk turns at a constant rate from nose-up to nose-down.
 *  - THE TAKE-OFF STRIDE, quicker than a canter stride: the trailing hind's last approach beat short, the forelimbs
 *    planting in their canter slots (trailing, then leading) to lift the forehand, the hinds landing close together under the
 *    body as the forelimbs leave and launching it.
 *  - THE LANDING: the trailing fore, the leading fore, then the hinds, which are the first beat of the canter away.
 *  - THE BODY: the canter's into the launch (a quintic matching the canter's state and the launch's: position, speed,
 *    and the fall at g it leaves with), the flight, a quintic from the landing back into the canter; the back rounds
 *    over the fence and opens on landing; the neck lifts at take-off, stretches down over the fence (the bascule) and
 *    lifts to land.
 *  - Each footfall of the take-off and the landing is placed where its leg's reach is even through its stance; in the
 *    air the forelimbs fold tight and the hinds trail, then come through.
 *
 *   jumpClip(B, { fence, spread, lead, speed }) → a one-shot: { kind: 'jump', duration, poseAt, rootAt, stances, fence,
 *   entry, exit, A, B } (fence in metres; spread the depth of an oxer, 0 an upright)
 */
import { G, MECHANICS, HIP } from './reference.js';
import { gaitCycle } from './gait.js';
import { hoofForce } from './load.js';
import { schedulePoser } from './schedule.js';
import { sub, len } from './limb.js';

const DEG = Math.PI / 180;
const IDS = ['LF', 'RF', 'LH', 'RH'];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (v) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(v));
const S5 = (u) => { u = clamp01(u); return u * u * u * (10 - 15 * u + 6 * u * u); };
const lerp = (a, b, s) => a + (b - a) * s;
const MIRROR = { LF: 'RF', RF: 'LF', LH: 'RH', RH: 'LH' };

/** a quintic on [0, T] from (p0, v0, a0) to (p1, v1, a1): its value at τ */
function quintic(p0, v0, a0, p1, v1, a1, T) {
  const c0 = p0, c1 = v0, c2 = a0 / 2;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T, T5 = T4 * T;
  const d0 = p1 - (c0 + c1 * T + c2 * T2), d1 = v1 - (c1 + 2 * c2 * T), d2 = a1 - 2 * c2;
  const c3 = (10 * d0 - 4 * d1 * T + d2 * T2 / 2) / T3;
  const c4 = (-15 * d0 + 7 * d1 * T - d2 * T2) / T4;
  const c5 = (6 * d0 - 3 * d1 * T + d2 * T2 / 2) / T5;
  return (t) => c0 + c1 * t + c2 * t * t + c3 * t ** 3 + c4 * t ** 4 + c5 * t ** 5;
}
/** value, rate and acceleration of f at t (central differences) */
const state = (fn, t, h = 1e-3) => [fn(t), (fn(t + h) - fn(t - h)) / (2 * h), (fn(t + h) - 2 * fn(t) + fn(t - h)) / (h * h)];
/** a curve through keyed values [t, v], eased between them (zero slope at each key) */
const keyed = (keys) => (t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], ease((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};

export function jumpClip(B, { fence = 1.0, spread = 0, lead = 'right', speed } = {}) {
  const C = gaitCycle(B, 'canter', { lead, speed });
  const v = C.speed, f = C.f, T = 1 / f, k = B.scale;
  const L = (id) => (lead === 'left' ? MIRROR[id] : id);      // the right lead's limb names, mirrored for a left lead
  const rootAt = (t) => v * t;
  const limb = (id) => C.limbs.find((l) => l.id === id);

  // THE FLIGHT
  const zCom = B.trunk.com[1], tuck = 0.88 * k;          // the centre of mass's margin over the rail: a folded body's depth
  // the launch high (the hinds extended behind, the trunk pitched up), the first fore contact a little lower
  const zL = zCom + 0.20 * k, zTd = zCom + 0.10 * k;
  // a spread fence peaks higher too: its back rail is crossed with the body already falling
  let vz = Math.sqrt(2 * G * Math.max(0.1, fence + tuck + 0.3 * spread - zL));
  const airtime = (w) => (w + Math.sqrt(w * w + 2 * G * (zL - zTd))) / G;
  while (v * airtime(vz) < spread + 3.0 * k) vz += 0.05;      // a spread fence asks for a longer flight
  const Tf = airtime(vz);
  // the trunk's pitch: at its most nose-up (PEAK) in the hinds' push, already turning forward as it leaves the ground,
  // nose-down to land; the launch's angle is solved so the take-off's quintic peaks at PEAK, not past it
  const pitchMax = (12 + 15 * fence) * DEG, pitchTd = -(8 + 10 * fence) * DEG;
  let pitchL = pitchMax * 0.7, omega = (pitchTd - pitchL) / Tf;

  // THE FOOTFALLS (the right lead's names; times in seconds): the approach canter from its phase, then the take-off
  // stride, the flight, the landing, the canter away
  const t0 = T;                                                // the take-off stride opens one canter stride in
  const slot = (id) => limb(L(id)).phase * T;
  const S = {};
  S.LHa = { on: t0 + slot('LH'), dur: 0.15 }; S.RHa = { on: t0 + slot('RH'), dur: 0.15 };
  S.LFt = { on: t0 + slot('LF'), dur: 0.17 }; S.RFt = { on: t0 + slot('RF'), dur: 0.17 };
  S.LHt = { on: S.RFt.on + 0.20, dur: 0.22 }; S.RHt = { on: S.RFt.on + 0.24, dur: 0.22 };
  const tLaunch = S.RHt.on + S.RHt.dur, tTd = tLaunch + Tf;
  S.LFl = { on: tTd, dur: 0.16 }; S.RFl = { on: tTd + 0.07, dur: 0.18 };
  // the canter away: its LH beat is the landing's first hind
  const tAway = tTd + 0.28;
  const thetaB0 = tAway;                                       // the away canter's phase 0 (LH's touchdown)
  const tEnd = thetaB0 + 2 * T;                                // two strides of the canter away
  const stances = {};
  const canterStance = (id, n, origin) => { const on = origin + (n + limb(L(id)).phase) * T, d = C.duty * T; return { on, off: on + d, y: rootAt(on) + v * d / 2 + limb(L(id)).yc, x: limb(L(id)).x }; };
  for (const id of IDS) {
    const before = [], after = [];
    for (let n = -2; n <= 0; n++) before.push(canterStance(id, n, 0));
    // the trailing hind marks the shortened take-off stride; the leading hind carries straight on to its take-off spot
    const takeoff = id === 'LH' ? [S.LHa, S.LHt] : [S[`${id}t`]];
    const land = id[1] === 'F' ? [S[`${id}l`]] : [];
    for (let n = 0; n <= 3; n++) after.push(canterStance(id, n, thetaB0));
    if (id[1] === 'H') after[0] = { ...after[0], explicit: true, landing: true };   // the first hinds down out of the air
    stances[L(id)] = [...before, ...takeoff.map((q) => ({ on: q.on, off: q.on + q.dur, explicit: true })), ...land.map((q) => ({ on: q.on, off: q.on + q.dur, explicit: true })), ...after];
  }

  // THE BODY
  const tb0 = S.LHa.on - 0.05, tb1 = tAway + 0.5 * T;
  const canter = (key) => (t) => C.bodyFull(f * t)[key];
  const canterAway = (key) => (t) => C.bodyFull(f * (t - thetaB0))[key];
  const flightZ = (t) => zL + vz * (t - tLaunch) - 0.5 * G * (t - tLaunch) ** 2;
  const flightP = (t) => pitchL + omega * (t - tLaunch);
  const [z0, dz0, ddz0] = state(canter('z'), tb0), [p0, dp0, ddp0] = state(canter('pitch'), tb0);
  // the rise in two pushes: the forelimbs lift the forehand (the body starting up as the hinds land), then the hinds
  // drive it over their stance to the launch, the crouch the depth that drive asks (its mean speed over the push)
  // (no deeper than a crouch: a higher fence is a harder push, not a lower body)
  const tH = S.LHt.on, vzMid = 0.8 * Math.sqrt(k), zMid = Math.max(zCom - 0.22 * k, zL - (vzMid + vz) / 2 * (tLaunch - tH));
  const upZ1 = quintic(z0, dz0, ddz0, zMid, vzMid, 0, tH - tb0), upZ2 = quintic(zMid, vzMid, 0, zL, vz, -G, tLaunch - tH);
  const upZ = (tau) => (tau < tH - tb0 ? upZ1(tau) : upZ2(tau - (tH - tb0)));
  const peakOf = (pl) => { const w = (pitchTd - pl) / Tf, q = quintic(p0, dp0, ddp0, pl, w, 0, tLaunch - tb0); let m = -Infinity; for (let i = 0; i <= 60; i++) m = Math.max(m, q((tLaunch - tb0) * i / 60)); return m; };
  { let lo = -0.2, hi = pitchMax; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (peakOf(m) > pitchMax) hi = m; else lo = m; } pitchL = (lo + hi) / 2; omega = (pitchTd - pitchL) / Tf; }
  const upP = quintic(p0, dp0, ddp0, pitchL, omega, 0, tLaunch - tb0);
  const [z1, dz1, ddz1] = state(canterAway('z'), tb1), [p1, dp1, ddp1] = state(canterAway('pitch'), tb1);
  // the landing in two: the forelimbs take the fall over their stances (to a low point, still), then the canter away
  // (no deeper than a crouch: a higher fence is a harder landing, not a lower body)
  const tAbs = S.RFl.on + S.RFl.dur, vTd = vz - G * Tf, zLow = Math.max(zCom - 0.25 * k, flightZ(tTd) + vTd / 2 * (tAbs - tTd));
  const downZ1 = quintic(flightZ(tTd), vTd, -G, zLow, 0, 0, tAbs - tTd), downZ2 = quintic(zLow, 0, 0, z1, dz1, ddz1, tb1 - tAbs);
  const downZ = (tau) => (tau < tAbs - tTd ? downZ1(tau) : downZ2(tau - (tAbs - tTd)));
  const downP = quintic(flightP(tTd), omega, 0, p1, dp1, ddp1, tb1 - tTd);
  const tApex = tLaunch + vz / G;
  // when the hips pass over the fence (the hind girdle crosses a hip's length after the centre of mass): the hind tuck
  // peaks as its hooves (tucked forward of the hips) reach the front rail, and holds over a spread
  const tHips = tApex + (0.1 * k - B.trunk.hip[0]) / v;
  const psiKey = keyed([[tb0, 0], [S.LHt.on + 0.1, 10 * DEG], [tApex, 6 * DEG], [tTd, -4 * DEG], [tb1, 0]]);
  const nuKey = keyed([[tb0, 0], [tLaunch, 6 * DEG], [tApex, -18 * DEG], [tTd + 0.05, 10 * DEG], [tb1, 0]]);
  // the canter's own sway, roll, tail and the rest fade out into the take-off and back in after the landing
  const air = (t) => (t < tLaunch ? S5((t - tb0) / (tLaunch - tb0)) : t < tTd ? 1 : 1 - S5((t - tTd) / (tb1 - tTd)));
  const bodyAt = (t) => {
    const from = t < tLaunch ? C.bodyFull(f * t) : C.bodyFull(f * (t - thetaB0)), w = air(t);
    const out = { ...from };
    for (const key of ['sway', 'rollF', 'rollH', 'lat', 'tau', 'nu', 'psi']) out[key] = from[key] * (1 - w);
    out.psi += psiKey(t) * (t <= tb0 || t >= tb1 ? 0 : 1);
    out.nu += nuKey(t) * (t <= tb0 || t >= tb1 ? 0 : 1);
    if (t <= tb0) { out.z = from.z; out.pitch = from.pitch; }
    else if (t < tLaunch) { out.z = upZ(t - tb0); out.pitch = upP(t - tb0); }
    else if (t < tTd) { out.z = flightZ(t); out.pitch = flightP(t); }
    else if (t < tb1) { out.z = downZ(t - tTd); out.pitch = downP(t - tTd); }
    out.headCounter = lerp(0.5, 0.15, w);                     // the head follows the neck down over the fence
    return out;
  };

  // LOADS and BREAKOVER: the canter's share in its stances; the take-off and the landing load harder
  const Is = 2 / Math.PI;
  const limbAt = (id) => limb(id);
  const loadOf = (id, st, t) => {
    const u = (t - st.on) / (st.off - st.on);
    const A = st.explicit ? (id[1] === 'F' ? (st.on > tLaunch ? 1.6 : 1.0) : st.landing ? 1.0 : 1.2) : limb(id).share / (C.duty * Is);
    return hoofForce(Math.min(u, 0.999999), A, 0);
  };
  const bo = MECHANICS.breakover, boPitch = MECHANICS.breakoverPitch * DEG;
  const etaOf = (id, st, t) => { const w = (t - st.on) / (st.off - st.on); return w > 1 - bo ? -boPitch * ease((w - (1 - bo)) / bo) : 0; };
  // the swings: the canter's, but the flight's: the forelimbs folded tight, the hinds trailing and then coming through
  const swingParams = (id, a, b) => {
    const pair = id[1] === 'F' ? 'fore' : 'hind';
    if (a.off <= tLaunch + 1e-9 && b.on >= tTd - 1e-9) {
      // the tuck peaks over the fence (the apex) and holds: the forelimbs snap up tight, the hinds come up later
      const at = (t) => Math.min(0.85, Math.max(0.15, (t - a.off) / (b.on - a.off)));
      return pair === 'fore'
        ? { lift: 0.55 * k, fold: { carpus: 130, fetlock: 70, peak: at(tApex - 0.05), k: B.motion.fold }, follow: true, hold: 0.8 + 0.4 * spread, floor: true }
        : { lift: 0.55 * k, forward: 0.4 * k, fold: { carpus: 0, fetlock: 70, peak: at(tHips - (spread / 2 + 0.4 * k) / v), k: B.motion.fold }, follow: true, hold: 0.8 + 0.4 * spread, floor: true };
    }
    // the hinds coming forward into the take-off under a crouching body: a little higher, tucked forward, floored
    if (pair === 'hind' && b.explicit && b.on < tLaunch) return { lift: C.lift.hind + 0.08 * k, forward: 0.35 * k, fold: { ...C.fold, k: B.motion.fold }, floor: true };
    // the first swings out of the landing, under a body still low from it: floored
    if (a.explicit && a.on > tLaunch) return { lift: C.lift[pair], fold: { ...C.fold, k: B.motion.fold }, floor: true };
    return { lift: C.lift[pair], fold: { ...C.fold, k: B.motion.fold } };
  };
  const poser = schedulePoser(B, { stances, rootAt, bodyAt, limbAt, loadOf, etaOf, swingParams });

  // PLACE each explicit footfall where its leg's reach is even through its stance (searched along the ground)
  for (const id of IDS) for (const st of stances[id]) {
    if (!st.explicit) continue;
    st.x = limb(id).x;
    let best = null, bestU = Infinity;
    for (let dy = -1.2; dy <= 1.6 + 1e-9; dy += 0.04) {
      st.y = rootAt(st.on) + dy * k;
      let u = -Infinity, over = 0;
      for (let j = 0; j <= 8; j++) {
        const t = st.on + (st.off - st.on) * (j / 8) * 0.999 + 1e-7, bd = bodyAt(t), s2 = poser.stanceState(id, st, t, bd);
        const from = id[1] === 'F' ? s2.solve.S : poser.rig.girdle({ ...limb(id), x: st.x }, bd, st.x);
        u = Math.max(u, len(sub(s2.distal.F, from)) - (id[1] === 'F' ? poser.rig.reachF : poser.rig.reachH));
        // a hind's hip kept in its range through the stance (a footfall too far under a body pitched nose-down to land
        // would flex it past it): the excess counts against the spot, in metres per radian of the hind's length
        if (id[1] === 'H') over = Math.max(over, poser.rig.hipFlex({ ...limb(id), x: st.x }, bd, s2.solve.angles.femur, st.x) - (HIP.flex - HIP.knee) * DEG);
      }
      if (over > 0) u += over * (B.hindL.femur + B.hindL.tibia + B.hindL.cannon);
      if (u < bestU) { bestU = u; best = st.y; }
    }
    st.y = best;
  }

  const fenceAt = { y: rootAt(tApex) + 0.1 * k, height: fence, spread };
  const poseAt = (t) => { const p = poser.poseAt(t); p.fence = { ...fenceAt, y: fenceAt.y - p.root }; return p; };
  return {
    kind: 'jump', from: 'canter', to: 'canter', lead, duration: tEnd, poseAt, rootAt, stances, fence: fenceAt,
    A: C, B: C, entry: { gait: 'canter', phase: 0 }, exit: { gait: 'canter', phase: 0 },
    flight: { launch: tLaunch, touchdown: tTd, apex: tApex, vz, airtime: Tf, distance: v * Tf },
  };
}
