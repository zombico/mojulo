/**
 * historic/light — the sun baked once over the whole town, the way the sixth-gen stages bake theirs:
 * a light that is computed at build time and carried by the page, never solved per frame. A box-city
 * panel is one flat colour (it cannot take a per-vertex light), so the bake goes where a panel CAN carry
 * it: one translucent SHADE MAP over the town's ground, laid into every ground face's background at
 * that face's place in the map. One map, so overlapping shadows never darken twice.
 *
 * Two causes of shade, both from the masses alone:
 *  - the SUN: every mass stands in an occluder heightfield (a convex solid is sliced, so a battered
 *    wall or a ziggurat's tiers throw their true stepped profile); one sweep along the sun's azimuth
 *    carries the shadow's ceiling from pixel to pixel, falling at the sun's elevation, and a pixel whose
 *    ground lies under that ceiling is in shade. Palm crowns float: each is a gappy disc cast from its
 *    height, its shade thinner than a wall's.
 *  - the SKY: ground hemmed in by walls sees less of the sky. A coarse horizon scan in eight directions
 *    darkens the foot of every wall and the floor of every narrow lane (the era's baked AO).
 * The shade is a COLOUR, never black: the style card's cool shade tint, laid at its alpha, so a lane in
 * shadow reads as the sky's blue on earth, not as a hole.
 *
 * The CSS 3D page only; the WebGL World keeps its own light (the World ignores `bg`). Plans in metres,
 * faces in scene units. Pure and deterministic: no dice, no clock.
 */
import { partCorners } from './assets/blueprint.js';
import { encodeRgba } from './ground.js';

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const smooth = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** The defaults a style card's `light` overrides. */
export const SHADE_DEFAULTS = Object.freeze({
  shade: Object.freeze({ color: '#46557a', alpha: 0.5, soft: 0.3 }),   // the shadow's tint and its strength; `soft` m of ceiling over the ground fades it in
  ao: Object.freeze({ radius: 6, alpha: 0.3 }),                          // sky occlusion: horizon scanned `radius` m out
  palm: Object.freeze({ alpha: 0.55, reach: 0.42 }),                     // a crown's shade (the fronds are gappy) and its radius as a share of the palm's height
  maxPx: 2048,                                                            // the map's long side
});

// ── geometry: convex hulls and polygon rasterising on the bake grid ──
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && crossZ(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && crossZ(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/** Visit every grid pixel whose centre lies in polygon `poly` (metres). */
function fillPoly(G, poly, visit) {
  if (poly.length < 3) return;
  const { res, nx, ny } = G;
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y] of poly) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const j0 = Math.max(0, Math.ceil(y0 / res - 0.5)), j1 = Math.min(ny - 1, Math.floor(y1 / res - 0.5));
  for (let j = j0; j <= j1; j++) {
    const yc = (j + 0.5) * res, xs = [];
    for (let k = 0; k < poly.length; k++) {
      const [ax, ay] = poly[k], [bx, by] = poly[(k + 1) % poly.length];
      if ((ay > yc) !== (by > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / res - 0.5)), i1 = Math.min(nx - 1, Math.floor(xs[k + 1] / res - 0.5));
      for (let i = i0; i <= i1; i++) visit(j * nx + i);
    }
  }
}
const rectPoly = ({ x, y, w, d }) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];

