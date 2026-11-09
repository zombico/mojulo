### The metro's waterfront: its shores reclaimed, a harbourfront of quays, piers, parks, a beach and a marina

- **Reclaimed shores.** The water no longer stops at a wall at the city's edge. A metro now reclaims a strip of new
  ground out into the water along each of its shores (`geocity/waterfront.js`, a new metro setting `waterfront`, true by
  default, `false` none).
  - Its **main shore** (the one its land falls toward) is 170 to 230 m deep, with a **waterfront boulevard** along its
    back. Its arterials run on across the land's edge to the boulevard. The lakeshore expressway now stands over the
    boulevard on piers in its median (as a lake city's expressway stands over its lakeshore boulevard), and the
    boulevard carries two lanes of traffic each way. Along it stands a row of the waterfront's own mid-rises, shops
    facing the water.
  - Its **other shores** are shallower (70 to 110 m): parks, beaches, steps, a marina, a restaurant row.
- **Segments**, each its own way of meeting the water, cut along each shore by the metro's dice (never the same twice
  running):
  - a **quay**: a granite plaza and rows of trees, a terminal pavilion, a long rink (a reflecting pool in summer), a quay
    wall with its coping and mooring bollards, a tour boat moored;
  - a **pier**: the quay's plaza and finger piers out over the water on timber piles, railings down their sides. On each
    a corrugated pier shed, or a restaurant at its head with patios, and boats moored along them;
  - **dining**: restaurant pavilions along the promenade, their patios out front (tables under parasols in their
    colours), planters, a kiosk;
  - a **park**: a lawn under trees, its path, the edge a rock revetment down into the water, a railing;
  - a **beach**: sand from a boardwalk down into the water under pink parasols, loungers in their colours;
  - a **marina**: a clubhouse and its lot of cars, pontoons combed out into the water at the water's own level, a
    gangway down to them, sailboats and motorboats in their slips;
  - **steps**: timber steps down to the water to sit by it, a lawn, its trees and chairs behind.
- **Elevation.** The strip's ground falls from the land's edge to its promenade, a quay's height (1.4 to 2.2 m) over the
  water. Its edges go down to the water by their kind: a quay wall, rocks, sand, timber steps, pontoons at the water's
  level, piers on piles at the promenade's. Where its edge steps from one segment to the next, a wall runs down to the
  water across the step.
- **The promenade** runs along the whole edge: granite, or timber in a park and on the steps. It has lamps and benches
  facing the water, a railing where it drops, and bollards on a quay.
- **The kit** (`waterfrontTemplates`): parasols and loungers (pale, for their tint), patio sets, mooring bollards,
  railings, timber piles, planters, and boats (a sailboat, a motorboat, a tour boat). They are drawn near the camera.
  New finishes for granite, timber decking, the promenade, rock revetment and sand, the last a new material word
  `sand` on the dressed tiles' sand cut, its matter sand.
- **Laws and readout.** A new law, `waterfront`: each shore met end to end, its ways of meeting the water more than
  one. The readout carries `waterfront`: each shore's segments, whether it has the boulevard, and the area reclaimed.
- **Natural shores.** A beach's and a park's edge need not be straight (`shoreAt`, a segment's `shore`, on its own dice
  so the strip's segments are the same whatever their shores). A beach is a crescent bay cut 25 to 60 m into the strip,
  its sand following the water's line down into it, its parasols and loungers inside the curve, its boardwalk straight
  behind. A park is a headland out into the water or a cove into it, its line wavering. Its timber boardwalk and its
  rock revetment follow the curve, and its trees, lamps and benches keep to its side of it. Each is flush with its
  straight depth at its ends, so it meets its neighbours as before. None comes closer than 60 m to the strip's back.
