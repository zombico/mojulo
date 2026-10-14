/**
 * THE SURROUNDS — a venue in a place, not on a plane. What a trackscape builds stands within a few tens of metres of
 * the road (its slots, the arena's zones); beyond them the land was a flat field to the horizon. The surrounds shape the
 * land and stand things on it, by the same eye: what a driver looks at down a straight, what the lap sees most of.
 *
 *   the land       a LAND's relief (rolling hills, ridged mountains, terraced mesas, a plain) rising beyond the venue,
 *                  never steeper than its slope from what must stay flat (the track's footprint, the zones, the roads,
 *                  the sight lines, the slots, a village's ground); low mounds in the infield; the far ground a graded
 *                  grid, fine near and coarse far, easing back to the plain under the haze; steep ground rock, high
 *                  ground snow, fields round the farms
 *   formations     rock where the driver looks: down each long straight to its turn-in, carried past the venue's ring
 *                  (tors, crags, spires, buttes, arches; a kart track's stacks), faceted lumps with banded strata,
 *                  painted by the kit like a set piece
 *   a settlement   where the lap sees most, on gentle ground: a village (its chapel, houses along a lane), farmsteads in
 *                  the hills (a house, a silo, a shed, their fields), or a town's tower blocks on the horizon
 *   woods          stands of trees on gentle ground by a mask, groves in the infield; far woods drawn as canopy
 *   boulders       at the formations' feet and on steep ground
 *   a lake         where the infield is widest, a basin and its water
 *
 *   LANDS, SETTLEMENTS
 *   planSurrounds(plan, { arena, scape, K, seed, land, settlement }) → { plan (its land shaped: terrain, groundAt, the
 *        ground's faces), faces, things (for the eye), report: { land, settlement, formations, buildings, trees, faces } }
 *
 * Pure, deterministic.
 */
import { gnoise } from '../polygonizer/landform.js';
import { mulberry32 } from '../vegetation/grow.js';
import { buildBlock } from '../era/blocks.js';
import { inPoly } from './arena-plan.js';
import { terrainAt, GRASS_TILE } from './track.js';
import { TRACK_BLOCKS, paintPiece } from './set-pieces.js';

/** A land's character: its relief's shape, its height in the infield, its steepest rise from what stays flat, its height
 *  near the venue and far from it (reached `reach` m out), its wavelength (m), steps (a mesa's terraces), the snow line
 *  (a share of its far height), how much rock and wood, and the formations a driver looks at. */
export const LANDS = Object.freeze({
  hills: { shape: 'rolling', infield: 6, slope: 0.28, near: 40, far: 170, reach: 1000, wave: 480, snow: null, rocks: 0.3, woods: 0.5, formations: ['tor', 'crag'] },
  mountains: { shape: 'ridged', infield: 6, slope: 0.38, near: 50, far: 620, reach: 1800, wave: 1000, snow: 0.45, rocks: 0.6, woods: 0.42, formations: ['crag', 'spire'] },
  mesas: { shape: 'terraced', infield: 3, slope: 0.5, near: 18, far: 190, reach: 1400, wave: 620, steps: 4, snow: null, rocks: 0.5, woods: 0, formations: ['butte', 'arch', 'spire'] },
  flat: { shape: 'rolling', infield: 2, slope: 0.12, near: 5, far: 22, reach: 1200, wave: 420, snow: null, rocks: 0.1, woods: 0.6, formations: ['tor'] },
});
export const SETTLEMENTS = Object.freeze(['village', 'farms', 'town', 'none']);
/** A kart track's formations: toy rock, whatever the land. */
const KART_FORMATIONS = ['arch', 'stack', 'butte'];
/** How many formations, per land; a kart track's share. */
const FORMATION_COUNT = { hills: 4, mountains: 5, mesas: 6, flat: 2 };
/** Where the land's relief eases back to the plain: the far grid's half-size past the venue box (m). */
const FAR_OUT = 2600, FAR = 6000;
const ROCK_NZ = 0.78;   // a face steeper than ~39° is rock
/** The voxel pole's cube for a thing `dv` m past the ring: a metre near, coarser out to six (a far wood, a village on
 *  the hill are chunky; the eye there reads masses, not cubes). */
const voxelAt = (dv) => Math.max(1, Math.min(6, Math.round((0.6 + dv / 110) * 2) / 2));

const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fbm = (x, y, s, oct = 4) => { let a = 1, f = 1, t = 0, n = 0; for (let o = 0; o < oct; o++) { t += a * gnoise(x * f, y * f, s + o); n += a; a *= 0.5; f *= 2.03; } return t / n; };
/** The relief's shapes, 0 (the plain) … 1 (the land's full height). */
const SHAPES = {
  rolling: (x, y, s) => clamp01(0.5 + 1.1 * fbm(x, y, s, 4)),
  ridged: (x, y, s) => { let a = 1, f = 1, t = 0, n = 0, w = 1; for (let o = 0; o < 5; o++) { const r = (1 - Math.abs(gnoise(x * f, y * f, s + o))) ** 2 * w; t += a * r; n += a; w = clamp01(r * 1.8); a *= 0.5; f *= 2.1; } return clamp01((t / n) * 1.6 - 0.2); },
  terraced: (x, y, s, L) => { const v = clamp01(0.5 + 1.2 * fbm(x, y, s, 3)), t = v * L.steps, f = Math.floor(t); return (f + smooth(0.72, 0.9, t - f)) / L.steps; },
};

// ── plan geometry ──
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}
const polyDist = (p, poly) => { if (inPoly(p, poly)) return 0; let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length])); return d; };
function convexHull(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const l = Math.hypot(...n) || 1; return n.map((v) => v / l);
}

/**
 * What must stay flat, as a distance: how far a point stands outside the keep (the track's footprint, the zones, the
 * roads, the sight lines, the slots, any disc added), negative inside it. Inside the venue's ring every feature is
 * measured; outside it the ring road is the nearest unless something stands out there (the landmark, a village).
 */
