/**
 * pose — a mount's skeleton at one instant, from the solved state: the trunk heaved, pitched, rolled (twisting between
 * its girdles) and swayed about the centre of mass, the pelvis turned about the lumbosacral joint, the neck swung about its base and the head counter-turned, the
 * tail swung about its root, each leg as its solve placed it. Every bone as { head, tail } in metres [x, y, z], the
 * mount's right at +x. The bones are the rig's: the clips pack them as they are named here.
 *
 *   MOUNT_BONES   [{ id, parent }] in parent-first order (the rig's order)
 *   bodyPoint(B, state, p, pelvic)   a body-frame point in the world
 *   legPlane(G, xh), fromPlane(plane, p)   a leg's plane and its points in the world
 *   assemble(B, state) → { bones, points }
 */
import { add, sub, mul, rot, dir } from './limb.js';

const DEG = Math.PI / 180;
const NECK_W = [0.34, 0.26, 0.2, 0.12, 0.08];       // the neck's swing shared from its base up (the base turns most)
const TAIL_W = [0.4, 0.3, 0.2, 0.1];

const legBones = (s) => [
  { id: `scapula${s}`, parent: 'spine3' }, { id: `humerus${s}`, parent: `scapula${s}` }, { id: `radius${s}`, parent: `humerus${s}` },
  { id: `cannonF${s}`, parent: `radius${s}` }, { id: `pasternF${s}`, parent: `cannonF${s}` }, { id: `hoofF${s}`, parent: `pasternF${s}` },
  { id: `femur${s}`, parent: 'spine0' }, { id: `tibia${s}`, parent: `femur${s}` }, { id: `cannonH${s}`, parent: `tibia${s}` },
  { id: `pasternH${s}`, parent: `cannonH${s}` }, { id: `hoofH${s}`, parent: `pasternH${s}` },
];
export const MOUNT_BONES = Object.freeze([
  { id: 'spine1', parent: null },                                  // the loin: the root, lumbosacral → loin
  { id: 'spine2', parent: 'spine1' }, { id: 'spine3', parent: 'spine2' }, { id: 'spine0', parent: 'spine1' },
  { id: 'neck0', parent: 'spine3' }, { id: 'neck1', parent: 'neck0' }, { id: 'neck2', parent: 'neck1' },
  { id: 'neck3', parent: 'neck2' }, { id: 'neck4', parent: 'neck3' },
  { id: 'head', parent: 'neck4' }, { id: 'jaw', parent: 'head' }, { id: 'earR', parent: 'head' }, { id: 'earL', parent: 'head' },
  { id: 'tail0', parent: 'spine0' }, { id: 'tail1', parent: 'tail0' }, { id: 'tail2', parent: 'tail1' }, { id: 'tail3', parent: 'tail2' },
  { id: 'tailHair', parent: 'tail3' },
  ...legBones('R'), ...legBones('L'),
  { id: 'saddle', parent: 'spine2' }, { id: 'bit', parent: 'head' },
].map(Object.freeze));

/** the tail's rest: the dock arching out from its root and falling, four bones; the hair hanging from its end */
function tailRest(B) {
  const root = B.trunk.tailRoot, seg = B.tail.dock / 4, out = [root];
  const angles = [-150, -125, -105, -95].map((a) => a * DEG);
  for (const a of angles) out.push(add(out[out.length - 1], mul(dir(a), seg)));
  return out;
}

/**
 * The body frame to the world: a body point [x, y, z] (the centre of mass over the origin) rolled about the spine's line
 * by the roll at its place along the trunk (the hind girdle's at the hip, the fore's at the shoulder, eased between:
 * the trunk twists about its spine), turned by the lumbosacral flexion if it rides the pelvis, pitched about the centre
 * of mass, then swayed sideways and heaved. Every point of the trunk, neck, head, tail and girdles passes through it.
 */
export function bodyPoint(B, st, p, pelvic = false) {
  const T = B.trunk, cz = T.com[1];
  let x = p[0], y = p[1], z = p[2];
  // the roll first, about the spine's own line (the axis the trunk twists about), so the spine's bones keep their length
  const yH = T.hip[0], yF = T.scapulaPivot[0];
  const w = Math.min(1, Math.max(0, (p[1] - yH) / (yF - yH)));
  const roll = (st.rollH || 0) + ((st.rollF || 0) - (st.rollH || 0)) * w;
  if (roll) {
    const za = spineHeight(T, p[1]), c = Math.cos(roll), sn = Math.sin(roll);
    const xr = x * c + (z - za) * sn; z = za - x * sn + (z - za) * c; x = xr;
  }
  if (pelvic && st.psi) { const r = rot([y - T.lumbosacral[0], z - T.lumbosacral[1]], st.psi); y = T.lumbosacral[0] + r[0]; z = T.lumbosacral[1] + r[1]; }
  const q = rot([y, z - cz], st.pitch || 0);
  return [x + (st.sway || 0), q[0], q[1] + st.z];
}

