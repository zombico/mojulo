/**
 * THE TOWN MAP — a town drawn path first. The ROUTES come before anything stands: the lane follows the trail and
 * sways with it; at the reveal it FORKS, and a fork is a place (the square, the hall at its back); a branch climbs
 * away from it, a back lane runs behind the frontage, a second branch drops to a pocket. Where the ground rises the
 * town steps up in TERRACES, each held by a retaining wall, and every route that crosses a wall climbs it by a flight
 * of steps whose going is the man-made index's (era/out-made.js `steps`). An upper lane runs along the first terrace;
 * the landmark stands where the branch ends, on the highest.
 *
 * Then the LOTS are cut from every route's frontage (and the square's edges) in walking order, each claiming its
 * ground on an occupancy grid so no lot crosses a route, a wall, a stair or another lot; each lot's use comes from its
 * CAUSE, its ring from its distance off the WALK (the routes a walker takes), and its building is the town's ANCHOR
 * STRUCTURE's language spoken on it (era/out-anchor-structure.js): one structure, spoken on every lot. The anchor is a
 * slice of street as well as a house, so every route is laid in its SECTION, stepped down the hierarchy: the road in
 * the anchor's paving on the lane (the kit's flags on a branch, earth on a back lane), a kerb, and a footway that
 * narrows on a branch and is gone behind; lots stand behind the footway. The town's HEARTBEAT (hamlet, village,
 * market, burgh) is its height: a band of storeys at the heart, another at the edge, the back lanes a storey lower;
 * every citizen keeps to the band where it stands. Among the citizens stands the SECONDARY, the anchor's counterpoint
 * (derived by contrast: upright, steep, turned in tone, crowned): set as punctuation at corners and the ends of runs,
 * then at a rhythm along each frontage, never two together, rising one or two storeys over the band and under the
 * hall. Door paths cross each front setback.
 *
 *   HEARTBEATS                    the town's height: storeys at the heart and at the edge
 *   readTownPlan(recipe)          the recipe against the TOWN_CARD rails; anything else refused, with what is allowed
 *   designTown(style, seed, rec)  → { card, routes, places, terraces, stairs, lots, paths, bounds, laws }
 *   placedFaces(lot)              a lot's building in town coordinates (x east along the lane, y north, z up, metres)
 *
 * Pure; seeded dice only. Nothing is placed in a world yet: this is the map the sheet draws.
 */
import { STRUCTURE_USES, STRUCTURE_LAWS, ringOf } from './out-structures.js';
import { decompileAnchor, speak, seedAnchor, secondaryOf } from './out-anchor-structure.js';
import { madeStyle, designPiece, madeLaws } from './out-made.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
const subSeed = (seed, key) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };
const dice = (seed) => { const R = mulberry32(seed); return { R, roll: ([lo, hi]) => r3(lo + (hi - lo) * R()) }; };

// ── polylines ───────────────────────────────────────────────────────────────────────────────────────────────────────
const lenOf = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
/** The point and unit tangent `s` m along a polyline (clamped to its ends). */
export function along(pts, s) {
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + L || i === pts.length - 1) { const t = L ? Math.max(0, Math.min(1, (s - acc) / L)) : 0; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t: [(b[0] - a[0]) / (L || 1), (b[1] - a[1]) / (L || 1)] }; }
    acc += L;
  }
  return { p: pts[0], t: [1, 0] };
}
/** The distance from a point to a polyline. */
export function distTo(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
/** A polyline's outline at `w` wide: the left edge out, the right edge back. */
export function ribbon(pts, w) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    L.push([r3(pts[i][0] + (n[0] * w) / 2), r3(pts[i][1] + (n[1] * w) / 2)]); R.push([r3(pts[i][0] - (n[0] * w) / 2), r3(pts[i][1] - (n[1] * w) / 2)]);
  }
  return [...L, ...R.reverse()];
}
const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

// ── the card ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE TOWN CARD: `length` of the lane (m), `sway` how far it swings with the trail (0…1, 1 = 6 m), `branches` how many
 * routes fork off it (0…2: the first climbs from the square, the second drops to a pocket), `levels` how many terraces
 * the climb steps up (0…2, each `rise` m), `back` a back lane behind the north frontage, `farms` the share of
 * farmsteads in the far ring. ROUTE ranks: width, whether a walker takes it, and the paving it is laid in.
 */
export const TOWN_CARD = Object.freeze({
  length: [90, 160, 120], sway: [0, 1, 0.4], branches: [0, 2, 2], levels: [0, 2, 2], rise: [2.8, 4.2], back: true, farms: [0, 1, 0.6],
  square: { w: [22, 26], d: [12, 14] }, pocket: 9, edgeClear: 1.6,
  // the section stepped down the hierarchy: the share of the anchor's footway each rank keeps, and its lamps' stride
  section: { lane: { foot: 1, lamps: 1 }, branch: { foot: 0.6, lamps: 1.4 }, upper: { foot: 0.6, lamps: 1.4 }, back: { foot: 0, lamps: 0 } },
  ranks: {
    lane: { w: 5, walk: true, paving: 'setts', read: 'the trail through town: the finest bond, kerbed both sides' },
    branch: { w: 3.6, walk: true, paving: 'flags', read: 'a route that forks off the lane: the kit\'s stone, kerbed' },
    upper: { w: 3.6, walk: true, paving: 'flags', read: 'the lane along a terrace, where a branch arrives' },
    back: { w: 3, walk: false, paving: 'earth', read: 'a lane behind the frontage: beaten earth, no kerbs' },
  },
});
export const PAVINGS = Object.freeze({
  setts: { read: 'square setts in courses across the way, a joint every course', unit: 0.32, joint: 0.012, kerb: true, group: 'town:stone', value: 0.62 },
  flags: { read: 'flagstones, irregular, joints wandering', unit: 0.6, joint: 0.018, kerb: true, group: 'town:stone', value: 0.7 },
  earth: { read: 'beaten earth, two ruts and a crown of grass', unit: 0, joint: 0, kerb: false, group: 'town:soil', value: 0.6 },
  fan: { read: 'setts laid in fans round the well: the square says it is a place', unit: 0.32, joint: 0.012, kerb: false, group: 'town:stone', value: 0.7 },
  slabs: { read: 'stepping slabs from a door to its lane', unit: 0.55, joint: 0.12, kerb: false, group: 'town:stone', value: 0.68 },
});
const LOT_W = { dwelling: [6.5, 11], shop: [6, 8.5], workshop: [9, 12], barn: [11, 14] };

