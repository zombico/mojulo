---
{ "id": "architectural-construction", "name": "recipe.kind = \"architecturalConstruction\"", "summary": "fast house/building construction — 0px element-map first, then library bindings", "when": "fast house/building requests where body, roof, entry, porch, steps/stairs, chimney, and facade rhythms should be solved as a 0px element map before visible marks", "tier": "recipe", "marks": [], "phase": "p1" }
---

`recipe.kind = "architecturalConstruction"` is authoring shorthand for fast
house/building requests. **Prefer this over hand-enumerating building parts.**

## Required first step: pureMandala element map

The compiler must first create a 0px normalized slot map:

```
polygonizer.pureMandala.kind = "zero-vector-element-map"
polygonizer.pureMandala.slots = {
  body, roof, entry, porch, "steps/stairs", chimney, "facade rhythms"
}
```

## Then bind libraries

Element libraries (door, window, sill, lintel, shingle pattern) bind into
those constellation slots **only after overlap is resolved in mandala
space**. The compiler lowers the recipe to ordinary marks (solids, planes,
arrays for repeating facade rhythms).

## Shape

```
recipe{
  kind: "architecturalConstruction",
  style?: ...,
  body?, roof?, entry?, porch?,
  stairs?, chimney?,
  facadeRhythms?: [{ slot, repeat, ... }],
  ...
}
```

## Why first-step mandala

Hand-enumerating "wall + door + four windows + roof + chimney + steps"
fails because windows collide with the porch overhang, the chimney lands
on top of a dormer, and the steps run into the porch posts. Solving the
slot map in 0px mandala space first means the lowered marks already obey
non-overlap and gravity.
