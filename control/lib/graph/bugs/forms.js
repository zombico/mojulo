// The PART FORMS: named parameter bundles for each kind of part, shared across every taxon that wears them. A form is
// a common denominator of SHAPE, not of family: the walking leg a fly and a bee both stand on is one form; the jumping
// leg is one form whether a grasshopper, a flea beetle or a leafhopper wears it. A bug (species.js) picks a form per
// part and overrides any number of its fields. Every length is a SHARE OF BODY LENGTH (head front to tail tip); every
// angle is degrees. build.js reads these.

/** BODY SECTIONS: a section is one profiled loft (ring.js `profile`: r0 → 1 at peak → r1 along its length) of
 * `len` × half-width `w` × half-height `h`, with `segments` visible rings (`dip` the share each boundary pinches in). */
export const HEAD_FORMS = {
  // face down, mouth under (grasshopper, bee, wasp, fly, cockroach, mantis)
  hypognathous: { len: 0.17, w: 0.085, h: 0.08, pitch: -62, lift: 0.025, r0: 0.75, peak: 0.42, r1: 0.55, p: 1, q: 1.3, overlap: 0.18 },
  // face forward, mouth in front (beetles, ants, earwigs, ground beetles, centipedes)
  prognathous: { len: 0.17, w: 0.085, h: 0.06, pitch: -8, lift: 0, r0: 0.8, peak: 0.4, r1: 0.6, p: 1, q: 1, overlap: 0.15 },
  // face down and back, beak along the chest (true bugs, cicadas, aphids, leafhoppers)
  opisthognathous: { len: 0.14, w: 0.09, h: 0.065, pitch: -80, lift: 0.015, r0: 0.8, peak: 0.45, r1: 0.6, p: 1, q: 1.2, overlap: 0.18 },
  // a round head carried at the front, the eyes much of it (dragonflies, flies, damselflies)
  globe: { len: 0.13, w: 0.1, h: 0.085, pitch: -20, lift: 0.01, r0: 0.7, peak: 0.45, r1: 0.55, p: 0.8, q: 0.8, overlap: 0.2 },
  // no head section: eyes, mouth and palps sit on the trunk's front (spiders, harvestmen, mites)
  fused: null,
};

/** THE TRUNK: the REPEATED middle of the body, `segments` metameres each carrying `legsPer` leg pairs (from segment
 * `legFrom`, 0-based, to `legTo`). An insect's thorax is three segments of one pair; a centipede's trunk fifteen of one;
 * a millipede's thirty of two; a spider's cephalothorax one segment carrying four. `split` (optional) gives each
 * segment its share of the trunk (default equal). */
