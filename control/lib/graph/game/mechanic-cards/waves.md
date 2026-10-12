---
{ "id": "waves", "name": "Waves on the base (terminal)", "summary": "Foes minted asleep wake in waves and walk a path to the base. One that arrives costs a life and goes; one that falls pays a bounty into the purse. Every foe accounted for wins; no lives left loses. The tower defence's loop.", "when": "tower defence, defend the base, hold the line, waves of enemies, they march on the gate, survive the waves, protect the village" }
---

## Role

**terminal** (ends in `success` when every foe is felled or through, `fail` when the lives run out).

## Params

```json
{ "kind": "waves", "waves": [{ "after": 6, "foes": ["foe-1", "foe-2"], "every": 1.6 }], "path": [[60, 0], [30, 4], [0, 0]], "lives": 5, "bounty": 2, "purse": { "var": "gold", "start": 10 } }
```

- `waves`: each wakes its foes `after` seconds (after the previous wave's last), `every` seconds apart.
- `foes`: ids of characters minted `dormant: true` (their bodies `hittable` with `hp` and `poise`, so a hit fells them).
- `path`: the walk to the base, [x, y] points; the last is the base.
- `lives` (5), `bounty` (1), `purse` ({ var, start, label? }): the gold a cue spends (a pad's `if` and `add`).
- `who`: a glob over the foes' ids (`foe-*`).

## Lowers to

- world: a sequence from the level's start that spawns and walks each foe (the `ctrl` verb: the level's events reach
  the cast); `arrive` (last point) → `leak` (a life, the foe sent away); `down` → the bounty; watches on the lives and
  the count of foes accounted for; HUD: lives, gold, the wave's banner, a toast per leak.
- contract: `on: { "waves:cleared": { end: "success" }, "base:fallen": { end: "fail" } }`.

Defenders are the other side: a tower is a character on the `sentry` motivation (it never moves; it turns to the
nearest live foe on `rule.foes`, a team, inside `range` and fires its `weapon`), woken by a cue.
