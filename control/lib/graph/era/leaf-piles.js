/**
 * LEAF PILES — a tree's fallen leaves in the fall (a biocube's `flora.autumn`), heaped by the wind: the litter round its
 * foot (scene/channels/form-flora.js LITTER) lies flat, and these are where its leaves gather deep. Each pile is the room's
 * heap again (era/skandart.js): a body over the ground at its matter's repose, here loose dry leaves (LEAF_PILES.repose),
 * cut where it meets the ground; the leaves on it are drawn by the page, the tree's own outline in its own turned colour.
 * Leaves blown along the ground are stopped by what stands in the wind, so they bank against its WINDWARD face:
 *
 *   foot   against the windward side of the tree's own trunk, its leaves that fell upwind of it
 *   bank   against the windward face of the nearest rock downwind of the tree, within its reach
 *   heap   a loose mound blown out past its crown, downwind, where an eddy let it go (not every tree's)
 *
 * Each a bell over its footprint (its toe easing onto the ground), lumped, no steeper than the leaves stand; its height
 * by how far into the fall (`autumn`), a bank's never past half what it leans on. None on the walk, none in a rock (a
 * bank only leans on its own), none lower than the eye spot (`read`, skandartRead), none on another tree's.
 *
 *   LEAF_PILES                          the numbers
 *   leafPiles(site, { autumn, wind, trees, rocks, read, seed }) → { piles: [{ tree, role, at, H, faces }], laws }
 *     trees  [{ x, y, r, crown }]: each tree's foot, its trunk's radius and its crown's (`tree` a pile's index into them)
 *     rocks  [{ x, y, r, h }]: what stands on the land
 *     wind   degrees the wind blows toward, from +x toward +y (vegetation/wind.js `dir`)
 *   faces `{ corners, normal, matter: 'leaves' }` laid on the land (each corner over the ground under it).
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { cellFaces, skandartRead } from './skandart.js';

export const LEAF_PILES = Object.freeze({
  // dry leaves loose on the ground stand steeper than sand, shallower than gravel (degrees)
  repose: 34,
  // each role's height (m) at the fall's start and at its end, and a bank's most as a share of what it leans on
  heights: Object.freeze({ foot: Object.freeze([0.1, 0.32]), bank: Object.freeze([0.16, 0.5]), heap: Object.freeze([0.14, 0.4]) }), lean: 0.5,
  // a bell's half-length (along the wind) at least this many times its height, so its steepest face stays under its repose
  spread: 3,
  // how far downwind a tree's leaves reach (× its crown's radius) and the share of trees whose leaves leave a heap (at
  // the fall's end; a third of it at its start)
  reach: 3, heap: 0.6,
  // the grid its surface is cut on (m), the walk's margin (m), the farthest from the walk a pile lies (m)
  cell: 0.26, walk: 0.35, far: 30,
});

const tanD = (deg) => Math.tan((deg * Math.PI) / 180);
const lerp = (a, b, t) => a + (b - a) * t;
const r5n = (v) => r5(v) + 0;
const area = (f) => { const n = [0, 0, 0], c = f.corners; c.forEach((P, k) => { const Q = c[(k + 1) % c.length]; n[0] += (P[1] - Q[1]) * (P[2] + Q[2]); n[1] += (P[2] - Q[2]) * (P[0] + Q[0]); n[2] += (P[0] - Q[0]) * (P[1] + Q[1]); }); return Math.hypot(...n) / 2; };

/** A pile's body: a bell of height H over an ellipse a (along the wind) by b (across), lumped by its dice. */
function bell(H, a, b, seed) {
  const p1 = hash3(seed, 1, 8301) * 6.28, p2 = hash3(seed, 2, 8303) * 6.28;
  return (u, v) => {
    const q = 1 - (u / a) ** 2 - (v / b) ** 2;
    if (q <= 0) return -0.02;
    const t = Math.atan2(v / b, u / a);
    return H * q * q * (1 + 0.07 * Math.sin(t * 3 + p1) + 0.05 * Math.sin(t * 5 + p2));
  };
}

