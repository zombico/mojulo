// GIRAFFID — a SHORT trunk whose back slopes steeply from high withers down to a low croup, on very long slender
// legs (the forelegs the longer), one cloven hoof each (unguligrade, drawn as one hoof at low poly) · an extremely
// long neck carried steeply up · a long tapering head with skin-covered OSSICONES on the poll, ears sideways · a long
// thin tail with a dark tuft · a patched coat (grown body tiles). Worked species: the giraffe. Authored in metres at
// the giraffe's own size. The head and its skin controls start from the equine head (a long wedge face), which this
// family re-proportions; everything else is the giraffid's own. See ../build.js for every field.
import { family as equine } from './equine.js';

export const family = {
  ...equine,
  family: 'giraffid',
  colors: {
    coat: '#e2c89a', sock: '#e6d4b0', ash: '#d8b884', ashAlt: '#8a5428', brow: '#5a3a20', iris: '#2a1a10',
    ink: '#120d0a', sclera: '#1d140e', nose: '#3a2a22', teeth: '#e6dfcc', mouth: '#4e3430', tip: '#1e1915',
    mane: '#7a4a24', hoof: '#3a2e26', snout: '#d8c094', horn: '#5a3a22',
  },
  // legs: shoulder → elbow → carpus (knee) → fetlock → coronet → hoof; hip → stifle → hock → fetlock → coronet → hoof
  joints: {
    neckBase: [0, 0.62, 2.70], neckTop: [0, 1.50, 4.55],
    shoulder: [0.20, 0.52, 2.35], elbow: [0.21, 0.42, 1.92], carpus: [0.17, 0.48, 1.02], foreFetlock: [0.17, 0.50, 0.22], foreCoronet: [0.17, 0.55, 0.12], foreHoof: [0.17, 0.60, 0.04],
    hip: [0.18, -0.62, 2.02], stifle: [0.22, -0.40, 1.62], hock: [0.16, -0.78, 1.00], hindFetlock: [0.16, -0.70, 0.22], hindCoronet: [0.16, -0.65, 0.12], hindHoof: [0.16, -0.60, 0.04],
  },
  // a short deep trunk, the back falling ~0.5 m from withers to croup (torsoUp: stations at different heights)
  torsoUp: true,
  torso: [
    { at: [0, -0.86, 2.12], r: [0.20, 0.24] },
    { at: [0, -0.62, 2.16], r: [0.29, 0.32] },
    { at: [0, -0.25, 2.26], r: [0.32, 0.38] },
    { at: [0, 0.12, 2.38], r: [0.33, 0.43] },
    { at: [0, 0.42, 2.48], r: [0.29, 0.46] },
    { at: [0, 0.66, 2.56], r: [0.21, 0.40] },
  ],
  torsoCaps: { back: [0, -0.96, 2.12], tip: [0, 0.78, 2.60] },
  neckRA: [0.20, 0.34], neckRB: [0.075, 0.10], neckRMid: [0.12, 0.17],
  tail: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.10, 0.16], [0.075, 0.085], 'Coat', [0.6, 0.5], [0.10, 0.12]],
    ['foreArmR', 'elbow', 'carpus', [0.075, 0.085], [0.045, 0.05], 'Coat', [0.5, 0.4]],
    ['foreCannonR', 'carpus', 'foreFetlock', [0.042, 0.048], [0.035, 0.04], 'Sock', [0.4, 0.4]],
    ['forePasternR', 'foreFetlock', 'foreCoronet', [0.045, 0.045], 0.04, 'Sock', [0.4, 0.4]],
    ['foreHoofR', 'foreCoronet', 'foreHoof', 0.05, 0.065, 'Hoof', [0.3, 0.3]],
    ['thighR', 'hip', 'stifle', [0.12, 0.18], [0.085, 0.10], 'Coat', [0.2, 0.5], [0.12, 0.16]],
    ['gaskinR', 'stifle', 'hock', [0.075, 0.09], [0.045, 0.055], 'Coat', [0.5, 0.4]],
    ['hindCannonR', 'hock', 'hindFetlock', [0.042, 0.05], [0.035, 0.04], 'Sock', [0.4, 0.4]],
    ['hindPasternR', 'hindFetlock', 'hindCoronet', [0.045, 0.045], 0.04, 'Sock', [0.4, 0.4]],
    ['hindHoofR', 'hindCoronet', 'hindHoof', 0.05, 0.065, 'Hoof', [0.3, 0.3]],
  ],
  extraSegments: [
    // a long thin tail to the hocks, a dark tuft at its end
    { name: 'dock', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', stations: [
      { at: [0, -0.92, 2.30], r: [0.04, 0.04] }, { at: [0, -1.00, 2.05], r: [0.03, 0.03] }, { at: [0, -1.03, 1.45], r: [0.025, 0.025] },
    ], caps: { back: [0, -0.88, 2.36], tip: [0, -1.035, 1.40] } },
    { name: 'tailHair', kind: 'loft', slots: 'ring12', group: 'Tip', mirror: 'plane', stations: [
      { at: [0, -1.03, 1.48], r: [0.03, 0.035] }, { at: [0, -1.04, 1.30], r: [0.06, 0.07] }, { at: [0, -1.04, 1.10], r: [0.03, 0.04] },
    ], caps: { back: [0, -1.03, 1.52], tip: [0, -1.04, 1.04] } },
    // a short stiff mane along the back of the neck
    { name: 'mane', kind: 'loft', slots: 'ring12', group: 'Mane', mirror: 'plane', stations: [
      { at: [0, 0.53, 2.93], r: [0.025, 0.05] }, { at: [0, 0.83, 3.50], r: [0.025, 0.06] },
      { at: [0, 1.11, 4.05], r: [0.022, 0.055] }, { at: [0, 1.34, 4.50], r: [0.02, 0.04] },
    ], caps: { back: [0, 0.42, 2.86], tip: [0, 1.36, 4.66] } },
  ],
  // the patches: raised tiles over the trunk, the pale coat showing between them
  bodyTiles: [
    { id: 'trunk', parts: ['torso'], s: [0.5, 4.6], t: [0.4, 5.6], grid: [7, 4], height: 0.01, inset: 0.18, group: ['FurAlt'], sides: 6, brick: true, wobble: 0.25 },
    { id: 'neck', parts: ['neck'], s: [0.3, 1.8], t: [0.4, 5.6], grid: [6, 3], height: 0.008, inset: 0.18, group: ['FurAlt'], sides: 6, brick: true, wobble: 0.25 },
  ],
  scale: 1,
};

