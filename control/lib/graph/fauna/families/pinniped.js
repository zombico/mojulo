// PINNIPED — seals, sea lions and the walrus, HAULED OUT on land: a long smooth SPINDLE trunk resting on its belly,
// tapering to a short neck and a round head, the fore limbs short FLIPPERS (flat paddles planted beside the chest),
// the hind limbs a pair of fan-shaped FLIPPERS trailing behind past a stub of a tail (a true seal), or turned forward
// under the body (a sea lion, a walrus, which walk on all four). A round skull with a short broad muzzle thick with
// whiskers, big dark eyes, no external ears on a true seal. Tables are authored in metres at harbour-seal size.
// Worked species: the harbour seal. See ../build.js for what every field does.

const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));
// skull rows [id, y, top, crown, brow, cheek, jowl, lip, palate]: a round domed braincase, broad cheeks, a short broad
// muzzle (packed rows st3–st6) with fat whisker pads
const SKULL = [
  ['st0', -0.15, 0.05, [0.035, 0.048], [0.07, 0.02], [0.078, -0.02], [0.065, -0.05], [0.042, -0.068], -0.074],
  ['st1', -0.09, 0.095, [0.035, 0.092], [0.085, 0.055], [0.1, -0.008], [0.088, -0.052], [0.058, -0.078], -0.084],
  ['st2', -0.02, 0.098, [0.04, 0.094], [0.088, 0.05], [0.105, -0.004], [0.09, -0.052], [0.06, -0.08], -0.086],
  ['st3', 0.04, 0.062, [0.025, 0.06], [0.06, 0.028], [0.075, -0.012], [0.07, -0.05], [0.05, -0.074], -0.078],
  ['st4', 0.09, 0.042, [0.022, 0.04], [0.05, 0.016], [0.062, -0.016], [0.06, -0.046], [0.044, -0.066], -0.07],
  ['st5', 0.13, 0.03, [0.02, 0.028], [0.042, 0.008], [0.05, -0.018], [0.048, -0.042], [0.036, -0.058], -0.062],
  ['st6', 0.16, 0.018, [0.014, 0.016], [0.03, 0.002], [0.036, -0.018], [0.034, -0.036], [0.026, -0.05], -0.054],
];
const JAW = [
  ['st0', -0.07, { gum: -0.078, gumR: [0.05, -0.078], jaw: [0.056, -0.1], bottom: -0.112 }],
  ['st1', 0.0, { gum: -0.078, gumR: [0.046, -0.078], jaw: [0.05, -0.098], bottom: -0.108 }],
  ['st2', 0.06, { gum: -0.068, gumR: [0.038, -0.068], jaw: [0.04, -0.086], bottom: -0.094 }],
  ['st3', 0.11, { gum: -0.06, gumR: [0.03, -0.06], jaw: [0.032, -0.076], bottom: -0.082 }],
  ['st4', 0.15, { gum: -0.054, gumR: [0.022, -0.054], jaw: [0.024, -0.066], bottom: -0.07 }],
];
// whiskers: thin stiff hairs fanning out from the muzzle's sides (mirrored), row positions [s, t] on the skull
const whiskers = (n = 5, len = 0.07) => Array.from({ length: n }, (_, i) => ({ kind: 'sweep', name: `whisker${i}`, at: [4.6 + 0.25 * (i % 3), 3.2 + 0.35 * i], space: 'local',
  spine: [[0, 0, -0.002], [0.004, -0.01, len * 0.5], [0.01, -0.025, len]], radii: [0.0018, 0.0012, 0.0005], m: 5, group: 'Whiskers' }));

