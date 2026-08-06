/**
 * philosophers stone core — a cute-alchemy match-3 as a pure reducer.
 *
 * Same discipline as brickster-core / doctor-pill-core: the whole game is
 * step(state, action) → state, seeded dice carried in the state, no DOM, no
 * clock, no Math.random. The board is a W×H grid of cells
 * (null | { c, kind }); you SWAP two adjacent reagents, runs of 3+ of a color
 * DISSOLVE, the column drops and REFILLS from the top, and the refill can
 * cascade. Bigger matches PROMOTE the swapped tile into an alchemical product
 * with an effect:
 *   - a straight 4        → Aqua Vitae  (kind:'line', axis) — clears its row/col
 *   - an L/T of 5         → Athanor     (kind:'area')       — bursts a 3×3
 *   - a straight 5        → Philosopher's Stone (kind:'stone') — a rainbow bomb:
 *                           swap it onto a reagent to transmute that whole color
 *                           off the board.
 *
 * Cascade is the data model, not a special case: match → clear → gravity →
 * top-refill → re-match, looped until still (doctor-pill's resolveBoard shape,
 * plus refill). A promoted tile caught in a later match DETONATES, and a
 * detonation feeds back into the same loop, so chains fall out of the loop.
 *
 * Invariants held here (proven in the tests):
 *   - seed + input sequence → byte-identical board (RNG carried in state).
 *   - the spawn board has NO pre-existing match.
 *   - a legal move always exists — a settle that deadlocks reshuffles (seeded).
 */

export const DEFAULT_W = 8;
export const DEFAULT_H = 8;
export const DEFAULT_REAGENTS = 6; // Cinnabar, Sulfur, Vitriol, Verdigris, Azurite, Amethyst

const BONUS = { line: 25, area: 50, stone: 100 };

// Timed mode ("Alchemist's Trial"): each level demands a higher score in a
// shorter window. Cross the target → the clock refills at the next level's
// (shorter) cap; let it hit zero first → you lose. Both curves are tunable.
export const levelTargetFor = (lvl) => 1000 + (lvl - 1) * 600;
export const levelTimeMsFor = (lvl) => Math.max(20, 60 - (lvl - 1) * 5) * 1000;

/** mulberry32 as a pure step: rngState → [float 0..1, nextState]. */
export function rngNext(s) {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

const emptyGrid = (W, H) => Array.from({ length: H }, () => new Array(W).fill(null));
const cloneGrid = (g) => g.map((row) => row.map((c) => (c ? { ...c } : null)));
const key = ({ x, y }) => `${x},${y}`;
const parse = (k) => k.split(',').map(Number);
const dimsOf = (s) => ({ W: s.W, H: s.H, reagents: s.reagents });

/** The color a cell matches on. Stones are colorless (they never run-match). */
const colorOf = (cell) => (cell && cell.kind !== 'stone' ? cell.c : null);
const isSpecial = (cell) => cell && (cell.kind === 'line' || cell.kind === 'area');

const inBounds = (x, y, { W, H }) => x >= 0 && x < W && y >= 0 && y < H;
const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/** Fill an empty grid so no run of 3 exists (row-major: only left/up are set). */
function seedFill(grid, rngState, dims) {
  const { W, H, reagents } = dims;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const forbidden = new Set();
      if (x >= 2 && grid[y][x - 1].c === grid[y][x - 2].c) forbidden.add(grid[y][x - 1].c);
      if (y >= 2 && grid[y - 1][x].c === grid[y - 2][x].c) forbidden.add(grid[y - 1][x].c);
      const allowed = [];
      for (let c = 0; c < reagents; c++) if (!forbidden.has(c)) allowed.push(c);
      let r;
      [r, rngState] = rngNext(rngState);
      grid[y][x] = { c: allowed[Math.floor(r * allowed.length)], kind: 'gem' };
    }
  }
  return [grid, rngState];
}

