# What makes a side-scrolling map

A side-scrolling map is a belt: a strip of floor walked along and across, seen from one side by a camera that never
turns. Everything a player learns about the place comes from one picture that slides. These are the principles the
brawl's street was built to, said so a place of any kind (a street, a plant, a base, an office, one of an agent's own)
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

## The ground

14. **The ground may rise along the walk, never across it.** A street that climbs, a flight of steps between two
    screens, a ramp down to a dock: the floor's height changes with how far along the belt a body stands (`rise`), and
    the camera rises with the floor it looks at, so the picture stays side-on and the band's lines stay true. Across
    the belt the floor is level: a blow must share a line, and a line that tilts cannot be read.
15. **A change of level is a change of place.** Put the rise where the map turns a page: between two held screens, or
    on the way in. A fight on a stair is hard to read; a fight on the landing above it is remembered.
16. **What stands beside the walk stands on its own ground.** Buildings step up a climbing street, each on its pad;
    a piece of the dress stands on the floor under its own middle; nothing floats and nothing is buried.

## The turn

17. **A road that turns still scrolls sideways.** The walk is always along the belt and the band always across it. When
    the road turns, what changes is where the walk points on the screen: it runs across it, then heads up it (or down
    it), as the old arcade stages did. The camera swings round the point it looks at (`turn`), so the bodies never
    leave the middle of the frame and the controls never change: along is still along.
18. **A turn is walked round, not snapped.** The swing eases in and out over a stretch of the walk, and never goes so
    far that the walk runs into the screen: past about half a right angle the fight is no longer read from the side.
19. **A turn opens the way on.** Turned down the street, the frame shows what is coming: the next screen's set, the
    boss's corner at the end. Use it where the map wants the player to look ahead; keep the fight's own screens
    nearer square, where the lines across the band read best.

## The drift

20. **The band may leave the straight line.** North or south of it, on a diagonal, and back: the walkway slides across
    the belt as it is walked (`drift`) and the camera, still square to the street, follows it up or down the screen.
    This is the arcade street that runs from the top corner of the screen to the bottom: the road, its kerbs and its
    fronts all lie along the diagonal, smooth, never stepped.
21. **Turn or drift, by what should stay still.** A turn swings the view and keeps the street's geometry; a drift keeps
    the view and moves the street. Use a drift where the map should read as a street that really goes somewhere else
    on the plan, a turn where the same street should open ahead.
22. **The band moves with its ground, or over it.** A street built for the map (a blockout) moves whole with the band:
    road, kerbs and fronts on the same diagonal. A street that already stands (a town's) does not move: there the band
    drifts only over ground that is the street's own, from one walk across the road to the other, and anything that
    would be left standing in it is cleared.

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
