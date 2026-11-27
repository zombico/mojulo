---
{ "id": "wake", "name": "Wake: foes woken as the player passes a mark (emitter)", "summary": "Foes asleep until the player passes a mark of one of its facts: a rail stage's waves woken as the craft's distance down its path passes each wave's mark, or traffic woken at a height. Each wave is woken once.", "when": "enemies appear as you fly along, waves triggered by distance, spawn the next wave at this point of the stage, foes that come in when you reach a mark, ambush when the player gets here" }
---

## Role

**emitter** — requires nothing, ends nothing. Pair it with the terminal the waves serve (`defeat-all` on a boss's parts,
`objectives`).

## Params

```json
{ "kind": "wake", "marks": [
  { "fact": "along", "min": 300, "foes": ["foe-1", "foe-2", "foe-3"] },
  { "fact": "along", "min": 840, "foes": ["foe-4", "foe-5", "foe-6"] }
] }
```

- `marks` — each a gauge's fact (`along` m down a rail stage's path; `alt`, `agl`, `speed`, `climb`, `bank`,
  `heading` a pilot's, in the HUD's units), its range (`min`, `max`, either open) and the `foes` it wakes. The foes are
  minted dormant; each is woken once, by one mark.

## Lowers to

- world: a `gauge` source a mark (worlds/event-bus.js: entered while the player's fact is in its range), a flag that it
  has fired, and on its first entering a `ctrl spawn` of each of its foes and `wake { n, of }`.
