/**
 * horse-form — THE HORSE as a ring plan for the layered kind (`layered-plan-v1`, station-loft-plan.js expandPlan),
 * built by the creature-from-plan loop: a thesis, a form filled with numbers, the wire read at named views, every fix a
 * number. Core, so the statue maker's mount (statue/creature.js) and the plan door ship it; the worked example in
 * docs/examples/ring-plans/horse.plan.mjs re-exports it and writes horse.plan.json.
 *
 * THESIS  a barrel on four straight columns · a quadruped on single hooves (unguligrade) · a long deep wedge of a head
 *         carried down from the poll · the arched crested neck rising at about fifty degrees · 1.6 m at the withers.
 *
 * Frame: metres, +z up, +y the horse's front, x = 0 its mirror plane, the hooves on z = 0. Proportions after the
 * general record of a light riding horse (16 hands): the body as long from the point of the shoulder to the point of
 * the buttock as the withers are high; the belly half the withers' height; the forearm longer than the cannon; the
 * head about two-fifths of the withers' height; the hind leg angled at the stifle (forward) and the hock (back).
 *
 * Parts:
 *   barrel     a loft along the midline from the buttock to the breast: the croup's round, the back's dip, the deep
 *              girth behind the elbow, the withers' rise, its rings [across, deep]
 *   neck       a loft from the withers up and forward to the throatlatch, deep at its base and thinning to the poll
 *   crest      the mane as a carved mass: a thin loft riding the neck's top line (the crest the sculptors cut)
 *   head       a loft from the poll down to the muzzle: the broad jowl, the flat face, the muzzle
 *   earR / L   a short tapering segment each, up and a little forward from the poll
 *   tail       a chain from the dock hanging down the buttocks (a carved tail, not a flag)
 *   legs       upper arm, forearm, cannon, pastern, hoof forward; thigh, gaskin, cannon, pastern, hoof behind
 *
 * `horsePlan({ scale, palette })`: `scale` one uniform scale about the floor (1 = 1.6 m at the withers); `palette` the
 * groups' colours over HORSE_PALETTE. Pure and deterministic.
 */

/** the groups' colours (a bay: a brown coat, black points) */
export const HORSE_PALETTE = Object.freeze({ Body: '#7a4d2e', Neck: '#7a4d2e', Head: '#74482b', Mane: '#1f1712', Tail: '#1f1712', Legs: '#6e4528', Points: '#2a1d15', Hooves: '#2a2420', Ears: '#5a3a22' });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const r4 = (x) => Math.round(x * 1e4) / 1e4;

// ── the masses, as data: each station's centre [x, y, z] and ring [across, deep] ───────────────────────────────────
/** the barrel: centre = midway between the top line and the belly line, deep = half the gap, rear to front */
const BARREL = [
  { at: [0, -0.84, 1.27], r: [0.17, 0.21] },   // the point of the buttock
  { at: [0, -0.66, 1.29], r: [0.29, 0.29] },   // the quarters under the croup (top 1.58)
  { at: [0, -0.40, 1.25], r: [0.30, 0.30] },   // the flank (top 1.55)
  { at: [0, -0.10, 1.21], r: [0.31, 0.29] },   // the loin and back's dip (top 1.50, belly 0.92)
  { at: [0, 0.20, 1.20], r: [0.30, 0.32] },    // the girth behind the elbow (belly 0.88)
  { at: [0, 0.46, 1.25], r: [0.25, 0.35] },    // the withers over the chest (top 1.60)
  { at: [0, 0.70, 1.21], r: [0.20, 0.23] },    // the breast at the point of the shoulder
];
/** the neck: up and forward from the withers to the throatlatch */
const NECK = [
  { at: [0, 0.52, 1.36], r: [0.19, 0.30] },
  { at: [0, 0.74, 1.58], r: [0.14, 0.23] },
  { at: [0, 0.92, 1.80], r: [0.11, 0.17] },
  { at: [0, 1.04, 1.97], r: [0.095, 0.13] },
];
/** the head: from the poll down to the muzzle, the face's line about 48° below level */
const HEAD = [
  { at: [0, 1.08, 2.05], r: [0.10, 0.12] },    // the poll
  { at: [0, 1.16, 1.96], r: [0.115, 0.15] },   // the jowl and the broad forehead
  { at: [0, 1.29, 1.82], r: [0.085, 0.12] },
  { at: [0, 1.41, 1.69], r: [0.07, 0.10] },
  { at: [0, 1.50, 1.60], r: [0.07, 0.085] },   // the muzzle
];
/** the joints the limbs, ears and tail run between (the RIGHT side; x > 0) */
const JOINTS = {
  // the fore leg: the point of the shoulder → elbow → knee (carpus) → fetlock → coronet → toe
  shoulder: [0.15, 0.60, 1.08], elbow: [0.16, 0.46, 0.92], knee: [0.16, 0.50, 0.50], fetlock: [0.16, 0.50, 0.18], coronet: [0.16, 0.56, 0.08], toe: [0.16, 0.60, 0.03],
  // the hind leg: the hip → stifle (forward) → hock (back) → fetlock → coronet → toe
  hip: [0.17, -0.58, 1.22], stifle: [0.19, -0.42, 0.96], hock: [0.17, -0.66, 0.58], hFetlock: [0.16, -0.64, 0.18], hCoronet: [0.16, -0.59, 0.08], hToe: [0.16, -0.55, 0.03],
  earBase: [0.06, 1.10, 2.10], earTip: [0.075, 1.12, 2.27],
  // the tail, midline: the dock hanging close down the buttocks
  tail0: [0, -0.86, 1.46], tail1: [0, -0.97, 1.24], tail2: [0, -1.00, 0.92], tail3: [0, -0.98, 0.62],
};
/** each limb segment: from, to, rings, its group */
const LIMBS = [
  ['upperArmR', 'shoulder', 'elbow', [0.10, 0.13], [0.09, 0.11], 'Legs'],
  ['foreArmR', 'elbow', 'knee', [0.085, 0.10], [0.055, 0.065], 'Legs'],
  ['foreCannonR', 'knee', 'fetlock', [0.045, 0.055], [0.048, 0.058], 'Points'],
  ['forePasternR', 'fetlock', 'coronet', [0.046, 0.05], [0.055, 0.06], 'Points'],
  ['foreHoofR', 'coronet', 'toe', [0.06, 0.065], [0.075, 0.08], 'Hooves'],
  ['thighR', 'hip', 'stifle', [0.15, 0.25], [0.11, 0.14], 'Legs'],
  ['gaskinR', 'stifle', 'hock', [0.10, 0.14], [0.055, 0.08], 'Legs'],
  ['hindCannonR', 'hock', 'hFetlock', [0.045, 0.06], [0.048, 0.058], 'Points'],
  ['hindPasternR', 'hFetlock', 'hCoronet', [0.046, 0.05], [0.055, 0.06], 'Points'],
  ['hindHoofR', 'hCoronet', 'hToe', [0.06, 0.065], [0.075, 0.08], 'Hooves'],
  ['earR', 'earBase', 'earTip', [0.03, 0.022], 0.008, 'Ears'],
];

