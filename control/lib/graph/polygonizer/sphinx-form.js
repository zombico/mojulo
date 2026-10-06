/**
 * sphinx-form — THE SPHINX as a ring plan for the layered kind (`layered-plan-v1`, station-loft-plan.js expandPlan),
 * built by the creature-from-plan loop (a thesis, a form filled with numbers, the wire read at named views, every fix a
 * number), as the horse was (horse-form.js). Core, so the plan door and the statue maker ship it; the worked example
 * docs/examples/ring-plans/sphinx.plan.mjs re-exports it and writes sphinx.plan.json.
 *
 * THESIS  a lion lying on its belly (recumbent: the forelegs stretched far forward along the ground, the hind legs folded
 *         at its sides, the tail along the right flank) · a king's head in the nemes, the uraeus on the brow, no beard
 *         (the Great Sphinx's came later) · the small head of Giza's sphinx on a long low body · the face a person's.
 *
 * The proportions are the Great Sphinx's own (the record the Giza asset carries: 73 m long, 20 m to the top of the head,
 * the head 5.8 m from chin to crown, the forelegs 15 m), drawn in Giza metres (G) and scaled so the face is the
 * size of the head it wears. The head is the hero's landmark head (humanoid-head.js humanoidHead: a carved face with
 * eyes, brows, nostrils, lips and ears, no hair) worn as an `include`; the nemes is lofted round it from its measured
 * bounds: a cap over the crown, a wing flaring from each temple to the shoulders, a lappet falling on the chest each
 * side, a queue down the back of the neck, and the uraeus rising from the brow.
 *
 * Frame: metres, +z up, +y the sphinx's front (its face), x = 0 its mirror plane, its belly and paws on z = 0.
 * `sphinxPlan({ preset, scale, palette })`: `preset` the head's (a humanoidHead preset: 'male' by default), `scale` one
 * uniform scale over the whole (1 = a life-size face, the body about 3.7 m long), `palette` over SPHINX_PALETTE.
 * Pure and deterministic.
 */
import { humanoidHead } from './humanoid-head.js';

/** the groups' colours (painted limestone: an ochre body and face, the nemes in yellow striped blue; carved, the blue
 * stripes are grooves, `…Groove`, a shade darker than the stone: statue/creature.js) */
export const SPHINX_PALETTE = Object.freeze({ Lion: '#c9a26b', Nemes: '#d8b45a', NemesGroove: '#3b5d8f', Uraeus: '#c99a3a', Skin: '#b9784a' });

const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** the Great Sphinx's head, chin to crown under the nemes (G metres: 13.4 to 19.2): the unit the head scales the body by */
const FACE_G = 5.8;
/** a Giza point (x across, y from the paws' front backward, z up; G metres) → the plan's frame at `k` metres per G */
const at = (k) => ([x, y, z]) => [r4(x * k), r4((36 - y) * k), r4(z * k)];
const rr = (k) => (r) => (Array.isArray(r) ? r.map((v) => r4(v * k)) : r4(r * k));

