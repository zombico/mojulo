---
{ "id": "push", "name": "Boulders onto plates (terminal)", "summary": "A grid of cells with boulders and plates. Walking into a boulder's cell from a side pushes it one cell on, if that cell is free; else the walker is put back. Every plate under a boulder wins. The block-pushing puzzle, entirely on the bus.", "when": "push the blocks, boulder puzzle, sokoban, crates onto switches, pressure plates, push puzzle" }
---

## Role

**terminal** (ends in `success`).

## Params

```json
{ "kind": "push", "origin": [20, 5, 0], "cols": 5, "rows": 5, "cell": 2.5, "blocks": [[1, 1]], "plates": [[3, 1]], "walls": [[2, 3]], "heights": [[0, 0.1, …], …] }
```

- `origin`: the grid's corner; `cols` × `rows` cells of `cell` metres (144 cells at most).
- `blocks`, `plates`, `walls`: cells [col, row]. No more plates than boulders.
- `heights`: each cell's ground, row by row (a grid laid on uneven land); else the origin's height.

## Lowers to

- world: a zone per cell watching the walker; its last cell a var; per cell and side, reactions guarded by `if`
  (came from that side, a boulder here, the next cell free) that move the boulder (a marker per cell shown while a
  boulder stands there) or put the walker back; a count of plates held and a watch at all of them.
- contract: `on: { "plates:held": { end: "success" } }`.

A boulder entered from no side (the first step, or a diagonal) stays put. The walker is not blocked by boulders; a
push that cannot happen puts it back where it came from.
