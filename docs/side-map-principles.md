# What makes a traditional side-scroller map

A traditional side-scroller's level is a path for the camera, and the play is laid inside it. The level is seen as an
elevation: the along × up plane, walked across, climbed up and dropped down, every part of it the camera sees painted.
It is the sibling of the two maps the house already has. The course map ([course-dress-principles.md](course-dress-principles.md))
is a runner's lane seen from above; the side strip ([side-strip-principles.md](side-strip-principles.md)) is one lane seen
from the side, the land in layers behind it; the brawl's belt ([side-scroll-map-principles.md](side-scroll-map-principles.md))
is a street walked along. This map turns a corner the others never do: up and down are directions of travel.

These principles were read off the run-and-gun side-scrollers of the 16-bit era and their modern remakes, studied as
maps (the whole level laid out, black where the camera never goes) and as frames. Nothing is taken from those games but
the principles and their numbers. Galaxy Boy is the first game made to them; a metroidvania is the same map with its
zones on a grid and its doors gated by powers.

They are laws in the house sense: measured where they can be, and they advise. A map that loses one is still made, and
says which.

**Status.** Built, but for the foreground, things that move beside the way, the boss's fight, the hero's climb seen from
behind and a metroidvania's grid; each section names the module that holds it.

## The map is the camera's path

1. **A level is a chain of zones.** A **run** is one screen thick across its axis and scrolls along it: a corridor
   scrolls sideways under a held height, a shaft scrolls up under a held side. A **room** scrolls both ways. Zones meet
   at **corners**, each a full screen, so the camera turns without showing past the level.
2. **What is never seen is never built.** The level is the area the camera sweeps along its path: the screens it can
   stand on, joined. Outside that there is nothing, not even black. Inside it, the open space is the play's and the
   rest is **closed**: the ground under the way, the mass between two runs, the walls of a shaft.
3. **One screen thick means nothing is hidden.** In a corridor the floor and the ceiling are both always in the frame;
   in a shaft both walls are. A wall kick is never made at a wall the player cannot see.
4. **The axes mean something.** Going across is where a stage develops. Going down is free (a step off a ledge, a
   drop down a chute) or it is a commitment (a chute is one-way). Going up is earned.
5. **The next place shows before it is reached.** At the edge of a zone's last screen, the next zone's place is
   already in the frame: its material, its colour, its ladder, its light. The way on is seen, never guessed.

## The screen

6. **A screen is a measure.** A run's length, a corner, how far ahead the player sees: these are counted in screens,
   as a gap's width is counted in the hero's reach. What a screen is in metres follows from the camera, and the camera
   follows from the hero.
7. **The hero is an eighth of the frame.** The frame is 16:9 and the hero stands about an eighth of its height, so a
   screen is about eight heroes tall and fourteen wide. A hero drawn bigger than that hides the level it is in.
The measures are `control/lib/graph/gameworld/side-map/screen.js`: a screen in metres for a side camera, and the camera
that holds a hero of a given stature at the frame's share, the lane at its place down the frame.

8. **A shaft is narrower than a screen.** At 16:9 a screen is wide: a shaft that wide is several jumps across and is no
   longer a shaft. Its walls are set as far apart as the climb asks, and the closed rock or plant beside them fills the
   frame out to its edges.

## Teaching by stakes

9. **One new thing a zone.** Each zone adds one move or one pressure to what came before: the run, then the drop, then
   the fight on the move, then the wall kick, then the climb that will not wait.
10. **Taught safe, then tested where it costs.** A move is first met where failing costs nothing (a step that only
    lands back on the floor), then where a fall costs a life. The first zones have no pits.
11. **A landing after a test.** After a climb or a fight, a zone that asks nothing: wide, flat, a pickup, a view. A
    landing is where the place is shown off.
12. **The beats a level has.** The first level's teaching order holds (the basics, the first foe, the advanced moves,
    the gauntlet, the boss), and a map adds the beats a strip never had: a **rest**, a **reveal**, a **landing**, a
    **commit**.

