# What makes a side-scrolling map

A side-scrolling map is a belt: a strip of floor walked along and across, seen from one side by a camera that never
turns. Everything a player learns about the place comes from one picture that slides. These are the principles the
brawl's street was built to, said of the walk and the place round it and never of a street as such, so a place of any kind (a street, a plant, a base, an office, one of an agent's own)
can be laid to them. The code is `control/lib/graph/brawl/brawl-dress.js`; the agent's card is `gameworld-side-scroll`.

They are laws in the house sense: measured where they can be (`dressLaws`), and they advise. A map that loses one is
still made, and says which.

## The picture

1. **The band low, the backdrop over it.** The fight's floor sits in the lower half of the frame and the place it
   happens in fills the upper half. A camera aimed at a body's chest puts the floor in the middle and cuts the place
   off at head height; the belt's `street` angle stands further back and looks over the bodies' heads. A map that is
   dressed is framed this way.
2. **Nothing between the camera and the fight.** The near side stays clear, or holds only what stands under a body's
   waist. A lamp post in front of a punch is a punch not seen. (`low-near-side`)
3. **The band is the fight's.** The dress stands outside it: on the far floor between the band and the wall, on the
   wall, overhead. What stands *in* the band is a thing the game plays (a box to break, cover), never scenery.
   (`outside-the-band`)

## The place

4. **A screen is a place.** Each held screen is remembered by what it was: the market, the loading dock, the break
   room. No two screens running wear the same set, and a walk between two fights is quieter than either.
   (`a-place-a-screen`)
5. **The turn tells the story.** The way in, the held screens in turn, the boss's screen: a map has an order, and the
   order means something (the gate, then the depot, then the command post). Each kind of place carries its turn, so a
   map that says nothing still reads as a journey.
6. **The boss's screen is held.** The last screen belongs to whoever is fought there, and shows it: their mark on the
   wall, their colours hung, their things where they sit. The crew's colour is a single hue used for nothing else.
   (`the-boss-owns-it`)

## The backdrop

7. **Layers of depth.** A backdrop reads when it has more than one distance: things on the floor against the wall,
   marks on the wall itself, something overhead (a fire escape, a duct, a sign), and now and then a way through (an
   alley, a doorway, a window). A screen with only a floor row or only a decorated wall is flat. (`two-depths`)
8. **Break the run.** A wall that goes on unchanged is a texture. Buildings differ in height, material and roof, some
   set back, an alley between some; indoors, bays, doorways, glazing and racking do the same work. No stretch of the
   far side runs long with nothing on it. (`no-bare-run`)
9. **A mark belongs to one surface.** A poster, a shutter, a tag stands on one building or one bay, at that surface's
   own line. Nothing floats across an alley's mouth or a doorway.
10. **Variety inside the set.** A screen draws on several different things. Six desks in a row is a pattern; desks,
    a screen, a cabinet and a copier is an office. (`variety`)

## The wear

11. **A place sheds what it is made of.** Debris is the place's own matter where it would fall: brick and render at a
    wall's foot, glass and paper under a window, wreckage in an alley (skandart, `era/skandart.js`). What is too small
    to be read from the map's camera is left out, neither built nor painted in.
12. **What a place kept, it kept in groups.** Crates, drums and lockers stand together where they were stored, some
    tipped, some broken, in the form the place would have (wood and clay in an old street, painted steel in a plant).
13. **How far gone is one dial.** A set is tidy or rough as a whole: the wear on its walls, the rubbish on its floor
    and how many of its vessels lie broken go together.

## The walk bends

A map is a walk through a place, and a walk is not always a straight, level line. These principles are about the walk
and the place round it, whatever the place is: a street climbs, a corridor doglegs, a hall's floor steps down to a
dock, an office floor jogs past its lift core, a room turns. Think "here is how a room turns", never "here is how a
street curves": the street is one case.

A walk bends in three ways, and each keeps something still.

