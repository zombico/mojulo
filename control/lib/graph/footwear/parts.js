/**
 * FOOTWEAR PARTS — the body-agnostic pieces footwear is made of, each laid on a SURFACE (a part's stations, slots and
 * bind: an upper's leather, or the bare foot's skin) a body's foot adapter hands over (adapters/).
 *
 *   soleSlab(print, { floor, thick, welt })   a sole: the footprint's outline grown by the welt, from the floor up
 *   strapBand(P, u, { lift, width })          a band round the surface `P` at its station `u`
 *   buckleOn(band, side)                      a small block on a strap's outer side
 *   bindNearest(piece, P)                     a piece's bind copied from the surface it is worn on
 *
 * Pure and deterministic.
 */
import { ringSlots } from '../polygonizer/body-relational-resample.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
export const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
export const unitv = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
export const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));

/** a piece's bind copied from the upper `P` it is worn on: each of its points (and its caps) takes the weights of the
 * upper's nearest point, so it moves as the leather under it does (the foot's ankle blend, the toe base's hinge) */
export function bindNearest(piece, P) {
  const own = { [P.bind.bone]: 1 }, src = P.stations.flatMap((st) => Object.entries(st.points).map(([sl, p]) => [p, P.bind.blend?.[`${st.id}.${sl}`] ?? own]));
  const nearest = (q) => { let best = src[0], d0 = Infinity; for (const s of src) { const d = (s[0][0] - q[0]) ** 2 + (s[0][1] - q[1]) ** 2 + (s[0][2] - q[2]) ** 2; if (d < d0) { d0 = d; best = s; } } return best[1]; };
  const blend = {};
  for (const st of piece.stations) for (const [sl, q] of Object.entries(st.points)) { const w = nearest(q); if (!(w === own)) blend[`${st.id}.${sl}`] = w; }
  for (const [k, q] of Object.entries(piece.caps)) { const w = nearest(q); if (!(w === own)) blend[k] = w; }
  return { bone: P.bind.bone, blend };
}

/** a sole slab: the footprint's outline round its middle (the farthest point in each of 48 directions, a gap filled from
 * its neighbours, eased round), grown by the welt, from the floor up `thick`; its caps a hair beyond its two faces */
export function soleSlab(print, { floor, thick, welt, n = 48 }) {
  if (print.length < 8) return null;
  const c = mean(print), r = new Array(n).fill(0);
  for (const p of print) { const a = Math.atan2(p[1] - c[1], p[0] - c[0]), j = ((Math.round((a / (2 * Math.PI)) * n) % n) + n) % n, d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d > r[j]) r[j] = d; }
  for (let it = 0; it < n && r.some((x) => x === 0); it++) for (let j = 0; j < n; j++) if (!r[j]) { const a = r[(j + n - 1) % n], b = r[(j + 1) % n]; if (a || b) r[j] = a && b ? (a + b) / 2 : a || b; }
  const R = r.map((x, j) => (r[(j + n - 1) % n] + 2 * x + r[(j + 1) % n]) / 4 + welt), names = ringSlots(n);
  const ring = (z, inset) => Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / n; return [nm, [r6(c[0] + Math.cos(a) * (R[j] - inset)), r6(c[1] + Math.sin(a) * (R[j] - inset)), r6(z)]]; }));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: ring(floor, 0.001) }, { id: 'st1', u: 1, points: ring(floor + thick, 0) }],
    caps: { back: [r6(c[0]), r6(c[1]), r6(floor - 0.001)], tip: [r6(c[0]), r6(c[1]), r6(floor + thick + 0.001)] } };
}

/** a strap: the upper's rings about `u`, `width` (m) apart along it, each point lifted off its ring's middle, carried by
 * the upper's bind there */
export function strapBand(P, u, { lift, width = 0.015 }) {
  const U = P.stations.map((st, i) => st.u ?? i), mid = P.stations.map((st) => mean(Object.values(st.points)));
  let i = U.findIndex((x) => x >= u); if (i < 0) return null;
  let a = i, b = i; const far = () => Math.hypot(...[0, 1, 2].map((q) => mid[b][q] - mid[a][q]));
  while (far() < width && (a > 0 || b < U.length - 1)) { if (a > 0) a--; if (far() < width && b < U.length - 1) b++; }
  if (a === b) return null;
  const pick = [P.stations[a], P.stations[b]], C = [mid[a], mid[b]];
  const stations = pick.map((st, k) => ({ id: st.id, u: k, points: Object.fromEntries(Object.entries(st.points).map(([sl, p]) => { const d = unitv([p[0] - C[k][0], p[1] - C[k][1], p[2] - C[k][2]]); return [sl, p.map((x, q) => r6(x + d[q] * lift))]; })) }));
  const along = unitv([C[1][0] - C[0][0], C[1][1] - C[0][1], C[1][2] - C[0][2]]), ids = new Set(pick.map((st) => st.id));
  const blend = Object.fromEntries(Object.entries(P.bind?.blend || {}).filter(([k]) => ids.has(k.split('.')[0])));
  return { layer: 1, closure: 'closed', slots: P.slots, ...(P.slotT ? { slotT: P.slotT } : {}), stations,
    caps: { back: C[0].map((x, q) => r6(x - along[q] * 0.001)), tip: C[1].map((x, q) => r6(x + along[q] * 0.001)) }, bind: { ...P.bind, blend } };
}

/** a buckle: a small block on the strap's outer side (`side` +1 the right, −1 the left), across it */
export function buckleOn(band, side, { w = 0.016, h = 0.012, thick = 0.004 } = {}) {
  const [A, B] = band.stations, sl = band.slots.reduce((best, s) => ((A.points[s][0] + B.points[s][0]) * side > (A.points[best][0] + B.points[best][0]) * side ? s : best), band.slots[0]);
  const P = mean([A.points[sl], B.points[sl]]), C = mean([mean(Object.values(A.points)), mean(Object.values(B.points))]);
  const n = unitv([P[0] - C[0], P[1] - C[1], P[2] - C[2]]), t = unitv(B.points[sl].map((x, q) => x - A.points[sl][q])), b = unitv(cross(n, t));
  const names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const face = (off) => Object.fromEntries(names.map((nm, j) => [nm, [0, 1, 2].map((q) => r6(P[q] + n[q] * off + t[q] * corner[j][0] * h / 2 + b[q] * corner[j][1] * w / 2))]));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: face(0.0005) }, { id: 'st1', u: 1, points: face(thick) }],
    caps: { back: P.map((x, q) => r6(x - n[q] * 0.0005)), tip: P.map((x, q) => r6(x + n[q] * (thick + 0.0005))) } };
}
