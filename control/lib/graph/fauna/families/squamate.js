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
// a dorsal crest of spines: a thin midline loft, tall narrow stations (`h` × weight above the back line) between
// low ones, along a back line [y, z of the back surface, weight] (the crocodilian's scute crest, made tall and thin)
const spines = (pts, h) => pts.flatMap(([y, z, w], i, a) => (i === a.length - 1 ? [[0, y, z + 0.3 * h * w, [0.006, 0.025]]]
  : [[0, y, z + 0.6 * h * w, [0.006, 0.4 * h * w]], [0, (y + a[i + 1][0]) / 2, (z + a[i + 1][1]) / 2 + 0.12 * h * w, [0.008, 0.12 * h * w]]]));

const CH = 0.22;   // the chameleon's scale (its trunk `top` is written in metres after scale)
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
    // 1006 upgrade: v8 (higher trunk, longer narrower neck, 3 toes, deeper skull, longer tongue) vs v4 SPLIT (v4 won order1 65%, v8 won order2 60%) → tie, v4 kept
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
    eyeAt: [2.4, 2.9], eyeR: 0.005, eyeStyle: 'set', orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.0015 }, headOrnaments: SNAKE_TONGUE,
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
    hood: { width: 0.15, from: 0.04, peak: 0.2, to: 0.5 }, head: { shape: 'slender', scale: 0.26, eyeR: 0.0065, eyeStyle: 'set' },
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
    head: { shape: 'viper', scale: 0.21, eyeR: 0.0065, eyeStyle: 'set' }, tail: { kind: 'rattle', beads: 7 },
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
    head: { shape: 'coffin', scale: 0.15, eyeR: 0.006, eyeStyle: 'set' },
    pattern: [{ on: 'body', kind: 'band', t: [0, 0.32], group: 'Belly' }],
    colors: { coat: '#3f9f35', sock: '#3f9f35', ash: '#7cbd45', ashAlt: '#6db03d', brow: '#2d7a28', belly: '#b9d65a', iris: '#8a9a2a', tip: '#2d7a28' } }),
  // SEA SERPENT (mythic). Thesis: NO legs · HUGE: a body ~40 m long and ~1.2 m thick, a swan neck rearing the head ~7 m
  // out of the sea, then three HUMPS arching out of the water (their feet on the water plane z = 0) and a tail run · a
  // finned dorsal FRILL of upright blades along the neck and humps · a long DRAGON-LIKE head (~2 m) with swept-back horns
  // and jaw frills · dark sea-green, pale belly, red frill. Intended scale: after Olaus Magnus's (1555) "200 ft" sea
  // serpent, brought down to ~40 m so the humps read at gameplay camera (no published figure exists).
  // kept v3; 1006 upgrade v6 (eye +30%, horns back 25°/×0.8, hump gap 1.3, centred belly band) lost both orders to v3 (70%, 70%: the shorter horns lose the horned-head read)
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
    head: { shape: 'blunt', scale: 0.5, skull: [0.95, 0.72], muzzle: [0.9, 1.0], eyeR: 0.006, eyeAt: [2.2, 2.3], eyeStyle: 'set' },
    pattern: [
      { on: 'body', kind: 'patch', grid: [30, 2], run: [0.04, 0.95], t: [0.55, 1], size: [0.55, 0.7], group: 'Blotch', color: '#1d1f14' },
      { on: 'body', kind: 'band', run: [0, 1], t: [0, 0.28], group: 'Belly' },
    ],
    colors: { coat: '#4f5a2a', sock: '#4f5a2a', ash: '#66703a', ashAlt: '#5b6533', brow: '#2f3618', belly: '#c9b85a', iris: '#8a7a2a', tip: '#2f3618' },
  }),
  // TOKAY GECKO (Gekko gecko). Thesis: a small, FLAT, broad lizard on short splayed legs ending in wide adhesive TOE
  // PADS · a BIG, broad, triangular head on almost no neck, short rounded snout, HUGE lidless eyes with slit pupils ·
  // a plump tail about as long as the body · blue-grey skin dotted with ORANGE spots · ~0.17 m snout–vent, ~0.3 m
  // total (Wikipedia "Tokay gecko" / Grossmann 2004: SVL up to ~0.18 m, total 0.3–0.4 m). Authored at the family's
  // Komodo size and scaled down.
  gecko: {
    family: 'squamate', name: 'a tokay gecko', scale: 0.12, orbitFallback: true,
    joints: {
      neckBase: [0, 0.40, 0.21], neckTop: [0, 0.58, 0.235],
      shoulder: [0.12, 0.30, 0.20], elbow: [0.32, 0.30, 0.19], carpus: [0.36, 0.38, 0.04], forePaw: [0.37, 0.40, 0.02], foreToe: [0.44, 0.50, 0.008],
      hip: [0.11, -0.34, 0.21], stifle: [0.36, -0.28, 0.20], hock: [0.40, -0.42, 0.04], hindPaw: [0.41, -0.43, 0.02], hindToe: [0.50, -0.34, 0.008],
    },
    torso: [
      { at: [0, -0.46, 0.22], r: [0.12, 0.08] },
      { at: [0, -0.26, 0.22], r: [0.19, 0.10] },
      { at: [0, 0.0, 0.22], r: [0.21, 0.11] },
      { at: [0, 0.24, 0.22], r: [0.18, 0.10] },
      { at: [0, 0.42, 0.22], r: [0.13, 0.085] },
    ],
    torsoCaps: { back: [0, -0.53, 0.22], tip: [0, 0.50, 0.22] },
    neckRA: [0.13, 0.085], neckRB: [0.12, 0.08], neckRMid: [0.125, 0.08],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', [0.05, 0.045], [0.038, 0.035], 'Coat', [0.5, 0.4]],
      ['foreArmR', 'elbow', 'carpus', [0.038, 0.035], [0.028, 0.028], 'Coat', [0.4, 0.3]],
      ['pasternR', 'carpus', 'forePaw', 0.028, 0.026, 'Sock', [0.3, 0.3]],
      ['forePawR', 'forePaw', 'foreToe', [0.045, 0.012], [0.075, 0.01], 'Hoof', [0.3, 0.2]],
      ['thighR', 'hip', 'stifle', [0.065, 0.06], [0.045, 0.042], 'Coat', [0.4, 0.4]],
      ['shinR', 'stifle', 'hock', [0.042, 0.04], [0.03, 0.03], 'Coat', [0.4, 0.3]],
      ['metaR', 'hock', 'hindPaw', 0.03, 0.028, 'Sock', [0.3, 0.3]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.05, 0.012], [0.08, 0.01], 'Hoof', [0.3, 0.2]],
    ],
    // the head: broad and flat-topped, the snout short and round
    craniumRows: flat(SKULL, 1.45, 0.8), jawRows: flatJaw(JAW, 1.45, 0.8),
    headScale: 1.0, muzzleW: 1.0, muzzleLen: 0.9,
    eyeAt: [2.2, 2.1], eyeR: 0.015, eyeStyle: 'set', eyeSet: { sink: 0.35, open: [1.0, 0.95] }, pupil: 'slit',
    headPalette: { Nostrils: '#4a566c' },   // the family's hairline nostril slits, toned down to a darker grey
    extraSegments: [
      { name: 'tailWhip', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true,
        stations: loftOf([[0, -0.48, 0.22, [0.12, 0.08]], [0, -0.68, 0.19, [0.10, 0.075]], [0, -0.92, 0.12, [0.075, 0.06]], [0, -1.18, 0.06, [0.05, 0.04]], [0, -1.42, 0.03, [0.025, 0.022]]]),
        caps: { back: [0, -0.42, 0.22], tip: [0, -1.48, 0.025] } },
    ],
    markDensity: { torso: 5, tailWhip: 3 },
    markings: [
      { on: 'torso', kind: 'spots', count: 40, seed: 3, t: [0.05, 0.65], size: [0.05, 0.08], group: 'Spot', color: '#d9773a' },
      { on: 'tailWhip', kind: 'stripes', count: 7, width: 0.35, t: [0, 0.7], group: 'Band', color: '#cfd6e0' },
      { on: 'torso', kind: 'belly', from: 0.7, group: 'Belly' },
    ],
    colors: { coat: '#6f7f9a', sock: '#6f7f9a', ash: '#8e9bb0', ashAlt: '#8090a8', brow: '#56637a', belly: '#c8ccd2', iris: '#c9b84a', tip: '#56637a', hoof: '#9aa6b8', lids: '#5a6780' },
  },
  // GREEN IGUANA (Iguana iguana). Thesis: a deep, laterally flattened body on sprawling legs, the head held UP on a
  // short thick neck · a big hanging DEWLAP under the throat · a CREST of tall soft spines from the nape down the back
  // and onto the tail · a short deep blunt head with a round pale cheek SHIELD below the ear · a very long whip tail,
  // about two thirds of the animal, banded dark · bright green · ~0.4 m snout–vent, ~1.5 m total (ADW "Iguana
  // iguana": SVL to ~0.42 m, total to ~2 m, the tail about 2/3 of the length).
  iguana: {
    family: 'squamate', name: 'a green iguana', scale: 0.28,
    joints: {
      neckBase: [0, 0.40, 0.30], neckTop: [0, 0.64, 0.40],
      shoulder: [0.10, 0.30, 0.25], elbow: [0.28, 0.27, 0.22], carpus: [0.30, 0.33, 0.045], forePaw: [0.30, 0.345, 0.02], foreToe: [0.35, 0.47, 0.008],
      hip: [0.10, -0.36, 0.25], stifle: [0.31, -0.30, 0.22], hock: [0.33, -0.45, 0.05], hindPaw: [0.33, -0.44, 0.02], hindToe: [0.40, -0.28, 0.008],
    },
    // deeper than wide (a laterally flattened lizard)
    torso: [
      { at: [0, -0.48, 0.28], r: [0.10, 0.11] },
      { at: [0, -0.28, 0.28], r: [0.14, 0.16] },
      { at: [0, 0.0, 0.28], r: [0.155, 0.175] },
      { at: [0, 0.24, 0.28], r: [0.135, 0.16] },
      { at: [0, 0.42, 0.28], r: [0.095, 0.115] },
    ],
    torsoCaps: { back: [0, -0.55, 0.28], tip: [0, 0.50, 0.29] },
    neckRA: [0.09, 0.105], neckRB: [0.075, 0.085], neckRMid: [0.08, 0.095],
    // the head: deep and blunt, the snout short
    craniumRows: flat(SKULL, 0.95, 1.05), jawRows: flatJaw(JAW, 0.95, 1.05),
    headScale: 0.72, muzzleW: 0.9, muzzleLen: 0.8,
    eyeAt: [2.2, 2.1], eyeR: 0.0105, eyeStyle: 'set', eyeSet: { sink: 0.35, open: [1.0, 0.9] }, orbitFallback: true,
    headPalette: { Nostrils: '#3e6a2a' },
    // the subtympanic SHIELD: a big round pale scale low on the cheek behind the mouth
    headOrnaments: [{ kind: 'sweep', name: 'shield', at: [1.1, 3.9], space: 'local', spine: [[0, 0, -0.004], [0, 0, 0.002]], radii: [0.013, 0.012], m: 10, squash: [1, 1], group: 'Horn' }],
    legBulk: 1.1,
    extraSegments: [
      { name: 'tailWhip', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true,
        stations: loftOf([[0, -0.50, 0.28, [0.10, 0.11]], [0, -0.80, 0.24, [0.075, 0.09]], [0, -1.20, 0.16, [0.05, 0.06]], [0, -1.70, 0.08, [0.032, 0.036]], [0, -2.25, 0.035, [0.018, 0.02]], [0, -2.75, 0.015, [0.008, 0.008]]]),
        caps: { back: [0, -0.43, 0.28], tip: [0, -2.82, 0.012] } },
      // the DEWLAP: a thin keel of skin hanging under the throat, from the chin back to the chest
      { name: 'dewlap', kind: 'loft', slots: 'ring12', group: 'Ash', mirror: 'plane', up: true,
        stations: loftOf([[0, 0.40, 0.22, [0.015, 0.03]], [0, 0.50, 0.17, [0.016, 0.08]], [0, 0.60, 0.19, [0.015, 0.085]], [0, 0.70, 0.25, [0.013, 0.06]], [0, 0.76, 0.30, [0.01, 0.025]]]),
        caps: { back: [0, 0.37, 0.24], tip: [0, 0.79, 0.31] } },
      // the dorsal CREST: soft spines, tallest at the nape, down the back and onto the tail
      { name: 'crest', kind: 'loft', slots: 'ring12', group: 'Horn', mirror: 'plane', up: true, stations: loftOf(spines([[0.60, 0.46, 1.4], [0.42, 0.43, 1.5], [0.24, 0.45, 1.3], [0.0, 0.46, 1.2], [-0.28, 0.44, 1.0], [-0.50, 0.39, 0.9], [-0.80, 0.33, 0.8], [-1.20, 0.22, 0.6], [-1.50, 0.14, 0.4]], 0.05)),
        caps: { back: [0, 0.64, 0.45], tip: [0, -1.55, 0.13] } },
    ],
    markDensity: { tailWhip: 4 },
    markings: [
      { on: 'tailWhip', kind: 'stripes', count: 9, run: [0.15, 1], width: 0.35, group: 'Band', color: '#2f4a24' },
      { on: 'torso', kind: 'belly', from: 0.65, group: 'Belly' },
    ],
    colors: { coat: '#5f9a3a', sock: '#5f9a3a', ash: '#8bbd5a', ashAlt: '#7cb04e', brow: '#467a2c', belly: '#a9cf7a', iris: '#c98a2a', tip: '#2f4a24', hoof: '#3a4a2e', horn: '#9ec98a', lids: '#4f8530' },
  },
  // VEILED CHAMELEON (Chamaeleo calyptratus). Thesis: a TALL, narrow, leaf-flat body with an arched back, held high on
  // thin legs that stand UNDER it (not sprawled), each foot split in two opposed toe bundles gripping · a tall
  // helmet CASQUE rising off the back of the head, no neck · TURRET EYES: big domed lids with only a small hole for
  // the pupil · a prehensile tail CURLED in a tight downward coil · green with pale yellow bands · ~0.25 m snout–vent,
  // ~0.5 m total (Wikipedia "Veiled chameleon" / Nečas 1999: males 43–61 cm total, the tail about half).
  chameleon: {
    family: 'squamate', name: 'a veiled chameleon', scale: CH, legScale: 0.65, levelLegs: false, orbitFallback: true,
    joints: {
      neckBase: [0, 0.34, 0.60], neckTop: [0, 0.46, 0.66],
      shoulder: [0.07, 0.26, 0.52], elbow: [0.15, 0.36, 0.32], carpus: [0.14, 0.30, 0.05], forePaw: [0.14, 0.31, 0.025], foreToe: [0.14, 0.40, 0.01], foreToeB: [0.14, 0.22, 0.01],
      hip: [0.07, -0.28, 0.52], stifle: [0.16, -0.20, 0.32], hock: [0.15, -0.32, 0.05], hindPaw: [0.15, -0.31, 0.025], hindToe: [0.15, -0.22, 0.01], hindToeB: [0.15, -0.40, 0.01],
    },
    // tall and narrow, the back arched (`top` raises the upper half of each ring; it is metres AFTER `scale`, which
    // build.js does not apply to it, so it is written × the species' scale)
    torso: [
      { at: [0, -0.40, 0.56], r: [0.06, 0.10], top: 0.015 * CH },
      { at: [0, -0.22, 0.56], r: [0.08, 0.15], top: 0.075 * CH },
      { at: [0, 0.0, 0.56], r: [0.09, 0.165], top: 0.105 * CH },
      { at: [0, 0.20, 0.56], r: [0.08, 0.15], top: 0.075 * CH },
      { at: [0, 0.36, 0.58], r: [0.06, 0.11], top: 0.03 * CH },
    ],
    torsoCaps: { back: [0, -0.46, 0.55], tip: [0, 0.42, 0.60] },
    neckRA: [0.07, 0.12], neckRB: [0.07, 0.10], neckRMid: [0.07, 0.11],
    legs: [
      ['upperArmR', 'shoulder', 'elbow', 0.032, 0.026, 'Coat', [0.5, 0.4]],
      ['foreArmR', 'elbow', 'carpus', 0.026, 0.02, 'Coat', [0.4, 0.3]],
      ['pasternR', 'carpus', 'forePaw', 0.02, 0.018, 'Sock', [0.3, 0.3]],
      ['forePawR', 'forePaw', 'foreToe', [0.022, 0.014], [0.012, 0.008], 'Sock', [0.3, 0.2]],
      ['forePawBR', 'forePaw', 'foreToeB', [0.022, 0.014], [0.012, 0.008], 'Sock', [0.3, 0.2]],
      ['thighR', 'hip', 'stifle', 0.04, 0.03, 'Coat', [0.4, 0.4]],
      ['shinR', 'stifle', 'hock', 0.03, 0.022, 'Coat', [0.4, 0.3]],
      ['metaR', 'hock', 'hindPaw', 0.022, 0.02, 'Sock', [0.3, 0.3]],
      ['hindPawR', 'hindPaw', 'hindToe', [0.022, 0.014], [0.012, 0.008], 'Sock', [0.3, 0.2]],
      ['hindPawBR', 'hindPaw', 'hindToeB', [0.022, 0.014], [0.012, 0.008], 'Sock', [0.3, 0.2]],
    ],
    // the head: deep and narrow, the snout short
    craniumRows: flat(SKULL, 0.85, 1.1), jawRows: flatJaw(JAW, 0.85, 1.1),
    headScale: 0.8, muzzleW: 0.85, muzzleLen: 0.75,
    // TURRET EYES: a big ball wrapped in a domed lid, open only around the pupil
    eyeAt: [2.2, 2.1], eyeR: 0.016, eyeStyle: 'set', eyeSet: { sink: 0.15, open: [0.5, 0.5], lid: 0.05 },
    headPalette: { Nostrils: '#3e6a2a' },
    // the CASQUE: a tall flat helmet rising off the back of the skull (head units, like the hadrosaur's crest)
    headOrnaments: [{ kind: 'sweep', name: 'casque', at: [0.6, 0.0001], side: 'R', space: 'head',
      spine: [[0, 0.02, 0.06], [0, -0.05, 0.11], [0, -0.11, 0.155], [0, -0.145, 0.17]], radii: [0.045, 0.055, 0.04, 0.01], m: 8, squash: [0.3, 1], group: 'Skull' }],
    extraSegments: [
      // the tail: back, then curled down and forward in a tight coil (a vertical spiral, so its rings take +x as up)
      { name: 'tailCoil', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: [1, 0, 0],
        stations: loftOf([[0, -0.42, 0.56, [0.055, 0.08]], [0, -0.58, 0.50, [0.045, 0.055]], [0, -0.72, 0.40, [0.036, 0.04]], [0, -0.80, 0.32, [0.03, 0.032]],
          [0, -0.78, 0.23, [0.026, 0.026]], [0, -0.71, 0.18, [0.022, 0.022]], [0, -0.63, 0.19, [0.019, 0.019]], [0, -0.59, 0.25, [0.016, 0.016]], [0, -0.62, 0.30, [0.013, 0.013]],
          [0, -0.68, 0.30, [0.011, 0.011]], [0, -0.69, 0.25, [0.009, 0.009]], [0, -0.65, 0.23, [0.007, 0.007]]]),
        caps: { back: [0, -0.38, 0.56], tip: [0, -0.62, 0.24] } },
    ],
    markDensity: { torso: 3 },
    markings: [
      { on: 'torso', kind: 'stripes', count: 5, run: [0.1, 0.9], width: 0.3, t: [0, 0.75], group: 'Band', color: '#c9c24a' },
      { on: 'torso', kind: 'belly', from: 0.8, group: 'Belly' },
    ],
    colors: { coat: '#4f9a3c', sock: '#4f9a3c', ash: '#79b65a', ashAlt: '#6aaa4c', brow: '#3c7a2c', belly: '#b5d27a', iris: '#c9a23a', tip: '#3c7a2c', hoof: '#3c7a2c', lids: '#4f9a3c' },
  },
};


// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  monitorLizard: { common: 'komodo dragon', aliases: ['komodo', 'monitor lizard', 'monitor', 'lizard'], sci: 'Varanus komodoensis', size: '~2.6 m total; ~0.4 m to the top of the back', source: 'Wikipedia / Smithsonian NZP' },
  snake: { common: 'python', aliases: ['burmese python'], sci: 'Python bivittatus', size: '~3.7 m long', source: 'Reed & Rodda 2009 (USGS)' },
  kingCobra: { common: 'king cobra', aliases: ['cobra'], sci: 'Ophiophagus hannah', size: '~3.6 m long', source: 'Wikipedia, "King cobra"' },
  rattlesnake: { common: 'rattlesnake', aliases: ['rattler', 'diamondback', 'western diamondback'], sci: 'Crotalus atrox', size: '~1.2 m long', source: 'Wikipedia, "Western diamondback rattlesnake"' },
  greenMamba: { common: 'green mamba', aliases: ['mamba'], sci: 'Dendroaspis viridis', size: '~2.0 m long', source: 'Wikipedia, "Western green mamba"' },
  seaSerpent: { common: 'sea serpent', aliases: ['sea monster', 'leviathan'], sci: 'mythic', size: '~40 m long (an invented scale)', source: 'after Olaus Magnus 1555' },
  anaconda: { common: 'anaconda', aliases: ['green anaconda'], sci: 'Eunectes murinus', size: '~5 m long', source: 'Rivas 2000' },
  gecko: { common: 'gecko', aliases: ['tokay gecko', 'tokay'], sci: 'Gekko gecko', size: '~0.17 m snout–vent; ~0.3 m total', source: 'Wikipedia, "Tokay gecko" / Grossmann 2004' },
  iguana: { common: 'iguana', aliases: ['green iguana'], sci: 'Iguana iguana', size: '~0.4 m snout–vent; ~1.5 m total', source: 'ADW, "Iguana iguana"' },
  chameleon: { common: 'chameleon', aliases: ['veiled chameleon'], sci: 'Chamaeleo calyptratus', size: '~0.25 m snout–vent; ~0.5 m total', source: 'Wikipedia, "Veiled chameleon" / Nečas 1999' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
};
