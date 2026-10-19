# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. From `3.1.0` the connected-service and app tools are no longer listed:
they still answer by name (the CLI, plan steps, skills that name them). The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md); the detailed log behind 3.1.1 is
[CHANGELOG-3.1.md](CHANGELOG-3.1.md).

## [Unreleased]

### Strategy board: spots on the map for tactics and tower defence

A game can carry a board: square spots laid over its terrain as their own layer, each with a height, a terrain type
and at most one unit. From any state the board lists every legal move, so a player can run out of options. Turn-based
tactics (in the manner of Final Fantasy Tactics) and tower defence share it. A board lies over a geocube's level,
indoors (its rooms) or out (its land), or is a diorama the cube paints. Web only. In progress:

- **The genre sweep asks for it.** Probes for a tactics game and a real-time strategy game, and registry values
  for the board, the tactical camera, tactics combat and RTS orders, all unbuilt so far. On
  `docs/tool-surface/hillclimb.md` the board ranks first by worlds lifted per unit of work.

- **The board kernel** (`lib/graph/board/board-kernel.js`), built: square spots with heights and terrain types, one
  unit a spot; reach by move and jump (through allies, never foes); aim (a diamond or a line, between a reach's
  bounds, within a height) and area; facing (a blow from the side or behind hits harder) and height; every legal
  move listed, ending always among them. The turn is FFT's: move once and act once, in either order, then face; a
  charge-time clock on the party battles' timeline rule, a turn costing less for not moving or not acting. Blows
  follow the party battles' formula. Pure and seeded, a self-contained closure a page can carry.
- **Boards from a geocube** (`lib/graph/board/board-lay.js`), built, indoors and out:
  - a diorama the cube paints: seeded columns in whole steps, banded a step at a time so a height reads at a
    glance, grass and stone outside, floor and trim inside, water optional;
  - over the cube's rooms: spots on the floor, props shutting theirs, the rooms joined only through their
    doorways;
  - over the cube's land (a trail's valley by default): heights and types read off the ground, trees shutting
    their spots, laid inside the site where the most ground can be stood on.
- **The board on the World page**, built: a `board` world kind (`{ board, units, camera, cursor }`) shows a board over
  its ground with a faint grid of its spots, highlights for reach, aim and area, a cursor and the units, and plays it
  with **the tactical camera**: a locked pitch with two stops, quarter turns (Q / E), zoom stops (Z / X or the
  wheel), the cursor moving the way the screen shows whichever way the view is turned. The widest stop holds the
  whole board; the closer ones follow the cursor. Selecting a unit shows its reach from the board kernel, and moving
  it hops the kernel's path. A room is seen as a dollhouse (no ceiling, its walls cut at the waist); over land the
  overlay drapes on the ground. An RTS form pans and scrolls at the edge instead of turning. A page without a board
  keeps every byte. The `board` input scheme names its keys.
- **Battles on the board**, built: a board world kind's `battle` (`{ party, foes, bag?, players? }`) is played on
  the page. The party stands in its classes and the foes by preset, read from the party battles' own book (stats,
  gear, skills, weaknesses), with only the board's numbers added: how far each moves and climbs, the shape of each
  skill (a blow the next spot, a spell four, a mending three, an area for many). Skills, items, statuses and buffs
  work as in party battles, and a blow lands for exactly what a party battle's would on the same dice; from the side or
  behind it lands harder (a spell lands the same from anywhere). The player's units take a menu (Move, Act, Wait,
  then a facing) with the reach and aim shown and a forecast of each act; the other side is a plain mind that weighs
  every spot and act. A turn-order bar, the active unit's card, numbers off the units, and the level hears
  `board-won` or `board-lost`. Classes and humanoid foes stand as figures that walk spot to spot; beasts stay tokens.
- **Tactics games through the game book**, built: `battles: { on: 'board' }` makes each stage that meets packs a
  battle level, fought on spots laid over the stage's own ground, indoors or out (any level can carry a `board`). The
  book's party (the hero and the cast who join, standing as themselves) deploys on the near rows, up to four, before
  the first turn; the stage's packs stand in the far rows. A battle is won when every foe is down (or by its rules: a
  leader down, turns survived, a guest to protect) and lost when the hero falls; the level ends there (the `board`
  mechanic). The party is carried as party battles carry it: each battle stands it as the store has it, at full HP,
  and puts its spoils back (xp, class points and the skills they teach, gold, drops), counted exactly as party battles
  count them. FFT's permadeath countdown is a rule, off by default. A world whose intent fights tactics gets board
  battles without writing them.
- **The epoch map**, built: a tactics book is travelled from a map, its first level: a diorama in the first stage's
  geocube, each stage a dot on it in story order (a battle or a story stop), joined by roads laid spot by spot. A dot
  opens when the one before it is won; the party's marker walks the open roads to the dot chosen, and the map is left
  by that dot (the `map` mechanic). Every dot's level, when won, goes back to the map, where the party stands at the
  dot it came from.
- **Skirmishes to fight again**, built: each area of the map gets a skirmish dot after its first battle, open once
  that battle is won and fought as often as the party likes. A skirmish draws its foes from the book's packs when it
  starts, scaled to the party (its mean level, give or take one); win and the next visit meets another pack, lose and
  the same one waits. Any board battle can draw (`draw`: packs, weakest first, in place of `foes`);
  `battles.board.skirmish: false` leaves them off.
- **Tower defence on a board** on the quick path (`defend` with `board`): towers fill spots, and foes path over the
  free ones.

### Traditional board games: a board world of tiles, pieces and rules

Board games composed, not coded: a board is a connection of tiles, and chess, checkers and euro games of resources,
dice and trading are put together from the same systems and meeples (pieces, move rules, turns and exceptions; places,
resources, building, cards, trading, scores), played against the computer. The book holds only games nobody owns: a
published game asked for by name is written out from the rules the person explains, never guessed. The board is
abstract (representational state, heights allowed, no map yet), drawn as an SVG plan and, where it is good enough,
in CSS 3D. In progress:

