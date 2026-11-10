/**
 * THE FAR VIEW — a zone's page (zones.js) seeing the rest of its map: every tile the page does not build laid as greybox
 * on the level's one land (era/out-tile.js levelHeight, the same land its own tiles stand on, its approved sketch's heights
 * lowered: map-sketch.js levelGrid), so the ground runs on past the apron to the map's edge and what stands far off reads
 * on the horizon: its ground tinted by the sketch (a forest darker, rocks grey, scrub dry), a wood's trees as cones, a
 * cliff's slabs, water, and its places as blocks (the walk's goal taller). Never walked: the zone's walls stand inside it.
 *
 *   farFaces(G, Z, { seed, ground }) → [face]   G levelGrid's read, Z zoneOf's, `ground` the land's own fill
 *
 * Every face `map:far:*`; the land `map:far:ground` (the page's rim reads its height at the map's edge). Pure: a tile's
 * features where a hash of its place puts them, never dice.
 */
import { levelHeight } from '../era/out-tile.js';

export const FAR = Object.freeze({ k: 4, trees: { f: 7, g: 3 }, place: { h: 8, goal: 22 } });
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const mix = (a, b, t) => '#' + [0, 2, 4].map((k) => Math.round(parseInt(a.slice(1 + k, 3 + k), 16) * (1 - t) + parseInt(b.slice(1 + k, 3 + k), 16) * t).toString(16).padStart(2, '0')).join('');
const TINT = Object.freeze({ f: ['#3f5f37', 0.55], g: ['#557a44', 0.4], m: ['#9cbf68', 0.25], r: ['#9a958a', 0.55], s: ['#b9a874', 0.5], c: ['#7d7366', 0.7], w: ['#4f7fa6', 0.85] });
const hash = (r, c, n) => { let h = Math.imul(r + 101, 73856093) ^ Math.imul(c + 7, 19349663) ^ Math.imul(n + 3, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function quad(a, b, c, d, fill, group) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], L = Math.hypot(...n) || 1;
  return { corners: [a, b, c, d].map((p) => p.map(r3)), normal: n.map((x) => r3(x / L)), fill, group };
}
function block(x, y, z0, w, d, h, fill, group) {
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2, z1 = z0 + h;
  return [quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], fill, group), quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], fill, group),
    quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], fill, group), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], fill, group), quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], fill, group)];
}
// a tree far off: four faces round a point, its foot on the land
function cone(x, y, z0, r, h, fill) {
  const top = [x, y, z0 + h], pts = [[x + r, y], [x, y + r], [x - r, y], [x, y - r]];
  return pts.map((p, i) => { const q = pts[(i + 1) % 4]; return quad([p[0], p[1], z0], [q[0], q[1], z0], top, top, fill, 'map:far:tree'); });
}

/** The tiles the page does not build, laid far off. */
export function farFaces(G, Z, { seed = 1, ground = '#7aa04a' } = {}) {
  const T = G.tile, k = FAR.k, step = T / k, L = { seed, ...(G.rise ? { rise: G.rise } : {}) }, land = (x, y) => levelHeight(x, y, L), out = [];
  const sketched = G.sketch?.ground ?? new Map();
  for (const x of G.cells) {
    if (Z.built.has(`${x.r},${x.c}`)) continue;
    const X0 = x.c * T, Y1 = -x.r * T, g = sketched.get(`${x.r},${x.c}`) ?? (x.water ? 'w' : null);   // (a grid's `~` is water as a sketch's `w` is)
    const fill = g && TINT[g] ? mix(ground, TINT[g][0], TINT[g][1]) : x.kind === 'path' ? mix(ground, '#cdb98f', 0.35) : ground;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
      const a = X0 + i * step, b = Y1 - (j + 1) * step, c = [[a, b], [a + step, b], [a + step, b + step], [a, b + step]].map(([px, py]) => [px, py, land(px, py)]);
      out.push(quad(c[0], c[1], c[2], c[3], fill, 'map:far:ground'));
    }
    const at = (n) => [X0 + T * (0.15 + 0.7 * hash(x.r, x.c, n)), Y1 - T * (0.15 + 0.7 * hash(x.r, x.c, n + 40))];
    if (g === 'f' || g === 'g') for (let n = 0; n < FAR.trees[g]; n++) { const [px, py] = at(n); out.push(...cone(px, py, land(px, py) - 0.5, 2.5 + 1.5 * hash(x.r, x.c, n + 80), 9 + 6 * hash(x.r, x.c, n + 90), g === 'f' ? '#2f4a2c' : '#3e5f34')); }
    if (g === 'c') for (let n = 0; n < 3; n++) { const [px, py] = at(n); out.push(...block(px, py, land(px, py) - 1, 7, 5, 10 + 6 * hash(x.r, x.c, n + 80), '#6f655a', 'map:far:cliff')); }
    if (g === 'r') for (let n = 0; n < 4; n++) { const [px, py] = at(n); out.push(...block(px, py, land(px, py) - 0.4, 2.5, 2, 1.8, '#8d887c', 'map:far:rock')); }
    if (g === 'w') { const z = Math.min(land(X0 + 3, Y1 - 3), land(X0 + T - 3, Y1 - T + 3)) + 0.3; out.push(quad([X0 + 3, Y1 - T + 3, z], [X0 + T - 3, Y1 - T + 3, z], [X0 + T - 3, Y1 - 3, z], [X0 + 3, Y1 - 3, z], '#4f7fa6', 'map:far:water')); }
    if (x.kind === 'place') {
      const goal = !!x.place?.goal, cx = X0 + T / 2, cy = Y1 - T / 2, w = T * 0.45;
      out.push(...block(cx, cy, land(cx, cy) - 0.5, w, w, goal ? FAR.place.goal : FAR.place.h, goal ? '#8a7ba0' : '#a08a74', 'map:far:place'));
    }
  }
  return out;
}
