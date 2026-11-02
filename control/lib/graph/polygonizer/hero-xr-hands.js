/**
 * hero-xr-hands — the hero's own hands as a headset draws them (the manual manipulator's controllers, P2): each hand
 * placed on its controller's GRIP POSE and its digits curled by the controller's trigger and grip, played by the page
 * from a small table, never solved there.
 *
 *   • THE GRIP FRAME (gripFrame): where WebXR's grip space sits in the hand. The spec puts its origin at the centroid of
 *     the curled fingers round a held rod, −Z along the rod toward the thumb, +X out of the back of the right hand (out
 *     of the palm of the left), +Y roughly up the arm. The hero's: the origin is the hand's own grip centre (hero-gear.js
 *     gripCentre: the circle the middle finger curls round in the `grip` word, where gear's held things sit), −Z the
 *     fist's hole toward the thumb (the index knuckle off the little one, square to the hand), +X the back of the hand
 *     (R) or the palm (L), +Y their cross: up the hand toward the wrist.
 *   • THE CURL TABLE (per digit): the digit's bones posed at `samples` curls evenly from `lo` to `hi` (degrees, the hand
 *     words' open or relaxed to the fist), each sample every bone's [q, head] as a rig clip carries it (station-loft-rig
 *     packLayeredRig: the bone's turn from rest and its posed head, raised by `dz`), so the page poses a bone as it poses
 *     every rig bone, head' + q·(v − restHead), nlerping between samples. A digit turns only its own bones (hero-hand.js:
 *     a link carries the later ones), so the digits' tables compose exactly.
 *   • THE HAND WORDS (`poses`): open, relaxed and fist per digit, the angles the page blends by the controller (the
 *     index: relaxed → open as the grip closes, then → fist by the trigger; the other three fingers relaxed → fist by the
 *     grip; the thumb open, or fist while it rests on a thumb button).
 * → { R?, L? } per side the rig has a hand: { hand (its bone), grip: { o, x, y, z }, poses, digits: { <digit>: { lo, hi,
 * bones, k, b } } }; null for a rig without digits. Pure and deterministic: the rig's own kinematics, no dice, no clock.
 */
import { rigNodesAt, boneFrames, handValue } from './station-loft-rig.js';
import { gripCentre } from './hero-gear.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0, r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const WORDS = ['open', 'relaxed', 'fist'];

/** the grip space's frame in the hand at rest, raised by dz: { o, x, y, z } (unit axes, the rig's frame) */
export function gripFrame(R, S, dz = 0) {
  const J = R.joints, at = (j) => J[`${j}${S}`];
  const along = unit(sub(at('middleMcp'), at('wrist')));
  let across = sub(at('indexMcp'), at('littleMcp')); across = unit(sub(across, mul(along, dot(across, along))));
  // the palm: the side the fingers close toward (a fist's middle tip lies in front of its knuckle)
  let palm = unit(cross(along, across));
  const fist = rigNodesAt(R, { [`fingers${S}`]: 'fist' }).nodes;
  if (dot(sub(fist[`middleTip${S}`], at('middleMcp')), palm) < 0) palm = mul(palm, -1);
  const z = mul(across, -1), x = S === 'L' ? palm : mul(palm, -1), y = cross(z, x), c = gripCentre(R, S);
  return { o: [c[0], c[1], c[2] + dz].map(r6), x: x.map(r6), y: y.map(r6), z: z.map(r6) };
}

export function xrHands(R, { dz = 0, samples = 7 } = {}) {
  if (!R.hands || !R.boneIndex) return null;
  const rest = Object.fromEntries(Object.entries(R.joints).map(([k, v]) => [k, [v[0], v[1], v[2] + dz]]));
  const framesAt = (pose) => {
    const { nodes } = rigNodesAt(R, pose);
    const shifted = Object.fromEntries(Object.entries(nodes).map(([n, v]) => [n, [v[0], v[1], v[2] + dz]]));
    for (const m of ['$body', '$facing', '$legYaw']) if (nodes[m]) Object.defineProperty(shifted, m, { value: nodes[m], enumerable: false });
    return boneFrames(R, rest, shifted);
  };
  const out = {};
  for (const S of Object.keys(R.hands)) {
    const H = R.hands[S];
    if (!H.digits || R.boneIndex[`hand${S}`] === undefined || !R.joints[`middleMcp${S}`]) continue;
    const poses = Object.fromEntries(WORDS.map((w) => [w, Object.fromEntries(Object.entries(handValue(R, `fingers${S}`, w)).map(([d, a]) => [d, r4(a)]))]));
    const digits = {};
    for (const d of Object.keys(H.digits)) {
      const bones = [1, 2, 3].map((i) => `${d}${i}${S}`).filter((id) => R.boneIndex[id] !== undefined);
      if (!bones.length) continue;
      const lo = Math.min(poses.open[d], poses.relaxed[d]), hi = poses.fist[d], b = [];
      for (let k = 0; k < samples; k++) {
        const f = framesAt({ [`fingers${S}`]: { [d]: lo + ((hi - lo) * k) / (samples - 1) } });
        for (const id of bones) { const g = f[R.boneIndex[id]]; b.push(...g.q.map(r4), ...g.head.map(r4)); }
      }
      digits[d] = { lo, hi, bones, k: samples, b };
    }
    out[S] = { hand: `hand${S}`, grip: gripFrame(R, S, dz), poses, digits };
  }
  return Object.keys(out).length ? out : null;
}
