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