export const TRUNK_FORMS = {
  // bee, fly, wasp: a ball of flight muscle, the middle segment the big one
  compact: { len: 0.27, w: 0.1, h: 0.1, segments: 3, legsPer: 1, split: [0.22, 0.53, 0.25], dip: 0.04, r0: 0.62, peak: 0.45, r1: 0.62, p: 0.8, q: 0.8, arch: 0.01 },
  // beetle, cockroach, true bug: a broad flat-topped thorax under a pronotum plate
  shield: { len: 0.3, w: 0.13, h: 0.085, segments: 3, legsPer: 1, split: [0.4, 0.3, 0.3], dip: 0.03, r0: 0.75, peak: 0.55, r1: 0.88, p: 0.8, q: 0.6 },
  // grasshopper, cricket: a deep thorax under a saddle pronotum
  saddle: { len: 0.28, w: 0.075, h: 0.095, segments: 3, legsPer: 1, split: [0.36, 0.3, 0.34], dip: 0.02, r0: 0.8, peak: 0.6, r1: 0.88, p: 0.8, q: 0.6 },
  // ant (mesosoma), wasp waist bodies: a slim thorax, wider in front
  slim: { len: 0.32, w: 0.055, h: 0.06, segments: 3, legsPer: 1, split: [0.32, 0.4, 0.28], dip: 0.12, r0: 0.75, peak: 0.25, r1: 0.6, p: 0.8, q: 1 },
  // mantis, stick insect: a long thin prothorax ahead of the leg-bearing rest
  long: { len: 0.42, w: 0.04, h: 0.045, segments: 3, legsPer: 1, split: [0.55, 0.23, 0.22], dip: 0.05, r0: 0.7, peak: 0.85, r1: 0.95, p: 1, q: 0.6 },
  // dragonfly, damselfly: a deep thorax slanted back, the legs bunched forward
  slanted: { len: 0.17, w: 0.075, h: 0.095, segments: 3, legsPer: 1, split: [0.2, 0.4, 0.4], dip: 0.03, r0: 0.65, peak: 0.55, r1: 0.7, p: 0.8, q: 0.8 },
  // spider, harvestman, mite: ONE fused segment carrying four pairs
  cephalothorax: { len: 0.42, w: 0.17, h: 0.09, segments: 1, legsPer: 4, dip: 0, r0: 0.6, peak: 0.45, r1: 0.55, p: 0.7, q: 0.8, arch: 0.02 },
  // centipede: many flat segments of one pair each
  centipede: { len: 0.82, w: 0.055, h: 0.022, segments: 15, legsPer: 1, dip: 0.18, r0: 0.85, peak: 0.5, r1: 0.8, p: 0.4, q: 0.4 },
  // millipede: many round segments of two pairs each (the first few of one, set legsPer by segment with `legPairs`)
  millipede: { len: 0.88, w: 0.04, h: 0.04, segments: 30, legsPer: 2, legFrom: 3, dip: 0.12, r0: 0.9, peak: 0.5, r1: 0.85, p: 0.3, q: 0.3 },
  // scorpion (prosoma): a fused head-trunk, four walking pairs, the pedipalps (palps) at its front
  prosoma: { len: 0.4, w: 0.12, h: 0.06, segments: 1, legsPer: 4, dip: 0, r0: 0.6, peak: 0.6, r1: 0.75, p: 0.8, q: 0.8, samples: 8 },
  // crab: a broad flat CARAPACE carrying five pairs (the first the chelipeds)
  carapace: { len: 0.95, w: 0.72, h: 0.2, segments: 1, legsPer: 5, dip: 0, r0: 0.35, peak: 0.55, r1: 0.6, p: 0.55, q: 0.7, arch: 0.04, samples: 10 },
  // lobster, crayfish: a long cylindrical carapace carrying five pairs
  cylinder: { len: 0.45, w: 0.1, h: 0.1, segments: 1, legsPer: 5, dip: 0, r0: 0.55, peak: 0.6, r1: 0.7, p: 0.7, q: 0.8, samples: 10 },
  // woodlouse (pereon): seven broad plates of one pair each, domed
  isopod: { len: 0.6, w: 0.27, h: 0.1, segments: 7, legsPer: 1, dip: 0.08, r0: 0.9, peak: 0.5, r1: 0.85, p: 0.5, q: 0.5 },
};

/** THE TAIL: the section behind the trunk (an insect's abdomen, a spider's opisthosoma, a millipede's telson).
 * `pitch` lifts (+) or drops (−) its axis; `waist` (optional) is a narrow stalk to it (an ant's petiole, a wasp's). */
export const TAIL_FORMS = {
  oval: { len: 0.45, w: 0.12, h: 0.1, segments: 6, dip: 0.06, r0: 0.6, peak: 0.35, r1: 0.12, p: 0.8, q: 1.2, pitch: -6 },
  tapered: { len: 0.5, w: 0.1, h: 0.09, segments: 7, dip: 0.04, r0: 0.75, peak: 0.25, r1: 0.12, p: 0.8, q: 1.4, pitch: -2 },
  long: { len: 0.7, w: 0.035, h: 0.035, segments: 10, dip: 0.08, r0: 0.9, peak: 0.08, r1: 0.65, p: 1, q: 0.3, pitch: 0 },
  // ant, wasp: a stalk then a gaster
  gaster: { len: 0.36, w: 0.11, h: 0.1, segments: 5, dip: 0.07, r0: 0.45, peak: 0.4, r1: 0.18, p: 0.8, q: 1.2, pitch: -10, waist: { len: 0.08, r: 0.018, node: 0.04 } },
  // spider, tick: a round sac
  sac: { len: 0.55, w: 0.22, h: 0.2, segments: 1, dip: 0, r0: 0.35, peak: 0.45, r1: 0.25, p: 0.7, q: 0.8, pitch: 10, waist: { len: 0.03, r: 0.025 } },
  // beetle, ladybird: hidden under the elytra, broad and flat
  flat: { len: 0.45, w: 0.14, h: 0.07, segments: 5, dip: 0.03, r0: 0.9, peak: 0.3, r1: 0.25, p: 0.8, q: 1, pitch: 0 },
  // millipede, centipede: a short end piece
  telson: { len: 0.05, w: 0.035, h: 0.025, segments: 1, dip: 0, r0: 0.95, peak: 0.1, r1: 0.4, p: 1, q: 1, pitch: 0 },
  // scorpion (mesosoma): seven broad plates, the metasoma (an extra) curling up off its end
  mesosoma: { len: 0.6, w: 0.14, h: 0.06, segments: 7, dip: 0.06, r0: 0.95, peak: 0.35, r1: 0.4, p: 0.6, q: 1, pitch: 0 },
  // horseshoe crab: ONE fused rear plate, flat and tapering
  opisthosoma: { len: 0.4, w: 0.3, h: 0.08, segments: 1, dip: 0, r0: 0.95, peak: 0.15, r1: 0.4, p: 1, q: 0.9, pitch: 0, samples: 8 },
  // crab: the abdomen folded flat under the carapace, a small plate
  tucked: { len: 0.12, w: 0.18, h: 0.04, segments: 1, dip: 0, r0: 0.9, peak: 0.2, r1: 0.6, p: 1, q: 1, pitch: -20 },
  // lobster, crayfish, shrimp: a segmented muscular tail ending in the fan (an extra)
  muscle: { len: 0.5, w: 0.09, h: 0.075, segments: 6, dip: 0.07, r0: 0.95, peak: 0.15, r1: 0.55, p: 1, q: 0.8, pitch: -4 },
  // woodlouse (pleon): short tapering plates
  pleon: { len: 0.2, w: 0.2, h: 0.07, segments: 5, dip: 0.06, r0: 0.95, peak: 0.05, r1: 0.4, p: 1, q: 0.9, pitch: 0 },
};

