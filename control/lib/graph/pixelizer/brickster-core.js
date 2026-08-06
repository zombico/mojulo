/**
 * brickster core — a tetris-like as a pure reducer.
 *
 * The whole game is step(state, action) → state: no DOM, no clock, no
 * Math.random. Randomness is a seeded 7-bag over mulberry32 carried
 * *in* the state, so the same seed + the same action sequence is the
 * same game, replayable to byte equality. The imperative shell (see
 * the gen test's HTML bundle) only translates keys/timers into
 * actions; every rule lives here.
 *
 * Rotation system: SRS — standard shapes, spawn orientations, and the
 * JLSTZ/I wall-kick tables (y negated for our y-down grid). Hold is
 * guideline hold: one slot, once per drop, resets on lock.
 */

export const WELL_W = 10;
export const WELL_H = 22; // rows 0-1 hidden spawn space
export const HIDDEN = 2;
export const PIECES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

const BASE = {
  I: { box: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  J: { box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  O: { box: 4, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  S: { box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  T: { box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  Z: { box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
};

/** type → four rotation states, each four [x,y] cells (CW = (x,y)→(box-1-y,x); O never turns). */
export const ROTATIONS = {};
for (const [type, { box, cells }] of Object.entries(BASE)) {
  const rots = [cells];
  for (let r = 1; r < 4; r++) rots.push(type === 'O' ? cells : rots[r - 1].map(([x, y]) => [box - 1 - y, x]));
  ROTATIONS[type] = rots;
}

// SRS wall-kick tables, published (x, y-up) form negated to y-down.
const JLSTZ_KICKS = {
  '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const I_KICKS = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};
const NO_KICK = [[0, 0]];

const kicksFor = (type, from, to) =>
  type === 'O' ? NO_KICK : (type === 'I' ? I_KICKS : JLSTZ_KICKS)[`${from}${to}`];

/** mulberry32 as a pure step: rngState → [float 0..1, nextState]. */
export function rngNext(s) {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

function refillQueue(queue, rngState) {
  queue = [...queue];
  while (queue.length < 8) {
    const bag = [...PIECES];
    for (let i = bag.length - 1; i > 0; i--) {
      let r;
      [r, rngState] = rngNext(rngState);
      const j = Math.floor(r * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    queue.push(...bag);
  }
  return [queue, rngState];
}

export const cellsOf = (type, rot, x, y) => ROTATIONS[type][rot].map(([cx, cy]) => [x + cx, y + cy]);

const collides = (board, cells) =>
  cells.some(([x, y]) => x < 0 || x >= WELL_W || y < 0 || y >= WELL_H || board[y][x] !== '.');

const SPAWN_X = 3;
const SPAWN_Y = 0;

/** Guideline spawn: appear in the hidden rows, then immediately drop one row into view if free. */
function spawnActive(board, type) {
  const blocked = collides(board, cellsOf(type, 0, SPAWN_X, SPAWN_Y));
  const y = !blocked && !collides(board, cellsOf(type, 0, SPAWN_X, SPAWN_Y + 1)) ? SPAWN_Y + 1 : SPAWN_Y;
  return { active: { type, rot: 0, x: SPAWN_X, y }, blocked };
}

function spawn(state) {
  const [queue, rngState] = refillQueue(state.queue, state.rngState);
  const { active, blocked } = spawnActive(state.board, queue[0]);
  return { ...state, queue: queue.slice(1), rngState, active, holdUsed: false, over: state.over || blocked };
}

export function newGame(seed) {
  const state = {
    seed: seed >>> 0,
    rngState: seed >>> 0,
    board: Array.from({ length: WELL_H }, () => '.'.repeat(WELL_W)),
    queue: [],
    active: null,
    hold: null,
    holdUsed: false,
    score: 0,
    lines: 0,
    over: false,
  };
  return spawn(state);
}

export const levelOf = (state) => Math.floor(state.lines / 10);
export const gravityMs = (state) => Math.max(100, Math.round(800 * 0.75 ** levelOf(state)));

const CLEAR_SCORE = [0, 100, 300, 500, 800];

function lock(state) {
  const { type, rot, x, y } = state.active;
  const cells = cellsOf(type, rot, x, y);
  const board = [...state.board];
  for (const [cx, cy] of cells) board[cy] = board[cy].slice(0, cx) + type.toLowerCase() + board[cy].slice(cx + 1);
  const kept = board.filter((row) => row.includes('.'));
  const cleared = WELL_H - kept.length;
  while (kept.length < WELL_H) kept.unshift('.'.repeat(WELL_W));
  const lockedOut = cells.some(([, cy]) => cy < HIDDEN);
  const next = {
    ...state,
    board: kept,
    active: null,
    lines: state.lines + cleared,
    score: state.score + CLEAR_SCORE[cleared] * (levelOf(state) + 1),
    over: state.over || lockedOut,
  };
  return next.over ? next : spawn(next);
}

function tryShift(state, dx, dy) {
  const { type, rot, x, y } = state.active;
  if (collides(state.board, cellsOf(type, rot, x + dx, y + dy))) return null;
  return { ...state, active: { ...state.active, x: x + dx, y: y + dy } };
}

function tryRotate(state, dir) {
  const { type, rot, x, y } = state.active;
  const to = (rot + dir + 4) % 4;
  for (const [kx, ky] of kicksFor(type, rot, to)) {
    if (!collides(state.board, cellsOf(type, to, x + kx, y + ky))) {
      return { ...state, active: { type, rot: to, x: x + kx, y: y + ky } };
    }
  }
  return state; // rotation refused, no state change
}

/** Where the active piece would rest — the ghost row offset. */
export function dropDistance(state) {
  const { type, rot, x, y } = state.active;
  let d = 0;
  while (!collides(state.board, cellsOf(type, rot, x, y + d + 1))) d++;
  return d;
}

/**
 * The reducer. Actions: left/right/cw/ccw/softDrop/hardDrop/hold/tick/restart.
 * Unknown actions and actions after game over (except restart) return
 * the state unchanged.
 */
export function step(state, action) {
  if (action === 'restart') return newGame((state.seed + 1) >>> 0);
  if (state.over || !state.active) return state;
  switch (action) {
    case 'left':
      return tryShift(state, -1, 0) ?? state;
    case 'right':
      return tryShift(state, 1, 0) ?? state;
    case 'cw':
      return tryRotate(state, 1);
    case 'ccw':
      return tryRotate(state, -1);
    case 'tick':
      return tryShift(state, 0, 1) ?? lock(state);
    case 'softDrop': {
      const moved = tryShift(state, 0, 1);
      return moved ? { ...moved, score: moved.score + 1 } : lock(state);
    }
    case 'hardDrop': {
      const d = dropDistance(state);
      const dropped = { ...state, score: state.score + 2 * d, active: { ...state.active, y: state.active.y + d } };
      return lock(dropped);
    }
    case 'hold': {
      if (state.holdUsed) return state;
      const held = state.hold;
      const stashed = { ...state, hold: state.active.type };
      if (!held) return { ...spawn(stashed), holdUsed: true };
      const { active, blocked } = spawnActive(state.board, held);
      return { ...stashed, active, holdUsed: true, over: state.over || blocked };
    }
    default:
      return state;
  }
}