export const species = {
  // GIRAFFE (Giraffa camelopardalis) — THESIS: a short trunk with a back falling steeply from high withers to a low
  // croup, on very long slender legs (forelegs longer), one hoof each · an EXTREMELY LONG neck carried steeply up,
  // ~as long as the forelegs · a small long head carried nose-forward, two skin-covered OSSICONES on the poll, ears
  // out sideways · a long thin tail with a black tuft · tan coat with dark polygonal PATCHES · withers (top of the
  // trunk) 3.0 m, head top ~5 m (published shoulder height 2.5–3.5 m, total 4.3–5.7 m; Dagg 2014 "Giraffe: Biology,
  // Behaviour and Conservation").
  giraffe: {
    family: 'giraffid', name: 'a giraffe', scale: 1,
    headScale: 0.8,
    // the head tipped up from the horse's nose-down hang: the face near level atop the steep neck
    headPitch: 25,
    earAt: [0.6, 1.9], earSpine: [[0, 0, -0.01], [0, 0, 0.03], [0, 0, 0.07], [0, 0, 0.11], [0, 0, 0.14]], earR: [0.035, 0.04, 0.03, 0.01],
    headOrnaments: [
      { kind: 'sweep', name: 'ossicone', at: [0.5, 1.0], space: 'head', spine: [[0.04, -0.06, 0.10], [0.05, -0.075, 0.18], [0.055, -0.09, 0.25], [0.055, -0.095, 0.29]], radii: [0.03, 0.024, 0.026, 0.012], m: 8, group: 'Horn' },
    ],
  },
};
