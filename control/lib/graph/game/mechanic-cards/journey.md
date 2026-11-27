---
{ "id": "journey", "name": "What she gains goes on with her (emitter)", "summary": "A metroidvania castle cut into segments, each its own level: every gain the hero makes (a relic taken, a boss felled, a gate opened, a screen walked, a node learned, a foe's souls) is kept as a flag in a flags slice the game carries; entering the next segment, each is put back as it stood.", "when": "carry progress between maps, powers carry over, the castle in segments, keep what she found, the map remembers, felled bosses stay felled" }
---

## Role

**emitter**. Needs a `flags` slice in the store (named by `slice`, else the first one) and a level whose world has held
gates (a metroidvania box: worlds/controllable/held-gates.js).

## Params

```json
{ "kind": "journey", "slice": "journey" }
```

## Lowers to

- world: a reaction on `journey` (the cast's fact: a gain, with `journey:<what>:<id>` beside it), which turns the level's
  cast facts on.
- contract: `on: { "journey:*": { emit: { type: "setFlag", slice, key: "{event}", value: true } } }` (the flag is named
  for the event), `produces` the setFlag, `consumes` the slice, and `journey: { slice }`: at the start the page puts
  every gain the slice holds back as it stood (`carryIn`: tokens held, rules laid on the hero, relics and bosses gone,
  gates open, the map walked, nodes learned), with no toast.

A gameworld whose levels are a castle's segments (`segment`, on a megaworld) gives each such level this, its gains in
the `journey` flags slice.
