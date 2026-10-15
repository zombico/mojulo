/**
 * versus rig — the fighter's stick figure in the fight plane.
 *
 * A side-view skeleton, facing +x, y up, millimetres, its origin on the ground between the feet. A POSE is a set
 * of segment angles in degrees, each limb's own direction in the plane (not relative to its parent), so a key reads
 * as what the body is doing:
 *
 *   limbs (arms, legs, feet): 0 hangs straight down, +90 points forward (toward the opponent), -90 back, 180 up.
 *   torso, head:              0 stands straight up, + leans forward.
 *
 *   pose = { torso, head, armF: [upper, fore], armB: [upper, fore], legF: [thigh, shin, foot], legB: [...],
 *            hip?: [dx, dy], air?: true }
 *
 * F is the lead side (nearer the opponent), B the rear. A grounded pose stands on its lowest point: the figure is
 * lifted or sunk so its lowest foot point touches y = 0 (a crouch sinks without saying so); `air: true` keeps the
 * pelvis at its standing height plus `hip`, and the sim adds the jump. `hip[0]` shifts the body forward.
 *
 * Bodies are lengths from a height and a cast (the hero door's cast words: heroic, brute, lithe, stout, ...), so the
 * same pose reaches further on a longer arm and the solved boxes follow. Pure, no dice; floats in, the compiler
 * rounds what the sim keeps.
 */

// a cast's limb dials (multipliers on the canonical ratios) and girth (the hurtbox's thickness)
export const VERSUS_CASTS = Object.freeze({
  heroic: { height: 1800, arm: 1, leg: 1, torso: 1, girth: 1 },
  brute: { height: 1950, arm: 1.08, leg: 0.94, torso: 1.06, girth: 1.35 },
  lithe: { height: 1760, arm: 1, leg: 1.07, torso: 0.96, girth: 0.85 },
  stout: { height: 1650, arm: 0.95, leg: 0.9, torso: 1.02, girth: 1.2 },
  canonical: { height: 1750, arm: 1, leg: 1, torso: 1, girth: 1 },
});

// canonical segment lengths as fractions of height
const RIG_RATIO = Object.freeze({ torso: 0.3, neck: 0.03, head: 0.065, upper: 0.17, fore: 0.15, hand: 0.045, thigh: 0.245, shin: 0.245, foot: 0.075, ankle: 0.035 });

/** A body's lengths and radii (mm) from a cast word or a dial object. */
export function versusBody(cast = 'heroic', over = {}) {
  const c = { ...(VERSUS_CASTS[cast] ?? VERSUS_CASTS.heroic), ...over };
  const H = c.height;
  const L = {
    height: H,
    torso: H * RIG_RATIO.torso * c.torso,
    neck: H * RIG_RATIO.neck,
    head: H * RIG_RATIO.head,
    upper: H * RIG_RATIO.upper * c.arm,
    fore: H * RIG_RATIO.fore * c.arm,
    hand: H * RIG_RATIO.hand,
    thigh: H * RIG_RATIO.thigh * c.leg,
    shin: H * RIG_RATIO.shin * c.leg,
    foot: H * RIG_RATIO.foot,
    ankle: H * RIG_RATIO.ankle,
    girth: c.girth,
  };
  L.pelvis = L.thigh + L.shin + L.ankle; // standing pelvis height
  L.limbR = 0.032 * H * c.girth;          // a limb's radius
  L.bodyR = 0.085 * H * c.girth;          // the trunk's half-width
  return L;
}

const DEG = Math.PI / 180;
// a limb's direction: 0 down, + forward
const limbDir = (a) => [Math.sin(a * DEG), -Math.cos(a * DEG)];
// a trunk's direction: 0 up, + forward
const trunkDir = (a) => [Math.sin(a * DEG), Math.cos(a * DEG)];
const along = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];