/**
 * THE HEARTBEATS: a town's height as a curve, not a shape. `heart` the storeys a citizen keeps to at the square,
 * `edge` at the town's ends and in the far ring; between them the band eases with distance off the heart; a back lane
 * stands a storey lower. Workshops, barns and the focus and landmark keep their own heights.
 */
export const HEARTBEATS = Object.freeze({
  hamlet: { read: 'a few roofs round a well: one storey throughout, the hall and the tower over them', heart: [1, 1], edge: [1, 1] },
  village: { read: 'two storeys at the square, easing to one at the ends', heart: [2, 2], edge: [1, 1] },
  market: { read: 'a market street: two to three storeys at the square, two along the lane', heart: [2, 3], edge: [2, 2] },
  burgh: { read: 'a walled-town density: three to four at the heart, two or three to the ends', heart: [3, 4], edge: [2, 3] },
});
export const HEARTBEAT_IDS = Object.freeze(Object.keys(HEARTBEATS));
/** The band [lo, hi] of storeys a citizen keeps to at `t` (0 the heart, 1 the edge), a storey lower on a back lane. */
export function heartbeatBand(id, t, back = false) {
  const B = HEARTBEATS[id], s = Math.max(0, Math.min(1, t)), e = s * s * (3 - 2 * s), at = (k) => Math.round(B.heart[k] + (B.edge[k] - B.heart[k]) * e);
  const lo = at(0), hi = Math.max(lo, at(1));
  return back ? [Math.max(1, lo - 1), Math.max(1, hi - 1)] : [lo, hi];
}

/** A town recipe against the card's rails → { length, sway, branches, levels, back, farms }; anything else refused. */
export function readTownPlan(rec = {}) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) throw new Error('town: give a plan as { length?, sway?, branches?, levels?, back?, farms? }');
  const C = TOWN_CARD, out = {};
  for (const k of Object.keys(rec)) if (!['length', 'sway', 'branches', 'levels', 'back', 'farms', 'heartbeat', 'secondary', 'dress', 'paint', 'anchor'].includes(k)) throw new Error(`town: '${k}' is not a town setting (length, sway, branches, levels, back, farms, heartbeat, secondary, dress, paint, anchor)`);
  for (const k of ['length', 'sway', 'branches', 'levels', 'farms']) {
    const [lo, hi, def] = C[k], v = rec[k] ?? def;
    if (typeof v !== 'number' || v < lo || v > hi || (['branches', 'levels'].includes(k) && !Number.isInteger(v))) throw new Error(`town: ${k} is ${['branches', 'levels'].includes(k) ? 'a whole number' : 'a number'} ${lo}–${hi} (got ${JSON.stringify(rec[k])})`);
    out[k] = v;
  }
  if (rec.back !== undefined && typeof rec.back !== 'boolean') throw new Error('town: back is true or false');
  out.back = rec.back ?? C.back;
  if (rec.heartbeat !== undefined && !HEARTBEATS[rec.heartbeat]) throw new Error(`town: heartbeat is ${HEARTBEAT_IDS.join(', ')} (got ${JSON.stringify(rec.heartbeat)})`);
  out.heartbeat = rec.heartbeat ?? 'village';
  if (rec.secondary !== undefined && !(typeof rec.secondary === 'number' && rec.secondary >= 0 && rec.secondary <= 1)) throw new Error('town: secondary is a number from 0 (none) to 1 (as many as the rhythm allows)');
  out.secondary = rec.secondary ?? 0.5;
  out.anchor = rec.anchor;
  return out;
}

// ── the occupancy grid: what ground is claimed ──────────────────────────────────────────────────────────────────────
const CELL = 0.5;
function grid(x0, y0, x1, y1) {
  const W = Math.ceil((x1 - x0) / CELL), H = Math.ceil((y1 - y0) / CELL), cells = new Uint8Array(W * H);
  const at = (x, y) => { const i = Math.floor((x - x0) / CELL), j = Math.floor((y - y0) / CELL); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
  return {
    // claim the cells a test holds for; `box` [x0, y0, x1, y1] limits the sweep
    claim: (test, box = null) => {
      const [i0, j0, i1, j1] = box ? [Math.max(0, Math.floor((box[0] - x0) / CELL)), Math.max(0, Math.floor((box[1] - y0) / CELL)), Math.min(W - 1, Math.ceil((box[2] - x0) / CELL)), Math.min(H - 1, Math.ceil((box[3] - y0) / CELL))] : [0, 0, W - 1, H - 1];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (test(x0 + (i + 0.5) * CELL, y0 + (j + 0.5) * CELL)) cells[j * W + i] = 1;
    },
    free: (x, y) => { const k = at(x, y); return k >= 0 && !cells[k]; },
    take: (x, y) => { const k = at(x, y); if (k >= 0) cells[k] = 1; },
  };
}
/** The edges, corners and inner samples of a lot `w` × `d` from front-left corner `A` along ex, ey. */
const lotPoints = (A, ex, ey, w, d, step = 0.8) => {
  const pts = [], nu = Math.max(1, Math.ceil(w / step)), nv = Math.max(1, Math.ceil(d / step));
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = (w * i) / nu, v = (d * j) / nv; pts.push([A[0] + ex[0] * u + ey[0] * v, A[1] + ex[1] * u + ey[1] * v]); }
  return pts;
};

