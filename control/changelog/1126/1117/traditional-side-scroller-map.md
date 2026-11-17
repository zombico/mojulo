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
- **The screen as a measure** beside the hero's reach (`gameworld/side-map/screen.js`): what one screen is in metres for
  a side camera at 16:9, the camera that holds a hero at an eighth of the frame's height with the lane two thirds down
  it (for the toy hero robot's 1.67 m, 22.8 m back and a screen 13.4 m by 23.8 m), and a distance read in screens.
- **Going up, earned.** Climbs in their forms (ledges, a switchback, a chimney with rests, a stair, a ladder, pillars
  over a gap), light at the top of every climb, a backdrop that knows how high the hero is, and the screen from below:
  a climb's frame that rises on its own.
- **The map is a geocube**, the final output: the chain built in a cube's style, its places, matter and surfaces the
  cube's, and its closed parts painted as places (rock, built, machine), never left a plain face.
- **Galaxy Boy's first level** laid as a zone chain from its teaching order, ending in its first power; the mascot
  platformer's strip as it was.
- **The map's laws and its camera**: one screen thick, both walls of a chimney in the frame, rests within three kicks,
  the next place seen before it is reached, the closed parts painted, the boss's colour its own; a side camera that
  holds a zone's locked axis, hands over at a corner and rises with a climb.
- **Falls and ladders.** Falling out of the bottom of the frame costs a life and brings the hero back at its zone's
  checkpoint; a ladder is climbed with the hero's back to the camera.
- **A render benchmark**: a run, a chimney and a boss's room measured on the page by role (the hero's share of the
  frame, the lane's place in it, play and place on opposite hues, recession and sharpness by layer, light from sources
  that are seen).
