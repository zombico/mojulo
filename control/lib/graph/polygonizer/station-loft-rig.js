/**
 * station-loft-rig — a LAYERED solid's rig: declared bindings, a rest skeleton, posing with planted toes,
 * skinning, and the packed rig figure the World runtime plays and the skinned glTF writer exports.
 *
 * Recipe additions (docs/planar-drawing.md, construction contract):
 *   rig: {
 *     joints: { <name>: { at: [x,y,z], rides?: <boneId> } },   // rest, recipe frame; VAJRA_CORE names required, never riding
 *     bones:  [{ id, head: <joint>, tail: <joint>, aux?: [<joint>, <joint>] }],   // aux: a two-vector frame (trunk twist)
 *     chains: { <channel>: { axis: 'x'|'y'|'z', sign?, links: [{ pivot: <joint>, joints: [<names>], weight? }] } },
 *     legs:   { L: { hip, knee, hock, toeBase, toeTip, pole: [x,y,z] }, R: {…} },   // the digitigrade chain
 *     hands?: { R: { carrier: <boneId>, wrist: <joint>, axes: { flex, deviation, twist }, joints?: [<names>],   // default: the carrier's riders
 *                    digits: { <digit>: { axis: [x,y,z], tip?, links: [{ pivot, joints?, weight?, axis? }] } },   // joints default: later pivots + tip
 *                    poses?: { <word>: { <digit>: deg } } }, L: {…} },                                   // poses default: HAND_POSES
 *     reach?: 'reject' | 'clamp',                                                  // an unreachable planted toe
 *   }
 *   parts.<L1>.bind: '<boneId>' | { bone, blend: { <station|station.slot|back|tip>: { <boneId>: w, … } } }
 * A pinned (L2/L3) part carries NO bind: it inherits its pin face's vertex weights through the pin's own
 * barycentric weights, so a claw belongs to its toe and a tooth to its jaw by construction. Nearest-bone
 * assignment is never used.
 *
 * Pose: `resolvePose` words / raw dof for the vajra core (LIMITS apply), plus this module's channels:
 *   crouch ∈ [0,1] (pelvis drop, toes planted), lift (metres, airborne), support: 'both'|'L'|'R'|'none',
 *   heelL/heelR (degrees the metatarsus rotates about the toe base, about +x), and every rig chain channel.
 * HANDS: a hand's joints ride its carrier bone (the forearm), but from points first turned in the REST frame: each digit's
 * links about its hinge axis by the digit's curl × the link's weight (a link's turn carrying the later links' own axes) (`fingers<S>`: degrees, + closing, or { <digit>:
 * deg }, or a word of `poses`; a number curls the thumb at half), then the whole hand about the wrist joint
 * (`wrist<S>`: flex, or { flex, deviation, twist }, degrees about the three axes). So the wrist and the digits move in
 * the hand's own frame whatever the arm does, and with no hand word the hand rides as it rests.
 * Planted legs: hip from the posed core; toe base and tip FIXED at rest; the metatarsus places the hock from
 * the toe and `heel`; femur + tibia solve two-link to the hock with the declared pole. Unreachable ⇒ `reach`
 * policy: 'reject' throws with the numbers, 'clamp' moves the hock onto the reach sphere and reports the
 * metatarsal error. Never a silent stretch, never a minimum-vertex grounding.
 *
 * Pure, deterministic. Frames are flat (absolute rotation + posed head per bone), IBM = T(−restHead), the
 * contract scene-gltf's skinned writer already has.
 */
import { articulate } from './figure-vajra.js';
import { resolvePose } from './figure-posing.js';
import { matToQuat, frameQuat, b64f32, b64u8 } from '../figures/rig-bake.js';
import { faceColorLinear } from '../figures/face-mesh.js';
import { characterLitPieces, drawLayer } from './station-loft-shade.js';
import * as dmath from '../../util/dmath.js';
import { withMath } from '../../util/math-scope.js';