/** the upper limbs, whose top rides inside the barrel */
const UPPER = new Set(['upperArmR', 'thighR']);

/** the crest (the mane as a carved mass): a thin loft along the neck's top line, from the withers to the poll */
function crestStations(neck) {
  return neck.map((s, i) => {
    const next = neck[Math.min(i + 1, neck.length - 1)].at, prev = neck[Math.max(i - 1, 0)].at, d = sub(next, prev), L = len(d);
    // the ring's "deep" direction in the y–z plane, perpendicular to the neck's run and pointing up-back (the top line)
    const up = [0, -d[2] / L, d[1] / L], k = s.r[1] * 0.86;
    return { at: [0, r4(s.at[1] + up[1] * k), r4(s.at[2] + up[2] * k)], r: [r4(s.r[0] * 0.32), r4(0.05 + 0.02 * (1 - i / (neck.length - 1)))] };
  });
}

const scaled = (p, k) => p.map((v) => r4(v * k));
/** The horse ring plan. */
export function horsePlan({ scale = 1, palette = {} } = {}) {
  const k = scale, P = { ...HORSE_PALETTE, ...palette };
  // the lofts run near level along y (the barrel) or turn through it (the neck into the head): each keeps its rings' front
  const loft = (name, stations, group, slots = 'ring8') => ({ name, kind: 'loft', stations: stations.map((s) => ({ at: scaled(s.at, k), r: scaled(s.r, k) })), slots, e: 2.2, frame: 'keep', group, tint: P[group], mirror: 'plane' });
  return {
    schema: 'layered-plan-v1',
    frame: { up: '+z', front: '+y', note: '1 unit = 1 m; a light riding horse, 1.6 m at the withers, hooves on z = 0, facing +y' },
    joints: Object.fromEntries(Object.entries(JOINTS).map(([n, p]) => [n, scaled(p, k)])),
    segments: [
      loft('barrel', BARREL, 'Body', 'ring12'),
      loft('neck', NECK, 'Neck', 'ring10'),
      { ...loft('crest', crestStations(NECK), 'Mane'), e: 2.6 },
      loft('head', HEAD, 'Head'),
      { name: 'tail', kind: 'chain', joints: ['tail0', 'tail1', 'tail2', 'tail3'], r: scaled([0.06, 0.075, 0.08, 0.05], k), over: { first: 0.6, last: 0.5, inner: 0.6 }, group: 'Tail', tint: P.Tail, mirror: 'plane' },
      // the upper limbs start inside the body (a short overshoot above, so no plate stands out of the croup or chest)
      ...LIMBS.map(([name, from, to, rA, rB, group]) => ({ name, kind: 'segment', from, to, rA: Array.isArray(rA) ? scaled(rA, k) : r4(rA * k), rB: Array.isArray(rB) ? scaled(rB, k) : r4(rB * k), e: 2.1, over: [UPPER.has(name) ? 0.15 : 0.55, 0.45], group, tint: P[group], mirror: 'name' })),
    ],
    palette: P,
  };
}