/** The joints of a body in a pose: { pelvis, neck, head, shoulder, elbowF, handF, fistF, …, kneeF, ankleF, toeF, … }. */
export function rigJoints(body, pose) {
  const hip = pose.hip ?? [0, 0];
  const pelvis = [hip[0], body.pelvis + hip[1]];
  const J = { pelvis };
  J.neck = along(pelvis, trunkDir(pose.torso ?? 0), body.torso);
  J.shoulder = along(pelvis, trunkDir(pose.torso ?? 0), body.torso * 0.86);
  const hd = trunkDir(pose.head ?? pose.torso ?? 0);
  J.head = along(J.neck, hd, body.neck + body.head);
  for (const side of ['F', 'B']) {
    const arm = pose[`arm${side}`] ?? [0, 0];
    J[`elbow${side}`] = along(J.shoulder, limbDir(arm[0]), body.upper);
    J[`hand${side}`] = along(J[`elbow${side}`], limbDir(arm[1]), body.fore);
    J[`fist${side}`] = along(J[`hand${side}`], limbDir(arm[1]), body.hand);
    const leg = pose[`leg${side}`] ?? [0, 0, 90];
    J[`knee${side}`] = along(pelvis, limbDir(leg[0]), body.thigh);
    J[`ankle${side}`] = along(J[`knee${side}`], limbDir(leg[1]), body.shin + body.ankle);
    J[`toe${side}`] = along(J[`ankle${side}`], limbDir(leg[2] ?? 90), body.foot);
  }
  if (!pose.air) {
    // stand on the lowest foot point
    const low = Math.min(J.ankleF[1], J.ankleB[1], J.toeF[1], J.toeB[1]);
    for (const k of Object.keys(J)) J[k] = [J[k][0], J[k][1] - low];
  }
  return J;
}

// the bones a stick figure draws, and which joints bound them
export const RIG_BONES = Object.freeze([
  ['pelvis', 'neck'], ['neck', 'head'],
  ['shoulder', 'elbowB'], ['elbowB', 'fistB'], ['pelvis', 'kneeB'], ['kneeB', 'ankleB'], ['ankleB', 'toeB'],
  ['shoulder', 'elbowF'], ['elbowF', 'fistF'], ['pelvis', 'kneeF'], ['kneeF', 'ankleF'], ['ankleF', 'toeF'],
]);

// a striking point → the segment it ends (the hitbox is that segment, swept fat)
export const STRIKE_SEGMENTS = Object.freeze({
  fistF: ['elbowF', 'fistF'], fistB: ['elbowB', 'fistB'],
  toeF: ['kneeF', 'toeF'], toeB: ['kneeB', 'toeB'],
  ankleF: ['kneeF', 'ankleF'], ankleB: ['kneeB', 'ankleB'],
  kneeF: ['pelvis', 'kneeF'], kneeB: ['pelvis', 'kneeB'],
  elbowF: ['shoulder', 'elbowF'], elbowB: ['shoulder', 'elbowB'],
  head: ['neck', 'head'],
});

/** Interpolate two poses (t 0..1), angle by angle; `air` and `hip` blend too. */
export function lerpPose(a, b, t) {
  const mix = (x, y) => x + (y - x) * t;
  const out = { torso: mix(a.torso ?? 0, b.torso ?? 0), head: mix(a.head ?? a.torso ?? 0, b.head ?? b.torso ?? 0) };
  for (const k of ['armF', 'armB', 'legF', 'legB']) {
    const u = a[k] ?? [], v = b[k] ?? [];
    const n = Math.max(u.length, v.length);
    out[k] = [];
    for (let i = 0; i < n; i++) out[k].push(mix(u[i] ?? v[i] ?? 0, v[i] ?? u[i] ?? 0));
  }
  const ha = a.hip ?? [0, 0], hb = b.hip ?? [0, 0];
  out.hip = [mix(ha[0], hb[0]), mix(ha[1], hb[1])];
  if (t < 0.5 ? a.air : b.air) out.air = true;
  return out;
}

/** An axis-aligned box [x0, y0, x1, y1] around a segment, swept by a radius. */
export function segmentBox(p, q, r) {
  return [Math.min(p[0], q[0]) - r, Math.min(p[1], q[1]) - r, Math.max(p[0], q[0]) + r, Math.max(p[1], q[1]) + r];
}

/** The box around a set of points, padded. */
export function pointsBox(points, pad) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/**
 * A weapon's line in a pose: { grip, tip, butt } (rig mm), the blade along the grip hand's forearm turned by its
 * angle. `weapon` is the compiled one (lengths in mm). Null if there is none.
 */
export function weaponLine(J, weapon) {
  if (!weapon) return null;
  const s = weapon.grip === 'B' ? 'B' : 'F';
  const e = J[`elbow${s}`], f = J[`fist${s}`];
  const dx = f[0] - e[0], dy = f[1] - e[1];
  const n = Math.hypot(dx, dy) || 1;
  const a = (weapon.angle ?? 0) * DEG;
  const ux = (dx / n) * Math.cos(a) - (dy / n) * Math.sin(a), uy = (dx / n) * Math.sin(a) + (dy / n) * Math.cos(a);
  return { grip: f, tip: [f[0] + ux * weapon.length, f[1] + uy * weapon.length], butt: [f[0] - ux * (weapon.butt ?? 0), f[1] - uy * (weapon.butt ?? 0)] };
}

export const roundBox = (b) => b.map((v) => Math.round(v));
