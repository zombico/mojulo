// CERVID — a light barrel on long thin legs with cloven hooves (unguligrade: high carpus and hock, vertical cannons,
// short sloped pasterns), a slender neck carried up, a long narrow tapering head with large ears set out to the side,
// a short tail. Antlers (or their absence) belong to the SPECIES, as `headOrnaments`. Worked species: the white-tailed
// buck. See ../build.js for what every field does; canine.js is the worked example this was grown from.

// a canine-derived skull made deer-narrow: every side slot's x scaled (the muzzle narrower still), the top flatter
const narrow = (rows, kx, kMuzzle, from) => rows.map(([id, y, top, ...sl], i) => [id, y, top * 0.85, ...sl.slice(0, 5).map(([x, z]) => [x * (i >= from ? kMuzzle : kx), z]), sl[5]]);

export const family = {
  family: 'cervid',
  colors: {
    coat: '#9a7350', sock: '#7f6146', ash: '#ece6da', ashAlt: '#ddd4c4', brow: '#4a3626', iris: '#3a2a1c',
    ink: '#120e0b', sclera: '#2b2116', nose: '#15110e', teeth: '#ece6d6', mouth: '#4e3430', tip: '#f2efe8',
    hoof: '#23201c', horn: '#cdb994', belly: '#ece6da',
  },
  joints: {
    neckBase: [0, 0.36, 0.84], neckTop: [0, 0.60, 1.08],
    throatA: [0, 0.50, 0.92], throatB: [0, 0.56, 0.975],
    shoulder: [0.11, 0.33, 0.76], elbow: [0.115, 0.27, 0.52], carpus: [0.10, 0.31, 0.29], foreFetlock: [0.095, 0.32, 0.085], foreCoronet: [0.095, 0.35, 0.035], foreToe: [0.095, 0.40, 0.012],
    hip: [0.09, -0.46, 0.80], stifle: [0.115, -0.31, 0.55], hock: [0.10, -0.53, 0.40], hindFetlock: [0.095, -0.505, 0.085], hindCoronet: [0.095, -0.48, 0.035], hindToe: [0.095, -0.43, 0.012],
  },
  torso: [
    { at: [0, -0.64, 0.74], r: [0.08, 0.09] },
    { at: [0, -0.5, 0.74], r: [0.12, 0.155] },
    { at: [0, -0.28, 0.74], r: [0.115, 0.15] },
    { at: [0, 0.02, 0.74], r: [0.125, 0.17] },
    { at: [0, 0.22, 0.74], r: [0.125, 0.195] },
    { at: [0, 0.38, 0.74], r: [0.10, 0.15] },
  ],
  torsoCaps: { back: [0, -0.71, 0.76], tip: [0, 0.46, 0.76] },
  neckRA: [0.095, 0.14], neckRB: [0.06, 0.08], neckRMid: [0.075, 0.10],
  // a short tail carried down against the rump; its underside/tip white (the flag)
  tail: [[0, -0.66, 0.83, 0.035], [0, -0.72, 0.80, 0.05], [0, -0.76, 0.74, 0.05]],
  tip: [[0, -0.755, 0.75, 0.045], [0, -0.77, 0.70, 0.035], [0, -0.775, 0.66, 0.02]],
  tipCaps: { back: [0, -0.75, 0.77], tip: [0, -0.775, 0.645] },
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.06, 0.10], [0.04, 0.045], 'Coat', [0.6, 0.5], [0.055, 0.08]],
    ['foreArmR', 'elbow', 'carpus', [0.04, 0.045], [0.022, 0.026], 'Coat', [0.5, 0.4]],
    ['foreCannonR', 'carpus', 'foreFetlock', 0.02, 0.017, 'Sock', [0.4, 0.4]],
    ['forePasternR', 'foreFetlock', 'foreCoronet', 0.018, 0.02, 'Sock', [0.4, 0.4]],
    ['foreHoofR', 'foreCoronet', 'foreToe', [0.026, 0.026], [0.022, 0.012], 'Hoof', [0.5, 0.4]],
    ['thighR', 'hip', 'stifle', [0.08, 0.12], [0.05, 0.055], 'Coat', [0.2, 0.5], [0.075, 0.105]],
    ['shinR', 'stifle', 'hock', [0.05, 0.055], [0.024, 0.028], 'Coat', [0.5, 0.4]],
    ['hindCannonR', 'hock', 'hindFetlock', 0.021, 0.017, 'Sock', [0.4, 0.4]],
    ['hindPasternR', 'hindFetlock', 'hindCoronet', 0.018, 0.02, 'Sock', [0.4, 0.4]],
    ['hindHoofR', 'hindCoronet', 'hindToe', [0.026, 0.026], [0.022, 0.012], 'Hoof', [0.5, 0.4]],
  ],
  craniumRows: narrow([
    ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
    ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
    ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
    ['st3', 0.05, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
    ['st4', 0.12, 0.04, [0.018, 0.038], [0.036, 0.015], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
    ['st5', 0.19, 0.028, [0.015, 0.025], [0.027, 0.005], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
    ['st6', 0.25, 0.016, [0.01, 0.014], [0.019, -0.004], [0.022, -0.024], [0.02, -0.037], [0.016, -0.046], -0.047],
  ], 0.82, 0.78, 3),
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.27, -0.02] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.07, { gum: -0.075, gumR: [0.036, -0.075], jaw: [0.04, -0.1], bottom: -0.11 }],
    ['st1', 0.0, { gum: -0.075, gumR: [0.032, -0.075], jaw: [0.034, -0.095], bottom: -0.104 }],
    ['st2', 0.08, { gum: -0.064, gumR: [0.025, -0.064], jaw: [0.026, -0.082], bottom: -0.09 }],
    ['st3', 0.16, { gum: -0.056, gumR: [0.019, -0.056], jaw: [0.02, -0.07], bottom: -0.076 }],
    ['st4', 0.235, { gum: -0.049, gumR: [0.014, -0.049], jaw: [0.015, -0.06], bottom: -0.065 }],
  ],
  jawCaps: { back: [0, -0.1, -0.095], tip: [0, 0.25, -0.057] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
  },
  headScale: 1.05, nape: [0, -0.12, -0.04],
  eyeAt: [2.4, 2.6], eyeR: 0.024, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 2.05], [2.2, 2.05], [2.5, 2.1], [2.8, 2.2], [3.05, 2.35]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.016, 0.014], webCranium: [1.7, 3.3, 4.97],
  // large ears set out to the side: pinned low on the crown toward the brow, the spine leaning outward
  earAt: [0.9, 2.0], earSpine: [[0, 0, -0.012], [0.01, 0, 0.03], [0.03, 0, 0.08], [0.05, 0, 0.13], [0.065, 0, 0.17]],
  earR: [0.03, 0.05, 0.048, 0.022], earSquash: [1, 0.35], earH: 0.8,
  // the white throat patch: a pale pad on the front of the upper neck
  extraSegments: [{ name: 'throatPatch', kind: 'segment', from: 'throatA', to: 'throatB', rA: 0.05, rB: 0.045, slots: 'ring12', group: 'Belly', mirror: 'plane' }],
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

