---
{
  "id": "structures",
  "name": "World structures (towers grown from a plan, a rise and an echo)",
  "family": "world",
  "entry": "compose_world",
  "summary": "Landmark towers for ANY /world, each from a few words: a plan (square, turned squares, a star, a stepped circle, offset faces), a rise (how it narrows, turns and is banded as it climbs), a crown, and an echo (smaller copies of the whole standing against its flanks, to a depth: a tower of towers). The principles of the temple builders of India, lifted off the temple.",
  "when": "Reach for this on framing like 'put a tower / spire / ziggurat / stepped pyramid / landmark in my world', 'a skyline of strange towers', 'an alien citadel', 'a fractal tower / a tower of towers', 'a star-shaped tower', 'a temple spire', 'a pagoda-like stack that twists', 'a ringed drum / silo', 'a dark needle tower', 'something tall and interesting to walk toward', 'a level that climbs a stepped pyramid', 'quickly fill the world with structures'."
}
---

Structures are a kind-generic channel: pass them to `compose_world` as `overrides.structures` (any base), or set `structures` on a stored world's recipe and patch it in place (`set /structures/0/rise/tiers 11`). Every tower is regenerated from its words on every read; nothing is stored but the words.

## Spec

```
structures: [{
  preset?:  'spire' | 'cluster' | 'ziggurat' | 'star' | 'drum' | 'turning' | 'rotunda' | 'needle' | 'auto'  (default spire),
  at:       [x, y] or [x, y, z]     where its base stands, in the world's units (z defaults to 0: seat it on your ground),
  size?:    the base's width (12),   height?: the body's height (size × the preset's aspect),   turn?: degrees,
  seed?:    the roll for 'auto' (same seed, same tower),   id?: a name for its faces and colliders,
  plan?, rise?, crown?, echo?, plinth?, palette?   any dial over the preset (below)
}]
```

A preset is a starting look; override any dial. `auto` rolls a preset and jitters its tiers, plan, twist and echo from the seed, so `[{ preset: 'auto', seed: 1, at }, { preset: 'auto', seed: 2, at }, …]` is a varied skyline in one line.

## The presets

- `spire` — a curvilinear tower on an offset plan, banded by its storeys, a ribbed disc on top, half-size copies climbing each face.
- `cluster` — the spire whose copies carry their own copies: a tower of towers, two levels deep.
- `ziggurat` — square terraces stepping in, small pavilions on the terrace corners. Walkable: each terrace is a ledge.
- `star` — a sixteen-point plan from four turned squares, fluted straight up, on a star-shaped platform.
- `drum` — a round ringed drum with dome shoulders and a dome.
- `turning` — square storeys, each turned 22.5° past the one below, under deep eaves.
- `rotunda` — storeys of square blocks riding a circle, curving in to a ribbed disc.
- `needle` — a hexagram plan flaring to a thin point: a beacon, a mast, a dark tower.

## The four words

**plan** — the footprint, top-down. A word, or `{ form, …dials }`:
- `square`; `circle` `{ sides }`;
- `turned` `{ sides: 4, k: 2 }` — k copies of a polygon each turned 360°/(sides·k): two squares make the 8-point star, four the 16-point;
- `star` `{ points, inner }`;
- `stepped-circle` `{ steps }` — square blocks whose corners ride a circle;
- `offset` `{ bays: 5, project: 0.1, depth: 2 }` — each face cut into odd bays, the middle one projecting most, cut again to `depth` (the plan's own fractal).

**rise** — `{ tiers, curve, power?, top, diminish, stepped?, twist?, cornice? }`. The width at height fraction f is top + (1 − top)(1 − f^p): `curve` names p — `needle` (flares in), `cone` (straight), `rekha` (holds its width, then closes: the curved spire), `bulb`, `dome` (shoulders). `top` is the width left at the top. `tiers` are storeys whose heights shrink by `diminish` each; `cornice: { depth, height }` (or `false`) bands each one. `stepped: true` holds each tier straight so the next stands back on a terrace; `twist` turns each tier by degrees past the last.

**crown** — `'disc'` (a neck, a ribbed oblate disc and a finial), `'dome'`, `'finial'` or `'none'`; or `{ form, ribs: 32, size }`.

**echo** — the self-similarity: `{ depth, scale, where, around, rings, reach, sink }` or `false`. Copies of the whole tower at `scale` of its width where they stand, `around` directions on its `faces`, `corners` or `both`, in `rings` rows up `reach` of its height, sunk `sink` of their width into the flank; each copy echoes again until `depth`. A copy's tiers and plan coarsen with depth. A tower over the face budget loses its deepest copies first, never itself.

**plinth** — `{ steps, height, margin }` or `false`: terraces under it, its own plan widened. **palette** — `{ body, band, crown, plinth }` as `#rrggbb`.

## In a world

- The faces join the world before its material, texture and shadow passes, so they light and fog like the rest. A world you walk grounds the walker on them; a world with entities also gets a box collider for every tier and plinth step (a walker stands on the terraces of a `stepped` rise).
- Seat it yourself: `z` is not read from the terrain. Put it on a plaza, a hilltop or a clearing whose height you know.
- A copy at depth 2 is a few metres of detail; a dozen `cluster`s is a heavy world, a dozen `turning`s is not.

## Examples

- A temple hill: `[{ preset: 'cluster', at: [0, 0], size: 18 }, { preset: 'spire', at: [-26, 8], size: 9 }, { preset: 'spire', at: [26, 8], size: 9 }]`
- An alien skyline: ten `{ preset: 'auto', seed: i, at: [i * 30, 0], size: 10 + i }`.
- A level that climbs: `{ preset: 'ziggurat', at: [0, 40], size: 40, rise: { tiers: 6 } }`.
- A stellate keep: `{ preset: 'star', at: [0, 0], plan: { form: 'turned', sides: 4, k: 3 }, rise: { twist: 15, stepped: true } }`.
