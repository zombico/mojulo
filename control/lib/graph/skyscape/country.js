/**
 * THE COUNTRY — the settled land a pilot flies over, laid on a map's ground (ground.js) before it is drawn: its
 * settlements, the roads that join them, the line that feeds them, the things that stand up out of it. A flight sees a
 * region at once, so nothing here is drawn at a walker's detail: what reads from the air is a block's buildings at their
 * heights and their faces' windows, the streets as paint on the ground, a highway on its piers, a tank farm, a pylon line.
 *
 * One generator at every grain. A settlement is the GEOCITY's design (geocity/design.js) laid on the map's own natural
 * ground (its `field`), at a CARD by its size:
 *
 *   metro     a geocity metro card at its own extent (lakeshore by default): its core's towers, its frame, its outskirts'
 *             geotown segments, its industry and its highways. Sited on the coast where the sea allows it, its water side
 *             turned to the sea (its shore expressway and its waterfront then the sea's), else inland with no water
 *   town      the same generator at a market town's card: a kilometre and a half, a low core of shops and offices round
 *             its crossing, mid-rise round that, houses outward, a works or two at its edge; no highway
 *   village   a crossroads' worth: houses and a main street, two or three storeys, nothing taller
 *
 * Each is graded onto its streets' ground S (a kernel `grade` layer, as a pad is: the ground under its buildings is the
 * ground its design stood them on), eased back into the land past its edge, never into the sea.
 *
 *   roads     the settlements and the airfield joined: a minimum spanning tree over them, each edge routed across the
 *             land on the map's grid (A*: slope costs, the sea and the pads are walls, another settlement is avoided),
 *             smoothed; a metro's links are highways, a village's lanes; and the country carried on past the field (a
 *             road off to the reach's edge from the largest settlement)
 *   power     a high-voltage line on lattice pylons (geocity/industry.js PYLON) from the metro's substation (else its
 *             edge) out to the reach, away from the airfield, routed as a road is, its spans each SPAN metres
 *   landmarks a water tower on each town's and village's highest edge, a mast on the field's highest ground (clear of
 *             the climb-outs), its tip lit
 *
 *   SETTLEMENTS, readCountryAsk(ask) → errors
 *   planCountry(map, ctx, ask) → { settlements, roads, power, landmarks, layers (the grade layers), report }
 *     ctx { nat (x, y) → the natural ground, sea (m | null), pads (sited), taken ([cx, cy, w, d] rects kept clear), seed }
 *   seatCountry(country, groundAt, cube) → { boxes, gables, rounds, decks, piers, pylons, wires, plan, roofs, report }:
 *     the masses at flight detail on the graded ground, the ground plan to paint (rects and ribbons), and each
 *     settlement's roof grid (city.js packRoofs' shape) so a tower is something a craft can hit
 *
 * Metres, world frame (x east, y north, z up). Pure, deterministic: the dice are streamOf(seed, layer, key).
 */
import { designGeocity } from '../geocity/design.js';
import { readGeocity } from '../geocity/metro.js';
import { industrialPlan } from '../geocity/industry.js';
import { streamOf, strHash } from '../city/plan/dice.js';
import * as dmath from '../../util/dmath.js';

/** The settlement cards: each a geocity recipe at its grain, the clear ground kept round it (m), its grade's falloff (m). */
export const SETTLEMENTS = Object.freeze({
  metro: Object.freeze({ read: 'a metro: its core\'s towers, its frame, its outskirts, its industry, its highways on their piers; on the coast where the sea allows', geocity: Object.freeze({ metro: 'lakeshore' }), coast: true, gap: 900, falloff: 160 }),
  town: Object.freeze({
    read: 'a market town: a low core round its crossing, mid-rise round that, houses outward, a works at its edge',
    geocity: Object.freeze({
      metro: { from: 'harbour-island', arterials: { core: [200, 260], outer: [300, 380], reach: 500 }, rings: { core: 220, frame: 460 } },
      extent: [1500, 1200], water: { sides: [], depth: 0 }, core: [0.5, 0.5], hills: false,
      heights: { core: { rail: [2, 7], median: [3, 5] }, frame: { rail: [2, 5], median: [2, 3.5] }, outskirts: { rail: [1, 3], median: [1.5, 2.2] }, corridor: { spine: 4, arterial: 3, depth: 26 }, nodes: { every: 0, reach: 0 } },
      segments: { core: { tower: 0, podium: 1 }, frame: { midrise: 2, slab: 0.3 }, outskirts: { houses: 8, apartments: 1, lowrise: 1 } },
      green: { parks: 1, share: 0.1 }, highways: false, industry: { share: 0.15 }, waterfront: false,
    }),
    gap: 500, falloff: 90,
  }),
  village: Object.freeze({
    read: 'a village: houses along a main street at a crossroads, two or three storeys, nothing taller',
    geocity: Object.freeze({
      metro: { from: 'harbour-island', arterials: { core: [200, 240], outer: [220, 280], reach: 200 }, rings: { core: 120, frame: 240 } },
      extent: [760, 640], water: { sides: [], depth: 0 }, core: [0.5, 0.5], hills: false,
      heights: { core: { rail: [1, 3], median: [2, 3] }, frame: { rail: [1, 3], median: [1.5, 2.5] }, outskirts: { rail: [1, 2], median: [1, 2] }, corridor: { spine: 3, arterial: 2, depth: 20 }, nodes: { every: 0, reach: 0 } },
      segments: { core: { tower: 0, podium: 1 }, frame: { midrise: 1, slab: 0 }, outskirts: { houses: 9, apartments: 0, lowrise: 0 } },
      green: { parks: 0, share: 0.08 }, highways: false, industry: false, waterfront: false,
    }),
    gap: 300, falloff: 60,
  }),
});
export const SETTLEMENT_IDS = Object.freeze(Object.keys(SETTLEMENTS));

/** The country's numbers: the grade's grid (m); the road grid's cell (m); a road's width by rank (m); a pylon span (m)
 *  and height (m); a mast's height (m); a water tower's legs and tank (m). */