14. **It rises.** The floor's height changes with how far along the walk a body stands (`rise`): a ramp, a flight of
    steps, a climb. The camera rises with the floor it looks at. *Across* the walk the floor stays level: a blow must
    share a line, and a line that tilts cannot be read.
15. **It turns.** The view swings to look down the walk the way it runs (`turn`), so the walk that crossed the screen
    now heads up it. The place does not move; what moves is where the walk points in the picture. The bodies stay in
    the middle of the frame and along is still along.
16. **It drifts.** The band slides across the walk's line (`drift`): north or south of it, on a diagonal, and back. The
    view stays square and follows the band up or down the screen. Here the place moves with the walk: its floor, its
    walls and what stands along them lie on the diagonal.

And for all three:

17. **The walk always scrolls sideways.** However it bends, the walk is along the belt and the band across it. The
    fight is played on a straight, level band and drawn on the bent one, so nothing about how it plays changes: not
    the controls, not the lines a blow must share, not a foe's reach.
18. **A bend is walked round, not snapped.** It eases in and out over a stretch of the walk, and stops short of where
    the fight could no longer be read from the side: a stair, not a wall; half a right angle, not a corner.
19. **A bend is where the map turns a page.** Put it between two held screens or on the way in. A fight on a stair or
    across a corner is hard to read; a fight on the landing above it, or in the room the corridor opened into, is
    remembered.
20. **Choose the bend by what should stay still.** A turn keeps the place and moves the view: use it to open the way
    ahead (the next room seen down the corridor, the boss's corner at the end of the street). A drift keeps the view
    and moves the place: use it where the map should read as going somewhere else on the plan. A rise changes the
    level: use it where the place itself changes (down to the dock, up to the command post).
21. **The place goes with the walk.** A place built for the map (a blockout) is laid along the band's line piece by
    piece. A place that already stands (a town's street, a building's rooms) is sheared by it: across by the drift, up
    by the rise, so its floor is a ramp and its plan a parallelogram, with its cross walls still square to the walk
    and its walls still plumb. What stands on its own (a lamp, a tree, a crate, a desk) is moved whole and never
    skewed; what is set into a surface (a window, a poster, a shutter) goes with its surface.
22. **What stands beside the walk stands on its own ground.** Buildings step up a climbing street, each on its pad; a
    piece of the dress stands on the floor under its own middle; nothing floats and nothing is buried. Where a ground
    cannot move, the band may still drift over it, and anything left standing in the band is cleared.

## The game: maps stitched by the turn

23. **A map is one turn.** A game does not launch a level; it runs a turn (`control/lib/graph/game/turn.js`,
    [game-flow.md](game-flow.md)): the player sets up, the level loads, it is played, its outcome is kept, the results
    are shown. Every map is entered and left the same way, so a game of several is stitched by the shell and never by
    the levels themselves.
24. **A map asks, and plays what it is told.** What the player chooses before a map (how hard it fights, who plays,
    what is carried in) is said once on the game and asked by the shell's own screens; the map reads the answer when
    it starts and plays it. A map played on its own, or by a game that asks nothing, plays as it is written.
25. **Ask once what holds for the game, each time what belongs to the map.** How hard is a game's choice; who walks
    into this map is this map's.
27. **A map names its scenes; the game calls them.** What happens as a map begins and as it ends (a card, a line, the
    camera shown the way) is a few beats the map says by name, played on its own page with the play held. Which of
    them plays, and on what outcome, is the game's to say. A scene is short, can be put away, and never plays twice on
    a retry.

26. **A map says how it ended, and nothing more.** Won or lost, how long, how much was left: the shell turns that into
    the results, the rank, the next map. A map never names the map after it.

## In a designed game

A street is a level of a designed game (the game book), not a game apart (`control/lib/graph/gameworld/brawl-cast.js`):

```js
levels: { dock: { name: 'Dock Road', street: { ground: { kind: 'town', drift: [[0, 0], [20, 0], [34, 8]] },
                                               stops: [{ wave: { grunt: 3 } }, { wave: { grunt: 3, shooter: 1 } }],
                                               boss: 'boss', lives: 3 } } }
```

- **The level says its street; the world says who is on it.** Its `stops` hold the view until their wave falls, its
  `boss` waits at the end, and each wave is written by the part someone plays (grunt, shooter, elite, boss) or by a
  foe's name, cast from the world's own bestiary. `street: true`, or a street with no stops, is three stops that build
  to the cast's boss.
- **Its place is its `ground`.** A place of its own in a kit's stead: a town's street, a stage on a kit, a blockout,
  with its dress and its rise, turn and drift. The stops are laid along it. On a ground, what stands on the street is
  its play's (breakables with food; a run & gun's cover from the dress and its gun crates) and it arrives and leaves
  by the starter's scenes, unless it says its own `things` and `scenes` (`scenes: false` for none).
