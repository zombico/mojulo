// TESTUDINE — a high DOMED carapace (the trunk itself, its upper half raised over a flat plastron) with a hexagonal scute pattern,
// four thick COLUMNAR, scaly, elephantine legs coming out from under the shell's rim (elbows only a little out, the
// feet round stumps), a small blunt head on a long retractable neck, no ears, a stub tail. Tables are authored in
// metres at giant-tortoise size. Worked species: the Aldabra giant tortoise.

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
  family: 'testudine',
  colors: {
    coat: '#4a3b2a', sock: '#6f6a5f', ash: '#7d776b', ashAlt: '#6f6a5f', brow: '#4f4a42', iris: '#1a1612',
    ink: '#0d0b09', sclera: '#1a1612', nose: '#3a3630', teeth: '#cfc6ae', mouth: '#5a4a40', tip: '#5a554c',
    hoof: '#3a3128', horn: '#6a5638', belly: '#8a7a5a', snout: '#7d776b',
  },
  joints: {
    neckBase: [0, 0.42, 0.36], neckTop: [0, 0.84, 0.46],
    // columnar: the elbow and knee only a little out past the shell rim, the forearm and shin near vertical
    shoulder: [0.26, 0.36, 0.30], elbow: [0.40, 0.42, 0.22], carpus: [0.41, 0.45, 0.12], forePaw: [0.41, 0.46, 0.06], foreToe: [0.42, 0.53, 0.028],
    hip: [0.25, -0.36, 0.30], stifle: [0.38, -0.42, 0.22], hock: [0.38, -0.44, 0.12], hindPaw: [0.38, -0.44, 0.06], hindToe: [0.39, -0.37, 0.028],
  },
  // the trunk IS the carapace: level rings whose upper half is raised by `top` (a dome over a flat plastron)
  torso: [
    { at: [0, -0.56, 0.34], r: [0.30, 0.13], top: 0.08 },
    { at: [0, -0.42, 0.34], r: [0.45, 0.17], top: 0.17 },
    { at: [0, -0.15, 0.34], r: [0.52, 0.18], top: 0.22 },
    { at: [0, 0.15, 0.34], r: [0.52, 0.18], top: 0.21 },
    { at: [0, 0.40, 0.35], r: [0.45, 0.16], top: 0.14 },
    { at: [0, 0.54, 0.36], r: [0.30, 0.11], top: 0.05 },
  ],
  torsoCaps: { back: [0, -0.62, 0.34], tip: [0, 0.60, 0.37] },
  neckRA: [0.11, 0.11], neckRB: [0.07, 0.07], neckRMid: [0.085, 0.085], neckGroup: 'Sock',
  tail: [[0, -0.55, 0.26, 0.04], [0, -0.64, 0.2, 0.025], [0, -0.68, 0.16, 0.01]], tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.10, 0.10], [0.085, 0.085], 'Sock', [0.4, 0.4]],
    ['foreArmR', 'elbow', 'carpus', [0.085, 0.085], [0.08, 0.075], 'Sock', [0.4, 0.3]],
    ['pasternR', 'carpus', 'forePaw', 0.08, 0.08, 'Sock', [0.3, 0.3]],
    ['forePawR', 'forePaw', 'foreToe', [0.085, 0.03], [0.07, 0.02], 'Hoof', [0.3, 0.2]],
    ['thighR', 'hip', 'stifle', [0.11, 0.11], [0.09, 0.09], 'Sock', [0.4, 0.4]],
    ['shinR', 'stifle', 'hock', [0.09, 0.09], [0.085, 0.085], 'Sock', [0.4, 0.3]],
    ['metaR', 'hock', 'hindPaw', 0.085, 0.085, 'Sock', [0.3, 0.3]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.09, 0.03], [0.075, 0.02], 'Hoof', [0.3, 0.2]],
  ],
  levelLegs: true,
  craniumRows: SKULL,
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.02] },
  muzzleFrom: 3,
  jawRows: JAW,
  jawCaps: { back: [0, -0.1, -0.095], tip: [0, 0.21, -0.057] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  // a small blunt head: the canine rows with the muzzle cut short; eye and nostrils scale with the head
  headScale: 0.5, headRelative: true, nape: [0, -0.1, -0.05],
  eyeAt: [2.6, 2.4], eyeR: 0.016, orbit: { reach: [0.006, 0.007, 0.008], bulk: [0.001, 0.002], thickness: 0.002 }, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.0], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  muzzleW: 1.1, muzzleLen: 0.45,
  headTiles: [],
  // the coat colour is the SHELL's (the trunk); the head's skull bands are worn in the grey skin instead
  craniumBandGroups: Object.fromEntries(['st0-st1', 'st1-st2', 'st2-st3', 'st3-st4', 'st4-st5', 'st5-st6'].map((b) => [b, ['Cheek', 'Cheek', 'Cheek', 'Cheek', 'Jowl', 'Palate']])),
  bodyTiles: [
    { id: 'scutes', parts: ['torso'], s: [0.6, 4.6], t: [0.3, 2.6], grid: [4, 2], brick: true, sides: 6, coverage: 0.9, inset: 0.8, height: 0.015, lean: 0, edgeFade: 0, thin: 1, wobble: 0.1, jitter: 0.1, group: ['Horn', 'Hoof'] },
  ],
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // ALDABRA GIANT TORTOISE (Aldabrachelys gigantea). Thesis: a high DOMED carapace of hexagonal scutes that is most
  // of the animal · four thick COLUMNAR scaly elephantine legs with round stump feet under the shell rim · a small
  // blunt head on a long retractable neck, no ears, a stub tail · grey skin, dark brown shell · ~1.2 m carapace,
  // ~0.72 m to the top of the shell (Seychelles Islands Foundation / Bourn & Coe: males' carapace ~1.2 m, ~250 kg).
  tortoise: {
    // kept v3 (blind judge A: v3 over the post-critic v5 60%; B: v5 over v1 75%)
    family: 'testudine', name: 'an Aldabra giant tortoise', scale: 1,
  },
};
