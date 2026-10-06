// HADROSAUR — the duck-billed dinosaurs, built over the ceratopsian tables (a dinosaur trunk highest at the hips, a
// long tapering tail, three-nubbed hoofed feet): a slimmer deeper barrel, long pillar hind legs, short slender
// forelegs (the facultative biped posed on all fours), a longer neck carried up, a long low head ending in a wide
// flat DUCK BILL, and the lambeosaurine crest as a head ornament. Worked species: Parasaurolophus walkeri.
// See ../build.js.
import { family as ceratopsian } from './ceratopsian.js';

export const family = {
  ...ceratopsian,
  family: 'hadrosaur',
  colors: { ...ceratopsian.colors, coat: '#6f7452', sock: '#5f6446', ash: '#8a8a62', ashAlt: '#7e8058', brow: '#4f5238', mouth: '#4a4030', horn: '#8a6a3e', hoof: '#3a3426', nose: '#3a3426' },
  joints: {
    ...ceratopsian.joints,
    neckBase: [0, 0.92, 0.92], neckTop: [0, 1.50, 1.66],
    shoulder: [0.32, 0.80, 0.72], elbow: [0.36, 0.70, 0.42], carpus: [0.37, 0.90, 0.19], forePaw: [0.37, 0.94, 0.12], foreToe: [0.37, 1.04, 0.10],
    hip: [0.34, -0.92, 1.42], stifle: [0.40, -0.60, 0.86], hock: [0.37, -1.06, 0.38], hindPaw: [0.37, -0.94, 0.13], hindToe: [0.37, -0.84, 0.10],
  },
  torsoUp: true,
  torso: [
    { at: [0, -1.30, 1.42], r: [0.38, 0.53] },
    { at: [0, -1.05, 1.40], r: [0.48, 0.64] },
    { at: [0, -0.55, 1.30], r: [0.52, 0.68] },
    { at: [0, 0.05, 1.12], r: [0.50, 0.64] },
    { at: [0, 0.55, 0.96], r: [0.42, 0.53] },
    { at: [0, 0.95, 0.86], r: [0.32, 0.42] },
  ],
  torsoCaps: { back: [0, -1.46, 1.46], tip: [0, 1.10, 0.88] },
  neckRA: [0.30, 0.34], neckRB: [0.18, 0.20], neckRMid: [0.24, 0.27],
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.13, 0.15], [0.10, 0.10], 'Coat', [0.6, 0.5], [0.12, 0.13]],
    ['foreArmR', 'elbow', 'carpus', [0.10, 0.10], [0.08, 0.08], 'Coat', [0.5, 0.4]],
    ['pasternR', 'carpus', 'forePaw', 0.08, 0.09, 'Sock', [0.4, 0.4]],
    ['forePawR', 'forePaw', 'foreToe', [0.10, 0.06], [0.09, 0.05], 'Sock', [0.6, 0.4]],
    ['thighR', 'hip', 'stifle', [0.26, 0.34], [0.18, 0.20], 'Coat', [0.2, 0.5], [0.24, 0.28]],
    ['shinR', 'stifle', 'hock', [0.17, 0.18], [0.12, 0.12], 'Coat', [0.5, 0.4]],
    ['metaR', 'hock', 'hindPaw', 0.12, 0.14, 'Sock', [0.4, 0.4]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.16, 0.08], [0.14, 0.07], 'Sock', [0.6, 0.4]],
  ],
  // a long deep tail, held out level behind the hips
  tail: [[0, -1.40, 1.52, 0.30], [0, -2.00, 1.46, 0.22], [0, -2.60, 1.30, 0.14]],
  tip: [[0, -2.58, 1.31, 0.14], [0, -3.10, 1.12, 0.08], [0, -3.50, 0.98, 0.03]],
  tipCaps: { back: [0, -2.52, 1.33], tip: [0, -3.56, 0.95] },
  // a long low skull; the muzzle flares into a wide, flat, shallow duck bill (st5, st6 wide and thin)
  craniumRows: [
    ['st0', -0.36, 0.14, [0.08, 0.13], [0.13, 0.07], [0.15, -0.02], [0.13, -0.11], [0.09, -0.15], -0.16],
    ['st1', -0.20, 0.13, [0.08, 0.12], [0.14, 0.05], [0.15, -0.03], [0.13, -0.12], [0.09, -0.16], -0.17],
    ['st2', -0.02, 0.09, [0.07, 0.08], [0.11, 0.03], [0.12, -0.04], [0.11, -0.12], [0.08, -0.15], -0.16],
    ['st3', 0.16, 0.06, [0.06, 0.05], [0.09, 0.01], [0.10, -0.05], [0.09, -0.11], [0.07, -0.14], -0.15],
    ['st4', 0.32, 0.03, [0.06, 0.02], [0.09, -0.02], [0.10, -0.06], [0.09, -0.10], [0.08, -0.12], -0.13],
    ['st5', 0.46, 0.0, [0.13, -0.02], [0.19, -0.05], [0.20, -0.07], [0.19, -0.095], [0.16, -0.11], -0.11],
    ['st6', 0.58, -0.05, [0.15, -0.055], [0.21, -0.065], [0.22, -0.08], [0.21, -0.095], [0.18, -0.10], -0.105],
  ],
  craniumCaps: { back: [0, -0.42, 0.02], tip: [0, 0.595, -0.08] },
  muzzleFrom: 4,
  jawRows: [
    ['st0', -0.28, { gum: -0.16, gumR: [0.11, -0.16], jaw: [0.12, -0.22], bottom: -0.25 }],
    ['st1', -0.05, { gum: -0.15, gumR: [0.10, -0.15], jaw: [0.11, -0.21], bottom: -0.23 }],
    ['st2', 0.18, { gum: -0.14, gumR: [0.08, -0.14], jaw: [0.09, -0.19], bottom: -0.21 }],
    ['st3', 0.36, { gum: -0.13, gumR: [0.08, -0.13], jaw: [0.09, -0.16], bottom: -0.18 }],
    ['st4', 0.52, { gum: -0.11, gumR: [0.18, -0.11], jaw: [0.19, -0.13], bottom: -0.14 }],
  ],
  jawCaps: { back: [0, -0.34, -0.20], tip: [0, 0.57, -0.13] },
  headPitch: -12,
  headScale: 1.25, nape: [0, -0.28, -0.02],
  eyeAt: [1.3, 2.6], nostrilAt: [4.6, 2.5], noseAt: [4.8, 2.4],
  headOrnaments: [],
};