/** LEGS as MANJI CHAINS of PIECES: a leg is a planar chain of bars (coxa, femur, tibia, tarsus) in a vertical plane
 * turned `yaw` degrees about z at its socket (0 = straight out, + forward, − back; a list grades it over the pairs front
 * to back). Each bar has an absolute angle in that plane (0 = outward level, + up, − down) — the bent bars of a manji —
 * and is a PIECE (pieces.js): { len, r (base half-width), shape: carrot | banana | chili | bulb, end, flat, bend, thin:
 * 'plane' (the thin side across the leg's plane, a laterally compressed femur) | 'up' (thin top to bottom, an oar) }.
 * A GROUNDED leg's tibia angle is SOLVED so the tarsus lies on the ground (`knee: 'out'` the tibia continues outward,
 * 'in' it folds back toward the body, the jumping leg's Z); `ground: false` keeps every angle as given (a raised
 * grasping leg, a palp, a cheliped). The tarsus is `tarsi` carrots ending in a pair of chili claws (`claws`); a
 * `chela` ends the leg in a palm (a bulb) and two banana fingers instead. Lengths and radii are shares of body length. */
const bar = (len, r, end = 0.7, more = {}) => ({ len, r, end, shape: 'carrot', ...more });
export const LEG_FORMS = {
  // bee, fly, wasp, ant, beetle, bug: the general-purpose walking leg
  walker: { coxa: bar(0.05, 0.02, 0.8), femur: bar(0.2, 0.018, 0.75, { bend: 0.04 }), tibia: bar(0.2, 0.013, 0.85, { bend: -0.03 }), tarsus: { len: 0.16, r: 0.008, end: 0.8 }, tarsi: 5, claws: { len: 0.025, r: 0.004 }, angles: { coxa: -50, femur: 15, tibia: -58, tarsus: -4 }, knee: 'out', yaw: [42, -6, -40] },
  // cockroach, ground beetle, tiger beetle: long, spread, low
  runner: { coxa: bar(0.07, 0.025, 0.75), femur: bar(0.26, 0.022, 0.65), tibia: bar(0.3, 0.014, 0.7), tarsus: { len: 0.22, r: 0.008, end: 0.75 }, tarsi: 5, claws: { len: 0.02, r: 0.004 }, angles: { coxa: -55, femur: 10, tibia: -42, tarsus: -3 }, knee: 'out', yaw: [50, -15, -55] },
  // grasshopper, cricket, flea beetle, leafhopper, flea (hind): a drumstick femur along the flank, the tibia folded under it
  jumper: { coxa: bar(0.04, 0.03, 0.8), femur: bar(0.5, 0.065, 0.3, { flat: 0.5, thin: 'plane', taper: 1.4, bend: 0.03 }), tibia: bar(0.48, 0.012, 0.75), tarsus: { len: 0.13, r: 0.009, end: 0.8 }, tarsi: 3, claws: { len: 0.02, r: 0.004 }, angles: { coxa: -70, femur: 26, tibia: -62, tarsus: -2 }, knee: 'in', yaw: -84 },
  // mantis, mantisfly, assassin bug (fore): a long coxa forward, a spiny banana femur up, the tibia jackknifed back on it
  grasper: { coxa: bar(0.13, 0.016, 0.7), femur: { len: 0.2, r: 0.026, shape: 'banana', flat: 0.6, thin: 'plane', bend: 0.08 }, tibia: { len: 0.12, r: 0.012, shape: 'banana', flat: 0.6, thin: 'plane', bend: -0.12 }, tarsus: { len: 0.07, r: 0.005, end: 0.7 }, tarsi: 4, claws: null, angles: { coxa: -55, femur: 70, tibia: -110, tarsus: -150 }, ground: false, yaw: 72 },
  // mole cricket, scarab, cicada nymph (fore): short broad shovels
  digger: { coxa: bar(0.04, 0.025, 0.8), femur: bar(0.13, 0.03, 0.75, { flat: 0.7 }), tibia: { len: 0.12, r: 0.035, shape: 'bulb', peak: 0.75, r0: 0.4, end: 0.8, flat: 0.35, thin: 'plane' }, tarsus: { len: 0.06, r: 0.008, end: 0.7 }, tarsi: 3, claws: { len: 0.02, r: 0.005 }, angles: { coxa: -60, femur: 10, tibia: -45, tarsus: -32 }, knee: 'out', yaw: 50 },   // a steep tarsus lifts the broad tibia's end off the ground
  // diving beetle, backswimmer (hind): flattened oars swept back
  swimmer: { coxa: bar(0.06, 0.03, 0.75), femur: bar(0.2, 0.02, 0.7, { flat: 0.55, thin: 'up' }), tibia: { len: 0.18, r: 0.025, shape: 'bulb', peak: 0.7, r0: 0.4, end: 0.8, flat: 0.3, thin: 'up' }, tarsus: { len: 0.2, r: 0.025, end: 0.6, flat: 0.25, thin: 'up' }, tarsi: 1, claws: null, angles: { coxa: -50, femur: 5, tibia: -30, tarsus: -2 }, knee: 'out', yaw: -70 },
  // mosquito, crane fly, harvestman: very long and thin, the body slung between knees
  stilt: { coxa: bar(0.06, 0.012, 0.8), femur: bar(0.6, 0.008, 0.75), tibia: bar(0.7, 0.006, 0.8), tarsus: { len: 0.75, r: 0.004, end: 0.6 }, tarsi: 5, claws: null, angles: { coxa: -50, femur: 42, tibia: -72, tarsus: -12 }, knee: 'out', yaw: [55, -5, -55] },
  // spiders, scorpions' walking legs: thick high-kneed legs (femur, patella + tibia, metatarsus + tarsus)
  spider: { coxa: bar(0.06, 0.035, 0.8), femur: bar(0.36, 0.03, 0.8, { bend: 0.05 }), tibia: bar(0.42, 0.024, 0.75, { bend: -0.03 }), tarsus: { len: 0.28, r: 0.016, end: 0.6 }, tarsi: 2, claws: { len: 0.03, r: 0.006 }, angles: { coxa: -25, femur: 50, tibia: -68, tarsus: -28 }, knee: 'out', yaw: [55, 22, -18, -50] },
  // ladybird, weevil, tortoise beetle: short legs tucked under a dome
  tucked: { coxa: bar(0.04, 0.025, 0.8), femur: bar(0.14, 0.022, 0.75), tibia: bar(0.14, 0.016, 0.8), tarsus: { len: 0.09, r: 0.012, end: 0.8 }, tarsi: 3, claws: { len: 0.02, r: 0.004 }, angles: { coxa: -60, femur: 5, tibia: -60, tarsus: -6 }, knee: 'out', yaw: [40, -5, -40] },
  // centipede, millipede, woodlouse: many short legs; centipedes long and spread, millipedes short and under
  manyfoot: { coxa: bar(0.012, 0.008, 0.8), femur: bar(0.05, 0.006, 0.8), tibia: bar(0.05, 0.005, 0.7), tarsus: { len: 0.03, r: 0.004, end: 0.4 }, tarsi: 1, claws: null, angles: { coxa: -60, femur: 20, tibia: -55, tarsus: -15 }, knee: 'out', yaw: [30, -30] },
  // crab, lobster, scorpion pedipalp: a CHELA held forward off the ground — merus, carpus, then a palm and two fingers
  cheliped: { coxa: bar(0.05, 0.04, 0.8), femur: bar(0.2, 0.04, 0.8, { flat: 0.75 }), tibia: bar(0.1, 0.045, 0.9), tarsus: null, chela: { palm: 0.2, r: 0.07, flat: 0.6, finger: 0.17, fr: 0.03, gape: 22 }, claws: null, angles: { coxa: -30, femur: 25, tibia: 55, tarsus: 10 }, ground: false, yaw: 60 },
  // crab, lobster walking legs: flattened merus, a pointed dactyl (a carrot to a point), splayed and high-kneed
  crabwalker: { coxa: bar(0.06, 0.04, 0.8), femur: bar(0.55, 0.04, 0.8, { flat: 0.55, thin: 'plane', bend: 0.05 }), tibia: bar(0.42, 0.032, 0.8, { flat: 0.6, thin: 'plane' }), tarsus: { len: 0.36, r: 0.026, end: 0.15 }, tarsi: 2, claws: null, angles: { coxa: -10, femur: 30, tibia: -62, tarsus: -55 }, knee: 'out', yaw: [35, 5, -20, -45] },
  // a palp or a reduced leg held up off the ground (spider pedipalp, butterfly foreleg)
  palp: { coxa: bar(0.03, 0.02, 0.8), femur: bar(0.1, 0.016, 0.85), tibia: bar(0.08, 0.014, 0.85), tarsus: { len: 0.06, r: 0.014, end: 0.6 }, tarsi: 1, claws: null, angles: { coxa: -30, femur: 30, tibia: -40, tarsus: -70 }, ground: false, yaw: 60 },
};

