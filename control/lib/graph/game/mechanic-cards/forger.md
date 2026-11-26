---
{"id": "forger", "name": "Forger: papers bought at a shop front (emitter)", "summary": "A forger at a shop front in a played city: walked into with the price in coin and no papers yet, forged papers (a fake ID, a heavy machinery licence) go into the bag and are kept. A driving job can ask for them before it is taken.", "when": "fake id, forged papers, buy a licence, forger, black market papers, licence for heavy machinery, a shady shop that sells documents"}
---

## Role

**emitter**. Beside the shift whose task asks for its papers (gameworld/jobsified.js `licence`).

## Params

```json
{"kind": "forger", "at": [120, 40, 2], "price": 150, "item": "fake-id", "name": "heavy machinery licence"}
```

- `at`, `radius` — the forger's door, a shop front.
- `price` — the coin the papers cost.
- `item`, `name` — what goes into the bag, and what it is called.

## Lowers to

- world: the zone `forger` entered with none of the item held → the price spent from the bag (`forger:bought`, the item into it; short, `forger:short`); with it held, `forger:had`. A banner on buying, toasts otherwise.
