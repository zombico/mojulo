/**
 * THE GEOTOWN, DESIGNED — a neighbourhood's map, laid before anything is drawn, layer by layer, pure. Each layer reads
 * only the layers before it and rolls only its own dice (city/plan/dice.js `streamOf`, a stream per layer and key): a
 * block's plots roll their own, so a change to one block never rerolls another. The labour is a block at a time.
 *
 *   1 frame     the town's grid: one row depth for every block (the streets run straight), one length per row of
 *               blocks; the frame in metres, x east across, y north along, z up, its south-west corner the origin
 *   2 streets   the right-of-way round every block: each street between its crossings in its section (road, the kerb,
 *               each side's verge and walk), each crossing a road cross with a walk at each corner
 *   3 blocks    what the streets leave, on the grid's board (A1 the south-west), each houses or a park, built or not
 *   4 plots     each houses block two rows deep, back to back, each row fronting its street and cut along it: semis in
 *               pairs about their party wall, detached houses, a wider plot at each corner; the row's frontage spread
 *               so its plots fill it exactly. An EVOCATION (`evoke` low | mid | high, read.js EVOKES) cuts each row by
 *               a count of houses instead, and its block is as long as its rows make it: a few houses standing for
 *               the town laid to scale (`evoke: 'metro'`), each house and each yard designed on its own (scene.js)
 *   5 budget    each plot's surface allocated: its front yard (the setback the block face holds), its path, the
 *               house's envelope, its side yards, its back yard; every square metre of the frame is one surface, and
 *               the LEDGER sums them by surface, per block and for the town
 *   6 levels    the land (the cube's hills, its natural ground N) smoothed into the streets' ground S (the streets keep
 *               the land's grade); each house a level PAD over the walk at its front, in risers, the pair sharing one
 *
 *   designGeotown(spec, { seed, field? }) → { spec, seed, pattern, row, frame, depth, lengths, streets, pieces, blocks,
 *     plots, surfaces, ledger, land, laws }   (`field`: (x, y) → metres, the natural ground, in place of the hills)
 *   geotownLand(hills, frame, seed, field?) → { N, S, range }: the natural ground and the streets' ground, (x, y) → m
 *
 * Every surface is an axis-aligned rect [x0, y0, x1, y1]; a plot's own frame is its front corner `A`, `ex` along its
 * frontage and `ey` into it (ex × ey up), so a house is spoken in it as the town speaks one (era/out-anchor-structure.js).
 */
import { readGeotown, blockId, EVOKES } from './read.js';
import { rowOf, SURFACE_IDS } from './pattern.js';
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
/** The right-of-way's pieces: each street between its crossings in its section, each crossing's road cross and walked
 *  corners. → [{ cls, rect, street?, crossing?, kerbs? }] (`kerbs`: the sides of a road piece a kerb stands on). */
function streetPieces(X, Y, row) {
  const { R, verge: V, half } = row, out = [];
  const ns = (k, ya, yb, seg) => {
    const x = X[k], id = `ns-${k}`;
    out.push({ cls: 'road', rect: [r3(x - R), ya, r3(x + R), yb], street: id, seg, kerbs: ['-x', '+x'] });
    out.push({ cls: 'verge', rect: [r3(x - R - V), ya, r3(x - R), yb], street: id, seg, side: 'w' }, { cls: 'walk', rect: [r3(x - half), ya, r3(x - R - V), yb], street: id, seg, side: 'w' });
    out.push({ cls: 'verge', rect: [r3(x + R), ya, r3(x + R + V), yb], street: id, seg, side: 'e' }, { cls: 'walk', rect: [r3(x + R + V), ya, r3(x + half), yb], street: id, seg, side: 'e' });
  };
  const ew = (j, xa, xb, seg) => {
    const y = Y[j], id = `ew-${j}`;
    out.push({ cls: 'road', rect: [xa, r3(y - R), xb, r3(y + R)], street: id, seg, kerbs: ['-y', '+y'] });
    out.push({ cls: 'verge', rect: [xa, r3(y - R - V), xb, r3(y - R)], street: id, seg, side: 's' }, { cls: 'walk', rect: [xa, r3(y - half), xb, r3(y - R - V)], street: id, seg, side: 's' });
    out.push({ cls: 'verge', rect: [xa, r3(y + R), xb, r3(y + R + V)], street: id, seg, side: 'n' }, { cls: 'walk', rect: [xa, r3(y + R + V), xb, r3(y + half)], street: id, seg, side: 'n' });
  };
  for (let k = 0; k < X.length; k++) for (let j = 0; j + 1 < Y.length; j++) ns(k, r3(Y[j] + half), r3(Y[j + 1] - half), j);
  for (let j = 0; j < Y.length; j++) for (let k = 0; k + 1 < X.length; k++) ew(j, r3(X[k] + half), r3(X[k + 1] - half), k);
  for (let k = 0; k < X.length; k++) for (let j = 0; j < Y.length; j++) {
    const x = X[k], y = Y[j], c = `${k}:${j}`;
    out.push({ cls: 'road', rect: [r3(x - R), r3(y - R), r3(x + R), r3(y + R)], crossing: c });
    out.push({ cls: 'road', rect: [r3(x - R), r3(y + R), r3(x + R), r3(y + half)], crossing: c, kerbs: ['-x', '+x'] }, { cls: 'road', rect: [r3(x - R), r3(y - half), r3(x + R), r3(y - R)], crossing: c, kerbs: ['-x', '+x'] });
    out.push({ cls: 'road', rect: [r3(x + R), r3(y - R), r3(x + half), r3(y + R)], crossing: c, kerbs: ['-y', '+y'] }, { cls: 'road', rect: [r3(x - half), r3(y - R), r3(x - R), r3(y + R)], crossing: c, kerbs: ['-y', '+y'] });
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) out.push({ cls: 'walk', rect: rectOf([x + sx * R, y + sy * R], [x + sx * half, y + sy * half]), crossing: c, corner: true });
  }
  return out;
}