/** the spine's height at y, piecewise along tail root, lumbosacral, loin, back, withers (held beyond the ends) */
function spineHeight(T, y) {
  const pts = [T.tailRoot, T.lumbosacral, T.loin, T.back, T.withers];
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]); }
  return pts[pts.length - 1][1];
}

/** a leg's plane: through its girdle G (world) and the line its hoof stands on (x = xh, z = 0); the in-plane height D */
export function legPlane(G, xh) { return { G, xh, D: Math.hypot(G[0] - xh, G[2]) }; }
/** an in-plane point [y, h] (h the height in the plane above the hoof's line) to the world: an exact rotation */
export const fromPlane = (pl, p) => [pl.xh + (pl.G[0] - pl.xh) * p[1] / pl.D, p[0], pl.G[2] * p[1] / pl.D];

/**
 * `state` = { z, pitch, psi, rollF, rollH, sway, nu, lat, tau, legs: { LF|RF|LH|RH: { solve, distal, plane } } }: z the
 * centre of mass's height, pitch the trunk's (+ nose up), psi the lumbosacral flexion (+ rounding), rollF / rollH the
 * girdles' roll (+ the top to the right), sway the body's sideways shift (+ right), nu the neck's swing (+ raising),
 * lat its sideways swing (+ right), neckDrop a rigid turn of the whole neck at its base (+ raising), headPitch the head's
 * angle outright, tau the tail's, tailLat its sideways swish (+ right), earR / earL { yaw, droop }. A
 * leg's solve and distal are in its plane (legPlane).
 */
