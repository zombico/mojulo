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
 *
 *   designGeotown(spec, { seed, field? }) → { spec, seed, pattern, row, sections, frame, depth, X, Y, streets, pieces,
 *     blocks, plots, surfaces, ledger, ports, land, evoked?, laws }   (`field`: (x, y) → metres, in place of the hills)
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

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const roll = (R, [lo, hi]) => r3(lo + (hi - lo) * R());
const area = (r) => (r[2] - r[0]) * (r[3] - r[1]);
// a dwelling's least width (era/out-structures.js STRUCTURE_USES.dwelling.lot.w), a hair over it
const HOUSE_LEAST = 5.55;
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
 *  a road piece a kerb stands on). */
function streetPieces(X, Y, SX, SY) {
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
  for (let k = 0; k < X.length; k++) for (let j = 0; j + 1 < Y.length; j++) ns(k, r3(Y[j] + SY[j].half), r3(Y[j + 1] - SY[j + 1].half), j);
  for (let j = 0; j < Y.length; j++) for (let k = 0; k + 1 < X.length; k++) ew(j, r3(X[k] + SX[k].half), r3(X[k + 1] - SX[k + 1].half), k);
  for (let k = 0; k < X.length; k++) for (let j = 0; j < Y.length; j++) {
    const x = X[k], y = Y[j], c = `${k}:${j}`, Rx = SX[k].R, hx = SX[k].half, Ry = SY[j].R, hy = SY[j].half;
    out.push({ cls: 'road', rect: [r3(x - Rx), r3(y - Ry), r3(x + Rx), r3(y + Ry)], crossing: c });
    out.push({ cls: 'road', rect: [r3(x - Rx), r3(y + Ry), r3(x + Rx), r3(y + hy)], crossing: c, kerbs: ['-x', '+x'] }, { cls: 'road', rect: [r3(x - Rx), r3(y - hy), r3(x + Rx), r3(y - Ry)], crossing: c, kerbs: ['-x', '+x'] });
    out.push({ cls: 'road', rect: [r3(x + Rx), r3(y - Ry), r3(x + hx), r3(y + Ry)], crossing: c, kerbs: ['-y', '+y'] }, { cls: 'road', rect: [r3(x - hx), r3(y - Ry), r3(x - Rx), r3(y + Ry)], crossing: c, kerbs: ['-y', '+y'] });
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
 *  (`main`: which of its four sides front one), the south's first; with none they face south. */
export function rowsOf(type, main = {}) {
  const S = SEGMENTS[type];
  if (!S.rows.length) return { axis: 'y', rows: [] };
  if (type === 'main-street') {
    if (main.s || main.n || !(main.w || main.e)) { const a = main.s || !main.n ? 's' : 'n', b = a === 's' ? 'n' : 's'; return { axis: 'x', rows: [{ side: a, kind: 'shops' }, { side: b, kind: main[b] ? 'shops' : 'houses' }] }; }
    const a = main.w ? 'w' : 'e', b = a === 'w' ? 'e' : 'w';
    return { axis: 'y', rows: [{ side: a, kind: 'shops' }, { side: b, kind: main[b] ? 'shops' : 'houses' }] };
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
function cutCount(P, n, R) {
  // (the mix is of buildings: a semi pair is one building and two houses)
  const m = P.mix.semi / (P.mix.semi + P.mix.detached), semiHouses = (2 * m) / (2 * m + (1 - m));
  let pairs = P.mix.detached <= 0 ? Math.floor(n / 2) : P.mix.semi <= 0 ? 0 : Math.round((n * semiHouses) / 2);
  if (P.mix.semi > 0 && P.mix.detached > 0 && n >= 3) pairs = Math.max(1, Math.min(pairs, Math.floor((n - 1) / 2)));
  const forms = [...Array(pairs).fill('semi'), ...Array(n - 2 * pairs).fill('detached')];
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
const cutPlain = (K, kind, n, R) => Array.from({ length: n }, () => ({ form: kind, w: roll(R, K.frontage) }));

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

/** A row's cut: by count (an evocation) or filling its length (the town to scale); `key` its stream's. */
function cutOf(P, K, n, R, L = null) {
  if (L !== null) return cutRow(P, L, R);
  return K.kind === 'houses' ? cutCount(P, n, R) : cutPlain(K, K.kind, n, R);
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
  const rank = (id) => (T.mains.includes(id) ? 'main' : 'street');
  const SX = Array.from({ length: C + 1 }, (_, k) => sectionOf(P, rank(`ns-${k}`))), SY = Array.from({ length: Rn + 1 }, (_, j) => sectionOf(P, rank(`ew-${j}`)));
  const depth = roll(streamOf(seed, 'frame', 'depth'), P.block.depth);
  const cells = [];
  for (let j = 0; j < Rn; j++) for (let i = 0; i < C; i++) {
    const id = blockId(i, j), type = T.cells[j][i], main = { w: SX[i].rank === 'main', e: SX[i + 1].rank === 'main', s: SY[j].rank === 'main', n: SY[j + 1].rank === 'main' };
    cells.push({ id, i, j, type, built: T.blocks[id]?.built ?? true, ...rowsOf(type, main) });
  }
  // ── 2 needs: each row cut by its count (an evocation), its length and its depth; a row of houses holds one count a
  // row of cells, so a block's two rows of houses close on one length ──
  const lengths = evoked ? null : Array.from({ length: Rn }, (_, j) => roll(streamOf(seed, 'frame', `row:${j}`), P.block.long));
  for (const c of cells) for (const r of c.rows) {
    const K = kindOf(P, r.kind, depth), R = streamOf(seed, 'plots', `${c.id}:${r.side}`);
    r.K = K; r.R = R; r.F = roll(R, K.setback);
    r.need = { depth: r.kind === 'houses' ? depth : roll(R, K.depth) };
    if (evoked) {
      r.n = r.kind === 'houses' ? K.count[0] + Math.floor(streamOf(seed, 'frame', `count:${c.j}`)() * (K.count[1] - K.count[0] + 1)) : K.count[0] + Math.floor(R() * (K.count[1] - K.count[0] + 1));
      r.cut = cutOf(P, K, r.n, R);
      r.need.len = r3(r.cut.reduce((a, p) => a + p.w, 0) + 2 * K.corner);
    } else r.need.len = lengths[c.j];
  }
  const need = (c) => {
    if (!c.rows.length) return { x: 0, y: 0 };
    const len = Math.max(...c.rows.map((r) => r.need.len)), dep = c.rows.reduce((a, r) => a + r.need.depth, 0);
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
  const pieces = streetPieces(X, Y, SX, SY);
  // ── 7 the land (read before the plots: a pad is levelled over its walk); an evocation's is a window of the town to
  // scale's, its middle over that town's middle, so its slopes are the town's and not its hills squeezed into a block ──
  const ref = evoked ? designGeotown({ evoke: 'metro', ...(spec.pattern !== undefined ? { pattern: spec.pattern } : {}), ...(spec.hills !== undefined ? { hills: spec.hills } : {}) }, { seed, field }) : null;
  const win = ref && !field ? ((ox, oy) => (x, y) => ref.land.N(x + ox, y + oy))((ref.frame.W - frame.W) / 2, (ref.frame.D - frame.D) / 2) : field;
  const land = geotownLand(T.hills, frame, seed, win), walkZ = (x, y) => land.S(x, y) + SX[0].kerb;
  // ── 5, 6 the plots, each segment tuned to its cell, and their budget ──
  const blocks = [], plots = [], fits = [], surfaces = pieces.map((p) => ({ cls: p.cls, rect: p.rect, ...(p.street ? { street: p.street } : { crossing: p.crossing }) }));
  for (const c of cells) {
    const rect = [r3(X[c.i] + SX[c.i].half), r3(Y[c.j] + SY[c.j].half), r3(X[c.i + 1] - SX[c.i + 1].half), r3(Y[c.j + 1] - SY[c.j + 1].half)], [x0, y0, x1, y1] = rect;
    const B = { id: c.id, i: c.i, j: c.j, rect, use: c.type, built: c.built, axis: c.axis, rows: [] };
    blocks.push(B);
    if (!c.rows.length) {
      // a park: the land as it lies, a cross of paths through its middle
      const pw = P.parkPath, xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
      B.paths = [[x0, r3(yc - pw / 2), x1, r3(yc + pw / 2)], [r3(xc - pw / 2), y0, r3(xc + pw / 2), r3(yc - pw / 2)], [r3(xc - pw / 2), r3(yc + pw / 2), r3(xc + pw / 2), y1]];
      for (const r of B.paths) surfaces.push({ cls: 'park-path', rect: r, block: B.id });
      for (const r of [[x0, y0, r3(xc - pw / 2), r3(yc - pw / 2)], [r3(xc + pw / 2), y0, x1, r3(yc - pw / 2)], [x0, r3(yc + pw / 2), r3(xc - pw / 2), y1], [r3(xc + pw / 2), r3(yc + pw / 2), x1, y1]]) surfaces.push({ cls: 'park', rect: r, block: B.id });
      continue;
    }
    const along = c.axis === 'y' ? y1 - y0 : x1 - x0, across = c.axis === 'y' ? x1 - x0 : y1 - y0, depSum = c.rows.reduce((a, r) => a + r.need.depth, 0);
    let used = 0;
    c.rows.forEach((r, ri) => {
      const K = r.K, dep = ri === c.rows.length - 1 ? r3(across - used) : r3((across * r.need.depth) / depSum);
      used = r3(used + dep);
      // tuned to its cell: a row the cell stretches past the rail recut by count, then spread to fill it
      let cut = r.cut;
      if (evoked) {
        const k = along / r.need.len;
        if (k < ST[0] || k > ST[1]) {
          const n = Math.max(r.kind === 'houses' ? 2 : 1, Math.round(r.n * k));
          cut = cutOf(P, K, n, streamOf(seed, 'plots', `${c.id}:${r.side}:n${n}`));
          r.n = n;
        }
        // (how far its frontages spread to fill its cell, and how much deeper its plots run than they need)
        const sum0 = cut.reduce((a, p) => a + p.w, 0) + 2 * K.corner;
        cut = fitRow(cut.map((p) => ({ ...p })), along, K.corner);
        fits.push({ block: c.id, side: r.side, kind: r.kind, n: cut.length, stretch: r3(along / sum0), deep: r3(dep / r.need.depth) });
      } else cut = cutOf(P, K, 0, r.R, along);
      B.rows.push({ side: r.side, kind: r.kind, setback: r.F, depth: dep, count: cut.length });
      const { ex, ey } = FRAMES[r.side], A0 = startOf(r.side, rect), R = r.R, F = r.F, pairs = new Map();
      let s = 0;
      cut.forEach((cc, k) => {
        const A = [r3(A0[0] + ex[0] * s), r3(A0[1] + ex[1] * s)], w = cc.w;
        let Hd, sL, sR;
        if (r.kind === 'houses') {
          let H;
          if (cc.form === 'semi') { if (!pairs.has(cc.pair)) pairs.set(cc.pair, { depth: roll(R, P.house.depth), side: roll(R, P.house.side) }); H = pairs.get(cc.pair); }
          else H = { depth: roll(R, P.house.depth), side: roll(R, P.house.side), side2: roll(R, P.house.side) };
          Hd = r3(Math.max(4, Math.min(H.depth, dep - F - P.back)));
          // the side yards: none at a semi's party wall; a corner's flank wider by the corner's frontage
          sL = cc.form === 'semi' ? (cc.half === 'L' ? H.side : 0) : H.side; sR = cc.form === 'semi' ? (cc.half === 'R' ? H.side : 0) : H.side2;
        } else {
          // a shop or a walk-up: its building's depth, short of its row's (its service yard behind); its side yards
          Hd = r3(Math.max(6, Math.min(roll(R, K.building), dep - F - 3)));
          sL = roll(R, K.side); sR = roll(R, K.side);
        }
        // (never so wide the building is narrower than a dwelling's least: the side yards give way first)
        const spare = Math.max(0, w - (cc.corner === 'both' ? 2 : cc.corner ? 1 : 0) * K.corner - HOUSE_LEAST);
        if (sL + sR > spare) { const q = spare / (sL + sR); sL = r3(sL * q); sR = r3(sR * q); }
        // a corner's flank: a house's or a walk-up's a side yard wider by the corner's frontage; a shop builds to it
        const flank = r.kind === 'shops' ? 0 : K.corner;
        if (cc.corner === 'start' || cc.corner === 'both') sL = r3(sL + flank);
        if (cc.corner === 'end' || cc.corner === 'both') sR = r3(sR + flank);
        const env = [sL, F, r3(w - sR), r3(F + Hd)], pw = F > 0 ? Math.min(P.path * (r.kind === 'apartments' ? 1.6 : 1), Math.max(0.6, env[2] - env[0] - 0.4)) : 0;
        const pl = { id: `${B.id}-${r.side}${k + 1}`, block: B.id, side: r.side, k, kind: r.kind, use: K.use, form: cc.form, ...(cc.form === 'semi' ? { pair: `${B.id}-${r.side}p${cc.pair + 1}`, half: cc.half } : {}), ...(cc.corner ? { corner: cc.corner } : {}),
          A, ex, ey, w, d: dep, setback: F, rear: K.rear, house: { depth: Hd, sides: [sL, sR], env }, built: B.built };
        // the door's path: from the walk to the envelope's middle until a building says where its door is
        pl.path = { u: r3((env[0] + env[2]) / 2), w: r3(pw) };
        pl.alloc = { front: r3(w * F - pw * F), path: r3(pw * F), house: r3((env[2] - env[0]) * Hd), side: r3((sL + sR) * Hd), back: K.rear === 'back' ? r3(w * (dep - F - Hd)) : 0, service: K.rear === 'service' ? r3(w * (dep - F - Hd)) : 0 };
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
    const fronts = g.map((pl) => at(pl, pl.w / 2, 0)), mids = g.map((pl) => at(pl, (pl.house.env[0] + pl.house.env[2]) / 2, pl.setback + pl.house.depth / 2));
    const wf = fronts.reduce((a, p) => a + walkZ(...p), 0) / g.length, n = mids.reduce((a, p) => a + land.N(...p), 0) / g.length, z = padOf(kinds[g[0].kind].pad, wf, n);
    for (const pl of g) pl.pad = z;
  }
  // the surfaces each plot allocates (its path inside its front yard: the front's own area is the yard less the path)
  for (const pl of plots) {
    const { env } = pl.house, F = pl.setback, d = pl.d, w = pl.w, pu = pl.path.u, pw = pl.path.w;
    if (F > 0) {
      surfaces.push({ cls: 'front', rect: toWorld(pl, [0, 0, w, F]), plot: pl.id, block: pl.block, less: 'path' });
      if (pw > 0) surfaces.push({ cls: 'path', rect: toWorld(pl, [r3(pu - pw / 2), 0, r3(pu + pw / 2), F]), plot: pl.id, block: pl.block, inside: 'front' });
    }
    surfaces.push({ cls: 'house', rect: toWorld(pl, env), plot: pl.id, block: pl.block, use: pl.use, kind: pl.kind });
    if (env[0] > 0) surfaces.push({ cls: 'side', rect: toWorld(pl, [0, F, env[0], env[3]]), plot: pl.id, block: pl.block });
    if (env[2] < w) surfaces.push({ cls: 'side', rect: toWorld(pl, [env[2], F, w, env[3]]), plot: pl.id, block: pl.block });
    if (env[3] < d) surfaces.push({ cls: pl.rear, rect: toWorld(pl, [0, env[3], w, d]), plot: pl.id, block: pl.block });
  }
  const ledger = ledgerOf(surfaces, blocks, frame);
  // the PORTS: the town's perimeter streets, each its rank and the streets' ground at its ends (a geocity's graph joins
  // neighbourhoods at them)
  const ports = [['ns-0', 'w', SX[0], [X[0], 0], [X[0], frame.D]], [`ns-${C}`, 'e', SX[C], [X[C], 0], [X[C], frame.D]], ['ew-0', 's', SY[0], [0, Y[0]], [frame.W, Y[0]]], [`ew-${Rn}`, 'n', SY[Rn], [0, Y[Rn]], [frame.W, Y[Rn]]]]
    .map(([id, side, S, a, b]) => ({ id, side, rank: S.rank, row: r3(S.row), from: a.map(r3), to: b.map(r3), z: [r3(land.S(...a)), r3(land.S(...b))] }));
  const D = { spec: T, seed, pattern: P, row: sectionOf(P, 'street'), sections: { x: SX, y: SY }, frame, depth, X, Y, streets, pieces, blocks, plots, surfaces, ledger, ports, land };
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
    const a = area(s.rect), into = s.block ? per[s.block] : streets;
    town[s.cls] += a; into[s.cls] += a;
    if (s.inside) { town[s.inside] -= a; into[s.inside] -= a; }
    if (s.kind) uses[s.kind] = (uses[s.kind] ?? 0) + a;
  }
  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  const total = Object.values(town).reduce((a, b) => a + b, 0);
  return { town: round(town), streets: round(streets), blocks: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, round(v)])), uses: round(uses), total: Math.round(total * 100) / 100, frame: Math.round(frame.W * frame.D * 100) / 100 };
}
