// TELEOST — the bony fishes. The family's tables are an ATLANTIC SALMON: a fusiform, laterally compressed body held
// level and SUSPENDED in water (pose 'swim': no legs, nothing on the ground; fauna-fit --pose swim), a conical head
// with the eyes on the sides and a terminal mouth, and every fin a THIN FLAT CLOSED part attached into the body:
// a dorsal fin, a small adipose fin, an anal fin (midline lofts on a stable +z ring frame, thin across x), a FORKED
// caudal fin (two midline lobes raking up and down off the peduncle) and paired pectoral and pelvic fins (flat
// segments, thin vertically). Tables are authored in metres at salmon size, body centre at z = 0.5.
// Builder features used: legs: [], ears: false, nose: false, tail: null, extra loft / segment `up`, markings.
// Worked species: salmon, clownfish, goldfish, angelfish.

const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
// the skull rows (the squamate's): reshaped per species by flat() + muzzleW / muzzleLen
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

const T = 0.004;   // a fin's half-thickness (m, before scale): thin and flat, but a closed solid
/** A MIDLINE FIN: a loft on a stable +z ring frame (thin across x), from rows [y, zBase, height] — each ring centred
 * half its height above (`dir` 1) or below (-1) zBase, with `bury` of it sunk into the body so it stays attached.
 * The fin's outline is the run of heights: tall at the leading edge, trailing off behind for a raked fin. */
export function midFin(name, rows, { dir = 1, bury = 0.012, t = T, group = 'Tip' } = {}) {
  const st = rows.map(([y, z, h]) => ({ at: [0, y, z + dir * (h / 2 - bury)], r: [t, h / 2 + bury] }));
  const a = st[0].at, b = st[st.length - 1].at;
  return { name, kind: 'loft', slots: 'ring12', group, mirror: 'plane', up: true, stations: st,
    caps: { back: [0, a[1] + 0.006, a[2]], tip: [0, b[1] - 0.006, b[2]] } };
}
/** A LOBE: a midline loft along any path [[y, z, halfWidth], …] (thin across x) — a caudal lobe, a sail fin. */
export function lobe(name, rows, { t = T, group = 'Tip' } = {}) {
  const st = rows.map(([y, z, w]) => ({ at: [0, y, z], r: [t, w] }));
  const dir = (i, j) => { const dy = st[i].at[1] - st[j].at[1], dz = st[i].at[2] - st[j].at[2], L = Math.hypot(dy, dz) || 1; return [0, dy / L, dz / L]; };
  const end = (i, j) => st[i].at.map((x, c) => x + dir(i, j)[c] * 0.006), n = st.length;
  return { name, kind: 'loft', slots: 'ring12', group, mirror: 'plane', up: true, stations: st, caps: { back: end(0, 1), tip: end(n - 1, n - 2) } };
}
/** A PAIRED FIN: a flat segment from a root joint to a tip joint, thin along `up` (default +z: lying flat). */
export const pairFin = (name, from, to, wA, wB, { t = T, up = [0, 0, 1], group = 'Tip' } = {}) =>
  ({ name, kind: 'segment', from, to, rA: [wA, t], rB: [wB, t * 0.7], slots: 'ring12', over: [0.2, 0.3], group, mirror: 'name', up });

/** THE FISH MAKER: one compact, species-free description → the species params the fauna builder takes (torso,
 * neck, joints, head shape, every fin as a thin flat closed part, colours, markings). Units: metres BEFORE `scale`
 * (author every fish at ~0.75 m, snout ≈ +0.33, tail tip ≈ −0.43; `scale` = published length ÷ that), +y the head,
 * the body centred at height `Z` (suspended: pose 'swim'). Fields:
 *   body      [[y, halfWidth, halfDepth], …] back (peduncle) → front; level, centred on Z. Fin bases follow it.
 *   head      { scale, kx, kz (skull width / depth factors), muzzleLen, muzzleW, eyeR, eyeAt }
 *   caudal    { kind: 'forked' | 'lunate' | 'rounded' | 'flowing', len, spread (tip height off the axis), w (lobe half
 *             width), from (y; default the first body row) }
 *   dorsal    [[y, height], …] front → back (a raked fin: tall in front); `dorsal2`, `adipose`, `anal` alike (anal hangs)
 *   sails     { dorsal: [[y, z, w], …], anal: … }: free lobes for fins that sweep far past the body (angelfish)
 *   pectoral  { y, len, w: [root, tip], up?, drop? }   pelvic { y, len, w, up?, drop? } — paired, flat
 *   colors, markings, headPalette, craniumBandGroups, markDensity, name, scale — passed through */
