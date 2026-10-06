// URSINE — a massive barrel trunk under a muscular shoulder hump, the rump lower than the hump, thick columnar legs
// on PLANTIGRADE feet (the whole sole flat, the heel on the ground: no raised hock), a big round head with a dished
// face and small round ears, a stub tail. Worked species: the brown bear. See ../build.js for what every field does.
// Authored at an adult brown bear's size (≈1.0 m at the withers, metres, +y front).

export const family = {
  family: 'ursine',
  colors: {
    coat: '#6b4a31', sock: '#4a3323', ash: '#8a6a4d', ashAlt: '#7a5c41', brow: '#3a281b', iris: '#5a3a1e',
    ink: '#120d09', sclera: '#20160f', nose: '#141010', teeth: '#e8e0cc', mouth: '#4a302a', tip: '#4a3323', snout: '#7d5e43',
  },
  joints: {
    neckBase: [0, 0.42, 0.83], neckTop: [0, 0.70, 0.78],
    // fore: a near-vertical column, elbow under the shoulder, the wrist low and the palm flat on the ground
    shoulder: [0.19, 0.28, 0.79], elbow: [0.21, 0.22, 0.45], carpus: [0.20, 0.28, 0.12], forePaw: [0.20, 0.31, 0.068], foreToe: [0.20, 0.53, 0.05],
    // hind: the knee low and forward, the shin down to a heel ON the ground (plantigrade), a long flat sole forward
    hip: [0.17, -0.58, 0.77], stifle: [0.19, -0.50, 0.45], hock: [0.18, -0.60, 0.11], hindPaw: [0.18, -0.57, 0.068], hindToe: [0.18, -0.34, 0.05],
    // the shoulder hump: a muscle mass over the forelegs, the highest point of the back
    humpA: [0, -0.02, 0.93], humpB: [0, 0.28, 1.04],
  },
  // the trunk: deep and broad, tallest at the shoulders, the rump lower (one centre height; radii shape the back line)
  torso: [
    { at: [0, -0.80, 0.75], r: [0.18, 0.15] },
    { at: [0, -0.64, 0.75], r: [0.26, 0.21] },
    { at: [0, -0.36, 0.75], r: [0.27, 0.255] },
    { at: [0, -0.06, 0.75], r: [0.29, 0.29] },
    { at: [0, 0.20, 0.75], r: [0.28, 0.31] },
    { at: [0, 0.42, 0.75], r: [0.23, 0.29] },
  ],
  torsoCaps: { back: [0, -0.90, 0.71], tip: [0, 0.54, 0.71] },
  extraSegments: [
    { name: 'hump', kind: 'segment', from: 'humpA', to: 'humpB', rA: [0.17, 0.14], rB: [0.15, 0.12], rMid: [0.22, 0.22], slots: 'ring12', group: 'Coat', mirror: 'plane', over: [0.5, 0.5] },
  ],
  neckRA: [0.22, 0.26], neckRB: [0.15, 0.17], neckRMid: [0.18, 0.21],
  // a stub: barely past the rump
  tail: [[0, -0.84, 0.76, 0.04], [0, -0.89, 0.72, 0.035], [0, -0.91, 0.67, 0.02]],
  tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.13, 0.17], [0.10, 0.11], 'Coat', [0.6, 0.5], [0.125, 0.15]],
    ['foreArmR', 'elbow', 'carpus', [0.10, 0.11], [0.08, 0.085], 'Coat', [0.5, 0.4]],
    ['wristR', 'carpus', 'forePaw', 0.08, 0.08, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.105, 0.055], [0.10, 0.04], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.16, 0.20], [0.11, 0.12], 'Coat', [0.2, 0.5], [0.15, 0.18]],
    ['shinR', 'stifle', 'hock', [0.10, 0.11], [0.08, 0.085], 'Coat', [0.5, 0.4]],
    ['heelR', 'hock', 'hindPaw', 0.08, 0.08, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.10, 0.055], [0.095, 0.04], 'Sock', [0.6, 0.4]],
  ],
  // skull rows (metres at headScale 1): a broad high round cranium, a dish (the stop) at st3, a level medium muzzle
  craniumRows: [
    ['st0', -0.16, 0.08, [0.06, 0.075], [0.11, 0.03], [0.12, -0.03], [0.10, -0.08], [0.06, -0.10], -0.11],
    ['st1', -0.08, 0.145, [0.065, 0.14], [0.14, 0.075], [0.16, 0.0], [0.13, -0.07], [0.07, -0.10], -0.11],
    ['st2', 0.0, 0.135, [0.055, 0.13], [0.125, 0.075], [0.155, -0.01], [0.12, -0.07], [0.07, -0.10], -0.10],
    ['st3', 0.06, 0.065, [0.03, 0.062], [0.07, 0.045], [0.085, -0.01], [0.08, -0.06], [0.06, -0.085], -0.09],
    ['st4', 0.13, 0.06, [0.025, 0.057], [0.05, 0.03], [0.06, -0.01], [0.058, -0.05], [0.045, -0.075], -0.08],
    ['st5', 0.20, 0.05, [0.02, 0.047], [0.04, 0.02], [0.045, -0.01], [0.044, -0.045], [0.035, -0.065], -0.07],
    ['st6', 0.25, 0.04, [0.015, 0.037], [0.03, 0.015], [0.034, -0.01], [0.032, -0.04], [0.026, -0.055], -0.06],
  ],
  craniumCaps: { back: [0, -0.20, 0.0], tip: [0, 0.265, -0.01] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.08, { gum: -0.10, gumR: [0.06, -0.10], jaw: [0.07, -0.13], bottom: -0.145 }],
    ['st1', 0.0, { gum: -0.10, gumR: [0.06, -0.10], jaw: [0.06, -0.125], bottom: -0.14 }],
    ['st2', 0.08, { gum: -0.085, gumR: [0.045, -0.085], jaw: [0.045, -0.105], bottom: -0.115 }],
    ['st3', 0.16, { gum: -0.072, gumR: [0.035, -0.072], jaw: [0.035, -0.09], bottom: -0.098 }],
    ['st4', 0.23, { gum: -0.06, gumR: [0.025, -0.06], jaw: [0.026, -0.075], bottom: -0.082 }],
  ],
  jawCaps: { back: [0, -0.12, -0.12], tip: [0, 0.245, -0.065] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.0, nape: [0, -0.12, -0.04],
  // small eyes set forward at the stop
  eyeAt: [2.7, 2.4], eyeR: 0.016, pupil: 'round', irisAngle: 40,
  browStrip: [[2.2, 1.95], [2.4, 1.95], [2.6, 2.0], [2.8, 2.1], [3.0, 2.2]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.03, 0.025], webCranium: [1.7, 3.3, 4.97],
  // small round ears set wide on the crown
  earAt: [1.0, 1.6], earSpine: [[0, 0, -0.012], [0, 0, 0.015], [0, 0, 0.04], [0, 0, 0.06], [0, 0, 0.072]],
  earR: [0.045, 0.05, 0.045, 0.025], earSquash: [1, 0.45], earH: 1,
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

// a COAT SHELL (no markings channel): a loft a hair proud of the trunk whose bands carry their own groups
// (`bandGroups`, six right-half bands from the back line down to the belly) — a coat pattern on the trunk's outline
const coatShell = (name, torso, { bulk = 1, proud = 1.03, ys, pick }) => {
  const T = torso, zc = T[0].at[2];
  const rAt = (y) => { if (y <= T[0].at[1]) return T[0].r; for (let i = 1; i < T.length; i++) if (y <= T[i].at[1]) { const t = (y - T[i - 1].at[1]) / (T[i].at[1] - T[i - 1].at[1]); return T[i - 1].r.map((r, c) => r + (T[i].r[c] - r) * t); } return T[T.length - 1].r; };
  return { name, kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane',
    stations: ys.map((y) => ({ at: [0, y, zc], r: rAt(y).map((r) => r * bulk * proud) })),
    bandGroups: Object.fromEntries(ys.slice(1).map((_, i) => [`st${i}-st${i + 1}`, Array.from({ length: 6 }, (_, j) => pick(i, j))])),
    caps: { back: [0, ys[0] - 0.02, zc], tip: [0, ys[ys.length - 1] + 0.02, zc] }, capGroups: { back: 'Coat', tip: 'Coat' } };
};

export const species = {
  // BROWN BEAR (Ursus arctos) — the ursine family's worked species. Thesis: a massive barrel body, the shoulder HUMP
  // the highest point with the rump lower · thick columnar legs on plantigrade feet (soles flat, heels down) · a big
  // round head with a dished face, medium muzzle, small round ears · a stub tail · ≈1.0 m at the withers (published
  // shoulder height 0.9–1.5 m, head-body 1.5–2.8 m; an average adult ≈1.0 m / 2.0 m).
  brownBear: {
    family: 'ursine', name: 'a brown bear', scale: 1,
    headScale: 1.3, muzzleW: 1.25, muzzleLen: 0.65, legBulk: 1.2,
  },
  // COMMON WOMBAT (Vombatus ursinus) — Thesis: a LOW BARREL body as broad as it is deep, the back near level, the belly
  // a hand off the ground · very short stout legs on plantigrade feet · a broad, flat-topped, blunt head on almost no
  // neck, small round ears · NO visible tail · head-body ≈1.0 m, shoulder ≈0.37 m (published: length 0.8–1.3 m,
  // height ≈0.36 m). Tables in bear-size units, `scale` 0.4 brings it to true size.
  wombat: {
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
    family: 'ursine', name: 'a common wombat', scale: 0.4,
    colors: { coat: '#6e6658', sock: '#4f483e', snout: '#6e6658', ash: '#6e6658', ashAlt: '#655d50', tip: '#4f483e' },
    joints: {
      neckBase: [0, 0.62, 0.58], neckTop: [0, 0.81, 0.56],
      shoulder: [0.27, 0.44, 0.45], elbow: [0.31, 0.47, 0.25], carpus: [0.31, 0.50, 0.10], forePaw: [0.31, 0.52, 0.068], foreToe: [0.31, 0.69, 0.05],
      hip: [0.27, -0.77, 0.45], stifle: [0.31, -0.70, 0.25], hock: [0.31, -0.83, 0.10], hindPaw: [0.31, -0.81, 0.068], hindToe: [0.31, -0.63, 0.05],
    },
    torso: [
      { at: [0, -0.97, 0.55], r: [0.32, 0.33] },
      { at: [0, -0.83, 0.55], r: [0.38, 0.36] },
      { at: [0, -0.53, 0.55], r: [0.42, 0.40] },
      { at: [0, -0.09, 0.55], r: [0.43, 0.40] },
      { at: [0, 0.31, 0.55], r: [0.40, 0.38] },
      { at: [0, 0.62, 0.55], r: [0.32, 0.32] },
    ],
    torsoCaps: { back: [0, -1.03, 0.50], tip: [0, 0.72, 0.54] },
    extraSegments: [],
    neckRA: [0.27, 0.28], neckRB: [0.24, 0.24], neckRMid: [0.26, 0.26],
    tail: null,
    headScale: 1.7, muzzleW: 1.8, muzzleLen: 0.22, legBulk: 1.3,
    earR: [0.022, 0.025, 0.022, 0.012], earH: 0.5, earAt: [1.2, 2.2], noseR: [0.05, 0.034],
    // a flat crown: the cranium top barely above the brow, broad cheeks
    craniumRows: [
      ['st0', -0.16, 0.06, [0.07, 0.06], [0.12, 0.02], [0.13, -0.03], [0.11, -0.08], [0.06, -0.10], -0.11],
      ['st1', -0.08, 0.095, [0.09, 0.09], [0.15, 0.05], [0.17, 0.0], [0.14, -0.07], [0.07, -0.10], -0.11],
      ['st2', 0.0, 0.09, [0.085, 0.085], [0.14, 0.05], [0.165, -0.01], [0.13, -0.07], [0.07, -0.10], -0.10],
      ['st3', 0.06, 0.07, [0.06, 0.066], [0.10, 0.04], [0.11, -0.01], [0.10, -0.06], [0.06, -0.085], -0.09],
      ['st4', 0.13, 0.06, [0.05, 0.057], [0.075, 0.03], [0.08, -0.01], [0.075, -0.05], [0.05, -0.075], -0.08],
      ['st5', 0.20, 0.05, [0.04, 0.047], [0.06, 0.02], [0.062, -0.01], [0.058, -0.045], [0.04, -0.065], -0.07],
      ['st6', 0.25, 0.04, [0.03, 0.037], [0.045, 0.015], [0.048, -0.01], [0.045, -0.04], [0.03, -0.055], -0.06],
    ],
  },
  // POLAR BEAR, adult male (Ursus maritimus). Thesis: a LONG body with NO shoulder hump, the back level to the
  // rump (the rump as high as the shoulders) · plantigrade, very big broad paws · a LONG NECK and a SMALL, narrow,
  // long head with a straight (Roman) profile, tiny ears · the all-white coat, black nose · ≈1.3 m at the shoulder
  // (on all fours 1.3–1.6 m for males, DeMaster & Stirling 1981, Mammalian Species 145 "Ursus maritimus").
  polarBear: {
    family: 'ursine', name: 'a polar bear', scale: 1.22,
    colors: { coat: '#ebe5d3', sock: '#e2dac4', ash: '#e6dfcb', ashAlt: '#dcd4bd', snout: '#ebe5d3', brow: '#cfc6ae', tip: '#e2dac4', iris: '#2a1d14', nose: '#121010' },
    joints: {
      neckBase: [0, 0.40, 0.84], neckTop: [0, 0.96, 0.82],
      hip: [0.17, -0.74, 0.79], stifle: [0.19, -0.66, 0.45], hock: [0.18, -0.76, 0.125], hindPaw: [0.18, -0.73, 0.085], hindToe: [0.18, -0.48, 0.068],
      carpus: [0.20, 0.28, 0.135], forePaw: [0.20, 0.31, 0.085], foreToe: [0.20, 0.56, 0.068],
    },
    // long and level: the trunk stretched back, the rump as tall as the chest, no hump
    torso: [
      { at: [0, -0.98, 0.76], r: [0.19, 0.17] },
      { at: [0, -0.80, 0.76], r: [0.26, 0.26] },
      { at: [0, -0.46, 0.76], r: [0.27, 0.27] },
      { at: [0, -0.10, 0.76], r: [0.28, 0.28] },
      { at: [0, 0.18, 0.76], r: [0.26, 0.29] },
      { at: [0, 0.40, 0.76], r: [0.21, 0.26] },
    ],
    torsoCaps: { back: [0, -1.08, 0.74], tip: [0, 0.52, 0.76] },
    extraSegments: [],
    neckRA: [0.20, 0.25], neckRB: [0.12, 0.13], neckRMid: [0.15, 0.17],
    tail: [[0, -1.02, 0.80, 0.04], [0, -1.07, 0.76, 0.035], [0, -1.09, 0.71, 0.02]],
    headScale: 0.92, muzzleW: 0.88, muzzleLen: 1.15, legBulk: 1.2, earH: 0.6, earR: [0.035, 0.04, 0.035, 0.02],
  },
  // GIANT PANDA, adult (Ailuropoda melanoleuca). Thesis: a stocky barrel bear, the back level, a mild shoulder rise ·
  // plantigrade, short thick legs · a LARGE ROUND head with a short muzzle and round cheeks · THE PATTERN: white body,
  // BLACK legs, a black band over the shoulders joining the forelegs, black round ears and black eye patches ·
  // ≈0.70 m at the shoulder (0.6–0.8 m, head-body 1.2–1.8 m, Chorn & Hoffmann 1978, Mammalian Species 110).
  giantPanda: (() => {
    const T = family.torso;
    // the shoulder band: the bands over the forequarters dark top to belly
    const ys = [-0.10, 0.02, 0.14, 0.26, 0.40];
    return {
      family: 'ursine', name: 'a giant panda', scale: 0.68,
      colors: { coat: '#ece8dc', sock: '#1b1918', ash: '#ece8dc', ashAlt: '#e2ddcf', snout: '#ece8dc', brow: '#1b1918', tip: '#ece8dc', mane: '#1b1918', ears: '#1b1918', lids: '#1b1918', iris: '#2a1d14', nose: '#121010' },
      extraSegments: [
        coatShell('shoulderBand', T, { ys, pick: (i) => (i >= 1 ? 'Mane' : 'Coat') }),
        { ...family.extraSegments[0], group: 'Mane' },
      ],
      // the legs black to the shoulder and hip
      legs: family.legs.map((r) => [r[0], r[1], r[2], r[3], r[4], 'Sock', ...r.slice(6)]),
      // the eye patches: the bands around the eye (between rows st2 and st3) dark from the brow to the cheek
      craniumBandGroups: {
        'st2-st3': ['Skull', 'Skull', 'Brow', 'Brow', 'Jowl', 'Palate'],
        'st3-st4': ['Skull', 'Snout', 'Brow', 'Cheek', 'Jowl', 'Palate'],
      },
      headScale: 1.9, muzzleW: 1.1, muzzleLen: 0.4, legBulk: 1.3, bulk: 1.05, earH: 1.1, earR: [0.05, 0.056, 0.05, 0.03],
    };
  })(),
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  brownBear: { common: 'bear', aliases: ['brown bear', 'grizzly', 'grizzly bear', 'kodiak bear'], sci: 'Ursus arctos', size: '~1.0 m at the withers; head-body ~2.0 m', source: 'published brown bear figures' },
  wombat: { common: 'wombat', aliases: ['common wombat'], sci: 'Vombatus ursinus', size: '~0.37 m at the shoulder; head-body ~1.0 m', source: 'published common wombat figures' },
  polarBear: { common: 'polar bear', aliases: ['ice bear', 'white bear'], sci: 'Ursus maritimus', size: '~1.3 m at the shoulder (adult male)', source: 'DeMaster & Stirling 1981, Mammalian Species 145' },
  giantPanda: { common: 'panda', aliases: ['giant panda', 'panda bear'], sci: 'Ailuropoda melanoleuca', size: '~0.70 m at the shoulder', source: 'Chorn & Hoffmann 1978, Mammalian Species 110' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  koala: { near: 'wombat', aliases: ['koala bear'], note: 'round tufted ears, a big leathery nose, sits upright in a fork' },
};
