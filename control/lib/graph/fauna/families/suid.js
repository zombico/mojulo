// SUID — a barrel trunk (round in section, deep, the back near level) on SHORT legs, unguligrade cloven trotters (two
// main claws), a short thick neck merging into a long wedge head carried low, the snout ending in a flat round DISC,
// small eyes, a thin tail. Authored at domestic-pig size in metres (scale 1 = the worked pig). Worked species: the
// domestic pig. See ../build.js for what every field does.

export const family = {
  family: 'suid',
  colors: {
    coat: '#e6b2a0', sock: '#dca492', ash: '#e0a894', ashAlt: '#d89e8a', snout: '#e6b2a0', brow: '#d49a86', iris: '#3a2418',
    ink: '#1a1010', sclera: '#2b2116', nose: '#d88a84', teeth: '#ece6d6', mouth: '#8a4a48', tip: '#e6b2a0',
    hoof: '#7a6658', horn: '#ece6d6',
  },
  joints: {
    neckBase: [0, 0.42, 0.62], neckTop: [0, 0.64, 0.64],
    shoulder: [0.15, 0.36, 0.50], elbow: [0.16, 0.30, 0.33], carpus: [0.15, 0.34, 0.18], fetlock: [0.15, 0.36, 0.08],
    foreHoof: [0.15, 0.38, 0.035], foreToeO: [0.17, 0.44, 0.015], foreToeI: [0.13, 0.44, 0.015],
    hip: [0.14, -0.48, 0.56], stifle: [0.16, -0.34, 0.36], hock: [0.14, -0.54, 0.21], hindFetlock: [0.14, -0.50, 0.08],
    hindHoof: [0.14, -0.48, 0.035], hindToeO: [0.16, -0.42, 0.015], hindToeI: [0.12, -0.42, 0.015],
  },
  // a level round barrel: as deep as it is broad, a blunt rump, a full shoulder
  torso: [
    { at: [0, -0.70, 0.52], r: [0.15, 0.19] },
    { at: [0, -0.60, 0.52], r: [0.24, 0.28] },
    { at: [0, -0.35, 0.52], r: [0.27, 0.30] },
    { at: [0, 0.0, 0.52], r: [0.28, 0.31] },
    { at: [0, 0.30, 0.52], r: [0.26, 0.30] },
    { at: [0, 0.50, 0.52], r: [0.20, 0.26] },
  ],
  torsoCaps: { back: [0, -0.76, 0.57], tip: [0, 0.60, 0.55] },
  neckRA: [0.20, 0.24], neckRB: [0.17, 0.19], neckRMid: [0.19, 0.22],
  // a thin tail from the top of the rump curling round in one loop
  tail: [[0, -0.73, 0.72, 0.022], [0, -0.79, 0.72, 0.017], [0, -0.83, 0.68, 0.015], [0, -0.83, 0.63, 0.014], [0, -0.79, 0.61, 0.013], [0, -0.765, 0.645, 0.011]],
  tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.09, 0.11], [0.06, 0.065], 'Coat', [0.6, 0.5], [0.08, 0.10]],
    ['foreArmR', 'elbow', 'carpus', [0.055, 0.06], [0.04, 0.042], 'Coat', [0.5, 0.4]],
    ['cannonR', 'carpus', 'fetlock', 0.036, 0.033, 'Sock', [0.4, 0.4]],
    ['pasternR', 'fetlock', 'foreHoof', 0.033, 0.032, 'Sock', [0.4, 0.4]],
    ['foreClawOR', 'foreHoof', 'foreToeO', [0.022, 0.03], [0.02, 0.014], 'Hoof', [0.5, 0.4]],
    ['foreClawIR', 'foreHoof', 'foreToeI', [0.022, 0.03], [0.02, 0.014], 'Hoof', [0.5, 0.4]],
    ['thighR', 'hip', 'stifle', [0.12, 0.15], [0.07, 0.08], 'Coat', [0.2, 0.5], [0.11, 0.14]],
    ['gaskinR', 'stifle', 'hock', [0.06, 0.065], [0.04, 0.042], 'Coat', [0.5, 0.4]],
    ['hindCannonR', 'hock', 'hindFetlock', 0.036, 0.033, 'Sock', [0.4, 0.4]],
    ['hindPasternR', 'hindFetlock', 'hindHoof', 0.033, 0.032, 'Sock', [0.4, 0.4]],
    ['hindClawOR', 'hindHoof', 'hindToeO', [0.022, 0.03], [0.02, 0.014], 'Hoof', [0.5, 0.4]],
    ['hindClawIR', 'hindHoof', 'hindToeI', [0.022, 0.03], [0.02, 0.014], 'Hoof', [0.5, 0.4]],
  ],
  extraSegments: [],
  // skull rows (metres at headScale 1): a broad jowly back, the face tapering straight to a long cylinder snout that
  // ends square (the disc is the nose pad worn on the blunt tip)
  craniumRows: [
    ['st0', -0.12, 0.12, [0.08, 0.10], [0.11, 0.04], [0.11, -0.04], [0.10, -0.11], [0.06, -0.14], -0.15],
    ['st1', -0.04, 0.12, [0.085, 0.10], [0.11, 0.05], [0.115, -0.03], [0.10, -0.11], [0.06, -0.14], -0.15],
    ['st2', 0.04, 0.09, [0.07, 0.075], [0.09, 0.03], [0.09, -0.04], [0.08, -0.10], [0.05, -0.12], -0.13],
    ['st3', 0.11, 0.06, [0.055, 0.05], [0.065, 0.01], [0.065, -0.04], [0.06, -0.08], [0.04, -0.10], -0.105],
    ['st4', 0.17, 0.045, [0.045, 0.035], [0.05, 0.0], [0.05, -0.035], [0.045, -0.065], [0.03, -0.08], -0.085],
    ['st5', 0.22, 0.04, [0.04, 0.03], [0.045, 0.0], [0.045, -0.03], [0.04, -0.06], [0.03, -0.07], -0.075],
    ['st6', 0.25, 0.04, [0.042, 0.03], [0.047, 0.0], [0.047, -0.03], [0.042, -0.06], [0.03, -0.07], -0.075],
  ],
  craniumCaps: { back: [0, -0.16, 0.0], tip: [0, 0.255, -0.015] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.06, { gum: -0.15, gumR: [0.07, -0.15], jaw: [0.08, -0.19], bottom: -0.21 }],
    ['st1', 0.04, { gum: -0.13, gumR: [0.05, -0.13], jaw: [0.055, -0.16], bottom: -0.17 }],
    ['st2', 0.12, { gum: -0.10, gumR: [0.035, -0.10], jaw: [0.035, -0.12], bottom: -0.125 }],
    ['st3', 0.18, { gum: -0.08, gumR: [0.025, -0.08], jaw: [0.025, -0.095], bottom: -0.10 }],
  ],
  jawCaps: { back: [0, -0.10, -0.18], tip: [0, 0.20, -0.095] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1, nape: [0, -0.14, -0.02], headPitch: -18,
  eyeAt: [1.7, 2.3], eyeR: 0.016, pupil: 'round', irisAngle: 40,
  browStrip: [[1.3, 1.9], [1.55, 1.9], [1.8, 1.95], [2.05, 2.05], [2.3, 2.2]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.9, 1.2], noseAt: [5.95, 0.0001], noseR: [0.05, 0.05], webCranium: [1.7, 3.3, 4.97],
  // ears: broad thin flaps from the crown, tipping forward over the eyes
  earAt: [0.6, 1.4], earSpine: [[0, 0, -0.01], [0.03, 0, 0.035], [0.08, 0, 0.05], [0.13, 0, 0.03], [0.16, 0, -0.01]],
  earR: [0.045, 0.07, 0.065, 0.03], earSquash: [1, 0.35], earH: 1,
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

export const species = {
  // DOMESTIC PIG (Sus scrofa domesticus, a pink Large White type) — the suid family's worked species. Thesis: a round
  // level barrel on short legs, cloven trotters · a short thick neck into a long straight wedge head carried low,
  // ending in a flat round snout DISC · broad ears flopping forward over the eyes · a thin curly tail · 0.80 m at the
  // withers (published adult Large White ~0.8–0.9 m shoulder height; breed-society / FAO breed descriptions).
  pig: { family: 'suid', name: 'a domestic pig', muzzleLen: 0.82, muzzleW: 1.15, legBulk: 1.15, earR: [0.052, 0.08, 0.075, 0.035] },
};

// WILD BOAR (Sus scrofa) — Thesis: FRONT-HEAVY: a deep high shoulder and narrow flanks falling to a lower rump, on
// longer, thinner legs · a long straight wedge head with a longer snout to the disc · upright pointed ears · a
// bristled dorsal CREST along the neck and back, and TUSKS curving up from the lips · dark grey-brown · a straight
// tufted tail · 0.85 m at the shoulder (published adult 0.55–1.10 m, typically 0.8–0.9 m; ADW, Sus scrofa).
species.wildBoar = {
  family: 'suid', name: 'a wild boar', torsoUp: true, scale: 0.92,
  colors: { coat: '#4a3c32', sock: '#2e2620', ash: '#56463a', ashAlt: '#4e4034', snout: '#4a3c32', brow: '#3a2e26', nose: '#3a2c28', ears: '#3a2e26', mane: '#241c18', hoof: '#1e1814', tip: '#241c18', mouth: '#4e3430' },
  joints: {
    neckBase: [0, 0.40, 0.66], neckTop: [0, 0.62, 0.66],
    shoulder: [0.13, 0.36, 0.52], elbow: [0.14, 0.30, 0.32], carpus: [0.13, 0.34, 0.17],
    hip: [0.12, -0.46, 0.52], crestA: [0, -0.30, 0.80], crestB: [0, 0.70, 0.83], stifle: [0.14, -0.32, 0.34], hock: [0.12, -0.52, 0.20],
  },
  torso: [
    { at: [0, -0.68, 0.50], r: [0.10, 0.14] },
    { at: [0, -0.58, 0.50], r: [0.16, 0.20] },
    { at: [0, -0.32, 0.51], r: [0.18, 0.23] },
    { at: [0, 0.0, 0.53], r: [0.22, 0.29], top: 0.05 },
    { at: [0, 0.30, 0.54], r: [0.23, 0.30], top: 0.10 },
    { at: [0, 0.50, 0.55], r: [0.19, 0.27], top: 0.10 },
  ],
  torsoCaps: { back: [0, -0.74, 0.52], tip: [0, 0.60, 0.56] },
  neckRA: [0.19, 0.26], neckRB: [0.15, 0.19], neckRMid: [0.17, 0.23],
  tail: [[0, -0.70, 0.62, 0.018], [0, -0.75, 0.55, 0.014], [0, -0.77, 0.45, 0.011]],
  tip: [[0, -0.77, 0.46, 0.015], [0, -0.775, 0.40, 0.024], [0, -0.775, 0.36, 0.012]],
  tipCaps: { back: [0, -0.77, 0.48], tip: [0, -0.775, 0.34] },
  legBulk: 0.85, muzzleLen: 1.35, muzzleW: 0.9, headPitch: -22,
  earAt: [0.7, 0.9], earSpine: [[0, 0, -0.01], [0, -0.01, 0.04], [0, -0.02, 0.09], [0, -0.03, 0.13]],
  earR: [0.035, 0.045, 0.03, 0.006], earSquash: [1, 0.4],
  extraSegments: [
    // the dorsal crest: a thin bristle ridge along the top of the neck and the front of the back
    { name: 'crest', kind: 'segment', from: 'crestA', to: 'crestB', rA: [0.015, 0.02], rB: [0.025, 0.04], rMid: [0.035, 0.09], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.3] },
  ],
  headOrnaments: [
    { kind: 'sweep', name: 'tusk', at: [4.2, 4.6], space: 'head', spine: [[0.03, 0.17, -0.08], [0.05, 0.19, -0.06], [0.06, 0.20, -0.03], [0.055, 0.19, -0.005]], radii: [0.013, 0.011, 0.008, 0.002], m: 8, group: 'Teeth' },
  ],
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  pig: { common: 'pig', aliases: ['hog', 'swine', 'piglet'], sci: 'Sus scrofa domesticus', size: '0.80 m at the withers (a Large White)', source: 'breed-society / FAO breed descriptions' },
  wildBoar: { common: 'wild boar', aliases: ['boar', 'wild pig', 'razorback'], sci: 'Sus scrofa', size: '0.85 m at the shoulder', source: 'ADW, Sus scrofa' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  warthog: { near: 'wildBoar', aliases: [], note: 'a flat wide face with facial warts and big curved tusks, a thin tail held up' },
};
