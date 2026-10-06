// THYREOPHORAN (armoured dinosaurs) — a heavy trunk on four short COLUMNAR legs (the hind the longer), round
// toed feet, a small low head on a short neck, a tail on stable rings, and ARMOUR as extra parts: tall flat plates
// (each a thin loft standing on the back), spikes (segments), osteoderm rows (body tiles), a tail club (a flat loft).
// Every armour part is closed and sunk into the body it sits on. Authored in metres at stegosaurus size; the
// ankylosaurus re-draws a low wide trunk. The head starts from the testudine's small blunt reptile skull
// (re-scaled, headRelative). See ../build.js for every field.
import { family as testudine } from './testudine.js';

const loftOf = (pts) => pts.map(([y, z, r]) => ({ at: [0, y, z], r }));
const HEAD = Object.fromEntries(['craniumRows', 'craniumCaps', 'muzzleFrom', 'jawRows', 'jawCaps', 'skinControls', 'nape', 'eyeAt', 'eyeR', 'orbit', 'pupil', 'irisAngle',
  'browStrip', 'foldStrip', 'nostrilAt', 'noseAt', 'noseR', 'webCranium', 'nose', 'ears', 'earAt', 'earSpine', 'earR', 'earSquash', 'earH'].map((k) => [k, testudine[k]]));
// the height of a back line [[y, z], ...] (descending y) at y
const lineAt = (line, y) => { for (let i = 0; i < line.length - 1; i++) { const [y0, z0] = line[i], [y1, z1] = line[i + 1]; if (y <= y0 && y >= y1) return z0 + (z1 - z0) * (y - y0) / (y1 - y0); } return line[y > line[0][0] ? 0 : line.length - 1][1]; };
// a PLATE: a thin kite-shaped loft standing on the back at (x, y), its root sunk `sink` into the skin, leaning out
const plate = (name, x, y, zb, h, L, sink = 0.12) => ({ name, kind: 'loft', slots: 'ring12', group: 'Horn', mirror: null, stations: [
  { at: [x, y, zb - sink], r: [0.035, L * 0.28] }, { at: [x * 1.15, y, zb + h * 0.42], r: [0.05, L * 0.5] }, { at: [x * 1.3, y, zb + h * 0.85], r: [0.025, L * 0.12] },
], caps: { back: [x, y, zb - sink - 0.04], tip: [x * 1.35, y, zb + h] } });
// a SPIKE: a cone segment from a base joint to a tip joint (right side; the left mirrors by name)
const spike = (name, rA, group = 'Horn') => ({ name: `${name}R`, kind: 'segment', from: `${name}BaseR`, to: `${name}TipR`, rA, rB: rA * 0.12, slots: 'ring12', group, mirror: 'name', over: [0.3, 0.2] });
const legRows = (u, l, c, pad) => [
  ['upperArmR', 'shoulder', 'elbow', [u, u * 1.1], [l, l], 'Coat', [0.6, 0.5], [u * 0.95, u]],
  ['foreArmR', 'elbow', 'carpus', [l, l], [c, c], 'Coat', [0.5, 0.4]],
  ['pasternR', 'carpus', 'forePaw', c, c * 1.1, 'Sock', [0.4, 0.4]],
  ['forePawR', 'forePaw', 'foreToe', [pad, pad * 0.5], [pad * 0.9, pad * 0.4], 'Hoof', [0.5, 0.4], null, { up: [0, 0, 1] }],
  ['thighR', 'hip', 'stifle', [u * 1.35, u * 1.6], [l * 1.15, l * 1.15], 'Coat', [0.2, 0.5], [u * 1.25, u * 1.4]],
  ['shinR', 'stifle', 'hock', [l * 1.15, l * 1.15], [c * 1.05, c * 1.05], 'Coat', [0.5, 0.4]],
  ['metaR', 'hock', 'hindPaw', c * 1.05, c * 1.15, 'Sock', [0.4, 0.4]],
  ['hindPawR', 'hindPaw', 'hindToe', [pad * 1.1, pad * 0.5], [pad, pad * 0.4], 'Hoof', [0.5, 0.4], null, { up: [0, 0, 1] }],
];

