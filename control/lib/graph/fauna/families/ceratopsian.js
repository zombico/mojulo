// CERATOPSIAN — a heavy quadruped built up from the pachyderm tables (the white rhino's columnar legs, three-nubbed
// feet and long low head), with the dinosaur's own shape over it: the back highest at the HIPS, a long tapering
// tail, a huge head carried low on a short neck, and the ceratopsian signature as head ornaments — a solid bony
// FRILL (a flattened sweep rising back off the skull), brow horns and a nose horn, a narrow parrot beak.
// Worked species: Triceratops horridus. See ../build.js.
import { family as pachyderm, species as pachydermSpecies } from './pachyderm.js';

const { family: _f, name: _n, scale: _s, headOrnaments: _h, ...rhino } = pachydermSpecies.rhino;

export const family = {
  ...pachyderm,
  ...rhino,
  family: 'ceratopsian',
  colors: { ...pachyderm.colors, coat: '#7a6a52', sock: '#6a5c46', ash: '#8a7a60', ashAlt: '#7e6e56', brow: '#5a4c3a', mouth: '#5a4636', horn: '#d6c8a4', hoof: '#3e3428', nose: '#3a3026', frill: '#8a6a4a' },
  joints: {
    ...pachyderm.joints, ...rhino.joints,
    neckBase: [0, 0.98, 1.05], neckTop: [0, 1.30, 0.98],
    shoulder: [0.38, 0.80, 0.98], elbow: [0.46, 0.76, 0.56], carpus: [0.39, 0.90, 0.24], forePaw: [0.37, 0.94, 0.13], foreToe: [0.37, 1.04, 0.10],
    hip: [0.34, -0.92, 1.30], stifle: [0.40, -0.68, 0.74], hock: [0.37, -1.00, 0.32], hindPaw: [0.37, -0.94, 0.13], hindToe: [0.37, -0.84, 0.10],
  },
  // the back highest over the hips, falling to the shoulders (torsoUp: stations at different heights)
  torsoUp: true,
  torso: [
    { at: [0, -1.30, 1.28], r: [0.44, 0.50] },
    { at: [0, -1.05, 1.28], r: [0.58, 0.60] },
    { at: [0, -0.55, 1.24], r: [0.64, 0.62] },
    { at: [0, 0.05, 1.16], r: [0.64, 0.58] },
    { at: [0, 0.55, 1.08], r: [0.58, 0.54] },
    { at: [0, 0.95, 1.02], r: [0.48, 0.46] },
  ],
  torsoCaps: { back: [0, -1.46, 1.32], tip: [0, 1.12, 1.04] },
  neckRA: [0.44, 0.44], neckRB: [0.34, 0.34], neckRMid: [0.39, 0.39],
  // a long thick tail tapering straight back, carried clear of the ground
  tail: [[0, -1.40, 1.42, 0.30], [0, -1.90, 1.28, 0.21], [0, -2.40, 1.06, 0.13]],
  tip: [[0, -2.38, 1.07, 0.13], [0, -2.70, 0.92, 0.075], [0, -2.95, 0.80, 0.03]],
  tipCaps: { back: [0, -2.32, 1.10], tip: [0, -3.0, 0.78] },
  // a long low skull narrowing to a hooked parrot beak (st6: narrow and deep, the tip turned down)
  craniumRows: [
    ['st0', -0.40, 0.18, [0.10, 0.16], [0.17, 0.09], [0.20, -0.02], [0.18, -0.13], [0.12, -0.18], -0.19],
    ['st1', -0.22, 0.15, [0.10, 0.13], [0.18, 0.06], [0.20, -0.04], [0.18, -0.15], [0.11, -0.20], -0.21],
    ['st2', -0.02, 0.09, [0.08, 0.08], [0.14, 0.03], [0.16, -0.05], [0.15, -0.15], [0.10, -0.19], -0.20],
    ['st3', 0.18, 0.08, [0.07, 0.065], [0.11, 0.02], [0.13, -0.05], [0.12, -0.14], [0.09, -0.18], -0.19],
    ['st4', 0.36, 0.07, [0.06, 0.055], [0.09, 0.01], [0.10, -0.05], [0.10, -0.14], [0.08, -0.17], -0.18],
    ['st5', 0.50, 0.03, [0.05, 0.02], [0.07, -0.02], [0.08, -0.07], [0.08, -0.14], [0.06, -0.17], -0.18],
    ['st6', 0.60, -0.06, [0.03, -0.07], [0.045, -0.10], [0.05, -0.13], [0.05, -0.17], [0.04, -0.20], -0.21],
  ],
  craniumCaps: { back: [0, -0.46, 0.04], tip: [0, 0.65, -0.20] },
  muzzleFrom: 4,
  jawRows: [
    ['st0', -0.30, { gum: -0.19, gumR: [0.13, -0.19], jaw: [0.15, -0.26], bottom: -0.29 }],
    ['st1', -0.05, { gum: -0.19, gumR: [0.12, -0.19], jaw: [0.14, -0.26], bottom: -0.29 }],
    ['st2', 0.20, { gum: -0.18, gumR: [0.10, -0.18], jaw: [0.11, -0.24], bottom: -0.26 }],
    ['st3', 0.40, { gum: -0.18, gumR: [0.07, -0.18], jaw: [0.08, -0.23], bottom: -0.25 }],
    ['st4', 0.52, { gum: -0.19, gumR: [0.04, -0.19], jaw: [0.045, -0.23], bottom: -0.24 }],
  ],
  jawCaps: { back: [0, -0.36, -0.24], tip: [0, 0.57, -0.22] },
  headPitch: -8,
  headScale: 1.9, nape: [0, -0.30, -0.02],
  eyeAt: [1.3, 2.6], nostrilAt: [5.0, 2.5], noseAt: [5.2, 2.4], nose: false,
  ears: false,
  headOrnaments: [],
};

