/**
 * A BOX'S SHAPES (docs/metroidvania-map.md "The shapes"): the ways a box of screens is filled by its walk, each a row.
 * The spiral (box.js) winds inward to a core; these are its siblings, each with its own role in a castle of boxes:
 *
 *   spiral       round the outside, inward ring by ring to a core                     ends inside (a destination)
 *   serpentine   row by row from the bottom left, each row turning at its end and the next run back the other way,
 *                climbing a row a turn: a bell tower, an approach up a cliff          passes through (in low, out high)
 *   hub          a centre column of shafts, the hub; the approach climbed column by column to it from the entry; its
 *                WINGS (lower right, upper right, upper left) each walked out and back to end beside the hub and return
 *                to it, each wing's prize opening the next wing's door on the hub   joins (a courtyard)
 *
 *   SHAPES                     { <id>: { read, role, axes: [lo, hi], regions } }   `axes` the share of its walk climbed or
 *                              dropped its law holds it to; `regions` what its regions are, in walk order
 *   shapeRects(shape, box, n)  → each region's cells, in walk order ([[c, r], …]), or throws, teaching (a size the shape
 *                              cannot fill)
 *   laySerpentine(M, ctx) · layHub(M, ctx)   lay the rooms and doors of a box read by box.js readBox (ctx its room, door
 *                              and walk), returning its rings' records and its entry
 *
 * Pure, no dice: a box is laid from its words alone.
 */
export const SHAPES = Object.freeze({
  spiral: Object.freeze({ read: 'round the outside, inward ring by ring to a core', role: 'destination', axes: Object.freeze([0.2, 0.6]), regions: 'rings, outermost first; the last the core' }),
  serpentine: Object.freeze({ read: 'row by row from the bottom left, each row run back the other way, climbing a row a turn', role: 'pass-through', axes: Object.freeze([0.05, 0.6]), regions: 'bands of rows, lowest first; the last the top band, its last room the end' }),
  hub: Object.freeze({ read: 'a centre column, the approach climbed to it, wings walked out and back from it, each wing\'s prize opening the next', role: 'hub', axes: Object.freeze([0.2, 0.7]), regions: 'the approach, the hub, then its wings (lower right, upper right, upper left); the last wing the core' }),
});
export const SHAPE_IDS = Object.freeze(Object.keys(SHAPES));
/** the most cells a corridor runs before it is two rooms; a shaft climbs */
const RUN = 3, SHAFT = 3;

/** a run of n cells cut into pieces of at most `most`, as even as they come, the longer first */
const pieces = (n, most) => { const k = Math.ceil(n / most), base = Math.floor(n / k), extra = n % k; return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)); };
const span = (a, b) => { const o = []; for (let k = a; a <= b ? k <= b : k >= b; k += a <= b ? 1 : -1) o.push(k); return o; };
const fail = (m) => { throw new Error(`metroidvania: ${m}`); };

/** a serpentine over a rect of rows (horizontal runs): [{ cells, row }] a row at a time, from (start col, r0), first going `dir` */
const rowsSerp = (c0, c1, r0, r1, startRight) => span(r0, r1).map((r, k) => ({ row: r, cells: ((k % 2 === 0) === startRight ? span(c0, c1) : span(c1, c0)).map((c) => [c, r]) }));
/** a serpentine over a rect of columns (vertical runs): a column at a time from (c0, r0), first going up */
const colsSerp = (c0, c1, r0, r1) => span(c0, c1).map((c, k) => ({ col: c, cells: (k % 2 === 0 ? span(r0, r1) : span(r1, r0)).map((r) => [c, r]) }));

