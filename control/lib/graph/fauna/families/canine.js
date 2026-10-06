// CANINE — a deep chest over a tucked loin, digitigrade paws, a long skull with a medium muzzle, erect ears, a brush
// tail. Worked species: the grey wolf. See ../build.js for what every field does.

export const family = {
  family: 'canine',
  colors: {
    coat: '#8c8272', sock: '#a3906f', ash: '#d6cdbb', ashAlt: '#c4baa6', brow: '#4a4036', iris: '#c8973a',
    ink: '#17130f', sclera: '#2b2116', nose: '#16120f', teeth: '#ece6d6', mouth: '#4e3430', tip: '#2b2520',
  },
  joints: {
    neckBase: [0, 0.36, 0.90], neckTop: [0, 0.60, 1.12],
    shoulder: [0.14, 0.34, 0.80], elbow: [0.15, 0.28, 0.50], carpus: [0.13, 0.33, 0.15], forePaw: [0.13, 0.36, 0.05], foreToe: [0.13, 0.46, 0.035],
    hip: [0.10, -0.38, 0.80], stifle: [0.145, -0.22, 0.52], hock: [0.13, -0.47, 0.24], hindPaw: [0.13, -0.42, 0.05], hindToe: [0.13, -0.32, 0.035],
  },
  torso: [
    { at: [0, -0.54, 0.80], r: [0.10, 0.09] },
    { at: [0, -0.40, 0.80], r: [0.14, 0.13] },
    { at: [0, -0.20, 0.80], r: [0.10, 0.08] },
    { at: [0, 0.02, 0.80], r: [0.135, 0.15] },
    { at: [0, 0.24, 0.80], r: [0.15, 0.195] },
    { at: [0, 0.40, 0.80], r: [0.135, 0.18] },
  ],
  torsoCaps: { back: [0, -0.62, 0.80], tip: [0, 0.50, 0.77] },
  neckRA: [0.125, 0.16], neckRB: [0.09, 0.10], neckRMid: [0.105, 0.125],
  tail: [[0, -0.52, 0.84, 0.055], [0, -0.64, 0.76, 0.085], [0, -0.73, 0.62, 0.11], [0, -0.78, 0.47, 0.11], [0, -0.80, 0.36, 0.085]],
  tip: [[0, -0.80, 0.39, 0.08], [0, -0.81, 0.29, 0.065], [0, -0.81, 0.21, 0.035]],
  tipCaps: { back: [0, -0.80, 0.43], tip: [0, -0.81, 0.17] },
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.085, 0.13], [0.055, 0.06], 'Coat', [0.6, 0.5], [0.075, 0.095]],
    ['foreArmR', 'elbow', 'carpus', [0.055, 0.06], [0.035, 0.037], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.036, 0.033, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.05, 0.035], [0.047, 0.026], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.12, 0.165], [0.062, 0.068], 'Coat', [0.2, 0.5], [0.10, 0.13]],
    ['shinR', 'stifle', 'hock', [0.06, 0.07], [0.036, 0.04], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.037, 0.033, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.05, 0.035], [0.047, 0.026], 'Sock', [0.6, 0.4]],
  ],
  // skull rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] (side slots [x, z], midline z)
  craniumRows: [
    ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
    ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
    ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
    ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
    ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
    ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
    ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
  ],
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.02] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
    ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
    ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
    ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
    ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
  ],
  jawCaps: { back: [0, -0.1, -0.095], tip: [0, 0.21, -0.057] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.2, nape: [0, -0.1, -0.05],
  eyeAt: [2.6, 2.4], eyeR: 0.022, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.02, 0.017], webCranium: [1.7, 3.3, 4.97],
  earAt: [1.2, 1.5], earSpine: [[0, 0, -0.012], [0, 0, 0.02], [0, 0, 0.07], [0, 0, 0.12], [0, 0, 0.175]],
  earR: [0.045, 0.043, 0.03, 0.016], earSquash: [1, 0.4], earH: 1,
  headTiles: [
    { part: 'cranium', s: [0.15, 2.2], t: [3.0, 4.7], grid: [5, 3], brick: true, sides: 3, coverage: 1.25, inset: 0.85, height: 0.03, lean: -1.3, edgeFade: 0.25, thin: 0.4, wobble: 0.3, jitter: 0.3, group: ['Fur', 'FurAlt'] },
  ],
  bodyTiles: [
    { id: 'chestTufts', parts: ['torso'], s: [3.9, 4.95], t: [4.2, 6.0], grid: [4, 3], brick: true, sides: 3, coverage: 1.3, inset: 0.85, height: 0.04, lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Fur', 'FurAlt'] },
  ],
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // GREY WOLF (Canis lupus) — the canine family's worked species. Thesis: level back, deep narrow chest, long sturdy
  // legs · a broad head carried at the back line, a blunt muzzle, short rounded erect ears · the bushy tail hanging
  // low with a dark tip · 0.80 m at the withers. Accepted 2026-10-05 (blind judge over the start, medium-high).
  wolf: {
    family: 'canine', name: 'a grey wolf', scale: 0.84,
    colors: { coat: '#857a6a', sock: '#958467', ash: '#e6dfd0', tip: '#221d19' },
    joints: { neckBase: [0, 0.38, 0.86], neckTop: [0, 0.72, 0.9] },
    neckRA: [0.15, 0.19], neckRMid: [0.125, 0.15],
    headScale: 1.55, muzzleW: 1.35, muzzleLen: 0.85,
    earH: 0.72, earR: [0.052, 0.05, 0.036, 0.02],
    bulk: 1.1, legBulk: 1.35, tailBush: 1.35,
  },
};
