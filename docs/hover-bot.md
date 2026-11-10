# The hover bot: a world's tester that flies

The hover bot samples a world as a person sees it, without a body's physics. It holds an eye a height over whatever
surface the page draws, flies a path at a speed, and can be teleported to a coordinate to take a shot. The walker, the
avatar walking with its legs, stays the completability audit: whether a level can be finished
(`lib/graph/game/auto-audit-runner.js`). The bot is the default tester for looking and sampling.

The code is [lib/graph/scene/hover-bot.js](../control/lib/graph/scene/hover-bot.js). Its CLI is
[scripts/hover.mjs](../control/scripts/hover.mjs). It drives the capture page's bridge: `ground(x, y, from?)` and
`hover(spec)` in `scene-three.js`, named in `capture-contract.js`.

## What it does

- **Teleport.** `{ at: [x, y] | pos: [x, y, z], height?, heading?, pitch?, look?, vfov?, shot? }`.
  - The eye stands `height` over the ground found under `at` (1.7 m by default), or at `pos` outright.
  - It looks along `heading` (radians, 0 east) and `pitch`, or at `look`.
  - It renders and returns the eye, the ground, and the frame's triangles and draw calls.
  - It takes a shot where asked.
- **Fly.** `{ path, speed, height?, pitch?, render?, shots? }`.
  - The path is resampled every speed × 0.5 s, so the faster the speed, the coarser the samples.
  - The speeds are `crawl` 0.5, `walk` 1.4, `jog` 3.5, `cycle` 6, `drive` 14 and `fly` 40 m/s, or a number.
  - Each sample records the ground under it: its height, its group and which way it faces.
  - Each next ground is cast from a headroom of 3 m over the last one, so a tree's crown or an awning is passed under,
    not stood on.
  - `render: false` only casts, which is fast.
  - `shots: { every }` takes a shot every so many samples.
- **Report.** A flight's report has its length, its samples, and its holes (where nothing is drawn). It also has its
  steps (where the ground jumps more than 0.35 m between samples), its steepest slope, the groups under it, and its
  frame's triangles.

## Running it

From `control/`, run `node scripts/hover.mjs <tour.json> [--out <dir>]`. A tour is a world's recipe (or a written
capture page) and a list of ops:

```json
{ "world": { "kind": "geocube", "cube": "valley-morning", "show": "geotown", "seed": 3 },
  "ops": [
    { "teleport": { "at": [60, 40], "heading": 1.57, "shot": "street" } },
    { "fly": { "path": "route", "speed": "jog", "shots": { "every": 25 } } },
    { "cameras": ["street"] }
  ] }
```

`"route"` is the world's own walk (its dummy's path). `cameras` shoots the page's cameras. The shots and `report.json`
go to the folder.

## What it is not

- It has no physics. It never collides, falls, or tests whether a body fits.
- Repeats drawn only near the camera are cast against only when they are drawn.
- It is a machine tool. Whether the shots look right is the eyes gate's, never claimed by it.
