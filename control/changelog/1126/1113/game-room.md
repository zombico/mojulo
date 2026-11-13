### The game room: one room composed for the game, tried in the practice door

A game that needs a single setting gets one good room, composed from what the game needs out of room primitives and
played in the practice door, which reconfigures itself into the game's room. It is not a geocube and not a
roguelike's rooms: one seeded, editable composition. Design notes: [docs/game-room.md](../../../../docs/game-room.md).

- **Room primitives** (`lib/graph/gameroom/primitives.js`): a closed table, as the board rail's kernel is. Low and tall
  cover, a pillar, a platform with its step, a crate, and a shift's counter, bin, shelf and pass. Each is its blocks,
  its plan and what it affords play (cover, screen, hop, vantage, climb, station, source, store, hand-in). A new kind of
  room is a new composition; a new primitive is a row.
- **The brief** (`needs.js`) reads the room from the game, each need saying why:
  - **size:** a crossing of about four seconds at the hero's run;
  - **cover and pillars:** for a fight hand to hand;
  - **decks:** where the jump makes them worth having;
  - **foes:** the world's count, else three where it fights;
  - **a shift:** its card tuned for one player;
  - **the camera:** the world's own.

  Shooters and platformers are left to the firing range and the platform room.
- **The composition** (`compose.js`, seeded): bands for the entry, the field and the goal, a clear lane down the spine,
  pairs mirrored across it, everything kept a metre apart. Decks stand against the side walls, foe spots behind cover,
  and a shift's line runs down the middle with the pass as the goal.
- **The room laws** (`laws.js`), on a quarter-metre grid of the floor, advice that never refuses: reachable, a 760 mm
  walkway (clearance), climbable decks, room to move, and nothing too tall for an overhead camera.
- **The practice door's game room** (`gameworld/game-room.js`, `room`), offered to a world that fights hand to hand,
  works a shift or has foes:
  - the conceptual plane, its primitives as blocks, the spawn and the goal ringed, a shift's recipe on the floor;
  - the hero, its own or a mascot, on the feel;
  - the foes on their spots, still until Shift+F;
  - a chase pulled back to read the room, or overhead for a shift.

  Its page says the brief, what was laid, the laws and the shift's proof. It has its own rail icon.
- **The dress** (`gameroom/dress.js`): the second pass, which never moves what stands. Each place keeps its box and
  collider, and its thing is drawn into that box, fitted to it. The things are the stage dressing's pieces, the
  furniture door's builds, and a few of the room's own (a range, a field plot, a leaf pile, a wheelie bin). A trade
  maps places to things:
  - kitchen, farm, site and chores for the shifts;
  - the hall for a fight.

  A shift wears its card's trade (its own `dress`, else its starter's) and a fight the hall. `dress: false`, or
  `&dress=none` on the practice pages, keeps the greybox, and the pages offer every trade.
- **The area** (`gameroom/area.js`): what the room stands in, designable. The dress draws the places and the area
  draws everything else, moving nothing:
  - **the floor:** a pattern in its colours (plane, tiles, boards, concrete, earth, lawn, flags);
  - **the walls:** a style with its height and colours (plain, tiled with windows, a fence, hoarding, stone between
    pilasters, a hedge, none), cut to a dark section on the south, where either camera starts. The wall colliders take
    the height drawn, so a chase pulls in off a full wall;
  - **the surround:** static things outside (a dining room, a street, fields, a barn, trees, a frame going up, a tower
    crane, a materials yard, the neighbours' houses, a colonnade);
  - **the ground and the sky.**

  Each trade has its own area. On a roof card, the deck is drawn as the house in a garden. A world designs its own with
  the new gameworld key `room: { dress?, area? }`, where the area is a name or an object over one (`like`, `floor`,
  `walls`, `surround`, `ground`, `sky`, `cut`); a malformed one is taught. `area: false`, or `&area=none` on the
  practice pages, keeps the conceptual plane, and the pages offer every trade's area. Seen in headless Chromium for
  each trade and the hall; the work proofs are unchanged.
- **The rooms' menu on mana-ui** (`gameworld/practice-mana.js`): the work room's and the game room's readout and
  choices leave their page panel, the H key and Shift+F for a menu drawn by mana-ui and driven by the controls layer.
  The keys, every pad layout and a finger work it alike, and each control is named as the controls kernel names it.
  - **It is the shell's pause, kept on the page.** The pilot scheme's `pause` (Esc, a pad's start) opens it, and the
    scene is held on the shell's sidecar, its clocks stopped. It opens as the page loads, as the room's briefing.
  - **Its screens:** the room's readout in tabs; set up (the movement, the worker, the dress, the area and the foes),
    the room reopened with them; and the controls this world answers to, its live rows.
  - **The foes** are woken on the shell's AI switch or the pilot's own G.
  - **The hint line** names each action by the key the scheme binds it to.

  In headless Chromium, the shift's clock held at 240 through the briefing and ran once resumed. Esc reopened the menu,
  and set up reopened the room with the movement and the area picked.
- Played in headless Chromium: a sword fighter's hall (28 m, two decks, pillars, low cover, three foes) and a shift's
  room (its line on counters, the proof won). Machine gates only: whether the room plays well is for someone in it to
  judge.
