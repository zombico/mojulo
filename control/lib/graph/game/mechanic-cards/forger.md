---
{"id": "forger", "name": "Forger: papers bought at a shop front (emitter)", "summary": "A forger at a shop front in a played city: walked into with the price in coin and no papers yet, forged papers (a fake ID, a heavy machinery licence, a lifted office badge) go into the bag and are kept. A driving or office job can ask for them before it is taken; with several papers, it sells the one the job asked for.", "when": "fake id, forged papers, buy a licence, forger, black market papers, licence for heavy machinery, a shady shop that sells documents, stolen id, office badge"}
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
- `papers`, `asks` — a forger of several papers in place of `price`, `item`, `name`: `papers` each `{ item, name, price, says? }`
  (a licence, an office ID badge), `asks` which paper each job asks for (`{ <task id>: <index> }`). It sells the paper the
  job that last turned the player away asked for (that task's `task:needs:<id>`); asked for none yet, it asks what for.

## Lowers to

- world: the zone `forger` entered with none of the item held → the price spent from the bag (`forger:bought`, the item into it; short, `forger:short`); with it held, `forger:had`. A banner on buying, toasts otherwise.