## Going up is earned

13. **Climbing has forms.** Each form adds one thing, and a stage climbs them in order of what they ask:

| Form | What it is | What it adds |
|---|---|---|
| a ledge stair | ledges up a face in the open, each no higher than the jump | rising by jumps alone |
| a switchback | floors inside a mass, climbed back and forth | rising by going to and fro, enclosed |
| a chimney | a shaft between two walls, climbed by kicks, with rests | the wall kick, sustained |
| a stair | a short flight of ledges inside | a breather between climbs |
| a ladder | climbed hand over hand | the free way up, or the way back |
| pillars over a gap | tops of unlike heights, a jump apart | the risky crossing before a climb |

14. **A long climb is short climbs and rests.** A ledge or a girder comes every few kicks, on alternating sides, and a
    pickup stands on it. No more than three kicks between rests.
15. **The screen from below.** A climb that will not wait has a frame that rises on its own. What falls out of the
    bottom of the frame is lost. The pressure is the screen itself, not a hazard drawn in it.
16. **Light at the top.** Every climb ends where its top is open: sky, a lit room, the next zone's space. It is in the
    frame before the climb is done. The goal of a climb is a patch of light.
17. **The backdrop knows how high the hero is.** At the foot of a stage the far land is in the frame; as the hero
    climbs it falls out of the picture, until only sky and a low horizon are left.
18. **Climbs lengthen through a stage.** The first is short and safe, the last long and pressed. The boss's room
    repeats the stage's verb: a stage of climbs ends in a tall room.

## Falls and ladders

19. **A fall is a life.** Falling out of the bottom of the frame costs a life, and the hero comes back at its zone's
    checkpoint. A pit is a pit because the frame does not follow the hero down into it.
20. **A checkpoint a zone.** Every zone a fall can end has one, never further back than the zone's start.
21. **A ladder shows the hero's back.** On a ladder the hero turns to face into the place and climbs with its back to
    the camera, for as long as it holds on. Up or down at a ladder takes hold; up off its top steps onto the floor. A
    ladder's foot is on a floor and its top at a floor's lip. It is never the test.

The camera on the zones, the fall out of the frame and the ladder taken from the side are
`control/lib/graph/worlds/controllable/sidemap.js` (the camera rule `side-map`), handed a laid map by
`control/lib/graph/gameworld/side-map/play.js`.

## The closed parts are painted

What a strip never did. A strip dresses its ground a little way under its top and leaves the rest one plain face. On
this map every closed part the camera sees is a place.

22. **A closed part wears its place's fill.** Rock: beds level across the level, joints, pockets and veins, roots near
    the top. Built: courses and a trim at every lip. Machine: panels, pipes and cables running through, a window into
    the works behind. Padded: blocks in a frame. A new fill is a row.
23. **A fill is designed at the size it is seen.** In slices of a screen, A and B by the walls' rule (never three
    alike, never a pair repeated); its edges lit; something toward the middle of a big mass (a recess, a vein, a
    window), so the mass is not a texture.
24. **Things run through the closed parts.** Pipes, cables, roots, a seam of ore carry on from one zone into the next,
    so the material says where the way goes before the way does.

They are painted by `control/lib/graph/gameworld/side-map/paint.js` (the fill, the slices, the middle of a mass, the
edges and breaks, the threads), which also stands an outdoor zone's backdrop at its depth by the height it is at.

25. **Every segment is a slice of cake.** Its icing is its top and its jamb (the cap, the jamb: designed surfaces, never
    one smooth band). Under the icing its layers are its world's material, never bricks everywhere: a plant's
    machinery, a base's plate, a mountain's strata, the snow on a cold land. A new material is a row.
