// THEROPOD — a biped dinosaur (birds are the theropods that survived): a near-HORIZONTAL spine balanced over the hips
// by a long STIFF tail held off the ground, the trunk slung forward of the hips, an S-curved neck carrying the head
// ahead of the chest, pillar thighs folding at the knee into a long shin and an inclined metatarsus, DIGITIGRADE
// three-toed feet (II, III, IV forward, a small hallux), short forelimbs. The skull: an archosaur wedge (deep cranium,
// a tooth row along the lip line, no ears, eyes in a high orbit). Tables are authored in metres at Tyrannosaurus
// size (family-level `scale` 1); a species may replace them outright (the velociraptor carries its own at its size).
// The tail is an extra loft on STABLE rings (`up`), laterally narrow, so it never twists as it droops.

const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));
/** The stiff tail: a midline loft [y, z, [half-width, half-height]] on stable rings. */
export const tailLoft = (stations, caps) => ({ name: 'tailStiff', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(stations), caps });
// the teeth: down-pointing cones along the lip line at skull row positions (head ornaments, metres → × the head scale)
export const teeth = (rows, slot, len, r, k) => rows.map((s, i) => ({ kind: 'sweep', name: `tooth${i}`, at: [s, slot], space: 'local',
  spine: [[0, 0, -0.2 * len * k], [0, 0, len * k * (i % 2 ? 0.75 : 1)]], radii: [r * k, 0.25 * r * k], m: 6, group: 'Teeth' }));

// the TYRANNOSAUR skull (head units; × headScale): a deep, broad-backed box (the wide temporal region turns the eyes
// forward) narrowing to a deep, blunt snout; rows [id, y, top, crown, brow, cheek, jowl, lip, palate]
const REX_SKULL = [
  ['st0', -0.15, 0.103, [0.075, 0.098], [0.150, 0.057], [0.165, 0.000], [0.150, -0.057], [0.105, -0.092], -0.09],
  ['st1', -0.08, 0.127, [0.068, 0.121], [0.150, 0.081], [0.173, 0.011], [0.150, -0.057], [0.105, -0.092], -0.09],
  ['st2', -0.01, 0.115, [0.053, 0.109], [0.120, 0.075], [0.135, 0.011], [0.122, -0.057], [0.090, -0.092], -0.085],
  ['st3', 0.06, 0.085, [0.025, 0.08], [0.055, 0.05], [0.065, 0.0], [0.06, -0.045], [0.045, -0.072], -0.078],
  ['st4', 0.13, 0.072, [0.02, 0.068], [0.045, 0.04], [0.05, -0.005], [0.048, -0.045], [0.038, -0.066], -0.07],
  ['st5', 0.20, 0.058, [0.016, 0.054], [0.036, 0.03], [0.04, -0.01], [0.038, -0.042], [0.03, -0.06], -0.064],
  ['st6', 0.26, 0.038, [0.012, 0.035], [0.025, 0.014], [0.027, -0.015], [0.025, -0.038], [0.02, -0.05], -0.054],
];
const REX_JAW = [
  ['st0', -0.10, { gum: -0.09, gumR: [0.085, -0.09], jaw: [0.09, -0.13], bottom: -0.18 }],
  ['st1', 0.0, { gum: -0.085, gumR: [0.07, -0.085], jaw: [0.072, -0.145], bottom: -0.165 }],
  ['st2', 0.10, { gum: -0.074, gumR: [0.05, -0.074], jaw: [0.052, -0.12], bottom: -0.13 }],
  ['st3', 0.20, { gum: -0.066, gumR: [0.038, -0.066], jaw: [0.04, -0.09], bottom: -0.095 }],
  ['st4', 0.25, { gum: -0.058, gumR: [0.026, -0.058], jaw: [0.027, -0.075], bottom: -0.08 }],
];
const SKIN = {
  browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
  browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
  sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
  cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
  cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
};
const REX_HEAD = 3.3;   // the tyrannosaur head scale: ~1.45 m nape cap to snout (FMNH PR 2081's skull is ~1.4 m)

