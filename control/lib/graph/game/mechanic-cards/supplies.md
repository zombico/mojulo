---
{ "id": "supplies", "name": "Supplies (emitter)", "summary": "Pickups that give: health back into the level's hp, rounds for the player's weapon, armor, or an overdrive. Taken once, or back after a respawn time (an arena's item timing); bots may take them too. Drawn as a floating heart, orb, gem or star. The item economy of a shooter.", "when": "health pack, medkit, ammo pickup, ammo box, refill, restock, supplies, heal on pickup, ammo is scarce, armor pickup, power-up, quad damage, item timing, pickups respawn" }
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

## Timing, armor, the overdrive, and who takes them

```json
{ "kind": "supplies", "respawn": 20, "takers": "bot-*", "armorMax": 100,
  "drops": [{ "at": [4, 10, 0], "gives": "armor", "amount": 50, "respawn": 25 }, { "at": [0, 0, 0], "gives": "overdrive", "amount": 10 }] }
```

- `respawn` (or a drop's own): seconds after it is taken it is there again (a sequence sets it back, toggles its marker
  on and says `supply:back`). Without it a drop is taken once, as before.
- `gives: 'armor'`: into the level's `armor` (to `armorMax`): `frags` with `armor: true` lets it take whole rounds while
  it lasts. `gives: 'overdrive'`: the cast's status for `amount` seconds (10): its taker's rounds hit harder.
- `takers`: a glob of the others who may take them: health and armor heal them (the cast's heal), rounds rearm them,
  overdrive drives them. Whoever takes one, it is gone for everyone until it is back. A mind that knows them
  (`rule.items`) goes for them when hurt or short of rounds, and remembers when it took each.

## A weapon on the floor

```json
{ "kind": "supplies", "respawn": 30, "takers": "bot-*",
  "drops": [{ "at": [12, 4, 0], "gives": "weapon", "slot": "long" }] }
```

- `gives: 'weapon'` with `slot`, a name (or index) in the taker's `loadout`: the cast's `arm`. A slot the loadout marks
  `held: false` is not carried until it is picked up; then it is in hand (its switch time paid) and its key and the
  cycle reach it. A gun carried already takes its rounds full. Emits `supply:weapon { slot }`.
- The fallen come back with the loadout they were minted with (frags' `fresh` spawn): a picked-up gun is lost with
  the life, as an arena's are. Minds that know the drop (`rule.items`) go for a gun they lack or that runs dry.

Without `respawn`, armor, overdrive, a weapon or `takers` it lowers byte for byte as before.
