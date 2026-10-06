// SAUROPOD — a deep barrel trunk on four straight COLUMNAR legs (elephantine: near-vertical limb bones, round padded
// feet), a VERY long neck on a long trunk, a SMALL head, a long tail on stable rings. Authored in metres at
// brachiosaurus size; the diplodocus re-draws the trunk level-to-hip-high with a level neck and a whip tail. The head
// starts from the testudine's small blunt reptile skull (re-scaled, headRelative). See ../build.js for every field.
import { family as testudine } from './testudine.js';

const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));
const HEAD = Object.fromEntries(['craniumRows', 'craniumCaps', 'muzzleFrom', 'jawRows', 'jawCaps', 'skinControls', 'nape', 'eyeAt', 'eyeR', 'orbit', 'pupil', 'irisAngle',
  'browStrip', 'foldStrip', 'nostrilAt', 'noseAt', 'noseR', 'webCranium', 'nose', 'ears', 'earAt', 'earSpine', 'earR', 'earSquash', 'earH'].map((k) => [k, testudine[k]]));
// columnar legs: [upper, lower, column, pad] radii, the pad a broad flat round foot
const legRows = (u, l, c, pad) => [
  ['upperArmR', 'shoulder', 'elbow', [u * 1.1, u * 1.2], [l, l], 'Coat', [0.6, 0.5], [u, u * 1.1]],
  ['foreArmR', 'elbow', 'carpus', [l, l], [c, c], 'Coat', [0.5, 0.4]],
  ['pasternR', 'carpus', 'forePaw', c, c * 1.1, 'Sock', [0.4, 0.4]],
  ['forePawR', 'forePaw', 'foreToe', [pad, pad * 0.5], [pad * 0.9, pad * 0.4], 'Hoof', [0.5, 0.4], null, { up: [0, 0, 1] }],
  ['thighR', 'hip', 'stifle', [u * 1.3, u * 1.5], [l * 1.1, l * 1.1], 'Coat', [0.2, 0.5], [u * 1.2, u * 1.35]],
  ['shinR', 'stifle', 'hock', [l * 1.1, l * 1.1], [c * 1.05, c * 1.05], 'Coat', [0.5, 0.4]],
  ['metaR', 'hock', 'hindPaw', c * 1.05, c * 1.15, 'Sock', [0.4, 0.4]],
  ['hindPawR', 'hindPaw', 'hindToe', [pad * 1.1, pad * 0.5], [pad, pad * 0.4], 'Hoof', [0.5, 0.4], null, { up: [0, 0, 1] }],
];

export const family = {
  ...HEAD,
  family: 'sauropod',
  colors: {
    coat: '#7a7464', sock: '#6c665a', ash: '#9a9280', ashAlt: '#857d6c', brow: '#55503f', iris: '#2a2216',
    ink: '#0f0d0a', sclera: '#2a2216', nose: '#3a3630', teeth: '#d8d0b8', mouth: '#6a4c44', tip: '#5d584a',
    hoof: '#4a463c', belly: '#b0a890', snout: '#8a8370',
  },
  // brachiosaurus: the forelegs LONGER than the hind, so the back slopes up to high withers
  joints: {
    neckBase: [0, 2.7, 5.6], neckTop: [0, 6.6, 11.9],
    shoulder: [0.85, 2.1, 4.9], elbow: [0.95, 2.2, 3.1], carpus: [0.92, 2.3, 1.2], forePaw: [0.92, 2.35, 0.32], foreToe: [0.92, 2.6, 0.29],
    hip: [0.80, -2.9, 3.6], stifle: [0.92, -2.6, 2.1], hock: [0.88, -3.0, 0.9], hindPaw: [0.88, -2.95, 0.32], hindToe: [0.88, -2.65, 0.29],
  },
  torsoUp: true,
  torso: [
    { at: [0, -3.7, 3.55], r: [0.70, 0.75] },
    { at: [0, -2.8, 3.70], r: [1.10, 1.10] },
    { at: [0, -1.5, 4.10], r: [1.35, 1.35] },
    { at: [0, 0.0, 4.55], r: [1.40, 1.45] },
    { at: [0, 1.5, 4.90], r: [1.30, 1.35] },
    { at: [0, 2.6, 5.05], r: [1.00, 1.05] },
  ],
  torsoCaps: { back: [0, -4.1, 3.55], tip: [0, 3.1, 5.2] },
  neckRA: [1.04, 1.24], neckRB: [0.28, 0.32], neckRMid: [0.45, 0.52],
  tail: null, tip: null,
  tailStations: [[-3.6, 3.8, [0.90, 0.92]], [-4.5, 3.5, [0.65, 0.68]], [-5.5, 3.1, [0.44, 0.46]], [-6.4, 2.7, [0.24, 0.25]], [-7.1, 2.4, [0.08, 0.08]]],
  tailCaps: { back: [0, -3.3, 3.9], tip: [0, -7.3, 2.3] },
  legs: legRows(0.42, 0.36, 0.32, 0.42),
  levelLegs: false,
  // a small blunt head (the testudine rows) at ~0.9 m long
  headScale: 2.2, headRelative: true, headPitch: 0,
  muzzleW: 1.1, muzzleLen: 0.8,
  headTiles: [], bodyTiles: [],
  scale: 1,
};
family.extraSegments = [
  { name: 'tailLoft', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(family.tailStations), caps: family.tailCaps },
];

