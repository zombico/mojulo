/** seed-recipe.mjs — authors recipe.json ONCE, as a RING PLAN (control/lib/graph/polygonizer/station-loft-plan.js)
 * expanded into the core `layered` grammar (station-loft.js): a hulking humanoid with digitigrade lizard legs,
 * wearing the detailed dragon head from ../head-detail (baked at one expression, worn at HEAD_SHIFT above the
 * neck). Everything body-specific lives HERE as plan DATA: the joint table, the segments and their ring radii,
 * the claws, the dial semantics, the rig and the clips. `expandPlan` owns the ring rules (superellipse rings
 * perpendicular to each segment's axis, overshoot at the joints, mirror by name, the claw geometry, segment
 * bindings). The emitted recipe is declarative; re-running reproduces recipe.json byte for byte. It is the
 * authoring record, not the render path. */
import { writeFileSync } from 'node:fs';
import { expandPlan, PLAN_SCHEMA, mirrorPartName, mirrorId } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { HEAD_PLANS } from '../head-detail/compile.mjs';
export const recipePath = new URL('./recipe.json', import.meta.url);
export const headPath = new URL('../dragon-layered/recipe.json', import.meta.url);   // the plain head the detailed one refines
export const HEAD_EXPRESSION = 'neutral';   // the expression cast baked onto the body (a cast is a recipe; expressions are not live dials here)
export { mirrorPartName, mirrorId };
const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s); const unit = (v) => mul(v, 1 / Math.hypot(...v));

// ── L0: the frame. Metres, +z up, +y front, x = 0 the mirror plane, soles on z = 0 ──
const frame = { up: '+z', front: '+y', note: '1 unit = 1 m; a hulking humanoid, soles on z = 0, the dragon head merged at HEAD_SHIFT above the neck' };
export const HEAD_SHIFT = [0, 0.10, 0.20];   // the head recipe is authored centred at z = 2.05; here it rides 0.2 m higher and 0.1 m forward

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
const FINGERS = ['A', 'B', 'C'];

const joints = { hip: J.hip, knee: J.knee, hock: J.hock, toeBase: J.toeBase, toeTip: J.toeTip, shoulder: J.shoulder, elbow: J.elbow, wrist: J.wrist, knuckles: J.knuckles, neckBase: J.neckBase, neckTop: J.neckTop };
J.tail.forEach((p, i) => { joints[`tail${i}`] = p; });
for (const [i, X] of FINGERS.entries()) { const { k, m, e } = fingerJoints(i); joints[`finger${X}k`] = k; joints[`finger${X}m`] = m; joints[`finger${X}e`] = e; }

