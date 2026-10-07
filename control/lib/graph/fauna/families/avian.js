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
  throat: false,   // a bird's throat is its feathered head (../build.js throat)
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

// ── shared tables for the birds built from the `wanted` list (data only; every species below still states its own numbers)
// the four-toed foot about an ankle at (x, y): three toes forward, the hallux back, claws past each toe; L the middle toe
const feet = (x, y, L) => ({
  toeF: [x, y + L, 0.1 * L], toeI: [x - 0.4 * L, y + 0.8 * L, 0.1 * L], toeO: [x + 0.47 * L, y + 0.73 * L, 0.1 * L], toeB: [x, y - 0.47 * L, 0.1 * L],
  clawF: [x, y + 1.2 * L, 0.04 * L], clawI: [x - 0.5 * L, y + 0.96 * L, 0.04 * L], clawO: [x + 0.6 * L, y + 0.88 * L, 0.04 * L], clawB: [x, y - 0.64 * L, 0.04 * L] });
// the leg rows: thigh, tarsus, the toes and their claws ([rA, rB] each); `web` adds the mallard's flat paddle
const legRows = (thigh, tarsus, toe, claw, { thighGroup = 'Coat', toes = ['F', 'I', 'O', 'B'], web = null } = {}) => [
  ['thighR', 'hip', 'knee', thigh[0], thigh[1], thighGroup, [0.4, 0.4]],
  ['tarsusR', 'knee', 'ankle', tarsus[0], tarsus[1], 'Sock', [0.4, 0.4]],
  ...toes.map((t) => [`toe${t}R`, 'ankle', `toe${t}`, toe[0], toe[1], 'Sock', [0.4, 0.4]]),
  ...(web ? [['paddleR', 'ankle', 'toeF', [web * 0.2, web * 0.05], [web, web * 0.05], 'Sock', [0.2, 0.1], null, { up: [0, 0, 1] }]] : []),
  ...toes.map((t) => [`claw${t}R`, `toe${t}`, `claw${t}`, claw[0], claw[1], 'Hoof', [0.3, 0.3]]),
];
// a wing palette from its tones: flight / covert / lesser each one colour or three
const wingPalette = ({ bone, flight, under, covert, covertTip, lesser, lesserTip }) => {
  const three = (c) => (Array.isArray(c) ? c : [c, c, c]), [fa, fb, fc] = three(flight), [ca, cb, cc] = three(covert), [la, lb, lc] = three(lesser ?? covert);
  return { WingBone: bone, FlightA: fa, FlightB: fb, FlightC: fc, FlightUnder: under, CovertA: ca, CovertB: cb, CovertC: cc, CovertTip: covertTip ?? ca, CovertUnder: under,
    LesserA: la, LesserB: lb, LesserC: lc, LesserTip: lesserTip ?? la };
};
// a short rounded wing (the chicken's): bones and tertials thinned to its size, its hidden core fitted to it
const roundWing = (arm, secLen, primLen, more = {}) => featherWing({ arm, secondaries: 12, secLen, primLen, primReach: 0.03, slotFrom: 0.9, slotBy: 0.1, width: 0.04,
  tertialLen: 0.35, tertialWidth: 0.4, boneR: 0.4, ...more });
// the galliform head (the chicken's): a small skull (st0–st3) and a short conical bill (st3–st6)
const FOWL_HEAD = {
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
  jawRows: [
    ['st0', 0.03, { gum: -0.022, gumR: [0.012, -0.022], jaw: [0.012, -0.027], bottom: -0.03 }],
    ['st1', 0.05, { gum: -0.018, gumR: [0.008, -0.018], jaw: [0.008, -0.022], bottom: -0.024 }],
    ['st2', 0.065, { gum: -0.016, gumR: [0.005, -0.016], jaw: [0.005, -0.019], bottom: -0.02 }],
    ['st3', 0.076, { gum: -0.015, gumR: [0.003, -0.015], jaw: [0.003, -0.017], bottom: -0.018 }],
  ],
  jawCaps: { back: [0, 0.02, -0.025], tip: [0, 0.08, -0.016] },
  eyeAt: [1.4, 2.4], nose: false, eyeStyle: 'set', eyeSet: { sink: 0.3, open: [0.85, 0.75], pupil: 30 },
  browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
};
// the anatid head (the mallard's): a rounded skull (st0–st2) and a flat broad bill (st3–st6)
const DUCK_HEAD = {
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
  nape: [0, -0.03, -0.01], eyeAt: [1.2, 2.4], nose: false, eyeStyle: 'set', eyeSet: { sink: 0.2, open: [0.85, 0.75], pupil: 30 },
  browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
  nostrilAt: [3.6, 1.2], noseAt: [3.6, 1.2], noseR: [0.002, 0.002],
};

