/**
 * FOOTWEAR PARTS — the body-agnostic pieces footwear is made of, each laid on a SURFACE (a part's stations, slots and
 * bind: an upper's leather, or the bare foot's skin) a body's foot adapter hands over (adapters/).
 *
 *   soleSlab(print, { floor, thick, welt })   a sole: the footprint's outline grown by the welt, from the floor up
 *   slabBetween(print, { welt, bottom, top }) the same between two surfaces, its foot drawn in (a heel, a wedge)
 *   strapBand(P, u, { lift, width })          a band round the surface `P` at its station `u`
 *   buckleOn(band, side)                      a small block on a strap's outer side
 *   quarterEgg({ o, fwd, side, L, W, H })     a quarter egg over the toes, toe base to toe tip (a toe cap)
 *   studsOn(ring, mid, { every, minZ })       small blocks round a ring's upper half (rivets)
 *   bindNearest(piece, P)                     a piece's bind copied from the surface it is worn on
 *   scalePart(P, f)                           a part (its points and its caps) scaled by `f` about the origin: a body
 *                                             carried to the size a library's cards are drawn at, and its pieces back
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
 * upper's nearest point (`rings`: or its ring's, where the surface blends by ring, a digit's), so it moves as the leather under it does (the foot's ankle blend, the toe base's hinge) */
export function bindNearest(piece, P, { rings = false } = {}) {
  const own = { [P.bind.bone]: 1 }, src = P.stations.flatMap((st) => Object.entries(st.points).map(([sl, p]) => [p, P.bind.blend?.[`${st.id}.${sl}`] ?? (rings ? P.bind.blend?.[st.id] : undefined) ?? own]));
  const nearest = (q) => { let best = src[0], d0 = Infinity; for (const s of src) { const d = (s[0][0] - q[0]) ** 2 + (s[0][1] - q[1]) ** 2 + (s[0][2] - q[2]) ** 2; if (d < d0) { d0 = d; best = s; } } return best[1]; };
  const blend = {};
  for (const st of piece.stations) for (const [sl, q] of Object.entries(st.points)) { const w = nearest(q); if (!(w === own)) blend[`${st.id}.${sl}`] = w; }
  for (const [k, q] of Object.entries(piece.caps)) { const w = nearest(q); if (!(w === own)) blend[k] = w; }
  return { bone: P.bind.bone, blend };
}

/** a sole slab: the footprint's outline round its middle (the farthest point in each of 48 directions, a gap filled from
 * its neighbours, eased round), grown by the welt, from the floor up `thick`; its caps a hair beyond its two faces */
export function soleSlab(print, { floor, thick, welt, n = 48 }) {
  const O = outlineOf(print, welt, n); if (!O) return null;
  const { c, R, names } = O;
  const ring = (z, inset) => Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / n; return [nm, [r6(c[0] + Math.cos(a) * (R[j] - inset)), r6(c[1] + Math.sin(a) * (R[j] - inset)), r6(z)]]; }));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: ring(floor, 0.001) }, { id: 'st1', u: 1, points: ring(floor + thick, 0) }],
    caps: { back: [r6(c[0]), r6(c[1]), r6(floor - 0.001)], tip: [r6(c[0]), r6(c[1]), r6(floor + thick + 0.001)] } };
}

/** a footprint's outline round its middle: the farthest point in each of `n` directions, a gap filled from its
 * neighbours, eased round, grown by the welt → { c, R (each direction's reach), names } */
function outlineOf(print, welt, n) {
  if (print.length < 8) return null;
  const c = mean(print), r = new Array(n).fill(0);
  for (const p of print) { const a = Math.atan2(p[1] - c[1], p[0] - c[0]), j = ((Math.round((a / (2 * Math.PI)) * n) % n) + n) % n, d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d > r[j]) r[j] = d; }
  for (let it = 0; it < n && r.some((x) => x === 0); it++) for (let j = 0; j < n; j++) if (!r[j]) { const a = r[(j + n - 1) % n], b = r[(j + 1) % n]; if (a || b) r[j] = a && b ? (a + b) / 2 : a || b; }
  return { c, R: r.map((x, j) => (r[(j + n - 1) % n] + 2 * x + r[(j + 1) % n]) / 4 + welt), names: ringSlots(n) };
}