/** A convex point set's section at height z: the hull of every corner pair's crossing of the plane. */
function section(pts, z) {
  const out = [];
  for (let a = 0; a < pts.length; a++) {
    const p = pts[a];
    if (Math.abs(p[2] - z) < 1e-9) out.push([p[0], p[1]]);
    for (let b = a + 1; b < pts.length; b++) {
      const q = pts[b];
      if ((p[2] - z) * (q[2] - z) < 0) { const t = (z - p[2]) / (q[2] - p[2]); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
  }
  return hull(out);
}

/**
 * Stand every mass in the occluder heightfield `top` (the highest solid point over each pixel).
 * Plain boxes are columns; convex solids are sliced every half metre so their slopes step true.
 * Palms are left out (their crowns float — see `palmCrowns`), and so are panels (reliefs on a wall).
 */
function standMasses(G, masses) {
  const { top } = G, raise = (z) => (k) => { if (top[k] < z) top[k] = z; };
  for (const b of masses) {
    if (b.solid === 'palm' || b.solid === 'panel' || !(b.z1 > b.z0)) continue;
    if (!b.solid) { fillPoly(G, rectPoly(b), raise(b.z1)); continue; }
    const pts = partCorners(b);
    let z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    const n = Math.max(1, Math.min(64, Math.ceil((z1 - z0) / 0.5))), dz = (z1 - z0) / n;
    for (let k = 0; k < n; k++) fillPoly(G, section(pts, z0 + (k + 0.5) * dz), raise(z0 + (k + 1) * dz));
  }
}

/** The ground each pixel shows (the last ground laid over it wins, as the page draws them). */
function layGrounds(G, grounds) {
  for (const g of grounds) {
    const z = g.z ?? 0, set = (k) => { G.recv[k] = z; };
    fillPoly(G, g.poly ? g.poly : rectPoly(g), set);
  }
}

/** Sweep the sun's shadow ceiling across the grid: S = max(top, S at the sunward neighbour − its fall). */
function sweepSun(G, toSun, tanE) {
  const { nx, ny, res, top } = G, S = new Float32Array(nx * ny).fill(-1e9);
  const [sx, sy] = toSun, alongX = Math.abs(sx) >= Math.abs(sy);
  const major = alongX ? sx : sy, minor = alongX ? sy : sx, step = Math.sign(major), slope = minor / Math.abs(major);
  const fall = res * Math.hypot(1, slope) * tanE, N1 = alongX ? nx : ny, N2 = alongX ? ny : nx;
  const idx = alongX ? (a, b) => b * nx + a : (a, b) => a * nx + b;
  // the sunward pixel is processed first: walk the major axis away from the sun
  for (let c = 0; c < N1; c++) {
    const a = step < 0 ? c : N1 - 1 - c, pa = a + step;
    for (let b = 0; b < N2; b++) {
      let prev = -1e9;
      if (pa >= 0 && pa < N1) {
        const pb = b + slope, b0 = Math.floor(pb), t = pb - b0;
        const v0 = b0 >= 0 && b0 < N2 ? S[idx(pa, b0)] : -1e9, v1 = b0 + 1 >= 0 && b0 + 1 < N2 ? S[idx(pa, b0 + 1)] : -1e9;
        prev = Math.max(v0, v1) <= -1e8 ? -1e9 : (v0 <= -1e8 ? v1 : v1 <= -1e8 ? v0 : v0 * (1 - t) + v1 * t);
      }
      const k = idx(a, b);
      S[k] = Math.max(top[k], prev - fall);
    }
  }
  return S;
}

/** Sky occlusion on a coarse grid: the mean, over eight directions, of the sine of the highest horizon. */
function skyOcclusion(G, radius) {
  const f = Math.max(1, Math.round(Math.max(0.5, G.res * 2) / G.res)), cx = Math.ceil(G.nx / f), cy = Math.ceil(G.ny / f), cres = G.res * f;
  const top = new Float32Array(cx * cy).fill(-1e9), recv = new Float32Array(cx * cy);
  for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
    const k = ((j / f) | 0) * cx + ((i / f) | 0), v = G.top[j * G.nx + i];
    if (v > top[k]) top[k] = v;
    if (i % f === 0 && j % f === 0) recv[k] = G.recv[j * G.nx + i];
  }
  const dirs = Array.from({ length: 8 }, (_, a) => [Math.cos((a * Math.PI) / 4), Math.sin((a * Math.PI) / 4)]);
  const K = Math.max(1, Math.ceil(radius / cres)), ao = new Float32Array(cx * cy);
  for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    const z = recv[j * cx + i];
    if (top[j * cx + i] > z + 0.05) continue;   // under a mass: unseen
    let sum = 0;
    for (const [dx, dy] of dirs) {
      let best = 0;
      for (let s = 1; s <= K; s++) {
        const qi = Math.round(i + dx * s), qj = Math.round(j + dy * s);
        if (qi < 0 || qj < 0 || qi >= cx || qj >= cy) break;
        const t = (top[qj * cx + qi] - z) / (s * cres * Math.hypot(dx, dy));
        if (t > best) best = t;
      }
      sum += best / Math.hypot(1, best);
    }
    ao[j * cx + i] = sum / dirs.length;
  }
  // bilinear back onto the bake grid
  return (i, j) => {
    const u = (i + 0.5) / f - 0.5, v = (j + 0.5) / f - 0.5, i0 = Math.max(0, Math.min(cx - 1, Math.floor(u))), j0 = Math.max(0, Math.min(cy - 1, Math.floor(v)));
    const i1 = Math.min(cx - 1, i0 + 1), j1 = Math.min(cy - 1, j0 + 1), tu = Math.max(0, Math.min(1, u - i0)), tv = Math.max(0, Math.min(1, v - j0));
    const a = ao[j0 * cx + i0] * (1 - tu) + ao[j0 * cx + i1] * tu, b = ao[j1 * cx + i0] * (1 - tu) + ao[j1 * cx + i1] * tu;
    return a * (1 - tv) + b * tv;
  };
}

