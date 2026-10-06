// FELINE — a long supple trunk slung between heavy forequarters and a lower back line, a short round skull with a short
// broad muzzle, small rounded ears, a long low-carried tail, big round digitigrade paws. Worked species: the African
// lion. See ../build.js for what every field does. Tables are authored at ~1.0 m withers (scale 1).

export const family = {
  family: 'feline',
  colors: {
    coat: '#b88b52', sock: '#b08450', ash: '#dcc7a2', ashAlt: '#cdb48a', brow: '#5a4128', iris: '#c8973a',
    ink: '#17130f', sclera: '#2b2116', nose: '#5a3a30', teeth: '#ece6d6', mouth: '#4e3430', tip: '#2a1f17', mane: '#7a5530',
  },
  joints: {
    neckBase: [0, 0.42, 0.78], neckTop: [0, 0.66, 0.86],
    shoulder: [0.16, 0.36, 0.72], elbow: [0.17, 0.28, 0.42], carpus: [0.15, 0.33, 0.13], forePaw: [0.15, 0.36, 0.074], foreToe: [0.15, 0.48, 0.064],
    hip: [0.13, -0.46, 0.70], stifle: [0.16, -0.28, 0.44], hock: [0.15, -0.57, 0.22], hindPaw: [0.15, -0.51, 0.074], hindToe: [0.15, -0.39, 0.064],
  },
  // a level trunk: deep chest, a moderate (not wasp) waist, the rump a little lower and narrower than the shoulders
  torso: [
    { at: [0, -0.64, 0.70], r: [0.11, 0.10] },
    { at: [0, -0.48, 0.70], r: [0.15, 0.15] },
    { at: [0, -0.24, 0.70], r: [0.13, 0.155] },
    { at: [0, 0.02, 0.70], r: [0.15, 0.19] },
    { at: [0, 0.24, 0.70], r: [0.165, 0.20] },
    { at: [0, 0.40, 0.70], r: [0.15, 0.19] },
  ],
  torsoCaps: { back: [0, -0.72, 0.70], tip: [0, 0.50, 0.68] },
  neckRA: [0.14, 0.17], neckRB: [0.10, 0.11], neckRMid: [0.12, 0.14],
  // a long thin tail: off the rump, hanging in a curve to near the hock, the end lifted
  tail: [[0, -0.64, 0.76, 0.045], [0, -0.74, 0.70, 0.04], [0, -0.80, 0.56, 0.035], [0, -0.85, 0.36, 0.032], [0, -0.90, 0.22, 0.03], [0, -0.98, 0.17, 0.028]],
  tip: [[0, -0.97, 0.17, 0.035], [0, -1.02, 0.18, 0.055], [0, -1.07, 0.20, 0.04]],
  tipCaps: { back: [0, -0.95, 0.17], tip: [0, -1.10, 0.21] },
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.095, 0.14], [0.065, 0.07], 'Coat', [0.6, 0.5], [0.085, 0.105]],
    ['foreArmR', 'elbow', 'carpus', [0.065, 0.07], [0.045, 0.047], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.046, 0.045, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.08, 0.052], [0.076, 0.04], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.12, 0.165], [0.065, 0.07], 'Coat', [0.2, 0.5], [0.10, 0.13]],
    ['shinR', 'stifle', 'hock', [0.06, 0.07], [0.04, 0.045], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.042, 0.04, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.074, 0.048], [0.07, 0.038], 'Sock', [0.6, 0.4]],
  ],
  // skull rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] — a domed round braincase, broad cheeks, a short
  // blunt muzzle (rows st3..st6 packed close), a deep chin
  craniumRows: [
    ['st0', -0.15, 0.05, [0.035, 0.048], [0.065, 0.02], [0.07, -0.02], [0.06, -0.05], [0.04, -0.065], -0.07],
    ['st1', -0.09, 0.115, [0.03, 0.11], [0.08, 0.06], [0.10, -0.01], [0.09, -0.05], [0.055, -0.075], -0.08],
    ['st2', -0.02, 0.11, [0.04, 0.105], [0.088, 0.05], [0.11, -0.005], [0.095, -0.05], [0.055, -0.078], -0.08],
    ['st3', 0.04, 0.055, [0.02, 0.053], [0.06, 0.03], [0.075, -0.015], [0.065, -0.05], [0.045, -0.072], -0.072],
    ['st4', 0.09, 0.03, [0.022, 0.028], [0.045, 0.008], [0.055, -0.02], [0.05, -0.05], [0.038, -0.066], -0.066],
    ['st5', 0.13, 0.018, [0.02, 0.015], [0.035, -0.002], [0.042, -0.025], [0.04, -0.05], [0.03, -0.062], -0.06],
    ['st6', 0.16, 0.006, [0.014, 0.004], [0.026, -0.004], [0.03, -0.028], [0.028, -0.046], [0.022, -0.056], -0.054],
  ],
  craniumCaps: { back: [0, -0.18, 0.01], tip: [0, 0.172, -0.025] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.07, { gum: -0.078, gumR: [0.05, -0.078], jaw: [0.056, -0.105], bottom: -0.12 }],
    ['st1', 0.0, { gum: -0.078, gumR: [0.045, -0.078], jaw: [0.05, -0.102], bottom: -0.114 }],
    ['st2', 0.06, { gum: -0.068, gumR: [0.036, -0.068], jaw: [0.04, -0.09], bottom: -0.1 }],
    ['st3', 0.11, { gum: -0.06, gumR: [0.028, -0.06], jaw: [0.03, -0.08], bottom: -0.088 }],
    ['st4', 0.15, { gum: -0.054, gumR: [0.02, -0.054], jaw: [0.022, -0.07], bottom: -0.078 }],
  ],
  jawCaps: { back: [0, -0.1, -0.1], tip: [0, 0.162, -0.064] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.3, nape: [0, -0.1, -0.05],
  eyeAt: [2.6, 2.4], eyeR: 0.022, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.022, 0.018], webCranium: [1.7, 3.3, 4.97],
  // small rounded ears set wide on the skull
  earAt: [1.2, 1.8], earSpine: [[0, 0, -0.012], [0, 0, 0.012], [0, 0, 0.035], [0, 0, 0.055], [0, 0, 0.07]],
  earR: [0.04, 0.042, 0.036, 0.022], earSquash: [1, 0.4], earH: 1,
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // AFRICAN LION, adult male (Panthera leo). Thesis: long low supple trunk behind heavy forequarters, level back ·
  // digitigrade, big round paws · round skull, short broad muzzle, small round ears · THE MANE framing the head over
  // neck and shoulders, and the long tail with a dark terminal tuft · 1.20 m at the shoulder (males ~1.2 m,
  // Haas, Hayssen & Krausman 2005, Mammalian Species 762).
  lion: {
    family: 'feline', name: 'an African lion', scale: 1.21,
        joints: { maneBack: [0, 0.24, 0.82], maneFront: [0, 0.57, 0.92] },
    extraSegments: [
      { name: 'mane', kind: 'segment', from: 'maneBack', to: 'maneFront', rA: [0.17, 0.17], rB: [0.24, 0.30], rMid: [0.22, 0.26], slots: 'ring12', over: [0.3, 0.4], group: 'Mane', mirror: 'plane' },
    ],
    headScale: 1.55, muzzleW: 1.25, muzzleLen: 0.65, earH: 1.3, bulk: 1.38, legBulk: 1.5,
  },
};
