### Urban tunnelling: the geocity held, the first step under it

- **The geocity is solid** (`geocity/scene.js`): every mass a walker can reach is held by a box in the payload's
  `colliders` (`{ min, max, of: '<block>:<group>' }`), the analytic hull a game's pilot is blocked by, an engine builds
  as static boxes and the route audit pushes a walk out of. Each mass of a neighbourhood built at block scale (a tower,
  its podium, a slab, a midrise ring, a house under its gable, a shop, a building going up and its crane), each evoked
  lot, and the houses of each composed geotown, which the geocity used to drop, now in the metro's frame (a block
  town's cut to its block, so a front's steps the crop leaves out never stand on the metro's walk). The skyline's
  backdrop and a far town, never walked, carry none. A new law, `walk-clear`: the dummy's route round the seat's block
  and the walk's spawn stand in no box. The readout counts them (`counts.colliders`). The lakeshore test metro carries
  1,214 boxes (111 KB of its 12 MB payload); a segment evocation 337; the skyline none. The page's free walk already
  met the faces and is unchanged: a page without entities does not change by a byte.
- **A podium walked into** (`geocity.under: true | { at: '<block id>' }`, `geocity/podium.js`): in an evocation (a
  neighbourhood, a corridor or a segment: its blocks at a building's detail), a core tower or podium block's podium is
  entered from its plaza. A lobby on storey 1 stands level with the plaza at its door, and a concourse on storey 0 stands
  a storey under it, below grade, down a stair through the lobby's floor. It is the shape of a building set into its slope,
  placed by its lot: storeys stack from 0, so the concourse is storey 0 and the inside is lowered until the lobby meets
  the plaza. It is built on the everyday bay kit (an office's, a shop floor's) and baked in its own lamps, with no window
  (its concourse in the ground, its lobby inside the podium's mass). Its plan is the largest the lot holds inside its
  margin, clear of the towers that rise through the podium, its door as near the front's middle as it can stand.
  - Its facade is cut at the door (`cutFace`: each wall face in the door's plane the strips round the opening, its tile
    at the face's own rate). The ground under its footprint is cut round it (`groundLess`): the pad, and the land's own
    drape under the block, which would otherwise run through the concourse. The podium's box becomes its mass round the
    inside, plus the inside's own walls.
  - The payload carries the inside's lights, a `building` anchor (its door, floor, rise, rooms and `through`, the way in
    at the door, across the lobby, down the stair and along the concourse, each point at its floor), two cameras
    (`lobby`, from the plaza in at the door, and `concourse`, from the stair's foot) and a readout (`geocity.under`: the
    podium, its plan, rise, faces, colliders, lights, findings; or none and why). On a page taking the live sun, its
    faces take no sun share.
  - The machine gate: the way through walked by the page's ground probe over the payload's own faces and boxes, in and
    back out, no step taller than a riser, no wall crossed, no box entered. Refused by name: `under` on a metro drawn as
    massing, a malformed `under`, an `at` that is no evoked tower or podium. A recipe without `under` does not change.
- **The passages under the streets** (`geocity/tunnels.js`): `under: true` now walks into every evoked podium it can (a
  lobby opening on the podium's front, else another side, where the plaza before the door stands within a kerb of the
  podium's floor, so a lobby on a terraced block still meets its plaza), and joins their concourses below grade. A passage
  is laid between two concourses that face each other across one street, overlapping along it by a doorway and its
  frames, with no other block between (`tunnelEdges`); each concourse gets a way out for it in its wall (a stage way's
  new `along`, era/stage.js: the doorway's middle along its side; absent, the side's middle as before, not a byte
  changed). `{ at }` walks into one podium alone, with no passage.
  - A passage (`tunnelOf`) is its own lit box section, 4 m wide and 3 m high, in its concourse's tiles and at its floor's
    light, with lamps along its ceiling and a box down each wall. Its floor is the highest that keeps 1 m of cover under
    the street's land and 0.3 m under each block's plaza over its whole width, climbing no steeper than 1:12 (the
    constraint's envelope, slope-limited both ways); it leaves each concourse level for a landing, and takes a stair
    down where the envelope stands under the concourse's floor at the landing's end. Under its blocks the land's own
    drape is cut along its run; over a podium's footprint every ground face under the lobby's ceiling is cut, and the
    retaining faces between terraces with them (`wallLess`).
  - The network's laws (`networkLaws`): `under-reached` (every concourse from every other), `under-cover` (under the
    streets and the plazas), `under-grade` (the steepest ramp), `under-run` (the longest passage, 120 m). Advice: on the
    lakeshore neighbourhood five podiums, three passages (35 to 52 m, at least 1.03 m under a street and 0.41 m under a
    plaza, one meeting its concourse by a three-step stair), and one podium not reached: its concourse and its
    neighbour's do not overlap along the street between them (a passage with a dog-leg is not laid yet).
  - The payload carries a `tunnel` anchor a passage (its two podiums, its length, its middle walked), each podium's ways
    out (`ports`, each with its `reach` from the stair's foot) and its way `down` from the plaza, a `tunnel` camera, and
    `geocity.under.podia` and `.tunnels`. A podium's walks are planned round its stair's well and flight
    (a quarter-metre grid, pulled straight).
  - The walk gate is its own module (`geocity/walk-gate.js`, `walker`): the page's ground probe over a payload's faces,
    the walls it crosses (and which), the boxes it stands in. Each passage is walked from one podium's plaza, down its
    stair, along the passage, up the next podium's stair and out onto its plaza, and back.
- **The concourses dressed, and the light below grade** (`geocity/dress.js`): every concourse wears shopfronts in bays
  along its walls (a kick plate, lit glass, mullions, a frame and a sign band in its shop's colour, by its dice), never
  across a way out or against its stair. The concourse with the most ways out (the hub) seats a food court: tables and
  their stools, each a box the walk is held out of, on the cells a body's width and more clear of every walk through it,
  its counters' signs warmer. Wayfinding is a colour a route (`ROUTES`): north-south passages one, east-west the other,
  as a stripe down each passage's floor and a sign over each concourse's way out onto it. A passage now takes each
  surface's light from the concourse's own (the mean its corners are baked at, floor, wall and ceiling apart), its tiles
  the ones the concourse lays most at its own level, and lamps every 4.5 m: a passage is narrow, and the page's
  occlusion takes more of its light than of a concourse's. The page draws every face unlit (its corners' light is its
  light), so nothing of the sky reaches below grade; on a page taking the live sun, every face under the city carries a
  sun share of none, so a shadow on the street never reaches it. The payload gains a `food-court` camera and anchor and
  `geocity.under.dress` (the routes' colours, each concourse's shopfronts, the court's tables).
