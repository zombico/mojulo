### The traditional side-scroller map: a level as the camera's path, Galaxy Boy's first

Partly built: the principles, the strip's seams and Galaxy Boy's game body have landed; the rest is planned, each line
said as its phase lands.

- **The principles, written first** (`docs/side-map-principles.md`): the map as the camera's path, the screen as a
  measure, teaching by stakes, going up earned, falls and ladders, the closed parts painted, the look, and who makes it
  (a level form of the cube's space, its look reality's through the geocube).
- **The side strip's seams, mended.** A rolling trail on a strip rolls and no longer sinks: a drop that would take a
  floor under the strip's ground is taken only as far as it, its gap sized from the hero's reach at that height
  (`course.js` `coursePlan`'s `floor`); every default 2D first level's basic trail ended 1.5 m under the ground, its
  floors lowered to boxes upside down. A course's floor is never lowered to a box whose bottom stands over its top. A
  strip's segments are held to a JOIN law where they meet its ground (`joinLaw`: a drop is free, a step up one the
  running jump makes); the strip's laws gain a `join-in` and a `join-out` a segment.
- **Galaxy Boy's body: the toy hero robot, a game body of its own** (`game-bodies.js` `herobot`, the soul facet's new
  body word): too real for the mascot's chibi. The herobot proportions under the anime form's bare head (a head cast's
  body tune undid them: the door's default, Shonen High, stretched the figure to 4.9 heads; bare it stands about four
  and a half, 1.75 m), on the game body at the current laws. Galaxy Boy's feel and the metroidvania genre read it, and
  the platformer's rail writes it on a Galaxy Boy book (`platformerBody`); Jumping Giuseppe stays a mascot.
- **The toy hero robot dressed from the libraries.** Its helm a headgear card (`heroBotHelm`: a face window, cheek
  guards curled under the jaw, ear domes, a raised V over the brow round a gem), worn in the robot's own armour groups so
  the hero's palette paints it with the suit. Its body armour a fourth armour family beside plate, lamellar and hardsuit:
  **toy** (`armor/toy.js`), moulded volumes whose read is girth contrast (balls on the shoulders, a barrel chest,
  forearms swelling to a flared cuff, boots widening to half-egg soles, a brief, knee caps, a collar, and at ornament 2
  the chest's plaques and the thigh rims), `mass` how far each swells past its limb; its seeded card `herobot`. The
  hand-placed cast's nineteen shells, each now a library piece.
- **The hero collides as tall as it stands.** Every level's hero collided as a 1.7 m person whatever its body. A hero's
  stature is read off its plan alone, no mesh compiled (`layered.js` `heroStature`, the tiered heads), once it is made,
  and each level's hero collides at it; a level ordered without it keeps 1.7 m, a mascot pilot its own capsule.
- **Galaxy Boy shoots: the buster on the runtime.** The run and gun's buster was the action lab's alone (the feel's
  lowering reported its charge lost). A charge of kind `shot` now lowers to the rule's `buster`, played by a new opt-in
  builder (`worlds/controllable/buster.js`): a tap shot on the press, three in flight at most; held, the charge builds
  through anything; let go, the highest level reached fires, on the lab's beat (a level's frames after the press; a frame
  sooner fizzles). Each round flies straight from the chest, swept against the bodies it meets and ended by a wall, its
  damage a share of a hero's blow by level. Fired on J (the pad's right trigger as ever), drawn as glowing pellets in
  the charge's colours, its charge lighting the hero juice's sparks; composed into a page only where a body carries one.
