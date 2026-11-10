### Battle city on the game UI runtime: the table's language, and the pages' own house

The board games (`lib/graph/tabletop/`) and the strategy boards (`lib/graph/board/`) each draw their UI by hand: five
board-game pages with their own header, side panel and sheet, played by pointer only; a tactics, tower defence and
skirmish client of monospace text panels with three key listeners of its own. This theme moves them onto the game UI
runtime (`lib/mana-ui/`, [docs/mana-ui.md](../../../../docs/mana-ui.md)). Planned, in order: the pages' own house; what
the runtime lacked for a table; the board-game pages on one spec; the strategy boards on one spec with one input
owner; the table's broadcast furniture folded into the same parts; the holo arena. Built so far, the first two. No
page is drawn by the runtime yet, so nothing a game emits changes but what is named here.

- **The runtime gains a table's parts.** Three components, each with its rule in the sheet and no colour of its own:
  - `card`: a card's face (a band in its side's kit, the name, the cost, what it does, its tags, its power and guard,
    how many lie under it). Its state is a shape: playable an edge alight, picked lifted, spent turned on its side;
    face down it is a back and a count. A tap plays it from the HUD; a spent card is not tapped.
  - `log`: the whole of what happened, kept: the last rows shown, pinned to the newest, the rest counted above,
    numbered from the first.
  - `spark`: a small series as bars against its largest value, the last said as a number.
- **What cannot be done says why.** A disabled button, slot, list row or grid cell takes `why`; its reason shows under
  it while it has the focus or the pointer, and as it is pressed. A slot takes `disabled`, and a disabled one is not
  tapped.
- **The table's language** (shelf `table`, `idioms-table.js`), held to six principles (the board is never covered;
  whose turn it is is a shape and a place; one question at a time; the hand is at the foot; history is kept, never in
  the way; what cannot be done says why): `seat-plates` (flagged as coverage, so a table its broadcast covers is not
  drawn twice), `card-hand`, `card-row`, `action-bar`, `game-log`, `choice-prompt` (back leaves it only where the game
  gives a way out), `trade-offer`, `table-results`.
- **Strategy's parts filled in** (shelf `live`): `turn-order` (lifted out of the turn-based battle's menu, which now
  uses it), `selection-grid`, `skirmish-lobby`, `skirmish-results`.
- **Two looks**, theme cards of a new family `table`: `table-wood` and `table-felt`, from the tables' own materials;
  the board draws three new frames (a board game's table, a tactics HUD, a skirmish HUD). Contrast advice measured on
  both cards: none left.
- **The board-game pages share a kit** (`tabletop/page-kit.js`): the escapes, the levels and their picker, and the
  table view's cameras and faces were written in each of the five pages.
- **The strategy board says things once.** Its grid-to-world point and its bus push were written twice and its banner
  three times; the tower defence and the skirmish are handed them.
- **Fixed: a tower defence's S sold the tower under the cursor and panned the camera down in the same press.** A
  defence's letters are its own; the arrows and the screen's edge pan.
- **Fixed: a skirmish's pause banner named the wrong key** ("P to play on"; P is patrol). It names the key pause is
  bound to.
- **Fixed: a promotion or drop picker had no way out.** On the move page a click outside it or Escape puts it away; in
  the holo arena a press on the board or Escape does.
- **Fixed: a player's id went into the euro, tile and move pages' logs and seat rows unescaped.**
- **Fixed: the tile game's table view was fitted to the laid tiles only on a move**, never as the window was resized.
- Pins: the `board` and `holo` fixtures of the World page's byte pin, for the board page's fold and the holo's picker; `brawl`, the one
  fixture that inlines the runtime's kernel, for the kernel's new parts (the yard draws as before).