export const species = {
  // TRICERATOPS (Triceratops horridus). Thesis: a heavy barrel on stout columnar legs (hips higher than shoulders),
  // a long thick tapering tail · a HUGE head carried low: a solid bony FRILL rising back over the neck, two long
  // BROW HORNS sweeping forward, a short NOSE HORN, a narrow hooked parrot beak · ~9 m long, ~3 m at the hips
  // (Scannella & Horner 2010 growth series; adult size per Paul 2016 Princeton Field Guide: 8–9 m, hip ~3 m).
  triceratops: {
    family: 'ceratopsian', name: 'a Triceratops', scale: 1.6,
    headOrnaments: [
      // the frill: a broad flat plate rising back and up off the back of the skull, solid (no fenestrae)
      { kind: 'sweep', name: 'frill', at: [0.3, 0.0001], side: 'R', space: 'head', spine: [[0, -0.28, 0.14], [0, -0.44, 0.24], [0, -0.60, 0.38], [0, -0.73, 0.52], [0, -0.80, 0.61]], radii: [0.14, 0.90, 1.25, 1.20, 0.70], m: 10, squash: [1, 0.14], group: 'Skull' },
      // two long brow horns over the eyes, swept up then forward
      { kind: 'sweep', name: 'browHorn', at: [1.2, 1.6], space: 'head', spine: [[0.09, -0.16, 0.10], [0.11, -0.10, 0.26], [0.12, 0.02, 0.40], [0.12, 0.17, 0.50], [0.11, 0.32, 0.54]], radii: [0.075, 0.06, 0.045, 0.025, 0.006], m: 8, group: 'Horn' },
      // a short nose horn over the nostrils
      { kind: 'sweep', name: 'noseHorn', at: [4.5, 0.0001], side: 'R', space: 'head', spine: [[0, 0.43, 0.06], [0, 0.46, 0.17], [0, 0.49, 0.26]], radii: [0.05, 0.035, 0.008], m: 8, group: 'Horn' },
    ],
  },
};