export const COUNTRY = Object.freeze({
  gradeCell: 20, roadCell: 50,
  ranks: Object.freeze({ highway: 26, road: 9, lane: 5.5 }),
  span: 320, pylon: 38, mast: 150, waterTower: Object.freeze({ legs: 24, r: 7, h: 9 }),
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isUV = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
const r2 = (v) => Math.round(v * 100) / 100;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** The ask read to its parts: `true` a town and two villages; else { metro?, towns?, villages?, roads?, power?,
 *  landmarks?, settlements? }: `metro` true or a geocity recipe ({ metro: 'harbour-island', … }); towns and villages
 *  counts; `settlements` an explicit list [{ kind, at?: [u, v], geocity? }] in place of the counts. */
function readAsk(ask) {
  if (ask === true) return { list: [{ kind: 'town' }, { kind: 'village' }, { kind: 'village' }], roads: true, power: true, landmarks: true };
  const list = [];
  if (Array.isArray(ask.settlements)) for (const s of ask.settlements) list.push({ ...s });
  else {
    if (ask.metro) list.push({ kind: 'metro', ...(isObj(ask.metro) ? { geocity: ask.metro } : {}) });
    for (let i = 0; i < (ask.towns ?? (ask.metro ? 1 : 1)); i++) list.push({ kind: 'town' });
    for (let i = 0; i < (ask.villages ?? 2); i++) list.push({ kind: 'village' });
  }
  return { list, roads: ask.roads !== false, power: ask.power ?? !!list.some((s) => s.kind === 'metro' || s.kind === 'town'), landmarks: ask.landmarks !== false };
}

/** Errors (strings) for `ground.country`; [] when it lays. */
export function readCountryAsk(ask, at = 'ground.country') {
  if (ask === undefined || ask === false || ask === true) return [];
  if (!isObj(ask)) return [`${at} must be true, false or { metro?, towns?, villages?, settlements?, roads?, power?, landmarks? }`];
  const e = [];
  for (const k of Object.keys(ask)) if (!['metro', 'towns', 'villages', 'settlements', 'roads', 'power', 'landmarks'].includes(k)) e.push(`${at}.${k} is not a setting (metro, towns, villages, settlements, roads, power, landmarks)`);
  for (const k of ['towns', 'villages']) if (ask[k] !== undefined && !(Number.isInteger(ask[k]) && ask[k] >= 0 && ask[k] <= 6)) e.push(`${at}.${k} must be a whole number 0–6`);
  if (ask.metro !== undefined && typeof ask.metro !== 'boolean' && !isObj(ask.metro)) e.push(`${at}.metro must be true or a geocity recipe ({ metro: 'lakeshore' | 'harbour-island', … })`);
  for (const k of ['roads', 'power', 'landmarks']) if (ask[k] !== undefined && typeof ask[k] !== 'boolean') e.push(`${at}.${k} must be true or false`);
  if (ask.settlements !== undefined) {
    if (!Array.isArray(ask.settlements) || ask.settlements.length > 8) e.push(`${at}.settlements must be a list of at most 8 { kind, at?: [u, v], geocity? }`);
    else ask.settlements.forEach((s, i) => {
      if (!isObj(s) || !SETTLEMENTS[s.kind]) e.push(`${at}.settlements[${i}].kind must be one of ${SETTLEMENT_IDS.join(', ')}`);
      else {
        if (s.at !== undefined && !isUV(s.at)) e.push(`${at}.settlements[${i}].at must be [u, v] in the field, each 0–1`);
        if (s.geocity !== undefined && !isObj(s.geocity)) e.push(`${at}.settlements[${i}].geocity must be a geocity recipe`);
      }
    });
  }
  if (!e.length) {
    // each settlement's recipe as the geocity reads it
    for (const s of readAsk(ask).list) { try { readGeocity(designSpec(s, null)); } catch (err) { e.push(`${at}: ${err.message}`); } }
  }
  return e;
}

/** A settlement's geocity recipe: its card's, under what the ask says, turned to the side its water is on (null: inland,
 *  no water). */
function designSpec(s, side) {
  const card = SETTLEMENTS[s.kind], base = { ...card.geocity, ...(s.geocity || {}) };
  if (s.kind !== 'metro') return base;
  if (!side) return { ...base, water: { sides: [], depth: 0 }, core: [0.5, 0.5], waterfront: false };
  // the card's own shore is its south: its core's distance from it and its extent's long side along it, turned
  const Mid = typeof base.metro === 'string' ? base.metro : base.metro?.from ?? 'lakeshore';
  const turn = { s: (u, v) => [u, v], n: (u, v) => [u, 1 - v], w: (u, v) => [v, u], e: (u, v) => [1 - v, u] }[side];
  const ext = base.extent ?? (Mid === 'harbour-island' ? [3600, 3000] : [4400, 3400]), core = base.core ?? (Mid === 'harbour-island' ? [0.5, 0.16] : [0.5, 0.12]);
  return { ...base, extent: side === 'w' || side === 'e' ? [ext[1], ext[0]] : ext, water: { sides: [side], depth: base.water?.depth ?? 320 }, core: turn(core[0], core[1]).map(r2), fall: { drop: 30, toward: side } };
}

/** The extent [W, D] a settlement's recipe lays (m), and its water band's depth. */
function extentOf(spec) {
  const id = typeof spec.metro === 'string' ? spec.metro : spec.metro?.from ?? 'lakeshore';
  return spec.extent ?? (id === 'harbour-island' ? [3600, 3000] : [4400, 3400]);
}

// ── siting ──────────────────────────────────────────────────────────────────────────────────────────────────
/** The best place for a rect [W, D] in the field: dry, flat, clear of what is taken; with `side` its water band on the
 *  sea and its land on land. → { cx, cy, score } | null */
function siteRect(W, D, { nat, sea, F, taken, gap, side, depth, want, step }) {
  const N = 6, land = (z) => sea === null || z > sea + 1;
  let best = null;
  const mx = Math.max(0, F.hx - W / 2 - 40), my = Math.max(0, F.hy - D / 2 - 40);
  for (let cy = -my; cy <= my + 1e-6; cy += step) for (let cx = -mx; cx <= mx + 1e-6; cx += step) {
    if (taken.some(([tx, ty, tw, td]) => Math.abs(cx - tx) < (W + tw) / 2 + gap && Math.abs(cy - ty) < (D + td) / 2 + gap)) continue;
    // its land rect (the water band cut off its side) and the band
    let lx0 = cx - W / 2, lx1 = cx + W / 2, ly0 = cy - D / 2, ly1 = cy + D / 2, band = null;
    if (side === 's') { band = [lx0, ly0, lx1, ly0 + depth]; ly0 += depth; } else if (side === 'n') { band = [lx0, ly1 - depth, lx1, ly1]; ly1 -= depth; }
    else if (side === 'w') { band = [lx0, ly0, lx0 + depth, ly1]; lx0 += depth; } else if (side === 'e') { band = [lx1 - depth, ly0, lx1, ly1]; lx1 -= depth; }
    let dry = 0, n = 0, s1 = 0, s2 = 0;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const z = nat(lx0 + (lx1 - lx0) * i / N, ly0 + (ly1 - ly0) * j / N); n++; if (land(z)) dry++; s1 += z; s2 += z * z; }
    const dryShare = dry / n, sd = Math.sqrt(Math.max(0, s2 / n - (s1 / n) ** 2));
    if (dryShare < (side ? 0.88 : 0.98)) continue;
    let wet = 1;
    if (band) { let w = 0, m = 0; for (let j = 0; j <= 4; j++) for (let i = 0; i <= N; i++) { m++; if (!land(nat(band[0] + (band[2] - band[0]) * i / N, band[1] + (band[3] - band[1]) * j / 4))) w++; } wet = w / m; if (wet < 0.6) continue; }
    const far = want ? dmath.hypot(cx - want[0], cy - want[1]) : 0;
    const score = sd + 0.004 * far + (1 - dryShare) * 40 + (1 - wet) * 40;
    if (!best || score < best.score - 1e-9) best = { cx, cy, score };
  }
  return best;
}

// ── the grade ───────────────────────────────────────────────────────────────────────────────────────────────
/** A settlement's grade layer (terrain-kernel.js `grade`): its streets' ground S over its land, eased out over its
 *  falloff into the land round it; none into its water band (its edge there a quay). */
function gradeLayer(st, falloff, cell, sea = null) {
  const [lx0, ly0, lx1, ly1] = st.land, o = st.origin, m = falloff, wet = st.side;
  // (a metro's water band is dredged under the sea, its harbour water to its quay, eased out past its ends)
  const band = wet && sea !== null ? [o[0], o[1], o[0] + st.extent[0], o[1] + st.extent[1]] : null, floor = sea === null ? 0 : sea - 20;
  const x0 = band ? Math.min(lx0, band[0]) - m : lx0 - m, y0 = band ? Math.min(ly0, band[1]) - m : ly0 - m, x1 = band ? Math.max(lx1, band[2]) + m : lx1 + m, y1 = band ? Math.max(ly1, band[3]) + m : ly1 + m;
  const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1, N = nx * ny, z = new Float64Array(N), w = new Uint8Array(N);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * cell, Y = y0 + j * cell, cx = Math.min(lx1, Math.max(lx0, X)), cy = Math.min(ly1, Math.max(ly0, Y));
    const d = Math.max(lx0 - X, X - lx1, ly0 - Y, Y - ly1, 0), k = j * nx + i;
    z[k] = st.S(cx - o[0], cy - o[1]);
    w[k] = Math.round(255 * (1 - smooth(0, m, d)));
    if (band && d > 0) {
      // in the band (past the quay, on its water side): the sea's floor
      const inB = wet === 's' ? Y < ly0 : wet === 'n' ? Y > ly1 : wet === 'w' ? X < lx0 : X > lx1;
      const db = Math.max(band[0] - X, X - band[2], band[1] - Y, Y - band[3], 0), along = wet === 's' || wet === 'n' ? Math.max(lx0 - X, X - lx1, 0) : Math.max(ly0 - Y, Y - ly1, 0);
      if (inB) { z[k] = Math.min(floor, z[k]); w[k] = Math.round(255 * (1 - smooth(0, m, Math.max(db, along)))); }
    }
    if (z[k] < lo) lo = z[k]; if (z[k] > hi) hi = z[k];
  }
  const dStep = (hi - lo) / 65535 || 1e-9, dq = new Uint16Array(N);
  for (let k = 0; k < N; k++) dq[k] = Math.round((z[k] - lo) / dStep);
  return { x0, y0, dx: cell, nx, ny, dMin: lo, dStep, dq, w, ramp: null };
}

