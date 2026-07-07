---
{ "id": "hazard-damage", "name": "Hazard damage (emitter)", "summary": "Walk into a hazard to lose health. An emitter: hazard zones decrement an in-level hp var on contact. It only damages — the losing itself is the separate fail-on-death terminal, so any level can be lethal or not independently.", "when": "spikes, lava, traps, damage zones, take damage, hurt the player, a hazard that drains health, fire/acid/electric floor" }
---

## Role

**emitter** (requires a `character` slice — for hp semantics). Not a terminal.

## Params

```json
{ "kind": "hazard-damage", "startHp": 100, "hazards": [
  { "at": [12, 0, 0], "damage": 30 },
  { "at": [16, 4, 0], "radius": 2, "damage": 15 }
] }
```

- `startHp` — the in-level starting hp (default 100; shown on the HUD).
- `hazards` — `[{ at, radius?, damage? }]`. `damage` per contact (default 20); `radius` the trigger
  (default 1.5).

## Lowers to

- world: one `zone` source + a reaction (`inc hp by -damage`) per hazard, plus the hp var + HUD.

## Note (M0 scope)

Hazard damage is IN-LEVEL only right now: it drives the hp var (which the HUD shows and
`fail-on-death` reads), but it does NOT yet persist final hp back to the store. Persisting damage
across levels (stat-carry) is a later pass. Pair with **fail-on-death** to make hazards lethal, and
with the **fall** policy's floor so falls never kill.