/**
 * The town, laid out: routes first, then the places where they meet, the terraces and their stairs, then the lots
 * cut from every frontage and their buildings. `style` is a resolved structure style (era/out-structures.js).
 */
/** A town's language: its recipe's `anchor` (an anchor id, an anchor's pieces, or { seed } for a seeded anchor), else
 *  its kit's. */
export function townLanguage(style, anchor) {
  if (anchor && typeof anchor === 'object' && anchor.seed !== undefined && !anchor.pieces) return decompileAnchor(seedAnchor(anchor.seed));
  return decompileAnchor(anchor ?? style.anchor);
}

export function designTown(style, seed = 1, recipe = {}) {
  const C = TOWN_CARD, T = readTownPlan(recipe), language = townLanguage(style, T.anchor), secondary = T.secondary > 0 ? secondaryOf(language) : null, D = dice(subSeed(seed, 'town')), made = madeStyle(style.kitId, seed);
  // the anchor's street, stepped down the ranks: the lane in its road's paving, its footway kept by each rank's share
  const SX = language.street, rankOf = (rank) => ({ ...C.ranks[rank], ...(rank === 'lane' ? { paving: SX.road.paving } : {}), foot: r3(C.section[rank].foot * SX.footway.w >= 0.9 ? C.section[rank].foot * SX.footway.w : 0), footPaving: SX.footway.paving, kerbH: SX.kerb.h });
  // ── 1 · the lane: the trail through town, swaying with it ──
  const amp = T.sway * 6, wave = D.roll([70, 110]), phase = D.roll([0, Math.PI * 2]);
  const laneY = (x) => r3(amp * Math.sin((2 * Math.PI * x) / wave + phase));
  const lane = []; for (let x = 0; x <= T.length + 1e-9; x += 4) lane.push([r3(x), laneY(x)]);
  const routes = [{ id: 'lane', rank: 'lane', pts: lane, ...rankOf('lane') }];
  const places = [], terraces = [], stairs = [];
  let bend = 0;
  // ── 2 · the fork at the reveal: a square; the branch climbs from its back ──
  const sFork = r3(T.length * D.roll([0.45, 0.58])), fork = along(lane, sFork);
  const sqW = D.roll(C.square.w), sqD = D.roll(C.square.d);
  const sqN = [-fork.t[1], fork.t[0]], sqA = [fork.p[0] + sqN[0] * (C.ranks.lane.w / 2), fork.p[1] + sqN[1] * (C.ranks.lane.w / 2)];
  const sqPoly = [[-sqW / 2, 0], [sqW / 2, 0], [sqW / 2, sqD], [-sqW / 2, sqD]].map(([u, v]) => [r3(sqA[0] + fork.t[0] * u + sqN[0] * v), r3(sqA[1] + fork.t[1] * u + sqN[1] * v)]);
  const sqCentre = [r3(sqA[0] + sqN[0] * (sqD / 2)), r3(sqA[1] + sqN[1] * (sqD / 2))];
  places.push({ id: 'square', beat: 'reveal', poly: sqPoly, centre: sqCentre, paving: 'fan', read: 'where the lane forks: the square, its well, the hall at its back' });
  // terraces: straight walls across the town, north of the lane and its back row
  const laneTop = Math.max(...lane.map((p) => p[1]));
  const yEdge = [];
  if (T.branches >= 1) for (let k = 0; k < T.levels; k++) yEdge.push(r3(laneTop + (T.back ? 62 : 34) + k * 30));
  const rises = yEdge.map((_, k) => D.roll(C.rise)), zAt = (x, y) => r3(yEdge.reduce((z, ye, k) => (y > ye ? z + rises[k] : z), 0));
  // the branch: up from the square's back, swaying a little, through each terrace, to the landmark
  if (T.branches >= 1) {
    const start = [r3(sqA[0] + sqN[0] * sqD), r3(sqA[1] + sqN[1] * sqD)], top = (yEdge.length ? yEdge[yEdge.length - 1] + 22 : start[1] + 34);
    bend = D.R() < 0.5 ? D.roll([-8, -4]) : D.roll([4, 8]);
    const pts = []; for (let y = start[1]; y <= top + 1e-9; y += 3) { const t = (y - start[1]) / (top - start[1]); pts.push([r3(start[0] + bend * Math.sin(Math.PI * t) + (sqN[0] * (y - start[1])) / Math.max(0.3, sqN[1])), r3(y)]); }
    routes.push({ id: 'branch', rank: 'branch', pts, ...rankOf('branch'), from: 'square' });
    // where the branch meets each wall: a terrace, a flight of steps (its going the man-made index's)
    yEdge.forEach((ye, k) => {
      const i = pts.findIndex((p) => p[1] >= ye), at = pts[Math.max(0, i)], X = designPiece('steps', made, seed + k).dims;
      // the flight's going: risers no higher than the kit's, the tread from the stride (2R + T), a landing every ten
      const n = Math.ceil(rises[k] / X.riserMax - 1e-9), R = r3(rises[k] / n), Tr = r3(X.blondel - 2 * R), flights = Math.ceil(n / 10), run = r3(n * Tr + (flights - 1) * X.landing);
      terraces.push({ level: k + 1, y: ye, z0: zAt(0, ye - 0.01), z1: zAt(0, ye + 0.01), rise: rises[k], x0: -12, x1: r3(T.length + 12) });
      stairs.push({ route: 'branch', level: k + 1, at: [at[0], ye], dir: [0, -1], width: C.ranks.branch.w, z0: zAt(0, ye - 0.01), rise: rises[k], risers: n, R, T: Tr, run, flights, landing: X.landing, laws: madeLaws('steps', { blondel: r3(2 * R + Tr), R, T: Tr, uneven: 0, flight: Math.ceil(n / flights) }) });
    });
    // the upper lane along the first terrace, where the branch arrives
    if (yEdge.length) {
      const yU = r3(yEdge[0] + 14), xm = start[0], up = []; for (let x = xm - 40; x <= xm + 40 + 1e-9; x += 4) up.push([r3(x), yU]);
      routes.push({ id: 'upper', rank: 'upper', pts: up, ...rankOf('upper'), from: 'branch' });
      places.push({ id: 'landing', beat: 'terrace', centre: [r3(xm + bend * 0.3), yU], read: 'where the branch reaches the terrace: the upper lane meets it' });
    }
    places.push({ id: 'top', beat: 'landmark', centre: pts[pts.length - 1], read: 'the branch\'s end, on the highest ground: the landmark' });
  }
  // the back lane, behind the north frontage
  // the back lane, behind the north frontage; behind the square it yields, leaving the hall its ground
  if (T.back) {
    const xs0 = Math.min(...sqPoly.map((p) => p[0])) - 18, xs1 = Math.max(...sqPoly.map((p) => p[0])) + 18, yMin = Math.max(...sqPoly.map((p) => p[1])) + 0.6 + STRUCTURE_USES.hall.lot.d + 2.6;
    const yield_ = (x) => { const d = x < xs0 ? xs0 - x : x > xs1 ? x - xs1 : 0; return d >= 10 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * d) / 10); };
    const back = lane.filter((p) => p[0] >= 6 && p[0] <= T.length - 6).map(([x, y]) => [x, r3(Math.max(y + 36, y + 36 + (yMin - y - 36) * yield_(x)))]);
    routes.push({ id: 'back', rank: 'back', pts: back, ...rankOf('back') });
  }
  // the second branch, south from an earlier fork, to a pocket
  if (T.branches >= 2) {
    const s2 = r3(T.length * D.roll([0.2, 0.3])), f2 = along(lane, s2), n2 = [f2.t[1], -f2.t[0]], L2 = 30, pts = [];
    const wayAt = (s) => [r3(f2.p[0] + n2[0] * s + Math.sin(s / 9) * 1.5), r3(f2.p[1] + n2[1] * s)];
    // the way stops at the pocket's edge: the pocket itself is a place, its well at the heart
    for (let s = C.ranks.lane.w / 2; s <= L2 - C.pocket / 2 + 1e-9; s += 3) pts.push(wayAt(s));
    routes.push({ id: 'pocket-way', rank: 'branch', pts, ...rankOf('branch'), from: 'lane' });
    const end = wayAt(L2);
    places.push({ id: 'pocket', beat: 'pocket', centre: end, r: C.pocket / 2, poly: Array.from({ length: 10 }, (_, k) => [r3(end[0] + (C.pocket / 2) * Math.cos((k * Math.PI) / 5)), r3(end[1] + (C.pocket / 2) * Math.sin((k * Math.PI) / 5))]), paving: 'flags', read: 'a dead end off the lane with something in it: a well, a workshop' });
  }
  places.push({ id: 'trailhead', beat: 'trailhead', centre: lane[0], read: 'where the trail comes in: carts and work' });

  // ── 3 · the ground claimed before any lot: routes, places, walls, stairs ──
  const walk = routes.filter((r) => r.walk), xs = routes.flatMap((r) => r.pts.map((p) => p[0])), ys = routes.flatMap((r) => r.pts.map((p) => p[1]));
  const bounds = { x0: Math.floor(Math.min(...xs) - 30), x1: Math.ceil(Math.max(...xs) + 30), y0: Math.floor(Math.min(...ys) - 75), y1: Math.ceil(Math.max(...ys) + 30) };
  const G = grid(bounds.x0, bounds.y0, bounds.x1, bounds.y1);
  const boxOf = (pts, m) => [Math.min(...pts.map((p) => p[0])) - m, Math.min(...pts.map((p) => p[1])) - m, Math.max(...pts.map((p) => p[0])) + m, Math.max(...pts.map((p) => p[1])) + m];
  for (const r of routes) G.claim((x, y) => distTo(r.pts, x, y) < r.w / 2 + r.foot + 0.25, boxOf(r.pts, r.w + r.foot));
  for (const p of places) if (p.poly) G.claim((x, y) => inPoly(p.poly, x, y), boxOf(p.poly, 1));
  for (const t of terraces) G.claim((x, y) => Math.abs(y - t.y) < C.edgeClear);
  for (const s of stairs) G.claim((x, y) => Math.abs(x - s.at[0]) < s.width / 2 + 0.8 && y <= s.at[1] + 0.2 && y >= s.at[1] - s.run - 0.6);

  // ── 4 · the lots: cut from every frontage in walking order ──
  const lots = [];
  const useFor = (r, p) => {
    if (r.id === 'pocket-way') return 'workshop';
    if (r.rank === 'back' || r.rank === 'upper') return 'dwelling';
    if (Math.hypot(p[0] - sqCentre[0], p[1] - sqCentre[1]) < 30) return 'shop';
    if (r.id === 'lane' && p[0] < 26) return D.R() < 0.5 ? 'barn' : 'workshop';
    return 'dwelling';
  };
  const tryLot = (frame, w, d, use) => {
    const { A, ex, ey } = frame, minD = STRUCTURE_USES[use].lot.d;
    for (let dd = d; dd >= minD - 1e-9; dd -= 1) {
      const pts = lotPoints(A, ex, ey, w, dd), z = zAt(...pts[0]);
      if (pts.every(([x, y]) => G.free(x, y) && zAt(x, y) === z)) { for (const [x, y] of lotPoints(A, ex, ey, w, dd, 0.4)) G.take(x, y); return r3(dd); }
    }
    return 0;
  };
  // the focus: the hall on the square's back edge, beside the branch's mouth, facing the square; where that ground is
  // taken it slides along the edge, or narrows, before it gives up
  {
    const ex = [fork.t[0], fork.t[1]], ey = sqN, m = C.ranks.branch.w / 2 + (routes.find((x) => x.id === 'branch')?.foot ?? 0) + 2.2;
    for (const w of [15, 13, 11]) {
      // the side away from the branch's bend first, sliding away from the branch; then the other side
      const away = bend > 0 ? -1 : 1, starts = T.branches < 1 ? [[-w / 2, [0, -3, 3, -6, 6]]] : [[away < 0 ? -m - w : m, [0, 1.5, 3, 4.5].map((x) => x * away)], [away < 0 ? m : -m - w, [0, 1.5, 3, 4.5].map((x) => -x * away)]];
      const tries = starts.flatMap(([base, dxs]) => dxs.map((dx) => base + dx));
      const hit = tries.map((u0) => [r3(sqA[0] + ey[0] * (sqD + 0.6) + ex[0] * u0), r3(sqA[1] + ey[1] * (sqD + 0.6) + ex[1] * u0)]).reduce((got, A) => got ?? ((d) => (d ? { A, d } : null))(tryLot({ A, ex, ey }, w, 22, 'hall')), null);
      if (hit) { lots.push({ route: 'square', side: 'back', A: hit.A, ex, ey, w, d: hit.d, use: 'hall', focus: true }); break; }
    }
  }
  // the landmark: the tower at the branch's end, facing back down it
  if (T.branches >= 1) {
    const r = routes.find((x) => x.id === 'branch'), end = r.pts[r.pts.length - 1], ey = [0, 1], ex = [1, 0], A = [r3(end[0] - 3), r3(end[1] + r.w / 2 + r.foot + 0.6)];
    const d = tryLot({ A, ex, ey }, 6, 7, 'tower');
    if (d) lots.push({ route: 'branch', side: 'end', A, ex, ey, w: 6, d, use: 'tower', dare: true });
  }
  // each route's two frontages, in walking order
  const frontages = [];
  for (const r of routes) for (const side of [1, -1]) frontages.push({ r, side });
  for (const { r, side } of frontages) {
    const L = lenOf(r.pts);
    let s = r.rank === 'lane' ? 1 : 2, k = 0;
    while (s < L - 4) {
      const mid = along(r.pts, s + 4), use = useFor(r, mid.p), w = D.roll(LOT_W[use]), c = along(r.pts, s + w / 2);
      const n = [-c.t[1] * side, c.t[0] * side], ey = n, ex = [n[1], -n[0]];
      const A = [r3(c.p[0] + n[0] * (r.w / 2 + r.foot + 0.6) - ex[0] * (w / 2)), r3(c.p[1] + n[1] * (r.w / 2 + r.foot + 0.6) - ex[1] * (w / 2))];
      const d = tryLot({ A, ex, ey }, w, r.rank === 'back' ? 15 : D.roll([14, 20]), use);
      if (d) { lots.push({ route: r.id, side: side > 0 ? 'left' : 'right', A, ex, ey, w: r3(w), d, use, k: k++, s: r3(s) }); s = r3(s + w + (D.R() < 0.22 ? D.roll([2, 3]) : 0)); }
      else s = r3(s + 1.5);
    }
  }
  // the far ring: farmsteads in their fields south of the town, a barn and a house to each
  const farms = [];
  if (T.farms > 0) {
    const yF = Math.min(...lane.map((p) => p[1])) - 44;
    for (let x = 4, k = 0; x < T.length - 16; k++) {
      if (D.R() < T.farms) {
        // the yard by the lane side, the field beyond it
        const field = [[x - 2, yF - 38], [x + 28, yF - 38], [x + 28, yF - 18], [x - 2, yF - 18]].map((p) => p.map(r3));
        farms.push({ field });
        for (const [use, w, dx] of [['barn', 13, 0], ['dwelling', 9, 15]]) { const A = [r3(x + dx), r3(yF)], ex = [1, 0], ey = [0, -1]; const d = tryLot({ A: [A[0] + w, A[1]], ex: [-1, 0], ey }, w, 14, use); if (d) lots.push({ route: 'farm', side: 'farm', A: [r3(A[0] + w), A[1]], ex: [-1, 0], ey, w, d, use, k: k % 2, farm: true }); }
      }
      x = r3(x + 34);
    }
  }

  // ── 5 · rings, corners, then the buildings ──
  const forks = [sqCentre, ...places.filter((p) => p.id === 'landing' || p.id === 'pocket').map((p) => p.centre)];
  for (const l of lots) {
    l.front = [r3(l.A[0] + l.ex[0] * (l.w / 2)), r3(l.A[1] + l.ex[1] * (l.w / 2))];
    l.off = r3(Math.min(...walk.map((r) => distTo(r.pts, ...l.front))) - (C.ranks.lane.w / 2));
    l.ring = l.focus || l.dare ? 'near' : ringOf(Math.max(0, l.off));
    l.z = zAt(l.A[0] + l.ey[0] * 0.5, l.A[1] + l.ey[1] * 0.5);
    l.corner = !l.focus && !l.dare && !l.farm && forks.some((f) => Math.hypot(l.front[0] - f[0], l.front[1] - f[1]) < l.w / 2 + 9);
    // the heartbeat where the lot stands: off the heart along the town, the far ring at the edge
    l.band = heartbeatBand(T.heartbeat, l.ring === 'far' ? 1 : Math.hypot(l.front[0] - sqCentre[0], l.front[1] - sqCentre[1]) / (T.length * 0.55), l.route === 'back');
  }
  // the secondaries: punctuation among the citizens. Each frontage in walking order: a corner or a run's end takes one
  // first, then one every few lots (fewer as `secondary` falls), never two together
  if (secondary) {
    const every = Math.round(9 - 6 * T.secondary);
    for (const key of new Set(lots.map((l) => `${l.route}:${l.side}`))) {
      const run = lots.filter((l) => `${l.route}:${l.side}` === key && l.use === 'dwelling' && !l.farm && l.ring !== 'far').sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
      let gap = Math.ceil(every / 2);
      run.forEach((l, i) => {
        const marked = l.corner || i === run.length - 1, prevSec = i > 0 && run[i - 1].secondary;
        // a sparse town (secondary under 0.4) keeps only the rhythm; a fuller one marks corners and ends too
        if (!prevSec && ((marked && gap >= 2 && T.secondary >= 0.4) || gap >= every)) { l.secondary = true; gap = 0; } else gap++;
      });
    }
  }
  const prev = new Map();
  let rerolls = 0;
  const designLot = (l, crown = 0) => {
    // each lot its own seed: the hash, spread by the lot's index so no two near lots can share one
    let s = subSeed(seed, `lot:${l.route}:${l.side}:${l.k ?? 0}:${l.s ?? 0}`) + 100003 * lots.indexOf(l);
    if (l.ring === 'mid') s = subSeed(seed, `mid:${l.route}:${l.side}:${Math.floor((l.k ?? 0) / 2)}`);
    if (l.ring === 'far') s = subSeed(seed, `far:${l.use}`);
    const lot = l.ring === 'mid' && (l.k ?? 0) % 2 ? lots.find((x) => x.route === l.route && x.side === l.side && x.k === l.k - 1) : null;
    let d = speak(language, l.use, { w: l.w, d: l.d }, style, s, { ring: l.ring, corner: l.corner, accent: !!l.focus, crown, band: l.band });
    // the mid ring repeats in pairs: the second of a pair takes its partner's design if it fits its lot
    if (lot?.design && !lot.secondary && lot.w <= l.w + 1e-9 && lot.d <= l.d + 1e-9 && lot.use === l.use) d = speak(language, l.use, { w: lot.w, d: lot.d }, style, lot.design.seed, { ring: l.ring, corner: lot.corner, band: lot.band });
    if (l.ring === 'near' && !crown) {
      const key = `${l.route}:${l.side}`;
      for (let k = 1; k <= 10 && prev.get(key) && d.sig === prev.get(key); k++) { rerolls++; d = speak(language, l.use, { w: l.w, d: l.d }, style, s + 977 * k, { ring: l.ring, corner: l.corner, band: l.band }); }

      prev.set(key, d.sig);
    }
    l.design = d;
    // the building sits in its lot: centred on the frontage, back from it by its own front setback
    const off = (l.w - d.dims.W0) / 2;
    l.place = { o: [r3(l.A[0] + l.ex[0] * off + l.ey[0] * d.dims.front), r3(l.A[1] + l.ex[1] * off + l.ey[1] * d.dims.front), l.z], ex: l.ex, ey: l.ey };
    l.crown = r3(l.z + d.measures.ridge);
  };
  const dares = (l) => l.focus || l.dare;
  const sit = (l, d) => {
    l.design = d;
    // the building sits in its lot: centred on the frontage, back from it by its own front setback
    const off = (l.w - d.dims.W0) / 2;
    l.place = { o: [r3(l.A[0] + l.ex[0] * off + l.ey[0] * d.dims.front), r3(l.A[1] + l.ex[1] * off + l.ey[1] * d.dims.front), l.z], ex: l.ex, ey: l.ey };
    l.crown = r3(l.z + d.measures.ridge);
  };
  for (const l of lots.filter((x) => !dares(x) && !x.secondary).sort((a, b) => (a.route + a.side).localeCompare(b.route + b.side) || (a.s ?? 0) - (b.s ?? 0))) designLot(l);
  const crowns = lots.filter((l) => l.ring === 'near' && !dares(l) && !l.secondary).map((l) => l.crown).sort((a, b) => a - b), median = crowns[Math.floor(crowns.length / 2)] ?? 8;
  // the focus and the landmark are told how tall to stand over the street; the landmark's own ground counts
  for (const l of lots.filter(dares)) designLot(l, l.focus ? Math.max(8.2, 1.3 * median) : Math.max(0, 1.7 * median - l.z));
  // then the secondaries, last: each takes the lowest band over its own that rises over both its neighbours, and
  // stands under the hall round the square; one that cannot is a citizen after all
  const hall = lots.find((l) => l.focus), sqNear = (l) => Math.hypot(l.front[0] - sqCentre[0], l.front[1] - sqCentre[1]) < 45;
  const runOf = (l) => lots.filter((x) => x.route === l.route && x.side === l.side).sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
  const besides = (l) => { const run = runOf(l), i = run.indexOf(l); return [run[i - 1], run[i + 1]].filter((x) => x && !x.focus && x.design); };
  for (const l of lots.filter((x) => x.secondary)) {
    let s = subSeed(seed, `secondary:${l.route}:${l.side}:${l.k ?? 0}:${l.s ?? 0}`) + 100003 * lots.indexOf(l);
    // the mid ring repeats: its secondaries are one design
    if (l.ring === 'mid') s = subSeed(seed, 'mid:secondary');
    const over = besides(l).filter((x) => !x.secondary), want = over.length ? Math.max(...over.map((x) => x.crown)) + 1 : 1.12 * median, ceiling = hall && sqNear(l) ? hall.crown - 0.8 : Infinity;
    const hi = l.band[1], tries = [[hi + 1, hi + 1 + (s % 2)], [hi + 1, hi + 1], [hi + 2, hi + 2], [hi + 3, hi + 3]];
    let got = null;
    for (const band of tries) { const d = speak(secondary, l.use, { w: l.w, d: l.d }, style, s, { ring: l.ring, band }); const c = l.z + d.measures.ridge; if (c >= want - 1e-9 && c <= ceiling) { got = d; break; } }
    if (!got) { l.secondary = false; designLot(l); continue; }
    sit(l, got);
    l.design.why.push(`the secondary: rises over its neighbours (${r3(want)} m)${ceiling < Infinity ? `, under the hall (${hall.crown} m)` : ''}`);
    if (l.corner) l.design.why.push('on a corner: the secondary marks it');
  }
  // a lot that was to be a secondary and became a citizen answers its neighbours' designs, not the run's last
  for (const l of lots.filter((x) => x.secondary === false && x.ring === 'near')) { const sigs = besides(l).map((x) => x.design.sig); let k = 0; while (sigs.includes(l.design.sig) && k < 10) { k++; rerolls++; sit(l, speak(language, l.use, { w: l.w, d: l.d }, style, subSeed(seed, `again:${lots.indexOf(l)}:${k}`), { ring: l.ring, corner: l.corner, band: l.band })); } }

  // ── 6 · door paths across each front setback ──
  const paths = [];
  for (const l of lots) {
    const d = l.design, f = d.dims.front;
    if (l.farm || f < 1.1) continue;
    const doorU = d.faces.find((x) => x.part === 'door' || x.part === 'accent' || (x.part === 'shutter' && x.corners[0][2] < 0.05))?.corners ?? null;
    const u = doorU ? doorU.reduce((s, c) => s + c[0], 0) / doorU.length : d.dims.W0 / 2;
    const o = l.place.o, at = (uu, vv) => [r3(o[0] + l.ex[0] * uu + l.ey[0] * vv), r3(o[1] + l.ex[1] * uu + l.ey[1] * vv)];
    paths.push({ lot: lots.indexOf(l), pts: [at(u, 0), at(u, -f - 0.35)], w: 1.1, z: l.z, paving: 'slabs' });
  }

  // ── 7 · the town's laws ──
  const near = lots.filter((l) => l.ring === 'near'), counters = lots.filter((l) => l.use === 'shop');
  let alike = 0;
  for (const key of new Set(near.filter((l) => !dares(l)).map((l) => `${l.route}:${l.side}`))) { const run = near.filter((l) => `${l.route}:${l.side}` === key && !dares(l)).sort((a, b) => a.s - b.s); for (let i = 1; i < run.length; i++) if (run[i].design.sig === run[i - 1].design.sig) alike++; }
  const tower = lots.find((l) => l.dare);
  // the mid ring's repeats are counted among the citizens; its secondaries are one design of their own
  const midL = lots.filter((l) => l.ring === 'mid' && !l.secondary), midS = new Set(lots.filter((l) => l.ring === 'mid' && l.secondary).map((l) => l.design.seed)), farL = lots.filter((l) => l.ring === 'far');
  const lane0 = designPiece('paving', made, seed, { width: Math.min(1.8, 1.2 + 0.1) });
  const want = (id) => STRUCTURE_LAWS.find((x) => x.id === id)?.want ?? TOWN_LAWS.find((x) => x.id === id).want;
  // the street holds its lines: every citizen on a frontage the same storey and pitch
  // (a secondary keeps the storey lines; its pitch is its own, the counterpoint's)
  const citizens = lots.filter((l) => (l.use === 'dwelling' || l.use === 'shop') && !dares(l)), broke = [];
  for (const key of new Set(citizens.map((l) => `${l.route}:${l.side}`))) { const run = citizens.filter((l) => `${l.route}:${l.side}` === key), H = new Set(run.map((l) => l.design.dims.storeyH)), Pt = new Set(run.filter((l) => !l.secondary).map((l) => l.design.dims.pitch)); if (H.size > 1 || Pt.size > 1) broke.push(`${key}: ${[...H].join('/')} m, ${[...Pt].join('/')}°`); }
  const secs = lots.filter((l) => l.secondary), together = [];
  for (const key of new Set(secs.map((l) => `${l.route}:${l.side}`))) { const run = lots.filter((l) => `${l.route}:${l.side}` === key).sort((a, b) => (a.s ?? 0) - (b.s ?? 0)); for (let i = 1; i < run.length; i++) if (run[i].secondary && run[i - 1].secondary) together.push(key); }
  const risen = secs.filter((l) => besides(l).filter((x) => !x.secondary).every((x) => l.crown >= x.crown + 1 - 1e-9)), hallC = hall?.crown ?? Infinity, under = secs.filter((l) => !sqNear(l) || l.crown < hallC);
  const beat = citizens.filter((l) => l.design.measures.band), kept = beat.filter((l) => l.design.measures.band.ok);
  const clear = lots.filter((l) => !l.farm).every((l) => routes.every((r) => [l.A, [l.A[0] + l.ex[0] * l.w, l.A[1] + l.ex[1] * l.w]].every(([x, y]) => distTo(r.pts, x, y) >= r.w / 2 + r.foot - 1e-6)));
  const laws = [
    { law: 'routes-first', ok: lots.every((l) => l.route), value: `${routes.length} routes, ${places.length} places, then ${lots.length} lots` },
    { law: 'forks-are-places', ok: routes.filter((r) => r.from).every((r) => places.some((p) => (r.from === 'square' && p.id === 'square') || (r.from === 'branch' && p.id === 'landing') || (r.from === 'lane' && p.id === 'pocket'))), value: routes.filter((r) => r.from).map((r) => `${r.id} ← ${r.from}`).join(', ') || 'no forks' },
    { law: 'levels-climbed', ok: stairs.length === terraces.length && stairs.every((s) => s.laws.every((x) => x.ok !== false)), value: stairs.map((s) => `${s.rise} m in ${s.risers} × ${s.R}/${s.T}`).join('; ') || 'one level' },
    { law: 'lots-clear', ok: true, value: 'claimed on the grid: no lot on a route, a wall, a stair or a lot' },
    { law: 'paving', ok: lane0.laws.every((x) => x.ok !== false), value: `the lane in ${made.tokens.bond}` },
    { law: 'by-cause', ok: counters.every((l) => Math.hypot(l.front[0] - sqCentre[0], l.front[1] - sqCentre[1]) < 30 + l.w), value: `${counters.length} counters by the square` },
    { law: 'repeat-adjacent', ok: alike === 0, value: `${alike} alike (${rerolls} re-rolled)` },
    { law: 'corner', ok: lots.filter((l) => l.corner).every((l) => l.design.why.some((w) => w.startsWith('on a corner'))), value: `${lots.filter((l) => l.corner).length} corners` },
    { law: 'accent', ok: lots.filter((l) => l.design.faces.some((f) => f.part === 'accent')).length === 1, value: `${lots.filter((l) => l.design.faces.some((f) => f.part === 'accent')).length}` },
    { law: 'focus', ok: !!hall && hall.crown >= 1.25 * median - 1e-9 && (!tower || tower.crown >= 1.6 * median - 1e-9), value: `hall ${hall?.crown}, tower ${tower?.crown ?? '—'} (on ${tower?.z ?? 0} m), median ${median}` },
    { law: 'street-holds', ok: broke.length === 0, value: broke.length ? broke.join('; ') : `${citizens.length} citizens: one storey height and one pitch to each frontage` },
    { law: 'heartbeat', ok: kept.length === beat.length, value: `${kept.length} of ${beat.length} citizens in the ${T.heartbeat}'s band` },
    { law: 'section', ok: clear, value: `every lot behind its footway (${routes.map((r) => `${r.id} ${r.foot ? `${r.foot} m` : 'none'}`).join(', ')})` },
    { law: 'secondary', ok: together.length === 0 && risen.length === secs.length && under.length === secs.length, value: secondary ? `${secs.length} secondaries among ${citizens.length} citizens: ${together.length} together, ${risen.length} rising a metre over both neighbours, ${under.length} under the hall round the square` : 'none (secondary 0, or an anchor of pieces only)' },
    { law: 'distinct-radius', ok: new Set(near.map((l) => l.design.seed)).size === near.length && new Set(midL.map((l) => l.design.seed)).size <= new Set(midL.map((l) => `${l.route}:${l.side}:${Math.floor((l.k ?? 0) / 2)}`)).size + 1 && midS.size <= 1 && new Set(farL.map((l) => l.design.seed)).size <= 2, value: `near ${new Set(near.map((l) => l.design.seed)).size}/${near.length}, mid ${new Set(midL.map((l) => l.design.seed)).size}/${midL.length}, far ${new Set(farL.map((l) => l.design.seed)).size}/${farL.length}` },
  ].map((l) => ({ ...l, want: want(l.law) }));
  // the map's frame: everything built, a margin round it
  const all = [...routes.flatMap((r) => r.pts), ...lots.flatMap((l) => [l.A, [l.A[0] + l.ex[0] * l.w + l.ey[0] * l.d, l.A[1] + l.ex[1] * l.w + l.ey[1] * l.d]]), ...farms.flatMap((f) => f.field)];
  const frame = { x0: Math.floor(Math.min(...all.map((p) => p[0])) - 10), x1: Math.ceil(Math.max(...all.map((p) => p[0])) + 10), y0: Math.floor(Math.min(...all.map((p) => p[1])) - 8), y1: Math.ceil(Math.max(...all.map((p) => p[1])) + 8) };
  for (const t of terraces) { t.x0 = frame.x0; t.x1 = frame.x1; }
  return { card: T, seed, kitId: style.kitId, language, secondary, heartbeat: T.heartbeat, routes, places, terraces, stairs, lots, paths, farms, bounds: frame, median, laws, made: { bond: made.tokens.bond } };
}

