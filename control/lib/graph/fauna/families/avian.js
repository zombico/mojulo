// AVIAN — a biped bird: a level trunk carrying the wings (wing.js, worn at `wingRoot`, folded by default), a neck,
// a small skull whose muzzle rows are the BILL, scaly tarsi standing on three forward toes and a hallux with talons,
// a short tail. No ears. Worked species: the griffon vulture. See ../build.js for what every field does; `wings`
// is { wing: <wing data>, at: <root joint>, fold: 0 spread … 1 folded, palette }.

import { featherWing } from '../makers/wing.js';

export { featherWing };   // lives in makers/wing.js

const WING_PALETTE = { WingBone: '#7d5f40', FlightA: '#33271f', FlightB: '#43342a', FlightC: '#54433a', FlightUnder: '#8d8680',
  CovertA: '#9a7a52', CovertB: '#a98a60', CovertC: '#8b6c47', CovertTip: '#efe6d2', CovertUnder: '#e6dccb',
  LesserA: '#b0916a', LesserB: '#bd9f77', LesserC: '#a3855d', LesserTip: '#e3d5bc' };
const band = (g) => [g, g, g, g, g, g];

export const family = {
  family: 'avian',
  colors: {
    coat: '#7d5f40', sock: '#9b958a', ash: '#ece2cf', ashAlt: '#dccfb6', belly: '#cfc7ba', ears: '#d6cfc3', snout: '#cbbf9f',
    brow: '#bdb3a2', iris: '#6b3f1c', ink: '#17130f', sclera: '#2b2116', nose: '#9a8f7a', teeth: '#cbbf9f', mouth: '#5a3a30', tip: '#3a2c22', hoof: '#2b2521',
  },
  joints: {
    neckBase: [0, 0.18, 0.64], neckTop: [0, 0.33, 0.77], wingRoot: [0.12, 0.14, 0.70],
    hip: [0.09, -0.04, 0.46], knee: [0.11, 0.05, 0.26], ankle: [0.10, 0.07, 0.07],
    toeF: [0.10, 0.20, 0.02], toeI: [0.05, 0.17, 0.02], toeO: [0.16, 0.15, 0.02], toeB: [0.10, -0.05, 0.02],
    clawF: [0.10, 0.24, 0.006], clawI: [0.045, 0.205, 0.006], clawO: [0.18, 0.18, 0.006], clawB: [0.10, -0.085, 0.006],
  },
  torso: [
    { at: [0, -0.30, 0.52], r: [0.09, 0.07] },
    { at: [0, -0.18, 0.52], r: [0.16, 0.13] },
    { at: [0, -0.02, 0.52], r: [0.19, 0.16] },
    { at: [0, 0.12, 0.52], r: [0.18, 0.17] },
    { at: [0, 0.22, 0.52], r: [0.13, 0.13] },
  ],
  torsoCaps: { back: [0, -0.36, 0.52], tip: [0, 0.28, 0.53] },
  neckRA: [0.08, 0.08], neckRB: [0.03, 0.03], neckRMid: [0.036, 0.036], neckGroup: 'Belly',
  tail: [[0, -0.30, 0.53, [0.07, 0.03]], [0, -0.38, 0.47, [0.1, 0.025]], [0, -0.45, 0.42, [0.11, 0.02]]],
  tip: [[0, -0.44, 0.425, [0.1, 0.018]], [0, -0.49, 0.39, [0.1, 0.015]], [0, -0.52, 0.37, [0.08, 0.01]]],
  tipCaps: { back: [0, -0.42, 0.44], tip: [0, -0.54, 0.36] },
  legs: [
    ['thighR', 'hip', 'knee', [0.085, 0.095], [0.06, 0.06], 'Coat', [0.4, 0.4]],
    ['tarsusR', 'knee', 'ankle', 0.026, 0.024, 'Sock', [0.4, 0.4]],
    ['toeFR', 'ankle', 'toeF', 0.02, 0.014, 'Sock', [0.4, 0.4]],
    ['toeIR', 'ankle', 'toeI', 0.018, 0.013, 'Sock', [0.4, 0.4]],
    ['toeOR', 'ankle', 'toeO', 0.018, 0.013, 'Sock', [0.4, 0.4]],
    ['toeBR', 'ankle', 'toeB', 0.018, 0.013, 'Sock', [0.4, 0.4]],
    ['clawFR', 'toeF', 'clawF', 0.011, 0.004, 'Hoof', [0.3, 0.3]],
    ['clawIR', 'toeI', 'clawI', 0.01, 0.004, 'Hoof', [0.3, 0.3]],
    ['clawOR', 'toeO', 'clawO', 0.01, 0.004, 'Hoof', [0.3, 0.3]],
    ['clawBR', 'toeB', 'clawB', 0.011, 0.004, 'Hoof', [0.3, 0.3]],
  ],
  // skull rows (metres, the head's own frame): st0–st2 the bare skull, st3–st6 the bill, the tip cap the hook
  craniumRows: [
    ['st0', -0.05, 0.03, [0.015, 0.028], [0.03, 0.012], [0.033, -0.005], [0.028, -0.02], [0.02, -0.027], -0.03],
    ['st1', -0.02, 0.04, [0.02, 0.038], [0.036, 0.018], [0.038, -0.002], [0.032, -0.018], [0.022, -0.026], -0.028],
    ['st2', 0.01, 0.036, [0.018, 0.034], [0.033, 0.015], [0.034, -0.004], [0.028, -0.017], [0.02, -0.024], -0.026],
    ['st3', 0.04, 0.026, [0.012, 0.024], [0.02, 0.012], [0.022, -0.004], [0.019, -0.014], [0.015, -0.02], -0.022],
    ['st4', 0.07, 0.024, [0.008, 0.022], [0.013, 0.01], [0.014, -0.003], [0.012, -0.012], [0.01, -0.017], -0.019],
    ['st5', 0.095, 0.017, [0.006, 0.015], [0.009, 0.005], [0.01, -0.005], [0.009, -0.013], [0.007, -0.018], -0.02],
    ['st6', 0.11, 0.004, [0.004, 0.002], [0.006, -0.006], [0.006, -0.014], [0.005, -0.022], [0.004, -0.026], -0.028],
  ],
  craniumCaps: { back: [0, -0.065, 0.0], tip: [0, 0.112, -0.04] },
  craniumBandGroups: { 'st0-st1': band('Ears'), 'st1-st2': band('Ears'), 'st2-st3': band('Ears'), 'st3-st4': band('Snout'), 'st4-st5': band('Snout'), 'st5-st6': band('Snout') },
  muzzleFrom: 3,
  jawRows: [
    ['st0', -0.03, { gum: -0.028, gumR: [0.022, -0.028], jaw: [0.022, -0.035], bottom: -0.04 }],
    ['st1', 0.02, { gum: -0.024, gumR: [0.016, -0.024], jaw: [0.016, -0.03], bottom: -0.034 }],
    ['st2', 0.06, { gum: -0.02, gumR: [0.011, -0.02], jaw: [0.011, -0.025], bottom: -0.028 }],
    ['st3', 0.09, { gum: -0.021, gumR: [0.007, -0.021], jaw: [0.007, -0.025], bottom: -0.027 }],
  ],
  jawCaps: { back: [0, -0.045, -0.034], tip: [0, 0.098, -0.025] },
  skinControls: {
    browRaise: { amp: 0.004, map: [['st2.brow', 0.8, [0, 0, 1]], ['st1.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.004, map: [['st2.brow', 1, [-0.3, 0.2, -1]]] },
  },
  headScale: 0.85, nape: [0, -0.05, -0.02],
  eyeAt: [2.3, 2.3], eyeR: 0.008, pupil: 'round', irisAngle: 40,
  orbit: { reach: [0.004, 0.005, 0.006], bulk: [0.001, 0.0015], thickness: 0.002 },
  browStrip: [[1.0, 1.95], [1.25, 1.95], [1.5, 2.0], [1.75, 2.1], [2.0, 2.25]],
  foldStrip: [[3.6, 3.9], [3.5, 4.0], [3.4, 4.1], [3.3, 4.2], [3.2, 4.3]],
  nostrilAt: [3.3, 1.6], noseAt: [3.3, 1.6], noseR: [0.003, 0.003], webCranium: [1.7, 3.3, 4.97],
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01, 0.01, 0.01], earSquash: [1, 0.4],
  bodyTiles: [
    { id: 'ruff', parts: ['neck'], s: [0.3, 1.3], t: [0, 6], grid: [8, 4], brick: true, sides: 3, coverage: 1.5, inset: 0.9, height: 0.09, lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Fur', 'FurAlt'] },
  ],
  wings: { wing: featherWing(), at: 'wingRoot', fold: 1, palette: WING_PALETTE },
  scale: 1,
};

export const species = {
  // GRIFFON VULTURE (Gyps fulvus) — the avian family's worked species. Thesis: a big hunched soaring bird standing
  // on the ground, wings folded long down the back past a short dark tail · a small BARE pale head on a long bare
  // neck rising from a cream RUFF · a heavy HOOKED bill · grey scaly tarsi, three toes forward with blunt talons ·
  // sandy-brown coverts, dark flight feathers. ~1.0 m standing (published length 93–122 cm, span 2.3–2.8 m;
  // Wikipedia / BirdLife); hunched: head top ~0.95 m, top of the back ~0.8 m. `wings.fold` 0 spreads them (span ~2.5 m).
  vulture: { family: 'avian', name: 'a griffon vulture', scale: 1.15,
    // the bare head's colour (the family's `ears` band) on the eyelids, brow pad, folds and the back cap of the skull
    colors: { lids: '#d6cfc3', skull: '#d6cfc3', pad: '#d6cfc3', folds: '#d6cfc3' } },

  // BALD EAGLE (Haliaeetus leucocephalus). Thesis: an UPRIGHT perched raptor, trunk tilted ~40°, long broad dark wings
  // folded down the sides to the tail · a WHITE head on a short thick white neck with a heavy brow over a pale eye ·
  // a big deep YELLOW HOOKED bill · a WHITE wedge tail hanging below the wingtips · feathered dark thighs, bare
  // YELLOW tarsi and toes, black talons · dark-brown body. Size: published length 70–102 cm, span 1.8–2.3 m
  // (Wikipedia, "Bald eagle"); perched upright: head top ~0.80 m (height target).
  baldEagle: {
    family: 'avian', name: 'a bald eagle', torsoUp: true, scale: 0.885,
    colors: { coat: '#3a2a1d', sock: '#e2b32c', ash: '#e3b12a', ashAlt: '#f1efe8', belly: '#f3f1ea', ears: '#f3f1ea', snout: '#e8b425',
      brow: '#f3f1ea', iris: '#e9d36a', sclera: '#e9d36a', nose: '#e8b425', tip: '#f3f1ea', mane: '#f3f1ea', hoof: '#151210',
      lids: '#f3f1ea', skull: '#f3f1ea', pad: '#f3f1ea', folds: '#f3f1ea' },
    joints: { neckBase: [0, 0.15, 0.70], neckTop: [0, 0.19, 0.84], wingRoot: [0.13, 0.09, 0.67],
      hip: [0.09, -0.06, 0.40], knee: [0.11, 0.05, 0.24], ankle: [0.10, 0.04, 0.07] },
    torso: [
      { at: [0, -0.30, 0.37], r: [0.09, 0.07] },
      { at: [0, -0.19, 0.45], r: [0.15, 0.13] },
      { at: [0, -0.06, 0.54], r: [0.19, 0.16] },
      { at: [0, 0.06, 0.62], r: [0.18, 0.16] },
      { at: [0, 0.15, 0.69], r: [0.11, 0.11] },
    ],
    torsoCaps: { back: [0, -0.35, 0.33], tip: [0, 0.19, 0.73] },
    neckRA: [0.1, 0.1], neckRB: [0.06, 0.06], neckRMid: [0.07, 0.07],
    tail: [[0, -0.31, 0.35, [0.08, 0.045]], [0, -0.38, 0.27, [0.11, 0.04]], [0, -0.43, 0.20, [0.12, 0.035]]],
    tip: [[0, -0.42, 0.21, [0.13, 0.04]], [0, -0.48, 0.12, [0.16, 0.035]], [0, -0.52, 0.06, [0.13, 0.02]]],
    tipCaps: { back: [0, -0.40, 0.24], tip: [0, -0.535, 0.04] },
    legs: [
      ['thighR', 'hip', 'knee', [0.09, 0.1], [0.065, 0.065], 'Coat', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.03, 0.028, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.024, 0.017, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.022, 0.016, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.022, 0.016, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.022, 0.016, 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.014, 0.004, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.013, 0.004, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.013, 0.004, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.014, 0.004, 'Hoof', [0.3, 0.3]],
    ],
    // a flatter, broader skull and a DEEP bill (st3–st6) ending in a long hook (tip cap well below the culmen)
    craniumRows: [
      ['st0', -0.05, 0.034, [0.02, 0.032], [0.036, 0.014], [0.038, -0.006], [0.032, -0.024], [0.022, -0.032], -0.035],
      ['st1', -0.02, 0.042, [0.024, 0.04], [0.042, 0.02], [0.044, -0.002], [0.036, -0.02], [0.025, -0.03], -0.032],
      ['st2', 0.01, 0.04, [0.022, 0.038], [0.04, 0.022], [0.04, -0.004], [0.032, -0.02], [0.022, -0.028], -0.03],
      ['st3', 0.04, 0.034, [0.016, 0.032], [0.024, 0.016], [0.026, -0.006], [0.022, -0.02], [0.017, -0.027], -0.028],
      ['st4', 0.07, 0.03, [0.011, 0.028], [0.017, 0.012], [0.018, -0.006], [0.015, -0.018], [0.012, -0.024], -0.025],
      ['st5', 0.095, 0.022, [0.008, 0.02], [0.012, 0.006], [0.012, -0.008], [0.011, -0.018], [0.008, -0.024], -0.026],
      ['st6', 0.113, 0.008, [0.005, 0.006], [0.007, -0.006], [0.007, -0.018], [0.006, -0.028], [0.004, -0.033], -0.036],
    ],
    craniumCaps: { back: [0, -0.058, 0.0], tip: [0, 0.122, -0.05] },
    browStrip: [[1.2, 1.9], [1.45, 1.9], [1.7, 1.95], [1.95, 2.05], [2.2, 2.2]],
    headScale: 1.05, eyeAt: [2.2, 2.2], eyeR: 0.009,
    bodyTiles: [
      { id: 'ruff', parts: ['neck'], s: [0.1, 1.2], t: [0, 6], grid: [8, 4], brick: true, sides: 3, coverage: 1.5, inset: 0.9, height: 0.05, lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Belly', 'Mane'] },
    ],
    // the folded wing plane pitched 40° nose-up with the trunk, so the folded wing runs down the back to the tail
    wings: { wing: featherWing({ arm: [0.17, 0.25, 0.17], secLen: 0.38, primLen: 0.4, primReach: 0.06 }), pitch: 36,
      palette: { WingBone: '#3a2a1d', FlightA: '#231a13', FlightB: '#2c2118', FlightC: '#35281d', FlightUnder: '#3e3128',
        CovertA: '#3d2c1f', CovertB: '#46332a', CovertC: '#352619', CovertTip: '#4a3626', CovertUnder: '#3e3128',
        LesserA: '#4a3725', LesserB: '#523d2a', LesserC: '#433121', LesserTip: '#4e3a28' } },
  },

  // GREAT HORNED OWL (Bubo virginianus). Thesis: a COMPACT near-vertical barrel, wings folded flat down the sides, a
  // short tail · a BIG ROUND head as wide as the shoulders with a flat rufous FACIAL DISC and two upright EAR TUFTS ·
  // LARGE forward-facing YELLOW eyes under pale brows · a tiny dark hooked bill · a pale throat bib · thick
  // FEATHERED buff legs and toes, dark talons · mottled grey-brown. Size: published length 43–64 cm, span 101–153 cm
  // (Wikipedia, "Great horned owl"); perched upright: head top with tufts ~0.52 m (height target). Authored at size.
  greatHornedOwl: {
    family: 'avian', name: 'a great horned owl', torsoUp: true, scale: 1,
    colors: { coat: '#6e5c47', sock: '#c8b89a', ash: '#c47f45', ashAlt: '#d9cfbd', belly: '#e8e2d4', ears: '#5a4a3a', snout: '#3b3734',
      brow: '#ece6da', iris: '#f5c518', sclera: '#f5c518', nose: '#3b3734', tip: '#6e5c47', hoof: '#1e1a17', mane: '#e8e2d4',
      lids: '#f5c518', pad: '#c47f45' },
    // the eye a big yellow disc: yellow lids, the lid rim the facial disc's rufous (not a dark goggle ring)
    headPalette: { LidRim: '#c47f45' },
    joints: { neckBase: [0, 0.0, 0.36], neckTop: [0, 0.015, 0.40], wingRoot: [0.08, -0.02, 0.37],
      hip: [0.06, -0.04, 0.17], knee: [0.07, 0.03, 0.10], ankle: [0.065, 0.03, 0.035],
      toeF: [0.065, 0.10, 0.012], toeI: [0.035, 0.085, 0.012], toeO: [0.1, 0.075, 0.012], toeB: [0.065, -0.015, 0.012],
      clawF: [0.065, 0.12, 0.004], clawI: [0.03, 0.10, 0.004], clawO: [0.115, 0.09, 0.004], clawB: [0.065, -0.035, 0.004] },
    torso: [
      { at: [0, -0.06, 0.10], r: [0.09, 0.07] },
      { at: [0, -0.05, 0.18], r: [0.125, 0.115] },
      { at: [0, -0.03, 0.27], r: [0.13, 0.12] },
      { at: [0, -0.015, 0.33], r: [0.12, 0.11] },
      { at: [0, 0.0, 0.37], r: [0.09, 0.08] },
    ],
    torsoCaps: { back: [0, -0.075, 0.065], tip: [0, 0.01, 0.40] },
    neckRA: [0.08, 0.08], neckRB: [0.07, 0.07], neckRMid: [0.075, 0.075],
    tail: [[0, -0.10, 0.14, [0.05, 0.02]], [0, -0.12, 0.10, [0.065, 0.018]], [0, -0.135, 0.07, [0.07, 0.015]]],
    tip: [[0, -0.13, 0.075, [0.07, 0.014]], [0, -0.14, 0.055, [0.065, 0.012]], [0, -0.145, 0.045, [0.05, 0.008]]],
    tipCaps: { back: [0, -0.125, 0.09], tip: [0, -0.147, 0.04] },
    legs: [
      ['thighR', 'hip', 'knee', [0.05, 0.055], [0.04, 0.04], 'Sock', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.026, 0.024, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.015, 0.011, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.014, 0.01, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.014, 0.01, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.014, 0.01, 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
    ],
    // a round skull (st0–st3) whose front band st3→st4 is the near-flat FACIAL DISC; st4–st6 a tiny hooked bill
    craniumRows: [
      ['st0', -0.05, 0.035, [0.03, 0.03], [0.045, 0.01], [0.045, -0.015], [0.035, -0.035], [0.02, -0.045], -0.048],
      ['st1', -0.02, 0.055, [0.045, 0.045], [0.064, 0.015], [0.066, -0.02], [0.05, -0.045], [0.028, -0.058], -0.062],
      ['st2', 0.015, 0.055, [0.046, 0.046], [0.066, 0.012], [0.066, -0.02], [0.05, -0.046], [0.028, -0.058], -0.062],
      ['st3', 0.035, 0.045, [0.04, 0.04], [0.058, 0.01], [0.058, -0.02], [0.044, -0.04], [0.024, -0.05], -0.054],
      ['st4', 0.045, 0.0, [0.006, -0.002], [0.009, -0.008], [0.009, -0.016], [0.007, -0.022], [0.004, -0.026], -0.028],
      ['st5', 0.058, -0.004, [0.004, -0.006], [0.006, -0.011], [0.006, -0.018], [0.005, -0.023], [0.003, -0.026], -0.028],
      ['st6', 0.066, -0.014, [0.002, -0.015], [0.003, -0.018], [0.003, -0.022], [0.002, -0.026], [0.002, -0.029], -0.031],
    ],
    craniumCaps: { back: [0, -0.062, -0.005], tip: [0, 0.071, -0.034] },
    craniumBandGroups: { 'st3-st4': ['Cheek', 'Cheek', 'Cheek', 'Cheek', 'Cheek', 'Cheek'] },
    jawRows: [
      ['st0', 0.04, { gum: -0.026, gumR: [0.006, -0.026], jaw: [0.006, -0.03], bottom: -0.033 }],
      ['st1', 0.05, { gum: -0.026, gumR: [0.005, -0.026], jaw: [0.005, -0.029], bottom: -0.031 }],
      ['st2', 0.058, { gum: -0.027, gumR: [0.003, -0.027], jaw: [0.003, -0.029], bottom: -0.03 }],
      ['st3', 0.064, { gum: -0.029, gumR: [0.002, -0.029], jaw: [0.002, -0.03], bottom: -0.031 }],
    ],
    jawCaps: { back: [0, 0.035, -0.03], tip: [0, 0.066, -0.031] },
    headScale: 1, nape: [0, -0.03, -0.03],
    eyeAt: [3.3, 1.7], eyeR: 0.022, orbit: { open: [1, 1] },
    // the set eye (judged over the goggle discs, both orders): seated, wide open, a larger pupil
    eyeStyle: 'set', eyeSet: { sink: 0.35, open: [0.85, 0.75], pupil: 32 },
    browStrip: [[3.05, 1.0], [3.1, 1.25], [3.15, 1.5], [3.2, 1.8], [3.25, 2.1]],
    nostrilAt: [4.3, 1.4], noseAt: [4.3, 1.4], noseR: [0.002, 0.002],
    ears: true, earAt: [1.7, 1.2], earSpine: [[0, 0, 0], [0.008, -0.006, 0.03], [0.018, -0.012, 0.062]],
    earR: [0.011, 0.009, 0.005, 0.0015], earSquash: [1, 0.45],
    bodyTiles: [],
    // a small rounded wing (bones and tertials thinned to its size, its hidden core fitted to it), folded plane pitched 60°
    wings: { coreFit: true, pitch: 60,
      wing: featherWing({ arm: [0.09, 0.13, 0.09], secondaries: 14, secLen: 0.19, primLen: 0.2, primReach: 0.06, slotFrom: 0.6, slotBy: 0.3, width: 0.05,
        tertialLen: 0.45, tertialWidth: 0.5, boneR: 0.5 }),
      palette: { WingBone: '#6e5c47', FlightA: '#5b4a38', FlightB: '#6a5743', FlightC: '#4e3f30', FlightUnder: '#c2b49a',
        CovertA: '#7a6650', CovertB: '#86715a', CovertC: '#6b5845', CovertTip: '#c9b99c', CovertUnder: '#c2b49a',
        LesserA: '#7d6a55', LesserB: '#8a765f', LesserC: '#6f5c48', LesserTip: '#b9a98d' } },
  },

  // CHICKEN, a brown laying HEN (Gallus gallus domesticus). Thesis: a PLUMP egg-shaped body tilted a little nose-up on
  // short bare YELLOW legs, four toes (three forward), blunt claws · a small head with a short conical yellow bill ·
  // a red serrated COMB on the crown and two red WATTLES under the bill, red bare face · an UPRIGHT, laterally flat
  // tail fan rising behind · short wings folded flat on the sides · red-brown plumage. Size: a standard hen (e.g.
  // Rhode Island Red, ~2.9 kg) stands ~40 cm to the top of the comb (poultry breed standards; Wikipedia "Chicken"
  // gives cock 3–4 kg, hen ~2.5 kg); height target 0.40 m. Authored at size.
  chicken: {
    family: 'avian', name: 'a chicken (hen)', torsoUp: true, scale: 1,
    colors: { coat: '#8a4a24', sock: '#e0b23a', ash: '#a85f30', ashAlt: '#9a5428', belly: '#8a4a24', ears: '#c8302a', snout: '#e0b23a',
      brow: '#8a4a24', iris: '#d98a1e', sclera: '#d98a1e', nose: '#e0b23a', tip: '#5e3018', hoof: '#c9a14a', mane: '#a85f30',
      lids: '#8a4a24', pad: '#c8302a', folds: '#c8302a' },
    headPalette: { Comb: '#c8202a', LidRim: '#c8302a', Nostrils: '#e0b23a' },
    joints: { neckBase: [0, 0.09, 0.29], neckTop: [0, 0.11, 0.36], wingRoot: [0.08, 0.04, 0.27],
      hip: [0.05, -0.02, 0.17], knee: [0.06, 0.04, 0.11], ankle: [0.05, 0.0, 0.025],
      toeF: [0.05, 0.075, 0.008], toeI: [0.02, 0.06, 0.008], toeO: [0.085, 0.055, 0.008], toeB: [0.05, -0.035, 0.008],
      clawF: [0.05, 0.09, 0.003], clawI: [0.013, 0.072, 0.003], clawO: [0.095, 0.066, 0.003], clawB: [0.05, -0.048, 0.003] },
    torso: [
      { at: [0, -0.15, 0.22], r: [0.06, 0.05] },
      { at: [0, -0.10, 0.225], r: [0.11, 0.10] },
      { at: [0, -0.02, 0.235], r: [0.125, 0.12] },
      { at: [0, 0.06, 0.255], r: [0.11, 0.11] },
      { at: [0, 0.10, 0.285], r: [0.07, 0.07] },
    ],
    torsoCaps: { back: [0, -0.18, 0.22], tip: [0, 0.12, 0.31] },
    neckRA: [0.06, 0.06], neckRB: [0.028, 0.028], neckRMid: [0.037, 0.037], neckGroup: 'Coat',
    tail: [[0, -0.15, 0.26, [0.018, 0.06]], [0, -0.17, 0.31, [0.015, 0.075]], [0, -0.18, 0.37, [0.012, 0.08]]],
    tip: [[0, -0.178, 0.365, [0.012, 0.08]], [0, -0.183, 0.40, [0.01, 0.065]], [0, -0.185, 0.43, [0.006, 0.04]]],
    tipCaps: { back: [0, -0.175, 0.35], tip: [0, -0.186, 0.44] },
    legs: [
      ['thighR', 'hip', 'knee', [0.04, 0.045], [0.03, 0.03], 'Coat', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.012, 0.011, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.008, 0.006, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.007, 0.006, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.007, 0.006, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.007, 0.006, 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.005, 0.002, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.005, 0.002, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.005, 0.002, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.005, 0.002, 'Hoof', [0.3, 0.3]],
    ],
    // a small skull (st0–st3), a SHORT CONICAL bill (st3–st6), no hook
    craniumRows: [
      ['st0', -0.05, 0.03, [0.015, 0.028], [0.03, 0.012], [0.032, -0.006], [0.026, -0.02], [0.018, -0.027], -0.03],
      ['st1', -0.02, 0.04, [0.02, 0.038], [0.035, 0.018], [0.037, -0.003], [0.03, -0.019], [0.02, -0.027], -0.029],
      ['st2', 0.01, 0.036, [0.018, 0.034], [0.032, 0.014], [0.033, -0.005], [0.027, -0.018], [0.018, -0.025], -0.027],
      ['st3', 0.035, 0.022, [0.012, 0.02], [0.018, 0.008], [0.019, -0.006], [0.016, -0.015], [0.012, -0.02], -0.022],
      ['st4', 0.055, 0.012, [0.007, 0.011], [0.011, 0.003], [0.011, -0.007], [0.009, -0.013], [0.007, -0.017], -0.018],
      ['st5', 0.072, 0.003, [0.004, 0.002], [0.006, -0.003], [0.006, -0.009], [0.005, -0.013], [0.004, -0.015], -0.016],
      ['st6', 0.083, -0.006, [0.002, -0.007], [0.003, -0.009], [0.003, -0.012], [0.002, -0.014], [0.002, -0.015], -0.016],
    ],
    craniumCaps: { back: [0, -0.065, 0.0], tip: [0, 0.088, -0.012] },
    craniumBandGroups: { 'st0-st1': band('Skull'), 'st1-st2': ['Skull', 'Skull', 'Ears', 'Ears', 'Ears', 'Ears'], 'st2-st3': ['Skull', 'Skull', 'Ears', 'Ears', 'Ears', 'Ears'] },
    jawRows: [
      ['st0', 0.03, { gum: -0.022, gumR: [0.012, -0.022], jaw: [0.012, -0.027], bottom: -0.03 }],
      ['st1', 0.05, { gum: -0.018, gumR: [0.008, -0.018], jaw: [0.008, -0.022], bottom: -0.024 }],
      ['st2', 0.065, { gum: -0.016, gumR: [0.005, -0.016], jaw: [0.005, -0.019], bottom: -0.02 }],
      ['st3', 0.076, { gum: -0.015, gumR: [0.003, -0.015], jaw: [0.003, -0.017], bottom: -0.018 }],
    ],
    jawCaps: { back: [0, 0.02, -0.025], tip: [0, 0.08, -0.016] },
    // the eye back on the side of the head (mid-skull, behind the bill base); no mammal nose pad, a bill-coloured nostril
    headScale: 0.6, eyeAt: [1.4, 2.4], eyeR: 0.012, nose: false,
    // the brow raised clear of the moved-back eye (it clamped the upper lid shut over it)
    browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
    eyeStyle: 'set', eyeSet: { sink: 0.3, open: [0.85, 0.75], pupil: 30 },
    // the COMB: three flat lobes standing on the crown midline; the WATTLES: two lobes hanging under the bill base
    headOrnaments: [
      ...[[0.6, 0.018], [1.4, 0.024], [2.2, 0.021], [2.9, 0.014]].map(([r, h], i) => ({ kind: 'sweep', name: `comb${i}`, at: [r, 0], space: 'local',
        spine: [[0, 0, -0.004], [0, 0, h * 0.6], [0, 0, h]], radii: [0.009, 0.008, 0.005, 0.001], m: 8, squash: [0.3, 1], group: 'Comb' })),
      { kind: 'sweep', name: 'wattle', at: [3.1, 5.5], space: 'local', spine: [[0, 0, -0.004], [0, 0.004, 0.015], [0, 0.002, 0.026]], radii: [0.008, 0.011, 0.009, 0.002], m: 8, squash: [0.5, 1], group: 'Comb' },
    ],
    bodyTiles: [],
    wings: { coreFit: true, pitch: 15,
      wing: featherWing({ arm: [0.07, 0.1, 0.07], secondaries: 12, secLen: 0.14, primLen: 0.15, primReach: 0.03, slotFrom: 0.9, slotBy: 0.1, width: 0.04,
        tertialLen: 0.35, tertialWidth: 0.4, boneR: 0.4 }),
      palette: { WingBone: '#8a4a24', FlightA: '#6e3a1c', FlightB: '#7a4220', FlightC: '#5e3018', FlightUnder: '#a06a40',
        CovertA: '#9a5428', CovertB: '#a85f30', CovertC: '#8a4a24', CovertTip: '#9a5428', CovertUnder: '#a06a40',
        LesserA: '#a85f30', LesserB: '#b06838', LesserC: '#9a5428', LesserTip: '#a85f30' } },
  },
  // MALLARD drake (Anas platyrhynchos). Thesis: a LOW, LEVEL boat-shaped body on very short legs set far back · bare
  // ORANGE WEBBED feet, three front toes joined by the web · a rounded GLOSSY GREEN head on a short neck · a FLAT,
  // BROAD, spatulate YELLOW bill as long as the skull · a short upcurled tail · wings folded along the back · grey
  // body. Size: published length 50–65 cm, span 81–98 cm (Wikipedia, "Mallard"); standing, head top ~0.30 m (height
  // target). Authored at size.
  mallard: {
    family: 'avian', name: 'a mallard (drake)', scale: 1,
    colors: { coat: '#9c9a94', sock: '#e8842a', ash: '#1f5a3a', ashAlt: '#1f5a3a', belly: '#b9b6ae', ears: '#1f5a3a', snout: '#d8be3a',
      brow: '#1f5a3a', iris: '#7a4a1e', sclera: '#7a4a1e', nose: '#d8be3a', tip: '#1a1a1a', hoof: '#c86a20', mane: '#1f5a3a',
      lids: '#1f5a3a', pad: '#1f5a3a', folds: '#1f5a3a', skull: '#1f5a3a' },
    headPalette: { Skull: '#1f5a3a', Jaw: '#d8be3a', LidRim: '#1f5a3a', Nostrils: '#d8be3a' },
    joints: { neckBase: [0, 0.12, 0.18], neckTop: [0, 0.145, 0.245], wingRoot: [0.07, 0.08, 0.20],
      hip: [0.05, -0.04, 0.10], knee: [0.06, 0.0, 0.07], ankle: [0.05, -0.01, 0.02],
      toeF: [0.05, 0.065, 0.005], toeI: [0.015, 0.05, 0.005], toeO: [0.09, 0.045, 0.005], toeB: [0.05, -0.025, 0.01],
      clawF: [0.05, 0.072, 0.003], clawI: [0.01, 0.056, 0.003], clawO: [0.096, 0.051, 0.003], clawB: [0.05, -0.03, 0.008] },
    torso: [
      { at: [0, -0.20, 0.15], r: [0.06, 0.05] },
      { at: [0, -0.12, 0.15], r: [0.10, 0.08] },
      { at: [0, -0.02, 0.15], r: [0.11, 0.09] },
      { at: [0, 0.08, 0.15], r: [0.10, 0.085] },
      { at: [0, 0.14, 0.15], r: [0.07, 0.07] },
    ],
    torsoCaps: { back: [0, -0.25, 0.16], tip: [0, 0.18, 0.16] },
    neckRA: [0.045, 0.045], neckRB: [0.028, 0.028], neckRMid: [0.031, 0.031], neckGroup: 'Mane',
    tail: [[0, -0.22, 0.17, [0.05, 0.02]], [0, -0.27, 0.18, [0.045, 0.015]], [0, -0.30, 0.19, [0.035, 0.01]]],
    tip: [[0, -0.295, 0.19, [0.02, 0.01]], [0, -0.30, 0.21, [0.012, 0.008]], [0, -0.29, 0.225, [0.006, 0.005]]],
    tipCaps: { back: [0, -0.29, 0.185], tip: [0, -0.285, 0.23] },
    legs: [
      ['thighR', 'hip', 'knee', [0.03, 0.035], [0.022, 0.022], 'Coat', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.01, 0.009, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.006, 0.005, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.005, 0.004, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.005, 0.004, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.004, 0.003, 'Sock', [0.4, 0.4]],
      // the WEB: a flat paddle (stable ring frame, thin vertically) from the ankle fanning out to the front toes
      ['paddleR', 'ankle', 'toeF', [0.008, 0.002], [0.04, 0.002], 'Sock', [0.2, 0.1], null, { up: [0, 0, 1] }],
      ['clawFR', 'toeF', 'clawF', 0.004, 0.002, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.004, 0.002, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.004, 0.002, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.003, 0.002, 'Hoof', [0.3, 0.3]],
    ],
    // a rounded skull (st0–st2) and a FLAT, BROAD bill (st3–st6): wide at the sides, thin top to bottom, spatulate tip
    craniumRows: [
      ['st0', -0.03, 0.025, [0.015, 0.024], [0.024, 0.012], [0.026, -0.004], [0.02, -0.016], [0.012, -0.022], -0.024],
      ['st1', -0.005, 0.03, [0.018, 0.028], [0.026, 0.014], [0.027, -0.004], [0.021, -0.016], [0.013, -0.021], -0.023],
      ['st2', 0.02, 0.026, [0.016, 0.024], [0.023, 0.011], [0.024, -0.005], [0.019, -0.014], [0.012, -0.018], -0.02],
      ['st3', 0.035, 0.012, [0.0144, 0.011], [0.0204, 0.004], [0.0204, -0.004], [0.018, -0.008], [0.0144, -0.01], -0.011],
      ['st4', 0.055, 0.006, [0.0144, 0.005], [0.0192, 0.001], [0.0192, -0.003], [0.0168, -0.006], [0.0132, -0.008], -0.008],
      ['st5', 0.075, 0.002, [0.0156, 0.001], [0.0204, -0.002], [0.0204, -0.005], [0.018, -0.007], [0.0144, -0.008], -0.008],
      ['st6', 0.088, -0.001, [0.0144, -0.002], [0.018, -0.004], [0.018, -0.006], [0.0156, -0.007], [0.0132, -0.008], -0.008],
    ],
    craniumCaps: { back: [0, -0.042, 0.0], tip: [0, 0.091, -0.004] },
    jawRows: [
      ['st0', 0.03, { gum: -0.011, gumR: [0.014, -0.011], jaw: [0.013, -0.014], bottom: -0.016 }],
      ['st1', 0.055, { gum: -0.008, gumR: [0.014, -0.008], jaw: [0.013, -0.011], bottom: -0.012 }],
      ['st2', 0.075, { gum: -0.008, gumR: [0.013, -0.008], jaw: [0.012, -0.01], bottom: -0.011 }],
      ['st3', 0.086, { gum: -0.008, gumR: [0.009, -0.008], jaw: [0.008, -0.009], bottom: -0.01 }],
    ],
    jawCaps: { back: [0, 0.02, -0.014], tip: [0, 0.09, -0.009] },
    headScale: 1, nape: [0, -0.03, -0.01], eyeAt: [1.2, 2.4], eyeR: 0.009, nose: false,
    eyeStyle: 'set', eyeSet: { sink: 0.2, open: [0.85, 0.75], pupil: 30 },
    browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
    nostrilAt: [3.6, 1.2], noseAt: [3.6, 1.2], noseR: [0.002, 0.002],
    // the drake's WHITE NECK RING low on the green neck and the CHESTNUT BREAST on the trunk front
    markings: [
      { on: 'neck', kind: 'band', run: [0.2, 0.32], group: 'Collar', color: '#f2f0ea' },
      { on: 'torso', kind: 'band', run: [0.78, 1], t: [0.3, 1], group: 'Breast', color: '#6b3a26', caps: ['tip'] },
    ],
    bodyTiles: [],
    wings: { coreFit: true, pitch: 4,
      wing: featherWing({ arm: [0.08, 0.12, 0.08], secondaries: 12, secLen: 0.15, primLen: 0.17, primReach: 0.03, slotFrom: 0.95, slotBy: 0.1, width: 0.04,
        tertialLen: 0.4, tertialWidth: 0.45, boneR: 0.4 }),
      palette: { WingBone: '#7d776c', FlightA: '#6a6359', FlightB: '#5e584f', FlightC: '#746d62', FlightUnder: '#c9c6bf',
        CovertA: '#8a847a', CovertB: '#948e84', CovertC: '#7d776c', CovertTip: '#3a4fa0', CovertUnder: '#c9c6bf',
        LesserA: '#8f897f', LesserB: '#99938a', LesserC: '#857f75', LesserTip: '#8f897f' } },
  },
  // EMPEROR PENGUIN (Aptenodytes forsteri). Thesis: a TALL UPRIGHT torpedo standing on its heels, no visible legs, short
  // black feet flat on the ice and a stiff short tail touching behind · stiff narrow FLIPPERS hanging at the sides in
  // place of feathered wings · BLACK back, head and flippers, WHITE front, a YELLOW-ORANGE ear patch on each side of
  // the neck · a long slim slightly decurved bill with an orange lower plate. Size: published standing height
  // 100–122 cm, ~1.15 m typical (Wikipedia, "Emperor penguin"); height target 1.10 m. Authored at ~1.0 and scaled.
  emperorPenguin: {
    family: 'avian', name: 'an emperor penguin', torsoUp: true, scale: 1.12,
    colors: { coat: '#f2f0ea', sock: '#1a1a1c', ash: '#141416', ashAlt: '#141416', belly: '#141416', ears: '#141416', snout: '#1a1a1c',
      brow: '#141416', iris: '#2a1a12', sclera: '#2a1a12', nose: '#1a1a1c', tip: '#141416', hoof: '#0e0e10', mane: '#141416',
      lids: '#141416', pad: '#141416', folds: '#141416', skull: '#141416' },
    headPalette: { Skull: '#141416', Jaw: '#e8823a', LidRim: '#141416', Patch: '#f2b830' },
    joints: { neckBase: [0, 0.02, 0.80], neckTop: [0, 0.06, 0.90], wingRoot: [0.15, 0.0, 0.66],
      flipperRoot: [0.17, -0.01, 0.68], flipperTip: [0.215, -0.04, 0.30],
      hip: [0.08, -0.02, 0.12], knee: [0.09, 0.03, 0.05], ankle: [0.08, 0.04, 0.018],
      toeF: [0.08, 0.13, 0.008], toeI: [0.05, 0.12, 0.008], toeO: [0.11, 0.11, 0.008], toeB: [0.08, 0.0, 0.008],
      clawF: [0.08, 0.145, 0.004], clawI: [0.045, 0.133, 0.004], clawO: [0.12, 0.122, 0.004], clawB: [0.08, -0.01, 0.004] },
    torso: [
      { at: [0, -0.05, 0.10], r: [0.12, 0.10] },
      { at: [0, -0.03, 0.28], r: [0.22, 0.19] },
      { at: [0, -0.01, 0.48], r: [0.19, 0.17] },
      { at: [0, 0.01, 0.66], r: [0.15, 0.13] },
      { at: [0, 0.03, 0.80], r: [0.10, 0.09] },
    ],
    torsoCaps: { back: [0, -0.07, 0.04], tip: [0, 0.04, 0.86] },
    neckRA: [0.1, 0.09], neckRB: [0.06, 0.06], neckRMid: [0.075, 0.075], neckGroup: 'Mane',
    tail: [[0, -0.14, 0.14, [0.06, 0.02]], [0, -0.19, 0.08, [0.05, 0.015]], [0, -0.22, 0.03, [0.035, 0.01]]],
    tip: [[0, -0.215, 0.035, [0.03, 0.01]], [0, -0.23, 0.015, [0.02, 0.008]], [0, -0.235, 0.008, [0.01, 0.005]]],
    tipCaps: { back: [0, -0.21, 0.04], tip: [0, -0.238, 0.005] },
    legs: [
      ['thighR', 'hip', 'knee', [0.045, 0.05], [0.035, 0.035], 'Sock', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.025, 0.022, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.016, 0.01, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.014, 0.009, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.014, 0.009, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.012, 0.008, 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.008, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.007, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.007, 0.003, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.006, 0.003, 'Hoof', [0.3, 0.3]],
    ],
    // a smooth rounded skull (st0–st2) and a LONG SLIM bill (st3–st6) curving down a little at the tip
    craniumRows: [
      ['st0', -0.05, 0.04, [0.03, 0.038], [0.045, 0.018], [0.047, -0.005], [0.04, -0.025], [0.025, -0.035], -0.038],
      ['st1', -0.015, 0.045, [0.032, 0.042], [0.048, 0.02], [0.05, -0.005], [0.042, -0.026], [0.026, -0.036], -0.039],
      ['st2', 0.02, 0.035, [0.026, 0.033], [0.038, 0.015], [0.04, -0.006], [0.034, -0.022], [0.022, -0.03], -0.032],
      ['st3', 0.05, 0.016, [0.012, 0.015], [0.016, 0.006], [0.017, -0.004], [0.015, -0.01], [0.011, -0.014], -0.016],
      ['st4', 0.08, 0.008, [0.008, 0.007], [0.01, 0.002], [0.01, -0.004], [0.009, -0.008], [0.007, -0.01], -0.011],
      ['st5', 0.11, 0.0, [0.005, -0.001], [0.006, -0.004], [0.006, -0.008], [0.005, -0.01], [0.004, -0.012], -0.012],
      ['st6', 0.13, -0.01, [0.003, -0.011], [0.004, -0.013], [0.004, -0.015], [0.003, -0.016], [0.002, -0.017], -0.017],
    ],
    craniumCaps: { back: [0, -0.068, 0.0], tip: [0, 0.136, -0.016] },
    craniumBandGroups: { 'st0-st1': band('Skull'), 'st1-st2': band('Skull'), 'st2-st3': band('Skull') },
    jawRows: [
      ['st0', 0.05, { gum: -0.016, gumR: [0.013, -0.016], jaw: [0.012, -0.021], bottom: -0.024 }],
      ['st1', 0.08, { gum: -0.012, gumR: [0.009, -0.012], jaw: [0.008, -0.016], bottom: -0.018 }],
      ['st2', 0.11, { gum: -0.013, gumR: [0.005, -0.013], jaw: [0.005, -0.016], bottom: -0.017 }],
      ['st3', 0.128, { gum: -0.016, gumR: [0.003, -0.016], jaw: [0.003, -0.018], bottom: -0.019 }],
    ],
    jawCaps: { back: [0, 0.035, -0.022], tip: [0, 0.133, -0.018] },
    headScale: 1.15, nape: [0, -0.04, -0.02], eyeAt: [1.6, 2.3], eyeR: 0.008,
    nostrilAt: [3.6, 1.2], noseAt: [3.6, 1.2], noseR: [0.002, 0.002],
    // the yellow EAR PATCH: a flat comma behind the cheek on each side of the head
    headOrnaments: [{ kind: 'sweep', name: 'earPatch', at: [0.5, 3.4], space: 'local', spine: [[0, 0, -0.006], [0, -0.012, -0.004], [0, -0.03, -0.04], [0, -0.04, -0.07]],
      radii: [0.04, 0.045, 0.035, 0.02, 0.006], m: 8, squash: [1, 0.3], group: 'Patch' }],
    bodyTiles: [],
    // NO feathered wings: stiff flat FLIPPERS (thin across, broad fore-aft) hang from the shoulders; the black MANTLE
    // is a second trunk loft set back a little, so the back and sides are black and the front stays white
    wings: null,
    extraSegments: [
      { name: 'flipperR', kind: 'segment', from: 'flipperRoot', to: 'flipperTip', rA: [0.018, 0.055], rB: [0.008, 0.02], rMid: [0.02, 0.06], slots: 'ring12', over: [0.3, 0.4], group: 'Mane', mirror: 'name' },
      { name: 'mantle', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
        { at: [0, -0.08, 0.12], r: [0.125, 0.10] }, { at: [0, -0.06, 0.28], r: [0.225, 0.18] }, { at: [0, -0.04, 0.48], r: [0.195, 0.16] },
        { at: [0, -0.02, 0.66], r: [0.155, 0.125] }, { at: [0, 0.0, 0.80], r: [0.105, 0.085] }],
        caps: { back: [0, -0.09, 0.06], tip: [0, 0.01, 0.86] } },
    ],
  },
  // SCARLET MACAW (Ara macao). Thesis: an upright perched parrot, trunk tilted ~40° like the eagle's · a BIG HEAD with a
  // huge deep strongly HOOKED pale upper bill over a black lower bill, a bare WHITE face round a pale eye · a very
  // LONG POINTED TAIL (over half the length) sloping back to the ground · ZYGODACTYL feet, two toes forward and two
  // back, on short grey tarsi · scarlet body, wings with a YELLOW covert band and BLUE flight feathers. Size: published
  // length 81–96 cm, more than half of it tail (Wikipedia, "Scarlet macaw"); perched upright the head top stands
  // ~0.40 m (height target). Authored on the eagle's tables and scaled.
  macaw: {
    family: 'avian', name: 'a scarlet macaw', torsoUp: true, scale: 0.45,
    colors: { coat: '#cf1f27', sock: '#8a8580', ash: '#cf1f27', ashAlt: '#cf1f27', belly: '#cf1f27', ears: '#cf1f27', snout: '#ece2c8',
      brow: '#cf1f27', iris: '#2a2018', sclera: '#e8e0c8', nose: '#ece2c8', tip: '#2a50b0', hoof: '#2a2624', mane: '#cf1f27',
      lids: '#f2eee6', pad: '#f2eee6', folds: '#f2eee6', skull: '#cf1f27' },
    headPalette: { Jaw: '#1e1a18', Face: '#f2eee6', LidRim: '#3a3330' },
    joints: { neckBase: [0, 0.15, 0.68], neckTop: [0, 0.19, 0.78], wingRoot: [0.13, 0.09, 0.67],
      hip: [0.09, -0.04, 0.36], knee: [0.11, 0.07, 0.16], ankle: [0.10, 0.04, 0.05],
      // ZYGODACTYL: toes 2 and 3 forward (toeF, toeI), toes 1 and 4 back (toeB, toeO)
      toeF: [0.07, 0.17, 0.02], toeI: [0.13, 0.15, 0.02], toeO: [0.13, -0.07, 0.02], toeB: [0.07, -0.08, 0.02],
      clawF: [0.065, 0.21, 0.006], clawI: [0.14, 0.19, 0.006], clawO: [0.14, -0.11, 0.006], clawB: [0.065, -0.12, 0.006] },
    torso: [
      { at: [0, -0.30, 0.37], r: [0.09, 0.07] },
      { at: [0, -0.19, 0.45], r: [0.15, 0.13] },
      { at: [0, -0.06, 0.54], r: [0.18, 0.16] },
      { at: [0, 0.06, 0.62], r: [0.17, 0.16] },
      { at: [0, 0.15, 0.69], r: [0.11, 0.11] },
    ],
    torsoCaps: { back: [0, -0.35, 0.33], tip: [0, 0.19, 0.73] },
    neckRA: [0.1, 0.1], neckRB: [0.07, 0.07], neckRMid: [0.08, 0.08],
    // the LONG POINTED TAIL: flat (wide across, thin up-down), sloping from the rump back to the ground, blue at the tip
    tail: [[0, -0.31, 0.35, [0.08, 0.03]], [0, -0.55, 0.24, [0.075, 0.025]], [0, -0.80, 0.13, [0.055, 0.02]]],
    tip: [[0, -0.78, 0.14, [0.05, 0.018]], [0, -1.0, 0.06, [0.032, 0.012]], [0, -1.15, 0.02, [0.014, 0.006]]],
    tipCaps: { back: [0, -0.76, 0.15], tip: [0, -1.2, 0.012] },
    legs: [
      ['thighR', 'hip', 'knee', [0.08, 0.09], [0.06, 0.06], 'Coat', [0.4, 0.4]],
      ['tarsusR', 'knee', 'ankle', 0.035, 0.032, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', 0.026, 0.018, 'Sock', [0.4, 0.4]],
      ['toeIR', 'ankle', 'toeI', 0.024, 0.017, 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', 0.024, 0.017, 'Sock', [0.4, 0.4]],
      ['toeBR', 'ankle', 'toeB', 0.024, 0.017, 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.015, 0.005, 'Hoof', [0.3, 0.3]],
      ['clawIR', 'toeI', 'clawI', 0.014, 0.005, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.014, 0.005, 'Hoof', [0.3, 0.3]],
      ['clawBR', 'toeB', 'clawB', 0.015, 0.005, 'Hoof', [0.3, 0.3]],
    ],
    // a tall rounded skull (st0–st2) and a HUGE deep bill (st3–st6) whose culmen arches down into a long hook
    craniumRows: [
      ['st0', -0.05, 0.036, [0.022, 0.034], [0.038, 0.014], [0.04, -0.008], [0.034, -0.026], [0.024, -0.034], -0.037],
      ['st1', -0.02, 0.048, [0.026, 0.045], [0.044, 0.022], [0.046, -0.004], [0.04, -0.024], [0.028, -0.034], -0.036],
      ['st2', 0.01, 0.05, [0.025, 0.047], [0.042, 0.024], [0.043, -0.006], [0.036, -0.026], [0.026, -0.036], -0.038],
      ['st3', 0.04, 0.045, [0.02, 0.043], [0.03, 0.022], [0.03, -0.01], [0.026, -0.03], [0.02, -0.04], -0.042],
      ['st4', 0.065, 0.042, [0.016, 0.04], [0.022, 0.018], [0.022, -0.012], [0.019, -0.032], [0.014, -0.042], -0.045],
      ['st5', 0.085, 0.03, [0.012, 0.028], [0.016, 0.01], [0.016, -0.018], [0.013, -0.038], [0.01, -0.05], -0.054],
      ['st6', 0.097, 0.01, [0.007, 0.006], [0.009, -0.012], [0.009, -0.035], [0.007, -0.055], [0.005, -0.065], -0.07],
    ],
    craniumCaps: { back: [0, -0.062, 0.0], tip: [0, 0.098, -0.082] },
    // the bare WHITE face patch round the eye (cheek slots of st1–st3); the crown stays scarlet
    craniumBandGroups: { 'st0-st1': band('Ears'), 'st1-st2': ['Ears', 'Ears', 'Face', 'Face', 'Face', 'Face'], 'st2-st3': ['Ears', 'Ears', 'Face', 'Face', 'Face', 'Face'] },
    jawRows: [
      ['st0', 0.02, { gum: -0.035, gumR: [0.024, -0.035], jaw: [0.024, -0.05], bottom: -0.058 }],
      ['st1', 0.045, { gum: -0.04, gumR: [0.02, -0.04], jaw: [0.02, -0.055], bottom: -0.062 }],
      ['st2', 0.065, { gum: -0.045, gumR: [0.014, -0.045], jaw: [0.014, -0.056], bottom: -0.06 }],
      ['st3', 0.078, { gum: -0.05, gumR: [0.008, -0.05], jaw: [0.008, -0.055], bottom: -0.057 }],
    ],
    jawCaps: { back: [0, 0.0, -0.045], tip: [0, 0.083, -0.053] },
    browStrip: [[1.2, 1.9], [1.45, 1.9], [1.7, 1.95], [1.95, 2.05], [2.2, 2.2]],
    headScale: 1.5, eyeAt: [2.0, 2.2], eyeR: 0.011, nose: false,
    // the set eye (judged over the bulging white domes, both orders): seated in the bare face patch
    eyeStyle: 'set', eyeSet: { sink: 0.45, open: [0.75, 0.6] },
    bodyTiles: [],
    wings: { wing: featherWing({ arm: [0.17, 0.25, 0.17], secLen: 0.36, primLen: 0.4, primReach: 0.08, slotFrom: 0.8, slotBy: 0.2 }), pitch: 36,
      palette: { WingBone: '#cf1f27', FlightA: '#2a50b0', FlightB: '#2446a0', FlightC: '#3058b8', FlightUnder: '#c8a02a',
        CovertA: '#f2c230', CovertB: '#eab828', CovertC: '#f2c230', CovertTip: '#3a8a40', CovertUnder: '#c8a02a',
        LesserA: '#cf1f27', LesserB: '#c41c24', LesserC: '#d42630', LesserTip: '#cf1f27' } },
  },
};

// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  vulture: { common: 'vulture', aliases: ['griffon vulture'], sci: 'Gyps fulvus', size: '~1.0 m standing; span 2.3–2.8 m', source: 'Wikipedia / BirdLife' },
  baldEagle: { common: 'eagle', aliases: ['bald eagle', 'american eagle'], sci: 'Haliaeetus leucocephalus', size: 'length 0.70–1.02 m, span 1.8–2.3 m; perched ~0.80 m', source: 'Wikipedia, "Bald eagle"' },
  greatHornedOwl: { common: 'owl', aliases: ['great horned owl', 'hoot owl'], sci: 'Bubo virginianus', size: 'length 0.43–0.64 m; perched ~0.52 m', source: 'Wikipedia, "Great horned owl"' },
  chicken: { common: 'chicken', aliases: ['hen', 'fowl', 'poultry'], sci: 'Gallus gallus domesticus', size: '~0.40 m to the top of the comb', source: 'poultry breed standards' },
  mallard: { common: 'duck', aliases: ['mallard', 'drake', 'wild duck'], sci: 'Anas platyrhynchos', size: 'length 0.50–0.65 m; standing ~0.30 m', source: 'Wikipedia, "Mallard"' },
  emperorPenguin: { common: 'penguin', aliases: ['emperor penguin'], sci: 'Aptenodytes forsteri', size: '~1.10 m standing', source: 'Wikipedia, "Emperor penguin"' },
  macaw: { common: 'parrot', aliases: ['macaw', 'scarlet macaw'], sci: 'Ara macao', size: 'length 0.81–0.96 m, over half of it tail; perched ~0.40 m', source: 'Wikipedia, "Scarlet macaw"' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  flamingo: { near: 'mallard', aliases: ['pink flamingo'], note: 'very long thin legs and an S neck, a bent pink bill' },
  ostrich: { near: 'chicken', aliases: ['emu'], note: 'a huge flightless bird, a long bare neck, two-toed long legs' },
  rooster: { near: 'chicken', aliases: ['cock', 'cockerel'], note: 'the hen with a tall comb, long wattles and arching sickle tail feathers' },
  turkey: { near: 'chicken', aliases: [], note: 'a big fanned tail, a bare head with a red snood and wattle' },
  peacock: { near: 'chicken', aliases: ['peafowl', 'peahen'], note: 'a blue neck, a head crest, a long eyed train' },
  swan: { near: 'mallard', aliases: [], note: 'a long S neck, all white, an orange bill' },
  goose: { near: 'mallard', aliases: [], note: 'a bigger duck with a longer neck' },
  pigeon: { near: 'chicken', aliases: ['dove'], note: 'a small plump grey bird, a small head, an iridescent neck' },
  crow: { near: 'baldEagle', aliases: ['raven'], note: 'an all-black perched bird, a heavy straight bill' },
  toucan: { near: 'macaw', aliases: [], note: 'a huge bright banana bill, a black body, a white throat' },
  hummingbird: { near: 'macaw', aliases: [], note: 'tiny, a needle bill, wings a blur' },
};
