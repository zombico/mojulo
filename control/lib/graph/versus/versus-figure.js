/**
 * versus figure — the fighter in 3D: the vajra's skeleton posed from the fight (inlined into the arena's block,
 * versus-arena.client.js).
 *
 * The sim fights a stick figure in its plane (versus-rig.js rigJoints: x forward, y up, mm). The page draws a body in
 * the round. Its skeleton is the vajra's (figure-vajra.js FIGURE_NODES: pelvisHub, navel, neckHub, headBase, headTop,
 * and per side shoulder, elbow, wrist, hip, knee, ankle, with a toe), in the vajra's frame: metres, z up, facing +y,
 * its right side +x, its feet on z = 0. The skeleton is a character's own (its rig, `characterBase`) or one built to
 * the stick figure's lengths (`figureBase`).
 *
 * The SIDE VIEW IS THE SIM'S FIGURE: the trunk and the head lie along the sim's lines, and the hands and the feet are
 * placed by a two-bone solve on the sim's own points (the wrist on its hand, the heel on its ankle), so what hits and
 * what is hit is where the boxes are. Around that the body is in the round, as the genre stands it (the fighter's
 * STANCE, versus-compile.js STANCE_DIALS):
 *   - BLADED: the hips and, more, the chest turned toward the camera (`open`, `hips`), the lead shoulder forward; the
 *     LEAD side (the sim's F) is the far one, the figure's left when it faces +x and its right when it faces -x, so
 *     the chest reads
 *   - the SIDE TILT (`tilt`): the trunk bent toward the camera, the shoulder line on a diagonal, the torso in the
 *     silhouette (fighters rarely stand square, staring at each other)
 *   - the elbows bent down and out, the knees forward, the lead hand before its shoulder, the rear one by the chin
 *     (a pose's `hands` and `feet` move them across: a hook swings to the centre line, a hikite pulls to the hip)
 *   - the feet under the hips, each foot rigid (its own bones) and turned to point at the sim's toe, standing on the
 *     floor as the rest does
 * `blade` (0 … 1) is how far the body turns: a standing fighter all the way, one falling or down not at all. A strike
 * turns it back as far as the limb needs (the KINETIC CHAIN): the chest turns until both hands reach their points,
 * the hips until both feet do, so a rear straight squares the shoulders and a roundhouse turns the hips over.
 *
 * A character's mesh is posed by FRAMES: each segment (pelvis, torso, neck, head, upper arm, forearm, thigh, shin,
 * foot) has a frame at rest and posed (its line, and a pole: the hip line, the shoulder line, the chest's forward, up),
 * and each of the character's bones rides the segment it belongs to (a finger its forearm, a fold its lower limb, a
 * tail the pelvis), turned by the segment's turn about its start: the chain closes at every joint.
 *
 *   figureBase(body)                     a skeleton from the sim's body (mm lengths → metres)
 *   characterBase(bones)                 a skeleton from a packed rig's bones ([{ id, head, tail }], metres)
 *   figurePose(base, J, { face, air, blade })   → posed nodes (metres, the figure's frame)
 *   figureSegments(base, posed)          → { <segment>: { R, from, at } }: v' = R (v - from) + at
 *   segmentOf(boneId, bones)             the segment a character's bone rides
 *
 * Pure, no dice; nothing here is kept by the sim.
 */
/* (inlined after versus-rig.js: ROUND_REST, each hand's and foot's depth at rest; RIG_LIMITS, the ankle's bend) */
import { ROUND_REST, RIG_LIMITS } from './versus-rig.js';

const FIG_SIDES = ['L', 'R'];
const fv = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  unit: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
// turns: about +x (forward toward up) and about +z (forward toward the figure's left)
const figRotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
const figRotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
const FIG_DEG = Math.PI / 180;
// how a fighter stands when its recipe says nothing (versus-compile.js DEFAULT_STANCE): the chest open to the camera,
// the hips following, the side tilt (degrees)
const FIG_STANCE = { open: 45, hips: 28, tilt: 8 };
// how far past square a strike may turn them (the far side's range: a roundhouse turns the hips over)
const FIG_TURN = { hips: 100, chest: 60 };

