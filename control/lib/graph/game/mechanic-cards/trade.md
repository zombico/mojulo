---
{ "id": "trade", "name": "Trade: an item had for its price (emitter)", "summary": "A place an item is had: walk in holding what it needs and that is spent for it, the item into the bag. With no needs it is a source (a shelf, a crate). It gives again only once the bag holds none of it, so a spoiled cargo is fetched again. An errand's leg.", "when": "buy eggs at a shop, trade coin for an item, a shelf to take from, swap a token for a key, a crate of supplies, a fetch quest's pickup, the item behind a price, a trading sequence" }
---

## Role

**emitter** (requires an `inventory` slice, the bag). Compose it with `bag` (which keeps the bag's changes in the store).

## Params

```json
{ "kind": "trade", "item": "eggs", "at": [6, 2, 0], "count": 12, "needs": [{ "item": "coin", "n": 3 }] }
```

- `item` — what is had here; `count` how many (1).
- `at`, `radius` (1.6), `planar` — where.
- `needs` — `[{ item, n? }]`: spent for it. Short of any, a toast names the price and nothing moves.

## Lowers to

- world: zone and marker `trade-<item>`; on entering while the bag holds none of it, a chain of guards over the needs,
  then the needs moved bag → nowhere and the item nowhere → bag (playscape/ui/items.js `lowerMove`: `in:` / `out:` said
  for the store), `pickup:<item>`; short, `trade:<item>:short`.
- contract: `produces` grant (and consume, with needs) into the bag.