export const VAJRA_CORE = ['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
export const RIG_CHANNELS = ['crouch', 'lift', 'support', 'heelL', 'heelR', 'stance', 'stagger'];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (v) => dmath.hypot(v[0], v[1], v[2]); const unit = (v) => { const l = len(v); if (!(l > 1e-12)) throw new Error('station-loft-rig: degenerate vector'); return mul(v, 1 / l); };
const fin3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const AXIS = { x: 0, y: 1, z: 2 };
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const quatToMat = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
const rotAxis = (p, pivot, ax, deg) => { const a = deg * Math.PI / 180, c = dmath.cos(a), s = dmath.sin(a); const [i, j] = [(ax + 1) % 3, (ax + 2) % 3]; const u = p[i] - pivot[i], v = p[j] - pivot[j]; const q = [...p]; q[i] = pivot[i] + u * c - v * s; q[j] = pivot[j] + u * s + v * c; return q; };

/** The hand words a `hands` block speaks unless it names its own `poses`, degrees of curl over the relaxed rest per digit
 * (the VRM / Godot digits): `relaxed` the rest; `open` flat (each digit's rest curl undone); `fist` every finger closed,
 * the thumb across them; `point` the index straight out of a fist; `grip` closed round a haft (a held blade's or staff's) */
export const HAND_POSES = Object.freeze({
  relaxed: Object.freeze({ thumb: 0, index: 0, middle: 0, ring: 0, little: 0 }),
  open: Object.freeze({ thumb: -8, index: -10, middle: -15, ring: -21, little: -28 }),
  fist: Object.freeze({ thumb: 30, index: 78, middle: 73, ring: 67, little: 60 }),
  point: Object.freeze({ thumb: 28, index: -10, middle: 73, ring: 67, little: 60 }),
  grip: Object.freeze({ thumb: 20, index: 54, middle: 50, ring: 45, little: 40 }),
});
/** Rodrigues: p turned about the line through `pivot` along unit `k` by `deg` degrees (right-handed). */
const rotLine = (p, pivot, k, deg) => { const a = deg * Math.PI / 180, c = dmath.cos(a), s = dmath.sin(a); const v = sub(p, pivot), kv = cross(k, v), d = dot(k, v); return add(pivot, add(add(mul(v, c), mul(kv, s)), mul(k, d * (1 - c)))); };
/** The hand channels a rig with `hands` reads (`wrist<S>`, `fingers<S>`). */
const handChannel = (R, n) => { const m = /^(wrist|fingers)([A-Z]\w*)$/.exec(n); return !!(m && R.hands?.[m[2]]); };
/** A hand channel's value in its full form: a wrist `{ flex, deviation, twist }`, the fingers `{ <digit>: deg }` (a word
 * through the hand's poses; a number curls every digit, the thumb at half). Unknown words throw by name. */
export function handValue(R, n, v) {
  const m = /^(wrist|fingers)(\w+)$/.exec(n), H = R.hands[m[2]];
  if (m[1] === 'wrist') { const w = typeof v === 'number' ? { flex: v } : (v || {}); return { flex: w.flex || 0, deviation: w.deviation || 0, twist: w.twist || 0 }; }
  if (typeof v === 'string') { if (!H.poses[v]) throw new Error(`station-loft-rig: ${n}: no hand pose '${v}' (have ${Object.keys(H.poses).join(', ')})`); v = H.poses[v]; }
  return Object.fromEntries(Object.keys(H.digits).map((d) => [d, typeof v === 'number' ? (d === 'thumb' ? v / 2 : v) : (v?.[d] || 0)]));
}
/** The hand's joints turned in the rest frame for `pose` (the digits' curls, then the wrist), by name; empty without hands. */
function handLocal(R, pose) {
  const out = {};
  for (const [S, H] of Object.entries(R.hands || {})) {
    const f = pose[`fingers${S}`], w = pose[`wrist${S}`];
    if ((f === undefined || f === 0) && (w === undefined || w === 0)) continue;
    const pts = Object.fromEntries(H.joints.map((j) => [j, [...R.joints[j]]]));
    // a link's turn carries the digit's later hinges with it (the thumb's knuckle turns with its root)
    if (f !== undefined) { const c = handValue(R, `fingers${S}`, f); for (const [d, g] of Object.entries(H.digits)) { if (!c[d]) continue; const ax = g.links.map((l) => l.axis ?? g.axis); g.links.forEach((l, i) => { const p = [...pts[l.pivot]], a = c[d] * l.weight; for (const j of l.joints) pts[j] = rotLine(pts[j], p, ax[i], a); for (let n = i + 1; n < ax.length; n++) if (ax[n] !== ax[i]) ax[n] = rotLine(ax[n], [0, 0, 0], ax[i], a); }); } }
    if (w !== undefined) { const v = handValue(R, `wrist${S}`, w), p = R.joints[H.wrist]; for (const k of ['flex', 'deviation', 'twist']) if (v[k]) for (const j of H.joints) pts[j] = rotLine(pts[j], p, H.axes[k], v[k]); }
    Object.assign(out, pts);
  }
  return out;
}

/** Validate a rig block; returns { joints: { name: at }, rides: { name: boneId }, bones, boneIndex, chains, legs, reach }. */
export function validateRig(rig) {
  if (!rig || typeof rig !== 'object' || !rig.joints || !Array.isArray(rig.bones)) throw new Error('station-loft-rig: rig needs joints and a bones list');
  const joints = {}, rides = {};
  for (const [name, j] of Object.entries(rig.joints)) { const at = Array.isArray(j) ? j : j?.at; if (!fin3(at)) throw new Error(`station-loft-rig: joint ${name} needs a finite at`); joints[name] = [...at]; if (j?.rides) rides[name] = j.rides; }
  for (const c of VAJRA_CORE) { if (!joints[c]) throw new Error(`station-loft-rig: the vajra core joint ${c} is missing`); if (rides[c]) throw new Error(`station-loft-rig: core joint ${c} cannot ride a bone`); }
  const boneIndex = {}; const bones = rig.bones.map((b, i) => {
    if (!b || typeof b.id !== 'string' || boneIndex[b.id] !== undefined) throw new Error(`station-loft-rig: bones[${i}] needs a unique id`);
    for (const k of ['head', 'tail']) if (!joints[b[k]]) throw new Error(`station-loft-rig: bone ${b.id}.${k} names unknown joint ${b[k]}`);
    if (b.head === b.tail) throw new Error(`station-loft-rig: bone ${b.id} has zero length`);
    if (b.aux && !(Array.isArray(b.aux) && b.aux.length === 2 && b.aux.every((j) => joints[j]))) throw new Error(`station-loft-rig: bone ${b.id}.aux must name two joints`);
    if (b.align !== undefined && !(Array.isArray(b.align) && b.align.length === 2 && b.align.every((j) => joints[j]) && b.align[0] !== b.align[1])) throw new Error(`station-loft-rig: bone ${b.id}.align must name two different joints`);
    boneIndex[b.id] = i; return { id: b.id, head: b.head, tail: b.tail, ...(b.aux ? { aux: [...b.aux] } : {}), ...(b.align ? { align: [...b.align] } : {}) };
  });
  for (const [name, bid] of Object.entries(rides)) if (boneIndex[bid] === undefined) throw new Error(`station-loft-rig: joint ${name} rides unknown bone ${bid}`);
  // riding must resolve: a joint rides a bone whose head and tail are core or ride bones that resolve first
  const placed = new Set(Object.keys(joints).filter((n) => !rides[n])); let progress = true;
  while (progress) { progress = false; for (const [name, bid] of Object.entries(rides)) { if (placed.has(name)) continue; const b = bones[boneIndex[bid]]; if (placed.has(b.head) && placed.has(b.tail) && (b.align || []).every((j) => placed.has(j))) { placed.add(name); progress = true; } } }
  const unresolved = Object.keys(rides).filter((n) => !placed.has(n)); if (unresolved.length) throw new Error(`station-loft-rig: cyclic or dangling rides: ${unresolved.join(', ')}`);
  const chains = {};
  for (const [ch, c] of Object.entries(rig.chains || {})) {
    if (AXIS[c?.axis] === undefined) throw new Error(`station-loft-rig: chain ${ch} axis must be x|y|z`);
    if (!Array.isArray(c.links) || !c.links.length) throw new Error(`station-loft-rig: chain ${ch} needs links`);
    for (const l of c.links) { if (!joints[l.pivot]) throw new Error(`station-loft-rig: chain ${ch} pivot ${l.pivot} is not a joint`); for (const j of l.joints || []) if (!joints[j]) throw new Error(`station-loft-rig: chain ${ch} names unknown joint ${j}`); }
    if (RIG_CHANNELS.includes(ch)) throw new Error(`station-loft-rig: chain ${ch} shadows a built-in channel`);
    chains[ch] = { axis: AXIS[c.axis], sign: c.sign ?? 1, links: c.links.map((l) => ({ pivot: l.pivot, joints: [...(l.joints || [])], weight: l.weight ?? 1 })) };
  }
  const legs = {};
  for (const [S, l] of Object.entries(rig.legs || {})) { for (const k of ['hip', 'knee', 'hock', 'toeBase', 'toeTip']) if (!joints[l?.[k]]) throw new Error(`station-loft-rig: legs.${S}.${k} is not a joint`); if (!fin3(l.pole)) throw new Error(`station-loft-rig: legs.${S}.pole must be a direction`); legs[S] = { ...l, pole: [...l.pole] }; }
  const reach = rig.reach ?? 'reject'; if (reach !== 'reject' && reach !== 'clamp') throw new Error("station-loft-rig: reach must be 'reject' or 'clamp'");
  const hands = {};
  for (const [S, h] of Object.entries(rig.hands || {})) {
    const at = `station-loft-rig: hands.${S}`;
    if (boneIndex[h?.carrier] === undefined) throw new Error(`${at}.carrier is not a bone`);
    if (!joints[h.wrist]) throw new Error(`${at}.wrist is not a joint`);
    for (const k of ['flex', 'deviation', 'twist']) if (!fin3(h.axes?.[k])) throw new Error(`${at}.axes.${k} must be a direction`);
    // the hand's joints: as listed, else every joint riding the carrier
    const handJoints = h.joints ?? Object.keys(rides).filter((j) => rides[j] === h.carrier);
    if (!Array.isArray(handJoints) || !handJoints.length) throw new Error(`${at}.joints must list the hand's joints (or joints must ride ${h.carrier})`);
    for (const j of handJoints) if (rides[j] !== h.carrier) throw new Error(`${at}: joint ${j} must ride the carrier ${h.carrier}`);
    const own = new Set(handJoints), digits = {};
    for (const [d, g] of Object.entries(h.digits || {})) {
      if (!fin3(g?.axis) || !Array.isArray(g.links) || !g.links.length) throw new Error(`${at}.digits.${d} needs an axis and links`);
      // a link's joints: as listed, else the later links' pivots and the digit's tip
      const later = (i) => [...g.links.slice(i + 1).map((l) => l.pivot), ...(g.tip ? [g.tip] : [])];
      const links = g.links.map((l, i) => ({ pivot: l.pivot, joints: [...(l.joints ?? later(i))], weight: l.weight ?? 1, axis: l.axis ? unit(l.axis) : null }));
      for (const l of links) for (const j of [l.pivot, ...l.joints]) if (!own.has(j)) throw new Error(`${at}.digits.${d} names ${j}, not one of the hand's joints`);
      for (const l of g.links) if (l.axis !== undefined && !fin3(l.axis)) throw new Error(`${at}.digits.${d}: a link's axis must be a direction`);
      digits[d] = { axis: unit(g.axis), links };
    }
    for (const ch of [`wrist${S}`, `fingers${S}`]) if (RIG_CHANNELS.includes(ch) || ch in chains) throw new Error(`${at}: the channel ${ch} is taken`);
    hands[S] = { carrier: h.carrier, wrist: h.wrist, axes: Object.fromEntries(['flex', 'deviation', 'twist'].map((k) => [k, unit(h.axes[k])])), joints: [...handJoints], digits, poses: h.poses || HAND_POSES };
  }
  return { joints, rides, bones, boneIndex, chains, legs, reach, hands };
}

/** A bone's rigid frame from rest to posed: q + rotation matrix; `aux` gives a full two-vector alignment. `align` names
 * two joints whose line is the primary direction in place of head → tail (a pelvis turned by its hip line alone, whatever
 * the spine above does to its tail); the bone still sits at its head and its length is still head → tail. */
function boneFrame(bone, rest, nodes) {
  const d0 = sub(rest[bone.tail], rest[bone.head]), d1 = sub(nodes[bone.tail], nodes[bone.head]);
  const a0 = bone.aux ? sub(rest[bone.aux[1]], rest[bone.aux[0]]) : null, a1 = bone.aux ? sub(nodes[bone.aux[1]], nodes[bone.aux[0]]) : null;
  const q = bone.align ? frameQuat(sub(rest[bone.align[1]], rest[bone.align[0]]), a0, sub(nodes[bone.align[1]], nodes[bone.align[0]]), a1) : frameQuat(d0, a0, d1, a1);
  return { id: bone.id, q, m: quatToMat(q), head: nodes[bone.head], restHead: rest[bone.head], lengthError: Math.abs(len(d1) - len(d0)) };
}
/** Every bone's frame for a posed node map. */
export function boneFrames(R, rest, nodes) { return R.bones.map((b) => boneFrame(b, rest, nodes)); }
const ride = (frame, restPoint) => add(frame.head, mv(frame.m, sub(restPoint, frame.restHead)));

/** Two-link solve: the middle joint for root → target with lengths l1, l2, bent toward `pole`. */
export function solveTwoBone(root, target, l1, l2, pole) {
  const d = len(sub(target, root)); const reach = l1 + l2; const minD = Math.abs(l1 - l2);
  if (d > reach + 1e-9 || d < minD - 1e-9) return { ok: false, excess: d > reach ? d - reach : minD - d, d };
  const axis = unit(sub(target, root)); const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let side = sub(pole, mul(axis, dot(pole, axis))); if (len(side) < 1e-9) throw new Error('station-loft-rig: pole is parallel to the limb'); side = unit(side);
  return { ok: true, mid: add(add(root, mul(axis, a)), mul(side, h)), d };
}

/**
 * Where a planted foot stands (its toe base and tip): at rest, unless the pose sets the STANCE (the feet's spread, a
 * multiple of the hip joints' own: 1 puts each ankle under its hip) or the STAGGER (+ the left foot forward and the right
 * back, each by half this share of the leg's height). The stand owns its base; the rest skeleton owns the anatomy.
 */
export function plantedFoot(R, L, pose = {}) {
  const rest = R.joints, foot = [0, 0, 0];
  if (Number.isFinite(pose.stance)) foot[0] = Math.sign(rest[L.hock][0] || rest[L.hip][0]) * pose.stance * Math.abs(rest[L.hip][0]) - rest[L.hock][0];
  if (Number.isFinite(pose.stagger)) foot[1] = (rest[L.hip][0] < 0 ? 0.5 : -0.5) * pose.stagger * (rest[L.hip][2] - rest[L.toeBase][2]);
  if (foot[0] === 0 && foot[1] === 0) return { toeBase: [...rest[L.toeBase]], toeTip: [...rest[L.toeTip]] };   // no stance word: the rest foot exactly
  return { toeBase: add(rest[L.toeBase], foot), toeTip: add(rest[L.toeTip], foot) };
}

/**
 * Pose the rig: the vajra core through resolvePose/articulate, planted digitigrade legs, riding extension
 * joints, then the chains. Returns { nodes, report: { legs: { S: { planted, reach, metaError } } } }.
 */
export function rigNodesAt(R, pose = {}) {
  const rest = R.joints; const nodes = {};
  const vajraSpec = Object.fromEntries(Object.entries(pose).filter(([k]) => !RIG_CHANNELS.includes(k) && !(k in R.chains) && !handChannel(R, k)));
  const core = Object.fromEntries(VAJRA_CORE.map((k) => [k, { x: rest[k][0], y: rest[k][1], z: rest[k][2] }]));
  const posed = withMath(dmath, () => articulate(resolvePose(vajraSpec, core), core));   // shared vajra FK on dmath (util/math-scope.js)
  for (const k of VAJRA_CORE) nodes[k] = [posed[k].x, posed[k].y, posed[k].z];
  // crouch: the pelvis (and everything the core carries) drops toward planted toes; lift raises the root
  const support = pose.support ?? 'both'; const lift = Number.isFinite(pose.lift) ? pose.lift : 0; const crouch = Math.max(0, Math.min(1, pose.crouch || 0));
  const legKeys = Object.keys(R.legs); const hipZ = legKeys.length ? Math.min(...legKeys.map((S) => rest[R.legs[S].hip][2])) : 0; const toeZ = legKeys.length ? Math.min(...legKeys.map((S) => rest[R.legs[S].toeBase][2])) : 0;
  const drop = crouch * 0.45 * (hipZ - toeZ);
  for (const k of VAJRA_CORE) nodes[k] = [nodes[k][0], nodes[k][1], nodes[k][2] - drop + lift];
  const report = { legs: {} };
  for (const S of legKeys) {
    const L = R.legs[S]; const planted = lift === 0 && (support === 'both' || support === S);
    const femur = len(sub(rest[L.knee], rest[L.hip])), tibia = len(sub(rest[L.hock], rest[L.knee])), meta = len(sub(rest[L.toeBase], rest[L.hock]));
    if (planted) {
      const foot = plantedFoot(R, L, pose); nodes[L.toeBase] = foot.toeBase; nodes[L.toeTip] = foot.toeTip;
      const metaDir = rotAxis(unit(sub(rest[L.hock], rest[L.toeBase])), [0, 0, 0], 0, pose[`heel${S}`] || 0);
      let hock = add(nodes[L.toeBase], mul(metaDir, meta)); let metaError = 0;
      let sol = solveTwoBone(nodes[L.hip], hock, femur, tibia, L.pole);
      if (!sol.ok) {
        if (R.reach === 'reject') throw new Error(`station-loft-rig: leg ${S} cannot reach its planted toe (hip→hock ${sol.d.toFixed(4)} m, femur+tibia ${(femur + tibia).toFixed(4)} m, excess ${sol.excess.toFixed(4)} m) — lower the crouch, change heel${S}, or set rig.reach: 'clamp'`);
        const axis = unit(sub(hock, nodes[L.hip])); const clamped = add(nodes[L.hip], mul(axis, sol.d > femur + tibia ? femur + tibia - 1e-9 : Math.abs(femur - tibia) + 1e-9));
        metaError = Math.abs(len(sub(nodes[L.toeBase], clamped)) - meta); hock = clamped; sol = solveTwoBone(nodes[L.hip], hock, femur, tibia, L.pole);
      }
      nodes[L.hock] = hock; nodes[L.knee] = sol.mid;
      report.legs[S] = { planted: true, reach: metaError > 0 ? 'clamped' : 'ok', metaError: r4(metaError) };
    } else {
      // airborne: the core's own leg pose stands; the toes ride the shin
      const shin = boneFrame({ id: 'shin', head: L.knee, tail: L.hock }, rest, nodes);
      nodes[L.toeBase] = ride(shin, rest[L.toeBase]); nodes[L.toeTip] = ride(shin, rest[L.toeTip]);
      report.legs[S] = { planted: false, reach: 'free', metaError: 0 };
    }
  }
  // extension joints ride their bones, in dependency order (a hand's from its rest points turned by the hand words)
  const local = handLocal(R, pose);
  let pending = Object.keys(R.rides).filter((n) => !nodes[n]); let progress = true;
  while (pending.length && progress) {
    progress = false;
    for (const name of [...pending]) { const b = R.bones[R.boneIndex[R.rides[name]]]; if (!nodes[b.head] || !nodes[b.tail] || (b.align || []).some((j) => !nodes[j])) continue; nodes[name] = ride(boneFrame(b, rest, nodes), local[name] ?? rest[name]); pending = pending.filter((n) => n !== name); progress = true; }
  }
  if (pending.length) throw new Error(`station-loft-rig: could not place ${pending.join(', ')}`);
  for (const [ch, c] of Object.entries(R.chains)) {
    const v = pose[ch]; if (!Number.isFinite(v) || v === 0) continue;
    for (const link of c.links) { const p = [...nodes[link.pivot]]; for (const j of link.joints) nodes[j] = rotAxis(nodes[j], p, c.axis, c.sign * v * link.weight); }
  }
  return { nodes, report };
}

const stationOf = (id) => id.match(/\/(st[^.]+)\.[^.]+$/)?.[1] ?? id.match(/\/(back|tip)$/)?.[1] ?? null;
const topFour = (acc) => { const e = Object.entries(acc).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 4); const s = e.reduce((t, [, w]) => t + w, 0); return e.map(([bi, w]) => [Number(bi), w / s]); };

