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
 */
import '../polygonizer/hero-motion.js';                          // (first: hero-rest's cycle through it resolves in this order)
import { rigNodesAt, HAND_POSES } from '../polygonizer/station-loft-rig.js';
import { reachArm } from '../polygonizer/hero-stance.js';
import { ischOf, turnOf } from '../polygonizer/hero-rest.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const DEG = 180 / Math.PI;
const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export const KNEE = 118;
/** the iron's tread under the leather's end (tack.js: the ring's centre 5.5 cm under it, its radius 6 cm squashed to 0.85) */
export const IRON_DROP = 0.055 + 0.06 * 0.85;                                          // the knee's angle at the halt (degrees, inside)

/** the modes' parameters: `lift` the seat above the saddle (m), `rise` the rising trot's height at its top (m: its arch
 * from the footfalls), `follow` the share of the saddle's motion the pelvis
 * takes, `lean` the trunk forward of upright (deg), `pelvis` its own forward tilt (deg), `stirrup` the leathers'
 * change (m: shorter is negative), `elbow` the shoulder's flexion: the upper arm forward of the TRUNK's own down (deg:
 * by the sides when sitting, reaching forward in two-point, the jump's release further: within the shoulder's 90°; the
 * hands go where the elbow and the bit put them) */
export const RIDER_MODES = Object.freeze({
  sit: { lift: 0, rise: 0, follow: 1, lean: 2, pelvis: 0, stirrup: 0, elbow: 15 },
  rise: { lift: 0, rise: 0.085, follow: 1, lean: 12, pelvis: 4, stirrup: 0, elbow: 22 },
  two: { lift: 0.11, rise: 0, follow: 0.35, lean: 34, pelvis: 12, stirrup: -0.05, elbow: 50 },
  fold: { lift: 0.12, rise: 0, follow: 0.35, lean: 58, pelvis: 18, stirrup: -0.05, elbow: 70 },
  graze: { lift: 0, rise: 0, follow: 1, lean: 4, pelvis: 0, stirrup: 0, elbow: 30 },
});
const KEYS = Object.keys(RIDER_MODES.sit);
const blend = (a, b, w) => Object.fromEntries(KEYS.map((k2) => [k2, a[k2] + (b[k2] - a[k2]) * w]));

/** a world point carried from the stand into a pose by a bone (rest and pose frames: skin.js boneFrames) */
const carry = (rest, pose, bone, p) => { const r = rest[bone], q = pose[bone], d = sub(p, r.h), l = [dot(d, r.R[0]), dot(d, r.R[1]), dot(d, r.R[2])]; return add(add(add(mul(q.R[0], l[0]), mul(q.R[1], l[1])), mul(q.R[2], l[2])), q.h); };
const carryDir = (rest, pose, bone, v) => { const r = rest[bone], q = pose[bone], l = [dot(v, r.R[0]), dot(v, r.R[1]), dot(v, r.R[2])]; return add(add(mul(q.R[0], l[0]), mul(q.R[1], l[1])), mul(q.R[2], l[2])); };

