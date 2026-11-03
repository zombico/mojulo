---
{ "id": "cargo", "name": "Cargo: a carried item's condition (emitter)", "summary": "What a carried item's condition is: its count in the bag. Fragile, each hit the carrier takes and each fall loses one; perishable, one every N seconds while any is carried. A bar on the HUD and a toast a loss. The store carries it from level to level, so the stakes travel with you.", "when": "fragile cargo, eggs that break, a meal that goes cold, a delivery that spoils, carry it without falling, don't get hit while carrying, a package to keep intact, a timed delivery, a hot pizza" }
---

## Role

**emitter** (requires the bag). On every level the cargo is carried through.

## Params

```json
{ "kind": "cargo", "item": "eggs", "fragile": true, "max": 12 }
```

- `item` — the carried thing; its count in the bag is its condition.
- `fragile: true` — `hit:<player>` and the fall policy's catch each lose one.
- `perishable` — seconds a unit lasts while any is carried (a timer while held).
- `max` — the HUD bar's top (12).

## Lowers to

- world: a jolt per hit, fall and period (`cargo:jolt:<item>`), each a guarded move of one unit bag → nowhere
  (never below none), `cargo:lost:<item>`; the bar and a toast.
- contract: `produces` consume from the bag.
