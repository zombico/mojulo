// TELEOST — the bony fishes. The family's tables are an ATLANTIC SALMON: a fusiform, laterally compressed body held
// level and SUSPENDED in water (pose 'swim': no legs, nothing on the ground; fauna-fit --pose swim), a conical head
// with the eyes on the sides and a terminal mouth, and every fin a THIN FLAT CLOSED part attached into the body:
// a dorsal fin, a small adipose fin, an anal fin (midline lofts on a stable +z ring frame, thin across x), a FORKED
// caudal fin (two midline lobes raking up and down off the peduncle) and paired pectoral and pelvic fins (flat
// segments, thin vertically). Tables are authored in metres at salmon size, body centre at z = 0.5.
// Builder features used: legs: [], ears: false, nose: false, tail: null, extra loft / segment `up`, markings.
// Worked species: salmon, clownfish, goldfish, angelfish, tuna, pufferfish.

import { fish, fishMaker, midFin, lobe, pairFin } from '../makers/fish.js';

// the generator (and its fin helpers) live in makers/fish.js; re-exported for existing callers
export { fishMaker, midFin, lobe, pairFin };

// ── the species, each one call to the maker (salmon also seeds the family tables) ──
// ATLANTIC SALMON (Salmo salar). Thesis: a FUSIFORM, laterally compressed torpedo, deepest a third back, a slim
// caudal peduncle · conical head, terminal mouth, eyes on the sides · a FORKED caudal fin, one dorsal fin mid-back
// plus the small ADIPOSE fin before the tail (the salmonid tell), anal fin below, low pectorals and mid-belly pelvics
// · silver flanks, dark blue-grey back, white belly · ~0.75 m total length (Wikipedia: adults typically 71–76 cm).
const SALMON = fishMaker({
  name: 'an Atlantic salmon', Z: 0.5,
  body: [[-0.30, 0.011, 0.022], [-0.24, 0.017, 0.032], [-0.14, 0.034, 0.057], [-0.02, 0.047, 0.077], [0.10, 0.05, 0.078], [0.19, 0.036, 0.056]],
  head: { scale: 0.42, len: 0.14, taper: [1.6, 0.65], snout: -0.05, eye: { at: 0.33, h: 0.5, r: 0.2 }, mouth: 'upturned' },
  caudal: { kind: 'forked', from: -0.29, len: 0.13, spread: 0.08, w: 0.034 },
  dorsal: [[0.045, 0.01], [0.03, 0.07], [0.0, 0.06], [-0.03, 0.035], [-0.055, 0.012]],
  adipose: [[-0.165, 0.006], [-0.18, 0.03], [-0.2, 0.01]],
  anal: [[-0.12, 0.008], [-0.135, 0.05], [-0.16, 0.035], [-0.19, 0.01]],
  pectoral: { y: 0.13, len: 0.09, w: [0.014, 0.026] }, pelvic: { y: -0.04, len: 0.065, w: [0.01, 0.016] },
  markings: [
    { on: ['torso', 'neck'], kind: 'band', group: 'Back', t: [0, 0.3], color: '#3f5563' },
    { on: ['torso', 'neck'], kind: 'belly', group: 'Belly', from: 0.72 },
  ],
  headPalette: { Skull: '#3f5563', Snout: '#3f5563', Brow: '#3f5563', Lids: '#b9c3c8', Jowl: '#eef1f2', Jaw: '#eef1f2' },
});

export const family = {
  ...SALMON, family: 'teleost', pose: 'swim', name: undefined, markings: undefined, headPalette: undefined,
  colors: {
    coat: '#b9c3c8', sock: '#b9c3c8', ash: '#d6dde0', ashAlt: '#c8d0d4', brow: '#4a5862', iris: '#c9b04a',
    ink: '#0d1114', sclera: '#1c2226', nose: '#4a5862', teeth: '#e4ddc8', mouth: '#9a7c7c', tip: '#4a5862',
    hoof: '#4a5862', belly: '#eef1f2',
  },
  tail: null, tip: null, legs: [], levelLegs: false,
  pupil: 'round', irisAngle: 40,
  noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: [], headTiles: [], bodyTiles: [],
};
for (const k of Object.keys(family)) if (family[k] === undefined) delete family[k];

