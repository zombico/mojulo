---
{"id": "gunshop", "name": "Gun shop: rounds for the player's gun (emitter)", "summary": "A gun shop at a city shop front: walk in with the price and a box of rounds goes into the gun the player carries (its reserve, a reload loading them). The open city's hero carries a pistol empty until then.", "when": "a gun shop, buy ammo, buy a gun, ammunation, arm the player, spend money on weapons"}
---

## Role

**emitter** (requires the bag). Laid by a played city with `shops.guns` (gameworld/shops.js); the hero's pistol is the bare hands' sidearm (arsenal.js `cityPistol`), carried empty.

## Params

```json
{"kind": "gunshop", "at": [30, 5, 0], "price": 30, "rounds": 24, "radius": 2.2}
```

- `at`, `radius` — its counter, before its door.
- `price`, `rounds` — what a box costs and holds.

## Lowers to

- world: a zone at `at` watching the player; entered → the price taken → `gunshop:bought`: `ctrl rearm` the player by `rounds`; short → `gunshop:short`.
- hud: a toast for each (the bought one says the key).
