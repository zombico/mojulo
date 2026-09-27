// CELL archetypes — the store's sub-PROGRAM. Each is a declaration row (the RELATIONSHIPS
// shape: minDim, reachVia, mustNotTouch, …), never a builder: structurizeFloorplan owns the
// walls, doors and slab. `subProgram` cuts the unit's BACK BAND into these cells and returns
// the remaining open floor as the sales-floor rect the zones map onto.
//
// Sizes are feet. `depth`/`width` are the natural cell size; `grow` caps how far the band's
// slack may widen a cell (a fitting room stays a fitting room; a stock room absorbs the rest).

import { partitionWeighted } from '../polygonizer/floorplan-glyphs.js';
import { unitFrame } from './store-frame.js';

export const CELL_ARCHETYPES = {
  fittingRoom: { depth: 5.5, width: 4.2, minDim: 3.6, grow: 1.4, door: { kind: 'hinged', width: 2.6 }, reachVia: 'salesFloor', mustNotTouch: ['glass'], exposure: 3, glyph: 'S', furnish: ['fittingBench', 'mirror'] },
  stockRoom:   { depth: 9,   width: 8,   minDim: 6,   grow: Infinity, door: { kind: 'hinged', width: 3 }, reachVia: 'staff', mustNotTouch: ['glass'], exposure: 3, glyph: 'S', furnish: ['stockShelf'] },
  booth:       { depth: 6.5, width: 6.5, minDim: 5,   grow: 1.6, door: { kind: 'cased', open: 0.72 }, reachVia: 'salesFloor', mustNotTouch: ['glass'], exposure: 2, glyph: 'D', furnish: ['boothSeat'] },
  restroom:    { depth: 7.5, width: 6,   minDim: 5,   grow: 1.5, door: { kind: 'hinged', width: 2.8 }, reachVia: 'salesFloor', mustNotTouch: ['glass', 'service'], exposure: 3, glyph: 'W', furnish: ['toilet', 'vanity'] },
};

/** Expand the card's `cells` into an ordered list of single cells (left → right as you walk in). */
export function expandCells(cells = []) {
  const out = [];
  for (const c of cells) {
    const row = CELL_ARCHETYPES[c.archetype];
    const n = c.count ?? 1;
    for (let i = 0; i < n; i += 1) out.push({ archetype: c.archetype, row, minArea: c.minArea });
  }
  return out;
}

/**
 * Cut the unit into { cells, sales } in the unit's own frame.
 * unitRect: world {x0,x1,y0,y1} on wall centerlines; front: glass side.
 * keepClear: lateral spans [l0, l1] (feet) of the BACK band that stay open floor — an anchor's
 * street entrance lands in the band, so no cell may sit on it. Cells first-fit, in card order,
 * into the band intervals between those spans.
 * Returns world rooms + doors ready for structurizeFloorplan, plus the frames and a record of
 * what was shed (graceful degradation: booths go first, then restroom, then fitting rooms).
 */
