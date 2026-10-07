// PRIMATE — a quadrupedal ape / monkey at rest on all fours: a broad deep chest over a narrow pelvis, the back line
// sloping DOWN from high shoulders to the rump (long arms, short bent legs), the hands knuckle-down under the shoulders,
// plantigrade feet with a splayed great toe, a short thick neck carrying the head low and forward, a round cranium
// over a flat face with a brow ridge and a protruding muzzle, round side ears, no tail. Worked species: the
// chimpanzee. See ../build.js for what every field does. Authored at true size (metres, scale 1, headScale 1).
//
// THE SLOPING BACK: the torso stations sit at different heights (shoulder high, rump low); `torsoUp: true` builds
// them with build.js's stable upright frame so the sloped trunk does not twist.

import { family as MACROPOD } from './macropod.js';

// a ringed tail's per-band groups (light / dark alternating), for a tail built as an extra loft
const rings = (n, light = 'Ash', dark = 'Tip') => Object.fromEntries(Array.from({ length: n }, (_, i) => [`st${i}-st${i + 1}`, Array(6).fill(i % 2 ? dark : light)]));
// a tail as an extra loft from [x, y, z, r] rows (one group, or `bands` per band)
const tailLoft = (name, pts, group, caps, bandGroups) => ({ name, kind: 'loft', slots: 'ring12', group, mirror: 'plane',
  stations: pts.map(([x, y, z, r]) => ({ at: [x, y, z], r })), caps, capGroups: { back: group, tip: group }, ...(bandGroups ? { bandGroups } : {}) });

