// PACHYDERM — a barrel trunk slung low on short columnar legs with round toed feet, a short thick neck, a massive
// head, a short tail, a hairless hide. Authored at hippo size (metres). Worked species: the common hippopotamus.
// Later: a rhino (horns as headOrnaments, a longer head), a wombat (scale ~0.25). See ../build.js.

export const family = {
  family: 'pachyderm',
  colors: {
    coat: '#6f6064', sock: '#655759', ash: '#a9817c', ashAlt: '#9a746f', brow: '#4a3e40', iris: '#3a2618',
    ink: '#140f0f', sclera: '#2b2116', nose: '#2a2022', teeth: '#ece6d6', mouth: '#7a4a4a', tip: '#5a4c50', hoof: '#3e3436',
  },
  joints: {
    neckBase: [0, 0.85, 1.0], neckTop: [0, 1.18, 0.98],
    shoulder: [0.36, 0.80, 0.82], elbow: [0.40, 0.86, 0.40], carpus: [0.37, 0.92, 0.18], forePaw: [0.37, 0.94, 0.12], foreToe: [0.37, 1.04, 0.10],
    foreToe0BaseR: [0.27, 0.97, 0.065], foreToe0TipR: [0.23, 1.050, 0.05],
    foreToe1BaseR: [0.335, 0.97, 0.065], foreToe1TipR: [0.321, 1.076, 0.05],
    foreToe2BaseR: [0.405, 0.97, 0.065], foreToe2TipR: [0.419, 1.076, 0.05],
    foreToe3BaseR: [0.47, 0.97, 0.065], foreToe3TipR: [0.51, 1.050, 0.05],
    hindToe0BaseR: [0.27, -0.89, 0.065], hindToe0TipR: [0.23, -0.810, 0.05],
    hindToe1BaseR: [0.335, -0.89, 0.065], hindToe1TipR: [0.321, -0.784, 0.05],
    hindToe2BaseR: [0.405, -0.89, 0.065], hindToe2TipR: [0.419, -0.784, 0.05],
    hindToe3BaseR: [0.47, -0.89, 0.065], hindToe3TipR: [0.51, -0.810, 0.05],
    hip: [0.34, -0.92, 0.86], stifle: [0.40, -0.80, 0.40], hock: [0.37, -0.95, 0.20], hindPaw: [0.37, -0.92, 0.12], hindToe: [0.37, -0.82, 0.10],
  },
  // a barrel: widest mid-trunk, the belly ~0.45 m off the ground, the back nearly level
  torso: [
    { at: [0, -1.30, 0.88], r: [0.40, 0.46] },
    { at: [0, -1.05, 0.88], r: [0.60, 0.61] },
    { at: [0, -0.55, 0.88], r: [0.68, 0.63] },
    { at: [0, 0.05, 0.88], r: [0.71, 0.64] },
    { at: [0, 0.55, 0.88], r: [0.66, 0.62] },
    { at: [0, 0.95, 0.88], r: [0.54, 0.56] },
  ],
  torsoCaps: { back: [0, -1.46, 0.92], tip: [0, 1.12, 0.92] },
  neckRA: [0.46, 0.44], neckRB: [0.34, 0.33], neckRMid: [0.41, 0.39],
  // a short flat-ish tail hanging off the rump
  tail: [[0, -1.38, 1.14, 0.07], [0, -1.47, 1.04, 0.07], [0, -1.49, 0.90, 0.06]],
  tip: [[0, -1.49, 0.93, 0.055], [0, -1.495, 0.84, 0.05], [0, -1.50, 0.78, 0.03]],
  tipCaps: { back: [0, -1.49, 0.96], tip: [0, -1.50, 0.75] },
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.22, 0.27], [0.17, 0.18], 'Coat', [0.6, 0.5], [0.20, 0.22]],
    ['foreArmR', 'elbow', 'carpus', [0.17, 0.18], [0.15, 0.15], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.15, 0.165, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.17, 0.095], [0.15, 0.075], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.26, 0.32], [0.18, 0.19], 'Coat', [0.2, 0.5], [0.23, 0.27]],
    ['shinR', 'stifle', 'hock', [0.18, 0.19], [0.15, 0.15], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.15, 0.165, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.17, 0.095], [0.15, 0.075], 'Sock', [0.6, 0.4]],
  ],
  // skull rows (metres at headScale 1): [id, y, top, crown, brow, cheek, jowl, lip, palate]. A boxy head: raised
  // eye turrets (st1), a waist behind the muzzle (st3), a broad square muzzle (st5) with the nostrils on top
  craniumRows: [
    ['st0', -0.30, 0.15, [0.08, 0.145], [0.17, 0.07], [0.21, -0.06], [0.19, -0.17], [0.12, -0.22], -0.23],
    ['st1', -0.14, 0.17, [0.12, 0.235], [0.22, 0.13], [0.24, -0.04], [0.22, -0.17], [0.14, -0.22], -0.23],
    ['st2', 0.02, 0.15, [0.08, 0.14], [0.17, 0.07], [0.21, -0.05], [0.20, -0.16], [0.14, -0.21], -0.22],
    ['st3', 0.18, 0.115, [0.06, 0.11], [0.13, 0.055], [0.16, -0.04], [0.17, -0.15], [0.13, -0.19], -0.20],
    ['st4', 0.33, 0.12, [0.08, 0.115], [0.17, 0.065], [0.20, -0.03], [0.21, -0.15], [0.16, -0.19], -0.20],
    ['st5', 0.47, 0.15, [0.10, 0.165], [0.21, 0.07], [0.245, -0.03], [0.245, -0.15], [0.18, -0.19], -0.20],
    ['st6', 0.58, 0.10, [0.09, 0.095], [0.18, 0.05], [0.21, -0.04], [0.21, -0.14], [0.16, -0.18], -0.19],
  ],
  craniumCaps: { back: [0, -0.36, 0.0], tip: [0, 0.62, -0.03] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.20, { gum: -0.22, gumR: [0.15, -0.22], jaw: [0.17, -0.30], bottom: -0.33 }],
    ['st1', 0.05, { gum: -0.21, gumR: [0.15, -0.21], jaw: [0.17, -0.29], bottom: -0.32 }],
    ['st2', 0.25, { gum: -0.20, gumR: [0.15, -0.20], jaw: [0.17, -0.27], bottom: -0.30 }],
    ['st3', 0.44, { gum: -0.20, gumR: [0.19, -0.20], jaw: [0.21, -0.29], bottom: -0.33 }],
    ['st4', 0.57, { gum: -0.19, gumR: [0.17, -0.19], jaw: [0.18, -0.27], bottom: -0.30 }],
  ],
  jawCaps: { back: [0, -0.27, -0.28], tip: [0, 0.60, -0.22] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st1.brow', 0.8, [0, 0, 1]], ['st2.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st2.brow', 1, [-0.3, 0.2, -1]], ['st1.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st4.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.4, nape: [0, -0.22, -0.04],
  eyeAt: [1.0, 1.5], eyeR: 0.035, pupil: 'round', irisAngle: 40,
  browStrip: [[0.6, 1.7], [0.8, 1.6], [1.0, 1.55], [1.2, 1.6], [1.4, 1.7]],
  foldStrip: [[5.8, 4.6], [5.0, 4.7], [4.2, 4.7], [3.4, 4.75], [2.8, 4.8]],
  nostrilAt: [5.2, 0.6], noseAt: [5.0, 0.5], noseR: [0.035, 0.025], webCranium: [1.7, 3.3, 4.97],
  earAt: [0.25, 1.0], earSpine: [[0, 0, -0.01], [0, 0, 0.02], [0, 0, 0.06], [0, 0, 0.09]],
  earR: [0.04, 0.036, 0.02], earSquash: [1, 0.5], earH: 1,
  // four toes per foot: short nail-tipped nubs splayed around the front of each round pad
  extraSegments: [['fore', 0.97, 1.09], ['hind', -0.89, -0.77]].flatMap(([leg, y0, y1]) => [-0.10, -0.035, 0.035, 0.10].map((dx, i) => ({
    name: `${leg}Toe${i}R`, kind: 'segment', from: `${leg}Toe${i}BaseR`, to: `${leg}Toe${i}TipR`, rA: 0.055, rB: 0.045, slots: 'ring12', group: 'Hoof', mirror: 'name', over: [0.3, 0.3],
  }))),
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

export const species = {
  // COMMON HIPPOPOTAMUS (Hippopotamus amphibius). Thesis: an enormous barrel slung low (belly ~0.45 m up) on very
  // short columnar legs with round four-toed feet · a huge boxy head with a broad square muzzle, eyes, tiny ears and
  // nostrils on top · a short thick neck, a short tail · body ~3.6 m, 1.5 m at the shoulder (adult male figures,
  // Eltringham 1999 / IUCN: 3.3–4.0 m long, 1.4–1.6 m shoulder).
  hippo: {
    family: 'pachyderm', name: 'a common hippopotamus', scale: 1,
  },
};
