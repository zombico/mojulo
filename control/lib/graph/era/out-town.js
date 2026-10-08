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
 * hall. Door paths cross each front setback. A town may be FORTIFIED (the dial `fortified`, era/out-fortress.js: the lord's
 * land inside its wards) or stand outside a CASTLE (`castle`, era/out-castle.js: the castle on the highest ground at
 * the branch's end, the branch brought to its bridge, its keep the landmark).
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
import { BOUNDARY_FORMS, BOUNDARY_HEIGHTS, WALK_FORMS, WALK_CLEAR, boundaryRoles, roleHeight, build as EB } from './out-anchor-elements.js';
import { STRUCTURE_RINGS, eyeSpot } from './out-structures.js';
import { composeFort, fortDial, octagon, build as FB } from './out-fortress.js';
import { readCastlePlan, castleMoat, designCastle, castleFaces } from './out-castle.js';

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
  section: { lane: { foot: 1, lamps: 1 }, branch: { foot: 0.6, lamps: 1.4 }, upper: { foot: 0.6, lamps: 1.4 }, back: { foot: 0, lamps: 0 }, approach: { foot: 0, lamps: 1.4 } },
  ranks: {
    lane: { w: 5, walk: true, paving: 'setts', read: 'the trail through town: the finest bond, kerbed both sides' },
    branch: { w: 3.6, walk: true, paving: 'flags', read: 'a route that forks off the lane: the kit\'s stone, kerbed' },
    upper: { w: 3.6, walk: true, paving: 'flags', read: 'the lane along a terrace, where a branch arrives' },
    back: { w: 3, walk: false, paving: 'earth', read: 'a lane behind the frontage: beaten earth, no kerbs' },
    approach: { w: 4, walk: true, paving: 'flags', read: 'a fortified town\'s way in: under the wall outside the ditch, then a turn into the gate' },
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
  for (const k of Object.keys(rec)) if (!['length', 'sway', 'branches', 'levels', 'back', 'farms', 'heartbeat', 'secondary', 'fortified', 'fort', 'castle', 'dress', 'paint', 'anchor'].includes(k)) throw new Error(`town: '${k}' is not a town setting (length, sway, branches, levels, back, farms, heartbeat, secondary, fortified, fort, castle, dress, paint, anchor)`);
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
  if (rec.fortified !== undefined && !(typeof rec.fortified === 'number' && rec.fortified >= 0 && rec.fortified <= 1)) throw new Error('town: fortified is a number from 0 (an open town) to 1 (a fortified town, the lord\'s land in its inmost ward)');
  out.fortified = rec.fortified ?? 0;
  out.fort = rec.fort;
  // a castle is the lord's land drawn tight, the town outside it: one or the other, never a fortified town round a castle
  if (rec.castle !== undefined && rec.castle !== false) { if (out.fortified > 0) throw new Error('town: a castle (the town outside it) or a fortified town (the lord\'s land inside its wards), not both'); readCastlePlan(rec.castle); out.castle = rec.castle; }
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

/** A rank's walk in the anchor's form, at `foot` wide: its edge, how high it stands, and the verge it keeps. */
function walkOf(SX, foot) {
  const form = SX.footway.form ?? 'kerbed', W = WALK_FORMS[form], edge = form === 'flush' ? 0.35 : SX.kerb.w;
  return { walkForm: form, edge: W.edge, kerbH: W.lift ? SX.kerb.h : form === 'verge' ? 0.02 : 0, verge: form === 'verge' ? r3(Math.min(SX.footway.verge ?? 0.6, Math.max(0, foot - edge - WALK_CLEAR))) : 0 };
}

export function designTown(style, seed = 1, recipe = {}) {
  const C = TOWN_CARD, T = readTownPlan(recipe), language = townLanguage(style, T.anchor), secondary = T.secondary > 0 ? secondaryOf(language) : null, D = dice(subSeed(seed, 'town')), made = madeStyle(style.kitId, seed);
  // the anchor's street, stepped down the ranks: the lane in its road's paving, its footway kept by each rank's share
  // the dial: a fortified town is the town drawn tighter, its terraces become wards, the walk climbs them
  const FD = T.fortified > 0 ? fortDial(T.fortified) : null, FT = FD ? composeFort(T.fort ?? 'crenellated') : null;
  if (T.castle) T.branches = Math.max(T.branches, 1);
  if (FD) { T.length = r3(Math.max(C.length[0], Math.min(C.length[1], T.length * FD.squeeze))); if (FD.levels) { T.levels = Math.max(T.levels, FD.levels); T.branches = Math.max(T.branches, 1); } }
  const SX = language.street, rankOf = (rank) => ({ ...C.ranks[rank], ...(rank === 'lane' ? { paving: SX.road.paving } : {}), foot: r3(C.section[rank].foot * SX.footway.w >= 0.9 ? C.section[rank].foot * SX.footway.w : 0), footPaving: SX.footway.paving, ...walkOf(SX, C.section[rank].foot * SX.footway.w) });
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
    // warded, the branch dog-legs 10 m past each wall, side to side, so no gate lines up with the next
    const jog = (y) => (FD?.wards ? yEdge.reduce((a, ye, k) => { const u = Math.max(0, Math.min(1, (y - ye - 1) / 9)); return a + (k % 2 ? 1 : -1) * (bend > 0 ? -1 : 1) * 10 * u * u * (3 - 2 * u); }, 0) : 0);
    const pts = []; for (let y = start[1]; y <= top + 1e-9; y += 3) { const t = (y - start[1]) / (top - start[1]); pts.push([r3(start[0] + bend * Math.sin(Math.PI * t) + (sqN[0] * (y - start[1])) / Math.max(0.3, sqN[1]) + jog(y)), r3(y)]); }
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
    places.push({ id: 'top', beat: 'landmark', centre: pts[pts.length - 1], read: T.castle ? 'the branch\'s end, on the highest ground: the castle\'s bridge' : 'the branch\'s end, on the highest ground: the landmark' });
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
  // the curtain's trace, before any lot: an octagon off the routes (a lot's depth outside every one), the lane run on to
  // its west gate (and out of the east, while the town has two), the approach under the west wall, the ditch, the glacis
  let fort = null;
  if (FD) {
    const P = [...routes.flatMap((r) => r.pts), ...places.filter((p) => p.poly).flatMap((p) => p.poly)], others = routes.filter((r) => r.id !== 'lane').flatMap((r) => r.pts), M = 25;
    const xW = r3(Math.min(-3, ...others.map((p) => p[0] - M))), xE = r3(Math.max(T.length + 3, ...others.map((p) => p[0] + M))), yS = r3(Math.min(...P.map((p) => p[1])) - M), yN = r3(Math.max(...P.map((p) => p[1])) + M);
    const c = r3(Math.min(14, 0.18 * Math.min(xE - xW, yN - yS))), t = FT.curtain.t, berm = 2, ditch = FD.ditch ? FT.ditch : null, glacis = r3(t / 2 + berm + (ditch?.w ?? 0) + 6), yG = laneY(xW);
    const west = FD.approach ? xW : xW - 30;
    for (let x = -4; x > west + 1e-9; x -= 4) lane.unshift([r3(x), laneY(x)]);
    lane.unshift([west, laneY(west)]);
    if (!FD.oneGate) { const x0 = lane[lane.length - 1][0]; for (let x = x0 + 4; x < xE + 30; x += 4) lane.push([r3(x), laneY(x)]); }
    if (FD.approach) {
      const xa = r3(xW - glacis + 1), pts = [];
      for (let y = yG - 44; y < yG - 1e-9; y += 4) pts.push([xa, r3(y)]);
      pts.push([xa, yG]); for (let x = xa + 4; x < xW - 1e-9; x += 4) pts.push([r3(x), yG]); pts.push([xW, yG]);
      routes.push({ id: 'approach', rank: 'approach', pts, ...rankOf('approach') });
    }
    places.find((p) => p.id === 'trailhead').centre = (routes.find((r) => r.id === 'approach') ?? routes[0]).pts[0];
    fort = { dial: FD, set: FT, poly: octagon(xW, yS, xE, yN, c), xW, xE, yS, yN, c, yG, t, berm, ditch, glacis };
  }
  // the castle, before any lot: on the highest ground past the branch's end, its gate facing back down it, the branch
  // run on to the ditch's lip where the bridge starts; the town stands outside it
  let castle = null;
  if (T.castle) {
    const r = routes.find((x) => x.id === 'branch'), end = r.pts[r.pts.length - 1], M = castleMoat(T.castle), gy = r3(end[1] + M.d1 + 2);
    r.pts.push([end[0], r3(gy - M.d1 - 0.5)]);
    castle = designCastle(style, seed, T.castle, { language, at: [end[0], gy, zAt(end[0], gy)] });
  }

  // ── 3 · the ground claimed before any lot: routes, places, walls, stairs ──
  const castleBox = castle ? [castle.extent.x0 - castle.glacis, castle.extent.y0 - castle.glacis, castle.extent.x1 + castle.glacis, castle.extent.y1 + castle.glacis] : null;
  const walk = routes.filter((r) => r.walk), xs = [...routes.flatMap((r) => r.pts.map((p) => p[0])), ...(castleBox ? [castleBox[0], castleBox[2]] : [])], ys = [...routes.flatMap((r) => r.pts.map((p) => p[1])), ...(castleBox ? [castleBox[1], castleBox[3]] : [])];
  const bounds = { x0: Math.floor(Math.min(...xs) - 30), x1: Math.ceil(Math.max(...xs) + 30), y0: Math.floor(Math.min(...ys) - 75), y1: Math.ceil(Math.max(...ys) + 30) };
  const G = grid(bounds.x0, bounds.y0, bounds.x1, bounds.y1);
  const boxOf = (pts, m) => [Math.min(...pts.map((p) => p[0])) - m, Math.min(...pts.map((p) => p[1])) - m, Math.max(...pts.map((p) => p[0])) + m, Math.max(...pts.map((p) => p[1])) + m];
  for (const r of routes) G.claim((x, y) => distTo(r.pts, x, y) < r.w / 2 + r.foot + 0.25, boxOf(r.pts, r.w + r.foot));
  for (const p of places) if (p.poly) G.claim((x, y) => inPoly(p.poly, x, y), boxOf(p.poly, 1));
  for (const t of terraces) G.claim((x, y) => Math.abs(y - t.y) < C.edgeClear);
  for (const s of stairs) G.claim((x, y) => Math.abs(x - s.at[0]) < s.width / 2 + 0.8 && y <= s.at[1] + 0.2 && y >= s.at[1] - s.run - 0.6);
  // the curtain and a metre inside it; outside, the ditch and the glacis are kept clear
  // the castle, its ditch and the glacis before it
  if (castleBox) G.claim(() => true, castleBox);
  if (fort) { const E = fort.poly.map((a, k) => [a, fort.poly[(k + 1) % fort.poly.length]]); G.claim((x, y) => { const d = Math.min(...E.map((e) => distTo(e, x, y))); return inPoly(fort.poly, x, y) ? d < fort.t / 2 + 1 : d < fort.glacis; }); }

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
  // the landmark: the tower at the branch's end, facing back down it (a castle's keep is the landmark of a town outside it)
  if (T.branches >= 1 && !castle) {
    const r = routes.find((x) => x.id === 'branch'), end = r.pts[r.pts.length - 1], ey = [0, 1], ex = [1, 0], A = [r3(end[0] - 3), r3(end[1] + r.w / 2 + r.foot + 0.6)];
    // a fortified town's landmark is its keep: a broad tower on the inmost ward, if the ground allows
    const big = FD?.wards ? (() => { const B = [r3(end[0] - 6), A[1]], dd = tryLot({ A: B, ex, ey }, 12, 12, 'tower'); return dd >= 10 ? { A: B, w: 12, d: dd } : null; })() : null;
    const d = big ? 0 : tryLot({ A, ex, ey }, 6, 7, 'tower');
    if (big) lots.push({ route: 'branch', side: 'end', A: big.A, ex, ey, w: big.w, d: big.d, use: 'tower', dare: true, keep: true });
    else if (d) lots.push({ route: 'branch', side: 'end', A, ex, ey, w: 6, d, use: 'tower', dare: true });
  }
  // each route's two frontages, in walking order
  const frontages = [];
  for (const r of routes.filter((x) => x.rank !== 'approach')) for (const side of [1, -1]) frontages.push({ r, side });
  for (const { r, side } of frontages) {
    const L = lenOf(r.pts);
    let s = r.rank === 'lane' ? 1 : 2, k = 0;
    while (s < L - 4) {
      const mid = along(r.pts, s + 4), use = useFor(r, mid.p), w = D.roll(LOT_W[use]), c = along(r.pts, s + w / 2);
      // a fortified town builds nothing on the road outside its gates
      if (fort && !inPoly(fort.poly, ...c.p)) { s = r3(s + 1.5); continue; }
      const n = [-c.t[1] * side, c.t[0] * side], ey = n, ex = [n[1], -n[0]];
      let A = [r3(c.p[0] + n[0] * (r.w / 2 + r.foot + 0.6) - ex[0] * (w / 2)), r3(c.p[1] + n[1] * (r.w / 2 + r.foot + 0.6) - ex[1] * (w / 2))];
      // on the inside of a bend a wide lot's front corners swing toward the walk: it steps back until both clear it
      for (let k = 0; k < 4; k++) { const short = r.w / 2 + r.foot + 0.3 - Math.min(distTo(r.pts, ...A), distTo(r.pts, A[0] + ex[0] * w, A[1] + ex[1] * w)); if (short <= 1e-3) break; A = [r3(A[0] + n[0] * (short + 0.05)), r3(A[1] + n[1] * (short + 0.05))]; }
      const d = tryLot({ A, ex, ey }, w, r.rank === 'back' ? 15 : D.roll([14, 20]), use);
      if (d) { lots.push({ route: r.id, side: side > 0 ? 'left' : 'right', A, ex, ey, w: r3(w), d, use, k: k++, s: r3(s) }); s = r3(s + w + (D.R() < 0.22 ? D.roll([2, 3]) : 0)); }
      else s = r3(s + 1.5);
    }
  }
  // the far ring: farmsteads in their fields south of the town, a barn and a house to each
  const farms = [];
  if (T.farms > 0) {
    const yF = Math.min(Math.min(...lane.map((p) => p[1])) - 44, fort ? fort.yS - fort.glacis - 4 : Infinity);
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
    let d = speak(language, l.use, { w: l.w, d: l.d }, style, s, { ring: l.ring, corner: l.corner, accent: !!l.focus, crown, band: l.band, ...(l.keep ? { over: { plan: r3(Math.min(l.w, l.d) - 3) } } : {}) });
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
  // (in a fortified town nothing but the keep stands over the towers: a secondary stays two metres under the keep)
  const keepL = lots.find((l) => l.dare), hall = lots.find((l) => l.focus), sqNear = (l) => Math.hypot(l.front[0] - sqCentre[0], l.front[1] - sqCentre[1]) < 45;
  const runOf = (l) => lots.filter((x) => x.route === l.route && x.side === l.side).sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
  const besides = (l) => { const run = runOf(l), i = run.indexOf(l); return [run[i - 1], run[i + 1]].filter((x) => x && !x.focus && x.design); };
  for (const l of lots.filter((x) => x.secondary)) {
    let s = subSeed(seed, `secondary:${l.route}:${l.side}:${l.k ?? 0}:${l.s ?? 0}`) + 100003 * lots.indexOf(l);
    // the mid ring repeats: its secondaries are one design
    if (l.ring === 'mid') s = subSeed(seed, 'mid:secondary');
    const over = besides(l).filter((x) => !x.secondary), want = over.length ? Math.max(...over.map((x) => x.crown)) + 1 : 1.12 * median, ceiling = Math.min(hall && sqNear(l) ? hall.crown - 0.8 : Infinity, FD?.wards && keepL ? keepL.crown - 2 : Infinity);
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

  // the fortification, now the buildings stand: curtains, towers over what is near them, gates, the ditch; the keep
  // is told to stand over every tower
  if (fort) planFort(fort, { routes, terraces, lots, zAt, seed, raise: (l, top) => designLot(l, Math.max(0, top - l.z)) });

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

  // ── 7 · the boundaries: structures the plan makes room for, each a straight run taking a role ──
  const BR = boundaryRoles(SX.bounds), boundaries = [], tOf = (R) => BOUNDARY_FORMS[R.form].t;
  const lotPt = (l, u, v) => [r3(l.A[0] + l.ex[0] * u + l.ey[0] * v), r3(l.A[1] + l.ex[1] * u + l.ey[1] * v)];
  // a line clear of every route's road and walk (sampled along it), so a yard that backs onto a route gives up a strip
  const keepOff = [...routes, ...(fort ? fort.curtains.map((c) => ({ id: 'curtain', pts: c.pts, w: c.t + 0.6, foot: 0 })) : [])];
  const rBox = keepOff.map((r) => ({ r, m: r.w / 2 + r.foot + 1, x0: Math.min(...r.pts.map((p) => p[0])), x1: Math.max(...r.pts.map((p) => p[0])), y0: Math.min(...r.pts.map((p) => p[1])), y1: Math.max(...r.pts.map((p) => p[1])) }));
  const onRoute = (a, b, t) => {
    const near = rBox.filter((q) => Math.max(a[0], b[0]) > q.x0 - q.m && Math.min(a[0], b[0]) < q.x1 + q.m && Math.max(a[1], b[1]) > q.y0 - q.m && Math.min(a[1], b[1]) < q.y1 + q.m).map((q) => q.r), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s <= L + 1e-9 && near.length; s += 0.25) { const p = [a[0] + ((b[0] - a[0]) * Math.min(s, L)) / (L || 1), a[1] + ((b[1] - a[1]) * Math.min(s, L)) / (L || 1)], r = near.find((x) => distTo(x.pts, ...p) < x.w / 2 + x.foot + t / 2 + 0.05); if (r) return r; }
    return null;
  };
  const clearOf = (a, b, t) => !onRoute(a, b, t);
  const run = (role, R, a, b, h, z, extra = {}) => { if (R && Math.hypot(b[0] - a[0], b[1] - a[1]) >= 0.6) boundaries.push({ id: `b${boundaries.length}`, role, el: R.id, form: R.form, fell: R.fell, h: r3(h), t: tOf(R), pts: [a, b], z, gates: [], ...extra }); };
  // each lot's building on the ground, in lot coordinates: where it stands from (front) and to (back)
  const feet = new Map(), foot = (l) => feet.get(l) ?? feet.set(l, footOf(l)).get(l);
  const footOf = (l) => { const g = l.design.faces.flatMap((f) => f.corners).filter((c) => c[2] < 0.3), off = (l.w - l.design.dims.W0) / 2; return { v0: l.design.dims.front, v1: r3(l.design.dims.front + Math.max(...g.map((c) => c[1]), l.design.dims.D0)), u0: r3(off + Math.min(0, ...g.map((c) => c[0]))), u1: r3(off + Math.max(...g.map((c) => c[0]), l.design.dims.W0)) }; };
  const yardOf = (l) => { const f = foot(l); return r3(l.d - f.v1); };
  const lived = (l) => l.use === 'dwelling' && !l.farm && !dares(l);
  // neighbours along a frontage, in walking order: two lots a passage apart (under 3 m) share one line down its middle
  const bounded = lots.filter((l) => !l.farm && !l.dare), SHARE = 3;
  const gapTo = (l, nb) => (nb ? Math.hypot(...lotPt(l, l.w, 0).map((v, j) => v - nb.A[j])) : Infinity);
  // where a line across lot l at depth v meets the shared line down the passage to its neighbour (as u along l)
  const meetU = (l, nb, v, right) => { const m = right ? lotPt(l, l.w, v).map((x, j) => (x + lotPt(nb, 0, v)[j]) / 2) : lotPt(nb, nb.w, v).map((x, j) => (x + lotPt(l, 0, v)[j]) / 2); return r3((m[0] - l.A[0]) * l.ex[0] + (m[1] - l.A[1]) * l.ex[1]); };
  const nbr = new Map();
  for (const key of new Set(bounded.map((l) => `${l.route}:${l.side}`))) {
    const r = bounded.filter((l) => `${l.route}:${l.side}` === key).sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
    r.forEach((l, k) => { const nb = r[k + 1]; nbr.set(l, { left: nbr.get(l)?.left ?? null, right: nb && gapTo(l, nb) < SHARE ? nb : null }); if (nb && gapTo(l, nb) < SHARE) nbr.set(nb, { left: l, right: null }); });
  }
  const fronted = new Set();
  // fronts: a lived lot's street edge, low, a gate where its door path crosses; across half the passage to a lived
  // neighbour, so a run of gardens is one edge; a household moves its height within the class
  for (const l of lots.filter(lived)) {
    const R = BR.front, i = lots.indexOf(l), p = paths.find((x) => x.lot === i);
    if (!R || !p || l.design.dims.front < tOf(R) + 0.6) continue;
    const v = r3(tOf(R) / 2 + 0.05), house = (mulberry32(subSeed(seed, `front:${i}`))() - 0.5) * 0.5, N = nbr.get(l) ?? {};
    let uL = N.left && lived(N.left) ? meetU(l, N.left, v, false) : 0, uR = N.right && lived(N.right) ? meetU(l, N.right, v, true) : l.w;
    // on a bend the passage's middle can swing toward the walk: a front reaches it only where it stays clear
    if (!clearOf(lotPt(l, uL, v), lotPt(l, 0, v), tOf(R))) uL = 0;
    if (!clearOf(lotPt(l, l.w, v), lotPt(l, uR, v), tOf(R))) uR = l.w;
    const du = r3((p.pts[0][0] - l.A[0]) * l.ex[0] + (p.pts[0][1] - l.A[1]) * l.ex[1] - uL);
    run('front', R, lotPt(l, uL, v), lotPt(l, uR, v), roleHeight(R, house), l.z, { lot: i, ring: l.ring, gates: [{ s: du, w: 1.2 }] });
    fronted.add(i);
  }
  // sides: behind the building line at the yard's height (the hall's yard its precinct's); before it, where both sides
  // have fronts, at the front's height, so a garden is closed. Shared lines run down the passage's middle, built once.
  const sideRole = (l) => (l.focus && BR.precinct ? 'precinct' : 'side');
  const sideOf = (l, right) => {
    const nb = (nbr.get(l) ?? {})[right ? 'right' : 'left'];
    if (nb && !right) return;
    const role = nb?.focus ? sideRole(nb) : sideRole(l), R = BR[role] ?? null, i = lots.indexOf(l);
    if (!R) return;
    const t = tOf(R), fa = foot(l), fb = nb ? foot(nb) : null;
    // the line at depth v: the lot's own edge (inside it by half the line), or the passage's middle
    const at = (v, tt) => (nb ? lotPt(l, l.w, v).map((x, j) => r3((x + lotPt(nb, 0, v)[j]) / 2)) : lotPt(l, right ? l.w - tt / 2 : tt / 2, v));
    const back = Math.max(fa.v1, fb?.v1 ?? 0);
    let end = Math.min(l.d, nb?.d ?? Infinity) - (BR.back ? tOf(BR.back) : 0);
    while (end - back >= 1 && !clearOf(at(back, t), at(end, t), t)) end -= 0.25;
    if (end - back >= 1) run(role, R, at(back, t), at(end, t), roleHeight(R), l.z, { lot: i, ring: l.ring, ...(nb ? { between: [i, lots.indexOf(nb)] } : {}) });
    const Rf = BR.front;
    if (Rf && fronted.has(i) && (!nb || fronted.has(lots.indexOf(nb)))) { const v0 = tOf(Rf) + 0.05, v1 = Math.min(fa.v0, fb?.v0 ?? Infinity); if (v1 - v0 >= 0.6) run('front', Rf, at(v0, tOf(Rf)), at(v1, tOf(Rf)), boundaries.find((b) => b.role === 'front' && b.lot === i).h, l.z, { lot: i, ring: l.ring, side: true, ...(nb ? { between: [i, lots.indexOf(nb)] } : {}) }); }
  };
  for (const l of bounded) { sideOf(l, false); sideOf(l, true); }
  // backs: the yard's back, over the eye (the hall's is its precinct)
  // (across half the passage to a neighbour it shares a line with, so the corners meet)
  for (const l of bounded) {
    const role = l.focus && BR.precinct ? 'precinct' : 'back', R = BR[role], N = nbr.get(l) ?? {};
    if (!R || yardOf(l) < 1.2 - 1e-6) continue;
    let v = l.d - tOf(R) / 2;
    const uOf = (vv) => [N.left && yardOf(N.left) >= 1.2 ? meetU(l, N.left, vv, false) : 0, N.right && yardOf(N.right) >= 1.2 ? meetU(l, N.right, vv, true) : l.w];
    let [uL, uR] = uOf(v);
    let hit = null;
    while (v + tOf(R) / 2 - foot(l).v1 >= 1.2 - 1e-6 && (hit = onRoute(lotPt(l, uL, v), lotPt(l, uR, v), tOf(R)))) { v -= 0.25; [uL, uR] = uOf(v); }
    // a yard too shallow to close short of the route behind it opens onto that route: the route is its back
    if (v + tOf(R) / 2 - foot(l).v1 >= 1.2 - 1e-6) {
      // two yards back to back share their back line: the part another back already runs along is not built again
      const a = lotPt(l, uL, v), b = lotPt(l, uR, v), cover = [];
      for (const o of boundaries.filter((x) => (x.role === 'back' || x.role === 'precinct') && Math.abs(x.z - l.z) < 0.01)) {
        const pr = (p) => (p[0] - a[0]) * l.ex[0] + (p[1] - a[1]) * l.ex[1], off = (p) => Math.abs((p[0] - a[0]) * l.ey[0] + (p[1] - a[1]) * l.ey[1]);
        const ou = [o.pts[1][0] - o.pts[0][0], o.pts[1][1] - o.pts[0][1]], ol = Math.hypot(...ou);
        if (Math.abs(ou[0] * l.ey[0] + ou[1] * l.ey[1]) / ol > 0.05) continue;
        // measured where the two overlap: lines that cross at a slight angle lie along each other only there
        const p0 = pr(o.pts[0]), p1 = pr(o.pts[1]), lo = Math.max(0, Math.min(p0, p1)), hi = Math.min(uR - uL, Math.max(p0, p1));
        if (hi - lo < 0.3) continue;
        const onO = (u) => { const k = (u - p0) / (p1 - p0 || 1); return [o.pts[0][0] + ou[0] * k, o.pts[0][1] + ou[1] * k]; };
        if (Math.max(off(onO(lo)), off(onO(hi))) > (o.t + tOf(R)) / 2) continue;
        cover.push([lo - 0.05, hi + 0.05]);
      }
      let pieces = [[0, uR - uL]];
      for (const [c0, c1] of cover) pieces = pieces.flatMap(([p0, p1]) => [[p0, Math.min(p1, c0)], [Math.max(p0, c1), p1]].filter(([x0, x1]) => x1 - x0 > 1e-6));
      for (const [p0, p1] of pieces) run(role, R, lotPt(l, uL + p0, v), lotPt(l, uL + p1, v), roleHeight(R), l.z, { lot: lots.indexOf(l), ring: l.ring });
      if (cover.length) l.backShared = true;
      if (!boundaries.some((x) => x.lot === lots.indexOf(l) && x.role === role)) l.backsOn = 'a neighbour\'s back';
    }
    else l.backsOn = hit?.id ?? null;
  }
  // fields: round each farm's field at the waist, a cart's gate toward its yard
  for (const f of farms) { const R = BR.field; if (!R) break; f.field.forEach((a, k) => { const b = f.field[(k + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]); run('field', R, a, b, roleHeight(R), 0, { ring: 'far', gates: k === 2 ? [{ s: r3(L / 2), w: 3 }] : [] }); }); }

  // ── 8 · the town's laws ──
  const near = lots.filter((l) => l.ring === 'near'), counters = lots.filter((l) => l.use === 'shop');
  // (a secondary speaks another language: it is never its neighbour's repeat, whatever their signatures)
  let alike = 0;
  for (const key of new Set(near.filter((l) => !dares(l)).map((l) => `${l.route}:${l.side}`))) { const run = near.filter((l) => `${l.route}:${l.side}` === key && !dares(l)).sort((a, b) => a.s - b.s); for (let i = 1; i < run.length; i++) if (run[i].design.sig === run[i - 1].design.sig && !run[i].secondary === !run[i - 1].secondary) alike++; }
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
  // the terraces' walls: each held as high as its rise, by a form that can hold it, and guarded along its drop, open at
  // its stairs (the stair stands before the wall: the retaining face runs on behind it)
  for (const t of terraces) {
    const Rr = boundaryRoles(SX.bounds, t.rise).retain, Rg = BR.guard;
    // a ward's wall is a curtain (the fort's): outside the fort the terrace is held by the town's retaining wall only
    if (fort?.dial.wards) { for (const [x0, x1] of [[t.x0, fort.xW - fort.t / 2], [fort.xE + fort.t / 2, t.x1]]) if (x1 - x0 > 1) run('retain', Rr, [r3(x0), t.y], [r3(x1), t.y], t.rise, t.z0, { ring: 'mid', stairs: [] }); continue; }
    // where a route crosses the wall it climbs it: the opening is the route's whole width (its walks too), across the slant
    const at = [];
    for (const r of routes) for (let i = 1; i < r.pts.length; i++) { const [p, q] = [r.pts[i - 1], r.pts[i]]; if ((p[1] - t.y) * (q[1] - t.y) <= 0 && p[1] !== q[1]) { const k = (t.y - p[1]) / (q[1] - p[1]), L = Math.hypot(q[0] - p[0], q[1] - p[1]); at.push({ s: r3(p[0] + (q[0] - p[0]) * k - t.x0), w: r3((r.w + 2 * r.foot) / (Math.abs(q[1] - p[1]) / L) + 0.6) }); break; } }
    run('retain', Rr, [t.x0, t.y], [t.x1, t.y], t.rise, t.z0, { ring: 'near', stairs: at });
    // the guard stands on the wall's top, back from its face by half its own thickness, so the two read as one
    const off = r3((tOf(Rr) - tOf(Rg)) / 2);
    run('guard', Rg, [t.x0, r3(t.y + Math.max(0, off))], [t.x1, r3(t.y + Math.max(0, off))], roleHeight(Rg), t.z1, { ring: 'near', gates: at, risen: Rg.form === Rr.form });
  }
  const bLaws = boundaryLaws(boundaries, { lots, paths, routes, terraces, stairs, BR, yardOf, held: fort?.dial.wards ? fort.curtains.filter((c) => c.ward).map((c) => c.ward) : [] });
  const fLaws = fort ? fortLaws(fort, { lots, routes, farms }) : [];
  // outside the castle: no lot of the town in its ditch or its glacis, and the branch brought to its bridge
  const cLaws = [];
  if (castle) {
    const inBox = (p) => p[0] > castleBox[0] + 0.25 && p[0] < castleBox[2] - 0.25 && p[1] > castleBox[1] + 0.25 && p[1] < castleBox[3] - 0.25;
    const corners = (l) => [l.A, [l.A[0] + l.ex[0] * l.w, l.A[1] + l.ex[1] * l.w], [l.A[0] + l.ex[0] * l.w + l.ey[0] * l.d, l.A[1] + l.ex[1] * l.w + l.ey[1] * l.d], [l.A[0] + l.ey[0] * l.d, l.A[1] + l.ey[1] * l.d]];
    const inside = lots.filter((l) => corners(l).some(inBox)), br = routes.find((r) => r.id === 'branch'), lip = br.pts[br.pts.length - 1], bridge = castle.bridges[0], foot = [bridge.at[0], r3(bridge.at[1] - bridge.to)];
    cLaws.push({ law: 'outside', ok: inside.length === 0 && Math.hypot(lip[0] - foot[0], lip[1] - foot[1]) < 1, value: `${lots.length} lots of the town outside the castle's ${castle.glacis} m of ditch and glacis${inside.length ? `; ${inside.length} in it` : ''}; the branch ${Math.hypot(lip[0] - foot[0], lip[1] - foot[1]) < 1 ? 'reaches' : 'stops short of'} the bridge`, want: TOWN_LAWS.find((x) => x.id === 'outside').want });
    cLaws.push(...castle.laws);
    frame.x0 = Math.min(frame.x0, Math.floor(castleBox[0])); frame.x1 = Math.max(frame.x1, Math.ceil(castleBox[2])); frame.y1 = Math.max(frame.y1, Math.ceil(castleBox[3] - castle.glacis + castle.ditch.d1 + 6));
    // the castle's ranges join the town's lots last, so nothing of the town's (its laws, its boundaries) counts them
    for (const l of castle.lots) lots.push(l);
  }
  if (fort) { const all2 = [...fort.poly, ...fort.towers.map((x) => x.at)], g = fort.glacis; frame.x0 = Math.min(frame.x0, Math.floor(Math.min(...all2.map((p) => p[0])) - g)); frame.x1 = Math.max(frame.x1, Math.ceil(Math.max(...all2.map((p) => p[0])) + g)); frame.y1 = Math.max(frame.y1, Math.ceil(Math.max(...all2.map((p) => p[1])) + g)); frame.y0 = Math.min(frame.y0, Math.floor(Math.min(...all2.map((p) => p[1])) - g)); }
  return { card: T, seed, kitId: style.kitId, language, secondary, heartbeat: T.heartbeat, routes, places, terraces, stairs, lots, paths, boundaries, roles: BR, farms, fort, castle, bounds: frame, median, laws: [...laws, ...bLaws, ...fLaws, ...cLaws], made: { bond: made.tokens.bond } };
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
  { id: 'bounded', want: 'every lot with a yard is closed at its back (or opens onto the route behind it), and every lived run has its party lines', why: 'a yard is somewhere because it has an edge' },
  { id: 'gated', want: 'every front is open where its door path crosses it, a gate at least the path\'s width', why: 'a wall across a path is a trap' },
  { id: 'sightline', want: 'every front stands under a metre: the street sees the door', why: 'a street watched by its doors is a safe one; a front over the eye turns the street into a corridor' },
  { id: 'guarded', want: 'every terrace\'s drop is guarded at least 0.9 m high along its length, open only at its stairs', why: 'nobody walks off a terrace in the dark' },
  { id: 'form-reach', want: 'every boundary within the heights its form can stand to (and a retaining wall within what its form can hold)', why: 'a dry wall cannot stand three metres; palings cannot hold a terrace' },
  { id: 'walls-clear', want: 'no boundary on a road or a walk (a retaining wall runs on behind its stair)', why: 'the plan made room for them: they keep lots, not routes' },
  { id: 'party-once', want: 'a line between two neighbours is built once', why: 'two walls side by side read as a mistake, and cost twice' },
  { id: 'outside', want: 'a castle\'s town: no lot in its ditch or the glacis before it, and the branch brought to its bridge', why: 'the town stands outside the castle and climbs to it: the castle keeps the lord, not the town' },
  { id: 'enclosed', want: 'a fortified town: every lot but the farms inside the curtain', why: 'a wall that leaves the town outside it keeps nothing' },
  { id: 'flanking', want: 'every length of curtain within 30 m (a bowshot, game-scaled) of a tower or a gatehouse', why: 'a wall nobody can see the foot of is a wall to be climbed' },
  { id: 'bent-entry', want: 'the approach turns at least 60° into the gate, and no two gates in a row line up', why: 'a straight way in is a straight charge in; seen through, a gate is half open' },
  { id: 'commands', want: 'every ward\'s curtain tops the curtain of the ward outside it', why: 'the inner wall sees over the outer, so a ward taken is a ward under fire' },
  { id: 'skyline', want: 'every tower over what stands near it inside, and the keep over every tower', why: 'from outside, the towers and the keep are the fortification: the eye reads its order from the skyline' },
  { id: 'glacis', want: 'nothing built in the ditch or the cleared ground before it', why: 'a house against the wall is a ladder' },
  { id: 'gates-only', want: 'a route crosses a curtain only at a gate', why: 'a way through a wall is a gate or a breach' },
  { id: 'one-way-up', want: 'warded, each ward\'s wall has one gate and the keep stands in the inmost; at one gate, the curtain has one', why: 'the keep is reached through every ward in turn' },
]);

// ── the fortified town's plan ───────────────────────────────────────────────────────────────────────────────────────────
const segX = (a, b, p, q) => {
  const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d, u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d;
  return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 ? { t, u } : null;
};
/** Where each route crosses the line a–b: its distance along it, and the width the route opens (its walks too). */
function crossings(a, b, routes) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), out = [];
  for (const r of routes) for (let i = 1; i < r.pts.length; i++) { const x = segX(a, b, r.pts[i - 1], r.pts[i]); if (!x) continue; const s = r3(x.t * L); if (!out.some((o) => Math.abs(o.s - s) < 3)) out.push({ s, route: r.id, w: r3(r.w + 2 * r.foot + 1), dir: [(r.pts[i][0] - r.pts[i - 1][0]), (r.pts[i][1] - r.pts[i - 1][1])] }); }
  return out;
}
/**
 * The fortification laid on the town: the outer curtain traced on the octagon, broken where it steps a terrace; each
 * warded terrace's wall a curtain holding the terrace (its top commanding the outer one); towers at every corner and
 * step and at the dial's rhythm, standing out of the wall's face, each over what stands near it; a gate wherever a
 * route crosses; the ditch before it all. The keep is raised over every tower. Mutates `fort`.
 */
