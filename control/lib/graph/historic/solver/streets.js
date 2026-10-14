/**
 * historic/solver/streets — the town's streets: the pattern its main streets are laid in, then the alleys that keep
 * every block shallow, then the bridges where a main street meets a canal. STREETS is keyed by the form's
 * `streets.pattern`; the form's schema reads its words from here.
 */
import { CELL, C, stream, alleyLattice } from '../layout-kit.js';
import { toward, opposite } from './site.js';

/**
 * The patterns, by `streets.pattern`. `lay(X)` lays the main streets; `alleys(X)` the alleys after them (by default
 * an alley lattice at the block's size, jogged by `streets.jog`).
 */
export const STREETS = Object.freeze({
  meander: { read: 'a meander from the gates to the heart', lay: meander },
  lattice: { read: 'through streets every `crossEvery`, lined up on the monument', lay: (X) => gridLines(X, 'lattice') },
  grid: {
    read: 'an orthogonal grid, every third street a main one, lined up on the monument',
    lay: (X) => { if (!X.ENC.plans) gridLines(X, 'grid'); },
    // the grid is its own alleys; walled wards (which plan the grid themselves) take theirs at half a block, unjogged
    alleys: (X) => { if (X.ENC.plans) alleyLattice(X.g, [Math.max(2, Math.round(X.by / CELL / 2)), Math.max(2, Math.round(X.bx / CELL / 2))], X.seed, X.laneCells, { jog: 0 }); },
  },
  contour: { read: 'streets along the contours, stairs climbing between them', lay: contour },
});

const defaultAlleys = (X) => alleyLattice(X.g, [Math.max(2, Math.round(X.by / CELL)), Math.max(2, Math.round(X.bx / CELL))], X.seed, X.laneCells, { jog: X.S.jog ?? 0.06 });

/** The streets: the pattern's main streets, the alleys, the canal's bridges. */
export function layStreets(X) {
  const { F, gate, gateSide, cellOf } = X;
  const S = X.S = F.streets;
  X.mainW = Math.max(1, Math.round(S.main / CELL)); [X.bx, X.by] = S.block ?? [24, 24];
  X.precinctGateCell = cellOf(gate[0] + toward(gateSide)[0] * (CELL * 1.5), gate[1] + toward(gateSide)[1] * (CELL * 1.5));
  const rule = STREETS[S.pattern];
  rule.lay(X);
  (rule.alleys ?? defaultAlleys)(X);
  canalBridges(X);
}

/** A straight line of lane cells, `widthCells` across, from `from` to `to` along a row (horiz) or a column. */
const line = (X, horiz, pos, from, to, widthCells, main) => {
  for (let t = from; t <= to; t++) for (let k = 0; k < widthCells; k++) { const c = horiz ? t : pos + k, r = horiz ? pos + k : t; X.lane(c, r, main); }
};

function meander(X) {
  // from each gate (or, unwalled, the town's edge) a biased walk to the precinct's gate
  const { gates, townCentre, tw, td, ext, cellOf, at, lane, laneCells, mainW, precinctGateCell, water, cols, rows, S, seed, approach } = X;
  const starts = gates.length ? gates : [0, 1, 2, 3].map((k) => { const th = k * 1.571 + 0.4; return cellOf(townCentre[0] + Math.cos(th) * tw * 0.42 * ext[0], townCentre[1] + Math.sin(th) * td * 0.42 * ext[1]); });
  const LL = stream(seed, 'lanes'), canalCells = [];
  let crossed = false;
  const carve = (c, r) => { for (let k = 0; k < mainW; k++) for (let j = 0; j < mainW; j++) { const v = at(c + k, r + j); if (v === C.EMPTY || v === C.OPEN || v === C.LANE) lane(c + k, r + j, 1, [C.EMPTY, C.OPEN]); else if (v === C.WATER && !crossed) { canalCells.push([c + k, r + j]); crossed = true; } } };
  for (const from of starts) {
    let [c, r] = from; const to = precinctGateCell; crossed = false;
    for (let s = 0; s < 4000; s++) {
      carve(c, r);
      const dc = to[0] - c, dr = to[1] - r;
      if (Math.abs(dc) + Math.abs(dr) <= 1 || at(c, r) === C.PRECINCT) break;
      const u = LL();
      if (u < 0.62) { if (Math.abs(dc) > Math.abs(dr)) c += Math.sign(dc); else r += Math.sign(dr); }
      else if (u < 0.86) { if (Math.abs(dc) > Math.abs(dr)) r += Math.sign(dr || (LL() < 0.5 ? 1 : -1)); else c += Math.sign(dc || (LL() < 0.5 ? 1 : -1)); }
      else if (LL() < 0.5) c += LL() < 0.5 ? 1 : -1; else r += LL() < 0.5 ? 1 : -1;
      if (at(c, r) === C.OUTSIDE || at(c, r) === -1) break;
    }
  }
  // a quay lane along each bank of a canal, inside the town
  if (water.kind === 'canal') for (let c = 0; c < cols; c++) for (let r = 1; r < rows - 1; r++) if (at(c, r) === C.EMPTY && (at(c, r - 1) === C.WATER || at(c, r + 1) === C.WATER)) lane(c, r, 1);
  for (let i = 0; i < (S.branches ?? 0) && laneCells.length; i++) {
    const [c, r] = laneCells[Math.floor(LL() * laneCells.length)], len = 5 + Math.floor(LL() * 13), horiz = LL() < 0.5, dir = LL() < 0.5 ? 1 : -1;
    let cc = c, rr = r;
    for (let s = 0; s < len; s++) { if (horiz) cc += dir; else rr += dir; if (LL() < 0.18) { if (horiz) rr += LL() < 0.5 ? 1 : -1; else cc += LL() < 0.5 ? 1 : -1; } const v = at(cc, rr); if (v !== C.EMPTY && v !== C.LANE) break; lane(cc, rr); }
  }
  approach.crossings = canalCells;
}