// ── the segments: midline trunks and the tail (right half authored, left mirrored by slot name), limbs (right authored, left by name) ──
const limb = (name, from, to, rA, rB, opts, group, tint, prev, next) => ({ name, kind: 'segment', from, to, rA, rB, ...opts, group, tint, mirror: 'name', bind: { bone: name, prev, next } });
const segments = [
  { name: 'pelvis', kind: 'trunk', stations: [{ z: 0.86, r: [0.30, 0.22] }, { z: 1.00, r: [0.36, 0.25] }, { z: 1.14, r: [0.38, 0.27], yc: 0.01 }], caps: { back: [0, 0, 0.78], tip: [0, 0, 1.26] }, group: 'Pelvis', tint: BODY, mirror: 'plane', bind: 'pelvis' },
  { name: 'torso', kind: 'trunk', stations: [
    { z: 1.00, r: [0.36, 0.26], yc: 0.02 }, { z: 1.32, r: [0.38, 0.30], yc: 0.04, e: 2.3 }, { z: 1.55, r: [0.50, 0.34], yc: 0.03, e: 2.6 },
    { z: 1.78, r: [0.58, 0.32], e: 2.8 }, { z: 1.92, r: [0.40, 0.24], yc: -0.02 },
  ], caps: { back: [0, 0.02, 0.92], tip: [0, -0.02, 2.00] }, group: 'Torso', tint: BODY, mirror: 'plane',
    bind: { bone: 'torso', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.5, torso: 0.5 }, st4: { torso: 0.6, neck: 0.4 }, tip: { neck: 1 } } } },
  { name: 'neck', kind: 'segment', from: 'neckBase', to: 'neckTop', rA: [0.18, 0.16], rB: [0.11, 0.10], slots: 'ring8', over: [0.3, 0.4], group: 'Neck', tint: BODY, mirror: 'plane',
    bind: { bone: 'neck', blend: { back: { torso: 1 }, st0: { torso: 0.5, neck: 0.5 }, st2: { neck: 0.5, head: 0.5 }, tip: { head: 1 } } } },
  { name: 'tail', kind: 'chain', joints: [0, 1, 2, 3, 4, 5].map((i) => `tail${i}`), r: TAIL_R, over: { first: 0.4, last: 0.3, inner: 0.6 }, group: 'Tail', tint: LIMB, mirror: 'plane', bind: { root: 'pelvis' } },
  limb('thighR', 'hip', 'knee', [0.19, 0.21], [0.13, 0.14], { e: 2.2, over: [0.5, 0.6] }, 'Legs', LIMB, 'pelvis', 'shinR'),
  limb('shinR', 'knee', 'hock', 0.13, 0.085, { over: [0.6, 0.6] }, 'Legs', LIMB, 'thighR', 'metaR'),
  limb('metaR', 'hock', 'toeBase', 0.085, [0.11, 0.07], { over: [0.6, 0.4] }, 'Legs', LIMB, 'shinR', 'toesR'),
  limb('toesR', 'toeBase', 'toeTip', [0.12, 0.06], [0.10, 0.03], { over: [0.3, 0.3] }, 'Feet', EXTREMITY, 'metaR', null),
  limb('upperArmR', 'shoulder', 'elbow', 0.16, 0.12, { over: [0.6, 0.6] }, 'Arms', LIMB, 'torso', 'foreArmR'),
  limb('foreArmR', 'elbow', 'wrist', 0.12, 0.085, { over: [0.6, 0.6] }, 'Arms', LIMB, 'upperArmR', 'handR'),
  limb('handR', 'wrist', 'knuckles', [0.09, 0.08], [0.13, 0.045], { over: [0.4, 0.3] }, 'Hands', EXTREMITY, 'foreArmR', null),
  ...FINGERS.flatMap((X) => [
    limb(`finger${X}1R`, `finger${X}k`, `finger${X}m`, 0.032, 0.028, { over: [0.5, 0.5] }, 'Hands', EXTREMITY, 'handR', `finger${X}2R`),
    limb(`finger${X}2R`, `finger${X}m`, `finger${X}e`, 0.028, 0.022, { over: [0.5, 0.5] }, 'Hands', EXTREMITY, `finger${X}1R`, null),
  ]),
];

// ── the head: the DETAILED dragon head as PLAN DATA (docs/examples/head-detail/heads/dragon.head.json), which the plan
// expands at one expression and wears at HEAD_SHIFT: the refined cranium and jaw as L1, every region, ornament and tile
// as a pinned L2 part, its dials spliced in where `dials.head` says ──
const heads = [{ name: 'head', plan: HEAD_PLANS.dragon, expression: HEAD_EXPRESSION, shift: HEAD_SHIFT, bind: { cranium: 'head', jaw: 'jaw' } }];