/** Each palm's crown, cast as a soft disc from its height onto the ground under it. */
function palmCrowns(G, masses, offset, P) {
  const shade = new Float32Array(G.nx * G.ny);
  for (const b of masses) {
    if (b.solid !== 'palm') continue;
    const H = b.z1 - b.z0, [lx, ly] = (b.lean || [0, 0]).map((v) => v * H), R = P.reach * H;
    const cx = b.x + b.w / 2 + lx, cy = b.y + b.d / 2 + ly;
    // where the crown's shadow lands on the ground under the trunk's foot
    const ground = G.recv[Math.min(G.ny - 1, Math.max(0, Math.floor((b.y + b.d / 2) / G.res))) * G.nx + Math.min(G.nx - 1, Math.max(0, Math.floor((b.x + b.w / 2) / G.res)))];
    const h = b.z1 - ground, sx = cx + offset[0] * h, sy = cy + offset[1] * h, n = 20;
    const disc = Array.from({ length: n }, (_, i) => [sx + Math.cos((i / n) * 6.2832) * R, sy + Math.sin((i / n) * 6.2832) * R]);
    fillPoly(G, disc, (k) => {
      const i = k % G.nx, j = (k / G.nx) | 0, r = Math.hypot((i + 0.5) * G.res - sx, (j + 0.5) * G.res - sy) / R;
      const fronds = 0.75 + 0.25 * Math.cos(Math.atan2((j + 0.5) * G.res - sy, (i + 0.5) * G.res - sx) * 11);   // the gaps between fronds
      shade[k] = Math.max(shade[k], P.alpha * fronds * (1 - smooth(0.55, 1, r)));
    });
    // and the trunk's thin line from the foot toward the crown's shadow
    const fx = b.x + b.w / 2, fy = b.y + b.d / 2, wdt = Math.min(b.w, b.d) * 0.3;
    const nxp = -(sy - fy), nyp = sx - fx, nl = Math.hypot(nxp, nyp) || 1;
    fillPoly(G, [[fx + (nxp / nl) * wdt, fy + (nyp / nl) * wdt], [sx + (nxp / nl) * wdt, sy + (nyp / nl) * wdt], [sx - (nxp / nl) * wdt, sy - (nyp / nl) * wdt], [fx - (nxp / nl) * wdt, fy - (nyp / nl) * wdt]], (k) => { shade[k] = Math.max(shade[k], 0.9); });
  }
  return shade;
}

const SHADES = new Map();   // key → data URL, for the page's CSS

/**
 * Bake a plan's shade map. `frame` { w, d } metres (the plan's), `masses` and `grounds` the plan's own
 * (metres), `light` the scene light (its `dir` is the sun's travel), `card` a style card's `light`.
 * Returns { key, url, res, nx, ny, w, d, … } and samplers that read the bake back for checks: alpha(x, y),
 * sun(x, y) and ao(x, y) in 0–1, open(x, y) 1 where the ground is not under a mass.
 */