// ── the plots ────────────────────────────────────────────────────────────────────────────────────────────────────────
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

/** An EVOKED row: `n` houses, as the pattern's mix would have them (a semi pair and a detached house at least, where
 *  the mix has both and the row holds three), in an order the dice choose; their own frontages, uncut by a block's
 *  length (the block is as long as its rows make it). → [{ form, w, pair?, half? }] */
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

/** A row's houses spread so they fill `L` exactly, a corner's frontage added at each end. */
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

/** A plot's local (u along its frontage, v into it) rect → world. */
const toWorld = (pl, [u0, v0, u1, v1]) => {
  const at = (u, v) => [pl.A[0] + pl.ex[0] * u + pl.ey[0] * v, pl.A[1] + pl.ex[1] * u + pl.ey[1] * v];
  return rectOf(at(u0, v0), at(u1, v1));
};
export { toWorld as plotRect };

/** The design of a geotown: its map, its budget and its levels. */
export function designGeotown(spec = {}, { seed = 1, field = null } = {}) {
  const T = readGeotown(spec), P = T.pattern, row = rowOf(P), [C, Rn] = T.grid, E = EVOKES[T.evoke];
  // ── 1 frame ──
  const depth = roll(streamOf(seed, 'frame', 'depth'), P.block.depth), blockW = r3(2 * depth);
  // an evocation cuts its rows first, by count: each row of blocks as long as its longest row of houses makes it
  const evoked = E ? new Map() : null;
  let lengths;
  if (E) {
    lengths = Array.from({ length: Rn }, () => 0);
    for (let j = 0; j < Rn; j++) for (let i = 0; i < C; i++) {
      const id = blockId(i, j);
      if ((T.blocks[id]?.use ?? 'houses') === 'park') continue;
      // (a row of blocks holds one count of houses a side, so its rows close on one length without a stretch)
      const n = E.houses[0] + Math.floor(streamOf(seed, 'frame', `count:${j}`)() * (E.houses[1] - E.houses[0] + 1));
      for (const side of ['w', 'e']) {
        const R = streamOf(seed, 'plots', `${id}:${side}`), F = roll(R, P.setback), cut = cutCount(P, n, R);
        evoked.set(`${id}:${side}`, { R, F, cut });
        lengths[j] = Math.max(lengths[j], r3(cut.reduce((a, c) => a + c.w, 0) + 2 * P.plot.corner));
      }
    }
    // (a row of parks alone: a park as long as a short block)
    for (let j = 0; j < Rn; j++) if (!lengths[j]) lengths[j] = r3(Math.max(40, P.block.long[0] / 3));
  } else lengths = Array.from({ length: Rn }, (_, j) => roll(streamOf(seed, 'frame', `row:${j}`), P.block.long));
  const X = Array.from({ length: C + 1 }, (_, k) => r3(row.half + k * (blockW + row.row)));
  const Y = [r3(row.half)];
  for (let j = 0; j < Rn; j++) Y.push(r3(Y[j] + lengths[j] + row.row));
  const frame = { W: r3(C * (blockW + row.row) + row.row), D: r3(Y[Rn] + row.half), margin: T.margin };
  // ── 2 streets ──
  const streets = [...X.map((x, k) => ({ id: `ns-${k}`, axis: 'y', at: x, from: 0, to: frame.D })), ...Y.map((y, j) => ({ id: `ew-${j}`, axis: 'x', at: y, from: 0, to: frame.W }))];
  const pieces = streetPieces(X, Y, row);
  // ── 3 blocks ──
  const blocks = [];
  for (let j = 0; j < Rn; j++) for (let i = 0; i < C; i++) {
    const id = blockId(i, j), b = T.blocks[id] ?? {};
    blocks.push({ id, i, j, rect: [r3(X[i] + row.half), r3(Y[j] + row.half), r3(X[i + 1] - row.half), r3(Y[j + 1] - row.half)], use: b.use ?? 'houses', built: b.built ?? true });
  }
  // ── 6 the land (read before the plots: a pad is levelled over its walk); an evocation's is a window of the town to
  // scale's, its middle over that town's middle, so its slopes are the town's and not its hills squeezed into a block ──
  const ref = E ? designGeotown({ ...spec, evoke: 'metro', blocks: {} }, { seed, field }) : null;
  const win = ref && !field ? ((ox, oy) => (x, y) => ref.land.N(x + ox, y + oy))((ref.frame.W - frame.W) / 2, (ref.frame.D - frame.D) / 2) : field;
  const land = geotownLand(T.hills, frame, seed, win), walkZ = (x, y) => land.S(x, y) + row.kerb;
  // ── 4, 5 the plots and their budget ──
  const plots = [], surfaces = pieces.map((p) => ({ cls: p.cls, rect: p.rect, ...(p.street ? { street: p.street } : { crossing: p.crossing }) }));
  for (const B of blocks) {
    const [x0, y0, x1, y1] = B.rect, L = r3(y1 - y0);
    if (B.use === 'park') {
      // a park: the land as it lies, a cross of paths through its middle
      const pw = P.parkPath, xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
      B.paths = [[x0, r3(yc - pw / 2), x1, r3(yc + pw / 2)], [r3(xc - pw / 2), y0, r3(xc + pw / 2), r3(yc - pw / 2)], [r3(xc - pw / 2), r3(yc + pw / 2), r3(xc + pw / 2), y1]];
      for (const r of B.paths) surfaces.push({ cls: 'park-path', rect: r, block: B.id });
      // the lawn: the four quarters the paths leave
      for (const r of [[x0, y0, r3(xc - pw / 2), r3(yc - pw / 2)], [r3(xc + pw / 2), y0, x1, r3(yc - pw / 2)], [x0, r3(yc + pw / 2), r3(xc - pw / 2), y1], [r3(xc + pw / 2), r3(yc + pw / 2), x1, y1]]) surfaces.push({ cls: 'park', rect: r, block: B.id });
      continue;
    }
    B.setbacks = {};
    for (const side of ['w', 'e']) {
      const Ev = evoked?.get(`${B.id}:${side}`), R = Ev ? Ev.R : streamOf(seed, 'plots', `${B.id}:${side}`), F = Ev ? Ev.F : roll(R, P.setback), cut = Ev ? fitRow(Ev.cut, L, P.plot.corner) : cutRow(P, L, R);
      B.setbacks[side] = F;
      // the row fronts its street: the west row faces west (its frontage runs south), the east row east (north)
      const ey = side === 'w' ? [1, 0] : [-1, 0], ex = [ey[1], -ey[0]], frontX = side === 'w' ? x0 : x1, startY = side === 'w' ? y1 : y0;
      let s = 0;
      // a semi pair shares its depth, its side yard and its pad; a detached house rolls its own
      const pairs = new Map();
      cut.forEach((c, k) => {
        const A = [frontX, r3(startY + ex[1] * s)], w = c.w;
        let H;
        if (c.form === 'semi') { if (!pairs.has(c.pair)) pairs.set(c.pair, { depth: roll(R, P.house.depth), side: roll(R, P.house.side) }); H = pairs.get(c.pair); }
        else H = { depth: roll(R, P.house.depth), side: roll(R, P.house.side), side2: roll(R, P.house.side) };
        const Hd = r3(Math.max(4, Math.min(H.depth, depth - F - P.back)));
        // the side yards: none at a semi's party wall; a corner's flank wider by the corner's frontage
        let sL = c.form === 'semi' ? (c.half === 'L' ? H.side : 0) : H.side, sR = c.form === 'semi' ? (c.half === 'R' ? H.side : 0) : H.side2;
        // (never so wide the house is narrower than a dwelling's least: the side yards give way first)
        const spare = Math.max(0, w - (c.corner === 'both' ? 2 : c.corner ? 1 : 0) * P.plot.corner - HOUSE_LEAST);
        if (sL + sR > spare) { const k = spare / (sL + sR); sL = r3(sL * k); sR = r3(sR * k); }
        if (c.corner === 'start' || c.corner === 'both') sL = r3(sL + P.plot.corner);
        if (c.corner === 'end' || c.corner === 'both') sR = r3(sR + P.plot.corner);
        const env = [sL, F, r3(w - sR), r3(F + Hd)], pw = Math.min(P.path, Math.max(0.6, env[2] - env[0] - 0.4));
        const pl = { id: `${B.id}-${side}${k + 1}`, block: B.id, side, k, form: c.form, ...(c.form === 'semi' ? { pair: `${B.id}-${side}p${c.pair + 1}`, half: c.half } : {}), ...(c.corner ? { corner: c.corner } : {}),
          A, ex, ey, w, d: depth, setback: F, house: { depth: Hd, sides: [sL, sR], env }, built: B.built };
        // the door's path: from the walk to the envelope's middle until a house says where its door is
        pl.path = { u: r3((env[0] + env[2]) / 2), w: r3(pw) };
        pl.alloc = { front: r3(w * F - pw * F), path: r3(pw * F), house: r3((env[2] - env[0]) * Hd), side: r3((sL + sR) * Hd), back: r3(w * (depth - F - Hd)) };
        pl.rect = toWorld(pl, [0, 0, w, depth]);
        plots.push(pl);
        s = r3(s + w);
      });
    }
  }
  // ── 6 levels: each house a pad over the walk at its front, in risers; a semi pair one pad ──
  const padOf = (wf, n) => { const Pd = P.pad, rise = Math.max(Pd.least, Math.min(Pd.most, n - wf)); return r3(wf + Math.round(rise / Pd.riser) * Pd.riser); };
  const at = (pl, u, v) => [pl.A[0] + pl.ex[0] * u + pl.ey[0] * v, pl.A[1] + pl.ex[1] * u + pl.ey[1] * v];
  const groups = new Map();
  for (const pl of plots) { const key = pl.pair ?? pl.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(pl); }
  for (const g of groups.values()) {
    // the walk at the structure's front middle (a pair's party wall), the land under its middle
    const fronts = g.map((pl) => at(pl, pl.w / 2, 0)), mids = g.map((pl) => at(pl, (pl.house.env[0] + pl.house.env[2]) / 2, pl.setback + pl.house.depth / 2));
    const wf = fronts.reduce((a, p) => a + walkZ(...p), 0) / g.length, n = mids.reduce((a, p) => a + land.N(...p), 0) / g.length, z = padOf(wf, n);
    for (const pl of g) pl.pad = z;
  }
  // the surfaces each plot allocates (its path inside its front yard: the front's own area is the yard less the path)
  for (const pl of plots) {
    const { env } = pl.house, F = pl.setback, d = pl.d, w = pl.w, pu = pl.path.u, pw = pl.path.w;
    surfaces.push({ cls: 'front', rect: toWorld(pl, [0, 0, w, F]), plot: pl.id, block: pl.block, less: 'path' });
    surfaces.push({ cls: 'path', rect: toWorld(pl, [r3(pu - pw / 2), 0, r3(pu + pw / 2), F]), plot: pl.id, block: pl.block, inside: 'front' });
    surfaces.push({ cls: 'house', rect: toWorld(pl, env), plot: pl.id, block: pl.block });
    if (env[0] > 0) surfaces.push({ cls: 'side', rect: toWorld(pl, [0, F, env[0], env[3]]), plot: pl.id, block: pl.block });
    if (env[2] < w) surfaces.push({ cls: 'side', rect: toWorld(pl, [env[2], F, w, env[3]]), plot: pl.id, block: pl.block });
    surfaces.push({ cls: 'back', rect: toWorld(pl, [0, env[3], w, d]), plot: pl.id, block: pl.block });
  }
  const ledger = ledgerOf(surfaces, blocks, frame);
  const D = { spec: T, seed, pattern: P, row, frame, depth, lengths, X, Y, streets, pieces, blocks, plots, surfaces, ledger, land };
  // an evocation stands for the town laid to scale: its measures are read against that town's (laws.js `evokes`)
  if (E) { D.evoked = { level: T.evoke, stands: { plots: ref.plots.length, blocks: ref.blocks.length }, shows: plots.length, ref: plotShares(ref) }; }
  D.laws = geotownLaws(D);
  return D;
}

/** The LEDGER: every surface's square metres, for the town, per block, and the streets' share; a path is counted out
 *  of the front yard it runs through. */
export function ledgerOf(surfaces, blocks, frame) {
  const zero = () => Object.fromEntries(SURFACE_IDS.map((k) => [k, 0]));
  const town = zero(), per = Object.fromEntries(blocks.map((b) => [b.id, zero()])), streets = zero();
  for (const s of surfaces) {
    const a = area(s.rect) * (s.inside ? 1 : 1), into = s.block ? per[s.block] : streets;
    town[s.cls] += a; into[s.cls] += a;
    if (s.inside) { town[s.inside] -= a; into[s.inside] -= a; }
  }
  const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  const total = Object.values(town).reduce((a, b) => a + b, 0);
  return { town: round(town), streets: round(streets), blocks: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, round(v)])), total: Math.round(total * 100) / 100, frame: Math.round(frame.W * frame.D * 100) / 100 };
}
