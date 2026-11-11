---
{
  "id": "machina",
  "name": "Machina (can this mechanism move this load?)",
  "family": "object",
  "entry": "verify_machina",
  "summary": "State a materials-handling problem (a load, a chain of simple machines, the limits it must stay within) and get a checked feasibility verdict with margins: the effort needed, the work and power, and which limit binds. A calculation, not a picture: nothing is minted.",
  "when": "Reach for this on 'can a person crank N crates up to the mezzanine in an hour / size a block-and-tackle to lift this safely / will this ramp, jack or lever handle the load within the force limit / how many pulleys do I need / design a machine to move X of weight W within capacity C / is this hoist strong enough / how much force to lift it'."
}
---

Machina answers one question with numbers: can this MECHANISM move this LOAD within these CAPACITY limits? You state the problem as a recipe of three parts and it returns a verdict, never a render. It is pure compute: nothing is minted or stored, and the same recipe gives the same verdict.

```
verify_machina({
  title: 'Crates to the mezzanine',
  demand: { count: 40, unitMass: { value: 25, unit: 'kg' }, distance: { value: 3, unit: 'm' }, time: { value: 1, unit: 'h' } },
  mechanism: [{ type: 'pulley', segments: 4, eta: 0.85 }],
  capacities: [
    { type: 'force', rating: { value: 250, unit: 'N' } },
    { type: 'rate', power: { value: 150, unit: 'W' } },
  ],
})
```

answers feasible: a 3.4 : 1 net advantage, 72 N of effort over 12 m per crate, 35 kJ spent for 29 kJ delivered, 10 W sustained, with 178 N of headroom on the force limit.

## 1. `demand`: the load

- `count`: how many units in total. Required.
- `unitMass`: the mass of one unit, `{ value: 50, unit: 'kg' }`, turned into weight by `g`. Or `unitWeight`: its weight as a force, `{ value: 490, unit: 'N' }`, when you have the force directly.
- `distance`: how far or how high one unit moves, `{ value: 3, unit: 'm' }`. Required.
- `time`: the total time budget, `{ value: 1, unit: 'h' }`. Optional, and it unlocks the power and throughput checks.
- `unitsPerCycle`: units moved together in one cycle of the machine (default 1).
- `g`: gravitational acceleration in m/s² (default 9.8, Earth).

Quantities are `{ value, unit }`. Units read as written: mass `kg`, `g`, `t`, `lb`; length `m`, `mm`, `cm`, `km`, `ft`, `in`; time `s`, `min`, `h`; force `N`, `kN`, `kgf`, `lbf`; power `W`, `kW`, `hp`. A quantity of the wrong dimension is refused rather than converted.

## 2. `mechanism`: the chain of simple machines

A list from the effort source to the load. Each stage is a force transformer, and mechanical advantage MULTIPLIES down the chain.

| `type` | parameters | advantage |
|---|---|---|
| `lever` | `effortArm`, `loadArm` (m) | effortArm / loadArm |
| `wheelAxle` | `wheelR`, `axleR` (m) | wheelR / axleR |
| `pulley` | `segments` (the rope falls holding the load) | segments |
| `incline` | `slope` (its length), `height` (its rise) (m) | slope / height |
| `wedge` | `length`, `thickness` (m) | length / thickness |
| `screw` | `leverR` (the effort lever's radius), `pitch` (lead per turn) (m) | 2π · leverR / pitch |

Every stage takes an optional `eta`, its efficiency from 0 to 1 (default 1, ideal). Below 1 it opens a friction loss: the work put in is the work out divided by `eta`.

Conservation of work is structural. A machine trades force for distance and never yields work for free, so W_in ≥ W_out always holds and a perpetual-motion design cannot be written down.

## 3. `capacities`: the limits

Each entry is one constraint, checked on its own with its own margin. Omit the list and you get the resolved numbers with nothing to pass or fail.

- `{ type: 'force', rating, on }`: a strength limit, `rating: { value: 250, unit: 'N' }`. `on` says what bears it: `'effort'` (the default: the force the person or motor must supply, NOT the load), `'peak'` (the worst-loaded element), or a stage by its type or index.
- `{ type: 'rate', power, throughput }`: a power budget, `power: { value: 150, unit: 'W' }`, and/or a throughput ceiling, `throughput: { value: 120, per: 'h' }` (`per` is `s`, `min` or `h`). Needs `demand.time`: without it the rate limit is not checked, and passes.
- `{ type: 'storage', rating }`: the most units staged at once, a plain number.

## What comes back

`{ feasible, binding, report, verdict }`

- `feasible`: true when every capacity holds.
- `binding`: every constraint that fails, by name. An infeasible design names all of them, not the first.
- `report`: the verdict as readable markdown, to show the person: the mechanism, the resolved numbers, each check with its headroom.
- `verdict`: the same as structured numbers: the net advantage, the effort force, the total work, the friction loss, the sustained power, and a margin per constraint.

Feasibility is reported as MARGINS (headroom), not a bare yes or no, so a design that barely passes reads differently from an overbuilt one. When a design fails, change what the binding constraint names: more rope falls or a longer lever for a force limit, more time or fewer units per cycle for a power limit.

`title` and `intent` are optional labels; they head the report.

## What it is not

It checks a design, it does not draw one. To see a simple machine working as a 3D exhibit, `create_exhibit` with `science/mechanics`. To make the part itself (a bracket, a pulley block, a lever arm), mint it as a `scad` or `workbench` solid; a scad row's `strength` checks can take their effort from a lever here.