// ── the lion, in Giza metres: each station's centre [x, y-from-the-paws, z] and ring [across, deep] ───────────────────
/** the body: from the rump forward to the breast under the head (its belly on the ground) */
const BODY = [
  { at: [0, 72.5, 4.6], r: [6.2, 4.6] },   // the rump
  { at: [0, 63, 5.4], r: [8.4, 5.4] },     // the haunch (top 10.8)
  { at: [0, 51, 5.3], r: [7.6, 5.3] },     // the back (top 10.6)
  { at: [0, 39, 5.5], r: [7.3, 5.5] },     // the middle (top 11)
  { at: [0, 28, 6.4], r: [8.0, 6.4] },     // the shoulders (top 12.8)
  { at: [0, 19.5, 6.3], r: [7.4, 6.3] },             // the chest
  { at: [0, 18.3, 6.2], r: [7.0, 6.2], e: 2.7 },      // the breast squaring off
  { at: [0, 17.5, 6.0], r: [6.6, 5.9], e: 2.9 },      // its front: broad and flat, as a man's chest, set back under the face
];
/** the body's caps: the rump's round, and the breast's flat front set back behind the face (15.4 G), the lappets before it */
const BODY_CAPS = { back: [0, 75.2, 4.6], tip: [0, 17.1, 6.0] };
/** the neck from the chest up under the head (hidden by the nemes; it carries the head's weight in the form) */
const NECK = [{ at: [0, 21, 10.5], r: [3.6, 3.2] }, { at: [0, 18.8, 13.6], r: [3.0, 2.8] }];
/** a foreleg (the RIGHT; mirrored): from the elbow under the shoulder, forward along the ground to the paw */
const FORELEG = [
  { at: [4.6, 25, 3.4], r: [2.3, 3.1] },
  { at: [4.6, 16, 2.6], r: [2.0, 2.4] },
  { at: [4.6, 7, 2.0], r: [1.8, 1.9] },
  { at: [4.6, 2.2, 1.3], r: [2.1, 1.3] },   // the paw, broad and flat
];
/** a hind leg (the RIGHT; mirrored): the folded thigh under the haunch, the paw tucked forward at the side */
const HINDLEG = [
  { at: [7.4, 62, 4.6], r: [2.0, 4.0] },
  { at: [8.0, 54, 2.0], r: [1.7, 1.9] },
  { at: [8.2, 48.5, 1.2], r: [1.6, 1.2] },
];
/** the tail, out of the rump and forward along the right flank on the ground */
const TAIL = [
  { at: [3.0, 72.5, 3.2], r: [1.0, 1.0] },
  { at: [6.6, 69, 1.4], r: [0.85, 0.8] },
  { at: [8.7, 62, 0.75], r: [0.65, 0.6] },
  { at: [9.1, 51, 0.6], r: [0.55, 0.5] },
  { at: [8.9, 41, 0.6], r: [0.45, 0.45] },
];

/** a head's bounds from its L1 points (the cranium and the jaw) → { lo, hi } */
function headBounds(parts) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const n of ['cranium', 'jaw']) { const p = parts[n]; if (!p) continue; for (const st of p.stations) for (const v of Object.values(st.points)) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], v[i]); hi[i] = Math.max(hi[i], v[i]); } }
  return { lo, hi };
}

