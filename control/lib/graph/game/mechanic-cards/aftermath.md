---
{ "id": "aftermath", "name": "What broke stays broken (emitter)", "summary": "Each block that breaks in the level is kept as a flag in a flags slice the game carries; entering the level again, those blocks are gone from the start, without the shatter. The world remembers the damage done to it.", "when": "the world remembers, destruction persists, come back to the rubble, broken stays broken, aftermath, scars of the fight" }
---

## Role

**emitter**. Needs a `flags` slice in the store (named by `slice`, else the first one) and a level whose things can
break (its `destruction` degree, playscape/destruct).

## Params

```json
{ "kind": "aftermath", "slice": "aftermath" }
```

## Lowers to

- world: a reaction on `broke` (the cast's fact: a breakable block that broke, with `broke:<id>` beside it), which
  turns the level's cast facts on.
- contract: `on: { "broke:*": { emit: { type: "setFlag", slice, key: "{event}", value: true } } }` (the flag is named
  for the event: `broke:<id>`), `produces` the setFlag, `consumes` the slice, and `aftermath: { slice }`: at the start
  the level takes away every block the slice holds as broken (`restore`, no pieces, no flash).

A gameworld whose `mechanics.destruction` lets things break gives every level this, its breaks in the `aftermath`
flags slice.
