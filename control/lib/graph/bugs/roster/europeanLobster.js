// EUROPEAN LOBSTER (Homarus gammarus). Thesis: the American lobster's bauplan — a CYLINDRICAL carapace with a short
// pointed rostrum and stalked eyes, a longer six-ringed muscular TAIL held straight out and ending in a splayed TAIL FAN,
// two big unequal CLAWS (a blunt crusher and a slender cutter) held forward, four pairs of slender walking legs under,
// the long antennal whips swept back — but told apart by COLOUR and PROPORTION: BLUE-BLACK above (dark navy) with a
// PALE-YELLOW / cream underside (the American is olive-green to brown, no pale belly), a slightly more SLENDER build
// (narrower carapace and tail, the claws a little smaller and less swollen), and in life no spines on the rostrum's
// underside (below the model's resolution). Caught adults are usually 230–380 mm long (rostrum to telson), up to 600 mm
// and 5–6 kg (Wikipedia, "Homarus gammarus", citing MarLIN / FAO species fact sheet). Here `length` is the carapace
// front to the sixth tail ring (0.30 m); the tail fan adds ~0.04 m, so the whole animal is ~0.34 m. Right-handed: the
// crusher on its right (`legs.fore.chela`), the cutter on its left (`legs.fore.left`).
export const bug = {
  order: 'Astacidea', name: 'a European lobster', length: 0.30, clearance: 0.05,
  head: 'fused',
  trunk: { form: 'cylinder', len: 0.44, w: 0.085, h: 0.1, r0: 0.45, peak: 0.7, r1: 0.85, p: 0.6, q: 0.8, belly: 0.8 },
  tail: { form: 'muscle', len: 0.56, w: 0.08, h: 0.065, segments: 6, dip: 0.16, r0: 0.95, peak: 0.12, r1: 0.6, p: 1, q: 0.8, pitch: -3 },
  legs: {
    form: 'crabwalker', socket: -60,
    fore: { form: 'cheliped', at: 0.35, yaw: 26, reach: 1, turn: { tibia: 10, tarsus: 5 },
      angles: { coxa: -10, femur: 35, tibia: 5, tarsus: -6 },
      femur: { len: 0.24, r: 0.03 }, tibia: { len: 0.11, r: 0.036 },
      chela: { palm: 0.27, r: 0.11, flat: 0.75, finger: 0.16, fr: 0.05, gape: 16 },   // RIGHT: the crusher
      left: { chela: { palm: 0.23, r: 0.052, flat: 0.65, finger: 0.29, fr: 0.022, gape: 24 } } },   // LEFT: the cutter
    mid: { femur: { len: 0.16, r: 0.017, flat: 0.7, thin: 'plane' }, tibia: { len: 0.15, r: 0.014 }, tarsus: { len: 0.1, r: 0.01, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 30, tibia: -45, tarsus: -60 } },
    hind: { femur: { len: 0.16, r: 0.017, flat: 0.7, thin: 'plane' }, tibia: { len: 0.15, r: 0.014 }, tarsus: { len: 0.1, r: 0.01, end: 0.2 }, tarsi: 2, angles: { coxa: -15, femur: 30, tibia: -45, tarsus: -60 } },
    each: [{}, { at: 0.55, yaw: 35 }, { at: 0.65, yaw: 10 }, { at: 0.75, yaw: -15 }, { at: 0.85, yaw: -40 }],
  },
  antennae: { form: 'peduncle', len: 0.95, r: 0.011, rise: 8, yaw: 35, curve: 25, flare: 110 },
  mouth: 'none',
  eyes: 'stalked',
  horns: [{ at: 0.95, len: 0.07, r: 0.012, rise: 4, bend: 0 }],
  extras: [{ kind: 'fan', len: 0.18, r: 0.1 }],
  markings: [
    { on: 'trunk', kind: 'band', run: [0, 1], t: [0.55, 1], group: 'Belly', color: '#d8c98a' },
    { on: 'tail', kind: 'band', run: [0, 1], t: [0.55, 1], group: 'Belly' },
    { on: 'leg0Palm', kind: 'band', run: [0, 1], t: [0.55, 1], group: 'Belly' },
  ],
  colors: { body: '#1d2c4f', legs: '#2e4170', claws: '#22325a', eyes: '#0c0c10', horn: '#1d2c4f', antennae: '#7a5a3a' },
};
