/**
 * surface — what a car's tyres are on, anywhere on a track: the road, a kerb, run-off (gravel outside a corner), or the
 * land past it. The drive rule's `surface(pos)` hook (worlds/controllable/rules-drive.js) reads it: `mu` scales the
 * tyres' grip, `roll` their rolling resistance.
 *
 *   driveSurfaceTable(plan) → { pts, bands, off }   compact, on the payload as `driveSurface` (the page builds its hook)
 *   surfaceAt(table, pos)   → { mu, roll }          pure and import-free: the page embeds its source as it is
 *
 * pts: the line every STEP metres, [x, y, heading, corner] each (corner: the bend's sign at a corner's stations, else
 * 0). bands: [outer offset, mu, roll, straight mu, straight roll, outside mu, outside roll] one side out (a kerb is
 * the run-off's off the corners; a circuit's run-off is gravel outside them). off: [mu, roll] past the footprint.
 */
import { SURFACES } from './surfaces.js';

const STEP = 2;
const r3 = (v) => Math.round(v * 1000) / 1000;
const KERB_K = 1 / 300;

export function driveSurfaceTable(plan) {
  const a = plan.alignment, X = plan.X, T = X.T, L = a.length, n = Math.max(8, Math.round(L / STEP)), count = a.closed ? n : n + 1;
  const pts = [];
  for (let i = 0; i < count; i++) { const p = a.at((i * L) / n); pts.push(r3(p.x), r3(p.y), r3(p.heading), Math.abs(p.k) > KERB_K ? Math.sign(p.k) : 0); }
  const S = (k) => [SURFACES[k].mu, SURFACES[k].roll], run = S(T.runoffSurface), out = S(T.outside), road = S(T.road);
  const bands = [
    [r3(X.road), ...road, ...road, ...road],
    ...(T.kerb ? [[r3(X.kerb), SURFACES.kerb.mu, SURFACES.kerb.roll, ...run, SURFACES.kerb.mu, SURFACES.kerb.roll]] : []),
    [r3(X.outer), ...run, ...run, ...out],
  ];
  return { pts, bands, off: S('grass') };
}

/** The surface under a point (pos: [x, y, …]). The nearest point of the line, its offset across, the band there. */
export function surfaceAt(T, pos) {
  const C = 16;
  if (!T._h) {
    const h = new Map();
    for (let i = 0; i < T.pts.length; i += 4) { const k = Math.floor(T.pts[i] / C) + ',' + Math.floor(T.pts[i + 1] / C); if (!h.has(k)) h.set(k, []); h.get(k).push(i); }
    Object.defineProperty(T, '_h', { value: h, enumerable: false });
  }
  const x = pos[0], y = pos[1], hx = Math.floor(x / C), hy = Math.floor(y / C);
  let best = -1, bd = Infinity;
  for (let u = hx - 1; u <= hx + 1; u++) for (let v = hy - 1; v <= hy + 1; v++) {
    const list = T._h.get(u + ',' + v);
    if (list) for (const i of list) { const d = (T.pts[i] - x) * (T.pts[i] - x) + (T.pts[i + 1] - y) * (T.pts[i + 1] - y); if (d < bd) { bd = d; best = i; } }
  }
  if (best < 0) return { mu: T.off[0], roll: T.off[1] };
  const h = T.pts[best + 2], c = T.pts[best + 3], o = -(x - T.pts[best]) * Math.sin(h) + (y - T.pts[best + 1]) * Math.cos(h), a = Math.abs(o);
  for (const b of T.bands) {
    if (a > b[0]) continue;
    if (!c) return { mu: b[3], roll: b[4] };
    return Math.sign(o) * c < 0 ? { mu: b[5], roll: b[6] } : { mu: b[1], roll: b[2] };
  }
  return { mu: T.off[0], roll: T.off[1] };
}