function planFort(fort, { routes, terraces, lots, zAt, raise }) {
  const { dial: FD, set: FT, poly, t } = fort, ph = FT.parapet.h, TD = FT.towerDims, minRise = Math.min(...terraces.map((x) => x.rise), 99);
  const curtains = [], towers = [], gates = [];
  // the outer curtain, edge by edge, broken at each terrace it steps
  poly.forEach((a, k) => {
    const b = poly[(k + 1) % poly.length], cuts = terraces.filter((x) => (a[1] - x.y) * (b[1] - x.y) < 0).map((x) => (x.y - a[1]) / (b[1] - a[1])).sort((m, n) => m - n);
    const ts = [0, ...cuts, 1];
    for (let i = 1; i < ts.length; i++) { const p = [r3(a[0] + (b[0] - a[0]) * ts[i - 1]), r3(a[1] + (b[1] - a[1]) * ts[i - 1])], q = [r3(a[0] + (b[0] - a[0]) * ts[i]), r3(a[1] + (b[1] - a[1]) * ts[i])]; curtains.push({ id: `c${curtains.length}`, ward: 0, pts: [p, q], z: zAt((p[0] + q[0]) / 2, (p[1] + q[1]) / 2), h: FD.H, retain: 0, t }); }
  });
  // the wards: each terrace's wall, from the west curtain to the east, holding its rise and topping the outer curtain
  if (FD.wards) { const Hin = r3(Math.max(ph + 2.5, FD.H - minRise + 1.5)); for (const x of terraces) curtains.push({ id: `c${curtains.length}`, ward: x.level, pts: [[fort.xW, x.y], [fort.xE, x.y]], z: x.z0, h: Hin, retain: x.rise, t }); }
  // the gates, wherever a route crosses a curtain; a ward's at the stair's top
  for (const c of curtains) {
    c.top = r3(c.z + c.retain + c.h);
    c.gates = crossings(c.pts[0], c.pts[1], routes).map((x) => ({ ...x, w: r3(Math.min(7, Math.max(FT.gate.clear, x.w))) }));
    for (const g of c.gates) { const L = Math.hypot(c.pts[1][0] - c.pts[0][0], c.pts[1][1] - c.pts[0][1]), u = [(c.pts[1][0] - c.pts[0][0]) / L, (c.pts[1][1] - c.pts[0][1]) / L]; gates.push({ id: `g${gates.length}`, curtain: c.id, ward: c.ward, route: g.route, at: [r3(c.pts[0][0] + u[0] * g.s), r3(c.pts[0][1] + u[1] * g.s)], u, n: [-u[1], u[0]], w: g.w, z: r3(c.z + c.retain), h: c.h, dir: g.dir, form: FT.gate.form, main: false }); }
  }
  // the main gate: where the approach meets the curtain (without one, where the lane comes in from the west)
  const ap = routes.find((r) => r.id === 'approach'), entry = ap ? ap.pts[ap.pts.length - 1] : [fort.xW, fort.yG], main = gates.filter((g) => !g.ward).sort((a, b) => Math.hypot(a.at[0] - entry[0], a.at[1] - entry[1]) - Math.hypot(b.at[0] - entry[0], b.at[1] - entry[1]))[0];
  if (main) main.main = true;
  // the towers: every corner and step, then a rhythm along each curtain, clear of its gates; each out of the wall's face
  const unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l]; };
  const put = (p, out, kind) => { if (towers.some((x) => Math.hypot(x.foot[0] - p[0], x.foot[1] - p[1]) < TD.w) || gates.some((g) => Math.hypot(g.at[0] - p[0], g.at[1] - p[1]) < g.w / 2 + TD.w)) return; const o = unit(out), off = t / 2 + TD.proud - TD.w / 2; towers.push({ id: `t${towers.length}`, kind, foot: p, at: [r3(p[0] + o[0] * off), r3(p[1] + o[1] * off)], out: o }); };
  poly.forEach((v, k) => { const a = poly[(k + poly.length - 1) % poly.length], b = poly[(k + 1) % poly.length], n1 = unit([a[1] - v[1], v[0] - a[0]]), n2 = unit([v[1] - b[1], b[0] - v[0]]); put(v, [-(n1[0] + n2[0]), -(n1[1] + n2[1])], 'corner'); });
  for (const c of curtains.filter((x) => !x.ward)) for (const p of c.pts) if (terraces.some((x) => Math.abs(p[1] - x.y) < 1e-6)) put(p, [p[0] < (fort.xW + fort.xE) / 2 ? -1 : 1, 0], 'step');
  for (const c of curtains) {
    const [a, b] = c.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], o = [u[1], -u[0]], n = Math.ceil(L / FD.spacing);
    for (let i = 1; i < n; i++) put([r3(a[0] + u[0] * (L * i) / n), r3(a[1] + u[1] * (L * i) / n)], o, 'rhythm');
  }
  // each tower a storey and a half over the walls it stands on, and over whatever stands within 14 m inside (the
  // landmark aside: the keep stands over the towers, never they over it)
  for (const x of towers) {
    x.z = zAt(x.at[0] + x.out[0] * 0.1, x.at[1] + x.out[1] * 0.1);
    const walls = curtains.filter((c) => distTo(c.pts, ...x.foot) < 1), near = lots.filter((l) => l.crown !== undefined && !l.dare && Math.hypot(l.front[0] - x.at[0], l.front[1] - x.at[1]) < 14);
    x.top = r3(Math.max(...walls.map((c) => c.top + ph), x.z + FD.H + ph) + Math.max(TD.over, 0.4 * FD.H));
    x.top = r3(Math.max(x.top, ...near.map((l) => l.crown + 1)));
    x.H = r3(x.top - x.z);
  }
  for (const g of gates) g.top = r3(g.z + g.h + ph + 3);
  // the ditch before the outer curtain, bridged where a route crosses it
  if (fort.ditch) {
    const d0 = t / 2 + fort.berm, d1 = d0 + fort.ditch.w, ring = (d) => octagon(fort.xW - d, fort.yS - d, fort.xE + d, fort.yN + d, fort.c + d * (2 - Math.SQRT2));
    fort.ditchRing = { inner: ring(d0), outer: ring(d1), depth: fort.ditch.depth };
    fort.bridges = gates.filter((g) => g.ward === 0).map((g) => ({ at: g.at, u: g.u, from: d0 - 0.5, to: d1 + 0.5, w: Math.min(g.w, 5) }));
  }
  // the keep over every tower
  // (warded, the landmark is the keep; a walled town's landmark keeps its own height)
  const keep = FD.wards ? lots.find((l) => l.dare) : null, highest = Math.max(...towers.map((x) => x.top), ...gates.map((g) => g.top));
  if (keep && keep.crown < highest + 1.5) raise(keep, highest + 2);
  Object.assign(fort, { curtains, towers, gates, keep: keep ? lots.indexOf(keep) : null });
}

