---
{ "id": "bag", "name": "The bag, carried (emitter)", "summary": "What the player holds goes from level to level: the level starts with an inventory slice's items in its bag, and every item that comes into or leaves the bag (a buy, a take, a give, a use) goes back to the slice. With it a shop, a chest and the inventory menu are a game's, not one level's.", "when": "keep items between levels, carry the inventory, items persist, the bag carries over, what I picked up stays, an inventory that lasts the whole game" }
---

## Role

**emitter**. Requires an `inventory` slice.

## Params

```json
{ "kind": "bag", "slice": "bag", "worn": "gear", "holders": "world" }
```

- `slice`: the inventory slice the bag is carried in (the store's only inventory slice when left out).
- `worn`: an inventory slice (not the bag's) what the player wears is carried in. As a level starts its worn items
  are worn again, their `on` effects done (an item's `equip: { slot, on, off }`, play.items).
- `holders`: a flags slice what each chest and counted shop still holds is kept in (`<levelRef>|<holder>:<item>` →
  its count), so a chest emptied in a level is empty when the level is entered again.

## Lowers to

- contract: `consumes` each slice named, `produces` grant / consume into the bag's and the worn's, setFlag into the
  holders', and `bag: { slice, worn?, holders? }`.
- the page (the game channel): at the start, each item the slices hold sets the bus's `held:<holder>:<item>`; each
  `in:<holder>:<item>:<n>` / `out:…` the bus says (a menu's buy, take, use, equip; a cue's give, use, equip) goes into
  the level's envelope: the bag's and the worn's as `grant` / `consume`, a chest's as a `setFlag` of what it holds now.
  The envelope is applied to the store when the level ends or is left by a door.

A `collect` into the same slice grants its own pickups (their bag counts are the same `held:bag:<item>` numbers), so
the two compose: pick up in one level, spend in the next.