// ── the roads ───────────────────────────────────────────────────────────────────────────────────────────────
/** A min-heap of [cost, index]. */
function heap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(c, i) { a.push([c, i]); let k = a.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (a[p][0] <= a[k][0]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; k = m; } } return top; },
  };
}
/** The land as the road router sees it: a grid over the reach, each cell's ground and whether it is a wall. */
function routeGrid(map, nat, sea, walls) {
  const R = map.rings.reach, c = COUNTRY.roadCell, nx = Math.ceil(2 * R.hx / c) + 1, ny = Math.ceil(2 * R.hy / c) + 1, z = new Float64Array(nx * ny), wall = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = -R.hx + i * c, Y = -R.hy + j * c, k = j * nx + i;
    z[k] = nat(X, Y);
    if (sea !== null && z[k] < sea + 1.5) wall[k] = 1;
    else if (walls.some((q) => X > q[0] && X < q[2] && Y > q[1] && Y < q[3])) wall[k] = 1;
  }
  return { nx, ny, c, x0: -R.hx, y0: -R.hy, z, wall };
}
const cellOf = (G, x, y) => [Math.max(0, Math.min(G.nx - 1, Math.round((x - G.x0) / G.c))), Math.max(0, Math.min(G.ny - 1, Math.round((y - G.y0) / G.c)))];
/** A route from a to b on the grid (A*, 8 ways): the length, the climb (a grade's cost rises with its square), a
 *  `soft` rect's cells dearer (a settlement passed round), a wall never crossed (the ends may stand in one). → [[x, y]…] | null */
function route(G, a, b, soft = []) {
  const [ai, aj] = cellOf(G, a[0], a[1]), [bi, bj] = cellOf(G, b[0], b[1]), N = G.nx * G.ny, start = aj * G.nx + ai, goal = bj * G.nx + bi;
  const g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), H = heap();
  const h = (k) => dmath.hypot((k % G.nx - bi) * G.c, (Math.floor(k / G.nx) - bj) * G.c);
  const softAt = (k) => { const X = G.x0 + (k % G.nx) * G.c, Y = G.y0 + Math.floor(k / G.nx) * G.c; return soft.some((q) => X > q[0] && X < q[2] && Y > q[1] && Y < q[3]) ? 6 : 1; };
  g[start] = 0; H.push(h(start), start);
  const near = (k, e) => Math.abs(k % G.nx - e % G.nx) <= 2 && Math.abs(Math.floor(k / G.nx) - Math.floor(e / G.nx)) <= 2;
  while (H.size) {
    const [, k] = H.pop(); if (done[k]) continue; done[k] = 1;
    if (k === goal) break;
    const i = k % G.nx, j = Math.floor(k / G.nx);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const I = i + di, J = j + dj; if (I < 0 || J < 0 || I >= G.nx || J >= G.ny) continue;
      const q = J * G.nx + I; if (done[q]) continue;
      if (G.wall[q] && !near(q, start) && !near(q, goal)) continue;
      const run = G.c * (di && dj ? Math.SQRT2 : 1), grade = Math.abs(G.z[q] - G.z[k]) / run;
      const cost = g[k] + run * (1 + 60 * grade * grade + (grade > 0.12 ? 20 : 0)) * softAt(q);
      if (cost < g[q]) { g[q] = cost; from[q] = k; H.push(cost + h(q), q); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const path = []; for (let k = goal; k >= 0; k = from[k]) { path.push([G.x0 + (k % G.nx) * G.c, G.y0 + Math.floor(k / G.nx) * G.c]); if (k === start) break; }
  path.reverse(); path[0] = [a[0], a[1]]; path[path.length - 1] = [b[0], b[1]];
  return smoothPath(path);
}
/** A grid route made a road: corner-cut twice (Chaikin), its ends kept. */
function smoothPath(p) {
  let q = p;
  for (let it = 0; it < 3; it++) {
    if (q.length < 3) break;
    const o = [q[0]];
    for (let k = 0; k + 1 < q.length; k++) { const [ax, ay] = q[k], [bx, by] = q[k + 1]; o.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]); }
    o.push(q[q.length - 1]); q = o;
  }
  // thinned: a point kept where the road turns or every 120 m
  const out = [q[0]]; let run = 0;
  for (let k = 1; k + 1 < q.length; k++) {
    const [ax, ay] = out[out.length - 1], [bx, by] = q[k], [cx, cy] = q[k + 1];
    run += dmath.hypot(bx - ax, by - ay);
    const t1 = Math.atan2(by - ay, bx - ax), t2 = Math.atan2(cy - by, cx - bx); let dt = Math.abs(t2 - t1); if (dt > Math.PI) dt = 2 * Math.PI - dt;
    if (dt > 0.06 || run > 120) { out.push([r2(bx), r2(by)]); run = 0; }
  }
  out.push(q[q.length - 1].map(r2));
  return out;
}
/** A settlement's gates: where its spine arterials meet its land's edge (a road from the country comes in there). */
function gatesOf(st) {
  const o = st.origin, [lx0, ly0, lx1, ly1] = st.land, out = [];
  for (const l of st.d.lines) if (l.rank === 'spine') {
    if (l.axis === 'ns') { if (st.side !== 's') out.push([o[0] + l.at, ly0 - 30]); if (st.side !== 'n') out.push([o[0] + l.at, ly1 + 30]); }
    else { if (st.side !== 'w') out.push([lx0 - 30, o[1] + l.at]); if (st.side !== 'e') out.push([lx1 + 30, o[1] + l.at]); }
  }
  return out.length ? out : [[(lx0 + lx1) / 2, ly0 - 30]];
}

// ── the plan ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The country on a map: its settlements sited and designed on the natural ground, their grade layers, the roads that
 * join them and the airfield, the power line, the landmarks.
 */
