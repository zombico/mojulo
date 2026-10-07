// EQUINE — a deep barrel on long slender legs ending in ONE hoof each (unguligrade), a long arched neck with a mane
// crest, a long wedge head carried nose-down, medium upright ears, a long hair tail from the dock. Worked species: the
// domestic riding horse. Authored at the horse's own size in metres (1 hand = 0.1016 m). See ../build.js for every field.

// the camel's (and the classic) head is authored level (rows in metres, +y to the muzzle) and then sheared nose-down: every z drops by
// `slope` metres per metre of y (the horse and zebra are authored level at true size and PITCHED instead: a shear
// stretches the skull along its slope and slants every feature)
const shear = (slope, depth) => {
  const dz = (y) => -slope * y;
  return {
    rows: (rows) => rows.map(([id, y, top, ...sides]) => {
      const palate = sides.pop();
      return [id, y, top * depth + dz(y), ...sides.map(([x, z]) => [x, z * depth + dz(y)]), palate * depth + dz(y)];
    }),
    jaw: (rows) => rows.map(([id, y, s]) => [id, y, {
      gum: s.gum * depth + dz(y), gumR: [s.gumR[0], s.gumR[1] * depth + dz(y)], jaw: [s.jaw[0], s.jaw[1] * depth + dz(y)], bottom: s.bottom * depth + dz(y),
    }]),
    pt: ([x, y, z]) => [x, y, z * depth + dz(y)],
  };
};

// the camel's level skull and jaw rows (sheared to its own carriage)
const SKULL = [
    ['st0', -0.12, 0.06, [0.04, 0.055], [0.08, 0.02], [0.09, -0.06], [0.09, -0.16], [0.06, -0.20], -0.21],
    ['st1', -0.04, 0.08, [0.04, 0.075], [0.095, 0.035], [0.10, -0.05], [0.095, -0.15], [0.06, -0.20], -0.21],
    ['st2', 0.06, 0.07, [0.04, 0.065], [0.08, 0.03], [0.085, -0.04], [0.07, -0.12], [0.045, -0.16], -0.17],
    ['st3', 0.18, 0.05, [0.035, 0.045], [0.06, 0.015], [0.065, -0.04], [0.055, -0.09], [0.04, -0.12], -0.125],
    ['st4', 0.30, 0.035, [0.03, 0.03], [0.05, 0.0], [0.055, -0.04], [0.05, -0.08], [0.04, -0.105], -0.11],
    ['st5', 0.40, 0.03, [0.03, 0.025], [0.055, -0.005], [0.06, -0.04], [0.055, -0.075], [0.045, -0.095], -0.10],
    ['st6', 0.47, 0.02, [0.03, 0.015], [0.05, -0.01], [0.055, -0.04], [0.05, -0.07], [0.04, -0.09], -0.095],
  ];
const JAW = [
    ['st0', -0.06, { gum: -0.20, gumR: [0.06, -0.20], jaw: [0.085, -0.29], bottom: -0.32 }],
    ['st1', 0.06, { gum: -0.165, gumR: [0.05, -0.165], jaw: [0.06, -0.23], bottom: -0.25 }],
    ['st2', 0.20, { gum: -0.12, gumR: [0.035, -0.12], jaw: [0.04, -0.17], bottom: -0.18 }],
    ['st3', 0.34, { gum: -0.10, gumR: [0.03, -0.10], jaw: [0.035, -0.15], bottom: -0.16 }],
    ['st4', 0.46, { gum: -0.088, gumR: [0.03, -0.088], jaw: [0.035, -0.14], bottom: -0.15 }],
  ];
// THE CLASSIC EQUINE FACE: the family's addresses and muzzle before the horse head was rebuilt, kept so the camel and
// the giraffe (whose head starts from it) build as they did
const CLASSIC_FACE = {
  muzzleFrom: 3, muzzleW: 1.25, eyeAt: [1.2, 2.3], eyeR: 0.022,
  browStrip: [[0.8, 1.9], [1.0, 1.9], [1.2, 1.95], [1.4, 2.0], [1.6, 2.1]],
  foldStrip: [[5.6, 2.4], [5.4, 2.9], [5.2, 3.4], [5.0, 3.8], [4.8, 4.2]],
  nostrilAt: [5.6, 2.0], webCranium: [1.7, 3.3, 4.97], earAt: [0.4, 1.3],
  // the classic orbit eye (any eyeStyle but 'set'), no pitch, the small nostrils and pad, the mid-head mouth web
  eyeStyle: 'orbit', headPitch: 0, nostrilR: 0.007, nostrilSquash: [1.3, 1], nosePad: true, webJaw: [0.35, 1.7, 0.97],
  // the builder's own band groups for the bands the horse recolours (muzzle from row 3)
  craniumBandGroups: Object.fromEntries(['st0-st1', 'st1-st2', 'st2-st3', 'st3-st4'].map((b, i) => [b, [...Array(3).fill(i < 3 ? 'Skull' : 'Snout'), 'Cheek', 'Jowl', 'Palate']])),
  skinControls: {
    browRaise: { amp: 0.01, map: [['st1.brow', 0.8, [0, 0, 1]], ['st2.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st2.brow', 1, [-0.3, 0.2, -1]], ['st1.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st5.lip', 0.8, [0.1, -1, 0.3]], ['st6.lip', 0.5, [0.1, -1, 0.3]]] },
  },
};

