/**
 * THE TABLETOP KERNEL — a traditional board game as a pure function of its moves, composed from data: pieces and what
 * they can do, the turn, the rules and their exceptions, how a game ends, the clock. Chess and checkers are not coded
 * here; they are games written in these words (games/chess.js, games/checkers.js).
 *
 * SINGLE SOURCE OF TRUTH, the board kernel's discipline (board/board-kernel.js): everything lives inside
 * `buildTabletop()`, a closure referencing nothing outside itself, so a page plays the same code by emitting
 * `buildTabletop.toString()`. It reads a lattice's record (polygonizer/lattice.js) as data; the turns and mirrors of a
 * lattice vector are the lattice's own, restated here (the tests hold them equal). Pure: no clock, no Math.random;
 * `apply` returns a new state, so a mind can look ahead on copies, and the same moves are the same game to the byte.
 *
 *   G (the game): { players, pieces, setup, royal?, mustCapture?, noMoves?, repetition?, quiet?, cap?, turn?, clock? }
 *     players: [{ id, facing }] in turn order; facing the way the player's pieces go forward (a dir or diag name), so a
 *       rule written for the first player plays for every other turned to face its way
 *     pieces: { <kind>: { rules: [rule], value?, royal?, promote?: { row, to: [kind], stop? }, name?, glyph? } }
 *     rule: { vec, sym?, range?, to?, pass?, capture?, when?, mark?, chain?, partner?, safe? }
 *       vec: a way ('N', 'NE') or a lattice vector ([1, 2]), or a list of them, written as the first player sees it
 *       sym: 'all' (its orbit under the board's turns and mirror, the default) | 'rotate' | 'mirror' (itself and its
 *            reflection across the forward line) | 'none'
 *       range: 1 (a step or a leap, the default) | n | 'any' — the vector again and again (a slide), each landing but
 *              the last empty
 *       to: 'free' (empty or a foe, the default) | 'empty' | 'enemy'
 *       pass: what the cells the vector crosses must hold: 'any' (a leap, the default) | 'empty' | 'enemy'
 *       capture: 'land' (the piece landed on, the default) | 'pass' (the pieces passed over: a checkers jump) | 'mark'
 *                (the piece that left the mark on the landing cell: en passant) | 'none'
 *       when: [cond]  'unmoved' | { row: n | [n] | 'last' } (rows counted from the player's own side) | { mark: kind }
 *             (the landing cell carries a foe's mark of that kind, left by the move just made)
 *       mark: kind    leave a mark on the cells passed, for the next move only
 *       chain: true   the same piece moves again, by chain rules only, while it can (a multi-jump)
 *       partner: { kind, to: 'pass' }  the first piece along the vector's line beyond the start must be the mover's own
 *                unmoved `kind`; it lands on the cell the mover passed (castling)
 *       safe: true    the start, the cells passed and the landing are not attacked
 *     setup: { <player id>: { <kind>: [cell names] } }
 *     start: { side?, moved?: [cell names], marks?: [{ kind, cell, side, by }] } a position part-played: the player to
 *            move, the pieces that have moved, the marks the last move left (`by` the cell of the piece that left it)
 *     royal: true      a move may not leave one of the mover's royal pieces attacked; with no move left, an attacked
 *                      royal loses (mate) and an unattacked one draws (stalemate)
 *     mustCapture: true   when a capture is legal, only captures are
 *     noMoves: 'lose' (the default without royal) | 'draw'
 *     repetition: n     the same position the nth time is a draw;  quiet: { plies, reset: [kind] } a draw after that
 *                       many turns with no capture and no move by a reset kind;  cap: n turns, then a draw
 *     turn: { moves?: n (moves a turn, 1), pass?: true (a player may pass) }
 *     clock: { base, inc?, delay? } milliseconds a player: `apply(…, { ms })` spends the move's time (past the delay),
 *            adds the increment, and a player out of time loses. The kernel never reads a clock; the page measures.
 *
 *   K = compile(L, G)            the game over its board, every rule's vectors turned for every player
 *   S = start(K)                 { board: [piece | -1 per cell], pieces: [{ kind, side, at, moved }], side, left, chain,
 *                                  marks, turn, quiet, trail, clock?, over }   over: null | { winner: side | null, reason }
 *   legal(K, S) → [move]         move: { p, from, to, r, cap: [piece], partner?, promote?, pass?, name }
 *   apply(K, S, move, { ms }?) → S
 *   outcome(K, S) → over | null  ends the game when the side to move has no move (apply does not look ahead)
 *   attacked(K, S, cell, side) → bool   whether a piece of `side` could capture on the cell
 *   perft(K, S, depth) → n       positions after `depth` turns (a chain is one turn), the move generator's count
 *   key(K, S) → string           the position, for repetition
 *   view(K, S, side) → S         what a player sees (all of it, until hidden information arrives)
 */