// fix pass (v4): crest tip lowered 12°, forelegs ~17% shorter (shoulder end dropped, hips unchanged), trunk ~10%
// deeper, a broad flat blunt duck bill
export const species = {
  // PARASAUROLOPHUS (Parasaurolophus walkeri). Thesis: a deep barrel highest at the hips on long pillar hind legs and
  // short slender forelegs (posed on all fours), a long deep tail held out level · a long neck carried up, a long
  // low head with a wide flat DUCK BILL · ONE signature: a long hollow TUBULAR CREST sweeping straight back from the
  // top of the skull, past the neck · ~9.5 m long, ~2.6 m at the hips (Parks 1922 holotype ROM 768; adult size per
  // Paul 2016 Princeton Field Guide: 9.5 m).
  parasaurolophus: {
    family: 'hadrosaur', name: 'a Parasaurolophus', scale: 1.47,
    headOrnaments: [
      // the crest: a long round tube rising off the top of the skull and running straight back past the nape
      { kind: 'sweep', name: 'crest', at: [0.6, 0.0001], side: 'R', space: 'head', spine: [[0, -0.10, 0.13], [0, -0.314, 0.176], [0, -0.576, 0.203], [0, -0.83, 0.20], [0, -1.05, 0.173]], radii: [0.10, 0.095, 0.09, 0.085, 0.06], m: 8, squash: [0.8, 1], group: 'Skull' },
    ],
  },
};
