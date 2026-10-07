// NORWAY LOBSTER / LANGOUSTINE (Nephrops norvegicus). Thesis: a SLENDER little clawed lobster — a narrow cylindrical
// carapace (about a third of the body, a long spiny pointed ROSTRUM at its front) and a longer, slimmer segmented TAIL
// (six rings) held straight out, ending in a TAIL FAN · two LONG, THIN, PRISMATIC CLAWS held forward, nearly EQUAL, each
// chela long and narrow (palm and fingers together about as long as the carapace, the whole cheliped about the body's
// length) — slender ridged bars, not a crusher's club · BIG BLACK KIDNEY-SHAPED EYES on short stalks at the carapace
// front, large for the animal · four pairs of slender walking legs, the body carried low · the second antennae thin
// whips about the body's length · pale orange-pink. Size: total length usually 18–20 cm, at most 24 cm (Holthuis 1991,
// FAO Species Catalogue vol. 13 "Marine Lobsters of the World", Nephrops norvegicus). Here `length` is the carapace
// front (without the rostrum) to the sixth tail ring (0.17 m); the fan adds ~0.02 m. Not an American / European lobster
// (slender, the claws long and thin, not heavy and unequal), not a crayfish (the long thin claws, the big eyes), not a
// shrimp (it has big claws).
export const bug = {
  order: 'Astacidea', name: 'a Norway lobster', length: 0.17, clearance: 0.05,
  head: 'fused',
  trunk: { form: 'cylinder', len: 0.4, w: 0.08, h: 0.085, r0: 0.5, peak: 0.55, r1: 0.8, p: 0.6, q: 0.8, belly: 0.8 },
  tail: { form: 'muscle', len: 0.6, w: 0.08, h: 0.065, segments: 6, dip: 0.16, r0: 0.95, peak: 0.12, r1: 0.6, p: 1, q: 0.8, pitch: -3 },
  legs: {
    form: 'crabwalker', socket: -60,
    // the chelipeds: long thin merus and carpus, then a long narrow prismatic chela (equal sides)
    fore: { form: 'cheliped', at: 0.35, yaw: 38, reach: 1, turn: { tibia: 18, tarsus: 10 },
      angles: { coxa: -10, femur: 30, tibia: 6, tarsus: -4 },
      femur: { len: 0.3, r: 0.02, flat: 0.8 }, tibia: { len: 0.13, r: 0.02 },
      chela: { palm: 0.26, r: 0.036, flat: 0.8, finger: 0.24, fr: 0.016, gape: 10 } },
    mid: { femur: { len: 0.15, r: 0.016, flat: 0.7, thin: 'plane' }, tibia: { len: 0.14, r: 0.012 }, tarsus: { len: 0.09, r: 0.009, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 30, tibia: -45, tarsus: -60 } },
    hind: { femur: { len: 0.15, r: 0.016, flat: 0.7, thin: 'plane' }, tibia: { len: 0.14, r: 0.012 }, tarsus: { len: 0.09, r: 0.009, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 30, tibia: -45, tarsus: -60 } },
    each: [{}, { at: 0.55, yaw: 35 }, { at: 0.65, yaw: 10 }, { at: 0.75, yaw: -15 }, { at: 0.85, yaw: -40 }],
  },
  antennae: { form: 'peduncle', len: 1.0, r: 0.009, rise: 8, yaw: 35, curve: 25, flare: 100 },
  mouth: 'none',
  // big black kidney eyes on short stalks
  eyes: { form: 'stalked', stalk: 0.15, size: 0.5, at: 0.95, elev: 45, yaw: 35, rise: 40 },
  // the long pointed rostrum
  horns: [{ at: 0.95, len: 0.2, r: 0.012, rise: 10, bend: 0 }],
  extras: [{ kind: 'fan', len: 0.15, r: 0.09 }],
  colors: { body: '#e39a80', legs: '#eaa98c', claws: '#e08e70', eyes: '#141410', horn: '#e39a80', antennae: '#e8a080' },
};
