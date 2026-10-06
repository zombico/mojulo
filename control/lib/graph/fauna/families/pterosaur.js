// PTEROSAUR — flying reptiles (not dinosaurs). A tiny trunk, a long neck, a HUGE head (a long toothless beak and, in
// pteranodontids, a tall crest swept back off the skull), and the forelimbs are WINGS: the bat / dragon membrane op
// (wing.js) with the pterosaur's one difference — the membrane (brachiopatagium) is carried by ONE enormous fourth
// finger on a very long metacarpal, from the wing tip back to the body and hind limb; the three small clawed fingers
// sit free at the knuckle, and a PTEROID bone at the wrist points back toward the shoulder along the leading edge.
// The family pose stands QUADRUPEDAL on the folded wings: each metacarpal planted near-vertical as a front leg (the
// knuckle on the ground), the wing finger folded back and up along the flank, the short hind legs plantigrade.
// `wings.fold` 0 spreads them (span at true scale). Tables are authored in metres at Pteranodon size.
// Worked species: Pteranodon longiceps.

const lerp = (a, b, t) => a + (b - a) * t;

/** A PTEROSAUR membrane wing as data for wing.js (buildWing): humerus, forearm, a long metacarpal IV, ONE wing-finger
 * ray (digit IV) carrying the membrane with the body ray (the membrane's root along the flank to the hind limb), a
 * free pteroid at the wrist pointing back toward the shoulder, three small clawed fingers at the knuckle. Lengths in
 * metres (Pteranodon), `fold` pose angles in degrees (wing plane: 0 = down the flank, 90 = forward, ±180 = up). */
export function pterosaurWing({ humerus = 0.27, forearm = 0.45, metacarpal = 0.6, finger = 1.85, body = 0.55, boneR = 1,
  fold = { humerus: -158, forearm: 178, metacarpal: -22, finger: 128, body: -78 }, sag = 0.22 } = {}) {
  const R = (a) => a.map((x) => x * boneR);
  return { girdle: 'torso', boneGroup: 'WingBone', surface: 'membrane',
    arm: [
      { id: 'wingHumerus', len: humerus, spread: 8, folded: fold.humerus, r: R([0.035, 0.026]) },
      { id: 'wingForearm', len: forearm, spread: -12, folded: fold.forearm, r: R([0.026, 0.02]) },
      { id: 'wingMetacarpal', len: metacarpal, spread: -6, folded: fold.metacarpal, r: R([0.02, 0.016]) },
    ],
    rays: [
      { name: 'body', bone: 0, at: 0, angle: 100, foldAngle: fold.body, len: body },
      { digit: 'IV', bone: 2, at: 1, angle: 14, foldAngle: fold.finger, len: finger, r: R([0.018, 0.004]), phalanges: 4, offset: 0.01 },
      { digit: 'P', bone: 1, at: 1, angle: -165, foldAngle: -170, len: 0.2, r: R([0.01, 0.003]), phalanges: 1 },
      { digit: 'I', bone: 2, at: 0.97, angle: -70, foldAngle: -80, len: 0.07, r: R([0.008, 0.005]), phalanges: 2, claw: 0.03 },
      { digit: 'II', bone: 2, at: 0.97, angle: -55, foldAngle: -95, len: 0.08, r: R([0.008, 0.005]), phalanges: 2, claw: 0.03 },
      { digit: 'III', bone: 2, at: 0.97, angle: -40, foldAngle: -110, len: 0.09, r: R([0.008, 0.005]), phalanges: 2, claw: 0.03 },
    ],
    membrane: { order: [0, 1], sag: [sag], sub: 14, along: [0, 0.12, 0.28, 0.46, 0.66, 0.84, 1], thickness: 0.004, root: 3, bone: 0.006,
      groups: { top: 'MembraneBack', under: 'MembraneUnder', rim: 'MembraneRim', vein: 'Vein' } },
    frame: { spread: { S: [1, 0, -0.05], C: [0, 1, 0] }, folded: { S: [0.3, 0, -1], C: [0, 1, 0] } } };
}

const WING_PALETTE = { MembraneBack: '#6b4a3a', MembraneUnder: '#8a6a55', MembraneRim: '#4a3328', Vein: '#7a5848', WingBone: '#c9bba0', Claw: '#2a2420' };

