---
{ "id": "control", "name": "Control: a point two sides fight over (terminal)", "summary": "Two sides and one point: every second the side alone on it scores one, contested or empty nobody does, and the first side to the hold time wins. A fallen body holds nothing. The player's side's seconds are kept.", "when": "control point, king of the hill, capture point, hardpoint, hold the point, objective mode, team objective, zone control, domination" }
---

## Role

**terminal** (ends in `success` when the player's side holds the point long enough, `fail` when the other side
does). The seconds the player's side held it (best high) are kept. Pair it with `frags` (its `teams`, a high frag
limit) for the respawns and the player's hp: control decides the match, frags keeps the fight going.

## Params

```json
{ "kind": "control", "teams": { "red": ["player", "bot-1"], "blue": ["bot-2", "bot-3"] },
  "at": [0, 0, 0], "radius": 4, "hold": 60 }
```

- `teams`: two sides, the player in one, every id once (the same as frags' `teams`).
- `at`, `radius`: the point, a ring on the floor (4 m).
- `hold`: the seconds on the point that win (60, from 5).

## Lowers to

- world: a zone per contender at the point (its own watch), a flag per contender (`__cpin_<i>_<id>`: standing on it)
  and a count per side (`__cpn_<i>_<side>`): an enter counts it, an exit or a `down` uncounts it. A one-second timer;
  each second a side whose count is above 0 while the other's is 0 scores one (`__cps_<i>_<side>`). A watch per side
  at `hold`.
- contract: `on: { "control:won": { end: "success" }, "control:lost": { end: "fail" } }`, `keep` the held seconds.
- HUD: Point (ours) n / hold, Point (theirs) n / hold.

It is the web's: a Godot export does not keep it yet (its zones would each watch a body of the cast, and the
kernel's watch the hero). The minds go for it with
`rule.objective` (a match player with no foe in sight, and nothing it wants, heads for the point and stands on it).

Not yet: capture the flag (a flag carried is a body following a body: the cast cannot yet carry), a point that moves
(hardpoint rotation), overtime (a contested point at the limit).
