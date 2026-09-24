/** seed-recipe.mjs — authors recipe.json ONCE, in the core `layered` grammar
 * (control/lib/graph/polygonizer/station-loft.js): a hulking humanoid with digitigrade lizard legs, wearing
 * the dragon head from ../dragon-layered/recipe.json (merged, translated to the neck). Everything
 * body-specific lives HERE: the joint table, the ring rules (superellipse rings perpendicular to each
 * segment's axis), the claw geometry, the dial semantics. The emitted recipe is declarative; re-running
 * reproduces recipe.json byte for byte. It is the authoring record, not the render path. */
import { writeFileSync, readFileSync } from 'node:fs';
import { compileLayered, pinFrame, surfaceLocalOffset, mirrorPid, mirrorFaceId } from '../../../control/lib/graph/polygonizer/station-loft.js';
export const recipePath = new URL('./recipe.json', import.meta.url);
export const headPath = new URL('../dragon-layered/recipe.json', import.meta.url);
const sub = (a, b) => a.map((x, i) => x - b[i]); const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len = (v) => Math.hypot(...v); const unit = (v) => mul(v, 1 / len(v)); const mean = (ps) => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;   // + 0 folds -0
const mirrorX = (p) => [-p[0] + 0, p[1], p[2]];

// ── L0: the frame. Metres, +z up, +y front, x = 0 the mirror plane, soles on z = 0 ──
const frame = { up: '+z', front: '+y', note: '1 unit = 1 m; a hulking humanoid, soles on z = 0, the dragon head merged at HEAD_SHIFT above the neck' };
export const HEAD_SHIFT = [0, 0.10, 0.20];   // the head recipe is authored centred at z = 2.05; here it rides 0.2 m higher and 0.1 m forward
export const TORSO_SLOTS = ['front', 'frontR', 'sideR', 'backR', 'back', 'backL', 'sideL', 'frontL'];
export const LIMB_SLOTS = ['front', 'frontR', 'backR', 'back', 'backL', 'frontL'];

/** A superellipse ring perpendicular to axis `d` at centre `c`: `front` toward +y (or +z when d ∥ y), R toward +x.
 * r = [along R, along front]; e = 2 is an ellipse, more is boxier. The right half is generated and the
 * left half is its exact mirror in the ring's own front plane, so mirror-by-name holds inside the part. */
function ring(c, d, r, slots, e = 2) {
  d = unit(d); let f = sub([0, 1, 0], mul(d, dot([0, 1, 0], d))); if (len(f) < 1e-6) f = sub([0, 0, 1], mul(d, dot([0, 0, 1], d))); f = unit(f);
  let s = cross(f, d); if (Math.abs(s[0]) < 1e-9) throw new Error('ring: axis along x has no R side'); if (s[0] < 0) s = mul(s, -1);
  const [rs, rf] = R(r); const n = slots.length; const pts = {};
  const sg = (x) => (x < 0 ? -1 : 1); const pw = (x) => sg(x) * Math.abs(x) ** (2 / e);
  for (let k = 0; k <= n / 2; k++) { const t = 2 * Math.PI * k / n; const F = mul(f, rf * pw(Math.cos(t))), S = mul(s, rs * pw(Math.sin(t))); pts[slots[k]] = add(c, add(F, S)); if (k && k < n / 2) pts[slots[n - k]] = add(c, sub(F, S)); }
  return pts;
}
const R = (r) => (Array.isArray(r) ? r : [r, r]);
/** A straight segment from joint A to joint B: three rings ⟂ (B − A) at A, mid and B, the ends overshooting the
 * joints by `over` × radius so neighbours fuse across the bend; caps pinched on the axis beyond the end rings. */