/**
 * Bind a compiled layered mesh by declaration. Returns { joints: number[4][] , weights: number[4][], dominant: number[] }
 * (bone indices in rig order, per vertex), refusing unknown bones, invalid weights, and a bind on a pinned part.
 */
export function bindLayered(mesh, recipe, R = validateRig(recipe.rig)) {
  const n = mesh.vertices.length; const per = new Array(n); const idx = Object.fromEntries(mesh.pointIds.map((id, i) => [id, i]));
  const boneOf = (id, where) => { const bi = R.boneIndex[id]; if (bi === undefined) throw new Error(`station-loft-rig: ${where} binds unknown bone '${id}'`); return bi; };
  for (let i = 0; i < n; i++) {
    const prov = mesh.provenance[i]; const part = recipe.parts[prov.part];
    if (prov.layer !== 1) continue;
    const bind = part.bind; if (bind === undefined || bind === null) throw new Error(`station-loft-rig: part ${prov.part} has no bind`);
    if (typeof bind === 'string') { per[i] = [[boneOf(bind, prov.part), 1]]; continue; }
    if (!bind || typeof bind !== 'object' || typeof bind.bone !== 'string') throw new Error(`station-loft-rig: part ${prov.part}.bind must be a bone id or { bone, blend }`);
    // a `<station>.<slot>` entry weighs that one point over its station's (a form pushed out of a ring, its own bone)
    const st = stationOf(prov.id), sl = prov.id.match(/\.([^./]+)$/)?.[1]; const blend = (sl && bind.blend?.[`${st}.${sl}`]) || bind.blend?.[st];
    if (!blend) { per[i] = [[boneOf(bind.bone, prov.part), 1]]; continue; }
    const entries = Object.entries(blend); const sum = entries.reduce((t, [, w]) => t + w, 0);
    if (!entries.length || entries.length > 4 || entries.some(([, w]) => !Number.isFinite(w) || w < 0) || Math.abs(sum - 1) > 1e-9) throw new Error(`station-loft-rig: part ${prov.part} blend at ${st} must be ≤ 4 finite non-negative weights summing to 1`);
    per[i] = entries.map(([b, w]) => [boneOf(b, `${prov.part}.${st}`), w]);
  }
  for (const [name, part] of Object.entries(recipe.parts)) if (part.layer !== 1 && part.bind !== undefined) throw new Error(`station-loft-rig: pinned part ${name} cannot bind — it inherits its pin face`);
  const order = Object.entries(mesh.parts).filter(([, p]) => p.layer !== 1).sort(([a, x], [b, y]) => x.layer - y.layer || (a < b ? -1 : 1));
  for (const [name, part] of order) {
    const parent = mesh.parts[part.pin.parent]; const tri = parent.faces[part.pin.face]; if (!tri) throw new Error(`station-loft-rig: ${name} pin face ${part.pin.face} is gone`);
    const gid = (pid) => ((parent.layer ?? 1) === 1 ? pid : `${part.pin.parent}/${pid}`);   // an L2+ parent's faces carry its LOCAL point ids
    const acc = {}; tri.forEach((pid, k) => { const w = part.pin.weights[k]; const src = per[idx[gid(pid)]]; if (!src) throw new Error(`station-loft-rig: ${name} inherits from unbound ${pid}`); for (const [bi, ww] of src) acc[bi] = (acc[bi] || 0) + w * ww; });
    const inherited = topFour(acc);
    for (let i = 0; i < n; i++) if (mesh.provenance[i].part === name) per[i] = inherited;
  }
  const joints = [], weights = [], dominant = [];
  for (let i = 0; i < n; i++) { const e = per[i]; if (!e) throw new Error(`station-loft-rig: vertex ${mesh.pointIds[i]} unbound`); const j = [0, 0, 0, 0], w = [0, 0, 0, 0]; e.forEach(([bi, ww], k) => { j[k] = bi; w[k] = ww; }); joints.push(j); weights.push(w); dominant.push(e.reduce((b, x) => (x[1] > b[1] ? x : b), e[0])[0]); }
  return { joints, weights, dominant };
}

