/**
 * RELIEF — an element's face as a height field, in metres, built in layers over its outline. Nothing here is drawn: every
 * mark is a shape the light will find (light.js), so a crack is a groove and a chip a fractured plane, never a stroke.
 *
 *   outline  the face's shape as a signed distance, metres, positive inside: { shape: 'block', w, h, round? }
 *   form     the dressed face: a chamfer at the arrises (`chamfer` m wide, `depth` m), a `pillow` (m of bulge), and the
 *            arris left ragged by `rag` (m)
 *   rough    the face's own unevenness: a tooled undulation (`amp` m at `scale` m) and a fine `grain` (m)
 *   tool     the finish's marks: 'tooled' (parallel drafted ridges, `spacing` m, `angle` degrees, `amp` m) or 'pitched'
 *            (a rock face broken into facets `size` m across, each tilted, `amp` m)
 *   spall    the arrises broken back: `count` fractures, each a curved plane sloping from the face down past the edge
 *            (`size` m along the edge, `depth` m below it); where one falls below `cut` the stone is gone (the outline
 *            follows the break)
 *   groove   cracks: `count` wandering V-grooves (`width`, `depth` m), tapered at both ends, `branch` the chance of a fork
 *   pit      craters: round bowls on a jittered grid (`size` m, `density` 0–1, `depth` as a share of each one's radius)
 *
 * `grit` (0–1) scales what is broken, rough and pitted; the dressed form stays. A layer set to false is absent and adds
 * nothing. All randomness is the seed's: `gnoise2`/`fractal2` (noise/noise.js, integer-exact) and the hash below.
 *
 *   reliefField({ outline, ppm, relief, grit, seed }) → { W, H, px, height: Float32Array, inside: Float32Array }
 *     `inside` is the outline's signed distance at each texel (metres; ≤ 0 outside, including where a spall took it)
 */
import { gnoise2, fractal2, smoothstep } from '../noise/noise.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r6 = (v) => Math.round(v * 1e6) / 1e6;
// an integer hash → [0, 1): the jittered points and each feature's own dice
export function hash01(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** A seeded stream of [0, 1) (mulberry32), for the few features placed once (spalls, cracks). */
export function dice(seed) {
  let a = seed | 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The outline's signed distance, metres, positive inside. */
export function outlineOf(o) {
  const { w, h } = o, q = o.round ?? 0.01;
  return (x, y) => {
    const dx = Math.abs(x - w / 2) - (w / 2 - q), dy = Math.abs(y - h / 2) - (h / 2 - q);
    const ox = dx > 0 ? dx : 0, oy = dy > 0 ? dy : 0;
    return -(Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(dx, dy), 0) - q);
  };
}

// a few points placed once round the outline: [x, y] on edge e (0 top, 1 right, 2 bottom, 3 left) at t along it, with
// the inward normal [nx, ny] and the edge's direction [tx, ty]
function onEdge(w, h, e, t) {
  if (e === 0) return { x: t * w, y: 0, nx: 0, ny: 1, tx: 1, ty: 0 };
  if (e === 1) return { x: w, y: t * h, nx: -1, ny: 0, tx: 0, ty: 1 };
  if (e === 2) return { x: t * w, y: h, nx: 0, ny: -1, tx: 1, ty: 0 };
  return { x: 0, y: t * h, nx: 1, ny: 0, tx: 0, ty: 1 };
}

/** The spalls: each a curved fracture plane at a point on the edge, corners most often. */
function spallsOf(S, w, h, grit, R) {
  const n = Math.round(S.count * (0.25 + 0.75 * grit));
  return Array.from({ length: n }, () => {
    const e = Math.floor(R() * 4) & 3, c = R(), t = c < 0.6 ? (R() < 0.5 ? R() * 0.12 : 1 - R() * 0.12) : 0.15 + R() * 0.7;
    const len = S.size * (0.5 + R()) * (0.5 + 0.5 * grit);
    return { ...onEdge(w, h, e, t), half: len / 2, reach: len * (0.35 + 0.3 * R()), depth: S.depth * (0.6 + 0.8 * R()), seed: Math.floor(R() * 1e6) };
  });
}

/** The cracks: each a polyline wandering in from the edge, the wander a smooth noise (never a jump). */
function cracksOf(G, w, h, grit, R, seed) {
  const n = Math.round(G.count * grit), out = [];
  const one = (x, y, a, len, wid, k) => {
    const pts = [[x, y]], step = 0.012, steps = Math.max(2, Math.round(len / step));
    for (let i = 1; i <= steps; i++) {
      a += gnoise2(i * 0.35, k * 7.1, seed + 31) * 0.55;
      x = r6(x + Math.cos(a) * step); y = r6(y + Math.sin(a) * step);
      pts.push([x, y]);
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    out.push({ pts, wid, box: [Math.min(...xs) - wid, Math.min(...ys) - wid, Math.max(...xs) + wid, Math.max(...ys) + wid] });
    return pts;
  };
  for (let k = 0; k < n; k++) {
    const P = onEdge(w, h, Math.floor(R() * 4) & 3, 0.15 + R() * 0.7);
    const a = Math.atan2(P.ny, P.nx) + (R() - 0.5) * 1.1, len = Math.min(w, h) * (0.6 + R() * 0.9);
    const pts = one(P.x, P.y, a, len, G.width * (0.7 + 0.6 * R()), k);
    if (R() < G.branch) { const at = pts[Math.floor(pts.length * (0.3 + 0.4 * R()))]; one(at[0], at[1], a + (R() < 0.5 ? -0.9 : 0.9), len * (0.3 + 0.3 * R()), G.width * 0.6, k + 50); }
  }
  return out;
}
// the nearest point of a polyline: [distance, share along it]
function nearest(pts, x, y) {
  let best = Infinity, at = 0, run = 0, total = 0;
  for (let i = 1; i < pts.length; i++) { const ex = pts[i][0] - pts[i - 1][0], ey = pts[i][1] - pts[i - 1][1]; total += Math.sqrt(ex * ex + ey * ey); }
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy, seg = Math.sqrt(L2);
    const t = L2 ? clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1) : 0, dx = x - ax - t * vx, dy = y - ay - t * vy, d = Math.sqrt(dx * dx + dy * dy);
    if (d < best) { best = d; at = (run + t * seg) / (total || 1); }
    run += seg;
  }
  return [best, at];
}