- **The lattice** (`lib/graph/polygonizer/lattice.js`), built: mandala-space tiled. Square and hex boards (pointy or
  flat, a rectangle or a hexagon of hexes, carved by holes or a heights grid) as cells, corners and edges with shared
  ids, so a piece can stand on a cell, a corner (a settlement) or an edge (a road). The relations are explicit: each
  cell's neighbour by direction, in manji names (N E S W on a square; E NE NW W SW SE on a pointy hex), its corners
  and edges in order round it, each corner's cells and edges, each edge's two corners and its cells. Heights stand on
  the meru. Cells are named as on a chessboard (`C4`), a corner or an edge by any cell it touches and the way to it
  (`C4.ne`), every alias the same record. Lattice vectors move on it (a step, a slide until the board or a hole
  ends it, a jump) and turn and mirror with the board, so a piece's moves are one vector under the board's symmetry:
  a knight is eight moves from one, and the same piece plays on a hex. The relations' invariants are checked
  (`latticeLaws`), and Euler counts the holes.
- **The board drawn** (`lattice-svg.js`, `lattice-css3d.js`), built: the plan as SVG (cells in the board's own
  colouring, corners, edges and names, highlights over them), and the board in CSS 3D, a top a cell, sides where a
  cell stands above its neighbour or the rim, a seat at the table and a view from above.
- **The tabletop kernel** (`lib/graph/tabletop/tabletop-kernel.js`), built: a game as a pure function of its moves,
  composed from data. A piece is what it can do: a vector (or a way) under the board's symmetry, stepped, slid or
  leapt, landing on an empty cell, a foe or either, the cells it crosses empty, held by a foe or anything, taking what
  it lands on, what it jumps or what left a mark. Exceptions are conditions (unmoved, a row counted from the player's
  own side, a mark the last move left), marks, a partner piece that moves with it and a path that must not be
  attacked; promotion offers each piece a pawn may become; a chain lets the same piece go again (a multi-jump). A
  rule is written once for the first player and turned to face each other one. The game's rules: a royal piece that
  may not be left attacked (mate and stalemate follow), compulsory capture, no move loses or draws, repetition, a
  quiet count, a turn cap, moves a turn and passing, and a clock (base, increment, delay) that spends the time the
  page measured, the kernel never reading one. One self-contained closure, as the strategy board's, so a page can
  carry it.
- **Chess and checkers as data** (`lib/graph/tabletop/games/`), built: written in those words alone, chess with
  castling, en passant, promotion, check, the fifty-move rule and threefold repetition, and English draughts with
  compulsory and chained jumps and crowning. A chess position loads from FEN. Their move counts match the published
  perft tables (chess from the start, Kiwipete and the standard test positions; checkers from the start).