- **Who plays is the game's hero, and each of its cast who joins**, a seat each up to four; anyone with a body can
  drop in on a second controller.
- **The game is the world's.** Its levels are stitched by the turn like any other world's; its own `setup` and `flow`
  are kept. Where every level is a street with scenes, each level's turn calls them.

## How it is played

A map is not a game type. One map (its belt, its bends, its dress, its scenes, its place in the turn) is played by a
**play type**, and the play type brings the idioms; the map does not change. The table is
`control/lib/graph/brawl/brawl-play.js` `PLAY_TYPES`, a row a type: the player's kit, what the turn asks, what the
screen shows, what stands in the band, how the map is held, what the end reads back. A new way to play a sideways map
is a row and its idioms, never a second map.

`play` is said on a quick brawl (every street) or on one of its streets; a designed game's street level is a run &
gun by its `guns` (or the game's intent):

```js
{ goal: 'brawl', play: 'gun', streets: [{ id: 'gate', level: { kind: 'stage', kit: 'bay-military' } }] }
levels: { dock: { street: { guns: true, ground: { kind: 'town' } } } }
```

- **A brawl** is the brawler's kit: a crowd on each held screen, breakables with food.
- **A run & gun** (`gun`) is the gunner's kit: fire, aim, plant, roll, jump, grenade. Its `guns` are what the player
  may start with (the turn asks which when there is more than one) and `grenades` how many it carries. A gunner takes
  what it walks over: a gun lying on the map (`{ kind: 'gun', what }`, usually in a crate) is held over the sidearm
  until it is spent. Unsaid, the map gets shooters on every screen with a rush between them, the setting's cover
  across the band, a gun crate on each held screen and food before the boss. The end reads accuracy too.
- **Cover is of the place.** A cover piece named for a dress piece is that piece stood in the band, drawn by the same
  builder and fitted to the box that stops a round (`brawl-dress.js` `coverModels`). A run & gun that names no things
  takes each screen's cover from the set that screen wears (`dressCover`): sandbags and barriers at a gate, pallets and
  drums on a dock, desks and cabinets on an open floor. A screen whose set has nothing that stops a round takes its
  setting's. A new piece becomes cover by a row in `THINGS.cover` under its name.
- **A boss may be one of the crowd's own kind.** A wave's `boss` is a fighter's recipe (a brawler on the fight's
  mind), or `{ type, name?, hp?, volley? }`: a crowd type's body as the boss, on its type's mind, with a boss's health
  and its bar. A run & gun's boss is a shooter (the starter's is the crowd's rocket): a gunner has no answer to a boss
  that fights at arm's length.
- **A boss has phases.** A boss of a crowd type may say `phases: [{ at, type?, volley?, calls?, says? }]`: as its
  health falls to `at` (a share of it, each lower than the last) it fights as another crowd type (that type's gun and
  plays) or with more rounds a volley, calls bodies in, and the screen says its word. Its bar carries a pip a phase.
  The run & gun's starter boss throws its rocket down for a burst gun at half health and calls two more.
