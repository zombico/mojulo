---
{ "id": "veh-chassis", "name": "Vehicle chassis (the root part + socket source of the veh-* shelf)", "summary": "seeded chassis/platform recipes for the vehicle designer: ladder frames with rails and crossmembers, unibody floor pans with sills and tunnel, low-slung sport pans, and towed trailer frames with tongue and hitch ball — the ROOT part every other veh-* component seats on; veh-garage derives hub/bay/deck/rail sockets from its geometry by position, never by id", "when": "make a car chassis / truck frame / ladder frame / unibody floor pan / trailer frame / rolling chassis / vehicle platform to mount wheels and engine on", "tier": "recipe", "marks": ["extrude", "lathe", "sweep"], "phase": "p1" }
---

Veh-chassis is the root of a vehicle build (see
`lite-template/integration/plan-archive/vehicle-designer.plan.md` V2). Rails, crossmembers, pan, sills,
and subframes are `extrude`s; the four axle stubs are x-axis `lathe`s; a
trailer tongue is two `sweep`s meeting at a chrome hitch ball.

The chassis is authored **at ride height**: axle stub centerlines sit at
`z = dims.wheelRadius` (1.0, the standard veh-wheel), so a seated wheel
touches the ground at z=0. A standalone chassis preview floats — that is
correct; the wheels hold it up. Local frame: `+y` forward, `+z` up, `+x`
right.

## Families

| Family | Frame | Silhouette |
|---|---|---|
| `ladderFrame` | ladder | long high truck frame, heavy crossmembers, bumpers |
| `unibodyPan` | unibody | car floor pan with sills, tunnel, subframes |
| `sportPan` | unibody | short, low, wide pan |
| `towedFrame` | ladder | short trailer frame — tongue + hitch, NO engine bay |

## Modules

- `frame`: `ladder`, `unibody`
- `wheelbase`: `short`, `standard`, `long` (6.5 / 8.0 / 9.5)
- `track`: `narrow`, `standard`, `wide` (4.2 / 4.9 / 5.6)
- `rideHeight`: `low`, `standard`, `high` (clearance 0.15 / 0.35 / 0.6)
- `crossmembers`: `light`, `heavy`
- `nose`: `engine`, `tongue` (tongue = trailer: no engine bay, no dash rail)

Color roles are the shelf-wide six (see [[veh-wheel]]): rails/stubs/
crossmembers take `trim`, pan/sills/tunnel take `paint`, bumpers and the
hitch ball take `chrome`.

## Sockets (the veh-garage contract)

The chassis does not store sockets — `veh-garage.js` derives them from
geometry, mirroring ms-armory's rule: **position is truth, ids never are**.

- `deriveAxleSockets(chassis)` → 4 hub sockets. Axle stubs are found as the
  only x-axis lathes; the hub anchor is the outboard end (larger |x|);
  `left`/`right` from the sign of x, `front`/`rear` from y against the axle
  midline. Sorted FL, FR, RL, RR.
- `deriveBaySockets(chassis)` → `{ engineBay?, cabinDeck, dashRail?, hitch? }`.
  A `towedFrame` has no `engineBay`/`dashRail` — the missing socket is data
  (the BOM varies by archetype), not an error.
- `planComponentFit(part, chassis)` → assembler placements for a part's
  `garage.mountFamily`:
  - `hub-mount` → 4 placements; LEFT wheels get `flip:'x'` so the outboard
    face points away on both sides; `at` lands `hardpoints.hubCenter` on the
    socket, which grounds a matched-radius wheel at z=0. Warns when the
    wheel radius fights the chassis design radius.
  - `bay-mount` / `deck-mount` / `rail-mount` → 1 placement on the bay
    anchor; throws only when the part asks for a bay this chassis lacks.

## Example Calls

```js
resolveVehChassisRecipe({
  family: 'unibodyPan',
  palette: 'factorySteel',
  seed: 'platform-01',
});

resolveVehChassisRecipe({
  family: 'towedFrame',
  seed: 'camper',
});

// a rolling chassis: seat four wheels via the garage
const chassis = resolveVehChassisRecipe({ family: 'unibodyPan', seed: 'v2' });
const wheel = resolveVehWheelRecipe({ family: 'steelie', seed: 'v2' });
const { placements } = planComponentFit(wheel, chassis);
// → create_assembler items: chassis at [0,0,0] (superposed at ride height),
//   one wheel per placement ({ at, flip }), each grounded at z=0
```

## Design Rules

- The four axle stubs must stay the ONLY x-axis lathes on a chassis — that
  is how the garage finds them.
- Stub ids deliberately carry no side/axle meaning (`axle_stub_a`…`_d`);
  never encode position in an id, and never read one.
- Chassis + wheels compose by SUPERPOSITION in the assembler (the chassis
  bridges on its wheels like the chariot bed in the assembler doctrine) —
  gravity-seating a chassis would drop it to the floor.
- Self-close every outward-visible lathe end (shelf rule, see [[veh-wheel]]).