// FINLETS: a row of small midline flags along the back (dir 1) or belly (−1) of a fishMaker body, each a short raked
// lobe rooted just inside the skin — `ys` their y (front → back), `h` their height (m, before scale)
const bodyAt = (B, y, k) => { if (y <= B[0][0]) return B[0][k]; for (let i = 1; i < B.length; i++) if (y <= B[i][0]) return B[i - 1][k] + (B[i][k] - B[i - 1][k]) * (y - B[i - 1][0]) / (B[i][0] - B[i - 1][0]); return B.at(-1)[k]; };
const finlets = (pre, B, Z, ys, h, dir) => ys.map((y, i) => { const z = Z + dir * bodyAt(B, y, 2) * 0.9;
  return lobe(`${pre}${i}`, [[y, z, h * 0.35], [y - h * 0.45, z + dir * h * 0.55, h * 0.3], [y - h * 0.9, z + dir * h, h * 0.1]], { t: 0.0025 }); });

// ATLANTIC BLUEFIN TUNA (Thunnus thynnus). Thesis: a deep, ROUND-sectioned TORPEDO (depth ~¼ of length, thickest a
// third back) tapering to a pencil-thin caudal peduncle · a tall, stiff, SICKLE (lunate) tail · a low spiny first
// dorsal, then a tall pointed second dorsal mirrored by the anal fin · a row of small yellow FINLETS above and below
// between those fins and the tail (the tuna tell) · a short pectoral, a conical head, terminal mouth, a big eye ·
// dark metallic blue-black back over silver-white flanks and belly · ~2.0 m total length (Wikipedia, "Atlantic
// bluefin tuna": adults commonly 2.0–2.5 m; FAO species catalogue, Collette & Nauen 1983: common to 200 cm).
const TUNA_BODY = [[-0.27, 0.007, 0.01], [-0.22, 0.02, 0.026], [-0.14, 0.05, 0.062], [-0.04, 0.072, 0.09], [0.06, 0.074, 0.092], [0.15, 0.064, 0.078], [0.2, 0.052, 0.062]];
const TUNA = fishMaker({
  name: 'an Atlantic bluefin tuna', Z: 0.5, scale: 3.0,
  body: TUNA_BODY,
  head: { scale: 0.45, len: 0.13, taper: [1.35, 0.72], snout: -0.08, eye: { at: 0.3, h: 0.42, r: 0.2 }, mouth: 'terminal', gill: 0.78 },
  caudal: { kind: 'lunate', from: -0.262, len: 0.115, spread: 0.14, w: 0.034 },
  dorsal: [[0.075, 0.008], [0.06, 0.045], [0.03, 0.03], [-0.01, 0.018], [-0.04, 0.008]],
  dorsal2: [[-0.05, 0.01], [-0.062, 0.08], [-0.09, 0.03], [-0.105, 0.008]],
  anal: [[-0.062, 0.01], [-0.08, 0.06], [-0.09, 0.068], [-0.11, 0.025], [-0.122, 0.01]],
  pectoral: { y: 0.12, len: 0.085, w: [0.014, 0.008], drop: 0.2 }, pelvic: { y: 0.1, len: 0.04, w: [0.009, 0.006] },
  markings: [
    { on: ['torso', 'neck'], kind: 'band', group: 'Back', t: [0, 0.42], color: '#1b2742' },
    { on: ['torso', 'neck'], kind: 'band', group: 'Flank', t: [0.42, 0.5], color: '#6d7c8c' },
    { on: ['torso', 'neck'], kind: 'belly', group: 'Belly', from: 0.7 },
    { on: [...Array(8).keys()].map((i) => `finletD${i}`).concat([...Array(7).keys()].map((i) => `finletV${i}`)), kind: 'band', group: 'Finlet', color: '#e2b628' },
  ],
  colors: { coat: '#b4bec6', sock: '#b4bec6', ash: '#c4ccd2', ashAlt: '#bac3c9', belly: '#eef0ee', tip: '#26304a', brow: '#1b2742', iris: '#c8b048', sclera: '#141414', gill: '#2c3550' },
  headPalette: { Skull: '#1b2742', Snout: '#1b2742', Brow: '#1b2742', Lids: '#9aa6b0', Jowl: '#e4e8ea', Jaw: '#e4e8ea' },
});
TUNA.extraSegments.push(
  ...finlets('finletD', TUNA_BODY, 0.5, [-0.13, -0.147, -0.164, -0.181, -0.198, -0.215, -0.232, -0.248], 0.016, 1),
  ...finlets('finletV', TUNA_BODY, 0.5, [-0.14, -0.158, -0.176, -0.194, -0.212, -0.23, -0.247], 0.015, -1));