/** Keys of every cell that sits in a run of 3+ same-color cells (row or col). */
export function matchedKeys(grid, dims) {
  const { W, H } = dims;
  const hits = new Set();
  const scan = (line) => {
    let run = [];
    const flush = () => {
      if (run.length >= 3) for (const k of run) hits.add(k);
      run = [];
    };
    let prev = null;
    for (const [x, y] of line) {
      const c = colorOf(grid[y][x]);
      if (c === null) { flush(); prev = null; continue; }
      if (prev !== null && c !== prev) flush();
      run.push(`${x},${y}`);
      prev = c;
    }
    flush();
  };
  for (let y = 0; y < H; y++) scan(Array.from({ length: W }, (_, x) => [x, y]));
  for (let x = 0; x < W; x++) scan(Array.from({ length: H }, (_, y) => [x, y]));
  return hits;
}

/** Group matched keys into orthogonally-connected same-color components. */
function componentsFrom(keys, grid) {
  const set = new Set(keys);
  const seen = new Set();
  const comps = [];
  for (const start of keys) {
    if (seen.has(start)) continue;
    const [sx, sy] = parse(start);
    const color = colorOf(grid[sy][sx]);
    const cells = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const cur = stack.pop();
      const [x, y] = parse(cur);
      cells.push({ x, y });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${x + dx},${y + dy}`;
        if (set.has(nk) && !seen.has(nk) && colorOf(grid[y + dy]?.[x + dx]) === color) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    comps.push({ cells, color });
  }
  return comps;
}

/**
 * Classify a component's shape into an alchemical product + where it mints.
 * straight-5 → stone; a bend with both arms ≥3 → area; straight-4 → line;
 * else plain (just clears). Mint at the swapped cell when this came from a
 * swap; otherwise the intersection (area) or the top-left cell.
 */
function classify(comp, swapped) {
  const member = new Set(comp.cells.map((c) => `${c.x},${c.y}`));
  const has = (x, y) => member.has(`${x},${y}`);
  const runLen = (x, y, dx, dy) => {
    let n = 1;
    for (let i = 1; has(x - dx * i, y - dy * i); i++) n++;
    for (let i = 1; has(x + dx * i, y + dy * i); i++) n++;
    return n;
  };
  let maxH = 0;
  let maxV = 0;
  let inter = null;
  for (const { x, y } of comp.cells) {
    const h = runLen(x, y, 1, 0);
    const v = runLen(x, y, 0, 1);
    if (h > maxH) maxH = h;
    if (v > maxV) maxV = v;
    if (h >= 3 && v >= 3 && (!inter || y < inter.y || (y === inter.y && x < inter.x))) inter = { x, y };
  }

  let kind = 'plain';
  let axis;
  if (maxH >= 5 || maxV >= 5) kind = 'stone';
  else if (maxH >= 3 && maxV >= 3 && inter) kind = 'area';
  else if (maxH >= 4 || maxV >= 4) { kind = 'line'; axis = maxH >= 4 ? 'h' : 'v'; }

  let mintAt = null;
  if (kind !== 'plain') {
    const swappedIn = swapped.find((s) => member.has(`${s.x},${s.y}`));
    if (swappedIn) mintAt = { x: swappedIn.x, y: swappedIn.y };
    else if (kind === 'area') mintAt = inter;
    else mintAt = comp.cells.reduce((a, c) => (c.y < a.y || (c.y === a.y && c.x < a.x) ? c : a));
  }
  return { kind, axis, mintAt, color: comp.color };
}

/** The cells a detonating special clears. gem / caught-stone clear only self. */
function footprint(cell, x, y, { W, H }) {
  const out = [];
  if (cell.kind === 'line') {
    if (cell.axis === 'h') for (let i = 0; i < W; i++) out.push(`${i},${y}`);
    else for (let j = 0; j < H; j++) out.push(`${x},${j}`);
  } else if (cell.kind === 'area') {
    for (let j = y - 1; j <= y + 1; j++) {
      for (let i = x - 1; i <= x + 1; i++) if (i >= 0 && i < W && j >= 0 && j < H) out.push(`${i},${j}`);
    }
  } else {
    out.push(`${x},${y}`);
  }
  return out;
}

/** Grow `clear` by chain-detonating any line/area tiles caught inside it. */
function expandDetonations(grid, clear, protectedSet, dims) {
  const queue = [];
  for (const k of clear) {
    const [x, y] = parse(k);
    if (isSpecial(grid[y][x])) queue.push(k);
  }
  const done = new Set();
  while (queue.length) {
    const k = queue.pop();
    if (done.has(k)) continue;
    done.add(k);
    const [x, y] = parse(k);
    const cell = grid[y][x];
    if (!cell) continue;
    for (const fk of footprint(cell, x, y, dims)) {
      if (protectedSet.has(fk) || clear.has(fk)) continue;
      clear.add(fk);
      const [fx, fy] = parse(fk);
      if (isSpecial(grid[fy][fx])) queue.push(fk);
    }
  }
}

/** Drop every column to the floor and refill the top from the seeded stream. */
function gravityRefill(grid, rngState, dims) {
  const { W, H, reagents } = dims;
  const g = emptyGrid(W, H);
  for (let x = 0; x < W; x++) {
    let y = H - 1;
    for (let sy = H - 1; sy >= 0; sy--) if (grid[sy][x]) g[y--][x] = grid[sy][x];
    while (y >= 0) {
      let r;
      [r, rngState] = rngNext(rngState);
      g[y--][x] = { c: Math.floor(r * reagents), kind: 'gem' };
    }
  }
  return [g, rngState];
}

/**
 * The cascade engine. Resolve a board to a settled state: repeatedly find
 * matches (or consume a seeded first-pass clear from a stone), promote, clear,
 * detonate, drop, refill — until nothing matches. Returns settled facts + a
 * per-pass trace (chain depth, cells cleared, products minted).
 */
function resolve(grid0, rngState, score, stones, dims, { seedClear = null, swapped = [] } = {}) {
  let grid = grid0;
  let chain = 0;
  const trace = [];
  // Presentational frames the shell replays to animate the cascade: frame 0 is
  // the just-swapped board, then per pass a "holes" frame (matched cells popped,
  // products minted, nothing fallen yet) and a "settled" frame (dropped + refilled).
  const frames = [{ grid: cloneGrid(grid), score }];
  let pending = seedClear;
  for (;;) {
    let clear;
    let mints;
    let protectedSet;
    if (pending) {
      clear = pending;
      mints = [];
      protectedSet = new Set();
      pending = null;
    } else {
      const keys = matchedKeys(grid, dims);
      if (!keys.size) break;
      mints = [];
      protectedSet = new Set();
      for (const comp of componentsFrom(keys, grid)) {
        const cls = classify(comp, swapped);
        if (cls.kind !== 'plain') { mints.push(cls); protectedSet.add(key(cls.mintAt)); }
      }
      clear = new Set(keys);
      for (const m of mints) clear.delete(key(m.mintAt));
    }

    expandDetonations(grid, clear, protectedSet, dims);

    score += clear.size * 10 * (chain + 1);
    for (const m of mints) {
      score += BONUS[m.kind] || 0;
      if (m.kind === 'stone') stones++;
    }
    for (const k of clear) { const [x, y] = parse(k); grid[y][x] = null; }
    for (const m of mints) {
      grid[m.mintAt.y][m.mintAt.x] = m.axis
        ? { c: m.color, kind: m.kind, axis: m.axis }
        : { c: m.color, kind: m.kind };
    }
    frames.push({ grid: cloneGrid(grid), score }); // the pop: holes + minted products, pre-gravity
    [grid, rngState] = gravityRefill(grid, rngState, dims);
    frames.push({ grid: cloneGrid(grid), score }); // the fall: dropped + refilled
    trace.push({ chain, cleared: clear.size, mints: mints.map((m) => m.kind) });
    swapped = [];
    chain++;
  }
  return { grid, rngState, score, stones, chain, trace, frames };
}

/** Is there any legal swap (or a stone) on this board? */
export function hasValidMove(grid, dims) {
  const { W, H } = dims;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] && grid[y][x].kind === 'stone') return true;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= W || ny >= H) continue;
        const t = grid[y][x];
        grid[y][x] = grid[ny][nx];
        grid[ny][nx] = t;
        const move = matchedKeys(grid, dims).size > 0;
        grid[ny][nx] = grid[y][x];
        grid[y][x] = t;
        if (move) return true;
      }
    }
  }
  return false;
}

/** Deterministically shuffle the current tiles into a match-free, playable board. */
function reshuffle(grid, rngState, dims) {
  const { W, H } = dims;
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x]) cells.push(grid[y][x]);
  for (let tries = 0; tries < 60; tries++) {
    const arr = cells.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      let r;
      [r, rngState] = rngNext(rngState);
      const j = Math.floor(r * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const g = emptyGrid(W, H);
    let k = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y][x] = arr[k++];
    if (!matchedKeys(g, dims).size && hasValidMove(g, dims)) return [g, rngState];
  }
  // Fallback: a fresh match-free board (drops the multiset, guarantees playability).
  for (let tries = 0; tries < 20; tries++) {
    let g;
    [g, rngState] = seedFill(emptyGrid(W, H), rngState, dims);
    if (hasValidMove(g, dims)) return [g, rngState];
  }
  return seedFill(emptyGrid(W, H), rngState, dims);
}

/** Timed mode: crossing the level's target advances to a shorter, harder level. */
function advanceLevels(s) {
  let { level, target, levelStartScore, timeLeft } = s;
  while (s.score - levelStartScore >= target) {
    levelStartScore += target;
    level += 1;
    target = levelTargetFor(level);
    timeLeft = levelTimeMsFor(level); // the clock refills, shorter each level
  }
  return { ...s, level, target, levelStartScore, timeLeft, timeCap: levelTimeMsFor(level) };
}

/** Fold a resolved cascade back into the game state, reshuffling on deadlock. */
function finish(state, r, dims) {
  let { grid, rngState } = r;
  let frames = r.frames;
  if (!hasValidMove(grid, dims)) {
    [grid, rngState] = reshuffle(grid, rngState, dims);
    frames = [...frames, { grid: cloneGrid(grid), score: r.score }]; // land the anim on the reshuffled board
  }
  const next = {
    ...state,
    grid,
    rngState,
    score: r.score,
    stones: r.stones,
    chain: r.chain,
    moves: state.moves + 1,
    sel: null,
    lastTrace: r.trace,
    cascade: frames,
  };
  return state.mode === 'timed' && !state.over ? advanceLevels(next) : next;
}

/** Timed mode only: burn `dt` ms off the clock; hitting zero is a loss. */
function tick(state, dt) {
  if (state.mode !== 'timed' || state.over || !(dt > 0)) return state;
  const timeLeft = state.timeLeft - dt;
  return timeLeft <= 0
    ? { ...state, timeLeft: 0, over: true, cascade: [] }
    : { ...state, timeLeft, cascade: [] };
}

/** Swap the stone onto a reagent: transmute that whole color (or clear all). */
function stoneSwap(state, a, b, ca, cb, dims) {
  const grid = cloneGrid(state.grid);
  const clear = new Set();
  if (ca.kind === 'stone' && cb.kind === 'stone') {
    for (let y = 0; y < dims.H; y++) for (let x = 0; x < dims.W; x++) clear.add(`${x},${y}`);
  } else {
    const stoneAt = ca.kind === 'stone' ? a : b;
    const oc = ca.kind === 'stone' ? cb.c : ca.c;
    clear.add(`${stoneAt.x},${stoneAt.y}`);
    for (let y = 0; y < dims.H; y++) {
      for (let x = 0; x < dims.W; x++) {
        const c = grid[y][x];
        if (c && c.kind !== 'stone' && c.c === oc) clear.add(`${x},${y}`);
      }
    }
  }
  return finish(state, resolve(grid, state.rngState, state.score, state.stones, dims, { seedClear: clear }), dims);
}

/** Try a swap. Reverts (returns the same state) if it makes no match. */
function swap(state, a, b) {
  const dims = dimsOf(state);
  if (!a || !b || !inBounds(a.x, a.y, dims) || !inBounds(b.x, b.y, dims) || !adjacent(a, b)) return state;
  const ca = state.grid[a.y][a.x];
  const cb = state.grid[b.y][b.x];
  if (!ca || !cb) return state;
  if (ca.kind === 'stone' || cb.kind === 'stone') return stoneSwap(state, a, b, ca, cb, dims);
  const grid = cloneGrid(state.grid);
  grid[a.y][a.x] = cb;
  grid[b.y][b.x] = ca;
  if (!matchedKeys(grid, dims).size) return state; // no match → the swap reverts
  return finish(state, resolve(grid, state.rngState, state.score, state.stones, dims, { swapped: [a, b] }), dims);
}

/** Tap-to-select: first tap arms a cell, an adjacent second tap swaps. */
function handleSelect(state, x, y) {
  const dims = dimsOf(state);
  if (!inBounds(x, y, dims) || !state.grid[y][x]) return state;
  if (!state.sel) return { ...state, sel: { x, y }, cascade: [] };
  if (state.sel.x === x && state.sel.y === y) return { ...state, sel: null, cascade: [] };
  if (adjacent(state.sel, { x, y })) return swap({ ...state, sel: null }, state.sel, { x, y });
  return { ...state, sel: { x, y }, cascade: [] };
}

export function newGame(seed, opts = {}) {
  const W = opts.W || DEFAULT_W;
  const H = opts.H || DEFAULT_H;
  const reagents = opts.reagents || DEFAULT_REAGENTS;
  const mode = opts.mode === 'timed' ? 'timed' : 'free';
  const dims = { W, H, reagents };
  let rngState = seed >>> 0;
  let grid;
  [grid, rngState] = seedFill(emptyGrid(W, H), rngState, dims);
  if (!hasValidMove(grid, dims)) [grid, rngState] = reshuffle(grid, rngState, dims);
  const base = { seed: seed >>> 0, rngState, W, H, reagents, mode, grid, sel: null, score: 0, moves: 0, chain: 0, stones: 0, over: false, lastTrace: [], cascade: [] };
  if (mode === 'timed') {
    const cap = levelTimeMsFor(1);
    return { ...base, level: 1, target: levelTargetFor(1), levelStartScore: 0, timeCap: cap, timeLeft: cap };
  }
  return { ...base, level: null, target: null, levelStartScore: null, timeCap: null, timeLeft: null };
}

/**
 * The reducer. Actions:
 *   { type:'swap', a:{x,y}, b:{x,y} } · { type:'select', x, y } ·
 *   { type:'tick', dt } (timed mode: burn dt ms off the clock) · 'restart'.
 */
export function step(state, action) {
  const type = typeof action === 'string' ? action : action?.type;
  if (type === 'restart') return newGame((state.seed + 1) >>> 0, { ...dimsOf(state), mode: state.mode });
  if (type === 'tick') return tick(state, action?.dt || 0);
  if (state.over) return state;
  switch (type) {
    case 'select': return handleSelect(state, action.x, action.y);
    case 'swap': return swap(state, action.a, action.b);
    default: return state;
  }
}

/**
 * Test helper: build a full board from rows of digit chars (each digit a
 * reagent color; a full board, no specials). Specials are set by the caller
 * afterwards. Bypasses the spawn move-check so authored boards are preserved.
 */
export function fromRows(rows, opts = {}) {
  const H = rows.length;
  const W = rows[0].length;
  const reagents = opts.reagents || DEFAULT_REAGENTS;
  const grid = rows.map((row) => row.split('').map((ch) => ({ c: Number(ch), kind: 'gem' })));
  return { seed: opts.seed ?? 1, rngState: (opts.seed ?? 1) >>> 0, W, H, reagents, mode: 'free', grid, sel: null, score: 0, moves: 0, chain: 0, stones: 0, over: false, lastTrace: [], cascade: [], level: null, target: null, levelStartScore: null, timeCap: null, timeLeft: null };
}
