---
{ "id": "abilities", "name": "Abilities: a kit on keys and cooldowns (emitter)", "summary": "The player's kit, on the bus: a heal on a key with a cooldown, and an ultimate charged by every hit the player lands on a rival, spent into overdrive (its rounds hit harder) and full hp. The stylized shooter's kit.", "when": "abilities, cooldown, ultimate, ult charge, hero shooter, heal ability, kit, Q ability, overdrive, power on a key" }
---

## Role

**emitter**. Pair it with what owns `hp` (`frags`).

## Params

```json
{ "kind": "abilities", "heal": { "key": "q", "amount": 60, "cooldown": 8, "max": 200 },
  "ultimate": { "key": "x", "per": 6, "for": 6, "max": 200, "rivals": ["bot-1", "bot-2"] } }
```

- `heal`: `amount` hp back at once (50), then `cooldown` seconds (10) before it is ready again; `true` takes the defaults.
- `ultimate`: `per` charge (to 100) for every hit the player lands on one of `rivals`; at 100 its key puts the player in
  overdrive (the cast's `status { is: 'overdrive', for }`: its rounds deal 1.5× in combat-ranged.js) and fills its hp.

## Lowers to

- world: a key input per ability (`ability:heal`, `ability:ultimate`, said once a press), a cooldown var ticked down
  every half second, guards chained through events (ready, then alive), `ability:<name>:used` when it fires, the HUD's
  cooldown counter and the ultimate's bar.
