---
{ "id": "collect", "name": "Collect pickups (emitter)", "summary": "Touch pickups to grant items into inventory. An emitter: each pickup is a zone that, on contact, grants its item to a named inventory slice and disappears. Loot found in-level rides out in the outcome envelope. Not a terminal — pair with reach-exit or survive.", "when": "collect coins/gems/keys, pick up loot, gather items, grab pickups, coins scattered in a level, find treasure, loot that carries between levels" }
---

## Role

**emitter** (requires an `inventory` slice). Not a terminal.

## Params

```json
{ "kind": "collect", "into": "bag", "pickups": [
  { "item": "coin", "at": [8, 0, 0] },
  { "item": "coin", "at": [10, 0, 0] },
  { "item": "rune-key", "at": [14, 2, 0], "radius": 1.4 }
] }
```

- `into` — the NAME of the inventory slice to grant into (required; there's no store at
  level-resolve to infer it — `create_game` validates the name against the game's store later).
- `pickups` — `[{ item, at, radius? }]`. `item` is the granted item id; `at` its position;
  `radius` the pickup trigger (default 1.4).

## Lowers to

- world: one `zone` source + a marker entity + a reaction (`pickup:<item>` emit) per pickup; the
  marker toggles off when taken.
- contract: `produces: [{ type: "grant", slice: <into>, max: <#pickups> }]`, and one on-map entry
  per distinct item: `on: { "pickup:coin": { emit: { type: "grant", slice: <into>, item: "coin", count: 1 } } }`.

To make collecting EVERYTHING the win condition, that's the `collect-all` terminal variant
(second wave); plain `collect` is optional loot alongside another terminal.