function keepOf(plan, arena, scape) {
  const a = plan.alignment, L = a.length, X = plan.X, n = Math.max(32, Math.round(L / 6));
  const line = Array.from({ length: n + 1 }, (_, i) => { const p = a.at(Math.min(L, (i * L) / n)); return [p.x, p.y]; });
  const lineKeep = X.outer + 12;
  const ringRoad = arena?.roads.find((r) => r.id === 'ring');
  const ring = ringRoad ? ringRoad.pts.slice(0, -1) : (() => { const h = convexHull(line), c = h.reduce((s, p) => [s[0] + p[0] / h.length, s[1] + p[1] / h.length], [0, 0]); return h.map(([x, y]) => { const d = Math.hypot(x - c[0], y - c[1]) || 1, m = X.outer + 30; return [x + ((x - c[0]) / d) * m, y + ((y - c[1]) / d) * m]; }); })();
  const zones = (arena?.zones ?? []).map((z) => z.poly), roads = (arena?.roads ?? []).filter((r) => r.id !== 'ring').map((r) => r.pts);
  const sights = (scape?.keepClear ?? []).map((k) => [k.from, k.to]), slots = (scape?.slots ?? []).map((s) => [s.at[0], s.at[1]]);
  const outer = [...(arena?.zones ?? []).filter((z) => z.id === 'landmark').map((z) => z.poly)], discs = [];
  const ringDist = (p) => { let d = Infinity; for (let i = 0; i < ring.length; i++) d = Math.min(d, segDist(p, ring[i], ring[(i + 1) % ring.length])); return d; };
  const dist = (p) => {
    const inside = inPoly(p, ring);
    let d = ringDist(p) - 9;
    for (const q of outer) d = Math.min(d, polyDist(p, q) - 10);
    for (const s of sights) d = Math.min(d, segDist(p, s[0], s[1]) - 5);
    for (const c of discs) d = Math.min(d, Math.hypot(p[0] - c.at[0], p[1] - c.at[1]) - c.r);
    if (inside || d < 40) {
      for (const q of line) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]) - lineKeep);
      for (const z of zones) d = Math.min(d, polyDist(p, z) - 10);
      for (const r of roads) for (let i = 0; i + 1 < r.length; i++) d = Math.min(d, segDist(p, r[i], r[i + 1]) - 9);
      for (const s of slots) d = Math.min(d, Math.hypot(p[0] - s[0], p[1] - s[1]) - 14);
    }
    return { d, inside, dv: inside ? 0 : ringDist(p) };
  };
  return { line, ring, dist, discs, centre: ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0, 0]) };
}

// ── natural forms: faceted lumps ──
/** A faceted lump: rings of jittered radius up a profile ([radius share, height share] pairs), a flat top, no floor (it
 *  stands sunk). Faces on `group` (stone), each a value; `bands` alternates the value ring to ring (strata). */