/** Linear-blend skin: every vertex through its bones' frames. At rest every frame is identity. */
export function skinLayered(mesh, skin, frames) {
  return mesh.vertices.map((v, i) => { const out = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = skin.weights[i][k]; if (!w) continue; const f = frames[skin.joints[i][k]]; const p = add(f.head, mv(f.m, sub(v, f.restHead))); out[0] += w * p[0]; out[1] += w * p[1]; out[2] += w * p[2]; } return out; });
}

/** Keyposes → phase → pose: vajra words resolved per key, every numeric channel smoothstep-blended, strings held. */
export function layeredClip(keyposes, R, { loop = true } = {}) {
  if (!Array.isArray(keyposes) || !keyposes.length) throw new Error('station-loft-rig: a clip needs keyposes');
  const core = Object.fromEntries(VAJRA_CORE.map((k) => [k, { x: R.joints[k][0], y: R.joints[k][1], z: R.joints[k][2] }]));
  const keys = keyposes.map((k) => { const own = {}; const vajra = {}; for (const [n, v] of Object.entries(k)) if (handChannel(R, n)) own[n] = handValue(R, n, v); else if (RIG_CHANNELS.includes(n) || n in R.chains) own[n] = v; else vajra[n] = v; return { ...withMath(dmath, () => resolvePose(vajra, core)), ...own }; });
  const seq = loop ? [...keys, keys[0]] : keys; const N = seq.length - 1;
  const blend = (a, b, t) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k], y = b[k]; if (typeof x === 'string' || typeof y === 'string') o[k] = t < 0.5 ? (x ?? y) : (y ?? x); else if ((x && typeof x === 'object') || (y && typeof y === 'object')) o[k] = blend(x || {}, y || {}, t); else o[k] = (x || 0) * (1 - t) + (y || 0) * t; } return o; };
  return (phase) => { if (N === 0) return { ...seq[0] }; const p = Math.max(0, Math.min(0.999999, phase)) * N; const i = Math.floor(p); let t = p - i; t = t * t * (3 - 2 * t); return blend(seq[i], seq[i + 1], t); };
}