/** ANTENNAE: a CHAIN of `segs` carrots per side from a socket on the head's front, the chain bent `curve` degrees along
 * its length (down) and `flare` out; each segment's radius from the form's `shape` knots ([u, share], linear between).
 * `bead` makes each segment a bulb (moniliform); `elbow` (geniculate) turns the chain at segment `at` by `deg`; `scape`
 * is the first segment's share of the length; `comb` adds side teeth (pectinate / plumose); `plates` a fan at the tip
 * (lamellate); `bristle` a fine hair off a short stub (aristate). */
export const ANTENNA_FORMS = {
  filiform: { len: 0.45, r: 0.008, segs: 11, shape: [[0, 1.2], [0.1, 1], [1, 0.75]], rise: 35, yaw: 25, curve: 30 },
  setaceous: { len: 0.12, r: 0.006, segs: 6, shape: [[0, 1.4], [0.2, 0.9], [1, 0.25]], rise: 30, yaw: 30, curve: 5 },
  whip: { len: 1.15, r: 0.006, segs: 24, shape: [[0, 1.4], [0.06, 1], [1, 0.3]], rise: 25, yaw: 22, curve: 75 },
  moniliform: { len: 0.35, r: 0.009, segs: 11, bead: true, shape: [[0, 1.2], [1, 1]], rise: 30, yaw: 25, curve: 25 },
  clavate: { len: 0.3, r: 0.006, segs: 11, shape: [[0, 1.2], [0.55, 0.9], [0.85, 1.8], [1, 1.6]], rise: 30, yaw: 30, curve: 15 },
  capitate: { len: 0.6, r: 0.005, segs: 16, shape: [[0, 1.2], [0.08, 0.9], [0.8, 1], [0.9, 2.6], [1, 2]], rise: 45, yaw: 20, curve: 8 },
  geniculate: { len: 0.42, r: 0.008, segs: 12, scape: 0.34, shape: [[0, 1.1], [0.34, 0.9], [0.36, 1.1], [0.9, 1.15], [1, 0.9]], rise: 50, yaw: 20, curve: 10, elbow: { at: 1, deg: 85 } },
  pectinate: { len: 0.4, r: 0.007, segs: 12, shape: [[0, 1.2], [1, 0.5]], rise: 35, yaw: 35, curve: 25, comb: { count: 9, len: 0.05, r: 0.003, from: 0.15 } },
  plumose: { len: 0.35, r: 0.007, segs: 12, shape: [[0, 1.2], [1, 0.5]], rise: 35, yaw: 30, curve: 20, comb: { count: 12, len: 0.08, r: 0.0025, from: 0.1, both: true } },
  lamellate: { len: 0.22, r: 0.007, segs: 8, shape: [[0, 1.2], [0.7, 0.9], [1, 0.9]], rise: 20, yaw: 40, curve: 20, plates: { count: 3, len: 0.07, w: 0.03 } },
  aristate: { len: 0.07, r: 0.012, segs: 3, shape: [[0, 0.8], [0.5, 1.2], [1, 1]], rise: -30, yaw: 20, curve: 10, bristle: { len: 0.08, r: 0.002 } },
  // crustacean second antenna: a long whip off a thick peduncle
  peduncle: { len: 1.0, r: 0.012, segs: 20, scape: 0.18, shape: [[0, 1.6], [0.18, 1.2], [0.2, 0.6], [1, 0.15]], rise: 15, yaw: 30, curve: 40, flare: 30 },
};

