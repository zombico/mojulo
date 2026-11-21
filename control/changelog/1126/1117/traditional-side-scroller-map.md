### The traditional side-scroller map: a level as the camera's path, Galaxy Boy's first

Built through its render benchmark: the principles, the strip's seams, Galaxy Boy's game body, the side map from its
words to a game's level its bot plays, and the benchmark that measures its frames. Lit by its lamps and the cube's sky. Not yet: a foreground and things that
move beside the way, the hero under the cast rig, the boss's fight in its room, the hero's climb seen from behind, a metroidvania's rooms on a grid.

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
- **The path, designed from the top down** (`gameworld/side-map/path.js`), considered and never scattered: an across
  run's floor shaped on its own BAY GRID, the one the back wall's pillars and seams stand on (`bayGrid`, the dress lays
  them on it too), so the floor keeps the walls' rhythm. Its PROFILE says what happens at each pillar and at each seam
  and gives the whole run one step HEIGHT, a share of the hero's jump, as a stair's steps are all one rise: a rest's low
  terraces walked up, never jumped (under what the body steps up by itself: nothing asked), the basics rolling up at each seam and down at each pillar, a fight's raised block centred on every seam,
  the dash's runways level between steps at its pillars, a gauntlet's blocks on its seams and steps at its pillars, a
  landing's one rise, a boss's floor one floor; toward a climb its steps go up, toward a drop down, inside the frame the
  camera holds; never at a pit's lip or on a dash's runway. A new law, `varied`: no run (but a landing's and a boss's
  floor) more than a screen and a quarter of one smooth floor; `reach` reads every step up. The bot hops them and still
  plays Galaxy Boy's first level to its end without a fall. Measured on it, a light bug mended: a face lit as the zone
  it is part of, not the first whose camera area holds it (a boss's floor had been lit as the chute before it).
- **The cap** (`paint.js` `SIDE_CAP`): every top a hero stands on is a designed surface, never one smooth band of the
  zone's colour. Its band down the lit edge and the walking surface itself are cut in segments on the fill's own module
  and grid: a built run's coping in half bond with its courses and a pier cap where each back-wall pillar stands, a
  machine's deck plates on its panel grid with their seams and rivets and a hazard band at every pit's lip, a padded
  run's cushions on its block grid, a rock's slabs on one rhythm of lengths, chipped every third joint; each segment a
  tone of the zone's own in a fixed cycle. `painted` holds every top capped; the benchmark's `top-segmented` reads the
  tops' lightness varying on the page.
- **The jamb** (`paint.js` `SIDE_JAMB`, `wallSurfaces`): every wall a hero kicks off or runs into (a shaft's, a chute's,
  a room's: a closed part's face on open space a body tall or more) is the cap turned on its side, so walls and floors
  are one terrain: a band down its edge and its face into the open, the kicking surface itself, cut on the fill's own
  module and grid (built quoins long and short in turn, machine plates with seams and rivets, padded cushions, rock
  slabs on one rhythm) in the cap's tones, joints and lit edge. Chunky: the edge steps in and out on that rhythm, a notch
  the open shows through, never deeper than 0.15 m and never past the plane the hero kicks off (the climb is the
  collider's, untouched); a string course every few courses as a floor has its pier caps; a bracket under each rest in
  the wall's own matter. `painted` holds every wall jambed; the benchmark gives walls a role of their own and reads
  `walls-segmented` on the page.
- **The cake** (`gameworld/side-map/cake.js`, `texture.js`, `doodads.js`): every wall or floor segment is a slice of
  cake. Its icing is the cap and the jamb; under it, its layers are its world's MATERIAL, a row each, never bricks
  everywhere: techno kibble in a plant (a conduit on its brackets, panels with vents or a status light, ribbed machinery),
  bolted plate in a base, the built and padded fills as they were, rock's strata (soil, a band of rubble on one rhythm,
  bedrock on the level's beds, a copper vein in a works), snow on a cold cube's open land or a mountain's heights (a
  snowpack under an icing of snow, a band of ice, rock below). Its strata hang from each slice's own top, so a pit shows
  the same layers either side.
  The material is baked with the light: each its finish (specular, gloss, metal, the share of sky it reflects), the
  side camera's view fixed so a glint and a metal's sheen bake truly, and a procedural texture tile (rock's grain,
  snow's sparkle, brushed metal, stone, cloth) on world uvs, multiplied by the baked light (`textures`, `textureLit`).
  On the icing stand things that block nothing, none a collider, at three depths that parallax against the lane: a
  material's set on its A bays (pipes, vent stacks and crates on a plant's rear; urns and column stubs on a temple's;
  boulders, tufts and pebbles on rock; snow lumps, and icicles hung under snow's lip), and a dark foreground
  silhouette in front (a girder's frame, a stepped hummock, a fallen block, a drift) under the hero's feet line. The
  `doodads` law (none sunk in a closed part or at a pit's lip, the lip's things low, the foreground under the feet line);
  the benchmark reads `reflective` (a metal or snow lane's glints over its flat twin) and, in a run's frame, the
  `foreground` under the feet, which it had said missing. On Galaxy Boy's first level and the volcano stage both hold.
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
- **The closed parts painted** (`gameworld/side-map/paint.js`), what the strip never did: every closed part the camera
  sees drawn as its place's fill, as marks on its face. Rock in beds level across the whole level (one datum: a pit shows
  the same strata either side), joints along them, roots under an outdoor lip; built in courses of running bond with a
  trim under every lip; machine in panels on one grid; padded in framed blocks. Cut along the way in slices a quarter
  screen wide, A and B by the walls' rule, an A slice carrying its fill's motif (a pocket, a niche, a lamp panel, a bolt
  plate); a big mass something toward its middle (a vein of ore, a recessed panel, a window into the works behind, a
  great block); an end toward open space lit, an end at a pit bitten out; the dress's thread (pipes, cables, roots, a
  channel) carried through them from the first zone to the last, under the way, up a shaft's wall, down a chute's. The
  `painted` law now reads the paint: no closed face plain, no zone's slices repeating. The reality facet's fills are built.
- **The backdrop by height** (`paint.js` `backdropOf`): an outdoor zone's hills and range at their depth behind the lane,
  sized for the side map's camera to see them where the frame should and wide enough for anywhere along the zone; at the
  foot both in the frame, higher the hills gone and the range lower, at the top only sky over a low horizon.
- **Galaxy Boy's first level, a side map** (`side-map/first.js`; a world's `levels.<id>.sidemap`, `side-map/level.js`):
  the first level's teaching order seen from the side, with the beats a strip never had: a rest with no pit, the
  basics, the buster's first foes from hatches a screen apart, a cascade, the dash's gaps, a chimney under a rising
  frame, a landing, a gauntlet, a chute and a one-screen boss's room. The platformer's rail writes it for the run and
  gun (`SIDE_MAP_POLES`); Jumping Giuseppe's strip is as it was. A world refuses one with no side camera or beside
  another level form; its level puts the hero on the lane at the first checkpoint under the side map's camera, its
  ladders and solids, its falls counted as lives in the catch zone (the game's own fall box off: a chute goes deeper),
  its goal the far side of the boss's room.
- **The bot** (`side-map/bot.js`), the machine gate's player: a laid map played on the shipped rule as a player who
  knows it would (a jump at each pit's lip, a dash jump for the dash's gaps, the stick let go over a narrow top, a
  chimney kicked up the wall across from its next rest, a ledge jumped to from within reach of it, a ladder held up), and
  what it took said: the time, each fall, each climb's kicks and the least its feet stood over the rising frame. It
  plays Galaxy Boy's first level to its end in about two minutes without a fall, and every climb form under a rising
  frame; played on a level resolved as its page resolves it, on the level's own bus, the goal is reached and no life is
  lost, and a frame that rises five times too fast costs lives.
- **Played, the map was mended**: a run carries no wall face (the wall kick is a climb's: `coursePlan`'s `walls`); a
  shaft's near wall rises from a doorway at its foot, so a chimney has both walls from the floor up; a ledge stair's
  first rest is on the far wall, away from the doorway; a stair's steps leave a standing hero room under the next; a
  switchback's floors are a hero apart with a step under each opening (it was a stack of floors no one could stand
  between); the reach law reads the room over every rest; the camera never lets a drop down a chute outrun its frame.
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
- **The map's camera** (`worlds/controllable/sidemap.js`, the camera rule `side-map`, opt-in): the hero's zone holds
  the frame inside its rectangle, its locked axis fixed and its free axis followed (a run's height held as the hero runs
  it, a shaft's side held as it climbs, a room both ways); the zone is the next one along as soon as the hero is in it,
  so a corner turns toward the way on, eased and never snapped; a zone a door shuts behind (a chute's foot, a boss's
  room) is never left backward; a rising zone's frame climbs on its own at the layout's pace: the screen from below.
  `side-map/play.js` hands a laid map to it: the camera's zones with their checkpoints, the ladders as climbables, the
  level's solids.
- **Falls and ladders.** A hero wholly under the frame's bottom has fallen out: it is taken to limbo, where a catch
  zone stands that the lives mechanic counts a fall in (`side-fall`), and a beat later it is back at its zone's
  checkpoint with the camera cut to it. Under the side map's camera, up or down at a ladder takes hold of it (the lane's
  hero never walks into a ladder's face), the climb owns the body from there, facing into the place with its back to the
  camera, and its top steps it off onto the floor; no shot leaves on a ladder unless the body's rule says so. The hero's
  climb clip, seen from behind, is still to come: on a ladder it plays what it has.
- **The render benchmark** (`side-map/benchmark.js`, `node scripts/side-map.mjs <manifest> --bench`): a run, a climb and
  the boss's room shot on the page as the side map's camera frames its hero, each rendered twice (as the page draws it,
  and as a role pass: every face its role's flat colour, a stand-in where the hero stands), so every pixel of the page
  knows what it shows, and measured by role against the frame's principles: the hero an eighth of the frame's height,
  the top under it two thirds down, play and place on opposite hues, the tops lit, the closed parts painted, the lane's
  layer the sharpest and each layer behind it quieter, a lamp in an indoor run's frame, the boss's mark in its room. A
  contact sheet (`bench.html`: the page beside its role pass, each law's reading) and `bench.json`. Missing and said
  so, never claimed: anything moving beside the way (the foreground under the feet came with the cake, below). On Galaxy Boy's first level and a
  volcano stage every law the map builds holds. Measured, the look was mended: an outdoor zone's hills and range no
  longer stand over the next zone's at one depth (they flickered), and a shaft's climbing rails are a guide behind the
  lane, quieter than it.
- **The light** (`gameworld/side-map/light.js`, the default; `light: 'flat'` keeps the one baked key it was): the map lit
  per corner and baked as the page's vertex colours, so the page draws it as cheaply. Each face's colour is its base. An
  indoor zone is lit by a quiet ambient, the camera's fill on the lane alone (the lane the lit layer, the back a step
  down) and each of the dress's lamps with the house's falloff (`form/room-light.js`) and its bounce, so an A bay glows
  and a B bay falls to its shade; an outdoor zone by the cube's sky and sun (`era/cube-light.js`), the sun from the side
  map's key. A closed face darkens under its own lip and the back wall under a top over it; a climb's top screen takes
  the next zone's light and a chute darkens as it drops; the zones leading to the boss take its colour in their light.
  What gives light (the lamps, the boss's emblem, the far layers) is left as it is. Large faces are cut into cells two
  and a half metres across for a lamp's pool to fall over (the first level about three times the flat build's faces).
  The benchmark measures it: a lamp's falloff on the back, a ledge's shadow, the lane lit a step over the back, a climb's
  frame lighter at its top; on Galaxy Boy's first level and the volcano stage every one holds lit and the flat build
  loses the falloff, the shadow and the climb's light. Not yet: the hero under the cast rig on a side map's page.
- **The shot light** (`worlds/controllable/shot-light.js`, `scene/channels/controllable/shot-light-view.js`): what moves
  lights the baked map live, over its bake: a buster's round in its level's colour, a foe's shot in its own, a burst as
  it goes off, a muzzle's flash, and the hero's charge at its chest growing as it fills. The strongest few near the
  camera each frame, added over the baked colour in the surface's own hue by how it turns to the light, no shadows.
  Only a side map's page carries it.
- **The shot's look** (`gameworld/feel/round-look.js`): a buster's round drawn as the anime register draws a charged
  shot: a white-hot core, its colour saturated in the falloff and deeper at the edge, all of it additive under a halo
  in its hue; the ball always at its head, where it hits, and everything else behind it (streaks along its flight and
  a tail from the ball back, never ahead of it, sparks trailing); at the firing point, rings in an accent hue far round
  the wheel (the cel look's), one more a charge level, their near arc bright, left there growing and fading as the
  round flies on; the full charge's ball round, white-hot and as big as it hits. Its light on the map is
  spill, not flood: its hue on the edges near it, the world kept in its key.
- **A round's hitbox is its own** (`gameworld/feel/lower.js` `BUSTER_HIT`, `worlds/controllable/buster.js`): the tap and
  the first charge meet a body with less than their drawn size; the full charge is a tall capsule, so it catches what
  stands anywhere in its height (a crawler under the line a tap shot sails over) and bursts at the height it met it.
- **What a shot destroys is lit by it** (`worlds/controllable/shot-light.js`, `shot-light-view.js`): a block that breaks
  (rupa's matter, a breakable) and a body destroyed (dismantle, a cleave) flash as they come apart, in the colour of the
  round that burst there, fading like a burst; and the shot light reaches every piece of matter as it comes into the
  scene, so a crate's chunks and a wreck's pieces take its light as they fly. Glows stay as they are.
- **Impacts and explosions in the shot's light** (`gameworld/feel/round-look.js` `blastLook`): on a page with a buster, a
  round's impact, a hitscan hit, a block blown apart (rupa) and a body destroyed (dismantle, a cleave) are drawn as the
  shot is: a white-hot core flashing first and fading fastest, the hue saturated round it and deeper at its edge, a halo,
  shock rings in the accent with their near arc bright, sparks flung out; an impact quick and small, an explosion longer
  with more rings and sparks; each in the colour of the round that did it (a full charge's hit an explosion), drawn in
  front of what it struck. Every other page keeps its effects as they were.
- **Crates** (`gameworld/side-map/crates.js`, the chain's `crates: true`): breakable crates on a side map's runs, the
  buster's other target. Each stands across the lane's middle in a resting bay (the bays with doodads left to them),
  clear of every pit, step, door, ladder and checkpoint, as tall as a hand over the buster's muzzle (so a tap shot meets
  it) and under the hero's jump (so it is hopped or shot apart), with room to stand on it. The scene names its faces and
  anchors it as a crate, the play makes its collider its own, and the level breaks `objects` where its game names no
  degree, so a world's breakability makes each a block that breaks: one shot and it bursts in the round's light, its
  chunks lit as they fly. A law (`crates`) holds them to it; the bot hops them. Galaxy Boy's first level has four.
- **The cel body**: a `cel` body register, a body's light and not its face's, picked by the side scroller's and the run
  and gun's rails: their characters keep the character light while they play (each piece's lit tone and its shade tone,
  metal drawn by its dark and its gloss), stepped by the side map's own light, so the hero and the land agree. A
  dark navy line, never black, runs round each of a cel body's parts (the land takes none: the toon ink's new
  `only: 'bodies'`), so the forms that adorn it read as its segments; and on a side map a body turns its head toward the
  screen, its face seen, most when it stands. The toy hero robot's helm ends its cheek guards at the jaw line instead of
  making a chin of them. Where a zone is lit by lamps, each body is lit from its nearest lamp's side and height (its face
  still toward the camera's side), and a shot or a blast cuts a hard rim in its colour down the edges that face it While
  the hero charges its buster its body, limbs and helm are lit up by the charge (its face never, only edged), all over and on
  their fresnel, brightest at the silhouette, from a white-hot heart at its chest, in the level
  reached's colour, more as the charge fills, pulsing slow and deep (faster once a level is reached), and its energy
  gathers over its whole body: a bloom wrapping it head to foot, sparks drawn in from all round onto it and motes
  circling it, a burst at its middle at each level reached, the charge's light pulsing round it.
- **The side map's foes**: a side map stands its own foes (`levels.<id>.foes` beside a `sidemap`), on its spawners and
  its runs, on the side strip's rail, drawn in cel like its hero. The side scroller's bestiary is the toy hero robot's
  design language carried to animals (the herobot ooze: helmets, ear domes, gems, antennae, ball joints, their faces
  their own, never a person's) and the game's critters (the mascot ooze).
- **A body fit to a height** (`body.fit: { least, from? }`): the world resolver stands it at least that tall by its figure's
  own bounds, its hit egg and collider with it (a beast's skeleton is shorter than its flesh). A rig body drawn at a scale
  of its own now has a cel line as wide as every other body's.
- **The bosses**: robots of the hero's own family whose faces are never a person's. The hero alone keeps the open face;
  a boss's face is its theme (a mask, a visor, a grille, one eye, a screen, a beast's head, an object), it always has
  eyes, and it lights up as the boss winds up an attack.
- **Crucible, the first level's boss**: a robot on Galaxy Boy's own body and suit, broader and a head taller, whose head
  is a crucible of molten metal with two lit eyes. It stands in the last room of Galaxy Boy's first level, in the colour
  that level holds back for its boss, and lobs at where the hero stood. Bringing it down ends the level. Its eyes and its
  metal glow as it winds up a shot and flash as it fires, lighting the room round its face.
- **The terrain's shadows**: a side map's blocks are shaded as a 3D run and gun's stage is: each face bright under its
  icing, with a crisp shadow line beneath it, and falling into shade deeper in the block. Ledges, ceilings, props and
  crates throw hard, crisp shadows onto the back wall and the floors beside them.
- **The drawn relief**: a side map's painted details are drawn with their depth, as a pixel artist shades relief. Panels,
  labels, conduits and the icing are lit along their top and left edges and drop a crisp shadow down and to the right.
  Vents and niches are sunk under a shadowed lip. Brick and stone courses read raised from their mortar.
- **Zero Boy**: a second playable hero for the side scroller, Galaxy Boy's body and suit in red with a yellow ponytail,
  a saber in place of the buster, and a three-hit string that stays in place, lit like the shots and on the buster's
  damage scale. The saber's blade is a strand of the charged shot, its white-hot core and its bloom, and each cut sweeps
  a slash of it. Each cut plants his feet as his body swings into it, one leg forward and one back, holding the split
  from cut to cut while he never leaves his place. A move in any string can now do the same (a move's `plant`).
- **Galaxy Boy's controls and jump**: on a pad, the left face fires (beside the right trigger) and the top face dashes
  (beside the left trigger), from his feel card's `pad`; a card can now lay out a pad's faces of its own. His jump goes
  1.4 times higher (2.24 m), and the side map lays its gaps and ledges by it. His jump is his own: one pose held the
  whole flight, the knee away from the buster drawn up so he is balanced to fire, the legs reaching down only before
  the floor (a card's `jumps`, the poised jump). A side map's hero now plays its own jumps at all (before, the air
  played the run), and a cel-lit hero keeps the jumps its game gives it.
- **Galaxy Boy's dash**: his dash is his own pose, leaning hard into it and streamlined as he is driven along, the knee
  away from the buster driven forward with its foot swept back and pointed, the buster side's foot pushed back on its
  toes, and the arms a pair on a clock face (facing 3 o'clock): the buster arm's elbow down, its forearm aimed at 4
  o'clock with the buster tipped up, the free arm's upper arm straight back and its forearm aimed at 7 o'clock (a card's `jumps.dash`, the poised dash, played over the burst, in the air
  dash too). A ground dash throws a wisp of dust and grit back off his feet; an air dash raises none.
- **A pointed foot**: a free foot can be pointed, its toes turned down about the ankle (the rig's `point<S>`), as a
  dash's streamlined front foot is.
- **Galaxy Boy's shot**: as he fires, his buster arm comes up level along his facing over whatever he is doing (a run,
  a jump, a dash) and eases back down; the shot leaves from the cannon at the end of that arm, not his chest. It is his
  right arm whichever way he faces (the body turns, never a mirror), so facing left the shot leaves from his far side.
  Walking, dashing or jumping, the shot leaves from where that arm is in the move (a dash's lean and sink lower it).
- **Galaxy Boy's arm cannon and hands**: the buster runs flush on from the forearm, straight, its end rounded and a short
  nozzle standing out of it with the bore dark in its face (an armour volume can now end in a dome and a nozzle). The
  hero robot's gloved hands are a little smaller and stand on a longer wrist (a hand can stand further off its wrist).
- **Zero Boy, caught up**: he jumps, dashes (its pose and its dust) and takes the pad's faces as Galaxy Boy does. His
  saber cuts in the air too: a cut at what is ahead while the jump goes on under it, never holding him up. The saber is
  a fifth longer (its light runs past the blade it springs from, its reach and its slash wider) and cuts a fifth harder.
- **On the wall**: jumping up to a wall, the hero faces it; caught on it and sliding down, he turns his back to it and
  faces out, so a shot or a cut goes out from the wall (where the stick moves him in the world's frame, as on a side
  map; a stick read off the facing keeps facing the wall).
- **Vistas behind the play**: a zone whose back should say "somewhere else" opens it into a frame (a parapet up to a
  little over its lowest floor, a header down from its top, its pillars between) and stands a vista beyond: a few
  layers of simple 3D things at their depths (towers with lit windows, chimneys, tanks, gantries, pipes, peaks,
  columns, arches), each further into the air, so the side camera gives them parallax for nothing and crossing into
  a new zone reads as a change of scene. The library (`side-map/vista.js`, a new vista a row): `hall` (machines before
  a lit far wall), `yard` (a works under the sky), `skyline` (a city, lit windows), `peaks`, `colonnade`, and `wall`
  the plain back wall, still right sometimes. A place names its vista (the plant's factory floor a hall, its loading
  dock a yard, its gallery a skyline; the mountain's ledges peaks; the temple's causeway a colonnade), and a zone's
  own `vista` word overrides it. A vista with a far wall is a room, kept to its zone and closed at its ends so the
  next zone's opening never looks into it; one under the sky widens to fill the frame from anywhere along the zone.
  The light pass keeps their hazed colours as they are. Laws (vista.test.js): a place names its vista and a zone's
  word overrides it, `wall` adds nothing, an open back is less wall and the vista stands behind it, a room keeps to its
  zone while a sky vista fills the frame, further back is paler, the same seed the same vista. Seen on the page in
  Galaxy Boy's first map: the factory floor and the assembly line halls, the loading dock's yard, the gallery's lit
  skyline, the gate tunnel's plain wall.
- **Level 0**: the first side map is the intro stage before the boss roster's stages (`Level 0`), its game loop
  tightened. More foes: one on the first run, three where the foes are met, two on the dash run (a spawner over a gap
  now stands on the nearest floor), six over a seven-screen gauntlet, the heavies among them. The base shot hits low
  foes: every buster round reaches down from its muzzle (`rule.buster.low`, the lowered card's `BUSTER_LOW`), so a
  walker at the hero's knee falls to a tap, not to the full charge alone. A foe's shots TRAVEL: on a side map the foe
  cast turns a gun's hitscan line into a slow round from the foe's middle (`side-map/cast.js` FOE_SHOT, 7 m/s, every
  1.6 s) and a lob into a real arc (FOE_LOB), each flying through the other foes and drawn in the shot's look in the
  foe's colour, so it is seen crossing the room and jumped or dashed past (the runtime's rounds take an opt-in
  `noGround` and `passTeam`). HEAVIES: an armoured rhino charger and an armoured bunker turret at the elite rank,
  plated over (`transmetal` on the herobot) and standing taller (`FOE_STATURE_HEAVY`), a dozen taps each. Robots are
  DESTROYED (`ROBOT_WRECK`): a round blows them apart at every joint, their pieces flung in the explosion, a saber's
  cut cleaves them, then they go in smoke; a critter is squashed as before (and a wreck's cloned pieces are lit as
  matter by the shot light, no longer compiled as cel without a cel normal). The boss's room SHUTS behind the hero: a
  step past its doorway the runtime walls it up (a camera zone's `shut`) and a steel shutter with hazard bars drops
  across the way in (`shutter-view.js`). Level 0's boss is BULWARK, a giant worker bot, not one of the roster's
  rivals and not of the hero's family: a WORKBOT, the worker bots' own visual language (`control/lib/graph/workbots/`:
  a few big low-poly primitives, a box, a prism, a dome, a ball, a wheel, a tread's track, in flat toy colours by role
  under a two-tone cel, and a FACE, two lit eyes and a mouth on a light plate turned toward the side camera; a bot as a
  card, a bone a part, stood as a rig figure by a figures-map entry `workbot`; a roster boss's `workbot` its body,
  nothing minted). Bulwark's card is an ENGINE BOT: an engine block for a body (cylinder heads on top, two exhausts
  angled up and back that STEAM on the page, a cooling fan each side), TANK TREADS for legs (a track loop round its road
  wheels and its drive sprocket), clamp arms on pistons, a head rounded by a half sphere each side under a blower's
  scoop, its screen face (two orange eyes, a grille mouth) turned partly toward the camera, in site yellow, about 760
  faces; at twice the hero's height. Its pattern: it ROLLS on its treads toward the hero, facing him, firing a slow round
  low ahead of it every 1.4 s (jumped), crosses its room and turns round at the near side, so the hero who got over it
  has it turn and come again (a roster boss's `roll`: the foe shelf's pace across the room's floor, `bossPlace`'s
  `span`, with the pace's new opt-in `fire`: a pacer that fires its gun at a hero ahead of it; touching it a blow, its
  top a bounce); every five seconds it stops, picks a ROCK up off the floor before it and throws it at the hero in an
  ARC (the pace's opt-in `rock`, foe.js rockStep: its launch at 50 degrees at the speed that lands it where the hero
  stands), dodged, or shot apart in the air (a foe's round marked `shootable` is broken by a buster's round that meets
  it, buster.js, its chunks flung; the page's rock, picked up, thrown and broken, rock-view.js); its health 280, coming
  apart as it falls; it gives no weapon. It is drawn as every body on the map is: a CEL body (`workbotFigure` packs its
  lit and its shade bakes, `colS`, its eyes its signal, `toon`), stepped by the zone's key light and inked. The steam is the page's: puffs from a
  body's `steam` vents (a worker bot's `vent` pipes, `workbotVents`), out along the pipe, rising and thinning
  (`steam-view.js`). Laws: the tap
  meets a knee-high walker (buster.test.js), the foe round travels from the foe's middle and through its own
  (cast.test.js), a boss's room shuts behind the hero and is not left (sidemap.test.js), the giant worker bot's body, shot,
  health, its roll across its room and its steam (boss-cast.test.js), a worker bot's few primitives, its face (two
  eyes, a mouth, toward the camera), its round head and vents, its bones and its words (workbots/index.test.js), a
  pacer that fires shoots what is ahead and holds at what is behind, one with a rock stoops, lifts it and throws it in
  an arc down onto the hero (foe.test.js), a tap breaks a shootable round in the air and leaves one that is not
  (buster.test.js), a worker bot is a cel body, its eyes its signal (workbots/index.test.js); the bot plays level 0 through its foes and brings Bulwark down
  (level.e2e.test.js). Seen on the page: a turret's round crossing the room, the heavies, a walker's wreck, the
  shutter coming down, Bulwark rolling at the hero firing, steaming, turning
  round at the near side and coming back, in the cel light and ink, lifting a rock, throwing it in an arc, the rock
  shot apart in the air.
- **Galaxy Boy in velour green**: his armour a deep plush green, the suit between it (the lighter tone) a matcha, every
  rim of the armour (the cuffs, the lips, the helm's window and V) a light green, the gem red across the wheel; and his
  suit plainer, at ornament 1 (a hero's own `dials` over the herobot style's: no plaques on the chest and belly, no
  thigh rims), so it reads whole at a close-up as at the side map's distance. Law (herobots.test.js): a hero's dials
  reach its armour, and every herobot is three tones light at the edges (rims over suit over armour).
- **Galaxy Boy's face**: the School-Kid Hero head cast's face (soft, to a small pointed chin), its eyes taller and its
  cheeks fuller (a herobot's own `face` words over the cast's), on his own body: the cast's body tune undone ratio by
  ratio (`keepBody`), so his figure and his height in a level are as they were. Law (herobots.test.js): a cast's face
  on the hero's own body, each body ratio undone.
- **Zero Boy in indigo**: Galaxy Boy's roles in a dark indigo armour, a lavender suit and light lavender rims, the gem
  gold across the wheel, the ponytail yellow; his suit plain (ornament 1) and his face Galaxy Boy's (the School-Kid Hero
  cast, its eyes taller and its cheeks fuller, on his own body), so the two heroes are one family at their heights.
- **Galaxy Boy's sound**: a side map now carries the game's sound sheet and score to its page (it dropped them), and the
  rail writes them for a side scroller (`sound: {}`, an electronic `music` direction), so level 0 is heard: an
  electronic score with its fight piece, the stingers, footsteps, a jump and a landing, and the run and gun's own
  voices (the sheet's `run`, a game's `sound.run` over it): the buster's tap, its charged and full rounds and the
  charge's rising hum; a dash, a wall kick, a wall slide, a blow taken; a foe's round, a robot struck, a heavy's armour
  glancing a round off, a wreck, a boss blown apart; Bulwark's rock heaved, thrown, landing and shot apart, the
  shutter coming down, his treads by his speed. A foe is heard while on the screen only. Zero Boy keeps the rest and
  swings his saber with the sheet's blade. The page's run channel (`scene/channels/run-audio.js`) is emitted only on a
  page whose audio has a `run`, so every other page keeps every byte. Laws (sound-sheet.test.js, side-map
  level.test.js): a run and gun hears every event, a hero with no buster the rest, another game none; the game's word
  wins; a level carries the cues and held voices and no gun of its own; a side map carries its game's audio.
- **A worker bot's wreck**: a rig drawn by parts (bones with no tail, Bulwark's) broke the wreck's splitter as the boss
  fell; each such bone is now its own piece, so he flies apart. Law (wreck-channel.test.js).
- **Galaxy Boy's sound, more of it**: the boss has his own piece (the cue sheet asks a side map's boss for one; the level
  changes to it on the bar line once his room has shut, the audio's `boss` beside its `combat`); his exhausts steam out
  loud (a new held row on the shelf, `steam-hiss`, servo's `steam` dial: a hiss chuffing with its pressure, idling as
  he stands, up as he rolls); a foe stomped on is heard; and each foe sounds by what its kind does (the sheet's
  `run.foes`, by class: a robot sparks on as it first comes into the frame, the frog croaks, a hopper springs, a
  charger revs as it braces and slams into what stops it, a flier swells into its dive, a turret fires its own round,
  a heavy turret a cannon; a game's `sound.run.foes` over it). Laws (sound-sheet.test.js, cue-sheet.test.js). The
  run's own sounds rendered as mouth-foley trials (round 11: the buster's ピュン, ビュン and ドギューン, a foe's ポン, a
  robot zapped ビリッ, the wrecks ドカーン and ドッカーン, a rock heaved ググッ, thrown ブン, landing ゴトッ, crumbling ガラガラ,
  the shutter ガシャーン, a stomp ポコッ): trials for the operator's ears, written to no row until they pass.
- **The game is heard**: a level's sound started only on a click on its page, so a game played on the keys in the game
  shell was silent; it now starts on a key and on the shell's word that sound is on (the shell's frame delegates
  autoplay). The light shell's screens have a score: `music.menu` (the cue sheet's title cue, minted as `cue-menu`)
  loops while a screen is up, stops as a level launches and waits under a stinger. Laws (play-shell.test.js,
  game-shell.test.js); the audio fixtures' emit pins re-pinned with a note.
- **The buster sounds like energy**: an arm cannon set on the shelf (`sets/buster.js`: `buster-shot`,
  `buster-charged-shot`, `buster-full-shot`, synthesized: a square sweeping down for the zip, a triangle or a saw for the
  body, the charges driven and warbling over a thump, the full charge a blast with a long falling tail), in the
  register and the baseline; the run's tap and charged rounds play them. The vocal beam trials are withdrawn.
- **The music heard over the fire**: a run and gun's effects sit at half under its score (the sheet's `level`, the
  audio's `sfxLevel`: the cue engine's own master where the scores play on engines of their own; a game's `sound.level`
  over it), and the full charge is held near the other shots' level and no longer dips the music.
- **Galaxy Boy flinches**: a blow taken (a foe's touch, a round) snaps him back for a third of a second, arched, the arms
  swept back, the knees giving (hero-jump.js `flinch`, the card's `jumps.hurt` and `hit.flinch`), the stick, the jump,
  the dash and the tap shot not his until it passes (rules-platform.js `flinch`, opt-in).
- **The boss is fought from his door**: a life lost in the boss's room comes back just before its door, the door open
  and the boss whole where he stood as it shut; walked in, it shuts again. Shut, the door is a wall (a collider while
  it is shut), so the room's walls are both slid down and kicked off.

