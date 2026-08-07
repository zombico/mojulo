/**
 * character-mega-boy — a humanoid character family built from STACKED, PROFILED CYLINDERS
 * anchored to the vajra armature and rendered through the workbench seam (kind:'workbench').
 *
 * Sibling of character-lpgo.js. Same move — flesh IS workbench primitives on the posed
 * armature, so the body re-poses/animates for free and rides the same world seam as the
 * workbench/assembler. The ONE difference from LPGO: limb and torso segments are lathes
 * with a RADIUS PROFILE (a bicep that bulges, a torso that tapers, a thigh that swells),
 * not constant-radius noodle capsules. That single substitution buys the humanoid read.
 *
 * This pass builds the four silhouette-defining masses — helmet, torso, bicep, thigh —
 * plus the segments and joints needed to read them as one body. Hands, boots, face, and
 * props are stubs. Design: character-mega-boy.plan.md.
 *
 *   pose (dof) ──articulate (vajra)──▶ grounded node map (z up)
 *              ──emit profiled lathes on bones + beads at joints──▶ workbench monomers
 */

import { armatureNodes } from './character-lpgo.js';

// ── vector helpers on [x,y,z] arrays ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mid = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const xyz = (p) => ({ x: p[0], y: p[1], z: p[2] });

// ── monomer emitters ──
// A profiled solid of revolution between world points a→b. `prof` is either a number
// (constant radius → a plain cylinder) or a [{ t, r }] list (the bulge/taper). This is
// the whole family: LPGO's cyl hardcodes a flat profile; mega-boy lets the caller shape it.
const cyl = (a, b, prof, tint, samples = 22) => ({
  axisFrom: xyz(a), axisTo: xyz(b),
  profile: typeof prof === 'number'
    ? [{ t: 0, radius: prof }, { t: 1, radius: prof }]
    : prof.map((p) => ({ t: p.t, radius: p.r })),
  tint, samples,
});
// A bead — a squashed ball (joint cover / deltoid cap / hand mitt), built as a lathe whose
// profile rounds 0→R→0 along a short axis through the joint, oriented along `axis`.
const bead = (center, r, axis, tint, squash = 0.92) => {
  const u = mul(norm(axis), r * squash);
  return cyl(sub(center, u), add(center, u),
    [{ t: 0, r: 0 }, { t: 0.16, r: r * 0.58 }, { t: 0.5, r }, { t: 0.84, r: r * 0.58 }, { t: 1, r: 0 }],
    tint, 20);
};
const ball = (center, r, tint) => bead(center, r, [0, 0, 1], tint, 1.0);
const boxBetween = (a, b, w, h, tint, r = 0.6) => ({ profile: { rect: { w, h, r } }, axisFrom: xyz(a), axisTo: xyz(b), tint });

const COLORS = {
  skin: '#f3c9a0', suit: '#2f7fd6', suitDark: '#1f5fa8', trim: '#d8e6f4',
  helmet: '#2f7fd6', visor: '#1a3f6e', joint: '#cfd8e2', boot: '#173a63', cannon: '#9aa6b2',
};

/**
 * Canonical mega-boy proportions. Every field is a multiplier/length in armatureNodes
 * units (scale 40). 1.0-ish = the heroic action-figure read. Override via opts.proto.
 */
export const MEGABOY_DEFAULT = {
  helmet: { dome: 5.2, face: 4.2, brow: 1.4, earPods: 1.5, crest: 0.0 },
  neck: { radius: 1.7 },
  torso: { chest: null, waist: null, yoke: 1.0 },   // chest/waist default off shoulderSpan below
  pelvis: { width: 1.0, drop: 3.2 },
  shoulderBead: 2.3,
  bicep: { rootR: 1.9, midR: 2.4, elbowR: 1.55, bulgeT: 0.42 },
  elbowBead: 1.5,
  forearm: { elbowR: 1.5, wristR: 1.2 },
  hand: 1.7,
  thigh: { hipR: 2.7, midR: 3.1, kneeR: 1.95, bulgeT: 0.4 },
  kneeBead: 1.9,
  shin: { kneeR: 1.85, ankleR: 1.3 },
  boot: { rise: 3.0, toe: 6.0, width: 4.2 },
};