export function bakeShade({ frame, masses, grounds }, light, card = {}) {
  const C = { ...SHADE_DEFAULTS, ...card, shade: { ...SHADE_DEFAULTS.shade, ...card.shade }, ao: { ...SHADE_DEFAULTS.ao, ...card.ao }, palm: { ...SHADE_DEFAULTS.palm, ...card.palm } };
  const res = Math.max(0.25, Math.max(frame.w, frame.d) / C.maxPx), nx = Math.ceil(frame.w / res), ny = Math.ceil(frame.d / res);
  const G = { res, nx, ny, top: new Float32Array(nx * ny).fill(-1e9), recv: new Float32Array(nx * ny) };
  layGrounds(G, grounds);
  standMasses(G, masses);
  const d = light.dir, hl = Math.hypot(d[0], d[1]) || 1e-9, tanE = -d[2] / hl, toSun = [-d[0] / hl, -d[1] / hl];
  const S = sweepSun(G, toSun, tanE), aoAt = skyOcclusion(G, C.ao.radius);
  const crowns = palmCrowns(G, masses, [d[0] / -d[2], d[1] / -d[2]], C.palm);
  const sun = new Float32Array(nx * ny), ao = new Float32Array(nx * ny), alpha = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, over = S[k] - G.recv[k];
    sun[k] = Math.max(smooth(0.02, 0.02 + C.shade.soft, over), crowns[k]);
    ao[k] = aoAt(i, j);
    alpha[k] = 1 - (1 - sun[k] * C.shade.alpha) * (1 - ao[k] * C.ao.alpha);
  }
  const [r, g, b] = hexRgb(C.shade.color), px = Buffer.alloc(nx * ny * 4);
  // alpha in 64 steps: a quarter-step of shade is below what the eye parts on earth, and the map packs to a third
  for (let k = 0; k < nx * ny; k++) { px[k * 4] = r; px[k * 4 + 1] = g; px[k * 4 + 2] = b; px[k * 4 + 3] = Math.min(255, Math.round(Math.min(1, alpha[k]) * 63) * 4); }
  const url = `data:image/png;base64,${encodeRgba(px, nx, ny).toString('base64')}`;
  let h = 2166136261; for (let i = 0; i < url.length; i += 7) h = Math.imul(h ^ url.charCodeAt(i), 16777619);
  const key = `historic-shade-${(h >>> 0).toString(36)}`;
  SHADES.set(key, url);
  const at = (A) => (x, y) => A[Math.min(ny - 1, Math.max(0, Math.floor(y / res))) * nx + Math.min(nx - 1, Math.max(0, Math.floor(x / res)))];
  const open = new Uint8Array(nx * ny); for (let k = 0; k < nx * ny; k++) open[k] = G.top[k] <= G.recv[k] + 0.05 ? 1 : 0;
  return { key, url, res, nx, ny, w: nx * res, d: ny * res, color: C.shade.color, shadeAlpha: C.shade.alpha, aoAlpha: C.ao.alpha, alpha: at(alpha), sun: at(sun), ao: at(ao), open: at(open) };
}

/**
 * The background layer that lays the shade map over a ground face whose local origin is world point
 * (x, y) metres and whose local axes run +x, +y. `s` scene units per metre, `us` px per scene unit.
 */
export function shadeLayer(shade, x, y, s, us) {
  const k = s * us;
  return `var(--${shade.key}) ${(-x * k).toFixed(2)}px ${(-y * k).toFixed(2)}px / ${(shade.w * k).toFixed(2)}px ${(shade.d * k).toFixed(2)}px no-repeat`;
}

/** The page-level CSS defining every shade map the faces reference. */
export function shadeCss(faces) {
  const keys = [...new Set(faces.filter((f) => f.shade).map((f) => f.shade))].sort();
  return keys.length ? `  :root{${keys.map((k) => `--${k}:url('${SHADES.get(k)}')`).join(';')}}\n` : '';
}
