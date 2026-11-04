/**
 * legs — a mount's legs posed against a body, shared by the cycles (gait.js) and the one-shots (motion.js): the girdles
 * in the world, each leg's plane, the solves, the standing legs' comfortable reach, and the swing laid between the
 * stance it leaves and the one it lands in. A limb here is { id, pair: 'fore'|'hind', side: ±1, x } (x its hoof's line).
 *
 *   legRig(B) → { girdle3, planeOf, girdle, solve, swingX, reachF, reachH, reachHard }
 *   swingEnds(lo, lo0, td, td1, k) → the swing's ends and their rates (per unit of swing)
 *   swingLeg(B, rig, l, bd, sw, v, { lift, fold }) → { sol, distal, xh }
 */
import { MECHANICS, HIND_FETLOCK, LATERAL, HIP } from './reference.js';
import { solveFore, solveHind, hoofAt, hindReach, hindChain, foreReach, softReach, softMinReach, add, sub, mul, dir, ang, DOWN } from './limb.js';
import { bodyPoint, legPlane } from './pose.js';

const DEG = Math.PI / 180;
const ease = (v) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, v)));

export const STANCE_OPEN = { elbow: 152 * DEG, stifle: 152 * DEG };   // the most a loaded elbow and stifle open (≈)
export const KNEE_OPEN = 0.82, FETLOCK_OPEN = 0.76;   // where in the swing the knee's and the fetlock's folds have opened
export const TOE_UP = 6 * DEG;                        // the toe's lift as the hoof comes in to land (≈)
export const IMPACT = 0.7;
export const SWING_CLOSE = { elbow: 70 * DEG, stifle: 75 * DEG };   // the most an elbow and a stifle close in a swing (≈)   // the share of the ground's speed the swinging hoof matches before it lands (≈)

/** a smooth bump, 0 with zero slope at both ends, 1 at `peak` */
export const bump = (v, peak = 0.5) => { if (v <= 0 || v >= 1) return 0; const w = v ** (Math.log(0.5) / Math.log(peak)); return Math.sin(Math.PI * w) ** 2; };

/**
 * The swing's path along one axis: a quintic carries it from p0 to p1 (still at both ends), and two short terms, each
 * over `tau` of the swing at its end, add the stance's own velocity there (m0 leaving, m1 arriving, per unit of swing):
 * C1 at lift-off and touchdown, without the overshoot a cubic makes when the ground runs fast. Leaving, the hoof runs
 * on back a moment; arriving, it swings back to meet the ground (the swing's retraction). The caller passes the
 * touchdown's velocity at IMPACT of its share: the rest the hoof sheds on the ground in the first instant of contact.
 */
export function swingPath(p0, m0, p1, m1, v, tauLo = 0.08, tauTd = 0.12) {
  const S = v * v * v * (10 - 15 * v + 6 * v * v);
  const a = v < tauLo ? v * (1 - v / tauLo) ** 2 : 0;
  const w = 1 - v, b = w < tauTd ? -w * (1 - w / tauTd) ** 2 : 0;
  return p0 + (p1 - p0) * S + m0 * a + m1 * b;
}

