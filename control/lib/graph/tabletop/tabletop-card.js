/**
 * The board games' vocab card (get_game_vocab({ id: 'tabletop' })): how create_game's `tabletop` is written, the
 * book's games named from the table that makes them, and the grammar a game written out uses, its example the book's
 * own chess pieces (so the card cannot drift from what plays).
 */

import { TABLETOP_GAMES } from './tabletop-manifest.js';
import { CHESS_PIECES } from './games/chess.js';

const show = (x) => JSON.stringify(x);

export function tabletopCard() {
  const games = Object.keys(TABLETOP_GAMES).join(' | ');
  const body = [
    `create_game({ title, tabletop: { game, human?, level?, view?, seed?, players?, clock?, exchange? } }): a board game against the computer, its own page (no store, no levels), played at /api/sketches/<ref>/game and exported as one page (export_game).`,
    `- game: ${games} from the book, or a game written out (below). human: the player the person plays (the first). level: easy | fair | hard. view: plan (SVG) | table (CSS 3D). seed: the computer's dice, and the settlers island's dealing. players: 3 | 4 (settlers). clock: { base, inc?, delay? } in seconds (a game of moves). exchange: a bank rate (settlers has none: no trading).`,
    `- A game written out: { board, players, pieces, setup, royal?, mustCapture?, noMoves?, repetition?, quiet?, cap?, turn?, clock? }.`,
    `  board: a lattice { shape: 'square', cols, rows } | { shape: 'hex', orient?: 'pointy'|'flat', radius | cols, rows }, holes by omit or a heights grid with nulls; cells are named as on a chessboard (C4), corners and edges by a cell and a way (C4.ne).`,
    `  players: [{ id, facing, colour? }] facing a way (N, S…): a rule written for the first player turns to face each.`,
    `  pieces: { <kind>: { rules, value?, royal?, promote?: { row, to: [kind], stop? }, glyph? } }; a rule: { vec, sym?: all|rotate|mirror|none, range?: 1|n|'any', to?: free|empty|enemy, pass?: any|empty|enemy, capture?: land|pass|mark|none, when?: ['unmoved' | { row } | { mark }], mark?, chain?, partner?: { kind, to: 'pass' }, safe? }. A vector under the board's symmetry is a piece's moves: a knight is the orbit of [1, 2].`,
    `  The book's chess pieces, as written: ${show(Object.fromEntries(['N', 'R', 'P'].map((k) => [k, CHESS_PIECES[k].rules])))}`,
    `  setup: { <player>: { <kind>: [cells] } }. royal: a move may not leave a royal piece attacked (mate, stalemate). mustCapture, noMoves: lose|draw, repetition: n, quiet: { plies, reset: [kind] }, cap: turns, turn: { moves?, pass? }.`,
    `- A euro game written out adds places on corners and edges (pieces' on: cell|corner|edge), stock, resources, build: { <kind>: { cost, need, upgrade? } }, opening rounds, dice, numbers, produce, rolls, decks and cards, score: { pieces, cards, awards, win }: the settlers recipe (games/settlers.js) is the worked one.`,
  ].join('\n');
  return {
    id: 'tabletop',
    name: 'Board games against the computer: chess, checkers, settlers, or one written out',
    summary: 'create_game\'s tabletop: a board, pieces that are vectors under its symmetry, rules and their exceptions, played against a computer.',
    when: '"play chess against the computer", "a checkers game", "a settlers-style board game", "make my own board game with these pieces and rules"',
    body,
  };
}
