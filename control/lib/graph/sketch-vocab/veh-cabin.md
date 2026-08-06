---
{ "id": "veh-cabin", "name": "Vehicle cabin (seating, the deck-mount part of the veh-* shelf)", "summary": "seeded seating recipes for the vehicle designer: front bench, twin buckets with headrests, or 2+2 buckets plus rear bench — cushions and raked backrests as simple extrudes, seated on the chassis cabinDeck socket via veh-garage; works on cars AND trailers (a caravan has furniture)", "when": "make car seats / bench seat / bucket seats / cabin interior / seating for a vehicle or camper build", "tier": "recipe", "marks": ["extrude"], "phase": "p1" }
---

Veh-cabin is the `deck-mount` part of the vehicle shelf
(`lite-template/integration/plan-archive/vehicle-designer.plan.md` V4). Cushions, raked backrests, and
headrests are extrudes. Fidelity floor: seats read as seats through a side
window — no piping, no stitching.

Local frame: `+y` forward, `+z` up; the MOUNT is the origin (cabin floor
point → chassis `cabinDeck` anchor). Front row sits forward of the mount,
the second row (always a bench — the 2+2 idiom) behind it.

## Families & Modules

| Family | Reads as |
|---|---|
| `benchFront` | one wide front bench |
| `bucketsTwo` | twin buckets + headrests |
| `twoPlusTwo` | buckets up front, bench behind |

Modules: `seating` (`bench`/`buckets`), `rows` (`one`/`two`), `headrests`
(`none`/`paired`). Upholstery takes the `trim` role.

Fit note: `planComponentFit(cabin, chassis)` seats on `cabinDeck`, which
EVERY chassis has — including `towedFrame`. A trailer with a bench is a
caravan; that's the archetype table working, not a loophole.

```js
resolveVehCabinRecipe({ family: 'twoPlusTwo', palette: 'factorySteel', seed: 'interior-01' });
```