/** MOUTHPARTS at the head's mouth (its front tip), as pieces: mandibles are BANANAS (flat crescents curving in), fangs
 * and forcipules CHILIS, a beak or a stylet a long CARROT. */
export const MOUTH_FORMS = {
  mandibles: { kind: 'mandibles', len: 0.06, r: 0.014, shape: 'banana', flat: 0.5, bend: 0.25, spread: 18 },
  tusks: { kind: 'mandibles', len: 0.4, r: 0.035, shape: 'banana', flat: 0.45, bend: 0.22, spread: 28, tooth: 0.45 },   // stag beetle
  coiled: { kind: 'coil', len: 0.5, r: 0.006, turns: 2.2 },        // butterfly, moth proboscis
  stylet: { kind: 'needle', len: 0.5, r: 0.007, end: 0.2, pitch: -30 },      // mosquito
  beak: { kind: 'needle', len: 0.35, r: 0.013, end: 0.25, pitch: -160 },      // true bugs, cicadas: the rostrum along the chest
  sponge: { kind: 'needle', len: 0.1, r: 0.014, end: 0.8, pitch: -95, pad: 0.03 },   // house fly labellum
  snout: { kind: 'needle', len: 0.3, r: 0.028, end: 0.7, pitch: -40, pad: 0 },        // weevil rostrum
  fangs: { kind: 'fangs', len: 0.08, r: 0.022, shape: 'chili', bend: 0.25 },        // spider chelicerae
  forcipules: { kind: 'mandibles', len: 0.1, r: 0.016, shape: 'chili', flat: 0.6, bend: 0.35, spread: 40 },   // centipede
  none: null,
};

