### Battle city on the game UI runtime: the table's language, and the pages' own house

The board games (`lib/graph/tabletop/`) and the strategy boards (`lib/graph/board/`) each draw their UI by hand: five
board-game pages with their own header, side panel and sheet, played by pointer only; a tactics, tower defence and
skirmish client of monospace text panels with three key listeners of its own. This theme moves them onto the game UI
runtime (`lib/mana-ui/`, [docs/mana-ui.md](../../../../docs/mana-ui.md)). Planned, in order: the pages' own house; what
the runtime lacked for a table; the board-game pages on one spec; the strategy boards on one spec with one input
owner; the table's broadcast furniture folded into the same parts; the holo arena. Built so far: the first two, and
the board-game pages on one spec, the strategy boards (a tactics battle, a tower defence, a skirmish) on another, and the holo arena.

- **A board game's page drawn by the runtime: `tabletop.ui`** (`{ theme?, languages?, language? }`,
  `tabletop/table-ui.js`). One spec and one host for the tabletop pages. With `ui`, a page's header and side panel are
  gone: the prompt and what can be done now are the table's action bar (each action on a key), the game so far its
  log, new game, undo, the level and the view its menu, and a promotion or a drop one question at a time.
  - **One coverage.** The seats, the calls and the result are the table's own parts too: seat plates along the top
    (the seat to play alight, a score that rose popping, a running clock), where the game stands under them, a call
    (check, a promotion, the dice, a new round, the end) one at a time by weight there and never over the play, and
    the places by points a beat after the end's word, ties sharing a place, with see the board and play again. A
    page's client says them in the calls it always made; with `ui` the runtime answers, and the page no longer carries
    the broadcast's DOM client or its sheet. The broadcast's data still makes the look's sides and the pieces' kits.
    The result is now moved through by keys and a pad (it had no focus).
  - **Keys and a pad.** The tabletop pages were played by pointer only. With `ui` the board has a cursor moved by the
    controls layer's `board` scheme (arrows or a stick, confirm, back), the menus and questions by the `menu` scheme,
    and back from the board opens the menu. A key pressed while a screen is up is that screen's: it never also acts
    on the board.
  - **A card game is one screen of grids**: the supply, the market, the hand, what was played, each seat's piles as
    backs and counts, moved through with the cursor; what can be bought or played has an edge alight.
  - **The look** is the game's (`ui.theme`: a preset, a theme card or its own words), else the table's own materials
    (`table-wood`, or `table-felt` for a card table), its sides the broadcast's kits so a chip here and a plate there
    agree. A game's `languages` reach the table's own words.
  - **The euro game**: its build modes, the dice, buying and ending the turn are actions; what you hold (resources and
    cards) a row of counters; the cursor moves among the places that can be taken now; a trade is the offer screen,
    each resource a count turned, the kernel saying why an offer cannot be made.
  - **The round games** (worker placement, sealed bids, drafts, duels): the spaces, the supply, the lot, the chain, the
    field and the hand are zones of the same screen; a bid is an action on its digit; a card with several targets asks
    for one among the actions.
  - Built for every tabletop page but one: a round game played on a board (a duel of summons on cells) takes `ui` and
    still draws its own panel, since its board and its cards want the cursor at once.
  - **With `ui: false` a page plays as it did** and carries no runtime, sheet or host. Its client's source gains the
    branches that choose between the two, and a page drawn by the runtime is about 220 KB larger (the runtime and its
    sheet).

- **The default: a table, a board and an arena are drawn by the runtime.** A tabletop game, a board (a battle, a map,
  a defence, a skirmish) and a holo arena that name no `ui` are drawn by the game UI runtime in their own look
  (`table-wood` or `table-felt`, `tactician`, `modern`). `ui: false` keeps a page's own panels and carries no runtime.
  - **This changes what a game already minted draws**: its recipe is the same, its page regenerates with the runtime's
    parts, keys and a pad, and is about 220 KB larger. A game that must keep its old page says `ui: false`.
  - The pages' own panels are kept, not deleted: `ui: false` uses them, a round game played on a board still draws its
    own under any `ui`, and a skirmish's key rebinding panel is only there.
  - The tabletop's card says `ui`.
- **The holo arena drawn by the runtime: an arena's `ui`** (`tabletop/holo-ui.js`). The overlay it drew on a canvas is
  the runtime's parts: the two duelists across the top, mirrored, each its light's chip, its life points and their
  bar, the one to play alight; the title between; the status at the foot; the duel's words (DUEL!, CHECK!, the end)
  while they are said. A promotion is one question, put off by back. The board has a cursor on the controls layer's
  `board` scheme (a ring on a cell, stepped over the cells as the camera shows them), so a duel is played by keys and
  a pad; confirm duels again once it is over. The look is the game's, else `modern`; its sides the duelists' lights.
  A world's `ui` reaches its board game's arena. With `ui: false` an arena's block carries no runtime.
- **The strategy boards drawn by the runtime: a board's `ui`** (`{ theme?, languages?, language? }`,
  `board/board-ui.js`; a level's `board.ui`, or the `board` kind's own). The board page still plays the battle; its
  text panels become the runtime's parts, read from what the page stands at each frame it changes:
  - **The battle**: the turn order (each unit its side's chip, the one acting alight), the unit in focus (its bars,
    how far it goes, what is on it), the action menu as a screen beside the board (Move, Act, Wait; the attack, the
    skills, the bag), an aim's forecast as a table, the end's word and its spoils as a banner, the numbers over a blow
    toned by their kind.
  - **The tower defence**: the wave, the lives and the purse; each tower on its digit with its cost, the one in hand
    marked; sell, the next wave and where a tower may stand on their keys. The cursor moves by the controls and the
    view follows it, so a defence is built from a pad.
  - **Keys and a pad through the controls layer**: the `board` scheme's intents (cursor, confirm, back, turn, zoom,
    tilt) for the board, the `menu` scheme while the action menu is up. The board page says what a control means once
    (`intent`); its own keys go through it too. Under the UI a defence's sale is R, since the board scheme's S moves
    the cursor.
  - **The look** is the game's, else `tactician`; its sides the board's own side colours. A gameworld's `ui` reaches
    its battle, map and defence levels. Nothing covers the board as the menu comes and goes.
  - **The skirmish**: the purse along the top (gold, the second resource, supply, workers, army, tier), the clock and
    what the next click does, what is selected (a building's queue and research, a unit's figures, many units as
    tiles that pick one), and the command card as slots on their keys, the armed one marked, one that cannot be done
    saying why. A match's lobby is a screen of rows turned, its results the figures side against side with each row's
    lead marked and each side's army over the match. Its orders stay on its own keys and the pointer (the drag box,
    the right click), so the board scheme is not connected for it; the lobby and the results take keys and a pad.
    Rebinding its keys is not offered under the UI yet.
  - With `ui: false` a board's block carries no runtime.
- **Fixed: back from an aim left the keys with the cursor.** The action menu was drawn again and could not be moved
  through; it has the keys again.
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
- Pins: the `holo` fixture a third time, for the default (it names no `ui`, so it now carries the runtime); before it,
  the `holo` fixture for the arena client's hooks; the `board` fixture again, for the board page's hooks and its `intent`; before it, the `board` and `holo`
  fixtures of the World page's byte pin, for the board page's fold and the holo's picker; `brawl`, the one
  fixture that inlines the runtime's kernel, for the kernel's new parts (the yard draws as before).
