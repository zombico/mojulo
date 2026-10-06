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
    family: 'rodent', name: 'a North American beaver', scale: 1,
    muzzleW: 1.15, muzzleLen: 0.75,
    extraSegments: [
      { name: 'tailPaddle', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane',
        // up: a stable ring frame, so the tail drops from the rump and lies flat on the ground with no ring flip
        up: true,
        stations: lofted([[0, -0.34, 0.10, [0.055, 0.04]], [0, -0.42, 0.055, [0.05, 0.025]], [0, -0.48, 0.032, [0.08, 0.018]], [0, -0.55, 0.026, [0.098, 0.018]], [0, -0.62, 0.024, [0.104, 0.017]], [0, -0.68, 0.024, [0.098, 0.016]], [0, -0.73, 0.022, [0.075, 0.014]], [0, -0.76, 0.02, [0.035, 0.008]]]),
        bandGroups: { ...band(7), 'st0-st1': Array(6).fill('Coat') }, caps: { back: [0, -0.31, 0.12], tip: [0, -0.775, 0.02] }, capGroups: { back: 'Coat', tip: 'Tip' } },
    ],
  },
};
