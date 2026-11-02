---
{ "id": "deliver", "name": "Deliver to the giver (terminal)", "summary": "The giver's hand-in: walk in holding each asked item, at least its min, and those are handed over, ending the level in success. Short of any, a toast says what to bring and nothing is taken. The end of an errand: sent out with a list, home with the goods.", "when": "deliver the package, bring it back to the giver, hand in the quest items, return the eggs, complete the delivery, the fetch quest's hand-in, bring me five pelts, turn in the errand" }
---

## Role

**terminal** (ends in `success`; requires the bag). In place of `reach-exit` on the giver's level.

## Params

```json
{ "kind": "deliver", "id": "eggs-run", "at": [3, 4, 0], "wants": [{ "item": "eggs", "min": 6 }] }
```

- `id` — the errand's name (`errand`).
- `at`, `radius` (2) | `half`, `planar` — the giver's place.
- `wants` — `[{ item, min? }]`: what is asked, and how much of it must have survived.

## Lowers to

- world: zone `deliver-<id>`; on entering, a chain of guards (each item held at least `min`), then each `min` moved
  bag → nowhere and `errand:done:<id>`; short, `errand:short:<id>` and a toast.
- contract: `on: { "errand:done:<id>": { end: "success" } }`; `produces` consume.
- audit: `{ kind: "walkto", target: at }` — the walk to the giver; what it must carry first is the errand's order
  (gameworld's `errands`), so a level whose bag starts empty is proved only with the errand's legs before it.
