---
{
  "id": "level-ground",
  "name": "Shape a level's ground on its grid",
  "summary": "A gameworld level's land in its own space: how high and low the walk's heartbeat goes, and cliffs, gorges, ridges and raises placed by cell.",
  "when": "\"put a cliff here\", \"cut a gorge across the second half\", \"make the climbs bigger and the dips shallower\", \"raise a hill for the landmark\", \"the walk is too flat in the middle\", \"where should I add some height\", \"tune the ground of my level\", \"give this level the same terrain feel as the first\", \"save this level's terrain to reuse\"",
  "entry": "tune_ground",
  "form": "game"
}
---
→ `tune_ground({ ref })`: the level's grid as a map (columns A… across from the far cliff, rows 1… along the walk), each trail's dials, and hotspots (summits, hollows, open flat ground, dull stretches of walk) with edits ready to paste. Then `tune_ground({ ref, tune: { amplitude, depth, … }, edits: [{ op: 'cliff', path: 'B3>F3', height: 6, high: 'D1' }, { op: 'gorge', path: 'A12>J12', depth: 4 }] })` previews it; `apply: true` keeps it. Ops: raise, lower, flatten (`at` a cell or 'C4:E6'), cliff, gorge, ridge (`path`). The walk follows an edit unless `walk: 'keep'`. Share the land's flow as a heartbeat: `export: { id, save: <ref> }`, then `heartbeat: <ref>` on another level. (Contrast: a level's look → the geocube, `create_sketch`; an open terrain world → `compose_world`.) Full family → `get_creative_toolset({ form: 'game' })`.
