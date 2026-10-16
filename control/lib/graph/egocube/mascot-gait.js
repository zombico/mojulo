/**
 * MASCOT GAITS: a mascot on foot. Its walk and its run as clips on its own rig (the `feet` and `sink` channels the hero's
 * locomotion bakes with: station-loft-rig.js), sized by its own legs, never by a person's:
 *
 *   the leg      hip height over the toe line; the reach is femur + tibia (a leg is never asked past REACH of it)
 *   the stride   how far a planted foot slides back under the body in one stance, a share of the leg (STRIDE), cut to
 *                what the leg reaches with the root sunk no more than SINK of the leg: a short leg takes short steps. It
 *                is centred where the ANKLE passes under the hip (a mascot's big shoe puts its toe well ahead of it)
 *   the cadence  the cycle (two steps) a pendulum of that leg swings in: a person's second at 0.9 m of leg, so a cycle
 *                goes as √(leg / 0.9), never under MIN_CYCLE; the run's is RUN_CYCLE of the walk's
 *   the duty     the share of the cycle a foot is down: a walk's DUTY.walk (both feet down twice a cycle), a run's
 *                DUTY.run (both feet up twice a cycle: the root rises through the flight)
 *   the travel   the ground the cycle covers, stride ÷ duty: at speed travel ÷ seconds a planted foot stays put
 *
 * The sink at each key is the least that lets both legs reach their targets (a planted foot fore or aft, the swing foot
 * on its arc), solved from the leg's own lengths, plus the energy's bob. The arms swing against the legs. The energy
 * (law 10, mascot.md) flavours it: bouncy bobs, zippy leans in and trails its arms when it runs, sturdy waddles wide,
 * swaying sways, floaty barely touches down.
 *
 *   gaitMeasures(J, energy)    → { leg, reach, stride, seconds, duty, travel, speed } per gait
 *   gaitClips(J, energy, arms) → { walk, run }: each a cycle of KEYS keys, looping, in place
 *   mascotGaits(plan, energy)  → the measures off a stored mascot plan (its rig's joints): what a game plays them at
 *
 * Pure and deterministic.
 */
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const sub = (a, b) => a.map((x, i) => x - b[i]);
const len = (a) => Math.hypot(...a);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const KEYS = 8;
export const REACH = 0.96;
export const STRIDE = Object.freeze({ walk: 0.9, run: 1.5 });
export const SINK = Object.freeze({ walk: 0.14, run: 0.24 });
export const DUTY = Object.freeze({ walk: 0.6, run: 0.36 });
export const MIN_CYCLE = 0.38;
export const RUN_CYCLE = 0.72;
export const CLEAR = 0.18;   // the swing toe's height mid-swing, a share of the leg (a cartoon step lifts high)
/** the energy's flavour: an extra bob (a share of the leg), a lean (the spine's curl), a waddle (the stance widened and a
 * side bend), the arms' swing, a float (the root held up, a share of the leg) */
export const FLAVOUR = Object.freeze({
  bouncy: { bob: 0.07, curl: 0.04, stance: 1, sway: 0, swing: 0.35, float: 0 },
  zippy: { bob: 0.02, curl: 0.14, stance: 1, sway: 0, swing: 0.45, float: 0, trail: true },
  floaty: { bob: 0.01, curl: 0.02, stance: 1, sway: 0, swing: 0.25, float: 0.06 },
  sturdy: { bob: 0.03, curl: 0.04, stance: 1.3, sway: 0.28, swing: 0.25, float: 0 },
  swaying: { bob: 0.03, curl: 0.03, stance: 1.05, sway: 0.2, swing: 0.3, float: 0 },
});