/** The sphinx ring plan. */
export function sphinxPlan({ preset = 'male', scale = 1, palette = {} } = {}) {
  const P = { ...SPHINX_PALETTE, ...palette };
  const head = humanoidHead({ preset, hair: 'none', register: 'round', expression: 'neutral', scale });
  const { lo, hi } = headBounds(head.parts), h = hi[2] - lo[2], k = h / FACE_G, A = at(k), R = rr(k);
  // the face's place: its chin at 13.4 G, its front (the nose) at 15.4 G from the paws, on the midline
  const front = A([0, 15.4, 13.4]), shift = [r4(-(lo[0] + hi[0]) / 2), r4(front[1] - hi[1]), r4(front[2] - lo[2])];
  const hw = (hi[0] - lo[0]) / 2, top = hi[2] + shift[2], chin = lo[2] + shift[2], faceY = hi[1] + shift[1], backY = lo[1] + shift[1], midY = (faceY + backY) / 2;
  const loft = (name, stations, group, { slots = 'ring8', mirror = 'plane', e = 2.2 } = {}) => ({ name, kind: 'loft', stations: stations.map((s) => ({ at: s.at, r: s.r, ...(s.e ? { e: s.e } : {}) })), slots, e, frame: 'keep', group, tint: P[group], mirror });
  const G = (list) => list.map((s) => ({ at: A(s.at), r: R(s.r), ...(s.e ? { e: s.e } : {}) }));
  const m = (x) => r4(x);
  // THE NEMES, from the head's bounds (metres), as the headcloth is: not a cap set on the head but a WRAP. Its opening
  // is tilted, its top forward on the brow band across the forehead and its sides back behind the cheeks, so the face
  // looks out of it; it sweeps back over the crown and down to the queue, striped in grooves radiating from the brow;
  // behind the face it folds out each side like a cobra's hood, the wings flaring from the temples to past the
  // shoulders, striped across; the lappets fall in front of the shoulders, striped across.
  const N = 'Nemes', NG = 'NemesGroove';
  const hood = [
    { at: [0, m(faceY - 0.3 * h), m(chin + 0.52 * h)], r: [m(hw * 1.12), m(0.6 * h)] },
    { at: [0, m(faceY - 0.55 * h), m(chin + 0.62 * h)], r: [m(hw * 1.18), m(0.62 * h)] },
    { at: [0, m(backY + 0.05 * h), m(chin + 0.55 * h)], r: [m(hw * 1.1), m(0.58 * h)] },
    { at: [0, m(backY - 0.12 * h), m(chin + 0.25 * h)], r: [m(hw * 0.8), m(0.45 * h)] },
  ];
  // the opening's cap a hair in front of its ring (a shallow face, inside the head, so the face covers it)
  const o0 = hood[0].at, o1 = hood[1].at, od = Math.hypot(o1[1] - o0[1], o1[2] - o0[2]);
  const hoodCaps = { back: [0, m(o0[1] - (o1[1] - o0[1]) / od * 0.03 * h), m(o0[2] - (o1[2] - o0[2]) / od * 0.03 * h)], tip: [0, m(backY - 0.25 * h), m(chin + 0.1 * h)] };
  const radiate = Object.fromEntries([0, 1, 2].map((i) => [`st${i}-st${i + 1}`, [N, NG, N, NG, N, NG]]));   // ring12: six bands a side
  const WING_N = 9, wing = Array.from({ length: WING_N }, (_, i) => { const t = i / (WING_N - 1);
    return { at: [m(hw * (1.05 + 0.95 * t ** 1.3)), m(faceY - 0.42 * h - 0.1 * h * t), m(chin + 0.75 * h - 1.25 * h * t)], r: [m((0.1 + 0.28 * t) * h), m(0.05 * h)] }; });
  const across = (n, half) => Object.fromEntries(Array.from({ length: n - 1 }, (_, i) => [`st${i}-st${i + 1}`, Array(half).fill(i % 2 ? NG : N)]));
  const LAP_N = 7, lappet = Array.from({ length: LAP_N }, (_, i) => { const t = i / (LAP_N - 1);
    // straight down the flat front of the breast, just under the face
    return { at: [m(hw * (1.08 - 0.12 * t)), m(faceY - 0.1 * h + 0.12 * h * t), m(chin - 0.02 * h - 0.95 * h * t)], r: [m(0.13 * h), m(0.045 * h)] }; });
  const queue = [
    { at: [0, m(backY - 0.02 * h), m(top - 0.45 * h)], r: [m(0.18 * h), m(0.09 * h)] },
    { at: [0, m(backY - 0.08 * h), m(chin - 0.45 * h)], r: [m(0.14 * h), m(0.07 * h)] },
  ];
  const uraeus = [
    { at: [0, m(faceY - 0.12 * h), m(top - 0.3 * h)], r: [m(0.035 * h), m(0.03 * h)] },
    { at: [0, m(faceY - 0.05 * h), m(top - 0.18 * h)], r: [m(0.03 * h), m(0.025 * h)] },
    { at: [0, m(faceY - 0.06 * h), m(top - 0.05 * h)], r: [m(0.022 * h), m(0.02 * h)] },
  ];
  return {
    schema: 'layered-plan-v1',
    frame: { up: '+z', front: '+y', note: `1 unit = 1 m; a recumbent sphinx after the Great Sphinx's proportions, its face life-size × ${scale}, facing +y` },
    joints: {},
    segments: [
      { ...loft('body', G(BODY), 'Lion', { slots: 'ring12' }), caps: { back: A(BODY_CAPS.back), tip: A(BODY_CAPS.tip) } },
      loft('neck', G(NECK), 'Lion'),
      loft('forelegR', G(FORELEG), 'Lion', { mirror: 'name' }),
      loft('hindlegR', G(HINDLEG), 'Lion', { mirror: 'name' }),
      loft('tail', G(TAIL), 'Lion', { mirror: null, slots: 'ring6' }),
      { ...loft('nemesHood', hood, 'Nemes', { slots: 'ring12', e: 2.6 }), caps: hoodCaps, bandGroups: radiate },
      { ...loft('nemesR', wing, 'Nemes', { mirror: 'name', e: 2.8 }), bandGroups: across(WING_N, 4) },
      { ...loft('lappetR', lappet, 'Nemes', { mirror: 'name', e: 2.8 }), bandGroups: across(LAP_N, 4) },
      loft('queue', queue, 'Nemes'),
      loft('uraeus', uraeus, 'Uraeus', { slots: 'ring6' }),
    ],
    include: [{ name: 'king', parts: head.parts, palette: head.palette, shift }],
    palette: { ...head.palette, ...P },
  };
}

