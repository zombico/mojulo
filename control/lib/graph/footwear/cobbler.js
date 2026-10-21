// footwear/cobbler — the upper as a cobbler cuts it: named PATTERN PIECES on the sock, in the sock's own coordinates, so an
// adornment is laid on a piece (the tongue, the eyestays, the quarters, the counter) rather than at a bare place.
//
// COBBLER COORDINATES. Every sock ring runs round the foot from its `front` slot (the leg's front turning to the foot's
// top: the instep's centre line) down one side to its `back` slot (the heel, turning to the sole) and up the other:
//   along    a share of the segment (the foot: 0 the ankle, 1 past the toe base)
//   around   0 on the centre line, 1 at the back; on the LATERAL side (the foot's outer: the R slots of the right foot)
//            or the MEDIAL (its inner)
// A region is { along: [a0, a1], around: [r0, r1], sides }: `sides` 'centre' (one piece through the centre line, |around|
// up to r1), 'both' (a matching pair, lateral and medial), 'lateral' or 'medial'.
//
//   panelOn(P, stations, arc, { lift, thick })   a thin slab over the sock's rings, the arc's slots, lifted off it
//   arcOf(slots, region, side)                    the slots of a ring a region covers on one side (in ring order)
//   laceBars(P, stations, arcs, { lift, w })      criss-cross bars between two eyestays' inner edges, row by row
//
// Pure and deterministic.
import { ringSlots } from '../polygonizer/body-relational-resample.js';
import { mean, unitv } from './parts.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];

/** THE PATTERN PIECES of an upper (the foot's), as a cobbler names them */
export const COBBLER_REGIONS = Object.freeze({
  tongue: { along: [0, 0.84], around: [0, 0.12], sides: 'centre', what: 'the tongue under the lacing, down the instep' },
  eyestay: { along: [0.1, 0.82], around: [0.12, 0.24], sides: 'both', what: 'the lacing strips either side of the tongue, where the eyelets sit' },
  vamp: { along: [0.82, 1], around: [0, 0.5], sides: 'centre', what: 'the front of the upper over the forefoot, before the toe box' },
  quarter: { along: [0.3, 0.88], around: [0.32, 0.68], sides: 'both', what: "the upper's sides behind the vamp: a sneaker's side overlay sits here" },
  counter: { along: [0, 0.4], around: [0.72, 1], sides: 'centre', what: 'the stiffened cup round the heel' },
  foxing: { along: [0.45, 1], around: [0.74, 0.9], sides: 'both', what: 'a strip along the sole round the forefoot' },
});
export const REGION_SIDES = Object.freeze(['centre', 'both', 'lateral', 'medial']);

/** a slot's place round its ring: [around 0 … 1, its side 'R' | 'L' | null on the centre line or the back] */
const placeOf = (j, n) => { const h = n / 2; return j === 0 ? [0, null] : j === h ? [1, null] : j < h ? [j / h, 'R'] : [(n - j) / h, 'L']; };

/** the slots of a ring (`slots`, in ring order) a region covers on `side` ('lateral' | 'medial' | 'centre') of the foot
 * `S`, in ring order along the arc */
export function arcOf(slots, { around: [r0, r1] }, side, S) {
  const n = slots.length, lat = S === 'R' ? 'R' : 'L', want = side === 'lateral' ? lat : side === 'medial' ? (lat === 'R' ? 'L' : 'R') : null;
  if (side === 'centre') {
    // (through the centre line, or round the back when the arc lies there)
    let pick = slots.map((_, j) => j).filter((j) => { const [a] = placeOf(j, n); return a >= r0 - 1e-9 && a <= r1 + 1e-9; });
    // (a ring too coarse for it: the slot nearest its middle and that slot's two neighbours)
    if (pick.length < 2) { const c = r1 + r0 > 1 ? n / 2 : 0; pick = [(c + n - 1) % n, c, (c + 1) % n]; }
    const startAtBack = r0 > 0.5, h = n / 2;
    return pick.sort((x, y) => (startAtBack ? x - y : ((x + h) % n) - ((y + h) % n))).map((j) => slots[j]);
  }
  const side_ = slots.map((_, j) => j).filter((j) => placeOf(j, n)[1] === want), inside = side_.filter((j) => { const a = placeOf(j, n)[0]; return a >= r0 - 1e-9 && a <= r1 + 1e-9; });
  // (a ring too coarse for the region: its two slots nearest the region's middle)
  const mid = (r0 + r1) / 2, got = inside.length >= 2 ? inside : [...side_].sort((x, y) => Math.abs(placeOf(x, n)[0] - mid) - Math.abs(placeOf(y, n)[0] - mid) || x - y).slice(0, 2).sort((x, y) => x - y);
  return got.map((j) => slots[j]);
}

