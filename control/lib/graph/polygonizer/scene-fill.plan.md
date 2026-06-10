# Scene-fill — completion criteria for painted landscapes

Status: in progress (2026-06-09). Adds a `scene` card family so a nature
landscape can be *filled enough to read* deterministically, not just
moodily tinted.

## The gap (proven on screen 2026-06-09)

`heartbeat` sets the ground geometry; `splatch` sets the mood. A
heartbeat+splatch pair lands a register for free — but renders as a
floating terrain *swatch*, not a *scene*. The only existing fill is
`STRUCTURE_GLYPHS` (box/obelisk), which is architectural and fixed-count.
For nature there is no fill vocabulary and no notion of "how much is
enough."

Evidence refs: `scene-dusk-dunes`, `scene-glacial`, `scene-meadow-empty`
(swatches) vs `scene-meadow-totems` (totems flip swatch → place, but read
as a ruin, not nature).

## Decision

Completion is defined **per-biome via scene cards** (operator chose this
over generic depth-band coverage or horizon-break). A scene card is the
completion unit: it names the fill kinds that belong, their target count
per depth band, and a heartbeat/splatch affinity hint. **Complete = every
band's quota placed.** The card declares the legibility budget; the
layout fulfills it; the mint result reports it so "filled enough to read"
is auditable.

## Card shape (`family: "scene"`)

```jsonc
{
  "id": "pine-forest",
  "family": "scene",
  "aliases": ["forest", "conifers", "woods"],
  "intent": "dense conifer stand thinning to a far ridgeline",
  "affinity": { "heartbeats": ["rocky-irregular","gentle-roughness"],
                "splatches":  ["verdure-trio","meadow-trio"] },
  "fill": {
    "near": [ { "kind": "cone", "count": 9, "size": [1.6, 2.8] },
              { "kind": "boulder", "count": 2, "size": [0.5, 0.9] } ],
    "mid":  [ { "kind": "cone", "count": 13, "size": [1.0, 1.8] } ],
    "far":  [ { "kind": "cone", "count": 18, "size": [0.6, 1.1] } ]
  }
}
```

- Depth bands over the quad's `v` axis (v=0 near → v=1 far):
  `near = [0, 0.34]`, `mid = [0.34, 0.67]`, `far = [0.67, 1.0]`.
- `affinity` is a recommendation surfaced in the catalogue only — it does
  not constrain (operator owns the pairing).
- Validation: each band entry's `kind ∈ SCATTER_KINDS`, `count` int ≥ 0,
  `size` a positive `[lo, hi]`. At least one band non-empty.

## Scatter kinds (renderer)

`SCATTER_KINDS = { cone, canopy, boulder, tuft }`. Each is a billboard:
project the item's world base/top/half-width points through the same
camera (depth-scale comes free from `projectTwoPoint`), assemble a
screen-space silhouette, Lambert-shade directionally from the scene
light, and drop a `palette.shadow` contact ellipse to plant it on the
ground. Depth-sorted into the same polygon list as terrain + structures
by the base point's `depthT`.

- `cone`    — fir triangle + short trunk
- `canopy`  — trunk rect + rounded blob
- `boulder` — low irregular lump (wide, short)
- `tuft`    — fan of thin grass blades

## Placement

`resolveScene(scene, seed)` → flat item list. Per band, per fill entry,
scatter `count` items on a seeded jittered grid across the band's
`(u∈[0,1], v∈band)` rectangle; sample height/width from `size`; convert
`(u,v)→(x,y)`. `z_base` is read from the heartbeat at render time (same
as structures), so items ride the hill they land on. Determinism:
`(scene, seed)` → identical layout.

## Completion report

`computeSceneCompletion(scene)` → `{ bands: { near|mid|far:
{ target, placed } }, complete: bool }`. v1 always meets quota (we place
exactly the target). Value is the auditable report in the mint result.
Future: mark a band incomplete when items fall outside the camera frame
(camera-clip detection) — that's where the criterion gains teeth.

## Surface

`create_painted_landscape` gains an optional `scene` param (enum of scene
ids), orthogonal to `structures`. Result returns `completion`. The two
can coexist (a village in a forest), but nature scenes use `scene` alone.

## Build order

1. `scene-pine-forest.md` card + loader `scene` family + `SCENES` export. ← slice
2. `SCATTER_KINDS` silhouettes + `resolveScene` + `buildScatter` in
   painted-landscape.js; wire into `renderPaintedLandscapeToSvg`.
3. `scene` param + catalogue + completion in the MCP tool.
4. Mint `pine-forest` over `rocky-irregular`+`verdure-trio`, view it.
5. Expand vocabulary: `meadow-wild`, `coastal-rocks`, `alpine-sparse`.

## Deferred (separate from fill)

The terrain still floats on a flat rect — no horizon/sky. Even a fully
filled scene won't *fully* read until ground meets sky. Highest-leverage
single change but out of scope for the fill/completion work; tracked here
so it isn't lost.