// ── THE CRIOSPHINX: Amun's ram-headed sphinx of Karnak's avenue ────────────────────────────────────────────────────
// THESIS  a lion lying on its belly, chunkier than Giza's and its head larger · a RAM's head (a domed skull, the long
//         nose sloping down to a rounded muzzle, the horns coiled down round the ears, the ears drooping out) · the
//         headcloth falling over the shoulders, its lappets on the chest · a small close-wrapped king standing between
//         the paws, under the chin · about 5 m long, 2.7 m to the crown, as the avenue's stand-ins record.
// Drawn in metres off the paws' front (`ya`, backward) and mirrored by name; the frame as the sphinx's.

/** the groups' colours (sandstone, a darker horn, the headcloth's blue lappets) */
export const CRIOSPHINX_PALETTE = Object.freeze({ Lion: '#c7a77a', Horn: '#a98d66', Nemes: '#c2a273', NemesGroove: '#46679a', King: '#b89a6e' });
/** an avenue sphinx's length, the paws' front to the rump (m): `ya` runs from 0 there */
const CRIO_L = 5.0;
const CRIO = {
  body: [[0, 4.95, 0.62, 0.55, 0.55], [0, 4.1, 0.7, 0.74, 0.7], [0, 3.0, 0.62, 0.6, 0.62], [0, 2.0, 0.66, 0.62, 0.66], [0, 1.45, 0.78, 0.68, 0.78], [0, 0.9, 0.75, 0.55, 0.72], [0, 0.55, 0.6, 0.38, 0.5]],
  fall: [[0, 1.3, 1.25, 0.62, 0.5], [0, 1.05, 1.72, 0.56, 0.46], [0, 0.9, 2.02, 0.38, 0.34]],   // the headcloth over the shoulders
  head: [[0, 1.28, 2.36, 0.29, 0.31], [0, 0.98, 2.42, 0.31, 0.3], [0, 0.58, 2.22, 0.2, 0.25], [0, 0.24, 1.96, 0.15, 0.17], [0, 0.08, 1.8, 0.12, 0.12]],
  horn: [[0.17, 1.02, 2.62, 0.12, 0.12], [0.35, 1.24, 2.5, 0.115, 0.115], [0.44, 1.2, 2.16, 0.1, 0.1], [0.42, 0.86, 1.98, 0.085, 0.085], [0.39, 0.7, 2.17, 0.065, 0.065], [0.36, 0.8, 2.3, 0.04, 0.04]],
  ear: [[0.29, 0.86, 2.16, 0.04, 0.08], [0.5, 0.86, 2.1, 0.03, 0.05]],
  lappet: [[0.36, 0.8, 2.12, 0.11, 0.05], [0.358, 0.79, 1.97, 0.11, 0.05], [0.355, 0.78, 1.82, 0.11, 0.05], [0.352, 0.77, 1.66, 0.105, 0.05], [0.345, 0.76, 1.5, 0.1, 0.048], [0.338, 0.75, 1.38, 0.1, 0.046], [0.33, 0.74, 1.26, 0.1, 0.045]],
  foreleg: [[0.42, 1.4, 0.32, 0.2, 0.3], [0.42, 0.7, 0.24, 0.19, 0.22], [0.42, 0.18, 0.15, 0.22, 0.14]],
  hindleg: [[0.62, 4.1, 0.5, 0.18, 0.36], [0.66, 3.45, 0.18, 0.16, 0.16], [0.66, 3.15, 0.12, 0.15, 0.12]],
  tail: [[0.3, 4.95, 0.35, 0.07, 0.07], [0.6, 4.72, 0.12, 0.065, 0.06], [0.72, 4.1, 0.07, 0.055, 0.05], [0.73, 3.2, 0.07, 0.05, 0.045], [0.72, 2.5, 0.07, 0.045, 0.04]],
  king: [[0, 0.26, 0.0, 0.2, 0.18], [0, 0.26, 0.08, 0.2, 0.18], [0, 0.26, 0.11, 0.15, 0.13], [0, 0.26, 0.6, 0.14, 0.12], [0, 0.26, 0.9, 0.16, 0.12], [0, 0.26, 1.0, 0.1, 0.09], [0, 0.26, 1.1, 0.095, 0.095], [0, 0.26, 1.22, 0.06, 0.06]],
};