export function planCountry(map, { nat, sea = null, pads = [], taken: taken0 = [], seed = 1 }, ask) {
  const A = readAsk(ask === true ? true : ask || {}), F = map.rings.field, taken = taken0.map((t) => [...t]);
  // every pad kept clear; each runway's climb-out and approach kept clear of a metro's towers (city.js CLIMB_OUT), a
  // town's and a village's roofs being lower than a circuit is flown
  const tall = [];
  for (const p of pads) {
    taken.push([(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.x1 - p.x0 + 2 * p.falloff, p.y1 - p.y0 + 2 * p.falloff]);
    if (p.kind === 'runway') {
      const half = p.length / 2, run = 2500, c = half + run / 2, [cx, cy] = p.center;
      for (const k of [1, -1]) tall.push(p.along === 'x' ? [cx + k * c, cy, run, 600] : [cx, cy + k * c, 600, run]);
    }
  }
  const settlements = [], skipped = [];
  // the largest first: a metro picks its shore before a town takes it
  const order = A.list.map((s, i) => ({ ...s, i })).sort((a, b) => SETTLEMENT_IDS.indexOf(a.kind) - SETTLEMENT_IDS.indexOf(b.kind) || a.i - b.i);
  for (const s of order) {
    const card = SETTLEMENTS[s.kind], want = isUV(s.at) ? [-F.hx + s.at[0] * 2 * F.hx, -F.hy + s.at[1] * 2 * F.hy] : null;
    const base = designSpec(s, null), [W0, D0] = extentOf(base), step = Math.max(100, Math.round(Math.min(W0, D0) / 8 / 50) * 50);
    let site = null, side = null;
    const kept = s.kind === 'metro' ? [...taken, ...tall] : taken;
    // (a metro on the coast: its water band on the sea, which lies past the field on an island, so searched to the reach)
    if (card.coast && sea !== null) {
      const Rr = map.rings.reach;
      for (const sd of ['s', 'w', 'n', 'e']) {
        const spec = designSpec(s, sd), [W, D] = extentOf(spec), depth = spec.water.depth;
        const at = siteRect(W, D, { nat, sea, F: { hx: Rr.hx - 100, hy: Rr.hy - 100 }, taken: kept, gap: card.gap, side: sd, depth, want, step });
        if (at && (!site || at.score < site.score)) { site = at; side = sd; }
      }
    }
    if (!site) { side = null; site = siteRect(W0, D0, { nat, sea, F, taken: kept, gap: card.gap, side: null, want, step }); }
    if (!site) { skipped.push(s.kind); continue; }
    const spec = designSpec(s, side), [W, D] = extentOf(spec), origin = [r2(site.cx - W / 2), r2(site.cy - D / 2)];
    // the design on the map's natural ground, in its own frame (never under the sea's edge where it builds)
    const floor = sea === null ? -Infinity : sea + 2;
    const sd = streamOf(seed, 'country', `${s.kind}:${settlements.length}`), dseed = 1 + Math.floor(sd() * 9999);
    const d = designGeocity(spec, { seed: dseed, field: (x, y) => Math.max(floor, nat(origin[0] + x, origin[1] + y)) });
    const L = d.land.rect, land = [origin[0] + L[0], origin[1] + L[1], origin[0] + L[2], origin[1] + L[3]].map(r2);
    const st = { id: `${s.kind}-${settlements.length + 1}`, kind: s.kind, side, origin, extent: [W, D], land, d, S: d.land.S };
    st.layer = gradeLayer(st, card.falloff, COUNTRY.gradeCell, sea);
    settlements.push(st);
    taken.push([site.cx, site.cy, W, D]);
  }
  // the roads: a minimum spanning tree over the settlements and the airfield, each edge routed; then the country past
  // the field, from the largest settlement to the reach's edge
  const roads = [];
  if (A.roads && settlements.length) {
    const walls = pads.map((p) => [p.x0 - 20, p.y0 - 20, p.x1 + 20, p.y1 + 20]);
    const G = routeGrid(map, nat, sea, walls), soft = settlements.map((s) => s.land);
    const nodes = settlements.map((s) => ({ id: s.id, kind: s.kind, gates: gatesOf(s), at: [(s.land[0] + s.land[2]) / 2, (s.land[1] + s.land[3]) / 2] }));
    const field = pads.find((p) => p.kind === 'runway');
    if (field) { const off = field.along === 'x' ? [0, field.width / 2 + 90] : [field.width / 2 + 90, 0]; nodes.push({ id: 'airfield', kind: 'airfield', gates: [[field.center[0] + off[0], field.center[1] + off[1]], [field.center[0] - off[0], field.center[1] - off[1]]], at: field.center }); }
    const inTree = new Set([0]), edges = [];
    while (inTree.size < nodes.length) {
      let best = null;
      for (const a of inTree) for (let b = 0; b < nodes.length; b++) if (!inTree.has(b)) { const dd = dmath.hypot(nodes[a].at[0] - nodes[b].at[0], nodes[a].at[1] - nodes[b].at[1]); if (!best || dd < best.dd) best = { a, b, dd }; }
      inTree.add(best.b); edges.push([best.a, best.b]);
    }
    // a metro's link to a town is a highway, to a village or the airfield a road; a town's to a town a road; the rest lanes
    const rankOf = (a, b) => { const k = [a.kind, b.kind]; if (k.includes('metro')) return k.includes('town') || k.every((x) => x === 'metro') ? 'highway' : 'road'; return k.includes('village') || k.includes('airfield') ? 'lane' : 'road'; };
    const gatePair = (a, b) => { let best = null; for (const p of a.gates) for (const q of b.gates) { const dd = dmath.hypot(p[0] - q[0], p[1] - q[1]); if (!best || dd < best.dd) best = { p, q, dd }; } return best; };
    for (const [ia, ib] of edges) {
      const a = nodes[ia], b = nodes[ib], { p, q } = gatePair(a, b), pts = route(G, p, q, soft.filter((r, k) => settlements[k].id !== a.id && settlements[k].id !== b.id));
      if (pts) roads.push({ id: `${a.id}~${b.id}`, rank: rankOf(a, b), w: COUNTRY.ranks[rankOf(a, b)], pts });
    }
    // the country carried on: from the largest settlement's gate farthest from the field's middle, out to the reach
    const big = nodes[0], R = map.rings.reach, gate = big.gates.slice().sort((p, q) => dmath.hypot(q[0], q[1]) - dmath.hypot(p[0], p[1]))[0];
    const ux = gate[0] / (dmath.hypot(gate[0], gate[1]) || 1), uy = gate[1] / (dmath.hypot(gate[0], gate[1]) || 1), k = Math.min((R.hx - 60) / (Math.abs(ux) || 1e-9), (R.hy - 60) / (Math.abs(uy) || 1e-9));
    let out = [ux * k, uy * k];
    // (on an island the road ends on its shore: walked back toward the gate while the end stands in the sea)
    for (let t = 1; t > 0.05 && sea !== null && nat(out[0], out[1]) < sea + 2; t -= 0.05) out = [gate[0] + (ux * k - gate[0]) * t, gate[1] + (uy * k - gate[1]) * t];
    if (dmath.hypot(out[0] - gate[0], out[1] - gate[1]) > 400) { const pts = route(G, gate, out, soft.slice(1)); if (pts) roads.push({ id: `${big.id}~beyond`, rank: big.kind === 'metro' ? 'highway' : 'road', w: COUNTRY.ranks[big.kind === 'metro' ? 'highway' : 'road'], pts }); }
  }
  // the power line: from the metro's (else a town's) substation, else its edge, out to the reach away from the field
  const power = [];
  if (A.power && settlements.length) {
    const src = settlements.find((s) => s.kind === 'metro') ?? settlements.find((s) => s.kind === 'town');
    if (src) {
      const sub = src.d.regions.flatMap((r) => r.blocks || []).find((b) => b.kind === 'substation');
      const o = src.origin, from = sub ? [o[0] + (sub.rect[0] + sub.rect[2]) / 2, o[1] + (sub.rect[1] + sub.rect[3]) / 2] : [src.land[2] + 60, (src.land[1] + src.land[3]) / 2];
      const R = map.rings.reach, field = pads.find((p) => p.kind === 'runway')?.center ?? [0, 0];
      // (away from the airfield: the reach's corner farthest from it, on land)
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [a * (R.hx - 200), b * (R.hy - 200)]);
      const toward = (p) => { let q = p; for (let t = 1; t > 0.05 && sea !== null && nat(q[0], q[1]) < sea + 2; t -= 0.05) q = [from[0] + (p[0] - from[0]) * t, from[1] + (p[1] - from[1]) * t]; return q; };
      const ends = corners.map(toward).sort((p, q) => dmath.hypot(q[0] - field[0], q[1] - field[1]) - dmath.hypot(p[0] - field[0], p[1] - field[1]));
      const walls = pads.map((p) => [p.x0 - 300, p.y0 - 300, p.x1 + 300, p.y1 + 300]);
      const G2 = routeGrid(map, nat, sea, walls), pts = route(G2, from, ends[0], settlements.filter((s) => s !== src).map((s) => s.land));
      if (pts && pts.length > 1) {
        // pylons every SPAN along it (a tower at every turn sharper than the span allows)
        const pylons = [pts[0]]; let left = COUNTRY.span;
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k], L = dmath.hypot(bx - ax, by - ay); let t = 0;
          while (L - t >= left) { t += left; pylons.push([r2(ax + (bx - ax) * t / L), r2(ay + (by - ay) * t / L)]); left = COUNTRY.span; }
          left -= L - t;
        }
        // (a substation's first tower stands at its fence: the first span is the yard's)
        power.push({ id: `line-${src.id}`, from: src.id, pylons: pylons.length > 1 ? pylons : pts });
      }
    }
  }
  // the landmarks: a water tower on each town's and village's highest edge; a mast on the field's highest ground
  const landmarks = [];
  if (A.landmarks) {
    for (const s of settlements) if (s.kind !== 'metro') {
      const [lx0, ly0, lx1, ly1] = s.land, cand = [[lx0 - 40, ly0 - 40], [lx1 + 40, ly0 - 40], [lx1 + 40, ly1 + 40], [lx0 - 40, ly1 + 40], [(lx0 + lx1) / 2, ly1 + 50], [(lx0 + lx1) / 2, ly0 - 50]];
      const at = cand.filter(([x, y]) => sea === null || nat(x, y) > sea + 3).sort((p, q) => nat(q[0], q[1]) - nat(p[0], p[1]))[0];
      if (at) landmarks.push({ kind: 'water-tower', of: s.id, at: at.map(r2) });
    }
    let top = null;
    for (let y = -F.hy * 0.9; y <= F.hy * 0.9; y += F.hy / 12) for (let x = -F.hx * 0.9; x <= F.hx * 0.9; x += F.hx / 12) {
      if (taken.some(([tx, ty, tw, td]) => Math.abs(x - tx) < tw / 2 + 200 && Math.abs(y - ty) < td / 2 + 200)) continue;
      const z = nat(x, y); if (!top || z > top.z) top = { x, y, z };
    }
    if (top) landmarks.push({ kind: 'mast', at: [r2(top.x), r2(top.y)] });
  }
  const report = {
    settlements: settlements.map((s) => ({ id: s.id, kind: s.kind, metro: s.d.metro.id, center: [r2((s.land[0] + s.land[2]) / 2), r2((s.land[1] + s.land[3]) / 2)], size: [r2(s.land[2] - s.land[0]), r2(s.land[3] - s.land[1])], ...(s.side ? { shore: s.side } : {}), blocks: s.d.regions.reduce((a, r) => a + (r.blocks?.length ?? 0), 0), highways: s.d.highways?.length ?? 0 })),
    ...(skipped.length ? { skipped } : {}),
    roads: roads.map((r) => ({ id: r.id, rank: r.rank, length: r2(r.pts.slice(1).reduce((a, p, k) => a + dmath.hypot(p[0] - r.pts[k][0], p[1] - r.pts[k][1]), 0)) })),
    power: power.map((p) => ({ id: p.id, pylons: p.pylons.length })), landmarks: landmarks.map((l) => l.kind),
  };
  return { settlements, roads, power, landmarks, layers: settlements.map((s) => s.layer), report };
}