/** a slab on a footprint's outline (grown by the welt) between two surfaces, `bottom(x, y)` and `top(x, y)` (each a
 * height at a place), its bottom ring drawn in `taper` (0 … 1) toward `toward` [x, y] (a heel's foot: a stiletto's tip)
 * and moved by `shift` [dx, dy] (a heel leaned so it stands plumb once the foot is tipped) */
export function slabBetween(print, { welt, bottom, top, taper = 1, toward = null, shift = [0, 0], n = 48 }) {
  const O = outlineOf(print, welt, n); if (!O) return null;
  const { c, R, names } = O, t = toward ?? c;
  const xy = (j, k, d) => { const a = (2 * Math.PI * j) / n, x = c[0] + Math.cos(a) * R[j], y = c[1] + Math.sin(a) * R[j]; return [t[0] + (x - t[0]) * k + d[0], t[1] + (y - t[1]) * k + d[1]]; };
  const ring = (f, k, d = [0, 0]) => Object.fromEntries(names.map((nm, j) => { const [x, y] = xy(j, k, d); return [nm, [r6(x), r6(y), r6(f(x, y))]]; }));
  const b = [t[0] + (c[0] - t[0]) * taper + shift[0], t[1] + (c[1] - t[1]) * taper + shift[1]];
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: ring(bottom, taper, shift) }, { id: 'st1', u: 1, points: ring(top, 1) }],
    caps: { back: [r6(b[0]), r6(b[1]), r6(bottom(b[0], b[1]) - 0.001)], tip: [r6(c[0]), r6(c[1]), r6(top(c[0], c[1]) + 0.001)] } };
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
  return block(P, unitv([P[0] - C[0], P[1] - C[1], P[2] - C[2]]), unitv(B.points[sl].map((x, q) => x - A.points[sl][q])), { w, h, thick });
}

/** a small block standing on `P` along the normal `n`, `h` along `t` and `w` across it, `thick` proud */
export function block(P, n, t, { w, h, thick }) {
  const b = unitv(cross(n, t)), names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const face = (off) => Object.fromEntries(names.map((nm, j) => [nm, [0, 1, 2].map((q) => r6(P[q] + n[q] * off + t[q] * corner[j][0] * h / 2 + b[q] * corner[j][1] * w / 2))]));
  return { layer: 1, closure: 'closed', slots: names, stations: [{ id: 'st0', u: 0, points: face(0.0005) }, { id: 'st1', u: 1, points: face(thick) }],
    caps: { back: P.map((x, q) => r6(x - n[q] * 0.0005)), tip: P.map((x, q) => r6(x + n[q] * (thick + 0.0005))) } };
}

/** a QUARTER EGG over the toes, mapped toe to toe: from the toe base (`o`, t 0) along the foot's forward `fwd` to past
 * the toe tip (`L`), its front and top quarter of an egg (each ring's arch shrinking as √(1 − (t/L)^p), blunt at `p` > 2),
 * `W` wide each side of its centre across (along `side`: `c` at the toe base, running to `cTip` at the tip, the toe line
 * being oblique) and `H` high over its flat bottom at `minZ` (inside the sole),
 * closed at the tip. A toe cap: the half teacup */
