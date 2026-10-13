---
{ "id": "bag", "name": "The bag, carried (emitter)", "summary": "What the player holds goes from level to level: the level starts with an inventory slice's items in its bag, and every item that comes into or leaves the bag (a buy, a take, a give, a use) goes back to the slice. With it a shop, a chest and the inventory menu are a game's, not one level's.", "when": "keep items between levels, carry the inventory, items persist, the bag carries over, what I picked up stays, an inventory that lasts the whole game" }
---

## Role

**emitter**. Requires an `inventory` slice.

## Params

```json
{ "kind": "bag", "slice": "bag" }
```

- `slice`: the inventory slice the bag is carried in (the store's only inventory slice when left out).

## Lowers to

- contract: `consumes: [{ slice }]`, `produces: [{ type: 'grant', slice }, { type: 'consume', slice }]`, and
  `bag: { slice }`.
- the page (the game channel): at the start, each item the slice holds sets the bus's `held:bag:<item>`; each
  `bag:in` / `bag:out` the bus says (`{ item, n }`, from a menu's buy, take or use, or a cue's give or use) goes into
  the level's envelope as a `grant` / `consume`, applied to the store when the level ends or is left by a door.

A `collect` into the same slice grants its own pickups (their bag counts are the same `held:bag:<item>` numbers), so
the two compose: pick up in one level, spend in the next.