const merge = (d, o = {}) => {
  const out = { ...d };
  for (const k of Object.keys(o)) out[k] = (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) ? merge(d[k] || {}, o[k]) : o[k];
  return out;
};

/**
 * Build a mega-boy as a workbench manifest from a pose.
 * @param dof   a vajra pose (e.g. { shR:{ pitch:-70 } })
 * @param opts  { scale, colors, proto, attachments:[{ on, build:(at)=>({lathes?,extrudes?,sweeps?}) }] }
 */
export function buildMegaBoy(dof = {}, opts = {}) {
  const P = armatureNodes(dof, opts);
  const C = { ...COLORS, ...(opts.colors || {}) };
  const M = merge(MEGABOY_DEFAULT, opts.proto || {});
  const shoulderSpan = Math.abs(P.shoulderR[0] - P.shoulderL[0]);
  const chestR = M.torso.chest ?? (shoulderSpan / 2 + 1.0);
  const waistR = M.torso.waist ?? chestR * 0.62;

  const lathes = [];
  const extrudes = [];

  // ── HEAD + HELMET ── head center between the neck-top and crown, lifted into the skull.
  const HC = add(mid(P.headBase, P.headTop, 0.55), [0, 0, M.helmet.dome * 0.45]);
  // face — a skin ball poking forward (+y) and down out of the shell, so the head reads human.
  lathes.push(ball(add(HC, [0, M.helmet.dome * 0.34, -M.helmet.dome * 0.30]), M.helmet.face, C.skin));
  // dome — the shell, nudged back + up; slightly larger than the face so it crowns it.
  lathes.push(ball(add(HC, [0, -M.helmet.dome * 0.12, M.helmet.dome * 0.10]), M.helmet.dome, C.helmet));
  // ear-pods — two discs on the temple line, axis lateral (±x). The Mega Man cue.
  for (const s of [-1, 1]) {
    const ear = add(HC, [s * M.helmet.dome * 0.88, 0, -M.helmet.dome * 0.06]);
    lathes.push(cyl(ear, add(ear, [s * M.helmet.earPods * 1.2, 0, 0]),
      [{ t: 0, r: M.helmet.earPods * 0.85 }, { t: 0.7, r: M.helmet.earPods }, { t: 1, r: M.helmet.earPods * 0.7 }], C.trim, 18));
  }
  // brow visor — a wedge jutting forward over the face gap.
  const brow = add(HC, [0, M.helmet.dome * 0.30, M.helmet.dome * 0.16]);
  extrudes.push(boxBetween(brow, add(brow, [0, M.helmet.brow * 1.4, 0]), M.helmet.dome * 1.5, M.helmet.brow * 0.9, C.visor, 0.5));
  // crest — optional dorsal ridge.
  if (M.helmet.crest > 0) {
    const c0 = add(HC, [0, -M.helmet.dome * 0.2, M.helmet.dome]);
    extrudes.push(boxBetween(c0, add(c0, [0, M.helmet.dome * 0.6, M.helmet.crest]), M.helmet.crest * 0.6, M.helmet.dome * 0.9, C.trim, 0.3));
  }
  // neck
  lathes.push(cyl(P.neckHub, P.headBase, M.neck.radius, C.skin, 16));

  // ── TORSO ── inverted-trapezoid: profiled lathe pelvisHub→neckHub (waist → ribcage → chest).
  lathes.push(cyl(P.pelvisHub, P.neckHub, [
    { t: 0, r: waistR }, { t: 0.55, r: waistR + (chestR - waistR) * 0.7 }, { t: 1, r: chestR },
  ], C.suit, 30));
  // shoulder yoke — a bar across the shoulders so the figure reads broad, not tubular.
  lathes.push(cyl(P.shoulderL, P.shoulderR, M.torso.yoke * (chestR * 0.5), C.suitDark, 18));
  // pelvis block — briefs/belt mass under the waist.
  const pelLo = add(P.pelvisHub, [0, 0, -M.pelvis.drop]);
  lathes.push(cyl(P.pelvisHub, pelLo, [
    { t: 0, r: waistR * 1.02 }, { t: 0.5, r: waistR * M.pelvis.width * 1.05 }, { t: 1, r: waistR * M.pelvis.width * 0.82 },
  ], C.suitDark, 24));

  // ── ARMS ── deltoid bead + profiled bicep (shoulder→elbow) + elbow bead + forearm (→wrist) + hand.
  for (const s of ['L', 'R']) {
    const sh = P['shoulder' + s], el = P['elbow' + s], wr = P['wrist' + s];
    lathes.push(bead(sh, M.shoulderBead, sub(el, sh), C.suitDark));
    lathes.push(cyl(sh, el, [
      { t: 0, r: M.bicep.rootR }, { t: M.bicep.bulgeT, r: M.bicep.midR }, { t: 1, r: M.bicep.elbowR },
    ], C.suit));
    lathes.push(bead(el, M.elbowBead, sub(wr, el), C.joint));
    lathes.push(cyl(el, wr, [{ t: 0, r: M.forearm.elbowR }, { t: 1, r: M.forearm.wristR }], C.suit));
    lathes.push(ball(wr, M.hand, C.skin));
  }

  // ── LEGS ── profiled thigh (hip→knee) + knee bead + shin (→ankle) + boot block.
  for (const s of ['L', 'R']) {
    const hip = P['hip' + s], kn = P['knee' + s], an = P['ankle' + s];
    lathes.push(cyl(hip, kn, [
      { t: 0, r: M.thigh.hipR }, { t: M.thigh.bulgeT, r: M.thigh.midR }, { t: 1, r: M.thigh.kneeR },
    ], C.suit));
    lathes.push(bead(kn, M.kneeBead, sub(an, kn), C.joint));
    lathes.push(cyl(kn, an, [{ t: 0, r: M.shin.kneeR }, { t: 1, r: M.shin.ankleR }], C.suit));
    // boot — a block from the ankle forward (+y) along the foot, raised off the grid.
    const heel = add(an, [0, -M.boot.toe * 0.25, 0]);
    const toe = add(an, [0, M.boot.toe * 0.75, 0]);
    extrudes.push({ profile: { rect: { w: M.boot.width, h: M.boot.rise, r: 1.0 } }, axisFrom: xyz(add(heel, [0, 0, M.boot.rise * 0.5])), axisTo: xyz(add(toe, [0, 0, M.boot.rise * 0.5])), tint: C.boot });
  }

  // ATTACHMENTS — align-to-node, exactly as character-lpgo (the Mega-Buster cannon lives here).
  const sweeps = [];
  for (const att of opts.attachments || []) {
    const at = P[att.on];
    if (!at) continue;
    const built = att.build(at) || {};
    if (built.lathes) lathes.push(...built.lathes);
    if (built.extrudes) extrudes.push(...built.extrudes);
    if (built.sweeps) sweeps.push(...built.sweeps);
  }

  return { kind: 'workbench', units: 'cm', title: opts.title || 'mega-boy', lathes, extrudes, sweeps };
}

// Demo attachment: the Mega-Buster — a barrel cannon over the hand node, bore pointing +y.
export function cannonAt(at) {
  return {
    lathes: [
      cyl(add(at, [0, -2, 0]), add(at, [0, 7, 0]), [{ t: 0, r: 2.4 }, { t: 0.7, r: 2.4 }, { t: 1, r: 2.8 }], COLORS.cannon, 18),
      ball(add(at, [0, -2.2, 0]), 2.6, COLORS.suit),
    ],
  };
}
