// LEPORID — rabbits and hares: a compact egg-shaped trunk carried HUNCHED at rest (the round rump the high point,
// the haunches folded under it), short straight forelegs, very long flat hind feet lying along the ground from heel
// to toe, a short neck, a rounded head with a short blunt muzzle, large eyes set high on the side of the skull, LONG
// UPRIGHT ears (a head sweep on the crown) and a short upturned scut of a tail (an extra loft, white 'Belly').
// Tables are authored in metres at rabbit size. Worked species: the European rabbit. See ../build.js.

const lofted = (pts) => pts.map(([x, y, z, r]) => ({ at: [x, y, z], r }));

export const family = {
  family: 'leporid',
  colors: {
    coat: '#8a7a64', sock: '#9c8c76', ash: '#c9bba4', ashAlt: '#b8a990', brow: '#5a4a38', iris: '#2a1a10',
    ink: '#0c0907', sclera: '#3a2616', nose: '#6e5a4a', teeth: '#ece6d6', mouth: '#5a4a38', tip: '#2e2620',
    mane: '#8a7a64', snout: '#8a7a64', ears: '#8a7a64', belly: '#ece8de',
  },
  joints: {
    neckBase: [0, 0.10, 0.15], neckTop: [0, 0.135, 0.185],
    shoulder: [0.045, 0.085, 0.115], elbow: [0.05, 0.075, 0.06], carpus: [0.048, 0.10, 0.02], forePaw: [0.048, 0.105, 0.008], foreToe: [0.048, 0.135, 0.006],
    // the hind leg folded flat: thigh forward-down, shin back to a heel on the ground, the long foot flat forward
    hip: [0.05, -0.10, 0.11], stifle: [0.07, -0.02, 0.065], hock: [0.07, -0.125, 0.02], hindPaw: [0.07, -0.115, 0.008], hindToe: [0.07, 0.015, 0.006],
  },
  // level centres; the hunch is in the radii: deep round rump, narrowing to a low chest
  torso: [
    { at: [0, -0.175, 0.11], r: [0.04, 0.05] },
    { at: [0, -0.135, 0.11], r: [0.085, 0.095] },
    { at: [0, -0.07, 0.11], r: [0.095, 0.105] },
    { at: [0, 0.0, 0.11], r: [0.08, 0.075] },
    { at: [0, 0.06, 0.11], r: [0.06, 0.062] },
    { at: [0, 0.10, 0.11], r: [0.046, 0.052] },
  ],
  torsoCaps: { back: [0, -0.195, 0.11], tip: [0, 0.125, 0.11] },
  neckRA: [0.045, 0.05], neckRB: [0.04, 0.042], neckRMid: [0.042, 0.046],
  tail: null, tip: null,
  extraSegments: [
    // the scut: short, round, cocked up off the rump, white
    { name: 'scut', kind: 'loft', slots: 'ring12', group: 'Belly', mirror: 'plane',
      stations: lofted([[0, -0.185, 0.13, 0.022], [0, -0.21, 0.145, 0.028], [0, -0.225, 0.16, 0.02]]), caps: { back: [0, -0.17, 0.125], tip: [0, -0.235, 0.17] } },
  ],
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.025, 0.03], [0.016, 0.018], 'Coat', [0.6, 0.5]],
    ['foreArmR', 'elbow', 'carpus', [0.016, 0.018], [0.012, 0.013], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.012, 0.011, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.013, 0.008], [0.012, 0.006], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.05, 0.06], [0.03, 0.032], 'Coat', [0.2, 0.5], [0.045, 0.05]],
    ['shinR', 'stifle', 'hock', [0.026, 0.028], [0.014, 0.015], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.014, 0.012, 'Sock', [0.4, 0.4]],
    // the long hind foot, flat along the ground
    ['hindPawR', 'hindPaw', 'hindToe', [0.014, 0.01], [0.012, 0.007], 'Sock', [0.5, 0.4], null, { up: [0, 0, 1] }],
  ],
  // skull rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] — a rounded skull, a short blunt deep muzzle
  craniumRows: [
    ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.07, -0.02], [0.06, -0.05], [0.04, -0.07], -0.075],
    ['st1', -0.09, 0.085, [0.03, 0.082], [0.075, 0.05], [0.095, -0.01], [0.085, -0.055], [0.055, -0.08], -0.085],
    ['st2', -0.02, 0.09, [0.035, 0.088], [0.08, 0.05], [0.10, -0.005], [0.09, -0.055], [0.055, -0.082], -0.088],
    ['st3', 0.04, 0.072, [0.03, 0.07], [0.065, 0.035], [0.078, -0.015], [0.072, -0.055], [0.05, -0.078], -0.082],
    ['st4', 0.10, 0.05, [0.03, 0.048], [0.055, 0.02], [0.065, -0.02], [0.062, -0.05], [0.046, -0.072], -0.076],
    ['st5', 0.15, 0.032, [0.025, 0.03], [0.045, 0.008], [0.052, -0.022], [0.05, -0.048], [0.038, -0.066], -0.07],
    ['st6', 0.185, 0.015, [0.016, 0.014], [0.03, -0.002], [0.036, -0.024], [0.034, -0.045], [0.027, -0.06], -0.064],
  ],
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.2, -0.03] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.07, { gum: -0.08, gumR: [0.045, -0.08], jaw: [0.05, -0.1], bottom: -0.112 }],
    ['st1', 0.0, { gum: -0.082, gumR: [0.04, -0.082], jaw: [0.044, -0.1], bottom: -0.108 }],
    ['st2', 0.07, { gum: -0.075, gumR: [0.035, -0.075], jaw: [0.037, -0.09], bottom: -0.097 }],
    ['st3', 0.12, { gum: -0.068, gumR: [0.028, -0.068], jaw: [0.029, -0.08], bottom: -0.085 }],
    ['st4', 0.165, { gum: -0.064, gumR: [0.02, -0.064], jaw: [0.021, -0.072], bottom: -0.076 }],
  ],
  jawCaps: { back: [0, -0.1, -0.095], tip: [0, 0.18, -0.068] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.28, nape: [0, -0.1, -0.04],
  // large eyes, high on the side of the skull
  eyeAt: [2.3, 2.0], eyeR: 0.026, pupil: 'round', irisAngle: 40,
  orbit: { reach: [0.006, 0.007, 0.008], bulk: [0.001, 0.002], thickness: 0.003 },
  orbitFallback: true,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.012, 0.01], webCranium: [1.7, 3.3, 4.97],
  // the long upright ears: tall spoon-shaped sweeps from the back of the crown, raked a little back
  earAt: [1.1, 0.75], earSpine: [[0, 0, -0.012], [0, -0.01, 0.08], [0, -0.025, 0.17], [0, -0.04, 0.25], [0, -0.05, 0.29]],
  earR: [0.022, 0.029, 0.027, 0.014], earSquash: [1, 0.35], earH: 0.32,
  headOrnaments: [],
  headTiles: [],
  bodyTiles: [],
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // EUROPEAN RABBIT (Oryctolagus cuniculus) — the leporid family's worked species. Thesis: a compact egg-shaped
  // body sitting HUNCHED (round rump the high point, chest low) on very long flat hind feet, short straight forelegs ·
  // a rounded head with a blunt muzzle and large eyes high on the side · ONE signature: LONG UPRIGHT EARS (~7 cm) ·
  // a short cocked scut, white beneath · ~0.20 m to the top of the hunched back (published: head-body 34–50 cm, ear
  // 6.5–7.5 cm, hind foot 8.5–9.5 cm, 1.2–2.5 kg — Animal Diversity Web, Oryctolagus cuniculus).
  rabbit: {
    eyeStyle: 'set', // set eye (seated, lidded) beat the goggle orbit in both judge orders, 2026-10-06
    family: 'leporid', name: 'a European rabbit', scale: 1, muzzleLen: 0.85,
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  rabbit: { common: 'rabbit', aliases: ['bunny', 'bunny rabbit', 'european rabbit'], sci: 'Oryctolagus cuniculus', size: '~0.20 m to the top of the hunched back; head-body 0.34–0.50 m', source: 'ADW, Oryctolagus cuniculus' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  hare: { near: 'rabbit', aliases: ['jackrabbit'], note: 'longer legs and longer black-tipped ears than the rabbit' },
};
