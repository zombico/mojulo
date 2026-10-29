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
 *   heelL/heelR (degrees the metatarsus rotates about the toe base, about +x), toeTurnL/toeTurnR (degrees the toes turn
 *   about the toe base with a targeted foot, about +x; absent level), seat (degrees, 0 … 60: the free legs
 *   turned further forward about the hips, a seated statue's thighs level; seatL/seatR one leg's alone, added), and every
 *   rig chain channel.
 * STANCE (`rig.stance: { rise, toe, pitch }`, a heeled shoe's: lib/graph/footwear): every pose stands in it — the root
 *   `rise` metres higher, each planted foot's toes `toe` metres up (on the shoe's forepart sole) and its metatarsus turned
 *   `pitch` degrees heel-up about the toe base, or the pose's own `heel<S>` where it lifts the heel further (a free foot's
 *   toes turned down about the ankle by the pitch). Absent ⇒ nothing changes.
 * HELD (`rig.held: [<side>]`, a padded glove's grip baked into the rest hand: holdGrip): a held hand's fingers take no
 *   pose (its glove holds them); its wrist still turns. Absent ⇒ nothing changes.
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
import { articulate, TWIST_REF_NODES, twistPairFor, SCAPULA_POINTS } from './figure-vajra.js';
import { resolvePose, aimsHead } from './figure-posing.js';
import { matToQuat, frameQuat, twistQuat, b64f32, b64u8 } from '../figures/rig-bake.js';
import { faceColorLinear, faceListToMesh } from '../figures/face-mesh.js';
import { resolveMaterial, tagFacesWithMetal } from './materials.js';
import { characterLitPieces, drawLayer } from './station-loft-shade.js';
import { castLightFactor } from './vexar.js';
import * as dmath from '../../util/dmath.js';
import { withMath } from '../../util/math-scope.js';
import { faceHex } from './face-hex.js';
import { cellTriangles } from './field-paint.js';
import { axisTangent } from './normal-bake.js';
import * as bv from './body-relational-vec.js';

export const VAJRA_CORE = ['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
export const RIG_CHANNELS = ['crouch', 'lift', 'support', 'heelL', 'heelR', 'stance', 'stagger', 'seat', 'seatL', 'seatR', 'feet', 'sink', 'body', 'flow', 'facing', 'splayL', 'splayR', 'shift', 'toeTurnL', 'toeTurnR'];

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
    // (a held hand's fingers stay as its glove holds them)
    const f = R.held?.includes(S) ? undefined : pose[`fingers${S}`], w = pose[`wrist${S}`];
    if ((f === undefined || f === 0) && (w === undefined || w === 0)) continue;
    const pts = Object.fromEntries(H.joints.map((j) => [j, [...R.joints[j]]]));
    // a link's turn carries the digit's later hinges with it (the thumb's knuckle turns with its root)
    if (f !== undefined) { const c = handValue(R, `fingers${S}`, f); for (const [d, g] of Object.entries(H.digits)) { if (!c[d]) continue; const ax = g.links.map((l) => l.axis ?? g.axis); g.links.forEach((l, i) => { const p = [...pts[l.pivot]], a = c[d] * l.weight; for (const j of l.joints) pts[j] = rotLine(pts[j], p, ax[i], a); for (let n = i + 1; n < ax.length; n++) if (ax[n] !== ax[i]) ax[n] = rotLine(ax[n], [0, 0, 0], ax[i], a); }); } }
    if (w !== undefined) { const v = handValue(R, `wrist${S}`, w), p = R.joints[H.wrist]; for (const k of ['flex', 'deviation', 'twist']) if (v[k]) for (const j of H.joints) pts[j] = rotLine(pts[j], p, H.axes[k], v[k]); }
    Object.assign(out, pts);
  }
  return out;
}

/**
 * THE GRIP HELD AT REST (a padded glove's: lib/graph/handwear, a boxing glove's fist): the rig's hand joints and every
 * part riding the digits' bones turned into the hand word `grip[S]` at REST, by the rig's own curl (each link about its
 * hinge by the digit's curl × the link's weight, a later hinge carried by the turns before it), a part's point by the
 * turns of the links its bones lie past, blended by its weights. So the bind, every pose and an export hold the closed
 * hand; the hand is marked `held`, so a pose's own fingers do not curl it further. → { rig, parts } (only the parts it
 * turned)
 */
export function holdGrip(rig, parts, grip) {
  const R = validateRig(rig), joints = { ...rig.joints }, turned = {}, level = {}, steps = {}, rnd = (v) => v.map((x) => Math.round(x * 1e6) / 1e6);
  for (const [S, word] of Object.entries(grip || {})) {
    const H = R.hands?.[S]; if (!H) continue;
    const c = handValue(R, `fingers${S}`, word), pts = Object.fromEntries(H.joints.map((j) => [j, [...R.joints[j]]]));
    for (const [d, g] of Object.entries(H.digits)) {
      const ax = g.links.map((l) => l.axis ?? g.axis), key = `${d}${S}`; steps[key] = [];
      g.links.forEach((l, i) => {
        const p = [...pts[l.pivot]], a = (c[d] || 0) * l.weight; steps[key].push({ p, ax: ax[i], a });
        for (const j of l.joints) pts[j] = rotLine(pts[j], p, ax[i], a);
        for (let n = i + 1; n < ax.length; n++) if (ax[n] !== ax[i]) ax[n] = rotLine(ax[n], [0, 0, 0], ax[i], a);
        // (a bone headed at this link's pivot lies past it: turned by this link and those before)
        for (const b of R.bones) if (b.head === l.pivot) level[b.id] = { key, n: i + 1 };
      });
    }
    for (const j of H.joints) { const o = rig.joints[j]; joints[j] = Array.isArray(o) ? rnd(pts[j]) : { ...o, at: rnd(pts[j]) }; }
  }
  const T = (p, b) => { const L = level[b]; if (!L) return p; let q = p; for (const s of steps[L.key].slice(0, L.n)) q = rotLine(q, s.p, s.ax, s.a); return q; };
  const moved = (w) => Object.keys(w).some((b) => level[b]);
  for (const [name, P] of Object.entries(parts)) {
    const own = { [P.bind?.bone]: 1 }, blend = P.bind?.blend || {};
    if (!P.bind || !(level[P.bind.bone] || Object.values(blend).some(moved))) continue;
    const at = (p, w) => { const tot = Object.values(w).reduce((t, x) => t + x, 0) || 1; return rnd(Object.entries(w).reduce((acc, [b, x]) => { const q = T(p, b); return acc.map((v, i) => v + (q[i] * x) / tot); }, [0, 0, 0])); };
    turned[name] = { ...P, stations: P.stations.map((st) => ({ ...st, points: Object.fromEntries(Object.entries(st.points).map(([sl, p]) => [sl, at(p, blend[`${st.id}.${sl}`] ?? blend[st.id] ?? own)])) })),
      caps: Object.fromEntries(Object.entries(P.caps || {}).map(([k, p]) => [k, at(p, blend[k] ?? own)])) };
  }
  const held = [...new Set([...(rig.held ?? []), ...Object.keys(grip || {}).filter((S) => R.hands?.[S])])];
  return { rig: { ...rig, joints, ...(held.length ? { held } : {}) }, parts: turned };
}