/** A skeleton to the stick figure's own lengths (its body, versus-rig.js versusBody, mm), arms hanging. */
export function figureBase(body) {
  const m = (v) => v / 1000;
  const pz = m(body.pelvis), sh = m(body.bodyR) * 1.2, hip = m(body.bodyR) * 0.6;
  const B = { pelvisHub: [0, 0, pz], navel: [0, 0, pz + m(body.torso) * 0.45], neckHub: [0, 0, pz + m(body.torso)] };
  B.headBase = [0, 0, B.neckHub[2] + m(body.neck)];
  B.headTop = [0, 0, B.headBase[2] + m(body.head) * 2];
  for (const S of FIG_SIDES) {
    const x = S === 'R' ? 1 : -1;
    B[`shoulder${S}`] = [x * sh, 0, pz + m(body.torso) * 0.86];
    B[`elbow${S}`] = fv.sub(B[`shoulder${S}`], [0, 0, m(body.upper)]);
    B[`wrist${S}`] = fv.sub(B[`elbow${S}`], [0, 0, m(body.fore)]);
    B[`hip${S}`] = [x * hip, 0, pz];
    B[`knee${S}`] = [x * hip, 0, pz - m(body.thigh)];
    // the sim's leg runs to its heel: the stick's ankle is that point, its foot along the floor from it
    B[`ankle${S}`] = [x * hip, 0, 0];
    B[`toe${S}`] = [x * hip, m(body.foot), 0];
  }
  B.hand = m(body.hand);
  return B;
}