// WHITE-SPOTTED PUFFER (Arothron hispidus), built INFLATED. Thesis: a near-SPHERICAL ball of a body (as wide and deep
// as it is long, blown up with water) with a short stub of a tail · a blunt face with a small BEAK-LIKE mouth (fused
// pale tooth plates) and big eyes high on the head · tiny fins: small rounded pectorals, a small dorsal and anal set
// far back by the tail, a short rounded caudal fan, NO pelvic fins · short PRICKLES standing out over the ball ·
// olive grey-brown back sprinkled with small WHITE SPOTS over a white belly · ~0.5 m total length (FishBase, Arothron
// hispidus: max 50 cm TL; Wikipedia, "White-spotted puffer": up to 50 cm).
const PUFF_BODY = [[-0.2, 0.03, 0.034], [-0.17, 0.08, 0.09], [-0.11, 0.14, 0.145], [-0.03, 0.165, 0.165], [0.05, 0.16, 0.158], [0.11, 0.135, 0.13], [0.15, 0.105, 0.1]];
const PUFFER = fishMaker({
  name: 'a white-spotted puffer (inflated)', Z: 0.5, scale: 0.98,
  body: PUFF_BODY,
  head: { scale: 0.62, len: 0.09, taper: [1.5, 0.7], kx: 0.95, snout: -0.12, eye: { at: 0.85, h: 0.5, r: 0.2 }, mouth: 'small', gill: false },
  caudal: { kind: 'rounded', from: -0.19, len: 0.09, spread: 0.06, w: 0.028 },
  dorsal: [[-0.15, 0.008], [-0.16, 0.05], [-0.185, 0.04], [-0.2, 0.01]],
  anal: [[-0.145, 0.01], [-0.158, 0.04], [-0.166, 0.045], [-0.185, 0.03], [-0.2, 0.01]],
  pectoral: { y: 0.12, len: 0.05, w: [0.018, 0.028], up: [0.4, 0, 1], drop: 0.2 }, pelvic: null,
  markDensity: { torso: 2 },
  markings: [
    { on: ['torso', 'neck'], kind: 'belly', group: 'Belly', from: 0.6 },
    { on: 'torso', kind: 'band', group: 'Spot', color: '#f2f0e6', run: [0, 0], t: [0, 0] },   // the spots' colour (the spots are bumps below)
  ],
  colors: { coat: '#6e6650', sock: '#6e6650', ash: '#7a7258', ashAlt: '#716a52', belly: '#f1efe6', tip: '#857c62', brow: '#6e6650', iris: '#d9c46a', sclera: '#141414', gill: '#3e3a2e' },
  headPalette: { Skull: '#6e6650', Snout: '#6e6650', Brow: '#6e6650', Lids: '#6e6650', Jowl: '#f1efe6', Jaw: '#f1efe6', Mouth: '#e8e2cc' },
});
// the prickles: short cones standing out of the ball, rows around the body (right side; mirrored by name), each rooted
// inside the skin
{ const Z = 0.5, rows = [[-0.1, [25, 65, 105, 145]], [-0.03, [10, 45, 80, 115, 150]], [0.04, [25, 65, 105, 145]], [0.1, [15, 50, 88, 130]]];
  let n = 0; for (const [y, angs] of rows) for (const a of angs) { const t = a * Math.PI / 180, w = bodyAt(PUFF_BODY, y, 1), h = bodyAt(PUFF_BODY, y, 2);
    const p = (k) => [w * k * Math.sin(t), y - (k - 0.9) * 0.08, Z + h * k * Math.cos(t)];
    PUFFER.joints[`prk${n}A`] = p(0.9); PUFFER.joints[`prk${n}B`] = p(1.13);
    PUFFER.extraSegments.push({ name: `prickle${n}R`, kind: 'segment', from: `prk${n}A`, to: `prk${n}B`, rA: [0.007, 0.007], rB: [0.0012, 0.0012], slots: 'ring12', over: [0.2, 0.2], group: 'Tip', mirror: 'name' }); n++; } }
