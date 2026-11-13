# Dressing a course: where the eye is, and what is worth making

A course run from behind its hero (`control/lib/graph/gameworld/roll-course.js`) is not looked at evenly. These are
the principles a dress is made by (`course-dress.js`), in the order they are worth getting right. They came from the
operator; the numbers beside them are measured (`course-view.js`), on the roll room's own camera and the rail runner's
hero.

## The order of prominence

1. **The back of the figure.** It is on the screen every frame, low and in the middle (from 46 % to 69 % of the way
   down). It is what the player is. Nail it first.
2. **The vanishing point.** The eye rests there, to read what is coming. The way's far end goes to 27 % of the way
   down the screen, the top edge of the middle third. A thing there is small: at the distance a course asks its
   player to see (19 m), a thing as wide as the way is 215 px across on a 1280 px screen. So what is coming must be
   **readable** there by its colour and its outline alone, and **reactable**: seen in time for the difficulty the
   course is laid at. That is the dress's `readable` and `distinct` laws and the course's sight.
3. **The middle third.** Then prominence comes back down the way. A thing is acted on in the screen's middle third, and
   it is the only place it is ever seen large and whole: a thing as wide as the way fills a third of the screen's
   width 5.1 m ahead, 0.42 s before it is met, which is inside the window a jump is pressed in (0.50 to 0.12 s
   before). **The highest fidelity belongs here.** Detail spent anywhere else is not seen.

## The size of a designed piece

So the unit of design in a running game is **a third of the screen, in the middle**. An interesting element is made
at about that size, and judged at that size.

It is also one slot of the course. A thing spends about 1.6 s between a sixth and a half of the screen's width; a
slot of the rail runner's course is 1.7 s long. At any moment one piece is in that band: the eye has one designed
piece to look at, then the next.

## How a course is decorated

- Decorate **one slice** first: one third-of-the-screen piece. Make a complex one, **A**. Then a less complex one,
  **B**.
- Then lay them along the way as **patterns** of A and B, and find the ones that please, as the walls of the dungeons
  and the inner worlds were found. The rule those walls keep is already written (`era/wall-rhythm.js`, the
  `wall-rhythm` law): never a run of three alike, never a pair repeated (ABBA, not AAAA or ABAB), the odd one in the
  middle of three. A course's pieces start from it.
- A piece is rich where it is acted on and plain where it is read. Far off it is its colour and its outline; the
  detail is for the middle third.

## What this asks of the work

- A skin is authored and reviewed at a third of the screen's width, not in a turntable.
- A piece's far read is checked apart from its near read: its outline and colour at the sight distance, its detail at
  the middle third.
- Scenery beside the way follows the same pattern of A and B, slot by slot, and never competes with the vanishing
  point.
