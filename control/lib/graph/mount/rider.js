/**
 * rider — a rider on the mount: the realistic hero (polygonizer: its rig, its skin, its posing words) seated in the
 * saddle and carried by the horse, its pose solved every frame from where the horse puts the saddle, the irons and the
 * bit, by the riding seat the moment asks for.
 *
 * THE SEAT (the classical position, after the riding manuals' line: ear, shoulder, hip and heel on one plumb line; the
 * sit bones on the seat's lowest point, the thighs down along the flaps, the lower legs on the girth, the balls of the
 * feet on the irons with the heels below them, the hands a little over and before the withers with a straight line
 * from the elbow through the hand to the bit). The stirrup length is the rider's: the knee bent to `KNEE` at the halt.
 *
 * THE MODES (mechanics, not choreography: each is what the horse's motion asks of the body over it):
 *   sit   the walk, the halt, the canter: the pelvis on the seat, FOLLOWING its pitch and roll; the trunk held upright
 *         over it (the hip and the lower back take up the saddle's rock)
 * In every mode THE HEAD IS HELD UP (the rider sees where it is going): the neck and the head extend against the trunk's
 * lean until the head stands upright, within what the neck's muscles hold (NECK).
 *   rise  the trot: rising on the diagonal: out of the saddle while the left fore and right hind stand (the outside
 *         fore swinging forward), sitting as they leave the ground; the knee and ankle the springs, the trunk a little
 *         forward
 *   two   the gallop (and the approach to a fence): two-point, the seat out of the saddle and steady while the horse
 *         heaves under it (the legs take the motion: the feet ride the irons, the pelvis follows only a share of the
 *         saddle's), the stirrups two holes shorter, the trunk forward over the hands
 *   fold  the jump's flight: the hip closed over the neck as the horse rises, the hands released forward along the
 *         crest, opening again to land
 * A clip blends them through its time (a transition from one gait's seat to the next's), the jump keyed to its flight.
 *
 *   ridingGeometry(B, anchors, frames, rest) → { seat, fwd, side, up, bars, bits, crest } (world, a pose)
 *   RIDER_MODES, riderSeat(H, geo0) → the rider's calibration (stirrup length, splay) at the stand
 *   riderPose(H, cal, geo, mode, seed) → { pose (the hero's words), contacts, seed }
 *   riderClipModes(name, clip, frames) → per key the mode's parameters (blended), the rise from the footfalls
 *   rideCharacter(B, H, clips, { anchors, cal, rest, fps }) → per clip, at the horse's own keys: the character's pose
 *     words, its fists (the reins'), the targets (the sockets'), the horse's geometry
 *
 * THE RIDER IS A FUNCTION, not a model: H is any character the studio makes ({ R: its rig, … }: a layered recipe's
 * validated rig), solved to the targets the horse asks (ridden.js rideTargets) by its own posing words.
 */
import '../polygonizer/hero-motion.js';                          // (first: hero-rest's cycle through it resolves in this order)
import { rigNodesAt, HAND_POSES } from '../polygonizer/station-loft-rig.js';
import { reachArm } from '../polygonizer/hero-stance.js';
import { ischOf, turnOf } from '../polygonizer/hero-rest.js';
import { RIDER_MODES, IRON_DROP, rideTargets, riderClipModes, ridingGeometry } from './ridden.js';
import { boneFrames } from './skin.js';
export { RIDER_MODES, riderModeAt, riderClipModes, CARRIAGE, carriageOf, riddenFrame, ridingGeometry, rideTargets, reinCurve, IRON_DROP, rideSockets, reinRig } from './ridden.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const DEG = 180 / Math.PI;

export const KNEE = 118;                                          // the knee's angle at the halt (degrees, inside)

const toUpright = (T, at, p) => { const d = sub(p, at), M = T.M; return add(at, [M[0][0] * d[0] + M[1][0] * d[1] + M[2][0] * d[2], M[0][1] * d[0] + M[1][1] * d[1] + M[2][1] * d[2], M[0][2] * d[0] + M[1][2] * d[1] + M[2][2] * d[2]]); };

/**
 * The root words that put the sit bones at `contact`, the body turned by `pitch` (deg, forward +) and `roll` (deg):
 * the hero's own seating (hero-rest.js seated), here on a saddle.
 */
