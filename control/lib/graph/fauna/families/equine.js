// EQUINE — a deep barrel on long slender legs ending in ONE hoof each (unguligrade), a long arched neck with a mane
// crest, a long wedge head carried nose-down, medium upright ears, a long hair tail from the dock. Worked species: the
// domestic riding horse. Authored at the horse's own size in metres (1 hand = 0.1016 m). See ../build.js for every field.

// the head is authored level (rows in metres, +y to the muzzle) and then sheared nose-down: every z drops by
// `slope` metres per metre of y, so the long face hangs from the poll as a horse carries it
const SLOPE = 0.9, DEPTH = 1.3;   // DEPTH: the face's depth before the shear (the shear thins it)
const dz = (y) => -SLOPE * y;
const sheared = (rows) => rows.map(([id, y, top, ...sides]) => {
  const palate = sides.pop();
  return [id, y, top * DEPTH + dz(y), ...sides.map(([x, z]) => [x, z * DEPTH + dz(y)]), palate * DEPTH + dz(y)];
});
const shearedJaw = (rows) => rows.map(([id, y, s]) => [id, y, {
  gum: s.gum * DEPTH + dz(y), gumR: [s.gumR[0], s.gumR[1] * DEPTH + dz(y)], jaw: [s.jaw[0], s.jaw[1] * DEPTH + dz(y)], bottom: s.bottom * DEPTH + dz(y),
}]);
const pt = ([x, y, z]) => [x, y, z * DEPTH + dz(y)];

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
  craniumRows: sheared([
    ['st0', -0.12, 0.06, [0.04, 0.055], [0.08, 0.02], [0.09, -0.06], [0.09, -0.16], [0.06, -0.20], -0.21],
    ['st1', -0.04, 0.08, [0.04, 0.075], [0.095, 0.035], [0.10, -0.05], [0.095, -0.15], [0.06, -0.20], -0.21],
    ['st2', 0.06, 0.07, [0.04, 0.065], [0.08, 0.03], [0.085, -0.04], [0.07, -0.12], [0.045, -0.16], -0.17],
    ['st3', 0.18, 0.05, [0.035, 0.045], [0.06, 0.015], [0.065, -0.04], [0.055, -0.09], [0.04, -0.12], -0.125],
    ['st4', 0.30, 0.035, [0.03, 0.03], [0.05, 0.0], [0.055, -0.04], [0.05, -0.08], [0.04, -0.105], -0.11],
    ['st5', 0.40, 0.03, [0.03, 0.025], [0.055, -0.005], [0.06, -0.04], [0.055, -0.075], [0.045, -0.095], -0.10],
    ['st6', 0.47, 0.02, [0.03, 0.015], [0.05, -0.01], [0.055, -0.04], [0.05, -0.07], [0.04, -0.09], -0.095],
  ]),
  craniumCaps: { back: pt([0, -0.16, -0.06]), tip: pt([0, 0.505, -0.045]) },
  muzzleFrom: 3,
  jawRows: shearedJaw([
    ['st0', -0.06, { gum: -0.20, gumR: [0.06, -0.20], jaw: [0.085, -0.29], bottom: -0.32 }],
    ['st1', 0.06, { gum: -0.165, gumR: [0.05, -0.165], jaw: [0.06, -0.23], bottom: -0.25 }],
    ['st2', 0.20, { gum: -0.12, gumR: [0.035, -0.12], jaw: [0.04, -0.17], bottom: -0.18 }],
    ['st3', 0.34, { gum: -0.10, gumR: [0.03, -0.10], jaw: [0.035, -0.15], bottom: -0.16 }],
    ['st4', 0.46, { gum: -0.088, gumR: [0.03, -0.088], jaw: [0.035, -0.14], bottom: -0.15 }],
  ]),
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
};
