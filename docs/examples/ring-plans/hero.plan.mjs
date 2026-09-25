/** hero.plan.mjs — the HERO FORM: a human ring plan on the vajra rest skeleton.
 *
 * `heroPlan({ cast, register, girth, headScale, palette })` returns a `layered-plan-v1` plan whose JOINTS are the
 * figure's vajra rest landmarks (figure-vajra.js STAND, scaled by a figure-cast preset or dial map, then into
 * metres), so the rig's core is the figure's own rest pose and every pose word, gait and emote resolves the same
 * way it does on the SVG figure. The MESH is not the vajra field: it is rings along those joints — a pelvis and a
 * torso trunk, a neck, a head trunk (chin → crown), and one straight loft per limb bone (upper arm, forearm, a
 * mitten hand, thigh, shank, a foot whose overshoot behind the ankle is the heel, toes). Proportion is data: start
 * from a cast word, then edit the radii, station heights and `e` for THIS human. `register` sets the art style
 * (slot family and superellipse exponent) for every ring at once. Colour is the palette by group. Face, hair and
 * adornments are not here: the head is a blank trunk until the hero head is worn as an include. The neck names the
 * trunk family (it is a segment that reads as part of the midline).
 *
 * Run as a script to write hero.plan.json (the canonical hero, byte for byte). */
import { writeFileSync } from 'node:fs';
import { expandPlan, PLAN_SCHEMA, r6 } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { castArmature } from '../../../control/lib/graph/polygonizer/figure-cast.js';

export const planPath = new URL('./hero.plan.json', import.meta.url);
/** vajra rest units → metres: the canonical figure's crown lands at 1.80 m */
export const SCALE = 1.8;
export const REGISTERS = {
  lowpoly: { slots: 'ring6', limbSlots: 'limb6', e: 2 },
  round: { slots: 'ring8', limbSlots: 'limb6', e: 2 },
  chamfer: { slots: 'ring8', limbSlots: 'ring8', e: 6 },
  box: { slots: 'ring8', limbSlots: 'ring8', e: 12 },
};
export const PALETTE = { Skin: '#e6b48c', Top: '#3d6fa8', Bottom: '#2c3a55', Shoes: '#4a3526' };

const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s); const unit = (v) => mul(v, 1 / Math.hypot(...v));
const R = (v) => (Array.isArray(v) ? v.map(r6) : r6(v));

/**
 * @param {object} opts
 *   cast       a figure-cast preset name or dial map (default 'canonical')
 *   register   a REGISTERS key or { slots, limbSlots, e } (default 'round')
 *   girth      multiplies every ring radius (default 1)
 *   headScale  multiplies the head trunk's radii and its spread about the atlas (default 1; a chibi wants ≥ 1.3)
 *   palette    { group: '#hex' } (default PALETTE)
 *   head       a baked hero head (docs/examples/hero-head `bakeHero()` / baked.json) worn at the atlas instead of
 *              the blank head trunk: its cranium rides the head bone, its jaw a jaw bone with a `jaw` chain
 */
