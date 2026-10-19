/**
 * CHECKERS (English draughts), written in the tabletop kernel's words: a man steps diagonally forward and jumps a foe
 * (the jump a vector of (2, 2) whose middle must hold a foe, which it takes), jumps chain while the same man can jump,
 * a capture is compulsory, and a man reaching the far row is crowned a king (which ends its turn); a king steps and
 * jumps all four ways. A player with no move loses. Pieces stand on the dark squares (A1 is dark).
 *
 * The kernel lifts a jumped piece at once, not at the end of the sequence, which only matters to a chain that would
 * cross its own path (no such chain is in reach of the opening).
 */

const FILES = 'ABCDEFGH';
const dark = (rows) => rows.flatMap((r) => FILES.split('').filter((_, c) => (c + r - 1) % 2 === 0).map((f) => `${f}${r}`));

export const CHECKERS_PIECES = {
  M: {
    name: 'man', shape: 'disc', glyph: '', value: 1,
    promote: { row: 'last', to: ['K'], stop: true },
    rules: [
      { vec: 'NE', sym: 'mirror', to: 'empty' },
      { vec: [2, 2], sym: 'mirror', to: 'empty', pass: 'enemy', capture: 'pass', chain: true },
    ],
  },
  K: {
    name: 'king', shape: 'stack', glyph: '♛', value: 1.5,
    rules: [
      { vec: 'NE', sym: 'rotate', to: 'empty' },
      { vec: [2, 2], sym: 'rotate', to: 'empty', pass: 'enemy', capture: 'pass', chain: true },
    ],
  },
};

export const CHECKERS = {
  board: { shape: 'square', cols: 8, rows: 8 },
  players: [{ id: 'black', facing: 'N', colour: '#3d332d' }, { id: 'white', facing: 'S', colour: '#c4362a' }],
  mustCapture: true,
  noMoves: 'lose',
  repetition: 3,
  quiet: { plies: 80, reset: ['M'] },
  pieces: CHECKERS_PIECES,
  setup: { black: { M: dark([1, 2, 3]) }, white: { M: dark([6, 7, 8]) } },
};
