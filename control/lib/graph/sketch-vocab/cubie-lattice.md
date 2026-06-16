---
{ "id": "cubie-lattice", "name": "cubieLattice — gridded cuboids with negative space", "summary": "separated solid cubies whose gaps create negative space", "when": "Rubik's-cube-like grids, voxel walls, modular furniture grids, anywhere a 3D grid of cuboids with intentional gaps should be expressed as one mark", "tier": "render-primitive", "marks": ["cubieLattice"], "phase": "p1" }
---

`cubieLattice` expands into separated `solid` cubies whose gaps create the
negative space. One mark instead of enumerating each cubie.

## Shape

```
cubieLattice{
  role,
  anchor:[x,y],
  cols?, rows?, layers?,
  cellSize?, gap?, depth?,
  fill?, stroke?, z?
}
```

## What it expands into

Each cell becomes one filled `solid` cuboid placed at
`anchor + [col*(cellSize+gap), row*(cellSize+gap)]`, with optional `depth`
giving each cubie a Z extrusion. The `gap` between cubies is the negative
space that makes the lattice read as a lattice rather than a wall.

## When to reach for it

- Rubik's-cube-style 3×3×3 or larger grids.
- Voxel walls with intentional kerf.
- Modular cubby shelves where the visible grid is the subject.

For solid walls without gaps, use `solid` plus `partition`. For ribbed
shelving where each shelf is the subject, use `partition` against a single
`solid`.
