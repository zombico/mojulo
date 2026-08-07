---
{ "id": "veh-payload", "name": "Vehicle payload module (bed/flatbed/box/tow rig, the rear-mount part of the veh-* shelf)", "summary": "seeded payload recipes for the vehicle designer: open-top pickup bed (a single shell extrude), flatbed deck with headboard, tall cargo box, or tow boom with winch drum — the module that turns one cab+ladder build into the whole truck family, seated on the chassis rearDeck socket", "when": "make a pickup bed / flatbed / box truck / tow truck rig / trailer payload for a vehicle build", "tier": "recipe", "marks": ["extrude", "sweep", "lathe"], "phase": "p1" }
---

Veh-payload (`vehicle-designer.plan.md` V5) is the truck-family economy:
towtruck, flatbed, and box truck are the SAME [[veh-body]] `truckCab` +
[[veh-chassis]] `ladderFrame` wearing a different payload family —
`pickupBed` (one shell extrude, `wallThickness` + open top), `flatbedDeck`,
`boxVan`, `towBoom` (boom sweep + winch drum).

Mount: `rear-mount` → the chassis `rearDeck` socket (the rear axle at deck
height), derived by [[veh-chassis]]'s garage. EVERY chassis has one —
a `towedFrame` + `boxVan` is a cargo trailer, + `pickupBed` a utility
trailer. Geometry spans forward of the mount toward the cab.

```js
resolveVehPayloadRecipe({ family: 'towBoom', palette: 'factorySteel', seed: 'wrecker-01' });
```
