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

/** the groups' colours (painted limestone: an ochre body and face, the nemes in yellow and blue) */
export const SPHINX_PALETTE = Object.freeze({ Lion: '#c9a26b', Nemes: '#d8b45a', Lappet: '#3b5d8f', Uraeus: '#c99a3a', Skin: '#b9784a' });

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
  { at: [0, 19.5, 6.3], r: [7.4, 6.3] },   // the chest
  { at: [0, 15, 5.6], r: [6.0, 5.6] },     // the breast
  { at: [0, 12.6, 5.3], r: [4.9, 4.9] },   // rounding forward between the forelegs
  { at: [0, 11.2, 4.8], r: [3.4, 3.8] },
];
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
  const loft = (name, stations, group, { slots = 'ring8', mirror = 'plane', e = 2.2 } = {}) => ({ name, kind: 'loft', stations: stations.map((s) => ({ at: s.at, r: s.r })), slots, e, frame: 'keep', group, tint: P[group], mirror });
  const G = (list) => list.map((s) => ({ at: A(s.at), r: R(s.r) }));
  const m = (x) => r4(x);
  // the nemes, from the head's bounds (metres): a cap over the crown, the wings, the lappets, the queue
  const cap = [
    { at: [0, m(backY - 0.01 * h), m(top - 0.18 * h)], r: [m(hw * 1.08), m(0.26 * h)] },
    { at: [0, m(midY), m(top - 0.14 * h)], r: [m(hw * 1.14), m(0.26 * h)] },
    { at: [0, m(faceY - 0.18 * h), m(top - 0.14 * h)], r: [m(hw * 1.1), m(0.22 * h)] },
  ];
  // the wings flare from the temples to past the shoulders: the nemes' trapezoid seen from the front
  const wing = [
    { at: [m(hw * 1.04), m(midY), m(top - 0.3 * h)], r: [m(0.06 * h), m(0.42 * h)] },
    { at: [m(hw * 1.5), m(midY - 0.02 * h), m(chin + 0.1 * h)], r: [m(0.06 * h), m(0.45 * h)] },
    { at: [m(hw * 2.25), m(midY - 0.08 * h), m(chin - 0.42 * h)], r: [m(0.07 * h), m(0.5 * h)] },
  ];
  const lappet = [
    { at: [m(hw * 1.15), m(faceY - 0.32 * h), m(chin + 0.05 * h)], r: [m(0.13 * h), m(0.05 * h)] },
    { at: [m(hw * 1.05), m(faceY - 0.26 * h), m(chin - 0.45 * h)], r: [m(0.13 * h), m(0.05 * h)] },
    { at: [m(hw * 0.95), m(faceY - 0.22 * h), m(chin - 0.85 * h)], r: [m(0.12 * h), m(0.045 * h)] },
  ];
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
      loft('body', G(BODY), 'Lion', { slots: 'ring12' }),
      loft('neck', G(NECK), 'Lion'),
      loft('forelegR', G(FORELEG), 'Lion', { mirror: 'name' }),
      loft('hindlegR', G(HINDLEG), 'Lion', { mirror: 'name' }),
      loft('tail', G(TAIL), 'Lion', { mirror: null, slots: 'ring6' }),
      loft('nemesCap', cap, 'Nemes', { slots: 'ring10' }),
      loft('nemesR', wing, 'Nemes', { mirror: 'name', e: 2.6 }),
      loft('lappetR', lappet, 'Lappet', { mirror: 'name', e: 2.6 }),
      loft('queue', queue, 'Nemes'),
      loft('uraeus', uraeus, 'Uraeus', { slots: 'ring6' }),
    ],
    include: [{ name: 'king', parts: head.parts, palette: head.palette, shift }],
    palette: { ...head.palette, ...P },
  };
}