export function fishMaker(F) {
  const Z = F.Z ?? 0.5, B = F.body, H = F.head || {};
  const lerp = (y, k) => { if (y <= B[0][0]) return B[0][k]; for (let i = 1; i < B.length; i++) if (y <= B[i][0]) { const f = (y - B[i - 1][0]) / (B[i][0] - B[i - 1][0]); return B[i - 1][k] + (B[i][k] - B[i - 1][k]) * f; } return B[B.length - 1][k]; };
  const top = (y) => Z + lerp(y, 2) * 0.97, bot = (y) => Z - lerp(y, 2) * 0.97;
  const yB = B[0][0], yF = B[B.length - 1][0], [, wF, hF] = B[B.length - 1];
  const fin = (y, len, w, dropK, sideK, depthK) => [[sideK * lerp(y, 1), y, Z - depthK * lerp(y, 2)], [sideK * lerp(y, 1) + len * 0.45, y - len * 0.85, Z - depthK * lerp(y, 2) - len * dropK]];
  const pec = F.pectoral, pel = F.pelvic;
  const [pr, pt] = pec ? fin(pec.y, pec.len, pec.w, pec.drop ?? 0.35, 0.8, 0.45) : [];
  const [vr, vt] = pel ? fin(pel.y, pel.len, pel.w, pel.drop ?? 0.3, 0.55, 0.85) : [];
  const C = { kind: 'forked', len: 0.14, spread: 0.1, w: 0.03, ...(F.caudal || {}) }, c0 = C.from ?? yB + 0.01, L = C.len, S = C.spread, W = C.w;
  const lobes = (sg) => [[c0, Z + sg * 0.005, W * 0.6], [c0 - L * 0.3, Z + sg * S * 0.3, W], [c0 - L * 0.65, Z + sg * S * 0.68, W * 0.8], [c0 - L, Z + sg * S, W * 0.25]];
  const caudal = C.kind === 'rounded'
    ? [lobe('caudalUp', lobes(1).map(([y, z, w], i) => [y, Z + (z - Z) * 0.8, w * (i === 3 ? 2 : 1.2)])), lobe('caudalMid', [[c0, Z, W * 0.7], [c0 - L * 0.4, Z, W * 1.4], [c0 - L * 0.85, Z, W * 1.4], [c0 - L, Z, W * 0.6]]),
      lobe('caudalDn', lobes(-1).map(([y, z, w], i) => [y, Z + (z - Z) * 0.8, w * (i === 3 ? 2 : 1.2)]))]
    : C.kind === 'lunate' ? [lobe('caudalUp', lobes(1).map(([y, z, w], i) => [y + (i ? L * 0.3 * i / 3 : 0), z, w * 0.7])), lobe('caudalDn', lobes(-1).map(([y, z, w], i) => [y + (i ? L * 0.3 * i / 3 : 0), z, w * 0.7]))]
      : [lobe('caudalUp', lobes(1)), lobe('caudalDn', lobes(-1))];   // forked, flowing (a long forked tail: give it len / w)
  const mid = (name, rows, dir) => rows && midFin(name, rows.map(([y, h]) => [y, dir > 0 ? top(y) : bot(y), h]), { dir });
  const fins = [
    mid('dorsal', F.dorsal, 1), mid('dorsal2', F.dorsal2, 1), mid('adipose', F.adipose, 1), mid('anal', F.anal, -1),
    ...Object.entries(F.sails || {}).map(([n, rows]) => lobe(n, rows.map(([y, z, w]) => [y, Z + z, w]))),
    ...caudal,
    ...(pec ? [pairFin('pectoralR', 'pecRoot', 'pecTip', pec.w[0], pec.w[1], pec.up ? { up: pec.up } : {})] : []),
    ...(pel ? [pairFin('pelvicR', 'pelRoot', 'pelTip', pel.w[0], pel.w[1], pel.up ? { up: pel.up } : {})] : []),
  ].filter(Boolean);
  const kx = H.kx ?? 0.7, kz = H.kz ?? 1.25;
  return {
    family: 'teleost', pose: 'swim', ...(F.name ? { name: F.name } : {}), scale: F.scale ?? 1,
    joints: { neckBase: [0, yF - 0.05, Z], neckTop: [0, yF + 0.01, Z], ...(pec ? { pecRoot: pr, pecTip: pt } : {}), ...(pel ? { pelRoot: vr, pelTip: vt } : {}) },
    torso: B.map(([y, w, h]) => ({ at: [0, y, Z], r: [w, h] })),
    torsoCaps: { back: [0, yB - 0.015, Z], tip: [0, yF + 0.025, Z] },
    neckRA: [wF * 1.1, hF * 1.07], neckRB: [wF * 0.9, hF * 0.9], neckRMid: [wF, hF],
    craniumRows: flat(SKULL, kx, kz), jawRows: flatJaw(JAW, kx, kz),
    headScale: H.scale ?? 0.42, muzzleLen: H.muzzleLen ?? 1, muzzleW: H.muzzleW ?? 0.95, eyeR: H.eyeR ?? 0.011, ...(H.eyeAt ? { eyeAt: H.eyeAt } : {}),
    extraSegments: fins,
    ...Object.fromEntries(['colors', 'markings', 'headPalette', 'craniumBandGroups', 'markDensity'].filter((k) => F[k]).map((k) => [k, F[k]])),
  };
}

