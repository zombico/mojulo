/**
 * THE GEOTOWN, DESIGNED — a neighbourhood's map, laid before anything is drawn, layer by layer, pure. Each layer reads
 * only the layers before it and rolls only its own dice (city/plan/dice.js `streamOf`, a stream per layer and key): a
 * segment's rows roll their own, so a change to one block never rerolls another. The labour is a block at a time.
 *
 *   1 segments  each cell of the layout a BLOCK SEGMENT (pattern.js SEGMENTS): houses back to back, shops on a main
 *               street with houses behind, a walk-up among houses, a park; its rows facing the streets its kind and
 *               the main streets turn it to (a main-street segment's shops face its main street)
 *   2 needs     each row cut by a count of its buildings (an evocation: read.js EVOKES) into the frontage it needs, and
 *               the depth its plots need; the town to scale (`metro`) a grid of houses blocks of the pattern's lengths
 *   3 frame     each column as wide and each row of cells as long as its segments need, the streets between them in
 *               their ranks' sections (a main street wider, its walk paved to the kerb): x east, y north, z up, metres,
 *               the south-west corner the origin
 *   4 streets   the right-of-way round every block: each street between its crossings in its section (road, the kerb,
 *               a verge or a main street's furnishing strip, the walk), each crossing a road cross, a walk at each corner
 *   5 plots     each segment TUNED to its cell: a row its cell stretches past the pattern's `evoke.stretch` recut by
 *               count, then its frontage spread to fill it exactly, its rows' depths shared out across it (a back yard
 *               takes the slack); semis in pairs about their party wall, a corner plot wider for its flank
 *   6 budget    each plot's surface allocated by its row's kind: front yard (the setback its face holds), path, the
 *               building's envelope, side yards, the back yard (a house's) or the service yard (a shop's, a walk-up's
 *               lot); every square metre of the frame is one surface, and the LEDGER sums them per block and for the town
 *   7 levels    the land (the cube's hills, its natural ground N) smoothed into the streets' ground S (the streets keep
 *               the land's grade); each building a level PAD over the walk at its front, in risers, a semi pair one pad
 *   8 parking   a front pad where a front yard is deep and near level, a lane along the kerb on the sides its
 *               streetscape parks, its stalls clear of the crossings and of every drive across it
 *   9 traffic   streetlights at their stride along the walks; each crossing's control (signals, stops) by its streets'
 *               ranks, at the streetscape's intervals
 *
 *   designGeotown(spec, { seed, field? }) → { spec, seed, pattern, row, sections, frame, depth, X, Y, streets, pieces,
 *     blocks, plots, surfaces, ledger, ports, land, parking, sites, beside, traffic, evoked?, laws }   (`field`: (x, y) → metres, in place of the hills)
 *   geotownLand(hills, frame, seed, field?) → { N, S, range }: the natural ground and the streets' ground, (x, y) → m
 *
 * Every surface is an axis-aligned rect [x0, y0, x1, y1]; a plot's own frame is its front corner `A`, `ex` along its
 * frontage and `ey` into it (ex × ey up), so a building is spoken in it as the town speaks one
 * (era/out-anchor-structure.js). `ports` are the town's perimeter streets, the ends a geocity's graph joins.
 */
import { readGeotown, blockId } from './read.js';
import { sectionOf, SURFACE_IDS, SEGMENTS } from './pattern.js';
import { streamOf } from '../city/plan/dice.js';
import { terrainField } from '../terrain/terrain-field.js';
import { geotownLaws, plotShares } from './laws.js';
import { sitePlan, siteShares } from './sites.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const roll = (R, [lo, hi]) => r3(lo + (hi - lo) * R());
const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
// a dwelling's least width (era/out-structures.js STRUCTURE_USES.dwelling.lot.w), a hair over it
const HOUSE_LEAST = 5.55;
// a site composed among its neighbours asks this much of its least rails; its surfaces grouped by what the ground is for
const SITE_YIELD = 0.75;
const SITE_GROUPS = Object.freeze({ building: ['house'], lot: ['front', 'path', 'side'], play: ['field', 'track', 'infield', 'court', 'play'], green: ['grounds', 'park'], paved: ['service', 'park-path'] });
const rectOf = (p, q) => [r3(Math.min(p[0], q[0])), r3(Math.min(p[1], q[1])), r3(Math.max(p[0], q[0])), r3(Math.max(p[1], q[1]))];

// ── the land ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// the streets' ground: the natural ground on a grid this fine, blurred this far (m), so a street keeps the land's grade
// and not its every hummock
const S_CELL = 4, S_BLUR = 24;
const MEMO = new Map();
function hillsField(H, seed) {
  const key = JSON.stringify([H.from, H.span, seed]);
  let f = MEMO.get(key);
  if (!f) { f = terrainField({ from: H.from, span: H.span, detail: false, seed: H.from.seed ?? seed }); MEMO.set(key, f); if (MEMO.size > 6) MEMO.delete(MEMO.keys().next().value); }
  return f;
}

/** The natural ground (`N`) and the streets' ground (`S`) over the frame and its margin, (x, y) → metres. */
export function geotownLand(hills, frame, seed = 1, field = null) {
  const { W, D, margin: M } = frame, x0 = -M, y0 = -M, nx = Math.ceil((W + 2 * M) / S_CELL) + 1, ny = Math.ceil((D + 2 * M) / S_CELL) + 1;
  let N;
  if (field) N = field;
  else if (!hills) N = () => 0;
  else {
    // the painting's centre under the town's; its heights scaled so the frame and its margin span `height`
    const f = hillsField(hills, seed), b = f.bounds, cx = (b.x[0] + b.x[1]) / 2, cy = (b.y[0] + b.y[1]) / 2;
    const raw = (x, y) => f.heightAt(cx + x - W / 2, cy + y - D / 2);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < ny; j += 2) for (let i = 0; i < nx; i += 2) { const z = raw(x0 + i * S_CELL, y0 + j * S_CELL); if (z < lo) lo = z; if (z > hi) hi = z; }
    const k = hi > lo ? hills.height / (hi - lo) : 0;
    N = (x, y) => (raw(x, y) - lo) * k;
  }
  // S: N on the grid, box-blurred twice each way (near a gaussian of S_BLUR), clamped at the edges, read bilinearly
  let g = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = N(x0 + i * S_CELL, y0 + j * S_CELL);
  const rad = Math.max(1, Math.round(S_BLUR / S_CELL / 2));
  const blur = (src, along) => {
    const out = new Float64Array(src.length), n = along ? nx : ny, m = along ? ny : nx;
    for (let b = 0; b < m; b++) for (let a = 0; a < n; a++) {
      let s = 0;
      for (let t = -rad; t <= rad; t++) { const c = Math.max(0, Math.min(n - 1, a + t)); s += src[along ? b * nx + c : c * nx + b]; }
      out[along ? b * nx + a : a * nx + b] = s / (2 * rad + 1);
    }
    return out;
  };
  for (let p = 0; p < 2; p++) g = blur(blur(g, true), false);
  const S = (x, y) => {
    const fx = Math.max(0, Math.min(nx - 1 - 1e-9, (x - x0) / S_CELL)), fy = Math.max(0, Math.min(ny - 1 - 1e-9, (y - y0) / S_CELL));
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, at = (a, b) => g[b * nx + a];
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
  let lo = Infinity, hi = -Infinity;
  for (const z of g) { if (z < lo) lo = z; if (z > hi) hi = z; }
  return { N, S, range: [r3(lo), r3(hi)] };
}