export function buildTabletop() {
  const SYMS = { all: 1, rotate: 1, mirror: 1, none: 1 };

  // ── the board's geometry (lattice.js's, restated) ─────────────────────────────────────────────────────────────
  function rot(L, v) { return L.shape === 'square' ? [-v[1], v[0]] : [-v[1], v[0] + v[1]]; }
  function turn(L, v, k) { let w = v; for (let i = 0; i < k; i++) w = rot(L, w); return [w[0] || 0, w[1] || 0]; }
  function mir(L, v) {
    const w = L.shape === 'square' ? [-v[0], v[1]] : L.orient === 'pointy' ? [-v[0] - v[1], v[1]] : [-v[0], v[0] + v[1]];
    return [w[0] || 0, w[1] || 0];
  }
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  function topo(L) {
    const byV = new Map(), byName = new Map(), ways = new Map();
    L.cells.forEach((c, i) => { byV.set(c.v[0] + ',' + c.v[1], i); byName.set(c.name, i); });
    L.dirs.concat(L.diags).forEach((w) => ways.set(w.name, w));
    return { L, byV, byName, ways, order: L.dirs.length };
  }
  const cellAt = (T, i, v) => { const c = T.L.cells[i].v, j = T.byV.get((c[0] + v[0]) + ',' + (c[1] + v[1])); return j === undefined ? -1 : j; };

  // the turns that carry the first-written forward (N) to a player's facing
  function turnsTo(T, facing) {
    const w = T.ways.get(facing);
    if (!w) throw new Error('tabletop: no way \'' + facing + '\' to face on this board');
    const k = (w.angle - 90) / (360 / T.order);
    if (k !== Math.round(k)) throw new Error('tabletop: facing \'' + facing + '\' is not a whole turn of the board from N');
    return ((k % T.order) + T.order) % T.order;
  }
  function vecOf(T, x) {
    if (typeof x === 'string') { const w = T.ways.get(x); if (!w) throw new Error('tabletop: no way \'' + x + '\' on this board'); return w.v; }
    return x;
  }
  // a rule's vectors as the first player writes them, under its symmetry, each once
  function images(T, rule) {
    const raw = Array.isArray(rule.vec) && Array.isArray(rule.vec[0]) || (Array.isArray(rule.vec) && typeof rule.vec[0] === 'string') ? rule.vec : [rule.vec];
    const sym = rule.sym || 'all', out = [], seen = {};
    const add = (v) => { const k = v[0] + ',' + v[1]; if (!seen[k]) { seen[k] = 1; out.push(v); } };
    for (const x of raw) {
      const v = vecOf(T, x);
      if (sym === 'none') add(v);
      else if (sym === 'mirror') { add(v); add(mir(T.L, v)); }
      else { for (let k = 0; k < T.order; k++) add(turn(T.L, v, k)); if (sym === 'all') for (let k = 0; k < T.order; k++) add(turn(T.L, mir(T.L, v), k)); }
    }
    return out;
  }

  // ── compile ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function compile(L, G) {
    const T = topo(L);
    if (!G || !Array.isArray(G.players) || G.players.length < 1) throw new Error('tabletop: a game needs players');
    const players = G.players.map((p) => (typeof p === 'string' ? { id: p, facing: 'N' } : { id: p.id, facing: p.facing || 'N' }));
    const sideOf = {};
    players.forEach((p, s) => { sideOf[p.id] = s; });
    const turns = players.map((p) => turnsTo(T, p.facing));
    // rows from each player's own side: cells ranked by how far forward they stand
    const rows = players.map((p) => {
      const f = T.ways.get(p.facing), a = (f.angle * Math.PI) / 180, fx = Math.cos(a), fy = Math.sin(a);
      const d = L.cells.map((c) => Math.round((c.at[0] * fx + c.at[1] * fy) * 1e4) / 1e4);
      const levels = Array.from(new Set(d)).sort((x, y) => x - y);
      return { of: d.map((x) => levels.indexOf(x) + 1), last: levels.length };
    });
    const kinds = {}, memo = {};
    for (const id of Object.keys(G.pieces || {})) {
      const P = G.pieces[id];
      const rules = (P.rules || []).map((r, ri) => {
        if (r.sym && !SYMS[r.sym]) throw new Error('tabletop: ' + id + ' rule ' + ri + ': sym is all, rotate, mirror or none');
        const base = images(T, r);
        const vecs = players.map((_, s) => base.map((v) => {
          const w = turn(L, v, turns[s]), g = gcd(w[0], w[1]) || 1, u = [w[0] / g, w[1] / g], pass = [];
          for (let k = 1; k < g; k++) pass.push([u[0] * k, u[1] * k]);
          return { v: w, u, pass };
        }));
        if ((r.when || []).indexOf('unmoved') >= 0) memo[id] = 1;
        if (r.partner) memo[r.partner.kind] = 1;
        return Object.assign({ range: 1, to: 'free', pass: 'any', capture: 'land' }, r, { i: ri, vecs, max: r.range === 'any' ? 1e9 : (r.range || 1) });
      });
      kinds[id] = { id, rules, value: P.value || 0, royal: !!P.royal, promote: P.promote || null, chainRules: rules.filter((r) => r.chain) };
    }
    return { T, L, G, players, sideOf, rows, kinds, memo, royal: !!G.royal, quiet: G.quiet || null, moves: (G.turn && G.turn.moves) || 1 };
  }

  // ── the state ───────────────────────────────────────────────────────────────────────────────────────────────────
  function start(K) {
    const board = K.L.cells.map(() => -1), pieces = [];
    const setup = K.G.setup || {};
    for (const pid of Object.keys(setup)) {
      const side = K.sideOf[pid];
      if (side === undefined) throw new Error('tabletop: setup names a player \'' + pid + '\' the game does not have');
      for (const kind of Object.keys(setup[pid])) {
        if (!K.kinds[kind]) throw new Error('tabletop: setup places a \'' + kind + '\', a piece the game does not have');
        const cells = Array.isArray(setup[pid][kind]) ? setup[pid][kind] : [setup[pid][kind]];
        for (const name of cells) {
          const at = K.T.byName.get(name);
          if (at === undefined) throw new Error('tabletop: no cell ' + name + ' to set a ' + kind + ' on');
          if (board[at] >= 0) throw new Error('tabletop: ' + name + ' is set twice');
          board[at] = pieces.length;
          pieces.push({ kind, side, at, moved: 0 });
        }
      }
    }
    const S = { board, pieces, side: 0, left: K.moves, chain: -1, marks: [], turn: 0, quiet: 0, trail: null, over: null };
    // a position part-played: who moves, which pieces have moved, the marks the last move left
    const from = K.G.start || {}, cellOf = (name) => {
      const i = K.T.byName.get(name);
      if (i === undefined) throw new Error('tabletop: start names no cell ' + name);
      return i;
    };
    if (from.side !== undefined) {
      if (K.sideOf[from.side] === undefined) throw new Error('tabletop: start gives the move to \'' + from.side + '\', not a player');
      S.side = K.sideOf[from.side];
    }
    for (const name of from.moved || []) { const p = board[cellOf(name)]; if (p >= 0) pieces[p].moved = 1; }
    for (const mk of from.marks || []) S.marks.push({ kind: mk.kind, cell: cellOf(mk.cell), side: K.sideOf[mk.side], by: board[cellOf(mk.by)] });
    if (K.G.clock) S.clock = K.players.map(() => K.G.clock.base);
    S.trail = { k: key(K, S), prev: null };
    return S;
  }

  function key(K, S) {
    let s = S.side + '|' + S.chain + '|';
    for (let i = 0; i < S.board.length; i++) {
      const p = S.board[i];
      if (p < 0) { s += '.'; continue; }
      const P = S.pieces[p];
      s += P.kind + P.side + (K.memo[P.kind] && !P.moved ? '*' : '') + ',';
    }
    for (const m of S.marks) s += '|' + m.kind + m.cell + ':' + m.side;
    return s;
  }

  const rowOf = (K, side, cell) => K.rows[side].of[cell];
  const rowIs = (K, side, cell, want) => {
    const r = rowOf(K, side, cell), last = K.rows[side].last;
    const ok = (w) => (w === 'last' ? r === last : w === r);
    return Array.isArray(want) ? want.some(ok) : ok(want);
  };
  const markAt = (S, cell, kind, side) => { for (const m of S.marks) if (m.cell === cell && m.kind === kind && m.side !== side) return m; return null; };

  // the moves one piece could make, before the royal rule
  function pieceMoves(K, S, p, rules, out) {
    const P = S.pieces[p], side = P.side, kind = K.kinds[P.kind];
    for (const R of rules) {
      let fromRow = true;
      if (R.when) {
        for (const c of R.when) {
          if (c === 'unmoved' && P.moved) fromRow = false;
          else if (c && c.row !== undefined && !rowIs(K, side, P.at, c.row)) fromRow = false;
        }
      }
      if (!fromRow) continue;
      const markWant = R.when && R.when.find((c) => c && c.mark);
      for (const V of R.vecs[side]) {
        let cur = P.at;
        for (let n = 0; n < R.max; n++) {
          const passed = [];
          let blocked = false;
          for (const o of V.pass) {
            const c = cellAt(K.T, cur, o);
            if (c < 0) { blocked = true; break; }
            const q = S.board[c], foe = q >= 0 && S.pieces[q].side !== side;
            if ((R.pass === 'empty' && q >= 0) || (R.pass === 'enemy' && !foe)) { blocked = true; break; }
            passed.push(c);
          }
          if (blocked) break;
          const land = cellAt(K.T, cur, V.v);
          if (land < 0) break;
          const q = S.board[land];
          const foeHere = q >= 0 && S.pieces[q].side !== side;
          if (q >= 0 && !foeHere) break;   // the mover's own
          if (foeHere ? R.to === 'empty' : R.to === 'enemy') { if (foeHere) break; cur = land; continue; }
          const m = { p, from: P.at, to: land, r: R.i, cap: [] };
          if (foeHere && R.capture === 'land') m.cap.push(q);
          else if (foeHere) break;           // a foe it cannot take stops it
          if (!foeHere && markWant) {
            const mk = markAt(S, land, markWant.mark, side);
            if (!mk) { cur = land; continue; }
            if (R.capture === 'mark') m.cap.push(mk.by);
          }
          if (R.capture === 'pass') for (const c of passed) if (S.board[c] >= 0) m.cap.push(S.board[c]);
          if (passed.length) m.pass = passed;
          if (R.partner) {
            const u = V.u;
            let c = cellAt(K.T, P.at, u), found = -1;
            while (c >= 0) { if (S.board[c] >= 0) { found = S.board[c]; break; } c = cellAt(K.T, c, u); }
            const Q = found >= 0 ? S.pieces[found] : null;
            if (!Q || Q.side !== side || Q.kind !== R.partner.kind || Q.moved || !passed.length) break;
            m.partner = { p: found, to: passed[passed.length - 1] };
          }
          if (R.safe) {
            const foeSides = K.players.map((_, s) => s).filter((s) => s !== side);
            const risk = [P.at].concat(passed, [land]);
            if (risk.some((c) => foeSides.some((s) => attacked(K, S, c, s)))) break;
          }
          if (kind.promote && rowIs(K, side, land, kind.promote.row)) {
            for (const to of kind.promote.to) out.push(Object.assign({}, m, { promote: to }));
          } else out.push(m);
          if (foeHere) break;
          cur = land;
        }
      }
    }
    return out;
  }

  // whether a piece of `side` could take on the cell: each capturing rule walked backwards from it (the cell counts
  // as holding a foe), to the piece that would make it
  function attacked(K, S, cell, side) {
    for (const id in K.kinds) {
      for (const R of K.kinds[id].rules) {
        if (R.to === 'empty' || R.capture !== 'land' || R.partner) continue;
        for (const V of R.vecs[side]) {
          const back = [-V.v[0], -V.v[1]];
          let cur = cell;
          for (let n = 0; n < R.max; n++) {
            const src = cellAt(K.T, cur, back);
            if (src < 0) break;
            let blocked = false;
            for (const o of V.pass) {
              const c = cellAt(K.T, src, o);
              const q = c < 0 ? -1 : S.board[c], foe = q >= 0 && S.pieces[q].side !== side;
              if (c < 0 || (R.pass === 'empty' && q >= 0) || (R.pass === 'enemy' && !foe)) { blocked = true; break; }
            }
            if (blocked) break;
            const q = S.board[src];
            if (q >= 0) {
              const P = S.pieces[q];
              if (P.side === side && P.kind === id && whenHolds(K, R, P)) return true;
              break;
            }
            cur = src;
          }
        }
      }
    }
    return false;
  }
  function whenHolds(K, R, P) {
    if (!R.when) return true;
    for (const c of R.when) {
      if (c === 'unmoved' && P.moved) return false;
      if (c && c.row !== undefined && !rowIs(K, P.side, P.at, c.row)) return false;
      if (c && c.mark) return false;
    }
    return true;
  }

  function pseudo(K, S) {
    const out = [];
    if (S.chain >= 0) return pieceMoves(K, S, S.chain, K.kinds[S.pieces[S.chain].kind].chainRules, out);
    for (let p = 0; p < S.pieces.length; p++) {
      const P = S.pieces[p];
      if (P.at >= 0 && P.side === S.side) pieceMoves(K, S, p, K.kinds[P.kind].rules, out);
    }
    return out;
  }

  function royalsSafe(K, S, side) {
    for (const P of S.pieces) {
      if (P.at < 0 || P.side !== side || !K.kinds[P.kind].royal) continue;
      for (let s = 0; s < K.players.length; s++) if (s !== side && attacked(K, S, P.at, s)) return false;
    }
    return true;
  }

  function legal(K, S) {
    if (S.over) return [];
    let moves = pseudo(K, S);
    if (K.royal) moves = moves.filter((m) => royalsSafe(K, place(K, S, m), S.side));
    if (K.G.mustCapture && moves.some((m) => m.cap.length)) moves = moves.filter((m) => m.cap.length);
    if (K.G.turn && K.G.turn.pass && S.chain < 0) moves.push({ p: -1, from: -1, to: -1, r: -1, cap: [], pass: null });
    for (const m of moves) m.name = moveName(K, m);
    return moves;
  }

  function moveName(K, m) {
    if (m.p < 0) return 'pass';
    const n = (c) => K.L.cells[c].name;
    return n(m.from) + (m.cap.length ? 'x' : '-') + n(m.to) + (m.promote ? '=' + m.promote : '');
  }

  // the move's pieces moved, nothing else (the royal test's look)
  function place(K, S, m) {
    const board = S.board.slice(), pieces = S.pieces.slice();
    for (const q of m.cap) { board[pieces[q].at] = -1; pieces[q] = Object.assign({}, pieces[q], { at: -1 }); }
    if (m.p >= 0) {
      const P = pieces[m.p];
      board[m.from] = -1;
      board[m.to] = m.p;
      pieces[m.p] = Object.assign({}, P, { at: m.to, moved: P.moved + 1 }, m.promote ? { kind: m.promote } : {});
      if (m.partner) {
        const Q = pieces[m.partner.p];
        board[Q.at] = -1;
        board[m.partner.to] = m.partner.p;
        pieces[m.partner.p] = Object.assign({}, Q, { at: m.partner.to, moved: Q.moved + 1 });
      }
    }
    return Object.assign({}, S, { board, pieces });
  }

  function apply(K, S, m, opts) {
    const o = opts || {};
    const N = place(K, S, m);
    const R = m.p >= 0 ? K.kinds[S.pieces[m.p].kind].rules[m.r] : null;
    N.marks = [];
    if (R && R.mark && m.pass) for (const c of m.pass) N.marks.push({ kind: R.mark, cell: c, side: S.side, by: m.p });
    // the chain: the same piece again, by chain rules only, while it can
    N.chain = -1;
    if (R && R.chain && !(m.promote && K.kinds[S.pieces[m.p].kind].promote.stop)) {
      const more = pieceMoves(K, Object.assign({}, N, { chain: m.p }), m.p, K.kinds[N.pieces[m.p].kind].chainRules, []);
      if (more.length) N.chain = m.p;
    }
    const resets = K.quiet && K.quiet.reset ? K.quiet.reset : [];
    const loud = m.cap.length > 0 || (m.p >= 0 && resets.indexOf(S.pieces[m.p].kind) >= 0);
    N.quiet = loud ? 0 : S.quiet;
    const trail = loud ? null : S.trail;
    N.trail = trail;
    let ends = false;
    if (N.chain < 0) {
      N.left = S.left - 1;
      if (N.left <= 0) ends = true;
    }
    if (o.ms !== undefined && S.clock) {
      const c = K.G.clock, spent = Math.max(0, o.ms - (c.delay || 0));
      N.clock = S.clock.slice();
      N.clock[S.side] -= spent;
      if (N.clock[S.side] < 0) { N.over = { winner: K.players.length === 2 ? 1 - S.side : null, reason: 'time' }; return N; }
      if (ends) N.clock[S.side] += c.inc || 0;
    }
    if (ends) {
      N.side = (S.side + 1) % K.players.length;
      N.left = K.moves;
      N.turn = S.turn + 1;
      if (!loud) N.quiet = S.quiet + 1;
    }
    // ends without looking ahead: a royal taken, a position seen too often, too long quiet, too many turns
    if (K.royal) {
      for (let s = 0; s < K.players.length; s++) {
        if (N.pieces.some((P) => P.side === s && K.kinds[P.kind].royal && P.at < 0)) { N.over = { winner: K.players.length === 2 ? 1 - s : null, reason: 'royal' }; return N; }
      }
    }
    if (ends) {
      const k = key(K, N);
      // the positions since the last move that cannot be undone (a capture, a reset kind): none before can return
      N.trail = { k, prev: trail };
      let times = 0;
      for (let t = N.trail; t; t = t.prev) if (t.k === k) times++;
      if (K.G.repetition && times >= K.G.repetition) N.over = { winner: null, reason: 'repetition' };
      else if (K.quiet && N.quiet >= K.quiet.plies) N.over = { winner: null, reason: 'quiet' };
      else if (K.G.cap && N.turn >= K.G.cap) N.over = { winner: null, reason: 'cap' };
    }
    return N;
  }

  function outcome(K, S, moves) {
    if (S.over) return S.over;
    const list = moves || legal(K, S);
    if (list.length) return null;
    const two = K.players.length === 2, other = two ? 1 - S.side : null;
    if (K.royal) return royalsSafe(K, S, S.side) ? { winner: null, reason: 'stalemate' } : { winner: other, reason: 'mate' };
    return K.G.noMoves === 'draw' ? { winner: null, reason: 'no-moves' } : { winner: other, reason: 'no-moves' };
  }

  // positions after `depth` turns; a chain's further jumps are the same turn
  function perft(K, S, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of legal(K, S)) {
      const N = apply(K, S, m);
      if (N.over && N.over.reason === 'royal') continue;
      n += N.side === S.side && N.chain >= 0 ? perft(K, N, depth) : perft(K, N, depth - 1);
    }
    return n;
  }

  function view(K, S) { return S; }

  return { compile, start, legal, apply, outcome, attacked, perft, key, view, moveName, turn, mirror: mir };
}

const _tabletop = buildTabletop();
export const tabletopCompile = _tabletop.compile;
export const tabletopStart = _tabletop.start;
export const tabletopLegal = _tabletop.legal;
export const tabletopApply = _tabletop.apply;
export const tabletopOutcome = _tabletop.outcome;
export const tabletopAttacked = _tabletop.attacked;
export const tabletopPerft = _tabletop.perft;
export const tabletopKey = _tabletop.key;
export const tabletopView = _tabletop.view;
export const tabletopTurn = _tabletop.turn;
export const tabletopMirror = _tabletop.mirror;