// ── seated: the masses at flight detail ─────────────────────────────────────────────────────────────────────
/** A box's skins, as the page's facade shader reads them: its windows' pattern by what the building is. */
export const SKINS = Object.freeze({ glass: 0, office: 1, residential: 2, industrial: 3, house: 4, plain: 5, deck: 6 });
const HOUSE_BRICK = Object.freeze(['#a3563f', '#b5654a', '#9c4b36', '#c9a57a', '#d2c3a8', '#8c5a44']);
const HOUSE_ROOF = Object.freeze(['#4a4f55', '#5b4a3f', '#3f4448', '#6a5a4c', '#7a4a3a']);
const SHOP_FRONT = Object.freeze(['#b9a88f', '#a8968a', '#c4b8a4', '#9e9488']);
const mixHex = (a, b, t) => '#' + [1, 3, 5].map((k) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, '0')).join('');
// a house pair's frontage, the gap, its depth, its setback; a storey; a shop's depth; a house's most storeys
const PAIR = 13.6, GAP = 1.4, HOUSE_D = 12, SETBACK = 5, STOREY = 3, SHOP_D = 14, HOUSE_MOST = 3;

/** The ground plan's paints (hex), from the cube's key colours: what a block's pad, a street, a park are from the air. */
export function planColours(cube) {
  const C = cube.colour;
  return {
    road: mixHex('#55585c', C.floor, 0.1), highway: mixHex('#4a4c50', C.floor, 0.06), lane: mixHex('#6e6a62', C.floor, 0.2), walk: mixHex('#b8b2a6', C.stone, 0.25),
    plaza: mixHex('#aaa496', C.stone, 0.2), lawn: mixHex('#5f7a42', C.grass, 0.15), park: mixHex('#4f6e3a', C.foliage, 0.15), court: mixHex('#5a7444', C.grass, 0.12),
    lot: mixHex('#6a6c70', C.floor, 0.1), yard: '#a29f97', bund: '#938e82', site: mixHex('#8a7a62', C.floor, 0.2), scrub: mixHex('#8a8a5a', C.grass, 0.35),
    field: mixHex('#5a8040', C.grass, 0.12), garden: mixHex('#5b7240', C.grass, 0.12), tree: mixHex('#2c4224', C.foliage, 0.15), quay: '#9a958a', sand: C.sand ?? '#d8c8a0',
  };
}
const PAD_OF = Object.freeze({ tower: 'plaza', podium: 'plaza', square: 'plaza', midrise: 'plaza', slab: 'lawn', construction: 'site', parking: 'lot', vacant: 'scrub', works: 'yard', warehouse: 'yard', storage: 'yard', tanks: 'bund', substation: 'yard', school: 'lawn', park: 'park' });

