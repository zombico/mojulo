/**
 * THE FRONT GATES — a gated front's boundary along its plot's front line: its RUNS between the openings the front
 * leaves (its path, a parking pad, a mansion's drive) and a GATE in each opening a path goes through; a drive's or a
 * pad's opening is left open, but a mansion's stands between stone piers and is shut by its iron gates. In the plot's
 * frame (u along its frontage from 0 to its width, v into it from the front line, z up from the boundary's base: the
 * walk's lowest point along it), so the scene seats it as it seats the plot.
 *
 *   GATES       { <kind>: { read, h } }: iron (a railing of bars between posts), wall (a low brick wall, coped, its
 *               piers at each opening), picket (a painted picket and its posts)
 *   gatesOf(kind, { w, open: [[u0, u1, what]…], mansion? }) → [{ corners, out, role }]: the boundary and its gates;
 *               `what` 'path' (a gate in it), 'pad' or 'drive' (open; a mansion's drive its piers and gates)
 *
 * `role`: iron, brick, coping, picket, pier. Pure.
 */
import { box } from './fronts.js';

export const GATES = Object.freeze({
  iron: Object.freeze({ read: 'an iron railing, its bars between posts, waist high, a gate of bars at the path', h: 1.05 }),
  wall: Object.freeze({ read: 'a low brick wall under its coping, its piers at each opening, an iron gate between them at the path', h: 0.66 }),
  picket: Object.freeze({ read: 'a painted picket on its posts, a picket gate at the path', h: 0.95 }),
});
export const GATE_IDS = Object.freeze(Object.keys(GATES));

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const P = (x, y, z) => [r4(x), r4(y), r4(z)];
// the boundary's line, a little inside the front line, and its thickness
const V = 0.15, T = 0.04;

/** Bars from u0 to u1, every `gap`, from z0 to z1: each one quad across the line (seen from both sides). */
function bars(u0, u1, z0, z1, gap) {
  const out = [], n = Math.max(1, Math.round((u1 - u0) / gap));
  for (let k = 0; k < n; k++) { const u = u0 + ((u1 - u0) * (k + 0.5)) / n; out.push({ corners: [P(u - 0.012, V, z0), P(u + 0.012, V, z0), P(u + 0.012, V, z1), P(u - 0.012, V, z1)], out: [0, -1, 0], role: 'iron' }); }
  return out;
}
/** A railing from u0 to u1: its rails top and bottom, its bars, a post at each end and every 2.4 m. */
function railing(u0, u1, z0, h) {
  const out = [...box(u0, V - T / 2, u1, V + T / 2, h - 0.05, h, 'iron'), ...box(u0, V - T / 2, u1, V + T / 2, z0 + 0.08, z0 + 0.12, 'iron'), ...bars(u0, u1, z0 + 0.12, h - 0.05, 0.2)];
  const n = Math.max(1, Math.ceil((u1 - u0) / 2.4));
  for (let k = 0; k <= n; k++) { const u = u0 + ((u1 - u0) * k) / n; out.push(...box(u - 0.035, V - 0.035, u + 0.035, V + 0.035, z0, h + 0.07, 'iron')); }
  return out;
}
/** A pier at u (its face to the opening), `s` square, `h` tall, its cap over it. */
const pier = (u, s, h, role = 'pier') => [...box(u - s / 2, V - s / 2, u + s / 2, V + s / 2, 0, h, role), ...box(u - s / 2 - 0.04, V - s / 2 - 0.04, u + s / 2 + 0.04, V + s / 2 + 0.04, h, h + 0.08, 'coping')];

/** A gated front's boundary and its gates. */
export function gatesOf(kind, { w, open = [], mansion = false }) {
  const out = [], G = GATES[kind], gaps = open.map(([a, b, what]) => [Math.max(0, a), Math.min(w, b), what]).filter(([a, b]) => b - a > 0.2).sort((p, q) => p[0] - q[0]);
  // the runs between the openings
  const runs = [];
  let u = 0;
  for (const [a, b] of gaps) { if (a - u > 0.15) runs.push([u, a]); u = Math.max(u, b); }
  if (w - u > 0.15) runs.push([u, w]);
  for (const [u0, u1] of runs) {
    if (mansion) out.push(...box(u0, V - 0.14, u1, V + 0.14, 0, 0.55, 'brick'), ...box(u0, V - 0.16, u1, V + 0.16, 0.55, 0.6, 'coping'), ...railing(u0, u1, 0.6, 1.5).filter((f) => f.role === 'iron'));
    else if (kind === 'iron') out.push(...railing(u0, u1, 0, G.h));
    else if (kind === 'wall') out.push(...box(u0, V - 0.12, u1, V + 0.12, 0, 0.6, 'brick'), ...box(u0, V - 0.14, u1, V + 0.14, 0.6, G.h, 'coping'));
    else out.push(...box(u0, V - T / 2, u1, V + T / 2, 0, G.h, 'picket'), ...box(u0, V - 0.045, u0 + 0.09, V + 0.045, 0, G.h + 0.1, 'picket'), ...box(u1 - 0.09, V - 0.045, u1, V + 0.045, 0, G.h + 0.1, 'picket'));
  }
  // each opening: a path's gate (between piers where the boundary is a wall, or a mansion's); a mansion's drive its
  // stone piers and its pair of iron gates, shut; a pad's left open
  for (const [a, b, what] of gaps) {
    if (what === 'pad' || (what === 'drive' && !mansion)) continue;
    const big = mansion && what === 'drive', s = big ? 0.6 : 0.4, ph = big ? 1.9 : mansion ? 1.4 : 1;
    const walled = mansion || kind === 'wall';
    if (walled) out.push(...pier(a - s / 2, s, ph), ...pier(b + s / 2, s, ph));
    const g0 = a + 0.04, g1 = b - 0.04, gh = big ? 1.75 : walled ? 0.95 : G.h;
    if (kind === 'picket' && !mansion) out.push(...box(g0, V - T / 2, g1, V + T / 2, 0.06, gh - 0.05, 'picket'));
    else {
      out.push(...box(g0, V - 0.02, g1, V + 0.02, gh - 0.06, gh, 'iron'), ...box(g0, V - 0.02, g1, V + 0.02, 0.1, 0.15, 'iron'), ...bars(g0, g1, 0.15, gh - 0.06, big ? 0.16 : 0.13));
      // (a pair of gates meets at the drive's middle)
      if (big) out.push(...box((a + b) / 2 - 0.03, V - 0.03, (a + b) / 2 + 0.03, V + 0.03, 0.05, gh, 'iron'));
    }
  }
  return out;
}