26. **The light is baked into the material.** The map is static and its camera always on one side, so a material's
    finish (its glint, a metal's sheen, the sky in ice) and its texture are baked where they are seen.
27. **Icing can be layered on.** Things stand on the icing that block nothing (none a collider): behind the hero on the
    top's rear, low on its lip, and in the foreground under the feet line, so they parallax against the lane. A bay
    that carries the dress carries them; one that rests stays bare; none stands at a pit's lip.

The cake is `control/lib/graph/gameworld/side-map/cake.js` (the materials), `texture.js` (their tiles) and `doodads.js`
(the icing's things); the light that bakes it is `light.js`.

28. **What shines in a fight lights the map.** The bake is the map's light; a round in flight, a burst going off, a
    muzzle's flash and a charge filling at the hero's chest are laid over it while they last, in their own colours, so
    a shot lights the wall it passes and the top it skims. They are read off the world each frame
    (`control/lib/graph/worlds/controllable/shot-light.js`) and laid by the side map's page
    (`control/lib/graph/scene/channels/controllable/shot-light-view.js`). Their light is spill, not flood: the shot's hue
    on the edges near it, capped, the world kept in its key. What a shot breaks (rupa's matter) or destroys (a dismantle)
    flashes as it comes apart in the round's colour, and its pieces take the light as they fly. Its impact and the
    explosion are drawn in the shot's own light (`blastLook`): a white-hot core, the hue round it, accent rings, sparks.
    Crates stand on the runs for it (`control/lib/graph/gameworld/side-map/crates.js`): in the way, a hand over the
    muzzle so a tap meets them and under the jump so they can be hopped, in the bays that rest.
29. **A shot is drawn as light.** A white-hot core, its hue saturated in the falloff and deeper at its edge, every layer
    additive under a halo in its hue; the ball always at its head, where it hits, and nothing ahead of it (streaks, a
    short tail and sparks trail behind); an accent hue far round the wheel kept thin (rings left at the firing point,
    near arc bright, one more a charge level). Its look
    is data (`control/lib/graph/gameworld/feel/round-look.js`); the benchmark reads it on the page (`measureRound`).
    What it hits is its own: a regular round meets a body with less than it shows, the full charge with a tall capsule
    (its head drawn round and as big as it hits), so a charged shot is the answer to what stands under the line.
30. **The bodies are drawn in cel.** A side scroller's characters keep the character light while they play: each
    piece in its lit tone or its shade tone (metal by its dark and its gloss), stepped by the land's own key, so a body
    turning keeps its light where the world has it. A dark line, never black, runs round each of its segments (the land
    takes none), and its head turns toward the screen, so its face is seen. Under lamps it is lit from the nearest lamp's
    side, and a shot cuts a hard rim in its colour down the edges facing it. Charging, it is lit up by its charge on its fresnel, pulsing, and the charge's energy gathers over its whole body: a
    bloom wrapping it, sparks drawn in onto it and motes circling it, a burst at each level. It is a body's light, never its face's (`BODY_LIGHTS` in
    `control/lib/graph/gameworld/game-bodies.js`; the body, `heroFigure`'s `cel` in
    `control/lib/graph/worlds/world-scene.js`).

## The look

31. **Five layers.** The foreground, below the hero's feet and darkest; the lane; the near place; the far landmark; the
    sky. Each layer back is quieter and nearer the sky's colour, and the lane is the sharpest thing in the frame.
32. **The lane is a thing.** It has a front face, and the face is designed: a bridge's arches, a gantry's lamps, a
    ledge's strata. A gap is the place's own break: a bridge that fell, a shaft cut through.
33. **Play and place are opposite hues.** What the hero stands on, fights and climbs is on one side of the colour wheel
    and the place on the other. A stage picks which way round.
34. **Something moves beside the way**, and light comes from sources that are seen: a lamp, a furnace, a window.
    The light is `control/lib/graph/gameworld/side-map/light.js`: an indoor zone lit by its lamps (each with its falloff
    and bounce), an outdoor zone by the cube's sky and sun, a ledge's shadow, a climb's top lit, baked per corner.
35. **A place a zone, and the turn tells the story.** Each zone is one place in one material (the gate, the tunnel,
    the factory floor, the shaft, the gallery), and their order is the stage's story.
36. **The boss owns its room.** Its colour is used nowhere before it; its room is one screen, its walls the frame's
    edges, and its back wall carries its mark.

    Its path is designed from the top down by `control/lib/graph/gameworld/side-map/path.js`, on the bay grid the back
    wall's pillars and seams stand on: a profile by what the run is and where it leads, a word for each pillar and each
    seam, one step height for the whole run; the `varied` law holds that no run is one smooth floor for more than a
    screen and a quarter. Its top is a CAP in segments on its fill's module (coping, deck plates, cushions, slabs:
    `paint.js` SIDE_CAP), never one smooth band of colour; every wall a hero kicks off is the cap on its side (its JAMB,
    SIDE_JAMB): segments on the same module, chunky notches that never pass the kicking plane, a string course every few
    courses, a bracket under each rest.

The look is dealt over a laid map by `control/lib/graph/gameworld/side-map/dress.js`: the setting a premise names, a
place a zone, the palette, the bays, the peeks, the threads, the marks, the foreshadowing and the backdrop, as data the
build paints from.

The look is measured on the page by `control/lib/graph/gameworld/side-map/benchmark.js` (`node scripts/side-map.mjs
<manifest.json> --bench`): each shot rendered as the page draws it and as a role pass, read by role. The foreground and
things that move are not built yet, and the benchmark says so.

## Who makes it

The studio lays a map from words, for any game whose camera is side-on and whose hero platforms: the map is a level form
of the cosmos cube's **space** (where every level form is keyed), its beats with it, and its look is **reality**'s, as
every level's is: the geocube it is built in (its places, its matter by role, its surfaces) and the fills its closed
parts are painted in. The map is the level's final output: one recipe played as a page and drawn as an elevation.

They are laid by `control/lib/graph/gameworld/side-map/layout.js`: each zone in screens and the hero's reach, what
the camera sees, what the play moves in and what is closed.

It is built as the geocube's `show: 'sidemap'` by `control/lib/graph/gameworld/side-map/scene.js` and drawn as an
elevation by `drawing.js` beside it (`node scripts/side-map.mjs [manifest.json] --shots` writes both for the eyes gate).

The words are `control/lib/graph/gameworld/side-map/zones.js` (a chain of runs and rooms, each with its beat, its climb
or its drop, its place and its fill, read and refused with teaching), keyed as `space.levelForm=side-map` and
`reality.fill` (`side-map/fills.js`, a row a fill).

A game's level is `levels.<id>.sidemap` (`control/lib/graph/gameworld/side-map/level.js`); the run and gun's first is
`side-map/first.js`, and `side-map/bot.js` plays a laid map to its end on the shipped rule, saying what it took.

The hero's body sets the screen. Galaxy Boy's is the toy hero robot's (`proportions: 'herobot'`, about four and a half
heads, adult-limbed): a game body of its own, too real for a mascot's.

## What holds it

The map's laws, measured on its layout: one screen thick, both walls of a shaft in the frame, every gap and ledge made
by the move it teaches (across zones too), rests within three kicks, a rising frame the climb outpaces, light at the
top, the next place seen first, a checkpoint a zone, ladders on floors, stakes that only rise, one new thing a zone, the
closed parts painted, the boss's colour its own, nothing built outside the camera's path, the icing's things blocking
and hiding nothing. They advise; none refuses.
They are `control/lib/graph/gameworld/side-map/laws.js`, read over the layout and, where it is given, its dress.

The eyes gate is the operator's: the map read as a drawing, the level played on its page.

## Not yet

Things that move beside the way (the benchmark says them missing), the boss's fight in
its room, the hero's climb clip seen from behind. After them: a metroidvania (the zones as rooms on a grid, doors gated by powers, the map
shown in the game), and the 3D platformer's courses told the same way.