// STEGOSAURUS tables: the back highest over the hips, falling to the low shoulders and down the tail
const STEGO_BACK = [[1.6, 1.2], [1.0, 1.55], [0.4, 2.05], [-0.3, 2.6], [-1.0, 2.8], [-1.6, 2.6], [-2.6, 2.2], [-3.6, 1.8], [-4.6, 1.45], [-5.6, 1.2]];
// the plates [y, side, height, length]: two STAGGERED rows (alternating sides), tallest over the hips and tail base
const STEGO_PLATES = [[1.55, 1, 0.30, 0.30], [1.30, -1, 0.38, 0.36], [1.00, 1, 0.48, 0.45], [0.70, -1, 0.58, 0.55], [0.40, 1, 0.70, 0.66], [0.08, -1, 0.82, 0.76],
  [-0.25, 1, 0.92, 0.84], [-0.60, -1, 0.98, 0.88], [-0.95, 1, 1.00, 0.88], [-1.30, -1, 0.95, 0.84], [-1.65, 1, 0.86, 0.76], [-2.00, -1, 0.74, 0.66],
  [-2.35, 1, 0.60, 0.54], [-2.70, -1, 0.46, 0.42], [-3.05, 1, 0.34, 0.32], [-3.40, -1, 0.24, 0.24], [-3.75, 1, 0.16, 0.18]];

export const family = {
  ...HEAD,
  family: 'thyreophoran',
  colors: {
    coat: '#6e6a48', sock: '#5f5b3e', ash: '#a39a70', ashAlt: '#8a8360', brow: '#4c4930', iris: '#3a2a12',
    ink: '#0f0d0a', sclera: '#2a2216', nose: '#3a3630', teeth: '#d8d0b8', mouth: '#6a4c44', tip: '#5d584a',
    hoof: '#3e3a2a', horn: '#9a5a3a', belly: '#b8ae84', snout: '#7a7552',
  },
  joints: {
    neckBase: [0, 1.55, 1.08], neckTop: [0, 2.1, 0.78],
    shoulder: [0.42, 1.25, 1.05], elbow: [0.52, 1.10, 0.62], carpus: [0.48, 1.30, 0.28], forePaw: [0.48, 1.32, 0.18], foreToe: [0.48, 1.50, 0.16],
    hip: [0.45, -1.00, 2.25], stifle: [0.52, -0.62, 1.32], hock: [0.48, -1.10, 0.40], hindPaw: [0.48, -1.05, 0.19], hindToe: [0.48, -0.80, 0.17],
    // the THAGOMIZER: two pairs of spikes near the tail tip, splayed out, back and up
    spike0BaseR: [0.06, -4.75, 1.42], spike0TipR: [0.62, -4.95, 2.05],
    spike1BaseR: [0.05, -5.20, 1.33], spike1TipR: [0.58, -5.65, 1.95],
  },
  torsoUp: true,
  torso: [
    { at: [0, -1.85, 2.08], r: [0.35, 0.42] },
    { at: [0, -1.20, 2.14], r: [0.58, 0.66] },
    { at: [0, -0.40, 2.00], r: [0.66, 0.72] },
    { at: [0, 0.35, 1.55], r: [0.60, 0.62] },
    { at: [0, 0.95, 1.18], r: [0.48, 0.48] },
    { at: [0, 1.45, 0.98], r: [0.34, 0.34] },
  ],
  torsoCaps: { back: [0, -2.15, 2.08], tip: [0, 1.70, 0.96] },
  neckRA: [0.30, 0.30], neckRB: [0.10, 0.10], neckRMid: [0.17, 0.17],
  tail: null, tip: null,
  tailStations: [[-1.7, 2.18, [0.36, 0.40]], [-2.6, 1.95, [0.27, 0.30]], [-3.6, 1.60, [0.18, 0.20]], [-4.6, 1.40, [0.11, 0.12]], [-5.5, 1.22, [0.05, 0.05]]],
  tailCaps: { back: [0, -1.4, 2.2], tip: [0, -5.8, 1.18] },
  legs: legRows(0.26, 0.21, 0.19, 0.23),
  // a tiny low narrow head (~0.45 m)
  headScale: 0.8, headRelative: true, headPitch: -10,
  muzzleW: 0.65, muzzleLen: 1.3,
  headTiles: [], bodyTiles: [],
  scale: 1,
};
family.extraSegments = [
  { name: 'tailLoft', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(family.tailStations), caps: family.tailCaps },
  ...STEGO_PLATES.map(([y, side, h, L], i) => plate(`plate${i}`, side * 0.22, y, lineAt(STEGO_BACK, y), h, L)),
  spike('spike0', 0.075), spike('spike1', 0.07),
];