function gridLines(X, pattern) {
  // streets every block (a grid) or every `crossEvery` (a lattice's through streets), lined up on the armature
  const { S, ax, ay, frame, rows, cols, mainW, bx, by } = X;
  const [gx, gy] = pattern === 'grid' ? [bx, by] : [S.crossEvery ?? 90, S.crossEvery ?? 90];
  const altW = Math.max(1, Math.round((pattern === 'grid' ? S.alley ?? 3 : S.main) / CELL));
  for (let x = ax - Math.ceil((ax) / gx) * gx; x < frame.w; x += gx) { const main = pattern === 'lattice' || Math.round((x - ax) / gx) % 3 === 0; line(X, false, Math.floor(x / CELL), 0, rows - 1, main ? mainW : altW, main); }
  for (let y = ay - Math.ceil((ay) / gy) * gy; y < frame.d; y += gy) { const main = pattern === 'lattice' || Math.round((y - ay) / gy) % 3 === 0; line(X, true, Math.floor(y / CELL), 0, cols - 1, main ? mainW : altW, main); }
}

function contour(X) {
  // a street along the foot of every terrace, a stair street climbing every block
  const { F, S, site, mid, at, lane, rows, cols, ax, ay, bx, slots } = X;
  const lv = (c, r) => { const [x, y] = mid(c, r); return site.base(x, y); };
  const [hdx, hdy] = toward(F.site.high ?? 'n');
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === C.EMPTY || at(c, r) === C.OPEN) { const up = lv(c + hdx, r + hdy); if (up - lv(c, r) > 0.3) lane(c, r, 1, [C.EMPTY, C.OPEN]); }
  const horiz = hdx !== 0, stairs = [];
  for (let p = Math.floor(((horiz ? ay : ax) % bx) / CELL); p < (horiz ? rows : cols); p += Math.max(2, Math.round(bx / CELL))) {
    for (let t = 0; t < (horiz ? cols : rows); t++) {
      const [c, r] = horiz ? [t, p] : [p, t], v = at(c, r);
      if (v !== C.EMPTY && v !== C.OPEN && v !== C.LANE) continue;
      lane(c, r, 0, [C.EMPTY, C.OPEN]);
      const [c2, r2] = [c + hdx, r + hdy], rise = lv(c2, r2) - lv(c, r);
      if (S.stairs && rise > 0.3 && (at(c2, r2) === C.EMPTY || at(c2, r2) === C.LANE)) stairs.push({ c, r, rise });
    }
  }
  for (const q of stairs) {
    const rect = { x: q.c * CELL, y: q.r * CELL, w: CELL, d: CELL };
    slots.push({ asset: S.stairs, rect, facing: opposite(F.site.high ?? 'n'), z: lv(q.c, q.r), rise: q.rise });
  }
}

/** Canal bridges: where a main street met the canal. */
function canalBridges(X) {
  const { F, water, approach, slots } = X;
  if (!(water.kind === 'canal' && F.water.bridge && approach.crossings?.length)) return;
  const seen = new Set();
  for (const [c0] of approach.crossings) {
    if ([...seen].some((c) => Math.abs(c - c0) < 4)) continue;
    seen.add(c0);
    const x = c0 * CELL, w = 7, yN = water.centre(x + w / 2) - water.width / 2, yS = yN + water.width, reach = 9;
    slots.push({ asset: F.water.bridge, rect: { x, y: yN - reach, w, d: yS - yN + 2 * reach }, facing: 'n', span: { y0: reach, y1: reach + yS - yN }, waterZ: water.z, z: 0 });
  }
}
