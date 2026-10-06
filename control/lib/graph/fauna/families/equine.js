// EQUINE — a deep barrel on long slender legs ending in ONE hoof each (unguligrade), a long arched neck with a mane
// crest, a long wedge head carried nose-down, medium upright ears, a long hair tail from the dock. Worked species: the
// domestic riding horse. Authored at the horse's own size in metres (1 hand = 0.1016 m). See ../build.js for every field.

// the head is authored level (rows in metres, +y to the muzzle) and then sheared nose-down: every z drops by
// `slope` metres per metre of y, so the long face hangs from the poll as a horse carries it
const SLOPE = 0.9, DEPTH = 1.3;   // DEPTH: the face's depth before the shear (the shear thins it)
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
const { rows: sheared, jaw: shearedJaw, pt } = shear(SLOPE, DEPTH);

// the level skull and jaw rows, shared by every species (each shears them to its own head carriage)
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
  // a level trunk (centre z 1.22): croup and buttock behind, the deep barrel, the girth, the chest in front
  torso: [
    { at: [0, -0.80, 1.22], r: [0.19, 0.26] },
    { at: [0, -0.56, 1.22], r: [0.27, 0.34] },
    { at: [0, -0.22, 1.22], r: [0.30, 0.36] },
    { at: [0, 0.14, 1.22], r: [0.30, 0.37] },
    { at: [0, 0.44, 1.22], r: [0.25, 0.36] },
    { at: [0, 0.66, 1.22], r: [0.18, 0.30] },
  ],
  torsoCaps: { back: [0, -0.90, 1.26], tip: [0, 0.78, 1.16] },
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
  // skull rows (metres, level, then sheared): [id, y, top, crown, brow, cheek, jowl, lip, palate]; the deep round
  // jowl at the back, a long straight face, the muzzle at the end
  craniumRows: sheared(SKULL),
  craniumCaps: { back: pt([0, -0.16, -0.06]), tip: pt([0, 0.505, -0.045]) },
  muzzleFrom: 3,
  jawRows: shearedJaw(JAW),
  jawCaps: { back: pt([0, -0.10, -0.24]), tip: pt([0, 0.48, -0.10]) },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st1.brow', 0.8, [0, 0, 1]], ['st2.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st2.brow', 1, [-0.3, 0.2, -1]], ['st1.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st5.lip', 0.8, [0.1, -1, 0.3]], ['st6.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1, muzzleW: 1.25, nape: pt([0, -0.13, -0.02]),
  // eyes set high and far back on the side of the head; nostrils lateral on the muzzle; no dark nose pad
  eyeAt: [1.2, 2.3], eyeR: 0.022, pupil: 'round', irisAngle: 40,
  browStrip: [[0.8, 1.9], [1.0, 1.9], [1.2, 1.95], [1.4, 2.0], [1.6, 2.1]],
  foldStrip: [[5.6, 2.4], [5.4, 2.9], [5.2, 3.4], [5.0, 3.8], [4.8, 4.2]],
  nostrilAt: [5.6, 2.0], noseAt: [5.8, 0.0001], noseR: [0.012, 0.01], webCranium: [1.7, 3.3, 4.97],
  earAt: [0.4, 1.3], earSpine: [[0, 0, -0.012], [0, 0, 0.03], [0, 0, 0.07], [0, 0, 0.11], [0, 0, 0.15]],
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
  camel: (() => {
    const H = shear(0.15, 1.15);
    // a shallow jaw: no horse's deep round jowl
    const jaw = JAW.map(([id, y, j]) => [id, y, { ...j, jaw: [j.jaw[0], j.jaw[1] * 0.8], bottom: j.bottom * 0.75 }]);
    return {
      family: 'equine', name: 'a dromedary camel', scale: 1, legBulk: 1, headScale: 0.75,
      colors: { coat: '#c29a68', sock: '#b48a5a', ash: '#c8a272', ashAlt: '#b08656', mane: '#9a7650', hoof: '#7a6450', snout: '#a8845c', tip: '#7a5a3c' },
      joints: {
        neckBase: [0, 1.30, 1.80], neckTop: [0, 1.36, 2.04],
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
      neckRA: [0.08, 0.10], neckRB: [0.07, 0.085], neckRMid: [0.075, 0.09],
      legs: [
        ['upperArmR', 'shoulder', 'elbow', [0.09, 0.14], [0.07, 0.08], 'Coat', [0.6, 0.5], [0.09, 0.11]],
        ['foreArmR', 'elbow', 'carpus', [0.06, 0.07], [0.045, 0.05], 'Coat', [0.5, 0.4]],
        ['foreCannonR', 'carpus', 'foreFetlock', [0.04, 0.045], [0.035, 0.04], 'Coat', [0.4, 0.4]],
        ['forePasternR', 'foreFetlock', 'foreCoronet', [0.045, 0.045], [0.05, 0.05], 'Sock', [0.4, 0.4]],
        ['foreHoofR', 'foreCoronet', 'foreHoof', [0.08, 0.05], [0.12, 0.03], 'Hoof', [0.3, 0.3]],
        ['thighR', 'hip', 'stifle', [0.11, 0.18], [0.08, 0.09], 'Coat', [0.2, 0.5], [0.11, 0.15]],
        ['gaskinR', 'stifle', 'hock', [0.065, 0.075], [0.045, 0.05], 'Coat', [0.5, 0.4]],
        ['hindCannonR', 'hock', 'hindFetlock', [0.04, 0.045], [0.035, 0.04], 'Coat', [0.4, 0.4]],
        ['hindPasternR', 'hindFetlock', 'hindCoronet', [0.045, 0.045], [0.05, 0.05], 'Sock', [0.4, 0.4]],
        ['hindHoofR', 'hindCoronet', 'hindHoof', [0.08, 0.05], [0.12, 0.03], 'Hoof', [0.3, 0.3]],
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
          { at: [0, 1.02, 1.36], r: [0.09, 0.11] }, { at: [0, 1.22, 1.52], r: [0.085, 0.10] }, { at: [0, 1.32, 1.84], r: [0.08, 0.095] },
        ], caps: { back: [0, 0.96, 1.32], tip: [0, 1.34, 1.90] } },
        // a short thin tail to the hock, a dark tuft at the end
        { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
          { at: [0, -0.84, 1.64], r: [0.04, 0.04] }, { at: [0, -0.93, 1.50], r: [0.035, 0.035] }, { at: [0, -0.96, 1.20], r: [0.03, 0.03] },
        ], caps: { back: [0, -0.80, 1.68], tip: [0, -0.965, 1.14] } },
        { name: 'tailHair', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
          { at: [0, -0.96, 1.18], r: [0.035, 0.04] }, { at: [0, -0.97, 1.04], r: [0.045, 0.05] }, { at: [0, -0.97, 0.94], r: [0.03, 0.035] },
        ], caps: { back: [0, -0.96, 1.22], tip: [0, -0.97, 0.90] } },
      ],
      craniumRows: H.rows(SKULL), craniumCaps: { back: H.pt([0, -0.16, -0.06]), tip: H.pt([0, 0.505, -0.045]) },
      jawRows: H.jaw(jaw), jawCaps: { back: H.pt([0, -0.10, -0.24]), tip: H.pt([0, 0.48, -0.10]) },
      nape: H.pt([0, -0.13, -0.02]),
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
  zebra: (() => {
    const BULK = 1.08, LEG = 1.35, J = family.joints;
    const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
    // the trunk's ring radius at y (linear between the family stations), times the bulk, a hair proud
    const T = family.torso, rAt = (y) => { for (let i = 1; i < T.length; i++) if (y <= T[i].at[1]) { const t = (y - T[i - 1].at[1]) / (T[i].at[1] - T[i - 1].at[1]); return T[i - 1].r.map((r, c) => (r + (T[i].r[c] - r) * t) * BULK * 1.05); } return T[T.length - 1].r; };
    const hoops = [-0.62, -0.48, -0.34, -0.20, -0.06, 0.08, 0.22, 0.36, 0.50].map((y, i) => ({ name: `stripe${i}`, kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane',
      stations: [{ at: [0, y - 0.022, 1.22], r: rAt(y - 0.022) }, { at: [0, y + 0.022, 1.22], r: rAt(y + 0.022) }], caps: { back: [0, y - 0.03, 1.22], tip: [0, y + 0.03, 1.22] } }));
    // leg bands: short segments on joints laid along each leg (mirrored by name)
    const bandJ = {}, bands = [];
    const legBand = (key, a, b, ts, r) => ts.forEach((t, i) => { const c = lerp(J[a], J[b], t), d = J[b].map((x, k) => (x - J[a][k]) * 0.025);
      bandJ[`${key}${i}AR`] = c.map((x, k) => x - d[k]); bandJ[`${key}${i}BR`] = c.map((x, k) => x + d[k]);
      bands.push({ name: `${key}${i}R`, kind: 'segment', from: `${key}${i}AR`, to: `${key}${i}BR`, rA: r(t), rB: r(t), slots: 'ring12', group: 'Mane', mirror: 'name', over: [0.05, 0.05] }); });
    legBand('foreArmBand', 'elbow', 'carpus', [0.3, 0.55, 0.8], (t) => (0.10 + (0.055 - 0.10) * t) * LEG * 1.12);
    legBand('foreCanBand', 'carpus', 'foreFetlock', [0.25, 0.6], () => 0.05 * LEG * 1.12);
    legBand('gaskinBand', 'stifle', 'hock', [0.35, 0.6, 0.85], (t) => (0.10 + (0.06 - 0.10) * t) * LEG * 1.12);
    legBand('hindCanBand', 'hock', 'hindFetlock', [0.25, 0.6], () => 0.055 * LEG * 1.12);
    // neck hoops: short midline segments along the neck chord
    const neckJ = {}, neckBands = [0.25, 0.45, 0.65, 0.85].map((t, i) => { const c = lerp(J.neckBase, J.neckTop, t), d = J.neckTop.map((x, k) => (x - J.neckBase[k]) * 0.02);
      neckJ[`neckBand${i}A`] = c.map((x, k) => x - d[k]); neckJ[`neckBand${i}B`] = c.map((x, k) => x + d[k]);
      const r = [0.17, 0.32].map((a, k) => (a + ([0.075, 0.10][k] - a) * t) * 1.1 * 1.08);
      return { name: `neckBand${i}`, kind: 'segment', from: `neckBand${i}A`, to: `neckBand${i}B`, rA: r, rB: r, slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.05, 0.05] }; });
    return {
      family: 'equine', name: 'a plains zebra', scale: 0.85, bulk: BULK, legBulk: LEG, headScale: 0.88,
      colors: { coat: '#e9e5dc', sock: '#e2ddd2', ash: '#dcd6ca', ashAlt: '#cfc8ba', mane: '#1b1817', snout: '#e9e5dc', tip: '#1b1817', hoof: '#26221f', brow: '#2a2523' },
      joints: { ...bandJ, ...neckJ },
      neckRA: [0.18, 0.33], neckRB: [0.085, 0.11], neckRMid: [0.13, 0.22],
      earR: [0.045, 0.048, 0.036, 0.014], earH: 1.15,
      // the dark muzzle: only the last skull band
      craniumBandGroups: { 'st5-st6': ['Brow', 'Brow', 'Brow', 'Brow', 'Brow', 'Palate'] },
      extraSegments: [
        // a thin tail to the hocks, a dark tuft at its end (no horse's long hair)
        { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
          { at: [0, -0.82, 1.44], r: [0.045, 0.045] }, { at: [0, -0.92, 1.36], r: [0.04, 0.04] }, { at: [0, -0.96, 1.05], r: [0.035, 0.035] },
        ], caps: { back: [0, -0.78, 1.46], tip: [0, -0.965, 1.00] } },
        { name: 'tailHair', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
          { at: [0, -0.96, 1.08], r: [0.04, 0.045] }, { at: [0, -0.97, 0.88], r: [0.065, 0.075] }, { at: [0, -0.97, 0.70], r: [0.04, 0.05] },
        ], caps: { back: [0, -0.96, 1.12], tip: [0, -0.97, 0.64] } },
        // the stiff upright mane: a taller, even crest standing straight up off the neck, withers to poll
        { name: 'mane', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
          { at: [0, 0.26, 1.64], r: [0.025, 0.05] }, { at: [0, 0.46, 1.82], r: [0.03, 0.075] },
          { at: [0, 0.64, 1.95], r: [0.03, 0.075] }, { at: [0, 0.80, 2.04], r: [0.025, 0.06] },
        ], caps: { back: [0, 0.18, 1.62], tip: [0, 0.88, 2.16] } },
        ...hoops, ...neckBands, ...bands,
      ],
    };
  })(),
};
