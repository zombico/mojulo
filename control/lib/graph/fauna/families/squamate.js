// SQUAMATE — lizards and snakes. The family's tables are a MONITOR LIZARD: a long, slightly flattened trunk slung
// between SPRAWLING legs (upper arm and thigh out sideways, the feet planted wide with long clawed toes), a LONG
// NECK, a long narrow head with the eyes on the sides, no external ears, a forked tongue (opt-in ornament), and a
// long, round-to-slightly-flattened whip TAIL longer than the body. A snake is the same plan with `legs: []`, a short
// level trunk at the head end, and the body laid down as a sinuous loft (`sinuous()` below). Tables are authored in
// metres at Komodo-dragon size. Worked species: the Komodo dragon (monitorLizard) and the Burmese python (snake).

import { flat, flatJaw, SKULL, JAW, loftOf, sinuous, path3, serpentMaker, serpent, TONGUE, snakeHead } from '../makers/serpent.js';
// a snake's tongue: the family tongue at 0.55 (a slim fork about a third of the head long, not a lizard's)
const SNAKE_TONGUE = TONGUE.map((o) => ({ ...o, spine: o.spine.map((q) => q.map((v) => v * 0.55)), radii: o.radii.map((v) => v * 0.55) }));

// the generators live in makers/serpent.js; re-exported for existing callers
export { sinuous, path3, serpentMaker, TONGUE };

export const family = {
  family: 'squamate',
  colors: {
    coat: '#6a6150', sock: '#5d5545', ash: '#9a8f72', ashAlt: '#8c8166', brow: '#4c4536', iris: '#c9a23a',
    ink: '#14120d', sclera: '#2d2a1d', nose: '#3a3428', teeth: '#e4ddc8', mouth: '#b07a6e', tip: '#4c4536',
    hoof: '#2f2b22', belly: '#a69a78',
  },
  joints: {
    neckBase: [0, 0.38, 0.27], neckTop: [0, 0.78, 0.32],
    // sprawling: the elbow and the knee out past the body, the feet set wide, the long toes splayed forward
    shoulder: [0.12, 0.30, 0.24], elbow: [0.30, 0.27, 0.21], carpus: [0.32, 0.33, 0.045], forePaw: [0.32, 0.345, 0.02], foreToe: [0.37, 0.46, 0.008],
    hip: [0.11, -0.36, 0.25], stifle: [0.33, -0.30, 0.22], hock: [0.35, -0.45, 0.05], hindPaw: [0.35, -0.44, 0.02], hindToe: [0.41, -0.31, 0.008],
  },
  torso: [
    { at: [0, -0.48, 0.27], r: [0.11, 0.10] },
    { at: [0, -0.28, 0.27], r: [0.17, 0.125] },
    { at: [0, 0.0, 0.27], r: [0.19, 0.13] },
    { at: [0, 0.24, 0.27], r: [0.16, 0.12] },
    { at: [0, 0.42, 0.27], r: [0.10, 0.09] },
  ],
  torsoCaps: { back: [0, -0.55, 0.27], tip: [0, 0.50, 0.27] },
  neckRA: [0.095, 0.085], neckRB: [0.05, 0.05], neckRMid: [0.07, 0.065],
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.055, 0.05], [0.04, 0.038], 'Coat', [0.5, 0.4]],
    ['foreArmR', 'elbow', 'carpus', [0.04, 0.038], [0.03, 0.03], 'Coat', [0.4, 0.3]],
    ['pasternR', 'carpus', 'forePaw', 0.03, 0.028, 'Sock', [0.3, 0.3]],
    ['forePawR', 'forePaw', 'foreToe', [0.04, 0.014], [0.03, 0.007], 'Hoof', [0.3, 0.2]],
    ['thighR', 'hip', 'stifle', [0.075, 0.07], [0.05, 0.045], 'Coat', [0.4, 0.4]],
    ['shinR', 'stifle', 'hock', [0.045, 0.042], [0.033, 0.033], 'Coat', [0.4, 0.3]],
    ['metaR', 'hock', 'hindPaw', 0.033, 0.03, 'Sock', [0.3, 0.3]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.045, 0.015], [0.032, 0.007], 'Hoof', [0.3, 0.2]],
  ],
  levelLegs: true,
  // the skull: narrow and only a little flattened, the snout drawn out moderately (a monitor's long tapering head)
  craniumRows: flat(SKULL, 0.8, 0.8),
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.012] },
  muzzleFrom: 3,
  jawRows: flatJaw(JAW, 0.8, 0.8),
  jawCaps: { back: [0, -0.1, -0.05], tip: [0, 0.21, -0.03] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.6, nape: [0, -0.1, -0.02],
  // the eyes on the sides of the skull, nostrils near the snout tip, no nose pad, no external ears
  eyeAt: [1.9, 2.1], eyeR: 0.011, orbit: { reach: [0.003, 0.0035, 0.004], bulk: [0.001, 0.002], thickness: 0.002 }, pupil: 'round', irisAngle: 40,
  browStrip: [[1.6, 1.8], [1.9, 1.7], [2.2, 1.7], [2.5, 1.8], [2.8, 1.9]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.4, 1.6], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  muzzleW: 0.85, muzzleLen: 1.6,
  headOrnaments: [], headTiles: [], bodyTiles: [],
  scale: 1,
};
// the tail: a long whip [x, y, z, [half-width, half-height]] on stable rings, drooping to rest on the ground
family.tailStations = [[0, -0.50, 0.27, [0.11, 0.10]], [0, -0.75, 0.24, [0.10, 0.095]], [0, -1.05, 0.17, [0.065, 0.07]], [0, -1.40, 0.09, [0.045, 0.05]], [0, -1.75, 0.04, [0.025, 0.03]], [0, -2.0, 0.018, [0.012, 0.014]]];
family.extraSegments = [
  { name: 'tailWhip', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(family.tailStations), caps: { back: [0, -0.42, 0.27], tip: [0, -2.07, 0.012] } },
];