// ── the species, each one call to the maker (salmon also seeds the family tables) ──
// ATLANTIC SALMON (Salmo salar). Thesis: a FUSIFORM, laterally compressed torpedo, deepest a third back, a slim
// caudal peduncle · conical head, terminal mouth, eyes on the sides · a FORKED caudal fin, one dorsal fin mid-back
// plus the small ADIPOSE fin before the tail (the salmonid tell), anal fin below, low pectorals and mid-belly pelvics
// · silver flanks, dark blue-grey back, white belly · ~0.75 m total length (Wikipedia: adults typically 71–76 cm).
const SALMON = fishMaker({
  name: 'an Atlantic salmon', Z: 0.5,
  body: [[-0.30, 0.011, 0.022], [-0.24, 0.017, 0.032], [-0.14, 0.034, 0.057], [-0.02, 0.047, 0.077], [0.10, 0.05, 0.078], [0.19, 0.036, 0.056]],
  head: { scale: 0.42, kx: 0.7, kz: 1.25, muzzleLen: 1.0 },
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
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.012] },
  muzzleFrom: 3,
  jawCaps: { back: [0, -0.1, -0.05], tip: [0, 0.21, -0.03] },
  skinControls: {
    browRaise: { amp: 0.004, map: [['st2.brow', 0.8, [0, 0, 1]]] },
    cheekBunch: { amp: 0.004, map: [['st3.cheek', 1, [0.5, 0, 0.8]]] },
  },
  // the eye, orbit and brow authored at the salmon's head and scaled with each species' head (headRelative)
  headRelative: 0.42, nape: [0, -0.1, -0.02], orbitFallback: true,
  eyeAt: [2.4, 2.3], orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.0015 }, pupil: 'round', irisAngle: 40,
  browStrip: [[1.6, 1.8], [1.9, 1.7], [2.2, 1.7], [2.5, 1.8], [2.8, 1.9]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [4.6, 1.4], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  headOrnaments: [], headTiles: [], bodyTiles: [],
};
for (const k of Object.keys(family)) if (family[k] === undefined) delete family[k];

