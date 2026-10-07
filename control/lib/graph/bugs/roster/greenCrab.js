// EUROPEAN GREEN CRAB (Carcinus maenas). Thesis: a broad flat CARAPACE wider than long, saw-toothed at the front ·
// two big CLAWS (chelipeds) folded across the front of the face at rest · four pairs of pointed walking legs splayed sideways · eyes on short stalks
// · the abdomen folded flat underneath · dark green · carapace to 90 mm wide, about 60 mm long (Crothers, The Biology
// of the Shore Crab).
const WALK_YAW = [70, 38, 12, -16, -48];   // the walking pairs fan from forward-out to back-out (pair 0, the cheliped, sets its own)
export const bug = {
  order: 'Brachyura', name: 'a green crab', length: 0.06, clearance: 0.07,
  head: 'fused',
  trunk: { form: 'carapace', w: 0.78, h: 0.19, r0: 0.5, peak: 0.66, r1: 0.72, p: 0.6, q: 0.6, arch: 0.05 },
  tail: { form: 'tucked', pitch: -170, len: 0.3, w: 0.16, h: 0.03 },
  legs: {
    form: 'crabwalker', socket: -40,
    fore: { form: 'cheliped', yaw: 72, reach: 1, turn: { tibia: 50, tarsus: 30 }, angles: { coxa: -20, femur: 16, tibia: 4, tarsus: -2 },
      femur: { len: 0.34, r: 0.055 }, tibia: { len: 0.13, r: 0.06 },
      chela: { palm: 0.4, r: 0.12, flat: 1.15, finger: 0.28, fr: 0.06, gape: 34 } },
    // the walking legs root on the rear flanks, behind the chelipeds' corner
    each: [{ at: 0.2 }, { at: 0.42 }, { at: 0.56 }, { at: 0.7 }, { at: 0.83 }],
    mid: { yaw: WALK_YAW, femur: { len: 0.45, r: 0.06, flat: 0.5, thin: 'plane' }, tibia: { len: 0.36, r: 0.048, flat: 0.6, thin: 'plane' }, tarsus: { len: 0.24, r: 0.036, end: 0.06 }, tarsi: 2, angles: { coxa: -10, femur: 30, tibia: -20, tarsus: -62 } },
    hind: { yaw: WALK_YAW, femur: { len: 0.42, r: 0.06, flat: 0.5, thin: 'plane' }, tibia: { len: 0.34, r: 0.048, flat: 0.6, thin: 'plane' }, tarsus: { len: 0.24, r: 0.036, end: 0.06 }, tarsi: 2, angles: { coxa: -10, femur: 30, tibia: -20, tarsus: -62 } },
  },
  antennae: { form: 'setaceous', len: 0.08 }, mouth: 'none', eyes: 'stalked',
  colors: { body: '#4f5a2a', legs: '#5e6a32', claws: '#6d6a34', eyes: '#1a1a14' },
};