/** The fortified town's laws, read off its plan. */
function fortLaws(fort, { lots, routes, farms }) {
  const want = (id) => TOWN_LAWS.find((x) => x.id === id).want, { curtains, towers, gates, poly, dial: FD } = fort, E = poly.map((a, k) => [a, poly[(k + 1) % poly.length]]);
  const dPoly = (p) => Math.min(...E.map((e) => distTo(e, ...p)));
  const corners = (l) => [l.A, [l.A[0] + l.ex[0] * l.w, l.A[1] + l.ex[1] * l.w], [l.A[0] + l.ex[0] * l.w + l.ey[0] * l.d, l.A[1] + l.ex[1] * l.w + l.ey[1] * l.d], [l.A[0] + l.ey[0] * l.d, l.A[1] + l.ey[1] * l.d]];
  const outside = lots.filter((l) => !l.farm && !corners(l).every((p) => inPoly(poly, ...p)));
  // flanking: every 2 m of every curtain within a bowshot of a tower or a gatehouse
  const posts = [...towers.map((x) => x.at), ...gates.map((g) => g.at)], blind = [];
  for (const c of curtains) { const [a, b] = c.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 2) { const p = [a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L]; if (Math.min(...posts.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1]))) > 30) { blind.push(c.id); break; } } }
  // bent entry: the approach's last leg turns into the main gate; the gates in the order the walk meets them never line up
  const ap = routes.find((r) => r.id === 'approach'), main = gates.find((g) => g.main), seq = [main, ...gates.filter((g) => g.ward).sort((a, b) => a.ward - b.ward)].filter(Boolean);
  // the approach's turn: the angle between its last leg into the gate and the leg it ran along the wall before it
  let turn = 0;
  if (ap) { const seg = ap.pts.slice(1).map((p, i) => [p[0] - ap.pts[i][0], p[1] - ap.pts[i][1]]).filter((v) => Math.hypot(...v) > 1e-6), last = seg[seg.length - 1], before = [...seg].reverse().find((v) => Math.abs(v[0] * last[1] - v[1] * last[0]) > 1e-6 * Math.hypot(...v) * Math.hypot(...last)); if (before) turn = Math.round((Math.acos(Math.max(-1, Math.min(1, (before[0] * last[0] + before[1] * last[1]) / (Math.hypot(...before) * Math.hypot(...last))))) * 180) / Math.PI); }
  const lined = [];
  for (let i = 1; i < seq.length; i++) { const a = seq[i - 1], b = seq[i], par = Math.abs(a.n[0] * b.n[0] + a.n[1] * b.n[1]) > Math.cos(Math.PI / 6); if (par && Math.abs((b.at[0] - a.at[0]) * a.u[0] + (b.at[1] - a.at[1]) * a.u[1]) < (a.w + b.w) / 2) lined.push(`${a.id}→${b.id}`); }
  // commands: every ward's wall over the outer curtain's facing it
  const outerTop = Math.max(...curtains.filter((c) => !c.ward && c.z === 0).map((c) => c.top), 0), low = curtains.filter((c) => c.ward && c.top <= outerTop + 1e-9);
  // skyline: each tower over what stands near it; the keep over every tower
  const keep = fort.keep !== null && fort.keep !== undefined ? lots[fort.keep] : null, under = towers.filter((x) => lots.some((l) => l.crown !== undefined && !l.dare && Math.hypot(l.front[0] - x.at[0], l.front[1] - x.at[1]) < 14 && l.crown > x.top + 1e-9)), tallest = Math.max(...towers.map((x) => x.top), ...gates.map((g) => g.top));
  // glacis: no lot, no field, in the ditch or the cleared ground before the wall
  const crowded = [...lots.filter((l) => corners(l).some((p) => !inPoly(poly, ...p) && dPoly(p) < fort.glacis - 0.5)).map((l) => `${l.use} lot`), ...farms.filter((f) => f.field.some((p) => dPoly(p) < fort.glacis - 0.5)).map(() => 'a field')];
  // gates-only: every route that crosses a curtain crosses it in a gate
  const breach = [];
  for (const c of curtains) for (const x of crossings(c.pts[0], c.pts[1], routes)) if (!c.gates.some((g) => Math.abs(g.s - x.s) < g.w / 2)) breach.push(`${x.route} through ${c.id}`);
  const wardsOk = !FD.wards || (curtains.filter((c) => c.ward).every((c) => c.gates.length === 1) && keep && keep.z >= Math.max(0, ...curtains.filter((c) => c.ward).map((c) => c.z + c.retain)) - 1e-9);
  const oneOk = !FD.oneGate || gates.filter((g) => !g.ward).length === 1;
  return [
    { law: 'enclosed', ok: outside.length === 0, value: outside.length ? `${outside.length} lots outside: ${outside.slice(0, 3).map((l) => l.use).join(', ')}` : `${lots.filter((l) => !l.farm).length} lots inside the curtain (${FD.steps.slice(1).join(', ')})` },
    { law: 'flanking', ok: blind.length === 0, value: blind.length ? `blind: ${blind.join(', ')}` : `${towers.length} towers and ${gates.length} gatehouses flank ${curtains.length} lengths of curtain (towers at ${FD.spacing} m at most)` },
    { law: 'bent-entry', ok: (!FD.approach || turn >= 60) && lined.length === 0, value: `${ap ? `the approach turns ${turn}° into the gate` : 'no approach yet (the dial is under 0.4): the lane runs straight in'}${lined.length ? `; lined up: ${lined.join(', ')}` : seq.length > 1 ? `; ${seq.length} gates, none in line` : ''}` },
    { law: 'commands', ok: low.length === 0, value: FD.wards ? `wards' walls ${curtains.filter((c) => c.ward).map((c) => `${c.top} m`).join(', ')} over the outer ${outerTop} m` : 'one ward' },
    { law: 'skyline', ok: under.length === 0 && (!keep || keep.crown >= tallest - 1e-9), value: `towers ${Math.min(...towers.map((x) => x.top))}–${r3(tallest)} m${keep ? `, the keep ${keep.crown} m` : ''}` },
    { law: 'glacis', ok: crowded.length === 0, value: crowded.length ? crowded.slice(0, 3).join(', ') : `${fort.glacis} m kept clear before the curtain${fort.ditch ? `, a ${fort.ditch.w} m ditch in it` : ''}` },
    { law: 'gates-only', ok: breach.length === 0, value: breach.length ? breach.slice(0, 3).join('; ') : `${gates.length} gates: ${gates.map((g) => `${g.route}${g.ward ? ` into ward ${g.ward}` : ''}`).join(', ')}` },
    { law: 'one-way-up', ok: wardsOk && oneOk, value: `${gates.filter((g) => !g.ward).length} outer gate${gates.filter((g) => !g.ward).length === 1 ? '' : 's'}${FD.wards ? `, ${curtains.filter((c) => c.ward).length} wards each by one gate, the keep in the inmost` : ''}` },
  ].map((l) => ({ ...l, want: want(l.law) }));
}