// ── the claws: three at each toe tip on the top band of the last toe station, one on each distal finger tip. A claw's
// base ring sits INSIDE its host (so the union fuses) and its apex clears the host's tip cap: the toe loft runs 0.3 × r
// past the toe tip and its cap 0.45 × r further (≈ 7.5 cm at r = 0.10), so a foot claw starts 2 cm past the joint and
// runs 11 cm. (The exposure ledger found the first cast's middle claw entirely inside the toe: it started 2 cm behind.) ──
const W = 1 / 3, THIRDS = [W, W, W]; const footDir = [0, 0.9, -0.25]; const FT = J.toeTip;
const claw = (name, base, dir, length, radius, pin, mirror) => ({ name, kind: 'claw', base, dir, length, radius, pin, group: 'Claws', tint: CLAW, stretch: 'clawLength', mirror });
const details = [
  claw('clawF0R', [FT[0] - 0.07, FT[1] + 0.02, 0.03], footDir, 0.11, 0.02, { parent: 'toesR', face: 'toesR/st1-st2.k5.a', weights: THIRDS, tangentEdge: ['toesR/st1.frontL', 'toesR/st2.frontL'], handedness: 1 }, 'clawF0L'),
  claw('clawF1R', [FT[0], FT[1] + 0.02, 0.03], footDir, 0.12, 0.022, { parent: 'toesR', face: 'toesR/st1-st2.k0.b', weights: THIRDS, tangentEdge: ['toesR/st1.front', 'toesR/st2.front'], handedness: 1 }, 'clawF1L'),
  claw('clawF2R', [FT[0] + 0.07, FT[1] + 0.02, 0.03], footDir, 0.11, 0.02, { parent: 'toesR', face: 'toesR/st1-st2.k0.a', weights: THIRDS, tangentEdge: ['toesR/st1.frontR', 'toesR/st2.frontR'], handedness: 1 }, 'clawF2L'),
  ...FINGERS.map((X, i) => { const { e } = fingerJoints(i); const parent = `finger${X}2R`;
    return claw(`clawH${i}R`, add(e, mul(unit(FINGER.distDir), 0.01)), FINGER.clawDir, 0.07, 0.015, { parent, face: `${parent}/st1-st2.k0.b`, weights: THIRDS, tangentEdge: [`${parent}/st1.front`, `${parent}/st2.front`], handedness: 1 }, `clawH${i}L`); }),
];

// ── the dials, in application order: every scale and offset first, the rigid hinges last, so a leaned head is never sheared ──
const legParts = ['thighR', 'thighL', 'shinR', 'shinL', 'metaR', 'metaL', 'toesR', 'toesL']; const fingerParts = FINGERS.flatMap((X) => ['R', 'L'].flatMap((S) => [`finger${X}1${S}`, `finger${X}2${S}`]));
const armParts = ['upperArmR', 'upperArmL', 'foreArmR', 'foreArmL', 'handR', 'handL', ...fingerParts];
const tailParts = [0, 1, 2, 3, 4].map((i) => `tail${i}`);
const all = (w) => ({ st0: w, st1: w, st2: w, back: w, tip: w });
const dials = {
  bulk:       { min: 0.85, max: 1.3, rest: 1, doc: 'x scale of the torso and arms about the mirror plane (broader chest, the arms ride outward with it)', op: 'scale', axis: 'x', pivot: 0, parts: ['torso', ...armParts], blend: { ...all(1), st3: 1, st4: 1 } },
  gut:        { min: 0, max: 0.15, rest: 0, doc: 'metres the belly front slots move forward at the waist', op: 'offset', axis: 'y', slots: ['front', 'frontR', 'frontL'], parts: ['torso', 'pelvis'], blend: { st0: 0.6, st1: 1, st2: 0.5 } },
  stance:     { min: 0.8, max: 1.35, rest: 1, doc: 'x scale of the legs about the mirror plane (wider stance, thicker legs)', op: 'scale', axis: 'x', pivot: 0, parts: legParts, blend: all(1) },
  clawLength: { min: 0.5, max: 1.8, rest: 1, doc: 'stretch of every claw along its own axis', op: 'stretch', parts: [] },
  head:       { op: 'include', name: 'head' },
  lean:       { min: -10, max: 25, rest: 0, doc: 'degrees the torso, arms, neck and head hinge forward about the pelvis tip; the legs stay planted', op: 'hinge', parts: ['torso', 'neck', 'cranium', 'jaw', ...armParts], pivot: 'pelvis/tip', axis: 'x', sign: -1 },
  tailCurl:   { min: -20, max: 20, rest: 0, doc: 'degrees per tail joint about x, propagated from the base (+ lifts the tip)', op: 'chain', axis: 'x', sign: -1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}/back`, parts: tailParts.slice(k) })) },
  tailSway:   { min: -15, max: 15, rest: 0, doc: 'degrees per tail joint about z, propagated from the base (+ swings the tip to the right)', op: 'chain', axis: 'z', sign: 1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}/back`, parts: tailParts.slice(k) })) },
  grip:       { min: 0, max: 45, rest: 0, doc: 'degrees per finger joint, both hands, curling toward the palm', op: 'chain', axis: 'x', sign: -1, links: ['R', 'L'].flatMap((S) => FINGERS.flatMap((X) => [{ pivot: `finger${X}1${S}/back`, parts: [`finger${X}1${S}`, `finger${X}2${S}`] }, { pivot: `finger${X}2${S}/back`, parts: [`finger${X}2${S}`] }])) },
};