/** the leg's lengths off the right side's joints */
function legOf(J) {
  const femur = len(sub(J.knee, J.hip)), tibia = len(sub(J.ankle, J.knee));
  const metaVec = sub(J.ankle, J.toeBase), leg = J.hip[2] - J.toeBase[2];
  return { femur, tibia, reach: (femur + tibia) * REACH, fold: Math.abs(femur - tibia) * 1.08 + 1e-4, metaVec, leg, hipZ: J.hip[2], toeZ: J.toeBase[2], centre: J.hip[1] - J.ankle[1] };
}
/** the least sink that lets a hip reach a toe-base target (the hock above it at the rest metatarsus) */
function sinkFor(L, hip, target) {
  const hock = [target[0] + L.metaVec[0], target[1] + L.metaVec[1], target[2] + L.metaVec[2]];
  const dh = Math.hypot(hip[0] - hock[0], hip[1] - hock[1]);
  if (dh >= L.reach) return Infinity;
  return Math.max(0, hip[2] - hock[2] - Math.sqrt(L.reach * L.reach - dh * dh));
}

/** A gait's measures: the stride the leg reaches with the root sunk at most SINK of it, the cadence, the travel. */
export function gaitMeasures(J, energy = 'bouncy') {
  const L = legOf(J), Fl = FLAVOUR[energy] ?? FLAVOUR.bouncy, out = { leg: r4(L.leg), reach: r4(L.reach) };
  const walkCycle = Math.max(MIN_CYCLE, Math.sqrt(L.leg / 0.9));
  for (const gait of ['walk', 'run']) {
    // the stride the leg reaches: a foot at half a stride fore or aft, the hip sunk SINK of the leg
    const hip = [J.hip[0], 0, J.hip[2] - SINK[gait] * L.leg];
    let half = (STRIDE[gait] * L.leg) / 2; const y0 = J.toeBase[1] + L.centre;
    for (let i = 0; i < 40 && Math.max(sinkFor(L, hip, [J.toeBase[0] * Fl.stance, y0 + half, J.toeBase[2]]), sinkFor(L, hip, [J.toeBase[0] * Fl.stance, y0 - half, J.toeBase[2]])) > 1e-9; i++) half *= 0.95;
    const stride = 2 * half, seconds = gait === 'walk' ? walkCycle : walkCycle * RUN_CYCLE, travel = stride / DUTY[gait];
    out[gait] = { stride: r4(stride), seconds: r4(seconds), duty: DUTY[gait], travel: r4(travel), speed: r4(travel / seconds) };
  }
  return out;
}

const smooth = (t) => t * t * (3 - 2 * t);
/** where a foot is at local phase p (0 contact): down and sliding back through the duty, then swung forward on an arc */
function footAt(p, duty, stride, lift) {
  if (p < duty) return { y: stride / 2 - (stride * p) / duty, z: 0, down: true };
  const u = (p - duty) / (1 - duty);
  return { y: -stride / 2 + stride * smooth(u), z: lift * Math.sin(Math.PI * u), down: false };
}

/**
 * The walk and the run: KEYS keys a cycle, the right foot's contact at the first key, the left's half a cycle on. `arms`
 * the ready pose's arm words ({ armL, armR } as rigOf's READY), swung fore and aft against the legs.
 */
