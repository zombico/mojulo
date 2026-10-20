/**
 * philosophers stone saga — a match-3 saga over the Philosopher's Stone core: the level table, generated from the
 * recipe (`saga: { seed, levels }`) and never authored (the same seed and count, the same map, level for level), and
 * the saga's own rules wrapped round the core's reducer (sagaStep), so the core and the page without a saga keep
 * every byte.
 *
 * A level is played in a budget of MOVES for a GOAL — a score, or so many of one reagent dissolved — won the moment
 * the goal is met (each move left over pays the level's `bonus`), lost when the moves run out first; its score against
 * three thresholds is its STARS (a win is always one). What a move dissolved is read off the cascade the core already
 * hands the page (its pop frames), counted as the core counts a clear: a promoted tile stays, a stone has no colour.
 *
 * A level is a spec the core plays in saga mode (philosophers-stone-core.js): its own board seed, how many reagents
 * fall (fewer is easier: bigger cascades), its moves, its goal (a score, or so many of one reagent dissolved), its
 * three star thresholds and what a move left over pays. The curve: six onboarding levels on five reagents, then six,
 * a collect goal every third level, the goal's share of the moves climbing and the moves thinning. Pure, no clock,
 * no dice beyond the seed.
 */
import { newGame, step, rngNext } from './philosophers-stone-core.js';

export const SAGA_DEFAULTS = Object.freeze({ seed: 1, levels: 30 });
export const SAGA_MAX_LEVELS = 99;
const r10 = (v) => Math.round(v / 10) * 10;
// a steady player's yield per move, measured (a greedy player taking the best swap, medians over twelve seeds): points
// and one reagent dissolved, with five reagents falling and with six
const YIELD = { 5: { points: 650, colour: 3.6 }, 6: { points: 250, colour: 1.6 } };

/**
 * Level n (1-based) of the saga seeded `seed`: { n, seed, W, H, reagents, moves, goal, stars, bonus }. Its goal is a
 * share of what a steady player makes in its moves, the share climbing from 0.3 to 0.9 (so the last levels leave
 * little to spare); `bonus` is what each move left over pays on a win, so the stars read how soon it was won.
 */
export function sagaLevel(n, seed = SAGA_DEFAULTS.seed) {
  let s = (seed >>> 0) ^ Math.imul(n, 0x9e3779b1);
  let r;
  [r, s] = rngNext(s >>> 0);
  const onboarding = n <= 6, reagents = onboarding ? 5 : 6, Y = YIELD[reagents];
  const moves = onboarding ? 20 : Math.max(15, 22 - Math.floor((n - 7) / 4));
  const share = onboarding ? 0.3 + 0.05 * (n - 1) : Math.min(0.9, 0.55 + (0.35 * (n - 7)) / 23);
  const bonus = r10(Y.points * 1.5), make = Y.points * moves;
  if (n % 3 === 0) {
    // a collect goal: so many of one reagent dissolved (its colour drawn from the level's own seed)
    const c = Math.floor(r * reagents), count = Math.max(6, Math.round(Y.colour * moves * share));
    return { n, seed: s, W: 8, H: 8, reagents, moves, goal: { collect: { c, n: count } }, stars: [0, r10(make * 1.15), r10(make * 1.3)], bonus };
  }
  const target = r10(make * share);
  return { n, seed: s, W: 8, H: 8, reagents, moves, goal: { score: target }, stars: [target, r10(target * 1.35), r10(target * 1.8)], bonus };
}

/** The whole map: { seed, levels } → [spec]. */
export function sagaLevels({ seed = SAGA_DEFAULTS.seed, levels = SAGA_DEFAULTS.levels } = {}) {
  return Array.from({ length: levels }, (_, i) => sagaLevel(i + 1, seed));
}

/** A level's opening state: the core's board (free mode, the level's seed and reagents) and the saga's own fields. */
export function sagaStart(L) {
  return { ...newGame(L.seed, { W: L.W, H: L.H, reagents: L.reagents }), saga: true, spec: L, movesLeft: L.moves, collected: new Array(L.reagents).fill(0), result: null, stars: 0 };
}

/** What a resolved move dissolved, by reagent: each pass's cells gone between the board before it and its pop frame. */
export function dissolved(cascade, reagents) {
  const out = new Array(reagents).fill(0);
  for (let i = 0; i + 1 < (cascade || []).length; i += 2) {
    const before = cascade[i].grid, pop = cascade[i + 1].grid;
    for (let y = 0; y < before.length; y++) for (let x = 0; x < before[y].length; x++) {
      const c = before[y][x];
      if (c && !pop[y][x] && c.kind !== 'stone') out[c.c]++;
    }
  }
  return out;
}

/** Has this level's goal been met? */
export function goalMet(state) {
  const g = state.spec.goal;
  return g.collect ? state.collected[g.collect.c] >= g.collect.n : state.score >= g.score;
}

/** The saga's reducer: the core's step, a move spent and counted, won on the goal, lost on the last move; 'restart'
 * replays the same level. */
export function sagaStep(state, action) {
  const type = typeof action === 'string' ? action : action?.type;
  if (type === 'restart') return sagaStart(state.spec);
  if (state.over) return state;
  const next = step(state, action);
  if (next === state || next.moves === state.moves) return next;   // no move landed (a select, a swap that reverts)
  const got = dissolved(next.cascade, state.spec.reagents);
  const moved = { ...next, movesLeft: state.movesLeft - 1, collected: state.collected.map((n, c) => n + got[c]) };
  if (goalMet(moved)) {
    const score = moved.score + moved.movesLeft * moved.spec.bonus;
    return { ...moved, score, over: true, result: 'won', stars: Math.max(1, moved.spec.stars.filter((t) => score >= t).length) };
  }
  return moved.movesLeft <= 0 ? { ...moved, over: true, result: 'lost', stars: 0 } : moved;
}

/** A saga as written on a recipe → { seed, levels }, or throws naming what is wrong. */
export function readSaga(v, where = 'saga') {
  if (v === undefined || v === null || v === true) return { ...SAGA_DEFAULTS };
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} is true or { seed?, levels? }`);
  for (const k of Object.keys(v)) if (k !== 'seed' && k !== 'levels') throw new Error(`${where}.${k} is not a saga setting (seed, levels)`);
  if (v.seed !== undefined && !Number.isInteger(v.seed)) throw new Error(`${where}.seed is a whole number`);
  if (v.levels !== undefined && !(Number.isInteger(v.levels) && v.levels >= 1 && v.levels <= SAGA_MAX_LEVELS)) throw new Error(`${where}.levels is 1 to ${SAGA_MAX_LEVELS}`);
  return { seed: v.seed ?? SAGA_DEFAULTS.seed, levels: v.levels ?? SAGA_DEFAULTS.levels };
}