export const species = {
  salmon: SALMON,
  // CLOWNFISH (Amphiprion ocellaris). Thesis: a short, DEEP oval body (depth ~⅓ of length), a thick peduncle · a
  // blunt rounded head, big eye · ROUNDED fins: a long dorsal (low spiny front, taller rounded soft rear), a rounded
  // fan caudal, rounded anal, big rounded pectorals · ORANGE with THREE WHITE BARS (behind the eye, mid-body, at the
  // tail base) · ~0.11 m total length (Wikipedia, Amphiprion ocellaris: up to 11 cm).
  clownfish: fishMaker({
    name: 'a clownfish', Z: 1, scale: 0.143,
    body: [[-0.27, 0.03, 0.05], [-0.2, 0.04, 0.075], [-0.1, 0.058, 0.115], [0.0, 0.065, 0.13], [0.1, 0.062, 0.122], [0.18, 0.05, 0.095]],
    head: { scale: 0.6, kx: 0.75, kz: 1.6, muzzleLen: 0.4, muzzleW: 1.0, eyeR: 0.011 },
    caudal: { kind: 'rounded', from: -0.26, len: 0.11, spread: 0.08, w: 0.032 },
    dorsal: [[0.12, 0.01], [0.09, 0.05], [0.0, 0.045], [-0.06, 0.08], [-0.13, 0.085], [-0.19, 0.05], [-0.22, 0.01]],
    anal: [[-0.08, 0.01], [-0.11, 0.07], [-0.16, 0.075], [-0.21, 0.04], [-0.23, 0.008]],
    pectoral: { y: 0.11, len: 0.1, w: [0.02, 0.04], up: [0.4, 0, 1] }, pelvic: { y: 0.04, len: 0.08, w: [0.015, 0.025] },
    markDensity: { torso: 3 },
    markings: [
      { on: 'torso', kind: 'band', group: 'Band', run: [0.06, 0.16], color: '#f6f5ef' },
      { on: 'torso', kind: 'band', group: 'Band', run: [0.5, 0.68] },
      { on: ['neck'], kind: 'band', group: 'Band' }, { on: 'torso', kind: 'band', group: 'Band', run: [0.93, 1] },
    ],
    craniumBandGroups: { 'st0-st1': ['Band', 'Band', 'Band', 'Band', 'Band', 'Band'], 'st1-st2': ['Band', 'Band', 'Band', 'Band', 'Band', 'Band'] },
    colors: { coat: '#e8701c', sock: '#e8701c', ash: '#e8701c', ashAlt: '#e07018', belly: '#ec7c28', tip: '#e06a18', brow: '#e8701c', iris: '#e8a020', sclera: '#141414' },
    headPalette: { Band: '#f6f5ef', Jaw: '#e8701c', Jowl: '#e8701c' },
  }),
  // COMMON GOLDFISH (Carassius auratus). Thesis: a DEEP, short, humped carp body (depth ~40% of standard length), a
  // short blunt head with a small terminal mouth and no barbels · one tall dorsal fin, a LONG FLOWING, deeply forked
  // caudal (~⅓ of total length), paired pelvics and a small anal · solid orange-gold · ~0.20 m total (Wikipedia:
  // goldfish commonly 10–20 cm; FishBase common length 20 cm).
  goldfish: fishMaker({
    name: 'a goldfish', Z: 1, scale: 0.225,
    body: [[-0.25, 0.03, 0.045], [-0.18, 0.045, 0.075], [-0.08, 0.065, 0.115], [0.02, 0.07, 0.125], [0.1, 0.066, 0.12], [0.17, 0.052, 0.092]],
    head: { scale: 0.52, kx: 0.75, kz: 1.5, muzzleLen: 0.45, eyeR: 0.013 },
    caudal: { kind: 'flowing', from: -0.24, len: 0.34, spread: 0.12, w: 0.06 },
    dorsal: [[0.06, 0.01], [0.04, 0.11], [-0.02, 0.09], [-0.1, 0.06], [-0.16, 0.02]],
    anal: [[-0.11, 0.01], [-0.13, 0.06], [-0.17, 0.04], [-0.2, 0.01]],
    pectoral: { y: 0.1, len: 0.1, w: [0.018, 0.035] }, pelvic: { y: -0.02, len: 0.1, w: [0.015, 0.03] },
    colors: { coat: '#f08a1c', sock: '#f08a1c', ash: '#f39a30', ashAlt: '#ee9228', belly: '#f6b050', tip: '#f2962c', brow: '#f08a1c', iris: '#d8a030', sclera: '#141414' },
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
    head: { scale: 0.4, kx: 0.55, kz: 1.4, muzzleLen: 0.8, eyeR: 0.011 },
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
    craniumBandGroups: { 'st2-st3': ['Bar', 'Bar', 'Bar', 'Bar', 'Bar', 'Bar'] },
    colors: { coat: '#c9ccc4', sock: '#c9ccc4', ash: '#d8dad2', ashAlt: '#cfd1c9', belly: '#dfe0d8', tip: '#b8bcb4', brow: '#c9ccc4', iris: '#c43a2a', sclera: '#141414' },
    headPalette: { Bar: '#22211f' },
  }),
};
