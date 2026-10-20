/** body-relational-resample.js — a closed part re-sampled onto a field: the ring's slot names, the rays from the ring's centre
 * through the authored cage to the field's first crossing, the bind's shares carried over, the grid relaxed onto the
 * skin, a later pass reusing the rays a field change cannot reach; a right limb mirrored to the left. */
import { add, sub, scl, len, unit, r6 } from './body-relational-vec.js';
import { crossing, project } from './body-relational-field.js';

/** a ring of N slot names: the front, N/2 − 1 down the right, the back, and the left back to the front (midline parts
 * mirror right to left by name) */
export function ringSlots(N) {
  const h = N / 2, pad = (k) => String(k).padStart(2, '0');
  return ['front', ...Array.from({ length: h - 1 }, (_, k) => `s${pad(k + 1)}R`), 'back', ...Array.from({ length: h - 1 }, (_, k) => `s${pad(h - 1 - k)}L`)];
}

export const mixW = (a, b, t) => {
  const w = {}; for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) { const v = r6((a[k] ?? 0) * (1 - t) + (b[k] ?? 0) * t); if (v > 0) w[k] = v; }
  const ks = Object.keys(w), big = ks.reduce((x, k) => (w[k] > w[x] ? k : x), ks[0]); w[big] = r6(1 - ks.filter((k) => k !== big).reduce((t2, k) => t2 + w[k], 0)); return w;
};
/** a blend held to the four bones a vertex carries: the weakest dropped and the rest made whole again (a mix of five,
 * left out whole, had dropped a point's new share for one ring and kept it on the next: a step where a ramp was meant) */
export const four = (w) => {
  const ks = Object.keys(w); if (ks.length <= 4) return w;
  const keep = ks.sort((a, b) => w[b] - w[a] || (a < b ? -1 : 1)).slice(0, 4).sort(), sum = keep.reduce((t, k) => t + w[k], 0);
  return mixW(Object.fromEntries(keep.map((k) => [k, w[k] / sum])), {}, 0);
};
export const stationId = (u) => (Number.isInteger(u) ? `st${u}` : `st${Math.floor(u)}_st${Math.ceil(u)}_${String(Math.round((u - Math.floor(u)) * 1000)).padStart(3, '0')}`);

/** a closed part re-sampled onto a field: `rings` stations over its authored u, `around` slots round each, each slot on
 * the ray from `origin(c)` (the ring's centre by default) through the authored cage's point there, at the field's first
 * crossing outward; `ease(u)` how far the field wins over the authored point (1 everywhere by default). The bind's
 * shares interpolated: per slot where the authored bind names slots, by station elsewhere; a HARD limb (`bind.zone`)
 * keeps its bone rigid, a joint's share easing in only within the zone of the joint's ring (the refine pass's rule) */
// (each re-sampled part's rays as cast, before the relaxing: what a later pass `reuse`s)
const CAST = new WeakMap();
/** `reuse`: { from, near } a part re-sampled before with the same cage and options, on a field that differs from this
 * one only near some masses (a pauldron's stage): a ray whose point there is `near` them is cast again, the rest keep
 * their rays as cast; the relaxing runs over the cast rays and `relax` × 2 grid steps round them, and a point further
 * than `relax` steps from them keeps its point (the relaxing carries a change one step an iteration, so it cannot
 * have moved: the same points as casting every ray again, for the cast rays' share of the cost) */