/** WINGS: a blade along its span (`len`), its chord the profile over the span (`chord` its widest, `r0` at the root,
 * `peak` where widest, `r1` at the tip), `lead` of the chord ahead of the spar. POSE turns the blade at its root:
 * `sweep` (span back from straight out), `dihedral` (span up), `roll` (the blade about its span; − drops the leading
 * edge, a tent). Types are forms of the blade; poses are shared. `elytra` is not a blade: a domed cover over the tail. */
export const WING_FORMS = {
  membrane: { len: 0.7, chord: 0.24, r0: 0.25, peak: 0.55, r1: 0.35, p: 0.8, q: 0.8, lead: 0.35, thick: 0.006, group: 'Wing' },
  scaled: { len: 0.95, chord: 0.62, r0: 0.3, peak: 0.75, r1: 0.55, p: 0.7, q: 0.6, lead: 0.15, thick: 0.008, group: 'Wing' },   // butterfly forewing
  scaledHind: { len: 0.72, chord: 0.62, r0: 0.35, peak: 0.45, r1: 0.4, p: 0.7, q: 0.7, lead: 0.2, thick: 0.008, group: 'HindWing' },
  narrow: { len: 0.85, chord: 0.16, r0: 0.3, peak: 0.45, r1: 0.45, p: 0.8, q: 0.7, lead: 0.4, thick: 0.005, group: 'Wing' },     // dragonfly, lacewing
  tegmen: { len: 0.6, chord: 0.14, r0: 0.5, peak: 0.35, r1: 0.45, p: 0.8, q: 0.8, lead: 0.4, thick: 0.012, group: 'Tegmen' },   // grasshopper, mantis, cockroach forewing
  haltere: { len: 0.08, chord: 0.03, r0: 0.4, peak: 0.85, r1: 0.9, p: 1, q: 1, lead: 0.5, thick: 0.025, group: 'Haltere' },    // a fly's hindwing knob
  elytra: { kind: 'elytra', len: 0.62, w: 1.12, h: 1.25, r0: 0.82, peak: 0.28, r1: 0.12, p: 0.6, q: 1.1, group: 'Elytra' },
};

export const WING_POSES = {
  spread: { sweep: 2, dihedral: 4, roll: 0 },        // flight, a dragonfly at rest
  flat: { sweep: 72, dihedral: 4, roll: 0 },         // bee, fly, cockroach, mantis: folded flat over the tail
  roof: { sweep: 78, dihedral: 2, roll: -38 },       // moth, lacewing, grasshopper: a tent over the tail
  tent: { sweep: 86, dihedral: -10, roll: -58 },     // cicada, leafhopper: a steep roof, the wings down the flanks
  upright: { sweep: 10, dihedral: 82, roll: 0 },     // butterfly at rest: closed above the back
  vee: { sweep: 40, dihedral: 6, roll: 0 },          // house fly at rest: a V behind the thorax
};

