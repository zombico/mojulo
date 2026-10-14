// CEPHALOPOD — octopus, squid, cuttlefish, nautilus: no skeleton and no legs. A muscular MANTLE (the sac that holds the
// organs: the trunk here), a short neck into a HEAD that is mostly two big eyes, and a crown of ARMS around the mouth
// (eight, each a tapering loft that curls at its tip; a squid and a cuttlefish add two long feeding TENTACLES with
// clubbed ends), a funnel (siphon) under the head. The octopus rests on the seabed, its arms spread over the ground;
// the others hover in a swim pose, the squid and cuttlefish with flat FINS along the mantle, the nautilus inside its
// striped shell. Tables are authored in metres at common-octopus size. Worked species: the common octopus.
// See ../build.js for what every field does.

const v2 = (a, b, t) => a + (b - a) * t;
const r3 = (x) => Math.round(x * 1e4) / 1e4;

// THE HEAD: a ball of `R` (head units = metres at headScale 1), a little squashed top to bottom; the jaw a small
// beak hidden inside it. Rows [id, y, top, crown, brow, cheek, jowl, lip, palate]: each the ball's ring at y, its
// slots at 0°, 30° … 180° from the top.
const BALL = (R = 0.07, kz = 0.9) => [-0.06, -0.035, 0, 0.03, 0.05, 0.062, 0.068].map((u, i) => {
  const y = u * R / 0.07, rho = Math.sqrt(Math.max(R * R - y * y, (0.12 * R) ** 2)), at = (deg) => { const a = deg * Math.PI / 180; return [r3(rho * Math.sin(a)), r3(rho * Math.cos(a) * kz)]; };
  return [`st${i}`, r3(y), at(0)[1], at(30), at(60), at(90), at(120), at(150), at(180)[1]];
});
const BEAK = (R = 0.07) => [[-0.03, 0.42], [-0.01, 0.4], [0.01, 0.37], [0.025, 0.34], [0.04, 0.3]].map(([u, k], i) => {
  const y = u * R / 0.07, z = -k * R; return [`st${i}`, r3(y), { gum: r3(z), gumR: [r3(0.25 * R), r3(z)], jaw: [r3(0.28 * R), r3(z - 0.1 * R)], bottom: r3(z - 0.14 * R) }];
});

/** An ARM: a tapering loft from `root` along a heading (`angle` rad from +y toward +x, in the ground plane), out to
 * `len`, bending by `bend` rad along its run; `drop` brings it from the root's height down to rest on the ground
 * (0 = it keeps its height, for a swimmer); the last `curlAt` of it curls up and round by `curl` rad. Radii from `r0`
 * at the root to a fine point. On a stable +z ring frame, mirrored by name. */
export function arm(name, { root, angle, len, r0, bend = 0.25, drop = 1, curl = 1.4, curlAt = 0.22, rise = 0.6, pitch = 0, n = 14, group = 'Sock' }) {
  // walked out step by step along a heading that turns by `bend` over the run and by `curl` (faster and faster) over
  // the last `curlAt`, so the tip rolls into a tight spiral instead of swinging the whole arm round
  const st = [], ds = len / n; let x = root[0] + 0.02 * Math.sin(angle), y = root[1] + 0.02 * Math.cos(angle);
  for (let i = 0; i <= n; i++) {
    const t = i / n, c = Math.max(0, (t - (1 - curlAt)) / curlAt), r = r0 * (1 - 0.86 * t ** 0.9), d = 0.02 + t * len;
    // on the ground the arm rests at its own radius (a rising hair so no ring lies dead level); a swimmer's keeps its
    // root height, pitched; the curling tip lifts off the ground
    const zg = r * 0.85 + 0.003 * i, z = v2(root[2], zg, drop * (1 - (1 - Math.min(1, t * 2.2)) ** 3)) + pitch * d + rise * r0 * c * c * 3;
    st.push({ at: [r3(x), r3(y), r3(z)], r: [r3(r), r3(r * 0.85)] });
    const th = angle + bend * t + curl * c * c * 2.2;
    x += ds * (1 - 0.55 * c) * Math.sin(th); y += ds * (1 - 0.55 * c) * Math.cos(th);
  }
  const a = st[0].at, b = st[n].at, p = st[n - 1].at;
  return { name, kind: 'loft', slots: 'ring12', group, mirror: 'name', up: true, stations: st,
    caps: { back: [a[0] - 0.006 * Math.sin(angle), a[1] - 0.006 * Math.cos(angle), a[2] + 0.003], tip: b.map((x, k) => r3(x + (x - p[k]) * 0.4)) } };
}
/** A BUNDLE of arms reaching FORWARD (a squid's, a cuttlefish's): `k` arms per side round the axis at `axis` (y0, z0),
 * each from a ring of `spread` at its root to near the axis at `reach` ahead; `club` thickens a tentacle's end. */
