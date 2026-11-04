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
 *   packArms a frame with a giant arm pack: its giant arms' pose (as `arms`; 'stow' by default)
 *   load     kilograms held in the claws (shared by the arms whose tools hold), weighed in its centre of mass;
 *            loadOn, the arms that hold it ('arms', the frame's own, or 'packArms')
 *
 *   legGeometry(arch, ctx, S)            → { hip, a1, a2, l1, l2, hS }: a leg's numbers read from its built parts
 *   solveLeg(G, ankle, yaw, bend)         → { values: { yaw, roll, pitch, knee, anklePitch, ankleRoll } degrees, reach }
 *                                          (`bend` the archetype's: its knee 'back' or 'forward')
 *   solveArm(G, wrist, claw, yaw)         → { values: { yaw, pitch, elbow, wrist } degrees, reach }
 *   solveStance(arch, ctx, stance, opts)  → { joints, root: { R, t }, feet: { r, l }, stance }
 *
 * Pure and deterministic.
 */
import { DEG, I3, apply, sub } from './mecha-common.js';
import { framesOf } from '../construction-shelf/con-chain.js';
import { TAIL_POSES } from './mecha-backpacks.js';

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
export function armGeometry(arch, ctx, S, set = 'arms') {
  const g = arch[set][S];
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
/** Both arms' joints at a named pose of the archetype's (or { wrist, claw, yaw? } of the operator's own); `set` the arms
 *  it poses: the frame's own ('arms'), or a giant arm pack's ('packArms'). */
export function armsAt(arch, ctx, pose, set = 'arms') {
  if (!arch[set]) return {};
  const P = typeof pose === 'string' ? arch.armPoses?.[pose] : pose;
  if (!P) throw new Error(`mecha stance: arms '${pose}' is one of ${Object.keys(arch.armPoses ?? {}).join(', ')}, or { wrist: [ahead, up], claw }`);
  const out = {};
  for (const S of SIDES) {
    // (the pose's wrist as shares of the arm's length: its upper arm's and its forearm's)
    const G = armGeometry(arch, ctx, S, set), n = G.l1 + G.l2, a = solveArm(G, [P.wrist[0] * n, P.wrist[1] * n], P.claw ?? 0, (S === 'r' ? -1 : 1) * (P.yaw ?? 0)), J = arch[set][S].joints;
    for (const [k, v] of Object.entries(a.values)) out[J[k]] = v;
  }
  return out;
}

/**
 * A backpack's service tail at a named pose (mecha-backpacks.js TAIL_POSES): held at its joints (stow), or reaching a
 * service point from above as a scorpion's tail does, curled over: its base yawed toward the point, its root segment
 * raised past the line to it, its outer segment bent back down to the wrist, the head at the asked approach (0, straight
 * down onto a magazine's lug). `joints` the frame's others (its payloads' too): where the point stands.
 * → { values: { yaw, pitch, elbow, wrist joints }, reach }
 */
export function tailAt(arch, ctx, pose, joints = {}) {
  if (!arch.tail) return { values: {}, reach: true };
  const P = typeof pose === 'string' ? TAIL_POSES[pose] : pose, T = arch.tail, J = T.joints;
  if (!P) throw new Error(`mecha stance: tail '${pose}' is one of ${Object.keys(TAIL_POSES).join(', ')}`);
  if (P.joints) return { values: { [J.yaw]: P.joints.tailYaw, [J.pitch]: P.joints.tailPitch, [J.elbow]: P.joints.tailElbow, [J.wrist]: P.joints.tailWrist }, reach: true };
  const F = framesOf(arch, { ...joints, [J.yaw]: 0, [J.pitch]: 0, [J.elbow]: 0, [J.wrist]: 0 }, ctx);
  const dot = P.at.indexOf('.'), body = P.at.slice(0, dot), target = apply(F[body], ctx.hp(body, P.at.slice(dot + 1)));
  const B = F[T.base], pivot = apply(B, ctx.hp(T.base, 'pivot')), d = sub(target, pivot);
  // (the point in the base's own axes at its zero: its rotation's transpose)
  const q = [0, 1, 2].map((k) => B.R[0][k] * d[0] + B.R[1][k] * d[1] + B.R[2][k] * d[2]);
  const yaw = Math.atan2(-q[0], q[1]), ahead = Math.hypot(q[0], q[1]), up = q[2];
  const l1 = -ctx.hp(T.seg1, 'end')[2], l2 = -ctx.hp(T.seg2, 'end')[2], lh = -ctx.hp(T.head, 'grip')[2], phi = (P.approach ?? 0) * DEG;
  const wa = ahead - lh * Math.sin(phi), wu = up + lh * Math.cos(phi), d0 = Math.hypot(wa, wu);
  const dd = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, d0));
  const gamma = Math.atan2(wa, -wu), beta = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd))));
  const e = Math.acos(Math.max(-1, Math.min(1, (dd * dd - l1 * l1 - l2 * l2) / (2 * l1 * l2))));
  const D = (x) => x / DEG, wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const pitch = D(gamma + beta), elbow = -D(e);
  return { values: { [J.yaw]: D(yaw), [J.pitch]: pitch < 0 ? pitch + 360 : pitch, [J.elbow]: elbow, [J.wrist]: wrap(D(phi) - pitch - elbow) }, reach: d0 <= l1 + l2 };
}
/** A backpack's payloads' joints at a stance: each mount's traverse and elevation (`aim`: { traverse?, elevate? }). */
export function payloadsAt(arch, aim = {}) {
  const out = {};
  for (const S of Object.keys(arch.payloads ?? {})) { const U = S.toUpperCase(); out[`traverse${U}`] = aim.traverse ?? 0; out[`elevate${U}`] = aim.elevate ?? 0; }
  return out;
}