function segment(A, B, rA, rB, { slots = LIMB_SLOTS, e = 2, over = [0.6, 0.6], mid = 0.5, rMid } = {}) {
  const d = unit(sub(B, A)); const L = len(sub(B, A)); const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
  const at = (t) => add(A, mul(d, t));
  const st = [[-over[0] * rad(rA), rA], [mid * L, rMid ?? R(rA).map((x, i) => (x + R(rB)[i]) / 2)], [L + over[1] * rad(rB), rB]];
  return { slots, stations: st.map(([t, r], i) => ({ id: `st${i}`, points: ring(at(t), d, r, slots, e) })), caps: { back: at(st[0][0] - 0.45 * rad(rA)), tip: at(st[2][0] + 0.45 * rad(rB)) } };
}
/** Explicit stations for a midline trunk: [{ z, r: [rx, ry], yc, e }] along +z. */
function trunk(stations, caps, slots = TORSO_SLOTS) {
  return { slots, stations: stations.map((s, i) => ({ id: `st${i}`, points: ring([0, s.yc ?? 0, s.z], [0, 0, 1], s.r, slots, s.e ?? 2) })), caps };
}
/** Finish an L1 part: round every coordinate; a midline part (`mirrorPlane: 'x'`) takes its left half from the
 * rounded right half by name, so the figure's mirror symmetry is exact after rounding. */
function finish(part, { group, tint, mirrorPlane }) {
  const n = part.slots.length; const stations = part.stations.map((s) => { const pts = {};
    for (let k = 0; k < n; k++) pts[part.slots[k]] = s.points[part.slots[k]].map(r6);
    if (mirrorPlane === 'x') for (let k = n / 2 + 1; k < n; k++) pts[part.slots[k]] = mirrorX(pts[part.slots[n - k]]);
    return { id: s.id, points: pts }; });
  return { layer: 1, closure: 'closed', slots: part.slots, stations, caps: { back: part.caps.back.map(r6), tip: part.caps.tip.map(r6) }, group, tint };
}
/** The left limb: every point mirrored in x, every slot renamed R ↔ L (so `thighL/st0.frontL` is the mirror of `thighR/st0.frontR`). */
function mirrorPart(p) { return { ...p, stations: p.stations.map((s) => ({ id: s.id, points: Object.fromEntries(Object.entries(s.points).map(([k, v]) => [mirrorPid(k), mirrorX(v)])) })), caps: { back: mirrorX(p.caps.back), tip: mirrorX(p.caps.tip) } }; }
export const mirrorPartName = (n) => n.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
export const mirrorId = (id) => { const [part, rest] = id.split('/'); return `${mirrorPartName(part)}/${mirrorPid(rest)}`; };
export const mirrorFace = (id) => { const [part, rest] = id.split('/'); const n = part.match(/^(pelvis|torso|neck|cranium)$/) ? 8 : part === 'jaw' ? 6 : LIMB_SLOTS.length; return mirrorFaceId(`${mirrorPartName(part)}/${rest}`, n); };

