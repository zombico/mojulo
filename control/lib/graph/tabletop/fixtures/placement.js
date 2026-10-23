/**
 * TEST FIXTURES, not games in the book: placement paradigms written out from the tabletop kernel's systems, each named
 * by its principle. Pieces dropped from stock onto empty cells; what a drop does and how a game ends is the paradigm.
 *
 *   enclosureGame({ size? })         stones on a square board; a group with no empty neighbour is taken, no suicide,
 *                                    no ko; two passes end it; stones and surrounded empty cells score, the second
 *                                    player given half a point more than a tie (size 9)
 *   lineGame({ cols?, rows?, k?, fall? })   k in a row wins; with `fall`, a piece drops down its column (7 × 6, 4, true)
 *   connectionGame({ size? })        a rhombus of hexes; each player joins its own two sides; nobody can block both, so a
 *                                    full board always has one winner (size 7)
 *   sandwichGame({ size? })          a drop must close a line of foes between itself and one of the player's own, and
 *                                    turns them; a player with none passes; the most discs wins (size 8)
 *   majorityGame()                   four regions of a 6 × 6 board, eight pieces each; at the end each region scores its
 *                                    majority 5 and second place 2
 */

const FILES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const cell = (c, r) => `${FILES[c]}${r + 1}`;

export function enclosureGame({ size = 9 } = {}) {
  return {
    title: 'Enclosure',
    board: { shape: 'square', cols: size, rows: size },
    players: [{ id: 'dark', facing: 'N', colour: '#2b2622' }, { id: 'light', facing: 'S', colour: '#f2ede4' }],
    pieces: { stone: { name: 'stone', drop: true, value: 1, shape: 'disc', glyph: '' } },
    enclose: { suicide: false, ko: true },
    turn: { pass: true },
    end: { passes: 2, score: [{ count: true }, { territory: true }, { add: [0, 0.5] }] },
    cap: size * size * 3,
  };
}

export function lineGame({ cols = 7, rows = 6, k = 4, fall = true } = {}) {
  return {
    title: `${k} in a row`,
    board: { shape: 'square', cols, rows },
    players: [{ id: 'gold', facing: 'N', colour: '#e0b23a' }, { id: 'red', facing: 'N', colour: '#c4362a' }],
    pieces: { disc: { name: 'disc', drop: fall ? { fall: 'S' } : true, value: 1, shape: 'disc', glyph: '' } },
    win: { line: k },
    end: { full: true },
  };
}

export function connectionGame({ size = 7 } = {}) {
  return {
    title: 'Connection',
    board: { shape: 'hex', rhombus: size },
    // the first joins its bottom row to its top; the second its left side to its right (the rows across that way)
    players: [{ id: 'red', facing: 'N', colour: '#c4362a' }, { id: 'blue', facing: 'ESE', colour: '#2f6db3' }],
    pieces: { stone: { name: 'stone', drop: true, value: 1, shape: 'disc', glyph: '' } },
    win: { connect: true },
  };
}

export function sandwichGame({ size = 8 } = {}) {
  const a = size / 2 - 1, b = size / 2;
  return {
    title: 'Sandwich',
    board: { shape: 'square', cols: size, rows: size },
    players: [{ id: 'dark', facing: 'N', colour: '#2b2622' }, { id: 'light', facing: 'S', colour: '#f2ede4' }],
    pieces: { disc: { name: 'disc', drop: { flip: 'must' }, value: 1, shape: 'disc', glyph: '' } },
    setup: { dark: { disc: [cell(a, b), cell(b, a)] }, light: { disc: [cell(a, a), cell(b, b)] } },
    turn: { pass: 'stuck' },
    end: { passes: 2, full: true, score: [{ count: true }] },
  };
}

export function majorityGame() {
  const regions = {};
  const quarter = (c0, r0) => { const out = []; for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) out.push(cell(c, r)); return out; };
  regions.south_west = quarter(0, 0); regions.south_east = quarter(3, 0); regions.north_west = quarter(0, 3); regions.north_east = quarter(3, 3);
  return {
    title: 'Majorities',
    board: { shape: 'square', cols: 6, rows: 6 },
    players: [{ id: 'teal', facing: 'N', colour: '#2a8c86' }, { id: 'plum', facing: 'S', colour: '#7b3f73' }],
    pieces: { meeple: { name: 'meeple', drop: true, value: 1, shape: 'meeple', glyph: '' } },
    stock: { meeple: 8 },
    regions,
    turn: { pass: 'stuck' },
    end: { passes: 2, score: [{ majority: { points: [5, 2] } }] },
  };
}
