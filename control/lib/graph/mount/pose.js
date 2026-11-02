/**
 * pose — a mount's skeleton at one instant, from the solved state: the trunk heaved and pitched about the centre of
 * mass, the pelvis turned about the lumbosacral joint, the neck swung about its base and the head counter-turned, the
 * tail swung about its root, each leg as its solve placed it. Every bone as { head, tail } in metres [x, y, z], the
 * mount's right at +x. The bones are the rig's: the clips pack them as they are named here.
 *
 *   MOUNT_BONES   [{ id, parent }] in parent-first order (the rig's order)
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
 * `state` = { z, pitch, psi, nu, tau, legs: { LF|RF|LH|RH: { solve, distal: { coffin, toe, heel } } } }: z the centre
 * of mass's height, pitch the trunk's (+ nose up), psi the lumbosacral flexion (+ rounding), nu the neck's swing
 * (+ raising), tau the tail's.
 */
export function assemble(B, state) {
  const T = B.trunk, com = T.com;
  const body = (p) => add([0, state.z], rot(sub(p, com), state.pitch));
  const pelvis = (p) => body(add(T.lumbosacral, rot(sub(p, T.lumbosacral), state.psi || 0)));
  const P = {};
  for (const k of ['withers', 'back', 'loin', 'lumbosacral', 'scapulaPivot']) P[k] = body(T[k]);
  for (const k of ['croup', 'buttock', 'tailRoot', 'hip']) P[k] = pelvis(T[k]);
  P.saddle = body(B.sockets.saddle);
  // the neck: each link turned by its share of the swing, accumulated from the base
  const nu = state.nu || 0, neck = [body(T.neck[0])];
  let acc = 0;
  for (let i = 1; i < T.neck.length; i++) {
    acc += NECK_W[i - 1] * nu;
    neck.push(add(neck[i - 1], rot(rot(sub(T.neck[i], T.neck[i - 1]), state.pitch), acc)));
  }
  const poll = neck[neck.length - 1];
  const headA = -(90 - B.head.carriage) * DEG + state.pitch + acc * (1 - (state.headCounter ?? 0.5));
  const muzzle = add(poll, mul(dir(headA), B.head.length));
  const jawFrom = add(poll, mul(dir(headA - 90 * DEG), 0.12 * B.head.length / 0.6));
  const jawTo = add(poll, mul(dir(headA - 8 * DEG), B.head.jaw + 0.18 * B.head.length));
  const ear = add(poll, mul(dir(headA + 125 * DEG), B.head.ear));
  const bitAt = add(add(poll, mul(dir(headA), B.head.length * B.sockets.bit)), mul(dir(headA - 90 * DEG), 0.05 * B.head.length / 0.6));
  // the tail: the rest chain pelvis-borne, each link swung by its share
  const tr = tailRest(B), tail = [pelvis(tr[0])];
  let ta = 0;
  for (let i = 1; i < tr.length; i++) {
    ta += TAIL_W[i - 1] * (state.tau || 0);
    tail.push(add(tail[i - 1], rot(rot(sub(tr[i], tr[i - 1]), state.pitch + (state.psi || 0)), ta)));
  }
  const hairEnd = add(tail[4], mul(dir(-92 * DEG + ta * 0.5), B.tail.hair));

  const X = (p, x = 0) => [x, p[0], p[1]];
  const bones = {};
  const put = (id, a, b, x = 0) => { bones[id] = { head: X(a, x), tail: X(b, x) }; };
  put('spine1', P.lumbosacral, P.loin); put('spine2', P.loin, P.back); put('spine3', P.back, P.withers);
  put('spine0', P.lumbosacral, P.tailRoot);
  for (let i = 0; i < 5; i++) put(`neck${i}`, neck[i], neck[i + 1]);
  put('head', poll, muzzle); put('jaw', jawFrom, jawTo);
  bones.earR = { head: X(poll, 0.05), tail: X(ear, 0.07) }; bones.earL = { head: X(poll, -0.05), tail: X(ear, -0.07) };
  for (let i = 0; i < 4; i++) put(`tail${i}`, tail[i], tail[i + 1]);
  put('tailHair', tail[4], hairEnd);
  for (const s of ['R', 'L']) {
    const sx = s === 'R' ? 1 : -1;
    const f = state.legs[`${s}F`], h = state.legs[`${s}H`];
    const xf = sx * B.fore.x, xh = sx * B.hind.x;
    put(`scapula${s}`, f.solve.top, f.solve.S, xf); put(`humerus${s}`, f.solve.S, f.solve.E, xf);
    put(`radius${s}`, f.solve.E, f.solve.C, xf); put(`cannonF${s}`, f.solve.C, f.solve.F, xf);
    put(`pasternF${s}`, f.solve.F, f.distal.coffin, xf); put(`hoofF${s}`, f.distal.coffin, f.distal.toe, xf);
    put(`femur${s}`, P.hip, h.solve.St, xh); put(`tibia${s}`, h.solve.St, h.solve.Ho, xh);
    put(`cannonH${s}`, h.solve.Ho, h.solve.F, xh); put(`pasternH${s}`, h.solve.F, h.distal.coffin, xh);
    put(`hoofH${s}`, h.distal.coffin, h.distal.toe, xh);
  }
  put('saddle', P.saddle, add(P.saddle, rot([0, 0.1], state.pitch)));
  put('bit', bitAt, add(bitAt, mul(dir(headA), 0.04)));
  return { bones, points: { ...P, poll, muzzle, neck, tail } };
}