// ── the joint table (right side, metres) ──
const J = {
  hip: [0.26, 0.00, 1.00], knee: [0.30, 0.20, 0.58], hock: [0.31, -0.12, 0.30], toeBase: [0.32, 0.14, 0.07], toeTip: [0.32, 0.46, 0.035],
  shoulder: [0.50, 0.00, 1.76], elbow: [0.70, -0.02, 1.26], wrist: [0.66, 0.20, 0.80], knuckles: [0.65, 0.33, 0.67],
  neckBase: [0, 0.00, 1.85], neckTop: [0, -0.12, 2.20],
  tail: [[0, -0.20, 1.02], [0, -0.55, 0.86], [0, -0.90, 0.66], [0, -1.22, 0.52], [0, -1.52, 0.46], [0, -1.80, 0.50]],   // base → tip, a curve of straight segments
};
const TAIL_R = [0.17, 0.13, 0.10, 0.07, 0.045, 0.02];
const FINGER = { spread: 0.075, prox: 0.11, dist: 0.09, proxDir: [0, 0.7, -0.6], distDir: [0, 0.55, -0.8], clawDir: [0, 0.4, -0.9] };
const fingerJoints = (i) => { const k = add(J.knuckles, [(i - 1) * FINGER.spread, 0, 0]); const m = add(k, mul(unit(FINGER.proxDir), FINGER.prox)); return { k, m, e: add(m, mul(unit(FINGER.distDir), FINGER.dist)) }; };
const BODY = '#66755a', LIMB = '#5a6a4f', EXTREMITY = '#55634b', CLAW = '#efe9d8';
const parts = {};
parts.pelvis = finish(trunk([{ z: 0.86, r: [0.30, 0.22] }, { z: 1.00, r: [0.36, 0.25] }, { z: 1.14, r: [0.38, 0.27], yc: 0.01 }], { back: [0, 0, 0.78], tip: [0, 0, 1.26] }), { group: 'Pelvis', tint: BODY, mirrorPlane: 'x' });
parts.torso = finish(trunk([
  { z: 1.00, r: [0.36, 0.26], yc: 0.02 }, { z: 1.32, r: [0.38, 0.30], yc: 0.04, e: 2.3 }, { z: 1.55, r: [0.50, 0.34], yc: 0.03, e: 2.6 },
  { z: 1.78, r: [0.58, 0.32], e: 2.8 }, { z: 1.92, r: [0.40, 0.24], yc: -0.02 },
], { back: [0, 0.02, 0.92], tip: [0, -0.02, 2.00] }), { group: 'Torso', tint: BODY, mirrorPlane: 'x' });
parts.neck = finish(segment(J.neckBase, J.neckTop, [0.18, 0.16], [0.11, 0.10], { slots: TORSO_SLOTS, over: [0.3, 0.4] }), { group: 'Neck', tint: BODY, mirrorPlane: 'x' });
const limbs = {
  thighR: [segment(J.hip, J.knee, [0.19, 0.21], [0.13, 0.14], { e: 2.2, over: [0.5, 0.6] }), 'Legs', LIMB],
  shinR: [segment(J.knee, J.hock, 0.13, 0.085, { over: [0.6, 0.6] }), 'Legs', LIMB],
  metaR: [segment(J.hock, J.toeBase, 0.085, [0.11, 0.07], { over: [0.6, 0.4] }), 'Legs', LIMB],
  toesR: [segment(J.toeBase, J.toeTip, [0.12, 0.06], [0.10, 0.03], { over: [0.3, 0.3] }), 'Feet', EXTREMITY],
  upperArmR: [segment(J.shoulder, J.elbow, 0.16, 0.12, { over: [0.6, 0.6] }), 'Arms', LIMB],
  foreArmR: [segment(J.elbow, J.wrist, 0.12, 0.085, { over: [0.6, 0.6] }), 'Arms', LIMB],
  handR: [segment(J.wrist, J.knuckles, [0.09, 0.08], [0.13, 0.045], { over: [0.4, 0.3] }), 'Hands', EXTREMITY],
};
for (const [i, X] of ['A', 'B', 'C'].entries()) { const { k, m, e } = fingerJoints(i);
  limbs[`finger${X}1R`] = [segment(k, m, 0.032, 0.028, { over: [0.5, 0.5] }), 'Hands', EXTREMITY];
  limbs[`finger${X}2R`] = [segment(m, e, 0.028, 0.022, { over: [0.5, 0.5] }), 'Hands', EXTREMITY]; }
for (let i = 0; i + 1 < J.tail.length; i++) parts[`tail${i}`] = finish(segment(J.tail[i], J.tail[i + 1], TAIL_R[i], TAIL_R[i + 1], { over: [i === 0 ? 0.4 : 0.6, i === 4 ? 0.3 : 0.6] }), { group: 'Tail', tint: LIMB, mirrorPlane: 'x' });
for (const [name, [seg, group, tint]] of Object.entries(limbs)) { const right = finish(seg, { group, tint }); parts[name] = right; parts[mirrorPartName(name)] = mirrorPart(right); }

// ── the head: the dragon recipe, L1 points translated by HEAD_SHIFT (L2 offsets are local and ride along) ──
const head = JSON.parse(readFileSync(headPath, 'utf8'));
const shift = (p) => add(p, HEAD_SHIFT).map(r6);
for (const [name, part] of Object.entries(head.parts)) {
  if (name in parts) throw new Error(`head part ${name} collides with a body part`);
  parts[name] = part.layer === 1 ? { ...part, stations: part.stations.map((s) => ({ id: s.id, points: Object.fromEntries(Object.entries(s.points).map(([k, v]) => [k, shift(v)])) })), caps: { back: shift(part.caps.back), tip: shift(part.caps.tip) } } : part;
}
const headDials = Object.fromEntries(Object.entries(head.dials).map(([k, d]) => [k, d.op === 'scale' && Number.isFinite(d.pivot) ? { ...d, pivot: r6(d.pivot + HEAD_SHIFT[['x', 'y', 'z'].indexOf(d.axis)]) } : d]));
const legParts = ['thighR', 'thighL', 'shinR', 'shinL', 'metaR', 'metaL', 'toesR', 'toesL']; const fingerParts = ['A', 'B', 'C'].flatMap((X) => ['R', 'L'].flatMap((S) => [`finger${X}1${S}`, `finger${X}2${S}`]));
const armParts = ['upperArmR', 'upperArmL', 'foreArmR', 'foreArmL', 'handR', 'handL', ...fingerParts];
const tailParts = [0, 1, 2, 3, 4].map((i) => `tail${i}`);
const all = (w) => ({ st0: w, st1: w, st2: w, back: w, tip: w });