/** EYES: compound eyes on the head's sides, at `at` (0 the back of the head → 1 its front) and `elev` (degrees up
 * from the side), `size` (a share of head length), standing `bulge` of their depth proud. `count` > 1 (spiders) sets
 * small simple eyes in a row over the front. */
export const EYE_FORMS = {
  compound: { size: 0.36, depth: 0.5, at: 0.55, elev: 15, bulge: 0.55, flat: 0.8 },
  large: { size: 0.55, depth: 0.55, at: 0.5, elev: 20, bulge: 0.6, flat: 0.9 },          // fly, dragonfly, horsefly
  holoptic: { size: 0.66, depth: 0.6, at: 0.45, elev: 40, bulge: 0.62, flat: 0.95 },     // dragonfly, male fly: meeting on top
  small: { size: 0.22, depth: 0.45, at: 0.6, elev: 15, bulge: 0.5, flat: 0.8 },          // ant, beetle
  simple: { count: 8, size: 0.05, at: 0.95, elev: 55, bulge: 0.6, flat: 1 },             // spider: eight beads up front
  stalked: { stalk: 0.35, size: 0.12, at: 0.92, elev: 50, yaw: 22, rise: 55 },            // crab, lobster: eyes on stalks
  none: null,
};

/** INSECT ORDERS (and other arthropods called bugs) as PRIORS: the part forms an order usually wears (and, in `over`,
 * any bauplan fields the order always sets: a harvestman's or a tick's tail joins the body with no waist). They seed the
 * matcher (species.js `resolveBug`) for a bug nobody has built; they are not a roster and nothing is built from them
 * alone. */
