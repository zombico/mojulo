/**
 * historic/layout-kit — what every culture's layout shares. A layout plans on a claim grid (each cell
 * claimed once) with split seeded streams (so a dressing dial never moves a street), cuts lanes, packs
 * house lots that each front a lane, and emits SLOTS that the culture's asset kit builds. What differs
 * between cultures — the frame (a walled ring and a canal, a river and a temple axis) — lives in each
 * layout; these are the pieces under it. Pure and deterministic.
 */
import { placeAsset, skinFor } from './assets/kit.js';

export const CELL = 3;                                   // claim-grid cell, metres
export const C = { EMPTY: 0, WATER: 1, WALL: 2, LANE: 3, PRECINCT: 4, HOUSE: 5, OUTSIDE: 6, OPEN: 7, REED: 8, FIELD: 9 };

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export const stream = (seed, tag) => mulberry32(hash(`${seed}|historic|${tag}`));
export const pick = (xs, rng) => xs[Math.floor(rng() * xs.length)];

/** A claim grid over a frame in metres: { cols, rows, grid, at, set }. Outside the grid reads −1. */
export function claimGrid(frame) {
  const cols = Math.floor(frame.w / CELL), rows = Math.floor(frame.d / CELL);
  const grid = new Uint8Array(cols * rows);
  const at = (c, r) => (c >= 0 && r >= 0 && c < cols && r < rows ? grid[r * cols + c] : -1);
  const set = (c, r, v) => { if (c >= 0 && r >= 0 && c < cols && r < rows) grid[r * cols + c] = v; };
  return { cols, rows, grid, at, set };
}

/**
 * Ground strips that overlap a hair to close the page's seams must not share a plane: the WebGL World's
 * de-overlap pass lifts each face one step (scaled by its size) above every coplanar face it overlaps,
 * so a run of overlapping strips stacks into a slope. Overlapping pieces go `LAYER` metres apart —
 * enough to be another plane to that pass, too little to see.
 */
export const LAYER = 0.004;
/** A lane strip's height: its surface (0, 1, 2) and row parity each get their own layer. */
export const laneZ = (surface, r) => 0.02 + LAYER * (2 * surface + (r % 2));

/** Row runs of cells matching `test`, as (c, r, n). */
export function runs(grid, cols, rows, test, emit) {
  for (let r = 0; r < rows; r++) {
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const ok = c < cols && test(grid[r * cols + c], c, r);
      if (ok && start < 0) start = c;
      if (!ok && start >= 0) { emit(start, r, c - start); start = -1; }
    }
  }
}

/**
 * The block alleys: a loose lattice of narrow lanes (`block` = [rows, cols] apart), jogging a cell now
 * and then (`jog` per cell), carved only through EMPTY cells, so no block is more than two houses deep
 * and every house fronts a lane you can walk down.
 */
export function alleyLattice(g, block, seed, laneCells = [], { jog = 0.08 } = {}) {
  const [br, bc] = block, BL = stream(seed, 'blocks'), { at, set, rows, cols } = g;
  const line = (n, len, across, cellAt) => {
    for (let base = Math.floor(BL() * across) + across; base < n - 1; base += across) {
      let off = 0;
      for (let t = 0; t < len; t++) {
        if (BL() < jog) {   // a jog: step over a cell, carving the corner so the alley stays continuous
          const step = BL() < 0.5 ? 1 : -1;
          if (Math.abs(off + step) <= 1) { const [c, r] = cellAt(base + off, t); if (at(c, r) === C.EMPTY) { set(c, r, C.LANE); laneCells.push([c, r]); } off += step; }
        }
        const [c, r] = cellAt(base + off, t);
        if (at(c, r) === C.EMPTY) { set(c, r, C.LANE); laneCells.push([c, r]); }
      }
    }
  };
  line(rows, cols, br, (r, c) => [c, r]);   // east–west alleys
  line(cols, rows, bc, (c, r) => [c, r]);   // north–south alleys
  return laneCells;
}

/**
 * Pack the EMPTY cells (or those `free` accepts) with house lots sized from `size` [min, max] metres,
 * laid in reading order so each grows to full size against its neighbours. A sliver (under two cells
 * either way) is left open ground. Returns [{ c0, r0, w, d }] in cells.
 */
export function packLots(g, size, seed, { free = (v) => v === C.EMPTY } = {}) {
  const { at, set, cols, rows } = g, LOT = stream(seed, 'lots'), lots = [];
  const colFree = (c, r, d) => { for (let k = 0; k < d; k++) if (!free(at(c, r + k), c, r + k)) return false; return true; };
  const rowFree = (c, r, w) => { for (let k = 0; k < w; k++) if (!free(at(c + k, r), c + k, r)) return false; return true; };
  for (let r0 = 0; r0 < rows; r0++) for (let c0 = 0; c0 < cols; c0++) {
    if (!free(at(c0, r0), c0, r0)) continue;
    const tw = Math.round((size[0] + LOT() * (size[1] - size[0])) / CELL), td = Math.round((size[0] + LOT() * (size[1] - size[0])) / CELL);
    let w = 1, d = 1;
    while (w < tw && colFree(c0 + w, r0, d)) w++;
    while (d < td && rowFree(c0, r0 + d, w)) d++;
    if (w < 2 || d < 2) { for (let r = r0; r < r0 + d; r++) for (let c = c0; c < c0 + w; c++) set(c, r, C.OPEN); continue; }   // a sliver is no house: leave it open ground
    for (let r = r0; r < r0 + d; r++) for (let c = c0; c < c0 + w; c++) set(c, r, C.HOUSE);
    lots.push({ c0, r0, w, d });
  }
  return lots;
}

/**
 * A lot → its house slot: it faces the side with the most lane along it (the door is on the street)
 * and stands `gap` metres in from its lot line so neighbours read apart. `assetFor(rect)` picks the house.
 */
export function lotSlot(g, { c0, r0, w, d }, gap, assetFor) {
  const { at } = g, open = (c, r) => { const v = at(c, r); return v === C.LANE || v === C.OPEN; };
  const side = { n: 0, s: 0, w: 0, e: 0 };
  for (let k = 0; k < w; k++) { side.n += open(c0 + k, r0 - 1); side.s += open(c0 + k, r0 + d); }
  for (let k = 0; k < d; k++) { side.w += open(c0 - 1, r0 + k); side.e += open(c0 + w, r0 + k); }
  const facing = ['s', 'n', 'e', 'w'].reduce((best, f) => (side[f] > side[best] ? f : best), 's');
  const rect = { x: c0 * CELL + gap, y: r0 * CELL + gap, w: w * CELL - 2 * gap, d: d * CELL - 2 * gap };
  return { asset: assetFor(rect), rect, facing };
}

/** Build every slot with the culture's kit, each on its own dressing stream; skin the loose masses. */
export function placeSlots(slots, kit, K, seed, boxes, grounds, culture) {
  for (const [i, slot] of slots.entries()) {
    const A = kit[slot.asset];
    if (!A) throw new Error(`no asset '${slot.asset}' in the ${culture} kit`);
    const placed = placeAsset(A, slot, { palette: K.palette, culture: K, rng: stream(seed, `asset|${i}`) });
    boxes.push(...placed.boxes); grounds.push(...placed.grounds);
  }
}
export function skinLoose(boxes, K) { for (const b of boxes) if (b.skin === undefined) { const skin = skinFor(K, b); if (skin) b.skin = skin; } }
