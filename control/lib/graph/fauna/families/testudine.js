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

const PT = 0.2;   // the pond turtle's scale (its shell `top` is written in metres after scale)
const ST = 0.82;  // the sea turtle's, likewise

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
  // RED-EARED SLIDER (Trachemys scripta elegans), the pond turtle. Thesis: a LOW, smooth, oval carapace (no dome),
  // the plastron near the ground · short SPRAWLING legs with flat, WEBBED, clawed feet, the hind feet turned back · a
  // small pointed head on a slim neck, striped yellow on green, with the bright RED patch behind each eye · olive shell
  // · ~0.25 m carapace (Wikipedia "Red-eared slider" / Ernst & Lovich 2009: carapace 0.15–0.3 m, females larger);
  // the fit length (rump to snout, the head out) is ~0.3 m.
  pondTurtle: {
    family: 'testudine', name: 'a red-eared slider', scale: PT, legBulk: 0.65,
    joints: {
      neckBase: [0, 0.42, 0.25], neckTop: [0, 0.86, 0.31],
      shoulder: [0.30, 0.34, 0.22], elbow: [0.50, 0.42, 0.15], carpus: [0.55, 0.48, 0.06], forePaw: [0.55, 0.49, 0.03], foreToe: [0.60, 0.62, 0.012],
      hip: [0.28, -0.34, 0.22], stifle: [0.48, -0.42, 0.15], hock: [0.53, -0.50, 0.06], hindPaw: [0.53, -0.51, 0.03], hindToe: [0.60, -0.65, 0.012],
    },
    // a low oval shell: a shallow dome (`top`) over a flat plastron close to the ground. `top` is in metres AFTER
    // `scale` (build.js scales every other trunk number but not this one), so it is written × the species' scale
    torso: [
      { at: [0, -0.56, 0.24], r: [0.30, 0.07], top: 0.04 * PT },
      { at: [0, -0.42, 0.24], r: [0.46, 0.09], top: 0.09 * PT },
      { at: [0, -0.15, 0.24], r: [0.52, 0.10], top: 0.13 * PT },
      { at: [0, 0.15, 0.24], r: [0.52, 0.10], top: 0.13 * PT },
      { at: [0, 0.40, 0.24], r: [0.44, 0.09], top: 0.08 * PT },
      { at: [0, 0.54, 0.24], r: [0.30, 0.07], top: 0.03 * PT },
    ],
    torsoCaps: { back: [0, -0.62, 0.24], tip: [0, 0.60, 0.25] },
    neckRA: [0.06, 0.06], neckRB: [0.045, 0.045], neckRMid: [0.05, 0.05],
    tail: [[0, -0.55, 0.20, 0.04], [0, -0.66, 0.14, 0.022], [0, -0.74, 0.09, 0.008]],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.10, 0.09], [0.08, 0.07], 'Sock', [0.4, 0.4]],
      ['foreArmR', 'elbow', 'carpus', [0.08, 0.07], [0.07, 0.06], 'Sock', [0.4, 0.3]],
      ['pasternR', 'carpus', 'forePaw', 0.065, 0.06, 'Sock', [0.3, 0.3]],
      ['forePawR', 'forePaw', 'foreToe', [0.09, 0.02], [0.12, 0.01], 'Sock', [0.3, 0.2]],
      ['thighR', 'hip', 'stifle', [0.11, 0.10], [0.085, 0.08], 'Sock', [0.4, 0.4]],
      ['shinR', 'stifle', 'hock', [0.085, 0.08], [0.07, 0.065], 'Sock', [0.4, 0.3]],
      ['metaR', 'hock', 'hindPaw', 0.07, 0.065, 'Sock', [0.3, 0.3]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.10, 0.02], [0.14, 0.01], 'Sock', [0.3, 0.2]],
    ],
    // a small, more pointed head than the tortoise's
    headScale: 0.6, muzzleLen: 0.6, muzzleW: 0.95,
    // the RED EAR: a flat stripe of colour behind each eye (head units: a thin sweep laid on the skin)
    headOrnaments: [{ kind: 'sweep', name: 'redEar', at: [1.3, 2.7], space: 'local', spine: [[0.002, 0, -0.001], [-0.004, 0, 0.0004], [-0.011, 0, 0.0003]], radii: [0.0028, 0.0032, 0.0018], m: 8, squash: [1, 0.3], group: 'EarStripe' }],
    headPalette: { EarStripe: '#c8342a', Nostrils: '#33461f' },
    markDensity: { neck: 3 },
    markings: [
      { on: 'neck', kind: 'band', t: [0.05, 0.12], group: 'Stripe', color: '#d6c64a' },
      { on: 'neck', kind: 'band', t: [0.3, 0.37], group: 'Stripe' },
      { on: 'neck', kind: 'band', t: [0.55, 0.62], group: 'Stripe' },
      { on: 'neck', kind: 'band', t: [0.8, 1], group: 'Stripe' },
    ],
    bodyTiles: [
      { id: 'scutes', parts: ['torso'], s: [0.6, 4.6], t: [0.3, 2.6], grid: [4, 2], brick: true, sides: 6, coverage: 0.95, inset: 0.85, height: 0.006, lean: 0, edgeFade: 0, thin: 1, wobble: 0.05, jitter: 0.05, group: ['Horn', 'Hoof'] },
    ],
    colors: { coat: '#4c5530', sock: '#3f5a2c', ash: '#4a6232', ashAlt: '#3f5a2c', brow: '#33461f', snout: '#4a6232', belly: '#d8c870', horn: '#56602f', hoof: '#4a5229', tip: '#3f5a2c', iris: '#c9a23a' },
  },
  // GREEN SEA TURTLE (Chelonia mydas). Thesis: a LOW, smooth, STREAMLINED teardrop shell, widest in front and
  // tapering behind · LONG flat paddle FLIPPERS for forelegs, swept back like wings, short broad rudder hind flippers,
  // no toes · a small blunt rounded head on a short thick neck that does not retract · olive-brown shell, pale-edged
  // scales on the grey skin, cream belly · ~1.0 m carapace (Wikipedia "Green sea turtle" / NOAA Fisheries: adults
  // 0.78–1.12 m carapace, ~70–190 kg); the fit length (rump to snout) is ~1.2 m. Built hauled out, the plastron on the sand.
  seaTurtle: {
    family: 'testudine', name: 'a green sea turtle', scale: ST,
    joints: {
      neckBase: [0, 0.46, 0.22], neckTop: [0, 0.70, 0.26],
      // the fore FLIPPER: out from under the shell rim, then a long flat blade swept back along the sand
      shoulder: [0.30, 0.34, 0.18], elbow: [0.52, 0.34, 0.10], carpus: [0.74, 0.22, 0.035], forePaw: [0.84, 0.12, 0.02], foreToe: [1.02, -0.08, 0.012],
      // the hind flipper: short, broad, trailing
      hip: [0.24, -0.40, 0.18], stifle: [0.36, -0.50, 0.09], hock: [0.42, -0.58, 0.035], hindPaw: [0.44, -0.61, 0.02], hindToe: [0.52, -0.80, 0.012],
    },
    // a low teardrop shell: widest in front, tapering behind; `top` is metres after scale (see the pond turtle)
    torso: [
      { at: [0, -0.62, 0.20], r: [0.16, 0.05], top: 0.02 * ST },
      { at: [0, -0.44, 0.20], r: [0.36, 0.08], top: 0.07 * ST },
      { at: [0, -0.15, 0.20], r: [0.48, 0.10], top: 0.12 * ST },
      { at: [0, 0.15, 0.20], r: [0.50, 0.10], top: 0.13 * ST },
      { at: [0, 0.40, 0.20], r: [0.44, 0.09], top: 0.08 * ST },
      { at: [0, 0.54, 0.20], r: [0.30, 0.07], top: 0.03 * ST },
    ],
    torsoCaps: { back: [0, -0.70, 0.20], tip: [0, 0.60, 0.21] },
    neckRA: [0.13, 0.11], neckRB: [0.10, 0.09], neckRMid: [0.11, 0.10],
    tail: [[0, -0.62, 0.17, 0.04], [0, -0.70, 0.13, 0.02], [0, -0.75, 0.10, 0.006]],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.09, 0.07], [0.08, 0.05], 'Sock', [0.4, 0.4]],
      ['foreArmR', 'elbow', 'carpus', [0.09, 0.04], [0.12, 0.025], 'Sock', [0.4, 0.3]],
      ['pasternR', 'carpus', 'forePaw', [0.12, 0.022], [0.11, 0.02], 'Sock', [0.3, 0.3]],
      ['forePawR', 'forePaw', 'foreToe', [0.11, 0.02], [0.03, 0.008], 'Sock', [0.3, 0.2], [0.09, 0.016]],
      ['thighR', 'hip', 'stifle', [0.08, 0.07], [0.07, 0.05], 'Sock', [0.4, 0.4]],
      ['shinR', 'stifle', 'hock', [0.07, 0.04], [0.09, 0.025], 'Sock', [0.4, 0.3]],
      ['metaR', 'hock', 'hindPaw', [0.09, 0.022], [0.10, 0.02], 'Sock', [0.3, 0.3]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.10, 0.02], [0.05, 0.01], 'Sock', [0.3, 0.2]],
    ],
    // a small blunt rounded head
    headScale: 0.62, muzzleLen: 0.5, muzzleW: 1.05,
    headPalette: { Nostrils: '#4a4a38' },
    bodyTiles: [
      { id: 'scutes', parts: ['torso'], s: [0.6, 4.6], t: [0.3, 2.6], grid: [4, 2], brick: true, sides: 6, coverage: 0.95, inset: 0.85, height: 0.012, lean: 0, edgeFade: 0, thin: 1, wobble: 0.05, jitter: 0.05, group: ['Horn', 'Hoof'] },
    ],
    colors: { coat: '#5a4a2e', sock: '#6e6a50', ash: '#7c785c', ashAlt: '#6e6a50', brow: '#4e4a36', snout: '#7c785c', belly: '#e0d6a8', horn: '#7a6236', hoof: '#4a3a22', tip: '#6e6a50', iris: '#2a2218' },
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  tortoise: { common: 'tortoise', aliases: ['giant tortoise', 'aldabra tortoise'], sci: 'Aldabrachelys gigantea', size: '~1.2 m carapace; ~0.72 m to the top of the shell', source: 'Seychelles Islands Foundation / Bourn & Coe' },
  pondTurtle: { common: 'turtle', aliases: ['pond turtle', 'box turtle', 'terrapin', 'red-eared slider', 'slider'], sci: 'Trachemys scripta elegans', size: '~0.25 m carapace (0.15–0.3 m)', source: 'Ernst & Lovich 2009, Turtles of the United States and Canada' },
  seaTurtle: { common: 'sea turtle', aliases: ['green turtle', 'green sea turtle'], sci: 'Chelonia mydas', size: '~1.0 m carapace (0.78–1.12 m)', source: 'NOAA Fisheries, "Green turtle"' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
};
