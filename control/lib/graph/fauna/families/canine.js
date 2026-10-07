// CANINE — a deep chest over a tucked loin, digitigrade paws, a long skull with a medium muzzle, erect ears, a brush
// tail. Worked species: the grey wolf. See ../build.js for what every field does.

import { fineCoat, spotField } from '../coats.js';

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
  // DOMESTIC DOG, Labrador-type (Canis familiaris). Thesis: sturdy, deep broad chest, level back, moderate legs
  // (digitigrade, round paws) · a BROAD skull with a clear STOP, a broad blunt muzzle, DROP ears hanging by the cheeks ·
  // the thick tapering "otter" tail carried level, no brush · head carried high and friendly · 0.58 m at the withers
  // (AKC Labrador Retriever standard: 22.5-24.5 in / 57-62 cm males, 21.5-23.5 in females).
  dog: {
    family: 'canine', name: 'a domestic dog', scale: 0.56,
    colors: { coat: '#c9a066', sock: '#c29a62', ash: '#d9bd8c', ashAlt: '#ceb07c', brow: '#a07a48', tip: '#c9a066', iris: '#5a3a1e' },
    joints: { neckBase: [0, 0.38, 0.88], neckTop: [0, 0.66, 1.02], hip: [0.10, -0.38, 0.84], stifle: [0.145, -0.22, 0.55] },
    torso: [
      { at: [0, -0.54, 0.80], r: [0.12, 0.11] },
      { at: [0, -0.40, 0.80], r: [0.155, 0.15] },
      { at: [0, -0.20, 0.80], r: [0.13, 0.12] },
      { at: [0, 0.02, 0.80], r: [0.15, 0.18] },
      { at: [0, 0.24, 0.80], r: [0.165, 0.235] },
      { at: [0, 0.40, 0.80], r: [0.145, 0.21] },
    ],
    neckRA: [0.16, 0.19], neckRB: [0.11, 0.12], neckRMid: [0.13, 0.15],
    tail: [[0, -0.52, 0.84, 0.12], [0, -0.66, 0.80, 0.10], [0, -0.80, 0.74, 0.075], [0, -0.92, 0.67, 0.055], [0, -1.01, 0.60, 0.038]],
    tip: [[0, -1.00, 0.605, 0.038], [0, -1.06, 0.565, 0.025], [0, -1.10, 0.54, 0.012]],
    tipCaps: { back: [0, -0.99, 0.61], tip: [0, -1.12, 0.53] },
    craniumRows: [
      ['st0', -0.15, 0.05, [0.035, 0.048], [0.07, 0.02], [0.075, -0.02], [0.06, -0.05], [0.04, -0.065], -0.07],
      ['st1', -0.09, 0.10, [0.03, 0.098], [0.085, 0.06], [0.10, -0.01], [0.085, -0.05], [0.055, -0.075], -0.08],
      ['st2', -0.02, 0.105, [0.045, 0.10], [0.09, 0.05], [0.105, -0.005], [0.09, -0.05], [0.055, -0.075], -0.08],
      ['st3', 0.04, 0.045, [0.02, 0.044], [0.055, 0.02], [0.065, -0.02], [0.06, -0.05], [0.045, -0.07], -0.072],
      ['st4', 0.10, 0.035, [0.024, 0.033], [0.045, 0.01], [0.05, -0.022], [0.048, -0.05], [0.04, -0.066], -0.066],
      ['st5', 0.16, 0.03, [0.022, 0.027], [0.038, 0.005], [0.042, -0.024], [0.04, -0.05], [0.034, -0.062], -0.062],
      ['st6', 0.20, 0.022, [0.016, 0.02], [0.028, 0.0], [0.032, -0.026], [0.03, -0.048], [0.026, -0.058], -0.058],
    ],
    craniumCaps: { back: [0, -0.18, 0.01], tip: [0, 0.215, -0.02] },
    headScale: 1.6, muzzleW: 1.3, muzzleLen: 0.8,
    // drop ears: a short rise off the skull, then folded out and hanging down beside the cheek
    earAt: [1.1, 2.0], earSpine: [[0, 0, -0.012], [0, -0.04, 0.02], [0, -0.075, -0.01], [0, -0.085, -0.07], [0, -0.08, -0.14]],
    earR: [0.05, 0.07, 0.07, 0.05], earSquash: [1, 0.25], earH: 1,
    bulk: 1.2, legBulk: 1.6, tailBush: 1,
  },
  // RED FOX (Vulpes vulpes) — the canine family's second species. Thesis: small, slender, long low trunk on short
  // fine legs (digitigrade, black socks) · a light head with a narrow pointed muzzle and LARGE pointed erect ears ·
  // the long bushy brush carried low and near-horizontal, white tip · 0.40 m at the shoulder (published 35–50 cm;
  // head-body 0.6–0.9 m, tail 0.3–0.55 m).
  fox: {
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
    family: 'canine', name: 'a red fox', scale: 0.52,
    colors: { coat: '#b8602a', sock: '#2a201a', ash: '#efe6d8', ashAlt: '#e0d4c0', tip: '#f2ede4', brow: '#5a3218' },
    joints: {
      neckBase: [0, 0.38, 0.66], neckTop: [0, 0.64, 0.80],
      shoulder: [0.12, 0.34, 0.60], elbow: [0.13, 0.28, 0.36], carpus: [0.12, 0.33, 0.12], forePaw: [0.12, 0.35, 0.04], foreToe: [0.12, 0.44, 0.03],
      hip: [0.09, -0.38, 0.60], stifle: [0.125, -0.24, 0.38], hock: [0.12, -0.45, 0.17], hindPaw: [0.12, -0.41, 0.04], hindToe: [0.12, -0.32, 0.03],
    },
    torso: [
      { at: [0, -0.54, 0.60], r: [0.10, 0.09] },
      { at: [0, -0.40, 0.60], r: [0.13, 0.12] },
      { at: [0, -0.20, 0.60], r: [0.10, 0.085] },
      { at: [0, 0.02, 0.60], r: [0.12, 0.13] },
      { at: [0, 0.24, 0.60], r: [0.13, 0.16] },
      { at: [0, 0.40, 0.60], r: [0.12, 0.15] },
    ],
    torsoCaps: { back: [0, -0.62, 0.60], tip: [0, 0.50, 0.58] },
    neckRA: [0.11, 0.14], neckRB: [0.08, 0.09], neckRMid: [0.09, 0.11],
    tail: [[0, -0.52, 0.64, 0.055], [0, -0.68, 0.60, 0.10], [0, -0.84, 0.54, 0.13], [0, -0.99, 0.49, 0.13], [0, -1.10, 0.46, 0.10]],
    tip: [[0, -1.09, 0.465, 0.09], [0, -1.16, 0.45, 0.065], [0, -1.21, 0.44, 0.03]],
    tipCaps: { back: [0, -1.06, 0.47], tip: [0, -1.24, 0.435] },
    headScale: 1.25, muzzleW: 0.78, muzzleLen: 1.15,
    earH: 0.85, earR: [0.05, 0.046, 0.028, 0.008],
    bulk: 0.9, legBulk: 0.8, tailBush: 1.2,
  },
  // COYOTE (Canis latrans). Thesis: a smaller, LEANER wolf on long slender legs, a narrow chest · a narrow POINTED
  // muzzle and LARGE pointed erect ears (bigger for the head than a wolf's) · grizzled buff-grey coat, tawny legs and
  // ear backs, a pale throat · the bushy tail carried LOW, hanging, with a black tip · 0.60 m at the shoulder,
  // head-body ~0.85 m (Bekoff 1977, Mammalian Species 79 "Canis latrans": shoulder 0.58–0.66 m, total length
  // 1.0–1.35 m with a 0.30–0.40 m tail).
  coyote: {
    eyeStyle: 'set',
    family: 'canine', name: 'a coyote', scale: 0.56,
    colors: { coat: '#9a8468', sock: '#b98a5a', ash: '#ece2d0', ashAlt: '#ddd0b8', brow: '#5a4430', ears: '#a07a54', tip: '#1c1814', iris: '#c9a040' },
    joints: { neckBase: [0, 0.38, 0.86], neckTop: [0, 0.66, 0.98] },
    torso: [
      { at: [0, -0.45, 0.80], r: [0.09, 0.085] },
      { at: [0, -0.35, 0.80], r: [0.12, 0.115] },
      { at: [0, -0.16, 0.80], r: [0.085, 0.075] },
      { at: [0, 0.02, 0.80], r: [0.115, 0.14] },
      { at: [0, 0.24, 0.80], r: [0.125, 0.18] },
      { at: [0, 0.40, 0.80], r: [0.115, 0.165] },
    ],
    torsoCaps: { back: [0, -0.52, 0.80], tip: [0, 0.50, 0.77] },
    neckRA: [0.11, 0.15], neckRB: [0.075, 0.085], neckRMid: [0.09, 0.11],
    // the brush hanging low, near-vertical, behind the hocks
    tail: [[0, -0.50, 0.84, 0.05], [0, -0.60, 0.74, 0.08], [0, -0.66, 0.58, 0.10], [0, -0.69, 0.42, 0.10], [0, -0.70, 0.31, 0.08]],
    tip: [[0, -0.70, 0.34, 0.075], [0, -0.705, 0.25, 0.06], [0, -0.705, 0.18, 0.03]],
    tipCaps: { back: [0, -0.70, 0.38], tip: [0, -0.705, 0.15] },
    legScale: 1.1,
    headScale: 1.3, muzzleW: 0.82, muzzleLen: 1.12,
    earH: 0.95, earR: [0.054, 0.05, 0.03, 0.008],
    bulk: 0.95, legBulk: 1.0, tailBush: 1.2,
  },
  // SPOTTED HYENA (Crocuta crocuta). Thesis: the SLOPING BACK: high heavy shoulders and a thick neck, the back falling
  // to a low rump on SHORTER hind legs · a massive broad head, a short BLUNT dark muzzle, ROUNDED ears · a short
  // erect mane on the neck and shoulders · a sandy coat with dark round SPOTS · a short tail with a black bushy tip ·
  // 0.80 m at the shoulder, head-body ~1.3 m (Kingdon 1997, The Kingdon Field Guide to African Mammals: shoulder
  // 0.70–0.90 m, head-body 0.95–1.66 m).
  hyena: (() => {
    // the back falls from the withers to a low, narrow rump; the chest deep
    const torso = [
      { at: [0, -0.54, 0.55], r: [0.10, 0.09] },
      { at: [0, -0.42, 0.58], r: [0.135, 0.125] },
      { at: [0, -0.20, 0.67], r: [0.13, 0.13] },
      { at: [0, 0.02, 0.77], r: [0.155, 0.18] },
      { at: [0, 0.24, 0.84], r: [0.17, 0.215] },
      { at: [0, 0.40, 0.86], r: [0.155, 0.20] },
    ];
    return {
      eyeStyle: 'set',
      family: 'canine', name: 'a spotted hyena', scale: 0.73, torsoUp: true,
      colors: { coat: '#b39a72', sock: '#a68c66', ash: '#cdb994', ashAlt: '#bfa983', brow: '#2e241c', snout: '#3a2e24', ears: '#6a5440', mane: '#3a2e24', tip: '#1c1814', iris: '#6a4420' },
      joints: {
        neckBase: [0, 0.36, 0.98], neckTop: [0, 0.66, 1.00],
        shoulder: [0.15, 0.34, 0.88], elbow: [0.16, 0.30, 0.54], carpus: [0.14, 0.34, 0.15], forePaw: [0.14, 0.37, 0.05], foreToe: [0.14, 0.47, 0.035],
        hip: [0.11, -0.40, 0.55], stifle: [0.15, -0.27, 0.36], hock: [0.13, -0.45, 0.17], hindPaw: [0.13, -0.42, 0.05], hindToe: [0.13, -0.32, 0.035],
        maneA: [0, -0.10, 0.88], maneB: [0, 0.62, 1.10],
      },
      torso,
      torsoCaps: { back: [0, -0.60, 0.53], tip: [0, 0.50, 0.85] },
      neckRA: [0.16, 0.20], neckRB: [0.12, 0.13], neckRMid: [0.14, 0.17],
      tail: [[0, -0.54, 0.60, 0.04], [0, -0.62, 0.52, 0.04], [0, -0.66, 0.42, 0.038]],
      tip: [[0, -0.66, 0.44, 0.04], [0, -0.675, 0.34, 0.075], [0, -0.68, 0.25, 0.03]],
      tipCaps: { back: [0, -0.66, 0.47], tip: [0, -0.68, 0.22] },
      extraSegments: [
        // the short erect mane along the top of the neck and over the shoulders
        { name: 'mane', kind: 'segment', from: 'maneA', to: 'maneB', rA: [0.01, 0.02], rB: [0.03, 0.05], rMid: [0.03, 0.08], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.3] },
        // the round dark SPOTS on a fine coat shell over the trunk: many small irregular patches, fewer on the belly
        fineCoat('spots', torso, { bulk: 1.2, from: -0.52, to: 0.38, n: 36, half: 24, field: spotField({ cell: 0.115, rad: [0.03, 0.04], seed: 3, jitter: 0.6, stretch: 0.25, belly: 0.86, under: 'Coat', dark: 'Spot' }) }),
      ],
      headScale: 1.75, muzzleW: 1.45, muzzleLen: 0.62,
      // rounded ears: short, broad, round-topped
      earSpine: [[0, 0, -0.012], [0, 0, 0.015], [0, 0, 0.04], [0, 0, 0.062], [0, 0, 0.075]],
      earR: [0.04, 0.05, 0.05, 0.036], earH: 1,
      bulk: 1.2, legBulk: 1.35, tailBush: 1,
      markDensity: { neck: 3, legs: 2, upperArm: 3, thigh: 3 },
      markings: [
        { on: 'neck', kind: 'spots', run: [0, 0.6], t: [0.15, 0.8], count: 7, size: [0.1, 0.14], seed: 4, group: 'Spot', color: '#4a3a2a' },
        { on: ['upperArm', 'thigh'], kind: 'spots', count: 9, size: [0.08, 0.12], seed: 7, group: 'Spot', color: '#4a3a2a' },
      ],
    };
  })(),
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  wolf: { common: 'wolf', aliases: ['grey wolf', 'gray wolf', 'timber wolf'], sci: 'Canis lupus', size: '0.80 m at the withers', source: 'published grey wolf figures' },
  dog: { common: 'dog', aliases: ['puppy', 'pup', 'doggy', 'labrador', 'labrador retriever', 'retriever', 'hound'], sci: 'Canis familiaris', size: '0.58 m at the withers (a Labrador)', source: 'AKC Labrador Retriever standard' },
  coyote: { common: 'coyote', aliases: [], sci: 'Canis latrans', size: '0.60 m at the shoulder; head-body ~0.85 m', source: 'Bekoff 1977, Mammalian Species 79' },
  hyena: { common: 'hyena', aliases: ['spotted hyena', 'hyaena'], sci: 'Crocuta crocuta', size: '0.80 m at the shoulder; head-body ~1.3 m', source: 'Kingdon 1997, The Kingdon Field Guide to African Mammals' },
  fox: { common: 'fox', aliases: ['red fox'], sci: 'Vulpes vulpes', size: '0.40 m at the shoulder; head-body 0.6–0.9 m', source: 'published red fox figures' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
};