/** where the rider meets the horse in a pose: the seat (on the saddle's bone), its axes, the bars, the bits, the crest */
export function ridingGeometry(anchors, frames, rest) {
  const fwd = unit(carryDir(rest, frames, 'saddle', [0, 1, 0])), side = unit(carryDir(rest, frames, 'saddle', [1, 0, 0]));
  return {
    seat: carry(rest, frames, 'saddle', anchors.seat), fwd, side, up: unit([side[1] * fwd[2] - side[2] * fwd[1], side[2] * fwd[0] - side[0] * fwd[2], side[0] * fwd[1] - side[1] * fwd[0]]),
    bars: { R: carry(rest, frames, 'saddle', anchors.bars.R), L: carry(rest, frames, 'saddle', anchors.bars.L) },
    bits: { R: carry(rest, frames, 'head', anchors.bits.R), L: carry(rest, frames, 'head', anchors.bits.L) },
    crest: carry(rest, frames, 'neck0', anchors.crest),
  };
}

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
export function riderPose(H, cal, geo, mode, { rise = 0, seatHold = null, seed = {} } = {}) {
  // (a foot an iron puts past the leg's reach is clamped to it, not refused: the rider's rig handle says so)
  if (H.R.reach !== 'clamp') H.R = { ...H.R, reach: 'clamp' };
  const { R } = H;
  const pitchS = Math.atan2(geo.fwd[2], Math.hypot(geo.fwd[0], geo.fwd[1])) * DEG, rollS = Math.atan2(geo.side[2], Math.hypot(geo.side[0], geo.side[1])) * DEG;
  // the pelvis: on the seat (following its pitch), or out of it by the mode's lift (and the rise), a share of the
  // saddle's motion taken (the rest held steady by the legs)
  const seatAt = seatHold ? lerp(seatHold, geo.seat, mode.follow) : geo.seat;
  const up = [0, 0, 1], fwdFlat = unit([geo.fwd[0], geo.fwd[1], 0]);
  const lift = mode.lift + rise, contact = add(add(seatAt, mul(up, lift)), mul(fwdFlat, 0.4 * lift));
  const pitch = -pitchS * mode.follow + mode.pelvis, roll = rollS * mode.follow;
  const root = rootAt(R, contact, pitch, roll);
  // the trunk over the pelvis to the mode's lean (the world's), the head level, looking ahead
  let pose = { ...root.words, hinge: Math.max(-30, Math.min(90, mode.lean - pitch)), spine: { sagittal: 0, lateral: 0, axial: 0 } };
  pose = { ...pose, ...headUp(R, pose, geo) };
  // the feet on the irons: the leathers hang plumb from the bars, the ball of the foot on the tread
  // (out from the bar by `cal.out`: the leather lies over the flap and hangs round the barrel, the iron outside it)
  const L = cal.leather + mode.stirrup, feet = {};
  for (const S of ['R', 'L']) feet[S] = add(add(geo.bars[S], mul(geo.side, (S === 'R' ? 1 : -1) * (cal.out ?? 0))), [0, 0, -(L + IRON_DROP)]);
  pose = { ...pose, feet: { R: toUpright(root.T, root.at, feet.R), L: toUpright(root.T, root.at, feet.L) }, splayR: cal.splay, splayL: cal.splay };
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
export function riderSeat(H, geo0, clear) {
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
  for (let it = 0; it < 3; it++) {
    cal.out = outFor(cal.leather);
    // the splay: the least that keeps the knees out of the horse
    let best = null;
    for (let sp = 0; sp <= 60; sp += 5) {
      const p = riderPose(H, { ...cal, splay: sp }, geo0, mode).pose, n = rigNodesAt(R, p).nodes;
      const out = Math.min(clear(n[R.legs.R.knee]), clear(n[R.legs.L.knee]), clear(lerp(n[R.legs.R.hip], n[R.legs.R.knee], 0.6)), clear(lerp(n[R.legs.L.hip], n[R.legs.L.knee], 0.6)));
      if (out > 0.05) { best = sp; break; }
      if (!best || out > best.out) best = { sp, out };
    }
    cal.splay = typeof best === 'number' ? best : best.sp;
    // the leathers: bisected for the knee's angle (longer opens it)
    let lo = 0.25, hi = 0.75;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2, n = rigNodesAt(R, riderPose(H, { ...cal, leather: m }, geo0, mode).pose).nodes, a = (kneeAngle(n, 'R') + kneeAngle(n, 'L')) / 2;
      if (a < KNEE) lo = m; else hi = m;
    }
    cal.leather = (lo + hi) / 2;
  }
  cal.out = outFor(cal.leather);
  return cal;
}

/**
 * Each key's mode for a clip: the gait's seat, a transition's blended from the one it leaves to the one it reaches over
 * its middle, the jump's fold keyed to its flight; and the rising trot's rise from the footfalls (out of the saddle while
 * the left fore stands, a smooth arch over its stance). `frames` the clip's solved poses at its keys, `keyTime(k)`.
 */
export function riderClipModes(name, clip, frames, keyTime) {
  const gaitMode = (g) => (g === 'trot' ? 'rise' : g === 'gallop' ? 'two' : 'sit');
  const M = RIDER_MODES, K = frames.length;
  const tr = /^([a-zA-Z]+)-([a-zA-Z]+)$/.exec(name);
  const modeAt = (t) => {
    if (name === 'graze') { const u = t / clip.s; return blend(M.sit, M.graze, sm(u / 0.25) * sm((1 - u) / 0.25)); }
    if (name === 'jump') {
      const f = clip.flight, w = sm((t - (f.launch - 0.35)) / 0.3) * sm((f.touchdown + 0.4 - t) / 0.35), app = sm((t - 0.2) / 0.6) * sm((clip.s - 0.3 - t) / 0.6);
      return blend(blend(M.sit, M.two, app), M.fold, w);
    }
    if (tr && !/^idle/.test(name)) { const a = M[gaitMode(tr[1])], b = M[gaitMode(tr[2])], w = sm((t / clip.s - 0.3) / 0.4); return blend(a, b, w); }
    return M[gaitMode(name)];
  };
  // the left fore's stances over the keys (wrapping round a loop) → the rise's arch, sin² over each stance
  const on = frames.map((f) => !!f.contact?.LF), loop = !clip.once, arch = new Array(K).fill(0);
  for (let k = 0; k < K; k++) {
    if (!on[k]) continue;
    let a = k, b = k;
    for (let i = 1; i < K && on[(k - i + K) % K] && (loop || k - i >= 0); i++) a = k - i;
    for (let i = 1; i < K && on[(k + i) % K] && (loop || k + i < K); i++) b = k + i;
    arch[k] = Math.sin(Math.PI * (k - a + 0.5) / (b - a + 1)) ** 2;
  }
  return frames.map((f, k) => { const m = modeAt(keyTime(k)); return { mode: m, rise: m.rise * arch[k] }; });
}
