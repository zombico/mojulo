/**
 * Face helpers shared by the stage and its kits: vectors, the cell-split PANEL every surface is made of, boxes laid
 * against a wall, a general textured QUAD, and the wall frame a kit composes along. Pure; positions rounded to 1e-5 so
 * a re-render is byte-identical.
 */
// ── vectors ──────────────────────────────────────────────────────────────────
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
export const P = (p) => p.map(r5);
export const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const rgbHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('')}`;

// ── face emission ────────────────────────────────────────────────────────────
// A WALL frame for room r and side s: origin at the wall's left end (seen from inside), U along it,
// N pointing into the room. Positions on the wall are (u along, z up).
export function wallFrame(r, s) {
  if (s === '-y') return { o: [r.x0, r.y0, 0], U: [1, 0, 0], N: [0, 1, 0], len: r.x1 - r.x0, coord: (p) => p[0], start: r.x0 };
  if (s === '+y') return { o: [r.x1, r.y1, 0], U: [-1, 0, 0], N: [0, -1, 0], len: r.x1 - r.x0, coord: (p) => p[0], start: r.x1 };
  if (s === '-x') return { o: [r.x0, r.y1, 0], U: [0, -1, 0], N: [1, 0, 0], len: r.y1 - r.y0, coord: (p) => p[1], start: r.y1 };
  return { o: [r.x1, r.y0, 0], U: [0, 1, 0], N: [-1, 0, 0], len: r.y1 - r.y0, coord: (p) => p[1], start: r.y0 };
}
// an opening in world coordinates → [u0, u1] along a wall frame
export const openingU = (F, op) => { const a = (op.lo - F.start) * (F.U[0] + F.U[1]), b = (op.hi - F.start) * (F.U[0] + F.U[1]); return [Math.min(a, b), Math.max(a, b)]; };

/**
 * A planar PANEL split into ≤cell squares: origin o, axes A (width a) and B (height b), facing n.
 * uv is projected from world position on the plane's own axes, so tiles run on unbroken across
 * neighbouring kit pieces in one plane.
 */
export function panel(out, o, A, a, B, b, n, surf, cell) {
  if (a <= 1e-6 || b <= 1e-6) return;
  const na = Math.max(1, Math.ceil(a / cell - 1e-9)), nb = Math.max(1, Math.ceil(b / cell - 1e-9));
  const uvOf = surf.uvOf ? (p) => surf.uvOf(p).map(r5)
    : surf.turn ? (p) => [r5(dot(p, B) / surf.scale), r5(dot(p, A) / surf.scale)]
      : (p) => [r5(dot(p, A) / surf.scale), r5(dot(p, B) / surf.scale)];
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
    const u0 = (a * i) / na, u1 = (a * (i + 1)) / na, v0 = (b * j) / nb, v1 = (b * (j + 1)) / nb;
    const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => P(add(o, add(mul(A, u), mul(B, v)))));
    const key = surf.cellKey ? surf.cellKey(corners) : surf.key;
    out.push({ corners, normal: n, outNormal: n, texture: key, textureLit: true, uv: corners.map(uvOf), tint: surf.tint, group: surf.group });
  }
}
/** The visible faces of an axis-aligned box (min, max), skipping the sides in `omit` ('-x', '+z', …). */
export function box(out, mn, mx, surf, cell, omit = []) {
  const [x0, y0, z0] = mn, [x1, y1, z1] = mx, w = x1 - x0, d = y1 - y0, h = z1 - z0;
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  if (!omit.includes('-y')) panel(out, [x0, y0, z0], X, w, Z, h, [0, -1, 0], surf, cell);
  if (!omit.includes('+y')) panel(out, [x0, y1, z0], X, w, Z, h, [0, 1, 0], surf, cell);
  if (!omit.includes('-x')) panel(out, [x0, y0, z0], Y, d, Z, h, [-1, 0, 0], surf, cell);
  if (!omit.includes('+x')) panel(out, [x1, y0, z0], Y, d, Z, h, [1, 0, 0], surf, cell);
  if (!omit.includes('-z')) panel(out, [x0, y0, z0], X, w, Y, d, [0, 0, -1], surf, cell);
  if (!omit.includes('+z')) panel(out, [x0, y0, z1], X, w, Y, d, [0, 0, 1], surf, cell);
}
/** A box laid against wall F: u ∈ [u0,u1] along it, z ∈ [z0,z1], standing `out` proud into the room. */
export function wallBox(out, F, u0, u1, z0, z1, depth, surf, cell, omitEnds = false) {
  const p0 = add(F.o, mul(F.U, u0)), p1 = add(add(F.o, mul(F.U, u1)), mul(F.N, depth));
  const mn = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), z0], mx = [Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), z1];
  // never draw the face pressed into the wall; ends are dropped when the run meets a corner
  const back = F.N[0] > 0 ? '-x' : F.N[0] < 0 ? '+x' : F.N[1] > 0 ? '-y' : '+y';
  const ends = omitEnds ? (F.U[0] ? ['-x', '+x'] : ['-y', '+y']) : [];
  box(out, mn, mx, surf, cell, [back, ...ends]);
}
// spans of [0,len] left after cutting the openings (each widened by `pad`)
export function solidSpans(len, cuts, pad = 0) {
  const spans = []; let at = 0;
  for (const [a, b] of cuts) { if (a - pad > at) spans.push([at, a - pad]); at = Math.max(at, b + pad); }
  if (len > at) spans.push([at, len]);
  return spans;
}

/** One textured quad (4 corners, any shape) facing n; uv given, or from surf.uvOf, or projected on the plane axes A, B. */
export function quad(out, corners, n, surf, A, B, uvs = null) {
  const cs = corners.map(P);
  const uv = uvs ? uvs.map((q) => q.map(r5)) : cs.map((p) => (surf.uvOf ? surf.uvOf(p) : [dot(p, A) / surf.scale, dot(p, B) / surf.scale]).map(r5));
  out.push({ corners: cs, normal: n.map(r5), outNormal: n.map(r5), texture: surf.key, textureLit: true, uv, tint: surf.tint, group: surf.group });
}
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unitV = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/**
 * One painted CARD (a cutout: leaf-cards.js): a quad on `base` (its bottom centre) spanning `w` along `along` and `h`
 * along `up`, wearing card `key` (uv 0..1, v up), tinted. `vTiles` repeats the card up its height (a vine strip).
 */
export function card(out, base, along, up, w, h, key, tint, group, vTiles = 1) {
  const a = along.map((v) => (v * w) / 2), u = up.map((v) => v * h);
  const cs = [sub(base, a), add(base, a), add(add(base, a), u), add(sub(base, a), u)].map(P);
  const n = unitV(crossV(along, up)).map(r5);
  out.push({ corners: cs, normal: n, outNormal: n, texture: key, textureLit: true, uv: [[0, 0], [1, 0], [1, vTiles], [0, vTiles]].map((q) => q.map(r5)), tint: tint.map(r5), group, doubleSided: true });
}
/** Cards crossed about a vertical axis (the era's plant): two at right angles, or `n` evenly round. */
export function crossed(out, base, yaw, w, h, key, tint, group, n = 2) {
  for (let k = 0; k < n; k++) { const a = yaw + (k * Math.PI) / n; card(out, base, [Math.cos(a), Math.sin(a), 0], [0, 0, 1], w, h, key, tint, group); }
}
/** A point on wall frame F: u along it, `off` out into the room, z up. */
export const onWall = (F, u, off, z) => add(add(add(F.o, mul(F.U, u)), mul(F.N, off)), [0, 0, z]);
