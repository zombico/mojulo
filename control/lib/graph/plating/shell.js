// plating/shell — the FITTED SHELL: armour laid out as a supercar's body is, not as a grid of plates. A segment's skin is
// first faired into one smooth SHELL (its dips bridged, never a muscle's groove), and the shell is then CUT into panels
// along design lines (diagonals, chevrons, sweeps), each panel fitting its neighbours across a narrow SEAM, its edges
// BEVELLED down into the seam, standing at its LAYER's height (an underplate, a trim between, the overplate, a cap over a
// joint), domed where it caps.
//
//   fairShell(P)                             the segment's shell: at(u, f) → { p, n } (a ring station's `u`, a fractional
//                                            slot `f` round its ring), perimeter(u), length
//   stepped(s0, steps, t0, t1)               a line that runs straight and jogs: [[t, s], …]
//   shellPanel(shell, spec)                  a panel cut from it: a closed slab whose sections run across it at levels
//                                            down it, its top lifted, bevelled at its edges, its bottom under it
//
// Panels are laid out in the segment's DESIGN COORDINATES: `t` 0 … 1 down the segment, `s` −1 … 1 round it (0 its front
// line, + its lateral side, ±1 its back), so one layout fits both limbs and any body's segment. Pure and deterministic.
import { ringSlots } from '../polygonizer/body-relational-resample.js';
import { mean, unitv } from '../footwear/parts.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const sm = (x) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };

/** the FAIR SHELL of a segment `P` (its rings in ring order): each point's reach from its ring's middle raised to its
 * neighbourhood's eased reach (so a groove is bridged, a form kept), read anywhere by station `u` and fractional slot */
export function fairShell(P, { passes = 4 } = {}) {
  const n = P.slots.length, K = P.stations.length, U = P.stations.map((st, i) => st.u ?? i);
  const mids = P.stations.map((st) => mean(Object.values(st.points)));
  const dirs = P.stations.map((st, k) => P.slots.map((sl) => unitv(st.points[sl].map((x, q) => x - mids[k][q]))));
  let d = P.stations.map((st, k) => P.slots.map((sl) => Math.hypot(...st.points[sl].map((x, q) => x - mids[k][q]))));
  const raw = d.map((row) => [...row]);
  for (let it = 0; it < passes; it++) d = d.map((row, k) => row.map((x, j) => (4 * x + row[(j + 1) % n] + row[(j + n - 1) % n] + d[Math.max(0, k - 1)][j] + d[Math.min(K - 1, k + 1)][j]) / 8));
  const reach = d.map((row, k) => row.map((x, j) => Math.max(x, raw[k][j])));
  const kOf = (u) => { let k = 0; while (k < K - 2 && U[k + 1] < u) k++; const w = (u - U[k]) / ((U[k + 1] - U[k]) || 1); return [k, Math.max(0, Math.min(1, w))]; };
  const at = (u, f) => {
    const [k, w] = kOf(u), F = ((f % n) + n) % n, j = Math.floor(F), j2 = (j + 1) % n, v = F - j;
    const pt = (kk) => { const r = reach[kk][j] * (1 - v) + reach[kk][j2] * v, dv = unitv(dirs[kk][j].map((x, q) => x * (1 - v) + dirs[kk][j2][q] * v)); return { p: mids[kk].map((x, q) => x + dv[q] * r), n: dv }; };
    const A = pt(k), B = pt(k + 1);
    return { p: A.p.map((x, q) => x * (1 - w) + B.p[q] * w), n: unitv(A.n.map((x, q) => x * (1 - w) + B.n[q] * w)) };
  };
  const perimeter = (u) => { let s = 0, prev = at(u, 0).p; for (let j = 1; j <= 24; j++) { const p = at(u, (j * n) / 24).p; s += Math.hypot(...p.map((x, q) => x - prev[q])); prev = p; } return s; };
  const length = Math.hypot(...mids[K - 1].map((x, q) => x - mids[0][q]));
  return { at, perimeter, length, n };
}

/** a polyline [[t, s], …] read at `t` (clamped to its ends, linear between) */
const curve = (pts) => (t) => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, b] = [pts[i - 1], pts[i]], w = (t - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * w; } return pts[pts.length - 1][1]; };