export const family = {
  family: 'theropod',
  colors: {
    coat: '#5e5a3e', sock: '#4f4b34', ash: '#b8ab84', ashAlt: '#a89c76', belly: '#c9bd95', brow: '#3e3b28', iris: '#c99a2e',
    ink: '#120f0a', sclera: '#c99a2e', nose: '#2e2b1f', teeth: '#ece6d2', mouth: '#8e5a4e', tip: '#3e3b28', hoof: '#2a2620',
  },
  joints: {
    neckBase: [0, 2.45, 3.95], neckTop: [0, 3.25, 4.3],
    // the tiny two-fingered forelimb under the chest
    shoulder: [0.5, 2.1, 3.25], elbow: [0.6, 2.2, 2.85], wrist: [0.58, 2.5, 2.78], finger1: [0.52, 2.7, 2.68], finger2: [0.64, 2.68, 2.7],
    // the hind limb: femur forward-down, tibia back-down, the metatarsus inclined forward to the ball of the foot
    hip: [0.5, 0.0, 3.9], knee: [0.62, 0.8, 2.25], ankle: [0.56, -0.1, 0.78], foot: [0.55, 0.3, 0.14],
    toeF: [0.55, 0.95, 0.08], toeI: [0.36, 0.8, 0.08], toeO: [0.74, 0.82, 0.08], toeB: [0.42, 0.2, 0.22],
    clawF: [0.55, 1.18, 0.02], clawI: [0.30, 0.99, 0.02], clawO: [0.82, 1.02, 0.02], clawB: [0.40, 0.3, 0.12],
  },
  torsoUp: true,
  torso: [
    { at: [0, -0.9, 3.9], r: [0.52, 0.56] },
    { at: [0, 0.0, 3.8], r: [0.72, 0.72] },
    { at: [0, 1.0, 3.55], r: [0.86, 0.95] },
    { at: [0, 1.9, 3.6], r: [0.7, 0.8] },
    { at: [0, 2.55, 3.85], r: [0.46, 0.5] },
  ],
  torsoCaps: { back: [0, -1.2, 3.9], tip: [0, 2.85, 3.95] },
  neckRA: [0.48, 0.52], neckRB: [0.36, 0.42], neckRMid: [0.4, 0.46],
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', 0.1, 0.08, 'Coat', [0.5, 0.3]],
    ['foreArmR', 'elbow', 'wrist', 0.08, 0.06, 'Coat', [0.3, 0.3]],
    ['finger1R', 'wrist', 'finger1', 0.045, 0.02, 'Hoof', [0.3, 0.3]],
    ['finger2R', 'wrist', 'finger2', 0.045, 0.02, 'Hoof', [0.3, 0.3]],
    ['thighR', 'hip', 'knee', [0.68, 0.95], [0.34, 0.4], 'Coat', [0.4, 0.4], [0.62, 0.8]],
    ['shinR', 'knee', 'ankle', [0.28, 0.32], [0.12, 0.13], 'Coat', [0.4, 0.3]],
    ['metaR', 'ankle', 'foot', [0.13, 0.12], [0.12, 0.1], 'Sock', [0.3, 0.3]],
    ['toeFR', 'foot', 'toeF', 0.1, 0.07, 'Sock', [0.3, 0.3]],
    ['toeIR', 'foot', 'toeI', 0.09, 0.065, 'Sock', [0.3, 0.3]],
    ['toeOR', 'foot', 'toeO', 0.09, 0.065, 'Sock', [0.3, 0.3]],
    ['toeBR', 'foot', 'toeB', 0.05, 0.035, 'Sock', [0.3, 0.3]],
    ['clawFR', 'toeF', 'clawF', 0.06, 0.012, 'Hoof', [0.3, 0.3]],
    ['clawIR', 'toeI', 'clawI', 0.055, 0.012, 'Hoof', [0.3, 0.3]],
    ['clawOR', 'toeO', 'clawO', 0.055, 0.012, 'Hoof', [0.3, 0.3]],
    ['clawBR', 'toeB', 'clawB', 0.03, 0.008, 'Hoof', [0.3, 0.3]],
  ],
  levelLegs: true,
  craniumRows: REX_SKULL,
  craniumCaps: { back: [0, -0.19, 0.0], tip: [0, 0.285, -0.012] },
  muzzleFrom: 3,
  jawRows: REX_JAW,
  jawCaps: { back: [0, -0.135, -0.11], tip: [0, 0.27, -0.066] },
  skinControls: SKIN,
  headScale: REX_HEAD, headRelative: true, nape: [0, -0.15, -0.02], headPitch: -6,
  // the eye high in the orbit at the back of the skull, set in (the eyeStyle that won the squamates); no ears
  eyeAt: [1.8, 1.55], eyeR: 0.02, eyeStyle: 'set', eyeSet: { sink: 0.55 }, pupil: 'round', irisAngle: 40,
  browStrip: [[1.2, 1.5], [1.5, 1.4], [1.8, 1.4], [2.1, 1.5], [2.4, 1.6]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.7, 1.3], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: teeth([2.4, 2.9, 3.4, 3.9, 4.4, 4.9, 5.4, 5.8], 5.0, 0.03, 0.009, REX_HEAD),
  headTiles: [], bodyTiles: [],
  extraSegments: [tailLoft(
    [[-0.9, 3.9, [0.5, 0.55]], [-1.9, 3.92, [0.4, 0.48]], [-3.1, 3.85, [0.28, 0.36]], [-4.4, 3.72, [0.17, 0.23]], [-5.7, 3.55, [0.09, 0.13]], [-6.8, 3.4, [0.04, 0.06]]],
    { back: [0, -0.6, 3.9], tip: [0, -7.1, 3.37] })],
  markings: [{ on: 'torso', kind: 'belly', from: 0.62, group: 'Belly' }],
  scale: 1,
};