// ── the streets ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The right-of-way's pieces, each street in its own section (`SX[k]`, `SY[j]`): each between its crossings, each
 *  crossing's road cross and walked corners. → [{ cls, rect, street?, crossing?, side?, kerbs? }] (`kerbs`: the sides of
 *  a road piece a kerb stands on). `gone` the pieces a wide block swallows ('ns-k:j', 'ew-j:k'): a crossing at its edge
 *  walks across the swallowed arm (its kerb along the road), one inside it is the block's. */
function streetPieces(X, Y, SX, SY, gone = new Set()) {
  const out = [];
  const ns = (k, ya, yb, seg) => {
    const x = X[k], id = `ns-${k}`, { R, verge: V, half, edge } = SX[k];
    out.push({ cls: 'road', rect: [r3(x - R), ya, r3(x + R), yb], street: id, seg, kerbs: ['-x', '+x'] });
    if (V > 0) out.push({ cls: edge, rect: [r3(x - R - V), ya, r3(x - R), yb], street: id, seg, side: 'w' }, { cls: edge, rect: [r3(x + R), ya, r3(x + R + V), yb], street: id, seg, side: 'e' });
    out.push({ cls: 'walk', rect: [r3(x - half), ya, r3(x - R - V), yb], street: id, seg, side: 'w' }, { cls: 'walk', rect: [r3(x + R + V), ya, r3(x + half), yb], street: id, seg, side: 'e' });
  };
  const ew = (j, xa, xb, seg) => {
    const y = Y[j], id = `ew-${j}`, { R, verge: V, half, edge } = SY[j];
    out.push({ cls: 'road', rect: [xa, r3(y - R), xb, r3(y + R)], street: id, seg, kerbs: ['-y', '+y'] });
    if (V > 0) out.push({ cls: edge, rect: [xa, r3(y - R - V), xb, r3(y - R)], street: id, seg, side: 's' }, { cls: edge, rect: [xa, r3(y + R), xb, r3(y + R + V)], street: id, seg, side: 'n' });
    out.push({ cls: 'walk', rect: [xa, r3(y - half), xb, r3(y - R - V)], street: id, seg, side: 's' }, { cls: 'walk', rect: [xa, r3(y + R + V), xb, r3(y + half)], street: id, seg, side: 'n' });
  };
  for (let k = 0; k < X.length; k++) for (let j = 0; j + 1 < Y.length; j++) if (!gone.has(`ns-${k}:${j}`)) ns(k, r3(Y[j] + SY[j].half), r3(Y[j + 1] - SY[j + 1].half), j);
  for (let j = 0; j < Y.length; j++) for (let k = 0; k + 1 < X.length; k++) if (!gone.has(`ew-${j}:${k}`)) ew(j, r3(X[k] + SX[k].half), r3(X[k + 1] - SX[k + 1].half), k);
  for (let k = 0; k < X.length; k++) for (let j = 0; j < Y.length; j++) {
    const x = X[k], y = Y[j], c = `${k}:${j}`, Rx = SX[k].R, hx = SX[k].half, Ry = SY[j].R, hy = SY[j].half;
    const N = gone.has(`ns-${k}:${j}`), S = gone.has(`ns-${k}:${j - 1}`), E = gone.has(`ew-${j}:${k}`), Wt = gone.has(`ew-${j}:${k - 1}`);
    if (N && S && E && Wt) continue;
    const arm = (g, r, kerbs) => out.push(g ? { cls: 'walk', rect: r, crossing: c } : { cls: 'road', rect: r, crossing: c, kerbs });
    out.push({ cls: 'road', rect: [r3(x - Rx), r3(y - Ry), r3(x + Rx), r3(y + Ry)], crossing: c, ...(N || S || E || Wt ? { kerbs: [N && '+y', S && '-y', E && '+x', Wt && '-x'].filter(Boolean) } : {}) });
    arm(N, [r3(x - Rx), r3(y + Ry), r3(x + Rx), r3(y + hy)], ['-x', '+x']); arm(S, [r3(x - Rx), r3(y - hy), r3(x + Rx), r3(y - Ry)], ['-x', '+x']);
    arm(E, [r3(x + Rx), r3(y - Ry), r3(x + hx), r3(y + Ry)], ['-y', '+y']); arm(Wt, [r3(x - hx), r3(y - Ry), r3(x - Rx), r3(y + Ry)], ['-y', '+y']);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) out.push({ cls: 'walk', rect: rectOf([x + sx * Rx, y + sy * Ry], [x + sx * hx, y + sy * hy]), crossing: c, corner: true });
  }
  return out;
}

// ── the rows ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// a row's frame by the side of its block it fronts: `ey` into its plots, `ex` along its frontage (ex × ey up), and the
// corner of the block its frontage starts from
const FRAMES = Object.freeze({ w: { ey: [1, 0], ex: [0, -1] }, e: { ey: [-1, 0], ex: [0, 1] }, s: { ey: [0, 1], ex: [1, 0] }, n: { ey: [0, -1], ex: [-1, 0] } });
const startOf = (side, [x0, y0, x1, y1]) => ({ w: [x0, y1], e: [x1, y0], s: [x0, y0], n: [x1, y1] })[side];

/** A segment's rows: which way it runs and each row's side and kind; a main-street segment's shops face its main street
 *  (`main`: which of its four sides front one), the south's first; with none they face south; an edge's avenue its major
 *  street (`main` then its major sides). */
export function rowsOf(type, main = {}) {
  const S = SEGMENTS[type];
  if (!S.rows.length) return { axis: 'y', rows: [] };
  // (a main-street's shops face its main street; an edge's avenue its major street: `main` then its major sides)
  if (S.main || S.major) {
    const front = S.rows[0];
    if (main.s || main.n || !(main.w || main.e)) { const a = main.s || !main.n ? 's' : 'n', b = a === 's' ? 'n' : 's'; return { axis: 'x', rows: [{ side: a, kind: front }, { side: b, kind: main[b] ? front : 'houses' }] }; }
    const a = main.w ? 'w' : 'e', b = a === 'w' ? 'e' : 'w';
    return { axis: 'y', rows: [{ side: a, kind: front }, { side: b, kind: main[b] ? front : 'houses' }] };
  }
  const sides = S.axis === 'y' ? ['w', 'e'] : ['s', 'n'];
  return { axis: S.axis, rows: S.rows.map((kind, k) => ({ side: sides[k], kind })) };
}

/** A row's frontage cut into houses: semis in pairs and detached houses by the pattern's mix, the leftover spread over
 *  them so they fill it, a corner plot wider at each end. → [{ form, w, pair? }] in walking order along the row. */
function cutRow(P, L, R) {
  const C = P.plot.corner, want = L - 2 * C, semiP = P.mix.semi / (P.mix.semi + P.mix.detached), out = [];
  let used = 0, pair = 0;
  for (let guard = 0; guard < 400; guard++) {
    const first = R() < semiP ? 'semi' : 'detached';
    let placed = false;
    for (const form of first === 'semi' ? ['semi', 'detached'] : ['detached', 'semi']) {
      if (P.mix[form] <= 0) continue;
      const w = roll(R, P.plot[form]), need = form === 'semi' ? 2 * w : w;
      if (used + need > want + 1e-9) continue;
      if (form === 'semi') { out.push({ form, w, pair: pair, half: 'L' }, { form, w, pair: pair, half: 'R' }); pair++; } else out.push({ form, w });
      used += need; placed = true; break;
    }
    if (!placed) break;
  }
  if (!out.length) return [{ form: 'detached', w: r3(L) }];
  return fitRow(out, L, C);
}