export const ORDER_PRIORS = {
  Hymenoptera: { head: 'hypognathous', trunk: 'compact', tail: 'oval', legs: 'walker', antennae: 'geniculate', mouth: 'mandibles', wings: ['membrane', 'membrane'], eyes: 'compound', extras: ['sting'] },
  Formicidae: { head: 'prognathous', trunk: 'slim', tail: 'gaster', legs: 'walker', antennae: 'geniculate', mouth: 'mandibles', wings: null, eyes: 'small' },
  Diptera: { head: 'globe', trunk: 'compact', tail: 'oval', legs: 'walker', antennae: 'aristate', mouth: 'sponge', wings: ['membrane', 'haltere'], eyes: 'large' },
  Culicidae: { head: 'globe', trunk: 'compact', tail: 'long', legs: 'stilt', antennae: 'plumose', mouth: 'stylet', wings: ['narrow', 'haltere'], eyes: 'large' },
  Coleoptera: { head: 'prognathous', trunk: 'shield', tail: 'flat', legs: 'walker', antennae: 'clavate', mouth: 'mandibles', wings: ['elytra'], eyes: 'small' },
  Lepidoptera: { head: 'globe', trunk: 'compact', tail: 'tapered', legs: 'walker', antennae: 'capitate', mouth: 'coiled', wings: ['scaled', 'scaledHind'], eyes: 'compound' },
  Orthoptera: { head: 'hypognathous', trunk: 'saddle', tail: 'tapered', legs: 'walker', hindLegs: 'jumper', antennae: 'filiform', mouth: 'mandibles', wings: ['tegmen'], eyes: 'compound' },
  Hemiptera: { head: 'prognathous', trunk: 'shield', tail: 'flat', legs: 'walker', antennae: 'filiform', mouth: 'beak', wings: ['elytra'], eyes: 'small', extras: [] },
  Odonata: { head: 'globe', trunk: 'slanted', tail: 'long', legs: 'walker', antennae: 'setaceous', mouth: 'mandibles', wings: ['narrow', 'narrow'], eyes: 'holoptic' },
  Mantodea: { head: 'hypognathous', trunk: 'long', tail: 'tapered', legs: 'walker', foreLegs: 'grasper', antennae: 'filiform', mouth: 'mandibles', wings: ['tegmen'], eyes: 'compound' },
  Blattodea: { head: 'hypognathous', trunk: 'shield', tail: 'oval', legs: 'runner', antennae: 'whip', mouth: 'mandibles', wings: ['tegmen'], eyes: 'compound' },
  Araneae: { head: 'fused', trunk: 'cephalothorax', tail: 'sac', legs: 'spider', antennae: null, mouth: 'fangs', wings: null, eyes: 'simple' },
  Chilopoda: { head: 'prognathous', trunk: 'centipede', tail: 'telson', legs: 'manyfoot', antennae: 'filiform', mouth: 'forcipules', wings: null, eyes: 'small' },
  Diplopoda: { head: 'prognathous', trunk: 'millipede', tail: 'telson', legs: 'manyfoot', antennae: 'clavate', mouth: 'mandibles', wings: null, eyes: 'small' },
  Scorpiones: { head: 'fused', trunk: 'prosoma', tail: 'mesosoma', legs: 'spider', palps: 'cheliped', antennae: null, mouth: 'none', wings: null, eyes: 'simple', extras: ['metasoma'] },
  Brachyura: { head: 'fused', trunk: 'carapace', tail: 'tucked', legs: 'crabwalker', foreLegs: 'cheliped', antennae: 'setaceous', mouth: 'none', wings: null, eyes: 'stalked' },
  Astacidea: { head: 'fused', trunk: 'cylinder', tail: 'muscle', legs: 'crabwalker', foreLegs: 'cheliped', antennae: 'peduncle', mouth: 'none', wings: null, eyes: 'stalked', extras: ['fan'] },
  // spiny and slipper lobsters: the lobster's body, no chelae (every leg a walker), the second antennae the weapon
  Achelata: { head: 'fused', trunk: 'cylinder', tail: 'muscle', legs: 'crabwalker', foreLegs: 'crabwalker', antennae: 'peduncle', mouth: 'none', wings: null, eyes: 'stalked', extras: ['fan'] },
  Cicadidae: { head: 'globe', trunk: 'compact', tail: 'oval', legs: 'walker', antennae: 'setaceous', mouth: 'beak', wings: ['membrane', 'membrane'], wingPose: 'tent', eyes: 'compound', extras: [] },
  Curculionidae: { head: 'prognathous', trunk: 'shield', tail: 'flat', legs: 'walker', antennae: 'geniculate', mouth: 'snout', wings: ['elytra'], eyes: 'small' },
  Neuroptera: { head: 'prognathous', trunk: 'compact', tail: 'tapered', legs: 'walker', antennae: 'filiform', mouth: 'mandibles', wings: ['membrane', 'membrane'], wingPose: 'roof', eyes: 'compound', extras: [] },
  Ephemeroptera: { head: 'globe', trunk: 'compact', tail: 'long', legs: 'walker', antennae: 'setaceous', mouth: 'none', wings: ['membrane', 'membrane'], wingPose: 'upright', eyes: 'large', extras: ['cerci', 'filament'],
    over: { extras: [{ kind: 'cerci', len: 0.9, r: 0.006, spread: 18, rise: 20 }, { kind: 'filament', len: 0.9, r: 0.006, rise: 20 }] } },
  Phasmida: { head: 'prognathous', trunk: 'long', tail: 'long', legs: 'runner', antennae: 'filiform', mouth: 'mandibles', wings: null, eyes: 'small' },
  Dermaptera: { head: 'prognathous', trunk: 'shield', tail: 'tapered', legs: 'walker', antennae: 'moniliform', mouth: 'mandibles', wings: ['elytra'], eyes: 'small', extras: ['cerci'],
    over: { wings: { pairs: [{ form: 'elytra', len: 0.26 }] }, extras: [{ kind: 'cerci', shape: 'banana', len: 0.35, r: 0.03, bend: 0.4, toward: [1, 0, 0], spread: 8, rise: 2 }] } },
  Siphonaptera: { head: 'hypognathous', trunk: 'compact', tail: 'oval', legs: 'walker', hindLegs: 'jumper', antennae: 'setaceous', mouth: 'stylet', wings: null, eyes: 'small' },
  Opiliones: { head: 'fused', trunk: 'cephalothorax', tail: 'sac', legs: 'stilt', antennae: null, mouth: 'fangs', wings: null, eyes: 'simple', over: { waist: null } },
  Ixodida: { head: 'prognathous', trunk: 'cephalothorax', tail: 'sac', legs: 'spider', antennae: null, mouth: 'snout', wings: null, eyes: 'none', over: { waist: null } },
  Xiphosura: { head: 'fused', trunk: 'carapace', tail: 'opisthosoma', legs: 'tucked', antennae: null, mouth: 'none', wings: null, eyes: 'small', extras: ['filament'] },
  Isopoda: { head: 'prognathous', trunk: 'isopod', tail: 'pleon', legs: 'manyfoot', antennae: 'filiform', mouth: 'none', wings: null, eyes: 'small' },
};
