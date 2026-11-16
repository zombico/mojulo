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

## What holds it

`sideLaws` measures these on a built strip: `rhythm` (the slices keep the walls' rule), `behind` (the dress stands
behind the lane), `quiet` (a grove at the terrace's back, low things at its front), beside the strip's own (`skinned`,
`foreground`, `budget`). They advise; none refuses.

## Not yet

A premise per cube (what this place is, and why someone runs through it), slices as cards a cube names, a made thing
in the hills seen from the first step, and the land's own grass (the 3D levels' blades) on the terrace.