function rootAt(R, contact, pitch, roll) {
  const isch = ischOf(R), T = turnOf({ pitch, roll }), at = sub(contact, T.apply(isch));
  // (`sink` lowers the root, `lift` raises it: a saddle is above where the hero stands, so it is lifted)
  const dz = at[2] - R.joints.pelvisHub[2];
  return { T, at, words: { support: 'none', ...(dz >= 0 ? { lift: dz } : { sink: -dz }), shift: { x: at[0], y: at[1] }, body: { pitch, roll, at, up: 0 } } };
}

/** the rider's pose in a moment: `geo` ridingGeometry's, `mode` the blended parameters, `cal` riderSeat's, `extra`
 * { rise (m, the rising trot's own), seatHold (a steadier seat for a share of follow: the world point the pelvis
 * would keep) } */
export function riderPose(H, cal, geo, mode, { rise = 0, seatHold = null, seed = {}, legsOnly = false } = {}) {
  // (a foot an iron puts past the leg's reach is clamped to it, not refused: the rider's rig handle says so)
  if (H.R.reach !== 'clamp') H.R = { ...H.R, reach: 'clamp' };
  const { R } = H;
  const T = rideTargets(geo, mode, cal, { rise, seatHold }), { seat: contact, pitch, roll, fwdFlat } = T;
  const root = rootAt(R, contact, pitch, roll);
  // the trunk over the pelvis to the mode's lean (the world's), the head level, looking ahead
  let pose = { ...root.words, hinge: Math.max(-30, Math.min(90, mode.lean - pitch)), spine: { sagittal: 0, lateral: 0, axial: 0 } };
  if (!legsOnly) pose = { ...pose, ...headUp(R, pose, geo) };
  // the feet on the irons (the balls of the feet on the treads)
  const feet = T.irons;
  pose = { ...pose, feet: { R: toUpright(root.T, root.at, feet.R), L: toUpright(root.T, root.at, feet.L) }, splayR: cal.splay, splayL: cal.splay };
  // (`legsOnly`: the seat and the legs alone, the trunk's lean, its head and arms left at rest: a calibration's)
  if (legsOnly) return { pose, contacts: { seat: contact, irons: feet }, seed };
  // THE ARMS by the riding rule: the upper arm hangs from the shoulder by the side (forward of the trunk's own down by
  // the mode's `elbow`), and the forearm, the hand and the rein make ONE STRAIGHT LINE from the elbow to the bit: the hand is a
  // forearm's length from the elbow toward the bit, the wrist straight (the thumbs on top, the fists closed on the
  // reins), the elbow bent down and back, never out or forward
  const n0 = rigNodesAt(R, pose).nodes, l1 = len(sub(R.joints.shoulderR, R.joints.elbowR)), l2 = len(sub(R.joints.elbowR, R.joints.wristR)), a = mode.elbow / DEG;
  // (the arm's angle against the trunk: its own up, from the pelvis to the neck, and its forward square to that)
  const tUp = unit(sub(n0.neckHub, n0.pelvisHub)), tFwd = unit(sub(fwdFlat, mul(tUp, dot(fwdFlat, tUp))));
  const hands = {}, elbows = {}, next = {};
  for (const S of ['R', 'L']) {
    const sd = S === 'R' ? 1 : -1, sh = n0[`shoulder${S}`];
    const el = add(add(sh, mul(add(mul(tUp, -Math.cos(a)), mul(tFwd, Math.sin(a))), l1)), mul(geo.side, -sd * 0.025));
    elbows[S] = el; hands[S] = add(el, mul(unit(sub(geo.bits[S], el)), l2));
  }
  for (const S of ['R', 'L']) {
    const sd = S === 'R' ? 1 : -1, r = reachArm(R, pose, S, hands[S], seed[S] ?? null, { pole: [sd * 0.1, -0.6, -1] });
    pose = { ...pose, [`sh${S}`]: r.sh, [`elbow${S}`]: r.elbow, [`wrist${S}`]: { flex: 0, deviation: 0, twist: 0 }, [`fingers${S}`]: { ...HAND_POSES.fist } };
    next[S] = r;
  }
  return { pose, contacts: { seat: contact, irons: feet, hands, elbows }, seed: next };
}

