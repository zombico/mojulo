// CROCODILIAN — a very low, long, slightly flattened trunk slung between SPRAWLING legs (upper arm and thigh held
// out sideways, elbow and knee out past the body, the feet planted wide and flat), a long flat wedge head with the
// eyes and nostrils on top and a row of teeth along the lip line, no external ears, rows of armoured dorsal scutes
// (a saw-tooth crest down the back that doubles into the tail's crest), and a massive LATERALLY FLATTENED tail as
// long as the body. Tables are authored in metres at Nile crocodile size. Worked species: the Nile crocodile.

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
// the teeth: small down-pointing cones along the lip line, row positions along the skull (mirrored to both sides)
const teeth = (rows, slot, len) => rows.map((r, i) => ({ kind: 'sweep', name: `tooth${i}`, at: [r, slot], space: 'local', spine: [[0, 0, -0.004], [0, 0, len * (i % 2 ? 0.7 : 1)]], radii: [0.006, 0.0015], m: 6, group: 'Teeth' }));
// the dorsal scute crest: a saw-tooth midline loft, high and low stations alternating along a back line
const crest = (pts, hi, lo) => pts.flatMap(([y, z, w], i, a) => (i === a.length - 1 ? [[y, z + hi * w, [0.02 * w, 0.02]]] : [[y, z + hi * w, [0.03 * w, 0.03]], [(y + a[i + 1][0]) / 2, (z + a[i + 1][1]) / 2 + lo * w, [0.05 * w, 0.02]]]));

