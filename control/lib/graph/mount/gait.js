/**
 * gait — a mount through one stride of a gait at a speed, solved from the mechanics: the footfalls and the duty from
 * the reference table, scaled to the mount's legs by dynamic similarity; the body's heave, pitch and nod integrated from
 * the hooves' forces (load.js); each leg solved from its passive laws (limb.js). In place (a treadmill): the centre of
 * mass holds y = 0, the ground slides back under the planted hooves at the gait's speed.
 *
 * STANCE  the hoof flat where it landed, sliding back with the ground; the fetlock sinking with the hoof's load; the
 *         heel lifting and the hoof rolling over its toe through the breakover; the leg solved to the fetlock.
 * SWING   the fold laid between the stance it leaves and the stance it arrives at: the fetlock's path (swingPath) C1
 *         with the stance at both ends (no pop at lift-off or touchdown), lifted by the gait's clearance; the knee,
 *         and the fetlock under it, folding by a bump that peaks early in the swing; the hoof's angle to the pastern
 *         eased from the one it left with to the one it lands with. The hind's hock folds with its stifle by the
 *         reciprocal apparatus, so the hind's fold is the solve's, not a key.
 *
 *   gaitCycle(B, gait, { speed, lead }) → { gait, speed, lead, f, T, L, duty, limbs, poseAt(t), loads }
 *   gaitFrames(B, gait, { speed, lead, n }) → n frames over one stride
 *   standPose(B) → the standing frame
 *
 * SIDEWAYS  each hoof stands on a line out from the mid-plane by the gait's track, its leg solved in the plane through its
 *         girdle's joint and that line (an exact rotation: no bone stretches); the body sways toward the side bearing
 *         the weight and each girdle rolls toward its unloaded side (load.js); the swinging hoof arcs in a little.
 */
import { GAITS, FOLD, HIND_FETLOCK, MECHANICS, NECK, LUMBOSACRAL, LATERAL, REFERENCE_HORSE } from './reference.js';
import { solveFore, solveHind, hoofAt, hindReach, foreReach, softReach, add, sub, mul, dir, ang, len } from './limb.js';
import { fetlockExt, standOn } from './build.js';
import { strideLoads, evaluate, accel, harmonics, N } from './load.js';
import { assemble, bodyPoint, legPlane } from './pose.js';

const DEG = Math.PI / 180;
const frac = (x) => x - Math.floor(x);
const ease = (v) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, v)));
const lerp = (a, b, s) => a + (b - a) * s;
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
const KNEE_OPEN = 0.82, FETLOCK_OPEN = 0.76;   // where in the swing the knee's and the fetlock's folds have opened
const TOE_UP = 6 * DEG;                        // the toe's lift as the hoof comes in to land (≈)
const STANCE_OPEN = { elbow: 152 * DEG, stifle: 152 * DEG };   // the most a loaded elbow and stifle open (≈)
const VAULT_K = 4;     // the vault's harmonics: a slow sway of the girdles, so a suspension stays a fall at g
const IMPACT = 0.7;   // the share of the ground's speed the swinging hoof matches before it lands (≈)
const MIRROR = { LF: 'RF', RF: 'LF', LH: 'RH', RH: 'LH' };

/** the gait's stride at a speed for this build: dynamic similarity from the reference horse */
export function strideOf(B, gait, speed) {
  const spec = GAITS[gait];
  if (!spec) throw new Error(`mount: gait '${gait}' is not one of ${Object.keys(GAITS).join(', ')}`);
  const v = speed ?? spec.preferred * Math.sqrt(B.scale);
  const vRef = v / Math.sqrt(B.scale);
  const f = (spec.f[0] + spec.f[1] * Math.abs(vRef)) / Math.sqrt(B.scale);
  const duty = spec.duty[0] + spec.duty[1] * Math.abs(vRef);
  return { spec, speed: v, vRef, f, T: 1 / f, L: v / f, duty };
}