export function legRig(B) {
  // a leg's girdle joint in the world, and its plane through the line its hoof stands on (x = xh)
  const girdle3 = (l, bd) => (l.pair === 'fore'
    ? bodyPoint(B, bd, [l.side * B.fore.girdleX, B.trunk.scapulaPivot[0], B.trunk.scapulaPivot[1]])
    : bodyPoint(B, bd, [l.side * B.hind.girdleX, B.trunk.hip[0], B.trunk.hip[1]], true));
  const planeOf = (l, bd, xh = l.x) => legPlane(girdle3(l, bd), xh);
  // the girdle in the leg's plane: [y, its height in the plane over the hoof's line]
  const girdle = (l, bd, xh = l.x) => { const pl = planeOf(l, bd, xh); return [pl.G[1], pl.D]; };
  const solve = (l, bd, target, carpus = 0, xh = l.x) => (l.pair === 'fore'
    ? solveFore({ pivot: girdle(l, bd, xh), pitch: bd.pitch, L: B.foreL, rest: B.bladeRest, swing0: B.swing0, kS: MECHANICS.scapula, target, carpus })
    : solveHind({ hip: girdle(l, bd, xh), L: B.hindL, ...B.reciprocal, target }));
  // the swinging hoof's line: its track, drawn in a little at mid-swing (the inward arc of a straight mover); a limb
  // whose line moves through the swing (a one-shot's new track) passes `x0`, `x1`
  const swingX = (l, v, x0 = l.x, x1 = l.x) => x0 + (x1 - x0) * ease(v) - l.side * LATERAL.swingIn * B.scale * bump(v, 0.5);
  // the standing legs' comfortable reach: the elbow and the stifle open to STANCE_OPEN at the most while loaded (BACK &
  // CLAYTON 2013: neither straightens in the stance), clear of the straight leg's singularity
  const reachF = foreReach(B.foreL, 0, STANCE_OPEN.elbow);
  const reachH = hindReach(B.hindL, B.reciprocal.c0, B.reciprocal.k, B.reciprocal.hockMin, Math.PI - STANCE_OPEN.stifle);
  const reachHard = hindReach(B.hindL, B.reciprocal.c0, B.reciprocal.k, B.reciprocal.hockMin, 10 * DEG);   // the solver's own limit
  const reachClose = hindReach(B.hindL, B.reciprocal.c0, B.reciprocal.k, B.reciprocal.hockMin, Math.PI - SWING_CLOSE.stifle);
  // THE HIP: the femur's angle against the pelvis's own line (the lumbosacral joint to the tail's root, as the pose has
  // pitched and flexed it), in the leg's plane; `hipFlex` that angle less the stand's (+ the stifle forward)
  const pelvisAng = (l, bd, xh = l.x) => {
    const pl = planeOf(l, bd, xh), a = bodyPoint(B, bd, [0, B.trunk.lumbosacral[0], B.trunk.lumbosacral[1]], true), b = bodyPoint(B, bd, [0, B.trunk.tailRoot[0], B.trunk.tailRoot[1]], true);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ew = [(pl.G[0] - pl.xh) / pl.D, 0, pl.G[2] / pl.D];
    return ang([d[1], d[0] * ew[0] + d[2] * ew[2]]);
  };
  const plS = legPlane([B.hind.girdleX, B.trunk.hip[0], B.trunk.hip[1]], B.hind.hoofX), ewS = B.trunk.hip[1] / plS.D;
  const rel0 = B.stand.hind.angles.femur - ang([B.trunk.tailRoot[0] - B.trunk.lumbosacral[0], (B.trunk.tailRoot[1] - B.trunk.lumbosacral[1]) * ewS]);
  // (the pelvis's line points back, near ±π: the difference wrapped)
  const hipFlex = (l, bd, femur, xh = l.x) => { const a = femur - pelvisAng(l, bd, xh) - rel0; return Math.atan2(Math.sin(a), Math.cos(a)); };
  return { girdle3, planeOf, girdle, solve, swingX, reachF, reachH, reachHard, reachClose, hipFlex };
}

const extOf = (st) => st.distal.pastern - st.solve.cannon;
const coffinOf = (st) => st.distal.pastern - ang(sub(st.distal.toe, st.distal.heel));
/**
 * A swing's ends from the stances either side: `lo` the stance just before lift-off and `lo0` a step earlier, `td` the
 * stance just after touchdown and `td1` a step later; `k` turns a step's difference into a rate per unit of swing. The
 * fetlock's place, the fetlock's extension and the hoof's angle to the pastern, each with its rate.
 */
export function swingEnds(lo, lo0, td, td1, k) {
  return {
    lo: lo.distal, td: td.distal,
    dLo: mul(sub(lo.distal.F, lo0.distal.F), k), dTd: mul(sub(td1.distal.F, td.distal.F), k),
    eLo: extOf(lo), deLo: (extOf(lo) - extOf(lo0)) * k, eTd: extOf(td), deTd: (extOf(td1) - extOf(td)) * k,
    qLo: coffinOf(lo), dqLo: (coffinOf(lo) - coffinOf(lo0)) * k, qTd: coffinOf(td), dqTd: (coffinOf(td1) - coffinOf(td)) * k,
  };
}

/**
 * A leg in its swing at v ∈ (0, 1): the fetlock along swingPath lifted by `lift`, the knee and the fetlock folding by
 * `fold` ({ carpus, fetlock, peak } in degrees, `k` the register's scale) and opening again before the landing,
 * the hoof's angle eased from the one it left with to the one it lands with, toe up to land heel-first. A target the
 * leg cannot reach is eased onto its reach. `x0`, `x1` the hoof's line leaving and landing (a one-shot's new track).
 */