- **A second player sits down mid-map.** A street makes a body for each spare seat (the playable characters no one
  picked, never one the crowd is drawn as; two seats at least) and keeps it off the street. A controller that presses
  attack or start takes the next seat and walks in beside the first, the street going on: no restart. Its name, health
  and gun stand under the first player's. The street is lost when every seated player is down.
- **A wave on an open screen is fought on the move**, in either play: it comes in as the player walks in, the camera is
  not held, and it is let go once the player is on the next wave's screen. Holds stay for the screens that are gated
  and the boss's.

## The screen

What a side-scrolling action game shows while it is played (`control/lib/graph/brawl/brawl-street.js`, drawn by the
game UI runtime in the `brawl-street` look), in either play:

- **Four seats, a quarter of the screen each.** The top is divided in four, one quarter a seat, whoever sits in them,
  so a seat never moves when another is taken. A seat's colour is its own (the look's `sides`): on its tag, and on the
  mark its player stands on.
- **A seat taken** shows its tag and name, its health read by its length, and for a run & gun the gun in its hands as
  two letters, its rounds (marked LOW at a fifth of a magazine) and its grenades.
- **A seat open** shows its tag and how to sit down. A seat the game does not have leaves its quarter empty.
- **The middle of the screen is the fight's.** The way through (the held screens as marks) and who is left stand at the
  foot's corners, the boss's bar between them with a mark a phase. Words (GO, a boss's name, a phase) cross the middle
  for a moment and leave.
- **Pictures for what is counted.** Rounds, grenades and the crowd left are pictograms (`mana-ui/icons.js`), in the
  look's own style.

## The fight, measured

A map's encounters have a machine gate (`control/lib/graph/brawl/brawl-measure.js`). The street is fought down on the
game's own simulation by a bot that plays the player's kit through its buttons, with no page, in seconds:

- **Two players.** The *masher* is the floor: it walks at the nearest body and attacks, and dodges nothing. The
  *careful* one steps off a round's line, eats when hurt, opens crates, and backs off a brawler when it holds a gun.
- **Every difficulty**, as the page lays it (the crowd's rules, a boss's mind).
- **Several takes.** A fight is not one number: each case is fought from slightly different starts and the middle
  take is the run. `won` says how many takes were won.
- **Wave by wave.** Each run says how long each wave lasted, what share of the health bar it took, and how many fell.

The runs are read against the **fight laws** (`FIGHT_LAWS`): the floor player finishes on easy; care is rewarded as
written; the hardest tier can still be won; no wave is a spike; no held wave is a slog; the map opens gently; every run
ends. A law lost names the wave and says what to change. It advises and refuses nothing.

`design_game`'s readout measures each street (the two decisive cases) and, where a law is lost, adds a `fight`
step naming the map, the law and the wave. The whole table:

```bash
node scripts/spikes/brawler/measure.mjs --play gun --level '{"kind":"stage","kit":"bay-military"}'
```

What it is not: the eyes gate. The bots are stand-ins, cruder than a person, and the player they play is a stand-in
all-rounder, not the game's own fighter. It says whether a fight can be got through and where it bites, not whether it
is fun. The starter's own waves, food and difficulty tiers were set against it, and a deep test holds them to it.

## Writing a place

A place is three tables, and a new one is rows:

- **Pieces**: a thing built from boxes, drums and slopes in its own frame, with its footprint and its height. A piece
  is a floor piece or a wall mark.
- **Sets**: a screen's theme: the floor pieces it draws from and how close they stand, the wall marks and their
  stride, the few low things its near side may take.
- **Settings**: a kind of place: the sets that belong to it, the turn it takes unsaid, what stands in its band to be
  broken, the level kits it dresses.

An agent that wants a place the shelves do not have writes a set of its own in a map's `sets`, from the pieces that
exist: `{ says, far: { piece: weight }, wall: { piece: weight }, gap: [least, most], marks: [least, most] }`. The laws
read it as they read a row.
