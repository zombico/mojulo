---
{ "id": "coins", "name": "Coins (emitter)", "summary": "A platformer's coins along the way: each a coin glyph that pops when touched (in the air too: a coin over a gap is taken mid-jump), counted on the HUD as Coins; every so many coins says oneup, which lives gives back as a life. No store.", "when": "coins, collectibles along the course, rings, gems to grab, a coin trail over a gap, 100 coins for an extra life, 1-up from coins" }
---

## Role

**emitter** (emits `oneup`).

## Params

```json
{ "kind": "coins", "pickups": [{ "at": [0, 12, 3.1] }], "oneup": 30 }
```

- `pickups` — where each coin hangs; `radius` its reach (default 0.9, a sphere: it is taken in the air).
- `oneup` — coins to a 1-up (default 30).

## Lowers to

- world: a `coins` var on the HUD; each coin a zone that toggles its marker off, says `coin` (its chime) and counts; every `oneup` coins a
  watch emits `oneup` and the count toward the next starts again.
- decoration (mechanic-decor.js): a floating coin glyph at each, burst when taken.

Requires no store slice (a coin is a count, not an item in the bag: `collect` is for items).