/**
 * The country seated on the graded ground: each settlement's buildings as boxes (on the page a facade shader draws
 * their windows), its houses' and halls' roofs as gables, its tanks and stacks as rounds, its highways' decks and piers;
 * the pylons and their wires; the landmarks; the ground plan (rects and ribbons, painted on the page under the land's
 * light); and each settlement's roof grid.
 */
export function seatCountry(country, groundAt, cube) {
  const col = planColours(cube), boxes = [], gables = [], rounds = [], decks = [], piers = [], rects = [], ribbons = [], dots = [], roofs = [];
  const B = (q, z0, h, wall, roof, skin, floorH = 3.4, rid = 0) => { if (q[2] - q[0] < 0.5 || q[3] - q[1] < 0.5 || h < 0.5) return; boxes.push([r2((q[0] + q[2]) / 2), r2((q[1] + q[3]) / 2), r2(z0), r2(q[2] - q[0]), r2(q[3] - q[1]), r2(h), wall, roof, skin, floorH, rid]); };
  const counts = { boxes: 0, houses: 0, towers: 0, rounds: 0 };
  for (const st of country.settlements) {
    const d = st.d, o = st.origin, G = d.grammar, office = G.floorH.office, resid = G.floorH.residential;
    const W = (q) => [o[0] + q[0], o[1] + q[1], o[0] + q[2], o[1] + q[3]];
    const zOf = (q) => Math.min(groundAt(q[0], q[1]), groundAt(q[2], q[1]), groundAt(q[2], q[3]), groundAt(q[0], q[3]), groundAt((q[0] + q[2]) / 2, (q[1] + q[3]) / 2)) - 0.3;
    const fam = (fs, id) => fs[strHash(id) % fs.length];
    const n0 = boxes.length;
    // the ground plan: the land its streets (asphalt), its arterials, each neighbourhood's ground its streets', each block
    // its pad, a park its lawn
    rects.push([...st.land, 'road']);
    for (const r of d.regions) {
      if (r.park) { rects.push([...W(r.rect), 'park']); continue; }
      if (r.parkRect && r.parkRect.rect) rects.push([...W(r.parkRect.rect), 'park']);
      for (let b of r.blocks || []) {
        if (b.geotown) continue;
        // (a village has no offices: its core's and frame's blocks are the geotown's main street, shops under flats)
        if (st.kind === 'village' && ['tower', 'podium', 'square', 'midrise', 'slab'].includes(b.kind)) b = { ...b, kind: 'main-street' };
        const q = W(b.rect), pad = PAD_OF[b.kind] ?? 'garden';
        rects.push([...q, pad]);
        const Rb = streamOf(d.seed, 'scene', b.id), med = Math.max(1, Math.round(b.storeys?.median ?? 2));
        const [x0, y0, x1, y1] = q, w = x1 - x0, h = y1 - y0, longY = h >= w, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const inset = (share) => { const e = ((w + h) - Math.sqrt((w + h) ** 2 - 4 * w * h * (1 - share))) / 4; return [x0 + e, y0 + e, x1 - e, y1 - e]; };
        if (b.kind === 'tower') {
          const [g, frame] = fam(G.skin.glass, b.id), [, ston] = fam(G.skin.stone, b.id), pod = inset(0.62), zp = zOf(pod);
          B(pod, zp, b.podium * office + (groundAt(cx, cy) - zp), ston, fam(G.skin.roof, b.id), SKINS.office, office);
          for (const t of b.towers) { const tq = W(t.rect), z0 = zOf(tq), glassy = Rb() < G.skin.towerGlass; B(tq, z0, t.storeys * office + (groundAt((tq[0] + tq[2]) / 2, (tq[1] + tq[3]) / 2) - z0), glassy ? g : ston, frame, glassy ? SKINS.glass : SKINS.office, office, 1); counts.towers++; }
        } else if (b.kind === 'podium') { const p = inset(0.8), z0 = zOf(p); B(p, z0, med * office + 0.3, fam(G.skin.stone, b.id)[1], fam(G.skin.roof, b.id), Rb() < 0.4 ? SKINS.glass : SKINS.office, office); }
        else if (b.kind === 'square') rects.push([...inset(0.4), 'court']);
        else if (b.kind === 'midrise') {
          const dp = Math.min(14, w / 3, h / 3), br = fam(G.skin.brick, b.id)[0], roof = fam(G.skin.roof, b.id), z0 = zOf(q);
          rects.push([x0 + dp, y0 + dp, x1 - dp, y1 - dp, 'court']);
          for (const p of [[x0, y0, x1, y0 + dp], [x0, y1 - dp, x1, y1], [x0, y0 + dp, x0 + dp, y1 - dp], [x1 - dp, y0 + dp, x1, y1 - dp]]) B(p, z0, med * resid + 0.3, br, roof, SKINS.residential, resid);
        } else if (b.kind === 'slab') {
          const long = Math.max(w, h) * 0.72, dp = Math.min(15, Math.min(w, h) * 0.35), p = longY ? [cx - dp / 2, cy - long / 2, cx + dp / 2, cy + long / 2] : [cx - long / 2, cy - dp / 2, cx + long / 2, cy + dp / 2];
          B(p, zOf(p), med * resid + 0.3, fam(G.skin.stone, b.id)[1], fam(G.skin.roof, b.id), SKINS.residential, resid);
        } else if (b.kind === 'construction') {
          const fh = b.ring === 'core' ? office : resid, target = Math.max(3, Math.round(b.storeys.median)), n = Math.max(2, Math.round(target * (b.progress ?? 0.5)));
          const e = Math.min(w, h) * 0.18, p = [x0 + e, y0 + e, x1 - e, y1 - e], z0 = zOf(p), top = n * fh;
          B(p, z0, top, '#9a9a96', '#9a9a96', SKINS.plain, fh);
          // its tower crane, seen from afar: the mast and the jib across it
          const mx = x0 + 3, my = y0 + 3, mt = top + 3 * fh + 14, jib = Math.max(w, h) * 0.85;
          B([mx, my, mx + 2, my + 2], z0, mt, '#e3b13a', '#e3b13a', SKINS.plain);
          B(longY ? [mx - 0.4, my - 14, mx + 2.4, my + jib] : [mx - 14, my - 0.4, mx + jib, my + 2.4], z0 + mt, 1.6, '#e3b13a', '#e3b13a', SKINS.plain);
        } else if (['works', 'warehouse', 'storage', 'tanks', 'substation'].includes(b.kind)) {
          const z0 = zOf(q);
          for (const op of industrialPlan({ ...b, rect: q }, Rb, { far: true })) {
            if (op.op === 'box') B(op.q, z0 + op.z, op.h, op.wall, op.roof, op.h > 6 ? SKINS.industrial : SKINS.office, op.h > 6 ? op.h : 3.6);
            else if (op.op === 'gable') { B(op.q, z0 + op.z, op.ze, op.wall, op.roof, SKINS.industrial, op.ze); gables.push([r2((op.q[0] + op.q[2]) / 2), r2((op.q[1] + op.q[3]) / 2), r2(z0 + op.z + op.ze), r2(op.q[2] - op.q[0]), r2(op.q[3] - op.q[1]), r2(op.zr - op.ze), op.axis === 'x' ? 0 : 1, op.roof, op.wall]); }
            else if (op.op === 'stamp') {
              const [ax, ay] = op.at, s = op.scale ?? 1;
              if (op.key === 'tank') rounds.push([r2(ax), r2(ay), r2(z0), r2(10 * s), r2(12 * s), '#e7e3d8', 0]);
              else if (op.key === 'holder') rounds.push([r2(ax), r2(ay), r2(z0), 18, 30, '#8f9a8e', 0]);
              else if (op.key === 'sphere') rounds.push([r2(ax), r2(ay), r2(z0 + 9), 7, 7, '#e9e6dc', 1]);
              else if (op.key === 'stack') rounds.push([r2(ax), r2(ay), r2(z0), 2.2, 46, '#b9b2a6', 2]);
              else if (op.key.startsWith('silos')) { const ax2 = op.key.endsWith('x'); for (let k = 0; k < 4; k++) rounds.push([r2(ax + (ax2 ? k * 8.4 : 0)), r2(ay + (ax2 ? 0 : k * 8.4)), r2(z0), 4, 28, '#c9c4b9', 0]); }
            }
          }
        } else if (b.kind === 'school') {
          const sides = longY ? ['w', 'e'] : ['s', 'n'], L = longY ? h : w, dp = longY ? w : h;
          const at = (s, u, v) => (s === 'w' ? [x0 + v, y0 + u] : s === 'e' ? [x1 - v, y0 + u] : s === 's' ? [x0 + u, y0 + v] : [x0 + u, y1 - v]);
          const rect = (s, u0, u1, v0, v1) => { const p = at(s, u0, v0), qq = at(s, u1, v1); return [Math.min(p[0], qq[0]), Math.min(p[1], qq[1]), Math.max(p[0], qq[0]), Math.max(p[1], qq[1])]; };
          const p = rect(sides[0], L / 2 - 30, L / 2 + 30, 6, 22); B(p, zOf(p), 12, '#9a4f3c', HOUSE_ROOF[2], SKINS.residential, 4);
          rects.push([...rect(sides[1], L * 0.15, L * 0.85, 6, Math.max(8, dp / 2 - 4)), 'field']);
        } else if (!PAD_OF[b.kind] || b.kind === 'school') outskirts(b, q, Rb, med);
      }
    }
    // the highways: each deck a box a station long, on its piers (a pair, or one over the water)
    for (const hw of d.highways || []) {
      const s = hw.stations, half = hw.w / 2;
      for (let k = 0; k + 3 < s.length; k += 2) {
        const u0 = s[k], u1 = s[k + 2], z = (s[k + 1] + s[k + 3]) / 2, q = hw.axis === 'x' ? [u0, hw.at - half, u1, hw.at + half] : [hw.at - half, u0, hw.at + half, u1];
        decks.push([...W(q).map(r2), r2(z)]);
      }
      for (const p of hw.piers) {
        const at = (() => { let i = 0; while (i + 3 < s.length && s[i + 2] < p.u) i += 2; return s[i + 1]; })();
        for (const c of p.cols) { const lx = hw.axis === 'x' ? p.u : hw.at + c, ly = hw.axis === 'x' ? hw.at + c : p.u, X = o[0] + lx, Y = o[1] + ly; piers.push([r2(X), r2(Y), r2(groundAt(X, Y) - 1), r2(at - 1.8)]); }
      }
    }
    // the arterials on the ground (their rights-of-way), over the blocks' edges
    for (const l of d.lines) rects.push([...W(l.rect), 'road']);
    // the roof grid (city.js ROOF_CELL): each cell its tallest roof
    roofs.push(roofGrid(st.land, boxes.slice(n0)));
    counts.boxes += boxes.length - n0;

    /** An outskirts block (the geotown's segments): its rows of house pairs under gables to the street, a main street's
     *  or an edge's shops along its street, a low-rise, a walk-up; its back gardens' trees as dots on the plan. */
    function outskirts(b, q, Rb, med) {
      const [x0, y0, x1, y1] = q, longY = y1 - y0 >= x1 - x0, sides = longY ? ['w', 'e'] : ['s', 'n'], along = longY ? [y0, y1] : [x0, x1], deep = longY ? x1 - x0 : y1 - y0, L = along[1] - along[0];
      const at = (s, u, v) => (s === 'w' ? [x0 + v, along[0] + u] : s === 'e' ? [x1 - v, along[0] + u] : s === 's' ? [along[0] + u, y0 + v] : [along[0] + u, y1 - v]);
      const rectOf = (s, u0, u1, v0, v1) => { const p = at(s, u0, v0), qq = at(s, u1, v1); return [Math.min(p[0], qq[0]), Math.min(p[1], qq[1]), Math.max(p[0], qq[0]), Math.max(p[1], qq[1])]; };
      const houses = (s, u0, u1) => {
        const len = u1 - u0, n = Math.max(1, Math.floor((len + GAP) / (PAIR + GAP))), f = (len - (n - 1) * GAP) / n, dpt = Math.min(HOUSE_D, deep / 2 - SETBACK - 4);
        if (dpt < 6) return;
        for (let k = 0; k < n; k++) {
          const u = u0 + k * (f + GAP), p = rectOf(s, u, u + f, SETBACK, SETBACK + dpt), z0 = zOf(p);
          const stc = Math.max(1, Math.min(b.storeys.rail[1], HOUSE_MOST, med + (Rb() < 0.3 ? 1 : 0) - (Rb() < 0.2 ? 1 : 0))), roof = HOUSE_ROOF[Math.floor(Rb() * HOUSE_ROOF.length)], eave = stc * STOREY + (groundAt((p[0] + p[2]) / 2, (p[1] + p[3]) / 2) - z0);
          const wall = HOUSE_BRICK[Math.floor(Rb() * HOUSE_BRICK.length)];
          B(p, z0, eave, wall, roof, SKINS.house, STOREY);
          // the gable to the street: its ridge into the block
          gables.push([r2((p[0] + p[2]) / 2), r2((p[1] + p[3]) / 2), r2(z0 + eave), r2(p[2] - p[0]), r2(p[3] - p[1]), r2(Math.min(4.5, 0.32 * f)), longY ? 0 : 1, roof, wall]);
          counts.houses += 2;
          // a tree or two in its back garden
          if (Rb() < 0.55) { const t = at(s, u + f * (0.2 + 0.6 * Rb()), SETBACK + dpt + 4 + Rb() * Math.max(1, deep / 2 - SETBACK - dpt - 6)); dots.push([r2(t[0]), r2(t[1]), r2(2.5 + Rb() * 2.5)]); }
        }
      };
      const shops = (s, storeys) => {
        const n = Math.max(1, Math.round(L / 30)), f = L / n;
        for (let k = 0; k < n; k++) { const p = rectOf(s, k * f + 0.4, (k + 1) * f - 0.4, 0, Math.min(SHOP_D, deep / 2 - 2)), z0 = zOf(p), stc = storeys + (Rb() < 0.3 ? 1 : 0); B(p, z0, stc * STOREY + 0.6 + (groundAt((p[0] + p[2]) / 2, (p[1] + p[3]) / 2) - z0), SHOP_FRONT[Math.floor(Rb() * SHOP_FRONT.length)], HOUSE_ROOF[2], SKINS.residential, STOREY); }
      };
      const onLong = (rank) => sides.find((s) => (rank === 'arterial' ? b.sides[s]?.kind === 'arterial' : b.sides[s]?.rank === rank));
      if (b.kind === 'edge' || b.kind === 'main-street') { const s = onLong(b.kind === 'edge' ? 'arterial' : 'collector') ?? sides[0]; shops(s, b.kind === 'edge' ? 2 : 3); houses(sides.find((x) => x !== s), 2, L - 2); }
      else if (b.kind === 'lowrise') {
        const n = Math.max(1, Math.floor(L / 40));
        for (let k = 0; k < n; k++) { const u = (k + 0.5) * (L / n), p = rectOf(sides[0], u - 14, u + 14, deep / 2 - 7.5, deep / 2 + 7.5), z0 = zOf(p); B(p, z0, 4 * STOREY + 0.3, fam(G.skin.brick, `${b.id}:${k}`)[0], HOUSE_ROOF[2], SKINS.residential, STOREY); }
      } else if (b.kind === 'apartments') {
        const p = rectOf(sides[0], 4, 34, 6, 20), z0 = zOf(p); B(p, z0, 4 * STOREY + 0.3, fam(G.skin.brick, b.id)[0], HOUSE_ROOF[2], SKINS.residential, STOREY);
        houses(sides[0], 40, L - 2); houses(sides[1], 2, L - 2);
      } else { houses(sides[0], 2, L - 2); houses(sides[1], 2, L - 2); }
    }
  }
  // the roads on the ground, under the settlements' own plans (painted first)
  for (const r of country.roads) ribbons.push([r.rank, r.w, r.pts.flat()]);
  // the power line: its pylons on the ground, the wires span to span (each conductor's point, geocity/industry.js PYLON's
  // shape at COUNTRY.pylon's height)
  const pylons = [], wires = [];
  for (const line of country.power) {
    const P = line.pylons.map(([x, y]) => [x, y, r2(groundAt(x, y))]);
    P.forEach((p, k) => { const q = P[Math.min(P.length - 1, k + 1)], r = P[Math.max(0, k - 1)], yaw = Math.atan2(q[1] - r[1], q[0] - r[0]); pylons.push([p[0], p[1], p[2], r2(yaw)]); });
    for (let k = 0; k + 1 < P.length; k++) wires.push([...P[k], ...P[k + 1]]);
  }
  // the landmarks: a water tower (its legs a pier, its tank a round), a mast (a thin box, its tip lit)
  const masts = [];
  for (const l of country.landmarks) {
    const [x, y] = l.at, z = groundAt(x, y), T = COUNTRY.waterTower;
    if (l.kind === 'water-tower') { rounds.push([x, y, r2(z), 1.6, T.legs, '#b8b4aa', 0]); rounds.push([x, y, r2(z + T.legs), T.r, T.h, '#d9d6cc', 3]); }
    else if (l.kind === 'mast') masts.push([x, y, r2(z), COUNTRY.mast]);
  }
  counts.rounds = rounds.length;
  // (tall things beside the settlements join the roof grid: a mast is something a craft can hit)
  const extra = masts.map(([x, y, z, h]) => [x, y, z, 3, 3, h]).concat(country.landmarks.filter((l) => l.kind === 'water-tower').map((l) => [l.at[0], l.at[1], groundAt(...l.at), 2 * COUNTRY.waterTower.r, 2 * COUNTRY.waterTower.r, COUNTRY.waterTower.legs + COUNTRY.waterTower.h]));
  if (extra.length) for (const e of extra) roofs.push(roofGrid([e[0] - e[3], e[1] - e[4], e[0] + e[3], e[1] + e[4]], [[e[0], e[1], e[2], e[3], e[4], e[5]]]));
  return { boxes, gables, rounds, decks, piers, pylons, wires, masts, plan: { rects, ribbons, dots, colours: col }, roofs, report: counts };
}