const recipe = {
  schema: 'layered-v1', frame,
  symmetry: { plane: 'x=0', policy: 'midline parts: right half authored, left half mirrored by name; limbs: right limb authored, left limb mirrored in x with R ↔ L renamed on the part and the slot; midline details use symmetric pins' },
  dials: {
    bulk:       { min: 0.85, max: 1.3, rest: 1, doc: 'x scale of the torso and arms about the mirror plane (broader chest, the arms ride outward with it)', op: 'scale', axis: 'x', pivot: 0, parts: ['torso', ...armParts], blend: { ...all(1), st3: 1, st4: 1 } },
    gut:        { min: 0, max: 0.15, rest: 0, doc: 'metres the belly front slots move forward at the waist', op: 'offset', axis: 'y', slots: ['front', 'frontR', 'frontL'], parts: ['torso', 'pelvis'], blend: { st0: 0.6, st1: 1, st2: 0.5 } },
    stance:     { min: 0.8, max: 1.35, rest: 1, doc: 'x scale of the legs about the mirror plane (wider stance, thicker legs)', op: 'scale', axis: 'x', pivot: 0, parts: legParts, blend: all(1) },
    clawLength: { min: 0.5, max: 1.8, rest: 1, doc: 'stretch of every claw along its own axis', op: 'stretch', parts: [] },
    ...headDials,
    // dials apply in recipe order: every scale and offset first, the rigid hinges last, so a leaned head is never sheared by a later axis scale
    lean:       { min: -10, max: 25, rest: 0, doc: 'degrees the torso, arms, neck and head hinge forward about the pelvis tip; the legs stay planted', op: 'hinge', parts: ['torso', 'neck', 'cranium', 'jaw', ...armParts], pivot: 'pelvis/tip', axis: 'x', sign: -1 },
    tailCurl:   { min: -20, max: 20, rest: 0, doc: 'degrees per tail joint about x, propagated from the base (+ lifts the tip)', op: 'chain', axis: 'x', sign: -1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}/back`, parts: tailParts.slice(k) })) },
    tailSway:   { min: -15, max: 15, rest: 0, doc: 'degrees per tail joint about z, propagated from the base (+ swings the tip to the right)', op: 'chain', axis: 'z', sign: 1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}/back`, parts: tailParts.slice(k) })) },
    grip:       { min: 0, max: 45, rest: 0, doc: 'degrees per finger joint, both hands, curling toward the palm', op: 'chain', axis: 'x', sign: -1, links: ['R', 'L'].flatMap((S) => ['A', 'B', 'C'].flatMap((X) => [{ pivot: `finger${X}1${S}/back`, parts: [`finger${X}1${S}`, `finger${X}2${S}`] }, { pivot: `finger${X}2${S}/back`, parts: [`finger${X}2${S}`] }])) },
  },
  parts,
  creases: { ...head.creases },
};
const base = compileLayered({ ...recipe, dials: Object.fromEntries(Object.entries(recipe.dials).filter(([k]) => !(k in headDials))) }, {}, { details: false, creases: false });   // body L1 at rest, for the claw pin frames

