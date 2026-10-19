/**
 * THE TABLETOP MIND — the computer across the table: alpha-beta search over the kernel's moves, scored by what the
 * game declares (its pieces' values, how far a promoting piece has come, holding the middle of the board).
 *
 * A closure over the kernel (`buildTabletopMind(buildTabletop())`), referencing nothing else, so a page carries both.
 * Pure and seeded: equal moves are told apart by mulberry32 dice from the seed and the turn; the search is bounded by
 * a count of positions, never a clock, so the same position and seed give the same move on any machine.
 *
 *   think(K, S, { depth?, nodes?, seed?, slack?, quiet? }) → { move, score, depth, nodes } | null (no move)
 *     depth the turns looked ahead (2); nodes the positions it may weigh before it settles on the deepest search it
 *     finished (40000); slack how far below the best a move may score and still be picked, an easier opponent (0);
 *     quiet captures followed past the horizon, so it does not stop counting mid-exchange (4)
 *   LEVELS { easy, fair, hard }: the dials for each
 *   evaluate(K, S, side) → score   from `side`'s seat; a pawn is 1
 *
 *   G.mind (optional, the game's own weights): { advance: w (a promoting piece's progress to its far row, 0.1),
 *     centre: w (a piece but a royal one standing near the middle, 0.4) }; values are the pieces' own `value`.
 *
 * Two players; a game of more is played by each against the next (each seat maximises its own score).
 */

export function buildTabletopMind(T) {
  const WIN = 10000;
  const LEVELS = { easy: { depth: 1, slack: 0.6, quiet: 2 }, fair: { depth: 2, slack: 0.05 }, hard: { depth: 3 } };

  function dice(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // per compiled game: each cell's closeness to the middle, 0 at the rim to 1 at the centre
  const centres = new WeakMap();
  function centreOf(K) {
    let c = centres.get(K);
    if (c) return c;
    const d = K.L.cells.map((x) => Math.hypot(x.at[0], x.at[1])), far = Math.max(1e-9, ...d);
    c = d.map((x) => 1 - x / far);
    centres.set(K, c);
    return c;
  }

  function evaluate(K, S, side) {
    const W = Object.assign({ advance: 0.1, centre: 0.4 }, K.G.mind || {}), mid = centreOf(K);
    let score = 0;
    for (const P of S.pieces) {
      if (P.at < 0) continue;
      const kind = K.kinds[P.kind], sign = P.side === side ? 1 : -1;
      let v = kind.value + (kind.royal ? 0 : W.centre * mid[P.at]);
      if (kind.promote) {
        const row = K.rows[P.side].of[P.at], last = K.rows[P.side].last;
        v += W.advance * (row - 1) / Math.max(1, last - 1);
      }
      score += sign * v;
    }
    return score;
  }

  // captures first, the dearest taken by the cheapest, then promotions
  function order(K, S, moves) {
    const worth = (m) => {
      let w = 0;
      for (const q of m.cap) w += 10 * K.kinds[S.pieces[q].kind].value;
      if (m.cap.length && m.p >= 0) w -= K.kinds[S.pieces[m.p].kind].value;
      if (m.promote) w += 8 * K.kinds[m.promote].value;
      return w;
    };
    return moves.map((m, i) => ({ m, w: worth(m), i })).sort((a, b) => b.w - a.w || a.i - b.i).map((x) => x.m);
  }

  function overScore(over, side, ply) {
    if (over.winner === null) return 0;
    return over.winner === side ? WIN - ply : -(WIN - ply);
  }

  function think(K, S, opts) {
    const o = Object.assign({ depth: 2, nodes: 40000, seed: 1, slack: 0, quiet: 4 }, opts || {});
    const root = T.legal(K, S);
    if (!root.length) return null;
    const side = S.side;
    let nodes = 0;
    const STOP = {};

    // the score from the seat of the side to move in N
    function search(N, depth, alpha, beta, ply, q) {
      if (++nodes > o.nodes) throw STOP;
      if (N.over) return overScore(N.over, N.side, ply);
      const moves = T.legal(K, N);
      const end = T.outcome(K, N, moves);
      if (end) return overScore(end, N.side, ply);
      let list = moves;
      if (depth <= 0) {
        const stand = evaluate(K, N, N.side);
        if (q <= 0) return stand;
        list = moves.filter((m) => m.cap.length || m.promote);
        if (!list.length) return stand;
        // a capture must be taken when the rules say so: no standing pat on a forced line
        if (!(K.G.mustCapture && list.length === moves.length)) {
          if (stand >= beta) return stand;
          if (stand > alpha) alpha = stand;
        }
      }
      let best = -Infinity;
      for (const m of order(K, N, list)) {
        const C = T.apply(K, N, m);
        const same = C.side === N.side && !C.over;
        const v = same
          ? search(C, depth, alpha, beta, ply + 1, q)
          : -search(C, depth - 1, -beta, -alpha, ply + 1, depth <= 0 ? q - 1 : q);
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return best;
    }

    // iterative deepening: each finished depth's scores stand; one cut short by the count is dropped
    let scored = null, reached = 0;
    for (let d = 1; d <= o.depth; d++) {
      try {
        const out = [];
        let alpha = -Infinity;
        for (const m of order(K, S, root)) {
          const C = T.apply(K, S, m);
          const same = C.side === side && !C.over;
          // the root keeps every move's true score (no cut), so slack and the dice choose among honest numbers
          const v = same ? search(C, d, -Infinity, Infinity, 1, o.quiet) : -search(C, d - 1, -Infinity, -alpha + o.slack + 1e-6, 1, o.quiet);
          if (v > alpha) alpha = v;
          out.push({ m, v });
        }
        scored = out;
        reached = d;
      } catch (e) {
        if (e !== STOP) throw e;
        break;
      }
    }
    if (!scored) scored = root.map((m) => ({ m, v: 0 }));
    const top = Math.max(...scored.map((x) => x.v));
    const near = scored.filter((x) => x.v >= top - o.slack - 1e-9);
    const roll = dice((o.seed * 2654435761) ^ (S.turn * 40503) ^ S.pieces.length);
    const pick = near[Math.floor(roll() * near.length)];
    return { move: pick.m, score: pick.v, depth: reached, nodes };
  }

  return { think, evaluate, LEVELS, WIN };
}
