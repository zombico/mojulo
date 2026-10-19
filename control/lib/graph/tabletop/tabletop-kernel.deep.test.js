import { describe, it, expect } from 'vitest';
import { tabletopStart, tabletopPerft } from './tabletop-kernel.js';
import { tabletopGame } from './tabletop.js';
import { CHESS, chessFromFen } from './games/chess.js';
import { CHECKERS } from './games/checkers.js';

// The move generator's counts one turn deeper than the critical tier goes, against the published tables.
const count = (G, d) => { const { K } = tabletopGame(G); return tabletopPerft(K, tabletopStart(K), d); };

describe('tabletop perft, deep', () => {
  it('chess from its start, four turns: 197281', () => {
    expect(count(CHESS, 4)).toBe(197281);
  }, 120000);
  it('Kiwipete, three turns: 97862', () => {
    expect(count(chessFromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -'), 3)).toBe(97862);
  }, 120000);
  it('position 4 (promotions with castling rights on one side), three turns: 9467', () => {
    expect(count(chessFromFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), 3)).toBe(9467);
  }, 120000);
  it('position 5, three turns: 62379', () => {
    expect(count(chessFromFen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), 3)).toBe(62379);
  }, 120000);
  it('checkers from its start, six turns: 36768', () => {
    expect(count(CHECKERS, 6)).toBe(36768);
  }, 120000);
});
