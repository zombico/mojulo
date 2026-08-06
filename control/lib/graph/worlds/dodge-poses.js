/**
 * dodge-poses — the acrobatic-dodge maneuver shelf (the "invincible dodge roll").
 *
 * A dodge is triggered by a DOUBLE-TAP of F pushed toward a held WASD direction;
 * for its duration the unit is invincible and shimmers. The read is ACROBATIC:
 * the body tumbles. Like boost picks boost/boost_back/boost_side by held WASD,
 * a dodge picks its shape by direction:
 *
 *   held  | clip            | read
 *   ------ + --------------- + ---------------------------------------------
 *   W      | dodge_roll      | forward tuck-roll — head over heels, chin tucked
 *   S      | dodge_backflip  | back pike/layout flip — arms up, arched
 *   A / D  | dodge_sideroll  | lateral barrel-roll — a loose log-roll (re-aimed)
 *   none   | dodge_spin      | pivot spin — figure-skater pull-in, stays upright
 *
 * WHAT THIS SHELF OWNS vs WHAT THE RUNTIME OWNS.
 * The acrobatic tumble is a whole-body rotation about a HORIZONTAL axis (a roll
 * pitches head-over-heels; a barrel-roll spins about the fore-aft line). The rig
 * runtime today only orients the body group about world-Z (heading yaw), so the
 * tumble itself is a step-2 concern: a root-orientation channel in channels.js
 * driven by the platform rule's dodge state. THIS shelf owns the SHAPE the body
 * HOLDS while the root tumbles — the compact tuck/pike/pull-in silhouettes.
 * Author + eyes-gate the shapes on the vajra figure here; because `articulate`
 * (figure flesh) and `articulateTransforms` (suit bones) read the same dof, the
 * same poses bake straight onto a mobile suit via bakeUnitRig({ clips }).
 *
 * The `tumble` field records the intended root motion for step 2 (unused by the
 * bake): { axis: 'lateral'|'forward'|'vertical', turns, dir }. 'vertical' = the
 * existing heading yaw (the spin needs no new channel); 'lateral'/'forward' are
 * the new horizontal-axis root rotation.
 *
 * Poses are static held shapes for now (like UNIT_CLIPS' kneel/leap) — the
 * signature silhouette of each maneuver. Entry-coil / exit-extension arcs get
 * layered when the root tumble lands (so entering/leaving reads as a spring in
 * and a stick, not a pop). Sign conventions match figure-vajra `articulate`:
 * shoulder/hip +pitch = forward (→ overhead past ~90°), −pitch = swung behind;
 * knee/elbow = anatomical flex (0..cap); spine.sagittal + = forward-fold,
 * − = arch/extend; hinge = pelvic tip forward over the legs.
 */