/** Validate a rig block; returns { joints: { name: at }, rides: { name: boneId }, bones, boneIndex, chains, legs, reach }. */
export function validateRig(rig) {
  if (!rig || typeof rig !== 'object' || !rig.joints || !Array.isArray(rig.bones)) throw new Error('station-loft-rig: rig needs joints and a bones list');
  const joints = {}, rides = {};
  for (const [name, j] of Object.entries(rig.joints)) { const at = Array.isArray(j) ? j : j?.at; if (!fin3(at)) throw new Error(`station-loft-rig: joint ${name} needs a finite at`); joints[name] = [...at]; if (j?.rides) rides[name] = j.rides; }
  for (const c of VAJRA_CORE) { if (!joints[c]) throw new Error(`station-loft-rig: the vajra core joint ${c} is missing`); if (rides[c]) throw new Error(`station-loft-rig: core joint ${c} cannot ride a bone`); }
  // FOLDS: a hinge's helper bone (a knee's, an elbow's), its three joints placed by the fold itself (foldPoints), never
  // by the recipe: the head at the hinge pushed out to the bend's outside, the tail along the limb's mean line, the aim
  // toward the outside. Absent ⇒ no fold.
  const folds = {};
  for (const [id, f] of Object.entries(rig.folds || {})) {
    for (const k of ['joint', 'to', ...(f?.inAxis ? [] : ['from'])]) if (!joints[f?.[k]]) throw new Error(`station-loft-rig: folds.${id}.${k} is not a joint`);
    if (f.inAxis !== undefined && !fin3(f.inAxis)) throw new Error(`station-loft-rig: folds.${id}.inAxis must be a direction`);
    if (!fin3(f.front) || !(Number.isFinite(f.push) && f.push >= 0)) throw new Error(`station-loft-rig: folds.${id} needs a front direction and a push ≥ 0 (metres)`);
    if (!Array.isArray(f.bones) || f.bones.length !== 2) throw new Error(`station-loft-rig: folds.${id}.bones names the two limb bones`);
    for (const k of ['head', 'tail', 'aim']) if (typeof f[k] !== 'string' || joints[f[k]]) throw new Error(`station-loft-rig: folds.${id}.${k} names a new joint`);
    folds[id] = { joint: f.joint, from: f.from, to: f.to, ...(f.inAxis ? { inAxis: unit(f.inAxis) } : {}), front: unit(f.front), push: f.push, cap: f.cap ?? FOLD_CAP, bones: [...f.bones], head: f.head, tail: f.tail, aim: f.aim };
    const P = foldPoints(joints, folds[id]); joints[f.head] = P.head; joints[f.tail] = P.tail; joints[f.aim] = P.aim;
  }
  const boneIndex = {}; const bones = rig.bones.map((b, i) => {
    if (!b || typeof b.id !== 'string' || boneIndex[b.id] !== undefined) throw new Error(`station-loft-rig: bones[${i}] needs a unique id`);
    for (const k of ['head', 'tail']) if (!joints[b[k]]) throw new Error(`station-loft-rig: bone ${b.id}.${k} names unknown joint ${b[k]}`);
    if (b.head === b.tail) throw new Error(`station-loft-rig: bone ${b.id} has zero length`);
    if (b.aux && !(Array.isArray(b.aux) && b.aux.length === 2 && b.aux.every((j) => joints[j]))) throw new Error(`station-loft-rig: bone ${b.id}.aux must name two joints`);
    if (b.align !== undefined && !(Array.isArray(b.align) && b.align.length === 2 && b.align.every((j) => joints[j]) && b.align[0] !== b.align[1])) throw new Error(`station-loft-rig: bone ${b.id}.align must name two different joints`);
    boneIndex[b.id] = i; return { id: b.id, head: b.head, tail: b.tail, ...(b.aux ? { aux: [...b.aux] } : {}), ...(b.align ? { align: [...b.align] } : {}), ...(b.parent ? { parent: b.parent } : {}), ...(twistPairFor(b.head, b.tail) ? { twist: twistPairFor(b.head, b.tail) } : {}) };   // a bone spanning the neck turns with it
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
  let stance = null;
  if (rig.stance !== undefined) {
    const t = rig.stance, ok = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
    if (!t || !ok(t.rise, 0, 0.3) || !ok(t.toe, 0, 0.1) || !ok(t.pitch, 0, 70)) throw new Error('station-loft-rig: stance is { rise (0 … 0.3 m), toe (0 … 0.1 m), pitch (0 … 70°) }');
    stance = { rise: t.rise, toe: t.toe, pitch: t.pitch };
  }
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
  if (rig.held !== undefined && !(Array.isArray(rig.held) && rig.held.every((S) => hands[S]))) throw new Error(`station-loft-rig: held lists the rig's hands (${Object.keys(hands).join(', ')}) whose fingers its gloves hold`);
  for (const [id, f] of Object.entries(folds)) for (const b of f.bones) if (boneIndex[b] === undefined) throw new Error(`station-loft-rig: folds.${id}.bones names unknown bone ${b}`);
  // a bone's `parent` (a limb's next segment: the forearm's upper arm) frames it from that bone's frame by the shortest turn
  // from its rest line carried there to its posed line, so the joint between them bends and never twists (a hidden link,
  // not a field of the bone)
  for (const b of bones) if (b.parent) { const P = bones[boneIndex[b.parent]]; if (!P || P === b) throw new Error(`station-loft-rig: bone ${b.id}.parent names unknown bone ${b.parent}`); Object.defineProperty(b, 'parentBone', { value: P, enumerable: false }); }
  // `cervical`: a head or neck AIM posed as the cervical spine, within its range (figure-vajra.js CERVICAL_CAP); raw
  // angles stay each joint's own (a solver's that splits them itself: hero-aura.js's gaze)
  if (rig.cervical !== undefined && rig.cervical !== true) throw new Error('station-loft-rig: cervical is true or absent');
  return { joints, rides, bones, boneIndex, chains, legs, reach, hands, ...(Object.keys(folds).length ? { folds } : {}), ...(stance ? { stance } : {}), ...(rig.held?.length ? { held: [...rig.held] } : {}), ...(rig.cervical ? { cervical: true } : {}) };
}

/**
 * A FOLD's joints for a pose: a hinge skinned by a blend of its two bones collapses as it bends (the blended ring is
 * drawn inside the joint: the front of a bent knee goes flat, a paper fold). The fold's helper bone carries the rings at
 * the hinge instead: turned HALF the bend (along the limb's mean line through the joint, the mitre of two tubes), its
 * head pushed toward the bend's outside by the mitre's own growth, `push` × (1 / cos(bend / 2) − 1), at most `cap` ×
 * push — the kneecap's and the elbow's point keep their volume. `frames` (the two limb bones' frames) turn the rest
 * `front` with the limb (the aim: the fold's roll, half the two bones' own), and the head goes out on the bend's convex
 * side; at rest they are the identity. A BALL joint (the hip) names `inAxis`, the rest line the first bone carries into
 * the joint (the thigh's rest line, carried by the pelvis), in place of a `from` joint.
 */
const FOLD_CAP = 0.6;
function foldPoints(nodes, F, frames = null) {
  const J = nodes[F.joint], b = unit(sub(nodes[F.to], J));
  const a = F.inAxis ? unit(frames ? mv(frames[0].m, F.inAxis) : F.inAxis) : unit(sub(J, nodes[F.from]));
  const s = add(a, b), d = len(s) > 1e-9 ? unit(s) : b;
  const fr = frames ? add(mv(frames[0].m, F.front), mv(frames[1].m, F.front)) : F.front;
  const fp = sub(fr, mul(d, dot(fr, d))); const f = len(fp) > 1e-9 ? unit(fp) : unit(sub(F.front, mul(d, dot(F.front, d))));
  const c = Math.max(-1, Math.min(1, dot(a, b))), grow = Math.sqrt(2 / (1 + c + 1e-12)) - 1;   // 1 / cos(bend / 2) − 1
  // the convex side: a − b (⟂ the mean line), the front's side while the limb is near straight
  const v = sub(a, b), out = len(v) > 1e-6 ? unit(v) : f;
  const head = add(J, mul(out, F.push * Math.min(F.cap, grow)));
  return { head, tail: add(head, mul(d, 0.08)), aim: add(head, mul(f, 0.08)) };
}

/** A bone's rigid frame from rest to posed: q + rotation matrix; `aux` gives a full two-vector alignment. `align` names
 * two joints whose line is the primary direction in place of head → tail (a pelvis turned by its hip line alone, whatever
 * the spine above does to its tail); the bone still sits at its head and its length is still head → tail. */
function boneFrame(bone, rest, nodes) {
  // a whole-body turn (`body`, rigNodesAt): the frame of the upright solve, turned by the body's own rotation — a bone's
  // own line alone would leave its spin to the shortest arc, which twists a head or a hand past a quarter turn
  if (nodes.$body) {
    const f = boneFrame(bone, rest, nodes.$body.unrot); const M = nodes.$body.M;
    const m = [0, 1, 2].map((r) => [0, 1, 2].map((c) => M[r][0] * f.m[0][c] + M[r][1] * f.m[1][c] + M[r][2] * f.m[2][c]));
    // (rig-bake's matToQuat reads a matrix by columns where quatToMat writes rows: hand it the transpose)
    const q = matToQuat([0, 1, 2].map((c) => [0, 1, 2].map((r) => m[r][c]))); return { ...f, q, m: quatToMat(q), head: nodes[bone.head] };
  }
  // a stance's `facing` (rigNodesAt): a bone wholly in the turned core takes the frame of the unturned solve turned by
  // the facing, so a bone along the vertical (the neck, the head, a hanging arm) turns with the body instead of keeping
  // its rest spin; a planted leg's `splay` pre-turns that leg's bones' rest about the vertical by the toe's angle, so
  // the thigh and the shin roll with the knee as it tracks the toes
  if (nodes.$facing && [bone.head, bone.tail, ...(bone.aux || []), ...(bone.align || [])].every((j) => nodes.$facing.keys.has(j))) {
    const f = boneFrame(bone, rest, nodes.$facing.unrot); const M = nodes.$facing.M;
    const m = [0, 1, 2].map((r) => [0, 1, 2].map((c) => M[r][0] * f.m[0][c] + M[r][1] * f.m[1][c] + M[r][2] * f.m[2][c]));
    const q = matToQuat([0, 1, 2].map((c) => [0, 1, 2].map((r) => m[r][c]))); return { ...f, q, m: quatToMat(q), head: nodes[bone.head] };
  }
  const yaw = nodes.$legYaw?.[bone.head];
  if (yaw && !bone.aux && !bone.align) {
    const Z = rotAxis([1, 0, 0], [0, 0, 0], 2, yaw), Y = rotAxis([0, 1, 0], [0, 0, 0], 2, yaw); const Mz = [[Z[0], Y[0], 0], [Z[1], Y[1], 0], [0, 0, 1]];
    const d0 = sub(rest[bone.tail], rest[bone.head]), d1 = sub(nodes[bone.tail], nodes[bone.head]);
    const f = quatToMat(frameQuat(rotAxis(d0, [0, 0, 0], 2, yaw), null, d1, null));
    const m = [0, 1, 2].map((r) => [0, 1, 2].map((c) => f[r][0] * Mz[0][c] + f[r][1] * Mz[1][c] + f[r][2] * Mz[2][c]));
    const q = matToQuat([0, 1, 2].map((c) => [0, 1, 2].map((r) => m[r][c])));
    return { id: bone.id, q, m: quatToMat(q), head: nodes[bone.head], restHead: rest[bone.head], lengthError: Math.abs(len(d1) - len(d0)) };
  }
  const d0 = sub(rest[bone.tail], rest[bone.head]), d1 = sub(nodes[bone.tail], nodes[bone.head]);
  if (bone.parentBone) {
    const P = boneFrame(bone.parentBone, rest, nodes), A = quatToMat(frameQuat(mv(P.m, d0), null, d1, null));
    const m = [0, 1, 2].map((r) => [0, 1, 2].map((c) => A[r][0] * P.m[0][c] + A[r][1] * P.m[1][c] + A[r][2] * P.m[2][c]));
    const q = matToQuat([0, 1, 2].map((c) => [0, 1, 2].map((r) => m[r][c])));
    return { id: bone.id, q, m: quatToMat(q), head: nodes[bone.head], restHead: rest[bone.head], lengthError: Math.abs(len(d1) - len(d0)) };
  }
  const a0 = bone.aux ? sub(rest[bone.aux[1]], rest[bone.aux[0]]) : null, a1 = bone.aux ? sub(nodes[bone.aux[1]], nodes[bone.aux[0]]) : null;
  let q = bone.align ? frameQuat(sub(rest[bone.align[1]], rest[bone.align[0]]), a0, sub(nodes[bone.align[1]], nodes[bone.align[0]]), a1) : frameQuat(d0, a0, d1, a1);
  // a head turn: the twist pair is in the posed map only while the neck or head turns
  if (bone.twist && nodes[bone.twist[0]] && nodes[bone.twist[1]]) q = twistQuat(q, d1, nodes[bone.head], nodes[bone.twist[0]], nodes[bone.twist[1]]);
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
  // a rig's `pelvisTilt` joint (the structured core's) rides the vajra with the pelvis: it tips with the hip hinge, so
  // the pelvis bone (its roll from it) tips with the trunk over the thighs, and stays put when only the spine bends
  // a rig with collarbones (`girdleL/R`: the structured core's) lifts the shoulder with a raised arm (figure-vajra.js
  // `girdle`), `girdle<S>` keeping where it sat for the chest's own line
  const girdle = !!rest.girdleR;
  // (and the scapula's points where the rig has them: the vajra turns them with the shoulder and the rhythm)
  const coreKeys = [...VAJRA_CORE, ...(rest.pelvisTilt ? ['pelvisTilt'] : []), ...(girdle ? ['girdleL', 'girdleR', 'clavicleL', 'clavicleR', ...['L', 'R'].flatMap((S) => SCAPULA_POINTS.map((k) => `${k}${S}`)).filter((k) => rest[k])] : [])];
  const core = Object.fromEntries(coreKeys.map((k) => [k, { x: rest[k][0], y: rest[k][1], z: rest[k][2] }]));
  const posed = withMath(dmath, () => articulate({ ...resolvePose(vajraSpec, core), ...(girdle ? { girdle: true } : {}), ...(R.cervical && aimsHead(vajraSpec) ? { cervical: true } : {}) }, core));   // shared vajra FK on dmath (util/math-scope.js)
  // the core, and the head turn's twist pairs when the pose turns the neck or head (absent otherwise)
  const carried = [...coreKeys, ...TWIST_REF_NODES.filter((k) => posed[k])];
  for (const k of carried) nodes[k] = [posed[k].x, posed[k].y, posed[k].z];
  // crouch: the pelvis (and everything the core carries) drops toward planted toes; lift raises the root
  const support = pose.support ?? 'both'; const lift = Number.isFinite(pose.lift) ? pose.lift : 0; const crouch = Math.max(0, Math.min(1, pose.crouch || 0));
  const legKeys = Object.keys(R.legs); const hipZ = legKeys.length ? Math.min(...legKeys.map((S) => rest[R.legs[S].hip][2])) : 0; const toeZ = legKeys.length ? Math.min(...legKeys.map((S) => rest[R.legs[S].toeBase][2])) : 0;
  // `sink` (metres, a locomotion bake's: hero-motion.js) lowers the root as the walk's vault does, so a planted foot
  // reached fore or aft stays on the floor. Absent ⇒ 0.
  const sink = Number.isFinite(pose.sink) ? Math.max(0, pose.sink) : 0;
  const drop = crouch * 0.45 * (hipZ - toeZ) + sink;
  for (const k of carried) nodes[k] = [nodes[k][0], nodes[k][1], nodes[k][2] - drop + lift];
  // (the STANCE: the root risen on the shoes)
  const ST = R.stance;
  if (ST) for (const k of carried) nodes[k] = [nodes[k][0], nodes[k][1], nodes[k][2] + ST.rise];
  // `shift: { x, y }` (metres: an action's, hero-strike.js) carries the core over the floor — the weight moving over
  // planted feet, the legs reaching them from where the hips now are. Absent ⇒ nothing moves.
  const sx = Number.isFinite(pose.shift?.x) ? pose.shift.x : 0, sy = Number.isFinite(pose.shift?.y) ? pose.shift.y : 0;
  if (sx || sy) for (const k of carried) nodes[k] = [nodes[k][0] + sx, nodes[k][1] + sy, nodes[k][2]];
  // `facing` (degrees, + to the body's left: a stance's, hero-stance.js) turns the core — the pelvis and all it carries —
  // about the vertical through the pelvis hub BEFORE the legs reach their feet, so planted feet stay where they stand and
  // the body turns over them. Absent ⇒ nothing turns.
  if (Number.isFinite(pose.facing) && pose.facing) {
    const pv = nodes.pelvisHub, unrot = {};
    for (const k of carried) { unrot[k] = nodes[k]; nodes[k] = rotAxis(nodes[k], pv, 2, pose.facing); }
    const X = rotAxis([1, 0, 0], [0, 0, 0], 2, pose.facing), Y = rotAxis([0, 1, 0], [0, 0, 0], 2, pose.facing);
    Object.defineProperty(nodes, '$facing', { value: { M: [[X[0], Y[0], 0], [X[1], Y[1], 0], [0, 0, 1]], unrot, keys: new Set(carried) }, enumerable: false });
  }
  const legYaw = {};
  const report = { legs: {} };
  for (const S of legKeys) {
    // `feet: { L?, R? }` (a locomotion bake's) gives a leg its toe-base TARGET in the rig frame: the leg reaches it
    // whatever the support says (a footfall planted anywhere on the floor, or a swing foot on its arc), the foot keeping
    // its rest orientation turned by heel<S>. Absent ⇒ the planted / free legs as before. The toes stay level (a planted
    // push-off rolls onto them) unless `toeTurn<S>` (degrees, about +x as heel<S> is) turns them about the toe base: a
    // swing foot's toes turned with the foot. Absent ⇒ level.
    const target = Array.isArray(pose.feet?.[S]) ? pose.feet[S] : null;
    const L = R.legs[S]; const planted = !!target || (lift === 0 && (support === 'both' || support === S));
    const femur = len(sub(rest[L.knee], rest[L.hip])), tibia = len(sub(rest[L.hock], rest[L.knee])), meta = len(sub(rest[L.toeBase], rest[L.hock]));
    if (planted) {
      const toeTurn = Number(pose[`toeTurn${S}`]) || 0, toeVec = sub(rest[L.toeTip], rest[L.toeBase]);
      const foot = target ? { toeBase: [...target], toeTip: add(target, toeTurn ? rotAxis(toeVec, [0, 0, 0], 0, toeTurn) : toeVec) } : plantedFoot(R, L, pose); nodes[L.toeBase] = foot.toeBase; nodes[L.toeTip] = foot.toeTip;
      // (the STANCE: the toes on the forepart sole, the heel up by its pitch)
      if (ST) { nodes[L.toeBase] = add(nodes[L.toeBase], [0, 0, ST.toe]); nodes[L.toeTip] = add(nodes[L.toeTip], [0, 0, ST.toe]); }
      let metaDir = rotAxis(unit(sub(rest[L.hock], rest[L.toeBase])), [0, 0, 0], 0, ST ? Math.min(pose[`heel${S}`] || 0, -ST.pitch) : (pose[`heel${S}`] || 0));
      // `splay<S>` (degrees, + the toe outward: a stance's) turns the planted foot about the vertical through its ball —
      // the toe and the heel round it — and the knee's pole with it, so the knee tracks over the toes. Absent ⇒ none.
      const splay = Number.isFinite(pose[`splay${S}`]) ? pose[`splay${S}`] * (rest[L.hip][0] < 0 ? 1 : -1) : 0;
      let pole = L.pole;
      if (splay) { nodes[L.toeTip] = rotAxis(nodes[L.toeTip], nodes[L.toeBase], 2, splay); metaDir = rotAxis(metaDir, [0, 0, 0], 2, splay); pole = rotAxis(pole, [0, 0, 0], 2, splay); for (const j of [L.hip, L.knee, L.hock, L.toeBase]) legYaw[j] = splay; }
      let hock = add(nodes[L.toeBase], mul(metaDir, meta)); let metaError = 0;
      let sol = solveTwoBone(nodes[L.hip], hock, femur, tibia, pole);
      if (!sol.ok) {
        if (R.reach === 'reject') throw new Error(`station-loft-rig: leg ${S} cannot reach its planted toe (hip→hock ${sol.d.toFixed(4)} m, femur+tibia ${(femur + tibia).toFixed(4)} m, excess ${sol.excess.toFixed(4)} m) — lower the crouch, change heel${S}, or set rig.reach: 'clamp'`);
        const axis = unit(sub(hock, nodes[L.hip])); const clamped = add(nodes[L.hip], mul(axis, sol.d > femur + tibia ? femur + tibia - 1e-9 : Math.abs(femur - tibia) + 1e-9));
        metaError = Math.abs(len(sub(nodes[L.toeBase], clamped)) - meta); hock = clamped; sol = solveTwoBone(nodes[L.hip], hock, femur, tibia, pole);
      }
      nodes[L.hock] = hock; nodes[L.knee] = sol.mid;
      // (a planted leg's solve re-places its knee and hock: no longer the turned core's, so its bones read their own)
      if (nodes.$facing) for (const j of [L.knee, L.hock]) nodes.$facing.keys.delete(j);
      report.legs[S] = { planted: true, reach: metaError > 0 ? 'clamped' : 'ok', metaError: r4(metaError) };
    } else {
      // airborne: the core's own leg pose stands; the toes ride the shin. `seat` (a seated statue's: the base carries
      // it) turns the free leg further forward about its hip, past the swivel's anatomical cone, so the thigh lies level;
      // `seat<S>` (a knee drive's: hero-vault.js) adds to it for that leg alone. Absent ⇒ as before.
      const seat = Math.max(0, Math.min(60, (Number.isFinite(pose.seat) ? pose.seat : 0) + (Number.isFinite(pose[`seat${S}`]) ? pose[`seat${S}`] : 0)));
      if (seat) {
        for (const j of [L.knee, L.hock]) nodes[j] = rotAxis(nodes[j], nodes[L.hip], 0, seat);
        // (a seated leg's knee and hock are no longer the turned core's, as a planted leg's are not: under a facing the
        // shin's frame read their unturned places from before the seat, and the toes rode a shin the leg no longer had)
        if (nodes.$facing) for (const j of [L.knee, L.hock]) nodes.$facing.keys.delete(j);
      }
      const shin = boneFrame({ id: 'shin', head: L.knee, tail: L.hock }, rest, nodes);
      nodes[L.toeBase] = ride(shin, rest[L.toeBase]); nodes[L.toeTip] = ride(shin, rest[L.toeTip]);
      // (the STANCE: a foot in heels stays tipped off the ground too, its toes turned down about the ankle by the pitch)
      if (ST) for (const j of [L.toeBase, L.toeTip]) nodes[j] = rotAxis(nodes[j], nodes[L.hock], 0, -ST.pitch);
      report.legs[S] = { planted: false, reach: 'free', metaError: 0 };
    }
  }
  if (Object.keys(legYaw).length) Object.defineProperty(nodes, '$legYaw', { value: legYaw, enumerable: false });
  // the folds, on the solved limbs (rigNodesAt's own frames for the two limb bones)
  for (const F of Object.values(R.folds || {})) {
    const P = foldPoints(nodes, F, F.bones.map((id) => boneFrame(R.bones[R.boneIndex[id]], rest, nodes)));
    nodes[F.head] = P.head; nodes[F.tail] = P.tail; nodes[F.aim] = P.aim;
  }
  // extension joints ride their bones, in dependency order (a hand's from its rest points turned by the hand words)
  const local = handLocal(R, pose);
  // `flow: { <joint>: [dx, dy, dz] }` (hero-flow.js): a control string's joint displaced from its rest place in the frame
  // of the bone it rides (the head for hair, the pelvis for a skirt), so a string swings with what carries it through any
  // turn. Absent ⇒ nothing moves.
  const H = pose.flow && typeof pose.flow === 'object' ? pose.flow : null;
  const restOf = (name) => { const p = local[name] ?? rest[name], d = H?.[name]; return Array.isArray(d) && d.length === 3 ? [p[0] + d[0], p[1] + d[1], p[2] + d[2]] : p; };
  let pending = Object.keys(R.rides).filter((n) => !nodes[n]); let progress = true;
  while (pending.length && progress) {
    progress = false;
    for (const name of [...pending]) { const b = R.bones[R.boneIndex[R.rides[name]]]; if (!nodes[b.head] || !nodes[b.tail] || (b.align || []).some((j) => !nodes[j])) continue; nodes[name] = ride(boneFrame(b, rest, nodes), restOf(name)); pending = pending.filter((n) => n !== name); progress = true; }
  }
  if (pending.length) throw new Error(`station-loft-rig: could not place ${pending.join(', ')}`);
  for (const [ch, c] of Object.entries(R.chains)) {
    const v = pose[ch]; if (!Number.isFinite(v) || v === 0) continue;
    for (const link of c.links) { const p = [...nodes[link.pivot]]; for (const j of link.joints) nodes[j] = rotAxis(nodes[j], p, c.axis, c.sign * v * link.weight); }
  }
  // `body: { pitch?, roll?, at, up? }` (a roll's: hero-jump.js) turns the whole posed figure rigidly about the point `at`
  // — first `roll` degrees to its right (the head toward +x), then `pitch` degrees forward (the head toward +y), so a
  // forward roll tilted onto a shoulder goes over it diagonally — then raises it `up` metres. Absent ⇒ nothing moves.
  // Without `at` (a keyed clip's: a fall), it turns about the floor under its feet, the body falling over them, and only
  // when it turns or rises at all
  const B = pose.body;
  const tipped = B && typeof B === 'object' && B.at === undefined && ((Number.isFinite(B.pitch) && B.pitch) || (Number.isFinite(B.roll) && B.roll) || (Number.isFinite(B.up) && B.up));
  if (B && typeof B === 'object' && (Array.isArray(B.at) || tipped)) {
    const feet = Object.values(R.legs || {}).map((L) => nodes[L.hock]).filter(Boolean), floor = Math.min(...Object.values(R.legs || {}).map((L) => nodes[L.toeBase]?.[2] ?? Infinity));
    const pv = Array.isArray(B.at) ? B.at : feet.length ? [feet.reduce((s, p) => s + p[0], 0) / feet.length, feet.reduce((s, p) => s + p[1], 0) / feet.length, Number.isFinite(floor) ? floor : 0] : [0, 0, 0];
    const up = Number.isFinite(B.up) ? B.up : 0;
    // the rotation itself (the basis turned as the points are), and the upright solve, ride the map unenumerated for
    // boneFrames: each bone's frame is the upright one turned by it
    const turn = (v) => { let q = v; if (Number.isFinite(B.roll) && B.roll) q = rotAxis(q, [0, 0, 0], 1, B.roll); if (Number.isFinite(B.pitch) && B.pitch) q = rotAxis(q, [0, 0, 0], 0, -B.pitch); return q; };
    const cols = [turn([1, 0, 0]), turn([0, 1, 0]), turn([0, 0, 1])]; const M = [0, 1, 2].map((r) => cols.map((c) => c[r]));
    const unrot = { ...nodes };
    for (const k of ['$facing', '$legYaw']) if (nodes[k]) Object.defineProperty(unrot, k, { value: nodes[k], enumerable: false });
    for (const k of Object.keys(nodes)) {
      let q = nodes[k];
      if (Number.isFinite(B.roll) && B.roll) q = rotAxis(q, pv, 1, B.roll);
      if (Number.isFinite(B.pitch) && B.pitch) q = rotAxis(q, pv, 0, -B.pitch);
      nodes[k] = [q[0], q[1], q[2] + up];
    }
    Object.defineProperty(nodes, '$body', { value: { M, unrot }, enumerable: false });
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
    // a pinned part may weigh its own points (opt-in `boneWeights`: { <point id>: [[bone, w], …] }, an articulated
    // wing's): those points ride their bones, the rest inherit the pin face
    const own = recipe.parts[name]?.boneWeights;
    for (let i = 0; i < n; i++) if (mesh.provenance[i].part === name) {
      const pid = mesh.provenance[i].id, e = own?.[pid.startsWith(`${name}/`) ? pid.slice(name.length + 1) : pid];   // a pinned part's points are `<part>/<id>`
      if (!e) { per[i] = inherited; continue; }
      const sum = e.reduce((t, [, w]) => t + w, 0);
      if (!e.length || e.length > 4 || !(sum > 0)) throw new Error(`station-loft-rig: ${name} point ${pid} weighs ${e.length} bones (1 to 4, a positive sum)`);
      per[i] = e.map(([b, w]) => [boneOf(b, `${name}.${pid}`), w / sum]);
    }
  }
  const joints = [], weights = [], dominant = [];
  for (let i = 0; i < n; i++) { const e = per[i]; if (!e) throw new Error(`station-loft-rig: vertex ${mesh.pointIds[i]} unbound`); const j = [0, 0, 0, 0], w = [0, 0, 0, 0]; e.forEach(([bi, ww], k) => { j[k] = bi; w[k] = ww; }); joints.push(j); weights.push(w); dominant.push(e.reduce((b, x) => (x[1] > b[1] ? x : b), e[0])[0]); }
  return { joints, weights, dominant };
}

/** Linear-blend skin: every vertex through its bones' frames. At rest every frame is identity. */
export function skinLayered(mesh, skin, frames) {
  return mesh.vertices.map((v, i) => { const out = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = skin.weights[i][k]; if (!w) continue; const f = frames[skin.joints[i][k]]; const p = add(f.head, mv(f.m, sub(v, f.restHead))); out[0] += w * p[0]; out[1] += w * p[1]; out[2] += w * p[2]; } return out; });
}

/** Keyposes → phase → pose: vajra words resolved per key, every numeric channel smoothstep-blended, strings held. A
 * clip given as `{ once: true, keys }` is a ONE-SHOT (no loop back to its first key; sampled 0 … 1 inclusive by the
 * packer, as a function clip carrying `once` is): a fall that ends lying down. */
export function layeredClip(keyposes, R, { loop = true } = {}) {
  if (keyposes && !Array.isArray(keyposes) && typeof keyposes === 'object' && Array.isArray(keyposes.keys)) {
    if (keyposes.once !== true) throw new Error('station-loft-rig: a clip object is { once: true, keys }: a one-shot');
    const fn = layeredClip(keyposes.keys, R, { loop: false }); fn.once = true; return fn;
  }
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
function characterRigParts(mesh, skin, parts, { light, palette = null, normals = null, pieces = null, hairInk = false, glows = null }, dz, face = null, paint = null, corrAt = null) {
  const P0 = pieces || characterLitPieces(mesh, { light, palette, normals, dz, glows });
  const rowAt = faceRowOf(face), rows = rowAt || paint;
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
  const run = () => ({ pos: [], col: [], jnt: [], wgt: [], faces: 0, ...(rows ? { mph: [] } : {}), ...(paint ? { uv: [] } : {}), ...(corrAt ? { cph: [] } : {}) });
  if (rows) for (const P of parts) P.mph = [];
  if (corrAt) for (const P of parts) P.cph = [];
  if (paint) for (const P of parts) P.uv = [];
  // THE PAINTED FACE (face-paint-rig.js `pack`): a painted piece takes the texture (its corners' UVs on the atlas's face,
  // its colour the light alone); one over a region becomes that region's SHELLS — a copy per drawing, UVs in its tile:
  // the neutral copy in place among the plain faces (inked), each other collapsed to the hidden point among the marks,
  // its targets' weights on (face − hidden) its `deltas`. Unpainted corners sample the white tile.
  const T = paint ? paint.targets : 0, H = paint ? [paint.hidden[0], paint.hidden[1], paint.hidden[2] + dz] : null;
  const shells = (pc, bi, cs, R) => {
    R.states.forEach((st) => {
      const P = st.rest ? parts[bi] : marks[bi]; P.faces++;
      for (const [k, r] of pc.refs.entries()) {
        const [j, w] = skinAt(r), at = st.rest ? r.p : H, d = new Float64Array((1 + T) * 3), c = cs[k];
        P.pos.push(at[0], at[1], at[2]); P.col.push(c[0], c[1], c[2]); P.jnt.push(...j); P.wgt.push(...w); P.uv.push(...st.uv(paint.uvAt(r)));
        for (const [t, f] of st.deltas) for (let q = 0; q < 3; q++) d[3 + t * 3 + q] += f * (r.p[q] - H[q]);
        P.mph.push({ i: P.pos.length / 3 - 1, d });
      }
    });
  };
  const marks = parts.map(run), layered = parts.map(() => ({ hair: run(), veil: run(), through: run() }));
  for (const pc of P0) {
    const bi = vote(pc.fi); const layer = drawLayer(mesh, pc, { hairInk });
    const P = layer === 'through' ? layered[bi].through : pc.mark ? marks[bi] : layer ? layered[bi][layer] : parts[bi];
    // (a soft edge's band piece, the painterly look's, grades its corners as the static faces' cornerFills do)
    const painted = paint && paint.painted(pc.fi), lit = (h) => (painted ? paint.light(h) : h), colour = (h) => { let c = colOf.get(h); if (!c) colOf.set(h, c = faceColorLinear({ fill: h })); return c; };
    const c = colour(lit(pc.fill)), cs = pc.soft ? pc.soft.map((h) => colour(lit(h))) : null;
    // (the painted face's brow block over the fringe stays on the page; an export with the drawings moves the brow itself)
    if (paint?.targets && paint.skipParts?.test(pc.part)) continue;
    const ri = painted ? paint.regionOf.get(pc.fi) : undefined;
    if (ri !== undefined && !layer && !pc.mark) { shells(pc, bi, cs ?? pc.refs.map(() => c), paint.regions[ri]); continue; }
    P.faces++;
    for (const [k, r] of pc.refs.entries()) {
      const [j, w] = skinAt(r), ck = cs ? cs[k] : c; P.pos.push(r.p[0], r.p[1], r.p[2]); P.col.push(ck[0], ck[1], ck[2]); P.jnt.push(...j); P.wgt.push(...w);
      if (paint) P.uv.push(...(painted ? paint.baseUV(paint.uvAt(r)) : paint.white));
      if (rowAt) { const d = rowAt(r); if (d) P.mph.push({ i: P.pos.length / 3 - 1, d }); }
      if (corrAt) { const d = corrAt(r); if (d) P.cph.push({ i: P.pos.length / 3 - 1, d }); }
    }
  }
  const append = (P, M) => {
    const at = P.faces, base = P.pos.length / 3; P.faces += M.faces; for (const k of ['pos', 'col', 'jnt', 'wgt', ...(paint ? ['uv'] : [])]) for (const x of M[k]) P[k].push(x);
    if (M.mph) for (const e of M.mph) P.mph.push({ i: e.i + base, d: e.d });   // the run's rows at their shifted vertices
    if (M.cph) for (const e of M.cph) P.cph.push({ i: e.i + base, d: e.d });
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
  return face ? cornerRowOf(face.sub, face.rows, (1 + face.targets.length) * 3) : null;
}
/** a corner's row from per-vertex rows (`sub` the vertex's row index or −1, `rows` W floats each): faceRowOf's carry */
function cornerRowOf(sub, rows, W) {
  const cache = new Map();
  const vRow = (vi) => { const k = sub[vi]; return k < 0 ? null : rows.subarray(k * W, k * W + W); };
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

/** A CORRECTIVE's weight at posed nodes (a sliced recipe's, body-relational-correctives.js correctiveRest): the smoothstep
 * of its driver bone's raise (joint → to, its angle in degrees from the trunk's down, navel from neckHub) between `from`
 * and `full`; 0 when a node is missing. */
export function correctiveWeight(driver, nodes) {
  const a = nodes[driver.joint], b = nodes[driver.to]; if (!a || !b || !nodes.navel || !nodes.neckHub) return 0;
  const raise = (Math.acos(Math.max(-1, Math.min(1, bv.dot(bv.unit(bv.sub(b, a)), bv.unit(bv.sub(nodes.navel, nodes.neckHub)))))) * 180) / Math.PI;
  const y = Math.max(0, Math.min(1, (raise - driver.from) / (driver.full - driver.from))); return y * y * (3 - 2 * y);
}

/** the pack's CORRECTIVES (packLayeredRig `correctives`): the rows a corner carries (cornerRowOf over the mesh's vertices:
 * each corrective's rest offset at the vertex's point id, 3 × targets), and what an engine drives them by — each target's
 * id, driver and weight at rest, and each driver joint as the bone that carries it (its head, else its tail) with the
 * joint's rest offset from that bone's head, so the joint's posed point is the bone's transform of the offset. */
function correctivesOf(mesh, R, list) {
  const T = list.length, W = T * 3, at = new Map(), sub = new Int32Array(mesh.vertices.length).fill(-1);
  list.forEach((c, t) => { for (const [id, o] of Object.entries(c.d)) { let r = at.get(id); if (!r) at.set(id, r = new Float64Array(W)); r[t * 3] = o[0]; r[t * 3 + 1] = o[1]; r[t * 3 + 2] = o[2]; } });
  const rowsL = []; mesh.pointIds.forEach((id, vi) => { const r = at.get(id); if (r) { sub[vi] = rowsL.length; rowsL.push(r); } });
  const rows = new Float64Array(rowsL.length * W); rowsL.forEach((r, k) => rows.set(r, k * W));
  const joints = {};
  for (const c of list) for (const j of [c.driver.joint, c.driver.to, 'navel', 'neckHub']) {
    if (joints[j] || !R.joints[j]) continue;
    const b = R.bones.find((x) => x.head === j) || R.bones.find((x) => x.tail === j); if (!b) continue;
    joints[j] = { bone: b.id, at: sub3(R.joints[j], R.joints[b.head]).map(r4) };
  }
  return { rowAt: cornerRowOf(sub, rows, W), meta: { targets: list.map((c) => ({ id: c.id, driver: { joint: c.driver.joint, to: c.driver.to, from: c.driver.from, full: c.driver.full }, w: r4(correctiveWeight(c.driver, R.joints)) })), joints } };
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * Pack the packed rig figure: parts per DOMINANT bone with explicit per-vertex joints/weights, bones with rest
 * head/tail, clips as [q, head] per bone per key. `dz` seats the figure (the lowering's seat shift).
 * `normals` (per-face-corner shading normals on `mesh`, layeredShadingNormals: the studio-lit hero's smooth weld) shades
 * each corner from its own normal, so the clip preview blends as the static solid does; it wins over `hullShade`.
 * `hullShade: true | { quantum?, cell?, except? }` (default null → byte-identical output) bakes the COLOR
 * shade from `hullShadeNormals` per corner instead of the flat face normal; a null field entry keeps the
 * flat shade, so an excepted part or an unanswerable vertex shades exactly as today.
 * `palette` (the recipe's, group → hex; default null → byte-identical output) colours the plain path as the static faces
 * do (station-loft-faces.js layeredFaces): a face's group in the palette, else its part's tint, else neutral grey — so a
 * group coloured by the palette alone (a detailed head's cranium, horns, a pinned tile, an adornment) keeps its colour
 * in every clip frame instead of falling to grey.
 * `character` (default null → byte-identical output): the CHARACTER LIGHT's parts instead (characterRigParts
 * above — the palette, the step and the split; `light` and `hullShade` do not apply), each part carrying
 * `inkFaces`, and `ranges` where it holds faces with a draw layer.
 * `face` (default null → byte-identical output): the anime hero's face rows (anime-face-rig `heroFaceRig`), carried per
 * corner (faceRowOf); a part holding a corner that moves gets `morph: { i, d }` after its other keys — `i` the part's
 * vertex indices (u32), `d` each one's row as float32 ((1 + targets) × 3: the rebase, then every target) — which the
 * skinned GLB writer turns into morph targets.
 * `paint` (default null → byte-identical output; under the character light or the plain one): the painted face in motion (face-paint-rig.js
 * `pack`): every part carries `uv` (float32 [s, t] per vertex, t up, on the atlas), the pack its `paintTex` (the atlas:
 * { url, w, h }), and the face's shells their morph rows as `face`'s do.
 * `palette` (default null → byte-identical output; the plain path): each face's colour is its group's in it, as the
 * static faces' (layeredFaces), before the part's `tint` — a hero on the plain path, in the studio or a level's cast
 * light (its parts carry no tint: without it, the moving figure was the grey fallback all over).
 * `speeds` (default null → byte-identical output): a locomotion clip's GROUND SPEED (hero-motion.js, metres a second at its
 * seconds), carried as `v`: the speed the figure must move for a planted foot to stay put (an engine plays the clip at
 * planar speed ÷ v).
 * `seconds` (default null → byte-identical output): each clip's DESIGNED DURATION (hero-gesture `heroClipSeconds`, the
 * anime hero's), carried as `s` on its packed clip — the World page's clip preview and the GLB play the cycle over it
 * instead of their own three seconds and one; the clip keeps its `keys` samples (the door's rig gates pre-solve those
 * phases).
 * `correctives` (default null → byte-identical output): a sliced recipe's correctives (body-relational-correctives.js;
 * the mesh's `pointIds` address them), carried per corner as the face's rows are — a part holding a corner they move gets
 * `corrective: { i, d }` (`d` 3 × targets float32 per vertex: each corrective's rest offset at full weight), the pack
 * `correctives` (correctivesOf: the targets, their drivers and rest weights, the driver joints on their bones) and every
 * clip `cw`, each key's weights (targets per key, the weights its posed nodes drive), which the skinned GLB writer turns
 * into morph targets and a weights channel.
 * `engineLit` (default false → byte-identical output; the plain path with `normals`): the export's engine lights the
 * figure (the lit GLB), so each corner carries its shading normal (`nrm` on a part, float32 per vertex: the weld's, a
 * cell's blended from its face's corners, a held thing's its triangle's) and its colour no baked shade.
 * `relief` (default null → byte-identical output; with `engineLit` only): the figure's relief as a normal map
 * (epidermis/dermal-relief.js heroRelief): each corner carries its TANGENT (`tan` on a part, float32 [x, y, z, w] per
 * vertex: `relief.tangentAt(fi, k)`, a cell's blended from its face's corners, a held thing's laid on its triangle), the
 * pack the map (`normalTex`: { url, w, h }) on the paint's atlas UVs, and its ORM (`ormTex`: the cloth relief's occlusion,
 * roughness and metalness, epidermis/cloth-relief.js) when it carries one.
 */
export function packLayeredRig(mesh, skin, R, { clips = {}, keys = 12, dz = 0, light = [0.35, -0.55, 0.75], hullShade = null, normals = null, character = null, face = null, paint = null, seconds = null, speeds = null, gear = null, emissive = null, cast = null, tint = null, palette = null, fields = null, cellTint = null, surfaces = null, correctives = null, engineLit = false, relief = null } = {}) {
  // `surfaces` (recipe.surfaces: a hero wearing its cube's materials, the plain path): each part whose triangles include
  // a metal group's packs the metal channel's per-vertex data (`metal`, face-mesh.js), so the page's metal shades the
  // moving parts as it shades the static solid. No metal surface ⇒ nothing tracked, byte-identical
  const metalOf = new Map();
  if (surfaces && typeof surfaces === 'object' && !character) for (const [g, spec] of Object.entries(surfaces)) { const m = resolveMaterial(spec); if (m?.surface) metalOf.set(g, m.surface); }
  // `fields` (field-paint.js fieldPaintOf, on the rest mesh; the plain path): a face an entry touches is packed as its
  // cells, each corner's colour, joints and weights blended from the face's by its weights; with `cellTint(fi, group)`
  // (the bake's sampler) each cell's corners take its own group's finish. Absent ⇒ byte-identical.
  // `tint` (face-tint.js): per face, its corners' colour multipliers in sRGB, taken to linear here. Absent ⇒ byte-identical.
  const tk = (fi, k, c) => (tint?.[fi] ? tint[fi][k][c] ** 2.2 : 1);
  const rest = Object.fromEntries(Object.entries(R.joints).map(([k, v]) => [k, [v[0], v[1], v[2] + dz]]));
  const L = unit(light); const parts = R.bones.map(() => ({ pos: [], col: [], jnt: [], wgt: [], faces: 0, ...(metalOf.size ? { tg: [] } : {}) }));
  const vN = hullShade && !character ? hullShadeNormals(mesh, hullShade === true ? {} : hullShade) : null;
  const rowAt = !character ? faceRowOf(face) : null, pp = !character ? paint : null;
  if (rowAt || pp) for (const P of parts) P.mph = [];
  if (pp) for (const P of parts) P.uv = [];
  const corr = Array.isArray(correctives) && correctives.length ? correctivesOf(mesh, R, correctives) : null, corrAt = corr?.rowAt ?? null;
  if (corrAt) for (const P of parts) P.cph = [];
  const carryN = !!(engineLit && normals && !character);
  if (carryN) for (const P of parts) P.nrm = [];
  // (the relief's tangents ride beside the carried normals; a corner's blended ones laid back square to its normal)
  const carryT = !!(carryN && relief && typeof relief.tangentAt === 'function');
  if (carryT) for (const P of parts) P.tan = [];
  const tanOf = (fi, k) => relief.tangentAt(fi, k);
  const tanMix = (fi, w, n) => {
    const t = [0, 1, 2].map((q) => w[0] * tanOf(fi, 0)[q] + w[1] * tanOf(fi, 1)[q] + w[2] * tanOf(fi, 2)[q]), d = t[0] * n[0] + t[1] * n[1] + t[2] * n[2];
    const o = [t[0] - n[0] * d, t[1] - n[1] * d, t[2] - n[2] * d], l = len(o);
    return l > 1e-12 ? [o[0] / l, o[1] / l, o[2] / l, tanOf(fi, 0)[3]] : axisTangent(n);
  };
  // the recipe's emissive groups (a lens, a visor slit, a reactor) keep their full colour on the plain path, as the
  // static solid does (layeredFaces); under the character light they ride the pieces. Absent ⇒ byte-identical.
  const glow = new Set(Array.isArray(emissive) ? emissive : []);
  const pal = palette && typeof palette === 'object' ? palette : {}, colOf = new Map();
  if (character) characterRigParts(mesh, skin, parts, character, dz, face, paint, corrAt);
  else mesh.faces.forEach((tri, fi) => {
    const votes = {}; for (const vi of tri) votes[skin.dominant[vi]] = (votes[skin.dominant[vi]] || 0) + 1;
    const bi = Number(Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
    const part = mesh.parts[mesh.provenance[tri[0]].part]; const hex = faceHex(pal, mesh.groups[fi], part); let base = colOf.get(hex); if (!base) colOf.set(hex, base = faceColorLinear({ fill: hex }));
    const p = tri.map((vi) => { const v = mesh.vertices[vi]; return [v[0], v[1], v[2] + dz]; }); const nrm = cross(sub(p[1], p[0]), sub(p[2], p[0])); const nl = len(nrm); const lit = glow.has(mesh.groups[fi]); const shade = lit ? 1 : 0.55 + 0.45 * Math.max(0, nl > 1e-12 ? dot(mul(nrm, 1 / nl), L) : 0);
    // THE PAINTED FACE on the plain path (a hero under a level's cast light): a painted face's corners carry the texture
    // and the light alone (white under it), and one over a region its shells, as characterRigParts does. Absent ⇒ as before.
    if (pp && pp.targets && pp.skipParts?.test(mesh.provenance[tri[0]].part)) return;
    const painted = pp && pp.painted(fi), b = painted ? [1, 1, 1] : base, ri = painted ? pp.regionOf.get(fi) : undefined;
    // a CAST light (era/cast-light.js: the level's key, tinted ambient and bounce, per channel) in place of the studio
    // key's grey Lambert; the same normals choose the corner's shade
    // `own` (a cell's tint under its own group's finish, sRGB per corner; null for none) in place of the face's
    const colourAt = (vi, k, b0 = b, own) => {
      const t = own === undefined ? (c) => tk(fi, k, c) : (c) => (own ? own[k][c] ** 2.2 : 1);
      if (cast && !lit) { const n = normals ? normals[fi][k] : vN && vN[vi] ? vN[vi] : nl > 1e-12 ? mul(nrm, 1 / nl) : [0, 0, 1]; const f = castLightFactor(n, cast); return [b0[0] * f[0] * t(0), b0[1] * f[1] * t(1), b0[2] * f[2] * t(2)]; }
      if (carryN) return [b0[0] * t(0), b0[1] * t(1), b0[2] * t(2)];
      const s = lit ? shade : normals ? 0.55 + 0.45 * Math.max(0, dot(normals[fi][k], L)) : vN && vN[vi] ? 0.55 + 0.45 * Math.max(0, dot(vN[vi], L)) : shade; return [b0[0] * s * t(0), b0[1] * s * t(1), b0[2] * s * t(2)];
    };
    const P = parts[bi];
    // THE FIELD PAINT's cells (not on a painted face, nor one carrying the face's rows): each corner blended from the
    // face's three by its weights, its colour from the cell's group
    const fc = fields && !painted && ri === undefined && !(rowAt && tri.some((vi) => rowAt({ vi }))) && !(corrAt && tri.some((vi) => corrAt({ vi }))) ? fields.cut(fi) : null;
    if (fc) {
      for (const cell of fc) {
        const hx = faceHex(pal, cell.group, part); let cb = colOf.get(hx); if (!cb) colOf.set(hx, cb = faceColorLinear({ fill: hx }));
        const own = cellTint ? cellTint(fi, cell.group) : undefined, corner = tri.map((vi, k) => colourAt(vi, k, cb, own)), glowing = glow.has(cell.group);
        for (const T of cellTriangles(cell.ring)) {
          P.faces++; if (P.tg) P.tg.push(cell.group);
          for (const { w } of T) {
            P.pos.push(...[0, 1, 2].map((q) => w[0] * p[0][q] + w[1] * p[1][q] + w[2] * p[2][q]));
            P.col.push(...(glowing ? cb : [0, 1, 2].map((q) => w[0] * corner[0][q] + w[1] * corner[1][q] + w[2] * corner[2][q])));
            if (P.nrm) { const n = [0, 1, 2].map((q) => w[0] * normals[fi][0][q] + w[1] * normals[fi][1][q] + w[2] * normals[fi][2][q]), l = len(n) || 1; P.nrm.push(n[0] / l, n[1] / l, n[2] / l); if (P.tan) P.tan.push(...tanMix(fi, w, [n[0] / l, n[1] / l, n[2] / l])); }
            const { jnt, wgt } = blendSkin(skin, tri, w); P.jnt.push(...jnt); P.wgt.push(...wgt);
            if (P.uv) P.uv.push(...pp.white);
          }
        }
      }
      return;
    }
    if (ri !== undefined) {
      const H = [pp.hidden[0], pp.hidden[1], pp.hidden[2] + dz];
      for (const st of pp.regions[ri].states) {
        P.faces++; if (P.tg) P.tg.push(mesh.groups[fi]);
        tri.forEach((vi, k) => {
          const at = st.rest ? p[k] : H, d = new Float64Array((1 + pp.targets) * 3);
          for (const [t, f] of st.deltas) for (let q = 0; q < 3; q++) d[3 + t * 3 + q] += f * (p[k][q] - H[q]);
          P.pos.push(...at); P.col.push(...colourAt(vi, k)); P.jnt.push(...skin.joints[vi]); P.wgt.push(...skin.weights[vi]); P.uv.push(...st.uv(pp.uvAt({ vi }))); P.mph.push({ i: P.pos.length / 3 - 1, d }); if (P.nrm) P.nrm.push(...normals[fi][k]); if (P.tan) P.tan.push(...tanOf(fi, k));
        });
      }
      return;
    }
    P.faces++; if (P.tg) P.tg.push(mesh.groups[fi]);
    // (a hair card's corners on the paint's strand strip, dermal-hero.js heroSkinPaint `cardUV`; its colour the band's)
    const card = !painted && pp?.cardUV ? pp.cardUV(fi) : null;
    // (a cloth face's corners on the paint's cloth page, realistic laws 12: dermal-hero.js heroSkinPaint `clothUV`; its colour
    // the palette's, the page white under it)
    const cloth = !painted && !card && pp?.clothUV ? pp.clothUV(fi) : null;
    tri.forEach((vi, k) => { P.pos.push(...p[k]); P.col.push(...colourAt(vi, k)); P.jnt.push(...skin.joints[vi]); P.wgt.push(...skin.weights[vi]); if (P.uv) P.uv.push(...(painted ? pp.baseUV(pp.uvAt({ vi })) : card ? card[k] : cloth ? cloth[k] : pp.white)); if (rowAt) { const d = rowAt({ vi }); if (d) P.mph.push({ i: P.pos.length / 3 - 1, d }); } if (corrAt) { const d = corrAt({ vi }); if (d) P.cph.push({ i: P.pos.length / 3 - 1, d }); } if (P.nrm) P.nrm.push(...normals[fi][k]); if (P.tan) P.tan.push(...tanOf(fi, k)); });
  });
  // held gear (hero-gear.js gearPackParts): rest triangles already seated, appended to their bone's part with weight 1
  // on that bone, after its own faces (outside its ink and draw-layer spans). Absent ⇒ the pack is byte-identical.
  if (Array.isArray(gear)) for (const g of gear) { const P = parts[g.bone]; if (!P) continue; for (const t of g.tris) { P.faces++; if (P.tg) P.tg.push(null); const gn = P.nrm ? cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])) : null, gl = gn ? len(gn) || 1 : 1; for (const p of t.p) { if (gn) P.nrm.push(gn[0] / gl, gn[1] / gl, gn[2] / gl); if (P.tan) P.tan.push(...axisTangent([gn[0] / gl, gn[1] / gl, gn[2] / gl])); P.pos.push(p[0], p[1], p[2]); P.col.push(t.col[0], t.col[1], t.col[2]); P.jnt.push(g.bone, 0, 0, 0); P.wgt.push(1, 0, 0, 0); if (P.uv) P.uv.push(...paint.white); } } }
  const packedClips = {}, props = [];
  for (const [name, clip] of Object.entries(clips)) {
    // a function clip may carry its own key count (a gait's: hero-motion.js locomotionClips, dense so the stance holds)
    // a function clip may also be ONE-SHOT (`once`: a jump's, sampled 0 … 1 inclusive) and carry its `air` (hero-jump.js)
    // (the posed nodes, raised by dz, keep every turn rigNodesAt records — the body's, a stance's facing, the legs' splay —
    // so each bone's frame here is the one the skin is posed with: dropping the facing left a turned stance's head and
    // jaw on different spins, the seam under the chin open in the export)
    const fn = typeof clip === 'function' ? clip : layeredClip(clip, R); const K = typeof clip === 'function' && clip.keys > 0 ? clip.keys : keys; const once = fn.once === true; const flat = [], cw = corr ? [] : null;
    for (let k = 0; k < K; k++) { const { nodes } = rigNodesAt(R, fn(once ? k / (K - 1) : k / K)); if (cw) for (const c of correctives) cw.push(r4(correctiveWeight(c.driver, nodes))); const shifted = Object.fromEntries(Object.entries(nodes).map(([n, v]) => [n, [v[0], v[1], v[2] + dz]])); for (const m of ['$body', '$facing', '$legYaw']) if (nodes[m]) Object.defineProperty(shifted, m, { value: nodes[m], enumerable: false }); for (const f of boneFrames(R, rest, shifted)) flat.push(...f.q.map(r4), ...f.head.map(r4)); }
    packedClips[name] = { k: K, b: flat, ...(cw ? { cw } : {}), ...(seconds?.[name] > 0 ? { s: seconds[name] } : {}), ...(speeds?.[name] > 0 ? { v: speeds[name] } : {}), ...(once ? { once: true } : {}), ...(typeof clip === 'function' && clip.air ? { air: clip.air } : {}), ...(typeof clip === 'function' && clip.roll ? { roll: clip.roll } : {}), ...(typeof clip === 'function' && clip.stop ? { stop: clip.stop } : {}), ...(typeof clip === 'function' && clip.move ? { move: clip.move } : {}), ...(typeof clip === 'function' && clip.rest ? { rest: clip.rest } : {}), ...(typeof clip === 'function' && clip.vault ? { vault: clip.vault } : {}), ...(typeof clip === 'function' && clip.held ? { held: clip.held } : {}) };
    // a held thing's PROPS (hero-motion.js: a hold's or a guard's things at rest on their hand's bone, raised by dz): each its
    // own record, the clip's, so the export draws it as a mesh of its own on the figure's skin
    if (typeof clip === 'function' && typeof clip.props === 'function') for (const pr of clip.props(dz, cast ?? character?.light ?? undefined)) if (pr.tris?.length) {
      const pos = [], col = [], faces = pr.tris.length; for (const t of pr.tris) for (const q of t.p) { pos.push(q[0], q[1], q[2]); col.push(t.col[0], t.col[1], t.col[2]); }
      props.push({ clip: name, item: pr.item, bone: pr.bone, pos: b64f32(pos), col: b64u8(col), faces });
    }
  }
  // the metal channel per part: its triangles, as faces tagged by their group's metal, through the static solid's packer
  if (metalOf.size) for (const P of parts) {
    if (!P.tg || !P.tg.some((g) => metalOf.has(g))) continue;
    const fs = P.tg.map((g, t) => { const o = 9 * t, f = { corners: [[P.pos[o], P.pos[o + 1], P.pos[o + 2]], [P.pos[o + 3], P.pos[o + 4], P.pos[o + 5]], [P.pos[o + 6], P.pos[o + 7], P.pos[o + 8]]] }; if (metalOf.has(g)) tagFacesWithMetal([f], metalOf.get(g)); return f; });
    const gm = faceListToMesh(fs, { decollide: false });
    // (a triangle the packer drops would shift every vertex after it: such a part keeps its paint)
    if (gm.mets && gm.vertexCount === P.pos.length / 3) P.metal = { surfaces: gm.metSurfaces, a: b64f32(gm.mets) };
  }
  let mnz = Infinity, mxz = -Infinity; for (const v of mesh.vertices) { if (v[2] + dz < mnz) mnz = v[2] + dz; if (v[2] + dz > mxz) mxz = v[2] + dz; }
  return {
    rig: true, layered: true,
    bones: R.bones.map((b) => ({ id: b.id, head: rest[b.head].map(r4), tail: rest[b.tail].map(r4) })),
    parts: parts.map((P) => (P.faces ? { pos: b64f32(P.pos), col: b64u8(P.col), faces: P.faces, jnt: Buffer.from(Uint8Array.from(P.jnt).buffer).toString('base64'), wgt: b64f32(P.wgt), ...(P.inkFaces !== undefined ? { inkFaces: P.inkFaces } : {}), ...(P.ranges ? { ranges: P.ranges } : {}), ...(P.mph?.length ? { morph: packMorph(P.mph) } : {}), ...(P.uv ? { uv: b64f32(P.uv) } : {}), ...(P.metal ? { metal: P.metal } : {}), ...(P.cph?.length ? { corrective: packMorph(P.cph) } : {}), ...(P.nrm ? { nrm: b64f32(P.nrm) } : {}), ...(P.tan ? { tan: b64f32(P.tan) } : {}) } : null)),
    clips: packedClips, figH: r4(mxz - mnz), ...(props.length ? { props } : {}),
    ...(paint ? { paintTex: { ...paint.atlas, white: paint.white, ...(paint.alphaMask ? { alphaMask: true } : {}) } } : {}),
    ...(corr ? { correctives: corr.meta } : {}),
    ...(carryT && relief.atlas ? { normalTex: relief.atlas } : {}),
    ...(carryT && relief.orm ? { ormTex: relief.orm } : {}),
  };
}

/** the skin at a point of face `tri` by its weights `w` over the face's corners: every corner's joints weighted, the four
 * heaviest kept (ties to the lower joint) and renormalised */
function blendSkin(skin, tri, w) {
  const acc = new Map();
  tri.forEach((vi, k) => { if (!(w[k] > 0)) return; skin.joints[vi].forEach((j, q) => { const x = skin.weights[vi][q] * w[k]; if (x > 0) acc.set(j, (acc.get(j) || 0) + x); }); });
  const top = [...acc].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4), sum = top.reduce((t, e) => t + e[1], 0) || 1;
  while (top.length < 4) top.push([0, 0]);
  return { jnt: top.map((e) => e[0]), wgt: top.map((e) => e[1] / sum) };
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
    // a planted toe stays where the pose plants it (plantedFoot: at rest, or where the stance and stagger put it); a leg
    // given a `feet` target (a gait's footfall, a swing foot on its arc) stands at that target, its toe tip turned with it
    // (a STANCE stands the toes on the shoe's forepart sole, `toe` metres up, wherever the pose plants them)
    const up = (p) => (R.stance ? add(p, [0, 0, R.stance.toe]) : p);
    for (const [S, l] of Object.entries(R.legs)) if (report.legs[S]?.planted) {
      const target = Array.isArray(pose.feet?.[S]) ? pose.feet[S] : null;
      out.maxPlantedDrift = Math.max(out.maxPlantedDrift, ...(target ? [len(sub(nodes[l.toeBase], up(target)))] : ((at) => [len(sub(nodes[l.toeBase], up(at.toeBase))), len(sub(nodes[l.toeTip], up(at.toeTip)))])(plantedFoot(R, l, pose))));
    }
    out.poses.push({ pose, legs: report.legs });
  }
  return out;
}

export { matToQuat };