export const family = {
  family: 'crocodilian',
  colors: {
    coat: '#545c3c', sock: '#4a5134', ash: '#a9a372', ashAlt: '#99935f', brow: '#3b4128', iris: '#b89a34',
    ink: '#0f100a', sclera: '#2b2a16', nose: '#2e3122', teeth: '#e9e4d0', mouth: '#9b7a62', tip: '#3b4128',
    hoof: '#33382a', belly: '#c4bb88',
  },
  joints: {
    neckBase: [0, 0.62, 0.27], neckTop: [0, 0.86, 0.27],
    // sprawling: the elbow and the knee out past the body, the feet set wide and flat
    shoulder: [0.20, 0.48, 0.24], elbow: [0.52, 0.42, 0.20], carpus: [0.54, 0.50, 0.05], forePaw: [0.54, 0.52, 0.025], foreToe: [0.60, 0.66, 0.012],
    hip: [0.20, -0.52, 0.25], stifle: [0.56, -0.44, 0.22], hock: [0.58, -0.62, 0.06], hindPaw: [0.58, -0.60, 0.025], hindToe: [0.64, -0.40, 0.012],
  },
  torso: [
    { at: [0, -0.78, 0.27], r: [0.22, 0.15] },
    { at: [0, -0.50, 0.27], r: [0.32, 0.18] },
    { at: [0, -0.10, 0.27], r: [0.36, 0.19] },
    { at: [0, 0.30, 0.27], r: [0.32, 0.18] },
    { at: [0, 0.60, 0.27], r: [0.22, 0.14] },
  ],
  torsoCaps: { back: [0, -0.86, 0.27], tip: [0, 0.72, 0.27] },
  neckRA: [0.19, 0.13], neckRB: [0.13, 0.09], neckRMid: [0.16, 0.11],
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.075, 0.07], [0.055, 0.05], 'Coat', [0.5, 0.4]],
    ['foreArmR', 'elbow', 'carpus', [0.055, 0.05], [0.04, 0.04], 'Coat', [0.4, 0.3]],
    ['pasternR', 'carpus', 'forePaw', 0.04, 0.038, 'Sock', [0.3, 0.3]],
    ['forePawR', 'forePaw', 'foreToe', [0.06, 0.018], [0.075, 0.01], 'Hoof', [0.3, 0.2]],
    ['thighR', 'hip', 'stifle', [0.11, 0.11], [0.07, 0.065], 'Coat', [0.4, 0.4]],
    ['shinR', 'stifle', 'hock', [0.065, 0.06], [0.045, 0.045], 'Coat', [0.4, 0.3]],
    ['metaR', 'hock', 'hindPaw', 0.045, 0.042, 'Sock', [0.3, 0.3]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.065, 0.02], [0.085, 0.01], 'Hoof', [0.3, 0.2]],
  ],
  levelLegs: true,
  // the skull: the canine rows flattened top to bottom and widened, the snout drawn out long (muzzleLen)
  craniumRows: flat(SKULL, 1.6, 0.75),
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.012] },
  muzzleFrom: 3,
  jawRows: flatJaw(JAW, 1.6, 0.75),
  jawCaps: { back: [0, -0.1, -0.045], tip: [0, 0.21, -0.028] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.0, nape: [0, -0.1, -0.02],
  // the eyes high on the skull roof, the nostrils on top of the snout tip, no nose pad, no external ears
  eyeAt: [1.9, 1.3], eyeR: 0.012, orbit: { reach: [0.004, 0.005, 0.006], bulk: [0.001, 0.002], thickness: 0.002 }, pupil: 'round', irisAngle: 40,
  browStrip: [[1.6, 1.3], [1.9, 1.2], [2.2, 1.2], [2.5, 1.3], [2.8, 1.4]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 0.6], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  muzzleW: 1.7, muzzleLen: 2.4,
  headOrnaments: teeth([3.3, 3.8, 4.3, 4.8, 5.3, 5.75], 5.0, 0.02),
  headTiles: [], bodyTiles: [],
  // the tail: a massive, laterally FLATTENED loft [y, z, [half-width, half-height]] as long as the body, on stable rings
  tailStations: [[-0.80, 0.27, [0.21, 0.15]], [-1.20, 0.25, [0.14, 0.18]], [-1.65, 0.21, [0.09, 0.17]], [-2.10, 0.16, [0.06, 0.13]], [-2.50, 0.11, [0.04, 0.08]], [-2.80, 0.08, [0.02, 0.05]]],
  tailCaps: { back: [0, -0.70, 0.27], tip: [0, -2.95, 0.07] },
  // the scute crest back line [y, z of the back surface, weight] from the nape down the tail
  crestLine: [[0.60, 0.40, 0.6], [0.30, 0.45, 0.8], [-0.10, 0.46, 0.8], [-0.50, 0.45, 0.9], [-0.80, 0.42, 1.1], [-1.20, 0.39, 1.4], [-1.65, 0.32, 1.4], [-2.10, 0.26, 1.2], [-2.50, 0.19, 1.0], [-2.80, 0.13, 0.7]],
  scale: 1,
};
family.extraSegments = [
  { name: 'tailFlat', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(family.tailStations), caps: family.tailCaps },
  { name: 'scuteCrest', kind: 'loft', slots: 'ring12', group: 'Hoof', mirror: 'plane', up: true, stations: loftOf(crest(family.crestLine, 0.04, 0.0)), caps: { back: [0, 0.66, 0.41], tip: [0, -2.9, 0.12] } },
];

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // NILE CROCODILE (Crocodylus niloticus). Thesis: a VERY low, long body slung between SPRAWLING legs, flat clawed
  // feet set wide · a long flat wedge snout with the eyes and nostrils on top and a ragged row of teeth along the lip
  // · no ears · a saw-tooth crest of armoured dorsal SCUTES · a massive laterally FLATTENED tail as long as head+body
  // · olive above, pale below · ~4 m total, ~0.45 m to the top of the back in a high walk (Britannica / IUCN CSG:
  // adults 3.5–5 m, up to ~6 m; tail ~half the total length).
  crocodile: {
    // kept v4 (blind judges: A v4 over v3 55%; B v4 over v1 90%)
    family: 'crocodilian', name: 'a Nile crocodile', scale: 1, legBulk: 1.3,
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  crocodile: { common: 'crocodile', aliases: ['croc', 'nile crocodile'], sci: 'Crocodylus niloticus', size: '~4 m total; ~0.45 m to the top of the back', source: 'Britannica / IUCN Crocodile Specialist Group' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  alligator: { near: 'crocodile', aliases: ['gator', 'caiman'], note: 'a broad rounded U snout, darker, the lower teeth hidden' },
};