/** The criosphinx ring plan. */
export function criosphinxPlan({ scale = 1, palette = {} } = {}) {
  const P = { ...CRIOSPHINX_PALETTE, ...palette }, k = scale;
  const st = (rows) => rows.map(([x, ya, z, a, b]) => ({ at: [r4(x * k), r4((CRIO_L / 2 - ya) * k), r4(z * k)], r: [r4(a * k), r4(b * k)] }));
  const loft = (name, rows, group, { slots = 'ring8', mirror = 'plane', e = 2.2 } = {}) => ({ name, kind: 'loft', stations: st(rows), slots, e, frame: 'keep', group, tint: P[group], mirror });
  return {
    schema: 'layered-plan-v1',
    frame: { up: '+z', front: '+y', note: `1 unit = 1 m; a ram-headed sphinx of Karnak's avenue, ${CRIO_L * scale} m long, facing +y` },
    joints: {},
    segments: [
      loft('body', CRIO.body, 'Lion', { slots: 'ring12' }),
      // the headcloth striped as the nemes is: grooves radiating over the shoulders, the lappets striped across
      { ...loft('fall', CRIO.fall, 'Nemes', { slots: 'ring10' }), bandGroups: { 'st0-st1': ['Nemes', 'NemesGroove', 'Nemes', 'NemesGroove', 'Nemes'], 'st1-st2': ['Nemes', 'NemesGroove', 'Nemes', 'NemesGroove', 'Nemes'] } },
      loft('head', CRIO.head, 'Lion', { slots: 'ring10' }),
      loft('hornR', CRIO.horn, 'Horn', { mirror: 'name', slots: 'ring6' }),
      loft('earR', CRIO.ear, 'Lion', { mirror: 'name', slots: 'ring6', e: 2.4 }),
      { ...loft('lappetR', CRIO.lappet, 'Nemes', { mirror: 'name', e: 2.6 }), bandGroups: Object.fromEntries(CRIO.lappet.slice(1).map((_, i) => [`st${i}-st${i + 1}`, Array(4).fill(i % 2 ? 'NemesGroove' : 'Nemes')])) },
      loft('forelegR', CRIO.foreleg, 'Lion', { mirror: 'name' }),
      loft('hindlegR', CRIO.hindleg, 'Lion', { mirror: 'name' }),
      loft('tail', CRIO.tail, 'Lion', { mirror: null, slots: 'ring6' }),
      loft('king', CRIO.king, 'King', { slots: 'ring8' }),
    ],
    palette: P,
  };
}