/** An EVOKED row of houses: `n` of them, as the pattern's mix would have them (a semi pair and a detached house at
 *  least, where the mix has both and the row holds three), in an order the dice choose; their own frontages, uncut by a
 *  block's length (the block is as long as its rows make it). → [{ form, w, pair?, half? }] */
function cutCount(P, n0, R, mansions = 0) {
  // (a mansion is one of the row's houses; the rest by the mix, which is of buildings: a semi pair is one building and
  // two houses)
  const big = Math.min(mansions, n0), n = n0 - big;
  const m = P.mix.semi / (P.mix.semi + P.mix.detached), semiHouses = (2 * m) / (2 * m + (1 - m));
  let pairs = P.mix.detached <= 0 ? Math.floor(n / 2) : P.mix.semi <= 0 ? 0 : Math.round((n * semiHouses) / 2);
  if (P.mix.semi > 0 && P.mix.detached > 0 && n >= 3) pairs = Math.max(1, Math.min(pairs, Math.floor((n - 1) / 2)));
  const forms = [...Array(pairs).fill('semi'), ...Array(n - 2 * pairs).fill('detached'), ...Array(big).fill('mansion')];
  for (let i = forms.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [forms[i], forms[j]] = [forms[j], forms[i]]; }
  const out = [];
  let pair = 0;
  for (const form of forms) {
    const w = roll(R, P.plot[form]);
    if (form === 'semi') { out.push({ form, w, pair, half: 'L' }, { form, w, pair, half: 'R' }); pair++; } else out.push({ form, w });
  }
  return out;
}

/** A row of `n` shops or walk-ups, each its own frontage. */
const cutPlain = (K, kind, n, R) => {
  if (!K.types) return Array.from({ length: n }, () => ({ form: kind, w: roll(R, K.frontage) }));
  // (a typed row, an edge's avenue: each building a type by its weight, never its neighbour's, at its type's frontage)
  const out = [];
  let prev = null;
  for (let k = 0; k < n; k++) {
    const ids = Object.keys(K.types).filter((id) => id !== prev), sum = ids.reduce((a, id) => a + (K.types[id].weight ?? 1), 0);
    let t = R() * sum, type = ids[ids.length - 1];
    for (const id of ids) { t -= K.types[id].weight ?? 1; if (t <= 0) { type = id; break; } }
    out.push({ form: kind, type, w: roll(R, K.types[type].frontage ?? K.frontage) }); prev = type;
  }
  return out;
};

/** A row's buildings spread so they fill `L` exactly, a corner's frontage added at each end. */
function fitRow(out, L, C) {
  const want = L - 2 * C, used = out.reduce((a, p) => a + p.w, 0), k = want / used;
  for (const p of out) p.w = r3(p.w * k);
  out[0].w = r3(out[0].w + C); out[out.length - 1].w = r3(out[out.length - 1].w + C);
  out[0].corner = 'start'; out[out.length - 1].corner = out.length > 1 ? 'end' : 'both';
  // close the rounding on the last plot
  const sum = out.reduce((a, p) => a + p.w, 0);
  out[out.length - 1].w = r3(out[out.length - 1].w + (L - sum));
  return out;
}

/** A row kind's numbers: a houses row's are the pattern's own, a shop's or a walk-up's its `rows` entry. */
function kindOf(P, kind, depth) {
  if (kind === 'houses') return { kind, use: 'dwelling', corner: P.plot.corner, depth: [depth, depth], setback: P.setback, rear: 'back', pad: P.pad, count: P.evoke.houses };
  const K = P.rows[kind];
  return { ...K, kind, rear: K.rear ?? 'service', pad: { ...P.pad, ...K.pad }, count: P.evoke[kind] ?? [1, 1] };
}

/** A row's cut: by count (an evocation, `big` of its houses mansions) or filling its length (the town to scale). */
function cutOf(P, K, n, R, L = null, big = 0) {
  if (L !== null) return cutRow(P, L, R);
  return K.kind === 'houses' ? cutCount(P, n, R, big) : cutPlain(K, K.kind, n, R);
}

/** The way between a segment's rows' backs: an edge's lane, a main street's alley behind its shops, else none. */
const laneOf = (P, type) => (SEGMENTS[type].lane === 'alley' ? P.alley?.w ?? 0 : SEGMENTS[type].lane ? P.lane?.w ?? 0 : 0);

/** A school's lot (sites.js `plan.plot`) as a plot's measures: its frontage and depth, its setback, its building's
 *  envelope and side yards, its path, its allocation (its rear its schoolyard, a court). */
function schoolLot(T) {
  const [sL, sR] = T.sides, env = [sL, T.setback, r3(T.w - sR), r3(T.setback + T.depth)], pw = T.path;
  return { w: T.w, d: T.d, setback: T.setback, house: { depth: T.depth, sides: [sL, sR], env }, path: { u: r3(T.w / 2), w: pw },
    alloc: { front: r3(T.w * T.setback - pw * T.setback), path: r3(pw * T.setback), house: r3((env[2] - env[0]) * T.depth), side: r3((sL + sR) * T.depth), back: 0, service: 0, drive: 0, court: r3(T.w * (T.d - env[3])) } };
}

/** A plot's local (u along its frontage, v into it) rect → world. */
const toWorld = (pl, [u0, v0, u1, v1]) => {
  const at = (u, v) => [pl.A[0] + pl.ex[0] * u + pl.ey[0] * v, pl.A[1] + pl.ex[1] * u + pl.ey[1] * v];
  return rectOf(at(u0, v0), at(u1, v1));
};
export { toWorld as plotRect };

