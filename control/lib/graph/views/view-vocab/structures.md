---
{
  "id": "structures",
  "name": "World structures (towers, colonnades, rotundas, halls and arenas grown from a few words)",
  "family": "world",
  "entry": "compose_world",
  "summary": "Landmark towers for ANY /world, each from a few words: a plan (square, turned squares, a star, a stepped circle, offset faces), a rise (how it narrows, turns and is banded as it climbs), a crown, an echo (smaller copies of the whole standing against its flanks, to a depth: a tower of towers) and a colonnade (other structures, columns by default, stood round it or on a grid: a structure made of structures), on a solid or a hollow body. The principles of the temple builders of India, lifted off the temple.",
  "when": "Reach for this on framing like 'put a tower / spire / ziggurat / stepped pyramid / landmark in my world', 'a skyline of strange towers', 'an alien citadel', 'a fractal tower / a tower of towers', 'a star-shaped tower', 'a temple spire', 'a pagoda-like stack that twists', 'a ringed drum / silo', 'a dark needle tower', 'something tall and interesting to walk toward', 'a level that climbs a stepped pyramid', 'quickly fill the world with structures', 'a pillar / column / colonnade / portico', 'a rotunda / tholos / domed pavilion', 'a cloister / a courtyard ringed with columns', 'a pillared hall / hypostyle / mandapa', 'a stadium / arena / amphitheatre / colosseum / a seating bowl'."
}
---

Structures are a kind-generic channel: pass them to `compose_world` as `overrides.structures` (any base), or set `structures` on a stored world's recipe and patch it in place (`set /structures/0/rise/tiers 11`). Every tower is regenerated from its words on every read; nothing is stored but the words.

## Spec

```
structures: [{
  preset?:  'spire' | 'cluster' | 'ziggurat' | 'star' | 'drum' | 'turning' | 'beehive' | 'needle'
            | 'column' | 'rotunda' | 'cloister' | 'hall' | 'arena' | 'auto'  (default spire),
  at:       [x, y] or [x, y, z]     where its base stands, in the world's units (z defaults to 0: seat it on your ground),
  size?:    the base's width (12; a preset may carry its own: a column 1.2, an arena 90),   height?: the body's height (size × the preset's aspect),   turn?: degrees,
  seed?:    the roll for 'auto' (same seed, same tower),   id?: a name for its faces and colliders,
  plan?, rise?, crown?, echo?, plinth?, hollow?, colonnade?, stretch?, palette?   any dial over the preset (below)
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
- `beehive` — storeys of square blocks riding a circle, curving in to a ribbed disc.
- `needle` — a hexagram plan flaring to a thin point: a beacon, a mast, a dark tower.

Made of structures (a colonnade of the `column` preset unless `of` says otherwise):

- `column` — a fluted shaft on a base under a square abacus. On its own: a pillar, a row of them, a ruin.
- `rotunda` — a round drum in a ring of columns under a dome, a small copy of itself on top for a lantern (a tholos).
- `cloister` — a square ring of walls round a courtyard, a covered walk on columns inside it. Walk in through a gap you leave, or drop in.
- `hall` — a grid of columns carrying a stepped pyramid roof (a mandapa, a hypostyle hall): open, shaded, full of cover.
- `arena` — an oval bowl: seating terraces stepping out as they rise, behind a storeyed wall ringed with columns.

## The four words

**plan** — the footprint, top-down. A word, or `{ form, …dials }`:
- `square`; `circle` `{ sides }`;
- `turned` `{ sides: 4, k: 2 }` — k copies of a polygon each turned 360°/(sides·k): two squares make the 8-point star, four the 16-point;
- `star` `{ points, inner }`;
- `stepped-circle` `{ steps }` — square blocks whose corners ride a circle;
- `offset` `{ bays: 5, project: 0.1, depth: 2 }` — each face cut into odd bays, the middle one projecting most, cut again to `depth` (the plan's own fractal).

**rise** — `{ tiers, curve, power?, top, diminish, stepped?, twist?, cornice? }`. The width at height fraction f is top + (1 − top)(1 − f^p): `curve` names p — `needle` (flares in), `cone` (straight), `rekha` (holds its width, then closes: the curved spire), `bulb`, `dome` (shoulders). `top` is the width left at the top. `tiers` are storeys whose heights shrink by `diminish` each; `cornice: { depth, height }` (or `false`) bands each one. `stepped: true` holds each tier straight so the next stands back on a terrace; `twist` turns each tier by degrees past the last.

**crown** — `'disc'` (a neck, a ribbed oblate disc and a finial), `'dome'`, `'finial'`, `'slab'` (a square abacus: a column's capital) or `'none'`; or `{ form, ribs: 32, size }`.

**echo** — the self-similarity: `{ depth, scale, where, around, rings, reach, sink }` or `false`. Copies of the whole tower at `scale` of its width where they stand, `around` directions on its `faces`, `corners` or `both`, in `rings` rows up `reach` of its height, sunk `sink` of their width into the flank; each copy echoes again until `depth`. A copy's tiers and plan coarsen with depth. A tower over the face budget loses its deepest copies first, never itself. `where: 'top'` stands one copy (`scale` of the whole) on the crown in place of its finial: a lantern.

**colonnade** — a structure made of structures: `{ of, layout, count, radius, span, width, height, carry, roof }` or `false`.
- `of` — any structure's words without `at` (a preset name, or `{ preset, plan, crown, … }`); default `'column'`. A column of columns is fine; a third level is refused.
- `layout: 'ring'` — `count` of them round the plan at `radius` (1 is the wall; over 1 outside it, under the hollow's `inner` inside the courtyard), spaced evenly along the perimeter from a corner, so a square with a multiple of 4 has one at each corner. An entablature ring rests on their capitals (`beam: false` for none: free-standing pillars, a ring of spires); `roof: true` spans it to the nearest wall (a portico, a cloister walk).
- `layout: 'grid'` — `count: [nx, ny]` over `span` of the plan.
- `width` (a column's diameter) and `height` are fractions of `size`. The shaft is sized so the capitals meet the beam.
- `carry: true` stands the body on the columns (a pillared hall, an open pavilion: a dome on a ring of columns).

**hollow** — `{ inner, rake }` or `false`: the body is a wall round open ground. The open edge at height fraction f is `inner + rake · f`; a positive `rake` on a `stepped` rise makes seating terraces stepping out as they rise (a bowl), a negative one leans the walls in. The plinth stays solid: it is the floor.

**stretch** — `[sx, sy]`: the plan scaled per axis, crown and all (an oval arena, a long hall). `size` is the width before it.

**plinth** — `{ steps, height, margin }` or `false`: terraces under it, its own plan widened (and widened again to carry a ring of columns outside the wall). **palette** — `{ body, band, crown, plinth }` as `#rrggbb`; a colonnade's columns wear their own.