/** A skeleton from a packed rig's bones (the layered hero's, or a creature's): its own joints, at rest. */
export function characterBase(bones) {
  const by = Object.fromEntries(bones.map((b) => [b.id, b]));
  const pick = (...ids) => ids.map((id) => by[id]).find(Boolean);
  const B = {};
  const put = (name, bone, end) => { if (bone) B[name] = [...bone[end]]; };
  put('pelvisHub', pick('pelvis', 'lumbar'), 'head');
  put('navel', pick('torso'), 'head');
  put('neckHub', pick('neck'), 'head');
  if (!B.neckHub && by.torso) B.neckHub = [...by.torso.tail];
  put('headBase', pick('head'), 'head');
  put('headTop', pick('head'), 'tail');
  for (const S of FIG_SIDES) {
    put(`shoulder${S}`, pick(`upperArm${S}`), 'head');
    put(`elbow${S}`, pick(`foreArm${S}`), 'head');
    put(`wrist${S}`, pick(`hand${S}`), 'head');
    if (!B[`wrist${S}`] && by[`foreArm${S}`]) B[`wrist${S}`] = [...by[`foreArm${S}`].tail];
    put(`hip${S}`, pick(`thigh${S}`), 'head');
    put(`knee${S}`, pick(`shank${S}`, `shin${S}`), 'head');
    put(`ankle${S}`, pick(`shank${S}`, `shin${S}`), 'tail');
    put(`toe${S}`, pick(`toes${S}`, `foot${S}`, `meta${S}`), 'tail');
  }
  const hand = by.handR ?? by.handL;
  B.hand = hand ? fv.len(fv.sub(hand.tail, hand.head)) : 0.09;
  for (const k of ['pelvisHub', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toeL', 'toeR']) {
    if (!B[k]) throw new Error(`versus: the character's rig has no ${k} to fight with`);
  }
  if (!B.navel) B.navel = fv.mul(fv.add(B.pelvisHub, B.neckHub), 0.5);
  return B;
}

/** The middle joint of a two-bone limb from its root to a target, bent toward `pole`; an out-of-reach target is met
 * as far as the limb goes, along its line. → { mid, end } */
function figReach(root, target, l1, l2, pole) {
  let d = fv.sub(target, root), dl = fv.len(d);
  const reach = (l1 + l2) * 0.999, least = Math.abs(l1 - l2) * 1.001 + 1e-6;
  if (dl > reach) { d = fv.mul(d, reach / dl); dl = reach; }
  if (dl < least) { d = fv.mul(fv.unit(d), least); dl = least; }
  const end = fv.add(root, d), axis = fv.unit(d);
  const a = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let side = fv.sub(pole, fv.mul(axis, fv.dot(pole, axis)));
  if (fv.len(side) < 1e-9) side = Math.abs(axis[2]) < 0.9 ? [0, 0, -1] : [0, 1, 0];
  return { mid: fv.add(fv.add(root, fv.mul(axis, a)), fv.mul(fv.unit(side), h)), end };
}

/** THE ROUND BODY'S JOINT LIMITS (degrees): the elbow's and the knee's fold (0 straight), the spine's twist (the
 * shoulder line against the hip line about the trunk). The side view's own bends are the rig's (versus-rig.js
 * RIG_LIMITS). The figure keeps them in depth, the one way the side view never sees: a hand or a foot set further from
 * its shoulder or its hip across the plane, the hips turned with the chest, never off the sim's points (a turn either
 * side of the limit is taken only when the limbs reach nowhere inside it). */
export const FIG_LIMITS = Object.freeze({ elbow: 150, knee: 155, spine: 60 });
/** THE BODY'S BULK, for its parts not to pass through each other: from its own skeleton (a character's or the sim's),
 * as shares of the shoulders' half-width: the trunk an ellipse (its half-width, its half-depth), a limb's radius, a
 * leg's, the head's (a share of its own length); `skin` the depth two parts may touch to before they are moved */
export const FIG_BULK = Object.freeze({ trunkW: 0.75, trunkD: 0.52, limb: 0.3, leg: 0.38, head: 0.45, skin: 0.012 });
/** A skeleton's bulk in metres (FIG_BULK). */
export function figureBulk(base) {
  const sh = fv.len(fv.sub(base.shoulderR, base.shoulderL)) / 2, B = FIG_BULK;
  return { trunkW: sh * B.trunkW, trunkD: sh * B.trunkD, limb: sh * B.limb, leg: sh * B.leg, head: fv.len(fv.sub(base.headTop, base.headBase)) * B.head, skin: B.skin };
}
// a skeleton's limb lengths and their least reaches, once a skeleton
const FIG_KITS = new WeakMap();
function figKit(base) {
  let K = FIG_KITS.get(base);
  if (K) return K;
  const L = (a, b) => fv.len(fv.sub(base[b], base[a]));
  K = Object.fromEntries(FIG_SIDES.map((S) => {
    const upper = L(`shoulder${S}`, `elbow${S}`), fore = L(`elbow${S}`, `wrist${S}`), thigh = L(`hip${S}`, `knee${S}`), shin = L(`knee${S}`, `ankle${S}`);
    return [S, { upper, fore, thigh, shin, arm: upper + fore, leg: thigh + shin, armLeast: figLeast(upper, fore, FIG_LIMITS.elbow) * 1.01, legLeast: figLeast(thigh, shin, FIG_LIMITS.knee) * 1.01 }];
  }));
  FIG_KITS.set(base, K);
  return K;
}
// the least reach of a two-bone limb folded to its limit (the law of cosines at the joint)
const figLeast = (l1, l2, fold) => Math.sqrt(Math.max(0, l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos((180 - fold) * FIG_DEG)));
// the shortest distance between two segments
function figSegDist(p1, q1, p2, q2) {
  const d1 = fv.sub(q1, p1), d2 = fv.sub(q2, p2), r = fv.sub(p1, p2), a = fv.dot(d1, d1), e = fv.dot(d2, d2), f = fv.dot(d2, r);
  let sA, tA;
  if (a <= 1e-12 && e <= 1e-12) return fv.len(r);
  if (a <= 1e-12) { sA = 0; tA = Math.max(0, Math.min(1, f / e)); } else {
    const c = fv.dot(d1, r);
    if (e <= 1e-12) { tA = 0; sA = Math.max(0, Math.min(1, -c / a)); } else {
      const b = fv.dot(d1, d2), den = a * e - b * b;
      sA = den !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / den)) : 0;
      tA = (b * sA + f) / e;
      if (tA < 0) { tA = 0; sA = Math.max(0, Math.min(1, -c / a)); } else if (tA > 1) { tA = 1; sA = Math.max(0, Math.min(1, (b - c) / a)); }
    }
  }
  return fv.len(fv.sub(fv.add(p1, fv.mul(d1, sA)), fv.add(p2, fv.mul(d2, tA))));
}
const figLerp = (a, b, t) => fv.add(a, fv.mul(fv.sub(b, a), t));

/**
 * The skeleton posed by the sim's joints J (versus-rig.js rigJoints, mm), facing `face` (+1 toward +x), airborne or
 * not, standing in its `stance` ({ open, hips, tilt }, degrees) as far as `blade` (0 … 1) has it, and turned by the
 * pose's own round-body channels (degrees): `twist` the chest further toward the camera, `sway` the hips, `tilt` the
 * trunk further to the camera's side, `spin` the whole body about the vertical through the pelvis (toward the camera first),
 * `bank` the whole body about its forward line (its top toward the camera); a body that `lie`s rests on its lowest
 * point. Held within FIG_LIMITS, and its limbs kept out of its trunk, its head, its thighs and each other (FIG_BULK),
 * both in depth. → { <node>: [x, y, z] } in metres, the figure's frame, plus `fistL/R`, `heelL/R`.
 */