/** The design of a geotown: its map, its budget and its levels. */
export function designGeotown(spec = {}, { seed = 1, field = null } = {}) {
  const T = readGeotown(spec), P = T.pattern, [C, Rn] = T.grid, evoked = T.evoke !== 'metro', ST = P.evoke.stretch;
  // ── 1 segments: each cell's kind, its rows turned to its main streets ──
  const rank = (id) => (T.mains.includes(id) ? 'main' : T.majors.includes(id) ? 'major' : 'street');
  const SX = Array.from({ length: C + 1 }, (_, k) => sectionOf(P, rank(`ns-${k}`))), SY = Array.from({ length: Rn + 1 }, (_, j) => sectionOf(P, rank(`ew-${j}`)));
  const depth = roll(streamOf(seed, 'frame', 'depth'), P.block.depth);
  const cells = [];
  for (let j = 0; j < Rn; j++) for (let i = 0; i < C; i++) {
    const rk = SEGMENTS[T.cells[j][i]].major ? 'major' : 'main', id = blockId(i, j), type = T.cells[j][i], main = { w: SX[i].rank === rk, e: SX[i + 1].rank === rk, s: SY[j].rank === rk, n: SY[j + 1].rank === rk };
    cells.push({ id, i, j, type, built: T.blocks[id]?.built ?? true, ...rowsOf(type, main) });
  }
  // wide segments side by side (a park, a school, a sports field) are ONE block, no street between them: each rectangle
  // of one wide type, grown east then north from its south-west cell; its front a side on a main street, else across its
  // run (a run east to west fronts south, one north to south west)
  const cellAt = new Map(cells.map((c) => [`${c.i}:${c.j}`, c])), unitOf = new Map(), gone = new Set();
  for (const c of cells) {
    if (unitOf.has(c.id) || !SEGMENTS[c.type].wide) continue;
    const free = (i, j) => { const q = cellAt.get(`${i}:${j}`); return !!q && q.type === c.type && !unitOf.has(q.id); };
    let i1 = c.i, j1 = c.j;
    while (free(i1 + 1, c.j)) i1++;
    while (Array.from({ length: i1 - c.i + 1 }, (_, k) => c.i + k).every((i) => free(i, j1 + 1))) j1++;
    const g = { i0: c.i, j0: c.j, i1, j1, cells: [] };
    for (let j = c.j; j <= j1; j++) for (let i = c.i; i <= i1; i++) { const q = cellAt.get(`${i}:${j}`); unitOf.set(q.id, g); g.cells.push(q); }
    for (let k = c.i + 1; k <= i1; k++) for (let j = c.j; j <= j1; j++) gone.add(`ns-${k}:${j}`);
    for (let k = c.j + 1; k <= j1; k++) for (let i = c.i; i <= i1; i++) gone.add(`ew-${k}:${i}`);
  }
  const units = [];
  for (const c of cells) {
    const g = unitOf.get(c.id);
    if (!g) { units.push({ ...c, i0: c.i, j0: c.j, i1: c.i, j1: c.j, cells: [c] }); continue; }
    if (g.cells[0] !== c) continue;
    const main = { s: SY[g.j0].rank === 'main', n: SY[g.j1 + 1].rank === 'main', w: SX[g.i0].rank === 'main', e: SX[g.i1 + 1].rank === 'main' };
    // (the town to scale's site fronts its block's long side, its shape known when it is laid)
    units.push({ id: c.id, i: g.i0, j: g.j0, ...g, type: c.type, built: c.built, axis: 'y', rows: [], front: ['s', 'n', 'w', 'e'].find((k) => main[k]) ?? (!evoked ? null : g.j1 - g.j0 > g.i1 - g.i0 ? 'w' : 's') });
  }
  // ── 2 needs: each row cut by its count (an evocation), its length and its depth; a row of houses holds one count a
  // row of cells, so a block's two rows of houses close on one length ──
  const lengths = evoked ? null : Array.from({ length: Rn }, (_, j) => roll(streamOf(seed, 'frame', `row:${j}`), P.block.long));
  // an evoked segment's MANSIONS: none to two (`evoke.mansions`), each in one of its rows of houses, by its own dice;
  // none on a block that touches a main or a major street (a mansion stands back from the traffic, on a quiet street)
  if (evoked && P.mansion) for (const c of cells) {
    const homes = c.rows.filter((r) => r.kind === 'houses'), Rm = streamOf(seed, 'mansions', c.id), [lo, hi] = P.evoke.mansions ?? [0, 0];
    const busy = [SX[c.i], SX[c.i + 1], SY[c.j], SY[c.j + 1]].some((S) => S.rank !== 'street');
    const m = homes.length && !busy ? lo + Math.floor(Rm() * (hi - lo + 1)) : 0;
    for (const r of homes) r.big = 0;
    for (let k = 0; k < m; k++) homes[Math.floor(Rm() * homes.length)].big++;
  }
  for (const c of cells) for (const r of c.rows) {
    const K = kindOf(P, r.kind, depth), R = streamOf(seed, 'plots', `${c.id}:${r.side}`);
    r.K = K; r.R = R; r.F = roll(R, K.setback);
    r.need = { depth: r.kind === 'houses' ? depth : roll(R, K.depth) };
    if (evoked) {
      r.n = r.kind === 'houses' ? K.count[0] + Math.floor(streamOf(seed, 'frame', `count:${c.j}`)() * (K.count[1] - K.count[0] + 1)) : K.count[0] + Math.floor(R() * (K.count[1] - K.count[0] + 1));
      r.cut = cutOf(P, K, r.n, R, null, r.big ?? 0);
      r.need.len = r3(r.cut.reduce((a, p) => a + p.w, 0) + 2 * K.corner);
    } else r.need.len = lengths[c.j];
  }
  // a site's need, shared over the cells it spans less the streets it swallows: its rails, but along a column or a row
  // of cells its neighbours set (a neighbourhood's) it yields to them, asking only SITE_YIELD of its least (its plan
  // proportions to the cells it is given); the town to scale's takes the block it is laid on, as a park takes its cell
  for (const u of units) {
    const site = SEGMENTS[u.type].site, S = site ? P.sites?.[site] : null;
    if (!S?.site || !evoked) continue;
    const Rs = streamOf(seed, 'site', u.id), long = roll(Rs, S.site.long), deep = roll(Rs, S.site.deep), alongX = u.front === 's' || u.front === 'n';
    u.want = { long, deep };
    const cols = cells.some((c) => c.i >= u.i0 && c.i <= u.i1 && c.rows.length), rows = cells.some((c) => c.j >= u.j0 && c.j <= u.j1 && c.rows.length);
    const [lx, ly] = alongX ? [long, deep] : [deep, long], [qx, qy] = alongX ? [S.site.long[0], S.site.deep[0]] : [S.site.deep[0], S.site.long[0]];
    const wx = cols ? qx * SITE_YIELD : lx, wy = rows ? qy * SITE_YIELD : ly, ni = u.i1 - u.i0 + 1, nj = u.j1 - u.j0 + 1;
    const sx = Array.from({ length: ni - 1 }, (_, k) => SX[u.i0 + 1 + k].row).reduce((a, b) => a + b, 0), sy = Array.from({ length: nj - 1 }, (_, k) => SY[u.j0 + 1 + k].row).reduce((a, b) => a + b, 0);
    for (const c of u.cells) c.siteNeed = { x: r3(Math.max(0, (wx - sx) / ni)), y: r3(Math.max(0, (wy - sy) / nj)) };
  }
  const need = (c) => {
    if (c.siteNeed) return c.siteNeed;
    if (!c.rows.length) return { x: 0, y: 0 };
    const len = Math.max(...c.rows.map((r) => r.need.len)), dep = c.rows.reduce((a, r) => a + r.need.depth, 0) + laneOf(P, c.type);
    return c.axis === 'y' ? { x: dep, y: len } : { x: len, y: dep };
  };
  // ── 3 frame: each column as wide, each row of cells as long, as its segments need (a park takes what it is given) ──
  const colW = Array.from({ length: C }, (_, i) => r3(Math.max(0, ...cells.filter((c) => c.i === i).map((c) => need(c).x)) || 2 * depth));
  const rowH = Array.from({ length: Rn }, (_, j) => r3(Math.max(0, ...cells.filter((c) => c.j === j).map((c) => need(c).y)) || Math.max(40, P.block.long[0] / 3)));
  const X = [r3(SX[0].half)], Y = [r3(SY[0].half)];
  for (let k = 0; k < C; k++) X.push(r3(X[k] + SX[k].half + colW[k] + SX[k + 1].half));
  for (let j = 0; j < Rn; j++) Y.push(r3(Y[j] + SY[j].half + rowH[j] + SY[j + 1].half));
  const frame = { W: r3(X[C] + SX[C].half), D: r3(Y[Rn] + SY[Rn].half), margin: T.margin };
  // ── 4 streets ──
  const streets = [...X.map((x, k) => ({ id: `ns-${k}`, axis: 'y', at: x, from: 0, to: frame.D, rank: SX[k].rank })), ...Y.map((y, j) => ({ id: `ew-${j}`, axis: 'x', at: y, from: 0, to: frame.W, rank: SY[j].rank }))];
  const pieces = streetPieces(X, Y, SX, SY, gone);
  // ── 7 the land (read before the plots: a pad is levelled over its walk); an evocation's is a window of the town to
  // scale's, its middle over that town's middle, so its slopes are the town's and not its hills squeezed into a block ──
  const ref = evoked ? designGeotown({ evoke: 'metro', ...Object.fromEntries(['pattern', 'streetscape', 'hills'].filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]])) }, { seed, field }) : null;
  const win = ref && !field ? ((ox, oy) => (x, y) => ref.land.N(x + ox, y + oy))((ref.frame.W - frame.W) / 2, (ref.frame.D - frame.D) / 2) : field;
  const land = geotownLand(T.hills, frame, seed, win), walkZ = (x, y) => land.S(x, y) + SX[0].kerb;
  // ── 5, 6 the plots, each segment tuned to its cell, and their budget ──
  const blocks = [], plots = [], fits = [], sites = [], surfaces = pieces.map((p) => ({ cls: p.cls, rect: p.rect, ...(p.street ? { street: p.street } : { crossing: p.crossing }) }));
  for (const c of units) {
    const rect = [r3(X[c.i0] + SX[c.i0].half), r3(Y[c.j0] + SY[c.j0].half), r3(X[c.i1 + 1] - SX[c.i1 + 1].half), r3(Y[c.j1 + 1] - SY[c.j1 + 1].half)], [x0, y0, x1, y1] = rect;
    const B = { id: c.id, i: c.i0, j: c.j0, i1: c.i1, j1: c.j1, ...(c.cells.length > 1 ? { cells: c.cells.map((q) => q.id) } : {}), rect, use: c.type, built: c.built, axis: c.axis, rows: [] };
    blocks.push(B);
    const site = SEGMENTS[c.type].site;
    if (site) {
      // a SITE (sites.js): its plan in its front street's frame, proportioned to its block; a school's lot a plot
      const S = P.sites[site], f = c.front ?? (x1 - x0 >= y1 - y0 ? 's' : 'w'), { ex, ey } = FRAMES[f], A0 = startOf(f, rect), alongX = f === 's' || f === 'n', fr = { A: A0, ex, ey };
      const L = r3(alongX ? x1 - x0 : y1 - y0), Dd = r3(alongX ? y1 - y0 : x1 - x0), Rp = () => streamOf(seed, 'site', `${B.id}:plan`);
      const plan = sitePlan(site, S, { L, D: Dd, R: Rp() });
      B.site = { type: site, front: f, A: A0, ex, ey, L, D: Dd, what: plan.what };
      for (const p of plan.parts) surfaces.push({ cls: p.cls, rect: toWorld(fr, p.rect), block: B.id, ...(p.what ? { what: p.what } : {}), ...(p.area !== undefined ? { area: p.area } : {}), ...(p.inside ? { inside: p.inside } : {}), ...(p.kind ? { kind: p.kind, use: p.kind } : {}) });
      if (site === 'park') B.paths = plan.parts.filter((p) => p.cls === 'park-path').map((p) => toWorld(fr, p.rect));
      let lot = {};
      if (plan.plot) {
        const pl = { id: `${B.id}-school`, block: B.id, side: f, k: 0, kind: 'school', use: P.rows.school.use, form: 'school', ...schoolLot(plan.plot), A: A0, ex, ey, rear: 'court', built: B.built };
        pl.rect = toWorld(pl, [0, 0, pl.w, pl.d]);
        plots.push(pl); lot = pl.alloc;
      }
      // (what it shows against the site to scale: its size against its rails, its surfaces' shares against theirs)
      if (S.site) {
        const want = c.want ?? { long: (S.site.long[0] + S.site.long[1]) / 2, deep: (S.site.deep[0] + S.site.deep[1]) / 2 }, ref = sitePlan(site, S, { L: want.long, D: want.deep, R: Rp() });
        // (by what the ground is for: a field with or without its track is the same playing ground)
        const group = (sh) => Object.fromEntries(Object.entries(SITE_GROUPS).map(([g, ks]) => [g, ks.reduce((a, k) => a + (sh[k] ?? 0), 0)]));
        const own = group(siteShares(plan, L, Dd, lot)), to = group(siteShares(ref, want.long, want.deep, ref.plot ? schoolLot(ref.plot).alloc : {}));
        const off = Math.max(...Object.keys(SITE_GROUPS).map((k) => Math.abs(own[k] - to[k])));
        sites.push({ block: B.id, type: site, long: L, deep: Dd, want: { long: r3(want.long), deep: r3(want.deep) }, stretch: r3(L / want.long), deepen: r3(Dd / want.deep), off: r3(off) });
      }
      continue;
    }
    // (an edge's lane between its rows: the rows share the rest)
    const laneW = laneOf(P, c.type), along = c.axis === 'y' ? y1 - y0 : x1 - x0, across = (c.axis === 'y' ? x1 - x0 : y1 - y0) - laneW, depSum = c.rows.reduce((a, r) => a + r.need.depth, 0);
    let used = 0;
    c.rows.forEach((r, ri) => {
      const K = r.K, dep = ri === c.rows.length - 1 ? r3(across - used) : r3((across * r.need.depth) / depSum);
      if (ri === 0 && laneW) { const fr0 = { A: startOf(r.side, rect), ...FRAMES[r.side] }; B.lane = toWorld(fr0, [0, dep, along, dep + laneW]); surfaces.push({ cls: 'lane', rect: B.lane, block: B.id }); }
      used = r3(used + dep);
      // tuned to its cell: a row the cell stretches past the rail recut by count, then spread to fill it
      let cut = r.cut;
      if (evoked) {
        const k = along / r.need.len;
        if (k < ST[0] || k > ST[1]) {
          const n = Math.max(r.kind === 'houses' ? 2 : 1, Math.round(r.n * k));
          cut = cutOf(P, K, n, streamOf(seed, 'plots', `${c.id}:${r.side}:n${n}`), null, r.big ?? 0);
          r.n = n;
        }
        // (how far its frontages spread to fill its cell, and how much deeper its plots run than they need; a row of houses
        // squeezed under a dwelling's least frontage takes a house fewer)
        let sum0 = cut.reduce((a, p) => a + p.w, 0) + 2 * K.corner, fitted = fitRow(cut.map((p) => ({ ...p })), along, K.corner);
        while (r.kind === 'houses' && r.n > 2 && fitted.some((p) => p.w < HOUSE_LEAST + 0.05)) {
          r.n -= 1;
          cut = cutOf(P, K, r.n, streamOf(seed, 'plots', `${c.id}:${r.side}:n${r.n}`), null, r.big ?? 0);
          sum0 = cut.reduce((a, p) => a + p.w, 0) + 2 * K.corner; fitted = fitRow(cut.map((p) => ({ ...p })), along, K.corner);
        }
        cut = fitted;
        fits.push({ block: c.id, side: r.side, kind: r.kind, n: cut.length, stretch: r3(along / sum0), deep: r3(dep / r.need.depth) });
      } else cut = cutOf(P, K, 0, r.R, along);
      B.rows.push({ side: r.side, kind: r.kind, setback: r.F, depth: dep, count: cut.length });
      const { ex, ey } = FRAMES[r.side], A0 = startOf(r.side, rect), R = r.R, F = r.F, pairs = new Map();
      let s = 0;
      cut.forEach((cc, k) => {
        const A = [r3(A0[0] + ex[0] * s), r3(A0[1] + ex[1] * s)], w = cc.w;
        let Hd, sL, sR, big = null;
        if (cc.form === 'mansion') {
          // a mansion: its house deeper behind a wider lawn, its drive down one side yard, the other narrower
          const M = P.mansion, left = R() < 0.5, extra = roll(R, M.setback);
          Hd = r3(Math.max(8, Math.min(roll(R, M.depth), dep - F - extra - P.back)));
          const sd = roll(R, M.side.drive), so = roll(R, M.side.other);
          sL = left ? sd : so; sR = left ? so : sd;
          big = { extra, left };
        } else if (r.kind === 'houses') {
          let H;
          if (cc.form === 'semi') { if (!pairs.has(cc.pair)) pairs.set(cc.pair, { depth: roll(R, P.house.depth), side: roll(R, P.house.side) }); H = pairs.get(cc.pair); }
          else H = { depth: roll(R, P.house.depth), side: roll(R, P.house.side), side2: roll(R, P.house.side) };
          Hd = r3(Math.max(4, Math.min(H.depth, dep - F - P.back)));
          // the side yards: none at a semi's party wall; a corner's flank wider by the corner's frontage
          sL = cc.form === 'semi' ? (cc.half === 'L' ? H.side : 0) : H.side; sR = cc.form === 'semi' ? (cc.half === 'R' ? H.side : 0) : H.side2;
        } else {
          // a shop or a walk-up: its building's depth, short of its row's (its service yard behind); its side yards; an
          // avenue's building set back past the walk by its type
          const extra = cc.type ? K.types[cc.type].setback ?? 0 : 0;
          // (a shop's building at least a shop's least depth, era/out-structures.js)
          Hd = r3(Math.max(K.use === 'shop' ? 12 : 6, Math.min(roll(R, K.building), dep - F - extra - 3)));
          sL = roll(R, K.side); sR = roll(R, K.side);
          if (extra) big = { extra, avenue: true };
        }
        // (never so wide the building is narrower than a dwelling's least: the side yards give way first)
        const spare = Math.max(0, w - (cc.corner === 'both' ? 2 : cc.corner ? 1 : 0) * K.corner - HOUSE_LEAST);
        if (sL + sR > spare) { const q = spare / (sL + sR); sL = r3(sL * q); sR = r3(sR * q); }
        // a corner's flank: a house's or a walk-up's a side yard wider by the corner's frontage; a shop builds to it
        const flank = r.kind === 'shops' ? 0 : K.corner;
        if (cc.corner === 'start' || cc.corner === 'both') sL = r3(sL + flank);
        if (cc.corner === 'end' || cc.corner === 'both') sR = r3(sR + flank);
        const F1 = r3(F + (big?.extra ?? 0)), env = [sL, F1, r3(w - sR), r3(F1 + Hd)], pw = F1 > 0 ? Math.min(P.path * (r.kind === 'apartments' || r.kind === 'lowrise' ? 1.6 : 1), Math.max(0.6, env[2] - env[0] - 0.4)) : 0;
        const pl = { id: `${B.id}-${r.side}${k + 1}`, block: B.id, side: r.side, k, kind: r.kind, use: K.use, form: cc.form, ...(cc.form === 'semi' ? { pair: `${B.id}-${r.side}p${cc.pair + 1}`, half: cc.half } : {}), ...(cc.corner ? { corner: cc.corner } : {}),
          ...(cc.type ? { type: cc.type, ...(K.types[cc.type].paved ? { paved: true } : {}) } : {}), ...(laneW ? { lane: true } : {}), A, ex, ey, w, d: dep, setback: F, rear: K.rear, house: { depth: Hd, sides: [sL, sR], env }, built: B.built };
        // the door's path: from the walk to the envelope's middle until a building says where its door is
        pl.path = { u: r3((env[0] + env[2]) / 2), w: r3(pw) };
        const rearA = r3(w * (dep - env[3]));
        pl.alloc = { front: r3(w * F1 - pw * F1), path: r3(pw * F1), house: r3((env[2] - env[0]) * Hd), side: r3((sL + sR) * Hd), back: K.rear === 'back' ? rearA : 0, service: K.rear === 'service' ? rearA : 0, drive: 0 };
        // a paved forecourt is a lot, not a lawn
        if (pl.paved) pl.alloc = { ...pl.alloc, front: 0, service: r3(pl.alloc.service + pl.alloc.front) };
        // a house backing onto a lane: a share keep a garage off it, at the back of its yard
        const LG = P.lane?.garage;
        if (laneW && r.kind === 'houses' && cc.form !== 'mansion' && dep - env[3] >= LG.d + 5 && w >= LG.w + 1 && R() < P.lane.garages) {
          const left = cc.form === 'semi' ? cc.half === 'L' : R() < 0.5, u0 = left ? 0.4 : r3(w - 0.4 - LG.w), g = [u0, r3(dep - 0.3 - LG.d), r3(u0 + LG.w), r3(dep - 0.3)], gA = r3(LG.w * LG.d);
          pl.laneGarage = g;
          pl.alloc = { ...pl.alloc, house: r3(pl.alloc.house + gA), back: r3(pl.alloc.back - gA) };
        }
        if (big && !big.avenue) {
          // its drive: from the walk across the lawn, the drive-side yard paved, an apron to the garage in the garden
          const M = P.mansion, dw = M.drive, sd = big.left ? sL : sR, u0 = r3(big.left ? (sL - dw) / 2 : w - sR + (sR - dw) / 2), back = dep - env[3];
          // (its garage in the garden's back corner, a metre off the back line; the drive runs past the house to it)
          const G = M.garage, gv0 = r3(dep - 1 - G.d), fits = gv0 >= env[3] + G.gap && w >= 2 * G.w;
          const garage = fits ? (big.left ? [0.4, gv0, r3(0.4 + G.w), r3(gv0 + G.d)] : [r3(w - 0.4 - G.w), gv0, r3(w - 0.4), r3(gv0 + G.d)]) : null;
          const apron = garage ? r3(dw * (gv0 - env[3])) : 0, gA = garage ? r3(G.w * G.d) : 0;
          pl.mansion = { extra: big.extra, left: big.left, drive: [u0, r3(u0 + dw)], garage };
          pl.alloc = { ...pl.alloc, front: r3(pl.alloc.front - dw * F1), side: r3((sd === sL ? sR : sL) * Hd), drive: r3(dw * F1 + sd * Hd + apron), house: r3(pl.alloc.house + gA), back: r3(rearA - apron - gA) };
        }
        pl.rect = toWorld(pl, [0, 0, w, dep]);
        plots.push(pl);
        s = r3(s + w);
      });
    });
  }
  // ── 7 levels: each building a pad over the walk at its front, in risers, inside its kind's rail; a semi pair one pad ──
  const kinds = { houses: kindOf(P, 'houses', depth), ...Object.fromEntries(Object.keys(P.rows ?? {}).map((k) => [k, kindOf(P, k, depth)])) };
  const padOf = (Pd, wf, n) => { const rise = Math.max(Pd.least, Math.min(Pd.most, n - wf)); return r3(wf + Math.round(rise / P.pad.riser) * P.pad.riser); };
  const at = (pl, u, v) => [pl.A[0] + pl.ex[0] * u + pl.ey[0] * v, pl.A[1] + pl.ex[1] * u + pl.ey[1] * v];
  const groups = new Map();
  for (const pl of plots) { const key = pl.pair ?? pl.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(pl); }
  for (const g of groups.values()) {
    // the walk at the structure's front middle (a pair's party wall), the land under its middle
    const fronts = g.map((pl) => at(pl, pl.w / 2, 0)), mids = g.map((pl) => at(pl, (pl.house.env[0] + pl.house.env[2]) / 2, (pl.house.env[1] + pl.house.env[3]) / 2));
    const rail = g[0].form === 'mansion' ? { ...P.pad, ...P.mansion.pad } : kinds[g[0].kind].pad;
    const wf = fronts.reduce((a, p) => a + walkZ(...p), 0) / g.length, n = mids.reduce((a, p) => a + land.N(...p), 0) / g.length, z = padOf(rail, wf, n);
    for (const pl of g) pl.pad = z;
  }
  // ── 9 the street's furniture: a streetlight at its stride along each block-facing walk (both sides of a main or a
  // major street, one side of a local one), clear of every drive; each crossing controlled by its streets' ranks: a
  // signal every `signals` crossings along a main or major street (two-way stops on the minor street between), all-way
  // stops at a share of the local crossings (`stops`) ──
  const TF = P.traffic ?? { lights: 0, signals: 0, stops: 0 }, lights = [], crossings = [], busy = (S) => S.rank !== 'street';
  const facing = (id, side) => { const k = Number(id.slice(3)); return id.startsWith('ns') ? (side === 'w' ? k > 0 : k < C) : (side === 's' ? k > 0 : k < Rn); };
  const drives = new Map();
  for (const pl of plots) for (const [u0, u1] of [pl.mansion?.drive].filter(Boolean)) {
    const B = blocks.find((b) => b.id === pl.block), [id, side] = { w: [`ns-${B.i}`, 'e'], e: [`ns-${B.i1 + 1}`, 'w'], s: [`ew-${B.j}`, 'n'], n: [`ew-${B.j1 + 1}`, 's'] }[pl.side], ax = id.startsWith('ns') ? 1 : 0;
    const p = pl.A[ax] + pl.ex[ax] * u0, q = pl.A[ax] + pl.ex[ax] * u1;
    (drives.get(`${id}:${side}`) ?? drives.set(`${id}:${side}`, []).get(`${id}:${side}`)).push([Math.min(p, q), Math.max(p, q)]);
  }
  if (TF.lights > 0) for (const p of pieces) {
    if (p.cls !== 'walk' || !p.street || !facing(p.street, p.side)) continue;
    const ns = p.street.startsWith('ns'), k = Number(p.street.slice(3)), S = ns ? SX[k] : SY[k], hi = ns ? 'e' : 'n', open = (ns ? ['w', 'e'] : ['s', 'n']).filter((sd) => facing(p.street, sd));
    if (!busy(S) && p.side !== (open.includes(hi) ? hi : open[0])) continue;
    const [x0, y0, x1, y1] = p.rect, [a0, a1] = ns ? [y0, y1] : [x0, x1], stride = busy(S) ? TF.lights * 0.75 : TF.lights, sg = p.side === 'e' || p.side === 'n' ? 1 : -1;
    const lat = (ns ? X[k] : Y[k]) + sg * (S.R + (S.verge > 0 ? S.verge - 0.4 : 0.45)), cut = drives.get(`${p.street}:${p.side}`) ?? [];
    for (let s = a0 + stride / 2; s < a1 - 2; s += stride) {
      if (cut.some(([c0, c1]) => s > c0 - 2 && s < c1 + 2)) continue;
      lights.push({ at: ns ? [r3(lat), r3(s)] : [r3(s), r3(lat)], toward: ns ? [-sg, 0] : [0, -sg], h: busy(S) ? 9 : 7.5, street: p.street });
    }
  }
  const Rt = streamOf(seed, 'traffic', 'crossings');
  for (let k = 0; k < X.length; k++) for (let j = 0; j < Y.length; j++) {
    const arms = ['n', 's', 'e', 'w'].filter((a) => !gone.has({ n: `ns-${k}:${j}`, s: `ns-${k}:${j - 1}`, e: `ew-${j}:${k}`, w: `ew-${j}:${k - 1}` }[a]));
    if (!arms.length) continue;
    const bx = busy(SX[k]), by = busy(SY[j]), dice = Rt();
    let control = 'none', stopped = [];
    if (bx && by) control = 'signal';
    else if (bx || by) { if (TF.signals > 0 && (bx ? j : k) % TF.signals === 0) control = 'signal'; else { control = 'stop'; stopped = bx ? ['e', 'w'] : ['n', 's']; } }
    else if (dice < TF.stops) { control = 'stop'; stopped = ['n', 's', 'e', 'w']; }
    crossings.push({ id: `${k}:${j}`, at: [X[k], Y[j]], control, arms, stopped: stopped.filter((a) => arms.includes(a)) });
  }
  const traffic = { lights, crossings, signals: crossings.filter((c) => c.control === 'signal').length, stops: crossings.filter((c) => c.control === 'stop').length };
  // a site's ground (a school's, a sports field's) one level: the land under it, held between its walks' lowest and a
  // metre over their highest, in risers (a park lies on the land as it is)
  for (const B of blocks) if (B.site && B.site.type !== 'park') {
    const [x0, y0, x1, y1] = B.rect, edge = [];
    for (let t = 0; t <= 8; t++) { const x = x0 + ((x1 - x0) * t) / 8, y = y0 + ((y1 - y0) * t) / 8; edge.push(walkZ(x, y0), walkZ(x, y1), walkZ(x0, y), walkZ(x1, y)); }
    let n = 0, k = 0;
    for (let a = 1; a < 6; a++) for (let b = 1; b < 6; b++) { n += land.N(x0 + ((x1 - x0) * a) / 6, y0 + ((y1 - y0) * b) / 6); k++; }
    const z = Math.max(Math.min(...edge) + 0.15, Math.min(Math.max(...edge) + 1, n / k));
    B.z = r3(Math.round(z / P.pad.riser) * P.pad.riser);
  }
  // ── 8 parking: a front PAD where a house's front yard is deep and near level (its streetscape's share), off its path;
  // a LANE along the kerb on the sides of each street its streetscape parks (those that face a block), its stalls clear
  // of the crossings and of every drive across it ──
  const PK = P.parking ?? { sides: 'none', pads: 0 }, PAD = { w: 2.7, deep: 5.2, rise: 0.6 };
  for (const pl of plots) {
    if (pl.kind !== 'houses' || pl.form === 'mansion' || pl.setback < PAD.deep || !(PK.pads > 0)) continue;
    const Rp = streamOf(seed, 'parking', pl.id), rise = pl.pad - walkZ(...at(pl, pl.w / 2, 0)), pw = pl.path.w;
    if (Rp() >= PK.pads || Math.abs(rise) > PAD.rise || pl.w < PAD.w + pw + 0.8) continue;
    const left = pl.form === 'semi' ? pl.half === 'L' : Rp() < 0.5;
    pl.park = left ? [0, PAD.w] : [r3(pl.w - PAD.w), r3(pl.w)];
    pl.path.u = r3(left ? Math.max(pl.path.u, PAD.w + pw / 2 + 0.1) : Math.min(pl.path.u, pl.w - PAD.w - pw / 2 - 0.1));
    const a = r3(PAD.w * pl.house.env[1]);
    pl.alloc = { ...pl.alloc, front: r3(pl.alloc.front - a), drive: r3(pl.alloc.drive + a) };
  }
  // (a plot's front fronts a street's side: its row's side → that street and the side of it the plot stands on)
  const frontOn = (pl) => { const B = blocks.find((b) => b.id === pl.block); return { w: [`ns-${B.i}`, 'e'], e: [`ns-${B.i1 + 1}`, 'w'], s: [`ew-${B.j}`, 'n'], n: [`ew-${B.j1 + 1}`, 's'] }[pl.side]; };
  const cuts = new Map();
  for (const pl of plots) {
    const open = [pl.park, pl.mansion?.drive].filter(Boolean);
    if (!open.length) continue;
    const [id, side] = frontOn(pl), key = `${id}:${side}`, ax = id.startsWith('ns') ? 1 : 0;
    for (const [u0, u1] of open) { const p = at(pl, u0, 0)[ax], q = at(pl, u1, 0)[ax]; (cuts.get(key) ?? cuts.set(key, []).get(key)).push([r3(Math.min(p, q) - 0.75), r3(Math.max(p, q) + 0.75)]); }
  }
  const STALL = 6.2, CLEAR = 6, lanes = [];
  const faces = (id, side) => { const k = Number(id.slice(3)); return id.startsWith('ns') ? (side === 'w' ? k > 0 : k < C) : (side === 's' ? k > 0 : k < Rn); };
  for (const p of pieces) {
    if (p.cls !== 'road' || !p.street || PK.sides === 'none') continue;
    const ns = p.street.startsWith('ns'), [lo, hi] = ns ? ['w', 'e'] : ['s', 'n'], open = [lo, hi].filter((s) => faces(p.street, s));
    const sides = PK.sides === 'both' ? open : open.includes(hi) ? [hi] : open.slice(0, 1), [x0, y0, x1, y1] = p.rect, L = PK.lane;
    for (const side of sides) {
      const rect = ns ? (side === 'w' ? [x0, y0, r3(x0 + L), y1] : [r3(x1 - L), y0, x1, y1]) : (side === 's' ? [x0, y0, x1, r3(y0 + L)] : [x0, r3(y1 - L), x1, y1]);
      const [a0, a1] = ns ? [y0, y1] : [x0, x1], cut = (cuts.get(`${p.street}:${side}`) ?? []).sort((a, b) => a[0] - b[0]), stalls = [];
      for (let s = a0 + CLEAR; s + STALL <= a1 - CLEAR + 1e-9;) {
        const hit = cut.find(([c0, c1]) => c0 < s + STALL && c1 > s);
        if (hit) { s = hit[1]; continue; }
        stalls.push([r3(s), r3(s + STALL)]); s += STALL;
      }
      lanes.push({ street: p.street, seg: p.seg, side, axis: ns ? 'y' : 'x', rect, cuts: cut, stalls });
      surfaces.push({ cls: 'parking', rect, street: p.street, inside: 'road' });
    }
  }
  const parking = { sides: PK.sides, lanes, cuts: Object.fromEntries(cuts), stalls: lanes.reduce((a, l) => a + l.stalls.length, 0), pads: plots.filter((pl) => pl.park).length, garages: plots.filter((pl) => pl.mansion?.garage).length, laneGarages: plots.filter((pl) => pl.laneGarage).length };
  // the surfaces each plot allocates (its path inside its front yard: the front's own area is the yard less the path)
  for (const pl of plots) {
    const { env } = pl.house, F = pl.setback, d = pl.d, w = pl.w, pu = pl.path.u, pw = pl.path.w;
    const F1 = env[1], Mn = pl.mansion, at0 = { plot: pl.id, block: pl.block };
    if (F1 > 0) {
      surfaces.push({ cls: pl.paved ? 'service' : 'front', rect: toWorld(pl, [0, 0, w, F1]), ...at0, less: 'path' });
      if (pw > 0) surfaces.push({ cls: 'path', rect: toWorld(pl, [r3(pu - pw / 2), 0, r3(pu + pw / 2), F1]), ...at0, inside: pl.paved ? 'service' : 'front' });
      if (Mn) surfaces.push({ cls: 'drive', rect: toWorld(pl, [Mn.drive[0], 0, Mn.drive[1], F1]), ...at0, inside: 'front' });
      if (pl.park) surfaces.push({ cls: 'drive', rect: toWorld(pl, [pl.park[0], 0, pl.park[1], F1]), ...at0, inside: 'front' });
    }
    surfaces.push({ cls: 'house', rect: toWorld(pl, env), ...at0, use: pl.use, kind: pl.kind, ...(Mn ? { mansion: true } : {}) });
    // (a mansion's drive-side yard is its drive)
    if (env[0] > 0) surfaces.push({ cls: Mn?.left ? 'drive' : 'side', rect: toWorld(pl, [0, F1, env[0], env[3]]), ...at0 });
    if (env[2] < w) surfaces.push({ cls: Mn && !Mn.left ? 'drive' : 'side', rect: toWorld(pl, [env[2], F1, w, env[3]]), ...at0 });
    if (env[3] < d) surfaces.push({ cls: pl.rear, rect: toWorld(pl, [0, env[3], w, d]), ...at0 });
    if (pl.laneGarage) surfaces.push({ cls: 'house', rect: toWorld(pl, pl.laneGarage), ...at0, inside: pl.rear, use: 'garage', kind: 'garage' });
    if (Mn?.garage) {
      surfaces.push({ cls: 'drive', rect: toWorld(pl, [Mn.drive[0], env[3], Mn.drive[1], Mn.garage[1]]), ...at0, inside: pl.rear });
      surfaces.push({ cls: 'house', rect: toWorld(pl, Mn.garage), ...at0, inside: pl.rear, use: 'garage', kind: 'garage' });
    }
  }
  const ledger = ledgerOf(surfaces, blocks, frame);
  // the PORTS: the town's perimeter streets, each its rank and the streets' ground at its ends (a geocity's graph joins
  // neighbourhoods at them)
  const ports = [['ns-0', 'w', SX[0], [X[0], 0], [X[0], frame.D]], [`ns-${C}`, 'e', SX[C], [X[C], 0], [X[C], frame.D]], ['ew-0', 's', SY[0], [0, Y[0]], [frame.W, Y[0]]], [`ew-${Rn}`, 'n', SY[Rn], [0, Y[Rn]], [frame.W, Y[Rn]]]]
    .map(([id, side, S, a, b]) => ({ id, side, rank: S.rank, row: r3(S.row), from: a.map(r3), to: b.map(r3), z: [r3(land.S(...a)), r3(land.S(...b))] }));
  // (playing fields side by side: two field sites whose blocks face each other across one street)
  const fieldy = blocks.filter((b) => b.site && b.site.type !== 'park'), touch = (a, b) => (a.i1 + 1 === b.i || b.i1 + 1 === a.i) && a.j <= b.j1 && b.j <= a.j1 || (a.j1 + 1 === b.j || b.j1 + 1 === a.j) && a.i <= b.i1 && b.i <= a.i1;
  const beside = fieldy.flatMap((a, k) => fieldy.slice(k + 1).filter((b) => touch(a, b)).map((b) => [a.id, b.id]));
  const D = { spec: T, seed, pattern: P, row: sectionOf(P, 'street'), sections: { x: SX, y: SY }, frame, depth, X, Y, streets, pieces, blocks, plots, surfaces, ledger, ports, land, parking, sites, beside, traffic };
  // an evocation stands for the town laid to scale: its houses' measures are read against that town's (laws.js `evokes`)
  if (evoked) D.evoked = { level: T.evoke, stands: { plots: ref.plots.length, blocks: ref.blocks.length }, shows: plots.length, ref: plotShares(ref), fits };
  D.laws = geotownLaws(D);
  return D;
}

/** The LEDGER: every surface's square metres, for the town, per block, and the streets' share; a path is counted out
 *  of the front yard it runs through. `uses` the buildings' footprints by their row's kind. */
export function ledgerOf(surfaces, blocks, frame) {
  const zero = () => Object.fromEntries(SURFACE_IDS.map((k) => [k, 0]));
  const town = zero(), per = Object.fromEntries(blocks.map((b) => [b.id, zero()])), streets = zero(), uses = {};
  for (const s of surfaces) {
    const a = s.area ?? area(s.rect), into = s.block ? per[s.block] : streets;
    town[s.cls] += a; into[s.cls] += a;
    if (s.inside) { town[s.inside] -= a; into[s.inside] -= a; }
    if (s.kind) uses[s.kind] = (uses[s.kind] ?? 0) + a;
  }
  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  const total = Object.values(town).reduce((a, b) => a + b, 0);
  return { town: round(town), streets: round(streets), blocks: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, round(v)])), uses: round(uses), total: Math.round(total * 100) / 100, frame: Math.round(frame.W * frame.D * 100) / 100 };
}
