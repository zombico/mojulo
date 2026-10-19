/**
 * CHESS, written in the tabletop kernel's words: no line of it is chess code. Six pieces as vectors under the board's
 * symmetry (a knight is the orbit of (1, 2)), the pawn's exceptions as conditions and marks (the double step from the
 * second row leaves a mark that en passant takes), castling as a king's move with a partner rook and a safe path,
 * check as the royal rule, the fifty-move rule as a quiet count, threefold repetition.
 *
 *   CHESS                  the game from its start
 *   chessFromFen(fen) → G  the game from a position in Forsyth-Edwards notation (castling rights as moved kings and
 *                          rooks, the en passant square as a mark)
 */

const BACK = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
const FILES = 'ABCDEFGH';

export const CHESS_PIECES = {
  K: {
    name: 'king', shape: 'king', glyph: '♚', royal: true, value: 0,
    rules: [
      { vec: ['N', 'NE'] },
      { vec: [2, 0], sym: 'mirror', to: 'empty', pass: 'empty', when: ['unmoved'], partner: { kind: 'R', to: 'pass' }, safe: true },
    ],
  },
  Q: { name: 'queen', shape: 'queen', glyph: '♛', value: 9, rules: [{ vec: ['N', 'NE'], range: 'any' }] },
  R: { name: 'rook', shape: 'rook', glyph: '♜', value: 5, rules: [{ vec: 'N', range: 'any' }] },
  B: { name: 'bishop', shape: 'bishop', glyph: '♝', value: 3.25, rules: [{ vec: 'NE', range: 'any' }] },
  N: { name: 'knight', shape: 'knight', glyph: '♞', value: 3, rules: [{ vec: [1, 2] }] },
  P: {
    name: 'pawn', shape: 'pawn', glyph: '♟', value: 1,
    promote: { row: 'last', to: ['Q', 'R', 'B', 'N'] },
    rules: [
      { vec: 'N', sym: 'none', to: 'empty' },
      { vec: [0, 2], sym: 'none', to: 'empty', pass: 'empty', when: [{ row: 2 }], mark: 'passant' },
      { vec: 'NE', sym: 'mirror', to: 'enemy' },
      { vec: 'NE', sym: 'mirror', to: 'empty', when: [{ mark: 'passant' }], capture: 'mark' },
    ],
  },
};

const RULES = {
  board: { shape: 'square', cols: 8, rows: 8 },
  players: [{ id: 'white', facing: 'N', colour: '#f3ede2' }, { id: 'black', facing: 'S', colour: '#4a3e36' }],
  royal: true,
  repetition: 3,
  quiet: { plies: 100, reset: ['P'] },
  pieces: CHESS_PIECES,
};

const row = (r, kinds) => {
  const out = {};
  kinds.forEach((k, c) => { (out[k] = out[k] || []).push(`${FILES[c]}${r}`); });
  return out;
};

export const CHESS = {
  ...RULES,
  setup: {
    white: { ...row(1, BACK), P: FILES.split('').map((f) => `${f}2`) },
    black: { ...row(8, BACK), P: FILES.split('').map((f) => `${f}7`) },
  },
};

export function chessFromFen(fen) {
  const [placement, side = 'w', rights = '-', passant = '-'] = String(fen).trim().split(/\s+/);
  const ranks = placement.split('/');
  if (ranks.length !== 8) throw new Error(`chess: a FEN placement has 8 ranks, not ${ranks.length}`);
  const setup = { white: {}, black: {} };
  ranks.forEach((text, i) => {
    let c = 0;
    for (const ch of text) {
      if (/\d/.test(ch)) { c += Number(ch); continue; }
      const kind = ch.toUpperCase();
      if (!CHESS_PIECES[kind]) throw new Error(`chess: '${ch}' is not a piece`);
      const who = ch === kind ? 'white' : 'black';
      (setup[who][kind] = setup[who][kind] || []).push(`${FILES[c]}${8 - i}`);
      c += 1;
    }
    if (c !== 8) throw new Error(`chess: rank ${8 - i} has ${c} files`);
  });
  // A king or rook that has lost its castling right counts as moved.
  const moved = [];
  const can = (flag) => rights.includes(flag);
  if (!can('K') && !can('Q')) moved.push('E1');
  if (!can('k') && !can('q')) moved.push('E8');
  if (!can('K')) moved.push('H1');
  if (!can('Q')) moved.push('A1');
  if (!can('k')) moved.push('H8');
  if (!can('q')) moved.push('A8');
  const marks = [];
  if (passant !== '-') {
    const cell = passant.toUpperCase(), f = cell[0], r = Number(cell.slice(1));
    // the pawn that passed stands one row beyond the mark, on the mover's side of it
    const by = `${f}${r === 6 ? 5 : 4}`, owner = r === 6 ? 'black' : 'white';
    marks.push({ kind: 'passant', cell, side: owner, by });
  }
  return { ...RULES, setup, start: { side: side === 'b' ? 'black' : 'white', moved, marks } };
}
