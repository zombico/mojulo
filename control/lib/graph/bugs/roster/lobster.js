// AMERICAN LOBSTER (Homarus americanus). Thesis: a long low body in two halves — a CYLINDRICAL carapace (deeper than
// wide, a short pointed rostrum at its front, eyes on short stalks) and a longer segmented muscular TAIL (six broad
// rings) held straight out behind, ending in a flat splayed TAIL FAN · two big CLAWS (chelipeds) held FORWARD ahead of
// the face, each chela about as long as the carapace — in life UNEQUAL, a broad blunt crusher on one side and a slender
// cutter on the other · four pairs of slender walking legs under the carapace, the body carried low · the second
// antennae long whips swept back about the body's length · olive-green to brown-black. Average adult about 230 mm
// rostrum to telson (commonly 200–610 mm; NOAA Fisheries, "American Lobster" species page). Here `length` is the
// carapace front to the sixth tail ring (0.22 m); the tail fan adds ~0.03 m, so the whole animal is ~0.25 m. The
// forward claws and the long ringed tail with its fan carry the silhouette (not a crab: no broad shell, no sideways legs).
// This one is RIGHT-HANDED: the crusher on its right (`legs.fore.chela`), the cutter on its left (`legs.fore.left`).
export const bug = {
  order: 'Astacidea', name: 'an American lobster', length: 0.22, clearance: 0.05,
  head: 'fused',
  trunk: { form: 'cylinder', len: 0.45, w: 0.1, h: 0.115, r0: 0.45, peak: 0.7, r1: 0.85, p: 0.6, q: 0.8, belly: 0.8 },
  tail: { form: 'muscle', len: 0.55, w: 0.095, h: 0.075, segments: 6, dip: 0.16, r0: 0.95, peak: 0.12, r1: 0.6, p: 1, q: 0.8, pitch: -3 },
  legs: {
    form: 'crabwalker', socket: -60,
    fore: { form: 'cheliped', at: 0.35, yaw: 28, reach: 1, turn: { tibia: 10, tarsus: 5 },
      angles: { coxa: -10, femur: 35, tibia: 5, tarsus: -6 },
      femur: { len: 0.24, r: 0.035 }, tibia: { len: 0.11, r: 0.042 },
      chela: { palm: 0.26, r: 0.135, flat: 0.8, finger: 0.15, fr: 0.06, gape: 16 },   // RIGHT: the crusher (a right-handed lobster)
      left: { chela: { palm: 0.22, r: 0.062, flat: 0.65, finger: 0.28, fr: 0.026, gape: 24 } } },   // LEFT: the cutter
    mid: { femur: { len: 0.16, r: 0.02, flat: 0.7, thin: 'plane' }, tibia: { len: 0.15, r: 0.016 }, tarsus: { len: 0.1, r: 0.012, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 30, tibia: -45, tarsus: -60 } },
    hind: { femur: { len: 0.16, r: 0.02, flat: 0.7, thin: 'plane' }, tibia: { len: 0.15, r: 0.016 }, tarsus: { len: 0.1, r: 0.012, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 30, tibia: -45, tarsus: -60 } },
    each: [{}, { at: 0.55, yaw: 35 }, { at: 0.65, yaw: 10 }, { at: 0.75, yaw: -15 }, { at: 0.85, yaw: -40 }],
  },
  antennae: { form: 'peduncle', len: 0.95, r: 0.012, rise: 8, yaw: 35, curve: 25, flare: 110 },
  mouth: 'none',
  eyes: 'stalked',
  horns: [{ at: 0.95, len: 0.07, r: 0.014, rise: 4, bend: 0 }],
  extras: [{ kind: 'fan', len: 0.18, r: 0.11 }],
  colors: { body: '#3f4628', legs: '#55502e', claws: '#454a2a', eyes: '#141410', horn: '#3f4628' },
};