/** author a right-side detail in world space; store offsets in its pin frame; mirror to the left limb */
function detail(name, { layer, closure, pin, group, tint, points, faces, stretch, loft, rootOf }, mirror) {
  const f = pinFrame(base.parts[pin.parent], pin);
  const offsets = Object.fromEntries(Object.entries(points).map(([id, p]) => [id, surfaceLocalOffset(f, p).map(r6)]));
  if (rootOf) offsets.root = mean(rootOf.map((k) => offsets[k]));   // the loft axis starts at the exact mean of the (rounded) base ring, so its station sits at t = 0
  const fs = Object.fromEntries(faces.map((t, i) => [`f${String(i).padStart(2, '0')}`, t])); const groups = Object.fromEntries(Object.keys(fs).map((k) => [k, group]));
  const st = stretch && { dial: stretch.dial, origin: offsets[stretch.origin], axis: unit(sub(offsets[stretch.tip], offsets[stretch.origin])).map(r6) };
  const common = { layer, closure, offsets, groups, tint, ...(st ? { stretch: st } : {}), ...(loft ? { loft } : {}) };
  recipe.parts[name] = { ...common, pin, faces: fs };
  if (mirror) recipe.parts[mirror] = { ...common, pin: { parent: mirrorPartName(pin.parent), face: mirrorFace(pin.face), weights: [...pin.weights].reverse(), tangentEdge: pin.tangentEdge.map(mirrorId), handedness: -1 }, faces: Object.fromEntries(Object.entries(fs).map(([k, t]) => [k, [...t].reverse()])) };
}
const outward = (pts, tris, centre) => tris.map((t) => { const p = t.map((k) => pts[k]); const n = cross(sub(p[1], p[0]), sub(p[2], p[0])); return dot(n, sub(mean(p), centre)) < 0 ? [t[0], t[2], t[1]] : t; });
const ringAround = (c, r, axis, n) => { const a = unit(axis); let u = cross(a, [0, 0, 1]); if (len(u) < 1e-6) u = cross(a, [0, 1, 0]); u = unit(u); const v = cross(a, u); return Array.from({ length: n }, (_, i) => { const t = 2 * Math.PI * i / n; return add(c, mul(add(mul(u, Math.cos(t)), mul(v, Math.sin(t))), r)); }); };
/** a claw: a three-sided spike from base point B along dir, pinned to a face of its extremity */
const claw = (name, B, dir, length, radius, pin, mirror) => { const pts = {}; ringAround(B, radius, dir, 3).forEach((p, i) => pts[`b${i}`] = p); pts.apex = add(B, mul(unit(dir), length)); pts.root = mean([pts.b0, pts.b1, pts.b2]);
  const tris = outward(pts, [['b0', 'b1', 'b2'], ['b0', 'b1', 'apex'], ['b1', 'b2', 'apex'], ['b2', 'b0', 'apex']], mean([pts.root, pts.apex]));
  detail(name, { layer: 2, closure: 'closed', group: 'Claws', tint: CLAW, points: pts, faces: tris, stretch: { dial: 'clawLength', origin: 'root', tip: 'apex' }, loft: { rings: [['b0', 'b1', 'b2']], from: 'root', to: 'apex', axis: 'ring-normal', pinch: { tip: 'apex' } }, pin, rootOf: ['b0', 'b1', 'b2'] }, mirror);
  recipe.dials.clawLength.parts.push(name, mirror); };
const W = 1 / 3, THIRDS = [W, W, W];
// foot claws: three at the toe tip, on the top band of the last toe station (medial k5.a, middle k0.b, lateral k0.a)
const footDir = [0, 0.9, -0.25]; const FT = J.toeTip;
claw('clawF0R', [FT[0] - 0.075, FT[1] - 0.02, 0.03], footDir, 0.10, 0.02, { parent: 'toesR', face: 'toesR/st1-st2.k5.a', weights: THIRDS, tangentEdge: ['toesR/st1.frontL', 'toesR/st2.frontL'], handedness: 1 }, 'clawF0L');
claw('clawF1R', [FT[0], FT[1] - 0.02, 0.03], footDir, 0.11, 0.022, { parent: 'toesR', face: 'toesR/st1-st2.k0.b', weights: THIRDS, tangentEdge: ['toesR/st1.front', 'toesR/st2.front'], handedness: 1 }, 'clawF1L');
claw('clawF2R', [FT[0] + 0.075, FT[1] - 0.02, 0.03], footDir, 0.10, 0.02, { parent: 'toesR', face: 'toesR/st1-st2.k0.a', weights: THIRDS, tangentEdge: ['toesR/st1.frontR', 'toesR/st2.frontR'], handedness: 1 }, 'clawF2L');
// hand claws: one on each distal finger tip, pointing forward-down
for (const [i, X] of ['A', 'B', 'C'].entries()) { const { e } = fingerJoints(i); const B = add(e, mul(unit(FINGER.distDir), 0.01)); const parent = `finger${X}2R`;
  claw(`clawH${i}R`, B, FINGER.clawDir, 0.07, 0.015, { parent, face: `${parent}/st1-st2.k0.b`, weights: THIRDS, tangentEdge: [`${parent}/st1.front`, `${parent}/st2.front`], handedness: 1 }, `clawH${i}L`); }