// an antler: one main beam swept up, back and out, then curving FORWARD over the face, with upright tines off its top
// (head units, +x out on the key side, +y front, +z up; each sweep pinned on the crown and mirrored)
const beam = [[0, 0, -0.005], [0.03, -0.03, 0.07], [0.08, -0.04, 0.14], [0.12, 0.0, 0.19], [0.13, 0.08, 0.215], [0.11, 0.16, 0.22], [0.07, 0.22, 0.21]];
const beamR = [0.02, 0.018, 0.016, 0.014, 0.012, 0.01, 0.005];
// a tine: runs inside the beam from the pin to its branch point (beam station i), then up to its tip, so it is one
// piece rooted on the skull (the attached gate measures every sweep against the head)
const tine = (name, i, tip, r) => { const f = beam[i]; const mid = f.map((v, j) => (v + tip[j]) / 2);
  return { kind: 'sweep', name, at: [1.0, 1.0], space: 'head', spine: [...beam.slice(0, i + 1), mid, tip], radii: [...beamR.slice(0, i).map((x) => x * 0.9), r, r * 0.75, r * 0.3], m: 6, group: 'Horn' }; };

// a tine off ANY beam (the elk's and the reindeer's): runs inside the beam from the pin to its branch point (station
// i), then out to its tip, so it is one piece rooted on the skull; `opt` adds sweep fields (a squash for a palm)
const tineOn = (bm, bmR, name, i, tip, r, opt = {}) => { const f = bm[i]; const mid = f.map((v, j) => (v + tip[j]) / 2);
  return { kind: 'sweep', name, at: [1.0, 1.0], space: 'head', spine: [...bm.slice(0, i + 1), mid, tip], radii: [...bmR.slice(0, i).map((x) => x * 0.9), r, r * 0.75, r * 0.3], m: 6, group: 'Horn', ...opt }; };
