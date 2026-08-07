---
{ "id": "vision-pane", "name": "visionPane — road/terrain/floor depth slice", "summary": "one construction mark for the visible depth slice of a road, floor, plaza, hall, or terrain", "when": "visible roads, streets, vehicle lanes, terrain, floors, plazas, room floors, hall floors — anything where a single perspective depth pane should be aligned to the selected shot instead of hand-authoring depth polygons", "tier": "render-primitive", "marks": ["visionPane"], "phase": "p1" }
---

For visible roads, terrain, floors, plazas, or room-floor grids that must
align to the selected shot, emit one `visionPane` construction mark instead
of hand-authoring depth polygons.

## Shape

```
visionPane{
  role,
  mode: "road"|"road-lane"|"terrain"|"landscape"|"floor"|"plaza"|"room-floor"|"hall-floor",
  vanishingPoint?: [x,y],
  nearEdge: { left:[x,y], right:[x,y] },
  farEdge?:  { left:[x,y], right:[x,y] },
  horizonBoundary?: { y, centerX?, width?, leftX?, rightX? },
  farT?,
  fill?, stroke?,
  features?: { curbs?, centerline?, depthRows?, crosswalk?:{rows?, at?, span?, stroke?} },
  debug?
}
```

## Mode picker

- Road-like modes (`"road"`, `"street"`, `"road-lane"`, `"vehicle-road"`)
  get road furniture: curbs/crosswalks/centerlines through `features`.
- Terrain/hall/floor/plaza modes default to generic depth panes without
  road markings.

## Edge choice

- Prefer `nearEdge` plus `farEdge` or `horizonBoundary` when the top-down
  map decides where the visible slice ends.
- Use `vanishingPoint`/`farT` only when the pane should taper toward a
  point.

## Composes with

- `polygonizer.mandalaPatternLayer.blockLayout` — for streets/settlements,
  pick a block layout before visible lowering so parcel bands, anchors,
  and landmark bias vary the street rhythm.
- Street shot glyphs (see `mandala-pattern-layer` if available) carry
  `visionPane` plus `placementSpace` support/parcel rails so buildings and
  street slope share one gravity basis before visible skins are accepted.
