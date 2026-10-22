// plating/regions — the PLATES of a powered suit as regions of the body's segments, in the segment's own coordinates
// (footwear/cobbler.js's: along 0 … 1 down the segment, around 0 at its front line … 1 at its back; the trunk's torso
// from the waist to the collar, its pelvis from the crotch to the hem; a limb from its top joint to its bottom one).
//   { seg, along: [a0, a1], around: [r0, r1], sides: 'centre' | 'both' | 'lateral' | 'medial', rows?, gap?, what }
// `both` is a matched pair (the trunk's left and right, a limb's lateral and medial); `rows` splits the region down its
// length into bands `gap` apart (the panel lines).
export const PLATE_REGIONS = Object.freeze({
  chest: { seg: 'torso', along: [0.56, 0.9], around: [0.02, 0.36], sides: 'both', what: 'the pectoral plates either side of the sternum' },
  abs: { seg: 'torso', along: [0.06, 0.5], around: [0.015, 0.2], sides: 'both', rows: 3, what: 'the abdominal plates, in rows either side of the centre line' },
  flank: { seg: 'torso', along: [0.12, 0.55], around: [0.26, 0.56], sides: 'both', what: 'the plates over the ribs at each side' },
  back: { seg: 'torso', along: [0.35, 0.9], around: [0.62, 0.985], sides: 'both', what: 'the shoulder-blade plates either side of the spine' },
  lumbar: { seg: 'torso', along: [0.06, 0.3], around: [0.7, 0.985], sides: 'both', rows: 2, what: 'the small of the back, in rows' },
  belt: { seg: 'pelvis', along: [0.8, 0.97], around: [0.02, 0.98], sides: 'both', what: 'the belt round the hips' },
  hip: { seg: 'pelvis', along: [0.42, 0.76], around: [0.3, 0.62], sides: 'both', what: 'the plates over the hips' },
  shoulder: { seg: 'upperArm', along: [0, 0.32], around: [0.12, 0.88], sides: 'lateral', what: 'the cap over the deltoid' },
  bicep: { seg: 'upperArm', along: [0.4, 0.88], around: [0.02, 0.45], sides: 'both', what: 'the upper arm\'s plates, front' },
  triceps: { seg: 'upperArm', along: [0.4, 0.88], around: [0.55, 0.98], sides: 'both', what: 'the upper arm\'s plates, back' },
  gauntlet: { seg: 'foreArm', along: [0.12, 0.92], around: [0.03, 0.97], sides: 'both', rows: 2, what: 'the forearm\'s shells, in two rows' },
  thigh: { seg: 'thigh', along: [0.08, 0.84], around: [0.02, 0.34], sides: 'both', rows: 2, what: 'the quadriceps plates' },
  thighOuter: { seg: 'thigh', along: [0.12, 0.8], around: [0.4, 0.66], sides: 'lateral', what: 'the plate down the outer thigh' },
  hamstring: { seg: 'thigh', along: [0.2, 0.84], around: [0.7, 0.98], sides: 'both', what: 'the plates down the back of the thigh' },
  shin: { seg: 'shank', along: [0.06, 0.9], around: [0.02, 0.4], sides: 'both', rows: 2, what: 'the shin guards' },
  calf: { seg: 'shank', along: [0.08, 0.66], around: [0.5, 0.98], sides: 'both', what: 'the calf plates' },
});
export const PLATE_SIDES = Object.freeze(['centre', 'both', 'lateral', 'medial']);
/** the trunk's segments (one each, not a pair of limbs) */
export const TRUNK = Object.freeze(['torso', 'pelvis']);
