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
 * Each sheets of leaves stacked over its footprint (its lips and its toe easing onto the ground), the pile no steeper
 * than dry leaves stand, a sheet's matted edge no steeper than matted leaves do; its height
 * by how far into the fall (`autumn`), a bank's never past LEAF_PILES.lean of what it leans on. None on the walk, none in a rock (a
 * bank only leans on its own), none lower than the eye spot (`read`, skandartRead), none on another tree's.
 *
 *   LEAF_PILES                          the numbers
 *   leafPiles(site, { autumn, wind, trees, rocks, read, seed }) → { piles: [{ tree, role, at, H, sheets, faces, claim }],
 *          laws }: each face's `crease` a number a corner, how deep in a sheet's crease it lies
 *     claim  [[x, y, r]]: the ground it covers, for the grass to keep off (era/isekai.js ALLOT's claims)
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
  // dry leaves loose on the ground stand steeper than sand, shallower than gravel (degrees): the pile as a whole, its
  // height over the spread of its sheets; a sheet's edge, matted leaves, stands steeper (`edge`, degrees)
  repose: 34, edge: 55,
  // each role's height (m) at the fall's start and at its end, and a bank's most as a share of what it leans on
  heights: Object.freeze({ foot: Object.freeze([0.2, 0.5]), bank: Object.freeze([0.3, 0.75]), heap: Object.freeze([0.25, 0.6]) }), lean: 0.6,
  // a pile's half-length (along the wind) at least this many times its height: room for its sheets' lips and the terraces
  // between them, each lip under the leaves' repose
  spread: 3.2,
  // how far downwind a tree's leaves reach (× its crown's radius) and the share of trees whose leaves leave a heap (at
  // the fall's end; a third of it at its start)
  reach: 3, heap: 0.6,
  // its SHEETS: about `thick` m each, at most `most`; each the one under it less `shrink` of the footprint over them all,
  // set off its middle by up to `off` of its breadth; a lip at least `lip` m wide, eased over `ease` of it at each end; its
  // crease reaching `crease` m out onto the sheet below and in up the lip
  sheets: Object.freeze({ thick: 0.15, most: 4, shrink: 0.9, off: 0.03, lip: 0.12, ease: 0.3, crease: Object.freeze([0.16, 0.05]) }),
  // the grid its surface is cut on (m: fine enough to draw a lip), the walk's margin (m), the farthest from the walk (m)
  cell: 0.1, walk: 0.35, far: 30,
});

const tanD = (deg) => Math.tan((deg * Math.PI) / 180);
const lerp = (a, b, t) => a + (b - a) * t;
const r5n = (v) => r5(v) + 0;
const area = (f) => { const n = [0, 0, 0], c = f.corners; c.forEach((P, k) => { const Q = c[(k + 1) % c.length]; n[0] += (P[1] - Q[1]) * (P[2] + Q[2]); n[1] += (P[2] - Q[2]) * (P[0] + Q[0]); n[2] += (P[0] - Q[0]) * (P[1] + Q[1]); }); return Math.hypot(...n) / 2; };

/**
 * A pile's body: SHEETS of leaves stacked, as wind lays them, each a little smaller than the one under it and set a
 * little off its middle, its outline wobbling as the others' do (one wind laid them); each sheet `T` thick with a LIP at its edge, a ramp `w` m wide
 * at a little under a matted edge's slope (LEAF_PILES.edge), eased at its foot and its brow, so the pile reads in layers: the sheets' tops
 * lit, their lips turned down. And its CREASES: how deep a point lies in the corner where a sheet's lip meets the sheet
 * under it (0 open, 1 deep in it), for the page to shade (a heap's layers read by the dark line under each).
 * Its footprint the ellipse a (along the wind) by b (across); as many sheets as their lips have room for, each lip in
 * its own gap. → { top(u, v) → height (m, ≤ 0 off it), crease(u, v) → 0…1, n }
 */