// the WHITE SPOTS: small pale bumps just proud of the back and flanks (paint on the ball's coarse faces would be bars),
// on a staggered, deterministically jittered lattice
{ const Z = 0.5; let n = 0;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) { const y = -0.15 + i * 0.033 + (j % 2) * 0.016, a = (8 + j * 21 + ((i * 7 + j * 3) % 5) * 2) * Math.PI / 180;
    if (y > 0.15) continue; const w = bodyAt(PUFF_BODY, y, 1), h = bodyAt(PUFF_BODY, y, 2), p = (k) => [w * k * Math.sin(a) + 0.0001, y, Z + h * k * Math.cos(a)];
    PUFFER.joints[`spt${n}A`] = p(0.95); PUFFER.joints[`spt${n}B`] = p(1.012);
    PUFFER.extraSegments.push({ name: `spot${n}R`, kind: 'segment', from: `spt${n}A`, to: `spt${n}B`, rA: [0.0065, 0.0065], rB: [0.005, 0.005], slots: 'ring12', over: [0.1, 0.3], group: 'Spot', mirror: 'name' }); n++; } }

export const species = {
  salmon: SALMON,
  pufferfish: PUFFER,
  tuna: TUNA,
  // CLOWNFISH (Amphiprion ocellaris). Thesis: a short, DEEP oval body (depth ~⅓ of length), a thick peduncle · a
  // blunt rounded head, big eye · ROUNDED fins: a long dorsal (low spiny front, taller rounded soft rear), a rounded
  // fan caudal, rounded anal, big rounded pectorals · ORANGE with THREE WHITE BARS (behind the eye, mid-body, at the
  // tail base) · ~0.11 m total length (Wikipedia, Amphiprion ocellaris: up to 11 cm).
  clownfish: fishMaker({
    name: 'a clownfish', Z: 1, scale: 0.143,
    body: [[-0.27, 0.03, 0.05], [-0.2, 0.04, 0.075], [-0.1, 0.058, 0.115], [0.0, 0.065, 0.13], [0.1, 0.062, 0.122], [0.18, 0.05, 0.095]],
    head: { scale: 0.6, len: 0.16, taper: [2.4, 0.5], snout: -0.15, eye: { at: 0.36, h: 0.4, r: 0.3 }, mouth: 'small', rows: [-0.4, -0.22, -0.04, 0.06, 0.15, 0.3, 0.37, 0.52, 0.68, 0.82, 0.93] },
    caudal: { kind: 'rounded', from: -0.26, len: 0.12, spread: 0.08, w: 0.032 },
    dorsal: [[0.12, 0.01], [0.09, 0.05], [0.0, 0.045], [-0.06, 0.08], [-0.13, 0.085], [-0.19, 0.05], [-0.22, 0.01]],
    anal: [[-0.08, 0.01], [-0.11, 0.07], [-0.16, 0.075], [-0.21, 0.04], [-0.23, 0.008]],
    pectoral: { y: 0.11, len: 0.1, w: [0.02, 0.04], up: [0.4, 0, 1] }, pelvic: { y: 0.04, len: 0.08, w: [0.015, 0.025] },
    markDensity: { torso: 5 },
    // three white bars, each edged in black (the bars on the trunk; the head bar on the skull bands behind the eye),
    // and every fin's outer margin black
    markings: [
      { on: 'torso', kind: 'band', group: 'Band', run: [0.06, 0.16], color: '#f6f5ef' },
      { on: 'torso', kind: 'band', group: 'Band', run: [0.5, 0.68] },
      { on: ['neck'], kind: 'band', group: 'Band' }, { on: 'torso', kind: 'band', group: 'Band', run: [0.93, 1] },
      ...[[0.045, 0.06], [0.16, 0.175], [0.485, 0.5], [0.68, 0.695], [0.915, 0.93]].map((run) => ({ on: 'torso', kind: 'band', group: 'Edge', run, color: '#151313' })),
      { on: ['caudalUp', 'caudalMid', 'caudalDn'], kind: 'band', group: 'Edge', run: [0.72, 1] },
      { on: ['dorsal', 'anal'], kind: 'band', group: 'Edge', t: [0, 0.12] }, { on: ['dorsal', 'anal'], kind: 'band', group: 'Edge', t: [0.88, 1] },
      { on: ['pectoral', 'pelvic'], kind: 'band', group: 'Edge', run: [0.75, 1] },
    ],
    craniumBandGroups: Object.fromEntries([['st2-st3', 'Band'], ['st3-st4', 'Band'], ['st4-st5', 'Band'], ['st5-st6', 'Edge']].map(([b, g]) => [b, Array(6).fill(g)])),
    colors: { gill: '#b8560e', coat: '#e8701c', sock: '#e8701c', ash: '#e8701c', ashAlt: '#e07018', belly: '#ec7c28', tip: '#e06a18', brow: '#e8701c', iris: '#e8a020', sclera: '#141414' },
    headPalette: { Band: '#f6f5ef', Edge: '#151313', Jaw: '#e8701c', Jowl: '#e8701c' },
  }),
  // COMMON GOLDFISH (Carassius auratus). Thesis: a DEEP, short, humped carp body (depth ~40% of standard length), a
  // short blunt head with a small terminal mouth and no barbels · one tall dorsal fin, a LONG FLOWING, deeply forked
  // caudal (~⅓ of total length), paired pelvics and a small anal · solid orange-gold · ~0.20 m total (Wikipedia:
  // goldfish commonly 10–20 cm; FishBase common length 20 cm).
  goldfish: fishMaker({
    name: 'a goldfish', Z: 1, scale: 0.225,
    body: [[-0.25, 0.03, 0.045], [-0.18, 0.045, 0.075], [-0.08, 0.065, 0.115], [0.02, 0.07, 0.125], [0.1, 0.066, 0.12], [0.17, 0.052, 0.092]],
    head: { scale: 0.52, len: 0.14, taper: [2.2, 0.55], snout: -0.1, eye: { at: 0.4, h: 0.42, r: 0.26 }, mouth: 'small' },
    caudal: { kind: 'flowing', from: -0.24, len: 0.34, spread: 0.12, w: 0.06 },
    dorsal: [[0.06, 0.01], [0.04, 0.11], [-0.02, 0.09], [-0.1, 0.06], [-0.16, 0.02]],
    anal: [[-0.11, 0.01], [-0.13, 0.06], [-0.17, 0.04], [-0.2, 0.01]],
    pectoral: { y: 0.1, len: 0.1, w: [0.018, 0.035] }, pelvic: { y: -0.02, len: 0.1, w: [0.015, 0.03] },
    colors: { gill: '#c8680e', coat: '#f08a1c', sock: '#f08a1c', ash: '#f39a30', ashAlt: '#ee9228', belly: '#f6b050', tip: '#f2962c', brow: '#f08a1c', iris: '#d8a030', sclera: '#141414' },
    markings: [{ on: ['torso', 'neck'], kind: 'belly', group: 'Belly', from: 0.75 }],
    headPalette: { Jaw: '#f39a30', Jowl: '#f39a30' },
  }),
  // FRESHWATER ANGELFISH (Pterophyllum scalare). Thesis: a tall, very LATERALLY COMPRESSED round-to-triangular DISC
  // body · EXTREMELY tall, swept-back sail dorsal and anal fins trailing into points (the fish taller than long),
  // long thread-like pelvic fins below, a fan caudal with trailing tips · silver with BLACK VERTICAL BARS (one through
  // the eye) · ~0.15 m long, ~0.20 m tall (Wikipedia: up to 15 cm long and 20 cm tall).
  angelfish: fishMaker({
    name: 'an angelfish', Z: 1, scale: 0.25,
    body: [[-0.23, 0.02, 0.04], [-0.17, 0.03, 0.1], [-0.08, 0.04, 0.17], [0.0, 0.042, 0.19], [0.07, 0.04, 0.16], [0.14, 0.032, 0.09]],
    head: { scale: 0.4, len: 0.11, taper: [1.4, 0.7], snout: 0.0, eye: { at: 0.45, h: 0.35, r: 0.26 }, mouth: 'pointed', gill: 0.72 },
    caudal: { kind: 'lunate', from: -0.22, len: 0.16, spread: 0.11, w: 0.045 },
    sails: {
      dorsal: [[0.05, 0.16, 0.035], [-0.02, 0.27, 0.085], [-0.09, 0.38, 0.075], [-0.18, 0.47, 0.045], [-0.3, 0.53, 0.01]],
      anal: [[0.0, -0.16, 0.035], [-0.06, -0.27, 0.085], [-0.12, -0.38, 0.075], [-0.2, -0.47, 0.045], [-0.31, -0.53, 0.01]],
    },
    pectoral: { y: 0.06, len: 0.08, w: [0.012, 0.022], up: [0.4, 0, 1] },
    pelvic: { y: 0.05, len: 0.3, w: [0.008, 0.003], up: [1, 0, 0], drop: 1.6 },
    markDensity: { torso: 3 },
    markings: [
      { on: 'torso', kind: 'band', group: 'Bar', run: [0.08, 0.17], color: '#22211f' },
      { on: 'torso', kind: 'band', group: 'Bar', run: [0.42, 0.52] },
      { on: 'torso', kind: 'band', group: 'Bar', run: [0.8, 0.88] },
    ],
    craniumBandGroups: { 'st5-st6': ['Bar', 'Bar', 'Bar', 'Bar', 'Bar', 'Bar'] },   // the bar through the eye
    colors: { gill: '#8e928a', coat: '#c9ccc4', sock: '#c9ccc4', ash: '#d8dad2', ashAlt: '#cfd1c9', belly: '#dfe0d8', tip: '#b8bcb4', brow: '#c9ccc4', iris: '#c43a2a', sclera: '#141414' },
    headPalette: { Bar: '#22211f' },
  }),
  // GREEN MORAY EEL (Gymnothorax funebris) — written purely as a maker call. Thesis: a very ELONGATE, laterally
  // compressed, scaleless body (depth ~1/14 of length) · NO pectoral and NO pelvic fins · ONE CONTINUOUS low dorsal fin
  // from just behind the head to the tail, joined round a small rounded tail tip to a continuous anal fin · a blunt
  // head with a large terminal mouth, small eye high and forward, no visible gill cover (a small round gill opening) ·
  // uniform dark olive-green · ~1.8 m total length (Wikipedia / FishBase: commonly 1.8 m, up to 2.5 m).
  // kept v1; 1006 upgrade v4 (gaping jaw, blunter snout, low even fins, flatter body) vs v1 SPLIT (v4 80% order1, v1 70% order2) → tie, v1 kept
  morayEel: fish({
    skeleton: 'bony', name: 'a green moray eel', length: 1.8, Z: 0.5,
    body: [[-0.37, 0.008, 0.018], [-0.3, 0.014, 0.026], [-0.18, 0.019, 0.03], [-0.04, 0.022, 0.032], [0.08, 0.024, 0.032], [0.18, 0.024, 0.03], [0.24, 0.022, 0.027]],
    head: { scale: 0.34, len: 0.085, taper: [1.5, 0.6], snout: 0.0, eye: { at: 0.22, h: 0.65, r: 0.16 }, mouth: 'terminal', gill: false },
    caudal: { kind: 'rounded', from: -0.36, len: 0.035, spread: 0.02, w: 0.012 },
    dorsal: [[0.2, 0.004], [0.17, 0.016], [0.0, 0.02], [-0.18, 0.02], [-0.3, 0.017], [-0.36, 0.01]],
    anal: [[-0.02, 0.004], [-0.05, 0.013], [-0.2, 0.015], [-0.32, 0.013], [-0.36, 0.008]],
    pectoral: null, pelvic: null,
    pattern: { back: '#3f5a2c', belly: '#5f7a3a', from: 0.8 },
    colors: { iris: '#c8b030', sclera: '#141414', gill: '#3f5a2c' },
    headPalette: { Mouth: '#1c1a14' },
  }),
};


