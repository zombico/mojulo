/**
 * figure-landmarks — slot vocabulary for the figure substrate.
 *
 * Twenty-three named landmark slots covering head, torso/pelvis spine,
 * shoulders/arms, and hips/legs/feet. Posture cards declare these slots
 * with whatever positions express their pose; this module ships the
 * canonical T-pose layout (arms straight out, legs straight down, feet
 * flat) plus the three lathe axis pairs every figure uses for its head,
 * torso, and pelvis masses.
 *
 * The substrate doesn't enforce the landmark set — a posture card can
 * declare a subset, or rename, or add new ones. These constants are the
 * shared vocabulary the figure shelf cards converge on so cross-card
 * composition (capes, halos, orbs) can reference well-known slot names
 * via `host/slot/<id>` paths.
 *
 * World convention: Z is up (matches scene gravity = -Z), Y is forward,
 * X is lateral with -X = figure's left. Canonical T-pose is normalized to
 * height 1 (head-crown at z=1, ankles near z=0); apply `scale` and
 * `anchor` to position the figure in a scene.
 */

export const FIGURE_LANDMARK_IDS = Object.freeze([
  'head-crown',
  'head-base',
  'neck-base',
  'torso-top',
  'torso-base',
  'pelvis-top',
  'pelvis-floor',
  'shoulder-l',
  'shoulder-r',
  'elbow-l',
  'elbow-r',
  'wrist-l',
  'wrist-r',
  'hip-l',
  'hip-r',
  'knee-l',
  'knee-r',
  'ankle-l',
  'ankle-r',
  'heel-l',
  'heel-r',
  'toe-l',
  'toe-r',
]);

export const FIGURE_LATHE_AXES = Object.freeze({
  head:   { from: 'head-crown',  to: 'head-base' },
  torso:  { from: 'torso-top',   to: 'torso-base' },
  pelvis: { from: 'pelvis-top',  to: 'pelvis-floor' },
});

const CANONICAL = Object.freeze({
  'head-crown':   { x:  0.00, y:  0.00, z: 1.00 },
  'head-base':    { x:  0.00, y:  0.00, z: 0.86 },
  'neck-base':    { x:  0.00, y:  0.00, z: 0.82 },
  'torso-top':    { x:  0.00, y:  0.00, z: 0.78 },
  'torso-base':   { x:  0.00, y:  0.00, z: 0.55 },
  'pelvis-top':   { x:  0.00, y:  0.00, z: 0.55 },
  'pelvis-floor': { x:  0.00, y:  0.00, z: 0.45 },

  'shoulder-l':   { x: -0.18, y:  0.00, z: 0.78 },
  'shoulder-r':   { x:  0.18, y:  0.00, z: 0.78 },
  'elbow-l':      { x: -0.40, y:  0.00, z: 0.78 },
  'elbow-r':      { x:  0.40, y:  0.00, z: 0.78 },
  'wrist-l':      { x: -0.60, y:  0.00, z: 0.78 },
  'wrist-r':      { x:  0.60, y:  0.00, z: 0.78 },

  'hip-l':        { x: -0.09, y:  0.00, z: 0.47 },
  'hip-r':        { x:  0.09, y:  0.00, z: 0.47 },
  'knee-l':       { x: -0.09, y:  0.00, z: 0.25 },
  'knee-r':       { x:  0.09, y:  0.00, z: 0.25 },
  'ankle-l':      { x: -0.09, y:  0.00, z: 0.02 },
  'ankle-r':      { x:  0.09, y:  0.00, z: 0.02 },
  'heel-l':       { x: -0.09, y: -0.03, z: 0.00 },
  'heel-r':       { x:  0.09, y: -0.03, z: 0.00 },
  'toe-l':        { x: -0.09, y:  0.08, z: 0.00 },
  'toe-r':        { x:  0.09, y:  0.08, z: 0.00 },
});

/**
 * Canonical T-pose landmark positions. Defaults are normalized so a
 * scale of 1 puts head-crown at z=1 and feet near z=0; pass `scale` for
 * a different figure height and `anchor` to place it elsewhere in the
 * scene.
 */
export function canonicalTPose({ scale = 1, anchor = { x: 0, y: 0, z: 0 } } = {}) {
  const out = {};
  for (const id of FIGURE_LANDMARK_IDS) {
    const base = CANONICAL[id];
    out[id] = {
      x: anchor.x + scale * base.x,
      y: anchor.y + scale * base.y,
      z: anchor.z + scale * base.z,
    };
  }
  return out;
}

/**
 * Build the `slots: [{ id, position }, ...]` array a manji-tree expects
 * from a landmark pose. Preserves FIGURE_LANDMARK_IDS order, which keeps
 * downstream walker output stable across pose variants.
 */
export function landmarkSlots(pose = canonicalTPose()) {
  return FIGURE_LANDMARK_IDS.map((id) => ({ id, position: pose[id] }));
}
