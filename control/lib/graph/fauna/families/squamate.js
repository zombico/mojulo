// SQUAMATE — lizards and snakes. The family's tables are a MONITOR LIZARD: a long, slightly flattened trunk slung
// between SPRAWLING legs (upper arm and thigh out sideways, the feet planted wide with long clawed toes), a LONG
// NECK, a long narrow head with the eyes on the sides, no external ears, a forked tongue (opt-in ornament), and a
// long, round-to-slightly-flattened whip TAIL longer than the body. A snake is the same plan with `legs: []`, a short
// level trunk at the head end, and the body laid down as a sinuous loft (`sinuous()` below). Tables are authored in
// metres at Komodo-dragon size. Worked species: the Komodo dragon (monitorLizard) and the Burmese python (snake).

const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
// the skull rows (the crocodilian's, from the canine): reshaped per species by flat() + muzzleW / muzzleLen
const SKULL = [
  ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
  ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
  ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
  ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
  ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
  ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
  ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
];
const JAW = [
  ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
  ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
  ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
  ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
  ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
];
const loftOf = (pts) => pts.map(([x, y, z, r]) => ({ at: [x, y, z], r }));

/** A SINUOUS body on the ground: a loft whose centre line is an S (x = amp·sin, y running back), at height = the
 * ring's half-height, so the belly rests on z = 0. Stations every `step` of arc, radii tapering from `r0` to the tail.
 * Returns [x, y, z, [halfWidth, halfHeight]] rows, starting at (0, y0) heading back (−y). */
export function sinuous({ y0 = 0, length = 3, amp = 0.4, waves = 1.25, back = 2, r0 = [0.08, 0.065], taper = [[0, 1], [0.5, 1], [0.8, 0.6], [1, 0.12]], n = 26, x0 = 0 }) {
  // sample the curve finely, then re-sample by arc length
  const f = (t) => [x0 + amp * Math.sin(2 * Math.PI * waves * t), y0 - back * t];
  const fine = Array.from({ length: 400 }, (_, i) => f(i / 399)); const s = [0];
  for (let i = 1; i < fine.length; i++) s.push(s[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]));
  const L = s[s.length - 1], k = length / L;   // scale the S so its arc is `length`
  const tap = (u) => { for (let i = 1; i < taper.length; i++) if (u <= taper[i][0]) { const [a, va] = taper[i - 1], [b, vb] = taper[i]; return va + (vb - va) * (u - a) / (b - a); } return taper[taper.length - 1][1]; };
  return Array.from({ length: n }, (_, j) => { const u = j / (n - 1), target = u * L; let i = s.findIndex((x) => x >= target); if (i < 0) i = s.length - 1;
    const [x, y] = fine[i]; const r = r0.map((v) => v * tap(u)); return [x0 + (x - x0) * k, y0 + (y - y0) * k, r[1], r]; });
}

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

// the FORKED TONGUE (opt-in ornament): two thin prongs flicked out from under the snout tip, splayed apart
export const TONGUE = [-1, 1].map((s, i) => ({ kind: 'sweep', name: `tongue${i}`, at: [5.95, 6], space: 'local', spine: [[0, 0, -0.004], [0, 0.02, 0.004], [s * 0.008, 0.04, 0.006]], radii: [0.004, 0.003, 0.0012], m: 5, group: 'Tongue' }));

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
    craniumRows: flat(SKULL, 1.15, 0.55), jawRows: flatJaw(JAW, 1.15, 0.55),
    headScale: 0.42, muzzleW: 1.05, muzzleLen: 0.9,
    eyeAt: [2.4, 2.5], eyeR: 0.005, orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.0015 }, headOrnaments: TONGUE,
    extraSegments: [
      { name: 'coils', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: null, up: true, stations: loftOf(PY_BODY),
        caps: { back: [0, -0.04, 0.08], tip: [PY_BODY.at(-1)[0], PY_BODY.at(-1)[1] - 0.03, 0.01] } },
    ],
    colors: { coat: '#8a6a3e', sock: '#8a6a3e', ash: '#a8875a', ashAlt: '#9a7a50', brow: '#4a3622', belly: '#d8cba2', iris: '#9a7a3a', tip: '#4a3622' },
  },
};
