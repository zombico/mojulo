# The game room

One good room for a game that needs a single setting, composed from what the game needs and tried in the practice
door. This is not a geocube and not a roguelike's rooms rolled for each run: it is one seeded, editable composition.
The practice room reconfigures itself into the game's room, a training room that becomes the game.

Status: the brief, the primitives, the composition, the laws, the dress, the area and the practice room are built
(`control/lib/graph/gameroom/`, `gameworld/game-room.js`), and the room composes and plays one fight (below). The
room is where a game's combat is settled; it is not itself a level. A game's levels are made by the geocube (a
building's rooms, a walk on its terrain), and a fight settled here is kept on the world by name (its `fights` key)
and laid into a building level as an ordered task (`goal.tasks`, `gameworld/tasks.js`; "A fight", below). The
interior designer's style cards as dresses are next.

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

### Kept

A fight the creator has played and wants is kept on the world by name (`gameworld/fights.js`):
`fights: { <name>: { kind, seed?, waves? } }`. The kind and the seed are the composition, so nothing rendered is
stored; the waves are its own, by role or by a foe's id, else the kind's. The room plays one by its name
(`&fight=<name>`), and its menu lists the kept ones first.

`design_game`'s readout says them under `practice.fights` (`gameworld/fights-readout.js`): each kept fight and the
laws it loses, and whether together they answer everything the kit asks. A world that fights hand to hand and
keeps none is offered one of each kind as a patch, on the room's step; it is never laid unasked. Approving a fight
on its own, and editing a composition piece by piece, are not built yet.

## Where a fight is laid

A level gives the place. `laws.js` `fitsLaw(box, needs, kind)` says whether a room a level gives (its width, depth
and height) holds a fight of a kind: the ring, the way round it where the waves come in, and the headroom a launch
asks. A building laid for living in holds few (a keep's great hall holds a melee, a crypt's chambers none).

The building use `citadel` (`era/programs.js`) is laid to be fought through: a gate court, the great hall, the
long gallery and the sanctum, in a chain, each sized for its fight (a duel, a melee, a gallery, a boss fight) and
tall enough for a launch. It is made for the seventh generation: the ashlar kit (`gothic-ashlar`, drawn for tall
rooms) read in `gen-7`.

### A level's tasks

A building level says its fights in order (`gameworld/tasks.js`):
`goal: { tasks: [{ fight: '<a kept fight>', at: '<a room>' }, …] }`. Each is one of the world's kept fights, laid
in that room by `gameroom/fight.js` `layFight`: composed on the largest square the room holds, turned so the hero
comes in by the doorway that leads to it, set at the room's centre. The room's doorways are the fight's ways; a
piece or a rift that would stand before one is left out and said. Its pieces stand as the stage's props
(`era/compose-dress.js`: a pillar, a perch, an urn, a font, a dais, a barrier), painted in the kit's own stone.

The tasks are one wave gauntlet, an arena a task. A fight begins when the hero steps into its ring; its own
doorways are sealed from then until its last wave is down (a walker is turned back into the room); the next is
armed at once, so the walk to it is the breath. The hero's hp is the tasks'; a death begins the fight it fell in
again, at the doorway it was come into by. The last task down ends the level.

`gameworld/action-first-level.js` is the action game's first level: the citadel with a duel in its gate court, a
melee in its great hall, a gallery fight in its long gallery and the boss in its sanctum, against zombies and armed
skeletons (the undead form library's: the slow dead, the armed skeleton, the archer, the armoured dead, the
knight).

Its machine gate is the playthrough (the e2e tier): the floor player walks the rooms in order, fells every wave of
all four fights and ends the level; one who does nothing wins nothing. Nobody has played it.

## The style meter

A game's `styleMeter` (`gameworld/style-meter.js`; `'auto'` on a game whose feel is the stylish template, `true`,
or its own numbers and tier words) lays the runtime's meter (`worlds/controllable/style.js`) on every level. It is
read off the world after each step:

| what happens | what the meter does |
|---|---|
| a blow lands | its worth, halved for each time its move stands in the last few moves, more off the ground, more again if it launches |
| a weapon switched mid-string | a switch's worth |
| a parry, a foe felled, a round landed | each its own |
| nothing lands for a while | it falls, and at nothing the combo is over |
| the hero is hit | a whole tier lost, the combo gone |

`window.__mojStyle.now()` on a level's page says the tier, how far through it, the combo, the peak and what was
earned. The level's HUD draws it at the right (`game/hud-mana.js`, on the game UI runtime, in the game's look): the
tier's name and the combo's count, standing only while there is style to show. The letter fills from its foot as
the tier is climbed, slams in on a tier gained and shakes on a tier lost; the count is struck by each blow and grows
heavier as the combo runs.

Beside it the stylish template carries a **Halo Meter** (the meter's `halo`): blows landed fill it in stocks, more in
the air, and a hit taken a little. With the stocks it takes full, the transform press (B, a pad's left stick)
**transforms** the hero until the meter runs dry or the press comes again:

| `halo` | what it says |
|---|---|
| `stocks`, `per` | the stocks it holds now, and the points a stock is |
| `hit`, `hurt` | what a blow landed and a hit taken put in |
| `at` | the stocks it takes to transform |
| `drain` | stocks a second while transformed |
| `might`, `swift`, `heal` | the blows' damage and the run raised while it lasts, and the hero's own health healed a second |

Transformed, the hero grows black angel's wings behind his back, a golden halo stands over his head, his hair turns
white and his skin dark grey, and the meter fills no further. Its `heal` mends the level's own health too, where the
level keeps one on the bus (a fight's `hp` row): the bus hears `halo:heal` with the points mended, and the level adds
them up to the health it starts at. The bus also hears `halo:ready` the moment the gauge can transform, and `halo:on`
and `halo:off`; the HUD marks the ready moment once, a ring thrown off the vitals' crest and the gauge struck white,
then breathes until the press.
The HUD draws the health and the gauge as one figure, the **vitals** (the meter's `vitals: { look, hp, halo }`):
no box, a crest at their root, each bar at its share of the length it reaches by the game's end (`hp` and `halo`,
the health twice its start and ten stocks unless said), so the figure reads from the first level to the last. Its
`look` says how the two forms answer: `overlap`, `contrast` or `echo`.

A level of such a game is **ranked** as it is won (`game/rank.js`, the level's `game.rank`): one letter of the
meter's own tiers, the mean of three marks.

| mark | what it reads |
|---|---|
| time | at or under the par, full; nothing at twice the par |
| style | the highest tier the meter reached, of its top |
| clean | the hits taken, of the hits a life holds |

The par is counted from the level's tasks (`gameworld/style-meter.js` `PAR`: a fight's walk in, and each of its
foes); a level with no tasks has no time mark. The rank, the time, the style earned and the longest combo go on the
level's results, and the play shell keeps the best of each figure.

A stylish action game's HUD holds to one principle: **no box is drawn**. Letters and figures stand over the play on
no plate; a change is said by effects and motion on them, never by a frame; and nothing is explained in words the
play shows, so a legend row is not drawn and a mark or an arrow says where to go. A level that carries the meter
gets this HUD (`hudToMana`'s `immersive`, said with `style` unless said not). The game's screens hold to it too
(`game/immersive-ui.js`, the game's `ui.immersive`, laid by the run on a game that carries the meter): no plate, no
frame and no veil over the play; the choice marked by its arrow alone; a rank its letter, stamped large. The
letters carry the look instead, in a light rim and a light shadow of the theme's own accents. Between a level's
fights an arrow (`manaHud.ways`), and no words, points to the next fight's ring: over it while it is in view, at
the screen's edge while it is not.