export function figurePose(base, J, { face = 1, air = false, blade = 1, stance = FIG_STANCE, twist = 0, sway = 0, tilt = 0, spin = 0, bank = 0, lie = false, hands = ROUND_REST.hands, feet = ROUND_REST.feet } = {}) {
  const sg = face > 0 ? 1 : -1, lead = sg > 0 ? 'L' : 'R';
  const at = (p) => [0, p[0] / 1000, p[1] / 1000];
  const sideOf = (S) => (S === lead ? 'F' : 'B');
  const P = at(J.pelvis), O = base.pelvisHub;
  const N = {};
  // the trunk along the sim's pelvis → neck, the chest turned toward the camera about it (the camera is the figure's
  // right when it faces +x: a turn toward it brings the far, lead shoulder forward)
  const t = fv.sub(at(J.neck), P), lean = Math.atan2(t[1], t[2]);
  // the side tilt: the trunk bent toward the camera about its forward line through the pelvis (the head stays on the
  // sim's line, so it rights itself on the neck)
  const side = sg * (blade * stance.tilt + tilt) * FIG_DEG;
  let cs = Math.cos(side), sn = Math.sin(side);
  const tiltBy = (share) => { cs = Math.cos(side * share); sn = Math.sin(side * share); };
  const tilted = (v) => [v[0] * cs + v[2] * sn, v[1], -v[0] * sn + v[2] * cs];
  const trunkAt = (k, chest) => fv.add(P, figRotX(tilted(figRotZ(fv.sub(base[k], O), chest)), -lean));
  const hipAt = (S, hips) => fv.add(P, figRotZ(fv.sub(base[`hip${S}`], O), hips));
  const len = (a, b) => fv.len(fv.sub(base[b], base[a])), K = figKit(base);
  // the targets: each wrist on the sim's hand (its depth a share of its shoulder's); each ankle joint up the sim's shin
  // from its heel point by the rest ankle's height (the sim's leg runs hip, knee, heel), the toe on from the heel
  // (a hand at full stretch keeps only the depth its arm still reaches)
  const armLen = (S) => K[S].arm;
  // (and a hand folded in closer than the elbow folds, FIG_LIMITS, takes the depth it needs)
  const armLeast = (S) => K[S].armLeast, legLeast = (S) => K[S].legLeast;
  // a point's depth set at `want` (its x), as far as a limb of reach `l` from `root` allows it and no nearer than
  // `least` to it: the side view (its y and z) is kept
  const inDepth = (p, root, want, l, least, outward) => {
    const dd = (p[1] - root[1]) ** 2 + (p[2] - root[2]) ** 2;
    const room = Math.sqrt(Math.max(0, (l * 0.999) ** 2 - dd)), need = Math.sqrt(Math.max(0, least ** 2 - dd));
    let dx = Math.max(-room, Math.min(room, want - root[0]));
    if (Math.abs(dx) < need) dx = (dx < 0 || (dx === 0 && outward < 0) ? -1 : 1) * Math.min(room, need);
    return [root[0] + dx, p[1], p[2]];
  };
  const wristAt = (S, sh, dx = 0) => inDepth(at(J[`hand${sideOf(S)}`]), sh, sh[0] * hands[S === lead ? 0 : 1] + dx, armLen(S), armLeast(S), sh[0]);
  const foot = Object.fromEntries(FIG_SIDES.map((S) => {
    const X = sideOf(S), shin = fv.unit(fv.sub(at(J[`ankle${X}`]), at(J[`knee${X}`]))), h = base[`ankle${S}`][2];
    return [S, { heel: at(J[`ankle${X}`]), lift: fv.mul(shin, -h), h }];
  }));
  const legLen = (S) => K[S].leg;
  const ankleAt = (S, hip, dx = 0) => inDepth(fv.add([0, foot[S].heel[1], foot[S].heel[2]], foot[S].lift), hip, hip[0] * feet[S === lead ? 0 : 1] + dx, K[S].leg, legLeast(S), hip[0]);
  // the turns, in degrees toward the camera: each as far as the blade asks and back as far as its limbs need, at most
  // past square by the far side's own range. A turn reaches when its limbs reach their points; of the turns that reach,
  // the hips' and the chest's are taken together nearest what is asked, no further apart than the spine twists
  // (FIG_LIMITS.spine); a move whose limbs reach nowhere inside it keeps the nearest turns that reach; one that reaches
  // nowhere at all, the turn with the least reach missing
  const rad = (deg) => -sg * deg * FIG_DEG;
  const over = (root, target, l) => Math.max(0, fv.len(fv.sub(target, root)) - l * 0.999);
  const armsMiss = (c) => FIG_SIDES.reduce((m, S) => { const sh = trunkAt(`shoulder${S}`, c); return m + over(sh, wristAt(S, sh), armLen(S)); }, 0);
  const legsMiss = (h) => FIG_SIDES.reduce((m, S) => { const hp = hipAt(S, h); return m + over(hp, ankleAt(S, hp), legLen(S)); }, 0);
  // (the turns tried: the asked one, then a degree further each way, the nearer side first, within the range)
  const tries = (want, least, home) => {
    const hi = Math.max(want, home), lo = least, out = [];
    for (let k = 0; k <= hi - Math.min(lo, want) + 1; k++) for (const deg of k ? [want - k, want + k] : [want]) if (deg >= lo - 1e-9 && deg <= hi + 1e-9) out.push(deg);
    return out;
  };
  // the first turn that reaches, or the one that misses least; `all` the turns that reach, nearest first
  const reach = (list, misses, all = false) => {
    const ok = [];
    let best = null;
    for (const deg of list) {
      const miss = misses(rad(deg));
      if (miss <= 1e-9) { ok.push(deg); if (!all) break; }
      if (!best || miss < best.miss) best = { miss, deg };
    }
    return { deg: ok.length ? ok[0] : best.deg, ok };
  };
  // (every chest turn that reaches, scanned once and only when it is asked for)
  let chestScan = null;
  const chestAll = () => (chestScan ??= reach(chestTries, armsMiss, true).ok);
  const hipWant = blade * stance.hips + sway, hipTries = tries(hipWant, -FIG_TURN.hips, blade * stance.hips);
  let hipDeg = reach(hipTries, legsMiss).deg, chestDeg = 0, chestTries = null, share = 1;
  const chestWant = blade * stance.open + twist;
  for (share of [1, 0.5, 0]) {
    tiltBy(share);
    chestTries = tries(chestWant, -FIG_TURN.chest, blade * stance.open);
    const C = reach(chestTries, armsMiss);
    chestDeg = C.deg;
    if (C.ok.length) break;
  }
  // (twisted past the spine: the hips and the chest that both reach, nearest what was asked, no further apart than it)
  if (Math.abs(chestDeg - hipDeg) > FIG_LIMITS.spine) {
    const H = reach(hipTries, legsMiss, true).ok, C = chestAll();
    let pick = null;
    for (const h of H) for (const c of C) {
      if (Math.abs(c - h) > FIG_LIMITS.spine) continue;
      const cost = Math.abs(h - hipWant) + Math.abs(c - chestWant);
      if (!pick || cost < pick.cost) pick = { h, c, cost };
    }
    if (pick) { hipDeg = pick.h; chestDeg = pick.c; }
  }
  const hips = rad(hipDeg);
  N.pelvisHub = P;
  // THE BODY'S OWN PARTS (FIG_BULK): the trunk an ellipse about its axis (read in its frame, its depth stretched to its
  // width), the head, the limbs capsules; how deep a limb passes into what is already placed
  const bulk = figureBulk(base), stretch = bulk.trunkW / bulk.trunkD;
  const hd = fv.unit(fv.sub(at(J.head), at(J.neck)));
  // the trunk at a chest turn: the shoulders, the neck, the head along the sim's neck → head line, its frame
  const trunkOf = (deg) => {
    const c = rad(deg), T = { deg };
    for (const k of ['navel', 'neckHub', 'shoulderL', 'shoulderR']) T[k] = trunkAt(k, c);
    T.headBase = fv.add(T.neckHub, fv.mul(hd, len('neckHub', 'headBase')));
    T.headTop = fv.add(T.headBase, fv.mul(hd, len('headBase', 'headTop')));
    T.chestFwd = figRotX(tilted(figRotZ([0, 1, 0], c)), -lean);
    const up = fv.unit(fv.sub(T.neckHub, P)), across = fv.unit(fv.sub(T.shoulderR, T.shoulderL)), fwd = fv.unit(fv.cross(up, across)), lat = fv.unit(fv.cross(fwd, up));
    T.in = (v) => { const d = fv.sub(v, P); return [fv.dot(d, lat), fv.dot(d, fwd) * stretch, fv.dot(d, up)]; };
    T.axis = [T.in(P), T.in(T.neckHub)];
    return T;
  };
  const placed = [];   // [p, q, r]: what a limb must keep out of, as it is placed
  const into = (p, q, r, T = null, rest = placed) => {
    let worst = 0;
    if (T) {
      worst = Math.max(worst, bulk.trunkW + r - figSegDist(T.in(p), T.in(q), T.axis[0], T.axis[1]));
      worst = Math.max(worst, bulk.head + r - figSegDist(p, q, T.headBase, T.headTop));
    }
    for (const [a, b, rb] of rest) worst = Math.max(worst, r + rb - figSegDist(p, q, a, b));
    return Math.max(0, worst - bulk.skin);
  };
  // the legs first (the arms keep out of the thighs): the knee to its thigh's front, the foot turned by the sim's foot angle; a leg
  // into the other moved out across the plane
  const STEP = 0.015;
  for (const S of FIG_SIDES) {
    const out = S === 'R' ? 1 : -1;
    N[`hip${S}`] = hipAt(S, hips);
    // (the knee bends toward the front of its own thigh, the sim's: forward as the thigh hangs, up as it is raised)
    const th = J[`knee${sideOf(S)}`], tl = Math.hypot(th[0] - J.pelvis[0], th[1] - J.pelvis[1]) || 1;
    const hip = N[`hip${S}`], l1 = K[S].thigh, l2 = K[S].shin, pole = [out * 0.15, -(th[1] - J.pelvis[1]) / tl, (th[0] - J.pelvis[0]) / tl];
    const legOf = (dx) => { const end = ankleAt(S, hip, dx), L = figReach(hip, end, l1, l2, pole); return { L, deep: into(figLerp(hip, L.mid, 0.3), L.mid, bulk.leg) + into(L.mid, L.end, bulk.leg * 0.85) }; };
    let leg = legOf(0);
    for (let k = 1; leg.deep > 0 && k <= 20; k++) { const n = legOf(out * k * STEP); if (n.deep < leg.deep) leg = n; }
    N[`knee${S}`] = leg.L.mid; N[`ankle${S}`] = leg.L.end;
    placed.push([figLerp(hip, leg.L.mid, 0.3), leg.L.mid, bulk.leg], [leg.L.mid, leg.L.end, bulk.leg * 0.85]);
    // the foot is rigid (its own bones): turned about the ankle to point at the sim's toe, the heel under the ankle; never
    // folded up into the shin as it is drawn (versus-rig.js RIG_LIMITS, its drawn-up end: the drawn knee is not the sim's
    // where the hips turn, so a foot the sim holds may still fold against the drawn shin). A pointed toe stays on the
    // sim's toe, a kick's hit
    const rf = fv.sub(base[`toe${S}`], base[`ankle${S}`]), toe2 = at(J[`toe${sideOf(S)}`]), d = fv.sub(toe2, leg.L.end);
    let ft = Math.atan2(d[2], d[1]) - Math.atan2(rf[2], rf[1]);
    {
      const sd = fv.sub(leg.L.mid, leg.L.end), fd = figRotX(rf, ft), ps = Math.atan2(sd[2], sd[1]), pf = Math.atan2(fd[2], fd[1]);
      // (the bend between the shin and the foot, 90 standing, past 180 a toe pointed past the shin's line)
      let bend = Math.atan2(Math.sin(ps - pf), Math.cos(ps - pf)) / FIG_DEG;
      if (bend < -90) bend += 360;
      const least = 180 - RIG_LIMITS.ankle[1];
      if (bend < least) ft += (bend - least) * FIG_DEG;
    }
    N[`toe${S}`] = fv.add(leg.L.end, figRotX(rf, ft));
    N[`heel${S}`] = fv.add(leg.L.end, figRotX([0, 0, -foot[S].h], ft));
  }
  // the arms on a trunk, the lead first: the elbow down and out; a hand, a forearm or an elbow into the trunk, the head,
  // a thigh or the other arm moved across the plane (the hand's depth, nearest first), or the elbow turned out about the
  // line from the shoulder to the hand (`search` false: as they fall, for a turn to be weighed)
  const armsOn = (T, search) => {
    const rest = placed.slice(), out = { deep: 0 };
    for (const S of S_ORDER(lead)) {
      const o = S === 'R' ? 1 : -1, sh = T[`shoulder${S}`], l1 = K[S].upper, l2 = K[S].fore;
      const pole0 = fv.add([o * 0.6, 0, -1], fv.mul(T.chestFwd, -0.3));
      const armOf = (dx, pole) => {
        const A = figReach(sh, wristAt(S, sh, dx), l1, l2, pole), fist = fv.add(A.end, fv.mul(fv.unit(fv.sub(A.end, A.mid)), base.hand));
        return { A, fist, deep: into(figLerp(sh, A.mid, 0.4), A.mid, bulk.limb, T, rest) + into(A.mid, fist, bulk.limb, T, rest) };
      };
      let arm = armOf(0, pole0), at0 = { dx: 0, pole: pole0 };
      if (arm.deep > 0 && search) {
        // (the hand's depth first, every two steps out to 45 cm either way; then the elbow turned at the best of them; then
        // a step either side of it)
        hunt: for (let k = 1; k <= 15; k++) for (const dx of [o * 2 * k * STEP, -o * 2 * k * STEP]) {
          const n = armOf(dx, pole0);
          if (n.deep < arm.deep) { arm = n; at0 = { dx, pole: pole0 }; }
          if (arm.deep <= 0) break hunt;
        }
        for (const pole of [[o, 0, -0.4], [o, -0.3, 0.2], [o * 0.4, 0, -1]]) { if (arm.deep <= 0) break; const n = armOf(at0.dx, pole); if (n.deep < arm.deep) { arm = n; at0 = { dx: at0.dx, pole }; } }
        for (const dx of [at0.dx - STEP, at0.dx + STEP]) { if (arm.deep <= 0) break; const n = armOf(dx, at0.pole); if (n.deep < arm.deep) arm = n; }
      }
      out[`elbow${S}`] = arm.A.mid; out[`wrist${S}`] = arm.A.end; out[`fist${S}`] = arm.fist;
      out.deep += arm.deep;
      rest.push([figLerp(sh, arm.A.mid, 0.4), arm.A.mid, bulk.limb], [arm.A.mid, arm.fist, bulk.limb]);
    }
    return out;
  };
  let T = trunkOf(chestDeg), arms = armsOn(T, true);
  // arms that pass through the trunk wherever their hands are put: the chest turned as far as they need to clear it (a
  // rear straight squares the shoulders), of the turns that reach, nearest the one asked, inside the spine's twist
  if (arms.deep > 0) {
    let best = null;
    // (every other degree, the nearest forty)
    const turns = chestAll().filter((c) => c !== chestDeg && Math.abs(c - hipDeg) <= FIG_LIMITS.spine && Math.round(c - chestDeg) % 2 === 0).slice(0, 40);
    for (const c of turns) {
      const T2 = trunkOf(c), quick = armsOn(T2, false);
      if (!best || quick.deep < best.deep) best = { T: T2, deep: quick.deep };
      if (quick.deep <= 0) break;
    }
    if (best) { const again = armsOn(best.T, true); if (again.deep < arms.deep) { T = best.T; arms = again; } }
  }
  for (const k of ['navel', 'neckHub', 'shoulderL', 'shoulderR', 'headBase', 'headTop']) N[k] = T[k];
  for (const S of FIG_SIDES) for (const k of ['elbow', 'wrist', 'fist']) N[`${k}${S}`] = arms[`${k}${S}`];
  // a leg too short for the sim's spot (a character shorter in the leg than the sim's figure) leaves its foot in the
  // air: grounded, the body sinks by the least such gap so the nearer foot stands
  const gaps = FIG_SIDES.map((S) => N[`ankle${S}`][2] - ankleAt(S, N[`hip${S}`])[2]);
  const dz = air || lie ? 0 : -Math.max(0, Math.min(...gaps));
  if (dz) for (const k of Object.keys(N)) N[k] = [N[k][0], N[k][1], N[k][2] + dz];
  // the whole body turned: about the vertical (a spin), about its forward line (a roll onto a side)
  if (spin || bank) {
    const piv = N.pelvisHub;
    for (const k of Object.keys(N)) {
      let v = fv.sub(N[k], piv);
      if (spin) v = figRotZ(v, -sg * spin * FIG_DEG);
      if (bank) { const a = sg * bank * FIG_DEG, c = Math.cos(a), si = Math.sin(a); v = [v[0] * c + v[2] * si, v[1], -v[0] * si + v[2] * c]; }
      N[k] = fv.add(piv, v);
    }
  }
  if (lie && bank) {
    // rolled, a lying body rests on its new lowest point
    const low = Math.min(...Object.values(N).map((q) => q[2])) - 0.04;
    for (const k of Object.keys(N)) N[k] = [N[k][0], N[k][1], N[k][2] - low];
  }
  return N;
}
// the order the arms are placed in: the lead's first (the rear keeps out of it)
const S_ORDER = (lead) => (lead === 'L' ? ['L', 'R'] : ['R', 'L']);

