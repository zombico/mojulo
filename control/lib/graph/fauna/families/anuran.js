// ANURAN — frogs and toads: a short squat trunk sitting CROUCHED (rump on the ground, the front propped up on short
// straight forelegs, the back sloping down to the vent), NO neck and NO tail, a wide flat head as wide as the body
// with a huge mouth line and BULGING eyes on top, and HUGE FOLDED HIND LEGS: the thigh running forward along the
// flank, the shin folded back beside it, the long foot (tarsus + webbed toes) forward again flat on the ground — a
// Z of three near-equal long bones. Tables are authored in metres at bullfrog size. Worked species: the American
// bullfrog.

const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
// the canine skull rows, flattened top to bottom and widened (flat), the muzzle pulled in short (muzzleLen)
const SKULL = [
  ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
  ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
  ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
  ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
  ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
  ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
  ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
];
const JAW = [
  ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
  ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
  ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
  ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
  ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
];

export const family = {
  family: 'anuran',
  colors: {
    coat: '#5f7a3c', sock: '#5f7a3c', ash: '#d9d2a4', ashAlt: '#cbc394', brow: '#4a602e', iris: '#b8862f',
    ink: '#121409', sclera: '#2a2a14', nose: '#3b4a25', teeth: '#d9d2a4', mouth: '#c78f7a', tip: '#4a602e',
    hoof: '#52692f', belly: '#e2dcb4', lids: '#6d8a44',
  },
  joints: {
    neckBase: [0, 0.028, 0.040], neckTop: [0, 0.046, 0.044],
    // the forelegs: short, near straight, propping the front up, hands turned in
    shoulder: [0.024, 0.020, 0.030], elbow: [0.032, 0.030, 0.016], carpus: [0.030, 0.040, 0.004], forePaw: [0.031, 0.043, 0.002], foreToe: [0.030, 0.058, 0.0012],
    // the hind leg folded in a Z: thigh forward along the flank, shin back beside it, foot forward flat on the ground
    hip: [0.020, -0.050, 0.020], stifle: [0.050, -0.008, 0.016], hock: [0.040, -0.062, 0.010], hindPaw: [0.044, -0.056, 0.003], hindToe: [0.066, 0.005, 0.002],
  },
  // the trunk sloping DOWN to the rump (an upright-ring torso, so the stations may sit at different heights)
  torsoUp: true,
  torso: [
    { at: [0, -0.068, 0.020], r: [0.022, 0.016] },
    { at: [0, -0.048, 0.024], r: [0.036, 0.022] },
    { at: [0, -0.020, 0.030], r: [0.042, 0.025] },
    { at: [0, 0.008, 0.035], r: [0.040, 0.024] },
    { at: [0, 0.030, 0.039], r: [0.033, 0.020] },
  ],
  torsoCaps: { back: [0, -0.078, 0.019], tip: [0, 0.040, 0.041] },
  neckRA: [0.032, 0.02], neckRB: [0.03, 0.018], neckRMid: [0.031, 0.019],
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', 0.006, 0.005, 'Coat', [0.5, 0.4]],
    ['foreArmR', 'elbow', 'carpus', 0.005, 0.004, 'Coat', [0.4, 0.3]],
    ['pasternR', 'carpus', 'forePaw', 0.004, 0.004, 'Coat', [0.3, 0.3]],
    ['forePawR', 'forePaw', 'foreToe', [0.007, 0.002], [0.009, 0.0015], 'Hoof', [0.3, 0.2]],
    // the thigh: thick; the shin: long and lean; the foot: long, flat, widening into the web
    ['thighR', 'hip', 'stifle', [0.017, 0.018], [0.009, 0.009], 'Coat', [0.4, 0.4], [0.016, 0.016]],
    ['shinR', 'stifle', 'hock', [0.009, 0.009], [0.006, 0.006], 'Coat', [0.4, 0.4], [0.010, 0.010]],
    ['metaR', 'hock', 'hindPaw', 0.005, 0.004, 'Coat', [0.3, 0.3]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.006, 0.002], [0.016, 0.0015], 'Hoof', [0.3, 0.2]],
  ],
  levelLegs: true,
  // the head: the canine skull made very wide and flat, the snout short and round
  craniumRows: flat(SKULL, 1.8, 0.55),
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.015] },
  muzzleFrom: 3, muzzleLen: 0.35, muzzleW: 1.15,
  jawRows: flatJaw(JAW, 1.8, 0.55),
  jawCaps: { back: [0, -0.1, -0.05], tip: [0, 0.21, -0.03] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.2, nape: [0, -0.12, -0.02],
  // the eyes BULGING on top of the head (a big eye set high, a thick lid ring), nostrils on top of the snout
  eyeAt: [2.0, 1.4], eyeR: 0.0065, orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.001, 0.0015], thickness: 0.0012 }, orbitFallback: true,
  pupil: 'round', irisAngle: 40,
  browStrip: [[1.6, 1.3], [1.9, 1.2], [2.2, 1.2], [2.5, 1.3], [2.8, 1.4]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.6, 1.0], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: [], headTiles: [], bodyTiles: [],
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // AMERICAN BULLFROG (Lithobates catesbeianus). Thesis: a squat CROUCHED sitter, rump down, front propped on short
  // forelegs · HUGE hind legs folded in a Z beside the body, long webbed feet flat on the ground · a wide flat head
  // with a wide mouth line, big BULGING eyes on top, a large round eardrum behind the eye · no neck, no tail · olive
  // green above, cream below · ~0.15 m snout–vent, ~0.07 m sitting height (Wikipedia / USGS NAS: adults 9–15 cm SVL,
  // up to 20 cm).
  // kept v2 (blind judges: A v2 over post-critic v3 65%; B v3 over v1 70%)
  frog: { family: 'anuran', name: 'an American bullfrog', scale: 1 },
};