// the ELK's beam: long, swept up and BACK over the shoulders, the tips turning up and a little in (head units)
const elkBeam = [[0, 0, -0.015], [0.04, -0.04, 0.08], [0.13, -0.11, 0.18], [0.20, -0.18, 0.30], [0.23, -0.24, 0.42], [0.23, -0.25, 0.54], [0.19, -0.21, 0.64]];
const elkBeamR = [0.026, 0.024, 0.021, 0.018, 0.015, 0.011, 0.005];
// the REINDEER's beam: back and up, then a long C curving FORWARD at the top (head units)
const rdBeam = [[0, 0, -0.005], [0.03, -0.04, 0.08], [0.10, -0.12, 0.20], [0.16, -0.17, 0.34], [0.19, -0.14, 0.48], [0.19, -0.04, 0.58], [0.16, 0.08, 0.63]];
const rdBeamR = [0.022, 0.02, 0.018, 0.016, 0.014, 0.011, 0.005];

export const species = {
  // WHITE-TAILED BUCK (Odocoileus virginianus) — the cervid family's worked species. Thesis: a light level barrel on
  // long thin legs, high hocks, cloven hooves · slender neck carried up, a narrow tapering head, large ears out to the
  // side · ONE signature: branched antlers, the main beam curving forward with 3 upright tines and a brow tine · tan
  // coat, white throat and chin, a short tail white below · 0.95 m at the withers (published 0.8–1.0 m adult male
  // shoulder height; Smithsonian / ADW figures).
  buck: {
    family: 'cervid', name: 'a white-tailed buck', scale: 1,
    headOrnaments: [
      { kind: 'sweep', name: 'antlerBeam', at: [1.0, 1.0], space: 'head', spine: beam, radii: beamR, m: 6, group: 'Horn' },
      tine('antlerBrow', 1, [0.05, 0.0, 0.15], 0.009),
      tine('antlerTine1', 3, [0.125, 0.01, 0.30], 0.011),
      tine('antlerTine2', 4, [0.13, 0.09, 0.32], 0.01),
      tine('antlerTine3', 5, [0.11, 0.17, 0.29], 0.008),
    ],
  },
  // WHITE-TAILED DOE (Odocoileus virginianus, adult female) — the buck's female. Thesis: the same light barrel on
  // long thin legs, high hocks, cloven hooves, but SMALLER and ANTLERLESS · a slimmer neck carried up, the narrow head
  // with large ears out to the side the only thing on the crown · diagnostic: no antlers + smaller frame (vs buck),
  // big ears and white throat/tail (vs goat/antelope) · tan coat · 0.80 m at the withers (published 0.7–0.9 m adult
  // female shoulder height; ADW / Smithsonian figures).
  deer: {
    family: 'cervid', name: 'a white-tailed doe', scale: 0.86,
    neckRA: [0.085, 0.125], neckRB: [0.055, 0.072], neckRMid: [0.066, 0.088],
  },
  // MOOSE (Alces alces, bull) — Thesis: a short deep trunk HUMPED high over the shoulders and sloping to a lower
  // rump, on VERY long legs, cloven hooves · a short thick neck carrying a long heavy head LOW, the muzzle a bulbous
  // overhanging bell-nose · ONE/TWO signatures: broad flat PALMATE antlers out sideways, and the dewlap ("bell")
  // hanging from the throat · dark brown, pale lower legs · 1.90 m at the withers (published bull shoulder height
  // 1.8–2.1 m; ADW / Alaska Dept. of Fish & Game). Authored at buck units and scaled up.
  // kept v9 (upgrade pass 1006, blind judges vs v3, both orders: v9 70% / 75%; v1 cards unavailable)
  moose: {
    family: 'cervid', name: 'a bull moose', scale: 1.75, legScale: 1.12,
    colors: { coat: '#3e2e22', sock: '#9c8a74', ash: '#4a382a', ashAlt: '#45342a', belly: '#3a2a20', brow: '#2a1e16', tip: '#3e2e22', horn: '#b8a07a', nose: '#1e1612' },
    joints: {
      neckBase: [0, 0.32, 0.86], neckTop: [0, 0.50, 0.90],
      throatA: [0, 0.44, 0.80], throatB: [0, 0.50, 0.84],
      shoulder: [0.10, 0.30, 0.78], elbow: [0.105, 0.25, 0.56], carpus: [0.095, 0.29, 0.30], foreFetlock: [0.09, 0.30, 0.085], foreCoronet: [0.09, 0.33, 0.035], foreToe: [0.09, 0.38, 0.012],
      hip: [0.085, -0.33, 0.75], stifle: [0.105, -0.20, 0.55], hock: [0.095, -0.40, 0.40], hindFetlock: [0.09, -0.36, 0.085], hindCoronet: [0.09, -0.335, 0.035], hindToe: [0.09, -0.285, 0.012],
      bellA: [0, 0.55, 0.86], bellB: [0, 0.58, 0.60],
    },
    // short trunk, deep in front; `top` lifts the back over the shoulders (the hump) and lets the rump fall
    torso: [
      { at: [0, -0.47, 0.74], r: [0.08, 0.09], top: -0.04 },
      { at: [0, -0.36, 0.74], r: [0.115, 0.15], top: -0.03 },
      { at: [0, -0.18, 0.74], r: [0.12, 0.16], top: 0.01 },
      { at: [0, 0.04, 0.74], r: [0.13, 0.20], top: 0.10 },
      { at: [0, 0.22, 0.74], r: [0.13, 0.22], top: 0.16 },
      { at: [0, 0.36, 0.74], r: [0.11, 0.17], top: 0.09 },
    ],
    torsoCaps: { back: [0, -0.53, 0.74], tip: [0, 0.44, 0.75] },
    neckRA: [0.11, 0.16], neckRB: [0.08, 0.10], neckRMid: [0.09, 0.13],
    tail: [[0, -0.50, 0.78, 0.02], [0, -0.53, 0.76, 0.025], [0, -0.55, 0.72, 0.02]],
    tip: null,
    headScale: 1.4, muzzleW: 2.3, muzzleLen: 1.0, headPitch: -25, earH: 0.9, noseR: [0.03, 0.022],
    extraSegments: [
      // the bell: a hanging flap of skin and hair under the throat
      { name: 'bell', kind: 'segment', from: 'bellA', to: 'bellB', rA: [0.014, 0.035], rB: [0.012, 0.03], rMid: [0.016, 0.045], slots: 'ring12', group: 'Coat', mirror: 'plane', over: [0.3, 0.3] },
    ],
    headOrnaments: [
      // a short beam straight out sideways from the poll; the PALM a broad flat plate (a squashed fat sweep) out and up,
      // tilted to face up-forward; its rim crowned with short points; all in head units
      { kind: 'sweep', name: 'antlerBeam', at: [1.0, 1.0], space: 'head', spine: [[0, 0, -0.005], [0.06, -0.01, 0.05], [0.12, -0.02, 0.08]], radii: [0.022, 0.02, 0.018], m: 6, group: 'Horn' },
      { kind: 'sweep', name: 'antlerPalm', at: [1.0, 1.0], space: 'head', spine: [[0, 0, -0.005], [0.06, -0.01, 0.05], [0.14, -0.03, 0.09], [0.22, -0.05, 0.12], [0.30, -0.06, 0.15], [0.36, -0.06, 0.18]], radii: [0.022, 0.02, 0.10, 0.15, 0.14, 0.08], squash: [0.22, 1], m: 8, group: 'Horn' },
      ...[[0.27, 0.07, 0.17], [0.34, 0.03, 0.22], [0.39, -0.03, 0.25], [0.41, -0.09, 0.25], [0.38, -0.15, 0.22], [0.31, -0.18, 0.17]].map(([x, y, z], i) => ({
        kind: 'sweep', name: `antlerPoint${i}`, at: [1.0, 1.0], space: 'head', spine: [[0, 0, -0.005], [0.06, -0.01, 0.05], [0.12, -0.02, 0.08], ...[0.6, 0.75, 0.9].map((f) => [0.24 + (x - 0.24) * f, -0.05 + (y + 0.05) * f, 0.13 + (z - 0.13) * f])], radii: [0.022, 0.02, 0.014, 0.02, 0.016, 0.004], m: 6, group: 'Horn' })),
      // the bulbous overhanging bell-nose: a heavy upper lip that droops over and past the lower jaw (one a side)
      { kind: 'sweep', name: 'upperLip', at: [5.5, 0.0001], space: 'head', spine: [[0.02, 0.16, 0.0], [0.03, 0.23, -0.005], [0.03, 0.285, -0.025], [0.028, 0.29, -0.05]], radii: [0.03, 0.05, 0.055, 0.035], m: 8, group: 'Snout' },
    ],
  },  // REINDEER / CARIBOU (Rangifer tarandus, a bull) — Thesis: a STOCKY deer: a deep barrel on shorter, thicker legs,
  // big BROAD hooves · a thick neck with a PALE shaggy throat MANE, a blunt haired muzzle, short ears · ONE signature:
  // tall back-swept C-shaped antlers curving forward at the top, palmate tops, and ONE flat BROW SHOVEL thrown
  // forward over the face (antlers on both sexes) · grey-brown coat, pale neck, white belly, rump and short tail ·
  // 1.10 m at the withers (published 0.85–1.40 m shoulder height; ADW, Rangifer tarandus). Authored at buck units, legs 0.8.
  reindeer: {
    family: 'cervid', name: 'a reindeer', scale: 1.3, legScale: 0.8, bulk: 1.28, legBulk: 1.35,
    colors: { coat: '#6e6052', sock: '#4e4238', ash: '#7a6c5e', ashAlt: '#6a5e52', belly: '#e8e2d6', brow: '#3a3028', tip: '#ece8de', mane: '#ddd6c8', horn: '#b8a582', hoof: '#26201c', snout: '#5e5246', nose: '#2a2420' },
    neckGroup: 'Mane',
    neckRA: [0.12, 0.17], neckRB: [0.075, 0.095], neckRMid: [0.10, 0.13],
    headScale: 1.1, muzzleW: 1.6, muzzleLen: 0.85, earH: 0.55, earR: [0.026, 0.036, 0.032, 0.014], noseR: [0.02, 0.016],
    joints: { maneA: [0, 0.40, 0.70], maneB: [0, 0.54, 0.86] },
    // the broad hooves: the hoof rows wider and longer than the buck's
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.06, 0.10], [0.04, 0.045], 'Coat', [0.6, 0.5], [0.055, 0.08]],
      ['foreArmR', 'elbow', 'carpus', [0.04, 0.045], [0.024, 0.028], 'Coat', [0.5, 0.4]],
      ['foreCannonR', 'carpus', 'foreFetlock', 0.022, 0.02, 'Sock', [0.4, 0.4]],
      ['forePasternR', 'foreFetlock', 'foreCoronet', 0.022, 0.026, 'Sock', [0.4, 0.4]],
      ['foreHoofR', 'foreCoronet', 'foreToe', [0.038, 0.032], [0.034, 0.014], 'Hoof', [0.5, 0.4]],
      ['thighR', 'hip', 'stifle', [0.08, 0.12], [0.05, 0.055], 'Coat', [0.2, 0.5], [0.075, 0.105]],
      ['shinR', 'stifle', 'hock', [0.05, 0.055], [0.026, 0.03], 'Coat', [0.5, 0.4]],
      ['hindCannonR', 'hock', 'hindFetlock', 0.023, 0.02, 'Sock', [0.4, 0.4]],
      ['hindPasternR', 'hindFetlock', 'hindCoronet', 0.022, 0.026, 'Sock', [0.4, 0.4]],
      ['hindHoofR', 'hindCoronet', 'hindToe', [0.038, 0.032], [0.034, 0.014], 'Hoof', [0.5, 0.4]],
    ],
    // the white belly and rump (markings), the short white tail
    markDensity: { torso: 2 },
    markings: [
      { on: 'torso', kind: 'belly', from: 0.7, group: 'Belly' },
      { on: 'torso', kind: 'band', run: [0, 0.1], t: [0.2, 1], caps: ['back'], group: 'Rump', color: '#e8e2d6' },
    ],
    tail: [[0, -0.66, 0.83, 0.03], [0, -0.70, 0.81, 0.04], [0, -0.73, 0.77, 0.035]],
    tip: null, tailGroup: 'Rump',
    extraSegments: [
      // the pale shaggy throat mane hanging under the neck
      { name: 'throatMane', kind: 'segment', from: 'maneA', to: 'maneB', rA: [0.04, 0.05], rB: [0.03, 0.035], rMid: [0.05, 0.075], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.3] },
    ],
    headOrnaments: [
      { kind: 'sweep', name: 'antlerBeam', at: [1.0, 1.0], space: 'head', spine: rdBeam, radii: rdBeamR, m: 6, group: 'Horn' },
      // the BROW SHOVEL: a flat vertical palm thrown forward and down over the face
      tineOn(rdBeam, rdBeamR, 'antlerShovel', 1, [0.02, 0.20, 0.10], 0.05, { squash: [0.25, 1] }),
      tineOn(rdBeam, rdBeamR, 'antlerBez', 2, [0.12, 0.08, 0.26], 0.012),
      tineOn(rdBeam, rdBeamR, 'antlerBack', 3, [0.21, -0.27, 0.44], 0.01),
      // the palmate top: a flat palm with points
      tineOn(rdBeam, rdBeamR, 'antlerPalm', 5, [0.18, 0.14, 0.72], 0.045, { squash: [0.3, 1] }),
      tineOn(rdBeam, rdBeamR, 'antlerTop1', 4, [0.23, -0.08, 0.68], 0.008),
    ],
  },
  // ELK / WAPITI (Cervus canadensis, a bull) — Thesis: a BIG deer: a long tan barrel on long legs · a thick DARK
  // brown neck with a shaggy mane, a dark head and legs · ONE/TWO signatures: huge antlers, a long beam swept up and
  // BACK over the shoulders with six forward-pointing tines, and the big PALE RUMP PATCH round a tiny tail ·
  // 1.50 m at the withers (published bull shoulder height ~1.5 m; Rocky Mountain Elk Foundation / ADW, Cervus
  // canadensis). Authored at buck units and scaled 1.6.
  elk: {
    family: 'cervid', name: 'a bull elk', scale: 1.6, bulk: 1.12, legBulk: 1.12,
    colors: { coat: '#b08a5c', sock: '#3e2c1e', ash: '#3e2c1e', ashAlt: '#4a3424', belly: '#3e2c1e', brow: '#2a1e14', tip: '#e6d6b0', mane: '#4a3424', horn: '#c8b48e', snout: '#3a2a1c', nose: '#1a1410', ears: '#5a4230' },
    neckGroup: 'Mane',
    neckRA: [0.115, 0.165], neckRB: [0.07, 0.09], neckRMid: [0.095, 0.125],
    headScale: 1.0, muzzleW: 1.15, earH: 0.8, noseR: [0.02, 0.016],
    joints: { maneA: [0, 0.40, 0.72], maneB: [0, 0.55, 0.90] },
    // the dark head: every skull band in the mane's colour
    headPalette: { Skull: '#4a3424', SkullBack: '#4a3424', Snout: '#3a2a1c', Cheek: '#3e2c1e', Jowl: '#3e2c1e', Jaw: '#3e2c1e' },
    // the pale rump patch round the tail; the dark belly line
    markDensity: { torso: 2 },
    markings: [
      { on: 'torso', kind: 'band', run: [0, 0.14], t: [0.1, 1], caps: ['back'], group: 'Rump', color: '#e6d6b0' },
      { on: 'torso', kind: 'belly', from: 0.8, group: 'Belly' },
    ],
    tail: [[0, -0.66, 0.82, 0.025], [0, -0.69, 0.80, 0.03], [0, -0.71, 0.77, 0.025]],
    tip: null, tailGroup: 'Rump',
    extraSegments: [
      // the shaggy dark neck mane hanging under the throat
      { name: 'throatMane', kind: 'segment', from: 'maneA', to: 'maneB', rA: [0.035, 0.045], rB: [0.025, 0.03], rMid: [0.045, 0.065], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.3] },
    ],
    headOrnaments: [
      { kind: 'sweep', name: 'antlerBeam', at: [1.0, 1.0], space: 'head', spine: elkBeam, radii: elkBeamR, m: 6, group: 'Horn' },
      tineOn(elkBeam, elkBeamR, 'antlerBrow', 1, [0.07, 0.16, 0.15], 0.012),
      tineOn(elkBeam, elkBeamR, 'antlerBez', 2, [0.16, 0.06, 0.27], 0.011),
      tineOn(elkBeam, elkBeamR, 'antlerTrez', 3, [0.24, -0.04, 0.45], 0.011),
      tineOn(elkBeam, elkBeamR, 'antlerRoyal', 4, [0.27, -0.10, 0.60], 0.012),
      tineOn(elkBeam, elkBeamR, 'antlerSur', 5, [0.26, -0.15, 0.70], 0.008),
    ],
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  buck: { common: 'buck', aliases: ['stag', 'white-tailed buck', 'antlered deer'], sci: 'Odocoileus virginianus', size: '0.95 m at the withers', source: 'Smithsonian / ADW figures' },
  deer: { common: 'deer', aliases: ['doe', 'white-tailed deer', 'whitetail'], sci: 'Odocoileus virginianus', size: '0.80 m at the withers (adult female)', source: 'ADW / Smithsonian figures' },
  moose: { common: 'moose', aliases: ['bull moose'], sci: 'Alces alces', size: '1.90 m at the withers (bull)', source: 'ADW / Alaska Dept. of Fish & Game' },
  reindeer: { common: 'reindeer', aliases: ['caribou'], sci: 'Rangifer tarandus', size: '1.10 m at the withers (published 0.85–1.40 m)', source: 'ADW, Rangifer tarandus' },
  elk: { common: 'elk', aliases: ['wapiti'], sci: 'Cervus canadensis', size: '1.50 m at the withers (bull)', source: 'Rocky Mountain Elk Foundation / ADW, Cervus canadensis' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {};
