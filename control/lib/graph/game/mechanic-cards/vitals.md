---
{"id": "vitals", "name": "Vitals: the street's health, and wasted (emitter)", "summary": "The player's health in an open city: each blow costs some, quiet a few seconds it mends, and at none the player is wasted: out of any car, a hospital bill paid when held, set down at the start, whole again. The law lets them go and a fight under way is lost.", "when": "health in an open world, wasted, die and respawn at the hospital, health regen, a hospital bill, the player can be beaten up, GTA-like health"}
---

## Role

**emitter** (requires the bag when it bills). Laid by a played city level (gameworld/levels.js), beside the law's `wanted` and a faction's fights, which lean on it.

## Params

```json
{"kind": "vitals", "hp": 100, "hit": 10, "mend": 2, "after": 5, "bill": 30, "back": [0, 0, 0]}
```

- `hp` — the whole health; `hit` — what a blow costs.
- `mend`, `after` — health a quiet second gives back, after this many seconds clear of blows.
- `bill`, `back` — the coin being wasted costs (when held); where the player wakes.

## Lowers to

- world: `hit:<player>` → `health` −`hit` (to 0), `health-quiet` 0; a timer each second while hurt: `health-quiet` +1, and past `after`, `health` +`mend` (to `hp`).
- `wasted` (`health` ≤ 0): `ctrl dismount` the player, `move` to `back`, `health` whole, the bill taken.
- hud: `health` as a bar, top left; a WASTED banner; a toast for the bill.
