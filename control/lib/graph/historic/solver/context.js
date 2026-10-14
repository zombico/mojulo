/**
 * historic/solver/context — what every layer of a solve shares: the culture, its form and kit, the claim grid over the
 * frame, the lists the layers fill (slots, boxes, grounds, builds, notes), the lanes and how to lay them. Each layer
 * (./armature.js, ./enclosure.js, ./streets.js, ./placement.js, ./land.js, ./views.js, ./emit.js, ./laws.js) reads
 * and writes this one object, `X`, in the order ./index.js calls them.
 */
import { HISTORIC_CULTURES } from '../cultures/index.js';
import { CELL, C, claimGrid } from '../layout-kit.js';
import { toward } from './site.js';

export const r2 = (v) => Math.round(v * 100) / 100;
export const centre = (r) => [r.x + r.w / 2, r.y + r.d / 2];
export const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, d: r.d + 2 * m });
export const meets = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
export const rectFor = (cx, cy, w, d, facing) => (facing === 'e' || facing === 'w' ? { x: cx - d / 2, y: cy - w / 2, w: d, d: w } : { x: cx - w / 2, y: cy - d / 2, w, d });
/** The side of `from` that `to` lies on (the dominant axis). */
export const sideToward = ([fx, fy], [tx, ty]) => (Math.abs(tx - fx) > Math.abs(ty - fy) ? (tx > fx ? 'e' : 'w') : (ty > fy ? 's' : 'n'));
/** The middle of a rect's `side` edge. */
export const frontEdge = (r, side) => ({ n: [r.x + r.w / 2, r.y], s: [r.x + r.w / 2, r.y + r.d], w: [r.x, r.y + r.d / 2], e: [r.x + r.w, r.y + r.d / 2] })[side];
/** The middle of an asset's size envelope, [w, d] metres. */
export function envelopeMid(A) {
  const e = A?.envelope;
  return e ? [(e.w[0] + e.w[1]) / 2, (e.d[0] + e.d[1]) / 2] : [6, 6];
}

/** A solve's shared state: the frame and its grid, the kit, the lists the layers fill, the lane tools. */
export function solveContext({ culture, seed, view, focus, F }) {
  const K = HISTORIC_CULTURES[culture], P = K.palette;
  const kit = Object.assign({}, ...(F.borrow || []).map((b) => HISTORIC_CULTURES[b]?.assets || {}), K.assets || {});
  const borrowed = Object.fromEntries((F.borrow || []).flatMap((b) => Object.keys(HISTORIC_CULTURES[b]?.assets || {}).filter((a) => !(K.assets || {})[a]).map((a) => [a, b])));
  const [tw, td] = F.frame.town, [fw, fd] = view === 'city' ? [tw, td] : F.frame.region;
  const frame = { w: fw, d: fd }, town = { x: (fw - tw) / 2, y: (fd - td) / 2, w: tw, d: td };
  const g = claimGrid(frame), { cols, rows, at, set, grid } = g;
  const mid = (c, r) => [(c + 0.5) * CELL, (r + 0.5) * CELL];
  const cellOf = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)];
  const claimRect = (r, v, ok = () => true) => { for (let rr = Math.floor(r.y / CELL); rr < Math.ceil((r.y + r.d) / CELL); rr++) for (let c = Math.floor(r.x / CELL); c < Math.ceil((r.x + r.w) / CELL); c++) if (ok(at(c, rr))) set(c, rr, v); };
  const rectCells = (r) => { const out = []; for (let rr = Math.floor(r.y / CELL); rr < Math.ceil((r.y + r.d) / CELL); rr++) for (let c = Math.floor(r.x / CELL); c < Math.ceil((r.x + r.w) / CELL); c++) out.push(at(c, rr)); return out; };
  const free = (r, ok) => { const cs = rectCells(r); return cs.length > 0 && cs.every(ok); };

  // a lane cell, and a straight strip of lane from a point toward a side, `width` across, until `stop` holds or `len`
  // runs out; the strip returns its cells' rect and claims them (main surface)
  const surf = new Uint8Array(cols * rows);   // 1 = a main street, 0 = an alley
  const laneCells = [];
  const lane = (c, r, main = 0, over = [C.EMPTY, C.OPEN]) => { const v = at(c, r); if (over.includes(v)) { set(c, r, C.LANE); laneCells.push([c, r]); if (main) surf[r * cols + c] = 1; return true; } return v === C.LANE; };
  const strip = ([x0, y0], side, width, { len = Infinity, stop = () => false, over } = {}) => {
    const [dx, dy] = toward(side), half = width / 2;
    let s = 0;
    for (; s < len; s += CELL / 2) {
      const x = x0 + dx * s, y = y0 + dy * s;
      if (x < 0 || y < 0 || x > frame.w || y > frame.d || stop(x, y)) break;
      for (let k = -half + CELL / 2; k <= half - CELL / 2 + 1e-9; k += CELL) { const [c, r] = cellOf(x + (dy ? k : 0), y + (dx ? k : 0)); lane(c, r, 1, over); }
    }
    const x1 = x0 + dx * s, y1 = y0 + dy * s;
    return dx ? { x: Math.min(x0, x1), y: y0 - half, w: Math.abs(x1 - x0), d: width } : { x: x0 - half, y: Math.min(y0, y1), w: width, d: Math.abs(y1 - y0) };
  };

  return {
    culture, seed, view, focus, K, F, P, kit, borrowed,
    frame, town, tw, td, g, cols, rows, at, set, grid, mid, cellOf, claimRect, rectCells, free,
    surf, laneCells, lane, strip,
    slots: [], boxes: [], grounds: [], builds: [], notes: [], monuments: [], placed: [], gates: [],
    approach: { avenue: null, way: null, quay: null },
  };
}
