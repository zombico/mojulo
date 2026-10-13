---
{ "id": "supplies", "name": "Supplies (emitter)", "summary": "Pickups that give: health back into the level's hp, or rounds for the player's weapon (into its reserve, or a full magazine). Each is taken once, drawn as a floating heart or orb. The ammo-and-health economy of a shooter.", "when": "health pack, medkit, ammo pickup, ammo box, refill, restock, supplies, heal on pickup, ammo is scarce" }
---

## Role

**emitter**. It ends nothing; it feeds `fail-on-death`'s hp and the player's weapon.

## Params

```json
{ "kind": "supplies", "max": 100, "drops": [{ "at": [4, 10, 0], "gives": "health", "amount": 25 }, { "at": [8, 22, 0], "gives": "ammo", "amount": 20 }] }
```

- `drops`: each `{ at, gives: 'health' | 'ammo', amount?, radius? }`. Health gives `amount` hp (25); ammo gives
  `amount` rounds into the weapon's `reserve`, or, with no amount or a weapon without a reserve, a full magazine.
- `max`: the hp a health drop fills to (100; match `fail-on-death`'s `startHp`).

## Lowers to

- world: a zone per drop watching the player, a marker toggled off and a flag `__sp_<i>_<j>` set when taken (its
  reactions guarded by it: taken once), and on entering it either an `inc` of
  `hp` (to `max`) or the cast's `rearm` on the player (`{ do: 'ctrl', op: 'rearm', who, by? }`); emits
  `supply:health` / `supply:ammo`.

A weapon's ammo economy: `weapon.reserve` is the spare rounds a reload draws from; out of both, the weapon is dry and
does not reload until a supply restocks it. Without a reserve the reload is endless and an ammo drop fills the magazine.