export function swingLeg(B, rig, l, bd, sw, v, { lift, fold, x0, x1, follow = [0, 0], hold = 0, forward = 0, floor = false }) {
  // `hold` > 0 holds the lift and the folds near their peak (a plateau, still smooth): a tuck kept over a fence
  const B_ = (x, pk) => (hold ? 1 - (1 - bump(x, pk)) ** (1 + 2 * hold) : bump(x, pk));   // smooth: no kink at the top
  // `follow`: what the girdle has moved off its course between lift-off and landing (a flight's rise), the path rides it
  const y = swingPath(sw.lo.F[0], sw.dLo[0], sw.td.F[0], IMPACT * sw.dTd[0], v) + follow[0] + forward * B_(v, fold.peak);   // a tuck forward under the body
  const z = swingPath(sw.lo.F[1], sw.dLo[1], sw.td.F[1], IMPACT * sw.dTd[1], v) + lift * B_(v, fold.peak) + follow[1];
  // the folds open again before the landing, the knee first and then the fetlock (the leg reaches out straight)
  const k = fold.k ?? 1;
  const carpus = l.pair === 'fore' ? fold.carpus * DEG * k * B_(v / KNEE_OPEN, fold.peak / KNEE_OPEN) : 0;
  // a swing target past the leg's reach (a folded knee shortens the fore) eased onto it, faded in away from the
  // stance at either end so neither lift-off nor touchdown is touched
  let target = [y, z];
  const fade = ease(Math.min(1, v / 0.06)) * ease(Math.min(1, (1 - v) / 0.1));
  const xh = rig.swingX(l, v, x0, x1);
  // and a target closer than the most-closed elbow or stifle allows eased back out (a tuck folds, it does not collapse)
  if (l.pair === 'fore') {
    const first = rig.solve(l, bd, target, carpus, xh);
    target = softMinReach(first.S, foreReach(B.foreL, carpus, SWING_CLOSE.elbow), softReach(first.S, foreReach(B.foreL, carpus), target, fade), fade);
  } else {
    const hip = rig.girdle(l, bd, xh);
    target = softMinReach(hip, rig.reachClose, softReach(hip, rig.reachHard, target, fade), fade);
  }
  // `floor` (opt-in): a swinging fetlock kept above its hoof's hang by a smooth maximum, for a leg squeezed under a low
  // girdle (a take-off's crouch) that would otherwise be pushed through the ground; its floor the hoof hung toe-down
  // under the fetlock, and a margin
  const floored = (tg) => { const zMin = (B[l.pair].pastern + B.hoof.coffin + Math.max(0.06 * B.scale, 0.5 * B.hoof.toe)) * fade, w = 0.03; return [tg[0], tg[1] + w * Math.log1p(Math.exp((zMin - tg[1]) / w))]; };
  if (floor) target = floored(target);
  if (l.pair === 'hind') {
    // a swing that would flex the hip past its range: the femur HELD at the range (through a smooth knee HIP.knee
    // short of it; below the knee nothing is touched) and the leg folded at the stifle and the hock to keep the hoof
    // as high as it was to be, never below the floor (a tuck keeps its hooves up by folding, not by the hip). The
    // fold found by bisection from the free leg's: with the femur held, the hoof rises as the stifle folds further. At the knee's foot the held
    // leg is the free one, so nothing jumps; eased in away from the stance at either end, as the reach is.
    const a0 = (HIP.flex - HIP.knee) * DEG, w = HIP.knee * DEG / 2, free = rig.solve(l, bd, target, 0, xh);
    const flex = rig.hipFlex(l, bd, free.angles.femur, xh);
    if (flex > a0) {
      const held = flex < a0 + 2 * w ? flex - (flex - a0) ** 2 / (4 * w) : a0 + w, fem = free.angles.femur - (flex - held);
      const hip = rig.girdle(l, bd, xh), R = B.reciprocal;
      const tipAt = (s2) => { const v2 = hindChain(B.hindL, R.c0, R.k, R.hockMin, s2).v; return add(hip, mul(dir(fem - DOWN + ang(v2)), Math.hypot(v2[0], v2[1]))); };
      // the height kept: a hoof high in its swing (a tuck over a rail) keeps its own; nearer the ground it need only stay
      // may drop a little (folding a near-straight leg to hold a hoof a few millimetres up is ill-conditioned: it would
      // fold far), easing between over the 0.3 m above its bare hang
      const zg = B.hind.pastern + B.hoof.coffin, gH = Math.min(1, Math.max(0, (target[1] - zg) / (0.3 * B.scale)));
      const zk = target[1] - (1 - gH * gH * (3 - 2 * gH)) * 0.1 * B.scale;   // (its own height; near the ground, 0.1 m under it)
      // (from the free leg's own fold, folding further only: the root nearest the free leg, continuous with it)
      let lo = free.stifleFlex, hi = Math.max(lo, Math.PI - SWING_CLOSE.stifle);   // (no further than a swing's stifle closes)
      if (tipAt(lo)[1] < zk) {
        if (tipAt(hi)[1] <= zk) lo = hi;                                 // folded as far as it goes: as high as it gets
        else for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (tipAt(m)[1] < zk) lo = m; else hi = m; }
      }
      const heldT = tipAt(lo);
      target = add(target, mul(sub(heldT, target), fade));
    }
  }
  const sol = rig.solve(l, bd, target, carpus, xh);
  const e = swingPath(sw.eLo, sw.deLo, sw.eTd, IMPACT * sw.deTd, v) - fold.fetlock * DEG * k * (l.pair === 'fore' ? 1 : HIND_FETLOCK) * B_(v / FETLOCK_OPEN, Math.min(0.95, fold.peak * 1.1) / FETLOCK_OPEN);
  const pastern = sol.cannon + e;
  const coffin = add(sol.F, mul(dir(pastern), B[l.pair].pastern));
  const eta = pastern - swingPath(sw.qLo, sw.dqLo, sw.qTd, IMPACT * sw.dqTd, v) + TOE_UP * bump((v - 0.7) / 0.3, 0.6);   // toe up to land heel-first
  return { sol, distal: { ...hoofAt(coffin, eta, B.hoof), pastern }, xh };
}