export function leafPiles(site, { autumn, wind = 0, trees = [], rocks = [], read = skandartRead(), seed = 1 }) {
  const A = LEAF_PILES, ang = (wind * Math.PI) / 180, du = [Math.cos(ang), Math.sin(ang)], dv = [-du[1], du[0]];
  const onWalk = (x, y, r) => site.trailDist(x, y) < site.halfWAt(y) + A.walk + r;
  const piles = [], laws = [], row = (law, what, ok) => laws.push({ law, what, ok: !!ok }), banked = new Set();
  const lay = (ti, role, cx, cy, H, a, b, lean = null) => {
    // (on the walk, in a rock it does not lean on, or on another pile: not laid)
    if (H < read.least || onWalk(cx, cy, Math.max(a, b))) return;
    if (rocks.some((q, k) => k !== lean && Math.hypot(q.x - cx, q.y - cy) < q.r + Math.min(a, b) * 0.6)) return;
    if (piles.some((p) => Math.hypot(p.at[0] - cx, p.at[1] - cy) < (p.reach + Math.max(a, b)) * 0.8)) return;
    const top = bell(H, a, b, seed * 7 + ti * 13 + piles.length), lines = (lo, hi) => { const n = Math.max(2, Math.ceil((hi - lo) / A.cell)); return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n); };
    const local = cellFaces(top, () => 0, lines(-a, a), lines(-b, b), 'leaves');
    if (!local.length) return;
    const faces = local.map((f) => ({
      corners: f.corners.map(([u, v, z]) => { const X = cx + du[0] * u + dv[0] * v, Y = cy + du[1] * u + dv[1] * v; return [r5n(X), r5n(Y), r5n(site.ground(X, Y) + z)]; }),
      normal: [r5n(du[0] * f.normal[0] + dv[0] * f.normal[1]), r5n(du[1] * f.normal[0] + dv[1] * f.normal[1]), f.normal[2]], matter: 'leaves',
    }));
    piles.push({ tree: ti, role, at: [r5n(cx), r5n(cy)], H: r5n(H), reach: Math.max(a, b), faces });
    const steep = Math.max(0, ...local.filter((f) => area(f) >= 0.002).map((f) => (Math.acos(Math.min(1, f.normal[2])) * 180) / Math.PI));
    const id = `tree ${ti}'s ${role}`;
    row('repose', `${id}: its steepest face ${Math.round(steep)}° (dry leaves stand at ${A.repose}°)`, steep <= A.repose + 2);
    row('too-small-to-read', `${id}: ${r5n(H)} m high (the eye spot ${r5(read.least)} m)`, H >= read.least);
  };
  const near = trees.map((t, i) => ({ ...t, i })).filter((t) => site.trailDist(t.x, t.y) <= A.far);
  for (const t of near) {
    const h = (k) => hash3(seed, t.i, k), at = (u, v) => [t.x + du[0] * u + dv[0] * v, t.y + du[1] * u + dv[1] * v];
    // FOOT: against the trunk's windward side, longer across the wind than along it
    {
      const H = lerp(...A.heights.foot, autumn) * (0.85 + 0.3 * h(8311)), a = Math.max(A.spread * H, 0.45), b = Math.max(a * 1.4, t.crown * 0.45);
      lay(t.i, 'foot', ...at(-(t.r + a * 0.45), (h(8313) - 0.5) * t.r), H, a, b);
    }
    // BANK: against the windward face of the nearest rock downwind, within the leaves' reach
    let best = -1, bu = Infinity;
    rocks.forEach((q, k) => { const px = q.x - t.x, py = q.y - t.y, u = px * du[0] + py * du[1], v = px * dv[0] + py * dv[1]; if (u > t.r && u < A.reach * t.crown + q.r && Math.abs(v) < q.r + t.crown * 0.8 && u < bu && !banked.has(k)) { best = k; bu = u; } });
    if (best >= 0) {
      const q = rocks[best], H = Math.min(q.h * A.lean, lerp(...A.heights.bank, autumn) * (0.85 + 0.3 * h(8315))), a = Math.max(A.spread * H, 0.5), b = Math.max(q.r * 1.25, a);
      const n0 = piles.length;
      lay(t.i, 'bank', q.x - du[0] * (q.r * 0.75 + a * 0.3), q.y - du[1] * (q.r * 0.75 + a * 0.3), H, a, b, best);
      if (piles.length > n0) banked.add(best);
    }
    // HEAP: blown out past the crown, downwind, where an eddy let it go
    if (h(8317) < A.heap * lerp(1 / 3, 1, autumn)) {
      const H = lerp(...A.heights.heap, autumn) * (0.85 + 0.3 * h(8319)), a = Math.max(A.spread * H, 0.5) * (1 + 0.3 * h(8321));
      lay(t.i, 'heap', ...at(t.crown * lerp(1.2, 2, h(8323)), (h(8325) - 0.5) * t.crown * 1.2), H, a, a * lerp(0.9, 1.3, h(8327)));
    }
  }
  for (const p of piles) row('off-the-walk', `tree ${p.tree}'s ${p.role} at ${p.at.join(', ')}: off the walk`, !onWalk(p.at[0], p.at[1], p.reach));
  row('placed', `${piles.length} leaf piles laid`, piles.length > 0);
  return { piles: piles.map(({ reach: _r, ...p }) => p), laws };
}