// the classic head itself: SKULL and JAW sheared 0.9 m per m nose-down, the face 1.3× deep (the giraffid's start)
export const CLASSIC_HEAD = (() => { const H = shear(0.9, 1.3); return { ...CLASSIC_FACE,
  craniumRows: H.rows(SKULL), craniumCaps: { back: H.pt([0, -0.16, -0.06]), tip: H.pt([0, 0.505, -0.045]) },
  jawRows: H.jaw(JAW), jawCaps: { back: H.pt([0, -0.10, -0.24]), tip: H.pt([0, 0.48, -0.10]) },
  headScale: 1, nape: H.pt([0, -0.13, -0.02]) }; })();

// THE HORSE HEAD, level and at true size (metres, +y to the muzzle, +z up; ~0.60 m poll to lips, published riding
// horse head length 0.55–0.65 m), carried nose-down by the head's `pitch`. Skull rows: [id, y, top, crown, brow,
// cheek, jowl, lip, palate]. The broad flat FOREHEAD between eyes set on the sides at the widest point (~0.21 m across
// the orbits) · the long straight NASAL line narrowing to ~0.10 m mid-face · the soft MUZZLE flaring a little at the
// nostrils · the mouth line only over the last quarter (the mouth corner ~0.13 m behind the lips).
const EQUUS_SKULL = [
  ['st0', -0.12, 0.055, [0.04, 0.05], [0.075, 0.02], [0.085, -0.03], [0.085, -0.07], [0.075, -0.085], -0.09],
  ['st1', -0.02, 0.07, [0.05, 0.065], [0.10, 0.025], [0.098, -0.03], [0.09, -0.065], [0.08, -0.08], -0.09],
  ['st2', 0.08, 0.065, [0.045, 0.06], [0.08, 0.02], [0.088, -0.035], [0.075, -0.07], [0.065, -0.085], -0.09],
  ['st3', 0.18, 0.055, [0.035, 0.05], [0.06, 0.015], [0.065, -0.03], [0.058, -0.065], [0.048, -0.082], -0.085],
  ['st4', 0.28, 0.045, [0.03, 0.04], [0.05, 0.01], [0.054, -0.025], [0.05, -0.058], [0.042, -0.076], -0.08],
  ['st5', 0.37, 0.035, [0.03, 0.03], [0.055, 0.0], [0.062, -0.03], [0.058, -0.058], [0.048, -0.072], -0.075],
  ['st6', 0.43, 0.02, [0.028, 0.016], [0.048, -0.01], [0.052, -0.035], [0.05, -0.058], [0.04, -0.07], -0.072],
];
// the jaw: the big ROUND JOWL (the cheek over the jaw's branches, deepest under the eye) whose front edge curves up
// into the thin straight under-jaw, the chin groove, the chin, the lower lip. Behind the mouth corner its upper edge
// stands just outside and above the skull's lip, so the seam is covered (no mouth line along the whole head).
const EQUUS_JAW = [
  ['st0', -0.10, { gum: -0.08, gumR: [0.088, -0.07], jaw: [0.095, -0.17], bottom: -0.20 }],
  ['st1', 0.00, { gum: -0.085, gumR: [0.094, -0.072], jaw: [0.097, -0.19], bottom: -0.235 }],
  ['st2', 0.12, { gum: -0.085, gumR: [0.078, -0.078], jaw: [0.062, -0.16], bottom: -0.185 }],
  ['st3', 0.26, { gum: -0.08, gumR: [0.05, -0.078], jaw: [0.04, -0.12], bottom: -0.14 }],
  ['st4', 0.35, { gum: -0.075, gumR: [0.042, -0.075], jaw: [0.04, -0.112], bottom: -0.13 }],
  ['st5', 0.42, { gum: -0.07, gumR: [0.04, -0.07], jaw: [0.04, -0.10], bottom: -0.118 }],
];
// behind the mouth corner the skull's underside is cheek, not mouth: those bands' last slot takes the jowl's colour
const COVERED = { group: 'Jowl', bands: ['st0-st1', 'st1-st2', 'st2-st3', 'st3-st4'] };

