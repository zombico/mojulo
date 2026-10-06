// MUSTELID — a long, low, sinuous trunk of near-even depth on SHORT legs, plantigrade-ish feet (webbed in the otters:
// wide flat paddles), a small FLAT head on a thick neck nearly as wide as the head, a blunt broad muzzle, small low
// ears, and a long thick tail tapering from a wide base and flattened top to bottom (an extra loft with [x, z] rings).
// Tables are authored in metres at river-otter size. Worked species: the North American river otter. See ../build.js.

// skull rows (a generic carnivore skull, the canine's) flattened top to bottom and widened: [id, y, top, crown, brow,
// cheek, jowl, lip, palate]
const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
const SKULL = [
  ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
  ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
  ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
  ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
  ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
  ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
  ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
];
const JAW = [
  ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
  ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
  ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
  ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
  ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
];
const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));

export const family = {
  family: 'mustelid',
  colors: {
    coat: '#5a4030', sock: '#47331f', ash: '#a88e72', ashAlt: '#98805f', brow: '#3a2a1e', iris: '#1a120c',
    ink: '#0f0b08', sclera: '#1a120c', nose: '#1b1512', teeth: '#ece6d6', mouth: '#4e3430', tip: '#4a3426', belly: '#8a7058',
  },
  joints: {
    neckBase: [0, 0.22, 0.152], neckTop: [0, 0.34, 0.18],
    shoulder: [0.065, 0.17, 0.12], elbow: [0.072, 0.14, 0.07], carpus: [0.072, 0.185, 0.026], forePaw: [0.072, 0.195, 0.024], foreToe: [0.076, 0.245, 0.007],
    hip: [0.06, -0.26, 0.13], stifle: [0.078, -0.19, 0.08], hock: [0.072, -0.29, 0.032], hindPaw: [0.072, -0.275, 0.024], hindToe: [0.078, -0.17, 0.007],
  },
  torso: [
    { at: [0, -0.36, 0.15], r: [0.07, 0.06] },
    { at: [0, -0.28, 0.15], r: [0.10, 0.085] },
    { at: [0, -0.15, 0.15], r: [0.105, 0.09] },
    { at: [0, 0.0, 0.15], r: [0.10, 0.088] },
    { at: [0, 0.13, 0.15], r: [0.09, 0.082] },
    { at: [0, 0.24, 0.15], r: [0.072, 0.07] },
  ],
  torsoCaps: { back: [0, -0.40, 0.15], tip: [0, 0.29, 0.155] },
  neckRA: [0.078, 0.075], neckRB: [0.062, 0.056], neckRMid: [0.07, 0.066],
  // the flat tapering tail is an extra loft (below): the builder's round tail is off
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.035, 0.045], [0.025, 0.027], 'Coat', [0.6, 0.5], [0.03, 0.036]],
    ['foreArmR', 'elbow', 'carpus', [0.024, 0.025], [0.018, 0.018], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.017, 0.016, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.034, 0.009], [0.046, 0.007], 'Sock', [0.3, 0.2]],
    ['thighR', 'hip', 'stifle', [0.05, 0.065], [0.03, 0.033], 'Coat', [0.2, 0.5], [0.045, 0.055]],
    ['shinR', 'stifle', 'hock', [0.028, 0.03], [0.019, 0.02], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.018, 0.017, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.04, 0.009], [0.056, 0.007], 'Sock', [0.3, 0.2]],
  ],
  craniumRows: flat(SKULL, 1.2, 0.82),
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.014] },
  muzzleFrom: 3,
  jawRows: flatJaw(JAW, 1.2, 0.82),
  jawCaps: { back: [0, -0.1, -0.066], tip: [0, 0.21, -0.04] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.42, nape: [0, -0.1, -0.035],
  // headRelative: the eye, orbit, ears and nose pad are authored at a reference head (headScale 1) and scale with it
  headRelative: true,
  eyeAt: [2.2, 2.2], eyeR: 0.022, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.026, 0.021], webCranium: [1.7, 3.3, 4.97],
  // small low rounded ears set wide on the flat crown
  earAt: [1.3, 1.8], earSpine: [[0, 0, -0.014], [0, 0, 0.01], [0, 0, 0.029], [0, 0, 0.045], [0, 0, 0.057]],
  earR: [0.04, 0.038, 0.026, 0.012], earSquash: [1, 0.45], earH: 1,
  muzzleW: 1.35, muzzleLen: 0.55,
  headTiles: [], bodyTiles: [],
  tailStations: [[-0.33, 0.155, [0.09, 0.075]], [-0.43, 0.13, [0.086, 0.06]], [-0.54, 0.10, [0.068, 0.042]], [-0.64, 0.077, [0.048, 0.028]], [-0.72, 0.062, [0.034, 0.019]], [-0.77, 0.055, [0.02, 0.012]]],
  legBulk: 1.2,
  // the webbed paddles lie flat (a stable +z ring frame on every near-level leg segment)
  levelLegs: true,
  scale: 1,
};
family.extraSegments = [
  { name: 'tailFlat', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: loftOf(family.tailStations), caps: { back: [0, -0.30, 0.155], tip: [0, -0.80, 0.05] } },
];

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // NORTH AMERICAN RIVER OTTER (Lontra canadensis). Thesis: a long low sinuous body of even depth on short legs ·
  // wide WEBBED plantigrade paddle feet · a small flat broad head on a thick neck, blunt muzzle, tiny ears · the
  // thick tail tapering from a broad flattened base (~40% of total length) · dark brown, paler throat · 0.25 m at the
  // shoulder (ADW / Smithsonian: total length 0.89–1.30 m, tail 0.30–0.50 m, 5–14 kg; shoulder ~0.25 m).
  riverOtter: {
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
    family: 'mustelid', name: 'a North American river otter', scale: 1,
  },
};
