---
{ "id": "veh-body", "name": "Vehicle body shell (the display-mode workhorse of the veh-* shelf)", "summary": "seeded body-shell recipes for the vehicle designer: 3-box sedans and coupes, 2-box wagons, 1-box panel vans, and truck cabs — convex clip extrudes below the beltline, chamfer-cornered fender bands over the wheel arches, a glass greenhouse prism, roof cap, and chrome bumpers; superposes over a matching-wheelbase chassis", "when": "make a car body / sedan shell / coupe / wagon / van body / truck cab / display-mode car exterior", "tier": "recipe", "marks": ["extrude"], "phase": "p1" }
---

Veh-body is the display-mode workhorse (`vehicle-designer.plan.md` V5).
Type-by-box-count lives here as families: `sedanThree`, `coupeThree`,
`wagonTwo`, `vanOne`, `truckCab` (cab has NO tail — [[veh-payload]]
completes the truck), plus the MODERN register: `fastbackEV` and
`crossoverTwo`. Modules: `boxCount` (incl. `fastback` — one long rear rake
flowing almost to the tail), `wheelbase` (must match the chassis),
`roofline`, `bumpers` (`body` = the modern grammar: raked pentagon nose,
body-color fascias front/rear instead of chrome, lamp hardpoints moved onto
the fascia face — pair with the `glacierMono` palette and a [[veh-lights]]
`barSingle` for the EV light-bar look), `glasshouse` (`panel` paints the
greenhouse — a panel van).

**Shelf rule (probe-proven): every extrude profile stays CONVEX.** A
concave silhouette renders its arch walls but drops its end-cap faces —
the transparent-side failure. Arches are therefore openings between convex
clips, topped by a chamfer-cornered fender band (bottom edge z=2.2, above
the 2.0 tire top). The beltline (z=2.95) clears a dressed engine (≈2.9).

Placement: the shell has NO mountFamily — it SUPERPOSES at `[0,0,0]` over a
chassis of the same `wheelbase` module, arch centers at ±wheelbase/2.
Hardpoints `headlightMount` / `taillightMount` place [[veh-lights]] (tail
pair takes `flip:'y'`).

```js
resolveVehBodyRecipe({ family: 'sedanThree', palette: 'vintageCream', seed: 'shell-01' });
```