export const family = {
  family: 'equine',
  colors: {
    coat: '#7a4a2c', sock: '#241e19', ash: '#83533a', ashAlt: '#6c4128', brow: '#4a2c1a', iris: '#2a1a10',
    ink: '#120d0a', sclera: '#1d140e', nose: '#3a2a22', teeth: '#e6dfcc', mouth: '#4e3430', tip: '#1e1915',
    mane: '#1e1915', hoof: '#2e2a26', snout: '#5a3a28',
  },
  // legs: shoulder → elbow → carpus (knee) → fetlock → coronet → hoof; hip → stifle → hock → fetlock → coronet → hoof
  joints: {
    neckBase: [0, 0.46, 1.42], neckTop: [0, 0.88, 1.96],
    shoulder: [0.17, 0.52, 1.22], elbow: [0.18, 0.40, 0.94], carpus: [0.16, 0.44, 0.52], foreFetlock: [0.16, 0.45, 0.20], foreCoronet: [0.16, 0.50, 0.12], foreHoof: [0.16, 0.54, 0.05],
    hip: [0.16, -0.56, 1.16], stifle: [0.19, -0.34, 0.90], hock: [0.15, -0.70, 0.58], hindFetlock: [0.15, -0.63, 0.20], hindCoronet: [0.15, -0.58, 0.12], hindHoof: [0.15, -0.54, 0.05],
  },
  // the trunk in its mammal regions, rump to breast (on the stable ring frame, so centres may rise and fall): the
  // rounded buttock · the broad QUARTERS over the hip · the LOIN and FLANK tucked in and up (the belly line climbs to
  // the stifle) · the rib BARREL deepening to the GIRTH just behind the elbow · the WITHERS over the shoulder ·
  // the narrow breast between the forearms. Back line ~1.55 m, a touch higher at the withers than the croup.
  torsoUp: true,
  torso: [
    { at: [0, -0.84, 1.28], r: [0.18, 0.21] },
    { at: [0, -0.62, 1.25], r: [0.28, 0.30] },
    { at: [0, -0.36, 1.31], r: [0.215, 0.215] },
    { at: [0, -0.08, 1.23], r: [0.28, 0.32] },
    { at: [0, 0.18, 1.19], r: [0.295, 0.38] },
    { at: [0, 0.44, 1.25], r: [0.245, 0.34] },
    { at: [0, 0.66, 1.20], r: [0.16, 0.26] },
  ],
  torsoCaps: { back: [0, -0.94, 1.30], tip: [0, 0.78, 1.15] },
  neckRA: [0.17, 0.32], neckRB: [0.075, 0.10], neckRMid: [0.12, 0.21],
  // the tail is built in extraSegments (the hair must be Mane, and the builder's tail is Coat): no builder tail
  tail: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.10, 0.16], [0.08, 0.09], 'Coat', [0.6, 0.5], [0.10, 0.13]],
    ['foreArmR', 'elbow', 'carpus', [0.085, 0.10], [0.05, 0.055], 'Coat', [0.5, 0.4]],
    ['foreCannonR', 'carpus', 'foreFetlock', [0.045, 0.05], [0.04, 0.045], 'Sock', [0.4, 0.4]],
    ['forePasternR', 'foreFetlock', 'foreCoronet', [0.05, 0.05], 0.04, 'Sock', [0.4, 0.4]],
    ['foreHoofR', 'foreCoronet', 'foreHoof', 0.05, 0.065, 'Hoof', [0.3, 0.3]],
    ['thighR', 'hip', 'stifle', [0.13, 0.20], [0.09, 0.11], 'Coat', [0.2, 0.5], [0.13, 0.19]],
    ['gaskinR', 'stifle', 'hock', [0.08, 0.10], [0.05, 0.06], 'Coat', [0.5, 0.4]],
    ['hindCannonR', 'hock', 'hindFetlock', [0.045, 0.055], [0.04, 0.045], 'Sock', [0.4, 0.4]],
    ['hindPasternR', 'hindFetlock', 'hindCoronet', [0.05, 0.05], 0.04, 'Sock', [0.4, 0.4]],
    ['hindHoofR', 'hindCoronet', 'hindHoof', 0.05, 0.065, 'Hoof', [0.3, 0.3]],
  ],
  // the mane crest: a thin tall blade along the top of the neck, withers to poll
  extraSegments: [
    { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
      { at: [0, -0.82, 1.44], r: [0.05, 0.05] }, { at: [0, -0.92, 1.40], r: [0.055, 0.055] }, { at: [0, -0.98, 1.32], r: [0.05, 0.05] },
    ], caps: { back: [0, -0.78, 1.44], tip: [0, -1.00, 1.28] } },
    { name: 'tailHair', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
      { at: [0, -0.96, 1.36], r: [0.06, 0.07] }, { at: [0, -1.03, 1.18], r: [0.08, 0.10] }, { at: [0, -1.06, 0.95], r: [0.09, 0.11] },
      { at: [0, -1.07, 0.72], r: [0.08, 0.10] }, { at: [0, -1.06, 0.58], r: [0.05, 0.07] },
    ], caps: { back: [0, -0.93, 1.42], tip: [0, -1.05, 0.52] } },
    { name: 'mane', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
      { at: [0, 0.28, 1.64], r: [0.03, 0.05] }, { at: [0, 0.48, 1.83], r: [0.035, 0.08] },
      { at: [0, 0.66, 1.96], r: [0.035, 0.08] }, { at: [0, 0.80, 2.04], r: [0.03, 0.06] },
    ], caps: { back: [0, 0.22, 1.60], tip: [0, 0.86, 2.08] } },
  ],
  craniumRows: EQUUS_SKULL,
  craniumCaps: { back: [0, -0.155, -0.01], tip: [0, 0.46, -0.03] },
  muzzleFrom: 4, muzzleW: 1,
  craniumBandGroups: Object.fromEntries(COVERED.bands.map((b) => [b, ['Skull', 'Skull', 'Skull', 'Cheek', 'Jowl', COVERED.group]])),
  jawRows: EQUUS_JAW,
  jawCaps: { back: [0, -0.15, -0.13], tip: [0, 0.455, -0.09] },
  headPitch: -50,
  skinControls: {
    browRaise: { amp: 0.01, map: [['st1.brow', 0.8, [0, 0, 1]], ['st2.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st1.brow', 1, [-0.3, 0.2, -1]], ['st0.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st2.cheek', 1, [0.5, 0, 0.8]], ['st1.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st5.lip', 0.8, [0.1, -1, 0.3]], ['st6.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1, nape: [0, -0.13, -0.03],
  // big eyes set high on the sides at the widest point, just behind the orbit rim; large open comma nostrils on the
  // front of the muzzle; no bare nose pad (a horse's muzzle is soft haired skin)
  eyeAt: [1.1, 2.35], eyeR: 0.026, pupil: 'round', irisAngle: 40, eyeStyle: 'set', eyeSet: { sink: 0.5, open: [0.6, 0.45] },
  browStrip: [[0.6, 1.95], [0.85, 1.9], [1.1, 1.9], [1.35, 1.95], [1.6, 2.05]],
  foldStrip: [[5.5, 2.7], [5.3, 3.1], [5.1, 3.5], [4.9, 3.9], [4.7, 4.3]],
  nostrilAt: [5.5, 2.3], nostrilR: 0.014, nostrilSquash: [1.5, 0.9], nosePad: false,
  noseAt: [5.8, 0.0001], noseR: [0.012, 0.01],
  webCranium: [4.6, 5.6, 4.97], webJaw: [3.8, 4.9, 0.97],
  earAt: [0.4, 1.25], earSpine: [[0, 0, -0.012], [0, 0, 0.03], [0, 0, 0.07], [0, 0, 0.11], [0, 0, 0.15]],
  earR: [0.035, 0.036, 0.026, 0.01], earSquash: [1, 0.5], earH: 1,
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

export const species = {
  // DOMESTIC HORSE (Equus ferus caballus), a riding horse — THESIS: rectangular deep-barrelled trunk on long slender
  // legs, withers a touch above a level croup · unguligrade, one hoof per leg, knee and hock at mid-leg · a long wedge
  // head hung nose-down from a long arched neck with a mane crest · medium upright ears · a long hair tail from the dock
  // · bay with black points · 1.57 m at the withers (15.5 hands; riding horses 15–16 hh = 1.52–1.63 m).
  horse: {
    family: 'equine', name: 'a riding horse', scale: 1, legBulk: 1.2,
  },
  // DROMEDARY (Camelus dromedarius) — THESIS: a short deep trunk set HIGH on very long thin legs (the belly at ~1.2 m),
  // ONE tall hump over the mid-back · broad flat padded two-toed feet, no hooves; straight forelegs with a high elbow,
  // hind thigh standing free of the body, hock low · a long U-curved neck hung forward and down from the chest, rising
  // to a short blunt level-carried head with small ears · a short thin tufted tail · sandy coat · withers (top of the
  // trunk, NOT the hump) 1.86 m: published shoulder height 1.8–2.0 m (hump top ~2.1 m).
  // kept v9 (upgrade pass 1006, blind judges vs v3, both orders: v9 72% / 75%; v1 cards unavailable)
  camel: (() => {
    const H = shear(0.15, 1.15);
    // a deeper blunt jaw under the short muzzle
    const jaw = JAW.map(([id, y, j]) => [id, y, { ...j, jaw: [j.jaw[0], j.jaw[1] * 0.95], bottom: j.bottom * 0.95 }]);
    return {
      family: 'equine', name: 'a dromedary camel', scale: 1, legBulk: 1, headScale: 0.75, torsoUp: false,   // its own level trunk
      ...CLASSIC_FACE, muzzleLen: 0.47, muzzleW: 1.35,
      colors: { coat: '#c29a68', sock: '#b48a5a', ash: '#c8a272', ashAlt: '#b08656', mane: '#5a4028', hoof: '#7a6450', snout: '#a8845c', tip: '#7a5a3c' },
      joints: {
        neckBase: [0, 1.30, 1.80], neckTop: [0, 1.44, 2.00],
        shoulder: [0.19, 0.50, 1.52], elbow: [0.20, 0.44, 1.16], carpus: [0.15, 0.48, 0.64], foreFetlock: [0.15, 0.50, 0.18], foreCoronet: [0.15, 0.56, 0.08], foreHoof: [0.15, 0.66, 0.035],
        hip: [0.17, -0.58, 1.50], stifle: [0.23, -0.36, 1.04], hock: [0.15, -0.70, 0.66], hindFetlock: [0.15, -0.64, 0.18], hindCoronet: [0.15, -0.58, 0.08], hindHoof: [0.15, -0.48, 0.035],
      },
      torso: [
        { at: [0, -0.80, 1.50], r: [0.17, 0.22] },
        { at: [0, -0.58, 1.50], r: [0.24, 0.30] },
        { at: [0, -0.25, 1.50], r: [0.29, 0.34] },
        { at: [0, 0.10, 1.50], r: [0.30, 0.36] },
        { at: [0, 0.40, 1.50], r: [0.26, 0.35] },
        { at: [0, 0.62, 1.50], r: [0.19, 0.28] },
      ],
      torsoCaps: { back: [0, -0.90, 1.54], tip: [0, 0.74, 1.46] },
      neckRA: [0.085, 0.10], neckRB: [0.07, 0.085], neckRMid: [0.075, 0.09],
      legs: [
        ['upperArmR', 'shoulder', 'elbow', [0.09, 0.14], [0.07, 0.08], 'Coat', [0.6, 0.5], [0.09, 0.11]],
        ['foreArmR', 'elbow', 'carpus', [0.06, 0.07], [0.045, 0.05], 'Coat', [0.5, 0.4]],
        ['foreCannonR', 'carpus', 'foreFetlock', [0.04, 0.045], [0.035, 0.04], 'Coat', [0.4, 0.4]],
        ['forePasternR', 'foreFetlock', 'foreCoronet', [0.045, 0.045], [0.05, 0.05], 'Sock', [0.4, 0.4]],
        ['foreHoofR', 'foreCoronet', 'foreHoof', [0.07, 0.05], [0.08, 0.03], 'Hoof', [0.3, 0.3]],
        ['thighR', 'hip', 'stifle', [0.11, 0.18], [0.08, 0.09], 'Coat', [0.2, 0.5], [0.11, 0.15]],
        ['gaskinR', 'stifle', 'hock', [0.065, 0.075], [0.045, 0.05], 'Coat', [0.5, 0.4]],
        ['hindCannonR', 'hock', 'hindFetlock', [0.04, 0.045], [0.035, 0.04], 'Coat', [0.4, 0.4]],
        ['hindPasternR', 'hindFetlock', 'hindCoronet', [0.045, 0.045], [0.05, 0.05], 'Sock', [0.4, 0.4]],
        ['hindHoofR', 'hindCoronet', 'hindHoof', [0.07, 0.05], [0.08, 0.03], 'Hoof', [0.3, 0.3]],
      ],
      extraSegments: [
        // the ONE hump: a level loft riding the mid-back, its top at ~2.1 m
        { name: 'hump', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
          { at: [0, -0.48, 1.80], r: [0.12, 0.05] }, { at: [0, -0.28, 1.80], r: [0.21, 0.22] }, { at: [0, -0.06, 1.80], r: [0.24, 0.34] },
          { at: [0, 0.18, 1.80], r: [0.21, 0.24] }, { at: [0, 0.40, 1.80], r: [0.12, 0.06] },
        ], caps: { back: [0, -0.56, 1.80], tip: [0, 0.48, 1.80] } },
        // the long neck: forward and DOWN from the chest, then up to the head (a U)
        { name: 'neckDown', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
          { at: [0, 0.58, 1.62], r: [0.15, 0.20] }, { at: [0, 0.84, 1.46], r: [0.11, 0.14] }, { at: [0, 1.06, 1.38], r: [0.09, 0.11] },
        ], caps: { back: [0, 0.48, 1.68], tip: [0, 1.13, 1.36] } },
        { name: 'neckUp', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
          { at: [0, 1.02, 1.36], r: [0.09, 0.11] }, { at: [0, 1.22, 1.52], r: [0.085, 0.10] }, { at: [0, 1.32, 1.84], r: [0.072, 0.088] },
          { at: [0, 1.345, 1.94], r: [0.06, 0.075] },
        ], caps: { back: [0, 0.96, 1.32], tip: [0, 1.35, 1.99] } },
        // the two-toed padded foot: two broad flat toes split by a cleft, forward of the pastern (no hoof)
        ...[['fore', 0.56, 0.74], ['hind', -0.56, -0.40]].flatMap(([k, y0, y1]) => [['In', 0.10], ['Out', 0.20]].map(([side, x]) => ({
          name: `${k}Toe${side}R`, kind: 'loft', slots: 'ring12', group: 'Sock', mirror: 'name', stations: [
            { at: [x, y0, 0.022], r: [0.055, 0.02] }, { at: [x, (y0 + y1) / 2 + 0.01, 0.018], r: [0.06, 0.016] }, { at: [x, y1, 0.014], r: [0.045, 0.012] },
          ], caps: { back: [x, y0 - 0.03, 0.026], tip: [x, y1 + 0.02, 0.012] } }))),
        // a short thin tail to the hock, a dark tuft at the end
        { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
          { at: [0, -0.84, 1.64], r: [0.04, 0.04] }, { at: [0, -0.93, 1.50], r: [0.035, 0.035] }, { at: [0, -0.96, 1.20], r: [0.03, 0.03] },
        ], caps: { back: [0, -0.80, 1.68], tip: [0, -0.965, 1.14] } },
        { name: 'tailHair', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
          { at: [0, -0.96, 1.18], r: [0.04, 0.045] }, { at: [0, -0.97, 1.02], r: [0.065, 0.075] }, { at: [0, -0.97, 0.90], r: [0.04, 0.045] },
        ], caps: { back: [0, -0.96, 1.22], tip: [0, -0.97, 0.84] } },
      ],
      craniumRows: H.rows(SKULL), craniumCaps: { back: H.pt([0, -0.16, -0.06]), tip: H.pt([0, 0.505, -0.045]) },
      jawRows: H.jaw(jaw), jawCaps: { back: H.pt([0, -0.10, -0.24]), tip: H.pt([0, 0.48, -0.10]) },
      nape: H.pt([0, -0.13, -0.02]),
      headOrnaments: [
          // the heavy overhanging SPLIT upper lip (head units, one sweep a side), drooping over and past the lower jaw
        { kind: 'sweep', name: 'upperLip', at: [5.5, 0.0001], space: 'head', spine: [[0.025, 0.25, -0.075], [0.028, 0.32, -0.10], [0.03, 0.38, -0.135], [0.03, 0.40, -0.185], [0.028, 0.39, -0.235]], radii: [0.03, 0.045, 0.05, 0.048, 0.032], m: 8, group: 'Snout' },
      ],
      // small rounded ears
      earSpine: [[0, 0, -0.01], [0, 0, 0.015], [0, 0, 0.035], [0, 0, 0.05], [0, 0, 0.06]], earR: [0.022, 0.022, 0.016, 0.006], earH: 0.6,
    };
  })(),
  // PLAINS ZEBRA (Equus quagga) — THESIS: a horse made STOCKY: a rounder deep barrel on shorter, thicker legs, one
  // hoof per leg · a thick neck with a short STIFF UPRIGHT MANE (no forelock fall) · a long head, dark muzzle, larger
  // rounded ears · a thin tail with a dark tuft · the black-and-white STRIPES, vertical hoops on trunk and neck,
  // horizontal on the legs (no markings channel: the stripes are thin black band lofts / segments just proud of the
  // coat) · 1.33 m at the withers (published 1.27–1.40 m shoulder height, Estes 1991 "The Behavior Guide to African
  // Mammals"). Authored at horse units, scaled 0.85.
  // kept v10 (upgrade pass 1006, blind judges vs v3, both orders: v10 62% / 72%, plus the finisher's 65%; v1 cards unavailable)
  zebra: {
    family: 'equine', name: 'a plains zebra', scale: 0.85, bulk: 1.08, legBulk: 1.45, headScale: 1.04,   // a heavier head than the horse's (~0.52 m)
    colors: { coat: '#e9e5dc', sock: '#e2ddd2', ash: '#dcd6ca', ashAlt: '#cfc8ba', mane: '#1b1817', snout: '#e9e5dc', tip: '#1b1817', hoof: '#26221f', brow: '#2a2523' },
    neckRA: [0.18, 0.33], neckRB: [0.085, 0.11], neckRMid: [0.13, 0.22],
    // big rounded ears, taller than a horse's
    earR: [0.06, 0.067, 0.05, 0.02], earH: 1.17,
    // the dark muzzle: only the last skull band
    craniumBandGroups: { 'st5-st6': ['Brow', 'Brow', 'Brow', 'Brow', 'Brow', 'Palate'] },
    // the stripes are painted on the body's own faces (no geometry): vertical hoops on trunk and neck stopping short of
    // the pale belly, horizontal rings down the legs; finer rings so each stripe lands on its own band
    markDensity: { torso: 6, neck: 5, legs: 4 },
    markings: [
      { on: 'torso', kind: 'stripes', group: 'Mane', count: 12, width: 0.42, run: [0.04, 0.97], t: [0, 0.82] },
      { on: 'neck', kind: 'stripes', group: 'Mane', count: 6, width: 0.38, run: [0, 0.97] },
      { on: ['upperArm', 'foreArm', 'thigh', 'gaskin'], kind: 'stripes', group: 'Mane', count: 4, width: 0.42 },
      { on: ['foreCannon', 'hindCannon'], kind: 'stripes', group: 'Mane', count: 3, width: 0.42 },
    ],
    extraSegments: [
      // a thin tail to the hocks, a dark tuft at its end (no horse's long hair)
      { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
        { at: [0, -0.82, 1.44], r: [0.045, 0.045] }, { at: [0, -0.92, 1.36], r: [0.04, 0.04] }, { at: [0, -0.96, 1.05], r: [0.035, 0.035] },
      ], caps: { back: [0, -0.78, 1.46], tip: [0, -0.965, 1.00] } },
      { name: 'tailHair', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
        { at: [0, -0.96, 1.08], r: [0.04, 0.045] }, { at: [0, -0.97, 0.88], r: [0.065, 0.075] }, { at: [0, -0.97, 0.70], r: [0.04, 0.05] },
      ], caps: { back: [0, -0.96, 1.12], tip: [0, -0.97, 0.64] } },
      // the stiff upright mane: a tall even brush standing straight up off the neck, withers to poll
      { name: 'mane', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
        { at: [0, 0.26, 1.66], r: [0.022, 0.07] }, { at: [0, 0.46, 1.85], r: [0.025, 0.095] },
        { at: [0, 0.64, 1.98], r: [0.025, 0.095] }, { at: [0, 0.80, 2.07], r: [0.022, 0.08] },
      ], caps: { back: [0, 0.18, 1.64], tip: [0, 0.88, 2.18] } },
    ],
  },
  // DOMESTIC DONKEY (Equus africanus asinus), a standard donkey — THESIS: a small horse made plain and boxy: a straight
  // back with no withers to speak of, a deep barrel on short straight legs with small upright hooves · a big heavy
  // head on a thick short neck · the LONG EARS (about a third of the head's length again) standing up · a short
  // UPRIGHT mane (no forelock) · a thin cow-like tail ending in a dark tuft · grey-dun coat with a dark dorsal stripe,
  // a WHITE MUZZLE and pale belly · 1.07 m at the withers (published standard donkey 0.91–1.22 m; American Donkey and
  // Mule Society size classes / The Donkey Sanctuary). Authored at horse units and scaled 0.68.
  donkey: {
    family: 'equine', name: 'a donkey', scale: 0.68, bulk: 1.06, legBulk: 1.45, headScale: 1.22,
    colors: { coat: '#8a8079', sock: '#7a716b', ash: '#8f857e', ashAlt: '#7e756f', mane: '#2e2926', tip: '#2e2926', snout: '#e2dcd2', belly: '#d9d2c7', hoof: '#3a332e', brow: '#3a332e', ears: '#8a8079' },
    // the straight back: the withers no higher than the croup
    torso: [
      { at: [0, -0.84, 1.29], r: [0.19, 0.22] },
      { at: [0, -0.62, 1.26], r: [0.29, 0.31] },
      { at: [0, -0.36, 1.28], r: [0.24, 0.24] },
      { at: [0, -0.08, 1.22], r: [0.30, 0.33] },
      { at: [0, 0.18, 1.19], r: [0.30, 0.37] },
      { at: [0, 0.44, 1.22], r: [0.25, 0.32] },
      { at: [0, 0.66, 1.18], r: [0.17, 0.25] },
    ],
    neckRA: [0.19, 0.32], neckRB: [0.095, 0.12], neckRMid: [0.14, 0.22],
    joints: { neckBase: [0, 0.46, 1.40], neckTop: [0, 0.84, 1.88] },
    // the long ears, standing up and a little apart; dark-rimmed tips
    earR: [0.04, 0.055, 0.05, 0.016], earH: 2.0, earSquash: [1, 0.45],
    // the white muzzle (the builder's snout bands) and a pale ring round the eye's band; a pale lower jaw
    headPalette: { Jaw: '#d6cfc4' },
    markDensity: { torso: 2 },
    markings: [
      { on: 'torso', kind: 'band', run: [0.04, 0.96], t: [0, 0.05], group: 'Stripe', color: '#3a332e' },
      { on: 'torso', kind: 'belly', from: 0.72, group: 'Belly', color: '#d9d2c7' },
    ],
    extraSegments: [
      // a thin tail to the hocks, a dark tuft at its end
      { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
        { at: [0, -0.82, 1.42], r: [0.045, 0.045] }, { at: [0, -0.92, 1.34], r: [0.038, 0.038] }, { at: [0, -0.96, 1.00], r: [0.032, 0.032] },
      ], caps: { back: [0, -0.78, 1.44], tip: [0, -0.965, 0.95] } },
      { name: 'tailHair', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
        { at: [0, -0.96, 1.02], r: [0.04, 0.045] }, { at: [0, -0.97, 0.84], r: [0.07, 0.08] }, { at: [0, -0.97, 0.66], r: [0.04, 0.05] },
      ], caps: { back: [0, -0.96, 1.06], tip: [0, -0.97, 0.60] } },
      // the short upright mane, a dark brush withers to poll
      { name: 'mane', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
        { at: [0, 0.30, 1.62], r: [0.022, 0.05] }, { at: [0, 0.48, 1.78], r: [0.025, 0.07] },
        { at: [0, 0.64, 1.90], r: [0.025, 0.07] }, { at: [0, 0.78, 1.99], r: [0.022, 0.06] },
      ], caps: { back: [0, 0.22, 1.60], tip: [0, 0.86, 2.08] } },
    ],
  },
  // LLAMA (Lama glama) — THESIS: a camelid WITHOUT a hump: a level woolly barrel on long legs with two-toed padded
  // feet · a LONG neck carried nearly UPRIGHT straight up from the chest (not the camel's U) · a small head with a
  // longish muzzle and a split lip · tall curved BANANA EARS turning in at the tips · a short tail held out · a
  // thick woolly coat (brown-and-white) · 1.14 m at the withers (published 1.09–1.19 m shoulder height; ADW,
  // Lama glama). Authored at camel units (its legs and feet) and scaled 0.6.
  llama: (() => {
    const H = shear(0.35, 1.1);
    return {
      family: 'equine', name: 'a llama', scale: 0.6, bulk: 1.15, legBulk: 1.45, headScale: 0.86, torsoUp: false,
      ...CLASSIC_FACE, muzzleLen: 0.62, muzzleW: 1.1, eyeStyle: 'set', eyeR: 0.03,
      colors: { coat: '#8e5f3a', sock: '#7e5232', ash: '#946540', ashAlt: '#86583a', mane: '#7a4e2e', hoof: '#2e241e', snout: '#6e4628', tip: '#7a4e2e', brow: '#4a2e1a', ears: '#7e5232', belly: '#a87a52', nose: '#1e1712' },
      joints: {
        neckBase: [0, 0.56, 1.66], neckTop: [0, 0.82, 2.78],
        shoulder: [0.19, 0.50, 1.52], elbow: [0.20, 0.44, 1.16], carpus: [0.15, 0.48, 0.64], foreFetlock: [0.15, 0.50, 0.18], foreCoronet: [0.15, 0.56, 0.08], foreHoof: [0.15, 0.66, 0.035],
        hip: [0.17, -0.58, 1.50], stifle: [0.23, -0.36, 1.04], hock: [0.15, -0.70, 0.66], hindFetlock: [0.15, -0.64, 0.18], hindCoronet: [0.15, -0.58, 0.08], hindHoof: [0.15, -0.48, 0.035],
      },
      // a level woolly barrel, no hump; the brown patches on the rump and flank (markings)
      torso: [
        { at: [0, -0.84, 1.52], r: [0.22, 0.26] },
        { at: [0, -0.60, 1.52], r: [0.30, 0.34] },
        { at: [0, -0.25, 1.52], r: [0.33, 0.36] },
        { at: [0, 0.10, 1.52], r: [0.33, 0.37] },
        { at: [0, 0.40, 1.52], r: [0.30, 0.36] },
        { at: [0, 0.62, 1.52], r: [0.22, 0.30] },
      ],
      torsoCaps: { back: [0, -0.96, 1.54], tip: [0, 0.74, 1.52] },
      neckRA: [0.22, 0.27], neckRB: [0.10, 0.12], neckRMid: [0.15, 0.18],
      legs: [
        ['upperArmR', 'shoulder', 'elbow', [0.10, 0.15], [0.075, 0.085], 'Coat', [0.6, 0.5], [0.10, 0.12]],
        ['foreArmR', 'elbow', 'carpus', [0.06, 0.07], [0.045, 0.05], 'Coat', [0.5, 0.4]],
        ['foreCannonR', 'carpus', 'foreFetlock', [0.04, 0.045], [0.035, 0.04], 'Coat', [0.4, 0.4]],
        ['forePasternR', 'foreFetlock', 'foreCoronet', [0.045, 0.045], [0.05, 0.05], 'Sock', [0.4, 0.4]],
        ['foreHoofR', 'foreCoronet', 'foreHoof', [0.07, 0.05], [0.08, 0.03], 'Hoof', [0.3, 0.3]],
        ['thighR', 'hip', 'stifle', [0.12, 0.19], [0.085, 0.095], 'Coat', [0.2, 0.5], [0.12, 0.16]],
        ['gaskinR', 'stifle', 'hock', [0.065, 0.075], [0.045, 0.05], 'Coat', [0.5, 0.4]],
        ['hindCannonR', 'hock', 'hindFetlock', [0.04, 0.045], [0.035, 0.04], 'Coat', [0.4, 0.4]],
        ['hindPasternR', 'hindFetlock', 'hindCoronet', [0.045, 0.045], [0.05, 0.05], 'Sock', [0.4, 0.4]],
        ['hindHoofR', 'hindCoronet', 'hindHoof', [0.07, 0.05], [0.08, 0.03], 'Hoof', [0.3, 0.3]],
      ],
      extraSegments: [
        // the two-toed padded foot (as the camel's)
        ...[['fore', 0.56, 0.74], ['hind', -0.56, -0.40]].flatMap(([k, y0, y1]) => [['In', 0.10], ['Out', 0.20]].map(([side, x]) => ({
          name: `${k}Toe${side}R`, kind: 'loft', slots: 'ring12', group: 'Sock', mirror: 'name', stations: [
            { at: [x, y0, 0.022], r: [0.055, 0.02] }, { at: [x, (y0 + y1) / 2 + 0.01, 0.018], r: [0.06, 0.016] }, { at: [x, y1, 0.014], r: [0.045, 0.012] },
          ], caps: { back: [x, y0 - 0.03, 0.026], tip: [x, y1 + 0.02, 0.012] } }))),
        // a short woolly tail carried out and a little up from the rump
        { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', up: true, stations: [
          { at: [0, -0.90, 1.72], r: [0.07, 0.07] }, { at: [0, -1.02, 1.74], r: [0.08, 0.08] }, { at: [0, -1.12, 1.68], r: [0.065, 0.065] },
        ], caps: { back: [0, -0.84, 1.72], tip: [0, -1.17, 1.62] } },
      ],
      craniumRows: H.rows(SKULL), craniumCaps: { back: H.pt([0, -0.16, -0.06]), tip: H.pt([0, 0.505, -0.045]) },
      jawRows: H.jaw(JAW), jawCaps: { back: H.pt([0, -0.10, -0.24]), tip: H.pt([0, 0.48, -0.10]) },
      nape: H.pt([0, -0.13, -0.02]),
      // the tall banana ears: up from the crown, bowed out, the tips turning IN over the poll (local +y)
      earSpine: [[0, 0, -0.01], [0, -0.015, 0.05], [0.005, -0.015, 0.11], [0.01, 0.025, 0.16], [0.01, 0.075, 0.18]], earR: [0.028, 0.034, 0.028, 0.008], earSquash: [1, 0.5], earH: 1.15,
    };
  })(),
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  horse: { common: 'horse', aliases: ['pony', 'stallion', 'mare', 'foal', 'steed'], sci: 'Equus ferus caballus', size: '1.57 m at the withers (15.5 hands)', source: 'riding horse heights, 15–16 hh' },
  camel: { common: 'camel', aliases: ['dromedary', 'arabian camel'], sci: 'Camelus dromedarius', size: '1.86 m at the withers, hump top ~2.1 m', source: 'published dromedary figures' },
  zebra: { common: 'zebra', aliases: ['plains zebra'], sci: 'Equus quagga', size: '1.33 m at the withers', source: 'Estes 1991, The Behavior Guide to African Mammals' },
  donkey: { common: 'donkey', aliases: ['burro', 'ass', 'mule'], sci: 'Equus africanus asinus', size: '1.07 m at the withers (a standard donkey; published 0.91–1.22 m)', source: 'American Donkey and Mule Society size classes / The Donkey Sanctuary' },
  llama: { common: 'llama', aliases: ['alpaca'], sci: 'Lama glama', size: '1.14 m at the withers (published 1.09–1.19 m)', source: 'ADW, Lama glama' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {};
