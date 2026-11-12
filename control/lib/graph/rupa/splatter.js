/**
 * rupa/splatter.js — SPLATTER PATTERNS: the shapes a liquid leaves on a flat, as data that joins. A pattern is a list of
 * PRIMITIVES (a disc `{ at, r }` or a capsule `{ a, b, r }`, each with a `w` 0 to 1: how deep its heart), and any two
 * patterns join by putting their lists together: where their shapes meet they run into one, as liquid does (a smooth
 * union), so a splash dropped on a puddle is one puddle with a splash's edge. rupa is the internal name.
 *
 *   PATTERNS (each seeded, each returning primitives about its own place):
 *     blot(at, size, seed)                one pool: a few discs overlapping, never a circle
 *     splash(at, size, seed)              a blot and what flew off it: satellite drops round it, smaller with distance,
 *                                         the nearest joined to it by a neck
 *     drips(from, to, seed, { every })    a trail: drops along a way, as from a thing carried or a leak walked under
 *     run(from, to, width, seed)          a liquid that ran: a capsule along its way, a blot where it stopped
 *     seam(from, to, width)               a liquid held in a line (a joint, a kerb's foot)
 *     puddles(rect, { cover, size, seed, keepOut? })   rain on a flat: blots over the rect by the share of it that
 *                                         stands in water, large and small, some near enough to join; none whose heart
 *                                         lies in a `keepOut` box
 *   join(...patterns) → one pattern
 *   splatField(prims) → (x, y) ⇒ depth 0..1: 0 dry, past EDGE standing liquid; the band under EDGE is the soaked rim
 *   rasterSplatter(prims, rect, size) → Uint8Array (size × size, a byte a texel: the field over the rect), for a page
 *   EDGE the depth at which liquid stands
 *
 * Pure; seeded dice only. A pool set down (era/stage.js samples) and a wet flat (era/stage-buildings.js) both lie by it.
 */
import { mulberry32 } from '../vegetation/grow.js';

export const EDGE = 0.5;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const disc = (at, r, w = 1) => ({ at: [r4(at[0]), r4(at[1])], r: r4(r), w });
const cap = (a, b, r, w = 1) => ({ a: [r4(a[0]), r4(a[1])], b: [r4(b[0]), r4(b[1])], r: r4(r), w });

export function blot(at, size, seed = 1) {
  const R = mulberry32(seed), r = size / 2, out = [disc(at, r * 0.62)];
  const n = 3 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) { const a = R() * 2 * Math.PI, d = r * (0.3 + 0.35 * R()); out.push(disc([at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d], r * (0.3 + 0.3 * R()))); }
  return out;
}
export function splash(at, size, seed = 1) {
  const R = mulberry32(seed + 7), r = size / 2, out = blot(at, size * 0.6, seed), n = 6 + Math.floor(R() * 6);
  for (let i = 0; i < n; i++) {
    const a = R() * 2 * Math.PI, d = r * (0.55 + 0.75 * R()), dr = r * 0.16 * (1.15 - d / (r * 1.3)) * (0.6 + 0.8 * R()), p = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d];
    out.push(disc(p, Math.max(0.015, dr), 0.8));
    // (the nearer drops are still joined to the body: a neck)
    if (d < r * 0.8) out.push(cap([at[0] + Math.cos(a) * r * 0.3, at[1] + Math.sin(a) * r * 0.3], p, Math.max(0.01, dr * 0.45), 0.7));
  }
  return out;
}
export function drips(from, to, seed = 1, { every = 0.45, size = 0.09 } = {}) {
  const R = mulberry32(seed + 13), L = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(1, Math.round(L / every)), out = [];
  for (let i = 0; i <= n; i++) { const t = Math.min(1, (i + (R() - 0.5) * 0.5) / n), j = (R() - 0.5) * size * 2;
    out.push(disc([from[0] + (to[0] - from[0]) * t - ((to[1] - from[1]) / (L || 1)) * j, from[1] + (to[1] - from[1]) * t + ((to[0] - from[0]) / (L || 1)) * j], size * (0.5 + R()), 0.85)); }
  return out;
}
export function run(from, to, width, seed = 1) { return [cap(from, to, width / 2, 0.9), ...blot(to, width * 2.4, seed)]; }
export function seam(from, to, width) { return [cap(from, to, width / 2, 0.75)]; }

export function puddles([x0, y0, x1, y1], { cover = 0.25, size = [0.5, 2.6], seed = 1, keepOut = [] } = {}) {
  const R = mulberry32(seed + 29), area = (x1 - x0) * (y1 - y0), out = [];
  let stood = 0, tries = 0;
  while (stood < area * cover && tries++ < 600) {
    // (most are small, a few large: a rained-on slab)
    const s = size[0] + (size[1] - size[0]) * R() ** 2.2, at = [x0 + R() * (x1 - x0), y0 + R() * (y1 - y0)];
    if (keepOut.some((B) => at[0] > B[0] && at[0] < B[2] && at[1] > B[1] && at[1] < B[3])) continue;
    out.push(...(R() < 0.25 ? splash(at, s * 1.2, Math.floor(R() * 1e6)) : blot(at, s, Math.floor(R() * 1e6))));
    stood += 0.5 * s * s;
  }
  return out;
}
export const join = (...patterns) => patterns.flat();

/** The field: each primitive's depth falls from its `w` at its heart to 0 a rim past its edge; they join smoothly. */
export function splatField(prims) {
  return (x, y) => {
    let s = 0;
    for (const p of prims) {
      let d;
      if (p.at) d = Math.hypot(x - p.at[0], y - p.at[1]);
      else { const ax = p.b[0] - p.a[0], ay = p.b[1] - p.a[1], L2 = ax * ax + ay * ay || 1e-9, t = Math.max(0, Math.min(1, ((x - p.a[0]) * ax + (y - p.a[1]) * ay) / L2)); d = Math.hypot(x - p.a[0] - ax * t, y - p.a[1] - ay * t); }
      // (a soft bump: EDGE at the primitive's own radius, so two that touch stand joined)
      const k = d / p.r, v = p.w * Math.max(0, 1 - k * k * 0.5) ** 2;
      s += v * v * v;
    }
    return Math.min(1, Math.cbrt(s) * 2);
  };
}

export function rasterSplatter(prims, [x0, y0, x1, y1], size = 192) {
  const out = new Uint8Array(size * size), cw = (x1 - x0) / size, ch = (y1 - y0) / size;
  // (each primitive stamped over its own reach only: a flat with hundreds of them is still quick)
  const acc = new Float32Array(size * size);
  for (const p of prims) {
    const bx0 = p.at ? p.at[0] : Math.min(p.a[0], p.b[0]), bx1 = p.at ? p.at[0] : Math.max(p.a[0], p.b[0]), by0 = p.at ? p.at[1] : Math.min(p.a[1], p.b[1]), by1 = p.at ? p.at[1] : Math.max(p.a[1], p.b[1]), m = p.r * 1.45;
    const i0 = Math.max(0, Math.floor((bx0 - m - x0) / cw)), i1 = Math.min(size - 1, Math.ceil((bx1 + m - x0) / cw)), j0 = Math.max(0, Math.floor((by0 - m - y0) / ch)), j1 = Math.min(size - 1, Math.ceil((by1 + m - y0) / ch));
    const f = splatField([p]);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const v = f(x0 + (i + 0.5) * cw, y0 + (j + 0.5) * ch); acc[j * size + i] += v * v * v; }
  }
  for (let k = 0; k < acc.length; k++) out[k] = Math.round(Math.min(1, Math.cbrt(acc[k])) * 255);
  return out;
}