export function forwardArm(name, { y0, z0, spread, phi, reach, r0, tipR = 0.003, club = 0, droop = 0, n = 8, group = 'Sock' }) {
  const st = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = spread * (1 - 0.8 * t), clubBump = club ? club * Math.max(0, 1 - Math.abs(t - 0.85) / 0.12) : 0;
    st.push({ at: [r3(s * Math.cos(phi)), r3(y0 + reach * t), r3(z0 + s * Math.sin(phi) - droop * t * t + 0.001 * i)], r: [r3(v2(r0, tipR, t) + clubBump), r3((v2(r0, tipR, t) + clubBump) * 0.85)] });
  }
  const a = st[0].at, b = st[n].at;
  return { name, kind: 'loft', slots: 'ring12', group, mirror: 'name', up: true, stations: st, caps: { back: [a[0], a[1] - 0.008, a[2]], tip: [b[0], b[1] + 0.008, b[2]] } };
}
// the octopus's crown: four arms a side fanned from just ahead of the head's underside, spread over the ground
const octoArms = ({ root = [0.025, 0.035, 0.07], len = 0.62, r0 = 0.026 } = {}) => [
  // each arm's heading stays on its own side of sideways while it bends and curls (a ring frame flips there)
  arm('arm1R', { root, angle: 0.3, len: len * 0.95, r0, bend: 0.35, curl: -0.8 }),
  arm('arm2R', { root, angle: 0.95, len, r0, bend: 0.2, curl: -0.9 }),
  arm('arm3R', { root: [root[0], root[1] - 0.02, root[2]], angle: 1.75, len, r0, bend: 0.25, curl: 0.9 }),
  arm('arm4R', { root: [root[0] * 0.7, root[1] - 0.04, root[2]], angle: 2.55, len: len * 0.9, r0, bend: -0.3, curl: 0.8 }),
];