/**
 * hull-shade (shader-look plan phase 1): per-vertex SHADING normals from the welded, area-weighted L1
 * hull normal field, so the baked light reads the smooth proxy while the silhouette keeps the grown
 * detail (the ArcSys move — nothing view-dependent, authored normals do the shaping). An L1 vertex takes
 * its own weld's normal; a detail vertex (provenance layer ≥ 2) takes the field normal of its NEAREST
 * weld (spatial-hash shells, one shell past the first hit). Parts named in `except` — focal detail whose
 * shading break IS the read (a horn, a ridge) — and any vertex the field cannot answer come back null,
 * and the caller keeps today's flat face shade for them. Pure and deterministic: a function of the mesh
 * alone. Validated on the head-detail dragon (0926 shader-look spike): facet noise on the hull goes;
 * same-palette relief flattens, which is what `except` is for.
 */
export function hullShadeNormals(mesh, { quantum = 1e-3, cell = 0.03, except = [] } = {}) {
  const layerOf = (vi) => mesh.provenance?.[vi]?.layer ?? 1;
  const skip = new Set(except);
  const wkey = (p) => `${Math.round(p[0] / quantum)},${Math.round(p[1] / quantum)},${Math.round(p[2] / quantum)}`;
  const bins = new Map();
  mesh.faces.forEach((tri) => {
    if (tri.length !== 3 || !tri.every((vi) => layerOf(vi) === 1)) return;
    const [a, b, c] = tri.map((vi) => mesh.vertices[vi]);
    const n = cross(sub(b, a), sub(c, a));   // unnormalized ⇒ area-weighted accumulation
    for (const vi of tri) { const k = wkey(mesh.vertices[vi]); let bin = bins.get(k); if (!bin) bins.set(k, bin = { n: [0, 0, 0], p: mesh.vertices[vi] }); bin.n = add(bin.n, n); }
  });
  for (const bin of bins.values()) { const l = len(bin.n); bin.n = l > 1e-12 ? mul(bin.n, 1 / l) : null; }
  const ckey = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  const grid = new Map();
  for (const bin of bins.values()) if (bin.n) { const k = ckey(bin.p); const cb = grid.get(k) || []; cb.push(bin); grid.set(k, cb); }
  const nearest = (p) => {
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
    let best = null, bd = Infinity, hit = -1;
    for (let r = 0; r <= 6; r++) {
      if (hit >= 0 && r > hit + 1) break;   // scan one shell past the first hit (a boundary neighbour can be closer)
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz2 = -r; dz2 <= r; dz2++) {
        if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz2)) !== r) continue;
        const cb = grid.get(`${cx + dx},${cy + dy},${cz + dz2}`);
        if (cb) for (const bin of cb) { const d = (p[0] - bin.p[0]) ** 2 + (p[1] - bin.p[1]) ** 2 + (p[2] - bin.p[2]) ** 2; if (d < bd) { bd = d; best = bin; } }
      }
      if (best && hit < 0) hit = r;
    }
    return best;
  };
  return mesh.vertices.map((p, vi) => {
    if (skip.has(mesh.provenance?.[vi]?.part)) return null;
    if (layerOf(vi) === 1) return bins.get(wkey(p))?.n ?? null;
    return nearest(p)?.n ?? null;
  });
}