function sheets(H, a, b, seed) {
  const A = LEAF_PILES, m = Math.min(a, b), lipOf = (k) => Math.max(A.sheets.lip, (H / k) / (tanD(A.edge - 4) * (1 - A.sheets.ease)));
  let n = Math.max(2, Math.min(A.sheets.most, Math.round(H / A.sheets.thick)));
  // (and room for its offset, which brings two lips nearer; the sheets share one wobble, laid by one wind, so their lips run
  // alongside: only the wobble's share of the gap between them, 8 % of it, closes it further)
  while (n > 1 && ((A.sheets.shrink * m) / n) * 0.92 < 1.25 * lipOf(n) + 2 * A.sheets.off * m) n--;
  const T = H / n, w = lipOf(n), e = A.sheets.ease;
  // (a ramp eased over `e` of it at each end: its slope at most T / (w (1 − e)))
  const ramp = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < e ? (x * x) / (2 * e * (1 - e)) : x > 1 - e ? 1 - ((1 - x) * (1 - x)) / (2 * e * (1 - e)) : (x - e / 2) / (1 - e));
  const L = Array.from({ length: n }, (_, k) => {
    const h = (q) => hash3(seed, k, 8401 + q), off = k ? A.sheets.off * m * h(1) : 0, d = h(2) * 6.28;
    return { r: 1 - (k * A.sheets.shrink) / n, ox: Math.cos(d) * off, oy: Math.sin(d) * off, p1: hash3(seed, 0, 8404) * 6.28, p2: hash3(seed, 0, 8405) * 6.28 };
  });
  const edge = (s, u, v) => {
    const uu = (u - s.ox) / a, vv = (v - s.oy) / b, rho = Math.hypot(uu, vv), th = Math.atan2(vv, uu);
    return ((s.r * (1 + 0.05 * Math.sin(th * 3 + s.p1) + 0.03 * Math.sin(th * 5 + s.p2)) - rho) * m) / w;
  };
  const top = (u, v) => { let z = 0; for (const s of L) z += T * ramp(edge(s, u, v)); return z > 0 ? z : -0.02; };
  // (deepest at a lip's foot, fading out onto the sheet under it and in up the lip, A.sheets.crease)
  const [out, inn] = A.sheets.crease;
  const crease = (u, v) => { let c = 0; for (const s of L) { const d = edge(s, u, v) * w; c = Math.max(c, d < 0 ? Math.max(0, 1 + d / out) : Math.max(0, 1 - d / inn)); } return c; };
  return { top, crease, n };
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
    const SB = sheets(H, a, b, seed * 7 + ti * 13 + piles.length), top = SB.top, lines = (lo, hi) => { const n = Math.max(2, Math.ceil((hi - lo) / A.cell)); return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n); };
    const local = cellFaces(top, () => 0, lines(-a, a), lines(-b, b), 'leaves');
    if (!local.length) return;
    const faces = local.map((f) => ({
      corners: f.corners.map(([u, v, z]) => { const X = cx + du[0] * u + dv[0] * v, Y = cy + du[1] * u + dv[1] * v; return [r5n(X), r5n(Y), r5n(site.ground(X, Y) + z)]; }),
      crease: f.corners.map(([u, v]) => r5n(SB.crease(u, v))),
      normal: [r5n(du[0] * f.normal[0] + dv[0] * f.normal[1]), r5n(du[1] * f.normal[0] + dv[1] * f.normal[1]), f.normal[2]], matter: 'leaves',
    }));
    // (its ground claimed: circles along its long axis, so no grass grows up through it, era/isekai.js ALLOT)
    const long = a >= b ? du : dv, half = Math.abs(a - b), rr = Math.min(a, b) * 0.85;
    const claim = [-1, 0, 1].filter((k) => k === 0 || half > 0.05).map((k) => [r5n(cx + long[0] * k * half * 0.6), r5n(cy + long[1] * k * half * 0.6), r5n(rr)]);
    piles.push({ tree: ti, role, at: [r5n(cx), r5n(cy)], H: r5n(H), sheets: SB.n, reach: Math.max(a, b), faces, claim });
    const steep = Math.max(0, ...local.filter((f) => area(f) >= 0.002).map((f) => (Math.acos(Math.min(1, f.normal[2])) * 180) / Math.PI));
    const id = `tree ${ti}'s ${role}`, whole = (Math.atan(H / (A.sheets.shrink * Math.min(a, b))) * 180) / Math.PI;
    row('repose', `${id}: the pile ${Math.round(whole)}° over its sheets (dry leaves stand at ${A.repose}°)`, whole <= A.repose);
    row('matted-edge', `${id}: its steepest sheet's edge ${Math.round(steep)}° (matted leaves stand at ${A.edge}°)`, steep <= A.edge + 2);
    row('too-small-to-read', `${id}: ${r5n(H)} m high (the eye spot ${r5(read.least)} m)`, H >= read.least);
  };
  const near = trees.map((t, i) => ({ ...t, i })).filter((t) => site.trailDist(t.x, t.y) <= A.far);
  for (const t of near) {
    const h = (k) => hash3(seed, t.i, k), at = (u, v) => [t.x + du[0] * u + dv[0] * v, t.y + du[1] * u + dv[1] * v];
    // FOOT: against the trunk's windward side, longer across the wind than along it
    {
      const H = lerp(...A.heights.foot, autumn) * (0.85 + 0.3 * h(8311)), a = Math.max(A.spread * H, 0.45), b = Math.max(a * 1.15, t.crown * 0.45);
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