/**
 * The fortified town's fortification as faces in town coordinates (a castle's, when the town has one): each curtain in 10 m bays (a ward's wall filled under its gate, where
 * the stair stands before it), every tower, every gatehouse; `floor` the ditch and its bridges. Depth by ring (near
 * the walk 3, else 1), capped by `most`. → { groups, floor }
 */
export function fortFaces(town, { most = 3 } = {}) {
  // a castle's town draws the castle's walls, keep and floor here (its ranges are the town's lots)
  if (town.castle) { const c = castleFaces(town.castle, { most, lots: false }); return { groups: c.groups, floor: c.floor }; }
  const F = town.fort;
  if (!F) return { groups: [], floor: [] };
  const FT = F.set, groups = [], walk = town.routes.filter((r) => r.walk), ringD = (p) => (walk.some((r) => distTo(r.pts, ...p) < 14) ? 3 : 1);
  const place = (faces, o, ex, ey, z) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, h]) => [r3(o[0] + ex[0] * x + ey[0] * y), r3(o[1] + ex[1] * x + ey[1] * y), r3(z + h)]), normal: [ex[0] * f.normal[0] + ey[0] * f.normal[1], ex[1] * f.normal[0] + ey[1] * f.normal[1], f.normal[2]].map(r3) }));
  for (const c of F.curtains) {
    const [a, b] = c.pts, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
    for (let s0 = 0; s0 < L - 1e-6; s0 += 10) {
      const s1 = Math.min(L, s0 + 10), len = s1 - s0, mid = [a[0] + u[0] * (s0 + len / 2), a[1] + u[1] * (s0 + len / 2)], depth = Math.min(most, ringD(mid)), local = [];
      const gs = c.gates.filter((g) => g.s + g.w / 2 > s0 && g.s - g.w / 2 < s1).map((g) => ({ u: g.s - s0, w: g.w }));
      FB.bay(local, len, FT, c.h, { depth, gates: gs, retain: c.retain, seed: subSeed(town.seed, `${c.id}:${s0}`) });
      if (c.retain) for (const g of gs) EB.slab(local, g.u - g.w / 2, g.u + g.w / 2, FT.curtain.t, FT.curtain.t, 0, c.retain, FT.curtain.group, FT.curtain.value, { back: false });
      groups.push(place(local, [a[0] + u[0] * s0, a[1] + u[1] * s0], u, n, c.z));
    }
  }
  for (const x of F.towers) { const local = []; FB.tower(local, FT, x.H, { depth: Math.min(most, ringD(x.at) >= 3 ? 2 : 1) }); const ey = [-x.out[0], -x.out[1]]; groups.push(place(local, x.at, [ey[1], -ey[0]], ey, x.z)); }
  for (const g of F.gates) { const local = []; FB.gatehouse(local, FT, g.h, Math.min(g.w, 6), { depth: Math.min(most, 2) }); groups.push(place(local, g.at, g.u, g.n, g.z)); }
  const floor = [];
  if (F.ditchRing) {
    const { inner, outer } = F.ditchRing;
    inner.forEach((p, k) => { const q = inner[(k + 1) % inner.length], Q = outer[(k + 1) % outer.length], P = outer[k]; floor.push({ corners: [[p[0], p[1], 0.01], [q[0], q[1], 0.01], [Q[0], Q[1], 0.01], [P[0], P[1], 0.01]], normal: [0, 0, 1], part: 'ground', group: 'town:soil', value: 0.22 }); });
    for (const br of F.bridges) { const o = [-br.u[1], br.u[0]], at = (s, k) => [r3(br.at[0] - o[0] * s + br.u[0] * k), r3(br.at[1] - o[1] * s + br.u[1] * k), 0.06]; floor.push({ corners: [at(br.from, -br.w / 2), at(br.from, br.w / 2), at(br.to, br.w / 2), at(br.to, -br.w / 2)], normal: [0, 0, 1], part: 'ground', group: 'str:timber', value: 0.45 }); }
  }
  return { groups, floor };
}

