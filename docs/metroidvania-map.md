# The metroidvania map: the spiralling box

A traditional side-scroller's level is a chain of camera zones, laid one after another
([side-map-principles.md](side-map-principles.md)): it is walked once, forward, to a boss. A metroidvania's map is the
same elevation joined into itself. Its rooms sit side by side on a grid of screens, its doors lead back as well as on,
and its gates hold until the hero carries what opens them. The map is the progression.

This page is the house's principle for laying one: **the economical use of spiralling space**. It is the megaworld's
mandala ([megaworld.js](../control/lib/graph/gameworld/megaworld.js): rings deeper inward to a gated core) and the
walled-core dungeon's layers ([walled-core-dungeon.md](walled-core-dungeon.md)) folded into one continuous 2D map.

**Status.** Greybox. The box is laid, built in metres, solved, held to its laws and drawn. It is not yet played, dressed
or a rail; see "Not yet".

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
floor, ceiling and walls; its doors cut through them, a doorway in a wall or a hole through a floor; ledges that zigzag
up to every door a room is left by upward, none over the head of the one below; each gate's block in its door; each
pocket's alcove. Drops are holes set aside of the line a climb comes up, so a fall down a shaft does not drop through
them.

It is drawn as an elevation ([drawing.js](../control/lib/graph/gameworld/metroidvania/drawing.js)): each ring's voids in
its shade, the walk numbered room by room, the gates in their colours and shapes, the shortcuts dashed, saves, bosses,
powers and pockets marked, and the laws under it.

```bash
node scripts/metroidvania.mjs [words.json] [--out dir] [--turn ccw|cw] [--box 12x8]
```

## The words

```js
{ premise, box: [cols, rows], turn: 'ccw' | 'cw',
  powers: { <id>: { opens: <gate>, name } },
  rings: [ { id, place, finds?, boss?, key?, inward, pockets?: [{ gate, holds }] }, …,   // outermost first
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
entered from the left, the box filled, the spiral turning one way inward to the core, both axes travelled, every step in
gated and asking something new, every gate's opener found before it, the box finished with no one-way trap, shortcuts
out and a short way back, every power opening something behind it, every pocket opened, no rise past a jump but a
double-jump gate's, save rooms close together, a boss at the core.

The eyes gate is the operator's: the greybox read as a drawing, and later the box played.

## Not yet

- **Played.** The laid box handed to the side map's runtime: the camera on rooms, doors as openings, and gate blocks
  as colliders that open on what the hero holds.
- **The castle's hero.** A feel of its own (a whip or a blade, a back-dash, no stomp, no wall kick), with the double
  jump, the small form and the strike as powers (`TRAVERSAL_MOVES`). Its reach measured as Galaxy Boy's is, so the
  greybox is laid by the measured jump.
- **The rail**, once a first box plays; the map shown in the game from the rooms visited.
- **Dressed** by the side map's paint, cake and vista, a place a ring.
- **Several boxes** joined as castle wings round a keep: the megaworld at the next scale.
