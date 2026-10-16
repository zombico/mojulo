---
{ "id": "party", "name": "The battle party, carried (emitter)", "summary": "The party of a level's party battles (play.rpg) goes from level to level: each member's level, xp, hp and mp, class, class ranks and points, and the skills learned. The level loads the party slice's roster as it starts and keeps it as it changes.", "when": "keep the party's levels between levels, carry xp and classes, the party levels up for the whole game, RPG progress carries over, keep learned skills" }
---

## Role

**emitter**. Requires a `party` slice.

## Params

```json
{ "kind": "party", "slice": "party" }
```

- `slice`: the party slice the battle party is carried in (the store's only party slice when left out). Its roster
  holds one member per `play.rpg.party` id; a gameworld with `battles` declares it, its roster as the party starts.

## Lowers to

- contract: `consumes` the slice, `produces` `setStat` into it, and `party: { slice }`.
- the page (the rpg channel, playscape/rpg): as the level starts, each member's numbers in the roster are loaded into
  the battle kernel (`load`); after every fight, class switch, skill bought and rest, each number that changed goes
  into the level's envelope as a `setStat` (`save`). The envelope is applied when the level ends or is left by a door.

The numbers (a roster member's `stats`): `lv`, `xp`, `hp`, `mp`, `psn`, `in` (joined by an event), `cls.<class>` (1
for the current class), `cp.<class>` and `sp.<class>` (each class taken), `skill.<skill>` (1 for each learned),
`open.<class>` (1 for each class opened by an event). A member the roster lacks starts as `play.rpg` says.