/** The laws a town adds to the street's (era/out-structures.js STRUCTURE_LAWS, layer street). */
export const TOWN_LAWS = Object.freeze([
  { id: 'routes-first', want: 'every lot is cut from a route\'s frontage (or a place\'s edge)', why: 'path flow first: the town is its routes before it is its buildings' },
  { id: 'forks-are-places', want: 'every route that forks off another starts at a place (a square, a landing, a pocket)', why: 'where ways meet, people stop: a fork is somewhere' },
  { id: 'levels-climbed', want: 'every terrace a route crosses is climbed by a flight that holds the steps\' laws', why: 'a level the walk cannot climb is a wall; a stair out of stride trips' },
  { id: 'lots-clear', want: 'no lot on a route, a retaining wall, a stair or another lot', why: 'the ground is claimed once, in the order the walker meets it' },
  { id: 'paving', want: 'the lane\'s paving holds the man-made paving laws (joints, crossfall, kerbs, unit)', why: 'laid stone reads as laid' },
  { id: 'street-holds', want: 'every citizen on a frontage shares the storey height and the pitch the anchor gives', why: 'a street reads as one when its eaves and its lights\' heads line up; households vary in what is theirs' },
  { id: 'heartbeat', want: 'every citizen keeps to the heartbeat\'s band where it stands (a corner a storey over; a shell as high as its rise allows)', why: 'a town\'s height is a curve off its heart, not a roll per house' },
  { id: 'secondary', want: 'the secondaries never stand two together, each rises a metre over both its neighbours and stands under the hall round the square', why: 'punctuation: a counterpoint marks a run only if it is rare and clear of the thing that matters' },
  { id: 'section', want: 'every lot stands behind its route\'s footway', why: 'the anchor is a slice of street too: the walk is the street\'s, the lot begins behind it' },
]);

/** A lot's building (and its tile, unless `tile` is false) in town coordinates, each face carrying `paint` if given. */
export function placedFaces(l, { tile = true, paint = null } = {}) {
  const { o, ex, ey } = l.place, map = (p) => [r3(o[0] + ex[0] * p[0] + ey[0] * p[1]), r3(o[1] + ex[1] * p[0] + ey[1] * p[1]), r3(o[2] + p[2])];
  const out = [];
  for (const f of [...l.design.faces, ...(tile ? l.design.tile : [])]) out.push({ ...f, corners: f.corners.map(map), normal: [ex[0] * f.normal[0] + ey[0] * f.normal[1], ex[1] * f.normal[0] + ey[1] * f.normal[1], f.normal[2]].map(r3), ...(paint ? { paint } : {}) });
  return out;
}
