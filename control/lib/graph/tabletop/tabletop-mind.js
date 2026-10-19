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
  const LEVELS = { easy: { depth: 1, slack: 0.6, quiet: 2, use: 0.7 }, fair: { depth: 2, slack: 0.05, use: 0.92 }, hard: { depth: 3, use: 1 } };
  // capacity used over capacity idle, when worths are close: so much a unit spent (a coin, a buy, a worker placed)
  const TEMPO = 0.02;

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
    const held = T.held(S, side);
    for (const c in held) if (!(G.score && G.score.cards && G.score.cards[c])) v += 0.55 * held[c];
    for (const id of Object.keys((G.score && G.score.awards) || {})) {
      const A = G.score.awards[id];
      if (A.played) v += 0.35 * Math.min(T.held(S, side, 'played')[A.played] || 0, A.min + 1);
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

  // ── tiles ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  // A seat's worth in a tile game: its points, and each feature it holds most claims in at what it would pay (done, at
  // a chance falling with its open edges; else the end's rate), a claim still in hand worth more the fuller the bag;
  // less a share of the leader's. A placement is weighed with the best claim it allows (or none), the bag never looked into.
  function tileWorth(K, S, side) {
    const F = K.G.tiles.features || {}, feats = T.tileFeatures(K, S);
    // a claim in hand is worth more while many tiles are left to use it on
    const total = Object.values(K.G.tiles.bag || {}).reduce((x, y) => x + y, 0) || 1;
    const inHand = 1.2 + 3 * S.bag.length / total;
    const seat = K.players.map((_, s) => S.score[s] + inHand * S.stock[s]);
    for (const f of feats) {
      if (!f.claims.length) continue;
      const count = K.players.map(() => 0);
      for (const q of f.claims) count[S.pieces[q].side] += 1;
      const top = Math.max.apply(null, count), rate = F[f.type] || { complete: 0, incomplete: 0 };
      const p = f.open === 0 ? 1 : 1 / (1 + 0.7 * f.open);
      const done = f.centre ? 9 * rate.complete : (f.size + Math.min(f.open, 3)) * rate.complete;
      const value = p * done + (1 - p) * f.size * rate.incomplete;
      count.forEach((x, s) => { if (x === top) seat[s] += value; });
    }
    let other = -Infinity;
    for (let s = 0; s < seat.length; s++) if (s !== side) other = Math.max(other, seat[s]);
    return seat[side] - 0.5 * other;
  }
  function planTiles(K, S, o) {
    const real = T.legal(K, S);
    if (!real.length) return null;
    const side = S.side, V = T.view(K, S, side, o.seed);
    const roll = dice((o.seed * 2654435761) ^ (S.turn * 40503) ^ side);
    const bestClaim = (N) => {
      let best = -Infinity;
      for (const m of T.legal(K, N)) best = Math.max(best, tileWorth(K, T.apply(K, N, m), side));
      return best;
    };
    const scored = T.legal(K, V).map((m) => ({ m, v: m.type === 'tile' ? bestClaim(T.apply(K, V, m)) : tileWorth(K, T.apply(K, V, m), side) }));
    const top = Math.max.apply(null, scored.map((x) => x.v));
    const near = scored.filter((x) => x.v >= top - o.slack - 1e-9);
    const pick = near[Math.floor(roll() * near.length)];
    return { move: real.find((m) => m.name === pick.m.name) || real[0], score: pick.v, depth: 1, nodes: scored.length };
  }

  // ── cards ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  // How far a card game has gone, 0 to 1: the nearest of its end conditions, and never less than its turns played
  // over a usual length (players × 24), so a game nobody ends still turns to points.
  function cardProgress(K, S) {
    const E = K.G.piles.end || {}, C = K.G.piles;
    let p = Math.min(1, S.turn / (K.players.length * 24));
    if (E.turns) p = Math.max(p, S.turn / E.turns);
    if (E.pile) { const n = (C.supply || {})[E.pile] || 1; p = Math.max(p, 1 - (S.supply[E.pile] || 0) / n); }
    if (E.piles) {
      // the end comes when the last of the emptiest piles it needs is gone: that pile's way to empty
      const gone = Object.keys(C.supply || {}).map((id) => 1 - (S.supply[id] || 0) / (C.supply[id] || 1)).sort((a, b) => b - a);
      p = Math.max(p, gone[Math.min(E.piles, gone.length) - 1] || 0);
    }
    if (E.market && S.market) {
      const all = Object.values(C.market.deck || {}).reduce((a, b) => a + b, 0) || 1;
      p = Math.max(p, 1 - (S.market.deck.length + S.market.row.filter(Boolean).length) / all);
    }
    return Math.min(1, p);
  }
  // what a card brings to a hand it is drawn in: its coins, the cards and coins it plays for, a little for the actions
  // and buys it adds, and for the gaining and trashing it does early on
  function cardEcon(t) {
    let v = t.coin || 0;
    for (const e of t.play || []) v += (e.coin || 0) + 0.8 * (e.draw || 0) + 0.25 * (e.actions || 0) + 0.4 * (e.buys || 0) + 0.25 * (e.gain || 0) + 0.12 * (e.trash || 0);
    return v;
  }
  // A seat's worth in a card game: its points as the game scores them, weighed more the further it has gone; and, in
  // a deck game, what an average hand of its cards brings, weighed less as the end nears; less half the leader's.
  function cardWorth(K, S, side) {
    if (S.over) return S.over.winner === side ? WIN : S.over.winner === null ? 0 : -WIN;
    const p = cardProgress(K, S), sc = T.cardScores(K, S);
    const seat = sc.map((x, s) => {
      let v = x * (0.2 + p);
      if (!K.card.draft) {
        const Z = S.zones[s], owned = Z.deck.concat(Z.hand, Z.discard, Z.play);
        const econ = owned.reduce((a, id) => a + cardEcon(T.derive(K, S, id)), 0) / (owned.length || 1);
        v += 4 * econ * K.card.hand * (1 - p);
      }
      return v;
    });
    let other = -Infinity;
    for (let s = 0; s < seat.length; s++) if (s !== side) other = Math.max(other, seat[s]);
    return seat[side] - 0.5 * other;
  }
  // what this turn can still buy: the coins in hand, the treasures not yet played, a card's draw at the deck's average
  function turnReach(K, S, side) {
    if (S.side !== side) return 0;
    const Z = S.zones[side];
    let v = S.act.coins + 0.5 * (S.act.buys - 1);
    for (const id of Z.hand) {
      const t = T.derive(K, S, id);
      if (t.treasure) v += t.coin || 0;
      else if (S.act.actions > 0) v += cardEcon(t) * 0.5;
    }
    return v;
  }
  // A card game's turn, one move at a time from its own view: a choice owed (what to gain, what to trash) by the worth
  // it leaves; while anything can be played, the play that leaves the most this turn can buy (an action that keeps the
  // actions going first); then the buy, or the end, that leaves the best worth. A draft takes the card worth most to
  // it less half what the next seat would take after it.
  function planCards(K, S, o) {
    const real = T.legal(K, S);
    if (!real.length) return null;
    const side = S.side, V = T.view(K, S, side, o.seed);
    const roll = dice((o.seed * 2654435761) ^ (S.turn * 40503) ^ side);
    const moves = T.legal(K, V);
    let scored;
    if (K.card.draft) {
      const next = (N) => {
        if (N.over) return 0;
        let best = -Infinity;
        for (const m of T.legal(K, N)) best = Math.max(best, cardWorth(K, T.apply(K, N, m), N.side));
        return best === -Infinity ? 0 : best;
      };
      scored = moves.map((m) => { const N = T.apply(K, V, m); return { m, v: cardWorth(K, N, side) - (N.over ? 0 : 0.5 * next(N)) }; });
    } else {
      // a weaker computer overlooks some of what it could spend this turn (a card to play, a buy)
      const seen = V.pending.length ? moves : overlook(K, S, moves, (m) => m.type === 'play' || m.type === 'buy', o.use);
      const plays = V.pending.length ? [] : seen.filter((m) => m.type === 'play');
      if (plays.length) {
        scored = plays.map((m) => {
          const t = T.derive(K, V, m.id), N = T.apply(K, V, m);
          const keeps = (t.play || []).some((e) => e.actions) ? 2 : t.treasure ? 0 : 1;
          return { m, v: turnReach(K, N, side) + keeps };
        });
      } else {
        const cost = (m) => (m.slot !== undefined ? T.derive(K, V, V.market.row[m.slot]).cost || 0 : (K.defs[m.card].cost || 0));
        scored = seen.map((m) => ({ m, v: cardWorth(K, T.apply(K, V, m), side) + (m.type === 'buy' ? TEMPO * (1 + cost(m)) : m.type === 'end' ? 0 : 1e-3) }));
      }
    }
    const top = Math.max.apply(null, scored.map((x) => x.v));
    const near = scored.filter((x) => x.v >= top - o.slack - 1e-9);
    const pick = near[Math.floor(roll() * near.length)];
    return { move: real.find((m) => m.name === pick.m.name) || real[0], score: pick.v, depth: 1, nodes: scored.length };
  }

  // ── utilization ───────────────────────────────────────────────────────────────────────────────────────────────
  // A level's `use` (0 to 1) is how often an option that spends the turn's capacity is seen at all: each is overlooked
  // with probability 1 − use, and stays overlooked for the rest of that turn (the way a player forgets the card in
  // hand, not for a moment but until the turn is gone). Whether an option is seen is a hash of the game's seed, the
  // turn, the seat and the option's name, so it holds across the turn's decisions whatever seed each is given. With
  // every spender overlooked the mind keeps what is left: it idles where idling is allowed (ends the turn, passes)
  // and, where spending is forced, chooses among all of them as though blind to their worth (a misplacement). At 1
  // nothing is overlooked.
  function turnKey(K, S) {
    if (K.round) return S.round * 64 + (S.part === 'turn' ? 32 + (S.seat || 0) : 0);
    return S.turn;
  }
  function seen01(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  // the moves seen: may be none, when every move spends and every one was overlooked
  function overlook(K, S, moves, spends, use) {
    if (!(use < 1)) return moves;
    const key = (K.G.seed || 1) + '|' + turnKey(K, S) + '|' + S.side + '|';
    return moves.filter((m) => !spends(m) || seen01(key + m.name) < use);
  }

  // ── rounds ────────────────────────────────────────────────────────────────────────────────────────────────────
  // What a resource is worth, from the game's own data: its best rate into points through a space that costs it (to
  // a little less, while rounds are left), what the end pays for it, and, for one paid in upkeep, the points its
  // shortfall would cost, up to what the workers will eat.
  function roundRates(K) {
    if (K.round.rates) return K.round.rates;
    const R = K.G.round, conv = {}, end = {}, upkeep = {};
    for (const id of Object.keys(R.spaces || {})) {
      const sp = R.spaces[id], units = Object.values(sp.cost || {}).reduce((a, b) => a + b, 0);
      const pts = (sp.gives || []).reduce((a, e) => a + (e.points || 0), 0);
      if (units && pts) for (const r in sp.cost) conv[r] = Math.max(conv[r] || 0, pts / units);
    }
    for (const sc of R.score || []) if (sc.pools) for (const r in sc.pools) end[r] = 1 / sc.pools[r];
    for (const P of R.phases) for (const st of P.steps || []) if (st.upkeep) for (const r in st.upkeep.pay) upkeep[r] = { pay: st.upkeep.pay[r], short: -(st.upkeep.short || 0) };
    K.round.rates = { conv, end, upkeep };
    return K.round.rates;
  }
  function roundWorth(K, S, side) {
    if (S.over) return S.over.winner === side ? WIN : S.over.winner === null ? 0 : -WIN;
    const R = K.G.round, rates = roundRates(K), left = Math.max(0, R.rounds - S.round - 1), p = S.round / R.rounds;
    const sc = T.roundScores(K, S, false);
    const kind = R.workers && R.workers.kind;
    const crew = (s) => (kind ? S.pieces.filter((o) => o.side === s && o.kind === kind && (o.zone === 'home' || o.zone === 'space')).length : 0);
    const value = (r, have, s) => {
      let v = 0;
      const U = rates.upkeep[r], need = U ? crew(s) * U.pay * (left + 1) : 0;
      for (let i = 0; i < have; i++) {
        if (i < need) v += U.short / U.pay;
        else v += (1 - p) * 0.8 * (rates.conv[r] || 0) + p * (rates.end[r] || 0) + 0.05;
      }
      return v;
    };
    // a worker: the spaces' typical yield a round for the rounds left, less what it eats
    const yieldOf = (gives, s) => (gives || []).reduce((a, e) => a + (e.points || 0) + Object.keys(e.get || {}).reduce((b, r) => b + e.get[r] * ((rates.conv[r] || 0) * 0.8 + 0.3), 0), 0);
    const yields = Object.values(R.spaces || {}).map((sp) => yieldOf(sp.gives)).sort((a, b) => a - b);
    const typical = yields.length ? yields[Math.floor(yields.length / 2)] : 0;
    const feed = Object.values(rates.upkeep).reduce((a, U) => a + U.pay, 0);
    const seat = sc.map((x, s) => {
      let v = x;
      for (const r of K.round.res) v += value(r, S.pools[s][r] || 0, s);
      v += crew(s) * left * Math.max(0, typical - feed);
      if ((S.nextFirst === null ? S.first : S.nextFirst) === s) v += 0.4 * (left + 1) / R.rounds;
      return v;
    });
    let other = -Infinity;
    for (let s = 0; s < seat.length; s++) if (s !== side) other = Math.max(other, seat[s]);
    return seat[side] - 0.5 * other;
  }
  // a round game's choice from the mind's own view: a worker where its seat's worth gains most; a bid by expected value
  // (what the lot is worth to it, the coins it costs, whether its bid would beat what each other seat would pay for the
  // lot by the same reckoning, and half what a rival's win would gain them); a pick by what the card is worth to it less
  // half what the next seat could take from the hand it passes on
  function planRounds(K, S, o) {
    const real = T.legal(K, S);
    if (!real.length) return null;
    const R = K.G.round, P = T.phaseNow(K, S), side = S.side, V = T.view(K, S, side, o.seed);
    const roll = dice((o.seed * 2654435761) ^ (S.turn * 40503) ^ side);
    const moves = T.legal(K, V);
    const holding = (N, s, id) => Object.assign({}, N, { zones: N.zones.map((Z, i) => (i === s ? Object.assign({}, Z, { tableau: Z.tableau.concat([id]) }) : Z)) });
    const gain = (N, s, id) => { const a = T.roundScores(K, holding(N, s, id), false)[s], b = T.roundScores(K, N, false)[s]; return a - b; };
    let scored;
    if (P.move === 'place') {
      const seen = overlook(K, S, moves, (m) => m.type === 'place', o.use), blind = !seen.length;
      scored = (blind ? moves : seen).map((m) => ({ m, v: blind ? 0 : roundWorth(K, T.apply(K, V, m), side) + (m.type === 'place' ? TEMPO : 0) }));
    } else if (P.move === 'bid') {
      const lot = V.lots[0], p = V.round / R.rounds, coin = (1 - p) * 0.8 + p * (1 / ((R.score || []).reduce((a, sc) => (sc.pools && sc.pools[K.round.bid]) || a, 3)));
      const want = (s) => Math.min(V.pools[s][K.round.bid] || 0, Math.floor(Math.max(0, gain(V, s, lot)) / Math.max(coin, 0.1)));
      const seq = K.players.map((_, i) => (V.first + i) % K.players.length);
      const rivals = seq.filter((s) => s !== side).map((s) => ({ s, w: want(s), before: seq.indexOf(s) < seq.indexOf(side) }));
      const mine = gain(V, side, lot);
      scored = moves.map((m) => {
        const beaten = rivals.filter((x) => (x.before ? m.n > x.w : m.n >= x.w));
        const wins = m.n > 0 && beaten.length === rivals.length;
        const top = rivals.reduce((a, x) => (x.w > (a ? a.w : 0) ? x : a), null);
        const lose = top && top.w > 0 ? -0.5 * Math.max(0, gain(V, top.s, lot) - top.w * coin) : 0;
        return { m, v: wins ? mine - m.n * coin : lose };
      });
    } else {
      const next = (side + (P.give === 'previous' ? K.players.length - 1 : 1)) % K.players.length;
      scored = moves.map((m) => {
        const rest = V.zones[side].hand.filter((id) => id !== m.id);
        const theirs = rest.length ? Math.max.apply(null, rest.map((id) => gain(V, next, id))) : 0;
        return { m, v: gain(V, side, m.id) - (next === side ? 0 : 0.5 * theirs) };
      });
    }
    const top = Math.max.apply(null, scored.map((x) => x.v));
    const near = scored.filter((x) => x.v >= top - o.slack - 1e-9);
    const pick = near[Math.floor(roll() * near.length)];
    return { move: real.find((m) => m.name === pick.m.name) || real[0], score: pick.v, depth: 1, nodes: scored.length };
  }

  // ── a player's turn: casts, abilities, the chain ─────────────────────────────────────────────────────────────
  // A seat's worth in a duel: its life, what its field brings (power counts most: it strikes every turn; guard, its
  // damage taken off; a little for each ability), the cards in its hand; less the best other seat's.
  function duelWorth(K, S, side) {
    if (S.over) return S.over.winner === side ? WIN : S.over.winner === null ? 0 : -WIN;
    const L = K.G.round.lose;
    const seat = K.players.map((_, s) => {
      let v = L ? S.pools[s][L.pool] : 0;
      for (const id of S.zones[s].field) {
        const c = T.derive(K, S, id), st = c.stats || {}, at = S.pieces[id].at;
        v += 1 + 1.5 * (st.power || 0) + 0.5 * Math.max(0, (st.guard || 0) - (S.pieces[id].damage || 0)) + 0.5 * (c.abilities || []).length;
        // on a board, a summon is worth more the further it has come (its power, toward the row it strikes from)
        if (at >= 0) v += 0.8 * Math.max(0, st.power || 0) * (K.rows[s].of[at] - 1) / Math.max(1, K.rows[s].last - 1);
      }
      return v + 0.8 * S.zones[s].hand.length;
    });
    let other = -Infinity;
    for (let s = 0; s < seat.length; s++) if (s !== side) other = Math.max(other, seat[s]);
    return seat[side] - other;
  }
  // the chain run out with nobody answering again: what a move comes to if the table lets it resolve
  function settled(K, N) {
    for (let guard = 0; !N.over && N.links.length && guard < 200; guard++) N = T.apply(K, N, T.legal(K, N).find((m) => m.type === 'pass'));
    return N;
  }
  // ── a supply to buy from, on turns (deck building) ───────────────────────────────────────────────────────────
  // what a cast card brings to a hand it is drawn in, from its effects (the card mode's measure, read off the turn
  // engine's verbs)
  function turnEcon(t) {
    let v = 0;
    for (const e of t.do || []) { const g = e.get || {}; v += (g.coin || 0) + 0.8 * (e.draw || 0) + 0.25 * (g.actions || 0) + 0.4 * (g.buys || 0); }
    return v;
  }
  function supplyProgress(K, S) {
    const R = K.G.round, E = R.end || {};
    let p = Math.min(1, S.round / 24);
    if (E.pile) p = Math.max(p, 1 - (S.supply[E.pile] || 0) / (R.supply[E.pile] || 1));
    if (E.piles) {
      const gone = Object.keys(R.supply).map((k) => 1 - (S.supply[k] || 0) / (R.supply[k] || 1)).sort((a, b) => b - a);
      p = Math.max(p, gone[Math.min(E.piles, gone.length) - 1] || 0);
    }
    return Math.min(1, p);
  }
  // a seat's worth with a supply: its points weighed more as the end nears; the average hand its cards draw, less
  function deckWorth(K, S, side) {
    if (S.over) return S.over.winner === side ? WIN : S.over.winner === null ? 0 : -WIN;
    const p = supplyProgress(K, S), sc = T.roundScores(K, S, false);
    const seat = sc.map((x, s) => {
      const Z = S.zones[s], owned = [].concat(Z.deck, Z.hand, Z.discard, Z.play, Z.field);
      const econ = owned.reduce((a, id) => a + turnEcon(T.derive(K, S, id)), 0) / (owned.length || 1);
      return x * (0.2 + p) + 4 * econ * (K.G.round.hand || 5) * (1 - p);
    });
    let other = -Infinity;
    for (let s = 0; s < seat.length; s++) if (s !== side) other = Math.max(other, seat[s]);
    return seat[side] - 0.5 * other;
  }
  // what this turn can still buy: the coins it has, the coins its cards in hand would give, a little for actions
  function supplyReach(K, S, side) {
    if (S.active !== side) return 0;
    let v = (S.pools[side].coin || 0) + 0.5 * ((S.pools[side].buys || 0) - 1);
    for (const id of S.zones[side].hand) {
      const t = T.derive(K, S, id), coins = (t.do || []).reduce((a, e) => a + ((e.get || {}).coin || 0), 0);
      if (t.do && !(t.cost && t.cost.actions)) v += coins;
      else if (t.do && (S.pools[side].actions || 0) > 0) v += 0.5 * turnEcon(t);
    }
    return v;
  }
  // cast while anything can be cast (an action that keeps the actions going first, then what leaves the most to
  // buy with); then the buy, or the end, that leaves the best worth
  function planSupply(K, S, o, V, moves, roll) {
    const side = S.side;
    const seen = overlook(K, S, moves, (m) => m.type === 'cast' || m.type === 'buy', o.use);
    const casts = seen.filter((m) => m.type === 'cast');
    if (casts.length) {
      return casts.map((m) => {
        const t = T.derive(K, V, m.id), keeps = (t.do || []).some((e) => e.get && e.get.actions) ? 2 : t.cost && t.cost.actions ? 1 : 0;
        return { m, v: supplyReach(K, settled(K, T.apply(K, V, m)), side) + keeps };
      });
    }
    const price = (m) => Object.values((K.defs[m.card] || {}).price || {}).reduce((a, b) => a + b, 0);
    return seen.map((m) => ({ m, v: deckWorth(K, settled(K, T.apply(K, V, m)), side) + (m.type === 'buy' ? TEMPO * (1 + price(m)) : m.type === 'end' ? 0 : 1e-3) }));
  }

  // a duel's choice from the mind's own view: each move played, the chain settled, the seat's worth weighed
  function planDuel(K, S, o) {
    const real = T.legal(K, S);
    if (!real.length) return null;
    const side = S.side, V = T.view(K, S, side, o.seed);
    const roll = dice((o.seed * 2654435761) ^ (S.turn * 40503) ^ side);
    const moves = T.legal(K, V);
    if (V.supply && !V.links.length) {
      const scored = planSupply(K, S, o, V, moves, roll), top = Math.max.apply(null, scored.map((x) => x.v));
      const near = scored.filter((x) => x.v >= top - o.slack - 1e-9), pick = near[Math.floor(roll() * near.length)];
      return { move: real.find((m) => m.name === pick.m.name) || real[0], score: pick.v, depth: 1, nodes: scored.length };
    }
    const spends = (m) => m.type === 'cast' || m.type === 'use' || m.type === 'go' || m.type === 'attack';
    const cost = (m) => { const c = m.type === 'cast' ? T.derive(K, V, m.id).cost : m.type === 'use' ? T.derive(K, V, m.id).abilities[m.ab].act.cost : null; return Object.values(c || {}).reduce((a, b) => a + b, 0); };
    const scored = overlook(K, S, moves, spends, o.use).map((m) => ({ m, v: duelWorth(K, settled(K, T.apply(K, V, m)), side) + (spends(m) ? TEMPO * (1 + cost(m)) : 0) }));
    const top = Math.max.apply(null, scored.map((x) => x.v));
    const near = scored.filter((x) => x.v >= top - o.slack - 1e-9);
    const pick = near[Math.floor(roll() * near.length)];
    return { move: real.find((m) => m.name === pick.m.name) || real[0], score: pick.v, depth: 1, nodes: scored.length };
  }

  // ── Monte Carlo tree search ───────────────────────────────────────────────────────────────────────────────────
  // The third mind, for any game the kernel plays: `playouts` times, a fresh determinization of the mind's own view
  // (the kernel's `view`, so it never sees a hidden card or the dice ahead), a walk down the tree by UCB (children
  // keyed by move name, each counted as available whenever its move was legal, so a move legal only in some deals is
  // not starved), one new node, then a playout of `horizon` moves (one that acts is preferred to one that ends a turn
  // or passes) scored by the game's own worth for every seat, squashed to 0..1 (a win 1, a loss 0). The move most
  // visited is played. Seeded and bounded by a count, never a clock.
  const MCTS = { playouts: 160, horizon: 6, explore: 0.9, scale: 6 };
  function worthOf(K, S, side) {
    if (K.round) return K.G.round.turn ? (K.G.round.supply ? deckWorth(K, S, side) : duelWorth(K, S, side)) : roundWorth(K, S, side);
    if (K.card) return cardWorth(K, S, side);
    if (K.tile) return tileWorth(K, S, side);
    if (K.euro) return seat(K, S, side);
    return evaluate(K, S, side);
  }
  function rewards(K, N, scale) {
    if (N.over) return K.players.map((_, s) => (N.over.winner === s ? 1 : N.over.winner === null ? 0.5 : 0));
    return K.players.map((_, s) => 1 / (1 + Math.exp(-worthOf(K, N, s) / scale)));
  }
  function mcts(K, S, o) {
    const real = T.legal(K, S);
    if (!real.length) return null;
    if (real.length === 1) return { move: real[0], score: 0, depth: 0, nodes: 0 };
    const side = S.side, roll = dice((o.seed * 2654435761) ^ (S.turn * 40503) ^ side ^ 0x5bd1);
    const P = Object.assign({}, MCTS, o.mcts || {});
    const root = { visits: 0, kids: {} };
    const quiet = (m) => m.type === 'end' || m.type === 'pass' || m.type === 'skip';
    for (let i = 0; i < P.playouts; i++) {
      let N = T.view(K, S, side, (o.seed * 7919 + i * 104729) | 0), node = root;
      const path = [];
      while (!N.over) {
        const moves = T.legal(K, N);
        if (!moves.length) break;
        for (const x of moves) if (node.kids[x.name]) node.kids[x.name].avail += 1;
        const fresh = moves.filter((x) => !node.kids[x.name]);
        let m;
        if (fresh.length) {
          m = fresh[Math.floor(roll() * fresh.length)];
          node.kids[m.name] = { visits: 0, value: 0, avail: 1, kids: {} };
        } else {
          let best = -Infinity;
          for (const x of moves) {
            const c = node.kids[x.name], u = c.value / c.visits + P.explore * Math.sqrt(Math.log(c.avail) / c.visits);
            if (u > best) { best = u; m = x; }
          }
        }
        const mover = N.side;
        N = T.apply(K, N, m);
        node = node.kids[m.name];
        path.push({ node, mover });
        if (node.visits === 0) break;
      }
      for (let d = 0; !N.over && d < P.horizon; d++) {
        const L = T.legal(K, N);
        if (!L.length) break;
        const act = L.filter((x) => !quiet(x)), pool = act.length && roll() < 0.75 ? act : L;
        N = T.apply(K, N, pool[Math.floor(roll() * pool.length)]);
      }
      const r = rewards(K, N, P.scale);
      for (const p of path) { p.node.visits += 1; p.node.value += r[p.mover]; }
      root.visits += 1;
    }
    let best = null;
    for (const m of real) { const c = root.kids[m.name]; if (c && (!best || c.visits > best.c.visits)) best = { m, c }; }
    if (!best) return { move: real[0], score: 0, depth: 0, nodes: root.visits };
    return { move: best.m, score: best.c.value / best.c.visits, depth: 1, nodes: root.visits };
  }

  function think(K, S, opts) {
    const o = Object.assign({ depth: 2, nodes: 40000, seed: 1, slack: 0, quiet: 4, use: 1 }, opts || {});
    if (o.search === 'mcts') return mcts(K, S, o);
    if (K.round) return K.G.round.turn ? planDuel(K, S, o) : planRounds(K, S, o);
    if (K.card) return planCards(K, S, o);
    if (K.tile) return planTiles(K, S, o);
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