/** Each region's cells for a shape, in walk order: a serpentine's bands, a hub's approach, hub and wings. */
export function shapeRects(shape, [cols, rows], n) {
  if (shape === 'serpentine') {
    if (cols < 3) fail(`a serpentine is three columns wide or more (a ${cols}-wide box turns before it runs)`);
    if (n > rows) fail(`a serpentine of ${rows} rows holds ${rows} bands at most, not ${n} (a band is a row or more)`);
    // (its bands as even as they come, the lower ones the taller)
    let r = 0;
    return Array.from({ length: n }, (_, k) => { const h = Math.floor(rows / n) + (k < rows % n ? 1 : 0), o = { r0: r, r1: r + h - 1 }; r += h; return o; });
  }
  if (shape === 'hub') {
    const a = (cols - 1) / 2, h = rows / 2;
    if (!(Number.isInteger(a) && a % 2 === 1 && a >= 3)) fail(`a hub is an odd number of columns whose sides are odd too (7, 11, 15): its approach is climbed column by column and must arrive beside the hub; not ${cols}`);
    if (!(Number.isInteger(h) && h % 2 === 0 && h >= 2)) fail(`a hub's rows are 4, 8 or 12 (two halves of an even height, so each wing is walked out and back to end beside the hub); not ${rows}`);
    if (n < 3 || n > 5) fail(`a hub's regions are its approach, the hub and one to three wings: three to five, not ${n}`);
    return { a, h };
  }
  return null;
}

/** THE SERPENTINE: its bands bottom to top, each row a run cut into corridors, each turn a door up at the row's end. */
export function laySerpentine(M, { room, door, rooms }) {
  const [cols, rows] = M.box, K = M.rings.length, bands = shapeRects('serpentine', M.box, K), rings = [];
  const order = rowsSerp(0, cols - 1, 0, rows - 1, true);
  for (let k = 0; k < K; k++) {
    const R = M.rings[k], { r0, r1 } = bands[k], first = rooms.length;
    rings.push({ i: k, id: R.id, place: R.place, rect: [0, cols - 1, r0, r1], ...(R.core ? { core: true } : {}) });
    for (const run of order.filter((o) => o.row >= r0 && o.row <= r1)) {
      let at = 0;
      for (const m of pieces(run.cells.length, RUN)) { room(k, run.cells.slice(at, at + m), 'corridor', 'corridor'); at += m; }
    }
    const mine = rooms.slice(first);
    for (let j = 1; j < mine.length; j++) door(mine[j - 1].id, mine[j].id, 'path', { cells: [mine[j - 1].cells.at(-1), mine[j].cells[0]] });
  }
  // the STEPS: a band's last room up into the next band's first, through its gate
  for (let k = 0; k + 1 < K; k++) door(rooms.filter((x) => x.ring === k).at(-1).id, rooms.find((x) => x.ring === k + 1).id, 'step', { gate: M.rings[k].inward });
  // the SHORTCUTS: the CHUTE, a drop straight down the box's middle column through every row to the bottom (one way:
  // the way back, landing only where the walk has been), and from each band past the first a climb up into it from the
  // band below, gated by what it finds (opened from inside)
  const mid = Math.floor(cols / 2), at = (c, r) => rooms.find((x) => x.cells.some((q) => q[0] === c && q[1] === r));
  for (let r = rows - 1; r >= 1; r--) {
    const down = at(mid, r), below = at(mid, r - 1);
    if (down && below && down !== below) door(down.id, below.id, 'shortcut', { cells: [[mid, r], [mid, r - 1]], oneWay: true });
  }
  for (let k = 1; k < K; k++) {
    const lowRow = bands[k].r0;
    const c2 = Math.max(1, mid - 2), up = at(c2, lowRow - 1), above = at(c2, lowRow), R = M.rings[k];
    if (up && above && up.ring === k - 1 && above.ring === k) door(up.id, above.id, 'shortcut', { cells: [[c2, lowRow - 1], [c2, lowRow]], gate: R.finds ? M.powers[R.finds].opens : R.inward ?? M.rings[k - 1].inward });
  }
  return { rings, entry: { cell: [0, 0], side: 'left', room: rooms[0].id }, exit: { cell: rooms.at(-1).cells.at(-1), room: rooms.at(-1).id } };
}

