/**
 * A LOUD STREET — the cube's `exaggerate.streets` (era/exaggerate.js): the walks, the roads and the street's furniture
 * drawn by the hand that drew the loud shops (front-loud.js), over the plan, which never moves (every walk's edge, every
 * kerb's line, every crossing where it was). The same principles: no slab square, no two neighbours alike.
 *
 *   slabsOf(rect, along, z, terms, base, seed)  → [{ corners, hex }]   a walk laid in big slabs over its own ground: cut
 *       across on SKEWED lines (each cut's two ends slid apart along the walk, its own ends too, so no slab is square), each
 *       slab its own tint (the walk's colour leant to a pastel, never its neighbour's), set in a grout of the walk itself
 *       (each slab inset); `z(x, y)` the walk's height, the slabs a hair over it
 *   groundSplat(x, y, r, z, hex, R)              → [{ corners, hex }]   ink splashed on the ground: a blob and its droplets
 *   inkPicker(R)                                 → (kind) → '#rrggbb'   each piece of the furniture its own ink, never the
 *       last one of its kind's
 *   SLAB_TINTS                                   the pastels a walk's slabs lean to
 *
 * Pure; the dice are the caller's.
 */
import { INK, popHex } from './front-loud.js';
import { hexToRgb, rgbToHex } from '../polygonizer/vexar.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
export const SLAB_TINTS = Object.freeze(['#ffd3e2', '#cfeeff', '#fff0b8', '#dcf7c2', '#e6dbff', '#ffe0c8', '#c8f4ea']);
const mixHex = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));

/** A walk's slabs over its own ground (see the header). `terms`: { skew (a share of the walk's width a cut's ends slide
 *  apart), pop (how far a slab leans to its tint) }. */
export function slabsOf(rect, along, z, { skew = 0.3, pop = 0.6 } = {}, base, R) {
  const [x0, y0, x1, y1] = rect, L = along === 'x' ? x1 - x0 : y1 - y0, Wd = along === 'x' ? y1 - y0 : x1 - x0;
  if (L < 1 || Wd < 0.6) return [];
  const P = (s, o) => (along === 'x' ? [x0 + s, y0 + o] : [x0 + o, y0 + s]);
  // the cuts: at a slab's stride, each its two ends slid apart (one end forward, the other back), the walk's ends square
  // (the walk's own ends cut skewed too, one corner on the end and the other drawn in: no slab square, the sliver left
  // its grout)
  const e = () => Wd * Math.max(skew, 0.15) * (0.35 + 0.65 * R()), e0 = e(), e1 = e();
  const cuts = [R() < 0.5 ? [0, e0] : [e0, 0]];
  for (let s = 1.3 + 0.9 * R(); s < L - 0.9; s += 1.3 + 0.9 * R()) { const d = (R() < 0.5 ? -1 : 1) * Wd * skew * (0.35 + 0.65 * R()); cuts.push([s - d / 2, s + d / 2]); }
  cuts.push(R() < 0.5 ? [L, L - e1] : [L - e1, L]);
  const out = [], g = 0.05;
  let prev = -1;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const [a0, a1] = cuts[k], [b0, b1] = cuts[k + 1];
    let t = Math.floor(R() * SLAB_TINTS.length);
    if (t === prev) t = (t + 1 + Math.floor(R() * (SLAB_TINTS.length - 1))) % SLAB_TINTS.length;
    prev = t;
    const hex = mixHex(base, popHex(SLAB_TINTS[t], 0.4), pop);
    const q = [P(a0, 0), P(b0, 0), P(b1, Wd), P(a1, Wd)], c = q.reduce((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4], [0, 0]);
    // (set in its grout: each corner drawn in toward the slab's middle)
    const ins = q.map(([x, y]) => { const dx = c[0] - x, dy = c[1] - y, l = Math.hypot(dx, dy) || 1, f = Math.min(0.45, g / l * 1.4); return [x + dx * f, y + dy * f]; });
    out.push({ corners: ins.map(([x, y]) => [r5(x), r5(y), r5(z(x, y) + 0.012)]), hex });
  }
  return out;
}

/** Ink splashed on the ground at (x, y): a blob of radius r in triangles from its middle, and its droplets. */
export function groundSplat(x, y, r, z, hex, R) {
  const out = [], n = 16, ph = [R() * 6.28, R() * 6.28, R() * 6.28];
  const rad = (t) => r * (0.78 + 0.16 * Math.sin(3 * t + ph[0]) + 0.1 * Math.sin(5 * t + ph[1]) + 0.08 * Math.sin(8 * t + ph[2]));
  const P = (px, py) => [r5(px), r5(py), r5(z(px, py) + 0.02)];
  const ring = Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return [x + rad(t) * Math.cos(t), y + rad(t) * Math.sin(t)]; });
  for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; out.push({ corners: [P(x, y), P(a[0], a[1]), P(b[0], b[1])], hex }); }
  for (let k = 0; k < 4; k++) {
    const t = R() * 2 * Math.PI, d = r * (1.2 + 0.8 * R()), q = r * (0.1 + 0.12 * R()), cx = x + d * Math.cos(t), cy = y + d * Math.sin(t);
    for (let i = 0; i < 6; i++) { const t0 = (2 * Math.PI * i) / 6, t1 = (2 * Math.PI * (i + 1)) / 6; out.push({ corners: [P(cx, cy), P(cx + q * Math.cos(t0), cy + q * Math.sin(t0)), P(cx + q * Math.cos(t1), cy + q * Math.sin(t1))], hex }); }
  }
  return out;
}

/** Each piece of the furniture its own ink, never the last one of its kind's. */
export function inkPicker(R, pop = 0.85) {
  const last = new Map();
  return (kind) => {
    const pool = INK.filter((h) => h !== last.get(kind)), h = pool[Math.floor(R() * pool.length)];
    last.set(kind, h);
    return popHex(h, pop);
  };
}
