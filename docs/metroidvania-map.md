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

9. **Every step in is a gate**, and each asks something no step before it asked.
10. **What opens a gate is found before the gate is met** on the walk: a key before its lock, a power before its gate.
    A boss stands in its ring's last corner, and its prize is the ring's power. A ring with no boss keeps its power in
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
  one menu (status, equipment, items, the map of rooms visited). Then the merchant, MP spells and real bosses in place of
  the stand-ins.
- **Foes and real bosses** on the side map's foe shelf and the boss director, in place of the stand-ins. A boss's
  room shut behind her as a side map's is.
- **A bot that plays the whole box.** The proof today plays each gate where it stands.
- **The rail**, once a first box plays; the map shown in the game from the rooms visited.
- **Dressed** by the side map's paint, cake and vista, a place a ring.
- **Several boxes** joined as castle wings round a keep: the megaworld at the next scale. The shapes are its first half
  (the bell tower passes through, the courtyard joins, the keep is the destination); ports on a box's sides and the
  connectors between boxes (a bridge, a gatehouse) are the next.
- **A courtyard open to the sky.** The hub is dressed as its region's look, the halls; a hub's own look would open it.
