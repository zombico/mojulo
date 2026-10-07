// RODENT — a heavy low trunk carried hunched (the rump the highest point), short plantigrade legs with small fore
// paws and longer hind feet, a short neck, a blunt broad head with a short deep muzzle, small rounded ears set low on
// the crown, and the rodent's ever-growing INCISORS (a head sweep, group 'Teeth'). The tail is an extra loft (the
// builder's own round tail is off) so a species can shape it: a flat paddle (beaver), a flattened rudder (muskrat),
// none (capybara: `extraSegments: []`), a bush (squirrel: round radii, `tailBush`-style bands). Tables are authored
// in metres at beaver size. Worked species: the North American beaver. See ../build.js.

// alternate tone bands along a loft (light, dark): the beaver's scaly cross-hatch read
const band = (n, light = 'Mane', dark = 'Tip') => Object.fromEntries(Array.from({ length: n }, (_, i) => [`st${i}-st${i + 1}`, Array(6).fill(i % 2 ? dark : light)]));
const lofted = (pts) => pts.map(([x, y, z, r]) => ({ at: [x, y, z], r }));

export const family = {
  family: 'rodent',
  colors: {
    coat: '#5e3d24', sock: '#2e2119', ash: '#7a5a3e', ashAlt: '#6b4c33', brow: '#3a2818', iris: '#120d0a',
    ink: '#0c0907', sclera: '#120d0a', nose: '#16110e', teeth: '#d9782a', mouth: '#3a2818', tip: '#1f1c1b',
    mane: '#34302d', snout: '#5e3d24', ears: '#4a3020', belly: '#6b4c33',
  },
  joints: {
    neckBase: [0, 0.17, 0.18], neckTop: [0, 0.26, 0.20],
    shoulder: [0.09, 0.13, 0.155], elbow: [0.10, 0.10, 0.09], carpus: [0.10, 0.14, 0.035], forePaw: [0.10, 0.145, 0.012], foreToe: [0.10, 0.20, 0.008],
    hip: [0.09, -0.24, 0.19], stifle: [0.125, -0.15, 0.11], hock: [0.125, -0.25, 0.035], hindPaw: [0.125, -0.24, 0.012], hindToe: [0.135, -0.06, 0.008],
  },
  // level centres (see build.js); the hunch is in the radii: deepest and tallest over the hips, lower at the shoulder
  torso: [
    { at: [0, -0.40, 0.17], r: [0.07, 0.06] },
    { at: [0, -0.32, 0.17], r: [0.14, 0.12] },
    { at: [0, -0.20, 0.17], r: [0.165, 0.145] },
    { at: [0, -0.06, 0.17], r: [0.155, 0.12] },
    { at: [0, 0.07, 0.17], r: [0.125, 0.09] },
    { at: [0, 0.17, 0.17], r: [0.095, 0.075] },
  ],
  torsoCaps: { back: [0, -0.45, 0.17], tip: [0, 0.22, 0.17] },
  neckRA: [0.095, 0.09], neckRB: [0.075, 0.075], neckRMid: [0.085, 0.082],
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.045, 0.06], [0.03, 0.032], 'Coat', [0.6, 0.5], [0.04, 0.046]],
    ['foreArmR', 'elbow', 'carpus', [0.03, 0.032], [0.022, 0.023], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.021, 0.02, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.026, 0.012], [0.03, 0.008], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.07, 0.09], [0.04, 0.044], 'Coat', [0.2, 0.5], [0.06, 0.07]],
    ['shinR', 'stifle', 'hock', [0.038, 0.042], [0.026, 0.028], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.025, 0.022, 'Sock', [0.4, 0.4]],
    // the webbed hind foot: long and fanning wide toward the toes
    ['hindPawR', 'hindPaw', 'hindToe', [0.013, 0.035], [0.008, 0.06], 'Sock', [0.5, 0.4]],
  ],
  // skull rows (canine-derived): a broad flat-topped braincase, a short deep blunt muzzle
  craniumRows: [
    ['st0', -0.15, 0.045, [0.03, 0.043], [0.065, 0.02], [0.075, -0.02], [0.065, -0.05], [0.04, -0.07], -0.075],
    ['st1', -0.09, 0.08, [0.03, 0.078], [0.08, 0.05], [0.10, -0.01], [0.095, -0.055], [0.06, -0.08], -0.085],
    ['st2', -0.02, 0.082, [0.04, 0.08], [0.09, 0.045], [0.11, -0.005], [0.10, -0.055], [0.06, -0.082], -0.088],
    ['st3', 0.04, 0.066, [0.03, 0.064], [0.07, 0.035], [0.085, -0.015], [0.08, -0.055], [0.055, -0.078], -0.082],
    ['st4', 0.10, 0.05, [0.03, 0.048], [0.06, 0.02], [0.07, -0.02], [0.066, -0.05], [0.05, -0.072], -0.076],
    ['st5', 0.16, 0.035, [0.025, 0.033], [0.05, 0.01], [0.058, -0.022], [0.055, -0.048], [0.042, -0.066], -0.07],
    ['st6', 0.20, 0.018, [0.016, 0.016], [0.035, 0.0], [0.04, -0.024], [0.038, -0.045], [0.03, -0.06], -0.064],
  ],
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.215, -0.025] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.07, { gum: -0.08, gumR: [0.05, -0.08], jaw: [0.055, -0.105], bottom: -0.12 }],
    ['st1', 0.0, { gum: -0.082, gumR: [0.045, -0.082], jaw: [0.048, -0.104], bottom: -0.115 }],
    ['st2', 0.07, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.042, -0.094], bottom: -0.103 }],
    ['st3', 0.13, { gum: -0.068, gumR: [0.032, -0.068], jaw: [0.034, -0.083], bottom: -0.09 }],
    ['st4', 0.18, { gum: -0.064, gumR: [0.024, -0.064], jaw: [0.025, -0.075], bottom: -0.08 }],
  ],
  jawCaps: { back: [0, -0.1, -0.1], tip: [0, 0.195, -0.07] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.52, nape: [0, -0.1, -0.04],
  eyeAt: [2.4, 2.2], eyeR: 0.016, pupil: 'round', irisAngle: 40,
  orbit: { reach: [0.006, 0.007, 0.008], bulk: [0.001, 0.002], thickness: 0.003 },
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.022, 0.018], webCranium: [1.7, 3.3, 4.97],
  // small rounded ears, short and set wide, low on the crown
  earAt: [1.2, 1.9], earSpine: [[0, 0, -0.012], [0, 0, 0.02], [0, 0, 0.06], [0, 0, 0.1], [0, 0, 0.13]],
  earR: [0.045, 0.043, 0.032, 0.016], earSquash: [1, 0.5], earH: 0.3,
  // the upper incisors: two chisel plates hanging from the front of the upper lip (head units, mirrored)
  headOrnaments: [
    { kind: 'sweep', name: 'incisor', at: [5.6, 5.5], space: 'head', spine: [[0.012, 0.155, -0.05], [0.012, 0.16, -0.075], [0.012, 0.158, -0.1]], radii: [0.011, 0.011, 0.009], m: 6, squash: [1, 0.45], group: 'Teeth' },
  ],
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};
export { band as rodentTailBands, lofted as rodentLofted };

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // NORTH AMERICAN BEAVER (Castor canadensis) — the rodent family's worked species. Thesis: a heavy, low, hunched
  // trunk (rump the high point) on short plantigrade legs, small fore paws, big webbed hind feet · a blunt broad head
  // with small rounded ears and ORANGE incisors · the broad FLAT scaly paddle tail, dark, carried level behind ·
  // 0.30 m at the shoulder (published: ~30 cm shoulder height; head-body 74–90 cm, tail 20–35 cm long × ~13 cm wide;
  // Animal Diversity Web / Smithsonian NMNH Castor canadensis accounts). Kept v4 2026-10-05 (judge A: v4 over the
  // critic-fixed v6, low; judge B: v6 over v1, medium — v4 and v6 differ only in hunch, hind feet, tail height).
  beaver: {
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
    family: 'rodent', name: 'a North American beaver', scale: 1,
    muzzleW: 1.15, muzzleLen: 0.75,
    // kept v10 (blind judges, both orders: A v10 over v8 55%/55%; B v10 over v1 65%/70%). The shoulder raised to the published 0.30 m (front torso stations deeper above the centre line)
    torso: [
      { at: [0, -0.40, 0.17], r: [0.07, 0.06] },
      { at: [0, -0.32, 0.17], r: [0.14, 0.12] },
      { at: [0, -0.20, 0.17], r: [0.165, 0.145] },
      { at: [0, -0.06, 0.17], r: [0.155, 0.13] },
      { at: [0, 0.07, 0.17], r: [0.13, 0.125] },
      { at: [0, 0.17, 0.17], r: [0.10, 0.105] },
    ],
    extraSegments: [
      { name: 'tailPaddle', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane',
        // up: a stable ring frame, so the tail drops from the rump and lies flat on the ground with no ring flip
        up: true,
        stations: lofted([[0, -0.34, 0.10, [0.055, 0.04]], [0, -0.42, 0.055, [0.055, 0.03]], [0, -0.48, 0.036, [0.10, 0.03]], [0, -0.55, 0.033, [0.125, 0.032]], [0, -0.62, 0.031, [0.132, 0.031]], [0, -0.68, 0.03, [0.125, 0.029]], [0, -0.73, 0.027, [0.095, 0.024]], [0, -0.76, 0.022, [0.04, 0.012]]]),
        bandGroups: { ...band(7), 'st0-st1': Array(6).fill('Coat') }, caps: { back: [0, -0.31, 0.12], tip: [0, -0.775, 0.02] }, capGroups: { back: 'Coat', tip: 'Tip' } },
    ],
  },
  // EASTERN GREY SQUIRREL (Sciurus carolinensis). Thesis: a slim light trunk on all fours, back arched (rump high),
  // longer slimmer legs than the beaver, long hind feet · a round head with a short muzzle, big dark eyes and small
  // rounded upright ears · ONE signature: the big BUSHY tail rising from the rump in an S-curve up over the back ·
  // grey above, pale below · ~0.12 m to the top of the arched back on all fours (published: head-body 23–30 cm,
  // tail 19–25 cm, 400–600 g — Animal Diversity Web, Sciurus carolinensis; standing height scaled from those).
  // Authored in the family's beaver-size units, `scale` 0.36 brings it to size.
  squirrel: {
    family: 'rodent', name: 'an eastern grey squirrel', scale: 0.36,
    colors: { coat: '#85837d', sock: '#76736c', ash: '#b9b5ab', ashAlt: '#a9a59b', ears: '#8a8680', belly: '#e6e2d8',
      mane: '#8f8b84', tip: '#cfcac0', snout: '#8a877f', teeth: '#d9b46a', brow: '#5e5a54', mouth: '#5e5a54' },
    joints: {
      neckBase: [0, 0.17, 0.26], neckTop: [0, 0.25, 0.34],
      shoulder: [0.075, 0.12, 0.21], elbow: [0.085, 0.07, 0.12], carpus: [0.08, 0.13, 0.04], forePaw: [0.08, 0.135, 0.012], foreToe: [0.08, 0.18, 0.008],
      hip: [0.08, -0.25, 0.25], stifle: [0.11, -0.10, 0.15], hock: [0.10, -0.29, 0.05], hindPaw: [0.10, -0.275, 0.012], hindToe: [0.10, -0.08, 0.008],
    },
    torso: [
      { at: [0, -0.39, 0.23], r: [0.05, 0.06] },
      { at: [0, -0.31, 0.23], r: [0.11, 0.125] },
      { at: [0, -0.18, 0.23], r: [0.12, 0.125] },
      { at: [0, -0.05, 0.23], r: [0.10, 0.10] },
      { at: [0, 0.07, 0.23], r: [0.08, 0.075] },
      { at: [0, 0.16, 0.23], r: [0.065, 0.06] },
    ],
    torsoCaps: { back: [0, -0.43, 0.23], tip: [0, 0.21, 0.23] },
    neckRA: [0.07, 0.07], neckRB: [0.065, 0.065], neckRMid: [0.068, 0.068],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.035, 0.045], [0.022, 0.024], 'Coat', [0.6, 0.5]],
      ['foreArmR', 'elbow', 'carpus', [0.022, 0.024], [0.016, 0.017], 'Coat', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.016, 0.015, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.02, 0.01], [0.02, 0.007], 'Sock', [0.6, 0.4]],
      ['thighR', 'hip', 'stifle', [0.06, 0.075], [0.035, 0.038], 'Coat', [0.2, 0.5], [0.05, 0.06]],
      ['shinR', 'stifle', 'hock', [0.03, 0.033], [0.018, 0.02], 'Coat', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.018, 0.016, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.018, 0.012], [0.02, 0.008], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ],
    headScale: 0.6, muzzleLen: 0.55, muzzleW: 1.1,
    headRelative: 0.52, eyeAt: [2.3, 2.2], eyeR: 0.03, nose: false, headOrnaments: [], headPitch: 8,
    earAt: [1.2, 1.5], earH: 0.5, earR: [0.046, 0.048, 0.04, 0.024],
    extraSegments: [
      // the bushy tail: out of the rump, back and up, over the back, its tip curling back (an S)
      { name: 'tailBush', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane',
        stations: lofted([[0, -0.42, 0.24, 0.045], [0, -0.54, 0.30, 0.10], [0, -0.62, 0.43, 0.145], [0, -0.58, 0.60, 0.16], [0, -0.48, 0.73, 0.15], [0, -0.42, 0.84, 0.12], [0, -0.47, 0.93, 0.07]]),
        caps: { back: [0, -0.40, 0.23], tip: [0, -0.50, 0.97] } },
    ],
  },
  // HOUSE MOUSE (Mus musculus). Thesis: a tiny low pear-shaped body, hunched (the rump the high point), on short legs
  // with pink feet · a pointed tapering snout, big black eyes · ONE signature: LARGE ROUND THIN EARS standing off the
  // crown · a long thin bare pink tail as long as the body, trailing on the ground · grey-brown above, paler below ·
  // published: head-body 6.5–9.5 cm, tail 6–10.5 cm, 12–30 g (Animal Diversity Web, Mus musculus). Modelled on the
  // squirrel's tables; `scale` brings it to size.
  mouse: {
    eyeStyle: 'set',
    family: 'rodent', name: 'a house mouse', scale: 0.094,
    colors: { coat: '#7d7368', sock: '#d9a9a0', ash: '#b3a99c', ashAlt: '#a39a8d', ears: '#c99a92', belly: '#cfc6b8',
      mane: '#d4a49b', tip: '#c99a92', snout: '#7d7368', teeth: '#e8d6a8', brow: '#5e554b', mouth: '#5e554b', nose: '#d08f8a', iris: '#050404', sclera: '#050404' },
    joints: {
      neckBase: [0, 0.17, 0.20], neckTop: [0, 0.26, 0.24],
      shoulder: [0.08, 0.12, 0.16], elbow: [0.09, 0.08, 0.09], carpus: [0.085, 0.14, 0.035], forePaw: [0.085, 0.145, 0.012], foreToe: [0.085, 0.20, 0.008],
      hip: [0.09, -0.24, 0.20], stifle: [0.12, -0.11, 0.12], hock: [0.11, -0.27, 0.045], hindPaw: [0.11, -0.26, 0.012], hindToe: [0.11, -0.10, 0.008],
    },
    torso: [
      { at: [0, -0.40, 0.19], r: [0.06, 0.06] },
      { at: [0, -0.32, 0.19], r: [0.14, 0.16] },
      { at: [0, -0.18, 0.19], r: [0.15, 0.17] },
      { at: [0, -0.04, 0.19], r: [0.125, 0.135] },
      { at: [0, 0.08, 0.19], r: [0.10, 0.10] },
      { at: [0, 0.17, 0.19], r: [0.08, 0.075] },
    ],
    torsoCaps: { back: [0, -0.45, 0.19], tip: [0, 0.22, 0.19] },
    neckRA: [0.085, 0.08], neckRB: [0.075, 0.075], neckRMid: [0.08, 0.078],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.035, 0.045], [0.022, 0.024], 'Coat', [0.6, 0.5]],
      ['foreArmR', 'elbow', 'carpus', [0.022, 0.024], [0.016, 0.017], 'Coat', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.016, 0.015, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.022, 0.01], [0.022, 0.007], 'Sock', [0.6, 0.4]],
      ['thighR', 'hip', 'stifle', [0.065, 0.08], [0.035, 0.038], 'Coat', [0.2, 0.5], [0.055, 0.065]],
      ['shinR', 'stifle', 'hock', [0.03, 0.033], [0.018, 0.02], 'Coat', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.018, 0.016, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.02, 0.012], [0.022, 0.008], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ],
    // a big head for the body, the muzzle drawn out narrow and pointed
    headScale: 0.62, muzzleLen: 1.05, muzzleW: 0.8,
    headRelative: 0.52, relBrow: true, eyeAt: [2.3, 2.2], eyeR: 0.034, nose: false, headOrnaments: [], headPitch: 2,
    // the ears: big, round, thin, standing up and out off the back of the crown
    earAt: [1.0, 1.9], earSpine: [[0, 0, -0.012], [0, -0.01, 0.03], [0, -0.03, 0.07], [0, -0.05, 0.11], [0, -0.06, 0.14]], earH: 0.8, earR: [0.05, 0.10, 0.12, 0.10], earSquash: [1, 0.2],
    extraSegments: [
      // the tail: out of the rump, down to the ground, then a long thin bare whip trailing behind
      { name: 'tailWhip', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', up: true,
        stations: lofted([[0, -0.42, 0.17, 0.035], [0, -0.52, 0.10, 0.03], [0, -0.64, 0.05, 0.026], [0, -0.82, 0.03, 0.022], [0, -1.02, 0.03, 0.018], [0, -1.20, 0.035, 0.014], [0, -1.34, 0.04, 0.009]]),
        caps: { back: [0, -0.40, 0.18], tip: [0, -1.38, 0.042] } },
    ],
  },
  // BROWN RAT (Rattus norvegicus). Thesis: a LONG heavy low body (longer and less round than the mouse), hunched over
  // the hips, on short legs with pink feet · a long blunt-tipped snout, small dark eyes · SMALLER close-set ears than
  // the mouse, pinkish, half hidden in the fur · a THICK scaly tail, a little shorter than the body, tapering to a point
  // along the ground · coarse grey-brown above, grey-white below · published: head-body 20–28 cm, tail 17–23 cm,
  // 200–500 g (Animal Diversity Web, Rattus norvegicus).
  rat: {
    eyeStyle: 'set',
    family: 'rodent', name: 'a brown rat', scale: 0.227,
    colors: { coat: '#6e5d4a', sock: '#c99e95', ash: '#a39582', ashAlt: '#948671', ears: '#b48c84', belly: '#b9b1a3',
      mane: '#a88c86', tip: '#9a7f79', snout: '#6e5d4a', teeth: '#e0b85a', brow: '#4c3f31', mouth: '#4c3f31', nose: '#c08a86', iris: '#050404', sclera: '#050404' },
    joints: {
      neckBase: [0, 0.22, 0.20], neckTop: [0, 0.31, 0.235],
      shoulder: [0.08, 0.15, 0.16], elbow: [0.09, 0.11, 0.09], carpus: [0.085, 0.17, 0.035], forePaw: [0.085, 0.175, 0.012], foreToe: [0.085, 0.23, 0.008],
      hip: [0.09, -0.32, 0.20], stifle: [0.12, -0.19, 0.12], hock: [0.11, -0.35, 0.045], hindPaw: [0.11, -0.34, 0.012], hindToe: [0.11, -0.17, 0.008],
    },
    torso: [
      { at: [0, -0.50, 0.19], r: [0.06, 0.06] },
      { at: [0, -0.42, 0.19], r: [0.135, 0.155] },
      { at: [0, -0.27, 0.19], r: [0.145, 0.165] },
      { at: [0, -0.10, 0.19], r: [0.13, 0.14] },
      { at: [0, 0.06, 0.19], r: [0.11, 0.11] },
      { at: [0, 0.20, 0.19], r: [0.085, 0.08] },
    ],
    torsoCaps: { back: [0, -0.55, 0.19], tip: [0, 0.26, 0.19] },
    neckRA: [0.09, 0.085], neckRB: [0.075, 0.075], neckRMid: [0.082, 0.08],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.035, 0.045], [0.022, 0.024], 'Coat', [0.6, 0.5]],
      ['foreArmR', 'elbow', 'carpus', [0.022, 0.024], [0.016, 0.017], 'Coat', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.016, 0.015, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.022, 0.01], [0.022, 0.007], 'Sock', [0.6, 0.4]],
      ['thighR', 'hip', 'stifle', [0.065, 0.08], [0.035, 0.038], 'Coat', [0.2, 0.5], [0.055, 0.065]],
      ['shinR', 'stifle', 'hock', [0.03, 0.033], [0.018, 0.02], 'Coat', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.018, 0.016, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.02, 0.012], [0.022, 0.008], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ],
    // a long head, the muzzle long and blunt-tipped
    headScale: 0.56, muzzleLen: 1.2, muzzleW: 0.95,
    headRelative: 0.52, relBrow: true, eyeAt: [2.4, 2.2], eyeR: 0.026, nose: false, headOrnaments: [], headPitch: 0,
    // the ears: smaller than the mouse's, rounded, set low and back
    earAt: [0.9, 1.9], earSpine: [[0, 0, -0.012], [0, -0.01, 0.03], [0, -0.025, 0.065], [0, -0.04, 0.10], [0, -0.05, 0.12]], earH: 0.6, earR: [0.045, 0.075, 0.08, 0.06], earSquash: [1, 0.22],
    extraSegments: [
      // the tail: thick at the root, down to the ground, a long scaly taper behind (faint light / dark rings)
      { name: 'tailScaly', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', up: true,
        stations: lofted([[0, -0.52, 0.17, 0.055], [0, -0.62, 0.10, 0.045], [0, -0.74, 0.05, 0.038], [0, -0.92, 0.035, 0.03], [0, -1.10, 0.035, 0.023], [0, -1.26, 0.04, 0.016], [0, -1.38, 0.045, 0.009]]),
        bandGroups: band(6), caps: { back: [0, -0.50, 0.18], tip: [0, -1.42, 0.047] } },
    ],
  },  // SYRIAN (GOLDEN) HAMSTER (Mesocricetus auratus). Thesis: a ROUND BALL of a body sitting low, the belly near the
  // ground, the short legs nearly hidden under it, NO visible tail (a stub) · a big round head with PUFFED CHEEKS (the
  // pouches) and a short blunt muzzle, dark bulging eyes, small round upright ears · golden-orange above, cream below ·
  // published: head-body 13–18 cm, tail ~1.2 cm, 100–150 g (Animal Diversity Web, Mesocricetus auratus).
  hamster: {
    eyeStyle: 'set',
    family: 'rodent', name: 'a Syrian hamster', scale: 0.19,
    colors: { coat: '#c58a4c', sock: '#e8c9b6', ash: '#e9dcc6', ashAlt: '#dccdb4', ears: '#c99a8a', belly: '#f1e8d8',
      mane: '#c58a4c', tip: '#e8c9b6', snout: '#d9a56c', teeth: '#e8d6a8', brow: '#8a5a30', mouth: '#6a4428', nose: '#c88f8a', iris: '#050404', sclera: '#050404' },
    joints: {
      neckBase: [0, 0.14, 0.25], neckTop: [0, 0.23, 0.31],
      shoulder: [0.10, 0.10, 0.14], elbow: [0.11, 0.08, 0.08], carpus: [0.105, 0.13, 0.03], forePaw: [0.105, 0.135, 0.012], foreToe: [0.105, 0.18, 0.008],
      hip: [0.12, -0.20, 0.16], stifle: [0.15, -0.10, 0.09], hock: [0.14, -0.22, 0.04], hindPaw: [0.14, -0.21, 0.012], hindToe: [0.14, -0.09, 0.008],
    },
    // a short fat barrel, as wide as it is deep, its belly a hand's breadth off the ground
    torso: [
      { at: [0, -0.33, 0.20], r: [0.12, 0.11] },
      { at: [0, -0.27, 0.20], r: [0.20, 0.18] },
      { at: [0, -0.15, 0.20], r: [0.235, 0.20] },
      { at: [0, -0.01, 0.20], r: [0.225, 0.19] },
      { at: [0, 0.10, 0.20], r: [0.18, 0.16] },
      { at: [0, 0.17, 0.20], r: [0.12, 0.11] },
    ],
    torsoCaps: { back: [0, -0.40, 0.20], tip: [0, 0.22, 0.21] },
    neckRA: [0.14, 0.13], neckRB: [0.12, 0.11], neckRMid: [0.13, 0.12],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.035, 0.045], [0.022, 0.024], 'Coat', [0.6, 0.5]],
      ['foreArmR', 'elbow', 'carpus', [0.022, 0.024], [0.016, 0.017], 'Belly', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.016, 0.015, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.022, 0.01], [0.022, 0.007], 'Sock', [0.6, 0.4]],
      ['thighR', 'hip', 'stifle', [0.065, 0.08], [0.035, 0.038], 'Coat', [0.2, 0.5], [0.055, 0.065]],
      ['shinR', 'stifle', 'hock', [0.03, 0.033], [0.018, 0.02], 'Belly', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.018, 0.016, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.02, 0.012], [0.022, 0.008], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ],
    // a big round head, the muzzle short and blunt, the cheeks puffed wide (the pouches)
    headScale: 0.78, muzzleLen: 0.6, muzzleW: 1.45,
    headRelative: 0.52, relBrow: true, eyeAt: [2.3, 2.1], eyeR: 0.032, nose: false, headOrnaments: [], headPitch: 4,
    // small round ears, upright on the crown
    earAt: [1.2, 1.9], earSpine: [[0, 0, -0.012], [0.004, -0.008, 0.03], [0.006, -0.018, 0.06], [0.006, -0.028, 0.09], [0.006, -0.032, 0.105]], earH: 0.9, earR: [0.04, 0.055, 0.056, 0.04], earSquash: [1, 0.25],
    // the tail: a tiny stub, barely out of the fur
    extraSegments: [
      { name: 'tailStub', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane',
        stations: lofted([[0, -0.36, 0.20, 0.03], [0, -0.40, 0.19, 0.025], [0, -0.42, 0.18, 0.015]]), caps: { back: [0, -0.34, 0.205], tip: [0, -0.43, 0.175] } },
    ],
    markings: [{ on: ['torso', 'neck'], kind: 'belly', from: 0.68, group: 'Belly' }],
  },  // DOMESTIC GUINEA PIG (Cavia porcellus). Thesis: a long TAILLESS LOAF of a body, level-backed and blunt at both
  // ends, set low on very short legs · a big deep blunt head running straight into the body with no neck to speak of,
  // a deep ROMAN-NOSED muzzle, round dark eyes set high · small PETAL ears drooping at the sides · a patched coat
  // (ginger, white and dark) · published: head-body 20–25 cm, no external tail, 0.7–1.2 kg (Animal Diversity Web,
  // Cavia porcellus).
  guineaPig: {
    eyeStyle: 'set',
    family: 'rodent', name: 'a domestic guinea pig', scale: 0.26,
    colors: { coat: '#b8743a', sock: '#e3c8b8', ash: '#efe6da', ashAlt: '#e2d8ca', ears: '#9a6a52', belly: '#f2ece2',
      mane: '#2c2420', tip: '#2c2420', snout: '#b8743a', teeth: '#e8d6a8', brow: '#6a4428', mouth: '#5a3a22', nose: '#b88a80', iris: '#0a0606', sclera: '#0a0606' },
    joints: {
      neckBase: [0, 0.16, 0.20], neckTop: [0, 0.22, 0.23],
      shoulder: [0.09, 0.10, 0.11], elbow: [0.10, 0.09, 0.06], carpus: [0.095, 0.12, 0.025], forePaw: [0.095, 0.125, 0.01], foreToe: [0.095, 0.16, 0.007],
      hip: [0.11, -0.28, 0.13], stifle: [0.13, -0.20, 0.07], hock: [0.13, -0.30, 0.03], hindPaw: [0.13, -0.29, 0.01], hindToe: [0.13, -0.20, 0.007],
    },
    // a long even loaf, level-backed, blunt at the rump, the belly low
    torso: [
      { at: [0, -0.44, 0.17], r: [0.12, 0.10] },
      { at: [0, -0.38, 0.17], r: [0.18, 0.155] },
      { at: [0, -0.24, 0.17], r: [0.20, 0.165] },
      { at: [0, -0.08, 0.17], r: [0.195, 0.16] },
      { at: [0, 0.06, 0.17], r: [0.175, 0.15] },
      { at: [0, 0.16, 0.17], r: [0.14, 0.13] },
    ],
    torsoCaps: { back: [0, -0.49, 0.17], tip: [0, 0.21, 0.18] },
    neckRA: [0.14, 0.13], neckRB: [0.125, 0.12], neckRMid: [0.13, 0.125],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.035, 0.045], [0.022, 0.024], 'Coat', [0.6, 0.5]],
      ['foreArmR', 'elbow', 'carpus', [0.022, 0.024], [0.016, 0.017], 'Belly', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.016, 0.015, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.02, 0.01], [0.02, 0.007], 'Sock', [0.6, 0.4]],
      ['thighR', 'hip', 'stifle', [0.06, 0.07], [0.035, 0.038], 'Coat', [0.2, 0.5], [0.05, 0.06]],
      ['shinR', 'stifle', 'hock', [0.03, 0.033], [0.018, 0.02], 'Belly', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.018, 0.016, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.02, 0.012], [0.02, 0.008], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ],
    // a big deep head, the muzzle blunt and deep (the Roman nose), not pointed
    headScale: 0.8, muzzleLen: 0.75, muzzleW: 1.2,
    headRelative: 0.52, relBrow: true, eyeAt: [2.2, 2.0], eyeR: 0.03, nose: false, headOrnaments: [], headPitch: -6,
    // small petal ears, low on the side of the crown, drooping out and down
    earAt: [1.1, 2.4], earDrop: 70, earH: 0.6, earR: [0.04, 0.06, 0.06, 0.04], earSquash: [1, 0.2],
    extraSegments: [],
    // the patched coat: a white blaze over the middle, a dark saddle on the rump, the belly pale
    markings: [
      { on: ['torso', 'neck'], kind: 'belly', from: 0.7, group: 'Belly' },
      { on: 'torso', kind: 'band', run: [0.38, 0.6], t: [0, 0.7], group: 'Belly' },
      { on: 'torso', kind: 'band', run: [0, 0.3], t: [0, 0.55], caps: ['back'], group: 'Tip' },
    ],
  },  // EUROPEAN HEDGEHOG (Erinaceus europaeus) — an insectivore (Eulipotyphla), NOT a rodent: the roster files it here
  // because its build is a rodent's (a small round low body on short plantigrade legs). Thesis: a DOMED ROUND body, low
  // to the ground, the legs hidden under a skirt of fur · ONE signature: a coat of SPINES over the whole back and crown,
  // banded cream and dark brown, raked back · a pointed tapering snout with a dark nose, small dark eyes, small round
  // ears half in the spines · a pale brown face and underside · published: head-body 20–30 cm, tail ~2 cm, 0.4–1.2 kg
  // (Animal Diversity Web, Erinaceus europaeus).
  hedgehog: {
    eyeStyle: 'set',
    family: 'rodent', name: 'a European hedgehog', scale: 0.272,
    colors: { coat: '#8a6c50', sock: '#5a4232', ash: '#b39878', ashAlt: '#a38a6a', ears: '#7a5c44', belly: '#a88c6c',
      mane: '#d8ccb4', tip: '#4a3626', snout: '#9a7c5e', teeth: '#e8d6a8', brow: '#5a4232', mouth: '#4a3626', nose: '#1a1310', iris: '#050404', sclera: '#050404' },
    joints: {
      neckBase: [0, 0.16, 0.17], neckTop: [0, 0.24, 0.17],
      shoulder: [0.09, 0.10, 0.11], elbow: [0.10, 0.09, 0.06], carpus: [0.095, 0.12, 0.025], forePaw: [0.095, 0.125, 0.01], foreToe: [0.095, 0.16, 0.007],
      hip: [0.10, -0.24, 0.12], stifle: [0.12, -0.17, 0.07], hock: [0.12, -0.26, 0.03], hindPaw: [0.12, -0.25, 0.01], hindToe: [0.12, -0.17, 0.007],
    },
    // a high dome: deepest and tallest mid-back, the skirt of the coat hanging near the ground
    torso: [
      { at: [0, -0.38, 0.17], r: [0.10, 0.09] },
      { at: [0, -0.31, 0.17], r: [0.19, 0.17] },
      { at: [0, -0.17, 0.17], r: [0.23, 0.21] },
      { at: [0, -0.02, 0.17], r: [0.225, 0.20] },
      { at: [0, 0.10, 0.17], r: [0.18, 0.16] },
      { at: [0, 0.18, 0.17], r: [0.12, 0.11] },
    ],
    torsoCaps: { back: [0, -0.43, 0.17], tip: [0, 0.23, 0.17] },
    neckRA: [0.12, 0.11], neckRB: [0.09, 0.085], neckRMid: [0.105, 0.10],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.035, 0.045], [0.022, 0.024], 'Belly', [0.6, 0.5]],
      ['foreArmR', 'elbow', 'carpus', [0.022, 0.024], [0.016, 0.017], 'Sock', [0.5, 0.4]],
      ['pasternR', 'carpus', 'forePaw', 0.016, 0.015, 'Sock', [0.4, 0.4]],
      ['forePawR', 'forePaw', 'foreToe', [0.02, 0.01], [0.02, 0.007], 'Sock', [0.6, 0.4]],
      ['thighR', 'hip', 'stifle', [0.06, 0.07], [0.035, 0.038], 'Belly', [0.2, 0.5], [0.05, 0.06]],
      ['shinR', 'stifle', 'hock', [0.03, 0.033], [0.018, 0.02], 'Sock', [0.5, 0.4]],
      ['metaR', 'hock', 'hindPaw', 0.018, 0.016, 'Sock', [0.4, 0.4]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.02, 0.012], [0.02, 0.008], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
    ],
    // a pointed snout, long and tapering to a dark nose tip
    headScale: 0.62, muzzleLen: 1.15, muzzleW: 0.75,
    headRelative: 0.52, relBrow: true, eyeAt: [2.4, 2.2], eyeR: 0.022, nose: false, headOrnaments: [], headPitch: -4,
    headPalette: { Snout: '#9a7c5e' },
    // small round ears, low at the edge of the spines
    earAt: [1.2, 2.0], earSpine: [[0, 0, -0.012], [0, -0.008, 0.03], [0, -0.016, 0.06], [0, -0.022, 0.08]], earH: 0.7, earR: [0.035, 0.045, 0.04], earSquash: [1, 0.3],
    extraSegments: [],
    // the SPINES: raked-back narrow cones over the whole back and down the flanks, banded cream and dark; a second
    // patch over the neck and crown
    bodyTiles: [
      { id: 'spines', parts: ['torso'], s: [0.3, 5.0], t: [0, 3.9], grid: [17, 9], brick: true, sides: 3, coverage: 1.25, inset: 0.97, height: 0.019, lean: -1.4, edgeFade: 0.15, thin: 0, wobble: 0.3, jitter: 0.35, group: ['Mane', 'Tip'] },
      { id: 'neckSpines', parts: ['neck'], s: [0.0, 1.0], t: [0, 2.8], grid: [4, 5], brick: true, sides: 3, coverage: 1.25, inset: 0.97, height: 0.016, lean: -1.4, edgeFade: 0.2, thin: 0, wobble: 0.3, jitter: 0.35, group: ['Mane', 'Tip'] },
    ],
    markings: [{ on: 'torso', kind: 'belly', from: 0.75, group: 'Belly' }],
  },  // NORTH AMERICAN PORCUPINE (Erethizon dorsatum). Thesis: a HEAVY round-backed body, the back arched high over the
  // hips, on short bowed plantigrade legs · a small blunt head with a short deep muzzle, small dark eyes and tiny ears
  // lost in the fur · ONE signature: LONG QUILLS, cream with dark tips, standing off the back, rump and the short
  // thick tail, raked back; shorter ones over the crown · dark brown-black underfur · published: total length
  // 0.65–1.03 m, tail 0.15–0.30 m, 3.5–7 kg (Woods 1973, Mammalian Species 29, Erethizon dorsatum). Modelled on the
  // beaver's tables at `scale` 0.75.
  porcupine: {
    eyeStyle: 'set',
    family: 'rodent', name: 'a North American porcupine', scale: 0.75,
    colors: { coat: '#2f2925', sock: '#1d1916', ash: '#4a423a', ashAlt: '#3e3731', ears: '#2f2925', belly: '#3a332d', brow: '#1d1916',
      mane: '#e2d8c2', tip: '#1a1613', snout: '#3a332d', teeth: '#d9a24a', mouth: '#1d1916', nose: '#120e0c', iris: '#0a0806', sclera: '#0a0806' },
    joints: {
      neckBase: [0, 0.17, 0.20], neckTop: [0, 0.25, 0.21],
      hip: [0.10, -0.24, 0.21], stifle: [0.135, -0.15, 0.12], hindToe: [0.13, -0.13, 0.008],
    },
    // the hind foot a narrow plantigrade sole, not the beaver's webbed fan
    legs: [...family.legs.slice(0, 7), ['hindPawR', 'hindPaw', 'hindToe', [0.03, 0.02], [0.03, 0.012], 'Sock', [0.5, 0.4]]],
    // the arch: the trunk deepest and highest over the hips, falling to a low narrow chest
    torso: [
      { at: [0, -0.42, 0.20], r: [0.09, 0.09] },
      { at: [0, -0.34, 0.20], r: [0.17, 0.17] },
      { at: [0, -0.21, 0.20], r: [0.20, 0.20] },
      { at: [0, -0.07, 0.20], r: [0.18, 0.17] },
      { at: [0, 0.06, 0.20], r: [0.14, 0.13] },
      { at: [0, 0.16, 0.20], r: [0.10, 0.10] },
    ],
    torsoCaps: { back: [0, -0.48, 0.20], tip: [0, 0.21, 0.20] },
    neckRA: [0.10, 0.10], neckRB: [0.08, 0.08], neckRMid: [0.09, 0.09],
    // a small blunt head, the incisors orange
    headScale: 0.42, muzzleW: 1.1, muzzleLen: 0.7, headPitch: -8,
    headRelative: 0.52, relBrow: true, eyeAt: [2.3, 2.2], eyeR: 0.022,
    earR: [0.035, 0.03, 0.02, 0.01], earH: 0.25,
    extraSegments: [
      // the tail: short, thick, round, held low off the rump
      { name: 'tailQuilled', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane',
        stations: lofted([[0, -0.44, 0.17, 0.075], [0, -0.52, 0.13, 0.07], [0, -0.60, 0.10, 0.06], [0, -0.67, 0.08, 0.045]]),
        caps: { back: [0, -0.42, 0.18], tip: [0, -0.71, 0.07] } },
    ],
    // the QUILLS: long narrow cones raked back over the back, flanks and rump, the tail's top, a short crest at the neck
    bodyTiles: [
      { id: 'quills', parts: ['torso'], s: [0.2, 4.6], t: [0, 3.6], grid: [11, 6], brick: true, sides: 3, coverage: 1.3, inset: 0.97, height: 0.075, lean: -1.8, edgeFade: 0.25, thin: 0, wobble: 0.35, jitter: 0.35, group: ['Mane', 'Mane', 'Tip'] },
      { id: 'tailQuills', parts: ['tailQuilled'], s: [0, 3], t: [0, 3.2], grid: [4, 3], brick: true, sides: 3, coverage: 1.3, inset: 0.97, height: 0.05, lean: -1.8, edgeFade: 0.2, thin: 0, wobble: 0.3, jitter: 0.3, group: ['Mane', 'Tip'] },
      { id: 'crest', parts: ['neck'], s: [0, 1], t: [0, 2.4], grid: [3, 3], brick: true, sides: 3, coverage: 1.3, inset: 0.97, height: 0.04, lean: -1.8, edgeFade: 0.2, thin: 0, wobble: 0.3, jitter: 0.3, group: ['Mane', 'Tip'] },
    ],
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  beaver: { common: 'beaver', aliases: [], sci: 'Castor canadensis', size: '~0.30 m at the shoulder; head-body 0.74–0.90 m', source: 'ADW / Smithsonian NMNH' },
  squirrel: { common: 'squirrel', aliases: ['grey squirrel', 'gray squirrel'], sci: 'Sciurus carolinensis', size: '~0.12 m to the top of the back; head-body 0.23–0.30 m', source: 'ADW, Sciurus carolinensis' },
  mouse: { common: 'mouse', aliases: ['mice', 'house mouse', 'field mouse'], sci: 'Mus musculus', size: 'head-body 0.065–0.095 m, tail 0.06–0.105 m', source: 'ADW, Mus musculus' },
  rat: { common: 'rat', aliases: ['brown rat'], sci: 'Rattus norvegicus', size: 'head-body 0.20–0.28 m, tail 0.17–0.23 m', source: 'ADW, Rattus norvegicus' },
  hamster: { common: 'hamster', aliases: ['syrian hamster', 'golden hamster'], sci: 'Mesocricetus auratus', size: 'head-body 0.13–0.18 m, tail ~0.012 m', source: 'ADW, Mesocricetus auratus' },
  guineaPig: { common: 'guinea pig', aliases: ['cavy'], sci: 'Cavia porcellus', size: 'head-body 0.20–0.25 m, no external tail', source: 'ADW, Cavia porcellus' },
  hedgehog: { common: 'hedgehog', aliases: ['european hedgehog'], sci: 'Erinaceus europaeus', size: 'head-body 0.20–0.30 m', source: 'ADW, Erinaceus europaeus' },
  porcupine: { common: 'porcupine', aliases: ['north american porcupine'], sci: 'Erethizon dorsatum', size: 'total length 0.65–1.03 m, tail 0.15–0.30 m', source: 'Woods 1973, Mammalian Species 29' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
};