// ANKYLOSAURUS tables: a low, very WIDE trunk under a flat-topped armoured back
const ANKY_BACK = [[1.4, 1.35], [0.8, 1.62], [0.0, 1.72], [-0.8, 1.70], [-1.5, 1.55]];
export const species = {
  // STEGOSAURUS (Stegosaurus stenops / ungulatus). Thesis: a trunk arched highest over the HIPS on short forelegs and
  // much longer hind legs, columnar, round toed feet · TWO STAGGERED ROWS of tall kite-shaped PLATES along the back and
  // tail, tallest over the hips · the THAGOMIZER, four spikes at the tail tip · a tiny narrow head carried LOW on a
  // short neck · ~9 m long, ~4 m to the plate tips (Gilmore 1914; Maidment et al. 2015 "Stegosaurus stenops" NHMUK
  // specimen ~5.6 m; S. ungulatus estimates to ~9 m, hips ~2.6 m).
  stegosaurus: {
    family: 'thyreophoran', name: 'a stegosaurus', scale: 1,
  },

  // ANKYLOSAURUS (Ankylosaurus magniventris). Thesis: a LOW, very WIDE armoured body on short columnar legs ·
  // rows of OSTEODERMS over the back, SIDE SPIKES along the flanks · a wide short triangular head with HORNS at its
  // back corners · a stiff tail ending in a heavy bony CLUB · ~6–8 m long, ~1.7 m tall (Arbour & Mallon 2017,
  // FACETS 2:764: 6.0–7.9 m).
  ankylosaurus: {
    family: 'thyreophoran', name: 'an ankylosaurus', scale: 1,
    colors: { coat: '#6a5a40', sock: '#5a4c36', ash: '#9a8a68', horn: '#4a3e2c', hoof: '#3a3024' },
    joints: {
      neckBase: [0, 1.30, 1.10], neckTop: [0, 1.95, 1.02],
      shoulder: [0.62, 1.00, 1.00], elbow: [0.78, 0.92, 0.62], carpus: [0.74, 1.05, 0.26], forePaw: [0.74, 1.07, 0.16], foreToe: [0.74, 1.22, 0.14],
      hip: [0.62, -0.95, 1.08], stifle: [0.76, -0.70, 0.64], hock: [0.72, -1.02, 0.28], hindPaw: [0.72, -1.00, 0.17], hindToe: [0.72, -0.82, 0.15],
      // side spikes: out of the flank edge, pointing out and a little back and down
      ...Object.fromEntries([1.0, 0.45, -0.1, -0.65, -1.2].flatMap((y, i) => [[`side${i}BaseR`, [0.82, y, 1.30]], [`side${i}TipR`, [1.40, y - 0.18, 1.18]]])),
    },
    torsoUp: true,
    torso: [
      { at: [0, -1.55, 1.15], r: [0.55, 0.38], top: 0.08 },
      { at: [0, -1.10, 1.18], r: [0.85, 0.48], top: 0.12 },
      { at: [0, -0.30, 1.20], r: [0.98, 0.52], top: 0.14 },
      { at: [0, 0.50, 1.18], r: [0.95, 0.50], top: 0.12 },
      { at: [0, 1.05, 1.12], r: [0.75, 0.44], top: 0.08 },
      { at: [0, 1.40, 1.08], r: [0.48, 0.34], top: 0.04 },
    ],
    torsoCaps: { back: [0, -1.80, 1.15], tip: [0, 1.60, 1.08] },
    neckRA: [0.34, 0.28], neckRB: [0.20, 0.17], neckRMid: [0.25, 0.21],
    tailStations: [[-1.6, 1.18, [0.45, 0.32]], [-2.4, 1.05, [0.32, 0.24]], [-3.3, 0.92, [0.19, 0.15]], [-4.2, 0.82, [0.11, 0.09]], [-4.7, 0.78, [0.09, 0.08]]],
    tailCaps: { back: [0, -1.4, 1.2], tip: [0, -4.85, 0.78] },
    legs: legRows(0.24, 0.19, 0.17, 0.22),
    // a wide short head (~0.6 m long, ~0.7 m wide): the testudine rows widened, the muzzle cut short
    headScale: 2.0, headPitch: -6, muzzleW: 1.6, muzzleLen: 0.75,
    headOrnaments: [
      // squamosal horns at the back corners of the skull, and quadratojugal horns under the eyes, pointing back
      { kind: 'sweep', name: 'hornTop', at: [0.6, 1.4], space: 'head', spine: [[0.055, -0.11, 0.035], [0.09, -0.17, 0.04], [0.12, -0.23, 0.03]], radii: [0.032, 0.02, 0.004], m: 8, group: 'Horn' },
      { kind: 'sweep', name: 'hornCheek', at: [1.4, 3.6], space: 'head', spine: [[0.075, -0.04, -0.03], [0.10, -0.09, -0.05], [0.12, -0.13, -0.07]], radii: [0.028, 0.018, 0.004], m: 8, group: 'Horn' },
    ],
    // osteoderm rows: raised low tiles over the whole back
    bodyTiles: [
      { id: 'osteoderms', parts: ['torso'], s: [0.6, 4.6], t: [0.5, 3.4], grid: [6, 4], brick: true, sides: 6, coverage: 0.85, inset: 0.6, height: 0.05, lean: 0, edgeFade: 0, thin: 1, wobble: 0.1, jitter: 0.1, group: ['Horn', 'Hoof'] },
    ],
    ankyBack: ANKY_BACK,
  },
};
species.ankylosaurus.extraSegments = [
  { name: 'tailLoft', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(species.ankylosaurus.tailStations), caps: species.ankylosaurus.tailCaps },
  // the tail CLUB: a wide flat bony knob of paired osteoderms round the tail tip
  { name: 'club', kind: 'loft', slots: 'ring12', group: 'Horn', mirror: 'plane', up: true, stations: loftOf([[-4.45, 0.80, [0.12, 0.10]], [-4.65, 0.80, [0.34, 0.17]], [-4.95, 0.80, [0.36, 0.18]], [-5.20, 0.80, [0.18, 0.12]]]),
    caps: { back: [0, -4.35, 0.80], tip: [0, -5.32, 0.80] } },
  ...[0, 1, 2, 3, 4].map((i) => spike(`side${i}`, 0.15 - i * 0.01)),
];
delete species.ankylosaurus.ankyBack;

export const about = {
  stegosaurus: { common: 'stegosaurus', aliases: ['stego'], sci: 'Stegosaurus stenops', size: '~9 m long, hips ~2.6 m, ~4 m to the plate tips', source: 'Gilmore 1914; Maidment et al. 2015 (NHMUK specimen)' },
  ankylosaurus: { common: 'ankylosaurus', aliases: ['ankylosaur', 'club tail dinosaur'], sci: 'Ankylosaurus magniventris', size: '6–8 m long, ~1.7 m tall', source: 'Arbour & Mallon 2017, FACETS 2: 764' },
};