export function gaitCycle(B, gait, { speed, lead = 'right' } = {}) {
  const S = strideOf(B, gait, speed), { spec, f, T, L, duty } = S;
  const fold = FOLD[gait], mo = B.motion;
  const feet = lead === 'left' ? Object.fromEntries(Object.entries(spec.feet).map(([k, v]) => [MIRROR[k], v])) : spec.feet;
  // the swing's lift at the preferred speed, growing with the stride (an extended gait lifts higher, a collected lower)
  const L0 = Math.abs(strideOf(B, gait).L), grow = Math.sqrt(Math.abs(L) / L0);
  const lift = { fore: spec.lift[0] * B.scale * mo.lift * grow, hind: spec.lift[1] * B.scale * mo.lift * grow };
  const crouch = spec.crouch * B.scale;
  const limbs = ['LF', 'RF', 'LH', 'RH'].map((id) => {
    const pair = id[1] === 'F' ? 'fore' : 'hind';
    const side = id[0] === 'R' ? 1 : -1;
    // x: the hoof's line, out from the mid-plane by the gait's track (narrower as it quickens)
    return { id, pair, side, phase: feet[id], share: B.share[pair] / 2, yc: B[pair].hoofY, x: side * B[pair].hoofX * (spec.track ?? 1) };
  });
  const k = REFERENCE_HORSE.pitchGyration * B.scale;
  const arms = { withers: B.trunk.neck[0][0], croup: B.trunk.tailRoot[0] };
  const loadsFor = () => strideLoads({
    limbs, duty, L, T, b: spec.load, k, arms,
    neck: { omega: NECK.omega / Math.sqrt(B.scale), zeta: NECK.zeta, gain: NECK.gain[gait] ?? 1, r: 0.45 * B.scale },
    tail: { omega: 2 * Math.PI * 1.2 / Math.sqrt(B.scale), zeta: 0.3, gain: 1, r: 0.25 * B.scale },
    lateral: { h: B.trunk.com[1] - crouch, roll: { ...LATERAL.roll, omega: LATERAL.roll.omega / Math.sqrt(B.scale) }, neck: { gain: LATERAL.neck.gain, r: LATERAL.neck.r * B.scale } },
  });
  let loads = loadsFor();
  const comZ = B.trunk.com[1] - crouch;
  const bo = MECHANICS.breakover, boPitch = MECHANICS.breakoverPitch * DEG;

  // the stance's ground: where a limb's hoof is at time t, its pitch, the load its fetlock sinks under
  const groundAt = (l, t) => {
    const u = frac(t - l.phase), w = u / duty;
    const g = l.yc + L * (duty / 2 - u);
    const eta = w > 1 - bo ? -boPitch * ease((w - (1 - bo)) / bo) : 0;
    return { g, eta, F: loads.forceOf(l, t) };
  };
  // the lumbosacral flexion: the hinds' nominal reach (their hooves' fore-aft, eased through the swing), off the stand
  const nominalY = (l, t) => {
    const u = frac(t - l.phase);
    if (u < duty) return l.yc + L * (duty / 2 - u);
    return lerp(l.yc - L * duty / 2, l.yc + L * duty / 2, ease((u - duty) / (1 - duty)));
  };
  const hinds = limbs.filter((l) => l.pair === 'hind');
  const psiAt = (t) => (LUMBOSACRAL[gait] ?? 0) * hinds.reduce((s, l) => s + Math.atan2(nominalY(l, t) - l.yc, B.hip), 0) / hinds.length;
  // THE VAULT: a girdle over a stiff standing leg falls toward the ends of that leg's stance (each girdle its own
  // inverted pendulum, the trunk pitching between them). The force-integrated body is lowered, girdle by girdle, by
  // what its standing legs cannot comfortably reach, smoothed to the stride's low harmonics; three passes.
  const yF = B.trunk.scapulaPivot[0], yH = B.trunk.hip[0];
  let dropF = null, dropH = null;
  const vault = (t) => {
    if (!dropF) return { z: 0, pitch: 0 };
    const f = evaluate(dropF, t), hh = evaluate(dropH, t);
    return { z: -(hh + (f - hh) * (0 - yH) / (yF - yH)), pitch: (hh - f) / (yF - yH) };
  };
  const side = (key, t) => (loads.side ? evaluate(loads.side[key], t) : 0);
  const bodyAt = (t) => {
    const v = vault(t);
    return {
      z: comZ + mo.heave * evaluate(loads.heave, t) + v.z, pitch: mo.heave * evaluate(loads.pitch, t) + v.pitch, psi: psiAt(t),
      sway: mo.heave * side('sway', t), rollF: mo.heave * side('rollF', t), rollH: mo.heave * side('rollH', t),
    };
  };
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
  // the swinging hoof's line: its track, drawn in a little at mid-swing (the inward arc of a straight mover)
  const swingX = (l, v) => l.x - l.side * LATERAL.swingIn * B.scale * bump(v, 0.5);

  const stanceAt = (l, t) => { const gr = groundAt(l, t), bd = bodyAt(t); return standOn(B, l.pair, gr.g, gr.F, gr.eta, (F) => solve(l, bd, F)); };

  // the standing legs' comfortable reach: the elbow and the stifle open to STANCE_OPEN at the most while loaded (BACK &
  // CLAYTON 2013: neither straightens in the stance), clear of the straight leg's singularity
  const reachF = foreReach(B.foreL, 0, STANCE_OPEN.elbow);
  const reachH = hindReach(B.hindL, B.reciprocal.c0, B.reciprocal.k, B.reciprocal.hockMin, Math.PI - STANCE_OPEN.stifle);
  const reachHard = hindReach(B.hindL, B.reciprocal.c0, B.reciprocal.k, B.reciprocal.hockMin, 10 * DEG);   // the solver's own limit
  const shortfall = (l, t) => {
    const st = stanceAt(l, t), from = l.pair === 'fore' ? st.solve.S : girdle(l, bodyAt(t));
    const v = sub(st.distal.F, from), D = len(v), over = D - (l.pair === 'fore' ? reachF : reachH);
    return over > 0 ? over * D / Math.max(0.3, -v[1]) : 0;
  };
  // WHERE EACH HOOF LANDS: its stance centred where its leg reaches evenly fore and aft (the canter's hinds land engaged
  // under the body), searched over ±0.2 m of where it stands; then the pairs' shares of the weight follow the centres
  // so the stride's mean moment stays zero, and the loads are integrated again.
  const usage = (l, t) => {
    const st = stanceAt(l, t), from = l.pair === 'fore' ? st.solve.S : girdle(l, bodyAt(t));
    return len(sub(st.distal.F, from)) - (l.pair === 'fore' ? reachF : reachH);
  };
  for (const l of limbs) {
    const y0 = l.yc;
    let best = y0, bestU = Infinity;
    for (let i = -5; i <= 5; i++) {
      l.yc = y0 + i * 0.04 * B.scale;
      let u = -Infinity;
      for (let j = 0; j <= 12; j++) u = Math.max(u, usage(l, l.phase + duty * (j / 12) * 0.999 + 1e-7));
      if (u < bestU - 1e-9 || (Math.abs(u - bestU) <= 1e-9 && Math.abs(l.yc - y0) < Math.abs(best - y0))) { best = l.yc; bestU = u; }
    }
    l.yc = best;
  }
  const ycF = (limbs[0].yc + limbs[1].yc) / 2, ycH = (limbs[2].yc + limbs[3].yc) / 2;
  const shareF = -ycH / (ycF - ycH);
  for (const l of limbs) l.share = (l.pair === 'fore' ? shareF : 1 - shareF) / 2;
  loads = loadsFor();

  const M = N, W = Math.round(0.03 * M);
  const accF = new Array(M).fill(0), accH = new Array(M).fill(0);
  for (let pass = 0; pass < 3; pass++) {
    const sF = new Array(M).fill(0), sH = new Array(M).fill(0);
    for (let i = 0; i < M; i++) {
      const t = i / M;
      for (const l of limbs) {
        if (frac(t - l.phase) >= duty) continue;
        const d = shortfall(l, t);
        if (l.pair === 'fore') sF[i] = Math.max(sF[i], d); else sH[i] = Math.max(sH[i], d);
      }
    }
    // dilate (a running max) so the smoothing does not shave the peaks it must cover
    for (const [s, acc] of [[sF, accF], [sH, accH]]) for (let i = 0; i < M; i++) {
      let m = 0; for (let j = -W; j <= W; j++) m = Math.max(m, s[(i + j + M) % M]);
      acc[i] += m * 1.15;
    }
    // a gait with a suspension takes the vault as a constant crouch and tilt (its flight stays a fall at g); a gait
    // always on the ground sways with it
    const low = (a) => (spec.aerial > 0 ? [[Math.max(...a), 0]] : harmonics(a).slice(0, VAULT_K + 1));
    dropF = low(accF); dropH = low(accH);
  }

  // each limb's swing, fixed by the stance it leaves and the one it lands in: the fetlock's place, the fetlock's
  // extension and the hoof's angle to the pastern, each with its rate there (per unit of swing), so the swing leaves and
  // lands C1 in all three
  const h = 1e-4;
  const extOf = (st) => st.distal.pastern - st.solve.cannon;
  const coffinOf = (st) => st.distal.pastern - ang(sub(st.distal.toe, st.distal.heel));
  for (const l of limbs) {
    const tLo = l.phase + duty - 1e-7, tTd = l.phase + 1 + 1e-7;   // just inside the stance at each end
    const lo = stanceAt(l, tLo), td = stanceAt(l, tTd), lo0 = stanceAt(l, tLo - h), td1 = stanceAt(l, tTd + h);
    const k = (1 - duty) / h;
    l.swing = {
      lo: lo.distal, td: td.distal,
      dLo: mul(sub(lo.distal.F, lo0.distal.F), k), dTd: mul(sub(td1.distal.F, td.distal.F), k),
      eLo: extOf(lo), deLo: (extOf(lo) - extOf(lo0)) * k, eTd: extOf(td), deTd: (extOf(td1) - extOf(td)) * k,
      qLo: coffinOf(lo), dqLo: (coffinOf(lo) - coffinOf(lo0)) * k, qTd: coffinOf(td), dqTd: (coffinOf(td1) - coffinOf(td)) * k,
    };
  }

  const poseAt = (t) => {
    t = frac(t);
    const bd = bodyAt(t), legs = {}, contact = {}, clamps = [];
    for (const l of limbs) {
      const u = frac(t - l.phase);
      let sol, distal, xh = l.x;
      if (u < duty) {
        const st = stanceAt(l, t);
        sol = st.solve;
        distal = st.distal;
        contact[l.id] = true;
      } else {
        const v = (u - duty) / (1 - duty), sw = l.swing;
        const y = swingPath(sw.lo.F[0], sw.dLo[0], sw.td.F[0], IMPACT * sw.dTd[0], v);
        const z = swingPath(sw.lo.F[1], sw.dLo[1], sw.td.F[1], IMPACT * sw.dTd[1], v) + lift[l.pair] * bump(v, fold.peak);
        // the folds open again before the landing, the knee first and then the fetlock (the leg reaches out straight)
        const carpus = l.pair === 'fore' ? fold.carpus * DEG * mo.fold * bump(v / KNEE_OPEN, fold.peak / KNEE_OPEN) : 0;
        // a swing target past the leg's reach (a folded knee shortens the fore) eased onto it, faded in away from the
        // stance at either end so neither lift-off nor touchdown is touched
        let target = [y, z];
        const fade = ease(Math.min(1, v / 0.06)) * ease(Math.min(1, (1 - v) / 0.1));
        xh = swingX(l, v);
        if (l.pair === 'fore') { const first = solve(l, bd, target, carpus, xh); target = softReach(first.S, foreReach(B.foreL, carpus), target, fade); }
        else target = softReach(girdle(l, bd, xh), reachHard, target, fade);
        sol = solve(l, bd, target, carpus, xh);
        const e = swingPath(sw.eLo, sw.deLo, sw.eTd, IMPACT * sw.deTd, v) - fold.fetlock * DEG * mo.fold * (l.pair === 'fore' ? 1 : HIND_FETLOCK) * bump(v / FETLOCK_OPEN, fold.peak * 1.1 / FETLOCK_OPEN);
        const pastern = sol.cannon + e;
        const coffin = add(sol.F, mul(dir(pastern), B[l.pair].pastern));
        const eta = pastern - swingPath(sw.qLo, sw.dqLo, sw.qTd, IMPACT * sw.dqTd, v) + TOE_UP * bump((v - 0.7) / 0.3, 0.6);   // toe up to land heel-first
        distal = { ...hoofAt(coffin, eta, B.hoof), pastern };
        contact[l.id] = false;
      }
      if (sol.clamped) clamps.push(l.id);
      legs[l.id] = { solve: sol, distal, plane: planeOf(l, bd, xh) };
    }
    const nu = mo.nod * evaluate(loads.nod, t), tau = evaluate(loads.swish, t), lat = mo.nod * side('lat', t);
    const { bones, points } = assemble(B, { ...bd, nu, lat, tau, headCounter: NECK.headCounter, legs });
    return { t, bones, points, legs, contact, clamps, body: { ...bd, nu, lat, tau }, ground: -frac(t) * L };
  };

  return { vault: { dropF, dropH }, gait, speed: S.speed, vRef: S.vRef, lead, f, T, L, duty, lift, crouch, limbs, loads, poseAt, zAccAt: (t) => evaluate(loads.zAcc, t), heaveAccAt: (t) => mo.heave * evaluate(accel(loads.heave, T), t) };
}

