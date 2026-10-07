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
  },  // EUROPEAN BADGER (Meles meles). Thesis: a heavy, low, WIDE wedge of a body (broad and flat-backed, the head the
  // narrow point of the wedge) on short thick legs with long fore claws · ONE signature: the WHITE FACE with a BLACK
  // STRIPE from the nose back over each eye to the ear, white cheeks, a black chin and throat · grizzled grey back,
  // black legs and belly, a short pale tail · a long tapering pig-like snout, small white-edged ears · published:
  // head-body 0.56–0.90 m, tail 0.12–0.20 m, ~0.30 m at the shoulder, 7–17 kg (Animal Diversity Web, Meles meles).
  badger: {
    eyeStyle: 'set',
    family: 'mustelid', name: 'a European badger', scale: 0.9,
    colors: { coat: '#8f8a83', sock: '#1d1b1a', ash: '#f0ece4', ashAlt: '#e2ddd4', ears: '#1d1b1a', brow: '#1d1b1a', belly: '#262322',
      snout: '#f0ece4', lids: '#1d1b1a', tip: '#b8b2a8', nose: '#151312', mouth: '#2a2422', iris: '#120e0c', sclera: '#120e0c', horn: '#d6ccb6' },
    // the skunk's build, stouter (operator, 2026-10-06: "a more stout skunk with a shorter tail"): its legs, its back
    // arched over the hips, the trunk a third wider and the legs thicker, so it reads broad and low from the front
    legScale: 1.15, legBulk: 1.5,
    torso: [
      { at: [0, -0.36, 0.17], r: [0.11, 0.08] },
      { at: [0, -0.28, 0.17], r: [0.17, 0.13] },
      { at: [0, -0.15, 0.17], r: [0.175, 0.13] },
      { at: [0, 0.0, 0.17], r: [0.155, 0.108] },
      { at: [0, 0.13, 0.17], r: [0.125, 0.09] },
      { at: [0, 0.24, 0.17], r: [0.09, 0.072] },
    ],
    torsoCaps: { back: [0, -0.40, 0.17], tip: [0, 0.29, 0.17] },
    neckRA: [0.09, 0.08], neckRB: [0.068, 0.06], neckRMid: [0.078, 0.07],
    // the head: a long tapering snout, narrower than the otter's broad flat muzzle
    headScale: 0.53, muzzleW: 1.0, muzzleLen: 0.7,
    earR: [0.034, 0.032, 0.022, 0.01], earH: 0.8,
    // the face stripes on the skull bands, slot bands top→crown, crown→brow, brow→cheek, cheek→jowl, jowl→lip, lip→palate:
    // a white centre stripe (top→crown, and crown→brow on the narrow snout so it runs on down to the nose), a BROAD
    // black stripe over each eye, white cheeks, a black chin and throat (the jaw)
    craniumBandGroups: Object.fromEntries(['st0-st1', 'st1-st2', 'st2-st3', 'st3-st4', 'st4-st5', 'st5-st6'].map((b, i) => [b, ['FaceW', i < 3 ? 'FaceB' : 'FaceW', 'FaceB', 'FaceW', 'FaceW', 'Palate']])),
    headPalette: { FaceW: '#f0ece4', FaceB: '#1d1b1a', SkullBack: '#8f8a83', Jaw: '#1d1b1a', Jowl: '#1d1b1a', EarInner: '#f0ece4' },
    extraSegments: [
      // a SHORT tail (0.12–0.20 m), thick at the root, carried level, pale grey
      { name: 'tailShort', kind: 'loft', slots: 'ring12', group: 'Tip', mirror: 'plane', stations: loftOf([[-0.38, 0.20, [0.055, 0.045]], [-0.44, 0.19, [0.048, 0.038]], [-0.50, 0.175, [0.034, 0.026]], [-0.54, 0.16, [0.018, 0.014]]]),
        caps: { back: [0, -0.36, 0.205], tip: [0, -0.56, 0.155] } },
      // the digger's LONG FORE CLAWS: three pale claws reaching forward from each fore paw (authored 0.019 low: the
      // leg scale raises every extra loft with the trunk)
      ...[0.062, 0.076, 0.09].map((x, i) => ({ name: `foreClaw${i}R`, kind: 'loft', slots: 'ring12', group: 'Horn', mirror: 'name', up: true,
        stations: [{ at: [x, 0.235, -0.011], r: [0.007, 0.006] }, { at: [x, 0.265, -0.012], r: [0.006, 0.005] }, { at: [x, 0.285, -0.016], r: [0.004, 0.0035] }],
        caps: { back: [x, 0.228, -0.01], tip: [x, 0.295, -0.018] } })),
    ],
    // a black belly and legs, the grey back paler along the spine (the grizzle)
    markings: [{ on: 'torso', kind: 'belly', from: 0.6, group: 'Belly' }, { on: 'legs', kind: 'band', group: 'Belly' },
      { on: 'neck', kind: 'belly', from: 0.55, group: 'Belly' },
      { on: 'torso', kind: 'band', run: [0.1, 0.9], t: [0, 0.2], group: 'Grizzle', color: '#aaa59d' }],
  },
  // STRIPED SKUNK (Mephitis mephitis) — a mephitid, filed with the mustelids (long its traditional family). Thesis:
  // a small stocky body, the back ARCHED high over the hips, on short legs · a small head with a pointed snout and
  // tiny ears · glossy BLACK all over with a thin WHITE BLAZE up the forehead, a white cap on the nape splitting into
  // TWO WHITE STRIPES down the back · ONE signature: the HUGE PLUMED TAIL, as long as the body, raised up over the
  // rump, black streaked white · published: total length 0.575–0.80 m, tail 0.175–0.40 m, 1.2–5.3 kg (Animal
  // Diversity Web, Mephitis mephitis).
  skunk: {
    eyeStyle: 'set',
    family: 'mustelid', name: 'a striped skunk', scale: 0.44,
    colors: { coat: '#141212', sock: '#0e0d0d', ash: '#1c1a1a', ashAlt: '#242121', brow: '#0e0d0d', belly: '#141212', ears: '#141212',
      snout: '#141212', mane: '#f2f0ea', tip: '#f2f0ea', nose: '#0a0909', mouth: '#2a2222', iris: '#0a0909', sclera: '#0a0909' },
    legScale: 1.15,
    // the arch: deep and high over the hips, falling to a narrow chest
    torso: [
      { at: [0, -0.36, 0.17], r: [0.08, 0.08] },
      { at: [0, -0.28, 0.17], r: [0.125, 0.135] },
      { at: [0, -0.15, 0.17], r: [0.13, 0.135] },
      { at: [0, 0.0, 0.17], r: [0.115, 0.11] },
      { at: [0, 0.13, 0.17], r: [0.095, 0.09] },
      { at: [0, 0.24, 0.17], r: [0.072, 0.07] },
    ],
    torsoCaps: { back: [0, -0.40, 0.17], tip: [0, 0.29, 0.17] },
    neckRA: [0.07, 0.068], neckRB: [0.055, 0.05], neckRMid: [0.062, 0.06],
    // a small head, the snout pointed (narrower and longer than the otter's)
    headScale: 0.46, muzzleW: 0.85, muzzleLen: 0.85,
    earR: [0.032, 0.03, 0.02, 0.01], earH: 0.7,
    // the white blaze: the midline band of the skull, forehead to the nose
    craniumBandGroups: { ...Object.fromEntries(['st0-st1', 'st1-st2', 'st2-st3'].map((b) => [b, ['Mane', 'Mane', 'Skull', 'Cheek', 'Jowl', 'Palate']])),
      ...Object.fromEntries(['st3-st4', 'st4-st5'].map((b) => [b, ['Mane', 'Skull', 'Skull', 'Cheek', 'Jowl', 'Palate']])) },
    extraSegments: [
      // the plume: out of the rump, up and back, then arching forward over the rump, wide and bushy
      { name: 'tailPlume', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane',
        stations: loftOf([[-0.38, 0.20, 0.06], [-0.50, 0.30, 0.13], [-0.58, 0.46, 0.17], [-0.58, 0.64, 0.19], [-0.50, 0.80, 0.17], [-0.40, 0.88, 0.12]]),
        bandGroups: { 'st1-st2': ['Mane', 'Coat', 'Coat', 'Coat', 'Coat', 'Mane'], 'st2-st3': ['Mane', 'Mane', 'Coat', 'Coat', 'Mane', 'Coat'], 'st3-st4': ['Coat', 'Mane', 'Coat', 'Mane', 'Coat', 'Coat'], 'st4-st5': ['Mane', 'Coat', 'Mane', 'Coat', 'Coat', 'Mane'] },
        caps: { back: [0, -0.35, 0.18], tip: [0, -0.33, 0.90] }, capGroups: { back: 'Coat', tip: 'Mane' } },
    ],
    // the white: a cap over the shoulders and nape, two stripes down the back to the rump
    markings: [
      { on: 'torso', kind: 'band', run: [0.72, 1], t: [0, 0.3], group: 'Mane' },
      { on: 'torso', kind: 'band', run: [0.05, 0.72], t: [0.12, 0.34], group: 'Mane' },
      { on: 'neck', kind: 'band', t: [0.62, 1], group: 'Mane' },
    ],
  },  // MEERKAT (Suricata suricatta) — a mongoose (Herpestidae), NOT a mustelid: the roster files it here for its long low
  // carnivore build and small flat-topped head. Built in its signature SENTINEL pose. Thesis: sitting bolt UPRIGHT on
  // its haunches, the slim trunk near vertical (an inclined trunk segment between `pelvis` and `chest`, as the
  // macropod's, since the builder lofts `torso` level only; `torso` is a small loft hidden in the chest top) · the
  // forepaws hanging limp in front of the chest · the THIN TAPERING TAIL lying on the ground behind as a prop, dark at
  // the tip · a small head with a pointed snout, DARK EYE PATCHES, small dark crescent ears set low · sandy grey-tan,
  // faint dark bands across the back, a pale belly · published: head-body 0.245–0.29 m, tail 0.175–0.25 m, ~0.73 kg
  // (Animal Diversity Web, Suricata suricatta). Authored in metres at scale 1.
  meerkat: {
    eyeStyle: 'set',
    family: 'mustelid', name: 'a meerkat', scale: 1,
    colors: { coat: '#b39a78', sock: '#9c8466', ash: '#d9c8aa', ashAlt: '#cbb898', brow: '#2a211a', belly: '#e0d2b6', ears: '#2a211a',
      snout: '#b39a78', mane: '#8a7458', tip: '#2a211a', nose: '#1a1410', mouth: '#3a2c22', iris: '#1a120c', sclera: '#1a120c' },
    joints: {
      pelvis: [0, -0.035, 0.085], chest: [0, 0.005, 0.255],
      neckBase: [0, 0.005, 0.25], neckTop: [0, 0.022, 0.295],
      shoulder: [0.032, 0.012, 0.235], elbow: [0.04, 0.045, 0.19], carpus: [0.034, 0.065, 0.165], forePaw: [0.03, 0.07, 0.152], foreToe: [0.028, 0.078, 0.138],
      hip: [0.04, -0.03, 0.085], stifle: [0.048, 0.035, 0.06], hock: [0.042, -0.035, 0.022], hindPaw: [0.042, -0.025, 0.012], hindToe: [0.042, 0.035, 0.006],
    },
    // a small level loft inside the chest top: the builder's trunk, kept only to carry the withers for the fit
    torso: [{ at: [0, -0.01, 0.235], r: [0.03, 0.03] }, { at: [0, 0.01, 0.235], r: [0.03, 0.03] }],
    torsoCaps: { back: [0, -0.025, 0.235], tip: [0, 0.025, 0.235] },
    neckRA: [0.028, 0.027], neckRB: [0.02, 0.019], neckRMid: [0.023, 0.022],
    legBulk: 1,
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.014, 0.016], [0.009, 0.01], 'Coat', [0.6, 0.5]],
      ['foreArmR', 'elbow', 'carpus', [0.009, 0.01], [0.007, 0.007], 'Coat', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.007, 0.006, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.008, 0.005], [0.007, 0.003], 'Tip', [0.5, 0.4]],
      ['thighR', 'hip', 'stifle', [0.03, 0.036], [0.016, 0.018], 'Coat', [0.3, 0.5], [0.026, 0.03]],
      ['shinR', 'stifle', 'hock', [0.013, 0.014], [0.008, 0.009], 'Coat', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.008, 0.008, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.012, 0.005], [0.01, 0.004], 'Sock', [0.4, 0.3]],
    ],
    // a small head, the snout narrow and pointed, the eyes big, dark patches round them (the brow→cheek band)
    headScale: 0.2, muzzleW: 0.85, muzzleLen: 0.95, headPitch: -6,
    eyeR: 0.03, eyeAt: [2.2, 2.3],
    earAt: [1.2, 2.5], earR: [0.04, 0.038, 0.026, 0.012], earH: 0.7,
    craniumBandGroups: Object.fromEntries(['st1-st2', 'st2-st3', 'st3-st4'].map((b) => [b, ['Skull', 'Skull', 'Mask', 'Cheek', 'Jowl', 'Palate']])),
    headPalette: { Mask: '#2a211a', Lids: '#2a211a', Cheek: '#d9c8aa', Jowl: '#d9c8aa', Jaw: '#d9c8aa' },
    extraSegments: [
      // the trunk: slim, near vertical, the haunches the widest
      { name: 'trunk', kind: 'segment', from: 'pelvis', to: 'chest', rA: [0.05, 0.048], rB: [0.034, 0.034], rMid: [0.046, 0.044], slots: 'ring12', over: [0.6, 0.5], group: 'Coat', mirror: 'plane' },
      // the tail: from the base of the spine down to the ground and out behind, thin, tapering, a dark tip
      { name: 'tailProp', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true,
        stations: loftOf([[-0.065, 0.06, 0.016], [-0.10, 0.025, 0.013], [-0.16, 0.012, 0.011], [-0.24, 0.011, 0.009], [-0.30, 0.012, 0.007], [-0.34, 0.013, 0.005]]),
        bandGroups: { 'st4-st5': Array(6).fill('Tip') }, caps: { back: [0, -0.05, 0.07], tip: [0, -0.355, 0.013] }, capGroups: { back: 'Coat', tip: 'Tip' } },
    ],
    markings: [
      // the pale belly down the front of the trunk; faint dark bands across the back
      { on: 'trunk', kind: 'band', t: [0, 0.4], group: 'Belly' },
      { on: 'trunk', kind: 'stripes', count: 5, width: 0.35, t: [0.7, 1], group: 'Mane' },
    ],
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  riverOtter: { common: 'otter', aliases: ['river otter'], sci: 'Lontra canadensis', size: '0.25 m at the shoulder; total 0.89–1.30 m', source: 'ADW / Smithsonian' },
  badger: { common: 'badger', aliases: ['european badger'], sci: 'Meles meles', size: '~0.30 m at the shoulder; head-body 0.56–0.90 m', source: 'ADW, Meles meles' },
  skunk: { common: 'skunk', aliases: ['striped skunk'], sci: 'Mephitis mephitis', size: 'total length 0.575–0.80 m, tail 0.175–0.40 m', source: 'ADW, Mephitis mephitis' },
  meerkat: { common: 'meerkat', aliases: ['suricate'], sci: 'Suricata suricatta', size: 'head-body 0.245–0.29 m, tail 0.175–0.25 m', source: 'ADW, Suricata suricatta' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
};