// Airborne tumbles (roll/backflip/sideroll) are UNGROUNDED — sole-grounding
// would fight the tuck (the whole point is the feet leave the floor). The spin
// stays GROUNDED — it pirouettes on a planted foot.
export const DODGE_POSES = {
  // dodge_roll — forward tuck-roll (W). Fold the trunk hard over the thighs
  // (spine flex + pelvic hinge), draw the knees toward the chest (hip flex to
  // its cone cap + full knee fold), wrap the arms around the tuck (shoulders
  // forward, elbows deep), and bury the chin (neck + head nod). A compact ball
  // the lateral-axis root spin sends head over heels.
  dodge_roll: {
    ground: false,
    tumble: { axis: 'lateral', turns: 1, dir: 1 },
    pose: () => ({
      spine: { sagittal: 0.9 },
      hinge: 55,
      hipL: { pitch: 60 }, hipR: { pitch: 60 },
      kneeL: 145, kneeR: 145,
      shL: { pitch: 52, yaw: -8 }, shR: { pitch: 52, yaw: 8 },
      elbowL: 140, elbowR: 140,
      neck: { pitch: 34 }, head: { pitch: 26 },
    }),
  },

  // dodge_backflip — back pike/layout (S). The trunk ARCHES back (spine
  // extension), the legs trail slightly behind and stay long with a soft knee,
  // and the arms throw up-and-back overhead (the layout reach). The chin lifts
  // so the gaze rolls back with the flip. The lateral-axis root spin runs the
  // OPPOSITE way to the forward roll.
  dodge_backflip: {
    ground: false,
    tumble: { axis: 'lateral', turns: 1, dir: -1 },
    pose: () => ({
      spine: { sagittal: -0.55 },
      hipL: { pitch: -14 }, hipR: { pitch: -14 },
      kneeL: 24, kneeR: 24,
      shL: { pitch: 150, yaw: -6 }, shR: { pitch: 150, yaw: 6 },
      elbowL: 12, elbowR: 12,
      neck: { pitch: -22 }, head: { pitch: -16 },
    }),
  },

  // dodge_sideroll — lateral barrel-roll (A / D). A single symmetric clip
  // re-aimed by side (like boost_side). A LOOSER log-roll: a mild curl (not the
  // full forward ball), thighs up moderately, arms drawn in across the chest so
  // nothing windmills. The forward-axis (fore-aft) root spin rolls it sideways;
  // dir is set from which side was held at trigger time.
  dodge_sideroll: {
    ground: false,
    tumble: { axis: 'forward', turns: 1, dir: 1 },
    pose: () => ({
      spine: { sagittal: 0.4 },
      hinge: 22,
      hipL: { pitch: 46 }, hipR: { pitch: 46 },
      kneeL: 96, kneeR: 96,
      shL: { pitch: 42, yaw: -18 }, shR: { pitch: 42, yaw: 18 },
      elbowL: 118, elbowR: 118,
      neck: { pitch: 18 }, head: { pitch: 12 },
    }),
  },

  // dodge_spin — pivot spin (no direction held). Stays UPRIGHT: the "tumble" is
  // the existing heading yaw spun fast. The figure-skater read — pull everything
  // in tight to spin quick: a passe free leg (one knee tucked high), the planted
  // leg long, the arms wrapped across the chest, a slight coil into the turn
  // (spine axial). Grounded — it pirouettes on the planted foot.
  dodge_spin: {
    ground: true,
    tumble: { axis: 'vertical', turns: 2, dir: 1 },
    pose: () => ({
      spine: { sagittal: 0.12, axial: 0.35 },
      hipR: { pitch: 4 }, kneeR: 18,
      hipL: { pitch: 52, yaw: 22 }, kneeL: 124,
      shL: { pitch: 34, yaw: -26 }, shR: { pitch: 34, yaw: 26 },
      elbowL: 128, elbowR: 128,
      neck: { pitch: 6 },
    }),
  },

  // dodge_twirl — the BULKY-SUIT dodge. A suit too heavy to roll or flip can
  // still evade with a fast grounded PIVOT: BOTH legs stay planted (a wide,
  // knees-bent brace — weight low, feet spread for a stable spin), the torso
  // stays upright, and the arms sweep OUT to the sides as the whole body twirls
  // about the vertical axis. Unlike the acrobatic set this is one clip for ALL
  // directions (the rule's `dodge:'twirl'` mode) — the body spins in place while
  // the dash carries it the way the stick is held. GROUNDED + vertical tumble,
  // so nothing ever leaves the floor.
  dodge_twirl: {
    ground: true,
    tumble: { axis: 'vertical', turns: 1, dir: 1 },
    pose: () => ({
      spine: { sagittal: 0.14 },
      hipL: { yaw: 20, pitch: 6 }, hipR: { yaw: -20, pitch: 6 },   // wide planted brace
      kneeL: 34, kneeR: 34,                                        // knees bent, weight low
      shL: { pitch: 10, yaw: 42 }, shR: { pitch: 10, yaw: -42 },   // arms swept OUT to the sides
      elbowL: 26, elbowR: 26,
      neck: { pitch: 4 },
    }),
  },

  // dodge_airtwirl — the HOVER-SUIT dodge (toretto-type). Same all-directions
  // twirl role as dodge_twirl, but ACROBATIC and AERIAL because the suit already
  // floats: it does NOT plant to spin. Both legs draw up into a symmetric
  // airborne tuck (a hover unit has no planted foot to pirouette on), the arms
  // wrap IN tight for a fast figure-skater pull-in, and a slight axial coil
  // loads the turn. `ground:false` so the feet stay off the plane through the
  // whole spin — it reads as a mid-air pirouette-dash, not a braced pivot. The
  // rule's `dodge:'twirl'` mode drives it for every direction; bakeUnitRig swaps
  // it in for `dodge_twirl` on units that declare `locomotion:'hover'`.
  dodge_airtwirl: {
    ground: false,
    tumble: { axis: 'vertical', turns: 2, dir: 1 },
    pose: () => ({
      spine: { sagittal: 0.14, axial: 0.4 },
      hipL: { yaw: 8, pitch: 40 }, hipR: { yaw: -8, pitch: 40 },   // both knees drawn up — airborne tuck
      kneeL: 96, kneeR: 96,
      shL: { pitch: 26, yaw: -30 }, shR: { pitch: 26, yaw: 30 },   // arms wrapped in tight (pull-in spin)
      elbowL: 128, elbowR: 128,
      neck: { pitch: 8 },
    }),
  },
};