function rotate(v, a) { return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]; }

export function gaitFrames(B, gait, { speed, lead, n = 24 } = {}) {
  const c = gaitCycle(B, gait, { speed, lead });
  return Array.from({ length: n }, (_, i) => c.poseAt(i / n));
}

/** the standing frame: the build's own stand, square on four hooves */
export function standPose(B) {
  const legs = {}, st = { z: B.trunk.com[1], pitch: 0, psi: 0, nu: 0, tau: 0 };
  for (const s of ['R', 'L']) {
    const f = B.stand.fore, hd = B.stand.hind, sx = s === 'R' ? 1 : -1;
    legs[`${s}F`] = { solve: f, distal: f.distal, plane: legPlane(bodyPoint(B, st, [sx * B.fore.girdleX, B.trunk.scapulaPivot[0], B.trunk.scapulaPivot[1]]), sx * B.fore.hoofX) };
    legs[`${s}H`] = { solve: hd, distal: hd.distal, plane: legPlane(bodyPoint(B, st, [sx * B.hind.girdleX, B.trunk.hip[0], B.trunk.hip[1]], true), sx * B.hind.hoofX) };
  }
  const { bones, points } = assemble(B, { ...st, legs });
  return { t: 0, bones, points, legs, contact: { LF: true, RF: true, LH: true, RH: true }, clamps: [], body: { z: B.trunk.com[1], pitch: 0, psi: 0, nu: 0, tau: 0 }, ground: 0 };
}
