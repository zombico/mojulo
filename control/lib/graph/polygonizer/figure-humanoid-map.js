/**
 * figure-humanoid-map — mojulo's biped rig ↔ the VRM 1.0 humanoid bone names
 * (interchange-seams.plan.md seam 3a). Pure data + two small resolvers; no code
 * path changes unless a caller asks for `humanoid`.
 *
 * Why VRM: it is the open avatar standard (VRChat, VTubers, three-vrm), Unity's
 * Humanoid avatar auto-maps by these names, and the Mixamo / VRMA clip libraries
 * are addressed by them — one map turns a decade of motion into INPUT for
 * mojulo figures and mojulo figures into avatars for everyone else.
 *
 * Two vocabularies on the mojulo side:
 *  - FIGURE_NODES (figure-vajra.js) — 17 JOINT points: headTop headBase neckHub
 *    navel pelvisHub shoulderL/R hipL/R elbowL/R wristL/R kneeL/R ankleL/R.
 *  - BIPED_BONES (rig-bake.js) — 11 BONE segments the packed rig / skinned
 *    export carries: pelvis torso head uArmL/R fArmL/R thighL/R calfL/R, each
 *    with a head + tail joint.
 * VRM names BONES by their origin joint, so the bone map is the one the export
 * uses; the joint map is the inverse door for clip ingest (seam 3b).
 *
 * VRM 1.0 REQUIRES: hips spine head, left/right UpperArm LowerArm Hand,
 * left/right UpperLeg LowerLeg Foot (15). Mojulo has no hand or foot bones —
 * the resolver adds LEAF joints at the wrist / ankle tails so the required set
 * is complete; chest / neck / shoulders / toes are optional and left out.
 *
 * Honest limits (documented, not hidden): the skinned export's skeleton is
 * FLAT (every joint is a child of the figure wrapper, rotations are absolute),
 * whereas Unity Humanoid and strict VRM validators expect a parent-child
 * hierarchy in T-pose. The names + extension make the figure ADDRESSABLE by
 * every VRM-aware tool today; re-rooting into a parent-local hierarchy and a
 * T-pose rest is seam 3a-ii, tracked in the plan.
 */

// packed-rig bone id → VRM humanoid bone (the bone's HEAD joint is the VRM bone origin)
export const BONE_TO_VRM = Object.freeze({
  pelvis: 'hips',
  torso: 'spine',
  head: 'head',
  uArmL: 'leftUpperArm',
  fArmL: 'leftLowerArm',
  uArmR: 'rightUpperArm',
  fArmR: 'rightLowerArm',
  thighL: 'leftUpperLeg',
  calfL: 'leftLowerLeg',
  thighR: 'rightUpperLeg',
  calfR: 'rightLowerLeg',
});

// leaf bones VRM requires that mojulo carries only as a segment TAIL: emitted as
// weightless joints at that tail (parent = the bone whose tail they sit on)
export const LEAF_TO_VRM = Object.freeze({
  fArmL: 'leftHand',
  fArmR: 'rightHand',
  calfL: 'leftFoot',
  calfR: 'rightFoot',
});

// FIGURE_NODES joint → VRM bone whose origin sits on that joint (the ingest door)
export const JOINT_TO_VRM = Object.freeze({
  pelvisHub: 'hips',
  navel: 'spine',
  neckHub: 'head',
  shoulderL: 'leftUpperArm',
  shoulderR: 'rightUpperArm',
  elbowL: 'leftLowerArm',
  elbowR: 'rightLowerArm',
  wristL: 'leftHand',
  wristR: 'rightHand',
  hipL: 'leftUpperLeg',
  hipR: 'rightUpperLeg',
  kneeL: 'leftLowerLeg',
  kneeR: 'rightLowerLeg',
  ankleL: 'leftFoot',
  ankleR: 'rightFoot',
  // headTop / headBase have no VRM bone (head tip; the atlas pivot folds into `head`)
});

export const VRM_REQUIRED = Object.freeze([
  'hips', 'spine', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
]);

// VRM bone → the mojulo bone id (inverse of BONE_TO_VRM), for name-addressed lookups
export const VRM_TO_BONE = Object.freeze(Object.fromEntries(Object.entries(BONE_TO_VRM).map(([k, v]) => [v, k])));

/**
 * humanoidBonesFor(bones) → { names: Map<boneIndex, vrmName>, leaves: [{ vrm,
 * parent: boneIndex, at: [x,y,z] }], missing: [vrmName] } — resolve a packed
 * rig's bone list to VRM names. Bones with no VRM name keep their own id
 * (`names` omits them). `missing` lists REQUIRED VRM bones the rig cannot
 * supply (a quadruped rig → most of them), so a caller can refuse or advise.
 */
export function humanoidBonesFor(bones = []) {
  const names = new Map();
  const leaves = [];
  const have = new Set();
  bones.forEach((b, i) => {
    const vrm = BONE_TO_VRM[b.id];
    if (vrm) { names.set(i, vrm); have.add(vrm); }
    const leaf = LEAF_TO_VRM[b.id];
    if (leaf && Array.isArray(b.tail) && b.tail.length === 3) {
      leaves.push({ vrm: leaf, parent: i, at: [b.tail[0], b.tail[1], b.tail[2]] });
      have.add(leaf);
    }
  });
  const missing = VRM_REQUIRED.filter((v) => !have.has(v));
  return { names, leaves, missing };
}

/** isHumanoidRig(bones) → true when every REQUIRED VRM bone resolves. */
export function isHumanoidRig(bones = []) {
  return humanoidBonesFor(bones).missing.length === 0;
}