/** A roof grid over a rect (city.js's shape before packing: { x0, y0, nx, ny, top }), each cell its tallest box's top.
 *  `boxes` [cx, cy, z0, w, d, h, …]. */
const ROOF_CELL = 10;
function roofGrid(rect, boxes) {
  const nx = Math.max(1, Math.ceil((rect[2] - rect[0]) / ROOF_CELL)), ny = Math.max(1, Math.ceil((rect[3] - rect[1]) / ROOF_CELL)), top = new Float32Array(nx * ny).fill(-Infinity);
  for (const [cx, cy, z0, w, d, h] of boxes) {
    const z = z0 + h, i0 = Math.max(0, Math.floor((cx - w / 2 - rect[0]) / ROOF_CELL)), i1 = Math.min(nx - 1, Math.floor((cx + w / 2 - rect[0]) / ROOF_CELL));
    const j0 = Math.max(0, Math.floor((cy - d / 2 - rect[1]) / ROOF_CELL)), j1 = Math.min(ny - 1, Math.floor((cy + d / 2 - rect[1]) / ROOF_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (z > top[j * nx + i]) top[j * nx + i] = z;
  }
  return { x0: rect[0], y0: rect[1], nx, ny, top };
}
export { ROOF_CELL };

/** The seated country as faces, for everything that is not the live page (GLB, the engines, stills): each box its four
 *  walls and its roof, each gable its two slopes and its two ends, painted its own colours under the ground's light
 *  (`light`: { dir, ambient, gain }, the kernel's). Grouped 'country'. The rounds and the lines stay the page's. */
export function countryFaces(aerial, light) {
  const L = light.dir, n = Math.hypot(L[0], L[1], L[2]), l = L.map((v) => v / n), flat = light.ambient + light.gain * Math.max(0, l[2]);
  const shade = (hex, nv) => { const k = (light.ambient + light.gain * Math.max(0, nv[0] * l[0] + nv[1] * l[1] + nv[2] * l[2])) / flat; return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join(''); };
  const out = [], q = (corners, fill, normal) => out.push({ corners: corners.map((c) => c.map(r2)), fill: shade(fill, normal), group: 'country' });
  for (const [cx, cy, z0, w, d, h, wall, roof] of aerial.boxes) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = z0 + h;
    q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], wall, [0, -1, 0]);
    q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], wall, [1, 0, 0]);
    q([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], wall, [0, 1, 0]);
    q([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], wall, [-1, 0, 0]);
    q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], roof, [0, 0, 1]);
  }
  for (const [cx, cy, z0, w, d, h, axis, roof, wall] of aerial.gables) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = z0 + h;
    if (axis === 0) {   // the ridge along x
      const s = Math.hypot(d / 2, h);
      q([[x0, y0, z0], [x1, y0, z0], [x1, cy, z1], [x0, cy, z1]], roof, [0, -h / s, (d / 2) / s]);
      q([[x1, y1, z0], [x0, y1, z0], [x0, cy, z1], [x1, cy, z1]], roof, [0, h / s, (d / 2) / s]);
      q([[x0, y1, z0], [x0, y0, z0], [x0, cy, z1]], wall ?? roof, [-1, 0, 0]); q([[x1, y0, z0], [x1, y1, z0], [x1, cy, z1]], wall ?? roof, [1, 0, 0]);
    } else {
      const s = Math.hypot(w / 2, h);
      q([[x0, y1, z0], [x0, y0, z0], [cx, y0, z1], [cx, y1, z1]], roof, [-h / s, 0, (w / 2) / s]);
      q([[x1, y0, z0], [x1, y1, z0], [cx, y1, z1], [cx, y0, z1]], roof, [h / s, 0, (w / 2) / s]);
      q([[x0, y0, z0], [x1, y0, z0], [cx, y0, z1]], wall ?? roof, [0, -1, 0]); q([[x1, y1, z0], [x0, y1, z0], [cx, y1, z1]], wall ?? roof, [0, 1, 0]);
    }
  }
  return out;
}
