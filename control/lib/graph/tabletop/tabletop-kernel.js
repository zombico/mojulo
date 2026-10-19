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
    const K = { T, L, G, players, sideOf, rows, kinds, memo, royal: !!G.royal, quiet: G.quiet || null, moves: (G.turn && G.turn.moves) || 1 };
    defsCompile(K);
    placementCompile(K);
    if (G.build || G.dice || G.opening) euroCompile(K);
    if (G.tiles) tileCompile(K);
    if (G.piles) cardCompile(K);
    return K;
  }

  // ── the state ───────────────────────────────────────────────────────────────────────────────────────────────────
  function start(K) {
    if (K.card) return cardStart(K);
    if (K.tile) return tileStart(K);
    if (K.euro) return euroStart(K);
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
    if (K.G.stock) S.stock = K.players.map(() => Object.assign({}, K.G.stock));
    S.passes = 0;
    S.back = null;
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
    if (K.drops.length) dropMoves(K, S, out);
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
    if (K.card) return cardLegal(K, S);
    if (K.tile) return tileLegal(K, S);
    if (K.euro) return euroLegal(K, S);
    if (S.over) return [];
    let moves = pseudo(K, S);
    if (K.royal) moves = moves.filter((m) => royalsSafe(K, place(K, S, m), S.side));
    if (K.G.mustCapture && moves.some((m) => m.cap.length)) moves = moves.filter((m) => m.cap.length);
    const pass = K.G.turn && K.G.turn.pass;
    if (pass && S.chain < 0 && (pass !== 'stuck' || !moves.length)) moves.push({ p: -1, from: -1, to: -1, r: -1, cap: [], pass: null });
    for (const m of moves) m.name = moveName(K, m);
    return moves;
  }

  function moveName(K, m) {
    if (m.drop) return m.drop + '@' + K.L.cells[m.to].name;
    if (m.p < 0) return 'pass';
    const n = (c) => K.L.cells[c].name;
    return n(m.from) + (m.cap.length ? 'x' : '-') + n(m.to) + (m.promote ? '=' + m.promote : '');
  }

  // the move's pieces moved, nothing else (the royal test's look)
  function place(K, S, m) {
    const board = S.board.slice(), pieces = S.pieces.slice();
    for (const q of m.cap) { board[pieces[q].at] = -1; pieces[q] = Object.assign({}, pieces[q], { at: -1 }); }
    if (m.drop) {
      board[m.to] = pieces.length;
      pieces.push({ kind: m.drop, side: S.side, at: m.to, moved: 0 });
      for (const c of m.flip || []) pieces[board[c]] = Object.assign({}, pieces[board[c]], { side: S.side });
    }
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
    if (K.card) return cardApply(K, S, m);
    if (K.tile) return tileApply(K, S, m);
    if (K.euro) return euroApply(K, S, m);
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
    if (m.drop && S.stock) {
      N.stock = S.stock.slice();
      N.stock[S.side] = Object.assign({}, S.stock[S.side]);
      N.stock[S.side][m.drop] -= 1;
    }
    N.passes = m.p < 0 && !m.drop ? (S.passes || 0) + 1 : 0;
    if (K.G.enclose) N.back = sidesKey(S);
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
    if (!N.over && (K.G.win || K.G.end)) { const done = placementEnd(K, N, m, S.side); if (done) N.over = done; }
    return N;
  }

  function outcome(K, S, moves) {
    if (S.over) return S.over;
    if (K.euro || K.tile || K.card) return null;
    const list = moves || legal(K, S);
    if (list.length) return null;
    if (K.G.end) return scoredEnd(K, S);
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

  // ── placement: pieces dropped from stock, groups, enclosure, lines, connection, scores ─────────────────────────────
  //   G.pieces[kind].drop: true | { fall?: way, flip?: true | 'must' }  the kind is placed from the player's stock onto an
  //     empty cell; `fall` the way it drops until something stops it (the cell beyond must be filled or off the board);
  //     `flip` turns every line of foes it closes between itself and one of the player's own ('must': only where it does)
  //   G.stock { <kind>: n } each player's supply (unlimited when absent)
  //   G.enclose { suicide?: false, ko?: true }  a group (one side's pieces joined across edges) with no empty neighbour is
  //     taken; a drop that leaves its own group so (taking nothing) is refused; ko: no drop may bring the board back to
  //     how it stood before the other player's last move
  //   G.win { line?: k, connect?: true }  k of the mover's in a row along any way; a group joining the mover's first row
  //     and its last (rows counted from its own facing)
  //   G.end { passes?: n, full?: true, score: [scorer] }  n passes in a row, or a full board, ends the game; the most
  //     points wins, a tie draws; a player with no move and no pass also ends it
  //     scorer: { count: true | [kind] } pieces on the board | { territory: true } empty areas bordered by one side only |
  //     { majority: { regions?: [name], points: [first, second…] } } per region, by pieces in it, ties sharing the places'
  //     points (rounded down) | { largest: true } the biggest group | { add: [n per player] }
  //   G.regions { <name>: [cells] } named areas of the board
  //   G.turn.pass true (any turn) | 'stuck' (only with no other move)
  function placementCompile(K) {
    const G = K.G, T = K.T, L = K.L;
    K.drops = Object.keys(G.pieces || {}).filter((id) => G.pieces[id].drop).map((id) => {
      const d = G.pieces[id].drop === true ? {} : G.pieces[id].drop;
      return { id, fall: d.fall ? vecOf(T, d.fall) : null, flip: d.flip || null };
    });
    K.near = L.cells.map((c) => c.n.filter((j) => j >= 0));
    const ways = L.dirs.concat(L.diags).map((w) => w.v), axes = [];
    for (const v of ways) if (!axes.some((a) => a[0] === -v[0] && a[1] === -v[1])) axes.push(v);
    K.ways = ways;
    K.axes = axes;
    K.regions = {};
    for (const name of Object.keys(G.regions || {})) {
      K.regions[name] = G.regions[name].map((n) => {
        const i = T.byName.get(n);
        if (i === undefined) throw new Error('tabletop: region ' + name + ' names no cell ' + n);
        return i;
      });
    }
    if (G.win && G.win.line !== undefined && !(G.win.line >= 2)) throw new Error('tabletop: win.line is a length, 2 or more');
  }

  const sidesOf = (S) => S.board.map((p) => (p < 0 ? -1 : S.pieces[p].side));
  function sidesKey(S) { let k = ''; for (const p of S.board) k += p < 0 ? '.' : S.pieces[p].side; return k; }

  // a group: the cells of one side joined to `from` across edges, and the empty cells beside them
  function groupAt(K, sides, from) {
    const side = sides[from], cells = [from], libs = {}, seen = {};
    seen[from] = 1;
    for (let i = 0; i < cells.length; i++) {
      for (const j of K.near[cells[i]]) {
        if (sides[j] === side) { if (!seen[j]) { seen[j] = 1; cells.push(j); } }
        else if (sides[j] < 0) libs[j] = 1;
      }
    }
    return { side, cells, libs: Object.keys(libs).length };
  }

  function flipsAt(K, sides, c, side) {
    const out = [];
    for (const v of K.ways) {
      const run = [];
      let j = cellAt(K.T, c, v);
      while (j >= 0 && sides[j] >= 0 && sides[j] !== side) { run.push(j); j = cellAt(K.T, j, v); }
      if (run.length && j >= 0 && sides[j] === side) for (const x of run) out.push(x);
    }
    return out;
  }

  function dropMoves(K, S, out) {
    if (S.chain >= 0) return;
    const side = S.side, sides = sidesOf(S), E = K.G.enclose;
    for (const D of K.drops) {
      if (S.stock && !((S.stock[side][D.id] || 0) > 0)) continue;
      for (let c = 0; c < S.board.length; c++) {
        if (S.board[c] >= 0) continue;
        if (D.fall) { const below = cellAt(K.T, c, D.fall); if (below >= 0 && S.board[below] < 0) continue; }
        const m = { p: -1, drop: D.id, from: -1, to: c, r: -1, cap: [] };
        if (D.flip) {
          m.flip = flipsAt(K, sides, c, side);
          if (!m.flip.length && D.flip === 'must') continue;
        }
        if (E) {
          // the drop's enclosures: foe groups left with no empty neighbour are taken, its own may not be left so
          const after = sides.slice();
          after[c] = side;
          const taken = {};
          for (const j of K.near[c]) {
            if (after[j] < 0 || after[j] === side || taken[j]) continue;
            const g = groupAt(K, after, j);
            if (!g.libs) for (const x of g.cells) taken[x] = 1;
          }
          for (const x in taken) { m.cap.push(S.board[x]); after[x] = -1; }
          if (!m.cap.length && !E.suicide && !groupAt(K, after, c).libs) continue;
          if (E.ko !== false && m.cap.length && S.back !== null) {
            let k = '';
            for (const x of after) k += x < 0 ? '.' : x;
            if (k === S.back) continue;
          }
        }
        out.push(m);
      }
    }
  }

  // the most of one side in a row through cell c, along any axis
  function lineThrough(K, sides, c) {
    const side = sides[c];
    let best = 1;
    for (const v of K.axes) {
      let n = 1;
      for (const d of [1, -1]) {
        let j = cellAt(K.T, c, [v[0] * d, v[1] * d]);
        while (j >= 0 && sides[j] === side) { n++; j = cellAt(K.T, j, [v[0] * d, v[1] * d]); }
      }
      if (n > best) best = n;
    }
    return best;
  }

  function connects(K, sides, c, side) {
    const g = groupAt(K, sides, c), R = K.rows[side];
    let lo = false, hi = false;
    for (const x of g.cells) { if (R.of[x] === 1) lo = true; if (R.of[x] === R.last) hi = true; }
    return lo && hi;
  }

  // each player's points by the game's scorers
  function scores(K, S) {
    const n = K.players.length, out = K.players.map(() => 0), sides = sidesOf(S);
    for (const sc of (K.G.end && K.G.end.score) || []) {
      if (sc.count) {
        for (const P of S.pieces) if (P.at >= 0 && P.side >= 0 && (sc.count === true || sc.count.indexOf(P.kind) >= 0)) out[P.side] += 1;
      }
      if (sc.territory) {
        const seen = {};
        for (let c = 0; c < sides.length; c++) {
          if (sides[c] >= 0 || seen[c]) continue;
          const area = [c], by = {};
          seen[c] = 1;
          for (let i = 0; i < area.length; i++) {
            for (const j of K.near[area[i]]) {
              if (sides[j] < 0) { if (!seen[j]) { seen[j] = 1; area.push(j); } } else by[sides[j]] = 1;
            }
          }
          const owners = Object.keys(by);
          if (owners.length === 1) out[+owners[0]] += area.length;
        }
      }
      if (sc.majority) {
        const names = sc.majority.regions || Object.keys(K.regions), pts = sc.majority.points || [1];
        for (const name of names) {
          const tally = K.players.map(() => 0);
          for (const c of K.regions[name] || []) if (sides[c] >= 0) tally[sides[c]] += 1;
          const order = tally.map((t, s) => [s, t]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
          let place = 0;
          while (place < order.length && place < pts.length) {
            const tied = order.filter((x) => x[1] === order[place][1]);
            let pool = 0;
            for (let k = place; k < place + tied.length; k++) pool += pts[k] || 0;
            for (const [s] of tied) out[s] += Math.floor(pool / tied.length);
            place += tied.length;
          }
        }
      }
      if (sc.largest) {
        const seen = {};
        const big = K.players.map(() => 0);
        for (let c = 0; c < sides.length; c++) {
          if (sides[c] < 0 || seen[c]) continue;
          const g = groupAt(K, sides, c);
          for (const x of g.cells) seen[x] = 1;
          if (g.cells.length > big[g.side]) big[g.side] = g.cells.length;
        }
        for (let s = 0; s < n; s++) out[s] += big[s];
      }
      if (sc.add) for (let s = 0; s < n; s++) out[s] += sc.add[s] || 0;
    }
    return out;
  }

  function scoredEnd(K, S) {
    const sc = scores(K, S), top = Math.max.apply(null, sc), lead = sc.map((x, s) => (x === top ? s : -1)).filter((s) => s >= 0);
    return { winner: lead.length === 1 ? lead[0] : null, reason: 'score', scores: sc };
  }

  // what ends a placement game when a move is made: a line or a connection for the mover, passes, a full board
  function placementEnd(K, N, m, side) {
    const W = K.G.win || {}, E = K.G.end;
    if (m.to >= 0 && (W.line || W.connect)) {
      const sides = sidesOf(N);
      if (W.line && lineThrough(K, sides, m.to) >= W.line) return { winner: side, reason: 'line' };
      if (W.connect && connects(K, sides, m.to, side)) return { winner: side, reason: 'connect' };
    }
    if (E) {
      if (E.passes && N.passes >= E.passes) return scoredEnd(K, N);
      if (E.full && N.board.every((p) => p >= 0)) return scoredEnd(K, N);
    }
    return null;
  }

  // the fewest empty cells `side` must still fill to join its first row to its last (own cells free, foes walls)
  function connectDistance(K, S, side) {
    const sides = sidesOf(S), R = K.rows[side], INF = 1e9, dist = sides.map(() => INF), dq = [];
    for (let c = 0; c < sides.length; c++) {
      if (R.of[c] !== 1 || (sides[c] >= 0 && sides[c] !== side)) continue;
      dist[c] = sides[c] === side ? 0 : 1;
      dq.push(c);
    }
    // a 0-1 search kept small: relax until nothing moves
    let changed = true;
    while (changed) {
      changed = false;
      for (let c = 0; c < sides.length; c++) {
        if (dist[c] >= INF) continue;
        for (const j of K.near[c]) {
          if (sides[j] >= 0 && sides[j] !== side) continue;
          const d = dist[c] + (sides[j] === side ? 0 : 1);
          if (d < dist[j]) { dist[j] = d; changed = true; }
        }
      }
    }
    let best = INF;
    for (let c = 0; c < sides.length; c++) if (R.of[c] === R.last && dist[c] < best) best = dist[c];
    return best;
  }

  // the windows of k cells along any axis that hold only `side`'s pieces and empties, by how many of its own
  function lineWindows(K, S, side, k) {
    const sides = sidesOf(S), count = [];
    for (let i = 0; i <= k; i++) count.push(0);
    for (let c = 0; c < sides.length; c++) {
      for (const v of K.axes) {
        let own = 0, ok = true, j = c;
        for (let i = 0; i < k; i++) {
          if (j < 0 || (sides[j] >= 0 && sides[j] !== side)) { ok = false; break; }
          if (sides[j] === side) own++;
          if (i < k - 1) j = cellAt(K.T, j, v);
        }
        if (ok) count[own]++;
      }
    }
    return count;
  }

  // ── tiles: a board laid a tile at a time ────────────────────────────────────────────────────────────────────────────
  // A game with `tiles` grows its board from a start tile: each turn the player draws a tile from a seeded bag and lays
  // it on an empty cell beside the laid ones, turned any of the board's turns, every edge it shares matching its
  // neighbour's; then may claim one of its segments with a piece from stock, if the feature that segment is part of
  // has no claim yet. A feature is segments joined across matching edges: complete when no edge of it is open (a centre
  // feature: when every cell round it holds a tile), it pays at once, to the most claims in it, and its claims return.
  // When the bag is empty, the claimed features left open pay their lower rate and the game ends on points.
  //
  //   G.tiles { types: { <id>: { segments: [{ type, edges: [k] } | { type, centre: true }] } }, bag: { <id>: n },
  //     start: { tile, at }, claim?: { kind, stock }, features: { <type>: { complete, incomplete } } }
  //     edges k count from the board's first way round (a square's E N W S; a pointy hex's E NE NW W SW SE); an edge in
  //     no segment is plain; a centre feature's tiles are its own and those round it; points are a feature's tiles × rate
  //   state: { pieces: [objects: a laid tile { kind, side: -1, at, rot }, a claim { kind, side, at, seg }],
  //     tiles: [the laid tile's object id | null, a cell each], bag: [kind], drawn: kind, phase: 'tile' | 'claim', last,
  //     claims: [object id] (the claims standing), stock: [n] (claims in hand, counted), score: [n], r }
  //   moves: { type: 'tile', at, rot } | { type: 'redraw' } (a tile that fits nowhere is set aside) | { type: 'claim', seg }
  //     | { type: 'skip' }
  function tileCompile(K) {
    const G = K.G, D = G.tiles, n = K.L.dirs.length, types = D.types || {};
    const labels = {}, segOf = {};
    for (const id of Object.keys(types)) {
      const segs = types[id].segments || [];
      labels[id] = new Array(n).fill('plain');
      segOf[id] = new Array(n).fill(-1);
      segs.forEach((g, i) => {
        if (g.centre) return;
        for (const k of g.edges || []) {
          if (!(k >= 0 && k < n)) throw new Error('tabletop: tile ' + id + ' names an edge ' + k + ' (0 to ' + (n - 1) + ' on this board)');
          if (segOf[id][k] >= 0) throw new Error('tabletop: tile ' + id + ' has two segments on edge ' + k);
          labels[id][k] = g.type;
          segOf[id][k] = i;
        }
      });
    }
    for (const id of Object.keys(D.bag || {})) if (!types[id]) throw new Error('tabletop: the bag holds a tile ' + id + ' the game does not describe');
    if (!D.start || !types[D.start.tile]) throw new Error('tabletop: tiles.start is { tile, at }, a tile the game describes');
    const ring = K.L.cells.map((c) => Array.from(new Set(c.n.concat(c.d).filter((j) => j >= 0))));
    K.tile = { n, types, labels, segOf, ring };
  }

  // a laid tile's edge e (a way round the board): its label, and the segment on it (-1: plain)
  const tileEdge = (K, o, e) => {
    const t = o.kind, k = (e - o.rot + K.tile.n) % K.tile.n;
    return { label: K.tile.labels[t][k], seg: K.tile.segOf[t][k] };
  };

  function tileStart(K) {
    const G = K.G, D = G.tiles, n = K.L.cells.length;
    const S = { board: new Array(n).fill(-1), pieces: [], pending: [], side: 0, turn: 0, over: null, phase: 'tile',
      tiles: new Array(n).fill(null), bag: [], drawn: null, last: -1, claims: [], r: mixSeed(G.seed || 1, 0, 0),
      score: K.players.map(() => 0), stock: K.players.map(() => (D.claim ? D.claim.stock : 0)) };
    const at = K.T.byName.get(D.start.at);
    if (at === undefined) throw new Error('tabletop: tiles.start names no cell ' + D.start.at);
    S.tiles[at] = make(S, { kind: D.start.tile, side: -1, at, moved: 0, rot: 0 });
    for (const id of Object.keys(D.bag || {})) for (let i = 0; i < D.bag[id]; i++) S.bag.push(id);
    for (let i = S.bag.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); const t = S.bag[i]; S.bag[i] = S.bag[j]; S.bag[j] = t; }
    S.drawn = S.bag.shift() || null;
    return S;
  }

  // whether tile t turned rot fits cell c: beside a laid tile, every shared edge matching
  function tileFits(K, S, c, t, rot) {
    const n = K.tile.n, near = K.L.cells[c].n;
    let touches = false;
    for (let e = 0; e < n; e++) {
      const j = near[e];
      if (j < 0 || S.tiles[j] === null) continue;
      touches = true;
      const mine = K.tile.labels[t][(e - rot + n) % n], theirs = tileEdge(K, S.pieces[S.tiles[j]], (e + n / 2) % n).label;
      if (mine !== theirs) return false;
    }
    return touches;
  }

  // the features on the board: segments joined across edges; open edges counted; a centre feature by its ring
  function tileFeatures(K, S) {
    const n = K.tile.n, parent = {}, open = {}, find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const keyOf = (c, s) => c * 32 + s, out = [];
    const laid = (c) => (S.tiles[c] === null ? null : S.pieces[S.tiles[c]]);
    for (let c = 0; c < S.tiles.length; c++) {
      const T = laid(c);
      if (!T) continue;
      (K.tile.types[T.kind].segments || []).forEach((g, s) => { if (!g.centre) { parent[keyOf(c, s)] = keyOf(c, s); open[keyOf(c, s)] = 0; } });
    }
    for (let c = 0; c < S.tiles.length; c++) {
      const T = laid(c);
      if (!T) continue;
      for (let e = 0; e < n; e++) {
        const mine = tileEdge(K, T, e);
        if (mine.seg < 0) continue;
        const j = K.L.cells[c].n[e];
        const other = j >= 0 && laid(j) ? tileEdge(K, laid(j), (e + n / 2) % n) : null;
        if (other && other.seg >= 0) { const a = find(keyOf(c, mine.seg)), b = find(keyOf(j, other.seg)); if (a !== b) parent[a] = b; }
        else open[keyOf(c, mine.seg)] += 1;
      }
    }
    const groups = {};
    for (const k in parent) {
      const root = find(+k), c = Math.floor(+k / 32), s = +k % 32;
      if (!groups[root]) groups[root] = { type: K.tile.types[laid(c).kind].segments[s].type, parts: [], cells: {}, open: 0, claims: [] };
      groups[root].parts.push([c, s]);
      groups[root].cells[c] = 1;
      groups[root].open += open[k];
    }
    for (const g of Object.values(groups)) out.push({ type: g.type, parts: g.parts, size: Object.keys(g.cells).length, open: g.open, centre: false });
    for (let c = 0; c < S.tiles.length; c++) {
      const T = laid(c);
      if (!T) continue;
      (K.tile.types[T.kind].segments || []).forEach((g, s) => {
        if (!g.centre) return;
        const filled = K.tile.ring[c].filter((j) => S.tiles[j] !== null).length;
        out.push({ type: g.type, parts: [[c, s]], size: 1 + filled, open: K.tile.ring[c].length - filled, centre: true });
      });
    }
    for (const f of out) f.claims = S.claims.filter((q) => f.parts.some(([c, s]) => c === S.pieces[q].at && s === S.pieces[q].seg));
    return out;
  }

  function tileLegal(K, S) {
    if (S.over) return [];
    const out = [];
    if (S.phase === 'tile') {
      for (let c = 0; c < S.tiles.length; c++) {
        if (S.tiles[c] !== null) continue;
        for (let rot = 0; rot < K.tile.n; rot++) if (tileFits(K, S, c, S.drawn, rot)) out.push({ type: 'tile', at: c, rot });
      }
      if (!out.length) out.push({ type: 'redraw' });
    } else {
      if (S.stock[S.side] > 0) {
        const feats = tileFeatures(K, S), T = S.pieces[S.tiles[S.last]];
        (K.tile.types[T.kind].segments || []).forEach((g, s) => {
          const f = feats.find((x) => x.parts.some(([c, q]) => c === S.last && q === s));
          if (f && !f.claims.length) out.push({ type: 'claim', seg: s });
        });
      }
      out.push({ type: 'skip' });
    }
    for (const m of out) m.name = m.type === 'tile' ? 'tile@' + K.L.cells[m.at].name + '/' + m.rot : m.type === 'claim' ? 'claim ' + K.tile.types[S.pieces[S.tiles[S.last]].kind].segments[m.seg].type + ' ' + m.seg : m.type;
    return out;
  }

  // the claimed features done now pay (on `final`, every claimed one, at its rate); their claims return
  function tilePay(K, N, final) {
    const F = K.G.tiles.features || {};
    for (const f of tileFeatures(K, N)) {
      if (!f.claims.length) continue;
      const done = f.open === 0;
      if (!done && !final) continue;
      const rate = F[f.type] ? (done ? F[f.type].complete : F[f.type].incomplete) : 0;
      const count = K.players.map(() => 0);
      for (const q of f.claims) count[N.pieces[q].side] += 1;
      const top = Math.max.apply(null, count);
      count.forEach((x, side) => { if (x === top) N.score[side] += rate * f.size; });
      // a claim returns: its object leaves the board, the stock counts it again
      for (const q of f.claims) { N.stock[N.pieces[q].side] += 1; N.pieces[q].at = -1; }
      N.claims = N.claims.filter((q) => f.claims.indexOf(q) < 0);
    }
  }

  function tileEnd(K, N) {
    tilePay(K, N, true);
    const top = Math.max.apply(null, N.score), lead = N.score.map((x, s) => (x === top ? s : -1)).filter((s) => s >= 0);
    N.over = { winner: lead.length === 1 ? lead[0] : null, reason: 'score', scores: N.score.slice() };
  }

  function tileApply(K, S, m) {
    const N = clone(S), side = S.side;
    if (m.type === 'tile') {
      if (S.phase !== 'tile' || S.tiles[m.at] !== null || !tileFits(K, S, m.at, S.drawn, m.rot)) throw new Error('tabletop: the tile does not fit there');
      N.tiles[m.at] = make(N, { kind: S.drawn, side: -1, at: m.at, moved: 0, rot: m.rot });
      N.last = m.at;
      N.drawn = null;
      N.phase = 'claim';
      return N;
    }
    if (m.type === 'redraw') {
      N.drawn = N.bag.shift() || null;
      if (!N.drawn) tileEnd(K, N);
      return N;
    }
    if (m.type === 'claim') {
      N.claims.push(make(N, { kind: K.G.tiles.claim.kind, side, at: S.last, moved: 0, seg: m.seg }));
      N.stock[side] -= 1;
    }
    // the turn ends: what is done pays, the next player draws
    tilePay(K, N, false);
    N.side = (side + 1) % K.players.length;
    N.turn = S.turn + 1;
    N.phase = 'tile';
    N.drawn = N.bag.shift() || null;
    if (!N.drawn) tileEnd(K, N);
    return N;
  }

  // ── the object model ────────────────────────────────────────────────────────────────────────────────────────────
  // Every game thing in play or owned is an object in one table, S.pieces (named for the board, where it began):
  // { kind, side, at, moved } as a board piece has always been, `at` its place or -1 off the board; off the board,
  // `zone` names where it is (a deck, a hand, a discard…), and the zones hold object ids in order. Only when used:
  // `ready: false` (exhausted), `counters: { <name>: n }`, `mods: [modifier]`; an object leaving play keeps none of
  // them. A shared supply of like things (a supply pile, a bag of tiles, a bank, a stock of meeples) is counted or
  // listed by kind, and an object is made when one comes out of it.
  //   derive(K, S, id) → the object's characteristics: the definition of its kind (K.defs: the game's pieces, card
  //     types, tile types and economy cards, one namespace), then its modifiers in a fixed order: set, add, counters (a
  //     counter named after a stat adds to it), grant and remove abilities; by timestamp within each. With no counters
  //     and no modifiers it is the definition itself, shared, so a game that uses neither pays nothing.
  //   modifier: { t, set?: { <field>: v, stats?: {…} }, add?: { <field>: n, stats?: {…} }, grant?: [ability],
  //     remove?: [ability] | 'all' }   (an ability is any value; removed by equality of its JSON)
  function defsCompile(K) {
    const G = K.G, defs = {}, from = {};
    const add = (family, table) => {
      for (const kind of Object.keys(table || {})) {
        if (from[kind]) throw new Error('tabletop: \'' + kind + '\' names both a ' + from[kind] + ' and a ' + family + '; give each its own name');
        from[kind] = family;
        const d = table[kind];
        defs[kind] = Object.assign({}, d, { kind, family, stats: Object.assign({}, d.stats), abilities: (d.abilities || []).slice() });
      }
    };
    add('piece', G.pieces);
    add('card', G.piles && G.piles.types);
    add('tile', G.tiles && G.tiles.types);
    add('card', G.cards);
    K.defs = defs;
  }
  function derive(K, S, id) {
    const o = S.pieces[id], base = K.defs[o.kind];
    if (!o.counters && !(o.mods && o.mods.length)) return base;
    const out = Object.assign({}, base, { stats: Object.assign({}, base.stats), abilities: base.abilities.slice() });
    const mods = (o.mods || []).slice().sort((a, b) => (a.t || 0) - (b.t || 0));
    const each = (field, fn) => { for (const m of mods) if (m[field]) fn(m[field]); };
    each('set', (x) => { for (const f in x) { if (f === 'stats') Object.assign(out.stats, x.stats); else out[f] = x[f]; } });
    each('add', (x) => { for (const f in x) { if (f === 'stats') { for (const st in x.stats) out.stats[st] = (out.stats[st] || 0) + x.stats[st]; } else out[f] = (out[f] || 0) + x[f]; } });
    for (const c in o.counters || {}) if (c in out.stats) out.stats[c] += o.counters[c];
    for (const m of mods) {
      if (m.remove === 'all') out.abilities = [];
      else if (m.remove) { const gone = m.remove.map((a) => JSON.stringify(a)); out.abilities = out.abilities.filter((a) => gone.indexOf(JSON.stringify(a)) < 0); }
      if (m.grant) out.abilities = out.abilities.concat(m.grant);
    }
    return out;
  }
  function make(S, o) { S.pieces.push(o); return S.pieces.length - 1; }
  const kindsOf = (S, ids) => ids.map((id) => (id === null || id === undefined ? null : S.pieces[id].kind));

  // ── cards: piles, hands and markets ─────────────────────────────────────────────────────────────────────────────
  // A game with `piles` is played with cards, not on a board. Each player has zones (deck, hand, discard, play,
  // tableau) holding its cards as objects; a supply of piles anyone may take from, counted by kind; a market, a row of
  // cards face up (objects) refilled from its own deck (listed by kind).
  //
  //   G.piles { types: { <id>: { cost?, coin?, points?, treasure?, play?: [effect], tags?: { <tag>: value } } },
  //     take: 'build' (the default) | 'draft', supply?: { <id>: n }, start?: { deck: { <id>: n } },
  //     market?: { deck: { <id>: n }, row: n }, draw?: 5, actions?: 1, buys?: 1, score?: [scorer], end: { … } }
  //   build: each player draws a hand from its deck; a turn plays cards (a treasure freely, any other for one of the
  //     turn's actions), buys from the supply or the market with the coins they gave (one buy each), and ends: hand and
  //     play to the discard, a new hand drawn, the discard shuffled into a deck from the dice when the deck runs out
  //   draft: a turn takes one card from the market row to the player's tableau, and the row refills
  //   effect: { draw: n } | { coin: n } | { actions: n } | { buys: n } | { points: n } | { gain: n } (a card from the
  //     supply costing up to n, to the discard) | { trash: n } (up to n cards from the hand, gone)
  //   end: { piles?: n (that many supply piles empty), pile?: id (that pile empty), market?: true (row and deck empty),
  //     turns?: n }, checked as a turn ends
  //   scorer: { points: true } the cards' points | { distinct: { tag, table } } table[number of different values held] |
  //     { same: { tag, table } } table[number held] for each value | { most: { tag, value?, bonus } } the most cards
  //     (of that value) earn the bonus, a tie sharing it | { sum: { tag } } the tag's numbers added
  //   state: { pieces: [card objects], zones: [{ deck, hand, discard, play, tableau }] (object ids), supply,
  //     market: { row: [id | null], deck: [kind] } | null, trash: [id], score, act: { actions, buys, coins }, pending, r }
  //   a move names a card by its kind (play coin1); `id` is the object it takes
  const IN_PLAY = { play: 1, tableau: 1 };
  function cardCompile(K) {
    const C = K.G.piles, types = C.types || {};
    const known = (id, where) => { if (!types[id]) throw new Error('tabletop: ' + where + ' names a card ' + id + ' the game does not describe'); };
    for (const id of Object.keys(C.supply || {})) known(id, 'the supply');
    for (const id of Object.keys((C.start && C.start.deck) || {})) known(id, 'the starting deck');
    for (const id of Object.keys((C.market && C.market.deck) || {})) known(id, 'the market');
    K.card = { types, draft: C.take === 'draft', hand: C.draw === undefined ? 5 : C.draw, actions: C.actions === undefined ? 1 : C.actions, buys: C.buys === undefined ? 1 : C.buys };
  }

  function shuffle(S, list) {
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
    return list;
  }
  const expand = (counts) => { const out = []; for (const id of Object.keys(counts || {})) for (let i = 0; i < counts[id]; i++) out.push(id); return out; };
  // an object to a zone: leaving play it keeps no counters, exhaustion or modifiers
  function zoneTo(S, id, zone) {
    const o = S.pieces[id];
    if (IN_PLAY[o.zone] && !IN_PLAY[zone]) { delete o.ready; delete o.counters; delete o.mods; }
    o.zone = zone;
    return id;
  }

  function drawCards(S, side, n) {
    const Z = S.zones[side];
    for (let i = 0; i < n; i++) {
      if (!Z.deck.length) { Z.deck = shuffle(S, Z.discard); Z.discard = []; for (const id of Z.deck) zoneTo(S, id, 'deck'); }
      if (!Z.deck.length) break;
      Z.hand.push(zoneTo(S, Z.deck.pop(), 'hand'));
    }
  }
  const marketCard = (S, kind) => make(S, { kind, side: -1, at: -1, moved: 0, zone: 'market' });

  function cardStart(K) {
    const C = K.G.piles, n = K.players.length;
    const S = { board: [], pieces: [], pending: [], side: 0, turn: 0, over: null, r: mixSeed(K.G.seed || 1, 0, 0),
      zones: [], supply: Object.assign({}, C.supply || {}), market: null, trash: [], score: K.players.map(() => 0),
      act: { actions: K.card.actions, buys: K.card.buys, coins: 0 } };
    for (let s = 0; s < n; s++) {
      const deck = shuffle(S, expand(C.start && C.start.deck)).map((kind) => make(S, { kind, side: s, at: -1, moved: 0, zone: 'deck' }));
      S.zones.push({ deck, hand: [], discard: [], play: [], tableau: [] });
      if (!K.card.draft) drawCards(S, s, K.card.hand);
    }
    if (C.market) {
      const deck = shuffle(S, expand(C.market.deck)), row = [];
      for (let i = 0; i < C.market.row; i++) row.push(deck.length ? marketCard(S, deck.pop()) : null);
      S.market = { row, deck };
    }
    return S;
  }

  const costOf = (K, kind) => K.defs[kind].cost || 0;
  // each kind in a list once, with the first object of it
  const firsts = (S, ids) => { const seen = {}, out = []; for (const id of ids) { const k = S.pieces[id].kind; if (!seen[k]) { seen[k] = 1; out.push(id); } } return out; };

  function cardLegal(K, S) {
    if (S.over) return [];
    const out = [], side = S.side, Z = S.zones[side];
    if (S.pending.length) {
      const d = S.pending[0];
      if (d.do === 'gain') for (const id of Object.keys(S.supply)) { if (S.supply[id] > 0 && costOf(K, id) <= d.upTo) out.push({ type: 'gain', card: id }); }
      if (d.do === 'trash') { for (const id of firsts(S, Z.hand)) out.push({ type: 'trash', card: S.pieces[id].kind, id }); out.push({ type: 'done' }); }
    } else if (K.card.draft) {
      S.market.row.forEach((id, slot) => { if (id !== null) out.push({ type: 'take', slot }); });
      if (!out.length) out.push({ type: 'end' });
    } else {
      for (const id of firsts(S, Z.hand)) {
        const t = derive(K, S, id);
        if (t.treasure || (t.play && t.play.length && S.act.actions > 0)) out.push({ type: 'play', card: t.kind, id });
      }
      if (S.act.buys > 0) {
        for (const id of Object.keys(S.supply)) if (S.supply[id] > 0 && costOf(K, id) <= S.act.coins) out.push({ type: 'buy', card: id });
        if (S.market) S.market.row.forEach((id, slot) => { if (id !== null && (derive(K, S, id).cost || 0) <= S.act.coins) out.push({ type: 'buy', slot }); });
      }
      out.push({ type: 'end' });
    }
    for (const m of out) {
      const card = m.card || (m.slot !== undefined ? S.pieces[S.market.row[m.slot]].kind : null);
      m.name = m.type + (card ? ' ' + card : '') + (m.slot !== undefined ? '@' + m.slot : '');
    }
    return out;
  }

  function cardEffects(K, N, side, list) {
    for (const e of list || []) {
      if (e.draw) drawCards(N, side, e.draw);
      if (e.coin) N.act.coins += e.coin;
      if (e.actions) N.act.actions += e.actions;
      if (e.buys) N.act.buys += e.buys;
      if (e.points) N.score[side] += e.points;
      if (e.gain) N.pending.push({ side, do: 'gain', upTo: e.gain });
      if (e.trash) N.pending.push({ side, do: 'trash', left: e.trash });
    }
  }

  function cardScores(K, S) {
    const scorers = K.G.piles.score || [{ points: true }];
    const owned = S.zones.map((Z) => Z.deck.concat(Z.hand, Z.discard, Z.play, Z.tableau).map((id) => derive(K, S, id)));
    const out = S.score.slice();
    const tag = (c, t) => (c.tags || {})[t];
    for (const sc of scorers) {
      owned.forEach((cards, s) => {
        if (sc.points) for (const c of cards) out[s] += c.points || 0;
        if (sc.distinct) {
          const vals = new Set(cards.map((c) => tag(c, sc.distinct.tag)).filter((v) => v !== undefined));
          const tb = sc.distinct.table;
          out[s] += tb[Math.min(vals.size, tb.length - 1)] || 0;
        }
        if (sc.same) {
          const by = {};
          for (const c of cards) { const v = tag(c, sc.same.tag); if (v !== undefined) by[v] = (by[v] || 0) + 1; }
          const tb = sc.same.table;
          for (const v in by) out[s] += tb[Math.min(by[v], tb.length - 1)] || 0;
        }
        if (sc.sum) for (const c of cards) out[s] += +(tag(c, sc.sum.tag) || 0);
      });
      if (sc.most) {
        const m = sc.most, counts = owned.map((cards) => cards.filter((c) => (m.value === undefined ? tag(c, m.tag) !== undefined : tag(c, m.tag) === m.value)).length);
        const top = Math.max.apply(null, counts);
        if (top > 0) { const lead = counts.map((c, s) => (c === top ? s : -1)).filter((s) => s >= 0); for (const s of lead) out[s] += Math.floor(m.bonus / lead.length); }
      }
    }
    return out;
  }

  function cardEnded(K, N) {
    const E = (K.G.piles && K.G.piles.end) || {};
    const empty = Object.keys(N.supply).filter((id) => N.supply[id] <= 0).length;
    if (E.piles && empty >= E.piles) return true;
    if (E.pile && (N.supply[E.pile] || 0) <= 0) return true;
    if (E.market && N.market && !N.market.deck.length && N.market.row.every((x) => x === null)) return true;
    if (E.turns && N.turn >= E.turns) return true;
    return false;
  }

  function cardTurnEnds(K, N, side) {
    if (!K.card.draft) {
      const Z = N.zones[side];
      for (const id of Z.hand.concat(Z.play)) Z.discard.push(zoneTo(N, id, 'discard'));
      Z.hand = [];
      Z.play = [];
      drawCards(N, side, K.card.hand);
      N.act = { actions: K.card.actions, buys: K.card.buys, coins: 0 };
    }
    N.side = (side + 1) % K.players.length;
    N.turn += 1;
    if (cardEnded(K, N)) {
      const sc = cardScores(K, N), top = Math.max.apply(null, sc), lead = sc.map((x, s) => (x === top ? s : -1)).filter((s) => s >= 0);
      N.over = { winner: lead.length === 1 ? lead[0] : null, reason: 'score', scores: sc };
    }
  }

  function cardApply(K, S, m) {
    const N = clone(S), side = S.side, Z = N.zones[side];
    const d = N.pending.length ? N.pending.shift() : null;
    // the object a move names: its own id when it still stands where the move found it, else the first of its kind
    const inHand = () => {
      const i = m.id !== undefined && Z.hand.indexOf(m.id) >= 0 ? Z.hand.indexOf(m.id) : Z.hand.findIndex((id) => N.pieces[id].kind === m.card);
      if (i < 0) throw new Error('tabletop: no ' + m.card + ' in the hand');
      return Z.hand.splice(i, 1)[0];
    };
    const take = (slot) => {
      const id = N.market.row[slot];
      N.market.row[slot] = N.market.deck.length ? marketCard(N, N.market.deck.pop()) : null;
      N.pieces[id].side = side;
      return id;
    };
    const fresh = (kind) => make(N, { kind, side, at: -1, moved: 0, zone: 'discard' });
    if (m.type === 'play') {
      const id = inHand();
      Z.play.push(zoneTo(N, id, 'play'));
      const t = derive(K, N, id);
      if (!t.treasure) N.act.actions -= 1;
      if (t.coin) N.act.coins += t.coin;
      cardEffects(K, N, side, t.play);
    } else if (m.type === 'buy') {
      const cost = m.slot !== undefined ? (N.market.row[m.slot] !== null ? derive(K, N, N.market.row[m.slot]).cost || 0 : Infinity) : costOf(K, m.card);
      if (cost > N.act.coins || N.act.buys <= 0) throw new Error('tabletop: that cannot be bought now');
      N.act.coins -= cost;
      N.act.buys -= 1;
      if (m.slot !== undefined) Z.discard.push(zoneTo(N, take(m.slot), 'discard'));
      else { N.supply[m.card] -= 1; Z.discard.push(fresh(m.card)); }
    } else if (m.type === 'take') {
      Z.tableau.push(zoneTo(N, take(m.slot), 'tableau'));
      cardTurnEnds(K, N, side);
    } else if (m.type === 'gain') {
      N.supply[m.card] -= 1;
      Z.discard.push(fresh(m.card));
    } else if (m.type === 'trash') {
      N.trash.push(zoneTo(N, inHand(), 'trash'));
      if (d.left > 1 && Z.hand.length) N.pending.unshift(Object.assign({}, d, { left: d.left - 1 }));
    } else if (m.type === 'end') {
      cardTurnEnds(K, N, side);
    }
    while (N.pending.length && !cardLegal(K, N).length) N.pending.shift();
    return N;
  }

  // what a player may know: its own hand; every deck's order, the others' hands and the market's deck dealt again
  function cardView(K, S, side, seed) {
    const N = clone(S);
    N.r = mixSeed(seed || 1, S.turn, side);
    N.zones.forEach((Z, s) => {
      if (s === side) { shuffle(N, Z.deck); return; }
      const pool = shuffle(N, Z.deck.concat(Z.hand)), n = Z.hand.length;
      Z.hand = pool.slice(0, n);
      Z.deck = pool.slice(n);
      for (const id of Z.hand) N.pieces[id].zone = 'hand';
      for (const id of Z.deck) N.pieces[id].zone = 'deck';
    });
    if (N.market) shuffle(N, N.market.deck);
    return N;
  }

  // ── the economy: euro games ─────────────────────────────────────────────────────────────────────────────────────
  // A game with `build`, `dice` or `opening` is played on places, not only cells: one index over the cells, then the
  // corners, then the edges (a settlement on a corner, a road on an edge, the robber on a cell). Its state carries,
  // beside the board and the pieces: { phase: 'opening' | 'roll' | 'main', pending: [decision], hand: [{ <res>: n }],
  // bank: { <res>: n }, stock: [{ <kind>: n }], deck: { <deck>: [card kind] }, playedTurn, awards: { <id>: side | -1 },
  // last: [place], roll, r (the dice, mulberry32) }; a card bought is an object in S.pieces off the board (zone 'hand',
  // `fresh` the turn it is bought, then zone 'played'), counted by `held`.
  //
  //   G.pieces[kind].on 'cell' | 'corner' | 'edge';  G.setup.neutral: pieces nobody owns (the robber)
  //   G.stock { <kind>: n } each player's pieces off the board;  G.resources { <res>: n } the bank
  //   G.build { <kind>: { cost: { <res>: n }, need: [cond], upgrade?: kind } }
  //     cond: { apart: n } no piece on a corner within n steps along the edges | { touch: [kind] | 'last' } a place
  //           next to this one holds the player's own kind (or is the place it set last) | { reach: [kind], block:
  //           [kind] } an edge whose end is not a foe's block kind and meets another edge holding the player's kind |
  //           { any: [cond] } one of them
  //   G.opening [{ order: 'forward' | 'reverse', steps: [{ place: kind, need?, yield? }] }] placements before the first
  //     roll, free; `yield` pays one of each resource the corner's cells give
  //   G.dice { n, sides };  G.numbers { <cell>: n };  G.produce { yields: { <cell type>: res }, amount: { <kind>: n },
  //     block: kind }  a roll pays every cell showing it, not under the block piece, to each piece on its corners; the
  //     bank's shortage: a resource it cannot pay everyone goes to nobody, unless only one player is owed it
  //   G.rolls { <n>: [effect] } a roll that does something else (7)
  //   G.decks { <deck>: { cards: { <card>: n }, cost } };  G.cards { <card>: { play?: [effect] } } a card is played one
  //     a turn, never the turn it was bought
  //   effect: { discard: { over: n } } each player holding more gives up half | { robber: kind } move the neutral kind,
  //     then take one card at random from a player beside it | { free: kind, n } place without paying | { gain: n }
  //     take from the bank | { claim: true } name a resource and take it from every other player
  //   G.exchange { rate } the bank swaps rate of one resource for one of another (off unless given)
  //   G.trade { offers?, shapes? } trading between players, after the roll: the player to move offers cards for cards
  //     to every other player (`offers` a turn, 2); each answers in turn order, accept (if they hold what is asked) or
  //     decline; the offerer then deals with one who accepted, or cancels. Any offer of whole cards the offerer holds,
  //     asking for others, is legal (`validOffer`); `legal` lists the plain shapes ([give, get] counts of one resource
  //     for another: [[1, 1], [2, 1], [1, 2]] by default) so a mind has a short list to weigh
  //   G.score { pieces: { <kind>: n }, cards: { <card>: n }, awards: { <id>: { vp, min, trail?: kind, block?: [kind],
  //     played?: card } }, win: n }  an award goes to the one strictly ahead at its measure (the longest trail of a kind,
  //     broken by a foe's block kind; the most of a card played), a holder keeping it on a tie; a player at `win` on
  //     their own turn wins
  //   G.cap n turns, then a draw
  function rnd(S) {
    S.r = (S.r + 0x6D2B79F5) >>> 0;
    let t = S.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const mixSeed = (a, b, c) => ((Math.imul((a >>> 0) ^ 0x9E3779B9, 2654435761) ^ Math.imul(b + 1, 40503) ^ Math.imul(c + 7, 2246822519)) >>> 0);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const count = (h) => { let n = 0; for (const k in h) n += h[k]; return n; };

  function euroCompile(K) {
    const L = K.L, G = K.G, nC = L.cells.length, nK = L.corners.length, nE = L.edges.length;
    const names = L.cells.map((c) => c.name).concat(L.corners.map((c) => c.name), L.edges.map((e) => e.name));
    const byName = new Map(names.map((n, i) => [n, i]));
    L.cells.forEach((c) => {
      L.diags.forEach((d, k) => byName.set(c.name + '.' + d.name.toLowerCase(), nC + c.k[k]));
      L.dirs.forEach((d, k) => byName.set(c.name + '.' + d.name.toLowerCase(), nC + nK + c.e[k]));
    });
    // the place graph: what each place touches
    const near = names.map((_, p) => {
      if (p < nC) return L.cells[p].k.map((k) => nC + k).concat(L.cells[p].e.map((e) => nC + nK + e));
      if (p < nC + nK) { const c = L.corners[p - nC]; return c.edges.map((e) => nC + nK + e).concat(c.cells); }
      const e = L.edges[p - nC - nK]; return e.ends.map((k) => nC + k).concat(e.cells);
    });
    const cornerNext = L.corners.map((c, k) => c.edges.map((e) => { const en = L.edges[e].ends; return en[0] === k ? en[1] : en[0]; }));
    const on = {};
    for (const id of Object.keys(G.pieces || {})) {
      on[id] = G.pieces[id].on || 'cell';
      if (['cell', 'corner', 'edge'].indexOf(on[id]) < 0) throw new Error('tabletop: ' + id + ' stands on a cell, a corner or an edge');
    }
    for (const id of Object.keys(G.build || {})) if (!K.kinds[id]) throw new Error('tabletop: build names a \'' + id + '\', a piece the game does not have');
    const num = L.cells.map((c) => (G.numbers && G.numbers[c.name] !== undefined ? G.numbers[c.name] : null));
    // the chance of each roll, from the dice
    let dist = { 0: 1 };
    const D = G.dice || null;
    if (D) for (let i = 0; i < D.n; i++) { const nx = {}; for (const v in dist) for (let f = 1; f <= D.sides; f++) nx[+v + f] = (nx[+v + f] || 0) + dist[v] / D.sides; dist = nx; }
    K.euro = true;
    K.P = { nC, nK, nE, n: nC + nK + nE, names, byName, near, cornerNext, on, num, prob: dist };
    K.res = Object.keys(G.resources || {});
  }

  const placeOf = (K, p) => (p < K.P.nC ? 'cell' : p < K.P.nC + K.P.nK ? 'corner' : 'edge');
  const placeName = (K, p) => K.P.names[p];
  const actorOf = (S) => (S.pending && S.pending.length ? S.pending[0].side : S.side);
  const occupant = (S, p) => (S.board[p] >= 0 ? S.pieces[S.board[p]] : null);

  function euroStart(K) {
    const G = K.G, n = K.players.length;
    const S = { board: new Array(K.P.n).fill(-1), pieces: [], side: 0, turn: 0, over: null, phase: G.opening ? 'opening' : 'roll',
      pending: [], hand: [], bank: Object.assign({}, G.resources || {}), stock: [], deck: {},
      playedTurn: false, offersTurn: 0, awards: {}, last: [], roll: null, r: mixSeed(G.seed || 1, 0, 0) };
    for (let s = 0; s < n; s++) {
      S.hand.push(K.res.reduce((h, r) => { h[r] = 0; return h; }, {}));
      S.stock.push(Object.assign({}, G.stock || {}));
      S.last.push(-1);
    }
    const setup = G.setup || {};
    for (const pid of Object.keys(setup)) {
      const side = pid === 'neutral' ? -1 : K.sideOf[pid];
      if (side === undefined) throw new Error('tabletop: setup names a player \'' + pid + '\' the game does not have');
      for (const kind of Object.keys(setup[pid])) {
        if (!K.kinds[kind]) throw new Error('tabletop: setup places a \'' + kind + '\', a piece the game does not have');
        for (const name of [].concat(setup[pid][kind])) {
          const at = K.P.byName.get(name);
          if (at === undefined || placeOf(K, at) !== K.P.on[kind]) throw new Error('tabletop: no ' + K.P.on[kind] + ' ' + name + ' to set a ' + kind + ' on');
          S.board[at] = S.pieces.length;
          S.pieces.push({ kind, side, at, moved: 0 });
        }
      }
    }
    for (const id of Object.keys(G.decks || {})) {
      const list = [];
      for (const c of Object.keys(G.decks[id].cards)) for (let i = 0; i < G.decks[id].cards[c]; i++) list.push(c);
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
      S.deck[id] = list;
    }
    for (const id of Object.keys((G.score && G.score.awards) || {})) S.awards[id] = -1;
    for (const round of G.opening || []) {
      const order = K.players.map((_, s) => s);
      if (round.order === 'reverse') order.reverse();
      for (const s of order) for (const st of round.steps) S.pending.push({ side: s, do: 'place', kind: st.place, need: st.need || null, yield: !!st.yield });
    }
    settle(K, S);
    return S;
  }

  // a decision nobody can answer is dropped; the opening over, the first player rolls
  function settle(K, S) {
    while (S.pending.length && !pendingMoves(K, S, S.pending[0]).length) S.pending.shift();
    if (S.phase === 'opening' && !S.pending.length) { S.phase = 'roll'; S.side = 0; }
  }

  function afford(h, cost) { for (const r in cost || {}) if ((h[r] || 0) < cost[r]) return false; return true; }

  function needs(K, S, side, kind, at, need) {
    for (const c of need || []) if (!holds(K, S, side, at, c)) return false;
    return true;
  }
  function holds(K, S, side, at, c) {
    const P = K.P;
    if (c.any) return c.any.some((x) => holds(K, S, side, at, x));
    if (c.apart !== undefined) {
      if (placeOf(K, at) !== 'corner') return true;
      let ring = [at - P.nC];
      const seen = {};
      seen[ring[0]] = 1;
      for (let d = 0; d < c.apart; d++) {
        const nx = [];
        for (const k of ring) for (const j of P.cornerNext[k]) if (!seen[j]) { seen[j] = 1; nx.push(j); if (S.board[P.nC + j] >= 0) return false; }
        ring = nx;
      }
      return true;
    }
    if (c.touch !== undefined) {
      if (c.touch === 'last') return S.last[side] >= 0 && P.near[at].indexOf(S.last[side]) >= 0;
      return P.near[at].some((q) => { const o = occupant(S, q); return o && o.side === side && c.touch.indexOf(o.kind) >= 0; });
    }
    if (c.reach) {
      if (placeOf(K, at) !== 'edge') return false;
      for (const kp of P.near[at]) {
        if (placeOf(K, kp) !== 'corner') continue;
        const o = occupant(S, kp);
        if (o && o.side !== side && o.side >= 0 && (c.block || []).indexOf(o.kind) >= 0) continue;
        for (const q of P.near[kp]) {
          if (q === at || placeOf(K, q) !== 'edge') continue;
          const r = occupant(S, q);
          if (r && r.side === side && c.reach.indexOf(r.kind) >= 0) return true;
        }
      }
      return false;
    }
    return true;
  }

  // the places a kind may go for `side`: empty places of its sort meeting the needs (an upgrade: the side's own
  // pieces of the kind it replaces)
  function spots(K, S, side, kind, need) {
    const out = [], B = (K.G.build || {})[kind] || {};
    if (B.upgrade) {
      for (const P of S.pieces) if (P.at >= 0 && P.side === side && P.kind === B.upgrade) out.push(P.at);
      return out;
    }
    const sort = K.P.on[kind], lo = sort === 'cell' ? 0 : sort === 'corner' ? K.P.nC : K.P.nC + K.P.nK;
    const hi = sort === 'cell' ? K.P.nC : sort === 'corner' ? K.P.nC + K.P.nK : K.P.n;
    for (let p = lo; p < hi; p++) if (S.board[p] < 0 && needs(K, S, side, kind, p, need)) out.push(p);
    return out;
  }

  function victims(K, S, cell, side) {
    const out = [];
    for (const q of K.P.near[cell]) {
      const o = occupant(S, q);
      if (o && o.side >= 0 && o.side !== side && out.indexOf(o.side) < 0 && count(S.hand[o.side]) > 0) out.push(o.side);
    }
    return out.sort((a, b) => a - b);
  }

  function pendingMoves(K, S, d) {
    const out = [], side = d.side;
    if (d.do === 'place' || d.do === 'free') {
      if ((S.stock[side][d.kind] || 0) <= 0) return out;
      const need = d.need || ((K.G.build || {})[d.kind] || {}).need;
      for (const at of spots(K, S, side, d.kind, need)) out.push({ type: 'build', kind: d.kind, at, free: true });
    } else if (d.do === 'discard') {
      for (const r of K.res) if (S.hand[side][r] > 0) out.push({ type: 'discard', res: r });
    } else if (d.do === 'robber') {
      const P = S.pieces.find((x) => x.kind === d.kind && x.side < 0);
      for (let c = 0; c < K.P.nC; c++) if (!P || c !== P.at) out.push({ type: 'robber', at: c });
    } else if (d.do === 'steal') {
      for (const v of victims(K, S, d.cell, side)) out.push({ type: 'steal', from: v });
    } else if (d.do === 'gain') {
      for (const r of K.res) if (S.bank[r] > 0) out.push({ type: 'gain', res: r });
    } else if (d.do === 'claim') {
      for (const r of K.res) out.push({ type: 'claim', res: r });
    } else if (d.do === 'answer') {
      if (afford(S.hand[side], d.offer.get)) out.push({ type: 'accept' });
      out.push({ type: 'decline' });
    } else if (d.do === 'choose') {
      for (const s of d.accepted) if (afford(S.hand[s], d.offer.get) && afford(S.hand[side], d.offer.give)) out.push({ type: 'deal', with: s });
      if (out.length) out.push({ type: 'cancel' });
    }
    return out;
  }

  const bundle = (h) => Object.keys(h).filter((r) => h[r] > 0).map((r) => h[r] + ' ' + r).join(' + ');
  function someoneHolds(K, S, side, h) {
    for (let s = 0; s < K.players.length; s++) if (s !== side && afford(S.hand[s], h)) return true;
    return false;
  }
  // why an offer cannot be made now (null when it can): the player to move, after the roll, nothing pending, offers
  // left this turn, whole cards it holds for whole cards of other resources
  function validOffer(K, S, offer) {
    const T = K.G.trade;
    if (!T) return 'this game has no trading';
    if (S.over || S.phase !== 'main' || S.pending.length) return 'an offer is made after the roll, with nothing else waiting';
    if ((S.offersTurn || 0) >= (T.offers || 2)) return 'no offers left this turn';
    if (!offer || typeof offer !== 'object' || !offer.give || !offer.get) return 'an offer is { give: { <res>: n }, get: { <res>: n } }';
    let gave = 0, got = 0;
    for (const part of ['give', 'get']) {
      for (const r in offer[part]) {
        const n = offer[part][r];
        if (K.res.indexOf(r) < 0) return 'no resource \'' + r + '\'';
        if (!Number.isInteger(n) || n < 0) return 'an offer counts whole cards';
        if (part === 'give') gave += n; else got += n;
      }
    }
    if (!gave || !got) return 'an offer gives something and asks something';
    for (const r in offer.give) if (offer.give[r] > 0 && (offer.get[r] || 0) > 0) return 'an offer does not give and ask the same resource';
    if (!afford(S.hand[S.side], offer.give)) return 'the offer gives cards the player does not hold';
    return null;
  }

  function euroLegal(K, S) {
    if (S.over) return [];
    let out = [];
    const side = S.side;
    if (S.pending.length) out = pendingMoves(K, S, S.pending[0]);
    else {
      if (S.phase === 'roll') out.push({ type: 'roll' });
      else {
        const B = K.G.build || {};
        for (const kind of Object.keys(B)) {
          if (!afford(S.hand[side], B[kind].cost) || (S.stock[side][kind] || 0) <= 0) continue;
          for (const at of spots(K, S, side, kind, B[kind].need)) out.push({ type: 'build', kind, at });
        }
        for (const id of Object.keys(K.G.decks || {})) if (S.deck[id].length && afford(S.hand[side], K.G.decks[id].cost)) out.push({ type: 'buy', deck: id });
        if (K.G.trade && (S.offersTurn || 0) < (K.G.trade.offers || 2)) {
          for (const [gn, tn] of K.G.trade.shapes || [[1, 1], [2, 1], [1, 2]]) {
            for (const g of K.res) {
              if (S.hand[side][g] < gn) continue;
              for (const t of K.res) {
                if (t === g) continue;
                const offer = { give: {}, get: {} };
                offer.give[g] = gn; offer.get[t] = tn;
                if (someoneHolds(K, S, side, offer.get)) out.push({ type: 'offer', offer });
              }
            }
          }
        }
        if (K.G.exchange) {
          const rate = K.G.exchange.rate;
          for (const g of K.res) if (S.hand[side][g] >= rate) for (const t of K.res) if (t !== g && S.bank[t] > 0) out.push({ type: 'exchange', give: g, get: t });
        }
      }
      if (!S.playedTurn) {
        const hand = held(S, side), aged = held(S, side, 'hand', true);
        for (const c of Object.keys(hand)) {
          const card = (K.G.cards || {})[c];
          if (card && card.play && aged[c] > 0) out.push({ type: 'play', card: c });
        }
      }
      if (S.phase === 'main') out.push({ type: 'end' });
    }
    for (const m of out) m.name = euroName(K, S, m);
    return out;
  }

  function euroName(K, S, m) {
    switch (m.type) {
      case 'build': return m.kind + '@' + placeName(K, m.at);
      case 'robber': return 'robber@' + placeName(K, m.at);
      case 'steal': return 'steal ' + K.players[m.from].id;
      case 'discard': case 'gain': case 'claim': return m.type + ' ' + m.res;
      case 'buy': return 'buy ' + m.deck;
      case 'play': return 'play ' + m.card;
      case 'exchange': return 'exchange ' + m.give + '>' + m.get;
      case 'offer': return 'offer ' + bundle(m.offer.give) + ' for ' + bundle(m.offer.get);
      case 'deal': return 'deal ' + K.players[m.with].id;
      default: return m.type;
    }
  }

  function effects(K, N, actor, list) {
    for (const e of list || []) {
      if (e.discard) {
        for (let i = 0; i < K.players.length; i++) {
          const s = (actor + i) % K.players.length, h = count(N.hand[s]);
          if (h > e.discard.over) N.pending.push({ side: s, do: 'discard', n: Math.floor(h / 2) });
        }
      }
      if (e.robber) N.pending.push({ side: actor, do: 'robber', kind: e.robber });
      if (e.free) N.pending.push({ side: actor, do: 'free', kind: e.free, n: e.n || 1 });
      if (e.gain) N.pending.push({ side: actor, do: 'gain', n: e.gain });
      if (e.claim) N.pending.push({ side: actor, do: 'claim' });
    }
  }

  function produce(K, N, v) {
    const Pr = K.G.produce;
    if (!Pr) return;
    const block = N.pieces.filter((x) => x.kind === Pr.block && x.at >= 0).map((x) => x.at);
    const owed = K.players.map(() => ({}));
    for (let c = 0; c < K.P.nC; c++) {
      if (K.P.num[c] !== v || block.indexOf(c) >= 0) continue;
      const res = Pr.yields[K.L.cells[c].type];
      if (!res) continue;
      for (const q of K.P.near[c]) {
        const o = occupant(N, q);
        if (o && o.side >= 0 && Pr.amount[o.kind]) owed[o.side][res] = (owed[o.side][res] || 0) + Pr.amount[o.kind];
      }
    }
    for (const r of K.res) {
      const who = owed.map((h, s) => [s, h[r] || 0]).filter((x) => x[1] > 0);
      const total = who.reduce((a, x) => a + x[1], 0);
      if (!total) continue;
      if (total <= N.bank[r]) for (const [s, n] of who) { N.hand[s][r] += n; N.bank[r] -= n; }
      else if (who.length === 1) { N.hand[who[0][0]][r] += N.bank[r]; N.bank[r] = 0; }
    }
  }

  function euroApply(K, S, m) {
    const N = clone(S), G = K.G;
    const actor = actorOf(S), d = N.pending.length ? N.pending.shift() : null;
    const again = (n) => { if (d && n > 1) N.pending.unshift(Object.assign({}, d, { n: n - 1 })); };
    if (m.type === 'build') {
      const B = (G.build || {})[m.kind] || {};
      if (!m.free) for (const r in B.cost || {}) { N.hand[actor][r] -= B.cost[r]; N.bank[r] += B.cost[r]; }
      const was = N.board[m.at];
      if (B.upgrade && was >= 0) {
        N.stock[actor][N.pieces[was].kind] = (N.stock[actor][N.pieces[was].kind] || 0) + 1;
        N.pieces[was] = { kind: m.kind, side: actor, at: m.at, moved: 0 };
      } else {
        N.board[m.at] = N.pieces.length;
        N.pieces.push({ kind: m.kind, side: actor, at: m.at, moved: 0 });
      }
      N.stock[actor][m.kind] -= 1;
      N.last[actor] = m.at;
      if (d && d.yield && G.produce) {
        for (const c of K.P.near[m.at]) {
          if (placeOf(K, c) !== 'cell') continue;
          const r = G.produce.yields[K.L.cells[c].type];
          if (r && N.bank[r] > 0) { N.hand[actor][r] += 1; N.bank[r] -= 1; }
        }
      }
      if (d && d.do === 'free') again(d.n);
    } else if (m.type === 'roll') {
      let v = 0;
      for (let i = 0; i < G.dice.n; i++) v += 1 + Math.floor(rnd(N) * G.dice.sides);
      N.roll = v;
      N.phase = 'main';
      if (G.rolls && G.rolls[v]) effects(K, N, actor, G.rolls[v]);
      else produce(K, N, v);
    } else if (m.type === 'discard') {
      N.hand[actor][m.res] -= 1; N.bank[m.res] += 1;
      again(d.n);
    } else if (m.type === 'robber') {
      const p = N.pieces.findIndex((x) => x.kind === d.kind && x.side < 0);
      if (p >= 0) { N.board[N.pieces[p].at] = -1; N.pieces[p].at = m.at; N.board[m.at] = p; }
      if (victims(K, N, m.at, actor).length) N.pending.unshift({ side: actor, do: 'steal', cell: m.at });
    } else if (m.type === 'steal') {
      const h = N.hand[m.from], total = count(h);
      let pick = Math.floor(rnd(N) * total);
      for (const r of K.res) { if (pick < h[r]) { h[r] -= 1; N.hand[actor][r] += 1; break; } pick -= h[r]; }
    } else if (m.type === 'gain') {
      N.hand[actor][m.res] += 1; N.bank[m.res] -= 1;
      again(d.n);
    } else if (m.type === 'claim') {
      for (let s = 0; s < K.players.length; s++) if (s !== actor) { N.hand[actor][m.res] += N.hand[s][m.res]; N.hand[s][m.res] = 0; }
    } else if (m.type === 'buy') {
      const D = G.decks[m.deck];
      for (const r in D.cost || {}) { N.hand[actor][r] -= D.cost[r]; N.bank[r] += D.cost[r]; }
      make(N, { kind: N.deck[m.deck].shift(), side: actor, at: -1, moved: 0, zone: 'hand', fresh: true });
    } else if (m.type === 'play') {
      // the newest of its kind held since before this turn
      let id = -1;
      for (let i = N.pieces.length - 1; i >= 0 && id < 0; i--) { const o = N.pieces[i]; if (o.at < 0 && o.side === actor && o.zone === 'hand' && o.kind === m.card && !o.fresh) id = i; }
      if (id < 0) throw new Error('tabletop: no ' + m.card + ' to play');
      N.pieces[id].zone = 'played';
      N.playedTurn = true;
      effects(K, N, actor, G.cards[m.card].play);
    } else if (m.type === 'exchange') {
      const rate = G.exchange.rate;
      N.hand[actor][m.give] -= rate; N.bank[m.give] += rate;
      N.hand[actor][m.get] += 1; N.bank[m.get] -= 1;
    } else if (m.type === 'offer') {
      const why = validOffer(K, S, m.offer);
      if (why) throw new Error('tabletop: ' + why);
      N.offersTurn = (S.offersTurn || 0) + 1;
      const offer = { give: Object.assign({}, m.offer.give), get: Object.assign({}, m.offer.get) };
      for (let i = 1; i < K.players.length; i++) N.pending.push({ side: (actor + i) % K.players.length, do: 'answer', offer, from: actor });
      N.pending.push({ side: actor, do: 'choose', offer, accepted: [] });
    } else if (m.type === 'accept' || m.type === 'decline') {
      N.answers = (N.answers || []).concat([{ side: actor, offer: d.offer, from: d.from, yes: m.type === 'accept' }]);
      if (m.type === 'accept') { const c = N.pending.find((x) => x.do === 'choose' && x.side === d.from); if (c) c.accepted.push(actor); }
    } else if (m.type === 'deal') {
      for (const r in d.offer.give) { N.hand[actor][r] -= d.offer.give[r]; N.hand[m.with][r] += d.offer.give[r]; }
      for (const r in d.offer.get) { N.hand[m.with][r] -= d.offer.get[r]; N.hand[actor][r] += d.offer.get[r]; }
    } else if (m.type === 'cancel') {
      // the offer lapses
    } else if (m.type === 'end') {
      N.side = (S.side + 1) % K.players.length;
      N.phase = 'roll';
      N.turn = S.turn + 1;
      for (const o of N.pieces) if (o.fresh) delete o.fresh;
      N.playedTurn = false;
      N.offersTurn = 0;
      N.answers = [];
      N.roll = null;
    }
    settle(K, N);
    award(K, N);
    if (N.phase !== 'opening' && G.score && G.score.win && score(K, N, N.side) >= G.score.win) N.over = { winner: N.side, reason: 'score' };
    else if (G.cap && N.turn >= G.cap) N.over = { winner: null, reason: 'cap' };
    return N;
  }

  // the longest trail of `kind` the side has on the edges, a foe's `block` piece on a corner breaking it
  function trail(K, S, side, kind, block) {
    const P = K.P, mine = {};
    for (const x of S.pieces) if (x.at >= 0 && x.side === side && x.kind === kind && placeOf(K, x.at) === 'edge') mine[x.at] = 1;
    const cut = (kp) => { const o = occupant(S, kp); return !!o && o.side >= 0 && o.side !== side && (block || []).indexOf(o.kind) >= 0; };
    let best = 0;
    const walk = (kp, used, len) => {
      if (len > best) best = len;
      if (len > 0 && cut(kp)) return;
      for (const e of P.near[kp]) {
        if (!mine[e] || used[e]) continue;
        const other = P.near[e].find((q) => q !== kp && placeOf(K, q) === 'corner');
        used[e] = 1;
        walk(other, used, len + 1);
        used[e] = 0;
      }
    };
    for (const e in mine) for (const kp of P.near[+e]) if (placeOf(K, kp) === 'corner') walk(kp, {}, 0);
    return best;
  }

  function measure(K, S, side, A) {
    if (A.trail) return trail(K, S, side, A.trail, A.block);
    if (A.played) return held(S, side, 'played')[A.played] || 0;
    return 0;
  }

  function award(K, S) {
    const A = (K.G.score && K.G.score.awards) || {};
    for (const id of Object.keys(A)) {
      const m = K.players.map((_, s) => measure(K, S, s, A[id])), top = Math.max.apply(null, m), h = S.awards[id];
      if (top < A[id].min) { S.awards[id] = -1; continue; }
      if (h >= 0 && m[h] === top) continue;
      const lead = m.map((x, s) => (x === top ? s : -1)).filter((s) => s >= 0);
      S.awards[id] = lead.length === 1 ? lead[0] : -1;
    }
  }

  // the economy's cards are objects off the board: in a hand (zone 'hand'; `fresh` the turn one is bought) or played
  // (zone 'played'); counted by kind for the rules that read them (`aged`: only those held since before this turn)
  function held(S, side, zone, aged) {
    const out = {}, z = zone || 'hand';
    for (const o of S.pieces) if (o.at < 0 && o.side === side && o.zone === z && !(aged && o.fresh)) out[o.kind] = (out[o.kind] || 0) + 1;
    return out;
  }

  // a player's points: `open` leaves out what only they can see (cards that score in the hand)
  function score(K, S, side, open) {
    const Sc = K.G.score || {};
    let n = 0;
    for (const x of S.pieces) if (x.at >= 0 && x.side === side) n += (Sc.pieces || {})[x.kind] || 0;
    if (!open) { const hand = held(S, side); for (const c in hand) n += ((Sc.cards || {})[c] || 0) * hand[c]; }
    for (const id in S.awards) if (S.awards[id] === side) n += Sc.awards[id].vp;
    return n;
  }

  // what a player's pieces earn a roll, on average: { <res>: cards }
  function income(K, S, side) {
    const Pr = K.G.produce, out = {};
    if (!Pr) return out;
    const block = S.pieces.filter((x) => x.kind === Pr.block && x.at >= 0).map((x) => x.at);
    for (let c = 0; c < K.P.nC; c++) {
      const v = K.P.num[c], res = Pr.yields[K.L.cells[c].type];
      if (v === null || !res || block.indexOf(c) >= 0) continue;
      for (const q of K.P.near[c]) {
        const o = occupant(S, q);
        if (o && o.side === side && Pr.amount[o.kind]) out[res] = (out[res] || 0) + Pr.amount[o.kind] * (K.P.prob[v] || 0);
      }
    }
    return out;
  }

  // what `side` may know: the cards it cannot see dealt again at random from those unseen (the deck, the others'
  // hands), the dice ahead unknowable; seeded, so a mind's guess is its own and the same each time
  function view(K, S, side, seed) {
    if (K.card) return cardView(K, S, side, seed);
    if (K.tile) {
      // the bag's order is what nobody knows: dealt again for the viewer
      const N = clone(S);
      N.r = mixSeed(seed || 1, S.turn, side);
      for (let i = N.bag.length - 1; i > 0; i--) { const j = Math.floor(rnd(N) * (i + 1)); const t = N.bag[i]; N.bag[i] = N.bag[j]; N.bag[j] = t; }
      return N;
    }
    if (!K.euro) return S;
    const N = clone(S);
    N.r = mixSeed(seed || 1, S.turn, side);
    for (const id of Object.keys(K.G.decks || {})) {
      // the others' unplayed cards of this deck, gathered with the deck, shuffled, and dealt back to the same objects
      const kinds = Object.keys(K.G.decks[id].cards), unseen = N.deck[id].slice(), theirs = [];
      for (let s = 0; s < K.players.length; s++) {
        if (s === side) continue;
        const mine = N.pieces.map((o, i) => i).filter((i) => { const o = N.pieces[i]; return o.at < 0 && o.side === s && o.zone === 'hand' && kinds.indexOf(o.kind) >= 0; });
        for (const c of kinds) for (const i of mine) if (N.pieces[i].kind === c) unseen.push(c);
        for (const i of mine) delete N.pieces[i].fresh;
        theirs.push(mine);
      }
      for (let i = unseen.length - 1; i > 0; i--) { const j = Math.floor(rnd(N) * (i + 1)); const t = unseen[i]; unseen[i] = unseen[j]; unseen[j] = t; }
      for (const mine of theirs) for (const i of mine) N.pieces[i].kind = unseen.shift();
      N.deck[id] = unseen;
    }
    return N;
  }

  // whether `side` could build `kind` on place p now (its needs; not what it costs)
  function legalPlace(K, S, side, kind, p) {
    return S.board[p] < 0 && placeOf(K, p) === K.P.on[kind] && needs(K, S, side, kind, p, ((K.G.build || {})[kind] || {}).need);
  }

  return { compile, start, legal, apply, outcome, attacked, perft, key, view, moveName, turn, mirror: mir, actor: actorOf, score, income, trail, placeName, placeOf, legalPlace, validOffer, scores, connectDistance, lineWindows, groupAt, sidesOf, tileFeatures, tileFits, cardScores, derive, kindsOf, held };
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
export const tabletopActor = _tabletop.actor;
export const tabletopScore = _tabletop.score;
export const tabletopIncome = _tabletop.income;
export const tabletopTrail = _tabletop.trail;
