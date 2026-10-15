---
{ "id": "frags", "name": "Frags: a deathmatch (terminal)", "summary": "The player and its rivals in a match: each fall credited to whoever hit the fallen last (a kill on the bus), the fallen back after a few seconds at the spawn farthest from the living, first to the frag limit wins; with a clock, the place at the horn decides. Frags and place are kept.", "when": "deathmatch, free for all, frag limit, first to N kills, arena shooter, respawn, kill count, most kills wins, time limit, scoreboard, bots in the arena" }
---

## Role

**terminal** (ends in `success` when the player wins it, `fail` when anyone else does). Its frags (best high) and
place (best low) are kept. It owns the player's hp and death: use it instead of `fail-on-death` (a fall in a match is
not the end).

## Params

```json
{ "kind": "frags", "rivals": ["bot-1", "bot-2", "bot-3"], "frags": 10, "seconds": 300, "respawn": 3,
  "spawns": [[0, 0, 0], [30, 0, 0], [15, 20, 0], [15, -20, 0]], "hp": 100, "hits": 10, "win": 1 }
```

- `rivals`: the other contenders' ids, each a character with `body.hp` (its fall is the cast's `down`). Who they
  shoot is their own rule's (`target: 'all'` for a free-for-all).
- `frags`: the limit that wins (10). `seconds`: a time limit (none by default): at the horn the place decides, `win`
  or better (1) winning.
- `respawn`: seconds a fallen contender lies before it comes back (3). `spawns`: where they come back, at the one
  farthest from the nearest living body (the cast's `among`); none, and it stands up where it fell. `guard`: seconds
  a body back on its feet takes no hurt, or until it fires (2; 0 for none).
- `hp`, `hits`: the player's hp (100) and what each hit on it takes (10). At 0 the player falls (the cast's `kill`
  holds it) and comes back with full hp. `damage: true`: each round takes its own damage instead (a head hit's
  included). `armor: true` (with damage): the level's `armor` (a supply's) takes whole rounds while it lasts, then hp;
  it is lost with a fall.

## Lowers to

- world: per contender a frag count `__frag_<i>_<id>` and a last hitter `__lh_<i>_<id>` (set on each `hit:<id>` by
  its `by`, cleared when it falls); a fall (`down`, or the player's hp at 0) credits the last hitter and emits
  `kill { killer, victim }` (nothing when no one hit it since it last came back); a sequence per contender waits
  `respawn` seconds and the cast's `spawn` brings it back fresh (`fresh`: the loadout it was minted with, every round
  back), guarded (`guard`), at the farthest of the spawns (`among`); a watch per contender at the limit. The place is the laps rivals' lead and ahead flag per rival (`__place_<i>`, a tie to who got there first).
  With `seconds`, a clock (`__frags_t_<i>`) and a horn.
- contract: `on: { "frags:won": { end: "success" }, "frags:lost": { end: "fail" } }`, `keep` frags and place.
- HUD: hp, Frags n / limit, Place n / N, the clock; toasts on a frag and on being fragged.

Every verb is one Godot's bus performs (guarded reactions, watches, a timer, sequences, the cast's kill and spawn);
the hits that feed it travel as the fight does (kernel/combat.gd deals the hero's, not yet the gunners').

Godot's cast picks the farthest spawn too and holds a guarded body unhittable for its seconds (firing does not break
it there). Not yet: teams.
