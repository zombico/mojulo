# Dressing a side strip: what stands behind the lane

A side-scroller's level is drawn as a side strip (`control/lib/graph/era/geocube-side.js`): the course the hero plays,
and the land behind it in layers. These are the principles that land is dressed by. They are lifted from a running
course's dress ([course-dress-principles.md](course-dress-principles.md)), turned on their side: a runner's screen is
read in three bands from top to bottom, a side-scroller's in layers from near to far.

## The layers, and what each is for

| Layer | Where | What it is for |
|---|---|---|
| The lane | the course itself | **The character.** The band the hero runs in is the hero's: nothing behind it pulls the eye off the figure |
| The terrace | the land just behind the lane | **Where a thing is made interesting.** It is the nearest land, seen largest, so the designed pieces stand here |
| The hills | a slope further back, in the air's first veil | **The place.** What kind of land this is, said in a silhouette |
| The range and the sky | far, deep in the air | **Depth.** Quiet shapes that move slowly |

## The designed piece is a slice

The unit of design is one slice of the terrace, a few metres of it. Make a complex one, **A** (a grove: trees of
unlike sizes, the tallest off the middle, a bush, a stone), and a plain one, **B** (open ground, at most one low
bush) that lets A be seen. Lay them along the lane by the walls' rule (`era/wall-rhythm.js`): never three alike,
never a pair repeated. A row of the same tree at the same spacing is a stamp; A and B in that order is a place.

## Quiet behind the hero

- A grove stands at the **back** of the terrace. Only low things (a bush, a stone, tufts) stand at its front, behind
  the hero's feet.
- Nothing that dresses the land is met, and nothing of it stands before the lane.
- Each layer back is taken further into the air, so the land recedes by value and the lane is the clearest thing.

## Speed is read on the nearest land

The lane does not move across the screen; the land behind it does, and the nearest land fastest. Small things close
together on the terrace (tufts) are what say the hero is moving. Big things belong far back, where they pass slowly.

## The camera looks a little down

A side camera is tilted down toward the lane, so what is high and far is out of its frame: a cloud or a peak set at a
landscape's height is never seen. What is meant to be seen in the sky is set low, just over the hills.

## Where the lane goes

One thing on the land is in the cube's accent: a small tower past the lane's end. It is the only made thing behind
the lane, and it marks the end.

## One family of shapes

A geocube describes a place to walk round in. A side-scroller never shows that: it shows a stack of flat silhouettes,
so what it needs is a rule for those silhouettes. A strip may be drawn in a **shape family** (`SHAPE_FAMILIES`), named
by its cube (`SIDE_SHAPES`) or by the strip itself (`side.shapes`): every silhouette on the screen is the same kind of
shape, which is what makes it one place.

- **Scoops**: every shape a dome or a circle. Scooped hills in three rows, round crowns, puffed clouds, a domed tower,
  and turf that hangs over a floor's edge in scallops. The sherbet orchard's.
- **A scale ladder.** Each row of hills is about 1.6 times the one in front of it, so far things are big and slow and
  near things small and quick.
- **A value ladder.** Each row back is a step further into the air, so the lane is always the clearest thing.
- **Flat, facing the camera.** A silhouette is a shape, not a solid: no facets, no shading across it.
- **A level camera.** A shaped strip is framed nearly level and a little over the hero (`SHAPED_CAMERA`), so the sky
  and the far rows are in the frame.

A cube with no family is drawn as it was. A new family is a row and its shapes.

## The light, as shapes

A shaped strip has no renderer to light it: every shape is flat. So the seventh generation's lighting principles
(`control/lib/graph/era/eras.js`: one live key over indirect light, shadows where things meet, air between near and
far) are turned into silhouettes of their own.

- **One key every shape agrees on.** The light comes from up the lane and above. Each dome wears a lit cap toward it,
  each crown its light on that side. A shape lit from its own direction breaks the place.
- **Air has a colour.** A far row goes toward the sky's own colour, not toward white, so distance is told by hue and
  the land keeps its chroma. Mist pools at a row's foot.
- **Contact.** A thing on the ground lays a soft shadow down the lane from the light. The turf's lip shades the dirt
  under its scallops.
- **An edge catches the light.** A floor's top edge is a thin lit line, so a platform reads against what is behind it.
- **The frame is graded.** A mascot platformer is saturated (`grade: 'vivid'`, the rail's word).

## The stair, the air and the motion

The general principles are in [side-scroll-backgrounds.md](side-scroll-backgrounds.md). In a scooped strip:

- **The rows stand in a stair.** Each nearer row's crests stand under the farther row's in the frame, so every row
  shows its own edge and the sky keeps a quarter to a third of the picture.
- **A far row is quieter.** Its lit cap fades with its distance, never brighter than a near row's.
- **The terrace is a step into the air,** so the lane is the clearest land on the screen and never one field with it.
- **The clouds sit on a shaded underside and drift.** The blossom stirs, each crown after the one beside it (the
  page's ambient channel).

## Sceneries

A scooped strip's land behind the lane may be one of several SCENERIES (`SCENERIES` in `era/geocube-side.js`), laid
segment by segment along the lane: a strip's `side.scenery` (one, or a list taken in turn by its segments), which a
level writes as its `style.scenery`. Each is the same family of shapes under the same light, and another place.

| Scenery | What stands behind the terrace | What moves |
|---|---|---|
| orchard | the domed hills in three rows, groves of blossom | the clouds, the blossom |
| lake | the far hills over a lake in bands, deep near and pale far, the hills' reflection at its far shore | light glinting on the water, a sailing boat drifting |
| forest | a forest's edge: a far canopy in mint, a near one in blossom; the groves thicker | the canopy swaying |
| coast | the sea to the horizon, islands on it; the terrace a beach of sand | light on the waves |
| dunes (a re-key) | the three rows in warm sand, a beach, cacti for groves | the clouds |
| snowfield (a re-key) | the three rows under snow, the terrace snow, the groves' crowns frosted | the clouds, the frosted crowns |

A RE-KEY (`SCENE_KEYS`) is a scenery with no drawing of its own: the same rows and pieces with its land (`sand`,
`snow`), its terrace's turf and its groves (`blossom`, `cactus`, `frost`) named.

Where the scenery changes a HEADLAND stands on each row, a cape passed and never a seam, and a forest thins toward its
ends. Jumping Giuseppe's first level runs through all four, a trail each (`PLATFORMER_SCENERY`). A new scenery is a row
and its drawing.

## What holds it

`sideLaws` measures these on a built strip: `rhythm` (the slices keep the walls' rule), `behind` (the dress stands
behind the lane), `quiet` (a grove at the terrace's back, low things at its front), `one-family` (a shaped strip's hills and
clouds are all its family's shapes), `one-light` (its lit caps, shadows, lip shade and edge light are there), beside the strip's own (`skinned`,
`foreground`, `budget`). They advise; none refuses.

## Not yet

A premise per cube (what this place is, and why someone runs through it), slices as cards a cube names, a made thing
in the hills seen from the first step, more families (steps, pennants), and the family carried into the round: a 3D
course's floors are boxes, so its turf does not hang in scallops there.