/**
 * A rolling frame collapsed onto its wheels (`roll: true`): its legs' yaw and roll as it stands, each thigh raked back
 * to `pitch`, each knee folded to `knee`; the pelvis lowered until the rear wheels (on the knees) stand on the ground,
 * each ankle pitched until its front wheel (ahead of the toe) stands there too. `range` a joint's range.
 */
function rollAt(arch, ctx, stance, range) {
  const base = solveStance(arch, ctx, arch.stances[arch.rest]), joints = { ...base.joints };
  // (the knee folded until the shank lies level: its bend the thigh's rake from straight down, and a quarter turn)
  // (the legs plumb, their roll undone, so the wheels stand upright on the ground)
  for (const S of SIDES) { const J = arch.legs[S].joints; joints[J.yaw] = 0; joints[J.roll] = 0; joints[J.ankleRoll] = 0; joints[J.pitch] = stance.pitch ?? -70; joints[J.knee] = stance.knee ?? 90 - joints[J.pitch]; }
  const wheel = (axle, S) => arch.wheels.find((w) => w.axle === axle && w.side === S).id;
  const radius = (id) => ctx.row(ctx.entry(id).sku).dims.r, centreZ = (j, id) => framesOf(arch, j, ctx)[id].t[2];
  // (the pelvis's height: the rear wheels' centres a radius up)
  const H = Math.max(...SIDES.map((S) => radius(wheel('rear', S)) - centreZ(joints, wheel('rear', S))));
  // (the front wheels on the ankles' axes stand where the shanks lie: on the ground too, when the shanks are level)
  const reach = SIDES.every((S) => Math.abs(H + centreZ(joints, wheel('front', S)) - radius(wheel('front', S))) < 0.01);
  for (const S of SIDES) {
    // (each foot pitched, across its ankle's range, to hold its sole highest off the ground: folded up ahead, a fender)
    const J = arch.legs[S].joints.anklePitch, [lo, hi] = range(J), foot = arch.legs[S].foot;
    const soleLow = (a) => { const Ff = framesOf(arch, { ...joints, [J]: a }, ctx)[foot]; return Math.min(...(ctx.outline(foot) ?? []).map((c) => H + Ff.R[2][0] * c[0] + Ff.R[2][1] * c[1] + Ff.R[2][2] * c[2] + Ff.t[2])); };
    let best = lo;
    for (let a = lo; a <= hi; a += 1) if (soleLow(a) > soleLow(best)) best = a;
    joints[J] = best;
  }
  return { joints, root: { R: I3, t: [0, 0, H] }, feet: null, legs: { r: { reach }, l: { reach } }, load: 0, loadOn: 'arms', ...(arch.tail ? { tailReach: true } : {}) };
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
export function solveStance(arch, ctx, stance, { com, stand, range } = {}) {
  if (!isObj(stance)) throw new Error('mecha stance: a stance is { knee | height, track?, fore?, sway?, feet? }');
  if (stance.roll) {
    if (!arch.wheels) throw new Error('mecha stance: only a frame on wheels rolls');
    if (typeof range !== 'function') throw new Error('mecha stance: rolling needs its joints\' ranges');
    return rollAt(arch, ctx, stance, range);
  }
  const Gs = Object.fromEntries(SIDES.map((S) => [S, legGeometry(arch, ctx, S)]));
  const feet = feetOf(arch, stance), arms = { ...armsAt(arch, ctx, stance.arms ?? 'rest'), ...armsAt(arch, ctx, stance.packArms ?? 'stow', 'packArms') };
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
      const c = com(withArms(solved.joints), { R: I3, t: [xy[0], xy[1], z] }, stance.load ?? 0, stance.loadOn);
      const dx = f.x - c[0], dy = f.y - c[1];
      xy = [xy[0] + dx, xy[1] + dy];
      if (!Number.isFinite(stance.height) && stance.height !== 'stand') z = heightOf();
      solved = legsAt(arch, Gs, feet, [xy[0], xy[1], z]);
      if (Math.hypot(dx, dy) < 1e-5) break;
    }
  }
  // (a backpack's payloads aimed, its tail at its pose: what it reaches is where the payloads stand)
  const payloads = payloadsAt(arch, stance.aim), tail = tailAt(arch, ctx, stance.tail ?? 'stow', { ...solved.joints, ...arms, ...payloads });
  return { joints: { ...solved.joints, ...arms, ...payloads, ...tail.values }, root: { R: I3, t: [xy[0], xy[1], z] }, feet, legs: solved.legs, load: stance.load ?? 0, loadOn: stance.loadOn ?? 'arms', ...(arch.tail ? { tailReach: tail.reach } : {}) };
}
