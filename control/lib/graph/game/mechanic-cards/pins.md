---
{ "id": "pins", "name": "The player's pins on a world map (emitter)", "summary": "A world map's own marks: the player sets and lifts pins on its opened map, each kept as a flag in a flags slice the game carries, so a region's pins stand on every page of it and show on its map, its corner and the compass.", "when": "pins on the map, mark a place, set a waypoint, spot it and pin it, a marker on the compass, remember where to go" }
---

## Role

**emitter**. Needs a `flags` slice in the store (named by `slice`, else the first one) and a page with a planned map's
own map (scene/channels/map-channel.js: its `pins`, gameworld/city-map.js planMap).

## Params

```json
{ "kind": "pins", "slice": "pins" }
```

## Lowers to

- contract: `on: { "pin:*": …, "unpin:*": … }`, each `{ emit: { type: "setFlag", slice, key: "{event}", value: true } }`
  (the flag is named for the event: `pin:|<region>|<x>|<y>|<k>`, its k-th setting there, or `unpin:|…|<k>`, the `|`
  keeping them off the shell's result), `produces` the setFlag, `consumes` the slice, and `pins: { slice }`: at the start
  the page hands the map every pin flag the slice holds (`window.__mojPinsIn`); a pin stands while its latest setting
  outnumbers its latest lifting.

A gameworld with world maps and an interface (`ui`, its `map` not false) gives each map page this, its pins in the
`pins` flags slice (gameworld/levels.js PINS_SLICE).