export function resamplePart(P, sd, { around, rings, origin = (c) => c, ease = () => 1, relax = 0, capsAlong = null, shrinkOutside = 0, reuse = null, forward = true } = {}) {
  // (stations without a `u` are at their index, as the compiler reads them)
  const st = P.stations.map((x, i) => ({ ...x, u: x.u ?? i })), SL = P.slots, n0 = SL.length, U = st[st.length - 1].u, b = P.bind, own = { [b.bone]: 1 };
  const centre = (s) => scl(SL.reduce((a, k) => add(a, s.points[k]), [0, 0, 0]), 1 / n0);
  const ptAt = (s, q) => { const f = q * n0, k = Math.floor(f) % n0, t = f - Math.floor(f); return add(scl(s.points[SL[k]], 1 - t), scl(s.points[SL[(k + 1) % n0]], t)); };
  const bracket = (u) => { let i = 0; while (i < st.length - 2 && st[i + 1].u < u) i++; const a = st[i], c = st[i + 1]; return [a, c, (u - a.u) / (c.u - a.u)]; };
  const cageAt = (u, q) => { const [a, c, t] = bracket(u); return add(scl(ptAt(a, q), 1 - t), scl(ptAt(c, q), t)); };
  const byId = Object.fromEntries(st.map((x) => [x.id, x]));
  const perSlot = Object.keys(b.blend || {}).some((k) => k.includes('.'));
  const shareAt = (sx, q) => (perSlot && b.blend[`${sx.id}.${SL[Math.round(q * n0) % n0]}`]) || b.blend?.[sx.id] || own;
  // a hard limb: the shares by the integer stations, eased within the zone of the joint's ring
  const atInt = (i) => b.blend?.[`st${i}`] ?? own, rigid = (w) => Object.keys(w).length === 1 && w[b.bone] === 1;
  const zoneShare = (u, c) => {
    const i0 = Math.floor(u), i1 = Math.ceil(u), lo = atInt(i0), hi = atInt(i1); if (i0 === i1) return lo;
    let t = u - i0; const loR = rigid(lo), hiR = rigid(hi);
    if (loR !== hiR) { const cj = centre(byId[`st${loR ? i1 : i0}`]), d = len(sub(c, cj)), x = Math.max(0, Math.min(1, 1 - d / b.zone)), sm = x * x * (3 - 2 * x); t = loR ? sm : 1 - sm; }
    return mixW(lo, hi, t);
  };
  const slots = ringSlots(around), blend = { ...(b.blend?.back ? { back: b.blend.back } : {}), ...(b.blend?.tip ? { tip: b.blend.tip } : {}) };
  const stations = [];
  // (with `reuse`: the grid points within `k` steps of a ray cast again, round the ring and along the part)
  const prior = reuse && CAST.get(reuse.from), within = (seed, k) => {
    const dist = seed.map((row) => row.map((x) => (x ? 0 : Infinity))), Q = [];
    seed.forEach((row, i) => row.forEach((x, j) => { if (x) Q.push([i, j]); }));
    for (let h = 0; h < Q.length; h++) {
      const [i, j] = Q[h], d = dist[i][j]; if (d >= k) continue;
      for (const [a, c] of [[i, (j + 1) % around], [i, (j + around - 1) % around], [i + 1, j], [i - 1, j]]) if (a >= 0 && a < rings && dist[a][c] > d + 1) { dist[a][c] = d + 1; Q.push([a, c]); }
    }
    return dist;
  };
  const cast = prior ? reuse.from.stations.map((x) => slots.map((sl) => reuse.near(x.points[sl]))) : null;
  for (let i = 0; i < rings; i++) {
    const u = r6((U * i) / (rings - 1)), [a, c2, t] = bracket(u), id = stationId(u);
    const c = add(scl(centre(a), 1 - t), scl(centre(c2), t)), o = origin(c), points = {}, e = ease(u);
    // a ring the field does not reach at all (`origin` finds no point of the skin to cast from: the thigh's top rings
    // above the hip's joint, inside the pelvis's skin) keeps the authored ring drawn in toward its centre by
    // `shrinkOutside`, ordered and hidden: cast onto the field from elsewhere, those rings folded back on one another
    const outside = shrinkOutside && !o;
    if (b.zone > 0) { const w = zoneShare(u, c); if (!rigid(w)) blend[id] = w; }
    slots.forEach((sl, j) => {
      const q = j / around, p0 = cageAt(u, q);
      if (outside) { points[sl] = add(c, scl(sub(p0, c), shrinkOutside)).map(r6); if (!(b.zone > 0)) { const w = mixW(shareAt(a, q), shareAt(c2, q), t); if (!rigid(w)) blend[`${id}.${sl}`] = w; } return; }
      if (cast && !cast[i][j]) { points[sl] = prior[i][sl]; if (!(b.zone > 0)) { const w = mixW(shareAt(a, q), shareAt(c2, q), t); if (!rigid(w)) blend[`${id}.${sl}`] = w; } return; }
      const hit = crossing(sd, o, unit(sub(p0, o)), 2.5 * len(sub(p0, o)) + 0.05);
      // (a ray that finds no skin, the pelvis's lowest ring between the thighs, takes the nearest skin to the authored
      // point, not the authored point itself: those stood off the new skin in a jagged hem under the seat)
      const got = hit ?? project(sd, p0);
      points[sl] = (got ? add(scl(p0, 1 - e), scl(got, e)) : p0).map(r6);
      if (!(b.zone > 0)) { const w = mixW(shareAt(a, q), shareAt(c2, q), t); if (!rigid(w)) blend[`${id}.${sl}`] = w; }
    });
    stations.push({ id, u, points });
  }
  CAST.set(stations, stations.map((x) => ({ ...x.points })));
  // (iteration `it` relaxes the points within 2 relax − 1 − it steps of a ray cast again: those the kept ones, within
  // `relax`, are made from)
  const steps = cast && within(cast, 2 * relax);
  if (relax) relaxOnto(stations, slots, sd, relax, (i, j, it) => ease(stations[i].u) >= 1 && (!steps || steps[i][j] <= 2 * relax - 1 - it), 0.5, forward);
  if (cast) stations.forEach((x, i) => slots.forEach((sl, j) => { if (steps[i][j] > relax) x.points[sl] = reuse.from.stations[i].points[sl]; }));
  // a limb's poles (`capsAlong`, the bone's direction): each end ring's centre carried a third of its radius on along
  // the bone, inside the neighbour's skin as the end ring is (an authored pole stood proud of the new skin, a tent on the
  // shoulder; one cast onto the field from a ring whose centre lay outside it stayed behind the ring and turned the fan)
  const caps = P.caps && capsAlong ? Object.fromEntries(Object.entries(P.caps).map(([k, q]) => {
    const ring = stations[k === 'back' ? 0 : stations.length - 1], pts = slots.map((sl) => ring.points[sl]);
    const c = scl(pts.reduce((a, x) => add(a, x), [0, 0, 0]), 1 / pts.length), rad = pts.reduce((a, x) => a + len(sub(x, c)), 0) / pts.length;
    return [k, add(c, scl(capsAlong, (k === 'back' ? -1 : 1) * rad / 3)).map(r6)];
  })) : P.caps;
  const { slotT: _t, ...rest } = P, out = { ...rest, slots, stations, ...(caps ? { caps } : {}), bind: { ...b, blend } };
  CAST.set(out, CAST.get(stations)); CAST.delete(stations);
  return out;
}
/** the sampled grid RELAXED onto the field: each inner point drawn toward its four neighbours' mean, then carried back
 * onto the skin down the field's gradient, `iters` times. Where a ring's rays crossed a pocket (the armpit's front, the
 * nape) they landed by turns on its two walls, in fins, or folded back on the ring below; the mean evens them and the
 * projection keeps the anatomy (a groove is the field's, so the points return into it). Only the rings the field owns
 * (`owned`): one eased toward the authored cage would be pulled off it */
