/**
 * mecha-ik — a leg's inverse kinematics, and a stance solved to joint values: the frame is posed by where its feet are
 * and where its pelvis is carried, never joint by joint.
 *
 * A leg of six joints (hip yaw, hip roll, hip pitch, knee, ankle pitch, ankle roll) whose pitch axes are square to its
 * roll yoke, its ankle a cross (the pitch and the roll axes meeting): any foot within reach is set at any heading with
 * its sole flat. Closed form:
 *   yaw     the foot's heading (the hip's drive turns the whole leg)
 *   roll    the leg's plane turned about the roll axis until it holds the ankle
 *   pitch, knee   a two-link leg in that plane, the knee bent backward behind the line from hip to ankle (a
 *           digitigrade leg) or forward of it (a person's): the knee's bend from straight
 *   ankle   pitch the hip's and the knee's undone, roll the hip's undone: the sole flat
 *
 * A stance (the archetype's `stances`, or the operator's own):
 *   knee     the knee's bend (degrees) the pelvis's height is set by (the more bent leg's; on one foot, the stance
 *            leg's), or
 *   height   the pelvis's height (metres), or 'stand' (the standing stance's)
 *   track    the soles' track (between the ankles' centres), else the archetype's
 *   fore     metres both feet are set ahead of the pelvis
 *   sway     'r' | 'l': the pelvis carried so its centre of mass is over that sole (a static step), or [dx, dy] metres
 *   feet     { r: { x?, y?, lift?, yaw? }, l: … } a foot's place on the ground (its sole's centre), its lift off it and
 *            its heading (degrees, + to the left)
 *   arms     a frame with arms: their pose's name (the archetype's `armPoses`), or { wrist: [ahead, up], claw, yaw? }
 *            (the wrist's place as shares of the arm's length, from its shoulder's axle)
 *   load     kilograms held in the claws (half in each), weighed in its centre of mass
 *
 *   legGeometry(arch, ctx, S)            → { hip, a1, a2, l1, l2, hS }: a leg's numbers read from its built parts
 *   solveLeg(G, ankle, yaw, bend)         → { values: { yaw, roll, pitch, knee, anklePitch, ankleRoll } degrees, reach }
 *                                          (`bend` the archetype's: its knee 'back' or 'forward')
 *   solveArm(G, wrist, claw, yaw)         → { values: { yaw, pitch, elbow, wrist } degrees, reach }
 *   solveStance(arch, ctx, stance, opts)  → { joints, root: { R, t }, feet: { r, l }, stance }
 *
 * Pure and deterministic.
 */
import { DEG, I3 } from './mecha-common.js';

const SIDES = Object.freeze(['r', 'l']);

/** A leg's numbers, read from its built parts: the hip's yaw axis on the pelvis, the roll pivot below it (a1), the pitch
 *  axle below that (a2), the thigh's and the shank's lengths, the ankle's height over the sole. */
export function legGeometry(arch, ctx, S) {
  const g = arch.legs[S], hp = (b, n) => ctx.hp(b, n);
  return {
    hip: hp('pelvis', `hip.${S}`),
    a1: -hp(g.hip, 'roll')[2],
    a2: -hp(g.roll, 'pitch')[2],
    l1: -hp(g.pitch, 'knee')[2],
    l2: -hp(g.knee, 'ankle')[2],
    hS: -hp(g.foot, 'sole')[2],
  };
}