// each segment: its start and end joints, and its pole (the second direction that fixes its roll)
const FIG_SEGMENTS = {
  pelvis: ['pelvisHub', 'navel', 'hips'], torso: ['navel', 'neckHub', 'shoulders'], neck: ['neckHub', 'headBase', 'shoulders'], head: ['headBase', 'headTop', 'shoulders'],
  ...Object.fromEntries(FIG_SIDES.flatMap((S) => [
    [`upperArm${S}`, [`shoulder${S}`, `elbow${S}`, 'chest']], [`foreArm${S}`, [`elbow${S}`, `wrist${S}`, 'chest']],
    [`thigh${S}`, [`hip${S}`, `knee${S}`, 'front']], [`shin${S}`, [`knee${S}`, `ankle${S}`, 'front']], [`foot${S}`, [`ankle${S}`, `toe${S}`, 'up']],
  ])),
};
function figPoles(N) {
  const hips = fv.unit(fv.sub(N.hipR, N.hipL)), shoulders = fv.unit(fv.sub(N.shoulderR, N.shoulderL));
  const up = fv.unit(fv.sub(N.neckHub, N.pelvisHub));
  return { hips, shoulders, chest: fv.unit(fv.cross(up, shoulders)), front: fv.unit(fv.cross([0, 0, 1], hips)), up: [0, 0, 1] };
}
// a frame (columns: the line, the pole's part across it, their cross)
function figFrame(a, b, pole) {
  const d = fv.unit(fv.sub(b, a));
  let s = fv.sub(pole, fv.mul(d, fv.dot(pole, d)));
  if (fv.len(s) < 1e-6) { const alt = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]; s = fv.sub(alt, fv.mul(d, fv.dot(alt, d))); }
  s = fv.unit(s);
  return [d, s, fv.cross(d, s)];
}