export const family = {
  family: 'primate',
  colors: {
    coat: '#2b2623', sock: '#3a302b', ash: '#8f6f5a', ashAlt: '#7e604d', brow: '#5e4636', iris: '#4a2e1a',
    ink: '#120e0c', sclera: '#2b1d14', nose: '#4a3a32', teeth: '#ece6d6', mouth: '#4e3430', tip: '#2b2623',
    snout: '#8f6f5a', ears: '#8f6f5a', belly: '#2b2623',
  },
  torsoUp: true,
  joints: {
    neckBase: [0, 0.22, 0.74], neckTop: [0, 0.33, 0.80],
    // arms: long and nearly straight, the hand vertical, weight on the knuckles (the fingers curled forward)
    shoulder: [0.17, 0.20, 0.68], elbow: [0.19, 0.17, 0.40], carpus: [0.18, 0.20, 0.14], forePaw: [0.17, 0.25, 0.048], foreToe: [0.17, 0.31, 0.04],
    // legs: short, the knee forward and out, the foot flat (plantigrade), the great toe splayed inward
    hip: [0.11, -0.26, 0.50], stifle: [0.15, -0.10, 0.30], hock: [0.14, -0.22, 0.07], hindPaw: [0.14, -0.26, 0.045], hindToe: [0.15, -0.04, 0.028],
    hallux: [0.08, -0.10, 0.025],
  },
  torso: [
    { at: [0, -0.32, 0.47], r: [0.12, 0.10] },
    { at: [0, -0.20, 0.52], r: [0.15, 0.14] },
    { at: [0, -0.02, 0.59], r: [0.17, 0.16] },
    { at: [0, 0.12, 0.64], r: [0.23, 0.195] },
    { at: [0, 0.24, 0.66], r: [0.205, 0.16] },
  ],
  torsoCaps: { back: [0, -0.40, 0.45], tip: [0, 0.31, 0.67] },
  neckRA: [0.13, 0.12], neckRB: [0.09, 0.09], neckRMid: [0.11, 0.105],
  tail: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.075, 0.08], [0.055, 0.055], 'Coat', [0.6, 0.4], [0.065, 0.07]],
    ['foreArmR', 'elbow', 'carpus', [0.055, 0.055], [0.04, 0.04], 'Coat', [0.4, 0.3], [0.05, 0.05]],
    ['handR', 'carpus', 'forePaw', [0.04, 0.035], [0.045, 0.03], 'Sock', [0.3, 0.3]],
    ['knuckleR', 'forePaw', 'foreToe', [0.045, 0.028], [0.04, 0.022], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ['thighR', 'hip', 'stifle', [0.085, 0.09], [0.06, 0.06], 'Coat', [0.4, 0.4], [0.08, 0.08]],
    ['shinR', 'stifle', 'hock', [0.055, 0.055], [0.04, 0.04], 'Coat', [0.4, 0.3]],
    ['heelR', 'hock', 'hindPaw', 0.04, 0.04, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.045, 0.025], [0.045, 0.02], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ['halluxR', 'hindPaw', 'hallux', [0.02, 0.016], [0.018, 0.014], 'Sock', [0.2, 0.4], null, { up: [0, 0, 1] }],
  ],
  // skull rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] — a round domed cranium (st0-st2), the brow ridge
  // as a forward shelf (st3), a sunken nose bridge (st4), then the protruding muzzle (st5-st6) low on the face
  craniumRows: [
    ['st0', -0.09, 0.065, [0.045, 0.058], [0.07, 0.02], [0.07, -0.02], [0.055, -0.045], [0.035, -0.06], -0.065],
    ['st1', -0.045, 0.10, [0.042, 0.095], [0.08, 0.045], [0.082, 0.0], [0.07, -0.04], [0.048, -0.06], -0.065],
    ['st2', 0.0, 0.098, [0.042, 0.093], [0.078, 0.045], [0.078, 0.0], [0.066, -0.04], [0.046, -0.06], -0.062],
    ['st3', 0.05, 0.072, [0.056, 0.066], [0.074, 0.044], [0.064, -0.005], [0.054, -0.036], [0.042, -0.06], -0.062],
    ['st4', 0.065, 0.03, [0.03, 0.03], [0.05, 0.012], [0.054, -0.02], [0.05, -0.045], [0.04, -0.064], -0.066],
    ['st5', 0.10, 0.002, [0.024, 0.0], [0.04, -0.015], [0.046, -0.035], [0.044, -0.056], [0.034, -0.07], -0.072],
    ['st6', 0.13, -0.018, [0.018, -0.02], [0.03, -0.03], [0.034, -0.045], [0.032, -0.062], [0.024, -0.07], -0.072],
  ],
  craniumCaps: { back: [0, -0.115, 0.0], tip: [0, 0.142, -0.045] },
  muzzleFrom: 4,
  jawRows: [
    ['st0', -0.02, { gum: -0.064, gumR: [0.05, -0.064], jaw: [0.055, -0.085], bottom: -0.098 }],
    ['st1', 0.03, { gum: -0.064, gumR: [0.045, -0.064], jaw: [0.05, -0.085], bottom: -0.098 }],
    ['st2', 0.07, { gum: -0.068, gumR: [0.04, -0.068], jaw: [0.042, -0.088], bottom: -0.098 }],
    ['st3', 0.105, { gum: -0.072, gumR: [0.032, -0.072], jaw: [0.034, -0.09], bottom: -0.096 }],
    ['st4', 0.128, { gum: -0.072, gumR: [0.022, -0.072], jaw: [0.024, -0.086], bottom: -0.09 }],
  ],
  jawCaps: { back: [0, -0.05, -0.085], tip: [0, 0.138, -0.08] },
  skinControls: {
    browRaise: { amp: 0.008, map: [['st3.brow', 0.8, [0, 0, 1]], ['st2.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.008, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.008, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.008, map: [['st4.cheek', 1, [0.5, 0, 0.8]], ['st3.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.01, map: [['st5.lip', 0.8, [0.1, -1, 0.3]], ['st6.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1, nape: [0, -0.07, -0.05],
  eyeAt: [3.5, 1.8], eyeR: 0.012, pupil: 'round', irisAngle: 30, orbitFallback: true,
  browStrip: [[3.0, 0.6], [3.0, 1.1], [3.05, 1.6], [3.1, 2.1], [3.2, 2.5]],
  foldStrip: [[5.5, 2.2], [5.2, 2.9], [4.8, 3.6], [4.5, 4.2], [4.3, 4.7]],
  nostrilAt: [5.2, 0.6], noseAt: [5.2, 0.0001], noseR: [0.012, 0.01], webCranium: [1.7, 3.3, 4.97],
  // round ears out on the sides of the cranium
  earAt: [1.4, 2.8], earSpine: [[0, 0, -0.01], [0, 0, 0.01], [0, 0, 0.025], [0, 0, 0.04], [0, 0, 0.05]],
  earR: [0.022, 0.032, 0.03, 0.014], earSquash: [1, 0.3], earH: 1,
  bulk: 1, legBulk: 1,
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // CHIMPANZEE (Pan troglodytes), adult male — THESIS: knuckle-walking quadruped · back sloping down from high
  // shoulders (arms longer than legs) to a low rump, no tail · plantigrade feet with a splayed great toe, hands down on
  // the knuckles · a round cranium over a flat face: heavy brow ridge, protruding (prognathous) muzzle, big round side
  // ears · black coat, bare tan face · ~0.80 m at the shoulder on all fours (head-body 0.64–0.94 m, males 40–60 kg —
  // Smithsonian National Zoo / ADW Pan troglodytes; arm ≈ humerus 0.30 + radius 0.27 + hand 0.20 m).
  chimpanzee: {
    family: 'primate', name: 'a chimpanzee',
    headScale: 1.15, eyeR: 0.014, bulk: 1.1, legBulk: 1.3,
  },

  // WHITE-FACED CAPUCHIN (Cebus imitator, the Central American white-faced capuchin), adult — THESIS: a small monkey
  // walking on all fours on FLAT PALMS (not knuckles), the back near level, arms and legs about equal · a LONG furred
  // tail (≈ body length) hanging in a curve, its end curled · a short round face: little muzzle, no brow shelf ·
  // THE PATTERN: black body, legs and tail; a black CAP on the crown; cream-white face, throat, chest, shoulders
  // and upper arms; a pink bare face · head-body ≈0.42 m (published 0.34–0.45 m, tail 0.35–0.55 m, 3–4 kg — ADW
  // Cebus capucinus). Authored in chimpanzee units, `scale` brings it to size.
  capuchin: {
    family: 'primate', name: 'a white-faced capuchin', scale: 0.43,
    colors: { coat: '#1c1917', sock: '#1c1917', ash: '#e9dfc8', ashAlt: '#ddd0b4', snout: '#d9aa95', ears: '#c99a86', brow: '#e9dfc8', lids: '#e9dfc8', pad: '#e9dfc8',
      belly: '#e9dfc8', tip: '#1c1917', iris: '#3a2414', nose: '#7a4a3c', mouth: '#5a3430' },
    joints: {
      neckBase: [0, 0.24, 0.63], neckTop: [0, 0.34, 0.72],
      shoulder: [0.15, 0.20, 0.60], elbow: [0.16, 0.13, 0.34], carpus: [0.15, 0.22, 0.09], forePaw: [0.15, 0.24, 0.04], foreToe: [0.15, 0.34, 0.03],
      hip: [0.11, -0.30, 0.58], stifle: [0.15, -0.13, 0.36], hock: [0.14, -0.34, 0.09], hindPaw: [0.14, -0.33, 0.04], hindToe: [0.15, -0.15, 0.03],
      hallux: [0.08, -0.24, 0.028],
    },
    torso: [
      { at: [0, -0.38, 0.56], r: [0.10, 0.10] },
      { at: [0, -0.26, 0.57], r: [0.13, 0.135] },
      { at: [0, -0.08, 0.58], r: [0.13, 0.13] },
      { at: [0, 0.10, 0.59], r: [0.15, 0.14] },
      { at: [0, 0.24, 0.61], r: [0.13, 0.12] },
    ],
    torsoCaps: { back: [0, -0.46, 0.56], tip: [0, 0.31, 0.62] },
    neckRA: [0.11, 0.11], neckRB: [0.08, 0.08], neckRMid: [0.095, 0.095], neckGroup: 'Ash',
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.065, 0.07], [0.048, 0.048], 'Ash', [0.6, 0.4], [0.058, 0.06]],
      ['foreArmR', 'elbow', 'carpus', [0.048, 0.048], [0.034, 0.034], 'Coat', [0.4, 0.3], [0.042, 0.042]],
      ['handR', 'carpus', 'forePaw', [0.034, 0.03], [0.036, 0.024], 'Sock', [0.3, 0.3]],
      ['palmR', 'forePaw', 'foreToe', [0.038, 0.02], [0.034, 0.014], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
      ['thighR', 'hip', 'stifle', [0.08, 0.085], [0.055, 0.055], 'Coat', [0.4, 0.4], [0.072, 0.075]],
      ['shinR', 'stifle', 'hock', [0.05, 0.05], [0.036, 0.036], 'Coat', [0.4, 0.3]],
      ['heelR', 'hock', 'hindPaw', 0.036, 0.036, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.04, 0.022], [0.038, 0.016], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
      ['halluxR', 'hindPaw', 'hallux', [0.018, 0.014], [0.016, 0.012], 'Sock', [0.2, 0.4], null, { up: [0, 0, 1] }],
    ],
    // the long tail: off the rump, arcing down behind the heels, the end curled forward
    // (an extra loft on a stable ring frame, `up` in the mirror plane clear of every chord: the curl never flips a ring)
    tail: null, tip: null,
    extraSegments: [{ ...tailLoft('tail', [[0, -0.44, 0.58, 0.05], [0, -0.58, 0.56, 0.045], [0, -0.72, 0.47, 0.042], [0, -0.82, 0.34, 0.04], [0, -0.86, 0.22, 0.038],
      [0, -0.85, 0.12, 0.035], [0, -0.81, 0.07, 0.032], [0, -0.76, 0.045, 0.028]], 'Coat', { back: [0, -0.40, 0.585], tip: [0, -0.73, 0.03] }), up: [0, -0.94, 0.34] }],
    // the cream throat, chest and shoulders (markings channel), the black back and rump
    markDensity: { torso: 2 },
    markings: [{ on: 'torso', kind: 'band', run: [0.62, 1], t: [0.2, 1], caps: ['tip'], group: 'Belly' }],
    // a short round face: the muzzle pulled in, no brow shelf
    craniumRows: [
      ['st0', -0.09, 0.065, [0.045, 0.058], [0.07, 0.02], [0.07, -0.02], [0.055, -0.045], [0.035, -0.06], -0.065],
      ['st1', -0.045, 0.10, [0.045, 0.095], [0.08, 0.05], [0.082, 0.0], [0.07, -0.04], [0.048, -0.06], -0.065],
      ['st2', 0.0, 0.10, [0.045, 0.095], [0.08, 0.05], [0.08, 0.0], [0.066, -0.04], [0.046, -0.06], -0.062],
      ['st3', 0.045, 0.08, [0.045, 0.075], [0.068, 0.04], [0.064, -0.005], [0.054, -0.036], [0.042, -0.06], -0.062],
      ['st4', 0.065, 0.04, [0.03, 0.038], [0.05, 0.015], [0.054, -0.02], [0.05, -0.045], [0.04, -0.064], -0.066],
      ['st5', 0.09, 0.008, [0.024, 0.004], [0.04, -0.012], [0.046, -0.035], [0.044, -0.056], [0.034, -0.068], -0.07],
      ['st6', 0.11, -0.018, [0.018, -0.02], [0.03, -0.03], [0.034, -0.045], [0.032, -0.06], [0.024, -0.068], -0.07],
    ],
    craniumCaps: { back: [0, -0.115, 0.0], tip: [0, 0.12, -0.045] },
    // the black cap over the crown, the face pale: the bands from the brow forward take the pale face groups
    craniumBandGroups: {
      'st0-st1': ['Skull', 'Skull', 'Cheek', 'Cheek', 'Jowl', 'Palate'],
      'st1-st2': ['Skull', 'Skull', 'Cheek', 'Cheek', 'Jowl', 'Palate'],
      'st2-st3': ['Skull', 'Skull', 'Cheek', 'Cheek', 'Jowl', 'Palate'],
      'st3-st4': ['Skull', 'Cheek', 'Cheek', 'Cheek', 'Jowl', 'Palate'],
    },
    // the eye, ears and nose authored at the chimpanzee's head (headScale 1.15) and scaled with this small head
    headRelative: 1.15, relBrow: true,
    muzzleLen: 0.75, headScale: 0.95, eyeR: 0.019, legBulk: 0.85, earH: 0.8, earR: [0.022, 0.032, 0.03, 0.014],
  },
  // WESTERN LOWLAND GORILLA (Gorilla gorilla gorilla), adult male SILVERBACK — THESIS: a HUGE knuckle-walker, the
  // chest and shoulders massive over short legs, the back sloping steeply from the shoulders to a low rump · arms
  // long and thick as legs, hands down on the knuckles · a big head with a tall SAGITTAL CREST (the crown peaked high
  // at the back), a heavy brow shelf, a broad flat face with big nostrils, small ears close to the head · black coat
  // and black face, the SILVER SADDLE over the lower back and rump · standing ≈1.7 m upright (males 1.6–1.8 m,
  // 140–200 kg — ADW Gorilla gorilla / Smithsonian National Zoo); on all fours ≈1.15 m at the shoulder, scaled from
  // the chimpanzee by the arm (humerus + radius + hand ≈1.0 m against the chimpanzee's 0.77 m).
  gorilla: {
    family: 'primate', name: 'a western lowland gorilla', scale: 1.3,
    // charcoal hair, the bare face, chest, palms and soles a darker, warmer black (a value step from the hair, so the
    // face and chest read as skin), the silver saddle the lightest value on the animal
    colors: { coat: '#4b4743', sock: '#262220', ash: '#34302d', ashAlt: '#3c3733', snout: '#2e2a28', ears: '#3a3532', brow: '#2b2725', mane: '#bdbab3',
      belly: '#2f2b29', tip: '#4b4743', iris: '#5a3a1e', nose: '#1c1918', mouth: '#4a3430' },
    joints: {
      neckBase: [0, 0.22, 0.76], neckTop: [0, 0.32, 0.80],
      shoulder: [0.20, 0.20, 0.70],
      forePaw: [0.17, 0.25, 0.07], foreToe: [0.17, 0.31, 0.062],
      hip: [0.12, -0.26, 0.46], stifle: [0.17, -0.10, 0.27], hock: [0.15, -0.21, 0.13], hindPaw: [0.14, -0.26, 0.07], hindToe: [0.15, -0.04, 0.045],
      hallux: [0.08, -0.10, 0.04],
    },
    torso: [
      { at: [0, -0.32, 0.43], r: [0.13, 0.11] },
      { at: [0, -0.20, 0.49], r: [0.17, 0.155] },
      { at: [0, -0.02, 0.58], r: [0.20, 0.18] },
      { at: [0, 0.12, 0.65], r: [0.27, 0.22] },
      { at: [0, 0.24, 0.68], r: [0.24, 0.18] },
    ],
    torsoCaps: { back: [0, -0.40, 0.42], tip: [0, 0.31, 0.69] },
    neckRA: [0.16, 0.15], neckRB: [0.11, 0.11], neckRMid: [0.14, 0.13],
    // the silver saddle: over the lower back from the rump forward to behind the shoulders, on the top of the back
    // and down the upper flank, a grizzled mid-grey fringe below it and over the hips; the bare black chest in front
    markDensity: { torso: 2 },
    markings: [{ on: 'torso', kind: 'band', run: [0.06, 0.70], t: [0, 0.34], caps: ['back'], group: 'Mane' },
      { on: 'torso', kind: 'band', run: [0.06, 0.70], t: [0.34, 0.46], group: 'Grizzle', color: '#7a756e' },
      { on: 'thigh', kind: 'band', run: [0, 0.25], t: [0.4, 1], group: 'Grizzle' },
      { on: 'torso', kind: 'band', run: [0.80, 1], t: [0.62, 1], group: 'Belly' }],
    // the sagittal crest: the crown peaked high and narrow over the back of the cranium; a heavy brow shelf
    craniumRows: [
      ['st0', -0.09, 0.09, [0.03, 0.08], [0.07, 0.02], [0.075, -0.02], [0.06, -0.045], [0.035, -0.06], -0.065],
      ['st1', -0.045, 0.15, [0.025, 0.13], [0.08, 0.05], [0.088, 0.0], [0.075, -0.04], [0.05, -0.06], -0.065],
      ['st2', 0.0, 0.135, [0.03, 0.115], [0.08, 0.05], [0.085, 0.0], [0.072, -0.04], [0.05, -0.06], -0.062],
      ['st3', 0.05, 0.075, [0.06, 0.07], [0.082, 0.05], [0.07, -0.005], [0.06, -0.036], [0.045, -0.06], -0.062],
      ['st4', 0.065, 0.03, [0.034, 0.03], [0.056, 0.012], [0.06, -0.02], [0.056, -0.045], [0.045, -0.064], -0.066],
      ['st5', 0.095, 0.0, [0.03, -0.002], [0.05, -0.016], [0.054, -0.035], [0.05, -0.056], [0.04, -0.07], -0.072],
      ['st6', 0.12, -0.02, [0.024, -0.022], [0.04, -0.03], [0.044, -0.045], [0.04, -0.062], [0.03, -0.07], -0.072],
    ],
    craniumCaps: { back: [0, -0.115, 0.01], tip: [0, 0.13, -0.045] },
    headScale: 1.2, eyeR: 0.01, bulk: 1.25, legBulk: 1.75, muzzleW: 1.15, muzzleLen: 0.85, noseR: [0.024, 0.016], nostrilR: 0.01,
    earH: 0.55, earR: [0.018, 0.024, 0.022, 0.01],
  },
  // BORNEAN ORANGUTAN (Pongo pygmaeus), adult FLANGED male — THESIS: VERY LONG arms (arm span ≈2.2 m) and short
  // legs, so on all fours the back slopes steeply from high shoulders to a low rump, the hands down on fists ·
  // shaggy LONG red-orange hair hanging from the arms and flanks · the male's broad CHEEK PADS (flanges) framing a
  // flat dark face, a hanging throat sac, small ears · head-body ≈0.97 m (males 0.97 m, standing ≈1.37 m, 50–90
  // kg — ADW Pongo pygmaeus). Authored at the chimpanzee's units and size.
  orangutan: {
    family: 'primate', name: 'a Bornean orangutan', scale: 1.05,
    colors: { coat: '#a8481e', sock: '#5a3a2c', ash: '#4e4440', ashAlt: '#463c38', snout: '#5a4e48', ears: '#4e4440', brow: '#3a302c',
      belly: '#a8481e', tip: '#a8481e', mane: '#b8562a', iris: '#3a2414', nose: '#2a2220', mouth: '#3a2a26' },
    joints: {
      neckBase: [0, 0.22, 0.82], neckTop: [0, 0.31, 0.84],
      // the long arms: the shoulder high, the elbow out, the hand down on a fist
      shoulder: [0.19, 0.20, 0.78], elbow: [0.25, 0.20, 0.42], carpus: [0.22, 0.24, 0.12], forePaw: [0.21, 0.27, 0.05], foreToe: [0.21, 0.32, 0.045],
      // short legs, the feet turned out and flat
      hip: [0.12, -0.24, 0.42], stifle: [0.20, -0.10, 0.26], hock: [0.18, -0.20, 0.07], hindPaw: [0.18, -0.24, 0.045], hindToe: [0.21, -0.04, 0.03],
      hallux: [0.12, -0.10, 0.028],
    },
    torso: [
      { at: [0, -0.30, 0.40], r: [0.13, 0.11] },
      { at: [0, -0.18, 0.47], r: [0.17, 0.16] },
      { at: [0, -0.02, 0.59], r: [0.19, 0.17] },
      { at: [0, 0.12, 0.71], r: [0.22, 0.19] },
      { at: [0, 0.24, 0.76], r: [0.20, 0.16] },
    ],
    torsoCaps: { back: [0, -0.38, 0.38], tip: [0, 0.31, 0.77] },
    // a thick neck and the hanging throat sac
    neckRA: [0.15, 0.16], neckRB: [0.11, 0.13], neckRMid: [0.14, 0.17],
    // the long hair: the arm rows wide where the hair hangs from them (behind and below), in the long-hair colour
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.085, 0.10], [0.07, 0.085], 'Mane', [0.6, 0.4], [0.085, 0.11]],
      ['foreArmR', 'elbow', 'carpus', [0.07, 0.085], [0.045, 0.05], 'Mane', [0.4, 0.3], [0.065, 0.08]],
      ['handR', 'carpus', 'forePaw', [0.04, 0.035], [0.045, 0.035], 'Sock', [0.3, 0.3]],
      ['knuckleR', 'forePaw', 'foreToe', [0.045, 0.03], [0.04, 0.025], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
      ['thighR', 'hip', 'stifle', [0.08, 0.09], [0.06, 0.065], 'Mane', [0.4, 0.4], [0.08, 0.085]],
      ['shinR', 'stifle', 'hock', [0.055, 0.06], [0.04, 0.04], 'Coat', [0.4, 0.3]],
      ['heelR', 'hock', 'hindPaw', 0.04, 0.04, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.045, 0.025], [0.045, 0.02], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
      ['halluxR', 'hindPaw', 'hallux', [0.02, 0.016], [0.018, 0.014], 'Sock', [0.2, 0.4], null, { up: [0, 0, 1] }],
    ],
    // a high domed cranium, a FLAT face (little muzzle), the bare dark face
    craniumRows: [
      ['st0', -0.09, 0.07, [0.045, 0.062], [0.07, 0.02], [0.07, -0.02], [0.055, -0.045], [0.035, -0.06], -0.065],
      ['st1', -0.045, 0.115, [0.045, 0.108], [0.08, 0.05], [0.082, 0.0], [0.07, -0.04], [0.048, -0.06], -0.065],
      ['st2', 0.0, 0.11, [0.045, 0.104], [0.078, 0.05], [0.078, 0.0], [0.066, -0.04], [0.046, -0.06], -0.062],
      ['st3', 0.04, 0.08, [0.05, 0.074], [0.07, 0.04], [0.066, -0.005], [0.056, -0.036], [0.042, -0.06], -0.062],
      ['st4', 0.06, 0.035, [0.03, 0.033], [0.05, 0.014], [0.056, -0.02], [0.052, -0.045], [0.04, -0.064], -0.066],
      ['st5', 0.085, 0.005, [0.026, 0.0], [0.042, -0.015], [0.048, -0.035], [0.046, -0.056], [0.036, -0.07], -0.072],
      ['st6', 0.105, -0.018, [0.02, -0.02], [0.032, -0.03], [0.036, -0.045], [0.034, -0.062], [0.026, -0.07], -0.072],
    ],
    craniumCaps: { back: [0, -0.115, 0.0], tip: [0, 0.115, -0.045] },
    craniumBandGroups: { 'st0-st1': ['Skull', 'Skull', 'Skull', 'Skull', 'Jowl', 'Palate'], 'st1-st2': ['Skull', 'Skull', 'Skull', 'Cheek', 'Jowl', 'Palate'],
      'st2-st3': ['Skull', 'Skull', 'Cheek', 'Cheek', 'Jowl', 'Palate'], 'st3-st4': ['Snout', 'Snout', 'Cheek', 'Cheek', 'Jowl', 'Palate'] },
    headScale: 1.25, eyeR: 0.011, bulk: 1.1, legBulk: 1.35, muzzleLen: 0.8, earH: 0.4, earR: [0.016, 0.02, 0.018, 0.008],
    // the FLANGES: broad flat cheek pads standing out to each side of the face
    headOrnaments: [
      { kind: 'sweep', name: 'flange', at: [3.6, 3.0], space: 'local', spine: [[0, 0, -0.01], [0, 0, 0.02], [0, 0, 0.05], [0, 0, 0.075]], radii: [0.06, 0.085, 0.08, 0.04], m: 8, squash: [1, 0.25], group: 'Cheek' },
    ],
  },
  // RING-TAILED LEMUR (Lemur catta), adult — THESIS: a slim cat-sized primate on all fours, the hind legs longer
  // than the arms (the rump higher than the shoulders) · a FOX FACE: a long tapering black muzzle, big forward eyes
  // with orange irises in black triangular eye patches on a white face, pointed furred ears · ONE signature: the long
  // tail (longer than the body) held up in a curve, ringed in 13 alternating black and white bands · grey-brown back,
  // pale belly and limbs · head-body ≈0.43 m (published 0.39–0.46 m, tail 0.56–0.63 m, 2.2 kg — ADW Lemur catta).
  // Filed in this family by the roster (a strepsirrhine, not an ape); its head is the macropod's deer-like head.
  lemur: {
    family: 'primate', name: 'a ring-tailed lemur', scale: 0.5,
    colors: { coat: '#8e8780', sock: '#a39d96', ash: '#f0ece4', ashAlt: '#e6e0d6', snout: '#1a1716', ears: '#f0ece4', brow: '#1a1716', lids: '#1a1716',
      belly: '#efebe3', tip: '#151312', iris: '#e08a1c', nose: '#121010', mouth: '#2a2020', sclera: '#2a1a0c' },
    joints: {
      neckBase: [0, 0.22, 0.60], neckTop: [0, 0.31, 0.68],
      shoulder: [0.12, 0.18, 0.56], elbow: [0.13, 0.12, 0.32], carpus: [0.12, 0.20, 0.08], forePaw: [0.12, 0.22, 0.035], foreToe: [0.12, 0.31, 0.028],
      hip: [0.10, -0.32, 0.64], stifle: [0.14, -0.12, 0.40], hock: [0.13, -0.38, 0.10], hindPaw: [0.13, -0.36, 0.035], hindToe: [0.14, -0.16, 0.028],
      hallux: [0.08, -0.25, 0.026],
    },
    torso: [
      { at: [0, -0.40, 0.60], r: [0.09, 0.09] },
      { at: [0, -0.28, 0.60], r: [0.115, 0.12] },
      { at: [0, -0.10, 0.59], r: [0.11, 0.115] },
      { at: [0, 0.08, 0.58], r: [0.115, 0.115] },
      { at: [0, 0.22, 0.58], r: [0.10, 0.095] },
    ],
    torsoCaps: { back: [0, -0.47, 0.61], tip: [0, 0.28, 0.59] },
    neckRA: [0.085, 0.085], neckRB: [0.06, 0.06], neckRMid: [0.07, 0.07],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.05, 0.055], [0.036, 0.036], 'Coat', [0.6, 0.4], [0.045, 0.048]],
      ['foreArmR', 'elbow', 'carpus', [0.036, 0.036], [0.026, 0.026], 'Sock', [0.4, 0.3]],
      ['handR', 'carpus', 'forePaw', [0.026, 0.024], [0.028, 0.02], 'Sock', [0.3, 0.3]],
      ['palmR', 'forePaw', 'foreToe', [0.03, 0.016], [0.028, 0.012], 'Tip', [0.5, 0.4], null, { up: [0, 0, 1] }],
      ['thighR', 'hip', 'stifle', [0.07, 0.075], [0.045, 0.045], 'Coat', [0.4, 0.4], [0.062, 0.065]],
      ['shinR', 'stifle', 'hock', [0.042, 0.042], [0.028, 0.028], 'Sock', [0.4, 0.3]],
      ['heelR', 'hock', 'hindPaw', 0.028, 0.028, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.032, 0.018], [0.03, 0.013], 'Tip', [0.5, 0.4], null, { up: [0, 0, 1] }],
      ['halluxR', 'hindPaw', 'hallux', [0.015, 0.012], [0.013, 0.01], 'Tip', [0.2, 0.4], null, { up: [0, 0, 1] }],
    ],
    markDensity: { torso: 2 },
    markings: [{ on: 'torso', kind: 'belly', from: 0.62, group: 'Belly' }],
    // the ringed tail (an extra loft, alternating white / black bands): up off the rump and curving back over
    tail: null, tip: null,
    extraSegments: [tailLoft('tailRinged', [
      [0, -0.44, 0.62, 0.042], [0, -0.52, 0.66, 0.042], [0, -0.60, 0.72, 0.042], [0, -0.67, 0.79, 0.041], [0, -0.73, 0.87, 0.04],
      [0, -0.78, 0.95, 0.04], [0, -0.82, 1.04, 0.039], [0, -0.85, 1.13, 0.038], [0, -0.87, 1.22, 0.037], [0, -0.88, 1.31, 0.036],
      [0, -0.885, 1.40, 0.035], [0, -0.89, 1.49, 0.034], [0, -0.90, 1.57, 0.032], [0, -0.92, 1.65, 0.03], [0, -0.95, 1.72, 0.026],
    ], 'Ash', { back: [0, -0.40, 0.60], tip: [0, -0.97, 1.76] }, rings(14))],
    // the deer-like macropod head, shortened into a fox face
    craniumRows: MACROPOD.craniumRows, craniumCaps: MACROPOD.craniumCaps, muzzleFrom: MACROPOD.muzzleFrom, jawRows: MACROPOD.jawRows,
    jawCaps: MACROPOD.jawCaps, skinControls: MACROPOD.skinControls, nape: MACROPOD.nape,
    browStrip: MACROPOD.browStrip, foldStrip: MACROPOD.foldStrip, nostrilAt: MACROPOD.nostrilAt, noseAt: MACROPOD.noseAt, webCranium: MACROPOD.webCranium,
    // the eye, ears and nose authored at the macropod's head (headScale 0.9) and scaled with this small head
    headRelative: 0.9, relBrow: true,
    eyeAt: [2.6, 2.1], eyeR: 0.03, irisAngle: 55, eyeStyle: 'set', eyeSet: { sink: 0.3, pupil: 14 },
    earAt: [1.0, 1.5], earSpine: MACROPOD.earSpine, earR: [0.04, 0.05, 0.034, 0.01], earSquash: [1, 0.45], earH: 0.5,
    noseR: MACROPOD.noseR,
    // the face: white, the eye patches black (the bands round the eye, brow and cheek), the muzzle black
    craniumBandGroups: {
      'st0-st1': ['Skull', 'Skull', 'Cheek', 'Cheek', 'Jowl', 'Palate'],
      'st1-st2': ['Skull', 'Cheek', 'Cheek', 'Cheek', 'Jowl', 'Palate'],
      'st2-st3': ['Cheek', 'Cheek', 'Brow', 'Brow', 'Jowl', 'Palate'],
      'st3-st4': ['Snout', 'Cheek', 'Brow', 'Cheek', 'Jowl', 'Palate'],
    },
    headScale: 0.55, muzzleLen: 0.78, muzzleW: 0.9, legBulk: 1, bulk: 1,
  },
  // BROWN-THROATED THREE-TOED SLOTH (Bradypus variegatus), adult — filed here by the roster (a xenarthran, not a
  // primate). The builder stands every animal on z = 0 (no branch to hang from), so this is the sloth ON THE
  // GROUND, crawling as it does between trees. THESIS: a shaggy round body slung LOW, the belly near the ground · the
  // ARMS far longer than the legs, sprawled out to the sides, each hand ending in three long curved CLAWS · a SMALL
  // ROUND head on a short neck, a flat face with a little blunt snout, the dark EYE STRIPE running back from each eye
  // across a pale face, no visible ears · a stub tail · shaggy grey-brown coat (greenish with algae), the brown
  // throat · head-body ≈0.58 m (published 0.42–0.80 m, tail 0.04–0.09 m, 2.2–6.3 kg — ADW Bradypus variegatus).
  // Authored at true size (scale 1) on the primate's tables.
  sloth: {
    family: 'primate', name: 'a brown-throated three-toed sloth', scale: 0.8,
    colors: { coat: '#8a7f6a', sock: '#6e6452', ash: '#d9cfb8', ashAlt: '#cfc4aa', snout: '#d9cfb8', ears: '#8a7f6a', brow: '#2a2018', lids: '#2a2018',
      belly: '#7a5a3c', tip: '#6e6452', hoof: '#2e2722', iris: '#2a1d14', nose: '#1e1814', mouth: '#4a3430' },
    torsoUp: true,
    joints: {
      neckBase: [0, 0.15, 0.22], neckTop: [0, 0.23, 0.25],
      // the long arms sprawled out and forward, the hands flat, three claws hooking forward and down
      shoulder: [0.11, 0.10, 0.22], elbow: [0.30, 0.20, 0.17], carpus: [0.36, 0.33, 0.05], forePaw: [0.36, 0.36, 0.025], foreToe: [0.36, 0.40, 0.022],
      clawA: [0.33, 0.47, 0.012], clawB: [0.36, 0.48, 0.012], clawC: [0.39, 0.47, 0.012],
      // the short legs splayed, the feet flat beside the rump
      hip: [0.09, -0.20, 0.20], stifle: [0.22, -0.12, 0.15], hock: [0.26, -0.24, 0.05], hindPaw: [0.26, -0.22, 0.025], hindToe: [0.27, -0.15, 0.02],
      hallux: [0.30, -0.10, 0.012],
    },
    torso: [
      { at: [0, -0.30, 0.20], r: [0.09, 0.08] },
      { at: [0, -0.22, 0.20], r: [0.13, 0.12] },
      { at: [0, -0.06, 0.21], r: [0.15, 0.13] },
      { at: [0, 0.06, 0.22], r: [0.15, 0.125] },
      { at: [0, 0.15, 0.22], r: [0.11, 0.10] },
    ],
    torsoCaps: { back: [0, -0.36, 0.20], tip: [0, 0.21, 0.23] },
    neckRA: [0.085, 0.085], neckRB: [0.065, 0.065], neckRMid: [0.075, 0.075], neckGroup: 'Belly',
    tail: [[0, -0.33, 0.21, 0.03], [0, -0.38, 0.19, 0.022], [0, -0.40, 0.17, 0.012]],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.055, 0.06], [0.045, 0.045], 'Coat', [0.6, 0.4], [0.055, 0.055]],
      ['foreArmR', 'elbow', 'carpus', [0.045, 0.045], [0.032, 0.032], 'Coat', [0.4, 0.3], [0.042, 0.042]],
      ['handR', 'carpus', 'forePaw', [0.03, 0.028], [0.032, 0.022], 'Sock', [0.3, 0.3]],
      ['palmR', 'forePaw', 'foreToe', [0.034, 0.016], [0.032, 0.014], 'Sock', [0.5, 0.3], null, { up: [0, 0, 1] }],
      ['clawAR', 'foreToe', 'clawA', [0.008, 0.006], [0.003, 0.003], 'Hoof', [0.3, 0.3], null, { up: [0, 0, 1] }],
      ['clawBR', 'foreToe', 'clawB', [0.008, 0.006], [0.003, 0.003], 'Hoof', [0.3, 0.3], null, { up: [0, 0, 1] }],
      ['clawCR', 'foreToe', 'clawC', [0.008, 0.006], [0.003, 0.003], 'Hoof', [0.3, 0.3], null, { up: [0, 0, 1] }],
      ['thighR', 'hip', 'stifle', [0.06, 0.065], [0.045, 0.045], 'Coat', [0.4, 0.4], [0.055, 0.055]],
      ['shinR', 'stifle', 'hock', [0.042, 0.042], [0.03, 0.03], 'Coat', [0.4, 0.3]],
      ['heelR', 'hock', 'hindPaw', 0.03, 0.03, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.032, 0.016], [0.03, 0.013], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
      ['halluxR', 'hindToe', 'hallux', [0.008, 0.006], [0.003, 0.003], 'Hoof', [0.3, 0.3], null, { up: [0, 0, 1] }],
    ],
    // a small round head, a flat face: the muzzle short and blunt
    craniumRows: [
      ['st0', -0.09, 0.06, [0.05, 0.055], [0.07, 0.02], [0.072, -0.02], [0.06, -0.045], [0.038, -0.06], -0.065],
      ['st1', -0.045, 0.09, [0.05, 0.085], [0.08, 0.045], [0.085, 0.0], [0.072, -0.04], [0.05, -0.06], -0.065],
      ['st2', 0.0, 0.088, [0.05, 0.083], [0.08, 0.045], [0.084, 0.0], [0.07, -0.04], [0.048, -0.06], -0.062],
      ['st3', 0.04, 0.07, [0.045, 0.066], [0.068, 0.036], [0.07, -0.005], [0.058, -0.036], [0.042, -0.06], -0.062],
      ['st4', 0.065, 0.04, [0.032, 0.038], [0.05, 0.016], [0.056, -0.02], [0.05, -0.045], [0.04, -0.062], -0.064],
      ['st5', 0.09, 0.015, [0.026, 0.012], [0.04, -0.008], [0.044, -0.03], [0.04, -0.052], [0.032, -0.064], -0.066],
      ['st6', 0.105, -0.005, [0.018, -0.008], [0.028, -0.02], [0.032, -0.038], [0.03, -0.055], [0.022, -0.064], -0.066],
    ],
    craniumCaps: { back: [0, -0.115, 0.0], tip: [0, 0.115, -0.03] },
    // the pale face and the dark eye stripe: the band through the eye dark from the brow to the cheek, the crown shaggy
    craniumBandGroups: {
      'st1-st2': ['Skull', 'Skull', 'Brow', 'Cheek', 'Jowl', 'Palate'],
      'st2-st3': ['Skull', 'Cheek', 'Brow', 'Brow', 'Jowl', 'Palate'],
      'st3-st4': ['Snout', 'Cheek', 'Brow', 'Cheek', 'Jowl', 'Palate'],
    },
    headRelative: 1.15, relBrow: true, headScale: 0.8, eyeR: 0.016, muzzleLen: 0.6, ears: false, legBulk: 1, bulk: 1.05, noseR: [0.022, 0.018],
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  chimpanzee: { common: 'chimpanzee', aliases: ['chimp', 'ape'], sci: 'Pan troglodytes', size: '~0.80 m at the shoulder on all fours', source: 'Smithsonian National Zoo / ADW' },
  capuchin: { common: 'capuchin', aliases: ['monkey', 'macaque', 'white-faced capuchin', 'capuchin monkey'], sci: 'Cebus imitator', size: 'head-body ~0.42 m (0.34–0.45 m), tail 0.35–0.55 m', source: 'ADW Cebus capucinus' },
  gorilla: { common: 'gorilla', aliases: ['silverback', 'western lowland gorilla'], sci: 'Gorilla gorilla gorilla', size: '~1.7 m standing (adult male); ~1.15 m at the shoulder on all fours (scaled from the chimpanzee by arm length)', source: 'ADW Gorilla gorilla / Smithsonian National Zoo' },
  orangutan: { common: 'orangutan', aliases: ['bornean orangutan', 'orang-utan'], sci: 'Pongo pygmaeus', size: 'head-body ~0.97 m (adult male), standing ~1.37 m', source: 'ADW Pongo pygmaeus' },
  lemur: { common: 'lemur', aliases: ['ring-tailed lemur'], sci: 'Lemur catta', size: 'head-body ~0.43 m (0.39–0.46 m), tail 0.56–0.63 m', source: 'ADW Lemur catta' },
  sloth: { common: 'sloth', aliases: ['three-toed sloth', 'brown-throated sloth'], sci: 'Bradypus variegatus', size: 'head-body ~0.58 m (0.42–0.80 m)', source: 'ADW Bradypus variegatus' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {};