/** a PANEL cut from the shell: from `t0` to `t1` down the segment, between the curves `left` and `right` round it (each
 * [[t, s], …]), inset half a `seam` from them, lifted `lift` off the shell (its LAYER's height), `thick` deep, its edges
 * bevelled down `bevel` over `bevelW` (m), domed `dome` (m) at its middle; `uOf(t)` and `fOf(s)` the segment's mapping */
export function shellPanel(S, { t0, t1, left, right, lift, thick = 0.004, bevel = 0.003, bevelW = 0.007, seam = 0.003, dome = 0, uOf, fOf, rows = 10, cols = 9 }) {
  const L = curve(left), R = curve(right), names = ringSlots(2 * cols), len = S.length || 0.3;
  const dt = seam / 2 / len, a0 = t0 + dt, a1 = t1 - dt;
  if (!(a1 > a0)) return null;
  // (its sections at even steps down it AND at every kink of its edges, so a line that jogs turns a sharp corner)
  const knots = [...left, ...right].map(([t]) => t).filter((t) => t > a0 + 1e-4 && t < a1 - 1e-4);
  const levels = [...new Set([...Array.from({ length: rows + 1 }, (_, i) => a0 + ((a1 - a0) * i) / rows), ...knots].map((t) => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y)
    .filter((t, i, A) => i === 0 || t - A[i - 1] > 1e-4);
  const sections = [];
  for (const t of levels) {
    const u = uOf(t), per = S.perimeter(u) || 0.3, ds = seam / per;
    let sl = L(t) + ds, sr = R(t) - ds; if (sr - sl < 0.004) { const c = (sl + sr) / 2; sl = c - 0.002; sr = c + 0.002; }
    const top = [], bot = [];
    for (let j = 0; j < cols; j++) {
      const s = sl + ((sr - sl) * j) / (cols - 1), { p, n } = S.at(u, fOf(s));
      // (the bevel: down toward any edge, across by the ring's metres, along by the segment's; the dome: up at the middle)
      const edge = Math.min((s - sl) * per / 2, (sr - s) * per / 2, (t - a0) * len, (a1 - t) * len), drop = bevel * (1 - sm(edge / bevelW));
      const mid = 1 - ((2 * (s - sl)) / ((sr - sl) || 1) - 1) ** 2, midT = 1 - ((2 * (t - a0)) / ((a1 - a0) || 1) - 1) ** 2, up = dome * Math.max(0, mid) * Math.max(0, midT);
      top.push(p.map((x, q) => r6(x + n[q] * (lift - drop + up)))); bot.push(p.map((x, q) => r6(x + n[q] * (lift - thick))));
    }
    sections.push(Object.fromEntries(names.map((nm, k) => [nm, k < cols ? top[k] : bot[2 * cols - 1 - k]])));
  }
  const cen = sections.map((sec) => mean(Object.values(sec))), e = cen.length - 1;
  const a = unitv(cen[1].map((x, q) => x - cen[0][q])), b = unitv(cen[e].map((x, q) => x - cen[e - 1][q]));
  return { layer: 1, closure: 'closed', slots: names, stations: sections.map((points, k) => ({ id: `st${k}`, u: k, points })),
    caps: { back: cen[0].map((x, q) => r6(x - a[q] * 0.0005)), tip: cen[e].map((x, q) => r6(x + b[q] * 0.0005)) } };
}

/** a segment's design `s` (−1 … 1, + its lateral side) as a fractional slot of its ring (ring order: `front` first, the R
 * side, `back`, the L side), on side `S` (a trunk segment reads as the right: + its right side) */
/** a STEPPED line: straight at `s0` from `t0` to `t1`, jogging at each step [tA, tB, ds] (straight before tA, shifted by
 * `ds` from tB on, a straight diagonal between): a line that bends yet stays straight */
export function stepped(s0, steps = [], t0 = 0, t1 = 1) {
  const pts = [[t0, s0]]; let s = s0;
  for (const [a, b, ds] of steps) { pts.push([a, s]); s += ds; pts.push([b, s]); }
  pts.push([t1, s]);
  return pts;
}

export const slotOf = (n, S) => (s) => { const h = n / 2, lat = S === 'L' ? -1 : 1, x = s * lat; return x >= 0 ? x * h : n + x * h; };