// the canine skull rows, drawn out into the long narrow beak by muzzleW / muzzleLen
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
// the CREST: a thin midline sweep off the back of the skull roof, back and up (head units, pin-local: −x back, z up)
export const crest = ({ at = 0.6, len = 0.9, rise = 0.22, root = 0.08, flat = 0.12 } = {}) => ({ kind: 'sweep', name: 'crest', at: [at, 0.0001], side: 'R', space: 'local',
  spine: [0, 0.25, 0.5, 0.75, 1].map((t) => [-len * t, 0, -0.045 + rise * Math.sin(t * Math.PI / 2) ** 0.8 + 0.02 * (1 - t)]),
  radii: [0, 0.25, 0.5, 0.75, 1].map((t) => lerp(root, 0.006, t ** 1.2)), m: 8, squash: [flat, 1], group: 'Crest' });

export const family = {
  family: 'pterosaur',
  colors: {
    coat: '#b8a58a', sock: '#8e7a62', ash: '#d8ccb6', ashAlt: '#cdbfa6', brow: '#8e7a62', iris: '#2a1c10',
    ink: '#0d0a08', sclera: '#1d1510', nose: '#3a2c20', teeth: '#e7e0cc', mouth: '#9a6a5a', tip: '#8e7a62',
    hoof: '#3a2c20', ears: '#b8a58a', belly: '#e2d8c4', snout: '#d9c79a',
  },
  joints: {
    neckBase: [0, 0.2, 0.86], neckTop: [0, 0.42, 1.08], wingRoot: [0.07, 0.14, 0.84],
    // the hind legs: short, knee forward and out, the foot plantigrade under the hip
    hip: [0.06, -0.22, 0.76], stifle: [0.14, -0.08, 0.48], hock: [0.15, -0.26, 0.07], hindPaw: [0.15, -0.24, 0.02], hindToe: [0.16, -0.08, 0.01],
  },
  torso: [
    { at: [0, -0.30, 0.82], r: [0.06, 0.06] },
    { at: [0, -0.18, 0.82], r: [0.10, 0.11] },
    { at: [0, -0.02, 0.82], r: [0.12, 0.13] },
    { at: [0, 0.12, 0.82], r: [0.11, 0.12] },
    { at: [0, 0.22, 0.82], r: [0.07, 0.08] },
  ],
  torsoCaps: { back: [0, -0.36, 0.82], tip: [0, 0.27, 0.84] },
  neckRA: [0.08, 0.08], neckRB: [0.06, 0.06], neckRMid: [0.07, 0.07],
  tail: [[0, -0.32, 0.82, 0.03], [0, -0.42, 0.8, 0.015]], tip: null,
  legs: [
    ['thighR', 'hip', 'stifle', 0.05, 0.035, 'Coat', [0.4, 0.4]],
    ['shinR', 'stifle', 'hock', 0.03, 0.02, 'Coat', [0.4, 0.3]],
    ['metaR', 'hock', 'hindPaw', 0.02, 0.02, 'Sock', [0.3, 0.3]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.035, 0.01], [0.03, 0.006], 'Hoof', [0.3, 0.2]],
  ],
  levelLegs: true,
  craniumRows: SKULL, craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.03] }, muzzleFrom: 3,
  jawRows: JAW, jawCaps: { back: [0, -0.1, -0.095], tip: [0, 0.21, -0.05] },
  muzzleW: 0.5, muzzleLen: 4.2,
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 1.5, headRelative: 1.2, nape: [0, -0.1, -0.05], headPitch: -8,
  eyeAt: [2.4, 2.1], eyeR: 0.022, pupil: 'round', irisAngle: 40, orbitFallback: true,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [4.2, 1.6], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: [crest()], headPalette: { Crest: '#a8442c' },
  headTiles: [], bodyTiles: [],
  wings: { wing: pterosaurWing(), at: 'wingRoot', fold: 1, core: 0.03, palette: WING_PALETTE },
  scale: 1,
};

export const species = {
  // PTERANODON (Pteranodon longiceps), Late Cretaceous, Niobrara Chalk. Thesis: a quadrupedal stance on the folded
  // wings — the long metacarpals planted as front legs, the wing fingers folded back and up past the body like two
  // tall struts · a tiny trunk on short hind legs · a HUGE head: a long, straight, TOOTHLESS pointed beak and a tall
  // CREST swept back off the skull, so the head reads as a long double-ended pick · wingspan ~6.25 m in a large male
  // (Bennett 2001, "The osteology and functional morphology of the Late Cretaceous pterosaur Pteranodon", Palaeontographica
  // A 260: adult males ~5.6 m average, the largest ~6.25 m; skull with crest ~1.5–1.8 m).
  // kept v4 (blind judges, both orders: A v4 over v3 75/70%; B v4 over v1 72/68%)
  pteranodon: { family: 'pterosaur', name: 'a Pteranodon', scale: 1 },
};