/** the neck's and the head's extension the rider can hold (deg: the cervical spine's, the head's on the atlas) and the
 * head's tilt it holds them for: upright, the eyes on where it is going (a few degrees forward: the gaze a little down) */
export const NECK = Object.freeze({ neck: 45, head: 25, tilt: 5 });

/**
 * The head held UP whatever the trunk does: the neck and the head extended (the neck's muscles: its share first, the
 * head's on the atlas after) until the head's own axis stands within `NECK.tilt` of plumb, looking ahead over the
 * horse's ears; past what the neck can extend it holds its most (the eyes do the rest). Bisected on the posed head.
 */
function headUp(R, pose, geo) {
  const fwd = [geo.fwd[0], geo.fwd[1], 0], fl = Math.hypot(fwd[0], fwd[1]) || 1;
  const tilt = (e) => { const n = rigNodesAt(R, { ...pose, ...split(e) }).nodes, u = sub(n.headTop, n.headBase); return Math.atan2((u[0] * fwd[0] + u[1] * fwd[1]) / fl, u[2]) * DEG; };
  const max = NECK.neck + NECK.head;
  if (tilt(0) <= NECK.tilt) return split(0);
  if (tilt(max) > NECK.tilt) return split(max);
  let lo = 0, hi = max;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (tilt(m) > NECK.tilt) lo = m; else hi = m; }
  return split((lo + hi) / 2);
}
/** an extension shared between the neck (its first `NECK.neck`, three fifths at a time) and the head on the atlas */
function split(e) {
  const neck = Math.min(NECK.neck, 0.6 * e), head = Math.min(NECK.head, e - neck);
  return { neck: { pitch: neck }, head: { pitch: head } };
}

/**
 * The rider's calibration at the stand: the stirrup leathers' length that bends the knee to KNEE with the seat in the
 * saddle, the feet's splay that carries the knees out round the barrel (`clear(p)` the horse's field: the knee kept a
 * thigh's thickness out of it), how far `out` of the bar the irons hang (round the barrel). → { leather, splay, out }
 */
export function riderSeat(H, geo0, clear, { passes = 3 } = {}) {
  if (H.R.reach !== 'clamp') H.R = { ...H.R, reach: 'clamp' };
  const { R } = H, mode = RIDER_MODES.sit;
  const kneeAngle = (n, S) => { const L = R.legs[S], a = sub(n[L.hip], n[L.knee]), b = sub(n[L.hock], n[L.knee]); return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))) * DEG; };
  let cal = { leather: 0.45, splay: 20, out: 0 };
  // how far out of the bar the iron hangs: the barrel's side at the iron's height, a boot and a flap beyond it
  const outFor = (leather) => {
    const z = geo0.bars.R[2] - leather - IRON_DROP, y = geo0.bars.R[1];
    let lo = 0, hi = 0.8;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (clear([m, y, z]) > 0) hi = m; else lo = m; }
    return Math.max(0, hi + 0.055 - geo0.bars.R[0]);
  };
  for (let it = 0; it < passes; it++) {
    cal.out = outFor(cal.leather);
    // the splay: the least that keeps the knees out of the horse
    let best = null;
    for (let sp = 0; sp <= 60; sp += 5) {
      const p = riderPose(H, { ...cal, splay: sp }, geo0, mode, { legsOnly: true }).pose, n = rigNodesAt(R, p).nodes;
      const out = Math.min(clear(n[R.legs.R.knee]), clear(n[R.legs.L.knee]), clear(lerp(n[R.legs.R.hip], n[R.legs.R.knee], 0.6)), clear(lerp(n[R.legs.L.hip], n[R.legs.L.knee], 0.6)));
      if (out > 0.05) { best = sp; break; }
      if (!best || out > best.out) best = { sp, out };
    }
    cal.splay = typeof best === 'number' ? best : best.sp;
    // the leathers: bisected for the knee's angle (longer opens it)
    let lo = 0.25, hi = 0.75;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2, n = rigNodesAt(R, riderPose(H, { ...cal, leather: m }, geo0, mode, { legsOnly: true }).pose).nodes, a = (kneeAngle(n, 'R') + kneeAngle(n, 'L')) / 2;
      if (a < KNEE) lo = m; else hi = m;
    }
    cal.leather = (lo + hi) / 2;
  }
  cal.out = outFor(cal.leather);
  return cal;
}


