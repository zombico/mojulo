# The game room

One good room for a game that needs a single setting, composed from what the game needs and tried in the practice
door. This is not a geocube and not a roguelike's rooms rolled for each run: it is one seeded, editable composition.
The practice room reconfigures itself into the game's room, a training room that becomes the game.

Status: the brief, the primitives, the composition, the laws, the dress, the area and the practice room are built
(`control/lib/graph/gameroom/`, `gameworld/game-room.js`), and the room composes and plays one fight (below). The
room is where a game's combat is settled; it is never a level. A game's levels are made by the geocube (a
building's rooms, a walk on its terrain), and a fight settled here is laid into them by these same rules: that,
approved fights kept on the world, and the interior designer's style cards as dresses are next.

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

## The dress

The second pass, after the room is solved (`gameroom/dress.js`). A dress never moves what stands: each place keeps its
box and its collider, and its thing is drawn into that box, fitted to it, so what is seen is what is walked round.

The things are the ones Mojulo already draws:

- the stage dressing's pieces (`era/compose-dress.js`: a crate, a barrel, a sack, a workbench, a cart, a drum,
  sandbags, a barrier), each a set of parts painted from the trade's palette;
- the furniture door's builds (`furnishings/forms.js`: the counter, the shop shelves, the tables), fitted to the box;
- a few of the room's own, in the same part form: a range, a field plot, a leaf pile, a wheelie bin.

| trade | what it draws |
|---|---|
| `kitchen` | a range where it cooks alone, workbenches where it is worked, counters for plating and the pass, shelving, barrels, sacks and crates for the raw things |
| `farm` | field plots where it grows alone, workbenches, carts, sacks and barrels |
| `site` | a mixer's drum, sandbags where it is dug, barriers, workbenches, sacks and crates |
| `chores` | leaf piles where it is raked, sacks where it is bagged, the bin it all goes to |
| `hall` | a fight's room: long tables and shelves for its cover, crates; its pillars and decks as built |

A shift is dressed in its card's trade (a card's own `dress`, else its starter's), a fight in the hall. `dress: false`
keeps the greybox. The practice pages offer every trade and the greybox on their set-up screen (`&dress=<trade>|none`).

## The area

What the room stands in, drawn round it (`gameroom/area.js`): the floor, the walls and what is seen beyond them. The
dress draws the places; the area draws everything else and moves nothing. The walls' colliders take the height drawn,
and the surround is static and outside the room, never walked.

- **The floor:** a pattern in its colours (`FLOORS`): the conceptual plane, tiles, boards, concrete, earth, a lawn,
  flagstones.
