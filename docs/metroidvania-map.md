# The metroidvania map: the spiralling box

A traditional side-scroller's level is a chain of camera zones, laid one after another
([side-map-principles.md](side-map-principles.md)): it is walked once, forward, to a boss. A metroidvania's map is the
same elevation joined into itself. Its rooms sit side by side on a grid of screens, its doors lead back as well as on,
and its gates hold until the hero carries what opens them. The map is the progression.

This page is the house's principle for laying one: **the economical use of spiralling space**. It is the megaworld's
mandala ([megaworld.js](../control/lib/graph/gameworld/megaworld.js): rings deeper inward to a gated core) and the
walled-core dungeon's layers ([walled-core-dungeon.md](walled-core-dungeon.md)) folded into one continuous 2D map.

**Status.** Greybox, played. The box is laid, built in metres, solved, held to its laws, drawn, and played on the side
map's runtime by Erina, Vampire Sonata's hero. It is not yet dressed, fought against foes, or a rail; see "Not yet".

## The box

1. **A map is a box, entered from the left.** Its size is in screens (a cell is one screen, as a metroidvania's map
   squares are; a screen in metres is the side map's, [screen.js](../control/lib/graph/gameworld/side-map/screen.js)).
   The way in is a door in the near wall of its bottom-left room.
2. **The way spirals inward.** The walk goes round the box's outer ring first: along the floor, up the far side, back
   along the top, down the near side, ending beside where it began. A gated step then leads into the ring inside, which
   is walked the same way round, and so on to the **core** in the middle. `ccw` goes along the floor first; `cw` climbs
   the near side first. Every ring turns the same way.
3. **A ring is a region.** Each ring is one place, the walled-core dungeon's layer: the outer wall, the great halls, the
   inner ward. The core is the deepest. Its halls are walked to the throne.
4. **Both axes are travelled.** Every ring has a leg up and a leg down, so the walk alternates crossing and climbing. A
   leg across is cut into corridors and a leg up or down into shafts; each corner is a room of its own (a turn).
5. **The box is spent.** The rooms take the box, not corridors with mass left between them. Every ring lies against the
   one outside it, so the same box is crossed again from another side.

## The economy: every ring is a wall away from the last

6. **A ring loops back to its gate.** Its last room drops into its first, so its save room is a step away when the ring
   is done.
7. **Shortcuts out.** A ring inside opens back out to the ring outside it, besides the step in. Its floor drops through
   to the floor below, one way. Its top climbs out through a gate that what it finds opens, so it is opened from inside.
   The way back from the core is a fraction of the way in.
8. **Pockets behind.** A ring holds alcoves behind gates it cannot open yet: a high shelf, a cracked alcove, a grate.
   A power found deeper in opens them, so every power sends the hunter back as well as on.

## The gates

What stands in the way until the hero holds what opens it. Each is a row of `GATES`
([gates.js](../control/lib/graph/gameworld/metroidvania/gates.js)), and each has its own greybox shape, so a gate reads as
what it asks from across the room. A new gate is a row.

| Gate | What it is | Opened by | Greybox shape |
|---|---|---|---|
| form | a grate or crawlway a third of the hero tall | a power: a small form (mist) | bars over a low slit |
| double-jump | a sill a jump and a half up | a power: the second jump | a raised sill in the doorway, or a hole's last rise |
| wall-break | a cracked wall across the way | a power: the special strike | a cracked block |
| key | a locked door | the key found earlier in the same ring | a door with a keyhole |
| boss | the boss room's way on | the boss felled | a seal |
| secret | a pocket's wall like the walls round it | blows: no power asked | a block of the wall's own stone |

### Secret walls: destructible terrain

A pocket may be a secret (`pockets: [{ gate: 'secret', holds }]`). Its wall is the one gate no power opens and nothing
marks: it is found by striking the walls. It is never the step into a ring (`inward`), and the solve opens it with
nothing held.

- **It looks like the wall.** In a dressed box it is the alcove's own back wall copied across its mouth (`scene.js`):
  the same blocks, mortar and baked light. Only the blow tells it.
- **No gate holds it.** It is a breakable outside the held gates, broken in `SECRET.blows` blows (`gates.js`).
- **The map keeps its prize off** until the wall is down (`boxMapView`'s `broken`).
- **Destructible terrain where the game asks for it.** Under the game's `mechanics.destruction: 'physical'`, the level
  is physical (`level.js`). The secret wall is then its room's wall matter, the geocube's (`cubeMatter`), a facing just
  thin enough to fall on its last blow at the box's power (`SECRET.power`, heroic, unless the level's `matter` says
  its own). Rupa breaks it: its joules spent swing by swing, its pieces thrown as its stone (`docs/rupa.md`). The law
  `secrets` says each falls on its last blow. Without a degree, it falls to counted blows.

Vampire Sonata hides a relic in the great halls; XenoJager hides a missile pack in the crust and an energy tank in the
fungal caverns.

9. **Every step in is a gate**, and each asks something no step before it asked.
10. **What opens a gate is found before the gate is met** on the walk: a key before its lock, a power before its gate.
    A boss stands in its ring's last corner, and its prize is the ring's power. A boss's chamber is a plain one, fought
    in on its floor: never a shaft, no door above its floor to climb to (`box.js` `plainRoom`; a hole in its floor is
    climbed in the room below and grated shut through the fight). A boss laid in a room that is not is moved, with its
    prize and its seal, to the nearest plain room of its region; a band's climb up out of a serpentine's region steps
    aside of its chamber. The law `plain-chamber` holds it; a region with no plain room (the barbican, all shafts) has
    no boss. A ring with no boss keeps its power in
    a relic room at its far top corner.
11. **No stomp, no wall kick.** The castle's hero never lands on a foe to beat it and never kicks off a wall. Every
    climb is a stair of ledges each a share of a single jump apart. A double-jump gate's last rise is more than a jump
    and less than a double jump, so it is a gate.

## The greybox

The box built in metres before any dress ([rooms.js](../control/lib/graph/gameworld/metroidvania/rooms.js)): each room's
floor, ceiling and walls; its doors cut through them, a doorway in a wall or a hole through a floor; a CLIMB up to
every door a room is left by upward (below); each gate's block in its door; each pocket's alcove. Drops are holes set
aside of the line a climb comes up, so a fall down a shaft does not drop through them.

It is drawn as an elevation ([drawing.js](../control/lib/graph/gameworld/metroidvania/drawing.js)): each ring's voids in
its shade, the walk numbered room by room, the gates in their colours and shapes, the shortcuts dashed, saves, bosses,
powers and pockets marked, and the laws under it.

```bash
node scripts/metroidvania.mjs [words.json] [--out dir] [--turn ccw|cw] [--box 14x8]
```

## Climbs: going up is going across

A shaft climbed as a hop straight up a column is a lift, not a place, and a run of floating steps makes a castle a
platform game. A room is climbed by its STRUCTURE ([climbs.js](../control/lib/graph/gameworld/metroidvania/climbs.js),
`layStructure`): every piece is built onto the castle and stands solid, a closed part she stands on and never jumps up
through. Going up is going across: the way turns left and right as it rises, and a tower's way weaves from one screen to
the other.

| Piece | What it is | How she gets on it |
|---|---|---|
| a flight | steps a riser under the runtime's step apart, rising across a bay, a stringer under them; the flight that rises from the floor is built up from it, one stepped mass | walked |
| great steps | blocks a leap apart rising across a bay, each reaching well under the one before it, so the flight is one stepped mass | leapt |
| a landing | a block at the end of a flight, built out from a wall or the tower's pier on its corbel | walked or leapt onto |
| a ladder | at a turn, where the way doubles back above itself: set in a slot at the wall beside the landing over it, from the landing at its foot to the one at its head | held up (W), stepped off at its head |
| the pier | a tower's middle, from its floor to its ceiling, an archway at its foot and one at each landing the way crosses it by | walked through |
| the rock | in the rooms on the box's bottom row, what rises from the floor is the castle's own rock breaking through | as the piece it is |

Two structures are dealt room by room in turn (`STRUCT_DEAL`): the **stair tower** (every flight walked) and the **great
stair** (every other flight leapt). Each is laid from the door it climbs to downward: the landing under the door's hole (or
at its doorway), then the way back down a cycle (a flight across a bay, through the pier, a flight across the other bay,
a ladder at its wall where the way doubles back, a flight back, through the pier, ...), until the lowest flight reaches
the floor and is built up from it. A door a room is climbed to stands over the end of a bay (the hole near a wall, a
tower's outer wall) so the way ends at a landing built onto the castle.

A structure fits when it holds:

1. **A jump at a time.** No rise past a jump but a ladder's, no gap past `CLIMB.reach` jumps.
2. **Clear over her head.** No solid closer than a jump and a body over what is stood on under it: she would strike it
   rising. So a ladder rises `STRUCT.ladder`, the landing at its head clear of the one at its foot.
3. **Clear of the way in.** Nothing over a hole in the floor she comes up through, and no mass before a doorway at the
   floor or over what stands on it (a save, a relic, a key).

A room no structure fits, or one left through a double jump's sill, is climbed by the older figures of ledges
(`CLIMB_DEAL`: switchback, flights, stair, the zigzag last), held to the same jump and to a body's headroom.

**Towers.** A ring's words may say `towers: true` (box.js): its legs up and down are two screens wide, its corners as
wide, the rings inside it a column further in. Vampire Sonata's outer wall has them, so its box is 14 × 8. A tower is
closed against the night (the outer wall's `shaft` locale, `tower` in themes.js: banners, arrow-slit lancets, torches),
its way woven through its pier from screen to screen; the side map's camera follows across both its screens.

A climb's stands are its chain's `spans`, and how each is got onto its `ways` (walk, jump, ladder), so a bot can play
it: the level's e2e climbs every room of the castle that is not gated, stairs walked, great steps leapt, ladders held,
and out through its door. The double jump, once found, reaches a landing two leaps up: a power that changes how a room is
climbed. Laws: `climbs-across` (a climb of more than a storey spreads across its screen), `headroom` (ledges a body
clear, a structure a jump and a body clear), `no-kick` (a ladder's rise excepted). The fabric builds each piece in the
room's stone: a flight one coursed mass, its tread lit and its nosing proud; a great step in courses, coped; a landing on
its corbel; the pier quoined, its archways made as a doorway is; the ladder's rails and rungs behind her on the lane; the
rock in boulders, their tops lit.

## The shapes: a spiral and its siblings

The spiral is one way to fill a box: a destination, walked in to a core. A box can take other shapes
([shapes.js](../control/lib/graph/gameworld/metroidvania/shapes.js), `SHAPES`, a row each). Each fills the box and
gates its regions the same way, and each has its own role in a castle of boxes:

- **The spiral** (unsaid): round the outside, inward ring by ring to a core. A keep: it ends inside.
- **The serpentine**: row by row from the bottom left. Each row is run to its end, climbed at its end, and run back the
  other way, so the walk climbs a row a turn. Its regions are bands of rows, the lowest first, each stepped into through
  a gate at a row's end. Its way back is the **chute**, a one-way drop down the box's middle column through every row,
  landing only where the walk has been. Each band past the first is climbed into from the band below through a gate its
  own find opens. A bell tower, or an approach up a cliff: it passes through, in low on the left and out at the top.
- **The hub**: a centre column of shafts, the hub. The **approach** is climbed column by column from the entry to arrive
  beside it. Its **wings** (lower right, upper right, upper left) are each stepped into from the hub, walked out and back
  row by row to end beside it, and **return** to it through a one-way door. A wing's boss seals that return, and each
  wing's prize opens the next wing's door on the hub. The hub's own region may leave its first wing open, since the hub
  is where the walk chooses. A courtyard: it joins.

The hub's size is set by its geometry: an odd number of columns whose sides are odd too (7, 11, 15), so the approach
arrives beside the hub, and 4, 8 or 12 rows, so each wing ends beside it. Its regions are the approach, the hub and one
to three wings. Every region is furnished the same way whatever the shape: a save room at its first room and its middle,
its key early and its lock halfway, and its boss and prize (or its relic) where the shape puts its end. That end is a
wing's dead end, or the room before a band's last turn. Pockets are spread along its corridors, and the last region's
last room is the throne.

Vampire Sonata keeps two more boxes of the castle: the **bell tower** (`bellTower()`, a serpentine of 8 × 6: the tower
foot, the belfry, the spire) and the **courtyard** (`courtyard()`, a hub of 7 × 8: the barbican, the court, the chapel,
the armoury, the crypt). `node scripts/metroidvania.mjs --shape serpentine | hub` draws them.

## A castle of boxes: ports and connectors

A castle is several boxes set on one grid of screens and joined across the night between them, laid as one map
([castle.js](../control/lib/graph/gameworld/metroidvania/castle.js)): the megaworld's rings at the next scale. Each box keeps
its own shape, and the castle is walked one box into the next.

- **Ports** are where a box is entered and left: a door on its side. Every box is entered by its gate, `in` (its left
  side's bottom room). A box that passes through or joins is left by its `out`:
  - a serpentine where its top row runs to, its last room's far side (an odd number of rows leaves on its right);
  - a hub at its top right, its upper right wing's far corner.

  A spiral is a destination and is never left.
- **Connectors** join one box's `out` to the next box's `in`, a row each (`CONNECTORS`):
  - **bridge:** a span open to the night, `length` screens, its far end gated where it says (a power's gate);
  - **gatehouse:** a gate-tower of two rooms, its hall a save room, then its gate on the way on (a boss standing in it,
    `boss`, or a power's gate).

  A box whose out room holds its core's boss is sealed by it: what passes through a box beats it.
- **The castle** places its boxes in the order the walk takes them. Each next box's gate is level with the last box's out,
  its connector's `length` screens on. The walk is the boxes' walks one after another through their connectors, and the
  castle's core is the last box's. The powers are the castle's, each found once in it, and a region may name its theme
  look (`look`, by its place in the theme's looks), so the courtyard can stand open to the sky.
- **The laws.** Each box is held on its own to its shape's laws (`<box>:<law>`, `BOX_SHARE`: its entry, its filling, its
  shape, its axes, its gates in, its rhythm, its saves, its core's boss). The castle is held to the laws of a walk through
  all of it (`CASTLE_LAWS`):
  - `joined`: every box on the chain, each join from an out to the next gate, nothing laid over another;
  - `roles`: a destination never passed through, and the castle ending in its core;
  - `connectors`: each as its row says;
  - every gate's opener found before it, the castle finished, every power opening something behind it, every pocket
    opened;
  - `way-back`: from the castle's core to its gate a fraction of the way in;
  - no kick, the sills holding, and the saves.

Vampire Sonata's castle (`vampireSonataCastle()`; `vampireSonataGame({ castle: true })` plays it) has three boxes:
- **The bell tower**, a serpentine of 8 × 5. The second leap is at its foot and the Great Bell in its open spire, sealing
  the way out.
- **The bell bridge.**
- **The courtyard**, a hub of 7 × 8, open to the sky. The chapel holds the Warden and the ram strike, the armoury the mist
  veil, and the crypt its lord.
- **The keep's gatehouse**, with its Gatekeeper.
- **The keep**, a spiral of 8 × 6 to the Lord of the Keep.

`node scripts/metroidvania.mjs --castle` draws it as one elevation, each box outlined.

### A segment a map: the castle on the megaworld

A castle can be played one map or a segment a map (`segmentsOf` in castle.js). As segments, each box is its own level:
the box and the connector out of it. A level names its box with `segment` beside its `metroidvania`, and the megaworld
joins the levels. `vampireSonataGame({ castle: 'segments' })` lays the tower, the courtyard and the keep on a chain.

- **The cut.** The castle is laid whole, then each page keeps its own columns
  ([scene.js](../control/lib/graph/gameworld/metroidvania/scene.js) `cutToSegment`): its faces and solids, its gates,
  relics, saves and bosses, its flames and motes. The camera keeps only its own rooms. The explored map stays the
  castle's whole, so the pause map shows every segment.
- **The ways.** Each way of the megaworld's map names the segment it leads to (levels.js `mapPlan`). On this page it is
  an exit at the door that crosses into that segment, taken as she reaches the door's edge
  ([level.js](../control/lib/graph/gameworld/metroidvania/level.js) `segmentWays`). Coming in by a way, she stands just
  inside that door, on its floor. The first segment starts at the castle's gate; any other starts at its first door in.
  The goal is the throne, on the keep's page.
- **The journey.** What she gains goes on with her into the next segment, kept in the game's `journey` flags slice by
  the `journey` mechanic (game/mechanics.js). The runtime raises each gain as `journey:<what>:<id>`
  ([held-gates.js](../control/lib/graph/worlds/controllable/held-gates.js)):
  - a relic taken, a boss felled, a gate opened;
  - a tile walked;
  - a node learned;
  - a foe's souls.

  On entry the page puts each back as it stood (`carryIn`), without a toast. What she holds opens its gates. A power's
  move is laid on her again, because the gains found beyond a page are named in its `elsewhere`. A boss felled stays
  gone. The map shows what she walked. A learned node is learned again and paid for again.

`design_game` starts it from Galaxy Boy's rail, the variant `vampire-sonata-castle` ("The rail" below).

## The words

```js
{ premise, box: [cols, rows], shape?: 'spiral' | 'serpentine' | 'hub', turn: 'ccw' | 'cw',   // turn: a spiral's
  powers: { <id>: { opens: <gate>, name } },
  rings: [ { id, place, finds?, boss?, key?, inward, pockets?: [{ gate, holds }] }, …,   // the regions in walk order
           { id, place, boss? } ] }                                                    // the core
```

Read and refused with teaching, laid by [box.js](../control/lib/graph/gameworld/metroidvania/box.js). A ring takes a cell
off every side of the box and needs three each way, so a box holds as many rings as its depth allows. The core is what is
left in the middle.

## Vampire Sonata

The template ([vampire-sonata.js](../control/lib/graph/gameworld/metroidvania/vampire-sonata.js)): storm the castle. It is
a homage to the idiom, and nothing is taken but its principles. A hunter crosses the drawbridge on the castle's left. The
outer wall is walked round: its key opens the top's locked door, and the Gate Warden gives the second leap. The step into
the great halls is a double-jump sill. The ram strike waits in the halls' relic room, and their step in is a cracked
wall. The Bellkeeper of the inner ward gives the mist veil, and the step into the keep is a grate. The Lord of the Keep
holds the throne.

## What holds it

The laws ([laws.js](../control/lib/graph/gameworld/metroidvania/laws.js), `BOX_LAWS`) are measured on the laid box, its
solution ([solve.js](../control/lib/graph/gameworld/metroidvania/solve.js): the box walked through every door its holdings
open, picking up what each room holds, again while anything new is held) and its greybox. They advise; none refuses:
entered from the left, the box filled, the walk keeping its shape to the core (a spiral turning one way inward, a
serpentine never dropping a row, a hub's every wing walked out from it and back), both axes travelled within its shape's
band, every step in gated and asking something new, every gate's opener found before it, the box finished with no one-way trap, shortcuts
out and a short way back, every power opening something behind it, every pocket opened, no rise past a jump but a
double-jump gate's, every double-jump sill clear of a stand that brings it in one jump, the climbs crossing their
screens with nothing over a head, save rooms close together, a boss at the core.

The eyes gate is the operator's: the greybox read as a drawing, and later the box played.

## Played

A world's level `levels.<id>.metroidvania` (the box's words) is one stage, built as the geocube's `show: 'metroidvania'`
([scene.js](../control/lib/graph/gameworld/metroidvania/scene.js)) and laid for the world's hero by
[level.js](../control/lib/graph/gameworld/metroidvania/level.js). It plays on the side map's runtime:

- **The box is built for the hero.** Its screens come from the hero's stature, and its ledges and sills from the jump
  the hero's feel measures (`feel/reach.js`), so the laws, the greybox and the play agree.
- **The hero is close.** A box's frame is the side map's with the hero a fifth larger in it, 0.15 of the frame's height
  against the run and gun's eighth (`rooms.js` `BOX_FRAME`). A cell is a screen, so the whole box is laid smaller round
  her, and a room is a little tighter on its hero.
- **The hero is drawn as mojulo draws its anime heroes.** She keeps her row's own look and light (the anime head's
  drawn face, its toon light), never the cel bands and ink of the run and gun whose feel she borrows.
- **A room is a camera zone.** The side map's camera (`worlds/controllable/sidemap.js`) holds each room in the order the
  spiral walks them. A corridor holds its height, a shaft holds its side, and a turn and a hall are framed whole. A drop
  through a floor hands the frame to the room below.
- **A stair's ledges are stood on, never walked into.** They have no collider, so they are jumped up through from below.
- **The gates are the world's breakables, held shut by the held gates**
  ([held-gates.js](../control/lib/graph/worlds/controllable/held-gates.js)). A gate holds until what opens it is held:
  - A grate, a lock and a seal break as the hero reaches them.
  - A cracked wall stands every blow until the special strike is held, then the hero's own blows cut it down.
  - A boss's seal breaks as its boss falls.
  - What is gone is no longer ground, so an opened hatch is fallen through.
  - The double-jump sill is never a gate that opens. It is a closed part the second jump clears.
- **What is picked up gives what it gives.** A relic room's power, a ring's key and a pocket's prize are taken as the
  hero reaches them. The double jump gives its move (`TRAVERSAL_MOVES`). The page names each as it is taken.
- **The bosses are stand-ins until the foes join.** Each is a tall block struck down by the hero's blows. Its fall gives
  what the boss gives and breaks its seal.
- **A double-jump sill holds.** Its room keeps its stair and its drops on the far side from it, and the law `sill-holds`
  measures that nothing to stand on brings it within one jump.

## The hunt: an action RPG's vitals

The castle is played as an action RPG, never a run and gun: there are no lives.

- **Her vitals are health and MP.** Health is on her body (`metroidvania/level.js` `BOX_VITALS`), struck down by what she
  meets. MP is her moveset's own pool, the arsenal's (`combat-melee.js` `mp`). It never refills on its own.
- **A save room fills her.** Walked into, it refills both and is where she wakes from then on
  ([held-gates.js](../control/lib/graph/worlds/controllable/held-gates.js) `saves`). The gate room is where she wakes
  before she has stood in any. The box's law `saves` already keeps them close together.
- **Her death is a waking.** Her health spent, she wakes in the last save room she stood in, full, keeping everything she
  holds: her powers, her keys, the gates opened and the bosses felled. Nothing is reloaded and nothing is taken back.
- **The page shows her vitals** as an HP bar and an MP bar at the top left. "Saved" and a waking are said across the
  top as a pickup is.

## Erina

Vampire Sonata's hero, a monster hunter ([vampire-sonata.js](../control/lib/graph/gameworld/metroidvania/vampire-sonata.js)
`ERINA`). She is a grown woman in the traditional anime register: the anime head's grown woman's face (`z-fighter`) on
the strong grown heroine's body (`mizuki`), with long dark hair in a side tail and a hunter's coat in the castle's
crimson. In her right hand is a hunter's longsword: the equipment shelf's `hunter` card, a heroic blade of polished silver
under a winged guard and a ring pommel of blackened steel, with no gem and nothing lit. She is minted through the
character door (`erinaHero()`).

She fights with Zero Boy's saber string, the galaxy-boy feel's `saber` variant: three cuts on the fire press, in place,
and a cut in the air. The castle's feel (`VAMPIRE_SONATA_FEEL`) takes away what the castle never asks of her: the wall
slide and the wall kick (`cling: null`), and a dash off a wall. Her card has no stomp and no buster. Her sword is steel,
not the saber's light: the feel's `blade: { steel: true }` draws no strand of light over the blade, and her cut's slash is
cold steel (`feel/saber.js` `STEEL_SLASH`). `vampireSonataGame()`
is the designed game's words: her feel, her book and the castle as its one level.

## Foes

The castle is haunted by the game's own bestiary ([cast.js](../control/lib/graph/gameworld/metroidvania/cast.js) and
[foes.js](../control/lib/graph/gameworld/foes.js), the foe shelf), not a second foe system. Each foe is a class at a
rank on a skin, stood on the lane's rail with its class's mind.

- **Who:** a region names who haunts it (a ring's `foes`), else the level's `foes.from`. A corridor's and a hall's foes
  are its region's walkers. A shaft gets one flyer in its middle storey, or, in a region with none to fly, one walker at
  its foot.
- **How many:** a foe every `FOE_EVERY` metres of floor in the first region, rising to twice that by the last (`RISE`,
  measured by the walk's depth whatever the number of regions).
- **Where:** spread along the floor, never within `CLEAR` metres of a doorway nor over a hole, `APART` from each other,
  facing the way in.
- **None in** the gate room, a save room, a map room, a boss's room (its boss alone: [Bosses](#bosses)) or the throne:
  where she rests, reads, or fights the one she came for.
- **Until their figures are made,** they stand as greybox blocks of their size in their class's shade (`STAND_IN`).
- **A fall gives souls** by rank. The game's trees take `souls: { minion, elite, per }`: a point for every `per` souls,
  so the fight fills the same purse the bosses and prizes do.

Erina's castle fields rats and crows on the outer wall, ghouls in the halls, wolves in the ward, and undead armour in
the keep (an elite).

The cast's laws (`CAST_LAWS`, `foes:<id>`):
- `quiet-rooms`: none where she rests or reads.
- `stand-clear`: none at a doorway or over a hole.
- `on-their-feet`: a shaft's foes fly (or one walks at its foot); a corridor's walk.
- `rising`: each region's threat a screen (an elite counts `THREAT` minions) is never below `EASE` of the mean of the
  regions before it in its box.
- `between-saves`: no more foes between two save rooms than `SURVIVE` times the hits her health takes.

## Bosses

Each boss a box names (a ring's `boss`, a connector's keeper) is read from the castle's boss shelf
([bosses.js](../control/lib/graph/gameworld/metroidvania/bosses.js)) by its name, its words lower-cased and hyphened (`the
Gate Warden` reads as `gate-warden`). A row is a foe class at the boss's rank on a skin, its `tier` (how many times the
hero's height it stands), its `blows` (its health in the hero's blows) and what it reads as in a line. A boss the shelf
does not know stands as the default row and the `known` law says so. A new boss is a row.

Once the level's foes have joined (the stage's foe cast and the level's `foes`), the box is laid `bosses: 'stood'`. The
stand-in block is left off, and the level stands the boss through the foe shelf (`standFoe`, as the side map stands its
robots) where its room says: toward the room's far side from the way in, facing it, on its room's own stretch of the lane
(`span`, short of the walls by `CLEAR_WALL`), so it never follows her out. Its fall is felled by the held gates
(`entity`): its seal breaks, its power is given, and its tokens and points are hers, as the block's were. Its health is
the castle's bar across the bottom, its name over it, shown while she stands in its room and it stands; never a bar over
its head. Until its figure is made, it stands as a block of its tier's height in its class's shade.

Its room shuts behind her. Once she is `IN` metres inside it, clear of its openings, and its boss stands, the held gates
lay a bar across each doorway and a grate over each hole in its floor and ceiling (the box's `shut` for the boss, walls
while the fight lasts; the page drops a portcullis across each). They lift as the boss falls. A fight lost (her health
spent in it) opens the room as she wakes at her save, and the boss is back where it first stood, whole: the fight from
its start when she comes back.

Erina's castle: the Gate Warden (a dead halberdier, a guard), the Bellkeeper and the Bell Ringer (lobbers throwing their
bells), the Great Bell (a turret tolling rounds across the spire), the Warden (a quick devil, a stalker), the Crypt Lord
(a great wolf that waits and springs), the Gatekeeper (a horned guard) and the Lord of the Keep (a pursuer). In the
castle of boxes four more rooms have their own: the CARRION ABBESS in the belfry (a crow TENGU: the avian kin beaked, in a mountain monk's
whites, a red sash, a fan of black feathers at her arm and the monk's ringed staff, black wings that beat as she strikes: she fights from the air, her `volley` of black quills thrown down into the
floor one after another, her dives and her drop), the SIEGE OGRE in the lower keep (an ONI: the orc kin red-skinned, ivory horns grown off its brow by the xeno
make-up (`xenoHeaddress`, a horn pair: an oni mask fits a person's head alone), a loincloth of ochre and black, a spiked
iron club: it
rolls the broken wall's `boulder` the length of the room, a thing that ROLLS, the shelf's `roll` shape, harming only
where it is as it passes, so a jump clears it), the ARMIGER in the armoury (an empty suit of gilded plate under the `wingedTVisor`, a dark T-visor
where a face would be and a wing swept back off each ear (the helm's `earWings`): its `lances` burst out of the floor under marks spreading from her feet, one after another) and
the SERPENT COUNTESS in the upper keep (the serpentine kin, a crimson coil for legs (its `Coil`), under the anime
head with a gold circlet, a black `corset` laced up her back with skulls down the lacing, the topmost horned: her tail swept fast
along the floor round her, `coil`, jumped, and her `venom`, a pool that burns where she spat it a while). A boss stands
on its room's floor between its moves (a room's barbican-tall climb of ledges is no ground for a body as tall as their
spacing); one whose moves fly, a first form or a second, flies in its sky.

Its FIGHT is the boss director's ([boss/](../control/lib/graph/boss/), [boss.js](../control/lib/graph/worlds/controllable/boss.js)),
the same that runs a human boss anywhere: each castle row carries `moves` (each a pattern from the shelf in the boss's own
words) and `phases` (from full health and at each threshold under it, the moves it reaches for and how often, quicker as it
falls). Each move is told before it lands (its mark), lands, and leaves an opening. Between its moves it fights as its
class does. It takes no move while she is out of its room (`rule.boss.room`): every other boss of the castle keeps to its
own.

Seen from the side, she leaves a hazard only along the lane or over it. So the shelf has the side view's patterns, each
saying how high it reaches where a jump is the escape (`rise`): `quake` (a front rolling along the floor both ways,
knee high), `cleave` (a swing at full height in front: back out of reach), `toss` (a weight thrown where she stood),
`toll` (a wave rolling across the room, waist high) and `lunge` (a low spring down the lane, carrying the boss). The
director misses a body whose feet are over a hazard's rise, a rise measured from the boss's own floor. The pattern laws
measure a body on a lane (`lane: true`: it leaves a cell only along the aim's line) and a fifth escape, `over`: a jump
whose feet stay over the rise for all the time the hazard stays on that cell, from the body's jump apex and gravity (her
feel's measured reach). On the page each hazard is drawn upright along the lane, as high as it reaches: its mark the
stretch it will cross, faint and filling, with a bright edge at the height to clear; while it lands, the stretch it is on
now, bright.

Its ATTACKS have looks ([boss/looks.js](../control/lib/graph/boss/looks.js), a row a pattern, in the gothic anime
register: a white-hot core into the boss's own colours, gold tells and crimson blows), drawn over the read every attack
already has (the upright band, kept faint under a look). A look is told, then lands: the cleave a glint on the blade,
then a crimson crescent swept down through its reach with a white-hot edge and sparks; the quake gold cracks branching
out from under it, then walls of dust rolling out both ways as high as the front reaches, chips thrown ahead; the toll
the air shimmering in rings round the boss, then a wall of ripples; the toss the thing thrown coming down on its mark (a
weight, a cracked bell, a swarm of bats: the move's own `look`), then a star and dust; the lunge a glow at its feet,
then speed streaks and afterimages along the low stretch.

Its FIGURE is its own ([bosses.js](../control/lib/graph/gameworld/metroidvania/bosses.js) `CASTLE_FIGURES`): the
character door's words for each humanoid (the Gate Warden a death knight with a halberd; the Gatekeeper crimson plate
under a horned skull helm with a brutal greatsword; the Bell Ringer a dead monk in a brown habit; the Bellkeeper a
grave-grey robe in a bell's outline; the Warden a horned, tailed, clawed devil in a crimson robe and black cloak; the
Lord of the Keep a pale, silver-haired vampire noble in the anime register, as Erina is: a woman, androgynous, the slim
female body squared at the shoulder and straightened at the hip, a sharp, cool face, the hair swept back short), the animal door's for the Crypt
Lord (a wolf grown `dire` and `shadow`). The runner makes each one a box names (`boss-<id>`) and the level stands it on
its ref, a door's body grown by its tier, a beast fitted to its tier's height. The Great Bell no door makes: it is a card
of its own ([bell.js](../control/lib/graph/gameworld/metroidvania/bell.js)), built on the page as a rig (a figures-map
`bell: { card }`, as a worker bot is): bronze gone green at its waist and gilded at its lip, on a timber yoke hung from
chains, the bell on its axle and the clapper on its own bone, its moves its swings.

Their dress is the castle's: capes and grim things, never mega pauldrons (they take a side view's whole room). The
knights wear their plate `without: ['pauldron']` (the armour build's word: the plate pieces left off) and a SHROUD over it,
an outfit card of the outfit's own pieces alone (no top, no bottom: the armour's): the Gate Warden a black cloak to the
ankle lined in dried blood, its hem TORN into tongues (a cloak's `torn`, the cape garment's `torn: { depth, count }`),
RAGS of grave-cloth hung off its plate at the hips and the shoulders (the outfit's `rags` piece: ribbons draped over what
they hang on, each its own length and torn end), a standing collar, a chain and a skull trophy at its hip; the Gatekeeper
a torn cloak to the calf, rust-red rags, bone charms and trophies. The bell ringers carry bells and chains on their habits; the Lord of the Keep wears her
coat without its fur mantle, a high collar and a cloak to the floor lined in crimson, lightly torn at its hem. Their outline is the plain `wedge`:
the `knight` silhouette lays garment pauldrons over the armour's own.

Its BODY tells the move too: each person boss's figure is minted with a wind-up and a strike for each pattern its moves
use (`boss/looks.js` `ATTACK_POSES`, in the rig's pose words, its weapon in its right hand: the cleave's blade drawn back
over its shoulder then swept down; the quake's hands raised high then driven into the floor; the toss's arm drawn back
low then flung out; the toll's arms spread wide and the head thrown back, then thrust ahead; the lunge sunk low on bent
knees, then sprung out flat). The page plays `wind_<pattern>` through the tell, held wound at its landing, and
`strike_<pattern>` through the blow, then eases back to its stand (`__bossWind`, emitted only where a director's boss
stands). A boss may name the clip and the stretch of it each pattern plays (`rule.boss.wind`): the great wolf is minted
with its species' STRIKE (a crouch, head down, then a spring) and winds up on its first part and springs on the rest, its
howl on its FLINCH (dropped low, the head thrown up). The bell's swings are its card's own clips, by the same names.

A boss may have a SECOND FORM (a row's `second`: its title, tier, blows, moves and phases, and its figure's words beside
the first's). It is stood in two MODES (`body.modes`, worlds/controllable/vanish.js): cut down, the first does not fall
but reels and rises as the second, its own figure (warm on the page: `rule.boss.figures`), its own health (the castle's
bar names it and fills again), its own director's rule (its moves and phases, its looks, the same room) and its own size
(its collider and its hit egg: a mode's `body`); only the second falls, and only then is its seal broken. A fight lost
against it puts it back into its first form, whole. A form of another size says its height (a mode's `body.fit`): the
page stands its figure at that height by its own bounds and builds it at its own scale (a row's `over`: its figure's
height over its body's, a winged form's wings raised over its head). The Lord of the Keep's is THE LORD UNBOUND, a
DRAGON ON TWO LEGS at 2.5 times Erina's height: the draconic kin at its least human (digitigrade legs, a dragon's head,
horns, a thick spined tail, long claws, a deep hunch), WINGS of crimson skin on bone swept back along it (the outfit's
`wings`: a membrane in level slices off the back, an arm up its leading edge, two fingers across it; `sweep` toward 1 lays
them along the body, so a side view sees them whole), gold at its throat, shoulders and arms, skulls at its hips, the
shreds of her cape at its shoulders. On a person's skeleton, it winds up as the castle's people do: it rears with its
wings flung wide, drops low with them folded back, beats them into bats, throws its horned head back. Its WINGS BEAT as
it attacks: each wing is on a bone of its own riding the trunk, turned by its channel (`wingR`, `wingL`: the piece's own
clip words, outfit-plan.js `OUTFIT_CHANNELS`, − raised high and forward, + beaten down and back), and its wind-ups are
minted flapping (`boss/looks.js` `windClips(patterns, { wings })`: rest, then the wound body as the wings beat up, down, up,
down and settle at the move's wound, `WING_BEATS`; six keys on the bake's twelve samples, and the strike beats them to its
struck), the page playing the six through the tell (`rule.boss.wind`, `flapWind`). And it TAKES TO THE AIR: its
`sky-rake` beats up off the floor and hangs over the room, then dives and rakes the floor past Erina (the `swoop`:
jumped), its `wyrm-fall` rises over her and hangs there, its shadow on the floor under her, then drops onto it (the
`dive`: out from under it, then jump the front). It flies in its SKY, the air that keeps its head in the frame
(`FRAME_TOP` of the frame's height over the floor, less its own).

The bosses' laws (`BOSS_LAWS`, `bosses:<id>`):
- `known`: each boss a row of the shelf.
- `fights`: each boss's fight (and its second form's) held to the director's laws for her on the lane, her jump among her escapes: every move
  told, escapable, survivable and opened after; three moves or more, two or more a phase; its phases falling and
  quickening.
- `room-to-fight`: each boss on at least `FIGHT_ROOM` metres of lane.
- `plain-chamber`: each boss fought on a plain chamber's floor: no shaft, nothing to climb in it.
- `rising`: no boss along the walk under `BOSS_EASE` of the hardest before it.

## The explored map

The castle as the hunter has walked it, drawn the way the idiom draws it, a **tile a screen**
([explored.js](../control/lib/graph/gameworld/metroidvania/explored.js)). It is built from the laid box itself (the same
rooms the play runs on, a castle's included), so the map never lies. Each principle is an affordance, something the
map lets the player know without being told:

1. **A screen is a tile.** The map's unit is the screen the camera holds, so a room is its tiles, outlined, its walls on
   the tiles' edges and its doors as gaps in them.
2. **Walked, a tile fills.** A tile is drawn the moment she stands in it, never the whole room ahead of her, in her
   region's colour.
3. **Known is not walked.** A **map room** (a lectern with an open book glowing, the box's `maps: true`: one in each
   region but a core, the first room past its gate holding nothing else) shows its region's tiles as outlines. It says
   where to go, never that she has gone.
4. **You are here.** The tile she stands in is marked, north up, the box as drawn.
5. **Rooms with a purpose.** The map marks save rooms, map rooms and a boss's room (crossed once felled). It also marks
   what is to be picked up: a power, a key, a pocket's prize, each shown while it is there and gone when taken.
6. **The frontier.** A doorway from a walked tile into one not walked is drawn open, a stub into the dark.
7. **Gates remembered.** A gate seen is drawn at its doorway in its own colour. It is shut while what opens it is not
   held, and ringed open-able the moment it is: the power found sends her back, and the map says where.
8. **One way, said.** A drop or a door that goes one way is drawn with its arrow.
9. **How much.** The share of tiles walked is shown for the castle and for each region.

Played, the record is the explored map's builder ([explore.js](../control/lib/graph/worlds/controllable/explore.js)):
the tiles walked and the map rooms found. There is no map over the play: the map is the pause's and the map rooms'. The
page draws it ([explored-view.js](../control/lib/graph/scene/channels/controllable/explored-view.js)):
- **The whole map,** on M, over the held world (and the HUD's pause on Enter).
- **A map room found** is said a moment at the top right.

The map's laws (`MAP_LAWS`, `map:<id>`) are measured on the map drawn at the walk's start and at its end:
- `maps-placed`: a map room in every region but a core.
- `way-on`: from the gate, the map already shows a way on into the dark.
- `sides-agree`: a door is the same door from both its tiles.
- `walked-whole`: walked to its end, every tile is filled, no frontier is left and no gate is shut.

## Her trees

Erina grows as she hunts, by two trees (`VAMPIRE_SONATA_TREES`, the game's `trees`: [trees.md](trees.md)). One purse
serves both, a point for each boss felled and each pocket's prize.

- **The skills (movement):** the second leap's double jump, found with it and the tree's root; a third leap on it; a
  swifter run, the dash carried further, an air dash more.
- **The techs (spells and attacks):**
  - attacks: the hunter's thrust on the heavy, the cleave forked off her string, the rising cut and the plunge from the
    air;
  - spells for MP: the soul burst on the special, and the crescent dash and the blood spiral with the modifier.

The trees hold more than a castle's points buy, so she grows one way or another. T opens them as one screen.

## The castle

A box's words may name a THEME ([themes.js](../control/lib/graph/gameworld/metroidvania/themes.js)): what each ring is
made of and how it is lit, laid over the greybox ring by ring
([dress.js](../control/lib/graph/gameworld/metroidvania/dress.js)). The play stays the greybox's: nothing the theme adds
is a collider. A floor's runner is cut round every hole in it, so a drop is never carpeted over. Unsaid, the box is
greybox. Vampire Sonata names `castle`: the vampire lord's castle, stormed by night.

A ring's look is a KIT: the two pieces its wall alternates bay by bay, what hangs under its ceiling, what stands between
the lane and the wall, its dado, the one piece a room is remembered by, how dark its shadow falls, and its lamp.

| Ring | Bays (A, B) | Ceiling, near, dado | Focal piece | Light |
|---|---|---|---|---|
| the ramparts (open to the night) | merlons against the sky | none | a gargoyle on the parapet | torches |
| the great halls | an arched window, a shelf of books | a vault, columns, a panelled wainscot | the lord's portrait in a gilt frame | sconces of candles |
| the inner ward | an arched window, ivy over cracked stone | beams, hanging chains, a plinth | a broken statue and its rubble | cold ghost-lamps |
| the keep | a banner, a niche and its statue (lancets over both) | a vault, columns, a plinth | the house's arms, crossed blades behind it | braziers below, torches above |

The night over an open ring is laid in bands by height, one colour at one height across every room, so open rooms meet
without a seam. The moon stands in the box's top far corner, placed by its parallax so the camera there sees it. A new
theme is a row of `BOX_THEMES`; a new place is a look.

## Locales

A ring is a region, but a region is not one hall all through. A LOCALE is a look's words laid over its ring's look
for one room, chosen by what the room is ([themes.js](../control/lib/graph/gameworld/metroidvania/themes.js)
`localeOf`, `roomLook`): a save room is a chapel; a ring's `shaft` dresses its shafts, its `boss` its boss's room and
its `alt` every other corridor. The open ring's rooms stay its ramparts. The closed parts keep their ring's stone, laid
in the locale's path and ledge ("The castle's fabric", below).

| Locale | Its wall | Its bays | Its focal piece | What moves |
|---|---|---|---|---|
| the chapel (every save room) | plaster, cracked | lancets of stained glass | a rose window over an altar | the moonbeams, coloured by the glass |
| the library (the halls' shafts) | ashlar | cases under their galleries, bound in calm sets | an orrery under the roof | its worlds, each on its arm |
| the clock tower (the ward's shafts and the Bellkeeper's room) | brick | gears meshed in the wall | the great clock's face | the gears, each the other way from the one it drives, and the clock's hands |
| the catacombs (every other corridor of the ward) | rough rock | niches of skulls, a statue's niche | a sarcophagus, its lord carved on the lid | the candles |
| the throne room (the keep's boss's room) | ashlar in crimson | banners, tall windows | the lord's throne on its dais under a canopy and his crest | the braziers |
| the alchemist's laboratory (every other corridor of the halls) | brick | shelves of glowing potions, a library case | the cauldron on its fire under a hood, an alembic, herbs drying | the cauldron's fire, its brew bubbling |
| the armoury (the keep's other hall) | ashlar | racks of spears and swords, the house's arms | a suit of armour on its stand, a halberd in its hand | the torches |
| the towers (the outer wall's shafts, in turn) | ashlar | banners, the house's arms, arrow-slit lancets | a broken statue | the torches |
| the observatory (the outer wall's shafts, in turn) | brick | charts of the stars on their roundels, arched windows | a brass telescope aimed at a round of night | the cold candles |
| the ballroom (the halls' other corridors, in turn) | plaster | tall mirrors in gilt frames, arched windows | a great chandelier, its candles burning live | the candles |
| the banquet hall (the halls' other corridors, in turn) | brick | a stag's antlers on their shield, banners | a great hearth, its logs burning live, the house's crest over it | the torches |
| the dungeon (the ward's other corridors, in turn) | brick | barred cells, chains hung from the roof, manacles on their rings | an iron gibbet hung on its chain | the torches |

A look may name a LIST of locales for its shafts, its halls or its other corridors (`alt`): each room of that kind takes
the next in turn, counted in its ring's walk, so the great halls' other corridors are the laboratory, the ballroom and
the banquet hall, the ward's the catacombs and the dungeon, and the outer wall's towers alternate with its observatory.

A theme may be a RE-KEY of another (`rekey` in themes.js): the same rings, locales and pieces with its night, each
ring's colours, each locale's colours and its lamps' colour laid over the base's. The castle has two:
`castle-frost` (an ice-blue night under a pale moon, cold stone, lamps gone blue, the keep in sapphire) and
`castle-blood` (a blood moon on a crimson night, the halls in deep reds, every flame hotter). A box's words name one
as their `theme`. The rings-distinct law caught a first frost whose ramparts and halls were too alike.

A back's masonry is a row of `WALLS` (dress.js): ashlar, brick, rock and plaster, each with its blocks, its courses, how
far a stone strays from the next and the joint between them. A piece that turns is its own group (`box:turn:<id>`),
and the page's ambient channel spins it about its hub. Stained glass is lit from behind and keeps its colours. Every
backdrop law holds over the locales.

## The backdrop's craft

In a side view the back wall does the work a dungeon's walls do in 3D. These are the principles a room's back is built
by ([backdrop.js](../control/lib/graph/gameworld/metroidvania/backdrop.js)). Each is measured as a law over the dressed
box (`backdrop:<id>`), and the theme's own laws stand beside them (`theme:rings-distinct`, `theme:gates-read`).

1. **The back is the wall.** A closed room's back is built, never painted flat. It is ashlar laid as stone, never a grid:
   each course has its own height, the same all along its row, and each block has its own length and stone. A plinth or
   a wainscot runs along the floor. Each cell's edge has a pier standing out of the wall: a half-column on its base under
   a capital the vault's ribs spring from, or a chamfered pier. In a vaulted hall, slender shafts flank each bay's piece.
   They spring from carved corbels over her head, so the band she moves in stays calm, and rise to the ribs. There is a
   vault or beams under the ceiling, its ribs moulded, with a string course where a storey meets the one above it and
   cobwebs in its top corners.
2. **Detail by the eye segment.** A screen is `EYE.across` × `EYE.up` eye segments, a glance's worth of wall each.
   Every segment of a closed room holds some detail and not too much (`DETAIL`): no glance finds a bare wall, and none
   finds noise. A piece counts in every segment it covers, so a plinth along a cell is seen in every glance along it.
   Law: `eye-detail`.
3. **Calm behind the play.** The band the hero moves in, the lowest of a storey's, holds less detail than the bands
   above it, so she and what she fights read against it. A hall's wainscot is panelled wide for that reason. Law:
   `calm-play`.
4. **Structure, dressing, story.** The bays are dressed by the wall's rhythm (A and B, never three alike, never a pair
   repeated: `era/wall-rhythm.js`), and each room has ONE focal piece, larger than a bay's, that the room is
   remembered by. Laws: `bay-rhythm`, `focal`.
5. **Three depths.** The near layer between the lane and the wall (a column, a hanging chain), the wall, and something
   seen through it (a window's moonlit glass, a lancet, the night over an open ring). The near layer stands between the
   lane and the light, so it is half a silhouette and never brighter than the lane. Law: `depths`.
6. **Light is pools in the dark.** It is a dark mood: where no lamp reaches, the wall falls to its ring's `dark`. Light
   comes only from sources the eye can see (a sconce, a brazier, a cold lamp, a torch), each a pool that falls off within
   its `reach`. The light is baked at every corner of every face, so it falls off across a block rather than stepping
   block by block. **The light draws the relief:**
   - A face turned toward a lamp takes more of its light and one turned away less (`RELIEF.turn`). So a column is lit
     round on its lamp's side with its far side in shadow, each block is lit domed, and tops and capitals catch the light
     while soffits and corbels sit in shade.
   - What stands out of the wall (a pier, a shaft, a case, its gallery, a statue, a frame, a sill) casts its shadow from
     each lamp (`RELIEF.shadow`), raking across the wall from a sconce on its bracket (`RELIEF.flame` out from the wall).
   - The dark gathers on the wall close round what stands out, and under its ceiling.

   A storey's wall is lit in part (`POOLS.lit`), measured above its dark (the wall's darker tenth, since the corners the
   dark gathers in fall below it). A pool's heart stands well above that dark (`POOLS.contrast`). A tall room is lit on
   every storey. Law: `pools`.
7. **Every flame glows and burns.** A flame is haloed (the page's glow sprites) and burns live on the page's flames
   channel, its painted shape kept as its ember. Dust hangs in the closed rooms, lit only where a lamp is near (the
   page's motes). The cold lamps pulse.
8. **The lane reads.** The tops she stands on are lighter than the wall behind them. Law: `lane-reads`.
9. **A kit, a composition.** A ring's rooms draw on one kit; each room is composed by a seeded hand from its own id
   (`composeRoom`: its bays' order and its focal piece), so neighbours differ and the same recipe makes the same room.
10. **The night and the moon are seen.** Over the open ring the night has stars that twinkle, clouds that drift (banks
   with puffed tops lit on the moon's side, one crossing the moon itself),
   a haloed moon, far mountains and a forest ridge before the towers' feet, each a step darker toward the eye. The
   night's bands meet edge to edge, because the page lifts a lapped face a step toward the eye. Every window's glass
   shows the night (pale on its foot, dark at its head), and a moonbeam falls from it to the floor away from the moon,
   breathing as cloud passes (`NIGHT`, `MOONBEAM`, `MOTION` in dress.js; the general principles:
   [side-scroll-backgrounds.md](side-scroll-backgrounds.md)).
11. **She is the measure.** A wall is read against the body on the lane, so a piece is drawn at its size to hers, never
   at its bay's. What a hand holds or a body uses keeps its true size: a book, a sword, a shield, a candle, a ladder's
   rung, a block of stone. A figure, painted or carved, is life-size to heroic and never colossal. Furniture stands on its
   floor. Only the architecture (a window, a vault, a column, a banner's cloth) is as big as the hall. A tall hall is
   filled with more things at their size, never with the same things blown up: the library is a case twice her height,
   with a cupboard base and boards a book's height apart, under a gallery with a second case on it and a ladder between.
   A focal piece is made by its place, its frame and its light. A statue in a niche stands high in the wall on its
   corbel, and the lord's portrait hangs over her head. Every part's size is noted as it is drawn and held to `SCALE`,
   said for a body of `REF_STATURE` and scaled to hers. Law: `scale`.

## The castle's fabric

The backdrop's craft dresses what is behind the play. The FABRIC builds what the play stands on, runs into and passes
through ([fabric.js](../control/lib/graph/gameworld/metroidvania/fabric.js)): the greybox's floors, ceilings, walls,
ledges and niches, each built as what it is. The play's camera frames one cell, so every screen has a floor along its
foot, a ceiling along its head, a wall at each side and the ledges between: the fabric is seen on every screen, more
than any piece on the back. These are the principles it is built by. Each is measured as a law (`fabric:<id>`), beside
the backdrop's and the theme's.

1. **Every solid is built as its role.** Nothing is left as a grey block. A floor is a path, a ceiling a cornice, a wall
   quoined, a ledge in its material. Law: `built`.
2. **The path reads first.** A floor's top is laid in its room's material (`path`, the rows of `PATHS`): flagstones in
   two rows across the walk, boards along it, a checker of tiles, the rock's own beds. Each stone or board has its own
   length and shade, over the mortar between them. Its front is a lit tread, then a string course (a board floor's beam,
   strapped in iron), then coursed stone. The path is lighter than the slab's face, so the line she walks on is the first
   thing read. Law: `paths-read`.
3. **A slab is an entablature.** A floor and the ceiling under it make one slab between storeys. The ceiling's foot is
   a cornice: a moulding and a corbel table hanging under it. Out under the sky the ceiling is a hoarding instead (the
   timber roof of a covered wall-walk), and at the box's top it is machicolations, the crown's parapet on deep corbels.
4. **A wall is quoined.** Each course is one stone or two, alternately, at her scale. A wall has a plinth at its foot,
   an impost under the ceiling and a string course at every storey it rises through, so a shaft's walls read as a
   tower's.
5. **Openings are made, never cut.** A doorway has a segmental arch in its head (voussoirs, a proud keystone, the
   spandrels filling its corners), a threshold across its foot, and the passage's far reveal seen through it in shadow,
   so a gap in a wall reads as a way through a thick one. The box's entry is made the same. A hole through a floor is
   framed by rim stones either side, with the slab's far reveal seen through the cut. Laws: `doorways-made`,
   `holes-framed`.
6. **Ledges by the room's material.** A stair's ledges are what the room's look names (`ledge`, the rows of `LEDGES`):
   a slab of two stones chamfered underneath; a timber platform of boards on a beam, strapped in iron and hung on two
   rods from what is over it (the rods stand behind the lane, so nothing hangs in front of her); or an iron catwalk,
   grated, its rail riveted, on a truss. The halls and the ward stand on timber, the clock tower and the armoury on iron,
   the ramparts, the keep and the catacombs on stone.
7. **Towers.** A shaft on the box's edge is a tower: an arrow slit in its outer wall each storey, with a sliver of the
   night in it. Law: `towers-slit`.
8. **Weathered outside, clean inside.** Out under the sky, moss grows along the treads and damp streaks down from them.
   Inside, the stone is clean.
9. **The castle stands on something and ends in something.** Along the box's top run a parapet and its merlons, a
   bartizan every third screen and a tower under a conical roof over each top corner. Under the box are a battered plinth
   and a crag of boulders, their tops lit by the moon. The play's frame never shows these: they are the castle's whole
   view (`shots.mjs vampire --whole`). Law: `crowned`.
10. **She is the measure here too.** Every course and block is noted and held to the backdrop's `SCALE`. A quoin's
    course is about half her height, and no stone is a wall's height.

A room's look says its `path` and its `ledge`; a locale's words override its ring's.

| Look | Path | Ledges |
|---|---|---|
| the ramparts | flagstones, mossy | stone |
| the great halls, the inner ward | flagstones | timber |
| the keep | tiles | stone |
| the chapel, the throne room | tiles | the ring's |
| the alchemist's laboratory | tiles | timber |
| the library | boards | timber |
| the clock tower | boards | iron |
| the catacombs | rock | stone |
| the armoury | flagstones | iron |

A new path or ledge is a row of `PATHS` or `LEDGES` and a branch where it is laid. The fabric draws faces only: the
colliders stay the greybox's.

## XenoJager: the planet

The box's other pole. The castle is stormed by a hunter; a dangerous planet is gone down into by an explorer. Its idioms
are the castle's: one box of screens entered from the left, its walk spiralling ring by ring to a core, its gates,
pockets and shortcuts, its climbs (`climbs.js`) and its two-screen towers. Only the visual library is new, so a planet
is a theme (`themes.js` `xeno`) and a set of map words (`xeno-jager.js` `xenoJager()`), never a second map.

| Ring | Look | Bays | Focal | Hazard |
|---|---|---|---|---|
| the crust | open under a ringed planet, a second moon and spires of rock; a crag behind the walk | boulders | a monolith, the lander in the room she enters by (`first`) | |
| the fungal caverns | a cave: stalactites, a stalagmite near the lane, glowing crevices | fungi, tendrils | a bloom | |
| the flooded depths | the same, in blue | waterfalls, crystals | a fossil | water |
| the magma core | the same, in red | lava falls, boulders | a lava fall; the nest | lava |

Its locales are the save `station` (the explorer's beacon), the crust's `chasm` shafts, the `grotto` of crystals, the
`boulderfield`, the sunken `ruins` and the core's `nest`. Its lamps are `glow` pods, breathing. Its water, lava,
glowing life and swaying tendrils move on the page's ambient channel (`MOTION`).

Nothing on the planet is laid in courses. Its rock is broken as rock breaks (`backdrop.js` `rockCells`): boulders of
every shape, each a cell of a jittered grid's point, their corners rounded, the dark of the cracks between them. The
grid is fixed in the box's metres, so a face cut by a room's edge breaks the same on either side. The cave's wall is
built this way. So are the fabric's floors, walls and roofs, and the walk's top, in slabs split across it.

Its boulders and crystals are mojulo's own materials, not drawings:

- **Boulders** are real rocks (`polygonizer/rock-pool.js`): fractured along their minerals' cleavage and grained by
  their modal mix, of the look's `rock` (basalt, slate, marble, granite). A few variants are made once per rock and kept.
  Only the faces turned from the wall are drawn, half as deep as they are wide, so a boulder stands proud of the wall
  and never into the lane. A heap's big boulder carries its fractures' detail; the small ones are the fractured block
  alone.
- **Crystals** are real stones of the look's `gem` (`polygonizer/crystal-faces.js`): each its lattice's own faces, a
  druse grown out of the rock: a few long stones standing up off a wide bed, hardly buried (`CRYSTAL_DRUSE`), since at
  play distance a druse of many small stones reads as a lump. A squat habit, corundum's hexagonal barrel (ruby,
  sapphire), grows more stones and shorter (`SQUAT_DRUSE`), a cluster of barrels rather than a heap of boulders. They
  glow, and the page's crystal channel shades them live, coloured for a path in centimetres as the land's are. Grown
  out of a wall, they throw no print (`print: false`); a print needs a floor under the stone.

A piece drawn in many faces, a boulder or a druse, counts as one piece of detail in the backdrop's laws.

The fabric reads the look's `fabric: 'rock'` and builds each closed part as rock rather than masonry. Floors, walls and
roofs are fractured rock, the roofs hung with drips. Stairs and landings are boulders, and doorways are cave mouths. A
tower's wall is cracked through each storey where a castle's has its slit. Ladders are metal. The crown along the top
is the crust's skyline of crags.

Every law the castle holds, the planet holds (`xeno-jager.test.js`).

**The handle.** There is no XenoJager game yet. `XENOJAGER_HANDLE` says what the next builder wires, each piece marked
`wired: false`:

- **The hero.** An explorer in a sealed suit, her arm a cannon.
- **The feel.** The run and gun's body, keeping its wall cling and kick. A planet's shafts are climbed off their walls;
  the castle refuses that, and the box itself still lays no chimney.
- **The hazards.** The looks' `hazard` is recorded in each room's dress plan (`plan[room].hazard`). Today it is drawn
  and harmless. A suit's power would let her through, with a gate kind for a pool or a lava floor as a new row of
  `gates.js`.

Two parts are already wired. Its HUD wears `nocturne-xeno` by its theme (`hud.js` `BOX_LOOKS`). Its geocube is
`XENOJAGER_CUBE`: a world whose `style.geocube` it is dresses any box level that names no theme as the planet
(`xenoJager({ theme: null })`; "The box on its geocube").
Review it with `node scripts/spikes/backdrops/shots.mjs <dir> vampire --xeno [--whole]`.

## The box on its geocube

A box is drawn in a look, and the look is read in one order (`cube.js` `boxLookOf`):

1. **Its words' `theme`.** As written, drawn exactly as it always was: Vampire Sonata's `castle`.
2. **Its level's geocube's `box`.** A box level's stage carries its level's or its world's `style.geocube`
   (`levels.js`), so a game says one style and its box agrees with it.
3. **Neither:** the greybox.

A geocube's `box` (`era/geocube.js`) is `{ library, tint?, rock? }`. The `library` is a box library of `themes.js`
(the castle's, the planet's): its places, pieces, locales and night, ring by ring. The cube supplies the rest:

- **Colour.** Each ring's colours are tinted toward the cube's by role: back, stone and mortar toward its stone, the
  tops toward its floor, the trim toward its trim, a carpet toward its accent. `tint` moves their hue and saturation
  (0 is the library's own, 0.5 unsaid, 1 the cube's hue). Each colour keeps its own lightness, so the light still pools,
  the walk still reads and the rings still stand apart as the library laid them.
- **Crystals.** Where the cube grows crystals (`outside.crystals`), their gem and glow are every druse's.
- **Rock.** `rock` is what every boulder is.

| Cube | Box |
|---|---|
| `gothic-night` | the castle in its own colours (`tint: 0`): Vampire Sonata's castle, face for face |
| `XENOJAGER_CUBE` (`xeno-jager.js`, a document over the gothic night) | the planet in its own colours |
| `{ from: 'limestone-crags', box: { library: 'castle' } }` | the castle in pale limestone, every law holding |
| any cube without a `box` | the greybox |

Rupa's matter cannot choose the fabric, since it names `stone` for both masonry and natural rock. The library says
which (the castle's masonry, the planet's `fabric: 'rock'`).

## In the book

A box level has its page in its world's gameworld bible (`/bible`, its `#boxes` section, `book.js`). The page is read
off the box as its level builds it: on the level's or the world's geocube, for the side map's hero. The book and the
game therefore never disagree.

- **The plan.** The box's screens, each room in its ring's colour (its look's stone, a locale's own where it has one).
  It shows the closed parts the hero stands on, the ledges and ladders, the doorways and holes cut through, each gate in
  its colour, the pockets, the saves (S), the bosses (B), the keys (K), the powers found (◆) and the way in. The level's
  own page carries the same plan small.
- **A card a ring:** its rooms, its look and colours, its locales, what it is built of (fabric, rock, gem), its hazard,
  its light, its climbs, what it holds and the gate on inward.
- **The powers:** each one, what it opens and where it is found.
- **The laws:** every law the box is held to and what each says. This is the machine gate, measured on the box as
  built; the eyes gate is the person's, who plays it.

The page also says what dresses the box: its words' theme, its geocube, or neither (the greybox).

## The rail

A box game is started from a template, as every game type is (`gameworld/rails.js`). The box games are variants of
Galaxy Boy's rail, which owns the side-on run and gun and the metroidvania genre:

| Variant | Starts from | Its cube |
|---|---|---|
| `vampire-sonata` | the castle: outer wall, great halls, inner ward, keep | `gothic-night` |
| `vampire-sonata-castle` | the castle in maps: the bell tower, the courtyard and the keep, a map each on a megaworld chain | `gothic-night` |
| `xenojager` | the planet: crust, fungal caverns, flooded depths, magma core | XenoJager's (`XENOJAGER_CUBE`) |

`design_game({ name, rail: { from: 'galaxy-boy', variant, locked: true } })` lays the starter (`pitch-start.js`): the
template's game words with its box naming no theme, and the world's `style.geocube` the variant's cube, so the box is
dressed by the cube (`vampireSonataStart`, `xenoJagerStart`). Every key the person wrote wins. The variant's sheet and
the readout's pitch report say the box and its cube (`box: { game, cube, library }`), as does its rail card. Each
variant asks first for the person's box and its cube (the `gameworld-box` card). A sentence finds the variant by its
own words ("a metroidvania castle", "a metroid-like planet"); "a metroidvania" alone is the plain rail.

## How it sounds

A box game is on the sound sheet ([sfx-shelf.md](sfx-shelf.md)) with sounds of its own. Each variant names its own
flavor of recordings (`sound.flavor`), so it never hears the rail's robot. Its menus play its own set (`sound.menus`): the
castle's on the crypt, as its HUD is, and the planet's on the terminal, as its card is.
- **The castle (`VAMPIRE_SONATA_SOUND`).** Erina's longsword cuts the air, cuts into the dead and rings off plate, and her
  boots strike flagstones. A foe felled is unmade, and a boss falls as a great body. Its peoples are heard as their
  classes, never as people: the dead (rattling bones, groans), the ogre's bellow, the demon's snarl. The wolf braces in
  its own threat.
- **The planet (`XENOJAGER_SOUND`).** A sealed suit's arm cannon, its servos and armoured boots, and the planet's
  crystal rock shattering.
- **Bosses.** Every boss on the director is heard by its patterns (`sfx-shelf/boss-sounds.js`): each move's wind-up as
  it is told and its strike as it lands. Its voice is read from what it is (its people, its species, or a row's own
  `voice`: the Carrion Abbess a crow, the Armiger an empty suit's grind, the Serpent Countess a snake). It roars at its
  first move and as each phase turns, is hurt when struck, and dies as its last form falls. A second form rises with a
  surge.
- **The held gates.** The boss's room is shut by a portcullis and winched open when the fight ends. A gate breaks by its
  kind: a cracked wall crumbles, a secret wall falls away into its hollow, a grate scrapes aside, a lock turns, the
  boss's seal shatters.

Where the library is not installed, each new sound plays a stand-in, and a voice class is silent rather than heard as
anything else.

## Not yet

- **The castle's own feel.** Erina plays Galaxy Boy's run and gun with Zero Boy's saber string. A feel of her own would
  give her a back-dash and a heavier cut. The small form's power would make her small and pass grates rather than opening
  them.
- **The castle dressed further:** the gates in the castle's own make (a portcullis, an iron-bound door), the side map's
  relief on the stone, the lamps' pools flickering with their flames (the page's flicker answers a few dying tubes, not a
  castle of candles), bats and lightning over the ramparts, and the foreground: things passing in front of the lane in
  silhouette. In the fabric: a door's leaf standing open in its doorway, stairs drawn as steps where a stair of ledges
  climbs against a wall, and the crown's turrets seen from the play (today only the castle's whole view shows them).
- **The rest of the hunt.** Foes in the rooms, from the side map's foe shelf, giving experience and gold. Levels and
  growth from the world's stats (`gameworld/mechanics.js`). Drops and potions; heart vessels raising her health. Gear and
  one menu (status, equipment, items, the map of rooms visited). Then the merchant and MP spells.
- **The bosses' bodies, further.** A wind-up turned to the camera where a profile hides it (a twist read side on). The
  The halberd's head is small for a boss's weapon.
  The wolf's howl its own (a head thrown back), not a flinch.
  The undead word under the knight's sabatons and
  the cleric's robe (the door refuses both today). The knight's pauldrons, grey and large on a brute. A boss's look
  changed by its phase. The fight's length is the
  shelf's `blows`, not yet measured: a bot that fights as a player does (reads the marks, jumps the low ones, backs out
  of the tall ones, cuts in the openings) would measure it. A boss's look changed by its phase.
- **The castle of boxes under the side-scroll backgrounds' dress.** The dress was built and held to its laws on the one
  box; in a castle of boxes a few rooms break two of its composition laws (`eye-detail`: a glance crowded by a bay's
  bookcases, or a corridor's door end left bare; `calm-play`: a boss room dressed as its boss locale busier behind the
  play than above it). The fix is composing each room under those laws (re-dealing its bays until its glances hold).
- **A bot that plays the whole box.** The proof today plays each gate where it stands.
- **The rail**, once a first box plays.
- **A map found whole** (a castle's map room) and the map kept across a reload. The map walked, revealed a screen at a
  time, is the HUD's ([mana-ui.md](mana-ui.md) "The metroidvania's HUD").
- **The explored map's next affordances:** the player's own pins, a warp room's network drawn on it, a region's map
  bought from a merchant, the map on mana-ui (its `map` component drawing tiles and doors), and the gate-ringing said as a
  toast when a power is found ("the map shows where").
- **Dressed** by the side map's paint, cake and vista, a place a ring.
- **Segments, further.** Foes come back on a segment entered again, as rooms refill in the idiom. The pause map does not
  yet mark which segment she is in, and a segment cannot yet be entered at a save room. A castle's
  connector cannot yet be its own segment (a long bridge a map of its own).
- **More of the castle's joins.** Ports on a box's top and bottom, so a castle climbs and descends as well as runs
  rightward. A hub with more than one way out, joining more than two boxes. Connectors that climb: a stair, a lift.
- **A courtyard dressed as one.** The castle's courtyard stands open to the sky, but its shafts are only ledges against
  the night: it wants flagstones, a well, its walls round it.