export const species = {
  // BRACHIOSAURUS (Brachiosaurus altithorax). Thesis: a deep trunk whose back SLOPES UP to high withers because the
  // FORELEGS are longer than the hind · straight columnar legs on round padded feet · a very long neck raised steeply
  // · a small head with a domed nasal arch · a SHORT, thick tail · ~6 m at the shoulder, ~12–13 m to the head, ~22 m
  // long (Taylor 2009, J. Vert. Paleontol. 29:787–806, Brachiosaurus / Giraffatitan reconstructions).
  brachiosaurus: {
    family: 'sauropod', name: 'a brachiosaurus', scale: 1,
    // the domed NASAL ARCH: the skull roof raised over and in front of the eyes (top and crown z of rows st1–st4)
    craniumRows: testudine.craniumRows.map(([id, y, top, crown, ...rest]) => { const k = { st1: 0.02, st2: 0.045, st3: 0.06, st4: 0.03 }[id] || 0;
      return [id, y, top + k, [crown[0], crown[1] + k], ...rest]; }),
  },

  // DIPLODOCUS (Diplodocus carnegii). Thesis: a long LOW body, the hips the highest point (forelegs shorter than the
  // hind) · columnar legs · a very long neck carried near LEVEL · a tiny long low head · an extremely long tail
  // tapering to a WHIP · ~26 m long, ~3.5–4 m at the hip (Carnegie Museum CM 84 / Hatcher 1901; Paul 2016: ~24–26 m).
  diplodocus: {
    family: 'sauropod', name: 'a diplodocus', scale: 1,
    joints: {
      neckBase: [0, 3.0, 3.35], neckTop: [0, 9.6, 3.6],
      shoulder: [0.70, 2.4, 2.9], elbow: [0.78, 2.5, 1.8], carpus: [0.75, 2.6, 0.7], forePaw: [0.75, 2.62, 0.25], foreToe: [0.75, 2.85, 0.22],
      hip: [0.70, -2.4, 3.2], stifle: [0.80, -2.1, 1.95], hock: [0.76, -2.5, 0.75], hindPaw: [0.76, -2.45, 0.25], hindToe: [0.76, -2.15, 0.22],
    },
    torso: [
      { at: [0, -3.1, 3.20], r: [0.60, 0.70] },
      { at: [0, -2.3, 3.20], r: [0.95, 1.00] },
      { at: [0, -1.0, 3.10], r: [1.10, 1.15] },
      { at: [0, 0.4, 3.00], r: [1.10, 1.10] },
      { at: [0, 1.8, 2.95], r: [0.95, 0.95] },
      { at: [0, 2.9, 3.05], r: [0.70, 0.75] },
    ],
    torsoCaps: { back: [0, -3.5, 3.25], tip: [0, 3.3, 3.15] },
    neckRA: [0.65, 0.75], neckRB: [0.20, 0.24], neckRMid: [0.36, 0.42],
    tailStations: [[-3.0, 3.5, [0.55, 0.65]], [-5.0, 3.35, [0.42, 0.50]], [-7.5, 3.0, [0.28, 0.32]], [-10.0, 2.55, [0.16, 0.18]],
      [-12.5, 2.1, [0.08, 0.09]], [-14.5, 1.75, [0.04, 0.045]], [-16.3, 1.45, [0.02, 0.02]]],
    tailCaps: { back: [0, -2.7, 3.5], tip: [0, -16.6, 1.4] },
    legs: legRows(0.34, 0.29, 0.26, 0.36),
    headScale: 1.7, headPitch: -8, muzzleW: 0.9, muzzleLen: 1.5,
  },
};
species.diplodocus.extraSegments = [
  { name: 'tailLoft', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(species.diplodocus.tailStations), caps: species.diplodocus.tailCaps },
];
