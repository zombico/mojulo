// PLESIOSAUR — marine reptiles (not dinosaurs), in a SWIM pose (`pose: 'swim'`: suspended above the floor, sized by
// total length). A broad, FLAT, turtle-like trunk (wider than deep), FOUR large flipper paddles of near-equal size
// (each a thin flat closed loft on the `legs` rows, root → mid → tip, swept back), a short tapering tail, and in the
// long-necked elasmosaurids a VERY long neck (over half the total length, here a level loft on stable rings rising a
// little toward the head) ending in a SMALL head with a row of needle teeth along the lip. No ears, no nose pad.
// Tables are authored in metres at Elasmosaurus size. Worked species: Elasmosaurus platyurus.

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
// the teeth: long needle cones along the lip line (mirrored to both sides)
const teeth = (rows, slot, len) => rows.map((r, i) => ({ kind: 'sweep', name: `tooth${i}`, at: [r, slot], space: 'local', spine: [[0, 0, -0.004], [0, 0, len * (i % 2 ? 0.75 : 1)]], radii: [0.006, 0.0012], m: 6, group: 'Teeth' }));
const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));

export const family = {
  family: 'plesiosaur', pose: 'swim',
  colors: {
    coat: '#4f5a5e', sock: '#454f53', ash: '#c9c6b4', ashAlt: '#b9b6a4', brow: '#3c4548', iris: '#1a1a14',
    ink: '#0c0d0e', sclera: '#20221c', nose: '#2e3335', teeth: '#ece6d2', mouth: '#9b6e64', tip: '#3c4548',
    hoof: '#3c4548', belly: '#cfcbb8',
  },
  joints: {
    neckBase: [0, 6.62, 2.56], neckTop: [0, 6.9, 2.58],
    // the flippers: root on the flank low on the trunk, swept back and a little down, lying flat
    foreRoot: [0.75, 0.55, 1.9], foreMid: [1.3, 0.25, 1.83], foreTip: [2.05, -0.2, 1.78],
    hindRoot: [0.7, -0.65, 1.9], hindMid: [1.15, -0.95, 1.83], hindTip: [1.8, -1.35, 1.79],
  },
  torso: [
    { at: [0, -1.25, 2.0], r: [0.4, 0.3] },
    { at: [0, -0.7, 2.0], r: [0.84, 0.48] },
    { at: [0, 0.0, 2.0], r: [1.05, 0.55] },
    { at: [0, 0.7, 2.0], r: [0.84, 0.48] },
    { at: [0, 1.15, 2.0], r: [0.45, 0.34] },
  ],
  torsoCaps: { back: [0, -1.55, 2.0], tip: [0, 1.35, 2.02] },
  neckRA: [0.13, 0.13], neckRB: [0.11, 0.11], neckRMid: [0.12, 0.12],
  tail: null, tip: null,
  legs: [
    ['foreFlipR', 'foreRoot', 'foreMid', [0.43, 0.06], [0.36, 0.045], 'Coat', [0.3, 0.2]],
    ['foreTipR', 'foreMid', 'foreTip', [0.36, 0.045], [0.07, 0.015], 'Coat', [0.2, 0.4]],
    ['hindFlipR', 'hindRoot', 'hindMid', [0.41, 0.06], [0.34, 0.045], 'Coat', [0.3, 0.2]],
    ['hindTipR', 'hindMid', 'hindTip', [0.34, 0.045], [0.07, 0.015], 'Coat', [0.2, 0.4]],
  ],
  levelLegs: true,
  // the head: the canine skull a little flattened, the snout drawn out moderately
  craniumRows: flat(SKULL, 1.2, 0.85), craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.015] }, muzzleFrom: 3,
  jawRows: flatJaw(JAW, 1.2, 0.85), jawCaps: { back: [0, -0.1, -0.06], tip: [0, 0.21, -0.035] },
  muzzleW: 1.0, muzzleLen: 1.35,
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.9, nape: [0, -0.1, -0.03],
  eyeAt: [2.1, 2.0], eyeR: 0.016, orbit: { reach: [0.005, 0.006, 0.007], bulk: [0.001, 0.002], thickness: 0.002 }, pupil: 'round', irisAngle: 40, orbitFallback: true,
  browStrip: [[1.6, 1.4], [1.9, 1.3], [2.2, 1.3], [2.5, 1.4], [2.8, 1.5]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [4.0, 1.0], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: teeth([3.4, 3.9, 4.4, 4.9, 5.4], 5.0, 0.035),
  headTiles: [], bodyTiles: [],
  // the neck [y, z, r] from inside the trunk's front to the head, and the short tail [y, z, [half-width, half-height]]
  neckStations: [[0.9, 2.02, 0.32], [1.6, 2.1, 0.24], [2.6, 2.2, 0.2], [3.6, 2.3, 0.18], [4.6, 2.4, 0.16], [5.6, 2.5, 0.14], [6.7, 2.57, 0.125]],
  tailStations: [[-1.1, 2.0, [0.26, 0.22]], [-1.6, 1.99, [0.18, 0.17]], [-2.05, 1.97, [0.09, 0.09]], [-2.4, 1.95, [0.04, 0.045]], [-2.6, 1.94, [0.015, 0.02]]],
  markings: [{ on: 'torso', kind: 'belly', group: 'Belly', from: 0.62 }],
  scale: 1,
};
family.extraSegments = [
  { name: 'longNeck', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(family.neckStations), caps: { back: [0, 0.75, 2.0], tip: [0, 6.85, 2.58] } },
  { name: 'tailTaper', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(family.tailStations), caps: { back: [0, -1.0, 2.0], tip: [0, -2.7, 1.94] } },
];

export const species = {
  // ELASMOSAURUS (Elasmosaurus platyurus), Late Cretaceous, Western Interior Seaway. Thesis: in black silhouette a
  // SMALL head on a VERY long straight neck (~2/3 of the total length) in front of a broad, flat, turtle-like body ·
  // FOUR big swept-back flipper paddles of near-equal size, lying flat · a short tapering tail · a small skull with
  // needle teeth · ~10.3 m total length, the neck ~7 m (Sachs, Kear & Everhart 2013, PLoS ONE 8(8): e70877, the
  // revised holotype: total length ~10.3 m, 72 cervical vertebrae).
  // kept v4 (blind judges, both orders: A v4 over v2 65/60%; B v4 over v1 60/62%)
  elasmosaurus: { family: 'plesiosaur', name: 'an Elasmosaurus', scale: 1 },
};

export const about = {
  elasmosaurus: { common: 'elasmosaurus', aliases: ['plesiosaur', 'plesiosaurus'], sci: 'Elasmosaurus platyurus', size: '~10.3 m long, the neck ~7 m', source: 'Sachs, Kear & Everhart 2013, PLoS ONE 8: e70877' },
};
