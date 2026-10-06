// MACROPOD — an upright biped at rest: the trunk inclined steeply up from a heavy pelvis to a narrow chest, huge hind
// legs folded under it on very long flat hind feet, small forearms held in front of the chest, a thick tail resting
// on the ground as the third leg of the tripod, a small deer-like head with long upright ears. Worked species: the
// red kangaroo. See ../build.js for what every field does.
//
// THE INCLINED TRUNK: build.js lofts `torso` level only (a sloped loft chord twists its rings), so the macropod body
// is an `extraSegments` segment between two joints of its own (`pelvis` → `chest`, any angle) plus a belly segment;
// `torso` shrinks to a small level loft hidden inside the chest top (it still names the withers for fauna-fit).

export const family = {
  family: 'macropod',
  colors: {
    coat: '#a8573a', sock: '#8f4a32', ash: '#d2a88c', ashAlt: '#c8987c', brow: '#5a3020', iris: '#3a2416',
    ink: '#120d0a', sclera: '#2b1d14', nose: '#1c1512', teeth: '#ece6d6', mouth: '#4e3430', tip: '#6e3a28', belly: '#e3d6c4',
  },
  joints: {
    pelvis: [0, -0.16, 0.52], chest: [0, 0.06, 1.02],
    neckBase: [0, 0.10, 1.04], neckTop: [0, 0.17, 1.22],
    shoulder: [0.12, 0.12, 0.98], elbow: [0.14, 0.20, 0.82], carpus: [0.11, 0.32, 0.78], forePaw: [0.10, 0.37, 0.77],
    hip: [0.15, -0.14, 0.52], stifle: [0.16, 0.14, 0.36], hock: [0.12, -0.20, 0.07], hindPaw: [0.12, 0.08, 0.035], hindToe: [0.12, 0.24, 0.03],
  },
  // a small level loft inside the chest top: the builder's trunk, kept only to carry the withers
  torso: [
    { at: [0, -0.02, 0.92], r: [0.08, 0.08] },
    { at: [0, 0.06, 0.92], r: [0.08, 0.08] },
  ],
  torsoCaps: { back: [0, -0.06, 0.92], tip: [0, 0.10, 0.92] },
  neckRA: [0.09, 0.10], neckRB: [0.06, 0.07], neckRMid: [0.075, 0.085],
  // the tail: thick at the root, down to the ground behind the heels, then lying along it
  tail: [[0, -0.22, 0.50, 0.16], [0, -0.34, 0.30, 0.135], [0, -0.44, 0.13, 0.105], [0, -0.58, 0.07, 0.075], [0, -0.82, 0.045, 0.05]],
  tip: [[0, -0.80, 0.04, 0.045], [0, -0.96, 0.035, 0.032], [0, -1.08, 0.03, 0.018]],
  tipCaps: { back: [0, -0.78, 0.04], tip: [0, -1.12, 0.028] },
  extraSegments: [
    // the inclined trunk: heavy pelvis up to a narrower chest; the belly fills in front of the pelvis
    { name: 'trunk', kind: 'segment', from: 'pelvis', to: 'chest', rA: [0.2, 0.22], rB: [0.13, 0.13], rMid: [0.185, 0.2], slots: 'ring12', over: [0.5, 0.5], group: 'Coat', mirror: 'plane' },
  ],
  legs: [
    // forearms: short, held in front of the chest
    ['upperArmR', 'shoulder', 'elbow', [0.045, 0.05], [0.032, 0.034], 'Coat', [0.5, 0.4]],
    ['foreArmR', 'elbow', 'carpus', [0.03, 0.032], [0.022, 0.022], 'Coat', [0.5, 0.4]],
    ['handR', 'carpus', 'forePaw', [0.024, 0.02], [0.018, 0.014], 'Sock', [0.5, 0.4]],
    // hind legs: a massive thigh forward to the knee, the shin back down to the heel, the long foot flat
    ['thighR', 'hip', 'stifle', [0.15, 0.2], [0.08, 0.095], 'Coat', [0.3, 0.5], [0.14, 0.18]],
    ['shinR', 'stifle', 'hock', [0.06, 0.065], [0.035, 0.035], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', [0.035, 0.035], [0.035, 0.03], 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.035, 0.03], [0.025, 0.02], 'Sock', [0.6, 0.4]],
  ],
  // skull rows: [id, y, top, crown, brow, cheek, jowl, lip, palate] — a deer-like head: a domed short cranium, a
  // long tapering muzzle
  craniumRows: [
    ['st0', -0.15, 0.045, [0.03, 0.043], [0.055, 0.02], [0.06, -0.02], [0.05, -0.05], [0.032, -0.065], -0.07],
    ['st1', -0.09, 0.085, [0.02, 0.083], [0.065, 0.055], [0.085, -0.01], [0.075, -0.05], [0.045, -0.075], -0.08],
    ['st2', -0.02, 0.085, [0.032, 0.082], [0.075, 0.045], [0.09, -0.005], [0.075, -0.05], [0.045, -0.075], -0.08],
    ['st3', 0.04, 0.06, [0.012, 0.059], [0.045, 0.03], [0.055, -0.015], [0.05, -0.048], [0.036, -0.068], -0.07],
    ['st4', 0.10, 0.04, [0.016, 0.038], [0.034, 0.014], [0.04, -0.02], [0.036, -0.045], [0.028, -0.06], -0.062],
    ['st5', 0.16, 0.028, [0.014, 0.025], [0.026, 0.004], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
    ['st6', 0.21, 0.016, [0.01, 0.014], [0.02, -0.004], [0.022, -0.024], [0.02, -0.037], [0.016, -0.046], -0.047],
  ],
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.02] },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.07, { gum: -0.075, gumR: [0.042, -0.075], jaw: [0.045, -0.095], bottom: -0.108 }],
    ['st1', 0.0, { gum: -0.075, gumR: [0.037, -0.075], jaw: [0.04, -0.092], bottom: -0.102 }],
    ['st2', 0.07, { gum: -0.064, gumR: [0.029, -0.064], jaw: [0.031, -0.08], bottom: -0.088 }],
    ['st3', 0.14, { gum: -0.056, gumR: [0.022, -0.056], jaw: [0.023, -0.069], bottom: -0.075 }],
    ['st4', 0.195, { gum: -0.049, gumR: [0.016, -0.049], jaw: [0.017, -0.058], bottom: -0.064 }],
  ],
  jawCaps: { back: [0, -0.1, -0.09], tip: [0, 0.21, -0.055] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.01, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.012, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.9, nape: [0, -0.1, -0.05],
  eyeAt: [2.6, 2.4], eyeR: 0.022, pupil: 'round', irisAngle: 40,
  browStrip: [[1.95, 1.95], [2.2, 1.95], [2.5, 2.0], [2.8, 2.1], [3.05, 2.25]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.85, 1.5], noseAt: [5.8, 0.0001], noseR: [0.022, 0.018], webCranium: [1.7, 3.3, 4.97],
  earAt: [1.2, 1.5], earSpine: [[0, 0, -0.012], [0, 0, 0.03], [0, 0, 0.09], [0, 0, 0.15], [0, 0, 0.21]],
  earR: [0.032, 0.04, 0.028, 0.01], earSquash: [1, 0.4], earH: 1,
  bulk: 1, legBulk: 1, tailBush: 1,
  scale: 1,
};

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // RED KANGAROO (Macropus rufus), adult male — THESIS: an upright tripod at rest · the trunk inclined steeply up
  // from a heavy pelvis, huge folded hind legs on very long flat hind feet · small forearms held before the chest ·
  // a small deer-like head with long upright ears · ONE signature: the thick tail on the ground as the third leg ·
  // standing ~1.6 m to the head top (adult males stand up to ~1.8 m; head-body 1.3–1.6 m, tail ~1.0 m, hind foot
  // ~0.3 m — Australian Museum / Dawson, "Kangaroos" 2012).
  kangaroo: {
    family: 'macropod', name: 'a red kangaroo',
    headScale: 0.95, muzzleW: 1.1, muzzleLen: 0.8,
  },
};
