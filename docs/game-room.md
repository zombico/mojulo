# The game room

One good room for a game that needs a single setting, composed from what the game needs and tried in the practice
door. This is not a geocube and not a roguelike's rooms rolled for each run: it is one seeded, editable composition.
The practice room reconfigures itself into the game's room, a training room that becomes the game.

Status: the brief, the primitives, the composition, the laws and the practice room are built
(`control/lib/graph/gameroom/`, `gameworld/game-room.js`). The dress (a room kit or the interior designer's style)
and a room as a level (`levels.<id>.room`) are next.

## Composable primitives

A room is composed the way the board rail composes a board game out of its kernel's primitives: a closed table
(`gameroom/primitives.js`). Each primitive is its blocks, the anchors it gives and what it affords play:

| primitive | affords |
|---|---|
| `cover-low` | cover, a hop |
| `cover-tall` | cover, a screen |
| `pillar` | a screen: a chase turned |
| `platform` | a vantage, a climb (a step where it stands too high to step onto) |
| `crate` | cover, a climb |
| `counter`, `bin`, `shelf`, `pass` | a shift's station, source, store and hand-in |

The anchors are the spawn, the goal and the foe spots. A new kind of room is a new composition of these; a new
primitive is a row.

## The brief

The room is solved from the game, then dressed (`gameroom/needs.js`):

- **Size:** a crossing of about four seconds at the hero's run, so a quick hero gets a bigger room.
- **Cover and pillars:** a fight hand to hand gets a little cover and two pillars, to round and break a chase.
- **Decks:** where the jump makes them worth having, a deck the jump clears with room to spare (a vantage, room for
  air moves).
- **Foes:** the world's count, else three where it fights.
- **A shift:** its card tuned for one player.
- **The camera:** the world's own; overhead keeps the room low.

Each need says why. Shooters and platformers are left out: the firing range and the platform room are their practice,
and the game room serves the games that have no room of their own.

## The composition

`gameroom/compose.js` lays the room, seeded, by an arena's craft rather than by chance:

- **Bands:** the entry (south, the spawn), the field, and the goal (north).
- **A lane:** a clear spine from the spawn to the goal, so the room can always be crossed.
- **Mirrored pairs:** what stands off the spine stands in pairs across it, so the room reads at a glance and neither
  flank is the better one.
- **Kept apart:** every primitive a metre clear of the others, the spawn, the goal and the walls.
- **Placement:** decks against the side walls, their steps toward the spawn; foe spots in the north half, a step behind
  cover; a shift's line down the middle as counters, bins, shelves and the pass, the goal the pass.

## The room laws

`gameroom/laws.js`, measured on a quarter-metre grid of the floor. They advise and never refuse:

- **reachable:** every anchor is reached walking from the spawn.
- **clearance:** a 760 mm walkway (the interior designer's) runs from the spawn to the goal.
- **climbable:** every deck is within the jump.
- **room-to-move:** at least 55% of the floor is free.
- **camera:** under an overhead camera, nothing stands taller than 2.5 m.

## The practice room

The practice door's `room` (`gameworld/game-room.js`, served at `bible?book=practice&room=room`) is offered to a world
that fights hand to hand, works a shift or has foes:

- **The space:** the conceptual plane, each primitive a block in its tone (a counter in its verb's colour), the spawn
  and the goal ringed on the floor, a shift's recipe drawn as arrows.
- **The hero:** the world's own, or a mascot of a form chosen on the page, on the world's feel or one chosen.
- **The foes:** on their spots, still until Shift+F wakes them.
- **The camera:** a chase pulled back to read the room, or overhead for a shift.

Its page says the brief, what was laid, the laws, and the shift's proof where there is one.