export function quarterEgg({ o, fwd, side, c = 0, cTip = c, L, W, H, minZ, p = 2.5, rings = 10, n = 24 }) {
  const cAt = (t) => c + (cTip - c) * (t / L);
  const names = ringSlots(n), world = (t, sd, z) => [o[0] + fwd[0] * t + side[0] * sd, o[1] + fwd[1] * t + side[1] * sd, z].map(r6);
  const k = (t) => Math.sqrt(Math.max(0, 1 - (t / L) ** p)), last = rings - 1;
  // (the rings spaced closer toward the tip, where the egg turns; the last a little short of it)
  const ts = Array.from({ length: rings }, (_, i) => L * 0.97 * Math.sin((Math.PI / 2) * (i / last)));
  const stations = ts.map((t, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / n, s = k(t);
    return [nm, world(t, cAt(t) + W * s * Math.cos(a), Math.sin(a) > 0 ? minZ + H * s * Math.sin(a) : minZ)]; })) }));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: world(-0.001, c, minZ + H / 2), tip: world(L, cTip, minZ + H * 0.3) } };
}

/** the leather under a quarter egg tucked inside it: each point of the part `P` over the egg's floor and ahead of the toe
 * base that reaches past `keep` of the egg's arch there is drawn in toward the egg's axis to it (its weights kept: the
 * cap hides it, so it must not poke through) */
export function tuckUnderEgg(P, { o, fwd, side, c = 0, cTip = c, L, W, H, minZ, p = 2.5, keep = 0.92 }) {
  const stations = P.stations.map((st) => ({ ...st, points: Object.fromEntries(Object.entries(st.points).map(([sl, q]) => {
    const d = [q[0] - o[0], q[1] - o[1]], t0 = d[0] * fwd[0] + d[1] * fwd[1], sd = d[0] * side[0] + d[1] * side[1];
    if (t0 < 0 || q[2] <= minZ) return [sl, q];
    const t = Math.min(t0, L * 0.95), k = Math.sqrt(Math.max(0, 1 - (t / L) ** p)), m = c + (cTip - c) * (t / L), e = Math.hypot((sd - m) / (W * k), (q[2] - minZ) / (H * k));
    if (e <= keep && t === t0) return [sl, q];
    const f = Math.min(1, keep / e), sd2 = m + (sd - m) * f, z2 = minZ + (q[2] - minZ) * f;
    return [sl, [o[0] + fwd[0] * t + side[0] * sd2, o[1] + fwd[1] * t + side[1] * sd2, z2].map(r6)]; })) }));
  return { ...P, stations };
}

/** rivets: a small block on every `every`-th point of a ring (a shell's first) over its middle's height + `over`,
 * standing along the point's ray from the middle */
export function studsOn(ring, { every = 4, over = 0, size = 0.005 } = {}) {
  const ps = Object.values(ring), mid = mean(ps), out = [];
  ps.forEach((p, j) => {
    if (j % every || p[2] < mid[2] + over) return;
    const q = ps[(j + 1) % ps.length], n = unitv(p.map((x, k) => x - mid[k])), t0 = q.map((x, k) => x - p[k]), dn = t0.reduce((s, x, k) => s + x * n[k], 0);
    out.push(block(p, n, unitv(t0.map((x, k) => x - dn * n[k])), { w: size, h: size, thick: size * 0.5 }));
  });
  return out;
}

/** a part scaled by `f` about the origin: its points and its caps (all else, its bind among it, as it was) */
export function scalePart(P, f) {
  if (!P) return P;
  const sc = (p) => p.map((x) => r6(x * f));
  return { ...P, stations: P.stations.map((st) => ({ ...st, points: Object.fromEntries(Object.entries(st.points).map(([sl, p]) => [sl, sc(p)])) })), ...(P.caps ? { caps: Object.fromEntries(Object.entries(P.caps).map(([k, p]) => [k, sc(p)])) } : {}) };
}
/** each part of a map scaled by `f` */
export const scaleParts = (parts, f) => Object.fromEntries(Object.entries(parts || {}).map(([n, P]) => [n, scalePart(P, f)]));
/** a map of points (joints) scaled by `f`, an absent one left absent */
export const scalePoints = (J, f) => (J ? Object.fromEntries(Object.entries(J).map(([n, p]) => [n, Array.isArray(p) ? p.map((x) => x * f) : p])) : J);