// What people call each species and what its build stands on: read by ../entries.js into the search cards, never
// into the plan (a species' bytes do not change with its facts). `common` is the everyday name, `aliases` the other
// words for THIS animal (lower case, unique across every roster), `size` the published figure the build is fit to.
export const about = {
  salmon: { common: 'salmon', aliases: ['atlantic salmon', 'fish'], sci: 'Salmo salar', size: '~0.75 m long', source: 'Wikipedia, "Atlantic salmon" (adults typically 71–76 cm)' },
  clownfish: { common: 'clownfish', aliases: ['clown fish', 'anemonefish'], sci: 'Amphiprion ocellaris', size: '~0.11 m long', source: 'Wikipedia, Amphiprion ocellaris' },
  goldfish: { common: 'goldfish', aliases: ['gold fish'], sci: 'Carassius auratus', size: '~0.20 m long', source: 'FishBase' },
  angelfish: { common: 'angelfish', aliases: ['angel fish'], sci: 'Pterophyllum scalare', size: '~0.15 m long, ~0.20 m tall', source: 'Wikipedia, Pterophyllum scalare' },
  morayEel: { common: 'moray eel', aliases: ['moray', 'eel'], sci: 'Gymnothorax funebris', size: '~1.8 m long', source: 'FishBase' },
  tuna: { common: 'tuna', aliases: ['bluefin tuna', 'atlantic bluefin tuna', 'bluefin'], sci: 'Thunnus thynnus', size: '~2.0 m long', source: 'FAO species catalogue (Collette & Nauen 1983): common to 200 cm' },
  pufferfish: { common: 'pufferfish', aliases: ['puffer', 'blowfish', 'white-spotted puffer', 'puffer fish'], sci: 'Arothron hispidus', size: '~0.5 m long (built inflated)', source: 'FishBase, Arothron hispidus (max 50 cm TL)' },
};

// Animals people ask for that this family would build but does not yet: `near` (a built species) stands in, and
// the search card says so. Building one moves its row into `species` + `about`.
export const wanted = {
};