## In a world

- The faces join the world before its material, texture and shadow passes, so they light and fog like the rest. A world you walk grounds the walker on them; a world with entities also gets a box collider for every tier, plinth step, column and beam (a walker stands on the terraces of a `stepped` rise; a hollow body is boxed segment by segment, so its open ground stays open).
- Seat it yourself: `z` is not read from the terrain. Put it on a plaza, a hilltop or a clearing whose height you know.
- A copy at depth 2 is a few metres of detail; a dozen `cluster`s is a heavy world, a dozen `turning`s is not.

## Examples

- A temple hill: `[{ preset: 'cluster', at: [0, 0], size: 18 }, { preset: 'spire', at: [-26, 8], size: 9 }, { preset: 'spire', at: [26, 8], size: 9 }]`
- An alien skyline: ten `{ preset: 'auto', seed: i, at: [i * 30, 0], size: 10 + i }`.
- A level that climbs: `{ preset: 'ziggurat', at: [0, 40], size: 40, rise: { tiers: 6 } }`.
- A stellate keep: `{ preset: 'star', at: [0, 0], plan: { form: 'turned', sides: 4, k: 3 }, rise: { twist: 15, stepped: true } }`.
- A monopteros (a dome on columns, no wall): `{ preset: 'rotunda', at: [0, 0], rise: { top: 1 }, height: 0.6, colonnade: { radius: 0.92, carry: true, roof: false } }`.
- A round cloister (the circular yogini temples): `{ preset: 'cloister', at: [0, 0], plan: { form: 'circle', sides: 48 } }`.
- A ring of spires round a drum: `{ preset: 'drum', at: [0, 0], colonnade: { of: { preset: 'needle', echo: false }, count: 8, radius: 1.6, width: 0.12, height: 1.1, beam: false } }`.
- A circus for chariots: `{ preset: 'arena', at: [0, 0], stretch: [1, 0.35], size: 160 }`.
