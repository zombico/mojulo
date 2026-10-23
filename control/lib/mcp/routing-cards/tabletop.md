---
{
  "id": "tabletop",
  "name": "Play a board game against the computer — chess, checkers, or your own from systems and meeples",
  "summary": "A traditional or euro board game composed from a board, pieces, rules and turns, played against a computer on its own page.",
  "when": "\"play chess against the computer\", \"a game of checkers\", \"a game with resources, dice and trading\", \"design a board game with my own pieces and rules\", \"a hex board strategy game\"",
  "entry": "create_game",
  "form": "game"
}
---
→ `create_game({ title, tabletop: { game } })`: a board game against the computer, no store and no levels. `game` is chess or checkers from the book, or a game written out from systems and meeples: a square or hex board, pieces whose moves are vectors under its symmetry, rules and exceptions, or an economy (corners and edges, resources, dice, building, cards, trading, scores). A published game asked for by name is not in the book: ask the person to explain its rules and what they want, then write it out. Levels easy, fair, hard; a clock; a plan or table view. The systems' grammar: `get_game_vocab({ id: 'tabletop' })`. Played at `/api/sketches/<ref>/game`; `export_game` writes one page. (Levels → store and levels; a hero → `design_game`.) Full family → `get_creative_toolset({ form: 'game' })`.