function lump(out, at, { r, h, profile, sides = 7, jitter = 0.18, rnd, value = 0.55, bands = 0, yaw = 0, group = 'str:stone', vary = 0.08 }) {
  const ang = Array.from({ length: sides }, (_, i) => yaw + (2 * Math.PI * (i + (rnd() - 0.5) * 0.45)) / sides);
  const rings = profile.map(([rf, zf], k) => ang.map((t) => { const j = 1 + jitter * (rnd() - 0.5) * 2, dz = k > 0 && k < profile.length - 1 ? h * 0.04 * (rnd() - 0.5) : 0; return [r3(at[0] + Math.cos(t) * r * rf * j), r3(at[1] + Math.sin(t) * r * rf * j), r3(at[2] + h * zf + dz)]; }));
  for (let k = 0; k + 1 < rings.length; k++) for (let i = 0; i < sides; i++) {
    const c = [rings[k][i], rings[k][(i + 1) % sides], rings[k + 1][(i + 1) % sides], rings[k + 1][i]];
    out.push({ corners: c, normal: newell(c), group, value: bands ? value + (k % 2 ? bands : 0) : value + vary * (rnd() - 0.5) });
  }
  const top = rings[rings.length - 1];
  out.push({ corners: top, normal: newell(top), group, value: value + 0.1 });
  return out;
}
const BOULDER = [[1, 0], [1.08, 0.3], [0.8, 0.75], [0.35, 1]];
/** The formations: each builds its faces round `at` (its foot) and says its size. */
const FORMATIONS = {
  tor: (at, rnd) => { const out = [], R = 6 + rnd() * 4; lump(out, [at[0], at[1], at[2] - 0.6], { r: R, h: 5 + rnd() * 3, profile: [[1, 0], [0.98, 0.4], [0.75, 0.85], [0.45, 1]], rnd });
    let z = at[2] + 4.5, rr = R * 0.75; for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) { const o = (rnd() - 0.5) * rr * 0.5; lump(out, [at[0] + o, at[1] - o, z - 0.4], { r: rr, h: rr * 0.8, profile: BOULDER, sides: 6, rnd, value: 0.6 }); z += rr * 0.65; rr *= 0.7; } return out; },
  crag: (at, rnd) => { const out = [], n = 3 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) { const t = rnd() * Math.PI * 2, d = k ? 4 + rnd() * 9 : 0; lump(out, [at[0] + Math.cos(t) * d, at[1] + Math.sin(t) * d, at[2] - 1], { r: 3.5 + rnd() * 4, h: (k ? 9 : 22) + rnd() * 14, profile: [[1, 0], [0.85, 0.35], [0.62, 0.75], [0.3, 1]], rnd, value: 0.5 }); } return out; },
  spire: (at, rnd) => { const out = [], R = 6 + rnd() * 4; lump(out, [at[0], at[1], at[2] - 1], { r: R, h: 45 + rnd() * 40, profile: [[1.3, 0], [1, 0.12], [0.72, 0.4], [0.55, 0.7], [0.4, 0.9], [0.18, 1]], rnd, value: 0.52, bands: 0.08 });
    for (let k = 0; k < 2; k++) { const t = rnd() * Math.PI * 2; lump(out, [at[0] + Math.cos(t) * R * 1.6, at[1] + Math.sin(t) * R * 1.6, at[2] - 1], { r: R * 0.5, h: 10 + rnd() * 8, profile: [[1, 0], [0.8, 0.5], [0.35, 1]], rnd }); } return out; },
  butte: (at, rnd) => { const out = [], R = 22 + rnd() * 26; lump(out, [at[0], at[1], at[2] - 1.5], { r: R, h: 32 + rnd() * 40, sides: 11, jitter: 0.12, profile: [[1.45, 0], [1.06, 0.2], [1, 0.38], [0.98, 0.56], [0.96, 0.76], [0.93, 1]], rnd, value: 0.5, bands: 0.12 }); return out; },
  stack: (at, rnd) => { const out = [], R = 4 + rnd() * 3; lump(out, [at[0], at[1], at[2] - 0.8], { r: R, h: 24 + rnd() * 18, sides: 8, jitter: 0.1, profile: [[1.3, 0], [0.8, 0.25], [0.62, 0.6], [1.35, 0.78], [1.25, 0.94], [0.7, 1]], rnd, value: 0.5, bands: 0.14 }); return out; },
  arch: (at, rnd, yaw) => {
    const out = [], S = 30 + rnd() * 30, H = 22 + rnd() * 20, rf = 6 + rnd() * 3, rt = 3 + rnd() * 1.5, n = 13, sides = 7, ax = [Math.cos(yaw), Math.sin(yaw)];
    // a ring at each step up the arc from one foot over to the other, its radius thick at the feet, thin at the crown
    const rings = [];
    for (let k = 0; k < n; k++) {
      const th = Math.PI * (1 - k / (n - 1)), c = [at[0] + ax[0] * (S / 2) * Math.cos(th), at[1] + ax[1] * (S / 2) * Math.cos(th), at[2] - 1.5 + (H + 1.5) * Math.sin(th)];
      const T = [-ax[0] * (S / 2) * Math.sin(th), -ax[1] * (S / 2) * Math.sin(th), (H + 1.5) * Math.cos(th)], tl = Math.hypot(...T), t = T.map((v) => v / tl);
      const B = [-ax[1], ax[0], 0], N = [t[1] * B[2] - t[2] * B[1], t[2] * B[0] - t[0] * B[2], t[0] * B[1] - t[1] * B[0]], rr = rt + (rf - rt) * (1 - Math.sin(th)) ** 1.5;
      rings.push(Array.from({ length: sides }, (_, i) => { const p = (2 * Math.PI * i) / sides, j = 1 + 0.2 * (rnd() - 0.5); return c.map((v, q) => r3(v + rr * j * (Math.cos(p) * N[q] + Math.sin(p) * B[q] * 1.3))); }));
    }
    for (let k = 0; k + 1 < n; k++) for (let i = 0; i < sides; i++) { const c = [rings[k][i], rings[k][(i + 1) % sides], rings[k + 1][(i + 1) % sides], rings[k + 1][i]], nn = newell(c), m = c.reduce((s, p) => s.map((v, q) => v + p[q] / 4), [0, 0, 0]), cc = rings[k].reduce((s, p) => s.map((v, q) => v + p[q] / sides), [0, 0, 0]); out.push({ corners: nn[0] * (m[0] - cc[0]) + nn[1] * (m[1] - cc[1]) + nn[2] * (m[2] - cc[2]) < 0 ? c.slice().reverse() : c, group: 'str:stone', value: 0.5 + (k % 3 === 0 ? 0.1 : 0) }); }
    for (const s of [-1, 1]) lump(out, [at[0] + ax[0] * s * (S / 2 + rf * 0.6), at[1] + ax[1] * s * (S / 2 + rf * 0.6), at[2] - 1], { r: rf * 1.1, h: H * 0.3, profile: [[1, 0], [0.8, 0.6], [0.4, 1]], rnd });
    return out.map((f) => (f.normal ? f : { ...f, normal: newell(f.corners) }));
  },
};

// ── the land shaped ──
/** The far ground's lines along one axis: the terrain box's own vertices every `m` cells across it (so the box's rim
 *  meets them exactly), then outward in steps growing to 300 m, to the far grid's edge. */
function farLines(lo, hi, cell, m, out) {
  const xs = []; for (let x = lo; x < hi - 1e-6; x += cell * m) xs.push(x); xs.push(hi);
  const left = [], right = []; let s = cell * m, x = lo; while (x > lo - out) { s = Math.min(300, s * 1.22); x -= s; left.unshift(Math.max(x, lo - out)); }
  s = cell * m; x = hi; while (x < hi + out) { s = Math.min(300, s * 1.22); x += s; right.push(Math.min(x, hi + out)); }
  return [...left, ...xs, ...right];
}
// a grid's height at a point: the same two triangles a cell's quad renders as (diagonal 0–2)
function gridAt(xs, ys, z, x, y) {
  const find = (A, v) => { let lo = 0, hi = A.length - 2; if (v <= A[0]) return 0; if (v >= A[A.length - 1]) return A.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (A[m] <= v) lo = m; else hi = m - 1; } return lo; };
  const i = find(xs, x), j = find(ys, y), W = xs.length, fx = clamp01((x - xs[i]) / (xs[i + 1] - xs[i])), fy = clamp01((y - ys[j]) / (ys[j + 1] - ys[j]));
  const z00 = z[j * W + i], z10 = z[j * W + i + 1], z11 = z[(j + 1) * W + i + 1], z01 = z[(j + 1) * W + i];
  return fx >= fy ? z00 + fx * (z10 - z00) + fy * (z11 - z10) : z00 + fy * (z01 - z00) + fx * (z11 - z01);
}

