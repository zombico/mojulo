// PRIMATE — a quadrupedal ape / monkey at rest on all fours: a broad deep chest over a narrow pelvis, the back line
// sloping DOWN from high shoulders to the rump (long arms, short bent legs), the hands knuckle-down under the shoulders,
// plantigrade feet with a splayed great toe, a short thick neck carrying the head low and forward, a round cranium
// over a flat face with a brow ridge and a protruding muzzle, round side ears, no tail. Worked species: the
// chimpanzee. See ../build.js for what every field does. Authored at true size (metres, scale 1, headScale 1).
//
// THE SLOPING BACK: the torso stations sit at different heights (shoulder high, rump low); `torsoUp: true` builds
// them with build.js's stable upright frame so the sloped trunk does not twist.

export const family = {
  family: 'primate',
  colors: {
    coat: '#2b2623', sock: '#3a302b', ash: '#8f6f5a', ashAlt: '#7e604d', brow: '#5e4636', iris: '#4a2e1a',
    ink: '#120e0c', sclera: '#2b1d14', nose: '#4a3a32', teeth: '#ece6d6', mouth: '#4e3430', tip: '#2b2623',
    snout: '#8f6f5a', ears: '#8f6f5a', belly: '#2b2623',
  },
  torsoUp: true,
  joints: {
    neckBase: [0, 0.22, 0.74], neckTop: [0, 0.33, 0.80],
    // arms: long and nearly straight, the hand vertical, weight on the knuckles (the fingers curled forward)
    shoulder: [0.17, 0.20, 0.68], elbow: [0.19, 0.17, 0.40], carpus: [0.18, 0.20, 0.14], forePaw: [0.17, 0.25, 0.048], foreToe: [0.17, 0.31, 0.04],
    // legs: short, the knee forward and out, the foot flat (plantigrade), the great toe splayed inward
    hip: [0.11, -0.26, 0.50], stifle: [0.15, -0.10, 0.30], hock: [0.14, -0.22, 0.07], hindPaw: [0.14, -0.26, 0.045], hindToe: [0.15, -0.04, 0.028],
    hallux: [0.08, -0.10, 0.025],
  },
  torso: [
    { at: [0, -0.32, 0.47], r: [0.12, 0.10] },
    { at: [0, -0.20, 0.52], r: [0.15, 0.14] },
    { at: [0, -0.02, 0.59], r: [0.17, 0.16] },
    { at: [0, 0.12, 0.64], r: [0.23, 0.195] },
    { at: [0, 0.24, 0.66], r: [0.205, 0.16] },
  ],
  torsoCaps: { back: [0, -0.40, 0.45], tip: [0, 0.31, 0.67] },
  neckRA: [0.13, 0.12], neckRB: [0.09, 0.09], neckRMid: [0.11, 0.105],
  tail: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.075, 0.08], [0.055, 0.055], 'Coat', [0.6, 0.4], [0.065, 0.07]],
    ['foreArmR', 'elbow', 'carpus', [0.055, 0.055], [0.04, 0.04], 'Coat', [0.4, 0.3], [0.05, 0.05]],
    ['handR', 'carpus', 'forePaw', [0.04, 0.035], [0.045, 0.03], 'Sock', [0.3, 0.3]],
    ['knuckleR', 'forePaw', 'foreToe', [0.045, 0.028], [0.04, 0.022], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ['thighR', 'hip', 'stifle', [0.085, 0.09], [0.06, 0.06], 'Coat', [0.4, 0.4], [0.08, 0.08]],
    ['shinR', 'stifle', 'hock', [0.055, 0.055], [0.04, 0.04], 'Coat', [0.4, 0.3]],
    ['heelR', 'hock', 'hindPaw', 0.04, 0.04, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.045, 0.025], [0.045, 0.02], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ['halluxR', 'hindPaw', 'hallux', [0.02, 0.016], [0.018, 0.014], 'Sock', [0.2, 0.4], null, { up: [0, 0, 1] }],
  ],
  // skull rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] — a round domed cranium (st0-st2), the brow ridge
  // as a forward shelf (st3), a sunken nose bridge (st4), then the protruding muzzle (st5-st6) low on the face
  craniumRows: [
    ['st0', -0.09, 0.065, [0.045, 0.058], [0.07, 0.02], [0.07, -0.02], [0.055, -0.045], [0.035, -0.06], -0.065],
    ['st1', -0.045, 0.10, [0.042, 0.095], [0.08, 0.045], [0.082, 0.0], [0.07, -0.04], [0.048, -0.06], -0.065],
    ['st2', 0.0, 0.098, [0.042, 0.093], [0.078, 0.045], [0.078, 0.0], [0.066, -0.04], [0.046, -0.06], -0.062],
    ['st3', 0.05, 0.072, [0.056, 0.066], [0.074, 0.044], [0.064, -0.005], [0.054, -0.036], [0.042, -0.06], -0.062],
    ['st4', 0.065, 0.03, [0.03, 0.03], [0.05, 0.012], [0.054, -0.02], [0.05, -0.045], [0.04, -0.064], -0.066],
    ['st5', 0.10, 0.002, [0.024, 0.0], [0.04, -0.015], [0.046, -0.035], [0.044, -0.056], [0.034, -0.07], -0.072],
    ['st6', 0.13, -0.018, [0.018, -0.02], [0.03, -0.03], [0.034, -0.045], [0.032, -0.062], [0.024, -0.07], -0.072],
  ],
  craniumCaps: { back: [0, -0.115, 0.0], tip: [0, 0.142, -0.045] },
  muzzleFrom: 4,
  jawRows: [
    ['st0', -0.02, { gum: -0.064, gumR: [0.05, -0.064], jaw: [0.055, -0.085], bottom: -0.098 }],
    ['st1', 0.03, { gum: -0.064, gumR: [0.045, -0.064], jaw: [0.05, -0.085], bottom: -0.098 }],
    ['st2', 0.07, { gum: -0.068, gumR: [0.04, -0.068], jaw: [0.042, -0.088], bottom: -0.098 }],
    ['st3', 0.105, { gum: -0.072, gumR: [0.032, -0.072], jaw: [0.034, -0.09], bottom: -0.096 }],
    ['st4', 0.128, { gum: -0.072, gumR: [0.022, -0.072], jaw: [0.024, -0.086], bottom: -0.09 }],
  ],
  jawCaps: { back: [0, -0.05, -0.085], tip: [0, 0.138, -0.08] },
  skinControls: {
    browRaise: { amp: 0.008, map: [['st3.brow', 0.8, [0, 0, 1]], ['st2.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.008, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.008, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.008, map: [['st4.cheek', 1, [0.5, 0, 0.8]], ['st3.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.01, map: [['st5.lip', 0.8, [0.1, -1, 0.3]], ['st6.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1, nape: [0, -0.07, -0.05],
  eyeAt: [3.5, 1.8], eyeR: 0.012, pupil: 'round', irisAngle: 30, orbitFallback: true,
  browStrip: [[3.0, 0.6], [3.0, 1.1], [3.05, 1.6], [3.1, 2.1], [3.2, 2.5]],
  foldStrip: [[5.5, 2.2], [5.2, 2.9], [4.8, 3.6], [4.5, 4.2], [4.3, 4.7]],
  nostrilAt: [5.2, 0.6], noseAt: [5.2, 0.0001], noseR: [0.012, 0.01], webCranium: [1.7, 3.3, 4.97],
  // round ears out on the sides of the cranium
  earAt: [1.4, 2.8], earSpine: [[0, 0, -0.01], [0, 0, 0.01], [0, 0, 0.025], [0, 0, 0.04], [0, 0, 0.05]],
  earR: [0.022, 0.032, 0.03, 0.014], earSquash: [1, 0.3], earH: 1,
  bulk: 1, legBulk: 1,
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // CHIMPANZEE (Pan troglodytes), adult male — THESIS: knuckle-walking quadruped · back sloping down from high
  // shoulders (arms longer than legs) to a low rump, no tail · plantigrade feet with a splayed great toe, hands down on
  // the knuckles · a round cranium over a flat face: heavy brow ridge, protruding (prognathous) muzzle, big round side
  // ears · black coat, bare tan face · ~0.80 m at the shoulder on all fours (head-body 0.64–0.94 m, males 40–60 kg —
  // Smithsonian National Zoo / ADW Pan troglodytes; arm ≈ humerus 0.30 + radius 0.27 + hand 0.20 m).
  chimpanzee: {
    family: 'primate', name: 'a chimpanzee',
    headScale: 1.15, eyeR: 0.014, bulk: 1.1, legBulk: 1.3,
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  chimpanzee: { common: 'chimpanzee', aliases: ['chimp', 'ape'], sci: 'Pan troglodytes', size: '~0.80 m at the shoulder on all fours', source: 'Smithsonian National Zoo / ADW' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  capuchin: { near: 'chimpanzee', aliases: ['monkey', 'macaque'], note: 'a small tailed monkey on all fours, a long tail' },
  gorilla: { near: 'chimpanzee', aliases: ['silverback'], note: 'huge knuckle-walking bulk, a sagittal crest, a silver saddle' },
  orangutan: { near: 'chimpanzee', aliases: [], note: 'long red hair, very long arms, cheek pads on the male' },
  lemur: { near: 'chimpanzee', aliases: ['ring-tailed lemur'], note: 'a fox face, big eyes, a long black-and-white ringed tail' },
  sloth: { near: 'chimpanzee', aliases: [], note: 'reads only hanging upside down from a branch: a pose, not a new body' },
};