export function assemble(B, state) {
  const T = B.trunk;
  const W = (p, x = 0, pelvic = false) => bodyPoint(B, state, [x, p[0], p[1]], pelvic);
  const P = {};
  for (const k of ['withers', 'back', 'loin', 'lumbosacral']) P[k] = W(T[k]);
  for (const k of ['croup', 'buttock', 'tailRoot']) P[k] = W(T[k], 0, true);
  P.saddle = W(B.sockets.saddle);
  // the neck in the body frame: each link turned by its share of the nod (in the mid-plane) and of the sideways swing
  // (about the vertical), accumulated from the base; then into the world with the body
  const nu = state.nu || 0, lat = state.lat || 0;
  const nb = [[0, T.neck[0][0], T.neck[0][1]]];
  let acc = 0, accL = 0;
  for (let i = 1; i < T.neck.length; i++) {
    acc += NECK_W[i - 1] * nu + (i === 1 ? state.neckDrop || 0 : 0); accL += NECK_W[i - 1] * lat;   // the drop: at the base
    const d = rot(sub(T.neck[i], T.neck[i - 1]), acc);            // [dy, dz] nodded
    const prev = nb[i - 1];
    nb.push([prev[0] + Math.sin(accL) * d[0], prev[1] + Math.cos(accL) * d[0], prev[2] + d[1]]);
  }
  const neck = nb.map((p) => bodyPoint(B, state, p));
  const pollB = nb[nb.length - 1];
  // the head's angle in the body frame: carried off the neck's swing, or set outright (`headPitch`: a grazing face)
  const headA = state.headPitch ?? -(90 - B.head.carriage) * DEG + acc * (1 - (state.headCounter ?? 0.5));
  const yawH = accL * (1 - (state.headCounter ?? 0.5));
  // a point along the head at (forward, down) from the poll, in the body frame, then the world
  const H = (fwd, down = 0, side = 0) => {
    const d = add(mul(dir(headA), fwd), mul(dir(headA - 90 * DEG), down));
    const c = Math.cos(yawH), sn = Math.sin(yawH);   // the head turned about the vertical: its side offset turns with it
    return bodyPoint(B, state, [pollB[0] + sn * d[0] + c * side, pollB[1] + c * d[0] - sn * side, pollB[2] + d[1]]);
  };
  const Lh = B.head.length, k6 = Lh / 0.6;
  const poll = neck[neck.length - 1], muzzle = H(Lh);
  const jawFrom = H(0, 0.12 * k6), jawTo = H((B.head.jaw + 0.18 * Lh) * Math.cos(8 * DEG), (B.head.jaw + 0.18 * Lh) * Math.sin(8 * DEG));
  // an ear: up and a little back from the poll; `yaw` turns it about the head's up (+ out and back, each ear its own
  // way), `droop` tips it back (radians): rotations about the ear's base, so it keeps its length
  const earTip = (side, yaw = 0, droop = 0) => {
    const a = 125 * DEG + droop, f0 = B.head.ear * Math.cos(a), d0 = -B.head.ear * Math.sin(a);
    if (!yaw) return H(f0, d0, side);
    // a rotation of the (forward, side) part about the ear's base, by −yaw on the right and +yaw on the left (both out)
    const sg = Math.sign(side), b = 0.05 * sg, o = side - b, th = -yaw * sg, c = Math.cos(th), sn = Math.sin(th);
    return H(f0 * c - o * sn, d0, b + f0 * sn + o * c);
  };
  const bitAt = H(Lh * B.sockets.bit, 0.05 * k6), bitTo = H(Lh * B.sockets.bit + 0.04, 0.05 * k6);
  // the tail: the rest chain on the pelvis, each link swung by its share (in the mid-plane)
  // (and swished sideways by `tailLat`, each link its share about the vertical, the hair following)
  const tr = tailRest(B), tb = [[0, tr[0][0], tr[0][1]]];
  let ta = 0, tl = 0;
  for (let i = 1; i < tr.length; i++) {
    ta += TAIL_W[i - 1] * (state.tau || 0); tl += TAIL_W[i - 1] * (state.tailLat || 0);
    const d = rot(sub(tr[i], tr[i - 1]), ta), prev = tb[i - 1];
    tb.push(tl ? [prev[0] + Math.sin(tl) * d[0], prev[1] + Math.cos(tl) * d[0], prev[2] + d[1]] : [prev[0], prev[1] + d[0], prev[2] + d[1]]);
  }
  // the hair hangs: its end straight down from the dock's end in the world, swung by half the dock's swing
  const tail = tb.map((p) => bodyPoint(B, state, p, true));
  const hairEnd = tl
    ? add3(tail[4], [Math.cos(ta * 0.5 + 2 * DEG) * B.tail.hair * Math.sin(tl * 0.8), -Math.sin(ta * 0.5 + 2 * DEG) * B.tail.hair, -Math.cos(ta * 0.5 + 2 * DEG) * B.tail.hair * Math.cos(tl * 0.8)])   // the hanging hair turned about the long axis
    : add3(tail[4], [0, Math.sin(ta * 0.5 + 2 * DEG) * -B.tail.hair, -Math.cos(ta * 0.5 + 2 * DEG) * B.tail.hair]);

  const bones = {};
  const put = (id, a, b) => { bones[id] = { head: a, tail: b }; };
  put('spine1', P.lumbosacral, P.loin); put('spine2', P.loin, P.back); put('spine3', P.back, P.withers);
  put('spine0', P.lumbosacral, P.tailRoot);
  for (let i = 0; i < 5; i++) put(`neck${i}`, neck[i], neck[i + 1]);
  put('head', poll, muzzle); put('jaw', jawFrom, jawTo);
  put('earR', H(0, 0, 0.05), earTip(0.07, state.earR?.yaw, state.earR?.droop)); put('earL', H(0, 0, -0.05), earTip(-0.07, state.earL?.yaw, state.earL?.droop));
  for (let i = 0; i < 4; i++) put(`tail${i}`, tail[i], tail[i + 1]);
  put('tailHair', tail[4], hairEnd);
  for (const s of ['R', 'L']) {
    const f = state.legs[`${s}F`], h = state.legs[`${s}H`];
    const F = (p) => fromPlane(f.plane, p), Hh = (p) => fromPlane(h.plane, p);
    put(`scapula${s}`, F(f.solve.top), F(f.solve.S)); put(`humerus${s}`, F(f.solve.S), F(f.solve.E));
    put(`radius${s}`, F(f.solve.E), F(f.solve.C)); put(`cannonF${s}`, F(f.solve.C), F(f.solve.F));
    put(`pasternF${s}`, F(f.solve.F), F(f.distal.coffin)); put(`hoofF${s}`, F(f.distal.coffin), F(f.distal.toe));
    put(`femur${s}`, h.plane.G, Hh(h.solve.St)); put(`tibia${s}`, Hh(h.solve.St), Hh(h.solve.Ho));
    put(`cannonH${s}`, Hh(h.solve.Ho), Hh(h.solve.F)); put(`pasternH${s}`, Hh(h.solve.F), Hh(h.distal.coffin));
    put(`hoofH${s}`, Hh(h.distal.coffin), Hh(h.distal.toe));
  }
  put('saddle', P.saddle, W(add(B.sockets.saddle, [0, 0.1])));
  put('bit', bitAt, bitTo);
  return { bones, points: { ...P, poll, muzzle, neck, tail } };
}

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
