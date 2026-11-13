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
- Played in headless Chromium: a sword fighter's hall (28 m, two decks, pillars, low cover, three foes) and a shift's
  room (its line on counters, the proof won). Machine gates only: whether the room plays well is for someone in it to
  judge.