export const family = {
  family: 'pinniped',
  colors: {
    coat: '#7d7a72', sock: '#6e6b64', ash: '#a9a59a', ashAlt: '#9c988e', brow: '#5e5b55', iris: '#1a1612',
    ink: '#0c0b0a', sclera: '#1a1612', nose: '#2a2624', teeth: '#e6e0d0', mouth: '#6a4a46', tip: '#5e5b55',
    hoof: '#4a4744', belly: '#b9b5aa', snout: '#8a877e',
  },
  joints: {
    neckBase: [0, 0.42, 0.22], neckTop: [0, 0.6, 0.28],
    // the fore flippers: short paddles off the low chest, planted forward and out on the ground
    shoulder: [0.13, 0.32, 0.11], elbow: [0.19, 0.34, 0.04], carpus: [0.23, 0.4, 0.012],
    // the hind flippers: trailing straight back past the tail, the soles together, fanned at the tips
    hip: [0.05, -0.56, 0.13], hock: [0.07, -0.72, 0.1], hindToe: [0.1, -0.88, 0.08],
  },
  // a long smooth spindle lying on its belly (the belly on z = 0), deepest at the chest
  torso: [
    { at: [0, -0.62, 0.13], r: [0.08, 0.075] },
    { at: [0, -0.45, 0.17], r: [0.15, 0.14] },
    { at: [0, -0.15, 0.2], r: [0.2, 0.19] },
    { at: [0, 0.12, 0.21], r: [0.21, 0.2] },
    { at: [0, 0.35, 0.2], r: [0.17, 0.17] },
    { at: [0, 0.48, 0.21], r: [0.12, 0.12] },
  ],
  torsoUp: true,
  torsoCaps: { back: [0, -0.68, 0.12], tip: [0, 0.56, 0.23] },
  neckRA: [0.12, 0.12], neckRB: [0.095, 0.1], neckRMid: [0.105, 0.11],
  tail: [[0, -0.6, 0.12, 0.03], [0, -0.68, 0.1, 0.022], [0, -0.72, 0.09, 0.012]], tip: null,
  legs: [
    ['foreFlipR', 'shoulder', 'elbow', [0.05, 0.03], [0.045, 0.02], 'Coat', [0.4, 0.2]],
    ['forePaddleR', 'elbow', 'carpus', [0.045, 0.014], [0.035, 0.008], 'Coat', [0.2, 0.4], null, { up: [0, 0, 1] }],
    ['hindFlipR', 'hip', 'hock', [0.045, 0.035], [0.04, 0.018], 'Coat', [0.4, 0.2], null, { up: [0, 0, 1] }],
    ['hindPaddleR', 'hock', 'hindToe', [0.04, 0.012], [0.07, 0.006], 'Coat', [0.2, 0.3], null, { up: [0, 0, 1] }],
  ],
  craniumRows: SKULL, craniumCaps: { back: [0, -0.18, 0.005], tip: [0, 0.172, -0.022] }, muzzleFrom: 3,
  jawRows: JAW, jawCaps: { back: [0, -0.1, -0.1], tip: [0, 0.16, -0.062] },
  muzzleW: 1.0, muzzleLen: 1.0,
  skinControls: {
    browRaise: { amp: 0.008, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    cheekBunch: { amp: 0.008, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
  },
  headScale: 1.05, nape: [0, -0.12, -0.02],
  // big dark eyes set forward on the face
  eyeAt: [2.4, 2.0], eyeR: 0.022, pupil: 'round', irisAngle: 40, orbitFallback: true,
  browStrip: [[1.95, 1.9], [2.2, 1.9], [2.5, 1.95], [2.8, 2.05], [3.05, 2.2]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.8, 1.2], noseAt: [5.75, 0.0001], noseR: [0.02, 0.014], webCranium: [1.7, 3.3, 4.97],
  // no external ears on a true seal
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: whiskers(),
  headTiles: [], bodyTiles: [],
  markDensity: { torso: 2 },
  markings: [{ on: 'torso', kind: 'belly', group: 'Belly', from: 0.72 }],
  scale: 1,
};

// an eared seal or a walrus PROPPED on its fore flippers: the chest raised, the head held up, the hind flippers turned
// forward under the rump (all four on the ground); `lift` is the chest's height, `len` the trunk's length scale, `bulk`
// the species' bulk (each station raised by what its fatter ring adds below, so the belly still rests on the ground)
const propped = ({ lift = 0.42, len = 1, bulk = 1 } = {}) => ({
  torso: [
    { at: [0, -0.62 * len, 0.13], r: [0.09, 0.085] },
    { at: [0, -0.45 * len, 0.17], r: [0.16, 0.15] },
    { at: [0, -0.18 * len, 0.22], r: [0.2, 0.19] },
    { at: [0, 0.08 * len, lift * 0.62], r: [0.2, 0.2] },
    { at: [0, 0.28 * len, lift * 0.85], r: [0.16, 0.17] },
    { at: [0, 0.4 * len, lift], r: [0.12, 0.125] },
  ].map((st) => ({ ...st, at: [0, st.at[1], st.at[2] + st.r[1] * (bulk - 1)] })),
  torsoCaps: { back: [0, -0.68 * len, 0.12], tip: [0, 0.47 * len, lift + 0.04] },
  joints: {
    neckBase: [0, 0.38 * len, lift + 0.02], neckTop: [0, 0.5 * len, lift + 0.2],
    // long fore flippers: straight down from the raised chest, the paddle splayed forward and out on the ground
    shoulder: [0.13, 0.2 * len, lift * 0.62], elbow: [0.18, 0.28 * len, lift * 0.25], carpus: [0.22, 0.42 * len, 0.022 + 0.03 * (bulk - 1)],
    // the hind flippers turned forward under the rump
    hip: [0.07, -0.52 * len, 0.12], hock: [0.11, -0.46 * len, 0.03], hindToe: [0.16, -0.3 * len, 0.022],
  },
  legs: [
    ['foreFlipR', 'shoulder', 'elbow', [0.07, 0.05], [0.06, 0.032], 'Coat', [0.4, 0.2]],
    ['forePaddleR', 'elbow', 'carpus', [0.075, 0.016], [0.06, 0.008], 'Sock', [0.2, 0.4], null, { up: [0, 0, 1] }],
    ['hindFlipR', 'hip', 'hock', [0.05, 0.035], [0.045, 0.016], 'Coat', [0.4, 0.2]],
    ['hindPaddleR', 'hock', 'hindToe', [0.045, 0.012], [0.07, 0.006], 'Sock', [0.2, 0.3], null, { up: [0, 0, 1] }],
  ],
  tail: null,
});

export const species = {
  // HARBOUR SEAL (Phoca vitulina). Thesis: a plump smooth SPINDLE lying on its belly, the head raised · a round head
  // like a dog's with no external ears, a short muzzle with V nostrils and stiff whiskers, big dark eyes · short fore
  // flippers by the chest, the hind flippers trailing back together · grey, darker along the back, a paler belly · ~1.6 m
  // long (NOAA Fisheries: 1.5–1.9 m; Teilmann & Galatius 2018, Encyclopedia of Marine Mammals).
  harborSeal: {
    family: 'pinniped', name: 'a harbour seal', scale: 1,
    colors: { coat: '#77746d', belly: '#c4c0b5' },
  },
  // CALIFORNIA SEA LION, adult male (Zalophus californianus). Thesis: a sleek dark-brown body PROPPED UP on long fore
  // flippers, the chest and head held high on a long neck · small rolled EXTERNAL EARS · a long pointed dog-like
  // muzzle with whiskers, a raised forehead crest on the bull · the hind flippers turned forward under the body ·
  // ~2.2 m long (NOAA Fisheries: males ~2.4 m, females ~1.8 m; Heath & Perrin 2009, Encyclopedia of Marine Mammals).
  seaLion: {
    family: 'pinniped', name: 'a California sea lion', scale: 1.41, ...propped({ lift: 0.42, len: 1.05 }),
    colors: { coat: '#5a4434', sock: '#3e2f25', ash: '#6e5544', ashAlt: '#634c3c', brow: '#3e2f25', belly: '#6e5544', snout: '#6e5544', nose: '#1e1714' },
    neckRA: [0.12, 0.13], neckRB: [0.075, 0.085], neckRMid: [0.09, 0.1],
    muzzleW: 0.85, muzzleLen: 1.35, headScale: 0.95,
    // the sagittal crest: the crown raised over the brow
    craniumRows: SKULL.map(([id, y, top, crown, ...rest]) => { const k = { st1: 0.012, st2: 0.018, st3: 0.01 }[id] || 0; return [id, y, top + k, [crown[0], crown[1] + k], ...rest]; }),
    // small rolled ears
    ears: true, earAt: [1.0, 2.2], earSpine: [[0, 0, -0.005], [0, -0.006, 0.012], [0, -0.012, 0.024]], earR: [0.01, 0.009, 0.004], earSquash: [1, 0.7], earH: 1,
    markings: [],
  },
  // WALRUS, adult bull (Odobenus rosmarus). Thesis: a HUGE wrinkled pinkish-brown bulk, broad shoulders, propped on
  // its fore flippers · a small head with a broad square MUZZLE packed with stiff whiskers · ONE signature: the two long
  // ivory TUSKS hanging straight down from the upper jaw · small eyes, no external ears · the hind flippers turned
  // under · ~3.0 m long, ~1.2 t (NOAA Fisheries: males 2.7–3.6 m; Kastelein 2009, Encyclopedia of Marine Mammals).
  walrus: {
    family: 'pinniped', name: 'a walrus', scale: 2.1, ...propped({ lift: 0.42, len: 1, bulk: 1.3 }),
    bulk: 1.3, legBulk: 1.2,
    colors: { coat: '#a07a62', sock: '#8a6550', ash: '#b08a72', ashAlt: '#a2806a', brow: '#7a5a46', belly: '#b08a72', snout: '#b8927a', horn: '#ece4cc', nose: '#6a4a3a' },
    neckRA: [0.16, 0.16], neckRB: [0.13, 0.13], neckRMid: [0.15, 0.15],
    muzzleW: 1.6, muzzleLen: 0.55, headScale: 1.05, eyeR: 0.012,
    headOrnaments: [...whiskers(6, 0.05),
      { kind: 'sweep', name: 'tusk', at: [5.2, 4.2], space: 'head', spine: [[0.03, 0.1, -0.03], [0.038, 0.13, -0.12], [0.04, 0.155, -0.2], [0.036, 0.18, -0.27]], radii: [0.016, 0.014, 0.01, 0.003], m: 8, group: 'Horn' }],
    markings: [],
  },
};

export const about = {
  harborSeal: { common: 'seal', aliases: ['harbor seal', 'harbour seal', 'common seal'], sci: 'Phoca vitulina', size: '~1.6 m long', source: 'NOAA Fisheries; Teilmann & Galatius 2018, Encyclopedia of Marine Mammals' },
  seaLion: { common: 'sea lion', aliases: ['california sea lion'], sci: 'Zalophus californianus', size: '~2.2 m long (adult male)', source: 'NOAA Fisheries; Heath & Perrin 2009, Encyclopedia of Marine Mammals' },
  walrus: { common: 'walrus', aliases: ['walruses'], sci: 'Odobenus rosmarus', size: '~3.0 m long (adult bull)', source: 'NOAA Fisheries; Kastelein 2009, Encyclopedia of Marine Mammals' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in.
export const wanted = {
  elephantSeal: { near: 'harborSeal', aliases: ['elephant seal'], note: 'a huge seal, the bull with a drooping trunk-like nose' },
};