/** Each segment's turn from rest to posed: { R (3×3, rows), from (its rest start), at (its posed start) }. */
export function figureSegments(base, N) {
  const PR = figPoles(base), PP = figPoles(N), out = {};
  for (const [k, [a, b, pole]] of Object.entries(FIG_SEGMENTS)) {
    const Fr = figFrame(base[a], base[b], PR[pole]), Fp = figFrame(N[a], N[b], PP[pole]);
    // R = Fp · Frᵀ (the frames as columns)
    const R = [0, 1, 2].map((i) => [0, 1, 2].map((j) => Fp[0][i] * Fr[0][j] + Fp[1][i] * Fr[1][j] + Fp[2][i] * Fr[2][j]));
    out[k] = { R, from: base[a], at: N[a] };
  }
  // (the ground: what stands where it rests in the body's own frame whatever the body does, a serpent's coil on the floor)
  out.ground = GROUND;
  return out;
}
const GROUND = Object.freeze({ R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], from: [0, 0, 0], at: [0, 0, 0] });

// the segment a character's bone rides, by its name (a side's bone on that side's segment)
const FIG_RIDES = [
  [/^(pelvis|lumbar|tail\d*)$/, 'pelvis'], [/^(torso|clavicle|bust|upperArm2|foreArm2|hand2)$/, 'torso'], [/^neck$/, 'neck'],
  // (the head's, and the face's: a creature's lids, lips and brows, its ears, snout and horns move with its head)
  [/^(head|jaw|lid|lip[UD]?|brow|eye|ear\d*|snout|muzzle|nose|horn\d*|cheek|crest)$/, 'head'],
  [/^upperArm$/, 'upperArm'], [/^(foreArm|hand|elbowFold|thumb\d|index\d|middle\d|ring\d|little\d|finger[A-Z]\d|wing.*)$/, 'foreArm'],
  [/^(thigh|hipFold)$/, 'thigh'], [/^(shank|shin|kneeFold|meta)$/, 'shin'], [/^(foot|toes)$/, 'foot'],
];
/** The segment a packed rig's bone rides: `torso`, `head`, `foreArmR` …; a bone with no word rides the torso. A serpent's
 * coil (beast/serpent.js) rides as its rig has it: its first link the pelvis (`coil0`), the rest planted (`ground`). */
export function segmentOf(id) {
  const coil = /^coil(\d+)$/.exec(id);
  if (coil) return Number(coil[1]) < 1 ? 'pelvis' : 'ground';
  const m = /^(.*?)([LR])$/.exec(id), base = m ? m[1] : id, S = m ? m[2] : '';
  for (const [re, seg] of FIG_RIDES) if (re.test(base)) return FIG_SEGMENTS[seg] ? seg : `${seg}${S || 'R'}`;
  return 'torso';
}
