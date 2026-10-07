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

  // WHITE RHINOCEROS (Ceratotherium simum). Thesis: a long barrel on longer columnar legs than the hippo (belly ~0.6 m
  // up) with round three-toed feet · a muscular SHOULDER HUMP · a long low-carried head (muzzle near the ground) with
  // a dished profile, a broad square lip, tube ears on top at the back · TWO NASAL HORNS, a long front, a short rear ·
  // a thin tail · body ~3.8 m, 1.75 m at the shoulder (adult male figures, Owen-Smith 1988 / IUCN: 3.7–4.0 m long,
  // 1.7–1.85 m shoulder).
  rhino: {
    family: 'pachyderm', name: 'a white rhinoceros', scale: 1,
    colors: { coat: '#7d7577', sock: '#716a6c', ash: '#857c7c', ashAlt: '#7a7272', mouth: '#5e4e4e' },
    joints: {
      neckBase: [0, 0.92, 1.22], neckTop: [0, 1.46, 0.98],
      shoulder: [0.36, 0.80, 1.05], elbow: [0.40, 0.86, 0.58], carpus: [0.37, 0.92, 0.24], forePaw: [0.37, 0.94, 0.13], foreToe: [0.37, 1.04, 0.10],
      hip: [0.34, -0.92, 1.10], stifle: [0.40, -0.75, 0.62], hock: [0.37, -0.98, 0.28], hindPaw: [0.37, -0.94, 0.13], hindToe: [0.37, -0.84, 0.10],
      ...Object.fromEntries([['fore', 0.97, 1.07], ['hind', -0.89, -0.79]].flatMap(([leg, y0, y1]) => [-0.085, 0, 0.085].flatMap((dx, i) => [
        [`${leg}Hoof${i}BaseR`, [0.37 + dx, y0, 0.065]], [`${leg}Hoof${i}TipR`, [0.37 + dx * 1.3, y1 - Math.abs(dx) * 0.3, 0.05]]]))),
    },
    torso: [
      { at: [0, -1.30, 1.15], r: [0.42, 0.45] },
      { at: [0, -1.05, 1.15], r: [0.58, 0.56] },
      { at: [0, -0.55, 1.15], r: [0.62, 0.55] },
      { at: [0, 0.05, 1.15], r: [0.64, 0.56] },
      { at: [0, 0.55, 1.15], r: [0.60, 0.74] },
      { at: [0, 0.95, 1.15], r: [0.50, 0.62] },
    ],
    torsoCaps: { back: [0, -1.46, 1.19], tip: [0, 1.12, 1.19] },
    tail: [[0, -1.40, 1.45, 0.05], [0, -1.50, 1.30, 0.045], [0, -1.53, 1.10, 0.04]],
    tip: [[0, -1.53, 1.13, 0.04], [0, -1.535, 1.02, 0.05], [0, -1.54, 0.95, 0.03]],
    tipCaps: { back: [0, -1.53, 1.16], tip: [0, -1.54, 0.92] },
    // a long head, the occiput high at the back, a dished face, a broad square lip
    craniumRows: [
      ['st0', -0.40, 0.20, [0.08, 0.18], [0.14, 0.10], [0.17, -0.02], [0.15, -0.13], [0.10, -0.18], -0.19],
      ['st1', -0.22, 0.14, [0.10, 0.12], [0.17, 0.06], [0.19, -0.04], [0.17, -0.15], [0.11, -0.20], -0.21],
      ['st2', -0.02, 0.05, [0.08, 0.045], [0.14, 0.02], [0.16, -0.05], [0.15, -0.15], [0.10, -0.19], -0.20],
      ['st3', 0.18, 0.08, [0.07, 0.065], [0.12, 0.02], [0.14, -0.05], [0.14, -0.14], [0.10, -0.18], -0.19],
      ['st4', 0.36, 0.07, [0.07, 0.055], [0.12, 0.01], [0.14, -0.05], [0.14, -0.14], [0.11, -0.17], -0.18],
      ['st5', 0.50, 0.03, [0.07, 0.02], [0.14, -0.02], [0.17, -0.07], [0.17, -0.14], [0.14, -0.17], -0.17],
      ['st6', 0.58, -0.02, [0.06, -0.03], [0.13, -0.05], [0.16, -0.09], [0.16, -0.14], [0.13, -0.16], -0.16],
    ],
    craniumCaps: { back: [0, -0.46, 0.04], tip: [0, 0.62, -0.10] },
    muzzleFrom: 4,
    jawRows: [
      ['st0', -0.30, { gum: -0.19, gumR: [0.13, -0.19], jaw: [0.15, -0.26], bottom: -0.29 }],
      ['st1', -0.05, { gum: -0.19, gumR: [0.13, -0.19], jaw: [0.15, -0.26], bottom: -0.29 }],
      ['st2', 0.20, { gum: -0.18, gumR: [0.12, -0.18], jaw: [0.13, -0.24], bottom: -0.26 }],
      ['st3', 0.42, { gum: -0.17, gumR: [0.14, -0.17], jaw: [0.15, -0.22], bottom: -0.24 }],
      ['st4', 0.56, { gum: -0.16, gumR: [0.13, -0.16], jaw: [0.14, -0.20], bottom: -0.21 }],
    ],
    jawCaps: { back: [0, -0.36, -0.24], tip: [0, 0.60, -0.18] },
    // the head carried low, nose down: the whole skull, jaw and all they carry turned about the nape
    headPitch: -14,
    headScale: 1.2, nape: [0, -0.30, -0.02],
    eyeAt: [1.3, 2.6], nostrilAt: [5.6, 2.5], noseAt: [5.8, 2.4], noseR: [0.02, 0.015],
    // tube ears: tall, near-round in section, up off the back of the crown
    earAt: [0.5, 1.3], earSpine: [[0, 0, -0.01], [0, 0, 0.06], [0, 0, 0.13], [0, 0, 0.19]], earR: [0.055, 0.06, 0.045], earSquash: [1, 0.8], earH: 1.5,
    headOrnaments: [
      { kind: 'sweep', name: 'hornFront', at: [4.0, 0.0001], side: 'R', space: 'head', spine: [[0, 0.42, 0.035], [0, 0.46, 0.195], [0, 0.46, 0.345], [0, 0.42, 0.485], [0, 0.36, 0.57]], radii: [0.08, 0.065, 0.045, 0.025, 0.006], m: 8, group: 'Horn' },
      { kind: 'sweep', name: 'hornRear', at: [3.0, 0.0001], side: 'R', space: 'head', spine: [[0, 0.18, 0.065], [0, 0.19, 0.158], [0, 0.17, 0.233]], radii: [0.065, 0.045, 0.01], m: 8, group: 'Horn' },
    ],
    // three toes per foot: broad nail-tipped nubs round the front of each pad
    extraSegments: [['fore'], ['hind']].flatMap(([leg]) => [0, 1, 2].map((i) => ({
      name: `${leg}Hoof${i}R`, kind: 'segment', from: `${leg}Hoof${i}BaseR`, to: `${leg}Hoof${i}TipR`, rA: 0.065, rB: 0.05, slots: 'ring12', group: 'Hoof', mirror: 'name', over: [0.3, 0.3],
    }))),
  },

  // AFRICAN BUSH ELEPHANT (Loxodonta africana). Thesis: a short deep trunk HIGH on long straight COLUMNAR legs
  // (belly ~1.3 m up), round padded feet with nail nubs · the back highest at the shoulder, sloping to the rump · a
  // huge tall-domed head on almost no neck · HUGE FAN EARS hanging over the shoulders · the TRUNK hanging to near the
  // ground, TUSKS curving forward out of the lip · a thin tail with a tuft to the hocks · 3.2 m at the shoulder
  // (adult bull mean, Larramendi 2016 "Shoulder height, body mass and shape of proboscideans": 3.20 m). Authored at
  // hippo units (1.6 m) and scaled 2.0.
  elephant: (() => {
    const fore = [0.31, 0.73], hind = [0.30, -0.80];
    const nails = Object.fromEntries([['fore', ...fore], ['hind', ...hind]].flatMap(([leg, x, y]) => [-0.09, -0.03, 0.03, 0.09].flatMap((dx, i) => [
      [`${leg}Nail${i}BaseR`, [x + dx * 1.3, y + 0.10 - Math.abs(dx) * 0.4, 0.06]], [`${leg}Nail${i}TipR`, [x + dx * 1.45, y + 0.15 - Math.abs(dx) * 0.4, 0.05]]])));
    return {
      family: 'pachyderm', name: 'an African bush elephant', scale: 2.0,
      colors: { coat: '#7c7674', sock: '#6f6967', ash: '#857e7b', ashAlt: '#787170', mouth: '#5e4e4e', horn: '#e6dcc2', hoof: '#cfc6b0' },
      joints: {
        neckBase: [0, 0.85, 1.30], neckTop: [0, 1.05, 1.38],
        shoulder: [0.30, 0.66, 1.15], elbow: [0.32, 0.70, 0.70], carpus: [0.31, 0.72, 0.24], forePaw: [fore[0], fore[1], 0.12], foreToe: [fore[0], fore[1] + 0.10, 0.10],
        hip: [0.28, -0.76, 1.10], stifle: [0.31, -0.68, 0.66], hock: [0.30, -0.80, 0.24], hindPaw: [hind[0], hind[1], 0.12], hindToe: [hind[0], hind[1] + 0.10, 0.10],
        ...nails,
      },
      // the back highest over the shoulder, falling to the rump (torsoUp: stations at different heights)
      torsoUp: true,
      torso: [
        { at: [0, -0.95, 0.98], r: [0.36, 0.34] },
        { at: [0, -0.78, 1.01], r: [0.48, 0.44] },
        { at: [0, -0.35, 1.10], r: [0.54, 0.49], top: 0.02 },
        { at: [0, 0.15, 1.13], r: [0.55, 0.50], top: 0.05 },
        { at: [0, 0.55, 1.16], r: [0.50, 0.47], top: 0.12 },
        { at: [0, 0.85, 1.18], r: [0.40, 0.40], top: 0.06 },
      ],
      torsoCaps: { back: [0, -1.07, 1.03], tip: [0, 0.97, 1.22] },
      neckRA: [0.40, 0.42], neckRB: [0.30, 0.34], neckRMid: [0.36, 0.38],
      legs: [
        ['upperArmR', 'shoulder', 'elbow', [0.17, 0.20], [0.14, 0.15], 'Coat', [0.6, 0.5], [0.17, 0.19]],
        ['foreArmR', 'elbow', 'carpus', [0.14, 0.15], [0.13, 0.13], 'Coat', [0.5, 0.4]],
        ['pasternR', 'carpus', 'forePaw', 0.13, 0.15, 'Sock', [0.4, 0.4]],
        ['forePawR', 'forePaw', 'foreToe', [0.16, 0.08], [0.15, 0.07], 'Sock', [0.6, 0.4]],
        ['thighR', 'hip', 'stifle', [0.19, 0.24], [0.15, 0.16], 'Coat', [0.2, 0.5], [0.18, 0.21]],
        ['shinR', 'stifle', 'hock', [0.14, 0.15], [0.13, 0.13], 'Coat', [0.5, 0.4]],
        ['metaR', 'hock', 'hindPaw', 0.13, 0.15, 'Sock', [0.4, 0.4]],
        ['hindPawR', 'hindPaw', 'hindToe', [0.16, 0.08], [0.15, 0.07], 'Sock', [0.6, 0.4]],
      ],
      tail: [[0, -1.08, 1.30, 0.035], [0, -1.15, 1.05, 0.03], [0, -1.16, 0.72, 0.025]],
      tip: [[0, -1.16, 0.76, 0.025], [0, -1.16, 0.64, 0.04], [0, -1.16, 0.56, 0.02]],
      tipCaps: { back: [0, -1.16, 0.80], tip: [0, -1.16, 0.53] },
      // a tall domed skull, a near-vertical forehead, the face narrowing down into the trunk
      craniumRows: [
        ['st0', -0.24, 0.20, [0.10, 0.18], [0.20, 0.10], [0.24, -0.02], [0.21, -0.16], [0.13, -0.24], -0.26],
        ['st1', -0.10, 0.33, [0.13, 0.30], [0.23, 0.17], [0.26, 0.0], [0.22, -0.16], [0.14, -0.25], -0.27],
        ['st2', 0.04, 0.35, [0.13, 0.32], [0.22, 0.18], [0.24, 0.0], [0.20, -0.17], [0.13, -0.25], -0.27],
        ['st3', 0.15, 0.30, [0.12, 0.27], [0.19, 0.14], [0.20, -0.02], [0.17, -0.17], [0.11, -0.24], -0.26],
        ['st4', 0.23, 0.18, [0.10, 0.16], [0.16, 0.08], [0.17, -0.04], [0.14, -0.16], [0.10, -0.22], -0.24],
        ['st5', 0.29, 0.06, [0.09, 0.05], [0.13, 0.0], [0.14, -0.06], [0.12, -0.14], [0.09, -0.20], -0.22],
        ['st6', 0.32, -0.04, [0.07, -0.04], [0.10, -0.07], [0.11, -0.10], [0.10, -0.15], [0.07, -0.19], -0.20],
      ],
      craniumCaps: { back: [0, -0.30, 0.02], tip: [0, 0.34, -0.12] },
      muzzleFrom: 3,
      jawRows: [
        ['st0', -0.16, { gum: -0.25, gumR: [0.11, -0.25], jaw: [0.12, -0.31], bottom: -0.33 }],
        ['st1', -0.02, { gum: -0.25, gumR: [0.10, -0.25], jaw: [0.11, -0.31], bottom: -0.33 }],
        ['st2', 0.08, { gum: -0.24, gumR: [0.08, -0.24], jaw: [0.08, -0.29], bottom: -0.31 }],
        ['st3', 0.14, { gum: -0.23, gumR: [0.06, -0.23], jaw: [0.06, -0.27], bottom: -0.29 }],
        ['st4', 0.19, { gum: -0.22, gumR: [0.04, -0.22], jaw: [0.04, -0.25], bottom: -0.26 }],
      ],
      jawCaps: { back: [0, -0.22, -0.28], tip: [0, 0.22, -0.24] },
      headScale: 1, nape: [0, -0.25, 0.0],
      eyeAt: [2.6, 2.4], eyeR: 0.025, nose: false, nostrilAt: [6.0, 0.5],
      // the ears, the trunk and the tusks are head ornaments (head units, +y front, +z up)
      ears: false,
      headOrnaments: [
        { kind: 'sweep', name: 'fanEar', at: [1.0, 2.0], space: 'head', spine: [[0.23, -0.10, 0.17], [0.40, -0.34, 0.20], [0.56, -0.46, -0.08], [0.60, -0.46, -0.42], [0.57, -0.36, -0.68]], radii: [0.08, 0.40, 0.48, 0.38, 0.10], m: 8, squash: [1, 0.12], group: 'Ears' },
        { kind: 'sweep', name: 'trunk', at: [6.0, 0.0001], side: 'R', space: 'head', spine: [[0, 0.24, 0.0], [0, 0.34, -0.22], [0, 0.38, -0.55], [0, 0.38, -0.85], [0, 0.37, -1.10], [0, 0.41, -1.24]], radii: [0.14, 0.12, 0.095, 0.075, 0.06, 0.045], m: 10, group: 'Skull' },
        { kind: 'sweep', name: 'tusk', at: [4.5, 4.5], space: 'head', spine: [[0.10, 0.20, -0.22], [0.13, 0.32, -0.38], [0.14, 0.45, -0.45], [0.13, 0.56, -0.42]], radii: [0.05, 0.045, 0.035, 0.012], m: 8, group: 'Horn' },
      ],
      extraSegments: [['fore'], ['hind']].flatMap(([leg]) => [0, 1, 2, 3].map((i) => ({
        name: `${leg}Nail${i}R`, kind: 'segment', from: `${leg}Nail${i}BaseR`, to: `${leg}Nail${i}TipR`, rA: 0.045, rB: 0.035, slots: 'ring12', group: 'Hoof', mirror: 'name', over: [0.3, 0.3],
      }))),
    };
  })(),
};