/** The boundary laws, read off the plan: bounded, gated, sightline, guarded, form-reach, walls-clear, party-once. */
function boundaryLaws(B, { lots, paths, routes, terraces, stairs, BR, yardOf, held = [] }) {
  const want = (id) => TOWN_LAWS.find((x) => x.id === id).want, dir = (b) => { const L = Math.hypot(b.pts[1][0] - b.pts[0][0], b.pts[1][1] - b.pts[0][1]); return { L, u: [(b.pts[1][0] - b.pts[0][0]) / L, (b.pts[1][1] - b.pts[0][1]) / L] }; };
  const along_ = (b, p) => { const { u } = dir(b); return (p[0] - b.pts[0][0]) * u[0] + (p[1] - b.pts[0][1]) * u[1]; };
  // bounded: a yard deep enough has its back; a lived lot has its sides
  const yards = lots.filter((l) => !l.farm && !l.dare && BR[l.focus && BR.precinct ? 'precinct' : 'back'] && yardOf(l) >= 1.2 - 1e-6), backed = yards.filter((l) => l.backsOn || B.some((b) => (b.role === 'back' || b.role === 'precinct') && b.lot === lots.indexOf(l) && !b.side));
  // gated: each front's path crosses inside one of its gates
  const fronts = B.filter((b) => b.role === 'front' && !b.side), gated = fronts.filter((b) => { const p = paths.find((x) => x.lot === b.lot), s = along_(b, p.pts[1]); return b.gates.some((g) => Math.abs(s - g.s) <= g.w / 2 - 0.05 && g.w >= p.w); });
  const tall = B.filter((b) => b.role === 'front' && b.h > BOUNDARY_HEIGHTS.low.h[1] + 1e-9);
  // guarded: every terrace has a guard ≥ 0.9, its openings no more than its stairs'
  const guards = terraces.map((t) => B.find((b) => b.role === 'guard' && Math.abs(b.pts[0][1] - t.y) < 1 && b.z === t.z1)), guarded = guards.filter((g, k) => held.includes(terraces[k].level) || (g && g.h >= 0.9 - 1e-9 && g.gates.length <= stairs.filter((s) => s.level === terraces[k].level).length));
  const off = B.filter((b) => { const F = BOUNDARY_FORMS[b.form]; return b.role === 'retain' ? b.h > F.retain + 1e-9 : b.h < F.h[0] - 1e-9 || b.h > F.h[1] + 1e-9; });
  // walls-clear: sampled along each run, gates and stairs skipped
  const onWay = [], boxes = routes.map((r) => ({ r, m: r.w / 2 + r.foot + 1, x0: Math.min(...r.pts.map((p) => p[0])), x1: Math.max(...r.pts.map((p) => p[0])), y0: Math.min(...r.pts.map((p) => p[1])), y1: Math.max(...r.pts.map((p) => p[1])) }));
  for (const b of B) {
    const { L } = dir(b), skip = [...b.gates, ...(b.stairs ?? [])], [a, c] = b.pts;
    const near = boxes.filter((q) => Math.max(a[0], c[0]) > q.x0 - q.m && Math.min(a[0], c[0]) < q.x1 + q.m && Math.max(a[1], c[1]) > q.y0 - q.m && Math.min(a[1], c[1]) < q.y1 + q.m).map((q) => q.r);
    for (let s = 0.25; s < L; s += 0.5) {
      if (skip.some((g) => Math.abs(s - g.s) < g.w / 2 + 0.2)) continue;
      const p = [b.pts[0][0] + ((b.pts[1][0] - b.pts[0][0]) * s) / L, b.pts[0][1] + ((b.pts[1][1] - b.pts[0][1]) * s) / L];
      const r = near.find((x) => distTo(x.pts, ...p) < x.w / 2 + x.foot + b.t / 2 - 0.02);
      if (r) { onWay.push(`${b.role} ${b.id} on the ${r.id}`); break; }
    }
  }
  // party-once: no two runs lie along each other (two meeting at a joint may lap by a thickness)
  const twice = [];
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j], da = dir(a), db = dir(b);
    if (Math.abs(da.u[0] * db.u[1] - da.u[1] * db.u[0]) > 0.05 || Math.abs(a.z - b.z) > 0.01) continue;
    const m = [(b.pts[0][0] + b.pts[1][0]) / 2, (b.pts[0][1] + b.pts[1][1]) / 2], s = along_(a, m), q = [a.pts[0][0] + da.u[0] * s, a.pts[0][1] + da.u[1] * s];
    if (Math.hypot(m[0] - q[0], m[1] - q[1]) < (a.t + b.t) / 2 - 0.02) { const s0 = along_(a, b.pts[0]), s1 = along_(a, b.pts[1]); if (Math.min(da.L, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) > Math.max(a.t, b.t) + 0.3) twice.push(`${a.id}/${b.id}`); }
  }
  const by = (r) => B.filter((b) => b.role === r).length;
  return [
    { law: 'bounded', ok: backed.length === yards.length, value: `${backed.length} of ${yards.length} yards closed at the back${yards.some((l) => l.backsOn) ? ` (${yards.filter((l) => l.backsOn).length} by the route behind)` : ''}; ${by('side')} party lines, ${by('precinct')} precinct runs, ${by('field')} field walls` },
    { law: 'gated', ok: gated.length === fronts.length, value: `${gated.length} of ${fronts.length} fronts gated at their door paths` },
    { law: 'sightline', ok: tall.length === 0, value: fronts.length ? `fronts ${Math.min(...fronts.map((b) => b.h))}–${Math.max(...fronts.map((b) => b.h))} m${tall.length ? `; ${tall.length} over` : ''}` : 'no fronts: an open street' },
    { law: 'guarded', ok: guarded.length === terraces.length, value: terraces.length ? `${guarded.length} of ${terraces.length} drops guarded (${[...guards.filter(Boolean).map((g) => `${g.form} ${g.h} m${g.risen ? ', the wall risen' : ''}`), ...held.map((k) => `terrace ${k} by its ward's curtain`)].join('; ')})` : 'one level: no drop' },
    { law: 'form-reach', ok: off.length === 0, value: off.length ? off.map((b) => `${b.form} ${b.role} ${b.h} m`).join('; ') : `${B.length} runs, each within its form (${[...new Set(B.map((b) => b.form))].join(', ')})` },
    { law: 'walls-clear', ok: onWay.length === 0, value: onWay.length ? onWay.slice(0, 4).join('; ') : 'every run clear of the roads and walks' },
    { law: 'party-once', ok: twice.length === 0, value: twice.length ? `${twice.length} doubled: ${twice.slice(0, 4).join(', ')}` : `${B.filter((b) => b.between).length} shared lines, each built once` },
  ].map((l) => ({ ...l, want: want(l.law) }));
}

