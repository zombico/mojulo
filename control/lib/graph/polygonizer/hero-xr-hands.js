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
 *   • THE HAND WORDS (`poses`): open, relaxed, grip and fist per digit, the angles the page blends by the controller (the
 *     index: relaxed → open as the grip closes, then → fist by the trigger; the other three fingers relaxed → fist by the
 *     grip; the thumb relaxed, or fist while it rests on a thumb button; a hand that holds something starts every digit
 *     from `grip`, closed round it).
 *   • WHAT THE HAND HOLDS (`gear`: hero-gear.js gearMounts, the hand's slot): its triangles ride the hand bone's part, after
 *     the hand's own (`tris` of them, packLayeredRig appends them), so the page draws them apart, moved by `rehold` (an
 *     affine of the rest frame, 3 × 4 by rows) from the hero's rest hold to the headset's: a BLADE (a sword, a knife, a
 *     haft swung as one) out of the fist past the thumb, along the grip's −Z, its edge leading with the knuckles; a
 *     FIREARM PRESENTED, its grip's line through the fist toward the thumb and its bore along the hand away from the arm,
 *     turned PRESENT degrees toward the thumb (a pistol's grip angle); anything else (a bow, a long staff) kept as the
 *     hero holds it. A firearm's `muzzle` (its tip socket and its bore, in the headset's hold) is where a shot leaves from.
 *   • WHERE IT STRIKES (worlds/controllable/sweep.js): the fist's knuckles (`fist`), and a held blade's guard to its tip
 *     (`item.blade`, in the headset's hold).
 * → { R?, L? } per side the rig has a hand: { hand (its bone), grip: { o, x, y, z }, poses, digits: { <digit>: { lo, hi,
 * bones, k, b } }, fist, item? }; null for a rig without digits. Pure and deterministic: the rig's own kinematics, no dice, no
 * clock.
 */
import { rigNodesAt, boneFrames, handValue } from './station-loft-rig.js';
import { gripCentre, gearTriangles, gearRestPoint } from './hero-gear.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0, r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const WORDS = ['open', 'relaxed', 'grip', 'fist'];
/** a presented firearm's bore turned toward the thumb off the hand's line (degrees): a pistol grip's rake */
export const PRESENT = 12;
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const cols = (X, Y, Z) => [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
const mmT = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[j][0] + row[1] * b[j][1] + row[2] * b[j][2]));   // a · bᵀ

/** the item the hand holds, re-held for the headset (see the header), or null */
function heldItem(G, S, grip, dz) {
  if (!G || G.bone !== `hand${S}`) return null;
  const tris = gearTriangles([G])[0].triangles;
  if (!tris) return null;
  const gx = grip.x, gy = grip.y, gz = grip.z, c = grip.o;
  let V = null;   // the item's frame in the headset's hold (columns X, Y, Z: the item's own axes, +Z along it)
  if (G.hold === 'blade') { const Z = mul(gz, -1), X = mul(gy, -1); V = cols(X, cross(Z, X), Z); }
  else if (G.hold === 'firearm') {
    const a = PRESENT * Math.PI / 180, Z = unit([0, 1, 2].map((i) => -gy[i] * Math.cos(a) - gz[i] * Math.sin(a)));
    let Y = mul(gz, -1); Y = unit(sub(Y, mul(Z, dot(Y, Z)))); V = cols(cross(Y, Z), Y, Z);
  }
  // the rest hold, raised by dz: p = t' + M·k(q − o); the headset's: p = c + V·k(q − o); so p_vr = c + V·Mᵀ·(p − t')
  const t = [G.t[0], G.t[1], G.t[2] + dz];
  const A = V ? mmT(V, G.M) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]], o = V ? c : t, b = sub(o, mv(A, t));
  const rehold = [0, 1, 2].flatMap((i) => [...A[i].map(r6), r6(b[i])]);
  let muzzle = null;
  const tip = G.hold === 'firearm' && G.sockets?.tip?.origin;
  if (tip) {
    const rest = gearRestPoint(G, tip), p = [rest[0], rest[1], rest[2] + dz], q = [0, 1, 2].map((i) => dot(A[i], p) + b[i]);
    muzzle = { p: q.map(r6), d: mv(A, [G.M[0][2], G.M[1][2], G.M[2][2]]).map(r6) };
  }
  // a blade's striking part: its guard (else its grip's anchor) to its tip, in the headset's hold
  let blade = null;
  if (G.hold === 'blade' && G.sockets?.tip?.origin) {
    const at = (q) => { const r = gearRestPoint(G, q), p = [r[0], r[1], r[2] + dz]; return [0, 1, 2].map((i) => r6(dot(A[i], p) + b[i])); };
    blade = { a: at(G.sockets.guard?.origin ?? G.o), b: at(G.sockets.tip.origin) };
  }
  return { item: G.item, hold: G.hold, tris, rehold, ...(muzzle ? { muzzle } : {}), ...(blade ? { blade } : {}) };
}

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

export function xrHands(R, { dz = 0, samples = 7, gear = null } = {}) {
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
    const grip = gripFrame(R, S, dz), item = heldItem((gear || []).find((G) => G.slot === (S === 'R' ? 'right' : 'left')), S, grip, dz);
    // the fist's striking face (hero-reach.js handFeatures' knuckles: the folded first two fingers' backs, a phalanx's
    // radius out along the hand), at rest, raised by dz: where a punch lands
    const F = rigNodesAt(R, { [`fingers${S}`]: 'fist' }).nodes, along = unit(sub(R.joints[`middleMcp${S}`], R.joints[`wrist${S}`]));
    const kn = [0, 1, 2].map((i) => (F[`indexMcp${S}`][i] + F[`indexPip${S}`][i] + F[`middleMcp${S}`][i] + F[`middlePip${S}`][i]) / 4 + along[i] * 0.01);
    out[S] = { hand: `hand${S}`, grip, poses, digits, fist: [kn[0], kn[1], kn[2] + dz].map(r6), ...(item ? { item } : {}) };
  }
  return Object.keys(out).length ? out : null;
}