// WOOLLY MAMMOTH (Mammuthus primigenius). Thesis: the elephant's plan with a STEEPLY SLOPING back: a HIGH SHOULDER HUMP
// over the forelegs, a neck dip behind the head, the back falling to low hindquarters on shorter hind legs · a tall
// single-DOMED head carried high · SMALL ears (cold-adapted) · a SHAGGY dark coat, long hair hanging from the flanks
// and belly · LONG TUSKS curving down, out, up and in at the tips · a short tail · 2.9 m at the shoulder (adult bull,
// Larramendi 2016 "Shoulder height, body mass and shape of proboscideans": woolly mammoth bulls ~2.7–3.1 m). Built
// over the elephant's tables (elephant units, the whole animal scaled).
species.mammoth = (() => {
  const E = species.elephant;
  return {
    ...E, name: 'a woolly mammoth', scale: 1.6,
    colors: { coat: '#4e3424', sock: '#3c281c', ash: '#5e3e28', ashAlt: '#6c4a30', mane: '#5a3a24', mouth: '#4e3a30', horn: '#e8dcbc', hoof: '#bfb39a', tip: '#3a2618', ears: '#3c281c' },
    joints: {
      ...E.joints,
      neckBase: [0, 0.82, 1.36], neckTop: [0, 1.02, 1.42],
      hip: [0.27, -0.74, 0.92], stifle: [0.30, -0.66, 0.56], hock: [0.30, -0.80, 0.22],
    },
    // the back: the shoulder hump highest, falling steeply to a low rump
    torso: [
      { at: [0, -0.92, 0.84], r: [0.34, 0.33] },
      { at: [0, -0.75, 0.88], r: [0.46, 0.43] },
      { at: [0, -0.35, 0.98], r: [0.53, 0.48] },
      { at: [0, 0.15, 1.10], r: [0.55, 0.52], top: 0.12 },
      { at: [0, 0.52, 1.16], r: [0.50, 0.50], top: 0.42 },
      { at: [0, 0.82, 1.20], r: [0.40, 0.42], top: 0.12 },
    ],
    torsoCaps: { back: [0, -1.03, 0.90], tip: [0, 0.95, 1.24] },
    tail: [[0, -1.03, 1.10, 0.035], [0, -1.08, 0.96, 0.03], [0, -1.09, 0.80, 0.025]],
    tip: [[0, -1.09, 0.83, 0.03], [0, -1.09, 0.72, 0.06], [0, -1.09, 0.64, 0.025]],
    tipCaps: { back: [0, -1.09, 0.87], tip: [0, -1.09, 0.61] },
    // the tall single DOME: the crown peaked high and narrow at st1, the face falling steep to the trunk
    craniumRows: [
      ['st0', -0.24, 0.24, [0.10, 0.22], [0.20, 0.10], [0.24, -0.02], [0.21, -0.16], [0.13, -0.24], -0.26],
      ['st1', -0.10, 0.48, [0.09, 0.42], [0.21, 0.20], [0.25, 0.0], [0.22, -0.16], [0.14, -0.25], -0.27],
      ['st2', 0.04, 0.44, [0.10, 0.38], [0.21, 0.20], [0.24, 0.0], [0.20, -0.17], [0.13, -0.25], -0.27],
      ['st3', 0.15, 0.30, [0.11, 0.27], [0.19, 0.14], [0.20, -0.02], [0.17, -0.17], [0.11, -0.24], -0.26],
      ['st4', 0.23, 0.18, [0.10, 0.16], [0.16, 0.08], [0.17, -0.04], [0.14, -0.16], [0.10, -0.22], -0.24],
      ['st5', 0.29, 0.06, [0.09, 0.05], [0.13, 0.0], [0.14, -0.06], [0.12, -0.14], [0.09, -0.20], -0.22],
      ['st6', 0.32, -0.04, [0.07, -0.04], [0.10, -0.07], [0.11, -0.10], [0.10, -0.15], [0.07, -0.19], -0.20],
    ],
    headOrnaments: [
      // SMALL ears, close to the head
      { kind: 'sweep', name: 'ear', at: [1.0, 2.0], space: 'head', spine: [[0.23, -0.10, 0.12], [0.30, -0.18, 0.10], [0.33, -0.22, -0.02], [0.32, -0.20, -0.14]], radii: [0.06, 0.14, 0.13, 0.04], m: 8, squash: [1, 0.2], group: 'Ears' },
      { kind: 'sweep', name: 'trunk', at: [6.0, 0.0001], side: 'R', space: 'head', spine: [[0, 0.24, 0.0], [0, 0.34, -0.22], [0, 0.38, -0.55], [0, 0.38, -0.85], [0, 0.37, -1.10], [0, 0.41, -1.24]], radii: [0.14, 0.12, 0.095, 0.075, 0.06, 0.045], m: 10, group: 'Skull' },
      // the LONG curved tusks: down and forward out of the lip, sweeping out and up, the tips turning in
      { kind: 'sweep', name: 'tusk', at: [4.5, 4.5], space: 'head', spine: [[0.11, 0.20, -0.22], [0.15, 0.36, -0.42], [0.24, 0.58, -0.54], [0.36, 0.82, -0.54], [0.46, 1.04, -0.42], [0.48, 1.20, -0.24], [0.38, 1.28, -0.10], [0.18, 1.26, -0.04]], radii: [0.105, 0.10, 0.093, 0.083, 0.07, 0.054, 0.036, 0.014], m: 10, group: 'Horn' },
    ],
    // the SHAGGY coat: long hair tiles hanging off the flanks and the belly
    bodyTiles: [
      { id: 'shag', parts: ['torso'], s: [0.2, 5.0], t: [2.0, 6.0], grid: [12, 5], brick: true, sides: 3, coverage: 1.3, inset: 0.85, height: 0.18, lean: -1.4, edgeFade: 0.15, thin: 0.35, wobble: 0.3, jitter: 0.3, group: ['Fur', 'FurAlt'] },
      // the hair carried on down over the upper legs and round the short neck (a skirt, not bare elephant limbs)
      { id: 'legShag', parts: ['upperArmR', 'thighR'], s: [0.1, 1.6], t: [0, 6], grid: [5, 4], brick: true, sides: 3, coverage: 1.6, inset: 0.85, height: 0.13, lean: -1.3, edgeFade: 0.2, thin: 0.35, wobble: 0.3, jitter: 0.3, group: ['Fur', 'FurAlt'] },
      { id: 'neckShag', parts: ['neck'], s: [0.1, 1.2], t: [0, 6], grid: [6, 4], brick: true, sides: 3, coverage: 1.5, inset: 0.85, height: 0.14, lean: -1.3, edgeFade: 0.2, thin: 0.35, wobble: 0.3, jitter: 0.3, group: ['Fur', 'FurAlt'] },
    ],
  };
})();

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  hippo: { common: 'hippo', aliases: ['hippopotamus'], sci: 'Hippopotamus amphibius', size: '1.5 m at the shoulder; body ~3.6 m', source: 'Eltringham 1999 / IUCN' },
  rhino: { common: 'rhino', aliases: ['rhinoceros', 'white rhino'], sci: 'Ceratotherium simum', size: '1.75 m at the shoulder; body ~3.8 m', source: 'Owen-Smith 1988 / IUCN' },
  elephant: { common: 'elephant', aliases: ['african elephant', 'bush elephant'], sci: 'Loxodonta africana', size: '3.2 m at the shoulder (adult bull)', source: 'Larramendi 2016, Shoulder height, body mass and shape of proboscideans' },
  mammoth: { common: 'mammoth', aliases: ['woolly mammoth'], sci: 'Mammuthus primigenius', size: '2.9 m at the shoulder (adult bull)', source: 'Larramendi 2016, Shoulder height, body mass and shape of proboscideans' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
};