export function subProgram(unitRect, front, card, { rng = () => 0.5, keepClear = [] } = {}) {
  const U = unitFrame(unitRect, front);
  let list = expandCells(card.cells);
  const shed = [];
  const maxBand = U.D * 0.38;
  const natW = (c, bd) => Math.max(c.row.width, c.minArea ? c.minArea / bd : 0);
  const bandDepthOf = (l) => Math.min(maxBand, Math.max(0, ...l.map((c) => Math.max(c.row.depth, c.minArea ? Math.sqrt(c.minArea) : 0))));
  // the band's usable intervals: [0, W] minus the keep-clear spans
  const clear = keepClear.map(([a, b]) => [Math.max(0, a), Math.min(U.W, b)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const intervals = [];
  let at = 0;
  for (const [a, b] of clear) { if (a > at) intervals.push([at, a]); at = Math.max(at, b); }
  if (at < U.W) intervals.push([at, U.W]);
  // first-fit, in card order; null when some cell finds no room
  const assign = (l, bd) => {
    const fill = intervals.map(() => 0), out = intervals.map(() => []);
    for (const c of l) {
      const k = intervals.findIndex(([a, b], i) => fill[i] + natW(c, bd) <= b - a + 1e-9);
      if (k < 0) return null;
      fill[k] += natW(c, bd); out[k].push(c);
    }
    return out;
  };
  // shed in degradation order until every cell fits
  const SHED_ORDER = ['booth', 'restroom', 'fittingRoom', 'stockRoom'];
  for (;;) {
    if (!list.length || assign(list, bandDepthOf(list))) break;
    const kind = SHED_ORDER.find((k) => list.some((c) => c.archetype === k));
    const idx = list.map((c) => c.archetype).lastIndexOf(kind);
    shed.push(list[idx].archetype);
    list = list.filter((_, i) => i !== idx);
  }
  const rooms = [], doors = [], cells = [];
  const edge = front === 'S' || front === 'N' ? 'N' : 'E';
  const openStrip = (x0, x1, y0) => {
    // open band floor: its own cell joined to the sales floor by a full-width cased opening
    const w = U.aabb({ x0, x1, y0, y1: U.D });
    rooms.push({ x: w.x0, y: w.y0, w: w.x1 - w.x0, h: w.y1 - w.y0, glyph: 'L', role: 'salesFloor' });
    const [dx, dy] = U.toWorld((x0 + x1) / 2, y0);
    doors.push({ x: dx, y: dy, edge, kind: 'cased', width: x1 - x0 - 0.6 });
  };
  let salesLocal = { x0: 0, x1: U.W, y0: 0, y1: U.D };
  if (list.length) {
    const bd = bandDepthOf(list);
    const y0 = U.D - bd;
    const groups = assign(list, bd);
    intervals.forEach(([ia, ib], gi) => {
      const g = groups[gi];
      if (!g.length) { openStrip(ia, ib, y0); return; }
      // widths: natural, then the interval's slack spread over growable cells (capped by `grow`)
      const widths = g.map((c) => natW(c, bd));
      let slack = (ib - ia) - widths.reduce((a, b) => a + b, 0);
      for (let pass = 0; pass < 4 && slack > 0.01; pass += 1) {
        const open = g.map((c, i) => (widths[i] < natW(c, bd) * c.row.grow - 1e-6 ? i : -1)).filter((i) => i >= 0);
        if (!open.length) break;
        const wsum = open.reduce((a, i) => a + widths[i], 0);
        let used = 0;
        for (const i of open) {
          const cap = natW(g[i], bd) * g[i].row.grow;
          const add = Math.min(cap - widths[i], slack * (widths[i] / wsum));
          widths[i] += add; used += add;
        }
        slack -= used;
      }
      const total = widths.reduce((a, b) => a + b, 0);
      const segs = partitionWeighted(total, widths, rng, g.map((c) => c.row.minDim));
      g.forEach((c, i) => {
        const a = ia + segs[i][0], b = ia + segs[i][1];
        const local = { x0: a, x1: b, y0, y1: U.D };
        const w = U.aabb(local);
        const dw = c.row.door.width ?? (b - a) * c.row.door.open;
        const [dx, dy] = U.toWorld((a + b) / 2, y0);
        rooms.push({ x: w.x0, y: w.y0, w: w.x1 - w.x0, h: w.y1 - w.y0, glyph: c.row.glyph, role: c.archetype });
        doors.push({ x: dx, y: dy, edge, kind: c.row.door.kind, width: Math.min(dw, b - a - 0.8) });
        cells.push({ archetype: c.archetype, local, world: w, door: { local: [(a + b) / 2, y0], world: [dx, dy], width: Math.min(dw, b - a - 0.8) } });
      });
      // any slack left (nothing growable) stays OPEN floor at the interval's right end
      if (ia + total < ib - 0.5) openStrip(ia + total, ib, y0);
    });
    for (const [a, b] of clear) openStrip(a, b, y0);
    salesLocal = { x0: 0, x1: U.W, y0: 0, y1: y0 };
  }
  const sw = U.aabb(salesLocal);
  rooms.unshift({ x: sw.x0, y: sw.y0, w: sw.x1 - sw.x0, h: sw.y1 - sw.y0, glyph: 'L', role: 'salesFloor' });
  return { unit: U, rooms, doors, cells, salesLocal, salesWorld: sw, shed };
}