export function planSurrounds(plan, { arena = null, scape = null, K, seed = 1, land = 'hills', settlement = 'village' } = {}) {
  const L = LANDS[land];
  if (!L) throw new Error(`trackscape: no land '${land}' (${Object.keys(LANDS).join(', ')})`);
  if (!SETTLEMENTS.includes(settlement)) throw new Error(`trackscape: no settlement '${settlement}' (${SETTLEMENTS.join(', ')})`);
  const kart = plan.course.class === 'kart', rnd = mulberry32((seed * 2654435761 + 977) >>> 0), S = (seed * 7919) % 100003;
  const keep = keepOf(plan, arena, scape), T = plan.terrain, zFar = T.zFar;
  const a = plan.alignment, Lap = a.length, lapPts = Array.from({ length: Math.max(32, Math.round(Lap / 10)) }, (_, i) => a.at((i * Lap) / Math.max(32, Math.round(Lap / 10))));
  const bx0 = T.x0, by0 = T.y0, bx1 = T.x0 + T.nx * T.cell, by1 = T.y0 + T.ny * T.cell, bc = [(bx0 + bx1) / 2, (by0 + by1) / 2], H = Math.max(bx1 - bx0, by1 - by0) / 2 + FAR_OUT;
  const inFar = (p, share = 0.7) => Math.max(Math.abs(p[0] - bc[0]), Math.abs(p[1] - bc[1])) < H * share;
  // the lap's eye on a point: every station whose heading looks within 30° of it, nearer counting more
  const seenBy = (p) => { let s = 0; for (const q of lapPts) { const dx = p[0] - q.x, dy = p[1] - q.y, d = Math.hypot(dx, dy) || 1, c = (dx * Math.cos(q.heading) + dy * Math.sin(q.heading)) / d; if (c > 0.866) s += 1 / (1 + d / 500); } return s; };
  // out along a bearing from a point to past the ring and clear of the keep, then `beyond` more
  const outFrom = (from, dir, beyond, clear = 20) => { let p = from; for (let k = 0; k < 400; k++) { p = [p[0] + dir[0] * 10, p[1] + dir[1] * 10]; const K0 = keep.dist(p); if (!K0.inside && K0.d > clear) return [p[0] + dir[0] * beyond, p[1] + dir[1] * beyond]; } return null; };

  // ── the settlement: where the lap sees most, on its own flat (a disc of the keep) ──
  const sites = [], built = [], things = [];
  const SET = settlement === 'none' ? null : settlement;
  const bearings = Array.from({ length: 32 }, (_, i) => (2 * Math.PI * i) / 32);
  if (SET === 'village' || SET === 'town') {
    const range = SET === 'town' ? [700, 1100] : kart ? [110, 260] : [160, 380], r = SET === 'town' ? 170 : kart ? 70 : 95;
    let best = null;
    for (const b of bearings) {
      const p = outFrom(keep.centre, [Math.cos(b), Math.sin(b)], range[0] + rnd() * (range[1] - range[0]));
      if (!p || !inFar(p, 0.6) || keep.dist(p).d < r + 20) continue;
      const s = seenBy(p); if (!best || s > best.s) best = { at: p, s, b, r };
    }
    if (best) { sites.push({ kind: SET, ...best }); keep.discs.push({ at: best.at, r: best.r }); }
  }
  if (SET === 'farms' || SET === 'village') {
    const n = SET === 'farms' ? 4 : 2, taken = sites.map((s) => s.b);
    for (let k = 0; k < n; k++) {
      const order = bearings.map((b) => ({ b, gap: Math.min(...taken.map((t) => Math.abs(Math.atan2(Math.sin(b - t), Math.cos(b - t)))), Math.PI) })).sort((p, q) => q.gap - p.gap || p.b - q.b);
      for (const { b } of order.slice(0, 4)) {
        const p = outFrom(keep.centre, [Math.cos(b), Math.sin(b)], (kart ? 120 : 220) + rnd() * (kart ? 200 : 520));
        if (!p || !inFar(p, 0.6) || keep.dist(p).d < 60) continue;
        sites.push({ kind: 'farm', at: p, b, r: 38 }); keep.discs.push({ at: p, r: 38 }); taken.push(b); break;
      }
    }
  }

  // ── a lake: where the infield is widest (its point farthest from the keep), a basin and its water ──
  let lake = null;
  if (land !== 'mesas') {
    const rx = keep.ring.map((p) => p[0]), ry = keep.ring.map((p) => p[1]);
    let best = null;
    for (let x = Math.min(...rx); x < Math.max(...rx); x += 16) for (let y = Math.min(...ry); y < Math.max(...ry); y += 16) { const K0 = keep.dist([x, y]); if (K0.inside && (!best || K0.d > best.d)) best = { at: [x, y], d: K0.d }; }
    if (best && best.d > (kart ? 30 : 70)) lake = { at: best.at, R: Math.min(best.d * 0.5, kart ? 50 : 150) };
  }
  const lakeR = (x, y) => { const t = Math.atan2(y - lake.at[1], x - lake.at[0]); return lake.R * (1 + 0.2 * gnoise(Math.cos(t) * 1.6 + 3.1, Math.sin(t) * 1.6 + 7.7, S + 5)); };
  const DEPTH = 2.6, LEVEL = -0.5;
  // ── the land: the relief beyond the keep, slope-limited from it; mounds in the infield ──
  // (`pad`: the cell a vertex spans, so no cell that touches the keep rises: its ground there stays the plan's)
  const relief = (x, y, pad = 0) => {
    const K0 = keep.dist([x, y]); K0.d -= pad; if (K0.d <= 0) return 0;
    if (K0.inside) {
      let cap = Math.min(L.infield, L.slope * K0.d);
      if (lake) { const lr = Math.hypot(x - lake.at[0], y - lake.at[1]) / lakeR(x, y); if (lr < 1.3) return -DEPTH * (1 - smooth(0.55, 1.3, lr)); cap = Math.min(cap, L.slope * (lr - 1.3) * lake.R); }
      return cap * SHAPES.rolling(x / (L.wave * 0.25), y / (L.wave * 0.25), S + 11);
    }
    const A = Math.min(L.slope * K0.d, L.near + (L.far - L.near) * smooth(0, L.reach, K0.dv));
    const r = Math.max(Math.abs(x - bc[0]), Math.abs(y - bc[1]));
    return A * SHAPES[L.shape](x / L.wave, y / L.wave, S, L) * (1 - smooth(H * 0.72, H, r));
  };
  const W = T.nx + 1, m = Math.max(1, Math.round(32 / T.cell));
  const xs = farLines(bx0, bx1, T.cell, m, H - (bx1 - bx0) / 2), ys = farLines(by0, by1, T.cell, m, H - (by1 - by0) / 2), FW = xs.length;
  const fz = new Float64Array(xs.length * ys.length);
  const span = (A, i) => Math.max(i > 0 ? A[i] - A[i - 1] : 0, i + 1 < A.length ? A[i + 1] - A[i] : 0);
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < FW; i++) fz[j * FW + i] = zFar + relief(xs[i], ys[j], Math.max(span(xs, i), span(ys, j)));
  const tz = Float64Array.from(T.z), lifted = new Uint8Array(tz.length), padB = T.cell * m * 1.25;
  for (let j = 0; j <= T.ny; j++) for (let i = 0; i <= T.nx; i++) {
    const k = j * W + i; if (T.foot[k]) continue;
    const x = T.x0 + i * T.cell, y = T.y0 + j * T.cell;
    // the rim: on the far grid's own edges (no crack where a fine cell meets a coarse one)
    // (the pad grows to the far grid's near the box's edge: the two grids rise from the keep alike, no step between)
    const edge = Math.min(x - bx0, bx1 - x, y - by0, by1 - y), pad = T.cell * 1.5 + (padB - T.cell * 1.5) * (1 - smooth(0, 2 * padB, edge));
    const h = i === 0 || i === T.nx || j === 0 || j === T.ny ? gridAt(xs, ys, fz, x, y) - zFar : relief(x, y, pad);
    if (Math.abs(h) > 1e-6) { tz[k] += h; lifted[k] = 1; }
  }
  const T2 = { ...T, z: tz };
  const inBox = (x, y) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1;
  const groundAt = (x, y) => (inBox(x, y) ? terrainAt(T2, x, y) : Math.max(Math.abs(x - bc[0]), Math.abs(y - bc[1])) < H ? gridAt(xs, ys, fz, x, y) : zFar);
  const slopeAt = (x, y) => { const e = 4, gx = (groundAt(x + e, y) - groundAt(x - e, y)) / (2 * e), gy = (groundAt(x, y + e) - groundAt(x, y - e)) / (2 * e); return Math.hypot(gx, gy); };

  // ── the ground's faces: grass, rock where steep, snow where high, fields round the farms ──
  const farms = sites.filter((s) => s.kind === 'farm');
  const FIELD = ['crop', 'earth', 'grass', 'crop', 'grass'];
  const fieldAt = (x, y) => {
    for (const f of farms) if (Math.hypot(x - f.at[0], y - f.at[1]) < (kart ? 120 : 230)) { const u = Math.floor((x - f.at[0]) / 70), v = Math.floor((y - f.at[1]) / 46), h = Math.imul(u * 73856093 ^ v * 19349663 ^ S, 1274126177) >>> 0; return FIELD[h % FIELD.length]; }
    return null;
  };
  const matOf = (c, wasLifted) => {
    const n = newell(c), mx = (c[0][0] + c[2][0]) / 2, my = (c[0][1] + c[2][1]) / 2, nz = Math.abs(n[2]);
    if (wasLifted && nz < ROCK_NZ) return 'rock';
    if (wasLifted && L.snow && (c[0][2] + c[2][2]) / 2 - zFar > L.far * L.snow && nz > 0.6) return 'snow';
    return (nz > 0.96 && fieldAt(mx, my)) || 'grass';
  };
  const ground = [];
  const tile = (mat, c) => ground.push(K.surface(mat, c, c.map((p) => [p[0] / GRASS_TILE, p[1] / GRASS_TILE])));
  for (let j = 0; j < T.ny; j++) for (let i = 0; i < T.nx; i++) {
    const k = [j * W + i, j * W + i + 1, (j + 1) * W + i + 1, (j + 1) * W + i];
    if (k.every((q) => T.foot[q])) continue;
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v], q) => [T.x0 + u * T.cell, T.y0 + v * T.cell, tz[k[q]]]);
    tile(matOf(c, k.some((q) => lifted[q])), c);
  }
  for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < FW; i++) {
    if (xs[i] >= bx0 - 1e-6 && xs[i + 1] <= bx1 + 1e-6 && ys[j] >= by0 - 1e-6 && ys[j + 1] <= by1 + 1e-6) continue;   // the terrain's
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([u, v]) => [xs[u], ys[v], fz[v * FW + u]]);
    tile(matOf(c, c.some((p) => Math.abs(p[2] - zFar) > 1e-6)), c);
  }
  // the lake's water: a level under the plain, its shore where the basin rises through it (a fan of triangles)
  if (lake) {
    const n = 40, ring = Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n, x = lake.at[0] + Math.cos(t), y = lake.at[1] + Math.sin(t), r = lakeR(x, y) * 1.16; return [r3(lake.at[0] + Math.cos(t) * r), r3(lake.at[1] + Math.sin(t) * r), r3(zFar + LEVEL)]; });
    const c = [lake.at[0], lake.at[1], r3(zFar + LEVEL)], fill = K.flat('water', 2);
    for (let i = 0; i < n; i++) ground.push({ corners: [c, ring[i], ring[(i + 1) % n]], fill });
  }
  // the plain beyond, under the haze: 500 m tiles to FAR, cut round the far grid
  const fx0 = xs[0], fx1 = xs[FW - 1], fy0 = ys[0], fy1 = ys[ys.length - 1];
  const rect = (x0, y0, x1, y1) => { if (x1 - x0 > 1e-6 && y1 - y0 > 1e-6) tile('grass', [[x0, y0, zFar], [x1, y0, zFar], [x1, y1, zFar], [x0, y1, zFar]]); };
  for (let gx = bc[0] - FAR; gx < bc[0] + FAR; gx += 500) for (let gy = bc[1] - FAR; gy < bc[1] + FAR; gy += 500) {
    const x0 = gx, y0 = gy, x1 = gx + 500, y1 = gy + 500;
    if (x1 <= fx0 || x0 >= fx1 || y1 <= fy0 || y0 >= fy1) { rect(x0, y0, x1, y1); continue; }
    rect(x0, y0, x1, Math.max(y0, fy0)); rect(x0, Math.min(y1, fy1), x1, y1);
    const ya = Math.max(y0, fy0), yb = Math.min(y1, fy1); rect(x0, ya, Math.max(x0, fx0), yb); rect(Math.min(x1, fx1), ya, x1, yb);
  }

  // ── formations: down each long straight past the ring, and outward from the bends when the straights are few ──
  const formations = [], faces = [], count = {}, mark = (k, n0) => { count[k] = (count[k] ?? 0) + faces.length - n0; }, kinds = kart ? KART_FORMATIONS : L.formations, want = FORMATION_COUNT[land] ?? 3;
  const STRAIGHT_K = 1 / 300, step = Lap / lapPts.length, runs = [];
  let run = null;
  const start = lapPts.findIndex((p) => Math.abs(p.k) > STRAIGHT_K);
  for (let q = 0; q <= lapPts.length; q++) {
    const i = a.closed ? (Math.max(0, start) + q) % lapPts.length : Math.min(q, lapPts.length - 1), p = lapPts[i], straight = Math.abs(p.k) <= STRAIGHT_K && q < lapPts.length;
    if (straight) { run = run ? { ...run, end: p, len: run.len + step } : { end: p, len: step }; } else if (run) { runs.push(run); run = null; }
  }
  runs.sort((p, q) => q.len - p.len);
  const rays = runs.filter((r) => r.len >= (kart ? 40 : 110)).map((r) => ({ from: [r.end.x, r.end.y], dir: [Math.cos(r.end.heading), Math.sin(r.end.heading)] }));
  for (let i = 0; rays.length < want * 2 && i < 12; i++) { const p = lapPts[Math.floor(((i * 5 + 2) % 12) * lapPts.length / 12)], c = keep.centre, d = Math.hypot(p.x - c[0], p.y - c[1]) || 1; rays.push({ from: [p.x, p.y], dir: [(p.x - c[0]) / d, (p.y - c[1]) / d] }); }
  const apart = kart ? 90 : 170;
  let n0 = faces.length;
  for (const ray of rays) {
    if (formations.length >= want) break;
    const kind = kinds[formations.length % kinds.length], big = kind === 'butte' || kind === 'spire' || kind === 'arch';
    const at2 = outFrom(ray.from, ray.dir, (big ? 140 : 60) + rnd() * (big ? 260 : 160) * (kart ? 0.5 : 1), big ? 50 : 25);
    if (!at2 || !inFar(at2) || keep.dist(at2).d < (big ? 45 : 18) || formations.some((f) => Math.hypot(f.at[0] - at2[0], f.at[1] - at2[1]) < apart) || sites.some((s) => Math.hypot(s.at[0] - at2[0], s.at[1] - at2[1]) < s.r + 60)) continue;
    const at = [r3(at2[0]), r3(at2[1]), r3(groundAt(at2[0], at2[1]))], yaw = Math.atan2(ray.dir[1], ray.dir[0]) + Math.PI / 2;
    const f0 = FORMATIONS[kind](at, rnd, yaw), sc = kart ? 1 : 1.7;
    const f = sc === 1 ? f0 : f0.map((q) => ({ ...q, corners: q.corners.map((p) => [r3(at[0] + (p[0] - at[0]) * sc), r3(at[1] + (p[1] - at[1]) * sc), r3(at[2] + (p[2] - at[2]) * sc)]) }));
    // stood on the land: its foot under the lowest ground round it
    const lo = Math.min(...[0, 1, 2, 3, 4].map((k) => { const t = (k * 2 * Math.PI) / 5, rr = k ? 10 : 0; return groundAt(at[0] + Math.cos(t) * rr, at[1] + Math.sin(t) * rr); }));
    const placed = f.map((q) => ({ ...q, corners: q.corners.map((p) => [p[0], p[1], r3(p[2] + lo - at[2])]) }));
    const box = { lo: [0, 1, 2].map((i) => Math.min(...placed.flatMap((q) => q.corners.map((p) => p[i])))), hi: [0, 1, 2].map((i) => Math.max(...placed.flatMap((q) => q.corners.map((p) => p[i])))) };
    const ext = Math.max(...box.hi.map((v, i) => v - box.lo[i]));
    faces.push(...paintPiece(placed, K, { voxel: Math.max(voxelAt(keep.dist(at).dv), Math.round((ext / 18) * 2) / 2) }));
    formations.push({ kind, at, box });
    const sz = box.hi.map((v, i) => v - box.lo[i]);
    things.push({ kind: `formation:${kind}`, interest: 'prop', at: box.hi.map((v, i) => (v + box.lo[i]) / 2), span: Math.min(Math.max(sz[0], sz[1]), sz[2]), top: box.hi[2] });
    // boulders at its foot
    const nb = 3 + Math.floor(rnd() * 4), boulders = [];
    for (let k = 0; k < nb; k++) { const t = rnd() * Math.PI * 2, d = ext * (0.35 + rnd() * 0.4), p = [at[0] + Math.cos(t) * d, at[1] + Math.sin(t) * d]; if (keep.dist(p).d < 4) continue; const rr = 1 + rnd() * 2.2; lump(boulders, [p[0], p[1], groundAt(p[0], p[1]) - rr * 0.25], { r: rr, h: rr * (0.8 + rnd() * 0.5), profile: BOULDER, sides: 6, rnd, value: 0.58 }); }
    if (boulders.length) faces.push(...paintPiece(boulders, K, { voxel: voxelAt(keep.dist(at).dv) }));
  }

  mark('formations', n0); n0 = faces.length;
  // ── the settlement's buildings: blocks stood on their own ground, a plinth down to its lowest corner ──
  const stand = (id, params, at, yaw, out) => {
    const B = TRACK_BLOCKS[id], b = buildBlock(B, { params, library: TRACK_BLOCKS, ring: 'far', at: [0, 0, 0], yaw: (yaw * 180) / Math.PI, seed: 1 });
    const { lo, hi } = b.box, cs = [[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]].map(([x, y]) => groundAt(at[0] + x, at[1] + y));
    const z = Math.max(...cs), base = Math.min(...cs) - 0.3;
    out.push(...b.faces.map((f) => ({ ...f, corners: f.corners.map((p) => [r3(p[0] + at[0]), r3(p[1] + at[1]), r3(p[2] + z)]) })));
    if (z - base > 0.4) { const c = [[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]].map(([x, y]) => [r3(at[0] + x), r3(at[1] + y)]);
      for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4], w = [[p[0], p[1], base], [q[0], q[1], base], [q[0], q[1], z], [p[0], p[1], z]]; out.push({ corners: w, normal: newell(w), group: 'str:stone', value: 0.5 }); } }
    built.push({ block: id, at: [r3(at[0]), r3(at[1]), r3(z)] });
    return { lo: [at[0] + lo[0], at[1] + lo[1], z], hi: [at[0] + hi[0], at[1] + hi[1], z + hi[2] - lo[2]] };
  };
  for (const s of sites) {
    const out = [], toward = Math.atan2(keep.centre[1] - s.at[1], keep.centre[0] - s.at[0]);
    if (s.kind === 'village') {
      // a lane across the view, houses either side facing it, the chapel behind the lane's middle
      const lane = toward + Math.PI / 2, u = [Math.cos(lane), Math.sin(lane)], v = [-u[1], u[0]], n = kart ? 7 : 10 + Math.floor(rnd() * 6);
      const ch = stand('chapel', { w: 9 + rnd() * 3, h: 7 + rnd() * 2 }, [s.at[0] - v[0] * 18, s.at[1] - v[1] * 18], lane - Math.PI / 2, out);
      const cz = ch.hi.map((v2, i) => (v2 + ch.lo[i]) / 2), csz = ch.hi.map((v2, i) => v2 - ch.lo[i]);
      things.push({ kind: 'chapel', interest: 'prop', at: cz, span: Math.min(Math.max(csz[0], csz[1]), csz[2]), top: ch.hi[2] });
      for (let k = 0; k < n; k++) {
        const along = (k - (n - 1) / 2) * (kart ? 15 : 17) + (rnd() - 0.5) * 4, side = k % 2 ? 1 : -1, back = Math.abs(along) < 14 && side < 0 ? 34 : 13 + rnd() * 4;
        const p = [s.at[0] + u[0] * along + v[0] * side * back, s.at[1] + u[1] * along + v[1] * side * back];
        stand('house', { w: 7 + rnd() * 4, h: 3.5 + rnd() * 3 }, p, lane + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 0.2, out);
      }
      faces.push(...paintPiece(out, K, { voxel: voxelAt(keep.dist(s.at).dv) }));
    } else if (s.kind === 'farm') {
      const yaw = rnd() * Math.PI * 2, u = [Math.cos(yaw), Math.sin(yaw)];
      stand('house', { w: 8 + rnd() * 3, h: 4 + rnd() * 2 }, s.at, yaw, out);
      stand('silo', { r: 2.5 + rnd(), h: 10 + rnd() * 6 }, [s.at[0] + u[0] * 14, s.at[1] + u[1] * 14], 0, out);
      stand('shed', { w: 12 + rnd() * 6, h: 6 + rnd() * 2 }, [s.at[0] - u[0] * 18 + u[1] * 6, s.at[1] - u[1] * 18 - u[0] * 6], yaw, out);
      faces.push(...paintPiece(out, K, { voxel: voxelAt(keep.dist(s.at).dv) }));
    } else if (s.kind === 'town') {
      // tower blocks round a centre, the tallest there
      const n = 9 + Math.floor(rnd() * 6), placed = [];
      for (let k = 0, tries = 0; k < n && tries < 80; tries++) {
        const t = rnd() * Math.PI * 2, d = k ? 30 + rnd() * (s.r - 40) : 0, p = [s.at[0] + Math.cos(t) * d, s.at[1] + Math.sin(t) * d];
        if (placed.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 34)) continue;
        const h = Math.max(24, 60 * (1 - (d / s.r) * 0.6) * (0.75 + 0.25 * rnd()));
        const b = stand('tower-block', { w: 16 + rnd() * 10, h }, p, toward + (rnd() - 0.5) * 0.3, out); placed.push(p); k++;
        if (!d) { const c = b.hi.map((v2, i) => (v2 + b.lo[i]) / 2); things.push({ kind: 'town', interest: 'prop', at: c, span: Math.min(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2]), top: b.hi[2] }); }
      }
      faces.push(...paintPiece(out, K, { voxel: voxelAt(keep.dist(s.at).dv) }));
    }
  }

  mark('settlement', n0);
  // ── woods: trees near, canopy far, groves in the infield; boulders on steep ground ──
  const near = kart ? 170 : 280, reach = kart ? 520 : 900, cap = kart ? 160 : 340, capFar = kart ? 60 : 130, thr = 0.32 - 0.7 * L.woods;
  const clearOf = (p, pad) => !(lake && Math.hypot(p[0] - lake.at[0], p[1] - lake.at[1]) < lake.R * 1.35 + pad) && !formations.some((f) => p[0] > f.box.lo[0] - pad && p[0] < f.box.hi[0] + pad && p[1] > f.box.lo[1] - pad && p[1] < f.box.hi[1] + pad) && !sites.some((s) => Math.hypot(s.at[0] - p[0], s.at[1] - p[1]) < s.r + pad) && !fieldAt(p[0], p[1]);
  const trees = [], canopy = [], scree = [], wooded = L.woods > 0.05;   // (a desert has none)
  const pitch = kart ? 13 : 20;
  const rx = keep.ring.map((p) => p[0]), ry = keep.ring.map((p) => p[1]);
  for (let x = Math.min(...rx) - near; x < Math.max(...rx) + near; x += pitch) for (let y = Math.min(...ry) - near; y < Math.max(...ry) + near; y += pitch) {
    const p = [x + (rnd() - 0.5) * pitch * 0.9, y + (rnd() - 0.5) * pitch * 0.9], K0 = keep.dist(p);
    if (!wooded || K0.d < 9 || K0.dv > near) continue;
    const m0 = fbm(p[0] / 240, p[1] / 240, S + 31, 3) - (K0.inside ? 0.22 : 0);
    if (m0 < thr || slopeAt(p[0], p[1]) > 0.5 || !clearOf(p, 8)) continue;
    trees.push({ p, d: K0.dv, h: (kart ? 7 : 9) + rnd() * (kart ? 6 : 10) });
  }
  trees.sort((p, q) => p.d - q.d);
  const kept = trees.slice(0, cap);
  for (let x = bc[0] - reach - (bx1 - bx0) / 2; x < bc[0] + reach + (bx1 - bx0) / 2; x += 64) for (let y = bc[1] - reach - (by1 - by0) / 2; y < bc[1] + reach + (by1 - by0) / 2; y += 64) {
    const p = [x + (rnd() - 0.5) * 56, y + (rnd() - 0.5) * 56], K0 = keep.dist(p);
    if (!wooded || K0.inside || K0.dv <= near || K0.dv > reach || K0.d < 20) continue;
    const m0 = fbm(p[0] / 240, p[1] / 240, S + 31, 3), g = groundAt(p[0], p[1]);
    if (m0 < thr || slopeAt(p[0], p[1]) > 0.55 || (L.snow && g - zFar > L.far * L.snow * 0.8) || !clearOf(p, 25)) continue;
    canopy.push({ p, d: K0.dv, r: (26 + rnd() * 16) * (kart ? 0.7 : 1) });
  }
  canopy.sort((p, q) => p.d - q.d).splice(capFar);
  for (let x = bc[0] - 700; x < bc[0] + 700; x += 38) for (let y = bc[1] - 700; y < bc[1] + 700; y += 38) {
    if (rnd() > L.rocks) continue;
    const p = [x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30], K0 = keep.dist(p);
    if (K0.d < 12 || slopeAt(p[0], p[1]) < 0.35 || !clearOf(p, 6)) continue;
    scree.push(p);
  }
  // each wood tile one paint (one voxel grid per tile on the voxel pole)
  const TILE = 160, tiles = new Map(), into = (p) => { const k = `${Math.floor(p[0] / TILE)},${Math.floor(p[1] / TILE)}`; if (!tiles.has(k)) tiles.set(k, { near: [], far: [], dv: keep.dist([(Math.floor(p[0] / TILE) + 0.5) * TILE, (Math.floor(p[1] / TILE) + 0.5) * TILE]).dv }); return tiles.get(k); };
  for (const t of kept) {
    const b = buildBlock(TRACK_BLOCKS.tree, { params: { h: t.h }, library: TRACK_BLOCKS, ring: 'mid', at: [r3(t.p[0]), r3(t.p[1]), r3(groundAt(t.p[0], t.p[1]) - 0.2)], yaw: rnd() * 360, seed: 1 });
    into(t.p).near.push(...b.faces);
  }
  // (a canopy: a wood's crowns as one mass, overlapping its neighbours; seated at its lowest ground)
  for (const c of canopy) { const lo = Math.min(...[0, 1, 2, 3].map((k) => groundAt(c.p[0] + Math.cos(k * 1.571) * c.r * 0.8, c.p[1] + Math.sin(k * 1.571) * c.r * 0.8))); lump(into(c.p).far, [c.p[0], c.p[1], lo - 1], { r: c.r, h: c.r * (0.42 + rnd() * 0.18), profile: [[1, 0], [0.97, 0.3], [0.75, 0.72], [0.35, 1]], sides: 8, jitter: 0.14, rnd, value: 0.4, vary: 0.02, group: 'str:motif' }); }
  for (const p of scree) { const rr = 1.2 + rnd() * 2.5; lump(into(p).far, [p[0], p[1], groundAt(p[0], p[1]) - rr * 0.3], { r: rr, h: rr * (0.7 + rnd() * 0.6), profile: BOULDER, sides: 6, rnd, value: 0.56 }); }
  n0 = faces.length;
  for (const k of [...tiles.keys()].sort()) { const t = tiles.get(k); if (t.near.length) faces.push(...paintPiece(t.near, K, { voxel: voxelAt(t.dv) })); }
  mark('trees', n0); n0 = faces.length;
  for (const k of [...tiles.keys()].sort()) { const t = tiles.get(k); if (t.far.length) faces.push(...paintPiece(t.far, K, { voxel: Math.max(6, voxelAt(t.dv)) })); }
  mark('canopy', n0); count.ground = ground.length;

  const out = plan.faces.slice(0, plan.ground[0]).concat(ground, plan.faces.slice(plan.ground[1]));
  return {
    plan: { ...plan, faces: out, ground: [plan.ground[0], plan.ground[0] + ground.length], terrain: T2, groundAt },
    faces, things,
    report: { land, settlement: SET ?? 'none', ...(lake ? { lake: { at: lake.at.map(r3), r: r3(lake.R) } } : {}), formations: formations.map((f) => ({ kind: f.kind, at: f.at })), sites: sites.map((s) => ({ kind: s.kind, at: s.at.map(r3) })), buildings: built.length, trees: kept.length, canopy: canopy.length, boulders: scree.length, faces: count },
  };
}
