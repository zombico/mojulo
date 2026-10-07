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

// HAIR LOCKS (a shaggy coat's hanging fringe): flat tapering blades hung straight down, mirrored by name (right side
// authored), each [name, x, y, zTop, zHem, width]; the blade lies along the body (its width runs fore and aft, its
// thickness out from the flank) and narrows to a point at the hem, so a row of them reads as a tattered fringe
const lock = ([name, x, y, z0, z1, w], group) => ({ name, kind: 'loft', slots: 'ring12', group, mirror: 'name', up: [1, 0, 0],
  stations: [{ at: [x - 0.035, y, z0], r: [w * 0.55, w * 0.3] }, { at: [x, y, z0 + (z1 - z0) * 0.3], r: [w, w * 0.5] }, { at: [x - 0.01, y, z0 + (z1 - z0) * 0.65], r: [w * 0.8, w * 0.4] },
    { at: [x - 0.02, y, z1 + 0.05], r: [w * 0.4, w * 0.22] }],
  caps: { back: [x - 0.04, y, z0 + 0.04], tip: [x - 0.025, y, z1] } });
// a fixed ragged rhythm for the hem (deterministic: no random), metres the lock hangs past the even hem
const RAG = [0.0, 0.07, 0.025, 0.1, 0.045, 0.085, 0.01, 0.06, 0.035, 0.095, 0.02, 0.075];
// the yak's skirt line, fore and aft along the flank: [y, the skirt's half-width there, its centre height] (bison
// units, read off the yak's skirt loft)
const YAK_SKIRT = [[-0.82, 0.41, 0.80], [-0.72, 0.43, 0.79], [-0.62, 0.445, 0.78], [-0.52, 0.455, 0.77], [-0.42, 0.462, 0.76], [-0.32, 0.468, 0.76],
  [-0.22, 0.472, 0.76], [-0.12, 0.477, 0.76], [-0.02, 0.48, 0.76], [0.08, 0.48, 0.765], [0.18, 0.48, 0.773], [0.28, 0.48, 0.78], [0.38, 0.46, 0.80], [0.48, 0.435, 0.815], [0.58, 0.41, 0.83]];

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
  // kept v15 (blind judges, both orders: v15 (shorter, wider muzzle, small nostrils, head raised) over v12 60%/60%;
  // vs v1 split 1-1 (85% for v15, 75% for v1))
  // DOMESTIC BULL (Bos taurus, a beef breed, Hereford colours) — the bovid family's worked species. Thesis: a massive
  // deep rectangular trunk with a near-level back on short sturdy legs, cloven hooves · a heavy neck with a hanging
  // dewlap · a broad short face sloping down from a wide flat poll to a broad muzzle · HORNS out and forward from the
  // poll, ears sideways below them · a thin tail with a switch at the hocks · 1.45 m at the withers (beef bulls
  // ~1.40–1.50 m hip/withers height, breed-society frame-score tables).
  bull: {
    family: 'bovid', name: 'a domestic bull',
    legBulk: 1.5, bulk: 1.08, headScale: 1.2, muzzleW: 1.6, muzzleLen: 0.42, noseR: [0.02, 0.015], headPitch: 2,
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
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
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
    // the coat pattern (markings channel, painted on the trunk's own faces): the black flank stripe low along the
    // side, the white belly below it
    markDensity: { torso: 2 },
    markings: [
      { on: 'torso', kind: 'band', run: [0.12, 0.92], t: [0.5, 0.64], group: 'Stripe', color: '#2a1e16' },
      { on: 'torso', kind: 'belly', from: 0.64, group: 'Belly', color: '#efe8da' },
    ],
    headScale: 0.62, muzzleW: 0.55, muzzleLen: 1.15, earH: 0.6, earR: [0.025, 0.035, 0.03, 0.012], earSquash: [1, 0.35], noseR: [0.03, 0.02], eyeR: 0.022,
    headOrnaments: [
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.02, -0.04, 0.10], [0.06, -0.12, 0.22], [0.09, -0.20, 0.34], [0.10, -0.20, 0.46], [0.08, -0.12, 0.56], [0.07, -0.06, 0.60]], radii: [0.022, 0.019, 0.016, 0.012, 0.008, 0.004], m: 8, group: 'Horn' },
    ],
  },
  // kept v4 (upgrade pass 2026-10-06: v6 (spiral flare, stronger Roman nose, heavier barrel) vs v4 split 1-1 → tie keeps v4)
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
    // the pale RUMP PATCH round the tail (markings channel): the trunk's rear disc and its last band, the tail too
    tailGroup: 'Rump',
    markDensity: { torso: 2 },
    markings: [{ on: 'torso', kind: 'band', run: [0, 0.1], t: [0.15, 1], caps: ['back'], group: 'Rump', color: '#e6dcc6' }],
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
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
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

  // kept v1 (blind judges, both orders: v4 (hump moved forward, head raised, wider front) vs v1 split 1-1 → tie keeps v1)
  // AMERICAN BISON (Bison bison, bull) — Thesis: a front-heavy wedge: a MASSIVE shoulder hump high over the forelegs,
  // the back line falling steeply to a small narrow rump, on short legs, cloven hooves · the huge head carried LOW,
  // below the back line, broad-faced with a beard · ONE/TWO signatures: the hump, and the SHAGGY dark forequarters
  // (cape, neck, upper forelegs) against a shorter-haired lighter hind half · short black horns curving up and in ·
  // 1.80 m at the withers (published bull shoulder height 1.67–1.86 m; NPS Yellowstone / ADW).
  bison: {
    family: 'bovid', name: 'an American bison', scale: 1,
    colors: { coat: '#6a4a30', sock: '#3a2818', ash: '#3e2a1c', ashAlt: '#3a2618', snout: '#2e2016', brow: '#22180f', mane: '#33231a', horn: '#1e1814', tip: '#33231a', hoof: '#1a1612' },
    joints: {
      neckBase: [0, 0.62, 1.10], neckTop: [0, 0.98, 0.86],
      dewlapA: [0, 0.80, 0.70], dewlapB: [0, 1.02, 0.66],
    },
    torsoUp: true,
    torso: [
      { at: [0, -0.95, 1.0], r: [0.22, 0.26] },
      { at: [0, -0.82, 1.0], r: [0.30, 0.34], top: 0.02 },
      { at: [0, -0.45, 1.0], r: [0.35, 0.38], top: 0.10 },
      { at: [0, -0.05, 1.0], r: [0.40, 0.42], top: 0.24 },
      { at: [0, 0.30, 1.0], r: [0.42, 0.45], top: 0.36 },
      { at: [0, 0.62, 1.0], r: [0.36, 0.42], top: 0.22 },
    ],
    torsoCaps: { back: [0, -1.02, 1.04], tip: [0, 0.80, 1.0] },
    neckRA: [0.32, 0.40], neckRB: [0.26, 0.30], neckRMid: [0.29, 0.36],
    legBulk: 1.35, headScale: 1.25, muzzleW: 1.15, muzzleLen: 0.75, headPitch: -20,
    earR: [0.03, 0.045, 0.04, 0.02], earH: 0.6,
    tail: [[0, -0.96, 1.20, 0.04], [0, -1.02, 1.10, 0.03], [0, -1.04, 0.90, 0.022]],
    tip: [[0, -1.04, 0.92, 0.03], [0, -1.045, 0.80, 0.05], [0, -1.045, 0.70, 0.025]],
    tipCaps: { back: [0, -1.04, 0.95], tip: [0, -1.045, 0.67] },
    // the shaggy forequarters: a dark wool cape over the hump, shoulders and neck, and woolly upper forelegs
    extraSegments: [
      { name: 'cape', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', up: true,
        stations: [{ at: [0, -0.15, 1.12], r: [0.41, 0.40] }, { at: [0, 0.20, 1.20], r: [0.46, 0.56] }, { at: [0, 0.55, 1.12], r: [0.42, 0.52] }, { at: [0, 0.85, 0.98], r: [0.34, 0.40] }],
        caps: { back: [0, -0.25, 1.12], tip: [0, 0.95, 0.94] } },
      { name: 'chapsR', kind: 'segment', from: 'shoulder', to: 'carpus', rA: [0.20, 0.24], rB: [0.10, 0.12], rMid: [0.17, 0.20], slots: 'ring12', group: 'Mane', mirror: 'name', over: [0.3, 0.2] },
      { name: 'dewlap', kind: 'segment', from: 'dewlapA', to: 'dewlapB', rA: [0.08, 0.14], rB: [0.05, 0.08], rMid: [0.07, 0.16], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.3] },
    ],
    headOrnaments: [
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.10, -0.08, 0.10], [0.17, -0.08, 0.12], [0.21, -0.06, 0.17], [0.20, -0.03, 0.22]], radii: [0.04, 0.032, 0.02, 0.006], m: 8, group: 'Horn' },
      { kind: 'sweep', name: 'beard', at: [3.5, 3.0], space: 'head', spine: [[0.004, 0.10, -0.30], [0.004, 0.08, -0.42], [0.004, 0.05, -0.52]], radii: [0.06, 0.05, 0.015], m: 8, group: 'Mane' },
    ],
  },

  // kept v5 (blind judges, both orders: v5 (patched coat via markings, bigger ears, leaner neck) over v1, 85% / 85%)
  // HOLSTEIN DAIRY COW (Bos taurus, Holstein-Friesian) — Thesis: a big ANGULAR wedge-shaped frame: a level back,
  // the hip bones (hooks) and pin bones jutting at the rump, a lean neck, little flesh over the ribs, on long clean
  // legs, cloven hooves · a polled lean head · ONE/TWO signatures: the large UDDER with four teats between the hind
  // legs, and the black-and-white PATCHED coat (white ground, black patches on the trunk and neck via markings, white
  // belly and legs) · 1.45 m at the withers (published mature Holstein cow ~1.45–1.50 m;
  // Holstein Association USA / Oklahoma State Breeds of Livestock).
  dairyCow: {
    family: 'bovid', name: 'a Holstein dairy cow', scale: 1,
    colors: { coat: '#f2efe8', sock: '#f2efe8', ash: '#1a1818', ashAlt: '#222020', snout: '#f2efe8', brow: '#111010', belly: '#f2efe8', tip: '#f2efe8', hoof: '#3a3430', nose: '#c89a94', mane: '#e8b0a8' },
    joints: {
      neckBase: [0, 0.55, 1.14], neckTop: [0, 1.02, 1.24],
      hookR: [0.24, -0.62, 1.40], hookR2: [0.27, -0.62, 1.36], pinR: [0.09, -1.02, 1.30], pinR2: [0.10, -1.08, 1.27],
      udderA: [0, -0.62, 0.78], udderB: [0, -0.60, 0.56],
      teatR: [0.07, -0.53, 0.56], teatTipR: [0.075, -0.53, 0.47], teatBR: [0.07, -0.70, 0.56], teatBTipR: [0.075, -0.70, 0.47],
    },
    torso: [
      { at: [0, -1.02, 1.06], r: [0.22, 0.28] },
      { at: [0, -0.85, 1.06], r: [0.30, 0.34] },
      { at: [0, -0.50, 1.04], r: [0.34, 0.38] },
      { at: [0, -0.10, 1.04], r: [0.38, 0.40] },
      { at: [0, 0.30, 1.04], r: [0.33, 0.40] },
      { at: [0, 0.62, 1.04], r: [0.25, 0.36] },
    ],
    torsoCaps: { back: [0, -1.10, 1.10], tip: [0, 0.78, 1.0] },
    neckRA: [0.18, 0.27], neckRB: [0.13, 0.17], neckRMid: [0.14, 0.20],
    legBulk: 1.0, headScale: 0.95, muzzleW: 1.0, muzzleLen: 0.95,
    earR: [0.045, 0.07, 0.065, 0.028], earH: 1.3,
    // the Holstein coat (markings channel): big irregular black patches over a white ground on the trunk and neck,
    // the belly and the legs left white
    markDensity: { torso: 2, neck: 2 },
    markings: [
      { on: 'torso', kind: 'patch', run: [0.02, 0.98], t: [0, 0.62], grid: [3, 2], size: [0.75, 0.9], brick: true, jitter: 0.7, seed: 5, group: 'Patch', color: '#1a1818' },
      { on: 'neck', kind: 'band', run: [0.35, 1], t: [0, 0.7], group: 'Patch', color: '#1a1818' },
    ],
    // the face white (a blaze down the front of the face), the poll and cheeks black
    craniumBandGroups: Object.fromEntries(['st2-st3', 'st3-st4', 'st4-st5', 'st5-st6'].map((b) => [b, ['Snout', 'Snout', 'Skull', 'Cheek', 'Jowl', 'Palate']])),
    extraSegments: [
      // hooks and pins: the hip bones jutting at the rump corners (angular dairy frame)
      { name: 'hookBoneR', kind: 'segment', from: 'hookR', to: 'hookR2', rA: 0.07, rB: 0.06, slots: 'ring12', group: 'Coat', mirror: 'name', over: [0.5, 0.5] },
      { name: 'pinBoneR', kind: 'segment', from: 'pinR', to: 'pinR2', rA: 0.05, rB: 0.04, slots: 'ring12', group: 'Coat', mirror: 'name', over: [0.5, 0.5] },
      // the udder: a big rounded bag between the hind legs, four teats below
      { name: 'udder', kind: 'segment', from: 'udderA', to: 'udderB', rA: [0.16, 0.20], rB: [0.15, 0.17], rMid: [0.19, 0.22], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.5] },
      { name: 'teatR', kind: 'segment', from: 'teatR', to: 'teatTipR', rA: 0.022, rB: 0.016, slots: 'ring12', group: 'Mane', mirror: 'name', over: [0.3, 0.4] },
      { name: 'teatBR', kind: 'segment', from: 'teatBR', to: 'teatBTipR', rA: 0.022, rB: 0.016, slots: 'ring12', group: 'Mane', mirror: 'name', over: [0.3, 0.4] },
    ],
    headOrnaments: [],
  },

  // DOMESTIC YAK (Bos grunniens) — Thesis: a heavy black ox under a LONG SHAGGY SKIRT of hair hanging from the flanks
  // and belly nearly to the ground (only the lower legs show) · a moderate HUMP over the shoulders, the back falling
  // to the rump · a short neck, the head carried low · long horns out sideways then UP, tips curving in · a BUSHY
  // horse-like tail · black-brown, pale horns · 1.25 m at the withers (published domestic yak bull ~1.1–1.4 m at the
  // withers; FAO, Wiener, Han & Long 2003, "The Yak"). Authored at bison units and scaled 0.72.
  yak: {
    family: 'bovid', name: 'a domestic yak', scale: 0.72,
    colors: { coat: '#2e2520', sock: '#2a221e', ash: '#2a221e', ashAlt: '#43352c', snout: '#3a302a', brow: '#1a1512', mane: '#221b17', horn: '#cfc6b4', tip: '#1e1814', hoof: '#151210', nose: '#151210', belly: '#221b17' },
    joints: {
      neckBase: [0, 0.62, 1.12], neckTop: [0, 0.98, 1.0],
      dewlapA: [0, 0.80, 0.70], dewlapB: [0, 1.02, 0.70],
    },
    torsoUp: true,
    torso: [
      { at: [0, -0.95, 1.0], r: [0.24, 0.28] },
      { at: [0, -0.82, 1.0], r: [0.33, 0.36], top: 0.02 },
      { at: [0, -0.45, 1.0], r: [0.38, 0.40], top: 0.04 },
      { at: [0, -0.05, 1.0], r: [0.41, 0.42], top: 0.12 },
      { at: [0, 0.30, 1.0], r: [0.41, 0.43], top: 0.24 },
      { at: [0, 0.62, 1.0], r: [0.34, 0.40], top: 0.10 },
    ],
    torsoCaps: { back: [0, -1.02, 1.04], tip: [0, 0.80, 1.0] },
    neckRA: [0.28, 0.36], neckRB: [0.22, 0.26], neckRMid: [0.25, 0.30],
    legBulk: 1.25, headScale: 1.1, muzzleW: 1.2, muzzleLen: 0.7, headPitch: -15, noseR: [0.025, 0.02],
    earR: [0.03, 0.045, 0.04, 0.02], earH: 0.7,
    // the bushy tail: a short dock, then a long full hair switch to the hocks
    tail: [[0, -0.98, 1.24, 0.05], [0, -1.05, 1.14, 0.045], [0, -1.07, 0.98, 0.04]],
    tip: [[0, -1.07, 1.02, 0.07], [0, -1.08, 0.80, 0.12], [0, -1.08, 0.56, 0.10], [0, -1.075, 0.40, 0.05]],
    tipCaps: { back: [0, -1.07, 1.08], tip: [0, -1.075, 0.34] },
    extraSegments: [
      // the SKIRT: a shaggy hanging fringe of hair round the flanks and belly; its own hem is high, the LOCKS below
      // carry it on down to a RAGGED edge near the knees
      { name: 'skirt', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', up: true,
        stations: [{ at: [0, -0.86, 0.80], r: [0.40, 0.38] }, { at: [0, -0.45, 0.76], r: [0.46, 0.46] }, { at: [0, -0.05, 0.76], r: [0.48, 0.48] }, { at: [0, 0.30, 0.78], r: [0.48, 0.46] }, { at: [0, 0.62, 0.84], r: [0.40, 0.40] }],
        caps: { back: [0, -0.98, 0.84], tip: [0, 0.76, 0.88] } },
      // the long locks: one row hung from the skirt's widest line, each a ragged length past the even hem
      ...YAK_SKIRT.map(([y, rx, zc], i) => lock([`skirtLock${i}R`, rx * (i % 2 ? 0.95 : 0.99), y, zc - 0.02 + 0.5 * RAG[(i + 7) % RAG.length], 0.25 - RAG[i % RAG.length], 0.08], i % 4 === 1 ? 'FurAlt' : 'Mane')),
      // the layered tufts: a shorter row over the long one, staggered between its locks (a coat in layers, not a sheet)
      ...YAK_SKIRT.slice(0, -1).map(([y, rx, zc], i) => lock([`skirtTuft${i}R`, rx * 1.0 + 0.02, y + 0.05, zc + 0.12 + RAG[(i + 3) % RAG.length], zc - 0.24 - 0.8 * RAG[(i + 5) % RAG.length], 0.065], i % 3 === 2 ? 'FurAlt' : 'Mane')),
      // the brisket fringe hanging between the forelegs
      ...[[0.10, 0.68, 0.0], [0.24, 0.64, 0.05]].map(([x, y, d], i) => lock([`chestLock${i}R`, x, y, 0.62, 0.22 - d, 0.055], 'Mane')),
      // the breeches: locks hanging off the haunches behind the skirt, round the rump
      ...[[0.33, -0.90, 0.80, 0.30], [0.22, -0.96, 0.84, 0.36]].map(([x, y, z0, z1], i) => lock([`rumpLock${i}R`, x, y, z0, z1, 0.06], i ? 'FurAlt' : 'Mane')),
      // the long-haired tail: loose strands falling round the switch, to below the hocks
      ...[[0.04, -1.075, 0.30], [0.025, -1.11, 0.26]].map(([x, y, z1], i) => lock([`tailLock${i}R`, x, y, 0.92, z1, 0.035], 'Tip')),
      // shaggy chaps on the upper forelegs, and the throat fringe
      { name: 'chapsR', kind: 'segment', from: 'shoulder', to: 'carpus', rA: [0.18, 0.22], rB: [0.10, 0.12], rMid: [0.15, 0.18], slots: 'ring12', group: 'Mane', mirror: 'name', over: [0.3, 0.2] },
      { name: 'dewlap', kind: 'segment', from: 'dewlapA', to: 'dewlapB', rA: [0.08, 0.14], rB: [0.05, 0.08], rMid: [0.07, 0.15], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.3] },
    ],
    headOrnaments: [
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.10, -0.08, 0.10], [0.19, -0.08, 0.12], [0.27, -0.06, 0.18], [0.31, -0.03, 0.27], [0.30, -0.02, 0.36], [0.25, -0.05, 0.42]], radii: [0.045, 0.038, 0.03, 0.022, 0.014, 0.005], m: 8, group: 'Horn' },
    ],
  },

  // WATER BUFFALO (Bubalus bubalis, a domestic river buffalo) — Thesis: a big heavy slate-grey ox with a SPARSE dark
  // hide, a straight back, short legs, NO real dewlap · the head carried LEVEL and forward (face out, not down), a
  // long face and broad muzzle, ears out sideways · ONE signature: WIDE flattened CRESCENT horns swept out and BACK
  // from the poll, the tips curving up · a thin tail to the hocks, pale lower legs · 1.35 m at the withers (published
  // domestic river buffalo 1.3–1.45 m; FAO, Cockrill 1974, "The Husbandry and Health of the Domestic Buffalo").
  // Authored at bull units and scaled 0.9.
  waterBuffalo: {
    family: 'bovid', name: 'a water buffalo', scale: 0.9,
    colors: { coat: '#3c3b3d', sock: '#8c8682', ash: '#353436', ashAlt: '#302f31', snout: '#2e2d2f', brow: '#1c1b1c', horn: '#2a2624', tip: '#1c1b1c', hoof: '#1a1818', nose: '#1a1818', belly: '#4a4848' },
    legBulk: 1.4, bulk: 1.08, headScale: 1.2, muzzleW: 1.6, muzzleLen: 0.6, noseR: [0.03, 0.02], headPitch: 10,
    joints: { neckBase: [0, 0.55, 1.12], neckTop: [0, 1.08, 1.26] },
    neckRA: [0.26, 0.32], neckRB: [0.19, 0.24], neckRMid: [0.21, 0.26],
    earR: [0.04, 0.06, 0.055, 0.025], earH: 1.1,
    extraSegments: [],
    headOrnaments: [
      // the crescent: out sideways from the poll, then sweeping BACK and up; flattened (wide in front, thin in depth)
      { kind: 'sweep', name: 'horn', at: [0.6, 1.2], space: 'head', spine: [[0.10, -0.10, 0.11], [0.20, -0.13, 0.13], [0.31, -0.19, 0.16], [0.40, -0.28, 0.22], [0.43, -0.37, 0.31], [0.39, -0.43, 0.40]], radii: [0.06, 0.055, 0.046, 0.034, 0.022, 0.008], squash: [1, 0.6], m: 8, group: 'Horn' },
    ],
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  bull: { common: 'bull', aliases: ['ox', 'steer', 'beef cattle'], sci: 'Bos taurus', size: '1.45 m at the withers', source: 'breed-society frame-score tables' },
  gazelle: { common: 'gazelle', aliases: ['thomson\'s gazelle', 'antelope'], sci: 'Eudorcas thomsonii', size: '0.62 m at the withers', source: 'ADW / Kingdon' },
  ram: { common: 'bighorn ram', aliases: ['bighorn', 'bighorn sheep', 'mountain sheep'], sci: 'Ovis canadensis', size: '0.95 m at the withers', source: 'ADW / NPS' },
  sheep: { common: 'sheep', aliases: ['lamb', 'ewe'], sci: 'Ovis aries', size: '0.75 m at the withers (a Suffolk ewe)', source: 'breed-society standards' },
  goat: { common: 'goat', aliases: ['billy goat', 'nanny goat'], sci: 'Capra hircus', size: '0.70 m at the withers', source: 'ADW / FAO breed descriptions' },
  bison: { common: 'bison', aliases: ['buffalo', 'american bison', 'american buffalo'], sci: 'Bison bison', size: '1.80 m at the withers (bull)', source: 'NPS Yellowstone / ADW' },
  yak: { common: 'yak', aliases: [], sci: 'Bos grunniens', size: '1.25 m at the withers (domestic bull; published ~1.1–1.4 m)', source: 'FAO, Wiener, Han & Long 2003, The Yak' },
  waterBuffalo: { common: 'water buffalo', aliases: ['water buffalo', 'carabao'], sci: 'Bubalus bubalis', size: '1.35 m at the withers (domestic river buffalo; published 1.3–1.45 m)', source: 'FAO, Cockrill 1974, The Husbandry and Health of the Domestic Buffalo' },
  dairyCow: { common: 'cow', aliases: ['dairy cow', 'holstein', 'milk cow', 'cattle'], sci: 'Bos taurus', size: '1.45 m at the withers (a Holstein)', source: 'Holstein Association USA' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {};