/**
 * A boundary run as faces in town coordinates, at a depth its ring gives (near 3, mid 1, far 0; `most` caps it, for a
 * view too small to read the laying); a run under the eye spot at its ring is not built. Long runs come in lengths of 8 m, each its own group, so the drawer orders them with
 * the buildings by them. → [[faces], …]
 */
export function boundaryFaces(town, b, { depth = null, most = 3 } = {}) {
  const ring = b.ring ?? 'near', d = depth ?? Math.min(most, { near: 3, mid: 1, far: 0 }[ring]), el = { ...(b.el === 'default' ? { form: b.form } : town.language.street.bounds[b.el] ?? { form: b.form }), form: b.form };
  if (depth === null && Math.max(b.h, b.role === 'retain' ? b.h : 0) < eyeSpot(ring) - 1e-9) return [];
  const [a, c] = b.pts, L = Math.hypot(c[0] - a[0], c[1] - a[1]), u = [(c[0] - a[0]) / L, (c[1] - a[1]) / L], n = [-u[1], u[0]], out = [];
  for (let s0 = 0; s0 < L - 1e-6; s0 += 8) {
    const s1 = Math.min(L, s0 + 8), len = s1 - s0, local = [], gates = b.gates.filter((g) => g.s + g.w / 2 > s0 && g.s - g.w / 2 < s1).map((g) => ({ u: g.s - s0, w: g.w }));
    EB.boundary(local, len, el, b.h, { depth: d, gates, seed: subSeed(town.seed, `${b.id}:${s0}`), retain: b.role === 'retain' ? b.h : 0 });
    // the run's frame: x along it, y across to its left (a retaining wall's face, its −y, to the lower ground)
    const map = ([x, y, z]) => [r3(a[0] + u[0] * (s0 + x) + n[0] * y), r3(a[1] + u[1] * (s0 + x) + n[1] * y), r3(b.z + z)];
    out.push(local.map((f) => ({ ...f, corners: f.corners.map(map), normal: [u[0] * f.normal[0] + n[0] * f.normal[1], u[1] * f.normal[0] + n[1] * f.normal[1], f.normal[2]].map(r3) })));
  }
  return out;
}