export const species = {
  // TYRANNOSAURUS REX. Thesis: a HUGE horizontal-spined biped balanced over the hips by a long stiff tail · a deep
  // boxy SKULL as long as the thigh, broad at the back so the eyes face forward, a heavy jaw with a tooth row ·
  // a short thick S-neck · MASSIVE thighs, digitigrade three-toed feet · comically TINY two-fingered arms.
  // Size: ~12 m long, hip (acetabulum) ~3.9 m, back over the hips ~4.4 m (Hutchinson et al. 2011, PLoS ONE 6:
  // e26037, "A computational analysis of limb and body dimensions in Tyrannosaurus rex"; Persons et al. 2020,
  // Anat. Rec. 303: 656, "Scotty": ~13 m). Gate: withers (top of the trunk) 4.4 m ±10%.
  tRex: { // kept v3 (judges: v3 over v2 60%/60%, v3 over v1 60%/60%, both orders)
    family: 'theropod', name: 'a Tyrannosaurus rex' },
  // VELOCIRAPTOR MONGOLIENSIS. Thesis: a TURKEY-SIZED, lightly built biped, the spine level and the tail a long
  // straight STIFF rod (ossified rods) held off the ground · a LONG LOW SNOUT, slightly concave on top, with a
  // fine tooth row · FEATHERED (quill knobs on the ulna, Turner et al. 2007, Science 317: 1721): a feather fringe on
  // the long folded arms, a ruff on the neck · the raised SICKLE CLAW on toe II held off the ground, the foot
  // walking on toes III–IV. Size: ~2.0 m long, ~0.5 m at the hip, 15–20 kg (Paul 2016, The Princeton Field Guide to
  // Dinosaurs, 2nd ed.: 2.07 m / 15 kg). Gate: withers (top of the trunk over the hips) 0.58 m ±10%. Authored at size.
  velociraptor: {   // kept v1 (judges split v2/v1 55%/55%: tie → fewer changes)
    family: 'theropod', name: 'a Velociraptor', scale: 1,
    colors: { coat: '#7a5a3a', sock: '#5a4634', ash: '#d8c7a4', ashAlt: '#b89f78', belly: '#e0d2b4', brow: '#3e2c1e', tip: '#2e2218',
      iris: '#d8a630', sclera: '#d8a630', mane: '#4a3624', hoof: '#1e1914' },
    joints: {
      neckBase: [0, 0.36, 0.56], neckTop: [0, 0.47, 0.70],
      // the long arm folded bird-like against the flank: elbow back, the hand forward, three clawed fingers
      shoulder: [0.06, 0.32, 0.50], elbow: [0.085, 0.24, 0.42], wrist: [0.085, 0.36, 0.38], finger1: [0.075, 0.44, 0.355], finger2: [0.095, 0.45, 0.36],
      hip: [0.065, 0.0, 0.50], knee: [0.08, 0.13, 0.29], ankle: [0.075, -0.04, 0.115], foot: [0.07, 0.015, 0.025],
      toeF: [0.07, 0.10, 0.013], toeO: [0.095, 0.09, 0.013], toeB: [0.05, 0.0, 0.04],
      // toe II raised: up and forward off the ground, the sickle claw hooked down in front of it
      toeI: [0.045, 0.06, 0.06], sickle: [0.042, 0.10, 0.075], clawI: [0.04, 0.115, 0.042],
      clawF: [0.07, 0.125, 0.004], clawO: [0.10, 0.11, 0.004], clawB: [0.048, -0.01, 0.025],
    },
    torso: [
      { at: [0, -0.12, 0.51], r: [0.06, 0.065] },
      { at: [0, 0.0, 0.50], r: [0.075, 0.085] },
      { at: [0, 0.14, 0.48], r: [0.085, 0.10] },
      { at: [0, 0.27, 0.50], r: [0.07, 0.08] },
      { at: [0, 0.37, 0.54], r: [0.045, 0.05] },
    ],
    torsoCaps: { back: [0, -0.16, 0.51], tip: [0, 0.41, 0.56] },
    neckRA: [0.04, 0.045], neckRB: [0.028, 0.032], neckRMid: [0.03, 0.035],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', 0.022, 0.017, 'Coat', [0.5, 0.3]],
      ['foreArmR', 'elbow', 'wrist', 0.017, 0.012, 'Coat', [0.3, 0.3]],
      ['finger1R', 'wrist', 'finger1', 0.009, 0.003, 'Hoof', [0.3, 0.3]],
      ['finger2R', 'wrist', 'finger2', 0.009, 0.003, 'Hoof', [0.3, 0.3]],
      ['thighR', 'hip', 'knee', [0.045, 0.06], [0.028, 0.03], 'Coat', [0.4, 0.4], [0.04, 0.05]],
      ['shinR', 'knee', 'ankle', [0.024, 0.026], [0.013, 0.014], 'Coat', [0.4, 0.3]],
      ['metaR', 'ankle', 'foot', 0.012, 0.011, 'Sock', [0.3, 0.3]],
      ['toeFR', 'foot', 'toeF', 0.011, 0.008, 'Sock', [0.3, 0.3]],
      ['toeOR', 'foot', 'toeO', 0.01, 0.008, 'Sock', [0.3, 0.3]],
      ['toeIR', 'foot', 'toeI', 0.01, 0.009, 'Sock', [0.3, 0.3]],
      ['toeBR', 'foot', 'toeB', 0.006, 0.004, 'Sock', [0.3, 0.3]],
      ['clawFR', 'toeF', 'clawF', 0.007, 0.002, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.007, 0.002, 'Hoof', [0.3, 0.3]],
      ['sickleR', 'toeI', 'sickle', 0.009, 0.007, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'sickle', 'clawI', 0.007, 0.0015, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.004, 0.0015, 'Hoof', [0.3, 0.3]],
    ],
    craniumRows: [
      ['st0', -0.15, 0.06, [0.04, 0.055], [0.07, 0.03], [0.075, 0.0], [0.065, -0.03], [0.045, -0.05], -0.055],
      ['st1', -0.08, 0.07, [0.035, 0.066], [0.07, 0.04], [0.075, 0.005], [0.062, -0.03], [0.045, -0.05], -0.055],
      ['st2', -0.01, 0.058, [0.028, 0.054], [0.055, 0.033], [0.06, 0.0], [0.05, -0.03], [0.036, -0.048], -0.052],
      ['st3', 0.06, 0.043, [0.018, 0.04], [0.036, 0.024], [0.04, -0.005], [0.036, -0.03], [0.028, -0.045], -0.048],
      ['st4', 0.13, 0.038, [0.015, 0.035], [0.03, 0.019], [0.032, -0.008], [0.03, -0.03], [0.024, -0.043], -0.045],
      ['st5', 0.20, 0.035, [0.012, 0.032], [0.025, 0.016], [0.027, -0.01], [0.025, -0.03], [0.02, -0.041], -0.043],
      ['st6', 0.27, 0.03, [0.01, 0.027], [0.019, 0.01], [0.02, -0.012], [0.019, -0.028], [0.015, -0.037], -0.039],
    ],
    craniumCaps: { back: [0, -0.18, 0.005], tip: [0, 0.295, -0.01] },
    jawRows: [
      ['st0', -0.10, { gum: -0.055, gumR: [0.05, -0.055], jaw: [0.052, -0.075], bottom: -0.085 }],
      ['st1', 0.0, { gum: -0.052, gumR: [0.04, -0.052], jaw: [0.042, -0.07], bottom: -0.078 }],
      ['st2', 0.10, { gum: -0.047, gumR: [0.03, -0.047], jaw: [0.031, -0.062], bottom: -0.067 }],
      ['st3', 0.20, { gum: -0.043, gumR: [0.023, -0.043], jaw: [0.024, -0.056], bottom: -0.06 }],
      ['st4', 0.27, { gum: -0.039, gumR: [0.016, -0.039], jaw: [0.017, -0.05], bottom: -0.053 }],
    ],
    jawCaps: { back: [0, -0.13, -0.07], tip: [0, 0.285, -0.045] },
    headScale: 0.55, headPitch: -4, eyeAt: [1.5, 1.8], eyeR: 0.03,
    headOrnaments: teeth([2.4, 2.9, 3.4, 3.9, 4.4, 4.9, 5.4, 5.8], 5.0, 0.02, 0.006, 0.55),
    extraSegments: [tailLoft(
      [[-0.12, 0.51, [0.055, 0.06]], [-0.35, 0.525, [0.04, 0.045]], [-0.7, 0.54, [0.028, 0.03]], [-1.05, 0.55, [0.018, 0.019]], [-1.32, 0.555, [0.009, 0.01]]],
      { back: [0, -0.06, 0.51], tip: [0, -1.4, 0.556] })],
    // the feathers: a fringe of long tiles trailing off the folded arm, a ruff down the neck, a fan at the tail's end
    bodyTiles: [
      { id: 'armFringe', parts: ['foreArmR', 'upperArmR'], s: [0.2, 1.4], t: [0, 6], grid: [5, 3], brick: true, sides: 3, coverage: 1.4, inset: 0.9, height: 0.05, lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.2, jitter: 0.2, group: ['Mane', 'Coat'] },
      { id: 'ruff', parts: ['neck'], s: [0.1, 1.3], t: [0, 6], grid: [7, 4], brick: true, sides: 3, coverage: 1.4, inset: 0.9, height: 0.03, lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Coat', 'Mane'] },
    ],
    markings: [{ on: 'torso', kind: 'belly', from: 0.6, group: 'Belly' }, { on: 'torso', kind: 'stripes', count: 6, width: 0.4, t: [0, 0.45], group: 'Mane' }],
  },
};


export const about = {
  tRex: { common: 't. rex', aliases: ['tyrannosaurus', 'tyrannosaurus rex', 't rex', 'trex', 'dinosaur'], sci: 'Tyrannosaurus rex', size: '~12 m long, ~4.4 m over the hips, 8–9 t', source: 'Hutchinson et al. 2011, PLoS ONE 6: e26037' },
  velociraptor: { common: 'velociraptor', aliases: ['raptor'], sci: 'Velociraptor mongoliensis', size: '~2.0 m long, ~0.5 m at the hip, 15–20 kg', source: 'Paul 2016, The Princeton Field Guide to Dinosaurs, 2nd ed.' },
};