/** One leg, the ankle's point in the pelvis's frame (the pelvis level) and its heading → its six joints' values. */
export function solveLeg(G, A, yaw = 0, bend = 'back') {
  const p = [A[0] - G.hip[0], A[1] - G.hip[1], A[2] - G.hip[2] + G.a1];
  const c = Math.cos(-yaw * DEG), s = Math.sin(-yaw * DEG), q = [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
  // (the leg's plane holds the ankle: turned about the roll axis, +y)
  const phi = Math.atan2(-q[0], -q[2]);
  const cr = Math.cos(-phi), sr = Math.sin(-phi), r = [cr * q[0] + sr * q[2], q[1], -sr * q[0] + cr * q[2]];
  const vy = r[1], vz = r[2] + G.a2, d0 = Math.hypot(vy, vz), dMax = G.l1 + G.l2 - 1e-6;
  const reach = d0 <= dMax && d0 >= Math.abs(G.l1 - G.l2);
  const d = Math.min(dMax, Math.max(Math.abs(G.l1 - G.l2) + 1e-6, d0));
  const knee = Math.acos(Math.max(-1, Math.min(1, (d * d - G.l1 * G.l1 - G.l2 * G.l2) / (2 * G.l1 * G.l2))));
  const beta = Math.acos(Math.max(-1, Math.min(1, (G.l1 * G.l1 + d * d - G.l2 * G.l2) / (2 * G.l1 * d))));
  const D = (x) => x / DEG;
  // (a knee bent forward, a person's: the thigh turned forward of the line from hip to ankle, the shank back, the sole
  // turned level)
  if (bend === 'forward') {
    const pitch = Math.atan2(vy, -vz) + beta;
    return { values: { yaw, roll: D(phi), pitch: D(pitch), knee: D(knee), anklePitch: D(knee - pitch), ankleRoll: -D(phi) }, reach, over: Math.max(0, d0 - dMax) };
  }
  // (a knee bent backward: the knee behind the line, the thigh turned back from it, the shank forward, the sole level)
  const pitch = Math.atan2(vy, -vz) - beta;
  return { values: { yaw, roll: D(phi), pitch: D(pitch), knee: D(knee), anklePitch: -D(pitch + knee), ankleRoll: -D(phi) }, reach, over: Math.max(0, d0 - dMax) };
}

/** An arm's numbers, read from its built parts: the upper arm's and the forearm's lengths. */
export function armGeometry(arch, ctx, S) {
  const g = arch.arms[S];
  return { l1: -ctx.hp(g.upper, 'elbow')[2], l2: -ctx.hp(g.fore, 'wrist')[2] };
}
/**
 * One arm, its wrist's place [ahead, up] from its shoulder's axle in the arm's plane and its claw's angle from hanging
 * (degrees) → its joints' values. The elbow bends as a person's, the forearm coming forward and up.
 */
export function solveArm(G, W, claw = 0, yaw = 0) {
  const [vy, vz] = W, d0 = Math.hypot(vy, vz), dMax = G.l1 + G.l2 - 1e-6, d = Math.min(dMax, Math.max(Math.abs(G.l1 - G.l2) + 1e-6, d0));
  const elbow = Math.acos(Math.max(-1, Math.min(1, (d * d - G.l1 * G.l1 - G.l2 * G.l2) / (2 * G.l1 * G.l2))));
  const beta = Math.acos(Math.max(-1, Math.min(1, (G.l1 * G.l1 + d * d - G.l2 * G.l2) / (2 * G.l1 * d))));
  const pitch = Math.atan2(vy, -vz) - beta, D = (x) => x / DEG;
  return { values: { yaw, pitch: D(pitch), elbow: D(elbow), wrist: claw - D(pitch + elbow) }, reach: d0 <= dMax };
}
/** Both arms' joints at a named pose of the archetype's (or { wrist, claw, yaw? } of the operator's own). */
export function armsAt(arch, ctx, pose) {
  if (!arch.arms) return {};
  const P = typeof pose === 'string' ? arch.armPoses?.[pose] : pose;
  if (!P) throw new Error(`mecha stance: arms '${pose}' is one of ${Object.keys(arch.armPoses ?? {}).join(', ')}, or { wrist: [ahead, up], claw }`);
  const out = {};
  for (const S of SIDES) {
    // (the pose's wrist as shares of the arm's length: its upper arm's and its forearm's)
    const G = armGeometry(arch, ctx, S), n = G.l1 + G.l2, a = solveArm(G, [P.wrist[0] * n, P.wrist[1] * n], P.claw ?? 0, (S === 'r' ? -1 : 1) * (P.yaw ?? 0)), J = arch.arms[S].joints;
    for (const [k, v] of Object.entries(a.values)) out[J[k]] = v;
  }
  return out;
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A stance's feet on the ground: each foot's sole centre, its lift and its heading. */
function feetOf(arch, st) {
  const track = st.track ?? arch.track, fore = st.fore ?? 0, out = {};
  for (const S of SIDES) {
    const f = st.feet?.[S] ?? {}, s = S === 'r' ? 1 : -1;
    out[S] = { x: f.x ?? s * track / 2, y: (f.y ?? 0) + fore, lift: f.lift ?? 0, yaw: f.yaw ?? 0 };
  }
  return out;
}

/** The joints of both legs with the pelvis at `t` (level) and the feet where `feet` sets them. */
function legsAt(arch, Gs, feet, t) {
  const joints = {}, legs = {};
  for (const S of SIDES) {
    const G = Gs[S], f = feet[S], A = [f.x - t[0], f.y - t[1], f.lift + G.hS - t[2]];
    const leg = solveLeg(G, A, f.yaw, arch.bend), J = arch.legs[S].joints;
    for (const [k, v] of Object.entries(leg.values)) joints[J[k]] = v;
    legs[S] = { reach: leg.reach, over: leg.over, knee: leg.values.knee };
  }
  return { joints, legs };
}

/** The pelvis's height at which the more bent leg's knee is `k` degrees (the knee straightens as the pelvis rises), or
 *  the stance leg's when one foot is lifted. */
function heightForKnee(arch, Gs, feet, k, xy) {
  const stance = SIDES.filter((S) => feet[S].lift < 1e-9), legsOf = stance.length === 1 ? stance : SIDES;
  const G = Gs.r, lo0 = G.hS + G.a1 + G.a2 + Math.abs(G.l1 - G.l2) + 0.02, hi0 = G.hS + G.a1 + G.a2 + G.l1 + G.l2;
  let lo = lo0, hi = hi0;
  const bend = (z) => { const { legs } = legsAt(arch, Gs, feet, [xy[0], xy[1], z]); return Math.max(...legsOf.map((S) => legs[S].knee)); };
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (bend(m) > k) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

/**
 * A stance → joint values and the pelvis's frame (its root: level, facing +y). `com(joints, root)` (the frame's centre
 * of mass in the machine's frame, the rider aboard) sets a sway; `stand` the standing stance's height for 'stand'.
 */
export function solveStance(arch, ctx, stance, { com, stand } = {}) {
  if (!isObj(stance)) throw new Error('mecha stance: a stance is { knee | height, track?, fore?, sway?, feet? }');
  const Gs = Object.fromEntries(SIDES.map((S) => [S, legGeometry(arch, ctx, S)]));
  const feet = feetOf(arch, stance), arms = armsAt(arch, ctx, stance.arms ?? 'rest');
  const withArms = (j) => ({ ...j, ...arms });
  let xy = Array.isArray(stance.sway) ? [stance.sway[0], stance.sway[1]] : [0, 0];
  const heightOf = () => {
    if (stance.height === 'stand') { if (!Number.isFinite(stand)) throw new Error('mecha stance: \'stand\' height needs the standing stance'); return stand; }
    if (Number.isFinite(stance.height)) return stance.height;
    if (Number.isFinite(stance.knee)) return heightForKnee(arch, Gs, feet, stance.knee, xy);
    throw new Error('mecha stance: say the pelvis\'s height (metres, or \'stand\') or the knee\'s bend it is set by (degrees)');
  };
  let z = heightOf(), solved = legsAt(arch, Gs, feet, [xy[0], xy[1], z]);
  if (stance.sway === 'r' || stance.sway === 'l') {
    if (typeof com !== 'function') throw new Error('mecha stance: a sway over a sole needs the frame\'s centre of mass');
    const f = feet[stance.sway];
    // (the pelvis carried until the centre of mass stands over the sole's centre: a few passes, the legs re-solved each)
    for (let i = 0; i < 8; i++) {
      const c = com(withArms(solved.joints), { R: I3, t: [xy[0], xy[1], z] }, stance.load ?? 0);
      const dx = f.x - c[0], dy = f.y - c[1];
      xy = [xy[0] + dx, xy[1] + dy];
      if (!Number.isFinite(stance.height) && stance.height !== 'stand') z = heightOf();
      solved = legsAt(arch, Gs, feet, [xy[0], xy[1], z]);
      if (Math.hypot(dx, dy) < 1e-5) break;
    }
  }
  return { joints: { ...solved.joints, ...arms }, root: { R: I3, t: [xy[0], xy[1], z] }, feet, legs: solved.legs, load: stance.load ?? 0 };
}