/** the fist's middle (the rein runs through it): between the wrist and the knuckles */
export const fistOf = (n, S) => n[`wrist${S}`].map((x, i) => x + (n[`knuckles${S}`][i] - x) * 0.55);

export function rideCharacter(B, H, clips, { anchors, cal, rest, fps = 30 } = {}) {
  const out = {};
  for (const [name, c] of Object.entries(clips)) {
    const K = c.once ? Math.max(2, Math.round(c.s * fps) + 1) : Math.max(2, Math.round(c.s * fps)), kt = (k) => (c.once ? c.s * k / (K - 1) : c.s * k / K);
    const frames = Array.from({ length: K }, (_, k) => c.at(kt(k))), F = frames.map((f) => boneFrames(B, f)), geos = F.map((f) => ridingGeometry(anchors, f, rest));
    const modes = riderClipModes(name, c, frames, kt), wk = Math.max(1, Math.round(0.17 * fps));
    // (the two-point's steadier seat: the saddle's place averaged over a third of a second)
    const hold = geos.map((_, k) => { const acc = [0, 0, 0]; let m = 0; for (let j = -wk; j <= wk; j++) { const i = c.once ? Math.min(K - 1, Math.max(0, k + j)) : (k + j + K) % K; for (let q = 0; q < 3; q++) acc[q] += geos[i].seat[q]; m++; } return acc.map((x) => x / m); });
    const poses = [], fists = [], targets = [];
    let seed = {};
    // (getting on or off: the mount's own keyframed solve, its riding end the halt's riding pose)
    const way = c.ride ?? null, mk = way ? mountKeys(H, cal, geos[way === 'mount' ? K - 1 : 0], way) : null;
    for (let k = 0; k < K; k++) {
      const o = { rise: modes[k].rise, seatHold: hold[k] }, r = way ? mountPose(H, cal, geos[way === 'mount' ? K - 1 : 0], way, k / (K - 1), { seed, keys: mk }) : riderPose(H, cal, geos[k], modes[k].mode, { ...o, seed });
      seed = r.seed; poses.push(r.pose);
      const n = rigNodesAt(H.R, r.pose).nodes; fists.push({ R: fistOf(n, 'R'), L: fistOf(n, 'L') });
      targets.push(rideTargets(geos[k], modes[k].mode, cal, o));
    }
    out[name] = { K, once: !!c.once, s: c.s, poses, fists, targets, geos, modes };
  }
  return out;
}

// ─── getting on and off ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * MOUNTING from the near (left) side, the way riders do it: facing the horse at its shoulder, the left leather let down
 * (`MOUNTING.letDown`: an iron at riding length is near the hip), the left foot in the left iron, the left hand at the
 * withers and the right on the pommel; the spring up to stand in that iron, leaning over the saddle; the right leg swung
 * over the croup as the body turns to face forward; settled into the seat, the right foot finding its iron, the reins
 * taken up: the halt's riding pose, exactly, at its end. DISMOUNTING the other way: both feet out, leaning forward on
 * the withers, the right leg over the croup, sliding down the near side to land on both feet facing the horse, then
 * standing. Each a keyframed path of the character's targets (its pelvis, its facing, its feet, its hands, its lean),
 * scaled to the character (its standing height, its legs) and to this horse (its seat, its bars, its irons), eased
 * between (Catmull-Rom), solved to the character's own rig by its posing words every key.
 */
export const MOUNTING = Object.freeze({ letDown: 0.22, mountSeconds: 3.4, dismountSeconds: 2.8 });

const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)); };
/** a keyframed path at u: keys [{ u, v }] (v an array), Catmull-Rom between, eased (smoothstep) within each span */
function along(keys, u) {
  if (u <= keys[0].u) return keys[0].v;
  for (let i = 0; i + 1 < keys.length; i++) {
    if (u > keys[i + 1].u) continue;
    const t0 = (u - keys[i].u) / (keys[i + 1].u - keys[i].u), t = t0 * t0 * (3 - 2 * t0);
    return cr((keys[i - 1] ?? keys[i]).v, keys[i].v, keys[i + 1].v, (keys[i + 2] ?? keys[i + 1]).v, t);
  }
  return keys[keys.length - 1].v;
}

