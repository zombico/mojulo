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
 *
 * A euro game (the kernel's economy: dice, hands, more than two players) is played by a turn planner instead: from its
 * own view (the kernel's `view`, so it never sees a hidden card or the dice ahead) it weighs lines of its own actions
 * this turn, `depth` long, the best few at each step, each forced choice on the way (where the robber goes, what to
 * give up) taken greedily, and plays the first action of the best line. A seat's worth: its points, what its pieces
 * earn a roll (the square root of each resource's share, so a spread beats a pile), its hand (a little, less past
 * seven), the builds it can pay for, the corners it can settle next, its cards, its army and its road. It plays
 * against the leader: its own worth less a share of the best other seat's.
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
    // a game that ends by points counts its points, not its pieces' values
    const scored = !!(K.G.end && K.G.end.score && K.G.end.score.length);
    if (scored) {
      const sc = T.scores(K, S);
      let other = -Infinity;
      for (let s = 0; s < sc.length; s++) if (s !== side) other = Math.max(other, sc[s]);
      score += sc[side] - other;
    }
    if (K.drops && K.drops.length) score += placementTerms(K, S, side);
    for (const P of S.pieces) {
      if (P.at < 0) continue;
      const kind = K.kinds[P.kind], sign = P.side === side ? 1 : -1;
      let v = (scored ? 0 : kind.value) + (kind.royal ? 0 : W.centre * mid[P.at]);
      if (kind.promote) {
        const row = K.rows[P.side].of[P.at], last = K.rows[P.side].last;
        v += W.advance * (row - 1) / Math.max(1, last - 1);
      }
      score += sign * v;
    }
    return score;
  }

  // what a placement game's own win asks for: open lines toward k, the shortest way left to join two sides, groups with
  // one empty neighbour left (to be taken next) on either side
  function placementTerms(K, S, side) {
    const W = K.G.win || {};
    let v = 0;
    const others = K.players.map((_, s) => s).filter((s) => s !== side);
    if (W.line) {
      const weigh = (counts) => { let t = 0; for (let c = 1; c < W.line; c++) t += counts[c] * Math.pow(4, c); return t; };
      v += 0.01 * weigh(T.lineWindows(K, S, side, W.line));
      for (const o of others) v -= 0.012 * weigh(T.lineWindows(K, S, o, W.line));
    }
    if (W.connect) {
      const mine = T.connectDistance(K, S, side);
      let theirs = Infinity;
      for (const o of others) theirs = Math.min(theirs, T.connectDistance(K, S, o));
      v += 0.6 * (Math.min(theirs, 40) - Math.min(mine, 40));
    }
    if (K.G.enclose) {
      const sides = T.sidesOf(S), seen = {};
      for (let c = 0; c < sides.length; c++) {
        if (sides[c] < 0 || seen[c]) continue;
        const g = T.groupAt(K, sides, c);
        for (const x of g.cells) seen[x] = 1;
        if (g.libs === 1) v += (g.side === side ? -0.6 : 0.5) * g.cells.length;
      }
    }
    return v;
  }

  // a drop game's many cells narrowed to where the play is: drops within two steps of a piece (the middle, on an empty
  // board), and every move that is not a drop
  function narrowed(K, S, moves) {
    if (!K.drops || !K.drops.length || moves.length <= 24) return moves;
    const near = {};
    let any = false;
    for (let c = 0; c < S.board.length; c++) {
      if (S.board[c] < 0) continue;
      any = true;
      for (const j of K.near[c]) { near[j] = 1; for (const x of K.near[j]) near[x] = 1; }
    }
    if (!any) {
      const mid = centreOf(K);
      return moves.slice().sort((a, b) => (a.drop && b.drop ? mid[b.to] - mid[a.to] : 0)).slice(0, 8);
    }
    const kept = moves.filter((m) => !m.drop || near[m.to]);
    return kept.length ? kept : moves;
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

  // ── the euro planner ────────────────────────────────────────────────────────────────────────────────────────────
  function worth(K, S, side, own) {
    const G = K.G, h = S.hand[side];
    let v = 3 * T.score(K, S, side, !own);
    const inc = T.income(K, S, side);
    for (const r of K.res) v += 2.2 * Math.sqrt(inc[r] || 0);
    let cards = 0;
    for (const r of K.res) { cards += h[r]; v += 0.25 * Math.min(h[r], 3); }
    if (cards > 7) v -= 0.4 * (cards - 7);
    for (const kind of Object.keys(G.build || {})) {
      const B = G.build[kind];
      let ok = (S.stock[side][kind] || 0) > 0;
      for (const r in B.cost || {}) if ((h[r] || 0) < B.cost[r]) ok = false;
      // a build it can pay for is worth what the build scores (a city more than a settlement), a little for any other
      if (ok) v += 0.35 + 0.5 * ((G.score && G.score.pieces && G.score.pieces[kind]) || 0);
    }
    // the corners it could settle next: kinds that score, needing what it has laid
    for (const kind of Object.keys(G.build || {})) {
      const B = G.build[kind];
      if (B.upgrade || !(G.score && G.score.pieces && G.score.pieces[kind]) || (S.stock[side][kind] || 0) <= 0) continue;
      let n = 0;
      const lo = K.P.on[kind] === 'corner' ? K.P.nC : 0, hi = K.P.on[kind] === 'corner' ? K.P.nC + K.P.nK : K.P.nC;
      for (let p = lo; p < hi && n < 2; p++) if (S.board[p] < 0 && T.legalPlace(K, S, side, kind, p)) n++;
      v += 0.6 * n;
    }
    // how many rolls to its next scoring build (or a card), at what its pieces earn: a trade that brings it nearer is worth it
    let soon = 6;
    const inc2 = T.income(K, S, side);
    const goals = Object.keys(G.build || {}).filter((k) => (S.stock[side][k] || 0) > 0 && G.score && G.score.pieces && G.score.pieces[k]).map((k) => G.build[k].cost || {})
      .concat(Object.keys(G.decks || {}).filter((d) => S.deck[d].length).map((d) => G.decks[d].cost || {}));
    for (const cost of goals) {
      let t = 0;
      for (const r in cost) { const miss = Math.max(0, cost[r] - (h[r] || 0)); if (miss) t = Math.max(t, miss / Math.max(inc2[r] || 0, 0.02)); }
      soon = Math.min(soon, t);
    }
    v -= 0.25 * Math.min(soon, 6);
    const held = S.cards[side];
    for (const c in held) if (!(G.score && G.score.cards && G.score.cards[c])) v += 0.55 * held[c];
    for (const id of Object.keys((G.score && G.score.awards) || {})) {
      const A = G.score.awards[id];
      if (A.played) v += 0.35 * Math.min(S.played[side][A.played] || 0, A.min + 1);
      if (A.trail) v += 0.12 * Math.min(T.trail(K, S, side, A.trail, A.block), A.min + 1);
    }
    return v;
  }
  function seat(K, S, side) {
    let other = -Infinity;
    for (let s = 0; s < K.players.length; s++) if (s !== side) other = Math.max(other, worth(K, S, s, false));
    // the leader's worth weighed as an answer weighs an offerer's gain (judge's base): enough to keep from feeding the
    // leader, not so much that every trade, which always helps its partner too, looks like a loss
    return worth(K, S, side, true) - 0.35 * (other === -Infinity ? 0 : other);
  }
  // the actor's forced choices answered greedily, one ply each, until the decision is someone else's or none is left
  function resolve(K, S, side, roll) {
    let N = S, guard = 0;
    while (!N.over && N.pending.length && N.pending[0].side === side && guard++ < 40) {
      const moves = T.legal(K, N);
      let best = null, bv = -Infinity;
      for (const m of moves) {
        const C = T.apply(K, N, m), v = seat(K, C, side) + roll() * 1e-6;
        if (v > bv) { bv = v; best = C; }
      }
      if (!best) break;
      N = best;
    }
    return N;
  }
  // ── trading ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // An offer answered by expected value and the table: what the trade does for the answerer's own worth, less what it
  // does for the offerer's, that weighed heavier when the offerer is ahead of the answerer and heavier again when the
  // offerer leads the table; nothing at all for a player within two points of winning (no king made). An easier mind
  // weighs the offerer's gain less and asks less of a trade.
  function swapped(S, a, b, give, get) {
    const N = JSON.parse(JSON.stringify(S));
    for (const r in give) { N.hand[a][r] -= give[r]; N.hand[b][r] += give[r]; }
    for (const r in get) { N.hand[b][r] -= get[r]; N.hand[a][r] += get[r]; }
    return N;
  }
  function judge(K, S, side, from, offer, o) {
    for (const r in offer.get) if ((S.hand[side][r] || 0) < offer.get[r]) return { yes: false, why: 'cannot pay' };
    const win = (K.G.score && K.G.score.win) || Infinity;
    const theirs = T.score(K, S, from, true), mine = T.score(K, S, side, false);
    if (theirs >= win - 2) return { yes: false, why: 'kingmaker' };
    let top = -Infinity;
    for (let s = 0; s < K.players.length; s++) if (s !== from) top = Math.max(top, T.score(K, S, s, s !== side));
    const A = swapped(S, from, side, offer.give, offer.get);
    const myGain = worth(K, A, side, true) - worth(K, S, side, true);
    const theirGain = worth(K, A, from, false) - worth(K, S, from, false);
    const soft = o.slack >= 0.5;
    const weight = (0.35 + (theirs > mine ? 0.4 : 0) + (theirs > top ? 0.3 : 0)) * (soft ? 0.5 : 1);
    const margin = soft ? 0 : o.depth >= 3 ? 0.2 : 0.12;
    const ev = myGain - weight * theirGain;
    return { yes: ev > margin, ev, myGain, theirGain, why: ev > margin ? 'worth it' : 'not worth it' };
  }
  // an offer's answers as each other seat would give them (their hands are open; their hidden cards as the view dealt)
  function answered(K, N, side, o) {
    let C = N, guard = 0;
    while (!C.over && C.pending.length && C.pending[0].do === 'answer' && guard++ < 12) {
      const d = C.pending[0], j = judge(K, C, d.side, d.from, d.offer, o);
      C = T.apply(K, C, { type: j.yes ? 'accept' : 'decline' });
    }
    return C;
  }

  function planTurn(K, S, o) {
    const real = T.legal(K, S);
    if (!real.length) return null;
    const side = T.actor(S);
    const roll = dice((o.seed * 2654435761) ^ (S.turn * 40503) ^ (S.pending.length * 97) ^ side);
    const V = T.view(K, S, side, o.seed);
    const width = 6, mine = (N) => !N.over && T.actor(N) === side;
    // the line's worth: at its end, or when the turn has passed to another
    function line(N, depth) {
      if (!mine(N) || depth <= 0 || N.phase !== 'main' || N.pending.length) return seat(K, N, side);
      // offers are weighed at the root only, where a trade can open a build
      const opts = T.legal(K, N).filter((m) => m.type !== 'end' && m.type !== 'offer').map((m) => ({ m, C: resolve(K, T.apply(K, N, m), side, roll) }));
      for (const x of opts) x.v = seat(K, x.C, side);
      opts.sort((a, b) => b.v - a.v);
      let best = seat(K, N, side);
      for (const x of opts.slice(0, width)) best = Math.max(best, line(x.C, depth - 1));
      return best;
    }
    let scored;
    const moves = T.legal(K, V);
    if (V.pending.length && V.pending[0].do === 'answer') {
      const d = V.pending[0], j = judge(K, V, side, d.from, d.offer, o);
      const move = real.find((m) => m.type === (j.yes ? 'accept' : 'decline'));
      return { move, score: j.ev || 0, depth: 0, nodes: 1, why: j.why };
    }
    if (V.pending.length || V.phase === 'opening') {
      // a forced choice: its worth once the actor's own follow-ups are answered
      scored = moves.map((m) => ({ m, v: seat(K, resolve(K, T.apply(K, V, m), side, roll), side) }));
    } else if (V.phase === 'roll') {
      // roll, unless a card played first is worth more than the turn as it stands
      const now = seat(K, V, side);
      scored = moves.map((m) => ({ m, v: m.type === 'roll' ? now + 0.5 : seat(K, resolve(K, T.apply(K, V, m), side, roll), side) }));
    } else {
      const own = worth(K, V, side, true);
      scored = moves.map((m) => {
        if (m.type === 'end') return { m, v: seat(K, V, side) + 0.05 };
        if (m.type === 'offer') {
          // only an offer that would help it, its answers foreseen, its partner chosen, then the turn played on
          const mine2 = JSON.parse(JSON.stringify(V));
          for (const r in m.offer.give) mine2.hand[side][r] -= m.offer.give[r];
          for (const r in m.offer.get) mine2.hand[side][r] += m.offer.get[r];
          if (worth(K, mine2, side, true) <= own) return { m, v: -Infinity };
          const C = resolve(K, answered(K, T.apply(K, V, m), side, o), side, roll);
          if (JSON.stringify(C.hand[side]) === JSON.stringify(V.hand[side])) return { m, v: -Infinity };
          return { m, v: line(C, o.depth - 1) };
        }
        return { m, v: line(resolve(K, T.apply(K, V, m), side, roll), o.depth - 1) };
      });
    }
    const top = Math.max.apply(null, scored.map((x) => x.v));
    const near = scored.filter((x) => x.v >= top - o.slack - 1e-9);
    const pick = near[Math.floor(roll() * near.length)];
    const move = real.find((m) => m.name === pick.m.name) || real[0];
    return { move, score: pick.v, depth: o.depth, nodes: scored.length };
  }

  function think(K, S, opts) {
    const o = Object.assign({ depth: 2, nodes: 40000, seed: 1, slack: 0, quiet: 4 }, opts || {});
    if (K.euro) return planTurn(K, S, o);
    const all = T.legal(K, S);
    if (!all.length) return null;
    const root = narrowed(K, S, all);
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
      let list = narrowed(K, N, moves);
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

  return { think, evaluate, judge, LEVELS, WIN };
}