export function gaitClips(J, energy = 'bouncy', arms = {}) {
  const L = legOf(J), Fl = FLAVOUR[energy] ?? FLAVOUR.bouncy, M = gaitMeasures(J, energy), out = {};
  const toe = { R: [J.toeBase[0] * Fl.stance, J.toeBase[1], J.toeBase[2]], L: [-J.toeBase[0] * Fl.stance, J.toeBase[1], J.toeBase[2]] };
  const arm = (S, a) => { const w = arms[`arm${S}`] ?? { x: S === 'R' ? 0.55 : -0.55, y: 0.18, z: -0.8 }; return { x: w.x, y: r4(w.y + a), z: w.z }; };
  for (const gait of ['walk', 'run']) {
    const { stride, duty } = M[gait], lift = CLEAR * L.leg * (gait === 'run' ? 1.4 : 1), keys = [];
    for (let i = 0; i < KEYS; i++) {
      const ph = i / KEYS, feet = {}, at = {};
      for (const [S, off] of [['R', 0], ['L', 0.5]]) { const f = footAt((ph + off) % 1, duty, stride, lift); at[S] = f; feet[S] = [r4(toe[S][0]), r4(toe[S][1] + L.centre + f.y), r4(toe[S][2] + f.z)]; }
      // the run's flight: both feet up, the root rising through it
      const q = ph % 0.5, up = !at.R.down && !at.L.down && q >= duty ? 0.06 * L.leg * Math.sin((Math.PI * (q - duty)) / (0.5 - duty)) : 0;
      // the least sink both legs reach at, and the energy's bob (two dips a cycle, at each contact)
      const hip = (S) => [S === 'R' ? J.hip[0] : -J.hip[0], 0, J.hip[2] + up + Fl.float * L.leg];
      const need = Math.max(sinkFor(L, hip('R'), feet.R), sinkFor(L, hip('L'), feet.L));
      const bob = Fl.bob * L.leg * (1 + Math.cos(4 * Math.PI * ph)) / 2;
      const sink = clamp(Number.isFinite(need) ? need : SINK[gait] * L.leg, 0, 0.5 * L.leg) + bob;
      // the swing foot lifted no higher than the leg folds: a short-thighed leg cannot draw its foot up to its hip
      for (const S of ['R', 'L']) {
        const h = hip(S), at0 = (z) => [feet[S][0], feet[S][1], z], d = (z) => len(sub([h[0], h[1], h[2] - sink], at0(z).map((v, k) => v + L.metaVec[k])));
        let z = feet[S][2]; for (let n = 0; n < 30 && z > toe[S][2] && d(z) < L.fold; n++) z = toe[S][2] + (z - toe[S][2]) * 0.8;
        if (z !== feet[S][2]) feet[S] = [feet[S][0], feet[S][1], r4(d(toe[S][2]) < L.fold ? toe[S][2] : z)];
      }
      // the arms against the legs: the right arm forward as the left foot is
      const swing = (gait === 'run' ? 1.5 : 1) * Fl.swing, aR = swing * (at.L.y ?? 0) / Math.max(1e-6, stride / 2), aL = swing * (at.R.y ?? 0) / Math.max(1e-6, stride / 2);
      const trail = gait === 'run' && Fl.trail;
      const key = {
        feet, sink: r4(sink), ...(up + Fl.float * L.leg > 0 ? { lift: r4(up + Fl.float * L.leg) } : {}),
        // (a trail is the arms swept back, nearly straight: a bent elbow would fold the hands forward again)
        armR: trail ? { x: 0.35, y: -0.8, z: -0.5 } : arm('R', aR), armL: trail ? { x: -0.35, y: -0.8, z: -0.5 } : arm('L', aL),
        ...(gait === 'run' && !trail ? { elbowL: 'half', elbowR: 'half' } : { elbowL: 'slight', elbowR: 'slight' }),
        spine: { curl: r4(Fl.curl * (gait === 'run' ? 1.6 : 1)), ...(Fl.sway ? { sideBend: [at.R.down && at.R.y > -stride / 4 ? 'right' : 'left', r4(Fl.sway * Math.abs(Math.sin(2 * Math.PI * ph)))] } : {}) },
      };
      keys.push(key);
    }
    out[gait] = keys;
  }
  return out;
}

/** The measures off a stored mascot plan (its rig's right-side joints): a game plays a gait at its `speed`. */
export function mascotGaits(plan, energy = 'bouncy') {
  const J = plan?.rig?.joints, at = (n) => (Array.isArray(J?.[n]) ? J[n] : J?.[n]?.at);
  const R = { hip: at('hip$S') ?? at('hipR'), knee: at('knee$S') ?? at('kneeR'), ankle: at('ankle$S') ?? at('ankleR'), toeBase: at('toeBase$S') ?? at('toeBaseR') };
  if (!R.hip || !R.knee || !R.ankle || !R.toeBase) return null;
  return gaitMeasures(R, energy);
}
