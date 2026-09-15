/**
 * brickster replay — the fixture that proves a reducer port IS the reducer.
 *
 * A seeded action script (drawn from the reducer's own mulberry32, so the
 * script is as deterministic as the game) plus the JS reducer's outcome after
 * playing it. The Godot arcade pack ships it as probe/replay.json; the export
 * driver replays it through kernel/brickster.gd headless and compares the
 * digest field by field. Same seed + same actions ⇒ same board, or the gate
 * fails. digest() here and brickster.gd's digest() are the same contract.
 */

import { newGame, step, rngNext } from './brickster-core.js';

export const REPLAY_SEED = 7;
export const REPLAY_PIECES = 90;

const RESTART_AT_PIECE = 3;

// Column heights + holes of a board: the greedy player's whole brain.
function boardCost(board) {
  const W = board[0].length;
  let aggregate = 0;
  let holes = 0;
  for (let x = 0; x < W; x++) {
    let top = -1;
    for (let y = 0; y < board.length; y++) {
      const filled = board[y][x] !== '.';
      if (filled && top < 0) top = y;
      if (!filled && top >= 0) holes++;
    }
    aggregate += top < 0 ? 0 : board.length - top;
  }
  return aggregate + holes * 6;
}

/**
 * A greedy, deterministic player: for every piece, try each rotation and
 * every lateral offset (through the reducer, so kicks and walls apply), hard
 * drop, keep the placement with the lowest cost, and emit exactly the actions
 * that reached it. Random play never clears a line; this one does, so the
 * fixture exercises lock, clear, scoring and the level ramp. Sprinkled from
 * the reducer's own rng: a soft drop, a tick or a hold before some pieces,
 * and one restart early on (the rest of the game plays seed + 1).
 */
export function buildReplayActions(seed = REPLAY_SEED, pieces = REPLAY_PIECES) {
  const actions = [];
  let state = newGame(seed);
  let rng = (seed * 2654435761) >>> 0;
  const emit = (a) => { actions.push(a); state = step(state, a); };
  for (let n = 0; n < pieces && !state.over; n++) {
    if (n === RESTART_AT_PIECE) emit('restart');
    let r;
    [r, rng] = rngNext(rng);
    if (r < 0.15) emit('hold');
    else if (r < 0.3) emit('tick');
    else if (r < 0.45) emit('softDrop');
    if (state.over) break;
    let best = null;
    for (let rot = 0; rot < 4; rot++) {
      for (let dx = -5; dx <= 5; dx++) {
        const seq = [...Array(rot).fill(rot === 3 ? 'ccw' : 'cw'), ...Array(Math.abs(dx)).fill(dx < 0 ? 'left' : 'right')];
        if (rot === 3) seq.splice(0, 3, 'ccw');
        let s = state;
        let legal = true;
        for (const a of seq) { const t = step(s, a); if (t === s) { legal = false; break; } s = t; }
        if (!legal) continue;
        const dropped = step(s, 'hardDrop');
        const cost = boardCost(dropped.board) - (dropped.lines - state.lines) * 40 + (dropped.over ? 1000 : 0);
        if (!best || cost < best.cost) best = { cost, seq };
      }
    }
    if (!best) { emit('hardDrop'); continue; }
    for (const a of best.seq) emit(a);
    emit('hardDrop');
  }
  return actions;
}

/** The comparable fields of a state — the shape brickster.gd prints. */
export function digest(state) {
  const a = state.active;
  return {
    board: state.board.join('|'),
    score: state.score,
    lines: state.lines,
    hold: state.hold ?? '-',
    queue: state.queue.join(''),
    active: a ? `${a.type}:${a.rot}:${a.x}:${a.y}` : '-',
    over: state.over ? 'true' : 'false',
  };
}

export function buildReplayFixture(seed = REPLAY_SEED, pieces = REPLAY_PIECES) {
  const actions = buildReplayActions(seed, pieces);
  const final = actions.reduce(step, newGame(seed));
  return { seed, steps: actions.length, actions, expected: digest(final) };
}

/** Parse the kernel's `[mojulo-replay] k=v …` line into the digest shape (null if absent). */
export function parseReplayLine(text) {
  const m = /\[mojulo-replay\] (.*)/.exec(text);
  if (!m) return null;
  const out = {};
  for (const kv of m[1].trim().split(/\s+/)) {
    const i = kv.indexOf('=');
    if (i < 0) continue;
    const k = kv.slice(0, i);
    const v = kv.slice(i + 1);
    out[k] = k === 'score' || k === 'lines' || k === 'seed' || k === 'steps' ? Number(v) : v;
  }
  return out;
}

/** Field-by-field comparison; every key of `expected` must match. */
export function compareReplay(expected, got) {
  const checks = {};
  for (const k of Object.keys(expected)) checks[k] = { ok: got != null && got[k] === expected[k], expected: expected[k], got: got?.[k] ?? null };
  return { ok: Object.values(checks).every((c) => c.ok), checks };
}

/** Parse the kernel's `[mojulo-perf] k=v …` line (shared by both kernels; null if absent). */
export function parsePerfLine(text) {
  const m = /\[mojulo-perf\] (.*)/.exec(text);
  if (!m) return null;
  const out = {};
  for (const kv of m[1].trim().split(/\s+/)) {
    const [k, v] = kv.split('=');
    if (k) out[k] = Number.isFinite(+v) ? +v : v;
  }
  return out;
}