/** the character's standing feet off its pelvis hub (rest), turned by a facing (deg), on the floor */
function standingFeet(R, hub, facing) {
  const a = facing / DEG, c = Math.cos(a), s = Math.sin(a), out = {};
  for (const S of ['R', 'L']) { const o = sub(R.joints[R.legs[S].toeBase], R.joints.pelvisHub); out[S] = [hub[0] + o[0] * c - o[1] * s, hub[1] + o[0] * s + o[1] * c, R.joints[R.legs[S].toeBase][2]]; }
  return out;
}

/** the character's hands hanging at its sides (its rest wrists off its hub), turned by a facing (deg) */
function hangingHands(R, hub, facing) {
  const a = facing / DEG, c = Math.cos(a), s = Math.sin(a), out = {};
  for (const S of ['R', 'L']) { const o = sub(R.joints[`wrist${S}`], R.joints.pelvisHub); out[S] = [hub[0] + o[0] * c - o[1] * s, hub[1] + o[0] * s + o[1] * c, hub[2] + o[2]]; }
  return out;
}

/** where a rider stands to get on, and is set down getting off: on the ground at the near (left) shoulder, facing the
 * horse (`facing` degrees from the horse's forward, the character's own turn) */
export function mountStand(geo) {
  const at = add(add(geo.seat, mul(geo.side, -0.58)), mul(geo.fwd, 0.12));
  return { at: [at[0], at[1], 0], facing: -90 };
}

/** the targets' keyframes for getting on (`way` 'mount') or off ('dismount') this horse, for this character */
export function mountKeys(H, cal, geo, way) {
  const { R } = H, J = R.joints, hub0 = J.pelvisHub[2], leg = len(sub(J[R.legs.L.hip], J[R.legs.L.knee])) + len(sub(J[R.legs.L.knee], J[R.legs.L.hock]));
  const seat = geo.seat, fwd = geo.fwd, side = geo.side, up = [0, 0, 1];
  // the riding halt (the end of a mount, the start of a dismount): the riding solve's own pose and targets
  const ride = riderPose(H, cal, geo, RIDER_MODES.sit), rHub = ride.pose.body.at;
  const irons = ride.contacts.irons, rHands = ride.contacts.hands;
  const ironDown = add(irons.L, [0, 0, -MOUNTING.letDown]);              // the near iron let down for getting on
  // the ground beside the near shoulder, facing the horse (the rider's front toward +side: facing −90° turns +y to +x)
  const ground = mountStand(geo).at, standHub = [ground[0], ground[1], hub0];
  const withers = lerp(seat, geo.crest, 0.55), pommel = add(add(seat, mul(fwd, 0.2)), mul(up, 0.1));
  const handsAtSaddle = { L: add(withers, add(mul(side, -0.1), mul(up, 0.06))), R: add(pommel, mul(side, 0.02)) };
  const over = add(add(seat, mul(fwd, -0.48)), mul(up, 0.36)), farSide = add(add(seat, mul(side, 0.3)), add(mul(fwd, -0.12), mul(up, -0.08)));
  const k = (u, hub, facing, feet, hands, lean) => ({ u, hub, facing, feet, hands: hands ?? hangingHands(R, hub, facing), lean });
  const stand0 = standingFeet(R, standHub, -90), keyed = (K) => Object.assign(K, { ride });
  if (way === 'mount') return keyed([
    k(0, standHub, -90, stand0, null, 0),
    k(0.2, add(standHub, [0, 0, -0.04]), -90, { L: ironDown, R: stand0.R }, handsAtSaddle, 12),
    k(0.42, add(add(ironDown, mul(side, 0.14)), [0, 0, leg * 0.95]), -90, { L: ironDown, R: add(add(ironDown, mul(side, 0.05)), mul(fwd, -0.12)) }, handsAtSaddle, 28),
    k(0.62, add(add(seat, mul(side, -0.12)), mul(up, 0.34)), -55, { L: ironDown, R: over }, handsAtSaddle, 30),
    k(0.8, add(add(seat, mul(side, -0.02)), mul(up, 0.2)), -12, { L: lerp(ironDown, irons.L, 0.5), R: farSide }, handsAtSaddle, 18),
    k(1, rHub, 0, irons, rHands, null),
  ]);
  // dismounting: both feet out, the lean forward on the withers, the right leg over, the slide down the near side
  const land = add(standHub, [0, 0, -0.07]);
  return keyed([
    k(0, rHub, 0, irons, rHands, null),
    k(0.15, add(rHub, mul(up, 0.02)), 0, { L: add(irons.L, mul(side, -0.06)), R: add(irons.R, mul(side, 0.06)) }, handsAtSaddle, 20),
    k(0.42, add(add(seat, mul(side, -0.1)), mul(up, 0.32)), -40, { L: add(irons.L, mul(side, -0.08)), R: over }, handsAtSaddle, 32),
    k(0.66, add(add(seat, mul(side, -0.4)), mul(up, -0.1)), -90, { L: add(standingFeet(R, land, -90).L, [0, 0, 0.25]), R: add(standingFeet(R, land, -90).R, [0, 0, 0.3]) }, handsAtSaddle, 18),
    k(0.82, land, -90, standingFeet(R, land, -90), handsAtSaddle, 8),
    k(1, standHub, -90, stand0, null, 0),
  ]);
}

