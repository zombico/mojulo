---
{
  "id": "tabletop",
  "name": "Play a board game against the computer — chess, checkers, settlers, or your own",
  "summary": "A traditional or euro board game composed from a board, pieces, rules and turns, played against a computer on its own page.",
  "when": "\"play chess against the computer\", \"a game of checkers\", \"a settlers-style game with resources and dice\", \"design a board game with my own pieces and rules\", \"a hex board strategy game\"",
  "entry": "create_game",
  "form": "game"
}
---
→ `create_game({ title, tabletop: { game } })`: a board game against the computer, no store and no levels. `game` is chess, checkers or settlers from the book, or a game written out: a square or hex board, pieces whose moves are vectors under the board's symmetry, rules and exceptions (castling, en passant, forced capture), or a euro economy (corners and edges, resources, dice, cards, scores). Levels easy, fair, hard; a clock; a plan (SVG) or table (CSS 3D) view. The grammar and the worked chess pieces: `get_game_vocab({ id: 'tabletop' })`. Played at `/api/sketches/<ref>/game`; `export_game` writes one page. (A game of levels → store and levels; a hero and systems → `design_game`.) Full family → `get_creative_toolset({ form: 'game' })`.