/**
 * The rig parts under the CHARACTER LIGHT (station-loft-shade.js): the same pieces the static solid shows — the
 * palette colour (`palette[group]` → the part's tint → neutral grey) stepped into lit and shade swatches, split
 * crisply along the iso-line, FLAT per piece — so the clip preview and every animated export carry the look the
 * rest solid carries, not a grey Lambert of their own. A piece goes to its PARENT face's dominant-bone part (the
 * same vote as the plain path, so no triangle changes part). A corner on a mesh vertex takes that vertex's
 * joints and weights as authored; a corner the split made on edge a → b at fraction s takes the union of the two
 * ends' joints with the weights lerped ((1 − s)·a + s·b), and a corner inside a triangle (where the highlight's line
 * crosses the step's) its corners' by its weights, the heaviest four kept and renormalised — the skin is interpolated
 * exactly as the position was, so a split vertex rides between its ends in every pose.
 * Per part, the marks (the light's unlit groups: the eye lenses, the strokes, the mouth interior) come LAST and
 * `inkFaces` counts the faces before them: the outline hull (the World's rig preview, the skinned GLB's baked
 * ink) takes those only. `character`: `{ light, palette, normals }` (the pieces built here at `dz`), or
 * `{ pieces }` already built at `dz` (characterLitPieces, shared with the static faces).
 * DRAW LAYERS (station-loft-shade drawLayer; `hairInk` as the static faces take it): a part holding faces with a layer
 * runs [plain | hair | veil | marks | through] — the hair and the veil inside the outlined faces, the `through` faces
 * after the marks (never outlined) — and carries `ranges: { hair?, veil?, through? }`, each a [first, end) face span,
 * only for the layers it holds; the rig preview draws each span with its layer's stencil rule. A part with no layered
 * face keeps its order and carries no `ranges`.
 */