/**
 * A STREET TILE: a module of a rank's section (both walks and the road between), whole paving units long and the same
 * at both ends, so an engine can lay a route as tiles. `kind`: run, drop (a crossing: the walk dropped to the road),
 * end (the walk ends, its edge returning across it). Degrees of detail by ring: far one face to a surface; mid the
 * edge's own faces, the channel, the verge; near the joints in the tile. → { faces, len, w, units, tris, laws }
 */
export function streetTile(anchor, rank = 'lane', { ring = 'near', kind = 'run' } = {}) {
  const L = typeof anchor === 'object' && anchor.street && anchor.vocab ? anchor : decompileAnchor(anchor), SX = L.street, C = TOWN_CARD, R = C.ranks[rank];
  const footW = C.section[rank].foot * SX.footway.w >= 0.9 ? r3(C.section[rank].foot * SX.footway.w) : 0, paving = rank === 'lane' ? SX.road.paving : R.paving;
  // the module: whole road units (setts in pairs of courses), nearest 4 m
  const ru = paving === 'setts' ? 0.64 : paving === 'flags' ? 0.6 : 1, len = r3(ru * Math.max(1, Math.round(4 / ru)));
  const S = { ...SX, road: { ...SX.road, paving }, footway: { ...SX.footway, w: footW } }, depth = { near: 2, mid: 1, far: 0 }[ring], faces = [];
  for (const side of [1, -1]) {
    const half = [];
    if (footW) EB.section(half, len, R.w / 2, S, { depth, kind }); else half.push({ corners: [[0, -R.w / 2, 0], [len, -R.w / 2, 0], [len, 0, 0], [0, 0, 0]], normal: [0, 0, 1], part: 'ground', value: 0.6, group: PAVINGS[paving].group });
    // each half from the road's centre out: y shifted by half the road, the second half mirrored across the centre
    for (const f of half) faces.push({ ...f, corners: (side > 0 ? f.corners : f.corners.slice().reverse()).map(([x, y, z]) => [r3(x), r3(side * (y + R.w / 2)), r3(z)]), normal: [f.normal[0], side * f.normal[1], f.normal[2]] });
  }
  const tris = faces.filter((f) => !f.tile).reduce((a, f) => a + f.corners.length - 2, 0), budget = Math.round(STRUCTURE_RINGS[ring].budget / 5);
  // seamless: the section at x = 0 is the section at x = len (a tile meets the next one edge for edge)
  const at = (x) => [...new Set(faces.filter((f) => !f.tile).flatMap((f) => f.corners.filter((c) => Math.abs(c[0] - x) < 1e-6).map((c) => `${c[1]},${c[2]}`)))].sort().join(' ');
  const units = { road: r3(len / ru), walk: footW ? Math.round(len / (SX.footway.form === 'boards' ? 0.5 : SX.footway.paving === 'setts' ? 0.32 : SX.footway.paving === 'slabs' ? 0.9 : 0.6)) : 0 };
  const laws = [
    { law: 'seamless', ok: kind === 'end' || at(0) === at(len), value: kind === 'end' ? 'an end tile closes a run' : `${at(0).split(' ').length} section points, the same at both ends`, want: 'the tile\'s section is the same at both ends' },
    { law: 'whole-units', ok: Math.abs(units.road - Math.round(units.road)) < 1e-6, value: `${len} m: ${Math.round(units.road)} road units${units.walk ? `, ${units.walk} walk joints` : ''}`, want: 'whole paving units to a tile, a joint at its start, none at its end' },
    { law: 'budget', ok: tris <= budget, value: `${tris} / ${budget}`, want: 'a tile costs a fifth of its ring\'s building budget at most' },
  ];
  return { faces, len, w: r3(R.w + 2 * footW), rank, ring, kind, units, tris, budget, laws };
}

/** A lot's building (and its tile, unless `tile` is false) in town coordinates, each face carrying `paint` if given. */
export function placedFaces(l, { tile = true, paint = null } = {}) {
  const { o, ex, ey } = l.place, map = (p) => [r3(o[0] + ex[0] * p[0] + ey[0] * p[1]), r3(o[1] + ex[1] * p[0] + ey[1] * p[1]), r3(o[2] + p[2])];
  const out = [];
  for (const f of [...l.design.faces, ...(tile ? l.design.tile : [])]) out.push({ ...f, corners: f.corners.map(map), normal: [ex[0] * f.normal[0] + ey[0] * f.normal[1], ex[1] * f.normal[0] + ey[1] * f.normal[1], f.normal[2]].map(r3), ...(paint ? { paint } : {}) });
  return out;
}