/** THE HUB: the approach climbed column by column to it, the hub's column of shafts, its wings out and back. */
export function layHub(M, { room, door, rooms }) {
  const [cols, rows] = M.box, K = M.rings.length, { a, h } = shapeRects('hub', M.box, K), rings = [];
  const wingRects = [[a + 1, cols - 1, 0, h - 1, true], [a + 1, cols - 1, h, rows - 1, true], [0, a - 1, h, rows - 1, false]];
  const ringOf = (k, rect) => rings.push({ i: k, id: M.rings[k].id, place: M.rings[k].place, rect, ...(M.rings[k].core ? { core: true } : {}) });
  const chain = (first) => { const mine = rooms.slice(first); for (let j = 1; j < mine.length; j++) door(mine[j - 1].id, mine[j].id, 'path', { cells: [mine[j - 1].cells.at(-1), mine[j].cells[0]] }); return mine; };
  // THE APPROACH: from the entry, column by column (up, down, up …), arriving beside the hub at the top of its half
  let first = rooms.length;
  ringOf(0, [0, a - 1, 0, h - 1]);
  for (const run of colsSerp(0, a - 1, 0, h - 1)) { let at = 0; for (const m of pieces(run.cells.length, SHAFT)) { room(0, run.cells.slice(at, at + m), 'shaft', 'shaft'); at += m; } }
  const approach = chain(first);
  // THE HUB: its lower half walked down from where the approach arrives, its upper half up from it
  first = rooms.length;
  ringOf(1, [a, a, 0, rows - 1]);
  { let at = 0; const cells = span(h - 1, 0).map((r) => [a, r]); for (const m of pieces(h, SHAFT)) { room(1, cells.slice(at, at + m), 'shaft', 'shaft'); at += m; } }
  const lowEnd = rooms.length;
  { let at = 0; const cells = span(h, rows - 1).map((r) => [a, r]); for (const m of pieces(h, SHAFT)) { room(1, cells.slice(at, at + m), 'shaft', 'shaft'); at += m; } }
  const hub = rooms.slice(first), lowHub = hub.slice(0, lowEnd - first), highHub = hub.slice(lowEnd - first);
  for (let j = 1; j < lowHub.length; j++) door(lowHub[j - 1].id, lowHub[j].id, 'path');
  for (let j = 1; j < highHub.length; j++) door(highHub[j - 1].id, highHub[j].id, 'path');
  // (the hub's halves meet at its middle: the lower half's top room to the upper half's bottom one)
  door(lowHub[0].id, highHub[0].id, 'path', { cells: [[a, h - 1], [a, h]] });
  door(approach.at(-1).id, lowHub[0].id, 'step', { cells: [[a - 1, h - 1], [a, h - 1]], gate: M.rings[0].inward });
  // THE WINGS: entered from the hub, walked out and back row by row to end beside it, and returning to it
  const hubAt = (r) => hub.find((x) => x.cells.some((q) => q[1] === r));
  for (let w = 0; w + 2 < K; w++) {
    const k = w + 2, [c0, c1, r0, r1, right] = wingRects[w];
    first = rooms.length;
    ringOf(k, [c0, c1, r0, r1]);
    for (const run of rowsSerp(c0, c1, r0, r1, right)) { let at = 0; for (const m of pieces(run.cells.length, RUN)) { room(k, run.cells.slice(at, at + m), 'corridor', 'corridor'); at += m; } }
    const wing = chain(first), near = right ? c0 : c1, side = right ? a + 1 : a - 1;
    // (its door on the hub, gated by what the region before it gives: the hub's own gate into the first wing)
    door(hubAt(r0).id, wing[0].id, 'step', { cells: [[a, r0], [near, r0]], gate: M.rings[k - 1].inward });
    // (and its end beside the hub: the wing returns to it, a way out never a way in)
    const end = wing.at(-1), endCell = end.cells.at(-1);
    if (endCell[0] === side) door(end.id, hubAt(endCell[1]).id, 'return', { cells: [endCell, [a, endCell[1]]], oneWay: true });
  }
  return { rings, entry: { cell: [0, 0], side: 'left', room: rooms[0].id } };
}