function characterRigParts(mesh, skin, parts, { light, palette = null, normals = null, pieces = null, hairInk = false, glows = null }, dz, face = null) {
  const P0 = pieces || characterLitPieces(mesh, { light, palette, normals, dz, glows });
  const rowAt = faceRowOf(face);
  const colOf = new Map(); const skinOf = new Map(); const boneOf = new Map();
  const vote = (fi) => {   // the plain path's dominant-bone vote over the PARENT face
    let bi = boneOf.get(fi); if (bi !== undefined) return bi;
    const votes = {}; for (const vi of mesh.faces[fi]) votes[skin.dominant[vi]] = (votes[skin.dominant[vi]] || 0) + 1;
    bi = Number(Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]); boneOf.set(fi, bi); return bi;
  };
  const addRef = (acc, r, w) => {
    if (r.vi !== undefined) { const J = skin.joints[r.vi], W = skin.weights[r.vi]; for (let k = 0; k < 4; k++) if (W[k] > 0) acc[J[k]] = (acc[J[k]] || 0) + w * W[k]; }
    else if (r.bary) for (const [vi, bw] of r.bary) addRef(acc, { vi }, w * bw);
    else if (r.mix) for (const x of r.mix) addRef(acc, x, w / r.mix.length);
    else { addRef(acc, { vi: r.a }, w * (1 - r.s)); addRef(acc, { vi: r.b }, w * r.s); }
  };
  const skinAt = (r) => {
    if (r.vi !== undefined) return [skin.joints[r.vi], skin.weights[r.vi]];
    let e = skinOf.get(r); if (e) return e;
    const acc = {}; addRef(acc, r, 1); const top = topFour(acc); const j = [0, 0, 0, 0], w = [0, 0, 0, 0];
    top.forEach(([bi, ww], k) => { j[k] = bi; w[k] = ww; }); skinOf.set(r, e = [j, w]); return e;
  };
  const run = () => ({ pos: [], col: [], jnt: [], wgt: [], faces: 0, ...(rowAt ? { mph: [] } : {}) });
  if (rowAt) for (const P of parts) P.mph = [];
  const marks = parts.map(run), layered = parts.map(() => ({ hair: run(), veil: run(), through: run() }));
  for (const pc of P0) {
    const bi = vote(pc.fi); const layer = drawLayer(mesh, pc, { hairInk });
    const P = layer === 'through' ? layered[bi].through : pc.mark ? marks[bi] : layer ? layered[bi][layer] : parts[bi];
    let c = colOf.get(pc.fill); if (!c) colOf.set(pc.fill, c = faceColorLinear({ fill: pc.fill }));
    P.faces++;
    for (const r of pc.refs) {
      const [j, w] = skinAt(r); P.pos.push(r.p[0], r.p[1], r.p[2]); P.col.push(c[0], c[1], c[2]); P.jnt.push(...j); P.wgt.push(...w);
      if (rowAt) { const d = rowAt(r); if (d) P.mph.push({ i: P.pos.length / 3 - 1, d }); }
    }
  }
  const append = (P, M) => {
    const at = P.faces, base = P.pos.length / 3; P.faces += M.faces; for (const k of ['pos', 'col', 'jnt', 'wgt']) for (const x of M[k]) P[k].push(x);
    if (M.mph) for (const e of M.mph) P.mph.push({ i: e.i + base, d: e.d });   // the run's rows at their shifted vertices
    return [at, P.faces];
  };
  parts.forEach((P, bi) => {
    const L = layered[bi], ranges = {};
    for (const k of ['hair', 'veil']) if (L[k].faces) ranges[k] = append(P, L[k]);
    P.inkFaces = P.faces; append(P, marks[bi]);
    if (L.through.faces) ranges.through = append(P, L.through);
    if (Object.keys(ranges).length) P.ranges = ranges;
  });
}

/** The FACE ROWS a corner carries (anime-face-rig `heroFaceRig`: `sub` per mesh vertex, `rows` of (1 + targets) × 3):
 * a corner on a mesh vertex takes that vertex's row, one the light's split made takes its ref's own interpolation of its
 * sources' rows — (1 − s)·a + s·b along an edge, the weighted sum inside a triangle, the mean of a ring — exactly as
 * joints and weights are carried; null where nothing moves. Null without a face. */
function faceRowOf(face) {
  if (!face) return null;
  const W = (1 + face.targets.length) * 3, cache = new Map();
  const vRow = (vi) => { const k = face.sub[vi]; return k < 0 ? null : face.rows.subarray(k * W, k * W + W); };
  const add = (out, r, w) => {
    if (r.vi !== undefined) { const x = vRow(r.vi); if (x) for (let j = 0; j < W; j++) out[j] += w * x[j]; }
    else if (r.bary) for (const [vi, bw] of r.bary) add(out, { vi }, w * bw);
    else if (r.mix) for (const x of r.mix) add(out, x, w / r.mix.length);
    else { add(out, { vi: r.a }, w * (1 - r.s)); add(out, { vi: r.b }, w * r.s); }
  };
  return (r) => {
    if (r.vi !== undefined) return vRow(r.vi);
    let e = cache.get(r); if (e !== undefined) return e;
    const out = new Float64Array(W); add(out, r, 1); e = out.some((x) => x !== 0) ? out : null; cache.set(r, e); return e;
  };
}

/**
 * Pack the packed rig figure: parts per DOMINANT bone with explicit per-vertex joints/weights, bones with rest
 * head/tail, clips as [q, head] per bone per key. `dz` seats the figure (the lowering's seat shift).
 * `hullShade: true | { quantum?, cell?, except? }` (default null → byte-identical output) bakes the COLOR
 * shade from `hullShadeNormals` per corner instead of the flat face normal; a null field entry keeps the
 * flat shade, so an excepted part or an unanswerable vertex shades exactly as today.
 * `character` (default null → byte-identical output): the CHARACTER LIGHT's parts instead (characterRigParts
 * above — the palette, the step and the split; `light` and `hullShade` do not apply), each part carrying
 * `inkFaces`, and `ranges` where it holds faces with a draw layer.
 * `face` (default null → byte-identical output): the anime hero's face rows (anime-face-rig `heroFaceRig`), carried per
 * corner (faceRowOf); a part holding a corner that moves gets `morph: { i, d }` after its other keys — `i` the part's
 * vertex indices (u32), `d` each one's row as float32 ((1 + targets) × 3: the rebase, then every target) — which the
 * skinned GLB writer turns into morph targets.
 * `seconds` (default null → byte-identical output): each clip's DESIGNED DURATION (hero-gesture `heroClipSeconds`, the
 * anime hero's), carried as `s` on its packed clip — the World page's clip preview and the GLB play the cycle over it
 * instead of their own three seconds and one; the clip keeps its `keys` samples (the door's rig gates pre-solve those
 * phases).
 */
