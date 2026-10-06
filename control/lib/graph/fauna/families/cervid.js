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
};
