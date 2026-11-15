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
