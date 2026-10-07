// RED SWAMP CRAYFISH (Procambarus clarkii). Thesis: a SMALL freshwater lobster-shape, but not a lobster — a deep
// CYLINDRICAL carapace that is about HALF the body (proportionally longer and deeper than a lobster's) crossed by a
// clear CERVICAL GROOVE, a pointed rostrum between stalked eyes, a SHORTER six-ringed tail ending in a broad tail fan ·
// two EQUAL claws held forward, LONG and NARROW (palm and fingers slender, not a lobster's swollen crusher), studded
// with raised bumps (tubercles; no bump geometry in the builder, and a palm marking breaks the order matcher, see
// the report: the claws are only a brighter red) · four pairs of walking legs, a little longer against the body, the body carried a little
// higher · antennae about the body's length · DEEP RED all over (dark red-brown to bright red; the claws' tubercles
// brighter red). Adults are typically 55–120 mm long, rostrum to telson (Wikipedia, "Procambarus clarkii"; CABI
// Invasive Species Compendium). Here `length` is the carapace front to the sixth tail ring (0.085 m); the fan adds
// ~0.012 m, so the whole animal is ~0.10 m. The equal long red claws, the deep grooved carapace and the short tail tell
// it from the lobsters (unequal claws, long tail, olive or navy).
export const bug = {
  order: 'Astacidea', name: 'a red swamp crayfish', length: 0.085, clearance: 0.1,
  head: 'fused',
  // two segments only to draw the CERVICAL GROOVE (the dip between them); the five leg pairs all sit on the rear one
  trunk: { form: 'cylinder', len: 0.55, w: 0.105, h: 0.16, segments: 2, split: [0.42, 0.58], dip: 0.22, legsPer: 5, legFrom: 1, legTo: 1,
    r0: 0.3, peak: 0.65, r1: 0.85, p: 0.6, q: 0.8, belly: 0.8, samplesPerSeg: 2 },
  tail: { form: 'muscle', len: 0.4, w: 0.085, h: 0.07, segments: 6, dip: 0.16, r0: 0.92, peak: 0.12, r1: 0.6, p: 1, q: 0.8, pitch: -4 },
  legs: {
    form: 'crabwalker', socket: -60,
    fore: { form: 'cheliped', at: 0.35, yaw: 36, reach: 1, turn: { tibia: 10, tarsus: 5 },
      angles: { coxa: -10, femur: 38, tibia: 5, tarsus: -6 },
      femur: { len: 0.22, r: 0.03 }, tibia: { len: 0.1, r: 0.034 },
      chela: { palm: 0.3, r: 0.062, flat: 0.7, finger: 0.24, fr: 0.026, gape: 18 } },   // EQUAL, long and narrow
    mid: { femur: { len: 0.21, r: 0.018, flat: 0.7, thin: 'plane' }, tibia: { len: 0.2, r: 0.015 }, tarsus: { len: 0.12, r: 0.011, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 32, tibia: -45, tarsus: -60 } },
    hind: { femur: { len: 0.21, r: 0.018, flat: 0.7, thin: 'plane' }, tibia: { len: 0.2, r: 0.015 }, tarsus: { len: 0.12, r: 0.011, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 32, tibia: -45, tarsus: -60 } },
    each: [{}, { at: 0.55, yaw: 35 }, { at: 0.65, yaw: 10 }, { at: 0.75, yaw: -15 }, { at: 0.85, yaw: -40 }],
  },
  antennae: { form: 'peduncle', len: 1.1, r: 0.012, rise: 10, yaw: 35, curve: 25, flare: 100 },
  mouth: 'none',
  eyes: 'stalked',
  horns: [{ at: 0.95, len: 0.1, r: 0.014, rise: 4, bend: 0 }],
  extras: [{ kind: 'fan', len: 0.16, r: 0.12 }],
  markings: [
    { on: 'trunk', kind: 'band', run: [0.565, 0.58], t: [0, 0.62], group: 'Groove', color: '#3a0a06' },
  ],
  colors: { body: '#7a1610', legs: '#8a1d14', claws: '#a3201a', eyes: '#141010', horn: '#7a1610', antennae: '#6a1a12' },
};
