// footwear/fantasy — the pieces of FANTASY, DRAMA and HISTORIC footwear: shapes a cobbler's pattern pieces do not make,
// each a primitive a card composes (expand.js ADORN_PRIMS), each riding the bone or the leather it is laid on.
//
//   toeSpike(o, fwd, side, { length, curl, r0, taper })  a toe drawn out past the toes, tapering, curled up by `curl`
//                                                        degrees along it (a poulaine's, a jester's, a Persian slipper's)
//   ribbon(path, normals, { w, thick })                  a flat strip along a path of points, lying on the normals
//                                                        (a wrap round the leg, a feather)
//   helixOn(P, stations, { turns, phase, lift })         a path spiralling round a surface's rings (cross-gartering)
//   flareTop(ring, { height, spread })                   a funnel rising from a ring and opening out (a bucket top)
//   rowel(c, axis, up, { r, points, thick })             a star disc (a spur's rowel)
//
// Pure and deterministic.
import { ringSlots } from '../polygonizer/body-relational-resample.js';
import { mean, unitv } from './parts.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const add = (a, b, k = 1) => a.map((x, q) => x + b[q] * k);
const closed = (stations, back, tip) => ({ layer: 1, closure: 'closed', slots: Object.keys(stations[0]), stations: stations.map((points, k) => ({ id: `st${k}`, u: k, points })), caps: { back: back.map(r6), tip: tip.map(r6) } });

/** a TOE SPIKE: from `o` (the toes' front, at their middle height) along `fwd`, `length` long, curled up by `curl`
 * degrees by its end, its rings `r0` round tapering to `taper` of that, closed in a point */
export function toeSpike(o, fwd, side, { length, curl = 0, r0, taper = 0.15, rings = 10, n = 12 }) {
  const names = ringSlots(n), out = [];
  let p = [...o], d = unitv(fwd);
  const step = length / (rings - 1), turn = ((curl * Math.PI) / 180) / (rings - 1);
  for (let i = 0; i < rings; i++) {
    const s = i / (rings - 1), r = r0 * (1 - (1 - taper) * s ** 1.4), u = unitv(cross(side, d));
    // (a ring square to the path: its first slot on top, the rest round by the foot's side)
    out.push(Object.fromEntries(names.map((nm, j) => { const a = (2 * Math.PI * j) / n; return [nm, add(add(p, u, r * Math.cos(a)), side, r * Math.sin(a)).map(r6)]; })));
    // (on along the path, turned up about the foot's side by the curl's share)
    if (i < rings - 1) { p = add(p, d, step); d = unitv(add(d.map((x) => x * Math.cos(turn)), unitv(cross(side, d)), Math.sin(turn))); }
  }
  return closed(out, add(o, fwd, -0.002), add(p, d, r0 * taper * 0.5));
}

/** a RIBBON: a flat strip `w` wide and `thick` deep along `path`, lying on `normals` (its face out along them) */
export function ribbon(path, normals, { w, thick = 0.0015, widths = null }) {
  if (path.length < 2) return null;
  const names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const out = path.map((p, i) => {
    const t = unitv((path[Math.min(i + 1, path.length - 1)]).map((x, q) => x - path[Math.max(i - 1, 0)][q])), n = unitv(normals[i]), b = unitv(cross(n, t)), ww = widths ? widths[i] : w;
    return Object.fromEntries(names.map((nm, j) => [nm, add(add(p, n, corner[j][0] * thick / 2), b, corner[j][1] * ww / 2).map(r6)]));
  });
  const t0 = unitv(path[1].map((x, q) => x - path[0][q])), e = path.length - 1, t1 = unitv(path[e].map((x, q) => x - path[e - 1][q]));
  return closed(out, add(path[0], t0, -0.0005), add(path[e], t1, 0.0005));
}

/** a HELIX round a surface's rings: `turns` times round over its stations (from the first to the last), starting
 * `phase` (0 … 1 of a turn) round from the ring's first slot, each point lifted `lift` off its ring's middle → { path,
 * normals } */
export function helixOn(P, stations, { turns, phase = 0, lift = 0.003, steps = 18, sign = 1 }) {
  const n = P.slots.length, mids = stations.map((st) => mean(Object.values(st.points))), N = Math.max(2, Math.round(turns * steps));
  const at = (k, f) => { const j = ((Math.floor(f) % n) + n) % n, j2 = (j + 1) % n, w = f - Math.floor(f), A = stations[k].points[P.slots[j]], B = stations[k].points[P.slots[j2]]; return A.map((x, q) => x * (1 - w) + B[q] * w); };
  const path = [], normals = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, kf = s * (stations.length - 1), k = Math.min(stations.length - 2, Math.floor(kf)), w = kf - k;
    const f = (((phase + sign * turns * s) % 1) + 1) % 1 * n, p0 = at(k, f), p1 = at(k + 1, f), m = mids[k].map((x, q) => x * (1 - w) + mids[k + 1][q] * w);
    const p = p0.map((x, q) => x * (1 - w) + p1[q] * w), d = unitv(p.map((x, q) => x - m[q]));
    path.push(add(p, d, lift)); normals.push(d);
  }
  return { path, normals };
}

/** a FLARE: a funnel rising `height` from `ring` (a boot's top) and opening out to `spread` times its reach, its
 * inside a cone sunk back into the leg (so its mouth reads open) */
export function flareTop(ring, { height, spread = 1.6, rings = 5, lift = 0.002 }) {
  const c = mean(Object.values(ring)), names = Object.keys(ring), out = [];
  for (let i = 0; i < rings; i++) {
    const s = i / (rings - 1), k = 1 + (spread - 1) * s ** 1.5;
    out.push(Object.fromEntries(names.map((nm) => { const p = ring[nm], d = unitv([p[0] - c[0], p[1] - c[1], 0]), r = Math.hypot(p[0] - c[0], p[1] - c[1]) * k + lift; return [nm, [c[0] + d[0] * r, c[1] + d[1] * r, p[2] + height * s].map(r6)]; })));
  }
  return closed(out, [c[0], c[1], c[2] - 0.004], [c[0], c[1], c[2] + height * 0.25]);
}

/** a ROWEL: a star of `points` points, `r` round, `thick` deep, square to `axis` about `c` */
export function rowel(c, axis, up, { r = 0.016, points = 8, thick = 0.002 }) {
  const a = unitv(axis), u = unitv(up), v = unitv(cross(a, u)), n = points * 2, names = ringSlots(n);
  const face = (off) => Object.fromEntries(names.map((nm, j) => { const t = (2 * Math.PI * j) / n, rr = j % 2 ? r * 0.35 : r; return [nm, add(add(add(c, a, off), u, rr * Math.cos(t)), v, rr * Math.sin(t)).map(r6)]; }));
  return closed([face(-thick / 2), face(thick / 2)], add(c, a, -thick), add(c, a, thick));
}