// the snake's body: a short level trunk behind the head, then the S of coils on the ground
const PY_R = [0.1, 0.08];
const PY_BODY = sinuous({ y0: -0.05, length: 3.25, amp: 0.33, waves: 2, back: 2.0, n: 56, r0: PY_R, taper: [[0, 0.95], [0.5, 1.15], [0.82, 0.95], [0.93, 0.45], [1, 0.08]] });


// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // KOMODO DRAGON (Varanus komodoensis), the monitor lizard. Thesis: a long, heavy, slightly flattened trunk held
  // just off the ground on SPRAWLING, thick, clawed legs · a LONG NECK carrying a long narrow head, eyes on the sides,
  // no ears, a forked tongue · a long, thick, tapering tail as long as the body, dragged · drab grey-brown · ~2.6 m
  // total, ~0.4 m to the top of the back (Wikipedia / Smithsonian NZP: adult males average 2.59 m, 79–91 kg; the tail
  // about half the total length).
  monitorLizard: {
    // kept v4 (blind judges: A v4 over post-critic v5 55%; B v5 over v1 65%)
    family: 'squamate', name: 'a Komodo dragon', scale: 1, legBulk: 1.2, headOrnaments: TONGUE,
  },
  // BURMESE PYTHON (Python bivittatus), the snake. Thesis: NO legs · a long, thick, heavy body laid on the ground in an
  // S, thickest mid-body, tapering to a short tail · a broad, flat, wedge head wider than the neck, eyes on the sides,
  // held a little off the ground · blotched tan and dark brown · ~3.7 m long, ~0.17 m body thickness (Wikipedia:
  // wild adults average 3.7 m; Reed & Rodda 2009, USGS: large adults 4–5 m).
  snake: {
    // kept v5 (blind judges: A v5 over v4 75%; B v5 over v1 75%)
    family: 'squamate', name: 'a Burmese python', scale: 1, orbitFallback: true,
    legs: [], levelLegs: false,
    joints: { neckBase: [0, 0.32, 0.085], neckTop: [0, 0.48, 0.10] },
    torso: [
      { at: [0, -0.10, 0.08], r: PY_R },
      { at: [0, 0.10, 0.08], r: PY_R },
      { at: [0, 0.30, 0.08], r: [0.08, 0.07] },
    ],
    torsoCaps: { back: [0, -0.16, 0.08], tip: [0, 0.36, 0.08] },
    neckRA: [0.06, 0.055], neckRB: [0.045, 0.04], neckRMid: [0.05, 0.045],
    ...snakeHead([1.05, 0.8]),
    headScale: 0.42, muzzleW: 1.0, muzzleLen: 0.9,
    eyeAt: [2.4, 2.9], eyeR: 0.005, orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.0015 }, headOrnaments: SNAKE_TONGUE,
    extraSegments: [
      { name: 'coils', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: null, up: true, stations: loftOf(PY_BODY),
        caps: { back: [0, -0.04, 0.08], tip: [PY_BODY.at(-1)[0], PY_BODY.at(-1)[1] - 0.03, 0.01] } },
    ],
    colors: { coat: '#8a6a3e', sock: '#8a6a3e', ash: '#a8875a', ashAlt: '#9a7a50', brow: '#4a3622', belly: '#d8cba2', iris: '#9a7a3a', tip: '#4a3622' },
  },
  // KING COBRA (Ophiophagus hannah). Thesis: NO legs · the FRONT THIRD REARED straight up off the ground (head held
  // level ~0.95 m up) with a long, narrow spread HOOD just behind the head · the rest a long, slender, loose S on the
  // ground · a smallish rounded head · olive-brown with pale cross bands, pale throat · ~3.6 m long (Wikipedia: adults
  // typically 3.18–4 m, record 5.85 m; it can rear about a third of its length).
  kingCobra: serpentMaker({ name: 'a king cobra', girth: [0.042, 0.036], profile: [[0, 0.8], [0.25, 1], [0.7, 1], [0.9, 0.55], [1, 0.1]],
    path: { kind: 'raised', height: 0.92, ground: [[0.2, -0.78], [0.3, -1.05], [0.12, -1.32], [-0.18, -1.5], [-0.32, -1.78], [-0.15, -2.08], [0.15, -2.25], [0.3, -2.5], [0.25, -2.75]] },
    hood: { width: 0.15, from: 0.04, peak: 0.2, to: 0.5 }, head: { shape: 'slender', scale: 0.26, eyeR: 0.0065 },
    pattern: [
      { on: 'body', kind: 'stripes', count: 26, run: [0.2, 0.96], width: 0.28, group: 'Band', color: '#c9c58e' },
      { on: 'body', kind: 'band', run: [0, 0.12], t: [0, 0.45], group: 'Throat', color: '#d8cf98' },
    ],
    colors: { coat: '#4f5230', sock: '#4f5230', ash: '#6a6a3c', ashAlt: '#5d5d36', brow: '#33341d', belly: '#c9c58e', iris: '#6a5a2a', tip: '#33341d' } }),
  // WESTERN DIAMONDBACK RATTLESNAKE (Crotalus atrox). Thesis: NO legs · heavy body in a flat ground COIL with the neck
  // raised over it in an S, ready to strike · a broad TRIANGULAR viper head on a thin neck · the RATTLE: a stack of
  // keratin beads at the lifted tail tip, the tail above it ringed black and white · grey-brown with dark DIAMONDS down
  // the back · ~1.2 m long (Wikipedia: adults commonly 1.2 m, max ~2.1 m), head ~5 cm.
  rattlesnake: serpentMaker({ name: 'a western diamondback rattlesnake', n: 84, girth: [0.036, 0.03], profile: [[0, 0.45], [0.15, 0.9], [0.35, 1.05], [0.8, 0.9], [0.95, 0.45], [1, 0.32]],
    path: { kind: 'coil', height: 0.2, neck: [[-0.05, 0.16], [-0.02, 0.11], [-0.07, 0.05], [-0.1, 0.0]], centre: [0, -0.17], r: [0.07, 0.165], turns: 1.25,
      lift: [[-0.17, -0.12, 0.02], [-0.175, -0.1, 0.05]] },
    head: { shape: 'viper', scale: 0.21, eyeR: 0.0065 }, tail: { kind: 'rattle', beads: 7 },
    pattern: [
      { on: 'body', kind: 'patch', grid: [24, 1], run: [0.12, 0.86], t: [0.62, 1], size: [0.6, 1], group: 'Diamond', color: '#4b3b2a' },
      { on: 'body', kind: 'band', run: [0.86, 1], group: 'TailWhite', color: '#e4ddcb' },
      { on: 'body', kind: 'stripes', count: 4, run: [0.86, 1], width: 0.5, group: 'TailBlack', color: '#1d1a17' },
    ],
    colors: { coat: '#8f8166', sock: '#8f8166', ash: '#a39478', ashAlt: '#968a6e', brow: '#4b3b2a', belly: '#d9cfb4', iris: '#a88a3a', tip: '#4b3b2a', horn: '#b7a27a' } }),
  // GREEN MAMBA (Dendroaspis viridis, western green mamba). Thesis: NO legs · very SLENDER and long, the front loosely
  // raised, the rest draped in a long loose S · a narrow, long, coffin-shaped head barely wider than the neck · uniform
  // BRIGHT GREEN, yellow-green belly · ~2.0 m long (Wikipedia: adults average 1.4–2 m, max 2.4 m).
  greenMamba: serpentMaker({ name: 'a green mamba', girth: [0.02, 0.018], profile: [[0, 0.75], [0.2, 1], [0.7, 0.95], [0.9, 0.5], [1, 0.12]],
    path: { kind: 'pts', pts: [[0, -0.03, 0.24], [0, -0.1, 0.19], [0, -0.2, 0.1], [0, -0.32, 0.02], [0, -0.45, 0], [0.18, -0.62, 0], [0.22, -0.85, 0], [0.02, -1.05, 0],
      [-0.2, -1.22, 0], [-0.24, -1.45, 0], [-0.05, -1.65, 0], [0.15, -1.8, 0]] },
    head: { shape: 'coffin', scale: 0.15, eyeR: 0.006 },
    pattern: [{ on: 'body', kind: 'band', t: [0, 0.32], group: 'Belly' }],
    colors: { coat: '#3f9f35', sock: '#3f9f35', ash: '#7cbd45', ashAlt: '#6db03d', brow: '#2d7a28', belly: '#b9d65a', iris: '#8a9a2a', tip: '#2d7a28' } }),
  // SEA SERPENT (mythic). Thesis: NO legs · HUGE: a body ~40 m long and ~1.2 m thick, a swan neck rearing the head ~7 m
  // out of the sea, then three HUMPS arching out of the water (their feet on the water plane z = 0) and a tail run · a
  // finned dorsal FRILL of upright blades along the neck and humps · a long DRAGON-LIKE head (~2 m) with swept-back horns
  // and jaw frills · dark sea-green, pale belly, red frill. Intended scale: after Olaus Magnus's (1555) "200 ft" sea
  // serpent, brought down to ~40 m so the humps read at gameplay camera (no published figure exists).
  seaSerpent: serpentMaker({ name: 'a sea serpent', n: 120, girth: [0.6, 0.6], up: [1, 0, 0], profile: [[0, 0.62], [0.12, 0.85], [0.3, 1], [0.6, 0.85], [0.85, 0.5], [1, 0.12]],
    path: { kind: 'arches', height: 6.4, neck: [[-1.2, 5.7], [-1.7, 4.4], [-1.6, 3.0], [-1.2, 1.6], [-1.4, 0.35], [-2.4, 0]], start: -3.0, humps: [[3.6, 5], [3.0, 4.6], [2.3, 4]], run: 3.1 },
    crest: { every: 3, above: 1.4, to: 104 },
    head: { shape: 'dragon', scale: 4.2, eyeR: 0.005, tongue: false, ornaments: [   // pinned on the right; the head mirrors them
      { kind: 'sweep', name: 'horn', at: [1.3, 1.6], space: 'local', spine: [[0, 0, 0], [-0.35, -0.1, 0.45], [-1.0, -0.25, 0.8], [-1.6, -0.2, 0.85]], radii: [0.16, 0.12, 0.06, 0.015], m: 6, group: 'Horn' },
      { kind: 'sweep', name: 'frill', at: [1.6, 3.6], space: 'local', spine: [[0, 0, -0.02], [-0.2, 0, 0.12], [-0.6, 0, 0.35], [-1.1, 0, 0.5]], radii: [0.04, 0.26, 0.2, 0.03], squash: [0.15, 1], m: 6, group: 'Mane' },
    ] },
    pattern: [{ on: 'body', kind: 'band', t: [0.5, 1], group: 'Belly' }],
    colors: { coat: '#24514c', sock: '#24514c', ash: '#3c6a5e', ashAlt: '#356055', brow: '#163a36', belly: '#c9c49a', iris: '#d6a12a', tip: '#163a36', horn: '#d8cdb0', mane: '#a8402c', sclera: '#1a1a12' } }),
  // GREEN ANACONDA (Eunectes murinus) — written purely as a maker call. Thesis: NO legs · VERY THICK, heavy body
  // (~0.3 m across mid-body, the heaviest snake), the rear PARTLY COILED in a loose flat loop on the ground with the
  // tail trailing out of it, the front laid out low in an S · a fairly small, narrow head barely wider than the neck,
  // eyes and nostrils high on top · olive green with large black OVAL BLOTCHES down the back, yellowish belly · ~5 m
  // long (Wikipedia: females typically 4–5 m; Rivas 2000: up to ~5.2 m measured).
  anaconda: serpent({
    name: 'a green anaconda', n: 110, girth: [0.15, 0.13], profile: [[0, 0.55], [0.12, 0.8], [0.3, 1], [0.7, 1], [0.88, 0.6], [1, 0.12]],
    path: { kind: 'coil', height: 0.04, neck: [[-0.35, 0.02], [-0.6, 0], [-0.9, 0]], centre: [0.15, -1.5], r: [0.42, 0.85], turns: 0.75,
      lift: [[1.35, -1.75, 0], [1.75, -1.4, 0], [2.15, -1.6, 0]] },
    head: { shape: 'blunt', scale: 0.5, skull: [0.95, 0.72], muzzle: [0.9, 1.0], eyeR: 0.006, eyeAt: [2.2, 2.3] },
    pattern: [
      { on: 'body', kind: 'patch', grid: [30, 2], run: [0.04, 0.95], t: [0.55, 1], size: [0.55, 0.7], group: 'Blotch', color: '#1d1f14' },
      { on: 'body', kind: 'band', run: [0, 1], t: [0, 0.28], group: 'Belly' },
    ],
    colors: { coat: '#4f5a2a', sock: '#4f5a2a', ash: '#66703a', ashAlt: '#5b6533', brow: '#2f3618', belly: '#c9b85a', iris: '#8a7a2a', tip: '#2f3618' },
  }),
};