export function packLayeredRig(mesh, skin, R, { clips = {}, keys = 12, dz = 0, light = [0.35, -0.55, 0.75], hullShade = null, character = null, face = null, seconds = null, gear = null, emissive = null } = {}) {
  const rest = Object.fromEntries(Object.entries(R.joints).map(([k, v]) => [k, [v[0], v[1], v[2] + dz]]));
  const L = unit(light); const parts = R.bones.map(() => ({ pos: [], col: [], jnt: [], wgt: [], faces: 0 }));
  const vN = hullShade && !character ? hullShadeNormals(mesh, hullShade === true ? {} : hullShade) : null;
  const rowAt = !character ? faceRowOf(face) : null;
  if (rowAt) for (const P of parts) P.mph = [];
  // the recipe's emissive groups (a lens, a visor slit, a reactor) keep their full colour on the plain path, as the
  // static solid does (layeredFaces); under the character light they ride the pieces. Absent ⇒ byte-identical.
  const glow = new Set(Array.isArray(emissive) ? emissive : []);
  if (character) characterRigParts(mesh, skin, parts, character, dz, face);
  else mesh.faces.forEach((tri, fi) => {
    const votes = {}; for (const vi of tri) votes[skin.dominant[vi]] = (votes[skin.dominant[vi]] || 0) + 1;
    const bi = Number(Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
    const part = mesh.parts[mesh.provenance[tri[0]].part]; const base = faceColorLinear({ fill: part.tint || '#8a8f96' });
    const p = tri.map((vi) => { const v = mesh.vertices[vi]; return [v[0], v[1], v[2] + dz]; }); const nrm = cross(sub(p[1], p[0]), sub(p[2], p[0])); const nl = len(nrm); const lit = glow.has(mesh.groups[fi]); const shade = lit ? 1 : 0.55 + 0.45 * Math.max(0, nl > 1e-12 ? dot(mul(nrm, 1 / nl), L) : 0);
    const P = parts[bi]; P.faces++;
    tri.forEach((vi, k) => { const s = !lit && vN && vN[vi] ? 0.55 + 0.45 * Math.max(0, dot(vN[vi], L)) : shade; P.pos.push(...p[k]); P.col.push(base[0] * s, base[1] * s, base[2] * s); P.jnt.push(...skin.joints[vi]); P.wgt.push(...skin.weights[vi]); if (rowAt) { const d = rowAt({ vi }); if (d) P.mph.push({ i: P.pos.length / 3 - 1, d }); } });
  });
  // held gear (hero-gear.js gearPackParts): rest triangles already seated, appended to their bone's part with weight 1
  // on that bone, after its own faces (outside its ink and draw-layer spans). Absent ⇒ the pack is byte-identical.
  if (Array.isArray(gear)) for (const g of gear) { const P = parts[g.bone]; if (!P) continue; for (const t of g.tris) { P.faces++; for (const p of t.p) { P.pos.push(p[0], p[1], p[2]); P.col.push(t.col[0], t.col[1], t.col[2]); P.jnt.push(g.bone, 0, 0, 0); P.wgt.push(1, 0, 0, 0); } } }
  const packedClips = {};
  for (const [name, clip] of Object.entries(clips)) {
    const fn = typeof clip === 'function' ? clip : layeredClip(clip, R); const flat = [];
    for (let k = 0; k < keys; k++) { const { nodes } = rigNodesAt(R, fn(k / keys)); const shifted = Object.fromEntries(Object.entries(nodes).map(([n, v]) => [n, [v[0], v[1], v[2] + dz]])); for (const f of boneFrames(R, rest, shifted)) flat.push(...f.q.map(r4), ...f.head.map(r4)); }
    packedClips[name] = { k: keys, b: flat, ...(seconds?.[name] > 0 ? { s: seconds[name] } : {}) };
  }
  let mnz = Infinity, mxz = -Infinity; for (const v of mesh.vertices) { if (v[2] + dz < mnz) mnz = v[2] + dz; if (v[2] + dz > mxz) mxz = v[2] + dz; }
  return {
    rig: true, layered: true,
    bones: R.bones.map((b) => ({ id: b.id, head: rest[b.head].map(r4), tail: rest[b.tail].map(r4) })),
    parts: parts.map((P) => (P.faces ? { pos: b64f32(P.pos), col: b64u8(P.col), faces: P.faces, jnt: Buffer.from(Uint8Array.from(P.jnt).buffer).toString('base64'), wgt: b64f32(P.wgt), ...(P.inkFaces !== undefined ? { inkFaces: P.inkFaces } : {}), ...(P.ranges ? { ranges: P.ranges } : {}), ...(P.mph?.length ? { morph: packMorph(P.mph) } : {}) } : null)),
    clips: packedClips, figH: r4(mxz - mnz),
  };
}

/** a part's face rows as the pack carries them: `i` (u32 vertex indices, ascending) and `d` (float32 rows) in base64 */
function packMorph(mph) {
  const W = mph[0].d.length, d = new Float32Array(mph.length * W);
  mph.forEach((e, k) => d.set(e.d, k * W));
  return { i: Buffer.from(Uint32Array.from(mph, (e) => e.i).buffer).toString('base64'), d: Buffer.from(d.buffer).toString('base64') };
}

/** The doc's machine gates on a bound, posed rig: weights valid, rest identity, bone lengths, orthonormal frames, planted toes. */
export function auditRig(mesh, skin, R, poses = [{}]) {
  const out = { vertices: mesh.vertices.length, badWeights: 0, blended: 0, restIdentity: 0, maxLengthError: 0, maxOrthoError: 0, maxPlantedDrift: 0, poses: [] };
  for (let i = 0; i < mesh.vertices.length; i++) { const w = skin.weights[i]; const s = w.reduce((a, b) => a + b, 0); if (Math.abs(s - 1) > 1e-9 || w.some((x) => x < 0 || !Number.isFinite(x)) || skin.joints[i].some((j) => j >= R.bones.length)) out.badWeights++; if (w.filter((x) => x > 1e-9).length > 1) out.blended++; }
  const rest = R.joints; const restFrames = boneFrames(R, rest, rest); const atRest = skinLayered(mesh, skin, restFrames);
  atRest.forEach((v, i) => { out.restIdentity = Math.max(out.restIdentity, len(sub(v, mesh.vertices[i]))); });
  for (const pose of poses) {
    const { nodes, report } = rigNodesAt(R, pose); const frames = boneFrames(R, rest, nodes);
    for (const f of frames) { out.maxLengthError = Math.max(out.maxLengthError, f.lengthError); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out.maxOrthoError = Math.max(out.maxOrthoError, Math.abs(dot(f.m[a], f.m[b]) - (a === b ? 1 : 0))); }
    // a planted toe stays where the pose plants it (plantedFoot: at rest, or where the stance and stagger put it)
    for (const [S, l] of Object.entries(R.legs)) if (report.legs[S]?.planted) { const at = plantedFoot(R, l, pose); out.maxPlantedDrift = Math.max(out.maxPlantedDrift, len(sub(nodes[l.toeBase], at.toeBase)), len(sub(nodes[l.toeTip], at.toeTip))); }
    out.poses.push({ pose, legs: report.legs });
  }
  return out;
}

export { matToQuat };
