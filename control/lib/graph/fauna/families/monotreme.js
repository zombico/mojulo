// MONOTREME — a low, broad, top-to-bottom FLATTENED trunk carried close to the ground on short SPRAWLING legs (the
// upper limbs held out sideways, elbows and knees out past the body), plantigrade clawed feet, a small flat head with
// no external ears, and (the platypus) a flat, wide rubbery BILL as an extra loft and a broad flat paddle TAIL.
// Tables are authored in metres at platypus size. Worked species: the platypus. See ../build.js.

const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
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
const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));

export const family = {
  family: 'monotreme',
  colors: {
    coat: '#5b4330', sock: '#4a3626', ash: '#a68a6a', ashAlt: '#977c5d', brow: '#3a2a1e', iris: '#120c08',
    ink: '#0d0a08', sclera: '#120c08', nose: '#2f2f31', teeth: '#ece6d6', mouth: '#4e3430', tip: '#4a3426',
    hoof: '#38383b', belly: '#8e7356',
  },
  joints: {
    neckBase: [0, 0.10, 0.072], neckTop: [0, 0.155, 0.074],
    // sprawling: the elbow and the knee out past the body, the feet set wide
    shoulder: [0.065, 0.08, 0.065], elbow: [0.11, 0.065, 0.045], carpus: [0.118, 0.09, 0.016], forePaw: [0.118, 0.10, 0.022], foreToe: [0.128, 0.15, 0.008],
    hip: [0.058, -0.11, 0.062], stifle: [0.10, -0.10, 0.042], hock: [0.108, -0.135, 0.016], hindPaw: [0.108, -0.13, 0.018], hindToe: [0.118, -0.085, 0.005],
  },
  torso: [
    { at: [0, -0.17, 0.07], r: [0.06, 0.035] },
    { at: [0, -0.12, 0.07], r: [0.085, 0.05] },
    { at: [0, -0.04, 0.07], r: [0.09, 0.055] },
    { at: [0, 0.04, 0.07], r: [0.085, 0.052] },
    { at: [0, 0.10, 0.07], r: [0.065, 0.045] },
  ],
  torsoCaps: { back: [0, -0.20, 0.07], tip: [0, 0.14, 0.072] },
  neckRA: [0.056, 0.042], neckRB: [0.046, 0.035], neckRMid: [0.05, 0.038],
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.025, 0.03], [0.018, 0.018], 'Coat', [0.6, 0.5]],
    ['foreArmR', 'elbow', 'carpus', [0.018, 0.018], [0.014, 0.014], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.013, 0.012, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.026, 0.005], [0.038, 0.0035], 'Sock', [0.3, 0.2]],
    ['thighR', 'hip', 'stifle', [0.03, 0.035], [0.02, 0.02], 'Coat', [0.3, 0.5]],
    ['shinR', 'stifle', 'hock', [0.018, 0.018], [0.014, 0.014], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.013, 0.012, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.02, 0.007], [0.024, 0.005], 'Sock', [0.3, 0.2]],
  ],
  craniumRows: flat(SKULL, 1.1, 0.75),
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.015] },
  muzzleFrom: 3,
  jawRows: flatJaw(JAW, 1.1, 0.75),
  jawCaps: { back: [0, -0.1, -0.07], tip: [0, 0.21, -0.043] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.24, nape: [0, -0.1, -0.03],
  eyeAt: [2.2, 2.2], eyeR: 0.006, orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.001 }, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97],
  // no external ears (the ear opening sits in a groove with the eye)
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  muzzleW: 1.2, muzzleLen: 0.3,
  headTiles: [], bodyTiles: [],
  // the bill: a flat, wide rubbery loft from inside the face forward [y, z, [half-width, half-height]] (group Hoof)
  billStations: [[0.18, 0.08, [0.024, 0.016]], [0.20, 0.079, [0.03, 0.011]], [0.225, 0.075, [0.032, 0.007]], [0.248, 0.073, [0.029, 0.006]]],
  billCaps: { back: [0, 0.17, 0.078], tip: [0, 0.262, 0.072] },
  // the broad flat paddle tail
  tailStations: [[-0.165, 0.07, [0.055, 0.03]], [-0.20, 0.058, [0.068, 0.022]], [-0.245, 0.046, [0.068, 0.018]], [-0.285, 0.038, [0.052, 0.014]]],
  tailCaps: { back: [0, -0.14, 0.07], tip: [0, -0.31, 0.034] },
  scale: 1,
};
family.extraSegments = [
  { name: 'bill', kind: 'loft', slots: 'ring12', group: 'Hoof', mirror: 'plane', stations: loftOf(family.billStations), caps: family.billCaps },
  { name: 'tailPaddle', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: loftOf(family.tailStations), caps: family.tailCaps },
];

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // PLATYPUS (Ornithorhynchus anatinus). Thesis: a low broad FLATTENED body close to the ground · short SPRAWLING
  // legs, the fore feet wide webbed paddles · a small flat head with NO visible ears and the flat wide rubbery grey-
  // black duck BILL · the broad flat beaver-like TAIL · brown above, paler below · ~0.12 m to the top of the back
  // (Australian Museum: head-body 0.39–0.50 m, tail 0.10–0.15 m, bill ~0.05–0.065 m, 0.7–2.4 kg).
  platypus: {
    family: 'monotreme', name: 'a platypus', scale: 1,
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  platypus: { common: 'platypus', aliases: ['duck-billed platypus', 'duckbill'], sci: 'Ornithorhynchus anatinus', size: '~0.12 m to the top of the back; head-body 0.39–0.50 m', source: 'Australian Museum' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {};