// a DISPLAY FAN (the strutting turkey's): `n` broad flat rectrices a side plus the central one, radiating from a hub at
// `hub` over ±`spread` degrees from vertical, the fan's plane leaning back `lean` degrees; each feather `len` long,
// `w` its half-width at the tip, alternate feathers set `stagger` m apart front to back so the overlaps show their edges
// (stable ring frames, +y front: thin front to back). Names: 'fan0' on the midline, 'fan<i>R' mirrored by name.
const displayFan = ({ hub, n, spread, len, w, t = 0.008, lean = 10, stagger = 0.012, group = 'Tip', groupAlt = group }) => {
  const r4 = (x) => Math.round(x * 1e4) / 1e4, la = (lean * Math.PI) / 180;
  return Array.from({ length: n + 1 }, (_, i) => {
    const th = ((spread * i) / n) * (Math.PI / 180), d = [Math.sin(th), -Math.cos(th) * Math.sin(la), Math.cos(th) * Math.cos(la)];
    const y0 = hub[1] - (i % 2) * stagger, at = (s) => [r4(hub[0] + d[0] * s), r4(y0 + d[1] * s), r4(hub[2] + d[2] * s)];
    return { name: i ? `fan${i}R` : 'fan0', kind: 'loft', slots: 'ring12', group: i % 2 ? groupAlt : group, mirror: i ? 'name' : 'plane', up: [0, 1, 0],
      stations: [{ at: at(0.06 * len), r: [0.3 * w, t] }, { at: at(0.4 * len), r: [0.75 * w, t] }, { at: at(0.75 * len), r: [w, t] }, { at: at(0.94 * len), r: [0.92 * w, t * 0.8] }],
      caps: { back: at(0.02 * len), tip: at(1.02 * len) } };
  });
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
  // COMMON OSTRICH, a male (Struthio camelus). Thesis: the biggest bird, FLIGHTLESS · a huge round BLACK body on very
  // long bare PINK legs with heavy drumsticks, the heel high, TWO TOES (a big clawed third toe and a small fourth) ·
  // a LONG BARE grey-pink NECK straight up to a small flat head with HUGE eyes and a short flat broad bill · small
  // wings and a drooping tail of WHITE PLUMES. Size: published height 2.1–2.8 m (Wikipedia, "Common ostrich");
  // height target 2.4 m. Authored at size.
  ostrich: {
    family: 'avian', name: 'an ostrich (male)', scale: 1,
    colors: { coat: '#1b1918', sock: '#c99a90', ash: '#b9a49c', ashAlt: '#b9a49c', belly: '#bba7a0', ears: '#bba7a0', snout: '#d6bca6',
      brow: '#bba7a0', iris: '#3e2716', sclera: '#3e2716', nose: '#d6bca6', tip: '#f2efe8', hoof: '#3a3330', mane: '#1b1918',
      lids: '#bba7a0', pad: '#bba7a0', folds: '#bba7a0', skull: '#bba7a0' },
    headPalette: { Jaw: '#d6bca6', LidRim: '#2a2220', Nostrils: '#8a7060' },
    joints: { neckBase: [0, 0.36, 1.42], neckTop: [0, 0.47, 2.27], wingRoot: [0.27, 0.12, 1.42],
      hip: [0.17, -0.02, 1.16], knee: [0.19, -0.16, 0.56], ankle: [0.17, 0.02, 0.07],
      toeF: [0.15, 0.22, 0.03], toeO: [0.25, 0.15, 0.025], clawF: [0.15, 0.28, 0.012], clawO: [0.28, 0.19, 0.01] },
    torso: [
      { at: [0, -0.55, 1.30], r: [0.13, 0.11] },
      { at: [0, -0.38, 1.30], r: [0.31, 0.27] },
      { at: [0, -0.10, 1.30], r: [0.37, 0.32] },
      { at: [0, 0.18, 1.30], r: [0.33, 0.30] },
      { at: [0, 0.36, 1.30], r: [0.19, 0.19] },
    ],
    torsoCaps: { back: [0, -0.66, 1.30], tip: [0, 0.45, 1.30] },
    neckRA: [0.1, 0.1], neckRB: [0.045, 0.045], neckRMid: [0.05, 0.05], neckGroup: 'Belly',
    // the drooping WHITE plume tail (tail and tip both white)
    tailGroup: 'Tip',
    tail: [[0, -0.55, 1.38, [0.14, 0.06]], [0, -0.70, 1.33, [0.2, 0.07]], [0, -0.80, 1.22, [0.2, 0.06]]],
    tip: [[0, -0.78, 1.24, [0.2, 0.06]], [0, -0.86, 1.10, [0.17, 0.05]], [0, -0.88, 1.00, [0.1, 0.03]]],
    tipCaps: { back: [0, -0.75, 1.28], tip: [0, -0.89, 0.95] },
    // two toes: the big third (toeF, a heavy claw) and the small outer fourth (toeO); no inner toe, no hallux
    legs: [
      ['thighR', 'hip', 'knee', [0.14, 0.16], [0.06, 0.06], 'Sock', [0.4, 0.4], [0.1, 0.11]],
      ['tarsusR', 'knee', 'ankle', 0.05, 0.042, 'Sock', [0.4, 0.4]],
      ['toeFR', 'ankle', 'toeF', [0.042, 0.03], [0.034, 0.022], 'Sock', [0.4, 0.4]],
      ['toeOR', 'ankle', 'toeO', [0.028, 0.02], [0.02, 0.015], 'Sock', [0.4, 0.4]],
      ['clawFR', 'toeF', 'clawF', 0.022, 0.006, 'Hoof', [0.3, 0.3]],
      ['clawOR', 'toeO', 'clawO', 0.012, 0.004, 'Hoof', [0.3, 0.3]],
    ],
    // the duck's head with the bill cut short and broad: a flat skull, a short flat bill, HUGE eyes
    ...DUCK_HEAD, muzzleLen: 0.75, muzzleW: 1.15,
    craniumBandGroups: { 'st0-st1': band('Ears'), 'st1-st2': band('Ears'), 'st2-st3': band('Ears') },
    headScale: 1.45, eyeR: 0.016, eyeAt: [1.25, 2.35], eyeSet: { sink: 0.3, open: [0.9, 0.8], pupil: 34 },
    bodyTiles: [],
    // small wings held at the sides: black coverts, WHITE plumes
    wings: { coreFit: true, pitch: 6,
      wing: roundWing([0.16, 0.22, 0.16], 0.3, 0.34, { width: 0.07, primReach: 0.04 }),
      palette: wingPalette({ bone: '#1b1918', flight: ['#f2efe8', '#e8e4dc', '#f6f4ee'], under: '#e8e4dc', covert: ['#1b1918', '#24211f', '#1b1918'], lesser: '#1b1918' }) },
  },

  // ROOSTER, a cock (Gallus gallus domesticus). Thesis: the hen made male — TALLER and more upright on longer yellow
  // legs · a big upright serrated red COMB and long hanging red WATTLES · golden-orange HACKLES flowing from the neck
  // over the shoulders · a BLACK breast, a deep red back · long glossy black-green SICKLE feathers arching up and
  // over the tail. Size: a large-fowl cock stands ~0.6 m to the top of the comb (poultry breed standards; cock
  // 3–4 kg, Wikipedia "Chicken"); height target 0.60 m. Authored on the chicken's tables and scaled.
  rooster: {
    family: 'avian', name: 'a rooster', torsoUp: true, scale: 1.12,
    colors: { coat: '#8c2a12', sock: '#e0b23a', ash: '#b8501e', ashAlt: '#d9822b', belly: '#1d1b1a', ears: '#c8202a', snout: '#e0b23a',
      brow: '#8c2a12', iris: '#d98a1e', sclera: '#d98a1e', nose: '#e0b23a', tip: '#14261f', hoof: '#c9a14a', mane: '#d9822b',
      lids: '#c8202a', pad: '#c8202a', folds: '#c8202a', skull: '#d9822b' },
    headPalette: { Comb: '#c8202a', LidRim: '#c8202a', Nostrils: '#e0b23a', Skull: '#d9822b' },
    joints: { neckBase: [0, 0.09, 0.34], neckTop: [0, 0.115, 0.44], wingRoot: [0.08, 0.04, 0.31],
      hip: [0.05, -0.02, 0.21], knee: [0.06, 0.05, 0.13], ankle: [0.05, 0.0, 0.025], ...feet(0.05, 0.0, 0.07) },
    torso: [
      { at: [0, -0.14, 0.25], r: [0.06, 0.05] },
      { at: [0, -0.10, 0.26], r: [0.10, 0.095] },
      { at: [0, -0.02, 0.28], r: [0.115, 0.115] },
      { at: [0, 0.06, 0.31], r: [0.105, 0.105] },
      { at: [0, 0.10, 0.35], r: [0.07, 0.07] },
    ],
    torsoCaps: { back: [0, -0.17, 0.25], tip: [0, 0.12, 0.38] },
    neckRA: [0.06, 0.06], neckRB: [0.03, 0.03], neckRMid: [0.04, 0.04], neckGroup: 'Mane',
    tailGroup: 'Tip',
    tail: [[0, -0.15, 0.29, [0.02, 0.05]], [0, -0.17, 0.35, [0.016, 0.065]], [0, -0.185, 0.41, [0.014, 0.07]]],
    tip: [[0, -0.183, 0.4, [0.012, 0.065]], [0, -0.19, 0.44, [0.01, 0.055]], [0, -0.195, 0.47, [0.007, 0.035]]],
    tipCaps: { back: [0, -0.18, 0.39], tip: [0, -0.196, 0.485] },
    legs: legRows([[0.042, 0.047], [0.03, 0.03]], [0.013, 0.012], [0.008, 0.006], [0.005, 0.002]),
    ...FOWL_HEAD, headScale: 0.62,
    craniumBandGroups: { 'st0-st1': band('Skull'), 'st1-st2': ['Skull', 'Skull', 'Ears', 'Ears', 'Ears', 'Ears'], 'st2-st3': ['Skull', 'Skull', 'Ears', 'Ears', 'Ears', 'Ears'] },
    eyeR: 0.012,
    // the big single COMB (five tall flat lobes) and long WATTLES
    headOrnaments: [
      ...[[0.4, 0.022], [1.0, 0.034], [1.6, 0.04], [2.2, 0.036], [2.8, 0.024]].map(([r, h], i) => ({ kind: 'sweep', name: `comb${i}`, at: [r, 0], space: 'local',
        spine: [[0, 0, -0.004], [0, 0, h * 0.6], [-0.004, 0, h]], radii: [0.011, 0.01, 0.006, 0.001], m: 8, squash: [0.3, 1], group: 'Comb' })),
      { kind: 'sweep', name: 'wattle', at: [3.1, 5.5], space: 'local', spine: [[0, 0, -0.004], [0, 0.004, 0.022], [0, 0.002, 0.04]], radii: [0.009, 0.013, 0.011, 0.003], m: 8, squash: [0.5, 1], group: 'Comb' },
    ],
    // the black breast
    markings: [{ on: 'torso', kind: 'band', run: [0.45, 1], t: [0.55, 1], group: 'Breast', color: '#1d1b1a', caps: ['tip'] }],
    // golden HACKLES: long pointed feathers hanging from the neck over the shoulders
    bodyTiles: [
      { id: 'hackle', parts: ['neck'], s: [0.05, 1.0], t: [0, 6], grid: [8, 4], brick: true, sides: 3, coverage: 1.5, inset: 0.9, height: 0.035, lean: -1.3, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Mane', 'FurAlt'] },
    ],
    // the SICKLES: long flat feathers arching up and over the tail, the outer pair longest (stable +z ring frames)
    extraSegments: [['tailSickle', 0, 0.25, 0.045, 'plane'], ['tailSickleR', 0.016, 0.3, 0.06, 'name']].map(([name, x, reach, w, mirror]) => ({ name, kind: 'loft', slots: 'ring12', group: 'Tip', mirror, up: true,
      stations: [{ at: [x, -0.15, 0.34], r: [0.008, w * 0.6] }, { at: [x, -0.18 - reach * 0.15, 0.44 + reach * 0.1], r: [0.008, w] }, { at: [x, -0.20 - reach * 0.55, 0.47 + reach * 0.08], r: [0.007, w * 0.9] },
        { at: [x, -0.20 - reach * 0.9, 0.40], r: [0.005, w * 0.6] }],
      caps: { back: [x, -0.14, 0.32], tip: [x, -0.20 - reach, 0.35] } })),
    wings: { coreFit: true, pitch: 15,
      wing: roundWing([0.075, 0.105, 0.075], 0.15, 0.16),
      palette: wingPalette({ bone: '#8c2a12', flight: ['#5e3018', '#6e3a1c', '#4a2614'], under: '#3a2a20', covert: ['#14261f', '#1a2e26', '#14261f'], covertTip: '#14261f',
        lesser: ['#a8361a', '#b8401e', '#9a2e14'] }) },
  },

  // WILD TURKEY, a strutting tom (Meleagris gallopavo). Thesis: a big ROTUND bronze body on long pinkish legs · the
  // tail spread in a tall upright FAN behind, rust-tipped · a small BARE blue-white head on a bare red neck, a long
  // red SNOOD hanging over the short bill and a red WATTLE under the chin · a black BEARD hanging from the breast ·
  // barred black-and-white flight feathers. Size: published length 1.0–1.25 m, males 5–11 kg (Wikipedia, "Wild
  // turkey"); a strutting tom stands ~1.0 m to the top of the fan (height target). Authored at size.
  turkey: {
    family: 'avian', name: 'a wild turkey (tom)', torsoUp: true, scale: 1,
    colors: { coat: '#4e3620', sock: '#c49a8a', ash: '#4a3828', ashAlt: '#5b4630', belly: '#b8322a', ears: '#c4d6ea', snout: '#d8c8b0',
      brow: '#c4d6ea', iris: '#3a2a1a', sclera: '#3a2a1a', nose: '#d8c8b0', tip: '#7a4a26', hoof: '#5a4a40', mane: '#1e1a16',
      lids: '#c4d6ea', pad: '#c4d6ea', folds: '#c4d6ea', skull: '#c4d6ea' },
    headPalette: { Comb: '#c42a2a', LidRim: '#2a3a5a', Nostrils: '#a89880', Jaw: '#d8c8b0' },
    joints: { neckBase: [0, 0.22, 0.60], neckTop: [0, 0.26, 0.82], wingRoot: [0.18, 0.08, 0.56], beardTop: [0, 0.34, 0.56], beardTip: [0, 0.37, 0.43],
      hip: [0.12, -0.04, 0.38], knee: [0.13, 0.06, 0.22], ankle: [0.12, 0.03, 0.045], ...feet(0.12, 0.03, 0.11) },
    torso: [
      { at: [0, -0.30, 0.44], r: [0.11, 0.09] },
      { at: [0, -0.20, 0.46], r: [0.21, 0.19] },
      { at: [0, -0.05, 0.49], r: [0.25, 0.24] },
      { at: [0, 0.10, 0.53], r: [0.23, 0.23] },
      { at: [0, 0.20, 0.58], r: [0.14, 0.14] },
    ],
    torsoCaps: { back: [0, -0.36, 0.44], tip: [0, 0.27, 0.61] },
    neckRA: [0.08, 0.08], neckRB: [0.034, 0.034], neckRMid: [0.045, 0.045], neckGroup: 'Belly',
    // the tail proper: a short upright hub of coverts at the rump the fan's feathers spring from
    tail: [[0, -0.30, 0.48, [0.11, 0.05]], [0, -0.33, 0.55, [0.13, 0.045]], [0, -0.345, 0.61, [0.09, 0.035]]], tip: null,
    legs: legRows([[0.08, 0.09], [0.055, 0.055]], [0.022, 0.02], [0.014, 0.01], [0.008, 0.003]),
    ...FOWL_HEAD, headScale: 0.85, eyeR: 0.008,
    craniumBandGroups: { 'st0-st1': band('Ears'), 'st1-st2': band('Ears'), 'st2-st3': band('Ears') },
    // the SNOOD draped over the bill and hanging past its tip, the WATTLE under the chin
    headOrnaments: [
      { kind: 'sweep', name: 'snood', at: [3.0, 0], space: 'local', spine: [[0, 0, -0.004], [0.01, 0, 0.008], [0.03, 0, 0.011], [0.048, 0, 0.0], [0.055, 0, -0.03], [0.055, 0, -0.055]],
        radii: [0.006, 0.007, 0.006, 0.005, 0.005, 0.004, 0.002], m: 8, squash: [1, 1], group: 'Comb' },
      { kind: 'sweep', name: 'wattle', at: [2.2, 5.6], space: 'local', spine: [[0, 0, -0.004], [-0.004, 0.004, 0.02], [-0.012, 0.002, 0.045]], radii: [0.01, 0.015, 0.013, 0.003], m: 8, squash: [0.6, 1], group: 'Comb' },
    ],
    // the FAN's feathers: chestnut, crossed by narrow dark bars, then a broad black subterminal band and a pale buff
    // tip (the rim of the fan); the hub of coverts chestnut-tipped
    // the body BRONZE: a dark bronze ground, its feathers catching a copper sheen (markDensity gives them rings)
    markDensity: { torso: 3, ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`fan${i}`, 3])) },
    markings: [
      { on: 'torso', kind: 'patch', run: [0.1, 0.95], t: [0.05, 0.8], grid: [5, 3], brick: true, size: [0.45, 0.4], group: 'Sheen', color: '#674826' },
      { on: ['fan1', 'fan3', 'fan5', 'fan7'], kind: 'band', run: [0, 0.7], group: 'FanAlt', color: '#a8683a' },
      { on: Array.from({ length: 9 }, (_, i) => `fan${i}`), kind: 'stripes', run: [0.12, 0.66], count: 4, width: 0.2, group: 'FanBar', color: '#2a1c12' },
      { on: Array.from({ length: 9 }, (_, i) => `fan${i}`), kind: 'band', run: [0.7, 0.86], group: 'FanBand', color: '#16120e' },
      { on: Array.from({ length: 9 }, (_, i) => `fan${i}`), kind: 'band', run: [0.86, 1], group: 'FanTip', color: '#d0a868', caps: ['tip'] },
    ],
    bodyTiles: [],
    // the BEARD: a stiff black tuft hanging from the breast
    // the DISPLAY FAN: eight broad rectrices a side and the central one, a semicircle radiating from the rump (displayFan)
    extraSegments: [{ name: 'beard', kind: 'segment', from: 'beardTop', to: 'beardTip', rA: [0.02, 0.014], rB: [0.008, 0.005], slots: 'ring12', over: [0.3, 0.3], group: 'Mane', mirror: 'plane' },
      ...displayFan({ hub: [0, -0.34, 0.56], n: 8, spread: 84, len: 0.47, w: 0.05, lean: 12, stagger: 0.018 })],
    wings: { coreFit: true, pitch: 10,
      wing: roundWing([0.12, 0.17, 0.12], 0.24, 0.27, { secondaries: 14, primReach: 0.04 }),
      palette: wingPalette({ bone: '#3d2e22', flight: ['#2b2520', '#e8e2d4', '#2b2520'], under: '#8a7a6a', covert: ['#5a4430', '#6a5038', '#4e3a28'], covertTip: '#2a2018',
        lesser: ['#4a3828', '#56422e', '#3e2e20'] }) },
  },

  // INDIAN PEAFOWL, a peacock (Pavo cristatus). Thesis: a long-legged pheasant whose glossy BLUE neck and breast rise
  // to a small head with a FAN CREST of bare shafts tipped blue and white face stripes · a green scaled back · barred
  // buff wings over rufous primaries · the TRAIN: a long bronze-green sweep trailing to the ground behind, covered in
  // EYESPOTS. Size: published 1.0–1.15 m bill to tail, 1.95–2.25 m to the end of the train (Wikipedia, "Indian
  // peafowl"); stands ~0.95 m to the crest (height target, from that length). Authored at size.
  peacock: {
    family: 'avian', name: 'a peacock', torsoUp: true, scale: 1,
    colors: { coat: '#1f4fb0', sock: '#8a8478', ash: '#1f4fb0', ashAlt: '#2a5ec0', belly: '#1a2a4a', ears: '#1f56b8', snout: '#cbb89a',
      brow: '#1f56b8', iris: '#2a1a10', sclera: '#2a1a10', nose: '#cbb89a', tip: '#3f7a2e', hoof: '#4a463e', mane: '#1f56b8',
      lids: '#1f56b8', pad: '#1f56b8', folds: '#1f56b8', skull: '#1f56b8' },
    headPalette: { Crest: '#1f56b8', Face: '#f2f0ea', LidRim: '#1a2a4a', Jaw: '#cbb89a' },
    joints: { neckBase: [0, 0.15, 0.64], neckTop: [0, 0.21, 0.88], wingRoot: [0.11, 0.04, 0.60],
      hip: [0.08, -0.04, 0.44], knee: [0.09, 0.06, 0.27], ankle: [0.08, 0.03, 0.045], ...feet(0.08, 0.03, 0.09) },
    torso: [
      { at: [0, -0.26, 0.48], r: [0.07, 0.06] },
      { at: [0, -0.17, 0.50], r: [0.12, 0.11] },
      { at: [0, -0.05, 0.53], r: [0.14, 0.13] },
      { at: [0, 0.07, 0.57], r: [0.12, 0.12] },
      { at: [0, 0.14, 0.62], r: [0.08, 0.08] },
    ],
    torsoCaps: { back: [0, -0.31, 0.47], tip: [0, 0.18, 0.66] },
    neckRA: [0.07, 0.07], neckRB: [0.03, 0.03], neckRMid: [0.038, 0.038], neckGroup: 'Mane',
    // the true tail: a short stub under the train
    tail: [[0, -0.27, 0.50, [0.05, 0.02]], [0, -0.32, 0.48, [0.06, 0.018]], [0, -0.36, 0.46, [0.06, 0.015]]],
    tip: [[0, -0.355, 0.46, [0.055, 0.014]], [0, -0.38, 0.45, [0.05, 0.012]], [0, -0.40, 0.44, [0.04, 0.008]]],
    tipCaps: { back: [0, -0.35, 0.47], tip: [0, -0.41, 0.44] },
    legs: legRows([[0.055, 0.06], [0.04, 0.04]], [0.016, 0.014], [0.011, 0.008], [0.006, 0.002]),
    ...FOWL_HEAD, headScale: 0.62, eyeR: 0.008,
    craniumBandGroups: { 'st0-st1': band('Ears'), 'st1-st2': ['Ears', 'Ears', 'Face', 'Ears', 'Face', 'Ears'], 'st2-st3': ['Ears', 'Ears', 'Face', 'Ears', 'Face', 'Ears'] },
    // the CREST: a fan of bare shafts on the crown, each tipped with a blue bulb
    headOrnaments: [-0.012, -0.006, 0, 0.006, 0.012].map((dx, i) => ({ kind: 'sweep', name: `crest${i}`, at: [1.2 + 0.25 * i, 0], space: 'local',
      spine: [[0, 0, -0.003], [dx * 0.5, 0, 0.03], [dx, 0, 0.05], [dx * 1.1, 0, 0.058]], radii: [0.0018, 0.0016, 0.0016, 0.007, 0.002], m: 8, squash: [1, 0.5], group: 'Crest' })),
    // the green scaled back; the TRAIN's EYESPOTS (a bronze ring round a dark blue centre) on its top face
    markDensity: { tailTrain: 3 },
    markings: [
      { on: 'torso', kind: 'band', run: [0, 0.75], t: [0, 0.35], group: 'Back', color: '#2f6a3a' },
      { on: 'tailTrain', kind: 'patch', run: [0.25, 1], t: [0, 0.45], grid: [7, 3], brick: true, size: 0.75, group: 'Ocellus', color: '#c8a238' },
      { on: 'tailTrain', kind: 'patch', run: [0.25, 1], t: [0, 0.45], grid: [7, 3], brick: true, size: 0.4, group: 'OcellusEye', color: '#14286a' },
    ],
    bodyTiles: [],
    // the TRAIN: a long flat sweep from the rump to the ground (stable +z ring frame: lying flat)
    extraSegments: [{ name: 'tailTrain', kind: 'loft', slots: 'ring12', group: 'Tip', mirror: 'plane', up: true, stations: [
      { at: [0, -0.22, 0.53], r: [0.1, 0.03] }, { at: [0, -0.45, 0.41], r: [0.2, 0.03] }, { at: [0, -0.75, 0.23], r: [0.27, 0.025] },
      { at: [0, -1.05, 0.10], r: [0.30, 0.02] }, { at: [0, -1.35, 0.04], r: [0.26, 0.015] }, { at: [0, -1.55, 0.025], r: [0.14, 0.01] }],
      caps: { back: [0, -0.2, 0.55], tip: [0, -1.62, 0.022] } }],
    wings: { coreFit: true, pitch: 12,
      wing: roundWing([0.1, 0.14, 0.1], 0.2, 0.22, { secondaries: 14, primReach: 0.04 }),
      palette: wingPalette({ bone: '#2f6a3a', flight: ['#b0602a', '#a85826', '#b8682e'], under: '#8a6a4a', covert: ['#c8b48a', '#2a2420', '#c8b48a'], covertTip: '#2a2420',
        lesser: ['#2f6a3a', '#2a5ea0', '#2f6a3a'] }) },
  },
  // AMERICAN FLAMINGO (Phoenicopterus ruber). Thesis: a small deep-PINK body held high on VERY LONG THIN pink legs,
  // the backward-bending heel halfway up, webbed feet · a LONG thin neck in an S curve · a small head with a pale eye
  // and a thick BENT bill, pale at the base and BLACK at the downturned tip · wings folded with crimson coverts over
  // BLACK flight feathers. Size: published height 1.2–1.45 m (Wikipedia, "American flamingo"); height target 1.3 m.
  // Authored at size.
  flamingo: {
    family: 'avian', name: 'an American flamingo', scale: 1,
    colors: { coat: '#ef7a78', sock: '#e86f7a', ash: '#ef7a78', ashAlt: '#f08a86', belly: '#f29a94', ears: '#f08a86', snout: '#1e1a1c',
      brow: '#ef7a78', iris: '#e8c13a', sclera: '#e8c13a', nose: '#1e1a1c', tip: '#ef7a78', hoof: '#c85a64', mane: '#ef7a78',
      lids: '#f08a86', pad: '#f08a86', folds: '#f08a86', skull: '#ef7a78' },
    headPalette: { Skull: '#ef7a78', Jaw: '#f0d2c2', BillBase: '#f3d9c6', LidRim: '#c85a64', Nostrils: '#1e1a1c' },
    joints: { neckBase: [0, 0.235, 1.215], neckTop: [0, 0.255, 1.255], wingRoot: [0.10, 0.06, 0.92],
      hip: [0.07, -0.02, 0.83], knee: [0.075, -0.07, 0.45], ankle: [0.065, 0.0, 0.035], ...feet(0.065, 0.0, 0.075) },
    torso: [
      { at: [0, -0.30, 0.88], r: [0.07, 0.06] },
      { at: [0, -0.20, 0.88], r: [0.12, 0.11] },
      { at: [0, -0.05, 0.88], r: [0.14, 0.13] },
      { at: [0, 0.10, 0.88], r: [0.13, 0.12] },
      { at: [0, 0.20, 0.88], r: [0.08, 0.08] },
    ],
    torsoCaps: { back: [0, -0.36, 0.88], tip: [0, 0.27, 0.88] },
    neckRA: [0.024, 0.024], neckRB: [0.022, 0.022], neckRMid: [0.023, 0.023],
    tail: [[0, -0.30, 0.90, [0.05, 0.02]], [0, -0.36, 0.895, [0.05, 0.018]], [0, -0.40, 0.89, [0.04, 0.012]]],
    tip: [[0, -0.395, 0.89, [0.035, 0.011]], [0, -0.42, 0.885, [0.03, 0.009]], [0, -0.44, 0.88, [0.02, 0.006]]],
    tipCaps: { back: [0, -0.39, 0.892], tip: [0, -0.45, 0.878] },
    legs: legRows([[0.04, 0.045], [0.02, 0.02]], [0.012, 0.011], [0.007, 0.005], [0.004, 0.002], { web: 0.03 }),
    // a small skull (st0–st2) and the BENT bill: deep at the base (st3), kinked down past st4, the tip pointing down
    craniumRows: [
      ['st0', -0.03, 0.02, [0.012, 0.019], [0.019, 0.01], [0.02, -0.004], [0.016, -0.014], [0.01, -0.019], -0.021],
      ['st1', -0.01, 0.024, [0.014, 0.023], [0.021, 0.012], [0.022, -0.004], [0.017, -0.015], [0.011, -0.02], -0.022],
      ['st2', 0.012, 0.022, [0.013, 0.021], [0.018, 0.011], [0.019, -0.005], [0.016, -0.016], [0.011, -0.022], -0.024],
      ['st3', 0.03, 0.016, [0.009, 0.015], [0.013, 0.008], [0.014, -0.006], [0.012, -0.018], [0.009, -0.024], -0.026],
      ['st4', 0.055, 0.012, [0.007, 0.011], [0.01, 0.004], [0.011, -0.008], [0.01, -0.018], [0.008, -0.023], -0.025],
      ['st5', 0.075, 0.0, [0.006, -0.001], [0.008, -0.007], [0.009, -0.016], [0.008, -0.024], [0.006, -0.029], -0.031],
      ['st6', 0.086, -0.022, [0.004, -0.023], [0.006, -0.028], [0.006, -0.034], [0.005, -0.039], [0.004, -0.042], -0.044],
    ],
    craniumCaps: { back: [0, -0.042, 0.0], tip: [0, 0.09, -0.05] },
    craniumBandGroups: { 'st0-st1': band('Skull'), 'st1-st2': band('Skull'), 'st2-st3': band('Ears'), 'st3-st4': band('BillBase') },
    jawRows: [
      ['st0', 0.02, { gum: -0.026, gumR: [0.011, -0.026], jaw: [0.011, -0.034], bottom: -0.038 }],
      ['st1', 0.045, { gum: -0.026, gumR: [0.01, -0.026], jaw: [0.01, -0.036], bottom: -0.04 }],
      ['st2', 0.065, { gum: -0.031, gumR: [0.008, -0.031], jaw: [0.008, -0.038], bottom: -0.042 }],
      ['st3', 0.08, { gum: -0.04, gumR: [0.005, -0.04], jaw: [0.005, -0.045], bottom: -0.047 }],
    ],
    jawCaps: { back: [0, 0.01, -0.03], tip: [0, 0.086, -0.048] },
    headScale: 1, nape: [0, -0.03, -0.01], eyeAt: [1.3, 2.3], eyeR: 0.0065, nose: false,
    eyeStyle: 'set', eyeSet: { sink: 0.25, open: [0.85, 0.75], pupil: 24 },
    browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
    nostrilAt: [3.5, 1.4], noseAt: [3.5, 1.4], noseR: [0.002, 0.002],
    bodyTiles: [],
    // the S NECK: up and forward from the chest, back, then forward again under the head
    extraSegments: [{ name: 'longNeck', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
      { at: [0, 0.17, 0.90], r: 0.055 }, { at: [0, 0.26, 0.97], r: 0.034 }, { at: [0, 0.305, 1.05], r: 0.027 }, { at: [0, 0.29, 1.12], r: 0.025 },
      { at: [0, 0.225, 1.18], r: 0.025 }, { at: [0, 0.235, 1.235], r: 0.024 }],
      caps: { back: [0, 0.12, 0.86], tip: [0, 0.25, 1.265] } }],
    wings: { coreFit: true, pitch: 4,
      wing: roundWing([0.12, 0.17, 0.12], 0.22, 0.26, { secondaries: 14, primReach: 0.05, slotFrom: 0.8, slotBy: 0.2 }),
      palette: wingPalette({ bone: '#ef7a78', flight: ['#1e1a1c', '#2a2426', '#1e1a1c'], under: '#2a2426', covert: ['#e2485a', '#e85868', '#d84050'], lesser: ['#ef7a78', '#f08a86', '#e86e70'] }) },
  },

  // MUTE SWAN (Cygnus olor). Thesis: a big ALL-WHITE waterbird, a long boat-shaped body low on short black legs ·
  // a LONG neck held in a graceful S, the head bowed · an ORANGE bill with a BLACK KNOB at its base and a black face
  // patch between the bill and the eye · a short pointed tail. Size: published length 1.25–1.7 m, span 2.0–2.4 m
  // (Wikipedia, "Mute swan"); length target 1.3 m (rump to bill, the neck in its S). Authored on the mallard's
  // tables and scaled.
  swan: {
    family: 'avian', name: 'a mute swan', scale: 2.4,
    colors: { coat: '#f4f2ec', sock: '#2a2624', ash: '#f4f2ec', ashAlt: '#ebe8e0', belly: '#f4f2ec', ears: '#f4f2ec', snout: '#e8762a',
      brow: '#f4f2ec', iris: '#3a2a20', sclera: '#3a2a20', nose: '#e8762a', tip: '#f4f2ec', hoof: '#1e1a18', mane: '#f4f2ec',
      lids: '#f4f2ec', pad: '#f4f2ec', folds: '#f4f2ec', skull: '#f4f2ec' },
    headPalette: { Skull: '#f4f2ec', Jaw: '#e8762a', Mask: '#1a1716', LidRim: '#d8d4cc', Nostrils: '#1a1716' },
    joints: { neckBase: [0, 0.17, 0.43], neckTop: [0, 0.195, 0.465], wingRoot: [0.07, 0.08, 0.21],
      hip: [0.05, -0.04, 0.10], knee: [0.06, 0.0, 0.07], ankle: [0.05, -0.01, 0.02], ...feet(0.05, -0.01, 0.055) },
    torso: [
      { at: [0, -0.22, 0.15], r: [0.06, 0.05] },
      { at: [0, -0.13, 0.15], r: [0.10, 0.085] },
      { at: [0, -0.02, 0.15], r: [0.115, 0.095] },
      { at: [0, 0.08, 0.15], r: [0.105, 0.09] },
      { at: [0, 0.14, 0.15], r: [0.07, 0.07] },
    ],
    torsoCaps: { back: [0, -0.27, 0.16], tip: [0, 0.18, 0.16] },
    neckRA: [0.02, 0.02], neckRB: [0.018, 0.018], neckRMid: [0.019, 0.019],
    tail: [[0, -0.22, 0.17, [0.05, 0.02]], [0, -0.27, 0.18, [0.04, 0.015]], [0, -0.30, 0.19, [0.03, 0.01]]],
    tip: [[0, -0.295, 0.19, [0.02, 0.01]], [0, -0.305, 0.205, [0.012, 0.008]], [0, -0.30, 0.215, [0.006, 0.005]]],
    tipCaps: { back: [0, -0.29, 0.185], tip: [0, -0.295, 0.22] },
    legs: legRows([[0.03, 0.035], [0.022, 0.022]], [0.01, 0.009], [0.006, 0.005], [0.004, 0.002], { web: 0.035 }),
    ...DUCK_HEAD, headScale: 0.78, headPitch: -28, eyeR: 0.006,
    // the black face patch at the bill's base and the black KNOB on top of it
    craniumBandGroups: { 'st2-st3': ['Mask', 'Mask', 'Mask', 'Skull', 'Skull', 'Skull'] },
    headOrnaments: [{ kind: 'sweep', name: 'knob', at: [2.9, 0], space: 'local', spine: [[0, 0, -0.004], [0.002, 0, 0.006], [0.006, 0, 0.01]], radii: [0.009, 0.01, 0.007, 0.002], m: 8, squash: [0.9, 1], group: 'Mask' }],
    bodyTiles: [],
    extraSegments: [{ name: 'longNeck', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
      { at: [0, 0.12, 0.18], r: 0.05 }, { at: [0, 0.17, 0.24], r: 0.032 }, { at: [0, 0.19, 0.31], r: 0.028 }, { at: [0, 0.165, 0.37], r: 0.026 },
      { at: [0, 0.155, 0.42], r: 0.025 }, { at: [0, 0.18, 0.46], r: 0.023 }],
      caps: { back: [0, 0.08, 0.15], tip: [0, 0.195, 0.475] } }],
    wings: { coreFit: true, pitch: 6,
      wing: roundWing([0.08, 0.12, 0.08], 0.15, 0.17, { primReach: 0.03, slotFrom: 0.95 }),
      palette: wingPalette({ bone: '#f4f2ec', flight: ['#f4f2ec', '#ebe8e0', '#f0eee8'], under: '#e4e0d8', covert: ['#f4f2ec', '#efece6', '#f6f4f0'], lesser: '#f4f2ec' }) },
  },

  // CANADA GOOSE (Branta canadensis). Thesis: a big grey-brown goose on short black legs · a LONG BLACK NECK and black
  // head with a WHITE CHIN STRAP from cheek to cheek under the chin · a short black bill · a pale breast, the brown
  // back and wings scalloped with pale feather edges · a WHITE UNDERTAIL under a short black tail. Size: published
  // length 0.75–1.10 m, span 1.27–1.85 m (Wikipedia, "Canada goose"); length target 0.9 m (rump to bill). Authored
  // on the mallard's tables and scaled.
  canadaGoose: {
    family: 'avian', name: 'a Canada goose', scale: 1.75,
    colors: { coat: '#7a6a58', sock: '#1e1c1a', ash: '#151414', ashAlt: '#151414', belly: '#d8cfc0', ears: '#151414', snout: '#1a1918',
      brow: '#151414', iris: '#2a1e16', sclera: '#2a1e16', nose: '#1a1918', tip: '#151414', hoof: '#151414', mane: '#151414',
      lids: '#151414', pad: '#151414', folds: '#151414', skull: '#151414' },
    headPalette: { Skull: '#151414', Cheek: '#151414', Jowl: '#151414', Jaw: '#1a1918', Strap: '#f4f2ec', LidRim: '#151414', Nostrils: '#3a3836' },
    joints: { neckBase: [0, 0.12, 0.19], neckTop: [0, 0.17, 0.42], wingRoot: [0.07, 0.08, 0.21],
      hip: [0.05, -0.04, 0.11], knee: [0.06, 0.01, 0.075], ankle: [0.05, -0.005, 0.02], ...feet(0.05, -0.005, 0.055) },
    torso: [
      { at: [0, -0.22, 0.16], r: [0.06, 0.05] },
      { at: [0, -0.13, 0.16], r: [0.10, 0.085] },
      { at: [0, -0.02, 0.16], r: [0.115, 0.095] },
      { at: [0, 0.08, 0.16], r: [0.105, 0.09] },
      { at: [0, 0.14, 0.16], r: [0.07, 0.07] },
    ],
    torsoCaps: { back: [0, -0.27, 0.17], tip: [0, 0.18, 0.17] },
    neckRA: [0.045, 0.045], neckRB: [0.022, 0.022], neckRMid: [0.026, 0.026], neckGroup: 'Mane',
    tailGroup: 'Mane',
    tail: [[0, -0.22, 0.18, [0.05, 0.02]], [0, -0.27, 0.19, [0.045, 0.015]], [0, -0.30, 0.195, [0.035, 0.01]]],
    tip: [[0, -0.295, 0.195, [0.03, 0.01]], [0, -0.31, 0.2, [0.02, 0.008]], [0, -0.315, 0.2, [0.01, 0.005]]],
    tipCaps: { back: [0, -0.29, 0.19], tip: [0, -0.32, 0.2] },
    legs: legRows([[0.03, 0.035], [0.022, 0.022]], [0.01, 0.009], [0.006, 0.005], [0.004, 0.002], { web: 0.035 }),
    ...DUCK_HEAD, headScale: 0.85, muzzleLen: 0.8, eyeR: 0.0075,
    // the WHITE CHIN STRAP: the cheek, jowl and throat slots behind the bill
    craniumBandGroups: { 'st0-st1': ['Skull', 'Skull', 'Skull', 'Strap', 'Strap', 'Strap'], 'st1-st2': ['Skull', 'Skull', 'Skull', 'Strap', 'Strap', 'Strap'],
      'st2-st3': ['Skull', 'Skull', 'Skull', 'Skull', 'Strap', 'Strap'] },
    // the pale breast and belly, the WHITE undertail
    markings: [
      { on: 'torso', kind: 'band', run: [0.55, 1], t: [0.45, 1], group: 'Breast', color: '#cfc4b2', caps: ['tip'] },
      { on: 'torso', kind: 'band', run: [0.3, 0.55], t: [0.6, 1], group: 'Breast' },
      { on: 'torso', kind: 'band', run: [0, 0.3], t: [0.55, 1], group: 'Vent', color: '#f4f2ec' },
    ],
    bodyTiles: [],
    wings: { coreFit: true, pitch: 4,
      wing: roundWing([0.08, 0.12, 0.08], 0.15, 0.17, { primReach: 0.03, slotFrom: 0.95 }),
      palette: wingPalette({ bone: '#7a6a58', flight: ['#3a3028', '#43382e', '#342a22'], under: '#9a8e80', covert: ['#6e5e4c', '#7a6a58', '#665644'], covertTip: '#d8cfc0',
        lesser: ['#7a6a58', '#84745f', '#716150'], lesserTip: '#cfc4b2' }) },
  },
  // ROCK PIGEON (Columba livia). Thesis: a small PLUMP blue-grey bird on short PINK-RED legs, the body tilted a little
  // up · a SMALL round dark-grey head with an ORANGE eye and a short slim dark bill topped by a white CERE · an
  // IRIDESCENT green-and-purple neck · TWO BLACK BARS across each grey wing · a dark band at the end of the tail.
  // Size: published length 0.29–0.37 m, span 0.62–0.72 m (Wikipedia, "Rock dove"); standing ~0.23 m to the crown
  // (height target). Authored at size.
  pigeon: {
    family: 'avian', name: 'a rock pigeon', torsoUp: true, scale: 1,
    colors: { coat: '#8d93a0', sock: '#c4505a', ash: '#5f6470', ashAlt: '#5f6470', belly: '#7f8594', ears: '#5f6470', snout: '#2c2a2a',
      brow: '#5f6470', iris: '#e07a1a', sclera: '#e07a1a', nose: '#2c2a2a', tip: '#2e2f36', hoof: '#5a3a3a', mane: '#4f7a62',
      lids: '#5f6470', pad: '#5f6470', folds: '#5f6470', skull: '#5f6470' },
    headPalette: { Skull: '#5f6470', Jaw: '#2c2a2a', Cere: '#ecebe6', LidRim: '#b8505a', Nostrils: '#2c2a2a' },
    joints: { neckBase: [0, 0.06, 0.175], neckTop: [0, 0.075, 0.215], wingRoot: [0.045, 0.03, 0.16],
      hip: [0.03, -0.01, 0.09], knee: [0.035, 0.02, 0.055], ankle: [0.03, 0.005, 0.012], ...feet(0.03, 0.005, 0.035) },
    torso: [
      { at: [0, -0.09, 0.12], r: [0.035, 0.03] },
      { at: [0, -0.055, 0.125], r: [0.06, 0.055] },
      { at: [0, -0.005, 0.135], r: [0.068, 0.065] },
      { at: [0, 0.04, 0.15], r: [0.06, 0.06] },
      { at: [0, 0.065, 0.168], r: [0.038, 0.038] },
    ],
    torsoCaps: { back: [0, -0.11, 0.12], tip: [0, 0.077, 0.185] },
    neckRA: [0.036, 0.036], neckRB: [0.018, 0.018], neckRMid: [0.022, 0.022], neckGroup: 'Mane',
    tail: [[0, -0.09, 0.13, [0.025, 0.008]], [0, -0.14, 0.115, [0.032, 0.007]], [0, -0.18, 0.10, [0.035, 0.006]]],
    tip: [[0, -0.175, 0.102, [0.035, 0.006]], [0, -0.20, 0.094, [0.034, 0.005]], [0, -0.215, 0.088, [0.03, 0.004]]],
    tipCaps: { back: [0, -0.17, 0.104], tip: [0, -0.222, 0.086] },
    legs: legRows([[0.018, 0.02], [0.012, 0.012]], [0.005, 0.0045], [0.003, 0.0025], [0.002, 0.001]),
    // a round skull (st0–st2) and a short SLIM bill (st3–st6)
    craniumRows: [
      ['st0', -0.05, 0.03, [0.02, 0.028], [0.032, 0.012], [0.034, -0.006], [0.028, -0.02], [0.018, -0.027], -0.03],
      ['st1', -0.015, 0.042, [0.024, 0.04], [0.038, 0.018], [0.04, -0.003], [0.032, -0.02], [0.02, -0.028], -0.03],
      ['st2', 0.02, 0.036, [0.02, 0.034], [0.032, 0.014], [0.033, -0.006], [0.027, -0.018], [0.018, -0.024], -0.026],
      ['st3', 0.045, 0.016, [0.008, 0.015], [0.011, 0.008], [0.012, -0.002], [0.01, -0.007], [0.008, -0.01], -0.011],
      ['st4', 0.07, 0.011, [0.006, 0.01], [0.008, 0.005], [0.008, -0.002], [0.007, -0.006], [0.006, -0.008], -0.009],
      ['st5', 0.095, 0.008, [0.004, 0.007], [0.005, 0.003], [0.005, -0.002], [0.005, -0.005], [0.004, -0.007], -0.007],
      ['st6', 0.11, 0.004, [0.003, 0.003], [0.003, 0.0], [0.003, -0.003], [0.003, -0.005], [0.002, -0.006], -0.006],
    ],
    craniumCaps: { back: [0, -0.068, 0.0], tip: [0, 0.117, -0.002] },
    craniumBandGroups: { 'st0-st1': band('Skull'), 'st1-st2': band('Skull'), 'st2-st3': band('Skull') },
    jawRows: [
      ['st0', 0.04, { gum: -0.011, gumR: [0.008, -0.011], jaw: [0.008, -0.015], bottom: -0.017 }],
      ['st1', 0.065, { gum: -0.009, gumR: [0.006, -0.009], jaw: [0.006, -0.012], bottom: -0.013 }],
      ['st2', 0.09, { gum: -0.0075, gumR: [0.004, -0.0075], jaw: [0.004, -0.0095], bottom: -0.0105 }],
      ['st3', 0.105, { gum: -0.0065, gumR: [0.003, -0.0065], jaw: [0.003, -0.008], bottom: -0.0085 }],
    ],
    jawCaps: { back: [0, 0.03, -0.014], tip: [0, 0.11, -0.007] },
    // head-relative detail: the eye, nostrils and brow authored at the reference head and scaled with this small one
    headScale: 0.33, headRelative: true, relBrow: true, nape: [0, -0.05, -0.02], eyeAt: [1.4, 2.4], eyeR: 0.015, nose: false,
    eyeStyle: 'set', eyeSet: { sink: 0.3, open: [0.9, 0.8], pupil: 22 },
    browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
    nostrilAt: [3.5, 1.2], noseAt: [3.5, 1.2], noseR: [0.002, 0.002],
    // the white CERE swelling over the nostrils at the bill's base
    headOrnaments: [{ kind: 'sweep', name: 'cere', at: [3.15, 0], space: 'local', spine: [[0, 0, -0.0015], [0.003, 0, 0.001], [0.006, 0, 0.0005]], radii: [0.002, 0.0025, 0.002, 0.0006], m: 8, squash: [1.2, 0.5], group: 'Cere' }],
    // the IRIDESCENT neck: green above, a purple sheen low on the neck and the upper breast
    markings: [
      { on: 'neck', kind: 'band', run: [0, 0.4], group: 'Gloss', color: '#6e5a86' },
      { on: 'torso', kind: 'band', run: [0.9, 1], t: [0, 0.5], group: 'Gloss', caps: ['tip'] },
    ],
    bodyTiles: [],
    // the grey wing with TWO BLACK BARS (the greater and lesser covert tips), dark primaries
    wings: { coreFit: true, pitch: 10,
      wing: roundWing([0.035, 0.05, 0.04], 0.08, 0.12, { secondaries: 10, width: 0.025, primReach: 0.03, slotFrom: 0.95, slotBy: 0.1 }),
      palette: wingPalette({ bone: '#8d93a0', flight: ['#4a4d56', '#555862', '#40434c'], under: '#c4c8d0', covert: ['#9aa0ac', '#a2a8b4', '#949aa6'], covertTip: '#1e1e24',
        lesser: ['#a4aab5', '#acb2bd', '#9ea4af'], lesserTip: '#1e1e24' }) },
  },

  // AMERICAN CROW (Corvus brachyrhynchos). Thesis: an ALL-BLACK perched bird, glossy, the trunk tilted up like the
  // eagle's · a big head with a HEAVY STRAIGHT black bill as long as the skull, a dark eye · a medium SQUARE tail
  // hanging below the folded wingtips · black legs and toes. Size: published length 0.40–0.53 m, span 0.85–1.0 m
  // (Wikipedia, "American crow"); perched ~0.36 m to the crown (height target). Authored on the eagle's tables and
  // scaled.
  crow: {
    family: 'avian', name: 'an American crow', torsoUp: true, scale: 0.42,
    // GLOSSY BLACK: blue-black slate plumage (lit, it shows blue and violet), the bill and legs a flat neutral black a
    // value apart, a dark brown eye in a black lid
    colors: { coat: '#242939', sock: '#18181a', ash: '#292e3e', ashAlt: '#2f3446', belly: '#222634', ears: '#242939', snout: '#101012',
      brow: '#262a3a', iris: '#4a3022', sclera: '#4a3022', nose: '#101012', tip: '#23273a', hoof: '#0c0c0e', mane: '#242939',
      lids: '#14151c', pad: '#14151c', folds: '#14151c', skull: '#242939' },
    headPalette: { Skull: '#242939', Jaw: '#101012', Cheek: '#101012', Jowl: '#101012', LidRim: '#0c0c10', Nostrils: '#2a2a30' },
    joints: { neckBase: [0, 0.15, 0.70], neckTop: [0, 0.19, 0.84], wingRoot: [0.13, 0.09, 0.67],
      hip: [0.09, -0.06, 0.40], knee: [0.11, 0.06, 0.22], ankle: [0.10, 0.04, 0.05], ...feet(0.10, 0.04, 0.13) },
    torso: [
      { at: [0, -0.30, 0.37], r: [0.09, 0.07] },
      { at: [0, -0.19, 0.45], r: [0.15, 0.13] },
      { at: [0, -0.06, 0.54], r: [0.18, 0.16] },
      { at: [0, 0.06, 0.62], r: [0.17, 0.16] },
      { at: [0, 0.15, 0.69], r: [0.11, 0.11] },
    ],
    torsoCaps: { back: [0, -0.35, 0.33], tip: [0, 0.19, 0.73] },
    neckRA: [0.1, 0.1], neckRB: [0.07, 0.07], neckRMid: [0.08, 0.08], neckGroup: 'Coat',
    // the TAIL: a fan widening past the wingtips, its end ROUNDED (the outer feathers a little shorter)
    tail: [[0, -0.31, 0.35, [0.07, 0.03]], [0, -0.40, 0.25, [0.09, 0.025]], [0, -0.47, 0.16, [0.11, 0.02]]],
    tip: [[0, -0.46, 0.17, [0.11, 0.02]], [0, -0.52, 0.09, [0.11, 0.018]], [0, -0.55, 0.05, [0.075, 0.014]]],
    tipCaps: { back: [0, -0.44, 0.20], tip: [0, -0.575, 0.025] },
    // the GLOSS: a bluer, lighter sheen along the back and nape where the light falls
    markings: [
      { on: 'torso', kind: 'band', run: [0.15, 1], t: [0, 0.4], group: 'Gloss', color: '#313852' },
      { on: 'neck', kind: 'band', t: [0, 0.45], group: 'Gloss' },
    ],
    legs: legRows([[0.08, 0.09], [0.055, 0.055]], [0.026, 0.024], [0.02, 0.014], [0.012, 0.004]),
    // a big skull (st0–st2) and a HEAVY STRAIGHT bill (st3–st6), the culmen curving down a little at the tip
    craniumRows: [
      ['st0', -0.05, 0.032, [0.018, 0.03], [0.032, 0.013], [0.034, -0.006], [0.028, -0.022], [0.02, -0.03], -0.033],
      ['st1', -0.02, 0.04, [0.022, 0.038], [0.038, 0.018], [0.04, -0.003], [0.033, -0.02], [0.022, -0.029], -0.031],
      ['st2', 0.01, 0.036, [0.02, 0.034], [0.034, 0.015], [0.035, -0.005], [0.029, -0.019], [0.02, -0.026], -0.028],
      ['st3', 0.035, 0.026, [0.012, 0.025], [0.018, 0.013], [0.019, -0.004], [0.016, -0.014], [0.013, -0.02], -0.022],
      ['st4', 0.065, 0.02, [0.009, 0.019], [0.013, 0.01], [0.014, -0.003], [0.012, -0.011], [0.01, -0.016], -0.017],
      ['st5', 0.095, 0.012, [0.006, 0.011], [0.009, 0.005], [0.009, -0.004], [0.008, -0.009], [0.006, -0.012], -0.013],
      ['st6', 0.118, 0.002, [0.003, 0.001], [0.005, -0.002], [0.005, -0.006], [0.004, -0.008], [0.003, -0.01], -0.011],
    ],
    craniumCaps: { back: [0, -0.065, 0.0], tip: [0, 0.126, -0.006] },
    craniumBandGroups: { 'st0-st1': band('Skull'), 'st1-st2': band('Skull'), 'st2-st3': band('Skull') },
    jawRows: [
      ['st0', 0.035, { gum: -0.022, gumR: [0.013, -0.022], jaw: [0.013, -0.028], bottom: -0.031 }],
      ['st1', 0.065, { gum: -0.017, gumR: [0.01, -0.017], jaw: [0.01, -0.022], bottom: -0.024 }],
      ['st2', 0.095, { gum: -0.013, gumR: [0.006, -0.013], jaw: [0.006, -0.016], bottom: -0.017 }],
      ['st3', 0.115, { gum: -0.011, gumR: [0.003, -0.011], jaw: [0.003, -0.013], bottom: -0.014 }],
    ],
    jawCaps: { back: [0, 0.02, -0.026], tip: [0, 0.12, -0.012] },
    headScale: 1.25, eyeAt: [1.5, 2.3], eyeR: 0.007, nose: false,
    eyeStyle: 'set', eyeSet: { sink: 0.3, open: [0.85, 0.75], pupil: 30 },
    browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
    nostrilAt: [3.4, 1.5], noseAt: [3.4, 1.5], noseR: [0.002, 0.002],
    bodyTiles: [],
    wings: { wing: featherWing({ arm: [0.16, 0.24, 0.16], secLen: 0.34, primLen: 0.4, primReach: 0.08, slotFrom: 0.7, slotBy: 0.3 }), pitch: 36,
      // the coverts carry the gloss (blue to violet), the flight feathers a matte blue-black
      palette: wingPalette({ bone: '#202434', flight: ['#1e2130', '#24283a', '#1a1d2a'], under: '#2a2c34', covert: ['#3a4462', '#433e62', '#364058'], covertTip: '#2e3550',
        lesser: ['#3e4a68', '#46426a', '#3a4460'], lesserTip: '#343c58' }) },
  },

  // TOCO TOUCAN (Ramphastos toco). Thesis: a perched BLACK bird with a HUGE BANANA BILL as long as its body, bright
  // ORANGE with a BLACK tip, deep and laterally flat · a WHITE throat and bib · bare orange skin round the eye in a
  // blue ring · a red undertail · zygodactyl feet (two toes forward, two back) · a squared black tail. Size: published
  // length 0.55–0.65 m, the bill 16–23 cm (Wikipedia, "Toco toucan"); perched ~0.40 m to the crown (height target).
  // Authored on the macaw's tables and scaled.
  toucan: {
    family: 'avian', name: 'a toco toucan', torsoUp: true, scale: 0.45,
    colors: { coat: '#151313', sock: '#5a6a8a', ash: '#151313', ashAlt: '#1c1a1a', belly: '#151313', ears: '#151313', snout: '#151313',
      brow: '#151313', iris: '#1a2a3a', sclera: '#1a2a3a', nose: '#151313', tip: '#151313', hoof: '#2a2c34', mane: '#151313',
      lids: '#e8892a', pad: '#151313', folds: '#e8892a', skull: '#151313' },
    headPalette: { Skull: '#151313', Bill: '#f39a1e', Jaw: '#f08a1a', Face: '#e8892a', Throat: '#f6f2e6', LidRim: '#2f5fd0', Nostrils: '#151313' },
    joints: { neckBase: [0, 0.15, 0.68], neckTop: [0, 0.19, 0.78], wingRoot: [0.13, 0.09, 0.67],
      hip: [0.09, -0.04, 0.36], knee: [0.11, 0.07, 0.16], ankle: [0.10, 0.04, 0.05],
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
    neckRA: [0.1, 0.1], neckRB: [0.08, 0.08], neckRMid: [0.085, 0.085],
    tail: [[0, -0.31, 0.35, [0.07, 0.03]], [0, -0.45, 0.25, [0.08, 0.025]], [0, -0.56, 0.16, [0.08, 0.02]]],
    tip: [[0, -0.55, 0.17, [0.08, 0.02]], [0, -0.64, 0.10, [0.075, 0.016]], [0, -0.70, 0.06, [0.06, 0.01]]],
    tipCaps: { back: [0, -0.53, 0.19], tip: [0, -0.72, 0.05] },
    legs: legRows([[0.08, 0.09], [0.06, 0.06]], [0.035, 0.032], [0.025, 0.017], [0.015, 0.005]),
    // a small skull (st0–st2) and the HUGE bill (st3–st6): tall at the base, laterally flat, curving down to the tip
    craniumRows: [
      ['st0', -0.05, 0.035, [0.02, 0.033], [0.035, 0.014], [0.037, -0.007], [0.031, -0.024], [0.022, -0.032], -0.035],
      ['st1', -0.02, 0.045, [0.025, 0.043], [0.04, 0.02], [0.042, -0.004], [0.036, -0.022], [0.025, -0.032], -0.034],
      ['st2', 0.01, 0.046, [0.024, 0.044], [0.036, 0.022], [0.038, -0.004], [0.032, -0.022], [0.022, -0.032], -0.034],
      ['st3', 0.035, 0.05, [0.018, 0.048], [0.024, 0.03], [0.025, 0.0], [0.022, -0.02], [0.018, -0.03], -0.032],
      ['st4', 0.12, 0.048, [0.014, 0.046], [0.018, 0.028], [0.019, 0.002], [0.017, -0.016], [0.014, -0.024], -0.026],
      ['st5', 0.22, 0.032, [0.01, 0.03], [0.013, 0.016], [0.013, -0.004], [0.012, -0.016], [0.01, -0.022], -0.024],
      ['st6', 0.29, 0.01, [0.006, 0.008], [0.007, 0.0], [0.007, -0.01], [0.006, -0.018], [0.005, -0.022], -0.024],
    ],
    craniumCaps: { back: [0, -0.065, 0.0], tip: [0, 0.305, -0.018] },
    craniumBandGroups: { 'st0-st1': ['Skull', 'Skull', 'Skull', 'Skull', 'Throat', 'Throat'], 'st1-st2': ['Skull', 'Skull', 'Face', 'Face', 'Throat', 'Throat'],
      'st2-st3': ['Skull', 'Skull', 'Face', 'Face', 'Throat', 'Throat'], 'st3-st4': band('Bill'), 'st4-st5': band('Bill') },
    jawRows: [
      ['st0', 0.03, { gum: -0.034, gumR: [0.02, -0.034], jaw: [0.019, -0.045], bottom: -0.05 }],
      ['st1', 0.12, { gum: -0.028, gumR: [0.016, -0.028], jaw: [0.015, -0.04], bottom: -0.044 }],
      ['st2', 0.22, { gum: -0.026, gumR: [0.011, -0.026], jaw: [0.01, -0.033], bottom: -0.036 }],
      ['st3', 0.28, { gum: -0.026, gumR: [0.006, -0.026], jaw: [0.005, -0.03], bottom: -0.032 }],
    ],
    jawCaps: { back: [0, 0.015, -0.04], tip: [0, 0.295, -0.028] },
    headScale: 1.5, eyeAt: [1.5, 2.2], eyeR: 0.01, nose: false,
    eyeStyle: 'set', eyeSet: { sink: 0.35, open: [0.85, 0.75], pupil: 30 },
    browStrip: [[1.2, 1.9], [1.45, 1.9], [1.7, 1.95], [1.95, 2.05], [2.2, 2.2]],
    nostrilAt: [3.1, 1.2], noseAt: [3.1, 1.2], noseR: [0.002, 0.002],
    // the WHITE throat and bib, the RED undertail
    markings: [
      { on: 'neck', kind: 'band', t: [0.45, 1], group: 'Bib', color: '#f6f2e6' },
      { on: 'torso', kind: 'band', run: [0.8, 1], t: [0.45, 1], group: 'Bib', caps: ['tip'] },
      { on: 'torso', kind: 'band', run: [0, 0.2], t: [0.6, 1], group: 'Vent', color: '#d0242a', caps: ['back'] },
    ],
    bodyTiles: [],
    wings: { wing: featherWing({ arm: [0.15, 0.22, 0.15], secLen: 0.3, primLen: 0.32, primReach: 0.04, slotFrom: 0.9, slotBy: 0.1 }), pitch: 36,
      palette: wingPalette({ bone: '#151313', flight: ['#151313', '#1c1a1a', '#121010'], under: '#2a2626', covert: ['#181616', '#1e1c1c', '#141212'], lesser: '#181616' }) },
  },

  // RUBY-THROATED HUMMINGBIRD, a male (Archilochus colubris). Thesis: TINY · a small round body tilted up on legs too
  // short to see · a NEEDLE BILL longer than the head · a glittering RUBY-RED throat (gorget), a METALLIC GREEN back
  // and crown, a grey-white belly · LONG narrow pointed wings folded past a short forked dark tail. Size: published
  // length 7–9 cm, mass ~3 g (Wikipedia, "Ruby-throated hummingbird"); length target 0.075 m (rump to bill tip, the
  // tail excluded). Authored at ~5× and scaled.
  hummingbird: {
    family: 'avian', name: 'a ruby-throated hummingbird', torsoUp: true, scale: 0.2,
    colors: { coat: '#3f8a4a', sock: '#2a2624', ash: '#3f8a4a', ashAlt: '#4a9a56', belly: '#e4e2da', ears: '#3f8a4a', snout: '#1a1818',
      brow: '#3f8a4a', iris: '#141212', sclera: '#141212', nose: '#1a1818', tip: '#2a2a2e', hoof: '#1a1818', mane: '#3f8a4a',
      lids: '#3f8a4a', pad: '#3f8a4a', folds: '#3f8a4a', skull: '#3f8a4a' },
    headPalette: { Skull: '#3f8a4a', Jaw: '#1a1818', Gorget: '#c0182a', LidRim: '#1a1818', Nostrils: '#1a1818' },
    joints: { neckBase: [0, 0.06, 0.255], neckTop: [0, 0.07, 0.285], wingRoot: [0.05, 0.02, 0.23],
      hip: [0.035, -0.01, 0.12], knee: [0.04, 0.02, 0.07], ankle: [0.035, 0.01, 0.025], ...feet(0.035, 0.01, 0.035) },
    torso: [
      { at: [0, -0.09, 0.15], r: [0.045, 0.04] },
      { at: [0, -0.055, 0.17], r: [0.075, 0.07] },
      { at: [0, -0.01, 0.195], r: [0.085, 0.082] },
      { at: [0, 0.035, 0.225], r: [0.075, 0.075] },
      { at: [0, 0.06, 0.25], r: [0.05, 0.05] },
    ],
    torsoCaps: { back: [0, -0.11, 0.14], tip: [0, 0.075, 0.27] },
    neckRA: [0.05, 0.05], neckRB: [0.042, 0.042], neckRMid: [0.045, 0.045], neckGroup: 'Coat',
    tailGroup: 'Tip',
    tail: [[0, -0.10, 0.15, [0.03, 0.01]], [0, -0.14, 0.11, [0.04, 0.009]], [0, -0.17, 0.08, [0.045, 0.008]]],
    tip: [[0, -0.165, 0.085, [0.045, 0.008]], [0, -0.19, 0.065, [0.045, 0.007]], [0, -0.205, 0.05, [0.04, 0.005]]],
    tipCaps: { back: [0, -0.16, 0.09], tip: [0, -0.21, 0.045] },
    legs: legRows([[0.025, 0.028], [0.015, 0.015]], [0.007, 0.006], [0.004, 0.003], [0.003, 0.001]),
    // a round skull (st0–st2) and the NEEDLE bill (st3–st6), longer than the skull
    craniumRows: [
      ['st0', -0.05, 0.03, [0.018, 0.028], [0.032, 0.012], [0.034, -0.006], [0.028, -0.02], [0.018, -0.027], -0.03],
      ['st1', -0.015, 0.04, [0.022, 0.038], [0.037, 0.017], [0.039, -0.003], [0.032, -0.019], [0.02, -0.027], -0.029],
      ['st2', 0.02, 0.032, [0.018, 0.03], [0.03, 0.013], [0.031, -0.005], [0.025, -0.016], [0.016, -0.022], -0.024],
      ['st3', 0.045, 0.01, [0.005, 0.0095], [0.007, 0.006], [0.0075, 0.0], [0.0065, -0.005], [0.005, -0.008], -0.009],
      ['st4', 0.075, 0.006, [0.003, 0.0057], [0.0045, 0.0035], [0.0048, 0.0], [0.004, -0.003], [0.003, -0.005], -0.0055],
      ['st5', 0.115, 0.0035, [0.002, 0.0033], [0.003, 0.002], [0.003, 0.0], [0.0026, -0.0018], [0.002, -0.003], -0.0033],
      ['st6', 0.145, 0.0015, [0.001, 0.0014], [0.0014, 0.0007], [0.0015, -0.0002], [0.0013, -0.0009], [0.001, -0.0013], -0.0015],
    ],
    craniumCaps: { back: [0, -0.065, 0.0], tip: [0, 0.151, -0.0002] },
    craniumBandGroups: { 'st0-st1': ['Skull', 'Skull', 'Skull', 'Skull', 'Gorget', 'Gorget'], 'st1-st2': ['Skull', 'Skull', 'Skull', 'Skull', 'Gorget', 'Gorget'],
      'st2-st3': ['Skull', 'Skull', 'Skull', 'Skull', 'Gorget', 'Gorget'] },
    jawRows: [
      ['st0', 0.04, { gum: -0.009, gumR: [0.006, -0.009], jaw: [0.006, -0.013], bottom: -0.015 }],
      ['st1', 0.075, { gum: -0.0055, gumR: [0.004, -0.0055], jaw: [0.0038, -0.0075], bottom: -0.0085 }],
      ['st2', 0.115, { gum: -0.0034, gumR: [0.0024, -0.0034], jaw: [0.0022, -0.0046], bottom: -0.0052 }],
      ['st3', 0.14, { gum: -0.0016, gumR: [0.0012, -0.0016], jaw: [0.001, -0.0024], bottom: -0.0028 }],
    ],
    jawCaps: { back: [0, 0.03, -0.013], tip: [0, 0.145, -0.0022] },
    // head-relative detail: the eye, nostrils and brow authored at the reference head and scaled with this tiny one
    headScale: 1, headRelative: true, relBrow: true, eyeAt: [1.4, 2.4], eyeR: 0.0125, nose: false,
    eyeStyle: 'set', eyeSet: { sink: 0.55, open: [0.9, 0.8], pupil: 30 },
    browStrip: [[0.9, 1.6], [1.15, 1.6], [1.4, 1.6], [1.65, 1.65], [1.9, 1.8]],
    nostrilAt: [3.3, 1.2], noseAt: [3.3, 1.2], noseR: [0.001, 0.001],
    // the mouth folds and web on the skull behind the needle (on the bill they stood proud of it)
    foldStrip: [[2.7, 3.9], [2.65, 4.0], [2.6, 4.1], [2.55, 4.2], [2.5, 4.3]], webCranium: [1.7, 2.9, 4.97],
    // the RUBY GORGET down the throat, the pale belly
    markings: [
      { on: 'neck', kind: 'band', t: [0.5, 1], group: 'Gorget', color: '#c0182a' },
      { on: 'torso', kind: 'band', run: [0.85, 1], t: [0.55, 1], group: 'Gorget', caps: ['tip'] },
      { on: 'torso', kind: 'belly', run: [0, 0.85], from: 0.55, group: 'Belly' },
    ],
    bodyTiles: [],
    // LONG narrow pointed wings: a short arm, few secondaries, long primaries
    wings: { coreFit: true, pitch: 40,
      wing: featherWing({ arm: [0.04, 0.05, 0.07], tertials: 2, secondaries: 6, secLen: 0.06, primLen: 0.2, primReach: 0.02, slotFrom: 1, width: 0.03,
        tertialLen: 0.2, tertialWidth: 0.35, boneR: 0.35 }),
      palette: wingPalette({ bone: '#3f8a4a', flight: ['#3a3a40', '#424248', '#34343a'], under: '#5a5a60', covert: ['#3f8a4a', '#4a9a56', '#3a7e44'], lesser: '#3f8a4a' }) },
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
  ostrich: { common: 'ostrich', aliases: ['common ostrich'], sci: 'Struthio camelus', size: 'height 2.1–2.8 m', source: 'Wikipedia, "Common ostrich"' },
  rooster: { common: 'rooster', aliases: ['cock', 'cockerel'], sci: 'Gallus gallus domesticus', size: '~0.60 m to the top of the comb; cock 3–4 kg', source: 'poultry breed standards; Wikipedia, "Chicken"' },
  turkey: { common: 'turkey', aliases: ['wild turkey', 'gobbler'], sci: 'Meleagris gallopavo', size: 'length 1.0–1.25 m (males); strutting ~1.0 m to the top of the fan', source: 'Wikipedia, "Wild turkey"' },
  peacock: { common: 'peacock', aliases: ['peafowl', 'peahen', 'indian peafowl'], sci: 'Pavo cristatus', size: '1.0–1.15 m bill to tail, 1.95–2.25 m to the end of the train; standing ~0.95 m', source: 'Wikipedia, "Indian peafowl"' },
  flamingo: { common: 'flamingo', aliases: ['pink flamingo', 'american flamingo'], sci: 'Phoenicopterus ruber', size: 'height 1.2–1.45 m', source: 'Wikipedia, "American flamingo"' },
  swan: { common: 'swan', aliases: ['mute swan'], sci: 'Cygnus olor', size: 'length 1.25–1.7 m, span 2.0–2.4 m', source: 'Wikipedia, "Mute swan"' },
  canadaGoose: { common: 'goose', aliases: ['goose', 'canada goose', 'honker'], sci: 'Branta canadensis', size: 'length 0.75–1.10 m, span 1.27–1.85 m', source: 'Wikipedia, "Canada goose"' },
  pigeon: { common: 'pigeon', aliases: ['dove', 'rock pigeon', 'rock dove'], sci: 'Columba livia', size: 'length 0.29–0.37 m, span 0.62–0.72 m; standing ~0.23 m', source: 'Wikipedia, "Rock dove"' },
  crow: { common: 'crow', aliases: ['american crow'], sci: 'Corvus brachyrhynchos', size: 'length 0.40–0.53 m, span 0.85–1.0 m; perched ~0.36 m', source: 'Wikipedia, "American crow"' },
  toucan: { common: 'toucan', aliases: ['toco toucan'], sci: 'Ramphastos toco', size: 'length 0.55–0.65 m, the bill 16–23 cm; perched ~0.40 m', source: 'Wikipedia, "Toco toucan"' },
  hummingbird: { common: 'hummingbird', aliases: ['ruby-throated hummingbird', 'hummer'], sci: 'Archilochus colubris', size: 'length 7–9 cm, ~3 g', source: 'Wikipedia, "Ruby-throated hummingbird"' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
  emu: { near: 'ostrich', aliases: [], note: 'the Australian ratite: shaggy grey-brown, a shorter neck, three toes' },
  raven: { near: 'crow', aliases: ['common raven'], note: 'a bigger crow: a heavier bill, a shaggy throat, a wedge tail' },
};
