### One map: a chapter is one level

- **A level laid as a map.** A level's graph may now branch: the `map` layout (level/map.js) lays it as sections
  PLACED on one ground, each with a position and a heading, where `sequential` laid one walk, a page a section. A new
  section, the JUNCTION (`junction: { radius, gates: { <gate>: <bearing°> } }`, level/graph.js), is a hub whose gates
  stand on its edge at compass bearings; an edge off it names its gate. A trail off a gate heads out along its bearing,
  its path's first point on the gate; a trail after a trail carries its frame on by its depth (its recipe `after` the
  one before, as a chain is laid); a trail may arrive at a junction, which is set past its far end with the gate turned
  back to meet it. The ground each section owns (a trail's whole site, a junction's disc) may not lie over another's:
  the layout refuses gates too close for their junction's radius, an arm folded back, and a loop, naming them. A chain
  is a map whose placements all point one way; `sequential` refuses a junction.
- **A map built as one page.** The `map` world kind (level/map-scene.js, `{ kind: 'map', level }`) builds every
  section as its own stage would and places it on the level's ground: its faces, repeats, lights and anchors turned to
  its heading and moved to its place, its heights met at the gate it leaves from (a trail after a trail keeps its
  parent's lift, its seam built in heights already), its walls on a turned frame laid as runs of short boxes so every
  reader of colliders reads them as before. Each trail keeps its band only (the apron its own page lays past it is
  dropped); the junction is a flat disc of paving; THE LAND BETWEEN is filled on a 4 m grid over the whole map, its
  heights from the bands' own edges (the nearest ruling), lying under each band where it reaches into it so a seam has
  no gap and no flicker; and the root's horizon rings the whole map. The sky, light and walk are the root's.