- **The arm cannon** (`cannon: 'R' | 'L'`, the toy family's): one form with the forearm, the forearm's line carried on
  past the wrist over the hand to a muzzle with its lip and the bore dark in its face, on a BONE OF ITS OWN
  (`polygonizer/hero-buster-rig.js`: wrist to knuckles, riding the hand, appended after every other bone at pack time,
  every clip keying it). The hand becomes the cannon while the buster is out: on the page the cannon's bone grows to
  whole and the hand's shrink away (charging, or a shot just fired), and the skinned GLB carries the same swap as
  `buster:out`, an override layer of scale channels. A hero with no cannon keeps its rig, its skin and its export.
- **A level seen as an elevation.** The course map's sibling: a side-scroller's level as the camera's path through the
  along × up plane, a chain of zones (runs one screen thick, rooms that scroll both ways, full-screen corners), built
  only where the camera can see. Across develops, down is free or a commitment, up is earned.
- **Keyed in the cosmos cube**, so the studio can lay one for any game: the side map a level form of space
  (`space.levelForm=side-map`, partial: written and read, not yet laid; priced as the `side-map` package, requiring a
  side camera and the platform rule) and its closed parts' fills reality's (`reality.fill`: none, or rock, built,
  machine, padded, a row each in `side-map/fills.js`; the painting absent). The words a map writes
  (`gameworld/side-map/zones.js`): a chain of runs (across, up, down; a length in screens) and rooms (a size), each with
  what it teaches (the first level's words) or a beat (rest, reveal, landing, commit), an up run's climb (ledges, a
  switchback, a chimney, a stair, a ladder; `rises`: the screen from below), a down run's drop (a cascade, or a chute:
  a commit), its place and fill, its spawners, pillars and ceiling; refused with teaching.
- **The layout** (`gameworld/side-map/layout.js`): a zone chain laid on the along × up plane in screens and the hero's
  reach, each zone from where the walk left the last. An across run is the course for what it teaches at its length
  (its gaps open to the frame's bottom: pits; `pillars` a pit crossed on tops a jump apart; `ceiling` a held one); an
  up run a shaft narrower than a screen, its walls closed out to the frame's edges, climbed as a chimney (rests on
  alternate walls within three kicks, a pickup on each), ledges, a switchback, a stair or a ladder; a down run a
  cascade of steps or a one-way chute shut at its foot; a room its size, a boss's shut behind its door. Each zone says
  what the camera sees (its swept area, one screen thick on its locked axis), what the play moves in and what is
  closed, its checkpoint, and what it could not fit (a run too short for what it teaches is laid as one floor, and
  says so).
- **The dress** (`gameworld/side-map/dress.js`): the design that makes a side map look good, dealt over the layout as
  data the build paints from and the laws read, placing nothing. A premise names its setting (a plant, a mountain, a
  temple, a base; a new setting is a row), and the setting deals a place a zone by its role (an across run, a climb, a
  drop, a room), never the same place twice running, each a material family and a key colour, the places' order the
  story. The closed parts lighter than the dark open space; play and place on opposite hues; the boss's colour unused
  until the zones that lead to its room, growing toward it, its mark across its room's back wall. A run's back wall in
  bays a screen and a quarter wide by the walls' rule, a pillar between, a lamp an A bay, a hatch at each spawner; the
  next place's family and key at a zone's last half screen; the setting's pipes, cables, roots or channels threaded
  from zone to zone; a shaft's railings stepping up its back wall, its top lit, a chute striped; what the stage is about
  shown small, then large, then whole in the boss's room; an outdoor zone's backdrop by the height it stands at; wear one
  dial a place.
- **The screen as a measure** beside the hero's reach (`gameworld/side-map/screen.js`): what one screen is in metres for
  a side camera at 16:9, the camera that holds a hero at an eighth of the frame's height with the lane two thirds down
  it (for the toy hero robot's 1.67 m, 22.8 m back and a screen 13.4 m by 23.8 m), and a distance read in screens.
- **Going up, earned.** Climbs in their forms (ledges, a switchback, a chimney with rests, a stair, a ladder, pillars
  over a gap), light at the top of every climb, a backdrop that knows how high the hero is, and the screen from below:
  a climb's frame that rises on its own.
- **The map is a geocube** (`gameworld/side-map/scene.js`, the geocube's `show: 'sidemap'`): a zone chain laid for the
  hero it names (a feel and a stature, Galaxy Boy's unsaid), dressed in the cube's hue (its stone the place's, play the
  other side of the wheel) and built where the camera sees: the closed parts in their zone's key, every top a lit edge;
  an indoor zone's back wall in its void carrying the dress (pillars and seams, a lamp an A bay, a hatch at each spawner,
  the next place at the edge, a shaft's railings, a chute's stripes, the boss's emblem), an outdoor zone's back the
  cube's sky; shutters, ladders and pickups in the play's colour; lit by the cube's key from behind the camera, framed
  by the side map's camera. A zone's solids are cut where they would stand in another zone's space (a shaft's near wall
  hung into the run before it, a chute's far wall into the room after it), and the `swept` law says so where one does.
- **The map drawn** (`gameworld/side-map/drawing.js`, `scripts/side-map.mjs`): the elevation the studied maps are read
  as, the camera's area on black, read left to right: the zones outlined and numbered with their places, rulers in
  screens, metres and seconds at the run, the bot's line (an arc over a pit, a chimney's kicks counted between its
  rests), checkpoints, doors, ladders, pickups and a rising frame's pace, the dress's cells (bays, pillars, seams, lamps,
  hatches, the next place's band, the boss's emblem), and the laws: each lost one named, or all held. The script writes
  the drawing and, asked, the page seen from the side map's camera at every zone.
- **Galaxy Boy's first level** laid as a zone chain from its teaching order, ending in its first power; the mascot
  platformer's strip as it was.
- **The map's laws** (`gameworld/side-map/laws.js`), advisory, measured on the layout and its dress: a run one screen
  thick across its held axis; a shaft's two walls in the frame; every pit crossed by the move that teaches it and every
  stand up a climb a jump away; no more than three kicks between a chimney's rests, its top counted; a rising frame
  slower than the bot's climb on the shipped rule by a margin; every climb's top opening into the next zone's space and
  lit; no pit in the first zone and climbs that lengthen; a checkpoint in every zone; ladders on floors; the teaching in
  its order and no zone the one before it again; nothing built outside the camera's path and nothing it sees left
  unbuilt but a pit; the boss's room shut behind and marked. The dress's: a place a zone, solid lighter than void, a lit
  edge on every top, play against place, the boss's colour its own and growing, bays by the walls' rule with a pillar or
  a seam in every frame and spawners a screen apart, the next place at the edge, the thread unbroken, every closed part
  named its fill. Laid to them: a cascade's steps go as deep as the frames that see them, a climb's rests are spaced
  evenly with the last on the way out's wall, a pit between pillars is a pit, a room's doorway is open, and a rising
  frame's pace is set from the bot's climb.
- **The map's camera**: a side camera that holds a zone's locked axis, hands over at a corner and rises with a climb.
- **Falls and ladders.** Falling out of the bottom of the frame costs a life and brings the hero back at its zone's
  checkpoint; a ladder is climbed with the hero's back to the camera.
- **A render benchmark**: a run, a chimney and a boss's room measured on the page by role (the hero's share of the
  frame, the lane's place in it, play and place on opposite hues, recession and sharpness by layer, light from sources
  that are seen).