function relaxOnto(stations, slots, sd, iters, owned = () => true, w = 0.5, forward = true) {
  const n = slots.length;
  for (let it = 0; it < iters; it++) {
    const next = stations.map((s) => ({ ...s.points }));
    for (let i = 1; i < stations.length - 1; i++) slots.forEach((sl, j) => {
      if (!owned(i, j, it)) return;
      const P0 = stations[i].points, nb = [P0[slots[(j + 1) % n]], P0[slots[(j + n - 1) % n]], stations[i - 1].points[sl], stations[i + 1].points[sl]];
      const m = scl(nb.reduce((a, q) => add(a, q), [0, 0, 0]), 0.25), p = add(scl(P0[sl], 1 - w), scl(m, w));
      next[i][sl] = (project(sd, p, 12, forward) ?? p).map(r6);
    });
    stations.forEach((s, i) => { s.points = next[i]; });
  }
}

/** a right limb's part mirrored to the left: x negated, R ↔ L on the slots and the bones (the symmetry's contract) */
export const swapRL = (k) => k.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
export function mirrorPart(P, L) {
  const flip = (p) => [-p[0], p[1], p[2]], swapW = (w) => Object.fromEntries(Object.entries(w).map(([k, v]) => [swapRL(k), v]));
  const blend = Object.fromEntries(Object.entries(P.bind.blend).map(([k, w]) => { const [s, sl] = k.split('.'); return [sl ? `${s}.${swapRL(sl)}` : s, swapW(w)]; }));
  return { ...L, slots: P.slots, stations: P.stations.map((s) => ({ ...s, points: Object.fromEntries(P.slots.map((sl) => [sl, flip(s.points[swapRL(sl)])])) })), ...(P.caps ? { caps: Object.fromEntries(Object.entries(P.caps).map(([k, q]) => [k, flip(q)])) } : {}), bind: { ...L.bind, blend } };
}

