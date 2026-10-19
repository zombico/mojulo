/**
 * The board games' vocab card (get_game_vocab({ id: 'tabletop' })): how create_game's `tabletop` is written, the
 * book's games named from the table that makes them, and the grammar a game written out uses, its example the book's
 * own chess pieces (so the card cannot drift from what plays).
 */

import { TABLETOP_GAMES } from './tabletop-manifest.js';
import { CHESS_PIECES } from './games/chess.js';
import { SHAPES } from './tabletop-shapes.js';

const show = (x) => JSON.stringify(x);

export function tabletopCard() {
  const games = Object.keys(TABLETOP_GAMES).join(' | ');
  const body = [
    `create_game({ title, tabletop: { game, human?, level?, view?, seed?, clock? } }): a board game against the computer, its own page (no store, no levels), played at /api/sketches/<ref>/game and exported as one page (export_game).`,
    `- game: ${games} (the book: games nobody owns), or a game written out. human: the player the person plays (the first). level: easy | fair | hard. view: plan (SVG) | table (CSS 3D). seed: the computer's dice and a written game's deal. clock: { base, inc?, delay? } in seconds (a game of moves).`,
    `- A published game asked for by name is not in the book and is never guessed: ask the person to explain its rules and what they want (the board, the pieces and what each may do, a turn, how it ends), then write it out from the systems below. The book offers systems and meeples, not games.`,
    `- A game written out: { board, players, pieces, setup, royal?, mustCapture?, noMoves?, repetition?, quiet?, cap?, turn?, clock? }.`,
    `  board: a lattice { shape: 'square', cols, rows } | { shape: 'hex', orient?: 'pointy'|'flat', radius | cols, rows }, holes by omit or a heights grid with nulls; cells are named as on a chessboard (C4), corners and edges by a cell and a way (C4.ne).`,
    `  players: [{ id, facing, colour? }] facing a way (N, S…): a rule written for the first player turns to face each.`,
    `  pieces: { <kind>: { rules, value?, royal?, promote?: { row, to: [kind], stop? }, glyph? } }; a rule: { vec, sym?: all|rotate|mirror|none, range?: 1|n|'any', to?: free|empty|enemy, pass?: any|empty|enemy, capture?: land|pass|mark|none, when?: ['unmoved' | { row } | { mark }], mark?, chain?, partner?: { kind, to: 'pass' }, safe? }. A vector under the board's symmetry is a piece's moves: a knight is the orbit of [1, 2].`,
    `  The book's chess pieces, as written: ${show(Object.fromEntries(['N', 'R', 'P'].map((k) => [k, CHESS_PIECES[k].rules])))}`,
    `  A piece's body (the table view stands it in 3D, the plan draws its silhouette): shape: ${Object.keys(SHAPES).join(' | ')}, or one written out in cell units: { form: 'extrude', profile: [[x, z]…], depth } (a cut-out: a meeple, a house) | { form: 'lathe', profile: [[r, z]…], sides? } (turned: a pawn, a checker) | { form: 'box', size: [w, d, h] } | { form: 'group', parts: [{ shape, at? }] }. No shape: a flat token with its glyph.`,
    `  setup: { <player>: { <kind>: [cells] } }. royal: a move may not leave a royal piece attacked (mate, stalemate). mustCapture, noMoves: lose|draw, repetition: n, quiet: { plies, reset: [kind] }, cap: turns, turn: { moves?, pass? }.`,
    `- Placement, for games where pieces are put down rather than moved: a piece's drop: true | { fall?: way (it drops that way until stopped), flip?: true | 'must' (it turns the lines of foes it closes) }; stock: { <kind>: n } (unlimited without); enclose: { suicide?, ko? } (a group with no empty neighbour is taken); win: { line: k } | { connect: true } (a group joining a player's first row to its last, rows from its facing); end: { passes?, full?, score: [{ count } | { territory } | { majority: { regions?, points } } | { largest } | { add: [n per player] }] }; regions: { <name>: [cells] }; turn.pass: true | 'stuck'. A rhombus of hexes: board { shape: 'hex', rhombus: n }.`,
    `- Tile placement, a board grown a tile at a time: tiles: { types: { <id>: { segments: [{ type, edges: [k] } | { type, centre: true }] } }, bag: { <id>: n }, start: { tile, at }, claim?: { kind, stock }, features: { <type>: { complete, incomplete } } }. Edges count the board's ways round (a square's E N W S); a tile is laid beside the laid ones, turned to any of the board's turns, every shared edge's label matching; one segment of it may be claimed if its feature has no claim; a feature with no open edge (a centre: every cell round it laid) pays its tiles × rate to the most claims in it and returns them; an empty bag ends it, open features paying the lower rate. look: { plain, features: { <type>: { colour, form: area | line | centre } } } draws the tiles.`,
    `- The economy's systems, each a key, used as the person's rules need them: pieces on: cell|corner|edge (a meeple on a hex, a building on a corner, a road on an edge); stock: { <kind>: n }; resources: { <res>: bank count }; build: { <kind>: { cost, need: [{ apart } | { touch } | { reach, block } | { any }], upgrade? } }; opening: [{ order: forward|reverse, steps: [{ place, need?, yield? }] }]; dice: { n, sides }; deal: { types, numbers?, numberless?, apart?, place? } (cells dealt from the seed); numbers; produce: { yields, amount, block }; rolls: { <n>: [effect] }; decks: { <deck>: { cards, cost } }; cards: { <card>: { play: [effect] } }; effects: discard | robber | free | gain | claim; exchange: { rate } (the bank); trade: { offers?, shapes? } (players offer cards for cards after the roll, the others accept or decline, the offerer deals with one); score: { pieces, cards, awards: { trail | played }, win }.`,
    `- The computer answers a trade by expected value and the table: what it does for its own position (its points, income, hand, turns to its next build) less what it does for the offerer's, that weighed more when the offerer is ahead, and never a trade with a player two points from winning.`,
  ].join('\n');
  return {
    id: 'tabletop',
    name: 'Board games against the computer: chess, checkers, or one written out from systems and meeples',
    summary: 'create_game\'s tabletop: a board, pieces that are vectors under its symmetry, rules and their exceptions, played against a computer.',
    when: '"play chess against the computer", "a checkers game", "a board game with resources, dice and trading", "make my own board game with these pieces and rules"',
    body,
  };
}
