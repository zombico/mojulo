// CHIROPTERAN — bats. A small furred trunk, a short neck, and the forelimbs are WINGS: a membrane (wing.js, the
// MEMBRANE pattern lifted from docs/examples/wings DRAGON_WING, scaled) stretched between the arm bones, four long
// finger rays and the body, a free clawed thumb. The family pose is a bat CRAWLING on the ground: the wings folded
// tight, each forearm angled down-forward so the wrist and thumb claw are the front feet, the fingers folded back
// along the forearm with the membrane furled between; the short hind legs splayed out and back, knees turned up.
// `wings.fold` 0 spreads them (span at true scale). Tables are authored in metres at flying-fox size. Worked
// species: the Indian flying fox (fruitBat).

import { membraneWing } from '../makers/wing.js';

export { membraneWing };   // lives in makers/wing.js

const WING_PALETTE = { MembraneBack: '#2e241e', MembraneUnder: '#3d2f27', MembraneRim: '#1e1814', Vein: '#4a382c', WingBone: '#2e241e', Claw: '#d9d0bd' };

// the canine skull rows: the flying fox's long fox-like muzzle
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
  family: 'chiropteran',
  colors: {
    coat: '#3a2b22', sock: '#2e241e', ash: '#4a382c', ashAlt: '#55402f', brow: '#2e241e', iris: '#5a3a1c',
    ink: '#0d0a08', sclera: '#1d1510', nose: '#1a1410', teeth: '#e7e0cc', mouth: '#7a4a40', tip: '#2e241e',
    hoof: '#1e1814', mane: '#a8742f', ears: '#2a201a', belly: '#4a382c',
  },
  joints: {
    neckBase: [0, 0.075, 0.07], neckTop: [0, 0.105, 0.082], wingRoot: [0.03, 0.055, 0.075],
    // the hind legs splayed out and back, knees up, the feet clawed and turned back
    hip: [0.025, -0.075, 0.055], stifle: [0.075, -0.095, 0.06], hock: [0.07, -0.145, 0.012], hindPaw: [0.071, -0.15, 0.004], hindToe: [0.074, -0.175, 0.002],
  },
  torso: [
    { at: [0, -0.10, 0.06], r: [0.03, 0.028] },
    { at: [0, -0.06, 0.06], r: [0.045, 0.038] },
    { at: [0, 0.00, 0.06], r: [0.05, 0.042] },
    { at: [0, 0.05, 0.06], r: [0.045, 0.04] },
    { at: [0, 0.085, 0.06], r: [0.032, 0.03] },
  ],
  torsoCaps: { back: [0, -0.12, 0.06], tip: [0, 0.10, 0.062] },
  // the neck and shoulders: the golden MANTLE of a flying fox
  neckRA: [0.035, 0.032], neckRB: [0.024, 0.024], neckRMid: [0.03, 0.028], neckGroup: 'Mane',
  tail: null, tip: null,
  legs: [
    ['thighR', 'hip', 'stifle', 0.012, 0.009, 'Coat', [0.4, 0.4]],
    ['shinR', 'stifle', 'hock', 0.008, 0.006, 'Coat', [0.4, 0.3]],
    ['metaR', 'hock', 'hindPaw', 0.006, 0.006, 'Sock', [0.3, 0.3]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.009, 0.003], [0.008, 0.002], 'Hoof', [0.3, 0.2]],
  ],
  levelLegs: true,
  // the head: the canine skull, small, the long fox muzzle
  craniumRows: SKULL, craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.02] }, muzzleFrom: 3,
  jawRows: JAW, jawCaps: { back: [0, -0.1, -0.095], tip: [0, 0.21, -0.057] },
  muzzleW: 0.85, muzzleLen: 0.95,
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  // head-relative detail authored at the wolf's head (1.2): eyes, ears, nose scale with the small head
  headScale: 0.19, headRelative: 1.2, nape: [0, -0.1, -0.05],
  eyeAt: [2.6, 2.3], eyeR: 0.034, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.024, 0.02], webCranium: [1.7, 3.3, 4.97],
  // the ears: simple, rounded-pointed, upright, a little forward of the canine's
  earAt: [1.3, 1.6], earSpine: [[0, 0, -0.012], [0, 0, 0.03], [0, 0, 0.08], [0, 0, 0.13], [0, 0, 0.17]],
  earR: [0.05, 0.045, 0.032, 0.014], earSquash: [1, 0.4], earH: 0.7,
  headTiles: [], bodyTiles: [],
  wings: { wing: membraneWing(), at: 'wingRoot', fold: 0, core: 0.015, palette: WING_PALETTE },
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // INDIAN FLYING FOX (Pteropus medius), the fruit bat. Thesis: a crawling bat on the ground — wings folded tight down
  // the flanks as long black membrane bundles, each wrist + thumb claw planted as a front foot, the forearm the
  // longest bone in view · a FOX-LIKE head with a long muzzle, big dark eyes, simple pointed ears · a golden-tawny
  // MANTLE over the neck and shoulders on a dark body · no tail · splayed short hind legs · ~0.2 m head–body, 1.2–1.5 m
  // wingspan, forearm ~0.16 m (Wikipedia / Animal Diversity Web: Pteropus giganteus).
  // kept v4 (blind judges: A v4 over v3 55%; B v4 over v1 60%)
  fruitBat: { family: 'chiropteran', name: 'an Indian flying fox', scale: 1 },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  fruitBat: { common: 'bat', aliases: ['fruit bat', 'flying fox', 'megabat'], sci: 'Pteropus medius', size: '~0.2 m head-body; span 1.2–1.5 m', source: 'ADW, Pteropus giganteus' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {};
