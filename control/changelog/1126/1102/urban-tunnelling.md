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
- **Glass and steel, as a mall builds them** (after `polygonizer/floorplan-mall.js`): a podium's lobby and concourse are
  now composed on the bay axes (`compose`: the clean construction, its terrazzo or poured floor and coffered ceiling, in
  the everyday palette's warm whites, lit and dressed as an everyday room; no props, no hazard band). A shopfront is the
  mall's glazed front: a translucent display pane (the page's glass pass) half a metre out from its lit display and
  shelves, a steel frame of real members (a dark kick plinth, a brushed head rail, slim mullions, end jambs), a deeper
  sign bulkhead in its shop's colour, dark steel returns; a body is held off it, and a bay a walk passes is left as
  wall. The walls between the fronts, and the lobby's round its door and its stair, are clad in large-format pale stone
  panels with steel reveals, a steel skirting and a steel band. A laylight runs down each concourse's middle (lit glass
  in a steel frame of edge beams and ribs), the stair's well in the lobby is behind glass under a steel cap, and a glass
  canopy on a steel frame, tied back to the facade, stands over each street door (in the sun, with the street). A
  passage is clad in back-painted glass panels between steel battens over a stainless kick band, a brushed steel frieze
  to its ceiling, a steel handrail each side following its floor, and a lit glass strip in a steel edge down its
  ceiling in place of its lamps.
- **The food court seated, and the concourses fitted** (`geocity/court-kit.js`): the furniture is turned where a hand or a
  hip meets it. The food court seats a mix of sets by its dice (`SETS`): round cafe tables on a pedestal with four chairs
  whose curved backs turn to them on slim steel legs, high round bistro tables with three tall round stools, long
  communal tables with rounded ends and a bench down each side, and booths (a table between two upholstered benches with
  high backs), in one upholstery and one table top a court. Every concourse is fitted (`FITTINGS`): a waste and a
  recycling bin side by side (round, coloured lids) beside each way out and at the court's corners, a lit wayfinding
  directory (its route's colour in a band) by the stair's foot, and slatted backless benches down its long middle between
  round steel planters of shrubs. Each set and fitting is a box the walk is held out of, laid where it stands clear of
  every walk, the shopfronts, the court and the stair. A shopfront now keeps 1.7 m from a way out's frame, room for its
  bins. The readout carries each concourse's fittings and the court's sets.
- **A network of passages, its own module** (`lib/graph/network/`): what the geocity's tunnels were, made general, the
  geocity its first client. `sections.js`: what a passage is, by what it carries, a row each (`passage`, the pedestrian
  passage under a downtown in glass and steel; `service`, a building's service tunnel in concrete with its conduits,
  edge lines and caged lamps, steeper; `vehicle`, a two-lane road tunnel with a raised walkway behind a kerb each side,
  a tiled band down each wall and its lamp lines, deep and gentle, no stair), each its box, its cover under open ground
  and its slab under a plaza or a floor, its grade, whether a stair may take it down, its lamps, its longest run and its
  finish; `readSection` takes a row or a row changed (`{ from, …changes }`). `edges.js`: which nodes a network joins and
  by what path: straight across a gap where two rooms overlap along it, a DOG-LEG where their sites face each other but
  their rooms do not (out of each to the gap's middle line and along it, the jog a section wide), never a run down a
  street to a site round a corner, never under another site. `passage.js`: one passage built to its section along a
  path of legs square to the axes, turning at square junctions held level (its floor the slope-limited envelope under
  its cover, levelled through each turn and limited again), its finish carried round each junction's outer walls.
  `laws.js` (reached, cover, grade, run, by a prefix and a noun), `walk-gate.js` (moved from the geocity). On the
  lakeshore neighbourhood every concourse is now reached: four passages, one a 62.6 m dog-leg with two turns.
- **A basement under any building of the core shape, and a building as a network's node** (`era/program-core.js`
  `basement`, `network/building.js`): `program: { …, basement: true }` (an office, a clinic, a lab, a warehouse, every one
  of a base's) lays a storey under the ground one, every storey above lifted one: the ground plate's twin room for room
  (a concourse under the lobby, the core's stair `core-0` climbing to `core-1`, a corridor under each corridor, a store
  under each wing room, an undercroft under an annex), so every ground room stands over one. `_program.under.ports` names
  the basement's walls that face out (none with a basement room against it: a double-loaded wing's front rooms flank the
  lobby): the concourse's, each corridor's far end, an annex's undercroft where its annex has ways out. Absent, a
  building is laid as it was. `buildingFit` sets such a building into a site (its front door at a point, facing a way),
  `buildingNode` builds it with its storey 1 at the ground and the network's ways out on its basement's walls, and hands
  back its faces, colliders and lights, each way out in the world, its way down from its door to its concourse and each
  way out's reach (the stage's own routes, which walk a switchback down cleanly). The network's edges now take a node's
  several rooms (`rooms: [{ id, rect, sides }]`, the pair facing each other straight across the gap first, the nearest of
  them), keep clear of a node's own other rooms (`solid`), and narrow a doorway to what a room's wall holds (a single
  door's at least: a basement corridor's end); a section names its `door` (a passage's 3.6 m, a service tunnel's 2 m, a
  vehicle tunnel's 8 m). A bay kit's hazard band is the floor at its doorways: taking it out left a hole (it is now
  repainted as the floor beside it, in the podium too). The walk gate reports where it found no floor (`gaps`). Two
  buildings across a yard are joined from their basements and walked door to door both ways.
