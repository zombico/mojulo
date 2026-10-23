import { describe, it, expect } from 'vitest';
import {
  buildTabletop, tabletopStart, tabletopLegal, tabletopApply, tabletopOutcome, tabletopPerft, tabletopKey,
  tabletopTurn, tabletopMirror,
} from './tabletop-kernel.js';
import { tabletopGame } from './tabletop.js';
import { CHESS, chessFromFen } from './games/chess.js';
import { CHECKERS } from './games/checkers.js';
import { lattice, rotate, mirror } from '../polygonizer/lattice.js';

const game = (G) => { const { L, K } = tabletopGame(G); return { L, K, S: tabletopStart(K) }; };
const play = (K, S, names) => names.reduce((s, n) => {
  const m = tabletopLegal(K, s).find((x) => x.name === n);
  if (!m) throw new Error(`no move ${n} among ${tabletopLegal(K, s).map((x) => x.name).join(' ')}`);
  return tabletopApply(K, s, m);
}, S);
const names = (K, S) => tabletopLegal(K, S).map((m) => m.name).sort();

describe('tabletop: the move generator counts true (perft)', () => {
  it('chess from its start: 20, 400, 8902', () => {
    const { K, S } = game(CHESS);
    expect([1, 2, 3].map((d) => tabletopPerft(K, S, d))).toEqual([20, 400, 8902]);
  });

  it('chess where every exception meets (Kiwipete: castling, en passant, promotion, pins): 48, 2039', () => {
    const { K, S } = game(chessFromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -'));
    expect([1, 2].map((d) => tabletopPerft(K, S, d))).toEqual([48, 2039]);
  });

  it('chess endgame with en passant out of check (position 3): 14, 191, 2812', () => {
    const { K, S } = game(chessFromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -'));
    expect([1, 2, 3].map((d) => tabletopPerft(K, S, d))).toEqual([14, 191, 2812]);
  });

  it('checkers from its start, a chain one turn: 7, 49, 302, 1469', () => {
    const { K, S } = game(CHECKERS);
    expect([1, 2, 3, 4].map((d) => tabletopPerft(K, S, d))).toEqual([7, 49, 302, 1469]);
  });
});

describe('tabletop: a rule written once plays for every player and on any board', () => {
  it('black\'s pawns go south: the rule is written for white and turned to face black', () => {
    const { K, S } = game(CHESS);
    const after = play(K, S, ['E2-E4']);
    expect(names(K, after).filter((n) => n.startsWith('E7'))).toEqual(['E7-E5', 'E7-E6']);
  });

  it('the kernel turns and mirrors a vector as the lattice does', () => {
    for (const L of [lattice({ shape: 'square', cols: 3, rows: 3 }), lattice({ shape: 'hex', radius: 1 }), lattice({ shape: 'hex', orient: 'flat', radius: 1 })]) {
      for (const v of [[1, 2], [2, -1], [0, 1]]) {
        for (let k = 0; k < L.dirs.length; k += 1) expect(tabletopTurn(L, v, k)).toEqual(rotate(L, v, k));
        expect(tabletopMirror(L, v)).toEqual(mirror(L, v));
      }
    }
  });

  it('a rook on a hex board slides six ways', () => {
    const { K, S } = game({
      board: { shape: 'hex', radius: 2 },
      players: [{ id: 'a', facing: 'N' }, { id: 'b', facing: 'S' }],
      pieces: { R: { rules: [{ vec: 'E', range: 'any' }] } },
      setup: { a: { R: ['C3'] } },
    });
    expect(tabletopLegal(K, S)).toHaveLength(12);
  });
});

describe('tabletop: exceptions are conditions, marks and partners', () => {
  it('en passant: the double step leaves a mark, the next move may take through it, then it is gone', () => {
    const { K, S } = game(CHESS);
    const s = play(K, S, ['E2-E4', 'A7-A6', 'E4-E5', 'D7-D5']);
    const ep = tabletopLegal(K, s).find((m) => m.name === 'E5xD6');
    expect(ep.cap).toHaveLength(1);
    const taken = tabletopApply(K, s, ep);
    expect(taken.board[K.T.byName.get('D5')]).toBe(-1);
    // Not taken at once, the chance passes.
    const later = play(K, s, ['H2-H3', 'A6-A5']);
    expect(names(K, later)).not.toContain('E5xD6');
  });

  it('castling: the king\'s move with its rook, refused through an attacked square', () => {
    const open = game(chessFromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -'));
    const castle = tabletopLegal(open.K, open.S).filter((m) => m.partner).map((m) => m.name).sort();
    expect(castle).toEqual(['E1-C1', 'E1-G1']);
    const done = play(open.K, open.S, ['E1-G1']);
    expect(done.board[open.K.T.byName.get('F1')]).toBe(done.pieces.findIndex((p) => p.kind === 'R' && p.at === open.K.T.byName.get('F1')));
    // A black rook on F8 watches F1: no castling short through it.
    const watched = game(chessFromFen('r3kr2/8/8/8/8/8/8/R3K2R w KQq -'));
    expect(tabletopLegal(watched.K, watched.S).filter((m) => m.partner).map((m) => m.name)).toEqual(['E1-C1']);
  });

  it('promotion offers each piece it may become', () => {
    const { K, S } = game(chessFromFen('8/P6k/8/8/8/8/8/K7 w - -'));
    expect(names(K, S).filter((n) => n.startsWith('A7'))).toEqual(['A7-A8=B', 'A7-A8=N', 'A7-A8=Q', 'A7-A8=R']);
  });

  it('checkers: a capture is compulsory, a double jump is one turn, and crowning ends it', () => {
    const G = { ...CHECKERS, setup: { black: { M: ['C3'] }, white: { M: ['D4', 'F6', 'B8'] } } };
    const { K, S } = game(G);
    expect(names(K, S)).toEqual(['C3xE5']);
    const mid = play(K, S, ['C3xE5']);
    expect(mid.side).toBe(0);                     // the same turn: the man must jump on
    expect(names(K, mid)).toEqual(['E5xG7']);
    const end = play(K, mid, ['E5xG7']);
    expect(end.side).toBe(1);
    expect(end.pieces.filter((p) => p.side === 1 && p.at >= 0)).toHaveLength(1);
    // Crowned on the far row, its turn ends, though as a king it could jump E7 back.
    const crown = game({ ...CHECKERS, setup: { black: { M: ['B6'] }, white: { M: ['C7', 'E7', 'H8'] } } });
    expect(names(crown.K, crown.S)).toEqual(['B6xD8=K']);
    const crowned = play(crown.K, crown.S, ['B6xD8=K']);
    expect(crowned.chain).toBe(-1);
    expect(crowned.side).toBe(1);
    expect(crowned.pieces.find((p) => p.side === 0).kind).toBe('K');
  });
});

describe('tabletop: how a game ends', () => {
  it('mate: the fool\'s mate', () => {
    const { K, S } = game(CHESS);
    const s = play(K, S, ['F2-F3', 'E7-E5', 'G2-G4', 'D8-H4']);
    expect(tabletopOutcome(K, s)).toEqual({ winner: 1, reason: 'mate' });
  });

  it('stalemate: no move, not in check, is a draw', () => {
    const { K, S } = game(chessFromFen('7k/5Q2/6K1/8/8/8/8/8 b - -'));
    expect(tabletopOutcome(K, S)).toEqual({ winner: null, reason: 'stalemate' });
  });

  it('threefold repetition draws', () => {
    const { K, S } = game(CHESS);
    const s = play(K, S, ['G1-F3', 'G8-F6', 'F3-G1', 'F6-G8', 'G1-F3', 'G8-F6', 'F3-G1', 'F6-G8']);
    expect(s.over).toEqual({ winner: null, reason: 'repetition' });
  });

  it('checkers: a player left without a move loses', () => {
    const { K, S } = game({ ...CHECKERS, setup: { black: { M: ['A1'] }, white: { M: ['B2', 'C3'] } } });
    expect(tabletopOutcome(K, S)).toEqual({ winner: 1, reason: 'no-moves' });
  });
});

describe('tabletop: the turn and the clock', () => {
  it('two moves a turn, and a pass when the game allows one', () => {
    const { K, S } = game({ ...CHESS, turn: { moves: 2, pass: true } });
    expect(names(K, S)).toContain('pass');
    const once = play(K, S, ['E2-E4']);
    expect(once.side).toBe(0);
    expect(play(K, once, ['D2-D4']).side).toBe(1);
  });

  it('the clock spends what the page measured, past the delay, adds the increment, and flags', () => {
    const { K, S } = game({ ...CHESS, clock: { base: 1000, inc: 100, delay: 50 } });
    const m = tabletopLegal(K, S).find((x) => x.name === 'E2-E4');
    expect(tabletopApply(K, S, m, { ms: 250 }).clock).toEqual([900, 1000]);
    expect(tabletopApply(K, S, m, { ms: 2000 }).over).toEqual({ winner: 1, reason: 'time' });
    // A move with no time given (a mind's look ahead) leaves the clock alone.
    expect(tabletopApply(K, S, m).clock).toEqual([1000, 1000]);
  });
});

describe('tabletop: pure and self-contained', () => {
  it('the same moves are the same game', () => {
    const { K, S } = game(CHESS);
    const line = ['E2-E4', 'C7-C5', 'G1-F3', 'D7-D6'];
    expect(JSON.stringify(play(K, S, line))).toBe(JSON.stringify(play(K, S, line)));
    expect(tabletopKey(K, play(K, S, line))).toBe(tabletopKey(K, play(K, S, line)));
  });

  it('the closure runs on its own, as a page carries it', () => {
    const lone = new Function(`return (${buildTabletop.toString()})();`)();
    const { L } = tabletopGame(CHESS);
    const K = lone.compile(JSON.parse(JSON.stringify(L)), CHESS);
    expect(lone.perft(K, lone.start(K), 2)).toBe(400);
  });

  it('refuses a game it cannot play', () => {
    expect(() => tabletopGame({ ...CHESS, players: [{ id: 'white', facing: 'NNE' }] })).toThrow(/no way 'NNE'/);
    expect(() => tabletopStart(tabletopGame({ ...CHESS, setup: { red: { K: ['A1'] } } }).K)).toThrow(/player 'red'/);
    expect(() => tabletopStart(tabletopGame({ ...CHESS, setup: { white: { Z: ['A1'] } } }).K)).toThrow(/'Z'/);
  });
});