export function heroPlan({ cast = 'canonical', register = 'round', girth = 1, headScale = 1, palette = PALETTE, head = null } = {}) {
  const reg = typeof register === 'string' ? REGISTERS[register] : register;
  if (!reg) throw new Error(`hero.plan: unknown register '${register}' (have ${Object.keys(REGISTERS).join(', ')})`);
  const m = castArmature(cast);
  const P = (k) => [m[k].x, m[k].y, m[k].z].map((v) => r6(v * SCALE));
  const g = (v) => (Array.isArray(v) ? v.map((x) => r6(x * girth)) : r6(v * girth));

  // ── the joint table (metres): midline hubs and the right side; hands and feet extend the core ──
  const J = { pelvisHub: P('pelvisHub'), navel: P('navel'), neckHub: P('neckHub'), headBase: P('headBase'), headTop: P('headTop'),
    hip: P('hipR'), knee: P('kneeR'), ankle: P('ankleR'), shoulder: P('shoulderR'), elbow: P('elbowR'), wrist: P('wristR') };
  J.toeBase = R(add(J.ankle, [0, 0.11, J.ankle[2] > 0.02 ? 0.02 - J.ankle[2] : 0]));
  J.toeTip = R(add(J.toeBase, [0, 0.11, -0.005]));
  J.knuckles = R(add(J.wrist, mul(unit(add(J.wrist, mul(J.elbow, -1))), 0.09)));
  const joints = Object.fromEntries(Object.entries(J).filter(([k]) => !['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop'].includes(k)));
  Object.assign(joints, { neckHub: J.neckHub, headBase: J.headBase });

  // ── the trunks: stations by fraction of the bone they sit on, radii [side, front] ──
  const zp = J.pelvisHub[2], zn = J.navel[2], zs = J.neckHub[2], hb = J.headBase[2], ht = J.headTop[2];
  const L = zn - zp, T = zs - zn, H = (ht - hb) * headScale;
  const st = (z, r, extra = {}) => ({ z: r6(z), r: g(r), ...extra });
  const hipHalf = J.hip[0], shoulderHalf = J.shoulder[0];
  // the pelvis envelopes the thigh tops: its hip station reaches past the hip joints by most of a thigh radius
  const pelvis = { name: 'pelvis', kind: 'trunk', stations: [
    st(zp - 0.3 * L, [hipHalf / girth + 0.03, 0.13], { yc: 0.02 }), st(zp, [hipHalf / girth + 0.07, 0.15], { yc: 0.02 }), st(zp + 0.7 * L, [0.155, 0.105]),
  ], caps: { back: R([0, 0, zp - 0.5 * L]), tip: R([0, 0, zp + 0.95 * L]) }, group: 'Bottom', mirror: 'plane', bind: 'pelvis' };
  const torso = { name: 'torso', kind: 'trunk', stations: [
    st(zp + 0.7 * L, [0.155, 0.105]), st(zn, [0.175, 0.115], { yc: 0.005 }), st(zn + 0.55 * T, [0.215, 0.13], { yc: 0.01 }),
    st(zs - 0.01, [shoulderHalf / girth + 0.04, 0.12]), st(zs + 0.045, [0.15, 0.10]),
  ], caps: { back: R([0, 0, zp + 0.5 * L]), tip: R([0, 0, zs + 0.085]) }, group: 'Top', mirror: 'plane',
    bind: { bone: 'torso', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.5, torso: 0.5 }, st4: { torso: 0.6, neck: 0.4 }, tip: { neck: 1 } } } };
  const neck = { name: 'neck', kind: 'segment', from: 'neckHub', to: 'headBase', rA: g([0.062, 0.058]), rB: g([0.056, 0.054]), slots: reg.slots, over: [0.3, 0.4], group: 'Skin', mirror: 'plane',
    bind: { bone: 'neck', blend: { back: { torso: 1 }, st0: { torso: 0.5, neck: 0.5 }, st2: { neck: 0.5, head: 0.5 }, tip: { head: 1 } } } };
  const hs = (k, r, yc) => ({ z: r6(hb + k * H), r: r.map((x) => r6(x * H)), ...(yc ? { yc: r6(yc * H) } : {}) });

  // ── the limbs: right side authored, left by name; each a straight loft whose ends overshoot the joint ──
  // a limb takes the style's family and exponent; hands and feet name their own e so they never go rounder than a slab
  const limb = (name, from, to, rA, rB, over, group, prev, next, e) => ({ name, kind: 'segment', from, to, rA: g(rA), rB: g(rB), ...(e != null ? { e } : {}), over, group, mirror: 'name', bind: { bone: name, prev, next } });
  const blankHead = { name: 'head', kind: 'trunk', stations: [
    hs(-0.25, [0.48, 0.5], 0.04), hs(0.35, [0.70, 0.74], 0.06), hs(0.9, [0.74, 0.78], 0.04), hs(1.35, [0.66, 0.70]), hs(1.65, [0.42, 0.46]),
  ], caps: { back: R([0, 0, hb - 0.45 * H]), tip: R([0, 0, hb + 1.8 * H]) }, group: 'Skin', mirror: 'plane', bind: 'head' };
  const segments = [pelvis, torso, neck, ...(head ? [] : [blankHead]),
    limb('upperArmR', 'shoulder', 'elbow', 0.062, 0.046, [0.15, 0.6], 'Top', 'torso', 'foreArmR'),
    limb('foreArmR', 'elbow', 'wrist', 0.046, 0.036, [0.6, 0.6], 'Top', 'upperArmR', 'handR'),
    limb('handR', 'wrist', 'knuckles', [0.044, 0.028], [0.046, 0.02], [0.4, 0.35], 'Skin', 'foreArmR', null, Math.max(reg.e, 3)),
    limb('thighR', 'hip', 'knee', [0.085, 0.095], 0.066, [0.15, 0.6], 'Bottom', 'pelvis', 'shankR'),
    limb('shankR', 'knee', 'ankle', 0.064, 0.04, [0.6, 0.6], 'Bottom', 'thighR', 'footR'),
    limb('footR', 'ankle', 'toeBase', [0.046, 0.038], [0.056, 0.028], [1.1, 0.2], 'Shoes', 'shankR', 'toesR', Math.max(reg.e, 3)),
    limb('toesR', 'toeBase', 'toeTip', [0.056, 0.028], [0.05, 0.02], [0.2, 0.35], 'Shoes', 'footR', null, Math.max(reg.e, 3)),
  ];

  // ── dials: silhouette-scale moves only; posing is the rig's ──
  const all = (w) => ({ st0: w, st1: w, st2: w, st3: w, st4: w, back: w, tip: w });
  const armParts = ['upperArm$S', 'foreArm$S', 'hand$S'], legParts = ['thigh$S', 'shank$S', 'foot$S', 'toes$S'];
  const HEAD_SHIFT = [0, 0, hb];
  const shifted = (p) => R(add(p, HEAD_SHIFT));
  const include = head ? [{ name: 'head', parts: head.parts, dials: head.dials, creases: head.creases, palette: head.palette, shift: HEAD_SHIFT, bind: head.bind }] : [];
  const dials = {
    ...(head ? { head: { op: 'include', name: 'head' } } : {}),
    bulk: { min: 0.8, max: 1.4, rest: 1, doc: 'x scale of the torso and arms about the mirror plane (broader chest and shoulders)', op: 'scale', axis: 'x', pivot: 0, parts: ['torso', ...armParts], blend: all(1) },
    stance: { min: 0.8, max: 1.35, rest: 1, doc: 'x scale of the pelvis and legs about the mirror plane (wider stance, thicker legs)', op: 'scale', axis: 'x', pivot: 0, parts: ['pelvis', ...legParts], blend: all(1) },
    lean: { min: -10, max: 25, rest: 0, doc: 'degrees the torso, arms, neck and head hinge forward about the pelvis tip; the legs stay planted', op: 'hinge', parts: ['torso', 'neck', ...(head ? ['cranium', 'jaw'] : ['head']), ...armParts], pivot: 'pelvis/tip', axis: 'x', sign: -1 },
  };

  // ── the rig: the vajra core IS the joint table; hands and feet ride or plant ──
  const rig = {
    joints: { pelvisHub: { at: J.pelvisHub }, navel: { at: J.navel }, neckHub: { at: J.neckHub }, headBase: { at: J.headBase }, headTop: { at: J.headTop },
      hip$S: { at: J.hip }, knee$S: { at: J.knee }, ankle$S: { at: J.ankle }, toeBase$S: { at: J.toeBase }, toeTip$S: { at: J.toeTip },
      shoulder$S: { at: J.shoulder }, elbow$S: { at: J.elbow }, wrist$S: { at: J.wrist }, knuckles$S: { at: J.knuckles, rides: 'foreArm$S' },
      ...(head ? { jawHinge: { at: shifted(head.joints.jawHinge), rides: 'head' }, jawTip: { at: shifted(head.joints.jawTip), rides: 'head' } } : {}) },
    bones: [
      { id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }, { id: 'torso', head: 'navel', tail: 'neckHub', aux: ['shoulderL', 'shoulderR'] },
      { id: 'neck', head: 'neckHub', tail: 'headBase' }, { id: 'head', head: 'headBase', tail: 'headTop' }, ...(head ? [{ id: 'jaw', head: 'jawHinge', tail: 'jawTip' }] : []),
      { perSide: [
        { id: 'upperArm$S', head: 'shoulder$S', tail: 'elbow$S' }, { id: 'foreArm$S', head: 'elbow$S', tail: 'wrist$S' }, { id: 'hand$S', head: 'wrist$S', tail: 'knuckles$S' },
        { id: 'thigh$S', head: 'hip$S', tail: 'knee$S' }, { id: 'shank$S', head: 'knee$S', tail: 'ankle$S' }, { id: 'foot$S', head: 'ankle$S', tail: 'toeBase$S' }, { id: 'toes$S', head: 'toeBase$S', tail: 'toeTip$S' },
      ] },
    ],
    ...(head ? { chains: { jaw: { axis: 'x', sign: -1, links: [{ pivot: 'jawHinge', joints: ['jawTip'] }] } } } : {}),
    legs: Object.fromEntries(['R', 'L'].map((S) => [S, { hip: `hip${S}`, knee: `knee${S}`, hock: `ankle${S}`, toeBase: `toeBase${S}`, toeTip: `toeTip${S}`, pole: [0, 1, 0] }])),
    reach: 'reject',
  };

  // ── clips: pose words for the core; a walk in place (one foot planted, the other swings) ──
  const READY = { elbowL: 'slight', elbowR: 'slight' };
  const swingR = { support: 'L', legR: { x: 0.08, y: 0.45, z: -0.89 }, kneeR: 'slight', armL: { x: -0.2, y: 0.42, z: -0.88 }, armR: { x: 0.2, y: -0.4, z: -0.9 }, elbowL: 'half', elbowR: 'slight' };
  const swingL = { support: 'R', legL: { x: -0.08, y: 0.45, z: -0.89 }, kneeL: 'slight', armR: { x: 0.2, y: 0.42, z: -0.88 }, armL: { x: -0.2, y: -0.4, z: -0.9 }, elbowR: 'half', elbowL: 'slight' };
  const clips = {
    idle: [READY, { ...READY, spine: { arch: 0.06 } }, READY, { ...READY, crouch: 0.03, ...(head ? { jaw: 4 } : {}) }],
    walk: [{ ...READY, ...swingR }, READY, { ...READY, ...swingL }, READY],
    wave: [READY, { ...READY, armR: { x: 0.35, y: 0.25, z: 0.9 }, elbowR: 'half', head: { x: 0.1, y: 0.95, z: 0.3 } }, { ...READY, armR: { x: 0.6, y: 0.2, z: 0.75 }, elbowR: 'slight' }, { ...READY, armR: { x: 0.35, y: 0.25, z: 0.9 }, elbowR: 'half' }],
  };

  return {
    schema: PLAN_SCHEMA,
    frame: { up: '+z', front: '+y', note: `1 unit = 1 m; a human on the vajra rest skeleton (cast ${typeof cast === 'string' ? cast : 'dials'}), soles on z = 0, facing +y` },
    symmetry: { plane: 'x=0', policy: 'midline parts: right half authored, left half mirrored by name; limbs: right limb authored, left limb mirrored in x with R ↔ L renamed on the part and the slot' },
    style: { slots: reg.slots, limbSlots: reg.limbSlots, e: reg.e },
    joints, segments, include, dials, palette, rig, clips,
  };
}

export const plan = heroPlan();
export const recipe = expandPlan(plan);
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  writeFileSync(planPath, JSON.stringify(plan, null, 1) + '\n');
  console.log('joints', Object.keys(plan.joints).length, 'segments', plan.segments.length, 'parts', Object.keys(recipe.parts).length, 'dials', Object.keys(recipe.dials).length);
}