- **The walls:** a style (`WALLS`), each with its height and its colours: plain, tiled above a dado with windows, a
  post-and-rail fence, site hoarding, stone between pilasters with high windows, a hedge, or none. They are cut away to
  a section (its cap dark, as an architect's cut) on the south, where either camera starts: the overhead camera looks
  over it, and the chase would otherwise pull in off a full wall behind the spawn.
- **The surround** (`SURROUNDS`): the things laid outside, north, east and west, the camera's side left open. A dining
  room past a kitchen's far wall, a street, fields and a barn, trees, a frame going up and a tower crane, a materials
  yard, the neighbours' houses, a colonnade.
- **The ground and the sky:** the plane beyond, and the page's background.

Each trade has its own area: a kitchen's tiles and dining room, a farm's yard and fields, a site's slabs and crane, a
garden's lawn, hedge and houses (on a roof card, the deck is drawn as the house), a hall's flagstones and colonnade.
A world designs its own with `room: { dress?, area? }`. The area is a name, or an object over one:
`{ like?, floor?, walls?, surround?, ground?, sky?, cut? }`, where a floor or walls is a name or
`{ pattern | style, height?, colors? }`. A malformed area is taught, never guessed. `area: false` keeps the conceptual
plane. The practice pages offer every trade's area and the plane on their set-up screen (`&area=<trade>|none`); the page's choice
comes first, then the world's, then the trade's own.

## The practice room

The practice door's `room` (`gameworld/game-room.js`, served at `bible?book=practice&room=room`) is offered to a world
that fights hand to hand, works a shift or has foes:

- **The space:** the area (or the conceptual plane), each primitive drawn by its dress (or a block in its tone in the greybox), the
  spawn and the goal ringed on the floor, a shift's recipe drawn as arrows.
- **The hero:** the world's own, or a mascot of a form chosen on the page, on the world's feel or one chosen.
- **The foes:** on their spots, still until they are woken (the pilot's AI switch, G, or the menu's).
- **The camera:** a chase pulled back to read the room, or overhead for a shift.

Its menu is mana-ui's ([mana-ui.md](mana-ui.md#the-practice-rooms-menu)), opened by the pilot's pause (Esc, a pad's start) and
open as the page loads, as the briefing: the brief, what was laid, the laws and the shift's proof where there is one;
set up (the movement, the worker, the dress, the area, the foes), the room reopened with them; and the controls this
world answers to.

## A fight

The room composed for one fight and played (`gameroom/fight.js`, `gameworld/fights.js`), at
`bible?book=practice&room=room&fight=<kind>` (`&seed=<n>` another composition), or from the menu's Fight choice.

### What the kit asks

The brief reads the hero's kit (`needs.js` `kitAsks`): each move asks something of the place it is used in, and
says why. A kit without the move asks nothing, and a world with no kit has the brief it had.

| ask | asked by | what it is |
|---|---|---|
| `ring` | the longest ground string | open floor: its travel, the blade's reach, room for the pack |
| `air` | a launcher, the air strings | headroom: the launch's apex over a standing foe, the hero's jump beside it |
| `run-up` | a dashing blow | a clear lane of its travel and a foe's depth |
| `perch` | the sidearm | a shooter above the blade's reach from the floor |
| `gap` | the air dash | a deck that far from a perch reaches it through the air |
| `lock` | the lock | nothing tall between the ring and where foes come in |

### Its pieces

More rows of the same table. `rift`: a mark where a wave comes in, foe spots round it (it stands nothing).
`perch`: a high narrow deck a shooter stands on. `urn`: struck, it breaks and pays. `font`: it heals, a breath
between fights. `dais`: a low step a boss stands on. The ring and the run-up are reserves: floor kept clear. A
fight's anchors add its ways (given by the place: sealed while it stands), its rifts, its ring and the boss's spot.

### Its kinds

| kind | laid | for |
|---|---|---|
| `duel` | one foe in a small ring, cover off each flank | the string, learned on one foe |
| `melee` | the ring, rifts round its far side, urns at the walls, a font by the way on | the string on a pack, wave after wave |
| `gallery` | shooters on perches down both flanks, a deck an air dash short of the first, a run-up down the spine | the sidearm, the dashing blow, the air |
| `boss` | the widest ring, the boss on its dais, pillars in pairs outside the ring | everything at once |

A new kind is a row and its bands.

### Its laws

The room's, and (`laws.js` `fightLaws`): `ring` (nothing stands in it), `headroom` (the place is as high as the
launch asks; open above, it holds), `run-up` (the lane clear and long enough), `seen` (every rift and the dais
seen from the ring), `lock` (nothing tall between the ring and a foe's spot), `put-back` (a walker turned back from
a sealed way lands on free floor). Over a game's fights together, `asked` (`askedBy`): every ask of the kit is
answered by one of them.

### Played

A wave is written by role (`grunt`, `shooter`, `elite`, `boss`, each read off what the bestiary's entries are) or by
a foe's own id; a role stands its entry at the role's rank where the bestiary holds none. The foes stand asleep on
their spots: a boss on the dais, shooters on the perches, the rest at the rifts in turn. The hero is the action
room's, armed with the kit, and the foes are numbered by it.

The fight is the wave gauntlet (`game/wave-gauntlet.js`) with two settings added for it: its arena waits for the
hero to step into the ring, and every way but the way on is sealed beside it. Each wave comes when the last is
down; a death begins it again at the spawn; the last wave down, the ways open.

Its machine gate is the playthrough: the floor player wins a duel, a melee and a boss fight on the stand-in
bestiary, and one who does nothing wins none. It does not win the gallery: it has no answer to a shooter on a
perch, which is what the gallery is for. Nobody has played any of them: the eyes gate is the operator's.
