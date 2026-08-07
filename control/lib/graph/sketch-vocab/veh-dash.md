---
{ "id": "veh-dash", "name": "Vehicle dashboard (a rail-mount part of the veh-* shelf)", "summary": "seeded dashboard recipes for the vehicle designer: raked slab or wrap-around pad with a driver-side instrument binnacle or two round glass vintage gauges — hung from the chassis dashRail socket via veh-garage, with a left/right-hand-drive position module", "when": "make a car dashboard / dash with gauges / instrument cluster / cockpit panel for a vehicle build", "tier": "recipe", "marks": ["extrude", "lathe"], "phase": "p1" }
---

Veh-dash is a `rail-mount` part (`lite-template/integration/plan-archive/vehicle-designer.plan.md` V4).
The slab is one wide x-axis extrude whose (y,z) profile carries the rake;
the cluster is a binnacle extrude or two self-closing glass-role gauge
lathes on the driver side.

Local frame: `+y` forward, `+z` up; the MOUNT is the origin — the dash-rail
point (`planComponentFit` → chassis `dashRail`). The slab hangs below and
behind it, so a standalone preview "sinks" — that is the mount convention,
not an error. `position` (`left`/`right`) sets the driving convention and is
NEVER randomized; a trailer has no dashRail and refuses the part.

## Families

| Family | Cluster |
|---|---|
| `slabCluster` | binnacle pad |
| `vintageGauges` | two round glass gauges |
| `sportBinnacle` | wrap-form pad + binnacle |

```js
resolveVehDashRecipe({ family: 'vintageGauges', seed: 'dash-01' });
resolveVehDashRecipe({ family: 'slabCluster', overrides: { position: 'right' } }); // RHD
```