export const family = {
  family: 'cephalopod',
  colors: {
    coat: '#a65a3e', sock: '#b86c4e', ash: '#c98a6c', ashAlt: '#bb7c60', brow: '#7e3f2a', iris: '#d8b04a',
    ink: '#0c0a08', sclera: '#e0c27a', nose: '#7e3f2a', teeth: '#2a2420', mouth: '#5a2a24', tip: '#c98a6c',
    hoof: '#7e3f2a', belly: '#d9a084', snout: '#a65a3e',
  },
  // the mantle rises back and up from the head (a resting octopus), its rounded end high behind
  joints: { neckBase: [0, -0.06, 0.135], neckTop: [0, 0.0, 0.11] },
  torsoUp: true,
  torso: [
    { at: [0, -0.32, 0.27], r: [0.045, 0.045] },
    { at: [0, -0.27, 0.25], r: [0.095, 0.1] },
    { at: [0, -0.19, 0.21], r: [0.115, 0.115] },
    { at: [0, -0.11, 0.17], r: [0.1, 0.095] },
    { at: [0, -0.05, 0.14], r: [0.075, 0.07] },
  ],
  torsoCaps: { back: [0, -0.35, 0.28], tip: [0, -0.02, 0.13] },
  neckRA: [0.07, 0.065], neckRB: [0.065, 0.06], neckRMid: [0.06, 0.055],
  tail: null, tip: null,
  legs: [], levelLegs: false,
  craniumRows: BALL(0.07, 0.85), craniumCaps: { back: [0, -0.072, 0.0], tip: [0, 0.074, -0.004] }, muzzleFrom: 5,
  jawRows: BEAK(0.07), jawCaps: { back: [0, -0.034, -0.03], tip: [0, 0.046, -0.022] },
  craniumBandGroups: {},
  muzzleW: 1.0, muzzleLen: 1.0,
  skinControls: {},
  headScale: 1.0, nape: [0, -0.06, 0.0],
  // the eyes bulge high on the sides of the head, a horizontal bar pupil
  eyeAt: [2.4, 1.7], eyeR: 0.016, pupil: 'slit', irisAngle: 60, orbitFallback: true,
  orbit: { reach: [0.004, 0.005, 0.006], bulk: [0.002, 0.003], thickness: 0.003 },
  browStrip: [[2.0, 1.5], [2.2, 1.45], [2.5, 1.45], [2.8, 1.5], [3.0, 1.6]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [4.0, 1.0], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headTiles: [], bodyTiles: [],
  extraSegments: [
    ...octoArms(),
    // the funnel (siphon): a short tube under the side of the head
    { name: 'siphon', kind: 'segment', from: 'siphonA', to: 'siphonB', rA: [0.018, 0.016], rB: [0.012, 0.011], slots: 'ring12', group: 'Coat', mirror: 'plane', over: [0.3, 0.3] },
  ],
  markDensity: { torso: 2 },
  markings: [{ on: 'torso', kind: 'spots', count: 14, size: [0.08, 0.12], seed: 4, group: 'Spot', color: '#8a4630' }],
  scale: 1,
};
family.joints.siphonA = [0, -0.05, 0.09];
family.joints.siphonB = [0, -0.01, 0.065];

const SWIM_Z = 0.5;
// a swimmer's fin pair: two flat blades thin along +z off the mantle's rear, mirrored by name
const finPair = (A, B, wA, wB, group = 'Tip') => ({ joints: { finA: A, finB: B },
  segs: [{ name: 'finR', kind: 'segment', from: 'finA', to: 'finB', rA: [wA, 0.006], rB: [wB, 0.004], slots: 'ring12', over: [0.2, 0.2], group, mirror: 'name', up: [0, 0, 1] }] });
// eight arms a side-pair at a time round the axis (phi from the side, mirrored), plus two clubbed tentacles below
const squidArms = ({ y0, z0, spread, reach, r0, tentacle = 0, club = 0.008, droop = 0 }) => [
  ...[0.35, 1.0, -0.35, -1.0].map((phi, k) => forwardArm(`arm${k + 1}R`, { y0, z0, spread, phi, reach: reach * (1 - 0.06 * k), r0, droop })),
  ...(tentacle ? [forwardArm('tentacleR', { y0, z0: z0 - spread * 0.4, spread: spread * 0.5, phi: -0.6, reach: tentacle, r0: r0 * 0.55, tipR: 0.002, club, droop: droop * 1.5, n: 12 })] : []),
];

export const species = {
  // COMMON OCTOPUS (Octopus vulgaris). Thesis: NO bones, no shell · a soft bulbous MANTLE rising behind a smaller
  // head with two big bulging eyes (bar pupils) · ONE signature: the EIGHT long tapering ARMS spread over the seabed,
  // their tips curling · a funnel under the head · mottled red-brown · mantle ~0.25 m, arms ~0.75 m, ~1.3 m across the
  // arms (FAO species catalogue, Jereb et al. 2016: mantle to 0.25 m, total length to 1.3 m).
  octopus: { family: 'cephalopod', name: 'a common octopus', scale: 1 },
  // EUROPEAN SQUID (Loligo vulgaris). Thesis: a long TORPEDO mantle tapering to a point behind · a pair of rhombic FINS
  // at the rear of the mantle · a head with huge eyes · EIGHT short arms bundled forward and TWO long TENTACLES with
  // clubbed ends · translucent pinkish, flecked · swims level · mantle ~0.3 m, ~0.6 m with the tentacles (FAO species
  // catalogue, Jereb & Roper 2010: mantle commonly 0.15–0.3 m, to 0.42 m).
  squid: (() => { const Z = SWIM_Z, F = finPair([0.03, -0.25, Z], [0.11, -0.31, Z - 0.004], 0.07, 0.018); return {
    family: 'cephalopod', name: 'a European squid', pose: 'swim', scale: 0.8,
    colors: { coat: '#d39a8a', sock: '#dca596', tip: '#e2b2a4', ash: '#e6b8a8', ashAlt: '#dbab9b', brow: '#a46a5a', belly: '#ecd0c4', sclera: '#2a3440', iris: '#3a4c5c' },
    joints: { neckBase: [0, 0.0, Z], neckTop: [0, 0.03, Z], siphonA: [0, 0.0, Z - 0.035], siphonB: [0, 0.035, Z - 0.045], ...F.joints },
    torsoUp: false,
    torso: [
      { at: [0, -0.38, Z], r: [0.008, 0.008] }, { at: [0, -0.3, Z], r: [0.025, 0.026] }, { at: [0, -0.18, Z], r: [0.042, 0.044] },
      { at: [0, -0.07, Z], r: [0.05, 0.051] }, { at: [0, 0.0, Z], r: [0.046, 0.046] },
    ],
    torsoCaps: { back: [0, -0.4, Z], tip: [0, 0.015, Z] },
    neckRA: [0.04, 0.04], neckRB: [0.038, 0.038], neckRMid: [0.035, 0.035],
    craniumRows: BALL(0.05, 0.9), craniumCaps: { back: [0, -0.052, 0.0], tip: [0, 0.053, -0.003] },
    jawRows: BEAK(0.05), jawCaps: { back: [0, -0.024, -0.021], tip: [0, 0.033, -0.016] },
    eyeAt: [2.4, 2.4], eyeR: 0.018,
    extraSegments: [...squidArms({ y0: 0.07, z0: Z, spread: 0.04, reach: 0.17, r0: 0.011, tentacle: 0.3 }),
      { name: 'siphon', kind: 'segment', from: 'siphonA', to: 'siphonB', rA: [0.012, 0.011], rB: [0.008, 0.008], slots: 'ring12', group: 'Coat', mirror: 'plane', over: [0.3, 0.3] }, ...F.segs],
    markDensity: { torso: 3 },
    markings: [{ on: 'torso', kind: 'spots', count: 30, size: [0.03, 0.05], seed: 7, group: 'Spot', color: '#a8604c' }],
  }; })(),
  // COMMON CUTTLEFISH (Sepia officinalis). Thesis: a broad FLATTENED oval mantle edged all round by a thin rippling FIN
  // skirt · a big head with W-shaped pupils · EIGHT short thick arms held together in a cone forward · THE ZEBRA
  // bands across a mottled brown back, a pale belly · hovers level · mantle ~0.25 m (FAO species catalogue, Jereb &
  // Roper 2005: mantle commonly 0.15–0.25 m, to 0.49 m).
  cuttlefish: (() => { const Z = SWIM_Z; return {
    family: 'cephalopod', name: 'a common cuttlefish', pose: 'swim', scale: 1,
    colors: { coat: '#8a6a4e', sock: '#9a7a5c', tip: '#d8c4a8', ash: '#b89a7a', ashAlt: '#aa8c6e', brow: '#5a4230', belly: '#e2d6c4', sclera: '#cfc38a', iris: '#2a2418' },
    joints: { neckBase: [0, -0.01, Z], neckTop: [0, 0.03, Z], siphonA: [0, 0.0, Z - 0.03], siphonB: [0, 0.03, Z - 0.04] },
    torsoUp: false,
    torso: [
      { at: [0, -0.25, Z], r: [0.025, 0.014] }, { at: [0, -0.21, Z], r: [0.06, 0.03] }, { at: [0, -0.13, Z], r: [0.078, 0.038] },
      { at: [0, -0.05, Z], r: [0.075, 0.037] }, { at: [0, 0.0, Z], r: [0.058, 0.032] },
    ],
    torsoCaps: { back: [0, -0.265, Z], tip: [0, 0.015, Z] },
    neckRA: [0.05, 0.03], neckRB: [0.048, 0.032], neckRMid: [0.045, 0.03],
    craniumRows: BALL(0.055, 0.75), craniumCaps: { back: [0, -0.057, 0.0], tip: [0, 0.058, -0.003] },
    jawRows: BEAK(0.055), jawCaps: { back: [0, -0.027, -0.023], tip: [0, 0.036, -0.017] },
    eyeAt: [2.4, 2.2], eyeR: 0.016,
    extraSegments: [...squidArms({ y0: 0.075, z0: Z, spread: 0.026, reach: 0.09, r0: 0.012 }),
      { name: 'siphon', kind: 'segment', from: 'siphonA', to: 'siphonB', rA: [0.01, 0.009], rB: [0.007, 0.007], slots: 'ring12', group: 'Coat', mirror: 'plane', over: [0.3, 0.3] },
      // the FIN skirt: a thin flat strip down each side of the mantle
      { name: 'skirtR', kind: 'loft', slots: 'ring12', group: 'Tip', mirror: 'name', up: [0, 0, 1],
        stations: [[-0.235, 0.03, 0.006], [-0.2, 0.06, 0.016], [-0.13, 0.077, 0.02], [-0.05, 0.074, 0.019], [-0.005, 0.057, 0.008]].map(([y, x, w], i) => ({ at: [x, y, Z - 0.004 + 0.0008 * i], r: [w, 0.003] })),
        caps: { back: [0.02, -0.245, Z - 0.004], tip: [0.05, 0.004, Z] } },
    ],
    markDensity: { torso: 3 },
    // the zebra bands across the back, a pale belly
    markings: [
      { on: 'torso', kind: 'belly', group: 'Belly', from: 0.62 },
      ...[0.15, 0.3, 0.45, 0.6, 0.75].map((a) => ({ on: 'torso', kind: 'band', run: [a, a + 0.05], t: [0, 0.4], group: 'Zebra', color: '#3a2a1e' })),
    ],
  }; })(),
  // CHAMBERED NAUTILUS (Nautilus pompilius). Thesis: a smooth coiled SHELL, round in profile and flat-sided, cream with
  // rust-brown STRIPES radiating from the coil · the soft body only at the shell's mouth: a leathery HOOD over the head,
  // a simple pinhole eye, a cluster of many short thin TENTACLES reaching forward · hovers · shell ~0.2 m across
  // (Saunders & Landman 2010, Nautilus: The Biology and Paleobiology of a Living Fossil: shell to ~0.25 m).
  nautilus: (() => { const Z = SWIM_Z, R = 0.1, C = [-0.06, Z + 0.03]; return {
    family: 'cephalopod', name: 'a chambered nautilus', pose: 'swim', scale: 1,
    colors: { coat: '#efe4cc', sock: '#c99a74', mane: '#a8785a', ash: '#c9a07a', ashAlt: '#bb926c', brow: '#8a5a3a', belly: '#efe4cc', sclera: '#2a221a', iris: '#2a221a', snout: '#a8785a' },
    neckGroup: 'Sock', joints: { neckBase: [0, -0.01, Z - 0.035], neckTop: [0, 0.015, Z - 0.045], siphonA: [0, 0.03, Z - 0.06], siphonB: [0, 0.06, Z - 0.07] },
    torsoUp: false,
    // the shell, round in profile (a lens along y, its depth the circle's chord), flat-sided across
    torso: [-0.98, -0.85, -0.6, -0.3, 0, 0.3, 0.6, 0.85, 0.98].map((u) => ({ at: [0, r3(C[0] + u * R), C[1]], r: [r3(0.04 * Math.sqrt(1 - u * u) + 0.008), r3(R * Math.sqrt(1 - u * u))] })),
    torsoCaps: { back: [0, C[0] - R * 1.01, C[1]], tip: [0, C[0] + R * 1.01, C[1]] },
    neckRA: [0.04, 0.035], neckRB: [0.04, 0.035], neckRMid: [0.04, 0.035],
    craniumRows: BALL(0.04, 0.9), craniumCaps: { back: [0, -0.042, 0.0], tip: [0, 0.043, -0.002] },
    jawRows: BEAK(0.04), jawCaps: { back: [0, -0.02, -0.017], tip: [0, 0.026, -0.012] },
    eyeAt: [2.6, 2.6], eyeR: 0.006, pupil: 'round',
    headPalette: { Skull: '#a8785a', Cheek: '#b88a6a', Jowl: '#b88a6a', Jaw: '#b88a6a' },
    extraSegments: [
      // the many short tentacles: three rings of fine ones reaching forward from under the hood
      ...[0.5, 1.2, -0.3, -1.0].map((phi, k) => forwardArm(`tentacle${k + 1}R`, { y0: 0.058, z0: Z - 0.045, spread: 0.022, phi, reach: 0.08 - 0.008 * k, r0: 0.004, tipR: 0.0015, droop: 0.01 })),
      ...[0.8, -0.65].map((phi, k) => forwardArm(`tentacle${k + 5}R`, { y0: 0.055, z0: Z - 0.04, spread: 0.03, phi, reach: 0.1, r0: 0.0045, tipR: 0.0015, droop: 0.02 })),
      // the hood: a leathery cap over the head, flush with the shell's mouth
      { name: 'hood', kind: 'segment', from: 'hoodA', to: 'hoodB', rA: [0.045, 0.02], rB: [0.035, 0.014], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.3, 0.3] },
    ],
    markDensity: { torso: 3 },
    // the stripes radiating from the coil: rust bands across the shell's back and sides, the front clean cream
    markings: [0.08, 0.2, 0.32, 0.44, 0.56].map((a, i) => ({ on: 'torso', kind: 'band', run: [a, a + 0.05], t: [0, 0.55 + 0.08 * (i % 2)], group: 'Stripe', color: '#a2532e' })),
  }; })(),
};
species.nautilus.joints.hoodA = [0, -0.005, 0.5 - 0.01];
species.nautilus.joints.hoodB = [0, 0.04, 0.5 - 0.018];

export const about = {
  octopus: { common: 'octopus', aliases: ['common octopus', 'octopi', 'octopuses'], sci: 'Octopus vulgaris', size: 'mantle ~0.25 m, ~1.3 m across the arms', source: 'FAO species catalogue (Jereb et al. 2016)' },
  squid: { common: 'squid', aliases: ['european squid', 'calamari'], sci: 'Loligo vulgaris', size: 'mantle ~0.3 m, ~0.6 m with the tentacles', source: 'FAO species catalogue (Jereb & Roper 2010)' },
  cuttlefish: { common: 'cuttlefish', aliases: ['common cuttlefish', 'cuttle'], sci: 'Sepia officinalis', size: 'mantle ~0.25 m', source: 'FAO species catalogue (Jereb & Roper 2005)' },
  nautilus: { common: 'nautilus', aliases: ['chambered nautilus'], sci: 'Nautilus pompilius', size: 'shell ~0.2 m across', source: 'Saunders & Landman 2010, Nautilus' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in.
export const wanted = {
  giantSquid: { near: 'squid', aliases: ['giant squid', 'kraken'], note: 'the squid at ~12 m, the tentacles longer than the body' },
};