// ── the rig: rest joints (the vajra core derived from the joint table), bones per segment, chains, digitigrade legs ──
const M = (p) => mirrorX(p); const shifted = (p) => add(p, HEAD_SHIFT).map(r6);
const jointsR = { hip: J.hip, knee: J.knee, ankle: J.hock, shoulder: J.shoulder, elbow: J.elbow, wrist: J.wrist, knuckles: J.knuckles, toeBase: J.toeBase, toeTip: J.toeTip };
const joints = {
  pelvisHub: { at: [0, 0, J.hip[2]] }, navel: { at: [0, 0.02, 1.35] }, neckHub: { at: J.neckBase }, headBase: { at: J.neckTop }, headTop: { at: shifted([0, 0.432, 2.026]) },   // headTop: the cranium tip cap, so `head` aims the snout
  jawHinge: { at: shifted([0, -0.288, 1.946]), rides: 'head' }, jawTip: { at: shifted([0, 0.4, 1.994]), rides: 'head' },                                                       // the jaw dial's pivot and the jaw tip cap
};
for (const [k, p] of Object.entries(jointsR)) { joints[`${k}R`] = { at: p }; joints[`${k}L`] = { at: M(p) }; }
for (const S of ['R', 'L']) { joints[`knuckles${S}`].rides = `foreArm${S}`; for (const [i, X] of ['A', 'B', 'C'].entries()) { const { k, m, e } = fingerJoints(i); const f = (p) => (S === 'R' ? p : M(p)); joints[`finger${X}k${S}`] = { at: f(k), rides: `hand${S}` }; joints[`finger${X}m${S}`] = { at: f(m), rides: `hand${S}` }; joints[`finger${X}e${S}`] = { at: f(e), rides: `hand${S}` }; } }
J.tail.forEach((p, i) => { joints[`tail${i}`] = { at: p, rides: 'pelvis' }; });
const bones = [
  { id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }, { id: 'torso', head: 'navel', tail: 'neckHub', aux: ['shoulderL', 'shoulderR'] },
  { id: 'neck', head: 'neckHub', tail: 'headBase' }, { id: 'head', head: 'headBase', tail: 'headTop' }, { id: 'jaw', head: 'jawHinge', tail: 'jawTip' },
  ...['R', 'L'].flatMap((S) => [
    { id: `upperArm${S}`, head: `shoulder${S}`, tail: `elbow${S}` }, { id: `foreArm${S}`, head: `elbow${S}`, tail: `wrist${S}` }, { id: `hand${S}`, head: `wrist${S}`, tail: `knuckles${S}` },
    ...['A', 'B', 'C'].flatMap((X) => [{ id: `finger${X}1${S}`, head: `finger${X}k${S}`, tail: `finger${X}m${S}` }, { id: `finger${X}2${S}`, head: `finger${X}m${S}`, tail: `finger${X}e${S}` }]),
    { id: `thigh${S}`, head: `hip${S}`, tail: `knee${S}` }, { id: `shin${S}`, head: `knee${S}`, tail: `ankle${S}` }, { id: `meta${S}`, head: `ankle${S}`, tail: `toeBase${S}` }, { id: `toes${S}`, head: `toeBase${S}`, tail: `toeTip${S}` },
  ]),
  ...[0, 1, 2, 3, 4].map((k) => ({ id: `tail${k}`, head: `tail${k}`, tail: `tail${k + 1}` })),
];
const downstreamTail = (k) => [1, 2, 3, 4, 5].filter((j) => j > k).map((j) => `tail${j}`);
const rig = {
  joints, bones,
  chains: {
    tail:     { axis: 'x', sign: -1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}`, joints: downstreamTail(k) })) },
    tailSway: { axis: 'z', sign: 1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}`, joints: downstreamTail(k) })) },
    grip:     { axis: 'x', sign: -1, links: ['R', 'L'].flatMap((S) => ['A', 'B', 'C'].flatMap((X) => [{ pivot: `finger${X}k${S}`, joints: [`finger${X}m${S}`, `finger${X}e${S}`] }, { pivot: `finger${X}m${S}`, joints: [`finger${X}e${S}`] }])) },
    jaw:      { axis: 'x', sign: -1, links: [{ pivot: 'jawHinge', joints: ['jawTip'] }] },
  },
  legs: Object.fromEntries(['R', 'L'].map((S) => [S, { hip: `hip${S}`, knee: `knee${S}`, hock: `ankle${S}`, toeBase: `toeBase${S}`, toeTip: `toeTip${S}`, pole: [0, 1, 0] }])),
  reach: 'reject',
};
recipe.rig = rig;
// ── bindings by declaration: a segment belongs to its bone; the overshoot ring at each joint is shared half and half
// with the neighbour, and the cap beyond it belongs to the neighbour outright ──
const segBind = (prev, self, next) => ({ bone: self, blend: { ...(prev ? { back: { [prev]: 1 }, st0: { [prev]: 0.5, [self]: 0.5 } } : {}), ...(next ? { st2: { [self]: 0.5, [next]: 0.5 }, tip: { [next]: 1 } } : {}) } });
const B = recipe.parts;
B.pelvis.bind = 'pelvis';
B.torso.bind = { bone: 'torso', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.5, torso: 0.5 }, st4: { torso: 0.6, neck: 0.4 }, tip: { neck: 1 } } };
B.neck.bind = { bone: 'neck', blend: { back: { torso: 1 }, st0: { torso: 0.5, neck: 0.5 }, st2: { neck: 0.5, head: 0.5 }, tip: { head: 1 } } };
B.cranium.bind = 'head'; B.jaw.bind = 'jaw';
for (const S of ['R', 'L']) {
  B[`thigh${S}`].bind = segBind('pelvis', `thigh${S}`, `shin${S}`); B[`shin${S}`].bind = segBind(`thigh${S}`, `shin${S}`, `meta${S}`); B[`meta${S}`].bind = segBind(`shin${S}`, `meta${S}`, `toes${S}`); B[`toes${S}`].bind = segBind(`meta${S}`, `toes${S}`, null);
  B[`upperArm${S}`].bind = segBind('torso', `upperArm${S}`, `foreArm${S}`); B[`foreArm${S}`].bind = segBind(`upperArm${S}`, `foreArm${S}`, `hand${S}`); B[`hand${S}`].bind = segBind(`foreArm${S}`, `hand${S}`, null);
  for (const X of ['A', 'B', 'C']) { B[`finger${X}1${S}`].bind = segBind(`hand${S}`, `finger${X}1${S}`, `finger${X}2${S}`); B[`finger${X}2${S}`].bind = segBind(`finger${X}1${S}`, `finger${X}2${S}`, null); }
}
for (let k = 0; k < 5; k++) B[`tail${k}`].bind = segBind(k ? `tail${k - 1}` : 'pelvis', `tail${k}`, k < 4 ? `tail${k + 1}` : null);
// ── clips: keyposes in words for the core, channels for the chains; smoothstep between keys, looped ──
const READY = { armL: { x: -0.3, y: 0.55, z: -0.75 }, armR: { x: 0.3, y: 0.55, z: -0.75 }, elbowL: 'slight', elbowR: 'slight', grip: 10, tail: 0, jaw: 0 };
recipe.clips = {
  idle: [READY, { ...READY, tailSway: 8, jaw: 4 }, READY, { ...READY, tailSway: -8, jaw: 4 }],
  crouch: [READY, { ...READY, crouch: 0.6, heelL: 12, heelR: 12, elbowL: 'half', elbowR: 'half', armL: { x: -0.4, y: 0.75, z: -0.5 }, armR: { x: 0.4, y: 0.75, z: -0.5 }, head: { x: 0, y: 0.95, z: 0.3 }, tail: 12, grip: 30 }],
  roar: [READY, { ...READY, crouch: 0.15, jaw: 28, head: { x: 0, y: 0.5, z: 0.85 }, spine: { arch: 0.4 }, armL: { x: -0.6, y: 0.4, z: 0.6 }, armR: { x: 0.6, y: 0.4, z: 0.6 }, elbowL: 'half', elbowR: 'half', tail: 10, grip: 40 }],
};

export { recipe, J };
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  writeFileSync(recipePath, JSON.stringify(recipe, null, 1) + '\n');
  console.log('parts', Object.keys(recipe.parts).length, 'creases', Object.keys(recipe.creases).length, 'dials', Object.keys(recipe.dials).length);
}