/** the pose words for the targets at u: the pelvis hub placed, the core turned, the feet and the hands reached */
export function mountPose(H, cal, geo, way, u, { seed = {}, keys = null } = {}) {
  if (H.R.reach !== 'clamp') H.R = { ...H.R, reach: 'clamp' };
  const { R } = H, K = keys ?? mountKeys(H, cal, geo, way);
  // at the riding end, the riding solve itself (the clip hands over to the riding clips without a seam)
  if ((way === 'mount' && u >= 1) || (way === 'dismount' && u <= 0)) return riderPose(H, cal, geo, RIDER_MODES.sit, { seed });
  const at = (f) => along(K.map((q) => ({ u: q.u, v: f(q) })), u);
  const rWords = (K.ride ?? riderPose(H, cal, geo, RIDER_MODES.sit)).pose;
  const hub = at((q) => q.hub), facing = at((q) => [q.facing])[0];
  const feet = { R: at((q) => q.feet.R), L: at((q) => q.feet.L) };
  // (the lean: the riding hinge where the key leaves it to the ride, else the key's own)
  const lean = at((q) => [q.lean ?? rWords.hinge])[0];
  const fa = facing / DEG, fwdOf = [-Math.sin(fa), Math.cos(fa), 0];
  let pose = { support: 'none', ...(hub[2] >= R.joints.pelvisHub[2] ? { lift: hub[2] - R.joints.pelvisHub[2] } : { sink: R.joints.pelvisHub[2] - hub[2] }), shift: { x: hub[0], y: hub[1] }, facing, hinge: Math.max(-30, Math.min(90, lean)), spine: { sagittal: 0, lateral: 0, axial: 0 } };
  pose = { ...pose, ...headUp(R, pose, { fwd: fwdOf }) };
  // the feet: the toes turned with the body (splay carries a foot about the vertical: the right's outward is its own)
  pose = { ...pose, feet, splayR: -facing + cal.splay * Math.max(0, (u - 0.6) / 0.4), splayL: facing + cal.splay * Math.max(0, (u - 0.6) / 0.4) };
  // the hands: hanging while standing free, on the withers and the pommel while getting on or off, on the reins' line
  // at the ride's end
  const hv = at((q) => [...q.hands.R, ...q.hands.L]), next = {};
  for (const [S, o] of [['R', 0], ['L', 3]]) {
    const sd = S === 'R' ? 1 : -1, r = reachArm(R, pose, S, hv.slice(o, o + 3), seed[S] ?? null, { pole: [sd * 0.1, -0.6, -1] });
    pose = { ...pose, [`sh${S}`]: r.sh, [`elbow${S}`]: r.elbow, [`fingers${S}`]: { ...HAND_POSES[u > 0.12 && u < 0.97 ? 'fist' : 'relaxed'] } };
    next[S] = r;
  }
  return { pose, contacts: { hub, feet }, seed: next };
}