/** The nearest jittered point of a grid of `cell` m: [distance, i, j] (Worley F1). */
function worley(x, y, cell, seed) {
  const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
  let best = Infinity, bi = 0, bj = 0;
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    const px = (i + hash01(i, j, seed)) * cell, py = (j + hash01(i, j, seed + 1)) * cell, d = (x - px) * (x - px) + (y - py) * (y - py);
    if (d < best) { best = d; bi = i; bj = j; }
  }
  return [Math.sqrt(best), bi, bj];
}

export function reliefField({ outline, ppm, relief: L, grit, seed }) {
  const { w, h } = outline, W = Math.round(w * ppm), H = Math.round(h * ppm), px = 1 / ppm, sdf = outlineOf(outline);
  const R = dice(seed * 7919 + 13), height = new Float32Array(W * H), inside = new Float32Array(W * H);
  const spalls = L.spall ? spallsOf(L.spall, w, h, grit, R) : [];
  const cracks = L.groove ? cracksOf(L.groove, w, h, grit, R, seed) : [];
  const F = L.form, Rg = L.rough, T = L.tool, P = L.pit;
  const toolA = T && T.kind === 'tooled' ? (T.angle * Math.PI) / 180 : 0, tc = r6(Math.cos(toolA)), ts = r6(Math.sin(toolA));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    let d = sdf(x, y);
    if (F && F.rag) d -= gnoise2(x / 0.03, y / 0.03, seed + 3) * F.rag * (0.3 + 0.7 * grit);
    let z = 0;
    if (F) {
      z += F.depth * smoothstep(0, F.chamfer, d);
      const u = (2 * x) / w - 1, v = (2 * y) / h - 1;
      z += F.pillow * (1 - (u * u + v * v) / 2);
    }
    if (Rg) {
      z += fractal2(x / Rg.scale, y / Rg.scale, { seed: seed + 5, octaves: 4 })[0] * Rg.amp * (0.35 + 0.65 * grit);
      z += fractal2(x / 0.012, y / 0.012, { seed: seed + 7, octaves: 2 })[0] * Rg.grain * (0.25 + 0.75 * grit);
    }
    if (T && T.kind === 'tooled') {
      const ph = (x * tc + y * ts) / T.spacing + gnoise2(x / 0.08, y / 0.08, seed + 9) * 0.35, f = ph - Math.floor(ph);
      z += (Math.abs(f - 0.5) * 2 - 0.5) * T.amp;
    } else if (T && T.kind === 'pitched') {
      const [, ci, cj] = worley(x, y, T.size, seed + 11), cx = (ci + hash01(ci, cj, seed + 11)) * T.size, cy = (cj + hash01(ci, cj, seed + 12)) * T.size;
      const gx = (hash01(ci, cj, seed + 13) - 0.5) * 2, gy = (hash01(ci, cj, seed + 14) - 0.5) * 2;
      z += T.amp * (hash01(ci, cj, seed + 15) - 0.5 + ((x - cx) * gx + (y - cy) * gy) / T.size);
    }
    if (P) {
      const cell = P.size * 2, [pd, pi, pj] = worley(x, y, cell, seed + 17);
      if (hash01(pi, pj, seed + 19) < P.density * grit) {
        const r = cell * (0.12 + 0.28 * hash01(pi, pj, seed + 21));
        if (pd < r) { const q = pd / r; z -= P.depth * r * (1 - q * q); }
      }
    }
    for (const c of cracks) {
      if (x < c.box[0] || x > c.box[2] || y < c.box[1] || y > c.box[3]) continue;
      const [cd, at] = nearest(c.pts, x, y), hw = c.wid * (0.25 + 0.75 * smoothstep(0, 0.25, at) * (1 - smoothstep(0.6, 1, at)));
      if (cd < hw) z -= L.groove.depth * (1 - cd / hw) * (hw / c.wid);
    }
    for (const s of spalls) {
      // inward from the edge, and along it from the spall's centre: the fracture's surface is a curved plane that
      // meets the face a scallop's depth in and falls `depth` below it at the edge
      const din = (x - s.x) * s.nx + (y - s.y) * s.ny, along = (x - s.x) * s.tx + (y - s.y) * s.ty;
      if (din > s.reach * 1.5 || Math.abs(along) > s.half * 1.6) continue;
      // (the scallop's rim wanders, so no two break alike and none is a circle)
      const q = along / s.half, curve = din + s.reach * q * q + gnoise2(along / 0.04, din / 0.04, s.seed + 1) * s.reach * 0.35;
      const zs = -s.depth + (s.depth + (F ? F.depth : 0)) * (curve / s.reach) + gnoise2(x / 0.01, y / 0.01, s.seed) * 0.0012;
      if (zs < z) z = zs;
      if (zs < -L.spall.cut) d = Math.min(d, (zs + L.spall.cut) * 4);   // the stone is gone here: the outline follows
    }
    height[k] = z; inside[k] = d;
  }
  return { W, H, px, height, inside };
}
