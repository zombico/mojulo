// BOVID — a massive deep rectangular trunk on short sturdy legs, unguligrade cloven hooves (two claws per foot), a
// heavy neck with a hanging dewlap, a broad short head carried low with the face sloping down to a wide muzzle, ears
// set sideways, a thin tail with an end switch. Authored at cattle size (metres). Horns are SPECIES data
// (`headOrnaments`): a bull's curve out and forward, a ram's curl. Worked species: the domestic beef bull.
// See ../build.js for what every field does.

// the face's slope: every skull and jaw point in front of y = 0 drops by k per unit forward (head units), so the
// face runs down from the poll to the muzzle as a grazer carries it
const DROP = 0.45;
const dz = (y) => (y > 0 ? -DROP * y : 0);
const slopeSlot = (y, v) => (Array.isArray(v) ? [v[0], v[1] + dz(y)] : v + dz(y));
const sloped = (rows) => rows.map(([id, y, ...sl]) => [id, y, ...sl.map((v) => slopeSlot(y, v))]);
const slopedJaw = (rows) => rows.map(([id, y, o]) => [id, y, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, slopeSlot(y, v)]))]);
const slopedCap = ([x, y, z]) => [x, y, z + dz(y)];

export const family = {
  family: 'bovid',
  colors: {
    coat: '#7a3b22', sock: '#6a3320', ash: '#8a4a2e', ashAlt: '#7e4228', snout: '#e8e0d0', brow: '#5a2c1a', iris: '#3a2418',
    ink: '#120d0a', sclera: '#2b2116', nose: '#2a2220', teeth: '#ece6d6', mouth: '#4e3430', tip: '#e8e0d0',
    hoof: '#2a2420', horn: '#d8cdb4',
  },
  joints: {
    neckBase: [0, 0.55, 1.10], neckTop: [0, 1.10, 1.26],
    dewlapA: [0, 0.70, 0.62], dewlapB: [0, 1.08, 0.86],
    shoulder: [0.24, 0.45, 1.02], elbow: [0.25, 0.36, 0.70], carpus: [0.24, 0.40, 0.40], fetlock: [0.24, 0.43, 0.15],
    foreHoof: [0.24, 0.46, 0.07], foreToeO: [0.275, 0.56, 0.03], foreToeI: [0.205, 0.56, 0.03],
    hip: [0.22, -0.75, 1.12], stifle: [0.25, -0.52, 0.74], hock: [0.21, -0.86, 0.48], hindFetlock: [0.20, -0.80, 0.15],
    hindHoof: [0.20, -0.77, 0.07], hindToeO: [0.235, -0.67, 0.03], hindToeI: [0.165, -0.67, 0.03],
  },
  // a level box-like trunk: deep and broad from shoulder to rump (the back line nearly level, the belly low)
  torso: [
    { at: [0, -1.00, 1.02], r: [0.25, 0.30] },
    { at: [0, -0.85, 1.02], r: [0.35, 0.38] },
    { at: [0, -0.50, 1.02], r: [0.38, 0.40] },
    { at: [0, -0.10, 1.02], r: [0.40, 0.42] },
    { at: [0, 0.30, 1.02], r: [0.37, 0.43] },
    { at: [0, 0.62, 1.02], r: [0.30, 0.40] },
  ],
  torsoCaps: { back: [0, -1.08, 1.06], tip: [0, 0.78, 0.96] },
  neckRA: [0.28, 0.36], neckRB: [0.21, 0.27], neckRMid: [0.23, 0.30],
  // a thin tail from a high tailhead hanging to about the hocks; the switch is the tip
  tail: [[0, -0.98, 1.36, 0.045], [0, -1.05, 1.26, 0.035], [0, -1.08, 1.02, 0.025], [0, -1.09, 0.72, 0.022]],
  tip: [[0, -1.09, 0.74, 0.035], [0, -1.095, 0.58, 0.055], [0, -1.095, 0.44, 0.03]],
  tipCaps: { back: [0, -1.09, 0.78], tip: [0, -1.095, 0.40] },
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.15, 0.20], [0.10, 0.11], 'Coat', [0.6, 0.5], [0.13, 0.16]],
    ['foreArmR', 'elbow', 'carpus', [0.10, 0.11], [0.065, 0.07], 'Coat', [0.5, 0.4]],
    ['cannonR', 'carpus', 'fetlock', 0.06, 0.055, 'Sock', [0.4, 0.4]],
    ['pasternR', 'fetlock', 'foreHoof', 0.06, 0.06, 'Sock', [0.4, 0.4]],
    ['foreClawOR', 'foreHoof', 'foreToeO', [0.04, 0.05], [0.035, 0.025], 'Hoof', [0.5, 0.4]],
    ['foreClawIR', 'foreHoof', 'foreToeI', [0.04, 0.05], [0.035, 0.025], 'Hoof', [0.5, 0.4]],
    ['thighR', 'hip', 'stifle', [0.18, 0.24], [0.11, 0.12], 'Coat', [0.2, 0.5], [0.17, 0.21]],
    ['gaskinR', 'stifle', 'hock', [0.10, 0.11], [0.06, 0.065], 'Coat', [0.5, 0.4]],
    ['hindCannonR', 'hock', 'hindFetlock', 0.058, 0.055, 'Sock', [0.4, 0.4]],
    ['hindPasternR', 'hindFetlock', 'hindHoof', 0.06, 0.06, 'Sock', [0.4, 0.4]],
    ['hindClawOR', 'hindHoof', 'hindToeO', [0.04, 0.05], [0.035, 0.025], 'Hoof', [0.5, 0.4]],
    ['hindClawIR', 'hindHoof', 'hindToeI', [0.04, 0.05], [0.035, 0.025], 'Hoof', [0.5, 0.4]],
  ],
  extraSegments: [
    // the dewlap: a deep thin fold hanging under the neck, from the brisket to the throat
    { name: 'dewlap', kind: 'segment', from: 'dewlapA', to: 'dewlapB', rA: [0.07, 0.12], rB: [0.04, 0.06], rMid: [0.06, 0.20], slots: 'ring12', group: 'Coat', mirror: 'plane', over: [0.3, 0.3] },
  ],
  // skull rows (head units = metres at headScale 1): a wide flat poll, the face sloping DOWN to a broad muzzle
  craniumRows: sloped([
    ['st0', -0.14, 0.10, [0.10, 0.10], [0.13, 0.04], [0.12, -0.04], [0.10, -0.12], [0.06, -0.16], -0.17],
    ['st1', -0.06, 0.13, [0.115, 0.12], [0.14, 0.06], [0.13, -0.04], [0.10, -0.14], [0.06, -0.18], -0.19],
    ['st2', 0.02, 0.10, [0.085, 0.095], [0.125, 0.03], [0.115, -0.07], [0.095, -0.17], [0.065, -0.21], -0.22],
    ['st3', 0.09, 0.04, [0.07, 0.03], [0.095, -0.02], [0.095, -0.10], [0.085, -0.19], [0.06, -0.23], -0.24],
    ['st4', 0.15, -0.01, [0.075, -0.02], [0.095, -0.07], [0.095, -0.14], [0.085, -0.22], [0.065, -0.26], -0.27],
    ['st5', 0.20, -0.05, [0.08, -0.06], [0.10, -0.11], [0.10, -0.18], [0.09, -0.25], [0.07, -0.28], -0.29],
    ['st6', 0.23, -0.09, [0.07, -0.10], [0.09, -0.14], [0.09, -0.21], [0.08, -0.27], [0.06, -0.295], -0.30],
  ]),
  craniumCaps: { back: [0, -0.18, 0.0], tip: slopedCap([0, 0.25, -0.20]) },
  muzzleFrom: 3,
  jawRows: slopedJaw([
    ['st0', -0.06, { gum: -0.19, gumR: [0.08, -0.19], jaw: [0.09, -0.24], bottom: -0.26 }],
    ['st1', 0.03, { gum: -0.23, gumR: [0.075, -0.23], jaw: [0.075, -0.27], bottom: -0.29 }],
    ['st2', 0.10, { gum: -0.25, gumR: [0.065, -0.25], jaw: [0.065, -0.29], bottom: -0.30 }],
    ['st3', 0.16, { gum: -0.275, gumR: [0.06, -0.275], jaw: [0.06, -0.305], bottom: -0.315 }],
    ['st4', 0.21, { gum: -0.29, gumR: [0.05, -0.29], jaw: [0.05, -0.31], bottom: -0.32 }],
  ]),
  jawCaps: { back: [0, -0.10, -0.24], tip: slopedCap([0, 0.225, -0.305]) },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1, nape: [0, -0.16, -0.02],
  eyeAt: [1.9, 2.4], eyeR: 0.028, pupil: 'round', irisAngle: 40,
  browStrip: [[1.5, 1.9], [1.75, 1.9], [2.0, 1.95], [2.25, 2.05], [2.5, 2.2]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.8, 1.6], noseAt: [5.9, 0.0001], noseR: [0.05, 0.035], webCranium: [1.7, 3.3, 4.97],
  // ears set sideways below the horns, out along the side normal, flattened
  earAt: [0.7, 2.5], earSpine: [[0, 0, -0.01], [0, 0.01, 0.04], [0, 0.02, 0.10], [0, 0.02, 0.16], [0, 0.01, 0.20]],
  earR: [0.035, 0.05, 0.045, 0.022], earSquash: [1, 0.45], earH: 1,
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // DOMESTIC BULL (Bos taurus, a beef breed, Hereford colours) — the bovid family's worked species. Thesis: a massive
  // deep rectangular trunk with a near-level back on short sturdy legs, cloven hooves · a heavy neck with a hanging
  // dewlap · a broad short face sloping down from a wide flat poll to a broad muzzle · HORNS out and forward from the
  // poll, ears sideways below them · a thin tail with a switch at the hocks · 1.45 m at the withers (beef bulls
  // ~1.40–1.50 m hip/withers height, breed-society frame-score tables).
  bull: {
    family: 'bovid', name: 'a domestic bull',
    legBulk: 1.5, bulk: 1.08, headScale: 1.2, muzzleW: 1.15, muzzleLen: 0.8,
    earR: [0.05, 0.085, 0.08, 0.035], earH: 1.5,
    headOrnaments: [
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.10, -0.10, 0.11], [0.20, -0.10, 0.12], [0.28, -0.07, 0.13], [0.33, 0.0, 0.15], [0.34, 0.07, 0.18]], radii: [0.045, 0.038, 0.03, 0.02, 0.008], m: 8, group: 'Horn' },
    ],
  },

  // THOMSON'S GAZELLE (Eudorcas thomsonii) — Thesis: a small light barrel on very long thin legs, high hocks, small
  // cloven hooves · a slender neck carried up, a small narrow head · ONE signature: lyrate ringed horns rising from
  // the poll, swept back then tips forward · a short tail, a dark side stripe · 0.62 m at the withers (published
  // 0.55–0.82 m shoulder height; ADW / Kingdon). Authored at bovid units and scaled down.
  gazelle: {
    family: 'bovid', name: "a Thomson's gazelle", scale: 0.5,
    colors: { coat: '#b47a44', sock: '#a87040', ash: '#b47a44', ashAlt: '#c08a52', brow: '#e8dcc4', horn: '#3a3028', snout: '#a87040', teeth: '#a87040', nose: '#3a2a1e' },
    joints: {
      neckBase: [0, 0.42, 1.12], neckTop: [0, 0.74, 1.56],
      shoulder: [0.13, 0.36, 1.02], elbow: [0.14, 0.30, 0.72], carpus: [0.13, 0.34, 0.38], fetlock: [0.13, 0.36, 0.12],
      foreHoof: [0.13, 0.38, 0.05], foreToeO: [0.15, 0.45, 0.02], foreToeI: [0.11, 0.45, 0.02],
      hip: [0.12, -0.56, 1.08], stifle: [0.14, -0.38, 0.78], hock: [0.12, -0.70, 0.46], hindFetlock: [0.11, -0.66, 0.12],
      hindHoof: [0.11, -0.64, 0.05], hindToeO: [0.13, -0.57, 0.02], hindToeI: [0.09, -0.57, 0.02],
    },
    torso: [
      { at: [0, -0.74, 1.04], r: [0.13, 0.15] },
      { at: [0, -0.62, 1.04], r: [0.18, 0.20] },
      { at: [0, -0.35, 1.04], r: [0.20, 0.21] },
      { at: [0, 0.0, 1.04], r: [0.20, 0.22] },
      { at: [0, 0.28, 1.04], r: [0.19, 0.22] },
      { at: [0, 0.48, 1.04], r: [0.15, 0.19] },
    ],
    torsoCaps: { back: [0, -0.80, 1.06], tip: [0, 0.58, 1.0] },
    neckRA: [0.10, 0.14], neckRB: [0.065, 0.08], neckRMid: [0.075, 0.10],
    legBulk: 0.42,
    tail: [[0, -0.76, 1.14, 0.035], [0, -0.80, 1.05, 0.03], [0, -0.81, 0.96, 0.025]],
    tip: [[0, -0.81, 0.97, 0.03], [0, -0.815, 0.90, 0.035], [0, -0.815, 0.86, 0.02]],
    tipCaps: { back: [0, -0.81, 0.99], tip: [0, -0.815, 0.84] },
    extraSegments: [],
    headScale: 0.62, muzzleW: 0.55, muzzleLen: 1.15, earH: 0.6, earR: [0.025, 0.035, 0.03, 0.012], earSquash: [1, 0.35], noseR: [0.03, 0.02], eyeR: 0.022,
    headOrnaments: [
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.02, -0.04, 0.10], [0.06, -0.12, 0.22], [0.09, -0.20, 0.34], [0.10, -0.20, 0.46], [0.08, -0.12, 0.56], [0.07, -0.06, 0.60]], radii: [0.022, 0.019, 0.016, 0.012, 0.008, 0.004], m: 8, group: 'Horn' },
    ],
  },
  // BIGHORN RAM (Ovis canadensis) — Thesis: a stocky deep barrel on short sturdy legs, cloven hooves · a thick neck,
  // a Roman-nosed (convex) face · ONE signature: massive horns curling back, down and forward round the ear in a
  // spiral · a short tail, a pale rump and muzzle · 0.95 m at the withers (published 0.9–1.05 m ram shoulder height;
  // ADW / NPS). Authored at bovid units and scaled down.
  ram: {
    family: 'bovid', name: 'a bighorn ram', scale: 0.65,
    colors: { coat: '#6e5238', sock: '#5e4630', ash: '#7a5c40', ashAlt: '#74563a', horn: '#a8946c', tip: '#6e5238' },
    legBulk: 1.15, bulk: 1.0, headScale: 1.0, muzzleW: 0.8, muzzleLen: 0.8,
    joints: { neckBase: [0, 0.52, 1.12], neckTop: [0, 1.0, 1.42] },
    craniumRows: sloped([
      ['st0', -0.14, 0.10, [0.10, 0.10], [0.13, 0.04], [0.12, -0.04], [0.10, -0.12], [0.06, -0.16], -0.17],
      ['st1', -0.06, 0.13, [0.115, 0.12], [0.14, 0.06], [0.13, -0.04], [0.10, -0.14], [0.06, -0.18], -0.19],
      ['st2', 0.02, 0.12, [0.085, 0.11], [0.12, 0.03], [0.11, -0.07], [0.09, -0.17], [0.06, -0.21], -0.22],
      ['st3', 0.09, 0.08, [0.065, 0.065], [0.09, -0.02], [0.09, -0.10], [0.08, -0.19], [0.055, -0.23], -0.24],
      ['st4', 0.15, 0.04, [0.065, 0.02], [0.085, -0.07], [0.085, -0.14], [0.075, -0.22], [0.055, -0.26], -0.27],
      ['st5', 0.20, -0.01, [0.065, -0.03], [0.08, -0.11], [0.08, -0.18], [0.07, -0.25], [0.055, -0.28], -0.29],
      ['st6', 0.23, -0.07, [0.055, -0.08], [0.07, -0.14], [0.07, -0.21], [0.065, -0.27], [0.05, -0.295], -0.30],
    ]),
    tail: [[0, -0.98, 1.30, 0.06], [0, -1.04, 1.20, 0.05], [0, -1.06, 1.10, 0.04]],
    tip: [[0, -1.06, 1.11, 0.045], [0, -1.065, 1.04, 0.05], [0, -1.065, 1.0, 0.03]],
    tipCaps: { back: [0, -1.06, 1.13], tip: [0, -1.065, 0.98] },
    extraSegments: [],
    headOrnaments: [
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.06, -0.06, 0.06], [0.14, -0.16, 0.07], [0.22, -0.21, -0.03], [0.28, -0.15, -0.16], [0.30, -0.03, -0.21], [0.30, 0.07, -0.13], [0.28, 0.10, -0.03]], radii: [0.09, 0.082, 0.072, 0.06, 0.046, 0.032, 0.016], m: 8, group: 'Horn' },
    ],
  },

  // DOMESTIC SHEEP (Ovis aries, a Suffolk-type woolly ewe) — Thesis: a BULKY rounded fleece body (wide, deep, the
  // wool hanging low) set on THIN dark legs, small cloven hooves · a short neck carried forward · a smallish hornless
  // head with a DARK face and dark sideways ears, the wool capping the poll · a short woolly tail · 0.75 m at the
  // withers (published Suffolk ewe ~0.7–0.8 m; breed-society standards / Oklahoma State Breeds of Livestock).
  sheep: {
    family: 'bovid', name: 'a domestic sheep', scale: 0.5,
    colors: { coat: '#e6dcc4', belly: '#e6dcc4', sock: '#242020', ash: '#2a2422', ashAlt: '#2a2422', snout: '#2a2422', brow: '#1e1a18', ears: '#2a2422', hoof: '#141210', nose: '#141210', tip: '#e6dcc4', teeth: '#2a2422' },
    joints: { neckBase: [0, 0.62, 1.10], neckTop: [0, 0.98, 1.26] },
    torso: [
      { at: [0, -1.05, 1.0], r: [0.33, 0.36] },
      { at: [0, -0.90, 1.0], r: [0.44, 0.46] },
      { at: [0, -0.50, 1.0], r: [0.48, 0.50] },
      { at: [0, -0.10, 1.0], r: [0.49, 0.50] },
      { at: [0, 0.30, 1.0], r: [0.46, 0.49] },
      { at: [0, 0.62, 1.0], r: [0.38, 0.44] },
    ],
    torsoCaps: { back: [0, -1.14, 1.02], tip: [0, 0.80, 0.98] },
    neckRA: [0.30, 0.36], neckRB: [0.17, 0.20], neckRMid: [0.24, 0.28],
    legBulk: 0.55, headScale: 1.0, muzzleW: 0.72, muzzleLen: 1.0, earH: 0.85, noseR: [0.03, 0.02],
    // the face and the lower head dark, the wool cap (the skull's back) cream
    craniumBandGroups: Object.fromEntries(['st0-st1', 'st1-st2', 'st2-st3', 'st3-st4', 'st4-st5', 'st5-st6'].map((b, i) => [b, [i ? 'Snout' : 'Skull', i ? 'Snout' : 'Skull', 'Snout', 'Cheek', 'Jowl', 'Palate']])),
    tail: [[0, -1.08, 1.25, 0.075], [0, -1.15, 1.10, 0.065], [0, -1.17, 0.95, 0.05]],
    tip: null,
    extraSegments: [],
  },

  // DOMESTIC GOAT (Capra hircus) — Thesis: a SLIM, narrow, angular body (the hip bones and spine showing) on longer
  // lean legs, small cloven hooves · a neck carried up · a narrow straight face with a chin BEARD · scimitar HORNS
  // rising from the poll and sweeping BACK · ears out sideways · a short tail held UP · 0.70 m at the withers
  // (published domestic goat 0.6–0.85 m; ADW / FAO breed descriptions). Authored at bovid units and scaled down.
  goat: {
    family: 'bovid', name: 'a domestic goat', scale: 0.5,
    colors: { coat: '#8a6644', sock: '#6a4c34', ash: '#9a7656', ashAlt: '#8e6c4c', snout: '#7a5a3c', brow: '#5a4028', horn: '#6a5a48', mane: '#4a3626', tip: '#8a6644', hoof: '#2a2420' },
    joints: {
      neckBase: [0, 0.46, 1.18], neckTop: [0, 0.82, 1.56],
      shoulder: [0.17, 0.42, 1.04], elbow: [0.18, 0.34, 0.72], carpus: [0.17, 0.38, 0.40], fetlock: [0.17, 0.41, 0.15],
      foreHoof: [0.17, 0.44, 0.07], foreToeO: [0.195, 0.53, 0.03], foreToeI: [0.145, 0.53, 0.03],
      hip: [0.16, -0.72, 1.10], stifle: [0.18, -0.50, 0.76], hock: [0.15, -0.84, 0.48], hindFetlock: [0.15, -0.78, 0.15],
      hindHoof: [0.15, -0.75, 0.07], hindToeO: [0.175, -0.66, 0.03], hindToeI: [0.125, -0.66, 0.03],
    },
    torso: [
      { at: [0, -0.95, 1.06], r: [0.16, 0.24] },
      { at: [0, -0.82, 1.06], r: [0.22, 0.30] },
      { at: [0, -0.50, 1.06], r: [0.23, 0.33] },
      { at: [0, -0.10, 1.06], r: [0.25, 0.36] },
      { at: [0, 0.28, 1.06], r: [0.23, 0.35] },
      { at: [0, 0.55, 1.06], r: [0.18, 0.30] },
    ],
    torsoCaps: { back: [0, -1.02, 1.10], tip: [0, 0.68, 1.02] },
    neckRA: [0.17, 0.24], neckRB: [0.11, 0.14], neckRMid: [0.13, 0.17],
    legBulk: 0.62, headScale: 0.7, muzzleW: 0.62, muzzleLen: 1.3, earH: 0.65, earR: [0.025, 0.032, 0.026, 0.008], noseR: [0.03, 0.02],
    tail: [[0, -0.98, 1.28, 0.04], [0, -1.02, 1.40, 0.035], [0, -1.03, 1.52, 0.022]],
    tip: null,
    extraSegments: [],
    headOrnaments: [
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.04, -0.06, 0.10], [0.06, -0.10, 0.20], [0.08, -0.18, 0.28], [0.10, -0.28, 0.31], [0.11, -0.37, 0.29]], radii: [0.032, 0.028, 0.022, 0.014, 0.004], m: 8, group: 'Horn' },
      { kind: 'sweep', name: 'beard', at: [3.5, 3.0], space: 'head', spine: [[0.004, 0.13, -0.36], [0.004, 0.13, -0.43], [0.004, 0.12, -0.50]], radii: [0.022, 0.018, 0.004], m: 8, group: 'Mane' },
    ],
  },
};