// ── the rig: rest joints (the vajra core from the joint table; `$S` names their R and L twins), bones per segment, chains, digitigrade legs ──
const shifted = (p) => add(p, HEAD_SHIFT);
const rigJoints = {
  pelvisHub: { at: [0, 0, J.hip[2]] }, navel: { at: [0, 0.02, 1.35] }, neckHub: { at: J.neckBase }, headBase: { at: J.neckTop }, headTop: { at: shifted([0, 0.432, 2.026]) },   // headTop: the cranium tip cap, so `head` aims the snout
  jawHinge: { at: shifted([0, -0.288, 1.946]), rides: 'head' }, jawTip: { at: shifted([0, 0.4, 1.994]), rides: 'head' },                                                       // the jaw dial's pivot and the jaw tip cap
  hip$S: { at: J.hip }, knee$S: { at: J.knee }, ankle$S: { at: J.hock }, shoulder$S: { at: J.shoulder }, elbow$S: { at: J.elbow }, wrist$S: { at: J.wrist }, knuckles$S: { at: J.knuckles, rides: 'foreArm$S' }, toeBase$S: { at: J.toeBase }, toeTip$S: { at: J.toeTip },
};
for (const S of ['R', 'L']) for (const [i, X] of FINGERS.entries()) { const { k, m, e } = fingerJoints(i); const f = (p) => (S === 'R' ? p : [-p[0] + 0, p[1], p[2]]); rigJoints[`finger${X}k${S}`] = { at: f(k), rides: `hand${S}` }; rigJoints[`finger${X}m${S}`] = { at: f(m), rides: `hand${S}` }; rigJoints[`finger${X}e${S}`] = { at: f(e), rides: `hand${S}` }; }
J.tail.forEach((p, i) => { rigJoints[`tail${i}`] = { at: p, rides: 'pelvis' }; });
const downstreamTail = (k) => [1, 2, 3, 4, 5].filter((j) => j > k).map((j) => `tail${j}`);
const rig = {
  joints: rigJoints,
  bones: [
    { id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }, { id: 'torso', head: 'navel', tail: 'neckHub', aux: ['shoulderL', 'shoulderR'] },
    { id: 'neck', head: 'neckHub', tail: 'headBase' }, { id: 'head', head: 'headBase', tail: 'headTop' }, { id: 'jaw', head: 'jawHinge', tail: 'jawTip' },
    { perSide: [
      { id: 'upperArm$S', head: 'shoulder$S', tail: 'elbow$S' }, { id: 'foreArm$S', head: 'elbow$S', tail: 'wrist$S' }, { id: 'hand$S', head: 'wrist$S', tail: 'knuckles$S' },
      ...FINGERS.flatMap((X) => [{ id: `finger${X}1$S`, head: `finger${X}k$S`, tail: `finger${X}m$S` }, { id: `finger${X}2$S`, head: `finger${X}m$S`, tail: `finger${X}e$S` }]),
      { id: 'thigh$S', head: 'hip$S', tail: 'knee$S' }, { id: 'shin$S', head: 'knee$S', tail: 'ankle$S' }, { id: 'meta$S', head: 'ankle$S', tail: 'toeBase$S' }, { id: 'toes$S', head: 'toeBase$S', tail: 'toeTip$S' },
    ] },
    ...[0, 1, 2, 3, 4].map((k) => ({ id: `tail${k}`, head: `tail${k}`, tail: `tail${k + 1}` })),
  ],
  chains: {
    tail:     { axis: 'x', sign: -1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}`, joints: downstreamTail(k) })) },
    tailSway: { axis: 'z', sign: 1, links: [1, 2, 3, 4].map((k) => ({ pivot: `tail${k}`, joints: downstreamTail(k) })) },
    grip:     { axis: 'x', sign: -1, links: [{ perSide: FINGERS.flatMap((X) => [{ pivot: `finger${X}k$S`, joints: [`finger${X}m$S`, `finger${X}e$S`] }, { pivot: `finger${X}m$S`, joints: [`finger${X}e$S`] }]) }] },
    jaw:      { axis: 'x', sign: -1, links: [{ pivot: 'jawHinge', joints: ['jawTip'] }] },
  },
  legs: Object.fromEntries(['R', 'L'].map((S) => [S, { hip: `hip${S}`, knee: `knee${S}`, hock: `ankle${S}`, toeBase: `toeBase${S}`, toeTip: `toeTip${S}`, pole: [0, 1, 0] }])),
  reach: 'reject',
};
// ── clips: keyposes in words for the core, channels for the chains; smoothstep between keys, looped ──
const READY = { armL: { x: -0.3, y: 0.55, z: -0.75 }, armR: { x: 0.3, y: 0.55, z: -0.75 }, elbowL: 'slight', elbowR: 'slight', grip: 10, tail: 0, jaw: 0 };
const clips = {
  idle: [READY, { ...READY, tailSway: 8, jaw: 4 }, READY, { ...READY, tailSway: -8, jaw: 4 }],
  crouch: [READY, { ...READY, crouch: 0.6, heelL: 12, heelR: 12, elbowL: 'half', elbowR: 'half', armL: { x: -0.4, y: 0.75, z: -0.5 }, armR: { x: 0.4, y: 0.75, z: -0.5 }, head: { x: 0, y: 0.95, z: 0.3 }, tail: 12, grip: 30 }],
  roar: [READY, { ...READY, crouch: 0.15, jaw: 28, head: { x: 0, y: 0.5, z: 0.85 }, spine: { arch: 0.4 }, armL: { x: -0.6, y: 0.4, z: 0.6 }, armR: { x: 0.6, y: 0.4, z: 0.6 }, elbowL: 'half', elbowR: 'half', tail: 10, grip: 40 }],
};

export const plan = {
  schema: PLAN_SCHEMA, frame,
  symmetry: { plane: 'x=0', policy: 'midline parts: right half authored, left half mirrored by name; limbs: right limb authored, left limb mirrored in x with R ↔ L renamed on the part and the slot; midline details use symmetric pins' },
  joints, segments, heads, details, dials, rig, clips,
};
export const recipe = expandPlan(plan);
export { J };
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  writeFileSync(recipePath, JSON.stringify(recipe, null, 1) + '\n');
  console.log('parts', Object.keys(recipe.parts).length, 'creases', Object.keys(recipe.creases).length, 'dials', Object.keys(recipe.dials).length);
}
