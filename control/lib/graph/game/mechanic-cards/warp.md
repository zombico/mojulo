---
{ "id": "warp", "name": "A warp within the level (a camera teleport)", "summary": "Walk into a warp zone and you are sent elsewhere in the same level: moved to its `to`, as a fall caught moves you back; it says `then`, an event a scene starts on, so the arrival is shown. Not an end. A subway's tunnel left at one station and the next station's platform arrived on.", "when": "teleport, warp, a portal within the level, take the train to the next station, a tunnel that comes out somewhere else, a lift that is a cut, step into the light and stand in another room" }
---

## Role

**emitter** (never ends the level). A level with warps still needs its own success terminal.

## Params

```json
{ "kind": "warp", "at": [12, 40, 0.3], "radius": 1.2, "to": [12, 260, 2.75], "then": "arrive:king" }
```

- `at` is the zone's middle; `radius` (default 1.2) or `half: [hx, hy, hz]` sizes it; `planar` (default `true`)
  ignores Z.
- `to` is where the walker is moved: its position as its spawn is given ([x, y, z]: a first-person walker's is its eye,
  its feet plus its eye height). It keeps the way it faced.
- `then` (optional) is an event said as the walker is sent: a scene `when: { on: '<then>' }` starts on it (a shot of
  the arrival, `play.scenes`).

## Lowers to

- **world:** a `zone` source at `at` watching the player; on entering, a `move` of the player to `to` (the bus's warp,
  as the fall policy's catch), and `then` emitted when given.

Its zone fires again each time it is entered: stand `to` clear of any warp's zone.