- **The computer across the table** (`lib/graph/tabletop/tabletop-mind.js`), built: alpha-beta over the kernel's
  moves, captures followed past the horizon, scored by what the game declares (its pieces' values, a promoting
  piece's progress, the middle of the board), three levels (easy, fair, hard) by depth and by how far below the best
  a pick may fall. Bounded by a count of positions, never a clock, with seeded dice between equal moves: the same
  position and seed give the same move on any machine. A closure over the kernel, so a page carries both. The attack
  test walks each capturing rule backwards from the square, which made the search about three times faster.
- **The game to play** (`lib/graph/tabletop/tabletop-page.js`), built: one self-contained page against the computer,
  carrying the board, the game, the kernel and the mind. Two views of one board: the plan (SVG) and the table (CSS 3D,
  every cell's top a div played by clicking, a piece a token that slides from cell to cell). Select a piece to see
  where it may go, a promotion picker, the last move marked, check and the outcome in the status, the move list, undo,
  a new game, the level (easy, fair, hard), and the clocks when the game has one (the page measures a move's time and
  hands the kernel the number). The person sits at their own side: playing black turns the plan and the table.
- **The economy** (the tabletop kernel, grown), built: a game with building, dice or an opening is played on places,
  a cell, a corner or an edge, so a settlement stands on a corner and a road on an edge. Stocks (a player's pieces
  off the board), hands and a bank, costs; building as data, with conditions over the place graph (no building within
  so many steps, beside the player's own kinds, a road reaching from the player's net and not through a foe's
  settlement) and upgrades (a city on a settlement). Seeded dice at the turn's start; production (each hex showing
  the roll pays the pieces on its corners, not under the robber, the bank's shortage rule); rolls that do something
  else (a seven: half a hand over seven given up, the robber moved, a card stolen). Forced choices queue, even out of
  turn, one move at a time. Decks shuffled from the seed, cards bought and held, played one a turn and never the turn
  bought, their effects in a few verbs (the robber, free placements, gain from the bank, claim from every other
  player). An opening in rounds (the snake), then roll and build. Scores from pieces, cards and awards (the longest
  trail of a kind, broken by a foe's building; the most of a card played), a win on one's own turn. A view per player
  deals what it cannot see again from what is unseen, so a computer never reads a hidden card or the dice ahead. A
  bank exchange is an option. Chess and checkers keep their counts.
- **The deal**, built: a system for a seeded setup. Cell types and numbers shuffled onto the board from the game's
  seed, numberless types left bare, chosen numbers kept off neighbouring cells, neutral pieces set on a type; the same
  seed, the same board.
- **Trading between players**, built: a system (`trade: { offers, shapes }`). After the roll the player to move offers
  any whole cards it holds for others; each other player answers in turn, accepting only what it can pay; the offerer
  deals with one who accepted or calls it off; a few offers a turn, so a game always ends. The computer answers by
  expected value and the table: what the trade does for its own position (points, income, hand, and how many rolls
  it now stands from its next build) less what it does for the offerer's, weighed heavier when the offerer is ahead
  of it and heavier again when the offerer leads, and never a trade with a player two points from winning. It offers
  only what it foresees accepted and helpful, and deals with the partner its own position likes best. Four computers
  with trading finish a dealt island in fewer turns than without (56, 128 and 66 turns against 96, 114 and 107 on
  three seeds).
- **An island economy, as a test fixture** (`lib/graph/tabletop/fixtures/island-economy.js`), built: nineteen hexes
  dealt by the deal system, settlements, cities and roads, dice, production and the seven's robber, development cards,
  the longest road and the largest army, an opening in rounds, and trading when asked: written in the systems alone,
  the way a person's own rules would be once explained. Not in the book and not reachable from the tools.
- **The computer at a euro game**, built: a turn planner. From its own view it weighs lines of its own actions this
  turn, the best few at each step, each forced choice on the way taken greedily, and plays the first action of the
  best line. A seat's worth is its points, what its pieces earn a roll (a spread of resources over a pile), its hand,
  the builds it can pay for, the corners it can settle next, its cards, its army and its road, less a share of the
  leader's. Four computers play a dealt island to a winner.
- **A euro game to play** (`lib/graph/tabletop/tabletop-euro-page.js`), built: the same page for a euro game. The island
  on the plan and the table, its numbers, the pieces in the players' colours; the corners, edges and hexes that can
  be taken now marked and clicked; the person's hand and cards, the roll, the builds, buying and playing cards, and
  the forced choices as prompts (what to give up, where the robber goes, whom to rob); every seat's open points,
  cards and awards; a log; with trading, an offer drafted card by card (checked by the kernel's own rule), the
  computers' offers to accept or decline, and the partner chosen from those who accepted. The computers play their
  turns a beat apart, so their moves can be followed.
- **Meeple shapes** (`lib/graph/tabletop/tabletop-shapes.js`, `tabletop-bodies.js`), built: a piece given a body, not
  only a cube or a flat token. A shape is a cut-out with thickness (a meeple, a house, a city, a tower, a barn, a ship,
  a horse's head), a turned profile (a checker, a stack, the chess set, a robber), a box (a cube, a road) or a group
  of those, named from a shelf or written out in cell units. The table view stands each piece as a body of panels lit
  in its owner's colour and turned to face its player, a road lying along its edge; the plan draws each piece's side
  silhouette, as a diagram does. A turned piece's tapering bands are unmasked rectangles, so a full chess set of 32
  bodies draws in a few seconds where masked bands took minutes. Chess, checkers and the island economy wear them; a
  shape is checked when the game is made.
- **Placement and groups**, built: pieces put down rather than moved. A kind may be dropped from the player's stock onto
  an empty cell, falling a way until something stops it, or turning the lines of foes it closes. One groups engine
  (a side's pieces joined across edges, and the empty cells beside them) serves enclosure (a group with no empty
  neighbour is taken; no suicide; no ko: the board may not return to how it stood before the other player's move),
  connection (a group joining a player's own two sides wins) and the scorers. A line of k along any axis wins.
  Passes in a row or a full board end a game by its points: pieces counted, territory (empty areas one side alone
  borders), majorities in named regions (first and second, ties sharing the places' points), the largest group, an
  added half point. A rhombus of hexes joins the lattice. The computer reads each game by what wins it: open lines
  toward k, the shortest way left to join two sides, groups down to their last empty neighbour, and the game's own
  points; it narrows a wide board to the cells near the play. Five fixtures, each named by its principle (enclosure,
  lines with and without falling, connection, sandwiching, majorities), are played by clicking on the plan or the
  table, with a pass, the score in the status and the regions tinted.
- **Tile placement**, built: a board grown a tile at a time. Tile types are segments of feature types over a tile's
  edges (an area, a line) or its centre; tiles come from a seeded bag, one drawn a turn, laid beside the laid ones,
  turned any of the board's turns, every shared edge's label matching (square or hex alike); a tile that fits nowhere
  is set aside. A segment of the tile just laid may be claimed with a piece from stock if its feature has none. A
  feature (segments joined across edges) with no open edge pays at once, its tiles times its rate, to the most claims
  in it, a tie paying each, and its claims return; a centre feature is done when every cell round it is laid. An empty
  bag ends the game, open features paying their lower rate. A player's view deals the bag again. The computer weighs
  every placement and turn with the best claim it allows: points, each feature it leads at its chance of being done,
  a claim in hand worth more the fuller the bag, less a share of the leader's. A tile-placement fixture named by its
  principle (walls, paths, shrines). The page draws each tile from its segments on the plan (cropped to what is laid)
  and on the table (the art on the cell's top, claims as standing bodies, the view following the play); the drawn tile
  is turned by hand and laid where it fits, then a claim chosen or not.
- **Piles, hands and markets**, built: card games, with no board (`piles`). Card types are data (a cost, coins, points, a
  treasure, effects to play in a few verbs: draw, coins, actions, buys, points, gain a card up to a cost, trash from
  the hand; tags). Each player has a deck, a hand, a discard, the cards played this turn and a tableau; a supply of
  piles and a market, a row face up refilled from its own seeded deck. Deck building: a hand drawn, treasures played
  freely and others for one of the turn's actions, buys into the discard, the turn's cards to the discard and a new
  hand, the discard shuffled into a deck when it runs out; a gain or a trash owed is chosen one card at a time.
  Drafting: a turn takes one card from the row to the tableau. Set collection scorers: the cards' points, different
  values of a tag held, the same value held so many times, a tag's numbers summed, the most of a value (a tie sharing
  the bonus). The game ends as a turn ends (a pile gone, so many piles gone, the market empty, a turn count). A
  player's view keeps its own hand and deals deck order, the others' hands and the market's deck again. The computer
  plays what leaves its turn the most to buy with (an action that keeps the actions going first), then buys what
  leaves its seat worth most: its points weighed more as the end nears, the average hand its deck draws weighed less;
  at a draft, the card worth most to it less half the next seat's best take. Against fixed strategies (a money-only
  buyer, a buyer of the dearest card) it wins about half its games; it beats random play every time. Two fixtures
  named by principle (deck building; drafting and set collection), played on a card page: the supply and the market
  lit where a buy, a take or a gain may go, the hand lit where a play or a trash may, the others' piles as counts and
  their tableaux face up, actions, buys and coins, every seat's points as the game scores them now, a log.
- **The engine, stage 1: one object model**, built. The thesis behind the next stages: every board game is the same
  duel of objects (things with characteristics in zones; a turn of phases; windows to act; a chain of responses;
  triggers; world effects; rules checked between actions), so the kernel grows that engine rather than one feature per
  paradigm. Stage 1 unifies what things are. Every piece, card and laid tile is now an object in one table: a board
  piece as before, a card in its owner's zones (deck, hand, discard, played, tableau; zones hold object ids in order),
  a laid tile and a claim at their cell, an economy card held or played. A shared supply of like things (a supply
  pile, a bag of tiles, a bank, a stock of meeples) stays counted by kind until one comes out of it. Pieces, card types,
  tile types and economy cards share one namespace (a name used twice is refused). One function derives an object's
  characteristics: its definition, then its modifiers in a fixed order (set, add, counters, grant and remove
  abilities, by timestamp within each); with no counters and no modifiers it is the definition itself, so a game that
  uses neither pays nothing, and an object leaving play keeps none of them. Machine gates: the seeded mind-against-mind
  games of every mode (chess, enclosure, tiles, deck building, drafting, three island games, one with trading) replay
  move for move as before the change; perft's counts and time are unchanged; the kernel grew by 8.7 per cent.
- **The engine, stage 2: rounds of phases, sealed choices and utilization**, built. A game with `round` is played in
  rounds, each a list of phases written as data: taken in turns from the first seat while anyone can act, together
  (each player's choice sealed and hidden from every other player's view, all revealed and resolved at once, the
  phase repeating while what it acts on lasts), or by itself (workers made ready, cards dealt, a lot revealed, upkeep
  paid, lots nobody took cleared). Its moves: a worker placed on a space (exhausted; a space holds so many; its
  effects at once: resources, points, another worker, the first seat), a sealed bid (the highest pays and takes the
  lot, a tie to the first in order, nothing on all zeros), a sealed pick (kept, the hands passed on), a pass. Workers
  are objects; resources are pools that carry over; cards and their scorers are the card mode's; the first seat may
  pass on each round. **Utilization**: capacity that expires (a deck turn's actions, buys and coins; workers in a
  round) is kept in a ledger per player, spent and idle (left when it expired while a move could still have spent
  it), and `utilization` reports the share used. The computer optimizes it (a small term preferring capacity used
  over idle when worths are close) and is tuned by it: a level's `use` is how often an option that spends capacity is
  seen at all, so a weaker computer leaves capacity idle where idling is allowed and misplaces where spending is
  forced, the way a weaker player forgets the card in hand (easy 0.7, fair 0.92, hard 1). The computer in a round
  game places a worker where its seat's worth gains most (resources valued by the game's own conversions, upkeep and
  end rates; workers by the spaces' yield for the rounds left), bids by expected value (the lot's worth to it, the
  coins, whether it beats what each rival would pay by the same reckoning, half a rival's gain), and picks what is
  worth most to it less half what the next seat could take from the hand it passes. Three fixtures named by
  principle (worker placement, sealed bids, drafting by passing) and a round page (spaces and their workers, the lot
  and the bids, the hand, pools, every seat's points and utilization, sealed choices shown only as made until
  revealed). Machine gates: hard beats easy 12 of 12 deck games, easy using 72 per cent of its capacity to hard's 96,
  and hard beats easy 9 of 10 worker games; the computer beats random play in every round paradigm; chess,
  enclosure, tiles, drafting and the island games replay move for move as before; perft unchanged; the kernel grew
  to 103,295 bytes (from 85,992) and the mind to 31,575 (from 24,059).
- **The door** (`create_game`'s `tabletop`), built: `create_game({ title, tabletop: { game } })` makes a board game
  against the computer, chess or checkers from the book or a game written out from the systems, with the person's
  side, the level, the view, a seed and a clock. A published game asked for by name sends the agent to ask the person
  for its rules first. It is a recipe: a game row (`engine:
  'tabletop'`) whose page is made again on every read, played at `/api/sketches/<ref>/game`, edited with
  `update_sketch` (the kernel checks the edit) and exported by `export_game` as one page and its recipe. A game the
  kernel cannot play is refused when it is made. A routing card, two routing rows, and a vocab card
  (`get_game_vocab({ id: 'tabletop' })`) with the systems' grammar and the book's own chess pieces; the cosmos registry's board
  learns `lattice`. The `tools/list` payload pin is raised for the one schema property.

## [3.1.1] - 2026-10-16

The first published release of the 3.1 line. `mojulo` 3.1.0 reached npm from a stale build of 2026-10-10 and is
deprecated (npm refuses to unpublish a package others depend on); no `mojulo-ui` 3.1.0 exists. Where this changelog
and the code say 3.1.0 for a change, it first ships here.

3.1 turns mojulo toward games: a sentence becomes a playable game in a named genre, with its own world, its own
people and its own look, played in the browser, shipped as a desktop app or exported to an engine. The detailed
log behind this summary, theme by theme, is [CHANGELOG-3.1.md](CHANGELOG-3.1.md).

### Upgrading from 3.0

- **Update the Claude plugin.** It runs `npx -y mojulo@3.1.1`; an unpinned `npx -y mojulo` moves to 3.1.1 once it
  is npm `latest`. `mojulo-ui` 3.1.1 is the matching dashboard. No new Node requirement and no new dependency.
- **Retired from the tool list, still callable by name**, so a plan step, script or skill that names one keeps
  working:
  - the office wing: apps, runtime daemons, the contextmap, mcp-orbit, triggers and primitive binding
    (`pack_runtime`, `pack_connected_services`; see `RETIRED_PACKS` in `lib/mcp/packs.js`);
  - game projects (`create_game_project` and its siblings): a game's home is its gameworld, through `design_game`;
  - `create_shoot_plan` and `update_shoot_plan`: a shoot plan is `forge_motion({ shoot })`.
- **The dashboard is view-only.** The copy-prompt buttons and the in-page edits (folders, gallery, stash) are gone;
  `/apps`, `/mcp-skills`, `/map` and `/graph` are removed, and `/maker` redirects home. Sign-in and Settings stay.
- **Stored rows that render differently** (the exceptions to byte-identical re-render):
  - **Heroes** get a structured midsection by default; `core: 'streamlined'` restores the 3.0 body byte for byte.
  - **Houses, stores, restaurants and malls** were the mirror image of their plans in the World and every export;
    they are now built the way the plan reads. House floors are muted. SVG stills were mirrored too and are now
    right-handed.
  - **The default animals'** silhouettes and proportions are retuned; a minted animal redraws on its next read.
- **The recipe book ships inside the package.** `MOJULO_RECIPE_BOOK` and the separate `mojulo-recipe-book` repo are
  deprecated: a clone still loads and warns at boot, until 4.0. `MOJULO_BUNDLED_BOOK=off` detaches the bundled book.
- **Every recipe records the mojulo version** that minted it and that last edited it.

### Games

- **The doors.** `design_game` makes a game: `quick: { goal }` for a genre in one call, `compose: { prompt }` for a
  whole gameworld from a sentence, or the full gameworld (world bible, character book, levels). `create_game`
  audits it; `export_game` ships it.
- **Genres** (`quick.goal`):
  - **Fighting game:** a side-view one-on-one fighter, local two-player, on 3D arena stages; every fighter is a
    character the character loop designs.
  - **RPG battles:** turn-based fights, a party of up to four switchable classes against groups of foes, with
    battle effects.
  - **Arena shooter:** deathmatch and team deathmatch against bots, first person or over the shoulder; the arena is
    made from words and one dial runs from realistic to stylized. Also a cover shooter along a trail.
  - **Racing:** a kart racer on a loop against rival drivers, and supercars on the grid (any paint, liveries, race
    moods, night driving). A true-scale divided freeway is the first piece of a driving world.
  - **Flight:** a flight sim (fly the ring gates and land), and air combat or a space shooter (`shoot` with a
    `craft`), on one flight model; craft are assembled from a shelf of aircraft and spacecraft parts.
  - **Also:** reach, collect, survive, avoid, sneak (guards and sightlines), rhythm, defend (tower defence), puzzle
    (block pushing) and farm.
- **Levels and places.** Buildings and room kits play as levels (a house, a store, a school, a crypt); a city is
  planned on a board and played as levels; towns, fixed-camera walkmesh scenes, and chapters of the same world over
  time.
- **What a game carries:** stats, inventory and shops, front menus, a cover and credits, scenes and two characters
  talking, a story bound to its world, weather, destruction, beams and explosions, and a soundtrack scored per level
  with action sounds.
- **Where it plays.** A browser shell runs title, levels and result. `export_game({ target: 'desktop' })` packs it
  as a desktop app with one seam for a store (Steam, GOG, Epic); mojulo ships no store SDK and uploads nothing.
  The Godot pack carries the event bus, combat and looks, and is the most complete engine translation.
- **What can be made next.** The cosmos cube describes a game as six facets, and its sweep measures what the builder
  can and cannot make yet ([docs/tool-surface/hillclimb.md](../docs/tool-surface/hillclimb.md)).

### Characters

- **`create_character`** (`as: 'hero' | 'creature' | 'animal'`) is the first door; `update_character` revises any
  part.
- **Each game's own people.** The Egocube rolls a cast from a game's setting and era: modern and future gear,
  mascots that walk as well as drive, and a palette that keeps its world's era.
- **The look.** An anime hero can be drawn painterly, with a painted face that animates. A stylism solver works
  silhouette, then value, then detail. Clothes fit the body, armour and creature apparel read as what they are,
  hair grows as locks, and light is painted onto the surface. Each character is drawn for its target screen.
- **Motion.** Showcase poses, ready stances, strikes, sitting and rising, vaults and carrying on the hero door, and
  a walk calibrated against measured human gait.
- **Animals.** Sea creatures, insects and other arthropods that move, behaviours said once and done per species,
  and an encyclopedia entry per species.

### Worlds and the look

- **The geocube** is a level's look as data. The color theorist solves its palette from what the world is
  for (land, sky, HUD and cover from one solve), and vertex contrast lights the whole world.
- **Stage kits** in the sixth-gen manner: an isekai meadow, bamboo and sakura groves, a research lab and night, with
  live grass, wind, fire and water.
- **Historic cultures** as walkable `historic` worlds from cited records, with period music and people: Sumer,
  Hellenistic Lindos, Qin Xianyang, Pompeii and Giza. Later eras through the same historic solver.
- **Buildings.** The `interior` kind furnishes one room of a house; houses gain finishes and composed or true-size
  furniture; a structure book documents a house, store, restaurant, mall or school.

### Making things

- **Solids.** The fabricator resolves a part's job from a shelf of standard parts and sizes it; `measure_solid`
  reads strength (bending, tension, print infill); mechanisms move with mass and friction; the `scad` kind gains a
  pinned library for threads, gears and text, and warns where they used to fail silently. Exploded views and teardowns.
- **Asset receipts.** `sign_asset` and `verify_asset` sign an exported file with a per-install creator key.
- **Audio, film and diagrams.** Orchestral strings and brass, a robot-rock style card; a world's shoot plan and a
  Blender film pack from `forge_motion`; flow charts lay themselves out.

### The agent's surface

- **One door per intent.** A new capability is an argument and a routing card on the tool that owns its intent,
  not a new listed tool. A pack opens to a menu; `create_sketch` and `cook` list routing only and read their manuals
  on demand. A routing eval with a held-out set measures where requests land.
- **Model tiering.** An agent task names how much judgment it needs (`ride`, `fill`, `judge`, `design`), never a
  model.
- **Self-description.** Mojulo describes itself by what it makes: things to Play, Print, Read, Hear and Observe.

### For contributors

- Test tiers: `test:critical` is quick again, the game and world suites that walk levels in headless Chrome are
  `test:e2e`, and range sweeps are `*.deep.test.js`. A test picks one case per procedure, never a whole catalog.

## [3.0.0] - 2026-10-01

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **Node 22.14 or newer.** 2.x asked for 22.12, but on Node 22.12 and 22.13 the database library
  (better-sqlite3) crashes the process the first time it opens the database, with no message; 2.1.0
  crashes the same way. 3.0 checks the version at start-up and says which Node to install.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, dashboard DNS
  rebinding and cross-site writes, a revoked delegate's dashboard session that outlives the
  revocation, a delegate's dashboard session that holds the operator's authority, and an
  `update_sketch` patch that reaches the prototype chain
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  79 MB (the package and its dependencies); if the host gives up, start Claude Code with
  `MCP_TIMEOUT=60000`, or run `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host
  afterwards so no 2.x server keeps running against the same `~/.mojulo`.
- **Saved provider keys become unreadable to 2.x.** With `API_KEY_ENCRYPTION_KEY` unset (the
  default), the first time a 3.0 process reads saved keys (`mojulo-config`, `list` included;
  `mojulo init`'s key prompt; the dashboard's key settings; `mint_solid` `via:'prompt'` without an
  inline `apiKey`), it re-encrypts every key a 2.x install saved, the Fly token included, under a
  per-install key at `$MOJULO_HOME/secret.key`. 2.x cannot decrypt them after that; the change is
  one way. **Back up `secret.key` together with the database:** without it 3.0 cannot read the keys
  either.
- **What left, and what it left behind.** The chatbot factory is no longer part of mojulo as of 3.0
  and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have
  known security issues. Its tools, packs and dashboard pages are not in 3.0; calling one of its
  tools, `mojulo install chatbot` or an `artifact_materialization` commit does nothing and answers
  with that notice. Its tables (`deployments`, `modular_sessions`, `mcp_jobs`) and their rows, and the
  `packs/chatbot` marker, stay in `~/.mojulo`, inert: 3.0 does not use them, and you may delete them.
  **`~/.mojulo/data/artifacts/` holds each old bot's `.env` with its provider key in plain text:
  delete it.**
- **Downloaded helpers and draft figure specs move out of the npx cache.** 2.1.0 kept Chrome for
  Testing, ffmpeg, gallery stills, turntable strips and draft figure specs inside its package folder;
  3.0 keeps them under `$MOJULO_HOME`. An unpinned upgrade replaces that folder, so they are not
  carried over; pending figure specs are lost unless another version's npx folder still holds them
  (3.0 copies those across once). The browser (now build 154) is no longer fetched in the
  background: with no browser installed, gallery thumbnails stay blank until one is available (an
  installed one, `MOJULO_CHROMIUM`, or, outside the Claude plugin build, an explicit render's
  download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider`: nothing chooses the provider for you any more.
    The key is `apiKey`, the saved key named by `apiKeyId`, or else your saved key for the provider
    you name.
  - Exported World pages are self-contained by default again (`world.html`, no third-party fetch);
    `cdn: true` writes `world.cdn.html`, and `world.offline.html` is no longer written.
  - Stored `floorplan` and `condo-complex` rows that relied on the old room defaults re-render
    roomier, and the furnish pass doors sealed rooms, parks interior doors open against the wall and
    moves wall pieces out of a door's way
    ([Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
    [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
  - `chatbot` or `ops` in `MOJULO_PACKS` is ignored, so `MOJULO_PACKS=chatbot` alone now leaves the
    creative tools on.
  - `MOJULO_MCP_TELEMETRY=off` stops only the local tool-call log, no longer the tool timeout, and
    `MOJULO_MCP_TOOL_TIMEOUT_MS` can raise a tool's budget but not lower it. Render tools get 600 s.
  - `mojulo install creative` installs nothing (the creative pack always ships), and
    `mojulo install recall` now works from npm and npx. With the runtime already installed and the
    search model missing, it fetches the model instead of reporting nothing to do.
  - A delegate (roles pack) signed in to the dashboard reads and no longer writes (below).
  - A city minted from now on wears the round street kit (below); stored cities are unchanged, and
    `elements: { roundKit: false }` keeps the block kit.
  - A material object whose `metal` is a name (`{ metal: 'steel', finish: 'brushed' }`) is a metal
    surface (below); beside `base` or `preset` it is refused. The shelf's numeric `metal: 1` is
    unchanged.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry (byte for byte on
  the same platform) and exported to STL / 3MF, glTF, OpenUSD, IFC4, self-contained HTML, Godot,
  Blender, Unity and Unreal. The bot factory, which never fit that, is gone.

### Determinism

- **What "the same geometry" means.** A recipe compiles to the same geometry every time: byte for byte
  on the same platform (OS, CPU and Node version), and to within floating-point rounding on any other.
  V8's `Math` is not one function everywhere: its arm64 builds round `sin`, `cos`, `exp`, `atan2` and the
  rest differently from x64, and since Node 24 `Math.pow` and `**` call the platform's C library. An
  embedded texture PNG can also differ in its compressed bytes between Node builds (Homebrew's Node links
  a different zlib), never in its pixels.
- **3.0's generators go further.** The vegetation engine, terrain worlds, the anime head and hero, stores
  and construction, metro and canal cities, the metro refacade and the Tian Tan Buddha take their
  transcendental functions from a deterministic math module (fdlibm in plain double arithmetic), so their
  pinned outputs are the same bytes on Linux and macOS, x64 and arm64, Node 22 and 24, and CI checks them
  on every runner. The older helpers they reach switch to it only inside a 3.0 build, so nothing minted
  with 2.x changes. A few older helpers still use the engine's `Math` (specular shading, sRGB conversion,
  some textures, roads, the metro World's walkers and cars).

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; the installed and downloaded rows include the package itself, and "downloaded" is
  the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB | 6.7 MB |
  | Unpacked package | 121.7 MB | 21.3 MB |
  | Installed, package and dependencies | 539 MB, 426 packages | 227 MB, 153 packages |
  | Downloaded on a cold start, package included | about 182 MB | about 79 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 4.5 s (4.6 s), 6 runs |

- **Machine caveat.** The two timings come from separate sessions on a busy machine: 2.1.0 on
  2026-09-27 (load average 3 to 12), 3.0.0 on 2026-09-30 (7 to 11). In the 3.0.0 session, runs of a
  pre-release 3.0 candidate interleaved with the release's took a median 6.1 s: the release installs
  one copy of sharp instead of two, 26 packages fewer. Trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. npm also keeps the downloaded tarballs in
  its cache, about 140 MB for 3.0.0. 2.1.0's package carried the dashboard build; 3.0.0's dashboard
  is `mojulo-ui` (12.7 MB packed, 57.0 MB unpacked), fetched only when it is opened.
- **The package never carries a local content pack.** A tarball or `mojulo-ui` build made from a
  checkout holding the operator-local mobile-suit content pack carried it; the package file list
  leaves it out, a test fails any tarball carrying a gitignored file, and the dashboard build refuses
  such a checkout. A clean install no longer prints warnings about that absent pack.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never chooses the LLM provider for the caller: `provider` is
  required, and the key is `apiKey`, the saved key `apiKeyId` names, or the caller's saved key for
  that provider.
- Chrome for Testing downloads only for an explicit render and says so (never under the Claude
  plugin, below); headless Chromium keeps its sandbox (on Linux it falls back only on Chrome's
  sandbox errors or as root); the ffmpeg download is SHA-256 pinned; everything mojulo writes lazily
  lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))
- **Revoking a delegate's key now ends their dashboard session on their next request.** Before, the
  dashboard checked only a session's signature and 7-day cookie expiry. A delegate (roles pack) whose
  key was revoked with `revoke_role_key`, had expired, or had its token epoch bumped could keep using
  the dashboard until the cookie ran out, even though their MCP bearer had already stopped working.
  Such a session now gets the same 401 on `/api/*` and redirect to `/login` as no session, and with
  the roles pack off a delegate session is refused outright. The dashboard middleware now runs on the
  Node runtime so it can make this check. The operator's own session, installs with login off, and
  installs without the roles pack make no database read.
- **A delegate's dashboard session is read-only.** No dashboard route checks a role, a grant or a
  flag, so on 2.x a signed-in delegate held the operator's authority there, whatever the role
  granted: deleting the operator's saved keys, writing an app's `.env` and starting the app, deleting
  sketches. A live delegate session now reads pages and the API, and gets 403 (`DELEGATE_READ_ONLY`)
  on every write and on the settings API. The roles pack's grants still bind the delegate's MCP key;
  the operator's session is unchanged.

- **sharp 0.35.5.** The image library moves past high-severity advisories in its bundled libvips and
  libheif (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `mojulo-ui` no longer carries the older copy
  Next.js keeps for `next/image`, which the dashboard never imports. An image submitted for a render
  that does not decode is refused at submit.
- **A patch cannot reach the prototype chain.** An `update_sketch` patch path through `__proto__` or
  `constructor/prototype` set or deleted a property on every object in the server process until it
  restarted. Such a path, or the same key in a set-by-id merge, now refuses by name.

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, and the Claude plugin pins `npx -y mojulo@3.0.0`
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).
- **The Claude plugin build.** When the Claude plugin starts mojulo, it leaves out the handoff tools
  for AI image, voice and mesh generators. That covers the image-render and mesh handoffs, the voice
  registers, sprite sheets, style presets, the skin op, the painted sketch kinds, the painted cover
  title, `forge_motion`'s scene and cel sources, the character-from-dream figure specs and a
  figure's `dream_audit`, and the image-driven catalysts. The vocab cards and catalysts it keeps are
  served without their lines about those loops. It also leaves out the keyed
  `mint_solid via:'prompt'` door (use `via:'packet'`) and every automatic download:
  - renders use a Chrome, Chromium, Edge or Brave you already have, or `MOJULO_CHROMIUM`;
  - MP4 encodes use an ffmpeg you already have, or `MOJULO_FFMPEG`;
  - the search model arrives only through `install recall`.

  Exported World and game pages are always self-contained there: `cdn: true` is ignored, and the
  result says so. The host adapter cards are served without their image-generator and CDN lines, and
  the MCP Apps preview is not offered. A call to a tool the plugin build leaves out answers in-band.
  Installs from npm or a checkout are unchanged.
- **The plugin listing.** It is rewritten for 3.0 with three example prompts that work in the plugin
  build, a table of what it installs, fetches, runs and writes, a privacy policy link, an "Upgrading
  from 2.x" note, and an icon.

### Hosts

- **ChatGPT.** Its own adapter card (`get_adapter({ id: 'chatgpt' })`) and handoff profile, for
  connected MCP and for a shell-enabled Work box. A separate ChatGPT skills package
  ([plugins/mojulo-chatgpt](https://github.com/zombico/mojulo/blob/v3.0.0/plugins/mojulo-chatgpt/README.md))
  prefers connected MCP and otherwise sets up a pinned, workspace-local CLI in the box. Handoff notes
  keep a file on the MCP server apart from a file in the session, and promise no attachment or inline
  preview the session has not shown. Codex is no longer recognized by the bare OpenAI vendor name.
- **Meta Muse.** A host profile and adapter card for the shell-only agent on its own persistent Linux
  VM, where `npx mojulo call` is the whole surface and `MOJULO_HOST=muse` names its doors: pages leave
  through its Artifacts, files through its Library. A bundle export's `<ref>.courier.html` lists the
  export's files under `outcomes/<ref>/`, each with a Save where the viewer allows it, so one HTML page
  can deliver any of them. A host profile
  may name its own page words (`pageVerb`, `pageTool`, `pageOpensIn`), what its page door does with
  inline scripts (`inlinePage`), and a `drop-folder` file door.
- **`MOJULO_HOST`** picks the adapter card on the CLI, for `get_adapter`, catalyst composition and
  recommendations, when no client identity says which host is calling. An explicit adapter id or a
  recognized client still wins.
- **Recipe recovery.** `create_sketch` accepts an exported world recipe and passes it through the same
  validation and ledger stamp as `update_sketch`, so a recipe carried out of a temporary box comes back
  as it left, a hero with its hand edits. A duplicate ref refuses, and referenced assets must already
  exist.
- **MCP Apps preview, opt-in.** With `MOJULO_MCP_APPS=1`, `preview_world` shows an inline mesh
  snapshot of a stored ref in a host that supports MCP Apps; the exported HTML stays the full world.
  Nothing is hosted publicly.

### Dashboard package

- **The dashboard is its own npm package, `mojulo-ui`,** published at the same version as `mojulo`
  and depending on exactly that version. `npx -y mojulo-ui` starts it; core's `mojulo-ui` command
  runs the matching package or downloads it after saying so. It has no bot pages. Both packages
  carry LICENSE and NOTICE, and the dashboard lists every package it redistributes in
  `THIRD_PARTY_NOTICES.md`
  ([Dashboard package](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#dashboard-package)).

### Creative work

- **Characters and heroes:** the hero as a core form with a create-hero loop and tunes kept as the
  record, fitted landmark heads with a face tune and a hair library, the ring plan and creature loop,
  planar humanoids, and worn things that follow the dials
  ([Create hero](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#create-hero),
  [Hero detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-detail),
  [Hero tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-tune),
  [Fitted heads](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#fitted-heads),
  [Face tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#face-tune),
  [Hair library](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hair-library),
  [Ring plan](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#ring-plan),
  [Planar detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-detail),
  [Planar humanoid](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-humanoid),
  [Read and attach](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#read-and-attach)).
  The hero also wears the Anime Form Studio's head (`head: 'anime'`) on anime proportions, with
  fitted hair forms, looks as composable words, a graphic face and neck, a character light with
  designed shadow shapes, draw layers and clips at the door; its skinned GLB and Godot pack carry the
  face. Worn armour (plate, samurai lamellar and hard-suits, with themes carried down a suit) and held
  gear with swings ride the hero door
  ([layered manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/layered.md),
  [designing a hero](https://github.com/zombico/mojulo/blob/v3.0.0/docs/examples/humanoid/DESIGNING.md)).
- **Arms, metal and gems:** swords, daggers, greatswords, staves, bows and shields composed from a few
  dials and laws, pattern-welded blades included (`mint_solid` kind `equipment`); metal as a surface
  any part, facade, roof or trim can wear (a metal, a finish and an oxide film), reflected on the World
  page and kept in glTF and USD; gems with their optics and exact light prints, and crystals as light
  operators in worlds, performed in Godot
  ([equipment manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/equipment.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
  New cities wear a round street kit: lamps, poles, bins, bollards, piers, playground frames and
  rooftop equipment drawn round, a few of them in metal.
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Buildings and furniture:** timber from a synthetic log, steel sections, reinforced concrete and
  masonry, joined by Western and Japanese joinery through the exact kernel and checked, never refused;
  houses framed, lined and wired by their building tradition, carrying a building model with a
  takeoff; tile roofs and drainage; houses exported as IFC4 (`export_model` `format: 'ifc'`); house
  design checks that measure the walkways, with a repair; furniture built from sheet goods and
  fittings (carcasses, tables, chairs, sofas with upholstery and cloth from a weave draft), checked for
  sag, racking and tipping, with wordless assembly manuals; and the built pieces placed in rooms and
  condos ([floor plan manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/sketch-vocab/floor-plan.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Terrain and nature:** a painted landscape made real-scale ground you walk, fly and orbit, up to a
  small planet, or a world composed from features (a river, a range, a lake, a volcano, a coast) sized
  on real-world bands, with fractal cities sited on its hills; plants grown rather than drawn (trees by
  their architecture, palms, bamboo, figs and conifers), standing as forests where the ground is
  painted wood, and grass; rocks built from their minerals, and landforms and erosion on painted
  landscapes ([terrain manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/views/view-vocab/terrain.md),
  [vegetation](https://github.com/zombico/mojulo/blob/v3.0.0/docs/vegetation.md)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
  A line drawn on a `layered` solid becomes a recipe op (a silhouette solves the shape dials, a
  contour becomes a ridge strip, a brush a dial), with the share of the line it could not hold.
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
