---
{ "id": "veh-steering", "name": "Vehicle steering (column + wheel, a rail-mount part of the veh-* shelf)", "summary": "seeded steering recipes for the vehicle designer: three-spoke, thin-rim horn-ring, or wide truck wheels — the rim is a TRUE closed-loop sweep torus (never an open lathe ring), the raked column and hub are lathes on a tilted axis, hung from the chassis dashRail socket with a left/right-hand-drive position module", "when": "make a steering wheel / steering column / driver controls for a vehicle build", "tier": "recipe", "marks": ["lathe", "sweep"], "phase": "p1" }
---

Veh-steering is a `rail-mount` part (`lite-template/integration/plan-archive/vehicle-designer.plan.md`
V4). The column rakes down-and-back from the rail on a tilted lathe axis;
the rim is a closed-loop `sweep` torus — the shelf's answer to "a ring": an
open near-constant lathe would drop its caps in the scene still, but a
sweep circle stays solid from every angle. Spokes are short sweeps; a
`hornRing` family adds an inner chrome ring.

Local frame: `+y` forward, `+z` up; MOUNT at the origin (the rail point).
The whole assembly is authored offset to the driver side per `position`
(`left` = -x, never randomized). `hardpoints.wheelCenter` records where the
wheel ended up, for cockpit checks.

## Families & Modules

| Family | Rim | Spokes |
|---|---|---|
| `threeSpoke` | standard | 3 |
| `hornRing` | thin + inner ring | 2 |
| `truckWheel` | wide | 4 |

Modules: `rimStyle` (`standard`/`thin`/`wide`), `spokes` (`two`/`three`/
`four`), `position` (`left`/`right`). Rim takes `rubber`, spokes and hub
take `chrome`, column takes `trim`.

```js
resolveVehSteeringRecipe({ family: 'threeSpoke', seed: 'wheel-01' });
resolveVehSteeringRecipe({ family: 'hornRing', overrides: { position: 'right' } }); // RHD
```