/** a PANEL: over the sock `P`'s `stations`, the slots `arc` of each ring, lifted `lift` off the ring's middle on its
 * face and `thick` less on its back, a thin slab closed at its ends; `rise` (m) carries it on past its first station
 * (a tongue standing above the collar) */
export function panelOn(P, stations, arc, { lift, thick = 0.0015, rise = 0 }) {
  if (stations.length < 2 || arc.length < 2) return null;
  const m = arc.length, names = ringSlots(2 * m), mids = stations.map((st) => mean(Object.values(st.points)));
  const ringAt = (st, mid, shift = [0, 0, 0]) => Object.fromEntries(names.map((nm, j) => {
    const face = j < m, sl = face ? arc[j] : arc[2 * m - 1 - j], p = st.points[sl], d = unitv(p.map((x, q) => x - mid[q])), l = face ? lift : lift - thick;
    return [nm, p.map((x, q) => r6(x + d[q] * l + shift[q]))]; }));
  const rings = stations.map((st, k) => ringAt(st, mids[k]));
  if (rise > 0) { const up = unitv(mids[0].map((x, q) => x - mids[1][q])); rings.unshift(ringAt(stations[0], mids[0], up.map((x) => x * rise))); }
  const cen = rings.map((r) => mean(Object.values(r))), a = unitv(cen[1].map((x, q) => x - cen[0][q])), e = cen.length - 1, b = unitv(cen[e].map((x, q) => x - cen[e - 1][q]));
  return { layer: 1, closure: 'closed', slots: names, stations: rings.map((points, k) => ({ id: `st${k}`, u: k, points })),
    caps: { back: cen[0].map((x, q) => r6(x - a[q] * 0.0005)), tip: cen[e].map((x, q) => r6(x + b[q] * 0.0005)) } };
}

/** a thin bar from `A` to `B` standing off along `n`, `w` square */
function bar(A, B, n, w) {
  const t = unitv(B.map((x, q) => x - A[q])), s = unitv(cross(n, t)), names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const ring = (P) => Object.fromEntries(names.map((nm, j) => [nm, P.map((x, q) => r6(x + n[q] * corner[j][0] * w / 2 + s[q] * corner[j][1] * w / 2))]));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: ring(A) }, { id: 'st1', u: 1, points: ring(B) }],
    caps: { back: A.map((x, q) => r6(x - t[q] * w / 2)), tip: B.map((x, q) => r6(x + t[q] * w / 2)) } };
}

/** LACES: between two eyestays (their arcs `inL`, `inR`: each one's slot nearest the tongue), at `rows` stations spread
 * down them, criss-cross (each row's lateral eyelet to the next row's medial, and its medial to the next's lateral),
 * lifted `lift` off the sock */
export function laceBars(P, stations, inA, inB, { rows = 5, lift, w = 0.003 }) {
  if (stations.length < 2) return [];
  const pick = Array.from({ length: Math.min(rows, stations.length) }, (_, i) => stations[Math.round((i * (stations.length - 1)) / Math.max(1, Math.min(rows, stations.length) - 1))]);
  const eye = (st, sl) => { const mid = mean(Object.values(st.points)), p = st.points[sl], d = unitv(p.map((x, q) => x - mid[q])); return [p.map((x, q) => x + d[q] * lift), d]; };
  const out = [];
  for (let i = 0; i + 1 < pick.length; i++) {
    const [a0, n0] = eye(pick[i], inA), [b0] = eye(pick[i], inB), [a1] = eye(pick[i + 1], inA), [b1, n1] = eye(pick[i + 1], inB);
    const n = unitv(n0.map((x, q) => x + n1[q]));
    out.push(bar(a0, b1, n, w), bar(b0, a1, n, w));
  }
  return out;
}
