# Dressing a course: where the eye is, and what is worth making

A course run from behind its hero (`control/lib/graph/gameworld/roll-course.js`) is not looked at evenly. These are
the principles a dress is made by (`course-dress.js`), in the order they are worth getting right. They are the
operator's; the numbers beside them are measured (`course-view.js`).

## The screen in thirds

The screen is read in three bands, top to bottom. The vanishing point lies on the line between the first two.

| Band | What it is | Its key |
|---|---|---|
| Top third | **Where stuff comes from.** Above the vanishing point: the far end of the way and what stands over it | **Readability and distinction by the game's intent.** What kind of thing is coming is told here, by colour and outline alone |
| *the vanishing point* | | |
| Middle third | **Where stuff comes to view.** The way, from far off down to where the player must act | **Readability of form.** This is where a thing is made interesting |
| Bottom third | **Where you react to stuff.** The stretch the player acts in, and the hero | **The character.** Just the character |

The eye rests at the vanishing point to get reads of what is coming. What is coming has to be reactable for the
difficulty the course is laid at: that is the course's sight and its fairness audit.

## The order to nail them in

1. **The back of the figure** (the bottom third). It is on the screen every frame. It is what the player is.
2. **The vanishing point** (the top third and its line). What is coming must be read there: the dress's `readable`,
   `distinct`, `quiet` and `told` laws are this band's.
3. **The middle third.** Then prominence comes back down the way. The highest fidelity belongs here: a thing is
   looked at as it comes down this band, and nowhere else is detail seen.

## The size of a designed piece

The unit of design in a running game is **a third of the screen: the middle band**. An interesting element is made at
about that size and judged at that size.

## How a course is decorated

- Decorate **one slice** of that third first. Make a complex one, **A**. Then a less complex one, **B**.
- Then lay them along the way as **patterns** of A and B, and find the ones that please, as the walls of the dungeons
  and the inner worlds were found. The rule those walls keep is written (`era/wall-rhythm.js`, the `wall-rhythm` law):
  never a run of three alike, never a pair repeated (ABBA, not AAAA or ABAB), the odd one in the middle of three. A
  course's pieces start from it.

## The sides

Interest is not only in what is coming down the way. It extends to the sides.

Measured on the course's camera, the way itself takes 22 % of the middle band's area and its two sides take the other
78 %. In the band where a thing is made interesting, most of the room is beside the way. (In the bottom band the way
takes 64 %.)

The sides are also where speed is seen. The way's own centre line does not move across the screen at all. A thing
standing 5 m to one side crosses the screen at 1 % of its width a second when it is 60 m off, 10 % at 15 m, and 29 %
at 6 m, where it leaves by the screen's edge. So the sides carry the sense of going fast, and they carry it most just
as a thing leaves.

What that asks:

- A slice is the way's piece AND its two flanks: A and B are made as whole slices, side to side.
- The sides follow the same pattern of A and B, slot by slot. The two sides need not match each other.
- The sides stay quiet beside the asks: never an ask's hue, never as vivid, never in the way.
- A side thing lower than the camera stays in the middle band. One taller rises over the vanishing point into the top
  band, which is where stuff comes from: keep that height for what tells, and for the skyline.
- Near the hero the sides leave by the edges of the bottom band. That band is the character's: nothing beside it
  there should pull the eye off the figure.

## A course is a long trail, and its lanes are not rails

A course is designed as a long trail, segment after segment. Its lanes are places to be, not things on the ground: a
theme may draw rails there (the rail yard does), or a painted line, or nothing at all. Nothing in the course's rules
depends on how a lane is drawn.

## The course map

A running game's course is drawn in its design book as a **course map** (`control/lib/graph/gameworld/course-map.js`),
a diagram made for these games alone. It is the course seen from straight above and turned on its side, so it runs
from left to right as a line of text does, a few segments a row. Many segments are read one after another, and the
course is seen whole without running it.

- **Along** the page is the way the hero runs; a ruler under each row says metres and, at the hero's top speed,
  seconds. **Up** the page is the hero's left. A metre across is a metre along.
- **A segment** is one slot: the stretch before an ask and the ask at its end, numbered and named at its head.
- **An ask** is drawn in its role's colour, across what it shuts: the whole way for a hurdle or a block, two lanes for
  posts. Its tell is drawn before it.
- **The line** through it is a run: the reaction bot's own, solid on the ground and dashed in the air.
- **The flanks** either side of the way are cells, one a segment a side, lettered A or B by the walls' rule.

The map is also where assets are placed from. A designed slice goes into a cell: the ask, the stretch before it, and
the flank cell on each side. The letters say which kind of slice a cell takes.

One map is one roll of the course; the book shows a few. The roll room serves its course's map at
`bible?book=practice&room=roll&view=map`.

## The camera that frames it

A camera frames a course when the bands fall where they are meant to: the way's far end on the upper line, the place
the player's reaction begins on the lower line, the hero inside the bottom band. `courseCamera` finds that camera
from the course's own numbers, and `viewBands` says, for any camera, where the bands fall and whether it frames.

For the rail runner's hero (12 m/s, its earliest jump 0.5 s before a thing, so the reaction begins 6 m ahead):

| | The practice rooms' usual follow camera | The course's camera |
|---|---|---|
| The vanishing point | 27 % of the way down | 33 %: on the upper line |
| Where the reaction begins (6 m ahead) | 52 % down: in the middle band | 67 %: on the lower line |
| The hero | 46 % to 69 %: across the middle band | 66 % to 93 % (a 1.7 m body; a chibi from 76 %): in the bottom band |
| The bottom band shows | the hero's feet and half a metre of the way | the last 6 m of the way, 0.5 s of it, and the hero |
| The middle band shows | everything, the reaction's place included | the way from 6 m ahead out to its far end |

The course's camera stands 7 m behind the hero and 3.55 m up, pitched down 7.6°. It takes the follow camera's
stand-off off (`standOff: 0`): by default a follow camera's eye is drawn 3 m nearer its look point, which dropped the
hero off the bottom of the frame.

A hero's head stands as high on the screen as the way some metres further on (6.2 m for a body 1.7 m tall, 4 m for a
mascot of 1.1 m). So a course whose reaction begins nearer than that cannot hold a tall hero inside the bottom band,
and a short one fits: a mascot's proportions are the right ones for this camera, not only a look.

On a flat way nothing that stands lower than the camera rises above the vanishing point, so the top third holds only
the sky and the way's far end. Things that tell what is coming from up there (a signal over each lane, a gantry, a
skyline) have to be taller than the camera stands, 3.55 m here.

## What this asks of the work

- A piece is authored and reviewed as it is seen coming down the middle band, not on a turntable.
- Its far read (the top line) is checked apart from its form (the middle band): colour and outline first, then detail.
- Scenery beside the way follows the same pattern of A and B and never competes with the vanishing point.
- The bottom band is kept clear for the character: no decoration there that is not the way itself.
