---
{ "id": "veh-engine", "name": "Vehicle engine (the first bay-mount part of the veh-* shelf)", "summary": "seeded engine recipes for the vehicle designer: painted inline fours with intake log and crank pulley, chrome vee eights with angled banks and valley plenum, compact transverse fours, and vintage vee engines wearing four chrome velocity stacks — block + head + intake at the pinned fidelity floor, seated into a chassis engineBay socket via veh-garage", "when": "make a car engine / V8 / inline four / transverse engine / motor for the engine bay / hot rod engine with velocity stacks / drivetrain block for a vehicle build", "tier": "recipe", "marks": ["extrude", "lathe", "sweep"], "phase": "p1" }
---

Veh-engine is the first `bay-mount` part of the vehicle shelf (see
`lite-template/integration/plan-archive/vehicle-designer.plan.md` V3). The block stack (oil pan, block,
head, valve cover) is `extrude`s; vee banks are y-axis extrudes with rotated
rect profiles; the crank pulley and velocity stacks are self-closing
`lathe`s; intake logs and exhaust manifolds are `sweep`s.

**Fidelity floor (pinned in the plan): block + head + intake — 5–11
monomers, not a greeble festival.** The dream loop supplies shape reference;
the BOM audit only needs the engine to BE there and read as one.

Local frame: `+y` forward (pulley end), `+z` up. The MOUNT is the origin —
oil pan bottom-center at `[0,0,0]` — so `planComponentFit` lands it on the
chassis `engineBay` anchor and the block rises above the deck. Transverse
engines turn the crank across x (`localFrame.crank`).

## Families

| Family | Layout | Silhouette |
|---|---|---|
| `inlineFour` | inline | tall narrow block, intake log, dressed pulley |
| `veeEight` | vee | big chrome banks in a 56° vee, valley plenum, twin manifolds |
| `transverseFour` | transverse | small bare block turned across the bay |
| `vintageStacks` | vee | chrome banks wearing four velocity stacks |

## Modules

- `layout`: `inline`, `vee`, `transverse`
- `displacement`: `small`, `standard`, `big` (scale 0.85 / 1.0 / 1.15)
- `intake`: `plenum`, `stacks` (stacks are four self-closing chrome lathes)
- `dress`: `bare`, `dressed` (dressed adds the crank pulley + exhaust manifolds)
- `valveCover`: `painted`, `chrome`

Color roles are the shelf-wide six (see [[veh-wheel]]): block and pan take
`trim` (dark iron), the head takes `paint`, valve covers take `paint` or
`chrome` per the module, stacks/pulley take `chrome`.

## Hardpoints

Every engine records `garage.mountFamily: 'bay-mount'`:

- `mount`: `[0,0,0]` — the oil pan bottom-center; seats on `engineBay`
- `driveOutput`: rear of the crank (toward the gearbox) — `-y` for
  longitudinal engines, `-x` for transverse

`planComponentFit(engine, chassis)` returns the single bay placement and
throws on a `towedFrame` (a trailer has no engine bay — that refusal is the
BOM working, not a bug).

## Example Calls

```js
resolveVehEngineRecipe({
  family: 'veeEight',
  palette: 'murderedOut',
  seed: 'big-block-01',
});

resolveVehEngineRecipe({
  family: 'inlineFour',
  seed: 33,
  overrides: { intake: 'stacks', valveCover: 'chrome' },
});

// seat it: chassis + engine → assembler item
const { placements } = planComponentFit(engine, chassis);
// → { socket:'engineBay', at:[0, ~4.2, ~1.5] } — superpose at that `at`
```

## Design Rules

- A dressed engine's pulley marks the FRONT (`+y`); never put intake and
  exhaust on the same side of an inline.
- A seated engine tops out well above the chassis rails — the body shell
  (V5) must clear a dressed engine's `dims.height` + deck z at the hood line.
- Self-close every outward-visible lathe end (shelf rule, see [[veh-wheel]]).
