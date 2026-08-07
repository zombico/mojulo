/**
 * character-lpgo — SPIKE: an LPGO minifig as block parts anchored to the vajra armature.
 *
 * The first character-builder proof (see character-builder.plan.md). It collapses the
 * figure↔assembler impedance mismatch: a minifig's flesh IS workbench primitives (cylinders/boxes),
 * so the body can be generated directly from the posed armature and rendered through the SAME world
 * seam as the workbench/assembler (kind:'workbench'), not the figure's separate SVG path.
 *
 * Pipeline:
 *   pose (dof) ──articulate (vajra)──▶ node map (STAND units, z up)
 *              ──scale + ground──▶ landmark → [x,y,z] world
 *              ──emit blocks along bones / at joints──▶ workbench monomers
 *              ──attach props `on:'<landmark>'`──▶ parts that ride the rig
 *
 * The block body uses the SAME node positions the gait/motion already produce, so re-posing (or a
 * walk cycle later) moves the blocks and any node-anchored attachment for free — that is the whole
 * point of anchoring to the armature instead of to ground.
 */

import { articulate } from '../polygonizer/figure-vajra.js';

// ── monomer emitters: build a workbench primitive between / at world points [x,y,z] ──
const cyl = (a, b, radius, tint) => ({ axisFrom: { x: a[0], y: a[1], z: a[2] }, axisTo: { x: b[0], y: b[1], z: b[2] }, profile: [{ t: 0, radius }, { t: 1, radius }], tint });
const capsule = (a, b, radius, tint) => ({ path: [a, b], radius, sides: 14, tint, caps: true });          // sweep tube (auto-orients)
const boxBetween = (a, b, w, h, tint, r = 0.6) => ({ profile: { rect: { w, h, r } }, axisFrom: { x: a[0], y: a[1], z: a[2] }, axisTo: { x: b[0], y: b[1], z: b[2] }, tint });
const up = (p, dz) => [p[0], p[1], p[2] + dz];

const COLORS = { skin: '#f2c12e', torso: '#2f6fb0', hips: '#1f4f80', leg: '#4a3a28', prop: '#b8c0c8', grip: '#3a2e22' };

/**
 * Resolve the vajra armature to grounded, scaled world landmark positions for a pose.
 * @returns { landmark: [x,y,z] } — z up, feet on the grid.
 */
export function armatureNodes(dof = {}, { scale = 40, footH = 2 } = {}) {
  const m = articulate(dof);
  const P = {};
  for (const k in m) P[k] = [m[k].x * scale, m[k].y * scale, m[k].z * scale];
  const lift = -Math.min(P.ankleL[2], P.ankleR[2]) + footH;   // drop feet to (just above) the grid
  for (const k in P) P[k][2] += lift;
  return P;
}

/**
 * Build an LPGO minifig as a workbench manifest (lathes/extrudes/sweeps) from a pose.
 * @param dof   a vajra pose (e.g. { shR:{pitch:-70} } raises the right arm)
 * @param opts  { scale, attachments:[{ on:'wristR', build:(at)=>({lathes?,extrudes?,sweeps?}) }] }
 */
export function buildLpgoMinifig(dof = {}, opts = {}) {
  const P = armatureNodes(dof, opts);
  const C = { ...COLORS, ...(opts.colors || {}) };
  const shoulderSpan = Math.abs(P.shoulderR[0] - P.shoulderL[0]);
  const hipSpan = Math.abs(P.hipR[0] - P.hipL[0]);

  const lathes = [];
  const extrudes = [];
  const sweeps = [];

  // head: a cylinder on the neck + a minifig stud
  lathes.push(cyl(P.headBase, up(P.headTop, 2.2), 4.6, C.skin));
  lathes.push(cyl(up(P.headTop, 2.2), up(P.headTop, 3.4), 1.9, C.skin));
  // torso: a box up the spine (pelvisHub → neckHub), shoulder-wide
  extrudes.push(boxBetween(P.pelvisHub, P.neckHub, shoulderSpan + 3.5, 5.2, C.torso, 1.0));
  // hips: a block beneath the pelvis spanning the hips
  extrudes.push(boxBetween(up(P.pelvisHub, -0.2), up(P.pelvisHub, -3.4), hipSpan + 4.5, 5.4, C.hips, 1.0));
  // arms: noodle capsules shoulder → wrist (LPGO = straight limbs); hands as beads
  sweeps.push(capsule(P.shoulderL, P.wristL, 1.7, C.skin));
  sweeps.push(capsule(P.shoulderR, P.wristR, 1.7, C.skin));
  lathes.push(cyl(P.wristL, up(P.wristL, -1.8), 1.7, C.skin));
  lathes.push(cyl(P.wristR, up(P.wristR, -1.8), 1.7, C.skin));
  // legs: wider capsules hip → ankle; simple foot blocks
  sweeps.push(capsule(P.hipL, P.ankleL, 2.3, C.leg));
  sweeps.push(capsule(P.hipR, P.ankleR, 2.3, C.leg));
  for (const a of [P.ankleL, P.ankleR]) {
    extrudes.push({ profile: { rect: { w: 4.2, h: 6.2, r: 1.2 } }, axisFrom: { x: a[0], y: a[1] + 1.2, z: a[2] }, axisTo: { x: a[0], y: a[1] + 1.2, z: 0 }, tint: C.leg });
  }

  // ATTACHMENTS — align-to-node: each attachment builds its monomers around a landmark world point,
  // so it tracks that node across re-pose / animation. (The minifig blocks above are themselves just
  // node-anchored parts; an attachment is the same move, authored by the caller.)
  for (const att of opts.attachments || []) {
    const at = P[att.on];
    if (!at) continue;
    const built = att.build(at) || {};
    if (built.lathes) lathes.push(...built.lathes);
    if (built.extrudes) extrudes.push(...built.extrudes);
    if (built.sweeps) sweeps.push(...built.sweeps);
  }

  return {
    kind: 'workbench', units: 'cm',
    title: opts.title || 'lpgo minifig',
    lathes, extrudes, sweeps,
  };
}

// A demo attachment: a sword whose grip sits at the hand node, blade pointing up (+z). Rides the hand.
export function swordAt(at) {
  return {
    lathes: [cyl(at, up(at, 3), 0.7, COLORS.grip)],                       // grip
    extrudes: [
      { profile: { rect: { w: 4.5, h: 0.9, r: 0.3 } }, axisFrom: { x: at[0], y: at[1], z: at[2] + 3 }, axisTo: { x: at[0], y: at[1], z: at[2] + 3.6 }, tint: COLORS.grip }, // guard
      { profile: { rect: { w: 1.6, h: 0.5, r: 0.2 } }, axisFrom: { x: at[0], y: at[1], z: at[2] + 3.6 }, axisTo: { x: at[0], y: at[1], z: at[2] + 13 }, tint: COLORS.prop }, // blade
    ],
  };
}
