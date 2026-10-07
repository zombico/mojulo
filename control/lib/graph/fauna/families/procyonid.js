// PROCYONID — a plump trunk with the rump carried above the shoulders (hind legs longer than the forelegs), short
// plantigrade legs with hand-like fore paws and long flat hind soles, a broad head with a short pointed muzzle and
// rounded ears, a bushy tail banded in dark RINGS (the tail is an extra loft with per-band groups: light 'Mane',
// dark 'Tip'). Tables are authored in metres at raccoon size. Worked species: the common raccoon. See ../build.js.
import RACCOON_WIRE from '../heads/raccoon-wire.js';


const band = (n, light = 'Mane', dark = 'Tip') => Object.fromEntries(Array.from({ length: n }, (_, i) => [`st${i}-st${i + 1}`, Array(6).fill(i % 2 ? dark : light)]));

export const family = {
  family: 'procyonid',
  colors: {
    coat: '#8b857c', sock: '#5d5750', ash: '#e9e5dc', ashAlt: '#d6d0c4', brow: '#1d1a17', iris: '#2a1d12',
    ink: '#0f0d0b', sclera: '#1a140f', nose: '#141110', teeth: '#ece6d6', mouth: '#d6d0c4', tip: '#24201c',
    mane: '#b3aa9a', snout: '#e9e5dc', ears: '#8b857c',
  },
  joints: {
    neckBase: [0, 0.13, 0.185], neckTop: [0, 0.205, 0.205],
    shoulder: [0.06, 0.11, 0.19], elbow: [0.065, 0.085, 0.115], carpus: [0.06, 0.115, 0.035], forePaw: [0.06, 0.12, 0.012], foreToe: [0.062, 0.17, 0.008],
    hip: [0.055, -0.17, 0.24], stifle: [0.07, -0.095, 0.15], hock: [0.065, -0.185, 0.04], hindPaw: [0.065, -0.17, 0.012], hindToe: [0.065, -0.075, 0.008],
  },
  torso: [
    { at: [0, -0.27, 0.205], r: [0.06, 0.06] },
    { at: [0, -0.21, 0.205], r: [0.10, 0.125] },
    { at: [0, -0.13, 0.205], r: [0.118, 0.135] },
    { at: [0, -0.03, 0.205], r: [0.112, 0.092] },
    { at: [0, 0.07, 0.205], r: [0.09, 0.066] },
    { at: [0, 0.15, 0.205], r: [0.064, 0.056] },
  ],
  torsoCaps: { back: [0, -0.31, 0.21], tip: [0, 0.19, 0.205] },
  neckRA: [0.068, 0.072], neckRB: [0.05, 0.05], neckRMid: [0.058, 0.06],
  // the ringed tail: an extra loft (below), so the builder's own one-group tail is off
  tail: null, tip: null,
  tailStations: [[0, -0.25, 0.25, 0.03], [0, -0.30, 0.245, 0.045], [0, -0.35, 0.23, 0.052], [0, -0.40, 0.205, 0.054], [0, -0.445, 0.175, 0.05], [0, -0.48, 0.145, 0.044], [0, -0.505, 0.115, 0.034], [0, -0.52, 0.09, 0.024]],
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.04, 0.055], [0.028, 0.03], 'Coat', [0.6, 0.5], [0.035, 0.042]],
    ['foreArmR', 'elbow', 'carpus', [0.027, 0.029], [0.019, 0.02], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.019, 0.018, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.026, 0.012], [0.034, 0.008], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.06, 0.08], [0.033, 0.036], 'Coat', [0.2, 0.5], [0.05, 0.062]],
    ['shinR', 'stifle', 'hock', [0.032, 0.036], [0.02, 0.022], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.02, 0.018, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.024, 0.013], [0.027, 0.008], 'Sock', [0.5, 0.4]],
  ],
  // skull rows FITTED to the raccoon head-wire mesh (docs/examples/raccoon-head-wire; fit by the 1005 spike's
  // fit-head.mjs): the braincase widening into flared cheek ruffs (st1–st4), a near-flat face plane (st5–st6) and a
  // short muzzle (st7–st8). The jaw is tucked inside the muzzle: the mesh's mouth is a line, not a part.
  craniumRows: [
    ['st0', -0.15, 0.0489, [0.0316,  0.0442], [0.0709,  0.0075], [0.1182,  -0.0364], [0.0944,  -0.0847], [0.0499,  -0.1041], -0.1093],
    ['st1', -0.1056, 0.0958, [0.0503,  0.0883], [0.113,  0.0299], [0.1884,  -0.0401], [0.1504,  -0.117], [0.0795,  -0.148], -0.1562],
    ['st2', -0.0612, 0.1169, [0.0587,  0.1082], [0.1319,  0.0399], [0.22,  -0.0417], [0.1756,  -0.1316], [0.0928,  -0.1678], -0.1773],
    ['st3', -0.0169, 0.1271, [0.0627,  0.118], [0.1407,  0.0451], [0.235,  -0.042], [0.1886,  -0.1386], [0.0991,  -0.1767], -0.1865],
    ['st4', 0.0275, 0.1324, [0.0647,  0.1234], [0.1451,  0.0481], [0.2308,  -0.0411], [0.1955,  -0.1419], [0.1023,  -0.1807], -0.1904],
    ['st5', 0.0719, 0.0922, [0.0564,  0.087], [0.1274,  0.0219], [0.186,  -0.0556], [0.148,  -0.1313], [0.0815,  -0.1667], -0.1839],
    ['st6', 0.1163, 0.0287, [0.0275,  0.0165], [0.0919,  0.0006], [0.1208,  -0.0546], [0.0961,  -0.1038], [0.0495,  -0.1217], -0.1253],
    ['st7', 0.1606, -0.0561, [0.0175,  -0.065], [0.0424,  -0.0837], [0.0615,  -0.1095], [0.0559,  -0.1386], [0.0282,  -0.1481], -0.1565],
    ['st8', 0.205, -0.0925, [0.0019,  -0.0925], [0.0085,  -0.0925], [0.0263,  -0.0984], [0.0079,  -0.1016], [0.0031,  -0.1016], -0.1016],
  ],
  craniumCaps: { back: [0,  -0.18,  -0.0302], tip: [0,  0.225,  -0.097] },
  muzzleFrom: 6,
  jawRows: [
    ['st0', -0.07, { gum: -0.1431, gumR: [0.045, -0.1431], jaw: [0.05, -0.1571], bottom: -0.1651 }],
    ['st1', 0.0, { gum: -0.158, gumR: [0.0405, -0.158], jaw: [0.045, -0.172], bottom: -0.18 }],
    ['st2', 0.07, { gum: -0.1542, gumR: [0.0315, -0.1542], jaw: [0.035, -0.1682], bottom: -0.1762 }],
    ['st3', 0.13, { gum: -0.1049, gumR: [0.0198, -0.1049], jaw: [0.022, -0.1189], bottom: -0.1269 }],
    ['st4', 0.19, { gum: -0.0901, gumR: [0.0108, -0.0901], jaw: [0.012, -0.1041], bottom: -0.1121 }],
  ],
  jawCaps: { back: [0, -0.1, -0.1389], tip: [0, 0.2, -0.0958] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.5, nape: [0, -0.15, -0.03],
  eyeAt: [6.3, 2.4], eyeR: 0.011,
  // small hexagon eyes as the wire draws them: tight lids, little bulk
  orbit: { reach: [0.004, 0.005, 0.006], bulk: [0.001, 0.002], thickness: 0.002 }, pupil: 'round', irisAngle: 40,
  browStrip: [[5.85, 1.95], [6.1, 1.95], [6.4, 2.0], [6.7, 2.1], [6.95, 2.25]],
  foldStrip: [[7.8, 2.2], [7.6, 2.9], [7.4, 3.6], [7.2, 4.2], [7.0, 4.7]],
  nostrilAt: [7.85, 1.5], noseAt: [7.8, 0.0001], noseR: [0.012, 0.01], webCranium: [5.7, 3.3, 4.97],
  // rounded ears: short, broad, set wide on the crown
  earAt: [3.4, 1.9], earSpine: [[0, 0, -0.012], [0, 0, 0.03], [0, 0, 0.08], [0, 0, 0.13], [0, 0, 0.175]],
  earR: [0.036, 0.032, 0.02, 0.006], earSquash: [1, 0.4], earH: 0.42,
  // the face pattern as head ornaments: a dark MASK patch through each eye (Brow), flattened onto the skin
  // the MASK as skull bands, as the wire paints it: the brow-to-jowl bands across the eyes dark, the forehead and
  // the muzzle pale (slots per band: top-crown, crown-brow, brow-cheek, cheek-jowl, jowl-lip, lip-palate)
  headOrnaments: [],
  craniumBandGroups: {
    'st5-st6': ['Skull', 'Brow', 'Brow', 'Brow', 'Cheek', 'Palate'],
    'st6-st7': ['Snout', 'Snout', 'Brow', 'Cheek', 'Jowl', 'Palate'],
  },
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};
family.extraSegments = [
  { name: 'tailRinged', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: family.tailStations.map(([x, y, z, r]) => ({ at: [x, y, z], r })), bandGroups: band(7), caps: { back: [0, -0.22, 0.252], tip: [0, -0.528, 0.075] }, capGroups: { back: 'Mane', tip: 'Tip' } },
];
export { band as procyonidTailBands };

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // COMMON RACCOON (Procyon lotor) — accepted v7 2026-10-05 (blind judges: over v1 high, over pre-fix v5 medium). Thesis: a plump low body with a hunched back (rump above the shoulders, hind
  // legs longer) · plantigrade, hand-like fore paws, long flat hind soles · a broad head, short pointed muzzle,
  // rounded ears · the black eye MASK on a pale face and the bushy tail with 5–6 dark RINGS · 0.28 m at the
  // shoulder (published 23–30 cm shoulder height, 40–70 cm head-body, tail 20–40 cm).
  raccoon: {
    family: 'procyonid', name: 'a common raccoon', scale: 0.9,
    // the head is the raccoon head-wire mesh itself (docs/examples/raccoon-head-wire), worn polygon for polygon
    headMesh: {
      mesh: RACCOON_WIRE, length: 0.15, anchor: 0.22,
      palette: { Skull: '#8b857c', FacePlanes: '#e9e5dc', Muzzle: '#e9e5dc', EyeMask: '#1d1a17', Eyes: '#0f0d0b', Nose: '#141110', Ears: '#8b857c', EarInset: '#e9e5dc' },
    },
  },
  // RED PANDA (Ailurus fulgens) — second species. Thesis: a long low body with a near-level back · short thick
  // plantigrade legs, dark (black-brown) legs and belly · a round broad face with a SHORT muzzle and big pointed
  // triangular ears, white face and ear rims · the long thick RINGED tail (~body length) · rusty-red coat · 0.25 m at
  // the shoulder (published head-body 51–64 cm, tail 28–48 cm, shoulder ~25 cm). Normal ring-plan head (no headMesh).
  redPanda: {
    family: 'procyonid', name: 'a red panda', scale: 0.77, headMesh: null,
    colors: { coat: '#a8421c', sock: '#2a1712', ash: '#efe6da', ashAlt: '#d9cbb8', brow: '#7a2e14', mane: '#b5532a', tip: '#6e2a12', ears: '#a8421c', snout: '#efe6da', belly: '#2a1712' },
    torso: [
      { at: [0, -0.27, 0.205], r: [0.06, 0.06] },
      { at: [0, -0.21, 0.205], r: [0.10, 0.115] },
      { at: [0, -0.13, 0.205], r: [0.112, 0.12] },
      { at: [0, -0.03, 0.205], r: [0.11, 0.105] },
      { at: [0, 0.07, 0.205], r: [0.095, 0.085] },
      { at: [0, 0.15, 0.205], r: [0.07, 0.065] },
    ],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.04, 0.055], [0.03, 0.032], 'Sock', [0.6, 0.5], [0.037, 0.044]],
      ['foreArmR', 'elbow', 'carpus', [0.03, 0.032], [0.023, 0.024], 'Sock', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.023, 0.022, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.03, 0.013], [0.036, 0.009], 'Sock', [0.6, 0.4]],
      ['thighR', 'hip', 'stifle', [0.06, 0.08], [0.035, 0.038], 'Coat', [0.2, 0.5], [0.05, 0.062]],
      ['shinR', 'stifle', 'hock', [0.034, 0.038], [0.024, 0.026], 'Sock', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.024, 0.022, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.028, 0.014], [0.03, 0.009], 'Sock', [0.5, 0.4]],
    ],
    // big pointed triangular ears: broad base tapering to a point, taller than the raccoon's
    earSpine: [[0, 0, -0.012], [0, 0, 0.03], [0, 0, 0.08], [0, 0, 0.13], [0, 0, 0.19]],
    earR: [0.05, 0.044, 0.03, 0.012], earSquash: [1, 0.4], earH: 0.42, earAt: [3.5, 2.05], legBulk: 1.2,
    // white face: pale cheeks and muzzle, rusty tear-stripe under the eye (Brow = rust-dark)
    craniumBandGroups: {
      'st4-st5': ['Skull', 'Skull', 'Cheek', 'Cheek', 'Cheek', 'Palate'],
      'st5-st6': ['Skull', 'Cheek', 'Brow', 'Cheek', 'Cheek', 'Palate'],
      'st6-st7': ['Snout', 'Snout', 'Snout', 'Cheek', 'Jowl', 'Palate'],
    },
    extraSegments: [
      { name: 'tailRinged', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane',
        stations: [[0, -0.25, 0.25, 0.04], [0, -0.31, 0.24, 0.058], [0, -0.38, 0.22, 0.066], [0, -0.45, 0.19, 0.068], [0, -0.52, 0.16, 0.066], [0, -0.58, 0.13, 0.062], [0, -0.64, 0.105, 0.056], [0, -0.69, 0.085, 0.046], [0, -0.73, 0.07, 0.034]].map(([x, y, z, r]) => ({ at: [x, y, z], r })),
        bandGroups: band(8), caps: { back: [0, -0.22, 0.252], tip: [0, -0.75, 0.064] }, capGroups: { back: 'Mane', tip: 'Tip' } },
    ],
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  raccoon: { common: 'raccoon', aliases: ['racoon', 'trash panda'], sci: 'Procyon lotor', size: '0.28 m at the shoulder', source: 'published raccoon figures' },
  redPanda: { common: 'red panda', aliases: ['lesser panda'], sci: 'Ailurus fulgens', size: '~0.25 m at the shoulder', source: 'published red panda figures' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {};
